<!--
  The Workflow Builder page (ADM-1333). A thin page: it creates the document, its history, the run state, the tool
  catalog and the agent's proposal, and wires them to the parts that draw and edit them:

    WfToolbar     the one floating row (plan §3.1)
    WfCanvas      the graph (§3.2); Vue Flow only draws the document
    WfConsole     Log, Runs and Timeline at the bottom
    WfNodePicker  add a step; WfNodeModal edits one; WfAgentBar proposes changes
    WfOutline     the same workflow as a keyboard list (§3.6); WfShortcuts lists the keys (§3.5)

  The canvas fills the page: the shell hides its breadcrumbs and help button and collapses its sidebar on this route
  (AppShell), so the page never scrolls (F1).

  ROLES (ADM-1339). The server sends the person's role on the workflow (`my_role`) and enforces it on every request.
  The page only follows it: a viewer sees the workflow read-only (no edit, no add step, no Save or Publish, no Test or
  Run); a runner sees it read-only but may Test and Run; an editor has everything but Share and Archive, which are the
  owner's (WfShareDialog). A refusal the server still sends (403 forbidden_role) is shown in its own words.

  STEPS FROM THE SERVER (ADM-1351, D4). The step types come from GET /api/workflow-graphs/step-types/, read once per
  page session (config/wfStepRegistry.js) before the canvas, the picker and the node window are drawn (the canvas
  builds its node types when it is set up). While it loads the page says so; a failed read is shown with Try again.
  There is no bundled copy to fall back to.

  RUN WITH INPUTS. A manual trigger's input of type `image` asks for a photo (JPEG, PNG or WebP up to 15 MB): each is
  uploaded for this workflow (POST /workflow-graphs/<id>/images/) and the run's payload carries the image reference
  the server returned. A run, or a test from the node window, of a workflow with an image input always asks.
