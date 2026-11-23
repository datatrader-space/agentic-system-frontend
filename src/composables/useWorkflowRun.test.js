// @vitest-environment jsdom
// useWorkflowRun (ADM-1333): F7, F8, F9, F10, F18 (polling) and F19 (the poller restart race).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { effectScope } from 'vue'

vi.mock('@/services/api', () => ({ default: {} }))
const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }))
vi.mock('@/composables/useNotify', () => ({ notify }))

import { useWorkflowRun, parseStartError, nodeStatesFrom, waitingFromDetail, RECONCILE_MS, SOCKET_FETCH_DELAY_MS } from './useWorkflowRun'

function fakeSocket() {
  const s = { urls: [], handlers: null, active: false }
  s.connect = vi.fn((target) => { s.active = true; s.urls.push(target()) })
  s.close = vi.fn(() => { s.active = false })
  s.factory = (handlers) => { s.handlers = handlers; return s }
  s.push = (event, runId, data) => s.handlers.onMessage({ data: JSON.stringify({ event, run_id: runId, data }) })
  return s
}

const detail = (id, status, nodeRuns = [], extra = {}) => ({ data: { id, status, node_runs: nodeRuns, ...extra } })
const nr = (node_id, status, extra = {}) => ({ node_id, status, attempt: 1, error: null, output: null, ...extra })

function makeApi(overrides = {}) {
  return {
    runWorkflowGraph: vi.fn().mockResolvedValue({ data: { run_id: 10, status: 'queued' } }),
    rerunWorkflowGraphRun: vi.fn().mockResolvedValue({ data: { run_id: 10, status: 'queued' } }),
    cancelWorkflowGraphRun: vi.fn().mockResolvedValue({ data: {} }),
    approveWorkflowGraphRun: vi.fn().mockResolvedValue({ data: {} }),
    getWorkflowGraphRun: vi.fn(),
    get: vi.fn().mockResolvedValue(detail(10, 'running')),
    ...overrides,
  }
}

let scope
function setup({ api = makeApi(), ensureSaved = vi.fn().mockResolvedValue(true), onRunEnd = vi.fn() } = {}) {
  const socket = fakeSocket()
  scope = effectScope()
  const run = scope.run(() => useWorkflowRun('5', { api, ensureSaved, socketFactory: socket.factory, onRunEnd }))
  return { run, api, socket, ensureSaved, onRunEnd }
}
const flush = () => vi.advanceTimersByTimeAsync(0)

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks() })
afterEach(() => { scope?.stop(); vi.useRealTimers() })

describe('helpers', () => {
  it('parses the C1 start errors, preferring the server message', () => {
    const e = (status, data) => ({ response: { status, data } })
    expect(parseStartError(e(503, { error: 'queue_unavailable', detail: 'The job queue is not available; the run did not start.' })))
      .toMatchObject({ code: 'queue_unavailable', status: 503, message: 'The job queue is not available; the run did not start.' })
    expect(parseStartError(e(400, { error: 'unknown_until_node' })).message).toMatch(/not in the workflow/)
    expect(parseStartError(e(409, { error: 'already_running', detail: 'Run 3 is live.' })).message).toBe('Run 3 is live.')
    // ADM-1351: a frame workflow's Run is refused; the server's sentence first, ours when it sends none.
    expect(parseStartError(e(409, { error: 'frame_trigger', detail: 'Choose it when you start a stream.' }))).toMatchObject({ code: 'frame_trigger', status: 409, message: 'Choose it when you start a stream.' })
    expect(parseStartError(e(409, { error: 'frame_trigger' })).message).toBe('This workflow starts on each camera frame: start a stream with it in Training Data.')
    expect(parseStartError(e(400, { error: 'Invalid', errors: [{ node_id: 'a', message: 'x' }] }))).toMatchObject({ code: 'invalid_graph', errors: [{ node_id: 'a', message: 'x' }] })
    expect(parseStartError(new Error('net')).message).toMatch(/did not start/)
  })
  it('keeps the C2 statuses exactly as sent', () => {
    expect(nodeStatesFrom([nr('a', 'succeeded'), nr('b', 'cancelled'), { status: 'x' }])).toEqual({
      a: expect.objectContaining({ status: 'succeeded' }), b: expect.objectContaining({ status: 'cancelled' }),
    })
  })
})

