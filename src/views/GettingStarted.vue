<template>
  <main class="started-page">
    <section class="started-main">
      <h1>Getting Started</h1>

      <section class="welcome-card">
        <div class="welcome-copy">
          <h2>Welcome to Aadml, {{ firstName }}</h2>
          <p>Let's get you up and running in a few simple steps so you can start building and automating with confidence.</p>
          <div class="welcome-actions">
            <button class="primary" @click="goTo(continueRoute)">Continue setup</button>
            <button class="secondary" @click="goTo('/dashboard/help-center/tutorials')">Watch 2-min overview</button>
          </div>
        </div>
        <div class="welcome-art" aria-hidden="true">
          <span class="dot a" />
          <span class="dot b" />
          <span class="dot c" />
          <div class="mini-card one"><Icon icon="lucide:check-square" /><i /></div>
          <div class="mini-card two"><Icon icon="lucide:check-square" /><i /></div>
          <div class="mini-card three"><Icon icon="lucide:message-circle" /><i /></div>
          <div class="wide-card"><b /><b /><b /></div>
          <span class="block left" />
          <span class="block right" />
        </div>
      </section>

      <section class="checklist-card">
        <header class="section-head">
          <div>
            <h2>Your setup checklist</h2>
            <p>Complete these steps to unlock the full power of Aadml.</p>
          </div>
          <div class="overall-progress">
            <span>{{ completedCount }} of {{ total }} completed</span>
            <div><i :style="{ width: percent + '%' }" /></div>
          </div>
        </header>

        <div class="setup-list">
          <article v-for="item in checklist" :key="item.number" class="setup-row" @click="goTo(item.route)">
            <span :class="['status-icon', item.state]">
              <Icon :icon="item.state === 'completed' ? 'lucide:check' : item.icon" />
            </span>
            <b>{{ item.number }}</b>
            <div>
              <h3>{{ item.title }}</h3>
              <p>{{ item.copy }}</p>
            </div>
            <span :class="['status-pill', item.state]">{{ item.label }}</span>
            <Icon class="row-arrow" icon="lucide:chevron-right" />
          </article>
        </div>

        <footer class="checklist-footer">
          <div>
            <strong>Need help getting started?</strong>
            <p>Check out our quick start guide or watch a full walkthrough.</p>
          </div>
          <button @click="goTo('/dashboard/help-center/documentation')"><Icon icon="lucide:sparkles" /> Quick start guide</button>
          <button @click="goTo('/dashboard/help-center/tutorials')"><Icon icon="lucide:play-circle" /> Watch full walkthrough</button>
        </footer>
      </section>

      <section class="templates-card">
        <header class="section-head compact">
          <div>
            <h2>Starter templates</h2>
            <p>Launch faster with prebuilt agents and workflows.</p>
          </div>
          <button @click="goTo('/dashboard/agents/new')">View all templates <Icon icon="lucide:arrow-right" /></button>
        </header>
        <div class="template-grid">
          <article v-for="template in templates" :key="template.title" class="template-card">
            <span :class="template.tone"><Icon :icon="template.icon" /></span>
            <div>
              <h3>{{ template.title }}</h3>
              <p>{{ template.copy }}</p>
            </div>
            <button @click="useTemplate(template)">Use template</button>
          </article>
        </div>
      </section>

      <section class="guided-card">
        <header class="section-head compact">
          <div>
            <h2>Guided setup</h2>
            <p>Step-by-step guides to get core functionality up and running.</p>
          </div>
          <button @click="goTo('/dashboard/help-center/documentation')">View all guides <Icon icon="lucide:arrow-right" /></button>
        </header>
        <div class="guide-grid">
          <article v-for="guide in guides" :key="guide.title" class="guide-card">
            <span :class="guide.tone"><Icon :icon="guide.icon" /></span>
            <div>
              <h3>{{ guide.title }}</h3>
              <p>{{ guide.copy }}</p>
              <small><Icon icon="lucide:clock-3" /> {{ guide.time }}</small>
            </div>
          </article>
        </div>
      </section>
    </section>

    <aside class="started-rail">
      <section class="rail-card progress-card">
        <h2>Your setup progress</h2>
        <div class="progress-ring">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="43" />
            <circle cx="60" cy="60" r="43" :style="{ strokeDashoffset: ringOffset }" />
          </svg>
          <div><strong>{{ percent }}%</strong><span>Complete</span></div>
        </div>
        <ul>
          <li><Icon icon="lucide:check" /> <span>{{ completedCount }}</span> Completed</li>
          <li><Icon icon="lucide:check" /> <span>{{ inProgressCount }}</span> In progress</li>
          <li><Icon icon="lucide:check" /> <span>{{ notStartedCount }}</span> Not started</li>
        </ul>
        <p>Keep going! You're doing great.</p>
        <button @click="goTo(continueRoute)">Continue setup</button>
      </section>

      <section class="rail-card">
        <h2>Helpful resources</h2>
        <button v-for="resource in resources" :key="resource.title" class="rail-row" @click="goTo(resource.route)">
          <span><Icon :icon="resource.icon" /></span>
          <span>
            <strong>{{ resource.title }}</strong>
            <small>{{ resource.copy }}</small>
          </span>
          <Icon icon="lucide:external-link" />
        </button>
      </section>

      <section class="rail-card">
        <h2>Need help?</h2>
        <p>We're here to help you succeed.</p>
        <button v-for="help in helpLinks" :key="help.title" class="rail-row" @click="goTo(help.route)">
          <span><Icon :icon="help.icon" /></span>
          <span>
            <strong>{{ help.title }}</strong>
            <small>{{ help.copy }}</small>
          </span>
          <Icon icon="lucide:external-link" />
        </button>
      </section>

      <section class="rail-card team-card">
        <div class="team-head">
          <span class="avatar">H</span>
          <div>
            <h2>Talk to our team</h2>
            <p>Book a call with a solutions expert.</p>
          </div>
        </div>
        <button class="schedule">Schedule a call</button>
        <div class="contact-row"><Icon icon="lucide:mail" /><span>Email us<br><b>support@Aadml.com</b></span></div>
        <div class="contact-row"><Icon icon="lucide:clock-3" /><span>Response time<br><b>Typically within 1 business day</b></span></div>
      </section>
    </aside>

    <button class="chat-fab" aria-label="Open support chat">
      <Icon icon="lucide:message-circle" />
    </button>
  </main>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import api from '../services/api'

