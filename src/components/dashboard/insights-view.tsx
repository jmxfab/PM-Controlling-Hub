"use client";

import { Clock } from "lucide-react";
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
} from "@/lib/supabase/hero-insights-queries";
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
  }>;
  timeframeLabel?: string;
}

export function InsightsView({
  department,
  weekly,
  stepDurations,
  longestRunning,
  timeframeLabel,
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

  return (
    <div className="space-y-6">
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
              {longestRunning.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.projectNumber ?? "–"}</TableCell>
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
                    <Badge variant={p.ageDays > 365 ? "destructive" : "outline"} className="gap-1">
                      <Clock className="h-3 w-3" />
                      {p.ageDays} Tg
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
