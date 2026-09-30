<!-- One agent: its trend with the reasons, the same charts for it alone, the tools that keep failing for it,
     its recent mistakes (with the arguments it passed and what fixed them), and its learned practices. -->
<template>
  <div class="agent-detail">
    <div class="detail-head">
      <button type="button" class="button tertiary" @click="$emit('back')"><Icon icon="lucide:arrow-left" /> All agents</button>
      <div class="detail-title">
        <h2>{{ card?.agent.name || name || 'Agent' }}</h2>
        <span v-if="card" class="trend" :class="trendMeta(card.trend.status).tone">
          <Icon :icon="trendMeta(card.trend.status).icon" />{{ trendMeta(card.trend.status).label }}
        </span>
      </div>
      <p v-if="card" class="reasons">{{ card.trend.reasons.join(' · ') }}</p>
    </div>

    <div v-if="loading && !report" class="state-card" role="status">
      <span class="loader" aria-hidden="true"></span><strong>Loading this agent</strong>
    </div>

    <div v-else-if="report && !card" class="state-card">
      <Icon icon="lucide:moon" /><strong>Nothing from this agent in the window</strong>
      <span>It finished no run, made no mistake and saved no memory. Try a longer window.</span>
    </div>

    <template v-else-if="report">
      <LearningOverview :report="report" agent-scoped />

      <div class="chart-grid">
        <section class="panel" aria-labelledby="ad-tools">
          <div class="panel-header">
            <div class="panel-title-group">
              <span class="section-icon red"><Icon icon="lucide:wrench" /></span>
              <div><h3 id="ad-tools">Tools that failed</h3><p>Its own mistakes with each tool, and the environment's failures.</p></div>
            </div>
          </div>
          <div class="panel-body">
            <ToolsChart v-if="tools.length" :tools="tools" />
            <div v-else class="empty-state compact"><Icon icon="lucide:shield-check" /><strong>No failed tool calls</strong></div>
          </div>
        </section>

        <section class="panel" aria-labelledby="ad-practices">
          <div class="panel-header">
            <div class="panel-title-group">
              <span class="section-icon violet"><Icon icon="lucide:sparkles" /></span>
              <div>
                <h3 id="ad-practices">Learned practices</h3>
                <p>{{ counts.active || 0 }} active · {{ counts.candidate || 0 }} still earning trust · {{ counts.retired || 0 }} retired</p>
              </div>
            </div>
          </div>
          <div v-if="!practices.length" class="empty-state compact"><Icon icon="lucide:sparkles" /><strong>No practices yet</strong><span>They are learned from finished runs.</span></div>
          <ul v-else class="activity-feed">
            <li v-for="p in practicesPage.visible" :key="p.id">
              <div class="feed-content">
                <div class="feed-meta">
                  <span class="status-badge" :class="p.status === 'active' ? 'success' : 'neutral'">{{ p.status === 'candidate' ? 'learning' : p.status }}</span>
                  <strong>{{ Math.round(p.confidence * 100) }}% confidence</strong>
                  <span>{{ p.runs }} run{{ p.runs === 1 ? '' : 's' }}</span>
                </div>
                <div class="change-row"><span>When</span><p>{{ p.trigger }}</p></div>
                <div class="change-row new"><span>Do</span><p>{{ p.action }}</p></div>
              </div>
            </li>
          </ul>
          <LearningPager v-model:page="practicesPage.page" v-model:size="practicesPage.pageSize"
                         :total="practicesPage.total" label="Learned practices" />
        </section>
      </div>

      <section class="panel" aria-labelledby="ad-mistakes">
        <div class="panel-header">
          <div class="panel-title-group">
            <span class="section-icon red"><Icon icon="lucide:circle-x" /></span>
            <div><h3 id="ad-mistakes">Recent mistakes</h3><p>Its own failed calls, newest first — these are what the next similar run is warned about.</p></div>
          </div>
        </div>
        <div v-if="!mistakes.length" class="empty-state compact"><Icon icon="lucide:circle-check" /><strong>No mistakes of its own in this window</strong></div>
        <ul v-else class="activity-feed">
          <li v-for="(m, i) in mistakesPage.visible" :key="`${m.episode}-${i}`">
            <span class="feed-marker" :class="m.recovered ? 'warning' : 'danger'"><Icon :icon="m.recovered ? 'lucide:rotate-ccw' : 'lucide:x'" /></span>
            <div class="feed-content">
              <div class="feed-meta">
                <strong>{{ m.tool }}</strong>
                <span class="status-badge" :class="m.recovered ? 'warning' : 'danger'">{{ m.recovered ? 'fixed on retry' : 'not recovered' }}</span>
                <span class="feed-attribution">run:{{ m.episode }} · {{ shortTime(m.at) }}</span>
              </div>
              <p>{{ m.goal }}</p>
              <div class="change-row bad"><span>Failed</span><p><code v-if="m.args" class="args">{{ m.args }}</code> {{ m.error }}</p></div>
              <div v-if="m.recovered && m.recovery_args" class="change-row new"><span>Worked</span><p><code class="args">{{ m.recovery_args }}</code></p></div>
            </div>
          </li>
        </ul>
        <LearningPager v-model:page="mistakesPage.page" v-model:size="mistakesPage.pageSize"
                       :total="mistakesPage.total" label="Recent mistakes" />
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import LearningOverview from './LearningOverview.vue'
import ToolsChart from './ToolsChart.vue'
import LearningPager from './LearningPager.vue'
import { usePaged } from './usePaged'
import { shortTime, trendMeta } from './learningFormat'

const props = defineProps({
  report: { type: Object, default: null },   // the scorecards report for this agent (with `detail`)
  loading: { type: Boolean, default: false },
  name: { type: String, default: '' },        // shown while the report loads, or when the agent was idle
})
defineEmits(['back'])

const card = computed(() => props.report?.agents?.[0] || null)
const tools = computed(() => props.report?.detail?.tools || [])
const practices = computed(() => props.report?.detail?.practices || [])
const counts = computed(() => props.report?.detail?.practice_counts || {})
const mistakes = computed(() => props.report?.detail?.recent_mistakes || [])
const practicesPage = usePaged(practices, { resetOn: () => props.report })
const mistakesPage = usePaged(mistakes, { resetOn: () => props.report })
</script>

<style scoped>
.agent-detail { display: grid; gap: 14px; }
.detail-head { display: grid; gap: 8px; }
.detail-head .button { width: fit-content; }
.detail-title { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.detail-title h2 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -.02em; }
.detail-head .reasons { margin: 0; }
</style>
