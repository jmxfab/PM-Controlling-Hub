import { cache } from "react";

import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * Server-only helpers for managing the Hero API key.
 *
 * The key is stored in the `app_settings` table under the key
 * `hero_api_key`. Row Level Security on the table ensures only the
 * service role can read or write it.
 *
 * Read precedence:
 *  1. `app_settings.hero_api_key` (UI-managed override)
 *  2. `process.env.HERO_API_KEY` (env fallback for local dev)
 */
export const HERO_API_KEY_SETTING = "hero_api_key" as const;

export interface HeroApiKeyStatus {
  configured: boolean;
  maskedKey: string | null;
  source: "db" | "env" | "none";
  updatedAt: string | null;
}

interface AppSettingsRow {
  key: string;
  value: string;
  updated_at: string;
}

/**
 * Returns the active Hero API key (DB-first, env-fallback) or null.
 * Memoized per request so multiple Hero GraphQL calls in the same
 * render do not hit Supabase repeatedly.
 */
export const getActiveHeroApiKey = cache(async (): Promise<string | null> => {
  if (isSupabaseAdminConfigured()) {
    const dbKey = await readHeroApiKeyFromDb().catch((error) => {
      console.warn(
        "[hero-settings] Could not read hero_api_key from Supabase, falling back to env.",
        error
      );
      return null;
    });

    if (dbKey && dbKey.trim().length > 0) {
      return dbKey.trim();
    }
  }

  const envKey = process.env.HERO_API_KEY?.trim();
  return envKey && envKey.length > 0 ? envKey : null;
});

/**
 * Returns a safe status object for the UI. Never exposes the raw key.
 */
export const getHeroApiKeyStatus = cache(
  async (): Promise<HeroApiKeyStatus> => {
    if (isSupabaseAdminConfigured()) {
      const dbRow = await readHeroApiKeyRowFromDb().catch(() => null);

      if (dbRow && dbRow.value.trim().length > 0) {
        return {
          configured: true,
          maskedKey: maskKey(dbRow.value),
          source: "db",
          updatedAt: dbRow.updated_at,
        };
      }
    }

    const envKey = process.env.HERO_API_KEY?.trim();
    if (envKey && envKey.length > 0) {
      return {
        configured: true,
        maskedKey: maskKey(envKey),
        source: "env",
        updatedAt: null,
      };
    }

    return {
      configured: false,
      maskedKey: null,
      source: "none",
      updatedAt: null,
    };
  }
);

/**
 * Persist a new Hero API key in the DB. Overwrites any previous value.
 */
export async function saveHeroApiKey(rawKey: string): Promise<HeroApiKeyStatus> {
  const trimmed = rawKey.trim();
  if (trimmed.length < 10) {
    throw new Error("Hero API key must be at least 10 characters long.");
  }

  if (!isSupabaseAdminConfigured()) {
    throw new Error(
      "Supabase ist serverseitig nicht konfiguriert. Setze NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY als Umgebungsvariablen (lokal in .env.local oder in den Vercel Project Settings) und deploye neu."
    );
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: HERO_API_KEY_SETTING,
      value: trimmed,
    },
    { onConflict: "key" }
  );

  if (error) {
    throw new Error(`Could not save Hero API key: ${error.message}`);
  }

  return {
    configured: true,
    maskedKey: maskKey(trimmed),
    source: "db",
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Delete the stored Hero API key. Revert to env-variable behavior.
 */
export async function clearHeroApiKey(): Promise<void> {
  if (!isSupabaseAdminConfigured()) {
    throw new Error(
      "Supabase ist serverseitig nicht konfiguriert. Setze NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY als Umgebungsvariablen."
    );
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("app_settings")
    .delete()
    .eq("key", HERO_API_KEY_SETTING);

  if (error) {
    throw new Error(`Could not clear Hero API key: ${error.message}`);
  }
}

async function readHeroApiKeyFromDb(): Promise<string | null> {
  const row = await readHeroApiKeyRowFromDb();
  return row?.value ?? null;
}

async function readHeroApiKeyRowFromDb(): Promise<AppSettingsRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value, updated_at")
    .eq("key", HERO_API_KEY_SETTING)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as AppSettingsRow | null) ?? null;
}

function maskKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 4) {
    return "****";
  }
  return `****${trimmed.slice(-4)}`;
}

function isSupabaseAdminConfigured(): boolean {
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim());
  const hasServiceRole = Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
  return hasUrl && hasServiceRole;
}
