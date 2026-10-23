// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import Creative from './VideoStudioCreative.vue'
import api from '../services/api'
vi.mock('../services/api', () => ({ default: { getStudioFeatures:vi.fn(), get:vi.fn(), post:vi.fn() } }))
vi.mock('vue-router', () => ({ useRoute: () => ({ query:{} }), useRouter: () => ({ push:vi.fn() }) }))
vi.mock('../composables/useNotify', () => ({ notify: { error:vi.fn(), success:vi.fn(), warning:vi.fn() } }))
const pages = ['music','storyboard','cinema','editor','ads','marketing','ad-remix','shorts','explainer','canvas']
const mountPage = id => mount(Creative,{ props:{ featureId:id }, global:{ plugins:[createPinia()], stubs:{ RouterLink:{ props:['to'], template:'<a :href="to"><slot /></a>' }, StudioJobList:true } } })
describe('Creative suite readiness', () => {
  beforeEach(() => vi.clearAllMocks())
  it.each(pages)('%s fails closed without provider readiness', async id => {
    api.getStudioFeatures.mockResolvedValue({ data:{ features:[{ id, status:'live', ready:false, code:'no_proven_model', reason:'No proven model is configured.' }] } })
    const w = mountPage(id); await flushPromises()
    expect(w.text()).toContain('No proven model is configured.')
    expect(w.get('a').attributes('href')).toBe('/dashboard/settings/providers')
    expect(api.post).not.toHaveBeenCalled(); expect(api.get).not.toHaveBeenCalled(); w.unmount()
  })
  it('keeps local-tools refusals free of irrelevant provider links',async () => {
    api.getStudioFeatures.mockResolvedValue({data:{features:[{id:'editor',ready:false,code:'no_local_tools',reason:'ffmpeg is unavailable.'}]}})
    const w = mountPage('editor'); await flushPromises(); expect(w.text()).toContain('ffmpeg is unavailable.'); expect(w.find('a').exists()).toBe(false); w.unmount()
  })
  it('does not act when the availability service fails',async () => {
    api.getStudioFeatures.mockRejectedValue(Error('offline')); const w=mountPage('music'); await flushPromises(); expect(w.text()).toContain('Could not check availability'); expect(api.post).not.toHaveBeenCalled(); w.unmount()
  })
})
