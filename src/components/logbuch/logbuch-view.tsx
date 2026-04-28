"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { LogbuchFilters, type LogbuchFilterState } from "./logbuch-filters";
import { LogbuchTable } from "./logbuch-table";
import { LogbuchCharts } from "./logbuch-charts";
import type {
  LogbuchEntry,
  LogbuchAggregations,
} from "@/lib/supabase/hero-logbuch-queries";

interface LogbuchData {
  entries: LogbuchEntry[];
  total: number;
  aggregations: LogbuchAggregations;
}

interface LogbuchViewProps {
  initial: LogbuchData;
  initialFilters?: Partial<LogbuchFilterState>;
}

const EMPTY_FILTERS: LogbuchFilterState = {
  userEmail: "",
  projectId: "",
  eventType: "",
  dateFrom: "",
  dateTo: "",
};

const EMPTY_AGGREGATIONS: LogbuchAggregations = {
  byUser: [],
  byProject: [],
  byEventType: [],
};

export function LogbuchView({ initial, initialFilters }: LogbuchViewProps) {
  const [filters, setFilters] = useState<LogbuchFilterState>(() => ({
    ...EMPTY_FILTERS,
    ...(initialFilters ?? {}),
  }));
  const [page, setPage] = useState(0);
  const [data, setData] = useState<LogbuchData>(initial);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(
    async (f: LogbuchFilterState, p: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(p) });
        if (f.userEmail) params.set("user_email", f.userEmail);
        if (f.projectId) params.set("project_id", f.projectId);
        if (f.eventType) params.set("event_type", f.eventType);
        if (f.dateFrom) params.set("date_from", f.dateFrom);
        if (f.dateTo) params.set("date_to", f.dateTo);

        const res = await fetch(`/api/logbuch?${params}`);
        if (!res.ok) return;
        const json = await res.json();
        setData({
          entries: json.entries ?? [],
          total: json.total ?? 0,
          aggregations: json.aggregations ?? EMPTY_AGGREGATIONS,
        });
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(0);
      fetchData(filters, 0);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filters, fetchData]);

  function handlePageChange(newPage: number) {
    setPage(newPage);
    fetchData(filters, newPage);
  }

  const eventTypes = data.aggregations.byEventType.map((e) => e.type);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <LogbuchFilters
          filters={filters}
          eventTypes={eventTypes}
          onChange={setFilters}
        />
        {loading && (
          <span className="text-xs text-muted-foreground animate-pulse">
            Lädt…
          </span>
        )}
      </div>

      <LogbuchCharts aggregations={data.aggregations} />

      <LogbuchTable
        entries={data.entries}
        total={data.total}
        page={page}
        pageSize={100}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
