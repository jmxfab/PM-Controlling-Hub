"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  X,
  Mail,
  ChevronDown,
  Reply,
  Check,
  Clock3,
  CalendarDays,
  CalendarClock,
  AlertTriangle,
  MessageSquare,
  FolderOpen,
  Euro,
  Inbox,
  Search,
  Sparkles,
  Sun,
  Flame,
  ArrowRight,
  Eye,
  EyeOff,
  UserCheck,
  Bell,
  History,
  Star,
  ExternalLink,
  HardHat,
  Briefcase,
  Users2,
} from "lucide-react";
import type { HeizlastProject } from "@/lib/supabase/hero-heizlast-queries";
import type {
  MailTask,
  MailTasksPage,
  MailTaskCounts,
  MailTabFilter,
  Subtask,
} from "@/lib/supabase/mail-tasks-queries";
import dynamic from "next/dynamic";
// HeizlastView (492 LOC) wird nur im Heizlast-Tab gebraucht — lazy laden
// damit der Haupt-Bundle der /aufgaben-Page kleiner ist.
const HeizlastView = dynamic(
  () =>
    import("@/components/heizlast/heizlast-view").then((m) => ({
      default: m.HeizlastView,
    })),
  {
    loading: () => (
      <div className="rounded-2xl border bg-card/40 p-8 text-center text-sm text-muted-foreground">
        Heizlast-Übersicht laedt…
      </div>
    ),
  },
);
import { SubtaskList } from "@/components/aufgaben/subtask-list";
import { DelegateRemindForm } from "@/components/aufgaben/delegate-remind-form";
import { SenderHistoryDialog } from "@/components/aufgaben/sender-history-dialog";
import { ProjectHistoryPanel } from "@/components/aufgaben/project-history-panel";
import { TaskComposer } from "@/components/aufgaben/task-composer";
import { SortableTaskCard } from "@/components/aufgaben/sortable-task-card";
import {
  useTaskRealtime,
  useVisibilityPoll,
} from "@/hooks/use-task-realtime";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";

/** Keine echte Pagination — alles auf einmal laden (bis 500),
 *  einfach scrollen statt Seiten blaettern. */
const PAGE_SIZE = 500;

type StatusFilter = "all" | "open" | "done";
type PrioFilter = "all" | "urgent" | "high" | "medium" | "low";
type AgeFilter = "30" | "90" | "all";

/** Patch-Objekt das AutoHeroMatch nach erfolgreichem Match nach oben gibt. */
type HeroMatchPatch = {
  hero_project_id: string;
  hero_project_number: string | null;
  hero_project_name: string | null;
};

interface Props {
  heizlastProjects: HeizlastProject[];
  heroProjectLinkTemplate: string | null;
  initialAufgaben: MailTasksPage;
  /** Welcher Tab bekommt die initialAufgaben-Daten (default-Tab vom Server). */
  initialTab?: MailTabFilter;
  counts: MailTaskCounts;
}

const PRIORITY_CONFIG: Record<
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

const TAB_META: Record<
  MailTabFilter,
  { label: string; emptyTitle: string; emptyHint: string; icon: typeof Mail }
