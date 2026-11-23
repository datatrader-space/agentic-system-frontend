// The editor's two groups and their tabs (ADM-1322): every tab in one group, pinned tabs first, moves that keep the
// pinned and other tabs apart, and the tabs "Close others" / "Close to the right" leave alone.
import { describe, it, expect } from 'vitest'
import { groupOf, tabsOfGroup, canMoveGroup, moveTab, stepTab, othersToClose, rightToClose } from './editorGroups'

const t = (id, more = {}) => ({ id, type: 'file', name: `f${id}`, ...more })
const ids = (list) => list.map((x) => x.id)

describe('editor groups', () => {
  it('a tab without a group is in the first; a row shows its pinned tabs first, each part in order', () => {
    const tabs = [t(1), t(2, { pinned: true }), t(3, { group: 1 }), t(4), t(5, { pinned: true })]
    expect(groupOf(tabs[0])).toBe(0)
    expect(ids(tabsOfGroup(tabs, 0))).toEqual([2, 5, 1, 4])
    expect(ids(tabsOfGroup(tabs, 1))).toEqual([3])
  })

  it('a file, a diff or a picture can change group; a Review or merge tab cannot', () => {
    expect(['file', 'diff', 'image', 'review', 'merge'].map((type) => canMoveGroup({ type }))).toEqual([true, true, true, false, false])
    const tabs = [t(1), { id: 2, type: 'review' }]
    expect(moveTab(tabs, 2, { group: 1 })).toBe(tabs)                   // refused: nothing moves
    expect(moveTab(tabs, 2, { group: 0, beforeId: 1 }).map((x) => x.id)).toEqual([2, 1])   // in its own row it can
  })

  it('moving a tab: before another, or to the end of a group; dropped among pinned tabs it is pinned', () => {
    let tabs = [t(1), t(2), t(3), t(4, { pinned: true })]
    tabs = moveTab(tabs, 3, { group: 0, beforeId: 1 })
    expect(ids(tabsOfGroup(tabs, 0))).toEqual([4, 3, 1, 2])
    tabs = moveTab(tabs, 2, { group: 0, beforeId: 4 })
    expect(tabs.find((x) => x.id === 2).pinned).toBe(true)
    expect(ids(tabsOfGroup(tabs, 0))).toEqual([2, 4, 3, 1])
    tabs = moveTab(tabs, 2, { group: 0, beforeId: 1 })                 // among the others: no longer pinned
    expect(tabs.find((x) => x.id === 2).pinned).toBe(false)
    tabs = moveTab(tabs, 1, { group: 1 })
    expect(ids(tabsOfGroup(tabs, 1))).toEqual([1])
    expect(ids(tabsOfGroup(tabs, 0))).toEqual([4, 3, 2])
    expect(moveTab(tabs, 99, { group: 1 })).toBe(tabs)
    expect(moveTab(tabs, 3, { group: 0, beforeId: 3 })).toBe(tabs)
  })

  it('a step left or right stays among the pinned or among the others', () => {
    let tabs = [t(1, { pinned: true }), t(2), t(3), t(4, { group: 1 })]
    expect(stepTab(tabs, 2, -1)).toBe(tabs)                            // the first unpinned tab: no further left
    tabs = stepTab(tabs, 2, 1)
    expect(ids(tabsOfGroup(tabs, 0))).toEqual([1, 3, 2])
    tabs = stepTab(tabs, 2, -1)
    expect(ids(tabsOfGroup(tabs, 0))).toEqual([1, 2, 3])
    expect(stepTab(tabs, 4, 1)).toBe(tabs)
  })

  it('"Close others" and "Close to the right" leave pinned tabs and the other group alone', () => {
    const tabs = [t(1, { pinned: true }), t(2), t(3), t(4), t(5, { group: 1 })]
    expect(ids(othersToClose(tabs, 3))).toEqual([2, 4])
    expect(ids(rightToClose(tabs, 2))).toEqual([3, 4])
    expect(ids(rightToClose(tabs, 1))).toEqual([2, 3, 4])
    expect(othersToClose(tabs, 99)).toEqual([])
  })
})
