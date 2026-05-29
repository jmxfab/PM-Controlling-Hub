"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, ArrowDownUp, SlidersHorizontal, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

      {/* Sortierung — Dropdown-Style (Linear/Notion-Pattern) statt mehrerer
       *  Pill-Reihen. Spart visuell Platz und macht Optionen erweiterbar. */}
      <div className="h-5 w-px bg-border" />
      <SortDropdown
        sortMode={sortMode}
        setSortMode={setSortMode}
        sortDirection={sortDirection}
        setSortDirection={setSortDirection}
      />

      {/* Altersfilter + Erweitert-Bereich — eingeklappt hinter einem Icon-Button.
       *  90% der User wollen 30 Tage Default + nichts anpassen. Wer mehr will,
       *  klickt explizit auf den Slider-Icon-Button. */}
      {tab !== "my_day" && (
        <AdvancedFiltersPopover
          ageFilter={ageFilter}
          setAgeFilter={setAgeFilter}
        />
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

/* ============================================================
 * SortDropdown — kompakte Single-Button-UI fuer Sort + Direction
 * (Linear/Notion-Pattern statt 4 Pills nebeneinander)
 * ============================================================ */

function SortDropdown({
  sortMode,
  setSortMode,
  sortDirection,
  setSortDirection,
}: {
  sortMode: SortMode;
  setSortMode: (v: SortMode) => void;
  sortDirection: SortDirection;
  setSortDirection: (v: SortDirection) => void;
}) {
  const [open, setOpen] = useState(false);

  const sortLabels: Record<SortMode, string> = {
    default: "Reihenfolge",
    priority: "Dringlichkeit",
    date: "Datum",
  };

  // Direction-Label kontextabhaengig
  const dirHint =
    sortMode === "default"
      ? ""
      : sortMode === "priority"
        ? sortDirection === "asc"
          ? "urgent → niedrig"
          : "niedrig → urgent"
        : sortDirection === "asc"
          ? "alt → neu"
          : "neu → alt";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="h-7 px-2.5 inline-flex items-center gap-1.5 text-[11px] rounded-md border border-border bg-card hover:bg-muted/60 transition-colors"
          title="Sortierung ändern"
        >
          <ArrowDownUp size={11} className="text-muted-foreground" />
          <span className="font-medium">{sortLabels[sortMode]}</span>
          {sortMode !== "default" && (
            <span className="text-muted-foreground">
              {sortDirection === "asc" ? "↑" : "↓"}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Sortieren nach
        </div>
        {(["default", "priority", "date"] as SortMode[]).map((mode) => {
          const active = sortMode === mode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => {
                setSortMode(mode);
                // Bei default: direction zurücksetzen
                if (mode === "default") setSortDirection("desc");
              }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-[12.5px] hover:bg-muted ${
                active ? "bg-muted/60 font-medium" : ""
              }`}
            >
              {active ? (
                <Check size={12} className="text-foreground/70" />
              ) : (
                <span className="w-3" />
              )}
              {sortLabels[mode]}
            </button>
          );
        })}
        {sortMode !== "default" && (
          <>
            <div className="my-1 h-px bg-border/60" />
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Richtung
            </div>
            {(["asc", "desc"] as SortDirection[]).map((dir) => {
              const active = sortDirection === dir;
              const label =
                dir === "asc"
                  ? `↑ Aufsteigend${dirHint ? ` (${sortMode === "priority" ? "urgent → niedrig" : "alt → neu"})` : ""}`
                  : `↓ Absteigend${dirHint ? ` (${sortMode === "priority" ? "niedrig → urgent" : "neu → alt"})` : ""}`;
              return (
                <button
                  key={dir}
                  type="button"
                  onClick={() => setSortDirection(dir)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-[11.5px] hover:bg-muted ${
                    active ? "bg-muted/60 font-medium" : ""
                  }`}
                >
                  {active ? (
                    <Check size={12} className="text-foreground/70" />
                  ) : (
                    <span className="w-3" />
                  )}
                  {label}
                </button>
              );
            })}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ============================================================
 * AdvancedFiltersPopover — Alter-Filter + zukuenftige Filter
 * eingeklappt hinter einem Slider-Icon. Default 30 Tage ist meistens
 * richtig — wer mehr will, klickt drauf.
 * ============================================================ */

function AdvancedFiltersPopover({
  ageFilter,
  setAgeFilter,
}: {
  ageFilter: AgeFilter;
  setAgeFilter: (v: AgeFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasChanges = ageFilter !== "30";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`h-7 px-2 inline-flex items-center gap-1.5 text-[11px] rounded-md border transition-colors ${
            hasChanges
              ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
              : "border-border bg-card hover:bg-muted/60"
          }`}
          title="Erweiterte Filter (Alter, etc.)"
        >
          <SlidersHorizontal size={11} />
          {hasChanges && (
            <span className="text-[10px]">
              {ageFilter === "90" ? "90 Tage" : "Alle"}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Alter — Tasks juenger als
        </div>
        {(["30", "90", "all"] as AgeFilter[]).map((v) => {
          const active = ageFilter === v;
          const label = v === "30" ? "30 Tage" : v === "90" ? "90 Tage" : "Alle (kein Limit)";
          return (
            <button
              key={v}
              type="button"
              onClick={() => {
                setAgeFilter(v);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-[12.5px] hover:bg-muted ${
                active ? "bg-muted/60 font-medium" : ""
              }`}
            >
              {active ? (
                <Check size={12} className="text-foreground/70" />
              ) : (
                <span className="w-3" />
              )}
              {label}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
