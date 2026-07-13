# Unified Plan UI — Full-Stack Browser Verification Matrix (Phase-3 closure)

**Status:** harness authored; **not executed in the implementation session** (no running full stack —
backend ASGI + Postgres + Redis + frontend dev server + WebSocket — was available headlessly).
The logic underneath every row below is covered by Vitest unit/component/store tests and backend
integration tests; this runbook + the Playwright spec (`unified-plan.matrix.spec.js`) exist so the
matrix can be executed against a real stack.

## Preconditions

```
# backend
UNIFIED_RUN_COORDINATOR_MODE=shadow  python manage.py runserver   # (ASGI/uvicorn in prod)
# frontend
VITE_UNIFIED_PLAN_UI_MODE=enabled    npm run dev
# a test user + agents for each mode; a public agent with is_public=True + public_share_token
```

## Cases (run each; record PASS/FAIL + notes)

For every combination below, drive a real run and verify the checklist.

| # | execution_mode | plan_mode | path forced | expected canonical run_mode |
|---|---|---|---|---|
| 1 | manual | off | System A (TASK) | manual |
| 2 | autonomous | off | System A | autonomous |
| 3 | manual | on | System A | plan_review_manual (known_legacy_gap) |
| 4 | autonomous | on | System A | plan_review_autonomous (known_legacy_gap) |
| 5 | manual | off | System B (plan-mode) | manual |
| 6 | autonomous | off | System B | autonomous |
| 7 | manual | on | System B | plan_review_manual |
| 8 | autonomous | on | System B | plan_review_autonomous |

### Per-case checklist
- [ ] exactly ONE visible plan card (no legacy `PlanApprovalCard` + unified duplicate)
- [ ] authoritative LEGACY state shown; `authoritative_source == "legacy"`
- [ ] canonical shadow state does NOT leak (no `source_run_key`/parity/provenance in the card)
- [ ] plan version + progress correct
- [ ] live step events update the card
- [ ] reload restores the durable snapshot (GET /runs/<run_id>/plan/)
- [ ] disconnect/reconnect restores + continues (cursor honored)
- [ ] duplicate events do not double progress
- [ ] a forced sequence gap triggers snapshot hydration
- [ ] two runs in one conversation render as two separate cards (two run_ids)
- [ ] browser back/forward does not corrupt plan state
- [ ] approval controls appear only when supported + authorized (System A plan-review shows the
      authoritative legacy state = executing; it does NOT falsely present legacy as approval-gated,
      while the backend retains the enforce-blocking `known_legacy_gap`)

### Focused scenarios
- [ ] reconnect while executing
- [ ] reconnect while awaiting approval
- [ ] stale plan opened in two tabs; approve in tab A → tab B shows conflict + refreshes
- [ ] same approval submitted from two tabs (same idempotency key) → single approval, both succeed
- [ ] request changes → new plan version requires new approval
- [ ] completed / failed / paused / rejected / cancelled render correctly

## Surfaces
- [ ] main authenticated chat (ChatWorkspace)
- [ ] Agent Emulator
- [ ] any builder/admin surface using AgentActivityTimeline
- [ ] public widget: read-only, sanitized, no actions; requires the public token

## Responsive & accessibility (desktop + mobile widths)
- [ ] no clipped plan actions; phases/steps readable; progress visible; long titles wrap
- [ ] approval dialog retains focus; keyboard-only approve/reject/request-changes works
- [ ] screen-reader status updates not duplicated (single aria-live)
- [ ] reduced-motion respected; dark + light readable
