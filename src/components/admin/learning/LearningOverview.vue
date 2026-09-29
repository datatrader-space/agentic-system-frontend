<!-- Is the platform (or the one agent picked in the header) learning? Four figures against the previous window,
     runs by outcome and mistakes over time, and the agents that need a look. -->
<template>
  <div class="overview">
    <div class="kpis">
      <div v-for="kpi in kpis" :key="kpi.key" class="kpi" :data-kpi="kpi.key">
        <span class="kpi-label">{{ kpi.label }}</span>
        <strong class="kpi-value">{{ kpi.value }}</strong>
        <span v-if="kpi.change" class="delta" :class="kpi.change.tone">{{ kpi.change.text }} <span class="sr-only">against the previous {{ days }} days</span></span>
        <span class="kpi-note">{{ kpi.note }}</span>
      </div>
    </div>

    <div class="chart-grid">
      <section class="panel" aria-labelledby="ov-outcomes">
        <div class="panel-header">
          <div class="panel-title-group">
            <span class="section-icon green"><Icon icon="lucide:circle-check-big" /></span>
            <div>
              <h3 id="ov-outcomes">Runs by outcome</h3>
              <p>Finished runs per day, with the share that succeeded. Runs a person stopped are left out.</p>
            </div>
          </div>
        </div>
        <div class="panel-body">
          <OutcomeChart v-if="hasRuns" :series="series" />
          <div v-else class="empty-state compact"><Icon icon="lucide:chart-no-axes-column" /><strong>No finished runs</strong><span>Nothing finished in this window.</span></div>
        </div>
      </section>

      <section class="panel" aria-labelledby="ov-mistakes">
        <div class="panel-header">
          <div class="panel-title-group">
            <span class="section-icon red"><Icon icon="lucide:circle-x" /></span>
            <div>
              <h3 id="ov-mistakes">Mistakes and repeats</h3>
              <p>Failed tool calls: the agent's own mistakes, which it can learn from, beside the environment's. The line is warned mistakes made again.</p>
            </div>
          </div>
        </div>
        <div class="panel-body">
          <MistakesChart v-if="hasMistakes" :series="series" />
          <div v-else class="empty-state compact"><Icon icon="lucide:shield-check" /><strong>No failed tool calls</strong><span>No run in this window recorded a failure.</span></div>
        </div>
      </section>
    </div>

    <section v-if="!agentScoped" class="panel" aria-labelledby="ov-attention">
      <div class="panel-header">
        <div class="panel-title-group">
          <span class="section-icon blue"><Icon icon="lucide:bot" /></span>
          <div>
            <h3 id="ov-attention">Agents</h3>
            <p>Each agent's last {{ days }} days against the {{ days }} before. Open one to see its failing tools and mistakes.</p>
          </div>
        </div>
        <div class="trend-counts">
          <span v-for="t in trendCounts" :key="t.status" class="trend" :class="t.tone"><Icon :icon="t.icon" />{{ t.n }} {{ t.label.toLowerCase() }}</span>
        </div>
      </div>
      <div v-if="!attention.length" class="empty-state compact">
        <Icon icon="lucide:circle-check" />
        <strong>No agent needs attention</strong>
        <span>{{ agents.length ? 'None got worse beyond the thresholds.' : 'No agent was active in this window.' }}</span>
      </div>
      <ul v-else class="attention-list">
        <li v-for="card in attention" :key="card.agent.id">
          <div class="agent-cell">
            <span class="agent-avatar"><Icon icon="lucide:bot" /></span>
            <div>
              <strong>{{ card.agent.name }}</strong>
              <p class="reasons">{{ card.trend.reasons.join(' · ') }}</p>
            </div>
          </div>
          <button type="button" class="button secondary" @click="$emit('open-agent', card.agent.id)">
            Open <Icon icon="lucide:chevron-right" />
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import OutcomeChart from './OutcomeChart.vue'
import MistakesChart from './MistakesChart.vue'
import { TREND, change, formatNumber, percent, signedDecimal } from './learningFormat'

const props = defineProps({
  report: { type: Object, required: true },     // the scorecards report — platform-wide, or one agent's
  agents: { type: Array, default: () => [] },   // every agent's scorecard (for the attention list)
  agentScoped: { type: Boolean, default: false },
})
defineEmits(['open-agent'])

const days = computed(() => props.report.window_days)
const series = computed(() => props.report.series || [])
const now = computed(() => props.report.totals || {})
const before = computed(() => props.report.previous || {})
const hasRuns = computed(() => series.value.some((d) => d.runs))
const hasMistakes = computed(() => series.value.some((d) => d.own_mistakes || d.environment_failures || d.repeated))

const kpis = computed(() => [
  {
    key: 'success', label: 'Success rate', value: percent(now.value.success_rate),
    change: change(now.value.success_rate, before.value.success_rate),
    note: `${formatNumber(now.value.success)} of ${formatNumber(now.value.runs)} finished runs succeeded`,
  },
  {
    key: 'mistakes', label: 'Own mistakes per run',
    value: now.value.mistakes_per_run == null ? '—' : now.value.mistakes_per_run.toFixed(2),
    change: change(now.value.mistakes_per_run, before.value.mistakes_per_run, { goodWhenUp: false, format: signedDecimal }),
    note: `${formatNumber(now.value.own_mistakes)} own mistakes · ${formatNumber(now.value.environment_failures)} environment failures`,
  },
  {
    key: 'repeats', label: 'Warned mistakes repeated', value: percent(now.value.repeat_rate),
    change: change(now.value.repeat_rate, before.value.repeat_rate, { goodWhenUp: false }),
    note: `${formatNumber(now.value.repeated)} of ${formatNumber(now.value.warnings_scored)} scored warnings · ${formatNumber(now.value.warnings)} shown`,
  },
  {
    key: 'memory', label: 'Memory saved', value: formatNumber(now.value.memories_saved),
    change: null,
    note: `${formatNumber(now.value.memories_corrected)} corrected: closed because a newer fact replaced them`,
  },
])

const trendCounts = computed(() => Object.entries(TREND)
  .map(([status, meta]) => ({ status, ...meta, n: props.agents.filter((a) => a.trend.status === status).length }))
  .filter((t) => t.n))

const attention = computed(() => props.agents.filter((a) => a.trend.status === 'needs_attention').slice(0, 6))
</script>

<style scoped>
.overview { display: grid; gap: 14px; }
.trend-counts { display: flex; flex-wrap: wrap; gap: 6px; }
.attention-list { margin: 0; padding: 4px 16px; list-style: none; }
.attention-list li { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--soft-line); }
.attention-list li:last-child { border-bottom: 0; }
.attention-list .agent-cell { min-width: 0; }
@media (max-width: 560px) {
  .attention-list li { flex-direction: column; align-items: stretch; }
}
</style>
