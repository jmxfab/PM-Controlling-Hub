"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export interface LogbuchFilterState {
  userEmail: string;
  projectId: string;
  eventType: string;
  dateFrom: string;
  dateTo: string;
}

interface LogbuchFiltersProps {
  filters: LogbuchFilterState;
  eventTypes: string[];
  onChange: (filters: LogbuchFilterState) => void;
}

export function LogbuchFilters({
  filters,
  eventTypes,
  onChange,
}: LogbuchFiltersProps) {
  const hasActive =
    filters.userEmail ||
    filters.projectId ||
    filters.eventType ||
    filters.dateFrom ||
    filters.dateTo;

  function set(key: keyof LogbuchFilterState, value: string) {
    onChange({ ...filters, [key]: value });
  }

  function reset() {
    onChange({ userEmail: "", projectId: "", eventType: "", dateFrom: "", dateTo: "" });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Mitarbeiter (E-Mail)"
        value={filters.userEmail}
        onChange={(e) => set("userEmail", e.target.value)}
        className="w-52 h-8 text-sm"
      />

      <Input
        placeholder="Projekt-ID"
        value={filters.projectId}
        onChange={(e) => set("projectId", e.target.value)}
        className="w-36 h-8 text-sm"
      />

      {eventTypes.length > 0 && (
        <Select
          value={filters.eventType || "__all__"}
          onValueChange={(v) => set("eventType", v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="w-44 h-8 text-sm">
            <SelectValue placeholder="Ereignistyp" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Alle Typen</SelectItem>
            {eventTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Input
        type="date"
        value={filters.dateFrom}
        onChange={(e) => set("dateFrom", e.target.value)}
        className="w-36 h-8 text-sm"
        title="Von Datum"
      />
      <Input
        type="date"
        value={filters.dateTo}
        onChange={(e) => set("dateTo", e.target.value)}
        className="w-36 h-8 text-sm"
        title="Bis Datum"
      />

      {hasActive && (
        <Button variant="ghost" size="sm" onClick={reset} className="h-8 gap-1 text-muted-foreground">
          <X size={13} />
          Zurücksetzen
        </Button>
      )}
    </div>
  );
}
