<template>
  <main class="guided-page">
    <section class="guided-main">
      <header class="page-head">
        <div>
          <h1>Guided Tours</h1>
          <p>Learn Aadml with guided in-app tours and step-by-step walkthroughs.</p>
        </div>
        <button class="demo-btn" @click="recommendedTours[0] && startTour(recommendedTours[0])"><Icon icon="lucide:play" /> Watch demo</button>
      </header>

      <label class="search-bar">
        <Icon icon="lucide:search" />
        <input v-model="query" placeholder="Search tours by name or topic..." />
        <kbd>Ctrl K</kbd>
      </label>

      <nav class="tour-tabs" aria-label="Tour categories">
        <button v-for="tab in tabs" :key="tab" :class="{ active: tab === activeTab }" @click="activeTab = tab">{{ tab }}</button>
      </nav>

      <section class="tour-panel">
        <header class="section-head">
          <div>
            <h2>Recommended for you</h2>
            <p>Tours we think will help you get the most out of Aadml.</p>
          </div>
          <button>View all <Icon icon="lucide:chevron-right" /></button>
        </header>
        <div class="recommended-grid">
          <article v-for="tour in recommendedTours" :key="tour.title" class="tour-card large">
            <div class="tour-top">
              <span :class="['tour-icon', tour.tone]"><Icon :icon="tour.icon" /></span>
              <div>
                <h3>{{ tour.title }}</h3>
                <p>{{ tour.copy }}</p>
              </div>
            </div>
            <div class="tour-meta">
              <span><Icon icon="lucide:list-checks" /> {{ tour.steps }} steps</span>
              <span><Icon icon="lucide:clock-3" /> {{ tour.time }}</span>
              <span><Icon icon="lucide:bar-chart-3" /> {{ tour.level }}</span>
            </div>
            <button class="start-btn" @click="startTour(tour)">Start tour <Icon icon="lucide:arrow-right" /></button>
          </article>
        </div>

        <header class="section-head small">
          <div>
            <h2>Recently updated tours</h2>
            <p>Check out the latest updated walkthroughs.</p>
          </div>
          <button>View all <Icon icon="lucide:chevron-right" /></button>
        </header>
        <div class="compact-grid">
          <article v-for="tour in recentTours" :key="tour.title" class="tour-card compact">
            <div class="tour-top">
              <span :class="['tour-icon', tour.tone]"><Icon :icon="tour.icon" /></span>
              <div>
                <h3>{{ tour.title }}</h3>
                <p>{{ tour.copy }}</p>
              </div>
            </div>
            <div class="tour-meta">
              <span><Icon icon="lucide:list-checks" /> {{ tour.steps }} steps</span>
              <span><Icon icon="lucide:clock-3" /> {{ tour.time }}</span>
              <span><Icon icon="lucide:bar-chart-3" /> {{ tour.level }}</span>
            </div>
            <button class="start-btn" @click="startTour(tour)">Start tour <Icon icon="lucide:arrow-right" /></button>
          </article>
        </div>

        <header class="section-head small">
          <div>
            <h2>Admin tours</h2>
            <p>Advanced setup and administration guides.</p>
          </div>
          <button>View all <Icon icon="lucide:chevron-right" /></button>
        </header>
        <div class="compact-grid">
          <article v-for="tour in adminTours" :key="tour.title" class="tour-card compact">
            <div class="tour-top">
              <span :class="['tour-icon', tour.tone]"><Icon :icon="tour.icon" /></span>
              <div>
                <h3>{{ tour.title }}</h3>
                <p>{{ tour.copy }}</p>
              </div>
            </div>
            <div class="tour-meta">
              <span><Icon icon="lucide:list-checks" /> {{ tour.steps }} steps</span>
              <span><Icon icon="lucide:clock-3" /> {{ tour.time }}</span>
              <span><Icon icon="lucide:bar-chart-3" /> {{ tour.level }}</span>
            </div>
            <button class="start-btn" @click="startTour(tour)">Start tour <Icon icon="lucide:arrow-right" /></button>
          </article>
        </div>
      </section>
    </section>

    <aside class="guided-rail">
      <section class="rail-card progress-card">
        <h2>Onboarding progress</h2>
        <p>Complete tours to get up and running faster.</p>
        <div class="progress-row">
          <div class="ring" :style="ringStyle"><span>{{ percent }}%</span></div>
          <div>
            <strong>{{ completedCount }} <small>of {{ availableCount }} tours completed</small></strong>
            <div class="progress-line"><i :style="{ width: percent + '%' }" /></div>
            <p>Keep going! You're making great progress.</p>
          </div>
        </div>
        <button @click="activeTab = 'All Tours'">View all completed tours <Icon icon="lucide:arrow-right" /></button>
      </section>

      <section class="rail-card stats-card">
        <h2>Your tour stats</h2>
        <p>Your learning at a glance.</p>
        <div class="stats-grid">
          <article v-for="stat in stats" :key="stat.label">
            <strong>{{ stat.value }}</strong>
            <span>{{ stat.label }}</span>
          </article>
        </div>
      </section>

      <section class="rail-card how-card">
        <h2>How product tours work</h2>
        <ol>
          <li v-for="step in howSteps" :key="step.title">
            <span>{{ step.number }}</span>
            <div><strong>{{ step.title }}</strong><p>{{ step.copy }}</p></div>
          </li>
        </ol>
        <div class="tip-box">
          <strong>Pro tip</strong>
          <p>You can restart any tour anytime or explore advanced topics in Admin tours.</p>
        </div>
      </section>
    </aside>
  </main>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import api from '../services/api'
