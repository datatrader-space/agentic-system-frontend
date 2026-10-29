// @vitest-environment jsdom
// The skills LIST carries no `body` (page-speed ADM-1076/1077), so Edit reads the skill's detail before it
// fills the form, and a failed read shows the error instead of letting an empty body be saved.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn(), checkAuth: vi.fn() }))
const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }))
vi.mock('../../services/api', () => ({ default: api }))
vi.mock('@/composables/useNotify', () => ({ notify }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn() }))

import SkillsLibraryPanel from './SkillsLibraryPanel.vue'

const ROW = { id: 7, name: 'Brief', description: 'Use when writing a brief.', visibility: 'private',
              trust_status: 'untrusted', files: [], lint: [] }          // a list row: no body
const BODY = 'Read the request, then draft the brief.'

let detail
beforeEach(() => {
  vi.clearAllMocks()
  api.checkAuth.mockResolvedValue({ data: { user: { is_staff: false } } })
  api.get.mockImplementation((url) => url === '/skills/'
    ? Promise.resolve({ data: { results: [ROW], next: null } })
    : new Promise((resolve, reject) => { detail = { resolve, reject } }))
})

async function openEdit() {
  const w = mount(SkillsLibraryPanel)
  await flushPromises()
  await w.findAll('button').find(b => b.text() === 'Edit').trigger('click')
  await flushPromises()
  return w
}
const saveButton = (w) => w.findAll('button').find(b => b.text() === 'Save changes')

describe('SkillsLibraryPanel — Edit', () => {
  it('reads the detail, shows it loading, then fills the form and saves the real body', async () => {
    const w = await openEdit()
    expect(api.get).toHaveBeenCalledWith('/skills/7/')
    expect(w.text()).toContain('Loading the skill')
    expect(saveButton(w).attributes('disabled')).toBeDefined()

    detail.resolve({ data: { ...ROW, body: BODY } })
    await flushPromises()
    expect(w.text()).not.toContain('Loading the skill')
    expect(w.find('textarea').element.value).toBe(BODY)
    expect(saveButton(w).attributes('disabled')).toBeUndefined()

    api.patch.mockResolvedValue({ data: { ...ROW, body: BODY } })
    await saveButton(w).trigger('click')
    await flushPromises()
    expect(api.patch).toHaveBeenCalledWith('/skills/7/', { name: 'Brief', description: ROW.description, body: BODY })
  })

  it('a failed read shows the error and never saves an empty body', async () => {
    const w = await openEdit()
    detail.reject({ response: { status: 500, data: {} } })
    await flushPromises()
    expect(w.find('[role="alert"]').text()).toContain('Could not load the skill to edit.')
    expect(w.find('textarea').exists()).toBe(false)
    expect(saveButton(w).attributes('disabled')).toBeDefined()
    await w.vm.save()
    await flushPromises()
    expect(api.patch).not.toHaveBeenCalled()
  })
})
