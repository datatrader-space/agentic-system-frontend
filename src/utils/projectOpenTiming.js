// How long opening a Let's Code project takes, step by step (ADM-1326, plan G13, decision D3: "ready" is when the
// file tree and the editor answer). The backend keeps one record per open (POST /lets-code/projects/<id>/open/) and
// this adds the steps only the browser sees, each once, in ms after the click:
//
//   project_api      the open answered
//   sandbox_ready    the first file request answered without "the sandbox is starting"
//   tree             the project's top folder listed
//   editor           the first file shown, when one opens with the project (within EDITOR_WINDOW_MS of the tree)
//   language_server  a language server said it is ready (within LSP_WINDOW_MS of the click)
//
// The steps are seen where they already happen: api.js's response hooks call `noteApiResponse` / `noteApiError`,
// and lspClient calls `noteLanguageServer`. Nothing here imports api.js (it is handed in), so there is no cycle.
// `openProgress` drives the one progress line the person sees while waiting; nothing else is shown.

import { ref } from 'vue'

export const EDITOR_WINDOW_MS = 3000
export const LSP_WINDOW_MS = 120000
const FLUSH_DELAY_MS = 300

/** `{ repoId, phase: 'sandbox' | 'files', seconds }` while an open is not ready yet, else null. */
export const openProgress = ref(null)

let current = null
let clock = () => performance.now()

/** Tests: a fake clock. */
export function _setClock(fn) { clock = fn || (() => performance.now()) }
export function _current() { return current }

function since(o) { return Math.max(0, Math.round(clock() - o.t0)) }

function phaseOf(o) {
  if (o.steps.sandbox_ready !== undefined || o.sandbox === 'awake') return 'files'
  return (o.starting || o.sandbox === 'parked' || o.sandbox === 'none') ? 'sandbox' : 'files'
}

function showProgress(o) {
  if (current !== o) return
  openProgress.value = o.steps.tree === undefined
    ? { repoId: o.repoId, phase: phaseOf(o), seconds: Math.floor(since(o) / 1000) }
    : null
}

function flush(o) {
  if (!o.openId || !o.api) return
  const steps = {}
  for (const [k, v] of Object.entries(o.steps)) if (!o.sent.has(k)) steps[k] = v
  const outcome = o.outcome && !o.sentOutcome ? o.outcome : undefined
  if (!Object.keys(steps).length && !outcome) return
  Object.keys(steps).forEach((k) => o.sent.add(k))
  if (outcome) o.sentOutcome = true
  o.api.reportProjectOpen(o.repoId, o.openId, outcome ? { steps, outcome } : { steps }).catch(() => {})
}

function scheduleFlush(o) {
  clearTimeout(o.flushTimer)
  o.flushTimer = setTimeout(() => flush(o), FLUSH_DELAY_MS)
}

function stopTicking(o) {
  clearInterval(o.ticker)
  o.ticker = null
  if (current === o) openProgress.value = null
}

function mark(step) {
  const o = current
  if (!o || o.steps[step] !== undefined) return
  const ms = since(o)
  if (step === 'editor' && (o.steps.tree === undefined ? false : ms - o.steps.tree > EDITOR_WINDOW_MS)) return
  if (step === 'language_server' && ms > LSP_WINDOW_MS) return
  o.steps[step] = ms
  if (step === 'tree') stopTicking(o)
  else showProgress(o)
  scheduleFlush(o)
}

/**
 * The person opened `project` (one of their own, ready). `api` is services/api.js's default export. Ends the
 * previous open as `left` when it was not ready.
 */
export function startOpen(project, api) {
  endOpen()
  const o = { repoId: Number(project.repo_id), t0: clock(), api, openId: null, sandbox: '', starting: false,
    steps: {}, sent: new Set(), outcome: '', sentOutcome: false, flushTimer: null, ticker: null }
  current = o
  o.ticker = setInterval(() => showProgress(o), 1000)
  showProgress(o)
  Promise.resolve()
    .then(() => api.startProjectOpen(o.repoId))
    .then(({ data }) => {
      if (!data || !data.open_id) return
      o.openId = data.open_id
      o.sandbox = data.sandbox || ''
      if (o.steps.project_api === undefined) o.steps.project_api = since(o)
      showProgress(o)
      flush(o)
    })
    .catch(() => { /* not measured; the project opens as always */ })
  return o
}

/** The open ends: the person went back to the projects, or opened another. Not ready yet -> `left`. */
export function endOpen(outcome = 'left') {
  const o = current
  if (!o) return
  current = null
  clearTimeout(o.flushTimer)
  clearInterval(o.ticker)
  openProgress.value = null
  if (o.steps.tree === undefined && !o.outcome) o.outcome = outcome
  flush(o)
}

const FILES = /\/systems\/\d+\/repositories\/(\d+)\/files\/(content\/)?$/

function filesCall(config) {
  const m = FILES.exec(String((config && config.url) || ''))
  if (!m || !current || Number(m[1]) !== current.repoId) return null
  const p = (config && config.params) || {}
  return { content: !!m[2], root: !m[2] && !p.path && !p.search }
}

/** A successful API answer (api.js's response hook). */
export function noteApiResponse(config) {
  const call = filesCall(config)
  if (!call) return
  mark('sandbox_ready')
  if (call.content) mark('editor')
  else if (call.root) mark('tree')
}

/** A failed API answer (api.js's error hook): "starting" is a wait; the tree failing otherwise ends the open. */
export function noteApiError(error) {
  const call = filesCall(error && error.config)
  if (!call || !current) return
  const r = error.response
  if (r && r.status === 503 && r.data && r.data.code === 'RUNNER_STARTING') {
    current.starting = true
    showProgress(current)
    return
  }
  if (call.root && current.steps.tree === undefined) endOpen('error')
}

/** A language server of the project said it is ready (lspClient). */
export function noteLanguageServer(url) {
  const m = /\/ws\/lets-code\/(\d+)\/lsp\//.exec(String(url || ''))
  if (m && current && Number(m[1]) === current.repoId) mark('language_server')
}

// THE HOVER WAKES IT EARLY. The pointer resting on a project's card (HOVER_DWELL_MS), or the card's keyboard focus,
// asks the backend to wake the project's parked sandbox, so a click finds it waking or awake. Asked at most once per
// project per PREFETCH_EVERY_MS from this page; the backend keeps one wake per project and limits each person.
export const HOVER_DWELL_MS = 250
export const PREFETCH_EVERY_MS = 5 * 60 * 1000
const prefetched = new Map()

/** Ask for `project`'s wake (once per PREFETCH_EVERY_MS). Returns whether a request was sent. */
export function prefetchWake(project, api, now = Date.now()) {
  const id = Number(project && project.repo_id)
  if (!id) return false
  const last = prefetched.get(id)
  if (last !== undefined && now - last < PREFETCH_EVERY_MS) return false
  prefetched.set(id, now)
  api.wakeProject(id).catch(() => { /* a hint only: opening the project still starts it */ })
  return true
}

export function _resetPrefetch() { prefetched.clear() }

/** What the progress line says while the open is not ready, in plain words ('' for the first second). */
export function progressLabel(p) {
  if (!p || p.seconds < 1) return ''
  return p.phase === 'sandbox' ? "Waking the project's sandbox…" : 'Loading the files…'
}
