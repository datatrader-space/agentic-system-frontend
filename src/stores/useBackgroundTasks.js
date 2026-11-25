// The Coding Agent's background work in a Let's Code chat, like Claude Code's `/tasks` (ADM-1360 release,
// agentic-docs/CODING_AGENT_BACKGROUND_WORK_PLAN.md section 3): commands, servers, subagents, workflows, watchers,
// wake-ups and recurring schedules, each one row the server keeps (`agent.BackgroundTask`, id a UUID string).
//
// The Let's Code page creates one controller and provides it (BACKGROUND_TASKS). The chat panel (UnifiedAgentChat)
// tells it which chat is on screen and hands it the socket's `background_task` frames; the count pill above the
// composer, the popover / phone sheet, the bottom panel's Tasks tab and the chat's event cards all read it. Nothing
// else provides it, so the main chat has no panel and its event cards have no Open.
//
// Kept small on purpose: this file is imported by the chat panel. The HTTP calls are in services/backgroundTasksApi.js,
// fetched with the first call (a lazy chunk), never in this file.
import { reactive, markRaw } from 'vue'

export const BACKGROUND_TASKS = 'backgroundTasks'

// A task in one of these still runs (a wake-up or a schedule is waiting for its time): it can be stopped.
export const isActive = (task) => !!task && task.state === 'running'

const loadApi = () => import('@/services/backgroundTasksApi').then((m) => m.default)

function newestFirst(a, b) {
  const ta = Date.parse(a.started_at || '') || 0
  const tb = Date.parse(b.started_at || '') || 0
  return tb - ta
}

// What a frame or a list row says about a task, as one TASK. The frame of the API contract is
// `{type: 'background_task', conversation_id, task}`; a flat frame (the task's fields on the frame itself) is read too.
export function taskOfFrame(frame) {
  if (!frame || typeof frame !== 'object') return null
  const task = frame.task && typeof frame.task === 'object' ? frame.task : frame
  if (task.id == null || task.id === '') return null
  if (task === frame) {
    const { type: _type, conversation_id: _cid, ...rest } = frame
    return rest
  }
  return task
}

