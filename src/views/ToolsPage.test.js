// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

const api = vi.hoisted(() => ({
  getTools: vi.fn(), getMCPServers: vi.fn(), getToolDetail: vi.fn(), getToolAgents: vi.fn(),
}))
vi.mock('../services/api', () => ({ default: api }))
vi.mock('../composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../composables/useConfirm', () => ({ confirm: vi.fn() }))

import ToolsPage from './ToolsPage.vue'

// The table emits `select`; the drawer shows what it was given.
const TableStub = defineComponent({
  props: ['tools'], emits: ['select'],
  setup(props, { emit }) {
    return () => h('div', { class: 'tbl' }, (props.tools || []).map((t) =>
      h('button', { class: `pick-${t.name}`, onClick: () => emit('select', t) }, t.name)))
  },
})
const DrawerStub = defineComponent({
  props: ['detail'],
  setup(props) { return () => h('div', { class: 'drawer' }, props.detail?.description || '') },
})
const stubs = {
  ToolsTable: TableStub, CustomToolsTable: TableStub, McpServersTable: true, ToolDetailsDrawer: DrawerStub,
  ToolHelpSidebar: true, AddToolMenu: true, ToolsTabs: true, ChevronLeft: true, ChevronRight: true, Search: true,
  SlidersHorizontal: true,
}

let wrapper
beforeEach(() => {
  vi.clearAllMocks()
  api.getMCPServers.mockResolvedValue({ data: { servers: [] } })
})
afterEach(() => wrapper?.unmount())

describe('ToolsPage', () => {
  it('uses the shared, cached client call for the catalog', async () => {
    api.getTools.mockResolvedValue({ data: { tools: [] } })
    wrapper = mount(ToolsPage, { global: { stubs } })
    await flushPromises()
    expect(api.getTools).toHaveBeenCalledWith()     // no noCache option
  })

  it('shows an error with Retry when the catalog fails', async () => {
    api.getTools.mockRejectedValueOnce(new Error('500'))
    wrapper = mount(ToolsPage, { global: { stubs } })
    await flushPromises()
    expect(wrapper.text()).toContain("Couldn't load tools")
    expect(wrapper.find('.tbl').exists()).toBe(false)
    api.getTools.mockResolvedValueOnce({ data: { tools: [{ name: 'A', enabled: true }] } })
    await wrapper.find('.load-error__retry').trigger('click')
    await flushPromises()
    expect(wrapper.find('.pick-A').exists()).toBe(true)
  })

  it('a fast A → B click never shows A\'s detail under B', async () => {
    api.getTools.mockResolvedValue({ data: { tools: [{ name: 'A', enabled: true }, { name: 'B', enabled: true }] } })
    const detail = {}
    api.getToolDetail.mockImplementation((name) => new Promise((r) => { detail[name] = r }))
    api.getToolAgents.mockResolvedValue({ data: {} })
    wrapper = mount(ToolsPage, { global: { stubs } })
    await flushPromises()
    await wrapper.find('.pick-A').trigger('click')
    await wrapper.find('.pick-B').trigger('click')
    detail.B({ data: { description: 'detail of B' } })
    await flushPromises()
    detail.A({ data: { description: 'detail of A' } })
    await flushPromises()
    expect(wrapper.find('.drawer').text()).toBe('detail of B')
  })
})
