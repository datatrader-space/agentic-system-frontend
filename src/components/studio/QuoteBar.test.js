// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import QuoteBar from './QuoteBar.vue'
describe('QuoteBar', () => {
  it('blocks an incomplete request and explains the reason without inventing a price', async () => {
    const w = mount(QuoteBar, { props: { summary: '1 image', disabledReason: 'Add your product to continue.' } })
    const generate = w.get('[data-test="studio-generate"]')
    expect(generate.attributes('disabled')).toBeDefined()
    expect(generate.classes()).not.toContain('primary')
    expect(w.get('[role="status"]').text()).toBe('Add your product to continue.')
    expect(generate.attributes('aria-describedby')).toBe(w.get('[role="status"]').attributes('id'))
    expect(w.text()).toContain('Price shown on the approval card before anything is spent')
    await generate.trigger('click'); expect(w.emitted('generate')).toBeUndefined()
    await w.setProps({ disabledReason: '' }); await generate.trigger('click')
    expect(w.emitted('generate')).toHaveLength(1)
    w.unmount()
  })
  it('shows known prices and emits shuffle independently of Generate', async () => {
    const w = mount(QuoteBar, { props: { summary: '5 s video', priceUsd: 0.12 } })
    expect(w.text()).toContain('$0.120')
    await w.get('[aria-label="Shuffle preset variation"]').trigger('click')
    expect(w.emitted('shuffle')).toHaveLength(1); expect(w.emitted('generate')).toBeUndefined()
    await w.setProps({ priceUsd: 0 }); expect(w.text()).toContain('Free local edit')
    w.unmount()
  })
})
