/**
 * Zentrale Klassifizierung von Hero-Steps nach Kategorie.
 * Wird aus View, Aggregator, Pipeline und Dashboard verwendet damit die
 * Logik an einer einzigen Stelle lebt.
 */

/** Steps die "finished" bedeuten — Projekt ist durch. */
export const FINISHED_STEP_PATTERNS = [
  "abgeschlossen",
  "archiviert",
  "fertig",
  "finished",
];

/** Abrechnungs-/Cash-Steps — alles rund um Rechnungsstellung. */
export const ACCOUNTING_STEP_PATTERNS = [
  "abschlussrechnung",
  "kundenrechnung",
  "schlussrechnung",
  "teil-rg",
  "teilrechnung",
];

/** Nacharbeits-/Reklamations-Steps. */
export const REWORK_STEP_PATTERNS = ["nacharbeit", "reklamation"];

/** Abschlussgespräch (Closing). */
export const CLOSING_STEP_PATTERNS = ["abschlussgespräch"];

/** Auftragsbestätigung (Customer commitment). */
export const COMMITMENT_STEP_PATTERNS = ["auftragsbestätigung"];

/** PV Bewertungspool. */
export const BEWERTUNGSPOOL_STEP_PATTERNS = ["bewertungspool"];

function lc(name: string | null | undefined): string {
  return (name ?? "").toLowerCase();
}

export function matchesStepPatterns(
  stepName: string | null | undefined,
  patterns: string[]
): boolean {
  const s = lc(stepName);
  if (!s) return false;
  return patterns.some((p) => s.includes(p));
}

export function isFinishedStep(stepName: string | null | undefined): boolean {
  return matchesStepPatterns(stepName, FINISHED_STEP_PATTERNS);
}

export function isAccountingStep(stepName: string | null | undefined): boolean {
  return matchesStepPatterns(stepName, ACCOUNTING_STEP_PATTERNS);
}

export function isReworkStep(stepName: string | null | undefined): boolean {
  return matchesStepPatterns(stepName, REWORK_STEP_PATTERNS);
}

export function isClosingStep(stepName: string | null | undefined): boolean {
  return matchesStepPatterns(stepName, CLOSING_STEP_PATTERNS);
}

export function isCommitmentStep(stepName: string | null | undefined): boolean {
  return matchesStepPatterns(stepName, COMMITMENT_STEP_PATTERNS);
}