const router = useRouter()
const firstName = ref('there')

// Step metadata — title/copy/icon/route per onboarding key. State (completed/
// progress/idle) is derived from the live /onboarding/status/ payload, never hardcoded.
const STEP_META = [
  { key: 'provider', number: 1, title: 'Connect a model provider', copy: 'Connect OpenAI, Anthropic, Google, or another provider to power your agents.', icon: 'lucide:plug', route: '/dashboard/llm-settings' },
  { key: 'agent', number: 2, title: 'Create your first agent', copy: "Define your agent's purpose, instructions, and tools.", icon: 'lucide:bot', route: '/dashboard/agents/new' },
  { key: 'connector', number: 3, title: 'Add a connector', copy: 'Connect your tools and data sources so your agent can take action.', icon: 'lucide:link-2', route: '/dashboard/connectors' },
  { key: 'first_run', number: 4, title: 'Run your first task', copy: 'Test your agent with a simple task and see results in the Activity log.', icon: 'lucide:clipboard', route: '/dashboard/chat/new' },
  { key: 'workflow', number: 5, title: 'Build a workflow', copy: 'Automate multi-step processes with triggers, conditions, and actions.', icon: 'lucide:workflow', route: '/dashboard/workflow-builder' },
  { key: 'budget', number: 6, title: 'Configure a budget', copy: 'Set spending limits and alerts to keep usage predictable.', icon: 'lucide:wallet', route: '/dashboard/budgets' },
  { key: 'guardrails', number: 7, title: 'Review guardrails & security', copy: 'Set data handling, content filters, and permissions to stay in control.', icon: 'lucide:shield', route: '/dashboard/organization' },
]
const LABELS = { completed: 'Completed', progress: 'In progress', idle: 'Not started' }

