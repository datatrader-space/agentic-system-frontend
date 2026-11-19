// The workspace a Studio page works in (ISSUE-19): the one the Studio menu shows (useWorkspace's active workspace),
// never the first in the list. Picking another on the page switches the menu's workspace too, and a switch in the
// menu moves the page, so the two always agree. In personal mode (no workspace chosen in the menu) nothing is picked
// for the person: the page asks them to choose one.
import { ref, watch } from 'vue'
import { useWorkspace } from './useWorkspace'
import { myWorkspaces } from '../services/studioSharing'

export function useStudioWorkspace({ onChange } = {}) {
  const { activeWorkspace, switchWorkspace } = useWorkspace()
  const workspaces = ref([]), workspaceId = ref(''), loaded = ref(false)
  const current = () => {
    const id = activeWorkspace.value?.id
    return id != null && workspaces.value.some(w => String(w.id) === String(id)) ? String(id) : ''
  }
  async function loadWorkspaces() {
    try { workspaces.value = await myWorkspaces() } catch { workspaces.value = [] }
    workspaceId.value = current(); loaded.value = true
    return workspaceId.value
  }
  // The menu switched: the page follows.
  watch(() => activeWorkspace.value?.id, () => {
    if (!loaded.value) return
    const next = current()
    if (next !== workspaceId.value) { workspaceId.value = next; onChange?.(next) }
  })
  // The page's picker switched: the menu follows (the same switch as the menu's own, without leaving the page).
  function chooseWorkspace(id) {
    const value = String(id || '')
    workspaceId.value = value
    const w = workspaces.value.find(item => String(item.id) === value)
    if (w && String(activeWorkspace.value?.id ?? '') !== value) {
      switchWorkspace({ id: w.id, name: w.name, slug: w.slug }, { id: w.org_id, name: w.org_name, slug: w.org_slug })
    }
    onChange?.(value)
  }
  return { workspaces, workspaceId, loaded, loadWorkspaces, chooseWorkspace }
}
