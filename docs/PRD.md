# Product Requirements Document

## Vision
Jumax Controlling Hub is a read-only controlling dashboard for Jumax's operational project business across Photovoltaik, Wärmepumpen, and Haustechnik. It gives leadership and operations teams one shared view of project KPIs, status trends, and project-level context without introducing risky write-back or sync behavior before the workflow and governance are fully defined.

The current product baseline already exists in the app and is being anchored into the AI Coding Starter Kit workflow so future architecture, implementation, QA, and deployment work can build on explicit requirements instead of undocumented code.

## Target Users
- **Geschäftsführung / Controlling:** Need a fast, reliable overview of active projects, weekly completions, accounting handoffs, rework volume, and customer follow-up signals.
- **Bereichsverantwortliche für PV, WP und Haustechnik:** Need department-specific views to understand current workload, bottlenecks, and upcoming items without digging through Hero directly.
- **Operative Projektteams:** Need a read-only project list with customer, document, and status context so they can review the current situation safely.

## Core Features (Roadmap)

| Priority | Feature | Status |
|----------|---------|--------|
| P0 (MVP) | PROJ-1 Read-only controlling dashboard baseline | In Progress |
| P1 | Historical KPI persistence and richer trend history | Planned |
| P1 | Operational admin visibility for Hero connectivity and project deep links | Planned |
| P2 | Governed sync/write workflows with explicit approval and auditability | Planned |

## Success Metrics
- Stakeholders can open the dashboard as the start page and switch between Gesamt, PV, WP, and Haustechnik without errors.
- The selected timeframe consistently filters KPI cards, trend/history views, and the project list together.
- When Hero live access is unavailable, the dashboard still remains usable through safe fallback/sample states.
- No accidental write-back or background sync occurs in the current version; all write/sync paths remain explicitly disabled.

## Constraints
- The repository already contains a partially implemented dashboard baseline in `src/` that must now be reflected in requirements artifacts.
- The current shipped baseline intentionally uses Hero sample data; a future live integration must be specified separately against the officially documented Hero API.
- Department mapping depends on Hero project-number prefixes: `PV...` for Photovoltaik, `WÄP...` / `WAP...` for Wärmepumpen, everything else for Haustechnik.
- Historical persistence to Supabase is not active in the current baseline, so time-based views must gracefully handle limited or missing history.
- Sync and write functionality are intentionally disabled until they are separately specified, reviewed, and approved.

## Non-Goals
- Writing data back to Hero.
- Enabling manual or scheduled sync as part of the current baseline.
- Building a full admin/backoffice workflow in this phase.
- Expanding beyond the controlling dashboard baseline before requirements and architecture catch up to the current codebase.

---

Use `/requirements` to create detailed feature specifications for each item in the roadmap above.
