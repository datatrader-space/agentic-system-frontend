# Frontend Test Baseline (Phase-3 closure)

`npx vitest run` full-suite result on the Phase-3 branch: **210 passed / 32 failed / 242 total**.

## Pre-existing failures (NOT introduced by Phase 3)

These 4 files fail on `main`/HEAD too — verified by stashing all Phase-3 edits and re-running, and
by running each file in **isolation** (they fail alone, so the failures are deterministic and
independent of test ordering and of Phase-3 code). None of them test plan/Phase-3 functionality,
and none import the new plan modules.

| File | Failing | Root cause (pre-existing) |
|---|---|---|
| `chat/ChatComposer.test.js` | 16 | Test-harness: mounts a component that calls a Pinia store in `setup()` without an active Pinia (`getActivePinia()` throws). Missing `createPinia()`/plugin in the mount. |
| `agent/ContextProfilePicker.test.js` | 8 | Stale assertions (`expected false to be true`) — component behavior changed without the test being updated. |
| `components/AgentActivityTimeline.test.js` | 7 | Stale content expectations (e.g. asserts `'Checking Shopify'` label no longer produced). |
| `stores/useChatStore.attachments.test.js` | 1 | Non-hermetic: expects a non-image (`notes.txt`) to have `url: ''`, but the store creates a `blob:` preview URL for it. |

**Total: 32 pre-existing failures.**

## Phase-3 proof of zero new failures

- HEAD baseline (all Phase-3 tracked edits stashed): **4 files / 32 tests failed**.
- Phase-3 branch: **the same 4 files / 32 tests failed** — identical set.
- A `+2` regression that briefly appeared in `useChatStore.attachments.test.js` (an inert
  `_onEvent` addition perturbed the non-hermetic test's ordering) was **eliminated**: `useChatStore.js`
  was reverted to HEAD (zero diff) and live plan updates are now driven from `UnifiedPlanTimeline.vue`
  via a Pinia `$subscribe` — the chat hot path is untouched.
- All Phase-3 / plan tests are green: `usePlanStore`, `UnifiedPlanCard`, `planEvents`,
  `planEvents.contract`, `unifiedPlanConfig`, plus the existing `useChatStore.plan` and
  `PlanApprovalCard`.

## Action for Phase 4

Before deleting the legacy UI, fix these 4 pre-existing test files (mostly a Pinia test-harness
setup + stale assertions) so Phase 4 has a fully-green frontend regression gate. They are recorded
here as the known expected-failure baseline; do not silently exclude them.
