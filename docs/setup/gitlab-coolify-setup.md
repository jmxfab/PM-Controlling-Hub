# Setup-Anleitung: GitLab + Coolify + Hetzner

> Klick-fuer-Klick-Anleitung, um den in diesem Repo vorbereiteten Workflow produktiv zu nehmen.
> Alles, was nicht automatisiert werden kann, steht hier — mit konkreten URLs und Befehlen.

## Uebersicht

```
Lovable (GitHub) ──Schedule-Pull──▶ GitLab app-dev ──Coolify-Webhook──▶ dev.deine-domain
                                         │
                                  promote-to-release
                                         │
                                         ▼
                                GitLab app-release
                                 ├─ alpha ─▶ Coolify ─▶ alpha.deine-domain
                                 ├─ beta  ─▶ Coolify ─▶ beta.deine-domain
                                 └─ main  ─▶ Coolify (manuell) ─▶ deine-domain
```

## Schritt 1 — GitLab-Projekte anlegen

1. GitLab.com -> Create group -> Name z.B. `jumax-controlling`, Visibility **Private**.
2. In der Gruppe: **New project** -> *Create blank project*
   - Name: `app-dev`
   - Visibility: **Private**
3. Noch einmal *Create blank project*
   - Name: `app-release`
   - Visibility: **Private**

## Schritt 2 — Mitglieder einladen

### `app-dev`
- Externes Team: Rolle **Developer**
- Internes Team: Rolle **Maintainer**

### `app-release`
- Nur internes Team: Rolle **Maintainer**
- Externes Team: **nicht einladen**

## Schritt 3 — Protected Branches

### In `app-dev` (Settings -> Repository -> Protected branches)
- `dev`:
  - Allowed to merge: **Developers + Maintainers**
  - Allowed to push and merge: **Developers + Maintainers**
  - Code-owner approval required: off
- `feature/*` und `bugfix/*`: keine Protection (Entwickler pushen frei)

### In `app-release` (Settings -> Repository -> Protected branches)
- `alpha`, `beta`, `main` jeweils:
  - Allowed to merge: **Maintainers**
  - Allowed to push and merge: **No one**
- `release/*`: Allowed to push: **Maintainers**

## Schritt 4 — Initialer Push

Lokal im Repo `Jumax-Controlling-Hub/`:

```bash
# app-dev als origin
git remote set-url origin git@gitlab.com:jumax-controlling/app-dev.git
git push -u origin dev

# app-release als zweites Remote
git remote add release git@gitlab.com:jumax-controlling/app-release.git
# .gitlab-ci.release.yml wird in app-release als .gitlab-ci.yml verwendet:
git checkout -b bootstrap
cp .gitlab-ci.release.yml .gitlab-ci.yml.tmp
git mv .gitlab-ci.yml .gitlab-ci.app-dev.yml
mv .gitlab-ci.yml.tmp .gitlab-ci.yml
git commit -am "bootstrap: use release CI"
git push release bootstrap:main
# zurueck zu normalem Stand:
git checkout dev && git branch -D bootstrap
git remote remove release
```

Alternative, einfacher: in `app-release` per Web-UI `.gitlab-ci.yml` aus `.gitlab-ci.release.yml` kopieren.

## Schritt 5 — Hetzner-VM