import { useOnboarding } from '../composables/useOnboarding'

const router = useRouter()
const onboarding = useOnboarding()

const tabs = ['All Tours', 'Getting Started', 'Agents', 'Workflows', 'Connectors', 'Activity', 'Budgets', 'Guardrails']
const activeTab = ref('All Tours')
const query = ref('')

const tours = ref([])          // live catalog (with per-user status)
const statsData = ref(null)    // live aggregate stats

const filteredAll = computed(() => {
  let list = tours.value
  const q = query.value.trim().toLowerCase()
  if (q) list = list.filter(t => `${t.title} ${t.copy} ${t.category}`.toLowerCase().includes(q))
  if (activeTab.value !== 'All Tours') {
    list = list.filter(t => (t.category || '').toLowerCase() === activeTab.value.toLowerCase())
  }
  return list
})

const recommendedTours = computed(() => tours.value.length ? filteredAll.value.filter(t => t.group === 'recommended') : staticRecommended)
const recentTours = computed(() => tours.value.length ? filteredAll.value.filter(t => t.group === 'recent') : staticRecent)
const adminTours = computed(() => tours.value.length ? filteredAll.value.filter(t => t.group === 'admin') : staticAdmin)

const percent = computed(() => statsData.value ? statsData.value.percent : 40)
const completedCount = computed(() => statsData.value ? statsData.value.completed : 6)
const availableCount = computed(() => statsData.value ? statsData.value.available : 15)
const ringStyle = computed(() => ({ background: `conic-gradient(#3156e9 0 ${percent.value}%, #e8eef7 ${percent.value}% 100%)` }))

const stats = computed(() => statsData.value ? [
  { value: String(statsData.value.available), label: 'Tours available' },
  { value: String(statsData.value.completed), label: 'Tours completed' },
  { value: `${statsData.value.time_spent_hours} hrs`, label: 'Time spent learning' },
  { value: String(statsData.value.in_progress), label: 'In progress' },
] : staticStats)

async function load() {
  try {
    const { data } = await api.getGuidedTours()
    // Normalize: the card binds `steps` as a count; keep the step list for launching.
    tours.value = (data?.tours || []).map(t => ({
      ...t,
      steps: t.steps_count != null ? t.steps_count : (t.steps || []).length,
      stepList: Array.isArray(t.steps) ? t.steps : [],
    }))
    statsData.value = data?.stats || null
  } catch (e) { /* keep static fallback content */ }
}

async function startTour(tour) {
  try { await api.updateTourProgress(tour.key, { status: 'in_progress' }) } catch (e) { /* best-effort */ }
  if (tour.key === 'get-started' && onboarding?.startTour) onboarding.startTour()
  const route = (tour.stepList && tour.stepList[0] && tour.stepList[0].target_route) || tour.target_route
  if (route) router.push(route)
}

function goTo(route) { if (route) router.push(route) }

onMounted(load)

const staticRecommended = [
  { title: 'Get started in Aadml', copy: 'A 5-minute tour to help you create your first agent and run it successfully.', steps: 6, time: '5 min', level: 'Easy', icon: 'lucide:rocket', tone: 'blue' },
  { title: 'Build your first agent', copy: 'Learn how to configure agent settings, tools, and guardrails.', steps: 8, time: '8 min', level: 'Easy', icon: 'lucide:bot', tone: 'green' },
  { title: 'Create and run a workflow', copy: 'Learn how to design a workflow, connect steps, and run it end-to-end.', steps: 7, time: '7 min', level: 'Medium', icon: 'lucide:git-branch', tone: 'violet' },
]