export function createBackgroundTasks({ api = null } = {}) {
  const getApi = api ? () => Promise.resolve(api) : loadApi
  const ctl = reactive({
    // The chat on screen (a conversation id, as a string), or '' for a new chat not sent yet.
    conversationId: '',
    // conversation id -> its tasks, newest first.
    byConversation: {},
    loading: false,
    loadError: '',
    // The task whose Stop is being sent (its id), or ''.
    stopping: '',
    // task id -> why its Stop was refused (a 409 `{error}`: it cannot be stopped), shown in its row.
    stopErrors: {},
    // The popover (desktop) or bottom sheet (phone) from the count pill.
    sheetOpen: false,
    // The task opened from a row or an event card, shown in the side drawer: a TASK, or null.
    opened: null,
    // What the polite live region says: a task's state changed.
    announcement: '',
    // Where the chat shows a task's start card while its turn's answer is not saved yet: conversation id ->
    // { message key -> [task ids] }, set when its `started` frame arrives (the message on screen then). Kept for this
    // page's visit; once the answer whose run started the task is on screen, `started_in` places the card instead.
    anchors: {},
  })
  let loadSeq = 0

  function listFor(id) {
    const key = id == null ? '' : String(id)
    return (key && ctl.byConversation[key]) || []
  }

  // What the polite live region says. The frame's `event` (started / output / ended / stopped) names the change; a
  // change without one (a list read, a Stop answer) is told by the state it moved to. An output line says nothing.
  function announceChange(before, after, event = '') {
    if (!after) return
    const name = after.name || 'Background task'
    if (event === 'output') return
    if (!before || event === 'started') {
      if (after.state === 'running') ctl.announcement = `${name} started.`
      return
    }
    if (!event && before.state === after.state && before.status === after.status) return
    if (after.state === 'running') {
      if (after.status === 'needs_approval' && before.status !== 'needs_approval') ctl.announcement = `${name} needs you.`
      return
    }
    if (after.state === 'stopped' || event === 'stopped') { ctl.announcement = `${name} stopped.`; return }
    // `finished`, or a state this page does not know: read as ended.
    const failed = ['failed', 'timed_out', 'lost', 'sandbox_stopped'].includes(after.status)
      || (after.exit_code != null && after.exit_code !== '' && Number(after.exit_code) !== 0)
    ctl.announcement = `${name} ${failed ? 'failed' : 'finished'}.`
  }

  Object.assign(ctl, markRaw({
    listFor,
    // The chat on screen changed: its list is read from the server (frames only bring changes).
    setConversation(id) {
      const key = id == null ? '' : String(id)
      if (key === ctl.conversationId) return
      ctl.conversationId = key
      ctl.loadError = ''
      ctl.sheetOpen = false
      ctl.opened = null
      if (key) ctl.load()
    },
    // One task, from a socket frame or a Stop answer: replaced in place by its id, or added.
    upsert(conversationId, task, event = '') {
      const key = conversationId == null || conversationId === '' ? ctl.conversationId : String(conversationId)
      if (!key || !task || task.id == null) return
      const id = String(task.id)
      const list = listFor(key)
      const at = list.findIndex((x) => String(x.id) === id)
      const before = at >= 0 ? list[at] : null
      const merged = before ? { ...before, ...task } : { ...task }
      const next = at >= 0 ? list.map((x, i) => (i === at ? merged : x)) : [merged, ...list].sort(newestFirst)
      ctl.byConversation = { ...ctl.byConversation, [key]: next }
      if (key === ctl.conversationId) announceChange(before, merged, event)
      if (ctl.opened && String(ctl.opened.id) === id) ctl.opened = merged
    },
    // A socket frame of this page: true when it was a background task's (the chat draws nothing for it).
    handleFrame(frame, fallbackConversationId = '') {
      if (!frame || frame.type !== 'background_task') return false
      const task = taskOfFrame(frame)
      if (task) ctl.upsert(frame.conversation_id ?? fallbackConversationId, task, frame.event || '')
      return true
    },
    // GET .../background-tasks/: every task of the chat on screen (the server sends them all, newest first).
    async load() {
      const key = ctl.conversationId
      if (!key) return []
      const seq = ++loadSeq
      ctl.loading = true
      try {
        const client = await getApi()
        const { data } = await client.list(key)
        if (seq !== loadSeq || key !== ctl.conversationId) return listFor(key)
        const tasks = Array.isArray(data?.tasks) ? data.tasks.filter((x) => x && x.id != null) : []
        ctl.byConversation = { ...ctl.byConversation, [key]: tasks.slice().sort(newestFirst) }
        ctl.loadError = ''
        if (ctl.opened) {
          const fresh = tasks.find((x) => String(x.id) === String(ctl.opened.id))
          if (fresh) ctl.opened = fresh
        }
        return ctl.byConversation[key]
      } catch (e) {
        if (seq === loadSeq) ctl.loadError = e?.response?.data?.error || 'The background tasks could not be loaded. Try again in a moment.'
        return listFor(key)
      } finally {
        if (seq === loadSeq) ctl.loading = false
      }
    },
    // POST .../<uuid>/stop/. Asked first in the app's own dialog by the caller; returns
    // { ok, needsApproval, error }. A stop the server must ask the person about (a workflow run) answers
    // `needs_approval: true`: an approval card was sent to the chat. A task that cannot be stopped answers
    // 409 `{error}`: kept for its row (`stopErrors`), and the button is usable again.
    async stop(task) {
      const key = ctl.conversationId
      if (!key || !task || task.id == null || ctl.stopping) return { ok: false }
      ctl.stopping = String(task.id)
      if (ctl.stopErrors[String(task.id)]) {
        const { [String(task.id)]: _gone, ...rest } = ctl.stopErrors
        ctl.stopErrors = rest
      }
      try {
        const client = await getApi()
        const { data } = await client.stop(key, task.id)
        if (data?.task) ctl.upsert(key, data.task)
        return { ok: true, needsApproval: data?.needs_approval === true }
      } catch (e) {
        const err = e?.response?.data?.error
        const error = (typeof err === 'string' ? err : err?.message) || 'The task was not stopped.'
        ctl.stopErrors = { ...ctl.stopErrors, [String(task.id)]: error }
        return { ok: false, error, status: e?.response?.status }
      } finally {
        ctl.stopping = ''
      }
    },
    // The chat's live card for a task that just started goes under this message (its key on screen).
    anchor(conversationId, messageKey, taskId) {
      const key = conversationId == null || conversationId === '' ? ctl.conversationId : String(conversationId)
      if (!key || messageKey == null || messageKey === '' || taskId == null) return
      const id = String(taskId)
      const byMessage = ctl.anchors[key] || {}
      if (Object.values(byMessage).some((ids) => ids.includes(id))) return
      const mk = String(messageKey)
      ctl.anchors = { ...ctl.anchors, [key]: { ...byMessage, [mk]: [...(byMessage[mk] || []), id] } }
    },
    open(task) { if (task) ctl.opened = task },
    closeOpened() { ctl.opened = null },
    openSheet() { ctl.sheetOpen = true },
    closeSheet() { ctl.sheetOpen = false },
    reset() {
      loadSeq++
      ctl.conversationId = ''
      ctl.byConversation = {}
      ctl.loading = false
      ctl.loadError = ''
      ctl.stopping = ''
      ctl.stopErrors = {}
      ctl.sheetOpen = false
      ctl.opened = null
      ctl.announcement = ''
      ctl.anchors = {}
    },
  }))
  return ctl
}

