import { DashboardInitialLoader } from "@/components/dashboard/dashboard-initial-loader";

/**
 * Full-screen loading overlay für Route-Transitions. Gleicher Loader
 * wie der Suspense-Fallback der Dashboard-Tabs, damit zwischen Route-
 * Wechsel und Tab-Daten-Stream kein zweifacher Loader aufblinkt.
 */
export default function DashboardLoading() {
  return <DashboardInitialLoader />;
}
