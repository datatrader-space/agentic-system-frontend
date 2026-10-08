// @vitest-environment jsdom
// The dock's Browser tab: it exists only while a browser pane is open, and closing it closes the pane
// (and with it the live connection) without disturbing the Canvas or Artifacts.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

import ChatDock from './ChatDock.vue'
import { useBrowserStore } from '../../stores/useBrowserStore'
import { useArtifactsStore } from '../../stores/useArtifactsStore'

const card = { session_id: 'bs_1', state: 'ACTIVE', watchable: true, control: { holder: 'agent', mine: false } }

let browser
let artifacts
beforeEach(() => {
  setActivePinia(createPinia())
  browser = useBrowserStore()
  artifacts = useArtifactsStore()
})

const tabs = (w) => w.findAll('[role="tab"]').map((t) => t.text().trim())
const selected = (w) => w.findAll('[role="tab"]').filter((t) => t.attributes('aria-selected') === 'true').map((t) => t.text().trim())

describe('the dock', () => {
  it('has no Browser tab until a browser pane is open', () => {
    const w = shallowMount(ChatDock)
    expect(tabs(w)).toEqual(['Artifacts'])
    expect(w.findComponent({ name: 'BrowserPanel' }).exists()).toBe(false)
  })

  it('shows the Browser tab on top when the pane is opened', async () => {
    browser.applySession(card)
    browser.show()
    const w = shallowMount(ChatDock)
    await nextTick()
    expect(tabs(w)).toEqual(['Browser', 'Artifacts'])
    expect(selected(w)).toEqual(['Browser'])
    expect(w.findComponent({ name: 'BrowserPanel' }).props('active')).toBe(true)
  })

  it('pauses the pane, without unmounting it, behind Artifacts', async () => {
    browser.applySession(card)
    browser.show()
    const w = shallowMount(ChatDock)
    await nextTick()
    await w.findAll('[role="tab"]')[1].trigger('click')
    expect(selected(w)).toEqual(['Artifacts'])
    const pane = w.findComponent({ name: 'BrowserPanel' })
    expect(pane.exists()).toBe(true)
    expect(pane.props('active')).toBe(false)
  })

  it('closing on the Browser tab closes the browser pane and unmounts it', async () => {
    browser.applySession(card)
    browser.show()
    artifacts.open = true
    const w = shallowMount(ChatDock)
    await nextTick()
    await w.find('[data-test="dock-tab-browser"]').trigger('click')
    await w.find('.dock-x').trigger('click')
    await nextTick()
    expect(browser.open).toBe(false)
    expect(artifacts.open).toBe(true)
    expect(w.findComponent({ name: 'BrowserPanel' }).exists()).toBe(false)
    expect(selected(w)).toEqual(['Artifacts'])
  })

  it('expands the browser view over the chat and puts it back', async () => {
    browser.applySession(card)
    browser.show()
    const w = shallowMount(ChatDock, { attachTo: document.body })
    await nextTick()
    const dock = w.get('[data-test="dock"]')
    const button = w.get('[data-test="dock-expand"]')
    expect(dock.classes()).not.toContain('expanded')
    expect(button.attributes('aria-pressed')).toBe('false')

    await button.trigger('click')
    expect(browser.expanded).toBe(true)
    expect(dock.classes()).toContain('expanded')
    expect(button.attributes('aria-pressed')).toBe('true')
    expect(button.attributes('aria-label')).toBe('Back to the side panel')

    await button.trigger('click')
    expect(browser.expanded).toBe(false)
    expect(browser.open).toBe(true)                     // put back, not closed
    expect(dock.classes()).not.toContain('expanded')
    w.unmount()
  })

  it('a click on the dimmed surround, or Escape, puts the large view back in the dock', async () => {
    browser.applySession(card)
    browser.expand()
    const w = shallowMount(ChatDock, { attachTo: document.body })
    await nextTick()
    await w.get('[data-test="dock"]').trigger('click')            // the surround itself, not the box in it
    expect(browser.expanded).toBe(false)

    browser.expand()
    await nextTick()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(browser.expanded).toBe(false)
    expect(browser.open).toBe(true)
    w.unmount()
  })

  it('a click inside the large view does not put it back', async () => {
    browser.applySession(card)
    browser.expand()
    const w = shallowMount(ChatDock, { attachTo: document.body })
    await nextTick()
    await w.get('.dock-box').trigger('click')
    expect(browser.expanded).toBe(true)
    w.unmount()
  })

  it('Escape belongs to the remote page while the person is driving it', async () => {
    browser.applySession({ ...card, control: { holder: 'human', mine: true } })
    browser.expand()
    const w = shallowMount(ChatDock, { attachTo: document.body })
    await nextTick()
    expect(browser.mine).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(browser.expanded).toBe(true)
    w.unmount()
  })

  it('is the ordinary dock again behind Artifacts, and offers no expand there', async () => {
    browser.applySession(card)
    browser.expand()
    const w = shallowMount(ChatDock, { attachTo: document.body })
    await nextTick()
    await w.findAll('[role="tab"]')[1].trigger('click')           // Artifacts
    expect(w.get('[data-test="dock"]').classes()).not.toContain('expanded')
    expect(w.find('[data-test="dock-expand"]').exists()).toBe(false)
    w.unmount()
  })

  it('closing the large view closes the browser pane and ends the large view', async () => {
    browser.applySession(card)
    browser.expand()
    const w = shallowMount(ChatDock, { attachTo: document.body })
    await nextTick()
    await w.get('.dock-x').trigger('click')
    expect([browser.open, browser.expanded]).toEqual([false, false])
    w.unmount()
  })

  it('closing on Artifacts leaves the browser pane open', async () => {
    browser.applySession(card)
    browser.show()
    artifacts.open = true
    const w = shallowMount(ChatDock)
    await nextTick()
    await w.findAll('[role="tab"]')[1].trigger('click')
    await w.find('.dock-x').trigger('click')
    await nextTick()
    expect(artifacts.open).toBe(false)
    expect(browser.open).toBe(true)
    expect(selected(w)).toEqual(['Browser'])
  })
})
