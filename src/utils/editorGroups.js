// The Let's Code editor's two groups and their tabs (ADM-1322), as VS Code's editor groups: every tab is in one group
// (`tab.group`: 0, the first, or 1, the one opened to the side), and in a group the pinned tabs come first. A tab is in
// ONE group at a time, so a file's unsaved text is in one place only: "Open to the side" moves it.
//
// One list holds every tab (CodeBrowser's `openTabs`): a group is a view of it, in the list's order with the pinned
// tabs first. A tab is moved in that list, so everything that walks every open tab (a reload, a rename, the unsaved
// count) is unchanged by the groups.

export const GROUPS = Object.freeze([0, 1])

/** The group a tab is in. A tab without one (just opened) is in the first. */
export const groupOf = (tab) => (tab && tab.group === 1 ? 1 : 0)

/** A group's tabs as its tab row shows them: the pinned ones first, each part in the list's order. */
export function tabsOfGroup(tabs, g) {
  const mine = (tabs || []).filter((t) => groupOf(t) === g)
  return [...mine.filter((t) => t.pinned), ...mine.filter((t) => !t.pinned)]
}

/** A Review or merge tab holds what its own view has not saved (comments, a merge result): it stays in its group. */
export const canMoveGroup = (tab) => !!tab && ['file', 'diff', 'image'].includes(tab.type)

/**
 * Move one tab in the list: into group `group`, before the tab `beforeId` (null: at the end of the group). Dropped
 * among the pinned tabs it is pinned, among the others it is not (as VS Code's). Returns the new list, or the same
 * list when nothing moves (an unknown tab, or one that cannot change group).
 */
export function moveTab(tabs, id, { group, beforeId = null } = {}) {
  const list = [...(tabs || [])]
  const from = list.findIndex((t) => t.id === id)
  if (from === -1) return tabs
  const tab = list[from]
  const to = group === 1 ? 1 : 0
  if (to !== groupOf(tab) && !canMoveGroup(tab)) return tabs
  if (beforeId === id) return tabs
  const before = beforeId == null ? null : list.find((t) => t.id === beforeId && groupOf(t) === to) || null
  list.splice(from, 1)
  tab.group = to
  if (before) {
    tab.pinned = !!before.pinned
    list.splice(list.indexOf(before), 0, tab)
  } else {
    // The end of the group: after its last tab of the same kind (pinned or not), which is where its row shows it.
    list.push(tab)
  }
  return list
}

/** One place left or right in its group's row (the pinned and the other tabs each keep to their part). */
export function stepTab(tabs, id, dir) {
  const tab = (tabs || []).find((t) => t.id === id)
  if (!tab) return tabs
  const row = tabsOfGroup(tabs, groupOf(tab)).filter((t) => !!t.pinned === !!tab.pinned)
  const at = row.indexOf(tab)
  const next = row[at + (dir < 0 ? -1 : 1)]
  if (!next) return tabs
  const list = [...tabs]
  list.splice(list.indexOf(tab), 1)
  const n = list.indexOf(next)
  list.splice(dir < 0 ? n : n + 1, 0, tab)
  return list
}

/** The tabs "Close others" closes: the group's other tabs that are not pinned. */
export function othersToClose(tabs, id) {
  const tab = (tabs || []).find((t) => t.id === id)
  if (!tab) return []
  return tabsOfGroup(tabs, groupOf(tab)).filter((t) => t.id !== id && !t.pinned)
}

/** The tabs "Close to the right" closes: the ones after it in its group's row that are not pinned. */
export function rightToClose(tabs, id) {
  const tab = (tabs || []).find((t) => t.id === id)
  if (!tab) return []
  const row = tabsOfGroup(tabs, groupOf(tab))
  return row.slice(row.indexOf(tab) + 1).filter((t) => !t.pinned)
}
