<template>
  <div
    class="service-card group bg-white rounded-[16px] shadow-sm border border-slate-200/60 hover:-translate-y-1 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col"
    :class="{ 'opacity-60 grayscale-[50%]': !service.enabled }"
    @click="$emit('click', service)"
  >
    <div class="p-5 sm:p-6 flex-1 flex flex-col">
      <!-- Icon, Name, and Status -->
      <div class="flex items-start gap-4 mb-4">
        <!-- Icon Block -->
        <div class="w-14 h-14 rounded-[14px] bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100/50 shadow-[0_2px_8px_rgba(99,102,241,0.1)] flex items-center justify-center shrink-0 text-3xl">
          <span class="drop-shadow-sm">{{ service.icon || getServiceIcon(service.category) }}</span>
        </div>
        
        <div class="flex-1 min-w-0 pt-1">
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-[18px] font-extrabold text-slate-900 truncate tracking-tight">{{ service.name }}</h3>
            <!-- Inline Status -->
            <span
              v-if="service.enabled"
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-[10px] font-bold tracking-widest uppercase bg-emerald-100 text-emerald-700 border border-emerald-200 shrink-0 shadow-sm"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]"></span> Active
            </span>
            <span
              v-else
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-[10px] font-bold tracking-widest uppercase bg-slate-100 text-slate-500 border border-slate-200 shrink-0 shadow-sm"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Disabled
            </span>
          </div>
          <p class="text-[12px] font-bold text-indigo-500/80 uppercase tracking-widest mt-0.5">{{ service.category || 'General' }}</p>
        </div>
      </div>

      <!-- Description -->
      <p class="text-[13px] text-slate-600 mb-5 line-clamp-2 leading-relaxed">
        {{ service.description }}
      </p>

      <!-- Inline Stats & URL -->
      <div class="mt-auto space-y-4">
        <!-- Actions Metadata -->
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1.5 text-[13px] bg-slate-50 border border-slate-100 shadow-sm rounded-lg px-3 py-1.5">
            <span class="font-bold tracking-wide uppercase text-[10px] text-slate-400">Actions:</span>
            <span class="font-bold text-slate-800">{{ service.total_actions }}</span>
          </div>
          <div class="flex items-center gap-1.5 text-[13px] bg-indigo-50 border border-indigo-100 shadow-sm rounded-lg px-3 py-1.5">
            <span class="font-bold tracking-wide uppercase text-[10px] text-indigo-400">Enabled:</span>
            <span class="font-bold text-indigo-700">{{ service.enabled_actions }}</span>
          </div>
        </div>

        <!-- URL Block -->
        <div class="flex items-center gap-2">
            <div class="flex-1 bg-slate-100/50 hover:bg-slate-50 border border-slate-200/60 rounded-[10px] px-3 py-2 flex items-center overflow-hidden transition-colors">
               <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2.5 shrink-0">URL</span>
               <span class="text-[12px] font-mono font-medium text-slate-600 truncate">{{ service.base_url }}</span>
            </div>
        </div>
      </div>
    </div>

    <!-- Card Footer / Actions -->
    <div class="px-5 py-3.5 border-t border-slate-100 bg-slate-50/50 rounded-b-[16px] flex items-center justify-between" @click.stop>
      <!-- Auth Type / Last Used (Left aligned) -->
      <div class="flex items-center gap-2 text-[11px] font-medium text-slate-500 truncate mr-2">
         <svg class="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
         <span class="truncate">{{ formatAuthType(service.auth_type) }}</span>
      </div>

      <!-- Action Buttons (Right aligned) -->
      <div class="flex items-center gap-1.5 shrink-0">
        <!-- iOS Toggle -->
        <label class="relative inline-flex items-center cursor-pointer mr-2" title="Toggle Service">
          <input type="checkbox" :checked="service.enabled" @change="$emit('toggle-enabled', service.id, !service.enabled)" class="sr-only peer">
          <div class="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-500"></div>
        </label>

        <!-- Share Button -->
        <button
          @click="$emit('share', service)"
          class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          title="Share Service"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
        </button>

        <!-- Delete Button -->
        <button
          @click="$emit('delete', service.id)"
          class="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          title="Delete Service"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ServiceCard',
  props: {
    service: {
      type: Object,
      required: true
    }
  },
  emits: ['click', 'delete', 'toggle-enabled', 'share'],
  setup() {
    const getServiceIcon = (category) => {
      const icons = {
        'project_management': '📋',
        'communication': '💬',
        'file_storage': '📁',
        'code_repository': '💻',
        'task_management': '✅',
        'crm': '👥',
        'marketing': '📈',
        'analytics': '📊'
      }
      return icons[category] || '🌐'
    }

    const formatAuthType = (authType) => {
      const types = {
        'bearer': 'Bearer Token',
        'api_key': 'API Key',
        'oauth2': 'OAuth 2.0',
        'basic': 'Basic Auth'
      }
      return types[authType] || authType
    }

    const formatDate = (dateString) => {
      const date = new Date(dateString)
      const now = new Date()
      const diff = now - date

      if (diff < 60000) return 'Just now'
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
      if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`

      return date.toLocaleDateString()
    }

    return {
      getServiceIcon,
      formatAuthType,
      formatDate
    }
  }
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
