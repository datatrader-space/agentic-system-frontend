<!-- What went into memory: facts saved, corrections (before → after), and the topics injected into context. -->
<template>
  <section class="panel" aria-labelledby="memory-title">
    <div class="panel-header">
      <div class="panel-title-group">
        <span class="section-icon green"><Icon icon="lucide:database-zap" /></span>
        <div>
          <h2 id="memory-title">Memory</h2>
          <p>Every fact saved, every correction, and the topics agents are given. Filtered by the agent and conversation above.</p>
        </div>
      </div>
      <span class="source-label">{{ memory.source }}</span>
    </div>

    <div class="subtabs" role="group" aria-label="Memory views">
      <button v-for="v in views" :key="v.key" type="button" class="subtab" :class="{ active: view === v.key }"
              :aria-pressed="view === v.key" @click="view = v.key">
        {{ v.label }} <span class="count">{{ formatNumber(v.n) }}</span>
      </button>
    </div>

    <template v-if="view === 'saved'">
      <div v-if="!added.length" class="empty-state"><Icon icon="lucide:database" /><strong>No memories written</strong><span>No facts were added in this window.</span></div>
      <ul v-else class="activity-feed">
        <li v-for="fact in savedPage.visible" :key="fact.id">
          <span class="feed-marker success"><Icon icon="lucide:plus" /></span>
          <div class="feed-content">
            <div class="feed-meta">
              <span class="status-badge neutral">{{ fact.topic.scope }}</span>
              <strong>{{ fact.topic.title }}</strong>
              <span class="status-badge" :class="fact.source === 'assistant_tool' ? 'info' : 'success'">{{ fact.source === 'assistant_tool' ? 'Asked to save' : 'Learned' }}</span>
              <span v-if="!fact.current" class="status-badge warning">Superseded</span>
              <span class="feed-attribution">{{ attribution(fact) }} · {{ shortTime(fact.at) }}</span>
            </div>
            <p>{{ fact.statement }}</p>
          </div>
        </li>
      </ul>
      <LearningPager v-model:page="savedPage.page" v-model:size="savedPage.pageSize" :total="savedPage.total"
                     :of="memory.facts_added" label="Saved memories" />
    </template>

    <template v-else-if="view === 'corrections'">
      <div v-if="!corrections.length" class="empty-state"><Icon icon="lucide:file-diff" /><strong>No corrections</strong><span>A correction appears when a newer fact replaces an older one.</span></div>
      <ul v-else class="activity-feed">
        <li v-for="c in correctionsPage.visible" :key="c.id">
          <span class="feed-marker warning"><Icon icon="lucide:refresh-ccw" /></span>
          <div class="feed-content">
            <div class="feed-meta">
              <strong>{{ c.topic.title }}</strong>
              <span class="muted">{{ c.topic.scope }}</span>
              <span class="feed-attribution">{{ attribution(c) }} · {{ shortTime(c.retired_at) }}</span>
            </div>
            <div class="change-row old"><span>Before</span><p>{{ c.was }}</p></div>
            <div class="change-row new"><span>After</span><p>{{ c.now || 'Closed without a replacement' }}</p></div>
          </div>
        </li>
      </ul>
      <LearningPager v-model:page="correctionsPage.page" v-model:size="correctionsPage.pageSize"
                     :total="correctionsPage.total" :of="memory.facts_invalidated" label="Corrections" />
    </template>

    <template v-else>
      <div v-if="!topics.length" class="empty-state"><Icon icon="lucide:library-big" /><strong>No topics</strong></div>
      <div v-else class="table-wrap">
        <table class="data-table card-table">
          <thead><tr><th>Topic</th><th>Scope</th><th>Summary given to the agent</th><th class="numeric">Facts</th><th class="numeric">Updated</th></tr></thead>
          <tbody>
            <tr v-for="t in topicsPage.visible" :key="t.id">
              <td class="card-title"><strong>{{ t.title }}</strong></td>
              <td data-label="Scope"><span class="status-badge neutral">{{ t.scope }}</span></td>
              <td data-label="Summary" class="summary-cell">{{ t.summary || 'No summary yet.' }}</td>
              <td data-label="Facts" class="numeric strong">{{ formatNumber(t.facts) }}</td>
              <td data-label="Updated" class="numeric muted nowrap">{{ shortTime(t.updated_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <LearningPager v-model:page="topicsPage.page" v-model:size="topicsPage.pageSize" :total="topicsPage.total"
                     :of="memory.topics_total" label="Topics" />
    </template>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { formatNumber, shortTime } from './learningFormat'
import LearningPager from './LearningPager.vue'
import { usePaged } from './usePaged'

const props = defineProps({
  snap: { type: Object, required: true },
})

const view = ref('saved')
const memory = computed(() => props.snap.memory || {})
const added = computed(() => memory.value.added || [])
const corrections = computed(() => memory.value.corrections || [])
const topics = computed(() => memory.value.topics || [])
const savedPage = usePaged(added, { resetOn: () => props.snap })
const correctionsPage = usePaged(corrections, { resetOn: () => props.snap })
const topicsPage = usePaged(topics, { resetOn: () => props.snap })
const views = computed(() => [
  { key: 'saved', label: 'Saved', n: memory.value.facts_added ?? added.value.length },
  { key: 'corrections', label: 'Corrected', n: memory.value.facts_invalidated ?? corrections.value.length },
  { key: 'topics', label: 'Topics', n: memory.value.topics_total ?? topics.value.length },
])

function attribution (item) {
  const parts = [item.agent?.name || 'No agent']
  if (item.conversation?.id) parts.push(`Conversation #${item.conversation.id}`)
  return parts.join(' · ')
}
</script>

<style scoped>
.summary-cell { max-width: 560px; color: var(--muted); line-height: 1.45; }
</style>
