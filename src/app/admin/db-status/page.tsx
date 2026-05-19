import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

async function loadDbStats() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .rpc("compute_db_size_stats")
    .single<{
      total_bytes: number;
      table_count: number;
      largest_tables: Array<{ name: string; bytes: number }>;
    }>();
  if (error || !data) return null;
  return data;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// Supabase Tier-Limits:
//  Free: 500 MB, Pro: 8 GB included, dann ~$0.125/GB
const TIER_LIMIT_BYTES = 8 * 1024 * 1024 * 1024; // 8 GB (Pro)

export default async function DbStatusPage() {
  const stats = await loadDbStats();
  if (!stats) {
    return (
      <main className="container max-w-3xl py-8">
        <h1 className="text-2xl font-bold">DB-Status</h1>
        <p className="text-rose-600 mt-2">
          Konnte DB-Statistiken nicht laden.
        </p>
      </main>
    );
  }

  const pct = (stats.total_bytes / TIER_LIMIT_BYTES) * 100;
  const pctClamped = Math.min(100, pct);
  const barColor =
    pct < 60 ? "bg-emerald-500" : pct < 85 ? "bg-amber-500" : "bg-rose-500";

  return (
    <main className="container max-w-3xl py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">DB-Status</h1>
        <p className="text-sm text-muted-foreground">
          Supabase Postgres — Projekt oudamptxxncbaorjepqo
        </p>
      </header>

      {/* Total-Size Card */}
      <section className="rounded-2xl border bg-card p-6 space-y-4">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Gesamt-Größe
            </div>
            <div className="text-3xl font-bold tabular-nums mt-1">
              {formatBytes(stats.total_bytes)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              {pct.toFixed(1)}% von 8 GB
            </div>
            <div className="text-sm text-muted-foreground mt-1 tabular-nums">
              {stats.table_count} Tabellen
            </div>
          </div>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full ${barColor} transition-all duration-500`}
            style={{ width: `${pctClamped}%` }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Pro-Tier-Limit 8 GB inkludiert. Darüber: ~$0.125/GB/Monat.
          Bei {">"}85% lohnt sich Aufräumen (alte Hero-Histories trimmen oder Indizes prüfen).
        </p>
      </section>

      {/* Top Tables */}
      <section className="rounded-2xl border bg-card p-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Top 10 größte Tabellen
        </h2>
        <div className="space-y-2">
          {stats.largest_tables.map((t) => {
            const tPct = (t.bytes / stats.total_bytes) * 100;
            return (
              <div key={t.name} className="space-y-1">
                <div className="flex items-baseline justify-between text-[13px]">
                  <span className="font-medium tabular-nums">{t.name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatBytes(t.bytes)} · {tPct.toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-blue-500"
                    style={{ width: `${Math.min(100, tPct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <p className="text-[11px] text-muted-foreground">
        Aktualisiert sich bei Page-Reload (force-dynamic). Migration:
        compute_db_size_stats() (Service-Role only).
      </p>
    </main>
  );
}
