"use client";

import { useState } from "react";
import { Clock, RotateCcw, Save, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  DailyThroughputPoint,
  InsightsRange,
  StepDurationRow,
  DurationMetric,
  KwpStats,
} from "@/lib/supabase/hero-insights-queries";
import type { HeroPipelineDto } from "@/lib/supabase/hero-pipeline-queries";
import { HeroPipelinePanel } from "./hero-pipeline-panel";
import { HeroProjectLink } from "./hero-project-link";
import {
  DataErrorBanner,
  type DataErrorEntry,
} from "./data-error-banner";
import {
  DASHBOARD_DEPARTMENT_NAMES,
  type Department,
} from "@/lib/dashboard/dashboard-types";

interface InsightsViewProps {
  department: Department;
  weekly: WeeklyThroughputPoint[];
  daily?: DailyThroughputPoint[];
  throughputRange?: InsightsRange | null;
  stepDurations: StepDurationRow[];
  longestRunning: Array<{
    id: string;
    projectNumber: string | null;
    projectName: string | null;
    stepName: string | null;
    customerName: string | null;
    ageDays: number;
    wasReopened?: boolean;
    ageResetAt?: string | null;
    ageResetNote?: string | null;
    ageResetReason?: "manual" | "auto-finished" | null;
  }>;
  durationMetrics?: DurationMetric[];
  kwpStats?: KwpStats | null;
  timeframeLabel?: string;
  pipeline?: HeroPipelineDto | null;
  heroProjectLinkTemplate?: string | null;
  loadErrors?: DataErrorEntry[];
}

interface ThroughputRow {
  newProjects: number;
  completed: number;
  accounting: number;
  rework: number;
  reopens: number;
  label: string;
}

