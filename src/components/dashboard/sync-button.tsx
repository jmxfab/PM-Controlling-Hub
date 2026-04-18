"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

interface SyncResult {
  success: boolean;
  totalProjects?: number;
  durationMs?: number;
  error?: string;
}

interface SyncButtonProps {
  manualSyncEnabled: boolean;
  disabledReason?: string;
}

export function SyncButton({
  manualSyncEnabled,
  disabledReason,
}: SyncButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const router = useRouter();

  async function handleSync() {
    if (!manualSyncEnabled) {
      setResult({
        success: false,
        error: disabledReason ?? "Manueller Sync ist derzeit deaktiviert.",
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/cron/sync-hero", { method: "POST" });
      const data: SyncResult = await response.json();
      setResult(data);

      if (response.ok && data.success) {
        router.refresh();
      }
    } catch {
      setResult({ success: false, error: "Netzwerkfehler" });
    } finally {
      setLoading(false);
      // Auto-clear success message after 5s
      setTimeout(() => setResult(null), 5000);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {result && (
        <span
          className={`flex items-center gap-1.5 text-sm ${
            result.success ? "text-emerald-500" : "text-red-500"
          }`}
        >
          {result.success ? (
            <>
              <CheckCircle className="h-4 w-4" />
              {result.totalProjects} Projekte synchronisiert
              {result.durationMs && ` (${(result.durationMs / 1000).toFixed(1)}s)`}
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4" />
              {result.error ?? "Fehler beim Sync"}
            </>
          )}
        </span>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={handleSync}
        disabled={loading || !manualSyncEnabled}
        className="flex items-center gap-2"
        id="sync-hero-button"
        title={!manualSyncEnabled ? disabledReason : undefined}
      >
        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Wird synchronisiert…" : "Jetzt synchronisieren"}
      </Button>
    </div>
  );
}
