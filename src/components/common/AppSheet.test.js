// @vitest-environment jsdom
// AppSheet (ADM-1333): a side or bottom drawer with the same dialog guarantees as AppDialog.
import { describe, it, expect, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import AppSheet from './AppSheet.vue'

const tick = async () => { await flushPromises(); await nextTick(); await new Promise((r) => setTimeout(r, 0)); await nextTick() }

function host(props = {}, slots = {}) {
  const open = ref(false)
  const Host = defineComponent({
    setup() {
      return () => h('div', [
        h('button', { id: 'opener' }, 'Runs'),
        h(AppSheet, { open: open.value, 'onUpdate:open': (v) => { open.value = v }, title: 'Run history', ...props },
          { default: () => h('button', { id: 'inside' }, 'Row'), ...slots }),
      ])
    },
  })
  return { wrapper: mount(Host, { attachTo: document.body }), open }
}

let current
afterEach(() => { current?.wrapper.unmount(); current = null; document.body.innerHTML = '' })
const sheet = () => document.body.querySelector('[role="dialog"]')

describe('AppSheet', () => {
  it('opens on the requested side, labelled and modal', async () => {
    current = host({ side: 'bottom', size: 'lg' })
    current.open.value = true
    await tick()
    const s = sheet()
    expect(s.classList.contains('app-sheet--bottom')).toBe(true)
    expect(s.classList.contains('app-sheet--lg')).toBe(true)
    expect(s.getAttribute('aria-modal')).toBe('true')
    expect(document.getElementById(s.getAttribute('aria-labelledby')).textContent).toBe('Run history')
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('defaults to the right side', async () => {
    current = host()
    current.open.value = true
    await tick()
    expect(sheet().classList.contains('app-sheet--right')).toBe(true)
  })

  it('traps focus inside, Esc closes, focus returns to the opener', async () => {
    current = host()
    const opener = document.getElementById('opener')
    opener.focus()
    current.open.value = true
    await tick()
    expect(sheet().contains(document.activeElement)).toBe(true)
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await tick()
    expect(current.open.value).toBe(false)
    expect(document.activeElement).toBe(opener)
  })

  it('renders header actions beside the close button', async () => {
    current = host({}, { 'header-actions': () => h('button', { id: 'refresh', 'aria-label': 'Refresh' }) })
    current.open.value = true
    await tick()
    expect(sheet().querySelector('header #refresh')).not.toBeNull()
    expect(sheet().querySelector('header button[aria-label="Close"]')).not.toBeNull()
  })
})
