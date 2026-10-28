// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import SettingsModal from './SettingsModal.vue'
import ConfirmDialog from '../ConfirmDialog.vue'
import { confirm, _settleConfirm } from '../../composables/useConfirm'

// Use the real section catalog with inert content: no credentials or live account changes in UI tests.
vi.mock('./settingsSections', async (importOriginal) => {
  const actual = await importOriginal()
  const { inject, ref, watch } = await import('vue')
  return { SETTINGS_SECTIONS: actual.SETTINGS_SECTIONS.map(section => ({ ...section,
    component: section.key === 'connectors' ? {
      props: ['compact'],
      setup() {
        const host = inject('settingsDialogHost')
        const active = inject('settingsOverlayActive')
        const opened = ref(false)
        watch(opened, active)
        return { host, opened }
      },
      template: '<div data-panel="connectors"><button @click="opened = true">Open setup</button><Teleport :to="host"><div v-if="opened" data-settings-owned-dialog role="dialog" aria-label="Connector setup"><button @click="opened = false">Close setup</button><input aria-label="Synthetic setup field" /></div></Teleport></div>',
    } : { template: `<div data-panel="${section.key}"><button type="button">Existing ${section.label} control</button></div>` },
  })) }
})
let wrapper, confirmation
function render(props = {}) {
  document.body.innerHTML = '<div id="app"><button id="opener">Profile</button></div>'
  document.getElementById('opener').focus()
  wrapper = mount(SettingsModal, { attachTo: document.body, props, global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } } })
  return wrapper
}
async function searchSections(value) {
  const input = document.querySelector('input[type="search"]')
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}
const section = (label) => [...document.querySelectorAll('nav[aria-label="Settings sections"] button')].find(button => button.textContent.trim() === label)
afterEach(() => { _settleConfirm(false); confirmation?.unmount(); wrapper?.unmount(); document.body.innerHTML = ''; vi.restoreAllMocks() })

describe('compact settings modal', () => {
  it('includes all existing sections, mounts only the selected panel, and searches sections without losing the active panel', async () => {
    render()
    await flushPromises()
    // 12: "AI Providers" left personal settings when people stopped keeping their own AI keys (2026-10-27).
    expect(document.querySelectorAll('nav[aria-label="Settings sections"] button')).toHaveLength(12)
    expect(document.querySelectorAll('[data-panel]')).toHaveLength(1)
    expect(document.querySelector('[data-panel="general"]')).toBeTruthy()
    section('Security').click()
    await nextTick()
    expect(document.querySelector('[data-panel="security"]')).toBeTruthy()
    await searchSections('tokens')
    expect(section('Usage')).toBeTruthy()
    expect(section('General')).toBeUndefined()
    expect(document.querySelector('[data-panel="security"]')).toBeTruthy()
    await searchSections('no-such-section')
    expect(document.querySelector('[role="dialog"]').textContent).toContain('No matching sections.')
  })

  it('keeps the background inert, traps keyboard focus and restores the profile trigger on unmount', async () => {
    render()
    await flushPromises()
    expect(document.getElementById('app').hasAttribute('inert')).toBe(true)
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.querySelector('[role="dialog"]').hasAttribute('inert')).toBe(false)
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{}])
    const last = document.querySelector('[data-panel] button')
    last.focus()
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    last.dispatchEvent(tab)
    expect(document.activeElement).toBe(document.querySelector('input[type="search"]'))
    wrapper.unmount()
    expect(document.getElementById('app').hasAttribute('inert')).toBe(false)
    expect(document.activeElement.id).toBe('opener')
    expect(document.body.style.overflow).toBe('')
    wrapper = null
  })

  it('opens the requested section, and Escape requests dismissal', async () => {
    render({ initialSection: 'usage' })
    await nextTick()
    expect(document.querySelector('[data-panel="usage"]')).toBeTruthy()
    document.querySelector('input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('leaves existing destructive-action confirmations in control of Escape and focus', async () => {
    render({ initialSection: 'advanced' })
    confirmation = mount(ConfirmDialog, { attachTo: document.body })
    await flushPromises()
    document.querySelector('[data-panel] button').focus()
    const decision = confirm({ title: 'Clear local data?', danger: true })
    await flushPromises()
    expect(document.querySelector('[role="dialog"]').hasAttribute('inert')).toBe(true)
    const alert = document.querySelector('[role="alertdialog"]')
    expect(alert.contains(document.activeElement)).toBe(true)
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    expect(await decision).toBe(false)
    await flushPromises()
    expect(wrapper.emitted('close')).toBeUndefined()
    expect(document.querySelector('[role="dialog"]').hasAttribute('inert')).toBe(false)
    expect(document.querySelector('[role="dialog"]').contains(document.activeElement)).toBe(true)
  })
})

describe('settings connection dialogs', () => {
  it('isolates a nested setup dialog and returns focus after it closes', async () => {
    render()
    await flushPromises()
    section('Connectors').click()
    await flushPromises()
    const opener = document.querySelector('[data-panel="connectors"] button')
    opener.focus()
    opener.click()
    await flushPromises()
    const nested = document.querySelector('[data-settings-owned-dialog]')
    const main = document.querySelector('.settings-modal')
    expect(main.hasAttribute('inert')).toBe(true)
    expect(nested.contains(document.activeElement)).toBe(true)
    document.querySelector('.settings-overlay').click()
    expect(wrapper.emitted('close')).toBeUndefined()
    nested.querySelector('button').click()
    await flushPromises()
    expect(main.hasAttribute('inert')).toBe(false)
    expect(document.activeElement).toBe(opener)
  })
})

describe('settings full-page access', () => {
  it('retains the original Organization and Budgets URLs', async () => {
    render()
    await flushPromises()
    for (const key of ['organization', 'budgets']) {
      section(key === 'organization' ? 'Organization' : 'Budgets').click()
      await flushPromises()
      const link = document.querySelector('.settings-full-page')
      expect(link.textContent).toContain('Open full page')
      expect(link.getAttribute('href')).toBe(`/dashboard/${key}`)
    }
  })
})
