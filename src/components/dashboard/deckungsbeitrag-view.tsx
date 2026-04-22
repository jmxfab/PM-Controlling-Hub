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
}: {
  department: Department;
  dto: DeckungsbeitragDto;
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
                    <TableCell className="font-mono text-xs">
                      {r.projectNumber ?? "–"}
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
