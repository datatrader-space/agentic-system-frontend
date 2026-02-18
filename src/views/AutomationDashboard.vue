<template>
  <div class="automation-dashboard">
    <!-- Header -->
    <div class="ad-header">
      <div class="ad-header-content">
        <div class="ad-title-group">
          <h1 class="ad-title">
            <svg class="ad-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
            </svg>
            Automation
          </h1>
          <p class="ad-subtitle">Workflows, schedules, scripts & execution history</p>
        </div>
        <div class="ad-header-actions">
          <button class="ad-btn ad-btn-primary" @click="showCreateWorkflow = true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14m-7-7h14"/></svg>
            New Workflow
          </button>
        </div>
      </div>

      <!-- Tabs -->
      <div class="ad-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="ad-tab"
          :class="{ 'ad-tab-active': activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          <svg class="ad-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" v-html="tab.icon"></svg>
          {{ tab.label }}
          <span v-if="tab.count !== null" class="ad-tab-count">{{ tab.count }}</span>
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="ad-content">

      <!-- WORKFLOWS TAB -->
      <div v-if="activeTab === 'workflows'" class="ad-panel">
        <div v-if="loading.workflows" class="ad-loading">
          <div class="ad-spinner"></div>
          <span>Loading workflows...</span>
        </div>
        <div v-else-if="workflows.length === 0" class="ad-empty">
          <svg class="ad-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
          </svg>
          <h3>No workflows yet</h3>
          <p>Create your first workflow to automate repetitive tasks.</p>
          <button class="ad-btn ad-btn-primary" @click="showCreateWorkflow = true">Create Workflow</button>
        </div>
        <div v-else class="ad-grid">
          <div v-for="wf in workflows" :key="wf.id" class="ad-card">
            <div class="ad-card-header">
              <div class="ad-card-title-row">
                <h3 class="ad-card-title">{{ wf.name }}</h3>
                <span class="ad-badge" :class="'ad-badge-' + wf.category">{{ wf.category }}</span>
              </div>
              <div class="ad-card-meta">
                <span>{{ wf.execution_count || 0 }} runs</span>
                <span>•</span>
                <span>{{ wf.schedule_count || 0 }} schedules</span>
              </div>
            </div>
            <div class="ad-card-body">
              <pre class="ad-card-prompt">{{ wf.prompt?.substring(0, 200) }}{{ wf.prompt?.length > 200 ? '...' : '' }}</pre>
            </div>
            <div class="ad-card-actions">
              <button class="ad-btn ad-btn-sm ad-btn-primary" @click="runWorkflow(wf)">
                ▶ Run
              </button>
              <button class="ad-btn ad-btn-sm ad-btn-ghost" @click="editWorkflow(wf)">
                Edit
              </button>
              <button class="ad-btn ad-btn-sm ad-btn-ghost ad-btn-danger" @click="deleteWorkflow(wf)">
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- SCHEDULES TAB -->
      <div v-if="activeTab === 'schedules'" class="ad-panel">
        <div v-if="loading.schedules" class="ad-loading">
          <div class="ad-spinner"></div>
          <span>Loading schedules...</span>
        </div>
        <div v-else-if="schedules.length === 0" class="ad-empty">
          <svg class="ad-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <h3>No schedules</h3>
          <p>Create a workflow first, then schedule it to run automatically.</p>
        </div>
        <div v-else class="ad-table-wrap">
          <table class="ad-table">
            <thead>
              <tr>
                <th>Workflow</th>
                <th>Schedule</th>
                <th>Channel</th>
                <th>Last Run</th>
                <th>Next Run</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in schedules" :key="s.id">
                <td class="ad-table-name">{{ s.template_name }}</td>
                <td><code class="ad-code">{{ s.schedule }}</code></td>
                <td>
                  <span class="ad-badge ad-badge-channel">{{ s.channel }}</span>
                </td>
                <td>{{ s.last_run ? formatDate(s.last_run) : 'Never' }}</td>
                <td>{{ s.next_run ? formatDate(s.next_run) : '—' }}</td>
                <td>
                  <span class="ad-status-dot" :class="s.active ? 'ad-status-active' : 'ad-status-inactive'"></span>
                  {{ s.active ? 'Active' : 'Paused' }}
                </td>
                <td>
                  <button class="ad-btn ad-btn-xs" @click="toggleSchedule(s)">
                    {{ s.active ? 'Pause' : 'Resume' }}
                  </button>
                  <button class="ad-btn ad-btn-xs ad-btn-danger" @click="deleteSchedule(s)">
                    Delete
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- SCRIPTS TAB -->
      <div v-if="activeTab === 'scripts'" class="ad-panel">
        <div v-if="loading.scripts" class="ad-loading">
          <div class="ad-spinner"></div>
          <span>Loading scripts...</span>
        </div>
        <div v-else-if="scripts.length === 0" class="ad-empty">
          <svg class="ad-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"/>
          </svg>
          <h3>No scripts registered</h3>
          <p>Run the seed command to register your engineering scripts.</p>
          <code class="ad-code-block">python manage.py seed_engineering_scripts --profile-id 3</code>
        </div>
        <div v-else class="ad-grid">
          <div v-for="script in scripts" :key="script.id" class="ad-card ad-card-script">
            <div class="ad-card-header">
              <div class="ad-card-title-row">
                <div class="ad-script-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25"/>
                  </svg>
                </div>
                <div>
                  <h3 class="ad-card-title">{{ script.name }}</h3>
                  <span class="ad-badge" :class="'ad-badge-' + script.category">{{ script.category }}</span>
                </div>
              </div>
            </div>
            <div class="ad-card-body">
              <p class="ad-card-desc">{{ script.description }}</p>
              <div v-if="Object.keys(script.parameters || {}).length" class="ad-param-list">
                <div class="ad-param-header">Parameters:</div>
                <div v-for="(param, key) in script.parameters" :key="key" class="ad-param-item">
                  <code>{{ key }}</code>
                  <span class="ad-param-type">{{ param.type || 'string' }}</span>
                  <span v-if="param.required" class="ad-param-required">required</span>
                </div>
              </div>
            </div>
            <div class="ad-card-footer">
              <span class="ad-card-path">{{ script.file_path }}</span>
              <span class="ad-card-runs">{{ script.execution_count || 0 }} runs</span>
            </div>
          </div>
        </div>
      </div>

      <!-- EXECUTIONS TAB -->
      <div v-if="activeTab === 'executions'" class="ad-panel">
        <div class="ad-exec-filters">
          <select v-model="execFilter.status" @change="loadExecutions" class="ad-select">
            <option value="">All Statuses</option>
            <option value="running">Running</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
          <select v-model="execFilter.triggered_by" @change="loadExecutions" class="ad-select">
            <option value="">All Triggers</option>
            <option value="manual">Manual</option>
            <option value="schedule">Scheduled</option>
            <option value="monitor">Monitor</option>
          </select>
          <button class="ad-btn ad-btn-ghost" @click="loadExecutions">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            Refresh
          </button>
        </div>

        <div v-if="loading.executions" class="ad-loading">
          <div class="ad-spinner"></div>
          <span>Loading execution history...</span>
        </div>
        <div v-else-if="executions.length === 0" class="ad-empty">
          <svg class="ad-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z"/>
          </svg>
          <h3>No executions yet</h3>
          <p>Run a workflow or script to see execution history here.</p>
        </div>
        <div v-else class="ad-table-wrap">
          <table class="ad-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Status</th>
                <th>Trigger</th>
                <th>Started</th>
                <th>Duration</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="ex in executions" :key="ex.id" class="ad-exec-row" :class="'ad-exec-' + ex.status">
                <td class="ad-table-id">#{{ ex.id }}</td>
                <td class="ad-table-name">{{ ex.workflow_name || ex.script_name || '—' }}</td>
                <td>
                  <span class="ad-status-badge" :class="'ad-status-' + ex.status">
                    {{ ex.status }}
                  </span>
                </td>
                <td>{{ ex.triggered_by }}</td>
                <td>{{ formatDate(ex.started_at) }}</td>
                <td>{{ ex.duration_seconds ? ex.duration_seconds.toFixed(1) + 's' : '—' }}</td>
                <td>
                  <button class="ad-btn ad-btn-xs" @click="viewExecution(ex)">
                    Details
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- CREATE WORKFLOW MODAL -->
    <Transition name="modal">
      <div v-if="showCreateWorkflow" class="ad-modal-overlay" @click.self="showCreateWorkflow = false">
        <div class="ad-modal">
          <div class="ad-modal-header">
            <h2>{{ editingWorkflow ? 'Edit Workflow' : 'New Workflow' }}</h2>
            <button class="ad-modal-close" @click="showCreateWorkflow = false">&times;</button>
          </div>
          <div class="ad-modal-body">
            <div class="ad-form-group">
              <label>Name</label>
              <input v-model="workflowForm.name" type="text" class="ad-input" placeholder="e.g. Morning Health Check" />
            </div>
            <div class="ad-form-group">
              <label>Category</label>
              <select v-model="workflowForm.category" class="ad-select">
                <option value="general">General</option>
                <option value="deployment">Deployment</option>
                <option value="monitoring">Monitoring</option>
                <option value="reporting">Reporting</option>
              </select>
            </div>
            <div class="ad-form-group">
              <label>Prompt</label>
              <textarea v-model="workflowForm.prompt" class="ad-textarea" rows="6"
                placeholder="The prompt to send to the agent when this workflow executes. Use {{today}}, {{now}} for dynamic values."></textarea>
            </div>

            <!-- Schedule section -->
            <div class="ad-form-group">
              <label class="ad-label-row">
                <input type="checkbox" v-model="workflowForm.addSchedule" class="ad-checkbox" />
                <span>Schedule this workflow</span>
              </label>
            </div>
            <template v-if="workflowForm.addSchedule">
              <div class="ad-form-group">
                <label>Cron Expression</label>
                <input v-model="workflowForm.schedule" type="text" class="ad-input" placeholder="0 8 * * *  (8am daily)" />
                <span class="ad-form-hint">minute hour day month weekday</span>
              </div>
              <div class="ad-form-group">
                <label>Delivery Channel</label>
                <select v-model="workflowForm.channel" class="ad-select">
                  <option value="log">Log Only</option>
                  <option value="telegram">Telegram</option>
                  <option value="slack">Slack</option>
                  <option value="email">Email</option>
                </select>
              </div>
            </template>
          </div>
          <div class="ad-modal-footer">
            <button class="ad-btn ad-btn-ghost" @click="showCreateWorkflow = false">Cancel</button>
            <button class="ad-btn ad-btn-primary" @click="saveWorkflow" :disabled="!workflowForm.name || !workflowForm.prompt">
              {{ editingWorkflow ? 'Update' : 'Create' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- EXECUTION DETAIL MODAL -->
    <Transition name="modal">
      <div v-if="selectedExecution" class="ad-modal-overlay" @click.self="selectedExecution = null">
        <div class="ad-modal ad-modal-lg">
          <div class="ad-modal-header">
            <h2>Execution #{{ selectedExecution.id }}</h2>
            <button class="ad-modal-close" @click="selectedExecution = null">&times;</button>
          </div>
          <div class="ad-modal-body">
            <div class="ad-detail-grid">
              <div class="ad-detail-item">
                <label>Status</label>
                <span class="ad-status-badge" :class="'ad-status-' + selectedExecution.status">
                  {{ selectedExecution.status }}
                </span>
              </div>
              <div class="ad-detail-item">
                <label>Triggered By</label>
                <span>{{ selectedExecution.triggered_by }}</span>
              </div>
              <div class="ad-detail-item">
                <label>Started</label>
                <span>{{ formatDate(selectedExecution.started_at) }}</span>
              </div>
              <div class="ad-detail-item">
                <label>Duration</label>
                <span>{{ selectedExecution.duration_seconds ? selectedExecution.duration_seconds.toFixed(2) + 's' : '—' }}</span>
              </div>
            </div>

            <!-- Steps -->
            <div v-if="selectedExecution.steps?.length" class="ad-steps">
              <h3 class="ad-steps-title">Steps</h3>
              <div v-for="(step, i) in selectedExecution.steps" :key="i" class="ad-step">
                <span class="ad-step-icon" :class="step.status === 'success' ? 'ad-step-ok' : 'ad-step-fail'">
                  {{ step.status === 'success' ? '✓' : '✗' }}
                </span>
                <span class="ad-step-name">{{ step.step }}</span>
                <span v-if="step.duration" class="ad-step-dur">{{ step.duration }}s</span>
              </div>
            </div>

            <!-- Result -->
            <div v-if="selectedExecution.result" class="ad-result-section">
              <h3 class="ad-steps-title">Result</h3>
              <pre class="ad-result-pre">{{ selectedExecution.result }}</pre>
            </div>

            <!-- Error -->
            <div v-if="selectedExecution.error" class="ad-error-section">
              <h3 class="ad-steps-title">Error</h3>
              <pre class="ad-result-pre ad-result-error">{{ selectedExecution.error }}</pre>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, inject } from 'vue'
import api from '../services/api'

const notify = inject('notify', (msg) => alert(msg))

// State
const activeTab = ref('workflows')
const loading = reactive({ workflows: false, schedules: false, scripts: false, executions: false })
const workflows = ref([])
const schedules = ref([])
const scripts = ref([])
const executions = ref([])
const showCreateWorkflow = ref(false)
const editingWorkflow = ref(null)
const selectedExecution = ref(null)
const execFilter = reactive({ status: '', triggered_by: '' })

const workflowForm = reactive({
  name: '',
  prompt: '',
  category: 'general',
  addSchedule: false,
  schedule: '',
  channel: 'log',
})

// Tabs
const tabs = computed(() => [
  { key: 'workflows', label: 'Workflows', icon: '<path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>', count: workflows.value.length },
  { key: 'schedules', label: 'Schedules', icon: '<path d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>', count: schedules.value.length },
  { key: 'scripts', label: 'Scripts', icon: '<path d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"/>', count: scripts.value.length },
  { key: 'executions', label: 'History', icon: '<path d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z"/>', count: executions.value.length },
])

// Methods
const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const loadWorkflows = async () => {
  loading.workflows = true
  try {
    const res = await api.get('/workflows/')
    workflows.value = res.data
  } catch (e) {
    console.error('Failed to load workflows:', e)
  } finally {
    loading.workflows = false
  }
}

const loadSchedules = async () => {
  loading.schedules = true
  try {
    const res = await api.get('/schedules/')
    schedules.value = res.data
  } catch (e) {
    console.error('Failed to load schedules:', e)
  } finally {
    loading.schedules = false
  }
}

const loadScripts = async () => {
  loading.scripts = true
  try {
    const res = await api.get('/scripts/')
    scripts.value = res.data
  } catch (e) {
    console.error('Failed to load scripts:', e)
  } finally {
    loading.scripts = false
  }
}

const loadExecutions = async () => {
  loading.executions = true
  try {
    const params = new URLSearchParams()
    if (execFilter.status) params.set('status', execFilter.status)
    if (execFilter.triggered_by) params.set('triggered_by', execFilter.triggered_by)
    const res = await api.get(`/executions/?${params}`)
    executions.value = res.data
  } catch (e) {
    console.error('Failed to load executions:', e)
  } finally {
    loading.executions = false
  }
}

const saveWorkflow = async () => {
  try {
    if (editingWorkflow.value) {
      await api.put(`/workflows/${editingWorkflow.value.id}/`, {
        name: workflowForm.name,
        prompt: workflowForm.prompt,
        category: workflowForm.category,
      })
      notify('Workflow updated', 'success')
    } else {
      // Get first profile (or let user select)
      const profileRes = await api.get('/agents/')
      const profileId = profileRes.data?.results?.[0]?.id || profileRes.data?.[0]?.id
      if (!profileId) {
        notify('No agent profile found. Create one first.', 'error')
        return
      }

      const res = await api.post('/workflows/', {
        name: workflowForm.name,
        prompt: workflowForm.prompt,
        category: workflowForm.category,
        profile_id: profileId,
      })

      // Create schedule if requested
      if (workflowForm.addSchedule && workflowForm.schedule) {
        await api.post('/schedules/', {
          template_id: res.data.id,
          profile_id: profileId,
          schedule: workflowForm.schedule,
          channel: workflowForm.channel,
        })
      }
      notify('Workflow created', 'success')
    }

    showCreateWorkflow.value = false
    editingWorkflow.value = null
    resetForm()
    loadWorkflows()
    loadSchedules()
  } catch (e) {
    notify(e.response?.data?.error || 'Failed to save workflow', 'error')
  }
}

const runWorkflow = async (wf) => {
  try {
    const res = await api.post(`/workflows/${wf.id}/run/`)
    notify(`Workflow "${wf.name}" executed: ${res.data.status}`, res.data.status === 'success' ? 'success' : 'error')
    loadExecutions()
  } catch (e) {
    notify('Failed to run workflow', 'error')
  }
}

const editWorkflow = (wf) => {
  editingWorkflow.value = wf
  workflowForm.name = wf.name
  workflowForm.prompt = wf.prompt
  workflowForm.category = wf.category
  workflowForm.addSchedule = false
  showCreateWorkflow.value = true
}

const deleteWorkflow = async (wf) => {
  if (!confirm(`Delete workflow "${wf.name}"?`)) return
  try {
    await api.delete(`/workflows/${wf.id}/`)
    notify('Workflow deleted', 'success')
    loadWorkflows()
  } catch (e) {
    notify('Failed to delete workflow', 'error')
  }
}

const toggleSchedule = async (s) => {
  try {
    await api.put(`/schedules/${s.id}/`, { active: !s.active })
    notify(`Schedule ${s.active ? 'paused' : 'resumed'}`, 'success')
    loadSchedules()
  } catch (e) {
    notify('Failed to update schedule', 'error')
  }
}

const deleteSchedule = async (s) => {
  if (!confirm('Delete this schedule?')) return
  try {
    await api.delete(`/schedules/${s.id}/`)
    notify('Schedule deleted', 'success')
    loadSchedules()
  } catch (e) {
    notify('Failed to delete schedule', 'error')
  }
}

const viewExecution = async (ex) => {
  try {
    const res = await api.get(`/executions/${ex.id}/`)
    selectedExecution.value = res.data
  } catch (e) {
    selectedExecution.value = ex
  }
}

const resetForm = () => {
  workflowForm.name = ''
  workflowForm.prompt = ''
  workflowForm.category = 'general'
  workflowForm.addSchedule = false
  workflowForm.schedule = ''
  workflowForm.channel = 'log'
}

// Load on mount
onMounted(() => {
  loadWorkflows()
  loadSchedules()
  loadScripts()
  loadExecutions()
})
</script>

<style scoped>
/* ===== Layout ===== */
.automation-dashboard {
  min-height: 100vh;
  background: #0f172a;
  color: #e2e8f0;
}

/* ===== Header ===== */
.ad-header {
  background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%);
  border-bottom: 1px solid rgba(139, 92, 246, 0.2);
  padding: 0 24px;
}

