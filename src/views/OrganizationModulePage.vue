<template>
  <main class="org-module-page" :class="`org-module-page--${active.key}`">
    <header class="module-head">
      <div>
        <h1>{{ active.title }}</h1>
        <p>{{ active.copy }}</p>
      </div>
      <div class="module-actions">
        <RouterLink class="ghost" to="/dashboard/organization">
          <Icon icon="lucide:arrow-left" />
          Overview
        </RouterLink>
        <button class="ghost" @click="exportActivity"><Icon icon="lucide:download" /> Export</button>
        <button v-if="actionRoute" class="primary" @click="onAction"><Icon :icon="active.actionIcon" /> {{ active.action }}</button>
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
          <div class="search"><Icon icon="lucide:search" /><input v-model="wsSearch" placeholder="Search workspaces..." /></div>
          <select><option>All Status</option></select>
          <select><option>All Owners</option></select>
          <button class="icon-btn"><Icon icon="lucide:layout-grid" /></button>
        </div>
        <div class="data-table">
          <table>
            <thead>
              <tr>
                <th>Workspace</th><th>Owner</th><th>Members</th><th>Agents</th><th>Budget Used</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="w in filteredWorkspaces" :key="w.id">
                <td>{{ w.name }}</td>
                <td>{{ w.owner }}</td>
                <td>{{ w.members }}</td>
                <td>{{ w.agents }}</td>
                <td>{{ w.budgetLabel }}</td>
                <td><span class="status active">Active</span></td>
                <td class="ws-actions-cell">
                  <button class="more" @click.stop="toggleRowMenu(w, $event)">...</button>
                </td>
              </tr>
              <tr v-if="!filteredWorkspaces.length">
                <td colspan="7" class="empty-row">{{ loading ? 'Loading…' : 'No workspaces yet.' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </section>

    <section v-else-if="active.empty" class="placeholder-wrap">
      <article class="placeholder-card">
        <Icon :icon="active.icon" />
        <h2>No data yet</h2>
        <p>{{ active.empty }}</p>
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
      <article v-if="active.secondary" class="panel">
        <header class="panel-head"><h2>{{ active.secondary.title }}</h2></header>
        <DataTable :columns="active.secondary.columns" :rows="active.secondary.rows" />
      </article>
    </section>

    <!-- Row action menu (teleported so the table's overflow can't clip it) -->
    <Teleport to="body">
      <div v-if="menuOpenId !== null" class="menu-backdrop" @click="closeRowMenu" />
      <div v-if="menuOpenId !== null && menuWs" class="row-menu-fixed" :style="{ top: menuPos.top + 'px', left: menuPos.left + 'px' }">
        <button @click="openWorkspaceSettings(menuWs)"><Icon icon="lucide:settings" /> Settings &amp; guardrails</button>
        <button @click="openMembers(menuWs)"><Icon icon="lucide:users" /> Manage members</button>
        <button @click="openRename(menuWs)"><Icon icon="lucide:pencil" /> Rename</button>
        <button class="danger" @click="deleteWorkspace(menuWs)"><Icon icon="lucide:trash-2" /> Delete</button>
      </div>
    </Teleport>

    <!-- Rename workspace modal -->
    <Teleport to="body">
      <transition name="orgmod-modal">
        <div v-if="renameModal.open" class="orgmod-backdrop" @click.self="renameModal.open = false">
          <div class="orgmod-modal" role="dialog" aria-modal="true">
            <h3>Rename Workspace</h3>
            <div class="form-row">
              <label>Name</label>
              <input v-model="renameModal.name" @keydown.enter="submitRename" />
            </div>
            <div class="modal-actions">
              <button class="btn-cancel" @click="renameModal.open = false">Cancel</button>
              <button class="btn-primary" :disabled="renameModal.busy || !renameModal.name.trim()" @click="submitRename">
                {{ renameModal.busy ? 'Saving…' : 'Save' }}
              </button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- Manage workspace members modal -->
    <Teleport to="body">
      <transition name="orgmod-modal">
        <div v-if="membersModal.open" class="orgmod-backdrop" @click.self="membersModal.open = false">
          <div class="orgmod-modal wide" role="dialog" aria-modal="true">
            <h3>Members — {{ membersModal.ws?.name }}</h3>

            <div class="add-member-row">
              <select v-model="membersModal.addUserId">
                <option value="" disabled>Add an org member…</option>
                <option v-for="c in membersModal.candidates" :key="c.user" :value="c.user">
                  {{ c.username || c.email }}
                </option>
              </select>
              <select v-model="membersModal.addRole">
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </select>
              <button class="btn-primary" :disabled="membersModal.busy || !membersModal.addUserId" @click="addWsMember">Add</button>
            </div>
            <p v-if="!membersModal.candidates.length && !membersModal.loading" class="muted-note add-hint">
              Everyone in the org is already in this workspace. Invite new people to the org first (Overview → Invite Member).
            </p>

            <div class="members-list">
              <p v-if="membersModal.loading" class="muted-note">Loading…</p>
              <div v-for="m in membersModal.list" :key="m.id" class="member-row">
                <span class="member-name">{{ m.username || m.email }}</span>
                <span class="member-role">{{ m.role }}</span>
                <button class="link-danger" @click="removeWsMember(m)"><Icon icon="lucide:x" /></button>
              </div>
              <p v-if="!membersModal.loading && !membersModal.list.length" class="muted-note">No members yet.</p>
            </div>

            <div class="modal-actions">
              <button class="btn-cancel" @click="membersModal.open = false">Close</button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </main>
</template>

<script setup>
import { watchOwnRouteParam } from '@/composables/useOwnRouteParam'
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import tenancyApi from '../services/tenancyApi'
import api from '../services/api'
import { useOrganizationStore } from '../stores/useOrganizationStore'
import { setBreadcrumbLabel } from '@/composables/useBreadcrumbs'
import { notify } from '../composables/useNotify'
import { confirm } from '../composables/useConfirm'

const route = useRoute()
const router = useRouter()
const orgStore = useOrganizationStore()

// Modules connected to a backend fill their metrics and tables from it (loadModule).
// The others have no backend yet: they show `empty`, never made-up numbers.
const modules = [
  {
    key: 'workspaces',
    short: 'Workspaces',
    title: 'Workspaces',
    copy: 'Manage all workspaces in your organization.',
    icon: 'lucide:building-2',
    action: 'New Workspace',
    actionIcon: 'lucide:plus',
  },
  {
    key: 'cloud-resources',
    short: 'Cloud Resources',
    title: 'Cloud Resources',
    copy: 'All cloud resources provisioned across the organization.',
    icon: 'lucide:cloud',
    action: 'Request Resources',
    actionIcon: 'lucide:plus',
    empty: 'Cloud resources your workspaces provision will be listed here, with their type, region and monthly cost.',
  },
  {
    key: 'sandboxes',
    short: 'Sandboxes',
    title: 'Sandboxes (Daytona)',
    copy: 'Manage Daytona sandboxes across the organization.',
    icon: 'lucide:box',
    action: 'New Sandbox',
    actionIcon: 'lucide:plus',
    empty: 'Sandboxes started in your organization will be listed here, with their owner, status, uptime and cost.',
  },
  {
    key: 'budgets-finance',
    short: 'Budgets & Finance',
    title: 'Budgets & Finance',
    copy: 'Track budgets, spend, and financial health.',
    icon: 'lucide:wallet',
    action: 'Manage Budgets',
    actionIcon: 'lucide:settings',
  },
  {
    key: 'procurement',
    short: 'Procurement',
    title: 'Procurement',
    copy: 'Manage cloud procurement requests and approvals.',
    icon: 'lucide:shopping-cart',
    action: 'New Request',
    actionIcon: 'lucide:plus',
    empty: 'Requests for cloud resources will be listed here, with who asked, the estimated cost and whether they were approved.',
  },
  {
    key: 'usage-insights',
    short: 'Usage & Insights',
    title: 'Usage & Insights',
    copy: 'Deep dive into resource usage and cost optimization.',
    icon: 'lucide:chart-line',
    action: 'Create Report',
    actionIcon: 'lucide:file-plus',
  },
  {
    key: 'policies-controls',
    short: 'Policies & Controls',
    title: 'Policies & Controls',
    copy: 'Governance, policies, and compliance controls.',
    icon: 'lucide:shield-check',
    action: 'New Policy',
    actionIcon: 'lucide:plus',
    empty: 'Policies set for your organization will be listed here, with any violations of them.',
  },
  {
    key: 'activity',
    short: 'Activity',
    title: 'Activity',
    copy: 'Organization-wide activity and events.',
    icon: 'lucide:activity',
    action: 'Export',
    actionIcon: 'lucide:download',
  },
]

const activeStatic = computed(() => modules.find((module) => module.key === route.params.module) || modules[0])

const orgName = computed(() => orgStore.org?.name || 'Organization')

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

// ── Workspace management (workspaces module) ────────────────────────────────
const wsRows = ref([])          // raw workspace objects (id, name, slug, owner, members, agents, budgetLabel)
const wsSearch = ref('')
const filteredWorkspaces = computed(() => {
  const q = wsSearch.value.trim().toLowerCase()
  if (!q) return wsRows.value
  return wsRows.value.filter((w) => w.name.toLowerCase().includes(q) || String(w.owner).toLowerCase().includes(q))
})
const menuOpenId = ref(null)    // which row's 3-dots menu is open
const menuWs = ref(null)        // the workspace object for the open menu
const menuPos = ref({ top: 0, left: 0 })
const renameModal = reactive({ open: false, ws: null, name: '', busy: false })
const membersModal = reactive({ open: false, ws: null, list: [], candidates: [], addUserId: '', addRole: 'member', busy: false, loading: false })

function toggleRowMenu(w, ev) {
  if (menuOpenId.value === w.id) { closeRowMenu(); return }
  menuOpenId.value = w.id
  menuWs.value = w
  // Position the fixed menu just under the button, right-aligned to it.
  const r = ev.currentTarget.getBoundingClientRect()
  const width = 184
  menuPos.value = {
    top: r.bottom + 6,
    left: Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8)),
  }
}
function closeRowMenu() { menuOpenId.value = null; menuWs.value = null }

