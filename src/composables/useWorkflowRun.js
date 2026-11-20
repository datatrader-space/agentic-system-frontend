// Running a workflow from the builder (ADM-1333, plan §4): start, stop, re-run, approve, attach to a live run,
// view a past run, and every node's run state.
//
//   const run = useWorkflowRun(graphId, { ensureSaved: doc.saveIfDirty })
//   run.attach(doc.meta.lastRun)                  // after load: a run still going is picked up again (F10)
//   await run.start({ dryRun: true, untilNode: 'fetch', payload })
//   run.nodeStates.value.fetch?.status            // 'queued' | 'running' | 'waiting' | 'succeeded' | ...
//   run.waitingOn.value                           // held run: { approval, subworkflow, subRunIds, resumeAt } or null
//
// RUN STATE LIVES HERE, keyed by node id (D1 rule 1). It is never written into a node's data. The statuses are the
// engine's own words (contract C2: queued, running, waiting, succeeded, failed, skipped, cancelled); nothing is
// mapped. Each map is REPLACED from the server's `node_runs`, never patched forward, so a node the run did not reach
// (a failed start, a cancel, a test that stops at `until_node`) has no state rather than a stale "running" (F7).
//
// LIVE vs VIEWED (F8). `live` is the run this page started or attached to; Stop and approvals always act on it.
// Opening a past run only changes what the canvas shows (`viewed`); it never replaces the live run.
//
// UPDATES (F18). The run's WebSocket pushes node starts and ends. The full run detail is fetched once after a burst of
// socket events and by a slow reconcile poll (every RECONCILE_MS), not every 1.2 s. A fetch that was in flight when
// the person stopped, re-ran or approved is thrown away and asked again, so a stale "waiting" answer can never stop
// updates after an approval (F19).
//
// END OF RUN (F9). The end is reported once per run SESSION: a re-run of the same run id is a new session and is
// reported again.
import { ref, shallowRef, computed, getCurrentScope, onScopeDispose } from 'vue'
import defaultApi from '@/services/api'
import { notify } from '@/composables/useNotify'
import { usePoller } from '@/composables/usePoller'
import { reconnectingSocket } from '@/utils/reconnectingSocket'
import { RUN_HELD_STATUSES, runStopKind } from '@/utils/workflowRunPolling'

// Contract C2, as the engine sends it (agent/services/workflow_graph/events.py NODE_STATUSES).
export const NODE_RUN_STATUSES = ['queued', 'running', 'waiting', 'succeeded', 'failed', 'skipped', 'cancelled']
export const RECONCILE_MS = 5000
export const SOCKET_FETCH_DELAY_MS = 600

// Contract C1: the reasons a run does not start, with the server's own message preferred.
const START_ERROR_TEXT = {
  unknown_until_node: 'That step is not in the workflow, so the test did not start.',
  already_running: 'This run is still going. Wait for it to finish or stop it first.',
  concurrency_limit: 'Too many runs of this workflow are going at once. Try again when one finishes.',
  queue_unavailable: 'The job queue is not available; the run did not start.',
}

export function parseStartError(e) {
  const status = e?.response?.status || null
  const d = e?.response?.data || {}
  if (Array.isArray(d.errors) && d.errors.length) {
    return { code: 'invalid_graph', status, errors: d.errors, message: d.error || 'The workflow has problems. Fix the marked steps.' }
  }
  const code = typeof d.error === 'string' && START_ERROR_TEXT[d.error] ? d.error : null
  const message = d.detail || (code ? START_ERROR_TEXT[code] : null) || (typeof d.error === 'string' ? d.error : null)
    || (status ? `The run did not start (error ${status}).` : 'The run did not start. Check your connection and try again.')
  return { code, status, errors: [], message }
}

/** { nodeId: { status, error, output, attempt, started_at, finished_at } } from a run's `node_runs` (C3). */
export function nodeStatesFrom(nodeRuns) {
  const out = {}
  for (const nr of nodeRuns || []) {
    if (!nr?.node_id) continue
    out[nr.node_id] = {
      status: nr.status, error: nr.error ?? null, output: nr.output ?? null,
      attempt: nr.attempt ?? null, started_at: nr.started_at ?? null, finished_at: nr.finished_at ?? null,
    }
  }
  return out
}

const LOG_LEVEL = { succeeded: 'success', failed: 'error', cancelled: 'warn', waiting: 'warn' }
const awaitingMedia = (data) => (data?.node_runs || []).some((n) => n?.output?.awaiting_media_job)

/**
 * What a held run waits on, from its run detail (the same rule as the engine's `run_waiting` frame,
 * executor.py `_waiting_payload`): `approval` only for a real decision (an approval step, a gated tool, a budget
 * approval, a media job's card), `subworkflow` with the child run ids when a step waits on a sub-workflow run.
 * A timed delay (`resume_at`) is neither.
 */
