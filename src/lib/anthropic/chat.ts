import "server-only";

import OpenAI from "openai";

/**
 * Multi-turn Chat mit Tool-Use-Loop, ueber Aether (OpenAI-API-kompatibel).
 *
 * Aether (aetherapi.dev) exposiert Claude/GPT/Gemini etc. ueber OpenAI's
 * Chat-Completions-Format inkl. Tool-Use. So koennen wir mit nur EINEM
 * Key (AETHER_API_KEY) alles abdecken: Whisper-Transkription UND AI-Chat
 * mit Tool-Calling. Anthropic-natives /v1/messages waere zwar maechtiger,
 * aber Aether bietet nur die OpenAI-Schicht.
 *
 * Fallback: wenn AETHER_API_KEY leer aber OPENAI_API_KEY gesetzt -> direkt
 * OpenAI (selbe API). Dritter Fallback: ANTHROPIC_API_KEY -> dann nutzen
 * wir den Anthropic-SDK-Adapter (siehe Ende der Datei).
 */

export interface ChatTool {
  name: string;
  description: string;
  /** JSON-Schema fuer die Tool-Parameter (OpenAI-Format). */
  input_schema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<string>;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface RunChatOpts {
  system: string;
  messages: ChatMessage[];
  tools: ChatTool[];
  maxRounds?: number;
  model?: string;
}

interface RunChatResult {
  reply: string;
  toolCalls: Array<{ name: string; input: unknown; result: string }>;
}

/** Liefert {client, baseModel} fuer aktuellen Provider, oder wirft wenn kein Key. */
function pickProvider(): {
  client: OpenAI;
  defaultModel: string;
  provider: "aether" | "openai";
} {
  const aether = process.env.AETHER_API_KEY;
  if (aether) {
    return {
      client: new OpenAI({
        apiKey: aether,
        baseURL: "https://api.aetherapi.dev/v1",
      }),
      // Aether-Modell-ID — kann ueber options.model uebersteuert werden.
      defaultModel: "kimi-k2.6",
      provider: "aether",
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
      defaultModel: "gpt-4o-mini",
      provider: "openai",
    };
  }
  throw new Error(
    "Weder AETHER_API_KEY noch OPENAI_API_KEY in Vercel gesetzt — AI-Chat braucht einen davon.",
  );
}

/**
 * Fuehrt einen kompletten Tool-Use-Chat-Loop aus (OpenAI-Format).
 */
export async function runChatWithTools(
  opts: RunChatOpts,
): Promise<RunChatResult> {
  const { client, defaultModel } = pickProvider();
  const model = opts.model ?? defaultModel;
  const maxRounds = opts.maxRounds ?? 8;
  const toolMap = new Map(opts.tools.map((t) => [t.name, t]));

  // OpenAI-Tools-Format
  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = opts.tools.map(
    (t) =>
      ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      }) as OpenAI.Chat.Completions.ChatCompletionTool,
  );

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: opts.system },
    ...opts.messages.map(
      (m) =>
        ({ role: m.role, content: m.content }) as
          | OpenAI.Chat.Completions.ChatCompletionUserMessageParam
          | OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam,
    ),
  ];

  const toolCalls: RunChatResult["toolCalls"] = [];

  for (let round = 0; round < maxRounds; round++) {
    const completion = await client.chat.completions.create({
      model,
      max_tokens: 1024,
      temperature: 0.3,
      messages,
      tools,
      tool_choice: "auto",
    });

    const choice = completion.choices[0];
    if (!choice) {
      return { reply: "(leere Antwort vom Modell)", toolCalls };
    }
    const msg = choice.message;
    // Push assistant-response in messages — auch bei tool_calls, damit der
    // Server-State stimmt.
    messages.push(msg);

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      // Tools ausfuehren, Ergebnisse als tool-Messages anhaengen
      for (const tc of msg.tool_calls) {
        if (tc.type !== "function") continue;
        const tool = toolMap.get(tc.function.name);
        let result: string;
        if (!tool) {
          result = `Tool '${tc.function.name}' nicht verfuegbar`;
        } else {
          try {
            const args = tc.function.arguments
              ? (JSON.parse(tc.function.arguments) as Record<string, unknown>)
              : {};
            result = await tool.execute(args);
            toolCalls.push({
              name: tc.function.name,
              input: args,
              result,
            });
          } catch (e) {
            result = `Fehler: ${e instanceof Error ? e.message : String(e)}`;
            toolCalls.push({
              name: tc.function.name,
              input: tc.function.arguments,
              result,
            });
          }
        }
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: result.slice(0, 16_000),
        });
      }
      continue; // naechste Runde
    }

    // Kein weiteres Tool — wir haben die finale Antwort
    const text = typeof msg.content === "string" ? msg.content : "";
    return { reply: text.trim(), toolCalls };
  }

  return {
    reply:
      "Nach mehreren Suchen kein klares Ergebnis. Stell die Frage gern praeziser.",
    toolCalls,
  };
}
