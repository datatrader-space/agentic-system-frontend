// @vitest-environment jsdom
import { reactive } from 'vue'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
const state = vi.hoisted(() => ({ video: null, chat: null, get: vi.fn(), media: vi.fn(), push: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: state.push }) }))
vi.mock('../../stores/useVideoStore', () => ({ useVideoStore: () => state.video }))
vi.mock('../../stores/useChatStore', () => ({ useChatStore: () => state.chat }))
vi.mock('../../services/api', () => ({ default: { get: state.get, getConversationMedia: state.media } }))
import ResultsFeed from './ResultsFeed.vue'
let wrapper
const stubs = { HITLModal: { name: 'HITLModal', props: { requests: Array, inline: Boolean }, template: '<div data-test="approval" />' }, VideoJobCard: { name: 'VideoJobCard', props: ['job'], template: '<div data-test="estimate">{{ job.state }}</div>' }, UseInMenu: true, MediaViewer: { name: 'MediaViewer', props: ['items','index'], template: '<div data-test="viewer" />' } }
beforeEach(() => {
  vi.clearAllMocks()
  state.chat = reactive({ hitlRequests: [], isBusy: false, error: '', respondHitl: vi.fn(), dismissHitl: vi.fn(), skipHitl: vi.fn(), stop: vi.fn() })
  state.video = reactive({ sessionImages: [], jobs: {}, jobsFor(cid) { return Object.values(this.jobs).filter(job => String(job.conversation_id) === String(cid)) }, _put: vi.fn(job => { state.video.jobs[job.job_id] = job }), start: vi.fn() })
  state.get.mockResolvedValue({ data: { jobs: [{ job_id: 'estimate-1', conversation_id: 'c1', state: 'awaiting_authorization', operation: 'generate' }] } })
  state.media.mockResolvedValue({ data: { media: [{ attachment_id: 7, title: 'An image', url: '/original.png', thumbnail_url: '/small.webp' }] } })
})
afterEach(() => wrapper?.unmount())
describe('ResultsFeed', () => {
  it('reuses the actual approval and estimate component boundaries without authorizing anything', async () => {
    state.chat.hitlRequests = [{ id: 'ask-1' }]
    wrapper = mount(ResultsFeed, { props: { kind: 'video', conversationId: 'c1' }, global: { stubs } }); await flushPromises()
    expect(wrapper.findComponent({ name: 'HITLModal' }).props()).toEqual({ requests: [{ id: 'ask-1' }], inline: true })
    expect(wrapper.get('[data-test="estimate"]').text()).toBe('awaiting_authorization')
    expect(state.video.start).not.toHaveBeenCalled(); expect(state.chat.respondHitl).not.toHaveBeenCalled()
  })
  it("shows one Stop: the feed's own while the agent works, the card's otherwise", async () => {
    state.chat.hitlRequests = [{ request_id: 'one-stop', summary: 'Approve a synthetic image?', response_type: 'binary', interaction_type: 'approval', urgency: 'medium', payload: { kind: 'tool_approval' } }]
    state.chat.isBusy = true
    wrapper = mount(ResultsFeed, { props: { kind: 'image', conversationId: 'c1' }, global: { stubs: { ...stubs, HITLModal: false } } }); await flushPromises()
    const stops = wrapper.findAll('button').filter(button => /^Stop/.test(button.text())).map(button => button.text())
    expect(stops).toEqual(['Stop'])
    state.chat.isBusy = false
  })
  it('removes a stopped approval card when its request is cleared', async () => {
    state.chat.hitlRequests = [{ request_id: 'stop-1', summary: 'Approve a synthetic image?', response_type: 'binary', interaction_type: 'approval', urgency: 'medium', payload: { kind: 'tool_approval' } }]
    state.chat.stop.mockImplementation(() => { state.chat.hitlRequests = [] })
    wrapper = mount(ResultsFeed, { props: { kind: 'image', conversationId: 'c1' }, global: { stubs: { ...stubs, HITLModal: false } } }); await flushPromises()
    expect(wrapper.findComponent({ name: 'HITLModal' }).exists()).toBe(true)
    await wrapper.findAll('button').find(button => button.text() === 'Stop agent').trigger('click'); await flushPromises()
    expect(wrapper.findComponent({ name: 'HITLModal' }).exists()).toBe(false)
    expect(state.chat.respondHitl).not.toHaveBeenCalled()
    expect(state.video.start).not.toHaveBeenCalled()
  })
  it('uses thumbnails in the feed, opens originals only in MediaViewer, and recreates without submitting', async () => {
    wrapper = mount(ResultsFeed, { props: { kind: 'image', conversationId: 'c1' }, global: { stubs } }); await flushPromises()
    expect(wrapper.get('.rf-preview img').attributes('src')).toBe('/small.webp')
    await wrapper.get('.rf-preview').trigger('click')
    expect(wrapper.findComponent({ name: 'MediaViewer' }).props('items')[0].url).toBe('/original.png')
    await wrapper.findAll('button').find(button => button.text() === 'Use again').trigger('click')
    expect(wrapper.emitted('recreate')[0][0].attachment_id).toBe(7)
    expect(state.video.start).not.toHaveBeenCalled()
  })
  it('discards an older conversation response and shows a retry on a read failure', async () => {
    let oldResponse
    state.get.mockImplementationOnce(() => new Promise(resolve => { oldResponse = resolve }))
    wrapper = mount(ResultsFeed, { props: { kind: 'video', conversationId: 'old' }, global: { stubs } })
    await wrapper.setProps({ conversationId: 'c1' }); await flushPromises()
    oldResponse({ data: { jobs: [{ job_id: 'foreign-session', conversation_id: 'old', state: 'ready', operation: 'generate' }] } }); await flushPromises()
    expect(state.video.jobs['foreign-session']).toBeUndefined()
    state.get.mockRejectedValueOnce(new Error('network'))
    await wrapper.vm.refresh(); await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Could not load this session')
  })
})

