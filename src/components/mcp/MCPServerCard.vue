<template>
  <div
    class="mcp-server-card group bg-white rounded-[16px] shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col relative border overflow-hidden"
    :class="[
      server.enabled ? 'border-slate-200/80' : 'border-slate-200/40 opacity-70 grayscale-[30%]',
      circuitBreakerStatus === 'OPEN' ? 'ring-1 ring-red-400 border-red-200' : ''
    ]"
    @click="$emit('click')"
  >
    <div class="p-5 sm:p-6 flex-1 flex flex-col">
      <!-- Icon, Name, and Status -->
      <div class="flex items-start gap-4 mb-4">
        <!-- Icon Block -->
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-50 to-white border border-purple-100 shadow-sm flex items-center justify-center shrink-0 text-2xl">
          {{ server.icon || '🔌' }}
        </div>
        
        <div class="flex-1 min-w-0 pt-0.5">
          <div class="flex items-center gap-2">
            <h3 class="text-[16px] font-bold text-slate-900 truncate">{{ server.name }}</h3>
          </div>
          <div class="flex items-center gap-2 mt-1">
            <span class="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase border" :class="transportBadge">
              {{ server.transport_type }}
            </span>
            <span
              v-if="!server.enabled"
              class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase bg-slate-100 text-slate-500 border border-slate-200"
            >
              Disabled
            </span>
          </div>
        </div>
      </div>

      <!-- Description -->
      <p class="text-[13px] text-slate-600 mb-5 line-clamp-2 leading-relaxed h-[38px]">
        {{ server.description || 'No description provided.' }}
      </p>

      <!-- Inline Stats & URL -->
      <div class="mt-auto space-y-3">
        <!-- URL/Command Block -->
        <div v-if="server.command" class="flex items-center gap-2">
            <div class="flex-1 bg-slate-50 border border-slate-100 rounded-[8px] px-2.5 py-1.5 flex items-center overflow-hidden">
               <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mr-2 shrink-0">CMD</span>
               <span class="text-[11px] font-mono text-slate-600 truncate">{{ server.command }}</span>
            </div>
        </div>

        <!-- Meta info (Tools, Last Used, CB Status) -->
        <div class="flex items-center justify-between mt-2">
           <div class="flex items-center gap-1.5 text-[12px] bg-purple-50/50 border border-purple-100 rounded-lg px-2.5 py-1">
             <span class="font-medium text-purple-500">Tools:</span>
             <span class="font-bold text-purple-700">{{ server.total_tools || 0 }}</span>
           </div>
           <div v-if="circuitBreakerStatus" class="flex items-center gap-1.5 text-[11px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-md border" :class="cbStatusBadgeClass">
              <span class="w-1.5 h-1.5 rounded-full" :class="cbDotClass"></span>
              {{ circuitBreakerStatus }}
           </div>
        </div>
      </div>
    </div>

    <!-- Card Footer / Actions -->
    <div class="px-5 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between" @click.stop>
      <!-- Date Info (Left aligned) -->
      <div class="flex items-center gap-2 text-[11px] font-medium text-slate-400 truncate mr-2">
         <span v-if="server.last_used_at" class="truncate">Used · {{ formatDate(server.last_used_at) }}</span>
         <span v-else>Never Used</span>
      </div>

      <!-- Action Buttons (Right aligned) -->
      <div class="flex items-center gap-1.5 shrink-0">
        <!-- iOS Toggle -->
        <label class="relative inline-flex items-center cursor-pointer mr-2" title="Toggle Connection">
          <input type="checkbox" :checked="server.enabled" @change="$emit('toggle-enabled', server.id, $event.target.checked)" class="sr-only peer">
          <div class="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-purple-600"></div>
        </label>

        <!-- Refresh Tools Button -->
        <button
          @click="$emit('refresh-tools', server.id)"
          class="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors flex items-center justify-center gap-1"
          title="Refresh Remote Tools"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
        </button>

        <!-- Reset CB Button -->
        <button
          v-if="circuitBreakerStatus === 'OPEN'"
          @click="$emit('reset-circuit-breaker', server.id)"
          class="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-1 bg-red-50/50"
          title="Reset Circuit Breaker"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
        </button>

        <!-- Delete Button -->
        <button
          @click="$emit('delete', server.id)"
          class="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-1"
          title="Delete Server"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'MCPServerCard',
  props: {
    server: {
      type: Object,
      required: true
    }
  },
  emits: ['click', 'delete', 'toggle-enabled', 'refresh-tools', 'reset-circuit-breaker'],
  computed: {
    transportBadge() {
      const badges = {
        stdio: 'bg-blue-50 text-blue-600 border-blue-100',
        http: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        sse: 'bg-orange-50 text-orange-600 border-orange-100'
      }
      return badges[this.server.transport_type] || 'bg-slate-50 text-slate-600 border-slate-200'
    },
    circuitBreakerStatus() {
      return this.server.circuit_breaker?.state?.toUpperCase() || null
    },
    cbDotClass() {
      const dots = {
        CLOSED: 'bg-emerald-500',
        OPEN: 'bg-red-500',
        HALF_OPEN: 'bg-amber-500'
      }
      return dots[this.circuitBreakerStatus] || 'bg-slate-400'
    },
    cbStatusBadgeClass() {
      const classes = {
        CLOSED: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        OPEN: 'bg-red-50 text-red-600 border-red-100',
        HALF_OPEN: 'bg-amber-50 text-amber-600 border-amber-100'
      }
      return classes[this.circuitBreakerStatus] || 'bg-slate-50 text-slate-600 border-slate-200'
    }
  },
  methods: {
    formatDate(dateStr) {
      if (!dateStr) return ''
      const date = new Date(dateStr)
      return date.toLocaleDateString()
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
