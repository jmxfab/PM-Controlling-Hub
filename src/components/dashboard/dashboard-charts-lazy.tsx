"use client";

import dynamic from "next/dynamic";

const ChartSkeleton = () => (
  <div className="h-[320px] animate-pulse rounded-lg border bg-muted/30" />
);

export const DashboardCharts = dynamic(
  () =>
    import("./dashboard-charts").then((module) => ({
      default: module.DashboardCharts,
    })),
  { ssr: false, loading: ChartSkeleton }
);
