<template>
  <div class="relative" ref="root">
    <button
      class="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#2457F5] px-5 text-[13px] font-bold text-white shadow-[0_8px_16px_rgba(37,99,235,0.18)] hover:bg-[#1D4ED8]"
      @click="open = !open"
    >
      <Plus :size="16" :stroke-width="2" />
      Add Tool
    </button>

    <div
      v-if="open"
      class="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-[0_10px_30px_rgba(16,24,40,0.12)]"
    >
      <button
        v-for="item in items"
        :key="item.key"
        class="flex w-full items-start gap-3 px-3.5 py-2.5 text-left hover:bg-slate-50"
        @click="pick(item.key)"
      >
        <span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg" :class="item.tint">
          <component :is="item.icon" :size="16" :stroke-width="2" />
        </span>
        <span class="min-w-0">
          <span class="block text-[13px] font-semibold text-[#0F172A]">{{ item.label }}</span>
          <span class="block text-[11.5px] text-[#64748B]">{{ item.desc }}</span>
        </span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Plus, Server, FileCode, Globe } from 'lucide-vue-next'

const emit = defineEmits(['select'])
const open = ref(false)
const root = ref(null)

const items = [
  { key: 'mcp', label: 'Add MCP Server', desc: 'Connect a Model Context Protocol server', icon: Server, tint: 'bg-violet-50 text-violet-600' },
  { key: 'yaml', label: 'Create Custom Tool', desc: 'Define a tool from a YAML spec', icon: FileCode, tint: 'bg-blue-50 text-blue-600' },
  { key: 'remote', label: 'Register Remote Tool', desc: 'Wrap an external HTTP endpoint', icon: Globe, tint: 'bg-emerald-50 text-emerald-600' },
]

function pick(key) {
  open.value = false
  emit('select', key)
}

function onDoc(e) {
  if (root.value && !root.value.contains(e.target)) open.value = false
}
onMounted(() => document.addEventListener('click', onDoc))
onBeforeUnmount(() => document.removeEventListener('click', onDoc))
</script>