it('puts the newest generated image first and emits approval without inventing a job', async () => {
  state.media.mockResolvedValue({data:{media:[{attachment_id:1,url:'/old.png',title:'Older',created_at:'2026-10-01'},{attachment_id:2,url:'/new.png',title:'Newer',created_at:'2026-10-21'}]}})
  state.chat.hitlRequests=[{request_id:'r'}]
  wrapper=mount(ResultsFeed,{props:{kind:'image',conversationId:'c1'},global:{stubs}}); await flushPromises()
  expect(wrapper.findAll('.rf-title strong')[0].text()).toBe('Newer')
  const decision={request_id:'r',response_value:true}
  wrapper.findComponent({name:'HITLModal'}).vm.$emit('respond',decision); await flushPromises()
  expect(state.chat.respondHitl).toHaveBeenCalledWith(decision); expect(wrapper.emitted('approved')).toHaveLength(1)
  expect(state.video.start).not.toHaveBeenCalled()
})

describe('My results cards', () => {
  it('shows the server thumbnail even when a result row names none, and opens the full file on click', async () => {
    state.media.mockResolvedValue({ data: { media: [{ attachment_id: 'a b', title: 'A picture', url: '/full.png' }] } })
    wrapper = mount(ResultsFeed, { props: { kind: 'image', conversationId: 'c1' }, global: { stubs } }); await flushPromises()
    expect(wrapper.text()).not.toContain('Open image preview')
    expect(wrapper.get('.rf-preview img').attributes('src')).toBe('/api/library/a%20b/thumbnail/')
    await wrapper.get('.rf-preview').trigger('click')
    expect(wrapper.findComponent({ name: 'MediaViewer' }).props('items')[0].url).toBe('/full.png')
  })
  it("lists a picture job's other pictures next to its first, each with its own thumbnail", async () => {
    state.get.mockResolvedValue({ data: { jobs: [{ job_id: 'p', conversation_id: 'c1', state: 'ready', operation: 'image', modality: 'image', effective_config: { prompt: 'A red chair' },
      output: { attachment_id: 'o1', url: '/o1.png', thumbnail_url: '/api/library/o1/thumbnail/' },
      extra_outputs: [{ attachment_id: 'o2', role: 'output', url: '/o2.png', version: 1, thumbnail_url: '/api/library/o2/thumbnail/' }] }] } })
    wrapper = mount(ResultsFeed, { props: { kind: 'video', conversationId: 'c1' }, global: { stubs } }); await flushPromises()
    expect(wrapper.findAll('.rf-preview img').map(i => i.attributes('src'))).toEqual(['/api/library/o1/thumbnail/', '/api/library/o2/thumbnail/'])
  })
  it('follows has_more when a session is opened, and a background refresh reads the newest page only', async () => {
    state.get.mockImplementation((url, { params }) => Promise.resolve({ data: params.page === 1
      ? { jobs: [{ job_id: 'new', conversation_id: 'c1', state: 'ready', operation: 'generate', output: { attachment_id: 'n', url: '/n.mp4' } }], page: 1, has_more: true }
      : { jobs: [{ job_id: 'old', conversation_id: 'c1', state: 'ready', operation: 'generate', output: { attachment_id: 'o', url: '/o.mp4' } }], page: 2, has_more: false } }))
    wrapper = mount(ResultsFeed, { props: { kind: 'video', conversationId: 'c1' }, global: { stubs } }); await flushPromises()
    expect(state.get.mock.calls.map(c => c[1].params.page)).toEqual([1, 2])
    expect(Object.keys(state.video.jobs).sort()).toEqual(['new', 'old'])
    state.get.mockClear()
    await wrapper.vm.refresh({ background: true }); await flushPromises()
    expect(state.get.mock.calls.map(c => c[1].params.page)).toEqual([1])
  })
  it('Use again hands the prompt and settings to the composer and never starts or spends anything', async () => {
    const generation = { job_id: null, operation: 'image', modality: 'image', model: 'm', prompt: 'A blue lamp', settings: { aspect_ratio: '1:1' } }
    state.media.mockResolvedValue({ data: { media: [{ attachment_id: 9, title: 'Lamp', url: '/l.png', generation }] } })
    state.video.useAgain = vi.fn(() => true)
    wrapper = mount(ResultsFeed, { props: { kind: 'image', conversationId: 'c1' }, global: { stubs } }); await flushPromises()
    await wrapper.get('[data-test="rf-use-again"]').trigger('click')
    expect(state.video.useAgain).toHaveBeenCalledWith(generation)
    expect(wrapper.emitted('recreate')).toBeUndefined()
    expect(state.video.start).not.toHaveBeenCalled()
  })
  it('Edit opens the edit flow with this result as the base', async () => {
    state.video.editFrom = vi.fn(() => ({ path: '/video-studio/edit', query: { useIn: '1' } }))
    wrapper = mount(ResultsFeed, { props: { kind: 'image', conversationId: 'c1' }, global: { stubs } }); await flushPromises()
    await wrapper.get('[data-test="rf-edit"]').trigger('click')
    expect(state.video.editFrom).toHaveBeenCalledWith(expect.objectContaining({ attachment_id: 7 }), { conversationId: 'c1' })
    expect(state.push).toHaveBeenCalledWith({ path: '/video-studio/edit', query: { useIn: '1' } })
    expect(state.video.start).not.toHaveBeenCalled()
  })
})
