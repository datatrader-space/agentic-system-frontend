// @vitest-environment jsdom
// Video Studio's 8 s session refresh (page-speed plan Phase 5): it must not disable New while it runs (a
// background poll used to set `refreshing`, so New flickered off under the pointer), it loads jobs and project
// in one round, and it stops when the page is left.
import { mount, flushPromises } from '@vue/test-utils'
import { reactive, ref } from 'vue'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ chat: null, video: null, canvas: null, route: null, replace: vi.fn(), get: vi.fn(), post: vi.fn(), studio: vi.fn(), getAgent: vi.fn() }))
vi.mock('vue-router', () => ({ useRoute: () => state.route, useRouter: () => ({ push: vi.fn(), replace: state.replace }) }))
vi.mock('../stores/useChatStore', () => ({ useChatStore: () => state.chat }))
vi.mock('../stores/useVideoStore', () => ({ useVideoStore: () => state.video }))
vi.mock('../stores/useCanvasStore', () => ({ useCanvasStore: () => state.canvas }))
vi.mock('../services/api', () => ({ default: { get: state.get, post: state.post, getVideoStudioAgent: state.studio, getAgent: state.getAgent } }))
vi.mock('../composables/useNotify', () => ({ notify: { error: vi.fn() } }))
import VideoStudio from './VideoStudio.vue'

const stubs = {
  HomeFeatures: true, VideoComposerPanel: { template: '<div><slot /><slot name="actions" /></div>' },
  VideoJobsTray: true, VideoPanel: true, ChatMessageList: true, HITLModal: true, VideoLibrary: true,
  FullDocCostCard: true,
}
let wrapper

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks(); localStorage.clear()
  state.replace.mockResolvedValue(undefined)
  state.route = reactive({ query: { conversation: 'c1' } })
  state.canvas = reactive({ mode: false })
  state.chat = reactive({
    agents: [{ id: 900, name: 'Video Studio', video_model: 86 }], selectedAgentId: '900', conversationId: null,
    messages: [], isBusy: false, error: '', imageMode: false, hitlRequests: [],
    get currentAgent() { return this.agents.find((a) => String(a.id) === this.selectedAgentId) },
    loadAgents: vi.fn().mockResolvedValue(),
    openConversation: vi.fn(async (cid) => { state.chat.conversationId = cid }),
    setAgent: vi.fn(), reset: vi.fn(), stop: vi.fn(),
  })
  state.video = reactive({
    studioMode: 'agent', studioDraft: '', busy: false, project: null, panelTab: 'preview', refs: [],
    reset: vi.fn(), jobsFor: vi.fn(() => []), loadJobs: vi.fn().mockResolvedValue(),
    loadProject: vi.fn().mockResolvedValue(), loadVersions: vi.fn().mockResolvedValue(),
    queuedUse: [], applyQueuedUse: vi.fn(), libraryOpen: false,
  })
  state.studio.mockResolvedValue({ data: { id: 900, name: 'Video Studio', video_model: 86 } })
})
afterEach(() => { wrapper?.unmount(); wrapper = null; vi.useRealTimers() })

describe('Video Studio session refresh', () => {
  it('a background refresh leaves New enabled, and the poll stops on leave', async () => {
    wrapper = mount(VideoStudio, { global: { stubs, provide: { studioUser: ref(null) } } })
    await flushPromises()
    expect(state.video.loadJobs).toHaveBeenCalledTimes(1)
    expect(state.video.loadProject).toHaveBeenCalledTimes(1)

    let release
    state.video.loadJobs.mockImplementationOnce(() => new Promise((r) => { release = r }))
    await vi.advanceTimersByTimeAsync(8000)
    expect(state.video.loadJobs).toHaveBeenCalledTimes(2)
    // Jobs and project are fetched together, not one after the other.
    expect(state.video.loadProject).toHaveBeenCalledTimes(2)
    expect(wrapper.get('[data-test="studio-new"]').attributes('disabled')).toBeUndefined()
    release(); await flushPromises()

    const calls = state.video.loadJobs.mock.calls.length
    wrapper.unmount(); wrapper = null
    await vi.advanceTimersByTimeAsync(60000)
    expect(state.video.loadJobs.mock.calls.length).toBe(calls)
  })
})
