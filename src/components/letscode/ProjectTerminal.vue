<template>
  <!-- One terminal in a Let's Code project's Terminal tab (ADM-1196, Phase 3). mode "shell": the person's own shell
       in the project's sandbox, through AADML (ws/lets-code/{repo}/terminal/{n}/). mode "agent": read-only, the
       commands the Coding Agent ran, with their output, as they finish. -->
  <div class="pt">
    <div ref="host" class="pt-host" :aria-label="mode === 'agent' ? 'Commands the Coding Agent ran' : `Terminal ${n}`"></div>
    <div v-if="overlay" class="pt-overlay" :role="overlay.kind === 'error' ? 'alert' : 'status'" aria-live="polite">
      <Icon :icon="overlay.icon" :class="['pt-ov-ic', { spin: overlay.kind === 'wait' }]" aria-hidden="true" />
      <p class="pt-ov-t">{{ overlay.text }}</p>
      <button v-if="overlay.kind !== 'wait'" type="button" class="pt-btn" @click="restart">
        <Icon icon="lucide:rotate-ccw" aria-hidden="true" /> Start the terminal again
      </button>
    </div>
    <p v-if="mode === 'agent' && !entries.length" class="pt-empty">The Coding Agent's commands show here as it runs them.</p>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Icon } from '@iconify/vue'
import { reconnectingSocket } from '@/utils/reconnectingSocket'
import { useIdeTheme } from '@/composables/useIdeTheme'
import { notify } from '@/composables/useNotify'
import { loadXterm } from './loadXterm'

const props = defineProps({
  mode: { type: String, default: 'shell' },          // 'shell' | 'agent'
  repoId: { type: Number, required: true },
  n: { type: Number, default: 1 },
  entries: { type: Array, default: () => [] },      // agent mode: [{command, output, ok, exit_code, elapsed_s, ...}]
  active: { type: Boolean, default: true },
  // The shell a NEW terminal starts (bash, zsh or sh; ADM-1211). A running terminal keeps its own; the server says
  // which in the "connected" status ("info").
  shell: { type: String, default: '' },
  // Opened with "+": the first connection asks for a NEW shell (the server ends one left under this number); later
  // reconnects and reloads reattach to it.
  fresh: { type: Boolean, default: false },
  fontSize: { type: Number, default: 13 },
})
let freshPending = props.fresh
// info: {shell, root, project} once connected; cwd: the folder the shell is in (OSC 7, each prompt);
// find / font(+1 | -1 | 0) / menu({x, y}): the keys and right-click the panel acts on; results: {index, count} of a find.
const emit = defineEmits(['ended', 'info', 'cwd', 'find', 'font', 'menu', 'results'])

const host = ref(null)
const overlay = ref(null)
let term = null
let fit = null
let observer = null
let gone = false
let written = 0                                   // agent mode: entries already written
const enc = new TextEncoder()

// Colours from the editor's tokens, read where the terminal is: the editor has its own light or dark (useIdeTheme),
// set on its container, so the page's root may hold the other one.
const { isDark } = useIdeTheme()
function themeFromTokens() {
  const css = getComputedStyle(host.value || document.documentElement)
  const v = (name, fallback) => (css.getPropertyValue(name) || '').trim() || fallback
  return {
    background: v('--vm-surface', isDark.value ? '#16161d' : '#ffffff'),
    foreground: v('--vm-ink', isDark.value ? '#e7e7ee' : '#1b1b22'),
    cursor: v('--vm-violet', '#6d5df6'),
    selectionBackground: isDark.value ? '#3b3b55' : '#d9d6ff',
    ...(isDark.value ? ANSI_DARK : ANSI_LIGHT),
  }
}
// VS Code's terminal colours (Dark+ and Light+), so `ls`, git and test output look the way people know them. The
// terminal's minimumContrastRatio (4.5, as VS Code) lifts any of them that is too faint on the background.
const ANSI_DARK = {
  black: '#000000', red: '#cd3131', green: '#0dbc79', yellow: '#e5e510', blue: '#2472c8', magenta: '#bc3fbc',
  cyan: '#11a8cd', white: '#e5e5e5', brightBlack: '#666666', brightRed: '#f14c4c', brightGreen: '#23d18b',
  brightYellow: '#f5f543', brightBlue: '#3b8eea', brightMagenta: '#d670d6', brightCyan: '#29b8db', brightWhite: '#e5e5e5',
}
const ANSI_LIGHT = {
  black: '#000000', red: '#cd3131', green: '#00bc00', yellow: '#949800', blue: '#0451a5', magenta: '#bc05bc',
  cyan: '#0598bc', white: '#555555', brightBlack: '#666666', brightRed: '#cd3131', brightGreen: '#14ce14',
  brightYellow: '#b5ba00', brightBlue: '#0451a5', brightMagenta: '#bc05bc', brightCyan: '#0598bc', brightWhite: '#a5a5a5',
}
watch(isDark, () => { if (term) term.options.theme = themeFromTokens() }, { flush: 'post' })   // after the container's attribute

