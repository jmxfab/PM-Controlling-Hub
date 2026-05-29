import { AlertCircle, Loader2 } from "lucide-react";

import { getHeroSyncStatus } from "@/lib/supabase/hero-read-queries";

/**
 * Shown above the dashboard whenever the Supabase mirror is empty (first-time
 * sync still running) or the latest sync errored out.
 */
export async function SyncInProgressBanner() {
  let status;
  try {
    status = await getHeroSyncStatus();
  } catch {
    return null;
  }

  if (status.projectCount > 0 && status.lastRunStatus !== "error") {
    return null;
  }

  if (status.projectCount === 0 && status.lastRunStatus === "error") {
    return (
      <div className="relative overflow-hidden rounded-xl border border-destructive/30 bg-gradient-to-br from-destructive/10 via-destructive/5 to-transparent px-4 py-3.5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="shrink-0 grid place-items-center w-9 h-9 rounded-lg bg-destructive/15 ring-1 ring-destructive/20">
            <AlertCircle className="h-4.5 w-4.5 text-destructive" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-destructive">Hero-Sync fehlgeschlagen</p>
            <p className="text-xs text-destructive/90">
              Der Hero-Sync konnte noch nie erfolgreich laufen
              {status.lastRunError ? ` (${status.lastRunError})` : ""}. Bitte
              GitHub-Secrets prüfen und den Workflow manuell starten.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status.projectCount === 0) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-blue-300/40 bg-gradient-to-br from-blue-50 via-blue-50/50 to-transparent dark:from-blue-950/40 dark:via-blue-950/20 px-4 py-3.5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="shrink-0 grid place-items-center w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-950/60 ring-1 ring-blue-200/50">
            <Loader2 className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400 animate-spin" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-blue-700 dark:text-blue-300">Hero-Sync läuft</p>
            <p className="text-xs text-blue-700/80 dark:text-blue-300/80">
              Daten werden gerade erstmalig aus Hero geladen · in wenigen Minuten neu laden
            </p>
          </div>
        </div>
      </div>
    );
  }

  // projectCount > 0 but most recent run errored
  return (
    <div className="relative overflow-hidden rounded-xl border border-amber-300/40 bg-gradient-to-br from-amber-50 via-amber-50/50 to-transparent dark:from-amber-950/40 dark:via-amber-950/20 px-4 py-3.5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="shrink-0 grid place-items-center w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-950/60 ring-1 ring-amber-200/50">
          <AlertCircle className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-amber-800 dark:text-amber-300">Letzter Hero-Sync fehlgeschlagen</p>
          <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
            Daten aus letztem erfolgreichen Sync
            {status.lastRunError ? ` · ${status.lastRunError}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
