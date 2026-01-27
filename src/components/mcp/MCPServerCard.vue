<template>
  <div 
    class="bg-white rounded-lg shadow-lg p-5 hover:shadow-xl transition cursor-pointer border-l-4"
    :class="borderClass"
    @click="$emit('click')"
  >
    <!-- Header -->
    <div class="flex justify-between items-start mb-3">
      <div class="flex items-center gap-3">
        <span class="text-2xl">{{ server.icon || '🔌' }}</span>
        <div>
          <h3 class="font-bold text-gray-900">{{ server.name }}</h3>
          <span class="text-xs px-2 py-0.5 rounded-full" :class="transportBadge">
            {{ server.transport_type }}
          </span>
        </div>
      </div>
      
      <!-- Status Toggle -->
      <label class="relative inline-flex items-center cursor-pointer" @click.stop>
        <input
          type="checkbox"
          :checked="server.enabled"
          @change="$emit('toggle-enabled', server.id, $event.target.checked)"
          class="sr-only peer"
        >
        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
      </label>
    </div>

    <!-- Description -->
    <p class="text-gray-600 text-sm mb-3 line-clamp-2">
      {{ server.description || 'No description' }}
    </p>

    <!-- Command Display -->
    <div v-if="server.command" class="bg-gray-100 rounded p-2 text-xs font-mono text-gray-700 mb-3 truncate">
      {{ server.command }}
    </div>

    <!-- Stats Row -->
    <div class="flex justify-between items-center text-sm text-gray-500 mb-3">
      <div class="flex items-center gap-1">
        <span>🔧</span>
        <span>{{ server.total_tools || 0 }} tools</span>
      </div>
      <div v-if="server.last_used_at" class="text-xs">
        Last used: {{ formatDate(server.last_used_at) }}
      </div>
    </div>

    <!-- Circuit Breaker Status -->
    <div v-if="circuitBreakerStatus" class="flex items-center gap-2 text-xs mb-3">
      <span :class="cbStatusClass">{{ cbStatusIcon }} {{ circuitBreakerStatus }}</span>
    </div>

    <!-- Actions -->
    <div class="flex gap-2 pt-2 border-t border-gray-100" @click.stop>
      <button
        @click="$emit('refresh-tools', server.id)"
        class="flex-1 px-3 py-1.5 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition"
        title="Refresh Tools"
      >
        🔄 Refresh
      </button>
      <button
        v-if="circuitBreakerStatus === 'OPEN'"
        @click="$emit('reset-circuit-breaker', server.id)"
        class="flex-1 px-3 py-1.5 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition"
        title="Reset Circuit Breaker"
      >
        ⚡ Reset CB
      </button>
      <button
        @click="$emit('delete', server.id)"
        class="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
        title="Delete"
      >
        🗑️
      </button>
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
    borderClass() {
      if (!this.server.enabled) return 'border-gray-300'
      if (this.circuitBreakerStatus === 'OPEN') return 'border-red-500'
      return 'border-purple-500'
    },
    transportBadge() {
      const badges = {
        stdio: 'bg-blue-100 text-blue-700',
        http: 'bg-green-100 text-green-700',
        sse: 'bg-orange-100 text-orange-700'
      }
      return badges[this.server.transport_type] || 'bg-gray-100 text-gray-700'
    },
    circuitBreakerStatus() {
      return this.server.circuit_breaker?.state?.toUpperCase() || null
    },
    cbStatusIcon() {
      const icons = {
        CLOSED: '✅',
        OPEN: '🔴',
        HALF_OPEN: '🟡'
      }
      return icons[this.circuitBreakerStatus] || ''
    },
    cbStatusClass() {
      const classes = {
        CLOSED: 'text-green-600',
        OPEN: 'text-red-600',
        HALF_OPEN: 'text-yellow-600'
      }
      return classes[this.circuitBreakerStatus] || 'text-gray-600'
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
