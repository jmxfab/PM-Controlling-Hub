/**
 * Hero project_title ist regelmäßig Müll wie "-6665 | --, --, --" wenn das
 * Projekt ohne echten Titel angelegt wurde. Diese Utility erkennt solche
 * Platzhalter und fällt auf den Kundennamen oder die Projektnummer zurück.
 *
 * Verwendung auf Dashboard, Fälligkeiten, Insights, Cashflow.
 */
export function cleanProjectTitle(
  raw: string | null | undefined,
  fallback?: { customerName?: string | null; projectNumber?: string | null }
): string | null {
  const customerName = fallback?.customerName ?? null;
  const projectNumber = fallback?.projectNumber ?? null;

  const nextFallback = (): string | null =>
    customerName && customerName.trim().length > 0
      ? customerName.trim()
      : projectNumber ?? null;

  if (!raw) return nextFallback();
  const trimmed = raw.trim();
  if (!trimmed) return nextFallback();

  // Keine alphanumerischen Zeichen → nur Symbole
  if (!/[A-Za-zÄÖÜäöüß0-9]/.test(trimmed)) return nextFallback();

  // Klassisches Hero-Muster: "-NNNN | --, --, --" (viele Dashes, keine Wörter)
  const letters = trimmed.replace(/[^A-Za-zÄÖÜäöüß]/g, "");
  const dashRun = (trimmed.match(/-/g) ?? []).length;
  if (letters.length === 0 && dashRun >= 2) return nextFallback();

  // Pattern "irgendwas | --, --, --" → Füller erkennen
  if (/\|\s*(--,?\s*){2,}/.test(trimmed) && letters.length < 4) {
    return nextFallback();
  }

  return trimmed;
}
