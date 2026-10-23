import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const tenancy = vi.hoisted(() => ({ getMyOrgs: vi.fn(), getOrgOverview: vi.fn(), getOrgMembers: vi.fn() }))
vi.mock('../services/tenancyApi', () => ({ default: tenancy }))
const api = vi.hoisted(() => ({ getBudgetsSummary: vi.fn() }))
vi.mock('../services/api', () => ({ default: api }))

import { useOrganizationStore } from './useOrganizationStore'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  api.getBudgetsSummary.mockResolvedValue({ data: { ok: 1 } })
  tenancy.getOrgMembers.mockResolvedValue({ data: [] })
})

describe('useOrganizationStore.load', () => {
  it('a failed orgs request is an error, not "you have no organization"', async () => {
    tenancy.getMyOrgs.mockRejectedValueOnce(Object.assign(new Error('offline'), { message: 'offline' }))
    const store = useOrganizationStore()
    await store.load()
    expect(store.error).toBe('offline')
    expect(store.error).not.toBe('no_org')
  })

  it('a user with no organization still gets no_org', async () => {
    tenancy.getMyOrgs.mockResolvedValueOnce({ data: [] })
    const store = useOrganizationStore()
    await store.load()
    expect(store.error).toBe('no_org')
  })

  it('starts the budget summary alongside the org lookup, not after the overview', async () => {
    let resolveOrgs
    tenancy.getMyOrgs.mockReturnValue(new Promise((r) => { resolveOrgs = r }))
    tenancy.getOrgOverview.mockResolvedValue({ data: { organization: { slug: 'acme' } } })
    const store = useOrganizationStore()
    const done = store.load()
    expect(api.getBudgetsSummary).toHaveBeenCalledTimes(1)
    resolveOrgs({ data: [{ slug: 'acme' }] })
    await done
    expect(store.loaded).toBe(true)
  })

  it('resolveOrgSlug keeps its null-on-failure contract for the module pages', async () => {
    tenancy.getMyOrgs.mockRejectedValueOnce(new Error('offline'))
    const store = useOrganizationStore()
    await expect(store.resolveOrgSlug()).resolves.toBeNull()
  })
})
