import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
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
}

export function DashboardCards({ data, departmentName }: DashboardCardsProps) {
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
            Laufende Projekte ({departmentName})
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Abgeschlossen (Diese Woche)
          </CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.completedProjectsWeek}</div>
          <p className="text-xs text-muted-foreground">
            Inkl. Nacharbeiten abgeschlossen
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
              ? `Wert: ${new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(data.accountingTransferredAmount)}`
              : 'Übergaben diese Woche'}
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
          <p className="text-xs text-muted-foreground">Offene Rückfragen</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Offene Nacharbeiten</CardTitle>
          <Wrench className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.openReworks}</div>
          <p className="text-xs text-muted-foreground">Ungelöste Tickets</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Terminierte Nacharbeiten</CardTitle>
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.scheduledReworks}</div>
          <p className="text-xs text-muted-foreground">Eingeplante Termine</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Abschlussgespräche</CardTitle>
          <CalendarCheck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.scheduledClosings}</div>
          <p className="text-xs text-muted-foreground">Terminiert anstehend</p>
        </CardContent>
      </Card>
      
    </div>
  );
}