-->
<template>
  <div class="wfb-root" :class="{ 'is-compact': compact }">
    <h1 class="wf-sr">{{ doc.name.value || 'Workflow' }}: workflow builder</h1>
    <div class="wfb-stage">
      <WfCanvas
        v-if="steps.ready"
        ref="canvas"
        :doc="doc"
        :history="history"
        :run="run"
        :proposal="proposal"
        :read-only="editLocked"
        :can-run="can.run"
        @open="openNode"
        @pick="openPicker"
        @test-until="(id) => startRun({ dryRun: true, untilNode: id })"
        @rename="renameNode"
        @duplicate="(id) => duplicate([id])"
        @remove="remove"
        @toggle-off="toggleOff"
        @announce="announce"
      />

      <WfToolbar
        ref="toolbar"
        class="wfb-stage__toolbar"
        :name="doc.name.value"
        :status="doc.meta.status"
        :version="doc.meta.version"
        :save-state="saveState"
        :dirty="doc.dirty.value"
        :loading="doc.loading.value"
        :disabled="actionsDisabled"
        :can-undo="history.canUndo.value"
        :can-redo="history.canRedo.value"
        :undo-label="history.undoLabel.value"
        :redo-label="history.redoLabel.value"
        :running="run.running.value"
        :stopping="run.stopping.value"
        :compact="compact"
        :mod="mod"
        :role="toolbarRole"
        @back="goBack"
        @rename="renameWorkflow"
        @save="doc.save()"
        @discard="doc.discard()"
        @add="openPicker(null)"
        @undo="undo"
        @redo="redo"
        @tidy="tidy"
        @fit="canvas?.fit()"
        @test="startRun({ dryRun: true })"
        @run="startRun({ dryRun: false })"
        @stop="run.stop()"
        @publish="doc.publish()"
        @validate="validate"
        @versions="openVersions"
        @pause="setLifecycle('paused')"
        @resume="setLifecycle('published')"
        @duplicate="duplicateWorkflow"
        @outline="outlineOpen = true"
        @shortcuts="shortcutsOpen = true"
        @help="openAssistant()"
        @archive="archiveWorkflow"
        @share="shareOpen = true"
      />

      <div v-if="steps.error" class="wfb-overlay" role="alert">
        <div class="wfb-card">
          <Icon icon="lucide:cloud-off" class="wfb-card__icon" aria-hidden="true" />
          <p class="wfb-card__title">{{ steps.error }}</p>
          <p class="wfb-card__text">The builder needs the list of steps to draw this workflow.</p>
          <button type="button" class="wfb-btn is-primary" :disabled="steps.loading" @click="loadSteps">Try again</button>
        </div>
      </div>
      <div v-else-if="doc.loadError.value" class="wfb-overlay" role="alert">
        <div class="wfb-card">
          <Icon icon="lucide:cloud-off" class="wfb-card__icon" aria-hidden="true" />
          <p class="wfb-card__title">{{ doc.loadError.value }}</p>
          <button type="button" class="wfb-btn is-primary" @click="load">Try again</button>
        </div>
      </div>
      <div v-else-if="doc.loading.value || !steps.ready" class="wfb-overlay" role="status" aria-live="polite">
        <span class="wfb-card is-quiet"><Icon icon="lucide:loader-circle" class="wf-spin" aria-hidden="true" />{{ doc.loading.value ? 'Loading workflow…' : 'Loading the steps…' }}</span>
      </div>
      <div v-else-if="!doc.nodes.value.length && !can.edit" class="wfb-overlay is-passive">
        <div class="wfb-card">
          <Icon icon="lucide:workflow" class="wfb-card__icon" aria-hidden="true" />
          <h2 class="wfb-card__title">No steps yet</h2>
          <p class="wfb-card__text">The people who can edit this workflow have not added any steps.</p>
        </div>
      </div>
      <div v-else-if="!doc.nodes.value.length" class="wfb-overlay is-passive">
        <div class="wfb-card">
          <Icon icon="lucide:workflow" class="wfb-card__icon" aria-hidden="true" />
          <h2 class="wfb-card__title">Build your first workflow</h2>
          <p class="wfb-card__text">Start with a trigger, then add the steps it runs.</p>
          <div class="wfb-card__actions">
            <button v-for="s in STARTERS" :key="s" type="button" class="wfb-btn" @click="addType(s)">
              <Icon :icon="wfIcon(s)" aria-hidden="true" />{{ wfDef(s).label }}
            </button>
          </div>
          <button type="button" class="wfb-link-btn" @click="openPicker(null)">Browse every step ({{ mod }}+K)</button>
        </div>
      </div>

      <WfAgentBar v-if="doc.meta.id != null && can.edit" :doc="doc" :history="history" :proposal="proposal" :graph-id="doc.meta.id" />
    </div>

    <WfConsole
      v-if="steps.ready"
      ref="consoleEl"
      :open="consoleOpen"
      @update:open="setConsoleOpen"
      v-model:height="consoleHeight"
      :run="run"
      :doc="doc"
      :graph-id="graphId"
      :sheet="consoleAsSheet"
      :can-run="can.run"
      @focus-node="focusNode"
      @rerun="rerunFailed"
    />

    <WfNodePicker v-if="steps.ready" v-model:open="pickerOpen" :ctx="pickerCtx" :catalog="catalog" :agents="doc.agents.value" @choose="addFromPicker" />
    <WfNodeModal v-if="steps.ready" v-model:open="modalOpen" :node-id="modalNodeId" :doc="doc" :history="history" :run="run" :catalog="catalog" :validation="validation.data || null" :read-only="editLocked" :can-run="can.run" :ask-inputs="startRun" />
    <WfOutline v-if="steps.ready" v-model:open="outlineOpen" :doc="doc" :run="run" @open-node="(id) => { outlineOpen = false; openNode(id) }" @focus-node="(id) => { outlineOpen = false; focusNode(id) }" />
    <WfShortcuts v-model:open="shortcutsOpen" :mod="mod" />
    <WfShareDialog v-if="can.share" v-model:open="shareOpen" :graph-id="graphId" :name="doc.name.value" />

    <AppDialog v-model:open="inputsOpen" title="Run with inputs" description="Values for this run only. The defaults come from the manual trigger." size="sm">
      <form id="wfb-run-inputs" class="wfb-root wfb-layer wfb-form" novalidate @submit.prevent="submitInputs">
        <div v-for="f in inputFields" :key="f.key" class="wfb-field">
          <label class="wfb-field__label" :for="`wfb-in-${f.key}`" translate="no">{{ f.key }}<template v-if="f.type === 'image'"> (photo)</template></label>
          <input
            v-if="f.type === 'image'" :id="`wfb-in-${f.key}`" type="file" class="wfb-input wfb-file" :name="f.key"
            :accept="IMAGE_TYPES.join(',')" required :disabled="uploading"
            :aria-describedby="`wfb-in-${f.key}-help${inputErrors[f.key] ? ` wfb-in-${f.key}-err` : ''}`"
            :aria-invalid="inputErrors[f.key] ? 'true' : undefined"
            @change="pickFile(f.key, $event)"
          />
          <input v-else :id="`wfb-in-${f.key}`" v-model="inputValues[f.key]" class="wfb-input" :name="f.key" autocomplete="off" :disabled="uploading" />
          <p v-if="f.type === 'image'" :id="`wfb-in-${f.key}-help`" class="wfb-field__help">A JPEG, PNG or WebP photo, up to 15 MB.</p>
          <p v-if="inputErrors[f.key]" :id="`wfb-in-${f.key}-err`" class="wfb-field__error" role="alert">
            <Icon icon="lucide:circle-alert" aria-hidden="true" /><span>{{ inputErrors[f.key] }}</span>
          </p>
        </div>
        <p v-if="uploading" class="wfb-field__help" role="status">Uploading the photo…</p>
      </form>
      <template #footer>
        <button type="button" class="wfb-btn" @click="inputsOpen = false">Cancel</button>
        <button type="submit" form="wfb-run-inputs" class="wfb-btn is-primary" :disabled="run.starting.value || uploading">{{ uploading ? 'Uploading…' : pendingRun?.dryRun ? 'Start test' : 'Start run' }}</button>
      </template>
    </AppDialog>

    <AppDialog v-model:open="renameOpen" title="Rename step" size="sm">
      <form id="wfb-rename" class="wfb-root wfb-layer wfb-form" @submit.prevent="submitRename">
        <label class="wfb-field">
          <span class="wfb-field__label">Name</span>
          <input ref="renameInput" v-model="renameValue" class="wfb-input" name="step-name" autocomplete="off" maxlength="120" :placeholder="renamePlaceholder" />
        </label>
        <p class="wfb-field__help">Leave it empty to use the step type's name.</p>
      </form>
      <template #footer>
        <button type="button" class="wfb-btn" @click="renameOpen = false">Cancel</button>
        <button type="submit" form="wfb-rename" class="wfb-btn is-primary">Rename</button>
      </template>
    </AppDialog>

    <AppDialog v-model:open="validateOpen" title="Validate" :description="validationSummary" size="lg">
      <div class="wfb-root wfb-layer wfb-validate">
        <p v-if="validation.loading" role="status">Checking the workflow…</p>
        <template v-else>
          <p v-if="validation.inputError" class="wfb-validate__error" role="alert">
            <Icon icon="lucide:circle-alert" aria-hidden="true" />
            <span><strong v-if="validation.nodeId" translate="no">{{ validation.nodeId }}: </strong>{{ validation.inputError }}</span>
          </p>
          <p v-if="validation.requestError" class="wfb-validate__error" role="alert">
            <Icon icon="lucide:circle-alert" aria-hidden="true" /><span>{{ validation.requestError }}</span>
          </p>
          <p v-if="validation.data?.ok" class="wfb-validate__ok" role="status"><Icon icon="lucide:circle-check" aria-hidden="true" />The workflow is valid.</p>
          <section v-if="validation.data?.errors?.length" aria-labelledby="wfb-val-errors">
            <h3 id="wfb-val-errors" class="wfb-validate__h">Problems ({{ validation.data.errors.length }})</h3>
            <ul class="wfb-validate__list">
              <li v-for="(e, i) in validation.data.errors" :key="`e${i}`" class="is-error">
                <span><strong v-if="e.node_id" translate="no">{{ e.node_id }}: </strong>{{ e.message || e }}</span>
                <button v-if="e.node_id && hasNode(e.node_id)" type="button" class="wfb-link-btn" @click="validateOpen = false; focusNode(e.node_id)">Show the step</button>
              </li>
            </ul>
          </section>
          <section v-if="validation.data?.warnings?.length" aria-labelledby="wfb-val-warnings">
            <h3 id="wfb-val-warnings" class="wfb-validate__h">Warnings ({{ validation.data.warnings.length }})</h3>
            <ul class="wfb-validate__list">
              <li v-for="(w, i) in validation.data.warnings" :key="`w${i}`" class="is-warn">
                <span><strong v-if="w.node_id" translate="no">{{ w.node_id }}: </strong>{{ w.message || w }}</span>
              </li>
            </ul>
          </section>
          <details v-if="validation.response" class="wfb-validate__json">
            <summary>The server's answer (JSON)</summary>
            <pre translate="no">{{ validation.response }}</pre>
          </details>
          <details v-if="validation.graph" class="wfb-validate__json">
            <summary>The workflow that was checked (JSON)</summary>
            <pre translate="no">{{ validation.graph }}</pre>
          </details>
        </template>
      </div>
      <template #footer>
        <button type="button" class="wfb-btn" @click="validateOpen = false">Close</button>
        <button type="button" class="wfb-btn is-primary" :disabled="validation.loading" @click="validate">Check again</button>
      </template>
    </AppDialog>

    <AppSheet v-model:open="versionsOpen" title="Versions" description="Each publish freezes a version. Restoring one puts it on the draft; triggers keep the published version until you publish." side="right" size="md">
      <div class="wfb-root wfb-layer wfb-versions">
        <p v-if="versions.error" class="wfb-console__error" role="alert">{{ versions.error }} <button type="button" class="wfb-btn is-small" @click="loadVersions()">Try again</button></p>
        <p v-else-if="versions.loading && !versions.rows.length" class="wfb-console__empty" role="status">Loading versions…</p>
        <p v-else-if="versions.loaded && !versions.rows.length" class="wfb-console__empty">No versions yet. Publish to freeze one.</p>
        <ul v-if="versions.rows.length" class="wfb-run-list">
          <li v-for="v in versions.rows" :key="v.id" class="wfb-version">
            <span class="wfb-version__num">v{{ v.version }}</span>
            <span class="wfb-version__label">{{ v.label || 'Published' }}</span>
            <time class="wfb-version__time" :datetime="v.created_at">{{ fmtDate(v.created_at) }}</time>
            <button v-if="can.edit" type="button" class="wfb-btn is-small" :disabled="doc.saving.value" :aria-label="`Restore version ${v.version}`" @click="restore(v)">Restore</button>
          </li>
        </ul>
        <button v-if="versions.more" type="button" class="wfb-btn is-small" :disabled="versions.loading" @click="loadVersions({ more: true })">{{ versions.loading ? 'Loading…' : 'Load more versions' }}</button>
      </div>
    </AppSheet>

    <div class="wf-sr" aria-live="polite" aria-atomic="true">{{ announcement }}</div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import '@/components/workflows/workflow-builder.css'
