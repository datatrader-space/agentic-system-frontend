// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import Discover from './VideoStudioDiscover.vue'
import api from '../services/api'
import { defineComponent, h, ref } from 'vue'
import { provideStudioTemplates } from '../composables/useStudioTemplates'
// The Image and Video looks come from the Recipe API (F-D4): three each, as the catalogue serves them.
const servedLook = (page, i, title) => ({ id: `${page}-look-${i}`, feature: page, title, purpose: `A ${page} look.`, category: page === 'image' ? 'Images' : 'Videos', slots: [], settings: {}, promptTemplate: 'Make it.', variants: ['Keep the prepared direction.'], clientOnly: true, variables: [] })
vi.mock('../services/api', () => ({ default: { post: vi.fn(), getStudioFeatures: vi.fn(), get: vi.fn(), patch: vi.fn(), delete: vi.fn(),
  getStudioRecipes: vi.fn(page => Promise.resolve({ data: { presets: [1, 2, 3].map(i => servedLook(page, i, i === 1 && page === 'image' ? 'Softbox product portrait' : `${page} look ${i}`)) } })) } }))
const confirmMock = vi.hoisted(() => vi.fn())
vi.mock('../composables/useConfirm', () => ({ confirm: confirmMock }))
vi.mock('../composables/useNotify', () => ({ notify: { error: vi.fn(), success: vi.fn() } }))
let wrapper
beforeEach(() => setActivePinia(createPinia()))
afterEach(() => wrapper?.unmount())
async function open() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/dashboard/video-studio/:rest(.*)*', component: { template: '<div />' } }] })
  await router.push('/dashboard/video-studio')
  wrapper = mount(Discover, { global: { plugins: [router], stubs: { StudioLookMedia: true } } })
  await flushPromises()
  return router
}
describe('Discover is the goal-first Studio landing', () => {
  it('offers each of the 28 existing tools exactly once, without a Start from scratch detour', async () => {
    await open()
    const links = wrapper.findAll('[data-test^="discover-tool-"]')
    expect(links).toHaveLength(28)
    expect(new Set(links.map(link => link.attributes('data-test'))).size).toBe(28)
    expect(links.find(link => link.attributes('data-test') === 'discover-tool-video').attributes('href')).toContain('mode=agent')
    expect(wrapper.text()).not.toContain('Start from scratch')
    expect(api.post).not.toHaveBeenCalled()
  })
  it('filters ready-made looks and links directly to an editable tool preset without requesting media', async () => {
    await open()
    await wrapper.findAll('.discover-views button')[1].trigger('click')
    expect(wrapper.findAll('[data-test^="discover-look-"]')).toHaveLength(74)          // the app's own, plus 6 served
    await wrapper.get('input[type="search"]').setValue('Softbox product portrait')
    expect(wrapper.findAll('[data-test^="discover-look-"]')).toHaveLength(1)
    expect(wrapper.get('[data-test="discover-look-image-look-1"]').attributes('href')).toContain('/dashboard/video-studio/image?preset=image-look-1&mode=agent')
    expect(api.post).not.toHaveBeenCalled()
  })
  it('names the look filter for the tools that have looks, so its number is not read as the All tools count (ISSUE-5)', async () => {
    await open()
    const allTools = wrapper.findAll('[data-test^="discover-tool-"]').length
    await wrapper.findAll('.discover-views button')[1].trigger('click')
    const select = wrapper.get('select[aria-label="Filter looks by creative tool"]')
    const options = select.findAll('option').slice(1)
    expect(select.get('option').text()).toBe(`All tools with looks (${options.length})`)
    // Every tool listed has at least one look, and none without one is offered.
    for (const option of options) {
      await select.setValue(option.element.value)
      expect(wrapper.findAll('[data-test^="discover-look-"]').length).toBeGreaterThan(0)
    }
    expect(options.length).toBeLessThan(allTools)
    expect(wrapper.text()).not.toContain('moving examples')
  })
  it('marks a tool the server says cannot run yet as "Not available yet", still linked to its page (ISSUE-8)', async () => {
    const { studioFeatures } = await import('../services/studioFeatures')
    const before = studioFeatures.value
    studioFeatures.value = before.map(f => f.id === 'avatar' ? { ...f, ready: false, code: 'no_proven_model', reason: 'No model for this page has been proven yet.' } : f.id === 'video' ? { ...f, ready: true } : f)
    try {
      await open()
      const avatar = wrapper.get('[data-test="discover-tool-avatar"]')
      expect(wrapper.get('[data-test="discover-badge-avatar"]').text()).toBe('Not available yet')
      expect(avatar.text()).toContain('See why it is not available')
      expect(avatar.attributes('href')).toContain('/dashboard/video-studio/avatar')
      expect(wrapper.find('[data-test="discover-badge-video"]').exists()).toBe(false)
    } finally { studioFeatures.value = before }
  })
  it('preserves a legacy conversation bookmark by opening the existing Dashboard session path', async () => {
    const router = await open()
    await router.replace('/dashboard/video-studio?conversation=owned-fixture')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/dashboard/video-studio/dashboard')
    expect(router.currentRoute.value.query.conversation).toBe('owned-fixture')
    expect(api.post).not.toHaveBeenCalled()
  })
  it('opens the same creative tool in the chosen Manual mode without submitting anything', async () => {
    await open()
    await wrapper.get('[data-test="studio-mode-manual"]').trigger('click')
    expect(wrapper.get('[data-test="discover-tool-video"]').attributes('href')).toContain('mode=manual')
    expect(wrapper.get('[data-test="discover-tool-video"]').text()).toContain('Open in Manual')
    expect(api.post).not.toHaveBeenCalled()
  })
})

