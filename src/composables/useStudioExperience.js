import { computed, inject, ref, watch } from 'vue'
import { useVideoStore } from '../stores/useVideoStore'
import { useChatStore } from '../stores/useChatStore'
import { clearStudioDraftMemory } from '../services/studioDraftMemory'

// Preferences contain no prompts, files or signed URLs, and are scoped to the signed-in person.
export function useStudioExperience(page, handoffMode = null) {
  const video = useVideoStore(), chat = useChatStore(), user = inject('studioUser', ref(null))
  const person = computed(() => user.value?.id ? String(user.value.id) : '')
  let restoring = false
  watch(person, (id, previous) => {
    if (previous && id !== previous) clearStudioDraftMemory()
    restoring = true
    let mode = ['agent','manual'].includes(handoffMode) ? handoffMode : 'agent'
    try { if (!handoffMode && id && localStorage.getItem(`aadml.studio.mode.${id}`) === 'manual') mode = 'manual' } catch { /* memory only */ }
    video.studioMode = mode; chat.studioMode = mode
    restoring = false
  }, { immediate: true, flush: 'sync' })
  watch(() => video.studioMode, mode => {
    chat.studioMode = mode
    if (!restoring && person.value) try { localStorage.setItem(`aadml.studio.mode.${person.value}`, mode) } catch { /* memory only */ }
  }, { flush: 'sync' })
  const hintHidden = ref(false)
  const hintKey = computed(() => person.value ? `aadml.studio.hint.${person.value}.${page}` : '')
  watch(hintKey, key => { try { hintHidden.value = !!key && localStorage.getItem(key) === 'dismissed' } catch { hintHidden.value = false } }, { immediate: true })
  function dismissHint() { hintHidden.value = true; try { if (hintKey.value) localStorage.setItem(hintKey.value, 'dismissed') } catch { /* memory only */ } }
  return { isAgent: computed(() => video.studioMode === 'agent'), hintHidden, dismissHint }
}
