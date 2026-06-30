<template>
  <main class="org-module-page" :class="`org-module-page--${active.key}`">
    <header class="module-head">
      <div>
        <nav class="crumbs">
          <RouterLink to="/dashboard/organization">Organizations</RouterLink>
          <span>/</span>
          <span>{{ orgName }}</span>
          <span>/</span>
          <strong>{{ active.title }}</strong>
        </nav>
        <h1>{{ active.title }}</h1>
        <p>{{ active.copy }}</p>
      </div>
      <div class="module-actions">
        <RouterLink class="ghost" to="/dashboard/organization">
          <Icon icon="lucide:arrow-left" />
          Overview
        </RouterLink>
        <button class="ghost" @click="exportActivity"><Icon icon="lucide:download" /> Export</button>
        <button class="primary" @click="onAction"><Icon :icon="active.actionIcon" /> {{ active.action }}</button>
      </div>
    </header>

    <nav class="module-tabs" aria-label="Organization modules">
      <RouterLink
        v-for="module in modules"
        :key="module.key"
        :to="`/dashboard/organization/${module.key}`"
        :class="{ active: module.key === active.key }"
      >
        <Icon :icon="module.icon" />
        {{ module.short }}
      </RouterLink>
    </nav>

    <section class="metric-grid">
      <article v-for="metric in active.metrics" :key="metric.label" class="metric-card">
        <span>{{ metric.label }}</span>
        <strong>{{ metric.value }}</strong>
        <small :class="metric.tone">{{ metric.change }}</small>
      </article>
    </section>

    <section v-if="active.key === 'workspaces'" class="content-grid single">
      <article class="panel">
        <div class="table-tools">
          <div class="search"><Icon icon="lucide:search" /><input placeholder="Search workspaces..." /></div>
          <select><option>All Status</option></select>
          <select><option>All Owners</option></select>
          <button class="icon-btn"><Icon icon="lucide:layout-grid" /></button>
        </div>
        <DataTable :columns="active.columns" :rows="active.rows" />
      </article>
    </section>

    <section v-else-if="active.key === 'cloud-resources'" class="content-grid">
      <nav class="sub-tabs" aria-label="Cloud resources views">
        <button class="active">By Service</button>
        <button>By Region</button>
        <button>By Workspace</button>
        <button>By Provider</button>
      </nav>
      <article class="panel chart-card">
        <h2>Resources by Service</h2>
        <div class="donut-row">
          <div class="donut"><strong>Total<br />215</strong></div>
          <ul>
            <li v-for="item in resourceTypes" :key="item.name"><i :class="item.tone" />{{ item.name }} <b>{{ item.value }}</b></li>
          </ul>
        </div>
      </article>
      <article class="panel">
        <h2>Top Regions</h2>
        <div v-for="region in regions" :key="region.name" class="bar-row">
          <span>{{ region.name }}</span>
          <div><i :style="{ width: region.percent }" /></div>
          <b>{{ region.value }}</b>
        </div>
      </article>
      <article class="panel wide">
        <header class="panel-head"><h2>Recent Resources</h2><button>View all</button></header>
        <DataTable :columns="active.columns" :rows="active.rows" />
      </article>
    </section>

    <section v-else-if="active.key === 'budgets-finance'" class="content-grid finance">
      <nav class="sub-tabs finance-tabs" aria-label="Budget finance views">
        <button class="active">Overview</button>
        <button>Budgets</button>
        <button>Transactions</button>
        <button>Invoices</button>
        <button>Cost Reports</button>
      </nav>
      <article class="panel wide trend-panel">
        <header class="panel-head"><h2>Spend Trend</h2><span class="muted-note">Last 30 days</span></header>
        <div v-if="trend" class="finance-trend-body">
          <svg viewBox="0 0 620 230" aria-hidden="true">
            <path class="gridline" d="M58 36H560M58 76H560M58 116H560M58 156H560M58 196H560" />
            <path class="axis-line" d="M58 28V196H560" />
            <text x="5" y="40">$40K</text>
            <text x="5" y="80">$30K</text>
            <text x="5" y="120">$20K</text>
            <text x="5" y="160">$10K</text>
            <text x="10" y="200">$0K</text>
            <text x="58" y="222">Apr 21</text>
            <text x="154" y="222">Apr 26</text>
            <text x="250" y="222">May 1</text>
            <text x="346" y="222">May 6</text>
            <text x="442" y="222">May 11</text>
            <text x="524" y="222">May 16</text>
            <path class="trend-area" :d="trend.financeArea" />
            <path class="trend-line finance-actual" :d="trend.financeLine" />
            <path class="trend-line finance-forecast" :d="trend.financeForecast" />
            <path class="trend-line finance-budget" d="M58 36H560" />
          </svg>
          <ul class="finance-trend-legend">
            <li><i class="actual" />Actual <b>{{ trend.actualLabel }}</b></li>
            <li><i class="forecast" />Forecast <b>{{ trend.forecastLabel }}</b></li>
            <li><i class="budget" />Budget <b>{{ trend.budgetLabel }}</b></li>
          </ul>
        </div>
        <p v-else class="muted-note">No spend recorded this month.</p>
      </article>
      <article class="panel">
        <h2>Top Budget Owners (MTD)</h2>
        <div v-for="row in budgetOwners" :key="row.name" class="bar-row">
          <span>{{ row.name }}</span><div><i :style="{ width: row.percent }" /></div><b>{{ row.value }}</b>
        </div>
        <RouterLink class="link" to="/dashboard/budgets">View all budgets <Icon icon="lucide:arrow-right" /></RouterLink>
      </article>
      <article class="panel">
        <h2>Cost by Service (MTD)</h2>
        <div class="donut-row compact">
          <div class="donut"><strong>{{ donutTotal }}</strong></div>
          <ul>
            <li v-for="item in serviceCosts" :key="item.name"><i :class="item.tone" />{{ item.name }} <b>{{ item.value }}</b></li>
            <li v-if="!serviceCosts.length" class="muted-note">No provider spend yet.</li>
          </ul>
        </div>
      </article>
    </section>

    <section v-else-if="active.key === 'usage-insights'" class="content-grid finance">
      <article class="panel wide trend-panel">
        <header class="panel-head"><h2>Usage Over Time</h2><span class="muted-note">This month</span></header>
        <svg v-if="trend" viewBox="0 0 760 240" aria-hidden="true">
          <path class="gridline" d="M0 45H760M0 90H760M0 135H760M0 180H760" />
          <path class="trend-area" :d="trend.area" />
          <path class="trend-line purple" :d="trend.line" />
        </svg>
        <p v-else class="muted-note">No usage recorded this month.</p>
      </article>
      <article class="panel">
        <h2>Top Resource Consumers</h2>
        <div v-for="row in budgetOwners" :key="row.name" class="bar-row">
          <span>{{ row.name }}</span><div><i :style="{ width: row.percent }" /></div><b>{{ row.share }}</b>
        </div>
      </article>
      <article class="panel">
        <h2>Cost Optimization Opportunities</h2>
        <ul class="opportunity-list">
          <li v-for="item in opportunities" :key="item.name"><Icon icon="lucide:circle-dollar-sign" />{{ item.name }} <b>{{ item.value }}</b></li>
        </ul>
      </article>
    </section>

    <section v-else class="content-grid single">
      <article class="panel">
        <div class="table-tools">
          <div class="search"><Icon icon="lucide:search" /><input :placeholder="`Search ${active.short.toLowerCase()}...`" /></div>
          <select><option>All Types</option></select>
          <select><option>All Workspaces</option></select>
          <select><option>All Users</option></select>
        </div>
        <DataTable :columns="active.columns" :rows="active.rows" />
        <footer v-if="active.key === 'sandboxes'" class="table-footer">
          <span>1-8 of 32</span>
          <div class="table-pager">
            <button><Icon icon="lucide:chevron-left" /></button>
            <button class="active">1</button>
            <button>2</button>
            <button>3</button>
            <button>4</button>
            <button><Icon icon="lucide:chevron-right" /></button>
          </div>
        </footer>
        <div v-if="active.key === 'activity' && activityTotal > 0" class="pager">
          <span>Page {{ activityPage }} of {{ activityTotalPages }} · {{ activityTotal }} events</span>
          <div class="pager-btns">
            <button :disabled="activityPage <= 1 || loading" @click="changeActivityPage(-1)">
              <Icon icon="lucide:chevron-left" /> Prev
            </button>
            <button :disabled="activityPage >= activityTotalPages || loading" @click="changeActivityPage(1)">
              Next <Icon icon="lucide:chevron-right" />
            </button>
          </div>
        </div>
      </article>
      <article v-if="active.key === 'sandboxes'" class="panel sandbox-usage-card">
        <h2>Usage by Hour (Today)</h2>
        <div class="sandbox-chart">
          <span>Active Sandboxes</span>
        </div>
      </article>
      <article v-if="active.secondary" class="panel">
        <header class="panel-head"><h2>{{ active.secondary.title }}</h2></header>
        <DataTable :columns="active.secondary.columns" :rows="active.secondary.rows" />
      </article>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import tenancyApi from '../services/tenancyApi'
