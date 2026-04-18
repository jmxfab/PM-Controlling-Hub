"use client";

import { useSyncExternalStore } from "react";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface HistoricDataPoint {
  date: string;
  active: number;
  completed: number;
  accounting: number;
}

interface DashboardChartsProps {
  historicData: HistoricDataPoint[];
  historicDescription: string;
  departmentName: string;
  emptyMessage: string;
}

export function DashboardCharts({
  historicData,
  historicDescription,
  departmentName,
  emptyMessage,
}: DashboardChartsProps) {
  const isMounted = useSyncExternalStore(subscribeToBrowserRender, () => true, () => false);

  if (historicData.length === 0) {
    return (
      <Card className="col-span-4 mt-6 min-w-0">
        <CardHeader>
          <CardTitle>Zeitraumverlauf: {departmentName}</CardTitle>
          <CardDescription>{historicDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-4 mt-6 min-w-0">
      <CardHeader>
        <CardTitle>Zeitraumverlauf: {departmentName}</CardTitle>
        <CardDescription>{historicDescription}</CardDescription>
      </CardHeader>
      <CardContent className="pl-2 min-w-0">
        {isMounted ? (
          <div className="mt-4 h-[350px] min-h-[350px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={historicData}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" stroke="hsl(var(--muted-foreground))" />
                <YAxis className="text-xs" stroke="hsl(var(--muted-foreground))" />
                <Tooltip 
                  contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                  itemStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                <Line
                  type="monotone"
                  dataKey="active"
                  name="Aktive Projekte"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  activeDot={{ r: 8 }}
                />
                <Line
                  type="monotone"
                  dataKey="completed"
                  name="Abgeschlossen"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="accounting"
                  name="Buchhaltung"
                  stroke="hsl(var(--chart-4))"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="mt-4 h-[350px] min-h-[350px] w-full rounded-lg bg-muted/30" />
        )}
      </CardContent>
    </Card>
  );
}

function subscribeToBrowserRender(): () => void {
  return () => undefined;
}