// The person's shell: AADML's socket for this project and terminal number. Output arrives as bytes.
const sock = reconnectingSocket({
  onOpen: (s) => {
    s.binaryType = 'arraybuffer'
    sendSize()
  },
  onMessage: (ev) => {
    if (typeof ev.data !== 'string') { term?.write(new Uint8Array(ev.data)); return }      // the shell's output
    let msg
    try { msg = JSON.parse(ev.data) } catch { return }
    if (msg.type !== 'status') return
    if (msg.state === 'starting') overlay.value = { kind: 'wait', icon: 'lucide:loader', text: "The project's sandbox is starting…" }
    else if (msg.state === 'connected') {
      overlay.value = null; sendSize(); if (props.active) term?.focus()
      freshPending = false
      if (msg.shell) emit('info', { shell: msg.shell, root: msg.root || '', project: msg.project || '' })
    }
    else if (msg.state === 'exited') stop({ kind: 'ended', icon: 'lucide:square-terminal', text: 'The terminal ended.' })
    else if (msg.state === 'error') stop({ kind: 'error', icon: 'lucide:alert-triangle', text: msg.error || 'The terminal could not be opened.' })
  },
  onClose: (ev) => {
    // Refused (not the person's project, too many tries): said, and not retried in a loop.
    // Also while "Opening the terminal…" shows: a refusal at connect must replace it, never leave it spinning.
    if ([4401, 4404, 4429, 4503].includes(ev?.code) && (!overlay.value || overlay.value.kind === 'wait')) {
      stop({ kind: 'error', icon: 'lucide:alert-triangle', text: ev.code === 4429
        ? 'Too many terminals were opened in the last minute. Wait a moment, then start it again.'
        : 'The terminal could not be opened.' })
    }
  },
})
function stop(o) { overlay.value = o; sock.close(); emit('ended', props.n) }
function connect() {
  overlay.value = { kind: 'wait', icon: 'lucide:loader', text: 'Opening the terminal…' }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host_ = import.meta.env.VITE_WS_HOST || window.location.host
  sock.connect(() => {
    const q = new URLSearchParams()
    if (props.shell) q.set('shell', props.shell)
    if (freshPending) q.set('new', '1')
    const qs = q.toString()
    return `${proto}//${host_}/ws/lets-code/${props.repoId}/terminal/${props.n}/${qs ? `?${qs}` : ''}`
  })
}
function restart() { term?.reset(); connect() }
let sizeTimer = null
function sendSize() {
  if (!term || props.mode !== 'shell') return
  clearTimeout(sizeTimer)
  sizeTimer = setTimeout(() => sock.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows })), 80)
}
function fitNow() { try { fit?.fit() } catch { /* not laid out yet */ } }

