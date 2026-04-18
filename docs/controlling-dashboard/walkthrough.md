# Controlling Dashboard - Mock Phase

Herzlichen Glückwunsch! Der erste Meilenstein des **Controlling Dashboards** wurde erfolgreich integriert. 
Da die Ausführung automatisch bestätigt wurde, habe ich direkt eine voll funktionsfähige Benutzeroberfläche (mit Mock-Daten) programmiert, damit du dir einen visuellen Eindruck verschaffen kannst.

## Was bisher umgesetzt wurde

1. **Dashboard Startseite**: Die `page.tsx` wurde in eine moderne Dashboard-Übersicht umgewandelt.
2. **Tab-Navigation**: Wir haben nun Tabs, mit denen nahtlos zwischen der **Gesamtsicht**, **PV**, **WP** und **Haustechnik** gewechselt werden kann.
3. **KPI-Karten**: Wichtige Kennzahlen wie *Aktive Projekte, abgeschlossene Wochenprojekte, Buchhaltungsübergaben und Nacharbeiten* werden jetzt übersichtlich in shadcn-Karten (`dashboard-cards.tsx`) mit passenden Icons präsentiert.
4. **Verlaufsgraphen**: Zur Auswertung des Projektverlaufs wurde `recharts` integriert und in `dashboard-charts.tsx` abgebildet.
5. **Data Service**: Im Hintergrund (`dashboard-data.ts`) liefert eine asynchrone Service-Schicht Dummy-Daten, die sich dynamisch nach an gewählte Abteilung berechnet.

> [!TIP]
> Starte deinen Entwicklungsserver mit `npm run dev` in deinem Terminal, öffne `http://localhost:3000` im Browser und klicke dich durch die Tabs für die jeweiligen Abteilungen!

## Vorschau der Komponenten
Die Datenströme passen sich direkt an die Tabs an:

| Komponente | Dateipfad | Zweck |
| :--- | :--- | :--- |
| **Tab-Menü** | [page.tsx](file:///Users/fab/Documents/Code/JMX%20Controlling/Jumax-Controlling-Hub/src/app/page.tsx) | Einstiegspunkt inkl. Caching und Skeleton Loading. |
| **Daten Abfrage** | [dashboard-tab-content.tsx](file:///Users/fab/Documents/Code/JMX%20Controlling/Jumax-Controlling-Hub/src/components/dashboard/dashboard-tab-content.tsx) | Lädt asynchron die KPIs und Chart-Daten für den ausgewählten Tab. |
| **KPIs** | [dashboard-cards.tsx](file:///Users/fab/Documents/Code/JMX%20Controlling/Jumax-Controlling-Hub/src/components/dashboard/dashboard-cards.tsx) | Kleine, smarte Widgets für reaktive Datenvisualisierung. |

## Nächste Schritte: Live Datenbank Anbindung

Da die Architektur nun sehr stabil ist, ist der nächste Schritt, die Mock-Daten durch **Echte Daten aus Supabase und der Hero GraphQL API** zu ersetzen. 

> [!IMPORTANT]
> Wir müssen hierfür noch die Fragen aus dem Implementierungsplan besprechen:
> 
> 1. Trage deine **Hero API Zugangsdaten** und **Supabase** Umgebungsvariablen in die Datei `.env.local` in deinem Workspace ein. 
> 2. Besitzen Projekte in eurer Hero Software einfach Status-Labels ("Nacharbeit") oder wie lassen sich aus den Hero-Endpoints genau die Zahlen (z.b. "Offene Kundenzusagen") ableiten?
