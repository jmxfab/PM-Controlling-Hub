/**
 * Full-screen loading overlay — deckt den gesamten Viewport ab solange
 * die Tab-Daten streamen. Gleiche visuelle Identität wie das Route-Level
 * loading.tsx-Overlay, damit Routen-Wechsel und Suspense-Fallbacks
 * nahtlos ineinander übergehen.
 */
export function DashboardInitialLoader() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-background/90 backdrop-blur-md">
      {/* Subtile Gradient-Bubbles im Hintergrund — wie auf Login */}
      <div
        className="absolute -top-1/3 -left-1/4 w-[500px] h-[500px] rounded-full blur-3xl opacity-20 bg-gradient-to-br from-blue-400 to-violet-500 dark:from-blue-600 dark:to-violet-700 -z-10 pointer-events-none"
        aria-hidden
      />
      <div
        className="absolute -bottom-1/3 -right-1/4 w-[400px] h-[400px] rounded-full blur-3xl opacity-15 bg-gradient-to-tl from-amber-400 to-rose-500 dark:from-amber-600 dark:to-rose-700 -z-10 pointer-events-none"
        aria-hidden
      />

      <div className="flex flex-col items-center gap-6">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-2xl bg-gradient-to-br from-blue-400 to-violet-500 opacity-30" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-foreground to-foreground/80 text-background shadow-xl">
            <span className="text-xl font-bold">PM</span>
          </div>
        </div>

        <div className="text-center space-y-1">
          <p className="text-base font-semibold tracking-tight">
            Projektmanagement Demo
          </p>
          <p className="text-xs text-muted-foreground">
            Daten werden aus Hero geladen…
          </p>
        </div>
      </div>

      <div className="relative h-1 w-[min(320px,70vw)] overflow-hidden rounded-full bg-muted/60">
        <div className="absolute inset-y-0 w-1/2 animate-indeterminate rounded-full bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
      </div>
    </div>
  );
}
