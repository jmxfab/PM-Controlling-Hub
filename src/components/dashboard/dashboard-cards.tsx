import {
  Briefcase,
  CheckCircle,
  Banknote,
  Wrench,
  CalendarClock,
  PhoneCall,
  CalendarCheck,
  Star,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DASHBOARD_KPI_KEYS,
  type DashboardKpiKey,
} from "@/lib/hero/hero-aggregator";

export interface KPIData {
  activeProjects: number;
  completedProjectsWeek: number;
  accountingTransferredCount: number;
  accountingTransferredAmount?: number;
  openReworks: number;
  scheduledReworks: number;
  openCustomerCommitments: number;
  scheduledClosings: number;
  bewertungspoolCount: number;
}

type KpiTheme = {
  /** Hintergrund-Gradient der Icon-Bubble. */
  iconBg: string;
  /** Text-Farbe des Icons. */
  iconFg: string;
  /** Subtle Akzent-Linie/Border-Tönung beim Hover/Selected. */
  accent: string;
};

const KPI_THEMES: Record<DashboardKpiKey, KpiTheme> = {
  activeProjects: {
    iconBg: "bg-blue-100 dark:bg-blue-950/50",
    iconFg: "text-blue-600 dark:text-blue-400",
    accent: "group-hover:border-blue-300/50 group-hover:shadow-blue-100/40 dark:group-hover:shadow-blue-950/30",
  },
  completedProjectsWeek: {
    iconBg: "bg-emerald-100 dark:bg-emerald-950/50",
    iconFg: "text-emerald-600 dark:text-emerald-400",
    accent: "group-hover:border-emerald-300/50 group-hover:shadow-emerald-100/40 dark:group-hover:shadow-emerald-950/30",
  },
  accountingTransferredCount: {
    iconBg: "bg-teal-100 dark:bg-teal-950/50",
    iconFg: "text-teal-600 dark:text-teal-400",
    accent: "group-hover:border-teal-300/50 group-hover:shadow-teal-100/40 dark:group-hover:shadow-teal-950/30",
  },
  openCustomerCommitments: {
    iconBg: "bg-amber-100 dark:bg-amber-950/50",
    iconFg: "text-amber-600 dark:text-amber-400",
    accent: "group-hover:border-amber-300/50 group-hover:shadow-amber-100/40 dark:group-hover:shadow-amber-950/30",
  },
  openReworks: {
    iconBg: "bg-rose-100 dark:bg-rose-950/50",
    iconFg: "text-rose-600 dark:text-rose-400",
    accent: "group-hover:border-rose-300/50 group-hover:shadow-rose-100/40 dark:group-hover:shadow-rose-950/30",
  },
  scheduledReworks: {
    iconBg: "bg-orange-100 dark:bg-orange-950/50",
    iconFg: "text-orange-600 dark:text-orange-400",
    accent: "group-hover:border-orange-300/50 group-hover:shadow-orange-100/40 dark:group-hover:shadow-orange-950/30",
  },
  scheduledClosings: {
    iconBg: "bg-sky-100 dark:bg-sky-950/50",
    iconFg: "text-sky-600 dark:text-sky-400",
    accent: "group-hover:border-sky-300/50 group-hover:shadow-sky-100/40 dark:group-hover:shadow-sky-950/30",
  },
  bewertungspoolCount: {
    iconBg: "bg-violet-100 dark:bg-violet-950/50",
    iconFg: "text-violet-600 dark:text-violet-400",
    accent: "group-hover:border-violet-300/50 group-hover:shadow-violet-100/40 dark:group-hover:shadow-violet-950/30",
  },
};

interface DashboardKpiCardDefinition {
  title: string;
  icon: LucideIcon;
  getValue: (data: KPIData) => number;
  getDescription: (context: DashboardKpiDescriptionContext) => string;
}

interface DashboardKpiDescriptionContext {
  data: KPIData;
  departmentName: string;
  snapshotContextLabel: string;
}

export const DASHBOARD_KPI_CARD_DEFINITIONS: Record<
  DashboardKpiKey,
  DashboardKpiCardDefinition
