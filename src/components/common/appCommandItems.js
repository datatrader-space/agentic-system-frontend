// Filtering and grouping for AppCommandList (ADM-1333). Pure, so it is tested without a DOM.
//
// The search is plain text matching for a list a person is browsing: every word typed must appear somewhere in the
// item's label, description, badge or keywords (any order, any case). Every matching item is returned; nothing is cut.

function haystack(item) {
  return [item.label, item.description, item.badge, ...(item.keywords || [])]
    .filter((s) => s != null && s !== '')
    .join(' ')
    .toLowerCase()
}

export function filterCommandItems(items, query) {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return items
  return items.filter((item) => {
    const text = haystack(item)
    return words.every((w) => text.includes(w))
  })
}

// [{ id, label, items }] in the order of `groups`; items with no group come first under no heading, and a group not
// listed in `groups` follows the listed ones, headed by its own id. Empty groups are left out.
export function groupCommandItems(items, groups = []) {
  const order = new Map(groups.map((g, i) => [g.id, { index: i, label: g.label }]))
  const buckets = new Map()
  for (const item of items) {
    const key = item.group ?? ''
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(item)
  }
  const sections = [...buckets.entries()].map(([id, list], firstSeen) => {
    const known = order.get(id)
    return {
      id: id || '__ungrouped',
      label: id === '' ? '' : (known ? known.label : id),
      items: list,
      rank: id === '' ? -1 : (known ? known.index : groups.length + firstSeen),
    }
  })
  sections.sort((a, b) => a.rank - b.rank)
  return sections.map(({ rank: _rank, ...s }) => s)
}
