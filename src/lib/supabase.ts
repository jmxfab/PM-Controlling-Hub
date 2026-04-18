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

function createReadClient(): SupabaseClient {
  return createClient(
    getRequiredEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, "supabaseUrl"),
    getRequiredEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "supabaseAnonKey")
  );
}

/**
 * Standard Supabase client for client-side and general server-side reading.
 * Uses the anonymous key and is subject to RLS.
 *
 * The client is created lazily so builds and local dashboard work do not fail
 * unless a code path actually needs Supabase.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const client = createReadClient();
    const value = client[property as keyof SupabaseClient];

    return typeof value === "function" ? value.bind(client) : value;
  },
});

/**
 * Admin Supabase client for server-only operations that need to bypass RLS.
 * Specifically used for capturing snapshots.
 */
export const getSupabaseAdmin = () => {
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing.");
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
