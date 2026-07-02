<template>
  <main class="organization-page">
    <section class="org-main">
      <header class="page-head">
        <div>
          <div class="title-row">
            <h1>{{ orgTitle }}</h1>
            <span class="status-pill">Active</span>
          </div>
          <p>Manage workspaces, members, credentials, governance, budgets, and organization-wide approvals.</p>
        </div>
        <div class="head-actions">
          <button v-if="isAdmin" class="ghost" @click="openInvite"><Icon icon="lucide:user-plus" /> Invite Member</button>
          <button v-if="isAdmin" class="primary" @click="openCreateWs"><Icon icon="lucide:plus" /> Create Workspace</button>
          <RouterLink class="ghost" to="/dashboard/organization/workspaces"><Icon icon="lucide:settings" /> Manage Workspaces</RouterLink>
        </div>
      </header>

      <div v-if="error === 'no_org'" class="state-banner">
        You don't belong to an organization yet. Create one to manage workspaces, members, and budgets.
      </div>
      <div v-else-if="error" class="state-banner err">Couldn't load organization data: {{ error }}</div>
      <div v-else-if="loading && !loaded" class="state-banner">Loading organization…</div>

      <section class="metric-grid">
        <article v-for="metric in metrics" :key="metric.label" class="metric-card" :class="{ placeholder: metric.placeholder }">
          <span :class="['metric-icon', metric.tone]"><Icon :icon="metric.icon" /></span>
          <div>
            <p>{{ metric.label }}</p>
            <strong>{{ metric.value }}</strong>
            <small v-if="metric.placeholder" class="muted">Coming soon</small>
          </div>
        </article>
      </section>

      <section class="top-grid">
        <article class="panel workspace-panel">
          <header class="panel-head">
            <h2>Workspaces</h2>
            <RouterLink to="/dashboard/organization/workspaces">View all ({{ store.metrics.workspaces ?? 0 }})</RouterLink>
          </header>
          <table>
            <thead>
              <tr>
                <th>Workspace</th>
                <th>Owner / Admin</th>
                <th>Members</th>
                <th>Agents</th>
                <th>Budget Used</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="workspace in workspaces" :key="workspace.name">
                <td>
                  <span class="table-cell-inline">
                    <span class="table-icon"><Icon icon="lucide:building-2" /></span>
                    <span class="truncate-text">{{ workspace.name }}</span>
                  </span>
                </td>
                <td>
                  <span class="table-cell-inline">
                    <span :class="['avatar', workspace.avatarTone]">{{ workspace.initial }}</span>
                    <span class="truncate-text">{{ workspace.owner }}</span>
                  </span>
                </td>
                <td>{{ workspace.members }}</td>
                <td>{{ workspace.agents }}</td>
                <td>
                  <div v-if="workspace.percent" class="budget-cell">
                    <div class="bar"><i :style="{ width: workspace.percent }" /></div>
                    <em>{{ workspace.percent }}</em>
                  </div>
                  <em v-else class="muted budget-muted">{{ workspace.budgetLabel }}</em>
                </td>
                <td><b class="green">Active</b></td>
              </tr>
              <tr v-if="!workspaces.length"><td colspan="6" class="empty-cell">No workspaces yet.</td></tr>
            </tbody>
          </table>
        </article>

        <article class="panel members-panel">
          <header class="panel-head">
            <h2>Organization Members</h2>
            <RouterLink to="/dashboard/organization/activity">View all ({{ store.metrics.members ?? 0 }})</RouterLink>
          </header>
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="member in members" :key="member.email">
                <td>
                  <span :class="['avatar', member.tone]">{{ member.initials }}</span>
                  <span><strong>{{ member.name }}</strong><small>{{ member.email }}</small></span>
                </td>
                <td><em class="role">{{ member.role }}</em></td>
                <td><b class="green">Active</b></td>
              </tr>
              <tr v-if="!members.length"><td colspan="3" class="empty-cell">No members yet.</td></tr>
            </tbody>
          </table>
        </article>
      </section>

      <section class="card-grid">
        <article class="panel coming-soon">
          <header class="panel-head"><h2>Approval Queue</h2></header>
          <div class="placeholder-body">
            <Icon icon="lucide:clock-3" />
            <p>Approval workflows are coming soon.</p>
            <small>Sensitive-action requests will appear here for review.</small>
          </div>
        </article>

        <article class="panel coming-soon">
          <header class="panel-head"><h2>Credentials Vault (Org Level)</h2></header>
          <div class="placeholder-body">
            <Icon icon="lucide:key-round" />
            <p>Org-level credential management is coming soon.</p>
            <small>Shared credentials and rotation status will live here.</small>
          </div>
        </article>

        <article class="panel coming-soon">
          <header class="panel-head"><h2>Tools &amp; Capabilities Policy</h2></header>
          <div class="placeholder-body">
            <Icon icon="lucide:shield-check" />
            <p>Org-wide tool policies are coming soon.</p>
            <small>Per-agent permissions are configured in the agent editor today.</small>
          </div>
        </article>
      </section>

      <section class="bottom-grid">
        <article class="panel billing-panel">
          <header class="panel-head">
            <h2>Budget & Billing</h2>
            <RouterLink to="/dashboard/organization/budgets-finance">View details</RouterLink>
          </header>
          <div class="billing-layout">
            <div class="budget-summary">
              <span>Total Monthly Budget</span>
              <strong v-if="billing.hasCap">{{ billing.monthly }} <small>USD</small></strong>
              <strong v-else>No cap <small>set</small></strong>
              <p>{{ billing.used }} used</p>
              <div class="wide-bar"><i :style="{ width: billing.width }" /></div>
              <div class="bar-labels">
                <span>{{ billing.percent || '—' }}</span>
                <span>{{ billing.remaining ? `${billing.remaining} remaining` : 'No cap set' }}</span>
              </div>
            </div>
            <div class="mini-spend-list">
              <span>Per-Workspace Budget Usage</span>
              <div v-for="workspace in spendWorkspaces" :key="workspace.name" class="spend-row">
                <span>{{ workspace.name }}</span>
                <div class="bar"><i :style="{ width: workspace.percent }" /></div>
                <em>{{ workspace.percent }}</em>
              </div>
              <p v-if="!spendWorkspaces.length" class="muted">No per-workspace budgets configured.</p>
            </div>
            <div class="billing-cycle">
              <span>Manage budgets</span>
              <strong>All scopes</strong>
              <p class="muted">Org, workspace, agent, workflow &amp; schedule budgets.</p>
              <RouterLink to="/dashboard/budgets">Open Budgets</RouterLink>
            </div>
          </div>
        </article>

        <article class="panel guardrail-panel">
          <h2>Organization Guardrails</h2>
          <div v-for="guardrail in guardrails" :key="guardrail" class="guardrail-row">
            <span><Icon icon="lucide:shield-check" />{{ guardrail }}</span>
            <button class="switch"><i /></button>
          </div>
          <RouterLink class="full-link" to="/dashboard/org-guardrails">Edit guardrails &amp; approvals</RouterLink>
        </article>
      </section>
    </section>

    <aside class="org-rail">
      <section class="rail-card details">
        <h2>Organization Details</h2>
        <dl>
          <div><dt>Created</dt><dd>{{ orgDetails.created }}</dd></div>
          <div><dt>Owner</dt><dd>{{ orgDetails.owner }}</dd></div>
          <div><dt>Plan</dt><dd>{{ orgDetails.plan }}</dd></div>
          <div class="org-id"><dt>Organization ID</dt><dd>{{ orgDetails.id }} <Icon icon="lucide:copy" /></dd></div>
        </dl>
        <RouterLink to="/dashboard/budgets">View Billing &amp; Plan</RouterLink>
      </section>

      <section class="rail-card module-card">
        <h2>Organization Modules</h2>
        <div class="module-list">
          <RouterLink v-for="module in organizationModules" :key="module.to" :to="module.to">
            <Icon :icon="module.icon" />
            <span>{{ module.label }}</span>
          </RouterLink>
        </div>
      </section>

      <section class="rail-card">
        <h2>Top Workspaces by Spend</h2>
        <div v-for="workspace in spendWorkspaces" :key="`rail-${workspace.name}`" class="rail-spend">
          <span>{{ workspace.name }}</span>
          <strong>{{ workspace.percent }}</strong>
          <div><i :style="{ width: workspace.percent }" /></div>
        </div>
        <p v-if="!spendWorkspaces.length" class="muted">No per-workspace budgets configured.</p>
      </section>

      <section class="rail-card">
        <header class="panel-head compact">
          <h2>Recent Activity</h2>
          <RouterLink to="/dashboard/organization/activity">View all</RouterLink>
        </header>
        <ol class="activity-list">
          <li v-for="(item, i) in activity" :key="`act-${i}`">
            <i :class="item.tone" />
            <span>{{ item.copy }}</span>
            <em>{{ item.time }}</em>
          </li>
        </ol>
        <p v-if="!activity.length" class="muted">No recent activity.</p>
      </section>
    </aside>

    <Teleport to="body">
      <transition name="org-modal">
        <div v-if="invite.open" class="org-backdrop" @click.self="invite.open = false">
          <div class="org-modal" role="dialog" aria-modal="true">
            <h3>Invite / Add Member</h3>

            <div class="form-row">
              <label>Add to</label>
              <div class="scope-toggle">
                <button :class="{ active: invite.scope === 'org' }" @click="invite.scope = 'org'">Organization</button>
                <button :class="{ active: invite.scope === 'workspace' }" @click="setWorkspaceScope">Workspace</button>
              </div>
            </div>

            <!-- Organization scope: email invite -->
            <template v-if="invite.scope === 'org'">
              <div class="form-row">
                <label>Email</label>
                <input v-model="invite.email" type="email" placeholder="colleague@company.com" @keydown.enter="submitInvite" />
              </div>
              <div class="form-row">
                <label>Role</label>
                <select v-model="invite.role">
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                  <option value="billing">Billing</option>
                </select>
              </div>
              <p class="scope-hint">Sends an email invite to join the organization.</p>
            </template>

            <!-- Workspace scope: add an existing org member to a workspace -->
            <template v-else>
              <div class="form-row">
                <label>Workspace</label>
                <select v-model="invite.workspaceId" @change="onInviteWorkspaceChange">
                  <option value="" disabled>Select a workspace…</option>
                  <option v-for="w in store.workspaces" :key="w.id" :value="w.id">{{ w.name }}</option>
                </select>
              </div>
              <div class="form-row">
                <label>Member</label>
                <select v-model="invite.userId" :disabled="!invite.workspaceId">
                  <option value="" disabled>{{ invite.candidatesLoading ? 'Loading…' : 'Select an org member…' }}</option>
                  <option v-for="c in invite.candidates" :key="c.user" :value="c.user">{{ c.username || c.email }}</option>
                </select>
              </div>
              <div class="form-row">
                <label>Role</label>
                <select v-model="invite.wsRole">
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <p v-if="invite.workspaceId && !invite.candidates.length && !invite.candidatesLoading" class="scope-hint">
                Everyone in the org is already in this workspace. Invite new people to the org first.
              </p>
              <p v-else class="scope-hint">Adds an existing organization member to the selected workspace.</p>
            </template>

            <div class="modal-actions">
              <button class="btn-cancel" @click="invite.open = false">Cancel</button>
              <button v-if="invite.scope === 'org'" class="btn-primary" :disabled="invite.busy || !invite.email.trim()" @click="submitInvite">
                {{ invite.busy ? 'Sending…' : 'Send Invite' }}
              </button>
              <button v-else class="btn-primary" :disabled="invite.busy || !invite.workspaceId || !invite.userId" @click="submitWorkspaceAdd">
                {{ invite.busy ? 'Adding…' : 'Add to Workspace' }}
              </button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <Teleport to="body">
      <transition name="org-modal">
        <div v-if="ws.open" class="org-backdrop" @click.self="ws.open = false">
          <div class="org-modal" role="dialog" aria-modal="true">
            <h3>New Workspace</h3>
            <div class="form-row">
              <label>Name</label>
              <input v-model="ws.name" placeholder="e.g. Engineering" @keydown.enter="submitWorkspace" />
            </div>
            <div class="form-row">
              <label>Slug <small>(optional)</small></label>
              <input v-model="ws.slug" :placeholder="ws.name ? ws.name.toLowerCase().replace(/\s+/g, '-') : 'engineering'" @keydown.enter="submitWorkspace" />
            </div>
            <div class="modal-actions">
              <button class="btn-cancel" @click="ws.open = false">Cancel</button>
              <button class="btn-primary" :disabled="ws.busy || !ws.name.trim()" @click="submitWorkspace">
                {{ ws.busy ? 'Creating…' : 'Create' }}
              </button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </main>
