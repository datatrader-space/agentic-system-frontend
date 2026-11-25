// The background-tasks controller of a Let's Code chat (ADM-1360 release, CODING_AGENT_BACKGROUND_WORK_PLAN.md 2.4/3):
// the list is read once per chat, socket frames upsert by the task's UUID, Stop answers the task (or that an approval
// card was sent). The HTTP client is the mocked contract.
import { describe, it, expect, vi } from 'vitest'
import { createBackgroundTasks, counts, startCardsByMessage, taskOfFrame } from './useBackgroundTasks'

const U1 = '0b6f1c1e-6a1e-4c1e-9a41-2d0c7f0a0001'
const U2 = '0b6f1c1e-6a1e-4c1e-9a41-2d0c7f0a0002'
const task = (over = {}) => ({
  id: U1, kind: 'command', name: 'npm test', state: 'running', status: '', exit_code: null,
  started_at: '2026-11-24T10:00:00Z', finished_at: null, elapsed_s: 3, output_tail: 'PASS a\n', tail_line: 'PASS a',
  open: { type: 'output', handle: 'h1' }, ...over,
})
const flush = () => new Promise((r) => setTimeout(r, 0))

function make(apiOver = {}) {
  const api = {
    list: vi.fn(() => Promise.resolve({ data: { tasks: [task(), task({ id: U2, kind: 'subagent', name: 'Explore', started_at: '2026-11-24T11:00:00Z',
      open: { type: 'conversation', conversation_id: '901' } })] } })),
    stop: vi.fn((_c, id) => Promise.resolve({ data: { task: task({ id, state: 'stopped', status: 'cancelled' }) } })),
    ...apiOver,
  }
  return { ctl: createBackgroundTasks({ api }), api }
}

