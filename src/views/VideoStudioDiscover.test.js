// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import Discover from './VideoStudioDiscover.vue'
import api from '../services/api'
import { defineComponent, h, ref } from 'vue'
import { provideStudioTemplates } from '../composables/useStudioTemplates'
vi.mock('../services/api', () => ({ default: { post: vi.fn(), getStudioFeatures: vi.fn(), get: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))
const confirmMock = vi.hoisted(() => vi.fn())
vi.mock('../composables/useConfirm', () => ({ confirm: confirmMock }))
vi.mock('../composables/useNotify', () => ({ notify: { error: vi.fn(), success: vi.fn() } }))
let wrapper
beforeEach(() => setActivePinia(createPinia()))
afterEach(() => wrapper?.unmount())
async function open() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/video-studio/:rest(.*)*', component: { template: '<div />' } }] })
  await router.push('/video-studio')
  wrapper = mount(Discover, { global: { plugins: [router], stubs: { StudioLookMedia: true } } })
  await flushPromises()
  return router
}
describe('Discover is the goal-first Studio landing', () => {
  it('offers each of the 26 existing tools exactly once, without a Start from scratch detour', async () => {
    await open()
    const links = wrapper.findAll('[data-test^="discover-tool-"]')
    expect(links).toHaveLength(26)
    expect(new Set(links.map(link => link.attributes('data-test'))).size).toBe(26)
    expect(links.find(link => link.attributes('data-test') === 'discover-tool-video').attributes('href')).toContain('mode=agent')
    expect(wrapper.text()).not.toContain('Start from scratch')
    expect(api.post).not.toHaveBeenCalled()
  })
  it('filters ready-made looks and links directly to an editable tool preset without requesting media', async () => {
    await open()
    await wrapper.findAll('.discover-views button')[1].trigger('click')
    expect(wrapper.findAll('[data-test^="discover-look-"]')).toHaveLength(69)
    await wrapper.get('input[type="search"]').setValue('Softbox product portrait')
    expect(wrapper.findAll('[data-test^="discover-look-"]')).toHaveLength(1)
    expect(wrapper.get('[data-test="discover-look-image-look-1"]').attributes('href')).toContain('/video-studio/image?preset=image-look-1&mode=agent')
    expect(api.post).not.toHaveBeenCalled()
  })
  it('preserves a legacy conversation bookmark by opening the existing Dashboard session path', async () => {
    const router = await open()
    await router.replace('/video-studio?conversation=owned-fixture')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/video-studio/dashboard')
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
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/video-studio/:rest(.*)*', component: { template: '<div />' } }] })
    await router.push('/video-studio?view=looks&saved=1')
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
    expect(use).toContain('/video-studio/image?'); expect(use).toContain('template=7'); expect(use).toMatch(/mode=(agent|manual)/)
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
