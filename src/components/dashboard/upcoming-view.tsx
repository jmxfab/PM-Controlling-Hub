"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Calendar,
  Clock,
  Search,
  X,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { HeroProjectLink } from "./hero-project-link";

export type UpcomingWindow = "overdue" | "today" | "tomorrow" | "next3d" | "next7d" | "next30d";

interface UpcomingViewProps {
  department: Department;
  window: UpcomingWindow;
  projects: UpcomingProject[];
  heroProjectLinkTemplate?: string | null;
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
  heroProjectLinkTemplate,
}: UpcomingViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const buildHeroHref = (projectId: string | null): string | null => {
    if (!heroProjectLinkTemplate || !projectId) return null;
    return heroProjectLinkTemplate.replace("{projectId}", projectId);
  };

  function updateParam(name: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set(name, value);
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }

  // Client-side-Filter zusätzlich zu Zeitfenster/Sparte
  const [search, setSearch] = useState("");
  const [selectedSteps, setSelectedSteps] = useState<Set<string>>(new Set());
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  const availableSteps = useMemo(() => {
    const set = new Set<string>();
    for (const p of projects) {
      if (p.stepName) set.add(p.stepName);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "de"));
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (onlyOverdue && !p.isOverdue) return false;
      if (selectedSteps.size > 0) {
        if (!p.stepName || !selectedSteps.has(p.stepName)) return false;
      }
      if (q.length > 0) {
        const haystack = [
          p.projectNumber,
          p.projectName,
          p.customerName,
          p.stepName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [projects, search, selectedSteps, onlyOverdue]);

  function toggleStep(stepName: string) {
    setSelectedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepName)) next.delete(stepName);
      else next.add(stepName);
      return next;
    });
  }

  function resetFilters() {
    setSearch("");
    setSelectedSteps(new Set());
    setOnlyOverdue(false);
  }

  const activeFilterCount =
    (search.trim().length > 0 ? 1 : 0) +
    (selectedSteps.size > 0 ? 1 : 0) +
    (onlyOverdue ? 1 : 0);

  const overdue = filteredProjects.filter((p) => p.isOverdue);
  const dueToday = filteredProjects.filter(
    (p) => !p.isOverdue && p.daysUntilDue === 0
  );
  const future = filteredProjects.filter(
    (p) => !p.isOverdue && p.daysUntilDue > 0
  );

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

          {/* Zusatz-Filter: Suche + Step-Multi-Select + "nur überfällig" */}
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] items-end pt-1 border-t">
            <div className="space-y-2">
              <Label htmlFor="upcoming-search">Suche</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="upcoming-search"
                  placeholder="Projekt-Nr., Name oder Kunde…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Step</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-2"
                    disabled={availableSteps.length === 0}
                  >
                    Step
                    {selectedSteps.size > 0 ? (
                      <Badge variant="secondary" className="ml-1">
                        {selectedSteps.size}
                      </Badge>
                    ) : null}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 max-h-80 overflow-y-auto">
                  {availableSteps.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Keine Steps in der aktuellen Auswahl.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {availableSteps.map((step) => {
                        const checked = selectedSteps.has(step);
                        return (
                          <li key={step}>
                            <label className="flex items-center gap-2 rounded-md px-2 py-1 text-sm cursor-pointer hover:bg-accent/40">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => toggleStep(step)}
                              />
                              <span className="truncate">{step}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="upcoming-overdue">Status</Label>
              <label
                htmlFor="upcoming-overdue"
                className="flex items-center gap-2 h-9 rounded-md border px-3 text-sm cursor-pointer hover:bg-accent/40"
              >
                <Checkbox
                  id="upcoming-overdue"
                  checked={onlyOverdue}
                  onCheckedChange={(value) => setOnlyOverdue(value === true)}
                />
                Nur überfällig
              </label>
            </div>

            <div className="space-y-2">
              <Label className="invisible">Reset</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                disabled={activeFilterCount === 0}
                className="h-9 gap-1"
              >
                <X className="h-4 w-4" />
                Filter zurücksetzen
                {activeFilterCount > 0 ? (
                  <Badge variant="secondary" className="ml-1">
                    {activeFilterCount}
                  </Badge>
                ) : null}
              </Button>
            </div>
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
              : activeFilterCount > 0
                ? `${filteredProjects.length} von ${projects.length} Projekten nach Filter. Überfällige zuerst, dann sortiert nach Fälligkeitsdatum.`
                : `${filteredProjects.length} Projekt${filteredProjects.length === 1 ? "" : "e"} mit Fälligkeit in diesem Zeitraum. Überfällige zuerst, dann sortiert nach Fälligkeitsdatum.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredProjects.length === 0 ? (
            <div className="text-sm text-muted-foreground py-12 text-center border border-dashed rounded-md">
              {activeFilterCount > 0
                ? "Keine Projekte passen zu den gewählten Filtern."
                : "Keine Projekte mit Fälligkeit in diesem Fenster."}
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
                {filteredProjects.map((p) => {
                  const heroHref = buildHeroHref(p.id);
                  return (
                  <TableRow
                    key={p.id}
                    className={`${p.isOverdue ? "bg-destructive/5" : ""} ${
                      heroHref
                        ? "cursor-pointer hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                        : ""
                    }`}
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
                    role={heroHref ? "button" : undefined}
                    tabIndex={heroHref ? 0 : undefined}
                    onKeyDown={
                      heroHref
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              window.open(
                                heroHref,
                                "_blank",
                                "noopener,noreferrer"
                              );
                            }
                          }
                        : undefined
                    }
                    aria-label={
                      heroHref
                        ? `Im Hero öffnen: ${p.projectNumber ?? p.projectName ?? p.id}`
                        : undefined
                    }
                    title={heroHref ? "Im Hero öffnen" : undefined}
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
                    <TableCell>
                      <HeroProjectLink
                        projectId={p.id}
                        projectNumber={p.projectNumber}
                        linkTemplate={heroProjectLinkTemplate ?? null}
                      />
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
                  );
                })}
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
