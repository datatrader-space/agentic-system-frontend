// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AdsStudio from './AdsStudio.vue'
import Marketing from './CreativeMarketing.vue'
import StageProgress from './StageProgress.vue'
import InputSlot from './InputSlot.vue'
import api from '../../services/api'
import { useChatStore } from '../../stores/useChatStore'
import { useVideoStore } from '../../stores/useVideoStore'
const push = vi.hoisted(() => vi.fn())
const routeQuery = vi.hoisted(() => ({}))
vi.mock('vue-router', () => ({ useRoute: () => ({ query: routeQuery }), useRouter: () => ({ push }) }))
vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), getStudioRoutes: vi.fn(), getStudioRecipes: vi.fn(), runStudioRecipe: vi.fn(), getMediaRoutes: vi.fn(), recordLikenessConsent: vi.fn() } }))
vi.mock('../../composables/useNotify', () => ({ notify: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }))
// Ads Studio v2 (ADS_STUDIO_V2_PLAN.md): products from a shop page with streamed stages, image ads in batches, the Ad
// Multiplier, a price on every concept before it is made, and the product recipes' entry points.
const OPTIONS = { platforms: [{ id: 'reels', label: 'Reels', aspect_ratio: '9:16', max_seconds: 60 }], goals: ['awareness'], static_platforms: [{ id: 'feed-portrait', label: 'Feed', aspect_ratio: '4:5' }], static_max_concepts: 6, multiplier: { sections: ['hook', 'cta'], modes: ['recreate', 'replace'], max_variants: 5, seconds: [1, 10] } }
const PRODUCTS = [{ product_id: 'prod-1', name: 'Trail Bottle', price: '29.50', currency: 'EUR', attachment_ids: ['photo-1'] }]
const BATCH = { batch_id: 'b1', kind: 'static', title: 'Trail Bottle: 1 static ads', estimate_usd: '0.07', max_usd: '0.07', waiting_job_ids: ['j1'], shared_steps: [],
  items: [{ item: 0, name: 'Cold all day', estimate_usd: '0.07', max_usd: '0.07', result: null, concept: { headline: 'Cold all day', primary_text: 'Steel.' }, steps: [{ kind: 'render', item: 0, error: null, job: { job_id: 'j1', state: 'awaiting_authorization' } }] }] }
let pinia
const setup = (component = AdsStudio, props = {}) => { pinia = createPinia(); setActivePinia(pinia); useChatStore(pinia).conversationId = 'c1'; return mount(component, { props, global: { plugins: [pinia], stubs: { InputSlot: true, RouterLink: true, MediaRoutePicker: true } } }) }
const inChat = { conversation_id: 'c1', studio_context: { page: 'ads', preset: '', preset_title: '' } }
const click = async (w, test) => { await w.get(`[data-test="${test}"]`).trigger('click'); await flushPromises() }
const tab = async (w, id) => { await w.get(`[data-test="ads-tab-${id}"]`).trigger('click'); await flushPromises() }

beforeEach(() => {
  vi.clearAllMocks()
  for (const k of Object.keys(routeQuery)) delete routeQuery[k]
  api.get.mockImplementation(async path => ({ data: path === '/video/ads/options/' ? OPTIONS : path === '/video/brands/' ? { brands: [{ brand_id: 'br', name: 'Peak' }] } : path === '/video/ingredients/' ? { ingredients: [] } : path === '/video/products/' ? { products: PRODUCTS } : path === '/video/ads/batches/b1/' ? { ...BATCH, waiting_job_ids: [] } : {} }))
  api.getStudioRoutes.mockResolvedValue({ data: { routes: [{ route_id: 7, name: 'Kling' }] } })
  api.getStudioRecipes.mockResolvedValue({ data: { recipes: [{ id: 'ugc', title: 'UGC video', ready: true, slots: [{ name: 'product', media_type: 'image', required: true }], options: {} }, { id: 'try-on', title: 'Try-on', ready: false, slots: [], options: {} }, { id: 'relight', title: 'Relight', ready: true, slots: [], options: {} }] } })
})

