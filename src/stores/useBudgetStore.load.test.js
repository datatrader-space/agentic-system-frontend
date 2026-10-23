// The Budgets page used to load in three rounds (summary → budgets → approvals + events).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const api = vi.hoisted(() => ({
  getBudgetsSummary: vi.fn(), getBudgets: vi.fn(), getBudgetApprovals: vi.fn(), getBudgetEvents: vi.fn(),
}))
vi.mock('../services/api', () => ({ default: api }))

import { useBudgetStore } from './useBudgetStore'

const deferred = () => { let resolve; const p = new Promise((r) => { resolve = r }); return { p, resolve } }

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  api.getBudgets.mockResolvedValue({ data: [{ id: 1 }] })
  api.getBudgetApprovals.mockResolvedValue({ data: [{ id: 2 }] })
  api.getBudgetEvents.mockResolvedValue({ data: [{ id: 3 }] })
})

describe('useBudgetStore.load', () => {
  it('first load: approvals start with the summary; org-scoped reads follow the resolved org', async () => {
    const summary = deferred()
    api.getBudgetsSummary.mockReturnValue(summary.p)
    const store = useBudgetStore()
    const done = store.load()
    await Promise.resolve()
    expect(api.getBudgetApprovals).toHaveBeenCalledTimes(1)   // not waiting on the summary
    expect(api.getBudgets).not.toHaveBeenCalled()              // needs the org first
    summary.resolve({ data: { organization: { id: 42 } } })
    await done
    expect(api.getBudgets).toHaveBeenCalledWith(42)
    expect(api.getBudgetEvents).toHaveBeenCalledWith(42)
    expect(store.budgets).toEqual([{ id: 1 }])
    expect(store.approvals).toEqual([{ id: 2 }])
    expect(store.events).toEqual([{ id: 3 }])
    expect(store.loaded).toBe(true)
  })

  it('reload with a known org: everything in one round', async () => {
    const summary = deferred()
    api.getBudgetsSummary.mockReturnValue(summary.p)
    const store = useBudgetStore()
    store.selectedOrgId = 42
    const done = store.load()
    await Promise.resolve()
    expect(api.getBudgets).toHaveBeenCalledWith(42)
    expect(api.getBudgetEvents).toHaveBeenCalledWith(42)
    expect(api.getBudgetApprovals).toHaveBeenCalled()
    summary.resolve({ data: { organization: { id: 42 } } })
    await done
    expect(api.getBudgets).toHaveBeenCalledTimes(1)
  })

  it('re-reads org-scoped data when the server resolved another org', async () => {
    api.getBudgetsSummary.mockResolvedValue({ data: { organization: { id: 7 } } })
    const store = useBudgetStore()
    store.selectedOrgId = 42
    await store.load()
    expect(api.getBudgets).toHaveBeenLastCalledWith(7)
    expect(api.getBudgetEvents).toHaveBeenLastCalledWith(7)
  })
})
