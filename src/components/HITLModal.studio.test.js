// @vitest-environment jsdom
//
// The approval card inside Video Studio (inline) speaks the Studio's words (owner, 2026-10-27: "fix the approval card
// ui in video studio, match the studio ui colors theme"). Seen live that day on the Image page: a white chat card
// titled "Approval Required / Agent Request", "Approve GENERATE_IMAGE?", an orange MEDIUM badge, Reject, a
// "docker ps" example and an unlabelled "⏱ 12m 23s". The chat outside the Studio keeps its own card unchanged.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

import HITLModal from './HITLModal.vue'

const request = {
  request_id: 'r1',
  interaction_type: 'approval',
  response_type: 'binary',
  urgency: 'medium',
  summary: 'Approve running the tool “GENERATE_IMAGE”?',
  payload: { kind: 'tool_approval', tool: 'GENERATE_IMAGE', tool_name: 'GENERATE_IMAGE', session_approval: true,
             held_because: 'it makes 1 image with Nano Banana (Gemini 2.5 Flash Image) in 1:1; the provider sets the price' },
  timeout_at: new Date(Date.now() + 12 * 60_000 + 30_000).toISOString(),
}

const mountCard = (props) => mount(HITLModal, {
  props: { requests: [request], ...props },
  global: { stubs: { teleport: true, transition: false } },
})

describe('the approval card in Video Studio', () => {
  it('says what it asks in the Studio’s words, with no tool name, risk word or emoji', () => {
    const w = mountCard({ inline: true })
    const text = w.text()
    expect(w.find('h3').text()).toBe('Approve this step')
    expect(w.get('[data-test="hitl-waiting"]').text()).toBe('Waiting for you')
    expect(w.get('[data-test="hitl-held-because"]').text()).toContain('it makes 1 image with Nano Banana')
    expect(text).not.toContain('GENERATE_IMAGE')
    expect(text).not.toContain('Agent Request')
    expect(text).not.toMatch(/medium/i)
    expect(w.findAll('button').map(b => b.text())).toEqual(expect.arrayContaining(['Approve', 'Decline']))
    expect(w.get('.instruction-input').attributes('placeholder')).toBe('Or tell the agent what to do instead')
    expect(w.get('[data-test="hitl-time-left"]').text()).toMatch(/^Answer within 12m \d+s$/)
    expect(text).not.toContain('⏱')
  })

  it('reads the same way in the chat (owner, 2026-11-11: one friendly approval card on every surface)', () => {
    const w = mountCard({})
    expect(w.find('h3').text()).toBe('Approve this step')
    expect(w.text()).not.toContain('Agent Request')
    expect(w.text()).not.toMatch(/medium/i)
    expect(w.get('[data-test="hitl-waiting"]').text()).toBe('Waiting for you')
    expect(w.get('[data-test="hitl-approve"]').text()).toBe('Approve')
    expect(w.get('[data-test="hitl-decline"]').text()).toBe('Decline')
    expect(w.findAll('button').map(b => b.text())).not.toContain('Reject')
  })

  it('keeps one filled button: the redirect sends from inside its field, the rest are quiet links', async () => {
    const w = mountCard({ inline: true, showStop: true })
    const send = w.get('[data-test="hitl-instead"]')
    expect(send.text()).toBe('Send')
    expect(send.attributes('disabled')).toBeDefined()                     // nothing typed yet
    await w.get('.instruction-input').setValue('only make it in 16:9')
    expect(send.attributes('disabled')).toBeUndefined()
    expect(w.get('.instruction-row').element.contains(send.element)).toBe(true)
    expect(w.get('[data-test="hitl-allow-session"]').text()).toBe('Always allow this session')
    expect(w.findAll('.approval-links .link-btn').map(b => b.text())).toEqual(['Always allow this session', 'Stop agent'])
    expect(w.findAll('.btn-approve').length).toBe(1)
  })
})