describe('Ads Studio v2', () => {
  it('reads a product page, shows each streamed stage and asks before a paid model read', async () => {
    let resolveRead
    api.post.mockImplementationOnce(() => new Promise(r => { resolveRead = r }))
    const w = setup(); await flushPromises(); await tab(w, 'products')
    await w.get('[data-test="product-url"]').setValue('https://shop.example/p/1'); await click(w, 'product-read')
    const body = api.post.mock.calls[0][1]
    expect(api.post.mock.calls[0][0]).toBe('/video/products/read/')
    expect(body).toMatchObject({ url: 'https://shop.example/p/1', model: 'ask', ...inChat })
    // A `video_stage` frame for this read shows while the request is still open.
    useVideoStore(pinia).onStageFrame({ read_id: body.read_id, stages: [{ stage: 'fetch', state: 'done', detail: '' }, { stage: 'read', state: 'running', detail: '' }] })
    await flushPromises()
    expect(w.findComponent(StageProgress).text()).toContain('Opening the page')
    expect(w.get('[data-stage="read"]').classes()).toContain('is-running')
    resolveRead({ data: { title: 'Item', price: '', missing: ['price'], needs_model_read: true, model_read_estimate: { estimate_usd: '0.0008' }, images: [], stages: [] } }); await flushPromises()
    expect(w.get('[data-test="product-model-ask"]').text()).toContain('about $0.001, paid from your balance')
    api.post.mockResolvedValueOnce({ data: { title: 'Clay Mug', price: '18.00', currency: 'USD', images: [{ attachment_id: 'a1' }], needs_model_read: false, stages: [] } })
    await click(w, 'product-model-yes')
    expect(api.post.mock.calls[1][1]).toMatchObject({ model: 'yes' })
    api.post.mockResolvedValueOnce({ data: { product_id: 'prod-2', name: 'Clay Mug' } })
    // The person's own Save carries their rights statement, as on the Elements page (ADS_CHAT_FLOW_PLAN.md).
    expect(w.get('[data-test="product-save"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="product-save-rights"]').text()).toContain('Confirm your rights')
    await w.get('[data-test="ea-basis-owned"]').setValue(true)
    await w.get('[data-test="ea-rights-confirm"]').setValue(true)
    await click(w, 'product-save')
    expect(api.post.mock.calls[2]).toEqual(['/video/products/', { title: 'Clay Mug', price: '18.00', currency: 'USD', brand: undefined, description: undefined, url: undefined, attachment_ids: ['a1'], rights: { basis: 'owned', confirmed: true } }])
    w.unmount()
  })

  it('a frame for another read does not show on this page', async () => {
    const store = (setup(), useVideoStore(pinia))
    store.onStageFrame({ read_id: 'other', stages: [{ stage: 'fetch', state: 'running' }] })
    store.onStageFrame({ stages: [{ stage: 'fetch' }] })              // no read id: ignored
    expect(Object.keys(store.stages)).toEqual(['other'])
  })

  it('shows a price on each image ad concept, makes the chosen ones in one batch and starts it on the person\'s Generate all', async () => {
    const w = setup(); await flushPromises(); await tab(w, 'static')
    await w.get('[data-test="static-product"]').setValue('prod-1')
    api.post.mockResolvedValueOnce({ data: { concepts: [
      { headline: 'Cold all day', primary_text: 'Steel.', in_image_text: 'Stays cold', cta: 'Shop', visual: 'A ledge', text_zone: 'top', price: { status: 'priced', estimate_usd: '0.07', max_usd: '0.07' } },
      { headline: 'Two', primary_text: '', in_image_text: 'x', cta: '', visual: 'y', text_zone: 'bottom', price: { status: 'unpriced', reason: 'No image model you can use edits pictures yet.' } }] } })
    await click(w, 'static-concepts')
    const prices = w.findAll('[data-test="concept-price"]').map(p => p.text())
    expect(prices).toEqual(['$0.07 before you make it', 'No price yet: No image model you can use edits pictures yet.'])
    await w.findAll('[data-test="static-concept"] input[type="checkbox"]')[1].setValue(false)
    expect(w.get('[data-test="static-batch"]').text()).toBe('Review estimates for 1 ad')
    api.post.mockResolvedValueOnce({ data: BATCH })
    await click(w, 'static-batch')
    expect(api.post.mock.calls[1][0]).toBe('/video/ads/batches/')
    expect(api.post.mock.calls[1][1]).toMatchObject({ product_id: 'prod-1', platform: 'feed-portrait', concepts: [{ headline: 'Cold all day', in_image_text: 'Stays cold', text_zone: 'top' }] })
    expect(api.post.mock.calls[1][1].concepts[0]).not.toHaveProperty('price')
    expect(w.emitted('job')[0][0]).toMatchObject({ job_id: 'j1' })
    expect(w.get('[data-test="ad-batch-price"]').text()).toBe('Batch: $0.07')
    api.post.mockResolvedValueOnce({ data: { started: ['j1'], not_started: [], batch: { ...BATCH, waiting_job_ids: [] } } })
    await click(w, 'ad-batch-start')
    expect(api.post.mock.calls[2]).toEqual(['/video/ads/batches/b1/start/', {}])
    expect(w.find('[data-test="ad-batch-start"]').exists()).toBe(false)
    w.unmount()
  })

  it('a job frame of the chat refreshes the batch card from the server, not by polling', async () => {
    vi.useFakeTimers()
    const w = setup(); await flushPromises(); await tab(w, 'static')
    await w.get('[data-test="static-product"]').setValue('prod-1')
    api.post.mockResolvedValueOnce({ data: { concepts: [{ headline: 'A', in_image_text: 'B', visual: 'C', text_zone: 'top', price: null }] } })
    await click(w, 'static-concepts')
    api.post.mockResolvedValueOnce({ data: BATCH }); await click(w, 'static-batch')
    api.get.mockClear()
    vi.advanceTimersByTime(5000); await flushPromises()
    expect(api.get).not.toHaveBeenCalled()                            // nothing asked while nothing changed
    useVideoStore(pinia)._put({ job_id: 'j1', state: 'ready', conversation_id: 'c1' }); await flushPromises()
    vi.advanceTimersByTime(500); await flushPromises()
    expect(api.get).toHaveBeenCalledWith('/video/ads/batches/b1/')
    vi.useRealTimers(); w.unmount()
  })

  it('the Ad Multiplier sends the ad, the section and each variant', async () => {
    const w = setup(); await flushPromises(); await tab(w, 'multiplier'); await flushPromises()
    expect(api.getStudioRoutes.mock.calls.map(c => c[0])).toEqual(['edit_uploaded', 'edit_generated'])
    w.findComponent(InputSlot).vm.$emit('pick', [{ attachment_id: 'ad-1', media_type: 'video' }]); await flushPromises()
    await w.get('[data-field="section"] select').setValue('cta')
    await w.get('[aria-label="Variant 1"]').setValue('A runner opens the bottle')
    await w.findAll('button').find(b => b.text() === 'Add a variant').trigger('click')
    await w.get('[aria-label="Variant 2"]').setValue('Ice falling')
    api.post.mockResolvedValueOnce({ data: { ...BATCH, kind: 'multiplier', items: [] } })
    expect(w.get('[data-test="mult-make"]').text()).toBe('Review estimates for 2 variants')
    await click(w, 'mult-make')
    expect(api.post).toHaveBeenCalledWith('/video/ads/multiply/', { attachment_id: 'ad-1', section: 'cta', seconds: 3, mode: 'recreate', variants: ['A runner opens the bottle', 'Ice falling'], route_id: '7', ...inChat })
    w.unmount()
  })

  it('a video concept card says its price before it is made and can price an edit again', async () => {
    const w = setup(); await flushPromises()
    await w.get('[data-field="brand_id"] select').setValue('br')
    api.post.mockResolvedValueOnce({ data: { concepts: [{ title: 'Fresh', hook: 'Steam', scenes: [{ visual: 'Beans', planned_ms: 4000 }], price: { status: 'priced', estimate_usd: '0.50', max_usd: '0.62' } }] } })
    await w.findAll('button').find(b => b.text() === 'Develop concepts').trigger('click'); await flushPromises()
    expect(w.get('[data-test="concept-price"]').text()).toBe('About $0.50, at most $0.62 before you make it')
    api.post.mockResolvedValueOnce({ data: { status: 'unknown' } })
    await click(w, 'concept-reprice')
    expect(api.post.mock.calls[1][0]).toBe('/video/ads/concepts/price/')
    expect(api.post.mock.calls[1][1].concept).toMatchObject({ title: 'Fresh', total_ms: 4000 })
    expect(api.post.mock.calls[1][1].concept).not.toHaveProperty('price')
    expect(w.get('[data-test="concept-price"]').text()).toBe('No published price before you make it')
    w.unmount()
  })
  it('video concepts need no brand kit: the product photo and its name are enough', async () => {
    const w = setup(); await flushPromises()
    const go = w.get('[data-test="video-concepts"]')
    expect(go.attributes('disabled')).toBeDefined()                      // nothing to make an ad of yet
    w.findComponent(InputSlot).vm.$emit('pick', [{ attachment_id: 'pack-1', media_type: 'image' }]); await flushPromises()
    await w.get('[data-test="video-product-name"]').setValue('Seed Mix')
    expect(go.attributes('disabled')).toBeUndefined()
    api.post.mockResolvedValueOnce({ data: { concepts: [] } })
    await go.trigger('click'); await flushPromises()
    const [path, body] = api.post.mock.calls.at(-1)
    expect(path).toBe('/video/ads/concepts/')
    expect(body).toMatchObject({ platform: 'reels', product_attachment_ids: ['pack-1'], product: { name: 'Seed Mix' } })
    expect(body).not.toHaveProperty('brand_id')
    w.unmount()
  })

  it('the product recipes open Product videos with the recipe and the product', async () => {
    const w = setup(); await flushPromises(); await tab(w, 'recipes')
    expect(w.find('[data-test="recipe-relight"]').exists()).toBe(false)   // an effect, not a product recipe
    expect(w.get('[data-test="recipe-try-on"]').attributes('disabled')).toBeDefined()
    await w.get('[data-field="product_id"] select').setValue('prod-1')
    await click(w, 'recipe-ugc')
    expect(push).toHaveBeenCalledWith({ path: '/dashboard/video-studio/marketing', query: { recipe: 'ugc', product: 'prod-1' } })
    w.unmount()
  })
})