// The chat's start cards of the chat on screen: message key -> its tasks (oldest first), each task once.
//   - `started_in` (the public run id of the turn that started it) names the answer: the first assistant message on
//     screen whose `runId` is it. It survives a reload.
//   - Not on screen yet (that turn's answer is saved after the task starts): the live anchor of its `started` frame.
//   - `started_in: null`: no start card (the list and the finish card only). A task the server sent without the field
//     at all keeps its live anchor.
export function startCardsByMessage(ctl, messages) {
  const out = {}
  if (!ctl || !ctl.conversationId) return out
  const answerOf = new Map()
  for (const m of messages || []) {
    if (m && m.role === 'assistant' && m.runId && !answerOf.has(String(m.runId))) answerOf.set(String(m.runId), String(m.id))
  }
  const liveAt = {}
  for (const [mk, ids] of Object.entries(ctl.anchors[ctl.conversationId] || {})) for (const id of ids) liveAt[id] = mk
  const startedAt = (t) => Date.parse(t.started_at || '') || 0
  const list = ctl.listFor(ctl.conversationId).slice().sort((a, b) => startedAt(a) - startedAt(b))
  for (const t of list) {
    if (t.started_in === null) continue
    const key = (t.started_in != null && t.started_in !== '' && answerOf.get(String(t.started_in))) || liveAt[String(t.id)]
    if (key == null) continue
    if (!out[key]) out[key] = []
    out[key].push(t)
  }
  return out
}

// A wake-up or a schedule that is `running` is waiting for its time: it is "Scheduled", not running.
export const isScheduledKind = (task) => !!task && (task.kind === 'wakeup' || task.kind === 'schedule')

// The tasks of the chat on screen, for the pill and the tab: all of them, how many still run, how many wait for their
// time (a wake-up or a schedule), and how many of the running ones wait for the person (an approval).
export function counts(ctl) {
  const list = ctl ? ctl.listFor(ctl.conversationId) : []
  const active = list.filter(isActive)
  return {
    total: list.length,
    running: active.filter((x) => !isScheduledKind(x)).length,
    scheduled: active.filter(isScheduledKind).length,
    needsYou: active.filter((x) => x.status === 'needs_approval').length,
  }
}
