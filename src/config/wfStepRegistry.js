// Loading the Workflow Builder's step registry (ADM-1351, D4): GET /api/workflow-graphs/step-types/, read once and kept
// for the rest of the page's session (the pattern of components/clip-editor/registry.js). A failed read is not kept,
// so the next call asks again; there is no bundled copy to fall back to.
import api from '@/services/api'
import { setStepRegistry, stepRegistryReady } from './wfNodeDefinitions'

let pending = null     // the read in flight

/** Resolves once the registry is in wfNodeDefinitions; rejects with a sentence a person can read. */
export async function loadStepRegistry({ force = false } = {}) {
  if (stepRegistryReady() && !force) return true
  if (pending && !force) return pending
  const p = api.getWorkflowStepTypes().then(({ data }) => {
    setStepRegistry(data)
    return true
  }).catch((e) => {
    const d = e?.response?.data
    if (e?.response) throw new Error((d && (d.error || d.detail)) || `The step list could not be loaded (error ${e.response.status}).`)
    throw new Error(e?.message && !/network/i.test(e.message) ? e.message : 'The step list could not be loaded. Check your connection.')
  }).finally(() => { if (pending === p) pending = null })
  pending = p
  return p
}

/** For tests: forget the read in flight. */
export function resetStepRegistryLoad() { pending = null }
