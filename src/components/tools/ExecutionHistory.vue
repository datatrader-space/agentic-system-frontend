<template>
  <div class="execution-history h-full flex flex-col bg-white">
    <!-- Header -->
    <div class="p-6 border-b border-gray-200">
      <h2 class="text-2xl font-bold text-gray-900 mb-4">Execution History</h2>
      
      <!-- Filters -->
      <div class="flex gap-4">
        <input
          v-model="filters.tool_name"
          type="text"
          placeholder="Filter by tool name..."
          class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <select
          v-model="filters.status"
          class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Status</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
        </select>
        <button
          @click="loadHistory"
          class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Refresh
        </button>
      </div>
    </div>

    <!-- History Table -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="loading" class="flex items-center justify-center h-full">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p class="text-gray-600">Loading history...</p>
        </div>
      </div>

      <div v-else-if="executions.length === 0" class="flex flex-col items-center justify-center h-full text-gray-400">
        <div class="text-5xl mb-3">📜</div>
        <p class="text-lg font-medium">No execution history</p>
        <p class="text-sm mt-1">Tool executions will appear here</p>
      </div>

      <table v-else class="w-full">
        <thead class="bg-gray-50 sticky top-0">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tool</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trace ID</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr
            v-for="execution in executions"
            :key="execution.id"
            class="hover:bg-gray-50 cursor-pointer"
            @click="viewDetails(execution)"
          >
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
              {{ formatDate(execution.executed_at) }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
              {{ execution.tool_name }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span
                :class="[
                  'px-2 py-1 text-xs font-semibold rounded-full',
                  execution.success
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                ]"
              >
                {{ execution.success ? 'Success' : 'Error' }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {{ execution.duration_ms }}ms
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
              {{ execution.trace_id?.substring(0, 8) }}...
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">
              <button
                @click.stop="replay(execution)"
                class="text-blue-600 hover:text-blue-800 font-medium"
              >
                Replay
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="executions.length > 0" class="p-4 border-t border-gray-200 flex items-center justify-between">
      <div class="text-sm text-gray-600">
        Showing {{ executions.length }} results
      </div>
      <div class="flex gap-2">
        <button
          @click="previousPage"
          :disabled="currentPage === 1"
          class="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <button
          @click="nextPage"
          class="px-4 py-2 border border-gray-300 rounded-lg"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { toolsApi } from '../../services/toolsApi'

export default {
  name: 'ExecutionHistory',
  props: {
    agentProfile: {
      type: Object,
      required: true
    }
  },
  setup() {
    const executions = ref([])
    const loading = ref(true)
    const currentPage = ref(1)
    const filters = ref({
      tool_name: '',
      status: ''
    })

    const loadHistory = async () => {
      try {
        loading.value = true
        const response = await toolsApi.getHistory({
          page: currentPage.value,
          page_size: 50,
          ...filters.value
        })
        executions.value = response.data.results || []
      } catch (error) {
        console.error('Failed to load history:', error)
      } finally {
        loading.value = false
      }
    }

    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleString()
    }

    const viewDetails = (execution) => {
      console.log('View details:', execution)
      // TODO: Open details drawer
    }

    const replay = async (execution) => {
      if (confirm('Replay this execution?')) {
        try {
          await toolsApi.replayExecution(execution.id)
          alert('Execution replayed successfully')
          loadHistory()
        } catch (error) {
          alert('Failed to replay: ' + error.message)
        }
      }
    }

    const previousPage = () => {
      if (currentPage.value > 1) {
        currentPage.value--
        loadHistory()
      }
    }

    const nextPage = () => {
      currentPage.value++
      loadHistory()
    }

    onMounted(() => {
      loadHistory()
    })

    return {
      executions,
      loading,
      filters,
      currentPage,
      loadHistory,
      formatDate,
      viewDetails,
      replay,
      previousPage,
      nextPage
    }
  }
}
</script>
