<!--
  The node window (ADM-1333, plan §3.3): a near-full-screen dialog with three resizable panes, Input, Settings and
  Output. Opened by double-click or Enter on a node (WorkflowBuilder mounts it).

    <WfNodeModal v-model:open="nodeOpen" :node-id="openNodeId" :doc="doc" :history="history" :run="run" :catalog="catalog" />

  Props: open, nodeId, doc (useWorkflowDoc), history (useWorkflowHistory), run (useWorkflowRun), catalog
  (useWorkflowCatalog); optional `validation` = the last Validate answer { errors, warnings }, shown beside the fields
  it names; `readOnly` (a viewer or runner: the settings are shown, never changed) and `canRun` (false hides the tests
  of the draft). Emits only update:open.

  - Every edit is history.run('Edit <field>', [{ op: 'update_node', … }]); typing in one field is one entry (D1 rule 1).
  - Each pane's width is remembered in this browser (localStorage, every access in try/catch). The dividers are
    role="separator" and move with the arrow keys. Below 900px wide the panes become tabs.
  - "Test this step" and "Run upstream (test)" run the DRAFT as a dry run up to a node (D4); the draft is saved first.
  - Focus is trapped in the window and given back to the opener on close (AppDialog).
-->
<template>
  <AppDialog
    :open="open"
    size="full"
    :title="title"
    :description="description"
    @update:open="setOpen"
  >
    <div class="wfm wf-tokens">
      <p v-if="!editor.node.value" class="wfm-gone" role="alert">This step is no longer in the workflow.</p>

      <template v-else>
        <div v-if="narrow" class="wfm-tabs" role="group" aria-label="Show pane">
          <button
            v-for="p in PANES" :key="p.id" type="button" class="wfm-tab" :aria-pressed="pane === p.id ? 'true' : 'false'"
            @click="pane = p.id"
          >{{ p.label }}</button>
        </div>

        <SplitterGroup
          v-if="!narrow"
          direction="horizontal"
          auto-save-id="wf-node-window-panes"
          :storage="paneStorage"
          :keyboard-resize-by="2"
          class="wfm-split"
        >
          <SplitterPanel id="wfm-input" :order="1" :default-size="26" :min-size="16" class="wfm-pane">
            <WfNodeInputPane :last-run-error="lastRunError" @reload-last-run="loadLastRun" />
          </SplitterPanel>
          <SplitterResizeHandle id="wfm-handle-1" class="wfm-handle" aria-label="Resize the Input and Settings panes" />
          <SplitterPanel id="wfm-settings" :order="2" :default-size="46" :min-size="28" class="wfm-pane wfm-pane--settings">
            <h3 class="wfm-pane-title"><Icon :icon="icon" class="wfm-type-ic" :style="{ color: accent }" aria-hidden="true" />Settings</h3>
            <ul v-if="topIssues.length" class="wfm-issues">
              <li v-for="i in topIssues" :key="i.message" :class="`wfm-issue--${i.level}`" :role="i.level === 'error' ? 'alert' : undefined">
                <Icon :icon="i.level === 'error' ? 'lucide:circle-alert' : 'lucide:triangle-alert'" aria-hidden="true" />{{ i.message }}
              </li>
            </ul>
            <NodeSettings :key="nodeId" />
          </SplitterPanel>
          <SplitterResizeHandle id="wfm-handle-2" class="wfm-handle" aria-label="Resize the Settings and Output panes" />
          <SplitterPanel id="wfm-output" :order="3" :default-size="28" :min-size="16" class="wfm-pane">
            <WfNodeOutputPane />
          </SplitterPanel>
        </SplitterGroup>

        <div v-else class="wfm-single">
          <WfNodeInputPane v-if="pane === 'input'" :last-run-error="lastRunError" @reload-last-run="loadLastRun" />
          <template v-else-if="pane === 'settings'">
            <ul v-if="topIssues.length" class="wfm-issues">
              <li v-for="i in topIssues" :key="i.message" :class="`wfm-issue--${i.level}`">{{ i.message }}</li>
            </ul>
            <NodeSettings :key="nodeId" />
          </template>
          <WfNodeOutputPane v-else />
        </div>
      </template>

      <p class="wfm-sr" aria-live="polite">{{ editor.announcement.value }}</p>
    </div>

    <template #footer>
      <p class="wfm-run" role="status">{{ runStatus }}</p>
      <button
        v-if="editor.node.value && canRun" type="button" class="wfm-btn wfm-btn--primary"
        :disabled="run.running.value || run.starting.value" @click="testThisStep"
      >
        <Icon :icon="run.starting.value ? 'lucide:loader-circle' : 'lucide:flask-conical'" :class="{ 'wfm-spin': run.starting.value }" aria-hidden="true" />
        {{ run.starting.value ? 'Starting…' : 'Test this step' }}
      </button>
      <button type="button" class="wfm-btn" @click="setOpen(false)">Done</button>
    </template>
  </AppDialog>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, toRef, watch } from 'vue'