> = {
  activeProjects: {
    title: "Aktive Projekte",
    icon: Briefcase,
    getValue: (data) => data.activeProjects,
    getDescription: ({ departmentName, snapshotContextLabel }) =>
      `${departmentName} · Stand aus dem ${snapshotContextLabel}`,
  },
  completedProjectsWeek: {
    title: "Abgeschlossen (7 Tage)",
    icon: CheckCircle,
    getValue: (data) => data.completedProjectsWeek,
    getDescription: ({ snapshotContextLabel }) =>
      `7-Tage-Wert aus dem ${snapshotContextLabel}`,
  },
  accountingTransferredCount: {
    title: "An Buchhaltung",
    icon: Banknote,
    getValue: (data) => data.accountingTransferredCount,
    getDescription: ({ data, snapshotContextLabel }) =>
      data.accountingTransferredAmount
        ? `Wert aus dem ${snapshotContextLabel}: ${formatCurrency(
            data.accountingTransferredAmount
          )}`
        : `Übergaben aus dem ${snapshotContextLabel}`,
  },
  openCustomerCommitments: {
    title: "Kunden-Zusagen",
    icon: PhoneCall,
    getValue: (data) => data.openCustomerCommitments,
    getDescription: ({ snapshotContextLabel }) =>
      `Offene Zusagen im ${snapshotContextLabel}`,
  },
  openReworks: {
    title: "Offene Nacharbeiten",
    icon: Wrench,
    getValue: (data) => data.openReworks,
    getDescription: ({ snapshotContextLabel }) =>
      `Ungelöste Tickets im ${snapshotContextLabel}`,
  },
  scheduledReworks: {
    title: "Terminierte Nacharbeiten",
    icon: CalendarClock,
    getValue: (data) => data.scheduledReworks,
    getDescription: ({ snapshotContextLabel }) =>
      `Eingeplante Termine im ${snapshotContextLabel}`,
  },
  scheduledClosings: {
    title: "Terminierte Zusagen",
    icon: CalendarCheck,
    getValue: (data) => data.scheduledClosings,
    getDescription: ({ snapshotContextLabel }) =>
      `Kundentermine im ${snapshotContextLabel}`,
  },
  bewertungspoolCount: {
    title: "Im Bewertungspool",
    icon: Star,
    getValue: (data) => data.bewertungspoolCount,
    getDescription: ({ snapshotContextLabel }) =>
      `Projekte zur Bewertung im ${snapshotContextLabel}`,
  },
};

interface DashboardCardsProps {
  data: KPIData;
  departmentName: string;
  snapshotContextLabel: string;
  onKpiSelect: (kpiKey: DashboardKpiKey) => void;
  selectedKpiKey: DashboardKpiKey | null;
}

export function DashboardCards({
  data,
  departmentName,
  snapshotContextLabel,
  onKpiSelect,
  selectedKpiKey,
}: DashboardCardsProps) {
  const descriptionContext = {
    data,
    departmentName,
    snapshotContextLabel,
  } satisfies DashboardKpiDescriptionContext;

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {DASHBOARD_KPI_KEYS.map((kpiKey) => {
        const card = DASHBOARD_KPI_CARD_DEFINITIONS[kpiKey];
        const Icon = card.icon;
        const theme = KPI_THEMES[kpiKey];
        const isSelected = selectedKpiKey === kpiKey;
        const value = card.getValue(data);

        return (
          <button
            key={kpiKey}
            type="button"
            aria-haspopup="dialog"
            aria-pressed={isSelected}
            className={cn(
              "group relative h-full overflow-hidden rounded-xl border bg-card text-left",
              "transition-all duration-200",
              "hover:-translate-y-0.5 hover:shadow-lg",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              theme.accent,
              isSelected &&
                "ring-2 ring-foreground/15 shadow-md border-foreground/15"
            )}
            onClick={() => onKpiSelect(kpiKey)}
          >
            {/* Subtle background tint nur on hover/selected */}
            <span
              className={cn(
                "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200",
                "bg-gradient-to-br from-transparent via-transparent to-current",
                theme.iconFg,
                "group-hover:opacity-[0.04]",
                isSelected && "opacity-[0.06]"
              )}
              aria-hidden
            />

            <div className="relative p-5 space-y-4">
              {/* Header: Icon-Bubble + Titel */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                    {card.title}
                  </p>
                </div>
                <div
                  className={cn(
                    "shrink-0 grid place-items-center w-10 h-10 rounded-xl transition-transform duration-200",
                    "group-hover:scale-110",
                    theme.iconBg
                  )}
                >
                  <Icon className={cn("h-5 w-5", theme.iconFg)} />
                </div>
              </div>

              {/* Big number */}
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold tabular-nums tracking-tight leading-none">
                  {value.toLocaleString("de-DE")}
                </span>
              </div>

              {/* Description */}
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                {card.getDescription(descriptionContext)}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}
