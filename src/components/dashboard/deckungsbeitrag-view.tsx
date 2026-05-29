"use client";

import { AlertTriangle, Euro, Percent, TrendingUp } from "lucide-react";

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
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { DeckungsbeitragDto } from "@/lib/supabase/deckungsbeitrag-queries";
import {
  DASHBOARD_DEPARTMENT_NAMES,
  type Department,
} from "@/lib/dashboard/dashboard-types";
import { HeroProjectLink } from "./hero-project-link";

function formatEur(v: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v);
}

export function DeckungsbeitragView({
  department,
  dto,
  heroProjectLinkTemplate,
}: {
  department: Department;
  dto: DeckungsbeitragDto;
  heroProjectLinkTemplate?: string | null;
}) {
  const deptName = DASHBOARD_DEPARTMENT_NAMES[department];

  return (
    <div className="space-y-6">
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Materialkosten werden manuell eingepflegt — nicht automatisch aus
          DATEV. Projekte ohne Kosteneintrag zeigen Kosten = 0 €.{" "}
          {dto.projectsWithCosts === 0
            ? "Noch keine Kosten erfasst."
            : `${dto.projectsWithCosts} von ${dto.rows.length} Projekten haben Kosteneinträge.`}
        </AlertDescription>
      </Alert>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Gesamtumsatz (abgeschl.)"
          valueText={formatEur(dto.totalRevenue)}
          hint={`${dto.projectsWithRevenue} Projekte mit Rechnungen`}
          icon={<Euro className="h-4 w-4" />}
        />
        <Kpi
          label="Erfasste Kosten"
          valueText={formatEur(dto.totalCosts)}
          hint={`${dto.projectsWithCosts} Projekte mit Kosteneinträgen`}
          icon={<Euro className="h-4 w-4" />}
          tone={dto.projectsWithCosts === 0 ? "warning" : "neutral"}
        />
        <Kpi
          label="Deckungsbeitrag (€)"
          valueText={formatEur(dto.totalMarginEur)}
          hint="Umsatz minus erfasste Kosten"
          icon={<TrendingUp className="h-4 w-4" />}
          tone={dto.totalMarginEur < 0 ? "warning" : "good"}
        />
        <Kpi
          label="DB-Quote"
          valueText={
            dto.totalMarginPct !== null
              ? `${dto.totalMarginPct.toLocaleString("de-DE")} %`
              : "–"
          }
          hint="Deckungsbeitrag / Umsatz"
          icon={<Percent className="h-4 w-4" />}
          tone={
            dto.totalMarginPct !== null && dto.totalMarginPct < 30
              ? "warning"
              : "good"
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Projekte — {deptName}</CardTitle>
          <CardDescription>
            Abgeschlossene Projekte sortiert nach Umsatz. Kosten = 0 €
            bedeutet: noch kein Eintrag vorhanden.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projekt-Nr.</TableHead>
                <TableHead>Titel / Kunde</TableHead>
                <TableHead className="text-right">Umsatz</TableHead>
                <TableHead className="text-right">Kosten</TableHead>
                <TableHead className="text-right">DB (€)</TableHead>
                <TableHead className="text-right">DB (%)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dto.rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground py-8"
                  >
                    Keine abgeschlossenen Projekte mit Umsatz gefunden.
                  </TableCell>
                </TableRow>
              ) : (
                dto.rows.map((r) => (
                  <TableRow key={r.projectMatchId}>
                    <TableCell>
                      <HeroProjectLink
                        projectId={r.projectMatchId}
                        projectNumber={r.projectNumber}
                        linkTemplate={heroProjectLinkTemplate ?? null}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <span className="block text-sm">
                          {r.projectName ?? r.customerName ?? "–"}
                        </span>
                        {r.customerName && r.projectName ? (
                          <span className="block text-xs text-muted-foreground">
                            {r.customerName}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-sm">
                      {formatEur(r.revenue)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono tabular-nums text-sm ${
                        r.costs === 0 ? "text-muted-foreground" : ""
                      }`}
                    >
                      {r.costs === 0 ? "–" : formatEur(r.costs)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono tabular-nums text-sm font-medium ${
                        r.costs === 0
                          ? "text-muted-foreground"
                          : r.marginEur < 0
                          ? "text-destructive"
                          : ""
                      }`}
                    >
                      {r.costs === 0 ? "–" : formatEur(r.marginEur)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono tabular-nums text-sm ${
                        r.marginPct === null
                          ? "text-muted-foreground"
                          : r.marginPct < 0
                          ? "text-destructive"
                          : r.marginPct < 30
                          ? "text-yellow-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {r.marginPct !== null && r.costs > 0
                        ? `${r.marginPct.toLocaleString("de-DE")} %`
                        : "–"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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
  const toneConfig = {
    neutral: {
      value: "text-foreground",
      iconBg: "bg-slate-100 dark:bg-slate-800",
      iconFg: "text-slate-600 dark:text-slate-300",
      accent: "hover:border-slate-300/50",
    },
    good: {
      value: "text-emerald-700 dark:text-emerald-400",
      iconBg: "bg-emerald-100 dark:bg-emerald-950/50",
      iconFg: "text-emerald-600 dark:text-emerald-400",
      accent: "hover:border-emerald-300/50",
    },
    warning: {
      value: "text-amber-700 dark:text-amber-400",
      iconBg: "bg-amber-100 dark:bg-amber-950/50",
      iconFg: "text-amber-600 dark:text-amber-400",
      accent: "hover:border-amber-300/50",
    },
  }[tone];

  return (
    <div
      className={`relative h-full overflow-hidden rounded-xl border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${toneConfig.accent}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 leading-tight">
          {label}
        </p>
        <div
          className={`shrink-0 grid place-items-center w-10 h-10 rounded-xl ${toneConfig.iconBg} ${toneConfig.iconFg}`}
        >
          {icon}
        </div>
      </div>
      <div
        className={`text-3xl font-bold tabular-nums tracking-tight leading-none mb-1.5 ${toneConfig.value}`}
      >
        {valueText}
      </div>
      <p className="text-xs text-muted-foreground leading-snug">{hint}</p>
    </div>
  );
}
