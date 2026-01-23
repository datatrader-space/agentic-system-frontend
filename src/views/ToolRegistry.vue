<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20">
    <div class="max-w-[1400px] mx-auto px-6 py-8">
      <!-- Hero Header -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h1 class="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
              Tool Marketplace
            </h1>
            <p class="text-gray-600 text-lg">Discover and manage powerful AI agent tools</p>
          </div>
          <button
            @click="showRegisterModal = true"
            class="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 font-semibold flex items-center gap-2"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Add New Tool
          </button>
        </div>

        <!-- Stats Cards -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div class="bg-white/80 backdrop-blur-sm p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-sm font-medium text-gray-600 mb-1">Total Tools</div>
                <div class="text-3xl font-bold text-gray-900">{{ totalTools }}</div>
              </div>
              <div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>
          </div>

          <div class="bg-white/80 backdrop-blur-sm p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-sm font-medium text-gray-600 mb-1">Active</div>
                <div class="text-3xl font-bold text-green-600">{{ enabledCount }}</div>
              </div>
              <div class="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div class="bg-white/80 backdrop-blur-sm p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-sm font-medium text-gray-600 mb-1">Categories</div>
                <div class="text-3xl font-bold text-purple-600">{{ categoriesCount }}</div>
              </div>
              <div class="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
            </div>
          </div>

          <div class="bg-white/80 backdrop-blur-sm p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-sm font-medium text-gray-600 mb-1">Executions</div>
                <div class="text-3xl font-bold text-orange-600">{{ recentExecutions }}</div>
              </div>
              <div class="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <svg class="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <!-- Search and Filter Bar -->
        <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-100 p-4">
          <div class="flex flex-col md:flex-row gap-4">
            <!-- Search -->
            <div class="flex-1 relative">
              <svg class="w-5 h-5 text-gray-400 absolute left-4 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search tools by name or description..."
                class="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50/50"
              />
            </div>

            <!-- Category Filter -->
            <div class="relative">
              <select
                v-model="selectedCategory"
                class="px-6 py-3 pr-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-gray-50/50 font-medium min-w-[200px]"
              >
                <option value="">All Categories</option>
                <option v-for="cat in categories" :key="cat" :value="cat">
                  {{ getCategoryIcon(cat) }} {{ formatCategoryName(cat) }}
                </option>
              </select>
              <svg class="w-5 h-5 text-gray-400 absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            <!-- View Toggle -->
            <div class="flex bg-gray-100 rounded-xl p-1">
              <button
                @click="viewMode = 'grid'"
                :class="[
                  'px-4 py-2 rounded-lg transition-all font-medium text-sm',
                  viewMode === 'grid'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                ]"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                @click="viewMode = 'list'"
                :class="[
                  'px-4 py-2 rounded-lg transition-all font-medium text-sm',
                  viewMode === 'list'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                ]"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-20">
        <div class="relative">
          <div class="w-16 h-16 border-4 border-blue-200 rounded-full"></div>
          <div class="w-16 h-16 border-4 border-blue-600 rounded-full animate-spin border-t-transparent absolute top-0 left-0"></div>
        </div>
        <p class="mt-6 text-gray-600 font-medium">Loading tools...</p>
      </div>

      <!-- Tools by Category -->
      <div v-else class="space-y-8">
        <div v-for="(tools, category) in filteredToolsByCategory" :key="category">
          <!-- Category Header -->
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-2xl">
                {{ getCategoryIcon(category) }}
              </div>
              <div>
                <h2 class="text-2xl font-bold text-gray-900">{{ formatCategoryName(category) }}</h2>
                <p class="text-sm text-gray-500">{{ tools.length }} {{ tools.length === 1 ? 'tool' : 'tools' }} available</p>
              </div>
            </div>
          </div>

          <!-- Tools Grid/List -->
          <div
            :class="[
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                : 'space-y-4'
            ]"
          >
            <ToolCard
              v-for="tool in tools"
              :key="tool.name"
              :tool="tool"
              :view-mode="viewMode"
              @execute="openExecuteModal"
              @view-details="viewToolDetails"
            />
          </div>
        </div>

        <!-- No Results -->
        <div v-if="Object.keys(filteredToolsByCategory).length === 0" class="text-center py-20">
          <div class="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 class="text-xl font-semibold text-gray-900 mb-2">No tools found</h3>
          <p class="text-gray-500 mb-6">Try adjusting your search or filters</p>
          <button
            @click="searchQuery = ''; selectedCategory = ''"
            class="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-medium"
          >
            Clear Filters
          </button>
        </div>
      </div>

      <!-- Execute Tool Modal -->
      <ToolExecuteModal
        v-if="showExecuteModal"
        :tool="selectedTool"
        :repositories="repositories"
        @close="showExecuteModal = false"
        @execute="executeToolWithParams"
      />

      <!-- Register Tool Modal -->
      <RegisterToolModal
        :show="showRegisterModal"
        @close="showRegisterModal = false"
        @registered="handleToolRegistered"
      />

      <!-- Execution Results Panel -->
      <ExecutionResultsPanel
        v-if="executionResults.length > 0"
        :results="executionResults"
        @clear="executionResults = []"
      />
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import api from '../services/api'
import ToolCard from '../components/tools/ToolCard.vue'
import ToolExecuteModal from '../components/tools/ToolExecuteModal.vue'
import ExecutionResultsPanel from '../components/tools/ExecutionResultsPanel.vue'
import RegisterToolModal from '../components/tools/RegisterToolModal.vue'