</template>

<script setup>
import { computed, onMounted, reactive } from 'vue'
import { RouterLink } from 'vue-router'
import { Icon } from '@iconify/vue'
import { storeToRefs } from 'pinia'
import { useOrganizationStore } from '../stores/useOrganizationStore'
import tenancyApi from '../services/tenancyApi'
import { notify } from '../composables/useNotify'

const store = useOrganizationStore()
const { org, loading, error, loaded } = storeToRefs(store)
const isAdmin = computed(() => store.isAdmin)

onMounted(() => { if (!store.loaded) store.load() })

// ── Invite / add member modal (org or workspace scope) ──────────────────────
const invite = reactive({
  open: false, busy: false,
  scope: 'org',
  // org scope
  email: '', role: 'member',
  // workspace scope
  workspaceId: '', userId: '', wsRole: 'member',
  candidates: [], candidatesLoading: false,
})
function openInvite() {
  invite.scope = 'org'
  invite.email = ''
  invite.role = 'member'
  invite.workspaceId = ''
  invite.userId = ''
  invite.wsRole = 'member'
  invite.candidates = []
  invite.open = true
}
function setWorkspaceScope() {
  invite.scope = 'workspace'
  // Preselect the first workspace if there's exactly one.
  if (!invite.workspaceId && store.workspaces.length) {
    invite.workspaceId = store.workspaces[0].id
    onInviteWorkspaceChange()
  }
}
async function onInviteWorkspaceChange() {
  invite.userId = ''
  invite.candidates = []
  if (!invite.workspaceId || !store.orgSlug) return
  invite.candidatesLoading = true
  try {
    const [wsRes, orgRes] = await Promise.all([
      tenancyApi.getWSMembers(invite.workspaceId),
      tenancyApi.getOrgMembers(store.orgSlug),
    ])
    const wsMembers = Array.isArray(wsRes.data) ? wsRes.data : (wsRes.data?.results || [])
    const orgMembers = Array.isArray(orgRes.data) ? orgRes.data : (orgRes.data?.results || [])
    const inWs = new Set(wsMembers.map((m) => m.user))
    invite.candidates = orgMembers.filter((m) => !inWs.has(m.user))
  } catch {
    notify.error('Failed to load members')
  } finally {
    invite.candidatesLoading = false
  }
}
async function submitInvite() {
  const email = invite.email.trim()
  if (!email || invite.busy) return
  if (!store.orgSlug) { notify.error('No organization selected'); return }
  invite.busy = true
  try {
    await tenancyApi.inviteOrgMember(store.orgSlug, { email, role: invite.role })
    notify.success(`Invitation sent to ${email}`)
    invite.open = false
    store.loadMembers()
  } catch (err) {
    notify.error(err?.response?.data?.detail || err?.response?.data?.error || 'Invite failed')
  } finally {
    invite.busy = false
  }
}
async function submitWorkspaceAdd() {
  if (!invite.workspaceId || !invite.userId || invite.busy) return
  invite.busy = true
  try {
    await tenancyApi.addWSMember(invite.workspaceId, { user_id: invite.userId, role: invite.wsRole })
    notify.success('Member added to workspace')
    invite.open = false
    store.refresh()
  } catch (err) {
    notify.error(err?.response?.data?.detail || err?.response?.data?.error || 'Failed to add member')
  } finally {
    invite.busy = false
  }
}

