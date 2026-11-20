// @vitest-environment jsdom
//
// The plan as a message (PLAN_REVIEW_LIKE_CLAUDE_PLAN.md, owner 2026-11-19): the answer that gives a plan for review
// carries its file as a card under it (as ChatGPT and Claude show a document they made). The card names the file and
// where it is, and opens the plan beside the chat. An answer without a plan has no card.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../../services/api', () => ({ default: {} }))

import ChatMessage from './ChatMessage.vue'
import { usePlanReviewStore } from '../../stores/usePlanReviewStore'

const mountIt = (message) => mount(ChatMessage, {
  props: { message },
  global: { stubs: { TokenUsage: true, SourcesList: true, ProvenanceFooter: true, MediaThumb: true, Icon: true } },
})
const answer = (over = {}) => ({
  id: 'a1', serverId: 91, role: 'assistant', status: 'done', toolCalls: [], conversationId: 'c1',
  content: 'Two steps: add the page, then check it.\n\nReply to approve the plan and start the work, or tell me what to change.',
  planFile: { path: 'docs/plans/2026-11-19-add-a-login-page-1a2b3c4d.md', content: '# Plan', run_id: 'r1',
              plan_version_id: 'v1' },
  ...over,
})

describe('ChatMessage — the plan file under the answer', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('shows the file by name and folder, and opens the plan beside the chat', async () => {
    const w = mountIt(answer())
    const card = w.get('[data-test="plan-file-card"]')
    expect(card.text()).toContain('2026-11-19-add-a-login-page-1a2b3c4d.md')
    expect(card.text()).toContain('Plan · docs/plans')
    expect(card.attributes('aria-label')).toBe('Open 2026-11-19-add-a-login-page-1a2b3c4d.md')
    expect(card.element.tagName).toBe('BUTTON')
    await card.trigger('click')
    const plans = usePlanReviewStore()
    expect([plans.open, plans.focus]).toEqual([true, true])
    expect(plans.forConversation('c1')).toMatchObject({ path: 'docs/plans/2026-11-19-add-a-login-page-1a2b3c4d.md',
                                                        content: '# Plan' })
  })

  it('a plan file at the top level says only "Plan"', () => {
    const w = mountIt(answer({ planFile: { path: 'plan.md', content: '# P' } }))
    expect(w.get('[data-test="plan-file-card"]').text()).toContain('Plan')
    expect(w.get('[data-test="plan-file-card"]').text()).not.toContain('·')
  })

  it('an answer without a plan has no card', () => {
    expect(mountIt(answer({ planFile: null })).find('[data-test="plan-file-card"]').exists()).toBe(false)
  })
})
