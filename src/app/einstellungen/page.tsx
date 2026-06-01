import { Suspense } from "react";
import type { Metadata } from "next";

import { HeroAdminPanel } from "@/components/dashboard/hero-admin-panel";
import { SyncButton } from "@/components/dashboard/sync-button";
import { SyncStatusPanel } from "@/components/dashboard/sync-status-panel";
import { ThemeToggleCard } from "@/components/settings/theme-toggle-card";
import { UserCard } from "@/components/settings/user-card";
import { getHeroApiKeyStatus } from "@/lib/settings/hero-settings";

export const metadata: Metadata = {
  title: "Einstellungen",
  description:
    "Hero-Schnittstelle, Sync-Status und API-Key-Verwaltung für die Projektmanagement Demo.",
};

export const revalidate = 30;

export default async function SettingsPage() {
  const heroProjectLinkTemplate = process.env.HERO_PROJECT_URL_TEMPLATE ?? null;
  const heroApiKeyStatus = await getHeroApiKeyStatus().catch(() => ({
    configured: Boolean(process.env.HERO_API_KEY?.trim()),
    maskedKey: null,
    source: "none" as const,
    updatedAt: null,
    supabaseConfigured: false,
  }));

  const liveHeroAvailable = heroApiKeyStatus.configured;
  const liveHeroDisabledReason = liveHeroAvailable
    ? undefined
    : "Ohne Hero API Key kann der Sync in GitHub Actions nicht laufen — bitte den Key hinterlegen.";

  return (
    <div className="flex-1 space-y-6 p-6 md:p-8 max-w-[1600px] mx-auto min-h-screen">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Einstellungen
          </h1>
          <p className="text-sm text-muted-foreground">
            Account · Theme · Hero-Schnittstelle · Sync-Status
          </p>
        </div>
        <SyncButton
          liveHeroAvailable={liveHeroAvailable}
          disabledReason={liveHeroDisabledReason}
        />
      </header>

      <UserCard />

      <ThemeToggleCard />

      <HeroAdminPanel
        heroReadOnlyConfigured={heroApiKeyStatus.configured}
        heroProjectLinkTemplateConfigured={Boolean(heroProjectLinkTemplate)}
        initialStatus={heroApiKeyStatus}
      />

      <Suspense fallback={null}>
        <SyncStatusPanel />
      </Suspense>
    </div>
  );
}
