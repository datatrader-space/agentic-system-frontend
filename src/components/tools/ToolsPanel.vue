<template>
  <div class="tools-panel h-full flex flex-col bg-gray-50">
    <!-- Sub-tabs Navigation (scrollable on mobile) -->
    <div class="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex gap-2 sm:gap-4 overflow-x-auto scrollbar-hide shrink-0">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="activeSubTab = tab.id"
        :class="[
          'flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all whitespace-nowrap flex-shrink-0',
          activeSubTab === tab.id
            ? 'bg-blue-600 text-white shadow-md'
            : 'text-gray-600 hover:bg-gray-100'
        ]"
      >
        <span class="text-base sm:text-lg">{{ tab.icon }}</span>
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <!-- Tab Content -->
    <div class="flex-1 min-h-0 overflow-y-auto">
      <!-- Tool Catalog Tab -->
      <div v-if="activeSubTab === 'catalog'" class="h-full">
        <ToolCatalog :agent-profile="agentProfile" />
      </div>

      <!-- Execution History Tab -->
      <div v-if="activeSubTab === 'history'" class="h-full">
        <ExecutionHistory :agent-profile="agentProfile" />
      </div>

      <!-- Credentials Tab -->
      <div v-if="activeSubTab === 'credentials'" class="h-full">
        <CredentialManager :agent-profile="agentProfile" />
      </div>

      <!-- Metrics Tab -->
      <div v-if="activeSubTab === 'metrics'" class="h-full">
        <MetricsDashboard />
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import ToolCatalog from './ToolCatalog.vue'
import ExecutionHistory from './ExecutionHistory.vue'
import CredentialManager from './CredentialManager.vue'
import MetricsDashboard from './MetricsDashboard.vue'

export default {
  name: 'ToolsPanel',
  components: {
    ToolCatalog,
    ExecutionHistory,
    CredentialManager,
    MetricsDashboard
  },
  props: {
    agentProfile: {
      type: Object,
      required: true
    }
  },
  setup() {
    const activeSubTab = ref('catalog')

    const tabs = [
      { id: 'catalog', label: 'Tool Catalog', icon: '🔧' },
      { id: 'history', label: 'Execution History', icon: '📜' },
      { id: 'credentials', label: 'Credentials', icon: '🔑' },
      { id: 'metrics', label: 'Metrics', icon: '📊' }
    ]

    return {
      activeSubTab,
      tabs
    }
  }
}
</script>

<style scoped>
.tools-panel {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
</style>
