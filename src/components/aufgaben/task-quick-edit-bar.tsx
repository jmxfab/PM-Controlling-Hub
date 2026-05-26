"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { MailTask } from "@/lib/supabase/mail-tasks-queries";

export const PRIO_OPTIONS: Array<{
  value: NonNullable<MailTask["priority"]>;
  label: string;
  dot: string;
}> = [
  { value: "urgent", label: "Dringend", dot: "bg-red-500" },
  { value: "high", label: "Hoch", dot: "bg-orange-500" },
  { value: "medium", label: "Mittel", dot: "bg-amber-400" },
  { value: "low", label: "Niedrig", dot: "bg-zinc-400" },
];

export const CATEGORY_OPTIONS: Array<{
  value: NonNullable<MailTask["mail_category"]>;
  label: string;
  className: string;
  /** Saturated dot color fuer Dropdown-Liste (Pill-bg ist pastell, der dot
   *  muss ge­saettigt sein damit man die Kategorie auf einen Blick sieht). */
  dot: string;
}> = [
  {
    value: "kritisch",
    label: "Kritisch",
    className:
      "text-rose-700 bg-rose-50 ring-rose-200 dark:text-rose-300 dark:bg-rose-950/40 dark:ring-rose-900/40",
    dot: "bg-rose-500",
  },
  {
    value: "dringend",
    label: "Dringend",
    className:
      "text-orange-700 bg-orange-50 ring-orange-200 dark:text-orange-300 dark:bg-orange-950/40 dark:ring-orange-900/40",
    dot: "bg-orange-500",
  },
  {
    value: "aufgabe",
    label: "Projektleiter",
    className:
      "text-blue-700 bg-blue-50 ring-blue-200 dark:text-blue-300 dark:bg-blue-950/40 dark:ring-blue-900/40",
    dot: "bg-blue-500",
  },
  {
    value: "info",
    label: "Info",
    className:
      "text-slate-600 bg-slate-100 ring-slate-200 dark:text-slate-400 dark:bg-slate-800 dark:ring-slate-700",
    dot: "bg-slate-400",
  },
  {
    value: "rechnung",
    label: "Rechnung",
    className:
      "text-emerald-700 bg-emerald-50 ring-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:ring-emerald-900/40",
    dot: "bg-emerald-500",
  },
  {
    value: "bestellung",
    label: "Bestellung",
    className:
      "text-emerald-700 bg-emerald-50 ring-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:ring-emerald-900/40",
    dot: "bg-teal-500",
  },
  {
    value: "inbox",
    label: "Inbox",
    className:
      "text-zinc-600 bg-zinc-100 ring-zinc-200 dark:text-zinc-400 dark:bg-zinc-800 dark:ring-zinc-700",
    dot: "bg-zinc-400",
  },
  /* pl_aufgabe absichtlich NICHT als User-Quick-Edit Option:
   *  - aufgabe und pl_aufgabe sind im UI gemerged (beide -> Projektleiter-Tab)
   *  - Doppelter "Projektleiter"-Eintrag im Dropdown war verwirrend
   *  - Der Auto-Klassifizierer kann weiterhin pl_aufgabe vergeben
   *  - Bestehende pl_aufgabe Tasks bleiben sichtbar im Projektleiter-Tab */
  {
    value: "gf_aufgabe",
    label: "Geschäftsführer",
    className:
      "text-violet-700 bg-violet-50 ring-violet-200 dark:text-violet-300 dark:bg-violet-950/40 dark:ring-violet-900/40",
    dot: "bg-violet-500",
  },
];

export function TaskQuickEditBar({
  task,
  onChangePriority,
  onChangeCategory,
}: {
  task: MailTask;
  onChangePriority: (p: MailTask["priority"]) => void;
  onChangeCategory: (c: MailTask["mail_category"]) => void;
}) {
  const [prioOpen, setPrioOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const currentPrio = PRIO_OPTIONS.find((p) => p.value === task.priority);
  const currentCat = CATEGORY_OPTIONS.find(
    (c) => c.value === task.mail_category,
  );

  return (
    <div className="flex flex-wrap items-center gap-2 text-[12px]">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
        Klassifikation:
      </span>
      {/* Prio-Pill */}
      <Popover open={prioOpen} onOpenChange={setPrioOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium border hover:bg-muted/60 transition-colors"
            title="Priorität ändern"
          >
            <span
              className={`inline-block w-2 h-2 rounded-full ${currentPrio?.dot ?? "bg-muted-foreground/40"}`}
              aria-hidden
            />
            {currentPrio?.label ?? "Keine Prio"}
            <ChevronDown size={12} className="opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-44 p-1">
          {PRIO_OPTIONS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => {
                onChangePriority(p.value);
                setPrioOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-[12.5px] hover:bg-muted ${
                p.value === task.priority ? "bg-muted/60 font-medium" : ""
              }`}
            >
              <span
                className={`inline-block w-2.5 h-2.5 rounded-full ${p.dot}`}
                aria-hidden
              />
              {p.label}
            </button>
          ))}
        </PopoverContent>
      </Popover>
      {/* Kategorie-Pill */}
      <Popover open={catOpen} onOpenChange={setCatOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium ring-1 hover:opacity-90 transition-opacity ${
              currentCat?.className ?? "bg-muted/50 ring-border"
            }`}
            title="Kategorie ändern"
          >
            {currentCat?.label ?? "Keine Kategorie"}
            <ChevronDown size={12} className="opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-48 p-1">
          {CATEGORY_OPTIONS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => {
                onChangeCategory(c.value);
                setCatOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-[12.5px] hover:bg-muted ${
                c.value === task.mail_category ? "bg-muted/60 font-medium" : ""
              }`}
            >
              <span
                className={`inline-block w-2.5 h-2.5 rounded-full ${c.dot}`}
                aria-hidden
              />
              {c.label}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}