> = {
  my_day: {
    label: "Mein Tag",
    emptyTitle: "Mein Tag ist leer",
    emptyHint:
      "Klicke das Sonne-Icon auf einer Aufgabe um sie für heute zu kuratieren.",
    icon: Sun,
  },
  kritisch: {
    label: "Kritisch",
    emptyTitle: "Keine kritischen Eskalationen",
    emptyHint: "Sieht ruhig aus — keine Notfälle gerade.",
    icon: AlertTriangle,
  },
  aufgaben: {
    label: "Operativ",
    emptyTitle: "Keine offenen operativen Aufgaben",
    emptyHint:
      "Operative Aufgaben (alles außerhalb PL/GF) erscheinen hier. Sobald neue Mails oder Hero-Erwähnungen reinkommen, landen sie hier.",
    icon: Mail,
  },
  infos: {
    label: "Infos",
    emptyTitle: "Nichts zu lesen",
    emptyHint: "Bestätigungen und Status-Updates landen hier.",
    icon: Sparkles,
  },
  inbox: {
    label: "Inbox",
    emptyTitle: "Inbox leer",
    emptyHint: "Hier landen Mails, bei denen Claude unsicher war.",
    icon: Inbox,
  },
  rechnungen: {
    label: "Bestellungen & Rechnungen",
    emptyTitle: "Keine offenen Bestellungen oder Rechnungen",
    emptyHint:
      "Eingehende Rechnungen, Mahnungen, Gutschriften, Bestellbestätigungen und Lieferscheine erscheinen hier.",
    icon: Euro,
  },
  aufgeschoben: {
    label: "Aufgeschoben",
    emptyTitle: "Nichts aufgeschoben",
    emptyHint:
      "Wenn du bei einer Aufgabe eine Erinnerung setzt, landet sie hier bis sie fällig wird.",
    icon: Clock3,
  },
  pl: {
    label: "Projektleiter",
    emptyTitle: "Keine PL-Aufgaben",
    emptyHint:
      "Aufgaben für den Projektleiter landen hier — Baustellen, Termine, technische Rückfragen, Materialien.",
    icon: HardHat,
  },
  gf: {
    label: "Geschäftsführung",
    emptyTitle: "Keine GF-Aufgaben",
    emptyHint:
      "Angebote, Freigaben, Finanzentscheidungen und Eskalationen die die Geschäftsführung betreffen.",
    icon: Briefcase,
  },
  controlling: {
    label: "Controlling",
    emptyTitle: "Keine delegierten Aufgaben",
    emptyHint: "Hier landen alle Aufgaben die du delegiert hast — solange sie noch nicht erledigt sind.",
    icon: Users2,
  },
};

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "gerade eben";
  if (diffMin < 60) return `vor ${diffMin} Min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24)
    return `vor ${diffH} Std`;
  const diffD = Math.round(diffH / 24);
  if (diffD === 1) return "gestern";
  if (diffD < 7) return `vor ${diffD} Tagen`;
  return d.toLocaleDateString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

/** Keywords die eine Task ins Prio-Panel oben heben. Case-insensitive,
 *  Umlaut-tolerant. Items 4.3 + 4.4 aus Roadmap. */
const PRIO_KEYWORD_PATTERNS = [
  /angebotspr[üu]fung/i,
  /bitte pr[üu]fen/i,
  /\bfreigabe\b/i,
  /auftragsbest[äa]tigung/i,
] as const;

function isPrioTask(t: MailTask): boolean {
  const haystack = `${t.title} ${t.body ?? ""}`;
  return PRIO_KEYWORD_PATTERNS.some((re) => re.test(haystack));
}

type DateBucket = "heute" | "gestern" | "woche" | "aelter";

function bucketOf(iso: string): DateBucket {
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

const BUCKET_LABEL: Record<DateBucket, string> = {
  heute: "Heute",
  gestern: "Gestern",
  woche: "Diese Woche",
  aelter: "Älter",
};

function groupByDate(tasks: MailTask[]): { bucket: DateBucket; tasks: MailTask[] }[] {
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

/** Hash-basierte Farbe fuer Sender-Avatar */
const AVATAR_PALETTE = [
  "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
  "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
  "bg-lime-100 text-lime-700 dark:bg-lime-950/40 dark:text-lime-300",
];

function avatarFor(key: string): { initials: string; cls: string } {
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
  for (let i = 0; i < clean.length; i++) hash = (hash * 31 + clean.charCodeAt(i)) >>> 0;
  return { initials, cls: AVATAR_PALETTE[hash % AVATAR_PALETTE.length] };
}

function formatDue(iso: string): {
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

/**
 * Erkennt ob ein Description-Text als Bullet-Liste formatiert ist und
 * splittet ihn entsprechend. Akzeptiert: "-", "*", "•", "·", "—" sowie
 * "1.", "2)" etc. am Zeilenanfang.
 *
 * Rueckgabe:
 *  - lead: optionaler Einleitungstext vor den Bullets (oder null)
 *  - items: Bullet-Texte (ohne Marker), oder leeres Array wenn kein Listen-Pattern
 */
function parseBullets(text: string): { lead: string | null; items: string[] } {
  if (!text) return { lead: null, items: [] };
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return { lead: null, items: [] };

  const BULLET_RE = /^[-*•·—–]\s+(.+)$/;
  const NUMBERED_RE = /^\d+[.)]\s+(.+)$/;

  const items: string[] = [];
  let lead: string | null = null;
  let bulletStarted = false;

  for (const line of lines) {
    const bm = BULLET_RE.exec(line) ?? NUMBERED_RE.exec(line);
    if (bm) {
      bulletStarted = true;
      items.push(bm[1].trim());
    } else if (!bulletStarted) {
      // Einleitungstext vor erstem Bullet sammeln
      lead = lead ? `${lead} ${line}` : line;
    } else {
      // Fortsetzungszeile eines Bullets (kein Marker) → an letztes Item anhaengen
      if (items.length > 0) {
        items[items.length - 1] = `${items[items.length - 1]} ${line}`;
      }
    }
  }

  // Sinnvoll nur wenn mindestens 2 Bullets
  if (items.length < 2) return { lead: null, items: [] };
  return { lead, items };
}

/**
 * Description-Renderer: zeigt Bullet-Listen als <ul>, sonst Fliesstext.
 * `clamp` blendet bei nicht-expanded Karten auf 2 Zeilen ab.
 */
function DescriptionBody({ text, clamp }: { text: string; clamp?: boolean }) {
  const { lead, items } = parseBullets(text);

  if (items.length === 0) {
    return clamp ? (
      <p className="text-[13px] text-muted-foreground line-clamp-2 leading-relaxed pt-0.5">
        {text}
      </p>
    ) : (
      <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed max-w-3xl text-foreground/90">
        {text}
      </div>
    );
  }

  if (clamp) {
    // Kompakt-Ansicht: nur erste 2 Bullets, Rest als "+N weitere"
    const visible = items.slice(0, 2);
    const rest = items.length - visible.length;
    return (
      <ul className="text-[13px] text-muted-foreground leading-relaxed pt-0.5 space-y-0.5">
        {visible.map((it, i) => (
          <li key={i} className="flex gap-1.5">
            <span className="text-foreground/40 select-none shrink-0">•</span>
            <span className="truncate">{it}</span>
          </li>
        ))}
        {rest > 0 && (
          <li className="text-[11px] text-muted-foreground/70 pl-3">
            +{rest} weitere{rest === 1 ? "r" : ""} Punkt{rest === 1 ? "" : "e"}
          </li>
        )}
      </ul>
    );
  }

  return (
    <div className="space-y-2 max-w-3xl text-[13.5px] leading-relaxed text-foreground/90">
      {lead && <p className="whitespace-pre-wrap">{lead}</p>}
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <span
              aria-hidden
              className="mt-[7px] shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500/70 dark:bg-blue-400/70"
            />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AufgabenView({
  heizlastProjects,
  heroProjectLinkTemplate,
  initialAufgaben,
  initialTab,
  counts: initialCounts,
}: Props) {
  // Counts werden live aktualisiert (Realtime + Polling), Initial vom Server
  const [counts, setCounts] = useState<MailTaskCounts>(initialCounts);
  const defaultTab: MailTabFilter =
    initialTab ?? (initialCounts.kritisch > 0 ? "kritisch" : "aufgaben");

  // Realtime-Subscriber: bei jeder DB-Aenderung an tasks oder task_notes
  // re-fetchen wir die Counts. MailTab subscribed sich separat und
  // invalidiert seinen eigenen Cache.
  const refetchCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/mail-tasks/counts", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as MailTaskCounts;
      setCounts(json);
    } catch {
      // silent — naechstes Polling-Intervall versucht es wieder
    }
  }, []);

  useTaskRealtime({ onChange: refetchCounts });
  useVisibilityPoll(refetchCounts, 60_000);

  // Server-vorgeladene Daten in den globalen Response-Cache schreiben,
  // damit MailTab sie sofort zeigt ohne erstes Client-Fetch.
  // useEffect statt useMemo: React darf useMemo verwerfen, useEffect nicht.
  useEffect(() => {
    if (initialAufgaben.entries.length === 0) return;
    const k = cacheKey(defaultTab, "", "open", "all");
    if (!RESPONSE_CACHE.has(k)) {
      RESPONSE_CACHE.set(k, { data: initialAufgaben, ts: Date.now() });
    }
  }, [defaultTab, initialAufgaben]);

  // BACKGROUND-PREFETCH: Nach idle alle anderen Tabs vorladen.
  // → User klickt nach 1-2 Sek auf irgendeinen Tab = instant aus Cache.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const tabsToPrefetch: Array<{ filter: MailTabFilter; status: StatusFilter }> = [
      { filter: "kritisch", status: "open" },
      { filter: "aufgaben", status: "open" },
      { filter: "infos", status: "open" },
      { filter: "rechnungen", status: "open" },
    ];
    if (counts.inbox > 0) {
      tabsToPrefetch.push({ filter: "inbox", status: "open" });
    }

    async function prefetchOne(filter: MailTabFilter, status: StatusFilter) {
      const k = cacheKey(filter, "", status, "all");
      if (RESPONSE_CACHE.has(k)) return; // schon im Cache
      try {
        const params = new URLSearchParams({
          page: "0",
          filter,
          page_size: String(PAGE_SIZE),
          status,
        });
        const res = await window.fetch(`/api/mail-tasks?${params}`);
        if (!res.ok) return;
        const json = await res.json();
        RESPONSE_CACHE.set(k, {
          data: { entries: json.entries ?? [], total: json.total ?? 0 },
          ts: Date.now(),
        });
      } catch {
        /* silent — Prefetch ist best-effort */
      }
    }

    // Sequenziell um Server nicht zu fluten — alle in parallel waere ueberfordernd
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    };

    let cancelled = false;
    const run = async () => {
      for (const tab of tabsToPrefetch) {
        if (cancelled) return;
        await prefetchOne(tab.filter, tab.status);
      }
    };
    const timer =
      typeof w.requestIdleCallback === "function"
        ? w.requestIdleCallback(run, { timeout: 2000 })
        : (setTimeout(run, 800) as unknown as number);
    return () => {
      cancelled = true;
      if (typeof timer === "number") {
        const cancel = (window as unknown as {
          cancelIdleCallback?: (id: number) => void;
        }).cancelIdleCallback;
        if (cancel) cancel(timer);
        else clearTimeout(timer);
      }
    };
  }, [counts.inbox]);

  return (
    <Tabs
      defaultValue={defaultTab}
      orientation="vertical"
      // MS-To-Do-Style Sidebar-Layout: links Liste der Tabs, rechts Content.
      // Auf Mobile bricht das Grid auf eine einzige Spalte um, Sidebar landet oben.
      className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-3 sm:gap-5 items-start"
    >
      <TabsList
        className="h-auto p-1.5 sm:p-2 bg-muted/40 rounded-xl gap-1 flex md:flex-col md:items-stretch w-full overflow-x-auto md:overflow-visible flex-nowrap md:flex-wrap scrollbar-thin"
      >
        {/* Mein Tag — Microsoft-To-Do-Style "My Day". Manuell kuratierte
         *  Liste der Aufgaben fuer heute. Sonnen-Icon ist das MS-Symbol. */}
        <TabsTrigger
          value="my_day"
          className="group justify-start gap-2 rounded-lg font-semibold text-amber-700 dark:text-amber-300 ring-1 ring-amber-400/40 bg-gradient-to-b from-amber-50 to-amber-100/60 hover:from-amber-100 hover:to-amber-200/70 dark:from-amber-500/10 dark:to-amber-600/5 dark:hover:from-amber-500/15 dark:hover:to-amber-600/10 data-[state=active]:bg-gradient-to-br data-[state=active]:from-amber-400 data-[state=active]:via-orange-500 data-[state=active]:to-amber-600 data-[state=active]:text-white data-[state=active]:ring-amber-500/0 data-[state=active]:shadow-[0_4px_18px_-2px_hsl(35_95%_55%/0.5)] transition-all duration-200"
          title="Mein Tag — manuell kuratierte Liste für heute"
        >
          <Sun
            size={14}
            className="transition-transform group-data-[state=active]:rotate-180 duration-500"
          />
          <span className="flex-1 text-left">Mein Tag</span>
          <CountPill value={counts.my_day} />
        </TabsTrigger>
        <TabsTrigger
          value="kritisch"
          className={
            counts.kritisch > 0
              ? "group relative justify-start gap-2 rounded-lg font-semibold text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/30 bg-gradient-to-b from-rose-50 to-rose-100/70 hover:from-rose-100 hover:to-rose-200/80 dark:from-rose-500/10 dark:to-rose-600/5 dark:hover:from-rose-500/15 dark:hover:to-rose-600/10 data-[state=active]:bg-gradient-to-br data-[state=active]:from-rose-500 data-[state=active]:via-red-600 data-[state=active]:to-rose-700 data-[state=active]:text-white data-[state=active]:ring-rose-500/0 data-[state=active]:shadow-[0_4px_18px_-2px_hsl(0_84%_55%/0.5)] dark:data-[state=active]:shadow-[0_6px_24px_-4px_hsl(0_84%_60%/0.6)] transition-all duration-200"
              : "justify-start gap-2 rounded-lg data-[state=active]:shadow-sm"
          }
        >
          {counts.kritisch > 0 ? (
            <AlertTriangle
              size={14}
              className="drop-shadow-[0_0_4px_hsl(0_84%_55%/0.4)] group-data-[state=active]:drop-shadow-[0_0_6px_rgba(255,255,255,0.4)]"
            />
          ) : (
            <AlertTriangle size={14} className="text-muted-foreground" />
          )}
          <span className="flex-1 text-left">Kritisch</span>
          <CountPill
            value={counts.kritisch}
            highlight={counts.kritisch > 0}
            tone="rose"
          />
          {counts.kritisch > 0 && (
            <span
              aria-hidden
              className="hidden group-data-[state=active]:block absolute inset-0 rounded-lg pointer-events-none ring-1 ring-inset ring-white/30 dark:ring-white/15"
            />
          )}
        </TabsTrigger>
        <TabsTrigger
          value="aufgaben"
          className="justify-start gap-2 rounded-lg data-[state=active]:shadow-sm"
          title="Operative Aufgaben (alles außerhalb PL und GF)"
        >
          <Mail size={14} />
          <span className="flex-1 text-left">Operativ</span>
          <CountPill value={counts.aufgaben} />
        </TabsTrigger>
        <TabsTrigger
          value="infos"
          className="justify-start gap-2 rounded-lg data-[state=active]:shadow-sm"
        >
          <Sparkles size={14} />
          <span className="flex-1 text-left">Infos</span>
          <CountPill value={counts.infos} />
        </TabsTrigger>
        {counts.inbox > 0 && (
          <TabsTrigger
            value="inbox"
            className="justify-start gap-2 rounded-lg data-[state=active]:shadow-sm"
          >
            <Inbox size={14} />
            <span className="flex-1 text-left">Inbox</span>
            <CountPill value={counts.inbox} highlight />
          </TabsTrigger>
        )}
        <TabsTrigger
          value="rechnungen"
          className="justify-start gap-2 rounded-lg data-[state=active]:shadow-sm"
        >
          <Euro size={14} />
          <span className="flex-1 text-left">Rechnungen</span>
          <CountPill value={counts.rechnungen} />
        </TabsTrigger>
        {counts.aufgeschoben > 0 && (
          <TabsTrigger
            value="aufgeschoben"
            className="justify-start gap-2 rounded-lg data-[state=active]:shadow-sm"
          >
            <Clock3 size={14} />
            <span className="flex-1 text-left">Aufgeschoben</span>
            <CountPill value={counts.aufgeschoben} tone="amber" />
          </TabsTrigger>
        )}
        {/* PL-Tab: Aufgaben für den Projektleiter */}
        {counts.pl > 0 && (
          <TabsTrigger
            value="pl"
            className="justify-start gap-2 rounded-lg data-[state=active]:shadow-sm"
          >
            <HardHat size={14} />
            <span className="flex-1 text-left">Projektleiter</span>
            <CountPill value={counts.pl} tone="indigo" />
          </TabsTrigger>
        )}
        {/* GF-Tab: Aufgaben für die Geschäftsführung */}
        {counts.gf > 0 && (
          <TabsTrigger
            value="gf"
            className="justify-start gap-2 rounded-lg data-[state=active]:shadow-sm"
          >
            <Briefcase size={14} />
            <span className="flex-1 text-left">Geschäftsführung</span>
            <CountPill value={counts.gf} tone="violet" />
          </TabsTrigger>
        )}
        {/* Controlling-Tab: delegierte Aufgaben die noch offen sind */}
        {counts.controlling > 0 && (
          <TabsTrigger
            value="controlling"
            className="justify-start gap-2 rounded-lg data-[state=active]:shadow-sm"
          >
            <Users2 size={14} />
            <span className="flex-1 text-left">Controlling</span>
            <CountPill value={counts.controlling} tone="teal" />
          </TabsTrigger>
        )}
        <TabsTrigger
          value="heizlast"
          className="justify-start gap-2 rounded-lg data-[state=active]:shadow-sm"
        >
          <Flame size={14} />
          <span className="flex-1 text-left">Heizlast</span>
          <CountPill value={heizlastProjects.length} />
        </TabsTrigger>
      </TabsList>
      <TabsContent value="my_day">
        <MailTab
          initial={defaultTab === "my_day" ? initialAufgaben : { entries: [], total: 0 }}
          filter="my_day"
          heroProjectLinkTemplate={heroProjectLinkTemplate}
        />
      </TabsContent>
      <TabsContent value="kritisch">
        <MailTab
          initial={defaultTab === "kritisch" ? initialAufgaben : { entries: [], total: 0 }}
          filter="kritisch"
          heroProjectLinkTemplate={heroProjectLinkTemplate}
        />
      </TabsContent>
      <TabsContent value="aufgaben">
        <MailTab
          initial={defaultTab === "aufgaben" ? initialAufgaben : { entries: [], total: 0 }}
          filter="aufgaben"
          heroProjectLinkTemplate={heroProjectLinkTemplate}
        />
      </TabsContent>
      <TabsContent value="infos">
        <MailTab
          initial={defaultTab === "infos" ? initialAufgaben : { entries: [], total: 0 }}
          filter="infos"
          heroProjectLinkTemplate={heroProjectLinkTemplate}
        />
      </TabsContent>
      {counts.inbox > 0 && (
        <TabsContent value="inbox">
          <MailTab
            initial={{ entries: [], total: 0 }}
            filter="inbox"
            heroProjectLinkTemplate={heroProjectLinkTemplate}
          />
        </TabsContent>
      )}
      <TabsContent value="rechnungen">
        <MailTab
          initial={{ entries: [], total: 0 }}
          filter="rechnungen"
          heroProjectLinkTemplate={heroProjectLinkTemplate}
        />
      </TabsContent>
      <TabsContent value="aufgeschoben">
        <MailTab
          initial={{ entries: [], total: 0 }}
          filter="aufgeschoben"
          heroProjectLinkTemplate={heroProjectLinkTemplate}
        />
      </TabsContent>
      {counts.pl > 0 && (
        <TabsContent value="pl">
          <MailTab
            initial={{ entries: [], total: 0 }}
            filter="pl"
            heroProjectLinkTemplate={heroProjectLinkTemplate}
          />
        </TabsContent>
      )}
      {counts.gf > 0 && (
        <TabsContent value="gf">
          <MailTab
            initial={{ entries: [], total: 0 }}
            filter="gf"
            heroProjectLinkTemplate={heroProjectLinkTemplate}
          />
        </TabsContent>
      )}
      {counts.controlling > 0 && (
        <TabsContent value="controlling">
          <MailTab
            initial={{ entries: [], total: 0 }}
            filter="controlling"
            heroProjectLinkTemplate={heroProjectLinkTemplate}
          />
        </TabsContent>
      )}
      <TabsContent value="heizlast">
        <HeizlastView
          projects={heizlastProjects}
          heroProjectLinkTemplate={heroProjectLinkTemplate}
        />
      </TabsContent>
    </Tabs>
  );
}

function CountPill({
  value,
  highlight,
  tone,
}: {
  value: number;
  highlight?: boolean;
  /** Spezial-Variante fuer Kritisch: bei aktivem Tab heller weisser Halo,
   *  bei inaktivem Tab sattes Rose. */
  tone?: "rose" | "amber" | "indigo" | "violet" | "teal";
}) {
  if (!value) return null;
  if (tone === "rose") {
    return (
      <span className="relative text-[10px] tabular-nums font-bold px-1.5 min-w-[1.125rem] h-[1.125rem] inline-flex items-center justify-center rounded-full bg-rose-500/15 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300 ring-1 ring-rose-500/30 group-data-[state=active]:bg-white/25 group-data-[state=active]:text-white group-data-[state=active]:ring-white/30 group-data-[state=active]:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)] transition-colors">
        {value}
      </span>
    );
  }
  if (tone === "amber") {
    return (
      <span className="relative text-[10px] tabular-nums font-bold px-1.5 min-w-[1.125rem] h-[1.125rem] inline-flex items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300 ring-1 ring-amber-500/30 group-data-[state=active]:bg-white/25 group-data-[state=active]:text-white group-data-[state=active]:ring-white/30 transition-colors">
        {value}
      </span>
    );
  }
  if (tone === "indigo") {
    return (
      <span className="relative text-[10px] tabular-nums font-bold px-1.5 min-w-[1.125rem] h-[1.125rem] inline-flex items-center justify-center rounded-full bg-indigo-500/15 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300 ring-1 ring-indigo-500/30 group-data-[state=active]:bg-white/25 group-data-[state=active]:text-white group-data-[state=active]:ring-white/30 transition-colors">
        {value}
      </span>
    );
  }
  if (tone === "violet") {
    return (
      <span className="relative text-[10px] tabular-nums font-bold px-1.5 min-w-[1.125rem] h-[1.125rem] inline-flex items-center justify-center rounded-full bg-violet-500/15 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300 ring-1 ring-violet-500/30 group-data-[state=active]:bg-white/25 group-data-[state=active]:text-white group-data-[state=active]:ring-white/30 transition-colors">
        {value}
      </span>
    );
  }
  if (tone === "teal") {
    return (
      <span className="relative text-[10px] tabular-nums font-bold px-1.5 min-w-[1.125rem] h-[1.125rem] inline-flex items-center justify-center rounded-full bg-teal-500/15 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300 ring-1 ring-teal-500/30 group-data-[state=active]:bg-white/25 group-data-[state=active]:text-white group-data-[state=active]:ring-white/30 transition-colors">
        {value}
      </span>
    );
  }
  return (
    <span
      className={`text-[10px] tabular-nums font-medium px-1.5 py-0.5 rounded-full ${
        highlight
          ? "bg-white/20 text-current"
          : "bg-muted-foreground/15 text-muted-foreground"
      }`}
    >
      {value}
    </span>
  );
}

/** Filter-Layout pro Tab — welche Filter machen Sinn fuer welchen Bucket? */
const TAB_FILTERS: Record<
  MailTabFilter,
  { status: boolean; priority: boolean; defaultStatus: StatusFilter }
> = {
  my_day:       { status: false, priority: false, defaultStatus: "open" },
  kritisch:     { status: false, priority: false, defaultStatus: "open" },
  aufgaben:     { status: true,  priority: true,  defaultStatus: "open" },
  infos:        { status: true,  priority: false, defaultStatus: "open" },
  inbox:        { status: true,  priority: false, defaultStatus: "open" },
  rechnungen:   { status: true,  priority: false, defaultStatus: "open" },
  aufgeschoben: { status: false, priority: false, defaultStatus: "open" },
  pl:           { status: true,  priority: true,  defaultStatus: "open" },
  gf:           { status: true,  priority: true,  defaultStatus: "open" },
  controlling:  { status: true,  priority: false, defaultStatus: "open" },
};

/**
 * Globaler Modul-Cache fuer /api/mail-tasks Responses.
 * Persists across MailTab-mounts (Tabs unmount inactive content by default).
 * → Tab-Wechsel ist instant statt 500ms+ Roundtrip.
 *
 * TTL 30s damit der Cache nicht zu alt wird. Background-Refetch bei Cache-Hit
 * sorgt fuer stale-while-revalidate Verhalten.
 */
type CacheEntry = { data: MailTasksPage; ts: number };
const RESPONSE_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000;

function cacheKey(
  filter: MailTabFilter,
  search: string,
  status: StatusFilter,
  prio: PrioFilter,
): string {
  return `${filter}|${search}|${status}|${prio}`;
}

function invalidateCacheForFilter(filter: MailTabFilter) {
  for (const k of RESPONSE_CACHE.keys()) {
    if (k.startsWith(`${filter}|`)) RESPONSE_CACHE.delete(k);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter-Persistenz: pro Tab werden Status/Prio/Age im localStorage gespeichert.
// SSR-safe: localStorage existiert nur im Browser.
// ─────────────────────────────────────────────────────────────────────────────
type PersistedFilters = {
  status: StatusFilter;
  prio: PrioFilter;
  age: AgeFilter;
};

function persistKey(filter: MailTabFilter): string {
  return `aufgaben-filters:${filter}`;
}

function readPersistedFilters(
  filter: MailTabFilter,
  defaultStatus: StatusFilter,
): PersistedFilters {
  const fallback: PersistedFilters = {
    status: defaultStatus,
    prio: "all",
    age: "30",
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(persistKey(filter));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PersistedFilters>;
    return {
      status:
        parsed.status === "all" ||
        parsed.status === "open" ||
        parsed.status === "done"
          ? parsed.status
          : defaultStatus,
      prio:
        parsed.prio === "all" ||
        parsed.prio === "urgent" ||
        parsed.prio === "high" ||
        parsed.prio === "medium" ||
        parsed.prio === "low"
          ? parsed.prio
          : "all",
      age:
        parsed.age === "30" || parsed.age === "90" || parsed.age === "all"
          ? parsed.age
          : "30",
    };
  } catch {
    return fallback;
  }
}

function writePersistedFilters(
  filter: MailTabFilter,
  patch: Partial<PersistedFilters>,
) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(persistKey(filter));
    const current = raw ? (JSON.parse(raw) as Partial<PersistedFilters>) : {};
    window.localStorage.setItem(
      persistKey(filter),
      JSON.stringify({ ...current, ...patch }),
    );
  } catch {
    // silent — Persistenz ist nice-to-have
  }
}

function MailTab({
  initial,
  filter,
  heroProjectLinkTemplate,
}: {
  initial: MailTasksPage;
  filter: MailTabFilter;
  heroProjectLinkTemplate: string | null;
}) {
  const meta = TAB_META[filter];
  const tabFilters = TAB_FILTERS[filter];
  // URL-Param ?search=... + ?focusTask=... unterstuetzen — wird beim Mount UND
  // bei Navigation dazwischen in den Filter uebernommen. So funktionieren
  // Cross-Links vom Logbuch / Sender-History.
  const urlSearchParams = useSearchParams();
  const urlSearchTerm = urlSearchParams.get("search") ?? "";
  const urlFocusTask = urlSearchParams.get("focusTask");
  const [search, setSearch] = useState(urlSearchTerm);
  useEffect(() => {
    if (urlSearchTerm !== "" && urlSearchTerm !== search) {
      setSearch(urlSearchTerm);
    }
    // Bewusst NICHT auf search reagieren — wenn User selber tippt soll URL
    // nicht ihn ueberschreiben.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSearchTerm]);
  // Filter-Persistenz pro Tab in localStorage. Beim Tab-Wechsel UND Reload
  // werden die letzten Filter-Werte wieder geladen. Key: `aufgaben-filters:${filter}`.
  const persistedFilters = readPersistedFilters(filter, tabFilters.defaultStatus);
  const [statusFilter, setStatusFilterRaw] = useState<StatusFilter>(
    persistedFilters.status,
  );
  const [prioFilter, setPrioFilterRaw] = useState<PrioFilter>(persistedFilters.prio);
  // Altersfilter (Default 30 Tage) — sorgt dafuer dass alte Karteileichen
  // standardmaessig nicht stoeren. User kann auf 90 oder 'Alle' umschalten.
  const [ageFilter, setAgeFilterRaw] = useState<AgeFilter>(persistedFilters.age);
  // Bei Tab-Wechsel: Filter aus localStorage neu laden
  useEffect(() => {
    const next = readPersistedFilters(filter, tabFilters.defaultStatus);
    setStatusFilterRaw(next.status);
    setPrioFilterRaw(next.prio);
    setAgeFilterRaw(next.age);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);
  // Setter mit Auto-Persist — schreiben in localStorage und State
  const setStatusFilter = useCallback(
    (v: StatusFilter) => {
      setStatusFilterRaw(v);
      writePersistedFilters(filter, { status: v });
    },
    [filter],
  );
  const setPrioFilter = useCallback(
    (v: PrioFilter) => {
      setPrioFilterRaw(v);
      writePersistedFilters(filter, { prio: v });
    },
    [filter],
  );
  const setAgeFilter = useCallback(
    (v: AgeFilter) => {
      setAgeFilterRaw(v);
      writePersistedFilters(filter, { age: v });
    },
    [filter],
  );
  const [data, setData] = useState<MailTasksPage>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  // focusTask aus URL: Karte direkt expanden + in den Viewport scrollen.
  // Wird nach dem ersten Treffer geleert (zurueck zur normalen Bedienung).
  useEffect(() => {
    if (!urlFocusTask) return;
    setExpanded(urlFocusTask);
    // Kurz warten bis DOM da ist, dann scrollIntoView
    const t = setTimeout(() => {
      const el = document.querySelector(
        `[data-task-id="${CSS.escape(urlFocusTask)}"]`,
      );
      if (el && "scrollIntoView" in el) {
        (el as HTMLElement).scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }, 300);
    return () => clearTimeout(t);
  }, [urlFocusTask]);
  /** Wenn gesetzt -> SenderHistoryDialog ist offen mit dieser Mail-Adresse. */
  const [historyEmail, setHistoryEmail] = useState<string | null>(null);
  /** "Erinnerung in Zukunft" = Snooze: Karte versteckt bis Reminder faellig.
   *  Toggle macht sie wieder sichtbar zum manuellen Eingriff. */
  const [showSnoozed, setShowSnoozed] = useState(false);
  /** Bumpt bei jeder Task-Mutation — triggert Re-Fetch des Vorschläge-Panels
   *  und anderer abhaengiger Sub-Panels, ohne auf Realtime-Debounce zu warten. */
  const [mutationTick, setMutationTick] = useState(0);
  /** IDs die wir gerade lokal entfernt haben (z.B. Sun-Klick raus aus Mein Tag).
   *  Werden aus jeder kommenden Server-Response gefiltert bis 10s rum sind.
   *  Verhindert das "Karte verschwindet, kommt wieder"-Flackern wegen
   *  Supabase Read-Replica-Lag. */
  const recentlyRemovedRef = useRef<Map<string, number>>(new Map());
  const markRecentlyRemoved = useCallback((taskId: string) => {
    recentlyRemovedRef.current.set(taskId, Date.now());
  }, []);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Trennen in sichtbar / snoozed: Tasks deren remind_at > jetzt sind
  // werden ausgeblendet. Recompute jede Minute via Date.now() Tick reicht
  // — bei Page-Reload sowieso. Memoiziert auf data.entries.
  const { visibleEntries, snoozedCount, prioEntries } = useMemo(() => {
    const nowMs = Date.now();
    const visible: MailTask[] = [];
    const prio: MailTask[] = [];
    let snoozed = 0;
    for (const t of data.entries) {
      // 1) Erledigte raus — Item 3.1 (sofortiges Ausblenden nach Mark-Done)
      // Nur ausblenden wenn:
      // - Task ist "done" UND
      // - Filter ist auf "open" (zeige nur offene) ODER Filter ist auf "all" (zeige nur unvollständige mit Snooze-Logic)
      // Wenn Filter auf "done" ist, zeige nur "done"-Tasks. Wenn Filter auf "all" ist...
      // actually, "all" sollte alles zeigen UNABHÄNGIG von Status
      if (t.status === "done" && statusFilter === "open") continue;
      // 2) Snooze: Tasks mit remind_at > jetzt werden versteckt.
      //    Im "Aufgeschoben"-Tab zeigen wir sie IMMER (der Tab ist genau dafuer da).
      if (t.status !== "done" && t.remind_at && filter !== "aufgeschoben") {
        const remindMs = new Date(t.remind_at).getTime();
        if (Number.isFinite(remindMs) && remindMs > nowMs) {
          snoozed += 1;
          if (!showSnoozed) continue;
        }
      }
      // 3) Prio-Panel-Trigger: Items 4.3 + 4.4
      //    Keywords im Titel ODER Body -> aus regulaerer Liste loesen + oben
      //    hervorgehoben anzeigen. Nur auf aufgaben/kritisch-Tab sinnvoll.
      if (isPrioTask(t) && filter !== "infos") {
        prio.push(t);
        continue;
      }
      visible.push(t);
    }
    return {
      visibleEntries: visible,
      snoozedCount: snoozed,
      prioEntries: prio,
    };
  }, [data.entries, showSnoozed, statusFilter, filter]);

  const fetchData = useCallback(
    async (
      q: string,
      p: number,
      st: StatusFilter,
      pr: PrioFilter,
      ag: AgeFilter = "30",
    ) => {
      const key = cacheKey(filter, q, st, pr) + `|age=${ag}`;
      const cached = RESPONSE_CACHE.get(key);
      const now = Date.now();

      // Cache-Hit: sofort anzeigen, im Hintergrund refetchen wenn alt
      if (cached) {
        setData(cached.data);
        const isStale = now - cached.ts > CACHE_TTL_MS;
        if (!isStale) {
          // Frisch genug — kein Refetch noetig
          setLoading(false);
          setError(null);
          return;
        }
        // stale-while-revalidate: zeige sofort cached, refetch silent
      } else {
        // Loading-Skeleton nur zeigen wenn entries komplett leer.
        // Falls schon was sichtbar ist (optimistic stub, ...), kein Flicker.
        setData((cur) => {
          if (cur.entries.length === 0) setLoading(true);
          return cur;
        });
      }
      setError(null);

      try {
        const params = new URLSearchParams({
          page: String(p),
          filter,
          page_size: String(PAGE_SIZE),
        });
        if (q) params.set("search", q);
        if (st !== "all") params.set("status", st);
        if (pr !== "all") params.set("priority", pr);
        if (ag !== "30") params.set("age", ag); // 30 = default, weglassen
        const res = await window.fetch(`/api/mail-tasks?${params}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(
            toErrorString(body.error) ||
              `Fehler ${res.status} beim Laden der Mail-Aufgaben`,
          );
          return;
        }
        const json = await res.json();
        const rawEntries = (json.entries ?? []) as MailTask[];
        // Recently-removed-Filter: Tasks die wir SOEBEN lokal entfernt haben
        // (z.B. via Sun-Klick) NICHT zurueck reinmappen, auch wenn Server-
        // Response sie noch enthaelt (Replica-Lag). 10s-Fenster.
        const nowMs = Date.now();
        const recentlyRemoved = recentlyRemovedRef.current;
        // Expired Eintraege wegputzen
        for (const [id, ts] of recentlyRemoved) {
          if (nowMs - ts > 10_000) recentlyRemoved.delete(id);
        }
        const filteredEntries = rawEntries.filter(
          (t) => !recentlyRemoved.has(t.id),
        );
        const page: MailTasksPage = {
          entries: filteredEntries,
          total: Math.max(0, (json.total ?? 0) - (rawEntries.length - filteredEntries.length)),
        };
        RESPONSE_CACHE.set(key, { data: page, ts: Date.now() });
        // Stub-Preserving-Merge: wenn lokal soeben ein Task adden wurde
        // (optimistic-insert, z.B. via Vorschlag-+-Button), aber der Server
        // ihn noch nicht zurueckgibt (Replica-Lag oder Race), behalten wir
        // den lokalen Stub fuer max 10s — sonst flackert die Karte
        // (verschwindet kurz, taucht beim naechsten Refresh wieder auf).
        setData((prev) => {
          const serverIds = new Set(page.entries.map((t) => t.id));
          const TEN_SECONDS = 10_000;
          const nowMs = Date.now();
          const recentlyAdded = prev.entries.filter((t) => {
            if (serverIds.has(t.id)) return false;
            // Nur Stubs mit frischem in_my_day_at gelten als "recently added"
            if (!t.in_my_day_at) return false;
            const addedMs = new Date(t.in_my_day_at).getTime();
            return Number.isFinite(addedMs) && nowMs - addedMs < TEN_SECONDS;
          });
          if (recentlyAdded.length === 0) return page;
          return {
            entries: [...recentlyAdded, ...page.entries],
            total: page.total + recentlyAdded.length,
          };
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unbekannter Netzwerk-Fehler");
      } finally {
        setLoading(false);
      }
    },
    [filter],
  );

  // Single source of truth fuer Fetches: debounce auf Filter-Aenderungen.
  // (Vorher: zwei useEffects feuerten beide gleichzeitig → 2 Requests beim Mount.)
  // Beim ersten Mount mit search="" und initial.entries=[] feuert das hier
  // auch — initial.entries dient nur als sofort-sichtbares Vorab-Rendering.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchData(search, 0, statusFilter, prioFilter, ageFilter);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, statusFilter, prioFilter, ageFilter, fetchData]);

  // Realtime: wenn die Aufgaben-Tabelle veraendert wurde (n8n hat klassifiziert,
  // andere User haben was geandert) -> Cache invalidieren + sofort refetchen.
  const realtimeRefetch = useCallback(() => {
    invalidateCacheForFilter(filter);
    fetchData(search, 0, statusFilter, prioFilter, ageFilter);
  }, [filter, search, statusFilter, prioFilter, ageFilter, fetchData]);

  useTaskRealtime({ onChange: realtimeRefetch });

  // Polling-Fallback bei Tab-Focus + 90s-Intervall (vermeidet Stale-Daten
  // falls Realtime mal nicht durchkommt — z.B. nach Sleep).
  useVisibilityPoll(realtimeRefetch, 90_000);

  async function patchTask(
    taskId: string,
    update: {
      status?: MailTask["status"];
      due_date?: string | null;
      mail_category?: MailTask["mail_category"];
      priority?: MailTask["priority"];
      remind_at?: string | null;
      in_my_day?: boolean;
      sort_order?: number;
      is_important?: boolean;
    },
    /** Wenn true: Task aus aktueller Liste entfernen (z.B. nach Kategorie-Wechsel) */
    removeFromList = false,
  ) {
    setBusyTaskId(taskId);
    try {
      const res = await window.fetch(`/api/mail-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(
          toErrorString(body.error) ||
            `Fehler ${res.status} beim Aktualisieren`,
        );
        return;
      }
      if (removeFromList) {
        markRecentlyRemoved(taskId);
      }
      setData((prev) => ({
        ...prev,
        entries: removeFromList
          ? prev.entries.filter((t) => t.id !== taskId)
          : prev.entries.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    status: update.status ?? t.status,
                    due_date:
                      update.due_date !== undefined ? update.due_date : t.due_date,
                    mail_category: update.mail_category ?? t.mail_category,
                    priority: update.priority ?? t.priority,
                    remind_at:
                      update.remind_at !== undefined
                        ? update.remind_at
                        : t.remind_at,
                    in_my_day_at:
                      update.in_my_day !== undefined
                        ? update.in_my_day
                          ? new Date().toISOString()
                          : null
                        : t.in_my_day_at,
                    sort_order:
                      update.sort_order !== undefined
                        ? update.sort_order
                        : t.sort_order,
                    is_important:
                      update.is_important !== undefined
                        ? update.is_important
                        : t.is_important,
                  }
                : t,
            ),
        total: removeFromList ? Math.max(0, prev.total - 1) : prev.total,
      }));
      // Cache fuer diesen Filter (und ggf. Ziel-Filter bei category change)
      // invalidieren, damit der naechste Tab-Wechsel frische Daten holt.
      invalidateCacheForFilter(filter);
      // 'Mein Tag' Cache invalidieren wenn in_my_day toggled wurde,
      // damit der Tab-Wechsel das aktuelle Bild zeigt.
      if (update.in_my_day !== undefined) {
        invalidateCacheForFilter("my_day");
      }
      if (update.mail_category) {
        // Task wechselt Tab -> auch Ziel-Tab-Cache leeren
        if (update.mail_category === "aufgabe" || update.mail_category === "dringend") {
          invalidateCacheForFilter("aufgaben");
        } else if (update.mail_category === "info") {
          invalidateCacheForFilter("infos");
        } else if (update.mail_category === "kritisch") {
          invalidateCacheForFilter("kritisch");
        } else if (update.mail_category === "rechnung" || update.mail_category === "bestellung") {
          invalidateCacheForFilter("rechnungen");
        } else if (update.mail_category === "inbox") {
          invalidateCacheForFilter("inbox");
        } else if (update.mail_category === "pl_aufgabe") {
          invalidateCacheForFilter("pl");
        } else if (update.mail_category === "gf_aufgabe") {
          invalidateCacheForFilter("gf");
        }
      }
      // Mutation-Tick bumpen -> Vorschläge-Panel und andere Sub-Panels
      // re-fetchen sofort (ohne auf den Realtime-Debounce zu warten).
      setMutationTick((n) => n + 1);
      // Bei in_my_day-Aenderung: explizit den aktuellen Filter neu laden,
      // damit die neu hinzugefuegte Task im Mein-Tag-Tab sofort erscheint
      // (oder die entfernte sofort verschwindet) — ohne 400ms Realtime-Lag.
      if (update.in_my_day !== undefined) {
        fetchData(search, 0, statusFilter, prioFilter, ageFilter);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Netzwerk-Fehler");
    } finally {
      setBusyTaskId(null);
    }
  }

  /** Prioritaet eines Tasks aendern. Bleibt im aktuellen Tab,
   *  aber sortiert sich um (sort_order respektiert is_important + Prio). */
  function changePriority(task: MailTask, priority: MailTask["priority"]) {
    if (task.source === "hero") return Promise.resolve();
    return patchTask(task.id, { priority });
  }

  /** Kategorie eines Tasks aendern (z.B. von 'aufgabe' zu 'kritisch').
   *  Task verschwindet aus dem aktuellen Tab wenn neue Kategorie da
   *  nicht hingehoert — daher removeFromList=true. */
  function changeCategory(task: MailTask, category: MailTask["mail_category"]) {
    if (task.source === "hero" || !category) return Promise.resolve();
    // Map: welche Kategorien gehoeren in welchen Tab? Wenn Task in eine
    // andere Kategorie wechselt -> aus aktueller Liste entfernen.
    const tabCategories: Partial<Record<MailTabFilter, string[]>> = {
      my_day: [],
      kritisch: ["kritisch"],
      aufgaben: ["aufgabe", "dringend"],
      infos: ["info"],
      inbox: ["inbox"],
      rechnungen: ["rechnung", "bestellung"],
      pl: ["pl_aufgabe"],
      gf: ["gf_aufgabe"],
      controlling: [], // kategorie-uebergreifend — assigned_to-Filter
    };
    const leavingCurrentTab =
      filter !== "my_day" && !tabCategories[filter]?.includes(category);
    return patchTask(task.id, { mail_category: category }, leavingCurrentTab);
  }

  /** Verschiebt eine Info in den Aufgaben-Tab (mail_category = 'aufgabe'). */
  function moveToAufgaben(task: MailTask) {
    return patchTask(
      task.id,
      { mail_category: "aufgabe", priority: task.priority ?? "medium" },
      true, // aus aktueller Liste entfernen
    );
  }

  /** Markiert eine Info als gelesen. Bei Hero-Items wird ein lokales
   *  Override gesetzt (Hero selbst bleibt unangetastet), bei Mail-Tasks
   *  status = done. Auf Infos-Tab Default "open" -> Item verschwindet. */
  async function markAsRead(task: MailTask) {
    if (task.source === "hero") {
      return markHeroAsRead(task);
    }
    return patchTask(task.id, { status: "done" }, statusFilter === "open");
  }

  /** Hero-Read-Override setzen (eigene Tabelle hero_read_overrides) */
  async function markHeroAsRead(task: MailTask) {
    return toggleHeroRead(task, "mark");
  }

  /** Hero-Read-Override entfernen — Item ist wieder "ungelesen" */
  async function markHeroAsUnread(task: MailTask) {
    return toggleHeroRead(task, "unmark");
  }

  async function toggleHeroRead(task: MailTask, action: "mark" | "unmark") {
    setBusyTaskId(task.id);
    try {
      const heroIdRaw = task.id.startsWith("hero-") ? task.id.slice(5) : task.id;
      const res = await window.fetch("/api/hero-mark-read", {
        method: action === "mark" ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hero_id: heroIdRaw }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(
          toErrorString(body.error) ||
            `Fehler ${res.status} beim Aktualisieren`,
        );
        return;
      }

      // Wenn der aktuelle Filter das umgeschaltete Item nicht mehr zeigen
      // wuerde, entferne es aus der Liste; sonst nur Status updaten.
      const willStillMatch =
        statusFilter === "all" ||
        (statusFilter === "open" && action === "unmark") ||
        (statusFilter === "done" && action === "mark");

      setData((prev) => ({
        ...prev,
        entries: willStillMatch
          ? prev.entries.map((t) =>
              t.id === task.id
                ? {
                    ...t,
                    status: action === "mark" ? "done" : "open",
                    hero_is_read: action === "mark",
                  }
                : t,
            )
          : prev.entries.filter((t) => t.id !== task.id),
        total: willStillMatch ? prev.total : Math.max(0, prev.total - 1),
      }));
      invalidateCacheForFilter(filter);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Netzwerk-Fehler");
    } finally {
      setBusyTaskId(null);
    }
  }

  function markDone(task: MailTask) {
    if (task.source === "hero") {
      // Hero-Items: gelesen/ungelesen toggeln via Override-Tabelle
      return task.status === "done"
        ? markHeroAsUnread(task)
        : markHeroAsRead(task);
    }
    const markingDone = task.status !== "done";
    // removeFromList=true wenn wir "erledigt" setzen UND der Tab nur offene
    // Items zeigt — dann verschwindet die Karte sofort ohne Page-Reload.
    return patchTask(
      task.id,
      { status: markingDone ? "done" : "open" },
      markingDone && statusFilter === "open",
    );
  }

  function toggleMyDay(task: MailTask) {
    const adding = !task.in_my_day_at;
    // Sofort-Feedback fuer User: Karte verschwindet aus der aktuellen Liste,
    // sobald sie zu Mein Tag wandert (oder umgekehrt). Sonst klickt der User
    // auf die Sonne und sieht "nichts passieren".
    //  - non-my_day Tab + Adding   -> Karte verschwindet hier (taucht in Mein Tag auf)
    //  - my_day Tab + Removing     -> Karte verschwindet hier (taucht wo anders auf)
    const removeFromCurrentList =
      (adding && filter !== "my_day") || (!adding && filter === "my_day");
    return patchTask(task.id, { in_my_day: adding }, removeFromCurrentList);
  }

  /** Wichtig-Star toggeln. Optimistisches Update + PATCH.
   *  Task wird durch die Sortierung dann oben in seinem Bucket gepinnt. */
  function toggleImportant(task: MailTask) {
    return patchTask(task.id, { is_important: !task.is_important });
  }

  /** Generischer Re-Order callback fuer DnD. Wird sowohl im Mein-Tag-Tab
   *  (flache Liste) als auch in den Date-Buckets der anderen Tabs benutzt.
   *  Schritt 1: lokal sofort umsortieren (optimistic UI).
   *  Schritt 2: Parallel-PATCH alle Tasks mit neuen sort_order Werten
   *  (Inkremente von 100, damit spaeter Insert dazwischen leicht moeglich).
   *
   *  Hinweis: sort_order wird LOKAL nur in den uebergebenen Tasks (=eine
   *  Bucket/Liste) gesetzt — global gibt es keine sort_order-Kollision weil
   *  innerhalb eines Tabs gruppiert wird und Buckets disjunkt sind.
   */
  async function reorderTasks(reorderedTasks: MailTask[]) {
    // Lokal: setze sort_order auf (index+1)*100 und replace die Listen-Reihenfolge.
    const updated = reorderedTasks.map((t, i) => ({
      ...t,
      sort_order: (i + 1) * 100,
    }));
    setData((prev) => {
      const remaining = prev.entries.filter(
        (e) => !updated.find((u) => u.id === e.id),
      );
      return {
        ...prev,
        entries: [...updated, ...remaining],
      };
    });
    invalidateCacheForFilter(filter);

    // Server: parallel PATCH. Wir warten nicht im Render-Block (fire-and-forget),
    // aber loggen Fehler.
    await Promise.all(
      updated.map((t) =>
        window
          .fetch(`/api/mail-tasks/${t.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sort_order: t.sort_order }),
          })
          .catch((e) => {
            console.warn("reorder PATCH failed", t.id, e);
          }),
      ),
    );
  }

  function snoozeBy(task: MailTask, ms: number) {
    const target = new Date(Date.now() + ms).toISOString();
    // Setzt sowohl remind_at (damit der neue Snooze-Filter greift und die Karte
    // sofort verschwindet) als auch due_date + status=waiting (preserved alten
    // Verhalten — Faelligkeit + Status-Pille). Wenn die Karte dann morgen
    // wieder auftaucht, ist sie automatisch in "Heute" (frisch eingegangen
    // wirkt so, Reihenfolge ueber created_at sortiert).
    return patchTask(task.id, {
      remind_at: target,
      due_date: target,
      status: "waiting",
    });
  }

  function buildMailto(task: MailTask): string | null {
    if (!task.sender) return null;
    return `mailto:${task.sender}?subject=${encodeURIComponent("Re: " + task.title)}`;
  }

  /**
   * Baut den stabilen Desktop-Deep-Link.
   * Strategie (best -> fallback):
   * 1. source_email_entry_id (restImmutableEntryId via Graph translateExchangeIds) — stabil + Outlook-kompatibel
   * 2. ItemID aus webLink — funktioniert oft, ist aber die unstable RestId
   * 3. source_email_id roh — letzter Ausweg
   */
  /** Subtask-Update lokal in den State spiegeln (ohne Server-Roundtrip,
   *  der Subtask-Endpoint hat schon gespeichert). Cache fuer den
   *  aktuellen Filter invalidieren damit naechster Tab-Switch fresh ist. */
  function updateTaskSubtasks(taskId: string, subtasks: Subtask[]) {
    setData((prev) => ({
      ...prev,
      entries: prev.entries.map((t) =>
        t.id === taskId ? { ...t, subtasks } : t,
      ),
    }));
    invalidateCacheForFilter(filter);
  }

  /** Delegate/Reminder-Update — PATCH wurde schon vom Form gemacht. */
  function updateTaskDelegation(
    taskId: string,
    next: { assigned_to: string | null; remind_at: string | null },
  ) {
    setData((prev) => ({
      ...prev,
      entries: prev.entries.map((t) =>
        t.id === taskId ? { ...t, ...next } : t,
      ),
    }));
    invalidateCacheForFilter(filter);
  }

  /** Hero-Projekt-Verknuepfung lokal aktualisieren, nachdem AutoHeroMatch
   *  einen Treffer gefunden und in die DB gespeichert hat.
   *  Ohne diesen Update bliebe hero_project_id im lokalen State null und
   *  der "In Hero eintragen"-Button wuerde nie erscheinen. */
  function updateTaskHeroLink(taskId: string, patch: HeroMatchPatch) {
    setData((prev) => ({
      ...prev,
      entries: prev.entries.map((t) =>
        t.id === taskId ? { ...t, ...patch } : t,
      ),
    }));
    // Cache invalidieren: naechster Tab-Wechsel holt frische Daten.
    invalidateCacheForFilter(filter);
  }

  function buildOutlookDesktopLink(task: MailTask): string | null {
    if (task.source_email_entry_id) {
      return `ms-outlook://emails/open?ItemID=${encodeURIComponent(task.source_email_entry_id)}`;
    }
    if (task.source_email_web_link) {
      try {
        const url = new URL(task.source_email_web_link);
        const itemId = url.searchParams.get("ItemID");
        if (itemId)
          return `ms-outlook://emails/open?ItemID=${encodeURIComponent(itemId)}`;
      } catch {
        /* fall through */
      }
    }
    if (task.source_email_id) {
      return `ms-outlook://emails/open?ItemID=${encodeURIComponent(task.source_email_id)}`;
    }
    return null;
  }

  const hasFilters =
    search ||
    statusFilter !== tabFilters.defaultStatus ||
    prioFilter !== "all";

  /** Optimistic: Vorschlag in Mein Tag uebernehmen. Inseriert die Task sofort
   *  lokal in die My-Day-Liste (statt auf den Server-Roundtrip zu warten),
   *  PATCH laeuft im Hintergrund. Damit ist die UI-Reaktion <50ms statt 1-3s. */
  async function addSuggestionToMyDay(suggestion: {
    id: string;
    title: string;
    description: string | null;
    mail_category: string | null;
    priority: string | null;
    due_date: string | null;
    created_at: string;
    is_important: boolean;
  }) {
    // 1) Lokal: sofort einen Stub in entries einfuegen (oben in der Liste).
    //    fetchData danach im Hintergrund laedt die echten Felder nach (Sender,
    //    source_email_*, subtasks, etc.). Bis dahin sieht der User schon was.
    const stub: MailTask = {
      id: suggestion.id,
      source: "mail",
      title: suggestion.title,
      description: suggestion.description,
      status: "open",
      priority:
        (suggestion.priority as MailTask["priority"] | null) ?? null,
      due_date: suggestion.due_date,
      created_at: suggestion.created_at,
      source_email_id: null,
      source_email_entry_id: null,
      source_email_web_link: null,
      source_email_is_read: null,
      source_email_conversation_id: null,
      thread_message_count: 1,
      thread_last_message_at: null,
      mail_category:
        (suggestion.mail_category as MailTask["mail_category"] | null) ?? null,
      sender: null,
      body: suggestion.description,
      subtasks: [],
      assigned_to: null,
      remind_at: null,
      is_user_created: false,
      in_my_day_at: new Date().toISOString(),
      sort_order: 0,
      is_important: suggestion.is_important,
    };
    setData((prev) =>
      // Wenn schon irgendwie drin (Race), nichts tun. Sonst oben anfuegen.
      prev.entries.find((t) => t.id === suggestion.id)
        ? prev
        : { ...prev, entries: [stub, ...prev.entries], total: prev.total + 1 },
    );
    return patchTask(suggestion.id, { in_my_day: true });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DnD-Setup: einziger DndContext fuer den ganzen MailTab. Behandelt sowohl
  // Sortable-Reorder innerhalb eines Buckets als auch Drop auf den 'Mein Tag'-
  // Hover-Banner. Der Banner taucht waehrend des Drags auf — wenn der User
  // die Karte da rein zieht, wird sie zu Mein Tag hinzugefuegt.
  // ─────────────────────────────────────────────────────────────────────────
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;

    // Fall 1: Drop auf Mein-Tag-Drop-Zone
    if (over.id === "drop:my-day") {
      const task = data.entries.find((t) => t.id === active.id);
      if (task && !task.in_my_day_at) {
        toggleMyDay(task);
      }
      return;
    }

    // Fall 2: Sortable-Reorder innerhalb desselben Buckets
    if (active.id === over.id) return;
    // Finde welche Liste (visibleEntries oder ein Date-Bucket) beide
    // IDs enthaelt — nur dann sortieren.
    if (filter === "my_day") {
      const oldIndex = visibleEntries.findIndex((t) => t.id === active.id);
      const newIndex = visibleEntries.findIndex((t) => t.id === over.id);
      if (oldIndex >= 0 && newIndex >= 0) {
        reorderTasks(arrayMove(visibleEntries, oldIndex, newIndex));
      }
      return;
    }
    for (const group of groupByDate(visibleEntries)) {
      const oldIndex = group.tasks.findIndex((t) => t.id === active.id);
      const newIndex = group.tasks.findIndex((t) => t.id === over.id);
      if (oldIndex >= 0 && newIndex >= 0) {
        reorderTasks(arrayMove(group.tasks, oldIndex, newIndex));
        return;
      }
    }
  }

  return (
    <DndContext
      sensors={dndSensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDragId(null)}
    >
    <div className="space-y-4">
      {/* Bulk-Done-Banner fuer Infos: User kann mit 1 Klick alle alten Infos
          archivieren. Wird nur im Infos-Tab gezeigt und nur wenn 'Alle'-
          Altersfilter aktiv ist (= User sieht aktuell die alten Karteileichen). */}
      {filter === "infos" && (
        <BulkCleanupBanner
          categories={["info"]}
          onCleaned={() => {
            invalidateCacheForFilter(filter);
            fetchData(search, 0, statusFilter, prioFilter, ageFilter);
          }}
        />
      )}
      <FilterBar
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        prioFilter={prioFilter}
        setPrioFilter={setPrioFilter}
        ageFilter={ageFilter}
        setAgeFilter={setAgeFilter}
        hasFilters={!!hasFilters || ageFilter !== "30"}
        defaultStatus={tabFilters.defaultStatus}
        loading={loading}
        showStatus={tabFilters.status}
        showPriority={tabFilters.priority}
        tab={filter}
      />

      {/* Prio-Panel oben — Item 4.3+4.4. Loest Tasks mit Keywords
       *  (Angebotsprüfung, Freigabe, Auftragsbestätigung, Bitte prüfen)
       *  aus der regulären Liste und zeigt sie hervorgehoben. */}
      {prioEntries.length > 0 && !loading && (
        <PrioPanel
          tasks={prioEntries}
          expanded={expanded}
          busyTaskId={busyTaskId}
          onToggle={setExpanded}
          onMarkDone={markDone}
          onMarkAsRead={markAsRead}
          onMoveToAufgaben={moveToAufgaben}
          onSnooze={snoozeBy}
          onSubtasksChange={updateTaskSubtasks}
          onDelegationChange={updateTaskDelegation}
          onSenderClick={setHistoryEmail}
          onToggleMyDay={toggleMyDay}
          onToggleImportant={toggleImportant}
          onChangePriority={changePriority}
          onChangeCategory={changeCategory}
          buildMailto={buildMailto}
          buildOutlookDesktopLink={buildOutlookDesktopLink}
          heroProjectLinkTemplate={heroProjectLinkTemplate}
          tab={filter}
          onHeroMatched={updateTaskHeroLink}
        />
      )}

      {error ? (
        <ErrorBox
          error={error}
          onRetry={() => fetchData(search, 0, statusFilter, prioFilter, ageFilter)}
        />
      ) : loading && data.entries.length === 0 ? (
        <SkeletonList />
      ) : visibleEntries.length === 0 && snoozedCount === 0 && prioEntries.length === 0 ? (
        <EmptyState
          icon={meta.icon}
          title={meta.emptyTitle}
          hint={
            search
              ? "Suche liefert keine Treffer. Versuche andere Begriffe."
              : meta.emptyHint
          }
        />
      ) : (
        <div className="space-y-6">
          {visibleEntries.length === 0 && snoozedCount > 0 && !showSnoozed && (
            <EmptyState
              icon={search ? Search : Bell}
              title={search ? "Keine Treffer" : "Alles aufgeschoben"}
              hint={
                search
                  ? "Deine Suche liefert in dieser Liste keine Treffer. Klick unten um auch aufgeschobene Aufgaben einzubeziehen."
                  : `${snoozedCount} Aufgabe${
                      snoozedCount === 1 ? "" : "n"
                    } warten auf ihre Erinnerung. Klick auf den Button unten um sie trotzdem zu sehen.`
              }
            />
          )}
          {/* Im Mein-Tag Tab: flache Liste mit DnD. In anderen Tabs: nach Datum gruppiert. */}
          {/* DnD in JEDEM Tab — Mein-Tag flach, andere Tabs pro Date-Bucket.
              So koennen Aufgaben innerhalb ihrer Gruppe frei sortiert werden
              (MS-To-Do-Style). Ausserdem: in nicht-my_day Tabs erscheint
              waehrend des Drags eine "Zu Mein Tag"-Drop-Zone oben — User
              kann die Karte einfach dort ablegen statt Sun-Icon zu klicken. */}
          {filter === "my_day" ? (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
              <SortableBucket
                tasks={visibleEntries}
                renderCard={(t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    tab={filter}
                    expanded={expanded === t.id}
                    busy={busyTaskId === t.id}
                    onToggle={() =>
                      setExpanded((cur) => (cur === t.id ? null : t.id))
                    }
                    onMarkDone={() => markDone(t)}
                    onMarkAsRead={() => markAsRead(t)}
                    onMoveToAufgaben={() => moveToAufgaben(t)}
                    onSnooze={(ms) => snoozeBy(t, ms)}
                    onSubtasksChange={(next) => updateTaskSubtasks(t.id, next)}
                    onDelegationChange={(next) => updateTaskDelegation(t.id, next)}
                    onSenderClick={(email) => setHistoryEmail(email)}
                    onToggleMyDay={() => toggleMyDay(t)}
                    onToggleImportant={() => toggleImportant(t)}
                    onChangePriority={(p) => changePriority(t, p)}
                    onChangeCategory={(c) => changeCategory(t, c)}
                    buildMailto={buildMailto}
                    buildOutlookDesktopLink={buildOutlookDesktopLink}
                    heroProjectLinkTemplate={heroProjectLinkTemplate}
                    onHeroMatched={(patch) => updateTaskHeroLink(t.id, patch)}
                  />
                )}
              />
              {/* MS-To-Do-Style Vorschläge-Panel rechts.
                  Zeigt offene Tasks die noch NICHT in Mein Tag sind.
                  Refresh-Trigger: mutationTick (bumpt bei jeder Mutation)
                  + visibleEntries-IDs (Fallback bei Realtime-Sync). */}
              <MyDaySuggestionsPanel
                /* refreshKey: nur Mutationen + welche IDs in Mein Tag sind,
                   nicht ihre Reihenfolge (DnD-Sort triggert sonst Refetch).
                   IDs sortiert verkettet -> stabil bei Reorder. */
                refreshKey={`${mutationTick}|${[...visibleEntries.map((t) => t.id)].sort().join(",")}`}
                onAdd={addSuggestionToMyDay}
                busyTaskId={busyTaskId}
              />
            </div>
          ) : (
          groupByDate(visibleEntries).map((group) => (
            <section key={group.bucket} className="space-y-2">
              <div className="flex items-baseline gap-2 px-1">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {BUCKET_LABEL[group.bucket]}
                </h2>
                <span className="text-[11px] tabular-nums text-muted-foreground/60">
                  {group.tasks.length}
                </span>
                <div className="flex-1 h-px bg-border/60 ml-2" />
              </div>
              <SortableBucket
                tasks={group.tasks}
                renderCard={(t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    tab={filter}
                    expanded={expanded === t.id}
                    busy={busyTaskId === t.id}
                    onToggle={() =>
                      setExpanded((cur) => (cur === t.id ? null : t.id))
                    }
                    onMarkDone={() => markDone(t)}
                    onMarkAsRead={() => markAsRead(t)}
                    onMoveToAufgaben={() => moveToAufgaben(t)}
                    onSnooze={(ms) => snoozeBy(t, ms)}
                    onSubtasksChange={(next) => updateTaskSubtasks(t.id, next)}
                    onDelegationChange={(next) => updateTaskDelegation(t.id, next)}
                    onSenderClick={(email) => setHistoryEmail(email)}
                    onToggleMyDay={() => toggleMyDay(t)}
                    onToggleImportant={() => toggleImportant(t)}
                    onChangePriority={(p) => changePriority(t, p)}
                    onChangeCategory={(c) => changeCategory(t, c)}
                    buildMailto={buildMailto}
                    buildOutlookDesktopLink={buildOutlookDesktopLink}
                    heroProjectLinkTemplate={heroProjectLinkTemplate}
                    onHeroMatched={(patch) => updateTaskHeroLink(t.id, patch)}
                  />
                )}
              />
            </section>
          ))
          )}
          {snoozedCount > 0 && filter !== "aufgeschoben" && (
            <div className="flex justify-center pt-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowSnoozed((s) => !s)}
                className="h-8 gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                title={
                  showSnoozed
                    ? "Aufgaben mit zukünftiger Erinnerung wieder verstecken"
                    : "Aufgaben mit zukünftiger Erinnerung trotzdem zeigen"
                }
              >
                <Bell size={12} />
                {showSnoozed
                  ? `${snoozedCount} aufgeschoben${snoozedCount === 1 ? "" : "e"} wieder verstecken`
                  : `${snoozedCount} aufgeschoben${snoozedCount === 1 ? "" : "e"} anzeigen`}
              </Button>
            </div>
          )}
          {data.total > 0 && (
            <p className="text-[11px] text-muted-foreground text-center pt-2">
              {visibleEntries.length} von {data.total.toLocaleString("de-AT")} Einträgen
              {snoozedCount > 0 && !showSnoozed
                ? ` · ${snoozedCount} bis zur Erinnerung versteckt`
                : ""}
              {data.entries.length < data.total ? " — verfeinere die Suche um mehr zu sehen" : ""}
            </p>
          )}
        </div>
      )}
      {/* Kunden-History: zeigt alle Tasks dieses Absenders der letzten 30/90/365 Tage. */}
      <SenderHistoryDialog
        email={historyEmail}
        open={historyEmail !== null}
        onOpenChange={(open) => {
          if (!open) setHistoryEmail(null);
        }}
      />
    </div>
    {/* Drop-Zone fuer 'Zu Mein Tag' — sichtbar waehrend ein Drag laeuft,
        UND wir nicht schon im my_day-Tab sind (sonst sinnlos). Position
        fixed unten rechts, damit die Karte beim Drag freie Bahn hat. */}
    {activeDragId && filter !== "my_day" && (
      <div className="fixed bottom-6 right-6 z-50 max-w-sm">
        <MyDayDropZone visible={true} />
      </div>
    )}
    </DndContext>
  );
}

