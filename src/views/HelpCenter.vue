<template>
  <main class="help-page">
    <section class="help-main">
      <header class="help-hero">
        <div>
          <h1>How can we help you today?</h1>
          <p>Find answers, learn best practices, and get the most out of Aadml.</p>
        </div>
        <button class="whats-new" @click="goTo('/docs')">
          <Icon icon="lucide:sparkles" />
          What's new
        </button>
      </header>

      <div class="help-search-wrap">
        <div class="help-search">
          <Icon icon="lucide:search" />
          <input
            v-model="search"
            type="search"
            placeholder="Search for help articles, guides, and tutorials..."
            @focus="searchFocused = true"
            @input="onSearchInput"
            @blur="searchFocused = false"
            @keyup.enter="onEnter"
            @keydown.esc="searchFocused = false" />
          <kbd>Ctrl K</kbd>
        </div>

        <div v-if="showResults" class="search-dropdown" @mousedown.prevent>
          <template v-if="searchResults.length">
            <button v-for="r in searchResults" :key="r.id" class="search-result" @click="goResult(r)">
              <span :class="['res-icon', r.tone]"><Icon :icon="r.icon" /></span>
              <span class="res-text">
                <strong>{{ r.title }}</strong>
                <small v-if="r.copy">{{ r.copy }}</small>
              </span>
              <span v-if="r.kindLabel" class="res-kind">{{ r.kindLabel }}</span>
            </button>
            <button class="search-all" @click="runSearch">
              <Icon icon="lucide:search" /> Search all help for “{{ search.trim() }}”
            </button>
          </template>
          <div v-else class="search-empty">
            <Icon icon="lucide:file-search" />
            <p>No matches for “{{ search.trim() }}”.</p>
            <button v-if="didYouMean" class="did-you-mean" @click="applyDidYouMean">
              Did you mean <strong>{{ didYouMean }}</strong>?
            </button>
            <button class="search-all assistant" @click="openAssistant(search.trim())">
              <Icon icon="lucide:sparkles" /> Ask the Help Assistant
            </button>
          </div>
        </div>
      </div>

      <div class="popular-row">
        <span>Popular searches:</span>
        <button v-for="item in popularSearches" :key="item" @click="searchFor(item)">{{ item }}</button>
      </div>

      <section class="start-panel">
        <header>
          <h2>Start here</h2>
          <p>Get up and running in minutes.</p>
        </header>
        <div class="start-grid">
          <article class="guide-card">
            <h3>Quick start guide</h3>
            <p>A step-by-step walkthrough to build your first agent and run it.</p>
            <RouterLink to="/dashboard/help-center/get-started">
              Start guide
              <Icon icon="lucide:arrow-right" />
            </RouterLink>
          </article>

          <article class="checklist-card">
            <div class="checklist-head">
              <h3>Getting started checklist</h3>
              <span>{{ hubCompleted }} of {{ checklist.length }} completed</span>
            </div>
            <ul>
              <li v-for="item in checklist" :key="item.label" :class="{ done: item.done }">
                <span><Icon :icon="item.done ? 'lucide:check' : 'lucide:circle'" /></span>
                {{ item.label }}
              </li>
            </ul>
            <div class="progress-track"><span :style="{ width: hubPercent + '%' }" /></div>
          </article>
        </div>
      </section>

      <section class="help-section library-section">
        <h2>Learning paths</h2>
        <div class="library-grid">
          <RouterLink v-for="item in helpLibrary" :key="item.title" :to="item.to" class="library-card">
            <span :class="['topic-icon', item.tone]"><Icon :icon="item.icon" /></span>
            <div>
              <h3>{{ item.title }}</h3>
              <p>{{ item.copy }}</p>
            </div>
            <Icon icon="lucide:arrow-right" />
          </RouterLink>
        </div>
      </section>

      <section class="help-section">
        <div class="section-title-row">
          <h2>Browse help topics</h2>
          <RouterLink to="/dashboard/help-center/topics">View all topics</RouterLink>
        </div>
        <div class="topic-grid">
          <article v-for="topic in visibleTopics" :key="topic.title" class="topic-card" :class="{ clickable: topic.to }" @click="topic.to && goTo(topic.to)">
            <span :class="['topic-icon', topic.tone]"><Icon :icon="topic.icon" /></span>
            <div>
              <h3>{{ topic.title }}</h3>
              <p>{{ topic.copy }}</p>
            </div>
          </article>
        </div>
      </section>

      <section class="help-section">
        <div class="section-title-row">
          <h2>Featured tutorials</h2>
          <RouterLink to="/dashboard/help-center/tutorials">View all tutorials</RouterLink>
        </div>
        <div class="tutorial-grid">
          <article v-for="tutorial in tutorials" :key="tutorial.title" class="tutorial-card" @click="openTutorial(tutorial)">
            <div :class="['tutorial-art', tutorial.tone]">
              <span class="play"><Icon icon="lucide:play" /></span>
              <span class="duration">{{ tutorial.duration }}</span>
              <div class="art-line a" />
              <div class="art-line b" />
              <div class="art-node one" />
              <div class="art-node two" />
              <div class="art-node three" />
            </div>
            <div class="tutorial-body">
              <h3>{{ tutorial.title }}</h3>
              <p>{{ tutorial.copy }}</p>
              <span :class="['level', tutorial.level.toLowerCase()]">{{ tutorial.level }}</span>
            </div>
          </article>
        </div>
      </section>

      <section class="howto-panel">
        <div class="section-title-row">
          <h2>How-to guides</h2>
          <RouterLink to="/dashboard/help-center/docs">View all guides</RouterLink>
        </div>
        <div class="guide-list">
          <button v-for="guide in guides" :key="guide" @click="searchFor(guide)">
            {{ guide }}
            <Icon icon="lucide:chevron-right" />
          </button>
        </div>
      </section>
    </section>

    <aside class="help-rail">
      <section class="rail-card recommended">
        <h2>Recommended next steps</h2>
        <p>Based on your current setup</p>
        <article v-for="step in recommendedSteps" :key="step.key" class="next-step">
          <span><Icon :icon="step.icon" /></span>
          <div>
            <h3>{{ step.title }}</h3>
            <p>{{ step.copy }}</p>
            <button @click="goTo(step.route)">{{ step.action }}</button>
          </div>
        </article>
        <div v-if="!recommendedSteps.length" class="all-set">
          <Icon icon="lucide:check-circle-2" />
          <p>You're all set — every setup step is complete.</p>
        </div>
        <RouterLink to="/dashboard/help-center/get-started" class="link-action">
          View full checklist
          <Icon icon="lucide:arrow-right" />
        </RouterLink>
      </section>

      <section class="rail-card support">
        <h2>Need more help?</h2>
        <p>Our team is here to support you.</p>
        <RouterLink v-for="item in support" :key="item.title" :to="item.to" class="support-row">
          <span :class="item.tone"><Icon :icon="item.icon" /></span>
          <div>
            <strong>{{ item.title }}</strong>
            <small>{{ item.copy }}</small>
          </div>
          <Icon icon="lucide:chevron-right" />
        </RouterLink>
      </section>

      <section class="rail-card assistant-card">
        <h2>Still stuck?</h2>
        <p>Ask our AI assistant — it answers from the Help Center with sources.</p>
        <button @click="openAssistant()">
          <Icon icon="lucide:sparkles" />
          Ask Assistant
        </button>
      </section>
    </aside>

  </main>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import api from '../services/api'
