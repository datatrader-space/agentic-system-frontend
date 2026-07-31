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

cd "$APP_DIR"

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
write_tag() {
  if grep -q '^IMAGE_TAG=' "$ENV_FILE"; then
    sed -i "s|^IMAGE_TAG=.*|IMAGE_TAG=$1|" "$ENV_FILE"
  else
    printf 'IMAGE_TAG=%s\n' "$1" >> "$ENV_FILE"
  fi
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

echo "==> deploying ${ECR_REPOSITORY:-aadml-frontend}:${NEW_TAG} (current: ${PREV_TAG:-none})"

aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

write_tag "$NEW_TAG"

docker compose --env-file "$ENV_FILE" pull frontend
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
