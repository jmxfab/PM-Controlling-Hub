"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Clock, X, ExternalLink, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cleanHeroProjectName } from "@/components/aufgaben/task-utils";

interface ProjectReminder {
  id: string;
  hero_project_id: string;
  hero_project_number: string | null;
  hero_project_name: string | null;
  title: string;
  note: string | null;
  remind_at: string;
  dismissed_at: string | null;
  snoozed_count: number;
  created_at: string;
  created_by_email: string | null;
}

const SNOOZE_QUICKPICKS = [
  { days: 1, label: "+1 Tag" },
  { days: 3, label: "+3 Tage" },
  { days: 7, label: "+1 Woche" },
] as const;

/**
 * Erinnerungs-Panel fuer Hero-Projekte.
 *
 * Sektionen:
 *  - "Faellig" (rot): remind_at <= NOW, nicht dismissed
 *  - "Kommend" (neutral): remind_at > NOW, nicht dismissed
 *
 * Aktionen pro Karte:
 *  - X (dismiss): markiert als erledigt, verschwindet
 *  - Erneut erinnern: Quickpicks (+1/+3/+7 Tage) + Freifeld in Tagen
 */
export function ProjectRemindersPanel({
  heroProjectLinkTemplate,
}: {
  heroProjectLinkTemplate?: string | null;
}) {
  const [reminders, setReminders] = useState<ProjectReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snoozeOpenId, setSnoozeOpenId] = useState<string | null>(null);
  const [customDays, setCustomDays] = useState<string>("");

  const fetchReminders = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/project-reminders?scope=active", {
        cache: "no-store",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? `HTTP ${res.status}`);
      }
      const j = await res.json();
      setReminders((j.reminders ?? []) as ProjectReminder[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Konnte Erinnerungen nicht laden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  async function dismiss(id: string) {
    // Optimistic: sofort lokal entfernen
    setReminders((cur) => cur.filter((r) => r.id !== id));
    try {
      await fetch(`/api/project-reminders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismissed: true }),
      });
    } catch {
      // Bei Fehler: neu laden
      fetchReminders();
    }
  }

  async function snooze(id: string, days: number) {
    setSnoozeOpenId(null);
    setCustomDays("");
    setReminders((cur) => cur.filter((r) => r.id !== id));
    try {
      await fetch(`/api/project-reminders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snooze_days: days }),
      });
    } catch {
      fetchReminders();
    }
  }

  if (loading && reminders.length === 0) return null;
  if (error) {
    return (
      <section className="rounded-lg border border-rose-200 bg-rose-50/40 dark:border-rose-900/40 dark:bg-rose-950/20 p-3 text-[12px] text-rose-700 dark:text-rose-300">
        Erinnerungen konnten nicht geladen werden: {error}
      </section>
    );
  }
  if (reminders.length === 0) return null;

  const now = Date.now();
  const overdue = reminders.filter((r) => new Date(r.remind_at).getTime() <= now);
  const upcoming = reminders.filter((r) => new Date(r.remind_at).getTime() > now);

  return (
    <section className="space-y-3">
      {overdue.length > 0 && (
        <div className="rounded-2xl border border-rose-300/60 bg-gradient-to-br from-rose-50 via-orange-50/40 to-white dark:from-rose-950/30 dark:via-orange-950/20 dark:to-card/40 dark:border-rose-700/40 p-3 space-y-2 shadow-[0_4px_24px_-4px_hsl(0_84%_55%/0.25)]">
          <div className="flex items-center gap-2 px-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
              <Bell size={12} />
              Fällig heute oder überfällig
            </span>
            <span className="text-[10px] text-muted-foreground/70 font-medium">
              {overdue.length} {overdue.length === 1 ? "Erinnerung" : "Erinnerungen"}
            </span>
            <div className="flex-1 h-px bg-rose-300/40 dark:bg-rose-700/30 ml-2" />
          </div>
          <div className="space-y-2">
            {overdue.map((r) => (
              <ReminderCard
                key={r.id}
                reminder={r}
                heroProjectLinkTemplate={heroProjectLinkTemplate}
                overdue
                snoozeOpen={snoozeOpenId === r.id}
                onOpenSnooze={() => setSnoozeOpenId(r.id)}
                onCloseSnooze={() => {
                  setSnoozeOpenId(null);
                  setCustomDays("");
                }}
                onDismiss={() => dismiss(r.id)}
                onSnooze={(days) => snooze(r.id, days)}
                customDays={snoozeOpenId === r.id ? customDays : ""}
                setCustomDays={setCustomDays}
              />
            ))}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="rounded-2xl border border-border bg-card/40 p-3 space-y-2">
          <div className="flex items-center gap-2 px-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Calendar size={12} />
              Kommende Erinnerungen
            </span>
            <span className="text-[10px] text-muted-foreground/70 font-medium">
              {upcoming.length}
            </span>
            <div className="flex-1 h-px bg-border/60 ml-2" />
          </div>
          <div className="space-y-2">
            {upcoming.map((r) => (
              <ReminderCard
                key={r.id}
                reminder={r}
                heroProjectLinkTemplate={heroProjectLinkTemplate}
                snoozeOpen={snoozeOpenId === r.id}
                onOpenSnooze={() => setSnoozeOpenId(r.id)}
                onCloseSnooze={() => {
                  setSnoozeOpenId(null);
                  setCustomDays("");
                }}
                onDismiss={() => dismiss(r.id)}
                onSnooze={(days) => snooze(r.id, days)}
                customDays={snoozeOpenId === r.id ? customDays : ""}
                setCustomDays={setCustomDays}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ReminderCard({
  reminder: r,
  heroProjectLinkTemplate,
  overdue = false,
  snoozeOpen,
  onOpenSnooze,
  onCloseSnooze,
  onDismiss,
  onSnooze,
  customDays,
  setCustomDays,
}: {
  reminder: ProjectReminder;
  heroProjectLinkTemplate?: string | null;
  overdue?: boolean;
  snoozeOpen: boolean;
  onOpenSnooze: () => void;
  onCloseSnooze: () => void;
  onDismiss: () => void;
  onSnooze: (days: number) => void;
  customDays: string;
  setCustomDays: (v: string) => void;
}) {
  const remindAt = new Date(r.remind_at);
  const dateText = remindAt.toLocaleDateString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
  const timeText = remindAt.toLocaleTimeString("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const heroHref =
    heroProjectLinkTemplate
      ? heroProjectLinkTemplate
          .replace("{projectId}", r.hero_project_id)
          .replace("{projectNumber}", r.hero_project_number ?? "")
      : null;

  return (
    <div
      className={`group rounded-xl border bg-card transition-all ${
        overdue
          ? "border-rose-200/70 dark:border-rose-800/40 shadow-sm"
          : "border-border/60"
      }`}
    >
      <div className="flex items-start gap-3 px-3 py-2.5">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13.5px] font-semibold truncate">{r.title}</span>
            {r.hero_project_number && (
              <a
                href={heroHref ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => !heroHref && e.preventDefault()}
                className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                title="In Hero öffnen"
              >
                {r.hero_project_number}
                {heroHref && <ExternalLink size={9} className="opacity-60" />}
              </a>
            )}
            {r.snoozed_count > 0 && (
              <span
                className="text-[10px] text-muted-foreground/70"
                title={`${r.snoozed_count}× verschoben`}
              >
                ↺{r.snoozed_count}
              </span>
            )}
          </div>
          {r.note && (
            <p className="text-[12px] text-foreground/70 line-clamp-2 leading-snug">
              {r.note}
            </p>
          )}
          <div className="flex items-center gap-3 text-[10.5px] text-muted-foreground tabular-nums">
            <span className="inline-flex items-center gap-1">
              <Clock size={10} />
              {dateText} {!r.note ? timeText : ""}
            </span>
            {(() => {
              // Hero liefert oft Muell-Platzhalter wie "-9678 | --, --, --"
              // — cleanHeroProjectName entfernt die.
              const clean = cleanHeroProjectName(r.hero_project_name, r.hero_project_number);
              return clean ? <span className="truncate opacity-70">{clean}</span> : null;
            })()}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!snoozeOpen ? (
            <>
              <button
                type="button"
                onClick={onOpenSnooze}
                className="inline-flex items-center gap-1 h-7 px-2 text-[10.5px] rounded-md border border-border bg-background hover:bg-muted/60 transition-colors"
                title="Erneut erinnern"
              >
                <BellOff size={11} /> Snooze
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="grid place-items-center w-7 h-7 rounded-md text-muted-foreground/60 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                title="Erinnerung weg (kann nicht direkt rueckgaengig)"
                aria-label="Erinnerung schliessen"
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onCloseSnooze}
              className="grid place-items-center w-7 h-7 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 transition-colors"
              aria-label="Snooze-Auswahl schliessen"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {snoozeOpen && (
        <div className="border-t border-border/60 px-3 py-2.5 bg-muted/20 space-y-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground/80 font-semibold mr-1">
              Erneut erinnern in
            </span>
            {SNOOZE_QUICKPICKS.map((q) => (
              <Button
                key={q.days}
                size="sm"
                variant="outline"
                className="h-7 text-[11px] px-2.5"
                onClick={() => onSnooze(q.days)}
              >
                {q.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={365}
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
              placeholder="z.B. 14"
              className="h-7 w-20 text-[12px]"
            />
            <span className="text-[11px] text-muted-foreground">Tage</span>
            <Button
              size="sm"
              variant="default"
              className="h-7 text-[11px]"
              disabled={!customDays || isNaN(Number(customDays))}
              onClick={() => {
                const n = Number(customDays);
                if (Number.isFinite(n) && n > 0 && n <= 365) onSnooze(n);
              }}
            >
              Setzen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
