"use client";

import { useTransition, type ReactNode } from "react";
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

  function handleCustomRangeChange(field: "from" | "to", value: string) {
    if (!value) {
      return;
    }

    const defaultRange = getDefaultDashboardCustomRange();
    let nextFrom = timeframe.mode === "frei" && timeframe.from
      ? timeframe.from
      : defaultRange.from;
    let nextTo = timeframe.mode === "frei" && timeframe.to
      ? timeframe.to
      : defaultRange.to;

    if (field === "from") {
      nextFrom = value;

      if (nextFrom > nextTo) {
        nextTo = nextFrom;
      }
    } else {
      nextTo = value;

      if (nextTo < nextFrom) {
        nextFrom = nextTo;
      }
    }

    updateUrl({
      ...toDashboardTimeframeSearchParams({
        mode: "frei",
        from: nextFrom,
        to: nextTo,
      }),
    });
  }

  return (
    <div className="space-y-4">
      {isPending ? <NavigatingOverlay /> : null}
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="space-y-2">
          <Label>Zeitraum</Label>
          <Tabs value={timeframe.mode} onValueChange={handleTimeframeChange}>
            <TabsList className="flex h-auto flex-wrap gap-1 bg-muted p-1">
              <TabsTrigger
                value="current"
                title="Momentaufnahme: was ist JETZT in welchem Step"
              >
                Aktueller Stand
              </TabsTrigger>
              <TabsTrigger value="morgen" title="Termin: morgen fällig">
                Morgen
              </TabsTrigger>
              <TabsTrigger value="next3d" title="Termin: in den nächsten 3 Tagen fällig">
                In 3 Tagen
              </TabsTrigger>
              <TabsTrigger value="next7d" title="Termin: in den nächsten 7 Tagen fällig">
                Nächste Woche
              </TabsTrigger>
              <TabsTrigger value="gestern">Gestern</TabsTrigger>
              <TabsTrigger value="3d">Letzte 3 Tage</TabsTrigger>
              <TabsTrigger value="7d" title="Jumax-Woche: Fr 00:00 → Do 23:59">
                Woche (Fr→Do)
              </TabsTrigger>
              <TabsTrigger value="14d">Letzte 14 Tage</TabsTrigger>
              <TabsTrigger value="30d">30 Tage</TabsTrigger>
              <TabsTrigger value="frei">Frei</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {timeframe.mode === "frei" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dashboard-timeframe-from">Von</Label>
              <Input
                id="dashboard-timeframe-from"
                type="date"
                value={timeframe.from ?? ""}
                onChange={(event) =>
                  handleCustomRangeChange("from", event.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dashboard-timeframe-to">Bis</Label>
              <Input
                id="dashboard-timeframe-to"
                type="date"
                value={timeframe.to ?? ""}
                onChange={(event) =>
                  handleCustomRangeChange("to", event.target.value)
                }
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Kennzahlen, Verlauf und Projektliste werden gemeinsam auf diesen
            Zeitraum gefiltert.
          </p>
        )}
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
