import { AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";

export interface DataErrorEntry {
  /** Was hat nicht geladen — Kurzlabel. */
  source: string;
  /** Optionaler Detail-Text (z.B. Error-Message vom Server). */
  detail?: string | null;
}

interface DataErrorBannerProps {
  errors: DataErrorEntry[];
  /** Zusatzhinweis falls einer angezeigt werden soll. */
  hint?: string;
  className?: string;
}

/**
 * Zentraler Roter Balken oben auf der Seite. Wird gerendert wenn einer
 * oder mehrere Loader fehlgeschlagen sind. Macht klar dass die unten
 * angezeigten Zahlen NICHT der vollstaendige Stand sein koennen, statt
 * dass der User stillschweigend "0" sieht und faelschlich denkt es waere
 * tatsaechlich nichts da.
 */
export function DataErrorBanner({
  errors,
  hint,
  className,
}: DataErrorBannerProps) {
  if (errors.length === 0) return null;

  return (
    <div
      role="alert"
      className={cn(
        "relative overflow-hidden rounded-xl border border-destructive/30 bg-gradient-to-br from-destructive/10 via-destructive/5 to-transparent px-4 py-3.5 text-sm shadow-sm",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 grid place-items-center w-9 h-9 rounded-lg bg-destructive/15 ring-1 ring-destructive/20">
          <AlertTriangle className="h-4.5 w-4.5 text-destructive" />
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <p className="font-semibold text-destructive leading-tight">
            {errors.length === 1
              ? "Eine Datenquelle konnte nicht geladen werden"
              : `${errors.length} Datenquellen konnten nicht geladen werden`}
            {" — die Zahlen unten sind unvollständig."}
          </p>
          <ul className="text-xs text-destructive/90 space-y-1">
            {errors.map((e, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="inline-block w-1 h-1 rounded-full bg-destructive/50 mt-1.5 shrink-0" />
                <span>
                  <span className="font-medium">{e.source}</span>
                  {e.detail ? (
                    <span className="text-destructive/70"> — {e.detail}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          {hint ? (
            <p className="text-xs text-destructive/80 pt-1">{hint}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
