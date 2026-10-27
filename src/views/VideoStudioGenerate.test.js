// @vitest-environment jsdom
import { reactive, ref } from 'vue'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
const state = vi.hoisted(() => ({ chat: null, route: null, replace: vi.fn() }))
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), getVideoStudioAgent: vi.fn(), getAgent: vi.fn() }))
vi.mock('vue-router', () => ({ useRoute: () => state.route, useRouter: () => ({ replace: state.replace }) }))
vi.mock('../stores/useChatStore', () => ({ useChatStore: () => state.chat }))
vi.mock('../services/api', () => ({ default: api }))
vi.mock('../composables/useNotify', () => ({ notify: { warning: vi.fn(), error: vi.fn(), success: vi.fn() } }))
import VideoStudioGenerate from './VideoStudioGenerate.vue'
import { useVideoStore } from '../stores/useVideoStore'
import { clearStudioDraftMemory } from '../services/studioDraftMemory'
import { presetsFor } from '../services/studioPresets'
let wrapper, video
const stubs = {
  StudioSettings: true,
  StudioAgentPanel: { name: 'StudioAgentPanel', props: ['modelValue','preset','ready'], template: '<div data-test="agent-panel">{{ modelValue }}</div>' },
  InputSlot: { name: 'InputSlot', props: ['label','items'], template: '<div>{{ label }}</div>' },
  PresetGallery: { name: 'PresetGallery', props: ['presets','selected'], template: '<div>Preset gallery</div>' },
  ResultsFeed: { name: 'ResultsFeed', props: ['kind','conversationId'], template: '<div>Session results</div>' },
}
beforeEach(() => {
  vi.clearAllMocks(); clearStudioDraftMemory(); sessionStorage.clear(); localStorage.clear(); setActivePinia(createPinia())
  state.route = reactive({ path: '/video-studio/image', query: {} })
  state.replace.mockImplementation(async location => { state.route.query = location.query })
  state.chat = reactive({ agents: [], selectedAgentId: '', conversationId: null, isBusy: false, hitlRequests: [], error: '', messages: [], studioMode: '',
    get currentAgent() { return this.agents.find(agent => String(agent.id) === this.selectedAgentId) },
    loadAgents: vi.fn().mockResolvedValue(), setAgent: vi.fn(id => { state.chat.selectedAgentId = id }),
    reset: vi.fn(() => { state.chat.conversationId = null; state.chat.messages = []; state.chat.error = '' }),
    ensureConversation: vi.fn(async () => { state.chat.conversationId = 'new-owned-chat'; return 'new-owned-chat' }),
    openConversation: vi.fn(async id => { state.chat.conversationId = id }), sendMessage: vi.fn().mockResolvedValue(true),
  })
  api.getVideoStudioAgent.mockResolvedValue({ data: { id: 900, video_model: 1, image_model: 11 } })
  api.get.mockImplementation(async path => ({ data: path === '/video/image-capabilities/' ? { models: [{ model_id: 11, name: 'Synthetic image model', shapes: ['1:1','3:4','16:9'], max_references: 4 }], default_model_id: 11 } : { routes: [{ route_id: 'r1', name: 'Synthetic video model', state: 'active', offered: ['image_to_video','first_last_frame','reference_to_video'], outputs: { durations: [5], aspect_ratios: ['16:9','1:1'], resolutions: ['720p'], audio: false } }], default_route_id: 'r1' } }))
  api.post.mockRejectedValue(new Error('Unexpected direct write'))
  video = useVideoStore()
  vi.spyOn(video,'request'); vi.spyOn(video,'requestImage'); vi.spyOn(video,'start')
})
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = ''; vi.unstubAllGlobals() })
async function render(kind = 'image', userId = null, mode = 'manual') {
  state.route.path = `/video-studio/${kind}`
  wrapper = mount(VideoStudioGenerate, { attachTo: document.body, props: { kind }, global: { stubs, provide: { studioUser: ref(userId ? { id: userId } : null) } } })
  await flushPromises(); if (mode) { video.setStudioMode(mode); await flushPromises() }; return wrapper
}
function pickRequired() { wrapper.findAllComponents({ name: 'InputSlot' })[0].vm.$emit('pick', [{ attachment_id: 42, title: 'Owned reference', media_type: 'image', url: '/owned.png' }]) }

