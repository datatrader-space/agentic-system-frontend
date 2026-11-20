<template>
  <div class="wf-list p-6 lg:p-8">
    <div class="max-w-6xl mx-auto">
      <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 class="wf-list__title text-[25px] font-[850] leading-tight tracking-normal flex items-center gap-3">
            <span class="wf-list__badge w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0" aria-hidden="true">
              <Workflow :size="21" :stroke-width="2" />
            </span>
            Workflow Builder
          </h1>
          <p class="wf-list__soft mt-1.5 text-sm">Drag-and-drop graphs of triggers, agents &amp; actions. <span class="wf-list__preview font-medium">Preview</span></p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <!-- Runs is CROSS-workflow, not the runs of one graph — an operator asking "what needs me
               right now" cannot ask it of a single workflow, because the dead run is always on
               whichever one they were not looking at. It lives here rather than in the sidebar so the
               nav carries one line for the feature, not two. -->
          <button type="button" @click="openRuns" class="wf-btn"
            title="Every run across all your workflows — what failed, what needs a decision">
            <Activity :size="15" :stroke-width="2" aria-hidden="true" /> Workflow Runs
          </button>
          <button type="button" @click="openTemplates" class="wf-btn">
            <LayoutTemplate :size="15" :stroke-width="2" aria-hidden="true" /> Templates
          </button>
          <button type="button" @click="triggerImport" :disabled="creating" class="wf-btn">
            <Upload :size="15" :stroke-width="2" aria-hidden="true" /> Import
          </button>
          <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" aria-label="Workflow JSON file to import" @change="onImportFile" />
          <button type="button" @click="createNew" :disabled="creating" class="wf-btn wf-btn--primary">
            <Plus :size="15" :stroke-width="2.2" aria-hidden="true" /> {{ creating ? 'Creating…' : 'New workflow' }}
          </button>
        </div>
      </div>

      <!-- The real control the archive confirmation names: archived workflows come back here, with Restore. -->
      <label class="wf-list__toggle mb-4">
        <input type="checkbox" v-model="showArchived" @change="load" />
        Show archived
      </label>

      <PageLoader v-if="loading" label="Loading workflows…" />
      <div v-else-if="!graphs.length" class="wf-list__empty rounded-[10px] py-16 text-center">
        <p class="wf-list__soft text-sm font-medium">No workflows yet</p>
        <p class="wf-list__faint text-xs mt-1">Build your first graph: a trigger → an agent → an action.</p>
        <button type="button" @click="createNew" class="wf-btn wf-btn--soft mt-4">Create your first workflow</button>
      </div>

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <!-- The card is an <article>: its main button opens the builder and stretches over the whole card,
             and the actions are real buttons BESIDE it, never inside it (a button inside a button is not
             reachable by keyboard and is read as one control). -->
        <article v-for="g in graphs" :key="g.id" class="wf-card" :class="{ 'is-archived': g.is_active === false }">
          <button type="button" class="wf-card__main" @click="open(g)">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="wf-card__name text-[14px] font-bold truncate">{{ g.name }}</div>
                <div class="wf-list__faint text-[11px] mt-0.5">{{ g.node_count }} node{{ g.node_count === 1 ? '' : 's' }} · {{ g.run_count }} run{{ g.run_count === 1 ? '' : 's' }}</div>
              </div>
              <!-- `paused` gets its own colour rather than sharing the neutral one with `draft`. It is
                   the state where a workflow looks fine and quietly is not running, so it is the one that
                   most needs to be legible at a glance in a list. -->
              <span class="flex flex-col items-end gap-1 shrink-0">
                <span class="wf-chip" :class="statusClass(g.status)">{{ g.status }}</span>
                <span v-if="g.is_active === false" class="wf-chip wf-chip--muted">archived</span>
              </span>
            </div>
            <p v-if="g.description" class="wf-list__soft mt-2 text-[12px] line-clamp-2">{{ g.description }}</p>
            <div v-if="g.last_run" class="mt-3 flex items-center gap-1.5 text-[11px]">
              <span class="wf-dot" :class="dotClass(g.last_run.status)" aria-hidden="true"></span>
              <span class="wf-list__faint">last run: {{ g.last_run.status }}</span>
            </div>
          </button>
          <div class="wf-card__foot">
            <span class="wf-card__open" aria-hidden="true">Open builder <ArrowRight :size="12" :stroke-width="2.2" /></span>
            <div class="flex-1"></div>
            <div class="wf-card__actions">
              <button type="button" class="wf-card__act" :disabled="creating" :aria-label="`Duplicate ${g.name}`" @click="duplicate(g)">
                <Copy :size="13" :stroke-width="2" aria-hidden="true" /> Duplicate
              </button>
              <button type="button" class="wf-card__act" :aria-label="`Export ${g.name}`" @click="exportGraph(g)">
                <Download :size="13" :stroke-width="2" aria-hidden="true" /> Export
              </button>
              <button v-if="g.is_active === false" type="button" class="wf-card__act" :aria-label="`Restore ${g.name}`" @click="restore(g)">
                <ArchiveRestore :size="13" :stroke-width="2" aria-hidden="true" /> Restore
              </button>
              <button v-else type="button" class="wf-card__act wf-card__act--danger" :aria-label="`Archive ${g.name}`" @click="remove(g)">
                <Archive :size="13" :stroke-width="2" aria-hidden="true" /> Archive
              </button>
            </div>
          </div>
        </article>
      </div>

      <!-- The list is paged (30 a page): offer the rest instead of silently stopping at the first page. -->
      <div v-if="!loading && graphs.length" class="wf-list__faint mt-3 flex items-center justify-between text-[12px]">
        <span>Showing {{ graphs.length }}<template v-if="total"> of {{ total }}</template></span>
        <button v-if="hasMore" type="button" :disabled="loadingMore" @click="loadMore" class="wf-btn wf-btn--pill">
          {{ loadingMore ? 'Loading…' : 'Load more' }}
        </button>
      </div>
    </div>

    <!-- Templates picker: AppDialog gives it role="dialog", a title, a focus trap, Esc and focus back to Templates. -->
    <AppDialog v-model:open="showTemplates" title="Start from a template" size="sm">
      <p v-if="templatesLoading" class="wf-list__faint text-sm p-6 text-center" role="status">Loading templates…</p>
      <p v-else-if="templatesError" class="wf-list__soft text-sm p-6 text-center" role="alert">
        {{ templatesError }}
        <button type="button" class="wf-btn mt-3 mx-auto" @click="loadTemplates">Try again</button>
      </p>
      <p v-else-if="!templates.length" class="wf-list__faint text-sm p-6 text-center">No templates available.</p>
      <template v-else>
        <button v-for="t in templates" :key="t.key" type="button" @click="useTemplate(t)" :disabled="creating"
          class="wf-tpl">
          <div class="wf-card__name text-[13px] font-bold">{{ t.name }}</div>
          <div class="wf-list__soft text-[12px] mt-0.5">{{ t.description }}</div>
          <!-- Setup a template needs, shown BEFORE it is instantiated. A template that quietly
               requires a connector produces a workflow which fails partway through and reads as a
               product fault rather than as setup the user was never asked for. -->
          <div v-if="needs(t).length" class="mt-2 flex flex-wrap gap-1">
            <span v-for="n in needs(t)" :key="n.label"
              class="wf-chip" :class="n.kind === 'connection' ? 'wf-chip--wait' : 'wf-chip--muted'">
              {{ n.label }}
            </span>
          </div>
        </button>
      </template>
    </AppDialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Activity, Archive, ArchiveRestore, ArrowRight, Copy, Download, LayoutTemplate, Plus, Upload, Workflow,
} from 'lucide-vue-next'
import api from '../services/api'
import PageLoader from '../components/common/PageLoader.vue'
import AppDialog from '../components/common/AppDialog.vue'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import { saveBlob } from '../utils/saveBlob'
import { cameraStarter, cameraWorkflow, NO_CAMERA_WORKSPACE } from '../utils/cameraWorkflow'

