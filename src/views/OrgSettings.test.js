// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('vue-router', () => ({ useRoute: () => ({ params: { orgSlug: 'acme', tab: 'general' } }) }))
const tenancy = vi.hoisted(() => ({ getOrg: vi.fn(), updateOrg: vi.fn(), getOrgMembers: vi.fn(), getOrgInvites: vi.fn() }))
vi.mock('../services/tenancyApi', () => ({ default: tenancy }))
const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), show: vi.fn() }))
vi.mock('@/composables/useNotify', () => ({ notify }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn(async () => true) }))

import OrgSettings from './OrgSettings.vue'

beforeEach(() => vi.clearAllMocks())
const saveBtn = (w) => w.findAll('button').find(b => b.text().includes('Save Changes'))

describe('OrgSettings — failures are visible', () => {
  it('a failed save says so (it used to look exactly like a successful one)', async () => {
    tenancy.getOrg.mockResolvedValue({ data: { name: 'Acme', slug: 'acme' } })
    tenancy.updateOrg.mockRejectedValueOnce({ response: { data: { detail: 'Slug already taken' } } })
    const w = mount(OrgSettings, { global: { stubs: { 'router-link': true } } })
    await flushPromises()
    await saveBtn(w).trigger('click')
    await flushPromises()
    expect(notify.error).toHaveBeenCalledWith('Slug already taken')
    expect(notify.success).not.toHaveBeenCalled()

    tenancy.updateOrg.mockResolvedValueOnce({ data: {} })
    await saveBtn(w).trigger('click')
    await flushPromises()
    expect(notify.success).toHaveBeenCalled()
    w.unmount()
  })

  it('a failed load shows an error with Retry, not an empty form', async () => {
    tenancy.getOrg.mockRejectedValueOnce(new Error('offline'))
    const w = mount(OrgSettings, { global: { stubs: { 'router-link': true } } })
    await flushPromises()
    expect(w.text()).toContain("Couldn't load this organisation")
    expect(saveBtn(w)).toBeUndefined()
    tenancy.getOrg.mockResolvedValueOnce({ data: { name: 'Acme', slug: 'acme' } })
    await w.find('.load-error__retry').trigger('click')
    await flushPromises()
    expect(saveBtn(w)).toBeTruthy()
    w.unmount()
  })
})
