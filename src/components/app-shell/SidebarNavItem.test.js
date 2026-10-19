// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import SidebarNavItem from './SidebarNavItem.vue'

const Blank = { template: '<div />' }

async function mountAt(path, props) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/dashboard', component: Blank, children: [{ path: ':rest(.*)*', component: Blank }] }],
  })
  router.push(path)
  await router.isReady()
  return mount(SidebarNavItem, { props, global: { plugins: [router] } })
}

describe('SidebarNavItem', () => {
  it('renders a router link for a page of this app', async () => {
    const w = await mountAt('/dashboard/agents', { to: '/dashboard/agents', label: 'Agents' })
    expect(w.find('a').attributes('href')).toBe('/dashboard/agents')
    expect(w.find('a').classes()).toContain('active')
  })

  it('renders a plain link for a page this app does not render (Training Data)', async () => {
    const w = await mountAt('/dashboard', {
      to: '/dashboard/training-data/', label: 'Training Data', external: true,
    })
    const a = w.find('a')
    expect(a.attributes('href')).toBe('/dashboard/training-data/')
    expect(a.text()).toContain('Training Data')
    // A router-link would add its own active classes; a plain anchor never claims the current route.
    expect(a.classes()).not.toContain('router-link-active')
    expect(a.classes()).not.toContain('active')
  })
})
