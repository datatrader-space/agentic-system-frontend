// @vitest-environment jsdom
// 2FA enrolment shows a QR code drawn in the page from the otpauth URI (2026-10-15: there was only the secret
// text). It must not go through an outside service or v-html, and it must encode the URI the server returned.
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { encode } from 'uqr'

const URI = 'otpauth://totp/AADML:test%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=AADML'

vi.mock('../../services/api', () => ({
  default: {
    twofaStatus: vi.fn(async () => ({ data: { enabled: false, pending: false, recovery_codes_remaining: 0 } })),
    twofaSetup: vi.fn(async () => ({ data: { secret: 'JBSWY3DPEHPK3PXP', otpauth_uri: URI } })),
    getCurrentUser: vi.fn(async () => ({ data: { email: 'test@example.com', email_verified: true } })),
  },
}))
vi.mock('../../composables/useNotify', () => ({ notify: vi.fn() }))

import SecuritySettings from './SecuritySettings.vue'

describe('2FA enrolment QR code', () => {
  it('draws the otpauth URI as an inline SVG once setup starts', async () => {
    const w = mount(SecuritySettings)
    await flushPromises()
    expect(w.find('svg.otp-qr').exists()).toBe(false)

    const enable = w.findAll('button').find(b => b.text() === 'Enable 2FA')
    expect(enable).toBeTruthy()
    await enable.trigger('click')
    await flushPromises()

    const svg = w.find('svg.otp-qr')
    expect(svg.exists()).toBe(true)
    const { size, data } = encode(URI, { border: 2, ecc: 'M' })
    expect(svg.attributes('viewBox')).toBe(`0 0 ${size} ${size}`)
    const dark = data.flat().filter(Boolean).length
    expect((svg.find('path').attributes('d').match(/M/g) || []).length).toBe(dark)
    // Drawn in the page: no image or link to a QR service carries the secret anywhere.
    expect(w.html()).not.toMatch(/<img[^>]+otpauth|api\.qrserver|chart\.googleapis/)
  })
})
