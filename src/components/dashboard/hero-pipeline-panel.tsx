"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";

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
    const ids = Array.from(nextSelection);
    if (ids.length === 0) {
      setProjects([]);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        department,
        steps: ids.join(","),
      });
      const response = await fetch(
        `/api/dashboard/pipeline-projects?${params.toString()}`
      );
      if (!response.ok) {
        setProjects([]);
        return;
      }
      const payload = (await response.json()) as { projects: PipelineProjectRow[] };
      setProjects(payload.projects ?? []);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }

  function toggleStep(stepId: string) {
    const next = new Set(selected);
    if (next.has(stepId)) {
      next.delete(stepId);
    } else {
      next.add(stepId);
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
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="lg:sticky lg:top-4 h-fit">
        <CardHeader>
          <CardTitle className="text-base">
            Pipeline · {DASHBOARD_DEPARTMENT_NAMES[department]}
          </CardTitle>
          <CardDescription>
            Hero-Steps mit Projektanzahl. Mehrere Steps lassen sich
            kombinieren, um die Liste zu filtern.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary" className="gap-1">
              Alle Offenen
              <span className="font-mono">{pipeline.totalOpen}</span>
            </Badge>
            {pipeline.totalOverdue > 0 ? (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> Überfällig
                <span className="font-mono">{pipeline.totalOverdue}</span>
              </Badge>
            ) : null}
            <Badge variant="outline" className="gap-1">
              Gesamt
              <span className="font-mono">{pipeline.totalProjects}</span>
            </Badge>
          </div>

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
                  <TableHead>Step</TableHead>
                  <TableHead>Fällig</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-mono text-xs">
                      {project.projectNumber ?? "–"}
                    </TableCell>
                    <TableCell>{project.projectName ?? "–"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {project.customerName ?? "–"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {project.stepName ?? "–"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {project.maturityDate
                        ? new Date(project.maturityDate).toLocaleDateString("de-DE")
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
                <span className="font-mono text-xs tabular-nums shrink-0">
                  {step.projectCount}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
