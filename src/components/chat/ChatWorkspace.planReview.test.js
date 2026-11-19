// @vitest-environment jsdom
// Plan review like Claude Code (PLAN_REVIEW_LIKE_CLAUDE_PLAN.md): a Chat or Plan turn's plan card is in the conversation
// where the run paused (the thread's end), never in the floating approval overlay, which keeps every other card; once
// answered it leaves one line with "View plan"; the dock opens for the plan; no "Active plan" chip.
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useRoute: () => ({ path: '/dashboard/chat/2830', params: { sessionId: '2830' }, query: {} }),
}))
vi.mock('../../services/api', () => ({ default: { getAgent: vi.fn(), get: vi.fn(() => Promise.resolve({ data: {} })) } }))

import ChatWorkspace from './ChatWorkspace.vue'
import { useChatStore } from '../../stores/useChatStore'
import { useVideoStore } from '../../stores/useVideoStore'
import { usePlanReviewStore } from '../../stores/usePlanReviewStore'

const planFrame = {
  type: 'hitl_request', request_id: 'pr1', conversation_id: '2830', interaction_type: 'approval', response_type: 'choice',
  payload: {
    kind: 'plan_approval', run_id: 'run-9', conversation_id: '2830',
    plan_file: { path: 'plans/run-9.md', content: '# Plan' },
    answers: [{ id: 'ask_before_each_change', title: 'Yes, ask me before risky changes' }, { id: 'keep_planning', title: 'No, keep planning' }],
    notes_answer: 'keep_planning',
  },
}
const toolFrame = { type: 'hitl_request', request_id: 't1', conversation_id: '2830', interaction_type: 'approval',
                    response_type: 'binary', payload: { tool: 'CODE_RUN_COMMAND' } }

function setup() {
  setActivePinia(createPinia())
  const chat = useChatStore()
  chat.agents = [{ id: 3449, name: 'Helper' }]
  chat.selectedAgentId = '3449'
  chat.conversationId = '2830'
  chat.messages = [{ id: 'u1', role: 'user', content: 'plan the release', status: 'done' },
                   { id: 'a1', role: 'assistant', content: '', status: 'done', turnMode: 'plan' }]
  chat.loadAgents = vi.fn().mockResolvedValue(undefined)
  chat.openConversation = vi.fn().mockResolvedValue(undefined)
  chat.ensureSuperAgent = vi.fn().mockResolvedValue(null)
  chat.prewarmAgent = vi.fn()
  chat.setAgent = vi.fn()
  const video = useVideoStore()
  video.loadJobs = vi.fn().mockResolvedValue(undefined)
  video.loadProject = vi.fn().mockResolvedValue(null)
  const w = mount(ChatWorkspace, { shallow: true, attachTo: document.body, global: { stubs: {
    ChatMessageList: { template: '<div class="cml-stub"><slot name="after-thread" /></div>' },
  } } })
  return { w, chat }
}

describe('ChatWorkspace: plan review', () => {
  it('puts the plan card in the conversation and keeps it out of the floating overlay', async () => {
    const { w, chat } = setup()
    chat._onEvent(planFrame)
    chat._onEvent(toolFrame)
    await w.vm.$nextTick()
    const card = w.find('.cml-stub').findComponent({ name: 'PlanModeCard' })
    expect(card.exists()).toBe(true)
    expect(card.props('request').request_id).toBe('pr1')
    const overlay = w.findAllComponents({ name: 'HITLModal' }).find((c) => !c.props('inline'))
    expect(overlay.props('requests').map((r) => r.request_id)).toEqual(['t1'])
    w.unmount()
  })

  it('once answered, leaves one line with "View plan", which opens the plan beside the chat', async () => {
    const { w, chat } = setup()
    chat._onEvent(planFrame)
    const plans = usePlanReviewStore()
    plans.closePanel()
    plans.answered('pr1', 'Plan approved: ask me before risky changes')
    chat.hitlRequests = []
    await w.vm.$nextTick()
    expect(w.find('.cml-stub').findComponent({ name: 'PlanModeCard' }).exists()).toBe(false)
    const line = w.find('[data-test="plan-answered"]')
    expect(line.text()).toContain('Plan approved: ask me before risky changes')
    await w.find('[data-test="plan-answered-open"]').trigger('click')
    expect(plans.open).toBe(true)
    w.unmount()
  })

  it('opens the dock for the plan, and has no "Active plan" chip', async () => {
    const { w, chat } = setup()
    chat._onEvent(planFrame)
    usePlanReviewStore().openPanel()
    await w.vm.$nextTick()
    expect(w.findComponent({ name: 'ChatDock' }).exists()).toBe(true)
    expect(w.find('.active-plan-chip').exists()).toBe(false)
    w.unmount()
  })
})
