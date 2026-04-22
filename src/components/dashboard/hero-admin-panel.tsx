"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface HeroApiKeyStatusDto {
  configured: boolean;
  maskedKey: string | null;
  source: "db" | "env" | "none";
  updatedAt: string | null;
  supabaseConfigured: boolean;
}

interface HeroAdminPanelProps {
  heroReadOnlyConfigured: boolean;
  heroProjectLinkTemplateConfigured: boolean;
  initialStatus: HeroApiKeyStatusDto;
}

type FeedbackState =
  | { kind: "idle" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function HeroAdminPanel({
  heroReadOnlyConfigured,
  heroProjectLinkTemplateConfigured,
  initialStatus,
}: HeroAdminPanelProps) {
  const router = useRouter();
  const [status, setStatus] = useState<HeroApiKeyStatusDto>(initialStatus);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState>({ kind: "idle" });
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const refreshDashboard = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = apiKeyInput.trim();
    if (trimmed.length < 10) {
      setFeedback({
        kind: "error",
        message:
          "Der API Key sieht zu kurz aus. Bitte prüfe den Wert (mindestens 10 Zeichen).",
      });
      return;
    }

    setIsSaving(true);
    setFeedback({ kind: "idle" });

    try {
      const response = await fetch("/api/settings/hero", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: trimmed }),
      });

      const payload = await response.json();

      if (!response.ok) {
        const message =
          typeof payload?.error === "string"
            ? payload.error
            : "Speichern fehlgeschlagen.";
        setFeedback({ kind: "error", message });
        return;
      }

      setStatus(payload as HeroApiKeyStatusDto);
      setApiKeyInput("");
      setFeedback({
        kind: "success",
        message: "Hero API Key wurde gespeichert. Dashboard wird aktualisiert…",
      });
      refreshDashboard();
    } catch (error) {
      setFeedback({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unbekannter Fehler beim Speichern.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    const confirmed = window.confirm(
      "Hero API Key wirklich entfernen? Das Dashboard fällt dann auf die Umgebungsvariable bzw. Beispieldaten zurück."
    );
    if (!confirmed) return;

    setIsClearing(true);
    setFeedback({ kind: "idle" });

    try {
      const response = await fetch("/api/settings/hero", {
        method: "DELETE",
      });
      const payload = await response.json();

      if (!response.ok) {
        const message =
          typeof payload?.error === "string"
            ? payload.error
            : "Entfernen fehlgeschlagen.";
        setFeedback({ kind: "error", message });
        return;
      }

      setStatus(payload as HeroApiKeyStatusDto);
      setFeedback({
        kind: "success",
        message: "Hero API Key wurde entfernt.",
      });
      refreshDashboard();
    } catch (error) {
      setFeedback({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unbekannter Fehler beim Entfernen.",
      });
    } finally {
      setIsClearing(false);
    }
  };

  const sourceLabel =
    status.source === "db"
      ? "Über UI gespeichert"
      : status.source === "env"
      ? "Aus Umgebungsvariable"
      : "Nicht gesetzt";

  const updatedAtLabel = status.updatedAt
    ? new Date(status.updatedAt).toLocaleString("de-DE")
    : null;

  const busy = isSaving || isClearing || isPending;

  return (
    <Card>
      <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between lg:space-y-0">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-xl">Hero Read-only Status</CardTitle>
            <Badge variant={heroReadOnlyConfigured ? "secondary" : "outline"}>
              {heroReadOnlyConfigured ? "Hero GraphQL aktiv" : "Hero GraphQL fehlt"}
            </Badge>
            <Badge variant={heroProjectLinkTemplateConfigured ? "secondary" : "outline"}>
              {heroProjectLinkTemplateConfigured
                ? "Link-Template aktiv"
                : "Kein Link-Template"}
            </Badge>
          </div>
          <CardDescription>
            Dieses Dashboard läuft bewusst read-only. Es liest Hero-Daten direkt,
            schreibt aber nichts nach Supabase oder zurück zu Hero.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Sicherheits-Hinweis</AlertTitle>
          <AlertDescription>
            Schreib- und Sync-Funktionen sind deaktiviert. Falls später doch ein
            Schreibpfad nötig würde, muss er ausdrücklich neu bestätigt und
            separat implementiert werden.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="h-4 w-4" />
              Aktiver Betriebsmodus
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {heroReadOnlyConfigured
                ? "Hero GraphQL wird serverseitig read-only abgefragt. Historische Zeiträume bleiben ohne persistierte Historie bewusst eingeschränkt."
                : "Solange kein Hero API Key hinterlegt ist, nutzt das Dashboard ausschließlich Hero-Beispieldaten als read-only Fallback."}
            </p>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium">Projektlinks</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {heroProjectLinkTemplateConfigured
                ? "Projektlinks werden über ein serverseitig gesetztes Hero-Link-Template aufgebaut."
                : "Ohne serverseitiges HERO_PROJECT_URL_TEMPLATE bleiben Hero-Links absichtlich deaktiviert."}
            </p>
          </div>
        </div>

        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex items-start gap-2">
            <KeyRound className="h-4 w-4 mt-1 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Hero API Key</p>
              <p className="text-sm text-muted-foreground">
                Trage den Hero API Key direkt hier ein. Er wird serverseitig in
                der Supabase-Tabelle <code className="font-mono">app_settings</code> gespeichert und
                nie an den Browser zurückgegeben.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant={status.configured ? "secondary" : "outline"}>
              {status.configured ? "Key hinterlegt" : "Kein Key"}
            </Badge>
            <span className="text-muted-foreground">{sourceLabel}</span>
            {status.maskedKey ? (
              <span className="font-mono text-muted-foreground">
                {status.maskedKey}
              </span>
            ) : null}
            {updatedAtLabel ? (
              <span className="text-muted-foreground">
                (zuletzt aktualisiert: {updatedAtLabel})
              </span>
            ) : null}
          </div>

          {!status.supabaseConfigured ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Supabase nicht konfiguriert</AlertTitle>
              <AlertDescription>
                Die Umgebungsvariablen <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> und/oder{" "}
                <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> fehlen auf dem Server.
                Solange diese nicht gesetzt sind, kann das Dashboard den Hero API Key nicht in der DB speichern.
                Setze sie in den Vercel Project Settings und triggere einen Redeploy.
              </AlertDescription>
            </Alert>
          ) : null}

          <form className="space-y-3" onSubmit={handleSave}>
            <div className="space-y-2">
              <Label htmlFor="hero-api-key">Neuer Hero API Key</Label>
              <Input
                id="hero-api-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="ac_..."
                value={apiKeyInput}
                onChange={(event) => setApiKeyInput(event.target.value)}
                disabled={busy}
              />
              <p className="text-xs text-muted-foreground">
                Wird über HTTPS an <code className="font-mono">/api/settings/hero</code> gesendet.
                Der Wert ist nie wieder lesbar, nur eine maskierte Vorschau.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={busy || apiKeyInput.trim().length === 0}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Speichere…
                  </>
                ) : (
                  "Speichern"
                )}
              </Button>
              {status.configured && status.source === "db" ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClear}
                  disabled={busy}
                >
                  {isClearing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Entferne…
                    </>
                  ) : (
                    "Key entfernen"
                  )}
                </Button>
              ) : null}
            </div>
          </form>

          {feedback.kind === "success" ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>{feedback.message}</AlertDescription>
            </Alert>
          ) : null}
          {feedback.kind === "error" ? (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{feedback.message}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
