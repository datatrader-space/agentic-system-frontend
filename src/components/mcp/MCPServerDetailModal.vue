<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
      <!-- Header -->
      <div class="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-lg shrink-0">
            {{ (server.server?.name || '?').charAt(0).toUpperCase() }}
          </div>
          <div>
            <h2 class="text-lg font-bold text-slate-900 leading-tight">{{ server.server?.name }}</h2>
            <div class="flex items-center gap-2 text-[13px] mt-0.5">
              <span class="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">{{ transportLabel }}</span>
              <span class="flex items-center gap-1" :class="server.server?.enabled ? 'text-emerald-600' : 'text-slate-400'">
                <span class="w-1.5 h-1.5 rounded-full" :class="server.server?.enabled ? 'bg-emerald-500' : 'bg-slate-300'"></span>
                {{ server.server?.enabled ? 'Enabled' : 'Disabled' }}
              </span>
            </div>
          </div>
        </div>
        <button @click="$emit('close')" class="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
      </div>

      <!-- Tabs -->
      <div class="px-6 pt-3 flex gap-1 border-b border-slate-100">
        <button v-for="t in [{k:'overview',l:'Overview'},{k:'tools',l:`Tools (${server.tools?.length || 0})`},{k:'test',l:'Try a tool'}]"
          :key="t.k" @click="activeTab = t.k" type="button"
          class="px-3.5 py-2 text-[13px] font-semibold rounded-t-lg -mb-px border-b-2 transition-colors"
          :class="activeTab === t.k ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'">
          {{ t.l }}
        </button>
      </div>

      <div class="p-6 overflow-y-auto flex-1">
        <!-- Overview Tab -->
        <div v-if="activeTab === 'overview'">
          <div class="grid grid-cols-2 gap-4 mb-5">
            <div class="bg-slate-50 border border-slate-100 p-4 rounded-xl text-center">
              <div class="text-2xl font-bold text-indigo-600">{{ server.tools?.length || 0 }}</div>
              <div class="text-[13px] text-slate-500 mt-0.5">Tools available</div>
            </div>
            <div class="bg-slate-50 border border-slate-100 p-4 rounded-xl text-center">
              <div class="text-2xl font-bold" :class="server.server?.enabled ? 'text-emerald-600' : 'text-slate-400'">
                {{ server.server?.enabled ? 'Enabled' : 'Disabled' }}
              </div>
              <div class="text-[13px] text-slate-500 mt-0.5">Status</div>
            </div>
          </div>

          <div class="mb-4">
            <h3 class="text-[13px] font-semibold text-slate-700 mb-1.5">{{ isLocal ? 'Runs' : 'Endpoint' }}</h3>
            <div class="bg-slate-50 border border-slate-200 text-slate-700 px-3 py-2.5 rounded-lg font-mono text-[12px] break-all">
              {{ endpointDisplay }}
            </div>
          </div>

          <div v-if="loading" class="text-[13px] text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-2">
            <span class="animate-spin inline-block">⟳</span> Loading tools…
          </div>
          <div v-else-if="loadError" class="text-[13px] bg-red-50 border border-red-200 rounded-xl p-3">
            <p class="font-semibold text-red-800">Failed to load tools</p>
            <p class="text-red-700 mt-0.5">{{ loadError.message }}</p>
            <ul v-if="loadError.steps" class="list-disc ml-4 mt-1.5 text-red-600 text-[12px] space-y-0.5">
              <li v-for="(s, i) in loadError.steps" :key="i">{{ s }}</li>
            </ul>
            <button @click="refreshTools(false)" class="mt-2 text-[12px] font-semibold text-indigo-600 hover:text-indigo-700">Try again</button>
          </div>
          <div v-else-if="server.tools?.length" class="text-[13px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
            ✓ Connected — {{ server.tools.length }} tool{{ server.tools.length === 1 ? '' : 's' }} ready.
          </div>
          <p v-else class="text-[13px] text-slate-500 bg-amber-50 border border-amber-200 rounded-xl p-3">
            No tools found on this server.
          </p>
        </div>

        <!-- Tools Tab -->
        <div v-else-if="activeTab === 'tools'">
          <div v-if="server.tools?.length" class="space-y-2">
            <div v-for="tool in server.tools" :key="tool.name"
              class="p-4 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
              @click="selectToolForTest(tool)">
              <div class="flex justify-between items-start gap-3">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-semibold text-slate-900 text-[14px]">{{ tool.name }}</span>
                    <span class="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full font-semibold">MCP</span>
                  </div>
                  <p class="text-[13px] text-slate-500 mt-1">{{ tool.description || 'No description' }}</p>
                  <div v-if="tool.inputSchema?.required?.length" class="mt-2 flex flex-wrap gap-1">
                    <span v-for="req in tool.inputSchema.required" :key="req" class="text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">{{ req }}</span>
                  </div>
                </div>
                <button @click.stop="selectToolForTest(tool)"
                  class="px-3 py-1.5 text-[12px] font-semibold bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 whitespace-nowrap">Try →</button>
              </div>
            </div>
          </div>
          <div v-else class="text-center py-10">
            <p v-if="loading" class="text-slate-500"><span class="animate-spin inline-block">⟳</span> Loading tools…</p>
            <div v-else-if="loadError" class="inline-block text-left max-w-md text-[13px] bg-red-50 border border-red-200 rounded-xl p-3">
              <p class="font-semibold text-red-800">Failed to load tools</p>
              <p class="text-red-700 mt-0.5">{{ loadError.message }}</p>
              <ul v-if="loadError.steps" class="list-disc ml-4 mt-1.5 text-red-600 text-[12px] space-y-0.5">
                <li v-for="(s, i) in loadError.steps" :key="i">{{ s }}</li>
              </ul>
              <button @click="refreshTools(false)" class="mt-2 text-[12px] font-semibold text-indigo-600 hover:text-indigo-700">Try again</button>
            </div>
            <template v-else>
              <p class="text-slate-500 text-[13px]">No tools discovered yet.</p>
              <button @click="handleRefreshTools" class="mt-2 text-[13px] font-semibold text-indigo-600 hover:text-indigo-700">Refresh tools</button>
            </template>
          </div>
        </div>

        <!-- Try a tool Tab -->
        <div v-else-if="activeTab === 'test'" class="space-y-4">
          <div>
            <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">Pick a tool to try</label>
            <select v-model="selectedToolName"
              class="w-full px-3 py-2 text-[14px] border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none">
              <option value="">— Select a tool —</option>
              <option v-for="tool in server.tools" :key="tool.name" :value="tool.name">{{ tool.name }}</option>
            </select>
          </div>

          <div v-if="selectedTool" class="bg-slate-50 border border-slate-100 p-4 rounded-xl space-y-4">
            <div>
              <h4 class="font-semibold text-slate-900 text-[14px]">{{ selectedTool.name }}</h4>
              <p class="text-[13px] text-slate-500">{{ selectedTool.description }}</p>
            </div>
            <div v-if="selectedTool.inputSchema?.properties" class="space-y-3">
              <div v-for="(prop, propName) in selectedTool.inputSchema.properties" :key="propName">
                <label class="block text-[13px] text-slate-700 mb-1">
                  {{ propName }}
                  <span v-if="selectedTool.inputSchema.required?.includes(propName)" class="text-red-500">*</span>
                  <span class="text-slate-400 text-[11px] ml-1">{{ prop.type }}</span>
                </label>
                <input v-model="toolParams[propName]" :type="prop.type === 'number' ? 'number' : 'text'"
                  :placeholder="prop.description || propName"
                  class="w-full px-3 py-2 text-[13px] border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500">
              </div>
            </div>
            <button @click="executeTool" :disabled="executing"
              class="w-full px-4 py-2 bg-indigo-600 text-white text-[13px] font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
              <span v-if="executing" class="animate-spin">⟳</span>{{ executing ? 'Running…' : 'Run' }}
            </button>
          </div>

          <div v-if="executionResult" class="rounded-xl overflow-hidden border border-slate-200">
            <div class="px-3 py-2 text-[13px] font-semibold" :class="executionResult.success ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'">
              {{ executionResult.success ? '✓ Success' : '✗ Error' }}
              <span class="font-normal ml-2 opacity-70">{{ executionResult.duration }}ms</span>
            </div>
            <pre class="bg-slate-900 text-slate-200 p-3 overflow-x-auto text-[12px] whitespace-pre-wrap">{{ JSON.stringify(executionResult.result, null, 2) }}</pre>
          </div>

          <div v-if="!selectedTool" class="text-center py-8 text-slate-400 text-[13px]">
            Pick a tool above, or hit “Try →” on a tool in the Tools tab.
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-slate-100 flex gap-3">
        <button @click="$emit('edit')"
          class="flex-1 px-4 py-2 text-[13px] font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition">Edit server</button>
        <button @click="handleRefreshTools" :disabled="refreshing"
          class="flex-1 px-4 py-2 text-[13px] font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition">
          {{ refreshing ? 'Refreshing…' : 'Refresh tools' }}
        </button>
        <button @click="$emit('close')"
          class="px-4 py-2 text-[13px] font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition">Close</button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, reactive, watch, onMounted } from 'vue'