const staticRecent = [
  { title: 'Connect your first app', copy: 'Connect a data source or tool using a connector.', steps: 5, time: '4 min', level: 'Easy', icon: 'lucide:link-2', tone: 'blue' },
  { title: 'Monitor agent activity', copy: 'Explore the Activity tab and understand key metrics.', steps: 6, time: '6 min', level: 'Easy', icon: 'lucide:activity', tone: 'green' },
  { title: 'Set a budget and alerts', copy: 'Learn how to set budgets and configure spend alerts.', steps: 5, time: '4 min', level: 'Easy', icon: 'lucide:pie-chart', tone: 'amber' },
  { title: 'Introduction to Guardrails', copy: 'See how Guardrails help keep your agents safe and reliable.', steps: 5, time: '4 min', level: 'Medium', icon: 'lucide:shield-check', tone: 'violet' },
]

const staticAdmin = [
  { title: 'Manage teams and roles', copy: 'Add teammates, manage roles, and set permissions.', steps: 7, time: '7 min', level: 'Medium', icon: 'lucide:users', tone: 'violet' },
  { title: 'Configure SSO', copy: 'Set up Single Sign-On for your organization.', steps: 8, time: '10 min', level: 'Advanced', icon: 'lucide:lock-keyhole', tone: 'green' },
  { title: 'Audit logs and compliance', copy: 'Review audit logs and export compliance reports.', steps: 6, time: '6 min', level: 'Medium', icon: 'lucide:file-text', tone: 'blue' },
  { title: 'Environment settings', copy: 'Configure workspace settings and environment defaults.', steps: 5, time: '5 min', level: 'Easy', icon: 'lucide:settings', tone: 'green' },
]

const staticStats = [
  { value: '15', label: 'Tours available' },
  { value: '6', label: 'Tours completed' },
  { value: '3.2 hrs', label: 'Time spent learning' },
  { value: '4', label: 'In progress' },
]

const howSteps = [
  { number: 1, title: 'Choose a tour', copy: 'Browse by category or search for the topic you want to learn.' },
  { number: 2, title: 'Start the tour', copy: "We'll guide you step-by-step inside the product." },
  { number: 3, title: 'Learn by doing', copy: 'Try actions in real time and complete key tasks.' },
  { number: 4, title: 'Track your progress', copy: 'Pick up where you left off and celebrate milestones.' },
]
</script>

