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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <span className="text-2xl font-bold">J</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            JMX Controlling Hub
          </h1>
          <p className="text-sm text-muted-foreground">
            Bitte gib das Passwort ein, um Zugriff auf das Dashboard zu
            erhalten.
          </p>
        </div>
        <LoginForm next={next} />
      </div>
    </div>
  );
}