// Open the workspace dashboard on its Settings tab (name/slug + LLM guardrails editor).
function openWorkspaceSettings(ws) {
  closeRowMenu()
  router.push(`/dashboard/workspace/${ws.id}/settings`)
}

// Rename
function openRename(ws) {
  closeRowMenu()
  renameModal.ws = ws
  renameModal.name = ws.name
  renameModal.open = true
}
async function submitRename() {
  const name = renameModal.name.trim()
  if (!name || renameModal.busy) return
  renameModal.busy = true
  try {
    await tenancyApi.updateWorkspace(renameModal.ws.id, { name })
    notify.success('Workspace renamed')
    renameModal.open = false
    await loadModule()
  } catch (e) {
    notify.error(e?.response?.data?.detail || e?.response?.data?.error || 'Rename failed')
  } finally {
    renameModal.busy = false
  }
}

// Delete
async function deleteWorkspace(ws) {
  closeRowMenu()
  const ok = await confirm({
    title: 'Delete workspace?',
    message: `"${ws.name}" and its memberships will be permanently removed. This cannot be undone.`,
    confirmText: 'Delete', danger: true,
  })
  if (!ok) return
  try {
    await tenancyApi.deleteWorkspace(ws.id)
    notify.success('Workspace deleted')
    await loadModule()
  } catch (e) {
    notify.error(e?.response?.data?.detail || e?.response?.data?.error || 'Delete failed')
  }
}

