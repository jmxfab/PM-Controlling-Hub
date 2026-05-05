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
        "rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 space-y-1">
          <p className="font-semibold text-destructive">
            {errors.length === 1
              ? "Eine Datenquelle konnte nicht geladen werden"
              : `${errors.length} Datenquellen konnten nicht geladen werden`}
            {" — die Zahlen unten sind unvollständig."}
          </p>
          <ul className="text-xs text-destructive/90 space-y-0.5">
            {errors.map((e, i) => (
              <li key={i}>
                <span className="font-medium">{e.source}</span>
                {e.detail ? (
                  <span className="text-destructive/70"> — {e.detail}</span>
                ) : null}
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