import api from '../../services/api'
import { notify } from '@/composables/useNotify'

export default {
  name: 'MCPServerDetailModal',
  props: {
    server: {
      type: Object,
      required: true
    }
  },
  emits: ['close', 'updated', 'edit'],
  setup(props, { emit }) {
    const activeTab = ref('overview')
    const refreshing = ref(false)
    const executing = ref(false)
    const selectedToolName = ref('')
    const toolParams = reactive({})
    const executionResult = ref(null)

    const isLocal = computed(() => props.server.server?.transport_type === 'stdio')
    const transportLabel = computed(() => isLocal.value ? 'Local program' : 'Hosted (URL)')
    // `command` holds the endpoint URL for hosted servers (get_command_display) and the run command
    // for local ones — so it's the right field for both (endpoint_url isn't in the safe payload).
    const endpointDisplay = computed(() => {
      const sv = props.server.server || {}
      return sv.command || sv.endpoint_url || '—'
    })

    const selectedTool = computed(() => {
      if (!selectedToolName.value || !props.server.tools) return null
      return props.server.tools.find(t => t.name === selectedToolName.value)
    })

    // Reset params when tool changes
    watch(selectedToolName, () => {
      Object.keys(toolParams).forEach(key => delete toolParams[key])
      executionResult.value = null
    })

    const selectToolForTest = (tool) => {
      selectedToolName.value = tool.name
      activeTab.value = 'test'
    }

    // Tool loading state — auto-loads on open; surfaces a clear failure (with remediation) if it can't.
    const loading = ref(false)
    const loadError = ref(null)   // { message, steps? }

    const refreshTools = async (silent = false) => {
      if (loading.value) return
      loading.value = true
      refreshing.value = true
      loadError.value = null
      try {
        const response = await api.testMCPConnection(props.server.server.id)
        const d = response.data || {}
        if (d.success === false) {
          loadError.value = { message: d.error || 'Could not load tools.', steps: d.remediation?.steps }
        } else {
          if (!silent) notify.show(`Loaded ${d.tools_count ?? d.tools?.length ?? 0} tools from ${d.server_name || 'the server'}`)
          emit('updated')   // parent refreshes the server so tools render
        }
      } catch (error) {
        const d = error.response?.data || {}
        loadError.value = { message: d.error || error.message || 'Failed to load tools.', steps: d.remediation?.steps }
        if (!silent) notify.error('Failed to load tools: ' + loadError.value.message)
      } finally {
        loading.value = false
        refreshing.value = false
      }
    }
    const handleRefreshTools = () => refreshTools(false)

    // Auto-load tools when the server has none cached yet (so the user doesn't have to click Refresh).
    onMounted(() => {
      if (!props.server.tools?.length) refreshTools(true)
    })

    const executeTool = async () => {
      if (!selectedTool.value) return
      
      executing.value = true
      executionResult.value = null
      
      const startTime = Date.now()
      
      try {
        // Convert reactive object to plain object
        const args = JSON.parse(JSON.stringify(toolParams))
        
        // Call the MCP execute endpoint directly
        const response = await api.executeMCPTool(
          props.server.server.id,
          selectedTool.value.name,
          args
        )
        
        executionResult.value = {
          success: response.data.success,
          result: response.data.result || response.data,
          duration: Date.now() - startTime
        }
      } catch (error) {
        executionResult.value = {
          success: false,
          result: error.response?.data || { error: error.message },
          duration: Date.now() - startTime
        }
      } finally {
        executing.value = false
      }
    }

    return {
      activeTab,
      refreshing,
      loading,
      loadError,
      executing,
      selectedToolName,
      selectedTool,
      toolParams,
      executionResult,
      isLocal,
      transportLabel,
      endpointDisplay,
      selectToolForTest,
      handleRefreshTools,
      refreshTools,
      executeTool
    }
  }
}
</script>
