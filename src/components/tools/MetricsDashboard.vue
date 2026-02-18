<template>
  <div class="metrics-dashboard h-full flex flex-col bg-white overflow-y-auto">
    <!-- Header -->
    <div class="p-3 sm:p-6 border-b border-gray-200 shrink-0">
      <div class="flex items-center justify-between">
        <h2 class="text-lg sm:text-2xl font-bold text-gray-900">Metrics Dashboard</h2>
        <select
          v-model="timeRange"
          @change="loadMetrics"
          class="px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="1h">Last Hour</option>
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 min-h-0 p-3 sm:p-6 overflow-y-auto">
      <div v-if="loading" class="flex items-center justify-center h-full">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p class="text-gray-600">Loading metrics...</p>
        </div>
      </div>

      <div v-else>
        <!-- Summary Cards -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-3 sm:p-6 border border-blue-200">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-blue-600">Total Executions</span>
              <span class="text-2xl">📊</span>
            </div>
            <div class="text-xl sm:text-3xl font-bold text-blue-900">
              {{ metrics.summary?.total_executions || 0 }}
            </div>
          </div>

          <div class="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-3 sm:p-6 border border-green-200">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-green-600">Success Rate</span>
              <span class="text-2xl">✅</span>
            </div>
            <div class="text-xl sm:text-3xl font-bold text-green-900">
              {{ metrics.summary?.success_rate || 0 }}%
            </div>
          </div>

          <div class="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-3 sm:p-6 border border-purple-200">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-purple-600">Avg Duration</span>
              <span class="text-2xl">⚡</span>
            </div>
            <div class="text-xl sm:text-3xl font-bold text-purple-900">
              {{ Math.round(metrics.summary?.average_duration_ms || 0) }}ms
            </div>
          </div>

          <div class="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-3 sm:p-6 border border-red-200">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-red-600">Failed</span>
              <span class="text-2xl">❌</span>
            </div>
            <div class="text-xl sm:text-3xl font-bold text-red-900">
              {{ metrics.summary?.failed_executions || 0 }}
            </div>
          </div>
        </div>

        <!-- Top Tools -->
        <div class="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6 sm:mb-8">
          <h3 class="text-lg font-bold text-gray-900 mb-4">Top Tools by Usage</h3>
          <div v-if="metrics.top_tools && metrics.top_tools.length > 0" class="space-y-3">
            <div
              v-for="(tool, index) in metrics.top_tools"
              :key="tool.tool_name"
              class="flex items-center gap-4"
            >
              <div class="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">
                {{ index + 1 }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between mb-1 gap-2">
                  <span class="font-medium text-gray-900 truncate" :title="tool.tool_name">{{ tool.tool_name }}</span>
                  <span class="text-sm text-gray-600 whitespace-nowrap flex-shrink-0">{{ tool.count }} executions</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                  <div
                    class="bg-blue-600 h-2 rounded-full"
                    :style="{ width: `${(tool.count / metrics.top_tools[0].count) * 100}%` }"
                  ></div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-center text-gray-400 py-8">
            No tool usage data available
          </div>
        </div>

        <!-- Error Breakdown -->
        <div class="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
          <h3 class="text-lg font-bold text-gray-900 mb-4">Error Breakdown</h3>
          <div v-if="metrics.error_breakdown && metrics.error_breakdown.length > 0" class="space-y-2">
            <div
              v-for="error in metrics.error_breakdown"
              :key="error.error_code"
              class="flex items-center justify-between p-3 bg-red-50 rounded-lg"
            >
              <span class="font-medium text-red-900">{{ error.error_code || 'Unknown' }}</span>
              <span class="text-sm text-red-600">{{ error.count }} occurrences</span>
            </div>
          </div>
          <div v-else class="text-center text-gray-400 py-8">
            No errors in selected time range 🎉
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { toolsApi } from '../../services/toolsApi'

export default {
  name: 'MetricsDashboard',
  setup() {
    const metrics = ref({})
    const loading = ref(true)
    const timeRange = ref('24h')

    const loadMetrics = async () => {
      try {
        loading.value = true
        const response = await toolsApi.getMetrics(timeRange.value)
        metrics.value = response.data || {}
      } catch (error) {
        console.error('Failed to load metrics:', error)
      } finally {
        loading.value = false
      }
    }

    onMounted(() => {
      loadMetrics()
    })

    return {
      metrics,
      loading,
      timeRange,
      loadMetrics
    }
  }
}
</script>