describe('Image and Video pages: per-run approval boundary', () => {
  it.each(['image','video'])('blocks the %s request while its required slot is empty', async kind => {
    await render(kind)
    expect(wrapper.get('[data-test="studio-generate"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.qb-reason').text()).toMatch(/Add .* to continue/)
    expect(state.chat.ensureConversation).not.toHaveBeenCalled()
    expect(video.request).not.toHaveBeenCalled(); expect(video.requestImage).not.toHaveBeenCalled(); expect(api.post).not.toHaveBeenCalled()
  })

  it.each(['image','video'])('sends %s through the existing store request and leaves spending to its card', async kind => {
    await render(kind); pickRequired(); await flushPromises()
    await wrapper.get('[data-test="studio-generate"]').trigger('click'); await flushPromises()
    const action = kind === 'image' ? video.requestImage : video.request
    expect(action).toHaveBeenCalledOnce(); expect(action).toHaveBeenCalledWith({ prompt: expect.any(String), chat: state.chat })
    expect(state.chat.ensureConversation).toHaveBeenCalledOnce()
    const [prompt, options] = state.chat.sendMessage.mock.calls[0]
    expect(prompt).toContain('supplied')
    expect(options[kind === 'image' ? 'imageRequest' : 'videoRequest'].references[0]).toEqual({ attachment_id: 42, role: kind === 'image' ? 'subject' : 'first_frame' })
    expect(video.start).not.toHaveBeenCalled(); expect(api.post).not.toHaveBeenCalled()
    expect(state.replace).toHaveBeenCalledWith({ path: `/video-studio/${kind}`, query: { conversation: 'new-owned-chat' } })
  })

  it('keeps inputs after a send failure, and choosing or shuffling a preset never sends', async () => {
    await render('image'); pickRequired(); await flushPromises()
    state.chat.sendMessage.mockResolvedValueOnce(false)
    await wrapper.get('[data-test="studio-generate"]').trigger('click'); await flushPromises()
    expect(video.refs).toHaveLength(1)
    expect(wrapper.get('[role="alert"]').text()).toContain('not sent')
    const calls = video.requestImage.mock.calls.length
    wrapper.findComponent({ name: 'PresetGallery' }).vm.$emit('select', presetsFor('image')[3]); await flushPromises()
    await wrapper.get('[aria-label="Shuffle preset variation"]').trigger('click')
    expect(video.requestImage).toHaveBeenCalledTimes(calls); expect(api.post).not.toHaveBeenCalled()
  })

  it('opens with the Studio agent only, never walking the whole agent library', async () => {
    await render('image')
    expect(api.getVideoStudioAgent).toHaveBeenCalled()
    expect(state.chat.loadAgents).not.toHaveBeenCalled()
  })

  it('reopens a bookmarked session without creating another conversation', async () => {
    state.route.query = { conversation: 'saved-owned-chat' }
    await render('video')
    expect(state.chat.openConversation).toHaveBeenCalledWith('saved-owned-chat')
    expect(video.conversationId).toBe('saved-owned-chat')
    expect(state.chat.ensureConversation).not.toHaveBeenCalled()
  })

  it('does not expose an old session when a bookmarked conversation is unavailable', async () => {
    state.route.query = { conversation: 'not-owned' }
    state.chat.openConversation.mockImplementation(async () => { state.chat.error = 'Not found' })
    await render('image')
    expect(wrapper.text()).toContain('session could not be opened')
    expect(wrapper.findComponent({ name: 'ResultsFeed' }).exists()).toBe(false)
    expect(api.post).not.toHaveBeenCalled(); expect(video.requestImage).not.toHaveBeenCalled()
  })

  it('does not reset or reassign an active request from another conversation', async () => {
    state.chat.conversationId = 'active'; state.chat.isBusy = true
    await render('image')
    expect(wrapper.text()).toContain('Finish or stop the current request')
    expect(state.chat.reset).not.toHaveBeenCalled(); expect(api.getVideoStudioAgent).not.toHaveBeenCalled()
  })
})


