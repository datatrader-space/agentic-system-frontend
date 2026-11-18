// @vitest-environment jsdom
//
// ADM-1302 — the Work timeline's rail: rows in order, IN/OUT open on the row's button (aria-expanded), a long one loads
// whole by its ref, the live status line, subagent nesting, thoughts.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const get = vi.fn()
vi.mock('../../services/api', () => ({ default: { get: (...a) => get(...a) } }))

import WorkTimeline from './WorkTimeline.vue'

const steps = () => [
  { stepId: 'r1', phase: 'reasoning', isPhase: true, reasoningText: 'Read **first**.', status: 'ok', durationMs: 3000 },
  { stepId: 't1', isText: true, text: 'Reading the file.', status: 'ok' },
  { stepId: 'p1', isPhase: true, phase: 'generating', label: 'Generating response', status: 'ok' },
  { stepId: 'step_c1', toolCallId: 'c1', tool: 'CODE_READ_FILE', label: 'Reading a file', status: 'ok', durationMs: 1500,
    input: { path: 'src/app.py' }, output: 'print(1)' },
  { stepId: 'step_c2', toolCallId: 'c2', tool: 'CODE_PATCH_FILE', label: 'Editing a file', status: 'failed',
    reason: 'the step could not be completed', input: { path: 'a.py', edits: [{ find: 'a', replace: 'b' }] }, error: 'no match' },
  { stepId: 'step_a', toolCallId: 'a', tool: 'AGENT', label: 'Working', status: 'ok',
    input: { subagent_type: 'Explore', prompt: 'find it' }, output: JSON.stringify({ tools_used: ['CODE_GREP'] }) },
]

const TEXT_SLOT = `<template #text="{ text, answer }"><p :data-answer="answer">{{ answer ? 'THE ANSWER' : text }}</p></template>`
const mountIt = (props = {}, slots = {}) => mount(WorkTimeline, {
  props: { steps: steps(), finished: true, hasAnswer: true, conversationId: 7, ...props },
  slots: { text: TEXT_SLOT, ...slots },
  attachTo: document.body,
})

beforeEach(() => { get.mockClear(); get.mockImplementation(async () => ({ data: {} })) })