// My templates, next to the saved (favourite) looks: Use fills the template's page; Rename and Delete act on the account.
describe('My templates in Discover', () => {
  const rows = () => [
    { id: 7, page: 'image', base_look: 'image-look-1', title: 'Teapot portrait', prompt: 'Create a refined image of My teapot. '.repeat(8), variables: { Subject: 'My teapot' }, settings: { aspect_ratio: '3:4' } },
    { id: 3, page: 'music', base_look: '', title: 'Calm loop', prompt: 'A calm piano loop', variables: {}, settings: {} },
  ]
  const refused = (status, code, message) => Object.assign(new Error(message), { response: { status, data: { error: { code, message, field: '' } } } })
  async function openSaved() {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/dashboard/video-studio/:rest(.*)*', component: { template: '<div />' } }] })
    await router.push('/dashboard/video-studio?view=looks&saved=1')
    const Host = defineComponent({ setup() { provideStudioTemplates(ref({ id: 'one' })); return () => h(Discover) } })
    wrapper = mount(Host, { global: { plugins: [router], stubs: { StudioLookMedia: true } } })
    await flushPromises()
    return router
  }
  beforeEach(() => { api.get.mockReset().mockResolvedValue({ data: { templates: rows() } }); api.patch.mockReset(); api.delete.mockReset(); confirmMock.mockReset() })
  it('lists each template with its title, its page and the start of its prompt, and Use opens that page filled in', async () => {
    await openSaved()
    expect(api.get).toHaveBeenCalledWith('/video/templates/')
    const card = wrapper.get('[data-test="my-template-7"]')
    expect(card.text()).toContain('Teapot portrait'); expect(card.text()).toContain('Image')
    expect(card.get('p').text().length).toBeLessThanOrEqual(141); expect(card.get('p').text()).toMatch(/…$/)
    const use = card.get('[data-test="my-template-use"]').attributes('href')
    expect(use).toContain('/dashboard/video-studio/image?'); expect(use).toContain('template=7'); expect(use).toMatch(/mode=(agent|manual)/)
    expect(wrapper.get('[data-test="my-template-3"] [data-test="my-template-use"]').attributes('href')).toContain('template=3')
    expect(wrapper.text()).toContain('Saved templates')
    expect(api.post).not.toHaveBeenCalled()
  })
  it('renames a template in its card', async () => {
    api.patch.mockImplementation((url, body) => Promise.resolve({ data: { ...rows()[0], ...body } }))
    await openSaved()
    await wrapper.get('[data-test="my-template-7"] [data-test="my-template-rename"]').trigger('click')
    const input = wrapper.get('[data-test="my-template-rename-input"]')
    expect(input.element.value).toBe('Teapot portrait')
    await input.setValue('Blue teapot'); await wrapper.get('[data-test="my-template-7"] form').trigger('submit'); await flushPromises()
    expect(api.patch).toHaveBeenCalledWith('/video/templates/7/', { title: 'Blue teapot' })
    expect(wrapper.get('[data-test="my-template-7"] h3').text()).toBe('Blue teapot')
  })
  it('shows the server\'s message when a rename is refused', async () => {
    api.patch.mockRejectedValue(refused(400, 'bad_value', 'The name must be 1 to 80 characters.'))
    await openSaved()
    await wrapper.get('[data-test="my-template-7"] [data-test="my-template-rename"]').trigger('click')
    await wrapper.get('[data-test="my-template-7"] form').trigger('submit'); await flushPromises()
    expect(wrapper.get('[data-test="my-template-error"]').text()).toBe('The name must be 1 to 80 characters.')
  })
  it('deletes only after the confirm dialog says yes', async () => {
    api.delete.mockResolvedValue({ status: 204 })
    await openSaved()
    confirmMock.mockResolvedValueOnce(false)
    await wrapper.get('[data-test="my-template-7"] [data-test="my-template-delete"]').trigger('click'); await flushPromises()
    expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({ danger: true, confirmText: 'Delete' })); expect(api.delete).not.toHaveBeenCalled()
    confirmMock.mockResolvedValueOnce(true)
    await wrapper.get('[data-test="my-template-7"] [data-test="my-template-delete"]').trigger('click'); await flushPromises()
    expect(api.delete).toHaveBeenCalledWith('/video/templates/7/')
    expect(wrapper.find('[data-test="my-template-7"]').exists()).toBe(false)
  })
  it('a template that is no longer this person\'s (404) leaves the list with a message', async () => {
    api.patch.mockRejectedValue(refused(404, 'not_found', 'Not found.'))
    await openSaved()
    await wrapper.get('[data-test="my-template-3"] [data-test="my-template-rename"]').trigger('click')
    await wrapper.get('[data-test="my-template-3"] form').trigger('submit'); await flushPromises()
    expect(wrapper.find('[data-test="my-template-3"]').exists()).toBe(false)
    expect(wrapper.get('[data-test="my-template-list-error"]').text()).toBe('This template is no longer on your account.')
  })
  it('says how to make one when there are none, and shows a load failure with Try again', async () => {
    api.get.mockResolvedValueOnce({ data: { templates: [] } })
    await openSaved()
    expect(wrapper.get('[data-test="my-templates-empty"]').text()).toContain('Save as my template')
    wrapper.unmount()
    api.get.mockRejectedValueOnce(refused(500, 'server_error', 'Templates are resting.'))
    await openSaved()
    expect(wrapper.get('[data-test="my-templates"] [role="alert"]').text()).toContain('Templates are resting.')
  })
  it('is not shown outside the saved view', async () => {
    await open()
    expect(wrapper.find('[data-test="my-templates"]').exists()).toBe(false)
  })
})
