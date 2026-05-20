"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Check,
  Clock3,
  History,
  Loader2,
  Mail,
  User,
} from "lucide-react";

interface HistoryEntry {
  id: string;
  title: string;
  created_at: string;
  status: string;
  priority: string | null;
  mail_category: string | null;
  thread_message_count: number;
  due_date: string | null;
}

interface HistoryResponse {
  email: string;
  days: number;
  total: number;
  entries: HistoryEntry[];
}

interface Props {
  email: string | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}

const RANGE_OPTIONS = [
  { days: 30, label: "30 Tage" },
  { days: 90, label: "90 Tage" },
  { days: 365, label: "1 Jahr" },
] as const;

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diffH = (Date.now() - d.getTime()) / 3_600_000;
  if (diffH < 1) return "gerade eben";
  if (diffH < 24) return `vor ${Math.round(diffH)} Std`;
  const diffD = Math.round(diffH / 24);
  if (diffD === 1) return "gestern";
  if (diffD < 14) return `vor ${diffD} Tagen`;
  return d.toLocaleDateString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

const CATEGORY_LABELS: Record<string, { label: string; cls: string }> = {
  kritisch: {
    label: "Kritisch",
    cls: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300",
  },
  dringend: {
    label: "Dringend",
    cls: "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-300",
  },
  aufgabe: {
    label: "Aufgabe",
    cls: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300",
  },
  info: {
    label: "Info",
    cls: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  rechnung: {
    label: "Rechnung",
    cls: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
  },
  bestellung: {
    label: "Bestellung",
    cls: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
  },
  inbox: {
    label: "Inbox",
    cls: "bg-slate-100 text-slate-700 ring-slate-300 dark:bg-slate-800 dark:text-slate-300",
  },
};

/**
 * Modal mit allen Tasks eines bestimmten Absenders. Wird vom Sender-Klick
 * im TaskCard geoeffnet. Zeigt 30/90/365-Tage-Fenster + Counts.
 */
export function SenderHistoryDialog({ email, open, onOpenChange }: Props) {
  const router = useRouter();
  function jumpToTask(taskId: string) {
    onOpenChange(false);
    // URL-Parameter focusTask wird vom Aufgaben-View ausgewertet (siehe
    // useSearchParams) — die entsprechende Karte wird auto-expanded.
    router.push(`/aufgaben?focusTask=${encodeURIComponent(taskId)}`);
  }
  const [days, setDays] = useState<30 | 90 | 365>(90);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<HistoryResponse | null>(null);

  useEffect(() => {
    if (!open || !email) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    fetch(`/api/mail-tasks/history?email=${encodeURIComponent(email)}&days=${days}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error ?? `Fehler ${res.status}`);
          return;
        }
        setData(json as HistoryResponse);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [email, days, open]);

  const openCount =
    data?.entries.filter((e) => e.status !== "done").length ?? 0;
  const doneCount = data?.entries.filter((e) => e.status === "done").length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl rounded-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="shrink-0 grid place-items-center w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400">
              <User size={18} />
            </div>
            <div className="space-y-0.5 flex-1 min-w-0">
              <DialogTitle className="text-lg font-bold tracking-tight truncate">
                {email ?? "—"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Verlauf aller Mail-Aufgaben dieses Absenders
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Filter-Pills */}
        <div className="flex items-center gap-1.5 pt-2 pb-1">
          {RANGE_OPTIONS.map((r) => (
            <Button
              key={r.days}
              size="sm"
              variant={days === r.days ? "default" : "outline"}
              className="h-7 text-[11px] px-2.5"
              onClick={() => setDays(r.days)}
            >
              {r.label}
            </Button>
          ))}
          {data && !loading && (
            <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground tabular-nums">
              <span className="inline-flex items-center gap-1">
                <Mail size={11} />
                {data.total}
              </span>
              {openCount > 0 && (
                <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                  <Clock3 size={11} />
                  {openCount} offen
                </span>
              )}
              {doneCount > 0 && (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <Check size={11} />
                  {doneCount} erledigt
                </span>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto -mx-6 px-6 pt-2 pb-1">
          {loading && (
            <div className="py-8 flex flex-col items-center gap-2 text-muted-foreground text-sm">
              <Loader2 size={18} className="animate-spin" />
              Lade Verlauf…
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-900/40 px-3 py-2 text-sm text-rose-700 dark:text-rose-400 flex items-center gap-2">
              <AlertTriangle size={14} />
              {error}
            </div>
          )}
          {!loading && !error && data && data.entries.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">
              <History
                size={28}
                className="mx-auto mb-3 opacity-40"
                strokeWidth={1.5}
              />
              Keine Aufgaben in den letzten {data.days} Tagen.
            </div>
          )}
          {!loading && !error && data && data.entries.length > 0 && (
            <ul className="space-y-1.5">
              {data.entries.map((e) => {
                const cat = e.mail_category
                  ? CATEGORY_LABELS[e.mail_category]
                  : undefined;
                const isDone = e.status === "done";
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => jumpToTask(e.id)}
                      className={`w-full text-left rounded-xl border bg-card/40 hover:bg-card/80 hover:border-foreground/20 transition-all px-3.5 py-2.5 hover:scale-[1.005] active:scale-100 ${
                        isDone ? "opacity-60" : ""
                      }`}
                      title="Zur Aufgabe springen"
                    >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`shrink-0 mt-1 w-1.5 h-1.5 rounded-full ${
                          isDone
                            ? "bg-emerald-500"
                            : e.priority === "urgent"
                              ? "bg-rose-500"
                              : e.priority === "high"
                                ? "bg-orange-500"
                                : "bg-blue-500"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-[13.5px] font-medium leading-snug truncate ${
                            isDone ? "line-through" : ""
                          }`}
                        >
                          {e.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] tabular-nums">
                          <span className="text-muted-foreground">
                            {formatRelative(e.created_at)}
                          </span>
                          {cat && (
                            <span
                              className={`px-1.5 py-0.5 rounded-full ring-1 font-medium ${cat.cls}`}
                            >
                              {cat.label}
                            </span>
                          )}
                          {e.thread_message_count > 1 && (
                            <span className="px-1.5 py-0.5 rounded-full ring-1 ring-indigo-200 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 dark:ring-indigo-900/40 font-medium inline-flex items-center gap-1">
                              <Mail size={9} /> {e.thread_message_count}
                            </span>
                          )}
                          {isDone && (
                            <span className="px-1.5 py-0.5 rounded-full ring-1 ring-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/40 font-medium inline-flex items-center gap-1">
                              <Check size={9} /> erledigt
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
