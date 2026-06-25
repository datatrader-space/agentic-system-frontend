// Memory Autopilot — render an undoable "Remembered: X" toast when the backend auto-saves memory from a
// turn (the `memory_saved` WS event, pushed to the user_<id> group). Shared by every chat surface so the
// behavior is identical. Clicking the toast calls the undo endpoint (POST /api/memory/forget/).
import api from '@/services/api'
import { notify } from '@/composables/useNotify'

export function showMemorySavedToast(data) {
  const items = Array.isArray(data?.items) ? data.items : []
  for (const it of items) {
    if (!it || !it.id) continue
    notify.success(`🧠 Remembered: ${it.content || 'a note'} — click to undo`, {
      timeout: 8000,
      onClick: async () => {
        try {
          await api.forgetMemory(it.id)
          notify.info('Okay — forgotten.')
        } catch (e) {
          notify.error('Could not undo that memory.')
        }
      },
    })
  }
}

export function useMemoryToast() {
  return { showMemorySavedToast }
}

export default showMemorySavedToast