import WfCanvas from '@/components/workflows/WfCanvas.vue'
import WfToolbar from '@/components/workflows/WfToolbar.vue'
import WfConsole from '@/components/workflows/WfConsole.vue'
import WfNodePicker from '@/components/workflows/WfNodePicker.vue'
import WfOutline from '@/components/workflows/WfOutline.vue'
import WfShortcuts from '@/components/workflows/WfShortcuts.vue'
import WfAgentBar from '@/components/workflows/WfAgentBar.vue'
import WfNodeModal from '@/components/workflows/WfNodeModal.vue'
import WfShareDialog from '@/components/workflows/WfShareDialog.vue'
import AppDialog from '@/components/common/AppDialog.vue'
import AppSheet from '@/components/common/AppSheet.vue'
import { useWorkflowDoc } from '@/composables/useWorkflowDoc'
import { useWorkflowHistory } from '@/composables/useWorkflowHistory'
import { useWorkflowRun } from '@/composables/useWorkflowRun'
import { useWorkflowCatalog } from '@/composables/useWorkflowCatalog'
import { useWorkflowProposal } from '@/composables/useWorkflowProposal'
import { setBreadcrumbLabel } from '@/composables/useBreadcrumbs'
import { useHelpAssistant } from '@/composables/useHelpAssistant'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import api from '@/services/api'
import { stepRegistryReady, wfDef, wfIcon } from '@/config/wfNodeDefinitions'
import { loadStepRegistry } from '@/config/wfStepRegistry'
import { serverSentence, workflowAbilities } from '@/utils/workflowAccess'
import { deleteSelection } from '@/utils/wfFlow'
import { WorkflowInputError } from '@/utils/workflowInput'
import { freeWorkflowPosition } from '@/utils/workflowNodePlacement'
import { hydrateNode, serializeNode, nodeTitle, toggleOffOps } from '@/components/workflows/wfNodeData'
import { createNode, connectOps, placeFor, pushRecent } from '@/components/workflows/wfPickerItems'
import { copyText, parseClip, pasteOps } from '@/components/workflows/wfClipboard'
import { resolveShortcut, isTypingTarget, isComboboxTarget, neighbourId, NUDGE } from '@/components/workflows/wfKeyboard'


