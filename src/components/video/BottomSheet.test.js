// @vitest-environment jsdom
// Plan 4.4: below 1024px settings, references and export open in a bottom sheet; wider, they stay in place.
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BottomSheet from './BottomSheet.vue'

function viewport(narrow) {
  window.matchMedia = vi.fn(() => ({ matches: narrow, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
}

describe('BottomSheet', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('renders its content in place on a wide screen', () => {
    viewport(false)
    const w = mount(BottomSheet, { props: { label: 'Export', testId: 'x' }, slots: { default: '<button id="go">Go</button>' } })
    expect(w.find('#go').exists()).toBe(true)
    expect(w.find('[data-test="x-open"]').exists()).toBe(false)
  })

  it('on a narrow screen opens as a dialog from its button, focuses inside, and closes on Escape', async () => {
    viewport(true)
    const w = mount(BottomSheet, { attachTo: document.body, props: { label: 'Export', summary: '16:9', testId: 'x' },
                                   slots: { default: '<button id="go">Go</button>' } })
    expect(document.getElementById('go')).toBe(null)
    const open = w.get('[data-test="x-open"]')
    expect(open.text()).toContain('16:9')
    await open.trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    const sheet = document.querySelector('[data-test="x"]')
    expect(sheet.getAttribute('role')).toBe('dialog')
    expect(sheet.getAttribute('aria-modal')).toBe('true')
    expect(sheet.contains(document.activeElement)).toBe(true)
    sheet.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await new Promise((r) => setTimeout(r, 0))
    expect(document.querySelector('[data-test="x"]')).toBe(null)
    w.unmount()
  })
})
