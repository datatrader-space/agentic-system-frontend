<template>
  <main class="tutorials-page">
    <section class="tutorials-main">
      <header class="tutorials-hero">
        <div>
          <h1>Tutorials</h1>
          <p>Learn how to build, connect, and automate with Aadml.</p>
        </div>
        <button class="demo-btn" @click="popularTutorials[0] && openTutorial(popularTutorials[0])">
          <Icon icon="lucide:play" />
          Watch demo
        </button>
      </header>

      <section class="filter-panel">
        <div class="tutorial-search">
          <Icon icon="lucide:search" />
          <input v-model="query" type="search" placeholder="Search tutorials, topics, or skills..." />
          <kbd>Ctrl K</kbd>
        </div>
        <div class="filter-row">
          <select v-model="difficulty">
            <option>All Difficulty</option>
            <option>Beginner</option>
            <option>Intermediate</option>
            <option>Advanced</option>
          </select>
          <span class="divider" />
          <button class="level-pill beginner"><i /> Beginner</button>
          <button class="level-pill intermediate"><i /> Intermediate</button>
          <button class="level-pill advanced"><i /> Advanced</button>
          <span class="spacer" />
          <select v-model="area">
            <option>All Areas</option>
            <option>Agents</option>
            <option>Connectors</option>
            <option>Workflows</option>
          </select>
          <select v-model="sort">
            <option>Sort: Popular</option>
            <option>Sort: Newest</option>
            <option>Sort: Shortest</option>
          </select>
        </div>
      </section>

      <section class="content-panel">
        <div class="section-row">
          <div>
            <h2>Featured Series</h2>
            <p>Step-by-step series to help you master Aadml.</p>
          </div>
          <button>View all series</button>
        </div>
        <div class="featured-grid">
          <article v-for="series in featuredSeries" :key="series.title" class="series-card" @click="openTutorial(series)">
            <div :class="['series-art', series.tone]">
              <div class="flow-line" />
              <span class="play"><Icon icon="lucide:play" /></span>
              <span class="lessons">{{ series.lessons }}</span>
              <span class="node one"><Icon :icon="series.icon" /></span>
              <span class="node two"><Icon icon="lucide:check" /></span>
              <span class="node three"><Icon icon="lucide:circle-dot" /></span>
            </div>
            <div class="card-body">
              <h3>{{ series.title }}</h3>
              <p>{{ series.copy }}</p>
              <strong :class="series.level.toLowerCase()">{{ series.level }}</strong>
              <span>{{ series.progress }} complete</span>
              <div class="progress"><i :style="{ width: series.progress }" /></div>
            </div>
          </article>
          <button class="carousel next" aria-label="Next featured series"><Icon icon="lucide:chevron-right" /></button>
        </div>

        <div class="section-row tutorials-title">
          <div>
            <h2>Popular Tutorials</h2>
            <p>Browse our most watched tutorials.</p>
          </div>
          <button>View all tutorials</button>
        </div>
        <div class="popular-grid">
          <article v-for="tutorial in popularTutorials" :key="tutorial.title" class="tutorial-card" @click="openTutorial(tutorial)">
            <div :class="['thumb', tutorial.tone]">
              <span class="play"><Icon icon="lucide:play" /></span>
              <span class="duration">{{ tutorial.duration }}</span>
              <div class="thumb-line a" />
              <div class="thumb-line b" />
              <div class="thumb-box" />
            </div>
            <div class="tutorial-body">
              <h3>{{ tutorial.title }}</h3>
              <p>{{ tutorial.copy }}</p>
              <strong :class="tutorial.level.toLowerCase()">{{ tutorial.level }}</strong>
            </div>
          </article>
          <button class="carousel popular-next" aria-label="Next tutorials"><Icon icon="lucide:chevron-right" /></button>
        </div>

        <div class="section-row paths-title">
          <div>
            <h2>Learning Paths</h2>
            <p>Follow structured paths to build real skills.</p>
          </div>
          <button>View all paths</button>
        </div>
        <div class="path-grid">
          <article v-for="path in learningPaths" :key="path.title" class="path-card" @click="openTutorial(path)">
            <span :class="['path-icon', path.tone]"><Icon :icon="path.icon" /></span>
            <div>
              <h3>{{ path.title }}</h3>
              <p>{{ path.copy }}</p>
              <div class="path-meta">
                <span>{{ path.lessons }} Lessons</span>
                <span :class="path.level.toLowerCase()"><i /> {{ path.level }}</span>
                <b>{{ path.progress }}</b>
              </div>
              <div class="progress"><i :style="{ width: path.progress }" /></div>
            </div>
          </article>
        </div>
      </section>
    </section>

    <aside class="tutorials-rail">
      <section class="rail-card">
        <h2>Continue learning</h2>
        <article v-for="item in continueLearning" :key="item.title" class="learning-row">
          <div :class="['mini-art', item.tone]">
            <Icon :icon="item.icon" />
          </div>
          <div>
            <h3>{{ item.title }}</h3>
            <p>{{ item.completed }}</p>
            <div class="progress"><i :style="{ width: item.progress }" /></div>
          </div>
        </article>
      </section>

      <section class="rail-card">
        <h2>Recommended paths</h2>
        <p>Follow these paths based on your goals.</p>
        <button v-for="path in recommendedPaths" :key="path.title" class="recommend-row">
          <span :class="path.tone"><Icon :icon="path.icon" /></span>
          <span>
            <strong>{{ path.title }}</strong>
            <small>{{ path.copy }}</small>
          </span>
          <Icon icon="lucide:chevron-right" />
        </button>
      </section>

      <section class="rail-card tips-card">
        <h2>Learning tips</h2>
        <ul>
          <li v-for="tip in tips" :key="tip"><Icon icon="lucide:check" />{{ tip }}</li>
        </ul>
        <RouterLink to="/dashboard/help-center">
          Visit Help Center
          <Icon icon="lucide:external-link" />
        </RouterLink>
      </section>
    </aside>

    <button class="chat-fab" aria-label="Open support chat" @click="goTo('/dashboard/chat/new')">
      <Icon icon="lucide:message-circle" />
    </button>
  </main>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import api from '../services/api'

