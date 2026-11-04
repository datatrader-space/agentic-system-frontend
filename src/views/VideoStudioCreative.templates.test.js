// @vitest-environment jsdom
// A creative page used from My templates (?template=<id>) and its unsent draft on this device.
import { defineComponent, h, provide, reactive, ref } from 'vue'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
const state = vi.hoisted(() => ({ route: null, replace: null, chat: null, video: null, freshStart: null }))
vi.mock('../services/api', () => ({ default: { getStudioFeatures: vi.fn(), get: vi.fn(), post: vi.fn(), getMediaRoutes: vi.fn(), getStudioRecipes: vi.fn(), getCharacterTraits: vi.fn(), getIdentities: vi.fn(), getStudioElements: vi.fn(), getStudioRoutes: vi.fn(), getCinemaControls: vi.fn() } }))
vi.mock('vue-router', () => ({ useRoute: () => state.route, useRouter: () => ({ push: vi.fn(), replace: state.replace }) }))
vi.mock('../composables/useNotify', () => ({ notify: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }))
vi.mock('../composables/useStudioSession', () => ({ useStudioSession: () => ({ chat: state.chat, video: state.video, ready: ref(true), loading: ref(false), error: ref(''), initialize: vi.fn(), freshStart: state.freshStart }) }))
import Creative from './VideoStudioCreative.vue'
import api from '../services/api'
import { useVideoStore } from '../stores/useVideoStore'
import { studioLooks } from '../services/studioLooks'
import { composePreset } from '../services/studioPresets'
import { provideStudioTemplates } from '../composables/useStudioTemplates'
import { studioDraftKey } from '../services/studioDrafts'

const panel = { name: 'StudioAgentPanel', props: ['modelValue', 'label', 'ready', 'look'], emits: ['update:modelValue', 'sent', 'new'], template: '<section data-test="agent-panel"><textarea :value="modelValue" /></section>' }
const stubs = { RouterLink: { props: ['to'], template: '<a><slot /></a>' }, StudioJobList: true, AgentMadeMedia: true, StudioVersions: true, StudioAgentPanel: panel, StudioLookMedia: true, StudioCreativeCanvas: true }
const look = studioLooks.find(item => item.feature === 'music' && item.variables?.length)
const texts = Object.fromEntries(look.variables.map((field, i) => [field.label, i === 0 ? 'My own words' : field.default]))
const prompt = composePreset({ ...look, variants: [], variables: look.variables.map(field => ({ ...field, default: texts[field.label] })) })
let wrapper, pinia
function mountPage(query = {}) {
  state.route = reactive({ path: '/video-studio/music', query })
  const user = ref({ id: 'person' })
  const Host = defineComponent({ setup() { provide('studioUser', user); provideStudioTemplates(user); return () => h(Creative, { featureId: 'music' }) } })
  wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pinia], stubs } })
  return flushPromises()
}
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear()
  pinia = createPinia(); setActivePinia(pinia)
  state.replace = vi.fn(async location => { state.route.query = location.query })
  state.chat = reactive({ conversationId: null, studioContext: null, isBusy: false, hitlRequests: [], ensureConversation: vi.fn() })
  state.video = useVideoStore(); state.video.studioMode = 'agent'
  state.freshStart = vi.fn().mockResolvedValue(true)
  for (const call of ['getMediaRoutes', 'getStudioRecipes', 'getCharacterTraits', 'getIdentities', 'getStudioElements', 'getStudioRoutes', 'getCinemaControls']) api[call].mockResolvedValue({ data: {} })
  api.getStudioFeatures.mockResolvedValue({ data: { features: [{ id: 'music', status: 'live', ready: true }] } })
  api.get.mockImplementation(async path => ({ data: path === '/video/templates/' ? { templates: [{ id: 4, page: 'music', base_look: look.id, title: 'My loop', prompt, variables: texts, settings: {} }, { id: 5, page: 'image', base_look: '', title: 'Elsewhere', prompt: 'x', variables: {}, settings: {} }] } : {} }))
})
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = '' })

it('Use fills the agent message and the look\'s texts, then leaves the URL on the look; nothing is sent', async () => {
  await mountPage({ template: '4', mode: 'agent' })
  expect(wrapper.findComponent(panel).props('modelValue')).toBe(prompt)
  expect(wrapper.findComponent(panel).props('look').id).toBe(look.id)
  expect(wrapper.findAll('.sld-fields input')[0].element.value).toBe('My own words')
  expect(state.route.query.template).toBeUndefined(); expect(state.route.query.preset).toBe(look.id)
  expect(api.post).not.toHaveBeenCalled(); expect(state.chat.ensureConversation).not.toHaveBeenCalled()
})

it('says so for a template that is not this person\'s or is for another page', async () => {
  await mountPage({ template: '404', mode: 'agent' })
  expect(wrapper.get('[data-test="studio-template-message"]').text()).toContain('not on your account')
  expect(wrapper.findComponent(panel).props('modelValue')).toBe('')
  wrapper.unmount()
  await mountPage({ template: '5', mode: 'agent' })
  expect(wrapper.get('[data-test="studio-template-message"]').text()).toContain('another page')
})

it('keeps the unsent message on this device, and removes it when it is sent and when New chat starts fresh', async () => {
  const key = studioDraftKey('person', 'music', '')
  await mountPage({ mode: 'agent' })
  wrapper.findComponent(panel).vm.$emit('update:modelValue', 'An unsent music idea'); await flushPromises()
  expect(JSON.parse(localStorage.getItem(key)).draft.agentDraft).toBe('An unsent music idea')
  wrapper.unmount(); await mountPage({ mode: 'agent' })
  expect(wrapper.findComponent(panel).props('modelValue')).toBe('An unsent music idea')
  wrapper.findComponent(panel).vm.$emit('update:modelValue', ''); wrapper.findComponent(panel).vm.$emit('sent'); await flushPromises()
  expect(localStorage.getItem(key)).toBeNull()
  wrapper.findComponent(panel).vm.$emit('update:modelValue', 'Another idea'); await flushPromises()
  expect(localStorage.getItem(key)).not.toBeNull()
  wrapper.findComponent(panel).vm.$emit('new'); await flushPromises()
  expect(state.freshStart).toHaveBeenCalled(); expect(localStorage.getItem(key)).toBeNull()
  expect(wrapper.findComponent(panel).props('modelValue')).toBe('')
})
