// One page of a list at a time, for the Learning Monitor's tables and feeds. The rows are already loaded (the
// API sends the latest 50-200 of each list); this only decides which of them are on screen.
import { computed, reactive, ref, unref, watch } from 'vue'

export const PAGE_SIZES = [10, 15]

// `resetOn` is what makes it a different list — the loaded report or snapshot. A new one (another agent,
// another window) starts at page 1; a row leaving the same list (a judged practice) keeps the page, only never
// past the last one.
export function usePaged (rows, { size = PAGE_SIZES[0], resetOn = null } = {}) {
  const page = ref(1)
  const pageSize = ref(size)
  const list = computed(() => unref(rows) || [])
  const total = computed(() => list.value.length)
  const pages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
  const visible = computed(() => list.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))

  if (resetOn) watch(resetOn, () => { page.value = 1 })
  watch(pageSize, () => { page.value = 1 })
  watch(pages, (n) => { if (page.value > n) page.value = n })

  return reactive({ page, pageSize, total, pages, visible })
}