describe('Studio draft isolation and recovery', () => {
  it('does not read another authenticated user draft', async () => {
    sessionStorage.setItem('aadml.studio.f0.other.image.draft', JSON.stringify({ details: 'Private other draft' }))
    await render('image', 'current')
    expect(wrapper.get('textarea').element.value).toBe('')
  })
  it('restores only the current user draft and tolerates malformed stored lists', async () => {
    sessionStorage.setItem('aadml.studio.f0.current.image.draft', JSON.stringify({ details: 'Own direction', refs: {}, records: {} }))
    await render('image', 'current')
    expect(wrapper.get('textarea').element.value).toBe('Own direction')
    wrapper.findComponent({ name: 'ResultsFeed' }).vm.$emit('recreate', { title: 'Image' })
    await flushPromises()
    expect(wrapper.text()).toContain('Review the creative direction')
    expect(video.requestImage).not.toHaveBeenCalled()
  })
  it('keeps the page usable when browser draft storage is blocked', async () => {
    const blocked = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage unavailable') })
    await render('image', 'current')
    expect(wrapper.get('h1').text()).toBe('Image')
    expect(wrapper.get('.qb-reason').text()).toMatch(/Add .* to continue/)
    blocked.mockRestore()
  })
})


describe('Responsive preset selection', () => {
  it.each(['image','video'])('returns from the %s preset sheet to its first required empty slot', async kind => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
    await render(kind)
    expect(wrapper.get('.sg-preset-chip').text()).toBe(presetsFor(kind)[0].title)
    expect(wrapper.findAllComponents({ name: 'PresetGallery' })).toHaveLength(0)
    await wrapper.get('[data-test="studio-preset-picker-open"]').trigger('click'); await flushPromises()
    const gallery = wrapper.findComponent({ name: 'PresetGallery' })
    expect(gallery.exists()).toBe(true)
    gallery.vm.$emit('select', presetsFor(kind)[0]); await flushPromises()
    expect(wrapper.findComponent({ name: 'PresetGallery' }).exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('[data-studio-required-empty="true"]').element)
    expect(api.post).not.toHaveBeenCalled(); expect(video.request).not.toHaveBeenCalled(); expect(video.requestImage).not.toHaveBeenCalled()
  })
  it('skips an already filled required opening frame when focusing a new video preset', async () => {
    await render('video'); pickRequired(); await flushPromises()
    wrapper.findComponent({ name: 'PresetGallery' }).vm.$emit('select', presetsFor('video').find(preset => preset.id === 'two-moments')); await flushPromises()
    expect(document.activeElement.textContent).toContain('Closing frame')
    expect(document.activeElement.getAttribute('data-studio-required-empty')).toBe('true')
  })
})


