"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  CheckSquare,
  Euro,
  RotateCcw,
} from "lucide-react";

import { STEP_CATEGORIES, type StepCategory } from "@/lib/hero/step-classifier";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  HeroPipelineDto,
  PipelineKpi,
  PipelineProjectRow,
} from "@/lib/supabase/hero-pipeline-queries";
import {
  DASHBOARD_DEPARTMENT_NAMES,
  type Department,
} from "@/lib/dashboard/dashboard-types";
import { HeroProjectLink } from "./hero-project-link";

interface HeroPipelinePanelProps {
  department: Department;
  pipeline: HeroPipelineDto;
  /**
   * URL-Template für Hero-Projekt-Deep-Links (Platzhalter "{projectId}").
   * Wenn gesetzt, wird die Projekt-Nr. zum klickbaren Link ins Hero-Projekt.
   */
  heroProjectLinkTemplate?: string | null;
  /**
   * "operational" (Default) = Fokus auf Bewegung/Termine/Überfälligkeit —
   * keine €-Badges an den Steps, keine "Buchhaltung offen"-Kachel oben.
   * "cash" = Fokus auf Geld — jeder Step zeigt offene Rechnungssumme,
   * die Buchhaltung-offen-Kachel ist prominent.
   */
  variant?: "operational" | "cash";
}

const KPI_LABELS: Record<PipelineKpi, string> = {
  all_open: "Alle Offenen",
  overdue: "Überfällig",
  accounting_open: "Buchhaltung offen",
  completed_last_week: "Letzte Woche abgeschlossen",
  new_this_week: "Neu diese Woche",
  reopens: "Reopens (Nacharbeit)",
  delta_new: "Neu angelegt",
  delta_completed: "Abgeschlossen",
  delta_accounting: "In Abrechnung",
  delta_rework: "Nacharbeit-Starts",
  delta_reopens: "Reopens (Zeitraum)",
  delta_overdue_became: "Neu überfällig",
};