// Manage members
async function openMembers(ws) {
  closeRowMenu()
  membersModal.ws = ws
  membersModal.open = true
  membersModal.addUserId = ''
  membersModal.addRole = 'member'
  await refreshMembers()
}
async function refreshMembers() {
  if (!membersModal.ws) return
  membersModal.loading = true
  try {
    const [wsRes, orgRes] = await Promise.all([
      tenancyApi.getWSMembers(membersModal.ws.id),
      orgStore.orgSlug ? tenancyApi.getOrgMembers(orgStore.orgSlug) : Promise.resolve({ data: [] }),
    ])
    membersModal.list = Array.isArray(wsRes.data) ? wsRes.data : (wsRes.data?.results || [])
    const orgMembers = Array.isArray(orgRes.data) ? orgRes.data : (orgRes.data?.results || [])
    const inWs = new Set(membersModal.list.map((m) => m.user))
    // Org members not already in this workspace = candidates to add.
    membersModal.candidates = orgMembers.filter((m) => !inWs.has(m.user))
  } catch (e) {
    notify.error('Failed to load members')
  } finally {
    membersModal.loading = false
  }
}
async function addWsMember() {
  if (!membersModal.addUserId || membersModal.busy) return
  membersModal.busy = true
  try {
    await tenancyApi.addWSMember(membersModal.ws.id, { user_id: membersModal.addUserId, role: membersModal.addRole })
    notify.success('Member added to workspace')
    membersModal.addUserId = ''
    await refreshMembers()
  } catch (e) {
    notify.error(e?.response?.data?.detail || e?.response?.data?.error || 'Failed to add member')
  } finally {
    membersModal.busy = false
  }
}
async function removeWsMember(m) {
  const ok = await confirm({ title: 'Remove member?', message: `Remove ${m.username || m.email} from "${membersModal.ws.name}"?`, confirmText: 'Remove', danger: true })
  if (!ok) return
  try {
    await tenancyApi.removeWSMember(membersModal.ws.id, m.user)
    notify.success('Member removed')
    await refreshMembers()
  } catch (e) {
    notify.error(e?.response?.data?.detail || 'Failed to remove member')
  }
}

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