describe('Round 2 generator flow', () => {
  it.each(['image','video'])('opens %s in Agent mode and choosing a preset only fills the composer', async kind => {
    await render(kind, 'person', null)
    expect(video.studioMode).toBe('agent')
    expect(wrapper.get('[data-test="studio-mode-agent"]').attributes('aria-checked')).toBe('true')
    wrapper.findComponent({ name: 'PresetGallery' }).vm.$emit('select', presetsFor(kind)[1]); await flushPromises()
    expect(wrapper.findComponent({ name: 'StudioAgentPanel' }).props('modelValue')).toBe(`Use this preset: ${presetsFor(kind)[1].title}.`)
    expect(state.chat.sendMessage).not.toHaveBeenCalled(); expect(video.start).not.toHaveBeenCalled()
    expect(video.request).not.toHaveBeenCalled(); expect(video.requestImage).not.toHaveBeenCalled()
  })
  it('remembers Manual per person and dismisses a page hint only for that person', async () => {
    localStorage.setItem('aadml.studio.mode.person', 'manual')
    await render('image','person',null)
    expect(video.studioMode).toBe('manual')
    await wrapper.get('[data-test="studio-first-visit"] button').trigger('click')
    expect(wrapper.find('[data-test="studio-first-visit"]').exists()).toBe(false)
    expect(localStorage.getItem('aadml.studio.hint.person.image')).toBe('dismissed')
    wrapper.unmount(); await render('image','other',null)
    expect(video.studioMode).toBe('agent'); expect(wrapper.find('[data-test="studio-first-visit"]').exists()).toBe(true)
  })
  it('writes an editable prompt through the existing chat path without generating, preserving references', async () => {
    await render('image'); pickRequired(); await flushPromises()
    state.chat.pendingAttachments = []; state.chat.addExistingMedia = vi.fn()
    state.chat.sendMessage.mockImplementation(async text => { state.chat.messages.push({ role: 'assistant', content: JSON.stringify({ prompt: 'Soft **side light** on the supplied product.', question: null }) }); return true })
    await wrapper.get('[data-test="studio-write-prompt"]').trigger('click'); await flushPromises()
    expect(wrapper.get('.sg-manual textarea').element.value).toBe('Soft side light on the supplied product.')
    expect(state.chat.sendMessage.mock.calls[0][0]).toContain('Do not generate media')
    expect(video.refs[0].attachment_id).toBe(42)
    expect(video.requestImage).not.toHaveBeenCalled(); expect(video.request).not.toHaveBeenCalled(); expect(video.start).not.toHaveBeenCalled()
  })
  it('applies only supported settings from the text suggestion', async () => {
    await render('image')
    state.chat.pendingAttachments = []; state.chat.addExistingMedia = vi.fn()
    state.chat.sendMessage.mockImplementation(async () => { state.chat.messages.push({ role: 'assistant', content: '{"model":"11","shape":"3:4","count":2,"endpoint":"unsafe"}' }); return true })
    await wrapper.get('[data-test="studio-suggest-settings"]').trigger('click'); await flushPromises()
    expect(video.image.aspect_ratio).toBe('3:4'); expect(video.image.n).toBe(2)
    expect(api.post).not.toHaveBeenCalled(); expect(video.start).not.toHaveBeenCalled()
  })
  it('switches to My results on approval and on a new queued job', async () => {
    await render('video',null,null)
    wrapper.findComponent({ name: 'StudioAgentPanel' }).vm.$emit('approved'); await flushPromises()
    expect(wrapper.get('[role="tab"][aria-selected="true"]').text()).toBe('My results')
    await wrapper.get('[role="tab"]').trigger('click')
    video.conversationId = 'c1'; video._put({ job_id:'new', conversation_id:'c1', state:'queued' }); await flushPromises()
    expect(wrapper.get('[role="tab"][aria-selected="true"]').text()).toBe('My results')
  })
  it('clears the preset after Use in and keeps the supplied opening frame in its slot', async () => {
    state.route.query = { useIn:'1', mode:'manual' }
    video.addExistingRef({ attachment_id: 99, title:'Handoff', media_type:'image' }, 'first_frame'); video.refs[0].studioSlot = 'opening'
    await render('video','person')
    expect(wrapper.get('.sg-preset-chip').text()).toBe('Your own idea')
    expect(wrapper.findAllComponents({ name:'InputSlot' })[0].props('label')).toBe('Opening frame')
    expect(wrapper.findAllComponents({ name:'InputSlot' })[0].props('items')[0].attachment_id).toBe(99)
  })
})

it('saves the source draft before a handoff and does not overwrite it with the destination input', async () => {
  await render('image','person'); pickRequired(); await flushPromises()
  await wrapper.get('.sg-manual textarea').setValue('Keep this direction'); await flushPromises()
  window.dispatchEvent(new Event('studio-save-draft'))
  video.refs = []; video.addExistingRef({ attachment_id:100,title:'Destination input',media_type:'image' },'first_frame'); await flushPromises()
  const saved = JSON.parse(sessionStorage.getItem('aadml.studio.f0.person.image.draft'))
  expect(saved.details).toBe('Keep this direction'); expect(saved.refs.map(r => r.attachment_id)).toEqual([42])
})

it('shows a newly returned image in My results for the F-D7a session path, without requesting or approving another run', async () => {
  await render('image',null,null)
  video.sessionImages = [{ attachment_id:81,url:'/synthetic-result.png',created_at:'2026-10-21' }]; await flushPromises()
  expect(wrapper.get('[role="tab"][aria-selected="true"]').text()).toBe('My results')
  expect(video.requestImage).not.toHaveBeenCalled(); expect(video.start).not.toHaveBeenCalled()
})

