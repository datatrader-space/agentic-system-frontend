<template>
  <!-- Grid View -->
  <div
    v-if="viewMode === 'grid'"
    class="group bg-white rounded-2xl shadow-sm border border-gray-200 hover:shadow-xl hover:border-blue-300 transition-all duration-300 overflow-hidden flex flex-col h-full transform hover:-translate-y-1"
  >
    <!-- Card Header with Gradient -->
    <div class="relative bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6 pb-8">
      <!-- Tool Type Badge (Phase A) -->
      <div class="absolute top-4 left-4">
        <span
          :class="[
            'px-3 py-1.5 text-xs rounded-full font-semibold shadow-sm',
            getToolTypeBadgeClass(tool)
          ]"
        >
          {{ getToolTypeLabel(tool) }}
        </span>
      </div>
      
      <!-- Status Badge -->
      <div class="absolute top-4 right-4">
        <span
          :class="[
            'px-3 py-1.5 text-xs rounded-full font-semibold shadow-sm backdrop-blur-sm',
            tool.enabled
              ? 'bg-green-500/90 text-white'
              : 'bg-gray-400/90 text-white'
          ]"
        >
          {{ tool.enabled ? '✓ Active' : 'Inactive' }}
        </span>
      </div>

      <!-- Tool Icon/Avatar -->
      <div class="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center text-3xl shadow-lg mb-4">
        {{ getToolIcon(tool.category) }}
      </div>

      <!-- Tool Name -->
      <h3 class="text-xl font-bold text-gray-900 mb-2 leading-tight">{{ tool.name }}</h3>

      <!-- Version Badge -->
      <div class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/70 backdrop-blur-sm rounded-lg text-xs font-medium text-gray-700">
        <svg class="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
        v{{ tool.version }}
      </div>
    </div>

    <!-- Card Body -->
    <div class="flex-1 p-6 pt-4 flex flex-col">
      <!-- Description -->
      <p class="text-sm text-gray-600 leading-relaxed mb-4 line-clamp-3 flex-1">
        {{ tool.description }}
      </p>

      <!-- Stats Row -->
      <div class="flex items-center gap-4 mb-4 text-xs">
        <div class="flex items-center gap-1.5 text-gray-600">
          <svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span class="font-medium">{{ tool.parameters.length }} params</span>
        </div>

        <div v-if="tool.permissions && tool.permissions.length > 0" class="flex items-center gap-1.5 text-gray-600">
          <svg class="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span class="font-medium">{{ tool.permissions.length }} perms</span>
        </div>
      </div>

      <!-- Tags -->
      <div v-if="tool.tags && tool.tags.length > 0" class="flex flex-wrap gap-1.5 mb-4">
        <span
          v-for="tag in tool.tags.slice(0, 3)"
          :key="tag"
          class="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium"
        >
          #{{ tag }}
        </span>
        <span
          v-if="tool.tags.length > 3"
          class="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium"
        >
          +{{ tool.tags.length - 3 }}
        </span>
      </div>

      <!-- Actions -->
      <div class="flex gap-2 pt-4 border-t border-gray-100">
        <button
          @click="$emit('execute', tool)"
          :disabled="!tool.enabled"
          class="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all font-semibold text-sm disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed shadow-sm hover:shadow-md flex items-center justify-center gap-2"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
          </svg>
          Execute
        </button>
        <button
          @click="$emit('view-details', tool)"
          class="px-4 py-2.5 border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all font-semibold text-sm flex items-center justify-center"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>
    </div>
  </div>

  <!-- List View -->
  <div
    v-else
    class="group bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg hover:border-blue-300 transition-all duration-300 p-6 flex items-start gap-6 transform hover:-translate-x-1"
  >
    <!-- Left: Icon and Info -->
    <div class="flex-1 min-w-0">
      <div class="flex items-start gap-4 mb-3">
        <!-- Tool Icon -->
        <div class="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center text-2xl shadow-md shrink-0">
          {{ getToolIcon(tool.category) }}
        </div>

        <!-- Tool Name and Badges -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1 flex-wrap">
            <h3 class="text-lg font-bold text-gray-900 truncate">{{ tool.name }}</h3>
            
            <!-- Tool Type Badge (Phase A) -->
            <span
              :class="[
                'px-2.5 py-1 text-xs rounded-full font-semibold shadow-sm',
                getToolTypeBadgeClass(tool)
              ]"
            >
              {{ getToolTypeLabel(tool) }}
            </span>
            
            <!-- Status Badge -->
            <span
              :class="[
                'px-2.5 py-1 text-xs rounded-full font-semibold',
                tool.enabled
                  ? 'bg-green-500/90 text-white'
                  : 'bg-gray-400/90 text-white'
              ]"
            >
              {{ tool.enabled ? '✓' : '✗' }}
            </span>
          </div>
          <p class="text-sm text-gray-600 line-clamp-2">{{ tool.description }}</p>
        </div>
      </div>

      <!-- Meta Row -->
      <div class="flex items-center gap-4 flex-wrap">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-lg text-xs font-medium text-gray-700">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          v{{ tool.version }}
        </span>

        <span class="text-xs text-gray-600 font-medium">
          <svg class="w-4 h-4 inline text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {{ tool.parameters.length }} parameters
        </span>

        <div v-if="tool.tags && tool.tags.length > 0" class="flex flex-wrap gap-1.5">
          <span
            v-for="tag in tool.tags.slice(0, 3)"
            :key="tag"
            class="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium"
          >
            #{{ tag }}
          </span>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex gap-2 flex-shrink-0">
        <button
          @click="$emit('execute', tool)"
          :disabled="!tool.enabled"
          class="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all font-semibold text-sm disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed shadow-sm hover:shadow-md flex items-center gap-2"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
          </svg>
          Execute
        </button>
        <button
          @click="$emit('view-details', tool)"
          class="px-4 py-2.5 border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all font-semibold text-sm"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ToolCard',
  props: {
    tool: {
      type: Object,
      required: true
    },
    viewMode: {
      type: String,
      default: 'grid'
    }
  },
  emits: ['execute', 'view-details'],
  methods: {
    getToolIcon(category) {
      const icons = {
        'crs': '🔍',
        'shell': '💻',
        'filesystem': '📁',
        'git': '🌿',
        'testing': '✅',
        'network': '🌐',
        'database': '🗄️',
        'custom': '⚙️',
        'jira': '📋',
        'remote': '🌐'
      }
      return icons[category] || '🔧'
    },
    
    // Phase A: Tool type identification
    getToolTypeLabel(tool) {
      // Check tool_kind field from backend (Phase 5)
      const toolKind = tool.tool_kind || tool.type || 'local'
      
      const labels = {
        'local': '🔧 Local',
        'remote': '🌐 Remote',
        'yaml': '📝 YAML'
      }
      
      return labels[toolKind] || '🔧 Local'
    },
    
    getToolTypeBadgeClass(tool) {
      const toolKind = tool.tool_kind || tool.type || 'local'
      
      const classes = {
        'local': 'bg-blue-500/90 text-white',
        'remote': 'bg-green-500/90 text-white',
        'yaml': 'bg-purple-500/90 text-white'
      }
      
      return classes[toolKind] || 'bg-blue-500/90 text-white'
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

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Smooth transitions */
button:active {
  transform: scale(0.98);
}
</style>
