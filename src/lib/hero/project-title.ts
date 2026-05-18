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

  if (isJunkProjectName(raw)) return nextFallback();
  return (raw as string).trim();
}

/**
 * Reine Junk-Erkennung — gibt true zurueck wenn der projectName-String
 * keinen sinnvollen Inhalt traegt (nur Symbole, Platzhalter "--, --, --"
 * oder reine Nummer ohne Worte). UI-Sites koennen damit selbst entscheiden
 * ob sie die Zeile ausblenden oder einen Fallback zeigen.
 */
export function isJunkProjectName(
  raw: string | null | undefined,
): boolean {
  if (!raw) return true;
  const trimmed = raw.trim();
  if (!trimmed) return true;

  // Keine alphanumerischen Zeichen → nur Symbole
  if (!/[A-Za-zÄÖÜäöüß0-9]/.test(trimmed)) return true;

  // Klassisches Hero-Muster: "-NNNN | --, --, --" (viele Dashes, keine Worte)
  const letters = trimmed.replace(/[^A-Za-zÄÖÜäöüß]/g, "");
  const dashRun = (trimmed.match(/-/g) ?? []).length;
  if (letters.length === 0 && dashRun >= 2) return true;

  // Pattern "X | --, --, --" mit < 4 Buchstaben (z.B. "PVS-9031 -9031 | --, --, --")
  if (/\|\s*(--,?\s*){2,}/.test(trimmed) && letters.length < 4) return true;

  // Pattern enthaelt "--, --, --" oder "--/--/--" auch ohne Pipe — Hero
  // generiert diese Platzhalter manchmal direkt ohne fuehrende Nummer.
  if (/(--,?\s*){2,}/.test(trimmed) && letters.length < 4) return true;
  if (/--\s*[\/.]\s*--/.test(trimmed) && letters.length < 4) return true;

  return false;
}

/**
 * Convenience: gibt den getrimmten String zurueck wenn er nicht Junk ist,
 * sonst null. Fuer Query-Sites die `project_name`-Felder mappen — so kommt
 * im UI nie mehr Hero-Junk an statt eines schoenen Fallbacks.
 *
 * @example
 *   projectName: cleanProjectName(row.project_name)
 *   // UI macht: {projectName && <span>{projectName}</span>}
 */
export function cleanProjectName(
  raw: string | null | undefined,
): string | null {
  if (isJunkProjectName(raw)) return null;
  return (raw as string).trim();
}

/**
 * Placeholder fuer leere Werte — visuell dezenter En-Dash (–) statt
 * doppeltem Bindestrich (--) oder dem hässlichen "-" Default.
 * Verwendung: \{value ?? EMPTY\} oder JSX \{value ? value : <span className="text-muted-foreground/50">{EMPTY}</span>\}
 */
export const EMPTY_VALUE_DASH = "–"; // En-Dash U+2013
