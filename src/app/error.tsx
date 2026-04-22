"use client";

import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="w-full max-w-md space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Fehler beim Laden der Dashboard-Daten</AlertTitle>
          <AlertDescription className="mt-2 whitespace-pre-wrap text-sm">
            {error.message}
          </AlertDescription>
        </Alert>
        <Button variant="outline" className="w-full" onClick={reset}>
          Erneut versuchen
        </Button>
      </div>
    </div>
  );
}
