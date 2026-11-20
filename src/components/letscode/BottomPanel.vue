<template>
  <div ref="root" class="bp">
    <div class="bp-tabs" role="tablist" aria-label="Workspace output">
      <button
        v-for="t in tabs" :key="t.id" type="button" role="tab" class="bp-tab" :class="{ on: tab === t.id }"
        :aria-selected="tab === t.id ? 'true' : 'false'" :title="t.label" @click="selectTab(t.id)"
      ><Icon :icon="t.icon" class="bp-tab-ic" aria-hidden="true" /><span class="bp-tab-t">{{ t.label }}</span><span
        v-if="t.count" class="bp-tab-n" aria-hidden="true">{{ t.count }}</span></button>
      <button type="button" class="bp-collapse" :title="collapsed ? 'Expand' : 'Collapse'" :aria-label="collapsed ? 'Expand the output panel' : 'Collapse the output panel'" :aria-expanded="collapsed ? 'false' : 'true'" @click="$emit('toggle')">
        <Icon :icon="collapsed ? 'lucide:chevron-up' : 'lucide:chevron-down'" />
      </button>
    </div>
    <div v-show="!collapsed && (tab === 'log' || tab === 'activity')" ref="body" class="bp-body vm-scroll" role="tabpanel" tabindex="0">
      <pre v-if="lines.length"><span v-for="(l, i) in lines" :key="i" class="ln" :class="lineClass(l)">{{ l }}</span></pre>
      <div v-else class="bp-empty">{{ tab === 'activity' ? 'The coding agent has not run a tool yet.' : 'No log lines yet.' }}</div>
    </div>
    <!-- Problems and References (ADM-1205 phase F item 16): the project's language servers, through the editor. -->
    <div v-if="languages" v-show="!collapsed && (tab === 'problems' || tab === 'references')" class="bp-body vm-scroll" role="tabpanel" tabindex="0">
      <ProblemsPanel :mode="tab === 'references' ? 'references' : 'problems'" />
    </div>
    <!-- The Debug Console (ADM-1205 phase F item 17). -->
    <div v-if="dbg" v-show="!collapsed && tab === 'debug-console'" class="bp-body" role="tabpanel">
      <DebugConsole />
    </div>
    <!-- Built the first time the Terminal tab is opened, then kept: switching tabs never ends a shell (ADM-1196). -->
    <div v-if="terminalOpened && repoId" v-show="!collapsed && tab === 'terminal'" class="bp-term" role="tabpanel">
      <TerminalPanel ref="terminalPanel" :repo-id="repoId" :ready="ready" :agent-commands="agentCommands" :maximized="maximized"
                     @maximize="$emit('maximize')" />
    </div>
    <!-- The Preview tab (ADM-1205 phase D): built the first time it is opened, then kept, so an app stays loaded. -->
    <div v-if="previewOpened && repoId" v-show="!collapsed && tab === 'preview'" class="bp-term" role="tabpanel">
      <PreviewPanel ref="previewPanel" :repo-id="repoId" :ready="ready" :maximized="maximized" @maximize="$emit('maximize')" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, inject, onMounted, onBeforeUnmount } from 'vue'
import { Icon } from '@iconify/vue'
import TerminalPanel from './TerminalPanel.vue'
import { terminalShortcut } from './terminalKeys'
import PreviewPanel from './PreviewPanel.vue'
import ProblemsPanel from './ProblemsPanel.vue'
import DebugConsole from './DebugConsole.vue'
import { LANGUAGE_SERVERS } from '@/stores/useLanguageServers'
import { DEBUGGER } from '@/stores/useDebugger'

const props = defineProps({
  pipelineLog: { type: Array, default: () => [] },
  activity: { type: Array, default: () => [] },
  collapsed: { type: Boolean, default: false },
  // The Terminal tab (ADM-1196, Phase 3): the project, whether it is ready, and the Coding Agent's commands.
  repoId: { type: Number, default: 0 },
  ready: { type: Boolean, default: false },
  agentCommands: { type: Array, default: () => [] },
  // The panel fills the editor's column (the terminal's Maximize, ADM-1211).
  maximized: { type: Boolean, default: false },
})
const emit = defineEmits(['toggle', 'maximize'])

// Log = the project's clone/index pipeline log; Activity = the coding agent's tool calls; Terminal = shells in the
// project's sandbox and the commands the Coding Agent ran; Preview = the project's running ports and an app on one;
// Problems / References = what the project's language servers report (where the Let's Code page provides them).
const languages = inject(LANGUAGE_SERVERS, null)
const dbg = inject(DEBUGGER, null)
const problemCount = computed(() => (languages ? languages.problems.value.length : 0))
const tabs = computed(() => [
  ...(languages ? [{ id: 'problems', label: problemCount.value ? `Problems (${problemCount.value})` : 'Problems',
    icon: 'lucide:circle-alert', count: problemCount.value },
  { id: 'references', label: 'References', icon: 'lucide:text-search' }] : []),
  ...(dbg ? [{ id: 'debug-console', label: 'Debug Console', icon: 'lucide:bug' }] : []),
  { id: 'log', label: 'Log', icon: 'lucide:scroll-text' },
  { id: 'activity', label: 'Activity', icon: 'lucide:activity' },
  ...(props.repoId ? [{ id: 'terminal', label: 'Terminal', icon: 'lucide:square-terminal' },
    { id: 'preview', label: 'Preview', icon: 'lucide:monitor-play' }] : []),
])
const tab = ref('log')
const body = ref(null)
const terminalOpened = ref(false)
const previewOpened = ref(false)
const previewPanel = ref(null)

