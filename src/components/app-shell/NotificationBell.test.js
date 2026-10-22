// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
const api = vi.hoisted(() => ({
  getNotifUnreadCount: vi.fn(),
  getNotifications: vi.fn(),
  markNotifRead: vi.fn(),
  markAllNotifsRead: vi.fn(),
}))
vi.mock('../../services/api', () => ({ default: api }))

import NotificationBell from './NotificationBell.vue'

let wrapper
beforeEach(() => {
  vi.clearAllMocks()
  api.getNotifUnreadCount.mockResolvedValue({ data: { count: 0 } })
})
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = '' })

async function openBell() {
  wrapper = mount(NotificationBell, { attachTo: document.body, global: { stubs: { Icon: true, Bell: true } } })
  await wrapper.find('.nb-btn').trigger('click')
  await flushPromises()
}

describe('NotificationBell', () => {
  it('shows an error with Retry when the list fails — never "all caught up"', async () => {
    api.getNotifications.mockRejectedValueOnce(new Error('offline'))
    await openBell()
    expect(document.body.textContent).not.toContain("You're all caught up")
    expect(document.body.textContent).toContain("Couldn't load notifications")
    api.getNotifications.mockResolvedValueOnce({ data: { results: [], has_next: false, count: 0 } })
    document.querySelector('.load-error__retry').click()
    await flushPromises()
    expect(api.getNotifications).toHaveBeenCalledTimes(2)
    expect(document.body.textContent).toContain("You're all caught up")
  })

  it('has no click-swallowing backdrop; an outside press closes the panel', async () => {
    api.getNotifications.mockResolvedValue({ data: { results: [], has_next: false, count: 0 } })
    await openBell()
    expect(document.querySelector('.nb-backdrop')).toBeNull()
    expect(document.querySelector('.nb-panel')).not.toBeNull()
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await flushPromises()
    expect(document.querySelector('.nb-panel')).toBeNull()
  })

  it('navigates before the mark-read PATCH answers', async () => {
    api.getNotifications.mockResolvedValue({ data: {
      results: [{ id: 7, title: 'Run done', is_read: false, metadata: { action_url: '/dashboard/runs/7' } }],
      has_next: false, count: 1, unread_count: 1,
    } })
    let resolvePatch
    api.markNotifRead.mockReturnValue(new Promise((r) => { resolvePatch = r }))
    await openBell()
    document.querySelector('.nb-item').click()
    // The PATCH is still pending, and the navigation already happened.
    expect(push).toHaveBeenCalledWith('/dashboard/runs/7')
    expect(api.markNotifRead).toHaveBeenCalledWith(7)
    resolvePatch({})
    await flushPromises()
  })

  it('cancels the idle start on unmount, so a removed bell never polls', async () => {
    const ric = vi.fn(() => 42)
    const cic = vi.fn()
    globalThis.requestIdleCallback = ric
    globalThis.cancelIdleCallback = cic
    try {
      wrapper = mount(NotificationBell, { global: { stubs: { Icon: true, Bell: true } } })
      expect(ric).toHaveBeenCalled()
      wrapper.unmount()
      wrapper = null
      expect(cic).toHaveBeenCalledWith(42)
      expect(api.getNotifUnreadCount).not.toHaveBeenCalled()
    } finally {
      delete globalThis.requestIdleCallback
      delete globalThis.cancelIdleCallback
    }
  })
})
