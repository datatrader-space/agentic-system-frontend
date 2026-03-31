<template>
  <div class="mcp-container p-6 lg:p-8 space-y-8">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
             <div class="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center shrink-0">
                 <svg class="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
             </div>
             MCP Servers
          </h1>
          <p class="mt-1.5 text-sm sm:text-base text-slate-500">
            Model Context Protocol servers for extended tool capabilities
          </p>
        </div>
        <div class="flex items-center gap-3">
          <OwnerFilter v-model="ownerFilter" @update:modelValue="loadServers" />
          <button
            @click="showRegistrationModal = true"
            class="px-5 py-2.5 bg-slate-900 text-white rounded-[10px] hover:bg-slate-800 transition-all font-semibold shadow-[0_2px_4px_rgba(0,0,0,0.1)] text-[13px] flex items-center gap-2"
          >
            <svg class="w-4 h-4 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
            Add MCP Server
          </button>
        </div>
      </div>

      <!-- Integrated Metrics Bar -->
      <div class="bg-white rounded-[16px] shadow-sm border border-slate-200/60 overflow-hidden mb-8">
        <div class="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          <div class="p-5 sm:p-6 lg:px-8 flex flex-col justify-center">
            <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Total Servers</p>
            <span class="text-3xl font-bold tracking-tight text-slate-900">{{ servers.length }}</span>
          </div>
          <div class="p-5 sm:p-6 lg:px-8 flex flex-col justify-center border-l-0 md:border-l border-slate-100">
            <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Active</p>
            <span class="text-3xl font-bold tracking-tight text-emerald-600">{{ activeCount }}</span>
          </div>
          <div class="p-5 sm:p-6 lg:px-8 flex flex-col justify-center">
            <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Total Tools</p>
            <span class="text-3xl font-bold tracking-tight text-purple-600">{{ totalTools }}</span>
          </div>
          <div class="p-5 sm:p-6 lg:px-8 flex flex-col justify-center border-l-0 md:border-l border-slate-100">
            <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Active Sessions</p>
            <span class="text-3xl font-bold tracking-tight text-blue-600">{{ sessionCount }}</span>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        <p class="mt-4 text-gray-600">Loading MCP servers...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="servers.length === 0" class="bg-white rounded-lg shadow-lg p-12 text-center">
        <div class="text-6xl mb-4">🔌</div>
        <h2 class="text-2xl font-bold text-gray-900 mb-2">No MCP Servers Yet</h2>
        <p class="text-gray-600 mb-6 max-w-md mx-auto">
          Add your first MCP server to extend your agent's capabilities.
          Connect to GitHub, Filesystem, Slack, or any MCP-compatible server.
        </p>
        <button
          @click="showRegistrationModal = true"
          class="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium"
        >
          Add Your First MCP Server
        </button>
      </div>

      <!-- Servers Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <MCPServerCard
          v-for="server in servers"
          :key="server.id"
          :server="server"
          @click="viewServer(server)"
          @edit="handleEditServer"
          @delete="handleDeleteServer"
          @toggle-enabled="handleToggleEnabled"
          @refresh-tools="handleRefreshTools"
          @reset-circuit-breaker="handleResetCircuitBreaker"
        />
      </div>

      <!-- Registration/Edit Modal -->
      <MCPServerModal
        v-if="showRegistrationModal"
        :server="editingServer"
        @close="closeModal"
        @saved="handleServerSaved"
      />

      <!-- Detail Modal -->
      <MCPServerDetailModal
        v-if="selectedServer"
        :server="selectedServer"
        @close="selectedServer = null"
        @updated="loadServers"
        @edit="handleEditServerFromDetail"
      />
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import api from '../services/api'
import MCPServerCard from '../components/mcp/MCPServerCard.vue'
import MCPServerModal from '../components/mcp/MCPServerModal.vue'
import MCPServerDetailModal from '../components/mcp/MCPServerDetailModal.vue'
import OwnerFilter from '../components/common/OwnerFilter.vue'

