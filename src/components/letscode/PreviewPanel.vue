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
        <div class="pv-actions">
          <button v-if="retryable" type="button" class="pv-btn primary" @click="reload">Try again</button>
          <button type="button" class="pv-btn" @click="showList">Show the ports</button>
        </div>
      </div>

      <!-- Another origin (the sandbox's), so it cannot read AADML's page or cookies. -->
      <iframe v-else :key="frameKey" class="pv-frame" :src="url" :title="`Preview of port ${selected}`"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
              referrerpolicy="no-referrer"></iframe>
    </div>
  </div>
</template>

<script setup>
// The IDE's Preview tab (ADM-1205 phase D), as VS Code's Ports view plus its Simple Browser: the project's running
// ports, and the app on one of them inside the panel. Each open asks AADML for a fresh signed link (the person's own
// project only; AADML wakes the sandbox and starts the Coding Agent's stopped app again first): utils/previewLink.js.
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { Icon } from '@iconify/vue'
import api from '@/services/api'
import { fetchPreviewLink } from '@/utils/previewLink'

const props = defineProps({
  repoId: { type: Number, required: true },
  ready: { type: Boolean, default: false },
  maximized: { type: Boolean, default: false },
})
const emit = defineEmits(['maximize'])

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

async function openPort(port) {
  port = Number(port)
  if (!(port >= 1 && port <= 65535)) return
  const mine = ++seq
  selected.value = port
  tabNote.value = ''
  view.value = 'working'
  message.value = 'Opening the app…'
  const r = await fetchPreviewLink(props.repoId, port, {
    onWaiting: (m) => { if (mine === seq) message.value = m },
    gone: () => gone || mine !== seq,
  })
  if (r.gone || mine !== seq) return
  if (r.url) {
    url.value = r.url
    frameKey.value += 1                // a new link is a new page, even for the same port
    view.value = 'frame'
    return
  }
  message.value = r.error
  retryable.value = r.retryable !== false
  view.value = 'error'
}

// Reload asks for a NEW link: one that expired, or an app that stopped, is handled by AADML.
function reload() { if (selected.value) openPort(selected.value) }

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
onMounted(loadPorts)
onBeforeUnmount(() => { gone = true })

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
.pv-tool, .pv-open, .pv-btn { touch-action: manipulation; }
.pv-spin { width: 16px; height: 16px; flex: 0 0 auto; border: 2px solid color-mix(in srgb, var(--vm-violet) 25%, transparent); border-top-color: var(--vm-violet); border-radius: 50%; animation: pv-turn .8s linear infinite; }
.spin { animation: pv-turn .8s linear infinite; }
@keyframes pv-turn { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .pv-spin, .spin { animation-duration: 2.4s; } }
.pv-frame { flex: 1 1 auto; width: 100%; min-height: 0; border: 0; background: #fff; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
@media (max-width: 640px) {
  .pv-tool { width: 44px; height: 44px; }
  .pv-open { min-height: 44px; flex-wrap: wrap; }
  .pv-note { display: none; }
}
</style>