const done = ref({})

// Checklist with live state: first not-done step becomes "in progress", rest "idle".
const checklist = computed(() => {
  let firstIncomplete = true
  return STEP_META.map((m) => {
    const isDone = !!done.value[m.key]
    let state = 'idle'
    if (isDone) state = 'completed'
    else if (firstIncomplete) { state = 'progress'; firstIncomplete = false }
    return { ...m, state, label: LABELS[state] }
  })
})
const total = computed(() => checklist.value.length)
const completedCount = computed(() => checklist.value.filter(s => s.state === 'completed').length)
const inProgressCount = computed(() => checklist.value.filter(s => s.state === 'progress').length)
const notStartedCount = computed(() => checklist.value.filter(s => s.state === 'idle').length)
const percent = computed(() => total.value ? Math.round((completedCount.value / total.value) * 100) : 0)
// Progress-ring stroke offset (dasharray is 270 in CSS → offset shrinks as % grows).
const ringOffset = computed(() => Math.round(270 * (1 - percent.value / 100)))

const continueRoute = computed(() => {
  const next = checklist.value.find(s => s.state !== 'completed')
  return next ? next.route : '/dashboard/help-center'
})

const templates = ref([
  { title: 'Research Assistant', copy: 'Find, summarize, and cite information from the web.', icon: 'lucide:search', tone: 'violet' },
  { title: 'Customer Support Agent', copy: 'Answer FAQs and handle customer inquiries.', icon: 'lucide:headphones', tone: 'teal' },
  { title: 'Data Analyst', copy: 'Analyze data, create charts, and surface insights.', icon: 'lucide:bar-chart-3', tone: 'blue' },
  { title: 'Content Writer', copy: 'Draft blog posts, product copy, and more.', icon: 'lucide:pencil', tone: 'purple' },
  { title: 'Lead Enrichment', copy: 'Find and enrich leads from multiple sources.', icon: 'lucide:briefcase-business', tone: 'green' },
])
const TONES = ['violet', 'teal', 'blue', 'purple', 'green']
const TPL_ICONS = ['lucide:search', 'lucide:headphones', 'lucide:bar-chart-3', 'lucide:pencil', 'lucide:briefcase-business']

function goTo(route) { if (route) router.push(route) }

async function useTemplate(t) {
  if (t.id) {
    try {
      const { data } = await api.createAgentFromTemplate({ template_id: t.id })
      const newId = data?.id || data?.agent?.id
      if (newId) return router.push(`/dashboard/agents/${newId}/editor`)
    } catch (e) { /* fall through to the builder */ }
  }
  router.push('/dashboard/agents/new')
}

onMounted(async () => {
  try {
    const { data } = await api.getOnboardingStatus()
    done.value = data?.done || {}
  } catch (e) { /* checklist degrades to all not-started */ }
  try {
    const { data } = await api.getCurrentUser()
    const u = data?.user || {}
    firstName.value = (u.first_name || u.username || 'there')
  } catch (e) { /* keep default greeting */ }
  try {
    const { data } = await api.listAgentTemplates()
    const rows = data?.templates || data?.results || (Array.isArray(data) ? data : [])
    if (rows.length) {
      templates.value = rows.slice(0, 5).map((r, i) => ({
        id: r.id,
        title: r.name || r.template_category || 'Template',
        copy: r.template_description || r.description || '',
        icon: TPL_ICONS[i % TPL_ICONS.length],
        tone: TONES[i % TONES.length],
      }))
    }
  } catch (e) { /* keep static template cards as a graceful fallback */ }
})

const guides = [
  { title: 'Connect your first provider', copy: 'Add and verify your model provider.', time: '3 min', icon: 'lucide:badge-check', tone: 'blue' },
  { title: 'Create and test an agent', copy: 'Build, configure, and try your agent.', time: '5 min', icon: 'lucide:bot', tone: 'blue' },
  { title: 'Add your first connector', copy: 'Connect tools and data sources.', time: '4 min', icon: 'lucide:link-2', tone: 'blue' },
  { title: 'Build a simple workflow', copy: 'Automate a task from start to finish.', time: '6 min', icon: 'lucide:workflow', tone: 'blue' },
  { title: 'Set budgets and alerts', copy: 'Control spend and get notified.', time: '3 min', icon: 'lucide:bell-ring', tone: 'purple' },
]

