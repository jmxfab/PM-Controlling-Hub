"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LogbuchAggregations } from "@/lib/supabase/hero-logbuch-queries";

const CHART_COLOR = "hsl(var(--primary))";
const CHART_COLOR_2 = "hsl(var(--chart-2, 210 70% 55%))";

interface LogbuchChartsProps {
  aggregations: LogbuchAggregations;
}

function shortEmail(email: string) {
  return email.split("@")[0] ?? email;
}

export function LogbuchCharts({ aggregations }: LogbuchChartsProps) {
  const hasUserData = aggregations.byUser.length > 0;
  const hasProjectData = aggregations.byProject.length > 0;

  if (!hasUserData && !hasProjectData) {
    return (
      <div className="text-sm text-muted-foreground text-center py-6">
        Noch keine Auswertungsdaten – werden nach dem nächsten Hero-Sync verfügbar.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="rounded-xl shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            Aktivitäten je Mitarbeiter
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasUserData ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={aggregations.byUser.slice(0, 10)}
                layout="vertical"
                margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
              >
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="email"
                  width={100}
                  tick={{ fontSize: 11 }}
                  tickFormatter={shortEmail}
                />
                <Tooltip
                  formatter={(v) => [v, "Ereignisse"]}
                  labelFormatter={(l) => l}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                  {aggregations.byUser.slice(0, 10).map((_, i) => (
                    <Cell key={i} fill={CHART_COLOR} opacity={1 - i * 0.04} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
              Keine Daten
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            Top-Projekte nach Aktivität
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasProjectData ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={aggregations.byProject.slice(0, 10)}
                layout="vertical"
                margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
              >
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="project_number"
                  width={80}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(v) => [v, "Ereignisse"]}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.project_name ??
                    payload?.[0]?.payload?.project_number ??
                    ""
                  }
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                  {aggregations.byProject.slice(0, 10).map((_, i) => (
                    <Cell key={i} fill={CHART_COLOR_2} opacity={1 - i * 0.04} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
              Keine Daten
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
