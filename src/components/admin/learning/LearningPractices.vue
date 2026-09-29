<!-- Learned practices (instincts): the review queue a person judges, the ones learned recently, and whether
     the advice helps — measured against the conversations held out from it. -->
<template>
  <section class="panel" aria-labelledby="practices-title">
    <div class="panel-header">
      <div class="panel-title-group">
        <span class="section-icon violet"><Icon icon="lucide:sparkles" /></span>
        <div>
          <h2 id="practices-title">Learned practices</h2>
          <p>{{ formatNumber(instincts.total) }} in total · {{ formatNumber(instincts.multi_run_evidence) }} backed by more than one run.</p>
        </div>
      </div>
      <span class="source-label">agent.Instinct</span>
    </div>

    <div class="subtabs" role="group" aria-label="Practice views">
      <button v-for="v in views" :key="v.key" type="button" class="subtab" :class="{ active: view === v.key }"
              :aria-pressed="view === v.key" :data-view="v.key" @click="view = v.key">
        {{ v.label }} <span class="count">{{ v.n }}</span>
      </button>
    </div>

    <template v-if="view === 'review'">
      <p class="tab-lede">
        Nothing else samples what the learner produces, so a regression would stay invisible until behaviour
        drifted. Your verdict is ordinary evidence: <strong>Good</strong> counts as a correction and
        <strong>Not useful</strong> as a verified contradiction.
      </p>
      <div v-if="!reviewQueue.length" class="empty-state">
        <Icon icon="lucide:clipboard-check" /><strong>Nothing waiting for review</strong><span>Every practice here has been judged at least once.</span>
      </div>
      <ul v-else class="activity-feed">
        <li v-for="instinct in reviewQueue" :key="instinct.id">
          <span class="feed-marker violet"><Icon icon="lucide:sparkles" /></span>
          <div class="feed-content">
            <div class="feed-meta">
              <span class="status-badge info">{{ instinct.domain }}</span>
              <strong>{{ Math.round((instinct.confidence || 0) * 100) }}% confidence</strong>
              <span class="muted">{{ instinct.runs }} run{{ instinct.runs === 1 ? '' : 's' }} · {{ instinct.scope }}</span>
            </div>
            <div class="change-row"><span>When</span><p>{{ instinct.trigger }}</p></div>
            <div class="change-row new"><span>Do</span><p>{{ instinct.action }}</p></div>
            <div class="review-actions">
              <button type="button" class="button secondary" :disabled="reviewing === instinct.id" @click="$emit('review', instinct, 'good')">
                <Icon icon="lucide:thumbs-up" /> Good
              </button>
              <button type="button" class="button secondary danger-action" :disabled="reviewing === instinct.id" @click="$emit('review', instinct, 'bad')">
                <Icon icon="lucide:thumbs-down" /> Not useful
              </button>
            </div>
          </div>
        </li>
      </ul>
    </template>

    <template v-else-if="view === 'recent'">
      <div v-if="!recent.length" class="empty-state"><Icon icon="lucide:sparkles" /><strong>No practices learned yet</strong><span>They appear after finished runs are reviewed.</span></div>
      <ul v-else class="activity-feed">
        <li v-for="instinct in recent" :key="instinct.id">
          <span class="feed-marker violet"><Icon icon="lucide:sparkles" /></span>
          <div class="feed-content">
            <div class="feed-meta">
              <span class="status-badge" :class="instinct.status === 'active' ? 'success' : 'neutral'">{{ instinct.status }}</span>
              <strong>{{ Math.round((instinct.confidence || 0) * 100) }}% confidence</strong>
              <span class="muted">{{ instinct.runs }} run{{ instinct.runs === 1 ? '' : 's' }} · {{ instinct.domain }}</span>
            </div>
            <div class="change-row"><span>When</span><p>{{ instinct.trigger }}</p></div>
            <div class="change-row new"><span>Do</span><p>{{ instinct.action }}</p></div>
          </div>
        </li>
      </ul>
    </template>

    <template v-else>
      <p class="tab-lede">
        A fixed {{ holdout.percent ?? 10 }}% of conversations never receive practices, while still recording what
        they would have received. Comparing the two is the only way to know whether a practice helps; one measured
        to make runs worse is retired by the nightly pass.
      </p>
      <div v-if="harmful.length" class="harm-banner">
        <Icon icon="lucide:trending-down" />
        <div>
          <strong>{{ harmful.length }} instinct{{ harmful.length === 1 ? '' : 's' }} measured harmful</strong>
          <span>Runs that received this advice succeeded less often than runs that did not.</span>
        </div>
      </div>
      <div v-if="!conclusive.length" class="empty-state">
        <Icon icon="lucide:scale" />
        <strong>No conclusive results yet</strong>
        <span>{{ holdout.accumulating || 0 }} instinct{{ (holdout.accumulating || 0) === 1 ? '' : 's' }} still accumulating. A result needs at least {{ MIN_ARM }} runs on each side.</span>
      </div>
      <div v-else class="table-wrap">
        <table class="data-table card-table">
          <thead><tr><th>Practice</th><th class="numeric">With advice</th><th class="numeric">Held out</th><th class="numeric">Difference</th></tr></thead>
          <tbody>
            <tr v-for="row in conclusive" :key="row.instinct_id">
              <td class="card-title"><strong>{{ row.instinct_id }}</strong></td>
              <td data-label="With advice" class="numeric">{{ percent(row.injected_success_rate) }} <span class="muted">/ {{ formatNumber(row.injected_n) }}</span></td>
              <td data-label="Held out" class="numeric">{{ percent(row.held_out_success_rate) }} <span class="muted">/ {{ formatNumber(row.held_out_n) }}</span></td>
              <td data-label="Difference" class="numeric" :class="deltaClass(row.delta)">{{ signedPoints(row.delta) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { formatNumber, percent, signedPoints } from './learningFormat'

const props = defineProps({
  snap: { type: Object, required: true },
  reviewQueue: { type: Array, default: () => [] },
  reviewing: { type: String, default: null },
})
defineEmits(['review'])

// Mirrors HOLDOUT_MIN_SAMPLES on the server.
const MIN_ARM = 20
const view = ref('review')
const instincts = computed(() => props.snap.instincts || {})
const recent = computed(() => instincts.value.recent || [])
const holdout = computed(() => instincts.value.holdout || {})
const conclusive = computed(() => [...(holdout.value.conclusive || [])].sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0)))
const harmful = computed(() => holdout.value.harmful || [])
const views = computed(() => [
  { key: 'review', label: 'Review queue', n: props.reviewQueue.length },
  { key: 'recent', label: 'Recently learned', n: recent.value.length },
  { key: 'holdout', label: 'Does the advice help?', n: conclusive.value.length },
])

function deltaClass (value) {
  if (value == null) return 'muted'
  if (value > 0.02) return 'positive'
  if (value < -0.02) return 'negative'
  return 'muted'
}
</script>
