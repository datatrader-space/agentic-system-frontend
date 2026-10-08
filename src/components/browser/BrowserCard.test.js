// @vitest-environment jsdom
// The browser's card in a chat: a square preview in the chat's top corner, with an expand mark, that opens
// the browser view LARGE. It used to be a wide "Watch" card in the middle of the chat above the messages,
// and the view it opened was a narrow side pane a page could not be read in (owner, 2026-10-08).
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'

vi.mock('../../services/api', () => ({ default: { get: vi.fn().mockResolvedValue({ data: { actions: [] } }), post: vi.fn() } }))

import BrowserCard from './BrowserCard.vue'
import { useBrowserStore } from '../../stores/useBrowserStore'

const SESSION = {
  session_id: 'bs_1', state: 'ACTIVE', site: 'kurumera.com', address: 'https://kurumera.com/dashboard',
  watchable: true, action_count: 4, control: { holder: 'agent', epoch: 1, mine: false },
}

let browser
beforeEach(() => {
  setActivePinia(createPinia())
  browser = useBrowserStore()
  browser.applySession(SESSION)
})

describe('the browser card', () => {
  it('is one button that says where the browser is and what it is doing', () => {
    const w = mount(BrowserCard)
    const card = w.get('[data-test="bl-card"]')
    expect(card.element.tagName).toBe('BUTTON')
    expect(w.get('[data-test="bl-card-site"]').text()).toBe('kurumera.com')
    expect(w.get('[data-test="bl-card-state"]').text()).toBe(browser.label)
    expect(card.attributes('aria-label')).toContain('kurumera.com')
    expect(card.attributes('title')).toContain('open the browser view')
  })

  it('shows the page and an expand mark', () => {
    const w = mount(BrowserCard)
    expect(w.get('[data-test="bl-card-thumb"]').attributes('src')).toBe(browser.thumbUrl)
    expect(w.find('[data-test="bl-card-expand"]').exists()).toBe(true)
  })

  it('opens the browser view large when pressed', async () => {
    const w = mount(BrowserCard)
    expect(browser.open).toBe(false)
    await w.get('[data-test="bl-card"]').trigger('click')
    expect(browser.open).toBe(true)
    expect(browser.expanded).toBe(true)
  })

  it('pressed again while the view is docked, makes it large', async () => {
    browser.show()
    expect(browser.expanded).toBe(false)
    const w = mount(BrowserCard)
    await w.get('[data-test="bl-card"]').trigger('click')
    expect(browser.open).toBe(true)
    expect(browser.expanded).toBe(true)
  })

  it('is marked when the browser is waiting for the person', async () => {
    const w = mount(BrowserCard)
    expect(w.get('[data-test="bl-card"]').classes()).not.toContain('wait')
    browser.applySession({ ...SESSION, state: 'WAITING_HUMAN', needs_person: true, challenge: 'LOGIN' })
    await nextTick()
    if (browser.needsPerson) expect(w.get('[data-test="bl-card"]').classes()).toContain('wait')
  })

  it('falls back to an icon when there is no picture to show', async () => {
    const w = mount(BrowserCard)
    await w.get('[data-test="bl-card-thumb"]').trigger('error')
    expect(w.find('[data-test="bl-card-thumb"]').exists()).toBe(false)
    expect(w.find('.blc-thumb svg').exists()).toBe(true)
  })
})

describe('expanding and putting back', () => {
  it('expand opens the view if it was closed', () => {
    browser.expand()
    expect([browser.open, browser.expanded]).toEqual([true, true])
  })

  it('collapse puts it back in the side dock without closing it', () => {
    browser.expand()
    browser.collapse()
    expect([browser.open, browser.expanded]).toEqual([true, false])
  })

  it('closing always ends the large view, so the next open starts in the dock', () => {
    browser.expand()
    browser.close()
    expect([browser.open, browser.expanded]).toEqual([false, false])
    browser.show()
    expect(browser.expanded).toBe(false)
  })

  it('there is nothing to expand without a browser', () => {
    setActivePinia(createPinia())
    const none = useBrowserStore()
    none.expand()
    expect([none.open, none.expanded]).toEqual([false, false])
  })
})
