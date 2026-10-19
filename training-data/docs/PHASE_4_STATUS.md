# Phase 4 status — 2026-10-15

Owner: Sajid. Authorization: "ok start phase 4" in this thread. In progress; core integration BLOCKED, not complete.

## Implemented

- Isolated read-only session adapter for existing GET /api/auth/me.
- Same-origin credentials, no stored tokens, no bearer keys, no response-body logging. Only a bounded display name is retained in memory; identity never grants project permissions.
- Explicit Backend connection dialog; no automatic requests. Reject redirects, HTML, invalid JSON/schema, 401/403, server errors and timeouts. Existing sample state is not changed by a successful session check.
- Development-only exact session route proxy to local backend 127.0.0.1:8001. Other /api/ paths and unsafe methods are rejected before proxying. No CSRF, CORS, TLS or auth controls relaxed. No production target or routing configured.

## Assessment and implementation boundary

Integration overall is high impact (photos, permissions, consent and writes). This increment is restricted to a read-only local identity check. Risk: mistaking login HTML for success, treating admin identity as project permission, leaking response details or submitting synthetic data. Mitigations: strict response validation, discard extra identity fields, clear preview separation, no mutation APIs connected. No deployment. Rollback: remove BackendConnection import/control and restore the dedicated Vite config; leave unrelated prototype work intact.

## Source re-check

training_models_data/urls.py exposes machine ingestion/prediction API routes, not session project/bootstrap reads. views.project_list still renders HTML; upload/batch/editor bootstrap gaps G01–G04 remain. JSON label writes exist but cannot be safely wired without authenticated photo dimensions, shapes, permission and state bootstrap. Do not scrape HTML, guess identifiers, use machine keys or create a backend workaround.

## Actual checks

- node --test training-data/tests/session.test.mjs training-data/tests/previewState.test.mjs: 9 passed, 0 failed.
- node node_modules/vite/bin/vite.js build --config training-data/vite.config.mjs: passed.
- Local proxy GET /api/auth/me: HTTP 500 text/plain. Direct local backend check on port 8001: no HTTP response (000). No response bodies or credentials captured.
- Browser: connection dialog and unavailable-backend error verified.
- Authenticated session success, CSRF priming, cross-tenant/object authorization, uploads and save/reload: NOT RUN. Required before connected workflow readiness.

## Needed to continue core workflows

Confirm the intended running development backend URL and synthetic test environment. Existing project/photo/batch structured reads and upload structured outcomes must be supplied or separately implemented by backend ownership; no such backend changes are authorized in this task. Until then, keep these screens explicitly in preview mode. No invitations or other external messages sent; no backend/shared frontend edits, commits, pushes or deployments.

## Backend availability re-check ? 2026-10-15

Owner confirmed http://localhost:8001. Updated only the isolated development proxy target to that address. Direct localhost and 127.0.0.1 checks now return HTTP 403 application/json without credentials; localhost:5174 proxy returns the same. This verifies reachability and rejection of an unauthenticated request, not authenticated access. Earlier unavailability is resolved. Use http://localhost:5174/training-data/ with the existing localhost sign-in. Authenticated integration and G01?G04 contract gaps remain unverified/unresolved. No backend changes.