export function waitingFromDetail(data) {
  const outputs = (data?.node_runs || []).filter((n) => n?.status === 'waiting').map((n) => n.output || {})
  const subRunIds = outputs.filter((o) => o.awaiting_subworkflow && o.sub_run_id != null).map((o) => o.sub_run_id)
  const decisions = outputs.filter((o) => !o.awaiting_subworkflow && !o.resume_at)
  return { approval: decisions.length > 0, subworkflow: subRunIds.length > 0, subRunIds, resumeAt: data?.resume_at ?? null }
}

/** The same, from a `run_waiting` frame's data. */
export function waitingFromFrame(d) {
  const ids = Array.isArray(d?.sub_run_ids) ? d.sub_run_ids : (d?.sub_run_id != null ? [d.sub_run_id] : [])
  return { approval: !!d?.awaiting_approval, subworkflow: !!d?.awaiting_subworkflow && ids.length > 0, subRunIds: ids, resumeAt: d?.resume_at ?? null }
}

function heldText(runId, status, waiting) {
  if (waiting.subworkflow && !waiting.approval) {
    const ids = waiting.subRunIds.map((id) => `#${id}`).join(', ')
    return `Run #${runId} is waiting for sub-workflow run ${ids}. It continues when that run ends.`
  }
  return `Run #${runId} is ${status}. It continues after a decision or its scheduled delay.`
}