import { useHelpAssistant } from '../composables/useHelpAssistant'
import { resolveSearchDestination } from '../utils/helpSearchNav'

const router = useRouter()
const search = ref('')
const searchFocused = ref(false)

// AI Help Assistant — delegate to the product-wide assistant (FAB + widget live in AppShell).
const { openAssistant: openGlobalAssistant } = useHelpAssistant()
function openAssistant(q = '') { searchFocused.value = false; openGlobalAssistant(q) }

// Curated default (cold start) — overridden at runtime by the real, evolving top search
// terms from GET /help/popular-searches when there's enough signal.
const popularSearches = ref(['Create an agent', 'Add a connector', 'Build a workflow', 'Scheduled runs'])

// ── Smart search (backend /help/suggest + /help/search) ─────────────────────
const searchResults = ref([])   // section-level targets from the backend
const didYouMean = ref(null)
const searching = ref(false)

const KIND_ICON = {
  doc: 'lucide:file-text', guide: 'lucide:book-open', tutorial: 'lucide:play-circle',
  integration: 'lucide:link-2', faq: 'lucide:help-circle', learning_path: 'lucide:rocket',
  guided_tour: 'lucide:route', section: 'lucide:hash', action: 'lucide:zap', nav: 'lucide:arrow-right',
}
const KIND_TONE = {
  doc: 'blue', guide: 'blue', tutorial: 'teal', integration: 'violet', faq: 'coral',
  learning_path: 'blue', guided_tour: 'coral', section: 'blue', action: 'violet',
}
const KIND_LABEL = {
  doc: 'Doc', guide: 'Guide', tutorial: 'Tutorial', integration: 'Integration',
  faq: 'FAQ', learning_path: 'Path', guided_tour: 'Tour', section: 'Section', action: 'Action',
}

