// @vitest-environment jsdom
// Plan review like ChatGPT and Claude (PLAN_REVIEW_LIKE_CLAUDE_PLAN.md, owner 2026-11-19): the plan is a message in the
// chat with its file, answered by the person's next message. No plan card: every approval card stays in the overlay;
// the plan opens beside the chat by itself on a wide screen; no "Active plan" chip.
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

const planReady = { type: 'plan_ready', message_id: 91, conversation_id: '2830',
                    plan_file: { path: 'plans/run-9.md', content: '# Plan', run_id: 'run-9', plan_version_id: 'v1' } }
const toolFrame = { type: 'hitl_request', request_id: 't1', conversation_id: '2830', interaction_type: 'approval',
                    response_type: 'binary', payload: { tool: 'CODE_RUN_COMMAND' } }

function setup(wide = true) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: wide, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
  setActivePinia(createPinia())
  const chat = useChatStore()
  chat.agents = [{ id: 3449, name: 'Helper' }]
  chat.selectedAgentId = '3449'
  chat.conversationId = '2830'
  chat.messages = [{ id: 'u1', role: 'user', content: 'plan the release', status: 'done' },
                   { id: 'a1', serverId: 91, role: 'assistant', content: 'Two steps.', status: 'done', turnMode: 'plan' }]
  chat.loadAgents = vi.fn().mockResolvedValue(undefined)
  chat.openConversation = vi.fn().mockResolvedValue(undefined)
  chat.ensureSuperAgent = vi.fn().mockResolvedValue(null)
  chat.prewarmAgent = vi.fn()
  chat.setAgent = vi.fn()
  const video = useVideoStore()
  video.loadJobs = vi.fn().mockResolvedValue(undefined)
  video.loadProject = vi.fn().mockResolvedValue(null)
  const w = mount(ChatWorkspace, { shallow: true, attachTo: document.body })
  return { w, chat }
}

describe('ChatWorkspace: plan review', () => {
  it('gives the answer its plan file and opens the plan beside the chat on a wide screen', async () => {
    const { w, chat } = setup(true)
    chat._onEvent(planReady)
    await w.vm.$nextTick()
    expect(chat.messages[1].planFile.path).toBe('plans/run-9.md')
    const plans = usePlanReviewStore()
    expect(plans.open).toBe(true)
    expect(plans.forConversation('2830').content).toBe('# Plan')
    expect(w.findComponent({ name: 'ChatDock' }).exists()).toBe(true)
    expect(w.find('.active-plan-chip').exists()).toBe(false)
    w.unmount()
    vi.unstubAllGlobals()
  })

  it('does not open it by itself on a phone', async () => {
    const { w, chat } = setup(false)
    chat._onEvent(planReady)
    await w.vm.$nextTick()
    expect(chat.messages[1].planFile.path).toBe('plans/run-9.md')
    expect(usePlanReviewStore().open).toBe(false)
    w.unmount()
    vi.unstubAllGlobals()
  })

  it('keeps every approval card in the overlay: there is no plan card', async () => {
    const { w, chat } = setup()
    chat._onEvent(planReady)
    chat._onEvent(toolFrame)
    await w.vm.$nextTick()
    expect(w.findComponent({ name: 'PlanModeCard' }).exists()).toBe(false)
    const overlay = w.findAllComponents({ name: 'HITLModal' }).find((c) => !c.props('inline'))
    expect(overlay.props('requests').map((r) => r.request_id)).toEqual(['t1'])
    w.unmount()
    vi.unstubAllGlobals()
  })
})
