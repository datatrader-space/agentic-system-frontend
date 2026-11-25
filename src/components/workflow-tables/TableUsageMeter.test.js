// @vitest-environment jsdom
// ADM-1363: the storage meter says its state with an icon and words, not colour alone, and names what to do when
// writes are paused.
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TableUsageMeter from './TableUsageMeter.vue'

const MB = 1024 * 1024
const base = { bytes: 10 * MB, free_bytes: 100 * MB, percent_of_free: 10, warn_at_bytes: 80 * MB, over_free_bytes: 0, usd_per_gb_month: 0.115, per_day_usd: 0, month_charges_usd: 0, writes_refused: false }
const meter = (usage) => mount(TableUsageMeter, { props: { usage }, global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } })

describe('TableUsageMeter (ADM-1363)', () => {
  it('shows the bytes, the percent as a meter, the month and the price', () => {
    const w = meter(base)
    expect(w.text()).toContain('10 MB of 100 MB free')
    expect(w.text()).toContain('Within free storage')
    const bar = w.get('[role="meter"]')
    expect(bar.attributes('aria-valuenow')).toBe('10')
    expect(bar.attributes('aria-valuetext')).toBe('10% of the free storage used')
    expect(w.text()).toContain('$0.12 per GB-month')
  })

  it('warns at 80%, says the charge above free, and that writes are paused', () => {
    expect(meter({ ...base, bytes: 85 * MB, percent_of_free: 85 }).text()).toContain('Near the free limit')
    const charging = meter({ ...base, bytes: 110 * MB, percent_of_free: 110, over_free_bytes: 10 * MB, per_day_usd: 0.0004, month_charges_usd: 0.01 })
    expect(charging.text()).toContain('Charged above free')
    expect(charging.text()).toContain('10 MB is charged from your balance each day')
    expect(charging.text()).toContain('$0.0004')
    const paused = meter({ ...base, bytes: 110 * MB, over_free_bytes: 10 * MB, writes_refused: true })
    expect(paused.get('[role="alert"]').text()).toContain('Writes paused')
    expect(paused.text()).toContain('Top up or delete rows')
  })
})
