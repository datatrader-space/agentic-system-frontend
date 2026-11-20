<template>
  <div class="pv">
    <div class="pv-bar">
      <button v-if="view !== 'list'" type="button" class="pv-tool" aria-label="Show the running ports" title="Ports" @click="showList">
        <Icon icon="lucide:list" aria-hidden="true" />
      </button>
      <span v-if="view === 'list'" class="pv-title">Running ports</span>
      <label v-else class="pv-port">
        <span class="sr-only">Port</span>
        <select :value="selected" @change="openPort($event.target.value)">
          <option v-if="!ports.some(p => p.port === selected)" :value="selected">Port {{ selected }}</option>
          <option v-for="p in ports" :key="p.port" :value="p.port">Port {{ p.port }}{{ p.listening ? '' : ' (stopped)' }}</option>
        </select>
      </label>
      <span v-if="view === 'frame'" class="pv-note">Only you can open this preview. Links last an hour; Reload renews it.</span>
      <!-- Device sizes, select mode and the console/network panes (ADM-1318); the last two need the preview inspector. -->
      <div v-if="view === 'frame'" class="pv-device-tools">
        <label class="pv-port">
          <span class="sr-only">Device size</span>
          <select v-model="deviceId" name="preview-device">
            <option v-for="d in DEVICES" :key="d.id" :value="d.id">{{ d.width ? `${d.label} (${d.width}×${d.height})` : d.label }}</option>
          </select>
        </label>
        <button type="button" class="pv-tool" aria-label="Rotate the device" title="Rotate" :disabled="!size" :aria-pressed="rotated ? 'true' : 'false'"
                @click="rotated = !rotated">
          <Icon icon="lucide:rotate-ccw-square" aria-hidden="true" />
        </button>
        <span v-if="size" class="pv-zoom" :title="`Shown at ${formatPercent(scale)} to fit the panel`">{{ formatPercent(scale) }}</span>
        <template v-if="inspector">
          <button type="button" class="pv-tool" :class="{ on: selecting }" :aria-pressed="selecting ? 'true' : 'false'"
                  :aria-label="selecting ? 'Stop selecting an element' : 'Select an element to edit'" :title="selecting ? 'Stop selecting (Esc)' : 'Select an element'"
                  @click="toggleSelect">
            <Icon icon="lucide:square-mouse-pointer" aria-hidden="true" />
          </button>
          <button type="button" class="pv-tool" :class="{ on: toolsOpen }" :aria-pressed="toolsOpen ? 'true' : 'false'"
                  :aria-label="(toolsOpen ? 'Hide the console and network' : 'Show the console and network') + (errorCount ? ` (${errorCount} ${errorCount === 1 ? 'error' : 'errors'})` : '')"
                  title="Console and network"
                  @click="toolsOpen = !toolsOpen">
            <Icon icon="lucide:square-terminal" aria-hidden="true" />
            <span v-if="errorCount" class="pv-badge" aria-hidden="true">{{ errorCount }}</span>
          </button>
        </template>
      </div>
      <div class="pv-tools">
        <button v-if="view === 'list'" type="button" class="pv-tool" aria-label="Refresh the ports" title="Refresh"
                :disabled="loadingPorts || !ready" @click="loadPorts">
          <Icon icon="lucide:refresh-cw" :class="{ spin: loadingPorts }" aria-hidden="true" />
        </button>
        <template v-else>
          <button type="button" class="pv-tool" aria-label="Reload the preview" title="Reload" :disabled="view === 'working'" @click="reload">
            <Icon icon="lucide:rotate-cw" aria-hidden="true" />
          </button>
          <button type="button" class="pv-tool" aria-label="Open the preview in a new tab" title="Open in a new tab" @click="openInTab">
            <Icon icon="lucide:external-link" aria-hidden="true" />
          </button>
        </template>
        <button type="button" class="pv-tool" :aria-label="maximized ? 'Restore the panel' : 'Maximize the panel'"
                :title="maximized ? 'Restore' : 'Maximize'" @click="emit('maximize')">
          <Icon :icon="maximized ? 'lucide:minimize-2' : 'lucide:maximize-2'" aria-hidden="true" />
        </button>
      </div>
    </div>
    <p v-if="tabNote" class="pv-tabnote" role="alert">{{ tabNote }}</p>

    <div class="pv-body">
      <!-- The ports: every app port listening in the project's sandbox, and the Coding Agent's apps that stopped. -->
      <div v-if="view === 'list'" class="pv-list vm-scroll">
        <p v-if="!ready" class="pv-empty">The ports are listed once the project is ready.</p>
        <p v-else-if="portsError" class="pv-empty err" role="alert">{{ portsError }}</p>
        <p v-else-if="loadingPorts && !ports.length" class="pv-empty">Reading the ports…</p>
        <p v-else-if="!ports.length" class="pv-empty">
          No app is running. Start one in the Terminal (for example <code translate="no">npm run dev</code>) or ask the Coding Agent,
          then refresh.
        </p>
        <ul v-else class="pv-ports" aria-label="Running ports">
          <li v-for="p in ports" :key="p.port" class="pv-row">
            <button type="button" class="pv-open" :aria-label="`Open port ${p.port}`" @click="openPort(p.port)">
              <span class="pv-dot" :class="{ on: p.listening }" aria-hidden="true"></span>
              <span class="pv-num">{{ p.port }}</span>
              <span class="pv-state">{{ p.listening ? 'Running' : 'Stopped: opening it starts it again' }}</span>
              <span v-if="p.started_by === 'agent' && p.command" class="pv-cmd" :title="p.command">
                Coding Agent: <code translate="no">{{ p.command }}</code>
              </span>
              <Icon icon="lucide:chevron-right" class="pv-go" aria-hidden="true" />
            </button>
          </li>
        </ul>
      </div>

      <div v-else-if="view === 'working'" class="pv-status" role="status" aria-live="polite">
        <span class="pv-spin" aria-hidden="true"></span>
        <span>{{ message }}</span>
      </div>

      <div v-else-if="view === 'error'" class="pv-status err" role="alert">
        <p>{{ message }}</p>
        <p v-if="toolsFailed" class="pv-why">The console, network and select tools could not start for this app.</p>
        <div class="pv-actions">
          <button v-if="retryable" type="button" class="pv-btn primary" @click="reload">Try again</button>
          <button v-if="toolsFailed" type="button" class="pv-btn" @click="openPort(selected, { tools: false })">Open without the tools</button>
          <button type="button" class="pv-btn" @click="showList">Show the ports</button>
        </div>
      </div>

      <div v-else class="pv-work">
        <div ref="stage" class="pv-stage" :class="{ sized: !!size }">
          <div class="pv-device" :style="deviceBox">
            <!-- Another origin (the sandbox's), so it cannot read AADML's page or cookies, and AADML never reads its page:
                 the preview inspector's script inside it posts what happens there (previewInspector.js checks each one). -->
            <iframe ref="frameEl" :key="frameKey" class="pv-frame" :src="url" :title="`Preview of port ${selected}`" :style="frameBox"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
                    referrerpolicy="no-referrer"></iframe>
          </div>
        </div>
        <p v-if="selecting" class="pv-hint" role="status">Click an element in the preview to select it. Esc stops.</p>
        <PreviewElementCard v-if="element" ref="card" :element="element" :edit="textEdit" :editing="editing" :busy="asking"
                            :note="askNote" :note-error="askNoteError"
                            @ask="askAgent" @edit-text="editText" @clear="clearElement" />
        <div v-if="inspector && toolsOpen" class="pv-devtools">
          <PreviewDevtools v-model:tab="toolsTab" :console="consoleEntries" :network="networkEntries" @clear="clearEntries" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// The IDE's Preview tab (ADM-1205 phase D), as VS Code's Ports view plus its Simple Browser: the project's running
// ports, and the app on one of them inside the panel. Each open asks AADML for a fresh signed link (the person's own
// project only; AADML wakes the sandbox and starts the Coding Agent's stopped app again first): utils/previewLink.js.
import { ref, shallowRef, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { Icon } from '@iconify/vue'
import api from '@/services/api'
import { fetchPreviewLink } from '@/utils/previewLink'
import PreviewDevtools from './PreviewDevtools.vue'
import PreviewElementCard from './PreviewElementCard.vue'
import {
  DEVICES, deviceSize, fitScale, readInspectorMessage, postToPage, pngFile, elementMessage, formatPercent,
} from './previewInspector'

const props = defineProps({
  repoId: { type: Number, required: true },
  ready: { type: Boolean, default: false },
  maximized: { type: Boolean, default: false },
})
// `ask-agent` { text, files, done(ok) }: ONE message to the Coding Agent's chat (LetsCode.vue -> UnifiedAgentChat.sendReview).
const emit = defineEmits(['maximize', 'ask-agent'])

const ports = ref([])
const loadingPorts = ref(false)
const portsError = ref('')
const view = ref('list')          // 'list' | 'working' | 'error' | 'frame'
const selected = ref(0)
const url = ref('')
const message = ref('')
const retryable = ref(true)
const frameKey = ref(0)
const tabNote = ref('')
let gone = false
let seq = 0

// The preview inspector (ADM-1318): the link is to it when `inspector`; `withTools` is the person's choice for this port.
const inspector = ref(false)
const withTools = ref(true)
const toolsFailed = ref(false)
const frameEl = ref(null)
const stage = ref(null)
const card = ref(null)
const frameOrigin = computed(() => { try { return new URL(url.value).origin } catch { return '' } })
const deviceId = ref('responsive')
const rotated = ref(false)
const room = ref({ width: 0, height: 0 })
const size = computed(() => deviceSize(DEVICES.find((d) => d.id === deviceId.value), rotated.value))
const scale = computed(() => fitScale(size.value, room.value))
const deviceBox = computed(() => (size.value
  ? { width: `${Math.round(size.value.width * scale.value)}px`, height: `${Math.round(size.value.height * scale.value)}px` }
  : null))
const frameBox = computed(() => (size.value
  ? { width: `${size.value.width}px`, height: `${size.value.height}px`, transform: `scale(${scale.value})`, transformOrigin: '0 0' }
  : null))
const selecting = ref(false)
const element = ref(null)
const textEdit = ref(null)
const editing = ref(false)
const asking = ref(false)
const askNote = ref('')
const askNoteError = ref(false)
const toolsOpen = ref(false)
const toolsTab = ref('console')
// Every entry is kept until the person clears it (never capped); the panes draw only the rows in view.
const consoleEntries = shallowRef([])
const networkEntries = shallowRef([])
const errorCount = computed(() => consoleEntries.value.reduce((n, e) => n + (e.level === 'error' ? 1 : 0), 0))
let entryId = 0
const shots = new Map()
const SHOT_WAIT_MS = 15000

async function loadPorts() {
  if (!props.ready) return
  loadingPorts.value = true
  portsError.value = ''
  try {
    const { data } = await api.getProjectPorts(props.repoId)
    ports.value = Array.isArray(data?.ports) ? data.ports : []
  } catch (e) {
    const body = e?.response?.data || {}
    portsError.value = e?.response?.status === 503 && body.code === 'RUNNER_STARTING'
      ? 'Waking your project\'s sandbox… refresh in a moment.'
      : body.error || 'The ports could not be listed. Try again.'
  } finally {
    loadingPorts.value = false
  }
}

// `tools`: open it through the preview inspector (console, network, select). "Open without the tools" is the person's
// choice when the inspector cannot run; Reload keeps the choice.
async function openPort(port, { tools = true } = {}) {
  port = Number(port)
  if (!(port >= 1 && port <= 65535)) return
  const mine = ++seq
  selected.value = port
  withTools.value = tools
  tabNote.value = ''
  toolsFailed.value = false
  view.value = 'working'
  message.value = 'Opening the app…'
  resetSelection()
  const r = await fetchPreviewLink(props.repoId, port, {
    onWaiting: (m) => { if (mine === seq) message.value = m },
    gone: () => gone || mine !== seq,
    inspect: tools,
  })
  if (r.gone || mine !== seq) return
  if (r.url) {
    url.value = r.url
    inspector.value = r.inspector === true
    frameKey.value += 1                // a new link is a new page, even for the same port
    view.value = 'frame'
    addMark(`Opened port ${port}${inspector.value ? '' : ' without the tools'}`)
    return
  }
  message.value = r.error
  retryable.value = r.retryable !== false
  toolsFailed.value = r.code === 'INSPECTOR_UNAVAILABLE'
  view.value = 'error'
}

// Reload asks for a NEW link: one that expired, or an app that stopped, is handled by AADML.
function reload() { if (selected.value) openPort(selected.value, { tools: withTools.value }) }

// ── the preview inspector's messages (ADM-1318) ───────────────────────────────────────────────────────────────
function push(list, entry) {
  list.value.push({ id: ++entryId, ...entry })
  list.value = list.value.slice()     // a new array: the panes and counts see the change
}
function addMark(text) { push(consoleEntries, { level: 'info', text, at: Date.now(), mark: true }) }
function clearEntries(which) {
  if (which === 'network') networkEntries.value = []
  else consoleEntries.value = []
}
function onMessage(event) {
  if (!inspector.value || view.value !== 'frame') return
  const msg = readInspectorMessage(event, { frame: frameEl.value?.contentWindow, origin: frameOrigin.value })
  if (!msg) return
  switch (msg.kind) {
    case 'ready':
      resetSelection()
      addMark(`Page loaded: ${msg.href}`)
      break
    case 'navigate':
      addMark(`Went to ${msg.href}`)
      break
    case 'console':
      push(consoleEntries, { level: msg.level, text: msg.text, at: msg.at })
      break
    case 'network':
      push(networkEntries, { method: msg.method, url: msg.url, type: msg.type, status: msg.status, ms: msg.ms,
        size: msg.size, at: msg.at, error: msg.error })
      break
    case 'select-mode':
      selecting.value = msg.on
      break
    case 'select':
      selecting.value = false
      element.value = msg.element
      textEdit.value = null
      editing.value = false
      askNote.value = ''
      break
    case 'text-edit':
      editing.value = msg.ok
      if (!msg.ok) { askNote.value = 'This element\'s text cannot be edited here.'; askNoteError.value = true }
      break
    case 'text-edited':
      editing.value = false
      textEdit.value = { before: msg.before, after: msg.after }
      break
    case 'screenshot': {
      const done = shots.get(msg.requestId)
      if (done) { shots.delete(msg.requestId); done(msg) }
      break
    }
  }
}
function toPage(kind, data) { return postToPage(frameEl.value?.contentWindow, frameOrigin.value, kind, data) }
function toggleSelect() {
  const on = !selecting.value
  if (toPage('select-mode', { on })) selecting.value = on
}
function resetSelection() {
  selecting.value = false
  element.value = null
  textEdit.value = null
  editing.value = false
  askNote.value = ''
  for (const done of shots.values()) done({ error: 'the page was reloaded' })
  shots.clear()
}
function clearElement() {
  toPage('clear')
  resetSelection()
}
function editText() {
  askNote.value = ''
  askNoteError.value = false
  toPage('edit-text')
}
// A picture of what the preview shows, taken by the inspector inside the page (the editor cannot read a page of
// another origin): { dataUrl } or { error }.
function takeScreenshot() {
  const requestId = `s${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  return new Promise((resolve) => {
    const timer = setTimeout(() => { shots.delete(requestId); resolve({ error: 'the page did not send a picture within 15 seconds' }) }, SHOT_WAIT_MS)
    shots.set(requestId, (r) => { clearTimeout(timer); resolve(r) })
    if (!toPage('screenshot', { requestId })) { shots.delete(requestId); clearTimeout(timer); resolve({ error: 'the preview is not open' }) }
  })
}
async function askAgent(request) {
  if (!element.value || asking.value) return
  asking.value = true
  askNote.value = ''
  askNoteError.value = false
  const el = element.value
  const shot = await takeScreenshot()
  const files = shot.dataUrl ? [pngFile(shot.dataUrl, `preview-port-${selected.value}.png`)] : []
  const text = elementMessage({ element: el, request, port: selected.value, edit: textEdit.value,
    screenshot: shot.dataUrl ? 'attached (what the preview showed)' : `not attached, because ${shot.error}` })
  const ok = await new Promise((resolve) => emit('ask-agent', { text, files, done: (v) => resolve(!!v) }))
  asking.value = false
  if (ok) {
    askNote.value = 'Sent to the Coding Agent\'s chat.'
    card.value?.clearRequest()
  } else {
    askNote.value = 'The chat did not take the message. Open the Coding Agent\'s chat and try again.'
    askNoteError.value = true
  }
}

let stageObserver = null
function measureStage() {
  const el = stage.value
  if (!el) return
  const pad = 16
  room.value = { width: Math.max(0, el.clientWidth - pad), height: Math.max(0, el.clientHeight - pad) }
}
watch(stage, (el) => {
  stageObserver?.disconnect()
  stageObserver = null
  if (el && typeof ResizeObserver !== 'undefined') {
    stageObserver = new ResizeObserver(measureStage)
    stageObserver.observe(el)
  }
  measureStage()
})

function showList() {
  seq += 1                              // a wait in progress stops
  view.value = 'list'
  tabNote.value = ''
  loadPorts()
}

// AADML's own preview page, which asks for a fresh link each time it is opened (views/LetsCodePreview.vue).
function openInTab() {
  tabNote.value = ''
  const win = window.open(`/preview/lets-code/${props.repoId}/${selected.value}`, '_blank')
  if (win) win.opener = null
  else tabNote.value = 'Your browser blocked the new tab. Allow pop-ups for AADML and try again.'
}

watch(() => props.ready, (r) => { if (r && view.value === 'list') loadPorts() })
onMounted(() => {
  window.addEventListener('message', onMessage)
  loadPorts()
})
onBeforeUnmount(() => {
  gone = true
  window.removeEventListener('message', onMessage)
  stageObserver?.disconnect()
  resetSelection()
})

defineExpose({ openPort, loadPorts })
</script>

<style scoped>
.pv { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.pv-bar { display: flex; align-items: center; gap: 8px; padding: 4px 8px; flex: 0 0 auto; min-width: 0; border-bottom: 1px solid var(--vm-line); }
.pv-title { font: 600 12px var(--vm-font-sans); color: var(--vm-ink-soft); }
.pv-port select {
  min-height: 26px; padding: 0 6px; border: 1px solid var(--vm-line-2); border-radius: 6px; background: var(--vm-surface);
  color: var(--vm-ink); font: 12px var(--vm-font-mono); cursor: pointer;
}
.pv-port select:focus-visible { outline: 2px solid var(--vm-focus, var(--vm-violet)); outline-offset: 1px; }
.pv-port select option { background: var(--vm-surface); color: var(--vm-ink); }
.pv-note { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11.5px; color: var(--vm-ink-faint); }
.pv-tools { display: flex; align-items: center; gap: 2px; margin-left: auto; flex: 0 0 auto; }
.pv-tool {
  display: grid; place-items: center; width: 24px; height: 24px; border: none; border-radius: 4px; background: transparent;
  color: var(--vm-ink-soft); cursor: pointer; transition: background-color .15s, color .15s; flex: 0 0 auto;
}
.pv-tool:hover:not(:disabled) { background: color-mix(in srgb, var(--vm-ink) 8%, transparent); color: var(--vm-ink); }
.pv-tool:disabled { color: var(--vm-ink-faint); cursor: default; opacity: .6; }
.pv-tool:focus-visible, .pv-open:focus-visible, .pv-btn:focus-visible { outline: 2px solid var(--vm-focus, var(--vm-violet)); outline-offset: 1px; }
.pv-tool :deep(svg) { width: 14px; height: 14px; }
.pv-tabnote { margin: 0; padding: 4px 10px; font-size: 12px; color: var(--vm-danger); }
.pv-body { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
.pv-list { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 6px; }
.pv-empty { margin: 6px 8px; font-size: 13px; line-height: 1.5; color: var(--vm-ink-faint); }
.pv-empty.err { color: var(--vm-danger); }
.pv-empty code, .pv-cmd code { font: 12px var(--vm-font-mono); color: var(--vm-ink-soft); }
.pv-ports { list-style: none; margin: 0; padding: 0; }
.pv-open {
  width: 100%; display: flex; align-items: center; gap: 10px; min-height: 34px; padding: 4px 8px; border: none; border-radius: 6px;
  background: transparent; color: var(--vm-ink); font: 13px var(--vm-font-sans); text-align: left; cursor: pointer;
  transition: background-color .15s;
}
.pv-open:hover { background: color-mix(in srgb, var(--vm-violet) 10%, transparent); }
.pv-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--vm-ink-faint); flex: 0 0 auto; }
.pv-dot.on { background: var(--vm-green); }
.pv-num { font: 600 13px var(--vm-font-mono); min-width: 48px; font-variant-numeric: tabular-nums; }
.pv-state { color: var(--vm-ink-soft); font-size: 12.5px; flex: 0 0 auto; }
.pv-cmd { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--vm-ink-faint); font-size: 12px; }
.pv-go { width: 14px; height: 14px; margin-left: auto; color: var(--vm-ink-faint); flex: 0 0 auto; }
.pv-status { flex: 1 1 auto; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 16px; font-size: 13.5px; color: var(--vm-ink-soft); text-align: center; }
.pv-status.err { flex-direction: column; color: var(--vm-danger); }
.pv-status.err p { margin: 0; max-width: 520px; line-height: 1.5; }
.pv-actions { display: flex; gap: 8px; }
.pv-btn { min-height: 30px; padding: 0 12px; border: 1px solid var(--vm-line-2); border-radius: 8px; background: var(--vm-surface); color: var(--vm-ink); font: 600 12.5px var(--vm-font-sans); cursor: pointer; }
.pv-btn.primary { border-color: transparent; background: var(--vm-violet); color: #fff; }
.pv-btn { transition: background-color .15s, filter .15s; }
.pv-btn:hover { background: var(--vm-surface-soft); }
.pv-btn.primary:hover { background: var(--vm-violet); filter: brightness(1.08); }
.pv-tool, .pv-open, .pv-btn { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
.pv-spin { width: 16px; height: 16px; flex: 0 0 auto; border: 2px solid color-mix(in srgb, var(--vm-violet) 25%, transparent); border-top-color: var(--vm-violet); border-radius: 50%; animation: pv-turn .8s linear infinite; }
.spin { animation: pv-turn .8s linear infinite; }
@keyframes pv-turn { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .pv-spin, .spin { animation-duration: 2.4s; } }
.pv-frame { flex: 1 1 auto; width: 100%; min-height: 0; border: 0; background: #fff; }
.pv-device-tools { display: flex; align-items: center; gap: 2px; flex: 0 1 auto; min-width: 0; }
.pv-device-tools .pv-port select { font-family: var(--vm-font-sans); max-width: 180px; }
.pv-zoom { padding: 0 4px; font: 11.5px var(--vm-font-mono); color: var(--vm-ink-faint); font-variant-numeric: tabular-nums; }
.pv-tool { position: relative; }
.pv-tool.on { background: color-mix(in srgb, var(--vm-violet) 16%, transparent); color: var(--vm-violet-ink, var(--vm-ink)); }
.pv-badge {
  position: absolute; top: -3px; right: -4px; min-width: 14px; height: 14px; padding: 0 3px; border-radius: 7px; background: var(--vm-danger);
  color: #fff; font: 600 9.5px/14px var(--vm-font-mono); text-align: center;
}
.pv-why { margin: 0; font-size: 12.5px; color: var(--vm-ink-soft); }
.pv-work { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
.pv-stage { flex: 1 1 auto; min-height: 0; display: flex; }
.pv-stage.sized { align-items: flex-start; justify-content: center; padding: 8px; overflow: hidden; background: var(--vm-surface-soft); }
.pv-device { flex: 1 1 auto; display: flex; min-width: 0; min-height: 0; }
.pv-stage.sized .pv-device { flex: 0 0 auto; overflow: hidden; border-radius: 6px; box-shadow: 0 0 0 1px var(--vm-line-2); }
.pv-stage.sized .pv-frame { flex: 0 0 auto; }
.pv-hint { margin: 0; padding: 4px 10px; font-size: 12px; color: var(--vm-ink-soft); border-top: 1px solid var(--vm-line); }
.pv-devtools { flex: 0 0 42%; min-height: 140px; border-top: 1px solid var(--vm-line); display: flex; flex-direction: column; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
@media (max-width: 640px) {
  .pv-bar { flex-wrap: wrap; }
  .pv-port select { min-height: 44px; }
  .pv-tool { width: 44px; height: 44px; }
  .pv-open { min-height: 44px; flex-wrap: wrap; }
  .pv-note { display: none; }
}
</style>
