import "server-only";

import Anthropic from "@anthropic-ai/sdk";

export interface CallClaudeOpts {
  /** User-Prompt (Hauptinhalt). */
  prompt: string;
  /** Optionaler System-Prompt. Bei OAuth-Mode wird die 'Claude Code'-Identitaet
   *  automatisch davorgesetzt (sonst rejected Anthropic den Call). */
  system?: string;
  /** Default 'claude-haiku-4-5-20251001' — billig + schnell. */
  model?: string;
  /** Default 600. */
  maxTokens?: number;
  /** Default 0.7. */
  temperature?: number;
}

/**
 * Einheitliche Claude-Call-Funktion mit Auto-Routing.
 *
 * Reihenfolge (erstes konfiguriertes gewinnt):
 *  1. N8N_AI_WEBHOOK_URL  — Call wird durch n8n proxied (nutzt n8n's existing
 *     Anthropic-Credential). Sauberste Lösung weil Auth zentral verwaltet wird.
 *  2. ANTHROPIC_OAUTH_TOKEN  — Direct OAuth via Claude Pro/Max Subscription.
 *     Setzt automatisch Claude-Code-Identitaet im System-Prompt damit es
 *     nicht von Anthropic rejected wird.
 *  3. ANTHROPIC_API_KEY  — Standard Pay-per-Call API.
 *
 * Wirft wenn keine der drei Options konfiguriert ist.
 */
export async function callClaudeMessage(
  opts: CallClaudeOpts,
): Promise<string> {
  if (process.env.N8N_AI_WEBHOOK_URL) {
    return await callViaN8n(opts);
  }
  if (process.env.ANTHROPIC_OAUTH_TOKEN || process.env.ANTHROPIC_AUTH_TOKEN) {
    return await callViaOAuth(opts);
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return await callViaApiKey(opts);
  }
  throw new Error(
    "Keine Anthropic-Auth konfiguriert. Setze eine von: N8N_AI_WEBHOOK_URL, ANTHROPIC_OAUTH_TOKEN, ANTHROPIC_API_KEY",
  );
}

export function hasAnthropicCreds(): boolean {
  return Boolean(
    process.env.N8N_AI_WEBHOOK_URL ??
      process.env.ANTHROPIC_OAUTH_TOKEN ??
      process.env.ANTHROPIC_AUTH_TOKEN ??
      process.env.ANTHROPIC_API_KEY,
  );
}

/** Aktive Route fuer Debug/Logging — hilfreich um zu sehen wo der Call hingeht. */
export function activeAnthropicRoute(): "n8n" | "oauth" | "api_key" | "none" {
  if (process.env.N8N_AI_WEBHOOK_URL) return "n8n";
  if (process.env.ANTHROPIC_OAUTH_TOKEN || process.env.ANTHROPIC_AUTH_TOKEN)
    return "oauth";
  if (process.env.ANTHROPIC_API_KEY) return "api_key";
  return "none";
}

// ─────────────────────────────────────────────────────────────────────────────
// Route 1: via n8n-Webhook
// ─────────────────────────────────────────────────────────────────────────────

