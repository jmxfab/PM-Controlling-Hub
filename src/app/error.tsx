"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Damit der Fehler in den Browser-DevTools sichtbar ist (in Production
  // wird error.message von Next.js sonst redacted). Vercel loggt den
  // Server-Trace separat unter der digest-ID.
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[dashboard-error]", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  const isServerComponentError = error.message.includes("Server Components");

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="w-full max-w-md space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Dashboard konnte nicht geladen werden</AlertTitle>
          <AlertDescription className="mt-2 space-y-2 text-sm">
            <p>
              {isServerComponentError
                ? "Beim Rendern der Server-Daten ist etwas schiefgelaufen — meist eine kurz hängende Supabase-Verbindung nach einem Deploy. Einmal neu laden reicht normalerweise."
                : error.message}
            </p>
            {error.digest ? (
              <p className="text-xs opacity-70">
                Fehler-ID: <code className="font-mono">{error.digest}</code>
              </p>
            ) : null}
          </AlertDescription>
        </Alert>
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={reset}
        >
          <RefreshCw className="h-4 w-4" />
          Erneut versuchen
        </Button>
      </div>
    </div>
  );
}
