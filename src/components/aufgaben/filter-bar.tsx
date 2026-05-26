"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import type { MailTabFilter } from "@/lib/supabase/mail-tasks-queries";

export type StatusFilter = "all" | "open" | "done";
export type PrioFilter = "all" | "urgent" | "high" | "medium" | "low";
export type AgeFilter = "30" | "90" | "all";
/** Sortier-Modus pro Tab. */
export type SortMode = "default" | "priority" | "date";
/** Sortier-Richtung — aufsteigend oder absteigend. */
export type SortDirection = "asc" | "desc";

export function FilterBar({
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  prioFilter,
  setPrioFilter,
  ageFilter,
  setAgeFilter,
  sortMode,
  setSortMode,
  sortDirection,
  setSortDirection,
  hasFilters,
  defaultStatus,
  loading,
  showStatus,
  showPriority,
  tab,
}: {
  search: string;
  setSearch: (v: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (v: StatusFilter) => void;
  prioFilter: PrioFilter;
  setPrioFilter: (v: PrioFilter) => void;
  ageFilter: AgeFilter;
  setAgeFilter: (v: AgeFilter) => void;
  sortMode: SortMode;
  setSortMode: (v: SortMode) => void;
  sortDirection: SortDirection;
  setSortDirection: (v: SortDirection) => void;
  hasFilters: boolean;
  defaultStatus: StatusFilter;
  loading: boolean;
  showStatus: boolean;
  showPriority: boolean;
  tab: MailTabFilter;
}) {
  // Bei Infos heisst "open" -> "Ungelesen", "done" -> "Gelesen"
  const statusLabels: Record<StatusFilter, string> =
    tab === "infos"
      ? { all: "Alle", open: "Ungelesen", done: "Gelesen" }
      : tab === "rechnungen"
        ? { all: "Alle", open: "Offen", done: "Bezahlt / Erledigt" }
        : { all: "Alle", open: "Offen", done: "Erledigt" };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card/40 px-2 py-2 sm:px-3">
      <div className="relative w-full sm:w-auto">
        <Search
          size={14}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none"
        />
        <Input
          placeholder="Suche…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-56 h-8 pl-8 text-sm"
        />
      </div>

      {showStatus && (
        <>
          <div className="h-5 w-px bg-border" />
          <PillGroup
            label="Status"
            value={statusFilter}
            options={[
              { value: "all", label: statusLabels.all },
              { value: "open", label: statusLabels.open },
              { value: "done", label: statusLabels.done },
            ]}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
          />
        </>
      )}

      {showPriority && (
        <>
          <div className="h-5 w-px bg-border" />
          <PillGroup
            label="Prio"
            value={prioFilter}
            options={[
              { value: "all", label: "Alle" },
              { value: "urgent", label: "Dringend", dot: "bg-red-500" },
              { value: "high", label: "Hoch", dot: "bg-orange-500" },
              { value: "medium", label: "Mittel", dot: "bg-amber-500" },
              { value: "low", label: "Niedrig", dot: "bg-slate-400" },
            ]}
            onChange={(v) => setPrioFilter(v as PrioFilter)}
          />
        </>
      )}

      {/* Altersfilter — Default 30 Tage versteckt alte Karteileichen. */}
      {tab !== "my_day" && (
        <>
          <div className="h-5 w-px bg-border" />
          <PillGroup
            label="Alter"
            value={ageFilter}
            options={[
              { value: "30", label: "30 Tage" },
              { value: "90", label: "90 Tage" },
              { value: "all", label: "Alle" },
            ]}
            onChange={(v) => setAgeFilter(v as AgeFilter)}
          />
        </>
      )}

      {/* Sortierung — Client-Side. Persistiert pro Tab in localStorage. */}
      <div className="h-5 w-px bg-border" />
      <PillGroup
        label="Sort"
        value={sortMode}
        options={[
          { value: "default", label: "Reihenfolge" },
          { value: "priority", label: "Dringlichkeit" },
          { value: "date", label: "Datum" },
        ]}
        onChange={(v) => setSortMode(v as SortMode)}
      />
      {/* Sortier-Richtung: nur sinnvoll bei priority/date. */}
      {sortMode !== "default" && (
        <button
          type="button"
          onClick={() =>
            setSortDirection(sortDirection === "asc" ? "desc" : "asc")
          }
          className="h-7 px-2 inline-flex items-center gap-1 text-[11px] rounded-md border border-border bg-card hover:bg-muted/60 transition-colors"
          title={
            sortDirection === "asc"
              ? sortMode === "priority"
                ? "Aufsteigend (urgent zuerst → niedrig). Klick fuer absteigend."
                : "Aufsteigend (aelteste zuerst). Klick fuer neueste zuerst."
              : sortMode === "priority"
                ? "Absteigend (niedrig zuerst → urgent). Klick fuer urgent zuerst."
                : "Absteigend (neueste zuerst). Klick fuer aelteste zuerst."
          }
        >
          {sortDirection === "asc" ? "↑" : "↓"}
          <span className="text-muted-foreground">
            {sortDirection === "asc" ? "Asc" : "Desc"}
          </span>
        </button>
      )}

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-muted-foreground ml-auto"
          onClick={() => {
            setSearch("");
            setStatusFilter(defaultStatus);
            setPrioFilter("all");
            setAgeFilter("30");
            setSortMode("default");
            setSortDirection("desc");
          }}
        >
          <X size={13} /> Reset
        </Button>
      )}
      {loading && (
        <span className="text-xs text-muted-foreground animate-pulse ml-auto">
          Lädt…
        </span>
      )}
    </div>
  );
}

export function PillGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; dot?: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 text-xs">
      <span className="text-muted-foreground mr-1">{label}</span>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium transition-colors ${
              active
                ? "bg-foreground text-background"
                : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {opt.dot && (
              <span
                className={`inline-block w-2 h-2 rounded-full ${opt.dot}`}
              />
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