/* ---------------- Filter Bar ---------------- */

/** Defensive: rendert auch Objects als String — verhindert "[object Object]" im UI */
function toErrorString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.error === "string") return obj.error;
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

function FilterBar({
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  prioFilter,
  setPrioFilter,
  ageFilter,
  setAgeFilter,
  hasFilters,
  defaultStatus,
  loading,
  showStatus,
  showPriority,
  tab,
}: {
  search: string;
  setSearch: (v: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (v: StatusFilter) => void;
  prioFilter: PrioFilter;
  setPrioFilter: (v: PrioFilter) => void;
  ageFilter: AgeFilter;
  setAgeFilter: (v: AgeFilter) => void;
  hasFilters: boolean;
  defaultStatus: StatusFilter;
  loading: boolean;
  showStatus: boolean;
  showPriority: boolean;
  tab: MailTabFilter;
}) {
  // Bei Infos heisst "open" -> "Ungelesen", "done" -> "Gelesen"
  const statusLabels: Record<StatusFilter, string> =
    tab === "infos"
      ? { all: "Alle", open: "Ungelesen", done: "Gelesen" }
      : tab === "rechnungen"
        ? { all: "Alle", open: "Offen", done: "Bezahlt / Erledigt" }
        : { all: "Alle", open: "Offen", done: "Erledigt" };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card/40 px-2 py-2 sm:px-3">
      <div className="relative w-full sm:w-auto">
        <Search
          size={14}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none"
        />
        <Input
          placeholder="Suche…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-56 h-8 pl-8 text-sm"
        />
      </div>

      {showStatus && (
        <>
          <div className="h-5 w-px bg-border" />
          <PillGroup
            label="Status"
            value={statusFilter}
            options={[
              { value: "all", label: statusLabels.all },
              { value: "open", label: statusLabels.open },
              { value: "done", label: statusLabels.done },
            ]}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
          />
        </>
      )}

      {showPriority && (
        <>
          <div className="h-5 w-px bg-border" />
          <PillGroup
            label="Prio"
            value={prioFilter}
            options={[
              { value: "all", label: "Alle" },
              { value: "urgent", label: "Dringend", dot: "bg-red-500" },
              { value: "high", label: "Hoch", dot: "bg-orange-500" },
              { value: "medium", label: "Mittel", dot: "bg-amber-500" },
              { value: "low", label: "Niedrig", dot: "bg-slate-400" },
            ]}
            onChange={(v) => setPrioFilter(v as PrioFilter)}
          />
        </>
      )}

      {/* Altersfilter — Default 30 Tage versteckt alte Karteileichen.
          User kann auf 90 oder Alle umschalten wenn er was Altes sucht. */}
      {tab !== "my_day" && (
        <>
          <div className="h-5 w-px bg-border" />
          <PillGroup
            label="Alter"
            value={ageFilter}
            options={[
              { value: "30", label: "30 Tage" },
              { value: "90", label: "90 Tage" },
              { value: "all", label: "Alle" },
            ]}
            onChange={(v) => setAgeFilter(v as AgeFilter)}
          />
        </>
      )}

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-muted-foreground ml-auto"
          onClick={() => {
            setSearch("");
            setStatusFilter(defaultStatus);
            setPrioFilter("all");
            setAgeFilter("30");
          }}
        >
          <X size={13} /> Reset
        </Button>
      )}
      {loading && (
        <span className="text-xs text-muted-foreground animate-pulse ml-auto">
          Lädt…
        </span>
      )}
    </div>
  );
}

function PillGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; dot?: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 text-xs">
      <span className="text-muted-foreground mr-1">{label}</span>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium transition-colors ${
              active
                ? "bg-foreground text-background"
                : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {opt.dot && (
              <span
                className={`inline-block w-2 h-2 rounded-full ${opt.dot}`}
              />
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Task Card ---------------- */

function TaskCard({
  task,
  tab,
  expanded,
  busy,
  onToggle,
  onMarkDone,
  onMarkAsRead,
  onMoveToAufgaben,
  onSnooze,
  onSubtasksChange,
  onDelegationChange,
  onSenderClick,
  onToggleMyDay,
  onToggleImportant,
  onChangePriority,
  onChangeCategory,
  buildMailto,
  buildOutlookDesktopLink,
  heroProjectLinkTemplate,
  onHeroMatched,
}: {
  task: MailTask;
  tab: MailTabFilter;
  expanded: boolean;
  busy: boolean;
  onToggle: () => void;
  onMarkDone: () => void;
  onMarkAsRead: () => void;
  onMoveToAufgaben: () => void;
  onSnooze: (ms: number) => void;
  onSubtasksChange: (next: Subtask[]) => void;
  onDelegationChange: (next: {
    assigned_to: string | null;
    remind_at: string | null;
  }) => void;
  onSenderClick: (email: string) => void;
  onToggleMyDay: () => void;
  onToggleImportant: () => void;
  onChangePriority: (p: MailTask["priority"]) => void;
  onChangeCategory: (c: MailTask["mail_category"]) => void;
  buildMailto: (task: MailTask) => string | null;
  buildOutlookDesktopLink: (task: MailTask) => string | null;
  heroProjectLinkTemplate: string | null;
  /** Callback wenn AutoHeroMatch ein Projekt gefunden hat — updated lokalen State sofort. */
  onHeroMatched?: (patch: HeroMatchPatch) => void;
}) {
  const t = task;
  const prio = t.priority ? PRIORITY_CONFIG[t.priority] : null;
  const due = t.due_date ? formatDue(t.due_date) : null;
  const isDone = t.status === "done";
  const isWaiting = t.status === "waiting";
  const mailto = buildMailto(t);
  const desktopLink = useMemo(
    () => buildOutlookDesktopLink(t),
    [t, buildOutlookDesktopLink],
  );

  const avatarKey =
    t.source === "hero"
      ? t.hero_project_number || t.hero_project_name || "Hero"
      : t.sender || "manuell";
  const avatar = avatarFor(avatarKey);

  return (
    <div
      data-task-id={t.id}
      className={`group relative overflow-hidden rounded-xl border bg-card transition-all duration-200 ${
        isDone ? "opacity-60" : ""
      } ${
        expanded
          ? "shadow-lg ring-1 ring-foreground/10 scale-[1.005]"
          : "hover:shadow-md hover:-translate-y-0.5 hover:border-foreground/10"
      }`}
    >
      {/* Priority left bar */}
      {prio && (
        <span
          className={`absolute left-0 top-0 bottom-0 w-1 ${prio.bar}`}
          aria-hidden
        />
      )}

      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left pl-3 pr-3 py-3 sm:pl-5 sm:pr-4 sm:py-4 flex items-start gap-2.5 sm:gap-3.5"
      >
        {/* Avatar */}
        <div
          className={`shrink-0 w-9 h-9 rounded-full grid place-items-center text-[11px] font-semibold ${avatar.cls} ${
            t.source === "hero" ? "ring-2 ring-purple-200/60 dark:ring-purple-900/40" : ""
          }`}
          title={avatarKey}
        >
          {t.source === "hero" ? <MessageSquare size={14} /> : avatar.initials}
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Header line: title + datum */}
          <div className={`flex ${expanded ? "items-start" : "items-baseline"} justify-between gap-3`}>
            <h3
              className={`text-[15px] font-semibold leading-snug ${expanded ? "" : "truncate"} ${
                isDone ? "line-through" : ""
              }`}
            >
              {t.title}
            </h3>
            {/* Hero-Projekt-Pille im Header — sichtbar collapsed UND expanded,
             *  damit der User in der Liste sofort sieht welche Karten Hero-verknuepft sind. */}
            {t.hero_project_id && t.hero_project_number && (() => {
              const href = buildHeroProjectHref(
                heroProjectLinkTemplate,
                t.hero_project_id,
                t.hero_project_number,
              );
              const inner = (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="font-mono">{t.hero_project_number}</span>
                  <ExternalLink size={9} className="opacity-60" />
                </>
              );
              const cls = "shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors";
              return href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title={`Hero-Projekt ${t.hero_project_number} öffnen`}
                  className={cls}
                >
                  {inner}
                </a>
              ) : (
                <span className={cls}>{inner}</span>
              );
            })()}
            <div className="flex flex-col items-end gap-1 shrink-0">
              {/* Kompakte Schnell-Aktionen — nur im expanded Zustand, direkt oben rechts */}
              {expanded && !isDone && (
                <div
                  className="flex items-center gap-1 -mt-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onMarkDone(); }}
                    className="inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-0.5 rounded-md border border-emerald-300/60 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50 transition-colors"
                    title="Aufgabe als erledigt markieren"
                  >
                    <Check size={10} /> Erledigt
                  </button>
                  {t.source !== "hero" && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onSnooze(3 * 60 * 60 * 1000); }}
                        className="inline-flex items-center gap-1 text-[10.5px] px-1.5 py-0.5 rounded-md border border-border/50 bg-background/50 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
                        title="3 Stunden zurückstellen"
                      >
                        <Clock3 size={10} /> +3 Std
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onSnooze(24 * 60 * 60 * 1000); }}
                        className="inline-flex items-center gap-1 text-[10.5px] px-1.5 py-0.5 rounded-md border border-border/50 bg-background/50 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
                        title="Auf morgen verschieben"
                      >
                        <CalendarDays size={10} /> Morgen
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onSnooze(7 * 24 * 60 * 60 * 1000); }}
                        className="inline-flex items-center gap-1 text-[10.5px] px-1.5 py-0.5 rounded-md border border-border/50 bg-background/50 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
                        title="Eine Woche zurückstellen"
                      >
                        <CalendarClock size={10} /> +1W
                      </button>
                    </>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2">
              {/* Wichtig-Star (Microsoft-To-Do-Style).
               *  Pinnt Task oben in der Liste + Visual-Highlight. Nur fuer
               *  mail-source Tasks (Hero ist read-only). */}
              {t.source === "mail" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleImportant();
                  }}
                  title={
                    t.is_important
                      ? "Wichtig-Markierung entfernen"
                      : "Als wichtig markieren"
                  }
                  className={`grid place-items-center w-6 h-6 rounded-md transition-all ${
                    t.is_important
                      ? "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                      : "text-muted-foreground/40 hover:text-amber-500 hover:bg-muted/60 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                  }`}
                  aria-label={
                    t.is_important ? "Nicht mehr wichtig" : "Wichtig markieren"
                  }
                >
                  <Star
                    size={14}
                    className={t.is_important ? "fill-amber-400" : ""}
                  />
                </button>
              )}
              {/* Sun-Toggle (Microsoft-To-Do-Style 'Mein Tag').
               *  Nur fuer echte mail-source Tasks (Hero-Items sind in unserer
               *  DB nicht persistent, kein in_my_day_at moeglich). */}
              {t.source === "mail" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleMyDay();
                  }}
                  title={
                    t.in_my_day_at
                      ? "Aus 'Mein Tag' entfernen"
                      : "Zu 'Mein Tag' hinzufügen"
                  }
                  className={`grid place-items-center w-6 h-6 rounded-md transition-all ${
                    t.in_my_day_at
                      ? "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                      : "text-muted-foreground/40 hover:text-amber-500 hover:bg-muted/60 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                  }`}
                  aria-label={
                    t.in_my_day_at
                      ? "Aus Mein Tag entfernen"
                      : "Zu Mein Tag hinzufügen"
                  }
                >
                  <Sun
                    size={14}
                    className={t.in_my_day_at ? "fill-amber-400/60" : ""}
                  />
                </button>
              )}
              <span
                className="text-[11px] tabular-nums text-muted-foreground whitespace-nowrap"
                title={`Eingegangen ${new Date(t.created_at).toLocaleString("de-AT", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}`}
              >
                {formatRelative(t.created_at)}
              </span>
              </div>{/* end inner flex items-center gap-2 */}
            </div>{/* end flex flex-col */}
          </div>{/* end header row */}

          {/* Sender / project line */}
          <SourceInfo task={t} onSenderClick={onSenderClick} />

          {/* Body preview — bullets werden als Liste gerendert wenn vorhanden */}
          {t.body && !expanded && <DescriptionBody text={t.body} clamp />}

          {/* Meta row: prio + due + status */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {/* Prio-Badge ist KLICKBAR fuer mail-source Tasks — Popover-Menu
                aendert die Priorität direkt (kein Expand noetig). Hero-Items
                sind read-only, dann bleibt's ein normales Span. */}
            {prio && t.source === "mail" ? (
              <PrioPickerInline
                currentPriority={t.priority}
                onChange={onChangePriority}
              />
            ) : prio ? (
              <span
                className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full ${prio.badge}`}
              >
                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${prio.dot}`} />
                {prio.label}
              </span>
            ) : t.source === "mail" ? (
              // Auch wenn keine Prio gesetzt: User kann eine vergeben.
              <PrioPickerInline
                currentPriority={null}
                onChange={onChangePriority}
              />
            ) : null}
            {due && (
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  due.implausible
                    ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-900/50"
                    : due.overdue
                      ? "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-300"
                      : isWaiting
                        ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300"
                        : "bg-muted text-muted-foreground"
                }`}
                title={
                  due.implausible
                    ? `Fälligkeit von Claude geschätzt: ${due.text} — wirkt unplausibel (>1 Jahr abweichend). Bitte prüfen.`
                    : `Fälligkeitsdatum der Aufgabe`
                }
              >
                <CalendarClock size={10} />
                {due.implausible ? `Fällig ${due.text}?` : due.text}
              </span>
            )}
            {isDone && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 ring-1 ring-green-200 dark:bg-green-950/40 dark:text-green-300">
                <Check size={10} /> erledigt
              </span>
            )}
            {t.status === "controlling" && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-200 dark:bg-fuchsia-950/40 dark:text-fuchsia-300"
                title="Delegiert / zur Kontrolle — wird nachverfolgt"
              >
                ✓ Controlling
              </span>
            )}
            {t.status === "waiting" && !isDone && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                title="Wartet auf Antwort (vom Kunden oder Snooze)"
              >
                <Clock3 size={10} /> wartet
              </span>
            )}
            {t.source === "hero" && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 ring-1 ring-purple-200 dark:bg-purple-950/40 dark:text-purple-300">
                Hero
              </span>
            )}
            {/* Mail-Thread-Counter: wenn aus der gleichen Konversation mehrere
             *  Mails reinkamen, wird nicht 5x ein neuer Task angelegt — der
             *  Workflow inkrementiert nur den Counter. */}
            {t.source === "mail" && t.thread_message_count > 1 && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300"
                title={
                  t.thread_last_message_at
                    ? `${t.thread_message_count} Mails in dieser Konversation · letzte: ${new Date(
                        t.thread_last_message_at,
                      ).toLocaleString("de-AT", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`
                    : `${t.thread_message_count} Mails in dieser Konversation`
                }
              >
                <Mail size={10} /> {t.thread_message_count} Mails
              </span>
            )}
            {/* Outlook-Read-Status: zeigt ob Domenic die Mail schon in Outlook
             *  geoeffnet hat. Synct alle 10 Min vom Sync-Workflow. */}
            {t.source === "mail" && t.source_email_is_read === true && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                title="In Outlook bereits geoeffnet (Stand: max 10 Min alt)"
              >
                <Eye size={10} /> In Outlook gelesen
              </span>
            )}
            {t.source === "mail" &&
              t.source_email_is_read === false &&
              t.source_email_id && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300"
                  title="Noch nicht in Outlook geoeffnet"
                >
                  <EyeOff size={10} /> Ungelesen
                </span>
              )}
            {tab !== "infos" && t.subtasks.length > 0 && (() => {
              const done = t.subtasks.filter((s) => s.done).length;
              const all = t.subtasks.length;
              const allDone = done === all;
              return (
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ring-1 ${
                    allDone
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300"
                  }`}
                  title={`${done} von ${all} Schritten erledigt`}
                >
                  ✓ {done}/{all}
                </span>
              );
            })()}
            {t.assigned_to && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300"
                title={`Delegiert an ${t.assigned_to}`}
              >
                <UserCheck size={10} /> {t.assigned_to}
              </span>
            )}
            {t.remind_at && (() => {
              const remDate = new Date(t.remind_at);
              const isFuture = remDate.getTime() > Date.now();
              return (
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ring-1 ${
                    isFuture
                      ? "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300"
                      : "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                  }`}
                  title={`Erinnerung: ${remDate.toLocaleString("de-AT")}`}
                >
                  <Bell size={10} /> {isFuture ? formatRelative(t.remind_at) : "fällig"}
                </span>
              );
            })()}
            {t.is_user_created && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-foreground/5 text-muted-foreground ring-1 ring-border"
                title="Manuell angelegt"
              >
                Manuell
              </span>
            )}
          </div>
        </div>

        <ChevronDown
          size={18}
          className={`text-muted-foreground/50 mt-1 shrink-0 transition-transform duration-200 ${
            expanded ? "rotate-0" : "-rotate-90"
          }`}
        />
      </button>

      {/* Expand-Container — schwere Sub-Komponenten (SubtaskList, Composer
       *  etc) werden NUR gemountet wenn expanded=true. Spart bei einer Liste
       *  mit 200 Karten ~600 unnoetige Component-Mounts beim Initial-Render. */}
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          {expanded && (
          <div className="border-t bg-gradient-to-b from-muted/30 to-muted/10 px-3 py-3 sm:px-5 sm:py-4 space-y-3 sm:space-y-4">
            {/* Schnell-Edit: Priorität + Kategorie. Nur fuer mail-source-Tasks,
                Hero-Items sind read-only. */}
            {t.source === "mail" && (
              <TaskQuickEditBar
                task={t}
                onChangePriority={onChangePriority}
                onChangeCategory={onChangeCategory}
              />
            )}
            {t.body && <DescriptionBody text={t.body} />}
            {/* Auto-Hero-Match: bei Mail-Tasks ohne hero_project_id triggern
             *  wir den Match-Endpoint automatisch beim ersten Expand. Wenn
             *  #NNNN im Titel/Body steht, ist's nach 200ms verlinkt. */}
            {t.source === "mail" && !t.hero_project_id && (
              <AutoHeroMatch
                taskId={t.id}
                expanded={expanded}
                heroProjectLinkTemplate={heroProjectLinkTemplate}
                onMatched={onHeroMatched}
                previouslyAttempted={Boolean(t.hero_match_attempted_at)}
              />
            )}
            {/* Hero-Projekt-Badge fuer bereits gespeicherte Verknuepfung — klickbar */}
            {t.hero_project_id && t.hero_project_number && (() => {
              const href = buildHeroProjectHref(
                heroProjectLinkTemplate,
                t.hero_project_id,
                t.hero_project_number,
              );
              const clean = cleanHeroProjectName(t.hero_project_name, t.hero_project_number);
              const label = clean
                ? `${t.hero_project_number} — ${clean}`
                : t.hero_project_number;
              return href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-300 hover:underline decoration-dotted underline-offset-2 w-fit"
                  title={`Hero-Projekt ${t.hero_project_number} öffnen`}
                >
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  Hero-Projekt:{" "}
                  <span className="font-mono font-semibold">{label}</span>
                  <ExternalLink size={11} className="opacity-60" />
                </a>
              ) : (
                <div className="inline-flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Hero-Projekt: <span className="font-mono font-semibold">{label}</span>
                </div>
              );
            })()}
            {/* Projektverlauf: laedt Logbuch + KI-Analyse auf Klick (lazy).
             *  Ersetzt den alten ProjectActivityStrip (der auto-lud). */}
            {t.hero_project_id && (
              <ProjectHistoryPanel
                taskId={t.id}
                projectNumber={t.hero_project_number ?? null}
                projectName={t.hero_project_name ?? null}
              />
            )}
            {/* Subtask-Checkliste — nur fuer handlungs-relevante Tabs.
             *  NICHT bei Infos (reine Lese-Items, keine Action) und nicht
             *  bei Hero-Items (read-only). */}
            {t.source === "mail" && tab !== "infos" && (
              <SubtaskList
                taskId={t.id}
                initialSubtasks={t.subtasks}
                onSubtasksChange={onSubtasksChange}
              />
            )}
            {/* Delegieren + Erinnerung — nur fuer Mail-Tasks, nicht Hero. */}
            {t.source === "mail" && tab !== "infos" && (
              <DelegateRemindForm
                taskId={t.id}
                currentAssignedTo={t.assigned_to}
                currentRemindAt={t.remind_at}
                onUpdated={onDelegationChange}
                taskTitle={t.title}
                taskBody={t.body ?? null}
                senderEmail={t.sender ?? null}
                heroProjectId={t.hero_project_id ?? null}
              />
            )}
            {/* Composer: Antwort tippen / KI-Entwurf / Notiz speichern.
             *  - Mail-Task: KI-Antwort + Outlook-Reply + Notiz + Zwischenablage
             *  - Hero-Task: KI-Logbuch-Eintrag + In-Hero-Oeffnen + Notiz + Zwischenablage
             *    (Direct-Send ins Hero-Logbuch ist Item 1.2, blocked auf Hero-API) */}
            {tab !== "infos" && (
              <TaskComposer
                taskId={t.id}
                source={t.source}
                mailto={mailto}
                heroProjectHref={
                  t.hero_project_id && heroProjectLinkTemplate
                    ? heroProjectLinkTemplate.replace(
                        "{projectId}",
                        t.hero_project_id,
                      )
                    : null
                }
                heroProjectLinked={Boolean(t.hero_project_id)}
                taskTitle={t.title}
                onActionCompleted={onMarkDone}
              />
            )}
            <ActionButtons
              task={t}
              tab={tab}
              isDone={isDone}
              busy={busy}
              mailto={mailto}
              desktopLink={desktopLink}
              onMarkDone={onMarkDone}
              onMarkAsRead={onMarkAsRead}
              onMoveToAufgaben={onMoveToAufgaben}
              onSnooze={onSnooze}
            />
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SourceInfo({
  task,
  onSenderClick,
}: {
  task: MailTask;
  onSenderClick?: (email: string) => void;
}) {
  if (task.source === "hero") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <MessageSquare size={11} className="text-purple-500 shrink-0" />
        <span className="truncate max-w-[160px] sm:max-w-[260px]">
          {task.hero_project_number
            ? (() => {
                const clean = cleanHeroProjectName(
                  task.hero_project_name,
                  task.hero_project_number,
                );
                return clean
                  ? `${task.hero_project_number} · ${clean}`
                  : task.hero_project_number;
              })()
            : "Hero"}
        </span>
      </span>
    );
  }
  if (task.sender) {
    // Sender ist klickbar -> oeffnet Verlauf-Dialog (Kunden-History).
    // Wir stoppen Bubbling damit nicht die Karte ein-/aufgeklappt wird.
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (onSenderClick && task.sender) onSenderClick(task.sender);
        }}
        title={`Verlauf aller Aufgaben von ${task.sender}`}
        className="group inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        <Mail
          size={11}
          className="text-blue-500 shrink-0 group-hover:scale-110 transition-transform"
        />
        <span className="truncate max-w-[160px] sm:max-w-[260px] group-hover:underline decoration-dotted underline-offset-2">
          {task.sender}
        </span>
        <History
          size={10}
          className="shrink-0 opacity-0 group-hover:opacity-70 -translate-x-1 group-hover:translate-x-0 transition-all"
        />
      </button>
    );
  }
  return (
    <span className="text-[11px] text-muted-foreground italic">manuell</span>
  );
}