// The Coding Agent's commands, written as they arrive: the command, its output, how it ended.
function writeEntries() {
  if (!term || props.mode !== 'agent') return
  for (; written < props.entries.length; written++) {
    const e = props.entries[written]
    const out = String(e.output || '').replace(/\r?\n/g, '\r\n')
    const how = e.stopped ? 'stopped' : (e.ok ? 'done' : `failed${e.exit_code != null ? ` (exit ${e.exit_code})` : ''}`)
    const secs = e.elapsed_s ? `, ${e.elapsed_s}s` : ''
    term.write(`\x1b[1;35m$ ${e.command || e.tool}\x1b[0m\r\n${out}${out && !out.endsWith('\r\n') ? '\r\n' : ''}`)
    term.write(`\x1b[${e.ok ? '32' : '31'}m[${how}${secs}]\x1b[0m\r\n\r\n`)
  }
}
watch(() => props.entries.length, writeEntries)
watch(() => props.active, (on) => { if (on) nextTick(() => { fitNow(); if (props.mode === 'shell') term?.focus() }) })

onMounted(async () => {
  // xterm is loaded only when a terminal is first shown (loadXterm.js): every other page keeps its bundle.
  const { Terminal, FitAddon, WebLinksAddon, SearchAddon } = await loadXterm()
  if (gone) return
  term = new Terminal({
    fontFamily: getComputedStyle(document.documentElement).getPropertyValue('--vm-font-mono').trim() || 'monospace',
    fontSize: props.fontSize, lineHeight: 1.25, cursorBlink: props.mode === 'shell', scrollback: 10000,
    disableStdin: props.mode !== 'shell', convertEol: false, theme: themeFromTokens(), minimumContrastRatio: 4.5,
    // The search add-on marks matches with decorations, a "proposed" xterm API: without this every find threw and
    // said "No results" (live, 2026-11-11). VS Code's terminal sets it too.
    allowProposedApi: true,
  })
  fit = new FitAddon()
  term.loadAddon(fit)
  term.loadAddon(new WebLinksAddon((_e, uri) => { const w = window.open(uri, '_blank'); if (w) w.opener = null }))
  // Find (Ctrl+F): every match is counted and marked (no highlight limit; owner's rule: results are never cut).
  if (SearchAddon) {
    search = new SearchAddon({ highlightLimit: Infinity })
    term.loadAddon(search)
    search.onDidChangeResults?.((r) => emit('results', { index: r.resultIndex, count: r.resultCount }))
  }
  // The folder the shell is in, which the prompt reports each time (OSC 7: file://host/path).
  term.parser?.registerOscHandler?.(7, (data) => {
    const m = /^file:\/\/[^/]*(\/.*)$/.exec(String(data || ''))
    if (m) { let p = m[1]; try { p = decodeURIComponent(p) } catch { /* shown as sent */ } emit('cwd', p) }
    return true
  })
  term.attachCustomKeyEventHandler?.(onKey)
  term.open(host.value)
  host.value.addEventListener('contextmenu', onContextMenu)
  fitNow()
  observer = new ResizeObserver(() => { fitNow() })
  observer.observe(host.value)
  if (props.mode === 'shell') {
    term.onData((d) => { sock.send(enc.encode(d)) })
    term.onResize(sendSize)
    connect()
  } else {
    writeEntries()
  }
})
onBeforeUnmount(() => {
  gone = true
  host.value?.removeEventListener('contextmenu', onContextMenu)
  clearTimeout(sizeTimer)
  observer?.disconnect()
  sock.close()                                    // the shell keeps running in the sandbox: reopening reattaches
  term?.dispose()
})

// Ends the shell and everything running in it (the tab's close button). A closed tab never reattaches to it.
function end() { sock.send(JSON.stringify({ type: 'close' })) }

