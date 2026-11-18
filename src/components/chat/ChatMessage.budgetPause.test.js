// @vitest-environment jsdom
//
// A run that ran out of money PAUSES (backend agent/services/budget_pause.py, ADM-1221 finding 44): the reply is one
// line, and under the latest reply the person gets Top up (the balance) and Continue. Continue sends an ordinary
// message; the server continues the paused run because it is paused, never because of the word.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../../services/api', () => ({ default: {} }))

import ChatMessage from './ChatMessage.vue'
import { useChatStore } from '../../stores/useChatStore'
import { stopReasonBadge } from '../../composables/stopReason'

const RouterLink = { props: ['to'], template: '<a :href="to"><slot /></a>' }
const mountIt = (message) => mount(ChatMessage, {
  props: { message },
  global: { stubs: { TokenUsage: true, SourcesList: true, ProvenanceFooter: true, MediaThumb: true,
                     'router-link': RouterLink, RouterLink } },
})
const paused = (over = {}) => ({
  id: 'a1', role: 'assistant', status: 'done', toolCalls: [], planArtifacts: [],
  content: 'Paused: your balance ran out. Top up, then continue.', stopReason: 'balance_empty',
  confidence: 'medium', ...over,
})

describe('ChatMessage — a run paused for money', () => {
  let chat
  beforeEach(() => {
    setActivePinia(createPinia())
    chat = useChatStore()
  })

  it('the balance ran out: Top up goes to Billing and Continue sends a message', async () => {
    const m = paused()
    chat.messages = [{ id: 'u1', role: 'user', content: 'build it' }, m]
    const send = vi.spyOn(chat, 'sendMessage').mockResolvedValue(undefined)
    const w = mountIt(m)
    expect(w.get('[data-test="pause-topup"]').attributes('href')).toBe('/dashboard/billing')
    await w.get('[data-test="pause-continue"]').trigger('click')
    expect(send).toHaveBeenCalledWith('Continue')
    // never offered as an error with Retry
    expect(w.find('.error-row').exists()).toBe(false)
  })

  it('a budget cap offers Continue and no Top up (a top-up does not raise a cap)', () => {
    const m = paused({ stopReason: 'cost_budget_reached',
                       content: "Paused: this agent's daily cap of $5.00 is reached. Raise it, then continue." })
    chat.messages = [m]
    const w = mountIt(m)
    expect(w.find('[data-test="pause-topup"]').exists()).toBe(false)
    expect(w.find('[data-test="pause-continue"]').exists()).toBe(true)
  })

  it('only the latest reply offers them: an older paused reply was already continued', () => {
    const old = paused({ id: 'a0' })
    chat.messages = [old, { id: 'u2', role: 'user', content: 'Continue' }, { id: 'a2', role: 'assistant', content: 'Done.' }]
    expect(mountIt(old).find('[data-test="budget-pause-row"]').exists()).toBe(false)
  })

  it('Continue waits while a turn is running', async () => {
    const m = paused()
    chat.messages = [m]
    chat.isStreaming = true
    const send = vi.spyOn(chat, 'sendMessage').mockResolvedValue(undefined)
    const w = mountIt(m)
    expect(w.get('[data-test="pause-continue"]').attributes('disabled')).toBeDefined()
    await w.get('[data-test="pause-continue"]').trigger('click')
    expect(send).not.toHaveBeenCalled()
  })

  it('the badge says paused, in words', () => {
    expect(stopReasonBadge('balance_empty', 'medium').label).toBe('Paused — balance ran out')
    expect(stopReasonBadge('cost_budget_reached', 'medium').label).toBe('Paused — budget reached')
  })
})
