# Workflow step card: visual checklist (ADM-1333, plan §3.2)

`WfNode.vue` draws one step. The automated checks are `WfNode.test.js` (state to look and words) and
`tests/e2e/workflow-builder.spec.js` (in a browser, both themes). Check by eye in light and dark.

## Card
- [ ] 200 × 64 px. A trigger has a rounded left edge.
- [ ] A 36 px category tile on the left with the type's Lucide icon, in one colour per category: trigger emerald,
      AI violet, action blue, logic slate, media amber (`--wf-cat-*` tokens).
- [ ] A bold title on one line (the person's name for the step, else the type's name), cut with an ellipsis.
- [ ] ONE badge line: the model, the trigger kind, the tool, or "Needs setup" (amber, with an icon). No fields and no
      notes on the card; every setting is in the node window.

## Run state (run state comes from useWorkflowRun only; the words are the engine's: C2)
| State | Look |
|---|---|
| idle / ready | plain border (idle says "Needs setup") |
| queued | dashed ring, clock badge |
| running | ring that pulses (still with reduced motion), spinning badge |
| waiting | amber ring, hand badge (also while waiting on a sub-workflow run) |
| succeeded | green border, check badge; the outgoing connection turns green with "N items" when the step returned a list |
| failed | red ring, alert badge; the error is on the badge's tooltip and in the node window |
| skipped / cancelled | faded |
| invalid (validation or save) | dashed red border, alert badge, the reason on the tooltip |
- [ ] Every state also has its icon and its word in the step's accessible name, so colour is never the only signal.

## Outputs
- [ ] An output with nothing connected shows a short line ending in +; the + opens the picker and connects the new step.
- [ ] A condition has labelled `true` and `false` outputs, each with its own +; the new connection keeps the branch.
- [ ] The `error` output (bottom, "on error") shows only on the types with reliability settings
      (`WF_RELIABILITY_TYPES` in `wfNodeData.js`).
- [ ] A trigger has no input.

## Hover toolbar
- [ ] Open, Test up to here, Rename, Duplicate, Delete; each with a name and a tooltip. It stays while the pointer moves
      onto it.

## Agent proposals (plan §3.4)
- [ ] A proposed new step is a ghost: dashed green, "+" badge, not draggable, no + or toolbar.
- [ ] A changed step has an amber border and "~"; a step to remove has a dashed red outline and "−".
- [ ] Each marked step and connection has Accept and Reject buttons.

## Connections
- [ ] A 40 px hover target; in the middle a + (insert a step) and a delete button that never pan the canvas.
- [ ] A connection going backwards loops under its source instead of crossing the cards.
