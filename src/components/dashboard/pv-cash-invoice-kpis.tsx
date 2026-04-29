"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  DASHBOARD_DEPARTMENT_NAMES,
  type Department,
} from "@/lib/dashboard/dashboard-types";
import { HeroProjectLink } from "./hero-project-link";
import type {
  PvCashInvoiceKpis,
  PvCashInvoiceRow,
} from "@/lib/supabase/hero-pv-cash-invoice-kpis";

type KpiKey = "total" | "notOverdue" | "overdue" | "inActiveStep";

interface KpiDef {
  key: KpiKey;
  title: string;
  description: string;
  icon: LucideIcon;
  toneClass?: string;
}

const KPIS_BASE: Omit<KpiDef, "description">[] = [
  {
    key: "total",
    title: "Gesamt im Zeitraum",
    icon: FileText,
    toneClass: "text-foreground",
  },
  {
    key: "notOverdue",
    title: "Offen & nicht überfällig",
    icon: CheckCircle2,
    toneClass: "text-emerald-600",
  },
  {
    key: "overdue",
    title: "Offen & überfällig",
    icon: AlertTriangle,
    toneClass: "text-rose-600",
  },
  {
    key: "inActiveStep",
    title: "Offen & im aktiven Step",
    icon: Wrench,
    toneClass: "text-amber-600",
  },
];

function buildKpiDefs(activeStepHumanList: string): KpiDef[] {
  return [
    {
      ...KPIS_BASE[0],
      description: "Alle versendeten Rechnungen im gewählten Zeitraum",
    },
    {
      ...KPIS_BASE[1],
      description: "Versendet im Zeitraum, max. 7 Tage seit Rechnungsdatum",
    },
    {
      ...KPIS_BASE[2],
      description: "Versendet im Zeitraum, mehr als 7 Tage seit Rechnungsdatum",
    },
    {
      ...KPIS_BASE[3],
      description: `Offenes Brutto-Volumen (status Erstellt + Versendet) aller Projekte aktuell im Step: ${activeStepHumanList}`,
    },
  ];
}

const eurFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

interface PvCashInvoiceKpisProps {
  kpis: PvCashInvoiceKpis;
  windowLabel: string;
  heroProjectLinkTemplate: string | null;
  department: Department;
}

/** Aus den lowercase-Patterns aus dem Loader eine menschen-lesbare
 *  Liste bauen ("zählermontage" → "Zählermontage", join mit " / "). */
function humanizeActiveSteps(patterns: string[]): string {
  if (patterns.length === 0) return "Offen & im aktiven Step";
  const titled = patterns.map((p) =>
    p
      .split(" ")
      .map((w) => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1)))
      .join(" ")
  );
  return titled.join(" / ");
}

/** Kompakte Kurz-Bezeichnung des abgeleiteten Rechnungs-Typs fuer das
 *  KPI-Tile.
 *  "1. Teilrechnung" → "1. Teil",
 *  "2. Teilrechnung" → "2. Teil",
 *  "Abschlussrechnung" → "Abschluss",
 *  "Kundenrechnung" → "Kunde". */
function shortInvoiceType(derivedType: string): string {
  const lower = derivedType.toLowerCase();
  const teilMatch = lower.match(/^(\d+)\.\s*teil/);
  if (teilMatch) return `${teilMatch[1]}. Teil`;
  if (lower.includes("teil")) return "Teil";
  if (lower.includes("abschluss") || lower.includes("schluss"))
    return "Abschluss";
  if (lower.includes("kunden")) return "Kunde";
  if (lower.includes("sammel")) return "Sammel";
  return derivedType;
}

/** Aggregiere Rechnungen nach (gekuerztem) Typ. Liefert pro Typ Anzahl
 *  und EUR-Summe — sortiert absteigend nach Anzahl. */
function summarizeTypes(
  rows: PvCashInvoiceRow[]
): { label: string; count: number; eur: number }[] {
  if (rows.length === 0) return [];
  const buckets = new Map<string, { count: number; eur: number }>();
  for (const r of rows) {
    const short = shortInvoiceType(r.derivedType);
    const cur = buckets.get(short) ?? { count: 0, eur: 0 };
    cur.count += 1;
    cur.eur += r.value ?? 0;
    buckets.set(short, cur);
  }
  return [...buckets.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([label, { count, eur }]) => ({ label, count, eur }));
}

