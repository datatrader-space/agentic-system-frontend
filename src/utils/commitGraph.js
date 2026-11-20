// The commit graph's lanes (ADM-1321), drawn beside the history as VS Code's Source Control Graph and GitLens do.
//
// The history comes newest first, a commit before its parents (`git log --topo-order`), one page at a time. Each lane
// waits for one commit: a branch's line runs down its lane until the commit it waits for, a merge opens a lane for its
// second parent, and lanes waiting for the same commit join at it. A lane never moves sideways, so a page drawn later
// continues the lines of the page before it: `layoutGraph(nextPage, previous.lanes)`.
//
// Each row: { sha, lane, color, width, edges: [{ from, to, half: 'top' | 'bottom', color }] } in lane units. `top`
// edges run from the row's top edge (lane `from`) to the commit's dot (lane `to`), or straight through; `bottom` edges
// run from the dot (or straight through) to the row's bottom edge.

export const LANE_COLORS = 7

/** Lane layout for ``commits`` ({sha, parents}), continuing ``lanes`` (the previous page's `lanes`). */
export function layoutGraph(commits, lanes = [], nextColor = 0) {
  let open = lanes.map((l) => (l ? { ...l } : null))
  let color = nextColor
  const fresh = () => (color++) % LANE_COLORS
  const free = (arr, not = -1) => {
    const i = arr.findIndex((l, k) => !l && k !== not)
    return i < 0 ? Math.max(arr.length, not + 1) : i
  }
  const rows = (commits || []).map((c) => {
    const before = open
    let lane = before.findIndex((l) => l && l.sha === c.sha)
    let tint
    if (lane < 0) {                                 // a branch's newest commit: nothing above waits for it
      lane = free(before)
      tint = fresh()
    } else {
      tint = before[lane].color
    }
    const after = before.slice()
    while (after.length <= lane) after.push(null)
    const edges = []
    before.forEach((l, i) => {
      if (!l) return
      if (l.sha === c.sha) {
        edges.push({ from: i, to: lane, half: 'top', color: l.color })
        after[i] = null                               // every lane waiting for this commit ends at it
      } else {
        edges.push({ from: i, to: i, half: 'top', color: l.color })
      }
    })
    after[lane] = null
    ;(c.parents || []).forEach((p, n) => {
      const waiting = after.findIndex((l) => l && l.sha === p)
      if (waiting >= 0) {                             // already drawn: join that line
        edges.push({ from: lane, to: waiting, half: 'bottom', color: after[waiting].color })
        return
      }
      const at = n === 0 && !after[lane] ? lane : free(after, lane)
      while (after.length <= at) after.push(null)
      after[at] = { sha: p, color: n === 0 ? tint : fresh() }
      edges.push({ from: lane, to: at, half: 'bottom', color: after[at].color })
    })
    after.forEach((l, i) => {                         // the lanes that only pass by
      if (l && before[i] && before[i].sha === l.sha && before[i].sha !== c.sha) {
        edges.push({ from: i, to: i, half: 'bottom', color: l.color })
      }
    })
    while (after.length && !after[after.length - 1]) after.pop()
    open = after
    const width = Math.max(before.length, after.length, lane + 1)
    return { sha: c.sha, lane, color: tint, width, edges }
  })
  return { rows, lanes: open, nextColor: color }
}
