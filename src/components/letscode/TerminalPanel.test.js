// @vitest-environment jsdom
// The Terminal tab of a Let's Code project (ADM-1196, Phase 3): the person's shells in the project's sandbox through
// AADML, and the Coding Agent's commands. xterm and the socket are stand-ins: what is checked is what this code does.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'

// Every terminal is unmounted when its test ends.
enableAutoUnmount(afterEach)

const terms = []
const searches = []
class FakeSearch {
  constructor(opts) { this.opts = opts; this.calls = []; this.cb = null; searches.push(this) }
  findNext(t, o) { this.calls.push(['next', t, o]); return true }
  findPrevious(t, o) { this.calls.push(['prev', t, o]); return true }
  clearDecorations() { this.calls.push(['clear']) }
  onDidChangeResults(cb) { this.cb = cb }
}
class FakeTerminal {
  constructor(opts) {
    this.opts = opts; this.options = {}; this.cols = 100; this.rows = 30; this.written = []; this.dataCb = null
    this.osc = {}; this.keyHandler = null; this.selection = ''; this.pasted = []; this.cleared = 0; this.addons = []
    this.parser = { registerOscHandler: (id, cb) => { this.osc[id] = cb } }
    terms.push(this)
  }
  loadAddon(a) { this.addons.push(a) }
  attachCustomKeyEventHandler(cb) { this.keyHandler = cb }
  hasSelection() { return !!this.selection }
  getSelection() { return this.selection }
  clearSelection() { this.selection = '' }
  selectAll() { this.selection = 'ALL' }
  clear() { this.cleared += 1 }
  paste(t) { this.pasted.push(t) }
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
  loadXterm: async () => ({ Terminal: FakeTerminal, FitAddon: class { fit() {} }, WebLinksAddon: class {}, SearchAddon: FakeSearch }),
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
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))

import { notify } from '@/composables/useNotify'
import panelSource from './TerminalPanel.vue?raw'
import { terminalShortcut } from './terminalKeys'
import ProjectTerminal from './ProjectTerminal.vue'
import TerminalPanel from './TerminalPanel.vue'
import BottomPanel from './BottomPanel.vue'

const status = (state, extra = {}) => ({ data: JSON.stringify({ type: 'status', state, ...extra }) })

beforeEach(() => { terms.length = 0; searches.length = 0; sockets.length = 0; localStorage.clear() })

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
  it('opens a bash terminal when the project is ready, adds up to the server\'s limit, and ends one with its close button', async () => {
    const w = mount(TerminalPanel, { props: { repoId: 16, ready: true }, global: { stubs: { Icon: true } } })
    await flushPromises()
    expect(w.findAll('.tp-name').map(n => n.text())).toEqual(['bash'])
    sockets.find(s => s.url && s.url.includes('/terminal/1/')).handlers.onMessage(status('connected', { max_terminals: 3 }))
    await w.find('.tp-add').trigger('click')
    await w.find('.tp-add').trigger('click')
    await flushPromises()
    expect(w.findAll('.tp-name').map(n => n.text())).toEqual(['bash (1)', 'bash (2)', 'bash (3)'])
    expect(w.find('.tp-add').exists()).toBe(false)
    const shell2 = sockets.find(s => s.url && s.url.endsWith('/terminal/2/?shell=bash&new=1'))
    await w.find('[aria-label="End bash (2)"]').trigger('click')
    await flushPromises()
    expect(shell2.sent.map(d => (typeof d === 'string' ? JSON.parse(d) : null))).toContainEqual({ type: 'close' })
    expect(w.findAll('.tp-name').map(n => n.text())).toEqual(['bash (1)', 'bash (2)'])
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
    await first.findAll('.tp-x')[0].trigger('click')
    await flushPromises()
    expect(shellsOf(first)).toEqual([2, 3])
    first.unmount()

    const again = mount(TerminalPanel, { props: { repoId: 16, ready: true }, ...opts })
    await flushPromises()
    expect(shellsOf(again)).toEqual([2, 3])
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
    expect(w.findAll('.bp-tab').map(t => t.text())).toEqual(['Log', 'Activity', 'Terminal', 'Preview'])   // Preview: ADM-1205 phase D
    expect(w.find('.tp-stub').exists()).toBe(false)
    await w.findAll('.bp-tab')[2].trigger('click')
    expect(w.find('.tp-stub').exists()).toBe(true)
    await w.findAll('.bp-tab')[0].trigger('click')
    expect(w.find('.tp-stub').exists()).toBe(true)                         // still mounted: shells keep running
    w.unmount()
  })

  it('without a project there is no Terminal or Preview tab', () => {
    const w = mount(BottomPanel, { props: {}, global: { stubs: { Icon: true } } })
    expect(w.findAll('.bp-tab').map(t => t.text())).toEqual(['Log', 'Activity'])
    w.unmount()
  })
})

