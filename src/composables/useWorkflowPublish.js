// The builder's Publish (ADM-1351 phase 4; VISION_WORKFLOWS_PLAN.md 4.6): before a version is published, the server is
// asked what runs the workflow now (GET /api/workflow-graphs/<id>/impact/, components/workflows/wfPublishImpact.js).
//
//   const publishFlow = useWorkflowPublish(graphId, doc)
//   publishFlow.start()          // the Publish button
//
//   * `confirm` true (a live stream uses it): the dialog shows the server's message, what uses the workflow grouped by
//     kind and its notes; "Publish anyway" publishes, Cancel publishes nothing.
//   * `confirm` false: it publishes at once; when something uses the workflow (total > 0) the "Published" message says
//     by what ("Used by 2 triggers.") with the server's message.
//   * the check fails: the dialog says so, with Try again and Cancel. It NEVER publishes without the check.
//
// The publish itself is doc.publish(): it saves the draft first and sends the same request as before.
import { computed, reactive } from 'vue'
import defaultApi from '@/services/api'
import { serverSentence } from '@/utils/workflowAccess'
import { usedBySummary } from '@/components/workflows/wfPublishImpact'

const CHECK_FAILED = 'What uses this workflow could not be checked'

// The server's own words when it sent some ("Not found."), after what failed; otherwise the status or the connection.
function checkError(e) {
  const d = e?.response?.data
  const said = [d?.error, d?.detail].find((v) => typeof v === 'string' && v.trim())
  return said ? `${CHECK_FAILED}: ${said.trim()}` : serverSentence(e, CHECK_FAILED)
}

export function useWorkflowPublish(graphId, doc, { api = defaultApi } = {}) {
  // phase: idle | checking | error | confirm | publishing
  const state = reactive({ open: false, phase: 'idle', impact: null, error: '' })
  const busy = computed(() => state.phase === 'checking' || state.phase === 'publishing')
  // A check the person cancelled (Esc while Try again was checking) must not open the question or publish later.
  let attempt = 0

  async function publishNow(note = '') {
    state.phase = 'publishing'
    const ok = await doc.publish(note ? { note } : undefined)
    state.open = false
    state.phase = 'idle'
    return ok
  }

  /** The Publish button: check, then ask or publish. Resolves true when a version was published. */
  async function start() {
    if (busy.value) return false
    const mine = ++attempt
    state.phase = 'checking'
    state.error = ''
    let impact
    try {
      const { data } = await api.getWorkflowGraphImpact(graphId)
      impact = data || {}
    } catch (e) {
      if (mine !== attempt) return false
      state.impact = null
      state.error = checkError(e)
      state.phase = 'error'
      state.open = true
      return false
    }
    if (mine !== attempt) return false
    state.impact = impact
    if (impact.confirm) {
      state.phase = 'confirm'
      state.open = true
      return false
    }
    const used = usedBySummary(impact)
    return publishNow(used ? `${used} ${impact.message || ''}`.trim() : '')
  }

  /** "Publish anyway" in the dialog: the person read what uses it. */
  function confirmPublish() {
    if (state.phase !== 'confirm') return Promise.resolve(false)
    return publishNow()
  }

  /** Cancel, Esc or the close button: nothing is published. A request in flight is not abandoned half way. */
  function cancel() {
    if (state.phase === 'publishing') return
    attempt += 1
    state.open = false
    state.phase = 'idle'
    state.error = ''
  }

  return { state, busy, start, retry: start, confirmPublish, cancel }
}
