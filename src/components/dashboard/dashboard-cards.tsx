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
} from "lucide-react";

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

interface DashboardCardsProps {
  data: KPIData;
  departmentName: string;
  snapshotContextLabel: string;
}

export function DashboardCards({
  data,
  departmentName,
  snapshotContextLabel,
}: DashboardCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Aktive Projekte
          </CardTitle>
          <Briefcase className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.activeProjects}</div>
          <p className="text-xs text-muted-foreground">
            {departmentName} · Stand aus dem {snapshotContextLabel}
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Abgeschlossen (7 Tage)
          </CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.completedProjectsWeek}</div>
          <p className="text-xs text-muted-foreground">
            7-Tage-Wert aus dem {snapshotContextLabel}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">An Buchhaltung</CardTitle>
          <Banknote className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.accountingTransferredCount}</div>
          <p className="text-xs text-muted-foreground">
            {data.accountingTransferredAmount 
              ? `Wert aus dem ${snapshotContextLabel}: ${new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(data.accountingTransferredAmount)}`
              : `Übergaben aus dem ${snapshotContextLabel}`}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Kunden-Zusagen</CardTitle>
          <PhoneCall className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.openCustomerCommitments}</div>
          <p className="text-xs text-muted-foreground">
            Offene Zusagen im {snapshotContextLabel}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Offene Nacharbeiten</CardTitle>
          <Wrench className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.openReworks}</div>
          <p className="text-xs text-muted-foreground">
            Ungelöste Tickets im {snapshotContextLabel}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Terminierte Nacharbeiten</CardTitle>
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.scheduledReworks}</div>
          <p className="text-xs text-muted-foreground">
            Eingeplante Termine im {snapshotContextLabel}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Terminierte Zusagen</CardTitle>
          <CalendarCheck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.scheduledClosings}</div>
          <p className="text-xs text-muted-foreground">
            Kundentermine im {snapshotContextLabel}
          </p>
        </CardContent>
      </Card>
      
    </div>
  );
}
