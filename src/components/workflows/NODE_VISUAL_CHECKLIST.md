# Workflow Node — Visual QA Checklist (Phase 2B)

Manual checks for `WfNode.vue` (pure logic is covered by `scripts/wf_node_view_smoke.mjs`).
Open `/dashboard/workflow-builder/<id>` and verify on the canvas.

## Category colors (left stripe + top accent + icon tint)
- [ ] **Trigger** nodes — teal `#0d9488`
- [ ] **Agent** (`agent.run`) — indigo `#4f46e5`
- [ ] **Action** nodes — violet `#7c3aed`
- [ ] **Logic** nodes — slate `#64748b`
- [ ] Left stripe, top border, and icon background all share the category accent.

## Status indicators (header dot + border treatment) — subtle, no heavy gradients
- [ ] **idle / unconfigured** — grey hollow dot, **dashed** grey border, “⚠ Needs setup” chip
- [ ] **configured** (set, not yet run) — blue dot, solid neutral border
- [ ] **pending** (run queued) — amber dot
- [ ] **running** — green dot pulsing + soft green glow animation
- [ ] **waiting / approval** — amber dot pulsing + soft amber glow
- [ ] **success** — green dot, faint green border
- [ ] **failed** — red dot, faint red border
- [ ] **skipped** — grey dot, node dimmed (~70% opacity)
- [ ] **invalid** (validation `__error`) — red dot, dashed red border, red “⚠ <error>” chip
- [ ] Hover any dot → tooltip shows the human label (Ready / Running / Waiting / approval / …).

## Compact config preview (mono chip under the header)
- [ ] **schedule** → `cron 0 8 * * *`
- [ ] **http** → `POST api.host.com/path` (host+path, query stripped; templated URL shows raw)
- [ ] **tool** → tool name; **MCP** → `server.tool`
- [ ] **agent** → `output: json/schema` (only when non-text)
- [ ] **condition** → expression; **delay** → `wait 30s`
- [ ] **foreach** → items source; **approval** → approvers; **subworkflow** → graph name
- [ ] Long values truncate with ellipsis (no wrap/overflow).

## Selected / hover / handles
- [ ] **Selected** node — brand violet border + 3px violet ring (overrides status border).
- [ ] **Handles**: inbound (left, slate), outbound (right, category accent); grow ~1.25× on node hover.
- [ ] **Condition** node shows green `true` (top-right) + red `false` (bottom-right) labelled handles.
- [ ] **Failable** nodes (action.* / agent.run / foreach / approval) show amber `on error` handle (bottom).
- [ ] **Quick-add (+)**: appears bottom-right on hover; click → command palette opens and the chosen node is **auto-connected** from this node (edge created), placed to the right.

## Regression (must be UNCHANGED)
- [ ] Node IDs, `data` shape, edges, and saved graph JSON are identical (no new keys written by visuals).
- [ ] Drag from palette, connect, select, delete, run, and the Data Picker all still work.
- [ ] Backend execution / runtime untouched.