const route = useRoute()
const router = useRouter()
const graphId = route.params.id

const doc = useWorkflowDoc(graphId, { hydrateNode, serializeNode })
const history = useWorkflowHistory(doc)
const consoleEl = ref(null)
const run = useWorkflowRun(graphId, { ensureSaved: () => doc.saveIfDirty(), onRunEnd: () => consoleEl.value?.refresh() })
const catalog = useWorkflowCatalog()
const proposal = useWorkflowProposal(doc, history)
const { openAssistant } = useHelpAssistant()
setBreadcrumbLabel(() => doc.name.value)

const canvas = ref(null)
const toolbar = ref(null)
const STARTERS = ['trigger.manual', 'trigger.schedule', 'trigger.webhook', 'agent.run', 'action.http']
const mod = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '') ? '⌘' : 'Ctrl'

// ── width is watched, not read once (plan §3.1) ──
const width = ref(window.innerWidth)
function onResize() { width.value = window.innerWidth }
const compact = computed(() => width.value < 640)
const consoleAsSheet = computed(() => width.value < 1024)

// ── the step registry (ADM-1351, D4): read before anything that draws a step ──
const steps = reactive({ ready: stepRegistryReady(), loading: false, error: '' })
let stepsLoad = Promise.resolve()
function loadSteps() {
  if (steps.ready) return stepsLoad
  steps.loading = true
  steps.error = ''
  stepsLoad = loadStepRegistry().then(() => { steps.ready = true }).catch((e) => { steps.error = e?.message || 'The step list could not be loaded.' })
    .finally(() => { steps.loading = false })
  return stepsLoad
}

// ── state shown in the toolbar ──
const locked = computed(() => doc.loading.value || !!doc.loadError.value || !steps.ready)
// What the person's role allows (the server's `my_role`; the server enforces it). Nothing is editable while the page
// is loading or failed to load, nor for a viewer or runner.
const can = computed(() => workflowAbilities(doc.meta.myRole))
const editLocked = computed(() => locked.value || !can.value.edit)
// Until the workflow is loaded the toolbar keeps its full (disabled) row; then it shows what the role allows.
const toolbarRole = computed(() => (locked.value ? 'owner' : doc.meta.myRole))
const shareOpen = ref(false)
const actionsDisabled = computed(() => locked.value || doc.saving.value || run.starting.value)
const saveState = computed(() => {
  if (doc.loading.value) return 'loading'
  if (doc.loadError.value) return 'error'
  if (doc.saving.value) return 'saving'
  if (doc.conflict.value) return 'conflict'
  return doc.dirty.value ? 'dirty' : 'saved'
})

// ── console ──
// It starts as the collapsed 36 px strip while the workflow has no run: an open, empty console only takes room.
// Once there is a run, the person's own choice (opened or closed with the strip's button or L) is remembered in this
// browser. A run that starts opens it, unless the person closed it themselves. Storage can be refused (private mode):
// then nothing is remembered and the defaults apply.
const CONSOLE_KEY = 'wfb_console_v2'
function readConsolePrefs() {
  try { return JSON.parse(localStorage.getItem(CONSOLE_KEY) || '{}') || {} } catch { return {} }
}
function writeConsolePrefs(patch) {
  try { localStorage.setItem(CONSOLE_KEY, JSON.stringify({ ...readConsolePrefs(), ...patch })) } catch { /* not remembered */ }
}
const consolePrefs = readConsolePrefs()
const consoleChoice = ref(consolePrefs.choice === 'open' || consolePrefs.choice === 'closed' ? consolePrefs.choice : null)
const consoleOpen = ref(false)
const consoleHeight = ref(Number.isFinite(consolePrefs.height) ? consolePrefs.height : 240)
watch(consoleHeight, (height) => writeConsolePrefs({ height }))
const hasRun = computed(() => !!(doc.meta.lastRun || run.live.value))
/** The person opened or closed the console: their choice, remembered. */
function setConsoleOpen(open) {
  consoleOpen.value = open
  consoleChoice.value = open ? 'open' : 'closed'
  writeConsolePrefs({ choice: consoleChoice.value })
}

