<!-- Every active agent's scorecard: its trend and the numbers behind it. A row opens that agent's detail. -->
<template>
  <section class="panel" aria-labelledby="agents-title">
    <div class="panel-header">
      <div class="panel-title-group">
        <span class="section-icon blue"><Icon icon="lucide:bot" /></span>
        <div>
          <h2 id="agents-title">Agents</h2>
          <p>
            <strong>{{ agents.length }} of {{ total }} agents</strong> were active in the last {{ days }} days: they
            finished a run, made a mistake or were warned. Agents that did nothing in this window are not listed;
            choose 30d or 90d to look further back. Each trend compares the last {{ days }} days with the
            {{ days }} before, needs {{ minRuns }} finished runs, and shows the numbers that decided it.
          </p>
        </div>
      </div>
    </div>

    <div v-if="!agents.length" class="empty-state">
      <Icon icon="lucide:bot-off" /><strong>No active agents</strong><span>No agent finished a run, made a mistake or saved a memory in this window.</span>
    </div>

    <div v-else-if="!shown.length" class="empty-state compact">
      <Icon icon="lucide:hourglass" /><strong>No agent has enough finished runs for a trend yet</strong>
      <span>A trend needs {{ minRuns }} finished runs in the window.</span>
    </div>

    <div v-else class="table-wrap">
      <table class="data-table card-table">
        <thead>
          <tr>
            <th>Agent</th>
            <th>Trend</th>
            <th class="numeric">Runs</th>
            <th class="numeric">Success</th>
            <th class="numeric">Own mistakes</th>
            <th class="numeric">Repeated</th>
            <th class="numeric">Practices</th>
            <th class="numeric">Memory</th>
            <th>Daily success</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="card in agentsPage.visible"
            :key="card.agent.id"
            class="selectable-row"
            tabindex="0"
            :aria-label="`Open ${card.agent.name}`"
            @click="$emit('select', card.agent.id)"
            @keydown.enter.prevent="$emit('select', card.agent.id)"
          >
            <td class="card-title">
              <div class="agent-cell">
                <span class="agent-avatar"><Icon icon="lucide:bot" /></span>
                <div>
                  <strong>{{ card.agent.name }}</strong>
                  <span class="sub">{{ card.agent.builtin ? 'Shared built-in agent' : card.agent.owner }}</span>
                </div>
              </div>
            </td>
            <td data-label="Trend">
              <div class="trend-cell">
                <span class="trend" :class="trendMeta(card.trend.status).tone">
                  <Icon :icon="trendMeta(card.trend.status).icon" />{{ trendMeta(card.trend.status).label }}
                </span>
                <span class="reasons">{{ card.trend.reasons.join(' · ') }}</span>
              </div>
            </td>
            <td data-label="Runs" class="numeric strong">{{ formatNumber(card.current.runs) }}</td>
            <td data-label="Success" class="numeric">
              {{ percent(card.current.success_rate) }}
              <span class="sub" :class="deltaClass(change(card.current.success_rate, card.previous.success_rate).tone)">
                {{ change(card.current.success_rate, card.previous.success_rate).text }}
              </span>
            </td>
            <td data-label="Own mistakes" class="numeric">
              {{ formatNumber(card.current.own_mistakes) }}
              <span class="sub">{{ card.current.environment_failures ? `+${formatNumber(card.current.environment_failures)} environment` : 'none from the environment' }}</span>
            </td>
            <td data-label="Repeated" class="numeric">
              {{ card.current.warnings_scored ? `${card.current.repeated} of ${card.current.warnings_scored}` : '—' }}
              <span class="sub">{{ card.current.warnings ? `${card.current.warnings} warned` : 'no warnings' }}</span>
            </td>
            <td data-label="Practices" class="numeric">
              {{ formatNumber(card.practices.active) }} active
              <span class="sub">{{ formatNumber(card.practices.candidate) }} learning · {{ formatNumber(card.practices.retired) }} retired</span>
            </td>
            <td data-label="Memory" class="numeric">
              +{{ formatNumber(card.current.memories_saved) }}
              <span class="sub">{{ formatNumber(card.current.memories_corrected) }} corrected</span>
            </td>
            <td data-label="Daily success"><SuccessSparkline :values="card.spark" /></td>
          </tr>
        </tbody>
      </table>
    </div>
    <LearningPager v-if="shown.length" v-model:page="agentsPage.page" v-model:size="agentsPage.pageSize"
                   :total="agentsPage.total" label="Agents" />
    <div v-if="quiet.length" class="more-row">
      <button type="button" class="button tertiary" :aria-expanded="String(showQuiet)" @click="showQuiet = !showQuiet">
        <Icon :icon="showQuiet ? 'lucide:chevron-up' : 'lucide:chevron-down'" />
        {{ showQuiet ? 'Hide' : 'Show' }} {{ quiet.length }} agent{{ quiet.length === 1 ? '' : 's' }} with too little data
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import SuccessSparkline from './SuccessSparkline.vue'
import LearningPager from './LearningPager.vue'
import { usePaged } from './usePaged'
import { change, formatNumber, percent, trendMeta } from './learningFormat'

const props = defineProps({
  report: { type: Object, required: true },
})
defineEmits(['select'])

const agents = computed(() => props.report.agents || [])
// Agents with a verdict first; the ones with too few runs to read wait behind a toggle.
const showQuiet = ref(false)
const quiet = computed(() => agents.value.filter((a) => a.trend.status === 'too_little_data'))
const shown = computed(() => (showQuiet.value ? agents.value : agents.value.filter((a) => a.trend.status !== 'too_little_data')))
const agentsPage = usePaged(shown, { resetOn: () => props.report })
const days = computed(() => props.report.window_days)
const total = computed(() => props.report.agents_total ?? agents.value.length)
const minRuns = computed(() => props.report.thresholds?.min_runs ?? 5)

function deltaClass (tone) {
  return tone === 'good' ? 'positive' : tone === 'bad' ? 'negative' : ''
}
</script>

<style scoped>
.trend-cell { display: grid; gap: 2px; max-width: 280px; }
.more-row { padding: 10px 16px; border-top: 1px solid var(--soft-line); }
@media (max-width: 760px) {
  .trend-cell { justify-items: end; max-width: none; text-align: right; }
  :deep(.spark) { margin-left: auto; }
}
</style>