import api from '../services/api'
import { useOrganizationStore } from '../stores/useOrganizationStore'

const route = useRoute()
const router = useRouter()
const orgStore = useOrganizationStore()

const modules = [
  {
    key: 'workspaces',
    short: 'Workspaces',
    title: 'Workspaces',
    copy: 'Manage all workspaces in your organization.',
    icon: 'lucide:building-2',
    action: 'New Workspace',
    actionIcon: 'lucide:plus',
    metrics: [
      { label: 'Total Workspaces', value: '14', change: '+ 12 active', tone: 'good' },
      { label: 'Active', value: '12', change: '+ 88%', tone: 'good' },
      { label: 'Paused', value: '1', change: '+ 7%', tone: 'bad' },
      { label: 'Archived', value: '1', change: '+ 7%', tone: 'bad' },
    ],
    columns: ['Workspace', 'Owner', 'Members', 'Status', 'Cloud Spend (MTD)', 'Created'],
    rows: [
      ['Platform Team', 'Ali Tahir', '8', 'Active', '$29,450', 'May 12, 2025'],
      ['Data Science', 'Rida Khan', '6', 'Active', '$18,230', 'May 11, 2025'],
      ['Research Ops', 'Maryam Rehan', '5', 'Active', '$12,140', 'May 10, 2025'],
      ['Marketing', 'Sana Ahmed', '4', 'Active', '$8,000', 'May 9, 2025'],
      ['Content Ops', 'Bilal Qureshi', '3', 'Active', '$4,000', 'May 8, 2025'],
      ['Dev Platform', 'Usman Ali', '3', 'Paused', '$2,120', 'May 6, 2025'],
      ['QA Automation', 'Areeba Fatima', '2', 'Active', '$1,840', 'May 5, 2025'],
      ['Finance Analytics', 'Fahad Noor', '2', 'Archived', '$0', 'Apr 29, 2025'],
    ],
  },
  {
    key: 'cloud-resources',
    short: 'Cloud Resources',
    title: 'Cloud Resources',
    copy: 'All cloud resources provisioned across the organization.',
    icon: 'lucide:cloud',
    action: 'Request Resources',
    actionIcon: 'lucide:plus',
    metrics: [
      { label: 'Total Resources', value: '215', change: '', tone: '' },
      { label: 'Active Resources', value: '178', change: '+ 83%', tone: 'good' },
      { label: 'Monthly Spend (MTD)', value: '$24,680', change: '+ 12% vs last month', tone: 'good' },
      { label: 'Inactive Resources', value: '37', change: '+ 17%', tone: 'bad' },
    ],
    columns: ['Resource', 'Type', 'Workspace', 'Provider', 'Status', 'Cost (MTD)'],
    rows: [
      ['vm-platform-01', 'Compute', 'Platform Team', 'AWS', 'Active', '$1,245'],
      ['ds-main-prod', 'Database', 'Data Science', 'GCP', 'Active', '$980'],
      ['s3-data-lake', 'Storage', 'Data Science', 'AWS', 'Active', '$520'],
      ['vnet-main', 'Networking', 'Platform Team', 'Azure', 'Active', '$310'],
      ['lb-api-gateway', 'Load Balancer', 'Dev Platform', 'AWS', 'Active', '$210'],
    ],
  },
  {
    key: 'sandboxes',
    short: 'Sandboxes',
    title: 'Sandboxes (Daytona)',
    copy: 'Manage Daytona sandboxes across the organization.',
    icon: 'lucide:box',
    action: 'New Sandbox',
    actionIcon: 'lucide:plus',
    metrics: [
      { label: 'Total Sandboxes', value: '32', change: '', tone: '' },
      { label: 'Running', value: '20', change: '+ 4.5%', tone: 'good' },
      { label: 'Stopped', value: '9', change: '- 30%', tone: 'good' },
      { label: 'Idle > 24h', value: '3', change: '+ 9%', tone: 'bad' },
      { label: 'Cost (MTD)', value: '$6,124', change: '+ 16% vs last month', tone: 'good' },
    ],
    columns: ['Sandbox', 'Workspace', 'Owner', 'Status', 'Uptime', 'Cost (MTD)', 'Created'],
    rows: [
      ['dev-sandbox-01', 'Platform Team', 'Ali Tahir', 'Running', '24h', '$48.62', 'May 20'],
      ['ds-sandbox-03', 'Data Science', 'Rida Khan', 'Running', '18h', '$24.10', 'May 19'],
      ['research-db-02', 'Research Ops', 'Maryam Rehan', 'Stopped', '-', '$0.00', 'May 18'],
      ['content-bot-01', 'Content Ops', 'Bilal Qureshi', 'Running', '6h 12m', '$12.44', 'May 11'],
      ['mlops-sb-04', 'Marketing', 'Sana Ahmed', 'Stopped', '-', '$0.00', 'May 7'],
    ],
    secondary: {
      title: 'Top Users (MTD)',
      columns: ['User', 'Cost'],
      rows: [['Ali Tahir', '$1,245'], ['Rida Khan', '$1,120'], ['Maryam Rehan', '$990'], ['Bilal Qureshi', '$760']],
    },
  },
  {
    key: 'budgets-finance',
    short: 'Budgets & Finance',
    title: 'Budgets & Finance',
    copy: 'Track budgets, spend, and financial health.',
    icon: 'lucide:wallet',
    action: 'Manage Budgets',
    actionIcon: 'lucide:settings',
    metrics: [
      { label: 'Total Budget (MTD)', value: '$120,000', change: '', tone: '' },
      { label: 'Spent (MTD)', value: '$74,820', change: '+ 62%', tone: 'good' },
      { label: 'Remaining', value: '$45,180', change: '+ 38%', tone: 'good' },
      { label: 'Forecast (EOM)', value: '$118,200', change: '+ 98% of budget', tone: 'good' },
    ],
  },
  {
    key: 'procurement',
    short: 'Procurement',
    title: 'Procurement',
    copy: 'Manage cloud procurement requests and approvals.',
    icon: 'lucide:shopping-cart',
    action: 'New Request',
    actionIcon: 'lucide:plus',
    metrics: [
      { label: 'Total Requests', value: '18', change: '', tone: '' },
      { label: 'Pending', value: '7', change: '', tone: 'warn' },
      { label: 'Approved', value: '8', change: '', tone: 'good' },
      { label: 'Rejected', value: '2', change: '', tone: 'bad' },
      { label: 'In Progress', value: '1', change: '', tone: 'warn' },
    ],
    columns: ['Request', 'Type', 'Requester', 'Status', 'Est. Cost (MTD)', 'Created'],
    rows: [
      ['AWS m5.xlarge (2)', 'Compute', 'Ali Tahir', 'Pending', '$1,240', 'May 20'],
      ['S3 Storage 1TB', 'Storage', 'Rida Khan', 'Approved', '$500', 'May 19'],
      ['GCP n4-standard-4', 'Compute', 'Maryam Rehan', 'Pending', '$640', 'May 19'],
      ['RDS PostgreSQL', 'Database', 'Bilal Qureshi', 'Approved', '$450', 'May 18'],
      ['Load Balancer', 'Networking', 'Usman Ali', 'In Progress', '$150', 'May 17'],
    ],
    secondary: {
      title: 'Approval SLA',
      columns: ['Metric', 'Value'],
      rows: [['Avg. approval time', '1d 4h'], ['Pending > 3 days', '3'], ['Auto-approved', '4']],
    },
  },
  {
    key: 'usage-insights',
    short: 'Usage & Insights',
    title: 'Usage & Insights',
    copy: 'Deep dive into resource usage and cost optimization.',
    icon: 'lucide:chart-line',
    action: 'Create Report',
    actionIcon: 'lucide:file-plus',
    metrics: [
      { label: 'Total Usage (CPU hours)', value: '128,450', change: '+ 18% vs prev 30 days', tone: 'good' },
      { label: 'Storage (GB)', value: '42,890', change: '+ 12%', tone: 'good' },
      { label: 'Database (Hours)', value: '2,340', change: '+ 9%', tone: 'bad' },
      { label: 'Network (GB)', value: '18,760', change: '+ 22%', tone: 'good' },
    ],
  },
  {
    key: 'policies-controls',
    short: 'Policies & Controls',
    title: 'Policies & Controls',
    copy: 'Governance, policies, and compliance controls.',
    icon: 'lucide:shield-check',
    action: 'New Policy',
    actionIcon: 'lucide:plus',
    metrics: [
      { label: 'Total Policies', value: '24', change: '', tone: '' },
      { label: 'Active', value: '20', change: '+ 83%', tone: 'good' },
      { label: 'Violations', value: '3', change: '+ 9%', tone: 'bad' },
      { label: 'Exceptions', value: '1', change: '', tone: '' },
      { label: 'Last Scan', value: '5m ago', change: '', tone: '' },
    ],
    columns: ['Policy', 'Category', 'Status', 'Violations', 'Last Updated'],
    rows: [
      ['Max Sandbox Runtime (24h)', 'Guardrails', 'Active', '1', 'May 20, 2025'],
      ['Allowed Regions', 'Security', 'Active', '0', 'May 19, 2025'],
      ['Cost Budget Alert (80%)', 'Finance', 'Active', '1', 'May 19, 2025'],
      ['Public IP Restriction', 'Security', 'Active', '0', 'May 18, 2025'],
      ['Idle Resource Cleanup (7d)', 'Optimization', 'Active', '1', 'May 18, 2025'],
    ],
    secondary: {
      title: 'Recent Violations',
      columns: ['Violation', 'Workspace', 'Status'],
      rows: [['Sandbox runtime exceeded', 'Platform Team', 'Open'], ['Cost budget 80% threshold reached', 'Marketing', 'Acknowledged']],
    },
  },
  {
    key: 'activity',
    short: 'Activity',
    title: 'Activity',
    copy: 'Organization-wide activity and events.',
    icon: 'lucide:activity',
    action: 'Export',
    actionIcon: 'lucide:download',
    metrics: [
      { label: 'Events', value: '1,842', change: '+ 16%', tone: 'good' },
      { label: 'Users', value: '48', change: '+ 9%', tone: 'good' },
      { label: 'Actions', value: '3,721', change: '+ 16%', tone: 'good' },
      { label: 'Errors', value: '12', change: '- 40%', tone: 'bad' },
      { label: 'Audits', value: '186', change: '+ 21%', tone: 'good' },
    ],
    columns: ['Time', 'User', 'Event', 'Workspace', 'Type'],
    rows: [
      ['May 20, 2025, 2:14 PM', 'Ali Tahir', 'Created sandbox dev-sb-01', 'Platform Team', 'Create'],
      ['May 20, 2025, 1:52 PM', 'Rida Khan', 'Requested cloud resources', 'Data Science', 'Request'],
      ['May 20, 2025, 12:31 PM', 'Maryam Rehan', 'Approved access to Agents', 'Research Ops', 'Approval'],
      ['May 20, 2025, 10:08 AM', 'System', 'Budget alert triggered (80%)', 'Platform Team', 'Alert'],
      ['May 20, 2025, 9:45 AM', 'Bilal Qureshi', 'Launched Daytona sandbox', 'Content Ops', 'Create'],
    ],
    secondary: {
      title: 'Top Users (7 days)',
      columns: ['User', 'Events'],
      rows: [['Ali Tahir', '542'], ['Rida Khan', '438'], ['Maryam Rehan', '386'], ['Bilal Qureshi', '298'], ['Sana Ahmed', '221']],
    },
  },
]

