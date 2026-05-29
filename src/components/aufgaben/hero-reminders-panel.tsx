"use client";

import { useEffect, useState } from "react";
import { Bell, Check, Clock, RefreshCw } from "lucide-react";

interface HeroReminder {
  id: string;
  title: string | null;
  description: string | null;
  event_start: string | null;
  event_end: string | null;
  all_day: boolean | null;
  is_done: boolean | null;
  category_name: string | null;
  reminder_at: string | null;
  reminder_note: string | null;
}

/**
 * Hero-Erinnerungen Inline-Panel.
 *
 * Zeigt bevorstehende Hero-Calendar-Events + Erinnerungen fuer das
 * verknuepfte Projekt direkt im Detail-Pane an. So sieht der User
 * was in Hero geplant ist ohne dort zu wechseln.
 *
 * Quelle: GET /api/hero/reminders?projectId=X
 */
export function HeroRemindersPanel({
  heroProjectId,
  projectNumber,
  maxItems = 8,
}: {
  heroProjectId: string;
  projectNumber?: string | null;
  maxItems?: number;
}) {
  const [reminders, setReminders] = useState<HeroReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // setState im Effect: Sync mit Fetch-Lifecycle, bewusst gewollt.
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    fetch(
      `/api/hero/reminders?projectId=${encodeURIComponent(heroProjectId)}&limit=${maxItems}`,
      { cache: "no-store" },
    )
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j?.error ?? `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((j) => {
        if (cancelled) return;
        const arr = Array.isArray(j?.reminders) ? (j.reminders as HeroReminder[]) : [];
        setReminders(arr);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Erinnerungen konnten nicht geladen werden");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [heroProjectId, maxItems, refreshKey]);

  // Wenn nichts da ist UND kein Fehler -> Panel verstecken (keine Leer-Box)
  if (!loading && !error && reminders.length === 0) return null;

  return (
    <section className="rounded-lg border border-amber-200/40 dark:border-amber-900/30 bg-amber-50/30 dark:bg-amber-950/20 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[12px] font-semibold text-amber-700 dark:text-amber-400 inline-flex items-center gap-1.5">
          <Bell size={11} />
          Hero-Erinnerungen
          {projectNumber && (
            <span className="font-mono text-[11px] opacity-70">{projectNumber}</span>
          )}
        </h4>
        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={loading}
          className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted/60 transition-colors disabled:opacity-50"
          title="Erinnerungen neu laden"
        >
          <RefreshCw size={10} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {loading && reminders.length === 0 && (
        <p className="text-[11px] text-muted-foreground italic">Laedt Erinnerungen…</p>
      )}

      {error && (
        <p className="text-[11px] text-rose-600 dark:text-rose-400" title={error}>
          Fehler: {error.slice(0, 100)}
        </p>
      )}

      {reminders.length > 0 && (
        <ul className="space-y-1.5">
          {reminders.map((r) => (
            <ReminderItem key={r.id} reminder={r} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ReminderItem({ reminder }: { reminder: HeroReminder }) {
  const isDone = reminder.is_done === true;
  const hasReminder = Boolean(reminder.reminder_at);
  const eventStart = reminder.event_start ? new Date(reminder.event_start) : null;
  const reminderAt = reminder.reminder_at ? new Date(reminder.reminder_at) : null;
  // Vergleich gegen "now" ist semantisch impure — wir nehmen es bewusst in
  // Kauf weil die Erinnerungs-Liste bei Mount/Refetch ohnehin neu rendert.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  // "naechste relevante Zeit" — bevorzugt reminder_at, sonst event_start
  const primaryTime = reminderAt ?? eventStart;
  const isPast = primaryTime ? primaryTime.getTime() < now : false;
  const isSoon =
    primaryTime &&
    !isPast &&
    primaryTime.getTime() - now < 24 * 60 * 60 * 1000; // < 24h

  return (
    <li
      className={`text-[11px] leading-snug border-l-2 pl-2 py-0.5 ${
        isDone
          ? "border-emerald-300/60 dark:border-emerald-800/60 opacity-60"
          : isSoon
            ? "border-rose-400 dark:border-rose-700"
            : "border-amber-300/60 dark:border-amber-800/60"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium text-foreground/90 truncate inline-flex items-center gap-1">
          {isDone && <Check size={10} className="text-emerald-500" />}
          {reminder.title || reminder.category_name || "Hero-Termin"}
        </span>
        {primaryTime && (
          <span
            className={`text-[10px] tabular-nums shrink-0 inline-flex items-center gap-0.5 ${
              isSoon
                ? "text-rose-600 dark:text-rose-400 font-medium"
                : "text-muted-foreground"
            }`}
            title={primaryTime.toLocaleString("de-AT")}
          >
            <Clock size={9} />
            {formatRelative(primaryTime)}
          </span>
        )}
      </div>
      {(reminder.reminder_note || reminder.description) && (
        <p className="text-foreground/70 break-words mt-0.5 line-clamp-2">
          {(reminder.reminder_note || reminder.description || "").replace(/<[^>]+>/g, "")}
        </p>
      )}
      {hasReminder && eventStart && reminderAt && (
        <span className="text-[10px] text-muted-foreground/80 italic">
          Erinnerung {formatRelative(reminderAt)} · Termin {formatRelative(eventStart)}
        </span>
      )}
    </li>
  );
}

function formatRelative(d: Date): string {
  const diffMs = d.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const sec = abs / 1000;
  const min = sec / 60;
  const hour = min / 60;
  const day = hour / 24;
  const past = diffMs < 0;

  let label: string;
  if (day >= 7) label = d.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "2-digit" });
  else if (day >= 1) label = `${Math.round(day)} Tag${Math.round(day) === 1 ? "" : "e"}`;
  else if (hour >= 1) label = `${Math.round(hour)} Std`;
  else if (min >= 1) label = `${Math.round(min)} Min`;
  else label = "jetzt";

  if (label === "jetzt") return label;
  return past ? `vor ${label}` : `in ${label}`;
}
