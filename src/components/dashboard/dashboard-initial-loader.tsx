/**
 * Same visual identity as the route-level loading.tsx overlay, but scoped
 * to a Suspense fallback inside the dashboard so it also shows on the
 * first paint while the tab's server component is still streaming.
 */
export function DashboardInitialLoader() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <span className="text-xl font-bold">J</span>
        </div>
      </div>
      <div className="text-center space-y-1">
        <p className="text-lg font-semibold tracking-tight">
          Daten werden geladen
        </p>
        <p className="text-sm text-muted-foreground">
          Projekte, KPIs und Pipeline aus Supabase holen
        </p>
      </div>
      <div className="relative h-1 w-[min(320px,70vw)] overflow-hidden rounded-full bg-muted">
        <div className="absolute inset-y-0 w-1/2 animate-indeterminate rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />
      </div>
    </div>
  );
}
