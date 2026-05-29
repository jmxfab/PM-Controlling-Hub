# Controlling Dashboard Setup

> [!NOTE]
> Der aktuell ausgelieferte Stand ist ein **read-only Dashboard mit intentionalem Hero-Beispieldatenmodus**. Die Punkte rund um Live-Hero, Supabase-Persistenz und Cron beschreiben zukünftigen Ausbau, nicht die aktuelle Baseline.

- `[x]` 1. Grund-Layout und Routing
  - `[x]` Tab-Navigation (Gesamt, PV, WP, Haustechnik) integrieren
  - `[x]` page.tsx so anpassen, dass das Dashboard als Startseite geladen wird
- `[x]` 2. Shadcn/UI Komponenten einrichten
  - `[x]` Überprüfen, ob benötigte Komponenten (Card, Tabs) via ui.shadcn.com im Projekt sind
  - `[x]` Zusätzliche shadcn Komponenten (Chart etc.) bereitstellen
- `[x]` 3. Dashboard Widgets bauen
  - `[x]` `dashboard-cards.tsx`: KPI-Kacheln (Aktive Projekte, etc.)
  - `[x]` `dashboard-charts.tsx`: Verlaufsgraph für wöchentliche Kennzahlen
- `[x]` 4. Sample-Data & Hero-Abstraktion
  - `[x]` Einen Daten-Service erstellen, der aktuell bewusst Hero-Beispieldaten liefert
  - `[x]` Historische Hero-Integrationsversuche im Repo isoliert halten, ohne sie als aktiven Produktpfad zu verwenden
- `[ ]` 5. Zukünftiger Live-Ausbau
  - `[ ]` Neue Hero REST/OpenAPI-Integration entwerfen und verifizieren
  - `[ ]` `sync-hero/route.ts` erst nach expliziter Freigabe als echten Persistenzpfad aktivieren
  - `[ ]` Supabase-gestützte KPI-Persistenz produktiv anschließen
  - `[ ]` Manual Sync Button erst für reale Operator-Flows freigeben
  - `[ ]` Vercel Cron erst nach Live-Freigabe produktiv nutzen
  - `[ ]` Produktions-Env-Werte für den späteren Live-Betrieb dokumentieren
