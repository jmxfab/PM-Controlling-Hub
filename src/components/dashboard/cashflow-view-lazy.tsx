"use client";

import dynamic from "next/dynamic";

const CashflowSkeleton = () => (
  <div className="space-y-4">
    <div className="h-[280px] animate-pulse rounded-lg border bg-muted/30" />
    <div className="h-[200px] animate-pulse rounded-lg border bg-muted/30" />
  </div>
);

export const CashflowView = dynamic(
  () =>
    import("./cashflow-view").then((module) => ({
      default: module.CashflowView,
    })),
  { ssr: false, loading: CashflowSkeleton }
);
