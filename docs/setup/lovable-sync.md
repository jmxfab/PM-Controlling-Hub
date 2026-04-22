# Lovable -> GitLab Sync

## Warum das noetig ist

Lovable.dev verwaltet sein eigenes Git-Remote (bei GitHub). Alle Lovable-Commits landen dort. Wir wollen aber GitLab `app-dev` als Source of Truth — also muss ein Sync-Job die Lovable-Commits regelmaessig nach GitLab holen.

## Wie es funktioniert

GitLab-CI-Scheduled-Job **`sync_from_lovable`** laeuft taeglich um 06:00 UTC:

1. Clont `app-dev`, Branch `dev`.
2. Fuegt Lovables GitHub-Repo als zweites Remote hinzu.
3. Fetched `main` von Lovable.
4. Merged Lovable/main in lokales `dev`.
5. Pusht `dev` zurueck nach `app-dev`.

Wenn der Merge einen Konflikt hat, schlaegt der Job fehl — **bewusst**. Konflikte sollen nicht automatisch aufgeloest werden.

## Bei Konflikten: manuell aufloesen

```bash
cd Jumax-Controlling-Hub
git checkout dev
git pull origin dev

# Lovable-Remote einmalig lokal anlegen (wenn noch nicht vorhanden)
git remote add lovable https://github.com/<org>/<lovable-repo>.git 2>/dev/null || true
git fetch lovable main

git merge lovable/main
# Konflikte aufloesen in den gemeldeten Dateien, dann:
git add <konflikt-datei>
git merge --continue
git push origin dev
```

Danach laeuft die GitLab-Pipeline auf `dev` normal weiter und deployt nach `dev.deine-domain`.

## Workflow fuer das Team

### Wenn Lovable genutzt wird
- Lovable-Session machen -> Lovable committet automatisch nach GitHub.
- Kein manueller Schritt — der Scheduled-Job holt die Aenderungen am naechsten Morgen.

### Wenn direkter Code-Change
- Normal in GitLab `app-dev` auf `feature/*`-Branch arbeiten, MR nach `dev`.

### Was **nicht** passieren sollte
- Gleichzeitiges Arbeiten an derselben Datei in Lovable **und** direkt in GitLab am selben Tag. Das erzeugt Merge-Konflikte, die der Sync-Job nicht aufloesen kann.

## Geheime Werte

In GitLab `app-dev` -> Settings -> CI/CD -> Variables (alle *Protected*, *Masked* wo sinnvoll):

| Variable | Inhalt |
|---|---|
| `LOVABLE_GITHUB_URL` | `https://github.com/<org>/<lovable-repo>.git` |
| `LOVABLE_GITHUB_PAT` | GitHub Fine-grained PAT mit Read-Access auf das Lovable-Repo |
| `CI_PUSH_TOKEN` | GitLab Project Access Token in `app-dev` mit Scope `write_repository` |

## Umstellen auf manuellen Sync

Wenn der Scheduled-Job nicht gewuenscht ist: in GitLab -> Build -> Pipeline schedules -> *Deactivate*. Den gleichen Job manuell ueber *Play* ausloesen, wann immer man Lovable-Commits ziehen will.

## Spaeter: Lovable abkoppeln

Sobald das Team keinen Lovable mehr benutzt:
1. Scheduled Pipeline loeschen.
2. `sync_from_lovable`-Job aus `.gitlab-ci.yml` entfernen (oder drin lassen — er laeuft nur auf Schedule).
3. Lovable-GitHub-Repo archivieren.