let _searchT = null
function onSearchInput() {
  searchFocused.value = true
  clearTimeout(_searchT)
  const q = search.value.trim()
  if (q.length < 2) { searchResults.value = []; didYouMean.value = null; return }
  _searchT = setTimeout(() => runSuggest(q), 220)
}

async function runSuggest(q) {
  searching.value = true
  try {
    const { data } = await api.helpSuggest(q)
    searchResults.value = (data?.suggestions || []).map((s, i) => ({
      id: `${s.kind}-${i}`,
      title: s.label,
      copy: '',
      to: s.url,
      kind: s.kind,
      kindLabel: KIND_LABEL[s.kind] || KIND_LABEL[s.type] || '',
      icon: KIND_ICON[s.kind] || KIND_ICON[s.type] || 'lucide:file-text',
      tone: KIND_TONE[s.kind] || KIND_TONE[s.type] || 'blue',
    }))
    didYouMean.value = data?.did_you_mean || null
  } catch (e) { searchResults.value = [] }
  searching.value = false
}

const showResults = computed(() => searchFocused.value && search.value.trim().length >= 2)

// Clicking a SPECIFIC suggestion = navigate to exactly that item (explicit user choice:
// an article opens that article; an ACTION opens that app action). This is intentionally
// separate from submit (Enter), which never defaults to a suggestion.
function goResult(r) {
  searchFocused.value = false
  api.logHelpSearch({ query: search.value.trim(), had_results: true }).catch(() => {})
  if (r.to) router.push(r.to)
}
function applyDidYouMean() {
  if (!didYouMean.value) return
  search.value = didYouMean.value
  runSuggest(didYouMean.value)
}

// SUBMIT (Enter / "Search all help" / popular search) runs the SMART search endpoint
// (/help/search) and navigates to the top section's exact article + anchor — it does
// NOT use the suggest dropdown's first item (which may be an app ACTION). This is what
// makes "how to add new agent" land on .../create-your-first-agent#create-the-agent.
async function executeSearch(rawQ) {
  const q = (rawQ ?? search.value).trim()
  if (!q) return
  searchFocused.value = false
  let results = []
  try {
    const { data } = await api.helpSearch(q)
    results = data?.results || []
  } catch (e) { /* network error → fall back to the docs list below */ }
  api.logHelpSearch({ query: q, had_results: !!results.length, result_count: results.length }).catch(() => {})
  router.push(resolveSearchDestination(results, q))
}
function onEnter() { executeSearch() }

// Live onboarding checklist (derived) — see GET /onboarding/status/.
const done = ref({})
const HUB_STEPS = [
  { key: 'workspace', label: 'Create your workspace' },
  { key: 'provider', label: 'Connect a model provider' },
  { key: 'agent', label: 'Create your first agent' },
  { key: 'workflow', label: 'Build your first workflow' },
  { key: 'first_run', label: 'Run and review your first result' },
]
const checklist = computed(() => HUB_STEPS.map(s => ({ label: s.label, done: !!done.value[s.key] })))
const hubCompleted = computed(() => checklist.value.filter(c => c.done).length)
const hubPercent = computed(() => Math.round((hubCompleted.value / checklist.value.length) * 100))

function goTo(route) { if (route) router.push(route) }
// "Search all help for …" — same smart-search submit path.
function runSearch() { executeSearch() }
// Popular searches / how-to chips — run the smart search and land on the best section.
function searchFor(term) { search.value = term; executeSearch(term) }

