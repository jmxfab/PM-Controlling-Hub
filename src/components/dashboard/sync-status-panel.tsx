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
      <Badge variant="secondary" className="gap-1">
        <CheckCircle2 className="h-3 w-3" />
        OK
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertCircle className="h-3 w-3" />
        Fehler
      </Badge>
    );
  }
  if (status === "running") {
    return (
      <Badge variant="outline" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        läuft
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <Minus className="h-3 w-3" />
      noch nie
    </Badge>
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
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Hero Sync Status</CardTitle>
          {dto.activeRuns > 0 ? (
            <Badge variant="outline" className="gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {dto.activeRuns} laufend
            </Badge>
          ) : null}
        </div>
        <CardDescription>
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