it('keeps an unuploaded local file in tab memory when returning to the source page after Use in', async () => {
  await render('image','file-owner')
  vi.stubGlobal('URL', class extends URL { static createObjectURL() { return 'blob:synthetic-local-file' }; static revokeObjectURL() {} })
  const file = new File(['synthetic'], 'product.png', {type:'image/png'})
  wrapper.findComponent({name:'InputSlot'}).vm.$emit('add-files',[file]); await flushPromises()
  await wrapper.get('.sg-manual textarea').setValue('Keep my local product'); await flushPromises()
  window.dispatchEvent(new Event('studio-save-draft')); video.refs=[]; await flushPromises()
  wrapper.unmount(); await render('image','file-owner')
  expect(video.refs[0].file).toBe(file)
  expect(wrapper.get('.sg-manual textarea').element.value).toBe('Keep my local product')
  expect(sessionStorage.getItem('aadml.studio.f0.file-owner.image.draft')).not.toContain('blob:')
})


describe('Agent references beside the conversation', () => {
  it.each(['image','video'])('moves %s inputs right in Agent mode and back into the Manual form without losing references', async kind => {
    await render(kind, 'person', null)
    expect(wrapper.find('.st-controls [data-test="studio-reference-inputs"]').exists()).toBe(false)
    expect(wrapper.find('.st-output .st-reference-panel [data-test="studio-reference-inputs"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-test="studio-reference-inputs"]')).toHaveLength(1)
    pickRequired(); await flushPromises()
    const key = video.refs[0].key
    await wrapper.get('[data-test="studio-mode-manual"]').trigger('click'); await flushPromises()
    expect(wrapper.find('.st-reference-panel').exists()).toBe(false)
    expect(wrapper.find('.st-controls [data-test="studio-reference-inputs"]').exists()).toBe(true)
    expect(wrapper.findAllComponents({name:'InputSlot'})[0].props('items')[0].key).toBe(key)
    await wrapper.get('[data-test="studio-mode-agent"]').trigger('click'); await flushPromises()
    expect(wrapper.find('.st-output [data-test="studio-reference-inputs"]').exists()).toBe(true)
    expect(video.refs[0].attachment_id).toBe(42)
    expect(video.request).not.toHaveBeenCalled(); expect(video.requestImage).not.toHaveBeenCalled(); expect(video.start).not.toHaveBeenCalled()
    expect(state.chat.sendMessage).not.toHaveBeenCalled(); expect(api.post).not.toHaveBeenCalled()
  })
  it('on phones keeps chat first and focuses the required input below it after a preset choice', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
    await render('image', 'person', null)
    const conversation = wrapper.get('[data-test="agent-panel"]').element
    const inputs = wrapper.get('.st-reference-panel').element
    expect(conversation.compareDocumentPosition(inputs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await wrapper.get('[data-test="studio-preset-picker-open"]').trigger('click'); await flushPromises()
    wrapper.findComponent({name:'PresetGallery'}).vm.$emit('select',presetsFor('image')[0]); await flushPromises()
    expect(document.activeElement).toBe(wrapper.get('.st-reference-panel [data-studio-required-empty="true"]').element)
    expect(wrapper.findComponent({name:'PresetGallery'}).exists()).toBe(false)
    expect(state.chat.sendMessage).not.toHaveBeenCalled()
  })
})

it.each(['image','video'])('expands the %s chat workspace without replacing its references or draft, and restores Manual layout', async kind => {
  await render(kind,'person',null)
  pickRequired(); await flushPromises()
  const panel=wrapper.findComponent({name:'StudioAgentPanel'})
  const draft=panel.props('modelValue'), reference=video.refs[0].key
  panel.vm.$emit('update:expanded',true); await flushPromises()
  expect(wrapper.get('.st-page').classes()).toContain('st-chat-expanded')
  expect(video.refs[0].key).toBe(reference)
  expect(panel.props('modelValue')).toBe(draft)
  await wrapper.get('[data-test="studio-mode-manual"]').trigger('click'); await flushPromises()
  expect(wrapper.get('.st-page').classes()).not.toContain('st-chat-expanded')
  expect(video.request).not.toHaveBeenCalled(); expect(video.requestImage).not.toHaveBeenCalled()
  expect(state.chat.sendMessage).not.toHaveBeenCalled()
})


describe('Round 3 structured assistance', () => {
  it.each(['prompt', 'settings'])('leaves the form unchanged for a %s question', async type => {
    await render('image')
    await wrapper.get('.sg-manual textarea').setValue('Keep my direction')
    const before = JSON.stringify(video.image)
    state.chat.pendingAttachments = []; state.chat.addExistingMedia = vi.fn()
    state.chat.sendMessage.mockImplementation(async () => { state.chat.messages.push({ role:'assistant', content:JSON.stringify({ prompt:'Do not apply this', question:'**What** is your product?', shape:'3:4', count:4 }) }); return true })
    await wrapper.get(`[data-test="studio-${type === 'prompt' ? 'write-prompt' : 'suggest-settings'}"]`).trigger('click'); await flushPromises()
    expect(wrapper.get('.sg-manual textarea').element.value).toBe('Keep my direction')
    expect(JSON.stringify(video.image)).toBe(before)
    expect(wrapper.get('[data-test="studio-helper-note"]').text()).toBe('The agent needs: What is your product?')
    expect(wrapper.text()).not.toContain('Prompt added')
    expect(video.requestImage).not.toHaveBeenCalled(); expect(video.start).not.toHaveBeenCalled()
    expect(state.chat.sendMessage.mock.calls[0][0]).toContain('question')
  })
  it.each(['What is your subject?', '["prompt"]', '{"prompt":null,"question":null}', '{"prompt":42}'])('never pastes an invalid prompt reply: %s', async reply => {
    await render('image')
    await wrapper.get('.sg-manual textarea').setValue('Original direction')
    state.chat.pendingAttachments = []; state.chat.addExistingMedia = vi.fn()
    state.chat.sendMessage.mockImplementation(async () => { state.chat.messages.push({role:'assistant',content:reply}); return true })
    await wrapper.get('[data-test="studio-write-prompt"]').trigger('click'); await flushPromises()
    expect(wrapper.get('.sg-manual textarea').element.value).toBe('Original direction')
    expect(wrapper.get('[data-test="studio-helper-note"]').text()).toBe('The agent could not write a prompt. Try again or describe your idea.')
  })
})


describe('Manual helpers name the page and preset as the studio_context field', () => {
  it.each(['prompt','settings'])('sends a %s helper request marked as a helper, with no page text', async type => {
    await render('image')
    state.chat.pendingAttachments=[]; state.chat.addExistingMedia=vi.fn()
    let sentContext=null
    state.chat.sendMessage.mockImplementation(async () => {sentContext={...state.chat.studioContext};state.chat.messages.push({role:'assistant',content:'{"prompt":null,"question":"Which product?"}'});return true})
    await wrapper.get(`[data-test="studio-${type === 'prompt' ? 'write-prompt' : 'suggest-settings'}"]`).trigger('click'); await flushPromises()
    const wire=state.chat.sendMessage.mock.calls[0][0]
    const preset=presetsFor('image')[0]
    expect(sentContext).toEqual({ page:'image', preset:preset.id, preset_title:preset.title, helper:type })
    expect(state.chat.studioContext).toEqual({ page:'image', preset:preset.id, preset_title:preset.title })   // helper only for that message
    expect(wire).not.toMatch(/^I am on the/)
    const { presentStudioMessage }=await import('../services/studioMessagePresentation')
    const request={role:'user',content:wire},reply={role:'assistant',content:'{"prompt":null,"question":"Which product?"}'}
    expect(presentStudioMessage(request).content).toBe(type==='prompt'?'You asked for a prompt':'You asked for settings')
    expect(presentStudioMessage(reply,[request,reply]).content).toBe('The agent asked: Which product?')
    expect(video.requestImage).not.toHaveBeenCalled();expect(video.request).not.toHaveBeenCalled();expect(video.start).not.toHaveBeenCalled()
  })
})
