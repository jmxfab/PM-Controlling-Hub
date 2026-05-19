"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Flame,
  ArrowRight,
  Eye,
  EyeOff,
  UserCheck,
  Bell,
  History,
} from "lucide-react";
import type { HeizlastProject } from "@/lib/supabase/hero-heizlast-queries";
import type {
  MailTask,
  MailTasksPage,
  MailTaskCounts,
  MailTabFilter,
  Subtask,
} from "@/lib/supabase/mail-tasks-queries";
import { HeizlastView } from "@/components/heizlast/heizlast-view";
import { SubtaskList } from "@/components/aufgaben/subtask-list";
import { DelegateRemindForm } from "@/components/aufgaben/delegate-remind-form";
import { SenderHistoryDialog } from "@/components/aufgaben/sender-history-dialog";
import { ProjectActivityStrip } from "@/components/aufgaben/project-activity-strip";
import { TaskComposer } from "@/components/aufgaben/task-composer";

/** Keine echte Pagination — alles auf einmal laden (bis 500),
 *  einfach scrollen statt Seiten blaettern. */
const PAGE_SIZE = 500;

type StatusFilter = "all" | "open" | "done";
type PrioFilter = "all" | "urgent" | "high" | "medium" | "low";

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
  kritisch: {
    label: "Kritisch",
    emptyTitle: "Keine kritischen Eskalationen",
    emptyHint: "Sieht ruhig aus — keine Notfälle gerade.",
    icon: AlertTriangle,
  },
  aufgaben: {
    label: "Aufgaben",
    emptyTitle: "Keine offenen Aufgaben",
    emptyHint:
      "Sobald neue Mails oder Hero-Erwähnungen reinkommen, erscheinen sie hier.",
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
  counts,
}: Props) {
  const defaultTab: MailTabFilter =
    initialTab ?? (counts.kritisch > 0 ? "kritisch" : "aufgaben");

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
    <Tabs defaultValue={defaultTab} className="space-y-5">
      <TabsList className="h-auto p-1.5 bg-muted/40 rounded-xl gap-1 flex-wrap">
        <TabsTrigger
          value="kritisch"
          className={
            counts.kritisch > 0
              ? "group relative gap-1.5 rounded-lg font-semibold text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/30 bg-gradient-to-b from-rose-50 to-rose-100/70 hover:from-rose-100 hover:to-rose-200/80 dark:from-rose-500/10 dark:to-rose-600/5 dark:hover:from-rose-500/15 dark:hover:to-rose-600/10 data-[state=active]:bg-gradient-to-br data-[state=active]:from-rose-500 data-[state=active]:via-red-600 data-[state=active]:to-rose-700 data-[state=active]:text-white data-[state=active]:ring-rose-500/0 data-[state=active]:shadow-[0_4px_18px_-2px_hsl(0_84%_55%/0.5)] dark:data-[state=active]:shadow-[0_6px_24px_-4px_hsl(0_84%_60%/0.6)] transition-all duration-200"
              : "gap-1.5 rounded-lg data-[state=active]:shadow-sm"
          }
        >
          {counts.kritisch > 0 && (
            <AlertTriangle
              size={13}
              className="drop-shadow-[0_0_4px_hsl(0_84%_55%/0.4)] group-data-[state=active]:drop-shadow-[0_0_6px_rgba(255,255,255,0.4)]"
            />
          )}
          Kritisch
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
        <TabsTrigger value="aufgaben" className="gap-1.5 rounded-lg data-[state=active]:shadow-sm">
          <Mail size={13} />
          Aufgaben
          <CountPill value={counts.aufgaben} />
        </TabsTrigger>
        <TabsTrigger value="infos" className="gap-1.5 rounded-lg data-[state=active]:shadow-sm">
          <Sparkles size={13} />
          Infos
          <CountPill value={counts.infos} />
        </TabsTrigger>
        {counts.inbox > 0 && (
          <TabsTrigger value="inbox" className="gap-1.5 rounded-lg data-[state=active]:shadow-sm">
            <Inbox size={13} />
            Inbox
            <CountPill value={counts.inbox} highlight />
          </TabsTrigger>
        )}
        <TabsTrigger value="rechnungen" className="gap-1.5 rounded-lg data-[state=active]:shadow-sm">
          <Euro size={13} />
          Bestellungen & Rechnungen
          <CountPill value={counts.rechnungen} />
        </TabsTrigger>
        <TabsTrigger value="heizlast" className="gap-1.5 rounded-lg data-[state=active]:shadow-sm">
          <Flame size={13} />
          Heizlast
          <CountPill value={heizlastProjects.length} />
        </TabsTrigger>
      </TabsList>
      <TabsContent value="kritisch">
        <MailTab
          initial={defaultTab === "kritisch" ? initialAufgaben : { entries: [], total: 0 }}
          filter="kritisch"
        />
      </TabsContent>
      <TabsContent value="aufgaben">
        <MailTab
          initial={defaultTab === "aufgaben" ? initialAufgaben : { entries: [], total: 0 }}
          filter="aufgaben"
        />
      </TabsContent>
      <TabsContent value="infos">
        <MailTab
          initial={defaultTab === "infos" ? initialAufgaben : { entries: [], total: 0 }}
          filter="infos"
        />
      </TabsContent>
      {counts.inbox > 0 && (
        <TabsContent value="inbox">
          <MailTab initial={{ entries: [], total: 0 }} filter="inbox" />
        </TabsContent>
      )}
      <TabsContent value="rechnungen">
        <MailTab initial={{ entries: [], total: 0 }} filter="rechnungen" />
      </TabsContent>
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
  tone?: "rose";
}) {
  if (!value) return null;
  if (tone === "rose") {
    return (
      <span className="relative text-[10px] tabular-nums font-bold px-1.5 min-w-[1.125rem] h-[1.125rem] inline-flex items-center justify-center rounded-full bg-rose-500/15 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300 ring-1 ring-rose-500/30 group-data-[state=active]:bg-white/25 group-data-[state=active]:text-white group-data-[state=active]:ring-white/30 group-data-[state=active]:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)] transition-colors">
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
  kritisch:   { status: false, priority: false, defaultStatus: "open" },
  aufgaben:   { status: true,  priority: true,  defaultStatus: "open" },
  infos:      { status: true,  priority: false, defaultStatus: "open" }, // Default ungelesene, "Gelesen"-Filter erreichbar
  inbox:      { status: true,  priority: false, defaultStatus: "open" },
  rechnungen: { status: true,  priority: false, defaultStatus: "open" },
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

function MailTab({
  initial,
  filter,
}: {
  initial: MailTasksPage;
  filter: MailTabFilter;
}) {
  const meta = TAB_META[filter];
  const tabFilters = TAB_FILTERS[filter];
  // URL-Param ?search=... unterstuetzen — wird beim Mount in den Filter
  // uebernommen damit Cross-Links vom Logbuch funktionieren.
  const [search, setSearch] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("search") ?? "";
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    tabFilters.defaultStatus,
  );
  const [prioFilter, setPrioFilter] = useState<PrioFilter>("all");
  const [data, setData] = useState<MailTasksPage>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  /** Wenn gesetzt -> SenderHistoryDialog ist offen mit dieser Mail-Adresse. */
  const [historyEmail, setHistoryEmail] = useState<string | null>(null);
  /** "Erinnerung in Zukunft" = Snooze: Karte versteckt bis Reminder faellig.
   *  Toggle macht sie wieder sichtbar zum manuellen Eingriff. */
  const [showSnoozed, setShowSnoozed] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Trennen in sichtbar / snoozed: Tasks deren remind_at > jetzt sind
  // werden ausgeblendet. Recompute jede Minute via Date.now() Tick reicht
  // — bei Page-Reload sowieso. Memoiziert auf data.entries.
  const { visibleEntries, snoozedCount } = useMemo(() => {
    const nowMs = Date.now();
    const visible: MailTask[] = [];
    let snoozed = 0;
    for (const t of data.entries) {
      // 1) Erledigte raus — Item 3.1 (sofortiges Ausblenden nach Mark-Done)
      //    Beim 'done' Statusfilter werden sie ueber den API-Filter wieder reingeholt.
      if (t.status === "done" && statusFilter !== "done") continue;
      // 2) Snooze: Tasks mit remind_at > jetzt werden versteckt
      if (t.status !== "done" && t.remind_at) {
        const remindMs = new Date(t.remind_at).getTime();
        if (Number.isFinite(remindMs) && remindMs > nowMs) {
          snoozed += 1;
          if (!showSnoozed) continue;
        }
      }
      visible.push(t);
    }
    return { visibleEntries: visible, snoozedCount: snoozed };
  }, [data.entries, showSnoozed, statusFilter]);

  const fetchData = useCallback(
    async (q: string, p: number, st: StatusFilter, pr: PrioFilter) => {
      const key = cacheKey(filter, q, st, pr);
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
        setLoading(true);
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
        const page: MailTasksPage = {
          entries: json.entries ?? [],
          total: json.total ?? 0,
        };
        RESPONSE_CACHE.set(key, { data: page, ts: Date.now() });
        setData(page);
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
      fetchData(search, 0, statusFilter, prioFilter);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, statusFilter, prioFilter, fetchData]);

  async function patchTask(
    taskId: string,
    update: {
      status?: MailTask["status"];
      due_date?: string | null;
      mail_category?: MailTask["mail_category"];
      priority?: MailTask["priority"];
      remind_at?: string | null;
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
                  }
                : t,
            ),
        total: removeFromList ? Math.max(0, prev.total - 1) : prev.total,
      }));
      // Cache fuer diesen Filter (und ggf. Ziel-Filter bei category change)
      // invalidieren, damit der naechste Tab-Wechsel frische Daten holt.
      invalidateCacheForFilter(filter);
      if (update.mail_category) {
        // Task wechselt Tab -> auch dort Cache leeren
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
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Netzwerk-Fehler");
    } finally {
      setBusyTaskId(null);
    }
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
    return patchTask(task.id, {
      status: task.status === "done" ? "open" : "done",
    });
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

  return (
    <div className="space-y-4">
      <FilterBar
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        prioFilter={prioFilter}
        setPrioFilter={setPrioFilter}
        hasFilters={!!hasFilters}
        defaultStatus={tabFilters.defaultStatus}
        loading={loading}
        showStatus={tabFilters.status}
        showPriority={tabFilters.priority}
        tab={filter}
      />

      {error ? (
        <ErrorBox
          error={error}
          onRetry={() => fetchData(search, 0, statusFilter, prioFilter)}
        />
      ) : loading && data.entries.length === 0 ? (
        <SkeletonList />
      ) : visibleEntries.length === 0 && snoozedCount === 0 ? (
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
              icon={Bell}
              title="Alles aufgeschoben"
              hint={`${snoozedCount} Aufgabe${
                snoozedCount === 1 ? "" : "n"
              } warten auf ihre Erinnerung. Klick auf den Button unten um sie trotzdem zu sehen.`}
            />
          )}
          {groupByDate(visibleEntries).map((group) => (
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
              <div className="space-y-2">
                {group.tasks.map((t) => (
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
                    buildMailto={buildMailto}
                    buildOutlookDesktopLink={buildOutlookDesktopLink}
                  />
                ))}
              </div>
            </section>
          ))}
          {snoozedCount > 0 && (
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
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card/40 px-3 py-2">
      <div className="relative">
        <Search
          size={14}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none"
        />
        <Input
          placeholder="Suche…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56 h-8 pl-8 text-sm"
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

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-muted-foreground ml-auto"
          onClick={() => {
            setSearch("");
            setStatusFilter(defaultStatus);
            setPrioFilter("all");
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
  buildMailto,
  buildOutlookDesktopLink,
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
  buildMailto: (task: MailTask) => string | null;
  buildOutlookDesktopLink: (task: MailTask) => string | null;
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
        className="w-full text-left pl-5 pr-4 py-4 flex items-start gap-3.5"
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
          <div className="flex items-baseline justify-between gap-3">
            <h3
              className={`text-[15px] font-semibold leading-snug truncate ${
                isDone ? "line-through" : ""
              }`}
            >
              {t.title}
            </h3>
            <span
              className="text-[11px] tabular-nums text-muted-foreground whitespace-nowrap shrink-0"
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
          </div>

          {/* Sender / project line */}
          <SourceInfo task={t} onSenderClick={onSenderClick} />

          {/* Body preview — bullets werden als Liste gerendert wenn vorhanden */}
          {t.body && !expanded && <DescriptionBody text={t.body} clamp />}

          {/* Meta row: prio + due + status */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {prio && (
              <span
                className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full ${prio.badge}`}
              >
                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${prio.dot}`} />
                {prio.label}
              </span>
            )}
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

      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t bg-gradient-to-b from-muted/30 to-muted/10 px-5 py-4 space-y-4">
            {t.body && <DescriptionBody text={t.body} />}
            {/* Projekt-Pulse: zeigt letzte 5 Logbuch-Eintraege des Hero-Projekts,
             *  falls verknuepft. Nur fuer Hero-source-Tasks aktiv (da haben wir
             *  die hero_project_id). */}
            {t.source === "hero" && t.hero_project_id && (
              <ProjectActivityStrip projectId={t.hero_project_id} />
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
              />
            )}
            {/* Composer: Antwort tippen / KI-Entwurf / Notiz speichern / Outlook-Reply.
             *  Item 1.1 + 1.3 + 2.1 aus Feature-Roadmap. Nur fuer Mail-Tasks,
             *  nicht Infos (lesen) und nicht Hero (read-only). */}
            {t.source === "mail" && tab !== "infos" && (
              <TaskComposer
                taskId={t.id}
                mailto={mailto}
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
        <span className="truncate max-w-[260px]">
          {task.hero_project_number
            ? `${task.hero_project_number}${task.hero_project_name ? " · " + task.hero_project_name : ""}`
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
        <span className="truncate max-w-[260px] group-hover:underline decoration-dotted underline-offset-2">
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
