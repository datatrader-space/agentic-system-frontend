<template>
  <!-- "Choose a starting point" (Screen 13): Start from blank + 3 built-in templates.
       Selecting a card applies it to the in-progress agent (instructions + empty name/desc).
       Built-in templates come from GET /api/agents/templates/ (template_scope='builtin'). -->
  <div>
    <div class="flex items-center gap-2 mb-1">
      <Sparkles class="w-4 h-4 text-indigo-600" />
      <h3 class="text-sm font-bold text-gray-900">Choose a starting point</h3>
    </div>
    <p class="text-xs text-gray-500 mb-3">
      Create an agent from scratch or use a template to get started quickly.
    </p>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <!-- Start from blank -->
      <button type="button" @click="select(null)"
        :class="['group text-left rounded-xl border p-4 transition shadow-sm hover:shadow-md',
                 selectedKey === '__blank__' ? 'border-indigo-500 ring-2 ring-indigo-100 bg-indigo-50/40' : 'border-gray-200 bg-white hover:border-indigo-300']">
        <span class="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 mb-2">
          <Plus class="w-5 h-5" />
        </span>
        <div class="text-sm font-semibold text-gray-900">Start from blank</div>
        <p class="text-[11px] text-gray-500 mt-0.5 leading-snug">Build a custom agent from scratch.</p>
      </button>

      <!-- Loading skeletons -->
      <template v-if="loading">
        <div v-for="n in 3" :key="'sk-' + n" class="rounded-xl border border-gray-200 bg-white p-4 animate-pulse">
          <div class="h-9 w-9 rounded-lg bg-gray-100 mb-2"></div>
          <div class="h-3 w-2/3 bg-gray-100 rounded mb-1.5"></div>
          <div class="h-2.5 w-full bg-gray-100 rounded"></div>
        </div>
      </template>

      <!-- Built-in templates -->
      <button v-else v-for="t in templates" :key="t.id" type="button" @click="select(t)"
        :class="['group text-left rounded-xl border p-4 transition shadow-sm hover:shadow-md',
                 selectedKey === String(t.id) ? 'border-indigo-500 ring-2 ring-indigo-100 bg-indigo-50/40' : 'border-gray-200 bg-white hover:border-indigo-300']">
        <span class="inline-flex h-9 w-9 items-center justify-center rounded-lg mb-2"
              :class="iconStyle(t).bg">
          <component :is="iconStyle(t).icon" class="w-5 h-5" :class="iconStyle(t).color" />
        </span>
        <div class="text-sm font-semibold text-gray-900 truncate">{{ t.name }}</div>
        <p class="text-[11px] text-gray-500 mt-0.5 leading-snug line-clamp-2">
          {{ t.template_description || t.description }}
        </p>
      </button>
    </div>

    <p v-if="loadError" class="text-[11px] text-amber-600 mt-2">
      Couldn’t load templates — you can still start from blank.
    </p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Sparkles, Plus, Headphones, Search, BadgeHelp } from 'lucide-vue-next'
import api from '../../services/api'

const emit = defineEmits(['apply'])

const templates = ref([])
const loading = ref(false)
const loadError = ref(false)
const selectedKey = ref('__blank__')

function iconStyle(t) {
  const name = (t.name || '').toLowerCase()
  if (name.includes('lead')) return { icon: BadgeHelp, bg: 'bg-emerald-50', color: 'text-emerald-600' }
  if (name.includes('research')) return { icon: Search, bg: 'bg-blue-50', color: 'text-blue-600' }
  if (name.includes('support')) return { icon: Headphones, bg: 'bg-amber-50', color: 'text-amber-600' }
  return { icon: Sparkles, bg: 'bg-violet-50', color: 'text-violet-600' }
}

function select(t) {
  selectedKey.value = t ? String(t.id) : '__blank__'
  emit('apply', t)   // null = blank
}

onMounted(async () => {
  loading.value = true
  try {
    const res = await api.listAgentTemplates()
    const all = Array.isArray(res.data) ? res.data : []
    // Prefer built-in templates; cap at 3 to match the layout.
    const builtin = all.filter(t => t.template_scope === 'builtin')
    templates.value = (builtin.length ? builtin : all).slice(0, 3)
  } catch (e) {
    loadError.value = true
    templates.value = []
  } finally {
    loading.value = false
  }
})
</script>
