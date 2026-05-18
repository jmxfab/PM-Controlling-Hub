import { Suspense } from "react";
import type { Metadata } from "next";

import { DashboardInitialLoader } from "@/components/dashboard/dashboard-initial-loader";
import { CashflowView } from "@/components/dashboard/cashflow-view";
import { LiquidityForecastPanel } from "@/components/dashboard/liquidity-forecast-panel";
import { loadLiquidityForecast } from "@/lib/supabase/hero-liquidity-forecast";
import { loadCashflow } from "@/lib/supabase/hero-insights-queries";
import {
  loadCashInvoiceKpisForDept,
  PV_INVOICE_STEP_PATTERNS,
  WP_INVOICE_STEP_PATTERNS,
} from "@/lib/supabase/hero-pv-cash-invoice-kpis";
import {
  loadHeroPipeline,
  type TimeframeRangeIso,
} from "@/lib/supabase/hero-pipeline-queries";
import {
  DASHBOARD_DEPARTMENTS,
  DASHBOARD_DEPARTMENT_NAMES,
  type Department,
  parseDashboardDepartmentParam,
} from "@/lib/dashboard/dashboard-types";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  parseDashboardTimeframe,
  getDashboardTimeframeLabel,
  getDashboardTimeframeRange,
  type DashboardTimeframe,
} from "@/lib/dashboard/dashboard-timeframe";
import { berlinIsoStartOfDay } from "@/lib/dashboard/berlin-iso";
import type { DataErrorEntry } from "@/components/dashboard/data-error-banner";

export const metadata: Metadata = {
  title: "Cash",
  description:
    "Offene Rechnungen, Forderungs-Aging, Pipeline-Umsatz und Abrechnungsquote.",
};

export const revalidate = 60;

interface PageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CashPage({ searchParams }: PageProps) {
  const resolved = (await searchParams) ?? {};
  const department = parseDashboardDepartmentParam(resolved.department);
  // Cash-Tab: ohne explizites ?timeframe= im URL ist Jumax-Woche der
  // sinnvolle Default (Reporting-Zeitraum). User-Wahl per Tab überschreibt.
  const hasExplicitTimeframe = resolved.timeframe !== undefined;
  const timeframe = hasExplicitTimeframe
    ? parseDashboardTimeframe(resolved)
    : ({ mode: "jumax_week", from: null, to: null } as ReturnType<
        typeof parseDashboardTimeframe
      >);
  const heroProjectLinkTemplate = process.env.HERO_PROJECT_URL_TEMPLATE ?? null;

  // Liquiditaets-Forecast laeuft global (dept-uebergreifend) damit man auch
  // im PV-Tab die gesamte Firma-Liquiditaet sieht. Defensiv: bei DB-Fehler
  // wird das Panel mit Fehlertext angezeigt statt die ganze Seite zu killen.
  const forecastResult = await loadLiquidityForecast().then(
    (f) => ({ ok: true as const, forecast: f }),
    (e) => ({
      ok: false as const,
      error: e instanceof Error ? e.message : String(e),
    }),
  );

  const tabContents = Object.fromEntries(
    DASHBOARD_DEPARTMENTS.map((dept) => [
      dept,
      dept === department ? (
        <Suspense
          key={`${department}-${timeframe.mode}-${timeframe.from ?? ""}-${timeframe.to ?? ""}`}
          fallback={<DashboardInitialLoader />}
        >
          <CashTab
            department={department}
            timeframe={timeframe}
            heroProjectLinkTemplate={heroProjectLinkTemplate}
          />
        </Suspense>
      ) : (
        <div className="text-sm text-muted-foreground py-8 text-center">
          Wechsel zu {DASHBOARD_DEPARTMENT_NAMES[dept]} lädt die Daten neu …
        </div>
      ),
    ])
  ) as Record<Department, React.ReactNode>;

  return (
    <div className="flex-1 space-y-6 p-6 md:p-8 max-w-[1600px] mx-auto min-h-screen">
      <header className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Cash
        </h1>
        <p className="text-sm text-muted-foreground">
          Rechnungs- und Zahlungsfluss · Cashflow-Übersicht je Abteilung
        </p>
      </header>
      <DashboardShell
        department={department}
        departments={DASHBOARD_DEPARTMENTS}
        tabContents={tabContents}
        timeframe={timeframe}
      />
      {/* Liquiditaets-Forecast: zusaetzliche Sicht UNTER den dept-spezifischen
       *  Cash-KPIs. Liefert die "Wie viel Geld kommt in den naechsten 30/60/90
       *  Tagen rein"-Frage ohne die bestehenden Kennzahlen zu verdraengen. */}
      <LiquidityForecastPanel
        forecast={forecastResult.ok ? forecastResult.forecast : null}
        error={forecastResult.ok ? null : forecastResult.error}
      />
    </div>
  );
}

