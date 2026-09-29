<!-- One agent's most-failing tools: its own mistakes with each, and the environment's failures. -->
<template>
  <div class="chart-box" :style="{ height: `${height}px` }" role="img" :aria-label="summary">
    <Bar :data="chartData" :options="options" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import { COLORS, axisTicks, baseOptions } from './learningCharts'

const props = defineProps({
  tools: { type: Array, default: () => [] },
})

const height = computed(() => Math.max(160, props.tools.length * 36 + 70))

const chartData = computed(() => ({
  labels: props.tools.map((t) => t.tool),
  datasets: [
    { label: "Agent's own mistakes", data: props.tools.map((t) => t.own), backgroundColor: COLORS.own, borderRadius: 3 },
    { label: 'Environment failures', data: props.tools.map((t) => t.environment), backgroundColor: COLORS.environment, borderRadius: 3 },
  ],
}))

const options = baseOptions({
  indexAxis: 'y',
  scales: {
    x: { stacked: true, beginAtZero: true, ticks: { ...axisTicks, precision: 0 }, grid: { color: COLORS.grid } },
    y: { stacked: true, grid: { display: false }, ticks: { ...axisTicks, autoSkip: false } },
  },
})

const summary = computed(() => `Most-failing tools: ${props.tools.map((t) => `${t.tool} ${t.own} own, ${t.environment} environment`).join('; ')}`)
</script>

<style scoped>
.chart-box { position: relative; min-width: 0; }
</style>
