import { computed, onBeforeUnmount, ref, watch } from 'vue'
import api from '../services/api'
import { retryText } from '../components/studio/studioForm'

// The price of the draft on a page, worked out again a moment after its settings stop changing (UX pass,
// 2026-10-28: the price showed only after "Review estimate"). `body` returns the quote request, or null while the
// draft is not complete; nothing is made, held or saved. The newest answer wins.
// An answer can carry adjustments (what the model cannot do as asked, and what it would do instead): when it
// needs_acceptance, the person accepts them before the page asks for the job (`blocked` until then), and the job
// request sends `acceptFields`. A model that cannot be charged for ('not_priced') cannot be used: `blocked` too.
export function useLivePrice(body, { wait = 700 } = {}) {
  const price = ref(null), loading = ref(false), problem = ref(''), code = ref(''), accepted = ref(false)
  let timer = null, seq = 0, gone = false
  watch(() => JSON.stringify(body() ?? null), key => {
    clearTimeout(timer)
    const mine = ++seq
    accepted.value = false
    if (key === 'null') { price.value = null; problem.value = ''; code.value = ''; loading.value = false; return }
    loading.value = true
    timer = setTimeout(async () => {
      try {
        const { data } = await api.getStudioQuote(JSON.parse(key))
        if (gone || mine !== seq) return
        price.value = {
          estimate: Number(data.estimate_usd || 0),
          most: data.max_usd == null ? null : Number(data.max_usd),
          status: data.pricing_status,
          reason: data.reason || '',
          adjustments: Array.isArray(data.adjustments) ? data.adjustments : [],
          needsAcceptance: !!data.needs_acceptance,
        }
        problem.value = ''; code.value = ''
      } catch (e) {
        if (gone || mine !== seq) return
        const refusal = e.response?.data?.error || {}
        price.value = null
        code.value = refusal.code || ''
        problem.value = [refusal.message || 'The price could not be worked out yet.', refusal.retry_after != null ? retryText(refusal.retry_after) : ''].filter(Boolean).join(' ')
      } finally { if (!gone && mine === seq) loading.value = false }
    }, wait)
  }, { immediate: true })
  onBeforeUnmount(() => { gone = true; clearTimeout(timer) })
  const blocked = computed(() => code.value === 'not_priced' || (!!price.value?.needsAcceptance && !accepted.value))
  const acceptFields = computed(() => accepted.value ? (price.value?.adjustments || []).map(a => a.field).filter(Boolean) : [])
  return { price, loading, problem, code, accepted, blocked, acceptFields }
}
