"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  CalendarRange,
  Snowflake,
  Sun,
  Sunrise,
  Wind,
  Wrench,
} from "lucide-react";

import {
  getDefaultDashboardCustomRange,
  toDashboardTimeframeSearchParams,
  type DashboardTimeframe,
  type DashboardTimeframeMode,
} from "@/lib/dashboard/dashboard-timeframe";
import {
  DASHBOARD_DEPARTMENT_SHORT_LABELS,
  type Department,
} from "@/lib/dashboard/dashboard-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DashboardShellProps {
  department: Department;
  departments: readonly Department[];
  tabContents: Record<Department, ReactNode>;
  timeframe: DashboardTimeframe;
}

const departmentIcons = {
  GESAMT: Building2,
  PV: Sun,
  PV_GEWERBE: Sunrise,
  WP: Wind,
  KLIMA: Snowflake,
  GEBAEUDETECHNIK: Wrench,
} as const;

export function DashboardShell({
  department,
  departments,
  tabContents,
  timeframe,
}: DashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [customFrom, setCustomFrom] = useState(timeframe.from ?? "");
  const [customTo, setCustomTo] = useState(timeframe.to ?? "");

  useEffect(() => {
    setCustomFrom(timeframe.from ?? "");
    setCustomTo(timeframe.to ?? "");
  }, [timeframe.from, timeframe.to]);

  // Idle-time prefetch aller Department-URLs, damit Tab-Wechsel instant sind.
  // Kostet einmal RSC-Payload pro Department im Hintergrund.
  useEffect(() => {
    const others = departments.filter((d) => d !== department);
    const run = () => {
      for (const d of others) {
        router.prefetch(buildDepartmentHref(d));
      }
    };
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(run, { timeout: 2000 });
      return () => {
        if (typeof w.cancelIdleCallback === "function") w.cancelIdleCallback(id);
      };
    }
    const id = setTimeout(run, 1500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department, pathname, searchParams]);

  function updateUrl(nextValues: Record<string, string | null>) {
    const nextSearchParams = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(nextValues)) {
      if (value) {
        nextSearchParams.set(key, value);
      } else {
        nextSearchParams.delete(key);
      }
    }

    const nextQuery = nextSearchParams.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;

    startTransition(() => {
      router.replace(nextUrl, { scroll: false });
    });
  }

  function handleDepartmentChange(nextDepartment: string) {
    updateUrl({ department: nextDepartment });
  }

  function buildDepartmentHref(nextDepartment: Department): string {
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.set("department", nextDepartment);
    const qs = nextSearchParams.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function prefetchDepartment(nextDepartment: Department) {
    if (nextDepartment === department) return;
    router.prefetch(buildDepartmentHref(nextDepartment));
  }

  function handleTimeframeChange(nextMode: string) {
    if (nextMode === "frei") {
      const nextRange =
        timeframe.mode === "frei" && timeframe.from && timeframe.to
          ? { from: timeframe.from, to: timeframe.to }
          : getDefaultDashboardCustomRange();

      updateUrl({
        ...toDashboardTimeframeSearchParams({
          mode: "frei",
          ...nextRange,
        }),
      });
      return;
    }

    updateUrl({
      ...toDashboardTimeframeSearchParams({
        mode: nextMode as DashboardTimeframeMode,
        from: null,
        to: null,
      }),
      from: null,
      to: null,
    });
  }

  function applyCustomRange() {
    if (!customFrom || !customTo) return;
    let nextFrom = customFrom;
    let nextTo = customTo;
    if (nextFrom > nextTo) nextTo = nextFrom;

    updateUrl({
      ...toDashboardTimeframeSearchParams({
        mode: "frei",
        from: nextFrom,
        to: nextTo,
      }),
    });
  }

  const customRangeDirty =
    !!customFrom &&
    !!customTo &&
    (customFrom !== (timeframe.from ?? "") || customTo !== (timeframe.to ?? ""));

  return (
    <div className="space-y-5">
      {isPending ? <NavigatingOverlay /> : null}

      {/* Timeframe-Selector */}
      <div className="rounded-xl border bg-card/60 backdrop-blur-sm p-3 shadow-sm">
        <Tabs value={timeframe.mode} onValueChange={handleTimeframeChange}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mr-1 hidden md:inline">
              Zeitraum
            </span>
            <TabsList
              className="flex h-auto flex-wrap gap-1 bg-muted/70 p-1 rounded-lg"
              title="Momentaufnahme + Berichtswoche."
            >
              <TabsTrigger value="current" className="rounded-md">Jetzt</TabsTrigger>
              <TabsTrigger
                value="jumax_week"
                title="Berichtswoche: letzte komplette Woche Fr 00:00 → Do 23:59. Die laufende Woche wird bewusst nicht gezeigt — für Reporting mit kompletter Vergleichswoche."
                className="group relative gap-1.5 rounded-md font-medium ring-1 ring-amber-500/40 bg-gradient-to-b from-amber-50 to-amber-100/60 text-amber-800 hover:ring-amber-500/70 hover:from-amber-100 hover:to-amber-200/70 dark:from-amber-500/10 dark:to-amber-600/5 dark:text-amber-300 dark:hover:from-amber-500/15 dark:hover:to-amber-600/10 data-[state=active]:bg-gradient-to-br data-[state=active]:from-amber-400 data-[state=active]:via-orange-500 data-[state=active]:to-amber-600 data-[state=active]:text-white data-[state=active]:ring-amber-500/0 data-[state=active]:shadow-[0_4px_16px_-2px_hsl(35_95%_55%/0.45)] dark:data-[state=active]:shadow-[0_6px_22px_-4px_hsl(35_95%_55%/0.55)] transition-all duration-200"
              >
                <CalendarRange
                  size={13}
                  className="opacity-80 group-data-[state=active]:opacity-100 transition-transform duration-300 group-data-[state=active]:rotate-6"
                />
                Berichtswoche
                <span
                  aria-hidden
                  className="hidden group-data-[state=active]:block absolute inset-0 rounded-md pointer-events-none ring-1 ring-inset ring-white/25 dark:ring-white/15"
                />
              </TabsTrigger>
            </TabsList>

            <div className="h-5 w-px bg-border mx-1 hidden md:block" />

            <TabsList
              className="flex h-auto flex-wrap gap-1 bg-muted/70 p-1 rounded-lg"
              title="Änderungen im Zeitraum: zeigt zusätzlich wie viele Projekte in diesem Zeitraum neu angelegt / abgeschlossen / in Abrechnung / in Nacharbeit gegangen sind."
            >
              <TabsTrigger value="gestern" className="rounded-md">Gestern</TabsTrigger>
              <TabsTrigger value="3d" className="rounded-md">Letzte 3 Tage</TabsTrigger>
              <TabsTrigger
                value="7d"
                title="Rollende letzte 7 Tage: heute-6 → heute. Inklusive heutigem Tag."
                className="rounded-md"
              >
                Letzte Woche
              </TabsTrigger>
              <TabsTrigger value="14d" className="rounded-md">14 Tage</TabsTrigger>
              <TabsTrigger value="frei" className="rounded-md">Frei</TabsTrigger>
            </TabsList>
          </div>

          {timeframe.mode === "frei" ? (
            <div className="flex flex-wrap items-end gap-3 mt-3 pt-3 border-t border-border/50">
              <div className="space-y-1">
                <Label htmlFor="dashboard-timeframe-from" className="text-xs text-muted-foreground">
                  Von
                </Label>
                <Input
                  id="dashboard-timeframe-from"
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  className="h-8 w-[150px] text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dashboard-timeframe-to" className="text-xs text-muted-foreground">
                  Bis
                </Label>
                <Input
                  id="dashboard-timeframe-to"
                  type="date"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                  className="h-8 w-[150px] text-sm"
                />
              </div>
              <Button
                size="sm"
                onClick={applyCustomRange}
                disabled={!customRangeDirty}
                className="h-8"
              >
                Anwenden
              </Button>
            </div>
          ) : null}
        </Tabs>
      </div>

      {/* Department-Tabs */}
      <Tabs value={department} onValueChange={handleDepartmentChange} className="space-y-5">
        <TabsList className="grid w-full grid-cols-3 gap-1.5 lg:grid-cols-6 lg:w-full h-auto bg-muted/50 p-1.5 rounded-xl">
          {departments.map((departmentKey) => {
            const DepartmentIcon = departmentIcons[departmentKey];

            return (
              <TabsTrigger
                key={departmentKey}
                value={departmentKey}
                className="flex items-center justify-center gap-2 py-2 rounded-lg data-[state=active]:shadow-sm transition-all"
                onMouseEnter={() => prefetchDepartment(departmentKey)}
                onFocus={() => prefetchDepartment(departmentKey)}
              >
                <DepartmentIcon className="h-4 w-4" />
                <span className="hidden sm:inline font-medium">
                  {DASHBOARD_DEPARTMENT_SHORT_LABELS[departmentKey]}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {departments.map((departmentKey) => (
          <TabsContent key={departmentKey} value={departmentKey} className="space-y-5 mt-0">
            {tabContents[departmentKey]}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function NavigatingOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-background/90 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
          <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <span className="text-xl font-bold">PM</span>
          </div>
        </div>
        <div className="text-center space-y-1">
          <p className="text-lg font-semibold tracking-tight">
            Projektmanagement Demo
          </p>
          <p className="text-sm text-muted-foreground">Tab wird geladen…</p>
        </div>
      </div>
      <div className="relative h-1 w-[min(320px,70vw)] overflow-hidden rounded-full bg-muted">
        <div className="absolute inset-y-0 w-1/2 animate-indeterminate rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />
      </div>
    </div>
  );
}
