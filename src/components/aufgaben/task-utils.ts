/**
 * task-utils.ts
 *
 * Pure helpers + Konstanten fuer das Aufgaben-Modul.
 * Keine React-Komponenten, keine State-Logik — alles deterministisch
 * (mit Ausnahme von Date.now/new Date() Aufrufen die bewusst impure sind).
 *
 * Ausgelagert aus aufgaben-view.tsx im Cleanup-Refactor.
 */

import type { MailTask } from "@/lib/supabase/mail-tasks-queries";
import type { SortMode, SortDirection } from "@/components/aufgaben/filter-bar";

/* ============================================================
 * Sortierung
 * ============================================================ */

/** Numerischer Rank pro Prio fuer die Sortierung. Niedriger = wichtiger. */
export const PRIO_RANK: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** Liefert eine sort()-Comparator-Funktion fuer den gewaehlten SortMode.
 *  Erledigte werden in jedem Modus ans Ende sortiert. */
export function compileSortComparator(
  mode: SortMode,
  direction: SortDirection,
): (a: MailTask, b: MailTask) => number {
  const dirFactor = direction === "asc" ? 1 : -1;
  return (a, b) => {
    // 1) Erledigte ans Ende (immer, unabhaengig von direction)
    const aDone = a.status === "done" ? 1 : 0;
    const bDone = b.status === "done" ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;

    if (mode === "priority") {
      const ra = PRIO_RANK[a.priority ?? "medium"] ?? 4;
      const rb = PRIO_RANK[b.priority ?? "medium"] ?? 4;
      // asc: urgent zuerst (ra-rb, niedriger Rank=oben)
      // desc: low zuerst (rb-ra)
      if (ra !== rb) return (ra - rb) * dirFactor;
      // Tiebreaker: immer neueste zuerst
      return sortByDate(a, b);
    }

    if (mode === "date") {
      // sortByDate liefert neueste-zuerst (desc).
      // asc dreht um -> aelteste zuerst.
      return sortByDate(a, b) * dirFactor * -1;
    }

    // default: Server-Reihenfolge respektieren, nur is_important hochziehen
    const aImp = a.is_important ? 0 : 1;
    const bImp = b.is_important ? 0 : 1;
    if (aImp !== bImp) return aImp - bImp;
    return 0;
  };
}

export function sortByDate(a: MailTask, b: MailTask): number {
  const aDate = a.thread_last_message_at ?? a.created_at ?? "";
  const bDate = b.thread_last_message_at ?? b.created_at ?? "";
  return bDate.localeCompare(aDate); // neueste zuerst (desc default)
}

/* ============================================================
 * Prioritaeten — Visual-Konfig fuer Badge / Bar / Dot pro Prio-Level
 * ============================================================ */

export const PRIORITY_CONFIG: Record<
  NonNullable<MailTask["priority"]>,
  { label: string; badge: string; bar: string; dot: string }
> = {
  urgent: {
    label: "Dringend",
    badge:
      "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900/50",
    bar: "bg-red-500",
    dot: "bg-red-500",
  },
  high: {
    label: "Hoch",
    badge:
      "bg-orange-50 text-orange-700 ring-1 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:ring-orange-900/50",
    bar: "bg-orange-500",
    dot: "bg-orange-500",
  },
  medium: {
    label: "Mittel",
    badge:
      "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/50",
    bar: "bg-amber-500",
    dot: "bg-amber-500",
  },
  low: {
    label: "Niedrig",
    badge:
      "bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700",
    bar: "bg-slate-400",
    dot: "bg-slate-400",
  },
};

/* ============================================================
 * Prio-Panel Trigger — Tasks mit gewissen Keywords werden oben
 * im UI hervorgehoben (Items 4.3 + 4.4 aus Roadmap).
 * ============================================================ */

/** Keywords die eine Task ins Prio-Panel oben heben. Case-insensitive,
 *  Umlaut-tolerant. */
export const PRIO_KEYWORD_PATTERNS = [
  /angebotspr[üu]fung/i,
  /bitte pr[üu]fen/i,
  /\bfreigabe\b/i,
  /auftragsbest[äa]tigung/i,
] as const;

export function isPrioTask(t: MailTask): boolean {
  const haystack = `${t.title} ${t.body ?? ""}`;
  return PRIO_KEYWORD_PATTERNS.some((re) => re.test(haystack));
}

/* ============================================================
 * Date-Bucketing — gruppiert Tasks in Heute/Gestern/Diese Woche/Älter
 * ============================================================ */

export type DateBucket = "heute" | "gestern" | "woche" | "aelter";

export function bucketOf(iso: string): DateBucket {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);
  if (d >= startOfToday) return "heute";
  if (d >= startOfYesterday) return "gestern";
  if (d >= startOfWeek) return "woche";
  return "aelter";
}

export const BUCKET_LABEL: Record<DateBucket, string> = {
  heute: "Heute",
  gestern: "Gestern",
  woche: "Diese Woche",
  aelter: "Älter",
};

export function groupByDate(
  tasks: MailTask[],
): { bucket: DateBucket; tasks: MailTask[] }[] {
  const buckets: Record<DateBucket, MailTask[]> = {
    heute: [],
    gestern: [],
    woche: [],
    aelter: [],
  };
  for (const t of tasks) buckets[bucketOf(t.created_at)].push(t);
  return (["heute", "gestern", "woche", "aelter"] as DateBucket[])
    .filter((b) => buckets[b].length > 0)
    .map((b) => ({ bucket: b, tasks: buckets[b] }));
}