const router = useRouter()
const query = ref('')
const difficulty = ref('All Difficulty')
const area = ref('All Areas')
const sort = ref('Sort: Popular')

const tutorials = ref([])  // live helpcenter Tutorial rows (with per-user progress)

const POP_TONES = ['screen', 'violet', 'pale', 'metrics', 'checks']
const SERIES_TONES = ['mint', 'violet', 'blue', 'teal']
const SERIES_ICONS = ['lucide:bot', 'lucide:link-2', 'lucide:workflow', 'lucide:shield-check']

function titleCase(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : '' }

function progressPercent(t) {
  if (t.progress_status === 'completed') return '100%'
  const total = t.steps_count || 0
  const done = (t.completed_steps || []).length
  if (!total) return t.progress_status === 'in_progress' ? '10%' : '0%'
  return `${Math.round((done / total) * 100)}%`
}

function openTutorial(t) {
  if (t.video_url) { window.open(t.video_url, '_blank', 'noopener'); return }
  if (t.slug) router.push(`/dashboard/help-center/tutorials/${t.slug}`)
}

// Filter + sort applied to the live tutorial list.
const filteredTutorials = computed(() => {
  let list = tutorials.value.slice()
  const q = query.value.trim().toLowerCase()
  if (q) list = list.filter(t => `${t.title} ${t.summary || ''}`.toLowerCase().includes(q))
  if (difficulty.value && difficulty.value !== 'All Difficulty') {
    list = list.filter(t => (t.difficulty || '').toLowerCase() === difficulty.value.toLowerCase())
  }
  if (area.value && area.value !== 'All Areas') {
    const a = area.value.toLowerCase()
    list = list.filter(t => `${t.series || ''} ${t.category_name || ''}`.toLowerCase().includes(a))
  }
  if (sort.value === 'Sort: Shortest') list.sort((x, y) => (x.estimated_minutes || 0) - (y.estimated_minutes || 0))
  else list.sort((x, y) => (x.sort_order || 0) - (y.sort_order || 0))
  return list
})