const resources = [
  { title: 'Documentation', copy: 'Browse guides and references', icon: 'lucide:file-text', route: '/dashboard/help-center/documentation' },
  { title: 'Tutorials', copy: 'Watch step-by-step videos', icon: 'lucide:play-circle', route: '/dashboard/help-center/tutorials' },
  { title: 'Guided tours', copy: 'Interactive product walkthroughs', icon: 'lucide:circle-dot', route: '/dashboard/help-center/guided-tours' },
]

const helpLinks = [
  { title: 'Contact support', copy: 'Get help from our team', icon: 'lucide:user-round', route: '/dashboard/help-center/support' },
  { title: 'Join community', copy: 'Ask questions and share ideas', icon: 'lucide:users-round', route: '/dashboard/help-center' },
  { title: 'Status page', copy: 'Check system status and updates', icon: 'lucide:activity', route: '/dashboard/help-center' },
]
</script>

<style scoped>
.started-page {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 20px;
  min-height: 100%;
  padding: 28px 28px 54px;
  background: #f8fbff;
  color: #0f172a;
}

.started-main {
  width: 100%;
  max-width: 1170px;
  justify-self: center;
}

.started-main > h1 {
  margin: 0 0 18px;
  font-size: 24px;
  line-height: 1.15;
  font-weight: 850;
  letter-spacing: 0;
}

.welcome-card,
.checklist-card,
.templates-card,
.guided-card,
.rail-card {
  border: 1px solid #dfe7f2;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 8px 22px rgba(15, 23, 42, .035);
}

.welcome-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 480px;
  min-height: 190px;
  overflow: hidden;
  padding: 32px;
}

.welcome-copy h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 850;
  letter-spacing: 0;
}

.welcome-copy p,
.section-head p,
.rail-card > p,
.team-head p {
  max-width: 520px;
  margin: 10px 0 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.55;
}

.welcome-actions {
  display: flex;
  gap: 12px;
  margin-top: 22px;
}

.primary,
.secondary,
.checklist-footer button,
.templates-card header button,
.guided-card header button,
.rail-card > button,
.schedule {
  display: inline-flex;
  height: 36px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 7px;
  padding: 0 16px;
  font-size: 12px;
  font-weight: 850;
}

.primary {
  border: 0;
  background: #3156e9;
  color: #fff;
}

.secondary {
  border: 1px solid #dbe4f0;
  background: #fff;
  color: #334155;
}

.welcome-art {
  position: relative;
  min-height: 150px;
}

.welcome-art .dot {
  position: absolute;
  top: 12px;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #c7d2fe;
}

.dot.a { left: 100px; }
.dot.b { left: 113px; }
.dot.c { left: 126px; }

.mini-card,
.wide-card {
  position: absolute;
  top: 42px;
  border: 1px solid #e3eafd;
  border-radius: 12px;
  background: rgba(255, 255, 255, .86);
  box-shadow: 0 16px 32px rgba(37, 99, 235, .11);
}

.mini-card {
  display: grid;
  width: 54px;
  height: 92px;
  place-items: center;
}

.mini-card svg {
  width: 22px;
  height: 22px;
  color: #3b82f6;
}

.mini-card i {
  width: 18px;
  height: 6px;
  border-radius: 99px;
  background: #10b981;
}

.mini-card.one { left: 112px; }
.mini-card.two { left: 184px; }
.mini-card.three { left: 256px; }

.wide-card {
  left: 328px;
  width: 150px;
  height: 92px;
  padding: 24px;
}

.wide-card b {
  display: block;
  height: 7px;
  margin-bottom: 13px;
  border-radius: 99px;
  background: #e5ebf6;
}