const router = useRouter()
const route = useRoute()
const graphs = ref([])
const loading = ref(true)
const PAGE_SIZE = 30
const total = ref(0)
const hasMore = ref(false)
const loadingMore = ref(false)
const creating = ref(false)
const showTemplates = ref(false)
const templates = ref([])
const templatesLoading = ref(false)
const templatesError = ref('')
const fileInput = ref(null)
// Archived workflows are hidden unless the person asks for them (the list's ?include_archived=true).
const showArchived = ref(false)

const dotClass = (s) => ({ success: 'wf-dot--ok', failed: 'wf-dot--bad', running: 'wf-dot--busy' }[s] || 'wf-dot--muted')
const statusClass = (s) => ({ published: 'wf-chip--ok', paused: 'wf-chip--wait', retired: 'wf-chip--bad' }[s] || 'wf-chip--muted')

function listParams(offset) {
  const params = { limit: PAGE_SIZE, offset }
  if (showArchived.value) params.include_archived = 'true'
  return params
}

const pickRows = (data) => (Array.isArray(data) ? data : (data?.results || []))

async function load() {
  loading.value = true
  try {
    const { data } = await api.getWorkflowGraphs(listParams(0))
    graphs.value = pickRows(data)
    total.value = Number(data?.count) || 0
    hasMore.value = !!data?.next
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to load workflows')
  } finally {
    loading.value = false
  }
}

