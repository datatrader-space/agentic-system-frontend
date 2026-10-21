// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import SidebarProfileMenu from './SidebarProfileMenu.vue'

let wrapper
const menu = () => document.querySelector('[role="menu"]')
const item = (label) => [...document.querySelectorAll('[role="menuitem"]')].find(button => button.textContent.trim() === label)
function render(props = {}) {
  wrapper = mount(SidebarProfileMenu, { attachTo: document.body, props: { email: 'reviewer@example.test', name: 'Reviewer', initials: 'R', ...props } })
  return wrapper
}
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = ''; vi.unstubAllGlobals() })

describe('sidebar profile menu', () => {
  it('shows the account email and opens without making API calls or logging out', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const w = render()
    expect(w.text()).toContain('reviewer@example.test')
    await w.get('button').trigger('click')
    expect(menu().textContent).toContain('reviewer@example.test')
    expect(item('Log out')).toBeTruthy()
    expect(fetch).not.toHaveBeenCalled()
    expect(w.emitted('logout')).toBeUndefined()
  })

  it('requests sign-out only when Log out is selected, then closes', async () => {
    const w = render()
    await w.get('button').trigger('click')
    item('Log out').click()
    await nextTick()
    expect(w.emitted('logout')).toHaveLength(1)
    expect(menu()).toBeNull()
  })

  it('supports Escape, keyboard navigation and outside dismissal in collapsed mode', async () => {
    const w = render({ collapsed: true })
    const trigger = w.get('button')
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(item('Settings'))
    item('Settings').dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    expect(document.activeElement).toBe(item('Log out'))
    item('Log out').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(menu()).toBeNull()
    expect(document.activeElement).toBe(trigger.element)
    await trigger.trigger('click')
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await nextTick()
    expect(menu()).toBeNull()
  })
})

describe('profile account and help destinations', () => {
  it('has five primary actions and keeps learning and tour links under Help', async () => {
    const w = render()
    await w.get('button').trigger('click')
    expect(document.querySelectorAll('[role="menuitem"]')).toHaveLength(5)
    item('Help & support').click()
    await nextTick()
    expect(item('Documentation')).toBeTruthy()
    expect(item('Getting started')).toBeTruthy()
    expect(item('Contact support')).toBeTruthy()
    item('Replay product tour').click()
    await nextTick()
    expect(w.emitted('tour')).toHaveLength(1)
    expect(menu()).toBeNull()
  })
})