function ActionButtons({
  task,
  tab,
  isDone,
  busy,
  mailto,
  desktopLink,
  onMarkDone,
  onMarkAsRead,
  onMoveToAufgaben,
  onSnooze,
}: {
  task: MailTask;
  tab: MailTabFilter;
  isDone: boolean;
  busy: boolean;
  mailto: string | null;
  desktopLink: string | null;
  onMarkDone: () => void;
  onMarkAsRead: () => void;
  onMoveToAufgaben: () => void;
  onSnooze: (ms: number) => void;
}) {
  if (task.source === "hero") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm" variant="default" className="h-8 gap-1.5">
          <a
            href="https://app.hero-software.de"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            <FolderOpen size={13} />
            In Hero öffnen
          </a>
        </Button>
        <Button
          size="sm"
          variant={isDone ? "outline" : "default"}
          className="h-8 gap-1.5"
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            onMarkDone();
          }}
          title={
            isDone
              ? "Setzt diese Hero-Notification wieder auf ungelesen"
              : "Markiert diese Hero-Notification lokal als gelesen (Hero selbst bleibt unangetastet)"
          }
        >
          <Eye size={13} />
          {isDone ? "Wieder ungelesen" : "Gelesen"}
        </Button>
        {isDone && (
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
            <Check size={11} /> gelesen
          </span>
        )}
      </div>
    );
  }

  const isInfos = tab === "infos";
  const isRechnungen = tab === "rechnungen";
  const showSnooze = !isInfos; // Snooze macht bei Infos keinen Sinn
  const doneLabel = isInfos
    ? "Gelesen"
    : isRechnungen
      ? "Bezahlt / Erledigt"
      : "Erledigt";
  const doneIcon = isInfos ? Eye : Check;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Primaer-Aktion: Mail oeffnen
       * Strategie fuer Mac M365 (neues Outlook):
       * 1. webLink ist 100% zuverlaessig — oeffnet die exakte Mail im
       *    neuen Browser-Tab in OWA. Das neue Mac-Outlook IST OWA-basiert,
       *    also funktional dasselbe wie Desktop-App.
       * 2. In OWA gibt es oben rechts den "In Outlook oeffnen"-Button
       *    der den User korrekt zur Mac-Desktop-App weiterleitet.
       * 3. Optional: ms-outlook:// Desktop-Link daneben (funktioniert auf
       *    Windows mit Click-to-Run, auf Mac wackelig).
       */}
      {task.source_email_web_link ? (
        <>
          <Button asChild size="sm" variant="default" className="h-8 gap-1.5">
            <a
              href={task.source_email_web_link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Öffnet die Original-Mail in Outlook (neuer Tab) — von dort eingebauter Knopf zum Desktop-Sprung"
            >
              <Reply size={13} />
              Mail öffnen
            </a>
          </Button>
          {desktopLink && (
            <a
              href={desktopLink}
              onClick={(e) => e.stopPropagation()}
              className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline self-center"
              title="Direkt im Outlook Desktop oeffnen (funktioniert nur wenn ms-outlook:// Protocol-Handler registriert ist)"
            >
              Desktop ↗
            </a>
          )}
        </>
      ) : mailto ? (
        <Button asChild size="sm" variant="outline" className="h-8 gap-1.5">
          <a
            href={mailto}
            onClick={(e) => e.stopPropagation()}
            title="Alte Task ohne Outlook-Link — öffnet neuen Mail-Entwurf"
          >
            <Reply size={13} />
            Antworten (mailto)
          </a>
        </Button>
      ) : null}

      <div className="h-5 w-px bg-border" />

      {/* Status-Toggle: bei Infos = "Gelesen", sonst "Erledigt" */}
      <Button
        size="sm"
        variant={isDone ? "outline" : "default"}
        className="h-8 gap-1.5"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          if (isInfos && !isDone) {
            onMarkAsRead();
          } else {
            onMarkDone();
          }
        }}
      >
        {(() => {
          const I = doneIcon;
          return <I size={13} />;
        })()}
        {isDone ? "Wieder offen" : doneLabel}
      </Button>

      {/* Bei Infos: zusaetzlicher "Zu Aufgabe verschieben"-Button */}
      {isInfos && !isDone && (
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5"
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            onMoveToAufgaben();
          }}
          title="Diese Info wird zur Aufgabe und erscheint im Aufgaben-Tab"
        >
          <ArrowRight size={13} />
          Zu Aufgabe machen
        </Button>
      )}

      {/* Snooze-Buttons nur wo sinnvoll */}
      {showSnooze && (
        <>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5"
            disabled={busy || isDone}
            onClick={(e) => {
              e.stopPropagation();
              onSnooze(3 * 60 * 60 * 1000);
            }}
          >
            <Clock3 size={13} />
            +3 Std
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5"
            disabled={busy || isDone}
            onClick={(e) => {
              e.stopPropagation();
              onSnooze(24 * 60 * 60 * 1000);
            }}
          >
            <CalendarDays size={13} />
            Morgen
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5"
            disabled={busy || isDone}
            onClick={(e) => {
              e.stopPropagation();
              onSnooze(7 * 24 * 60 * 60 * 1000);
            }}
          >
            <CalendarClock size={13} />
            +1 Woche
          </Button>
        </>
      )}
    </div>
  );
}

