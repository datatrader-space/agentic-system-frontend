// @vitest-environment jsdom
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ chat: null, video: null, canvas: null, route: null, push: vi.fn(), replace: vi.fn(), get: vi.fn(), post: vi.fn() }))
vi.mock('vue-router', () => ({ useRoute: () => state.route, useRouter: () => ({ push: state.push, replace: state.replace }) }))
vi.mock('../stores/useChatStore', () => ({ useChatStore: () => state.chat }))
vi.mock('../stores/useVideoStore', () => ({ useVideoStore: () => state.video }))
vi.mock('../stores/useCanvasStore', () => ({ useCanvasStore: () => state.canvas }))
vi.mock('../services/api', () => ({ default: { get: state.get, post: state.post } }))
vi.mock('../composables/useNotify', () => ({ notify: { error: vi.fn() } }))
import VideoStudio from './VideoStudio.vue'

let wrapper
const stubs = {
  VideoComposerPanel: { props: ['draft'], template: '<div data-test="creation"><slot /></div>' },
  VideoPanel: { template: '<div data-test="workspace" />' },
  VideoJobCard: { props: ['job'], template: '<div data-test="job">{{ job.state }}</div>' },
  ChatMessageList: { template: '<div data-test="messages" />' },
  HITLModal: { name: 'HITLModal', props: ['requests'], template: '<div data-test="hitl" />' },
  FullDocCostCard: true, ProviderSwitchDialog: true, RouterLink: { template: '<a><slot /></a>' },
}
const button = (label) => wrapper.findAll('button').find((b) => b.text() === label)
async function render() { wrapper = mount(VideoStudio, { global: { stubs } }); await flushPromises(); return wrapper }

beforeEach(() => {
  vi.clearAllMocks()
  state.push.mockResolvedValue(undefined)
  state.replace.mockResolvedValue(undefined)
  state.route = reactive({ query: {} })
  state.canvas = reactive({ mode: true })
  state.chat = reactive({
    agents: [{ id: 7, name: 'Video expert', video_model: 86 }], selectedAgentId: '7', conversationId: null,
    messages: [], isBusy: false, error: '', imageMode: true, hitlRequests: [{ id: 'approval-1' }],
    get currentAgent() { return this.agents.find((a) => String(a.id) === this.selectedAgentId) },
    loadAgents: vi.fn().mockResolvedValue(), openConversation: vi.fn().mockResolvedValue(),
    setAgent: vi.fn((id) => { state.chat.selectedAgentId = id }),
    ensureConversation: vi.fn(async () => { state.chat.conversationId = 'c1'; return 'c1' }),
    sendMessage: vi.fn().mockResolvedValue(true), reset: vi.fn(() => { state.chat.conversationId = null; state.chat.messages = [] }),
    respondHitl: vi.fn(), dismissHitl: vi.fn(), skipHitl: vi.fn(), stop: vi.fn(),
  })
  state.video = reactive({
    studioDraft: 'A product reveal', mode: true, busy: false, project: null, panelTab: 'preview', refs: [],
    reset: vi.fn(), jobsFor: vi.fn(() => []), loadJobs: vi.fn().mockResolvedValue(),
    loadProject: vi.fn().mockResolvedValue(), loadVersions: vi.fn().mockResolvedValue(),
  })
  state.get.mockResolvedValue({ data: { projects: [] } })
  state.post.mockResolvedValue({ data: { project_id: 'p1', title: 'Product launch' } })
})
afterEach(() => wrapper?.unmount())

describe('Video Studio', () => {
  it('keeps the transferred draft and existing approval UI without starting a render', async () => {
    await render()
    expect(wrapper.get('[data-test="studio-prompt"]').element.value).toBe('A product reveal')
    expect(state.post).not.toHaveBeenCalled()
    expect(state.chat.sendMessage).not.toHaveBeenCalled()
    expect(wrapper.findComponent({ name: 'HITLModal' }).props('requests')).toEqual([{ id: 'approval-1' }])
    expect(state.chat.imageMode).toBe(false)
    wrapper.unmount(); wrapper = null
    expect(state.chat.imageMode).toBe(true)
    expect(state.canvas.mode).toBe(true)
  })

  it('restores a bookmarked conversation before loading its video work', async () => {
    state.route.query = { conversation: 'saved-session', agent: '7' }
    state.chat.openConversation.mockImplementation(async (cid) => { state.chat.conversationId = cid })
    await render()
    expect(state.chat.openConversation).toHaveBeenCalledWith('saved-session')
    expect(state.video.loadJobs).toHaveBeenCalledWith('saved-session')
    expect(state.video.loadProject).toHaveBeenCalledWith('saved-session')
  })

  it('does not expose the previous workspace when the requested session cannot be opened', async () => {
    state.route.query = { conversation: 'unavailable' }
    state.chat.openConversation.mockImplementation(async () => { state.chat.error = 'Not found' })
    await render()
    expect(wrapper.find('[data-test="workspace"]').exists()).toBe(false)
    expect(wrapper.get('[role="alert"]').text()).toContain('could not be opened')
  })

  it('opens a saved project through the server-authorized conversation endpoint', async () => {
    state.get.mockResolvedValue({ data: { projects: [{ project_id: 'p1', title: 'Product launch' }] } })
    await render()
    await button('My projects').trigger('click')
    await wrapper.get('.project-card').trigger('click')
    await flushPromises()
    expect(state.post).toHaveBeenCalledWith('/video/projects/p1/open/', { conversation_id: 'c1' })
    expect(state.video.project.project_id).toBe('p1')
    expect(state.video.loadVersions).toHaveBeenCalled()
  })

  it('shows setup guidance when the account has no video agent', async () => {
    state.chat.agents = []
    state.chat.selectedAgentId = ''
    await render()
    expect(wrapper.text()).toContain('Choose an agent with video generation')
    expect(wrapper.find('[data-test="creation"]').exists()).toBe(false)
  })

  it('prevents switching sessions while the assistant is working', async () => {
    await render()
    state.chat.isBusy = true
    await wrapper.vm.$nextTick()
    expect(button('New video').attributes('disabled')).toBeDefined()
  })

  it('does not redirect back after leaving while the studio is loading', async () => {
    let finish
    state.chat.loadAgents.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    wrapper = mount(VideoStudio, { global: { stubs } })
    wrapper.unmount(); wrapper = null
    finish()
    await flushPromises()
    expect(state.replace).not.toHaveBeenCalled()
  })

  it('returns to the same conversation from the studio', async () => {
    state.chat.conversationId = 'c1'
    await render()
    await button('Back to chat').trigger('click')
    expect(state.push).toHaveBeenCalledWith({ path: '/dashboard/chat/c1', query: { agent: '7' } })
  })
})