export function InsightsView({
  department,
  weekly,
  daily,
  throughputRange,
  stepDurations,
  longestRunning,
  durationMetrics,
  kwpStats,
  timeframeLabel,
  pipeline,
  heroProjectLinkTemplate,
  loadErrors,
}: InsightsViewProps) {
  const deptName = DASHBOARD_DEPARTMENT_NAMES[department];
  const rangeSuffix = timeframeLabel ? ` · ${timeframeLabel}` : "";

  const useDaily = (daily?.length ?? 0) > 0 || (throughputRange ? rangeDays(throughputRange) <= 14 : false);
  const chartData: ThroughputRow[] = useDaily
    ? buildDailyChartRows(daily ?? [], throughputRange ?? null)
    : weekly.map((w) => ({
        newProjects: w.newProjects,
        completed: w.completed,
        accounting: w.accounting,
        rework: w.rework,
        reopens: w.reopens,
        label: new Date(w.weekStart).toLocaleDateString("de-DE", {
          day: "2-digit",
          month: "2-digit",
        }),
      }));
  const chartTitle = useDaily ? "Täglicher Flow" : "Wöchentlicher Flow";

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
      {loadErrors && loadErrors.length > 0 ? (
        <DataErrorBanner errors={loadErrors} />
      ) : null}
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
              (Regex auf „X kWp&ldquo;). Projekte ohne kWp-Angabe werden nicht
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
          <CardTitle>{chartTitle} — {deptName}{rangeSuffix}</CardTitle>
          <CardDescription>
            Neu angelegt (blau), Abgeschlossen (grün), In Abrechnung (gelb),
            Nacharbeit-Starts (rot), Reopens (lila).
            {useDaily
              ? " Tagesweise Auflösung mit allen Tagen im gewählten Zeitraum."
              : " Bei „Jetzt“ werden die letzten 12 Wochen gezeigt."}
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
            10. Bei „Jetzt&ldquo; werden die letzten 12 Monate zugrunde gelegt.
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
                <TableHead className="text-right w-44">Reset</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {longestRunning.map((p) => (
                <LongestRunningRow
                  key={p.id}
                  project={p}
                  heroProjectLinkTemplate={heroProjectLinkTemplate ?? null}
                  buildHeroHref={buildHeroHref}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function rangeDays(range: InsightsRange): number {
  const from = new Date(range.fromIso).getTime();
  const to = new Date(range.toIso).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.round((to - from) / (24 * 60 * 60 * 1000));
}

/**
 * Baut eine zusammenhängende Zeitreihe vom from-Tag bis zum to-Tag (exkl.).
 * Tage ohne Daten werden mit Nullen aufgefüllt, damit die X-Achse alle
 * Tage des Zeitraums zeigt — sonst würde Recharts nur die Tage anzeigen
 * an denen tatsächlich etwas passiert ist.
 */
function buildDailyChartRows(
  daily: DailyThroughputPoint[],
  range: InsightsRange | null
): ThroughputRow[] {
  const map = new Map(daily.map((d) => [d.dayStart, d]));

  const dates: string[] = [];
  if (range) {
    const fromDay = new Date(range.fromIso);
    const toDay = new Date(range.toIso);
    const cursor = new Date(
      Date.UTC(fromDay.getUTCFullYear(), fromDay.getUTCMonth(), fromDay.getUTCDate())
    );
    const end = new Date(
      Date.UTC(toDay.getUTCFullYear(), toDay.getUTCMonth(), toDay.getUTCDate())
    );
    while (cursor.getTime() < end.getTime()) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  } else {
    dates.push(...daily.map((d) => d.dayStart));
  }

  return dates.map((iso) => {
    const point = map.get(iso);
    return {
      newProjects: point?.newProjects ?? 0,
      completed: point?.completed ?? 0,
      accounting: point?.accounting ?? 0,
      rework: point?.rework ?? 0,
      reopens: point?.reopens ?? 0,
      label: new Date(`${iso}T12:00:00Z`).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
      }),
    };
  });
}

interface LongestRunningProject {
  id: string;
  projectNumber: string | null;
  projectName: string | null;
  stepName: string | null;
  customerName: string | null;
  ageDays: number;
  wasReopened?: boolean;
  ageResetAt?: string | null;
  ageResetNote?: string | null;
  ageResetReason?: "manual" | "auto-finished" | null;
}

function LongestRunningRow({
  project,
  heroProjectLinkTemplate,
  buildHeroHref,
}: {
  project: LongestRunningProject;
  heroProjectLinkTemplate: string | null;
  buildHeroHref: (id: string | null) => string | null;
}) {
  const heroHref = buildHeroHref(project.id);
  const initialDate = project.ageResetAt
    ? project.ageResetAt.slice(0, 10)
    : "";
  const [resetDate, setResetDate] = useState(initialDate);
  const [resetNote, setResetNote] = useState(project.ageResetNote ?? "");
  const [savedDate, setSavedDate] = useState(initialDate);
  const [savedNote, setSavedNote] = useState(project.ageResetNote ?? "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = resetDate !== savedDate || resetNote !== savedNote;

  async function save(opts?: { clear?: boolean }) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/age-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          age_reset_at: opts?.clear ? null : resetDate || null,
          age_reset_note: opts?.clear ? null : resetNote || null,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(typeof json?.error === "string" ? json.error : `HTTP ${res.status}`);
        return;
      }
      if (opts?.clear) {
        setResetDate("");
        setResetNote("");
        setSavedDate("");
        setSavedNote("");
      } else {
        setSavedDate(resetDate);
        setSavedNote(resetNote);
      }
      setEditing(false);
      // Soft refresh: reload nach 200ms damit der Server-Render frische
      // longestRunning-Daten holt (mit korrigiertem Alter).
      setTimeout(() => {
        window.location.reload();
      }, 200);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <TableRow>
      <TableCell>
        <HeroProjectLink
          projectId={project.id}
          projectNumber={project.projectNumber}
          linkTemplate={heroProjectLinkTemplate}
        />
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <span className="block">
            {project.projectName ?? project.customerName ?? "–"}
          </span>
          {project.customerName && project.projectName ? (
            <span className="block text-xs text-muted-foreground">
              {project.customerName}
            </span>
          ) : null}
          {heroHref ? (
            <a
              href={heroHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-primary hover:underline"
            >
              Im Hero öffnen →
            </a>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="text-sm">{project.stepName ?? "–"}</TableCell>
      <TableCell className="text-right">
        <div className="flex flex-col items-end gap-1">
          <Badge
            variant={project.ageDays > 365 ? "destructive" : "outline"}
            className="gap-1"
          >
            <Clock className="h-3 w-3" />
            {project.ageDays} Tg
          </Badge>
          {project.ageResetReason === "manual" ? (
            <Badge
              variant="outline"
              className="gap-1 border-blue-500 text-blue-600 text-[10px]"
              title={project.ageResetNote ?? "manuell zurückgesetzt"}
            >
              manuell
            </Badge>
          ) : project.ageResetReason === "auto-finished" ? (
            <Badge
              variant="outline"
              className="gap-1 border-yellow-500 text-yellow-600 text-[10px]"
              title="Alter ab letztem Verlassen von Abschlussrechnung/Bewertungspool/Archiv"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              auto
            </Badge>
          ) : project.wasReopened ? (
            <Badge
              variant="outline"
              className="gap-1 border-yellow-500 text-yellow-600 text-[10px]"
              title="Reopen aus Nacharbeit"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              reopen
            </Badge>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="text-right">
        {editing ? (
          <div className="flex flex-col gap-1 items-end">
            <Input
              type="date"
              value={resetDate}
              onChange={(e) => setResetDate(e.target.value)}
              className="h-7 w-[130px] text-xs"
            />
            <Input
              type="text"
              placeholder="Notiz (optional)"
              value={resetNote}
              onChange={(e) => setResetNote(e.target.value)}
              className="h-7 w-[170px] text-xs"
              maxLength={500}
            />
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                disabled={!dirty || saving || !resetDate}
                onClick={() => save()}
                title="Speichern"
              >
                <Save className="h-3 w-3" />
              </Button>
              {savedDate ? (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-destructive"
                  disabled={saving}
                  onClick={() => save({ clear: true })}
                  title="Reset löschen"
                >
                  <X className="h-3 w-3" />
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[10px]"
                disabled={saving}
                onClick={() => {
                  setEditing(false);
                  setResetDate(savedDate);
                  setResetNote(savedNote);
                }}
              >
                Abbr.
              </Button>
            </div>
            {error ? (
              <span className="text-[10px] text-destructive">{error}</span>
            ) : null}
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[11px]"
            onClick={() => setEditing(true)}
          >
            {savedDate
              ? `→ ${new Date(savedDate).toLocaleDateString("de-DE")}`
              : "Datum setzen"}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
