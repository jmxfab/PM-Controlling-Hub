import "server-only";

import Anthropic from "@anthropic-ai/sdk";

/**
 * Liefert einen konfigurierten Anthropic-Client. Bevorzugt OAuth-Token
 * (z.B. Claude Pro/Max Subscription) wenn vorhanden, faellt sonst auf
 * regulaeren API-Key zurueck.
 *
 * Env-Vars (Reihenfolge):
 *  1. ANTHROPIC_OAUTH_TOKEN — sk-ant-oat-... (von `claude setup-token` oder
 *     OAuth-Flow). Wird als 'Authorization: Bearer' gesendet.
 *  2. ANTHROPIC_API_KEY — sk-ant-api-... (Console / Workspace API Key).
 *     Wird als 'x-api-key' gesendet.
 *
 * Wirft wenn keine der beiden gesetzt ist.
 */
export function createAnthropicClient(): Anthropic {
  const oauthToken =
    process.env.ANTHROPIC_OAUTH_TOKEN ??
    process.env.ANTHROPIC_AUTH_TOKEN ??
    null;
  const apiKey = process.env.ANTHROPIC_API_KEY ?? null;

  if (oauthToken) {
    return new Anthropic({
      // SDK 'authToken' Option setzt Authorization: Bearer Header.
      // Wichtig: KEINEN apiKey gleichzeitig setzen, sonst gibt's Header-Konflikte.
      authToken: oauthToken,
      defaultHeaders: {
        // Claude Code OAuth Tokens brauchen diesen Beta-Header.
        // Bei einem normalen Workspace-OAuth-Token kann er nichts kaputt machen.
        "anthropic-beta": "oauth-2025-04-20",
      },
    });
  }

  if (apiKey) {
    return new Anthropic({ apiKey });
  }

  throw new Error(
    "Anthropic-Auth fehlt: weder ANTHROPIC_OAUTH_TOKEN noch ANTHROPIC_API_KEY ist gesetzt.",
  );
}

/**
 * Erkennt ob ueberhaupt eine Anthropic-Konfiguration vorhanden ist.
 * Praktisch fuer API-Routes die einen 503 zurueckgeben wollen statt 500.
 */
export function hasAnthropicCreds(): boolean {
  return Boolean(
    process.env.ANTHROPIC_OAUTH_TOKEN ??
      process.env.ANTHROPIC_AUTH_TOKEN ??
      process.env.ANTHROPIC_API_KEY,
  );
}