describe('the background-tasks controller', () => {
  it('reads the chat on screen once, newest first, and clears when no chat is open', async () => {
    const { ctl, api } = make()
    ctl.setConversation(77)
    await flush()
    expect(api.list).toHaveBeenCalledWith('77')
    expect(ctl.listFor('77').map((t) => t.id)).toEqual([U2, U1])
    ctl.setConversation('77')                       // the same chat: not read again
    expect(api.list).toHaveBeenCalledTimes(1)
    ctl.setConversation('')
    expect(counts(ctl)).toEqual({ total: 0, running: 0, scheduled: 0, needsYou: 0 })
  })

  it('a background_task frame upserts by the task UUID: replaced in place, or added', async () => {
    const { ctl } = make()
    ctl.setConversation('77')
    await flush()
    expect(ctl.handleFrame({ type: 'background_task', conversation_id: 77, task: task({ state: 'finished', status: 'failed', exit_code: 1 }) })).toBe(true)
    const list = ctl.listFor('77')
    expect(list).toHaveLength(2)
    expect(list.find((t) => t.id === U1)).toMatchObject({ state: 'finished', status: 'failed', exit_code: 1, name: 'npm test' })
    const U3 = '0b6f1c1e-6a1e-4c1e-9a41-2d0c7f0a0003'
    ctl.handleFrame({ type: 'background_task', conversation_id: '77', task: task({ id: U3, kind: 'monitor', started_at: '2026-11-24T12:00:00Z' }) })
    expect(ctl.listFor('77').map((t) => t.id)).toEqual([U3, U2, U1])
    expect(ctl.handleFrame({ type: 'chat_message' })).toBe(false)
  })

  it('a frame of another chat (a parked one) goes to that chat, and a flat frame is read too', () => {
    const { ctl } = make()
    ctl.handleFrame({ type: 'background_task', conversation_id: 12, task: task() })
    expect(ctl.listFor('12')).toHaveLength(1)
    expect(counts(ctl).total).toBe(0)                // not the chat on screen
    expect(taskOfFrame({ type: 'background_task', conversation_id: 3, id: U2, kind: 'server', state: 'running' }))
      .toEqual({ id: U2, kind: 'server', state: 'running' })
    expect(taskOfFrame({ type: 'background_task', task: {} })).toBe(null)
  })

  it('counts what still runs: a waiting wake-up or schedule is scheduled, not running', async () => {
    const { ctl } = make({ list: vi.fn(() => Promise.resolve({ data: { tasks: [
      task(), task({ id: U2, kind: 'wakeup', state: 'running' }),
      task({ id: 'c', state: 'finished', status: 'succeeded' })] } })) })
    ctl.setConversation('5')
    await flush()
    expect(counts(ctl)).toEqual({ total: 3, running: 1, scheduled: 1, needsYou: 0 })
  })

  it('a running task waiting for an approval is running, and counted as needing the person', async () => {
    const { ctl } = make({ list: vi.fn(() => Promise.resolve({ data: { tasks: [
      task({ kind: 'subagent', state: 'running', status: 'needs_approval' }),
      task({ id: 'c', state: 'finished', status: 'needs_approval' })] } })) })
    ctl.setConversation('5')
    await flush()
    expect(counts(ctl)).toEqual({ total: 2, running: 1, scheduled: 0, needsYou: 1 })
  })

  it('says state changes in the live region', async () => {
    const { ctl } = make()
    ctl.setConversation('77')
    await flush()
    ctl.upsert('77', task({ state: 'finished', status: 'failed', exit_code: 2 }))
    expect(ctl.announcement).toBe('npm test failed.')
    ctl.upsert('77', task({ id: U2, kind: 'subagent', name: 'Explore', state: 'finished', status: 'succeeded' }))
    expect(ctl.announcement).toBe('Explore finished.')
    ctl.upsert('77', task({ id: 'n', name: 'Watch the log', kind: 'monitor', started_at: '2026-11-25T00:00:00Z' }))
    expect(ctl.announcement).toBe('Watch the log started.')
  })

  it('Stop posts to the task and keeps its answer; needs_approval is passed on', async () => {
    const { ctl, api } = make()
    ctl.setConversation('77')
    await flush()
    const p = ctl.stop(ctl.listFor('77')[1])
    expect(ctl.stopping).toBe(U1)
    expect(await p).toEqual({ ok: true, needsApproval: false })
    expect(api.stop).toHaveBeenCalledWith('77', U1)
    expect(ctl.stopping).toBe('')
    expect(ctl.listFor('77').find((t) => t.id === U1).state).toBe('stopped')

    api.stop.mockImplementationOnce(() => Promise.resolve({ data: { task: task({ id: U2, kind: 'workflow' }), needs_approval: true } }))
    expect(await ctl.stop({ id: U2 })).toEqual({ ok: true, needsApproval: true })
    api.stop.mockImplementationOnce(() => Promise.reject({ response: { status: 409, data: { error: 'It has already ended.' } } }))
    expect(await ctl.stop({ id: U2 })).toEqual({ ok: false, error: 'It has already ended.', status: 409 })
    expect(ctl.stopErrors[U2]).toBe('It has already ended.')
    expect(ctl.stopping).toBe('')                    // the button is usable again
    await ctl.stop({ id: U2 })                       // tried again: the error goes while it is sent
    expect(ctl.stopErrors[U2]).toBeUndefined()
  })

  it('the frame event drives what is said: an output line says nothing, a subagent waiting says it needs you', async () => {
    const { ctl } = make()
    ctl.setConversation('77')
    await flush()
    ctl.announcement = ''
    ctl.handleFrame({ type: 'background_task', conversation_id: 77, event: 'output', task: task({ tail_line: 'PASS b' }) })
    expect(ctl.announcement).toBe('')
    expect(ctl.listFor('77').find((t) => t.id === U1).tail_line).toBe('PASS b')
    ctl.handleFrame({ type: 'background_task', conversation_id: 77, event: 'output',
      task: task({ id: U2, kind: 'subagent', name: 'Explore', status: 'needs_approval' }) })
    expect(ctl.announcement).toBe('')               // an output frame is never read out
    ctl.upsert('77', task({ id: U2, kind: 'subagent', name: 'Explore', status: '' }))
    ctl.upsert('77', task({ id: U2, kind: 'subagent', name: 'Explore', status: 'needs_approval' }))
    expect(ctl.announcement).toBe('Explore needs you.')
    ctl.handleFrame({ type: 'background_task', conversation_id: 77, event: 'stopped', task: task({ state: 'stopped', status: 'cancelled' }) })
    expect(ctl.announcement).toBe('npm test stopped.')
    ctl.handleFrame({ type: 'background_task', conversation_id: 77, event: 'ended',
      task: task({ id: U2, kind: 'monitor', name: 'Wait for ready', state: 'finished', status: 'matched' }) })
    expect(ctl.announcement).toBe('Wait for ready finished.')
  })

  // The chat's start cards: under the answer of the run that started the task (`started_in` == the message's runId,
  // kept after a reload), else under the live frame's anchor; `started_in: null` has none; each task once.
  const RUN = 'run_9f3c2a'
  const msgs = (runOnAnswer) => [
    { id: 'u1', role: 'user', content: 'start the waves' },
    { id: 'a1', role: 'assistant', content: 'Started.', runId: runOnAnswer },
    { id: 'u2', role: 'user', content: 'and now?' },
    { id: 'a2', role: 'assistant', content: 'Still running.', runId: 'run_other' },
  ]
  const ids = (cards) => Object.fromEntries(Object.entries(cards).map(([k, v]) => [k, v.map((t) => t.id)]))

  it('a history load places each card under the answer whose runId is its started_in', async () => {
    const { ctl } = make({ list: vi.fn(() => Promise.resolve({ data: { tasks: [
      task({ started_in: RUN }), task({ id: U2, started_in: RUN, started_at: '2026-11-24T09:00:00Z' })] } })) })
    ctl.setConversation('77')
    await flush()
    expect(ids(startCardsByMessage(ctl, msgs(RUN)))).toEqual({ a1: [U2, U1] })   // oldest first
  })

  it('no answer with that run on screen yet: no card, unless its live frame anchored one', async () => {
    const { ctl } = make({ list: vi.fn(() => Promise.resolve({ data: { tasks: [task({ started_in: RUN })] } })) })
    ctl.setConversation('77')
    await flush()
    expect(startCardsByMessage(ctl, msgs('run_saved_later'))).toEqual({})
    ctl.anchor('77', 'a2', U1)
    expect(ids(startCardsByMessage(ctl, msgs('run_saved_later')))).toEqual({ a2: [U1] })
  })

  it('started_in: null has no start card, even with a live anchor; a task without the field keeps its anchor', async () => {
    const { ctl } = make({ list: vi.fn(() => Promise.resolve({ data: { tasks: [
      task({ started_in: null }), task({ id: U2 })] } })) })
    ctl.setConversation('77')
    await flush()
    ctl.anchor('77', 'a1', U1)
    ctl.anchor('77', 'a1', U2)
    expect(ids(startCardsByMessage(ctl, msgs(RUN)))).toEqual({ a1: [U2] })
  })

  it('live, then a reload: still one card, under the answer of its run', async () => {
    const { ctl } = make({ list: vi.fn(() => Promise.resolve({ data: { tasks: [] } })) })
    ctl.setConversation('77')
    await flush()
    // Live: the answer of the run is not saved yet (no runId on screen); the frame anchors under the newest message.
    ctl.handleFrame({ type: 'background_task', conversation_id: 77, event: 'started', task: task({ started_in: RUN }) })
    ctl.anchor('77', 'a2', U1)
    ctl.anchor('77', 'a1', U1)                       // a second anchor for the same task is ignored
    expect(ids(startCardsByMessage(ctl, msgs('')))).toEqual({ a2: [U1] })
    // The answer is saved and the history read again: the card moves under it, and is shown once.
    expect(ids(startCardsByMessage(ctl, msgs(RUN)))).toEqual({ a1: [U1] })
    // A full page reload: a new controller, no anchors, the list from the server.
    const fresh = make({ list: vi.fn(() => Promise.resolve({ data: { tasks: [task({ started_in: RUN })] } })) }).ctl
    fresh.setConversation('77')
    await flush()
    expect(ids(startCardsByMessage(fresh, msgs(RUN)))).toEqual({ a1: [U1] })
    // Frames keep updating the card's task; another chat shows none of these.
    ctl.handleFrame({ type: 'background_task', conversation_id: 77, event: 'progress', task: task({ started_in: RUN, tokens: 5000 }) })
    expect(startCardsByMessage(ctl, msgs(RUN)).a1[0].tokens).toBe(5000)
    ctl.setConversation('78')
    expect(startCardsByMessage(ctl, msgs(RUN))).toEqual({})
    ctl.reset()
    expect(ctl.anchors).toEqual({})
  })

  it('a failed read shows an error and keeps what it had; the open drawer follows the newer copy', async () => {
    const { ctl, api } = make()
    ctl.setConversation('77')
    await flush()
    ctl.open(ctl.listFor('77')[1])
    ctl.upsert('77', task({ output_tail: 'PASS a\nPASS b\n' }))
    expect(ctl.opened.output_tail).toBe('PASS a\nPASS b\n')
    api.list.mockImplementationOnce(() => Promise.reject(new Error('down')))
    await ctl.load()
    expect(ctl.loadError).toBe('The background tasks could not be loaded. Try again in a moment.')
    expect(ctl.listFor('77')).toHaveLength(2)
  })
})
