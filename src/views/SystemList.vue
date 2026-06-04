<template>
  <div>
    <!-- Header & Actions -->
    <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 sm:mb-8">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Your Systems</h1>
        <p class="mt-1.5 text-sm sm:text-base text-slate-500">Manage your multi-repo agent systems</p>
      </div>
      <div class="flex flex-col sm:flex-row items-center gap-3">
        <router-link
          to="/agents"
          class="inline-flex items-center justify-center px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-[10px] hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 transition-all shadow-sm font-semibold text-[13px] w-full sm:w-auto"
        >
          <svg class="w-4 h-4 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
          Agent Library
        </router-link>
        <button
          @click="showCreateModal = true"
          class="inline-flex items-center justify-center px-4 py-2.5 bg-slate-900 text-white rounded-[10px] hover:bg-slate-800 transition-all font-semibold text-[13px] shadow-sm border border-transparent shadow-[0_2px_4px_rgba(0,0,0,0.1)] w-full sm:w-auto"
        >
          <svg class="w-4 h-4 mr-2 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
          Create System
        </button>
      </div>
    </div>

    <!-- LLM Stats -->
    <div class="mb-10 bg-white rounded-[16px] shadow-sm border border-slate-200/60 overflow-hidden">
      <div class="p-5 sm:p-6 pb-4 sm:pb-5 flex items-center justify-between border-b border-slate-100 bg-slate-50/30">
        <div>
          <h2 class="text-base font-bold text-slate-900 flex items-center gap-2">
             <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
             LLM Activity
          </h2>
          <p class="text-[13px] text-slate-500 mt-0.5">Last 24h overview</p>
        </div>
        <div v-if="statsLoading" class="text-xs font-medium text-slate-400 flex items-center gap-2">
            <svg class="animate-spin h-3.5 w-3.5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            Loading data...
        </div>
      </div>
      
      <div v-if="stats" class="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 bg-white">
        <!-- Stat 1 -->
        <div class="p-5 sm:p-6 lg:px-8 flex flex-col justify-center">
          <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Total Requests</p>
          <div class="flex items-baseline gap-2 text-slate-900">
            <span class="text-3xl font-bold tracking-tight">{{ stats.total_requests?.toLocaleString() || '0' }}</span>
          </div>
        </div>
        <!-- Stat 2 -->
        <div class="p-5 sm:p-6 lg:px-8 flex flex-col justify-center border-l-0 lg:border-l border-slate-100">
          <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Error Rate</p>
          <div class="flex items-baseline gap-2 text-slate-900">
            <span class="text-3xl font-bold tracking-tight" :class="{'text-red-600': stats.error_rate > 0.05, 'text-emerald-600': stats.error_rate === 0}">{{ formatPercent(stats.error_rate) }}</span>
          </div>
        </div>
        <!-- Stat 3 -->
        <div class="p-5 sm:p-6 lg:px-8 flex flex-col justify-center">
          <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Avg Latency</p>
          <div class="flex items-baseline gap-1.5 text-slate-900">
            <span class="text-3xl font-bold tracking-tight">{{ formatLatency(stats.avg_latency_ms).split(' ')[0] }}</span>
            <span class="text-sm font-semibold text-slate-400">{{ formatLatency(stats.avg_latency_ms).split(' ')[1] || 'ms' }}</span>
          </div>
        </div>
        <!-- Stat 4 -->
        <div class="p-5 sm:p-6 lg:px-8 flex flex-col justify-center border-l-0 lg:border-l border-slate-100">
          <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Top System Model</p>
          <div class="flex items-center gap-2.5 mt-0.5">
            <div v-if="topProviderModel !== '—'" class="w-7 h-7 rounded-md bg-indigo-50/80 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100/50">
               <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
            </div>
            <p class="text-[15px] font-semibold text-slate-900 truncate" :class="{'text-slate-400 italic font-medium text-sm': topProviderModel === '—'}">
              {{ topProviderModel === '—' ? 'No data yet' : topProviderModel.replace(' / ', ' • ') }}
            </p>
          </div>
        </div>
      </div>
      
      <div v-else-if="!statsLoading" class="p-8 text-center border-t border-slate-100">
        <p class="text-[13px] font-medium text-slate-500">No LLM activity recorded in the last 24 hours.</p>
      </div>
    </div>
    
    <!-- Loading -->
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p class="mt-4 text-gray-600">Loading systems...</p>
    </div>
    
    <!-- Systems Grid -->
    <div v-else-if="systems.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      <div
        v-for="system in systems"
        :key="system.id"
        class="bg-white rounded-lg shadow hover:shadow-lg transition cursor-pointer"
        @click="goToSystem(system.id)"
      >
        <div class="p-4 sm:p-6">
          <!-- Status Badge -->
          <div class="flex items-start justify-between mb-4">
            <div>
              <h3 class="text-lg font-semibold text-gray-900">{{ system.name }}</h3>
              <p class="text-sm text-gray-500 mt-1">{{ system.description || 'No description' }}</p>
            </div>
            <span
              class="px-2 py-1 text-xs font-medium rounded-full"
              :class="{
                'bg-green-100 text-green-800': system.status === 'ready',
                'bg-yellow-100 text-yellow-800': system.status === 'initializing',
                'bg-blue-100 text-blue-800': system.status === 'analyzing',
                'bg-red-100 text-red-800': system.status === 'error'
              }"
            >
              {{ system.status }}
            </span>
          </div>
          
          <!-- Stats -->
          <div class="grid grid-cols-2 gap-4 mt-4">
            <div>
              <p class="text-2xl font-bold text-blue-600">{{ system.repositories_count }}</p>
              <p class="text-xs text-gray-500">Repositories</p>
            </div>
            <div>
              <p class="text-2xl font-bold text-purple-600">{{ system.knowledge_count }}</p>
              <p class="text-xs text-gray-500">Knowledge Items</p>
            </div>
          </div>
          
          <!-- Created date -->
          <div class="mt-4 pt-4 border-t">
            <p class="text-xs text-gray-400">
              Created {{ formatDate(system.created_at) }}
            </p>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Empty State -->
    <div v-else class="text-center py-16 bg-slate-50/50 rounded-[20px] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center">
      <div class="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center text-indigo-500 mb-5 border border-slate-100">
          <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
      </div>
      <h3 class="text-base font-bold text-slate-900 mb-1">No systems deployed yet</h3>
      <p class="text-[13px] text-slate-500 max-w-sm mb-6 leading-relaxed">Agent systems require one or more specialized bots working together. Get started by creating your first system.</p>
      
      <button
        @click="showCreateModal = true"
        class="inline-flex items-center justify-center px-5 py-2.5 bg-slate-900 text-white rounded-[10px] hover:bg-slate-800 transition-all font-semibold shadow-sm border border-transparent shadow-[0_2px_4px_rgba(0,0,0,0.1)] text-[14px]"
      >
        <svg class="w-4 h-4 mr-2 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
        Create New System
      </button>
    </div>
    
    <!-- Create System Modal -->
    <div
      v-if="showCreateModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      @click.self="showCreateModal = false"
    >
      <div class="bg-white rounded-lg max-w-md w-full p-6">
        <h2 class="text-xl font-bold mb-4">Create New System</h2>
        
        <form @submit.prevent="createSystem">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              System Name *
            </label>
            <input
              v-model="newSystem.name"
              type="text"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., E-commerce Platform"
            />
          </div>
          
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              v-model="newSystem.description"
              rows="3"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Describe your system..."
            ></textarea>
          </div>
          
          <div class="flex justify-end space-x-3">
            <button
              type="button"
              @click="showCreateModal = false"
              class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="creating"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {{ creating ? 'Creating...' : 'Create System' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, inject, computed } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api'

const router = useRouter()
const notify = inject('notify')

const systems = ref([])
const loading = ref(true)

const showCreateModal = ref(false)
const creating = ref(false)

const stats = ref(null)
const statsLoading = ref(false)

const newSystem = ref({
  name: '',
  description: ''
})

// Load systems
const loadSystems = async () => {
  try {
    loading.value = true
    const response = await api.getSystems()
    systems.value = response.data?.results || response.data || []
  } catch (error) {
    notify?.('Failed to load systems', 'error')
    console.error(error)
  } finally {
    loading.value = false
  }
}

// Load LLM stats (single source of truth)
const loadStats = async () => {
  try {
    statsLoading.value = true
    const response = await api.getLlmStats()
    stats.value = response.data
  } catch (error) {
    console.error('Failed to load LLM stats:', error)
    stats.value = null
  } finally {
    statsLoading.value = false
  }
}

// Create system
const createSystem = async () => {
  try {
    creating.value = true
    const response = await api.createSystem(newSystem.value)

    notify?.('System created successfully!', 'success')
    showCreateModal.value = false
    newSystem.value = { name: '', description: '' }

    router.push(`/systems/${response.data.id}`)
  } catch (error) {
    notify?.('Failed to create system', 'error')
    console.error(error)
  } finally {
    creating.value = false
  }
}

// Navigate to system
const goToSystem = (id) => {
  router.push(`/systems/${id}`)
}

// Formatting helpers
const formatDate = (dateString) => {
  if (!dateString) return '—'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const formatPercent = (value) => {
  if (value === null || value === undefined) return '—'
  return `${(value * 100).toFixed(1)}%`
}

const formatLatency = (value) => {
  if (value === null || value === undefined) return '—'
  return `${Math.round(value)} ms`
}

const topProviderModel = computed(() => {
  const top = stats.value?.top_provider_model
  if (!top) return '—'
  return [top.provider, top.model].filter(Boolean).join(' / ')
})

// Load on mount
onMounted(() => {
  loadSystems()
  loadStats()
})
</script>
