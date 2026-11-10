// @vitest-environment jsdom
// The Terminal tab of a Let's Code project (ADM-1196, Phase 3): the person's shells in the project's sandbox through
// AADML, and the Coding Agent's commands. xterm and the socket are stand-ins: what is checked is what this code does.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'

// Every terminal is unmounted when its test ends.
enableAutoUnmount(afterEach)

const terms = []
class FakeTerminal {
  constructor(opts) { this.opts = opts; this.options = {}; this.cols = 100; this.rows = 30; this.written = []; this.dataCb = null; terms.push(this) }
  loadAddon() {}
  open() {}
  write(d) { this.written.push(typeof d === 'string' ? d : new TextDecoder().decode(d)) }
  onData(cb) { this.dataCb = cb }
  onResize() {}
  focus() {}
  reset() { this.written = [] }
  dispose() { this.disposed = true }
}
// xterm comes through the app's own loader. Mocking the package's dynamic import sometimes gave the real xterm on the
// CI runner ("matchMedia is not a function", runs 42811128067 and 42815825100, 2026-11-10).
vi.mock('./loadXterm', () => ({
  loadXterm: async () => ({ Terminal: FakeTerminal, FitAddon: class { fit() {} }, WebLinksAddon: class {} }),
}))
vi.mock('@/composables/useTheme', async () => { const { ref } = await import('vue'); return { useTheme: () => ({ isDark: ref(false) }) } })

const sockets = []
vi.mock('@/utils/reconnectingSocket', () => ({
  reconnectingSocket: (handlers) => {
    const s = { handlers, url: null, sent: [], closed: 0,
      connect(target) { this.url = target(); this.closed = 0 },
      close() { this.closed += 1 },
      send(d) { this.sent.push(d); return true } }
    sockets.push(s)
    return s
  },
}))

globalThis.ResizeObserver = class { observe() {} disconnect() {} }

import ProjectTerminal from './ProjectTerminal.vue'
import TerminalPanel from './TerminalPanel.vue'
import BottomPanel from './BottomPanel.vue'

const status = (state, extra = {}) => ({ data: JSON.stringify({ type: 'status', state, ...extra }) })

beforeEach(() => { terms.length = 0; sockets.length = 0; localStorage.clear() })

describe('ProjectTerminal: the person\'s shell', () => {
  async function shell() {
    const w = mount(ProjectTerminal, { props: { mode: 'shell', repoId: 16, n: 2 }, global: { stubs: { Icon: true } } })
    await flushPromises()
    return { w, term: terms[terms.length - 1], sock: sockets[sockets.length - 1] }
  }

  it('connects to AADML for this project and terminal number, never to the sandbox', async () => {
    const { w, sock } = await shell()
    expect(sock.url).toMatch(/^wss?:\/\/[^/]+\/ws\/lets-code\/16\/terminal\/2\/$/)
    w.unmount()
  })

  it('what the person types goes as bytes, and the shell\'s output is written', async () => {
    const { w, term, sock } = await shell()
    sock.handlers.onMessage(status('connected'))
    await flushPromises()
    expect(w.find('.pt-overlay').exists()).toBe(false)
    term.dataCb('ls\r')
    expect(new TextDecoder().decode(sock.sent.find(d => typeof d !== 'string'))).toBe('ls\r')
    sock.handlers.onMessage({ data: new TextEncoder().encode('README.md\r\n').buffer })
    expect(term.written.join('')).toContain('README.md')
    w.unmount()
  })

  it('the size is sent when the shell connects', async () => {
    vi.useFakeTimers()
    try {
      const { w, sock } = await shell()
      sock.handlers.onOpen({})
      await vi.advanceTimersByTimeAsync(100)
      expect(sock.sent.map(d => (typeof d === 'string' ? JSON.parse(d) : null)).filter(Boolean))
        .toContainEqual({ type: 'resize', cols: 100, rows: 30 })
      w.unmount()
    } finally { vi.useRealTimers() }
  })

  it('a waking sandbox is said, an ended shell is said and not reopened by itself, and can be started again', async () => {
    const { w, sock } = await shell()
    sock.handlers.onMessage(status('starting'))
    await flushPromises()
    expect(w.find('.pt-overlay').text()).toContain('sandbox is starting')
    sock.handlers.onMessage(status('exited'))
    await flushPromises()
    expect(w.find('.pt-overlay').text()).toContain('The terminal ended.')
    expect(sock.closed).toBe(1)                                   // no reconnect loop into a new shell
    expect(w.emitted('ended')).toEqual([[2]])
    await w.find('.pt-btn').trigger('click')
    expect(sock.closed).toBe(0)                                   // connected again on the person's click
    w.unmount()
  })

  it('a refusal says so in words and is not retried', async () => {
    const { w, sock } = await shell()
    sock.handlers.onMessage(status('error', { error: "Only a Let's Code project has a terminal." }))
    await flushPromises()
    expect(w.find('[role="alert"]').text()).toContain("Only a Let's Code project has a terminal.")
    w.unmount()
    const again = await shell()
    again.sock.handlers.onClose({ code: 4429 })
    await flushPromises()
    expect(again.w.find('[role="alert"]').text()).toContain('Too many terminals')
    expect(again.sock.closed).toBe(1)
    again.w.unmount()
  })

  it('leaving the page closes the socket only: the shell keeps running and reattaches', async () => {
    const { w, sock, term } = await shell()
    w.unmount()
    expect(sock.closed).toBe(1)
    expect(sock.sent.some(d => typeof d === 'string' && d.includes('"close"'))).toBe(false)
    expect(term.disposed).toBe(true)
  })
})

