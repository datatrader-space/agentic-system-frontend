#!/usr/bin/env bash
#
# Manual deploy — the fallback for when GitHub Actions minutes are exhausted.
#
#   ./scripts/deploy-manual.sh              deploy the current HEAD
#   SKIP_TESTS=1 ./scripts/deploy-manual.sh skip the suite (CI normally gates on it)
#
# The normal path is a push to main: build.yml builds the image, pushes it to ECR and calls
# deploy.yml, which runs /opt/aadml-frontend/deploy.sh on the host over SSM. That path is dead
# without Actions minutes, and it cannot simply be moved onto the host: the instance role
# (SSMInstanceRole) has ECR *ReadOnly*, so the box can pull images but never push one.
#
# So this script splits the CI image in two, exactly where the Dockerfile does:
#   - the build stage (npm ci + vite build) runs HERE, on a machine with RAM and node 24
#   - the runtime stage (nginx:alpine + dist + nginx.conf) is assembled ON the box
# Only dist/ + nginx.conf cross the wire (~6 MB gzipped) instead of an 88 MB image, and the
# box's docker build is a COPY, so the 2 GiB host never runs a webpack-sized build again.
#
# The resulting image is tagged manual-<sha> to keep it distinguishable from CI's <sha> tags,
# which DO exist in ECR. A manual- tag lives only on the host: `deploy.sh manual-xxxxxxx` would
# try to pull it and fail. Roll back to a CI tag, or re-run this script from the older commit.

set -Eeuo pipefail

KEY="${DEPLOY_KEY:-/c/Users/chaud/Downloads/sztax_frontend.pem}"
HOST="${DEPLOY_HOST:-ubuntu@54.219.25.248}"
SSH_OPTS=(-i "$KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20)

cd "$(dirname "$0")/.."

command -v docker >/dev/null || { echo "!! docker is required on the host box only, but ssh/scp are required here" >&2; }
[[ -f "$KEY" ]] || { echo "!! key not found: $KEY (set DEPLOY_KEY)" >&2; exit 1; }

SHA="$(git rev-parse --short=7 HEAD)"
TAG="manual-${SHA}"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "** working tree is dirty — deploying the BUILT tree, which is not exactly ${SHA}" >&2
fi

echo "==> building ${TAG} locally"
if [[ "${SKIP_TESTS:-0}" != "1" ]]; then
  echo "==> npm test (the gate CI applies before any image reaches ECR)"
  npm test
fi

NODE_OPTIONS="--max-old-space-size=4096" npm run build

[[ -f dist/index.html ]] || { echo "!! build produced no dist/index.html" >&2; exit 1; }

BUNDLE="$(mktemp -t aadml-fe-XXXXXX).tgz"
trap 'rm -f "$BUNDLE"' EXIT
tar -czf "$BUNDLE" dist nginx.conf
echo "==> bundle $(du -h "$BUNDLE" | cut -f1) -> ${HOST}"

scp "${SSH_OPTS[@]}" "$BUNDLE" "${HOST}:/tmp/aadml-frontend-${TAG}.tgz"

# Everything below runs on the box. Kept in one ssh call so a dropped connection cannot
# leave the container half-swapped.
ssh "${SSH_OPTS[@]}" "$HOST" "bash -s" -- "$TAG" <<'REMOTE'
set -Eeuo pipefail

TAG="$1"
APP_DIR=/opt/aadml-frontend
ENV_FILE="$APP_DIR/.deploy.env"
STAGE="/tmp/aadml-build-$TAG"
CONTAINER=aadml-frontend

set -a; source "$ENV_FILE"; set +a
PREV_TAG="${IMAGE_TAG:-}"
IMAGE="${ECR_REGISTRY}/${ECR_REPOSITORY:-aadml-frontend}:${TAG}"

rm -rf "$STAGE"; mkdir -p "$STAGE"
tar -xzf "/tmp/aadml-frontend-${TAG}.tgz" -C "$STAGE"

# The runtime half of the repo Dockerfile, verbatim. Keep the two in step.
cat > "$STAGE/Dockerfile" <<'DOCKERFILE'
FROM nginx:alpine
COPY dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 80
DOCKERFILE

echo "==> assembling $IMAGE on the host"
docker build -q -t "$IMAGE" "$STAGE"

write_tag() {
  if grep -q '^IMAGE_TAG=' "$ENV_FILE"; then
    sed -i "s|^IMAGE_TAG=.*|IMAGE_TAG=$1|" "$ENV_FILE"
  else
    printf 'IMAGE_TAG=%s\n' "$1" >> "$ENV_FILE"
  fi
  export IMAGE_TAG="$1"
}

wait_healthy() {
  local deadline=$((SECONDS + 90)) status
  while (( SECONDS < deadline )); do
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$CONTAINER" 2>/dev/null || echo missing)"
    case "$status" in
      healthy|none) return 0 ;;
      unhealthy)    return 1 ;;
    esac
    sleep 3
  done
  return 1
}

cd "$APP_DIR"
echo "==> swapping container ${PREV_TAG:-none} -> ${TAG}"
write_tag "$TAG"
docker compose --env-file "$ENV_FILE" up -d --no-build --remove-orphans

if wait_healthy; then
  echo "==> healthy on ${TAG}"
  rm -rf "$STAGE" "/tmp/aadml-frontend-${TAG}.tgz"
  docker image prune -f >/dev/null
  exit 0
fi

echo "!! ${TAG} failed its healthcheck" >&2
docker compose --env-file "$ENV_FILE" logs --tail 50 frontend >&2 || true
if [[ -n "$PREV_TAG" && "$PREV_TAG" != "$TAG" ]]; then
  echo "!! rolling back to ${PREV_TAG}" >&2
  write_tag "$PREV_TAG"
  docker compose --env-file "$ENV_FILE" up -d --no-build
  wait_healthy && echo "==> rolled back to ${PREV_TAG}" >&2
fi
exit 1
REMOTE

# Container health is not user-facing truth — check through the public host nginx.
echo "==> verifying https://aadml.com/ from outside"
curl -fsS -o /dev/null -w 'aadml.com -> HTTP %{http_code}\n' https://aadml.com/