.ad-header-content {
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.ad-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #f8fafc;
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
}

.ad-title-icon {
  width: 28px;
  height: 28px;
  color: #a78bfa;
}

.ad-subtitle {
  color: #94a3b8;
  font-size: 0.875rem;
  margin: 4px 0 0;
}

/* ===== Tabs ===== */
.ad-tabs {
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  gap: 4px;
  padding-top: 20px;
}

.ad-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #94a3b8;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.ad-tab:hover {
  color: #e2e8f0;
}

.ad-tab-active {
  color: #a78bfa;
  border-bottom-color: #8b5cf6;
}

.ad-tab-icon {
  width: 18px;
  height: 18px;
}

.ad-tab-count {
  padding: 1px 8px;
  font-size: 0.75rem;
  background: rgba(139, 92, 246, 0.15);
  color: #c4b5fd;
  border-radius: 10px;
}

.ad-tab-active .ad-tab-count {
  background: rgba(139, 92, 246, 0.3);
}

/* ===== Content ===== */
.ad-content {
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px;
}

.ad-panel {
  min-height: 300px;
}

/* ===== Loading & Empty ===== */
.ad-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 0;
  color: #94a3b8;
}

.ad-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(139, 92, 246, 0.2);
  border-top-color: #8b5cf6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.ad-empty {
  text-align: center;
  padding: 60px 20px;
}

