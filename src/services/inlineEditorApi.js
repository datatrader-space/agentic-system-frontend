// The Let's Code editor's Ctrl+K inline edit (ADM-1315) and inline code suggestions (ADM-1316). Only the editor uses
// these calls, so they live here and load with it, not in api.js, which every page loads first: api.js is in the
// first-load bundle and its 200 kB gzip budget (scripts/check-bundle-size.mjs) failed the build with them in it.
import api from './api'
import { runProjectJob } from './projectJobs'

const projectBase = (systemId, repoId) => `/systems/${systemId}/repositories/${repoId}`

export default {
  // Inline edit on a selection: one engine turn on the server as a background job, answered as
  // { path, start_line, end_line, replacement, cost_usd, price_usd, conversation_id }. `body` is utils/inlineEdit's
  // `inlineEditRequest`. One runs at a time per project: a press while another runs is refused here (code BUSY),
  // never answered with the other one's change.
  inlineEditSelection: (systemId, repoId, body, opts) => runProjectJob(async () => {
    const res = await api.post(`${projectBase(systemId, repoId)}/inline-edit/`, body)
    if (res?.status === 202 && res.data?.started === false) {
      const err = new Error('Another inline edit is still being made in this project.')
      err.response = { status: 409, data: { error: 'Another inline edit is still being made in this project. Try '
        + 'again when it finishes.', code: 'BUSY' }, headers: {} }
      throw err
    }
    return res
  }, (id) => api.get(`${projectBase(systemId, repoId)}/jobs/${id}/`, { noCache: true }), opts),
  // Inline code suggestions: one per pause in typing, cancelled by the next keystroke.
  // POST { path, prefix, suffix, language } -> { suggestion, cost_usd, spent_today_usd, daily_limit_usd, skipped? };
  // a refusal answers { error, code } (off, daily_limit, balance, budget, no_model, price_missing, model_failed).
  requestInlineCompletion: (repoId, body, { signal } = {}) =>
    api.post(`/lets-code/projects/${repoId}/inline-completion/`, body, { signal }),
  // The person's setting: { enabled, daily_limit_usd, spent_today_usd, resets_at, model: { name } | null }.
  getInlineCompletionSettings: () => api.get('/lets-code/inline-completion/', { noCache: true }),
  saveInlineCompletionSettings: (body) => api.put('/lets-code/inline-completion/', body),   // { enabled?, daily_limit_usd? }
}