onMounted(async () => {
  try {
    const { data } = await api.getOnboardingStatus()
    done.value = data?.done || {}
  } catch (e) { /* checklist degrades to all not-done */ }
  // Real, evolving popular searches — only override the curated default with enough signal.
  try {
    const { data } = await api.getPopularSearches()
    const terms = (data?.popular_searches || []).filter(Boolean)
    if (terms.length >= 3) popularSearches.value = terms.slice(0, 6)
  } catch (e) { /* keep curated default */ }
  try {
    const { data } = await api.getTutorials()
    const rows = data?.tutorials || []
    if (rows.length) {
      tutorials.value = rows.slice(0, 4).map((t, i) => ({
        title: t.title,
        copy: t.summary || '',
        duration: `${t.estimated_minutes} min`,
        level: (t.difficulty || 'beginner').replace(/^\w/, c => c.toUpperCase()),
        tone: TUT_TONES[i % TUT_TONES.length],
        slug: t.slug,
      }))
    }
  } catch (e) { /* keep static featured tutorials */ }
  // Dynamic topic cards from the Help Knowledge graph (fallback: static `topics`).
  try {
    const { data } = await api.getHelpTopics()
    const t = data?.topics || []
    if (t.length) {
      topics.value = t.map((x, i) => ({
        title: x.title,
        copy: `${x.count} article${x.count === 1 ? '' : 's'}`,
        icon: x.icon || TOPIC_ICONS[i % TOPIC_ICONS.length],
        tone: x.tone || TOPIC_TONES[i % TOPIC_TONES.length],
        // Open the dedicated Topics page pre-filtered to this product_area. Derived from
        // the title (not x.url) so an older self-link can't bounce us back here.
        to: `/dashboard/help-center/topics?area=${encodeURIComponent(x.title)}`,
        subtopics: x.subtopics || [],
      }))
    }
  } catch (e) { /* keep static topics */ }
})

const TOPIC_ICONS = ['lucide:bot', 'lucide:workflow', 'lucide:link-2', 'lucide:book-open', 'lucide:credit-card', 'lucide:shield', 'lucide:wrench']
const TOPIC_TONES = ['blue', 'violet', 'teal', 'coral']
const topicLink = (title) => `/dashboard/help-center/topics?area=${encodeURIComponent(title)}`
const topics = ref([
  { title: 'Agents', copy: 'Create and manage agents', icon: 'lucide:bot', tone: 'blue', to: topicLink('Agents') },
  { title: 'Workflows', copy: 'Build automation flows', icon: 'lucide:workflow', tone: 'violet', to: topicLink('Workflows') },
  { title: 'Connectors', copy: 'Integrate your tools', icon: 'lucide:link-2', tone: 'blue', to: topicLink('Integrations') },
  { title: 'Tools', copy: 'Use and configure tools', icon: 'lucide:wrench', tone: 'violet', to: topicLink('Tools') },
  { title: 'Scheduling', copy: 'Automate and schedule runs', icon: 'lucide:calendar-days', tone: 'teal', to: topicLink('Scheduling') },
  { title: 'Billing', copy: 'Manage plans and usage', icon: 'lucide:credit-card', tone: 'teal', to: topicLink('Billing') },
  { title: 'Security', copy: 'Permissions and data privacy', icon: 'lucide:shield', tone: 'blue', to: topicLink('Security') },
])

// Show only the first 6 topic cards on the hub; the rest live on the dedicated
// "View all topics" page (/dashboard/help-center/topics).
const visibleTopics = computed(() => topics.value.slice(0, 6))

const helpLibrary = [
  { title: 'Getting Started', copy: 'Onboarding checklist and first-agent setup.', icon: 'lucide:rocket', tone: 'blue', to: '/dashboard/help-center/get-started' },
  { title: 'Learning Paths', copy: 'Guided, ordered tracks from zero to confident.', icon: 'lucide:graduation-cap', tone: 'blue', to: '/dashboard/help-center/learning-paths' },
  { title: 'Documentation', copy: 'Browse concepts, references, and guides.', icon: 'lucide:file-text', tone: 'violet', to: '/dashboard/help-center/documentation' },
  { title: 'Tutorials', copy: 'Step-by-step learning paths and videos.', icon: 'lucide:play-circle', tone: 'teal', to: '/dashboard/help-center/tutorials' },
  { title: 'Guided Tours', copy: 'Interactive walkthroughs for key workflows.', icon: 'lucide:route', tone: 'coral', to: '/dashboard/help-center/guided-tours' },
]

