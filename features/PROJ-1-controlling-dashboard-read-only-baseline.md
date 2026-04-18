# PROJ-1: Read-only Controlling Dashboard Baseline

## Status: In Progress
**Created:** 2026-04-17
**Last Updated:** 2026-04-17

## Dependencies
- None

## User Stories
- As a controlling stakeholder, I want the dashboard to open as the app start page so that I immediately see the current project situation.
- As a department lead, I want to switch between Gesamt, PV, WP, and Haustechnik so that I can review the business area relevant to me.
- As an operations user, I want KPI cards, trend/history views, and a project list to react to the same timeframe selection so that I can interpret one consistent slice of data.
- As an operator, I want the dashboard to read Hero data in a safe read-only mode and fall back gracefully when live access is unavailable so that the product remains usable without risking source-system changes.
- As the business owner, I want sync and write paths to stay disabled in this baseline so that future integrations require explicit approval and separate implementation.

## Acceptance Criteria
- [ ] The application start page renders the controlling dashboard instead of a placeholder landing page.
- [ ] The dashboard offers four department views: Gesamt, PV, WP, and Haustechnik.
- [ ] Missing or invalid department query parameters fall back to `GESAMT`.
- [ ] The dashboard provides timeframe controls for `Aktueller Stand`, `14 Tage`, `30 Tage`, and `Frei`.
- [ ] KPI cards, the trend/history area, and the project list are filtered together according to the selected department and timeframe.
- [ ] The current baseline loads dashboard data server-side from intentional Hero sample data until a verified REST/OpenAPI integration exists.
- [ ] When live Hero access is unavailable or fails, the dashboard shows a clear fallback/sample-data state instead of crashing.
- [ ] When the selected department/timeframe yields no matching projects, the dashboard shows an explicit empty state.
- [ ] Project records include enough context for controlling use, including project identity/status plus available customer and document information.
- [ ] Department assignment follows the current business rule: `PV...` maps to PV, `WÄP...` / `WAP...` maps to WP, and all other project numbers map to Haustechnik.
- [ ] Hero project deep links remain optional and must not break the dashboard when no `HERO_PROJECT_URL_TEMPLATE` is configured.
- [ ] Manual and scheduled sync/write behavior are out of scope for this feature baseline and must remain disabled with a clear read-only response.

## Edge Cases
- The baseline must remain fully usable without any Hero credential.
- Future live Hero failures should degrade gracefully to fallback/sample behavior once a new live integration exists.
- A timeframe with no matching live or sample projects should show an empty state instead of stale data.
- Reversed or invalid custom date ranges should normalize or fall back to a valid default range.
- Missing Hero project-link configuration should leave deep links unavailable without affecting the rest of the UI.

## Technical Requirements (optional)
- Live Hero access must stay server-side; API credentials must never be exposed in the client.
- The read path is allowed; write-back to Hero and persistence/sync flows are not.
- The sync endpoint must continue returning an explicit read-only response while this feature remains the active baseline.
- The dashboard must continue to function when historical persistence is absent and history views have limited or empty data.

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
### Solution Overview
PROJ-1 formalizes the existing dashboard baseline as a read-only operational workspace. The feature keeps the current app homepage as the entrypoint and currently serves intentional Hero sample data until a verified REST/OpenAPI live integration exists.

This design intentionally avoids any write-back, persistence, or operator sync workflow. Those capabilities remain separate future features so the current baseline can stay safe, understandable, and reviewable.

### Component Architecture
Controlling Dashboard Page
├── Header with product title and context text
├── Dashboard Shell
│   ├── Department tabs
│   │   ├── Gesamt
│   │   ├── PV
│   │   ├── WP
│   │   └── Haustechnik
│   └── Timeframe controls
│       ├── Aktueller Stand
│       ├── 14 Tage
│       ├── 30 Tage
│       └── Frei (custom from/to range)
└── Department Tab Content
    ├── Status notice area
    ├── KPI cards
    ├── Trend / history section
    └── Project list
        └── Expandable project details with customer + document context

### Data Flow
- The page resolves the selected department and timeframe from the URL so the dashboard state is shareable and consistent.
- For each department tab, the server loads one normalized dashboard dataset containing KPIs, historical points, project rows, and status notices.
- In the current baseline, the dashboard serves intentional sample data from the server-side data service.
- A future live Hero integration must degrade to sample data or explicit empty states instead of failing.
- Optional Hero project links are generated only when a project-link template is configured; otherwise the UI stays fully usable without them.

### Data Model (plain language)
The dashboard baseline needs the following information for each department view:
- Selected department
- Selected timeframe and optional custom date range
- KPI totals for the current view
- Historical/trend data points when available
- Project records with project identity, status, department mapping, timestamps, and customer context
- Related customer documents when Hero exposes them
- Source state (`hero`, `sample`, or `empty`) so the UI can explain what the user is seeing

### Technical Decisions
- **Next.js server rendering for data loading:** keeps Hero credentials on the server and makes the first dashboard view available without exposing integration secrets to the browser.
- **URL-driven department and timeframe state:** gives users stable, shareable dashboard links and keeps filtering behavior consistent across the page.
- **Intentional sample-data baseline:** allows the product to deliver operational value now without pretending the old Hero GraphQL path is a validated production integration.
- **Fallback and empty states as first-class behavior:** ensures the dashboard remains usable even when external live data is unavailable or the selected range has no matches.
- **Single page with reusable department tabs:** keeps the user experience simple while still separating Gesamt, PV, WP, and Haustechnik views.

### Backend / Integration Scope
PROJ-1 does not require new persistence or a new business backend. It uses the current server-side sample-data path plus the already-disabled sync endpoint.

For this feature, the integration boundary is:
- allowed: read-only Hero data retrieval and transformation for dashboard presentation
- not allowed: write-back to Hero, scheduled sync, manual sync, or persistence workflows

### Dependencies
- **Next.js App Router** for the dashboard page and server-side rendering model
- **Tailwind CSS + shadcn/ui** for layout, tabs, inputs, select controls, and cards
- **Hero sample dataset** as the current safe baseline for dashboard rendering
- **Existing dashboard test coverage** for timeframe behavior, project-list behavior, sync disablement, and smoke-level UI validation

### Delivery Notes
- Frontend can build and refine the dashboard against this design without waiting for backend schema work.
- Backend work is not required for PROJ-1 unless and until a new Hero REST/OpenAPI integration is approved.
- QA should validate the feature against acceptance criteria using the shipped sample-data baseline.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
