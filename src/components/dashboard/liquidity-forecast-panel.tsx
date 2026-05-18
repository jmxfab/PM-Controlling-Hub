import { AlertTriangle, TrendingUp, Wallet, Info } from "lucide-react";
import type { LiquidityForecast } from "@/lib/supabase/hero-liquidity-forecast";

interface Props {
  forecast: LiquidityForecast | null;
  error?: string | null;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)} M €`;
  }
  if (Math.abs(value) >= 10_000) {
    return `${Math.round(value / 1_000)} k €`;
  }
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Bucket-Stil — Farbe spiegelt Dringlichkeit:
 * overdue=rose (Achtung), in30=amber (zeitnah), in60=blue,
 * in90=indigo, later=slate, noduedate=zinc.
 */
const BUCKET_STYLES: Record<
  string,
  { ring: string; bg: string; text: string; bar: string }
> = {
  overdue: {
    ring: "ring-rose-200 dark:ring-rose-900/50",
    bg: "bg-rose-50 dark:bg-rose-950/30",
    text: "text-rose-700 dark:text-rose-300",
    bar: "bg-gradient-to-r from-rose-500 to-rose-600",
  },
  in30: {
    ring: "ring-amber-200 dark:ring-amber-900/50",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-700 dark:text-amber-300",
    bar: "bg-gradient-to-r from-amber-400 to-orange-500",
  },
  in60: {
    ring: "ring-blue-200 dark:ring-blue-900/50",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    text: "text-blue-700 dark:text-blue-300",
    bar: "bg-gradient-to-r from-blue-400 to-blue-600",
  },
  in90: {
    ring: "ring-indigo-200 dark:ring-indigo-900/50",
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
    text: "text-indigo-700 dark:text-indigo-300",
    bar: "bg-gradient-to-r from-indigo-400 to-indigo-600",
  },
  later: {
    ring: "ring-slate-200 dark:ring-slate-700/50",
    bg: "bg-slate-50 dark:bg-slate-900/30",
    text: "text-slate-700 dark:text-slate-300",
    bar: "bg-gradient-to-r from-slate-400 to-slate-500",
  },
  noduedate: {
    ring: "ring-zinc-200 dark:ring-zinc-700/50",
    bg: "bg-zinc-50 dark:bg-zinc-900/30",
    text: "text-zinc-700 dark:text-zinc-300",
    bar: "bg-gradient-to-r from-zinc-400 to-zinc-500",
  },
};

/**
 * Liquiditaets-Forecast-Panel: zeigt erwarteten Geldeingang in 30/60/90 Tagen
 * basierend auf offenen Ausgangsrechnungen + historischem Zahlungsverhalten.
 *
 * Wird auf der Cash-Page oberhalb der dept-spezifischen Cashflow-Tabellen
 * gerendert (department-uebergreifend).
 */
export function LiquidityForecastPanel({ forecast, error }: Props) {
  if (error) {
    return (
      <section className="rounded-2xl border border-rose-200/60 bg-rose-50/40 dark:bg-rose-950/20 dark:border-rose-900/40 p-4">
        <div className="flex items-center gap-2 text-sm text-rose-700 dark:text-rose-400">
          <AlertTriangle size={14} />
          Liquiditäts-Forecast konnte nicht geladen werden: {error}
        </div>
      </section>
    );
  }
  if (!forecast) return null;

  const { buckets, totalOpenAmount, totalOpenCount, medianDelayDays, sampleSize } =
    forecast;

  // Vereinfachende Sicht: erwartete Summe der naechsten 30 / 60 / 90 Tage
  // kumulativ (overdue + in30 = "in 30 Tagen verfuegbar oder bereits faellig").
  const overdue = buckets.find((b) => b.key === "overdue")?.expectedAmount ?? 0;
  const in30 = buckets.find((b) => b.key === "in30")?.expectedAmount ?? 0;
  const in60 = buckets.find((b) => b.key === "in60")?.expectedAmount ?? 0;
  const in90 = buckets.find((b) => b.key === "in90")?.expectedAmount ?? 0;

  const cum30 = overdue + in30;
  const cum60 = cum30 + in60;
  const cum90 = cum60 + in90;

  // Max value fuer Bucket-Bar-Vergleich (relative Skalierung)
  const maxBucket = Math.max(
    ...buckets.map((b) => b.expectedAmount),
    1,
  );

  // Verzugs-Beschreibung
  const delayLabel =
    medianDelayDays > 0
      ? `Kunden zahlen im Schnitt ${medianDelayDays} Tag${medianDelayDays === 1 ? "" : "e"} nach Fälligkeit`
      : medianDelayDays < 0
        ? `Kunden zahlen im Schnitt ${Math.abs(medianDelayDays)} Tag${Math.abs(medianDelayDays) === 1 ? "" : "e"} vor Fälligkeit`
        : "Kunden zahlen zum Fälligkeitstag";

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <span className="inline-grid place-items-center w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Wallet size={16} />
            </span>
            Liquiditäts-Forecast
          </h2>
          <p className="text-xs text-muted-foreground max-w-2xl">
            Erwarteter Geldeingang aus offenen Ausgangsrechnungen, korrigiert um
            das historische Zahlungsverhalten der letzten 12 Monate.
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold">
            Gesamt offen
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {formatCurrency(totalOpenAmount)}
          </div>
          <div className="text-[11px] text-muted-foreground tabular-nums">
            aus {totalOpenCount.toLocaleString("de-AT")} Rechnung
            {totalOpenCount === 1 ? "" : "en"}
          </div>
        </div>
      </div>

      {/* 30/60/90-Forecast-Karten */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ForecastCard
          label="In 30 Tagen"
          amount={cum30}
          accent="from-emerald-500/15 to-emerald-500/5"
          ring="ring-emerald-500/30"
          textColor="text-emerald-700 dark:text-emerald-300"
          icon={<TrendingUp size={14} />}
        />
        <ForecastCard
          label="In 60 Tagen"
          amount={cum60}
          accent="from-blue-500/15 to-blue-500/5"
          ring="ring-blue-500/30"
          textColor="text-blue-700 dark:text-blue-300"
          icon={<TrendingUp size={14} />}
        />
        <ForecastCard
          label="In 90 Tagen"
          amount={cum90}
          accent="from-indigo-500/15 to-indigo-500/5"
          ring="ring-indigo-500/30"
          textColor="text-indigo-700 dark:text-indigo-300"
          icon={<TrendingUp size={14} />}
        />
      </div>

      {/* Bucket-Breakdown */}
      <div className="rounded-2xl border bg-card/40 p-4 space-y-2.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            Aufschlüsselung (Fälligkeit + erwartete Zahlung)
          </h3>
          <div
            className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
            title={`Aus ${sampleSize.toLocaleString("de-AT")} bezahlten Rechnungen der letzten 12 Monate.`}
          >
            <Info size={11} className="opacity-60" />
            {delayLabel}
          </div>
        </div>
        <ul className="space-y-1.5">
          {buckets.map((b) => {
            const style = BUCKET_STYLES[b.key] ?? BUCKET_STYLES.later;
            const widthPct =
              maxBucket > 0
                ? Math.max(2, (b.expectedAmount / maxBucket) * 100)
                : 2;
            if (b.count === 0 && b.expectedAmount === 0) return null;
            return (
              <li
                key={b.key}
                className={`relative rounded-lg ring-1 ${style.ring} ${style.bg} px-3 py-2.5 overflow-hidden`}
              >
                {/* Hintergrund-Bar */}
                <div
                  aria-hidden
                  className={`absolute inset-y-0 left-0 ${style.bar} opacity-15`}
                  style={{ width: `${widthPct}%` }}
                />
                <div className="relative flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-[12.5px] font-semibold ${style.text}`}>
                      {b.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {b.count} Rg.
                    </span>
                  </div>
                  <div className="text-[13.5px] font-bold tabular-nums">
                    {formatCurrencyCompact(b.expectedAmount)}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function ForecastCard({
  label,
  amount,
  accent,
  ring,
  textColor,
  icon,
}: {
  label: string;
  amount: number;
  accent: string;
  ring: string;
  textColor: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ring-1 ${ring} bg-card/60 p-4`}
    >
      <div
        aria-hidden
        className={`absolute -top-12 -right-12 w-40 h-40 rounded-full bg-gradient-to-br ${accent} blur-2xl pointer-events-none`}
      />
      <div className="relative space-y-1.5">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/80">
          <span className={textColor}>{icon}</span>
          {label}
        </div>
        <div className="text-2xl md:text-3xl font-bold tracking-tight tabular-nums">
          {formatCurrency(amount)}
        </div>
        <div className="text-[11px] text-muted-foreground">
          kumuliert · inkl. überfälliger Beträge
        </div>
      </div>
    </div>
  );
}
