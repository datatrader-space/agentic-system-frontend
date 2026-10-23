// @vitest-environment jsdom
// The 8 s background refresh of the results feed must not show "Loading this session..." or replace the
// results with an error; it runs through the shared poller and stops on unmount (page-speed plan Phase 5).
import { reactive } from 'vue'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
const state = vi.hoisted(() => ({ video: null, chat: null, get: vi.fn(), media: vi.fn() }))
vi.mock('../../stores/useVideoStore', () => ({ useVideoStore: () => state.video }))
vi.mock('../../stores/useChatStore', () => ({ useChatStore: () => state.chat }))
vi.mock('../../services/api', () => ({ default: { get: state.get, getConversationMedia: state.media } }))
import ResultsFeed from './ResultsFeed.vue'

const stubs = { HITLModal: true, VideoJobCard: true, UseInMenu: true, MediaViewer: true }
let wrapper
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  state.chat = reactive({ hitlRequests: [], isBusy: false, error: '', respondHitl: vi.fn() })
  state.video = reactive({ sessionImages: [], jobs: {}, jobsFor() { return [] }, _put: vi.fn() })
  state.get.mockResolvedValue({ data: { jobs: [] } })
})
afterEach(() => { wrapper?.unmount(); wrapper = null; vi.useRealTimers() })

describe('ResultsFeed background refresh', () => {
  it('polls quietly: no loading text while in flight, no error on a failed poll', async () => {
    wrapper = mount(ResultsFeed, { props: { kind: 'video', conversationId: 'c1' }, global: { stubs } })
    await flushPromises()
    expect(state.get).toHaveBeenCalledTimes(1)

    let release
    state.get.mockImplementationOnce(() => new Promise((r) => { release = r }))
    await vi.advanceTimersByTimeAsync(8000)
    expect(state.get).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).not.toContain('Loading this session')
    release({ data: { jobs: [] } }); await flushPromises()

    state.get.mockRejectedValueOnce(new Error('network'))
    await vi.advanceTimersByTimeAsync(8000)
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('stops polling on unmount', async () => {
    wrapper = mount(ResultsFeed, { props: { kind: 'video', conversationId: 'c1' }, global: { stubs } })
    await flushPromises()
    const calls = state.get.mock.calls.length
    wrapper.unmount(); wrapper = null
    await vi.advanceTimersByTimeAsync(60000)
    expect(state.get.mock.calls.length).toBe(calls)
  })
})
