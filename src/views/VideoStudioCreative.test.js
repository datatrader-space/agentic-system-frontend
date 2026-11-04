// @vitest-environment jsdom
import { reactive, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import Creative from './VideoStudioCreative.vue'
import api from '../services/api'
import { CREATIVE_STUDIO_PAGES } from '../services/studioFeatures'
import { useVideoStore } from '../stores/useVideoStore'
import { studioLooks, LOOK_ID } from '../services/studioLooks'
const session = vi.hoisted(() => ({ chat: null, video: null, freshStart: null }))
vi.mock('../services/api', () => ({ default: { getStudioFeatures:vi.fn(), get:vi.fn(), post:vi.fn(), getMediaRoutes:vi.fn(), getStudioRecipes:vi.fn(), getCharacterTraits:vi.fn(), getIdentities:vi.fn(), getStudioElements:vi.fn(), getStudioRoutes:vi.fn(), getCinemaControls:vi.fn() } }))
vi.mock('vue-router', () => ({ useRoute: () => ({ query:{} }), useRouter: () => ({ push:vi.fn(), replace:vi.fn() }) }))
vi.mock('../composables/useNotify', () => ({ notify: { error:vi.fn(), success:vi.fn(), warning:vi.fn() } }))
vi.mock('../composables/useStudioSession', () => ({ useStudioSession: () => ({ chat: session.chat, video: session.video, ready: ref(true), loading: ref(false), error: ref(''), initialize: vi.fn(), freshStart: session.freshStart }) }))
const stubs = { RouterLink:{ props:['to'], template:'<a :href="to"><slot /></a>' }, StudioJobList:{ props:['ids'], template:'<ul data-test="job-ids">{{ ids.join(",") }}</ul>' }, StudioAgentPanel:{ props:['label','ready'], template:'<section data-test="agent-panel">{{ label }} agent</section>' } }
let pinia
// Attached, so v-show's hidden state is what isVisible() reads.
const mountPage = id => mount(Creative,{ props:{ featureId:id }, attachTo: document.body, global:{ plugins:[pinia], stubs } })
const notReady = id => ({ data:{ features:[{ id, status:'live', ready:false, code:'no_proven_model', reason:'No proven model is configured.' }] } })
beforeEach(() => {
  vi.clearAllMocks()
  pinia = createPinia(); setActivePinia(pinia)
  session.chat = reactive({ conversationId: null, studioContext: null, ensureConversation: vi.fn() })
  session.video = useVideoStore()
  session.video.studioMode = 'manual'
  session.freshStart = vi.fn().mockResolvedValue(true)
  for (const call of ['getMediaRoutes','getStudioRecipes','getCharacterTraits','getIdentities','getStudioElements','getStudioRoutes','getCinemaControls','get']) api[call].mockResolvedValue({ data:{} })
})

describe('Creative suite readiness', () => {
  it('keeps setup information compact in Agent and open in Manual without bypassing readiness', async () => {
    api.getStudioFeatures.mockResolvedValue(notReady('lipsync'))
    const w = mountPage('lipsync'); await flushPromises()
    const notice = w.get('[data-test="studio-not-ready"]')
    expect(notice.element.tagName).toBe('DETAILS')
    expect(notice.attributes('open')).toBeUndefined()
    expect(notice.get('summary').text()).toBe('Generation setup needed')
    await w.get('[data-test="studio-mode-manual"]').trigger('click')
    expect(notice.attributes('open')).toBeDefined()
    expect(notice.text()).toContain('No proven model is configured.')
    expect(api.post).not.toHaveBeenCalled()
    w.unmount()
  })
  it.each(CREATIVE_STUDIO_PAGES)('%s fails closed without provider readiness', async id => {
    api.getStudioFeatures.mockResolvedValue(notReady(id))
    const w = mountPage(id); await flushPromises()
    expect(w.text()).toContain('No proven model is configured.')
    // Models are the platform's: nobody is sent to add a key (backend PAYMENTS_TOPUP_PLAN.md §7).
    expect(w.find('[data-test="studio-not-ready"] a').exists()).toBe(false)
    expect(w.text()).toContain('added by a platform administrator')
    expect(api.post).not.toHaveBeenCalled(); w.unmount()
  })
  it('keeps local-tools refusals free of irrelevant provider links',async () => {
    api.getStudioFeatures.mockResolvedValue({data:{features:[{id:'editor',ready:false,code:'no_local_tools',reason:'ffmpeg is unavailable.'}]}})
    const w = mountPage('editor'); await flushPromises(); expect(w.text()).toContain('ffmpeg is unavailable.'); expect(w.find('[data-test="studio-not-ready"] a').exists()).toBe(false); w.unmount()
  })
  it('does not act when the availability service fails',async () => {
    api.getStudioFeatures.mockRejectedValue(Error('offline')); const w=mountPage('music'); await flushPromises(); expect(w.text()).toContain('Could not check availability'); expect(api.post).not.toHaveBeenCalled(); w.unmount()
  })
})

describe('Agent and Manual mode on every making page', () => {
  it.each(studioLooks.filter(look => CREATIVE_STUDIO_PAGES.includes(look.feature)))('$id can be selected without starting work or trusting its client-only id', async look => {
    api.getStudioFeatures.mockResolvedValue({ data:{features:[{id:look.feature,status:'live',ready:true}]} })
    const w=mountPage(look.feature);await flushPromises()
    await w.get('[data-test="studio-agent-preset"]').setValue(look.id)
    // The look is named with every message and Manual request, when its id is one the backend accepts.
    expect(session.chat.studioContext).toEqual(LOOK_ID.test(look.id) ? { page:look.feature, preset:look.id, preset_title:String(look.title).slice(0,200) } : { page:look.feature })
    expect(api.post).not.toHaveBeenCalled()
    expect(w.get('h1').text()).toBe(look.title)
    w.unmount()
  })
  it('New chat clears the look so the fresh chat does not send the previous preset', async () => {
    const look = studioLooks.find(item => CREATIVE_STUDIO_PAGES.includes(item.feature) && LOOK_ID.test(item.id))
    api.getStudioFeatures.mockResolvedValue({ data:{features:[{id:look.feature,status:'live',ready:true}]} })
    const w=mountPage(look.feature);await flushPromises()
    await w.get('[data-test="studio-agent-preset"]').setValue(look.id)
    expect(session.chat.studioContext.preset).toBe(look.id)
    await w.getComponent({ name:'StudioPage' }).vm.$emit('new'); await flushPromises()
    expect(session.freshStart).toHaveBeenCalled()
    expect(session.chat.studioContext).toEqual({ page:look.feature })
    expect(w.get('h1').text()).not.toBe(look.title)
    w.unmount()
  })
  it.each(CREATIVE_STUDIO_PAGES)('%s shows the switch, the agent in Agent mode and the page form in Manual mode', async id => {
    api.getStudioFeatures.mockResolvedValue({ data:{ features:[{ id, status:'live', ready:true }] } })
    session.video.studioMode = 'agent'
    const w = mountPage(id); await flushPromises()
    expect(w.find('[data-test="studio-mode"]').exists()).toBe(true)
    expect(w.get('[data-test="agent-panel"]').isVisible()).toBe(true)
    expect(w.get('[data-test="studio-manual"]').isVisible()).toBe(false)
    await w.get('[data-test="studio-mode-manual"]').trigger('click')
    expect(w.get('[data-test="agent-panel"]').isVisible()).toBe(false)
    expect(w.get('[data-test="studio-manual"]').isVisible()).toBe(true)
    expect(api.post).not.toHaveBeenCalled(); w.unmount()
  })
  it('shows the jobs the agent proposed in this session next to the ones asked for here', async () => {
    api.getStudioFeatures.mockResolvedValue({ data:{ features:[{ id:'audio', status:'live', ready:true }] } })
    session.chat.conversationId = 'c1'
    session.video._put({ job_id:'agent-job', conversation_id:'c1', state:'awaiting_authorization', created_at:'2026-10-26T10:00:00Z' })
    session.video._put({ job_id:'other-chat', conversation_id:'c2', state:'awaiting_authorization', created_at:'2026-10-26T10:00:00Z' })
    const w = mountPage('audio'); await flushPromises()
    expect(w.get('[data-test="job-ids"]').text()).toBe('agent-job'); w.unmount()
  })
})

describe('Versions on a creative page', () => {
  it('a picture page lists image versions and every other page video takes', async () => {
    api.getStudioFeatures.mockResolvedValue({ data:{ features:[] } })
    const versionStub = { StudioVersions:{ name:'StudioVersions', props:['type'], template:'<div data-test="versions" />' } }
    for (const [id, type] of [['edit','image'], ['characters','image'], ['music','video']]) {
      const w = mount(Creative,{ props:{ featureId:id }, global:{ plugins:[pinia], stubs:{ ...stubs, ...versionStub, StudioPage:{ template:'<div><slot name="versions" /></div>' } } } })
      await flushPromises()
      expect(w.getComponent({ name:'StudioVersions' }).props('type')).toBe(type)
      w.unmount()
    }
  })
})