// ── ADM-1325: the limit from the server, split panes, Ctrl+` and Ctrl+Shift+` ───────────────────────────────────
const panelOf = async (props = {}) => {
  const w = mount(TerminalPanel, { attachTo: document.body, props: { repoId: 16, ready: true, ...props }, global: { stubs: { Icon: true } } })
  await flushPromises()
  return w
}
const sockOf = (n) => sockets.find(s => s.url && s.url.includes(`/terminal/${n}/`))
// A shell's pane in the page (ProjectTerminal's .pt, found by its terminal's label), and the shells shown.
const paneEl = (w, n) => w.find(`.pt-host[aria-label="Terminal ${n}"]`).element.parentElement
const shown = (w) => w.findAll('.tp-body > .pt').filter(p => p.element.style.display !== 'none')
  .map(p => Number((p.find('.pt-host').attributes('aria-label') || '').replace('Terminal ', ''))).filter(Boolean)
const paneOf = (w, n) => w.findAllComponents(ProjectTerminal).find(c => c.props('mode') === 'shell' && c.props('n') === n)
const splitBtn = (w) => w.find('.tp-split')
const LIMIT_TEXT = 'A project can have at most 10 terminals open at once. End one to open another.'

describe('ADM-1325: how many terminals', () => {
  it('the panel keeps no limit of its own: it learns it from the server, then stops at it and says why', async () => {
    notify.info.mockClear()
    const w = await panelOf()
    for (let i = 0; i < 4; i++) await w.find('.tp-add').trigger('click')            // more than the old three
    await flushPromises()
    expect(w.findAll('.tp-name')).toHaveLength(5)
    sockOf(1).handlers.onMessage(status('starting', { max_terminals: 10 }))
    for (let i = 0; i < 5; i++) await w.find('.tp-add').trigger('click')
    await flushPromises()
    expect(w.findAll('.tp-name')).toHaveLength(10)
    expect(sockOf(10).url).toContain('/terminal/10/?shell=bash&new=1')
    expect(w.find('.tp-add').exists()).toBe(false)
    expect(splitBtn(w).attributes('disabled')).toBeDefined()
    expect(splitBtn(w).attributes('title')).toBe(LIMIT_TEXT)
    expect(w.vm.addShell()).toBe(null)                                              // Ctrl+Shift+` at the limit
    expect(notify.info).toHaveBeenCalledWith(LIMIT_TEXT)
    await w.find('[aria-label="End bash (4)"]').trigger('click')
    await flushPromises()
    expect(w.find('.tp-add').exists()).toBe(true)
  })

  it('a terminal reports the limit from any status, and the server\'s refusal of the eleventh is shown in its words', async () => {
    const w = mount(ProjectTerminal, { props: { mode: 'shell', repoId: 16, n: 11 }, global: { stubs: { Icon: true } } })
    await flushPromises()
    const sock = sockets[sockets.length - 1]
    sock.handlers.onMessage(status('error', { max_terminals: 10, error: LIMIT_TEXT }))
    sock.handlers.onClose({ code: 4400 })
    await flushPromises()
    expect(w.emitted('limit')).toEqual([[10]])
    expect(w.find('[role="alert"]').text()).toContain('at most 10 terminals')
    expect(sock.closed).toBe(1)                                                    // not retried
    sock.handlers.onMessage(status('connected', { max_terminals: 'ten' }))         // only a whole number counts
    expect(w.emitted('limit')).toEqual([[10]])
  })

  it('a list kept with numbers above three reopens all of them', async () => {
    localStorage.setItem('lets-code:terminals:16', JSON.stringify([{ n: 7, shell: 'zsh' }, { n: 4, shell: 'bash' }, { n: 0 }, { n: 'x' }]))
    const w = await panelOf()
    expect(w.findAllComponents(ProjectTerminal).filter(c => c.props('mode') === 'shell').map(c => c.props('n'))).toEqual([4, 7])
  })
})