describe('starting a run', () => {
  it('saves first, posts, connects the run socket and reads the detail; nothing is marked pending up front', async () => {
    const { run, api, socket, ensureSaved } = setup()
    const p = run.start({ dryRun: true, untilNode: 'fetch', payload: { a: 1 } })
    expect(run.nodeStates.value).toEqual({})
    await p
    expect(ensureSaved).toHaveBeenCalled()
    expect(api.runWorkflowGraph).toHaveBeenCalledWith('5', { payload: { a: 1 }, dry_run: true, until_node: 'fetch' })
    expect(socket.urls[0]).toMatch(/\/ws\/workflow-graph-run\/10\/$/)
    await flush()
    expect(api.get).toHaveBeenCalledWith('/workflow-graph-runs/10/', expect.anything())
    expect(run.live.value).toMatchObject({ id: 10, status: 'running', dryRun: true, untilNode: 'fetch' })
  })

  it('does not start when saving failed', async () => {
    const { run, api } = setup({ ensureSaved: vi.fn().mockResolvedValue(false) })
    expect(await run.start()).toEqual({ ok: false, reason: 'not_saved' })
    expect(api.runWorkflowGraph).not.toHaveBeenCalled()
  })

  it('F7: a failed start leaves no run and no node state, with the reason', async () => {
    const api = makeApi({ runWorkflowGraph: vi.fn().mockRejectedValue({ response: { status: 503, data: { error: 'queue_unavailable', detail: 'The job queue is not available; the run did not start.' } } }) })
    const { run, socket } = setup({ api })
    const res = await run.start()
    expect(res.ok).toBe(false)
    expect(run.live.value).toBeNull()
    expect(run.running.value).toBe(false)
    expect(run.nodeStates.value).toEqual({})
    expect(run.startError.value.message).toBe('The job queue is not available; the run did not start.')
    expect(socket.connect).not.toHaveBeenCalled()
  })

  it('refuses a second start while one is running', async () => {
    const { run, api } = setup()
    await run.start()
    expect(await run.start()).toEqual({ ok: false, reason: 'running' })
    expect(api.runWorkflowGraph).toHaveBeenCalledTimes(1)
  })
})

describe('node state (F7)', () => {
  it('a test up to a node leaves the nodes after it with no state', async () => {
    const api = makeApi({ get: vi.fn().mockResolvedValue(detail(10, 'success', [nr('trig', 'succeeded'), nr('fetch', 'succeeded')])) })
    const { run } = setup({ api })
    await run.start({ dryRun: true, untilNode: 'fetch' })
    await flush()
    expect(Object.keys(run.nodeStates.value)).toEqual(['trig', 'fetch'])
    expect(run.nodeStates.value.later).toBeUndefined()
    expect(run.running.value).toBe(false)
  })

  it('a cancelled run leaves nothing "running": the map is replaced from the server', async () => {
    const api = makeApi({
      get: vi.fn()
        .mockResolvedValueOnce(detail(10, 'running', [nr('a', 'running')]))
        .mockResolvedValueOnce(detail(10, 'cancelled', [nr('a', 'cancelled')])),
    })
    const { run } = setup({ api })
    await run.start()
    await flush()
    expect(run.nodeStates.value.a.status).toBe('running')
    await run.stop()
    await flush()
    expect(run.nodeStates.value.a.status).toBe('cancelled')
    expect(Object.values(run.nodeStates.value).some((s) => s.status === 'running' || s.status === 'queued')).toBe(false)
  })

  it('an error from the last run is gone after a successful re-run', async () => {
    const api = makeApi({
      get: vi.fn()
        .mockResolvedValueOnce(detail(10, 'failed', [nr('a', 'failed', { error: 'boom' })]))
        .mockResolvedValueOnce(detail(10, 'success', [nr('a', 'succeeded')])),
    })
    const { run } = setup({ api })
    await run.start()
    await flush()
    expect(run.nodeStates.value.a.error).toBe('boom')
    await run.rerun()
    await flush()
    expect(run.nodeStates.value.a).toMatchObject({ status: 'succeeded', error: null })
  })
})

