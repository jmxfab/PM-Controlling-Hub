"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDownRight, CheckSquare, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import type { Department } from "@/lib/dashboard/dashboard-types";

type PeriodKpiKey = "delta_new" | "delta_completed" | "delta_reopens";

interface PeriodKpiDefinition {
  key: PeriodKpiKey;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CARD_DEFINITIONS: PeriodKpiDefinition[] = [
  {
    key: "delta_new",
    title: "Neu dazu",
    description: "Projekte die im Zeitraum neu aufgenommen wurden",
    icon: ArrowDownRight,
  },
  {
    key: "delta_completed",
    title: "Aus dem Step raus",
    description: "Projekte die im Zeitraum abgeschlossen / archiviert wurden",
    icon: CheckSquare,
  },
  {
    key: "delta_reopens",
    title: "Reopens",
    description: "Projekte die im Zeitraum nach Abschluss wieder geöffnet wurden",
    icon: RotateCcw,
  },
];

interface PeriodKpiProject {
  id: string;
  projectNumber: string | null;
  projectName: string | null;
  customerName: string | null;
  stepName: string | null;
  maturityDate: string | null;
  isOverdue?: boolean;
  wasReopened?: boolean;
}

interface PipelineRange {
  fromIso: string;
  toIso: string;
  direction: "past" | "future";
  label: string;
}

interface DashboardPeriodKpiCardsProps {
  department: Department;
  range: PipelineRange;
  timeframeLabel: string;
  counts: {
    newProjects: number;
    completedTransitions: number;
    reopenedTransitions: number;
  };
  heroProjectLinkTemplate: string | null;
}

export function DashboardPeriodKpiCards({
  department,
  range,
  timeframeLabel,
  counts,
  heroProjectLinkTemplate,
}: DashboardPeriodKpiCardsProps) {
  const [selected, setSelected] = useState<PeriodKpiKey | null>(null);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<PeriodKpiProject[]>([]);
  const [error, setError] = useState<string | null>(null);

  const valueByKey: Record<PeriodKpiKey, number> = {
    delta_new: counts.newProjects,
    delta_completed: counts.completedTransitions,
    delta_reopens: counts.reopenedTransitions,
  };

  const load = useCallback(
    async (kpi: PeriodKpiKey) => {
      setLoading(true);
      setError(null);
      setProjects([]);
      try {
        const params = new URLSearchParams({
          department,
          kpi,
          rangeFrom: range.fromIso,
          rangeTo: range.toIso,
          rangeDirection: range.direction,
        });
        const res = await fetch(
          `/api/dashboard/pipeline-kpi-projects?${params.toString()}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          setError(`Fehler beim Laden (HTTP ${res.status})`);
          return;
        }
        const json = (await res.json()) as { projects?: PeriodKpiProject[] };
        setProjects(json.projects ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [department, range.direction, range.fromIso, range.toIso]
  );

  useEffect(() => {
    if (selected) {
      load(selected);
    }
  }, [selected, load]);

  const selectedDefinition = selected
    ? CARD_DEFINITIONS.find((d) => d.key === selected)
    : null;

  const PERIOD_THEMES: Record<PeriodKpiKey, { iconBg: string; iconFg: string; accent: string }> = {
    delta_new: {
      iconBg: "bg-sky-100 dark:bg-sky-950/50",
      iconFg: "text-sky-600 dark:text-sky-400",
      accent: "group-hover:border-sky-300/50",
    },
    delta_completed: {
      iconBg: "bg-emerald-100 dark:bg-emerald-950/50",
      iconFg: "text-emerald-600 dark:text-emerald-400",
      accent: "group-hover:border-emerald-300/50",
    },
    delta_reopens: {
      iconBg: "bg-rose-100 dark:bg-rose-950/50",
      iconFg: "text-rose-600 dark:text-rose-400",
      accent: "group-hover:border-rose-300/50",
    },
  };

  return (
    <>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        {CARD_DEFINITIONS.map((def) => {
          const Icon = def.icon;
          const value = valueByKey[def.key];
          const theme = PERIOD_THEMES[def.key];
          return (
            <button
              key={def.key}
              type="button"
              aria-haspopup="dialog"
              className={cn(
                "group relative h-full overflow-hidden rounded-xl border bg-card text-left p-5",
                "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                theme.accent
              )}
              onClick={() => setSelected(def.key)}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                  {def.title}
                </p>
                <div
                  className={cn(
                    "shrink-0 grid place-items-center w-10 h-10 rounded-xl transition-transform group-hover:scale-110",
                    theme.iconBg
                  )}
                >
                  <Icon className={cn("h-5 w-5", theme.iconFg)} />
                </div>
              </div>
              <div className="text-4xl font-bold tabular-nums tracking-tight leading-none mb-2">
                {value.toLocaleString("de-DE")}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {def.description} · Zeitraum {timeframeLabel}
              </p>
            </button>
          );
        })}
      </div>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          {selectedDefinition ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedDefinition.title}</DialogTitle>
                <DialogDescription>
                  {selectedDefinition.description} · {timeframeLabel}
                  {!loading && !error ? ` · ${projects.length} Projekte` : null}
                </DialogDescription>
              </DialogHeader>
              <div className="overflow-y-auto">
                {loading ? (
                  <div className="text-sm text-muted-foreground py-12 text-center">
                    Lade Projekte…
                  </div>
                ) : error ? (
                  <div className="text-sm text-destructive py-12 text-center border border-dashed border-destructive/40 rounded-md">
                    {error}
                  </div>
                ) : projects.length === 0 ? (
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
                      {projects.map((project) => {
                        const heroHref =
                          heroProjectLinkTemplate && project.id
                            ? heroProjectLinkTemplate.replace(
                                "{projectId}",
                                project.id
                              )
                            : null;
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
                          >
                            <TableCell>
                              <HeroProjectLink
                                projectId={project.id}
                                projectNumber={project.projectNumber}
                                linkTemplate={heroProjectLinkTemplate}
                              />
                            </TableCell>
                            <TableCell className="text-sm">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span>{project.projectName ?? "–"}</span>
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
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
