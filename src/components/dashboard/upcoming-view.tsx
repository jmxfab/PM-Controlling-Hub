"use client";

import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  FileSignature,
  RotateCcw,
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
import { cn } from "@/lib/utils";
import {
  DASHBOARD_DEPARTMENTS,
  DASHBOARD_DEPARTMENT_NAMES,
  DASHBOARD_DEPARTMENT_SHORT_LABELS,
  type Department,
} from "@/lib/dashboard/dashboard-types";
import type { UpcomingProject } from "@/lib/supabase/hero-maturity-queries";
import { HeroProjectLink } from "./hero-project-link";
import {
  DataErrorBanner,
  type DataErrorEntry,
} from "./data-error-banner";

export type UpcomingWindow =
  | "overdue"
  | "today"
  | "tomorrow"
  | "next3d"
  | "next7d"
  | "next30d"
  | "frei";

interface UpcomingViewProps {
  department: Department;
  window: UpcomingWindow;
  from: string | null;
  to: string | null;
  projects: UpcomingProject[];
  heroProjectLinkTemplate?: string | null;
  loadErrors?: DataErrorEntry[];
}

const WINDOW_LABELS: Record<UpcomingWindow, string> = {
  overdue: "Überfällig",
  today: "Heute",
  tomorrow: "Morgen",
  next3d: "In 3 Tagen",
  next7d: "Nächste Woche",
  next30d: "30 Tage",
  frei: "Frei",
};

