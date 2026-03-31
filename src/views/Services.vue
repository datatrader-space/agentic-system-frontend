<template>
  <div class="services-container p-6 lg:p-8 space-y-8">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
             <div class="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shadow-sm">
                 <svg class="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path></svg>
             </div>
             Services
          </h1>
          <p class="mt-2 text-sm sm:text-[15px] font-medium text-slate-500">
            Register external services and auto-discover their tools
          </p>
        </div>
        <div class="flex items-center gap-3">
          <OwnerFilter v-model="ownerFilter" @update:modelValue="loadServices" />
          <router-link 
            to="/services/drafts"
            class="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-[10px] hover:bg-slate-50 hover:border-slate-300 transition-all font-semibold shadow-sm text-[13px] flex items-center gap-2"
          >
            <svg class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
            Drafts
          </router-link>
          <router-link 
            to="/services/register"
            class="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-[10px] hover:bg-slate-50 hover:border-slate-300 transition-all font-semibold shadow-sm text-[13px] flex items-center gap-2"
          >
            <svg class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
            Wizard
          </router-link>
          <button
            @click="showRegistrationModal = true"
            class="px-5 py-2.5 bg-slate-900 text-white rounded-[10px] hover:bg-slate-800 transition-all font-semibold shadow-[0_2px_4px_rgba(0,0,0,0.1)] text-[13px] flex items-center gap-2"
          >
            <svg class="w-4 h-4 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
            Register Service
          </button>
        </div>
      </div>

      <!-- Integrated Metrics Bar -->
      <div class="bg-white rounded-[16px] shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-slate-200/60 overflow-hidden mb-8">
        <div class="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          <div class="p-6 lg:px-8">
            <div class="flex items-center justify-between mb-4">
              <p class="text-[13px] font-bold text-slate-500 uppercase tracking-wide">Total Services</p>
              <div class="w-10 h-10 rounded-[10px] bg-slate-900/10 flex items-center justify-center">
                 <svg class="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
              </div>
            </div>
            <span class="text-4xl font-extrabold tracking-tight text-slate-900">{{ services.length }}</span>
          </div>
          <div class="p-6 lg:px-8 border-l-0 md:border-l border-slate-100">
            <div class="flex items-center justify-between mb-4">
              <p class="text-[13px] font-bold text-slate-500 uppercase tracking-wide">Active Services</p>
              <div class="w-10 h-10 rounded-[10px] bg-emerald-500/10 flex items-center justify-center">
                 <svg class="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </div>
            </div>
            <span class="text-4xl font-extrabold tracking-tight text-emerald-600">{{ activeCount }}</span>
          </div>
          <div class="p-6 lg:px-8">
            <div class="flex items-center justify-between mb-4">
               <p class="text-[13px] font-bold text-slate-500 uppercase tracking-wide">Total Actions</p>
               <div class="w-10 h-10 rounded-[10px] bg-indigo-500/10 flex items-center justify-center">
                 <svg class="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
               </div>
            </div>
            <span class="text-4xl font-extrabold tracking-tight text-indigo-600">{{ totalActions }}</span>
          </div>
          <div class="p-6 lg:px-8 border-l-0 md:border-l border-slate-100">
            <div class="flex items-center justify-between mb-4">
              <p class="text-[13px] font-bold text-slate-500 uppercase tracking-wide">Enabled Actions</p>
              <div class="w-10 h-10 rounded-[10px] bg-blue-500/10 flex items-center justify-center">
                 <svg class="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              </div>
            </div>
            <span class="text-4xl font-extrabold tracking-tight text-blue-600">{{ enabledActions }}</span>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p class="mt-4 text-gray-600">Loading services...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="services.length === 0" class="bg-white rounded-lg shadow-lg p-12 text-center">
        <div class="text-6xl mb-4">🌐</div>
        <h2 class="text-2xl font-bold text-gray-900 mb-2">No Services Yet</h2>
        <p class="text-gray-600 mb-6 max-w-md mx-auto">
          Register your first service to auto-discover tools and actions.
          Connect to Jira, Slack, GitHub, or any service with an OpenAPI spec.
        </p>
        <button
          @click="showRegistrationModal = true"
          class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
        >
          Register Your First Service
        </button>
      </div>

      <!-- Services Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ServiceCard
          v-for="service in services"
          :key="service.id"
          :service="service"
          @click="viewService(service)"
          @delete="handleDeleteService"
          @toggle-enabled="handleToggleEnabled"
          @share="handleShareService"
        />
      </div>

      <!-- Service Registration Modal -->
      <ServiceRegistrationModal
        v-if="showRegistrationModal"
        @close="showRegistrationModal = false"
        @registered="handleServiceRegistered"
      />

      <!-- Service Detail Modal -->
      <ServiceDetailModal
        v-if="selectedService"
        :service="selectedService"
        @close="selectedService = null"
        @updated="loadServices"
      />

      <!-- Service Share Modal -->
      <ServiceShareModal
        v-if="sharingService"
        :service="sharingService"
        @close="sharingService = null"
        @updated="loadServices"
      />
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import api from '../services/api'
import ServiceCard from '../components/services/ServiceCard.vue'
import ServiceRegistrationModal from '../components/services/ServiceRegistrationModal.vue'
import ServiceDetailModal from '../components/services/ServiceDetailModal.vue'
import ServiceShareModal from '../components/services/ServiceShareModal.vue'
import OwnerFilter from '../components/common/OwnerFilter.vue'

