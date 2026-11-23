// A Let's Code chat on its own branch (ADM-1327, backend `chat_worktrees`): push its branch, open its pull request, and
// deploy its Vercel preview. Only the Let's Code page's components use these calls, so they live here and load with
// that page, not in api.js, which every page loads first (its 200 kB gzip first-load budget,
// scripts/check-bundle-size.mjs).
//
// Every call names the chat by id. The server works on THAT chat's own copy of the project, and only for the signed-in
// person's own chat of this project (another one answers 404). The push and the pull request act as the person: their
// own GitHub sign-in, through AADML's git proxy. Production is never deployed from a chat's branch.
import api from './api'
import { runProjectJob } from './projectJobs'

const projectBase = (systemId, repoId) => `/systems/${systemId}/repositories/${repoId}`
const job = (systemId, repoId, start, opts) =>
  runProjectJob(start, (id) => api.get(`${projectBase(systemId, repoId)}/jobs/${id}/`, { noCache: true }), opts)

const chatBranchApi = {
  // The chat's branch, as Source control's push of it (a background job): resolves with { pushed, ... }.
  pushChatBranch: (systemId, repoId, chatId, opts) => job(systemId, repoId,
    () => api.post(`${projectBase(systemId, repoId)}/source-control/push/`, {}, { params: { chat: chatId } }), opts),
  // Its pull request into the branch it was started from: { url, branch, base, existing, preview_url? }. The body
  // names the chat's ready Vercel preview; one that is ready later is commented on the pull request by the server.
  openChatPullRequest: (systemId, repoId, chatId, body, opts) => job(systemId, repoId,
    () => api.post(`${projectBase(systemId, repoId)}/source-control/pull-request/`, body || {}, { params: { chat: chatId } }),
    opts),
  // A Vercel PREVIEW of the chat's own copy (202, the deploy row). The Deploy panel's own endpoint, with `chat_id`.
  deployChatPreview: (repoId, chatId) =>
    api.post(`/lets-code/projects/${repoId}/vercel/deploy/`, { target: 'preview', chat_id: chatId }),
}

// "Open pull request" for one chat's branch: pushed first when GitHub does not have its last commits (the person's
// own press, as Push in Source control), then the pull request. `row` is the branch as the worktrees list gives it.
export async function openPullRequestFor(systemId, repoId, row, { title = '', body = '' } = {}) {
  if (!row.on_remote || row.unpushed > 0) await chatBranchApi.pushChatBranch(systemId, repoId, row.chat_id)
  const label = String(row.chat_title || '').trim()
  return chatBranchApi.openChatPullRequest(systemId, repoId, row.chat_id, {
    title: title || label || row.branch,
    body: body || (label ? `Opened from the Let's Code chat "${label}".` : "Opened from a Let's Code chat."),
  })
}

// What stops "Open pull request" for a branch right now, in words, or '' when it can be pressed.
export function pullRequestBlocker(row) {
  if (!row) return 'This chat has no branch of its own.'
  if (row.working) return 'The chat is working. Try when it stops.'
  if (!row.ahead) return row.changes ? 'Nothing is committed on this branch yet. Ask the agent to commit its changes.'
    : 'Nothing is on this branch yet.'
  return ''
}

export default chatBranchApi