const popularTutorials = computed(() => {
  if (!tutorials.value.length) return staticPopular
  return filteredTutorials.value.slice(0, 6).map((t, i) => ({
    title: t.title, copy: t.summary || '', duration: `${t.estimated_minutes} min`,
    level: titleCase(t.difficulty) || 'Beginner', tone: POP_TONES[i % POP_TONES.length],
    slug: t.slug, video_url: t.video_url,
  }))
})

// Group tutorials into series for the Featured Series + Learning Paths sections.
const seriesGroups = computed(() => {
  const map = new Map()
  for (const t of filteredTutorials.value) {
    const key = t.series || t.category_name || 'General'
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(t)
  }
  return Array.from(map.entries()).map(([name, items], i) => {
    const doneCount = items.filter(t => t.progress_status === 'completed').length
    return {
      title: name,
      copy: items[0]?.summary || '',
      count: items.length,
      level: titleCase(items[0]?.difficulty) || 'Beginner',
      tone: SERIES_TONES[i % SERIES_TONES.length],
      icon: items[0]?.icon || SERIES_ICONS[i % SERIES_ICONS.length],
      progress: `${Math.round((doneCount / items.length) * 100)}%`,
      firstSlug: items[0]?.slug,
      firstVideo: items[0]?.video_url,
    }
  })
})

const featuredSeries = computed(() => {
  if (!tutorials.value.length) return staticFeatured
  return seriesGroups.value.slice(0, 4).map(g => ({
    title: g.title, copy: g.copy, lessons: `${g.count} Lesson${g.count === 1 ? '' : 's'}`,
    level: g.level, progress: g.progress, tone: g.tone, icon: g.icon,
    slug: g.firstSlug, video_url: g.firstVideo,
  }))
})

const learningPaths = computed(() => {
  if (!tutorials.value.length) return staticPaths
  return seriesGroups.value.slice(0, 3).map(g => ({
    title: g.title, copy: g.copy, lessons: String(g.count),
    level: g.level, progress: g.progress, tone: g.tone, icon: g.icon,
    slug: g.firstSlug, video_url: g.firstVideo,
  }))
})

function goTo(route) { if (route) router.push(route) }

onMounted(async () => {
  try {
    const { data } = await api.getTutorials()
    tutorials.value = data?.tutorials || []
  } catch (e) { /* keep static fallback content */ }
})

const staticFeatured = [
  { title: 'Build Your First Agent', copy: 'Create, configure, and test your first AI agent from start to finish.', lessons: '6 Lessons', level: 'Beginner', progress: '60%', tone: 'mint', icon: 'lucide:bot' },
  { title: 'Connect Your Tools', copy: 'Connect your favorite tools and bring your data into Aadml.', lessons: '5 Lessons', level: 'Beginner', progress: '40%', tone: 'violet', icon: 'logos:slack-icon' },
  { title: 'Automate With Workflows', copy: 'Design powerful workflows and automate repetitive tasks.', lessons: '7 Lessons', level: 'Intermediate', progress: '25%', tone: 'blue', icon: 'lucide:workflow' },
  { title: 'Manage Budgets & Guardrails', copy: 'Control costs, set limits, and keep your agents safe and reliable.', lessons: '4 Lessons', level: 'Intermediate', progress: '0%', tone: 'teal', icon: 'lucide:shield-check' },
]

const staticPopular = [
  { title: 'Create your first Agent', copy: 'Learn how to create, configure, and test your first agent.', duration: '8:45', level: 'Beginner', tone: 'screen' },
  { title: 'Connect Slack and Notion', copy: 'Send messages, read pages, and sync data with ease.', duration: '6:12', level: 'Beginner', tone: 'violet' },
  { title: 'Build a multi-step workflow', copy: 'Create a workflow with conditions, loops, and actions.', duration: '12:30', level: 'Intermediate', tone: 'pale' },
  { title: 'Monitor usage and costs', copy: 'Track usage, set budgets, and get usage alerts.', duration: '7:18', level: 'Intermediate', tone: 'metrics' },
  { title: 'Set guardrails & permissions', copy: 'Keep your agents safe with guardrails and role-based access.', duration: '9:05', level: 'Advanced', tone: 'checks' },
]