export function useWorkflowRun(graphId, {
  api = defaultApi,
  ensureSaved = async () => true,     // save-if-dirty before a run; false stops the run from starting
  socketFactory = reconnectingSocket,
  onRunEnd = null,                    // (runDetail) => void, once per run session
} = {}) {
  const live = shallowRef(null)       // { id, status, dryRun, untilNode, error }
  const liveNodes = shallowRef({})
  const viewed = shallowRef(null)     // the past run on screen (its full detail), or null
  const viewedNodes = shallowRef({})
  const liveDetail = shallowRef(null) // the live run's latest full detail
  const lastRun = shallowRef(null)    // contract C4: { runId, status, startedAt, finishedAt, draftChangedSince, nodes }
  const starting = ref(false)
  const stopping = ref(false)
  const deciding = ref(false)
  const startError = shallowRef(null) // { code, status, message, errors }
  const log = shallowRef([])          // [{ id, at, level, nodeId, status, text }] for the live session

  const running = computed(() => !!live.value && runStopKind(live.value.status) !== 'final')
  const held = computed(() => !!live.value && RUN_HELD_STATUSES.includes(live.value.status))
  // What the held live run waits on (a decision, or a sub-workflow run): the `run_waiting` frame when one arrived
  // for this wait, else read from the run detail. Null while the run is not held. A parent waiting on a
  // sub-workflow is NOT an approval: no approval prompt is shown for it.
  const waitFrame = shallowRef(null)
  const waitingOn = computed(() => {
    if (!held.value) return null
    return waitFrame.value || waitingFromDetail(liveDetail.value)
  })
  const viewingPast = computed(() => !!viewed.value)
  const nodeStates = computed(() => (viewed.value ? viewedNodes.value : liveNodes.value))
  const shownRun = computed(() => viewed.value || liveDetail.value)

  let session = 0
  let reportedSession = 0
  let actionEpoch = 0
  let logSeq = 0
  let heldGraceUntil = 0
  let logged = new Set()

  function addLog(level, text, nodeId = null, status = null) {
    log.value = [...log.value, { id: ++logSeq, at: new Date().toISOString(), level, nodeId, status, text }]
  }
  function logNode(nodeId, status, detail) {
    const key = `${nodeId}:${status}`
    if (logged.has(key)) return
    logged.add(key)
    addLog(LOG_LEVEL[status] || 'info', `${nodeId}: ${status}${detail ? ` - ${detail}` : ''}`, nodeId, status)
  }

  // ── socket ──
  const socket = socketFactory({ onMessage: (ev) => onSocketMessage(ev) })
  function openSocket(runId) {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    socket.connect(() => `${proto}://${window.location.host}/ws/workflow-graph-run/${runId}/`)
  }

  let fetchTimer = null
  function fetchSoon() {
    if (fetchTimer) return
    fetchTimer = setTimeout(() => { fetchTimer = null; ensurePolling() }, SOCKET_FETCH_DELAY_MS)
  }

  function onSocketMessage(ev) {
    let msg
    try { msg = JSON.parse(ev.data) } catch { return }
    if (!live.value || String(msg.run_id) !== String(live.value.id)) return
    const d = msg.data || {}
    if (d.node_id && (msg.event === 'node_started' || msg.event === 'node_finished')) {
      const status = msg.event === 'node_started' ? 'running' : d.status
      if (NODE_RUN_STATUSES.includes(status)) {
        const prev = liveNodes.value[d.node_id] || {}
        liveNodes.value = { ...liveNodes.value, [d.node_id]: { ...prev, status, error: d.error ?? (status === 'running' ? null : prev.error ?? null) } }
        logNode(d.node_id, status, d.error || '')
      }
    }
    if (msg.event === 'run_waiting') waitFrame.value = waitingFromFrame(d)
    if (msg.event === 'run_started' && live.value && runStopKind(live.value.status) === 'held') {
      waitFrame.value = null
      live.value = { ...live.value, status: 'running' }
    }
    fetchSoon()
  }

  // ── reconcile ──
  async function reconcile({ signal }) {
    for (;;) {
      const runId = live.value?.id
      if (!runId) return null
      const epoch = actionEpoch
      const { data } = await api.get(`/workflow-graph-runs/${runId}/`, { signal })
      // An answer that predates a stop, approval or re-run (or belongs to another run) is asked again.
      if (epoch !== actionEpoch || runId !== live.value?.id) continue
      applyDetail(data)
      return data
    }
  }

  const poller = usePoller(reconcile, {
    interval: RECONCILE_MS,
    maxInterval: 60000,
    stopWhen: (data) => {
      if (!data) return true
      const kind = runStopKind(data.status)
      if (kind === 'final') return true
      // Just after an approval the server may still say "waiting" for a moment: keep asking a little longer.
      return kind === 'held' && !awaitingMedia(data) && Date.now() >= heldGraceUntil
    },
  })

  function ensurePolling() {
    if (!live.value) return
    if (poller.active.value) poller.refresh()
    else poller.start()
  }

  function applyDetail(data) {
    liveDetail.value = data
    live.value = { ...live.value, status: data.status, error: data.error ?? null }
    liveNodes.value = nodeStatesFrom(data.node_runs)
    for (const nr of data.node_runs || []) logNode(nr.node_id, nr.status, nr.error || '')
    const kind = runStopKind(data.status)
    if (kind === 'final') {
      socket.close()
      reportEnd(data)
    } else if (kind !== 'held') {
      // Moving again: a later wait (a second approval) is logged again, and the last wait's frame no longer applies.
      waitFrame.value = null
      for (const key of [...logged]) if (key.startsWith('run:')) logged.delete(key)
    } else {
      const key = `run:${data.status}`
      if (!logged.has(key)) {
        logged.add(key)
        addLog('warn', heldText(data.id ?? live.value.id, data.status, waitFrame.value || waitingFromDetail(data)), null, data.status)
      }
    }
  }

  function reportEnd(data) {
    if (reportedSession === session) return
    reportedSession = session
    const ok = data.status === 'success'
    addLog(ok ? 'success' : 'error', `Run #${data.id ?? live.value?.id}: ${data.status}${data.error ? ` - ${data.error}` : ''}`, null, data.status)
    if (ok) notify.success(`Run #${data.id ?? live.value?.id} finished`)
    else notify.error(`Run #${data.id ?? live.value?.id}: ${data.status}${data.error ? ` - ${data.error}` : ''}`)
    if (onRunEnd) onRunEnd(data)
  }

  function beginSession(run) {
    session += 1
    actionEpoch += 1
    viewed.value = null
    viewedNodes.value = {}
    live.value = { id: run.id, status: run.status || 'queued', dryRun: !!run.dryRun, untilNode: run.untilNode || null, error: null }
    liveDetail.value = null
    liveNodes.value = {}
    waitFrame.value = null
    log.value = []
    logged = new Set()
    openSocket(run.id)
    ensurePolling()
  }

  // ── actions ──
  /** Start a run of the saved draft. Returns { ok, runId } or { ok: false, reason | error }. */
  async function start({ payload = {}, dryRun = false, untilNode = null } = {}) {
    if (starting.value || running.value) return { ok: false, reason: 'running' }
    starting.value = true
    startError.value = null
    try {
      if (!(await ensureSaved())) return { ok: false, reason: 'not_saved' }
      let data
      try {
        ({ data } = await api.runWorkflowGraph(graphId, { payload, dry_run: dryRun, until_node: untilNode }))
      } catch (e) {
        startError.value = parseStartError(e)
        notify.error(startError.value.message)
        return { ok: false, error: startError.value }
      }
      if (!data?.run_id) {
        startError.value = { code: null, status: null, errors: [], message: 'The server did not return a run. Try again.' }
        notify.error(startError.value.message)
        return { ok: false, error: startError.value }
      }
      beginSession({ id: data.run_id, status: data.status, dryRun, untilNode })
      addLog(dryRun ? 'warn' : 'info', untilNode ? `Test up to ${untilNode} started` : (dryRun ? 'Test run started (no real side effects)' : 'Run started'))
      return { ok: true, runId: data.run_id }
    } finally {
      starting.value = false
    }
  }

  /** Re-run a run (the past run on screen, else the live one): failed steps, or from `fromNode`. */
  async function rerun({ runId = viewed.value?.id ?? live.value?.id, fromNode = null } = {}) {
    if (!runId) return { ok: false, reason: 'no_run' }
    if (starting.value || running.value) return { ok: false, reason: 'running' }
    starting.value = true
    startError.value = null
    try {
      if (!(await ensureSaved())) return { ok: false, reason: 'not_saved' }
      let data
      try {
        ({ data } = await api.rerunWorkflowGraphRun(runId, fromNode))
      } catch (e) {
        startError.value = parseStartError(e)
        notify.error(startError.value.message)
        return { ok: false, error: startError.value }
      }
      if (!data?.run_id) {
        startError.value = { code: null, status: null, errors: [], message: 'The server did not return a run. Try again.' }
        notify.error(startError.value.message)
        return { ok: false, error: startError.value }
      }
      beginSession({ id: data.run_id, status: data.status })
      addLog('info', fromNode ? `Re-running from ${fromNode}` : 'Re-running the failed steps')
      return { ok: true, runId: data.run_id }
    } finally {
      starting.value = false
    }
  }

  /** Ask the live run to stop. Never acts on a past run that is only being viewed. */
  async function stop() {
    if (!live.value || !running.value || stopping.value) return false
    stopping.value = true
    try {
      await api.cancelWorkflowGraphRun(live.value.id)
      actionEpoch += 1
      addLog('warn', 'Stop requested. Waiting for the server to confirm.')
      ensurePolling()
      return true
    } catch (e) {
      notify.error(e?.response?.data?.error || 'Could not ask the run to stop. Try again.')
      return false
    } finally {
      stopping.value = false
    }
  }

  /** Approve or reject the live run's waiting approval step. */
  async function decide(nodeId, decision) {
    if (!live.value || deciding.value) return false
    deciding.value = true
    try {
      await api.approveWorkflowGraphRun(live.value.id, nodeId, decision)
      actionEpoch += 1
      waitFrame.value = null
      heldGraceUntil = Date.now() + 2 * RECONCILE_MS
      addLog('info', decision === 'approve' ? `Approved ${nodeId}; the run continues` : `Rejected ${nodeId}`)
      if (!socket.active) openSocket(live.value.id)
      ensurePolling()
      return true
    } catch (e) {
      notify.error(parseStartError(e).message)
      return false
    } finally {
      deciding.value = false
    }
  }

  /** Pick up a run that is still going (the workflow's `last_run` after a reload). Returns true when attached. */
  function attach(summary) {
    if (!summary?.id || live.value) return false
    if (runStopKind(summary.status) === 'final') return false
    beginSession({ id: summary.id, status: summary.status })
    addLog('info', `Run #${summary.id} is ${summary.status}; showing it live.`)
    return true
  }

  /** Show a past run on the canvas without touching the live run. */
  async function openRun(runId) {
    if (live.value && String(runId) === String(live.value.id)) { closeRun(); return true }
    try {
      const { data } = await api.getWorkflowGraphRun(runId)
      viewed.value = data
      viewedNodes.value = nodeStatesFrom(data.node_runs)
      return true
    } catch {
      notify.error('Could not load this run. Try again.')
      return false
    }
  }

  function closeRun() {
    viewed.value = null
    viewedNodes.value = {}
  }

  /** The owner's latest finished run with every node's output (contract C4). */
  async function loadLastRun() {
    const { data } = await api.get(`/workflow-graphs/${graphId}/last-run/`)
    lastRun.value = data?.run_id == null ? null : {
      runId: data.run_id, status: data.status, startedAt: data.started_at ?? null, finishedAt: data.finished_at ?? null,
      draftChangedSince: !!data.draft_changed_since, nodes: nodeStatesFrom(data.node_runs),
    }
    return lastRun.value
  }

  if (getCurrentScope()) onScopeDispose(() => { if (fetchTimer) clearTimeout(fetchTimer) })

  return {
    // state
    live, liveDetail, nodeStates, viewed, viewingPast, shownRun, lastRun, log,
    running, held, waitingOn, starting, stopping, deciding, startError,
    // actions
    start, rerun, stop, decide, attach, openRun, closeRun, loadLastRun,
  }
}
