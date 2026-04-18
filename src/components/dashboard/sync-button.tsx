"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

interface SyncResult {
  success: boolean;
  totalProjects?: number;
  durationMs?: number;
  error?: string;
}

export function SyncButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  async function handleSync() {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/cron/sync-hero", { method: "POST" });
      const data: SyncResult = await response.json();
      setResult(data);
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
        disabled={loading}
        className="flex items-center gap-2"
        id="sync-hero-button"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Wird synchronisiert…" : "Jetzt synchronisieren"}
      </Button>
    </div>
  );
}
