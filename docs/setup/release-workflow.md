# Release-Workflow

## Normalfall: Feature -> Live

```
feature/X (app-dev)
   │ MR
   ▼
dev (app-dev) ──────auto deploy──▶ dev.deine-domain
   │ promote_release (manuell)
   ▼
release/rc-YYYY-MM-DD-HHMM (app-release)
   │ MR (automatisch erstellt)
   ▼
alpha (app-release) ────auto deploy──▶ alpha.deine-domain
   │ MR (manuell)
   ▼
beta (app-release) ─────auto deploy──▶ beta.deine-domain
   │ MR (manuell)
   ▼
main (app-release) ─────manueller Job──▶ deine-domain
```

## Schritt fuer Schritt

1. **Feature entwickeln** — `feature/<name>` in `app-dev`. CI laeuft install/lint/test/build, **kein** Deploy.
2. **Merge in `dev`** — MR nach `dev`. Pipeline deployt automatisch nach `dev.deine-domain`.
3. **Testen auf `dev`** — interne Abnahme.
4. **RC promoten** — `app-dev` -> CI/CD -> Pipelines -> `promote_release` Play-Button. Legt `release/rc-...`-Branch in `app-release` an und oeffnet MR nach `alpha`.
5. **Merge nach `alpha`** — deployt automatisch nach `alpha.deine-domain`. Interne + Stakeholder-Abnahme.
6. **MR `alpha -> beta`** in `app-release` manuell erstellen. Nach Merge Auto-Deploy nach `beta.deine-domain`. Beta laeuft gegen die **Prod-Supabase** -> letzter Check vor Live.
7. **MR `beta -> main`** in `app-release`. Nach Merge startet die Pipeline, aber `deploy_prod` ist **manual**. Erst wenn ein Maintainer den Job startet, geht es live.

## Rollback

### Rollback einer Prod-Freigabe

1. In `app-release`: letzten Merge-Commit auf `main` ueber *Revert*-Button zuruecknehmen (erstellt Revert-MR).
2. Revert-MR mergen.
3. `deploy_prod`-Job manuell starten.

### Rollback einer Beta-/Alpha-Freigabe

Gleicher Ablauf, aber auf dem jeweiligen Branch. Keine manuelle Bestaetigung noetig.

### Rollback einer Dev-Aenderung

`git revert <sha>` auf `dev`, pushen. Auto-Deploy uebernimmt.

## RC-Benennung

Format: `rc-YYYY-MM-DD-HHMM` (UTC).

Beispiele:
- `rc-2026-04-21-0930`
- `rc-2026-04-21-1415`

Der entsprechende Tag wird im Quell-Repo (`app-dev`) gesetzt, damit nachvollziehbar ist, welcher Commit auf dev promoted wurde.

## Was darf direkt gepusht werden?

| Ziel | Erlaubt |
|---|---|
| `feature/*`, `bugfix/*` in `app-dev` | alle Entwickler (intern + extern) |
| `dev` in `app-dev` | per MR, Developer + Maintainer |
| `release/*` in `app-release` | nur ueber `promote_release`-Job |
| `alpha`, `beta`, `main` in `app-release` | ausschliesslich per MR, Maintainer merged |

## Was niemals passieren sollte

- Direkter Push auf `alpha`/`beta`/`main` — durch Protected Branches verhindert.
- Commits, die nicht vorher `dev` passiert haben, in `app-release`. Promote-Script verwendet immer den aktuellen `dev`-Commit.
- Externe Teammitglieder bekommen Zugriff auf `app-release` — gegen das ganze Konzept.
