// A person's saved (favourite) Studio looks. The server is the source, so the list is the same on every device:
// GET /api/video/preferences/ -> {favorite_looks: [ids]}; PUT replaces the whole list (lowercase ids of letters,
// digits and hyphens, at most 200, order kept). Older builds kept the list in this browser only; that copy is
// uploaded once when the server's list is empty, then removed.
import { inject, provide, ref, watch } from 'vue'
import api from '../services/api'
import { notify } from './useNotify'
import { studioLooks } from '../services/studioLooks'
const key = Symbol('studio-saved-looks')
const MAX = 200, ID = /^[a-z0-9-]+$/
const clean = list => Array.isArray(list) ? [...new Set(list.filter(id => typeof id === 'string' && ID.test(id)))].slice(0, MAX) : []
const refusal = (err, fallback) => err?.response?.data?.error?.message || fallback

export function provideStudioSavedLooks(user) {
  const ids = ref([]), ready = ref(false), error = ref(''), allowed = new Set(studioLooks.map(look => look.id))
  // The list the server last confirmed: a refused save goes back to it.
  let confirmed = [], sequence = 0, refusals = 0, saving = Promise.resolve()
  const legacyKey = id => id ? `aadml.studio.saved-looks.${id}` : ''
  function readLegacy(id) { try { return clean(JSON.parse(localStorage.getItem(legacyKey(id)) || '[]')).filter(look => allowed.has(look)) } catch { return [] } }
  function dropLegacy(id) { try { localStorage.removeItem(legacyKey(id)) } catch { /* nothing kept */ } }

  async function load(person) {
    const seq = ++sequence
    ids.value = []; confirmed = []; ready.value = false; error.value = ''; saving = Promise.resolve()
    if (!person) return
    try {
      const { data } = await api.get('/video/preferences/')
      if (seq !== sequence) return
      let list = clean(data?.favorite_looks), shown = null
      const legacy = readLegacy(person)
      if (!list.length && legacy.length) {
        try {
          const { data: saved } = await api.put('/video/preferences/', { favorite_looks: legacy })
          if (seq !== sequence) return
          list = clean(saved?.favorite_looks ?? legacy); dropLegacy(person)
        } catch (err) {
          if (seq !== sequence) return
          error.value = refusal(err, 'Could not move your saved templates to your account.'); notify.error(error.value)
          // The browser copy stays and is still shown; the next accepted save carries it to the account.
          shown = legacy
        }
      } else if (legacy.length) dropLegacy(person)   // the account already has a list: it is the source
      confirmed = list; ids.value = [...(shown || list)]; ready.value = true
    } catch (err) {
      if (seq === sequence) error.value = refusal(err, 'Could not load your saved templates.')
    }
  }
  watch(() => user.value?.id, id => load(id ? String(id) : ''), { immediate: true })

  // Saves go one after another so the server ends on the person's last choice.
  function toggle(id) {
    if (!allowed.has(id) || !ready.value) return
    const seq = sequence, epoch = refusals, person = String(user.value?.id || '')
    const next = ids.value.includes(id) ? ids.value.filter(value => value !== id) : [...ids.value, id]
    if (next.length > MAX) { error.value = `You can save up to ${MAX} templates.`; notify.error(error.value); return }
    ids.value = next; error.value = ''
    saving = saving.then(async () => {
      // A refused earlier save makes this one stale: it was built on the change the server did not keep.
      if (seq !== sequence || epoch !== refusals) return
      try {
        const { data } = await api.put('/video/preferences/', { favorite_looks: next })
        if (seq !== sequence) return
        confirmed = clean(data?.favorite_looks ?? next); dropLegacy(person)
        if (ids.value === next) ids.value = [...confirmed]
      } catch (err) {
        if (seq !== sequence) return
        refusals++; ids.value = [...confirmed]
        error.value = refusal(err, 'Could not save your templates.'); notify.error(error.value)
      }
    })
    return saving
  }
  const saved = { ids, ready, error, toggle, reload: () => load(user.value?.id ? String(user.value.id) : '') }
  provide(key, saved); return saved
}
export function useStudioSavedLooks() { return inject(key, { ids: ref([]), ready: ref(false), error: ref(''), toggle() {}, reload() {} }) }