// The next page starts after the rows on screen, so a workflow archived here does not make one get skipped.
async function loadMore() {
  if (loadingMore.value || !hasMore.value) return
  loadingMore.value = true
  try {
    const { data } = await api.getWorkflowGraphs(listParams(graphs.value.length))
    const seen = new Set(graphs.value.map((g) => g.id))
    graphs.value = graphs.value.concat(pickRows(data).filter((g) => !seen.has(g.id)))
    total.value = Number(data?.count) || total.value
    hasMore.value = !!data?.next
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Could not load more workflows')
  } finally {
    loadingMore.value = false
  }
}

// `creating` is the one guard for every action that creates a workflow (New, template, Duplicate,
// Import): a second click while one is in flight is ignored instead of creating a second copy.
async function createNew() {
  if (creating.value) return
  creating.value = true
  try {
    const { data } = await api.createWorkflowGraph({
      name: 'Untitled workflow',
      graph: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
    })
    router.push(`/dashboard/workflow-builder/${data.id}`)
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to create workflow')
  } finally {
    creating.value = false
  }
}

function open(g) { router.push(`/dashboard/workflow-builder/${g.id}`) }

async function duplicate(g) {
  if (creating.value) return
  creating.value = true
  try {
    const { data: full } = await api.getWorkflowGraph(g.id)
    const { data: copy } = await api.createWorkflowGraph({ name: `${g.name} (copy)`, graph: full.graph })
    notify.success('Workflow duplicated')
    router.push(`/dashboard/workflow-builder/${copy.id}`)
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to duplicate')
  } finally {
    creating.value = false
  }
}

// Reads the `requires` block the backend now passes through. Connections are called out separately
// from vars because they are the ones the user cannot satisfy on the canvas — a missing var is typing,
// a missing connector is an OAuth round-trip through another page.
function needs(t) {
  const r = t?.requires || {}
  const out = (r.connections || []).map((c) => ({ kind: 'connection', label: `needs ${c}` }))
  const varCount = Object.keys(r.vars || {}).length
  if (varCount) out.push({ kind: 'vars', label: `${varCount} setting${varCount === 1 ? '' : 's'}` })
  return out
}

function openRuns() { router.push('/dashboard/workflow-runs') }

// A failed load says so in the dialog, with Try again; it never reads as "No templates available".
async function loadTemplates() {
  templatesLoading.value = true
  templatesError.value = ''
  try {
    const { data } = await api.getWorkflowGraphTemplates()
    templates.value = data || []
  } catch (e) {
    templatesError.value = e?.response?.data?.error || 'Could not load the templates.'
  } finally {
    templatesLoading.value = false
  }
}

async function openTemplates() {
  showTemplates.value = true
  if (!templates.value.length && !templatesLoading.value) await loadTemplates()
}

async function useTemplate(t) {
  if (creating.value) return
  creating.value = true
  try {
    const { data } = await api.createWorkflowGraphFromTemplate(t.key)
    notify.success('Workflow created from template')
    router.push(`/dashboard/workflow-builder/${data.id}`)
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to create from template')
  } finally {
    creating.value = false
  }
}

function triggerImport() { if (!creating.value) fileInput.value?.click() }

async function onImportFile(e) {
  const file = e.target.files?.[0]
  e.target.value = ''   // allow re-importing the same file
  if (!file || creating.value) return
  creating.value = true
  try {
    const text = await file.text()
    const obj = JSON.parse(text)
    const { data } = await api.importWorkflowGraph({
      name: obj.name || file.name.replace(/\.json$/i, ''),
      description: obj.description || '',
      graph: obj.graph || obj,   // accept both export-wrapper and raw graph
    })
    if (data.import_valid === false) notify.warning('Imported with validation issues — fix on the canvas')
    else notify.success('Workflow imported')
    router.push(`/dashboard/workflow-builder/${data.id}`)
  } catch (err) {
    notify.error(err?.response?.data?.error || 'Could not import — invalid JSON file')
  } finally {
    creating.value = false
  }
}

