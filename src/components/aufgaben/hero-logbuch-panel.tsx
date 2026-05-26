"use client";

import { useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";

interface LogbuchEntryLite {
  id: string;
  entry_date: string | null;
  event_type: string | null;
  user_email: string | null;
  author_name: string | null;
  custom_text: string | null;
  custom_title: string | null;
  description: string | null;
}

/**
 * Hero-Logbuch-Inline-Panel.
 *
 * Zeigt die letzten N Logbuch-Eintraege eines Hero-Projekts direkt im
 * Aufgaben-Detail-Pane an — ohne dass der User in Hero wechseln muss.
 *
 * Quelle: GET /api/logbuch?project_id=X&page_size=N
 *
 * - Lazy fetch on mount + refetch wenn heroProjectId wechselt
 * - Refresh-Button fuer manuelles Re-Fetch
 * - Empty + Error States
 * - Deep-Link zu Hero (falls heroProjectHref gesetzt)
 */
export function HeroLogbuchPanel({
  heroProjectId,
  heroProjectHref,
  projectNumber,
  maxEntries = 10,
}: {
  heroProjectId: string;
  heroProjectHref?: string | null;
  projectNumber?: string | null;
  maxEntries?: number;
}) {
  const [entries, setEntries] = useState<LogbuchEntryLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(
      `/api/logbuch?project_id=${encodeURIComponent(heroProjectId)}&page_size=${maxEntries}`,
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
        const arr = Array.isArray(j?.entries) ? (j.entries as LogbuchEntryLite[]) : [];
        setEntries(arr);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Logbuch konnte nicht geladen werden");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [heroProjectId, maxEntries, refreshKey]);

  return (
    <section className="rounded-lg border border-emerald-200/40 dark:border-emerald-900/30 bg-emerald-50/30 dark:bg-emerald-950/20 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Hero-Logbuch
          {projectNumber && (
            <span className="font-mono text-[11px] opacity-70">{projectNumber}</span>
          )}
        </h4>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
            className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted/60 transition-colors disabled:opacity-50"
            title="Logbuch neu laden"
          >
            <RefreshCw size={10} className={loading ? "animate-spin" : ""} />
          </button>
          {heroProjectHref && (
            <a
              href={heroProjectHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-0.5 px-1.5 py-0.5"
              title="Projekt in Hero oeffnen"
            >
              <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>

      {loading && entries.length === 0 && (
        <p className="text-[11px] text-muted-foreground italic">Laedt Logbuch…</p>
      )}

      {error && (
        <p className="text-[11px] text-rose-600 dark:text-rose-400" title={error}>
          Fehler: {error.slice(0, 100)}
        </p>
      )}

      {!loading && !error && entries.length === 0 && (
        <p className="text-[11px] text-muted-foreground italic">
          Noch keine Logbuch-Eintraege fuer dieses Projekt.
        </p>
      )}

      {entries.length > 0 && (
        <ul className="space-y-1.5">
          {entries.map((e) => (
            <LogEntryItem key={e.id} entry={e} />
          ))}
        </ul>
      )}
    </section>
  );
}

function LogEntryItem({ entry }: { entry: LogbuchEntryLite }) {
  const date = entry.entry_date ? formatShortDate(entry.entry_date) : "—";
  const author = entry.author_name || entry.user_email?.split("@")[0] || null;
  // custom_text kann HTML enthalten (<br>, <i>). Wir konvertieren <br> in
  // Zeilenumbrueche und strippen den Rest fuer plain-Text Darstellung.
  const text = formatLogText(entry.custom_text || entry.description || "");
  const title = entry.custom_title || null;
  return (
    <li className="text-[11px] leading-snug border-l-2 border-emerald-300/60 dark:border-emerald-800/60 pl-2 py-0.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium text-foreground/90 truncate">
          {title || (entry.event_type ?? "Eintrag")}
        </span>
        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
          {date}
        </span>
      </div>
      {text && (
        <p className="text-foreground/70 whitespace-pre-wrap break-words mt-0.5 line-clamp-3">
          {text}
        </p>
      )}
      {author && (
        <span className="text-[10px] text-muted-foreground/80 italic">— {author}</span>
      )}
    </li>
  );
}

function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const year = d.getFullYear().toString().slice(2);
    return `${day}.${month}.${year}`;
  } catch {
    return iso.slice(0, 10);
  }
}

function formatLogText(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}