// ── live region ──
const announcement = ref('')
function announce(text) {
  if (!text) return
  announcement.value = ''
  nextTick(() => { announcement.value = text })
}
watch(() => run.live.value && `${run.live.value.id}:${run.live.value.status}`, (key) => {
  if (key) announce(`Run ${key.replace(':', ' is ')}.`)
})

// ── loading ──
async function load() {
  if (!(await doc.load())) return
  run.attach(doc.meta.lastRun)
  // Never as a sheet on load: below 1024 px the console is a dialog, opened only by the person.
  consoleOpen.value = hasRun.value && consoleChoice.value === 'open' && !consoleAsSheet.value
  // The console (and its Timeline) is drawn once the steps are known.
  await stepsLoad
  await nextTick()
  await openLinkedRun()
}

// A link with ?run=<id> (the bell notification of an approval waiting on this person, ADM-1339) opens that run: a run
// still waiting is followed live, so its Approve and Reject are here; a finished one is shown in the Timeline.
async function openLinkedRun() {
  const id = Number(route.query?.run)
  if (!Number.isInteger(id) || id <= 0) return
  if (!(await run.openRun(id))) return
  if (consoleAsSheet.value) setConsoleOpen(true)
  else consoleOpen.value = true
  await nextTick()
  consoleEl.value?.showTab('timeline')
}

// ── editing through the history ──
function apply(label, ops) {
  try {
    history.run(label, ops)
    return true
  } catch (e) {
    notify.error(e.message)
    return false
  }
}
function undo() { if (!editLocked.value && history.undo()) announce('Undone.') }
function redo() { if (!editLocked.value && history.redo()) announce('Redone.') }
function renameWorkflow(name) { apply('Rename workflow', [{ op: 'set_name', name }]) }
const hasNode = (id) => doc.nodes.value.some((n) => n.id === id)
const titleOf = (id) => { const n = doc.nodes.value.find((x) => x.id === id); return n ? nodeTitle(n.type, n.data) : id }

function tidy() {
  if (editLocked.value) return
  const n = canvas.value?.tidy() || 0
  announce(n ? `Tidied ${n === 1 ? '1 step' : `${n} steps`}.` : 'The workflow is already tidy.')
}

// ── picker ──
const pickerOpen = ref(false)
const pickerCtx = ref(null)
function openPicker(ctx) {
  if (editLocked.value) return
  let next = ctx
  if (!next) {
    // With one step selected, a step added from the keyboard or the toolbar follows it (and is connected).
    const ids = canvas.value?.selectedIds().nodeIds || []
    const only = ids.length === 1 && doc.nodes.value.find((n) => n.id === ids[0])
    next = only ? { mode: 'from', source: { nodeId: only.id, handle: only.type === 'logic.condition' ? 'true' : null } } : { mode: 'free' }
  }
  pickerCtx.value = next
  pickerOpen.value = true
}
function addFromPicker({ item, agent }) {
  const ctx = pickerCtx.value || { mode: 'free' }
  let position = ctx.position
  if (!position && ctx.mode === 'free') {
    try { const c = canvas.value.visibleCenter(); position = { x: c.x - 100, y: c.y - 32 } } catch { position = { x: 0, y: 0 } }
  }
  const nodes = doc.nodes.value
  let node
  let ops
  try {
    node = createNode(item, { existingIds: nodes.map((n) => n.id), position: placeFor({ ...ctx, position }, nodes, doc.edges.value), agent })
    ops = connectOps(ctx, node, doc.edges.value)
  } catch (e) {
    notify.error(e.message)
    return
  }
  if (!apply(ctx.mode === 'insert' ? 'Insert step' : 'Add step', ops)) return
  pushRecent(item.id)
  pickerOpen.value = false
  announce(`Added ${nodeTitle(node.type, node.data)}.`)
  nextTick(() => {
    canvas.value?.select([node.id])
    openNode(node.id)
  })
}
function addType(type) { addFromPicker({ item: { id: `node:${type}`, kind: 'node', nodeType: type } }) }

// ── node window ──
const modalOpen = ref(false)
const modalNodeId = ref(null)
function openNode(id) {
  if (!hasNode(id)) return
  modalNodeId.value = id
  modalOpen.value = true
}

// ── rename a step (F2) ──
const renameOpen = ref(false)
const renameId = ref(null)
const renameValue = ref('')
const renameInput = ref(null)
const renamePlaceholder = computed(() => { const n = doc.nodes.value.find((x) => x.id === renameId.value); return n ? (wfDef(n.type)?.label || n.type) : '' })
function renameNode(id) {
  const n = doc.nodes.value.find((x) => x.id === id)
  if (!n || editLocked.value) return
  renameId.value = id
  renameValue.value = n.data?.label || ''
  renameOpen.value = true
  nextTick(() => renameInput.value?.select())
}
function submitRename() {
  const id = renameId.value
  const v = renameValue.value.trim()
  const n = doc.nodes.value.find((x) => x.id === id)
  renameOpen.value = false
  if (!n || (n.data?.label || '') === v) return
  if (apply('Rename step', [{ op: 'update_node', id, data: { label: v || undefined } }])) announce(`Renamed to ${v || renamePlaceholder.value}.`)
}