.block {
  position: absolute;
  bottom: -34px;
  width: 42px;
  height: 68px;
  border-radius: 14px 14px 0 0;
  background: linear-gradient(180deg, #6d8dfd, #3156e9);
}

.block.left { left: 66px; height: 34px; }
.block.right { right: 4px; }

.checklist-card,
.templates-card,
.guided-card {
  margin-top: 12px;
  padding: 16px;
}

.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.section-head h2,
.rail-card h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 850;
}

.section-head.compact {
  align-items: center;
}

.section-head.compact button {
  border: 0;
  background: transparent;
  color: #2563eb;
  padding: 0;
}

.overall-progress {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 330px;
  margin-top: 6px;
}

.overall-progress span {
  color: #64748b;
  font-size: 12px;
  font-weight: 750;
}

.overall-progress div {
  flex: 1;
  height: 7px;
  overflow: hidden;
  border-radius: 999px;
  background: #e6ebf2;
}

.overall-progress i {
  display: block;
  width: 43%;
  height: 100%;
  border-radius: inherit;
  background: #3156e9;
}

.setup-list {
  margin-top: 14px;
  overflow: hidden;
  border: 1px solid #edf2f7;
  border-radius: 8px;
}

.setup-row {
  display: grid;
  grid-template-columns: 34px 22px minmax(0, 1fr) 106px 24px;
  align-items: center;
  gap: 10px;
  min-height: 46px;
  border-top: 1px solid #edf2f7;
  padding: 8px 10px;
}

.setup-row:first-child {
  border-top: 0;
}

.status-icon {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 8px;
}

.status-icon svg {
  width: 16px;
  height: 16px;
}

.status-icon.completed {
  background: #e3f9ee;
  color: #10b981;
}

.status-icon.progress {
  background: #eef4ff;
  color: #2563eb;
}

.status-icon.idle {
  background: #f1f5f9;
  color: #64748b;
}

.setup-row b {
  color: #475569;
  font-size: 13px;
}

.setup-row h3 {
  margin: 0;
  color: #0f172a;
  font-size: 12px;
  font-weight: 850;
}

.setup-row p {
  margin: 3px 0 0;
  color: #64748b;
  font-size: 11px;
}

.status-pill {
  justify-self: end;
  border-radius: 7px;
  padding: 5px 12px;
  font-size: 10.5px;
  font-weight: 850;
}

.status-pill.completed {
  background: #dff8ef;
  color: #059669;
}

.status-pill.progress {
  background: #eef4ff;
  color: #2563eb;
}

.status-pill.idle {
  background: #f1f5f9;
  color: #475569;
}

.row-arrow {
  width: 15px;
  height: 15px;
  color: #64748b;
}

.checklist-footer {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 10px;
  border: 1px solid #edf2f7;
  border-radius: 8px;
  padding: 12px;
}

.checklist-footer div {
  flex: 1;
}

.checklist-footer strong {
  display: block;
  color: #0f172a;
  font-size: 12px;
}

.checklist-footer p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 11.5px;
}

.checklist-footer button {
  border: 0;
  background: transparent;
  color: #2563eb;
}

.template-grid,
.guide-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.template-card,
.guide-card {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  gap: 11px;
  border: 1px solid #dfe7f2;
  border-radius: 8px;
  padding: 12px;
}

.template-card > span,
.guide-card > span,
.rail-row > span:first-child {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 8px;
}

.template-card svg,
.guide-card svg,
.rail-row > span:first-child svg {
  width: 17px;
  height: 17px;
}