.ad-empty-icon {
  width: 48px;
  height: 48px;
  color: #475569;
  margin-bottom: 16px;
}

.ad-empty h3 {
  font-size: 1.125rem;
  color: #e2e8f0;
  margin: 0 0 8px;
}

.ad-empty p {
  color: #94a3b8;
  font-size: 0.875rem;
  margin: 0 0 20px;
}

/* ===== Grid ===== */
.ad-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 16px;
}

/* ===== Card ===== */
.ad-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 12px;
  overflow: hidden;
  transition: border-color 0.2s, transform 0.2s;
}

.ad-card:hover {
  border-color: #6366f1;
  transform: translateY(-1px);
}

.ad-card-header {
  padding: 16px 16px 0;
}

.ad-card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.ad-card-title {
  font-size: 1rem;
  font-weight: 600;
  color: #f1f5f9;
  margin: 0;
}

.ad-card-meta {
  display: flex;
  gap: 6px;
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 4px;
}

.ad-card-body {
  padding: 12px 16px;
}

.ad-card-prompt {
  font-size: 0.8rem;
  color: #94a3b8;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  padding: 10px;
  margin: 0;
  white-space: pre-wrap;
  max-height: 80px;
  overflow: hidden;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

.ad-card-desc {
  font-size: 0.85rem;
  color: #94a3b8;
  line-height: 1.5;
  margin: 0;
}

.ad-card-actions {
  padding: 12px 16px;
  display: flex;
  gap: 8px;
  border-top: 1px solid #334155;
}

.ad-card-footer {
  padding: 10px 16px;
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #64748b;
  border-top: 1px solid #334155;
}

.ad-card-path {
  font-family: monospace;
}

/* ===== Script card ===== */
.ad-script-icon {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 10px;
}

.ad-script-icon svg {
  width: 20px;
  height: 20px;
  color: white;
}

.ad-card-script .ad-card-title-row {
  justify-content: flex-start;
}

/* ===== Parameters ===== */
.ad-param-list {
  margin-top: 10px;
}

.ad-param-header {
  font-size: 0.75rem;
  color: #64748b;
  margin-bottom: 6px;
  font-weight: 600;
}

.ad-param-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  padding: 3px 0;
}

