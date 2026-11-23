// @vitest-environment jsdom
// The IDE's Preview tab (ADM-1205 phase D): the project's running ports, and the app on one of them in the panel,
// each time through a fresh signed link from AADML (the person's own project only).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('@/services/api', () => ({ default: { getProjectPorts: vi.fn(), getProjectPreview: vi.fn(), locatePreviewElement: vi.fn() } }))

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
  api.locatePreviewElement.mockResolvedValue({ data: { locations: [], searched: [], reason: 'No file matched.' } })
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
    expect(api.getProjectPreview).toHaveBeenCalledWith(14, 5173, { inspect: true })
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
    expect(api.getProjectPreview).toHaveBeenCalledWith(14, 3000, { inspect: true })
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

  it("passes the Preview tab's Ask the agent on (ADM-1318)", async () => {
    const w = mount(BottomPanel, {
      props: { repoId: 14, ready: true },
      global: { stubs: { Icon: true, TerminalPanel: true } },
    })
    await w.vm.openPreview(3000)
    await flushPromises()
    const ask = { text: 'About this element', files: [], done: () => {} }
    w.findComponent(PreviewPanel).vm.$emit('ask-agent', ask)
    expect(w.emitted('ask-agent')).toEqual([[ask]])
    const loc = { path: 'index.html', line: 5, column: 7 }
    w.findComponent(PreviewPanel).vm.$emit('open-file', loc)
    expect(w.emitted('open-file')).toEqual([[loc]])
  })
})

// ── the preview inspector (ADM-1318): console, network, devices, select and one message to the agent ──────────────
const INSPECTED = 'https://47100-k3j9x2signedtoken.proxy.sandbox.aadml.com'
const ORIGIN = new URL(INSPECTED).origin
const ELEMENT = {
  tag: 'button', id: 'buy', classes: ['btn'], text: 'Buy now', html: '<button id="buy" class="btn">', selector: 'main > button#buy',
  box: { x: 10, y: 20, width: 120, height: 40 }, source: { file: 'src/Buy.vue', line: 12, column: 5, framework: 'Vue' },
  editable: true, page: '/shop',
}

