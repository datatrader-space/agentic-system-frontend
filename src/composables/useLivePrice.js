import { onBeforeUnmount, ref, watch } from 'vue'
import api from '../services/api'

// The price of the draft on a page, worked out again a moment after its settings stop changing (UX pass,
// 2026-10-28: the price showed only after "Review estimate"). `body` returns the quote request, or null while the
// draft is not complete; nothing is made, held or saved. The newest answer wins.
export function useLivePrice(body, { wait = 700 } = {}) {
  const price = ref(null), loading = ref(false), problem = ref('')
  let timer = null, seq = 0, gone = false
  watch(() => JSON.stringify(body() ?? null), key => {
    clearTimeout(timer)
    const mine = ++seq
    if (key === 'null') { price.value = null; problem.value = ''; loading.value = false; return }
    loading.value = true
    timer = setTimeout(async () => {
      try {
        const { data } = await api.getStudioQuote(JSON.parse(key))
        if (gone || mine !== seq) return
        price.value = { estimate: Number(data.estimate_usd), most: Number(data.max_usd), status: data.pricing_status }
        problem.value = ''
      } catch (e) {
        if (gone || mine !== seq) return
        price.value = null
        problem.value = e.response?.data?.error?.message || 'The price could not be worked out yet.'
      } finally { if (!gone && mine === seq) loading.value = false }
    }, wait)
  }, { immediate: true })
  onBeforeUnmount(() => { gone = true; clearTimeout(timer) })
  return { price, loading, problem }
}
