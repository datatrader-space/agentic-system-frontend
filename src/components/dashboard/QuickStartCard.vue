<template>
  <button
    type="button"
    class="group flex min-h-[92px] items-center gap-4 rounded-2xl border border-[#E5E7EB] bg-white p-5 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
    @click="$emit('click')"
  >
    <span class="grid h-12 w-12 shrink-0 place-items-center rounded-xl" :class="tint">
      <component :is="icon" :size="20" :stroke-width="2" />
    </span>
    <span class="min-w-0 flex-1">
      <span class="block text-sm font-semibold text-[#0F172A]">{{ label }}</span>
      <span class="mt-0.5 block text-xs leading-snug text-[#64748B]">{{ desc }}</span>
    </span>
    <ChevronRight :size="16" :stroke-width="2" class="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#2563EB]" />
  </button>
</template>

<script setup>
import { ChevronRight } from 'lucide-vue-next'

defineProps({
  icon: { type: [Object, Function], required: true },
  label: { type: String, required: true },
  desc: { type: String, default: '' },
  tint: { type: String, default: 'bg-blue-50 text-blue-600' },
})
defineEmits(['click'])
</script>
