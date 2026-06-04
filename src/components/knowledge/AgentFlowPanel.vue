<template>
  <div class="agent-flow-panel h-full flex flex-col">
    <!-- Status Toast -->
    <transition name="slide-down">
      <div v-if="statusMsg" class="px-5 py-2 text-xs font-medium shrink-0"
        :class="statusType === 'error' ? 'bg-red-50 text-red-700' : statusType === 'success' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'">
        {{ statusMsg }}
      </div>
    </transition>

    <!-- Header -->
    <div class="px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-cyan-50 to-teal-50 shrink-0">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-base font-bold text-gray-800 flex items-center gap-2">
            🔄 Agent Flows
            <span v-if="flows.length" class="text-xs bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full">
              {{ flows.length }} flows
            </span>
            <span v-if="undreamedCount > 0" class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              {{ undreamedCount }} undreamed
            </span>
            <span v-if="totalLinkedCards > 0" class="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
              {{ totalLinkedCards }} cards
            </span>
          </h2>
          <p class="text-xs text-gray-500 mt-0.5">Semantic work sessions • feeds dream pipeline</p>
        </div>
        <div class="flex items-center gap-2">
          <button @click="fetchFlows" :disabled="loading"
            class="p-2 hover:bg-white/60 rounded-lg transition text-gray-500" title="Refresh">
            <svg class="w-4 h-4" :class="{ 'animate-spin': loading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button @click="processFlows" :disabled="processing || !flows.length"
            class="h-8 px-3 text-xs font-semibold rounded-lg transition flex items-center gap-1.5"
            :class="processing ? 'bg-cyan-200 text-cyan-500 cursor-wait' : 'bg-cyan-600 text-white hover:bg-cyan-700 shadow-sm disabled:opacity-40'">
            <span v-if="processing" class="animate-pulse">⚡</span>
            <span v-else>⚡</span>
            {{ processing ? 'Processing...' : 'Process Flows' }}
          </button>
        </div>
      </div>

      <!-- Config Row -->
      <div class="flex items-center gap-4 mt-3 pt-3 border-t border-cyan-100 flex-wrap">
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" :checked="flowTrackingEnabled" @change="toggleFlowTracking($event.target.checked)"
            class="w-4 h-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
          <span class="text-xs font-medium text-gray-700">Flow Tracking</span>
        </label>
        <span v-if="backfillRunning" class="text-xs text-cyan-600 animate-pulse">⏳ Backfilling conversations...</span>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto px-5 py-4 space-y-3">
      <!-- Loading -->
      <div v-if="loading && !flows.length" class="text-center py-12 text-gray-400">
        <div class="animate-spin inline-block w-6 h-6 border-2 border-cyan-300 border-t-cyan-600 rounded-full mb-3"></div>
        <p class="text-sm">Loading flows...</p>
      </div>

      <!-- Toolbar -->
      <div v-if="!loading || flows.length" class="flex items-center gap-2 flex-wrap">
        <button @click="toggleSort"
          class="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition flex items-center gap-1">
          {{ sortBy === 'turns' ? '🔢 Most Turns' : '🕐 Newest' }}
        </button>
        <label v-if="filteredFlows.length" class="flex items-center gap-1.5 cursor-pointer text-xs text-gray-500 ml-1">
          <input type="checkbox" :checked="allSelected" @change="toggleSelectAll" class="w-3.5 h-3.5 rounded border-gray-300 text-cyan-600" />
          All
        </label>
        <button v-if="selectedFlows.size > 0" @click="bulkDelete" :disabled="bulkDeleting"
          class="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition flex items-center gap-1">
          🗑 Delete {{ selectedFlows.size }} selected
        </button>
        <div class="flex-1"></div>
        <input v-model="flowSearch" type="text" placeholder="Search flows..."
          class="text-xs border border-gray-200 rounded-lg px-3 py-1.5 w-44 focus:ring-1 focus:ring-cyan-400 focus:outline-none" />
      </div>

      <!-- Empty -->
      <div v-if="!loading && !flows.length" class="text-center py-12 text-gray-400">
        <div class="text-5xl mb-3">🔄</div>
        <p class="text-lg font-medium">No Flows Yet</p>
        <p class="text-sm mt-1">Enable flow tracking to start capturing work sessions</p>
      </div>

      <!-- Flow List -->
      <div v-for="flow in filteredFlows" :key="flow.id"
        class="bg-white border rounded-xl overflow-hidden hover:shadow-md transition group"
        :class="selectedFlows.has(flow.id) ? 'border-cyan-300 bg-cyan-50/30' : 'border-gray-200'">

        <!-- Flow Header (always visible) -->
        <div class="p-4">
          <div class="flex items-start gap-3">
            <input type="checkbox" :checked="selectedFlows.has(flow.id)" @change="toggleSelect(flow.id)"
              class="w-4 h-4 mt-0.5 rounded border-gray-300 text-cyan-600 flex-shrink-0" />

            <div class="flex-1 min-w-0 cursor-pointer" @click="toggleExpand(flow.id)">
              <!-- Title Row -->
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-xs px-2 py-0.5 rounded-full font-medium" :class="statusStyle(flow.status)">
                  {{ flow.status }}
                </span>
                <h3 v-if="editingFlow !== flow.id" class="text-sm font-semibold text-gray-800 truncate flex-1">
                  {{ flow.title }}
                </h3>
                <input v-else v-model="editTitle" @blur="saveTitle(flow)" @keyup.enter="saveTitle(flow)" @click.stop
                  class="text-sm font-semibold text-gray-800 border border-cyan-300 rounded px-2 py-0.5 flex-1 focus:outline-none focus:ring-1 focus:ring-cyan-400" />
                <span v-if="flow.dreamed_at" class="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded">✓ dreamed</span>
                <span v-else class="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">undreamed</span>
                <span v-if="(flow.linked_cards || []).length" class="text-[10px] text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">🧠 {{ (flow.linked_cards || []).length }}</span>
                <!-- Expand toggle -->
                <svg :class="['w-4 h-4 text-gray-400 transition-transform', expandedFlows.has(flow.id) ? 'rotate-180' : '']"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              <!-- Stats -->
              <div class="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                <span>💬 {{ flow.turn_count }} turns</span>
                <span>🛠 {{ flow.tool_call_count }} tools</span>
                <span v-if="flow.failure_count" class="text-red-500">✗ {{ flow.failure_count }} fails</span>
                <span v-if="(flow.turn_log || []).length" class="text-green-500" title="Has structured turn data">📋</span>
              </div>

              <!-- Domain Tags -->
              <div v-if="(flow.domain_tags || []).length" class="flex gap-1.5 mt-2 flex-wrap">
                <span v-for="tag in flow.domain_tags" :key="tag"
                  class="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                  {{ tag }}
                </span>
              </div>

              <div class="text-[10px] text-gray-400 mt-2">
                Created {{ formatDate(flow.created_at) }} · Updated {{ formatDate(flow.updated_at) }}
                <span v-if="flow.dreamed_at"> · Dreamed {{ formatDate(flow.dreamed_at) }}</span>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <button @click.stop="startEdit(flow)" class="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition" title="Edit title">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button @click.stop="toggleStatus(flow)" class="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition"
                :title="flow.status === 'completed' ? 'Reactivate' : 'Complete'">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <button @click.stop="deleteFlow(flow)" class="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition" title="Delete">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Expanded Content -->
        <transition name="expand">
          <div v-if="expandedFlows.has(flow.id)" class="border-t border-gray-100">

            <!-- Context Summary -->
            <div v-if="flow.context_summary" class="px-4 py-3 bg-gray-50/50 border-b border-gray-100 text-xs text-gray-600">
              <span class="font-semibold text-gray-700">Summary:</span> {{ flow.context_summary }}
            </div>

            <!-- Turn Log -->
            <div v-if="(flow.turn_log || []).length" class="px-4 py-3 border-b border-gray-100">
              <h4 class="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                📋 Turn Log
                <span class="text-gray-400 font-normal">({{ (flow.turn_log || []).length }} turns)</span>
              </h4>
              <div class="space-y-2 max-h-64 overflow-y-auto">
                <div v-for="(turn, idx) in (flow.turn_log || []).slice(-10)" :key="idx"
                  class="bg-white border border-gray-100 rounded-lg p-2.5 text-xs">
                  <div class="flex items-start gap-2">
                    <span class="text-[10px] font-bold text-cyan-600 bg-cyan-50 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                      {{ turn.turn || idx + 1 }}
                    </span>
                    <div class="flex-1 min-w-0">
                      <p class="text-gray-800 font-medium truncate">{{ turn.user_intent }}</p>
                      <div v-if="turn.tools && turn.tools.length" class="flex gap-1 mt-1 flex-wrap">
                        <span v-for="(tool, ti) in turn.tools" :key="ti"
                          class="px-1.5 py-0.5 rounded text-[9px] font-mono"
                          :class="tool.ok !== false ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'">
                          {{ tool.name || tool }}
                        </span>
                      </div>
                      <p v-if="turn.response_summary" class="text-gray-500 mt-1 truncate">{{ turn.response_summary }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Linked Knowledge Cards -->
            <div v-if="(flow.linked_cards || []).length" class="px-4 py-3">
              <h4 class="text-xs font-bold text-violet-700 mb-2 flex items-center gap-1.5">
                🧠 Knowledge Cards
                <span class="text-gray-400 font-normal">({{ (flow.linked_cards || []).length }})</span>
              </h4>
              <div class="space-y-2">
                <div v-for="card in flow.linked_cards" :key="card.id"
                  class="bg-violet-50/50 border border-violet-100 rounded-lg p-3 text-xs">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase"
                      :class="cardLayerStyle(card.layer)">{{ card.layer }}</span>
                    <span class="px-1.5 py-0.5 rounded bg-gray-100 text-[9px] text-gray-600">{{ card.card_type }}</span>
                    <span class="font-semibold text-gray-800 truncate flex-1">{{ card.title }}</span>
                    <span class="text-[9px] px-1.5 py-0.5 rounded"
                      :class="card.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'">
                      {{ card.is_active ? 'active' : 'inactive' }}
                    </span>
                    <span class="text-[9px] text-gray-400">imp={{ card.importance }}</span>
                  </div>
                  <p class="text-gray-600 leading-relaxed">{{ card.content }}</p>
                </div>
              </div>
            </div>

            <!-- No content fallback -->
            <div v-if="!(flow.turn_log || []).length && !(flow.linked_cards || []).length && !flow.context_summary"
              class="px-4 py-4 text-center text-xs text-gray-400">
              No detailed data available for this flow
            </div>
          </div>
        </transition>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import api from '../../services/api'

const props = defineProps({
  agentProfile: { type: Object, required: true }
})

// State
const flows = ref([])
const loading = ref(false)
const processing = ref(false)
const sortBy = ref('time')
const flowSearch = ref('')
const selectedFlows = ref(new Set())
const bulkDeleting = ref(false)
const statusMsg = ref('')
const statusType = ref('info')
const flowTrackingEnabled = ref(false)
const editingFlow = ref(null)
const editTitle = ref('')
const expandedFlows = ref(new Set())
const backfillRunning = ref(false)

// Computed
const filteredFlows = computed(() => {
  let list = [...flows.value]
  if (flowSearch.value) {
    const q = flowSearch.value.toLowerCase()
    list = list.filter(f =>
      f.title.toLowerCase().includes(q) ||
      f.domain_tags.some(t => t.includes(q)) ||
      f.status.includes(q) ||
      (f.linked_cards || []).some(c => c.title.toLowerCase().includes(q))
    )
  }
  if (sortBy.value === 'turns') {
    list.sort((a, b) => b.turn_count - a.turn_count)
  }
  return list
})

const allSelected = computed(() =>
  filteredFlows.value.length > 0 && filteredFlows.value.every(f => selectedFlows.value.has(f.id))
)

const undreamedCount = computed(() => flows.value.filter(f => !f.dreamed_at).length)

const totalLinkedCards = computed(() => flows.value.reduce((sum, f) => sum + ((f.linked_cards || []).length), 0))

// Methods
const showStatus = (msg, type = 'info', duration = 3000) => {
  statusMsg.value = msg
  statusType.value = type
  setTimeout(() => { statusMsg.value = '' }, duration)
}

const fetchFlows = async () => {
  if (!props.agentProfile?.id) return
  loading.value = true
  try {
    const { data } = await api.getAgentFlows(props.agentProfile.id, sortBy.value)
    flows.value = data.flows || []
    flowTrackingEnabled.value = data.flow_tracking_enabled
  } catch (e) {
    showStatus('Failed to load flows', 'error')
  } finally {
    loading.value = false
  }
}

const processFlows = async () => {
  if (!props.agentProfile?.id) return
  processing.value = true
  try {
    const payload = {}
    if (selectedFlows.value.size > 0) {
      payload.flow_ids = [...selectedFlows.value]
    }
    await api.processFlows(props.agentProfile.id, payload)
    showStatus('Flow processing started! Refresh in a few seconds to see results.', 'success', 5000)
  } catch (e) {
    showStatus('Failed to start processing', 'error')
  } finally {
    setTimeout(() => { processing.value = false }, 3000)
  }
}

const toggleFlowTracking = async (enabled) => {
  try {
    const { data } = await api.updateFlowConfig(props.agentProfile.id, { flow_tracking_enabled: enabled })
    flowTrackingEnabled.value = data.flow_tracking_enabled
    if (data.backfill_started) {
      backfillRunning.value = true
      showStatus('Flow tracking enabled! Backfilling existing conversations...', 'success', 5000)
      // Auto-refresh after backfill (give it time)
      setTimeout(async () => {
        backfillRunning.value = false
        await fetchFlows()
        showStatus(`Backfill complete — ${flows.value.length} flows created`, 'success')
      }, 5000)
    } else {
      showStatus(enabled ? 'Flow tracking enabled' : 'Flow tracking disabled', 'success')
    }
  } catch (e) {
    showStatus('Failed to update config', 'error')
  }
}

const toggleExpand = (id) => {
  const s = new Set(expandedFlows.value)
  if (s.has(id)) s.delete(id); else s.add(id)
  expandedFlows.value = s
}

const toggleSelect = (id) => {
  const s = new Set(selectedFlows.value)
  if (s.has(id)) s.delete(id); else s.add(id)
  selectedFlows.value = s
}

const toggleSelectAll = () => {
  if (allSelected.value) {
    selectedFlows.value = new Set()
  } else {
    selectedFlows.value = new Set(filteredFlows.value.map(f => f.id))
  }
}

const toggleSort = () => {
  sortBy.value = sortBy.value === 'time' ? 'turns' : 'time'
}

const deleteFlow = async (flow) => {
  if (!confirm(`Delete flow "${flow.title}"?`)) return
  try {
    await api.deleteFlow(props.agentProfile.id, flow.id)
    flows.value = flows.value.filter(f => f.id !== flow.id)
    selectedFlows.value.delete(flow.id)
    showStatus('Flow deleted', 'success')
  } catch (e) {
    showStatus('Failed to delete flow', 'error')
  }
}

const bulkDelete = async () => {
  const count = selectedFlows.value.size
  if (!confirm(`Delete ${count} selected flow(s)?`)) return
  bulkDeleting.value = true
  try {
    await api.bulkDeleteFlows(props.agentProfile.id, [...selectedFlows.value])
    flows.value = flows.value.filter(f => !selectedFlows.value.has(f.id))
    selectedFlows.value = new Set()
    showStatus(`${count} flows deleted`, 'success')
  } catch (e) {
    showStatus('Failed to delete flows', 'error')
  } finally {
    bulkDeleting.value = false
  }
}

const startEdit = (flow) => {
  editingFlow.value = flow.id
  editTitle.value = flow.title
}

const saveTitle = async (flow) => {
  if (editTitle.value && editTitle.value !== flow.title) {
    try {
      await api.updateFlow(props.agentProfile.id, flow.id, { title: editTitle.value })
      flow.title = editTitle.value
    } catch (e) {
      showStatus('Failed to update title', 'error')
    }
  }
  editingFlow.value = null
}

const toggleStatus = async (flow) => {
  const newStatus = flow.status === 'completed' ? 'active' : 'completed'
  try {
    await api.updateFlow(props.agentProfile.id, flow.id, { status: newStatus })
    flow.status = newStatus
  } catch (e) {
    showStatus('Failed to update status', 'error')
  }
}

const statusStyle = (status) => ({
  'bg-green-100 text-green-700': status === 'active',
  'bg-gray-100 text-gray-600': status === 'completed',
  'bg-yellow-100 text-yellow-700': status === 'paused',
})

const cardLayerStyle = (layer) => ({
  'bg-red-100 text-red-700': layer === 'prompt',
  'bg-blue-100 text-blue-700': layer === 'card',
  'bg-amber-100 text-amber-700': layer === 'tool',
  'bg-gray-100 text-gray-600': layer === 'profile',
})

const formatDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
  return d.toLocaleDateString()
}

watch(sortBy, () => fetchFlows())
onMounted(() => fetchFlows())
</script>

<style scoped>
.expand-enter-active, .expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}
.expand-enter-from, .expand-leave-to {
  max-height: 0;
  opacity: 0;
}
.expand-enter-to, .expand-leave-from {
  max-height: 600px;
  opacity: 1;
}
</style>
