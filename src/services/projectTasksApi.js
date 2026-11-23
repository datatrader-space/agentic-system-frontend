// Let's Code background tasks (ADM-1328): give the Coding Agent a request or a GitHub issue of the project's repository,
// come back to a pull request; GitHub's webhook brings its failed checks and reviews back as fix turns. Only the Tasks
// panel uses these calls, so they live here and load with it, not in api.js (the first-load bundle and its 200 kB gzip
// budget, scripts/check-bundle-size.mjs).
import api from './api'

const base = (repoId) => `/lets-code/projects/${repoId}/tasks/`

export default {
  // { tasks: [{ task_id, title, state, state_label, pr_url, pr_number, issue_url, branch, fixes_used, fixes_max,
  //   status_reason, conversation_id, created_at }], webhook: { set_up, url?, added_on_github?, events,
  //   last_delivery_at? }, max_auto_fixes, consent }
  list: (repoId, { signal } = {}) => api.get(base(repoId), { noCache: true, signal }),
  // { text?, issue_url? } -> 201 { task }; a refusal answers { error, code }.
  start: (repoId, body) => api.post(base(repoId), body),
  stop: (repoId, taskId) => api.post(`${base(repoId)}${encodeURIComponent(taskId)}/stop/`, {}),
  // { new_secret? } -> the webhook state, plus { secret, github_refused } when the person must add it on GitHub.
  setUpWebhook: (repoId, body = {}) => api.post(`${base(repoId)}webhook/`, body),
}
