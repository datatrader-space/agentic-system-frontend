// @vitest-environment jsdom
//
// A question whose time ran out cannot be answered. Conv 2118 (2026-09-29): the "Choose an Option" card
// read "⏱ Expired" but kept its options, answer box and Send live over the timeline; an answer typed
// minutes later went out and came back "Request already timeout".
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

import HITLModal from './HITLModal.vue'

const ask = (timeoutAt) => ({
  request_id: 'r1',
  interaction_type: 'choice',
  response_type: 'choice',
  urgency: 'medium',
  summary: 'Use placeholders, or connect an image source?',
  options: [{ id: 'a', title: 'Use placeholders' }, { id: 'b', title: 'Connect a source' }],
  payload: { allow_text: true },
  timeout_at: timeoutAt,
})

const mountCard = (req) => mount(HITLModal, {
  props: { requests: [req] },
  global: { stubs: { teleport: true, transition: false } },
})

describe('an expired question', () => {
  const past = new Date(Date.now() - 60_000).toISOString()
  const future = new Date(Date.now() + 5 * 60_000).toISOString()

  it('says it timed out and offers to close', () => {
    const w = mountCard(ask(past))
    expect(w.find('[data-test="hitl-expired"]').exists()).toBe(true)
    expect(w.text()).toContain('timed out')
  })

  it('no longer offers its options or the answer box', () => {
    const w = mountCard(ask(past))
    for (const b of w.findAll('.option-button')) expect(b.attributes('disabled')).toBeDefined()
    expect(w.find('input.text-input').attributes('disabled')).toBeDefined()
  })

  it('sends nothing when an option is clicked anyway', async () => {
    const w = mountCard(ask(past))
    await w.find('.option-button').trigger('click')
    expect(w.emitted('respond')).toBeUndefined()
  })

  it('closes locally, without answering', async () => {
    const w = mountCard(ask(past))
    await w.find('[data-test="hitl-expired"] button').trigger('click')
    expect(w.emitted('dismiss')?.[0]).toEqual(['r1'])
    expect(w.emitted('respond')).toBeUndefined()
  })

  it('a live question still answers', async () => {
    const w = mountCard(ask(future))
    expect(w.find('[data-test="hitl-expired"]').exists()).toBe(false)
    await w.find('.option-button').trigger('click')
    expect(w.emitted('respond')?.[0]?.[0]).toMatchObject({ request_id: 'r1', response_value: 'a' })
  })
})
