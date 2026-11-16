// @vitest-environment jsdom
//
// Approvals with no clock (backend phase 2b): a hosted or parked approval has `timeout_at: null`, and then the card
// shows no countdown and no expiry anywhere. A PARKED card (its run stopped and waits for the person) says the run
// waits and continues after the answer, and offers no "approve for the session" when `session_approval` is false.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

import HITLModal from './HITLModal.vue'

const approval = (over = {}, payload = {}) => ({
  request_id: 'r1', interaction_type: 'approval', response_type: 'binary', urgency: 'high',
  summary: 'Send the weekly report', options: [], timeout_at: null,
  payload: { kind: 'tool_approval', tool_name: 'EMAIL_SEND', tool_label: 'Sending an email', ...payload },
  ...over,
})

const mountCard = (req, props = {}) => mount(HITLModal, {
  props: { requests: [req], ...props },
  global: { stubs: { teleport: true, transition: false } },
})

describe('an approval with no clock', () => {
  for (const inline of [false, true]) {
    it(`shows no countdown and no expiry (${inline ? 'inline' : 'docked'})`, () => {
      const w = mountCard(approval(), { inline })
      expect(w.find('[data-test="hitl-time-left"]').exists()).toBe(false)
      expect(w.find('.timeout-indicator').exists()).toBe(false)
      expect(w.find('[data-test="hitl-expired"]').exists()).toBe(false)
      expect(w.text()).not.toMatch(/expired|No timeout|Answer within/i)
      expect(w.find('[data-test="hitl-approve"]').attributes('disabled')).toBeUndefined()
    })
  }

  it('a card that has a clock still shows it', () => {
    const w = mountCard(approval({ timeout_at: new Date(Date.now() + 5 * 60_000).toISOString() }))
    expect(w.find('[data-test="hitl-time-left"]').exists()).toBe(true)
  })
})

describe('a parked approval', () => {
  it('says the run is waiting and continues after the answer', () => {
    const w = mountCard(approval({}, { parked: true, session_approval: false }))
    const line = w.find('[data-test="hitl-parked"]')
    expect(line.exists()).toBe(true)
    expect(line.text()).toContain('The run is waiting for you. It continues after you answer.')
  })

  it('offers no "approve for the session" when session_approval is false', () => {
    const w = mountCard(approval({}, { parked: true, session_approval: false }), { showStop: true })
    expect(w.find('[data-test="hitl-allow-session"]').exists()).toBe(false)
    expect(w.find('[data-test="hitl-approve"]').exists()).toBe(true)
    expect(w.find('[data-test="hitl-decline"]').exists()).toBe(true)
  })

  it('an ordinary card has no parked line and keeps its session option', () => {
    const w = mountCard(approval({}, { session_approval: true }))
    expect(w.find('[data-test="hitl-parked"]').exists()).toBe(false)
    expect(w.find('[data-test="hitl-allow-session"]').exists()).toBe(true)
  })

  it('answers with the usual respond event', async () => {
    const w = mountCard(approval({}, { parked: true, session_approval: false }))
    await w.find('[data-test="hitl-approve"]').trigger('click')
    const ev = w.emitted('respond')
    expect(ev).toBeTruthy()
    expect(ev[0][0].request_id).toBe('r1')
  })
})