describe('live vs viewed (F8)', () => {
  it('opening a past run shows it without replacing the live run; Stop still stops the live run', async () => {
    const api = makeApi({
      get: vi.fn().mockResolvedValue(detail(10, 'running', [nr('a', 'running')])),
      getWorkflowGraphRun: vi.fn().mockResolvedValue(detail(3, 'failed', [nr('a', 'failed', { error: 'old' })])),
    })
    const { run } = setup({ api })
    await run.start()
    await flush()
    await run.openRun(3)
    expect(run.viewingPast.value).toBe(true)
    expect(run.nodeStates.value.a.status).toBe('failed')
    expect(run.live.value.id).toBe(10)
    await run.stop()
    expect(api.cancelWorkflowGraphRun).toHaveBeenCalledWith(10)
    run.closeRun()
    expect(run.nodeStates.value.a.status).toBe('running')
  })

  // Live check 2026-11-20: a run started by the MCP waited on an approval; opened from Runs it was shown as a PAST run,
  // with no Approve anywhere on the page.
  it('opening a run that has not ended follows it live, so its approval can be decided here', async () => {
    const api = makeApi({
      getWorkflowGraphRun: vi.fn().mockResolvedValue(detail(41, 'waiting', [nr('ok', 'waiting')])),
      get: vi.fn().mockResolvedValue(detail(41, 'waiting', [nr('ok', 'waiting')])),
    })
    const { run, socket } = setup({ api })
    expect(await run.openRun(41)).toBe(true)
    await flush()
    expect(run.viewingPast.value).toBe(false)
    expect(run.live.value.id).toBe(41)
    expect(run.held.value).toBe(true)
    expect(socket.urls.at(-1)).toMatch(/workflow-graph-run\/41\/$/)
    await run.decide('ok', 'approve')
    expect(api.approveWorkflowGraphRun).toHaveBeenCalledWith(41, 'ok', 'approve')
  })

  it('a run that has not ended is only viewed while another run is going; the live run is kept', async () => {
    const api = makeApi({
      get: vi.fn().mockResolvedValue(detail(10, 'running', [nr('a', 'running')])),
      getWorkflowGraphRun: vi.fn().mockResolvedValue(detail(41, 'waiting', [nr('ok', 'waiting')])),
    })
    const { run } = setup({ api })
    await run.start()
    await flush()
    await run.openRun(41)
    expect(run.viewingPast.value).toBe(true)
    expect(run.live.value.id).toBe(10)
  })

  it('opening the live run itself just returns to the live view', async () => {
    const { run, api } = setup()
    await run.start()
    await run.openRun(10)
    expect(api.getWorkflowGraphRun).not.toHaveBeenCalled()
    expect(run.viewingPast.value).toBe(false)
  })
})

describe('re-run (F9)', () => {
  it('reports the end of every run session, even a re-run of the same run id with the same result', async () => {
    const api = makeApi({ get: vi.fn().mockResolvedValue(detail(10, 'success', [nr('a', 'succeeded')])) })
    const { run, onRunEnd } = setup({ api })
    await run.start()
    await flush()
    await vi.advanceTimersByTimeAsync(RECONCILE_MS * 2)
    expect(onRunEnd).toHaveBeenCalledTimes(1)
    await run.rerun()
    await flush()
    expect(onRunEnd).toHaveBeenCalledTimes(2)
    expect(notify.success).toHaveBeenCalledTimes(2)
  })

  it('re-run saves first, refuses while running, and follows the run id the server returns', async () => {
    const ensureSaved = vi.fn().mockResolvedValue(true)
    const api = makeApi({
      get: vi.fn()
        .mockResolvedValueOnce(detail(10, 'running'))
        .mockResolvedValueOnce(detail(10, 'cancelled'))
        .mockResolvedValue(detail(22, 'running')),
      rerunWorkflowGraphRun: vi.fn().mockResolvedValue({ data: { run_id: 22, status: 'queued' } }),
    })
    const { run, socket } = setup({ api, ensureSaved })
    await run.start()
    await flush()
    expect(await run.rerun()).toEqual({ ok: false, reason: 'running' })
    expect(api.rerunWorkflowGraphRun).not.toHaveBeenCalled()
    await run.stop()
    await flush()
    expect(run.running.value).toBe(false)
    ensureSaved.mockClear()
    const res = await run.rerun({ fromNode: 'b' })
    expect(ensureSaved).toHaveBeenCalled()
    expect(api.rerunWorkflowGraphRun).toHaveBeenCalledWith(10, 'b')
    expect(res).toEqual({ ok: true, runId: 22 })
    expect(run.live.value.id).toBe(22)
    expect(socket.urls.at(-1)).toMatch(/workflow-graph-run\/22\/$/)
  })
})