// ── delete, copy, paste, duplicate (D1 rule 7: every delete goes through deleteSelection) ──
async function remove(target) {
  const flow = canvas.value?.flow
  if (!flow || editLocked.value) return
  const set = await deleteSelection(flow, {
    apply: (ops) => history.run('Delete', ops),
    target: target || canvas.value.selectedIds(),
    edges: doc.edges.value,
  })
  if (set) announce(`Deleted ${[set.nodeIds.length && `${set.nodeIds.length} step${set.nodeIds.length > 1 ? 's' : ''}`, set.edgeIds.length && `${set.edgeIds.length} connection${set.edgeIds.length > 1 ? 's' : ''}`].filter(Boolean).join(' and ')}.`)
}
function targetIds() {
  const sel = canvas.value?.selectedIds().nodeIds || []
  if (sel.length) return sel
  const f = canvas.value?.focusedItem(document.activeElement)
  return f?.kind === 'node' ? [f.id] : []
}
async function copy(ids = targetIds()) {
  const text = copyText(doc.nodes.value, doc.edges.value, ids)
  if (!text) return false
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    notify.error('Nothing was copied: the browser did not allow clipboard access.')
    return false
  }
  announce(ids.length === 1 ? 'Copied 1 step.' : `Copied ${ids.length} steps.`)
  return true
}
async function cut() {
  const ids = targetIds()
  if (ids.length && await copy(ids)) await remove({ nodeIds: ids, edgeIds: [] })
}
let pasteCount = 0
let lastPaste = ''
function placeClip(ops, nodeIds, label) {
  if (!apply(label, ops)) return
  announce(nodeIds.length === 1 ? `${label}: 1 step.` : `${label}: ${nodeIds.length} steps.`)
  nextTick(() => canvas.value?.select(nodeIds))
}
function offsetFor(clip, step) {
  const xs = clip.nodes.map((n) => n.position.x)
  const ys = clip.nodes.map((n) => n.position.y)
  const left = Math.min(...xs)
  const top = Math.min(...ys)
  const size = { width: Math.max(...xs) - left + 200, height: Math.max(...ys) - top + 64 }
  const at = freeWorkflowPosition(doc.nodes.value, { x: left + 32 * step, y: top + 32 * step }, size)
  return { x: at.x - left, y: at.y - top }
}
async function paste() {
  if (editLocked.value) return
  let text
  try {
    text = await navigator.clipboard.readText()
  } catch {
    notify.error('The browser did not allow reading the clipboard. Allow clipboard access for this site, then paste again.')
    return
  }
  let clip
  try { clip = parseClip(text) } catch (e) { notify.error(e.message); return }
  pasteCount = text === lastPaste ? pasteCount + 1 : 1
  lastPaste = text
  const { ops, nodeIds } = pasteOps(clip, { nodeIds: doc.nodes.value.map((n) => n.id), edgeIds: doc.edges.value.map((e) => e.id), offset: offsetFor(clip, pasteCount) })
  placeClip(ops, nodeIds, 'Paste')
}
function duplicate(ids = targetIds()) {
  if (editLocked.value) return
  const text = copyText(doc.nodes.value, doc.edges.value, ids, { keepSecrets: true })
  if (!text) return
  const clip = parseClip(text)
  const { ops, nodeIds } = pasteOps(clip, { nodeIds: doc.nodes.value.map((n) => n.id), edgeIds: doc.edges.value.map((e) => e.id), offset: offsetFor(clip, 1) })
  placeClip(ops, nodeIds, 'Duplicate')
}
// ── turn steps off and on (ADM-1343): one undoable change; the server's validation says what may not be off ──
function toggleOff(ids = targetIds()) {
  if (editLocked.value || !ids.length) return
  const { ops, off } = toggleOffOps(doc.nodes.value.filter((n) => ids.includes(n.id)))
  if (!ops.length) { announce('A trigger cannot be turned off.'); return }
  const what = ops.length === 1 ? titleOf(ops[0].id) : `${ops.length} steps`
  if (apply(off ? 'Turn step off' : 'Turn step on', ops)) announce(`Turned ${what} ${off ? 'off' : 'on'}.`)
}
function nudge(dir) {
  const ids = targetIds()
  if (!ids.length || editLocked.value) return
  const [dx, dy] = NUDGE[dir]
  const ops = doc.nodes.value.filter((n) => ids.includes(n.id)).map((n) => ({ op: 'move_node', id: n.id, position: { x: n.position.x + dx, y: n.position.y + dy } }))
  if (apply('Move', ops)) announce(`Moved ${ids.length === 1 ? titleOf(ids[0]) : `${ids.length} steps`} ${dir}.`)
}
async function focusNode(id) {
  if (!(await canvas.value?.focusNode(id))) return
  canvas.value.select([id])
}

