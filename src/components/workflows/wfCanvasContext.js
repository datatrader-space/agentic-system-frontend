// What WfCanvas hands its node and edge components (provide/inject), so a card never reads the run, the document or
// the proposal itself and never changes a node in place (D1 rule 1): it asks the canvas, which asks the page.
//
//   nodeView(id)  -> { state, label, issue, error, mark, ghost, hunk, connected: Set<handle>, running, items }
//   edgeView(id)  -> { mark, ghost, hunk, ran, items }
//   actions: open(id), pick(ctx), testUntil(id), rename(id), duplicate(id), remove(target), accept(i), reject(i)
export const WF_CANVAS = Symbol('wf-canvas')
