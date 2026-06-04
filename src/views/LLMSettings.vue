<template>
  <div class="space-y-8">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">AI Providers</h1>
        <p class="mt-2 text-gray-600">
          Manage third-party AI APIs and local providers. Add models to make them available in chat.
        </p>
      </div>
      <OwnerFilter v-model="ownerFilter" @update:modelValue="reloadAll" />
    </div>

    <!-- Configured Providers -->
    <div class="bg-white rounded-[16px] shadow-sm border border-slate-200/60 overflow-hidden">
      <div class="p-5 sm:p-6 pb-4 sm:pb-5 border-b border-slate-100 bg-slate-50/30">
        <h2 class="text-base font-bold text-slate-900">Configured Providers</h2>
        <p class="text-[13px] text-slate-500 mt-0.5">Manage Ollama, Anthropic, OpenAI, OpenRouter, Gemini, or custom endpoints.</p>
      </div>
      
      <div class="p-0">
        <div v-if="providers.length === 0" class="p-8 text-center text-[13px] font-medium text-slate-500">
          No providers configured yet.
        </div>
        <div v-else class="divide-y divide-slate-100">
          <div
            v-for="provider in providers"
            :key="provider.id"
            class="group flex flex-col sm:flex-row sm:items-center justify-between p-5 sm:p-6 hover:bg-slate-50/50 transition-colors gap-4"
          >
            <div class="flex items-start gap-4">
               <!-- Icon Container -->
               <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-white border border-slate-200 shadow-sm flex items-center justify-center shrink-0">
                  <svg v-if="provider.provider_type === 'ollama'" class="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"></path></svg>
                  <svg v-else-if="provider.provider_type === 'openai'" class="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                  <svg v-else class="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>
               </div>
               
               <!-- Details -->
               <div>
                  <div class="flex items-center gap-2 mb-0.5">
                      <p class="font-semibold text-slate-900 text-[14px]">{{ provider.name }}</p>
                      <span v-if="provider.api_key" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-100"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Key Set</span>
                      <span v-else class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-100"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>No Key</span>
                  </div>
                  <p class="text-[12px] font-mono text-slate-500 truncate max-w-[200px] sm:max-w-md">
                    <span class="font-bold text-slate-400 mr-1">{{ provider.provider_type.toUpperCase() }}</span>
                    <span v-if="provider.base_url">{{ provider.base_url }}</span>
                  </p>
               </div>
            </div>
            
            <!-- Actions -->
            <div class="flex items-center gap-3">
              <!-- Custom Toggle -->
              <label class="relative inline-flex items-center cursor-pointer mr-2">
                <input type="checkbox" v-model="provider.is_active" @change="toggleProvider(provider)" class="sr-only peer">
                <div class="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                <span class="ml-2 text-[12px] font-medium" :class="provider.is_active ? 'text-slate-700' : 'text-slate-400'">{{ provider.is_active ? 'Active' : 'Disabled' }}</span>
              </label>

              <!-- Sync Buttons -->
              <button
                v-if="['ollama', 'openrouter', 'openai'].includes(provider.provider_type)"
                @click="provider.provider_type === 'ollama' ? syncOllama(provider) : provider.provider_type === 'openrouter' ? syncOpenRouter(provider) : syncOpenAI(provider)"
                class="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm whitespace-nowrap"
              >
                Sync Models
              </button>

              <!-- Delete Button -->
              <button
                @click="removeProvider(provider)"
                class="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete Provider"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Add New Provider Form -->
      <div class="border-t border-slate-100 bg-slate-50/50 p-5 sm:p-6">
        <h3 class="text-sm font-bold text-slate-900 mb-4">Add New Provider</h3>
        <form @submit.prevent="createProvider" class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">Name</label>
            <input v-model="newProvider.name" class="w-full bg-white border border-slate-200 rounded-[8px] px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm" placeholder="e.g. Production Anthropic" required />
          </div>
          <div>
            <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">Provider Type</label>
            <select v-model="newProvider.provider_type" class="w-full bg-white border border-slate-200 rounded-[8px] px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm">
              <option value="ollama">Ollama</option>
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
              <option value="openrouter">OpenRouter</option>
              <option value="gemini">Gemini</option>
              <option value="xai">xAI (Grok)</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div>
            <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">Base URL</label>
            <input v-model="newProvider.base_url" class="w-full bg-white border border-slate-200 rounded-[8px] px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm" placeholder="http://localhost:11434" />
          </div>
          <div>
            <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">API Key</label>
            <input v-model="newProvider.api_key" class="w-full bg-white border border-slate-200 rounded-[8px] px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm" placeholder="sk-..." />
          </div>
          <div class="md:col-span-2 flex justify-end mt-2">
            <button type="submit" class="px-5 py-2.5 bg-slate-900 text-white rounded-[10px] hover:bg-slate-800 transition-all font-semibold shadow-sm border border-transparent shadow-[0_2px_4px_rgba(0,0,0,0.1)] text-[13px] flex items-center gap-2">
               <svg class="w-4 h-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
               Add Provider
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Models Configuration -->
    <div class="bg-white rounded-[16px] shadow-sm border border-slate-200/60 overflow-hidden mt-8">
      <div class="p-5 sm:p-6 pb-4 sm:pb-5 border-b border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-base font-bold text-slate-900">Configured Models</h2>
          <p class="text-[13px] text-slate-500 mt-0.5">Assign models to providers for chat selection.</p>
        </div>
        <select v-model="modelFilter" class="w-full sm:w-auto bg-white border border-slate-200 rounded-[8px] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm font-medium text-slate-700 cursor-pointer">
          <option value="">All Providers</option>
          <option v-for="provider in providers" :key="provider.id" :value="provider.id">
            {{ provider.name }}
          </option>
        </select>
      </div>

      <div class="p-0">
        <div v-if="models.length === 0" class="p-8 text-center text-[13px] font-medium text-slate-500">
          No models configured yet.
        </div>
        <div v-else class="divide-y divide-slate-100">
          <div
            v-for="model in filteredModels"
            :key="model.id"
            class="group flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 hover:bg-slate-50/50 transition-colors gap-4"
          >
            <div class="flex items-center gap-4">
               <div class="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100/50 text-indigo-500 flex items-center justify-center shrink-0">
                   <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
               </div>
               <div>
                  <p class="font-bold text-slate-900 text-[14px]">{{ model.name }}</p>
                  <p class="text-[12px] font-mono text-slate-500 mt-0.5 inline-flex items-center gap-1.5">
                    <span class="font-semibold text-slate-400 uppercase">{{ model.provider_name }}</span>
                    <span class="w-1 h-1 rounded-full bg-slate-300"></span>
                    {{ model.model_id }}
                  </p>
               </div>
            </div>
            
            <div class="flex items-center gap-4">
              <!-- Custom Toggle -->
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" v-model="model.is_active" @change="toggleModel(model)" class="sr-only peer">
                <div class="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-500"></div>
                <span class="ml-2.5 text-[12px] font-semibold" :class="model.is_active ? 'text-slate-700' : 'text-slate-400'">{{ model.is_active ? 'Active' : 'Disabled' }}</span>
              </label>

              <!-- Delete Button -->
              <button
                @click="removeModel(model)"
                class="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-1"
                title="Delete Model"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Add New Model Form -->
      <div class="border-t border-slate-100 bg-slate-50/50 p-5 sm:p-6">
        <h3 class="text-sm font-bold text-slate-900 mb-4">Add New Model</h3>
        <form @submit.prevent="createModel" class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">Provider</label>
            <select v-model="newModel.provider" class="w-full bg-white border border-slate-200 rounded-[8px] px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm cursor-pointer" required>
              <option value="" disabled>Select provider</option>
              <option v-for="provider in providers" :key="provider.id" :value="provider.id">
                {{ provider.name }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">Model Name</label>
            <input v-model="newModel.name" class="w-full bg-white border border-slate-200 rounded-[8px] px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm" placeholder="e.g. GPT-4o" required />
          </div>
          <div>
            <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">Model ID</label>
            <input v-model="newModel.model_id" class="w-full bg-white border border-slate-200 rounded-[8px] px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm font-mono text-sm" placeholder="gpt-4o" required />
          </div>
          <div>
            <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">Context Window</label>
            <input v-model.number="newModel.context_window" type="number" class="w-full bg-white border border-slate-200 rounded-[8px] px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm" placeholder="128000" />
          </div>
          <div class="md:col-span-2 flex justify-end mt-2">
            <button type="submit" class="px-5 py-2.5 bg-slate-900 text-white rounded-[10px] hover:bg-slate-800 transition-all font-semibold shadow-sm border border-transparent shadow-[0_2px_4px_rgba(0,0,0,0.1)] text-[13px] flex items-center gap-2">
               <svg class="w-4 h-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
               Add Model
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Recent Requests -->
    <div class="bg-white rounded-[16px] shadow-sm border border-slate-200/60 overflow-hidden mt-8 mb-8">
      <div class="p-5 sm:p-6 pb-4 sm:pb-5 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
        <div>
          <h2 class="text-base font-bold text-slate-900">Recent LLM Requests</h2>
          <p class="text-[13px] text-slate-500 mt-0.5">Last 15 requests grouped by provider and model.</p>
        </div>
        <div v-if="statsLoading" class="text-[13px] font-medium text-slate-400 flex items-center gap-2">
            <svg class="animate-spin h-3.5 w-3.5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            Loading...
        </div>
      </div>
      <div class="p-0">
        <div v-if="groupedRequests.length === 0" class="p-8 text-center text-[13px] font-medium text-slate-500">
          No request history yet.
        </div>
        <div v-else class="p-5 sm:p-6 space-y-6">
          <div v-for="group in groupedRequests" :key="group.label" class="border border-slate-200/60 rounded-[12px] overflow-hidden shadow-sm">
            <div class="px-4 py-3 border-b border-slate-100 bg-slate-50/80 flex items-center gap-2">
               <svg class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
               <span class="text-[13px] font-bold text-slate-700">{{ group.label.replace(' / ', ' • ') }}</span>
            </div>
            <div class="divide-y divide-slate-100 text-[13px]">
              <div
                v-for="request in group.requests"
                :key="request.created_at"
                class="px-4 py-2.5 grid grid-cols-2 sm:grid-cols-5 gap-3 items-center hover:bg-slate-50/30 transition-colors"
              >
                <div class="flex items-center gap-1.5">
                   <div class="w-2 h-2 rounded-full" :class="request.status === 'error' ? 'bg-red-500' : 'bg-emerald-500'"></div>
                   <span class="font-medium capitalize" :class="request.status === 'error' ? 'text-red-700' : 'text-slate-900'">
                     {{ request.status }}
                   </span>
                </div>
                <span class="text-slate-500 font-mono text-[12px] whitespace-nowrap">{{ formatLatency(request.latency_ms) }}</span>
                <span class="text-slate-500 hidden sm:inline-block"><span class="font-semibold text-slate-700">{{ request.total_tokens ?? '—' }}</span> tokens</span>
                <span class="text-emerald-600 font-mono font-medium hidden sm:inline-block">${{ (request.cost_estimate || 0).toFixed(4) }}</span>
                <span class="text-slate-400 text-[12px] text-right sm:text-left">{{ formatDate(request.created_at) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, onMounted, ref, watch } from 'vue'
import api from '../services/api'
import OwnerFilter from '../components/common/OwnerFilter.vue'

const notify = inject('notify', () => {})

const providers = ref([])
const models = ref([])
const modelFilter = ref('')
const stats = ref(null)
const statsLoading = ref(false)
const ownerFilter = ref('')

const newProvider = ref({
  name: '',
  provider_type: 'ollama',
  base_url: '',
  api_key: '',
  is_active: true
})

const newModel = ref({
  provider: '',
  name: '',
  model_id: '',
  context_window: 0,
  is_active: true
})

const loadProviders = async () => {
  const params = {}
  if (ownerFilter.value) params.owner = ownerFilter.value
  const response = await api.getLlmProviders(params)
  providers.value = response.data.results || response.data
}

const loadModels = async () => {
  const params = {}
  if (ownerFilter.value) params.owner = ownerFilter.value
  if (modelFilter.value) {
    params.provider = modelFilter.value
  }
  const response = await api.getLlmModels(params)
  models.value = response.data.results || response.data
}

const reloadAll = async () => {
  await loadProviders()
  await loadModels()
}

const loadStats = async () => {
  try {
    statsLoading.value = true
    const response = await api.getLlmStats()
    stats.value = response.data
  } finally {
    statsLoading.value = false
  }
}

const createProvider = async () => {
  await api.createLlmProvider(newProvider.value)
  notify('Provider added', 'success')
  newProvider.value = {
    name: '',
    provider_type: 'ollama',
    base_url: '',
    api_key: '',
    is_active: true
  }
  await loadProviders()
}

const createModel = async () => {
  await api.createLlmModel(newModel.value)
  notify('Model added', 'success')
  newModel.value = {
    provider: '',
    name: '',
    model_id: '',
    context_window: 0,
    is_active: true
  }
  await loadModels()
}

const toggleProvider = async (provider) => {
  await api.updateLlmProvider(provider.id, {
    ...provider,
    is_active: provider.is_active
  })
  notify('Provider updated', 'success')
}

const toggleModel = async (model) => {
  await api.updateLlmModel(model.id, {
    ...model,
    is_active: model.is_active
  })
  notify('Model updated', 'success')
}

const removeProvider = async (provider) => {
  if (!confirm(`Delete provider "${provider.name}"?`)) return
  await api.deleteLlmProvider(provider.id)
  notify('Provider deleted', 'success')
  await loadProviders()
  await loadModels()
}

const removeModel = async (model) => {
  if (!confirm(`Delete model "${model.name}"?`)) return
  await api.deleteLlmModel(model.id)
  notify('Model deleted', 'success')
  await loadModels()
}

const syncOllama = async (provider) => {
  await api.syncOllamaModels(provider.id)
  notify('Ollama models synced', 'success')
  await loadModels()
}

const syncOpenRouter = async (provider) => {
  await api.syncOpenRouterModels(provider.id)
  notify('OpenRouter models synced', 'success')
  await loadModels()
}

const syncOpenAI = async (provider) => {
  try {
    const response = await api.syncOpenAIModels(provider.id)
    notify(response.data.message || 'OpenAI models synced', 'success')
    await loadModels()
  } catch (error) {
    notify('Failed to sync: ' + (error.response?.data?.error || error.message), 'error')
  }
}

const filteredModels = computed(() => {
  if (!modelFilter.value) return models.value
  return models.value.filter((model) => model.provider === parseInt(modelFilter.value, 10))
})

const groupedRequests = computed(() => {
  const recent = stats.value?.recent_requests || []
  const groups = {}
  recent.forEach((request) => {
    const label = `${request.provider || 'unknown'} / ${request.model || 'default'}`
    if (!groups[label]) {
      groups[label] = []
    }
    groups[label].push(request)
  })
  return Object.entries(groups).map(([label, requests]) => ({ label, requests }))
})

const formatLatency = (value) => {
  if (value === null || value === undefined) return '—'
  return `${Math.round(value)} ms`
}

const formatDate = (value) => {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

watch(modelFilter, loadModels)

onMounted(async () => {
  await loadProviders()
  await loadModels()
  await loadStats()
})
</script>

<style scoped>
.input {
  @apply w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500;
}

.btn-primary {
  @apply bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700;
}
</style>
