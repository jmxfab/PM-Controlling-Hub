# Jumax Controlling Hub — Implementation Plan

> Gesamt-Implementierungsplan für das Controlling-Dashboard.
> Stand: 2026-04-22
> Autor: generiert über Claude Code
> Scope: alles, was jetzt, demnächst und mittelfristig gebaut werden muss, inkl. offener Entscheidungen.

---

## 0. TL;DR

Das **Jumax Controlling Hub** ist ein read-only Controlling-Dashboard für die drei Bereiche **PV, WP, Haustechnik**. Es liest Projektdaten aus Hero Software und zeigt sie aggregiert als KPIs, Zeitverläufe und Projektlisten.

Aktueller Zustand:
- **Production** (`main`) läuft, aber nur mit Sample-Daten und ohne Admin-Features.
- **Feature-Branch `feat/proj-2-hero-api-key-ui`** bringt den UI-basierten Hero-API-Key (committet, Preview deployed).
- **Parallel-Branch `claude/create-project-dashboard-H6OQY`** enthält unabhängig davon Hero→Supabase-Sync, neue KPIs, Projektampel und Timeframe-Presets — diese Commits sind noch **nicht in `main` gemergt**.
- **Lokal uncommittet** liegen zusätzlich Teile einer E-Mail-Pipeline (MS Graph + Anthropic + Notion).

Kritische Entscheidungen stehen an bei: (a) Auflösung des PROJ-2-/PROJ-3-ID-Konflikts zwischen den beiden Branches, (b) Auth-Strategie, (c) ob die E-Mail-Pipeline Teil dieses Produkts bleibt oder ausgegliedert wird.

---

## 1. Produktvision

**Wer:** Geschäftsführung, Bereichsverantwortliche PV/WP/Haustechnik, operative Projektteams.
**Was:** Eine einheitliche Sicht auf alle laufenden Projekte aus Hero Software — read-only, ohne Rückschreibrisiko.
**Wozu:** Status-Transparenz, Wochen-Controlling, schnelle Erkennung von liegengebliebenen Projekten.

**Explizit nicht in Scope (Stand PRD):**
- Rückschreiben nach Hero
- Manueller oder automatischer Sync in beliebige Zielsysteme **ohne** explizite Governance-Freigabe
- Vollständiges Admin-Backoffice
- CRM-Funktionalität

---

## 2. Aktueller Stand (Inventar)

### 2.1 `main` (Production)
Letzter Commit: `945d9d6` (VS-Code-Workspace-Setting).
Live auf Vercel (`jumax-controlling-hub.vercel.app`). Enthält:

