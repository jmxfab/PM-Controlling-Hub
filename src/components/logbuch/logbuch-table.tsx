"use client";

import { Fragment, useState, type KeyboardEvent } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LogbuchEntry } from "@/lib/supabase/hero-logbuch-queries";

interface LogbuchTableProps {
  entries: LogbuchEntry[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function LogbuchTable({
  entries,
  total,
  page,
  pageSize,
  onPageChange,
}: LogbuchTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);

  if (entries.length === 0 && total === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 py-16 px-4 text-center">
        <div className="rounded-full bg-muted/60 p-3 mb-3">
          <ChevronDown size={22} className="text-muted-foreground/70 rotate-0" />
        </div>
        <p className="text-sm font-medium">Keine Einträge gefunden</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          Daten werden nach dem nächsten Hero-Sync verfügbar.
        </p>
      </div>
    );
  }

  function toggle(id: string) {
    setExpandedId((current) => (current === id ? null : id));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTableRowElement>, id: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle(id);
    }
  }

  return (
    <div className="space-y-2">
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead className="w-40">Datum</TableHead>
              <TableHead>Mitarbeiter</TableHead>
              <TableHead>Projekt</TableHead>
              <TableHead className="w-48">Ereignistyp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => {
              const isExpanded = expandedId === entry.id;
              return (
                <Fragment key={entry.id}>
                  <TableRow
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    aria-controls={`logbuch-details-${entry.id}`}
                    onClick={() => toggle(entry.id)}
                    onKeyDown={(event) => handleKeyDown(event, entry.id)}
                    className="cursor-pointer"
                  >
                    <TableCell className="py-2">
                      <ChevronDown
                        size={14}
                        className={cn(
                          "text-muted-foreground transition-transform",
                          isExpanded ? "rotate-0" : "-rotate-90"
                        )}
                      />
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                      {entry.entry_date
                        ? new Date(entry.entry_date).toLocaleString("de-AT", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "–"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.user_email ?? (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.project_number || entry.project_name ? (
                        <span>
                          {entry.project_number && (
                            <span className="font-mono text-xs mr-1.5 text-muted-foreground">
                              {entry.project_number}
                            </span>
                          )}
                          {entry.project_name}
                        </span>
                      ) : entry.project_match_id ? (
                        <span className="text-xs text-muted-foreground font-mono">
                          {entry.project_match_id}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.event_type ? (
                        <Badge variant="secondary" className="text-xs font-normal">
                          {entry.event_type}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </TableCell>
                  </TableRow>
                  {isExpanded ? (
                    <TableRow
                      id={`logbuch-details-${entry.id}`}
                      className="bg-muted/30 hover:bg-muted/30"
                    >
                      <TableCell colSpan={5} className="p-0">
                        <LogbuchEntryDetails entry={entry} />
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          {from}–{to} von {total.toLocaleString("de-AT")} Einträgen
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={page === 0}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft size={14} />
          </Button>
          <span>
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={page >= totalPages - 1}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}

function LogbuchEntryDetails({ entry }: { entry: LogbuchEntry }) {
  const raw = entry.raw ?? {};
  const userObj =
    typeof raw === "object" && raw !== null && "user" in raw
      ? ((raw as Record<string, unknown>).user as
          | { id?: unknown; email?: unknown; first_name?: unknown; last_name?: unknown }
          | null
          | undefined)
      : undefined;
  const userId =
    userObj && typeof userObj.id !== "undefined" ? String(userObj.id) : null;
  const userFullName =
    userObj &&
    (typeof userObj.first_name === "string" ||
      typeof userObj.last_name === "string")
      ? [userObj.first_name, userObj.last_name]
          .filter((part) => typeof part === "string" && part.length > 0)
          .join(" ")
      : null;

  const created =
    typeof raw === "object" && raw !== null && "created" in raw
      ? String((raw as Record<string, unknown>).created ?? "")
      : null;
  const modified =
    typeof raw === "object" && raw !== null && "modified" in raw
      ? String((raw as Record<string, unknown>).modified ?? "")
      : null;

  // Erst die synthetisch abgeleitete Description aus dem Backend
  // (z.B. "Step gewechselt zu: 🧮 Heizlastberechnung") — Hero liefert
  // selber keinen Freitext, deshalb stammt die Beschreibung aus dem
  // zeitlich gematchten Status-Übergang. Falls das Backend doch mal
  // ein Freitext-Feld in raw mitliefert, nimmt pickFirstString das.
  const description =
    entry.description ??
    pickFirstString(raw, [
      "description",
      "text",
      "message",
      "comment",
      "note",
      "body",
      "content",
    ]);

  return (
    <div className="space-y-3 p-4">
      {description ? (
        <section className="space-y-1">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Eintrag
          </h4>
          <blockquote className="border-l-2 border-primary/40 bg-background/40 pl-3 pr-2 py-2 text-sm italic text-foreground/90 whitespace-pre-wrap leading-relaxed">
            {`„${description}\u201C`}
          </blockquote>
        </section>
      ) : null}

      <section className="grid gap-3 text-sm sm:grid-cols-2">
        <DetailField label="Eintrag-ID" value={entry.id} mono />
        <DetailField label="Ereignistyp" value={entry.event_type ?? "–"} />

        <DetailField
          label="Projekt"
          value={
            entry.project_number || entry.project_name
              ? `${entry.project_number ?? ""} ${entry.project_name ?? ""}`.trim()
              : entry.project_match_id ?? "–"
          }
        />
        <DetailField
          label="Projekt-ID (Hero)"
          value={entry.project_match_id ?? "–"}
          mono
        />

        <DetailField
          label="Target-ID"
          value={entry.target_id ?? "–"}
          mono
          hint="Das konkrete Objekt in Hero, das beim Ereignis betroffen war."
        />
        <DetailField
          label="Mitarbeiter"
          value={
            userFullName
              ? `${userFullName}${entry.user_email ? ` · ${entry.user_email}` : ""}`
              : entry.user_email ?? "–"
          }
          hint={userId ? `User-ID: ${userId}` : undefined}
        />

        <DetailField
          label="Erstellt"
          value={formatTimestamp(created ?? entry.entry_date)}
        />
        <DetailField
          label="Zuletzt geändert"
          value={formatTimestamp(modified ?? entry.hero_modified_at)}
        />
      </section>

      <section className="space-y-1">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Rohdaten (Hero)
        </h4>
        <pre className="max-h-[320px] overflow-auto rounded border bg-background p-3 text-xs leading-relaxed">
          {JSON.stringify(raw, null, 2)}
        </pre>
      </section>
    </div>
  );
}

function DetailField({
  label,
  value,
  mono,
  hint,
}: {
  label: string;
  value: string;
  mono?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </div>
      <div className={cn("break-words", mono && "font-mono text-xs")}>
        {value || "–"}
      </div>
      {hint ? (
        <div className="text-xs text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}

function pickFirstString(
  obj: unknown,
  keys: readonly string[]
): string | null {
  if (!obj || typeof obj !== "object") return null;
  const record = obj as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

function formatTimestamp(value: string | null): string {
  if (!value) return "–";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
