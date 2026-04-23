// Re-export der echten InsightsView. ssr:false hat BAILOUT im
// umgebenden Suspense getriggert und den Loader hängen lassen.
export { InsightsView } from "./insights-view";