describe('ADM-1325: split', () => {
  it('Split opens a new shell beside this one; both are shown, each keeps its own shell; Unsplit keeps both running', async () => {
    const w = await panelOf()
    expect(splitBtn(w).attributes('aria-label')).toBe('Split the terminal')
    await splitBtn(w).trigger('click')
    await flushPromises()
    expect(sockOf(2).url).toContain('/terminal/2/?shell=bash&new=1')
    expect(shown(w)).toEqual([1, 2])
    expect(w.find('.tp-body').classes()).toContain('split')
    expect([...paneEl(w, 1).classList]).toContain('pane-a')
    expect([...paneEl(w, 2).classList]).toEqual(expect.arrayContaining(['pane-b', 'cur']))
    expect(splitBtn(w).attributes('aria-pressed')).toBe('true')
    expect(splitBtn(w).attributes('aria-label')).toBe('Unsplit the terminal')
    expect(w.findAll('.tp-tab[title]')[0].attributes('title')).toContain('side by side with bash (2)')
    // Typing in the left pane makes it the one the toolbar acts on.
    paneEl(w, 1).dispatchEvent(new Event('focusin', { bubbles: true }))
    await flushPromises()
    expect([...paneEl(w, 1).classList]).toContain('cur')
    expect(paneOf(w, 2).props('active')).toBe(false)
    // The Coding Agent's tab shows alone; a paired tab brings the pair back.
    await w.findAll('.tp-tab')[0].trigger('click')
    expect(shown(w)).toEqual([])
    await w.findAll('.tp-tab')[2].trigger('click')
    expect(shown(w)).toEqual([1, 2])
    // Unsplit: both shells keep running, each in its own tab.
    await splitBtn(w).trigger('click')
    await flushPromises()
    expect(w.find('.tp-body').classes()).not.toContain('split')
    expect(shown(w)).toEqual([2])
    expect(w.findAll('.tp-name')).toHaveLength(2)
    expect([sockOf(1), sockOf(2)].some(s => s.sent.some(d => typeof d === 'string' && d.includes('"close"')))).toBe(false)
  })

  it('a split starts the same shell as the one it is beside, and is never offered on the Coding Agent\'s tab', async () => {
    localStorage.setItem('lets-code:terminals:16', JSON.stringify([{ n: 1, shell: 'zsh' }]))
    const w = await panelOf()
    await splitBtn(w).trigger('click')
    await flushPromises()
    expect(sockOf(2).url).toContain('shell=zsh&new=1')
    await w.findAll('.tp-tab')[0].trigger('click')
    expect(splitBtn(w).attributes('disabled')).toBeDefined()
    expect(splitBtn(w).attributes('title')).toBe('Choose a terminal to split it')
  })

  it('ending one of the pair unsplits; the other keeps running and is shown', async () => {
    const w = await panelOf()
    await splitBtn(w).trigger('click')
    await flushPromises()
    await w.find('[aria-label="End bash (2)"]').trigger('click')
    await flushPromises()
    expect(w.find('.tp-body').classes()).not.toContain('split')
    expect(shown(w)).toEqual([1])
    expect(w.findAll('.tp-name').map(n => n.text())).toEqual(['bash'])
  })

  it('a reload brings the split back, per project', async () => {
    const first = await panelOf()
    await splitBtn(first).trigger('click')
    await flushPromises()
    first.unmount()
    const again = await panelOf()
    await again.findAll('.tp-tab')[1].trigger('click')
    expect(shown(again)).toEqual([1, 2])
    again.unmount()
    const other = await panelOf({ repoId: 17 })
    expect(other.find('.tp-body').classes()).not.toContain('split')
  })

  it('at 640 px and less a split shows one shell at a time, full width (no sideways scroll)', () => {
    const narrow = panelSource.slice(panelSource.lastIndexOf('@media (max-width: 640px)'))
    expect(narrow).toContain('.tp-body.split > .pt:not(.cur) { display: none; }')
    expect(narrow).toMatch(/\.tp-body\.split > \.pt\.pane-a, \.tp-body\.split > \.pt\.pane-b \{ left: 0; right: 0;/)
    expect(narrow).toContain('.tp-x, .tp-add, .tp-tool, .tp-ft { width: 44px; height: 44px; }')   // split button too
  })
})

describe('ADM-1325: Ctrl+` and Ctrl+Shift+`', () => {
  const press = (extra = {}) => {
    const e = new KeyboardEvent('keydown', { key: '`', code: 'Backquote', ctrlKey: true, bubbles: true, cancelable: true, ...extra })
    window.dispatchEvent(e)
    return e
  }
  const Stub = { name: 'TerminalPanel', template: '<div class="tp-stub" />', methods: { addShell: vi.fn(), focus: vi.fn() } }
  const bottom = (props = {}) => mount(BottomPanel, { attachTo: document.body, props: { repoId: 16, ready: true, ...props }, global: { stubs: { Icon: true, TerminalPanel: Stub } } })

  it('which keys they are: by the key\'s place, Shift for a new shell, never with Alt or without Ctrl', () => {
    expect(terminalShortcut({ ctrlKey: true, code: 'Backquote', key: '`' })).toBe('toggle')
    expect(terminalShortcut({ ctrlKey: true, shiftKey: true, code: 'Backquote', key: '~' })).toBe('new')
    expect(terminalShortcut({ metaKey: true, key: '`' })).toBe('toggle')
    expect(terminalShortcut({ ctrlKey: true, altKey: true, code: 'Backquote' })).toBe(null)
    expect(terminalShortcut({ code: 'Backquote', key: '`' })).toBe(null)
    expect(terminalShortcut({ ctrlKey: true, code: 'KeyK', key: 'k' })).toBe(null)
  })

  it('Ctrl+` opens the panel on the Terminal, and closes it when the Terminal is shown', async () => {
    Stub.methods.focus.mockClear()
    const w = bottom({ collapsed: true })
    const e = press()
    await flushPromises()
    expect(e.defaultPrevented).toBe(true)
    expect(w.emitted('toggle')).toHaveLength(1)                                    // opened
    expect(w.find('.bp-tab.on').text()).toBe('Terminal')
    expect(w.find('.tp-stub').exists()).toBe(true)
    expect(Stub.methods.focus).toHaveBeenCalled()
    await w.setProps({ collapsed: false })
    press()
    await flushPromises()
    expect(w.emitted('toggle')).toHaveLength(2)                                    // closed
    // Open on another tab: Ctrl+` moves to the Terminal and keeps the panel open.
    await w.findAll('.bp-tab')[0].trigger('click')
    press()
    await flushPromises()
    expect(w.find('.bp-tab.on').text()).toBe('Terminal')
    expect(w.emitted('toggle')).toHaveLength(2)
  })

  it('Ctrl+Shift+` opens a new shell; the first opening of the Terminal only opens its own', async () => {
    Stub.methods.addShell.mockClear()
    const w = bottom()
    press({ shiftKey: true, key: '~' })
    await flushPromises()
    expect(w.find('.tp-stub').exists()).toBe(true)
    expect(Stub.methods.addShell).not.toHaveBeenCalled()
    press({ shiftKey: true, key: '~' })
    await flushPromises()
    expect(Stub.methods.addShell).toHaveBeenCalledTimes(1)
  })

  it('a key already handled (by the editor or a field), other keys, or a page with no project: nothing', async () => {
    const w = bottom()
    const handled = new KeyboardEvent('keydown', { key: '`', code: 'Backquote', ctrlKey: true, bubbles: true, cancelable: true })
    handled.preventDefault()
    window.dispatchEvent(handled)
    press({ key: 'k', code: 'KeyK' })
    await flushPromises()
    expect(w.find('.tp-stub').exists()).toBe(false)
    w.unmount()
    const none = mount(BottomPanel, { props: {}, global: { stubs: { Icon: true } } })
    const e = press()
    await flushPromises()
    expect(e.defaultPrevented).toBe(false)
    expect(none.emitted('toggle')).toBeUndefined()
  })

  it('inside a terminal only these two leave the shell; every other Ctrl key still reaches it', async () => {
    const w = mount(ProjectTerminal, { props: { mode: 'shell', repoId: 16, n: 1 }, global: { stubs: { Icon: true } } })
    await flushPromises()
    const term = terms[terms.length - 1]
    const ev = (extra) => ({ type: 'keydown', key: '`', code: 'Backquote', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false, preventDefault: vi.fn(), ...extra })
    const toggle = ev()
    expect(term.keyHandler(toggle)).toBe(false)                                    // xterm leaves it: it reaches the page
    expect(toggle.preventDefault).not.toHaveBeenCalled()
    expect(term.keyHandler(ev({ shiftKey: true, key: '~' }))).toBe(false)
    expect(term.keyHandler(ev({ key: 'r', code: 'KeyR' }))).toBe(true)             // Ctrl+R: the shell's own
    expect(term.keyHandler(ev({ key: 'l', code: 'KeyL' }))).toBe(true)
    w.unmount()
  })
})
