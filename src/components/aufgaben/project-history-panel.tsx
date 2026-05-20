"use client";

import { useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  RefreshCw,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProjectHistoryResult } from "@/app/api/mail-tasks/[id]/project-history/route";

interface Props {
  taskId: string;
  projectNumber?: string | null;
  projectName?: string | null;
}

const STATUS_CONFIG = {
  on_track: {
    label: "Im Plan",
    icon: CheckCircle2,
    cls: "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40",
    dot: "bg-emerald-500",
  },
  attention: {
    label: "Aufmerksamkeit",
    icon: AlertTriangle,
    cls: "text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/40",
    dot: "bg-amber-500",
  },
  blocked: {
    label: "Blockiert",
    icon: XCircle,
    cls: "text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-950/40",
    dot: "bg-rose-500",
  },
} as const;

function formatDate(iso: string | null): string {
  if (!iso) return "?";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "?";
  const now = new Date();
  const diffD = Math.round((now.getTime() - d.getTime()) / 86400000);
  if (diffD === 0) return "heute";
  if (diffD === 1) return "gestern";
  if (diffD < 7) return `vor ${diffD} Tagen`;
  return d.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function ProjectHistoryPanel({ taskId, projectNumber, projectName }: Props) {
  const [data, setData] = useState<ProjectHistoryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/mail-tasks/${taskId}/project-history`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? `Fehler ${res.status}`);
        return;
      }
      setData(json as ProjectHistoryResult);
      setExpanded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setLoading(false);
    }
  }

  const projectLabel = projectNumber
    ? `${projectNumber}${projectName ? ` · ${projectName}` : ""}`
    : (projectName ?? "Hero-Projekt");

  if (!data && !loading && !error) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); void load(); }}
        className="w-full flex items-center gap-1.5 text-[10.5px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-md border border-border/50 hover:border-purple-400/50 hover:bg-purple-50/30 dark:hover:bg-purple-950/20"
      >
        <BookOpen size={11} className="text-purple-500 shrink-0" />
        <span>Projektverlauf laden</span>
        <span className="ml-auto text-[9.5px] opacity-50 font-medium">{projectLabel}</span>
      </button>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground px-2 py-1.5">
        <Loader2 size={11} className="animate-spin text-purple-500" />
        <span>Projektverlauf wird analysiert…</span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-center gap-1.5 text-[10.5px] text-rose-600 dark:text-rose-400 px-2 py-1">
        <AlertTriangle size={11} />
        <span>{error}</span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); void load(); }}
          className="ml-auto underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { analysis, entries, total } = data;
  const visibleEntries = showAll ? entries : entries.slice(0, 5);
  const statusCfg = analysis ? STATUS_CONFIG[analysis.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.on_track : null;

  return (
    <div
      className="rounded-md border border-purple-200/60 dark:border-purple-900/40 bg-purple-50/30 dark:bg-purple-950/10 overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <button
        type="button"
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[10.5px] text-muted-foreground hover:bg-purple-50/50 dark:hover:bg-purple-950/20 transition-colors"
        onClick={() => setExpanded((s) => !s)}
      >
        <BookOpen size={11} className="text-purple-500 shrink-0" />
        <span className="font-medium text-foreground/80">Projektverlauf</span>
        <span className="text-[9.5px] opacity-60">{projectLabel}</span>
        {statusCfg && (
          <span className={`ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${statusCfg.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
            {statusCfg.label}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); void load(); }}
            title="Neu laden"
            className="p-0.5 rounded hover:bg-purple-100 dark:hover:bg-purple-900/40"
          >
            <RefreshCw size={9} className={loading ? "animate-spin" : ""} />
          </button>
          {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </div>
      </button>

      {expanded && (
        <div className="px-2 pb-2 space-y-2 border-t border-purple-200/40 dark:border-purple-900/30 pt-1.5">
          {/* KI-Analyse */}
          {analysis && (
            <div className="rounded-md bg-background/60 border border-border/40 p-2 space-y-1">
              <div className="flex items-center gap-1 text-[9.5px] font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                <Sparkles size={9} />
                KI-Analyse
              </div>
              <p className="text-[11.5px] text-foreground/90 leading-relaxed">
                {analysis.summary}
              </p>
              {analysis.nextStep && (
                <div className="mt-1 rounded bg-purple-100/60 dark:bg-purple-900/30 px-2 py-1 text-[11px] text-purple-800 dark:text-purple-300">
                  <span className="font-semibold">Nächster Schritt:</span>{" "}
                  {analysis.nextStep}
                </div>
              )}
            </div>
          )}

          {/* Timeline */}
          {entries.length === 0 ? (
            <p className="text-[10.5px] text-muted-foreground text-center py-2">
              Keine Logbuch-Einträge gefunden
            </p>
          ) : (
            <div className="space-y-1">
              {visibleEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex gap-2 text-[10.5px]"
                >
                  <div className="flex flex-col items-center pt-1 shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400/60 dark:bg-purple-600/60" />
                    <div className="w-px flex-1 bg-purple-200/40 dark:bg-purple-800/30 mt-0.5" />
                  </div>
                  <div className="pb-1.5 flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="font-medium text-foreground/80 truncate max-w-[160px]">
                        {entry.custom_title ?? entry.event_type ?? "Eintrag"}
                      </span>
                      <span className="text-muted-foreground/70 shrink-0 inline-flex items-center gap-0.5">
                        <Clock size={8} />
                        {formatDate(entry.entry_date)}
                      </span>
                      {entry.author_name && (
                        <span className="text-[9.5px] text-muted-foreground/60 truncate">
                          · {entry.author_name}
                        </span>
                      )}
                    </div>
                    {entry.custom_text && (
                      <p className="text-[10px] text-muted-foreground/70 leading-relaxed line-clamp-2 mt-0.5">
                        {entry.custom_text}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {entries.length > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAll((s) => !s)}
                  className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline pl-4"
                >
                  {showAll
                    ? "weniger anzeigen"
                    : `+ ${entries.length - 5} ältere Einträge (${total} gesamt)`}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
