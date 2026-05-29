# Cron-Migration: Von Vercel zu GitLab-Schedule

## Hintergrund

Das Repo enthaelt `vercel.json` mit einem aktiven Cron:

```json
{
  "crons": [
    { "path": "/api/cron/process-emails", "schedule": "*/15 * * * *" }
  ]
}
```

Dieser Cron ruft alle 15 Minuten den internen Endpoint `/api/cron/process-emails` auf. Sobald Vercel durch Coolify ersetzt ist, wird die `vercel.json` ignoriert — der Cron muss irgendwo anders laufen.

**`vercel.json` wurde bewusst nicht geloescht**, damit die bisherige Vercel-Deployment weiterlaeuft, bis der Coolify-Stack steht. Nach erfolgreichem Coolify-Rollout sollte die Datei geloescht werden.

## Migrationsoptionen

### Option A — GitLab-Scheduled-Pipeline (empfohlen)

Ein Mini-Pipeline-Job in `app-release`, der per Cron-Schedule den Endpoint der Live-Umgebung aufruft.

Ergaenzung in `.gitlab-ci.yml` von `app-release`:

```yaml
cron_process_emails:
  stage: validate_release   # eigenen Stage verwenden, wenn gewuenscht
  image: alpine:3.20
  before_script:
    - apk add --no-cache curl
  script:
    - |
      curl -fsSL -X POST "https://deine-domain/api/cron/process-emails" \
        -H "Authorization: Bearer $CRON_SECRET"
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule" && $CRON_JOB == "process_emails"
```

Dann in `app-release` -> Build -> Pipeline schedules:
- Description: `process-emails`
- Interval: `*/15 * * * *`
- Target branch: `main`
- Variables: `CRON_JOB = process_emails`

### Option B — Cron auf der Hetzner-VM

Auf der VM als root:

```bash
cat > /etc/cron.d/process-emails <<'EOF'
*/15 * * * * root curl -fsSL -X POST "https://deine-domain/api/cron/process-emails" -H "Authorization: Bearer <CRON_SECRET>" >/dev/null 2>&1
EOF
```

Nachteile: `CRON_SECRET` liegt im Klartext im Cron-File. Weniger nachvollziehbar als GitLab-Schedules.

### Option C — Cron im App-Container

Separater Sidecar-Container mit `ofelia` oder `supercronic`. Hoeherer Aufwand, meist nicht noetig fuer einen Cron.

## Entscheidung

**Empfehlung Option A** — alles laeuft ueber GitLab, Logs sichtbar, `CRON_SECRET` nur als CI-Variable.

## Nach erfolgreichem Rollout

```bash
git rm vercel.json
git commit -m "chore: remove vercel.json after Coolify rollout"
```
