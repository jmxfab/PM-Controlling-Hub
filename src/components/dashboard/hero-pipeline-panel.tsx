"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Euro,
  RotateCcw,
} from "lucide-react";

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
  PipelineProjectRow,
} from "@/lib/supabase/hero-pipeline-queries";
import {
  DASHBOARD_DEPARTMENT_NAMES,
  type Department,
} from "@/lib/dashboard/dashboard-types";

interface HeroPipelinePanelProps {
  department: Department;
  pipeline: HeroPipelineDto;
  /**
   * URL-Template für Hero-Projekt-Deep-Links (Platzhalter "{projectId}").
   * Wenn gesetzt, wird die Projekt-Nr. zum klickbaren Link ins Hero-Projekt.
   */
  heroProjectLinkTemplate?: string | null;
}

export function HeroPipelinePanel({
  department,
  pipeline,
  heroProjectLinkTemplate,
}: HeroPipelinePanelProps) {
  const buildHeroHref = (projectId: string | null): string | null => {
    if (!heroProjectLinkTemplate || !projectId) return null;
    return heroProjectLinkTemplate.replace("{projectId}", projectId);
  };
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <KpiTile
          label="Alle Offenen"
          value={pipeline.totalOpen}
          hint={`von ${pipeline.totalProjects} Projekten`}
          explain={`Anzahl Projekte deren aktueller Step weder "Abgeschlossen" noch "Archiviert" ist. Von insgesamt ${pipeline.totalProjects} Projekten im Department. Momentaufnahme, unabhängig vom gewählten Zeitraum.`}
        />
        <KpiTile
          label="Überfällig"
          value={pipeline.totalOverdue}
          tone={pipeline.totalOverdue > 0 ? "warning" : "neutral"}
          icon={<AlertTriangle className="h-4 w-4" />}
          hint="offen & Fälligkeitsdatum < heute"
          explain="Offene Projekte deren Fälligkeitsdatum (current_project_match_status.maturity_date) bereits in der Vergangenheit liegt. Signal für Projekte die ein neues Zieldatum brauchen."
        />
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
        />
        <KpiTile
          label="Letzte Woche abgeschlossen"
          value={pipeline.completedLastWeek}
          tone="good"
          icon={<CheckCircle2 className="h-4 w-4" />}
          hint="Fr 00:00 → Do 23:59"
          explain="Projekte die in der letzten Jumax-Berichtswoche (Freitag 00:00 bis Donnerstag 23:59 der Vorwoche) auf Abgeschlossen/Archiviert gesetzt wurden. Quelle: Hero-Status-Historie, completion_date."
        />
        <KpiTile
          label="Neu diese Woche"
          value={pipeline.newThisWeek}
          tone="attention"
          icon={<ArrowDownRight className="h-4 w-4" />}
          hint="Fr 00:00 → heute"
          explain="Projekte die seit letztem Freitag 00:00 (Beginn der aktuellen Jumax-Woche) in Hero neu angelegt wurden. Quelle: created_at aus Hero (nicht das Supabase-Sync-Datum)."
        />
        <KpiTile
          label="Reopens (Nacharbeit)"
          value={pipeline.totalReopened}
          tone="warning"
          icon={<RotateCcw className="h-4 w-4" />}
          hint="nach bereits erreichtem Abgeschlossen"
          explain="Offene Projekte die in ihrer Status-Historie einmal auf Abgeschlossen oder Archiviert standen und jetzt wieder in einem offenen Step sind (typisch Nacharbeit/Reklamation). Erkennung: last_rework_at > last_finish_at in project_match_statuses."
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
              />
              <KpiTile
                label="Abgeschlossen"
                value={pipeline.timeframeDelta.completedTransitions}
                tone="good"
                icon={<CheckCircle2 className="h-4 w-4" />}
                explain="Status-Wechsel IN den Step Abgeschlossen oder Archiviert im Zeitraum. Ein Projekt kann mehrfach zählen wenn es reopened und wieder abgeschlossen wurde."
              />
              <KpiTile
                label="In Abrechnung"
                value={pipeline.timeframeDelta.accountingTransitions}
                tone="neutral"
                icon={<Euro className="h-4 w-4" />}
                explain="Status-Wechsel in einen Abrechnungs-Step (Abschlussrechnung, Kundenrechnung, Schlussrechnung, Teil-RG, Teilrechnung) im Zeitraum."
              />
              <KpiTile
                label="Nacharbeit-Starts"
                value={pipeline.timeframeDelta.reworkTransitions}
                tone="warning"
                icon={<RotateCcw className="h-4 w-4" />}
                explain="Status-Wechsel in einen Nacharbeits- oder Reklamations-Step im Zeitraum. Inklusive erste Nacharbeit + Reopens."
              />
              <KpiTile
                label="Reopens"
                value={pipeline.timeframeDelta.reopenedTransitions}
                tone="warning"
                icon={<RotateCcw className="h-4 w-4" />}
                hint="nach vorher Abgeschlossen"
                explain="Teilmenge der Nacharbeit-Starts: das Projekt war zum Start-Zeitpunkt des Zeitraums schon einmal in Abgeschlossen oder Archiviert. Signal für zurückgerollte Projekte."
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
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
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
          <CardContent className="space-y-3">
            <StepList
              title="Offene Steps"
              steps={activeSteps}
              selected={selected}
              onToggle={toggleStep}
            />
            <StepList
              title="Abgeschlossen / Archiviert"
              steps={finishedSteps}
              selected={selected}
              onToggle={toggleStep}
              muted
            />

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
                    const heroHref = buildHeroHref(project.id);
                    return (
                    <TableRow
                      key={project.id}
                      className={heroHref ? "cursor-pointer hover:bg-accent/40" : undefined}
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
                      <TableCell className="font-mono text-xs">
                        {heroHref ? (
                          <a
                            href={heroHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {project.projectNumber ?? "–"}
                          </a>
                        ) : (
                          project.projectNumber ?? "–"
                        )}
                      </TableCell>
                      <TableCell>
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
                      <TableCell className="text-sm text-muted-foreground">
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
}: {
  label: string;
  value?: number;
  valueText?: string;
  hint?: string;
  icon?: React.ReactNode;
  tone?: KpiTone;
  /** Detaillierter Erklärtext beim Hover über die ganze Kachel. */
  explain?: string;
}) {
  const toneClass = {
    neutral: "",
    good: "text-emerald-600",
    warning: "text-yellow-600",
    attention: "text-rose-600",
  }[tone];

  const card = (
    <Card className="cursor-help transition-colors hover:border-primary/40">
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

  if (!explain) return card;

  return (
    <TooltipProvider delayDuration={180}>
      <Tooltip>
        <TooltipTrigger asChild>{card}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
          <p className="font-semibold mb-1">{label}</p>
          <p>{explain}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function StepList({
  title,
  steps,
  selected,
  onToggle,
  muted,
}: {
  title: string;
  steps: HeroPipelineDto["steps"];
  selected: Set<string>;
  onToggle: (id: string) => void;
  muted?: boolean;
}) {
  if (steps.length === 0) return null;

  return (
    <div className="space-y-1">
      <p
        className={`text-xs uppercase tracking-wide ${
          muted ? "text-muted-foreground/60" : "text-muted-foreground"
        }`}
      >
        {title}
      </p>
      <ul className="space-y-0.5">
        {steps.map((step) => {
          const checked = selected.has(step.id);
          return (
            <li key={step.id}>
              <label
                className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer transition-colors ${
                  checked ? "bg-accent" : "hover:bg-accent/40"
                } ${muted ? "text-muted-foreground" : ""}`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => onToggle(step.id)}
                  />
                  <span className="truncate">{step.name}</span>
                </span>
                <span className="flex items-center gap-1 shrink-0 text-xs tabular-nums">
                  {step.periodEnteredCount != null && step.periodEnteredCount > 0 ? (
                    <Badge
                      variant="outline"
                      className="h-5 gap-0.5 border-blue-500 text-blue-600 px-1.5"
                      title={`${step.periodEnteredCount} Projekte sind im gewählten Zeitraum in diesen Step gewandert`}
                    >
                      <ArrowDownRight className="h-3 w-3" />
                      {step.periodEnteredCount}
                    </Badge>
                  ) : null}
                  {step.reopenedCount > 0 ? (
                    <Badge
                      variant="outline"
                      className="h-5 gap-0.5 border-yellow-500 text-yellow-600 px-1.5"
                      title={`${step.reopenedCount} davon Reopens (erneut in Nacharbeit)`}
                    >
                      <RotateCcw className="h-3 w-3" />
                      {step.reopenedCount}
                    </Badge>
                  ) : null}
                  {step.overdueCount > 0 ? (
                    <Badge
                      variant="outline"
                      className="h-5 gap-0.5 border-rose-500 text-rose-600 px-1.5"
                      title={`${step.overdueCount} überfällig`}
                    >
                      <ArrowUpRight className="h-3 w-3" />
                      {step.overdueCount}
                    </Badge>
                  ) : null}
                  <span className="font-mono">{step.projectCount}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
