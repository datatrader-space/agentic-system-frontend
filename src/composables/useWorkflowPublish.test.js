// The builder's Publish (ADM-1351 phase 4): the server is asked what uses the workflow first; a live stream makes it ask
// the person; a failed check publishes nothing and offers Try again.
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/services/api', () => ({ default: {} }))

import { useWorkflowPublish } from './useWorkflowPublish'

const NOTHING = { items: [], counts: { stream: 0, batch: 0, app: 0, trigger: 0, parent: 0 }, not_shown: { stream: 0, batch: 0, app: 0 }, total: 0, confirm: false, message: 'Nothing runs this workflow now.', notes: [] }
const TRIGGERS = { ...NOTHING, items: [{ kind: 'trigger', id: 't1', name: 'Webhook', state: 'active', version: null }], counts: { ...NOTHING.counts, trigger: 1 }, total: 1, message: 'Connected Apps, triggers and workflows that run this one as a sub-workflow use the new version from their next run.' }
const STREAM = { ...NOTHING, items: [{ kind: 'stream', id: 5, name: 'Shelves: Aisle 3', state: 'running', version: 2 }], counts: { ...NOTHING.counts, stream: 1 }, total: 1, confirm: true, message: '1 live stream uses this workflow (version 2).' }

function setup(answer) {
  const api = { getWorkflowGraphImpact: vi.fn(answer) }
  const doc = { publish: vi.fn(async () => true) }
  return { api, doc, flow: useWorkflowPublish(86, doc, { api }) }
}
const fail = (status, data) => Object.assign(new Error('x'), { response: { status, data } })

describe('useWorkflowPublish', () => {
  it('nothing uses it: publishes at once, with the plain message', async () => {
    const { api, doc, flow } = setup(async () => ({ data: NOTHING }))
    expect(await flow.start()).toBe(true)
    expect(api.getWorkflowGraphImpact).toHaveBeenCalledWith(86)
    expect(doc.publish).toHaveBeenCalledWith(undefined)
    expect(flow.state.open).toBe(false)
  })

  it('used, but no question: publishes at once and says what uses it', async () => {
    const { doc, flow } = setup(async () => ({ data: TRIGGERS }))
    expect(await flow.start()).toBe(true)
    expect(doc.publish).toHaveBeenCalledWith({ note: `Used by 1 trigger. ${TRIGGERS.message}` })
    expect(flow.state.open).toBe(false)
  })

  it('a live stream: asks first; Publish anyway publishes, with no second check', async () => {
    const { api, doc, flow } = setup(async () => ({ data: STREAM }))
    expect(await flow.start()).toBe(false)
    expect(doc.publish).not.toHaveBeenCalled()
    expect(flow.state).toMatchObject({ open: true, phase: 'confirm', impact: STREAM })
    const publishing = flow.confirmPublish()
    expect(flow.state.phase).toBe('publishing')
    expect(flow.busy.value).toBe(true)
    expect(await publishing).toBe(true)
    expect(doc.publish).toHaveBeenCalledTimes(1)
    expect(api.getWorkflowGraphImpact).toHaveBeenCalledTimes(1)
    expect(flow.state).toMatchObject({ open: false, phase: 'idle' })
  })

  it('a live stream: Cancel publishes nothing', async () => {
    const { doc, flow } = setup(async () => ({ data: STREAM }))
    await flow.start()
    flow.cancel()
    expect(flow.state).toMatchObject({ open: false, phase: 'idle' })
    expect(await flow.confirmPublish()).toBe(false)
    expect(doc.publish).not.toHaveBeenCalled()
  })

  it('the check fails: says why in the server words, publishes nothing; Try again checks again', async () => {
    const answers = [() => Promise.reject(fail(503, { error: 'The check is not available right now.' })), () => Promise.resolve({ data: NOTHING })]
    const { api, doc, flow } = setup(() => answers.shift()())
    expect(await flow.start()).toBe(false)
    expect(flow.state).toMatchObject({ open: true, phase: 'error', error: 'What uses this workflow could not be checked: The check is not available right now.' })
    expect(doc.publish).not.toHaveBeenCalled()
    expect(await flow.retry()).toBe(true)
    expect(api.getWorkflowGraphImpact).toHaveBeenCalledTimes(2)
    expect(doc.publish).toHaveBeenCalledTimes(1)
    expect(flow.state.open).toBe(false)
  })

  it('without the server words: the status, or the connection', async () => {
    const { flow } = setup(async () => { throw fail(500, '<html>') })
    await flow.start()
    expect(flow.state.error).toBe('What uses this workflow could not be checked (error 500).')
    const offline = setup(async () => { throw new Error('Network Error') }).flow
    await offline.start()
    expect(offline.state.error).toBe('What uses this workflow could not be checked. Check your connection and try again.')
  })

  it('Cancel while Try again is checking: the late answer neither asks nor publishes', async () => {
    let resolve
    const answers = [() => Promise.reject(fail(503, {})), () => new Promise((r) => { resolve = r })]
    const { doc, flow } = setup(() => answers.shift()())
    await flow.start()
    const again = flow.retry()
    expect(flow.state.phase).toBe('checking')
    flow.cancel()
    resolve({ data: STREAM })
    expect(await again).toBe(false)
    expect(flow.state).toMatchObject({ open: false, phase: 'idle' })
    expect(doc.publish).not.toHaveBeenCalled()
  })

  it('a second press while checking does nothing', async () => {
    let resolve
    const { api, flow } = setup(() => new Promise((r) => { resolve = r }))
    const first = flow.start()
    expect(await flow.start()).toBe(false)
    resolve({ data: NOTHING })
    await first
    expect(api.getWorkflowGraphImpact).toHaveBeenCalledTimes(1)
  })

  it('a failed publish closes the question (doc.publish has said why) and resolves false', async () => {
    const { doc, flow } = setup(async () => ({ data: STREAM }))
    doc.publish.mockResolvedValueOnce(false)
    await flow.start()
    expect(await flow.confirmPublish()).toBe(false)
    expect(flow.state).toMatchObject({ open: false, phase: 'idle' })
  })
})