const TUT_TONES = ['blue', 'mint', 'violet', 'purple']
const staticTutorials = [
  { title: 'Build your first agent', copy: 'Learn how to create, configure, and test your first agent.', duration: '8:45', level: 'Beginner', tone: 'blue' },
  { title: 'Connect your tools', copy: 'Connect external services and data sources.', duration: '6:12', level: 'Beginner', tone: 'mint' },
  { title: 'Build a workflow', copy: 'Create multi-step automations with triggers and conditions.', duration: '7:30', level: 'Intermediate', tone: 'violet' },
  { title: 'Schedule and automate', copy: 'Run your agents on a schedule and monitor results.', duration: '5:15', level: 'Intermediate', tone: 'purple' },
]
const tutorials = ref(staticTutorials)
function openTutorial(t) {
  if (t.slug) router.push(`/dashboard/help-center/tutorials/${t.slug}`)
  else router.push('/dashboard/help-center/tutorials')
}

const guides = [
  'Create and publish an agent',
  'Connect credentials securely',
  'Set approval rules for tools',
  'Monitor failed runs',
]

// `key` maps each step to its onboarding-status flag (GET /onboarding/status/ → done{}),
// so completed steps are hidden. Keys match HUB_STEPS.
const recommended = [
  { key: 'provider', title: 'Connect a model provider', copy: 'Add OpenAI, Anthropic, or another provider to power your agents.', action: 'Add provider', icon: 'lucide:shield-check', route: '/dashboard/llm-settings' },
  { key: 'agent', title: 'Create your first agent', copy: 'Build an agent and give it instructions to get started.', action: 'Create agent', icon: 'lucide:rocket', route: '/dashboard/agents/new' },
  { key: 'workflow', title: 'Build your first workflow', copy: 'Automate a process using steps, tools, and conditions.', action: 'Create workflow', icon: 'lucide:scan-line', route: '/dashboard/workflow-builder' },
  { key: 'first_run', title: 'Run your first agent', copy: 'Test your agent and view results in the Activity log.', action: 'Run now', icon: 'lucide:circle-play', route: '/dashboard/chat/new' },
]
// Show ONLY steps not yet completed (reacts to the live onboarding status).
const recommendedSteps = computed(() => recommended.filter(s => !done.value[s.key]))

const support = [
  { title: 'Open docs', copy: 'Visit documentation hub', icon: 'lucide:book-open', tone: 'blue', to: '/dashboard/help-center/documentation' },
  { title: 'Contact support', copy: 'Chat with our team', icon: 'lucide:message-circle', tone: 'violet', to: '/dashboard/help-center/support' },
  { title: 'Submit a ticket', copy: 'We typically reply in 24h', icon: 'lucide:clipboard-list', tone: 'teal', to: '/dashboard/help-center/support?new=1' },
  { title: 'Book onboarding', copy: 'Schedule a 1:1 session', icon: 'lucide:calendar-check', tone: 'coral', to: '/dashboard/help-center/guided-tours' },
]
</script>

<style scoped>
.help-page {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 970px) 300px;
  justify-content: center;
  gap: 28px;
  min-height: 100%;
  padding: 34px 34px 56px;
  background: #f8fbff;
  color: #0f172a;
}

.help-main {
  width: 100%;
  min-width: 0;
}

.help-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 18px;
}

.help-hero h1 {
  margin: 0;
  font-size: 22px;
  line-height: 1.2;
  font-weight: 800;
  letter-spacing: 0;
}

.help-hero p,
.start-panel header p,
.rail-card > p {
  margin: 7px 0 0;
  color: #64748b;
  font-size: 13px;
}

.whats-new {
  display: inline-flex;
  height: 34px;
  align-items: center;
  gap: 8px;
  border: 1px solid #dbe4f0;
  border-radius: 9px;
  background: #fff;
  padding: 0 14px;
  color: #334155;
  font-size: 12px;
  font-weight: 800;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
}

.whats-new svg {
  width: 15px;
  height: 15px;
  color: #4f46e5;
}

.help-search {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 50px;
  border: 1px solid #b9c9ff;
  border-radius: 9px;
  background: #fff;
  padding: 0 14px 0 18px;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, .04);
}

.help-search svg {
  width: 18px;
  height: 18px;
  color: #94a3b8;
}

.help-search input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  color: #0f172a;
  font-size: 14px;
  font-weight: 600;
}

.help-search input::placeholder {
  color: #94a3b8;
}

.help-search kbd {
  border: 1px solid #dbe4f0;
  border-radius: 6px;
  background: #f8fafc;
  padding: 3px 8px;
  color: #64748b;
  font-size: 11px;
  font-weight: 800;
}

/* Live search dropdown */
.help-search-wrap {
  position: relative;
  z-index: 30;
}

