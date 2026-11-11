// Finding a file of a Let's Code project by name, as Go to file (Ctrl+P) does, and as an `@` mention in the chat does
// (ADM-1205 phases A and E: one copy for both). With nothing typed the list is the files opened most recently; typing
// asks the server for every file whose name matches the last part of what was typed, ranked here (utils/quickOpen).
// Up / Down move through the list, Enter picks, Escape closes.
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import api from '@/services/api'
import { searchTerm, rank, recentFiles } from '@/utils/quickOpen'

/**
 * @param {object} opts
 * @param {() => number} opts.systemId
 * @param {() => number} opts.repoId
 * @param {import('vue').Ref<string>} opts.text  what is being searched for (the name part, without `:line`)
 */
export function useFileSearch({ systemId, repoId, text }) {
  const found = ref([])
  const busy = ref(false)
  const error = ref('')
  const recent = ref([])
  const active = ref(0)
  const listEl = ref(null)
  const highlight = computed(() => searchTerm(text.value))

  const items = computed(() => {
    if (!text.value) return recent.value.map((path) => ({ path, name: path.split('/').pop() }))
    return rank(found.value, text.value)
  })

  let seq = 0
  let timer = null
  async function search() {
    const term = searchTerm(text.value)
    const mine = ++seq
    if (!term) { found.value = []; busy.value = false; return }
    busy.value = true
    error.value = ''
    try {
      const { data } = await api.getRepositoryFiles(systemId(), repoId(), { search: term })
      if (mine !== seq) return
      found.value = (data.entries || []).filter((e) => e.type !== 'directory')
    } catch (e) {
      if (mine !== seq) return
      found.value = []
      error.value = e?.response?.data?.error || 'The files could not be searched.'
    } finally {
      if (mine === seq) busy.value = false
    }
  }
  // The server is asked again only when the searched word changes ("app.py" then "app.py:4" reuses the answer).
  watch(highlight, () => { clearTimeout(timer); timer = setTimeout(search, 120) })
  watch(items, () => { active.value = 0 })
  onBeforeUnmount(() => clearTimeout(timer))

  // A fresh start: the recent files of this project, nothing found yet.
  function reset() {
    found.value = []
    error.value = ''
    recent.value = recentFiles(repoId())
    active.value = 0
  }

  function scroll() {
    nextTick(() => listEl.value?.querySelector?.('.fr-item.on')?.scrollIntoView?.({ block: 'nearest' }))
  }
  // Up / Down / Enter / Escape (Tab picks too when `tabPicks`). Returns true when the key was this list's.
  function onKey(e, { pick, close, tabPicks = false }) {
    const n = items.value.length
    if (e.key === 'ArrowDown') { e.preventDefault(); if (n) active.value = (active.value + 1) % n; scroll(); return true }
    if (e.key === 'ArrowUp') { e.preventDefault(); if (n) active.value = (active.value - 1 + n) % n; scroll(); return true }
    if (e.key === 'Enter' || (tabPicks && e.key === 'Tab')) {
      if (!n && e.key === 'Tab') return false
      e.preventDefault(); pick(items.value[active.value]); return true
    }
    if (e.key === 'Escape') { e.preventDefault(); close(); return true }
    return false
  }

  return { items, found, busy, error, recent, active, highlight, listEl, reset, onKey }
}
