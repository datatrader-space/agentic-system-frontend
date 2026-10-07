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
