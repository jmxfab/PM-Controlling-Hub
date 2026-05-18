"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight, Clock3, Loader2 } from "lucide-react";

interface ProjectActivityEntry {
  id: string;
  date: string;
  text: string;
  author: string | null;
  eventType: string | null;
}

interface ProjectActivity {
  projectId: string;
  projectNumber: string | null;
  currentStep: string | null;
  isFinished: boolean;
  lastEventAt: string | null;
  events30d: number;
  entries: ProjectActivityEntry[];
}

interface Props {
  projectId: string;
}

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diffH = (Date.now() - t) / 3_600_000;
  if (diffH < 1) return "gerade eben";
  if (diffH < 24) return `vor ${Math.round(diffH)} Std`;
  const diffD = Math.round(diffH / 24);
  if (diffD === 1) return "gestern";
  if (diffD < 14) return `vor ${diffD} Tagen`;
  return new Date(iso).toLocaleDateString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

/**
 * Project-Pulse fuer expanded TaskCard: zeigt letzte Logbuch-Eintraege
 * des verknüpften Hero-Projekts. Wird gelazy-loadet beim Mount.
 */
export function ProjectActivityStrip({ projectId }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProjectActivity | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/project-activity/${encodeURIComponent(projectId)}?limit=5`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error ?? `Fehler ${res.status}`);
          return;
        }
        setData(json as ProjectActivity);
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
  }, [projectId]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card/40 p-3 flex items-center gap-2 text-[12px] text-muted-foreground">
        <Loader2 size={12} className="animate-spin" />
        Lade Projekt-Aktivität…
      </div>
    );
  }
  if (error || !data) {
    return null; // silently skip — kein Showstopper
  }
  if (data.entries.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border bg-card/40 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          <Activity size={11} className="text-blue-500" />
          Projekt-Aktivität
          {data.projectNumber && (
            <span className="font-mono normal-case tracking-normal text-muted-foreground/60">
              · {data.projectNumber}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] tabular-nums text-muted-foreground">
          {data.lastEventAt && (
            <span className="inline-flex items-center gap-1" title={data.lastEventAt}>
              <Clock3 size={11} className="opacity-60" />
              {relTime(data.lastEventAt)}
            </span>
          )}
          {data.events30d > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <span className="font-semibold text-foreground">{data.events30d}</span>
              Events / 30 Tg.
            </span>
          )}
          <Link
            href={`/logbuch?project_id=${encodeURIComponent(data.projectId)}`}
            className="inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-400 hover:underline decoration-dotted underline-offset-2"
            title="Alle Eintraege im Logbuch oeffnen"
          >
            Logbuch <ArrowRight size={10} />
          </Link>
        </div>
      </div>
      {data.currentStep && (
        <div className="text-[11px]">
          <span className="text-muted-foreground">Aktueller Step: </span>
          <span
            className={`font-medium ${
              data.isFinished
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-foreground"
            }`}
          >
            {data.currentStep}
          </span>
        </div>
      )}
      <ul className="space-y-1.5">
        {data.entries.map((e) => (
          <li key={e.id} className="flex gap-2 text-[12.5px] leading-snug">
            <span
              aria-hidden
              className="mt-[7px] shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500/70"
            />
            <div className="flex-1 min-w-0">
              <div className="text-foreground/90">{e.text}</div>
              <div className="text-[10.5px] text-muted-foreground tabular-nums mt-0.5">
                {relTime(e.date)}
                {e.author ? <span> · {e.author}</span> : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