async function exportGraph(g) {
  try {
    const { data } = await api.exportWorkflowGraph(g.id)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    saveBlob(blob, `${(g.name || 'workflow').replace(/[^a-z0-9-_]+/gi, '_')}.json`)
  } catch (e) {
    notify.error('Failed to export')
  }
}

async function remove(g) {
  // Archive (soft-delete): preserves historical cost attribution + any workflow budget's spend history.
  if (!(await confirm({ title: 'Archive workflow?', message: `Archive "${g.name}"? Its triggers stop and it is hidden from this list, but its run history and budget spend are kept. To bring it back, tick "Show archived" above the list and press Restore on its card.`, confirmText: 'Archive' }))) return
  try {
    await api.deleteWorkflowGraph(g.id)
    if (showArchived.value) {
      graphs.value = graphs.value.map((x) => (x.id === g.id ? { ...x, is_active: false } : x))
    } else {
      graphs.value = graphs.value.filter(x => x.id !== g.id)
      if (total.value) total.value -= 1
    }
    notify.success('Workflow archived')
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to archive')
  }
}

// Un-archive: the same `is_active` switch the server's archive sets, turned back on (its triggers follow it).
async function restore(g) {
  try {
    const { data } = await api.saveWorkflowGraph(g.id, { is_active: true })
    graphs.value = graphs.value.map((x) => (x.id === g.id ? { ...x, is_active: data?.is_active ?? true } : x))
    notify.success('Workflow restored')
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to restore')
  }
}

// From a camera's page in Training Data ("Build a workflow"): a new workflow whose canvas holds that camera's event
// trigger, made in the camera's own workspace and opened at once (utils/cameraWorkflow.js). A person who cannot use
// that workspace is told so by the server, and nothing is made anywhere. Any other visit lists the workflows.
async function createFromCamera(starter) {
  if (creating.value) return
  if (!starter.workspace) {
    notify.error(NO_CAMERA_WORKSPACE)
    load()
    return
  }
  creating.value = true
  try {
    const { data } = await api.createWorkflowGraph(cameraWorkflow(starter))
    router.push(`/dashboard/workflow-builder/${data.id}`)
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Could not create the workflow for this camera')
    load()
  } finally {
    creating.value = false
  }
}

onMounted(() => {
  const starter = cameraStarter(route?.query)
  if (starter) createFromCamera(starter)
  else load()
})
</script>

<style scoped>
/* Every colour is a --vm-* token, so [data-theme="dark"] in style.css re-skins the page (F2). */
.wf-list { color: var(--vm-ink); }
.wf-list__title { color: var(--vm-ink); }
.wf-list__badge { background: var(--vm-primary-soft); color: var(--vm-link); }
.wf-list__soft { color: var(--vm-ink-soft); }
.wf-list__faint { color: var(--vm-ink-faint); }
.wf-list__preview { color: var(--vm-amber-ink); }
.wf-list__toggle {
  display: inline-flex; align-items: center; gap: 8px; min-height: 32px;
  font-size: 13px; font-weight: 600; color: var(--vm-ink-soft); cursor: pointer;
}
.wf-list__toggle input { accent-color: var(--vm-primary); width: 16px; height: 16px; }
.wf-list__empty { border: 1px dashed var(--vm-line-2); background: var(--vm-surface); box-shadow: var(--vm-shadow-m); }

