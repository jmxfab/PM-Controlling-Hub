"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

interface SyncButtonProps {
  liveHeroAvailable: boolean;
  disabledReason?: string;
}

export function SyncButton({
  liveHeroAvailable,
  disabledReason,
}: SyncButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [isTriggering, setIsTriggering] = useState(false);
  const router = useRouter();

  async function handleTriggerSync() {
    if (isTriggering || isPending) return;

    setIsTriggering(true);
    try {
      const response = await fetch("/api/admin/trigger-hero-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entities: "all" }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        triggered?: boolean;
        runsUrl?: string;
        error?: string;
      };

      if (!response.ok || !payload.triggered) {
        toast.error(payload.error ?? "Sync konnte nicht gestartet werden.");
      } else {
        toast.success("Hero-Sync gestartet.", {
          description: payload.runsUrl
            ? "Läuft in GitHub Actions — Fortschritt siehe Actions-Tab."
            : undefined,
          action: payload.runsUrl
            ? {
                label: "Actions öffnen",
                onClick: () => window.open(payload.runsUrl, "_blank"),
              }
            : undefined,
        });
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Sync-Trigger fehlgeschlagen."
      );
    } finally {
      setIsTriggering(false);
      startTransition(() => router.refresh());
    }
  }

  const busy = isTriggering || isPending;
  const button = (
    <Button
      variant="outline"
      size="sm"
      onClick={handleTriggerSync}
      disabled={busy || !liveHeroAvailable}
      className="flex items-center gap-2"
      id="refresh-hero-button"
      title={
        liveHeroAvailable
          ? "Startet den Hero-Sync in GitHub Actions"
          : disabledReason
      }
    >
      <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
      {isTriggering ? "Sync startet…" : "Hero Sync starten"}
    </Button>
  );

  if (!liveHeroAvailable && disabledReason) {
    return (
      <span className="inline-flex" title={disabledReason}>
        {button}
      </span>
    );
  }

  return button;
}