// ── running ──
const inputsOpen = ref(false)
const inputFields = ref([])      // [{ key, type: 'text' | 'image' }]
const inputValues = reactive({})
const inputFiles = reactive({})  // an image input's chosen file
const inputErrors = reactive({})
const uploading = ref(false)
const pendingRun = ref(null)
// What the server takes (POST /workflow-graphs/<id>/images/); it checks again and says why it refuses.
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const IMAGE_MAX_BYTES = 15 * 1024 * 1024
const clear = (o) => { for (const k of Object.keys(o)) delete o[k] }
function manualInputs() {
  const t = doc.nodes.value.find((n) => n.type === 'trigger.manual')
  return (Array.isArray(t?.data?.inputs) ? t.data.inputs : []).filter((i) => i && i.key)
}
function startRun(opts) {
  if (actionsDisabled.value || run.running.value || !can.value.run) return
  const inputs = manualInputs()
  if (inputs.length) {
    clear(inputValues)
    clear(inputFiles)
    clear(inputErrors)
    inputFields.value = inputs.map((i) => ({ key: i.key, type: i.type === 'image' ? 'image' : 'text' }))
    for (const i of inputs) if (i.type !== 'image') inputValues[i.key] = i.default ?? ''
    pendingRun.value = opts
    inputsOpen.value = true
    return
  }
  launch({ ...opts, payload: {} })
}
function pickFile(key, e) {
  const file = e?.target?.files?.[0] || null
  inputFiles[key] = file
  delete inputErrors[key]
  if (!file) return
  if (!IMAGE_TYPES.includes(file.type)) inputErrors[key] = 'Choose a JPEG, PNG or WebP photo.'
  else if (file.size > IMAGE_MAX_BYTES) inputErrors[key] = 'The photo is larger than 15 MB. Choose a smaller one.'
}
async function submitInputs() {
  if (uploading.value) return
  const images = inputFields.value.filter((f) => f.type === 'image')
  for (const f of images) if (!inputFiles[f.key] && !inputErrors[f.key]) inputErrors[f.key] = 'Choose a photo for this input.'
  if (images.some((f) => inputErrors[f.key])) return
  const payload = {}
  for (const f of inputFields.value) if (f.type === 'text') payload[f.key] = inputValues[f.key] ?? ''
  uploading.value = true
  try {
    for (const f of images) {
      try {
        const { data } = await api.uploadWorkflowImage(graphId, inputFiles[f.key])
        const image = data?.image
        if (!image || image.kind !== 'image' || !image.id) throw new Error('The server did not say which image it stored. Try again.')
        payload[f.key] = image
      } catch (e) {
        const d = e?.response?.data
        inputErrors[f.key] = (d && (d.error || d.detail)) || (e?.response ? `The photo was not uploaded (error ${e.response.status}). Try again.` : (e?.message || 'The photo was not uploaded. Check your connection.'))
        return
      }
    }
  } finally {
    uploading.value = false
  }
  inputsOpen.value = false
  launch({ ...pendingRun.value, payload })
}
async function launch({ dryRun, untilNode = null, payload }) {
  const res = await run.start({ payload, dryRun, untilNode })
  if (!res.ok && res.error?.errors?.length) {
    const next = {}
    for (const x of res.error.errors) if (x?.node_id) next[x.node_id] = x.message || String(x)
    doc.setIssues(next)
  }
  if (res.ok && !consoleAsSheet.value && consoleChoice.value !== 'closed') consoleOpen.value = true
}
async function rerunFailed() { if (can.value.run) await run.rerun() }

// ── lifecycle ──
async function setLifecycle(next) {
  if (!can.value.edit) return
  if (await doc.setStatus(next)) notify.success(next === 'paused' ? 'Paused: no new triggered runs start.' : 'Resumed: triggers run the published version again.')
}
async function duplicateWorkflow() {
  if (actionsDisabled.value || !(await doc.saveIfDirty())) return
  let graph
  try { graph = doc.currentGraph() } catch (e) { notify.error(e.message); return }
  try {
    const { data } = await api.createWorkflowGraph({ name: `${doc.name.value} (copy)`, graph })
    notify.success('Workflow duplicated')
    router.push(`/dashboard/workflow-builder/${data.id}`)
  } catch (e) {
    notify.error(e?.response?.data?.error || 'The workflow was not duplicated. Try again.')
  }
}
async function archiveWorkflow() {
  if (actionsDisabled.value || !can.value.archive) return
  if (doc.dirty.value) { notify.info('Save or discard your changes before archiving this workflow.'); return }
  const ok = await confirm({
    title: 'Archive workflow?', message: `Archive "${doc.name.value}"? Its triggers stop. Run history and spend are kept.`,
    confirmText: 'Archive', danger: true,
  })
  if (!ok) return
  try {
    await api.deleteWorkflowGraph(graphId)
    notify.success('Workflow archived')
    router.push('/dashboard/workflow-builder')
  } catch (e) {
    const d = e?.response?.data || {}
    notify.error(d.error || d.detail || `The workflow was not archived (error ${e?.response?.status || 'no answer'}). Try again.`)
  }
}
function goBack() { router.push('/dashboard/workflow-builder') }

// ── validate (F12: the reason and the JSON are always shown) ──
const validateOpen = ref(false)
const validation = ref({})
const validationSummary = computed(() => {
  const v = validation.value
  if (v.loading) return 'Checking…'
  if (v.inputError || v.requestError) return 'The check could not run. The reason is below.'
  if (v.data?.ok) return v.data.warnings?.length ? `Valid, with ${v.data.warnings.length} warning(s).` : 'No problems found.'
  if (v.data) return `${(v.data.errors || []).length} problem(s) found. The marked steps show them too.`
  return ''
})
async function validate() {
  if (!can.value.edit) return
  validateOpen.value = true
  validation.value = { loading: true }
  let graph
  try {
    graph = doc.currentGraph()
  } catch (e) {
    validation.value = { inputError: e instanceof WorkflowInputError ? e.message : String(e?.message || e), nodeId: e?.nodeId || null }
    return
  }
  const graphJson = JSON.stringify(graph, null, 2)
  try {
    const { data } = await api.validateWorkflowGraph(graphId, graph)
    const next = {}
    for (const x of data?.errors || []) if (x?.node_id) next[x.node_id] = x.message || String(x)
    doc.setIssues(next)
    validation.value = { data, graph: graphJson, response: JSON.stringify(data, null, 2) }
  } catch (e) {
    const d = e?.response?.data
    const reason = (d && (d.error || d.detail)) || (e?.response ? `The server answered with error ${e.response.status}.` : 'No answer from the server. Check your connection.')
    validation.value = { requestError: reason, graph: graphJson, response: d ? JSON.stringify(d, null, 2) : '' }
  }
}

