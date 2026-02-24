<template>
  <div class="ws-dash">
    <!-- Header -->
    <div class="wsd-header">
      <div class="wsd-header-left">
        <router-link :to="orgSlug ? `/org/${orgSlug}/settings/workspaces` : '/dashboard'" class="wsd-back">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/></svg>
          {{ workspace?.organization_name || 'Back' }}
        </router-link>
        <div class="wsd-title-group">
          <span class="wsd-dot" :style="{ background: wsColor }"></span>
          <h1 class="wsd-title">{{ workspace?.name ?? '…' }}</h1>
          <span class="wsd-subtitle">Workspace</span>
        </div>
      </div>
      <div class="wsd-header-right">
        <span class="wsd-member-count">
          <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
          {{ members.length }} members
        </span>
      </div>
    </div>

    <!-- Layout: Sidebar + Panel -->
    <div class="wsd-layout">
      <!-- Sidebar -->
      <aside class="wsd-sidebar">
        <nav>
          <div class="sidebar-group">
            <div class="sidebar-label">Workspace</div>
            <button
              v-for="tab in workspaceTabs"
              :key="tab.key"
              class="wsd-tab"
              :class="{ 'wsd-tab--active': activeTab === tab.key }"
              @click="setTab(tab.key)"
            >
              <span class="tab-icon" v-html="tab.icon"></span>
              {{ tab.label }}
              <span v-if="tab.count !== undefined" class="tab-count">{{ tab.count }}</span>
            </button>
          </div>
          <div class="sidebar-group">
            <div class="sidebar-label">Manage</div>
            <button
              v-for="tab in manageTabs"
              :key="tab.key"
              class="wsd-tab"
              :class="{ 'wsd-tab--active': activeTab === tab.key }"
              @click="setTab(tab.key)"
            >
              <span class="tab-icon" v-html="tab.icon"></span>
              {{ tab.label }}
              <span v-if="tab.soon" class="soon-dot"></span>
            </button>
          </div>
        </nav>
      </aside>

      <!-- Panel -->
      <main class="wsd-panel">
        <!-- ─── Overview ──────────────────────────────── -->
        <section v-if="activeTab === 'overview'">
          <!-- Stats Row -->
          <div class="overview-stats">
            <div class="ov-stat" @click="setTab('agents')">
              <span class="ov-stat-value">{{ agents.length }}</span>
              <span class="ov-stat-label">Agents</span>
            </div>
            <div class="ov-stat" @click="setTab('services')">
              <span class="ov-stat-value">{{ services.length }}</span>
              <span class="ov-stat-label">Services</span>
            </div>
            <div class="ov-stat" @click="setTab('mcp')">
              <span class="ov-stat-value">{{ mcpServers.length }}</span>
              <span class="ov-stat-label">MCP Servers</span>
            </div>
            <div class="ov-stat" @click="setTab('members')">
              <span class="ov-stat-value">{{ members.length }}</span>
              <span class="ov-stat-label">Members</span>
            </div>
          </div>

          <!-- Two-column: Activity + Info -->
          <div class="overview-grid">
            <div class="ov-activity">
              <h3 class="panel-section-title">Recent Activity</h3>
              <div v-if="!activity.length" class="empty-block"><p>No recent activity.</p></div>
              <div v-else class="activity-list">
                <div v-for="(ev, i) in activity" :key="i" class="activity-row">
                  <span class="activity-status" :class="ev.status === 'success' ? 'status-ok' : 'status-err'">
                    {{ ev.status === 'success' ? '✓' : '✗' }}
                  </span>
                  <span class="activity-tool">{{ ev.tool_name }}</span>
                  <span class="activity-time">{{ formatTime(ev.executed_at) }}</span>
                  <span v-if="ev.duration_ms" class="activity-duration">{{ ev.duration_ms }}ms</span>
                </div>
              </div>
            </div>
            <div class="ov-info">
              <h3 class="panel-section-title">Workspace Info</h3>
              <div class="info-card">
                <div class="info-row"><span class="info-label">Organisation</span><span class="info-value">{{ workspace?.organization_name ?? '—' }}</span></div>
                <div class="info-row"><span class="info-label">Slug</span><span class="info-value mono">{{ workspace?.slug ?? '—' }}</span></div>
                <div class="info-row"><span class="info-label">Created</span><span class="info-value">{{ workspace?.created_at ? new Date(workspace.created_at).toLocaleDateString() : '—' }}</span></div>
              </div>
            </div>
          </div>
        </section>

        <!-- ─── Agents ────────────────────────────────── -->
        <section v-if="activeTab === 'agents'">
          <div class="section-header-row">
            <h2 class="panel-section-title">Agents <span class="count-badge">{{ agents.length }}</span></h2>
            <button class="add-resource-btn" @click="openPicker('agents')">
              <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
              Add Agent
            </button>
          </div>
          <div v-if="loading" class="loading-block"><div class="spinner"></div> Loading…</div>
          <div v-else-if="!agents.length" class="empty-block">
            <div class="empty-icon">🤖</div>
            <p>No agents linked to this workspace.</p>
            <button class="empty-link" @click="openPicker('agents')">+ Add Agent</button>
          </div>
          <div v-else class="resource-grid">
            <div v-for="a in agents" :key="a.bridge_id || a.id" class="resource-card">
              <div class="resource-card-header">
                <span class="resource-icon">🤖</span>
                <button class="unlink-btn" @click.stop="unlinkResource('agents', a)" title="Remove from workspace">✕</button>
              </div>
              <router-link :to="`/agents/${a.id}`" class="resource-card-link">
                <div class="resource-card-name">{{ a.name }}</div>
                <div class="resource-card-meta">{{ a.role || 'assistant' }}</div>
              </router-link>
            </div>
          </div>
        </section>

        <!-- ─── Services ──────────────────────────────── -->
        <section v-if="activeTab === 'services'">
          <div class="section-header-row">
            <h2 class="panel-section-title">Services <span class="count-badge">{{ services.length }}</span></h2>
            <button class="add-resource-btn" @click="openPicker('services')">
              <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
              Add Service
            </button>
          </div>
          <div v-if="!services.length" class="empty-block">
            <div class="empty-icon">🔌</div>
            <p>No services linked to this workspace.</p>
            <button class="empty-link" @click="openPicker('services')">+ Add Service</button>
          </div>
          <div v-else class="resource-grid">
            <div v-for="s in services" :key="s.bridge_id || s.id" class="resource-card">
              <div class="resource-card-header">
                <span class="resource-icon">🔌</span>
                <button class="unlink-btn" @click.stop="unlinkResource('services', s)" title="Remove from workspace">✕</button>
              </div>
              <router-link :to="`/services`" class="resource-card-link">
                <div class="resource-card-name">{{ s.name }}</div>
                <div class="resource-card-meta">{{ s.category || '' }}</div>
              </router-link>
            </div>
          </div>
        </section>

        <!-- ─── MCP ───────────────────────────────────── -->
        <section v-if="activeTab === 'mcp'">
          <div class="section-header-row">
            <h2 class="panel-section-title">MCP Servers <span class="count-badge">{{ mcpServers.length }}</span></h2>
            <button class="add-resource-btn" @click="openPicker('mcp')">
              <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
              Add MCP Server
            </button>
          </div>
          <div v-if="!mcpServers.length" class="empty-block">
            <div class="empty-icon">⚡</div>
            <p>No MCP servers linked to this workspace.</p>
            <button class="empty-link" @click="openPicker('mcp')">+ Add MCP Server</button>
          </div>
          <div v-else class="resource-grid">
            <div v-for="m in mcpServers" :key="m.bridge_id || m.id" class="resource-card">
              <div class="resource-card-header">
                <span class="resource-icon">⚡</span>
                <button class="unlink-btn" @click.stop="unlinkResource('mcp', m)" title="Remove from workspace">✕</button>
              </div>
              <router-link :to="`/mcp`" class="resource-card-link">
                <div class="resource-card-name">{{ m.name }}</div>
                <div class="resource-card-meta">{{ m.total_tools ?? 0 }} tools</div>
              </router-link>
            </div>
          </div>
        </section>

        <!-- ─── Members ───────────────────────────────── -->
        <section v-if="activeTab === 'members'">
          <div class="section-header-row">
            <h2 class="panel-section-title">Members <span class="count-badge">{{ members.length }}</span></h2>
            <button class="add-resource-btn" @click="showAddMember = !showAddMember">
              <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
              Add Member
            </button>
          </div>
          <div v-if="showAddMember" class="add-member-row">
            <div class="add-member-hint">Add an organisation member to this workspace</div>
            <div class="add-member-controls">
              <input v-model="addMemberEmail" type="email" class="settings-input" placeholder="member@company.com" @keydown.enter="addWSMember" />
              <select v-model="addMemberRole" class="settings-select">
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </select>
              <button class="btn-primary btn-sm" @click="addWSMember" :disabled="addingMember || !addMemberEmail">
                {{ addingMember ? 'Adding…' : 'Add' }}
              </button>
            </div>
          </div>
          <div class="members-card">
            <div v-if="loadingMembers" class="loading-block"><div class="spinner"></div> Loading members…</div>
            <div v-else-if="!members.length" class="empty-block">
              <div class="empty-icon">👥</div>
              <p>No members yet. Add organisation members to this workspace.</p>
            </div>
            <div v-else v-for="m in members" :key="m.id ?? m.user?.id" class="member-row">
              <div class="member-avatar">{{ (m.username ?? m.user?.username ?? '?').charAt(0).toUpperCase() }}</div>
              <div class="member-info">
                <span class="member-name">{{ m.username ?? m.user?.username }}</span>
                <span class="member-email">{{ m.email ?? m.user?.email ?? '' }}</span>
              </div>
              <span class="role-badge" :class="`role-${m.role}`">{{ m.role }}</span>
              <button
                v-if="m.role !== 'owner'"
                class="btn-danger-ghost btn-sm"
                @click="removeWSMember(m)"
              >Remove</button>
            </div>
          </div>
        </section>

        <!-- ─── Credentials (Placeholder) ─────────────── -->
        <section v-if="activeTab === 'credentials'">
          <h2 class="panel-section-title">Shared Credentials</h2>
          <div class="placeholder-card">
            <div class="placeholder-icon">🔐</div>
            <h3 class="placeholder-title">Workspace Credentials</h3>
            <p class="placeholder-desc">Share API keys and service credentials across all workspace members. Agents without personal credentials will automatically use these.</p>
            <div class="placeholder-features">
              <div class="placeholder-feature">
                <span class="pf-icon">🔑</span>
                <div>
                  <span class="pf-title">Service Credentials</span>
                  <span class="pf-desc">Shared API keys for HTTP services</span>
                </div>
              </div>
              <div class="placeholder-feature">
                <span class="pf-icon">⚡</span>
                <div>
                  <span class="pf-title">MCP Credentials</span>
                  <span class="pf-desc">Auth for MCP server connections</span>
                </div>
              </div>
              <div class="placeholder-feature">
                <span class="pf-icon">🛡️</span>
                <div>
                  <span class="pf-title">Built-in Tool Keys</span>
                  <span class="pf-desc">Serper, Tavily, and other built-in tools</span>
                </div>
              </div>
            </div>
            <div class="placeholder-badge">Coming Soon</div>
          </div>
        </section>

        <!-- ─── Settings ──────────────────────────────── -->
        <section v-if="activeTab === 'settings'">
          <h2 class="panel-section-title">Workspace Settings</h2>
          <div class="settings-card">
            <div class="form-row">
              <label>Workspace Name</label>
              <input v-model="wsForm.name" class="settings-input" placeholder="Engineering" />
            </div>
            <div class="form-row">
              <label>Slug</label>
              <input v-model="wsForm.slug" class="settings-input" placeholder="engineering" />
            </div>
            <div class="settings-card-footer">
              <button class="btn-primary" @click="saveWorkspace" :disabled="savingWs">
                {{ savingWs ? 'Saving…' : 'Save Changes' }}
              </button>
            </div>
          </div>

          <div class="danger-zone">
            <h3 class="danger-title">Danger Zone</h3>
            <div class="danger-card">
              <div class="danger-item">
                <div class="danger-info">
                  <span class="danger-label">Delete Workspace</span>
                  <span class="danger-desc">Permanently delete this workspace and remove all resource links. Members will not be deleted.</span>
                </div>
                <button class="btn-danger" @click="deleteWorkspace" :disabled="deletingWs">
                  {{ deletingWs ? 'Deleting…' : 'Delete Workspace' }}
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>

    <!-- Resource Picker Modal -->
    <Teleport to="body">
      <div v-if="showPicker" class="modal-backdrop" @click.self="showPicker = false">
        <div class="picker-modal">
          <div class="picker-header">
            <h3>Add {{ pickerType }} to workspace</h3>
            <button class="picker-close" @click="showPicker = false">✕</button>
          </div>
          <div v-if="pickerLoading" class="loading-block" style="padding: 24px"><div class="spinner"></div> Loading…</div>
          <div v-else-if="!availableItems.length" class="empty-block" style="padding: 24px">
            <p>All {{ pickerType }} are already linked.</p>
          </div>
          <div v-else class="picker-list">
            <div
              v-for="item in availableItems"
              :key="item.id"
              class="picker-row"
              :class="{ 'picker-row--selected': pickerSelected.has(item.id) }"
              @click="togglePickerItem(item.id)"
            >
              <div class="picker-check">{{ pickerSelected.has(item.id) ? '☑' : '☐' }}</div>
              <div class="picker-item-info">
                <div class="picker-item-name">{{ item.name }}</div>
                <div class="picker-item-meta">{{ item.description || item.category || '' }}</div>
              </div>
            </div>
          </div>
          <div v-if="availableItems.length" class="picker-footer">
            <button class="picker-cancel" @click="showPicker = false">Cancel</button>
            <button
              class="picker-confirm"
              :disabled="!pickerSelected.size || pickerLinking"
              @click="linkSelected"
            >
              {{ pickerLinking ? 'Linking…' : `Link ${pickerSelected.size} item(s)` }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../services/api'
import tenancyApi from '../services/tenancyApi'

const route = useRoute()
const router = useRouter()
const wsId = computed(() => route.params.wsId)

const workspace     = ref(null)
const agents        = ref([])
const services      = ref([])
const mcpServers    = ref([])
const members       = ref([])
const activity      = ref([])
const loading       = ref(false)
const loadingMembers = ref(false)
const activeTab     = ref(route.params.tab || 'overview')

// Settings form
const wsForm   = ref({ name: '', slug: '' })
const savingWs = ref(false)
const deletingWs = ref(false)

// Add member
const showAddMember = ref(false)
const addMemberEmail = ref('')
const addMemberRole = ref('member')
const addingMember = ref(false)

// Picker modal state
const showPicker       = ref(false)
const pickerType       = ref('agents')
const pickerLoading    = ref(false)
const pickerLinking    = ref(false)
const pickerSelected   = reactive(new Set())
const availableItems   = ref([])

const palette = ['#6366f1','#8b5cf6','#ec4899','#14b8a6','#f59e0b','#10b981']
function stringToColor(str = '') {
  let h = 0; for (let c of str) h = c.charCodeAt(0) + ((h << 5) - h)
  return palette[Math.abs(h) % palette.length]
}
const wsColor = computed(() => stringToColor(workspace.value?.name ?? ''))

const orgSlug = computed(() => workspace.value?.organization_slug ?? workspace.value?.organization?.slug ?? '')
const wsSlug = computed(() => workspace.value?.slug ?? '')

const workspaceTabs = computed(() => [
  { key: 'overview',  label: 'Overview',  icon: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg>' },
  { key: 'agents',    label: 'Agents',    icon: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6.672 1.911a1 1 0 10-1.932.518l.259.966a1 1 0 001.932-.518l-.26-.966zM2.429 4.74a1 1 0 10-.517 1.932l.966.259a1 1 0 00.517-1.932l-.966-.26zm8.814-.569a1 1 0 00-1.415-1.414l-.707.707a1 1 0 101.415 1.415l.707-.708zm-7.071 7.072l.707-.707A8.003 8.003 0 0013.93 2.485l-.707.707a1 1 0 00-1.414 1.414l.707.708L2.172 11.243z" clip-rule="evenodd"/></svg>', count: agents.value.length },
  { key: 'services',  label: 'Services',  icon: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.062 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/></svg>', count: services.value.length },
  { key: 'mcp',       label: 'MCP',       icon: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"/></svg>', count: mcpServers.value.length },
])

const manageTabs = [
  { key: 'members',     label: 'Members',     icon: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>' },
  { key: 'credentials', label: 'Credentials', soon: true, icon: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clip-rule="evenodd"/></svg>' },
  { key: 'settings',    label: 'Settings',    icon: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.062 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/></svg>' },
]

function setTab(key) {
  activeTab.value = key
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const diff = Math.floor((Date.now() - d) / 1000)
  if (diff < 60)   return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`
  return `${Math.floor(diff/3600)}h ago`
}

async function loadAll() {
  loading.value = true
  loadingMembers.value = true
  try {
    const wsRes = await tenancyApi.getWorkspace(wsId.value).catch(() => null)
    if (wsRes) {
      workspace.value = wsRes.data
      wsForm.value = { name: wsRes.data.name, slug: wsRes.data.slug }
    }

    const o = orgSlug.value
    const w = wsSlug.value

    const [agRes, svcRes, mcpRes, memRes, actRes] = await Promise.allSettled([
      (o && w) ? tenancyApi.listWSAgents(o, w) : api.get('/agents/'),
      (o && w) ? tenancyApi.listWSServices(o, w) : api.get('/services/'),
      (o && w) ? tenancyApi.listWSMCP(o, w) : api.get('/mcp/servers/'),
      tenancyApi.getWSMembers(wsId.value).catch(() => ({ data: [] })),
      api.get('/tools/history/', { params: { limit: 20 } }),
    ])
    if (agRes.status  === 'fulfilled') agents.value     = agRes.value.data?.results ?? agRes.value.data ?? []
    if (svcRes.status === 'fulfilled') services.value   = svcRes.value.data?.services ?? svcRes.value.data ?? []
    if (mcpRes.status === 'fulfilled') mcpServers.value = mcpRes.value.data?.servers ?? mcpRes.value.data ?? []
    if (memRes.status === 'fulfilled') members.value    = memRes.value.data?.results ?? memRes.value.data ?? []
    if (actRes.status === 'fulfilled') activity.value   = actRes.value.data?.results ?? actRes.value.data ?? []
  } finally {
    loading.value = false
    loadingMembers.value = false
  }
}

// ── Workspace settings ──────────────────────────────────────────────────
async function saveWorkspace() {
  savingWs.value = true
  try {
    await tenancyApi.updateWorkspace(wsId.value, wsForm.value)
    workspace.value = { ...workspace.value, ...wsForm.value }
  } catch (err) {
    alert(err?.response?.data?.detail || 'Failed to save')
  }
  savingWs.value = false
}

async function deleteWorkspace() {
  if (!confirm(`Permanently delete "${workspace.value?.name}"? This cannot be undone.`)) return
  deletingWs.value = true
  try {
    await tenancyApi.deleteWorkspace(wsId.value)
    router.push(orgSlug.value ? `/org/${orgSlug.value}/settings/workspaces` : '/dashboard')
  } catch {}
  deletingWs.value = false
}

// ── Workspace members ───────────────────────────────────────────────────
async function addWSMember() {
  if (!addMemberEmail.value) return
  addingMember.value = true
  try {
    await tenancyApi.addWSMember(wsId.value, { email: addMemberEmail.value, role: addMemberRole.value })
    addMemberEmail.value = ''
    showAddMember.value = false
    const r = await tenancyApi.getWSMembers(wsId.value).catch(() => ({ data: [] }))
    members.value = r.data?.results ?? r.data ?? []
  } catch (err) {
    alert(err?.response?.data?.error || err?.response?.data?.detail || 'Failed to add member')
  }
  addingMember.value = false
}

async function removeWSMember(m) {
  const uid = m.user?.id ?? m.id
  if (!confirm(`Remove ${m.username ?? m.user?.username}?`)) return
  try {
    await tenancyApi.removeWSMember(wsId.value, uid)
    members.value = members.value.filter(x => (x.user?.id ?? x.id) !== uid)
  } catch {}
}

// ── Resource Picker ─────────────────────────────────────────────────────
async function openPicker(type) {
  pickerType.value = type
  showPicker.value = true
  pickerLoading.value = true
  pickerSelected.clear()
  availableItems.value = []

  try {
    let allRes
    if (type === 'agents') {
      allRes = await api.get('/agents/')
      allRes = allRes.data?.results ?? allRes.data ?? []
    } else if (type === 'services') {
      allRes = await api.get('/services/')
      allRes = allRes.data?.services ?? allRes.data ?? []
    } else if (type === 'mcp') {
      allRes = await api.get('/mcp/servers/')
      allRes = allRes.data?.servers ?? allRes.data ?? []
    } else {
      allRes = []
    }

    const linkedIds = new Set(
      (type === 'agents' ? agents : type === 'services' ? services : mcpServers).value
        .map(r => r.id)
    )
    availableItems.value = allRes.filter(item => !linkedIds.has(item.id))
  } catch (err) {
    console.error('[picker]', err)
    availableItems.value = []
  } finally {
    pickerLoading.value = false
  }
}

function togglePickerItem(id) {
  if (pickerSelected.has(id)) pickerSelected.delete(id)
  else pickerSelected.add(id)
}

async function linkSelected() {
  if (!orgSlug.value || !wsSlug.value) return
  pickerLinking.value = true

  const linkFn = {
    agents:   tenancyApi.linkWSAgent,
    services: tenancyApi.linkWSService,
    mcp:      tenancyApi.linkWSMCP,
  }[pickerType.value]

  try {
    for (const resourceId of pickerSelected) {
      await linkFn(orgSlug.value, wsSlug.value, { resource_id: resourceId })
    }
    showPicker.value = false
    await loadAll()
  } catch (err) {
    console.error('[link]', err)
  } finally {
    pickerLinking.value = false
  }
}

async function unlinkResource(type, item) {
  if (!orgSlug.value || !wsSlug.value || !item.bridge_id) return
  if (!confirm(`Remove "${item.name}" from this workspace?`)) return

  const unlinkFn = {
    agents:   tenancyApi.unlinkWSAgent,
    services: tenancyApi.unlinkWSService,
    mcp:      tenancyApi.unlinkWSMCP,
  }[type]

  try {
    await unlinkFn(orgSlug.value, wsSlug.value, item.bridge_id)
    await loadAll()
  } catch (err) {
    console.error('[unlink]', err)
  }
}

watch(wsId, loadAll, { immediate: false })
onMounted(loadAll)
</script>

<style scoped>
.ws-dash { min-height: 100vh; background: #030712; color: #f9fafb; padding-bottom: 80px; }

/* Header */
.wsd-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 40px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  background: rgba(17,24,39,0.6);
  backdrop-filter: blur(12px);
  position: sticky; top: 0; z-index: 10;
}
.wsd-header-left { display: flex; align-items: center; gap: 20px; }
.wsd-header-right { display: flex; align-items: center; gap: 12px; }
.wsd-back {
  display: flex; align-items: center; gap: 6px;
  color: #9ca3af; font-size: 13px; text-decoration: none;
  transition: color 0.15s;
}
.wsd-back:hover { color: #f9fafb; }
.wsd-back svg { width: 14px; height: 14px; }
.wsd-title-group { display: flex; align-items: center; gap: 10px; }
.wsd-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.wsd-title { font-size: 20px; font-weight: 700; margin: 0; }
.wsd-subtitle { font-size: 12px; color: #6b7280; }
.wsd-member-count { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #9ca3af; }
.wsd-member-count svg { width: 14px; height: 14px; }

/* Layout */
.wsd-layout { display: flex; max-width: 1200px; margin: 0 auto; padding: 32px 40px; gap: 32px; }

/* Sidebar */
.wsd-sidebar { width: 200px; flex-shrink: 0; }
.sidebar-group { margin-bottom: 24px; }
.sidebar-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em; color: #4b5563;
  padding: 0 12px; margin-bottom: 6px;
}
.wsd-tab {
  display: flex; align-items: center; gap: 10px;
  width: 100%; padding: 9px 12px;
  border-radius: 8px; background: none; border: none;
  color: #9ca3af; font-size: 13.5px;
  cursor: pointer; text-align: left;
  transition: all 0.12s ease; margin-bottom: 2px;
}
.wsd-tab:hover { background: rgba(255,255,255,0.05); color: #e2e8f0; }
.wsd-tab--active { background: rgba(139,92,246,0.12); color: #a78bfa; font-weight: 600; }
.tab-icon { width: 16px; height: 16px; display: flex; align-items: center; flex-shrink: 0; }
.tab-icon svg { width: 16px; height: 16px; }
.tab-count { font-size: 11px; margin-left: auto; color: #6b7280; background: rgba(255,255,255,0.06); padding: 1px 7px; border-radius: 10px; }
.soon-dot { width: 6px; height: 6px; border-radius: 50%; background: #f59e0b; margin-left: auto; flex-shrink: 0; }

/* Panel */
.wsd-panel { flex: 1; min-width: 0; }
.panel-section-title {
  font-size: 17px; font-weight: 700; color: #f9fafb;
  margin: 0 0 18px; display: flex; align-items: center; gap: 10px;
}
.section-header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
.section-header-row .panel-section-title { margin: 0; }
.count-badge { background: rgba(255,255,255,0.08); color: #9ca3af; font-size: 12px; font-weight: 500; padding: 2px 8px; border-radius: 20px; }

/* Overview Stats */
.overview-stats {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
  margin-bottom: 24px;
}
.ov-stat {
  background: rgba(31,41,55,0.5); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 12px; padding: 20px 16px;
  display: flex; flex-direction: column; align-items: center;
  cursor: pointer; transition: all 0.15s;
}
.ov-stat:hover { background: rgba(31,41,55,0.8); border-color: rgba(255,255,255,0.12); }
.ov-stat-value { font-size: 28px; font-weight: 800; color: #f9fafb; }
.ov-stat-label { font-size: 12px; color: #6b7280; margin-top: 4px; }

.overview-grid { display: grid; grid-template-columns: 1fr 280px; gap: 20px; }

/* Activity */
.activity-list {
  background: rgba(31,41,55,0.5); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 12px; overflow: hidden;
}
.activity-row {
  display: flex; align-items: center; gap: 12px;
  padding: 11px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 13px;
}
.activity-row:last-child { border-bottom: none; }
.activity-status { font-size: 12px; font-weight: 700; min-width: 14px; }
.status-ok { color: #34d399; }
.status-err { color: #f87171; }
.activity-tool { font-weight: 600; color: #f9fafb; font-family: 'Courier New', monospace; font-size: 12px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.activity-time { color: #6b7280; font-size: 11px; white-space: nowrap; }
.activity-duration { color: #6b7280; font-size: 11px; white-space: nowrap; background: rgba(255,255,255,0.05); padding: 1px 6px; border-radius: 4px; }

/* Info card */
.info-card {
  background: rgba(31,41,55,0.5); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 12px; overflow: hidden;
}
.info-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 16px; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 13px;
}
.info-row:last-child { border-bottom: none; }
.info-label { color: #6b7280; }
.info-value { color: #e2e8f0; }
.mono { font-family: 'Courier New', monospace; font-size: 12px; }

/* Resource Cards */
.resource-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
.resource-card {
  background: rgba(31,41,55,0.5); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 12px; padding: 16px; text-decoration: none; color: inherit;
  transition: all 0.15s; cursor: pointer;
}
.resource-card:hover { background: rgba(31,41,55,0.8); border-color: rgba(255,255,255,0.12); transform: translateY(-1px); }
.resource-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.resource-icon { font-size: 24px; }
.resource-card-name { font-size: 14px; font-weight: 600; color: #f9fafb; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.resource-card-meta { font-size: 12px; color: #9ca3af; }
.resource-card-link { text-decoration: none; color: inherit; display: block; }
.unlink-btn { background: none; border: none; color: #6b7280; font-size: 14px; cursor: pointer; padding: 2px 4px; border-radius: 4px; transition: all 0.15s; line-height: 1; }
.unlink-btn:hover { color: #ef4444; background: rgba(239,68,68,0.12); }

/* Members */
.members-card {
  background: rgba(31,41,55,0.5); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 12px; overflow: hidden;
}
.member-row {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.05);
}
.member-row:last-child { border-bottom: none; }
.member-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 14px; color: #fff; flex-shrink: 0;
}
.member-info { flex: 1; min-width: 0; }
.member-name { display: block; font-size: 14px; font-weight: 500; color: #f9fafb; }
.member-email { font-size: 12px; color: #9ca3af; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.role-badge { padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; }
.role-owner  { background: rgba(245,158,11,0.15); color: #fbbf24; }
.role-admin  { background: rgba(139,92,246,0.15); color: #a78bfa; }
.role-member { background: rgba(16,185,129,0.12); color: #34d399; }
.role-viewer { background: rgba(156,163,175,0.12); color: #9ca3af; }

.add-member-row {
  margin-bottom: 14px; padding: 16px 20px;
  background: rgba(31,41,55,0.5); border: 1px solid rgba(139,92,246,0.2);
  border-radius: 10px;
}
.add-member-hint { font-size: 12px; color: #9ca3af; margin-bottom: 10px; }
.add-member-controls { display: flex; align-items: center; gap: 10px; }

/* Form */
.settings-card {
  background: rgba(31,41,55,0.5); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 12px; overflow: hidden;
}
.settings-card-footer { padding: 16px 20px; border-top: 1px solid rgba(255,255,255,0.07); display: flex; justify-content: flex-end; }
.form-row { padding: 18px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); }
.form-row:last-of-type { border-bottom: none; }
.form-row label { display: block; font-size: 12px; color: #9ca3af; margin-bottom: 8px; font-weight: 500; }
.settings-input {
  width: 100%; box-sizing: border-box;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px; color: #f9fafb; padding: 9px 12px; font-size: 14px; outline: none;
  transition: border-color 0.15s;
}
.settings-input:focus { border-color: #8b5cf6; }
.settings-select {
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px; color: #f9fafb; padding: 8px 12px; font-size: 13px; outline: none; cursor: pointer;
}

/* Placeholder Card */
.placeholder-card {
  background: rgba(31,41,55,0.5); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 16px; padding: 40px 32px; text-align: center;
  position: relative; overflow: hidden;
}
.placeholder-card::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.06) 0%, transparent 70%); pointer-events: none; }
.placeholder-icon { font-size: 48px; margin-bottom: 16px; }
.placeholder-title { font-size: 18px; font-weight: 700; color: #f9fafb; margin: 0 0 8px; }
.placeholder-desc { font-size: 14px; color: #9ca3af; max-width: 440px; margin: 0 auto 28px; line-height: 1.6; }
.placeholder-features { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; text-align: left; max-width: 600px; margin: 0 auto 24px; }
.placeholder-feature { display: flex; align-items: flex-start; gap: 12px; padding: 14px; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); }
.pf-icon { font-size: 20px; flex-shrink: 0; margin-top: 1px; }
.pf-title { display: block; font-size: 13px; font-weight: 600; color: #e2e8f0; margin-bottom: 2px; }
.pf-desc { display: block; font-size: 11.5px; color: #6b7280; line-height: 1.4; }
.placeholder-badge { display: inline-flex; padding: 6px 16px; border-radius: 20px; background: rgba(139,92,246,0.12); color: #a78bfa; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; }

/* Danger */
.danger-zone { margin-top: 32px; }
.danger-title { font-size: 15px; font-weight: 700; color: #f87171; margin: 0 0 12px; }
.danger-card { background: rgba(31,41,55,0.5); border: 1px solid rgba(239,68,68,0.2); border-radius: 12px; overflow: hidden; }
.danger-item { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; gap: 20px; }
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
.btn-danger-ghost {
  background: none; border: 1px solid rgba(239,68,68,0.3);
  color: #f87171; border-radius: 6px; cursor: pointer;
  font-size: 12px; padding: 4px 10px; transition: all 0.12s;
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

.add-resource-btn {
  display: flex; align-items: center; gap: 5px;
  padding: 6px 14px; background: rgba(139,92,246,0.12);
  border: 1px solid rgba(139,92,246,0.25); color: #a78bfa;
  font-size: 12.5px; font-weight: 600; border-radius: 8px;
  cursor: pointer; transition: all 0.15s;
}
.add-resource-btn:hover { background: rgba(139,92,246,0.22); border-color: rgba(139,92,246,0.4); }
.add-resource-btn svg { width: 14px; height: 14px; }

/* Utils */
.loading-block { display: flex; align-items: center; gap: 10px; padding: 28px; color: #9ca3af; font-size: 13px; }
.empty-block { text-align: center; padding: 40px 20px; color: #6b7280; font-size: 13px; }
.empty-icon { font-size: 32px; margin-bottom: 10px; }
.empty-block p { margin: 0 0 12px; }
.empty-link { color: #8b5cf6; text-decoration: none; font-weight: 600; font-size: 13px; background: none; border: none; cursor: pointer; }
.empty-link:hover { text-decoration: underline; }
.spinner { width: 18px; height: 18px; border: 2px solid rgba(139,92,246,0.3); border-top-color: #8b5cf6; border-radius: 50%; animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Picker Modal */
.modal-backdrop { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.65); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; }
.picker-modal { background: #111827; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; width: 440px; max-width: 90vw; max-height: 75vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px rgba(0,0,0,0.5); }
.picker-header { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; border-bottom: 1px solid rgba(255,255,255,0.07); }
.picker-header h3 { margin: 0; font-size: 15px; color: #f9fafb; font-weight: 700; text-transform: capitalize; }
.picker-close { background: none; border: none; color: #6b7280; font-size: 16px; cursor: pointer; padding: 4px; }
.picker-close:hover { color: #f9fafb; }
.picker-list { overflow-y: auto; flex: 1; padding: 6px 0; }
.picker-row { display: flex; align-items: center; gap: 12px; padding: 11px 20px; cursor: pointer; transition: background 0.12s; }
.picker-row:hover { background: rgba(255,255,255,0.04); }
.picker-row--selected { background: rgba(139,92,246,0.08); }
.picker-check { font-size: 16px; color: #a78bfa; min-width: 20px; }
.picker-item-info { flex: 1; min-width: 0; }
.picker-item-name { font-size: 13.5px; color: #f9fafb; font-weight: 600; }
.picker-item-meta { font-size: 11.5px; color: #6b7280; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.picker-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 20px; border-top: 1px solid rgba(255,255,255,0.07); }
.picker-cancel { padding: 8px 16px; background: none; border: 1px solid rgba(255,255,255,0.12); color: #9ca3af; border-radius: 8px; cursor: pointer; font-size: 13px; }
.picker-cancel:hover { border-color: rgba(255,255,255,0.2); color: #e2e8f0; }
.picker-confirm { padding: 8px 20px; background: #7c3aed; border: none; color: #fff; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.15s; }
.picker-confirm:hover { background: #6d28d9; }
.picker-confirm:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