export function UpcomingView({
  department,
  window: activeWindow,
  from: fromParam,
  to: toParam,
  projects,
  heroProjectLinkTemplate,
  loadErrors,
}: UpcomingViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const buildHeroHref = (projectId: string | null): string | null => {
    if (!heroProjectLinkTemplate || !projectId) return null;
    return heroProjectLinkTemplate.replace("{projectId}", projectId);
  };

  function updateParams(values: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }

  // Custom-Range Inputs (lokaler State, beim Apply via URL gepusht)
  // Sync mit URL-Params: wir berechnen den Initialwert direkt aus Props,
  // damit kein useEffect-Setter in einem Effect nötig ist. Beim Wechsel
  // der URL-Params re-mounten wir das Edit-State via useState-key-Trick.
  const fromKey = fromParam ?? "";
  const toKey = toParam ?? "";
  const [customFrom, setCustomFrom] = useState(fromKey);
  const [customTo, setCustomTo] = useState(toKey);
  const [syncedFromKey, setSyncedFromKey] = useState(fromKey);
  const [syncedToKey, setSyncedToKey] = useState(toKey);
  if (syncedFromKey !== fromKey || syncedToKey !== toKey) {
    // Render-time sync (kein Effekt nötig). React empfiehlt diesen Pattern
    // explizit für "external props → derived input state".
    setSyncedFromKey(fromKey);
    setSyncedToKey(toKey);
    setCustomFrom(fromKey);
    setCustomTo(toKey);
  }

  function applyCustomRange() {
    if (!customFrom || !customTo) return;
    let nf = customFrom;
    let nt = customTo;
    if (nf > nt) nt = nf;
    updateParams({ window: "frei", from: nf, to: nt });
  }

  function selectWindow(win: string) {
    if (win === "frei") {
      // Wenn keine Range gesetzt → Default auf nächste 14 Tage
      const today = new Date();
      const fromIso = today.toISOString().slice(0, 10);
      const to = new Date(today);
      to.setDate(to.getDate() + 14);
      const toIso = to.toISOString().slice(0, 10);
      updateParams({
        window: "frei",
        from: customFrom || fromParam || fromIso,
        to: customTo || toParam || toIso,
      });
      return;
    }
    updateParams({ window: win, from: null, to: null });
  }

  // Client-side-Filter
  const [search, setSearch] = useState("");
  const [selectedSteps, setSelectedSteps] = useState<Set<string>>(new Set());
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const availableSteps = useMemo(() => {
    const set = new Set<string>();
    for (const p of projects) if (p.stepName) set.add(p.stepName);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "de"));
  }, [projects]);

  const availableStatuses = useMemo(() => {
    const set = new Set<string>();
    for (const p of projects) if (p.statusName) set.add(p.statusName);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "de"));
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (onlyOverdue && !p.isOverdue) return false;
      if (selectedSteps.size > 0) {
        if (!p.stepName || !selectedSteps.has(p.stepName)) return false;
      }
      if (selectedStatuses.size > 0) {
        if (!p.statusName || !selectedStatuses.has(p.statusName)) return false;
      }
      if (q.length > 0) {
        const haystack = [
          p.projectNumber,
          p.projectName,
          p.customerName,
          p.stepName,
          p.statusName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [projects, search, selectedSteps, selectedStatuses, onlyOverdue]);

  function toggleStep(stepName: string) {
    setSelectedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepName)) next.delete(stepName);
      else next.add(stepName);
      return next;
    });
  }

  function toggleStatus(statusName: string) {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(statusName)) next.delete(statusName);
      else next.add(statusName);
      return next;
    });
  }

  function resetFilters() {
    setSearch("");
    setSelectedSteps(new Set());
    setSelectedStatuses(new Set());
    setOnlyOverdue(false);
  }

  const activeFilterCount =
    (search.trim().length > 0 ? 1 : 0) +
    (selectedSteps.size > 0 ? 1 : 0) +
    (selectedStatuses.size > 0 ? 1 : 0) +
    (onlyOverdue ? 1 : 0);

  const overdue = filteredProjects.filter((p) => p.isOverdue);
  const dueToday = filteredProjects.filter(
    (p) => !p.isOverdue && p.daysUntilDue === 0
  );
  const future = filteredProjects.filter(
    (p) => !p.isOverdue && p.daysUntilDue > 0
  );

  const customRangeDirty =
    !!customFrom &&
    !!customTo &&
    (customFrom !== (fromParam ?? "") || customTo !== (toParam ?? ""));

  return (
    <div className="space-y-4">
      {loadErrors && loadErrors.length > 0 ? (
        <DataErrorBanner
          errors={loadErrors}
          hint="Wenn das nach 1-2 Minuten und einem Reload immer noch erscheint, bitte Admin informieren."
        />
      ) : null}
      <Card className="rounded-xl shadow-sm">
        <CardContent className="pt-5 pb-5 space-y-4">
          <div className="space-y-2.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              Zeitfenster (nach Fälligkeitsdatum)
            </Label>
            <Tabs value={activeWindow} onValueChange={selectWindow}>
              <TabsList className="flex h-auto flex-wrap gap-1 bg-muted/60 p-1 rounded-lg">
                <TabsTrigger value="overdue" className="rounded-md data-[state=active]:shadow-sm data-[state=active]:bg-red-500 data-[state=active]:text-white text-red-600 dark:text-red-400 font-medium">
                  <AlertTriangle size={12} className="mr-1" />
                  Überfällig
                </TabsTrigger>
                <TabsTrigger value="today" className="rounded-md data-[state=active]:shadow-sm">Heute</TabsTrigger>
                <TabsTrigger value="tomorrow" className="rounded-md data-[state=active]:shadow-sm">Morgen</TabsTrigger>
                <TabsTrigger value="next3d" className="rounded-md data-[state=active]:shadow-sm">In 3 Tagen</TabsTrigger>
                <TabsTrigger value="next7d" className="rounded-md data-[state=active]:shadow-sm">Nächste Woche</TabsTrigger>
                <TabsTrigger value="next30d" className="rounded-md data-[state=active]:shadow-sm">30 Tage</TabsTrigger>
                <TabsTrigger value="frei" className="rounded-md data-[state=active]:shadow-sm">Frei</TabsTrigger>
              </TabsList>
            </Tabs>
            {activeWindow === "frei" ? (
              <div className="flex flex-wrap items-end gap-3 mt-3 border-t pt-3">
                <div className="space-y-1">
                  <Label htmlFor="upcoming-from" className="text-xs">
                    Von
                  </Label>
                  <Input
                    id="upcoming-from"
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="h-8 w-[150px] text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="upcoming-to" className="text-xs">
                    Bis
                  </Label>
                  <Input
                    id="upcoming-to"
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="h-8 w-[150px] text-sm"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={applyCustomRange}
                  disabled={!customRangeDirty}
                >
                  Anwenden
                </Button>
              </div>
            ) : null}
          </div>
          <div className="space-y-2.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              Sparte
            </Label>
            <Tabs
              value={department}
              onValueChange={(v) => updateParams({ department: v })}
            >
              <TabsList className="flex h-auto flex-wrap gap-1 bg-muted/60 p-1 rounded-lg">
                {/* Sparten-Tabs aus DASHBOARD_DEPARTMENTS — sichtbare Tabs
                    inkl. GESAMT (= PV+WP). PV_GEWERBE + KLIMA sind aktuell
                    ausgeblendet, kommen spaeter. */}
                {DASHBOARD_DEPARTMENTS.map((d) => (
                  <TabsTrigger key={d} value={d} className="rounded-md data-[state=active]:shadow-sm">
                    {DASHBOARD_DEPARTMENT_SHORT_LABELS[d]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] items-end pt-1 border-t">
            <div className="space-y-2">
              <Label htmlFor="upcoming-search">Suche</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="upcoming-search"
                  placeholder="Projekt-Nr., Name, Kunde, Status…"
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
                <PopoverContent
                  align="start"
                  className="w-64 max-h-80 overflow-y-auto"
                >
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
              <Label>Status</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-2"
                    disabled={availableStatuses.length === 0}
                  >
                    Status
                    {selectedStatuses.size > 0 ? (
                      <Badge variant="secondary" className="ml-1">
                        {selectedStatuses.size}
                      </Badge>
                    ) : null}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-64 max-h-80 overflow-y-auto"
                >
                  {availableStatuses.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Keine Status in der aktuellen Auswahl.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {availableStatuses.map((status) => {
                        const checked = selectedStatuses.has(status);
                        return (
                          <li key={status}>
                            <label className="flex items-center gap-2 rounded-md px-2 py-1 text-sm cursor-pointer hover:bg-accent/40">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => toggleStatus(status)}
                              />
                              <span className="truncate">{status}</span>
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
              <Label htmlFor="upcoming-overdue">Überfällig</Label>
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
                Reset
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

      <Card className="rounded-xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            {WINDOW_LABELS[activeWindow]} · {DASHBOARD_DEPARTMENT_NAMES[department]}
          </CardTitle>
          <CardDescription className="text-xs">
            {isPending
              ? "Lade Projekte…"
              : activeFilterCount > 0
                ? `${filteredProjects.length} von ${projects.length} Projekten · Klick zeigt Details + Logbuch`
                : `${filteredProjects.length} Projekt${filteredProjects.length === 1 ? "" : "e"} · Klick zeigt Details + Logbuch`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 py-16 px-4 text-center">
              <div className="rounded-full bg-muted/60 p-3 mb-3">
                <Calendar size={22} className="text-muted-foreground/70" />
              </div>
              <p className="text-sm font-medium">
                {activeFilterCount > 0
                  ? "Keine Treffer"
                  : "Keine Projekte mit Fälligkeit in diesem Fenster"}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                {activeFilterCount > 0
                  ? "Filter anpassen oder zurücksetzen."
                  : "Ein anderes Zeitfenster wählen, oder warten bis neue Fälligkeiten reinrutschen."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fällig</TableHead>
                  <TableHead>Projekt-Nr.</TableHead>
                  <TableHead>Titel / Kunde</TableHead>
                  <TableHead>Step</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sparte</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map((p) => {
                  const isExpanded = expandedId === p.id;
                  return (
                    <Fragment key={p.id}>
                      <TableRow
                        className={cn(
                          p.isOverdue ? "bg-destructive/5" : "",
                          "cursor-pointer hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset border-b-0"
                        )}
                        onClick={() =>
                          setExpandedId(isExpanded ? null : p.id)
                        }
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setExpandedId(isExpanded ? null : p.id);
                          }
                        }}
                      >
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span
                              className={`font-mono text-xs ${
                                p.isOverdue
                                  ? "text-destructive font-semibold"
                                  : ""
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
                        <TableCell
                          onClick={(e) => e.stopPropagation()}
                        >
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
                            {p.wasReopened ? (
                              <Badge
                                variant="outline"
                                className="gap-1 border-yellow-500 text-yellow-600 text-[10px] mt-0.5"
                              >
                                <RotateCcw className="h-2.5 w-2.5" />
                                Reopen
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {p.stepName ?? "–"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {p.statusName ?? "–"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {p.department
                              ? DASHBOARD_DEPARTMENT_SHORT_LABELS[p.department]
                              : "–"}
                          </Badge>
                        </TableCell>
                        <TableCell className="w-8 text-muted-foreground">
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 transition-transform",
                              isExpanded ? "rotate-180" : ""
                            )}
                          />
                        </TableCell>
                      </TableRow>
                      {isExpanded ? (
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={7} className="py-3">
                            <ProjectDetailExpand
                              project={p}
                              heroHref={buildHeroHref(p.id)}
                            />
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
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
  const toneConfig = {
    neutral: {
      value: "text-foreground",
      iconBg: "bg-blue-100 dark:bg-blue-950/50",
      iconFg: "text-blue-600 dark:text-blue-400",
      accent: "hover:border-blue-300/50",
    },
    attention: {
      value: "text-rose-700 dark:text-rose-400",
      iconBg: "bg-rose-100 dark:bg-rose-950/50",
      iconFg: "text-rose-600 dark:text-rose-400",
      accent: "hover:border-rose-300/50",
    },
    warning: {
      value: "text-amber-700 dark:text-amber-400",
      iconBg: "bg-amber-100 dark:bg-amber-950/50",
      iconFg: "text-amber-600 dark:text-amber-400",
      accent: "hover:border-amber-300/50",
    },
  }[tone];

  return (
    <div
      className={`relative h-full overflow-hidden rounded-xl border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${toneConfig.accent}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 leading-tight">
          {label}
        </p>
        <div
          className={`shrink-0 grid place-items-center w-10 h-10 rounded-xl ${toneConfig.iconBg} ${toneConfig.iconFg}`}
        >
          {icon}
        </div>
      </div>
      <div
        className={`text-3xl font-bold tabular-nums tracking-tight leading-none ${toneConfig.value}`}
      >
        {value.toLocaleString("de-DE")}
      </div>
    </div>
  );
}

interface RecentLogEntry {
  id: string;
  entry_date: string | null;
  user_email: string | null;
  description: string | null;
  custom_title: string | null;
  custom_text: string | null;
  author_name: string | null;
}

function ProjectDetailExpand({
  project,
  heroHref,
}: {
  project: UpcomingProject;
  heroHref: string | null;
}) {
  const [entries, setEntries] = useState<RecentLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/logbuch/recent?project_id=${encodeURIComponent(project.id)}&limit=3`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          if (!cancelled) setError(`HTTP ${res.status}`);
          return;
        }
        const json = (await res.json()) as {
          entries?: RecentLogEntry[];
          total?: number;
        };
        if (!cancelled) {
          setEntries(json.entries ?? []);
          setTotal(json.total ?? 0);
        }
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  return (
    <div className="space-y-3 text-sm">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <DetailField label="Aktueller Step" value={project.stepName ?? "–"} />
        <DetailField
          label="Vorheriger Step"
          value={project.previousStepName ?? "–"}
        />
        <DetailField
          label="Hero-Status"
          value={
            project.statusName
              ? `${project.statusName}${project.statusCode ? ` (Code ${project.statusCode})` : ""}`
              : "–"
          }
        />
        <DetailField label="Kunde" value={project.customerName ?? "–"} />
        <DetailField
          label="Adresse"
          value={project.customerAddress ?? "–"}
        />
        <DetailField
          label="Kontakt"
          value={
            [project.customerEmail, project.customerPhone]
              .filter(Boolean)
              .join(" · ") || "–"
          }
        />
        <DetailField
          label="Fällig"
          value={
            project.maturityDate
              ? new Date(project.maturityDate).toLocaleDateString("de-DE")
              : "–"
          }
        />
        <DetailField
          label="Angelegt"
          value={
            project.createdAtHero
              ? new Date(project.createdAtHero).toLocaleDateString("de-DE")
              : "–"
          }
        />
      </div>

      <div className="space-y-1.5 border-t pt-3">
        <p className="text-xs uppercase tracking-wide font-medium text-muted-foreground">
          Letzte Logbuch-Einträge
          {!loading && total > 0 ? (
            <span className="ml-1 normal-case text-[10px] text-muted-foreground/70">
              (von {total} insgesamt)
            </span>
          ) : null}
        </p>
        {loading ? (
          <p className="text-xs text-muted-foreground">Lädt…</p>
        ) : error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : entries.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Keine Logbuch-Einträge vorhanden.
          </p>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li key={entry.id}>
                <blockquote className="border-l-2 border-primary/40 bg-background/40 pl-3 pr-2 py-1.5 text-xs text-foreground/90">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[11px] font-medium text-foreground/80">
                      {entry.author_name?.trim() ||
                        formatAuthorFromEmail(entry.user_email)}
                    </span>
                    <span className="text-[10px] tabular-nums text-muted-foreground whitespace-nowrap">
                      {entry.entry_date
                        ? new Date(entry.entry_date).toLocaleString("de-DE", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "–"}
                    </span>
                  </div>
                  {entry.custom_title ? (
                    <span className="block mt-0.5 text-[11px] font-medium text-foreground/80">
                      {entry.custom_title}
                    </span>
                  ) : null}
                  <span className="block mt-0.5 italic line-clamp-2">
                    {entry.custom_text
                      ? stripHtml(entry.custom_text)
                      : `„${entry.description ?? "Kein Eintragstext"}“`}
                  </span>
                </blockquote>
              </li>
            ))}
          </ul>
        )}
      </div>

      {project.documents.length > 0 ? (
        <div className="space-y-1.5 border-t pt-3">
          <p className="text-xs uppercase tracking-wide font-medium text-muted-foreground">
            Dokumente ({project.documents.length})
          </p>
          <ul className="space-y-1">
            {project.documents.map((doc) => {
              const typeLabel = humanDocType(doc.type, doc.documentTypeName);
              const isSigned =
                (doc.statusName ?? "").toLowerCase().includes("hochgeladen");
              return (
                <li
                  key={doc.id}
                  className="flex items-center justify-between gap-2 rounded-md border bg-background/40 px-2 py-1 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span
                      className={cn(
                        "shrink-0 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium",
                        doc.type === "invoice" || doc.type === "reversal_invoice"
                          ? "bg-blue-500/10 text-blue-600"
                          : doc.type === "confirmation"
                            ? isSigned
                              ? "bg-emerald-500/10 text-emerald-600"
                              : "bg-amber-500/10 text-amber-600"
                            : doc.type === "offer"
                              ? "bg-purple-500/10 text-purple-600"
                              : "bg-muted text-muted-foreground"
                      )}
                    >
                      {typeLabel}
                    </span>
                    <span className="font-mono text-[11px] truncate">
                      {doc.nr ?? doc.id}
                    </span>
                    {isSigned ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                    ) : null}
                    <span className="text-[10px] text-muted-foreground truncate">
                      {doc.statusName ?? ""}
                    </span>
                  </div>
                  <span className="text-[10px] tabular-nums text-muted-foreground whitespace-nowrap">
                    {doc.documentDate
                      ? new Date(doc.documentDate).toLocaleDateString("de-DE")
                      : "–"}
                  </span>
                  {doc.fileUrl ? (
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-[10px] shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      öffnen →
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {project.confirmation?.fileUrl ? (
          <a
            href={project.confirmation.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors",
              project.confirmation.isSignedScan
                ? "border-emerald-500 text-emerald-600 hover:bg-emerald-500 hover:text-white"
                : "border-input text-foreground hover:bg-blue-500 hover:border-blue-500 hover:text-white"
            )}
            title={
              project.confirmation.isSignedScan
                ? "Vom Kunden zurückgegebene (signierte) Auftragsbestätigung"
                : `${project.confirmation.statusName ?? ""} — letzte verfügbare AB`
            }
          >
            {project.confirmation.isSignedScan ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <FileSignature className="h-3 w-3" />
            )}
            AB {project.confirmation.nr ?? "ansehen"}
            {project.confirmation.isSignedScan ? " (unterschrieben)" : ""} →
          </a>
        ) : null}
        {heroHref ? (
          <a
            href={heroHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-input bg-transparent px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-blue-500 hover:border-blue-500 hover:text-white"
          >
            <ExternalLink className="h-3 w-3" />
            Im Hero öffnen →
          </a>
        ) : null}
      </div>
    </div>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </div>
      <div className="break-words">{value || "–"}</div>
    </div>
  );
}

function formatAuthorFromEmail(email: string | null | undefined): string {
  if (!email) return "Unbekannt";
  const localPart = email.split("@")[0] ?? "";
  if (!localPart) return email;
  const segments = localPart
    .split(/[._-]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (segments.length === 0) return localPart;
  if (segments.length === 1) return capitalize(segments[0]);
  const first = segments[0];
  const rest = segments.slice(1).map(capitalize).join(" ");
  return first.length === 1
    ? `${first.toUpperCase()}. ${rest}`
    : `${capitalize(first)} ${rest}`;
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function humanDocType(
  type: string | null,
  typeName: string | null
): string {
  if (typeName) {
    if (typeName.toLowerCase().includes("auftrags")) return "AB";
    if (typeName.toLowerCase().includes("anschluss")) return "AnZus";
    return typeName;
  }
  switch (type) {
    case "invoice":
      return "RG";
    case "reversal_invoice":
      return "Storno";
    case "confirmation":
      return "AB";
    case "offer":
      return "Angebot";
    case "dunning":
      return "Mahnung";
    case "invoice_notice":
      return "RG-Hinweis";
    default:
      return type ?? "Doc";
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
