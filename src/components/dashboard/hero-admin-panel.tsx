import { AlertTriangle, ShieldCheck } from "lucide-react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface HeroAdminPanelProps {
  heroReadOnlyConfigured: boolean;
  heroProjectLinkTemplateConfigured: boolean;
}

export function HeroAdminPanel({
  heroReadOnlyConfigured,
  heroProjectLinkTemplateConfigured,
}: HeroAdminPanelProps) {
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
                : "Solange kein HERO_API_KEY gesetzt ist, nutzt das Dashboard ausschließlich Hero-Beispieldaten als read-only Fallback."}
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
      </CardContent>
    </Card>
  );
}