export function HeroPipelinePanel({
  department,
  pipeline,
  heroProjectLinkTemplate,
  variant = "operational",
}: HeroPipelinePanelProps) {
  const showEur = variant === "cash";
  const buildHeroHref = (projectId: string | null): string | null => {
    if (!heroProjectLinkTemplate || !projectId) return null;
    return heroProjectLinkTemplate.replace("{projectId}", projectId);
  };

  // KPI-Detail-Dialog: zeigt die Projekte hinter einer Kachelzahl.
  const [activeKpi, setActiveKpi] = useState<PipelineKpi | null>(null);
  const [kpiProjects, setKpiProjects] = useState<PipelineProjectRow[]>([]);
  const [kpiLoading, setKpiLoading] = useState(false);

  async function openKpi(kpi: PipelineKpi) {
    setActiveKpi(kpi);
    setKpiProjects([]);
    setKpiLoading(true);
    try {
      const params = new URLSearchParams({ department, kpi });
      if (pipeline.timeframeDelta) {
        params.set("rangeFrom", pipeline.timeframeDelta.fromIso);
        params.set("rangeTo", pipeline.timeframeDelta.toIso);
        params.set("rangeDirection", "past");
      }
      const response = await fetch(
        `/api/dashboard/pipeline-kpi-projects?${params.toString()}`
      );
      if (response.ok) {
        const payload = (await response.json()) as {
          projects: PipelineProjectRow[];
        };
        setKpiProjects(payload.projects ?? []);
      }
    } catch {
      setKpiProjects([]);
    } finally {
      setKpiLoading(false);
    }
  }
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [projects, setProjects] = useState<PipelineProjectRow[]>([]);
  const [loading, setLoading] = useState(false);

  const activeSteps = useMemo(
    () => pipeline.steps.filter((step) => !step.isFinished),
    [pipeline.steps]
  );
  const finishedSteps = useMemo(
    () => pipeline.steps.filter((step) => step.isFinished),
    [pipeline.steps]
  );

  async function refreshProjects(nextSelection: Set<string>) {
    const keys = Array.from(nextSelection);
    if (keys.length === 0) {
      setProjects([]);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        department,
        steps: keys.join("||"),
      });
      if (pipeline.timeframeDelta) {
        params.set("rangeFrom", pipeline.timeframeDelta.fromIso);
        params.set("rangeTo", pipeline.timeframeDelta.toIso);
        params.set("rangeDirection", "past");
      }
      const response = await fetch(
        `/api/dashboard/pipeline-projects?${params.toString()}`
      );
      if (!response.ok) {
        setProjects([]);
        return;
      }
      const payload = (await response.json()) as {
        projects: PipelineProjectRow[];
      };
      setProjects(payload.projects ?? []);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }

  function toggleStep(stepKey: string) {
    const next = new Set(selected);
    if (next.has(stepKey)) {
      next.delete(stepKey);
    } else {
      next.add(stepKey);
    }
    setSelected(next);
    void refreshProjects(next);
  }

  function clearSelection() {
    const empty = new Set<string>();
    setSelected(empty);
    setProjects([]);
  }

  return (
    <div className="space-y-4">
      <div
        className={`grid gap-3 sm:grid-cols-2 ${
          showEur ? "lg:grid-cols-6" : "lg:grid-cols-5"
        }`}
      >
        <KpiTile
          label="Alle Offenen"
          value={pipeline.totalOpen}
          hint={`von ${pipeline.totalProjects} Projekten`}
          explain={`Anzahl Projekte deren aktueller Step weder "Abgeschlossen" noch "Archiviert" ist. Von insgesamt ${pipeline.totalProjects} Projekten im Department. Momentaufnahme, unabhängig vom gewählten Zeitraum.`}
          onClick={() => openKpi("all_open")}
        />
        <KpiTile
          label="Überfällig"
          value={pipeline.totalOverdue}
          tone={pipeline.totalOverdue > 0 ? "warning" : "neutral"}
          icon={<AlertTriangle className="h-4 w-4" />}
          hint="offen & Fälligkeitsdatum < heute"
          explain="Offene Projekte deren Fälligkeitsdatum (current_project_match_status.maturity_date) bereits in der Vergangenheit liegt. Signal für Projekte die ein neues Zieldatum brauchen."
          onClick={() => openKpi("overdue")}
        />
        {showEur ? (
          <KpiTile
            label="Buchhaltung offen"
            valueText={formatEur(pipeline.openInvoiceAmount)}
            tone="neutral"
            icon={<Euro className="h-4 w-4" />}
            hint={
              pipeline.openInvoiceCount > 0
                ? `${pipeline.openInvoiceCount} Rechnung${
                    pipeline.openInvoiceCount === 1 ? "" : "en"
                  } · Projekte in Abschluss-/Teilrechnungs-Step`
                : "keine Projekte in Abrechnungs-Step"
            }
            explain={`Summe der offenen Rechnungsbeträge (Hero status_code 100 "Erstellt" + 200 "Versendet"; storniert/gelöscht ausgeschlossen) aller Projekte die AKTUELL in einem Abrechnungs-Step stehen: Abschlussrechnung, Kundenrechnung, Schlussrechnung, Teil-RG (1./2./…), Teilrechnung.`}
            onClick={() => openKpi("accounting_open")}
          />
        ) : null}
        <KpiTile
          label="Letzte Woche abgeschlossen"
          value={pipeline.completedLastWeek}
          tone="good"
          icon={<CheckCircle2 className="h-4 w-4" />}
          hint="Fr 00:00 → Do 23:59"
          explain="Projekte die in der letzten Jumax-Berichtswoche (Freitag 00:00 bis Donnerstag 23:59 der Vorwoche) auf Abgeschlossen/Archiviert gesetzt wurden. Quelle: Hero-Status-Historie, completion_date."
          onClick={() => openKpi("completed_last_week")}
        />
        <KpiTile
          label="Neu diese Woche"
          value={pipeline.newThisWeek}
          tone="attention"
          icon={<ArrowDownRight className="h-4 w-4" />}
          hint="Fr 00:00 → heute"
          explain="Projekte die seit letztem Freitag 00:00 (Beginn der aktuellen Jumax-Woche) in Hero neu angelegt wurden. Quelle: created_at aus Hero (nicht das Supabase-Sync-Datum)."
          onClick={() => openKpi("new_this_week")}
        />
        <KpiTile
          label="Reopens (Nacharbeit)"
          value={pipeline.totalReopened}
          tone="warning"
          icon={<RotateCcw className="h-4 w-4" />}
          hint="nach bereits erreichtem Abgeschlossen"
          explain="Offene Projekte die in ihrer Status-Historie einmal auf Abgeschlossen oder Archiviert standen und jetzt wieder in einem offenen Step sind (typisch Nacharbeit/Reklamation). Erkennung: last_rework_at > last_finish_at in project_match_statuses."
          onClick={() => openKpi("reopens")}
        />
      </div>

      {pipeline.timeframeDelta ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Änderungen im Zeitraum</CardTitle>
            <CardDescription>
              Alle Status-Bewegungen zwischen{" "}
              {new Date(pipeline.timeframeDelta.fromIso).toLocaleDateString(
                "de-DE"
              )}{" "}
              und{" "}
              {new Date(
                new Date(pipeline.timeframeDelta.toIso).getTime() - 1
              ).toLocaleDateString("de-DE")}
              .
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <KpiTile
                label="Neu angelegt"
                value={pipeline.timeframeDelta.newProjects}
                tone="attention"
                icon={<ArrowDownRight className="h-4 w-4" />}
                explain="Projekte deren allererster Status-Eintrag in Hero im gewählten Zeitraum liegt. Damit ist das Projekt in diesem Fenster neu aufgenommen worden."
                onClick={() => openKpi("delta_new")}
              />
              <KpiTile
                label="In Abrechnung"
                value={pipeline.timeframeDelta.accountingTransitions}
                tone="neutral"
                icon={<Euro className="h-4 w-4" />}
                hint={
                  pipeline.timeframeDelta.accountingTransitionsAmount > 0
                    ? formatEur(
                        pipeline.timeframeDelta.accountingTransitionsAmount
                      )
                    : undefined
                }
                explain="Status-Wechsel in einen Abrechnungs-Step (Abschlussrechnung, Kundenrechnung, Schlussrechnung, Teil-RG, Teilrechnung) im Zeitraum. Betrag = Summe der offenen Rechnungen dieser Projekte."
                onClick={() => openKpi("delta_accounting")}
              />
              <KpiTile
                label="Nacharbeit-Starts"
                value={pipeline.timeframeDelta.reworkTransitions}
                tone="warning"
                icon={<RotateCcw className="h-4 w-4" />}
                explain="Status-Wechsel in einen Nacharbeits- oder Reklamations-Step im Zeitraum. Inklusive erste Nacharbeit + Reopens."
                onClick={() => openKpi("delta_rework")}
              />
              <KpiTile
                label="Reopens"
                value={pipeline.timeframeDelta.reopenedTransitions}
                tone="warning"
                icon={<RotateCcw className="h-4 w-4" />}
                hint="nach vorher Abgeschlossen"
                explain="Teilmenge der Nacharbeit-Starts: das Projekt war zum Start-Zeitpunkt des Zeitraums schon einmal in Abgeschlossen oder Archiviert. Signal für zurückgerollte Projekte."
                onClick={() => openKpi("delta_reopens")}
              />
              <KpiTile
                label="Neu überfällig"
                value={pipeline.timeframeDelta.overdueBecame}
                tone={
                  pipeline.timeframeDelta.overdueBecame > 0
                    ? "warning"
                    : "neutral"
                }
                icon={<AlertTriangle className="h-4 w-4" />}
                hint="Fälligkeit im Zeitraum"
                explain="Projekte deren aktuelles Fälligkeitsdatum im gewählten Zeitraum liegt UND die aktuell noch offen sind — also Termine die in diesem Fenster verstrichen sind (oder bevorstehen, falls Zeitraum in der Zukunft)."
                onClick={() => openKpi("delta_overdue_became")}
              />
              {/* Abgeschlossen bewusst ganz rechts + gedämpft — ist operativ
                  weniger relevant als die anderen Deltas. */}
              <KpiTile
                label="Abgeschlossen"
                value={pipeline.timeframeDelta.completedTransitions}
                tone="good"
                icon={<CheckCircle2 className="h-4 w-4" />}
                explain="Status-Wechsel IN den Step Abgeschlossen oder Archiviert im Zeitraum. Ein Projekt kann mehrfach zählen wenn es reopened und wieder abgeschlossen wurde."
                onClick={() => openKpi("delta_completed")}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[440px_minmax(0,1fr)]">
        <Card className="lg:sticky lg:top-4 h-fit">
          <CardHeader>
            <CardTitle className="text-base">
              Pipeline · {DASHBOARD_DEPARTMENT_NAMES[department]}
            </CardTitle>
            <CardDescription>
              Hero-Steps mit Projektanzahl. Mehrere Steps lassen sich
              kombinieren, um die Liste rechts zu filtern.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <GroupedStepList
              steps={activeSteps}
              selected={selected}
              onToggle={toggleStep}
              showEur={showEur}
            />
            {finishedSteps.length > 0 ? (
              <details className="group pt-2 border-t">
                <summary className="flex items-baseline justify-between gap-2 cursor-pointer text-xs uppercase tracking-wide text-muted-foreground/60 hover:text-muted-foreground py-1">
                  <span className="flex items-center gap-1">
                    <span className="transition-transform group-open:rotate-90">▸</span>
                    {STEP_CATEGORIES.fertig.label}
                  </span>
                  <span className="tabular-nums text-[10px]">
                    {finishedSteps.reduce((sum, s) => sum + s.projectCount, 0)}
                  </span>
                </summary>
                <div className="pt-2">
                  <StepList
                    title=""
                    steps={finishedSteps}
                    selected={selected}
                    onToggle={toggleStep}
                    muted
                    showEur={showEur}
                  />
                </div>
              </details>
            ) : null}

            {selected.size > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                className="w-full"
              >
                Auswahl zurücksetzen ({selected.size})
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Projekte</CardTitle>
            <CardDescription>
              {selected.size === 0
                ? "Wähle links einen oder mehrere Steps, um Projekte zu sehen."
                : `${projects.length} Projekt${projects.length === 1 ? "" : "e"} in der Auswahl.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selected.size === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-md">
                Keine Auswahl.
              </div>
            ) : loading ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                Lade Projekte…
              </div>
            ) : projects.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-md">
                Keine Projekte in den gewählten Steps.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Projekt-Nr.</TableHead>
                    <TableHead>Titel</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Step (vorher → aktuell)</TableHead>
                    <TableHead className="text-right">Offene RG</TableHead>
                    <TableHead>Fällig</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => {
                    return (
                    <TableRow key={project.id}>
                      <TableCell className="whitespace-nowrap">
                        <HeroProjectLink
                          projectId={project.id}
                          projectNumber={project.projectNumber}
                          linkTemplate={heroProjectLinkTemplate ?? null}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{project.projectName ?? "–"}</span>
                          {project.isNewInPeriod ? (
                            <Badge
                              variant="outline"
                              className="gap-1 border-rose-500 text-rose-600"
                              title="Im gewählten Zeitraum neu angelegt"
                            >
                              <ArrowDownRight className="h-3 w-3" />
                              Neu
                            </Badge>
                          ) : null}
                          {project.isCompletedInPeriod ? (
                            <Badge
                              variant="outline"
                              className="gap-1 border-emerald-500 text-emerald-600"
                              title="Im gewählten Zeitraum abgeschlossen"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Abgeschlossen
                            </Badge>
                          ) : null}
                          {project.isOverdue ? (
                            <Badge
                              variant="outline"
                              className="gap-1 border-orange-500 text-orange-600"
                              title={`Fälligkeit ${
                                project.maturityDate
                                  ? new Date(project.maturityDate).toLocaleDateString("de-DE")
                                  : ""
                              } bereits überschritten`}
                            >
                              <AlertTriangle className="h-3 w-3" />
                              Überfällig
                            </Badge>
                          ) : null}
                          {project.wasReopened ? (
                            <Badge
                              variant="outline"
                              className="gap-1 border-yellow-500 text-yellow-600"
                              title="Projekt wurde nach Abgeschlossen wieder geöffnet"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Reopen
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {project.customerName ?? "–"}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {project.previousStepName ? (
                            <>
                              <span
                                className="text-muted-foreground"
                                title={
                                  project.previousStepAt
                                    ? `bis ${new Date(
                                        project.previousStepAt
                                      ).toLocaleDateString("de-DE")}`
                                    : undefined
                                }
                              >
                                {project.previousStepName}
                              </span>
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            </>
                          ) : null}
                          <span className="font-medium">
                            {project.stepName ?? "–"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {project.openInvoiceAmount > 0
                          ? formatEur(project.openInvoiceAmount)
                          : <span className="text-muted-foreground">–</span>}
                        {project.openInvoiceCount > 0 ? (
                          <span className="block text-[10px] text-muted-foreground">
                            {project.openInvoiceCount}{" "}
                            Rechnung{project.openInvoiceCount === 1 ? "" : "en"}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {project.maturityDate
                          ? new Date(project.maturityDate).toLocaleDateString(
                              "de-DE"
                            )
                          : "–"}
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* KPI-Detail-Dialog: Projekte hinter einer Kachelzahl. */}
      <Dialog
        open={activeKpi !== null}
        onOpenChange={(open) => {
          if (!open) setActiveKpi(null);
        }}
      >
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {activeKpi ? KPI_LABELS[activeKpi] : ""} ·{" "}
              {DASHBOARD_DEPARTMENT_NAMES[department]}
            </DialogTitle>
            <DialogDescription>
              {kpiLoading
                ? "Lade Projekte…"
                : `${kpiProjects.length} Projekt${
                    kpiProjects.length === 1 ? "" : "e"
                  } in dieser KPI.`}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto">
            {kpiLoading ? (
              <div className="text-sm text-muted-foreground py-12 text-center">
                Lade Projekte…
              </div>
            ) : kpiProjects.length === 0 ? (
              <div className="text-sm text-muted-foreground py-12 text-center border border-dashed rounded-md">
                Keine Projekte in dieser KPI.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Projekt-Nr.</TableHead>
                    <TableHead>Titel</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Step</TableHead>
                    <TableHead>Fällig</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kpiProjects.map((project) => {
                    const heroHref = buildHeroHref(project.id);
                    return (
                      <TableRow
                        key={project.id}
                        className={
                          heroHref
                            ? "cursor-pointer hover:bg-accent/40"
                            : undefined
                        }
                        onClick={
                          heroHref
                            ? () =>
                                window.open(
                                  heroHref,
                                  "_blank",
                                  "noopener,noreferrer"
                                )
                            : undefined
                        }
                        title={heroHref ? "Im Hero öffnen" : undefined}
                      >
                        <TableCell>
                          <HeroProjectLink
                            projectId={project.id}
                            projectNumber={project.projectNumber}
                            linkTemplate={heroProjectLinkTemplate ?? null}
                          />
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{project.projectName ?? "–"}</span>
                            {project.isOverdue ? (
                              <Badge
                                variant="outline"
                                className="gap-1 border-orange-500 text-orange-600"
                              >
                                <AlertTriangle className="h-3 w-3" />
                                Überfällig
                              </Badge>
                            ) : null}
                            {project.wasReopened ? (
                              <Badge
                                variant="outline"
                                className="gap-1 border-yellow-500 text-yellow-600"
                              >
                                <RotateCcw className="h-3 w-3" />
                                Reopen
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {project.customerName ?? "–"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {project.stepName ?? "–"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {project.maturityDate
                            ? new Date(
                                project.maturityDate
                              ).toLocaleDateString("de-DE")
                            : "–"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type KpiTone = "neutral" | "good" | "warning" | "attention";

function formatEur(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function KpiTile({
  label,
  value,
  valueText,
  hint,
  icon,
  tone = "neutral",
  explain,
  onClick,
}: {
  label: string;
  value?: number;
  valueText?: string;
  hint?: string;
  icon?: React.ReactNode;
  tone?: KpiTone;
  /** Detaillierter Erklärtext beim Hover über die ganze Kachel. */
  explain?: string;
  /** Wenn gesetzt, wird die Kachel zum Button und öffnet den Detail-Dialog. */
  onClick?: () => void;
}) {
  const toneClass = {
    neutral: "",
    good: "text-emerald-600",
    warning: "text-yellow-600",
    attention: "text-rose-600",
  }[tone];

  const cursorClass = onClick
    ? "cursor-pointer hover:border-primary hover:shadow-sm"
    : "cursor-help hover:border-primary/40";

  const innerCard = (
    <Card className={`transition-all ${cursorClass}`}>
      <CardContent className="pt-4 pb-4 space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          {icon ? <span className={toneClass}>{icon}</span> : null}
        </div>
        <div
          className={`text-2xl font-semibold tabular-nums ${toneClass}`}
        >
          {valueText ?? (value ?? 0).toLocaleString("de-DE")}
        </div>
        {hint ? (
          <p className="text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );

  const card = onClick ? (
    <button
      type="button"
      onClick={onClick}
      className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
    >
      {innerCard}
    </button>
  ) : (
    innerCard
  );

  if (!explain) return card;

  return (
    <TooltipProvider delayDuration={180}>
      <Tooltip>
        <TooltipTrigger asChild>{card}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
          <p className="font-semibold mb-1">{label}</p>
          <p>{explain}</p>
          {onClick ? (
            <p className="mt-1 text-primary">Klicken → Projekte anzeigen</p>
          ) : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function formatEurShort(amount: number): string {
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toLocaleString("de-DE", { maximumFractionDigits: 1 })}M €`;
  }
  if (amount >= 1000) {
    return `${Math.round(amount / 1000).toLocaleString("de-DE")}k €`;
  }
  return `${Math.round(amount).toLocaleString("de-DE")} €`;
}

function StepList({
  title,
  steps,
  selected,
  onToggle,
  muted,
  description,
  showEur = false,
}: {
  title: string;
  steps: HeroPipelineDto["steps"];
  selected: Set<string>;
  onToggle: (id: string) => void;
  muted?: boolean;
  description?: string;
  showEur?: boolean;
}) {
  if (steps.length === 0) return null;

  return (
    <div className="space-y-1">
      {title ? (
        <div className="flex items-baseline justify-between gap-2">
          <p
            className={`text-xs uppercase tracking-wide font-medium ${
              muted ? "text-muted-foreground/60" : "text-muted-foreground"
            }`}
          >
            {title}
          </p>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {steps.reduce((sum, s) => sum + s.projectCount, 0)}
          </span>
        </div>
      ) : null}
      {description ? (
        <p className="text-[10px] text-muted-foreground/70 leading-snug">
          {description}
        </p>
      ) : null}
      <ul className="space-y-0.5">
        {steps.map((step) => {
          const checked = selected.has(step.id);
          const hasInvoice =
            showEur &&
            step.openInvoiceAmount != null &&
            step.openInvoiceAmount > 0;
          return (
            <li key={step.id}>
              <label
                className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer transition-colors ${
                  checked ? "bg-accent" : "hover:bg-accent/40"
                } ${muted ? "text-muted-foreground" : ""}`}
              >
                <span className="flex items-center gap-2 min-w-0 flex-1">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => onToggle(step.id)}
                  />
                  <span className="whitespace-nowrap">{step.name}</span>
                </span>
                <span className="flex items-center gap-1 shrink-0 text-xs tabular-nums flex-wrap justify-end">
                  {hasInvoice ? (
                    <Badge
                      variant="outline"
                      className="h-5 gap-0.5 border-emerald-500 text-emerald-600 px-1.5 font-mono"
                      title={`Summe offener Rechnungen in diesem Step: ${new Intl.NumberFormat(
                        "de-DE",
                        { style: "currency", currency: "EUR" }
                      ).format(step.openInvoiceAmount ?? 0)}`}
                    >
                      <Euro className="h-3 w-3" />
                      {formatEurShort(step.openInvoiceAmount ?? 0)}
                    </Badge>
                  ) : null}
                  {step.periodEnteredCount != null && step.periodEnteredCount > 0 ? (
                    <Badge
                      variant="outline"
                      className="h-5 gap-0.5 border-blue-500 text-blue-600 px-1.5"
                      title={`${step.periodEnteredCount} Projekte sind im gewählten Zeitraum in diesen Step gewandert (neu / geplant)`}
                    >
                      <ArrowDownRight className="h-3 w-3" />
                      {step.periodEnteredCount}
                    </Badge>
                  ) : null}
                  {step.periodLeftCount != null && step.periodLeftCount > 0 ? (
                    <Badge
                      variant="outline"
                      className="h-5 gap-0.5 border-emerald-600 text-emerald-700 px-1.5"
                      title={`${step.periodLeftCount} Projekte haben diesen Step im Zeitraum verlassen (bearbeitet)`}
                    >
                      <CheckSquare className="h-3 w-3" />
                      {step.periodLeftCount}
                    </Badge>
                  ) : null}
                  {step.reopenedCount > 0 ? (
                    <Badge
                      variant="outline"
                      className="h-5 gap-0.5 border-yellow-500 text-yellow-600 px-1.5"
                      title={`${step.reopenedCount} davon Reopens (erneut in Nacharbeit, obwohl Projekt schon weiter war)`}
                    >
                      <RotateCcw className="h-3 w-3" />
                      {step.reopenedCount}
                    </Badge>
                  ) : null}
                  {step.overdueCount > 0 ? (
                    <Badge
                      variant="outline"
                      className="h-5 gap-0.5 border-red-600 text-red-600 px-1.5"
                      title={`${step.overdueCount} überfällig in diesem Step`}
                    >
                      <AlertTriangle className="h-3 w-3" />
                      {step.overdueCount}
                    </Badge>
                  ) : null}
                  <span className="font-mono ml-1">{step.projectCount}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Offene Steps gruppiert nach Kategorie (Akquise, Planung, Freigabe,
 * Montage, Nacharbeit, Bewertung, Abrechnung, Sonstige). Jede Kategorie
 * wird nur gezeigt wenn sie Steps enthält.
 */
function GroupedStepList({
  steps,
  selected,
  onToggle,
  showEur = false,
}: {
  steps: HeroPipelineDto["steps"];
  selected: Set<string>;
  onToggle: (id: string) => void;
  showEur?: boolean;
}) {
  const groups = useMemo(() => {
    const map = new Map<StepCategory, HeroPipelineDto["steps"]>();
    for (const step of steps) {
      const cat = step.category ?? "sonstige";
      const list = map.get(cat) ?? [];
      list.push(step);
      map.set(cat, list);
    }
    return Array.from(map.entries())
      .filter(([cat]) => cat !== "fertig")
      .sort(
        ([a], [b]) => STEP_CATEGORIES[a].order - STEP_CATEGORIES[b].order
      );
  }, [steps]);

  if (groups.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">
        Keine offenen Steps in dieser Auswahl.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map(([category, list]) => (
        <StepList
          key={category}
          title={STEP_CATEGORIES[category].label}
          description={STEP_CATEGORIES[category].description}
          steps={list}
          selected={selected}
          onToggle={onToggle}
          showEur={showEur}
        />
      ))}
    </div>
  );
}
