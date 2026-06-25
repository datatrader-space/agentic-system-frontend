<template>
  <div class="p-6 lg:p-8">
    <div class="max-w-6xl mx-auto">
      <div class="flex items-end justify-between gap-4 mb-6">
        <div>
          <h1 class="font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink flex items-center gap-3">
            <span class="w-10 h-10 rounded-xl bg-g-brand flex items-center justify-center shrink-0 shadow-glow-v text-white">⚙</span>
            Workflow Builder
          </h1>
          <p class="mt-1.5 text-sm text-ink-soft">Drag-and-drop graphs of triggers, agents &amp; actions. <span class="text-amber-600 font-medium">Preview</span></p>
        </div>
        <div class="flex items-center gap-2">
          <button @click="openTemplates"
            class="px-3 py-2 rounded-xl text-sm font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 inline-flex items-center gap-1.5">
            <span>🧩</span> Templates
          </button>
          <button @click="triggerImport"
            class="px-3 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 inline-flex items-center gap-1.5">
            <span>⤓</span> Import
          </button>
          <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="onImportFile" />
          <button @click="createNew" :disabled="creating"
            class="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-g-brand shadow-glow-v hover:opacity-95 disabled:opacity-60 inline-flex items-center gap-2">
            <span>＋</span> {{ creating ? 'Creating…' : 'New workflow' }}
          </button>
        </div>
      </div>

      <PageLoader v-if="loading" label="Loading workflows…" />
      <div v-else-if="!graphs.length" class="rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 py-16 text-center">
        <p class="text-sm font-medium text-ink-soft">No workflows yet</p>
        <p class="text-xs text-ink-faint mt-1">Build your first graph: a trigger → an agent → an action.</p>
        <button @click="createNew" class="mt-4 px-4 py-2 rounded-lg text-sm font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100">Create your first workflow</button>
      </div>

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <button v-for="g in graphs" :key="g.id" @click="open(g)"
          class="group text-left rounded-2xl border border-slate-200 bg-white p-4 hover:border-violet-300 hover:shadow-sm transition-all">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="text-[14px] font-bold text-ink truncate">{{ g.name }}</div>
              <div class="text-[11px] text-ink-faint mt-0.5">{{ g.node_count }} node{{ g.node_count === 1 ? '' : 's' }} · {{ g.run_count }} run{{ g.run_count === 1 ? '' : 's' }}</div>
            </div>
            <span class="text-[10px] font-semibold rounded-md px-2 py-1 shrink-0"
              :class="g.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">{{ g.status }}</span>
          </div>
          <p v-if="g.description" class="mt-2 text-[12px] text-ink-soft line-clamp-2">{{ g.description }}</p>
          <div v-if="g.last_run" class="mt-3 flex items-center gap-1.5 text-[11px]">
            <span class="w-1.5 h-1.5 rounded-full" :class="dotClass(g.last_run.status)"></span>
            <span class="text-ink-faint">last run: {{ g.last_run.status }}</span>
          </div>
          <div class="mt-3 flex items-center gap-2">
            <span class="text-[11px] font-semibold text-violet-700 opacity-0 group-hover:opacity-100 transition-opacity">Open builder →</span>
            <div class="flex-1"></div>
            <span @click.stop="duplicate(g)" class="text-[11px] font-semibold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity hover:underline mr-3">Duplicate</span>
            <span @click.stop="exportGraph(g)" class="text-[11px] font-semibold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity hover:underline mr-3">Export</span>
            <span @click.stop="remove(g)" class="text-[11px] font-semibold text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:underline">Delete</span>
          </div>
        </button>
      </div>
    </div>

    <!-- Templates picker -->
    <div v-if="showTemplates" class="fixed inset-0 z-50 flex items-center justify-center bg-black/30" @click.self="showTemplates = false">
      <div class="w-[460px] max-w-[92vw] bg-white rounded-2xl shadow-xl overflow-hidden">
        <div class="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
          <b class="text-ink">Start from a template</b>
          <button class="text-slate-400 text-2xl leading-none" @click="showTemplates = false">×</button>
        </div>
        <div class="p-3 max-h-[60vh] overflow-y-auto">
          <p v-if="!templates.length" class="text-sm text-ink-faint p-6 text-center">No templates available.</p>
          <button v-for="t in templates" :key="t.key" @click="useTemplate(t)" :disabled="creating"
            class="w-full text-left rounded-xl border border-slate-200 p-3 mb-2 hover:border-violet-300 hover:bg-violet-50/40 disabled:opacity-60">
            <div class="text-[13px] font-bold text-ink">{{ t.name }}</div>
            <div class="text-[12px] text-ink-soft mt-0.5">{{ t.description }}</div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api'
import PageLoader from '../components/common/PageLoader.vue'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'

const router = useRouter()
const graphs = ref([])
const loading = ref(true)
const creating = ref(false)
const showTemplates = ref(false)
const templates = ref([])
const fileInput = ref(null)

const dotClass = (s) => ({ success: 'bg-emerald-500', failed: 'bg-red-500', running: 'bg-indigo-500' }[s] || 'bg-slate-300')

async function load() {
  loading.value = true
  try {
    const { data } = await api.getWorkflowGraphs()
    graphs.value = Array.isArray(data) ? data : (data.results || [])
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to load workflows')
  } finally {
    loading.value = false
  }
}

async function createNew() {
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
  try {
    const { data: full } = await api.getWorkflowGraph(g.id)
    const { data: copy } = await api.createWorkflowGraph({ name: `${g.name} (copy)`, graph: full.graph })
    notify.success('Workflow duplicated')
    router.push(`/dashboard/workflow-builder/${copy.id}`)
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to duplicate')
  }
}

async function openTemplates() {
  showTemplates.value = true
  if (!templates.value.length) {
    try { const { data } = await api.getWorkflowGraphTemplates(); templates.value = data || [] }
    catch (e) { notify.error('Failed to load templates') }
  }
}

async function useTemplate(t) {
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

function triggerImport() { fileInput.value?.click() }

async function onImportFile(e) {
  const file = e.target.files?.[0]
  e.target.value = ''   // allow re-importing the same file
  if (!file) return
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
  }
}

async function exportGraph(g) {
  try {
    const { data } = await api.exportWorkflowGraph(g.id)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(g.name || 'workflow').replace(/[^a-z0-9-_]+/gi, '_')}.json`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  } catch (e) {
    notify.error('Failed to export')
  }
}

async function remove(g) {
  if (!(await confirm({ title: 'Delete workflow?', message: `Delete "${g.name}"? This can't be undone.`, confirmText: 'Delete', danger: true }))) return
  try {
    await api.deleteWorkflowGraph(g.id)
    graphs.value = graphs.value.filter(x => x.id !== g.id)
    notify.success('Workflow deleted')
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to delete')
  }
}

onMounted(load)
</script>

<style scoped>
.line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
</style>
