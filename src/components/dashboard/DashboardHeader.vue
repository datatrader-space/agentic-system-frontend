<template>
  <header class="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div>
      <h1 class="text-[30px] font-bold leading-tight tracking-tight text-[#0F172A]">
        Welcome back<span v-if="firstName">, {{ firstName }}</span>
      </h1>
      <p class="mt-1.5 text-sm text-[#64748B]">Here's what's happening with your agents and workflows.</p>
    </div>
    <div class="flex items-center gap-2.5">
      <button class="inline-flex items-center gap-2 rounded-[11px] border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-[13.5px] font-medium text-[#475569] hover:border-slate-300">
        All Agents
        <ChevronDown :size="15" :stroke-width="2" />
      </button>
      <button
        class="inline-flex items-center gap-2 rounded-[11px] bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(37,99,235,0.25)] hover:bg-[#1D4ED8]"
        @click="$emit('new-agent')"
      >
        <Plus :size="16" :stroke-width="2" />
        New Agent
      </button>
    </div>
  </header>
</template>

<script setup>
import { ChevronDown, Plus } from 'lucide-vue-next'

defineProps({
  firstName: { type: String, default: '' },
})
defineEmits(['new-agent'])
</script>