const activeStatic = computed(() => modules.find((module) => module.key === route.params.module) || modules[0])

const orgName = computed(() => orgStore.org?.name || 'Organization')

// Static display data for the Cloud Resources module (no backend yet — kept as the
// original designed UI). Replace with live data once a cloud-inventory API exists.
const resourceTypes = [
  { name: 'Compute', value: '42 (20%)', tone: 'blue-dot' },
  { name: 'Storage', value: '128 (60%)', tone: 'green-dot' },
  { name: 'Database', value: '18 (8%)', tone: 'orange-dot' },
  { name: 'Networking', value: '9 (4%)', tone: 'red-dot' },
  { name: 'Load Balancers', value: '9 (4%)', tone: 'violet-dot' },
]
const regions = [
  { name: 'US-East', value: '96 (45%)', percent: '96%' },
  { name: 'US-West', value: '48 (22%)', percent: '48%' },
  { name: 'EU-West', value: '32 (15%)', percent: '32%' },
  { name: 'AP-South', value: '24 (11%)', percent: '24%' },
]

// ── Live data ───────────────────────────────────────────────────────────────
const DOT = ['blue-dot', 'green-dot', 'orange-dot', 'violet-dot', 'red-dot', 'slate-dot']
const usd = (v) => (v == null ? '—' : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
const titleCase = (s = '') => s.charAt(0).toUpperCase() + s.slice(1)

const loading = ref(false)
const liveMetrics = ref(null)
const liveColumns = ref(null)
const liveRows = ref(null)
const liveSecondary = ref(null)
const budgetOwners = ref([])
const serviceCosts = ref([])
const opportunities = ref([])
const byDay = ref([])
const donutTotal = ref('—')

// Activity pagination (50/page).
const activityPage = ref(1)
const activityTotalPages = ref(1)
const activityTotal = ref(0)

// Build an SVG line + area path (viewBox 0..760 x 0..220) from the live by_day series.
const trend = computed(() => {
  const pts = byDay.value
  if (!pts.length) return null
  const costs = pts.map((p) => Number(p.cost || 0))
  const max = Math.max(1, ...costs)
  const stepX = pts.length > 1 ? 760 / (pts.length - 1) : 760
  const coords = costs.map((c, i) => {
    const x = Math.round(i * stepX)
    const y = Math.round(210 - (c / max) * 190)
    return [x, y]
  })
  const line = coords.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ')
  const area = `${line} L760 220 L0 220Z`
  const financeMax = Math.max(40000, max * 1.2)
  const financeStepX = pts.length > 1 ? 462 / (pts.length - 1) : 462
  const financeCoords = costs.map((c, i) => {
    const x = Math.round(58 + i * financeStepX)
    const y = Math.round(196 - (c / financeMax) * 160)
    return [x, y]
  })
  const financeLine = financeCoords.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ')
  const last = financeCoords[financeCoords.length - 1]
  const prev = financeCoords[Math.max(0, financeCoords.length - 2)]
  const slope = last && prev ? last[1] - prev[1] : 0
  const forecastY = Math.max(36, Math.min(196, Math.round((last?.[1] || 116) + slope * .55)))
  const financeForecast = last ? `M${last[0]} ${last[1]} L560 ${forecastY}` : ''
  const financeArea = `${financeLine} L${last?.[0] || 520} 196 L58 196Z`
  const actual = costs[costs.length - 1] || 0
  const forecast = Math.max(actual, actual * 1.58)
  const budget = Math.max(120000, forecast)
  return {
    line,
    area,
    financeLine,
    financeArea,
    financeForecast,
    actualLabel: usd(actual),
    forecastLabel: usd(forecast),
    budgetLabel: usd(budget),
  }
})

// Modules connected to a backend. The rest keep their original designed UI (static).
const LIVE_KEYS = ['workspaces', 'activity', 'budgets-finance', 'usage-insights']

// The view the template renders. For live modules we DON'T fall back to the static
// mock while loading — that caused a flash of fake data on refresh; we show empty
// (real-but-not-loaded-yet) instead. Static modules keep their designed mock UI.
const active = computed(() => {
  const base = activeStatic.value
  const isLive = LIVE_KEYS.includes(base.key)
  return {
    ...base,
    metrics: liveMetrics.value || (isLive ? [] : base.metrics),
    columns: liveColumns.value || (isLive ? [] : base.columns),
    rows: liveRows.value || (isLive ? [] : base.rows),
    secondary: liveSecondary.value !== null ? liveSecondary.value : (isLive ? null : base.secondary),
  }
})

function resetLive() {
  liveMetrics.value = null
  liveColumns.value = null
  liveRows.value = null
  liveSecondary.value = null
  budgetOwners.value = []
  serviceCosts.value = []
  opportunities.value = []
  byDay.value = []
  donutTotal.value = '—'
}

function fmtTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

async function loadModule() {
  resetLive()
  const key = activeStatic.value.key
  if (!LIVE_KEYS.includes(key)) return   // static-design modules: nothing to fetch
  const slug = await orgStore.resolveOrgSlug()
  if (!slug) return
  loading.value = true
  try {
    if (key === 'workspaces') {
      const { data } = await tenancyApi.getOrgOverview(slug)
      const ws = data.workspaces || []
      liveColumns.value = ['Workspace', 'Owner', 'Members', 'Agents', 'Budget Used', 'Status']
      liveRows.value = ws.map((w) => [
        w.name, w.owner || '—', String(w.members ?? 0), String(w.agents ?? 0),
        w.budget_used_pct == null ? '—' : `${Math.round(w.budget_used_pct)}%`, 'Active',
      ])
      const m = data.metrics || {}
      liveMetrics.value = [
        { label: 'Total Workspaces', value: String(m.workspaces ?? 0), change: '', tone: '' },
        { label: 'Members', value: String(m.members ?? 0), change: '', tone: 'good' },
        { label: 'Agents', value: String(m.agents ?? 0), change: '', tone: 'good' },
        { label: 'Monthly Spend', value: usd(m.monthly_spend_usd), change: '', tone: '' },
      ]
    } else if (key === 'activity') {
      const { data } = await tenancyApi.getOrgActivity(slug, { days: 30, page: activityPage.value, page_size: 50 })
      const events = data.events || []
      activityTotalPages.value = data.total_pages || 1
      activityTotal.value = data.total ?? events.length
      liveColumns.value = ['Time', 'User', 'Event', 'Workspace', 'Outcome']
      liveRows.value = events.map((e) => [
        fmtTime(e.created_at), e.username || 'System',
        (e.action || '').replace(/_/g, ' '), e.workspace ? `#${e.workspace}` : '—', titleCase(e.outcome || ''),
      ])
      liveSecondary.value = {
        title: 'Top Users (30 days)',
        columns: ['User', 'Events'],
        rows: (data.top_users || []).map((u) => [u.user, String(u.events)]),
      }
      liveMetrics.value = [
        { label: 'Events (30d)', value: String(activityTotal.value), change: '', tone: '' },
        { label: 'Active Users', value: String((data.top_users || []).length), change: '', tone: 'good' },
        { label: 'Denied (page)', value: String(events.filter((e) => e.outcome === 'denied').length), change: '', tone: 'bad' },
      ]
    } else if (key === 'budgets-finance' || key === 'usage-insights') {
      const { data } = await api.getBudgetsSummary()
      const m = data.metrics || {}
      const byProvider = data.by_provider || {}
      const byAgent = data.by_agent || {}
      const scopes = data.scopes || []
      byDay.value = data.by_day || []
      donutTotal.value = usd(m.current_spend)
      // Spend by scope → the "owners" bar list.
      const scopeMax = Math.max(1, ...scopes.map((s) => Number(s.spent || 0)))
      budgetOwners.value = scopes.slice(0, 6).map((s) => ({
        name: s.name || titleCase(s.scope_type),
        value: usd(s.spent),
        share: s.percent == null ? '—' : `${Math.round(s.percent)}%`,
        percent: `${Math.round((Number(s.spent || 0) / scopeMax) * 100)}%`,
      }))
      const provEntries = Object.entries(byProvider).map(([k, v]) => ({ name: titleCase(k), cost: Number(v.cost || 0) }))
        .sort((a, b) => b.cost - a.cost)
      const provTotal = provEntries.reduce((t, e) => t + e.cost, 0) || 1
      serviceCosts.value = provEntries.slice(0, 6).map((e, i) => ({
        name: e.name, value: `${Math.round((e.cost / provTotal) * 100)}%`, tone: DOT[i % DOT.length],
      }))
      opportunities.value = Object.entries(byAgent).map(([id, v]) => ({ name: `Agent ${id}`, value: usd(v.cost) }))
        .sort((a, b) => 0).slice(0, 5)
      if (key === 'budgets-finance') {
        liveMetrics.value = [
          { label: 'Current Spend', value: usd(m.current_spend), change: '', tone: '' },
          { label: 'Monthly Budget', value: m.monthly_limit == null ? 'No cap' : usd(m.monthly_limit), change: '', tone: 'good' },
          { label: 'Remaining', value: m.remaining == null ? '—' : usd(m.remaining), change: '', tone: 'good' },
          { label: 'Used', value: m.percent == null ? '—' : `${Math.round(m.percent)}%`, change: '', tone: '' },
        ]
      } else {
        liveMetrics.value = [
          { label: 'Spend (this month)', value: usd(m.current_spend), change: '', tone: '' },
          { label: 'Providers', value: String(provEntries.length), change: '', tone: 'good' },
          { label: 'Agents tracked', value: String(Object.keys(byAgent).length), change: '', tone: 'good' },
        ]
      }
    }
  } catch (e) {
    /* keep static fallback on error */
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (!orgStore.loaded) orgStore.load()   // populates org name for the breadcrumb
  loadModule()
})
watch(() => route.params.module, () => { activityPage.value = 1; loadModule() })

async function changeActivityPage(delta) {
  const next = activityPage.value + delta
  if (next < 1 || next > activityTotalPages.value || loading.value) return
  activityPage.value = next
  await loadModule()
}

function exportActivity() {
  orgStore.resolveOrgSlug().then((slug) => {
    if (slug) window.open(`/api/v2/orgs/${slug}/activity/?export=csv`, '_blank')
  })
}

// Primary header action. Budgets routes to the real budgets page; other modules
// keep the original (non-wired) button for now.
function onAction() {
  if (activeStatic.value.key === 'budgets-finance') router.push('/dashboard/budgets')
}
</script>

<script>
import { h } from 'vue'

// Status words we badge-style. NOTE: this component uses a render function (not a
// `template:` string) on purpose — Vite ships the runtime-only Vue build with no
// template compiler, so string templates silently render nothing.
const STATUS_RE = /^(Active|Running|Approved|Pending|Paused|Stopped|Archived|Open|Acknowledged|Denied|Allowed)$/i

export default {
  components: {
    DataTable: {
      props: { columns: Array, rows: Array },
      render() {
        const cols = this.columns || []
        const rows = this.rows || []
        const head = h('thead', [
          h('tr', [...cols.map((c) => h('th', String(c))), h('th')]),
        ])
        const body = h('tbody',
          rows.length
            ? rows.map((row) =>
                h('tr', [
                  ...(row || []).map((cell) => {
                    const s = cell == null ? '' : String(cell)
                    const isStatus = STATUS_RE.test(s)
                    return h('td', [
                      isStatus
                        ? h('span', { class: ['status', s.toLowerCase().replace(/\s+/g, '-')] }, s)
                        : s,
                    ])
                  }),
                  h('td', [h('button', { class: 'more' }, '...')]),
                ])
              )
            : [h('tr', [h('td', { class: 'empty-row', colspan: cols.length + 1 }, 'No data yet.')])]
        )
        return h('div', { class: 'data-table' }, [h('table', [head, body])])
      },
    },
  },
}
</script>

<style scoped>
.org-module-page {
  min-height: 100%;
  padding: 24px 28px 42px;
  background: #f8fbff;
  color: #07152f;
}

.module-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 16px;
}