// ── versions (C5 cursor pages) ──
const versionsOpen = ref(false)
const versions = reactive({ rows: [], cursor: null, more: false, loading: false, loaded: false, error: '' })
const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const fmtDate = (iso) => { try { return iso ? dateFmt.format(new Date(iso)) : '' } catch { return '' } }
async function loadVersions({ more = false } = {}) {
  if (versions.loading) return
  versions.loading = true
  versions.error = ''
  try {
    const { data } = await api.getWorkflowGraphVersions(graphId, { limit: 50, ...(more && versions.cursor ? { cursor: versions.cursor } : {}) })
    if (!data || !Array.isArray(data.results)) throw new Error('The server sent the version list in a shape this page does not read.')
    if (data.has_more && !data.next_cursor) throw new Error('The server said there are more versions but did not say where the next page starts.')
    versions.rows = more ? [...versions.rows, ...data.results] : data.results
    versions.cursor = data.has_more ? data.next_cursor : null
    versions.more = !!data.has_more
    versions.loaded = true
  } catch (e) {
    versions.error = e?.response ? serverSentence(e, 'Could not load the versions') : (e?.message || 'Could not load the versions.')
  } finally {
    versions.loading = false
  }
}
function openVersions() {
  versionsOpen.value = true
  loadVersions()
}
async function restore(v) {
  if (!can.value.edit) return
  const ok = await confirm({
    title: `Restore version ${v.version}?`,
    message: doc.dirty.value ? 'Your unsaved changes are replaced by this version.' : 'The draft is replaced by this version. Publish to make it live.',
    confirmText: 'Restore', danger: doc.dirty.value,
  })
  if (!ok) return
  if (await doc.restoreVersion(v.id)) {
    versionsOpen.value = false
    notify.success(`Restored v${v.version} on the draft. Publish to make it live.`)
  }
}

// ── keyboard (plan §3.5; F13) ──
function layerOpen() { return !!document.querySelector('[aria-modal="true"], [role="alertdialog"], [role="menu"][data-state="open"]') }
function onKeydown(e) {
  if (e.defaultPrevented || e.isComposing) return
  const el = e.target instanceof Element ? e.target : null
  const where = canvas.value?.focusedItem(el)
  const hit = resolveShortcut(e, {
    typing: isTypingTarget(el), combobox: isComboboxTarget(el), layerOpen: layerOpen(),
    onNode: where?.kind === 'node', onEdge: where?.kind === 'edge', onCanvas: !!where,
  })
  if (!hit) return
  const { action, dir } = hit
  if (action === 'escape-field') {
    if (el?.hasAttribute('data-wf-own-escape')) return
    e.preventDefault()
    e.stopPropagation()
    el.blur()
    return
  }
  e.preventDefault()
  if (action === 'save' || action === 'add') e.stopImmediatePropagation()   // never the shell's own Ctrl+K as well
  switch (action) {
    case 'save': if (!actionsDisabled.value && !editLocked.value && doc.dirty.value) doc.save(); break
    case 'add': if (!layerOpen()) openPicker(null); break
    case 'run': startRun({ dryRun: false }); break
    case 'escape': canvas.value?.clearSelection(); break
    case 'undo': undo(); break
    case 'redo': redo(); break
    case 'copy': copy(); break
    case 'cut': cut(); break
    case 'paste': paste(); break
    case 'duplicate': duplicate(); break
    case 'toggle-off': toggleOff(); break
    case 'delete': remove(where?.kind === 'node' && !canvas.value.selectedIds().nodeIds.length ? { nodeIds: [where.id] } : where?.kind === 'edge' && !canvas.value.selectedIds().edgeIds.length ? { edgeIds: [where.id] } : null); break
    case 'select-all': canvas.value?.selectAll(); break
    case 'tidy': tidy(); break
    case 'fit': canvas.value?.fit(); break
    case 'reset-zoom': canvas.value?.resetZoom(); break
    case 'zoom-in': canvas.value?.zoomIn(); break
    case 'zoom-out': canvas.value?.zoomOut(); break
    case 'console': setConsoleOpen(!consoleOpen.value); break
    case 'shortcuts': shortcutsOpen.value = true; break
    case 'open':
      if (where?.kind === 'node') openNode(where.id)
      else if (where?.kind === 'edge') openPicker({ mode: 'insert', edgeId: where.id })
      break
    case 'rename': {
      const ids = targetIds()
      if (ids.length === 1) renameNode(ids[0])
      else toolbar.value?.startRename()
      break
    }
    case 'neighbour': {
      const next = neighbourId(where.id, dir, doc.nodes.value, (n) => canvas.value?.sizeOf(n.id))
      if (next) focusNode(next)
      else announce(`No step ${dir === 'left' || dir === 'right' ? `to the ${dir}` : dir === 'up' ? 'above' : 'below'}.`)
      break
    }
    case 'nudge': nudge(dir); break
  }
}

const outlineOpen = ref(false)
const shortcutsOpen = ref(false)

onMounted(() => {
  window.addEventListener('keydown', onKeydown, true)
  window.addEventListener('resize', onResize)
  loadSteps()
  load()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown, true)
  window.removeEventListener('resize', onResize)
})
</script>
