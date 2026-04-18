# Project Tracking Dashboard Plan

Das Ziel dieses Plans ist der Aufbau eines strukturierten Dashboards als Teil des "Controlling Hub" zur Auswertung der wesentlichen Projekt-Kennzahlen (KPIs) für die Hauptbereiche **PV**, **WP** und **Haustechnik**. 

## User Review Required

> [!WARNING]
> Dieses Projekt setzt eine intakte Schnittstelle zur **Hero API** (GraphQL) und eine eingerichtete **Supabase-Datenbank** voraus. Bitte überprüfen Sie die untenstehenden "Offenen Fragen", bevor wir mit der Ausführung starten.

## Ansatz und Architektur

Wir werden den Stack **Next.js (React), TailwindCSS, shadcn/ui** für das Frontend nutzen. Als Backend/Datenbank dient **Supabase**, und die Datenquelle ist die **Hero GraphQL API**. 

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

### 2. Datenbeschaffung (API-Route)
Wir erstellen einen Next.js API-Endpoint, der sich mit der Hero GraphQL API verbindet (z. B. `/api/cron/update-metrics`).
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
Ein GraphQL-Client für Hero, zum Abfragen von Projekten mit den entsprechenden Filtern und Abteilungen.

#### [NEW] src/app/api/cron/sync-hero/route.ts
API-Endpoint, der die regelmäßige Synchronisation anstößt und die Daten in Supabase aggregiert speichert.

#### [NEW] src/lib/supabase/dashboard-queries.ts
Hilfsfunktionen um die gespeicherten KPIs aus Supabase wiederum für das Dashboard Frontend abzurufen.

## Geklärte Fragen & Entscheidungen

> [!NOTE]
> Alle offenen Fragen wurden beantwortet. Der Plan ist bereit zur vollständigen Umsetzung.

### 1. Hero Software API
- **Endpoint:** `https://login.hero-software.de/api/external/v7/graphql`
- **Auth:** `Authorization: Bearer YOUR_API_KEY` (in `.env.local` hinterlegen)
- **Ansatz:** Wir fragen via `project_matches` alle Projekte ab und berechnen die KPI-Zähler selbst anhand des Projektstatus-Feldes (kein direkter Aggregations-Endpoint vorhanden)
- **Schema-Discovery:** Beim ersten Start läuft eine Introspection-Query, um alle verfügbaren Felder zu ermitteln

### 2. Abteilungstrennung
- **Projektnummer-Präfix** als Filter:
  - `PV...` → Photovoltaik
  - `WÄP...` → Wärmepumpen
  - Rest / ohne Präfix → Haustechnik
- Projekte liegen in separaten Ordnern in Hero (gleiche Logik)
- **Gesamtansicht** zeigt alle Abteilungen aggregiert zusammen

### 3. Supabase Anbindung
- Lokale Supabase-Instanz auf **Proxmox** (LXC)
- Benötigte Werte (bitte in `.env.local` eintragen):
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

---

## Nächste Umsetzungsschritte

1. **Hero GraphQL Client** (`src/lib/hero/hero-client.ts`) – Introspection + `project_matches` Query mit allen relevanten Feldern
2. **Sync Route** (`src/app/api/cron/sync-hero/route.ts`) – Verarbeitung der Projekte, Zählung nach Status + Präfix-Filter, Upsert in Supabase
3. **Supabase Queries** (`src/lib/supabase/dashboard-queries.ts`) – Abruf der gespeicherten KPIs für die UI
4. **Manual Sync Button** im Dashboard-Header für sofortige Updates
5. **Vercel Cron Config** (`vercel.json`) für den täglichen 6-Uhr-Job

## Verification Plan
1. **Introspection-Skript**: Einmalig alle Hero-Felder ausgeben, um das Schema zu verstehen
2. **Sync-Test**: Manuell den `/api/cron/sync-hero` Endpoint aufrufen und Supabase-Einträge prüfen
3. **Dashboard-Anzeige**: Sicherstellen, dass Live-Daten korrekt nach Abteilung aufgeteilt werden
