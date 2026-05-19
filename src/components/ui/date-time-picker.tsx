"use client";

import { useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { de } from "date-fns/locale";
import { format } from "date-fns";
import { Calendar, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  /** ISO-Datum-String oder leerer String. */
  value: string;
  onChange: (next: string) => void;
  /** Mit Zeit-Picker (statt nur Datum). Default true. */
  withTime?: boolean;
  placeholder?: string;
  /** Quick-Picks oberhalb des Kalenders. */
  showQuickPicks?: boolean;
  className?: string;
}

/**
 * Replacement fuer <input type="datetime-local">.
 * Sieht in allen Browsern gleich aus, hat einen vernuenftigen Kalender
 * + optional Zeit + Quick-Picks (heute, morgen, naechste Woche).
 *
 * Speichert intern als ISO-String — kompatibel zum bisherigen
 * datetime-local Format (YYYY-MM-DDTHH:mm).
 */
export function DateTimePicker({
  value,
  onChange,
  withTime = true,
  placeholder = "Datum wählen…",
  showQuickPicks = true,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);

  // Parse-Versuch fuer den aktuellen Wert
  const parsedDate = (() => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  })();

  const timeStr = parsedDate
    ? format(parsedDate, "HH:mm")
    : "09:00";

  function combineDateTime(d: Date, time: string): Date {
    const [hh, mm] = time.split(":").map((n) => parseInt(n, 10));
    const out = new Date(d);
    out.setHours(
      Number.isFinite(hh) ? hh : 9,
      Number.isFinite(mm) ? mm : 0,
      0,
      0,
    );
    return out;
  }

  function pickDate(d: Date | undefined) {
    if (!d) return;
    const combined = withTime ? combineDateTime(d, timeStr) : d;
    onChange(toLocalDateTimeString(combined, withTime));
    if (!withTime) setOpen(false);
  }

  function pickTime(time: string) {
    if (!parsedDate) {
      // Wenn noch kein Datum: heute mit gewaehlter Zeit
      const today = combineDateTime(new Date(), time);
      onChange(toLocalDateTimeString(today, withTime));
      return;
    }
    const combined = combineDateTime(parsedDate, time);
    onChange(toLocalDateTimeString(combined, withTime));
  }

  function quickPick(daysOffset: number, hour = 9, minute = 0) {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    d.setHours(hour, minute, 0, 0);
    onChange(toLocalDateTimeString(d, withTime));
    setOpen(false);
  }

  function clear() {
    onChange("");
    setOpen(false);
  }

  const displayLabel = parsedDate
    ? format(parsedDate, withTime ? "dd.MM.yyyy HH:mm" : "dd.MM.yyyy", {
        locale: de,
      })
    : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-8 px-2.5 gap-1.5 font-normal text-[12.5px] justify-start ${
            !displayLabel ? "text-muted-foreground/70" : ""
          } ${className}`}
          type="button"
        >
          <Calendar size={13} className="shrink-0 opacity-70" />
          <span className="flex-1 text-left tabular-nums">
            {displayLabel || placeholder}
          </span>
          {parsedDate && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                clear();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  clear();
                }
              }}
              className="shrink-0 opacity-50 hover:opacity-100 hover:text-rose-600 cursor-pointer"
              title="Datum entfernen"
            >
              <X size={12} />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          {showQuickPicks && (
            <div className="flex flex-wrap gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] px-2"
                onClick={() => quickPick(0, 17)}
              >
                Heute 17 Uhr
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] px-2"
                onClick={() => quickPick(1, 9)}
              >
                Morgen 9 Uhr
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] px-2"
                onClick={() => quickPick(7, 9)}
              >
                +1 Woche
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] px-2"
                onClick={() => quickPick(14, 9)}
              >
                +2 Wochen
              </Button>
            </div>
          )}
          <DayPicker
            mode="single"
            selected={parsedDate ?? undefined}
            onSelect={pickDate}
            locale={de}
            weekStartsOn={1}
            showOutsideDays
            className="rdp-jumax"
          />
          {withTime && (
            <div className="flex items-center gap-2 border-t pt-2">
              <label className="text-[11px] text-muted-foreground font-medium">
                Uhrzeit
              </label>
              <Input
                type="time"
                value={timeStr}
                onChange={(e) => pickTime(e.target.value)}
                className="h-7 text-[12px] flex-1 max-w-[100px]"
              />
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[10px]"
                  onClick={() => pickTime("09:00")}
                >
                  9
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[10px]"
                  onClick={() => pickTime("12:00")}
                >
                  12
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[10px]"
                  onClick={() => pickTime("17:00")}
                >
                  17
                </Button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Format Date als 'YYYY-MM-DDTHH:mm' (datetime-local kompatibel) in local TZ. */
function toLocalDateTimeString(d: Date, withTime: boolean): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (!withTime) return date;
  return `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
