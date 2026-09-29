<!-- Failed tool calls per day: the agent's own mistakes beside the environment's (a server down, a provider
     failing), and how many warned mistakes were made again. Only the first kind is something to learn from. -->
<template>
  <div class="chart-box" role="img" :aria-label="summary">
    <Bar :data="chartData" :options="options" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import { COLORS, axisTicks, baseOptions } from './learningCharts'
import { dayLabel } from './learningFormat'

const props = defineProps({
  series: { type: Array, default: () => [] },
})

const chartData = computed(() => ({
  labels: props.series.map((d) => dayLabel(d.day)),
  datasets: [
    {
      type: 'line', label: 'Warned mistake repeated', order: 0,
      data: props.series.map((d) => d.repeated),
      borderColor: COLORS.repeated, backgroundColor: COLORS.repeated, borderWidth: 2, tension: 0.3, pointRadius: 3,
    },
    { label: "Agent's own mistakes", data: props.series.map((d) => d.own_mistakes), backgroundColor: COLORS.own, order: 1, borderRadius: 3 },
    { label: 'Environment failures', data: props.series.map((d) => d.environment_failures), backgroundColor: COLORS.environment, order: 1, borderRadius: 3 },
  ],
}))

const options = baseOptions({
  scales: {
    x: { grid: { display: false }, ticks: axisTicks },
    y: { beginAtZero: true, ticks: { ...axisTicks, precision: 0 }, grid: { color: COLORS.grid } },
  },
})

const summary = computed(() => {
  const own = props.series.reduce((n, d) => n + (d.own_mistakes || 0), 0)
  const env = props.series.reduce((n, d) => n + (d.environment_failures || 0), 0)
  return `Failures per day: ${own} of the agent's own, ${env} from the environment.`
})
</script>

<style scoped>
.chart-box { position: relative; height: 280px; min-width: 0; }
@media (max-width: 600px) { .chart-box { height: 240px; } }
</style>
