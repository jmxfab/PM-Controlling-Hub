"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
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
import { HeroProjectLink } from "./hero-project-link";
import type {
  PvCashInvoiceKpis,
  PvCashInvoiceRow,
} from "@/lib/supabase/hero-pv-cash-invoice-kpis";

type KpiKey = "notOverdue" | "overdue" | "inActiveStep";

interface KpiDef {
  key: KpiKey;
  title: string;
  description: string;
  icon: LucideIcon;
  toneClass?: string;
}

const KPIS: KpiDef[] = [
  {
    key: "notOverdue",
    title: "Offen & nicht überfällig",
    description: "Versendet im Zeitraum, ≤7 Tage seit Rechnungsdatum",
    icon: CheckCircle2,
    toneClass: "text-emerald-600",
  },
  {
    key: "overdue",
    title: "Offen & überfällig",
    description: "Versendet im Zeitraum, >7 Tage seit Rechnungsdatum",
    icon: AlertTriangle,
    toneClass: "text-rose-600",
  },
  {
    key: "inActiveStep",
    title: "Offen & im aktiven Step",
    description: "Zählermontage / Nacharbeiten AC / DC / terminiert",
    icon: Wrench,
    toneClass: "text-amber-600",
  },
];

const eurFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

interface PvCashInvoiceKpisProps {
  kpis: PvCashInvoiceKpis;
  windowLabel: string;
  heroProjectLinkTemplate: string | null;
}

export function PvCashInvoiceKpisCard({
  kpis,
  windowLabel,
  heroProjectLinkTemplate,
}: PvCashInvoiceKpisProps) {
  const [selected, setSelected] = useState<KpiKey | null>(null);

  function valueFor(key: KpiKey): number {
    switch (key) {
      case "notOverdue":
        return kpis.notOverdue.count;
      case "overdue":
        return kpis.overdue.count;
      case "inActiveStep":
        return kpis.inActiveStep.count;
    }
  }

  function eurFor(key: KpiKey): number {
    const rows =
      key === "notOverdue"
        ? kpis.notOverdue.rows
        : key === "overdue"
          ? kpis.overdue.rows
          : kpis.inActiveStep.rows;
    return rows.reduce((sum, r) => sum + (r.value ?? 0), 0);
  }

  function rowsFor(key: KpiKey): PvCashInvoiceRow[] {
    switch (key) {
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
          PV · Versendete Rechnungen im Zeitraum
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Gefiltert auf type=invoice, status=200 (Versendet),
          document_date im Zeitraum {windowLabel}.
          {kpis.total.count > 0 ? (
            <>
              {" "}
              · {kpis.total.count} Rechnung
              {kpis.total.count === 1 ? "" : "en"} insgesamt mit Gesamtsumme{" "}
              {eurFormatter.format(
                kpis.total.rows.reduce((s, r) => s + (r.value ?? 0), 0)
              )}
            </>
          ) : null}
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          {KPIS.map((k) => {
            const Icon = k.icon;
            const count = valueFor(k.key);
            const eur = eurFor(k.key);
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
                    <div
                      className={cn(
                        "text-2xl font-bold tabular-nums",
                        k.toneClass
                      )}
                    >
                      {count}
                    </div>
                    {eur > 0 ? (
                      <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
                        {eurFormatter.format(eur)}
                      </p>
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
          <TableHead>Datum</TableHead>
          <TableHead className="text-right">Betrag</TableHead>
          <TableHead>Projekt</TableHead>
          <TableHead>Kunde</TableHead>
          <TableHead>Aktueller Step</TableHead>
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
