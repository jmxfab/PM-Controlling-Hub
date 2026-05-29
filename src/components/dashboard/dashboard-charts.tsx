"use client";

import { useEffect, useRef, useState } from "react";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = chartContainerRef.current;

    if (!element) {
      return undefined;
    }

    const updateSize = () => {
      const nextWidth = Math.floor(element.clientWidth);
      const nextHeight = Math.floor(element.clientHeight);

      setChartSize((currentSize) => {
        if (
          currentSize.width === nextWidth &&
          currentSize.height === nextHeight
        ) {
          return currentSize;
        }

        return {
          width: nextWidth,
          height: nextHeight,
        };
      });
    };

    updateSize();

    if (typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      updateSize();
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  if (historicData.length === 0) {
    return (
      <Card className="col-span-4 mt-6 min-w-0 rounded-xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Zeitraumverlauf · {departmentName}</CardTitle>
          <CardDescription className="text-xs">{historicDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed bg-muted/20 text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-4 mt-6 min-w-0 rounded-xl shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Zeitraumverlauf · {departmentName}</CardTitle>
        <CardDescription className="text-xs">{historicDescription}</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 pl-2">
        <div
          ref={chartContainerRef}
          className="mt-4 h-[350px] min-h-[350px] w-full min-w-0"
        >
          {chartSize.width > 0 && chartSize.height > 0 ? (
            <AreaChart
              width={chartSize.width}
              height={chartSize.height}
              data={historicData}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <defs>
                <linearGradient id="gradActive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradAccounting" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/60" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.75rem",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                  fontSize: "12px",
                }}
                itemStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Legend
                wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                iconType="circle"
              />
              <Area
                type="monotone"
                dataKey="active"
                name="Aktive Projekte"
                stroke="#3b82f6"
                strokeWidth={2.5}
                fill="url(#gradActive)"
                activeDot={{ r: 6, strokeWidth: 2 }}
              />
              <Area
                type="monotone"
                dataKey="completed"
                name="Abgeschlossen"
                stroke="#10b981"
                strokeWidth={2.5}
                fill="url(#gradCompleted)"
                activeDot={{ r: 5, strokeWidth: 2 }}
              />
              <Area
                type="monotone"
                dataKey="accounting"
                name="Buchhaltung"
                stroke="#f59e0b"
                strokeWidth={2.5}
                fill="url(#gradAccounting)"
                activeDot={{ r: 5, strokeWidth: 2 }}
              />
            </AreaChart>
          ) : (
            <div className="h-full w-full rounded-lg bg-muted/30" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
