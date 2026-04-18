import React from "react";
import { DashboardCards } from "./dashboard-cards";
import { DashboardCharts } from "./dashboard-charts";
import { Department, getKPIData, getHistoricData } from "@/lib/services/dashboard-data";

export async function DashboardTabContent({ department }: { department: Department }) {
  const kpiData = await getKPIData(department);
  const historicData = await getHistoricData(department);

  const displayNames = {
    "GESAMT": "Gesamtunternehmen",
    "PV": "Photovoltaik (PV)",
    "WP": "Wärmepumpen (WP)",
    "HAUSTECHNIK": "Haustechnik"
  };

  return (
    <div className="space-y-4">
      <DashboardCards data={kpiData} departmentName={displayNames[department]} />
      <DashboardCharts historicData={historicData} departmentName={displayNames[department]} />
    </div>
  );
}
