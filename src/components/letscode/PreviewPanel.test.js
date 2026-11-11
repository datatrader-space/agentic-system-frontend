// @vitest-environment jsdom
// The IDE's Preview tab (ADM-1205 phase D): the project's running ports, and the app on one of them in the panel,
// each time through a fresh signed link from AADML (the person's own project only).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('@/services/api', () => ({ default: { getProjectPorts: vi.fn(), getProjectPreview: vi.fn() } }))

import api from '@/services/api'
import PreviewPanel from './PreviewPanel.vue'
import BottomPanel from './BottomPanel.vue'

const fail = (status, data) => Object.assign(new Error(String(status)), { response: { status, data } })
const SIGNED = 'https://5173-k3j9x2signedtoken.proxy.sandbox.aadml.com'
const PORTS = [
  { port: 3000, listening: true, started_by: 'agent', command: 'npm run dev -- -p 3000' },
  { port: 5173, listening: true, started_by: 'you', command: '' },
  { port: 8080, listening: false, started_by: 'agent', command: 'python -m http.server 8080' },
]

const mountPanel = async (props = {}) => {
  const w = mount(PreviewPanel, { props: { repoId: 14, ready: true, ...props }, global: { stubs: { Icon: true } } })
  await flushPromises()
  return w
}

beforeEach(() => {
  vi.clearAllMocks()
  api.getProjectPorts.mockResolvedValue({ data: { ports: PORTS } })
  api.getProjectPreview.mockResolvedValue({ data: { url: SIGNED, expires_in: 3600 } })
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('the running ports', () => {
  it('lists every port: running or stopped, and the Coding Agent\'s command', async () => {
    const w = await mountPanel()
    expect(api.getProjectPorts).toHaveBeenCalledWith(14)
    const rows = w.findAll('.pv-row')
    expect(rows.map((r) => r.find('.pv-num').text())).toEqual(['3000', '5173', '8080'])
    expect(rows[0].text()).toContain('npm run dev -- -p 3000')
    expect(rows[1].find('.pv-cmd').exists()).toBe(false)
    expect(rows[2].text()).toContain('Stopped: opening it starts it again')
  })

  it('none running says how to start one; nothing is asked before the project is ready', async () => {
    api.getProjectPorts.mockResolvedValue({ data: { ports: [] } })
    const w = await mountPanel()
    expect(w.find('.pv-empty').text()).toContain('No app is running')
    vi.clearAllMocks()
    const w2 = await mountPanel({ ready: false })
    expect(api.getProjectPorts).not.toHaveBeenCalled()
    expect(w2.find('.pv-empty').text()).toContain('once the project is ready')
  })

  it('a waking sandbox says so', async () => {
    api.getProjectPorts.mockRejectedValue(fail(503, { code: 'RUNNER_STARTING', retry_after_seconds: 20 }))
    const w = await mountPanel()
    expect(w.find('.pv-empty.err').text()).toContain('Waking')
  })
})

describe('an app in the panel', () => {
  it('opens a port in a sandboxed frame from a fresh link', async () => {
    const w = await mountPanel()
    await w.findAll('.pv-open')[1].trigger('click')
    await flushPromises()
    expect(api.getProjectPreview).toHaveBeenCalledWith(14, 5173)
    const frame = w.find('iframe.pv-frame')
    expect(frame.attributes('src')).toBe(SIGNED)
    expect(frame.attributes('sandbox')).toContain('allow-scripts')
    expect(frame.attributes('referrerpolicy')).toBe('no-referrer')
    expect(frame.attributes('title')).toBe('Preview of port 5173')
  })

  it('Reload asks for a new link; Open in a new tab is AADML\'s preview page, with no opener', async () => {
    const w = await mountPanel()
    await w.vm.openPort(5173)
    await flushPromises()
    await w.find('[aria-label="Reload the preview"]').trigger('click')
    await flushPromises()
    expect(api.getProjectPreview).toHaveBeenCalledTimes(2)
    const win = { opener: {} }
    const open = vi.spyOn(window, 'open').mockReturnValue(win)
    await w.find('[aria-label="Open the preview in a new tab"]').trigger('click')
    expect(open).toHaveBeenCalledWith('/preview/lets-code/14/5173', '_blank')
    expect(win.opener).toBe(null)
    open.mockReturnValue(null)
    await w.find('[aria-label="Open the preview in a new tab"]').trigger('click')
    expect(w.find('.pv-tabnote').text()).toContain('blocked the new tab')
  })

  it('waits while the app starts again, then shows it', async () => {
    vi.useFakeTimers()
    api.getProjectPreview
      .mockRejectedValueOnce(fail(503, { code: 'APP_STARTING', retry_after_seconds: 5 }))
      .mockResolvedValueOnce({ data: { url: SIGNED } })
    const w = await mountPanel()
    w.vm.openPort(8080)
    await flushPromises()
    expect(w.find('.pv-status').text()).toContain('Starting the app again')
    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()
    expect(w.find('iframe.pv-frame').exists()).toBe(true)
  })

  it('a port nothing listens on says why, and the ports are one click away', async () => {
    api.getProjectPreview.mockRejectedValue(fail(409, { error: 'Nothing is listening on port 4000 in this project.' }))
    const w = await mountPanel()
    await w.vm.openPort(4000)
    await flushPromises()
    expect(w.find('.pv-status.err').text()).toContain('Nothing is listening on port 4000')
    await w.find('.pv-actions .pv-btn:not(.primary)').trigger('click')
    await flushPromises()
    expect(w.findAll('.pv-row')).toHaveLength(3)
  })
})

describe('the bottom panel', () => {
  it('has a Preview tab, and the chat\'s Open preview lands on it at that port', async () => {
    const w = mount(BottomPanel, {
      props: { repoId: 14, ready: true },
      global: { stubs: { Icon: true, TerminalPanel: true } },
    })
    expect(w.findAll('.bp-tab').map((t) => t.text())).toEqual(['Log', 'Activity', 'Terminal', 'Preview'])
    await w.vm.openPreview(3000)
    await flushPromises()
    expect(w.find('.bp-tab.on').text()).toBe('Preview')
    expect(api.getProjectPreview).toHaveBeenCalledWith(14, 3000)
    expect(w.find('iframe.pv-frame').exists()).toBe(true)
  })

  it('a collapsed panel opens for it', async () => {
    const w = mount(BottomPanel, {
      props: { repoId: 14, ready: true, collapsed: true },
      global: { stubs: { Icon: true, TerminalPanel: true } },
    })
    await w.vm.openPreview(3000)
    expect(w.emitted('toggle')).toHaveLength(1)
  })
})
