<template>
  <div class="h-full w-full bg-white">
    <div v-if="loading" class="p-10 text-center text-gray-500 text-sm">Loading agent…</div>
    <!--
      Phase 1 of the create-agent UI upgrade: the proven AgentBuilder rendered as a single
      scroll canvas (layout="canvas") instead of the 6-tab drawer. Reuses 100% of AgentBuilder's
      logic + sub-panels (SignalPanel / SchedulePanel / CredentialManager) => zero feature loss.
    -->
    <div v-else class="flex flex-col h-full">
      <!-- Page top bar -->
      <div class="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-white shrink-0">
        <div class="flex items-center gap-3 min-w-0">
          <button @click="goBack" class="text-sm text-indigo-600 hover:text-indigo-800 shrink-0">&larr; Agents</button>
          <span class="font-bold text-gray-900 truncate">{{ (agent && agent.name) || 'New Agent' }}</span>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span v-if="agent && agent.id" class="text-xs text-green-600 font-medium mr-1">Saved &#10003;</span>
          <button @click="showWorkspace = true"
            class="text-sm px-3 py-1.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-1.5">
            <Folder class="w-4 h-4" /> Workspace
          </button>
          <button title="The Live Preview on the right is always active"
            class="text-sm px-3 py-1.5 border border-indigo-200 rounded-lg text-indigo-600 hover:bg-indigo-50 flex items-center gap-1.5">
            <Play class="w-3.5 h-3.5" /> Test
          </button>
          <!-- Save & Publish (split button) -->
          <div class="relative">
            <div class="flex">
              <button @click="triggerSave" :disabled="saving"
                class="text-sm pl-4 pr-3 py-1.5 bg-indigo-600 text-white rounded-l-lg hover:bg-indigo-700 disabled:opacity-50 font-semibold">
                {{ saving ? 'Saving…' : 'Save & Publish' }}
              </button>
              <button @click="showSaveMenu = !showSaveMenu" :disabled="saving"
                class="px-2 py-1.5 bg-indigo-600 text-white rounded-r-lg hover:bg-indigo-700 border-l border-indigo-400 disabled:opacity-50">
                <ChevronDown class="w-4 h-4" />
              </button>
            </div>
            <div v-if="showSaveMenu" class="absolute right-0 mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-30 text-sm">
              <button @click="triggerSave(); showSaveMenu = false" class="w-full text-left px-3 py-2 text-gray-700 hover:bg-slate-50">💾 Save &amp; Publish</button>
              <button disabled class="w-full text-left px-3 py-2 text-gray-400 cursor-not-allowed flex items-center justify-between" title="Coming soon">
                <span>📝 Save as draft</span><span class="text-[9px] uppercase bg-gray-100 rounded px-1 py-0.5">soon</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Builder canvas + live emulator -->
      <div class="flex flex-col xl:flex-row flex-1 min-h-0">
        <div class="flex-1 min-w-0 h-full">
          <AgentBuilder
            ref="builderRef"
            v-model:agent="agent"
            layout="canvas"
            :is-saving="saving"
            :save-fn="saveAgent"
            @save="saveAgent"
            @close="goBack"
            @open-workspace="showWorkspace = true"
          />
        </div>
        <div class="shrink-0 xl:w-[440px] h-[70vh] xl:h-full border-t xl:border-t-0 xl:border-l border-gray-200">
          <AgentEmulator
            :agent-id="agent && agent.id ? agent.id : null"
            :model-name="agent && agent.default_model_name ? agent.default_model_name : ''"
          />
        </div>
      </div>
    </div>

    <!-- Workspace slide-over -->
    <AgentWorkspacePanel :agent="agent" v-model="showWorkspace" />
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Folder, Play, ChevronDown } from 'lucide-vue-next'
import api from '../services/api'
import { notify } from '@/composables/useNotify'
import AgentBuilder from '../components/AgentBuilder.vue'
import AgentEmulator from '../components/AgentEmulator.vue'
import AgentWorkspacePanel from '../components/AgentWorkspacePanel.vue'

const route = useRoute()
const router = useRouter()
const agent = ref(null)
const loading = ref(true)
const saving = ref(false)
const showWorkspace = ref(false)
const showSaveMenu = ref(false)
const builderRef = ref(null)

function triggerSave() {
  if (builderRef.value && builderRef.value.save) builderRef.value.save()
}

// Pull a human-readable message out of an axios error (DRF returns field errors on 400).
function extractApiError(e) {
  const d = e && e.response && e.response.data
  if (!d) return (e && e.message) || 'Unknown error'
  if (typeof d === 'string') return d
  if (d.error) return d.error
  if (d.detail) return d.detail
  try {
    return Object.entries(d)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join(' · ')
  } catch (_) {
    return (e && e.message) || 'Request failed'
  }
}

function blankAgent() {
  return {
    name: '',
    description: '',
    tool_ids: [],
    code_mode_enabled: false,
    code_mode_services: [],
    builder_mode_enabled: false,
    prompt_mode: 'append',
    max_history_messages: 0,  // 0 = Auto (backend manages history by token budget + summarization)
  }
}

async function load() {
  loading.value = true
  const id = route.params.id
  if (id && id !== 'new') {
    try {
      const res = await api.get(`/agents/${id}/`)
      const a = res.data || {}
      if (!a.tool_ids && a.tools) a.tool_ids = a.tools.map(t => t.id)
      if (!a.tool_ids) a.tool_ids = []
      agent.value = a
    } catch (e) {
      console.error('Failed to load agent', e)
      agent.value = blankAgent()
    }
  } else {
    agent.value = blankAgent()
  }
  loading.value = false
}

async function saveAgent(agentData) {
  try {
    saving.value = true
    const dataToSave = agentData || agent.value
    let res
    if (dataToSave.id) {
      res = await api.patch(`/agents/${dataToSave.id}/`, dataToSave)
    } else {
      res = await api.post('/agents/', dataToSave)
      // Switch to edit mode (stay in dashboard shell) to prevent duplicate creates
      router.replace(`/dashboard/agents/${res.data.id}/configure`)
    }
    const a = res.data
    if (!a.tool_ids && a.tools) a.tool_ids = a.tools.map(t => t.id)
    agent.value = a
    return a
  } catch (e) {
    notify.error('Failed to save agent: ' + extractApiError(e))
    return null
  } finally {
    saving.value = false
  }
}

function goBack() {
  router.push('/dashboard/agents')
}

// Reload when navigating between agents (e.g. new -> configure/:id)
watch(() => route.params.id, () => load())
onMounted(load)
</script>
