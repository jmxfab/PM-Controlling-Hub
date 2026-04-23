"use client";

import { Fragment, useState } from "react";
import { AlertTriangle, ChevronDown, Euro, Percent } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  CashflowDto,
  InvoiceAgingRow,
  InvoiceDetailRow,
} from "@/lib/supabase/hero-insights-queries";
import type { HeroPipelineDto } from "@/lib/supabase/hero-pipeline-queries";
import { HeroPipelinePanel } from "./hero-pipeline-panel";
import { HeroProjectLink } from "./hero-project-link";
import {
  DASHBOARD_DEPARTMENT_NAMES,
  type Department,
} from "@/lib/dashboard/dashboard-types";

function formatEur(v: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v);
}

export function CashflowView({
  department,
  dto,
  pipeline,
  heroProjectLinkTemplate,
}: {
  department: Department;
  dto: CashflowDto | null;
  pipeline?: HeroPipelineDto | null;
  heroProjectLinkTemplate?: string | null;
}) {
  const deptName = DASHBOARD_DEPARTMENT_NAMES[department];

  return (
    <div className="space-y-6">
      {pipeline ? (
        <HeroPipelinePanel
          department={department}
          pipeline={pipeline}
          heroProjectLinkTemplate={heroProjectLinkTemplate ?? null}
          variant="cash"
        />
      ) : null}
      {!dto ? (
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
          Cashflow-KPIs (Aging, Pipeline-Umsatz, Monatsumsatz) konnten nicht
          geladen werden. Die Pipeline-Sicht oben ist davon unabhängig.
        </div>
      ) : null}
      {dto ? (
      <>
      {/* Top-KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Offene Forderungen gesamt"
          valueText={formatEur(dto.totalOpenEur)}
          hint={`${dto.totalOpenCount} offene Rechnungen`}
          icon={<Euro className="h-4 w-4" />}
        />
        <Kpi
          label="Pipeline-Umsatz"
          valueText={formatEur(dto.pipelineRevenueEur)}
          hint={`${dto.pipelineRevenueInvoices} Rechnungen in Abschluss-/Montage-Step`}
          icon={<Euro className="h-4 w-4" />}
          tone="good"
        />
        <Kpi
          label="Abrechnungsquote"
          valueText={`${dto.billingRate.percent.toLocaleString("de-DE")} %`}
          hint={`${dto.billingRate.billed} von ${dto.billingRate.completed} abgeschlossenen Projekten haben eine Rechnung`}
          icon={<Percent className="h-4 w-4" />}
          tone={dto.billingRate.percent < 80 ? "warning" : "good"}
        />
        <Kpi
          label="Überfällig (>30 Tg)"
          valueText={formatEur(
            dto.aging
              .filter((b) => b.minDays >= 30)
              .reduce((s, b) => s + b.totalEur, 0)
          )}
          hint={`${dto.aging
            .filter((b) => b.minDays >= 30)
            .reduce((s, b) => s + b.count, 0)} Rechnungen älter als 30 Tage`}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone="warning"
        />
      </div>

      {/* Rechnungs-Status — was ist mit den Rechnungen passiert */}
      {dto.statusBreakdown && dto.statusBreakdown.length > 0 ? (
        <InvoiceStatusBreakdown
          department={department}
          deptName={deptName}
          buckets={dto.statusBreakdown}
          heroProjectLinkTemplate={heroProjectLinkTemplate ?? null}
        />
      ) : null}

      {/* Aging Buckets */}
      <InvoiceAgingBreakdown
        department={department}
        deptName={deptName}
        buckets={dto.aging}
        totalOpenCount={dto.totalOpenCount}
        totalOpenEur={dto.totalOpenEur}
        heroProjectLinkTemplate={heroProjectLinkTemplate ?? null}
      />

      {/* Umsatz nach Sparte + Monat */}
      <Card>
        <CardHeader>
          <CardTitle>Umsatz nach Sparte — letzte 12 Monate</CardTitle>
          <CardDescription>
            Summe der Rechnungsbeträge (value) pro Monat, nach Sparte
            aufgeschlüsselt. Rechnungserstellungsdatum aus Hero
            (created_at_hero).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[360px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dto.revenueByMonth}
                margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="month"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                  formatter={(value) => formatEur(Number(value))}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="PV" stackId="a" fill="#3b82f6" name="PV" />
                <Bar dataKey="PV_GEWERBE" stackId="a" fill="#f59e0b" name="PV Gewerbe" />
                <Bar dataKey="WP" stackId="a" fill="#10b981" name="WP" />
                <Bar dataKey="KLIMA" stackId="a" fill="#06b6d4" name="Klima" />
                <Bar dataKey="GEBAEUDETECHNIK" stackId="a" fill="#8b5cf6" name="Gebäudetechnik" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      </>
      ) : null}
    </div>
  );
}