.wf-btn {
  display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 12px;
  border: 1px solid var(--vm-line-2); border-radius: 8px; background: var(--vm-surface);
  color: var(--vm-ink-soft); font-size: 12px; font-weight: 850; cursor: pointer;
  transition: background-color .15s var(--vm-ease2), color .15s var(--vm-ease2);
}
.wf-btn:hover:not(:disabled) { background: var(--vm-surface-soft); color: var(--vm-ink); }
.wf-btn:disabled { opacity: .6; cursor: not-allowed; }
.wf-btn--primary { padding: 0 16px; border-color: transparent; background: var(--vm-primary); color: #fff; box-shadow: var(--vm-glow-v); }
.wf-btn--primary:hover:not(:disabled) { background: var(--vm-primary-d); color: #fff; }
.wf-btn--soft { border-color: transparent; background: var(--vm-primary-soft); color: var(--vm-link); }
.wf-btn--soft:hover:not(:disabled) { background: var(--vm-primary-hover-soft); color: var(--vm-link); }
.wf-btn--pill { height: 32px; border-radius: 999px; font-weight: 600; }

.wf-chip { font-size: 10px; font-weight: 600; border-radius: 6px; padding: 4px 8px; }
.wf-chip--ok { background: var(--vm-green-soft); color: var(--vm-green-ink); }
.wf-chip--wait { background: var(--vm-amber-soft); color: var(--vm-amber-ink); }
.wf-chip--bad { background: var(--vm-red-soft); color: var(--vm-red-ink); }
.wf-chip--muted { background: var(--vm-surface-soft); color: var(--vm-ink-soft); }
.wf-dot { width: 6px; height: 6px; border-radius: 999px; }
.wf-dot--ok { background: var(--vm-green); }
.wf-dot--bad { background: var(--vm-danger); }
.wf-dot--busy { background: var(--vm-link); }
.wf-dot--muted { background: var(--vm-ink-faint); }

/* The card: the main button's ::after stretches over the whole card, so a click anywhere opens the
   builder; the actions sit above it (z-index) as their own buttons. */
.wf-card {
  position: relative; display: flex; flex-direction: column;
  border: 1px solid var(--vm-border); border-radius: 10px; background: var(--vm-surface);
  box-shadow: var(--vm-shadow-m); transition: border-color .15s var(--vm-ease2);
}
.wf-card:hover { border-color: var(--vm-primary-line); }
.wf-card.is-archived { background: var(--vm-surface-soft); }
.wf-card__main {
  display: block; width: 100%; padding: 16px 16px 0; border: none; background: none;
  color: inherit; font: inherit; text-align: left; cursor: pointer;
}
.wf-card__main::after { content: ''; position: absolute; inset: 0; border-radius: 10px; }
.wf-card__main:focus-visible { outline: none; }
.wf-card__main:focus-visible::after { outline: 2px solid var(--vm-focus); outline-offset: 2px; }
.wf-card__name { color: var(--vm-ink); }
.wf-card__foot { display: flex; align-items: center; gap: 8px; padding: 10px 16px 12px; }
.wf-card__open {
  display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 850; color: var(--vm-link);
  opacity: 0; transition: opacity .15s var(--vm-ease2);
}
.wf-card__actions { position: relative; z-index: 1; display: flex; align-items: center; gap: 2px; }
.wf-card__act {
  display: inline-flex; align-items: center; gap: 4px; min-height: 32px; padding: 0 8px;
  border: none; border-radius: 6px; background: none;
  color: var(--vm-ink-soft); font-size: 11px; font-weight: 600; cursor: pointer;
  opacity: 0; transition: opacity .15s var(--vm-ease2), background-color .15s var(--vm-ease2);
}
.wf-card__act:hover:not(:disabled) { background: var(--vm-surface-soft); color: var(--vm-ink); }
.wf-card__act:disabled { cursor: not-allowed; }
.wf-card__act--danger { color: var(--vm-red-ink); }
.wf-card__act--danger:hover:not(:disabled) { background: var(--vm-red-soft); color: var(--vm-red-ink); }
/* Shown on hover, whenever focus is inside the card (keyboard), and always on a touch screen (no hover). */
.wf-card:hover .wf-card__act, .wf-card:focus-within .wf-card__act,
.wf-card:hover .wf-card__open, .wf-card:focus-within .wf-card__open { opacity: 1; }
.wf-card:hover .wf-card__act:disabled, .wf-card:focus-within .wf-card__act:disabled { opacity: .6; }
@media (hover: none), (pointer: coarse) {
  .wf-card__act, .wf-card__open { opacity: 1; }
  .wf-card__act:disabled { opacity: .6; }
  .wf-card__act { min-height: 44px; padding: 0 10px; }
  .wf-btn { height: 44px; }
  .wf-list__toggle { min-height: 44px; }
}
@media (prefers-reduced-motion: reduce) {
  .wf-btn, .wf-card, .wf-card__act, .wf-card__open { transition: none; }
}

.wf-tpl {
  display: block; width: 100%; margin-bottom: 8px; padding: 12px; text-align: left;
  border: 1px solid var(--vm-border); border-radius: 8px; background: var(--vm-surface);
  color: inherit; font: inherit; cursor: pointer;
}
.wf-tpl:last-child { margin-bottom: 0; }
.wf-tpl:hover:not(:disabled) { border-color: var(--vm-primary-line); background: var(--vm-surface-soft); }
.wf-tpl:disabled { opacity: .6; cursor: not-allowed; }

.line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
</style>
