"use client";

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
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);

  if (entries.length === 0 && total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        <p className="text-sm">Keine Einträge gefunden.</p>
        <p className="text-xs">
          Daten werden nach dem nächsten Hero-Sync verfügbar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">Datum</TableHead>
              <TableHead>Mitarbeiter</TableHead>
              <TableHead>Projekt</TableHead>
              <TableHead className="w-48">Ereignistyp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
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
            ))}
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
