# Project Tracking Dashboard Plan

> [!WARNING]
> Dieses Dokument beschreibt zu großen Teilen den früher geplanten Live-Integrationspfad. Der aktuell ausgelieferte Stand des Dashboards nutzt **bewusst Hero-Beispieldaten** und **keinen aktiven Hero-Live-Read-Pfad**, bis eine neue REST/OpenAPI-Integration umgesetzt ist.

Das Ziel dieses Plans ist der Aufbau eines strukturierten Dashboards als Teil des "Controlling Hub" zur Auswertung der wesentlichen Projekt-Kennzahlen (KPIs) für die Hauptbereiche **PV**, **WP** und **Haustechnik**. 

## User Review Required

> [!WARNING]
> Dieses Projekt setzt für den hier beschriebenen zukünftigen Ausbau eine neue, verifizierte Hero-Integration und optional Supabase-Persistenz voraus. Für den aktuell produktiven Dashboard-Baseline-Stand sind diese Voraussetzungen **nicht** nötig.

## Ansatz und Architektur

Wir nutzen **Next.js (React), TailwindCSS, shadcn/ui** für das Frontend. Historisch beschreibt dieses Dokument einen Ausbau mit **Supabase** und der früher angenommenen **Hero GraphQL API**; der aktuelle Baseline-Stand verwendet jedoch bewusst Sample-Daten.

### 1. Datenmodell (Supabase)
Um eine Historie und eine klare "Wochenübersicht" zu haben, empfiehlt es sich, täglich oder wöchentlich "Snapshots" der KPIs in einer Supabase-Tabelle (z. B. `weekly_kpis`) zu speichern. 
- Tabelle `kpi_snapshots`
    - `id` (UUID)
    - `department` (Enum: PV, WP, HAUSTECHNIK)
    - `snapshot_date` (Date)
    - `active_projects` (Int)
    - `completed_projects` (Int)
    - `accounting_transferred_count` (Int)
    - `accounting_transferred_amount` (Decimal)
    - `open_reworks` (Int)
    - `scheduled_reworks` (Int)
    - `open_customer_commitments` (Int)
    - `scheduled_closings` (Int)

### 2. Datenbeschaffung (zukünftiger API-/Sync-Pfad)
Für einen späteren Ausbau kann ein Next.js API-Endpoint entstehen, der eine verifizierte Hero-REST/OpenAPI-Anbindung nutzt (z. B. `/api/cron/update-metrics`).
- Diese Route fragt die Projekt-Daten für die unterschiedlichen Abteilungen (PV/WP/Haustechnik) aus Hero ab.
- Die zurückgegebenen Projekte werden evaluiert (z.b. anhand von Projekt-Status) und aggregiert.
- Anschließend werden die zusammengefassten Kennzahlen in die Supabase `kpi_snapshots` Tabelle geschrieben.

### 3. Dashboard-Ansicht (Frontend)
Die UI wird sehr hochwertig und modern ("premium") unter Verwendung von shadcn/ui gestaltet:
- Eine Navigation für die Bereiche "Gesamt", "PV", "WP", "Haustechnik".
- **KPI-Karten** (Stat Cards) für die unterschiedlichen Kennzahlen:
  - Aktive Projekte
  - Abgeschlossene Projekte (pro Woche)
  - Kaufmännisch (An Buchhaltung übergeben + Betrag)
  - Nacharbeiten (Offen vs. Terminiert)
  - Kunden (Offene Zusagen vs. Terminiert)
- Ein interaktives **Chart** (z. B. mit `recharts`), um die Wochenübersicht im zeitlichen Verlauf zu visualisieren. 

## Proposed Changes

---

### UI Components & Layout
Wir erstellen und integrieren diverse shadcn/UI Komponenten, um das Dashboard zu bauen.

#### [NEW] src/components/dashboard/dashboard-cards.tsx
Komponente für die einzelnen Kennzahl-Karten inkl. kleinen Trend-Indikatoren (vs letzte Woche).

#### [NEW] src/components/dashboard/dashboard-charts.tsx
Ein Liniendiagramm / Balkendiagramm für die wochenbasierte Fortschrittsansicht der Projekte.