.search-dropdown {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 8px);
  z-index: 40;
  overflow: hidden;
  border: 1px solid #dfe7f2;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 18px 44px rgba(15, 23, 42, .14);
}

.search-result {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 12px;
  border: 0;
  border-bottom: 1px solid #f1f5f9;
  background: #fff;
  padding: 11px 14px;
  text-align: left;
  cursor: pointer;
}

.search-result:hover {
  background: #f6f9ff;
}

.res-icon {
  display: grid;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 8px;
}

.res-icon svg {
  width: 17px;
  height: 17px;
}

.res-text {
  min-width: 0;
  flex: 1;
}

.res-text strong {
  display: block;
  color: #0f172a;
  font-size: 13px;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.res-text small {
  display: block;
  margin-top: 2px;
  color: #64748b;
  font-size: 11.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.res-kind {
  flex-shrink: 0;
  border-radius: 6px;
  background: #f1f5f9;
  padding: 3px 8px;
  color: #64748b;
  font-size: 10px;
  font-weight: 850;
  text-transform: uppercase;
  letter-spacing: .03em;
}

.search-all {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 8px;
  border: 0;
  background: #f8fbff;
  padding: 12px 14px;
  color: #2563eb;
  font-size: 12.5px;
  font-weight: 800;
  cursor: pointer;
}

.search-all:hover {
  background: #eef4ff;
}

.search-all svg {
  width: 15px;
  height: 15px;
}

.search-empty {
  display: grid;
  place-items: center;
  gap: 8px;
  padding: 26px 16px;
  text-align: center;
  color: #64748b;
}

.search-empty svg {
  width: 26px;
  height: 26px;
  color: #cbd5e1;
}

.search-empty p {
  margin: 0;
  font-size: 13px;
}

.did-you-mean {
  border: 0;
  background: transparent;
  color: #2563eb;
  font-size: 13px;
  cursor: pointer;
}

.did-you-mean strong {
  font-weight: 850;
}

.topic-card.clickable {
  cursor: pointer;
  transition: border-color .15s ease, box-shadow .15s ease, transform .15s ease;
}

.topic-card.clickable:hover {
  border-color: #b9c9ff;
  box-shadow: 0 10px 24px rgba(37, 99, 235, .08);
  transform: translateY(-1px);
}

.popular-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 9px;
  margin: 14px 0 22px;
}

.popular-row span {
  color: #64748b;
  font-size: 12.5px;
}

.popular-row button {
  height: 31px;
  border: 1px solid #dbe4f0;
  border-radius: 999px;
  background: #fff;
  padding: 0 16px;
  color: #334155;
  font-size: 12px;
  font-weight: 800;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
}

.start-panel,
.howto-panel {
  border: 1px solid #dfe7f2;
  border-radius: 14px;
  background: #fff;
  padding: 18px;
  box-shadow: 0 8px 22px rgba(15, 23, 42, .04);
}

.start-panel header h2,
.help-section h2,
.howto-panel h2,
.rail-card h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 850;
  letter-spacing: 0;
}

.start-grid {
  display: grid;
  grid-template-columns: 310px minmax(0, 1fr);
  gap: 14px;
  margin-top: 20px;
}

.guide-card {
  min-height: 180px;
  border-radius: 8px;
  background: linear-gradient(135deg, #1f7af4 0%, #315df4 58%, #6047f5 100%);
  padding: 22px;
  color: #fff;
}

.guide-card h3,
.checklist-card h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 850;
}

.guide-card p {
  max-width: 260px;
  margin: 9px 0 46px;
  color: rgba(255, 255, 255, .9);
  font-size: 13px;
  line-height: 1.5;
}

.guide-card a,
.assistant-card button {
  display: inline-flex;
  height: 36px;
  align-items: center;
  gap: 8px;
  border: 0;
  border-radius: 9px;
  background: #fff;
  padding: 0 16px;
  color: #1e3a8a;
  font-size: 12px;
  font-weight: 850;
  text-decoration: none;
}

.guide-card a svg,
.assistant-card svg {
  width: 14px;
  height: 14px;
}

.checklist-card {
  border: 1px solid #dfe7f2;
  border-radius: 10px;
  padding: 18px;
}

.checklist-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 13px;
}

.checklist-head span {
  color: #94a3b8;
  font-size: 12px;
  font-weight: 700;
}

.checklist-card ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.checklist-card li {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #475569;
  font-size: 12.5px;
  font-weight: 700;
}