/* ---------------- States ---------------- */

function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: typeof Mail;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 py-16 px-4 text-center">
      <div className="rounded-full bg-muted/60 p-3 mb-3">
        <Icon size={22} className="text-muted-foreground/70" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-sm">{hint}</p>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="relative overflow-hidden rounded-lg border bg-card animate-pulse"
        >
          <span className="absolute left-0 top-0 bottom-0 w-1 bg-muted" />
          <div className="pl-4 pr-3 py-3 space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <div className="h-4 bg-muted rounded w-2/3" />
              <div className="h-3 bg-muted rounded w-16" />
            </div>
            <div className="h-3 bg-muted/70 rounded w-5/6" />
            <div className="h-3 bg-muted/70 rounded w-4/6" />
            <div className="flex gap-2 pt-1">
              <div className="h-4 bg-muted rounded-full w-20" />
              <div className="h-4 bg-muted rounded-full w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorBox({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 p-4">
      <p className="text-sm font-medium text-red-700 dark:text-red-400">
        Fehler beim Laden
      </p>
      <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1 font-mono break-all">
        {error}
      </p>
      <Button variant="outline" size="sm" className="mt-3 h-7" onClick={onRetry}>
        Erneut versuchen
      </Button>
    </div>
  );
}

/* Pagination entfernt — alles in einem Stream */

