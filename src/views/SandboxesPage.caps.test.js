// @vitest-environment jsdom
// ADM-1307: there is no per-person sandbox limit and no platform default spend cap. The page shows what the person's
// running sandboxes hold (never "N / 0 capacity"), and with no organization budget says sandbox time is paid from the
// balance (never "From your undefined budget").
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const usage = {
  capacity: { used_weight: 4 },
  totals: { cost: 0.5, hours_consumed: 2, leases: 3, live_leases: 2 },
  rate: { configured: false },
  budget: { priced: true, source: 'none', managed_in: 'Budgets',
            daily: { spent: 0.1, limit: null, used_pct: 0 }, monthly: { spent: 0.5, limit: null, used_pct: 0 } },
  leases: [],
}
vi.mock('../services/api', () => ({
  default: {
    getSandboxUsage: vi.fn(async () => ({ data: usage })),
    getSandboxSettings: vi.fn(async () => ({ data: {} })),
    updateSandboxSettings: vi.fn(async () => ({ data: {} })),
    terminateSandboxLease: vi.fn(async () => ({})),
  },
}))
vi.mock('../composables/useNotify', () => ({ useNotify: () => ({ success: vi.fn(), error: vi.fn() }) }))
vi.mock('../composables/useConfirm', () => ({ useConfirm: () => ({ confirm: vi.fn(async () => false) }) }))

import SandboxesPage from './SandboxesPage.vue'

describe('SandboxesPage — no per-person caps (ADM-1307)', () => {
  it('shows what is in use, with no limit, and says time is paid from the balance', async () => {
    const w = mount(SandboxesPage, { global: { stubs: { Icon: true, RouterLink: true, 'router-link': true } } })
    await flushPromises()
    const text = w.text()
    expect(text).toContain('4 in use')
    expect(text).not.toMatch(/\/ 0 capacity|Unlimited capacity/)
    expect(text).toContain('No organization budget: sandbox time is paid from your balance.')
    expect(text).not.toContain('undefined')
    w.unmount()
  })
})
