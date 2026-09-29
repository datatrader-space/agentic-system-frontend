<!-- A day-by-day success-rate line small enough for a table row. A day with no finished run is a gap, not 0%. -->
<template>
  <svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none" role="img" :aria-label="label">
    <line x1="0" y1="29" x2="100" y2="29" class="base" />
    <polyline v-for="(segment, i) in segments" :key="i" :points="segment" class="line" />
    <circle v-if="last" :cx="last.x" :cy="last.y" r="2.2" class="dot" />
  </svg>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  values: { type: Array, default: () => [] },
})

const points = computed(() => {
  const n = props.values.length
  return props.values.map((v, i) => (v == null ? null : {
    x: n > 1 ? (i / (n - 1)) * 100 : 50,
    y: 27 - v * 24,
  }))
})

// Consecutive known days form one segment; a gap starts a new one.
const segments = computed(() => {
  const out = []
  let current = []
  for (const p of points.value) {
    if (p) current.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    else if (current.length) { out.push(current.join(' ')); current = [] }
  }
  if (current.length) out.push(current.join(' '))
  return out
})

const last = computed(() => [...points.value].reverse().find(Boolean) || null)

const label = computed(() => {
  const known = props.values.filter((v) => v != null)
  if (!known.length) return 'No finished runs in this window'
  return `Daily success rate, latest ${Math.round(known[known.length - 1] * 100)}%`
})
</script>

<style scoped>
.spark { width: 96px; height: 28px; display: block; overflow: visible; }
.base { stroke: #e2e8f0; stroke-width: 1; vector-effect: non-scaling-stroke; }
.line { fill: none; stroke: #4f46e5; stroke-width: 1.8; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
.dot { fill: #4f46e5; }
</style>