async function callViaN8n(opts: CallClaudeOpts): Promise<string> {
  const url = process.env.N8N_AI_WEBHOOK_URL!;
  const secret = process.env.N8N_AI_WEBHOOK_SECRET; // optional shared secret

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { "x-webhook-secret": secret } : {}),
    },
    body: JSON.stringify({
      prompt: opts.prompt,
      system: opts.system,
      model: opts.model ?? "claude-haiku-4-5-20251001",
      max_tokens: opts.maxTokens ?? 600,
      temperature: opts.temperature ?? 0.7,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`n8n webhook ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json().catch(() => null)) as
    | { text?: string; output?: string; draft?: string; result?: string }
    | null;
  // n8n-Workflows liefern in unterschiedlichen Shapes — wir akzeptieren mehrere
  const text =
    json?.text ?? json?.output ?? json?.draft ?? json?.result ?? null;
  if (!text || typeof text !== "string") {
    throw new Error(
      `n8n webhook: kein 'text'/'output'/'draft'/'result' im Response — got: ${JSON.stringify(json).slice(0, 200)}`,
    );
  }
  return text.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Route 2: via OAuth-Token (Claude Pro/Max Subscription)
// ─────────────────────────────────────────────────────────────────────────────

const CLAUDE_CODE_IDENTITY =
  "You are Claude Code, Anthropic's official CLI for Claude.";

async function callViaOAuth(opts: CallClaudeOpts): Promise<string> {
  const token =
    process.env.ANTHROPIC_OAUTH_TOKEN ?? process.env.ANTHROPIC_AUTH_TOKEN!;

  // Wichtig: Claude Code OAuth requires the 'Claude Code'-Identitaet im
  // system-Prompt, sonst rejected die API den Token mit 401/400.
  // Wenn der User selber ein system uebergibt, prefixen wir die Identitaet.
  const systemFinal = opts.system
    ? `${CLAUDE_CODE_IDENTITY}\n\n${opts.system}`
    : CLAUDE_CODE_IDENTITY;

  const client = new Anthropic({
    authToken: token,
    defaultHeaders: {
      "anthropic-beta": "oauth-2025-04-20",
    },
  });
  const msg = await client.messages.create({
    model: opts.model ?? "claude-haiku-4-5-20251001",
    max_tokens: opts.maxTokens ?? 600,
    temperature: opts.temperature ?? 0.7,
    system: systemFinal,
    messages: [{ role: "user", content: opts.prompt }],
  });
  return extractText(msg);
}

// ─────────────────────────────────────────────────────────────────────────────
// Route 3: via Standard API-Key (Pay-per-Call)
// ─────────────────────────────────────────────────────────────────────────────

async function callViaApiKey(opts: CallClaudeOpts): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const msg = await client.messages.create({
    model: opts.model ?? "claude-haiku-4-5-20251001",
    max_tokens: opts.maxTokens ?? 600,
    temperature: opts.temperature ?? 0.7,
    ...(opts.system ? { system: opts.system } : {}),
    messages: [{ role: "user", content: opts.prompt }],
  });
  return extractText(msg);
}

// Non-streaming Message Response Shape (subset)
type NonStreamingMessage = {
  content: Array<{ type: string; text?: string }>;
};

function extractText(msg: unknown): string {
  const m = msg as NonStreamingMessage;
  if (!m?.content || !Array.isArray(m.content)) {
    throw new Error("Anthropic-Response ungueltig (kein content-Array)");
  }
  const textBlock = m.content.find((c) => c.type === "text");
  const text =
    textBlock && typeof textBlock.text === "string"
      ? textBlock.text.trim()
      : "";
  if (!text) {
    throw new Error("Anthropic-Response leer (kein text-Block)");
  }
  return text;
}

// ─────────────────────────────────────────────────────────────────────────────
// Backwards-compat: alte createAnthropicClient() Funktion erhalten
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @deprecated Nutze callClaudeMessage() — handhabt Routing + OAuth-Identitaet
 *  automatisch. createAnthropicClient() bleibt fuer call-sites die schon den
 *  Client direkt nutzen, aber bevorzugt nur API-Key + naiver OAuth.
 */
export function createAnthropicClient(): Anthropic {
  const oauthToken =
    process.env.ANTHROPIC_OAUTH_TOKEN ?? process.env.ANTHROPIC_AUTH_TOKEN;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (oauthToken) {
    return new Anthropic({
      authToken: oauthToken,
      defaultHeaders: { "anthropic-beta": "oauth-2025-04-20" },
    });
  }
  if (apiKey) {
    return new Anthropic({ apiKey });
  }
  throw new Error("Weder ANTHROPIC_OAUTH_TOKEN noch ANTHROPIC_API_KEY gesetzt.");
}
