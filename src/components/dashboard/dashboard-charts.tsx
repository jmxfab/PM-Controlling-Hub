"use client";

import React from "react";
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
  departmentName: string;
}

export function DashboardCharts({ historicData, departmentName }: DashboardChartsProps) {
  return (
    <Card className="col-span-4 mt-6">
      <CardHeader>
        <CardTitle>Wochenverlauf: {departmentName}</CardTitle>
        <CardDescription>
          Trend der Projektentwicklung in den letzten Wochen
        </CardDescription>
      </CardHeader>
      <CardContent className="pl-2">
        <div className="h-[350px] w-full mt-4">
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
                stroke="#10b981"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="accounting"
                name="Buchhaltung"
                stroke="#f59e0b"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