// Modules connected to a backend.
const LIVE_KEYS = ['workspaces', 'activity', 'budgets-finance', 'usage-insights']

// The view the template renders: what the backend returned, empty until it has.
const active = computed(() => ({
  ...activeStatic.value,
  metrics: liveMetrics.value || [],
  columns: liveColumns.value || [],
  rows: liveRows.value || [],
  secondary: liveSecondary.value,
}))

setBreadcrumbLabel(() => active.value?.title || active.value?.name)

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
  if (!LIVE_KEYS.includes(key)) return   // no backend yet: nothing to fetch
  const slug = await orgStore.resolveOrgSlug()
  if (!slug) return
  loading.value = true
  try {
    if (key === 'workspaces') {
      const { data } = await tenancyApi.getOrgOverview(slug)
      const ws = data.workspaces || []
      // Raw objects (with ids) power the interactive table + row actions.
      wsRows.value = ws.map((w) => ({
        id: w.id, name: w.name, slug: w.slug, owner: w.owner || '—',
        members: w.members ?? 0, agents: w.agents ?? 0,
        budgetLabel: w.budget_used_pct == null ? '—' : `${Math.round(w.budget_used_pct)}%`,
      }))
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
    /* the module stays empty on error */
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (!orgStore.loaded) orgStore.load()   // populates org name for the breadcrumb
  loadModule()
})
watchOwnRouteParam('module', () => { activityPage.value = 1; loadModule() })   // never on the way out (F-M1)

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

