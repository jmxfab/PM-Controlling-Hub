"use client";

import dynamic from "next/dynamic";

const InsightsSkeleton = () => (
  <div className="space-y-4">
    <div className="h-[280px] animate-pulse rounded-lg border bg-muted/30" />
    <div className="h-[200px] animate-pulse rounded-lg border bg-muted/30" />
  </div>
);

export const InsightsView = dynamic(
  () =>
    import("./insights-view").then((module) => ({
      default: module.InsightsView,
    })),
  { ssr: false, loading: InsightsSkeleton }
);
