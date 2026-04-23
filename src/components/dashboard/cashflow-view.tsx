"use client";

import { AlertTriangle, Euro, Percent } from "lucide-react";
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
import type { CashflowDto } from "@/lib/supabase/hero-insights-queries";
import type { HeroPipelineDto } from "@/lib/supabase/hero-pipeline-queries";
import { HeroPipelinePanel } from "./hero-pipeline-panel";
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

      {/* Aging Buckets */}
      <Card>
        <CardHeader>
          <CardTitle>Forderungs-Aging — {deptName}</CardTitle>
          <CardDescription>
            Offene Rechnungen (Status Erstellt/Versendet) gruppiert nach
            Tagen seit Erstellung. Stornierte/gelöschte sind ausgeschlossen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alter</TableHead>
                <TableHead className="text-right">Anzahl</TableHead>
                <TableHead className="text-right">Summe (€)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dto.aging.map((b) => (
                <TableRow key={b.bucket}>
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
                </TableRow>
              ))}
              <TableRow className="border-t-2 font-semibold">
                <TableCell>Gesamt</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {dto.totalOpenCount.toLocaleString("de-DE")}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatEur(dto.totalOpenEur)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
