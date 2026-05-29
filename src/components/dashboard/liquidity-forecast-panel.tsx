import {
  AlertTriangle,
  TrendingUp,
  Wallet,
  Info,
  Building2,
  CalendarClock,
  CheckCircle2,
  Megaphone,
  MessageSquare,
} from "lucide-react";
import type {
  LiquidityForecast,
  RecentNote,
} from "@/lib/supabase/hero-liquidity-forecast";

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

  const {
    buckets,
    totalOpenAmount,
    totalOpenCount,
    medianDelayDays,
    sampleSize,
    topOpen,
  } = forecast;

  // Non-cumulative Bucket-Beträge fuer die 4 Forecast-Karten:
  // jede Karte zeigt genau das was in DIESEM Fenster erwartet wird.
  const overdueAmt =
    buckets.find((b) => b.key === "overdue")?.expectedAmount ?? 0;
  const overdueCount = buckets.find((b) => b.key === "overdue")?.count ?? 0;
  const in30Amt = buckets.find((b) => b.key === "in30")?.expectedAmount ?? 0;
  const in30Count = buckets.find((b) => b.key === "in30")?.count ?? 0;
  const in60Amt = buckets.find((b) => b.key === "in60")?.expectedAmount ?? 0;
  const in60Count = buckets.find((b) => b.key === "in60")?.count ?? 0;
  const in90Amt = buckets.find((b) => b.key === "in90")?.expectedAmount ?? 0;
  const in90Count = buckets.find((b) => b.key === "in90")?.count ?? 0;

  // Max value fuer Bucket-Bar-Vergleich (relative Skalierung)
  const maxBucket = Math.max(
    ...buckets.map((b) => b.expectedAmount),
    1,
  );
  // Top-Liste: Max-Betrag fuer relative Balken
  const maxTopAmount = Math.max(...topOpen.map((t) => t.openAmount), 1);

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

      {/* 4 Forecast-Karten — JEWEILS-Beträge (nicht kumulativ), damit sich
       *  die Karten optisch auch unterscheiden wenn die Verteilung schief ist. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ForecastCard
          label="Überfällig"
          amount={overdueAmt}
          count={overdueCount}
          accent="from-rose-500/20 to-rose-500/5"
          ring="ring-rose-500/40"
          textColor="text-rose-700 dark:text-rose-300"
          icon={<AlertTriangle size={14} />}
          urgent
        />
        <ForecastCard
          label="0 – 30 Tage"
          amount={in30Amt}
          count={in30Count}
          accent="from-amber-500/15 to-amber-500/5"
          ring="ring-amber-500/30"
          textColor="text-amber-700 dark:text-amber-300"
          icon={<TrendingUp size={14} />}
        />
        <ForecastCard
          label="31 – 60 Tage"
          amount={in60Amt}
          count={in60Count}
          accent="from-blue-500/15 to-blue-500/5"
          ring="ring-blue-500/30"
          textColor="text-blue-700 dark:text-blue-300"
          icon={<TrendingUp size={14} />}
        />
        <ForecastCard
          label="61 – 90 Tage"
          amount={in90Amt}
          count={in90Count}
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

      {/* Top-10 offene Rechnungen — direkt klar machen wo das meiste Geld
       *  liegt. Klick-Targets fuer Detail-Drill-Down koennten spaeter
       *  hinzukommen (z.B. Modal mit Vollbetrag/Tagen-faellig). */}
      {topOpen.length > 0 && (
        <div className="rounded-2xl border bg-card/40 p-4 space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              Top {topOpen.length} offene Rechnungen
            </h3>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              Summe Top {topOpen.length}:{" "}
              <span className="font-semibold text-foreground">
                {formatCurrencyCompact(
                  topOpen.reduce((s, t) => s + t.openAmount, 0),
                )}
              </span>
            </span>
          </div>
          <ul className="space-y-1.5">
            {topOpen.map((t, i) => {
              const widthPct = Math.max(2, (t.openAmount / maxTopAmount) * 100);
              const overdue = (t.daysOverdue ?? 0) > 0;
              return (
                <li
                  key={t.id}
                  className="relative rounded-lg ring-1 ring-border/60 bg-background/40 hover:bg-background/80 transition-colors px-3 py-2 overflow-hidden"
                >
                  <div
                    aria-hidden
                    className={`absolute inset-y-0 left-0 ${
                      overdue
                        ? "bg-gradient-to-r from-rose-500/15 to-rose-500/5"
                        : "bg-gradient-to-r from-emerald-500/10 to-emerald-500/2"
                    }`}
                    style={{ width: `${widthPct}%` }}
                  />
                  <div className="relative flex items-center gap-3">
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70 w-5 text-right">
                      #{i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-[13px] font-medium leading-tight truncate">
                        <Building2
                          size={11}
                          className="shrink-0 text-muted-foreground/70"
                        />
                        <span className="truncate">
                          {t.customerName ?? "Unbekannter Kunde"}
                        </span>
                        {t.projectNumber && (
                          <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                            · {t.projectNumber}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10.5px] text-muted-foreground tabular-nums flex-wrap">
                        {t.nr && <span>Rg. {t.nr}</span>}
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock size={10} className="opacity-60" />
                          fällig {formatGermanDate(t.dueDate)}
                        </span>
                        {overdue && (
                          <span className="text-rose-600 dark:text-rose-400 font-medium">
                            · {t.daysOverdue} Tag{t.daysOverdue === 1 ? "" : "e"} überfällig
                          </span>
                        )}
                      </div>
                      {t.recentNote && <NoteRow note={t.recentNote} />}
                    </div>
                    <div
                      className={`shrink-0 text-[14px] font-bold tabular-nums ${
                        overdue ? "text-rose-700 dark:text-rose-300" : ""
                      }`}
                    >
                      {formatCurrency(t.openAmount)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

function ForecastCard({
  label,
  amount,
  count,
  accent,
  ring,
  textColor,
  icon,
  urgent,
}: {
  label: string;
  amount: number;
  count: number;
  accent: string;
  ring: string;
  textColor: string;
  icon: React.ReactNode;
  urgent?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ring-1 ${ring} bg-card/60 p-4 ${
        urgent ? "shadow-[0_4px_20px_-4px_hsl(0_84%_55%/0.2)]" : ""
      }`}
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
        <div className="text-xl md:text-2xl font-bold tracking-tight tabular-nums">
          {formatCurrency(amount)}
        </div>
        <div className="text-[11px] text-muted-foreground tabular-nums">
          {count} Rechnung{count === 1 ? "" : "en"}
        </div>
      </div>
    </div>
  );
}

function formatGermanDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

/**
 * Vermerk-Zeile fuer eine Top-10-Rechnung: zeigt den letzten zahlungs-
 * relevanten Logbuch-Eintrag des zugehoerigen Projekts. Farbcodiert:
 *  - paid (emerald): Rechnung wirkt erledigt, evtl. kein Mahnaufwand noetig
 *  - dunning (amber): Mahnung laeuft schon, vorsichtig sein
 *  - other (slate): nur Erwaehnung, manuell pruefen
 */
function NoteRow({ note }: { note: RecentNote }) {
  const styles =
    note.kind === "paid"
      ? {
          ring: "ring-emerald-200 dark:ring-emerald-900/40",
          bg: "bg-emerald-50/70 dark:bg-emerald-950/30",
          text: "text-emerald-800 dark:text-emerald-300",
          icon: <CheckCircle2 size={11} />,
          label: "Möglicherweise bereits geklärt",
        }
      : note.kind === "dunning"
        ? {
            ring: "ring-amber-200 dark:ring-amber-900/40",
            bg: "bg-amber-50/70 dark:bg-amber-950/30",
            text: "text-amber-800 dark:text-amber-300",
            icon: <Megaphone size={11} />,
            label: "Mahnverfahren läuft",
          }
        : {
            ring: "ring-slate-200 dark:ring-slate-700/50",
            bg: "bg-slate-50/70 dark:bg-slate-900/40",
            text: "text-slate-700 dark:text-slate-300",
            icon: <MessageSquare size={11} />,
            label: "Logbuch-Vermerk",
          };
  const date = new Date(note.date);
  const dateLabel = Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("de-AT", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      });
  return (
    <div
      className={`mt-1.5 rounded-md ring-1 ${styles.ring} ${styles.bg} px-2 py-1 text-[11px] leading-snug ${styles.text}`}
      title={note.author ? `Von ${note.author} am ${dateLabel}` : dateLabel}
    >
      <div className="flex items-center gap-1.5 font-semibold">
        {styles.icon}
        <span>{styles.label}</span>
        {dateLabel && (
          <span className="font-normal opacity-70 tabular-nums">
            · {dateLabel}
          </span>
        )}
        {note.author && (
          <span className="font-normal opacity-70 truncate">
            · {note.author}
          </span>
        )}
      </div>
      <div className="mt-0.5 font-normal opacity-90 line-clamp-2">
        {note.snippet}
      </div>
    </div>
  );
}
