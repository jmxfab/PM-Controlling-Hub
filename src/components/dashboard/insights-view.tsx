"use client";

import { Clock, RotateCcw } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
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
import type {
  WeeklyThroughputPoint,
  StepDurationRow,
  DurationMetric,
  KwpStats,
} from "@/lib/supabase/hero-insights-queries";
import type { HeroPipelineDto } from "@/lib/supabase/hero-pipeline-queries";
import { HeroPipelinePanel } from "./hero-pipeline-panel";
import { HeroProjectLink } from "./hero-project-link";
import {
  DASHBOARD_DEPARTMENT_NAMES,
  type Department,
} from "@/lib/dashboard/dashboard-types";

interface InsightsViewProps {
  department: Department;
  weekly: WeeklyThroughputPoint[];
  stepDurations: StepDurationRow[];
  longestRunning: Array<{
    id: string;
    projectNumber: string | null;
    projectName: string | null;
    stepName: string | null;
    customerName: string | null;
    ageDays: number;
    wasReopened?: boolean;
  }>;
  durationMetrics?: DurationMetric[];
  kwpStats?: KwpStats | null;
  timeframeLabel?: string;
  pipeline?: HeroPipelineDto | null;
  heroProjectLinkTemplate?: string | null;
}

export function InsightsView({
  department,
  weekly,
  stepDurations,
  longestRunning,
  durationMetrics,
  kwpStats,
  timeframeLabel,
  pipeline,
  heroProjectLinkTemplate,
}: InsightsViewProps) {
  const deptName = DASHBOARD_DEPARTMENT_NAMES[department];
  const rangeSuffix = timeframeLabel ? ` · ${timeframeLabel}` : "";
  const chartData = weekly.map((w) => ({
    ...w,
    label: new Date(w.weekStart).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
    }),
  }));

  const top10Durations = stepDurations.slice(0, 10).map((s) => ({
    name: s.stepName.length > 28 ? s.stepName.slice(0, 26) + "…" : s.stepName,
    avg: s.avgDays,
    median: s.medianDays,
    n: s.sampleSize,
  }));

  const buildHeroHref = (projectId: string | null): string | null => {
    if (!heroProjectLinkTemplate || !projectId) return null;
    return heroProjectLinkTemplate.replace("{projectId}", projectId);
  };

  return (
    <div className="space-y-6">
      {pipeline ? (
        <HeroPipelinePanel
          department={department}
          pipeline={pipeline}
          heroProjectLinkTemplate={heroProjectLinkTemplate ?? null}
        />
      ) : null}
      {kwpStats && kwpStats.projectsWithKwp > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Anlagenleistung — {deptName}</CardTitle>
            <CardDescription>
              kWp-Werte aus Maßnahmenbezeichnungen abgeschlossener Projekte
              (Regex auf „X kWp"). Projekte ohne kWp-Angabe werden nicht
              gezählt.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Gesamt installiert</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {kwpStats.totalKwp.toLocaleString("de-DE")} kWp
                </p>
              </div>
              <div className="rounded-md border p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Ø pro Projekt</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {kwpStats.avgKwp !== null
                    ? `${kwpStats.avgKwp.toLocaleString("de-DE")} kWp`
                    : "–"}
                </p>
              </div>
              <div className="rounded-md border p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Projekte mit kWp-Angabe</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {kwpStats.projectsWithKwp}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    / {kwpStats.projectsCompleted}
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {durationMetrics && durationMetrics.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Zeit-Metriken — {deptName}{rangeSuffix}</CardTitle>
            <CardDescription>
              Durchschnittliche und mediane Dauer pro Projekt-Phase. Basis:
              Status-Historie der im Zeitraum abgeschlossenen Projekte.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {durationMetrics.map((m) => (
                <div
                  key={m.label}
                  className="rounded-md border p-3 space-y-1"
                >
                  <p className="text-sm font-medium">{m.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.description}
                  </p>
                  <div className="flex items-baseline gap-4 pt-1">
                    <span className="text-2xl font-semibold tabular-nums">
                      {m.avgDays != null ? `${m.avgDays} Tg` : "–"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Median {m.medianDays != null ? `${m.medianDays} Tg` : "–"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      n={m.sampleSize}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Wöchentlicher Flow — {deptName}{rangeSuffix}</CardTitle>
          <CardDescription>
            Neu angelegt (blau), Abgeschlossen (grün), In Abrechnung (gelb),
            Nacharbeit-Starts (rot), Reopens (lila). Bei „Jetzt" werden die
            letzten 12 Wochen gezeigt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[340px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="newProjects" name="Neu" stroke="#3b82f6" strokeWidth={2} />
                <Line type="monotone" dataKey="completed" name="Abgeschlossen" stroke="#10b981" strokeWidth={2} />
                <Line type="monotone" dataKey="accounting" name="In Abrechnung" stroke="#f59e0b" strokeWidth={2} />
                <Line type="monotone" dataKey="rework" name="Nacharbeit" stroke="#ef4444" strokeWidth={2} />
                <Line type="monotone" dataKey="reopens" name="Reopens" stroke="#8b5cf6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Durchlaufzeit pro Step (Tage) — {deptName}{rangeSuffix}
          </CardTitle>
          <CardDescription>
            Ø + Median Tage die ein Projekt im jeweiligen Step verbringt. Top
            10. Bei „Jetzt" werden die letzten 12 Monate zugrunde gelegt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[360px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={top10Durations}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 120, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={120} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="avg" name="Ø Tage" fill="#3b82f6" />
                <Bar dataKey="median" name="Median Tage" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Älteste offene Projekte — {deptName}</CardTitle>
          <CardDescription>
            Projekte mit dem ältesten created-Datum die noch nicht
            Abgeschlossen sind. Nicht zeitraumabhängig — zeigt immer die
            aktuellen Dauerläufer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projekt-Nr.</TableHead>
                <TableHead>Titel / Kunde</TableHead>
                <TableHead>Aktueller Step</TableHead>
                <TableHead className="text-right">Alter</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {longestRunning.map((p) => {
                const heroHref = buildHeroHref(p.id);
                return (
                <TableRow
                  key={p.id}
                  className={heroHref ? "cursor-pointer hover:bg-accent/40" : undefined}
                  onClick={
                    heroHref
                      ? () => window.open(heroHref, "_blank", "noopener,noreferrer")
                      : undefined
                  }
                  title={heroHref ? "Im Hero öffnen" : undefined}
                >
                  <TableCell>
                    <HeroProjectLink
                      projectId={p.id}
                      projectNumber={p.projectNumber}
                      linkTemplate={heroProjectLinkTemplate ?? null}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <span className="block">{p.projectName ?? p.customerName ?? "–"}</span>
                      {p.customerName && p.projectName ? (
                        <span className="block text-xs text-muted-foreground">{p.customerName}</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{p.stepName ?? "–"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Badge variant={p.ageDays > 365 ? "destructive" : "outline"} className="gap-1">
                        <Clock className="h-3 w-3" />
                        {p.ageDays} Tg
                      </Badge>
                      {p.wasReopened ? (
                        <Badge
                          variant="outline"
                          className="gap-1 border-yellow-500 text-yellow-600"
                          title="Projekt war schon einmal abgeschlossen — Alter ab letztem Reopen"
                        >
                          <RotateCcw className="h-3 w-3" />
                          seit Reopen
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
