// The models a Find objects step (vision.model) may use (ADM-1351): GET /api/workflow-graphs/<id>/vision-models/,
// read once per workflow and kept for the page's session. A failed read is not kept, so Retry asks again. The list
// is the server's: the models of the person's Training Data projects that can answer, and the ready models.
import { reactive } from 'vue'
import api from '@/services/api'

// graphId -> { loading, error, models: [{ value, label, kind }] | null, pending }
const byGraph = reactive({})

function entry(graphId) {
  const key = String(graphId)
  if (!byGraph[key]) byGraph[key] = { loading: false, error: '', models: null, pending: null }
  return byGraph[key]
}

/** The reactive state of a workflow's model list (it starts empty and not loading). */
export function visionModelsState(graphId) { return entry(graphId) }

/** Load a workflow's model list unless it is loaded or loading. Never throws: a failure is in `error`. */
export function loadVisionModels(graphId, { force = false } = {}) {
  const e = entry(graphId)
  if ((e.models && !force) || e.pending) return e.pending || Promise.resolve(e.models)
  e.loading = true
  e.error = ''
  e.pending = api.getWorkflowVisionModels(graphId).then(({ data }) => {
    if (!data || !Array.isArray(data.models)) throw new Error('The server sent the model list in a shape this page does not read.')
    e.models = data.models.filter((m) => m && m.value !== undefined && m.value !== null && m.value !== '')
    return e.models
  }).catch((err) => {
    const d = err?.response?.data
    e.error = (d && (d.error || d.detail)) || (err?.response ? `The models could not be loaded (error ${err.response.status}).` : (err?.message && !/network/i.test(err.message) ? err.message : 'The models could not be loaded. Check your connection.'))
    return null
  }).finally(() => { e.loading = false; e.pending = null })
  return e.pending
}

/** For tests: forget every list. */
export function resetVisionModels() { for (const k of Object.keys(byGraph)) delete byGraph[k] }
