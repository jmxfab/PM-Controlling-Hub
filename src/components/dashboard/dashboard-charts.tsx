"use client";

import { useEffect, useRef, useState } from "react";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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
      <CardContent className="min-w-0 pl-2">
        <div
          ref={chartContainerRef}
          className="mt-4 h-[350px] min-h-[350px] w-full min-w-0"
        >
          {chartSize.width > 0 && chartSize.height > 0 ? (
            <LineChart
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
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                className="text-xs"
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis
                className="text-xs"
                stroke="hsl(var(--muted-foreground))"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
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
          ) : (
            <div className="h-full w-full rounded-lg bg-muted/30" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
