/**
 * Full-screen loading overlay shown while the dashboard page streams in.
 * Next.js picks this file up automatically via its `loading.tsx` convention.
 *
 * Styled after typical SSO / login interstitials — clean centered brand +
 * shimmer bar + subtle status text.
 */
export default function DashboardLoading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-background">
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
            Dashboard wird geladen…
          </p>
        </div>
      </div>

      <div className="relative h-1 w-[min(320px,70vw)] overflow-hidden rounded-full bg-muted">
        <div className="absolute inset-y-0 w-1/2 animate-indeterminate rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />
      </div>
    </div>
  );
}