/* ============================================================
 * Date-Formatting
 * ============================================================ */

export function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "gerade eben";
  if (diffMin < 60) return `vor ${diffMin} Min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `vor ${diffH} Std`;
  const diffD = Math.round(diffH / 24);
  if (diffD === 1) return "gestern";
  if (diffD < 7) return `vor ${diffD} Tagen`;
  return d.toLocaleDateString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function formatDue(iso: string): {
  text: string;
  overdue: boolean;
  /** Wert wirkt unplausibel (>1 Jahr überfällig) — z.B. Claude hat ein
   *  Datum aus dem Mail-Body falsch geparst (Rechnungsnummer als Jahr o.ä.).
   *  UI zeigt dann das absolute Datum + Hinweis statt "vor 854 Tagen". */
  implausible: boolean;
} {
  const d = new Date(iso);
  const now = Date.now();
  const diffMs = d.getTime() - now;
  const overdue = diffMs < 0;
  const abs = Math.abs(diffMs);
  const diffMin = Math.round(abs / 60000);
  const diffD = Math.round(diffMin / 60 / 24);

  // Schwelle: > 1 Jahr überfällig ODER > 5 Jahre in der Zukunft = wahrscheinlich
  // ein Parse-Fehler von Claude. Wir zeigen das Datum dann absolut.
  const implausible = (overdue && diffD > 365) || (!overdue && diffD > 365 * 5);
  if (implausible) {
    const text = d.toLocaleDateString("de-AT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    return { text, overdue, implausible: true };
  }

  let text: string;
  if (diffMin < 60)
    text = overdue ? `vor ${diffMin} Min` : `in ${diffMin} Min`;
  else {
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) text = overdue ? `vor ${diffH} Std` : `in ${diffH} Std`;
    else {
      if (overdue) text = diffD === 1 ? "gestern fällig" : `vor ${diffD} Tagen`;
      else text = diffD === 1 ? "morgen" : `in ${diffD} Tagen`;
    }
  }
  return { text, overdue, implausible: false };
}

/* ============================================================
 * Avatar — Hash-basierte Farbe + Initials fuer Sender-Bubble
 * ============================================================ */

export const AVATAR_PALETTE = [
  "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
  "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
  "bg-lime-100 text-lime-700 dark:bg-lime-950/40 dark:text-lime-300",
];

export function avatarFor(key: string): { initials: string; cls: string } {
  const clean = key.trim();
  if (!clean) return { initials: "—", cls: AVATAR_PALETTE[0] };
  // Initials: erste 2 Buchstaben des local-parts der mail oder von Name-Parts
  const local = clean.split("@")[0];
  const parts = local.split(/[.\s_-]/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : local.slice(0, 2).toUpperCase();
  let hash = 0;
  for (let i = 0; i < clean.length; i++)
    hash = (hash * 31 + clean.charCodeAt(i)) >>> 0;
  return { initials, cls: AVATAR_PALETTE[hash % AVATAR_PALETTE.length] };
}

/* ============================================================
 * Hero-Project-Link-Helpers
 * ============================================================ */

/** Raeumt Hero-Projekt-Namen auf:
 *  - Splittet bei "|" (pipe), entfernt Dash-only Tokens
 *  - Drop von Suffixen die nur die Projektnummer wiederholen
 *  - Filtert Komma-Listen, behaelt nur sinnvolle Teile */
export function cleanHeroProjectName(
  name: string | null | undefined,
  number: string | null | undefined,
): string | null {
  if (!name) return null;
  const numTail = (number ?? "").replace(/^\D+/, "");
  const parts = name
    .split("|")
    .map((p) => p.trim())
    .map((p) =>
      p
        .split(",")
        .map((x) => x.trim())
        .filter((x) => x && !/^-+$/.test(x))
        .join(", "),
    )
    .filter((p) => {
      if (!p) return false;
      if (/^-+$/.test(p)) return false;
      // Drop suffixe wie "-7189" die nur die Projektnummer wiederholen
      if (numTail && p === `-${numTail}`) return false;
      return true;
    });
  const result = parts.join(" | ").trim();
  if (!result) return null;
  // Wenn nach allem nur noch Sonderzeichen/Zahlen/Dashes uebrig sind -> null
  if (!/[a-zA-ZäöüÄÖÜß]/.test(result)) return null;
  return result;
}

/** Baut einen Hero-Projekt-Deep-Link aus dem URL-Template.
 *  Unterstuetzt alle offiziellen Platzhalter:
 *  {projectId}     → hero_project_id (UUID in unserer DB, von Hero vergeben)
 *  {projectNumber} → hero_project_number (z.B. "PVS-9402")
 *  Damit funktioniert das Template egal welches Format Hero in URLs erwartet. */
export function buildHeroProjectHref(
  template: string | null,
  projectId: string | null | undefined,
  projectNumber: string | null | undefined,
): string | null {
  if (!template) return null;
  const id = projectId ?? "";
  const num = projectNumber ?? "";
  if (!id && !num) return null;
  return template
    .replace("{projectId}", id)
    .replace("{projectNumber}", num);
}
