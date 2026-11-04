// @vitest-environment jsdom
// My templates live on the person's account: GET/POST /api/video/templates/, PATCH/DELETE /api/video/templates/<id>/.
import { defineComponent, h, ref, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() }))
const notify = vi.hoisted(() => ({ error: vi.fn() }))
vi.mock('../services/api', () => ({ default: api }))
vi.mock('./useNotify', () => ({ notify }))
import { provideStudioTemplates, useStudioTemplates, templateLook, templateSettings } from './useStudioTemplates'
import { studioLooks } from '../services/studioLooks'
import { composePreset } from '../services/studioPresets'

const row = (id, extra = {}) => ({ id, page: 'image', base_look: 'image-look-1', title: `Template ${id}`, prompt: `Prompt ${id}`, variables: { Subject: 'A teapot' }, settings: { aspect_ratio: '1:1', n: 2 }, created_at: '2026-11-04T10:00:00Z', updated_at: '2026-11-04T10:00:00Z', ...extra })
const refused = (status, code, message, field = '') => Object.assign(new Error(message), { response: { status, data: { error: { code, message, field } } } })
function setup(user = ref({ id: 'one' })) {
  let used, provided
  const Child = defineComponent({ setup() { used = useStudioTemplates(); return () => h('div', used.templates.value.map(t => t.title).join(',')) } })
  const w = mount(defineComponent({ setup() { provided = provideStudioTemplates(user); return () => h(Child) } }))
  return { w, user, get used() { return used }, get provided() { return provided } }
}
beforeEach(() => { for (const fn of Object.values(api)) fn.mockReset(); notify.error.mockReset() })

it('loads every template of the signed-in person, newest first as the server sends them', async () => {
  api.get.mockResolvedValue({ data: { templates: [row(2), row(1), { nope: true }] } })
  const t = setup(); expect(t.used.loading.value).toBe(true); await flushPromises()
  expect(api.get).toHaveBeenCalledWith('/video/templates/')
  expect(t.used.templates.value.map(x => x.id)).toEqual([2, 1]); expect(t.used.ready.value).toBe(true)
  expect(t.w.text()).toBe('Template 2,Template 1'); t.w.unmount()
})

it('loads nothing without a signed-in person', async () => {
  const t = setup(ref(null)); await flushPromises()
  expect(api.get).not.toHaveBeenCalled(); expect(t.used.templates.value).toEqual([]); t.w.unmount()
})

it('shows the server\'s message when the list cannot be loaded', async () => {
  api.get.mockRejectedValue(refused(500, 'server_error', 'Templates are resting.'))
  const t = setup(); await flushPromises()
  expect(t.used.error.value).toBe('Templates are resting.'); expect(t.used.ready.value).toBe(false); t.w.unmount()
})

it('creates a template with only the settings the backend keeps and puts it first', async () => {
  api.get.mockResolvedValue({ data: { templates: [row(1)] } })
  api.post.mockImplementation((_, body) => Promise.resolve({ status: 201, data: { ...body, id: 5, created_at: 'now', updated_at: 'now' } }))
  const t = setup(); await flushPromises()
  const result = await t.used.create({ page: 'image', base_look: 'image-look-1', title: '  My portrait ', prompt: 'A clean portrait', variables: { Subject: 'Me' }, settings: { aspect_ratio: '3:4', n: 2, resolution: '', token: 'x', duration: NaN } })
  expect(api.post).toHaveBeenCalledWith('/video/templates/', { page: 'image', base_look: 'image-look-1', title: 'My portrait', prompt: 'A clean portrait', variables: { Subject: 'Me' }, settings: { aspect_ratio: '3:4', n: 2 } })
  expect(result.ok).toBe(true); expect(t.provided.templates.value.map(x => x.id)).toEqual([5, 1])   // the sidebar count follows it
  t.w.unmount()
})

it('refuses an empty or too long name before asking the server, and shows a server refusal', async () => {
  api.get.mockResolvedValue({ data: { templates: [] } })
  const t = setup(); await flushPromises()
  expect((await t.used.create({ page: 'image', title: ' ', prompt: 'x' })).field).toBe('title')
  expect((await t.used.create({ page: 'image', title: 'x'.repeat(81), prompt: 'x' })).field).toBe('title')
  expect(api.post).not.toHaveBeenCalled()
  api.post.mockRejectedValue(refused(400, 'bad_value', 'Choose a Studio page.', 'page'))
  const result = await t.used.create({ page: 'nowhere', title: 'Name', prompt: 'x' })
  expect(result).toEqual({ ok: false, error: 'Choose a Studio page.', field: 'page' })
  expect(notify.error).toHaveBeenCalledWith('Choose a Studio page.'); expect(t.used.templates.value).toEqual([]); t.w.unmount()
})