.checklist-card li span {
  display: grid;
  width: 14px;
  height: 14px;
  place-items: center;
  color: #b5c0cf;
}

.checklist-card li.done span {
  border-radius: 999px;
  background: #10b981;
  color: #fff;
}

.checklist-card svg {
  width: 12px;
  height: 12px;
}

.progress-track {
  height: 4px;
  margin-top: 15px;
  overflow: hidden;
  border-radius: 999px;
  background: #e6ebf2;
}

.progress-track span {
  display: block;
  width: 40%;
  height: 100%;
  border-radius: inherit;
  background: #2563eb;
}

.help-section {
  margin-top: 24px;
}

.topic-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.library-section {
  border: 1px solid #dfe7f2;
  border-radius: 13px;
  background: #fff;
  padding: 16px 18px 18px;
  box-shadow: 0 8px 22px rgba(15, 23, 42, .04);
}

.library-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.library-card {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 16px;
  min-height: 74px;
  align-items: center;
  gap: 14px;
  border: 1px solid #dfe7f2;
  border-radius: 9px;
  background: #fbfdff;
  padding: 12px 14px;
  color: inherit;
  text-decoration: none;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .03);
  transition: border-color .15s ease, box-shadow .15s ease, transform .15s ease;
}

.library-card:hover {
  border-color: #b9c9ff;
  background: #fff;
  box-shadow: 0 10px 24px rgba(37, 99, 235, .08);
  transform: translateY(-1px);
}

.library-card h3 {
  margin: 0;
  color: #0f172a;
  font-size: 13px;
  font-weight: 850;
}

.library-card p {
  margin: 5px 0 0;
  color: #64748b;
  font-size: 11.5px;
  line-height: 1.45;
}

.library-card > svg {
  width: 15px;
  height: 15px;
  color: #94a3b8;
}

.topic-card {
  display: flex;
  min-height: 72px;
  align-items: center;
  gap: 14px;
  border: 1px solid #dfe7f2;
  border-radius: 9px;
  background: #fff;
  padding: 14px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .03);
}

.topic-card h3,
.tutorial-body h3,
.next-step h3 {
  margin: 0;
  color: #0f172a;
  font-size: 13px;
  font-weight: 850;
}

.topic-card p,
.tutorial-body p,
.next-step p {
  margin: 5px 0 0;
  color: #64748b;
  font-size: 11.5px;
  line-height: 1.45;
}

.topic-icon,
.next-step > span,
.support-row > span {
  display: grid;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 9px;
}

.topic-icon svg,
.next-step svg,
.support-row svg {
  width: 20px;
  height: 20px;
}

