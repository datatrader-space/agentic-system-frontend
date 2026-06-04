<template>
  <div class="docs-container bg-white min-h-screen flex flex-col md:flex-row">
    <!-- Mobile Menu Toggle -->
    <div class="md:hidden p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
      <h1 class="text-lg font-bold text-gray-900 flex items-center gap-2">
        <span class="text-xl">📖</span> Provider Docs
      </h1>
      <button @click="mobileMenuOpen = !mobileMenuOpen" class="p-2 text-gray-600 bg-white rounded-md shadow-sm border border-gray-300">
        <svg v-if="!mobileMenuOpen" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
        <svg v-else class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
      </button>
    </div>

    <!-- Sidebar Navigation -->
    <aside
      :class="['w-full md:w-64 flex-shrink-0 bg-gray-50 border-r border-gray-200 overflow-y-auto transition-transform duration-300', mobileMenuOpen ? 'block' : 'hidden md:block']"
      style="max-height: 100vh; position: sticky; top: 0;"
    >
      <div class="p-6">
        <router-link to="/connections" class="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium mb-6 transition">
          <span class="mr-1">&larr;</span> Back to Connections
        </router-link>
        
        <h2 class="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-4">Providers</h2>
        
        <nav class="space-y-1">
          <button
            v-for="provider in providers"
            :key="provider.id"
            @click="selectProvider(provider.id)"
            :class="['w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-3', 
              selectedProviderId === provider.id 
                ? 'bg-blue-100 text-blue-900 shadow-sm' 
                : 'text-gray-700 hover:bg-gray-200']"
          >
            <span class="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded bg-white shadow-sm" :style="{ color: provider.color }">
              {{ provider.icon }}
            </span>
            <span class="truncate">{{ provider.name }}</span>
          </button>
        </nav>
      </div>
    </aside>

    <!-- Main Content Area -->
    <main class="flex-1 p-6 md:p-10 lg:p-12 overflow-y-auto bg-white" style="max-height: 100vh;">
      <div class="max-w-4xl mx-auto">
        
        <!-- Loading State -->
        <div v-if="loading" class="flex flex-col items-center justify-center py-20">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p class="text-gray-500">Loading documentation...</p>
        </div>
        
        <!-- Document Content -->
        <div v-else-if="selectedProvider">
          
          <!-- Header -->
          <div class="flex items-start gap-5 mb-8 pb-8 border-b border-gray-100">
            <div 
              class="w-16 h-16 rounded-xl flex items-center justify-center text-3xl shadow-sm border border-gray-100 flex-shrink-0"
              :style="{ backgroundColor: (selectedProvider.color || '#6366f1') + '15' }"
            >
              {{ selectedProvider.icon }}
            </div>
            <div class="flex-1">
              <h1 class="text-3xl font-extrabold text-gray-900 mb-2">{{ selectedProvider.name }} OAuth Scopes</h1>
              <p class="text-gray-600 text-lg">
                Reference documentation for all supported {{ selectedProvider.name }} permissions.
              </p>
            </div>
          </div>
          
          <!-- Search & Filter -->
          <div class="mb-8 relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span class="text-gray-400">🔍</span>
            </div>
            <input
              v-model="searchQuery"
              type="text"
              class="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm transition shadow-sm"
              placeholder="Search scopes by name, description, or group..."
            >
          </div>
          
          <!-- Scopes List Empty State -->
          <div v-if="filteredGroups.length === 0" class="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
            <div class="text-4xl mb-3">🧐</div>
            <h3 class="text-lg font-medium text-gray-900">No matching scopes found</h3>
            <p class="text-gray-500 max-w-sm mx-auto mt-1">Try adjusting your search query to find what you're looking for.</p>
            <button @click="searchQuery = ''" class="mt-4 text-sm font-medium text-blue-600 hover:text-blue-800">Clear search</button>
          </div>

          <!-- Groups -->
          <div class="space-y-10">
            <div v-for="group in filteredGroups" :key="group.name" class="scope-group">
              <h2 class="text-xl font-bold flex items-center text-gray-900 mb-4 sticky top-0 bg-white py-2 z-10 border-b border-gray-100">
                <span class="text-blue-600 mr-2 border-l-4 border-blue-500 h-6"></span>
                {{ group.name }}
                <span class="ml-3 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                  {{ group.scopes.length }} scope{{ group.scopes.length !== 1 ? 's' : '' }}
                </span>
              </h2>
              
              <div class="grid grid-cols-1 gap-4">
                <div 
                  v-for="scope in group.scopes" 
                  :key="scope.id"
                  class="bg-white border rounded-xl overflow-hidden hover:shadow-md transition-shadow group relative"
                  :class="[
                    scope.risk === 'high' ? 'border-red-200' : 
                    scope.risk === 'medium' ? 'border-amber-200' : 'border-green-200'
                  ]"
                >
                  <div class="p-5">
                    <div class="flex items-start justify-between gap-4">
                      
                      <!-- Scope Info -->
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-3 mb-2 flex-wrap">
                          <code class="text-sm font-mono font-medium text-gray-900 bg-gray-100 px-2.5 py-1 rounded select-all break-all border border-gray-200">
                            {{ scope.id }}
                          </code>
                          <button 
                            @click="copyText(scope.id, $event)" 
                            class="text-gray-400 hover:text-blue-600 focus:outline-none transition opacity-0 group-hover:opacity-100"
                            title="Copy to clipboard"
                          >
                            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                        <p class="text-gray-700 text-base font-medium">{{ scope.label }}</p>
                      </div>

                      <!-- Badges -->
                      <div class="flex flex-col items-end gap-2 flex-shrink-0">
                        <!-- Risk Badge -->
                        <span 
                          :class="[
                            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium shadow-sm border',
                            scope.risk === 'high' ? 'bg-red-50 text-red-700 border-red-200' : 
                            scope.risk === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                            'bg-green-50 text-green-700 border-green-200'
                          ]"
                        >
                          <span 
                            class="w-1.5 h-1.5 rounded-full mr-1.5"
                            :class="[
                              scope.risk === 'high' ? 'bg-red-500' : 
                              scope.risk === 'medium' ? 'bg-amber-500' : 'bg-green-500'
                            ]"
                          ></span>
                          {{ scope.risk === 'high' ? 'High Risk' : scope.risk === 'medium' ? 'Medium Risk' : 'Low Risk' }}
                        </span>
                        
                        <!-- Default Badge -->
                        <span 
                          v-if="scope.default"
                          class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 shadow-sm"
                        >
                          Recommended Default
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
        </div>
        
        <!-- Initial Select State -->
        <div v-else class="flex flex-col items-center justify-center py-32 text-center px-4">
          <div class="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-4xl mb-6 shadow-inner border border-gray-100">
            📚
          </div>
          <h2 class="text-2xl font-bold text-gray-900 mb-2">OAuth Scope Documentation</h2>
          <p class="text-gray-500 max-w-md mx-auto text-lg leading-relaxed">
            Select a provider from the sidebar to view its complete list of authentication scopes, grouped by service area.
          </p>
        </div>
        
      </div>
    </main>
    
    <!-- Copy Toast Notification -->
    <div 
      class="fixed inset-x-0 bottom-6 flex items-center justify-center px-4 pointer-events-none z-50 transition-all duration-300"
      :class="copyToast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'"
    >
      <div class="bg-gray-800 text-white px-4 py-2 rounded-lg shadow-xl font-medium text-sm flex items-center gap-2">
        <span class="text-green-400">✓</span> Copied to clipboard
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../services/api'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const providers = ref([])
const loading = ref(true)
const selectedProviderId = ref('')
const searchQuery = ref('')
const mobileMenuOpen = ref(false)
const copyToast = ref(false)