function Kpi({
  label,
  valueText,
  hint,
  icon,
  tone = "neutral",
}: {
  label: string;
  valueText: string;
  hint: string;
  icon: React.ReactNode;
  tone?: "neutral" | "good" | "warning";
}) {
  const toneClass = {
    neutral: "",
    good: "text-emerald-600",
    warning: "text-yellow-600",
  }[tone];
  return (
    <Card>
      <CardContent className="pt-4 pb-4 space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          <span className={toneClass}>{icon}</span>
        </div>
        <div className={`text-2xl font-semibold tabular-nums ${toneClass}`}>
          {valueText}
        </div>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

/**
 * Klappbare Rechnungs-Status-Tabelle. Klick auf eine Status-Zeile lädt
 * die zugehörigen Einzel-Rechnungen (Kunde, Projekt, Betrag, Datum)
 * via /api/dashboard/invoice-status-details nach und zeigt sie als
 * Detail-Block unter der Zeile.
 */
function InvoiceStatusBreakdown({
  department,
  deptName,
  buckets,
  heroProjectLinkTemplate,
}: {
  department: Department;
  deptName: string;
  buckets: CashflowDto["statusBreakdown"];
  heroProjectLinkTemplate: string | null;
}) {
  const [expandedStatus, setExpandedStatus] = useState<number | null>(null);
  const [invoicesByStatus, setInvoicesByStatus] = useState<
    Record<number, InvoiceDetailRow[]>
  >({});
  const [loadingStatus, setLoadingStatus] = useState<number | null>(null);

  async function toggleStatus(statusCode: number) {
    if (expandedStatus === statusCode) {
      setExpandedStatus(null);
      return;
    }
    setExpandedStatus(statusCode);
    if (invoicesByStatus[statusCode]) return; // bereits geladen
    setLoadingStatus(statusCode);
    try {
      const response = await fetch(
        `/api/dashboard/invoice-status-details?department=${department}&status=${statusCode}`
      );
      if (response.ok) {
        const payload = (await response.json()) as {
          invoices: InvoiceDetailRow[];
        };
        setInvoicesByStatus((prev) => ({
          ...prev,
          [statusCode]: payload.invoices ?? [],
        }));
      }
    } catch {
      // Silent fail — die Detail-Tabelle bleibt leer, Header-Zeile bleibt.
    } finally {
      setLoadingStatus(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rechnungs-Status — {deptName}</CardTitle>
        <CardDescription>
          Verteilung aller Rechnungen nach Hero-Status. 0 €-Einträge
          (Entwürfe, gelöschte, wertlose Storni) sind bewusst mit gezählt,
          damit man die Stückzahl sieht. Klick auf einen Status zeigt die
          einzelnen Rechnungen mit Projekt + Kunde.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Anzahl</TableHead>
              <TableHead className="text-right">Summe (€)</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {buckets.map((b) => {
              const isExpanded = expandedStatus === b.statusCode;
              const isLoading = loadingStatus === b.statusCode;
              const invoices = invoicesByStatus[b.statusCode];
              return (
                <Fragment key={b.statusCode}>
                  <TableRow
                    className="cursor-pointer hover:bg-accent/40 border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                    onClick={() => toggleStatus(b.statusCode)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    aria-label={`Rechnungen im Status ${b.label} anzeigen`}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleStatus(b.statusCode);
                      }
                    }}
                    data-state={isExpanded ? "open" : "closed"}
                  >
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="font-medium">{b.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {b.description}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {b.count.toLocaleString("de-DE")}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {b.totalEur === 0 ? (
                        <span className="text-muted-foreground">0 €</span>
                      ) : (
                        formatEur(b.totalEur)
                      )}
                    </TableCell>
                    <TableCell className="w-8 text-muted-foreground">
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </TableCell>
                  </TableRow>
                  {isExpanded ? (
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={4} className="py-3">
                        {isLoading ? (
                          <div className="text-sm text-muted-foreground py-6 text-center">
                            Lade Rechnungen…
                          </div>
                        ) : !invoices || invoices.length === 0 ? (
                          <div className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-md">
                            Keine Rechnungen mit diesem Status.
                          </div>
                        ) : (
                          <InvoiceDetailsTable
                            invoices={invoices}
                            heroProjectLinkTemplate={heroProjectLinkTemplate}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function InvoiceDetailsTable({
  invoices,
  heroProjectLinkTemplate,
  showAgeDays = false,
}: {
  invoices: (InvoiceDetailRow | InvoiceAgingRow)[];
  heroProjectLinkTemplate: string | null;
  /** Wenn true, wird hinter dem Datum zusätzlich "X Tg alt" gezeigt. */
  showAgeDays?: boolean;
}) {
  const formatDate = (iso: string | null): string => {
    if (!iso) return "–";
    const date = new Date(iso);
    return Number.isNaN(date.getTime())
      ? "–"
      : date.toLocaleDateString("de-DE");
  };
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="py-2">Rechnung</TableHead>
          <TableHead className="py-2">Projekt</TableHead>
          <TableHead className="py-2">Kunde</TableHead>
          <TableHead className="py-2">Datum</TableHead>
          <TableHead className="py-2 text-right">Betrag</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((inv) => {
          const ageDays =
            showAgeDays && "ageDays" in inv ? inv.ageDays : null;
          return (
            <TableRow key={inv.invoiceId}>
              <TableCell className="py-1.5">
                <div className="space-y-0 leading-tight">
                  <p className="font-mono text-xs font-semibold">
                    {inv.invoiceNr ?? "–"}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                    {inv.documentTypeName ?? inv.invoiceType ?? ""}
                  </p>
                </div>
              </TableCell>
              <TableCell className="py-1.5">
                <div className="space-y-0 leading-tight">
                  <HeroProjectLink
                    projectId={inv.projectMatchId}
                    projectNumber={inv.projectNumber}
                    linkTemplate={heroProjectLinkTemplate}
                  />
                  <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                    {inv.projectName ?? ""}
                  </p>
                </div>
              </TableCell>
              <TableCell className="py-1.5 text-sm text-muted-foreground">
                <span className="truncate block max-w-[180px]">
                  {inv.customerName ?? "–"}
                </span>
              </TableCell>
              <TableCell className="py-1.5 text-xs text-muted-foreground whitespace-nowrap">
                <div className="space-y-0 leading-tight">
                  <p>{formatDate(inv.documentDate ?? inv.createdAtHero)}</p>
                  {ageDays != null ? (
                    <p className="text-[10px] opacity-70">{ageDays} Tg alt</p>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="py-1.5 text-right font-mono tabular-nums whitespace-nowrap">
                {inv.value === 0 ? (
                  <span className="text-muted-foreground">0 €</span>
                ) : (
                  formatEur(inv.value)
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/**
 * Forderungs-Aging-Tabelle mit Klappmechanik wie der Status-Breakdown.
 * Klick auf einen Alters-Bucket ruft /api/dashboard/invoice-aging-details
 * und zeigt die einzelnen offenen Rechnungen im Bucket.
 */
function InvoiceAgingBreakdown({
  department,
  deptName,
  buckets,
  totalOpenCount,
  totalOpenEur,
  heroProjectLinkTemplate,
}: {
  department: Department;
  deptName: string;
  buckets: CashflowDto["aging"];
  totalOpenCount: number;
  totalOpenEur: number;
  heroProjectLinkTemplate: string | null;
}) {
  const [expandedBucket, setExpandedBucket] = useState<string | null>(null);
  const [invoicesByBucket, setInvoicesByBucket] = useState<
    Record<string, InvoiceAgingRow[]>
  >({});
  const [loadingBucket, setLoadingBucket] = useState<string | null>(null);

  async function toggleBucket(bucket: CashflowDto["aging"][number]) {
    const key = bucket.bucket;
    if (expandedBucket === key) {
      setExpandedBucket(null);
      return;
    }
    setExpandedBucket(key);
    if (invoicesByBucket[key]) return;
    setLoadingBucket(key);
    try {
      const params = new URLSearchParams({
        department,
        minDays: String(bucket.minDays),
      });
      if (bucket.maxDays != null) {
        params.set("maxDays", String(bucket.maxDays));
      }
      const response = await fetch(
        `/api/dashboard/invoice-aging-details?${params.toString()}`
      );
      if (response.ok) {
        const payload = (await response.json()) as {
          invoices: InvoiceAgingRow[];
        };
        setInvoicesByBucket((prev) => ({
          ...prev,
          [key]: payload.invoices ?? [],
        }));
      }
    } catch {
      // Silent fail — Detail-Tabelle bleibt leer.
    } finally {
      setLoadingBucket(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Forderungs-Aging — {deptName}</CardTitle>
        <CardDescription>
          Offene Rechnungen (Status Erstellt/Versendet) gruppiert nach
          Tagen seit Erstellung. Stornierte/gelöschte sind ausgeschlossen.
          Klick auf einen Bucket zeigt die einzelnen Rechnungen mit
          Projekt + Kunde.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Alter</TableHead>
              <TableHead className="text-right">Anzahl</TableHead>
              <TableHead className="text-right">Summe (€)</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {buckets.map((b) => {
              const isExpanded = expandedBucket === b.bucket;
              const isLoading = loadingBucket === b.bucket;
              const invoices = invoicesByBucket[b.bucket];
              const hasItems = b.count > 0;
              return (
                <Fragment key={b.bucket}>
                  <TableRow
                    className={`border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset ${
                      hasItems ? "cursor-pointer hover:bg-accent/40" : ""
                    }`}
                    onClick={hasItems ? () => toggleBucket(b) : undefined}
                    role={hasItems ? "button" : undefined}
                    tabIndex={hasItems ? 0 : undefined}
                    aria-expanded={hasItems ? isExpanded : undefined}
                    aria-label={
                      hasItems
                        ? `Rechnungen im Alters-Bucket ${b.bucket} anzeigen`
                        : undefined
                    }
                    onKeyDown={
                      hasItems
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              toggleBucket(b);
                            }
                          }
                        : undefined
                    }
                    data-state={isExpanded ? "open" : "closed"}
                  >
                    <TableCell
                      className={
                        b.minDays >= 30
                          ? "font-medium text-orange-600"
                          : "font-medium"
                      }
                    >
                      {b.bucket}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {b.count.toLocaleString("de-DE")}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatEur(b.totalEur)}
                    </TableCell>
                    <TableCell className="w-8 text-muted-foreground">
                      {hasItems ? (
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        />
                      ) : null}
                    </TableCell>
                  </TableRow>
                  {isExpanded ? (
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={4} className="py-3">
                        {isLoading ? (
                          <div className="text-sm text-muted-foreground py-6 text-center">
                            Lade Rechnungen…
                          </div>
                        ) : !invoices || invoices.length === 0 ? (
                          <div className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-md">
                            Keine Rechnungen in diesem Alters-Bucket.
                          </div>
                        ) : (
                          <InvoiceDetailsTable
                            invoices={invoices}
                            heroProjectLinkTemplate={heroProjectLinkTemplate}
                            showAgeDays
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })}
            <TableRow className="border-t-2 font-semibold">
              <TableCell>Gesamt</TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {totalOpenCount.toLocaleString("de-DE")}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {formatEur(totalOpenEur)}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
