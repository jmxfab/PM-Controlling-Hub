/**
 * Full-screen loading overlay — deckt den gesamten Viewport ab solange
 * die Tab-Daten streamen. Gleiche visuelle Identität wie das Route-Level
 * loading.tsx-Overlay, damit Routen-Wechsel und Suspense-Fallbacks
 * nahtlos ineinander übergehen.
 */
export function DashboardInitialLoader() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-background/95 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
          <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <span className="text-xl font-bold">J</span>
          </div>
        </div>

        <div className="text-center space-y-1">
          <p className="text-lg font-semibold tracking-tight">
            JMX Controlling Hub
          </p>
          <p className="text-sm text-muted-foreground">
            Daten werden geladen…
          </p>
        </div>
      </div>

      <div className="relative h-1 w-[min(320px,70vw)] overflow-hidden rounded-full bg-muted">
        <div className="absolute inset-y-0 w-1/2 animate-indeterminate rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />
      </div>
    </div>
  );
}
