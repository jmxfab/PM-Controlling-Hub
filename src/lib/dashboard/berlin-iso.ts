/**
 * Berlin-aware ISO-Timestamp-Helper.
 *
 * Vorher hatten wir an vielen Stellen `${date}T00:00:00+02:00` hartcodiert.
 * Das funktioniert in Sommerzeit (CEST = UTC+02:00), bricht aber in
 * Winterzeit (CET = UTC+01:00) — Range-Queries waeren dann 1 Stunde
 * verschoben, was Rechnungen/Transitions an Tagesgrenzen falsch zaehlt.
 *
 * Diese Helper bestimmen die echte Berlin-Zeit-Offset (auto DST-aware)
 * fuer ein gegebenes Datum.
 */

const BERLIN_TZ = "Europe/Berlin";

/**
 * Liefert den GMT-Offset von Europe/Berlin am gegebenen UTC-Datum als
 * "+HH:MM"-String. Beispiel: "+02:00" (Sommer) oder "+01:00" (Winter).
 */
function berlinOffsetForDate(utcDate: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BERLIN_TZ,
    timeZoneName: "longOffset",
  }).formatToParts(utcDate);
  const tzName = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  // Format: "GMT+02:00" oder "GMT+01:00" — selten "GMT+0" wenn Browser
  // longOffset nicht voll ausgibt, dann auf +01:00 als sicheren CET-
  // Default zurueckfallen.
  const m = tzName.match(/GMT([+-]\d{2}):?(\d{2})?/);
  if (!m) return "+01:00";
  const hh = m[1];
  const mm = m[2] ?? "00";
  return `${hh}:${mm}`;
}

/**
 * Berlin-Mitternacht-Timestamp als ISO-String — z.B.
 *   berlinIsoStartOfDay("2026-04-24") → "2026-04-24T00:00:00+02:00"
 *   berlinIsoStartOfDay("2026-12-15") → "2026-12-15T00:00:00+01:00"
 */
export function berlinIsoStartOfDay(dateStr: string): string {
  // dateStr = "YYYY-MM-DD". Wir bauen ein UTC-Datum am Mittag damit der
  // Offset-Lookup auch an DST-Tagen stabil ist (DST-Wechsel passiert
  // immer um 02:00/03:00 Berlin — Mittag ist sicher).
  const probe = new Date(`${dateStr}T12:00:00Z`);
  const offset = berlinOffsetForDate(probe);
  return `${dateStr}T00:00:00${offset}`;
}

/**
 * Berlin-Mittag-Timestamp als ISO-String. Wird gelegentlich zum Setzen
 * von Reminder-/Reset-Daten verwendet, damit Timezone-Konvertierungen
 * nicht versehentlich auf den Vortag umkippen.
 */
export function berlinIsoNoon(dateStr: string): string {
  const probe = new Date(`${dateStr}T12:00:00Z`);
  const offset = berlinOffsetForDate(probe);
  return `${dateStr}T12:00:00${offset}`;
}
