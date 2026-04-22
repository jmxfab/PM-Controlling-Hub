"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Calendar, Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DASHBOARD_DEPARTMENT_NAMES,
  DASHBOARD_DEPARTMENT_SHORT_LABELS,
  type Department,
} from "@/lib/dashboard/dashboard-types";
import type { UpcomingProject } from "@/lib/supabase/hero-maturity-queries";

export type UpcomingWindow = "overdue" | "today" | "tomorrow" | "next3d" | "next7d" | "next30d";

interface UpcomingViewProps {
  department: Department;
  window: UpcomingWindow;
  projects: UpcomingProject[];
}

const WINDOW_LABELS: Record<UpcomingWindow, string> = {
  overdue: "Überfällig",
  today: "Heute",
  tomorrow: "Morgen",
  next3d: "In 3 Tagen",
  next7d: "Nächste Woche",
  next30d: "30 Tage",
};

export function UpcomingView({
  department,
  window: activeWindow,
  projects,
}: UpcomingViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function updateParam(name: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set(name, value);
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }

  const overdue = projects.filter((p) => p.isOverdue);
  const dueToday = projects.filter((p) => !p.isOverdue && p.daysUntilDue === 0);
  const future = projects.filter((p) => !p.isOverdue && p.daysUntilDue > 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="space-y-2">
            <Label>Zeitfenster (nach Fälligkeitsdatum)</Label>
            <Tabs value={activeWindow} onValueChange={(v) => updateParam("window", v)}>
              <TabsList className="flex h-auto flex-wrap gap-1 bg-muted p-1">
                <TabsTrigger value="overdue" title="Fälligkeit in der Vergangenheit, Projekt noch offen">
                  Überfällig
                </TabsTrigger>
                <TabsTrigger value="today">Heute</TabsTrigger>
                <TabsTrigger value="tomorrow">Morgen</TabsTrigger>
                <TabsTrigger value="next3d">In 3 Tagen</TabsTrigger>
                <TabsTrigger value="next7d">Nächste Woche</TabsTrigger>
                <TabsTrigger value="next30d">30 Tage</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="space-y-2">
            <Label>Sparte</Label>
            <Tabs value={department} onValueChange={(v) => updateParam("department", v)}>
              <TabsList className="flex h-auto flex-wrap gap-1 bg-muted p-1">
                {(
                  ["GESAMT", "PV", "PV_GEWERBE", "WP", "KLIMA", "GEBAEUDETECHNIK"] as Department[]
                ).map((d) => (
                  <TabsTrigger key={d} value={d}>
                    {DASHBOARD_DEPARTMENT_SHORT_LABELS[d]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile
          label="Überfällig"
          value={overdue.length}
          tone="warning"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <SummaryTile
          label="Heute fällig"
          value={dueToday.length}
          tone="attention"
          icon={<Clock className="h-4 w-4" />}
        />
        <SummaryTile
          label="Zukünftig im Fenster"
          value={future.length}
          tone="neutral"
          icon={<Calendar className="h-4 w-4" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {WINDOW_LABELS[activeWindow]} ·{" "}
            {DASHBOARD_DEPARTMENT_NAMES[department]}
          </CardTitle>
          <CardDescription>
            {isPending
              ? "Lade Projekte…"
              : `${projects.length} Projekt${projects.length === 1 ? "" : "e"} mit Fälligkeit in diesem Zeitraum. Überfällige zuerst, dann sortiert nach Fälligkeitsdatum.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <div className="text-sm text-muted-foreground py-12 text-center border border-dashed rounded-md">
              Keine Projekte mit Fälligkeit in diesem Fenster.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fällig</TableHead>
                  <TableHead>Projekt-Nr.</TableHead>
                  <TableHead>Titel / Kunde</TableHead>
                  <TableHead>Step</TableHead>
                  <TableHead>Sparte</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((p) => (
                  <TableRow
                    key={p.id}
                    className={p.isOverdue ? "bg-destructive/5" : undefined}
                  >
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span
                          className={`font-mono text-xs ${
                            p.isOverdue ? "text-destructive font-semibold" : ""
                          }`}
                        >
                          {p.maturityDate
                            ? new Date(p.maturityDate).toLocaleDateString(
                                "de-DE"
                              )
                            : "–"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {p.isOverdue
                            ? `vor ${Math.abs(p.daysUntilDue)} Tg`
                            : p.daysUntilDue === 0
                              ? "heute"
                              : `in ${p.daysUntilDue} Tg`}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {p.projectNumber ?? "–"}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <span className="block truncate max-w-[280px]">
                          {p.projectName ?? p.customerName ?? "–"}
                        </span>
                        {p.customerName && p.projectName ? (
                          <span className="block text-xs text-muted-foreground">
                            {p.customerName}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{p.stepName ?? "–"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {p.department
                          ? DASHBOARD_DEPARTMENT_SHORT_LABELS[p.department]
                          : "–"}
                      </Badge>
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

function SummaryTile({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: "neutral" | "attention" | "warning";
  icon: React.ReactNode;
}) {
  const toneClass = {
    neutral: "",
    attention: "text-rose-600",
    warning: "text-yellow-600",
  }[tone];
  return (
    <Card>
      <CardContent className="pt-4 pb-4 space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          <span className={toneClass}>{icon}</span>
        </div>
        <div className={`text-2xl font-semibold tabular-nums ${toneClass}`}>
          {value.toLocaleString("de-DE")}
        </div>
      </CardContent>
    </Card>
  );
}
