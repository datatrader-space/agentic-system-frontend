<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-3">
            <span class="text-3xl">{{ server.server?.icon || '🔌' }}</span>
            <div>
              <h2 class="text-xl font-bold text-gray-900">{{ server.server?.name }}</h2>
              <div class="flex items-center gap-2 text-sm text-gray-600">
                <span class="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{{ server.server?.transport_type }}</span>
                <span>•</span>
                <span>{{ server.server?.lifecycle_mode }}</span>
              </div>
            </div>
          </div>
          <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>
      </div>

      <div class="p-6">
        <!-- Tabs -->
        <div class="flex border-b border-gray-200 mb-6">
          <button 
            @click="activeTab = 'overview'" 
            class="px-4 py-2 font-medium border-b-2 -mb-px"
            :class="activeTab === 'overview' ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'"
          >
            Overview
          </button>
          <button 
            @click="activeTab = 'tools'" 
            class="px-4 py-2 font-medium border-b-2 -mb-px"
            :class="activeTab === 'tools' ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'"
          >
            Tools ({{ server.tools?.length || 0 }})
          </button>
          <button 
            @click="activeTab = 'test'" 
            class="px-4 py-2 font-medium border-b-2 -mb-px"
            :class="activeTab === 'test' ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'"
          >
            🧪 Test Tool
          </button>
        </div>

        <!-- Overview Tab -->
        <div v-if="activeTab === 'overview'">
          <!-- Status Cards -->
          <div class="grid grid-cols-3 gap-4 mb-6">
            <div class="bg-gray-50 p-4 rounded-lg text-center">
              <div class="text-2xl font-bold text-purple-600">{{ server.tools?.length || 0 }}</div>
              <div class="text-sm text-gray-600">Tools Available</div>
            </div>
            <div class="bg-gray-50 p-4 rounded-lg text-center">
              <div class="text-2xl" :class="cbStatusClass">{{ cbStatus }}</div>
              <div class="text-sm text-gray-600">Circuit Breaker</div>
            </div>
            <div class="bg-gray-50 p-4 rounded-lg text-center">
              <div class="text-2xl font-bold" :class="server.server?.enabled ? 'text-green-600' : 'text-gray-400'">
                {{ server.server?.enabled ? 'Enabled' : 'Disabled' }}
              </div>
              <div class="text-sm text-gray-600">Status</div>
            </div>
          </div>

          <!-- Command Display -->
          <div v-if="server.server?.command" class="mb-6">
            <h3 class="font-medium text-gray-900 mb-2">Command</h3>
            <div class="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto">
              {{ server.server.command }} {{ server.server.args?.join(' ') }}
            </div>
          </div>

          <!-- Circuit Breaker Details -->
          <div v-if="server.circuit_breaker" class="mb-6">
            <h3 class="font-medium text-gray-900 mb-2">Circuit Breaker Status</h3>
            <div class="bg-gray-50 p-4 rounded-lg">
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span class="text-gray-600">State:</span>
                  <span class="ml-2 font-medium" :class="cbStatusClass">{{ server.circuit_breaker.state?.toUpperCase() }}</span>
                </div>
                <div>
                  <span class="text-gray-600">Failure Count:</span>
                  <span class="ml-2 font-medium">{{ server.circuit_breaker.failure_count || 0 }}</span>
                </div>
                <div>
                  <span class="text-gray-600">Threshold:</span>
                  <span class="ml-2 font-medium">{{ server.circuit_breaker.failure_threshold }}</span>
                </div>
                <div v-if="server.circuit_breaker.opened_at">
                  <span class="text-gray-600">Opened At:</span>
                  <span class="ml-2 font-medium">{{ formatDate(server.circuit_breaker.opened_at) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Server Configuration -->
          <details class="mb-6">
            <summary class="font-medium text-gray-900 cursor-pointer mb-2">Configuration Details</summary>
            <div class="bg-gray-50 p-4 rounded-lg">
              <pre class="text-xs text-gray-700 overflow-x-auto">{{ JSON.stringify(server.server, null, 2) }}</pre>
            </div>
          </details>
        </div>

        <!-- Tools Tab -->
        <div v-if="activeTab === 'tools'">
          <div v-if="server.tools?.length" class="space-y-2">
            <div
              v-for="tool in server.tools"
              :key="tool.name"
              class="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
              @click="selectToolForTest(tool)"
            >
              <div class="flex justify-between items-start">
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-gray-900">{{ tool.name }}</span>
                    <span class="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">MCP</span>
                  </div>
                  <p class="text-sm text-gray-600 mt-1">{{ tool.description || 'No description' }}</p>
                  <div v-if="tool.inputSchema?.required?.length" class="mt-2">
                    <span class="text-xs text-gray-500">Required: </span>
                    <span v-for="req in tool.inputSchema.required" :key="req" class="text-xs bg-gray-100 px-1.5 py-0.5 rounded mr-1">
                      {{ req }}
                    </span>
                  </div>
                </div>
                <button 
                  @click.stop="selectToolForTest(tool)"
                  class="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                >
                  Test →
                </button>
              </div>
            </div>
          </div>
          <div v-else class="text-center py-8 text-gray-500">
            <p>No tools discovered yet.</p>
            <button @click="handleRefreshTools" class="mt-2 text-purple-600 hover:text-purple-800">
              Refresh Tools
            </button>
          </div>
        </div>

        <!-- Test Tool Tab -->
        <div v-if="activeTab === 'test'" class="space-y-4">
          <!-- Tool Selector -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Select Tool to Test</label>
            <select 
              v-model="selectedToolName" 
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="">-- Select a tool --</option>
              <option v-for="tool in server.tools" :key="tool.name" :value="tool.name">
                {{ tool.name }}
              </option>
            </select>
          </div>

          <!-- Tool Details & Input -->
          <div v-if="selectedTool" class="bg-gray-50 p-4 rounded-lg space-y-4">
            <div>
              <h4 class="font-medium text-gray-900">{{ selectedTool.name }}</h4>
              <p class="text-sm text-gray-600">{{ selectedTool.description }}</p>
            </div>

            <!-- Parameter Inputs -->
            <div v-if="selectedTool.inputSchema?.properties" class="space-y-3">
              <h5 class="text-sm font-medium text-gray-700">Parameters</h5>
              <div v-for="(prop, propName) in selectedTool.inputSchema.properties" :key="propName">
                <label class="block text-sm text-gray-700 mb-1">
                  {{ propName }}
                  <span v-if="selectedTool.inputSchema.required?.includes(propName)" class="text-red-500">*</span>
                  <span class="text-gray-400 text-xs ml-1">({{ prop.type }})</span>
                </label>
                <input 
                  v-model="toolParams[propName]"
                  :type="prop.type === 'number' ? 'number' : 'text'"
                  :placeholder="prop.description || propName"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                <p v-if="prop.description" class="text-xs text-gray-500 mt-1">{{ prop.description }}</p>
              </div>
            </div>

            <!-- Execute Button -->
            <button
              @click="executeTool"
              :disabled="executing"
              class="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <span v-if="executing" class="animate-spin">⟳</span>
              {{ executing ? 'Executing...' : '▶️ Execute Tool' }}
            </button>
          </div>

          <!-- Execution Result -->
          <div v-if="executionResult" class="rounded-lg overflow-hidden">
            <div class="p-3" :class="executionResult.success ? 'bg-green-100' : 'bg-red-100'">
              <span class="font-medium" :class="executionResult.success ? 'text-green-800' : 'text-red-800'">
                {{ executionResult.success ? '✅ Success' : '❌ Error' }}
              </span>
              <span class="text-sm ml-2" :class="executionResult.success ? 'text-green-700' : 'text-red-700'">
                {{ executionResult.duration }}ms
              </span>
            </div>
            <div class="bg-gray-900 p-4 overflow-x-auto">
              <pre class="text-sm text-green-400 whitespace-pre-wrap">{{ JSON.stringify(executionResult.result, null, 2) }}</pre>
            </div>
          </div>

          <div v-if="!selectedTool" class="text-center py-8 text-gray-500">
            <p>Select a tool from the dropdown or click "Test →" on a tool in the Tools tab.</p>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-3 pt-6 border-t border-gray-200 mt-6">
          <button
            @click="$emit('edit')"
            class="flex-1 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition"
          >
            ✏️ Edit Server
          </button>
          <button
            @click="handleRefreshTools"
            :disabled="refreshing"
            class="flex-1 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition disabled:opacity-50"
          >
            {{ refreshing ? 'Refreshing...' : '🔄 Refresh Tools' }}
          </button>
          <button
            v-if="server.circuit_breaker?.state === 'open'"
            @click="handleResetCB"
            class="flex-1 px-4 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition"
          >
            ⚡ Reset Circuit Breaker
          </button>
          <button
            @click="$emit('close')"
            class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, reactive, watch } from 'vue'
import api from '../../services/api'

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

    const cbStatus = computed(() => {
      return props.server.circuit_breaker?.state?.toUpperCase() || 'CLOSED'
    })

    const cbStatusClass = computed(() => {
      const classes = {
        CLOSED: 'text-green-600',
        OPEN: 'text-red-600',
        HALF_OPEN: 'text-yellow-600'
      }
      return classes[cbStatus.value] || 'text-gray-600'
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

    const formatDate = (dateStr) => {
      if (!dateStr) return ''
      return new Date(dateStr).toLocaleString()
    }

    const handleRefreshTools = async () => {
      refreshing.value = true
      try {
        // Use test_connection which starts server and discovers tools
        const response = await api.testMCPConnection(props.server.server.id)
        if (response.data.success) {
          alert(`Discovered ${response.data.tools_count} tools from ${response.data.server_name}`)
        }
        emit('updated')
      } catch (error) {
        alert('Failed to refresh tools: ' + (error.response?.data?.error || error.message))
      } finally {
        refreshing.value = false
      }
    }

    const handleResetCB = async () => {
      try {
        await api.resetMCPCircuitBreaker(props.server.server.id)
        emit('updated')
      } catch (error) {
        alert('Failed to reset circuit breaker')
      }
    }

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
      executing,
      selectedToolName,
      selectedTool,
      toolParams,
      executionResult,
      cbStatus,
      cbStatusClass,
      formatDate,
      selectToolForTest,
      handleRefreshTools,
      handleResetCB,
      executeTool
    }
  }
}
</script>