1. [console.hetzner.cloud](https://console.hetzner.cloud) -> neues Projekt `jumax-apps`.
2. Server anlegen:
   - Location: Nuernberg oder Falkenstein
   - Image: **Ubuntu 24.04**
   - Typ: **CX22** (2 vCPU, 4 GB RAM) — reicht fuer 4 Stacks eines internen Tools
   - SSH-Key hochladen
   - Firewall: Port 22, 80, 443 offen; 8000 nur fuer deine IP (Coolify-UI)
3. DNS beim Domain-Provider (A-Record):
   - `deine-domain` -> VM-IP
   - `*.deine-domain` -> VM-IP (Wildcard)

## Schritt 6 — Coolify installieren

SSH auf VM:

```bash
ssh root@<VM-IP>
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Danach:
- Coolify-UI: `http://<VM-IP>:8000` -> Initialer Admin-Account
- **Settings -> Instance Settings** -> FQDN auf `coolify.deine-domain` setzen (eigener A-Record noetig), TLS automatisch via Let's Encrypt
- **Servers -> Proxy** -> Traefik aktivieren (Default)

## Schritt 7 — Coolify-Projekte fuer die 4 Umgebungen

In Coolify **pro Umgebung** (dev, alpha, beta, live):

1. *Add new resource -> Docker Compose* oder *Dockerfile*
2. Source: *Public Git / Private Git via deploy key*
3. Repository:
   - `dev`: `app-dev`, Branch `dev`
   - `alpha`: `app-release`, Branch `alpha`
   - `beta`: `app-release`, Branch `beta`
   - `live`: `app-release`, Branch `main`
4. Build Pack: **Dockerfile** (`Dockerfile` im Repo-Root)
5. Port: **3000**
6. Domain:
   - dev -> `dev.deine-domain`
   - alpha -> `alpha.deine-domain`
   - beta -> `beta.deine-domain`
   - live -> `deine-domain`
7. TLS: Let's Encrypt an
8. *Environment Variables*: Werte aus `.env.<stage>.example` als Vorlage verwenden. Echte Werte aus Supabase/Hero/etc. einsetzen.
9. *Auto Deploy*: **aus** (wir triggern bewusst ueber GitLab-CI-Webhook)
10. **Deploy-Webhook-URL kopieren** (Einstellung *Webhook*) -> spaeter als CI-Variable

## Schritt 8 — Supabase-Projekte

Empfehlung: **2 Supabase-Projekte**, nicht 4.

1. `jumax-hub-dev` -> Daten fuer `dev` + `alpha`
2. `jumax-hub-prod` -> Daten fuer `beta` + `live`

Warum: `beta` soll bereits gegen echte Daten laufen, sonst findet man Prod-spezifische Bugs nicht. `dev` und `alpha` koennen sich eine Sandbox teilen.

Pro Projekt aus Supabase Dashboard kopieren:
- Project URL -> `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` Key -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` Key -> `SUPABASE_SECRET_KEY` (in Coolify pro Stage)

## Schritt 9 — GitLab CI/CD-Variablen

### In `app-dev` (Settings -> CI/CD -> Variables, alle **Protected**):

| Key | Wert | Flag |
|---|---|---|
| `COOLIFY_WEBHOOK_DEV` | Webhook-URL aus Coolify (dev) | Masked |
| `LOVABLE_GITHUB_URL` | `https://github.com/<org>/<lovable-repo>.git` | — |
| `LOVABLE_GITHUB_PAT` | Fine-grained PAT, Read-Scope | Masked |
| `CI_PUSH_TOKEN` | Project Access Token in `app-dev`, Scope `write_repository` | Masked |
| `RELEASE_DEPLOY_SSH_KEY` | Privater SSH-Key, dessen Public-Teil in `app-release` als Deploy-Key mit Write hinterlegt ist | File |
| `RELEASE_REPO_SSH` | `git@gitlab.com:jumax-controlling/app-release.git` | — |
| `GITLAB_TOKEN_APP_RELEASE` | Project Access Token in `app-release`, Scope `api` | Masked |

### In `app-release` (Settings -> CI/CD -> Variables, alle **Protected**):

| Key | Wert | Flag |
|---|---|---|
| `COOLIFY_WEBHOOK_ALPHA` | Webhook-URL aus Coolify (alpha) | Masked |
| `COOLIFY_WEBHOOK_BETA` | Webhook-URL aus Coolify (beta) | Masked |
| `COOLIFY_WEBHOOK_LIVE` | Webhook-URL aus Coolify (live) | Masked |

### Deploy-Key fuer app-release anlegen

Lokal:
```bash
ssh-keygen -t ed25519 -f ~/.ssh/gitlab-app-release -C "ci-promote" -N ""
```
- Public-Teil (`gitlab-app-release.pub`) in `app-release` -> Settings -> Repository -> Deploy Keys hinzufuegen, **Write-Access aktivieren**.
- Private-Teil in `app-dev` als CI/CD-Variable `RELEASE_DEPLOY_SSH_KEY` (Typ File) hinterlegen.

## Schritt 10 — Scheduled Pull aus Lovable aktivieren

`app-dev` -> Build -> Pipeline schedules -> **New schedule**
- Description: `Lovable sync`
- Interval: `0 6 * * *` (taeglich 06:00 UTC)
- Target branch: `dev`
- Variables (optional): leer
- Aktivieren.

Erster Lauf: **Play-Button** druecken, um manuell zu testen.

## Schritt 11 — Ersten Deploy ausloesen

```bash
# lokal
git checkout dev
git commit --allow-empty -m "ci: initial deploy test"
git push origin dev
```

- CI-Pipeline in GitLab laeuft: install -> lint -> test -> build -> deploy_dev
- Coolify deployt und liefert unter `https://dev.deine-domain` die App aus

## Schritt 12 — Ersten Release-Kandidaten promoten

In `app-dev` -> CI/CD -> Pipelines -> neueste Pipeline auf `dev` -> Job `promote_release` -> **Play**.

- Script pusht `release/rc-<date>-<HHMM>` nach `app-release`
- Automatischer MR `release/rc-... -> alpha` wird geoeffnet
- Merge -> Auto-Deploy nach `alpha.deine-domain`
- Danach manueller MR `alpha -> beta` (Coolify deployt auto)
- Danach MR `beta -> main` (Deploy-Job ist `manual` — bewusstes Live-Gate)

## Troubleshooting

- **CI `sync_from_lovable` scheitert mit Merge-Konflikt**: lokal `git fetch lovable` holen, `git merge lovable/main` aufloesen, `git push origin dev`.
- **Coolify deployt nicht nach Webhook-Call**: Deploy-Log in Coolify anschauen (*Deployments* -> letzter Eintrag). Meistens fehlt eine Env-Variable.
- **TLS funktioniert nicht**: DNS-Propagation abwarten (`dig dev.deine-domain`), Coolify-Logs checken, Traefik muss die Certs anfragen koennen (Port 80 offen).