const staticPaths = [
  { title: 'Agent Builder Essentials', copy: 'Go from zero to your first working agent.', lessons: '6', level: 'Beginner', progress: '60%', tone: 'teal', icon: 'lucide:bot' },
  { title: 'Workflow Automation', copy: 'Design and automate end-to-end processes.', lessons: '7', level: 'Intermediate', progress: '25%', tone: 'violet', icon: 'lucide:workflow' },
  { title: 'Enterprise Ready', copy: 'Secure, scale, and govern your agents.', lessons: '8', level: 'Advanced', progress: '10%', tone: 'blue', icon: 'lucide:shield' },
]

const continueLearning = [
  { title: 'Build Your First Agent', completed: '3 of 6 lessons completed', progress: '60%', tone: 'mint', icon: 'lucide:bot' },
  { title: 'Connect Your Tools', completed: '2 of 5 lessons completed', progress: '40%', tone: 'violet', icon: 'lucide:link-2' },
  { title: 'Automate With Workflows', completed: '1 of 7 lessons completed', progress: '25%', tone: 'blue', icon: 'lucide:workflow' },
]

const recommendedPaths = [
  { title: 'Build your first agent', copy: 'Start here', tone: 'blue', icon: 'lucide:bot' },
  { title: 'Connect your tools', copy: 'Integrate your data', tone: 'violet', icon: 'lucide:link-2' },
  { title: 'Automate with workflows', copy: 'Save time and scale', tone: 'blue', icon: 'lucide:workflow' },
  { title: 'Manage budgets & guardrails', copy: 'Control costs & security', tone: 'teal', icon: 'lucide:shield-check' },
]

const tips = ['Start with beginner tutorials', 'Practice in the sandbox', 'Build a small project', 'Join the community']
</script>

<style scoped>
.tutorials-page {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 24px;
  min-height: 100%;
  padding: 32px 32px 54px;
  background: #f8fbff;
  color: #0f172a;
}

.tutorials-main {
  width: 100%;
  max-width: 1140px;
  justify-self: center;
}

.tutorials-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 18px;
}

.tutorials-hero h1 {
  margin: 0;
  font-size: 24px;
  line-height: 1.15;
  font-weight: 850;
  letter-spacing: 0;
}

.tutorials-hero p,
.section-row p,
.rail-card > p {
  margin: 7px 0 0;
  color: #64748b;
  font-size: 13px;
}

.demo-btn {
  display: inline-flex;
  height: 38px;
  align-items: center;
  gap: 9px;
  border: 1px solid #dbe4f0;
  border-radius: 9px;
  background: #fff;
  padding: 0 16px;
  color: #334155;
  font-size: 12.5px;
  font-weight: 850;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
}

.demo-btn svg {
  width: 15px;
  height: 15px;
  color: #2563eb;
}

.filter-panel,
.content-panel,
.rail-card {
  border: 1px solid #dfe7f2;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 22px rgba(15, 23, 42, .04);
}

.filter-panel {
  padding: 14px;
}

.tutorial-search {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 40px;
  border: 1px solid #d8e2f0;
  border-radius: 8px;
  background: #fff;
  padding: 0 12px 0 16px;
}

.tutorial-search svg {
  width: 17px;
  height: 17px;
  color: #94a3b8;
}

.tutorial-search input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  color: #0f172a;
  font-size: 13px;
  font-weight: 650;
}

.tutorial-search input::placeholder {
  color: #8b9bb1;
}

.tutorial-search kbd {
  border: 1px solid #dbe4f0;
  border-radius: 6px;
  background: #f8fafc;
  padding: 3px 8px;
  color: #64748b;
  font-size: 11px;
  font-weight: 850;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
}

.filter-row select,
.level-pill {
  height: 36px;
  border: 1px solid #dbe4f0;
  border-radius: 8px;
  background: #fff;
  padding: 0 14px;
  color: #334155;
  font-size: 12px;
  font-weight: 850;
}

.filter-row select {
  min-width: 130px;
}

.divider {
  width: 1px;
  height: 26px;
  background: #e2e8f0;
}

.spacer {
  flex: 1;
}

.level-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.level-pill i,
.path-meta i {
  width: 8px;
  height: 8px;
  border-radius: 999px;
}

