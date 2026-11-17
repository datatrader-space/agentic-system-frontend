// @vitest-environment jsdom
// Elements v2 (backend ELEMENTS_V2_PLAN.md): each Element shows its status, its copyable token, why it cannot be used
// yet; the person approves it with the rights statement, pins it, files it, archives it and restores a kept version.
// Every confirmation is inline (no browser dialog).
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))
vi.mock('../../composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))

import api from '../../services/api'
import ElementsPanel from './ElementsPanel.vue'
import { useVideoStore } from '../../stores/useVideoStore'
import { emptyRights, rightsComplete, rightsPayload } from './elementKinds'

const SCHEMA = {
  kinds: [], view_labels: ['front', 'side'],
  properties: { product: { category: { type: 'select', options: ['footwear', 'toys'] }, colors: { type: 'multi', options: ['red', 'blue'], max: 4 } } },
  statements: { rights: { statement: 'I confirm the basis I chose above.', statement_version: '2026-11-17', bases: [{ value: 'owned', label: 'I own it' }, { value: 'created', label: 'I created it' }] },
                likeness: { statement: 'The person shown is me.', statement_version: '2026-10-22', bases: [{ value: 'self', label: 'This is me' }] } },
}
const file = { attachment_id: 'img-1', media_type: 'image', title: 'shoe.png', thumbnail_url: '/t.png', view_label: 'front' }
const element = (over = {}) => ({ ingredient_id: 'e1', kind: 'product', name: 'Red sneaker', description: '', files: [file], status: 'draft',
  properties: {}, folder: '', pinned: false, handle: 'red_sneaker', token: '@red_sneaker', rights: null, ip_check: 'missing', usable: false,
  unusable_code: 'element_not_approved', unusable_reason: 'draft', version_count: 2, revision: 2, ...over })
const flush = () => new Promise(r => setTimeout(r, 0))

function mountPanel(rows, props = {}) {
  const video = useVideoStore()
  video.ingredients = rows
  video.ingredientFolders = ['Campaign']
  return mount(ElementsPanel, { props, attachTo: document.body })
}

describe('ElementsPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    api.get.mockImplementation(url => Promise.resolve({ data: url === '/video/ingredients/schema/' ? SCHEMA : { ingredients: [], folders: ['Campaign'] } }))
  })

  it('shows the status, the token and why a draft cannot be used, and Use waits for approval', async () => {
    const w = mountPanel([element()]); await flush()
    expect(w.get('[data-test="el-status-badge-e1"]').text()).toBe('Draft')
    expect(w.get('[data-test="el-token-e1"]').text()).toBe('@red_sneaker')
    expect(w.get('[data-test="el-why-e1"]').text()).toContain('Approve it to use it')
    expect(w.get('[data-test="lib-ing-use"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="el-approve-e1"]').text()).toBe('Approve')
    w.unmount()
  })

  it('copies the token', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.assign(navigator, { clipboard: { writeText } })
    const w = mountPanel([element({ status: 'approved', usable: true })]); await flush()
    await w.get('[data-test="el-token-e1"]').trigger('click'); await flush()
    expect(writeText).toHaveBeenCalledWith('@red_sneaker')
    expect(w.text()).toContain('Copied. Write it in a prompt to use this Element.')
    w.unmount()
  })

  it('approves a product only once its rights are stated and confirmed', async () => {
    api.post.mockResolvedValue({ data: element({ status: 'approved', usable: true, rights: { basis: 'owned', confirmed_at: '2026-11-17T10:00:00Z' } }) })
    const w = mountPanel([element()]); await flush()
    await w.get('[data-test="el-approve-e1"]').trigger('click'); await flush()
    expect(w.text()).toContain('I confirm the basis I chose above.')
    const submit = w.get('[data-test="ea-submit"]')
    expect(submit.attributes('disabled')).toBeDefined()
    await w.get('[data-test="ea-basis-owned"]').setValue(true)
    expect(submit.attributes('disabled')).toBeDefined()
    await w.get('[data-test="ea-rights-confirm"]').setValue(true)
    expect(submit.attributes('disabled')).toBeUndefined()
    await w.get('[data-test="el-approve-form"]').trigger('submit'); await flush()
    expect(api.post).toHaveBeenCalledWith('/video/ingredients/e1/approve/', { rights: { basis: 'owned', confirmed: true } })
    expect(w.get('[data-test="el-status-badge-e1"]').text()).toBe('Approved')
    expect(w.get('[data-test="lib-ing-use"]').attributes('disabled')).toBeUndefined()
    expect(w.get('[data-test="el-rights-e1"]').text()).toContain('I own it')
    w.unmount()
  })

  it('shows a refused approval next to the form', async () => {
    api.post.mockRejectedValue({ response: { data: { error: { code: 'consent_required', message: 'Record their consent to approve it.' } } } })
    const w = mountPanel([element({ kind: 'style' })]); await flush()
    await w.get('[data-test="el-approve-e1"]').trigger('click'); await flush()
    expect(w.text()).toContain('needs no rights statement')
    await w.get('[data-test="el-approve-form"]').trigger('submit'); await flush()
    expect(api.post).toHaveBeenCalledWith('/video/ingredients/e1/approve/', {})
    expect(w.get('[role="alert"]').text()).toBe('Record their consent to approve it.')
    w.unmount()
  })

  it('a character shown as a real person needs their name, basis and consent', async () => {
    api.post.mockResolvedValue({ data: element({ kind: 'character', status: 'approved', usable: true }) })
    const w = mountPanel([element({ kind: 'character' })]); await flush()
    await w.get('[data-test="el-approve-e1"]').trigger('click'); await flush()
    await w.get('[data-test="ea-basis-created"]').setValue(true)
    await w.get('[data-test="ea-rights-confirm"]').setValue(true)
    await w.get('[data-test="ea-real-person"]').setValue(true)
    expect(w.get('[data-test="ea-submit"]').attributes('disabled')).toBeDefined()
    await w.get('[data-test="ea-subject"]').setValue('Mara')
    await w.findAll('input[type="radio"]').find(r => r.element.value === 'self').setValue(true)
    await w.get('[data-test="ea-consent-confirm"]').setValue(true)
    await w.get('[data-test="el-approve-form"]').trigger('submit'); await flush()
    expect(api.post).toHaveBeenCalledWith('/video/ingredients/e1/approve/', {
      rights: { basis: 'created', confirmed: true }, likeness: { real_person: true, subject_name: 'Mara', basis: 'self', confirmed: true } })
    w.unmount()
  })

  it('pins, archives and restores from the archive', async () => {
    api.patch.mockResolvedValue({ data: element({ pinned: true }) })
    api.post.mockImplementation((url, body) => Promise.resolve({ data: element({ status: body.status }) }))
    const w = mountPanel([element()]); await flush()
    await w.get('[data-test="el-pin-e1"]').trigger('click'); await flush()
    expect(api.patch).toHaveBeenCalledWith('/video/ingredients/e1/', { pinned: true })
    expect(w.get('[data-test="el-pin-e1"]').attributes('aria-pressed')).toBe('true')
    await w.get('[data-test="el-archive-e1"]').trigger('click'); await flush()
    expect(api.post).toHaveBeenCalledWith('/video/ingredients/e1/status/', { status: 'archived' })
    expect(w.get('[data-test="el-status-badge-e1"]').text()).toBe('Archived')
    await w.get('[data-test="el-unarchive-e1"]').trigger('click'); await flush()
    expect(api.post).toHaveBeenLastCalledWith('/video/ingredients/e1/status/', { status: 'draft' })
    w.unmount()
  })

  it('edits the folder, token, typed properties and view labels', async () => {
    api.patch.mockResolvedValue({ data: element({ folder: 'Campaign', handle: 'hero', token: '@hero' }) })
    const w = mountPanel([element()]); await flush()
    await w.get('[data-test="el-edit-e1"]').trigger('click'); await flush()
    await w.get('[data-test="ee-folder"]').setValue('Campaign')
    await w.get('[data-test="ee-handle"]').setValue('hero')
    await w.get('[data-test="ee-prop-category"]').setValue('footwear')
    await w.findAll('input[type="checkbox"]').find(c => c.element.value === 'red').setValue(true)
    await w.get('select[aria-label="View of shoe.png"]').setValue('side')
    await w.get('[data-test="el-edit-form"]').trigger('submit'); await flush()
    expect(api.patch).toHaveBeenCalledWith('/video/ingredients/e1/', { handle: 'hero', folder: 'Campaign',
      properties: { category: 'footwear', colors: ['red'] }, view_labels: { 'img-1': 'side' } })
    expect(w.get('[data-test="el-token-e1"]').text()).toBe('@hero')
    w.unmount()
  })

  it('lists kept versions, shows one and restores it after an inline confirmation', async () => {
    api.get.mockImplementation(url => Promise.resolve({ data:
      url === '/video/ingredients/schema/' ? SCHEMA
        : url === '/video/ingredients/e1/versions/' ? { versions: [{ number: 2, current: true, file_count: 1, note: 'Changed', created_at: '2026-11-17T10:00:00Z' },
                                                                    { number: 1, current: false, file_count: 1, note: 'Created', created_at: '2026-11-16T10:00:00Z' }] }
          : url === '/video/ingredients/e1/versions/1/' ? { number: 1, name: 'Red sneaker', files: [{ attachment_id: 'old', media_type: 'image', title: 'old.png', thumbnail_url: '/o.png', view_label: 'back' }] }
            : { ingredients: [] } }))
    api.post.mockResolvedValue({ data: element({ revision: 3 }) })
    const w = mountPanel([element()]); await flush()
    await w.get('[data-test="el-history-e1"]').trigger('click'); await flush()
    expect(w.get('[data-test="el-history"]').text()).toContain('Version 2')
    expect(w.get('[data-test="el-history"]').text()).toContain('Current')
    await w.get('[data-test="eh-view-1"]').trigger('click'); await flush()
    expect(w.get('img[alt="old.png"]').exists()).toBe(true)
    expect(w.text()).toContain('Back')
    await w.get('[data-test="eh-restore-1"]').trigger('click')
    expect(w.text()).toContain('It becomes version 3, a draft to approve.')
    await w.get('[data-test="eh-restore-confirm-1"]').trigger('click'); await flush()
    expect(api.post).toHaveBeenCalledWith('/video/ingredients/e1/versions/1/restore/')
    w.unmount()
  })

  it('filters by status and folder through the server', async () => {
    const w = mountPanel([element()]); await flush()
    await w.get('[data-test="el-status-approved"]').trigger('click'); await flush()
    expect(api.get).toHaveBeenCalledWith('/video/ingredients/', { params: { status: 'approved' } })
    await w.get('[data-test="el-folder"]').setValue('Campaign'); await flush()
    expect(api.get).toHaveBeenLastCalledWith('/video/ingredients/', { params: { status: 'approved', folder: 'Campaign' } })
    w.unmount()
  })

  it('in a picker, an unusable Element cannot be picked and nothing can be changed', async () => {
    const w = mountPanel([element(), element({ ingredient_id: 'e2', name: 'Noir', status: 'approved', usable: true, token: '@noir' })], { mode: 'picker' })
    await flush()
    const uses = w.findAll('[data-test="lib-ing-use"]')
    expect(uses[0].attributes('disabled')).toBeDefined()
    expect(uses[1].attributes('disabled')).toBeUndefined()
    expect(w.find('[data-test="el-edit-e1"]').exists()).toBe(false)
    await uses[1].trigger('click')
    expect(w.emitted('use')[0][0].ingredient_id).toBe('e2')
    w.unmount()
  })

  it('the rights fields give the server what each kind needs (shared by Character Studio and the brand kit)', () => {
    const v = { ...emptyRights(), basis: 'owned', rightsConfirmed: true }
    expect(rightsComplete('brand', emptyRights())).toBe(false)
    expect(rightsPayload('brand', v)).toEqual({ rights: { basis: 'owned', confirmed: true } })
    expect(rightsComplete('style', emptyRights())).toBe(true)
    expect(rightsPayload('style', emptyRights())).toEqual({})
    // A voice sample is always a real person's voice; a character that was one and no longer is says so.
    expect(rightsComplete('voice', emptyRights(), { hasSample: true })).toBe(false)
    expect(rightsPayload('voice', { ...emptyRights(), subject: ' Ann ', consentBasis: 'self', consentConfirmed: true }, { hasSample: true }))
      .toEqual({ likeness: { real_person: true, subject_name: 'Ann', basis: 'self', confirmed: true } })
    expect(rightsPayload('character', v, { hadLikeness: true })).toEqual({ rights: { basis: 'owned', confirmed: true }, likeness: { real_person: false } })
  })
})
