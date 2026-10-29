// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LivePrice from './LivePrice.vue'
describe('LivePrice', () => {
  it('puts the no-spend note on its own line, without a stray separator (live 2026-10-29)', () => {
    const w = mount(LivePrice, { props: { price: { status: 'exact', estimate: 0.04, most: 0.04 } } })
    expect(w.get('strong').text()).toBe('About $0.04')
    expect(w.get('.lp-note').text()).toBe('Nothing is spent until you press Generate on its card.')
    w.unmount()
  })
})
