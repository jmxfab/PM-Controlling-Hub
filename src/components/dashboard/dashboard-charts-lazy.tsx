// Re-export der echten Charts-Komponente. ssr:false hat BAILOUT im
// umgebenden Suspense getriggert und den Loader h\u00e4ngen lassen.
export { DashboardCharts } from "./dashboard-charts";
