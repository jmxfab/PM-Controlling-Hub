"use client";

import { Fragment, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  FileText,
  Loader2,
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
      description:
        "Aktuell offen (laut Hero unbezahlt), max. 7 Tage seit Rechnungsdatum — egal aus welchem Zeitraum",
    },
    {
      ...KPIS_BASE[2],
      description:
        "Aktuell offen (laut Hero unbezahlt) und mehr als 7 Tage seit Rechnungsdatum — egal aus welchem Zeitraum",
    },
    {
      ...KPIS_BASE[3],
      description: `Offenes Brutto-Volumen aller Projekte aktuell im Step: ${activeStepHumanList}`,
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
 *  und Open-Amount-Summe — sortiert absteigend nach Anzahl. EUR ist hier
 *  immer der NOCH OFFENE Betrag (booking_balance falls Teilzahlung,
 *  sonst voller Rechnungswert), nicht der Brutto-Gesamtwert. */
function summarizeTypes(
  rows: PvCashInvoiceRow[]
): { label: string; count: number; eur: number }[] {
  if (rows.length === 0) return [];
  const buckets = new Map<string, { count: number; eur: number }>();
  for (const r of rows) {
    const short = shortInvoiceType(r.derivedType);
    const cur = buckets.get(short) ?? { count: 0, eur: 0 };
    cur.count += 1;
    cur.eur += r.openAmount ?? 0;
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
    // Wir summieren openAmount (= booking_balance falls vorhanden, sonst
    // value). Bei Teilzahlung ist openAmount kleiner als value — wir
    // zeigen also den TATSAECHLICH offenen Betrag, nicht den vollen
    // Rechnungswert.
    return rows.reduce((sum, r) => sum + (r.openAmount ?? 0), 0);
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
        <DialogContent className="sm:max-w-[95vw] lg:max-w-[1400px] max-h-[90vh] overflow-hidden flex flex-col">
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

// Pro Zeile: collapsed → preview (letzte 3 Logbuch-Eintraege) → all
// (alle Eintraege). Jeder Klick auf das Chevron rotiert durch.
type ExpandState = "collapsed" | "preview" | "all";

interface LogbuchPreviewEntry {
  id: string;
  entry_date: string | null;
  event_type: string | null;
  user_email: string | null;
  author_name: string | null;
  custom_title: string | null;
  custom_text: string | null;
  description: string | null;
}

function InvoicesTable({
  rows,
  heroProjectLinkTemplate,
}: {
  rows: PvCashInvoiceRow[];
  heroProjectLinkTemplate: string | null;
}) {
  // Per-Rechnung-Zustand: collapsed | preview | all.
  const [expandState, setExpandState] = useState<Record<string, ExpandState>>(
    {}
  );

  if (rows.length === 0) {
    return (
      <p className="py-8 text-sm text-muted-foreground text-center italic">
        Keine Rechnungen.
      </p>
    );
  }
  // Sortiere: überfällig + ältester zuerst
  const sorted = [...rows].sort((a, b) => b.ageDays - a.ageDays);

  function cycleExpand(rowId: string) {
    setExpandState((prev) => {
      const cur = prev[rowId] ?? "collapsed";
      const next: ExpandState =
        cur === "collapsed" ? "preview" : cur === "preview" ? "all" : "collapsed";
      return { ...prev, [rowId]: next };
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8" />
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
        {sorted.map((r) => {
          const state = expandState[r.id] ?? "collapsed";
          const isOpen = state !== "collapsed";
          return (
            <Fragment key={r.id}>
              <TableRow
                className={cn(
                  "cursor-pointer hover:bg-accent/40",
                  isOpen && "bg-accent/30"
                )}
                onClick={() => cycleExpand(r.id)}
              >
                <TableCell className="w-8 text-muted-foreground">
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      isOpen && "rotate-180"
                    )}
                  />
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {r.fileUrl ? (
                    <a
                      href={r.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                      title="Rechnungs-PDF öffnen"
                      onClick={(e) => e.stopPropagation()}
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
                  <span onClick={(e) => e.stopPropagation()}>
                    <HeroProjectLink
                      projectId={r.projectId}
                      projectNumber={r.projectNumber}
                      linkTemplate={heroProjectLinkTemplate}
                    />
                  </span>
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
                    r.bookingBalance != null &&
                    r.value != null &&
                    r.bookingBalance < r.value ? (
                      <span className="text-amber-600 font-medium">
                        Teilzahlung ·{" "}
                        {eurFormatter.format(r.bookingBalance)} offen
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Offen</span>
                    )
                  ) : (
                    <span
                      className="text-muted-foreground italic"
                      title="Booking-Info noch nicht gesynct"
                    >
                      –
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  <span
                    className={cn(
                      r.isOverdue
                        ? "text-rose-600 font-semibold"
                        : "text-muted-foreground"
                    )}
                  >
                    {r.ageDays} Tg
                  </span>
                </TableCell>
              </TableRow>
              {isOpen ? (
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableCell colSpan={10} className="py-3">
                    <LogbuchInline
                      projectId={r.projectId}
                      mode={state}
                      onShowAll={() =>
                        setExpandState((prev) => ({ ...prev, [r.id]: "all" }))
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : null}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}

function LogbuchInline({
  projectId,
  mode,
  onShowAll,
}: {
  projectId: string | null;
  mode: "preview" | "all";
  onShowAll: () => void;
}) {
  const [entries, setEntries] = useState<LogbuchPreviewEntry[] | null>(null);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    const url =
      mode === "preview"
        ? `/api/logbuch/recent?project_id=${encodeURIComponent(projectId)}&limit=3`
        : `/api/logbuch?project_id=${encodeURIComponent(projectId)}&page_size=200`;
    let cancelled = false;
    // setState async deferren um den react-hooks/set-state-in-effect-Lint
    // (kein synchroner setState direkt im Effect-Body) sauber zu halten.
    const timeoutId = setTimeout(async () => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data: { entries: LogbuchPreviewEntry[]; total: number } =
          await r.json();
        if (cancelled) return;
        setEntries(data.entries ?? []);
        setTotal(data.total ?? data.entries?.length ?? 0);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [projectId, mode]);

  if (!projectId) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Keine Projekt-Verknüpfung — Logbuch nicht verfügbar.
      </p>
    );
  }
  if (loading && !entries) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        Lade Logbuch…
      </div>
    );
  }
  if (error) {
    return (
      <p className="text-xs text-rose-600">Fehler beim Laden: {error}</p>
    );
  }
  if (!entries || entries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Keine Logbuch-Einträge zu diesem Projekt.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
        <span>
          {mode === "preview"
            ? `Letzte ${entries.length} Logbuch-Einträge`
            : `Alle ${entries.length} Logbuch-Einträge`}
          {total > entries.length ? ` von ${total}` : ""}
        </span>
        {mode === "preview" && total > entries.length ? (
          <button
            type="button"
            onClick={onShowAll}
            className="text-primary hover:underline normal-case"
          >
            Alle {total} anzeigen
          </button>
        ) : null}
      </div>
      <ol className="space-y-1.5 border-l border-border ml-1 pl-4">
        {entries.map((e) => (
          <li key={e.id} className="text-xs">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-muted-foreground tabular-nums">
                {e.entry_date
                  ? new Date(e.entry_date).toLocaleString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "–"}
              </span>
              {e.author_name || e.user_email ? (
                <span className="font-medium">
                  {e.author_name ?? e.user_email}
                </span>
              ) : null}
              {e.event_type ? (
                <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                  {e.event_type}
                </span>
              ) : null}
            </div>
            {e.custom_title ? (
              <p className="font-medium mt-0.5">{e.custom_title}</p>
            ) : null}
            {e.custom_text ? (
              <p
                className="text-muted-foreground mt-0.5"
                // custom_text kann <br>, <i> etc. enthalten — wir vertrauen
                // Hero-Daten (kein User-Input direkt sondern Workflow-
                // generiert).
                dangerouslySetInnerHTML={{ __html: e.custom_text }}
              />
            ) : e.description ? (
              <p className="text-muted-foreground mt-0.5">{e.description}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