.ad-param-item code {
  color: #a78bfa;
  background: rgba(139, 92, 246, 0.1);
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 0.75rem;
}

.ad-param-type {
  color: #64748b;
  font-size: 0.7rem;
}

.ad-param-required {
  color: #f59e0b;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
}

/* ===== Table ===== */
.ad-table-wrap {
  overflow-x: auto;
}

.ad-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 0.875rem;
}

.ad-table th {
  text-align: left;
  padding: 10px 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
  border-bottom: 1px solid #334155;
}

.ad-table td {
  padding: 12px;
  border-bottom: 1px solid #1e293b;
  color: #cbd5e1;
}

.ad-table tbody tr:hover {
  background: rgba(139, 92, 246, 0.05);
}

.ad-table-name {
  font-weight: 500;
  color: #f1f5f9;
}

.ad-table-id {
  color: #64748b;
  font-family: monospace;
}

/* ===== Badges ===== */
.ad-badge {
  padding: 2px 8px;
  font-size: 0.7rem;
  font-weight: 600;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.ad-badge-general { background: #1e3a5f; color: #60a5fa; }
.ad-badge-monitoring { background: #064e3b; color: #34d399; }
.ad-badge-deployment { background: #4c1d95; color: #c4b5fd; }
.ad-badge-reporting { background: #78350f; color: #fbbf24; }
.ad-badge-channel { background: #334155; color: #94a3b8; }

/* ===== Status ===== */
.ad-status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
}

.ad-status-active { background: #10b981; }
.ad-status-inactive { background: #64748b; }

.ad-status-badge {
  padding: 3px 10px;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 6px;
}

.ad-status-running { background: #1e3a5f; color: #60a5fa; }
.ad-status-success { background: #064e3b; color: #34d399; }
.ad-status-failed { background: #450a0a; color: #fca5a5; }
.ad-status-partial { background: #78350f; color: #fbbf24; }

/* ===== Filters ===== */
.ad-exec-filters {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
}

/* ===== Buttons ===== */
.ad-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 0.875rem;
  font-weight: 500;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.ad-btn svg { width: 16px; height: 16px; }

.ad-btn-primary {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  border: none;
}

.ad-btn-primary:hover { background: linear-gradient(135deg, #4f46e5, #7c3aed); }
.ad-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.ad-btn-ghost {
  background: transparent;
  color: #94a3b8;
  border-color: #334155;
}

.ad-btn-ghost:hover { background: #1e293b; color: #e2e8f0; }

.ad-btn-danger { color: #fca5a5; }
.ad-btn-danger:hover { background: rgba(239, 68, 68, 0.1); }

.ad-btn-sm {
  padding: 6px 12px;
  font-size: 0.8rem;
}

.ad-btn-xs {
  padding: 4px 10px;
  font-size: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  color: #94a3b8;
  border: 1px solid #334155;
  border-radius: 6px;
  cursor: pointer;
}

.ad-btn-xs:hover { background: rgba(255, 255, 255, 0.1); color: #e2e8f0; }

/* ===== Form Elements ===== */
.ad-input, .ad-select, .ad-textarea {
  width: 100%;
  padding: 10px 12px;
  font-size: 0.875rem;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  color: #e2e8f0;
  transition: border-color 0.2s;
}

.ad-input:focus, .ad-select:focus, .ad-textarea:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

.ad-textarea {
  resize: vertical;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.8rem;
  line-height: 1.6;
}

.ad-select {
  appearance: none;
  cursor: pointer;
}

.ad-exec-filters .ad-select {
  width: auto;
  min-width: 140px;
}

/* ===== Code ===== */
.ad-code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  padding: 2px 8px;
  background: rgba(139, 92, 246, 0.1);
  border-radius: 4px;
  color: #c4b5fd;
}

.ad-code-block {
  display: block;
  background: #1e293b;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid #334155;
  font-family: monospace;
  font-size: 0.8rem;
  color: #a78bfa;
}

/* ===== Modal ===== */
.ad-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5000;
  padding: 20px;
}

.ad-modal {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 16px;
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
}

.ad-modal-lg { max-width: 700px; }

.ad-modal-header {
  padding: 20px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #334155;
}

.ad-modal-header h2 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #f1f5f9;
  margin: 0;
}

.ad-modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #64748b;
  cursor: pointer;
  padding: 0 4px;
}

.ad-modal-close:hover { color: #e2e8f0; }

.ad-modal-body {
  padding: 24px;
}

.ad-modal-footer {
  padding: 16px 24px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  border-top: 1px solid #334155;
}

/* ===== Form Groups ===== */
.ad-form-group {
  margin-bottom: 16px;
}

.ad-form-group label {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: #94a3b8;
  margin-bottom: 6px;
}

.ad-form-hint {
  display: block;
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 4px;
}

.ad-label-row {
  display: flex !important;
  align-items: center;
  gap: 8px;
}

.ad-checkbox {
  accent-color: #6366f1;
}

/* ===== Detail Modal ===== */
.ad-detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 20px;
}

.ad-detail-item label {
  display: block;
  font-size: 0.75rem;
  color: #64748b;
  margin-bottom: 4px;
}

.ad-detail-item span {
  font-size: 0.9rem;
  color: #e2e8f0;
}

/* ===== Steps ===== */
.ad-steps {
  margin-bottom: 20px;
}

.ad-steps-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: #94a3b8;
  margin: 0 0 10px;
}

.ad-step {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.ad-step-icon {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 600;
}

.ad-step-ok { background: #064e3b; color: #34d399; }
.ad-step-fail { background: #450a0a; color: #fca5a5; }

.ad-step-name { flex: 1; font-size: 0.875rem; }
.ad-step-dur { font-size: 0.75rem; color: #64748b; }

/* ===== Result ===== */
.ad-result-pre {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 14px;
  font-size: 0.8rem;
  color: #94a3b8;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 300px;
  overflow-y: auto;
  font-family: 'JetBrains Mono', monospace;
}

.ad-result-error {
  border-color: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

/* ===== Transitions ===== */
.modal-enter-active, .modal-leave-active {
  transition: opacity 0.2s;
}
.modal-enter-active .ad-modal, .modal-leave-active .ad-modal {
  transition: transform 0.2s;
}
.modal-enter-from, .modal-leave-to {
  opacity: 0;
}
.modal-enter-from .ad-modal {
  transform: scale(0.95) translateY(10px);
}
.modal-leave-to .ad-modal {
  transform: scale(0.95) translateY(10px);
}
</style>
