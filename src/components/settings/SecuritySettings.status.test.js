// @vitest-environment jsdom
// A failed 2FA status read must not offer "Enable 2FA": the account may already have 2FA on.
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const api = vi.hoisted(() => ({ twofaStatus: vi.fn(), getCurrentUser: vi.fn(async () => ({ data: {} })) }))
vi.mock('../../services/api', () => ({ default: api }))
vi.mock('../../composables/useNotify', () => ({ notify: vi.fn() }))

import SecuritySettings from './SecuritySettings.vue'

describe('SecuritySettings — 2FA status', () => {
  it('shows an error with Retry instead of "Enable 2FA" when the status read fails', async () => {
    api.twofaStatus.mockRejectedValueOnce(new Error('500'))
    const w = mount(SecuritySettings)
    await flushPromises()
    expect(w.findAll('button').some(b => b.text() === 'Enable 2FA')).toBe(false)
    expect(w.text()).toContain("Couldn't check two-factor authentication")

    api.twofaStatus.mockResolvedValueOnce({ data: { enabled: true, recovery_codes_remaining: 3 } })
    await w.find('.load-error__retry').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Enabled')
    expect(w.text()).toContain('3 recovery code(s) remaining')
    w.unmount()
  })
})
