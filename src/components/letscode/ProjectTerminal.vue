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
import { loadXterm } from './loadXterm'

const props = defineProps({
  mode: { type: String, default: 'shell' },          // 'shell' | 'agent'
  repoId: { type: Number, required: true },
  n: { type: Number, default: 1 },
  entries: { type: Array, default: () => [] },      // agent mode: [{command, output, ok, exit_code, elapsed_s, ...}]
  active: { type: Boolean, default: true },
})
const emit = defineEmits(['ended'])

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
  }
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
    else if (msg.state === 'connected') { overlay.value = null; sendSize(); if (props.active) term?.focus() }
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
  sock.connect(() => `${proto}//${host_}/ws/lets-code/${props.repoId}/terminal/${props.n}/`)
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
  const { Terminal, FitAddon, WebLinksAddon } = await loadXterm()
  if (gone) return
  term = new Terminal({
    fontFamily: getComputedStyle(document.documentElement).getPropertyValue('--vm-font-mono').trim() || 'monospace',
    fontSize: 13, lineHeight: 1.25, cursorBlink: props.mode === 'shell', scrollback: 10000,
    disableStdin: props.mode !== 'shell', convertEol: false, theme: themeFromTokens(),
  })
  fit = new FitAddon()
  term.loadAddon(fit)
  term.loadAddon(new WebLinksAddon((_e, uri) => { const w = window.open(uri, '_blank'); if (w) w.opener = null }))
  term.open(host.value)
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
  clearTimeout(sizeTimer)
  observer?.disconnect()
  sock.close()                                    // the shell keeps running in the sandbox: reopening reattaches
  term?.dispose()
})

// Ends the shell and everything running in it (the tab's close button). A closed tab never reattaches to it.
function end() { sock.send(JSON.stringify({ type: 'close' })) }

defineExpose({ restart, end, focus: () => term?.focus() })
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
