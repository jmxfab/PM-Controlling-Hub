import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ArrowRight, Building2, Clock3, CheckCircle2 } from "lucide-react";
import { loadProjectPulse } from "@/lib/supabase/hero-project-activity";

export const metadata: Metadata = {
  title: "Projekt-Pulse | JMX",
  description:
    "Aktivste Projekte der letzten 60 Tage — zeigt was lebt und was stagniert.",
};

export const revalidate = 120;

function relTime(iso: string | null): string {
  if (!iso) return "—";
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

function activityBadge(events30d: number, daysSinceLast: number) {
  if (daysSinceLast <= 3) {
    return {
      label: "Aktiv",
      cls: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/40",
    };
  }
  if (daysSinceLast <= 14) {
    return {
      label: "Bewegt sich",
      cls: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/40",
    };
  }
  if (daysSinceLast <= 30) {
    return {
      label: "Stockt",
      cls: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/40",
    };
  }
  return {
    label: "Eingefroren",
    cls: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900/40",
  };
}

export default async function ProjektePage() {
  const pulses = await loadProjectPulse(24).catch(() => []);

  return (
    <div className="flex-1 space-y-6 p-6 md:p-8 max-w-[1600px] mx-auto">
      <header className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Projekt-Pulse
        </h1>
        <p className="text-sm text-muted-foreground">
          Aktivste Projekte der letzten 60 Tage · sortiert nach letzter Bewegung
        </p>
      </header>

      {pulses.length === 0 ? (
        <div className="rounded-2xl border bg-card/40 p-12 text-center text-sm text-muted-foreground">
          Keine Projekt-Aktivität in den letzten 60 Tagen gefunden.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {pulses.map((p) => {
            const daysSinceLast = p.lastEventAt
              ? (Date.now() - new Date(p.lastEventAt).getTime()) / 86_400_000
              : 9999;
            const badge = activityBadge(p.events30d, daysSinceLast);
            return (
              <article
                key={p.projectId}
                className="rounded-2xl border bg-card/60 hover:bg-card/90 transition-colors p-4 space-y-3"
              >
                {/* Header */}
                <div className="flex items-start gap-2.5">
                  <div className="shrink-0 grid place-items-center w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                    <Building2 size={16} />
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h2 className="text-[14px] font-semibold tracking-tight truncate">
                        {p.customerName ??
                          p.projectName ??
                          p.projectNumber ??
                          "Unbenanntes Projekt"}
                      </h2>
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ring-1 ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                      {p.isFinished && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 size={10} />
                        </span>
                      )}
                    </div>
                    {p.projectNumber && (
                      <div className="text-[11px] font-mono text-muted-foreground/80 tabular-nums">
                        {p.projectNumber}
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats + Step */}
                <div className="flex items-center justify-between text-[11px] flex-wrap gap-2 pb-1 border-b border-border/40">
                  {p.currentStep && (
                    <span className="truncate max-w-[60%]">
                      <span className="text-muted-foreground">Step: </span>
                      <span className="font-medium">{p.currentStep}</span>
                    </span>
                  )}
                  <div className="flex items-center gap-2.5 tabular-nums text-muted-foreground shrink-0">
                    <span className="inline-flex items-center gap-1" title={p.lastEventAt ?? ""}>
                      <Clock3 size={10} className="opacity-60" />
                      {relTime(p.lastEventAt)}
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                      <Activity size={10} className="opacity-60" />
                      <span className="font-semibold text-foreground">
                        {p.events30d}
                      </span>{" "}
                      <span className="opacity-70">/30T</span>
                    </span>
                  </div>
                </div>

                {/* Pulse Entries */}
                {p.entries.length > 0 && (
                  <ul className="space-y-1.5">
                    {p.entries.map((e) => (
                      <li
                        key={e.id}
                        className="flex gap-2 text-[12px] leading-snug"
                      >
                        <span
                          aria-hidden
                          className="mt-[6px] shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500/60"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-foreground/85 line-clamp-2">
                            {e.text}
                          </div>
                          <div className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                            {relTime(e.date)}
                            {e.author ? <span> · {e.author}</span> : null}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Cross-Links */}
                <div className="flex items-center gap-2 text-[11px] pt-1">
                  <Link
                    href={`/logbuch?project_id=${encodeURIComponent(p.projectId)}`}
                    className="inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-400 hover:underline decoration-dotted underline-offset-2"
                  >
                    Logbuch <ArrowRight size={10} />
                  </Link>
                  {p.projectNumber && (
                    <Link
                      href={`/aufgaben?search=${encodeURIComponent(p.projectNumber)}`}
                      className="inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-400 hover:underline decoration-dotted underline-offset-2"
                    >
                      Aufgaben <ArrowRight size={10} />
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
