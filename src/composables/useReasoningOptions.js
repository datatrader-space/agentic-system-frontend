// What the chat Effort control may offer for one agent, as the signed-in user runs it.
//
//   { enabled, supported, levels }   from GET /agents/:id/reasoning-options/
//   enabled   — the agent's configuration has reasoning on
//   supported — the model this user runs the agent on can reason at all
//   levels    — the efforts that model's provider accepts (e.g. ['low','medium','high'], xAI ['low','high'])
//
// `null` while unknown (not loaded yet, or the request failed): the control then shows its full legacy range
// rather than hiding a setting the backend may well accept — the runtime applies the same rule regardless.
import { ref, watch } from 'vue'
import api from '../services/api'

export function useReasoningOptions(agentIdGetter) {
  const options = ref(null)
  let seq = 0

  async function reload() {
    const id = agentIdGetter()
    const mine = ++seq
    if (!id) { options.value = null; return }
    try {
      const { data } = await api.getAgentReasoningOptions(id)
      if (mine !== seq) return
      options.value = data && typeof data === 'object'
        ? { enabled: !!data.enabled, supported: !!data.supported, levels: Array.isArray(data.levels) ? data.levels : [] }
        : null
    } catch {
      if (mine === seq) options.value = null
    }
  }

  watch(agentIdGetter, () => { reload() }, { immediate: true })
  return { options, reload }
}
