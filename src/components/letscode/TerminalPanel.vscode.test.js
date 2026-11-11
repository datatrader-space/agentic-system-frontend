// @vitest-environment jsdom
// The Let's Code terminal works like VS Code's (ADM-1211): bash by default and a shell menu, tabs named after the
// shell and the folder it is in, Ctrl+Shift+C / Ctrl+C-with-a-selection copy, paste, Ctrl+F find (every match), font
// size keys, a toolbar (clear, end, maximize), a right-click menu, and VS Code's terminal colours.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'

enableAutoUnmount(afterEach)

const terms = []
const searches = []
class FakeTerminal {
  constructor(opts) {
    this.opts = opts; this.options = {}; this.cols = 100; this.rows = 30; this.written = []; this.dataCb = null
    this.osc = {}; this.keyHandler = null; this.selection = ''; this.pasted = []; this.cleared = 0
    this.parser = { registerOscHandler: (id, cb) => { this.osc[id] = cb } }
    terms.push(this)
  }
  loadAddon() {}
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
  reset() {}
  dispose() {}
}
class FakeSearch {
  constructor(opts) { this.opts = opts; this.calls = []; this.cb = null; searches.push(this) }
  findNext(t, o) { this.calls.push(['next', t, o]); return true }
  findPrevious(t, o) { this.calls.push(['prev', t, o]); return true }
  clearDecorations() { this.calls.push(['clear']) }
  onDidChangeResults(cb) { this.cb = cb }
}
vi.mock('./loadXterm', () => ({
  loadXterm: async () => ({ Terminal: FakeTerminal, FitAddon: class { fit() {} }, WebLinksAddon: class {}, SearchAddon: FakeSearch }),
}))
vi.mock('@/composables/useTheme', async () => { const { ref } = await import('vue'); return { useTheme: () => ({ isDark: ref(false) }) } })
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))

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

import TerminalPanel from './TerminalPanel.vue'

const ROOT = '/home/northrays/workspace/repo-16'
const connected = (shell) => ({ data: JSON.stringify({ type: 'status', state: 'connected', shell, root: ROOT, project: 'shop' }) })
const key = (k, extra = {}) => ({ type: 'keydown', key: k, ctrlKey: true, shiftKey: false, altKey: false, metaKey: false, preventDefault: vi.fn(), ...extra })

let clipboard
beforeEach(() => {
  terms.length = 0; searches.length = 0; sockets.length = 0; localStorage.clear()
  clipboard = { text: 'echo pasted', writeText: vi.fn(async (t) => { clipboard.text = t }), readText: vi.fn(async () => clipboard.text) }
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true })
})
afterEach(() => { document.body.innerHTML = '' })

async function panel(props = {}) {
  const w = mount(TerminalPanel, { attachTo: document.body, props: { repoId: 16, ready: true, ...props }, global: { stubs: { Icon: true } } })
  await flushPromises()
  return w
}
const shellTerm = () => terms.find(t => !t.opts.disableStdin)
const shellSock = () => sockets.find(s => s.url && s.url.includes('/terminal/'))

describe('which shell', () => {
  it('a new terminal is bash; the menu opens zsh or sh, and the server is asked for that shell', async () => {
    const w = await panel()
    expect(shellSock().url).toMatch(/\/ws\/lets-code\/16\/terminal\/1\/\?shell=bash$/)
    await w.find('.tp-pick').trigger('click')
    await flushPromises()
    const items = [...document.querySelectorAll('.xm-item')].map(b => b.textContent.trim())
    expect(items).toEqual(['bash (default)', 'zsh', 'sh'])
    ;[...document.querySelectorAll('.xm-item')].find(b => b.textContent.trim() === 'zsh').click()
    await flushPromises()
    expect(sockets.some(s => s.url && s.url.endsWith('/terminal/2/?shell=zsh'))).toBe(true)
    expect(w.findAll('.tp-name').map(n => n.text())).toEqual(['bash', 'zsh'])
  })

  it('the tab says the shell the server runs and the folder the shell is in', async () => {
    const w = await panel()
    shellSock().handlers.onMessage(connected('sh'))          // a reattached terminal keeps its own shell
    await flushPromises()
    expect(w.find('.tp-name').text()).toBe('sh')
    shellTerm().osc[7]('file://sandbox' + ROOT + '/app/api')
    await flushPromises()
    expect(w.find('.tp-dir').text()).toBe('app/api')
    expect(w.find('.tp-tab[title]').attributes('title')).toBe('sh in shop/app/api')
    shellTerm().osc[7]('file://sandbox' + ROOT + '/a/b/c/d')
    await flushPromises()
    expect(w.find('.tp-dir').text()).toBe('…/c/d')
    shellTerm().osc[7]('file://sandbox' + ROOT)
    await flushPromises()
    expect(w.find('.tp-dir').exists()).toBe(false)               // the project's top: the name alone
  })

  it('a list kept before (numbers only) reopens its terminals, named once the server says', async () => {
    localStorage.setItem('lets-code:terminals:16', JSON.stringify([2]))
    const w = await panel()
    expect(sockets.some(s => s.url && s.url.endsWith('/terminal/2/'))).toBe(true)   // no shell asked: it reattaches
    shellSock().handlers.onMessage(connected('zsh'))
    await flushPromises()
    expect(w.find('.tp-name').text()).toBe('zsh')
    expect(JSON.parse(localStorage.getItem('lets-code:terminals:16'))).toEqual([{ n: 2, shell: 'zsh' }])
  })
})

