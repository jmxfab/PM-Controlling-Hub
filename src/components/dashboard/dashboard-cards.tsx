import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Briefcase,
  CheckCircle,
  Banknote,
  Wrench,
  CalendarClock,
  PhoneCall,
  CalendarCheck,
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
}

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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {DASHBOARD_KPI_KEYS.map((kpiKey) => {
        const card = DASHBOARD_KPI_CARD_DEFINITIONS[kpiKey];
        const Icon = card.icon;
        const isSelected = selectedKpiKey === kpiKey;

        return (
          <button
            key={kpiKey}
            type="button"
            aria-haspopup="dialog"
            className="group h-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={() => onKpiSelect(kpiKey)}
          >
            <Card
              className={cn(
                "h-full transition-colors",
                "group-hover:border-ring/40 group-hover:bg-accent/20",
                isSelected ? "border-ring/50 bg-accent/20" : undefined
              )}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.getValue(data)}</div>
                <p className="text-xs text-muted-foreground">
                  {card.getDescription(descriptionContext)}
                </p>
              </CardContent>
            </Card>
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
