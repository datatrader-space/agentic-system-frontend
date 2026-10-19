# Current integration status

Phase 4 started on owner instruction. Project screens still use sample data. The top-bar Backend connection button performs an explicit GET /api/auth/me through the isolated Vite proxy to http://localhost:8001. Only this GET is allowed; no project writes are connected. Open http://localhost:5174/training-data/ to share the localhost cookie hostname with the existing sign-in. The proxy is development-only; production routing is not configured. No credentials are stored by the adapter.

See docs/PHASE_4_STATUS.md for verified results and blocking contracts. Historical prototype notes follow.

# Training data — independent UI preview

Phase 2 prototype in progress, not approved. All content is synthetic; no backend requests or durable writes are made.

From `E:\agentic-system-frontend`:

```powershell
node node_modules/vite/bin/vite.js --config training-data/vite.config.mjs
```

Open http://127.0.0.1:5174/training-data/ . The server binds only to loopback and fails if the port is occupied. Do not stop another server to free the port.

Build separately:

```powershell
node node_modules/vite/bin/vite.js build --config training-data/vite.config.mjs
```

Output: `training-data/dist`. Existing installed Vue/Vite/Lucide dependencies are reused. No package installation or shared scripts/configuration changes are required. The independent configuration disables parent PostCSS plugins, uses its own root and has no API proxy.

## Included

- Independent HTML document, Vue root, CSS tokens and hash navigation.
- Workspace and contextual project navigation; narrow-screen drawer.
- Projects preview with synthetic room illustrations, search, sorting, grid/list modes and an empty result state.
- Reusable buttons, badges and native modal dialog with validation and focus restoration.
- UI foundation gallery for actions, status, fields, empty states and feedback.
- Temporary project cards; refresh restores original fixtures.

The full-page New Project flow and project entry/upload are now available for review. Remaining screens are still pending within Phase 2. See docs/PHASE_2_STEP_REVIEW.md for exact scope and checks.

## Boundaries

Never edit backend files, commit or push. Do not modify AADML, shared routing, root package/configuration or Django templates. Keep new code inside this folder. Existing `localhost:5173/training-data/` routing remains unchanged. Backend integration requires the later approved phases and the decisions in [BACKEND_GAPS.md](docs/BACKEND_GAPS.md).

See [Phase 2 verification](docs/PHASE_2_VERIFICATION.md) and [the plan](PLAN.md).

## Complete prototype review

Open http://127.0.0.1:5174/training-data/#projects. See [screen review and screenshots](docs/SCREEN_REVIEW.md). All behavior is local to the browser; refresh resets preview data. Phase 2 awaits Sajid's review. Backend integration has not started.

State checks: `node --test training-data/tests/previewState.test.mjs`.