.violet { background: #f2efff; color: #7c3aed; }
.teal { background: #e7fbf6; color: #0faaa5; }
.blue { background: #eef4ff; color: #2563eb; }
.purple { background: #fbebff; color: #a855f7; }
.green { background: #e9fbf1; color: #10b981; }

.template-card h3,
.guide-card h3 {
  margin: 0;
  color: #0f172a;
  font-size: 12px;
  font-weight: 850;
}

.template-card p,
.guide-card p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 10.8px;
  line-height: 1.35;
}

.template-card button {
  grid-column: 1 / -1;
  height: 27px;
  border: 1px solid #dbe4f0;
  border-radius: 6px;
  background: #fff;
  color: #2563eb;
  font-size: 11px;
  font-weight: 850;
}

.guide-card small {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 11px;
  color: #64748b;
  font-size: 10.5px;
  font-weight: 750;
}

.guide-card small svg {
  width: 12px;
  height: 12px;
}

.started-rail {
  display: grid;
  align-content: start;
  gap: 14px;
}

.rail-card {
  padding: 16px;
}

.progress-card {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  column-gap: 12px;
}

.progress-card h2,
.progress-card p,
.progress-card > button {
  grid-column: 1 / -1;
}

.progress-ring {
  position: relative;
  width: 100px;
  height: 100px;
  margin-top: 18px;
}

.progress-ring svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.progress-ring circle {
  fill: none;
  stroke-width: 12;
}

.progress-ring circle:first-child {
  stroke: #e8edf5;
}

.progress-ring circle:last-child {
  stroke: #3156e9;
  stroke-linecap: round;
  stroke-dasharray: 270;
  stroke-dashoffset: 154;
}

.progress-ring div {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  text-align: center;
}

.progress-ring strong {
  font-size: 20px;
  font-weight: 850;
}

.progress-ring span {
  color: #64748b;
  font-size: 10px;
  font-weight: 800;
}

.progress-card ul {
  display: grid;
  align-content: center;
  gap: 12px;
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
}

.progress-card li {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #475569;
  font-size: 12px;
  font-weight: 750;
}

.progress-card li svg {
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: #e3f9ee;
  color: #10b981;
  padding: 3px;
}

.progress-card li:nth-child(2) svg {
  background: #eef4ff;
  color: #3156e9;
}

.progress-card li:nth-child(3) svg {
  background: #f1f5f9;
  color: #64748b;
}

.progress-card li span {
  color: #2563eb;
}

.progress-card p {
  margin-top: 18px;
}

.progress-card > button,
.schedule {
  width: 100%;
  margin-top: 14px;
  border: 1px solid #dbe4f0;
  background: #fff;
  color: #2563eb;
}

.rail-row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  border: 1px solid #e5ebf3;
  border-radius: 8px;
  background: #fff;
  padding: 10px;
  text-align: left;
}

.rail-row > span:first-child {
  background: #eef4ff;
  color: #2563eb;
}

.rail-row > span:nth-child(2) {
  min-width: 0;
  flex: 1;
}

.rail-row strong,
.rail-row small {
  display: block;
}

.rail-row strong {
  color: #0f172a;
  font-size: 12px;
  font-weight: 850;
}

.rail-row small {
  margin-top: 3px;
  color: #64748b;
  font-size: 11px;
}

.rail-row > svg {
  width: 14px;
  height: 14px;
  color: #64748b;
}

.team-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar {
  display: grid;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 999px;
  background: linear-gradient(135deg, #c084fc, #60a5fa);
  color: #fff;
  font-weight: 850;
}

.team-head h2 {
  margin: 0;
}

.team-head p {
  margin-top: 4px;
}

.contact-row {
  display: flex;
  gap: 10px;
  margin-top: 18px;
  color: #64748b;
  font-size: 11.5px;
}

.contact-row svg {
  width: 16px;
  height: 16px;
  color: #64748b;
}

.contact-row b {
  color: #64748b;
  font-weight: 750;
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
  .started-page {
    grid-template-columns: 1fr;
  }
  .started-main {
    max-width: none;
  }
  .started-rail {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 980px) {
  .welcome-card,
  .template-grid,
  .guide-grid,
  .started-rail {
    grid-template-columns: 1fr;
  }
  .welcome-art {
    display: none;
  }
  .overall-progress {
    min-width: 0;
    width: 100%;
  }
  .section-head,
  .checklist-footer {
    flex-direction: column;
    align-items: stretch;
  }
}

@media (max-width: 720px) {
  .started-page {
    padding: 22px 16px 72px;
  }
  .setup-row {
    grid-template-columns: 30px 20px minmax(0, 1fr);
  }
  .status-pill,
  .row-arrow {
    display: none;
  }
}
</style>

