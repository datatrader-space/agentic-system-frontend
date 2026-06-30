<template>
  <div class="flex min-h-[116px] items-center gap-4 rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
    <span
      class="grid h-12 w-12 shrink-0 place-items-center"
      :class="[tint, round ? 'rounded-full' : 'rounded-xl']"
    >
      <component :is="icon" :size="23" :stroke-width="2" />
    </span>
    <div class="min-w-0">
      <p class="text-[13px] font-medium text-[#475569]">{{ label }}</p>
      <p v-if="loading" class="mt-1 h-7 w-16 animate-pulse rounded bg-slate-100" />
      <p v-else class="mt-0.5 text-[27px] font-bold leading-none tracking-tight text-[#0F172A]">{{ value }}</p>
      <p
        v-if="!loading && delta != null"
        class="mt-1.5 flex items-center gap-1 text-[12.5px] font-semibold"
        :class="up ? 'text-emerald-600' : 'text-red-600'"
      >
        <component :is="up ? TrendingUp : TrendingDown" :size="13" :stroke-width="2.5" />
        {{ Math.abs(delta) }}{{ unit === 'pct' ? '%' : '' }} vs yesterday
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { TrendingUp, TrendingDown } from 'lucide-vue-next'

const props = defineProps({
  icon: { type: [Object, Function], required: true },
  label: { type: String, required: true },
  value: { type: [String, Number], default: '' },
  delta: { type: Number, default: null },
  unit: { type: String, default: 'pct' },       // 'pct' | 'count'
  tint: { type: String, default: 'bg-blue-50 text-blue-600' },
  round: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
})

const up = computed(() => (props.delta ?? 0) >= 0)
</script>