describe('attach on load (F10)', () => {
  it('picks up a run that is still going, so its waiting approval is reachable', async () => {
    const api = makeApi({ get: vi.fn().mockResolvedValue(detail(41, 'waiting', [nr('ok', 'waiting')])) })
    const { run, socket } = setup({ api })
    expect(run.attach({ id: 41, status: 'waiting' })).toBe(true)
    await flush()
    expect(socket.urls[0]).toMatch(/workflow-graph-run\/41\/$/)
    expect(run.nodeStates.value.ok.status).toBe('waiting')
    expect(run.held.value).toBe(true)
    await run.decide('ok', 'approve')
    expect(api.approveWorkflowGraphRun).toHaveBeenCalledWith(41, 'ok', 'approve')
  })
  it('does not attach to a finished run or when there is none', () => {
    const { run } = setup()
    expect(run.attach({ id: 41, status: 'success' })).toBe(false)
    expect(run.attach(null)).toBe(false)
    expect(run.live.value).toBeNull()
  })
})

describe('updates (F18)', () => {
  it('polls slowly: no full fetch every 1.2 s', async () => {
    const { run, api } = setup()
    await run.start()
    await flush()
    expect(api.get).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1200 * 3)
    expect(api.get).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(RECONCILE_MS)
    expect(api.get).toHaveBeenCalledTimes(2)
  })

  it('socket events update node state at once and a burst costs one fetch', async () => {
    const { run, api, socket } = setup()
    await run.start()
    await flush()
    api.get.mockClear()
    socket.push('node_started', 10, { node_id: 'a' })
    expect(run.nodeStates.value.a.status).toBe('running')
    socket.push('node_finished', 10, { node_id: 'a', status: 'succeeded' })
    socket.push('node_started', 10, { node_id: 'b' })
    expect(run.nodeStates.value.a.status).toBe('succeeded')
    expect(api.get).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(SOCKET_FETCH_DELAY_MS)
    expect(api.get).toHaveBeenCalledTimes(1)
  })

  it('ignores frames of another run', async () => {
    const { run, socket } = setup()
    await run.start()
    socket.push('node_started', 99, { node_id: 'a' })
    expect(run.nodeStates.value.a).toBeUndefined()
  })

  it('closes the socket when the run ends', async () => {
    const api = makeApi({ get: vi.fn().mockResolvedValue(detail(10, 'failed', [nr('a', 'failed', { error: 'x' })])) })
    const { run, socket } = setup({ api })
    await run.start()
    await flush()
    expect(socket.close).toHaveBeenCalled()
    expect(notify.error).toHaveBeenCalledWith('Run #10: failed')
  })
})

describe('the poller restart race (F19)', () => {
  it('a fetch in flight during an approval cannot stop updates with its stale "waiting" answer', async () => {
    let resolveStale
    const api = makeApi({
      get: vi.fn()
        .mockResolvedValueOnce(detail(41, 'waiting', [nr('ok', 'waiting')]))     // attach
        .mockImplementationOnce(() => new Promise((r) => { resolveStale = r }))  // in flight when approved
        .mockResolvedValue(detail(41, 'running', [nr('ok', 'succeeded'), nr('next', 'running')])),
    })
    const { run, socket } = setup({ api })
    run.attach({ id: 41, status: 'waiting' })
    await flush()
    expect(run.held.value).toBe(true)
    // A socket event starts a fetch; the person approves while it is in flight.
    socket.push('node_finished', 41, { node_id: 'ok', status: 'waiting' })
    await vi.advanceTimersByTimeAsync(SOCKET_FETCH_DELAY_MS)
    expect(api.get).toHaveBeenCalledTimes(2)
    await run.decide('ok', 'approve')
    resolveStale(detail(41, 'waiting', [nr('ok', 'waiting')]))
    await flush()
    // The stale answer was thrown away and asked again: the run is seen running.
    expect(api.get).toHaveBeenCalledTimes(3)
    expect(run.live.value.status).toBe('running')
    expect(run.nodeStates.value.next.status).toBe('running')
    await vi.advanceTimersByTimeAsync(RECONCILE_MS)
    expect(api.get).toHaveBeenCalledTimes(4)   // still polling
  })

  it('right after an approval a brief "waiting" answer does not stop the poll', async () => {
    const api = makeApi({
      get: vi.fn()
        .mockResolvedValueOnce(detail(41, 'waiting'))
        .mockResolvedValueOnce(detail(41, 'waiting'))
        .mockResolvedValue(detail(41, 'success')),
    })
    const { run } = setup({ api })
    run.attach({ id: 41, status: 'waiting' })
    await flush()
    await run.decide('ok', 'approve')
    await flush()
    expect(run.live.value.status).toBe('waiting')
    await vi.advanceTimersByTimeAsync(RECONCILE_MS)
    expect(run.live.value.status).toBe('success')
  })
})

