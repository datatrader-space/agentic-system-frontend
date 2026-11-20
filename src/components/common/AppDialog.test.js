// @vitest-environment jsdom
// AppDialog (ADM-1333): the shared modal on Reka UI. Labelled dialog, aria-modal, focus moved in and trapped,
// Esc closes, the page behind cannot scroll, and focus goes back to whatever opened it from code.
import { describe, it, expect, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import AppDialog from './AppDialog.vue'

const tick = async () => { await flushPromises(); await nextTick(); await new Promise((r) => setTimeout(r, 0)); await nextTick() }

function host(props = {}, slots = {}) {
  const open = ref(false)
  const Host = defineComponent({
    setup() {
      return () => h('div', [
        h('button', { id: 'opener', onClick: () => { open.value = true } }, 'Open'),
        h(AppDialog, {
          open: open.value, 'onUpdate:open': (v) => { open.value = v },
          title: 'Run with inputs', ...props,
        }, {
          default: () => [h('input', { id: 'first' }), h('button', { id: 'second' }, 'Second')],
          ...slots,
        }),
      ])
    },
  })
  const wrapper = mount(Host, { attachTo: document.body })
  return { wrapper, open }
}

let current
afterEach(() => { current?.wrapper.unmount(); current = null; document.body.innerHTML = '' })

const dialog = () => document.body.querySelector('[role="dialog"]')

describe('AppDialog', () => {
  it('renders nothing while closed', async () => {
    current = host()
    await tick()
    expect(dialog()).toBeNull()
  })

  it('is a labelled, modal dialog with its description', async () => {
    current = host({ description: 'Values for this run only.' })
    current.open.value = true
    await tick()
    const d = dialog()
    expect(d).not.toBeNull()
    expect(d.getAttribute('aria-modal')).toBe('true')
    const title = document.getElementById(d.getAttribute('aria-labelledby'))
    expect(title.textContent).toBe('Run with inputs')
    const desc = document.getElementById(d.getAttribute('aria-describedby'))
    expect(desc.textContent).toBe('Values for this run only.')
  })

  it('has no dangling aria-describedby without a description', async () => {
    current = host()
    current.open.value = true
    await tick()
    expect(dialog().hasAttribute('aria-describedby')).toBe(false)
  })

  it('moves focus into the dialog and locks the page scroll', async () => {
    current = host()
    document.getElementById('opener').focus()
    current.open.value = true
    await tick()
    expect(dialog().contains(document.activeElement)).toBe(true)
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('Esc closes it and focus returns to the opener', async () => {
    current = host()
    const opener = document.getElementById('opener')
    opener.focus()
    current.open.value = true
    await tick()
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await tick()
    expect(current.open.value).toBe(false)
    expect(dialog()).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it('the close button has an accessible name and closes it', async () => {
    current = host()
    current.open.value = true
    await tick()
    const close = dialog().querySelector('button[aria-label="Close"]')
    expect(close).not.toBeNull()
    close.click()
    await tick()
    expect(current.open.value).toBe(false)
  })

  it('renders the footer slot and the size class', async () => {
    current = host({ size: 'lg' }, { footer: () => h('button', { id: 'run' }, 'Run') })
    current.open.value = true
    await tick()
    expect(dialog().classList.contains('app-dialog--lg')).toBe(true)
    expect(dialog().querySelector('footer #run')).not.toBeNull()
  })

  it('initialFocus picks where focus lands', async () => {
    current = host({ initialFocus: () => document.getElementById('second') })
    current.open.value = true
    await tick()
    expect(document.activeElement?.id).toBe('second')
  })
})