/* ---------------- Sortable Bucket (innerhalb gemeinsamer DndContext) ---------------- */
/**
 * Sortable-Container fuer eine Liste/Bucket — KEIN eigener DndContext mehr
 * (der ist eine Ebene hoeher in MailTab gemeinsam fuer Sort + Drop-To-My-Day).
 */
function SortableBucket({
  tasks,
  renderCard,
}: {
  tasks: MailTask[];
  renderCard: (task: MailTask) => React.ReactNode;
}) {
  return (
    <SortableContext
      items={tasks.map((t) => t.id)}
      strategy={verticalListSortingStrategy}
    >
      <div className="space-y-2">
        {tasks.map((t) => (
          <SortableTaskCard key={t.id} id={t.id}>
            {renderCard(t)}
          </SortableTaskCard>
        ))}
      </div>
    </SortableContext>
  );
}

/* ---------------- Floating Drop-Zone "Zu Mein Tag" ---------------- */
/** Sticky-Banner der WAEHREND eines Drags an der oberen Bildschirmkante
 *  erscheint. Drop -> Task wandert in Mein Tag. Nur sichtbar wenn aktiv
 *  gedraggt wird UND wir nicht schon im my_day-Tab sind. */
function MyDayDropZone({ visible }: { visible: boolean }) {
  const { isOver, setNodeRef } = useDroppable({ id: "drop:my-day" });
  if (!visible) return null;
  return (
    <div
      ref={setNodeRef}
      className={`sticky top-2 z-20 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed py-3 px-4 transition-all ${
        isOver
          ? "border-amber-500 bg-amber-100 dark:bg-amber-950/40 scale-105 shadow-lg"
          : "border-amber-300/60 bg-amber-50/80 dark:bg-amber-950/20 dark:border-amber-700/40"
      }`}
    >
      <Sun
        size={16}
        className={`${isOver ? "text-amber-600" : "text-amber-500"} ${isOver ? "animate-spin" : ""}`}
      />
      <span className="text-[13px] font-semibold text-amber-700 dark:text-amber-300">
        {isOver ? "Loslassen zum Hinzufügen" : "Hier ablegen für Mein Tag"}
      </span>
    </div>
  );
}

/* ---------------- Prio-Panel ---------------- */
/**
 * Hervorgehobenes Panel oben fuer Tasks mit Prio-Keywords
 * (Angebotsprüfung / Freigabe / Auftragsbestätigung / Bitte prüfen).
 * Wird nur gerendert wenn solche Tasks da sind — kein Empty-State.
 */
function PrioPanel({
  tasks,
  expanded,
  busyTaskId,
  onToggle,
  onMarkDone,
  onMarkAsRead,
  onMoveToAufgaben,
  onSnooze,
  onSubtasksChange,
  onDelegationChange,
  onSenderClick,
  onToggleMyDay,
  onToggleImportant,
  onChangePriority,
  onChangeCategory,
  buildMailto,
  buildOutlookDesktopLink,
  heroProjectLinkTemplate,
  tab,
  onHeroMatched,
}: {
  tasks: MailTask[];
  expanded: string | null;
  busyTaskId: string | null;
  onToggle: (next: string | null | ((cur: string | null) => string | null)) => void;
  onMarkDone: (t: MailTask) => void;
  onMarkAsRead: (t: MailTask) => void;
  onMoveToAufgaben: (t: MailTask) => void;
  onSnooze: (t: MailTask, ms: number) => void;
  onSubtasksChange: (taskId: string, next: Subtask[]) => void;
  onDelegationChange: (
    taskId: string,
    next: { assigned_to: string | null; remind_at: string | null },
  ) => void;
  onSenderClick: (email: string) => void;
  onToggleMyDay: (task: MailTask) => void;
  onToggleImportant: (task: MailTask) => void;
  onChangePriority: (task: MailTask, p: MailTask["priority"]) => void;
  onChangeCategory: (task: MailTask, c: MailTask["mail_category"]) => void;
  buildMailto: (task: MailTask) => string | null;
  buildOutlookDesktopLink: (task: MailTask) => string | null;
  heroProjectLinkTemplate: string | null;
  tab: MailTabFilter;
  onHeroMatched?: (taskId: string, patch: HeroMatchPatch) => void;
}) {
  return (
    <section className="relative rounded-2xl border border-amber-300/60 bg-gradient-to-br from-amber-50 via-orange-50/40 to-white dark:from-amber-950/30 dark:via-orange-950/20 dark:to-card/40 dark:border-amber-700/40 p-3 space-y-2 shadow-[0_4px_24px_-4px_hsl(35_95%_55%/0.25)]">
      <div className="flex items-center gap-2 px-1">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
          <AlertTriangle size={12} /> Prio
        </span>
        <span className="text-[10px] text-muted-foreground/70 font-medium">
          {tasks.length} {tasks.length === 1 ? "Vorgang" : "Vorgänge"} mit
          „Angebotsprüfung", „Freigabe", „Bitte prüfen" oder „Auftragsbestätigung"
        </span>
        <div className="flex-1 h-px bg-amber-300/40 dark:bg-amber-700/30 ml-2" />
      </div>
      <div className="space-y-2">
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            tab={tab}
            expanded={expanded === t.id}
            busy={busyTaskId === t.id}
            onToggle={() =>
              onToggle((cur) => (cur === t.id ? null : t.id))
            }
            onMarkDone={() => onMarkDone(t)}
            onMarkAsRead={() => onMarkAsRead(t)}
            onMoveToAufgaben={() => onMoveToAufgaben(t)}
            onSnooze={(ms) => onSnooze(t, ms)}
            onSubtasksChange={(next) => onSubtasksChange(t.id, next)}
            onDelegationChange={(next) => onDelegationChange(t.id, next)}
            onSenderClick={onSenderClick}
            onToggleMyDay={() => onToggleMyDay(t)}
            onToggleImportant={() => onToggleImportant(t)}
            onChangePriority={(p) => onChangePriority(t, p)}
            onChangeCategory={(c) => onChangeCategory(t, c)}
            buildMailto={buildMailto}
            buildOutlookDesktopLink={buildOutlookDesktopLink}
            heroProjectLinkTemplate={heroProjectLinkTemplate}
            onHeroMatched={onHeroMatched ? (patch) => onHeroMatched(t.id, patch) : undefined}
          />
        ))}
      </div>
    </section>
  );
}

/* ---------------- Auto-Hero-Match ---------------- */
/**
 * Wird in expandiertem TaskCard fuer Mail-Tasks ohne hero_project_id
 * gerendert. Beim ersten Expand feuert ein POST an match-hero-project.
 * Wenn ein direkter Treffer (z.B. #9753 im Titel) gefunden wird, refresh
 * die Page-State damit ProjectActivityStrip nachgeladen wird.
 *
 * Sichtbar nur als kleiner Status-Hinweis (Spinner -> Result), kein
 * Eingriff. Wenn der Match fehlschlaegt, bleibt das Component still.
 */
/** Saeubert Hero-Projekt-Namen: das Hero-Backend liefert oft Platzhalter
 *  wie "-7189 | --, --, --" wenn Kunde/Ort/PLZ fehlen. Wir entfernen
 *  leere Pipe-Segmente und reine Dash-Tokens. Wenn nach dem Cleanup
 *  nichts Sinnvolles uebrig bleibt (nur Zahlen/Dashes), wird null
 *  zurueckgegeben → der UI-Code blendet den Namens-Span komplett aus. */
