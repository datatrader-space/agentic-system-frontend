// @vitest-environment jsdom
import { defineComponent, h, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Details from './StudioLookDetails.vue'
import { provideStudioTemplates } from '../../composables/useStudioTemplates'
import { studioLooks } from '../../services/studioLooks'

describe('Every approved look is editable before it reaches the Agent', () => {
  it.each(studioLooks)('$id exposes its real variables and applies visible text without submitting', async look => {
    const w = mount(Details, {props:{look}})
    expect(w.findAll('input')).toHaveLength(look.variables.length)
    const changed = 'My personal direction for '+look.title
    await w.findAll('input')[0].setValue(changed)
    expect(w.text()).toContain(changed)
    expect(w.emitted('apply')).toBeUndefined()
    await w.get('button').trigger('click')
    const applied = w.emitted('apply')[0][0]
    expect(applied.id).toBe(look.id)
    expect(applied.clientOnly).toBe(true)
    expect(applied.promptTemplate).toContain(changed)
    expect(applied.promptTemplate).not.toMatch(/\{[^}]+\}/)
    w.unmount()
  })
  it('does not apply a look while the caller is busy', async () => {
    const w=mount(Details,{props:{look:studioLooks[0],disabled:true}})
    await w.get('button').trigger('click');expect(w.emitted('apply')).toBeUndefined();w.unmount()
  })
})

// "Save as my template": the name is asked for in the page (no native prompt); the template goes to the account.
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('../../services/api', () => ({ default: api }))
vi.mock('../../composables/useNotify', () => ({ notify: { error: vi.fn(), success: vi.fn() } }))
function withTemplates(props) {
  const Host = defineComponent({ setup() { provideStudioTemplates(ref({ id: 'one' })); return () => h(Details, props) } })
  return mount(Host, { attachTo: document.body })
}
describe('Save as my template', () => {
  beforeEach(() => { api.get.mockReset().mockResolvedValue({ data: { templates: [] } }); api.post.mockReset() })
  it('asks for a name in the page and saves the page, the look, the edited prompt, its texts and the page settings', async () => {
    const prompt = vi.spyOn(window, 'prompt')
    api.post.mockImplementation((_, body) => Promise.resolve({ data: { ...body, id: 12 } }))
    const look = studioLooks.find(item => item.id === 'image-look-1')
    const w = withTemplates({ look, settings: { aspect_ratio: '3:4', n: 2, resolution: '' } }); await flushPromises()
    await w.findAll('.sld-fields input')[0].setValue('My teapot')
    await w.get('[data-test="look-save-mine"]').trigger('click')
    const name = w.get('[data-test="look-save-mine-name"]')
    expect(name.element.value).toBe(look.title); expect(document.activeElement).toBe(name.element)
    await name.setValue('Teapot portrait')
    await w.get('[data-test="look-save-mine-form"]').trigger('submit'); await flushPromises()
    const [url, body] = api.post.mock.calls[0]
    expect(url).toBe('/video/templates/')
    expect(body).toMatchObject({ page: 'image', base_look: 'image-look-1', title: 'Teapot portrait', settings: { aspect_ratio: '3:4', n: 2 } })
    expect(body.prompt).toContain('My teapot'); expect(body.prompt).not.toMatch(/\{[^}]+\}/)
    expect(body.variables).toEqual(Object.fromEntries(look.variables.map((field, i) => [field.label, i === 0 ? 'My teapot' : field.default])))
    expect(w.get('[data-test="look-save-mine-done"]').text()).toContain('Teapot portrait')
    expect(w.find('[data-test="look-save-mine-form"]').exists()).toBe(false)
    expect(w.emitted()).not.toHaveProperty('apply'); expect(prompt).not.toHaveBeenCalled()
    w.unmount(); prompt.mockRestore()
  })
  it('shows the server\'s refusal next to the name and keeps the form open; Cancel closes it', async () => {
    api.post.mockRejectedValue(Object.assign(new Error('x'), { response: { status: 400, data: { error: { code: 'bad_value', message: 'That name is too long for a template.', field: 'title' } } } }))
    const w = withTemplates({ look: studioLooks[0] }); await flushPromises()
    await w.get('[data-test="look-save-mine"]').trigger('click')
    await w.get('[data-test="look-save-mine-form"]').trigger('submit'); await flushPromises()
    expect(w.get('[data-test="look-save-mine-error"]').text()).toBe('That name is too long for a template.')
    expect(w.get('[data-test="look-save-mine-name"]').attributes('aria-invalid')).toBe('true')
    await w.get('.sld-name-actions button[type="button"]').trigger('click')
    expect(w.find('[data-test="look-save-mine-form"]').exists()).toBe(false)
    expect(document.activeElement).toBe(w.get('[data-test="look-save-mine"]').element)
    w.unmount()
  })
})