#### [MODIFY] src/app/page.tsx
Ersetzen der aktuellen Placeholder-Page mit dem Haupt-Dashboard-Layout (Tabs für PV, WP, Haustechnik).

---

### API & Daten-Service

#### [NEW] src/lib/hero/hero-client.ts
Historischer Integrationsversuch für Hero. Der aktuell aktive Dashboard-Pfad hängt **nicht** von dieser Live-Integration ab.

#### [NEW] src/app/api/cron/sync-hero/route.ts
API-Endpoint, der die regelmäßige Synchronisation anstößt und die Daten in Supabase aggregiert speichert.

#### [NEW] src/lib/supabase/dashboard-queries.ts
Hilfsfunktionen um die gespeicherten KPIs aus Supabase wiederum für das Dashboard Frontend abzurufen.

## Geklärte Fragen & Entscheidungen

> [!NOTE]
> Alle offenen Fragen wurden beantwortet. Der Plan ist bereit zur vollständigen Umsetzung.

### 1. Hero Software API
- Der hier beschriebene GraphQL-Ansatz ist **nicht** mehr der aktuell freigegebene Produktpfad.
- Für die nächste echte Live-Integration soll die offiziell dokumentierte **Hero REST/OpenAPI** neu bewertet und separat umgesetzt werden.
- Bis dahin bleibt das Dashboard absichtlich im Sample-Mode.

### 2. Abteilungstrennung
- **Projektnummer-Präfix** als Filter:
  - `PV...` → Photovoltaik
  - `WÄP...` → Wärmepumpen
  - Rest / ohne Präfix → Haustechnik
- Projekte liegen in separaten Ordnern in Hero (gleiche Logik)
- **Gesamtansicht** zeigt alle Abteilungen aggregiert zusammen

### 3. Supabase Anbindung
- Lokale Supabase-Instanz auf **Proxmox** (LXC)
- Benötigte Werte (nur für einen späteren Live-/Sync-Ausbau, nicht für die aktuelle Baseline):
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://db.fabwagen.de  (oder deine interne IP/Domain)
  NEXT_PUBLIC_SUPABASE_ANON_KEY=...               (aus Supabase Dashboard → API)
  SUPABASE_SERVICE_ROLE_KEY=...                    (für den Sync-Cron-Job)
  HERO_API_KEY=...                                 (Hero API Token)
  ```

### 4. Update-Rhythmus
- **Täglich morgens**: Automatischer Sync um 6:00 Uhr via Vercel Cron (oder Node-Cron wenn self-hosted)
- **Manuell**: "Jetzt synchronisieren"-Button im Dashboard-Header
- KPIs werden in Supabase mit Datum gespeichert → Verlaufsgraph über Wochen möglich

> [!NOTE]
> Der aktuelle ausgelieferte Stand führt diesen Sync bewusst **nicht** aktiv aus. Cron- und Schreibpfade bleiben deaktiviert bzw. read-only.

---

## Nächste Umsetzungsschritte (zukünftiger Ausbau)

1. **Hero REST/OpenAPI Client** – verifizierte neue Anbindung statt Wiederbelebung des alten GraphQL-Pfads
2. **Sync Route** (`src/app/api/cron/sync-hero/route.ts`) – erst nach expliziter Freigabe für Schreib-/Persistenzpfade
3. **Supabase Queries** (`src/lib/supabase/dashboard-queries.ts`) – Abruf der gespeicherten KPIs für die UI
4. **Manual Sync Button** im Dashboard-Header für sofortige Updates
5. **Vercel Cron Config** (`vercel.json`) für den täglichen 6-Uhr-Job

## Verification Plan
1. **Sample-Mode Smoke-Test**: Dashboard lädt mit Hinweis auf Hero-Beispieldatenmodus
2. **UI-Verifikation**: Tabs, Zeiträume und Projektliste reagieren konsistent auf die Sample-Daten
3. **Späterer Live-Test**: Erst nach neuer REST/OpenAPI-Integration und expliziter Freigabe
