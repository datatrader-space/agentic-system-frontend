<template>
  <div class="tool-catalog h-full flex flex-col bg-white">
    <!-- Header with Search and Filters -->
    <div class="p-3 sm:p-6 border-b border-gray-200 shrink-0">
      <div class="flex items-center justify-between mb-3 sm:mb-4">
        <h2 class="text-lg sm:text-2xl font-bold text-gray-900">Tool Catalog</h2>
        <div class="flex gap-2">
          <button
            @click="viewMode = 'grid'"
            :class="[
              'px-3 py-2 rounded-lg',
              viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
            ]"
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            @click="viewMode = 'list'"
            :class="[
              'px-3 py-2 rounded-lg',
              viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
            ]"
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Search Bar -->
      <div class="relative">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search tools by name or description..."
          class="w-full px-3 sm:px-4 py-2.5 sm:py-3 pl-10 sm:pl-12 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <svg class="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
    </div>

    <!-- Tools Grid/List -->
    <div class="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6">
      <div v-if="loading" class="flex items-center justify-center h-full">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p class="text-gray-600">Loading tools...</p>
        </div>
      </div>

      <div v-else-if="filteredTools.length === 0" class="flex flex-col items-center justify-center h-full text-gray-400">
        <div class="text-5xl mb-3">🔍</div>
        <p class="text-lg font-medium">No tools found</p>
        <p class="text-sm mt-1">Try adjusting your search or filters</p>
      </div>

      <div v-else :class="viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'">
        <ToolCard
          v-for="tool in filteredTools"
          :key="tool.name"
          :tool="tool"
          :view-mode="viewMode"
          @execute="handleExecute"
          @view-details="handleViewDetails"
        />
      </div>
    </div>

    <!-- Execute Modal -->
    <ToolExecuteModal
      v-if="showExecuteModal"
      :tool="selectedTool"
      :repositories="repositories"
      @close="showExecuteModal = false"
      @execute="executeToolWithParams"
    />

    <!-- Results Modal -->
    <div v-if="showResults" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showResults = false">
      <div class="bg-white rounded-xl p-6 max-w-3xl w-full max-h-[80vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-xl font-bold">Execution Result</h3>
          <button @click="showResults = false" class="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>
        
        <div v-if="executionResult.success" class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <div class="flex items-center gap-2 text-green-800 font-medium mb-2">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            Success
          </div>
          <pre class="text-sm text-gray-800 whitespace-pre-wrap font-mono">{{ executionResult.output }}</pre>
        </div>

        <div v-else class="bg-red-50 border border-red-200 rounded-lg p-4">
          <div class="flex items-center gap-2 text-red-800 font-medium mb-2">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
            Error
          </div>
          <pre class="text-sm text-red-800 whitespace-pre-wrap">{{ executionResult.error }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { toolsApi } from '../../services/toolsApi'
import ToolCard from './ToolCard.vue'
import ToolExecuteModal from './ToolExecuteModal.vue'
import api from '../../services/api'

export default {
  name: 'ToolCatalog',
  components: {
    ToolCard,
    ToolExecuteModal
  },
  props: {
    agentProfile: {
      type: Object,
      required: true
    }
  },
  setup(props) {
    const tools = ref([])
    const loading = ref(true)
    const searchQuery = ref('')
    const viewMode = ref('grid')
    const showExecuteModal = ref(false)
    const selectedTool = ref(null)
    const repositories = ref([])
    const showResults = ref(false)
    const executionResult = ref({})

    const filteredTools = computed(() => {
      if (!searchQuery.value) return tools.value
      
      const query = searchQuery.value.toLowerCase()
      return tools.value.filter(tool => 
        tool.name.toLowerCase().includes(query) ||
        tool.description?.toLowerCase().includes(query) ||
        tool.category?.toLowerCase().includes(query)
      )
    })

    const loadTools = async () => {
      try {
        loading.value = true
        const response = await toolsApi.getCatalog()
        tools.value = response.data.tools || []
      } catch (error) {
        console.error('Failed to load tools:', error)
      } finally {
        loading.value = false
      }
    }

    const loadRepositories = async () => {
      try {
        const response = await api.getSystems()
        const systems = response.data.results || response.data
        
        // Load repositories from all systems
        const allRepos = []
        for (const system of systems) {
          const repoResponse = await api.getRepositories(system.id)
          const repos = repoResponse.data.results || repoResponse.data
          allRepos.push(...repos.map(r => ({ ...r, system_name: system.name })))
        }
        repositories.value = allRepos
      } catch (error) {
        console.error('Failed to load repositories:', error)
      }
    }

    const handleExecute = (tool) => {
      selectedTool.value = tool
      showExecuteModal.value = true
    }

    const handleViewDetails = (tool) => {
      console.log('View details:', tool)
      // TODO: Open details modal
    }

    const executeToolWithParams = async (executionData) => {
      try {
        showExecuteModal.value = false
        
        // Build execution payload with agent_id if available
        const payload = {
          ...executionData.parameters,
          repository_id: executionData.repository_id,
          session_id: executionData.session_id
        }
        
        // Add agent_id from agentProfile if available
        if (props.agentProfile && props.agentProfile.id) {
          payload.agent_id = props.agentProfile.id
        }
        
        const response = await toolsApi.executeTool(executionData.tool.name, payload)

        executionResult.value = response.data
        showResults.value = true
      } catch (error) {
        executionResult.value = {
          success: false,
          error: error.response?.data?.error || error.message || 'Execution failed'
        }
        showResults.value = true
      }
    }

    onMounted(() => {
      loadTools()
      loadRepositories()
    })

    return {
      tools,
      loading,
      searchQuery,
      viewMode,
      filteredTools,
      showExecuteModal,
      selectedTool,
      repositories,
      showResults,
      executionResult,
      handleExecute,
      handleViewDetails,
      executeToolWithParams
    }
  }
}
</script>