<style scoped>
.guided-page {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 28px;
  min-height: 100%;
  padding: 30px 34px;
  background: #f8fbff;
  color: #0f172a;
}
.guided-main { max-width: 1100px; width: 100%; justify-self: center; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 22px; }
h1, h2, h3, p { margin: 0; }
h1 { font-size: 25px; line-height: 1.1; font-weight: 850; }
.page-head p, .section-head p, .rail-card p, .tour-card p { color: #53657d; font-size: 12px; line-height: 1.45; }
.page-head p { margin-top: 8px; }
button, input { font: inherit; }
.demo-btn {
  height: 38px; border: 1px solid #d7e1ee; border-radius: 8px; background: #fff; color: #0f172a; display: inline-flex; align-items: center; gap: 8px; padding: 0 16px; font-size: 12px; font-weight: 850;
}
.demo-btn svg { color: #3156e9; }
.search-bar {
  height: 50px; border: 1px solid #b9c9ff; border-radius: 9px; background: #fff; display: flex; align-items: center; gap: 12px; padding: 0 16px; margin-bottom: 16px;
}
.search-bar svg { color: #64748b; width: 18px; height: 18px; }
.search-bar input { flex: 1; border: 0; outline: 0; color: #0f172a; font-size: 13px; font-weight: 700; }
.search-bar input::placeholder { color: #8292a8; }
kbd { border: 1px solid #d7e1ee; border-radius: 6px; padding: 4px 8px; color: #64748b; background: #f8fafc; font-size: 11px; font-weight: 850; }
.tour-tabs { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 18px; }
.tour-tabs button {
  height: 34px; border: 1px solid #d7e1ee; border-radius: 9px; background: #fff; color: #334155; padding: 0 18px; font-size: 12px; font-weight: 850;
}
.tour-tabs .active { border-color: #3156e9; background: #3156e9; color: #fff; }
.tour-panel, .rail-card {
  border: 1px solid #dfe7f2; border-radius: 11px; background: #fff; box-shadow: 0 8px 22px rgba(15,23,42,.03);
}
.tour-panel { padding: 20px; }
.section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
.section-head.small { margin-top: 26px; }
.section-head h2, .rail-card h2 { font-size: 15px; font-weight: 850; margin-bottom: 6px; }
.section-head button, .progress-card > button {
  border: 0; background: transparent; color: #3156e9; display: inline-flex; align-items: center; gap: 6px; padding: 0; font-size: 12px; font-weight: 850;
}
.recommended-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.compact-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.tour-card { border: 1px solid #dfe7f2; border-radius: 9px; background: #fff; padding: 16px; }
.tour-card.large { min-height: 184px; }
.tour-card.compact { min-height: 160px; }
.tour-top { display: flex; gap: 14px; align-items: flex-start; }
.tour-icon { width: 46px; height: 46px; border-radius: 11px; display: grid; place-items: center; flex: 0 0 auto; }
.tour-icon svg { width: 23px; height: 23px; }
.blue { background: #eef4ff; color: #3156e9; }
.green { background: #e8fbf2; color: #059669; }
.violet { background: #f1efff; color: #6d5dfc; }
.amber { background: #fff7ed; color: #f59e0b; }
.tour-card h3 { font-size: 13px; line-height: 1.25; font-weight: 850; margin: 4px 0 8px; }
.tour-meta { display: flex; align-items: center; gap: 18px; color: #52637a; margin: 22px 0 14px; font-size: 11px; font-weight: 750; }
.tour-meta span { display: inline-flex; align-items: center; gap: 6px; }
.tour-meta svg { width: 13px; height: 13px; color: #64748b; }
.start-btn {
  width: 100%; height: 36px; border: 0; border-radius: 7px; background: #1f5ff2; color: #fff; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 12px; font-weight: 850;
}
.start-btn svg { margin-left: auto; }
.guided-rail { display: grid; gap: 14px; align-content: start; }
.rail-card { padding: 18px; }
.progress-row { display: grid; grid-template-columns: 72px 1fr; gap: 18px; align-items: center; margin: 18px 0; }
.ring {
  width: 72px; height: 72px; border-radius: 50%; display: grid; place-items: center; background: conic-gradient(#3156e9 0 40%, #e8eef7 40% 100%);
}
.ring span { width: 54px; height: 54px; border-radius: 50%; background: #fff; display: grid; place-items: center; font-size: 15px; font-weight: 900; }
.progress-row strong { display: block; font-size: 18px; margin-bottom: 10px; }
.progress-row small { font-size: 12px; font-weight: 750; color: #334155; }
.progress-line { height: 7px; border-radius: 999px; background: #e8eef7; overflow: hidden; margin-bottom: 8px; }
.progress-line i { display: block; width: 40%; height: 100%; background: #3156e9; border-radius: inherit; }
.stats-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 16px; }
.stats-grid article { border: 1px solid #dfe7f2; border-radius: 8px; min-height: 78px; display: grid; place-items: center; align-content: center; gap: 6px; }
.stats-grid strong { font-size: 19px; font-weight: 900; }
.stats-grid span { color: #64748b; font-size: 11px; font-weight: 750; }
.how-card ol { list-style: none; padding: 0; margin: 18px 0; display: grid; gap: 18px; }
.how-card li { display: grid; grid-template-columns: 24px 1fr; gap: 12px; }
.how-card li > span { width: 22px; height: 22px; border-radius: 999px; display: grid; place-items: center; background: #3156e9; color: #fff; font-size: 11px; font-weight: 900; }
.how-card strong { display: block; font-size: 12px; font-weight: 850; margin-bottom: 5px; }
.tip-box { border-radius: 9px; background: #eef4ff; padding: 16px; color: #334155; }
.tip-box strong { color: #3156e9; }
.tip-box p { margin-top: 8px; }
@media (max-width: 1320px) {
  .guided-page { grid-template-columns: 1fr; }
  .guided-rail { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 1050px) {
  .recommended-grid { grid-template-columns: 1fr; }
  .compact-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .guided-rail { grid-template-columns: 1fr; }
}
@media (max-width: 720px) {
  .guided-page { padding: 18px; }
  .page-head { flex-direction: column; }
  .demo-btn { width: 100%; }
  .compact-grid { grid-template-columns: 1fr; }
  .tour-meta { flex-wrap: wrap; }
}
</style>