function selectTab(id) {
  tab.value = id
  if (id === 'terminal') terminalOpened.value = true
  if (id === 'preview') previewOpened.value = true
  if (props.collapsed) emit('toggle')
}

// The chat's "Open preview": the Preview tab, on that port.
async function openPreview(port) {
  selectTab('preview')
  await nextTick()
  previewPanel.value?.openPort(port)
}
defineExpose({ openPreview })

// ── The Terminal's shortcuts, as in VS Code (ADM-1325) ─────────────────────────────────────────────────────────
// Ctrl+`: the panel opens on the Terminal, or, when it already shows the Terminal, closes. Ctrl+Shift+`: a new shell
// (the first opening of the Terminal opens its shells as usual, so it never adds a second one at once). Heard on the
// page after everything else: a key the editor (Monaco) or a field already handled is left alone, and a terminal lets
// only these two through to here (ProjectTerminal).
const root = ref(null)
const terminalPanel = ref(null)
async function onShortcut(e) {
  if (!props.repoId || e.defaultPrevented) return
  const which = terminalShortcut(e)
  if (!which) return
  e.preventDefault()
  if (e.repeat) return
  if (which === 'toggle' && !props.collapsed && tab.value === 'terminal') {
    // Closed: the focus leaves the hidden terminal instead of staying in it.
    if (root.value && root.value.contains(document.activeElement)) document.activeElement.blur?.()
    emit('toggle')
    return
  }
  const built = terminalOpened.value
  selectTab('terminal')
  await nextTick()
  if (which === 'new' && built) terminalPanel.value?.addShell()
  await nextTick()
  terminalPanel.value?.focus()
}
onMounted(() => window.addEventListener('keydown', onShortcut))
onBeforeUnmount(() => window.removeEventListener('keydown', onShortcut))

// The editor's Find All References (Shift+F12) shows its results here.
if (languages) watch(() => languages.panel.value.at, () => { if (languages.panel.value.tab) selectTab(languages.panel.value.tab) })
// Starting a debug session shows its console.
if (dbg) watch(() => dbg.panel.value.at, () => { if (dbg.panel.value.tab) selectTab(dbg.panel.value.tab) })

const lines = computed(() => (tab.value === 'activity' ? props.activity : props.pipelineLog))
function lineClass(l) {
  if (/\[error\]|error|failed/i.test(l)) return 'err'
  if (/\[crs\]|\[clone\]|ready|done/i.test(l)) return 'ok'
  return ''
}
watch(lines, () => nextTick(() => { const e = body.value; if (e) e.scrollTop = e.scrollHeight }), { deep: true })
</script>

<style scoped>
.bp { display: flex; flex-direction: column; height: 100%; background: var(--vm-surface); color: var(--vm-ink-soft); border-top: 1px solid var(--vm-line); }
.bp-tabs { display: flex; align-items: center; gap: 2px; padding: 0 8px; border-bottom: 1px solid var(--vm-line); flex: 0 0 auto; }
.bp-tab { background: transparent; border: none; color: var(--vm-ink-soft); font: 600 12.5px var(--vm-font-sans); padding: 10px 12px 8px; cursor: pointer; border-bottom: 2px solid transparent; transition: color .15s, border-color .15s; }
.bp-tab:hover { color: var(--vm-ink); }
.bp-tab.on { color: var(--vm-ink); border-bottom-color: var(--vm-violet); }
.bp-collapse { margin-left: auto; display: grid; place-items: center; width: 30px; height: 30px; background: transparent; border: none; border-radius: 6px; color: var(--vm-ink-soft); cursor: pointer; }
.bp-collapse:hover { background: var(--vm-surface-soft); color: var(--vm-ink); }
.bp-collapse :deep(svg) { width: 16px; height: 16px; }
.bp-body { flex: 1; min-height: 0; overflow: auto; padding: 10px 14px; }
.bp-body pre { margin: 0; font: 12px/1.6 var(--vm-font-mono); white-space: pre-wrap; word-break: break-word; }
.ln { display: block; }
.ln.ok { color: color-mix(in srgb, var(--vm-green) 62%, var(--vm-ink)); }
.ln.err { color: var(--vm-danger); }
.bp-empty { color: var(--vm-ink-faint); font-size: 13px; }
.bp-term { flex: 1; min-height: 0; }
/* Wide: the tabs' names. 640 px and less: their icons, one row with no sideways scroll; the name stays for screen
   readers and in the title, and Problems shows its count (ADM-1267, 2026-11-17). */
.bp-tab-ic, .bp-tab-n { display: none; }
@media (max-width: 640px) {
  .bp-tabs { padding: 0 4px; }
  .bp-tab { min-height: 44px; flex: 1 1 0; min-width: 0; padding: 0; display: inline-flex; align-items: center; justify-content: center; gap: 3px; }
  .bp-tab-ic { display: block; width: 18px; height: 18px; }
  .bp-tab-n { display: inline-block; font: 700 10px/16px var(--vm-font-sans); min-width: 16px; padding: 0 4px; border-radius: 8px; background: var(--vm-violet); color: white; }
  .bp-tab-t { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
  .bp-collapse { width: 44px; height: 44px; flex: 0 0 auto; }
}
</style>