describe('last run (C4)', () => {
  it('reads the latest finished run with every node output', async () => {
    const api = makeApi({ get: vi.fn().mockResolvedValue({ data: { run_id: 8, status: 'success', draft_changed_since: true, node_runs: [nr('a', 'succeeded', { output: { text: 'hi' } })] } }) })
    const { run } = setup({ api })
    const last = await run.loadLastRun()
    expect(api.get).toHaveBeenCalledWith('/workflow-graphs/5/last-run/')
    expect(last).toMatchObject({ runId: 8, draftChangedSince: true, nodes: { a: { output: { text: 'hi' } } } })
  })
  it('is null when the workflow never finished a run', async () => {
    const { run } = setup({ api: makeApi({ get: vi.fn().mockResolvedValue({ data: { run_id: null } }) }) })
    expect(await run.loadLastRun()).toBeNull()
  })
})

describe('what a held run waits on (run_waiting)', () => {
  it('a parent waiting on a sub-workflow is not an approval; the log names the child run', async () => {
    const sub = nr('child', 'waiting', { output: { awaiting_subworkflow: true, sub_run_id: 77, message: 'Waiting for sub-workflow "B" to finish.' } })
    const api = makeApi({ get: vi.fn().mockResolvedValue(detail(41, 'waiting', [sub])) })
    const { run, socket } = setup({ api })
    run.attach({ id: 41, status: 'waiting' })
    await flush()
    // Read from the run detail before any frame arrived.
    expect(run.waitingOn.value).toEqual({ approval: false, subworkflow: true, subRunIds: [77], resumeAt: null })
    expect(run.nodeStates.value.child.status).toBe('waiting')     // the step keeps the waiting look
    expect(run.log.value.at(-1).text).toBe('Run #41 is waiting for sub-workflow run #77. It continues when that run ends.')
    // The frame is the newer word.
    socket.push('run_waiting', 41, { resume_at: null, awaiting_approval: false, awaiting_subworkflow: true, sub_run_id: 78, sub_run_ids: [78] })
    expect(run.waitingOn.value).toMatchObject({ approval: false, subworkflow: true, subRunIds: [78] })
  })

  it('a real decision says approval; a frame from another run is ignored; moving on clears it', async () => {
    const api = makeApi({ get: vi.fn().mockResolvedValue(detail(41, 'waiting', [nr('ok', 'waiting', { output: { awaiting_approval: true } })])) })
    const { run, socket } = setup({ api })
    run.attach({ id: 41, status: 'waiting' })
    await flush()
    expect(run.waitingOn.value).toMatchObject({ approval: true, subworkflow: false, subRunIds: [] })
    socket.push('run_waiting', 99, { awaiting_approval: false, awaiting_subworkflow: true, sub_run_id: 5 })
    expect(run.waitingOn.value.approval).toBe(true)
    socket.push('run_started', 41, {})
    expect(run.waitingOn.value).toBeNull()                         // not held any more
  })

  it('a timed delay is neither a decision nor a sub-workflow', () => {
    const d = { status: 'waiting', resume_at: '2026-11-20T10:00:00Z', node_runs: [nr('wait', 'waiting', { output: { resume_at: '2026-11-20T10:00:00Z' } })] }
    expect(waitingFromDetail(d)).toEqual({ approval: false, subworkflow: false, subRunIds: [], resumeAt: '2026-11-20T10:00:00Z' })
  })
})