export default {
  name: 'MCPServers',
  components: {
    MCPServerCard,
    MCPServerModal,
    MCPServerDetailModal,
    OwnerFilter
  },
  setup() {
    const servers = ref([])
    const sessions = ref([])
    const loading = ref(false)
    const showRegistrationModal = ref(false)
    const selectedServer = ref(null)
    const editingServer = ref(null)
    const ownerFilter = ref('')

    // Computed stats
    const activeCount = computed(() => servers.value.filter(s => s.enabled).length)
    const totalTools = computed(() => servers.value.reduce((sum, s) => sum + (s.total_tools || 0), 0))
    const sessionCount = computed(() => sessions.value.length)

    // Methods
    const loadServers = async () => {
      loading.value = true
      try {
        const params = {}
        if (ownerFilter.value) params.owner = ownerFilter.value
        const response = await api.getMCPServers(params)
        servers.value = response.data.servers || []
      } catch (error) {
        console.error('Failed to load MCP servers:', error)
        alert('Failed to load MCP servers: ' + (error.response?.data?.error || error.message))
      } finally {
        loading.value = false
      }
    }

    const loadSessions = async () => {
      try {
        const response = await api.getMCPSessions()
        sessions.value = response.data.sessions || []
      } catch (error) {
        console.error('Failed to load sessions:', error)
      }
    }

    const viewServer = async (server) => {
      try {
        const response = await api.getMCPServer(server.id)
        selectedServer.value = response.data
      } catch (error) {
        console.error('Failed to load server details:', error)
        alert('Failed to load server details')
      }
    }

    const handleEditServer = (server) => {
      editingServer.value = server
      showRegistrationModal.value = true
    }

    const handleEditServerFromDetail = () => {
      // Close detail modal and open edit modal with server data
      const serverData = selectedServer.value?.server
      if (serverData) {
        editingServer.value = serverData
        selectedServer.value = null
        showRegistrationModal.value = true
      }
    }

    const closeModal = () => {
      showRegistrationModal.value = false
      editingServer.value = null
    }

    const handleServerSaved = async () => {
      closeModal()
      await loadServers()
      alert('MCP server saved successfully!')
    }

    const handleDeleteServer = async (serverId) => {
      if (!confirm('Are you sure you want to delete this MCP server?')) {
        return
      }

      try {
        await api.deleteMCPServer(serverId)
        await loadServers()
        alert('MCP server deleted successfully')
      } catch (error) {
        console.error('Failed to delete server:', error)
        alert('Failed to delete server: ' + (error.response?.data?.error || error.message))
      }
    }

    const handleToggleEnabled = async (serverId, enabled) => {
      try {
        await api.updateMCPServer(serverId, { enabled })
        await loadServers()
      } catch (error) {
        console.error('Failed to update server:', error)
        alert('Failed to update server')
      }
    }

    const handleRefreshTools = async (serverId) => {
      try {
        await api.refreshMCPTools(serverId)
        await loadServers()
        alert('Tools refresh scheduled')
      } catch (error) {
        console.error('Failed to refresh tools:', error)
        alert('Failed to refresh tools: ' + (error.response?.data?.error || error.message))
      }
    }

    const handleResetCircuitBreaker = async (serverId) => {
      try {
        await api.resetMCPCircuitBreaker(serverId)
        await loadServers()
        alert('Circuit breaker reset')
      } catch (error) {
        console.error('Failed to reset circuit breaker:', error)
        alert('Failed to reset circuit breaker')
      }
    }

    onMounted(() => {
      loadServers()
      loadSessions()
    })

    return {
      servers,
      sessions,
      loading,
      showRegistrationModal,
      selectedServer,
      editingServer,
      ownerFilter,
      activeCount,
      totalTools,
      sessionCount,
      viewServer,
      loadServers,
      handleEditServer,
      handleEditServerFromDetail,
      closeModal,
      handleServerSaved,
      handleDeleteServer,
      handleToggleEnabled,
      handleRefreshTools,
      handleResetCircuitBreaker
    }
  }
}
</script>

<style scoped>
.mcp-container {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