.crumbs {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #53657f;
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 8px;
}

.crumbs a {
  color: #53657f;
  text-decoration: none;
}

h1,
h2,
p {
  margin: 0;
}

h1 {
  font-size: 24px;
  line-height: 1.15;
  font-weight: 850;
  letter-spacing: 0;
}

.module-head p {
  margin-top: 6px;
  color: #53657f;
  font-size: 13px;
  font-weight: 500;
}

.module-actions,
.module-tabs,
.table-tools {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ghost,
.primary,
.icon-btn {
  height: 38px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 14px;
  font-size: 12px;
  font-weight: 800;
  text-decoration: none;
  cursor: pointer;
}

.ghost,
.icon-btn {
  border: 1px solid #d9e3f0;
  background: #fff;
  color: #0f172a;
}

.primary {
  border: 0;
  background: #3156e9;
  color: #fff;
  box-shadow: 0 12px 22px rgba(49, 86, 233, .18);
}

.module-tabs {
  flex-wrap: wrap;
  margin-bottom: 14px;
  border-bottom: 1px solid #dfe7f2;
}

.module-tabs a {
  height: 42px;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #53657f;
  border-bottom: 2px solid transparent;
  text-decoration: none;
  font-size: 12px;
  font-weight: 800;
}

.module-tabs a.active {
  color: #3156e9;
  border-bottom-color: #3156e9;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}

.metric-card,
.panel {
  border: 1px solid #dfe7f2;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 8px 22px rgba(15, 23, 42, .03);
}

.metric-card {
  min-height: 100px;
  padding: 18px;
}

.metric-card span {
  color: #64748b;
  font-size: 11px;
  font-weight: 850;
}

.metric-card strong {
  display: block;
  margin-top: 14px;
  color: #07152f;
  font-size: 22px;
  line-height: 1;
  font-weight: 850;
}

.metric-card small {
  display: block;
  margin-top: 10px;
  color: #64748b;
  font-size: 11px;
  font-weight: 750;
}

.metric-card small.good { color: #059669; }
.metric-card small.bad { color: #ef4444; }
.metric-card small.warn { color: #f59e0b; }

.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, .55fr);
  gap: 16px;
}

.content-grid.single {
  grid-template-columns: 1fr;
}

.content-grid.finance {
  grid-template-columns: minmax(0, 1.6fr) minmax(280px, .7fr) minmax(280px, .7fr);
}

.panel {
  padding: 16px;
  min-width: 0;
}

.panel.wide,
.trend-panel {
  grid-column: span 2;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

h2 {
  font-size: 14px;
  line-height: 1.2;
  font-weight: 850;
}

.panel-head button,
.link {
  border: 0;
  background: transparent;
  color: #3156e9;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  text-decoration: none;
  font-size: 12px;
  font-weight: 850;
}

.table-tools {
  margin-bottom: 14px;
}

.search {
  width: min(340px, 38vw);
  height: 36px;
  border: 1px solid #d9e3f0;
  border-radius: 8px;
  background: #fff;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  color: #8090aa;
}

.search input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  color: #0f172a;
  font-size: 12px;
  font-weight: 650;
}

select {
  height: 36px;
  border: 1px solid #d9e3f0;
  border-radius: 8px;
  background: #fff;
  color: #0f172a;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 750;
}

.icon-btn {
  width: 36px;
  padding: 0;
}

:deep(.data-table) {
  overflow-x: auto;
}

:deep(table) {
  width: 100%;
  min-width: 760px;
  border-collapse: collapse;
}

:deep(th),
:deep(td) {
  height: 42px;
  padding: 0 12px;
  border-bottom: 1px solid #e8eef7;
  text-align: left;
  white-space: nowrap;
}

:deep(th) {
  color: #64748b;
  font-size: 10px;
  font-weight: 850;
  text-transform: uppercase;
  letter-spacing: .04em;
}

:deep(td) {
  color: #334155;
  font-size: 11px;
  font-weight: 700;
}

:deep(.status) {
  min-width: 56px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #059669;
  background: #dcfce7;
  font-size: 10px;
  font-weight: 850;
}

:deep(.status.pending),
:deep(.status.paused),
:deep(.status.idle),
:deep(.status.in-progress) {
  color: #d97706;
  background: #ffedd5;
}

:deep(.status.rejected),
:deep(.status.open),
:deep(.status.stopped),
:deep(.status.archived) {
  color: #ef4444;
  background: #fee2e2;
}

:deep(.more) {
  border: 0;
  background: transparent;
  color: #64748b;
  font-weight: 900;
}

.donut-row {
  display: grid;
  grid-template-columns: 160px 1fr;
  align-items: center;
  gap: 18px;
  margin-top: 18px;
}

.donut-row.compact {
  grid-template-columns: 132px 1fr;
}

.donut {
  width: 142px;
  height: 142px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  text-align: center;
  background: conic-gradient(#3156e9 0 45%, #16b981 45% 68%, #f59e0b 68% 82%, #8b5cf6 82% 94%, #cbd5e1 94%);
  position: relative;
}

.donut::before {
  content: "";
  position: absolute;
  inset: 28px;
  border-radius: inherit;
  background: #fff;
}

.donut strong {
  position: relative;
  font-size: 13px;
  line-height: 1.25;
  font-weight: 850;
}

.donut-row ul,
.opportunity-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 10px;
}

.donut-row li {
  display: grid;
  grid-template-columns: 10px 1fr auto;
  align-items: center;
  gap: 8px;
  color: #334155;
  font-size: 11px;
  font-weight: 750;
}

.donut-row i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.blue-dot { background: #3156e9; }
.green-dot { background: #16b981; }
.orange-dot { background: #f59e0b; }
.red-dot { background: #ef4444; }
.violet-dot { background: #8b5cf6; }
.slate-dot { background: #94a3b8; }

.bar-row {
  display: grid;
  grid-template-columns: 120px 1fr 86px;
  gap: 10px;
  align-items: center;
  margin-top: 16px;
  color: #334155;
  font-size: 11px;
  font-weight: 750;
}

.bar-row div {
  height: 5px;
  border-radius: 999px;
  background: #e8eef7;
  overflow: hidden;
}

.bar-row i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #3156e9;
}

.trend-panel svg {
  width: 100%;
  height: 250px;
  margin-top: 10px;
}

.gridline {
  fill: none;
  stroke: #e8eef7;
  stroke-width: 1;
}

.trend-area {
  fill: rgba(49, 86, 233, .08);
}

.trend-line {
  fill: none;
  stroke: #3156e9;
  stroke-width: 3;
}

.trend-line.purple { stroke: #6d5dfc; }
.trend-line.green { stroke: #16b981; }
.trend-line.amber { stroke: #f59e0b; }

.opportunity-list li {
  display: grid;
  grid-template-columns: 18px 1fr auto;
  gap: 8px;
  color: #334155;
  font-size: 12px;
  font-weight: 750;
}

.opportunity-list svg {
  color: #64748b;
}

@media (max-width: 1200px) {
  .metric-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .content-grid,
  .content-grid.finance {
    grid-template-columns: 1fr;
  }

  .panel.wide,
  .trend-panel {
    grid-column: auto;
  }
}

@media (max-width: 760px) {
  .org-module-page {
    padding: 18px 14px 36px;
  }

  .module-head,
  .module-actions,
  .table-tools {
    align-items: stretch;
    flex-direction: column;
  }

  .metric-grid {
    grid-template-columns: 1fr;
  }

  .search {
    width: 100%;
  }
}

/* ── Live-data helpers ────────────────────────────────────────────────────── */
.placeholder-wrap {
  display: grid;
  place-items: center;
  min-height: 360px;
}
.placeholder-card {
  display: grid;
  justify-items: center;
  text-align: center;
  gap: 8px;
  max-width: 460px;
  padding: 40px 28px;
  border: 1px solid #dfe7f2;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04);
}
.placeholder-card svg {
  width: 34px;
  height: 34px;
  color: #b8c4d6;
}
.placeholder-card h2 {
  font-size: 17px;
  font-weight: 750;
  color: #1e293b;
}
.placeholder-card p {
  font-size: 13px;
  line-height: 1.5;
  color: #64748b;
}
.placeholder-card .ghost {
  margin-top: 8px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 16px;
  border: 1px solid #d9e3f0;
  border-radius: 8px;
  background: #fff;
  color: #0f172a;
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
}
.muted-note {
  color: #94a3b8;
  font-size: 11px;
  font-weight: 550;
}
.data-table .empty-row {
  text-align: center;
  color: #94a3b8;
  font-weight: 550;
  padding: 22px 0;
}
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid #eef3f8;
}
.pager > span {
  color: #64748b;
  font-size: 11.5px;
  font-weight: 600;
}
.pager-btns {
  display: flex;
  gap: 8px;
}
.pager-btns button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid #d9e3f0;
  border-radius: 8px;
  background: #fff;
  color: #334155;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
}
.pager-btns button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.pager-btns button svg {
  width: 14px;
  height: 14px;
}

/* Screen 39 admin-module polish: shared proportions for every organization module. */
.org-module-page {
  padding: 22px 28px 36px !important;
  background: #f8fbff !important;
}

.module-head {
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) max-content;
  align-items: start !important;
  gap: 18px !important;
  margin-bottom: 14px !important;
}

.module-head > div:first-child {
  min-width: 0;
}

.crumbs {
  gap: 10px !important;
  margin-bottom: 8px !important;
  color: #53657f !important;
  font-size: 11px !important;
  line-height: 1.2 !important;
  font-weight: 700 !important;
}

.crumbs strong {
  color: #07152f;
}

.module-head h1 {
  font-size: 24px !important;
  line-height: 1.12 !important;
  font-weight: 850 !important;
  letter-spacing: 0 !important;
}

.module-head p {
  max-width: 620px;
  margin-top: 6px !important;
  font-size: 12px !important;
  line-height: 1.45 !important;
  color: #53657f !important;
}

.module-actions {
  justify-content: flex-end;
  flex-wrap: nowrap;
  gap: 10px !important;
}

.module-actions .ghost,
.module-actions .primary {
  height: 36px !important;
  min-width: 112px;
  padding: 0 14px !important;
  border-radius: 8px !important;
  font-size: 11.5px !important;
  line-height: 1 !important;
  font-weight: 800 !important;
  white-space: nowrap;
}

.module-actions svg {
  width: 14px;
  height: 14px;
}

.module-tabs {
  height: 42px;
  flex-wrap: nowrap !important;
  gap: 20px !important;
  overflow-x: auto;
  margin-bottom: 14px !important;
  scrollbar-width: none;
}

.module-tabs::-webkit-scrollbar {
  display: none;
}

.module-tabs a {
  flex: 0 0 auto;
  height: 42px !important;
  padding: 0 2px !important;
  font-size: 11.5px !important;
  line-height: 1 !important;
  font-weight: 850 !important;
}

.module-tabs svg {
  width: 14px;
  height: 14px;
}

.metric-grid {
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)) !important;
  gap: 14px !important;
  margin-bottom: 14px !important;
}

.metric-card {
  min-height: 92px !important;
  padding: 18px 18px 16px !important;
  border-radius: 10px !important;
}

.metric-card span {
  display: block;
  color: #60718f !important;
  font-size: 10.5px !important;
  line-height: 1.2 !important;
  font-weight: 850 !important;
  text-transform: uppercase;
}

.metric-card strong {
  margin-top: 13px !important;
  font-size: 22px !important;
  line-height: 1 !important;
  font-weight: 850 !important;
}

.metric-card small {
  min-height: 13px;
  margin-top: 9px !important;
  font-size: 10.5px !important;
  line-height: 1.2 !important;
  font-weight: 750 !important;
}

.content-grid {
  gap: 14px !important;
}

.content-grid:not(.single):not(.finance) {
  grid-template-columns: minmax(0, .92fr) minmax(280px, .58fr) !important;
}

.content-grid.finance {
  grid-template-columns: minmax(0, 1.44fr) minmax(280px, .78fr) minmax(280px, .78fr) !important;
}

.content-grid.single {
  grid-template-columns: minmax(0, 1fr) !important;
}

.panel {
  padding: 16px !important;
  border-radius: 10px !important;
  overflow: hidden;
}

.panel-head {
  margin-bottom: 12px !important;
}

.panel h2,
.panel-head h2 {
  font-size: 13.5px !important;
  line-height: 1.2 !important;
  font-weight: 850 !important;
}

.table-tools {
  display: grid !important;
  grid-template-columns: minmax(220px, 1fr) repeat(3, max-content);
  gap: 10px !important;
  align-items: center !important;
  margin-bottom: 14px !important;
}

.search {
  width: 100% !important;
  max-width: 420px;
  height: 36px !important;
}

.table-tools select,
.table-tools .icon-btn {
  height: 36px !important;
  border-radius: 8px !important;
  font-size: 11.5px !important;
}

:deep(.data-table) {
  border: 1px solid #e3eaf4;
  border-radius: 9px;
  overflow-x: auto;
  background: #fff;
}

:deep(.data-table table) {
  min-width: 0 !important;
  width: 100%;
  table-layout: fixed;
}

:deep(.data-table th),
:deep(.data-table td) {
  height: 42px !important;
  padding: 0 12px !important;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: middle;
}

:deep(.data-table th) {
  background: #f8fafc;
  color: #64748b !important;
  font-size: 9.75px !important;
  line-height: 1.15 !important;
  font-weight: 850 !important;
  letter-spacing: .035em !important;
}

:deep(.data-table td) {
  color: #334155 !important;
  font-size: 10.75px !important;
  line-height: 1.2 !important;
  font-weight: 700 !important;
}

:deep(.data-table td:first-child) {
  color: #07152f !important;
  font-weight: 850 !important;
}

:deep(.data-table th:last-child),
:deep(.data-table td:last-child) {
  width: 38px;
  padding-right: 8px !important;
  text-align: center;
}

.org-module-page--workspaces :deep(.data-table th:nth-child(1)),
.org-module-page--workspaces :deep(.data-table td:nth-child(1)) {
  width: 23%;
}

.org-module-page--workspaces :deep(.data-table th:nth-child(2)),
.org-module-page--workspaces :deep(.data-table td:nth-child(2)) {
  width: 20%;
}

.org-module-page--workspaces :deep(.data-table th:nth-child(3)),
.org-module-page--workspaces :deep(.data-table td:nth-child(3)),
.org-module-page--workspaces :deep(.data-table th:nth-child(4)),
.org-module-page--workspaces :deep(.data-table td:nth-child(4)) {
  width: 8%;
}

.org-module-page--workspaces :deep(.data-table th:nth-child(5)),
.org-module-page--workspaces :deep(.data-table td:nth-child(5)) {
  width: 15%;
}

.org-module-page--workspaces :deep(.data-table th:nth-child(6)),
.org-module-page--workspaces :deep(.data-table td:nth-child(6)) {
  width: 14%;
}

:deep(.status) {
  min-width: 58px !important;
  height: 22px !important;
  font-size: 9.75px !important;
  font-weight: 850 !important;
}

:deep(.more) {
  width: 26px;
  height: 26px;
  border-radius: 7px;
}

.donut-row {
  grid-template-columns: 132px minmax(0, 1fr) !important;
  gap: 16px !important;
}

.donut {
  width: 124px !important;
  height: 124px !important;
}

.donut::before {
  inset: 24px !important;
}

.donut-row li,
.bar-row {
  font-size: 10.75px !important;
  line-height: 1.2 !important;
}

.bar-row {
  grid-template-columns: minmax(96px, 128px) minmax(0, 1fr) minmax(62px, auto) !important;
  gap: 9px !important;
  margin-top: 14px !important;
}

.trend-panel svg {
  height: 238px !important;
}

.opportunity-list li {
  grid-template-columns: 18px minmax(0, 1fr) auto !important;
  font-size: 11px !important;
}

.pager {
  margin-top: 12px !important;
  padding-top: 12px !important;
}

@media (max-width: 1320px) {
  .module-head {
    grid-template-columns: 1fr !important;
  }

  .module-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .content-grid,
  .content-grid.finance,
  .content-grid:not(.single):not(.finance) {
    grid-template-columns: 1fr !important;
  }

  .panel.wide,
  .trend-panel {
    grid-column: auto !important;
  }

  :deep(.data-table table) {
    min-width: 760px !important;
  }
}

@media (max-width: 760px) {
  .module-actions,
  .table-tools {
    display: flex !important;
    align-items: stretch !important;
    flex-direction: column !important;
  }

  .module-actions .ghost,
  .module-actions .primary {
    width: 100%;
  }

  .metric-grid {
    grid-template-columns: 1fr !important;
  }
}

/* Cloud Resources screen-39 variant */
.org-module-page--cloud-resources .metric-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.org-module-page--cloud-resources .metric-card {
  min-height: 100px !important;
  padding: 18px 18px !important;
}

.org-module-page--cloud-resources .metric-card strong {
  margin-top: 16px !important;
  font-size: 23px !important;
}

.sub-tabs {
  grid-column: 1 / -1;
  height: 40px;
  display: flex;
  align-items: flex-end;
  gap: 44px;
  border-bottom: 1px solid #dfe7f2;
  margin-bottom: 0;
}

.sub-tabs button {
  height: 40px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #31425f;
  padding: 0 0 10px;
  font-size: 11px;
  font-weight: 850;
  cursor: pointer;
}

.sub-tabs button.active {
  color: #3156e9;
  border-bottom-color: #3156e9;
}

.org-module-page--cloud-resources .content-grid {
  grid-template-columns: minmax(0, 1.72fr) minmax(260px, .74fr) !important;
  gap: 14px !important;
}

.org-module-page--cloud-resources .chart-card,
.org-module-page--cloud-resources .content-grid > .panel:nth-of-type(2) {
  min-height: 260px;
}

.org-module-page--cloud-resources .panel.wide {
  grid-column: 1 / -1 !important;
}

.org-module-page--cloud-resources .donut-row {
  grid-template-columns: 180px minmax(0, 1fr) !important;
  gap: 28px !important;
  margin-top: 22px !important;
}

.org-module-page--cloud-resources .donut {
  width: 168px !important;
  height: 168px !important;
}

.org-module-page--cloud-resources .donut::before {
  inset: 34px !important;
}

.org-module-page--cloud-resources .donut strong {
  font-size: 18px !important;
}

.org-module-page--cloud-resources .donut-row ul {
  gap: 15px !important;
}

.org-module-page--cloud-resources .donut-row li {
  grid-template-columns: 10px minmax(88px, 1fr) auto !important;
  font-size: 11px !important;
  font-weight: 800 !important;
}

.org-module-page--cloud-resources .bar-row {
  grid-template-columns: minmax(82px, 1fr) auto !important;
  margin-top: 22px !important;
  font-size: 12px !important;
}

.org-module-page--cloud-resources .bar-row div {
  display: none;
}

.org-module-page--cloud-resources .bar-row b {
  font-weight: 850;
}

.org-module-page--cloud-resources :deep(.data-table) {
  border: 0;
  border-radius: 0;
}

.org-module-page--cloud-resources :deep(.data-table table) {
  table-layout: fixed;
  min-width: 0 !important;
}

.org-module-page--cloud-resources :deep(.data-table th),
.org-module-page--cloud-resources :deep(.data-table td) {
  height: 46px !important;
  padding: 0 12px !important;
}

.org-module-page--cloud-resources :deep(.data-table th:nth-child(1)),
.org-module-page--cloud-resources :deep(.data-table td:nth-child(1)) {
  width: 22%;
}

.org-module-page--cloud-resources :deep(.data-table th:nth-child(2)),
.org-module-page--cloud-resources :deep(.data-table td:nth-child(2)),
.org-module-page--cloud-resources :deep(.data-table th:nth-child(3)),
.org-module-page--cloud-resources :deep(.data-table td:nth-child(3)),
.org-module-page--cloud-resources :deep(.data-table th:nth-child(4)),
.org-module-page--cloud-resources :deep(.data-table td:nth-child(4)) {
  width: 17%;
}

.org-module-page--cloud-resources :deep(.data-table th:nth-child(5)),
.org-module-page--cloud-resources :deep(.data-table td:nth-child(5)) {
  width: 13%;
}

.org-module-page--cloud-resources :deep(.data-table th:nth-child(6)),
.org-module-page--cloud-resources :deep(.data-table td:nth-child(6)) {
  width: 14%;
}

@media (max-width: 1200px) {
  .org-module-page--cloud-resources .content-grid {
    grid-template-columns: 1fr !important;
  }

  .sub-tabs {
    overflow-x: auto;
    gap: 28px;
  }
}

/* Sandboxes screen-39 variant */
.org-module-page--sandboxes .metric-grid {
  grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.org-module-page--sandboxes .metric-card {
  min-height: 98px !important;
  padding: 18px !important;
}

.org-module-page--sandboxes .metric-card strong {
  margin-top: 16px !important;
  font-size: 23px !important;
}

.org-module-page--sandboxes .content-grid.single {
  display: grid !important;
  grid-template-columns: minmax(0, 1.75fr) minmax(260px, .55fr) !important;
  gap: 14px !important;
}

.org-module-page--sandboxes .content-grid.single > .panel:first-child {
  grid-column: 1 / -1;
}

.org-module-page--sandboxes .content-grid.single > .panel:nth-of-type(2) {
  grid-column: 1 / 2;
}

.org-module-page--sandboxes .table-tools {
  grid-template-columns: minmax(220px, 1fr) repeat(4, max-content) !important;
}

.org-module-page--sandboxes .table-tools::before {
  content: "";
}

.org-module-page--sandboxes :deep(.data-table) {
  border: 0;
  border-radius: 0;
}

.org-module-page--sandboxes :deep(.data-table table) {
  table-layout: fixed;
  min-width: 0 !important;
}

.org-module-page--sandboxes :deep(.data-table th),
.org-module-page--sandboxes :deep(.data-table td) {
  height: 44px !important;
  padding: 0 10px !important;
}

.org-module-page--sandboxes :deep(.data-table th:nth-child(1)),
.org-module-page--sandboxes :deep(.data-table td:nth-child(1)) {
  width: 18%;
}

.org-module-page--sandboxes :deep(.data-table th:nth-child(2)),
.org-module-page--sandboxes :deep(.data-table td:nth-child(2)),
.org-module-page--sandboxes :deep(.data-table th:nth-child(3)),
.org-module-page--sandboxes :deep(.data-table td:nth-child(3)) {
  width: 15%;
}

.org-module-page--sandboxes :deep(.data-table th:nth-child(4)),
.org-module-page--sandboxes :deep(.data-table td:nth-child(4)) {
  width: 12%;
}

.org-module-page--sandboxes :deep(.data-table th:nth-child(5)),
.org-module-page--sandboxes :deep(.data-table td:nth-child(5)),
.org-module-page--sandboxes :deep(.data-table th:nth-child(6)),
.org-module-page--sandboxes :deep(.data-table td:nth-child(6)),
.org-module-page--sandboxes :deep(.data-table th:nth-child(7)),
.org-module-page--sandboxes :deep(.data-table td:nth-child(7)) {
  width: 11%;
}

.table-footer {
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 12px;
  color: #64748b;
  font-size: 11px;
  font-weight: 750;
}

.table-pager {
  display: flex;
  align-items: center;
  gap: 6px;
}

.table-pager button {
  min-width: 28px;
  height: 28px;
  border: 1px solid #d9e3f0;
  border-radius: 7px;
  background: #fff;
  color: #31425f;
  display: inline-grid;
  place-items: center;
  font-size: 11px;
  font-weight: 850;
}

.table-pager button.active {
  color: #fff;
  border-color: #3156e9;
  background: #3156e9;
}

.org-module-page--sandboxes .sandbox-usage-card {
  min-height: 230px;
}

.sandbox-chart {
  height: 160px;
  margin-top: 14px;
  border-radius: 8px;
  position: relative;
  background:
    linear-gradient(180deg, rgba(49, 86, 233, .1), rgba(49, 86, 233, 0)),
    url("data:image/svg+xml,%3Csvg width='420' height='150' viewBox='0 0 420 150' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 116 C30 120 44 100 70 106 C98 112 104 52 135 48 C168 44 165 92 196 84 C226 76 226 44 250 67 C274 91 283 62 306 70 C332 79 344 66 362 64 C386 62 392 25 420 22' fill='none' stroke='%233156e9' stroke-width='3'/%3E%3Ccircle cx='0' cy='116' r='3' fill='%23fff' stroke='%233156e9' stroke-width='2'/%3E%3Ccircle cx='135' cy='48' r='3' fill='%23fff' stroke='%233156e9' stroke-width='2'/%3E%3Ccircle cx='250' cy='67' r='3' fill='%23fff' stroke='%233156e9' stroke-width='2'/%3E%3Ccircle cx='420' cy='22' r='3' fill='%23fff' stroke='%233156e9' stroke-width='2'/%3E%3C/svg%3E") center / 100% 100% no-repeat;
}

.sandbox-chart span {
  position: absolute;
  top: 4px;
  left: 0;
  color: #64748b;
  font-size: 10px;
  font-weight: 750;
}

.org-module-page--sandboxes .content-grid.single > .panel:last-child :deep(.data-table) {
  border: 0;
}

.org-module-page--sandboxes .content-grid.single > .panel:last-child :deep(.data-table table) {
  min-width: 0 !important;
}

@media (max-width: 1200px) {
  .org-module-page--sandboxes .content-grid.single {
    grid-template-columns: 1fr !important;
  }

  .org-module-page--sandboxes .content-grid.single > .panel:nth-of-type(2) {
    grid-column: auto;
  }
}

/* Budgets & Finance screen-39 variant */
.org-module-page--budgets-finance .metric-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.org-module-page--budgets-finance .metric-card {
  min-height: 100px !important;
  padding: 18px !important;
}

.org-module-page--budgets-finance .metric-card strong {
  margin-top: 16px !important;
  font-size: 23px !important;
}

.org-module-page--budgets-finance .content-grid.finance {
  grid-template-columns: minmax(0, 1fr) minmax(300px, .58fr) !important;
  gap: 14px !important;
}

.org-module-page--budgets-finance .finance-tabs {
  grid-column: 1 / -1;
  margin-bottom: 0;
}

.org-module-page--budgets-finance .trend-panel {
  grid-column: 1 / -1 !important;
  min-height: 330px;
}

.org-module-page--budgets-finance .trend-panel .panel-head {
  margin-bottom: 6px !important;
}

.org-module-page--budgets-finance .trend-panel svg {
  height: 258px !important;
  margin-top: 0 !important;
}

.org-module-page--budgets-finance .trend-panel .muted-note {
  min-width: 92px;
  height: 30px;
  border: 1px solid #d9e3f0;
  border-radius: 8px;
  color: #31425f;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 850;
}

.org-module-page--budgets-finance .finance-trend-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 178px;
  gap: 18px;
  align-items: center;
  margin-top: 8px;
}

.org-module-page--budgets-finance .finance-trend-body svg {
  min-width: 0;
}

.org-module-page--budgets-finance .finance-trend-body text {
  fill: #6b7a95;
  font-size: 11px;
  font-weight: 750;
}

.org-module-page--budgets-finance .axis-line {
  fill: none;
  stroke: #dfe7f2;
  stroke-width: 1;
}

.org-module-page--budgets-finance .trend-area {
  fill: rgba(49, 86, 233, .075);
}

.org-module-page--budgets-finance .trend-line.finance-actual {
  stroke: #3156e9;
  stroke-width: 3.4;
}

.org-module-page--budgets-finance .trend-line.finance-forecast {
  stroke: #3156e9;
  stroke-width: 2.2;
  stroke-dasharray: 5 5;
  opacity: .75;
}

.org-module-page--budgets-finance .trend-line.finance-budget {
  stroke: #16b981;
  stroke-width: 0;
  opacity: 0;
}

.org-module-page--budgets-finance .finance-trend-legend {
  display: grid;
  gap: 18px;
  margin: 0;
  padding: 0 6px 0 0;
  list-style: none;
}

.org-module-page--budgets-finance .finance-trend-legend li {
  display: grid;
  grid-template-columns: 10px minmax(58px, 1fr) auto;
  align-items: center;
  gap: 8px;
  color: #40516d;
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
}

.org-module-page--budgets-finance .finance-trend-legend i {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #3156e9;
}

.org-module-page--budgets-finance .finance-trend-legend i.forecast {
  background: #7c6ff6;
}

.org-module-page--budgets-finance .finance-trend-legend i.budget {
  background: #16b981;
}

.org-module-page--budgets-finance .finance-trend-legend b {
  color: #061735;
  font-weight: 900;
}

.org-module-page--budgets-finance .content-grid.finance > .panel:nth-of-type(2),
.org-module-page--budgets-finance .content-grid.finance > .panel:nth-of-type(3) {
  min-height: 280px;
}

.org-module-page--budgets-finance .bar-row {
  grid-template-columns: minmax(104px, 1fr) minmax(100px, 1.1fr) minmax(92px, auto) !important;
  margin-top: 18px !important;
  font-size: 11px !important;
}

.org-module-page--budgets-finance .bar-row div {
  height: 6px !important;
}

.org-module-page--budgets-finance .link {
  margin-top: 18px;
}

.org-module-page--budgets-finance .donut-row.compact {
  grid-template-columns: 160px minmax(0, 1fr) !important;
  gap: 20px !important;
  margin-top: 24px !important;
}

.org-module-page--budgets-finance .donut {
  width: 150px !important;
  height: 150px !important;
}

.org-module-page--budgets-finance .donut::before {
  inset: 30px !important;
}

.org-module-page--budgets-finance .donut strong {
  font-size: 14px !important;
}

.org-module-page--budgets-finance .donut-row ul {
  gap: 14px !important;
}

.org-module-page--budgets-finance .donut-row li {
  grid-template-columns: 10px minmax(82px, 1fr) auto !important;
  font-size: 10.75px !important;
}

@media (max-width: 1200px) {
  .org-module-page--budgets-finance .content-grid.finance {
    grid-template-columns: 1fr !important;
  }
}
</style>
