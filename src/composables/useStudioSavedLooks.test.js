// @vitest-environment jsdom
// Saved templates live on the person's account (GET/PUT /api/video/preferences/), so they are the same on every device.
import { defineComponent, h, ref, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }))
const notify = vi.hoisted(() => ({ error: vi.fn() }))
vi.mock('../services/api', () => ({ default: api }))
vi.mock('./useNotify', () => ({ notify }))
import { provideStudioSavedLooks, useStudioSavedLooks } from './useStudioSavedLooks'
import { studioLooks } from '../services/studioLooks'
const [a, b, c] = studioLooks.map(look => look.id)

function setup(user = ref({ id: 'one' })) {
  let saved, provided
  const Child = defineComponent({ setup() { saved = useStudioSavedLooks(); return () => h('div', saved.ids.value.join(',')) } })
  const w = mount(defineComponent({ setup() { provided = provideStudioSavedLooks(user); return () => h(Child) } }))
  return { w, user, get saved() { return saved }, get provided() { return provided } }
}
beforeEach(() => { localStorage.clear(); api.get.mockReset(); api.put.mockReset(); notify.error.mockReset() })

it('shows the account list and saves the whole list on each change', async () => {
  api.get.mockResolvedValue({ data: { favorite_looks: [a] } })
  api.put.mockImplementation((_, body) => Promise.resolve({ data: body }))
  const t = setup(); await flushPromises()
  expect(api.get).toHaveBeenCalledWith('/video/preferences/')
  expect(t.saved.ids.value).toEqual([a])
  t.saved.toggle(b); t.saved.toggle('unknown-private-prompt'); await flushPromises()
  expect(api.put).toHaveBeenCalledTimes(1)
  expect(api.put).toHaveBeenLastCalledWith('/video/preferences/', { favorite_looks: [a, b] })
  expect(t.saved.ids.value).toEqual([a, b]); expect(t.provided.ids.value).toHaveLength(2)   // the sidebar count follows it
  t.saved.toggle(a); await flushPromises()
  expect(api.put).toHaveBeenLastCalledWith('/video/preferences/', { favorite_looks: [b] })
  expect(t.saved.ids.value).toEqual([b])
  expect(localStorage.length).toBe(0)
  t.w.unmount()
})

it('uploads this browser\'s old list once when the account has none, then removes the browser copy', async () => {
  localStorage.setItem('aadml.studio.saved-looks.one', JSON.stringify([a, 'unknown-private-prompt', c]))
  api.get.mockResolvedValue({ data: { favorite_looks: [] } })
  api.put.mockImplementation((_, body) => Promise.resolve({ data: body }))
  const t = setup(); await flushPromises()
  expect(api.put).toHaveBeenCalledTimes(1)
  expect(api.put).toHaveBeenCalledWith('/video/preferences/', { favorite_looks: [a, c] })
  expect(t.saved.ids.value).toEqual([a, c])
  expect(localStorage.getItem('aadml.studio.saved-looks.one')).toBeNull()
  t.w.unmount()
})

it('keeps the account list, never the browser copy, when the account already has one', async () => {
  localStorage.setItem('aadml.studio.saved-looks.one', JSON.stringify([c]))
  api.get.mockResolvedValue({ data: { favorite_looks: [b] } })
  const t = setup(); await flushPromises()
  expect(api.put).not.toHaveBeenCalled()
  expect(t.saved.ids.value).toEqual([b])
  expect(localStorage.getItem('aadml.studio.saved-looks.one')).toBeNull()
  t.w.unmount()
})

it('keeps the previous list and shows the server\'s message when a save is refused', async () => {
  api.get.mockResolvedValue({ data: { favorite_looks: [a] } })
  api.put.mockRejectedValue({ response: { status: 400, data: { error: { code: 'invalid', message: 'You can save up to 200 templates.', field: 'favorite_looks' } } } })
  const t = setup(); await flushPromises()
  t.saved.toggle(b); t.saved.toggle(c)
  expect(t.saved.ids.value).toEqual([a, b, c])
  await flushPromises()
  expect(t.saved.ids.value).toEqual([a])
  expect(t.saved.error.value).toBe('You can save up to 200 templates.')
  expect(notify.error).toHaveBeenCalledWith('You can save up to 200 templates.')
  expect(api.put).toHaveBeenCalledTimes(1)   // the second save was built on the refused one and is not sent
  t.w.unmount()
})

it('keeps the browser copy when the upload is refused, and shows it', async () => {
  localStorage.setItem('aadml.studio.saved-looks.one', JSON.stringify([a]))
  api.get.mockResolvedValue({ data: { favorite_looks: [] } })
  api.put.mockRejectedValueOnce(new Error('network'))
  const t = setup(); await flushPromises()
  expect(t.saved.ids.value).toEqual([a])
  expect(localStorage.getItem('aadml.studio.saved-looks.one')).toBe(JSON.stringify([a]))
  expect(notify.error).toHaveBeenCalled()
  t.w.unmount()
})

it('clears the list when the signed-in person changes and ignores the previous person\'s answer', async () => {
  let first
  api.get.mockImplementationOnce(() => new Promise(resolve => { first = resolve })).mockResolvedValueOnce({ data: { favorite_looks: [c] } })
  const t = setup(); await nextTick()
  t.user.value = { id: 'two' }; await flushPromises()
  first({ data: { favorite_looks: [a] } }); await flushPromises()
  expect(t.saved.ids.value).toEqual([c])
  t.user.value = null; await flushPromises()
  expect(t.saved.ids.value).toEqual([])
  t.saved.toggle(a); expect(api.put).not.toHaveBeenCalled()   // nobody signed in: nothing to save
  t.w.unmount()
})
