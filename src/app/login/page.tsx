import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Login · JMX Controlling Hub",
  description: "Passwort-geschütztes Controlling-Dashboard.",
};

export const dynamic = "force-dynamic";

interface LoginPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolved = (await searchParams) ?? {};
  const nextRaw = resolved["next"];
  const nextParam = Array.isArray(nextRaw) ? nextRaw[0] : nextRaw;
  const next =
    typeof nextParam === "string" && nextParam.startsWith("/")
      ? nextParam
      : "/";

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      {/* Background gradient decoration */}
      <div
        className="absolute inset-0 -z-10 bg-background"
        aria-hidden
      />
      <div
        className="absolute -top-1/3 -left-1/4 w-[700px] h-[700px] rounded-full blur-3xl opacity-30 bg-gradient-to-br from-blue-400 to-violet-500 dark:from-blue-600 dark:to-violet-700 -z-10"
        aria-hidden
      />
      <div
        className="absolute -bottom-1/3 -right-1/4 w-[600px] h-[600px] rounded-full blur-3xl opacity-25 bg-gradient-to-tl from-amber-400 to-rose-500 dark:from-amber-600 dark:to-rose-700 -z-10"
        aria-hidden
      />

      <div className="w-full max-w-md space-y-8 relative">
        {/* Logo + Heading */}
        <div className="text-center space-y-4">
          <div className="relative mx-auto w-16 h-16">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-foreground to-foreground/60 blur-md opacity-40" />
            <div className="relative flex h-full w-full items-center justify-center rounded-2xl bg-gradient-to-br from-foreground to-foreground/80 text-background shadow-lg">
              <span className="text-3xl font-bold">J</span>
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">
              JMX Controlling Hub
            </h1>
            <p className="text-sm text-muted-foreground">
              Passwort eingeben um auf das Dashboard zuzugreifen
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border bg-card/80 backdrop-blur-sm shadow-xl p-6">
          <LoginForm next={next} />
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-muted-foreground/60">
          Jumax Elektrotechnik GmbH · Internes Tool
        </p>
      </div>
    </div>
  );
}