// ── Create workspace modal ──────────────────────────────────────────────────
const ws = reactive({ open: false, name: '', slug: '', busy: false })
function openCreateWs() {
  ws.name = ''
  ws.slug = ''
  ws.open = true
}
async function submitWorkspace() {
  if (!ws.name.trim() || ws.busy) return
  if (!store.orgSlug) { notify.error('No organization selected'); return }
  ws.busy = true
  try {
    await tenancyApi.createWorkspace(store.orgSlug, {
      name: ws.name.trim(),
      slug: ws.slug.trim() || ws.name.trim().toLowerCase().replace(/\s+/g, '-'),
    })
    notify.success(`Workspace "${ws.name.trim()}" created`)
    ws.open = false
    store.refresh()
  } catch (err) {
    notify.error(err?.response?.data?.detail || err?.response?.data?.error || 'Failed to create workspace')
  } finally {
    ws.busy = false
  }
}

const AVATAR_TONES = ['violet', 'purple', 'rose', 'pink', 'red', 'indigo']
const ACTIVITY_TONES = ['blue', 'violet', 'red', 'purple', 'indigo']
const toneFor = (i, palette) => palette[((i % palette.length) + palette.length) % palette.length]
const initialsOf = (name = '') => (name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('') || '?').toUpperCase()
const titleCase = (s = '') => s.charAt(0).toUpperCase() + s.slice(1)

function relativeTime(iso) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000))
  if (secs < 60) return `${secs}s ago`
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

const usd = (v) => (v == null ? '—' : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)

const orgBaseName = computed(() => {
  const raw = (org.value?.name || '').trim()
  if (!raw) return 'Organization'
  return raw.replace(/\s+Organization$/i, '').trim() || raw
})
const orgTitle = computed(() => orgBaseName.value === 'Organization' ? 'Organization' : `${orgBaseName.value} Organization`)
const metrics = computed(() => store.metricCards)

const workspaces = computed(() => store.workspaces.map((w, i) => ({
  name: w.name,
  owner: w.owner || '—',
  initial: initialsOf(w.owner || w.name),
  avatarTone: toneFor(i, AVATAR_TONES),
  members: w.members ?? 0,
  agents: w.agents ?? 0,
  budgetLabel: w.budget_used_pct == null ? 'No budget' : `${Math.round(w.budget_used_pct)}% used`,
  percent: w.budget_used_pct == null ? null : `${Math.round(w.budget_used_pct)}%`,
})))

const members = computed(() => store.members.slice(0, 6).map((m, i) => ({
  name: m.username || m.email || `User ${m.user}`,
  email: m.email || '',
  initials: initialsOf(m.username || m.email || 'U'),
  role: titleCase(m.role || 'member'),
  tone: toneFor(i, AVATAR_TONES),
})))

// Per-workspace budget usage — only the workspaces that actually have a budget %.
const spendWorkspaces = computed(() =>
  store.topBySpend.map((w) => ({
    name: w.name,
    percent: w.budget_used_pct == null ? '0%' : `${Math.round(w.budget_used_pct)}%`,
  })))

const billing = computed(() => {
  const m = store.budget?.metrics || {}
  const monthly = m.monthly_limit
  const used = m.current_spend ?? store.metrics?.monthly_spend_usd ?? 0
  const remaining = m.remaining
  const percent = m.percent
  return {
    monthly: usd(monthly),
    hasCap: monthly != null,
    used: usd(used),
    remaining: remaining == null ? null : usd(remaining),
    percent: percent == null ? null : `${Math.round(percent)}%`,
    width: percent == null ? '0%' : `${Math.min(100, Math.round(percent))}%`,
  }
})

const activity = computed(() => store.recentActivity.map((ev, i) => ({
  copy: `${ev.username || 'System'} — ${(ev.action || '').replace(/_/g, ' ')}${ev.resource_id ? ` (${ev.resource_id})` : ''}`,
  time: relativeTime(ev.created_at),
  tone: toneFor(i, ACTIVITY_TONES),
})))

