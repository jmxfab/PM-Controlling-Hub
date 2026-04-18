"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

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
  const router = useRouter();

  function handleRefresh() {
    if (!liveHeroAvailable) {
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  const button = (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRefresh}
      disabled={isPending || !liveHeroAvailable}
      className="flex items-center gap-2"
      id="refresh-hero-button"
      title={
        liveHeroAvailable
          ? "Liest Hero-Daten neu vom Server"
          : disabledReason
      }
    >
      <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
      {isPending ? "Hero lädt…" : "Hero Daten laden"}
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