.blue { background: #eef4ff; color: #2563eb; }
.violet { background: #f2efff; color: #4f46e5; }
.teal { background: #e8fbf7; color: #0faaa5; }
.coral { background: #fff1ed; color: #f15b3d; }

.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.section-title-row button,
.section-title-row a,
.link-action {
  border: 0;
  background: transparent;
  color: #2563eb;
  font-size: 12px;
  font-weight: 850;
  text-decoration: none;
}

.all-set {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 4px 0 12px;
  padding: 11px 12px;
  border: 1px solid #bbf7d0;
  border-radius: 10px;
  background: #f0fdf4;
  color: #15803d;
}
.all-set svg { width: 18px; height: 18px; flex-shrink: 0; }
.all-set p { margin: 0; font-size: 12.5px; font-weight: 700; }

.tutorial-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-top: 14px;
}

.tutorial-card {
  overflow: hidden;
  border: 1px solid #dfe7f2;
  border-radius: 9px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .03);
}

.tutorial-art {
  position: relative;
  height: 96px;
  overflow: hidden;
}

.tutorial-art.blue { background: linear-gradient(135deg, #e9f1ff, #dbeafe); }
.tutorial-art.mint { background: linear-gradient(135deg, #e7fbf6, #d9f4ef); }
.tutorial-art.violet { background: linear-gradient(135deg, #f4edff, #ece9ff); }
.tutorial-art.purple { background: linear-gradient(135deg, #f5efff, #ece6ff); }

.play {
  position: absolute;
  left: 26px;
  top: 34px;
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 999px;
  background: rgba(255, 255, 255, .86);
  color: #2563eb;
  box-shadow: 0 10px 24px rgba(37, 99, 235, .15);
}

.play svg {
  width: 15px;
  height: 15px;
}

.duration {
  position: absolute;
  right: 10px;
  bottom: 9px;
  border-radius: 5px;
  background: rgba(15, 23, 42, .78);
  padding: 3px 7px;
  color: #fff;
  font-size: 11px;
  font-weight: 800;
}

.art-line,
.art-node {
  position: absolute;
  background: rgba(37, 99, 235, .2);
}

.art-line {
  height: 8px;
  border-radius: 999px;
}

.art-line.a { width: 82px; left: 74px; top: 30px; }
.art-line.b { width: 118px; left: 74px; top: 50px; }
.art-node {
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: rgba(37, 99, 235, .34);
}
.art-node.one { right: 58px; top: 22px; }
.art-node.two { right: 88px; top: 58px; }
.art-node.three { right: 30px; top: 54px; }

.tutorial-body {
  padding: 14px;
}

.level {
  display: inline-flex;
  margin-top: 14px;
  border-radius: 5px;
  padding: 4px 8px;
  font-size: 10.5px;
  font-weight: 850;
}

.level.beginner {
  background: #dff8ef;
  color: #059669;
}

.level.intermediate {
  background: #fff5d9;
  color: #b7791f;
}

.howto-panel {
  margin-top: 16px;
}

.guide-list {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}

.guide-list button {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border: 1px solid #dfe7f2;
  border-radius: 8px;
  background: #fff;
  padding: 0 12px;
  color: #334155;
  font-size: 12px;
  font-weight: 800;
  text-align: left;
}

.guide-list svg {
  width: 15px;
  height: 15px;
  color: #94a3b8;
}

.help-rail {
  display: grid;
  align-content: start;
  gap: 16px;
  margin-top: 188px;
}

.rail-card {
  border: 1px solid #dfe7f2;
  border-radius: 13px;
  background: #fff;
  padding: 18px;
  box-shadow: 0 8px 22px rgba(15, 23, 42, .04);
}

.next-step {
  display: flex;
  gap: 14px;
  border: 1px solid #dfe7f2;
  border-radius: 9px;
  padding: 14px;
  margin-top: 14px;
}

.next-step > span {
  background: #eeeafe;
  color: #4f46e5;
}

.next-step button {
  height: 28px;
  margin-top: 10px;
  border: 0;
  border-radius: 6px;
  background: #3156e9;
  padding: 0 12px;
  color: #fff;
  font-size: 11px;
  font-weight: 850;
}

.link-action {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-top: 14px;
}

.support-row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 12px;
  border: 1px solid #e5ebf3;
  border-radius: 8px;
  background: #fff;
  padding: 10px;
  color: inherit;
  text-decoration: none;
  text-align: left;
}

.support-row + .support-row {
  margin-top: 8px;
}

.support-row > div {
  min-width: 0;
  flex: 1;
}

.support-row strong,
.support-row small {
  display: block;
}

.support-row strong {
  color: #0f172a;
  font-size: 12px;
  font-weight: 850;
}

.support-row small {
  margin-top: 2px;
  color: #64748b;
  font-size: 11.5px;
}

.support-row > svg {
  width: 15px;
  height: 15px;
  color: #94a3b8;
}

.assistant-card button {
  margin-top: 14px;
  border: 1px solid #dbe4f0;
  background: #f8fbff;
  color: #334155;
}

.chat-fab {
  position: fixed;
  right: 30px;
  bottom: 28px;
  display: grid;
  width: 56px;
  height: 56px;
  place-items: center;
  border: 0;
  border-radius: 999px;
  background: linear-gradient(135deg, #2563eb, #4f46e5);
  color: #fff;
  box-shadow: 0 18px 35px rgba(37, 99, 235, .28);
}

.chat-fab svg {
  width: 25px;
  height: 25px;
}

@media (max-width: 1280px) {
  .help-page {
    grid-template-columns: 1fr;
  }
  .help-main {
    justify-self: stretch;
    max-width: none;
  }
  .help-rail {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin-top: 0;
  }
}

@media (max-width: 980px) {
  .start-grid,
  .topic-grid,
  .library-grid,
  .tutorial-grid,
  .guide-list,
  .help-rail {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .help-page {
    padding: 22px 16px 72px;
  }
  .help-hero {
    flex-direction: column;
  }
  .start-grid,
  .topic-grid,
  .library-grid,
  .tutorial-grid,
  .guide-list,
  .help-rail {
    grid-template-columns: 1fr;
  }
  .help-search kbd {
    display: none;
  }
}
</style>

