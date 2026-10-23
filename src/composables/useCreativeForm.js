import { ref, onBeforeUnmount } from 'vue'
export function useCreativeForm() {
  const busy = ref(false), error = ref(null)
  let disposed = false
  onBeforeUnmount(() => { disposed = true })
  async function run(action) {
    if (busy.value || disposed) return
    busy.value = true; error.value = null
    try { return await action(() => !disposed) }
    catch (e) { if (!disposed) error.value = e.response?.data?.error || { message: e.message || 'The request failed. Try again.' } }
    finally { if (!disposed) busy.value = false }
  }
  return { busy, error, run }
}
