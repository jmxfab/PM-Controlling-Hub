import "server-only";

import Anthropic from "@anthropic-ai/sdk";

/**
 * Multi-turn Chat mit Claude inkl. Tool-Use-Loop.
 *
 * Im Gegensatz zu callClaudeMessage (das nur einen einzelnen Prompt sendet
 * und einen String zurueckgibt), unterstuetzt diese Funktion:
 *  - Tool-Definitions die Claude aufrufen kann
 *  - Mehrere Runden tool_use -> tool_result -> tool_use -> ...
 *  - Wird verwendet vom AI-Chat-Panel
 *
 * Routing: nutzt direkt die Anthropic API (n8n-Webhook kann das aktuell
 * nicht). Bevorzugt OAuth-Token (Claude Pro/Max Abo) > API-Key.
 */

const CLAUDE_CODE_IDENTITY =
  "You are Claude Code, Anthropic's official CLI for Claude.";

export interface ChatTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  /** Wird vom Endpoint aufgerufen wenn Claude das Tool benutzt. */
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
  /** Max Anzahl Tool-Use-Runden, sonst Endless-Loop-Schutz. Default 8. */
  maxRounds?: number;
  model?: string;
}

interface RunChatResult {
  reply: string;
  toolCalls: Array<{ name: string; input: unknown; result: string }>;
}

/** Erstellt einen Anthropic-Client passend zur konfigurierten Auth-Methode. */
function createAnthropic(): Anthropic {
  const oauth =
    process.env.ANTHROPIC_OAUTH_TOKEN ?? process.env.ANTHROPIC_AUTH_TOKEN;
  if (oauth) {
    return new Anthropic({
      authToken: oauth,
      defaultHeaders: { "anthropic-beta": "oauth-2025-04-20" },
    });
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  throw new Error(
    "Anthropic-Auth fehlt — ANTHROPIC_OAUTH_TOKEN oder ANTHROPIC_API_KEY in Vercel setzen",
  );
}

function systemWithIdentity(system: string): string {
  // OAuth requires Claude-Code-Identity Prefix, sonst rejected die API.
  // Bei API-Key brauchts den nicht, aber schadet auch nicht.
  return `${CLAUDE_CODE_IDENTITY}\n\n${system}`;
}

/**
 * Fuehrt einen kompletten Tool-Use-Chat-Loop aus.
 * Returns: finale Assistent-Antwort + Liste aller Tool-Calls.
 */
export async function runChatWithTools(
  opts: RunChatOpts,
): Promise<RunChatResult> {
  const client = createAnthropic();
  const model = opts.model ?? "claude-haiku-4-5-20251001";
  const maxRounds = opts.maxRounds ?? 8;
  const toolMap = new Map(opts.tools.map((t) => [t.name, t]));

  // Build initial conversation
  type AnyContent = unknown;
  const conversation: Array<{ role: "user" | "assistant"; content: AnyContent }> =
    opts.messages.map((m) => ({ role: m.role, content: m.content }));

  const toolCalls: RunChatResult["toolCalls"] = [];

  for (let round = 0; round < maxRounds; round++) {
    const msg = await client.messages.create({
      model,
      max_tokens: 1024,
      temperature: 0.3,
      system: systemWithIdentity(opts.system),
      tools: opts.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Anthropic.Messages.Tool.InputSchema,
      })),
      messages: conversation as Anthropic.Messages.MessageParam[],
    });

    // Sammle text + tool_use blocks
    const textParts: string[] = [];
    const toolUses: Array<{ id: string; name: string; input: unknown }> = [];
    for (const block of msg.content) {
      if (block.type === "text") textParts.push(block.text);
      else if (block.type === "tool_use") {
        toolUses.push({ id: block.id, name: block.name, input: block.input });
      }
    }

    // Falls keine Tools mehr benoetigt -> fertig
    if (toolUses.length === 0) {
      return { reply: textParts.join("\n").trim(), toolCalls };
    }

    // Tools ausfuehren und tool_result-Block bauen
    conversation.push({ role: "assistant", content: msg.content });

    const toolResults: Array<{
      type: "tool_result";
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    }> = [];
    for (const use of toolUses) {
      const tool = toolMap.get(use.name);
      if (!tool) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: use.id,
          content: `Tool '${use.name}' nicht verfuegbar`,
          is_error: true,
        });
        continue;
      }
      try {
        const result = await tool.execute(
          use.input as Record<string, unknown>,
        );
        toolCalls.push({ name: use.name, input: use.input, result });
        toolResults.push({
          type: "tool_result",
          tool_use_id: use.id,
          content: result.slice(0, 16_000), // Hard-Cap pro Tool-Result
        });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        toolCalls.push({ name: use.name, input: use.input, result: `ERROR: ${errMsg}` });
        toolResults.push({
          type: "tool_result",
          tool_use_id: use.id,
          content: `Fehler: ${errMsg}`,
          is_error: true,
        });
      }
    }

    conversation.push({ role: "user", content: toolResults });
  }

  // Max-Rounds erreicht
  return {
    reply:
      "Ich habe nach mehreren Suchen keine abschliessende Antwort gefunden. Stell die Frage gern praeziser.",
    toolCalls,
  };
}
