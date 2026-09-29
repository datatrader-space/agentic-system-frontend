// Chart.js for the Learning Monitor — only the pieces these charts use are registered, so the bundle carries
// bar and line charts and nothing else.
import {
  Chart, BarController, LineController, BarElement, LineElement, PointElement,
  CategoryScale, LinearScale, Tooltip, Legend,
} from 'chart.js'

Chart.register(BarController, LineController, BarElement, LineElement, PointElement,
  CategoryScale, LinearScale, Tooltip, Legend)

// Outcome colours carry meaning (good / partial / bad), so they stay the same on every chart.
export const COLORS = {
  success: '#16a34a',
  partial: '#f59e0b',
  failed: '#dc2626',
  rate: '#4f46e5',
  own: '#e11d48',
  environment: '#94a3b8',
  repeated: '#7c3aed',
  grid: '#eef2f7',
  text: '#64748b',
}

export function baseOptions (extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, color: COLORS.text, font: { size: 12 } },
      },
      tooltip: { padding: 10, boxPadding: 4 },
    },
    ...extra,
  }
}

export const axisTicks = { color: COLORS.text, font: { size: 11 } }
