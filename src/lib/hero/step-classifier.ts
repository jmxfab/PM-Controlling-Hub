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

/**
 * Logische Gruppen für die Pipeline-Sicht. In welcher Reihenfolge sie
 * im UI erscheinen sollen regelt `STEP_CATEGORIES`. Die Erkennung
 * arbeitet auf dem sichtbaren step_name (ohne Emoji), case-insensitive.
 */
export type StepCategory =
  | "akquise"
  | "planung"
  | "freigabe"
  | "montage"
  | "nacharbeit"
  | "bewertung"
  | "abrechnung"
  | "fertig"
  | "sonstige";

export interface StepCategoryMeta {
  id: StepCategory;
  label: string;
  order: number;
  description: string;
}

export const STEP_CATEGORIES: Record<StepCategory, StepCategoryMeta> = {
  akquise: {
    id: "akquise",
    label: "Akquise",
    order: 1,
    description: "Erstkontakt, Angebotsprüfung, Vertriebs-Touchpoints.",
  },
  planung: {
    id: "planung",
    label: "Planung",
    order: 2,
    description:
      "Projekt- und Montageplanung, Heizlastberechnung, Detailgespräche.",
  },
  freigabe: {
    id: "freigabe",
    label: "Kundenfreigabe",
    order: 3,
    description: "Auftragsbestätigung und Warten auf Kundenrückmeldung.",
  },
  montage: {
    id: "montage",
    label: "Umsetzung / Montage",
    order: 4,
    description: "Terminierte Montage, Zählermontage, BnD, BZA, Umsetzung.",
  },
  nacharbeit: {
    id: "nacharbeit",
    label: "Nacharbeit",
    order: 5,
    description:
      "Projekte die nach bereits erreichten Steps wieder offen sind.",
  },
  bewertung: {
    id: "bewertung",
    label: "Abschluss & Bewertung",
    order: 6,
    description: "Abschlussgespräch und Bewertungspool.",
  },
  abrechnung: {
    id: "abrechnung",
    label: "Abrechnung",
    order: 7,
    description:
      "Teil- / Abschluss- / Kundenrechnungen im Cash-Tab isoliert.",
  },
  fertig: {
    id: "fertig",
    label: "Abgeschlossen / Archiviert",
    order: 8,
    description: "Projekt ist durch.",
  },
  sonstige: {
    id: "sonstige",
    label: "Sonstige",
    order: 9,
    description: "Steps die sich keiner Kategorie zuordnen lassen.",
  },
};

const CATEGORY_PATTERNS: Array<{
  category: StepCategory;
  patterns: string[];
}> = [
  // Reihenfolge = Priorität bei Überlappungen. Nacharbeit vor Montage
  // (Nacharbeiten Montage) und Abrechnung vor allem anderen (Teil-RG
  // steht manchmal im Namen eines Montage-Steps "Montage / 2. Teil-RG").
  { category: "fertig", patterns: FINISHED_STEP_PATTERNS },
  {
    category: "abrechnung",
    patterns: ACCOUNTING_STEP_PATTERNS,
  },
  { category: "nacharbeit", patterns: REWORK_STEP_PATTERNS },
  { category: "bewertung", patterns: [...CLOSING_STEP_PATTERNS, "bewertungspool"] },
  {
    category: "freigabe",
    patterns: [...COMMITMENT_STEP_PATTERNS, "offen beim kunden", " ab ", "ab$"],
  },
  {
    category: "montage",
    patterns: [
      "montage",
      "zählermontage",
      "umsetzung",
      "umsetzungsbeginn",
      "bza",
      "bnd",
      "inbetriebnahme",
      "solar nw",
    ],
  },
  {
    category: "planung",
    patterns: [
      "planung",
      "projektplanung",
      "projektvorbereitung",
      "heizlast",
      "detailgespräch",
      "montageplanung",
    ],
  },
  {
    category: "akquise",
    patterns: [
      "erstkontakt",
      "angebot",
      "angebotsprüfung",
      "neu erstkontakt",
    ],
  },
];

export function classifyStep(
  stepName: string | null | undefined
): StepCategory {
  const s = lc(stepName);
  if (!s) return "sonstige";
  for (const { category, patterns } of CATEGORY_PATTERNS) {
    for (const pattern of patterns) {
      // Spezielle Regex-ish Suffix/Prefix-Patterns
      if (pattern.startsWith(" ") || pattern.endsWith("$")) {
        const core = pattern.replace(/\$$/, "").trim();
        // " ab " passt auf z.B. "abcde ab xyz", nicht auf "abrechnung"
        if (pattern === " ab " && (s.includes(" ab ") || s.trim() === "ab"))
          return category;
        if (pattern === "ab$" && s.trim() === "ab") return category;
        if (s.includes(core)) return category;
      } else if (s.includes(pattern)) {
        return category;
      }
    }
  }
  return "sonstige";
}