export default {
  name: 'Services',
  components: {
    ServiceCard,
    ServiceRegistrationModal,
    ServiceDetailModal,
    ServiceShareModal,
    OwnerFilter
  },
  setup() {
    const services = ref([])
    const loading = ref(false)
    const showRegistrationModal = ref(false)
    const selectedService = ref(null)
    const sharingService = ref(null)
    const ownerFilter = ref('')

    // Computed stats
    const activeCount = computed(() => services.value.filter(s => s.enabled).length)
    const totalActions = computed(() => services.value.reduce((sum, s) => sum + s.total_actions, 0))
    const enabledActions = computed(() => services.value.reduce((sum, s) => sum + s.enabled_actions, 0))

    // Methods
    const loadServices = async () => {
      loading.value = true
      try {
        const params = {}
        if (ownerFilter.value) params.owner = ownerFilter.value
        const response = await api.getServices(params)
        services.value = response.data.services || []
      } catch (error) {
        console.error('Failed to load services:', error)
        alert('Failed to load services: ' + (error.response?.data?.error || error.message))
      } finally {
        loading.value = false
      }
    }

    const viewService = async (service) => {
      try {
        const response = await api.getService(service.id)
        selectedService.value = response.data
      } catch (error) {
        console.error('Failed to load service details:', error)
        alert('Failed to load service details')
      }
    }

    const handleServiceRegistered = async () => {
      showRegistrationModal.value = false
      await loadServices()
      alert('Service registered successfully!')
    }

    const handleDeleteService = async (serviceId) => {
      if (!confirm('Are you sure you want to delete this service? All associated actions will be removed.')) {
        return
      }

      try {
        await api.deleteService(serviceId)
        await loadServices()
        alert('Service deleted successfully')
      } catch (error) {
        console.error('Failed to delete service:', error)
        alert('Failed to delete service: ' + (error.response?.data?.error || error.message))
      }
    }

    const handleToggleEnabled = async (serviceId, enabled) => {
      try {
        await api.updateService(serviceId, { enabled })
        await loadServices()
      } catch (error) {
        console.error('Failed to update service:', error)
        alert('Failed to update service')
      }
    }

    const handleShareService = (service) => {
      sharingService.value = service
    }

    onMounted(() => {
      loadServices()
    })

    return {
      services,
      loading,
      showRegistrationModal,
      selectedService,
      sharingService,
      ownerFilter,
      activeCount,
      totalActions,
      enabledActions,
      loadServices,
      viewService,
      handleServiceRegistered,
      handleDeleteService,
      handleToggleEnabled,
      handleShareService
    }
  }
}
</script>

<style scoped>
.services-container {
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
