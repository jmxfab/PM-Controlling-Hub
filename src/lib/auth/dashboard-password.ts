/**
 * Dashboard-Password-Gate.
 *
 * Sehr einfaches Schutz-Schema: ein einziges Passwort aus der Env-Var
 * `DASHBOARD_PASSWORD` schützt das gesamte Dashboard. Wer das Passwort
 * eingibt, bekommt ein HttpOnly-Cookie mit dem SHA-256-Hash des
 * aktuellen Passworts. Beim nächsten Request prüft die Middleware, ob
 * das Cookie zum aktuellen Env-Var-Hash passt.
 *
 * Konsequenz: wenn das Passwort in Vercel geändert wird, werden alle
 * existierenden Cookies automatisch ungültig → alle User müssen sich
 * neu einloggen. Keine Session-Tabelle, keine Renewals nötig.
 *
 * Edge-Runtime-kompatibel (Web Crypto, kein Node-`crypto`).
 */

export const DASHBOARD_AUTH_COOKIE = "dashboard_auth";
export const DASHBOARD_AUTH_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 Tage

export function getDashboardPassword(): string | null {
  const value = process.env.DASHBOARD_PASSWORD;
  if (typeof value !== "string" || value.length === 0) return null;
  return value;
}

export async function computePasswordToken(
  password: string
): Promise<string> {
  const data = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return bufferToHex(hash);
}

export async function isAuthCookieValid(
  cookieValue: string | null | undefined
): Promise<boolean> {
  if (!cookieValue) return false;
  const password = getDashboardPassword();
  if (!password) {
    // Kein Passwort konfiguriert → Schutz deaktiviert.
    return true;
  }
  const expected = await computePasswordToken(password);
  return constantTimeEqual(cookieValue, expected);
}

function bufferToHex(buffer: ArrayBuffer): string {
  const view = new Uint8Array(buffer);
  let hex = "";
  for (let i = 0; i < view.length; i++) {
    hex += view[i].toString(16).padStart(2, "0");
  }
  return hex;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
