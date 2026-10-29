#!/usr/bin/env bash
#
# Production deploy for the frontend host. Pulls a prebuilt image from ECR and
# swaps the container. It NEVER builds — that happens in GitHub Actions.
#
#   ./deploy.sh a84f6d2     deploy that image tag (normally the short commit SHA)
#   ./deploy.sh             re-deploy whatever tag .deploy.env currently pins
#
# On a failed healthcheck it rolls back to the previously deployed tag and exits
# non-zero, so a bad build does not leave the site down.

set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/aadml-frontend}"
ENV_FILE="${APP_DIR}/.deploy.env"
CONTAINER="${CONTAINER_NAME:-aadml-frontend}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-90}"
# The previous release's assets, mounted read-only by docker-compose.yml (F-C1, ADM-1073).
PREV_DIR="${APP_DIR}/prev-release"

cd "$APP_DIR"

# Made here, as this user, so Docker never creates it as root for the bind mount (deploy.sh could then
# not replace what is in it).
mkdir -p "$PREV_DIR"

[[ -f "$ENV_FILE" ]] || { echo "!! missing $ENV_FILE — see DEPLOY.md" >&2; exit 1; }

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

: "${ECR_REGISTRY:?ECR_REGISTRY not set in $ENV_FILE}"

PREV_TAG="${IMAGE_TAG:-}"
NEW_TAG="${1:-$PREV_TAG}"
[[ -n "$NEW_TAG" ]] || { echo "usage: $0 <image-tag>" >&2; exit 1; }

# Region is field 4 of <account>.dkr.ecr.<region>.amazonaws.com. Deriving it keeps
# one source of truth, so the region can never drift from the registry it belongs to.
AWS_REGION="$(cut -d. -f4 <<<"$ECR_REGISTRY")"

# Rewrite IMAGE_TAG in place so `docker compose ps/logs/restart` on this box all
# agree with what is actually running, and a bare ./deploy.sh is idempotent.
#
# The export is NOT optional. `set -a; source "$ENV_FILE"` above exported IMAGE_TAG with the
# PREVIOUS tag, and Compose resolves ${IMAGE_TAG} from the shell environment BEFORE --env-file.
# Rewriting only the file therefore left pull/up on the old image while every echo below claimed
# the new one — a green deploy that shipped nothing, and a second run that "fixed it" only because
# the file already held the requested tag. Keep both in sync in one place.
write_tag() {
  if grep -q '^IMAGE_TAG=' "$ENV_FILE"; then
    sed -i "s|^IMAGE_TAG=.*|IMAGE_TAG=$1|" "$ENV_FILE"
  else
    printf 'IMAGE_TAG=%s\n' "$1" >> "$ENV_FILE"
  fi
  export IMAGE_TAG="$1"
}

# Docker reports "starting" for the whole start_period, so poll rather than
# reading the status once. `none` means the image predates the healthcheck.
wait_healthy() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT)) status
  while (( SECONDS < deadline )); do
    status="$(docker inspect \
      --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' \
      "$CONTAINER" 2>/dev/null || echo missing)"
    case "$status" in
      healthy|none) return 0 ;;
      unhealthy)    return 1 ;;
    esac
    sleep 3
  done
  return 1
}

# KEEP THE OUTGOING RELEASE'S ASSETS FOR ONE DEPLOY (F-C1, ADM-1073). A tab still open on the old
# index.html asks for old hashed chunks as soon as it opens a lazy page; the new image does not have them.
# Copied out of the running container BEFORE it is replaced, into $PREV_DIR, which the new container
# mounts and nginx falls back to. One release only: the folder's contents are replaced, never added to.
# The folder itself is kept (emptied, then refilled), not renamed: a container that `up -d` does not
# recreate (same tag again) keeps the mount it has, and a renamed folder would leave it on a deleted one.
# Best effort: a failure is reported and the deploy goes on, as it did before this existed.
keep_prev_assets() {
  local stage="${PREV_DIR}.new" src
  if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
    echo "==> no ${CONTAINER} container: no previous assets to keep"
    return 0
  fi
  rm -rf "$stage" || return 1
  for src in assets dashboard/training-data/assets; do
    mkdir -p "$stage/$(dirname "$src")" || return 1
    # A release without the Training Data page has no second folder; only assets/ is required.
    if ! docker cp "$CONTAINER:/usr/share/nginx/html/$src" "$stage/$src" >/dev/null 2>&1; then
      [[ "$src" != assets ]] || return 1
    fi
  done
  find "$PREV_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} + || return 1
  mv "$stage"/* "$PREV_DIR"/ || return 1
  rm -rf "$stage"
  echo "==> kept the outgoing release's assets in ${PREV_DIR} ($(du -sh "$PREV_DIR" | cut -f1))"
}

echo "==> deploying ${ECR_REPOSITORY:-aadml-frontend}:${NEW_TAG} (current: ${PREV_TAG:-none})"

aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

write_tag "$NEW_TAG"

docker compose --env-file "$ENV_FILE" pull frontend
keep_prev_assets || echo "** could not keep the previous release's assets; tabs open on it may 404 on lazy pages" >&2
docker compose --env-file "$ENV_FILE" up -d --no-build --remove-orphans

if wait_healthy; then
  echo "==> healthy on ${NEW_TAG}"
  docker image prune -f >/dev/null
  exit 0
fi

echo "!! ${NEW_TAG} failed its healthcheck" >&2
docker compose --env-file "$ENV_FILE" logs --tail 50 frontend >&2 || true

if [[ -n "$PREV_TAG" && "$PREV_TAG" != "$NEW_TAG" ]]; then
  echo "!! rolling back to ${PREV_TAG}" >&2
  write_tag "$PREV_TAG"
  docker compose --env-file "$ENV_FILE" up -d --no-build
  wait_healthy && echo "==> rolled back to ${PREV_TAG}" >&2
else
  echo "!! no previous tag recorded — not rolling back" >&2
fi

exit 1
