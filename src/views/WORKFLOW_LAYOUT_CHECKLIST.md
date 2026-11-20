# Workflow Builder: layout checklist (ADM-1333, plan §3.1, §3.5, §3.6)

Check at `/dashboard/workflow-builder/<id>`, in light and dark, at 1440, 1024, 768 and 375 px wide.
The automated version is `tests/e2e/workflow-builder.spec.js` (`npm run test:workflow:e2e`); this list is for the
eye.

## The page fills the shell (F1)
- [ ] No breadcrumb bar above the canvas, and no help button in the corner (Help is in the toolbar menu).
- [ ] The sidebar is collapsed on this page; leaving the page brings back the person's own sidebar setting.
- [ ] Neither the page nor the shell's centre column scrolls, at any width.

## Toolbar (one floating row, 12 px from the edges)
- [ ] Left: back, the workflow name (click or F2 to rename; Enter saves, Esc cancels), the status pill
      (Draft / Published vN / Paused) and the save state ("Unsaved changes" is a button that saves).
- [ ] Centre: add a step, Undo, Redo, Tidy up, Fit. Undo and Redo name the step they undo in their label.
- [ ] Right: Test, Run (Stop while a run is live), Publish, and the menu: Save, Discard changes, Validate, Versions,
      Pause or Resume triggers, Duplicate, Outline, Shortcuts, Help, Archive.
- [ ] At 375 px the row keeps back, the name, Run and the menu; everything else is in the menu.
- [ ] There is no second tools row, no run banner, no left palette and no right inspector.

## Canvas
- [ ] Dot grid every 16 px; dragged steps snap to it.
- [ ] The minimap shows at the bottom left while the canvas moves and fades out 1 s after it stops.
- [ ] A graph with many steps only draws what is on screen (pan to check that steps appear as they come in).
- [ ] An empty workflow shows "Build your first workflow" with starter steps and "Browse every step".

## Node picker
- [ ] Opens from: the toolbar +, an output's +, a connection's +, a connection dropped on empty canvas, N, Tab (on the
      empty canvas), Ctrl/⌘+K. Ctrl/⌘+K never opens the shell's own command palette as well.
- [ ] Search box focused; arrow keys and Enter choose; Recent first; tabs for each category, Tools and MCP.
- [ ] Every matching tool is listed (no cut list); a failed tool or MCP load says why and offers Try again.
- [ ] An MCP tool asks for the agent it runs with before it is added.
- [ ] Opened from an output, the new step is connected from that output (the condition's false branch stays false).
- [ ] Opened from a connection's +, the step is inserted between its ends.

## Console (bottom)
- [ ] Collapsed: a 36 px strip with the last run's status and its counts. L toggles it.
- [ ] Open: Log, Runs and Timeline tabs (arrow keys move between tabs). Resize from the top edge with the pointer or,
      focused, with the arrow keys (Home and End for the limits).
- [ ] Runs: 50 at a time with "Load more runs"; a run opens in the Timeline and on the canvas without touching the live
      run; "Back to the live view" returns.
- [ ] A run waiting on an approval step shows Approve and Reject in the strip. A run waiting on a sub-workflow shows
      "Waiting for sub-workflow run #N" with a link to the sub-workflow, and no approval prompt.
- [ ] Below 1024 px the console opens as a bottom sheet.

## Keyboard (the Shortcuts sheet lists them)
- [ ] Keys do nothing while typing in a field, except Ctrl/⌘+S, Ctrl/⌘+K and Ctrl/⌘+Enter.
- [ ] Esc in a field only leaves the field; otherwise it closes the top panel, then clears the selection.
- [ ] Ctrl/⌘+C, X, V, D work with Caps Lock on; copied steps paste into another workflow tab.
- [ ] Delete removes every selected step and connection after one question; Ctrl/⌘+Z brings them back.
- [ ] Arrow keys on a focused step go to the neighbouring step; Alt+arrow moves the selection by one grid square.

## Accessibility
- [ ] Steps and connections are reachable with Tab; a step reads as "<Kind> step, <name>, <state>".
- [ ] The Outline (menu) lists every step in run order; Up and Down move, Enter opens.
- [ ] Every icon button has a name; dialogs and sheets keep focus inside and give it back on close.
- [ ] Text is 4.5:1 or more in both themes; with reduced motion nothing pulses or spins.
