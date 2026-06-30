<template>
  <div class="flex flex-col rounded-2xl border border-[#E5E7EB] bg-white p-[18px] shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
    <div class="mb-1 flex items-center justify-between">
      <h2 class="text-base font-semibold text-[#0F172A]">Activity Summary</h2>
      <span class="text-[12px] text-[#64748B]">{{ totalRuns }} runs · last 24h</span>
    </div>

    <div v-if="loading" class="mt-3 h-[160px] w-full animate-pulse rounded-xl bg-slate-100" />

    <div v-else-if="!points.length" class="flex h-[160px] items-center justify-center text-[13px] text-[#64748B]">
      No activity in the last 24 hours.
    </div>

    <div v-else class="mt-3">
      <svg :viewBox="`0 0 ${W} ${H}`" class="h-[160px] w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient :id="gradId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#2563EB" stop-opacity="0.22" />
            <stop offset="100%" stop-color="#2563EB" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path :d="areaPath" :fill="`url(#${gradId})`" />
        <path :d="linePath" fill="none" stroke="#2563EB" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        <circle v-for="(p, i) in coords" :key="i" :cx="p.x" :cy="p.y" r="2.4" fill="#2563EB" />
      </svg>
      <div class="mt-1.5 flex justify-between text-[11px] text-[#94A3B8]">
        <span>{{ firstLabel }}</span>
        <span>{{ lastLabel }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  // [{ bucket: ISO string, count: number }]
  points: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})

const W = 600
const H = 160
const PAD = 8
const gradId = `actg-${Math.random().toString(36).slice(2, 8)}`

const totalRuns = computed(() => props.points.reduce((s, p) => s + (p.count || 0), 0))

const coords = computed(() => {
  const pts = props.points
  if (!pts.length) return []
  const max = Math.max(1, ...pts.map((p) => p.count || 0))
  const n = pts.length
  const innerW = W - PAD * 2
  const innerH = H - PAD * 2
  return pts.map((p, i) => ({
    x: PAD + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW),
    y: PAD + innerH - ((p.count || 0) / max) * innerH,
  }))
})

const linePath = computed(() =>
  coords.value.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '),
)

const areaPath = computed(() => {
  const c = coords.value
  if (!c.length) return ''
  const base = H - PAD
  return `${linePath.value} L ${c[c.length - 1].x.toFixed(1)} ${base} L ${c[0].x.toFixed(1)} ${base} Z`
})

function hourLabel(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric' })
  } catch (e) {
    return ''
  }
}
const firstLabel = computed(() => (props.points.length ? hourLabel(props.points[0].bucket) : ''))
const lastLabel = computed(() => (props.points.length ? hourLabel(props.points[props.points.length - 1].bucket) : ''))
</script>
