// @vitest-environment jsdom
import { mount, flushPromises } from '@vue/test-utils'
import { reactive, ref } from 'vue'
import { useStudioExperience } from '../composables/useStudioExperience'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const submitSpy = vi.hoisted(() => vi.fn())
const state = vi.hoisted(() => ({ chat: null, video: null, canvas: null, route: null, push: vi.fn(), replace: vi.fn(), get: vi.fn(), post: vi.fn(), studio: vi.fn() }))
vi.mock('vue-router', () => ({ useRoute: () => state.route, useRouter: () => ({ push: state.push, replace: state.replace }) }))
vi.mock('../stores/useChatStore', () => ({ useChatStore: () => state.chat }))
vi.mock('../stores/useVideoStore', () => ({ useVideoStore: () => state.video }))
vi.mock('../stores/useCanvasStore', () => ({ useCanvasStore: () => state.canvas }))
vi.mock('../services/api', () => ({ default: { get: state.get, post: state.post, getVideoStudioAgent: state.studio } }))
vi.mock('../composables/useNotify', () => ({ notify: { error: vi.fn() } }))
import VideoStudio from './VideoStudio.vue'
import StudioModeSwitch from '../components/studio/StudioModeSwitch.vue'

let wrapper
const stubs = {
  HomeFeatures: true,
  VideoComposerPanel: { name: 'VideoComposerPanel', props: { draft: String, showMode: { type: Boolean, default: true } }, components: { StudioModeSwitch }, template: '<div data-test="creation"><StudioModeSwitch v-if="showMode" /><slot name="above" /><slot /><slot name="actions" /></div>',
                        methods: { submit: submitSpy } },
  VideoJobsTray: { props: ['conversationId'], template: '<div data-test="tray" />' },
  VideoPanel: { template: '<div data-test="workspace" />' },
  VideoJobCard: { props: ['job'], template: '<div data-test="job">{{ job.state }}</div>' },
  ChatMessageList: { template: '<div data-test="messages" />' },
  HITLModal: { name: 'HITLModal', props: ['requests'], template: '<div data-test="hitl" />' },
  VideoLibrary: { template: '<div data-test="library" />' },
  FullDocCostCard: true, RouterLink: { template: '<a><slot /></a>' },
}
const button = (label) => wrapper.findAll('button').find((b) => b.text() === label)
async function render(user = null) { wrapper = mount(VideoStudio, { global: { stubs, provide: { studioUser: ref(user) } } }); await flushPromises(); return wrapper }

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear()
  state.push.mockResolvedValue(undefined)
  state.replace.mockResolvedValue(undefined)
  state.route = reactive({ query: {} })
  state.canvas = reactive({ mode: true })
  state.chat = reactive({
    // The user's own agent list; the Studio adds the built-in Video Studio agent (id 900) itself.
    agents: [{ id: 7, name: 'My own video agent', video_model: 12 }], selectedAgentId: '7', conversationId: null,
    messages: [], isBusy: false, error: '', imageMode: true, hitlRequests: [{ id: 'approval-1' }],
    get currentAgent() { return this.agents.find((a) => String(a.id) === this.selectedAgentId) },
    loadAgents: vi.fn().mockResolvedValue(), openConversation: vi.fn().mockResolvedValue(),
    setAgent: vi.fn((id) => { state.chat.selectedAgentId = id }),
    ensureConversation: vi.fn(async () => { state.chat.conversationId = 'c1'; return 'c1' }),
    sendMessage: vi.fn().mockResolvedValue(true), reset: vi.fn(() => { state.chat.conversationId = null; state.chat.messages = [] }),
    respondHitl: vi.fn(), dismissHitl: vi.fn(), skipHitl: vi.fn(), stop: vi.fn(),
  })
  state.video = reactive({
    studioMode: 'agent', setStudioMode: vi.fn((mode) => { state.video.studioMode = mode }),
    studioDraft: 'A product reveal', busy: false, project: null, panelTab: 'preview', refs: [],
    sendAgentMessage: vi.fn(async ({prompt,chat}) => chat.sendMessage(prompt)),
    reset: vi.fn(), jobsFor: vi.fn(() => []), loadJobs: vi.fn().mockResolvedValue(),
    loadProject: vi.fn().mockResolvedValue(), loadVersions: vi.fn().mockResolvedValue(),
    queuedUse: [], applyQueuedUse: vi.fn().mockResolvedValue(true), libraryOpen: false,
  })
  state.studio.mockResolvedValue({ data: { id: 900, name: 'Video Studio', video_model: 86, is_builtin_agent: true } })
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

  it('opens a project chosen on the Projects page through the server-authorized endpoint', async () => {
    // Projects moved to the Studio's own navigation; it links here with ?project=<id>.
    state.route.query = { project: 'p1' }
    await render()
    expect(state.post).toHaveBeenCalledWith('/video/projects/p1/open/', { conversation_id: 'c1' })
    expect(state.video.project.project_id).toBe('p1')
    expect(state.video.loadVersions).toHaveBeenCalled()
    expect(state.replace).toHaveBeenCalledWith({ path: '/video-studio', query: { conversation: 'c1' } })
  })

  // Owner, 2026-10-20: a project is never put into whichever chat happened to be open; ?project= (a project not yet
  // in any chat) starts a fresh session, and the Projects page sends a project used before to its own chat.
  it('opens a project that is in no chat yet in a fresh session, not the chat that was open', async () => {
    state.chat.conversationId = 'old'
    state.route.query = { project: 'p1' }
    await render()
    expect(state.chat.reset).toHaveBeenCalled()
    expect(state.chat.openConversation).not.toHaveBeenCalled()
  })

  it('"New video" from the Projects page starts a fresh session with the Video Studio agent', async () => {
    state.chat.conversationId = 'old'
    state.route.query = { new: '1' }
    await render()
    expect(state.chat.reset).toHaveBeenCalled()
    expect(state.chat.openConversation).not.toHaveBeenCalled()
    expect(state.chat.selectedAgentId).toBe('900')
  })

  it('always uses the built-in Video Studio agent: no picker and no setup, even when the user has their own', async () => {
    await render()
    expect(state.studio).toHaveBeenCalled()
    expect(state.chat.selectedAgentId).toBe('900')
    expect(state.chat.agents.map((a) => a.id)).toEqual([7, 900])
    expect(wrapper.find('select').exists()).toBe(false)
    expect(wrapper.text()).not.toMatch(/Set up an agent|Choose a video agent/)
    expect(wrapper.find('[data-test="creation"]').exists()).toBe(true)
  })

  it('reopens an existing video session with the agent it was made with', async () => {
    state.route.query = { conversation: 'saved' }
    state.chat.openConversation.mockImplementation(async (cid) => { state.chat.conversationId = cid; state.chat.selectedAgentId = '7' })
    await render()
    expect(state.chat.setAgent).not.toHaveBeenCalled()
    expect(state.chat.selectedAgentId).toBe('7')
  })

  it('says so plainly when Video Studio cannot be reached', async () => {
    state.studio.mockRejectedValueOnce(new Error('503'))
    await render()
    expect(wrapper.get('[role="alert"]').text()).toContain('Video Studio is not available right now')
    expect(button('Try again')).toBeDefined()
  })

  it('adds the files queued on the Library page once the agent is ready', async () => {
    state.video.queuedUse = [{ kind: 'file', item: { attachment_id: 'a1' }, role: 'subject' }]
    await render()
    expect(state.video.applyQueuedUse).toHaveBeenCalled()
  })

  it('says plainly when the platform has not set a video model for the Studio agent yet', async () => {
    state.studio.mockResolvedValue({ data: { id: 900, name: 'Video Studio', video_model: null, is_builtin_agent: true } })
    await render()
    expect(wrapper.get('[data-test="studio-not-ready"]').text()).toContain('can’t render yet')
    expect(wrapper.find('[data-test="creation"]').exists()).toBe(false)
  })

  it('opens Home with Agent selected and both composer modes available', async () => {
    await render()
    expect(wrapper.get('h1').text()).toBe('Home')
    expect(wrapper.findAll('[data-test="studio-prompt"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-test="studio-start"]')).toHaveLength(0)
    expect(wrapper.findComponent({ name: 'VideoComposerPanel' }).props('showMode')).toBe(true)
    expect(wrapper.get('[data-test="studio-mode-agent"]').attributes('aria-checked')).toBe('true')
    expect(wrapper.get('[data-test="studio-mode-manual"]').exists()).toBe(true)
    expect(state.video.studioMode).toBe('agent')
    expect(state.chat.sendMessage).not.toHaveBeenCalled()
  })

  it('keeps an existing Manual choice when Home opens', async () => {
    state.video.studioMode = 'manual'
    localStorage.setItem('aadml.studio.mode.existing-person', 'manual')
    await render({id:'existing-person'})
    expect(wrapper.get('[data-test="studio-mode-manual"]').attributes('aria-checked')).toBe('true')
    expect(state.chat.studioMode).toBe('manual')
    expect(state.video.sendAgentMessage).not.toHaveBeenCalled()
    expect(state.post).not.toHaveBeenCalled()
  })

  it('switches Home modes without sending or losing the draft; Manual keeps its estimate shortcut', async () => {
    await render()
    await wrapper.get('[data-test="studio-mode-manual"]').trigger('click')
    expect(state.video.setStudioMode).toHaveBeenCalledWith('manual')
    expect(state.chat.studioMode).toBe('manual')
    expect(wrapper.get('[data-test="studio-prompt"]').element.value).toBe('A product reveal')
    expect(wrapper.get('[data-test="studio-send-message"]').classes()).toContain('quiet')
    expect(state.chat.sendMessage).not.toHaveBeenCalled()
    expect(state.post).not.toHaveBeenCalled()
    const prompt = wrapper.get('[data-test="studio-prompt"]')
    await prompt.trigger('keydown', { key: 'Enter' })
    expect(submitSpy).not.toHaveBeenCalled()
    await prompt.trigger('keydown', { key: 'Enter', ctrlKey: true })
    expect(submitSpy).toHaveBeenCalledOnce()
    await wrapper.get('[data-test="studio-mode-agent"]').trigger('click')
    expect(state.chat.studioMode).toBe('agent')
    expect(wrapper.get('[data-test="studio-send-message"]').classes()).not.toContain('quiet')
  })

  it('"Send message" sends the prompt to the agent as a plain message and clears it', async () => {
    state.chat.conversationId = 'c1'
    state.route.query = { conversation: 'c1' }
    await render()
    await wrapper.get('[data-test="studio-send-message"]').trigger('click')
    await flushPromises()
    expect(state.chat.sendMessage).toHaveBeenCalledWith('A product reveal')
    expect(state.video.studioDraft).toBe('')
  })

  it('Enter sends from the Home Agent prompt; Shift+Enter keeps a newline', async () => {
    await render()
    const prompt = wrapper.get('[data-test="studio-prompt"]')
    await prompt.trigger('keydown', { key:'Enter', shiftKey:true })
    expect(state.video.sendAgentMessage).not.toHaveBeenCalled()
    await prompt.trigger('keydown', { key:'Enter' }); await flushPromises()
    expect(state.video.sendAgentMessage).toHaveBeenCalledWith({ prompt:'A product reveal', chat:state.chat })
    expect(submitSpy).not.toHaveBeenCalled()
  })

  it('prevents switching sessions while the assistant is working', async () => {
    state.chat.conversationId = 'saved-session'
    await render()
    state.chat.isBusy = true
    await wrapper.vm.$nextTick()
    expect(button('New').attributes('disabled')).toBeDefined()
  })

  // Owner, 2026-10-20: "nothing happening when click" on the start screen. The Library opens there too (it is
  // mounted by the page, not by the canvas, which is absent before the first message), and "New video" is shown
  // only once a chat is open, since the start screen already is a new video.
  it('opens the Library from the start screen and shows "New" only in a chat', async () => {
    await render()
    expect(wrapper.find('[data-test="studio-create"]').exists()).toBe(true)
    expect(button('New')).toBeUndefined()
    await wrapper.get('[data-test="studio-open-library"]').trigger('click')
    expect(wrapper.find('[data-test="library"]').exists()).toBe(true)
    state.chat.conversationId = 'saved-session'
    await flushPromises()
    expect(button('New')).toBeDefined()
    expect(wrapper.findAll('[data-test="library"]')).toHaveLength(1)
  })

  it('does not redirect back after leaving while the studio is loading', async () => {
    let finish
    const card = await state.studio()
    state.studio.mockImplementationOnce(() => new Promise((resolve) => { finish = () => resolve(card) }))
    wrapper = mount(VideoStudio, { global: { stubs } })
    wrapper.unmount(); wrapper = null
    finish()
    await flushPromises()
    expect(state.replace).not.toHaveBeenCalled()
  })

  it('opens with the Studio agent only, never walking the whole agent library', async () => {
    await render()
    expect(state.studio).toHaveBeenCalled()
    expect(state.chat.loadAgents).not.toHaveBeenCalled()
  })

  it('starts on the create screen, and shows the workspace with the agent once a video session exists', async () => {
    await render()
    expect(wrapper.find('[data-test="studio-create"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('What do you want to make?')
    expect(wrapper.find('[data-test="workspace"]').exists()).toBe(false)
    state.chat.conversationId = 'c9'
    await flushPromises()
    expect(wrapper.find('[data-test="studio-create"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="workspace"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="studio-send-message"]').exists()).toBe(true)
  })

  it('in the workspace Enter sends to the agent and Shift+Enter does not', async () => {
    state.route.query = { conversation: 'c1' }
    state.chat.openConversation.mockImplementation(async (cid) => { state.chat.conversationId = cid })
    await render()
    const prompt = wrapper.get('[data-test="studio-prompt"]')
    await prompt.trigger('keydown', { key: 'Enter', shiftKey: true })
    expect(state.chat.sendMessage).not.toHaveBeenCalled()
    await prompt.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(state.chat.sendMessage).toHaveBeenCalledWith('A product reveal')
    expect(submitSpy).not.toHaveBeenCalled()
  })

  it('has one main action on the page: the page bar actions are secondary and there is no second way back', async () => {
    await render()
    expect(wrapper.find('.bar .primary').exists()).toBe(false)
    expect(button('Back to chat')).toBeUndefined()
    expect(wrapper.text()).not.toMatch(/CREATE|REFINE|EXPORT/)
  })
})

it('shares Home mode preferences with feature pages and isolates each signed-in person', async () => {
  const person=ref({id:'round5-owner'})
  await render(person)
  await wrapper.get('[data-test="studio-mode-manual"]').trigger('click')
  expect(localStorage.getItem('aadml.studio.mode.round5-owner')).toBe('manual')
  person.value={id:'another-person'}; await flushPromises()
  expect(state.video.studioMode).toBe('agent')
  person.value={id:'round5-owner'}; await flushPromises()
  expect(state.video.studioMode).toBe('manual')
  await wrapper.get('[data-test="studio-mode-agent"]').trigger('click')
  expect(localStorage.getItem('aadml.studio.mode.round5-owner')).toBe('agent')
  wrapper.unmount()
  wrapper=mount({setup(){return useStudioExperience('image')},template:'<p>{{ isAgent }}</p>'},{global:{provide:{studioUser:person}}})
  expect(wrapper.text()).toBe('true')
})
