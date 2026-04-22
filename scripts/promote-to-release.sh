#!/usr/bin/env bash
# Promote aktuellen dev-Stand aus app-dev als release/rc-* nach app-release
# und oeffnet automatisch einen Merge Request nach alpha.
#
# Erwartete Umgebungsvariablen (in CI oder lokal gesetzt):
#   RELEASE_DEPLOY_SSH_KEY     SSH-Privatekey-INHALT (nicht Pfad) mit Push-Recht auf app-release
#   RELEASE_REPO_SSH           SSH-URL zu app-release, z.B. git@gitlab.com:<group>/app-release.git
#   GITLAB_TOKEN_APP_RELEASE   Project Access Token (api-Scope) auf app-release, fuer glab
#   CI_COMMIT_SHA              Aktueller Commit in app-dev (von GitLab CI gesetzt; lokal selbst setzen)
#   CI_PROJECT_URL             Optional, fuer Link in MR-Beschreibung
#
# Verwendung:
#   - In CI: als Job promote_release (siehe .gitlab-ci.yml)
#   - Lokal: alle genannten Variablen exportieren, dann bash scripts/promote-to-release.sh

set -euo pipefail

: "${RELEASE_DEPLOY_SSH_KEY:?muss gesetzt sein}"
: "${RELEASE_REPO_SSH:?muss gesetzt sein}"
: "${GITLAB_TOKEN_APP_RELEASE:?muss gesetzt sein}"
: "${CI_COMMIT_SHA:=$(git rev-parse HEAD)}"

# RC-Name aus Datum + fortlaufendem Suffix (Unix-Timestamp-Minuten fuer Eindeutigkeit)
TODAY="$(date -u +%Y-%m-%d)"
RC_SUFFIX="$(date -u +%H%M)"
RC_NAME="rc-${TODAY}-${RC_SUFFIX}"
RELEASE_BRANCH="release/${RC_NAME}"

echo ">> Promote Commit ${CI_COMMIT_SHA} als ${RELEASE_BRANCH}"

# SSH-Key fuer Push nach app-release vorbereiten
SSH_DIR="$(mktemp -d)"
chmod 700 "$SSH_DIR"
printf '%s\n' "$RELEASE_DEPLOY_SSH_KEY" > "$SSH_DIR/id_ed25519"
chmod 600 "$SSH_DIR/id_ed25519"
# GitLab.com Host-Key (Juli 2023+)
cat > "$SSH_DIR/known_hosts" <<'EOF'
gitlab.com ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBFSMqzJeV9rUzU4kWitGjeR4PWSa29SPqJ1fVkhtj3Hw9xjLVXVYrU9QlYWrOLXBpQ6KWjbjTDTdDkoohFzgbEY=
EOF
chmod 600 "$SSH_DIR/known_hosts"
export GIT_SSH_COMMAND="ssh -i $SSH_DIR/id_ed25519 -o UserKnownHostsFile=$SSH_DIR/known_hosts -o IdentitiesOnly=yes"

# Release-Remote anlegen und Commit pushen
git remote remove release 2>/dev/null || true
git remote add release "$RELEASE_REPO_SSH"
git push release "${CI_COMMIT_SHA}:refs/heads/${RELEASE_BRANCH}"

# Tag im Quell-Repo (app-dev) setzen, damit der RC auch dort auffindbar ist
git tag -a "${RC_NAME}" "${CI_COMMIT_SHA}" -m "Release candidate ${RC_NAME}" || true
git push origin "refs/tags/${RC_NAME}" || true

echo ">> MR in app-release von ${RELEASE_BRANCH} nach alpha oeffnen"

# glab in app-release authentisieren und MR anlegen
RELEASE_PROJECT_PATH="$(echo "$RELEASE_REPO_SSH" | sed -E 's#git@[^:]+:##; s#\.git$##')"

# glab erwartet einen Hostname + Token; wir verwenden --repo um gezielt zu adressieren
GITLAB_HOST="$(echo "$RELEASE_REPO_SSH" | sed -E 's#^git@([^:]+):.*$#\1#')"
export GITLAB_TOKEN="$GITLAB_TOKEN_APP_RELEASE"
glab auth login --hostname "$GITLAB_HOST" --token "$GITLAB_TOKEN" >/dev/null || true

MR_TITLE="Release ${RC_NAME}"
MR_DESC="Automatischer MR aus app-dev.

Source-Commit: ${CI_COMMIT_SHA}
Source-Projekt: ${CI_PROJECT_URL:-app-dev}

Naechste Schritte:
1. Validierung auf alpha.deine-domain nach Merge.
2. Anschliessend MR alpha -> beta.
3. Anschliessend MR beta -> main (manuelles Deploy auf deine-domain)."

glab mr create \
  --repo "$RELEASE_PROJECT_PATH" \
  --source-branch "$RELEASE_BRANCH" \
  --target-branch alpha \
  --title "$MR_TITLE" \
  --description "$MR_DESC" \
  --yes || {
    echo "MR-Erstellung fehlgeschlagen. Branch wurde gepusht, MR bitte manuell anlegen."
    exit 1
  }

echo ">> Fertig. RC: ${RC_NAME}"