import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from 'reka-ui'
import { Icon } from '@iconify/vue'
import AppDialog from '@/components/common/AppDialog.vue'
import { WF_CATEGORIES, wfCategory, wfIcon } from '@/config/wfNodeDefinitions'
import WfNodeInputPane from './WfNodeInputPane.vue'
import WfNodeOutputPane from './WfNodeOutputPane.vue'
import NodeSettings from './settings/NodeSettings.vue'
import { createNodeEditor, provideNodeEditor } from './settings/nodeEditor'

const props = defineProps({
  open: { type: Boolean, default: false },
  nodeId: { type: String, default: null },
  doc: { type: Object, required: true },
  history: { type: Object, required: true },
  run: { type: Object, required: true },
  catalog: { type: Object, default: null },
  validation: { type: Object, default: null },
  readOnly: { type: Boolean, default: false },
  canRun: { type: Boolean, default: true },
})
const emit = defineEmits(['update:open'])

const PANES = [{ id: 'input', label: 'Input' }, { id: 'settings', label: 'Settings' }, { id: 'output', label: 'Output' }]

const editor = createNodeEditor({
  nodeId: toRef(props, 'nodeId'), doc: props.doc, history: props.history, run: props.run, catalog: props.catalog,
  validation: () => props.validation, readOnly: () => props.readOnly, canRun: () => props.canRun,
})
provideNodeEditor(editor)
const run = props.run

const title = computed(() => editor.data.value.label || editor.def.value?.label || editor.type.value || 'Step')
const description = computed(() => (editor.node.value
  ? `${editor.def.value?.label || editor.type.value} step · id ${editor.node.value.id}`
  : ''))
const icon = computed(() => wfIcon(editor.type.value))
// The category colour token, with the app's ink when the builder's tokens are not in scope.
const accent = computed(() => `var(${WF_CATEGORIES[wfCategory(editor.type.value)].token}, var(--vm-ink-soft))`)
// The channel secret's and the approvers' findings are shown beside their own fields instead.
const topIssues = computed(() => editor.issues.value.filter((i) => i.path !== 'data.secret_var'
  && i.code !== 'config.secret_missing' && i.code !== 'config.secret_var_unknown' && !String(i.code || '').startsWith('approvers.')))

function setOpen(value) {
  if (!value) editor.end()
  emit('update:open', value)
}

// ── pane widths: remembered in this browser; a storage that throws (private mode, quota) is ignored ──
const paneStorage = {
  getItem(name) { try { return window.localStorage.getItem(name) } catch { return null } },
  setItem(name, value) { try { window.localStorage.setItem(name, value) } catch { /* the layout is kept for this visit */ } },
}

// ── narrow screens: tabs instead of three side-by-side panes ──
const narrow = ref(false)
const pane = ref('settings')
let mq = null
const onMq = () => { narrow.value = !!mq?.matches }
onMounted(() => {
  try { mq = window.matchMedia('(max-width: 899px)') } catch { mq = null }
  onMq()
  mq?.addEventListener?.('change', onMq)
})
onBeforeUnmount(() => {
  mq?.removeEventListener?.('change', onMq)
  editor.end()
})

// ── the last run's outputs (contract C4) ──
const lastRunError = ref('')
let lastRunAsked = false
async function loadLastRun() {
  lastRunError.value = ''
  try {
    await run.loadLastRun()
  } catch {
    lastRunError.value = 'Could not load the last run.'
  }
}
watch(() => props.open, (now) => {
  if (!now) return
  if (!lastRunAsked) { lastRunAsked = true; loadLastRun() }
  props.catalog?.load?.()
}, { immediate: true })
// A test that just ended is the new last run.
watch(() => run.running.value, (now, before) => { if (before && !now) loadLastRun() })

