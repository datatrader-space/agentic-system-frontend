// @vitest-environment jsdom
// Help Center CMS tabs are kept alive: going back to a tab does not build it (and read its data) again.
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, onMounted } from 'vue'

const mounts = vi.hoisted(() => ({ content: 0, tours: 0, api: 0 }))
const tab = (key) => defineComponent({ setup() { onMounted(() => { mounts[key] += 1 }); return () => h('p', { class: `tab-${key}` }, key) } })
vi.mock('./AdminHelpContent.vue', () => ({ __esModule: true, default: tab('content') }))
vi.mock('./AdminGuidedTours.vue', () => ({ __esModule: true, default: tab('tours') }))
vi.mock('./AdminApiReference.vue', () => ({ __esModule: true, default: tab('api') }))
const route = vi.hoisted(() => ({ query: {} }))
vi.mock('vue-router', () => ({ useRoute: () => route, useRouter: () => ({ replace: vi.fn() }) }))

import AdminHelpCms from './AdminHelpCms.vue'

const settle = async () => { for (let i = 0; i < 5; i++) { await flushPromises(); await new Promise((r) => setTimeout(r, 0)) } }

describe('AdminHelpCms tabs', () => {
  it('mounts each tab once, however often the admin switches between them', async () => {
    const w = mount(AdminHelpCms, { global: { stubs: { Icon: true } } })
    await settle()
    const buttons = () => w.findAll('.cms-tabs button')
    for (const i of [1, 0, 1, 2, 0, 2]) { await buttons()[i].trigger('click'); await settle() }
    expect(mounts).toEqual({ content: 1, tours: 1, api: 1 })
    expect(w.find('.tab-api').exists()).toBe(true)
    expect(w.find('.tab-content').exists()).toBe(false)     // a kept tab is not shown
    w.unmount()
  })
})