- **Dashboard-UI:** 4 Tabs (Gesamt/PV/WP/Haustechnik), Timeframe-Selector (Aktueller Stand / 14 Tage / 30 Tage / Frei), KPI-Cards, Trend-Charts, Projektliste mit Drill-Down.
- **Hero GraphQL Client:** Read-only, aber ohne UI-Keymanagement — Key nur als `HERO_API_KEY` env.
- **Sample-Fallback:** Wenn kein Hero-Key gesetzt oder Live-Read fehlschlägt, kommen vorgenerierte Beispieldaten.
- **Sync-Endpoint:** `/api/cron/sync-hero` existiert, antwortet aber **bewusst mit 410 Gone** („read-only").
- **Supabase:** Anbindung vorbereitet, in der laufenden Code-Pfad aber nicht zwingend.
- **Tests:** Vitest + Playwright-Skelett, 32 Unit-Tests grün auf `main`.

### 2.2 Feature-Branch `feat/proj-2-hero-api-key-ui`
**Status:** auf GitHub gepusht, Preview live.
**Bringt:**

- Neue Supabase-Tabelle `app_settings` (Key-Value, RLS deny-all außer `service_role`).
- Server-Helper `src/lib/settings/hero-settings.ts` (DB-first, Env-Fallback, per-Request via `React.cache`).
- API-Route `GET/POST/DELETE /api/settings/hero` (Zod-Validierung, nie den Rohkey im Response).
- Erweiterter `HeroAdminPanel` mit Passwort-Input, Save/Clear, maskierter Vorschau, Fehler-Banner.
- Diagnose-Flag `supabaseConfigured` im Status-Endpoint, damit die UI bei fehlenden Env-Vars eine konkrete Anleitung zeigt.
- Anpassung `hero-client.ts` und `dashboard-data.ts`: beide lesen jetzt über `getActiveHeroApiKey()` statt `process.env`.

**Blockiert aktuell auf:** Vercel-Env-Vars für die Preview-Umgebung (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) fehlen noch im „Preview"-Scope. Siehe §14.

### 2.3 Parallel-Branch `claude/create-project-dashboard-H6OQY`
Aus einer früheren Claude-Session entstanden. **Nicht in `main` gemergt.** Bringt u. a.:

- `feat(PROJ-2)`: Hero→Supabase-Sync via Cron + Manual-Trigger (d. h. **ein anderer PROJ-2** als mein aktueller).
- `feat(PROJ-2)`: Admin-Panel, das nur Status anzeigt (kein Key-Input — Keys bleiben in Vercel-Env).
- `feat(PROJ-3)`: KPI-Foundation mit Mo–Mo-Woche und Stichtag-Logik, später korrigiert auf **Fr–Do (Stichtag Donnerstag 23:59)**.
- `feat(PROJ-3)`: Projektampel (rote Hervorhebung für Projekte ≥ 5 Tage ohne Bearbeitung).
- `feat(PROJ-3)`: Erweiterte Timeframe-Presets (3T / 5T / 7T / letzte Woche / nächste Woche).
- `feat(PROJ-3)`: Bereichs-spezifisches Status-Mapping basierend auf echten Hero-Status-Labels.

**Kollision mit Feature-Branch:** IDs PROJ-2 und PROJ-3 sind in den beiden Branches mit unterschiedlicher Bedeutung belegt. Siehe §14.

### 2.4 Lokal uncommittet auf `main`
- E-Mail-Pipeline: `src/app/api/cron/process-emails`, `src/app/api/emails`, `src/app/emails/page.tsx`, `src/components/emails/*`, `src/lib/anthropic/email-classifier.ts`, `src/lib/ms-graph/ms-graph-client.ts`, `src/lib/notion/notion-client.ts`, `src/lib/emails/email-types.ts`.
- Navigation: `src/components/nav/main-nav.tsx`.
- Verschiedene Modifikationen an `package.json`, `vercel.json`, `next.config.ts`, `src/components/dashboard/dashboard-shell.tsx`.
- Zusätzliche `.env.*.example`-Templates und `.gitlab-ci*.yml`.

Ist-Zustand: **nicht comittet, nicht gepusht, nicht deployed**. Muss separat entschieden werden (siehe §14).

---

## 3. Branch-Landschaft und ID-Konflikt

```
main ─── 945d9d6 ────────────────────────────── (Production)
 │
 ├─► feat/proj-2-hero-api-key-ui  (UI-Key PROJ-2) ────── meine Arbeit
 │     └─ gemeinsame Basis + hero-settings, app_settings, admin-panel
 │
 └─► claude/create-project-dashboard-H6OQY (andere Session)
       ├─ docs(PROJ-2, PROJ-3): Specs
       ├─ feat(PROJ-2): Hero→Supabase sync + cron
       ├─ feat(PROJ-2): admin config panel (status-only, kein Input)
       ├─ feat(PROJ-3): Mo–Mo week-window + KPI mapping
       ├─ fix(PROJ-3): Fr–Do correction
       ├─ feat(PROJ-3): timeframe presets 3/5/7/LW
       ├─ feat(PROJ-3): next-week timeframe
       └─ feat(PROJ-3): Projektampel (5-Tage-Stale-Highlight)
```

**Fakt:** PROJ-2 bezeichnet je nach Branch zwei grundverschiedene Features. Das muss aufgelöst werden, bevor auf `main` gemergt wird.

---

## 4. Feature-Roadmap (Soll)

Geordnet nach Priorität und Abhängigkeit. IDs werden final vergeben, sobald die Branch-Auflösung geklärt ist.

### Phase 1 — Baseline + Key-Management (jetzt)
| ID | Feature | Quelle | Abhängigkeit |
|----|---------|--------|--------------|
| PROJ-1 | Read-only Dashboard Baseline | `main` | — |
| PROJ-2 | Hero API Key via UI | `feat/proj-2-hero-api-key-ui` | PROJ-1 |

### Phase 2 — Controlling-KPI-Kern (aus `H6OQY`)
| ID | Feature | Quelle | Abhängigkeit |
|----|---------|--------|--------------|
| PROJ-3 | Fr–Do Week-Window + Stichtag-Logik | `H6OQY` | PROJ-1 |
| PROJ-4 | Neue wöchentliche KPIs (abgeschlossene/offene/Reworks/Umsatz letzte Woche) | `H6OQY` | PROJ-3 |
| PROJ-5 | Bereichs-spezifisches Status-Mapping (echte Hero-Labels) | `H6OQY` | PROJ-3, PROJ-2 (Live-Daten) |
| PROJ-6 | Erweiterte Timeframe-Presets (3T/5T/7T/LW/NW) | `H6OQY` | PROJ-3 |
| PROJ-7 | Projektampel (Stale-Projekte ≥ 5 Tage) | `H6OQY` | PROJ-3 |

### Phase 3 — Persistierung + Sync
| ID | Feature | Abhängigkeit |
|----|---------|--------------|
| PROJ-8 | Hero→Supabase-Sync (Tabelle `hero_projects` + Audit-Log `hero_sync_runs`) | PROJ-2 |
| PROJ-9 | Cron-Scheduling für Sync (Vercel Cron initial, später GitLab/Coolify) | PROJ-8 |
| PROJ-10 | Historische KPI-Persistenz (Erweiterung von `kpi_snapshots`) | PROJ-8, PROJ-3 |

### Phase 4 — Produktionsreife
| ID | Feature | Abhängigkeit |
|----|---------|--------------|
| PROJ-11 | Auth (Supabase Auth + RLS erweitert) | — |
| PROJ-12 | Error-Tracking (Sentry) | — |
| PROJ-13 | Rate-Limiting für Hero-Calls | PROJ-2 |
| PROJ-14 | Security-Headers + CSP | — |
| PROJ-15 | Backup-Strategie + Restore-Drill | Supabase-Produktivdaten |

### Phase 5 — Optional / Separate Produkte
| ID | Feature | Abhängigkeit |
|----|---------|--------------|
| PROJ-16 | E-Mail-Pipeline (MS Graph → Anthropic-Klassifikation → Notion) | Entscheidung „gehört das hier rein?" |
| PROJ-17 | Lovable-AI-Sync (optional, dokumentiert) | Eigenes Workflow-Dokument existiert |
| PROJ-18 | Hetzner/Coolify-Deployment-Alternative zu Vercel | Ist-Vercel-Deploy stabil |

---

## 5. Architektur

### 5.1 Systemkontext

```
            ┌──────────────────────┐
            │  Hero Software API   │
            │  (GraphQL, Bearer)   │
            └─────────▲────────────┘
                      │ read-only
                      │
┌──────────────────┐  │  ┌──────────────────────────┐
│   Browser (User) │◄─┼─►│ Next.js App (Vercel)     │
│   Read-only UI   │  │  │ - Server Components      │
└──────────────────┘  │  │ - API Routes             │
                      │  │ - Hero-Client (server)   │
                      │  └─────────┬────────────────┘
                      │            │
                      │            ▼
                      │  ┌──────────────────────────┐
                      │  │ Supabase (Postgres + RLS)│
                      │  │ - app_settings           │
                      │  │ - kpi_snapshots          │
                      │  │ - hero_projects (Phase 3)│
                      │  │ - hero_sync_runs (Ph. 3) │
                      │  └──────────────────────────┘
                      │
              (optional, Phase 5)
                      │
    ┌─────────────────┼─────────────────┐
    ▼                 ▼                 ▼
 MS Graph         Anthropic          Notion
 (Mailbox-Read)   (Klassifikation)   (Ablage)
```

### 5.2 Tech-Stack
- **Frontend:** Next.js 16 App Router, React 19, TypeScript 5
- **Styling:** Tailwind CSS 3, shadcn/ui (Radix Primitives)
- **Forms:** react-hook-form + Zod
- **Charts:** Recharts
- **DB:** Supabase (PostgreSQL 17 + RLS)
- **Auth (Phase 4):** Supabase Auth
- **Testing:** Vitest + Testing-Library + Playwright
- **Deploy:** Vercel (aktuell); Coolify/Hetzner optional

### 5.3 Wichtige Architektur-Entscheidungen
- **Read-only by default:** Alle Schreibpfade sind explizit gekennzeichnet und brauchen Spec-Freigabe. Einziger aktueller Write-Path ist `app_settings` (Config, kein Business).
- **DB-first, Env-Fallback (PROJ-2):** UI-gespeicherte Werte haben Vorrang; Env bleibt Dev-Fallback.
- **Server-only Secrets:** Keine Secrets im `NEXT_PUBLIC_*`-Scope. `service_role` läuft nur in API-Routes.
- **Graceful Degradation:** Fehlt Hero-Key → Sample-Daten. Fehlt Supabase → Nur Env-Pfad für Key.
- **Per-Request Caching:** Hero-Settings werden via `React.cache` memoiziert, damit Pagination-Loops nicht N-mal die DB hitten.

---

## 6. Datenmodell

### 6.1 Bereits in Supabase
```
app_settings(
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ
)
-- RLS: nur service_role

kpi_snapshots(
  id UUID, department, snapshot_date,
  active_projects, completed_projects_week,
  accounting_transferred_count, accounting_transferred_amount,
  open_reworks, scheduled_reworks,
  open_customer_commitments, scheduled_closings,
  created_at
)
-- RLS: authenticated=SELECT, service_role=ALL
-- UNIQUE(department, snapshot_date)

emails_processed(...)
-- Teil der E-Mail-Pipeline (Phase 5)
```

### 6.2 Soll (Phase 2 + 3)
```
-- Erweiterung von kpi_snapshots um neue KPIs
ALTER TABLE kpi_snapshots ADD COLUMN
  completed_projects_last_week INT DEFAULT 0,
  open_projects_from_last_week INT DEFAULT 0,
  accounting_transferred_order_value NUMERIC DEFAULT 0,
  open_reworks_last_week INT DEFAULT 0;

-- Cache + Audit (Phase 3)
hero_projects(
  hero_id TEXT PK, project_number, name, department,
  status, status_history JSONB,
  customer JSONB, address JSONB, documents JSONB,
  created, modified, maturity_date,
  soft_deleted_at TIMESTAMPTZ
)

hero_sync_runs(
  id UUID PK, started_at, finished_at,
  status TEXT CHECK (status IN ('running','success','partial','failed')),
  projects_fetched INT, projects_upserted INT,
  projects_soft_deleted INT,
  error_message TEXT
)
```

---

## 7. Sicherheit & Secrets

### 7.1 Env-Variablen (vollständig)
| Name | Scope | Zweck | Wann nötig |
|------|-------|-------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + Server | Supabase-Endpoint | Immer |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + Server | Für evtl. RLS-Reads im Client | Immer |
| `SUPABASE_SERVICE_ROLE_KEY` | **Nur Server** | Für App-Settings, Sync | PROJ-2+ |
| `HERO_API_KEY` | Server | Fallback für Hero-Auth | Optional (UI hat Vorrang) |
| `HERO_PROJECT_URL_TEMPLATE` | Server | Optional, für Projekt-Deep-Links | Optional |
| `CRON_SECRET` | Server | Schützt Cron-Endpoints | Phase 3 |
| `ANTHROPIC_API_KEY` | Server | Email-Klassifikation | Phase 5 |
| `AZURE_TENANT_ID` / `CLIENT_ID` / `CLIENT_SECRET` | Server | MS Graph | Phase 5 |
| `AZURE_MAILBOX_EMAIL` | Server | Ziel-Mailbox | Phase 5 |
| `NOTION_API_KEY` / `NOTION_TASKS_DATABASE_ID` | Server | Notion-Integration | Phase 5 |

**Regel:** In Vercel müssen Variablen für alle relevanten Environments (**Production + Preview + Development**) angehakt werden, sonst sehen Preview-Deploys sie nicht.

### 7.2 RLS-Strategie
- Jede Tabelle hat RLS aktiviert.
- `service_role`-Policy schreibt/liest alles; Browser-Client (anon) hat ohne explizite Policy gar keinen Zugriff.
- Für `kpi_snapshots` gibt es zusätzlich eine `authenticated=SELECT`-Policy für spätere Auth-Flows.

### 7.3 Secrets-Management
- Niemals Secrets im Code committen (Gitignore deckt `.env*.local`).
- Hero API Keys, die versehentlich in `.env.local.example` sind, sind bereits in einem früheren Commit als rotiert gekennzeichnet.
- Rotation: bei Kompromittierung Hero-Key zuerst in Hero invalidieren, dann in Vercel-UI und DB neu setzen.

---

## 8. Test-Strategie

| Ebene | Tool | Scope | Status |
|-------|------|-------|--------|
| Unit | Vitest | Reine Funktionen (Timeframe, Filter, KPI-Aggregation) | 32 Tests auf `main`, weitere auf Branches |
| Component | Vitest + Testing-Library | UI-Snapshots, Dialog-Flows | Einzelne Smoke-Tests |
| E2E | Playwright | Happy-Path durchs Dashboard | Konfig da, Specs noch dünn |
| Type-Check | `tsc --noEmit` | CI-Gate | Muss grün bleiben |
| Lint | ESLint (next + custom) | CI-Gate | Muss grün bleiben |

**Neu zu schaffen:**
- E2E-Test „Admin gibt Hero-Key ein → Dashboard-Reload zeigt Live-Daten".
- Unit-Test für `getActiveHeroApiKey` mit gestubtem Supabase.
- Vertragstest zwischen Hero-GraphQL-Schema und `normalizeHeroProject` (schon teilweise vorhanden).

---

## 9. Deployment-Strategie

### 9.1 Jetzt: Vercel
- `main` → Production (`jumax-controlling-hub.vercel.app`)
- Feature-Branches → Preview-Deploys pro Branch (`…-git-<branch>.vercel.app`)
- Env-Vars pro Environment (Prod/Preview/Dev) getrennt

### 9.2 Mittelfristig: Coolify/Hetzner als Alternative
Dokumentiert unter `docs/setup/gitlab-coolify-setup.md`. Option, falls Vercel teurer wird oder mehr Kontrolle gewünscht ist. Nicht blocking.

### 9.3 Migration-Workflow für neue Features
```
1. /requirements → Feature-Spec in features/PROJ-X-*.md
2. /architecture → Design-Abschnitt im Spec
3. Feature-Branch von main
4. /frontend + /backend → Implementation
5. Unit-/E2E-Tests ergänzen, grün halten
6. /qa → Review gegen Acceptance Criteria
7. PR auf main → Preview-Deploy testen
8. Merge → Auto-Deploy auf Production
9. features/INDEX.md + Spec auf „Deployed" setzen
```

---

## 10. Monitoring & Observability

| Bereich | Jetzt | Soll (Phase 4) |
|---------|-------|----------------|
| Runtime-Logs | Vercel-Logs manuell | Sentry + Struktur-Logs |
| Fehler-Alarme | Keine | Sentry-Alarme via Slack/E-Mail |
| Performance | Keine | Vercel Analytics + Web Vitals |
| DB-Metriken | Supabase-Dashboard | Supabase-Advisors regelmäßig, Alarm bei RLS-Verletzungen |
| Uptime | Keine | Externe Uptime-Sonde (z. B. UptimeRobot) |

---

## 11. Produktions-Readiness-Checkliste

- [x] Hero GraphQL Client read-only
- [x] RLS auf jeder Tabelle aktiv
- [x] Sync-Endpoint bewusst disabled (410)
- [x] `app_settings`-Tabelle mit RLS = service_role only
- [x] `search_path` auf Trigger-Funktion gepinned (Supabase-Advisor-Lint 0011)
- [x] Preview-Deploy-Branch auf Vercel gebaut
- [ ] **Vercel-Env-Vars für Preview-Scope gesetzt** ← blockiert PROJ-2 QA
- [ ] Branch-Konflikt PROJ-2/PROJ-3 aufgelöst (siehe §14)
- [ ] Auth (Supabase Auth) für Dashboard aktiviert
- [ ] Sentry oder gleichwertiges Error-Tracking integriert
- [ ] Rate-Limiting für Hero-Fetch
- [ ] Security-Headers (CSP / HSTS) in `next.config.ts`
- [ ] Backup-Strategie für Supabase dokumentiert und ein Restore-Drill durchgeführt
- [ ] E2E-Tests für PROJ-2-Flow
- [ ] Feature-Spec für jede geplante Phase geschrieben
- [ ] README + Onboarding-Doc für neue Entwickler

---

## 12. Offene Entscheidungen & Risiken

### 12.1 Branch-Konflikt `H6OQY` vs. `feat/proj-2-hero-api-key-ui`
**Problem:** Beide Branches haben PROJ-2 mit unterschiedlichem Inhalt. Beide verändern `hero-admin-panel.tsx` inkompatibel.
**Optionen:**
- **(A) UI-Key-Management gewinnt** — `H6OQY` wird umgeschnitten, PROJ-2 → UI-Key, Sync-Features bekommen neue IDs PROJ-8/9.
- **(B) Sync-Admin-Panel gewinnt** — meine PROJ-2-Arbeit verworfen, Keys bleiben in Env.
- **(C) Beide mergen, Konflikte per Hand lösen** — UI-Panel bekommt den Key-Input **und** den Sync-Status nebeneinander. IDs werden in INDEX.md konsolidiert.
**Empfehlung:** Option C. Das Panel hat Platz für beide Informationen. Erfordert einen sauberen Integrations-Commit, der beide Versionen von `hero-admin-panel.tsx` zusammenführt.

### 12.2 Auth-Strategie
Das Dashboard ist aktuell **öffentlich erreichbar** (jede Person mit der Vercel-URL sieht Sample-Daten bzw. Live-Daten). Für Production mit echten Hero-Daten nicht akzeptabel.
**Optionen:**
- Supabase-Auth mit Magic-Link (empfohlen für kleines Team)
- Vercel-Deployment-Protection als Zwischenlösung (bereits aktiv für Preview)
- SSO über Microsoft Entra (Azure AD) — ohnehin für MS-Graph gebraucht

### 12.3 E-Mail-Pipeline: Gehört das hier rein?
Die uncommittete Email-Pipeline ist funktional ein **eigenes Produkt** (Mail → Klassifikation → Notion). Sie teilt nur Dependencies (Supabase, Anthropic). Empfehlung: eigenes Repo oder zumindest klar abgetrennter Modul-Ordner mit eigenem Deploy-Target. Vor Merge auf `main` explizite Produktentscheidung holen.

### 12.4 Cron-Hoster
`docs/setup/cron-migration.md` empfiehlt GitLab-Schedules statt Vercel Cron. Entscheidung: bleiben wir bei Vercel (einfacher) oder migrieren (günstiger, Self-Host)? Blocking ab Phase 3.

### 12.5 Historische KPI-Daten
Derzeit werden keine KPI-Snapshots geschrieben. Sobald Phase 3 (Sync) läuft, sollte pro Sync-Lauf ein Snapshot in `kpi_snapshots` landen, damit Wochenvergleiche möglich sind. Rückwirkende Daten sind nicht rekonstruierbar — je früher gestartet, desto mehr Historie.

---

## 13. Workflow-Konventionen (Recap aus CLAUDE.md)

- **Feature-IDs sequentiell:** PROJ-1, PROJ-2, …
- **Commit-Format:** `feat(PROJ-X): …`, `fix(PROJ-X): …`, `docs(PROJ-X): …`
- **Single Responsibility:** eine Feature-Spec pro Datei, keine Kombifeatures
- **shadcn/ui first:** vor Custom-Components erst `src/components/ui/` prüfen
- **Human-in-the-Loop:** kein Phase-Übergang ohne explizite User-Bestätigung
- **Tests co-located:** `foo.test.ts` neben `foo.ts`; E2E in `/tests`
- **Write-Then-Verify für Statusupdates:** nach jedem Feature INDEX.md + Spec-Header nachziehen und per Read prüfen

---

## 14. Nächste konkrete Schritte (priorisiert)

### Kritisch (blockiert PROJ-2-Abnahme)
1. **Env-Vars für Vercel-Preview-Scope aktivieren.**
   - Check: GET `/api/settings/hero` gibt `supabaseConfigured: true` zurück.
   - Nach Aktivierung: Redeploy (pusht automatisch, sonst leerer Commit).
2. **Admin-Panel-Save testen** mit echtem Hero-Key.
3. **`/qa` für PROJ-2** laufen lassen; Checkliste aus dem Feature-Spec abarbeiten.

### Mittelfristig (nächste 1–2 Wochen)
4. **Branch-Konflikt `H6OQY` auflösen** (siehe §12.1). Danach kommen PROJ-3 bis PROJ-7 portionsweise auf `main`.
5. **Auth einführen** (§12.2). Muss passieren, bevor echte Hero-Live-Daten ins Production-Dashboard kommen.
6. **Sentry einrichten** und `SENTRY_DSN` in allen Environments setzen.
7. **E-Mail-Pipeline entscheiden** (§12.3): entweder Spec schreiben und weiterbauen, oder aus dem Working-Tree entfernen.

### Danach (1–2 Monate)
8. **Hero→Supabase-Sync (Phase 3)** mit Cron und Audit-Log.
9. **Historische KPI-Persistenz.**
10. **Produktionshärtung** (Rate-Limits, Security-Headers, Backup-Drill).

---

## 15. Anhang: wichtige Pfade

```
docs/
 ├─ PRD.md                        Produktvision
 ├─ IMPLEMENTATION_PLAN.md        dieses Dokument
 ├─ production/                   Produktions-Guides (Sentry, Security, Rate-Limits)
 ├─ setup/                        Ops-Guides (Cron-Migration, Coolify, Lovable-Sync)
 └─ controlling-dashboard/        frühere Planungsnotizen (legacy)

features/
 ├─ INDEX.md                      zentrales Feature-Tracking
 ├─ PROJ-1-controlling-dashboard-read-only-baseline.md
 └─ PROJ-2-hero-api-key-ui-management.md

src/
 ├─ app/
 │   ├─ api/
 │   │   ├─ settings/hero/route.ts        (PROJ-2)
 │   │   ├─ cron/sync-hero/route.ts       (aktuell 410 Gone)
 │   │   ├─ cron/process-emails/          (E-Mail-Pipeline, uncommittet)
 │   │   └─ emails/                        (E-Mail-Pipeline, uncommittet)
 │   ├─ page.tsx                           (Dashboard)
 │   └─ emails/page.tsx                    (E-Mail-Review, uncommittet)
 ├─ components/dashboard/
 │   ├─ hero-admin-panel.tsx               (PROJ-2 UI)
 │   ├─ dashboard-shell.tsx
 │   ├─ dashboard-cards.tsx / -charts.tsx / -project-list.tsx
 │   └─ sync-button.tsx
 ├─ lib/
 │   ├─ hero/                              Hero GraphQL Client
 │   ├─ settings/hero-settings.ts          (PROJ-2 Server-Helper)
 │   ├─ services/dashboard-data.ts         Aggregations-Service
 │   ├─ dashboard/                         Timeframe-/Department-Logik
 │   ├─ anthropic/                         (uncommittet)
 │   ├─ ms-graph/                          (uncommittet)
 │   └─ notion/                            (uncommittet)
 └─ test/setup.ts                          Vitest-Setup

supabase/
 └─ migrations/
     ├─ 20260416175900_create_kpi_snapshots.sql
     ├─ 20260421090000_create_emails_processed.sql
     ├─ 20260421120000_create_app_settings.sql              (PROJ-2)
     └─ 20260421120100_harden_app_settings_trigger.sql       (PROJ-2)
```

---

*Dokument generiert am 2026-04-22. Bei Änderungen am Projekt-Scope bitte dieses Dokument ebenfalls nachziehen.*
