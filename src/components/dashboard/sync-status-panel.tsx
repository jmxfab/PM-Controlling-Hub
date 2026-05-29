import { AlertCircle, CheckCircle2, Loader2, Minus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getHeroSyncStatusDetails,
  type EntitySyncSummary,
} from "@/lib/supabase/hero-sync-status";

function formatTimestamp(value: string | null): string {
  if (!value) return "–";
  try {
    return new Date(value).toLocaleString("de-DE");
  } catch {
    return value;
  }
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "–";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function statusBadge(status: EntitySyncSummary["lastRunStatus"]) {
  if (status === "success") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/50">
        <CheckCircle2 className="h-3 w-3" />
        OK
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900/50">
        <AlertCircle className="h-3 w-3" />
        Fehler
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/50">
        <Loader2 className="h-3 w-3 animate-spin" />
        läuft
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
      <Minus className="h-3 w-3" />
      noch nie
    </span>
  );
}

export async function SyncStatusPanel() {
  let dto;
  try {
    dto = await getHeroSyncStatusDetails();
  } catch (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Hero Sync Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            Sync-Status konnte nicht geladen werden:{" "}
            {error instanceof Error ? error.message : String(error)}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold">Hero Sync Status</CardTitle>
          {dto.activeRuns > 0 ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/50">
              <Loader2 className="h-3 w-3 animate-spin" />
              {dto.activeRuns} laufend
            </span>
          ) : null}
        </div>
        <CardDescription className="text-xs">
          Mirror der Hero-Daten in Supabase. Letzter Lauf:{" "}
          {formatTimestamp(dto.latestRunAt)}. Detaillierte Runs in der Tabelle{" "}
          <code className="font-mono">hero_sync_runs</code>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entity</TableHead>
              <TableHead className="text-right">Zeilen</TableHead>
              <TableHead>Letzter Sync</TableHead>
              <TableHead>Dauer</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dto.entities.map((row) => (
              <TableRow key={row.entity}>
                <TableCell className="font-mono text-sm">{row.entity}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {row.rows.toLocaleString("de-DE")}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatTimestamp(row.lastRunAt)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground tabular-nums">
                  {formatDuration(row.lastDurationMs)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {statusBadge(row.lastRunStatus)}
                    {row.lastError ? (
                      <span
                        className="text-xs text-destructive truncate max-w-[260px]"
                        title={row.lastError}
                      >
                        {row.lastError}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