// ── As in VS Code's terminal (ADM-1211) ────────────────────────────────────────────────────────────────────────
// Ctrl+Shift+C copies, and so does Ctrl+C while text is selected (with nothing selected it interrupts, as always);
// Ctrl+V / Ctrl+Shift+V paste (the browser's paste reaches the terminal); Ctrl+F finds; Ctrl+= / Ctrl+- / Ctrl+0 set
// the font size. Every other key goes to the shell, Ctrl+R, Ctrl+L and the rest included.
let search = null
function keyAction(e) {
  const ctrl = e.ctrlKey || e.metaKey
  if (!ctrl || e.altKey) return null
  const k = (e.key || '').toLowerCase()
  if (k === 'c' && (e.shiftKey || term?.hasSelection?.())) return 'copy'
  if (k === 'v') return 'paste'
  if (k === 'f' && !e.shiftKey) return 'find'
  if (k === '=' || k === '+') return 'bigger'
  if (k === '-' || k === '_') return 'smaller'
  if (k === '0') return 'reset'
  return null
}
function onKey(e) {
  const action = keyAction(e)
  if (!action) return true
  if (action === 'paste') return false              // not typed as ^V; the browser's paste event pastes
  e.preventDefault?.()                              // never the browser's own find or zoom
  if (e.type !== 'keydown') return false
  if (action === 'copy') { copySelection(); term?.clearSelection?.() }
  else if (action === 'find') emit('find')
  else emit('font', action === 'bigger' ? 1 : action === 'smaller' ? -1 : 0)
  return false
}
function onContextMenu(e) { e.preventDefault(); emit('menu', { x: e.clientX, y: e.clientY }) }
async function copySelection() {
  const text = term?.getSelection?.() || ''
  if (!text) return
  try { await navigator.clipboard.writeText(text) } catch { notify.error('Copying was blocked by the browser. Use Ctrl+Shift+C.') }
}
async function paste() {
  if (props.mode !== 'shell') return
  try { term?.paste(await navigator.clipboard.readText()) } catch { notify.error('Pasting was blocked by the browser. Use Ctrl+V.') }
  term?.focus()
}
const SEARCH_LOOK = {
  matchBackground: '#ffd16655', activeMatchBackground: '#f59e0b', matchOverviewRuler: '#ffd166',
  activeMatchColorOverviewRuler: '#f59e0b',
}
function find(text, opts = {}, back = false) {
  if (!search) return false
  const o = { caseSensitive: !!opts.caseSensitive, wholeWord: !!opts.wholeWord, regex: !!opts.regex, decorations: SEARCH_LOOK }
  if (!text) { search.clearDecorations(); emit('results', { index: -1, count: 0 }); return false }
  return back ? search.findPrevious(text, o) : search.findNext(text, o)
}
function clearFind() { search?.clearDecorations(); term?.focus() }
watch(() => props.fontSize, (size) => {
  if (!term) return
  term.options.fontSize = size
  nextTick(() => { fitNow(); sendSize() })
})

defineExpose({
  restart, end, focus: () => term?.focus(), clear: () => { term?.clear(); term?.focus() },
  copy: copySelection, paste, selectAll: () => { term?.selectAll(); term?.focus() },
  hasSelection: () => !!term?.hasSelection?.(), find, clearFind,
})
</script>

<style scoped>
.pt { position: relative; height: 100%; background: var(--vm-surface); }
.pt-host { position: absolute; inset: 6px 4px 4px 10px; }
.pt-host :deep(.xterm) { height: 100%; }
.pt-host :deep(.xterm-viewport) { background: transparent !important; }
.pt-overlay {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; background: color-mix(in srgb, var(--vm-surface) 88%, transparent); text-align: center; padding: 16px;
}
.pt-ov-ic { width: 22px; height: 22px; color: var(--vm-ink-soft); }
.pt-ov-t { margin: 0; font: 500 13px var(--vm-font-sans); color: var(--vm-ink); max-width: 60ch; }
.pt-btn {
  display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 12px; border-radius: 6px;
  border: 1px solid var(--vm-line); background: var(--vm-surface); color: var(--vm-ink);
  font: 600 12.5px var(--vm-font-sans); cursor: pointer; transition: background-color .15s;
}
.pt-btn:hover { background: var(--vm-surface-soft); }
.pt-btn:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 2px; }
.pt-btn :deep(svg) { width: 14px; height: 14px; }
.pt-empty { position: absolute; left: 14px; top: 10px; margin: 0; color: var(--vm-ink-faint); font-size: 13px; pointer-events: none; }
.spin { animation: pt-spin 1s linear infinite; }
@keyframes pt-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
@media (max-width: 640px) { .pt-btn { min-height: 44px; } }
</style>