async function CashTab({
  department,
  timeframe,
  heroProjectLinkTemplate,
}: {
  department: Department;
  timeframe: DashboardTimeframe;
  heroProjectLinkTemplate: string | null;
}) {
  const pipelineRange = buildPipelineRange(timeframe);
  // Invoice-KPIs (5 Karten) gibt's für PV (Zaehlermontage / NA AC/DC /
  // NA terminiert), WP (NA nicht terminiert / NA Montage) und GESAMT
  // (= Vereinigung der Pattern-Sets, nur PV+WP — andere Sparten kommen
  // spaeter mit eigener Logik).
  const invoiceKpisDept: "PV" | "WP" | "GESAMT" | null =
    department === "PV" || department === "WP" || department === "GESAMT"
      ? department
      : null;
  const stepPatterns =
    invoiceKpisDept === "PV"
      ? PV_INVOICE_STEP_PATTERNS
      : invoiceKpisDept === "WP"
        ? WP_INVOICE_STEP_PATTERNS
        : invoiceKpisDept === "GESAMT"
          ? [...PV_INVOICE_STEP_PATTERNS, ...WP_INVOICE_STEP_PATTERNS]
          : [];
  // Auch im "Jetzt"-Modus die Invoice-KPIs anzeigen — dafuer brauchen wir
  // einen Period-Range fuer das "Gesamt im Zeitraum"-Tile. Fallback:
  // letzte 7 Tage. Die anderen Tiles ("Offen & ueberfaellig" etc.) sind
  // sowieso period-unabhaengig.
  const invoiceKpisRange =
    pipelineRange ?? buildLastNDaysRange(7);
  const [dtoResult, pipelineResult, pvKpisResult] = await Promise.allSettled([
    loadCashflow(department),
    // Cash-Pipeline-Panel: NUR Abrechnungs-Steps (Abschluss-/Teil-/Kundenrechnung).
    loadHeroPipeline(department, pipelineRange, { onlyCashSteps: true }),
    invoiceKpisDept
      ? loadCashInvoiceKpisForDept(
          invoiceKpisDept,
          stepPatterns,
          invoiceKpisRange.fromIso,
          invoiceKpisRange.toIso
        )
      : Promise.resolve(null),
  ]);

  const dto = dtoResult.status === "fulfilled" ? dtoResult.value : null;
  const pipeline =
    pipelineResult.status === "fulfilled" ? pipelineResult.value : null;
  const pvKpis =
    pvKpisResult.status === "fulfilled" ? pvKpisResult.value : null;
  const pvKpisLabel = pipelineRange?.label ?? invoiceKpisRange.label;

  // Sammle Loader-Errors fuer den DataErrorBanner.
  const loadErrors: DataErrorEntry[] = [];
  if (dtoResult.status === "rejected" || (dtoResult.status === "fulfilled" && !dto)) {
    loadErrors.push({
      source: "Cashflow-Summary (Aging, Forderungen, Pipeline-Umsatz)",
      detail:
        dtoResult.status === "rejected"
          ? errMsg(dtoResult.reason)
          : "Antwort leer",
    });
  }
  if (
    pipelineResult.status === "rejected" ||
    (pipelineResult.status === "fulfilled" && !pipeline)
  ) {
    loadErrors.push({
      source: "Pipeline (Cash-Steps)",
      detail:
        pipelineResult.status === "rejected"
          ? errMsg(pipelineResult.reason)
          : "Antwort leer",
    });
  }
  if (invoiceKpisDept && pvKpisResult.status === "rejected") {
    loadErrors.push({
      source: "Invoice-KPIs (5 Tiles oben)",
      detail: errMsg(pvKpisResult.reason),
    });
  }

  return (
    <CashflowView
      department={department}
      dto={dto}
      pipeline={pipeline}
      pvInvoiceKpis={pvKpis}
      pvInvoiceKpisLabel={pvKpisLabel}
      heroProjectLinkTemplate={heroProjectLinkTemplate}
      loadErrors={loadErrors}
    />
  );
}

function errMsg(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

const FUTURE_MODES = new Set<DashboardTimeframe["mode"]>([
  "morgen",
  "next3d",
  "next7d",
  "30d",
]);

function buildPipelineRange(
  timeframe: DashboardTimeframe
): TimeframeRangeIso | undefined {
  // Konsistent zu Controlling + Insights: im Jetzt-Modus gibt es keinen
  // Vergleichszeitraum → keine Bewegungs-Badges, keine "Änderungen im
  // Zeitraum"-Karte. Erst bei expliziter Timeframe-Auswahl (Gestern,
  // Woche, 14 Tage, Frei) werden die Deltas berechnet.
  if (timeframe.mode === "current") return undefined;
  const range = getDashboardTimeframeRange(timeframe);
  if (!range) return undefined;
  const fromIso = berlinIsoStartOfDay(range.from);
  const toIso = berlinIsoStartOfDay(addOneDay(range.to));
  return {
    fromIso,
    toIso,
    label: `${range.from} → ${range.to}`,
    direction: FUTURE_MODES.has(timeframe.mode) ? "future" : "past",
  };
}

/**
 * Period-Range fuer den Fallback im "Jetzt"-Modus: letzte N Tage bis
 * heute (inklusiv). Wird nur fuer Invoice-KPIs benutzt — Pipeline laeuft
 * weiter ohne Range.
 */
function buildLastNDaysRange(days: number): TimeframeRangeIso {
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - days);
  const fromDate = from.toISOString().slice(0, 10);
  const toDate = today.toISOString().slice(0, 10);
  const fromIso = berlinIsoStartOfDay(fromDate);
  const toIso = berlinIsoStartOfDay(addOneDay(toDate));
  return {
    fromIso,
    toIso,
    label: `Letzte ${days} Tage (${fromDate} → ${toDate})`,
    direction: "past",
  };
}

function addOneDay(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