it('renames a template in place', async () => {
  api.get.mockResolvedValue({ data: { templates: [row(2), row(1)] } })
  api.patch.mockImplementation((url, body) => Promise.resolve({ data: { ...row(1), ...body } }))
  const t = setup(); await flushPromises()
  expect((await t.used.rename(1, ' Renamed ')).ok).toBe(true)
  expect(api.patch).toHaveBeenCalledWith('/video/templates/1/', { title: 'Renamed' })
  expect(t.used.templates.value.map(x => x.title)).toEqual(['Template 2', 'Renamed']); t.w.unmount()
})

it('deletes a template, and treats another person\'s (404) template as gone from the list', async () => {
  api.get.mockResolvedValue({ data: { templates: [row(3), row(2), row(1)] } })
  api.delete.mockResolvedValueOnce({ status: 204 })
  const t = setup(); await flushPromises()
  expect((await t.used.remove(3)).ok).toBe(true); expect(api.delete).toHaveBeenCalledWith('/video/templates/3/')
  api.delete.mockRejectedValueOnce(refused(404, 'not_found', 'Not found.'))
  expect((await t.used.remove(2)).ok).toBe(true)
  api.patch.mockRejectedValueOnce(refused(404, 'not_found', 'Not found.'))
  const renamed = await t.used.rename(1, 'Mine now')
  expect(renamed.ok).toBe(false); expect(renamed.error).toBe('This template is no longer on your account.')
  expect(t.used.templates.value).toEqual([]); t.w.unmount()
})

it('keeps a template when deleting it fails for another reason, and says why', async () => {
  api.get.mockResolvedValue({ data: { templates: [row(1)] } })
  api.delete.mockRejectedValue(refused(500, 'server_error', 'Try again in a minute.'))
  const t = setup(); await flushPromises()
  expect(await t.used.remove(1)).toEqual({ ok: false, error: 'Try again in a minute.', field: '' })
  expect(t.used.templates.value).toHaveLength(1); t.w.unmount()
})

it('drops an answer that arrives after the signed-in person changed', async () => {
  let answerOne
  api.get.mockImplementationOnce(() => new Promise(resolve => { answerOne = resolve })).mockResolvedValueOnce({ data: { templates: [row(9, { title: 'Second person' })] } })
  const t = setup(); t.user.value = { id: 'two' }; await nextTick(); await flushPromises()
  answerOne({ data: { templates: [row(1, { title: 'First person' })] } }); await flushPromises()
  expect(t.used.templates.value.map(x => x.title)).toEqual(['Second person'])
  let created
  api.post.mockImplementation(() => new Promise(resolve => { created = resolve }))
  const pending = t.used.create({ page: 'image', title: 'Late', prompt: 'x' })
  t.user.value = null; await nextTick(); await flushPromises()
  created({ data: row(10, { title: 'Late' }) }); await pending
  expect(t.used.templates.value).toEqual([]); t.w.unmount()
})

it('fills a look with the template\'s texts, keeping the look\'s own prompt pattern when it matches', () => {
  const look = studioLooks.find(item => item.id === 'image-look-1')
  const texts = Object.fromEntries(look.variables.map(field => [field.label, `My ${field.label}`]))
  const prompt = composePreset({ ...look, variants: [], variables: look.variables.map(field => ({ ...field, default: texts[field.label] })) })
  const filled = templateLook({ prompt, variables: texts, page: 'image', title: 'Mine' }, look)
  expect(filled.id).toBe(look.id); expect(filled.promptTemplate).toBe(look.promptTemplate)
  expect(filled.variables.map(field => field.default)).toEqual(look.variables.map(field => `My ${field.label}`))
  expect(composePreset(filled)).toBe(prompt)
  const edited = templateLook({ prompt: 'An edited {prompt}', variables: {}, page: 'image', title: 'Mine' }, look)
  expect(composePreset(edited)).toBe('An edited prompt')
  const alone = templateLook({ prompt: 'Only text', variables: { Mood: 'Calm' }, page: 'music', title: 'Mine' })
  expect(alone.id).toBe(''); expect(composePreset(alone)).toBe('Only text'); expect(alone.variables).toEqual([{ id: 'Mood', label: 'Mood', default: 'Calm' }])
  expect(templateSettings({ aspect_ratio: '16:9', duration: 5, sound: false, n: '2' })).toEqual({ aspect_ratio: '16:9', duration: 5, sound: false })
})