.level-pill.beginner i,
.path-meta .beginner i { background: #10b981; }
.level-pill.intermediate i,
.path-meta .intermediate i { background: #f59e0b; }
.level-pill.advanced i,
.path-meta .advanced i { background: #7c3aed; }

.content-panel {
  position: relative;
  margin-top: 16px;
  padding: 18px;
  overflow: hidden;
}

.section-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.section-row h2,
.rail-card h2 {
  margin: 0;
  color: #0f172a;
  font-size: 15px;
  font-weight: 850;
}

.section-row button {
  border: 0;
  background: transparent;
  color: #2563eb;
  font-size: 12px;
  font-weight: 850;
}

.featured-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-top: 14px;
}

.series-card,
.tutorial-card,
.path-card {
  overflow: hidden;
  border: 1px solid #dfe7f2;
  border-radius: 9px;
  background: #fff;
}

.series-art,
.thumb {
  position: relative;
  height: 126px;
  overflow: hidden;
}

.series-art.mint,
.thumb.screen { background: linear-gradient(135deg, #e7fbf6, #d9f4ef); }
.series-art.violet,
.thumb.violet { background: linear-gradient(135deg, #f4edff, #ece9ff); }
.series-art.blue,
.thumb.pale { background: linear-gradient(135deg, #eaf1ff, #dbeafe); }
.series-art.teal,
.thumb.checks { background: linear-gradient(135deg, #e8fbf7, #eefdfb); }
.thumb.metrics { background: linear-gradient(135deg, #edf4ff, #f5f9ff); }

.flow-line,
.thumb-line {
  position: absolute;
  height: 8px;
  border-radius: 999px;
  background: rgba(37, 99, 235, .18);
}

.flow-line {
  left: 44px;
  right: 44px;
  top: 61px;
}

.play {
  position: absolute;
  left: 50%;
  top: 50%;
  display: grid;
  width: 42px;
  height: 42px;
  transform: translate(-50%, -50%);
  place-items: center;
  border-radius: 999px;
  background: rgba(255, 255, 255, .92);
  color: #2563eb;
  box-shadow: 0 12px 24px rgba(37, 99, 235, .18);
}

.play svg {
  width: 17px;
  height: 17px;
}

.lessons,
.duration {
  position: absolute;
  right: 9px;
  bottom: 9px;
  border-radius: 5px;
  background: rgba(15, 23, 42, .82);
  padding: 3px 7px;
  color: #fff;
  font-size: 10.5px;
  font-weight: 850;
}

.node {
  position: absolute;
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 9px;
  background: rgba(255, 255, 255, .86);
  color: #0faaa5;
}

.node svg {
  width: 17px;
  height: 17px;
}

.node.one { left: 42px; top: 54px; }
.node.two { left: 50%; top: 26px; transform: translateX(-50%); }
.node.three { right: 42px; top: 54px; }

.card-body,
.tutorial-body {
  padding: 14px;
}

.card-body h3,
.tutorial-body h3,
.path-card h3,
.learning-row h3 {
  margin: 0;
  color: #0f172a;
  font-size: 13px;
  font-weight: 850;
}

.card-body p,
.tutorial-body p,
.path-card p,
.learning-row p {
  margin: 7px 0 13px;
  color: #64748b;
  font-size: 11.5px;
  line-height: 1.5;
}

.card-body strong,
.tutorial-body strong {
  display: block;
  margin-bottom: 9px;
  font-size: 11px;
  font-weight: 850;
}

.beginner { color: #10b981; }
.intermediate { color: #f59e0b; }
.advanced { color: #7c3aed; }

.card-body > span {
  display: block;
  margin-bottom: 7px;
  color: #64748b;
  font-size: 11px;
  font-weight: 750;
}

.progress {
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: #e6ebf2;
}

.progress i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #2563eb;
}

.carousel {
  position: absolute;
  right: -17px;
  top: 46px;
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border: 1px solid #dfe7f2;
  border-radius: 999px;
  background: #f3f7ff;
  color: #334155;
  box-shadow: 0 8px 18px rgba(15, 23, 42, .08);
}

.carousel svg {
  width: 18px;
  height: 18px;
}

.tutorials-title,
.paths-title {
  margin-top: 24px;
}

.popular-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
  margin-top: 14px;
}

.thumb {
  height: 108px;
}

.thumb-line.a { left: 26px; top: 28px; width: 96px; }
.thumb-line.b { left: 26px; top: 50px; width: 132px; }
.thumb-box {
  position: absolute;
  right: 22px;
  top: 24px;
  width: 70px;
  height: 48px;
  border-radius: 8px;
  background: rgba(255, 255, 255, .62);
}

.popular-next {
  top: 40px;
}

.path-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 14px;
}

.path-card {
  display: flex;
  gap: 16px;
  padding: 14px;
}

.path-icon,
.recommend-row > span:first-child {
  display: grid;
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 10px;
}

.path-icon svg,
.recommend-row > span:first-child svg {
  width: 24px;
  height: 24px;
}

.teal { background: #e7fbf6; color: #0faaa5; }
.violet { background: #f2efff; color: #4f46e5; }
.blue { background: #eef4ff; color: #2563eb; }

.path-card > div {
  min-width: 0;
  flex: 1;
}

.path-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 12px 0 9px;
  color: #64748b;
  font-size: 11px;
  font-weight: 800;
}

.path-meta span:nth-child(2) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.path-meta b {
  margin-left: auto;
  color: #334155;
}

.tutorials-rail {
  display: grid;
  align-content: start;
  gap: 16px;
}

.rail-card {
  padding: 18px;
}

.learning-row {
  display: flex;
  gap: 14px;
  margin-top: 18px;
}

.mini-art {
  display: grid;
  width: 58px;
  height: 58px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 8px;
}

.mini-art svg {
  width: 25px;
  height: 25px;
}

.learning-row > div:last-child {
  min-width: 0;
  flex: 1;
}

.learning-row p {
  margin-bottom: 10px;
}

.recommend-row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
  border: 1px solid #e5ebf3;
  border-radius: 9px;
  background: #fff;
  padding: 10px;
  text-align: left;
}

.recommend-row > span:first-child {
  width: 38px;
  height: 38px;
  border-radius: 8px;
}

.recommend-row > span:nth-child(2) {
  min-width: 0;
  flex: 1;
}

.recommend-row strong,
.recommend-row small {
  display: block;
}

.recommend-row strong {
  color: #0f172a;
  font-size: 12px;
  font-weight: 850;
}

.recommend-row small {
  margin-top: 3px;
  color: #64748b;
  font-size: 11px;
}

.recommend-row > svg {
  width: 15px;
  height: 15px;
  color: #94a3b8;
}

.tips-card ul {
  display: grid;
  gap: 11px;
  margin: 18px 0 16px;
  padding: 0;
  list-style: none;
}

.tips-card li {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #64748b;
  font-size: 12px;
  font-weight: 750;
}

.tips-card li svg {
  width: 15px;
  height: 15px;
  color: #10b981;
}

.tips-card a {
  display: inline-flex;
  height: 34px;
  align-items: center;
  gap: 8px;
  border: 1px solid #dbe4f0;
  border-radius: 8px;
  background: #fff;
  padding: 0 13px;
  color: #334155;
  font-size: 12px;
  font-weight: 850;
  text-decoration: none;
}

.tips-card a svg {
  width: 13px;
  height: 13px;
  color: #2563eb;
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

@media (max-width: 1340px) {
  .tutorials-page {
    grid-template-columns: 1fr;
  }
  .tutorials-main {
    max-width: none;
  }
  .tutorials-rail {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1040px) {
  .featured-grid,
  .popular-grid,
  .path-grid,
  .tutorials-rail {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .filter-row {
    flex-wrap: wrap;
  }
  .spacer {
    display: none;
  }
}

@media (max-width: 720px) {
  .tutorials-page {
    padding: 22px 16px 72px;
  }
  .tutorials-hero {
    flex-direction: column;
  }
  .featured-grid,
  .popular-grid,
  .path-grid,
  .tutorials-rail {
    grid-template-columns: 1fr;
  }
  .tutorial-search kbd {
    display: none;
  }
}
</style>