describe('keys, as in VS Code', () => {
  it('Ctrl+C copies a selection and interrupts without one; Ctrl+Shift+C copies; Ctrl+V pastes through the browser', async () => {
    await panel()
    const t = shellTerm()
    expect(t.keyHandler(key('c'))).toBe(true)                    // nothing selected: ^C goes to the shell
    t.selection = 'npm run dev'
    expect(t.keyHandler(key('c'))).toBe(false)
    await flushPromises()
    expect(clipboard.writeText).toHaveBeenCalledWith('npm run dev')
    expect(t.selection).toBe('')
    t.selection = 'x'
    expect(t.keyHandler(key('C', { shiftKey: true }))).toBe(false)
    const v = key('v')
    expect(t.keyHandler(v)).toBe(false)                          // never typed as ^V ...
    expect(v.preventDefault).not.toHaveBeenCalled()              // ... and the browser's paste still happens
    expect(t.keyHandler(key('r'))).toBe(true)                    // Ctrl+R (history search) is the shell's
  })

  it('Ctrl+= and Ctrl+- change the font size of every terminal, kept; Ctrl+0 resets', async () => {
    await panel()
    const t = shellTerm()
    t.keyHandler(key('='))
    t.keyHandler(key('='))
    await flushPromises()
    expect(t.options.fontSize).toBe(15)
    expect(localStorage.getItem('lets-code:terminal-font')).toBe('15')
    t.keyHandler(key('-'))
    await flushPromises()
    expect(t.options.fontSize).toBe(14)
    t.keyHandler(key('0'))
    await flushPromises()
    expect(t.options.fontSize).toBe(13)
  })

  it('Ctrl+F opens find: every match is counted and marked, Enter goes to the next, Escape closes', async () => {
    const w = await panel()
    shellTerm().keyHandler(key('f'))
    await flushPromises()
    const input = w.find('.tp-find-in')
    expect(document.activeElement).toBe(input.element)
    const search = searches[searches.length - 1]
    expect(search.opts).toEqual({ highlightLimit: Infinity })    // never "the first N"
    await input.setValue('error')
    expect(search.calls.at(-1)).toEqual(['next', 'error', expect.objectContaining({ caseSensitive: false, regex: false })])
    search.cb({ resultIndex: 1, resultCount: 5 })
    await flushPromises()
    expect(w.find('.tp-find-n').text()).toBe('2 of 5')
    await input.trigger('keydown', { key: 'Enter', shiftKey: true })
    expect(search.calls.at(-1)[0]).toBe('prev')
    await w.findAll('.tp-ft').find(b => b.attributes('aria-label') === 'Match case').trigger('click')
    expect(search.calls.at(-1)[2].caseSensitive).toBe(true)
    await input.trigger('keydown', { key: 'Escape' })
    expect(w.find('.tp-find').exists()).toBe(false)
    expect(search.calls.at(-1)).toEqual(['clear'])
  })
})

describe('toolbar and right-click', () => {
  it('Clear clears the terminal shown, End ends it, Maximize asks the page', async () => {
    const w = await panel()
    await w.find('[aria-label="Clear the terminal"]').trigger('click')
    expect(shellTerm().cleared).toBe(1)
    await w.find('[aria-label="Maximize the panel"]').trigger('click')
    expect(w.emitted('maximize')).toHaveLength(1)
    await w.find('.tp-tools [aria-label="End this terminal"]').trigger('click')
    await flushPromises()
    expect(shellSock().sent.map(d => (typeof d === 'string' ? JSON.parse(d) : null))).toContainEqual({ type: 'close' })
    expect(w.findAll('.tp-name')).toHaveLength(0)
  })

  it('right-click offers Copy (when something is selected), Paste, Select all, Find and Clear', async () => {
    const w = await panel()
    const t = shellTerm()
    const host = w.findAll('.pt-host').find(h => h.attributes('aria-label') === 'Terminal 1')
    host.element.dispatchEvent(new MouseEvent('contextmenu', { clientX: 20, clientY: 30, bubbles: true }))
    await flushPromises()
    const item = (label) => [...document.querySelectorAll('.xm-item')].find(b => b.textContent.trim().startsWith(label))
    expect(item('Copy').disabled).toBe(true)
    expect(['Paste', 'Select all', 'Find', 'Clear'].every(l => item(l))).toBe(true)
    item('Paste').click()
    await flushPromises()
    expect(t.pasted).toEqual(['echo pasted'])
  })
})

describe('colours', () => {
  it("VS Code's terminal colours, readable on the light background", async () => {
    await panel()
    const t = shellTerm()
    expect(t.opts.minimumContrastRatio).toBe(4.5)
    expect(t.opts.theme).toEqual(expect.objectContaining({ green: '#00bc00', blue: '#0451a5', brightBlack: '#666666' }))
  })
})