export default {
  name: 'ToolRegistry',
  components: {
    ToolCard,
    ToolExecuteModal,
    ExecutionResultsPanel,
    RegisterToolModal
  },
  setup() {
    const tools = ref([])
    const toolsByCategory = ref({})
    const categories = ref([])
    const repositories = ref([])
    const loading = ref(false)

    const searchQuery = ref('')
    const selectedCategory = ref('')
    const viewMode = ref('grid')

    const showExecuteModal = ref(false)
    const showRegisterModal = ref(false)
    const selectedTool = ref(null)

    const executionResults = ref([])

    // Stats
    const totalTools = computed(() => tools.value.length)
    const enabledCount = computed(() => tools.value.filter(t => t.enabled).length)
    const categoriesCount = computed(() => categories.value.length)
    const recentExecutions = computed(() => executionResults.value.length)

    // Filtered tools
    const filteredTools = computed(() => {
      let filtered = tools.value

      if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase()
        filtered = filtered.filter(t =>
          t.name.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query)
        )
      }

      if (selectedCategory.value) {
        filtered = filtered.filter(t => t.category === selectedCategory.value)
      }

      return filtered
    })

    const filteredToolsByCategory = computed(() => {
      const grouped = {}
      filteredTools.value.forEach(tool => {
        if (!grouped[tool.category]) {
          grouped[tool.category] = []
        }
        grouped[tool.category].push(tool)
      })
      return grouped
    })

    // Methods
    const loadTools = async () => {
      loading.value = true
      try {
        const response = await api.get('/tools/')
        tools.value = response.data.tools
        toolsByCategory.value = response.data.by_category
        categories.value = response.data.categories
      } catch (error) {
        console.error('Failed to load tools:', error)
      } finally {
        loading.value = false
      }
    }

    const loadRepositories = async () => {
      try {
        const response = await api.get('/systems/')
        const allRepos = []
        response.data.forEach(system => {
          if (system.repositories) {
            system.repositories.forEach(repo => {
              allRepos.push({
                ...repo,
                system_name: system.name
              })
            })
          }
        })
        repositories.value = allRepos
      } catch (error) {
        console.error('Failed to load repositories:', error)
      }
    }

    const openExecuteModal = (tool) => {
      selectedTool.value = tool
      showExecuteModal.value = true
    }

    const viewToolDetails = (tool) => {
      console.log('View details for:', tool)
    }

    const executeToolWithParams = async (execution) => {
      try {
        const response = await api.post('/api/tools/execute/', {
          tool_name: execution.tool.name,
          parameters: execution.parameters,
          repository_id: execution.repository_id,
          session_id: execution.session_id
        })

        executionResults.value.unshift({
          id: Date.now(),
          tool_name: execution.tool.name,
          timestamp: new Date().toISOString(),
          ...response.data
        })

        showExecuteModal.value = false
      } catch (error) {
        console.error('Tool execution failed:', error)
        executionResults.value.unshift({
          id: Date.now(),
          tool_name: execution.tool.name,
          timestamp: new Date().toISOString(),
          success: false,
          error: error.response?.data?.error || error.message
        })
      }
    }

    const getCategoryIcon = (category) => {
      const icons = {
        'crs': '🔍',
        'shell': '💻',
        'filesystem': '📁',
        'git': '🌿',
        'testing': '✅',
        'network': '🌐',
        'database': '🗄️',
        'custom': '⚙️',
        'jira': '📋',
        'remote': '🌐'
      }
      return icons[category] || '🔧'
    }

    const formatCategoryName = (category) => {
      return category.charAt(0).toUpperCase() + category.slice(1)
    }

    const handleToolRegistered = async () => {
      await loadTools()
      showRegisterModal.value = false
      alert('Tool registered successfully!')
    }

    onMounted(() => {
      loadTools()
      loadRepositories()
    })

    return {
      tools,
      toolsByCategory,
      categories,
      repositories,
      loading,
      searchQuery,
      selectedCategory,
      viewMode,
      showExecuteModal,
      showRegisterModal,
      selectedTool,
      executionResults,
      totalTools,
      enabledCount,
      categoriesCount,
      recentExecutions,
      filteredToolsByCategory,
      openExecuteModal,
      viewToolDetails,
      executeToolWithParams,
      getCategoryIcon,
      formatCategoryName,
      handleToolRegistered
    }
  }
}
</script>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-in {
  animation: fadeIn 0.5s ease-out;
}
</style>
