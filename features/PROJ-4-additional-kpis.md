# PROJ-4 — Zusätzliche KPIs

**Status:** In Progress  
**Created:** 2026-04-22

## Ziel

4 neue KPIs ins Controlling-Dashboard integrieren, die entweder aus dem bestehenden Hero-Datenmodell extrahierbar sind oder neue Datenquellen benötigen.

## KPIs

| KPI | Datenquelle | Status |
|-----|------------|--------|
| Bewertungspool-Zähler | Hero `step_name` (schon vorhanden) | ✅ Implementiert |
| Performance je Monteur | Hero `responsible_user` / `field_service_jobs` (nach Introspection) | Planned |
| Anlagenleistung (kWp) | Regex auf `measure_name` + optional Hero custom field | Planned |
| Deckungsbeitrag | Manuelle Eingabe-Tabelle `material_cost_entries` | Planned |

## Phase 0 — Bewertungspool (erledigt)

- `hero-aggregator.ts`: Pattern `bewertungspool` + KPI-Key `bewertungspoolCount`
- `dashboard-cards.tsx`: `KPIData.bewertungspoolCount`, Card-Definition mit Star-Icon
- `dashboard-data.ts`: `EMPTY_KPIS` + leere Gruppen erweitert
- `dashboard-queries.ts`: `getLatestKPIs` gibt `bewertungspoolCount: 0` zurück (kpi_snapshots hat noch keine Spalte)
- Test-Fixture aktualisiert

## Phase 1 — GraphQL-Introspection (offen)

`introspectHeroTypes(["ProjectMatch", "FieldServiceJob"])` aufrufen über `/api/hero/introspect`.  
Entscheidet: Branch A (responsible_user auf ProjectMatch) vs. Branch B (FieldServiceJob).

## Phase 2 — Monteur-Performance (offen, nach Phase 1)

- Migration + Sync-Entity-Update + materialized view update
- Neue Seite `src/app/monteure/page.tsx`

## Phase 3 — kWp (offen, parallel zu Phase 2)

- Regex in materialized view: `kwp_from_measure_name NUMERIC`
- kWp-Karte in Insights-Seite

## Phase 4 — Deckungsbeitrag (offen, unabhängig)

- Migration `material_cost_entries`
- Neue Seite `src/app/deckungsbeitrag/page.tsx`
- Eingabe-Formular → PROJ-5
