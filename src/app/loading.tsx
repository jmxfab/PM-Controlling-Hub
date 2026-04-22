import { Loader2 } from "lucide-react";

/**
 * Full-screen loading overlay shown while the dashboard page streams in.
 * Next.js picks this file up automatically via its `loading.tsx` convention.
 */
export default function DashboardLoading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background/95 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-base font-medium">Dashboard wird geladen…</p>
        <p className="text-sm text-muted-foreground">
          Projekte, KPIs und Pipeline aus Supabase holen
        </p>
      </div>

      <div className="relative h-2 w-[min(420px,80vw)] overflow-hidden rounded-full bg-muted">
        <div className="absolute inset-y-0 w-1/3 animate-indeterminate rounded-full bg-primary" />
      </div>
    </div>
  );
}