describe('the preview tools', () => {
  let w
  const frameWin = () => w.find('iframe.pv-frame').element.contentWindow
  const say = async (data, over = {}) => {
    window.dispatchEvent(new MessageEvent('message', {
      data: { source: 'aadml-preview', v: 1, ...data }, origin: ORIGIN, source: frameWin(), ...over,
    }))
    await flushPromises()
  }
  const openInspected = async () => {
    api.getProjectPreview.mockResolvedValue({ data: { url: INSPECTED, expires_in: 3600, inspector: true } })
    w = mount(PreviewPanel, { props: { repoId: 14, ready: true }, global: { stubs: { Icon: true } }, attachTo: document.body })
    await flushPromises()
    await w.vm.openPort(5173)
    await flushPromises()
  }
  afterEach(() => { w?.unmount(); w = null })

  it("asks for the inspector, for this page's origin", async () => {
    await openInspected()
    expect(api.getProjectPreview).toHaveBeenCalledWith(14, 5173, { inspect: true })
    expect(w.find('iframe.pv-frame').attributes('src')).toBe(INSPECTED)
    expect(w.find('[aria-label="Select an element to edit"]').exists()).toBe(true)
  })

  it('shows console and network entries from the frame only, as text', async () => {
    await openInspected()
    await w.find('[aria-label="Show the console and network"]').trigger('click')
    await say({ kind: 'console', level: 'error', text: '<img src=x onerror="alert(1)">', at: 1 })
    await say({ kind: 'console', level: 'log', text: 'from elsewhere', at: 2 }, { origin: 'https://evil.test' })
    await say({ kind: 'console', level: 'log', text: 'from the editor itself', at: 3 }, { source: window })
    await say({ kind: 'console', level: 'nope', text: 'bad shape', at: 4 })
    const rows = w.findAll('.pd-row .c-text').map((r) => r.text())
    expect(rows).toContain('<img src=x onerror="alert(1)">')
    expect(rows.join(' ')).not.toMatch(/from elsewhere|from the editor itself|bad shape/)
    expect(w.find('.pd img').exists()).toBe(false)
    expect(w.find('.pv-badge').text()).toBe('1')
    await w.findAll('.pd-tab')[1].trigger('click')
    await say({ kind: 'network', method: 'POST', url: '/api/cart', status: 500, ms: 31, size: 120, type: 'fetch', at: 5 })
    const net = w.find('.pd-row.net')
    expect(net.text()).toContain('POST')
    expect(net.text()).toContain('/api/cart')
    expect(net.classes()).toContain('bad')
    await w.find('[aria-label="Clear the requests"]').trigger('click')
    expect(w.find('.pd-row.net').exists()).toBe(false)
  })

  it('keeps every entry and draws only the rows in view', async () => {
    await openInspected()
    await w.find('[aria-label="Show the console and network"]').trigger('click')
    for (let i = 0; i < 3000; i++) {
      window.dispatchEvent(new MessageEvent('message', {
        data: { source: 'aadml-preview', v: 1, kind: 'console', level: 'log', text: `line ${i}`, at: i }, origin: ORIGIN, source: frameWin(),
      }))
    }
    await flushPromises()
    const list = w.find('.pd-rows')
    expect(list.attributes('style')).toContain(`height: ${3001 * 24}px`)     // 3000 lines and the "Opened port" mark
    expect(w.findAll('.pd-row-li').length).toBeLessThan(200)
    expect(w.find('.pd-row-li').attributes('aria-setsize')).toBe('3001')
  })

  it('device sizes resize the frame; rotation swaps them; Responsive fills the panel', async () => {
    await openInspected()
    await w.find('select[name="preview-device"]').setValue('iphone-se')
    const style = () => w.find('iframe.pv-frame').attributes('style') || ''
    expect(style()).toContain('width: 375px')
    expect(style()).toContain('height: 667px')
    await w.find('[aria-label="Rotate the device"]').trigger('click')
    expect(style()).toContain('width: 667px')
    expect(style()).toContain('height: 375px')
    await w.find('select[name="preview-device"]').setValue('responsive')
    expect(style()).toBe('')
  })

  it('select mode, then Ask the agent sends ONE message with the element and the picture', async () => {
    await openInspected()
    const posted = vi.spyOn(frameWin(), 'postMessage')
    await w.find('[aria-label="Select an element to edit"]').trigger('click')
    expect(posted).toHaveBeenLastCalledWith({ source: 'aadml-editor', v: 1, kind: 'select-mode', on: true }, ORIGIN)
    await say({ kind: 'select', element: ELEMENT })
    expect(w.find('.pe-tag').text()).toBe('button#buy.btn')
    expect(w.find('.pe-src').text()).toBe('src/Buy.vue:12:5')
    await w.find('.pe-ask textarea').setValue('Make it green')
    await w.find('.pe-btn.primary').trigger('click')
    const shot = posted.mock.calls.at(-1)
    expect(shot[0]).toMatchObject({ source: 'aadml-editor', v: 1, kind: 'screenshot' })
    expect(shot[1]).toBe(ORIGIN)
    await say({ kind: 'screenshot', requestId: shot[0].requestId, dataUrl: 'data:image/png;base64,aGk=' })
    const asks = w.emitted('ask-agent')
    expect(asks).toHaveLength(1)
    const { text, files, done } = asks[0][0]
    expect(text).toContain('CSS selector: main > button#buy')
    expect(text).toContain('Source: src/Buy.vue:12:5')
    expect(text.endsWith('Make it green')).toBe(true)
    expect(files.map((f) => [f.name, f.type])).toEqual([['preview-port-5173.png', 'image/png']])
    done(true)
    await flushPromises()
    expect(w.find('.pe-note').text()).toContain('Sent to the Coding Agent')
  })

  it('a picture the page could not take is said in the message, which still goes once', async () => {
    await openInspected()
    const posted = vi.spyOn(frameWin(), 'postMessage')
    await say({ kind: 'select', element: { ...ELEMENT, source: null } })
    await w.find('.pe-btn.primary').trigger('click')
    const { requestId } = posted.mock.calls.at(-1)[0]
    await say({ kind: 'screenshot', requestId, error: 'the page did not let the screenshot library load' })
    const [[{ text, files, done }]] = w.emitted('ask-agent')
    expect(files).toEqual([])
    expect(text).toContain('Screenshot: not attached, because the page did not let the screenshot library load')
    done(false)
    await flushPromises()
    expect(w.find('.pe-note.err').text()).toContain('did not take the message')
  })

  it('Edit text changes the preview only and the change goes into the message', async () => {
    await openInspected()
    const posted = vi.spyOn(frameWin(), 'postMessage')
    await say({ kind: 'select', element: ELEMENT })
    await w.findAll('.pe-btn')[1].trigger('click')
    expect(posted).toHaveBeenLastCalledWith({ source: 'aadml-editor', v: 1, kind: 'edit-text' }, ORIGIN)
    await say({ kind: 'text-edit', ok: true })
    await say({ kind: 'text-edited', before: 'Buy now', after: 'Buy today' })
    expect(w.find('.pe-edit').text()).toContain('“Buy now” → “Buy today”')
  })

  // ADM-1318 follow-up (live check 2026-11-20): a page that does not say where an element comes from (plain HTML, React 19)
  it('an element with no source is looked for in the files; the card shows the places and the message carries them', async () => {
    const found = [
      { path: 'index.html', line: 5, column: 7, why: 'This line has id="hero" and the text "Welcome".' },
      { path: 'about.html', line: 3, column: 3, why: 'This line has the text "Welcome".' },
    ]
    api.locatePreviewElement.mockResolvedValue({ data: { searched: ['id="hero"'], locations: found } })
    await openInspected()
    const posted = vi.spyOn(frameWin(), 'postMessage')
    const plain = { ...ELEMENT, tag: 'h1', id: 'hero', classes: ['title'], text: 'Welcome', html: '<h1 id="hero" class="title">', source: null, page: '/' }
    await say({ kind: 'select', element: plain })
    expect(api.locatePreviewElement).toHaveBeenCalledWith(14, { tag: 'h1', id: 'hero', classes: ['title'], text: 'Welcome',
      html: '<h1 id="hero" class="title">', page: '/' })
    const best = w.find('.pe-loc.best')
    expect(best.text()).toBe('index.html:5')
    expect(w.find('.pe-why').text()).toContain('id="hero"')
    expect(w.find('.pe-more summary').text()).toBe('1 other place matches')
    await best.trigger('click')
    expect(w.emitted('open-file')).toEqual([[found[0]]])
    await w.find('.pe-btn.primary').trigger('click')
    const { requestId } = posted.mock.calls.at(-1)[0]
    await say({ kind: 'screenshot', requestId, dataUrl: 'data:image/png;base64,aGk=' })
    const [[{ text }]] = w.emitted('ask-agent')
    expect(text).toContain("- Source: index.html:5, found in the project's files")
    expect(text).toContain('Make the change in that file, at that line.')
    expect(text).toContain('  - about.html:3: This line has the text "Welcome".')
  })

  it("a framework's own location is preferred: nothing is looked for", async () => {
    await openInspected()
    await say({ kind: 'select', element: ELEMENT })
    expect(api.locatePreviewElement).not.toHaveBeenCalled()
    expect(w.find('.pe-src').text()).toBe('src/Buy.vue:12:5')
    expect(w.find('.pe-loc').exists()).toBe(false)
  })

  it('no place found says why, in the card and in the message', async () => {
    api.locatePreviewElement.mockResolvedValue({ data: { locations: [], searched: [], reason: 'No file in the project has this element.' } })
    await openInspected()
    const posted = vi.spyOn(frameWin(), 'postMessage')
    await say({ kind: 'select', element: { ...ELEMENT, source: null } })
    expect(w.find('.pe-none').text()).toBe('No file in the project has this element.')
    await w.find('.pe-btn.primary').trigger('click')
    await say({ kind: 'screenshot', requestId: posted.mock.calls.at(-1)[0].requestId, error: 'x' })
    const [[{ text }]] = w.emitted('ask-agent')
    expect(text).toContain("Looked for in the project's files: No file in the project has this element.")
  })

  it('the page keeps its share when the tools open: a split with a divider, never 0 px', async () => {
    await openInspected()
    await w.find('[aria-label="Show the console and network"]').trigger('click')
    const work = w.find('.pv-work')
    expect(work.classes()).toContain('split')
    expect(work.attributes('style')).toContain('--pv-stage: 60%')
    expect(work.attributes('style')).toContain('--pv-stage-min: 55%')
    expect(w.find('.pv-below .pv-devtools').exists()).toBe(true)
    const divider = w.find('.pv-split[role="separator"]')
    expect(divider.attributes('aria-valuenow')).toBe('60')
    await divider.trigger('keydown', { key: 'ArrowDown' })
    expect(divider.attributes('aria-valuenow')).toBe('65')
    await divider.trigger('keydown', { key: 'ArrowUp', shiftKey: true })
    expect(divider.attributes('aria-valuenow')).toBe('55')
    await divider.trigger('keydown', { key: 'ArrowUp' })
    expect(divider.attributes('aria-valuenow')).toBe('55')        // never below the page's minimum share
    await divider.trigger('keydown', { key: 'End' })
    expect(work.attributes('style')).toContain('--pv-stage: 85%')
    // The element card alone: no split, the page keeps at least its minimum share and the card scrolls.
    await w.find('[aria-label="Hide the console and network"]').trigger('click')
    await say({ kind: 'select', element: ELEMENT })
    expect(w.find('.pv-work').classes()).toContain('below')
    expect(w.find('.pv-split').exists()).toBe(false)
    expect(w.find('.pv-below .pe').exists()).toBe(true)
  })

  it('a panel too short for the page and the tools is maximized when the tools open', async () => {
    await openInspected()
    const height = (v) => Object.defineProperty(w.find('.pv-work').element, 'clientHeight', { configurable: true, value: v })
    height(177)
    await w.find('[aria-label="Show the console and network"]').trigger('click')
    expect(w.emitted('maximize')).toHaveLength(1)
    await w.find('[aria-label="Hide the console and network"]').trigger('click')
    await w.setProps({ maximized: true })
    await w.find('[aria-label="Show the console and network"]').trigger('click')
    expect(w.emitted('maximize')).toHaveLength(1)                  // already maximized: left as it is
    await w.find('[aria-label="Hide the console and network"]').trigger('click')
    await w.setProps({ maximized: false })
    height(400)
    await w.find('[aria-label="Show the console and network"]').trigger('click')
    expect(w.emitted('maximize')).toHaveLength(1)                  // room for both: not maximized
  })

  it('when the tools cannot run it says why, and the plain preview is one click away', async () => {
    api.getProjectPreview.mockRejectedValueOnce(fail(409, { error: 'The preview inspector did not start: boom', code: 'INSPECTOR_UNAVAILABLE' }))
    w = mount(PreviewPanel, { props: { repoId: 14, ready: true }, global: { stubs: { Icon: true } } })
    await flushPromises()
    await w.vm.openPort(5173)
    await flushPromises()
    expect(w.find('.pv-status.err').text()).toContain('did not start: boom')
    api.getProjectPreview.mockResolvedValueOnce({ data: { url: SIGNED, expires_in: 3600, inspector: false } })
    await w.findAll('.pv-actions .pv-btn').find((b) => b.text() === 'Open without the tools').trigger('click')
    await flushPromises()
    expect(api.getProjectPreview).toHaveBeenLastCalledWith(14, 5173)
    expect(w.find('iframe.pv-frame').attributes('src')).toBe(SIGNED)
    expect(w.find('[aria-label="Select an element to edit"]').exists()).toBe(false)
  })
})