describe('Product videos opened from the Ads page', () => {
  it('chooses the linked recipe and fills its product slot with the product photo', async () => {
    Object.assign(routeQuery, { recipe: 'ugc', product: 'prod-1' })
    const w = setup(Marketing, { kind: 'marketing' }); await flushPromises()
    expect(w.get('[data-field="recipe_id"] select').element.value).toBe('ugc')
    expect(w.findComponent(InputSlot).props('items')).toEqual([{ attachment_id: 'photo-1', name: 'Trail Bottle', media_type: 'image' }])
    w.unmount()
  })

  it('a recipe that shows a real person asks consent, records it, then sends the same request again', async () => {
    api.getStudioRecipes.mockResolvedValue({ data: { recipes: [{ id: 'try-on', title: 'Try-on', ready: true, operation: 'edit_image', slots: [{ name: 'person', media_type: 'image', required: true }], options: {} }] } })
    Object.assign(routeQuery, { recipe: 'try-on' })
    const w = mount(Marketing, { props: { kind: 'marketing' }, global: { plugins: [(() => { pinia = createPinia(); setActivePinia(pinia); useChatStore(pinia).conversationId = 'c1'; return pinia })()], stubs: { InputSlot: true, RouterLink: true, MediaRoutePicker: { template: '<div />', props: ['modelValue'], emits: ['update:modelValue'], mounted() { this.$emit('update:modelValue', '5') } } } } })
    await flushPromises()
    w.findComponent(InputSlot).vm.$emit('pick', [{ attachment_id: 'me', name: 'me.jpg' }]); await flushPromises()
    api.runStudioRecipe.mockRejectedValueOnce({ response: { data: { error: { code: 'consent_required', message: 'Confirm you have the consent.', alternatives: [{ attachment_id: 'me', statement: 'I confirm.', statement_version: 'v' }] } } } })
    api.runStudioRecipe.mockResolvedValueOnce({ data: { job_id: 'j9' } })
    api.recordLikenessConsent.mockResolvedValue({ data: {} })
    await w.findAll('button').find(b => b.text() === 'Review recipe estimate').trigger('click'); await flushPromises()
    expect(w.get('[data-test="consent-step"]').text()).toContain('me.jpg')
    await w.get('[data-test="consent-name"]').setValue('Me'); await w.get('[data-test="consent-self"]').setValue(true); await w.get('[data-test="consent-agree"]').setValue(true)
    await w.get('[data-test="consent-confirm"]').trigger('click'); await flushPromises()
    expect(api.recordLikenessConsent).toHaveBeenCalledWith({ attachment_id: 'me', subject_name: 'Me', basis: 'self' })
    expect(api.runStudioRecipe).toHaveBeenCalledTimes(2)
    expect(w.emitted('job')[0][0]).toEqual({ job_id: 'j9' })
    w.unmount()
  })
})
