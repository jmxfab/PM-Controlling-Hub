"use client";

import { useMemo, useState } from "react";

import {
  DASHBOARD_KPI_CARD_DEFINITIONS,
  DashboardCards,
  type KPIData,
} from "./dashboard-cards";
import { DashboardProjectList } from "./dashboard-project-list";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type DashboardTimeframe } from "@/lib/dashboard/dashboard-timeframe";
import { type DashboardProjectListItem } from "@/lib/dashboard/dashboard-types";
import { type DashboardKpiKey } from "@/lib/hero/hero-aggregator";

interface DashboardKpiDialogProps {
  data: KPIData;
  departmentName: string;
  snapshotContextLabel: string;
  heroProjectLinkTemplate: string | null;
  kpiProjectGroups: Record<DashboardKpiKey, DashboardProjectListItem[]>;
  source: "hero" | "empty";
  timeframe: DashboardTimeframe;
}

export function DashboardKpiDialog({
  data,
  departmentName,
  snapshotContextLabel,
  heroProjectLinkTemplate,
  kpiProjectGroups,
  source,
  timeframe,
}: DashboardKpiDialogProps) {
  const [selectedKpiKey, setSelectedKpiKey] = useState<DashboardKpiKey | null>(null);

  const selectedProjects = useMemo(
    () => (selectedKpiKey ? kpiProjectGroups[selectedKpiKey] : []),
    [kpiProjectGroups, selectedKpiKey]
  );

  const selectedCard = selectedKpiKey
    ? DASHBOARD_KPI_CARD_DEFINITIONS[selectedKpiKey]
    : null;
  const dialogDescription = selectedCard
    ? `${selectedCard.getDescription({
        data,
        departmentName,
        snapshotContextLabel,
      })} · ${formatMatchingCountLabel(selectedProjects.length)}`
    : null;

  return (
    <>
      <DashboardCards
        data={data}
        departmentName={departmentName}
        snapshotContextLabel={snapshotContextLabel}
        onKpiSelect={setSelectedKpiKey}
        selectedKpiKey={selectedKpiKey}
      />

      <Dialog
        open={selectedKpiKey !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedKpiKey(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-6xl rounded-2xl">
          {selectedCard ? (
            <>
              <DialogHeader className="pr-8 space-y-2">
                <div className="flex items-center gap-3">
                  {(() => {
                    const Icon = selectedCard.icon;
                    return (
                      <div className="shrink-0 grid place-items-center w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                        <Icon className="h-5 w-5" />
                      </div>
                    );
                  })()}
                  <div className="space-y-0.5">
                    <DialogTitle className="text-xl font-bold tracking-tight">
                      {selectedCard.title}
                    </DialogTitle>
                    {dialogDescription ? (
                      <DialogDescription className="text-xs">
                        {dialogDescription}
                      </DialogDescription>
                    ) : null}
                  </div>
                </div>
              </DialogHeader>

              <DashboardProjectList
                departmentName={departmentName}
                heroProjectLinkTemplate={heroProjectLinkTemplate}
                projects={selectedProjects}
                source={source}
                timeframe={timeframe}
                variant="embedded"
              />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatMatchingCountLabel(count: number): string {
  return `${count} ${count === 1 ? "passendes Projekt" : "passende Projekte"}`;
}