// ── tests run the draft (D4) ──
function testThisStep() { editor.testUpTo(props.nodeId) }

const runStatus = computed(() => {
  if (run.startError.value) return run.startError.value.message
  const live = run.live.value
  if (!live) return ''
  const target = live.untilNode ? ` up to ${live.untilNode}` : ''
  return `${live.dryRun ? 'Test' : 'Run'} #${live.id}${target}: ${live.status}.`
})
</script>

<style scoped>
.wfm { position: relative; display: flex; flex-direction: column; height: 100%; min-height: 0; font-family: var(--vm-font-sans, Inter, system-ui, sans-serif); }
.wfm-split { flex: 1; min-height: 0; }
.wfm-pane { min-width: 0; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 4px 12px 12px; }
.wfm-pane--settings { padding-inline: 16px; }
.wfm-pane-title { display: flex; align-items: center; gap: 6px; margin: 0 0 12px; font-size: 13px; font-weight: 600; color: var(--vm-ink); }
.wfm-type-ic { width: 16px; height: 16px; }
.wfm-handle {
  position: relative; flex: 0 0 9px; display: flex; justify-content: center; cursor: col-resize; background: none; outline: none;
}
.wfm-handle::after { content: ''; width: 1px; height: 100%; background: var(--vm-line); }
.wfm-handle:hover::after, .wfm-handle[data-state='drag']::after { width: 3px; background: var(--vm-primary-line); }
.wfm-handle:focus-visible::after { width: 3px; background: var(--vm-focus); }
.wfm-tabs { display: flex; gap: 2px; margin-bottom: 10px; border-bottom: 1px solid var(--vm-line); }
.wfm-tab {
  flex: 1; min-height: 44px; border: 0; border-bottom: 2px solid transparent; background: none; color: var(--vm-ink-soft);
  font: inherit; font-size: 13px; cursor: pointer;
}
.wfm-tab[aria-pressed='true'] { border-bottom-color: var(--vm-primary); color: var(--vm-ink); font-weight: 600; }
.wfm-tab:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: -2px; }
.wfm-single { flex: 1; min-height: 0; overflow: auto; }
.wfm-issues { display: grid; gap: 6px; margin: 0 0 12px; padding: 0; list-style: none; }
.wfm-issues li { display: flex; gap: 6px; align-items: flex-start; padding: 7px 9px; border-radius: 6px; font-size: 12px; line-height: 1.45; }
.wfm-issues li :deep(svg) { width: 14px; height: 14px; flex-shrink: 0; margin-top: 2px; }
.wfm-issue--error { background: var(--vm-red-soft); color: var(--vm-red-ink); }
.wfm-issue--warning { background: var(--vm-amber-soft); color: var(--vm-amber-ink); }
.wfm-gone { margin: 0; color: var(--vm-red-ink); }
.wfm-run { flex: 1; min-width: 0; margin: 0; align-self: center; font-size: 12px; color: var(--vm-ink-soft); }
.wfm-btn {
  display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 6px 12px; border: 1px solid var(--vm-line-2);
  border-radius: 6px; background: var(--vm-surface); color: var(--vm-ink); font: inherit; font-size: 13px; cursor: pointer;
}
.wfm-btn :deep(svg) { width: 16px; height: 16px; }
.wfm-btn:hover:not(:disabled) { background: var(--vm-surface-soft); }
.wfm-btn--primary { border-color: var(--vm-primary); background: var(--vm-primary); color: var(--wf-on-accent, #fff); font-weight: 600; }
.wfm-btn--primary:hover:not(:disabled) { background: var(--vm-primary-d); }
.wfm-btn:disabled { opacity: .55; cursor: not-allowed; }
.wfm-btn:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; }
.wfm-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
@media (prefers-reduced-motion: no-preference) { .wfm-spin { animation: wfm-spin 1s linear infinite; } }
@keyframes wfm-spin { to { transform: rotate(360deg); } }
@media (pointer: coarse) { .wfm-btn { min-height: 44px; } .wfm-handle { flex-basis: 16px; } }
</style>
