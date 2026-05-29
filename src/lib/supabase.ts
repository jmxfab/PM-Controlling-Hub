import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function getRequiredEnv(
  value: string | undefined,
  variableName: string
): string {
  if (!value) {
    throw new Error(`${variableName} is required.`);
  }

  return value;
}

let _readClient: SupabaseClient | null = null;

function getReadClient(): SupabaseClient {
  if (!_readClient) {
    _readClient = createClient(
      getRequiredEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
      getRequiredEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "NEXT_PUBLIC_SUPABASE_ANON_KEY")
    );
  }
  return _readClient;
}

/**
 * Standard Supabase client for client-side and general server-side reading.
 * Uses the anonymous key and is subject to RLS. Singleton — created once on
 * first use so builds without env vars don't fail at import time.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const client = getReadClient();
    const value = client[property as keyof SupabaseClient];

    return typeof value === "function" ? value.bind(client) : value;
  },
});

/**
 * Admin Supabase client for server-only operations that need to bypass RLS.
 * Specifically used for capturing snapshots.
 */
export const getSupabaseAdmin = () => {
  // Konsistent mit den uebrigen Routen (z.B. mail-tasks): bevorzugt das neue
  // SUPABASE_SECRET_KEY, faellt auf SUPABASE_SERVICE_ROLE_KEY zurueck.
  const supabaseServiceKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseServiceKey) {
    throw new Error("SUPABASE_SECRET_KEY oder SUPABASE_SERVICE_ROLE_KEY ist erforderlich.");
  }

  return createClient(
    getRequiredEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, "supabaseUrl"),
    supabaseServiceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
};
