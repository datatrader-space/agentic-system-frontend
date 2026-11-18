// @vitest-environment jsdom
//
// A card's life on screen (ADM-1281 / 1283): Skip moves on and keeps the card; only a card with nothing to answer can be
// closed; "Cancel this step" is a deny with the reason "cancelled by you" through the same answer as Decline; a card
// the run replaced reads so, with no buttons; a Let's Code step names its working copy and its risk.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

import HITLModal from './HITLModal.vue'

const card = (id, over = {}, payload = {}) => ({
  request_id: id, interaction_type: 'approval', response_type: 'binary', urgency: 'high',
  summary: `Run ${id}`, options: [], timeout_at: null, state: 'pending',
  payload: { kind: 'tool_approval', tool_name: 'CODE_RUN_COMMAND', tool_label: 'Running a command', ...payload },
  ...over,
})

const mountCards = (requests) => mount(HITLModal, {
  props: { requests },
  global: { stubs: { teleport: true, transition: false } },
})

describe('a card that waits for an answer', () => {
  it('Skip asks to move on, and says the card stays', async () => {
    const w = mountCards([card('r1'), card('r2')])
    const skip = w.find('[data-test="hitl-skip"]')
    expect(skip.text()).toMatch(/Skip for now \(1 more\)/)
    await skip.trigger('click')
    expect(w.emitted('skip')).toEqual([['r1']])
    expect(w.emitted('dismiss')).toBeUndefined()
  })

  it('cannot be closed, only answered, skipped or cancelled', () => {
    const w = mountCards([card('r1')])
    expect(w.find('[data-test="hitl-close"]').exists()).toBe(false)
  })

  it('"Cancel this step" sends a deny with the reason', async () => {
    const w = mountCards([card('r1')])
    await w.find('[data-test="hitl-cancel-step"]').trigger('click')
    expect(w.emitted('respond')).toEqual([[{ request_id: 'r1', response_value: false, feedback: 'cancelled by you' }]])
  })

  it('a notification can be closed and has nothing to cancel', async () => {
    const w = mountCards([card('n1', { response_type: 'none', interaction_type: 'alert' }, { kind: 'alert' })])
    expect(w.find('[data-test="hitl-cancel-step"]').exists()).toBe(false)
    await w.find('[data-test="hitl-close"]').trigger('click')
    expect(w.emitted('dismiss')).toEqual([['n1']])
  })
})

describe('a card the run replaced', () => {
  it('reads "Replaced" with no buttons', () => {
    const w = mountCards([card('r1', { state: 'superseded' })])
    expect(w.find('[data-test="hitl-replaced"]').text()).toBe('Replaced: the run restarted and asked again.')
    expect(w.findAll('button')).toHaveLength(0)
  })

  it('shows only when nothing else waits', () => {
    const w = mountCards([card('r1', { state: 'superseded' }), card('r2')])
    expect(w.find('[data-test="hitl-replaced"]').exists()).toBe(false)
    expect(w.find('[data-test="hitl-approve"]').exists()).toBe(true)
  })
})

describe("a Let's Code step", () => {
  it("names this chat's branch and the risk", () => {
    const w = mountCards([card('r1', { working_copy: 'chat/3343', risk: 'high' })])
    expect(w.find('[data-test="hitl-working-copy"]').text()).toBe("This chat's branch chat/3343")
    expect(w.find('[data-test="hitl-risk"]').text()).toBe('high risk')
  })

  it("names the project's shared copy", () => {
    const w = mountCards([card('r1', { working_copy: '', risk: 'high' })])
    expect(w.find('[data-test="hitl-working-copy"]').text()).toBe("The project's shared copy")
  })

  it('any other card shows no working copy', () => {
    expect(mountCards([card('r1')]).find('[data-test="hitl-coding"]').exists()).toBe(false)
  })
})
