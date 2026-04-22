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
}

export function HeroPipelinePanel({
  department,
  pipeline,
}: HeroPipelinePanelProps) {
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
        />
        <KpiTile
          label="Überfällig"
          value={pipeline.totalOverdue}
          tone={pipeline.totalOverdue > 0 ? "warning" : "neutral"}
          icon={<AlertTriangle className="h-4 w-4" />}
          hint="offen & maturity_date < heute"
        />
        <KpiTile
          label="Buchhaltung offen"
          valueText={formatEur(pipeline.openInvoiceAmount)}
          tone="neutral"
          icon={<Euro className="h-4 w-4" />}
          hint={`${pipeline.openInvoiceCount} offene Rechnung${pipeline.openInvoiceCount === 1 ? "" : "en"}`}
        />
        <KpiTile
          label="Letzte Woche abgeschlossen"
          value={pipeline.completedLastWeek}
          tone="good"
          icon={<CheckCircle2 className="h-4 w-4" />}
          hint="Fr 00:00 → Do 23:59"
        />
        <KpiTile
          label="Neu diese Woche"
          value={pipeline.newThisWeek}
          tone="attention"
          icon={<ArrowDownRight className="h-4 w-4" />}
          hint="Fr 00:00 → heute"
        />
        <KpiTile
          label="Reopens (Nacharbeit)"
          value={pipeline.totalReopened}
          tone="good"
          icon={<RotateCcw className="h-4 w-4" />}
          hint="nach bereits erreichtem Abgeschlossen"
        />
      </div>

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
                    <TableHead>Fällig</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-mono text-xs">
                        {project.projectNumber ?? "–"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {project.projectName ?? "–"}
                          {project.wasReopened ? (
                            <Badge
                              variant="outline"
                              className="gap-1 border-emerald-500 text-emerald-600"
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
                      <TableCell className="text-xs text-muted-foreground">
                        {project.maturityDate
                          ? new Date(project.maturityDate).toLocaleDateString(
                              "de-DE"
                            )
                          : "–"}
                      </TableCell>
                    </TableRow>
                  ))}
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
}: {
  label: string;
  value?: number;
  valueText?: string;
  hint?: string;
  icon?: React.ReactNode;
  tone?: KpiTone;
}) {
  const toneClass = {
    neutral: "",
    good: "text-emerald-600",
    warning: "text-orange-600",
    attention: "text-rose-600",
  }[tone];

  return (
    <Card>
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
                  {step.reopenedCount > 0 ? (
                    <Badge
                      variant="outline"
                      className="h-5 gap-0.5 border-emerald-500 text-emerald-600 px-1.5"
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
