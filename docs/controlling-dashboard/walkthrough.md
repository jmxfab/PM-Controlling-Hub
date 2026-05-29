# Controlling Dashboard - Aktueller Sample-Mode

Der erste lauffähige Stand des **Controlling Dashboards** ist integriert.
Aktuell läuft das Dashboard bewusst im **Hero-Beispieldatenmodus**, damit die Oberfläche stabil nutzbar bleibt, bis die offizielle Hero-REST/OpenAPI-Integration umgesetzt ist.

## Was bisher umgesetzt wurde

1. **Dashboard Startseite**: Die `page.tsx` wurde in eine moderne Dashboard-Übersicht umgewandelt.
2. **Tab-Navigation**: Wir haben nun Tabs, mit denen nahtlos zwischen der **Gesamtsicht**, **PV**, **WP** und **Haustechnik** gewechselt werden kann.
3. **KPI-Karten**: Wichtige Kennzahlen wie *Aktive Projekte, abgeschlossene Wochenprojekte, Buchhaltungsübergaben und Nacharbeiten* werden jetzt übersichtlich in shadcn-Karten (`dashboard-cards.tsx`) mit passenden Icons präsentiert.
4. **Verlaufsgraphen**: Zur Auswertung des Projektverlaufs wurde `recharts` integriert und in `dashboard-charts.tsx` abgebildet.
5. **Data Service**: Im Hintergrund (`dashboard-data.ts`) liefert eine asynchrone Service-Schicht derzeit bewusst Hero-Beispieldaten, die konsistent auf Abteilung und Zeitraum reagieren.

> [!TIP]
> Starte deinen Entwicklungsserver mit `npm run dev` in deinem Terminal, öffne `http://localhost:3010` im Browser und klicke dich durch die Tabs für die jeweiligen Abteilungen.

## Vorschau der Komponenten
Die Datenströme passen sich direkt an die Tabs an:

| Komponente | Dateipfad | Zweck |
| :--- | :--- | :--- |
| **Tab-Menü** | [page.tsx](file:///Users/fab/Documents/Code/JMX%20Controlling/Jumax-Controlling-Hub/src/app/page.tsx) | Einstiegspunkt inkl. Caching und Skeleton Loading. |
| **Daten Abfrage** | [dashboard-tab-content.tsx](file:///Users/fab/Documents/Code/JMX%20Controlling/Jumax-Controlling-Hub/src/components/dashboard/dashboard-tab-content.tsx) | Lädt asynchron die KPIs und Chart-Daten für den ausgewählten Tab. |
| **KPIs** | [dashboard-cards.tsx](file:///Users/fab/Documents/Code/JMX%20Controlling/Jumax-Controlling-Hub/src/components/dashboard/dashboard-cards.tsx) | Kleine, smarte Widgets für reaktive Datenvisualisierung. |

## Aktueller Betriebsmodus

- Die aktuelle App-Version verwendet absichtlich **keinen aktiven Hero-Live-Read-Pfad**.
- Die bisherige Hero-GraphQL-Integration bleibt als Altbestand im Repo, ist aber nicht der produktiv genutzte Dashboard-Pfad.
- Sync- und Schreibpfade bleiben weiterhin deaktiviert.

> [!IMPORTANT]
> Nächster sinnvoller Integrationsschritt ist **nicht** das Wiederaktivieren des alten GraphQL-Pfads, sondern eine saubere neue Anbindung gegen die offiziell dokumentierte **Hero REST/OpenAPI**. Bis dahin bleiben die Beispiel-Daten die gewollte sichere Baseline.
