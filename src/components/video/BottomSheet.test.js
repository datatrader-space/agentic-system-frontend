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

  it('keeps Tab inside the open sheet and the page still while it is open (ADM-1170)', async () => {
    viewport(true)
    document.body.style.overflow = 'auto'
    const w = mount(BottomSheet, { attachTo: document.body, props: { label: 'Preset', testId: 'p' },
                                   slots: { default: '<button id="a">A</button><button id="b">B</button>' } })
    await w.get('[data-test="p-open"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(document.body.style.overflow).toBe('hidden')
    const sheet = document.querySelector('[data-test="p"]')
    const buttons = [...sheet.querySelectorAll('button')]
    buttons[buttons.length - 1].focus()
    sheet.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(buttons[0])                       // wraps to the first, never leaves
    buttons[0].focus()
    sheet.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(buttons[buttons.length - 1])
    sheet.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await new Promise((r) => setTimeout(r, 0))
    expect(document.body.style.overflow).toBe('auto')                    // restored on close
    w.unmount()
  })
})
