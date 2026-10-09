// @vitest-environment jsdom
//
// An approval card says why it is asking, when the reason is more than "this call changes something".
// Seen live 2026-10-09 (conversation 2667): an agent whose owner set ECHO to "ask" showed
// "Approve ECHO?" and nothing else. ECHO changes nothing and runs without asking on every other agent,
// so the card read as a fault. The backend sends the reason as `held_because`.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

import HITLModal from './HITLModal.vue'

const approval = (payload) => ({
  request_id: 'r1',
  interaction_type: 'approval',
  response_type: 'binary',
  urgency: 'high',
  summary: 'Approve running the tool \u201cECHO\u201d?',
  payload: { kind: 'tool_approval', tool: 'ECHO', tool_name: 'ECHO', session_approval: true, ...payload },
  timeout_at: new Date(Date.now() + 5 * 60_000).toISOString(),
})

const mountCard = (req) => mount(HITLModal, {
  props: { requests: [req] },
  global: { stubs: { teleport: true, transition: false } },
})

describe('why an approval card is asking', () => {
  it('shows the reason the platform gave', () => {
    const w = mountCard(approval({ held_because: "tool 'ECHO' requires approval (tool permission 'ask')" }))
    const line = w.find('[data-test="hitl-held-because"]')
    expect(line.exists()).toBe(true)
    expect(line.text()).toBe("Asked because tool 'ECHO' requires approval (tool permission 'ask').")
    expect(w.text()).toContain('Approve ECHO?')
  })

  it('does not double the full stop', () => {
    const w = mountCard(approval({ held_because: 'this agent\'s policy requires approval for every tool.' }))
    expect(w.find('[data-test="hitl-held-because"]').text())
      .toBe("Asked because this agent's policy requires approval for every tool.")
  })

  it('adds nothing to an ordinary approval', () => {
    for (const payload of [{}, { held_because: '' }, { held_because: '   ' }]) {
      const w = mountCard(approval(payload))
      expect(w.find('[data-test="hitl-held-because"]').exists()).toBe(false)
    }
  })

  it('is only for a tool approval', () => {
    const w = mountCard({ ...approval({ held_because: 'x' }), payload: { kind: 'other', held_because: 'x' } })
    expect(w.find('[data-test="hitl-held-because"]').exists()).toBe(false)
  })
})
