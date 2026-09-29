<!-- Runs per day by how they ended, with the success rate over them. A person's stop is not in either. -->
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
      type: 'line', label: 'Success rate', yAxisID: 'rate', order: 0,
      data: props.series.map((d) => (d.success_rate == null ? null : Math.round(d.success_rate * 100))),
      borderColor: COLORS.rate, backgroundColor: COLORS.rate, borderWidth: 2, tension: 0.3,
      pointRadius: 3, spanGaps: true,
    },
    { label: 'Succeeded', data: props.series.map((d) => d.success), backgroundColor: COLORS.success, stack: 'runs', yAxisID: 'runs', order: 1, borderRadius: 3 },
    { label: 'Partly done', data: props.series.map((d) => d.partial), backgroundColor: COLORS.partial, stack: 'runs', yAxisID: 'runs', order: 1, borderRadius: 3 },
    { label: 'Failed', data: props.series.map((d) => d.failed), backgroundColor: COLORS.failed, stack: 'runs', yAxisID: 'runs', order: 1, borderRadius: 3 },
  ],
}))

const options = baseOptions({
  scales: {
    x: { stacked: true, grid: { display: false }, ticks: axisTicks },
    runs: {
      type: 'linear', position: 'left', stacked: true, beginAtZero: true,
      ticks: { ...axisTicks, precision: 0 }, grid: { color: COLORS.grid },
      title: { display: true, text: 'Runs', color: COLORS.text, font: { size: 11 } },
    },
    rate: {
      type: 'linear', position: 'right', min: 0, max: 100,
      ticks: { ...axisTicks, callback: (v) => `${v}%` }, grid: { drawOnChartArea: false },
    },
  },
})

const summary = computed(() => {
  const runs = props.series.reduce((n, d) => n + (d.runs || 0), 0)
  const ok = props.series.reduce((n, d) => n + (d.success || 0), 0)
  return `Runs by outcome per day: ${runs} finished, ${ok} succeeded.`
})
</script>

<style scoped>
.chart-box { position: relative; height: 280px; min-width: 0; }
@media (max-width: 600px) { .chart-box { height: 240px; } }
</style>