describe('WorkTimeline', () => {
  it('draws every row in order, phases left out, the answer last', () => {
    const w = mountIt()
    expect(w.findAll('[data-test="wt-row"]').map((r) => r.attributes('data-kind')))
      .toEqual(['thought', 'text', 'tool', 'tool', 'subagent', 'answer'])
    expect(w.text()).toContain('Reading the file.')
    expect(w.text()).toContain('THE ANSWER')
    expect(w.text()).not.toContain('Generating response')
    w.unmount()
  })

  it('a tool row is a button showing its name and what it did, and opens to its IN and OUT', async () => {
    const w = mountIt()
    const btn = w.findAll('[data-test="wt-toggle"]')[1]
    expect(btn.element.tagName).toBe('BUTTON')                         // Enter and Space open it, natively
    expect(btn.text()).toContain('CODE_READ_FILE')
    expect(btn.text()).toContain('src/app.py')
    expect(btn.attributes('aria-expanded')).toBe('false')
    await btn.trigger('click')
    expect(btn.attributes('aria-expanded')).toBe('true')
    expect(document.getElementById(btn.attributes('aria-controls'))).not.toBeNull()
    expect(w.get('[data-test="wt-in"]').text()).toContain('"path": "src/app.py"')
    expect(w.get('[data-test="wt-out"]').text()).toBe('print(1)')
    await btn.trigger('click')
    expect(w.find('[data-test="wt-in"]').exists()).toBe(false)
    w.unmount()
  })

  it('a file edit shows its diff in OUT, and a failure says why', async () => {
    const w = mountIt()
    expect(w.text()).toContain('the step could not be completed')
    await w.findAll('[data-test="wt-toggle"]')[2].trigger('click')
    expect(w.get('[data-test="wt-diff"]').text()).toContain('- a')
    expect(w.get('[data-test="wt-diff"]').text()).toContain('+ b')
    expect(w.get('[data-test="wt-out"]').text()).toBe('no match')
    w.unmount()
  })

  it('a subagent row nests what it used', () => {
    const w = mountIt()
    const sub = w.findAll('[data-test="wt-row"]').find((r) => r.attributes('data-kind') === 'subagent')
    expect(sub.text()).toContain('Subagent')
    expect(sub.text()).toContain('Explore: find it')
    expect(sub.get('[data-test="wt-children"]').text()).toContain('CODE_GREP')
    w.unmount()
  })

  it('a thought is folded to how long it took and opens to its words', async () => {
    const w = mountIt()
    const btn = w.findAll('[data-test="wt-toggle"]')[0]
    expect(btn.text()).toContain('Thought for 3.0s')
    await btn.trigger('click')
    expect(w.get('[data-test="wt-thought-text"]').html()).toContain('<strong>first</strong>')
    w.unmount()
  })

  it('a long IN/OUT kept as its ref is loaded whole on expand, from this conversation', async () => {
    const big = 'line\n'.repeat(3000)
    get.mockResolvedValue({ data: { input: { path: 'big.txt' }, output: big } })
    const w = mountIt({ steps: [{ stepId: 'step_b', toolCallId: 'b', tool: 'CODE_READ_FILE', status: 'ok', ioRef: 'step:9',
                                  outputChars: big.length, inputChars: 30 }] })
    await w.get('[data-test="wt-toggle"]').trigger('click')
    await flushPromises()
    expect(get).toHaveBeenCalledWith('/conversations/7/tool-result/', { params: { ref: 'step:9' } })
    expect(w.get('[data-test="wt-out"]').element.textContent).toBe(big)
    expect(w.get('[data-test="wt-in"]').text()).toContain('big.txt')
    w.unmount()
  })

  it('a ref the server no longer has says so', async () => {
    get.mockImplementation(async () => { throw Object.assign(new Error('not found'), { response: { status: 404 } }) })
    const w = mountIt({ steps: [{ stepId: 'step_b', toolCallId: 'b', tool: 'A', status: 'ok', ioRef: 'step:9', outputChars: 9000 }] })
    await w.get('[data-test="wt-toggle"]').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('no longer kept')
    w.unmount()
  })

  it('while the turn works, the status line says what, for how long and how many tokens', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(2026, 10, 18, 12, 0, 12))
      const w = mountIt({ finished: false, hasAnswer: false, running: true, statusLabel: 'Inferring',
                          tokens: 3400, startedAt: new Date(2026, 10, 18, 12, 0, 0).getTime() })
      const line = w.get('[data-test="wt-status"]')
      expect(line.text()).toContain('Inferring…')
      expect(line.text()).toContain('12s')
      expect(line.text()).toContain('3.4k tokens')
      expect(line.find('svg').exists()).toBe(true)                    // a glyph, never an emoji
      expect(w.findAll('[data-test="wt-row"]').map((r) => r.attributes('data-kind'))).not.toContain('answer')
      w.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('no status line once the turn has ended', () => {
    const w = mountIt()
    expect(w.find('[data-test="wt-status"]').exists()).toBe(false)
    w.unmount()
  })

  it('approvals sit on the rail, and the plan goes first when it has no place among the rows', () => {
    const w = mountIt({ planFirst: true }, { pending: '<div class="appr">Approve?</div>', plan: '<div class="plancard">PLAN</div>' })
    const kinds = w.findAll('[data-test="wt-row"]').map((r) => r.attributes('data-kind'))
    expect(kinds[0]).toBe('plan')
    expect(kinds[kinds.length - 1]).toBe('pending')
    expect(w.text()).toContain('PLAN')
    expect(w.text()).toContain('Approve?')
    w.unmount()
  })
})