describe('ProjectTerminal: the Coding Agent\'s commands', () => {
  it('each command shows with its output and how it ended, read-only, and never opens a socket', async () => {
    const entries = [{ command: 'npm test', output: 'ok\n2 passed', ok: true, exit_code: 0, elapsed_s: 3.1 }]
    const w = mount(ProjectTerminal, { props: { mode: 'agent', repoId: 16, entries }, global: { stubs: { Icon: true } } })
    await flushPromises()
    const term = terms[0]
    expect(term.opts.disableStdin).toBe(true)
    expect(sockets[0].url).toBe(null)
    const out = term.written.join('')
    expect(out).toContain('$ npm test')
    expect(out).toContain('2 passed')
    expect(out).toContain('[done, 3.1s]')
    await w.setProps({ entries: [...entries, { command: 'npm run build', output: 'Error', ok: false, exit_code: 1 }] })
    await flushPromises()
    expect(term.written.join('')).toContain('[failed (exit 1)]')
    expect(term.written.join('').match(/\$ npm test/g)).toHaveLength(1)    // written once
    w.unmount()
  })
})

describe('TerminalPanel', () => {
  it('opens Terminal 1 when the project is ready, adds up to three, and ends one with its close button', async () => {
    const w = mount(TerminalPanel, { props: { repoId: 16, ready: true }, global: { stubs: { Icon: true } } })
    await flushPromises()
    expect(w.text()).toContain('Terminal 1')
    await w.find('.tp-add').trigger('click')
    await w.find('.tp-add').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Terminal 3')
    expect(w.find('.tp-add').exists()).toBe(false)
    const shell2 = sockets.find(s => s.url && s.url.endsWith('/terminal/2/'))
    await w.find('[aria-label="End terminal 2"]').trigger('click')
    await flushPromises()
    expect(shell2.sent.map(d => (typeof d === 'string' ? JSON.parse(d) : null))).toContainEqual({ type: 'close' })
    expect(w.text()).not.toContain('Terminal 2')
    w.unmount()
  })

  // ADM-1200: a shell keeps running on the server; after a reload only Terminal 1 came back.
  // ADM-1200: a shell keeps running on the server; after a reload only Terminal 1 came back. The panel's part is
  // which shells it opens (each ProjectTerminal reattaches by its number, tested above), so they are stand-ins here.
  it('a reload reattaches every shell that was open, per project', async () => {
    const Stub = { name: 'ProjectTerminal', props: ['mode', 'repoId', 'n', 'active', 'entries'], template: '<div />', methods: { end() {} } }
    const opts = { global: { stubs: { Icon: true, ProjectTerminal: Stub } } }
    const shellsOf = (w) => w.findAllComponents(Stub).filter(c => c.props('mode') === 'shell').map(c => c.props('n')).sort()

    const first = mount(TerminalPanel, { props: { repoId: 16, ready: true }, ...opts })
    await flushPromises()
    await first.find('.tp-add').trigger('click')
    await first.find('.tp-add').trigger('click')
    await first.find('[aria-label="End terminal 1"]').trigger('click')
    await flushPromises()
    expect(shellsOf(first)).toEqual([2, 3])
    first.unmount()

    const again = mount(TerminalPanel, { props: { repoId: 16, ready: true }, ...opts })
    await flushPromises()
    expect(shellsOf(again)).toEqual([2, 3])
    expect(again.text()).not.toContain('Terminal 1')
    again.unmount()

    const other = mount(TerminalPanel, { props: { repoId: 17, ready: true }, ...opts })
    await flushPromises()
    expect(shellsOf(other)).toEqual([1])                          // another project: its own terminals
    other.unmount()
  })

  it('a broken or blocked store still opens Terminal 1', async () => {
    localStorage.setItem('lets-code:terminals:16', 'not json')
    const Stub = { name: 'ProjectTerminal', props: ['mode', 'repoId', 'n', 'active', 'entries'], template: '<div />' }
    const w = mount(TerminalPanel, { props: { repoId: 16, ready: true }, global: { stubs: { Icon: true, ProjectTerminal: Stub } } })
    await flushPromises()
    expect(w.findAllComponents(Stub).filter(c => c.props('mode') === 'shell').map(c => c.props('n'))).toEqual([1])
    w.unmount()
  })

  it('a project that is not ready opens no shell', async () => {
    const w = mount(TerminalPanel, { props: { repoId: 16, ready: false }, global: { stubs: { Icon: true } } })
    await flushPromises()
    expect(sockets.filter(s => s.url)).toHaveLength(0)
    expect(w.text()).toContain('opens when the project is ready')
    w.unmount()
  })
})

describe('BottomPanel: the Terminal tab', () => {
  it('sits beside Log and Activity, is built on first open and kept when switching back', async () => {
    const w = mount(BottomPanel, { props: { repoId: 16, ready: true }, global: { stubs: { Icon: true, TerminalPanel: { template: '<div class="tp-stub" />' } } } })
    expect(w.findAll('.bp-tab').map(t => t.text())).toEqual(['Log', 'Activity', 'Terminal'])
    expect(w.find('.tp-stub').exists()).toBe(false)
    await w.findAll('.bp-tab')[2].trigger('click')
    expect(w.find('.tp-stub').exists()).toBe(true)
    await w.findAll('.bp-tab')[0].trigger('click')
    expect(w.find('.tp-stub').exists()).toBe(true)                         // still mounted: shells keep running
    w.unmount()
  })

  it('without a project there is no Terminal tab', () => {
    const w = mount(BottomPanel, { props: {}, global: { stubs: { Icon: true } } })
    expect(w.findAll('.bp-tab').map(t => t.text())).toEqual(['Log', 'Activity'])
    w.unmount()
  })
})
