# Workflow Builder — Resizable Layout QA Checklist (Phase 2C)

Pure prefs logic is covered by `scripts/wf_layout_prefs_smoke.mjs`. Eyeball the rest at
`/dashboard/workflow-builder/<id>`.

## Layout regions
- [ ] Four regions visible: **left palette · center canvas · right inspector · bottom log dock**.
- [ ] Top bar (name / version / Test / Run / Save / Publish) unchanged.

## Resize
- [ ] Drag the divider between **palette ↔ canvas** → palette width changes (clamped 180–420px).
- [ ] Drag the divider between **canvas ↔ inspector** → inspector width changes (clamped 260–560px).
- [ ] Drag the **top edge of the log dock** → log height changes (clamped 120–460px).
- [ ] Sizes **persist after reload** (localStorage `wfb_layout_v1`); private window with blocked storage still works (falls back to defaults, no error).

## Collapse / expand
- [ ] Left **«** tab hides the palette; **»** tab brings it back.
- [ ] Right **»** tab hides the inspector; **«** brings it back.
- [ ] Log **Hide** collapses the dock to a "▴ Run log" reopen pill; clicking reopens. Top-bar **Log** toggles too.
- [ ] Collapsed/expanded state **persists after reload**.

## Left palette
- [ ] Search filters the node list live; clearing restores all.
- [ ] Nodes are grouped by **Triggers / AI · Agents / Actions / Logic** with compact cards (icon + label + sub).
- [ ] Empty search shows "No nodes match …".
- [ ] **Drag** a card to canvas OR **click** to add at centre (both create a normal node).
- [ ] "**＋ Add node**" / "Browse tools & MCP →" open the command-palette modal (tools/MCP catalog).

## Right inspector
- [ ] Selecting a node shows its config; header (`node type` + 🗑) is **sticky** while scrolling.
- [ ] Sections — config → Advanced·reliability → Notes → Output panel → actions — are clearly spaced.
- [ ] Selecting a connection shows the edge-label inspector.
- [ ] With **nothing selected**, the inspector shows the "Nothing selected" empty state (still resizable/collapsible).
- [ ] SchemaForm fields + bespoke inspectors (agent/mcp/foreach/subworkflow/manual/webhook) behave exactly as before.

## Bottom log / output dock
- [ ] Collapsed by default when there's **no run** (reopen pill visible).
- [ ] Header shows a **run status summary** ("No runs yet" / "Run #N · status · 1.2s" / "Running…").
- [ ] Live node logs stream during a run; **Clear** empties them.
- [ ] **Test up to here / Re-run / node Output panel** still work (inspector actions unchanged).

## Canvas empty state
- [ ] On an empty graph: hero card with quick buttons **Manual Trigger · Schedule · Webhook · Agent · HTTP**.
- [ ] Each quick button adds that node via normal creation (selectable, configurable, persists in graph JSON).
- [ ] Hero disappears once any node exists.

## Regression (must be UNCHANGED)
- [ ] Saved graph JSON, node IDs, edges, node data identical (layout prefs live ONLY in localStorage).
- [ ] Execution / MCP / approval / foreach / delay / retry / metrics / versions unchanged.
- [ ] No backend/API change; variable expression syntax unchanged.