function cleanHeroProjectName(
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
function buildHeroProjectHref(
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

type HeroCandidate = {
  id: string;
  number: string | null;
  name: string | null;
  customer: string | null;
};

function AutoHeroMatch({
  taskId,
  expanded,
  heroProjectLinkTemplate,
  onMatched,
  previouslyAttempted,
}: {
  taskId: string;
  expanded: boolean;
  heroProjectLinkTemplate: string | null;
  /** Wird sofort nach erfolgreichem Match aufgerufen — updated lokalen State
   *  damit heroProjectLinked sofort true wird und die Hero-Buttons erscheinen. */
  onMatched?: (patch: HeroMatchPatch) => void;
  /** Aus DB: hero_match_attempted_at ist gesetzt. Skip Auto-Match (no-match in der Vergangenheit). */
  previouslyAttempted?: boolean;
}) {
  const triedRef = useRef(false);
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "running" }
    | { kind: "matched"; projectId: string | null; projectNumber: string | null; projectName: string | null }
    | { kind: "no-match" }
  >(previouslyAttempted ? { kind: "no-match" } : { kind: "idle" });
  // Manuelles Mapping (no-match Fall)
  const [manualInput, setManualInput] = useState("");
  const [manualBusy, setManualBusy] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualCandidates, setManualCandidates] = useState<HeroCandidate[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (!expanded) return;
    if (triedRef.current) return;
    triedRef.current = true;
    // Wenn bereits versucht (cached in DB), zeigen wir gleich die No-Match-UI
    // ohne erneuten API-Call. Spart Latenz + Claude-Token.
    if (previouslyAttempted) {
      setState({ kind: "no-match" });
      return;
    }
    setState({ kind: "running" });
    fetch(`/api/mail-tasks/${taskId}/match-hero-project`, { method: "POST" })
      .then(async (r) => {
        if (!r.ok) return setState({ kind: "no-match" });
        const j = await r.json();
        if (j.matched && j.project) {
          const patch: HeroMatchPatch = {
            hero_project_id: j.project.id ?? "",
            hero_project_number: j.project.number ?? null,
            hero_project_name: j.project.name ?? null,
          };
          setState({
            kind: "matched",
            projectId: patch.hero_project_id,
            projectNumber: patch.hero_project_number,
            projectName: patch.hero_project_name,
          });
          // Lokalen State sofort updaten → Hero-Buttons erscheinen ohne Page-Reload
          onMatched?.(patch);
          // router.refresh() als Fallback fuer SSR-Cache
          setTimeout(() => router.refresh(), 200);
        } else {
          setState({ kind: "no-match" });
        }
      })
      .catch(() => setState({ kind: "no-match" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, taskId, previouslyAttempted]);

  /** Manuelles Mapping via Projektnummer (no-match Fall).
   *  Wenn 1 Treffer: direkt linken. Wenn mehrere: Kandidaten-Liste anzeigen. */
  async function tryManualLink(projectIdOrNumber?: string) {
    setManualBusy(true);
    setManualError(null);
    setManualCandidates([]);
    const isDirectId = Boolean(projectIdOrNumber);
    const body = isDirectId
      ? { projectId: projectIdOrNumber }
      : { projectNumber: manualInput };
    try {
      const r = await fetch(`/api/mail-tasks/${taskId}/link-hero-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.matched && j.project) {
        const patch: HeroMatchPatch = {
          hero_project_id: j.project.id ?? "",
          hero_project_number: j.project.number ?? null,
          hero_project_name: j.project.name ?? null,
        };
        setState({
          kind: "matched",
          projectId: patch.hero_project_id,
          projectNumber: patch.hero_project_number,
          projectName: patch.hero_project_name,
        });
        onMatched?.(patch);
        setManualInput("");
        setTimeout(() => router.refresh(), 200);
        return;
      }
      // 409 = mehrere Kandidaten → User soll waehlen
      if (r.status === 409 && Array.isArray(j.candidates)) {
        setManualCandidates(j.candidates as HeroCandidate[]);
        return;
      }
      // 404 oder anderer Fehler
      setManualError(typeof j.error === "string" ? j.error : `Fehler ${r.status}`);
    } catch (e) {
      setManualError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setManualBusy(false);
    }
  }

  if (state.kind === "idle") return null;

  if (state.kind === "running") {
    return (
      <div className="text-[11px] text-muted-foreground italic flex items-center gap-1.5">
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500/50 animate-pulse" />
        Suche Hero-Projekt…
      </div>
    );
  }

  // No-Match: manuelles Mapping anbieten
  if (state.kind === "no-match") {
    return (
      <div className="rounded-md border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/15 p-2 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[11px] text-amber-800 dark:text-amber-300">
          <AlertTriangle size={11} className="shrink-0" />
          <span className="font-medium">Kein Hero-Projekt automatisch gefunden</span>
        </div>
        <p className="text-[10.5px] text-muted-foreground leading-relaxed">
          Gib die Projektnummer manuell ein (z.B. <span className="font-mono">9702</span>, <span className="font-mono">EINS-9702</span> oder <span className="font-mono">PVS-9489</span>):
        </p>
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && manualInput.trim().length >= 2 && !manualBusy) {
                e.preventDefault();
                void tryManualLink();
              }
            }}
            disabled={manualBusy}
            placeholder="z.B. 9702"
            className="flex-1 h-7 px-2 text-[11px] rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-amber-500"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); void tryManualLink(); }}
            disabled={manualBusy || manualInput.trim().length < 2}
            className="h-7 px-2.5 text-[10.5px] font-medium rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {manualBusy ? "…" : "Verlinken"}
          </button>
        </div>
        {manualError && (
          <p className="text-[10.5px] text-rose-600 dark:text-rose-400">{manualError}</p>
        )}
        {manualCandidates.length > 0 && (
          <div className="space-y-0.5 pt-0.5">
            <p className="text-[10px] text-muted-foreground">
              {manualCandidates.length} Projekte gefunden — bitte waehlen:
            </p>
            {manualCandidates.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={(e) => { e.stopPropagation(); void tryManualLink(c.id); }}
                disabled={manualBusy}
                className="w-full text-left text-[10.5px] px-2 py-1 rounded border border-border/60 bg-background hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:border-amber-400/60 transition-colors flex items-center gap-1.5"
              >
                <span className="font-mono font-semibold text-amber-700 dark:text-amber-300">{c.number ?? "?"}</span>
                {c.customer && <span className="text-muted-foreground">— {c.customer}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // matched
  const href = buildHeroProjectHref(
    heroProjectLinkTemplate,
    state.projectId,
    state.projectNumber,
  );
  const clean = cleanHeroProjectName(state.projectName, state.projectNumber);
  const label = clean
    ? `${state.projectNumber} — ${clean}`
    : (state.projectNumber ?? "");

  const inner = (
    <>
      <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
      Hero-Projekt verknuepft:{" "}
      <span className="font-mono font-semibold">{label}</span>
      {href && <ExternalLink size={11} className="opacity-60" />}
    </>
  );

  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-300 hover:underline decoration-dotted underline-offset-2 w-fit"
      title={`Hero-Projekt ${state.projectNumber} öffnen`}
    >
      {inner}
    </a>
  ) : (
    <div className="text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
      {inner}
    </div>
  );
}

/* ---------------- Bulk-Cleanup-Banner ---------------- */
/**
 * Zeigt im Infos-Tab oben einen Banner mit Count alter Infos und
 * Bulk-Done-Button. Funktioniert in 2 Stufen:
 *   1. Mount -> dry-run POST -> Count laden (kein DB-Write)
 *   2. User klickt -> echter POST -> alle archivieren
 */
function BulkCleanupBanner({
  categories,
  onCleaned,
}: {
  categories: string[];
  onCleaned: () => void;
}) {
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  const OLDER_THAN_DAYS = 30;

  // Dry-Run beim Mount um Count zu holen
  useEffect(() => {
    let cancelled = false;
    fetch("/api/mail-tasks/bulk-done-old", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categories,
        olderThanDays: OLDER_THAN_DAYS,
        dryRun: true,
      }),
    })
      .then((r) => (r.ok ? r.json() : { affected: 0 }))
      .then((d) => {
        if (!cancelled)
          setCount(typeof d.affected === "number" ? d.affected : 0);
      })
      .catch(() => {
        if (!cancelled) setCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [categories]);

  async function execute() {
    if (busy || !count) return;
    if (
      !window.confirm(
        `${count} Info-Aufgaben aelter als ${OLDER_THAN_DAYS} Tage werden auf 'erledigt' gesetzt. Fortfahren?`,
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch("/api/mail-tasks/bulk-done-old", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categories,
          olderThanDays: OLDER_THAN_DAYS,
          dryRun: false,
        }),
      });
      if (res.ok) {
        setCount(0);
        setHidden(true);
        onCleaned();
      }
    } finally {
      setBusy(false);
    }
  }

  if (hidden || count === null || count === 0) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-300/60 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-700/40 px-3 py-2">
      <div className="flex-1 text-[12.5px]">
        <span className="font-medium">{count}</span>{" "}
        <span className="text-muted-foreground">
          alte Info{count === 1 ? "" : "s"} (&gt;{OLDER_THAN_DAYS} Tage)
          aufraeumen?
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1.5 text-[12px]"
        onClick={execute}
        disabled={busy}
      >
        {busy ? "läuft…" : `Erledigt setzen`}
      </Button>
      <button
        type="button"
        onClick={() => setHidden(true)}
        className="text-muted-foreground hover:text-foreground p-1"
        title="Banner ausblenden"
        aria-label="Banner ausblenden"
      >
        <X size={14} />
      </button>
    </div>
  );
}

/* ---------------- Quick-Edit Bar (Prio + Kategorie) ---------------- */
/**
 * Kleine Bar im expandierten TaskCard, zeigt die aktuelle Prio + Kategorie
 * als Buttons. Klick aufs Pill = Pop-Menu mit Auswahl-Optionen.
 * Optimistic Update via Parent-Callback.
 */
/** Inline Prio-Badge mit Popover-Menu — wird in der COLLAPSED Karte
 *  in der Meta-Row angezeigt. Klick = Popover mit den 4 Prio-Optionen.
 *  Sieht aus wie ein Badge, verhaelt sich wie ein Dropdown. */
function PrioPickerInline({
  currentPriority,
  onChange,
}: {
  currentPriority: MailTask["priority"];
  onChange: (p: MailTask["priority"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const cur = currentPriority ? PRIORITY_CONFIG[currentPriority] : null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full transition-opacity hover:opacity-80 ${
            cur
              ? cur.badge
              : "bg-muted/60 text-muted-foreground ring-1 ring-border"
          }`}
          title="Priorität ändern"
        >
          {cur ? (
            <>
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${cur.dot}`}
              />
              {cur.label}
            </>
          ) : (
            <span className="opacity-70">Priorität setzen</span>
          )}
          <ChevronDown size={10} className="ml-1 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-44 p-1"
        onClick={(e) => e.stopPropagation()}
      >
        {PRIO_OPTIONS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(p.value);
              setOpen(false);
            }}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-[12.5px] hover:bg-muted ${
              p.value === currentPriority ? "bg-muted/60 font-medium" : ""
            }`}
          >
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${p.dot}`} />
            {p.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

const PRIO_OPTIONS: Array<{
  value: NonNullable<MailTask["priority"]>;
  label: string;
  dot: string;
}> = [
  { value: "urgent", label: "Dringend", dot: "bg-red-500" },
  { value: "high", label: "Hoch", dot: "bg-orange-500" },
  { value: "medium", label: "Mittel", dot: "bg-amber-400" },
  { value: "low", label: "Niedrig", dot: "bg-zinc-400" },
];

const CATEGORY_OPTIONS: Array<{
  value: NonNullable<MailTask["mail_category"]>;
  label: string;
  className: string;
  /** Saturated dot color fuer Dropdown-Liste (Pill-bg ist pastell, der dot
   *  muss ge­saettigt sein damit man die Kategorie auf einen Blick sieht). */
  dot: string;
}> = [
  {
    value: "kritisch",
    label: "Kritisch",
    className:
      "text-rose-700 bg-rose-50 ring-rose-200 dark:text-rose-300 dark:bg-rose-950/40 dark:ring-rose-900/40",
    dot: "bg-rose-500",
  },
  {
    value: "dringend",
    label: "Dringend",
    className:
      "text-orange-700 bg-orange-50 ring-orange-200 dark:text-orange-300 dark:bg-orange-950/40 dark:ring-orange-900/40",
    dot: "bg-orange-500",
  },
  {
    value: "aufgabe",
    label: "Operativ",
    className:
      "text-blue-700 bg-blue-50 ring-blue-200 dark:text-blue-300 dark:bg-blue-950/40 dark:ring-blue-900/40",
    dot: "bg-blue-500",
  },
  {
    value: "info",
    label: "Info",
    className:
      "text-slate-600 bg-slate-100 ring-slate-200 dark:text-slate-400 dark:bg-slate-800 dark:ring-slate-700",
    dot: "bg-slate-400",
  },
  {
    value: "rechnung",
    label: "Rechnung",
    className:
      "text-emerald-700 bg-emerald-50 ring-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:ring-emerald-900/40",
    dot: "bg-emerald-500",
  },
  {
    value: "bestellung",
    label: "Bestellung",
    className:
      "text-emerald-700 bg-emerald-50 ring-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:ring-emerald-900/40",
    dot: "bg-teal-500",
  },
  {
    value: "inbox",
    label: "Inbox",
    className:
      "text-zinc-600 bg-zinc-100 ring-zinc-200 dark:text-zinc-400 dark:bg-zinc-800 dark:ring-zinc-700",
    dot: "bg-zinc-400",
  },
  {
    value: "pl_aufgabe",
    label: "Projektleiter",
    className:
      "text-indigo-700 bg-indigo-50 ring-indigo-200 dark:text-indigo-300 dark:bg-indigo-950/40 dark:ring-indigo-900/40",
    dot: "bg-indigo-500",
  },
  {
    value: "gf_aufgabe",
    label: "Geschäftsführung",
    className:
      "text-violet-700 bg-violet-50 ring-violet-200 dark:text-violet-300 dark:bg-violet-950/40 dark:ring-violet-900/40",
    dot: "bg-violet-500",
  },
];

function TaskQuickEditBar({
  task,
  onChangePriority,
  onChangeCategory,
}: {
  task: MailTask;
  onChangePriority: (p: MailTask["priority"]) => void;
  onChangeCategory: (c: MailTask["mail_category"]) => void;
}) {
  const [prioOpen, setPrioOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const currentPrio = PRIO_OPTIONS.find((p) => p.value === task.priority);
  const currentCat = CATEGORY_OPTIONS.find(
    (c) => c.value === task.mail_category,
  );

  return (
    <div className="flex flex-wrap items-center gap-2 text-[12px]">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
        Klassifikation:
      </span>
      {/* Prio-Pill */}
      <Popover open={prioOpen} onOpenChange={setPrioOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium border hover:bg-muted/60 transition-colors"
            title="Priorität ändern"
          >
            <span
              className={`inline-block w-2 h-2 rounded-full ${currentPrio?.dot ?? "bg-muted-foreground/40"}`}
              aria-hidden
            />
            {currentPrio?.label ?? "Keine Prio"}
            <ChevronDown size={12} className="opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-44 p-1">
          {PRIO_OPTIONS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => {
                onChangePriority(p.value);
                setPrioOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-[12.5px] hover:bg-muted ${
                p.value === task.priority ? "bg-muted/60 font-medium" : ""
              }`}
            >
              <span
                className={`inline-block w-2.5 h-2.5 rounded-full ${p.dot}`}
                aria-hidden
              />
              {p.label}
            </button>
          ))}
        </PopoverContent>
      </Popover>
      {/* Kategorie-Pill */}
      <Popover open={catOpen} onOpenChange={setCatOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium ring-1 hover:opacity-90 transition-opacity ${
              currentCat?.className ?? "bg-muted/50 ring-border"
            }`}
            title="Kategorie ändern"
          >
            {currentCat?.label ?? "Keine Kategorie"}
            <ChevronDown size={12} className="opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-48 p-1">
          {CATEGORY_OPTIONS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => {
                onChangeCategory(c.value);
                setCatOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-[12.5px] hover:bg-muted ${
                c.value === task.mail_category ? "bg-muted/60 font-medium" : ""
              }`}
            >
              <span
                className={`inline-block w-2.5 h-2.5 rounded-full ${c.dot}`}
                aria-hidden
              />
              {c.label}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/* ---------------- Mein-Tag Vorschläge-Panel ---------------- */
type Suggestion = {
  id: string;
  title: string;
  description: string | null;
  mail_category: string | null;
  priority: string | null;
  due_date: string | null;
  created_at: string;
  is_important: boolean;
  /** Menschenlesbarer Grund warum die Task vorgeschlagen wird, vom Server. */
  reason: string;
};

/** Tailwind-Token-Klassen fuer den Grund-Badge — gibt visuell Hinweis WIE
 *  dringend der Vorschlag ist (red = ueberfaellig, amber = heute, ...). */
function reasonStyle(reason: string): { className: string } {
  const r = reason.toLowerCase();
  if (r.startsWith("überfällig")) {
    return {
      className:
        "text-rose-700 bg-rose-100 dark:text-rose-300 dark:bg-rose-950/40",
    };
  }
  if (r === "fällig heute" || r === "dringend") {
    return {
      className:
        "text-orange-700 bg-orange-100 dark:text-orange-300 dark:bg-orange-950/40",
    };
  }
  if (r === "fällig morgen" || r === "hohe priorität" || r === "kritische mail") {
    return {
      className:
        "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-950/40",
    };
  }
  if (r === "wichtig markiert") {
    return {
      className:
        "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-950/40",
    };
  }
  if (r.startsWith("fällig in") || r === "diese woche fällig") {
    return {
      className:
        "text-sky-700 bg-sky-100 dark:text-sky-300 dark:bg-sky-950/40",
    };
  }
  return {
    className: "text-muted-foreground bg-muted/60",
  };
}

/**
 * MS-To-Do-Style "Vorschläge" Panel — laedt offene Tasks die NOCH NICHT in
 * Mein Tag sind und bietet Quick-Add via +-Button. Nur sichtbar im Mein-Tag-Tab.
 */
function MyDaySuggestionsPanel({
  refreshKey,
  onAdd,
  busyTaskId,
}: {
  /** String-Key der sich bei Mutations aendert — triggert Re-Fetch. */
  refreshKey: string;
  onAdd: (suggestion: Suggestion) => Promise<void>;
  busyTaskId: string | null;
}) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  // Auf Mobile defaultmaessig kollabiert — sonst sitzt das Panel unter der
  // Liste und nimmt viel Platz. User kann es ausklappen wenn er will.
  const [mobileExpanded, setMobileExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    window
      .fetch("/api/mail-tasks/my-day-suggestions")
      .then((r) => (r.ok ? r.json() : { suggestions: [] }))
      .then((data) => {
        if (cancelled) return;
        const list: Suggestion[] = Array.isArray(data?.suggestions)
          ? data.suggestions
          : [];
        setItems(list);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const visible = items.filter((s) => !dismissed.has(s.id));

  if (loading && visible.length === 0) {
    return (
      <aside className="rounded-2xl border bg-card/60 p-4 space-y-2 sticky top-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Vorschläge
        </div>
        <div className="space-y-1.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 rounded-lg bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      </aside>
    );
  }

  if (visible.length === 0) {
    return (
      <aside className="rounded-2xl border bg-card/60 p-4 space-y-2 sticky top-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Vorschläge
        </div>
        <p className="text-[12px] text-muted-foreground/70">
          Keine offenen Aufgaben passen gerade als Vorschlag. Wichtige neue Mails
          oder Aufgaben mit Fälligkeit landen automatisch hier.
        </p>
      </aside>
    );
  }

  async function handleAdd(suggestion: Suggestion) {
    setDismissed((s) => new Set(s).add(suggestion.id));
    await onAdd(suggestion);
  }

  return (
    <aside className="rounded-2xl border bg-card/60 p-3 space-y-2 lg:sticky lg:top-4 lg:max-h-[calc(100vh-120px)] flex flex-col">
      {/* Header — auf Mobile klickbar zum Auf-/Zuklappen */}
      <button
        type="button"
        onClick={() => setMobileExpanded((v) => !v)}
        className="flex items-center justify-between gap-2 px-1 shrink-0 lg:cursor-default"
      >
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Vorschläge
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 tabular-nums">
          {visible.length} {visible.length === 1 ? "Vorschlag" : "Vorschläge"}
          <ChevronDown
            size={12}
            className={`lg:hidden transition-transform ${
              mobileExpanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>
      <div
        className={`space-y-1.5 overflow-y-auto pr-1 -mr-1 ${
          mobileExpanded ? "block" : "hidden lg:block"
        } lg:flex-1`}
      >
        {visible.map((s) => {
          const isBusy = busyTaskId === s.id;
          return (
            <div
              key={s.id}
              className="group flex items-start gap-2 rounded-lg border border-border/50 bg-background/40 px-2.5 py-2 hover:border-foreground/15 hover:bg-background/80 transition-colors"
            >
              <button
                type="button"
                onClick={() => handleAdd(s)}
                disabled={isBusy}
                className="shrink-0 mt-0.5 w-5 h-5 rounded-full border border-muted-foreground/40 hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40 grid place-items-center disabled:opacity-50"
                title="Zu Mein Tag hinzufügen"
                aria-label="Zu Mein Tag hinzufügen"
              >
                <span className="text-amber-600 dark:text-amber-400 text-[14px] leading-none font-bold">
                  +
                </span>
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-medium leading-snug text-foreground/90 line-clamp-2">
                  {s.title}
                </div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {/* Grund-Badge: warum schlagen wir das vor? */}
                  <span
                    className={`inline-flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      reasonStyle(s.reason).className
                    }`}
                  >
                    {s.is_important && (
                      <Star
                        size={9}
                        className="fill-current"
                        aria-hidden
                      />
                    )}
                    {s.reason}
                  </span>
                  {s.mail_category && s.mail_category !== "aufgabe" && (
                    <span className="text-[10px] text-muted-foreground/70 capitalize">
                      {s.mail_category}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