// Primary header action: shown only where it leads somewhere (a button that does nothing reads as broken).
const ACTION_ROUTES = { 'budgets-finance': '/dashboard/budgets' }
const actionRoute = computed(() => ACTION_ROUTES[activeStatic.value.key] || '')
function onAction() {
  if (actionRoute.value) router.push(actionRoute.value)
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
  .content-grid.finance {
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

/* Sub-tabs (Budgets & Finance) */
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

@media (max-width: 1200px) {
  .sub-tabs {
    overflow-x: auto;
    gap: 28px;
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

/* ── Workspace row actions (3-dots menu) ─────────────────────────────────── */
.ws-actions-cell {
  position: relative;
  text-align: right;
  width: 40px;
}
.ws-actions-cell .more {
  border: 0;
  background: transparent;
  cursor: pointer;
  font-weight: 800;
  color: #64748b;
  padding: 2px 8px;
  border-radius: 6px;
  letter-spacing: 1px;
}
.ws-actions-cell .more:hover { background: #eef2f8; }

.menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 900;
}
.row-menu-fixed {
  position: fixed;
  z-index: 901;
  width: 184px;
  background: #fff;
  border: 1px solid #e2e8f2;
  border-radius: 10px;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.16);
  padding: 6px;
  display: grid;
  gap: 2px;
}
.row-menu-fixed button {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  border: 0;
  background: transparent;
  padding: 8px 10px;
  border-radius: 7px;
  font-size: 12.5px;
  font-weight: 650;
  color: #334155;
  cursor: pointer;
  text-align: left;
}
.row-menu-fixed button:hover { background: #f1f5f9; }
.row-menu-fixed button svg { width: 15px; height: 15px; }
.row-menu-fixed button.danger { color: #dc2626; }
.row-menu-fixed button.danger:hover { background: #fef2f2; }

/* ── Modals (rename + members) ───────────────────────────────────────────── */
.orgmod-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(2px);
  padding: 20px;
}
.orgmod-modal {
  width: 100%;
  max-width: 420px;
  background: #fff;
  border: 1px solid #e2e8f2;
  border-radius: 14px;
  padding: 22px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.22);
}
.orgmod-modal.wide { max-width: 520px; }
.orgmod-modal h3 { margin: 0 0 16px; font-size: 17px; font-weight: 800; color: #0f172a; }
.orgmod-modal .form-row { display: grid; gap: 6px; margin-bottom: 14px; }
.orgmod-modal label { font-size: 12px; font-weight: 700; color: #475569; }
.orgmod-modal input,
.orgmod-modal select {
  height: 40px; border: 1px solid #d9e3f0; border-radius: 9px; padding: 0 12px;
  font: inherit; font-size: 13px; color: #0f172a; background: #fff; outline: none;
}
.orgmod-modal input:focus,
.orgmod-modal select:focus { border-color: #3156e9; box-shadow: 0 0 0 3px rgba(49, 86, 233, 0.12); }
.orgmod-modal .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
.orgmod-modal .btn-cancel,
.orgmod-modal .btn-primary {
  height: 38px; padding: 0 18px; border-radius: 8px; font-size: 12px; font-weight: 800; cursor: pointer;
}
.orgmod-modal .btn-cancel { border: 1px solid #d9e3f0; background: #fff; color: #334155; }
.orgmod-modal .btn-primary { border: 0; background: #3156e9; color: #fff; }
.orgmod-modal .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
.add-member-row { display: grid; grid-template-columns: 1fr 120px auto; gap: 8px; margin-bottom: 8px; }
.add-hint { margin: 2px 0 10px; }
.members-list { display: grid; gap: 4px; max-height: 300px; overflow: auto; margin-top: 6px; }
.member-row {
  display: grid; grid-template-columns: 1fr auto 28px; align-items: center; gap: 10px;
  padding: 9px 10px; border: 1px solid #eef2f8; border-radius: 9px;
}
.member-name { font-size: 12.5px; font-weight: 650; color: #0f172a; }
.member-role { font-size: 11px; font-weight: 700; color: #475569; text-transform: capitalize; background: #f1f5f9; padding: 3px 8px; border-radius: 999px; }
.link-danger { border: 0; background: transparent; color: #dc2626; cursor: pointer; display: grid; place-items: center; }
.link-danger svg { width: 15px; height: 15px; }
.orgmod-modal-enter-active,
.orgmod-modal-leave-active { transition: opacity 0.16s ease; }
.orgmod-modal-enter-from,
.orgmod-modal-leave-to { opacity: 0; }
</style>
