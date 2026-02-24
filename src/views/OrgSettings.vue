<template>
  <div class="org-settings">
    <!-- Page Header -->
    <div class="settings-header">
      <div class="settings-header-left">
        <router-link to="/dashboard" class="settings-back">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/></svg>
          Back
        </router-link>
        <div class="settings-org-info">
          <div class="settings-org-avatar" :style="{ background: orgColor }">
            {{ org?.name?.charAt(0) ?? '?' }}
          </div>
          <div>
            <h1 class="settings-title">{{ org?.name ?? '…' }}</h1>
            <span class="settings-subtitle">Organisation Settings</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Layout -->
    <div class="settings-layout">
      <!-- Sidebar Tabs -->
      <aside class="settings-sidebar">
        <nav>
          <div class="sidebar-group">
            <div class="sidebar-label">Organisation</div>
            <button
              v-for="tab in orgTabs"
              :key="tab.key"
              class="settings-tab"
              :class="{ 'settings-tab--active': activeTab === tab.key }"
              @click="activeTab = tab.key"
            >
              <span class="tab-icon" v-html="tab.icon"></span>
              {{ tab.label }}
            </button>
          </div>
          <div class="sidebar-group">
            <div class="sidebar-label">Platform</div>
            <button
              v-for="tab in platformTabs"
              :key="tab.key"
              class="settings-tab"
              :class="{ 'settings-tab--active': activeTab === tab.key }"
              @click="activeTab = tab.key"
            >
              <span class="tab-icon" v-html="tab.icon"></span>
              {{ tab.label }}
              <span v-if="tab.soon" class="soon-dot"></span>
            </button>
          </div>
          <div class="sidebar-group">
            <div class="sidebar-label">Admin</div>
            <button
              class="settings-tab settings-tab--danger"
              :class="{ 'settings-tab--active': activeTab === 'danger' }"
              @click="activeTab = 'danger'"
            >
              <span class="tab-icon"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg></span>
              Danger Zone
            </button>
          </div>
        </nav>
      </aside>

      <!-- Panel -->
      <main class="settings-panel">
        <!-- ─── General ───────────────────────────────── -->
        <section v-if="activeTab === 'general'" class="settings-section">
          <h2 class="settings-section-title">General</h2>
          <div class="settings-card">
            <div class="form-row">
              <label>Organisation Name</label>
              <input v-model="form.name" class="settings-input" placeholder="Acme Corp" />
            </div>
            <div class="form-row">
              <label>Slug</label>
              <div class="input-prefix-wrap">
                <span class="input-prefix">app.system/</span>
                <input v-model="form.slug" class="settings-input settings-input--prefix" placeholder="acme-corp" />
              </div>
            </div>
            <div class="settings-card-footer">
              <button class="btn-primary" @click="saveGeneral" :disabled="saving">
                {{ saving ? 'Saving…' : 'Save Changes' }}
              </button>
            </div>
          </div>
        </section>

        <!-- ─── Members ───────────────────────────────── -->
        <section v-if="activeTab === 'members'" class="settings-section">
          <div class="section-header-row">
            <h2 class="settings-section-title">Members <span class="count-badge">{{ members.length }}</span></h2>
            <button class="btn-primary btn-sm" @click="showInvite = !showInvite">
              <svg viewBox="0 0 20 20" fill="currentColor" class="btn-icon"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
              Invite
            </button>
          </div>

          <!-- Invite Row -->
          <div v-if="showInvite" class="invite-row">
            <input v-model="inviteEmail" type="email" class="settings-input" placeholder="colleague@company.com" @keydown.enter="inviteMember" />
            <select v-model="inviteRole" class="settings-select">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
            <button class="btn-primary btn-sm" @click="inviteMember" :disabled="inviting">
              {{ inviting ? 'Inviting…' : 'Send Invite' }}
            </button>
          </div>

          <!-- Member List -->
          <div class="settings-card">
            <div v-if="loadingMembers" class="loading-row">
              <div class="spinner"></div> Loading members…
            </div>
            <div v-else-if="!members.length" class="empty-state">
              No members yet. Invite your team to get started.
            </div>
            <div
              v-else
              v-for="m in members"
              :key="m.user?.id ?? m.id"
              class="member-row"
            >
              <div class="member-avatar">{{ (m.username || m.user?.username || '?').charAt(0).toUpperCase() }}</div>
              <div class="member-info">
                <span class="member-name">{{ m.username || m.user?.username }}</span>
                <span class="member-email">{{ m.email || m.user?.email }}</span>
              </div>
              <span class="role-badge" :class="`role-${m.role}`">{{ m.role }}</span>
              <div class="member-actions">
                <select
                  v-if="m.role !== 'owner'"
                  :value="m.role"
                  class="settings-select settings-select--sm"
                  @change="changeRole(m, $event.target.value)"
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  v-if="m.role !== 'owner'"
                  class="btn-danger-ghost btn-sm"
                  @click="removeMember(m)"
                >Remove</button>
              </div>
            </div>
          </div>

          <!-- Pending Invites -->
          <div v-if="pendingInvites.length" style="margin-top: 24px;">
            <h3 class="settings-section-title" style="font-size: 15px; margin-bottom: 12px;">Pending Invites <span class="count-badge">{{ pendingInvites.length }}</span></h3>
            <div class="settings-card">
              <div
                v-for="inv in pendingInvites"
                :key="inv.id"
                class="member-row"
              >
                <div class="member-avatar" style="background: rgba(251,146,60,0.15); color: #fb923c;">✉</div>
                <div class="member-info">
                  <span class="member-name">{{ inv.email }}</span>
                  <span class="member-email">
                    Invited {{ timeAgo(inv.created_at) }}
                    <template v-if="inv.invited_by_username"> by {{ inv.invited_by_username }}</template>
                    · Expires {{ timeAgo(inv.expires_at, true) }}
                  </span>
                </div>
                <span class="role-badge role-pending" :class="inv.is_expired ? 'role-expired' : ''">{{ inv.is_expired ? 'Expired' : 'Pending' }}</span>
                <div class="member-actions">
                  <button v-if="!inv.is_expired" class="btn-ghost btn-sm" @click="resendInvite(inv)" :disabled="inv._resending">
                    {{ inv._resending ? '…' : 'Resend' }}
                  </button>
                  <button class="btn-danger-ghost btn-sm" @click="cancelInvite(inv)">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ─── Workspaces ────────────────────────────── -->
        <section v-if="activeTab === 'workspaces'" class="settings-section">
          <div class="section-header-row">
            <h2 class="settings-section-title">Workspaces <span class="count-badge">{{ workspaces.length }}</span></h2>
            <button class="btn-primary btn-sm" @click="showCreateWs = true">
              <svg viewBox="0 0 20 20" fill="currentColor" class="btn-icon"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
              New Workspace
            </button>
          </div>
          <div class="ws-grid-list">
            <div v-if="loadingWs" class="loading-row">
              <div class="spinner"></div> Loading…
            </div>
            <router-link
              v-else
              v-for="ws in workspaces"
              :key="ws.id"
              :to="`/workspace/${ws.id}`"
              class="ws-list-card"
            >
              <div class="ws-list-left">
                <span class="ws-list-dot" :style="{ background: stringToColor(ws.name) }"></span>
                <div class="ws-list-info">
                  <span class="ws-list-name">{{ ws.name }}</span>
                  <span class="ws-list-meta">{{ ws.member_count ?? 0 }} members · {{ ws.slug }}</span>
                </div>
              </div>
              <svg class="ws-list-arrow" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
              </svg>
            </router-link>
            <div v-if="!loadingWs && !workspaces.length" class="empty-state">
              No workspaces yet. Create one to organize your team's resources.
            </div>
          </div>
        </section>

        <!-- ─── Billing (Placeholder) ─────────────────── -->
        <section v-if="activeTab === 'billing'" class="settings-section">
          <h2 class="settings-section-title">Billing & Usage</h2>
          <div class="placeholder-card">
            <div class="placeholder-icon">💳</div>
            <h3 class="placeholder-title">Billing Management</h3>
            <p class="placeholder-desc">Manage your subscription, view usage metrics, update payment methods, and download invoices.</p>
            <div class="placeholder-features">
              <div class="placeholder-feature">
                <span class="pf-icon">📊</span>
                <div>
                  <span class="pf-title">Usage Dashboard</span>
                  <span class="pf-desc">Track API calls, compute hours, and storage</span>
                </div>
              </div>
              <div class="placeholder-feature">
                <span class="pf-icon">💰</span>
                <div>
                  <span class="pf-title">Plans & Pricing</span>
                  <span class="pf-desc">Free, Pro, and Enterprise tiers</span>
                </div>
              </div>
              <div class="placeholder-feature">
                <span class="pf-icon">🧾</span>
                <div>
                  <span class="pf-title">Invoice History</span>
                  <span class="pf-desc">Download past invoices and receipts</span>
                </div>
              </div>
            </div>
            <div class="placeholder-badge">Coming Soon</div>
          </div>
        </section>

        <!-- ─── API Keys (Placeholder) ────────────────── -->
        <section v-if="activeTab === 'api-keys'" class="settings-section">
          <h2 class="settings-section-title">API Keys</h2>
          <div class="placeholder-card">
            <div class="placeholder-icon">🔑</div>
            <h3 class="placeholder-title">API Key Management</h3>
            <p class="placeholder-desc">Generate and manage API keys for programmatic access to your organisation's resources.</p>
            <div class="placeholder-features">
              <div class="placeholder-feature">
                <span class="pf-icon">🔐</span>
                <div>
                  <span class="pf-title">Scoped Keys</span>
                  <span class="pf-desc">Create keys with specific permissions</span>
                </div>
              </div>
              <div class="placeholder-feature">
                <span class="pf-icon">📋</span>
                <div>
                  <span class="pf-title">Audit Log</span>
                  <span class="pf-desc">Track key usage across your org</span>
                </div>
              </div>
              <div class="placeholder-feature">
                <span class="pf-icon">⏱️</span>
                <div>
                  <span class="pf-title">Expiration Policies</span>
                  <span class="pf-desc">Auto-rotate keys on a schedule</span>
                </div>
              </div>
            </div>
            <div class="placeholder-badge">Coming Soon</div>
          </div>
        </section>

        <!-- ─── Security (Placeholder) ────────────────── -->
        <section v-if="activeTab === 'security'" class="settings-section">
          <h2 class="settings-section-title">Security</h2>
          <div class="placeholder-card">
            <div class="placeholder-icon">🛡️</div>
            <h3 class="placeholder-title">Security Settings</h3>
            <p class="placeholder-desc">Configure authentication, access controls, and security policies for your organisation.</p>
            <div class="placeholder-features">
              <div class="placeholder-feature">
                <span class="pf-icon">🔒</span>
                <div>
                  <span class="pf-title">Single Sign-On (SSO)</span>
                  <span class="pf-desc">SAML and OIDC integration</span>
                </div>
              </div>
              <div class="placeholder-feature">
                <span class="pf-icon">📱</span>
                <div>
                  <span class="pf-title">Two-Factor Authentication</span>
                  <span class="pf-desc">Enforce 2FA for all members</span>
                </div>
              </div>
              <div class="placeholder-feature">
                <span class="pf-icon">⏳</span>
                <div>
                  <span class="pf-title">Session Management</span>
                  <span class="pf-desc">Timeout policies and active sessions</span>
                </div>
              </div>
            </div>
            <div class="placeholder-badge">Coming Soon</div>
          </div>
        </section>

        <!-- ─── Danger Zone ───────────────────────────── -->
        <section v-if="activeTab === 'danger'" class="settings-section">
          <h2 class="settings-section-title settings-section-title--danger">Danger Zone</h2>
          <div class="danger-card">
            <div class="danger-item">
              <div class="danger-info">
                <span class="danger-label">Transfer Ownership</span>
                <span class="danger-desc">Transfer this organisation to another member. You will lose owner privileges.</span>
              </div>
              <button class="btn-outline-danger" disabled>Transfer</button>
            </div>
            <div class="danger-divider"></div>
            <div class="danger-item">
              <div class="danger-info">
                <span class="danger-label">Delete Organisation</span>
                <span class="danger-desc">Permanently delete this organisation and all its workspaces, members, and data. This action cannot be undone.</span>
              </div>
              <button class="btn-danger" @click="deleteOrg" :disabled="deleting">
                {{ deleting ? 'Deleting…' : 'Delete Organisation' }}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>

    <!-- Create Workspace Modal -->
    <Teleport to="body">
      <transition name="ws-modal">
        <div v-if="showCreateWs" class="create-ws-backdrop" @click.self="showCreateWs = false">
          <div class="create-ws-modal">
            <h3 class="create-ws-title">New Workspace</h3>
            <div>
              <div class="form-row">
                <label>Name</label>
                <input v-model="newWsName" placeholder="e.g. Engineering" class="settings-input" @keydown.enter="createWorkspace" />
              </div>
              <div class="form-row">
                <label>Slug</label>
                <input v-model="newWsSlug" :placeholder="newWsName ? newWsName.toLowerCase().replace(/\s+/g, '-') : 'engineering'" class="settings-input" />
              </div>
              <div class="create-ws-actions">
                <button type="button" class="btn-cancel" @click="showCreateWs = false">Cancel</button>
                <button type="button" class="btn-primary btn-sm" :disabled="creatingWs || !newWsName" @click="createWorkspace">
                  {{ creatingWs ? 'Creating…' : 'Create' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import tenancyApi from '../services/tenancyApi'

const route = useRoute()
const orgSlug = computed(() => route.params.orgSlug)

const org           = ref(null)
const members       = ref([])
const workspaces    = ref([])
const loadingMembers = ref(false)
const loadingWs     = ref(false)
const saving        = ref(false)
const deleting      = ref(false)
const showInvite    = ref(false)
const inviteEmail   = ref('')
const inviteRole    = ref('member')
const inviting      = ref(false)
const pendingInvites = ref([])
const showCreateWs  = ref(false)
const newWsName     = ref('')
const newWsSlug     = ref('')
const creatingWs    = ref(false)

const form = ref({ name: '', slug: '' })

const activeTab = ref(route.params.tab || 'general')

const orgTabs = [
  { key: 'general',    label: 'General',    icon: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.062 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/></svg>' },
  { key: 'members',    label: 'Members',    icon: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>' },
  { key: 'workspaces', label: 'Workspaces', icon: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>' },
]

const platformTabs = [
  { key: 'billing',    label: 'Billing',    soon: true, icon: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clip-rule="evenodd"/></svg>' },
  { key: 'api-keys',   label: 'API Keys',   soon: true, icon: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clip-rule="evenodd"/></svg>' },
  { key: 'security',   label: 'Security',   soon: true, icon: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>' },
]

const orgColor = computed(() => stringToColor(org.value?.name ?? '?'))

function stringToColor(str) {
  const palette = ['#6366f1','#8b5cf6','#ec4899','#14b8a6','#f59e0b','#10b981','#3b82f6']
  let h = 0; for (let c of str) h = c.charCodeAt(0) + ((h << 5) - h)
  return palette[Math.abs(h) % palette.length]
}

async function load() {
  try {
    const r = await tenancyApi.getOrg(orgSlug.value)
    org.value = r.data
    form.value = { name: r.data.name, slug: r.data.slug }
  } catch {}
}

async function loadMembers() {
  loadingMembers.value = true
  try {
    const r = await tenancyApi.getOrgMembers(orgSlug.value)
    members.value = r.data?.results ?? r.data ?? []
  } catch {}
  loadingMembers.value = false
}

async function loadWorkspaces() {
  loadingWs.value = true
  try {
    const r = await tenancyApi.getWorkspaces(orgSlug.value)
    workspaces.value = r.data?.results ?? r.data ?? []
  } catch {}
  loadingWs.value = false
}

async function saveGeneral() {
  saving.value = true
  try { await tenancyApi.updateOrg(orgSlug.value, form.value) } catch {}
  saving.value = false
}

async function inviteMember() {
  if (!inviteEmail.value || inviting.value) return
  inviting.value = true
  try {
    await tenancyApi.inviteOrgMember(orgSlug.value, {
      email: inviteEmail.value,
      role: inviteRole.value,
    })
    inviteEmail.value = ''
    showInvite.value = false
    await loadInvites()
  } catch (err) {
    const data = err?.response?.data
    const msg = data?.detail || data?.error || 'Invite failed'
    alert(msg)
  }
  inviting.value = false
}

async function loadInvites() {
  try {
    const r = await tenancyApi.getOrgInvites(orgSlug.value)
    pendingInvites.value = (r.data?.results ?? r.data ?? []).map(i => ({ ...i, _resending: false }))
  } catch {}
}

async function resendInvite(inv) {
  inv._resending = true
  try {
    await tenancyApi.resendInvite(orgSlug.value, inv.id)
    await loadInvites()
  } catch {}
  inv._resending = false
}

async function cancelInvite(inv) {
  if (!confirm(`Cancel invite to ${inv.email}?`)) return
  try {
    await tenancyApi.cancelInvite(orgSlug.value, inv.id)
    pendingInvites.value = pendingInvites.value.filter(x => x.id !== inv.id)
  } catch {}
}

function timeAgo(dateStr, future = false) {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = future ? d - now : now - d
  const mins = Math.round(diff / 60000)
  if (mins < 1) return future ? 'soon' : 'just now'
  if (mins < 60) return `${mins}m ${future ? 'from now' : 'ago'}`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ${future ? 'from now' : 'ago'}`
  const days = Math.round(hrs / 24)
  return `${days}d ${future ? 'from now' : 'ago'}`
}

async function createWorkspace() {
  if (!newWsName.value) return
  creatingWs.value = true
  try {
    await tenancyApi.createWorkspace(orgSlug.value, {
      name: newWsName.value,
      slug: newWsSlug.value || newWsName.value.toLowerCase().replace(/\s+/g, '-'),
    })
    showCreateWs.value = false
    newWsName.value = ''
    newWsSlug.value = ''
    await loadWorkspaces()
  } catch (err) {
    alert(err?.response?.data?.detail || err?.response?.data?.name?.[0] || 'Failed to create workspace')
  }
  creatingWs.value = false
}

async function changeRole(m, role) {
  try {
    await tenancyApi.updateOrgMemberRole(orgSlug.value, m.user, { role })
    m.role = role
  } catch {}
}

async function removeMember(m) {
  if (!confirm(`Remove ${m.username}?`)) return
  try {
    await tenancyApi.removeOrgMember(orgSlug.value, m.user)
    members.value = members.value.filter(x => x.user !== m.user)
  } catch {}
}

async function deleteOrg() {
  if (!confirm(`Permanently delete "${org.value?.name}"? This cannot be undone.`)) return
  deleting.value = true
  try {
    await tenancyApi.deleteOrg(orgSlug.value)
    window.location.href = '/dashboard'
  } catch {}
  deleting.value = false
}

watch(activeTab, (tab) => {
  if (tab === 'members' && !members.value.length) { loadMembers(); loadInvites() }
  if (tab === 'workspaces' && !workspaces.value.length) loadWorkspaces()
})

onMounted(() => {
  load()
  if (activeTab.value === 'members') { loadMembers(); loadInvites() }
  if (activeTab.value === 'workspaces') loadWorkspaces()
})
</script>

<style scoped>
.org-settings {
  min-height: 100vh;
  background: #030712;
  color: #f9fafb;
  padding: 0 0 80px;
}

/* Header */
.settings-header {
  padding: 24px 40px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  background: rgba(17,24,39,0.6);
  backdrop-filter: blur(12px);
  position: sticky; top: 0; z-index: 10;
}
.settings-header-left { display: flex; align-items: center; gap: 20px; }
.settings-back {
  display: flex; align-items: center; gap: 6px;
  color: #9ca3af; font-size: 13px; text-decoration: none;
  transition: color 0.15s;
}
.settings-back:hover { color: #f9fafb; }
.settings-back svg { width: 14px; height: 14px; }
.settings-org-avatar {
  width: 44px; height: 44px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; font-weight: 700; color: #fff;
  flex-shrink: 0;
}
.settings-org-info { display: flex; align-items: center; gap: 14px; }
.settings-title { font-size: 20px; font-weight: 700; color: #f9fafb; margin: 0; }
.settings-subtitle { font-size: 12px; color: #6b7280; }

/* Layout */
.settings-layout { display: flex; max-width: 1100px; margin: 0 auto; padding: 32px 40px; gap: 32px; }

/* Sidebar */
.settings-sidebar { width: 200px; flex-shrink: 0; }
.sidebar-group { margin-bottom: 24px; }
.sidebar-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em; color: #4b5563;
  padding: 0 12px; margin-bottom: 6px;
}
.settings-tab {
  display: flex; align-items: center; gap: 10px;
  width: 100%;
  padding: 9px 12px;
  border-radius: 8px;
  background: none; border: none;
  color: #9ca3af; font-size: 13.5px;
  cursor: pointer; text-align: left;
  transition: all 0.12s ease;
  margin-bottom: 2px;
  position: relative;
}
.settings-tab:hover { background: rgba(255,255,255,0.05); color: #e2e8f0; }
.settings-tab--active { background: rgba(139,92,246,0.12); color: #a78bfa; font-weight: 600; }
.settings-tab--danger { color: #f87171; }
.settings-tab--danger:hover { background: rgba(239,68,68,0.08); }
.settings-tab--danger.settings-tab--active { background: rgba(239,68,68,0.12); }
.tab-icon { width: 16px; height: 16px; display: flex; align-items: center; flex-shrink: 0; }
.tab-icon svg { width: 16px; height: 16px; }
.soon-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #f59e0b; margin-left: auto; flex-shrink: 0;
}

/* Panel */
.settings-panel { flex: 1; min-width: 0; }
.settings-section-title {
  font-size: 17px; font-weight: 700; color: #f9fafb;
  margin: 0 0 18px; display: flex; align-items: center; gap: 10px;
}
.settings-section-title--danger { color: #f87171; }
.section-header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
.section-header-row .settings-section-title { margin: 0; }
.count-badge {
  background: rgba(255,255,255,0.08); color: #9ca3af;
  font-size: 12px; font-weight: 500;
  padding: 2px 8px; border-radius: 20px;
}

/* Card */
.settings-card {
  background: rgba(31,41,55,0.5);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 12px;
  overflow: hidden;
}
.settings-card-footer { padding: 16px 20px; border-top: 1px solid rgba(255,255,255,0.07); display: flex; justify-content: flex-end; }

/* Form */
.form-row { padding: 18px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); }
.form-row:last-of-type { border-bottom: none; }
.form-row label { display: block; font-size: 12px; color: #9ca3af; margin-bottom: 8px; font-weight: 500; }
.settings-input {
  width: 100%; box-sizing: border-box;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px; color: #f9fafb;
  padding: 9px 12px; font-size: 14px; outline: none;
  transition: border-color 0.15s;
}
.settings-input:focus { border-color: #8b5cf6; }
.input-prefix-wrap { display: flex; align-items: center; }
.input-prefix { color: #6b7280; font-size: 13px; padding-right: 6px; white-space: nowrap; }
.settings-input--prefix { flex: 1; }
.settings-select {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px; color: #f9fafb;
  padding: 8px 12px; font-size: 13px; outline: none; cursor: pointer;
}
.settings-select--sm { padding: 5px 8px; font-size: 12px; }

/* Members */
.member-row {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.member-row:last-child { border-bottom: none; }
.member-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 14px; color: #fff;
  flex-shrink: 0;
}
.member-info { flex: 1; min-width: 0; }
.member-name { display: block; font-size: 14px; font-weight: 500; color: #f9fafb; }
.member-email { font-size: 12px; color: #9ca3af; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.member-actions { display: flex; align-items: center; gap: 8px; }
.role-badge { padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; }
.role-owner  { background: rgba(245,158,11,0.15); color: #fbbf24; }
.role-admin  { background: rgba(139,92,246,0.15); color: #a78bfa; }
.role-member { background: rgba(16,185,129,0.12); color: #34d399; }
.role-viewer { background: rgba(156,163,175,0.12); color: #9ca3af; }
.role-pending { background: rgba(251,146,60,0.12); color: #fb923c; }
.role-expired { background: rgba(239,68,68,0.12); color: #f87171; }

/* Invite */
.invite-row {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 14px;
  padding: 14px 20px;
  background: rgba(31,41,55,0.5);
  border: 1px solid rgba(139,92,246,0.2);
  border-radius: 10px;
}

/* Workspace list */
.ws-grid-list {
  background: rgba(31,41,55,0.5);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 12px; overflow: hidden;
}
.ws-list-card {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px;
  text-decoration: none; color: #d1d5db;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  transition: background 0.12s;
}
.ws-list-card:last-child { border-bottom: none; }
.ws-list-card:hover { background: rgba(255,255,255,0.04); color: #f9fafb; }
.ws-list-left { display: flex; align-items: center; gap: 14px; }
.ws-list-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.ws-list-info { display: flex; flex-direction: column; }
.ws-list-name { font-weight: 600; font-size: 14px; color: #f9fafb; }
.ws-list-meta { font-size: 12px; color: #6b7280; margin-top: 2px; }
.ws-list-arrow { width: 16px; height: 16px; color: #4b5563; }

/* Placeholder (Coming Soon) */
.placeholder-card {
  background: rgba(31,41,55,0.5);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 16px;
  padding: 40px 32px;
  text-align: center;
  position: relative;
  overflow: hidden;
}
.placeholder-card::before {
  content: '';
  position: absolute; inset: 0;
  background: radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.06) 0%, transparent 70%);
  pointer-events: none;
}
.placeholder-icon { font-size: 48px; margin-bottom: 16px; }
.placeholder-title {
  font-size: 18px; font-weight: 700; color: #f9fafb;
  margin: 0 0 8px;
}
.placeholder-desc {
  font-size: 14px; color: #9ca3af;
  max-width: 440px; margin: 0 auto 28px;
  line-height: 1.6;
}
.placeholder-features {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px; text-align: left;
  max-width: 600px; margin: 0 auto 24px;
}
.placeholder-feature {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 14px; border-radius: 10px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.05);
}
.pf-icon { font-size: 20px; flex-shrink: 0; margin-top: 1px; }
.pf-title { display: block; font-size: 13px; font-weight: 600; color: #e2e8f0; margin-bottom: 2px; }
.pf-desc { display: block; font-size: 11.5px; color: #6b7280; line-height: 1.4; }
.placeholder-badge {
  display: inline-flex; align-items: center;
  padding: 6px 16px; border-radius: 20px;
  background: rgba(139,92,246,0.12);
  color: #a78bfa; font-size: 12px; font-weight: 600;
  letter-spacing: 0.04em;
}

/* Danger Zone */
.danger-card {
  background: rgba(31,41,55,0.5);
  border: 1px solid rgba(239,68,68,0.2);
  border-radius: 12px; overflow: hidden;
}
.danger-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 24px; gap: 20px;
}
.danger-divider { border-top: 1px solid rgba(239,68,68,0.1); }
.danger-info { flex: 1; }
.danger-label { display: block; font-size: 14px; font-weight: 600; color: #f9fafb; margin-bottom: 4px; }
.danger-desc { font-size: 12.5px; color: #9ca3af; line-height: 1.5; }

/* Buttons */
.btn-primary {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 9px 18px; border-radius: 8px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border: none; color: #fff; font-size: 13.5px; font-weight: 600;
  cursor: pointer; transition: opacity 0.15s;
}
.btn-primary:hover:not(:disabled) { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-sm { padding: 6px 12px; font-size: 12.5px; }
.btn-icon { width: 13px; height: 13px; }
.btn-danger-ghost {
  background: none; border: 1px solid rgba(239,68,68,0.3);
  color: #f87171; border-radius: 6px; cursor: pointer;
  font-size: 12px; padding: 4px 10px;
  transition: all 0.12s;
}
.btn-danger-ghost:hover { background: rgba(239,68,68,0.1); }
.btn-danger {
  padding: 8px 16px; border-radius: 8px;
  background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3);
  color: #f87171; font-size: 13px; font-weight: 600;
  cursor: pointer; transition: all 0.15s; white-space: nowrap;
}
.btn-danger:hover:not(:disabled) { background: rgba(239,68,68,0.2); }
.btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-outline-danger {
  padding: 8px 16px; border-radius: 8px;
  background: none; border: 1px solid rgba(239,68,68,0.2);
  color: #9ca3af; font-size: 13px; font-weight: 600;
  cursor: pointer; transition: all 0.15s; white-space: nowrap;
}
.btn-outline-danger:hover:not(:disabled) { border-color: rgba(239,68,68,0.4); color: #f87171; }
.btn-outline-danger:disabled { opacity: 0.4; cursor: not-allowed; }

.loading-row { display: flex; align-items: center; gap: 10px; padding: 20px; color: #9ca3af; font-size: 13px; }
.empty-state { padding: 24px 20px; text-align: center; color: #6b7280; font-size: 13px; }
.spinner {
  width: 16px; height: 16px;
  border: 2px solid rgba(139,92,246,0.3);
  border-top-color: #8b5cf6;
  border-radius: 50%; animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>

<style>
/* Teleported modal styles (must be global) */
.create-ws-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(4px);
  z-index: 100000;
  display: flex; align-items: center; justify-content: center;
}
.create-ws-modal {
  background: #111827;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  padding: 28px;
  width: 380px;
  box-shadow: 0 24px 80px rgba(0,0,0,0.7);
}
.create-ws-title { font-size: 17px; font-weight: 600; color: #f9fafb; margin: 0 0 20px; }
.create-ws-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 24px; }
.btn-cancel {
  padding: 8px 16px; border-radius: 8px;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  color: #9ca3af; cursor: pointer; font-size: 13.5px;
  transition: all 0.15s;
}
.btn-cancel:hover { color: #e2e8f0; }
.ws-modal-enter-active, .ws-modal-leave-active { transition: all 0.2s ease; }
.ws-modal-enter-from, .ws-modal-leave-to { opacity: 0; transform: scale(0.94); }
</style>