// Load preset data from backend API
const loadProviderDocs = async () => {
  loading.value = true
  try {
    const response = await api.getConnectionPresets()
    providers.value = response.data || []
    
    // Automatically select provider if ID is in hash (e.g. /docs/connections#google)
    const hash = window.location.hash.replace('#', '')
    if (hash && providers.value.some(p => p.id === hash)) {
      selectedProviderId.value = hash
    } else if (providers.value.length > 0) {
      // Default to Google since it's the largest and most common
      const google = providers.value.find(p => p.id === 'google')
      selectedProviderId.value = google ? google.id : providers.value[0].id
    }
  } catch (error) {
    console.error('Failed to load provider documentation:', error)
  } finally {
    loading.value = false
  }
}

const selectProvider = (id) => {
  selectedProviderId.value = id
  searchQuery.value = ''
  mobileMenuOpen.value = false
  // Update URL hash for sharing specific provider docs
  router.replace({ hash: `#${id}` })
  
  // Scroll to top of main area
  const main = document.querySelector('main')
  if (main) main.scrollTop = 0
}

const selectedProvider = computed(() => {
  if (!selectedProviderId.value) return null
  return providers.value.find(p => p.id === selectedProviderId.value) || null
})

const filteredGroups = computed(() => {
  if (!selectedProvider.value) return []
  
  const query = searchQuery.value.toLowerCase().trim()
  const scopes = selectedProvider.value.scopes || []
  
  // Group scopes
  const groupMap = new Map()
  
  scopes.forEach(scope => {
    // Apply search filter if query exists
    if (query) {
      const scopeIdMatch = scope.id.toLowerCase().includes(query)
      const labelMatch = (scope.label || '').toLowerCase().includes(query)
      const groupMatch = (scope.group || 'General').toLowerCase().includes(query)
      
      if (!scopeIdMatch && !labelMatch && !groupMatch) return // Skip if doesn't match
    }
    
    const groupName = scope.group || 'General'
    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, [])
    }
    groupMap.get(groupName).push(scope)
  })
  
  // Convert map to array and sort groups alphabetically,
  // but keep Identity/Authentication/General at the top
  const sortedGroups = Array.from(groupMap.entries()).map(([name, scopes]) => ({
    name,
    scopes
  })).sort((a, b) => {
    const topPriority = ['Identity', 'Authentication', 'General', 'User']
    const aIsTop = topPriority.includes(a.name)
    const bIsTop = topPriority.includes(b.name)
    
    if (aIsTop && !bIsTop) return -1
    if (!aIsTop && bIsTop) return 1
    if (aIsTop && bIsTop) return topPriority.indexOf(a.name) - topPriority.indexOf(b.name)
    
    return a.name.localeCompare(b.name)
  })
  
  return sortedGroups
})

const copyText = async (text, event) => {
  // Prevent button from remaining focused
  if (event) event.target.blur()
  
  try {
    await navigator.clipboard.writeText(text)
    showCopyToast()
  } catch (err) {
    console.error('Failed to copy text: ', err)
  }
}

let toastTimeout
const showCopyToast = () => {
  clearTimeout(toastTimeout)
  copyToast.value = true
  toastTimeout = setTimeout(() => {
    copyToast.value = false
  }, 2000)
}

onMounted(() => {
  loadProviderDocs()
})
</script>

<style scoped>
.docs-container {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

/* Custom scrollbar for main area and sidebar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.scope-group {
  animation: fadeIn 0.4s ease-out forwards;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
