import type { Metadata } from "next";
import {
  Activity,
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  Euro,
  TrendingDown,
  Users,
} from "lucide-react";
import { loadWeeklyDigest } from "@/lib/digest/weekly-digest";

export const metadata: Metadata = {
  title: "Wochen-Digest | JMX",
  description: "Was war letzte Jumax-Woche los — Top Mitarbeiter, Events, Projekte, Anomalien.",
};

// Jeden Mo morgen frisch — danach 6h Cache (Digest aendert sich kaum waehrend des Tages)
export const revalidate = 21_600;

function fmtEur(n: number): string {
  return new Intl.NumberFormat("de-AT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export default async function DigestPage() {
  const digest = await loadWeeklyDigest().catch(() => null);

  if (!digest) {
    return (
      <div className="flex-1 p-6 md:p-8 max-w-[1200px] mx-auto">
        <h1 className="text-2xl font-bold tracking-tight">Wochen-Digest</h1>
        <p className="text-muted-foreground mt-4">
          Konnte die Daten nicht laden. Bitte später erneut versuchen.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-6 md:p-8 max-w-[1200px] mx-auto">
      <header className="space-y-1">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/60 dark:bg-blue-950/40 text-[11px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300 ring-1 ring-blue-200/50 dark:ring-blue-900/50">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-subtle-glow" />
          Letzte Jumax-Woche
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Wochen-Digest
        </h1>
        <p className="text-sm text-muted-foreground">
          {digest.rangeLabel} — was diese Woche los war
        </p>
      </header>

      {/* Top-Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          label="Neue Aufgaben"
          value={digest.tasks.newCount}
          icon={<Briefcase size={14} />}
          color="blue"
        />
        <Stat
          label="Erledigt"
          value={digest.tasks.doneCount}
          icon={<CheckCircle2 size={14} />}
          color="emerald"
        />
        <Stat
          label="Kritisch offen"
          value={digest.tasks.kritischOpen}
          icon={<AlertTriangle size={14} />}
          color="rose"
        />
        <Stat
          label="Offen gesamt"
          value={digest.tasks.openTotal}
          icon={<Activity size={14} />}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Mitarbeiter */}
        <Section
          title="Top Mitarbeiter (Logbuch-Events)"
          icon={<Users size={14} />}
        >
          {digest.topPeople.length === 0 ? (
            <Empty text="Niemand hat diese Woche Events geloggt." />
          ) : (
            <ol className="space-y-1.5">
              {digest.topPeople.map((p, i) => (
                <li
                  key={p.email}
                  className="flex items-center gap-2 text-[13px]"
                >
                  <span className="shrink-0 w-5 text-[10px] text-muted-foreground tabular-nums text-right">
                    #{i + 1}
                  </span>
                  <span className="flex-1 truncate">
                    {p.name ?? p.email.split("@")[0]}
                  </span>
                  <span className="tabular-nums font-semibold text-foreground/80">
                    {p.events}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Section>

        {/* Top Event-Types */}
        <Section
          title="Top Event-Typen"
          icon={<Activity size={14} />}
        >
          {digest.topEventTypes.length === 0 ? (
            <Empty text="Keine Events diese Woche." />
          ) : (
            <ol className="space-y-1.5">
              {digest.topEventTypes.map((t) => (
                <li
                  key={t.eventType}
                  className="flex items-center gap-2 text-[13px]"
                >
                  <span className="flex-1 truncate">{t.eventType}</span>
                  <span className="tabular-nums font-semibold text-foreground/80">
                    {t.count}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Section>

        {/* Anomalien */}
        <Section
          title="Anomalien (deutlich unter 4-Wochen-Schnitt)"
          icon={<TrendingDown size={14} />}
          tone="warn"
        >
          {digest.anomalies.length === 0 ? (
            <Empty text="Keine Ausreißer — alles im Soll." />
          ) : (
            <ul className="space-y-1.5">
              {digest.anomalies.slice(0, 8).map((a) => (
                <li
                  key={a.email}
                  className="flex items-center gap-2 text-[13px]"
                >
                  <span className="flex-1 truncate">
                    {a.name ?? a.email.split("@")[0]}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {a.thisWeek} / ⌀ {a.avg4Weeks}
                  </span>
                  <span
                    className={`tabular-nums font-semibold ${
                      a.deltaPct < -50
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {a.deltaPct}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Cash */}
        <Section title="Liquidität-Snapshot" icon={<Euro size={14} />} tone="cash">
          <ul className="space-y-1.5 text-[13px]">
            <li className="flex justify-between">
              <span className="text-muted-foreground">Gesamt offen</span>
              <span className="font-semibold tabular-nums">
                {fmtEur(digest.cash.totalOpenEur)}
              </span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted-foreground">
                Überfällig ({digest.cash.overdueCount} Rg.)
              </span>
              <span
                className={`font-semibold tabular-nums ${
                  digest.cash.overdueEur > 0
                    ? "text-rose-700 dark:text-rose-300"
                    : ""
                }`}
              >
                {fmtEur(digest.cash.overdueEur)}
              </span>
            </li>
          </ul>
        </Section>
      </div>

      {/* Neue + erledigte Projekte */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section
          title={`Neue Projekte (${digest.newProjects.length})`}
          icon={<Briefcase size={14} />}
        >
          {digest.newProjects.length === 0 ? (
            <Empty text="Diese Woche kein Neuzugang." />
          ) : (
            <ul className="space-y-1.5">
              {digest.newProjects.slice(0, 10).map((p) => (
                <li key={p.id} className="text-[13px]">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                      {p.number ?? "—"}
                    </span>
                    <span className="truncate flex-1">
                      {p.customer ?? p.name ?? "—"}
                    </span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {fmtDate(p.createdAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title={`Abgeschlossen (${digest.completedProjects.length})`}
          icon={<CheckCircle2 size={14} />}
          tone="ok"
        >
          {digest.completedProjects.length === 0 ? (
            <Empty text="Kein Abschluss diese Woche." />
          ) : (
            <ul className="space-y-1.5">
              {digest.completedProjects.slice(0, 10).map((p) => (
                <li key={p.id} className="text-[13px]">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                      {p.number ?? "—"}
                    </span>
                    <span className="truncate flex-1">
                      {p.customer ?? p.name ?? "—"}
                    </span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {fmtDate(p.finishedAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: "blue" | "emerald" | "rose" | "amber";
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300",
    emerald:
      "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
    rose: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300",
    amber:
      "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
  };
  return (
    <div className="rounded-2xl border bg-card/60 p-3 space-y-1">
      <div
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ring-1 text-[10px] font-semibold uppercase tracking-wider ${colors[color]}`}
      >
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
  tone,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  tone?: "warn" | "ok" | "cash";
}) {
  const ring =
    tone === "warn"
      ? "ring-amber-200/60 dark:ring-amber-900/40"
      : tone === "ok"
        ? "ring-emerald-200/60 dark:ring-emerald-900/40"
        : tone === "cash"
          ? "ring-emerald-200/60 dark:ring-emerald-900/40"
          : "ring-border/60";
  return (
    <section
      className={`rounded-2xl border bg-card/40 p-4 space-y-2 ring-1 ${ring}`}
    >
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="text-[12px] text-muted-foreground italic py-2">{text}</p>
  );
}
