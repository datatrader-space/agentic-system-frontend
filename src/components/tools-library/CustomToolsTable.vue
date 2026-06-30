<template>
  <div>
    <div
      v-if="!loading && !tools.length"
      class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#CBD5E1] bg-white px-6 py-14 text-center"
    >
      <span class="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600">
        <FileCode :size="22" :stroke-width="2" />
      </span>
      <p class="mt-3 text-[15px] font-semibold text-[#0F172A]">No custom tools yet</p>
      <p class="mt-1 max-w-sm text-[13px] text-[#64748B]">
        Create a tool from a YAML spec or wrap an external HTTP endpoint to give your agents new capabilities.
      </p>
      <button
        class="mt-4 inline-flex items-center gap-2 rounded-[11px] bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(37,99,235,0.25)] hover:bg-[#1D4ED8]"
        @click="$emit('create')"
      >
        <Plus :size="16" :stroke-width="2" />
        Create Custom Tool
      </button>
    </div>

    <ToolsTable
      v-else
      :tools="tools"
      :loading="loading"
      @select="$emit('select', $event)"
      @toggle="$emit('toggle', $event)"
      @delete="$emit('delete', $event)"
    />
  </div>
</template>

<script setup>
import { FileCode, Plus } from 'lucide-vue-next'
import ToolsTable from './ToolsTable.vue'

defineProps({
  tools: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})
defineEmits(['select', 'toggle', 'delete', 'create'])
</script>
