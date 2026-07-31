# syntax=docker/dockerfile:1.7
#
# Built in CI (.github/workflows/deploy.yml), never on the production host.
# The production host only ever runs `docker compose pull` + `up -d --no-build`.

# Build stage
# node:24 ships npm 11, the same npm that generated package-lock.json. That match is
# what lets us use `npm ci` here: under node:20 (npm 10) the lock's npm-11-style
# optional platform deps (@esbuild/linux-*) read as "missing" and `npm ci` fails,
# which is why this previously had to fall back to the non-reproducible `npm install`.
FROM node:24-alpine AS build
WORKDIR /app

ENV npm_config_audit=false \
    npm_config_fund=false

# Dependencies first, in their own layer: this only re-runs when package.json or
# package-lock.json actually change, so ordinary source edits reuse the cached
# install (both locally and via the GitHub Actions layer cache).
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

COPY . .
# CI runners have plenty of RAM — this was 2560 only to fit the small EC2 box that
# used to run the build. Monaco + pdf.js + vue-flow need the headroom.
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# Production stage — Nginx with envsubst for BACKEND_URL
FROM nginx:alpine

# Copy built SPA
COPY --from=build /app/dist /usr/share/nginx/html

# Copy Nginx config template (uses $BACKEND_URL variable)
COPY nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 80

# nginx:alpine supports /etc/nginx/templates/*.template
# It auto-runs envsubst on them at startup, outputting to /etc/nginx/conf.d/
# BACKEND_URL must be set as an environment variable
CMD ["nginx", "-g", "daemon off;"]
