import { AlertCircle, Loader2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Hero-Sync fehlgeschlagen</AlertTitle>
        <AlertDescription>
          Der Hero-Sync konnte noch nie erfolgreich laufen
          {status.lastRunError ? ` (${status.lastRunError})` : ""}. Bitte die
          GitHub-Secrets (HERO_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
          prüfen und den Workflow „Hero → Supabase Sync" manuell starten.
        </AlertDescription>
      </Alert>
    );
  }

  if (status.projectCount === 0) {
    return (
      <Alert>
        <Loader2 className="h-4 w-4 animate-spin" />
        <AlertTitle>Hero-Sync läuft</AlertTitle>
        <AlertDescription>
          Die Daten werden gerade erstmalig aus Hero nach Supabase geladen. Bitte
          in wenigen Minuten die Seite aktualisieren — das Dashboard rendert
          sofort, sobald der Sync durch ist.
        </AlertDescription>
      </Alert>
    );
  }

  // projectCount > 0 but most recent run errored
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Letzter Hero-Sync fehlgeschlagen</AlertTitle>
      <AlertDescription>
        Die angezeigten Daten stammen aus dem letzten erfolgreichen Sync. Der
        aktuelle Lauf ist fehlgeschlagen
        {status.lastRunError ? `: ${status.lastRunError}` : ""}.
      </AlertDescription>
    </Alert>
  );
}