export function PvCashInvoiceKpisCard({
  kpis,
  windowLabel,
  heroProjectLinkTemplate,
  department,
}: PvCashInvoiceKpisProps) {
  const [selected, setSelected] = useState<KpiKey | null>(null);

  const activeStepHumanList = humanizeActiveSteps(kpis.activeStepLabels);
  const KPIS = buildKpiDefs(activeStepHumanList);

  function valueFor(key: KpiKey): number {
    switch (key) {
      case "total":
        return kpis.total.count;
      case "notOverdue":
        return kpis.notOverdue.count;
      case "overdue":
        return kpis.overdue.count;
      case "inActiveStep":
        return kpis.inActiveStep.count;
    }
  }

  function eurFor(key: KpiKey): number {
    const rows = rowsFor(key);
    return rows.reduce((sum, r) => sum + (r.value ?? 0), 0);
  }

  function rowsFor(key: KpiKey): PvCashInvoiceRow[] {
    switch (key) {
      case "total":
        return kpis.total.rows;
      case "notOverdue":
        return kpis.notOverdue.rows;
      case "overdue":
        return kpis.overdue.rows;
      case "inActiveStep":
        return kpis.inActiveStep.rows;
    }
  }

  const def = selected ? KPIS.find((k) => k.key === selected) ?? null : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {DASHBOARD_DEPARTMENT_NAMES[department]} · Versendete Rechnungen im Zeitraum
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Gefiltert auf type=invoice, status=200 (Versendet),
          document_date im Zeitraum {windowLabel}.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {KPIS.map((k) => {
            const Icon = k.icon;
            const count = valueFor(k.key);
            const eur = eurFor(k.key);
            const typeSummary = summarizeTypes(rowsFor(k.key));
            return (
              <button
                key={k.key}
                type="button"
                aria-haspopup="dialog"
                onClick={() => setSelected(k.key)}
                className="group h-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Card
                  className={cn(
                    "h-full transition-colors group-hover:border-ring/40 group-hover:bg-accent/20"
                  )}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {k.title}
                    </CardTitle>
                    <Icon className={cn("h-4 w-4", k.toneClass)} />
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-baseline justify-between gap-3 flex-wrap">
                      <div
                        className={cn(
                          "text-2xl font-bold tabular-nums",
                          k.toneClass
                        )}
                      >
                        {count}
                      </div>
                      {eur > 0 ? (
                        <div
                          className={cn(
                            "text-xl font-semibold tabular-nums",
                            k.toneClass
                          )}
                        >
                          {eurFormatter.format(eur)}
                        </div>
                      ) : null}
                    </div>
                    {typeSummary.length > 0 ? (
                      <ul className="mt-1 space-y-0.5">
                        {typeSummary.map((t) => (
                          <li
                            key={t.label}
                            className="flex items-baseline justify-between gap-2 text-[11px] text-muted-foreground tabular-nums"
                          >
                            <span>
                              {t.count} × {t.label}
                            </span>
                            <span>{eurFormatter.format(t.eur)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {k.description}
                    </p>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      </CardContent>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="sm:max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          {def ? (
            <>
              <DialogHeader>
                <DialogTitle>{def.title}</DialogTitle>
                <DialogDescription>
                  {def.description} · {windowLabel} ·{" "}
                  {valueFor(def.key)} Rechnung
                  {valueFor(def.key) === 1 ? "" : "en"} ·{" "}
                  {eurFormatter.format(eurFor(def.key))}
                </DialogDescription>
              </DialogHeader>
              <div className="overflow-y-auto -mx-6 px-6">
                <InvoicesTable
                  rows={rowsFor(def.key)}
                  heroProjectLinkTemplate={heroProjectLinkTemplate}
                />
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function InvoicesTable({
  rows,
  heroProjectLinkTemplate,
}: {
  rows: PvCashInvoiceRow[];
  heroProjectLinkTemplate: string | null;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-sm text-muted-foreground text-center italic">
        Keine Rechnungen.
      </p>
    );
  }
  // Sortiere: überfällig + ältester zuerst
  const sorted = [...rows].sort((a, b) => b.ageDays - a.ageDays);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>RG-Nr.</TableHead>
          <TableHead>Typ</TableHead>
          <TableHead>Datum</TableHead>
          <TableHead className="text-right">Betrag</TableHead>
          <TableHead>Projekt</TableHead>
          <TableHead>Kunde</TableHead>
          <TableHead>Aktueller Step</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Alter</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="font-mono text-xs">
              {r.fileUrl ? (
                <a
                  href={r.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                  title="Rechnungs-PDF öffnen"
                >
                  {r.nr ?? r.id}
                  <span aria-hidden="true">↗</span>
                </a>
              ) : (
                <span>{r.nr ?? r.id}</span>
              )}
            </TableCell>
            <TableCell className="text-xs whitespace-nowrap">
              {r.derivedType}
            </TableCell>
            <TableCell className="text-xs tabular-nums whitespace-nowrap">
              {r.documentDate
                ? new Date(r.documentDate).toLocaleDateString("de-DE")
                : "–"}
            </TableCell>
            <TableCell className="text-right text-xs tabular-nums whitespace-nowrap">
              {r.value !== null ? eurFormatter.format(r.value) : "–"}
            </TableCell>
            <TableCell className="text-xs">
              <HeroProjectLink
                projectId={r.projectId}
                projectNumber={r.projectNumber}
                linkTemplate={heroProjectLinkTemplate}
              />
              {r.projectName && r.projectName !== r.customerName ? (
                <span className="block text-[10px] text-muted-foreground truncate max-w-[180px]">
                  {r.projectName}
                </span>
              ) : null}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {r.customerName ?? "–"}
            </TableCell>
            <TableCell className="text-xs">
              <span
                className={cn(
                  r.isInActiveStep ? "text-amber-600 font-medium" : ""
                )}
              >
                {r.stepName ?? "–"}
              </span>
            </TableCell>
            <TableCell className="text-xs whitespace-nowrap">
              {r.bookingIsOpen === false && r.bookingPaidDate ? (
                <span className="text-emerald-600 font-medium">
                  Bezahlt{" "}
                  {new Date(r.bookingPaidDate).toLocaleDateString("de-DE")}
                </span>
              ) : r.bookingIsOpen === true ? (
                <span className="text-muted-foreground">Offen</span>
              ) : (
                <span className="text-muted-foreground italic" title="Booking-Info noch nicht gesynct">
                  –
                </span>
              )}
            </TableCell>
            <TableCell className="text-right text-xs tabular-nums">
              <span
                className={cn(
                  r.isOverdue ? "text-rose-600 font-semibold" : "text-muted-foreground"
                )}
              >
                {r.ageDays} Tg
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
