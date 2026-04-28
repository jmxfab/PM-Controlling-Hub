"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, Snowflake, Sun, Sunrise, Wind, Wrench } from "lucide-react";

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
    <div className="space-y-4">
      {isPending ? <NavigatingOverlay /> : null}
      <div className="rounded-lg border bg-card p-3">
        <Tabs value={timeframe.mode} onValueChange={handleTimeframeChange}>
          <div className="flex flex-wrap gap-2">
            <TabsList
              className="flex h-auto flex-wrap gap-1 bg-muted p-1"
              title="Momentaufnahme + Jumax-Berichtswoche."
            >
              <TabsTrigger value="current">Jetzt</TabsTrigger>
              <TabsTrigger
                value="jumax_week"
                title="Jumax-Berichtswoche: letzte komplette Woche Fr 00:00 → Do 23:59. Die laufende Woche wird bewusst nicht gezeigt — für Reporting mit kompletter Vergleichswoche."
                className="border border-amber-500/60 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 data-[state=active]:bg-amber-500 data-[state=active]:text-amber-50 data-[state=active]:border-amber-500 data-[state=active]:shadow-sm"
              >
                Jumax-Woche
              </TabsTrigger>
            </TabsList>

            <TabsList
              className="flex h-auto flex-wrap gap-1 bg-muted p-1"
              title="Änderungen im Zeitraum: zeigt zusätzlich wie viele Projekte in diesem Zeitraum neu angelegt / abgeschlossen / in Abrechnung / in Nacharbeit gegangen sind."
            >
              <TabsTrigger value="gestern">Gestern</TabsTrigger>
              <TabsTrigger value="3d">Letzte 3 Tage</TabsTrigger>
              <TabsTrigger
                value="7d"
                title="Rollende letzte 7 Tage: heute-6 → heute. Inklusive heutigem Tag."
              >
                Letzte Woche
              </TabsTrigger>
              <TabsTrigger value="14d">14 Tage</TabsTrigger>
              <TabsTrigger value="frei">Frei</TabsTrigger>
            </TabsList>
          </div>

          {timeframe.mode === "frei" ? (
            <div className="flex flex-wrap items-end gap-3 mt-3">
              <div className="space-y-1">
                <Label htmlFor="dashboard-timeframe-from" className="text-xs">
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
                <Label htmlFor="dashboard-timeframe-to" className="text-xs">
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
              >
                Anwenden
              </Button>
            </div>
          ) : null}
        </Tabs>
      </div>

      <Tabs value={department} onValueChange={handleDepartmentChange} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 gap-1 lg:grid-cols-6 lg:w-full">
          {departments.map((departmentKey) => {
            const DepartmentIcon = departmentIcons[departmentKey];

            return (
              <TabsTrigger
                key={departmentKey}
                value={departmentKey}
                className="flex items-center gap-2"
                onMouseEnter={() => prefetchDepartment(departmentKey)}
                onFocus={() => prefetchDepartment(departmentKey)}
              >
                <DepartmentIcon className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {DASHBOARD_DEPARTMENT_SHORT_LABELS[departmentKey]}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {departments.map((departmentKey) => (
          <TabsContent key={departmentKey} value={departmentKey} className="space-y-4">
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
            <span className="text-xl font-bold">J</span>
          </div>
        </div>
        <div className="text-center space-y-1">
          <p className="text-lg font-semibold tracking-tight">
            JMX Controlling Hub
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
