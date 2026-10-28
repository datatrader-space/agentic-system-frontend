// @vitest-environment jsdom
import { reactive, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import Creative from './VideoStudioCreative.vue'
import api from '../services/api'
import { CREATIVE_STUDIO_PAGES } from '../services/studioFeatures'
import { useVideoStore } from '../stores/useVideoStore'
const session = vi.hoisted(() => ({ chat: null, video: null }))
vi.mock('../services/api', () => ({ default: { getStudioFeatures:vi.fn(), get:vi.fn(), post:vi.fn(), getMediaRoutes:vi.fn(), getStudioRecipes:vi.fn(), getCharacterTraits:vi.fn(), getIdentities:vi.fn(), getStudioElements:vi.fn(), getStudioRoutes:vi.fn(), getCinemaControls:vi.fn() } }))
vi.mock('vue-router', () => ({ useRoute: () => ({ query:{} }), useRouter: () => ({ push:vi.fn(), replace:vi.fn() }) }))
vi.mock('../composables/useNotify', () => ({ notify: { error:vi.fn(), success:vi.fn(), warning:vi.fn() } }))
vi.mock('../composables/useStudioSession', () => ({ useStudioSession: () => ({ chat: session.chat, video: session.video, ready: ref(true), loading: ref(false), error: ref(''), initialize: vi.fn() }) }))
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
  for (const call of ['getMediaRoutes','getStudioRecipes','getCharacterTraits','getIdentities','getStudioElements','getStudioRoutes','getCinemaControls','get']) api[call].mockResolvedValue({ data:{} })
})

describe('Creative suite readiness', () => {
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
