// The Coding Agent's background tasks of one chat (ADM-1360 release, CODING_AGENT_BACKGROUND_WORK_PLAN.md section 2.4).
// Only the background-tasks panel uses these calls, so they live here and load with its first call
// (stores/useBackgroundTasks.js imports this file lazily), never in api.js (the first-load bundle and its 200 kB gzip
// budget, scripts/check-bundle-size.mjs). The shared client adds the session cookie and Django's CSRF header.
import api from './api'

const base = (conversationId) => `/lets-code/conversations/${encodeURIComponent(conversationId)}/background-tasks/`

export default {
  // { tasks: [TASK] }, newest first, every task of the chat. TASK = { id (UUID), kind, name, state, status, exit_code,
  // started_at, finished_at, elapsed_s, output_tail, tail_line, open: { type, handle?, conversation_id?,
  // workflow_run_id?, schedule_id? } }. Another person's chat is a 404.
  list: (conversationId, { signal } = {}) => api.get(base(conversationId), { noCache: true, signal }),
  // -> { task, needs_approval? }: a stop that must be approved (a workflow run) sends an approval card to the chat.
  stop: (conversationId, taskId) => api.post(`${base(conversationId)}${encodeURIComponent(taskId)}/stop/`, {}),
}