const orgDetails = computed(() => ({
  created: org.value?.created_at ? new Date(org.value.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—',
  owner: store.members.find((m) => m.role === 'owner')?.username || '—',
  plan: titleCase(store.budget?.organization?.plan || 'Free'),
  id: org.value ? `org_${org.value.slug}` : '—',
}))

// Guardrails stay static for v1 (decision: revisit later).
const guardrails = [
  'Human approval required for sensitive actions',
  'External write actions restricted',
  'Credential reveal disabled',
  'Sandbox creation requires approval',
  'Model allowlist enforced',
]

const organizationModules = [
  { label: 'Workspaces', to: '/dashboard/organization/workspaces', icon: 'lucide:building-2' },
  { label: 'Cloud Resources', to: '/dashboard/organization/cloud-resources', icon: 'lucide:cloud' },
  { label: 'Sandboxes', to: '/dashboard/organization/sandboxes', icon: 'lucide:box' },
  { label: 'Budgets & Finance', to: '/dashboard/organization/budgets-finance', icon: 'lucide:wallet' },
  { label: 'Procurement', to: '/dashboard/organization/procurement', icon: 'lucide:shopping-cart' },
  { label: 'Usage & Insights', to: '/dashboard/organization/usage-insights', icon: 'lucide:chart-line' },
  { label: 'Policies & Controls', to: '/dashboard/organization/policies-controls', icon: 'lucide:shield-check' },
  { label: 'Activity', to: '/dashboard/organization/activity', icon: 'lucide:activity' },
]
</script>

<style scoped>
.organization-page {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 18px;
  min-height: 100%;
  padding: 26px 28px;
  background: #fbfdff;
  color: #0f172a;
}
.org-main { max-width: 1280px; width: 100%; justify-self: center; }
.page-head { display: flex; justify-content: space-between; gap: 18px; margin-bottom: 18px; }
.title-row { display: flex; align-items: center; gap: 10px; }
h1, h2, p { margin: 0; }
h1 { font-size: 26px; line-height: 1.1; font-weight: 850; letter-spacing: 0; }
.page-head p { margin-top: 8px; color: #53657f; font-size: 13px; }
.status-pill, .green, .orange, .red, .role {
  display: inline-flex; align-items: center; border-radius: 999px; padding: 4px 9px; font-size: 11px; font-weight: 850;
}
.status-pill, .green { background: #dcfce7; color: #047857; }
.orange { background: #ffedd5; color: #ea580c; }
.red { background: #fee2e2; color: #dc2626; }
.role { background: #f1f5f9; color: #475569; font-style: normal; }
.head-actions { display: flex; align-items: flex-start; gap: 12px; }
button, select { font: inherit; }
.ghost, .primary {
  height: 40px; border-radius: 8px; padding: 0 18px; font-size: 12px; font-weight: 850; display: inline-flex; align-items: center; gap: 8px;
  text-decoration: none;
}
.ghost { border: 1px solid #d9e3f0; background: #fff; color: #0f172a; }
.primary { border: 0; background: #3156e9; color: #fff; box-shadow: 0 12px 22px rgba(49,86,233,.18); }
.metric-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
.metric-card, .panel, .rail-card {
  border: 1px solid #dfe7f2; border-radius: 10px; background: #fff; box-shadow: 0 8px 22px rgba(15,23,42,.03);
}
.metric-card { min-height: 104px; padding: 18px; display: flex; gap: 16px; align-items: center; }
.metric-icon {
  width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; flex: 0 0 auto;
}
.metric-icon svg { width: 21px; height: 21px; }
.metric-card p { color: #334155; font-size: 12px; font-weight: 850; }
.metric-card strong { display: block; margin-top: 5px; font-size: 22px; line-height: 1; font-weight: 900; }
.metric-card small { display: block; margin-top: 9px; font-size: 11px; font-weight: 850; }
.blue { color: #2563eb; }
.blue-text { color: #3156e9; }
.violet { color: #6d5dfc; }
.indigo { color: #4f46e5; }
.money { color: #3156e9; }
.metric-icon.blue, .metric-icon.indigo { background: #eef4ff; }
.metric-icon.violet { background: #f1efff; }
.metric-icon.money { background: #fff7ed; color: #2563eb; }
.top-grid { display: grid; grid-template-columns: 1.1fr 1fr; gap: 12px; margin-bottom: 12px; }
.card-grid { display: grid; grid-template-columns: 1.15fr 1fr 1fr; gap: 12px; margin-bottom: 12px; }
.bottom-grid { display: grid; grid-template-columns: 1.6fr 1fr; gap: 12px; }
.panel { padding: 16px; overflow: hidden; }
.panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.panel-head.compact { margin: 0 0 12px; }
h2 { font-size: 15px; line-height: 1.2; font-weight: 850; }
.panel-head button,
.panel-head a {
  border: 0; background: transparent; color: #3156e9; font-size: 11px; font-weight: 850; padding: 0;
  text-decoration: none;
}
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th { text-align: left; color: #64748b; font-size: 10px; font-weight: 850; padding: 8px 0; border-bottom: 1px solid #e8eef7; }
td { color: #334155; font-size: 11px; font-weight: 700; padding: 9px 0; border-bottom: 1px solid #eef3f8; vertical-align: middle; }
tr:last-child td { border-bottom: 0; }
td:first-child { color: #0f172a; font-weight: 850; }
td svg { width: 15px; height: 15px; margin-right: 8px; vertical-align: middle; }
.table-icon {
  width: 17px; height: 17px; border-radius: 6px; display: inline-grid; place-items: center; margin-right: 9px; background: #3156e9; color: #fff;
}
.table-icon svg { width: 11px; height: 11px; margin: 0; }
.avatar {
  width: 21px; height: 21px; border-radius: 999px; display: inline-grid; place-items: center; margin-right: 8px; color: #fff; font-size: 10px; font-weight: 900;
}
.avatar.violet { background: #6d28d9; color: #fff; }
.avatar.purple { background: #7c3aed; color: #fff; }
.avatar.rose { background: #e11d48; color: #fff; }
.avatar.pink { background: #db2777; color: #fff; }
.avatar.red { background: #ef4444; color: #fff; }
.avatar.indigo { background: #4f46e5; color: #fff; }
.members-panel td:first-child { display: flex; align-items: center; gap: 0; }
.members-panel td:first-child span:last-child { display: grid; gap: 1px; }
.members-panel td strong { font-size: 11px; }
.members-panel td small { color: #64748b; font-size: 10px; font-weight: 700; }
.budget-cell { display: grid; grid-template-columns: 1fr 86px 34px; align-items: center; gap: 8px; }
.bar, .wide-bar { height: 4px; border-radius: 999px; background: #e8eef7; overflow: hidden; }
.bar i, .wide-bar i, .rail-spend i { display: block; height: 100%; background: #3156e9; border-radius: inherit; }
.budget-cell em, .spend-row em { color: #64748b; font-size: 10px; font-style: normal; }
.mini-actions { display: flex; gap: 6px; justify-content: flex-end; }
.mini-actions button {
  height: 26px; border-radius: 5px; padding: 0 8px; font-size: 10px; font-weight: 850; background: #fff;
}
.approve { border: 1px solid #bbf7d0; color: #16a34a; }
.reject { border: 1px solid #fecaca; color: #ef4444; }
.billing-layout { display: grid; grid-template-columns: 1.15fr 1.15fr .7fr; gap: 22px; }
.budget-summary, .mini-spend-list, .billing-cycle { border-right: 1px solid #e8eef7; padding-right: 18px; }
.billing-cycle { border-right: 0; padding-right: 0; }
.budget-summary > span, .mini-spend-list > span, .billing-cycle span { display: block; color: #475569; font-size: 11px; font-weight: 850; margin-bottom: 8px; }
.budget-summary strong { display: block; font-size: 24px; font-weight: 900; margin-bottom: 8px; }
.budget-summary strong small { font-size: 11px; color: #475569; }
.budget-summary p { color: #475569; font-size: 11px; margin-bottom: 10px; }
.wide-bar { height: 8px; margin-bottom: 8px; }
.bar-labels { display: flex; justify-content: space-between; color: #475569; font-size: 10px; font-weight: 750; }
.spend-row { display: grid; grid-template-columns: 90px 1fr 94px 28px; gap: 8px; align-items: center; margin-bottom: 8px; font-size: 10px; color: #334155; font-weight: 750; }
.spend-row strong { font-size: 10px; }
.billing-cycle strong { display: block; font-size: 13px; margin-bottom: 14px; }
.billing-cycle button, .billing-cycle a, .full-link, .rail-card > button, .rail-card > a {
  width: 100%; height: 34px; border-radius: 7px; border: 1px solid #d9e3f0; background: #fff; color: #3156e9; font-size: 11px; font-weight: 850;
  display: inline-flex; align-items: center; justify-content: center; text-decoration: none;
}
.guardrail-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; color: #334155; font-size: 12px; font-weight: 750; }
.guardrail-row span { display: inline-flex; align-items: center; gap: 8px; }
.guardrail-row svg { color: #64748b; }
.switch { width: 34px; height: 18px; border: 0; border-radius: 999px; background: #3d54e7; padding: 2px; }
.switch i { display: block; width: 14px; height: 14px; border-radius: 50%; background: #fff; margin-left: auto; }
.full-link { margin-top: 10px; }
.org-rail { display: grid; gap: 14px; align-content: start; }
.rail-card { padding: 16px; }
.details dl { margin: 14px 0; display: grid; gap: 15px; }
dt { color: #64748b; font-size: 11px; font-weight: 850; margin-bottom: 4px; }
dd { margin: 0; color: #0f172a; font-size: 12px; font-weight: 750; }
.org-id dd { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.rail-spend { display: grid; grid-template-columns: 1fr auto; gap: 7px; margin-top: 12px; font-size: 11px; font-weight: 750; color: #334155; }
.rail-spend div { grid-column: 1 / -1; height: 4px; border-radius: 999px; background: #e8eef7; overflow: hidden; }
.module-list { display: grid; gap: 8px; margin-top: 12px; }
.module-list a { min-height: 32px; display: grid; grid-template-columns: 18px 1fr; gap: 8px; align-items: center; color: #334155; text-decoration: none; font-size: 11px; font-weight: 700; }
.module-list a:hover { color: #3156e9; }
.module-list svg { width: 15px; height: 15px; color: #3156e9; }
.activity-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
.activity-list li { display: grid; grid-template-columns: 9px 1fr auto; gap: 8px; align-items: start; color: #334155; font-size: 11px; line-height: 1.35; font-weight: 750; }
.activity-list i { width: 7px; height: 7px; border-radius: 50%; margin-top: 4px; background: #3156e9; }
.activity-list i.violet { background: #7c3aed; }
.activity-list i.red { background: #ef4444; }
.activity-list i.purple { background: #8b5cf6; }
.activity-list i.indigo { background: #6366f1; }
.activity-list em { color: #64748b; font-size: 10px; font-style: normal; white-space: nowrap; }
@media (max-width: 1320px) {
  .organization-page { grid-template-columns: 1fr; }
  .org-rail { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 1100px) {
  .metric-grid { grid-template-columns: repeat(3, 1fr); }
  .top-grid, .card-grid, .bottom-grid { grid-template-columns: 1fr; }
  .billing-layout { grid-template-columns: 1fr; }
  .budget-summary, .mini-spend-list, .billing-cycle { border-right: 0; padding-right: 0; }
  .org-rail { grid-template-columns: 1fr; }
}
@media (max-width: 760px) {
  .organization-page { padding: 18px; }
  .page-head, .head-actions { flex-direction: column; }
  .head-actions, .ghost, .primary { width: 100%; justify-content: center; }
  .metric-grid { grid-template-columns: 1fr; }
  .panel { overflow-x: auto; }
  table { min-width: 620px; }
}

/* Screen 38 density: this page is intentionally compact and data-heavy. */
.organization-page {
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 16px;
  padding: 24px 28px 32px;
  background: #f8fbff;
}

.organization-page .org-main {
  max-width: none;
}

.organization-page .page-head {
  align-items: flex-start;
  margin-bottom: 16px;
}

.organization-page h1 {
  font-size: 24px !important;
  line-height: 1.12 !important;
  letter-spacing: 0 !important;
  font-weight: 750 !important;
}

.organization-page .page-head p {
  max-width: 680px;
  margin-top: 7px;
  font-size: 12.5px !important;
  line-height: 1.45 !important;
  font-weight: 400 !important;
}

.organization-page .status-pill,
.organization-page .green,
.organization-page .orange,
.organization-page .red,
.organization-page .role {
  padding: 3px 8px;
  font-size: 10px !important;
  line-height: 1.2 !important;
  font-weight: 650 !important;
}

.organization-page .head-actions {
  gap: 12px;
}

.organization-page .ghost,
.organization-page .primary {
  min-width: 146px;
  height: 36px;
  padding: 0 15px;
  font-size: 12px !important;
  line-height: 1 !important;
  font-weight: 650 !important;
  white-space: nowrap;
}

.organization-page .metric-grid {
  gap: 12px;
  margin-bottom: 14px;
}

.organization-page .metric-card {
  min-height: 92px;
  padding: 14px 15px;
  gap: 13px;
}

.organization-page .metric-icon {
  width: 38px;
  height: 38px;
  border-radius: 11px;
}

.organization-page .metric-icon svg {
  width: 19px;
  height: 19px;
}

.organization-page .metric-card p {
  font-size: 11px !important;
  line-height: 1.2 !important;
  font-weight: 650 !important;
}

.organization-page .metric-card strong {
  margin-top: 4px;
  font-size: 21px !important;
  line-height: 1 !important;
  font-weight: 750 !important;
}

.organization-page .metric-card small {
  margin-top: 7px;
  font-size: 10.5px !important;
  line-height: 1.2 !important;
  font-weight: 600 !important;
}

.organization-page .top-grid,
.organization-page .card-grid,
.organization-page .bottom-grid {
  gap: 12px;
}

.organization-page .top-grid,
.organization-page .card-grid {
  margin-bottom: 12px;
}

.organization-page .panel,
.organization-page .rail-card {
  border-radius: 10px;
  padding: 14px;
}

.organization-page .panel-head {
  margin-bottom: 10px;
}

.organization-page h2 {
  font-size: 14px !important;
  line-height: 1.2 !important;
  letter-spacing: 0 !important;
  font-weight: 700 !important;
}

.organization-page .panel-head button,
.organization-page .panel-head a {
  font-size: 11px !important;
  line-height: 1.2 !important;
  font-weight: 650 !important;
  white-space: nowrap;
}

.organization-page table {
  table-layout: fixed;
}

.organization-page th {
  padding: 7px 0;
  font-size: 10px !important;
  line-height: 1.2 !important;
  font-weight: 650 !important;
  letter-spacing: .04em !important;
}

.organization-page td {
  padding: 8px 0;
  font-size: 10.75px !important;
  line-height: 1.3 !important;
  font-weight: 500 !important;
}

.organization-page td:first-child {
  font-weight: 650 !important;
}

.organization-page td strong {
  font-size: 10.75px !important;
  line-height: 1.2 !important;
  font-weight: 650 !important;
}

.organization-page td small,
.organization-page .members-panel td small {
  font-size: 9.75px !important;
  line-height: 1.2 !important;
  font-weight: 500 !important;
}

.organization-page .table-icon {
  width: 16px;
  height: 16px;
  margin-right: 8px;
}

.organization-page .avatar {
  width: 20px;
  height: 20px;
  margin-right: 7px;
  font-size: 9.5px !important;
}

.organization-page .budget-cell {
  grid-template-columns: minmax(0, 1fr) 78px 30px;
  gap: 7px;
}

.organization-page .budget-cell em,
.organization-page .spend-row em {
  font-size: 9.5px !important;
}

.organization-page .mini-actions {
  gap: 5px;
  white-space: nowrap;
}

.organization-page .mini-actions button {
  height: 24px;
  padding: 0 7px;
  font-size: 10px !important;
  line-height: 1 !important;
  font-weight: 650 !important;
}

.organization-page .billing-layout {
  gap: 18px;
}

.organization-page .budget-summary > span,
.organization-page .mini-spend-list > span,
.organization-page .billing-cycle span {
  font-size: 10.5px !important;
  font-weight: 650 !important;
}

.organization-page .budget-summary strong {
  font-size: 23px !important;
  font-weight: 750 !important;
}

.organization-page .budget-summary p,
.organization-page .bar-labels,
.organization-page .spend-row,
.organization-page .spend-row strong {
  font-size: 10px !important;
  font-weight: 550 !important;
}

.organization-page .billing-cycle strong {
  font-size: 12px !important;
  font-weight: 650 !important;
}

.organization-page .billing-cycle button,
.organization-page .billing-cycle a,
.organization-page .full-link,
.organization-page .rail-card > button,
.organization-page .rail-card > a {
  height: 32px;
  font-size: 11px !important;
  font-weight: 650 !important;
}

.organization-page .guardrail-row {
  padding: 7px 0;
  font-size: 11px !important;
  line-height: 1.25 !important;
  font-weight: 550 !important;
}

.organization-page .org-rail {
  gap: 14px;
}

.organization-page .details dl {
  margin: 13px 0;
  gap: 14px;
}

.organization-page dt {
  font-size: 10.5px !important;
  font-weight: 650 !important;
}

.organization-page dd {
  font-size: 11px !important;
  line-height: 1.35 !important;
  font-weight: 600 !important;
}

.organization-page .rail-spend {
  margin-top: 11px;
  font-size: 10.5px !important;
  line-height: 1.25 !important;
  font-weight: 550 !important;
}

.organization-page .activity-list {
  gap: 13px;
}

.organization-page .activity-list li {
  font-size: 10.5px !important;
  line-height: 1.35 !important;
  font-weight: 550 !important;
}

.organization-page .activity-list em {
  font-size: 9.5px !important;
}

@media (max-width: 1320px) {
  .organization-page {
    grid-template-columns: 1fr;
  }
}

/* Final Screen 38 proportion pass */
.organization-page {
  grid-template-columns: minmax(0, 1fr) 286px;
  gap: 14px;
  padding: 22px 24px 30px;
}

.organization-page .org-main {
  min-width: 0;
}

.organization-page .metric-grid {
  grid-template-columns: repeat(6, minmax(132px, 1fr));
}

.organization-page .metric-card {
  min-height: 86px;
  padding: 13px 14px;
}

.organization-page .metric-icon {
  width: 34px;
  height: 34px;
  border-radius: 9px;
}

.organization-page .metric-card strong {
  font-size: 20px !important;
}

.organization-page .top-grid {
  grid-template-columns: minmax(0, 1fr) minmax(0, .95fr);
}

.organization-page .card-grid {
  grid-template-columns: minmax(0, 1.08fr) minmax(0, .92fr) minmax(0, .92fr);
}

.organization-page .bottom-grid {
  grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
}

.organization-page .workspace-panel,
.organization-page .members-panel {
  min-height: 220px;
}

.organization-page .card-grid .panel {
  min-height: 190px;
}

.organization-page .billing-panel,
.organization-page .guardrail-panel {
  min-height: 164px;
}

.organization-page .panel,
.organization-page .rail-card {
  padding: 13px 14px;
}

.organization-page .panel-head {
  margin-bottom: 8px;
}

.organization-page h2 {
  font-size: 13.5px !important;
}

.organization-page th {
  padding: 6px 0;
  font-size: 9.5px !important;
}

.organization-page td {
  padding: 7px 0;
  font-size: 10.25px !important;
}

.organization-page .workspace-panel td:nth-child(1) {
  width: 24%;
}

.organization-page .workspace-panel th:nth-child(5),
.organization-page .workspace-panel td:nth-child(5) {
  width: 32%;
}

.organization-page .budget-cell {
  grid-template-columns: minmax(78px, 1fr) 88px 28px;
}

.organization-page .bar {
  height: 4px;
}

.organization-page .green,
.organization-page .orange,
.organization-page .red,
.organization-page .role {
  padding: 3px 7px;
  font-size: 9.5px !important;
}

.organization-page .mini-actions button {
  height: 23px;
  padding: 0 6px;
  font-size: 9.5px !important;
}

.organization-page .billing-layout {
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1.15fr) minmax(132px, .72fr);
  gap: 18px;
}

.organization-page .budget-summary strong {
  font-size: 22px !important;
}

.organization-page .wide-bar {
  height: 7px;
}

.organization-page .spend-row {
  grid-template-columns: 84px 1fr 82px 26px;
  gap: 7px;
  margin-bottom: 7px;
}

.organization-page .guardrail-row {
  padding: 6px 0;
  font-size: 10.5px !important;
}

.organization-page .switch {
  width: 32px;
  height: 17px;
}

.organization-page .switch i {
  width: 13px;
  height: 13px;
}

.organization-page .org-rail {
  gap: 12px;
}

.organization-page .details dl {
  gap: 12px;
}

.organization-page .rail-spend {
  margin-top: 10px;
}

.organization-page .activity-list {
  gap: 12px;
}

@media (max-width: 1320px) {
  .organization-page {
    grid-template-columns: 1fr;
  }

  .organization-page .org-rail {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1100px) {
  .organization-page .metric-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .organization-page .top-grid,
  .organization-page .card-grid,
  .organization-page .bottom-grid,
  .organization-page .billing-layout {
    grid-template-columns: 1fr;
  }
}

/* Screen 38 correction: prevent table text collisions at the dashboard width. */
.organization-page {
  grid-template-columns: minmax(0, 1fr) 276px;
  gap: 14px;
  padding: 22px 24px 32px;
}

.organization-page .top-grid {
  grid-template-columns: minmax(530px, 1.05fr) minmax(500px, 1fr);
}

.organization-page .card-grid {
  grid-template-columns: minmax(390px, 1.08fr) minmax(330px, .92fr) minmax(330px, .92fr);
}

.organization-page .panel {
  overflow: hidden;
}

.organization-page table {
  table-layout: auto !important;
}

.organization-page th,
.organization-page td {
  padding-top: 7px !important;
  padding-bottom: 7px !important;
  padding-right: 10px;
  vertical-align: middle;
}

.organization-page th:last-child,
.organization-page td:last-child {
  padding-right: 0;
}

.organization-page .workspace-panel th,
.organization-page .workspace-panel td,
.organization-page .members-panel th,
.organization-page .members-panel td {
  white-space: nowrap;
}

.organization-page .workspace-panel th:nth-child(1),
.organization-page .workspace-panel td:nth-child(1) {
  min-width: 118px;
}

.organization-page .workspace-panel th:nth-child(2),
.organization-page .workspace-panel td:nth-child(2) {
  min-width: 118px;
}

.organization-page .workspace-panel th:nth-child(3),
.organization-page .workspace-panel td:nth-child(3),
.organization-page .workspace-panel th:nth-child(4),
.organization-page .workspace-panel td:nth-child(4) {
  min-width: 54px;
  text-align: left;
}

.organization-page .workspace-panel th:nth-child(5),
.organization-page .workspace-panel td:nth-child(5) {
  min-width: 198px;
  width: auto;
}

.organization-page .workspace-panel th:nth-child(6),
.organization-page .workspace-panel td:nth-child(6) {
  min-width: 68px;
}

.organization-page .workspace-panel .budget-cell {
  grid-template-columns: 94px 86px 30px;
}

.organization-page .members-panel th:nth-child(1),
.organization-page .members-panel td:nth-child(1) {
  min-width: 178px;
}

.organization-page .members-panel th:nth-child(2),
.organization-page .members-panel td:nth-child(2) {
  min-width: 116px;
}

.organization-page .members-panel th:nth-child(3),
.organization-page .members-panel td:nth-child(3) {
  min-width: 84px;
}

.organization-page .members-panel th:nth-child(4),
.organization-page .members-panel td:nth-child(4) {
  min-width: 90px;
}

.organization-page .members-panel td:first-child span:last-child {
  min-width: 0;
}

.organization-page .approval-panel table {
  table-layout: fixed !important;
}

.organization-page .approval-panel th:nth-child(1),
.organization-page .approval-panel td:nth-child(1) {
  width: 34%;
}

.organization-page .approval-panel th:nth-child(2),
.organization-page .approval-panel td:nth-child(2) {
  width: 18%;
  white-space: nowrap;
}

.organization-page .approval-panel th:nth-child(3),
.organization-page .approval-panel td:nth-child(3) {
  width: 21%;
}

.organization-page .approval-panel th:nth-child(4),
.organization-page .approval-panel td:nth-child(4) {
  width: 13%;
  white-space: nowrap;
}

.organization-page .approval-panel th:nth-child(5),
.organization-page .approval-panel td:nth-child(5) {
  width: 14%;
}

.organization-page .approval-panel td {
  line-height: 1.25 !important;
}

.organization-page .mini-actions {
  justify-content: flex-end;
}

.organization-page .mini-actions button {
  height: 22px;
  padding: 0 5px;
}

.organization-page .panel td svg {
  margin-right: 6px;
}

.organization-page .card-grid .panel:not(.approval-panel) td:first-child {
  white-space: normal;
}

.organization-page .card-grid .panel:not(.approval-panel) td {
  white-space: nowrap;
}

.organization-page .billing-layout {
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.15fr) minmax(120px, .7fr);
}

.organization-page .spend-row {
  grid-template-columns: 92px 1fr 86px 28px;
}

.organization-page .org-rail .rail-card {
  padding: 14px;
}

@media (max-width: 1500px) {
  .organization-page .top-grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, .95fr);
  }

  .organization-page .card-grid {
    grid-template-columns: minmax(0, 1.08fr) minmax(0, .92fr) minmax(0, .92fr);
  }
}

@media (max-width: 1320px) {
  .organization-page {
    grid-template-columns: 1fr;
  }

  .organization-page .top-grid,
  .organization-page .card-grid {
    grid-template-columns: 1fr;
  }

  .organization-page .panel {
    overflow-x: auto;
  }

  .organization-page .workspace-panel table {
    min-width: 680px;
  }

  .organization-page .members-panel table {
    min-width: 520px;
  }
}

/* ── Data-state helpers (real-data wiring) ───────────────────────────────── */
.organization-page .state-banner {
  border: 1px solid #dbe7f6;
  background: #f1f6ff;
  color: #33507e;
  border-radius: 9px;
  padding: 11px 14px;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 14px;
}
.organization-page .state-banner.err {
  border-color: #f6cfcf;
  background: #fff3f3;
  color: #b4271f;
}
.organization-page .muted {
  color: #94a3b8 !important;
  font-size: 10.5px !important;
  font-weight: 550 !important;
  font-style: normal;
}
.organization-page .empty-cell {
  text-align: center;
  color: #94a3b8;
  font-weight: 550;
  padding: 18px 0 !important;
}
.organization-page .metric-card.placeholder {
  opacity: 0.72;
}
.organization-page .metric-card.placeholder strong {
  color: #94a3b8;
}
.organization-page .coming-soon .placeholder-body {
  display: grid;
  justify-items: center;
  text-align: center;
  gap: 4px;
  padding: 24px 12px;
  color: #64748b;
}
.organization-page .coming-soon .placeholder-body svg {
  width: 24px;
  height: 24px;
  color: #b8c4d6;
  margin-bottom: 4px;
}
.organization-page .coming-soon .placeholder-body p {
  font-size: 12px;
  font-weight: 650;
  color: #475569;
}
.organization-page .coming-soon .placeholder-body small {
  font-size: 10.5px;
  color: #94a3b8;
  font-weight: 500;
  max-width: 220px;
}
.organization-page .billing-cycle p.muted {
  margin-bottom: 10px;
  line-height: 1.4;
}

/* ── Modals (teleported to body) ─────────────────────────────────────────── */
.org-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(2px);
  padding: 20px;
}
.org-modal {
  width: 100%;
  max-width: 420px;
  background: #fff;
  border: 1px solid #e2e8f2;
  border-radius: 14px;
  padding: 22px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.22);
}
.org-modal h3 {
  margin: 0 0 16px;
  font-size: 17px;
  font-weight: 800;
  color: #0f172a;
}
.org-modal .form-row {
  display: grid;
  gap: 6px;
  margin-bottom: 14px;
}
.org-modal label {
  font-size: 12px;
  font-weight: 700;
  color: #475569;
}
.org-modal label small {
  color: #94a3b8;
  font-weight: 600;
}
.org-modal input,
.org-modal select {
  height: 40px;
  border: 1px solid #d9e3f0;
  border-radius: 9px;
  padding: 0 12px;
  font: inherit;
  font-size: 13px;
  color: #0f172a;
  background: #fff;
  outline: none;
}
.org-modal input:focus,
.org-modal select:focus {
  border-color: #3156e9;
  box-shadow: 0 0 0 3px rgba(49, 86, 233, 0.12);
}
.org-modal .modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}
.org-modal .btn-cancel,
.org-modal .btn-primary {
  height: 38px;
  padding: 0 18px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}
.org-modal .btn-cancel {
  border: 1px solid #d9e3f0;
  background: #fff;
  color: #334155;
}
.org-modal .btn-primary {
  border: 0;
  background: #3156e9;
  color: #fff;
}
.org-modal .btn-primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.org-modal .scope-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 4px;
  background: #f1f5f9;
  border-radius: 10px;
}
.org-modal .scope-toggle button {
  height: 34px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  font-size: 12px;
  font-weight: 750;
  color: #475569;
  cursor: pointer;
}
.org-modal .scope-toggle button.active {
  background: #fff;
  color: #1e293b;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
}
.org-modal .scope-hint {
  margin: -4px 0 2px;
  font-size: 11px;
  color: #94a3b8;
  font-weight: 550;
  line-height: 1.4;
}
.org-modal-enter-active,
.org-modal-leave-active {
  transition: opacity 0.16s ease;
}
.org-modal-enter-from,
.org-modal-leave-to {
  opacity: 0;
}

/* Real-data overview polish: compact, screen-38 style, no clipped columns. */
.organization-page .page-head { align-items: flex-start; }
.organization-page .page-head > div:first-child { min-width: 0; max-width: 690px; }
.organization-page .title-row { display: flex; align-items: center; justify-content: flex-start; gap: 10px; max-width: 100%; }
.organization-page .title-row h1 { max-width: 620px; overflow-wrap: anywhere; }
.organization-page .title-row .status-pill { flex: 0 0 auto; margin-top: 2px; }
.organization-page .head-actions { flex-wrap: wrap; justify-content: flex-end; }
.organization-page .metric-grid { grid-template-columns: repeat(6, minmax(126px, 1fr)); }
.organization-page .metric-card { min-height: 82px; }
.organization-page .metric-card.placeholder { opacity: 1; }
.organization-page .metric-card.placeholder .metric-icon { opacity: .82; }
.organization-page .metric-card.placeholder p,
.organization-page .metric-card.placeholder strong,
.organization-page .metric-card.placeholder small { color: #7b8aa5 !important; }
.organization-page .top-grid { grid-template-columns: minmax(0, 1.02fr) minmax(0, .98fr); }
.organization-page .workspace-panel,
.organization-page .members-panel { min-height: 194px; }
.organization-page .workspace-panel table,
.organization-page .members-panel table { width: 100%; min-width: 0; }
.organization-page .workspace-panel th,
.organization-page .workspace-panel td,
.organization-page .members-panel th,
.organization-page .members-panel td { padding-right: 8px !important; }
.organization-page .workspace-panel th:nth-child(1),
.organization-page .workspace-panel td:nth-child(1) { min-width: 124px; max-width: 160px; }
.organization-page .workspace-panel th:nth-child(2),
.organization-page .workspace-panel td:nth-child(2) { min-width: 140px; max-width: 180px; }
.organization-page .workspace-panel th:nth-child(3),
.organization-page .workspace-panel td:nth-child(3),
.organization-page .workspace-panel th:nth-child(4),
.organization-page .workspace-panel td:nth-child(4) { min-width: 44px; width: 52px; }
.organization-page .workspace-panel th:nth-child(5),
.organization-page .workspace-panel td:nth-child(5) { min-width: 92px; width: 104px; }
.organization-page .workspace-panel th:nth-child(6),
.organization-page .workspace-panel td:nth-child(6) { min-width: 62px; width: 66px; }
.organization-page .workspace-panel td:nth-child(1),
.organization-page .workspace-panel td:nth-child(2) { overflow: hidden; text-overflow: ellipsis; }
.organization-page .workspace-panel .budget-cell { grid-template-columns: minmax(52px, 1fr) 30px; gap: 7px; }
.organization-page .workspace-panel td:nth-child(5) .muted { display: inline-block; max-width: 88px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.organization-page .members-panel th:nth-child(1),
.organization-page .members-panel td:nth-child(1) { min-width: 210px; }
.organization-page .members-panel th:nth-child(2),
.organization-page .members-panel td:nth-child(2) { min-width: 92px; }
.organization-page .members-panel th:nth-child(3),
.organization-page .members-panel td:nth-child(3) { min-width: 74px; }
.organization-page .card-grid .panel { min-height: 134px; }
.organization-page .coming-soon .placeholder-body { min-height: 76px; padding: 16px 12px 12px; }
.organization-page .coming-soon .placeholder-body svg { width: 20px; height: 20px; }
.organization-page .bottom-grid { grid-template-columns: minmax(0, 1.45fr) minmax(340px, .95fr); }
.organization-page .billing-panel,
.organization-page .guardrail-panel { min-height: 144px; }
.organization-page .billing-layout { grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr) minmax(116px, .72fr); gap: 14px; }
.organization-page .module-card { padding-bottom: 12px; }
.organization-page .module-list { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 10px; }
.organization-page .module-list a { min-height: 28px; grid-template-columns: 16px minmax(0, 1fr); gap: 7px; font-size: 10.25px; }
.organization-page .module-list span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.organization-page .module-list svg { width: 14px; height: 14px; }
.organization-page .rail-card h2 { line-height: 1.08 !important; }

@media (max-width: 1500px) {
  .organization-page .title-row h1 { max-width: 560px; }
}

@media (max-width: 1320px) {
  .organization-page .top-grid,
  .organization-page .bottom-grid { grid-template-columns: 1fr; }
  .organization-page .workspace-panel table { min-width: 620px; }
}

/* Hard layout correction for the live organization overview. */
.organization-page {
  grid-template-columns: minmax(0, 1fr) 276px !important;
  gap: 14px !important;
  align-items: start;
}

.organization-page .org-rail {
  margin-top: 108px;
}

.organization-page .page-head {
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) max-content;
  align-items: start !important;
  gap: 18px !important;
  min-height: 94px;
  margin-bottom: 14px !important;
}

.organization-page .page-head > div:first-child {
  max-width: none !important;
}

.organization-page .title-row {
  display: inline-flex !important;
  align-items: flex-start !important;
  gap: 10px !important;
}

.organization-page .title-row h1 {
  max-width: 720px !important;
  font-size: 23px !important;
  line-height: 1.08 !important;
  overflow-wrap: normal !important;
  word-break: normal !important;
}

.organization-page .title-row .status-pill {
  margin-top: 7px !important;
}

.organization-page .head-actions {
  width: auto;
  display: flex !important;
  align-items: flex-start;
  justify-content: flex-end;
  flex-wrap: nowrap;
  gap: 10px !important;
}

.organization-page .head-actions .ghost,
.organization-page .head-actions .primary {
  width: auto;
  min-width: 0 !important;
  justify-content: center;
}

.organization-page .head-actions a:last-child {
  grid-column: auto;
}

.organization-page .metric-grid {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  gap: 12px !important;
}

.organization-page .metric-card {
  min-width: 0;
  min-height: 84px !important;
  padding: 13px 14px !important;
}

.organization-page .top-grid {
  grid-template-columns: minmax(0, 1.04fr) minmax(0, .96fr) !important;
  gap: 12px !important;
  align-items: stretch;
}

.organization-page .workspace-panel,
.organization-page .members-panel {
  min-width: 0;
  min-height: 176px !important;
  overflow: hidden !important;
}

.organization-page .workspace-panel table,
.organization-page .members-panel table {
  table-layout: fixed !important;
  width: 100% !important;
  min-width: 0 !important;
}

.organization-page .workspace-panel th,
.organization-page .workspace-panel td {
  padding-right: 6px !important;
  white-space: nowrap !important;
}

.organization-page .workspace-panel th:nth-child(1),
.organization-page .workspace-panel td:nth-child(1) {
  width: 30% !important;
  min-width: 0 !important;
  max-width: none !important;
}

.organization-page .workspace-panel th:nth-child(2),
.organization-page .workspace-panel td:nth-child(2) {
  width: 30% !important;
  min-width: 0 !important;
  max-width: none !important;
}

.organization-page .workspace-panel th:nth-child(3),
.organization-page .workspace-panel td:nth-child(3) {
  width: 12% !important;
  min-width: 0 !important;
}

.organization-page .workspace-panel th:nth-child(4),
.organization-page .workspace-panel td:nth-child(4) {
  width: 10% !important;
  min-width: 0 !important;
}

.organization-page .workspace-panel th:nth-child(5),
.organization-page .workspace-panel td:nth-child(5) {
  width: 18% !important;
  min-width: 0 !important;
}

.organization-page .workspace-panel th:nth-child(6),
.organization-page .workspace-panel td:nth-child(6) {
  display: none;
}

.organization-page .table-cell-inline {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  max-width: 100%;
}

.organization-page .truncate-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.organization-page .workspace-panel .table-icon,
.organization-page .workspace-panel .avatar {
  flex: 0 0 auto;
}

.organization-page .workspace-panel .budget-cell {
  grid-template-columns: minmax(0, 1fr) 30px !important;
  gap: 6px !important;
}

.organization-page .budget-muted {
  max-width: 76px !important;
}

.organization-page .members-panel th:nth-child(1),
.organization-page .members-panel td:nth-child(1) {
  width: 58% !important;
  min-width: 0 !important;
}

.organization-page .members-panel th:nth-child(2),
.organization-page .members-panel td:nth-child(2) {
  width: 22% !important;
  min-width: 0 !important;
}

.organization-page .members-panel th:nth-child(3),
.organization-page .members-panel td:nth-child(3) {
  width: 20% !important;
  min-width: 0 !important;
}

.organization-page .card-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
}

.organization-page .card-grid .panel {
  min-height: 126px !important;
}

.organization-page .bottom-grid {
  grid-template-columns: minmax(0, 1.43fr) minmax(0, .96fr) !important;
}

.organization-page .module-list {
  grid-template-columns: 1fr 1fr !important;
}

@media (max-width: 1320px) {
  .organization-page {
    grid-template-columns: 1fr !important;
  }

  .organization-page .org-rail {
    margin-top: 0;
  }

  .organization-page .top-grid,
  .organization-page .bottom-grid,
  .organization-page .card-grid {
    grid-template-columns: 1fr !important;
  }
}
</style>
