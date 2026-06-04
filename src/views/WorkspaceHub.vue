<template>
  <div class="workspace-hub">
    <!-- Header -->
    <div class="hub-header">
      <div class="hub-title-section">
        <h1 class="hub-title">Workspace Hub</h1>
        <p class="hub-subtitle">Connect workspace agents to execute tools on your machines</p>
      </div>
      <button class="btn-create" @click="showCreateModal = true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14m-7-7h14"/>
        </svg>
        New Workspace
      </button>
    </div>

    <!-- Workspace Cards Grid -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <span>Loading workspaces...</span>
    </div>

    <div v-else-if="workspaces.length === 0" class="empty-state">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <path d="M8 21h8m-4-4v4"/>
        </svg>
      </div>
      <h3>No Workspaces Yet</h3>
      <p>Create a workspace to connect an agent to your local or remote machine.</p>
      <button class="btn-create" @click="showCreateModal = true">Create Workspace</button>
    </div>

    <div v-else class="workspace-grid">
      <div
        v-for="ws in workspaces"
        :key="ws.id"
        class="workspace-card"
        :class="{ 'card-connected': ws.status === 'connected' }"
        @click="selectWorkspace(ws)"
      >
        <div class="card-header">
          <div class="card-status">
            <span class="status-dot" :class="ws.status"></span>
            <span class="status-label">{{ statusLabel(ws.status) }}</span>
          </div>
          <button class="card-menu-btn" @click.stop="toggleMenu(ws.id)" title="Options">
            <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
          </button>
          <div v-if="activeMenu === ws.id" class="card-dropdown">
            <button @click.stop="regenerateToken(ws)">Regenerate Token</button>
            <button @click.stop="deleteWorkspace(ws)" class="danger">Delete</button>
          </div>
        </div>

        <h3 class="card-name">{{ ws.name }}</h3>

        <div class="card-stats">
          <div class="stat">
            <span class="stat-value">{{ ws.total_tool_executions || 0 }}</span>
            <span class="stat-label">Executions</span>
          </div>
          <div class="stat">
            <span class="stat-value">{{ ws.assigned_agents?.length || 0 }}</span>
            <span class="stat-label">Agents</span>
          </div>
          <div class="stat">
            <span class="stat-value">{{ ws.agent_version || '—' }}</span>
            <span class="stat-label">Version</span>
          </div>
        </div>

        <div class="card-agents" v-if="ws.assigned_agents?.length">
          <span class="agent-chip" v-for="name in ws.assigned_agents.slice(0, 3)" :key="name">{{ name }}</span>
          <span v-if="ws.assigned_agents.length > 3" class="agent-chip more">+{{ ws.assigned_agents.length - 3 }}</span>
        </div>

        <div class="card-footer">
          <span class="card-time" v-if="ws.last_heartbeat">
            Last seen {{ timeAgo(ws.last_heartbeat) }}
          </span>
          <span class="card-time" v-else>Created {{ timeAgo(ws.created_at) }}</span>
        </div>
      </div>
    </div>

    <!-- Workspace Detail Panel (slide-in) -->
    <Transition name="slide">
      <div v-if="selectedWorkspace" class="detail-panel">
        <div class="panel-backdrop" @click="selectedWorkspace = null"></div>
        <div class="panel-content">
          <div class="panel-header">
            <div>
              <h2>{{ selectedWorkspace.name }}</h2>
              <span class="status-dot" :class="selectedWorkspace.status"></span>
              <span class="status-label">{{ statusLabel(selectedWorkspace.status) }}</span>
            </div>
            <button class="panel-close" @click="selectedWorkspace = null">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <!-- Quick Connect Section -->
          <div class="panel-section">
            <h4>Quick Connect</h4>
            <p class="section-desc">Run this command to connect the workspace agent:</p>
            <div class="code-block">
              <code>{{ dockerRunCommand }}</code>
              <button class="copy-btn" @click="copyToClipboard(dockerRunCommand)" title="Copy">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2"/>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
              </button>
            </div>
            <div class="code-block code-block-alt" style="margin-top: 8px;">
              <code>python -m agent_runtime --server {{ wsServerUrl }} --token {{ selectedWorkspace.token }}</code>
              <button class="copy-btn" @click="copyToClipboard(`python -m agent_runtime --server ${wsServerUrl} --token ${selectedWorkspace.token}`)" title="Copy">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2"/>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Token Section -->
          <div class="panel-section">
            <h4>Authentication Token</h4>
            <div class="token-display">
              <code>{{ showToken ? selectedWorkspace.token : maskedToken }}</code>
              <div class="token-actions">
                <button @click="showToken = !showToken" class="icon-btn" :title="showToken ? 'Hide' : 'Show'">
                  <svg v-if="showToken" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                <button @click="copyToClipboard(selectedWorkspace.token)" class="icon-btn" title="Copy">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                </button>
              </div>
            </div>
          </div>

          <!-- Tabs -->
          <div class="panel-tabs">
            <button
              v-for="tab in ['Setup', 'Agents', 'Bridges', 'Activity', 'Credentials']"
              :key="tab"
              :class="{ active: activeTab === tab }"
              @click="activeTab = tab; loadTabData(tab)"
            >{{ tab }}</button>
          </div>

          <!-- Setup Tab -->
          <div v-if="activeTab === 'Setup'" class="panel-section setup-section">
            <h4>Installation</h4>
            <p class="section-desc">Choose one of the methods below to connect the workspace agent to this backend.</p>

            <!-- Method 1: Docker -->
            <div class="setup-method">
              <div class="method-header">
                <span class="method-badge docker">Recommended</span>
                <h5>Docker</h5>
              </div>
              <p class="method-desc">Pull and run — works on any machine with Docker installed.</p>
              <div class="setup-steps">
                <div class="step">
                  <span class="step-num">1</span>
                  <span class="step-label">Pull the image</span>
                </div>
                <div class="code-block">
                  <code>docker pull darrxscale/workspace-agent:latest</code>
                  <button class="btn-copy" @click="copyToClipboard('docker pull darrxscale/workspace-agent:latest')" title="Copy">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                  </button>
                </div>
                <div class="step">
                  <span class="step-num">2</span>
                  <span class="step-label">Run the agent</span>
                </div>
                <div class="code-block">
                  <code>{{ dockerRunCommand }}</code>
                  <button class="btn-copy" @click="copyToClipboard(dockerRunCommand)" title="Copy">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                  </button>
                </div>
                <p class="step-hint">Replace <code>/path/to/workspace</code> with the directory you want the agent to access.</p>
              </div>
            </div>

            <!-- Method 2: Python -->
            <div class="setup-method">
              <div class="method-header">
                <span class="method-badge python">Alternative</span>
                <h5>Python (pip)</h5>
              </div>
              <p class="method-desc">Run directly with Python 3.10+. Good for development or machines without Docker.</p>
              <div class="setup-steps">
                <div class="step">
                  <span class="step-num">1</span>
                  <span class="step-label">Install</span>
                </div>
                <div class="code-block">
                  <code>pip install darrxscale-workspace-agent</code>
                  <button class="btn-copy" @click="copyToClipboard('pip install darrxscale-workspace-agent')" title="Copy">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                  </button>
                </div>
                <div class="step">
                  <span class="step-num">2</span>
                  <span class="step-label">Run</span>
                </div>
                <div class="code-block">
                  <code>{{ pipRunCommand }}</code>
                  <button class="btn-copy" @click="copyToClipboard(pipRunCommand)" title="Copy">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                  </button>
                </div>
              </div>
            </div>

            <!-- Verify -->
            <div class="setup-verify">
              <h5>Verify Connection</h5>
              <p>Once running, the workspace card status will change to <span class="status-dot connected" style="display:inline-block;vertical-align:middle"></span> <strong>Connected</strong>.</p>
            </div>
          </div>

          <!-- Agents Tab -->
          <div v-if="activeTab === 'Agents'" class="panel-section">
            <div class="section-header">
              <h4>Assigned Agents</h4>
              <button class="btn-small" @click="showAssignAgent = !showAssignAgent">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14m-7-7h14"/></svg>
                Assign Agent
              </button>
            </div>

            <!-- Assign agent inline form -->
            <div v-if="showAssignAgent" class="assign-form">
              <select v-model="selectedAgentId" class="form-select">
                <option value="">Select an agent profile...</option>
                <option v-for="agent in availableAgents" :key="agent.id" :value="agent.id">
                  {{ agent.name }}
                </option>
              </select>
              <button class="btn-small btn-confirm" @click="assignAgent" :disabled="!selectedAgentId">Assign</button>
            </div>

            <div v-if="assignments.length === 0" class="empty-inline">No agents assigned yet.</div>
            <div v-else class="assignment-list">
              <div v-for="assignment in assignments" :key="assignment.id" class="assignment-item">
                <div class="assignment-info">
                  <span class="assignment-name">{{ assignment.agent_name }}</span>
                  <span class="assignment-meta">
                    {{ assignment.enabled ? '🌐 Remote routing ON' : '💻 Local only' }}
                    · Added {{ timeAgo(assignment.created_at) }}
                  </span>
                </div>
                <div class="assignment-actions">
                  <button
                    class="btn-toggle"
                    :class="{ active: assignment.enabled }"
                    @click="toggleAssignment(assignment)"
                    :title="assignment.enabled ? 'Disable workspace routing' : 'Enable workspace routing'"
                  >
                    <span class="toggle-track">
                      <span class="toggle-thumb"></span>
                    </span>
                  </button>
                  <button class="btn-remove" @click="removeAssignment(assignment)" title="Remove">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Activity Tab -->
          <div v-if="activeTab === 'Activity'" class="panel-section">
            <h4>Recent Activity</h4>
            <div v-if="activityLog.length === 0" class="empty-inline">No activity yet.</div>
            <div v-else class="activity-list">
              <div v-for="log in activityLog" :key="log.id" class="activity-item">
                <span class="activity-icon" :class="{ success: log.success, error: !log.success }">
                  {{ log.success ? '✓' : '✗' }}
                </span>
                <div class="activity-info">
                  <span class="activity-tool">{{ log.tool_name }}</span>
                  <span class="activity-time">{{ timeAgo(log.created_at) }} · {{ log.duration_ms }}ms</span>
                </div>
                <span v-if="log.error" class="activity-error">{{ log.error }}</span>
              </div>
            </div>
          </div>

          <!-- Bridges Tab -->
          <div v-if="activeTab === 'Bridges'" class="panel-section">
            <div class="section-header">
              <h4>Signal Bridges</h4>
              <button class="btn-small" @click="loadTabData('Bridges')">
                ↻ Refresh
              </button>
            </div>
            <div v-if="bridgeList.length === 0" class="empty-inline">No active signal bridges. Enable signals on an agent with a Redis stream to start one.</div>
            <div v-else class="bridge-list">
              <div v-for="b in bridgeList" :key="b.bridge_id" class="bridge-item">
                <div class="bridge-status-dot" :class="b.status"></div>
                <div class="bridge-info">
                  <span class="bridge-name">{{ b.agent_name || `Agent ${b.agent_id}` }}</span>
                  <span class="bridge-meta">
                    {{ b.stream_key || '—' }} · {{ formatBridgeUptime(b.uptime_seconds) }} · {{ b.signals_forwarded ?? 0 }} signals
                    <span v-if="b.errors > 0" class="bridge-err">· {{ b.errors }} errors</span>
                  </span>
                </div>
                <button v-if="b.status === 'running'" class="btn-remove" @click="stopOneBridge(b.bridge_id)" title="Stop bridge">
                  ⏹
                </button>
              </div>
            </div>
            <button v-if="bridgeList.length > 0" class="btn-small" style="margin-top: 12px; color: #ef4444; border-color: rgba(239,68,68,0.3);" @click="stopAllBridges">
              ⏹ Stop All Bridges
            </button>
          </div>

          <!-- Credentials Tab -->
          <div v-if="activeTab === 'Credentials'" class="panel-section">
            <h4>Credential Sync</h4>
            <p class="section-desc">
              Sync credentials to the workspace agent's local encrypted vault. The backend never stores these values.
            </p>
            <div class="cred-form">
              <div class="form-group">
                <label>Service Slug</label>
                <input v-model="credForm.service_slug" placeholder="e.g. shopify-store-1" class="form-input"/>
              </div>
              <div class="form-group">
                <label>Auth Type</label>
                <select v-model="credForm.auth_type" class="form-select">
                  <option value="bearer">Bearer Token</option>
                  <option value="apikey">API Key</option>
                  <option value="basic">Basic Auth</option>
                  <option value="custom">Custom Header</option>
                </select>
              </div>
              <div class="form-group">
                <label>Header Name</label>
                <input v-model="credForm.header_name" placeholder="Authorization" class="form-input"/>
              </div>
              <div class="form-group">
                <label>Secret Value</label>
                <input v-model="credForm.value" type="password" placeholder="API key or token" class="form-input"/>
              </div>
              <button
                class="btn-create"
                @click="syncCredential"
                :disabled="!credForm.service_slug || !credForm.value || selectedWorkspace?.status !== 'connected'"
              >
                {{ selectedWorkspace?.status !== 'connected' ? 'Agent Offline' : 'Sync to Agent' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Create Modal -->
    <Transition name="modal">
      <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
        <div class="modal-content">
          <h3>Create Workspace</h3>
          <p>A workspace represents a connection to a machine running the agent.</p>
          <div class="form-group">
            <label>Workspace Name</label>
            <input
              v-model="newWorkspaceName"
              placeholder="e.g. Production Server, Dev Machine"
              class="form-input"
              @keydown.enter="createWorkspace"
              autofocus
            />
          </div>
          <div class="modal-actions">
            <button class="btn-cancel" @click="showCreateModal = false">Cancel</button>
            <button class="btn-create" @click="createWorkspace" :disabled="!newWorkspaceName.trim()">
              Create
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Toast notification -->
    <Transition name="toast">
      <div v-if="toast" class="toast" :class="toast.type">{{ toast.message }}</div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import api from '../services/api'

const notify = inject('notify')

// State
const workspaces = ref([])
const loading = ref(true)
const showCreateModal = ref(false)
const newWorkspaceName = ref('')
const selectedWorkspace = ref(null)
const activeMenu = ref(null)
const activeTab = ref('Setup')
const showToken = ref(false)
const showAssignAgent = ref(false)
const selectedAgentId = ref('')
const toast = ref(null)

// Tab data
const assignments = ref([])
const activityLog = ref([])
const bridgeList = ref([])
const availableAgents = ref([])

// Credential form
const credForm = ref({
  service_slug: '',
  auth_type: 'bearer',
  header_name: 'Authorization',
  value: '',
})

// Computed
const maskedToken = computed(() => {
  if (!selectedWorkspace.value?.token) return ''
  const t = selectedWorkspace.value.token
  return t.slice(0, 8) + '••••••••••••' + t.slice(-4)
})

const wsServerUrl = computed(() => {
  const loc = window.location
  const protocol = loc.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${loc.host}`
})

const dockerRunCommand = computed(() => {
  if (!selectedWorkspace.value) return ''
  const token = selectedWorkspace.value.token || '<YOUR_TOKEN>'
  return `docker run -d --restart unless-stopped \\
  --name workspace-agent \\
  -e SERVER=${wsServerUrl.value} \\
  -e TOKEN=${token} \\
  -v /path/to/workspace:/workspace \\
  darrxscale/workspace-agent:latest`
})

const pipRunCommand = computed(() => {
  if (!selectedWorkspace.value) return ''
  const token = selectedWorkspace.value.token || '<YOUR_TOKEN>'
  return `workspace-agent \\
  --server ${wsServerUrl.value} \\
  --token ${token} \\
  --workspace /path/to/workspace`
})

// Methods
const loadWorkspaces = async () => {
  loading.value = true
  try {
    const res = await api.get('/workspaces/')
    workspaces.value = res.data.workspaces || []
  } catch (e) {
    showToast('Failed to load workspaces', 'error')
  } finally {
    loading.value = false
  }
}

const createWorkspace = async () => {
  if (!newWorkspaceName.value.trim()) return
  try {
    const res = await api.post('/workspaces/', { name: newWorkspaceName.value.trim() })
    workspaces.value.push(res.data)
    showCreateModal.value = false
    newWorkspaceName.value = ''
    showToast('Workspace created!', 'success')
    selectWorkspace(res.data)
  } catch (e) {
    showToast('Failed to create workspace', 'error')
  }
}

const deleteWorkspace = async (ws) => {
  if (!confirm(`Delete workspace "${ws.name}"?`)) return
  try {
    await api.delete(`/workspaces/${ws.id}/`)
    workspaces.value = workspaces.value.filter(w => w.id !== ws.id)
    if (selectedWorkspace.value?.id === ws.id) selectedWorkspace.value = null
    activeMenu.value = null
    showToast('Workspace deleted', 'success')
  } catch (e) {
    showToast('Failed to delete workspace', 'error')
  }
}

const regenerateToken = async (ws) => {
  if (!confirm('Regenerate token? The current agent will need to reconnect.')) return
  try {
    const res = await api.post(`/workspaces/${ws.id}/regenerate-token/`)
    ws.token = res.data.token
    if (selectedWorkspace.value?.id === ws.id) {
      selectedWorkspace.value = { ...selectedWorkspace.value, token: res.data.token }
    }
    activeMenu.value = null
    showToast('Token regenerated', 'success')
  } catch (e) {
    showToast('Failed to regenerate token', 'error')
  }
}

const selectWorkspace = async (ws) => {
  activeMenu.value = null
  showToken.value = false
  activeTab.value = 'Setup'
  // Get full detail
  try {
    const res = await api.get(`/workspaces/${ws.id}/`)
    selectedWorkspace.value = res.data
  } catch (e) {
    selectedWorkspace.value = ws
  }
  loadTabData('Agents')
}

const loadTabData = async (tab) => {
  if (!selectedWorkspace.value) return
  const id = selectedWorkspace.value.id

  if (tab === 'Agents') {
    try {
      const [agentsRes, profilesRes] = await Promise.all([
        api.get(`/workspaces/${id}/agents/`),
        api.get('/agents/')
      ])
      assignments.value = agentsRes.data.assignments || []
      // DRF ViewSet returns { count, results: [...] } or a flat array
      const profiles = profilesRes.data.results || profilesRes.data || []
      availableAgents.value = Array.isArray(profiles) ? profiles : []
    } catch (e) { console.error(e) }
  } else if (tab === 'Bridges') {
    try {
      const res = await api.get(`/workspaces/${id}/bridges/`)
      bridgeList.value = res.data?.bridges ?? res.data ?? []
    } catch (e) { console.error(e); bridgeList.value = [] }
  } else if (tab === 'Activity') {
    try {
      const res = await api.get(`/workspaces/${id}/activity/?limit=30`)
      activityLog.value = res.data.activity || []
    } catch (e) { console.error(e) }
  }
}

const assignAgent = async () => {
  if (!selectedAgentId.value || !selectedWorkspace.value) return
  try {
    await api.post(`/workspaces/${selectedWorkspace.value.id}/agents/`, {
      agent_profile_id: selectedAgentId.value
    })
    showAssignAgent.value = false
    selectedAgentId.value = ''
    loadTabData('Agents')
    loadWorkspaces()
    showToast('Agent assigned', 'success')
  } catch (e) {
    showToast('Failed to assign agent', 'error')
  }
}

const removeAssignment = async (assignment) => {
  if (!confirm(`Remove agent "${assignment.agent_name}"?`)) return
  try {
    await api.delete(`/workspaces/${selectedWorkspace.value.id}/agents/`, {
      data: { assignment_id: assignment.id }
    })
    loadTabData('Agents')
    loadWorkspaces()
    showToast('Agent removed', 'success')
  } catch (e) {
    showToast('Failed to remove agent', 'error')
  }
}

const toggleAssignment = async (assignment) => {
  try {
    await api.patch(`/workspaces/${selectedWorkspace.value.id}/agents/`, {
      assignment_id: assignment.id,
      enabled: !assignment.enabled
    })
    assignment.enabled = !assignment.enabled
    showToast(
      assignment.enabled ? 'Workspace routing enabled' : 'Workspace routing disabled',
      'success'
    )
  } catch (e) {
    showToast('Failed to toggle routing', 'error')
  }
}

const syncCredential = async () => {
  if (!selectedWorkspace.value || !credForm.value.service_slug || !credForm.value.value) return
  try {
    await api.post(`/workspaces/${selectedWorkspace.value.id}/credential-sync/`, credForm.value)
    showToast('Credential synced to agent', 'success')
    credForm.value = { service_slug: '', auth_type: 'bearer', header_name: 'Authorization', value: '' }
  } catch (e) {
    showToast(e.response?.data?.error || 'Failed to sync credential', 'error')
  }
}

const toggleMenu = (id) => {
  activeMenu.value = activeMenu.value === id ? null : id
}

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    showToast('Copied to clipboard', 'success')
  } catch (e) {
    showToast('Failed to copy', 'error')
  }
}

const statusLabel = (status) => {
  const labels = { connected: 'Connected', disconnected: 'Disconnected', pending: 'Pending' }
  return labels[status] || status
}

const timeAgo = (dateStr) => {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const formatBridgeUptime = (seconds) => {
  if (!seconds) return '—'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}

const stopOneBridge = async (bridgeId) => {
  if (!selectedWorkspace.value) return
  try {
    await api.delete(`/workspaces/${selectedWorkspace.value.id}/bridges/`, { data: { bridge_id: bridgeId } })
    showToast('Bridge stopped', 'success')
    loadTabData('Bridges')
  } catch (e) {
    showToast('Failed to stop bridge', 'error')
  }
}

const stopAllBridges = async () => {
  if (!selectedWorkspace.value || !confirm('Stop all bridges?')) return
  try {
    await api.delete(`/workspaces/${selectedWorkspace.value.id}/bridges/`)
    bridgeList.value = []
    showToast('All bridges stopped', 'success')
  } catch (e) {
    showToast('Failed to stop bridges', 'error')
  }
}

const showToast = (message, type = 'info') => {
  toast.value = { message, type }
  setTimeout(() => { toast.value = null }, 3000)
}

// Init
onMounted(loadWorkspaces)
</script>

<style scoped>
/* ===== Layout ===== */
.workspace-hub {
  max-width: 1200px;
  margin: 0 auto;
}

.hub-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}

.hub-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.hub-subtitle {
  color: #64748b;
  margin: 4px 0 0;
  font-size: 0.9rem;
}

/* ===== Buttons ===== */
.btn-create {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-create:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4); }
.btn-create:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
.btn-create svg { width: 16px; height: 16px; }

.btn-small {
  display: flex; align-items: center; gap: 4px;
  padding: 6px 12px; background: #f1f5f9; color: #475569;
  border: 1px solid #e2e8f0; border-radius: 6px;
  font-size: 0.8rem; cursor: pointer; transition: all 0.15s;
}
.btn-small:hover { background: #e2e8f0; }
.btn-small svg { width: 14px; height: 14px; }
.btn-confirm { background: #6366f1; color: white; border-color: #6366f1; }
.btn-confirm:hover { background: #4f46e5; }
.btn-confirm:disabled { opacity: 0.5; }

.btn-cancel {
  padding: 10px 20px; background: #f1f5f9; color: #475569;
  border: 1px solid #e2e8f0; border-radius: 10px;
  font-weight: 600; cursor: pointer;
}

.btn-remove {
  padding: 4px; background: none; border: none; cursor: pointer;
  color: #94a3b8; transition: color 0.15s;
}
.btn-remove:hover { color: #ef4444; }
.btn-remove svg { width: 16px; height: 16px; }

.icon-btn {
  padding: 4px; background: none; border: none; cursor: pointer;
  color: #64748b; transition: color 0.15s;
}
.icon-btn:hover { color: #6366f1; }
.icon-btn svg { width: 18px; height: 18px; }

/* ===== Loading & Empty States ===== */
.loading-state {
  display: flex; align-items: center; justify-content: center; gap: 12px;
  padding: 80px 0; color: #64748b;
}

.spinner {
  width: 24px; height: 24px; border: 3px solid #e2e8f0;
  border-top-color: #6366f1; border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.empty-state {
  text-align: center; padding: 80px 20px;
}
.empty-icon svg { width: 64px; height: 64px; color: #cbd5e1; margin-bottom: 16px; }
.empty-state h3 { font-size: 1.25rem; color: #0f172a; margin: 0 0 8px; }
.empty-state p { color: #64748b; margin: 0 0 24px; }
.empty-inline { color: #94a3b8; font-size: 0.875rem; padding: 16px 0; text-align: center; }

/* ===== Workspace Cards ===== */
.workspace-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

.workspace-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}
.workspace-card:hover {
  border-color: #c7d2fe;
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.1);
  transform: translateY(-2px);
}
.workspace-card.card-connected {
  border-color: #86efac;
  box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.15);
}

.card-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 12px; position: relative;
}

.card-status { display: flex; align-items: center; gap: 6px; }

.status-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #94a3b8;
}
.status-dot.connected { background: #10b981; box-shadow: 0 0 8px rgba(16, 185, 129, 0.5); }
.status-dot.disconnected { background: #f59e0b; }
.status-dot.pending { background: #94a3b8; }

.status-label { font-size: 0.75rem; color: #64748b; font-weight: 500; }

.card-menu-btn {
  padding: 4px; background: none; border: none; cursor: pointer;
  color: #94a3b8; transition: color 0.15s;
}
.card-menu-btn:hover { color: #475569; }
.card-menu-btn svg { width: 16px; height: 16px; }

.card-dropdown {
  position: absolute; top: 100%; right: 0; z-index: 10;
  background: white; border: 1px solid #e2e8f0; border-radius: 8px;
  box-shadow: 0 8px 20px rgba(0 ,0, 0, 0.1); overflow: hidden;
  min-width: 160px;
}
.card-dropdown button {
  display: block; width: 100%; padding: 10px 14px; text-align: left;
  background: none; border: none; font-size: 0.85rem; cursor: pointer;
  color: #475569; transition: background 0.1s;
}
.card-dropdown button:hover { background: #f8fafc; }
.card-dropdown button.danger { color: #ef4444; }
.card-dropdown button.danger:hover { background: #fef2f2; }

.card-name {
  font-size: 1.1rem; font-weight: 600; color: #0f172a;
  margin: 0 0 16px;
}

.card-stats {
  display: flex; gap: 20px; margin-bottom: 16px;
}
.stat { text-align: center; }
.stat-value { display: block; font-size: 1.1rem; font-weight: 700; color: #0f172a; }
.stat-label { display: block; font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; }

.card-agents { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.agent-chip {
  padding: 3px 10px; background: #eef2ff; color: #6366f1;
  border-radius: 100px; font-size: 0.75rem; font-weight: 500;
}
.agent-chip.more { background: #f1f5f9; color: #64748b; }

.card-footer { border-top: 1px solid #f1f5f9; padding-top: 12px; }
.card-time { font-size: 0.75rem; color: #94a3b8; }

/* ===== Detail Panel ===== */
.detail-panel {
  position: fixed; inset: 0; z-index: 100;
  display: flex; justify-content: flex-end;
}
.panel-backdrop {
  position: absolute; inset: 0; background: rgba(0, 0, 0, 0.3);
}
.panel-content {
  position: relative; width: 520px; max-width: 95vw;
  background: white; height: 100vh; overflow-y: auto;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.1);
  padding: 24px;
}

.panel-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-bottom: 24px;
}
.panel-header h2 { font-size: 1.25rem; font-weight: 700; color: #0f172a; margin: 0 0 4px; }
.panel-close {
  padding: 6px; background: #f1f5f9; border: none; border-radius: 8px;
  cursor: pointer; color: #64748b; transition: all 0.15s;
}
.panel-close:hover { background: #e2e8f0; }
.panel-close svg { width: 18px; height: 18px; }

.panel-section {
  margin-bottom: 28px;
}
.panel-section h4 {
  font-size: 0.85rem; font-weight: 600; color: #0f172a;
  margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.04em;
}
.section-desc { color: #64748b; font-size: 0.85rem; margin: 0 0 12px; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }

/* ===== Code Block ===== */
.code-block {
  background: #0f172a; color: #e2e8f0; border-radius: 10px;
  padding: 14px 16px; font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem; line-height: 1.6; overflow-x: auto;
  display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;
}
.code-block-alt {
  background: #1e293b;
}
.code-block code { flex: 1; word-break: break-all; }
.copy-btn {
  flex-shrink: 0; padding: 4px; background: rgba(255, 255, 255, 0.1);
  border: none; border-radius: 4px; cursor: pointer;
  color: #94a3b8; transition: all 0.15s;
}
.copy-btn:hover { background: rgba(255, 255, 255, 0.2); color: white; }
.copy-btn svg { width: 16px; height: 16px; }

/* ===== Token ===== */
.token-display {
  display: flex; align-items: center; gap: 8px;
  background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;
  padding: 10px 14px;
}
.token-display code {
  flex: 1; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;
  color: #475569; word-break: break-all;
}
.token-actions { display: flex; gap: 4px; }

/* ===== Tabs ===== */
.panel-tabs {
  display: flex; gap: 2px; margin-bottom: 20px;
  background: #f1f5f9; border-radius: 10px; padding: 3px;
}
.panel-tabs button {
  flex: 1; padding: 8px 16px; background: none; border: none;
  border-radius: 8px; font-size: 0.85rem; font-weight: 500;
  cursor: pointer; color: #64748b; transition: all 0.15s;
}
.panel-tabs button.active {
  background: white; color: #6366f1; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

/* ===== Assignments ===== */
.assign-form {
  display: flex; gap: 8px; margin-bottom: 16px;
}
.assignment-list { display: flex; flex-direction: column; gap: 8px; }
.assignment-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 14px; background: #f8fafc; border-radius: 8px;
  border: 1px solid #e2e8f0;
}
.assignment-name { font-weight: 600; font-size: 0.9rem; color: #0f172a; }
.assignment-meta { display: block; font-size: 0.75rem; color: #94a3b8; margin-top: 2px; }
.assignment-actions { display: flex; align-items: center; gap: 8px; }

/* Toggle Switch */
.btn-toggle {
  background: none; border: none; cursor: pointer; padding: 2px;
}
.toggle-track {
  display: block; width: 36px; height: 20px; border-radius: 10px;
  background: #cbd5e1; position: relative; transition: background 0.2s;
}
.btn-toggle.active .toggle-track { background: #6366f1; }
.toggle-thumb {
  display: block; width: 16px; height: 16px; border-radius: 50%;
  background: white; position: absolute; top: 2px; left: 2px;
  transition: transform 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.btn-toggle.active .toggle-thumb { transform: translateX(16px); }

/* ===== Bridges ===== */
.bridge-list { display: flex; flex-direction: column; gap: 8px; }
.bridge-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; background: #f8fafc; border-radius: 8px;
  border: 1px solid #e2e8f0;
}
.bridge-status-dot {
  width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
}
.bridge-status-dot.running { background: #10b981; box-shadow: 0 0 6px rgba(16,185,129,0.4); }
.bridge-status-dot.stopped { background: #94a3b8; }
.bridge-status-dot.error { background: #ef4444; box-shadow: 0 0 6px rgba(239,68,68,0.4); }
.bridge-info { flex: 1; min-width: 0; }
.bridge-name { font-weight: 600; font-size: 0.9rem; color: #0f172a; display: block; }
.bridge-meta { display: block; font-size: 0.75rem; color: #94a3b8; margin-top: 2px; font-family: monospace; }
.bridge-err { color: #ef4444; font-weight: 600; }

/* ===== Activity ===== */
.activity-list { display: flex; flex-direction: column; gap: 6px; }
.activity-item {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 14px; background: #f8fafc; border-radius: 8px;
}
.activity-icon {
  width: 22px; height: 22px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.7rem; font-weight: 700; flex-shrink: 0;
}
.activity-icon.success { background: #dcfce7; color: #16a34a; }
.activity-icon.error { background: #fef2f2; color: #dc2626; }
.activity-tool { font-weight: 600; font-size: 0.85rem; color: #0f172a; }
.activity-time { display: block; font-size: 0.75rem; color: #94a3b8; }
.activity-error { font-size: 0.75rem; color: #ef4444; margin-left: auto; }

/* ===== Credential Form ===== */
.cred-form { display: flex; flex-direction: column; gap: 12px; }
.form-group { display: flex; flex-direction: column; gap: 4px; }
.form-group label { font-size: 0.8rem; font-weight: 500; color: #475569; }
.form-input, .form-select {
  padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px;
  font-size: 0.875rem; transition: border-color 0.15s;
  background: white;
}
.form-input:focus, .form-select:focus {
  outline: none; border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

/* ===== Setup Tab ===== */
.setup-section { padding-bottom: 24px; }
.setup-method {
  background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;
  padding: 18px; margin-bottom: 16px;
}
.method-header { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.method-header h5 { margin: 0; font-size: 1rem; color: #0f172a; }
.method-badge {
  font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
  padding: 3px 8px; border-radius: 5px; letter-spacing: 0.5px;
}
.method-badge.docker { background: #dbeafe; color: #2563eb; }
.method-badge.python { background: #fef3c7; color: #b45309; }
.method-desc { font-size: 0.825rem; color: #64748b; margin: 0 0 14px; }
.setup-steps { display: flex; flex-direction: column; gap: 8px; }
.step { display: flex; align-items: center; gap: 10px; }
.step-num {
  width: 22px; height: 22px; border-radius: 50%;
  background: #6366f1; color: white; font-size: 0.75rem; font-weight: 700;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.step-label { font-size: 0.85rem; font-weight: 500; color: #334155; }
.setup-section .code-block {
  display: flex; align-items: flex-start; gap: 8px;
  background: #0f172a; border-radius: 8px; padding: 14px; margin-bottom: 4px;
}
.setup-section .code-block code {
  flex: 1; font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 0.78rem;
  color: #e2e8f0; white-space: pre-wrap; word-break: break-all; line-height: 1.5;
}
.setup-section .btn-copy {
  background: rgba(255,255,255,0.1); border: none; border-radius: 6px;
  padding: 6px; cursor: pointer; flex-shrink: 0; transition: background 0.15s;
}
.setup-section .btn-copy:hover { background: rgba(255,255,255,0.2); }
.setup-section .btn-copy svg { width: 14px; height: 14px; stroke: #94a3b8; }
.step-hint {
  font-size: 0.78rem; color: #94a3b8; margin: 4px 0 0 32px; font-style: italic;
}
.step-hint code {
  background: #f1f5f9; padding: 1px 5px; border-radius: 3px;
  font-size: 0.75rem; color: #6366f1;
}
.setup-verify {
  margin-top: 8px; padding: 14px 18px; background: #f0fdf4;
  border: 1px solid #bbf7d0; border-radius: 10px;
}
.setup-verify h5 { margin: 0 0 4px; font-size: 0.9rem; color: #166534; }
.setup-verify p { margin: 0; font-size: 0.825rem; color: #15803d; }

/* ===== Modal ===== */
.modal-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0, 0, 0, 0.4);
  display: flex; align-items: center; justify-content: center;
}
.modal-content {
  background: white; border-radius: 16px; padding: 28px;
  width: 440px; max-width: 95vw;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}
.modal-content h3 { margin: 0 0 8px; font-size: 1.2rem; color: #0f172a; }
.modal-content p { margin: 0 0 20px; color: #64748b; font-size: 0.9rem; }
.modal-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px; }

/* ===== Toast ===== */
.toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  padding: 12px 24px; border-radius: 10px; font-size: 0.875rem; font-weight: 500;
  z-index: 300; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
.toast.success { background: #10b981; color: white; }
.toast.error { background: #ef4444; color: white; }
.toast.info { background: #6366f1; color: white; }

/* ===== Transitions ===== */
.slide-enter-active { transition: all 0.3s ease; }
.slide-leave-active { transition: all 0.2s ease; }
.slide-enter-from .panel-content { transform: translateX(100%); }
.slide-leave-to .panel-content { transform: translateX(100%); }
.slide-enter-from .panel-backdrop { opacity: 0; }
.slide-leave-to .panel-backdrop { opacity: 0; }

.modal-enter-active { transition: all 0.2s ease; }
.modal-leave-active { transition: all 0.15s ease; }
.modal-enter-from { opacity: 0; }
.modal-leave-to { opacity: 0; }
.modal-enter-from .modal-content { transform: scale(0.95); }

.toast-enter-active { transition: all 0.3s ease; }
.toast-leave-active { transition: all 0.2s ease; }
.toast-enter-from { opacity: 0; transform: translate(-50%, 20px); }
.toast-leave-to { opacity: 0; transform: translate(-50%, 20px); }
</style>
