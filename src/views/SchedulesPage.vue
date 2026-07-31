<template>
  <main class="schedules-page">
    <header class="page-head">
      <div>
        <h1>Automation & Schedules</h1>
        <p>Create recurring runs for your agent to automate tasks, reports, and workflows.</p>
      </div>
    </header>

    <section class="schedules-main">
      <section class="create-card">
        <header class="create-head">
          <div class="head-title">
            <span><Icon icon="lucide:calendar-clock" /></span>
            <div>
              <h2>{{ form.id ? 'Edit Scheduled Run' : 'Create a Scheduled Run' }}</h2>
              <p>Schedule your agent to run automatically</p>
            </div>
          </div>
          <div class="template-picker">
            <button type="button" class="template-btn" @click="templateMenuOpen = !templateMenuOpen">
              <Icon icon="lucide:calendar-days" /> Use template <Icon icon="lucide:chevron-down" />
            </button>
            <div v-if="templateMenuOpen" class="template-menu">
              <button
                v-for="template in templates"
                :key="template.title"
                type="button"
                @click="applyTemplate(template)"
              >
                <Icon :icon="template.icon" />
                <span><strong>{{ template.title }}</strong><small>{{ template.copy }}</small></span>
              </button>
            </div>
          </div>
        </header>

        <div class="create-body">
          <section class="schedule-basics">
            <article class="step-field agent-field">
              <h3><Icon icon="lucide:user-round" /><span class="step-index">1</span><span>Agent</span></h3>
              <select v-model="form.agent_id">
                <option value="" disabled>Select an agent…</option>
                <option v-for="a in agents" :key="a.id" :value="a.id">{{ a.name }}</option>
              </select>
            </article>

            <article class="step-field name-field">
              <h3><Icon icon="lucide:tag" /><span class="step-index">2</span><span>Schedule</span></h3>
              <input v-model="form.name" placeholder="e.g. Daily report, Hourly sync..." />
            </article>

            <article class="step-field task-field">
              <h3><Icon icon="lucide:target" /><span class="step-index">3</span><span>Task</span></h3>
              <div class="textarea-wrap">
                <textarea
                  v-model="form.prompt"
                  maxlength="500"
                  placeholder="Describe the goal or task for each run..."
                />
                <span>{{ form.prompt.length }} / 500</span>
              </div>
            </article>
          </section>

          <section class="when-panel form-panel">
            <h3 class="panel-title"><Icon icon="lucide:clock-3" /><span class="step-index">4</span><span>Timing</span></h3>
            <div class="when-grid">
              <label>
                <span>Frequency</span>
                <div class="field-control">
                  <Icon icon="lucide:calendar-days" />
                  <select v-model="form.frequency">
                    <option>Daily</option>
                    <option>Hourly</option>
                    <option>Every</option>
                    <option>Weekly</option>
                  </select>
                </div>
              </label>
              <label v-if="form.frequency === 'Weekly'">
                <span>Day of week</span>
                <div class="field-control">
                  <Icon icon="lucide:calendar" />
                  <select v-model.number="form.dow">
                    <option :value="1">Monday</option>
                    <option :value="2">Tuesday</option>
                    <option :value="3">Wednesday</option>
                    <option :value="4">Thursday</option>
                    <option :value="5">Friday</option>
                    <option :value="6">Saturday</option>
                    <option :value="0">Sunday</option>
                  </select>
                </div>
              </label>
              <label v-if="form.frequency === 'Every'">
                <span>Repeat every</span>
                <div class="interval-control">
                  <Icon icon="lucide:timer-reset" />
                  <input
                    v-model="form.interval_value"
                    type="number"
                    min="1"
                    :max="intervalMax"
                    inputmode="numeric"
                    aria-label="Repeat interval"
                    @blur="normalizeIntervalInput"
                  />
                  <select v-model="form.interval_unit" aria-label="Repeat interval unit" @change="normalizeIntervalInput">
                    <option>Minutes</option>
                    <option>Hours</option>
                  </select>
                </div>
              </label>
              <label v-else>
                <span>Time of day</span>
                <div class="field-control">
                  <Icon icon="lucide:clock-3" />
                  <input v-model="form.time" type="time" :disabled="form.frequency === 'Hourly'" value="08:00" />
                </div>
              </label>
              <label>
                <span class="label-with-icon"><Icon icon="lucide:globe-2" /> Timezone</span>
                <select v-model="form.timezone">
                  <option>(UTC +05:00) Asia/Karachi</option>
                  <option>(UTC -05:00) US/Eastern</option>
                </select>
              </label>
              <aside class="next-run">
                <Icon icon="lucide:clock-arrow-up" />
                <div>
                  <strong>Next run</strong>
                  <p>{{ nextRunLabel }}</p>
                  <small>({{ timezoneName }})</small>
                </div>
              </aside>
            </div>
          </section>

          <section class="settings-grid">
            <article class="form-panel advanced-panel">
              <h3 class="panel-title"><Icon icon="lucide:sliders-horizontal" /><span class="step-index">5</span><span>Advanced <small>Optional</small></span></h3>
              <div class="advanced-grid">
                <label>
                  <span>Model Override</span>
                  <select v-model="form.model">
                    <option value="">Agent default</option>
                    <option v-for="m in models" :key="m.id" :value="m.id">{{ m.name || m.model_id }}</option>
                  </select>
                </label>
                <label class="system-prompt">
                  <span>System Prompt Override</span>
                  <input v-model="form.system_prompt" placeholder="Override agent system prompt for this schedule..." />
                </label>
              </div>
            </article>

            <article class="form-panel safety-panel">
              <h3 class="panel-title"><Icon icon="lucide:shield" /><span class="step-index">6</span><span>Safety</span></h3>
              <label class="toggle-row">
                <input type="checkbox" v-model="form.read_only" />
                <span class="toggle" aria-hidden="true"></span>
                <span><strong>Read-only mode</strong><small>Allow the agent to read data but prevent any changes.</small></span>
              </label>
              <label class="expires-field">
                <span class="label-with-icon"><Icon icon="lucide:calendar-x-2" /> Auto-stop date <small>(optional)</small></span>
                <div class="field-control">
                  <Icon icon="lucide:calendar-x-2" />
                  <input type="date" v-model="form.expires_at" />
                </div>
              </label>
              <p class="safety-note">Runs until you pause it (or the optional stop date). Spend and run limits are governed by the agent’s budget (and its workspace / organization) — set those in the agent’s configuration, not per schedule.</p>
            </article>
          </section>

          <section class="bottom-grid">
            <article class="form-panel preview">
              <h3 class="panel-title preview-title"><Icon icon="lucide:calendar-days" /> <span>Schedule Preview</span></h3>
              <div>
                <em>CRON</em>
                <code>{{ cronPreview }}</code>
                <p>{{ cronDescription }}</p>
                <button type="button" @click="copyCron"><Icon icon="lucide:copy" /> {{ copied ? 'Copied' : 'Copy cron' }}</button>
              </div>
            </article>
          </section>
        </div>

        <footer class="create-actions">
          <button type="button" class="ghost" v-if="form.id" @click="resetForm">Cancel edit</button>
          <button type="button" class="ghost" v-else :disabled="saving" @click="submitSchedule(true)"><Icon icon="lucide:bookmark" /> Save as draft</button>
          <button type="button" class="primary" :disabled="saving" @click="submitSchedule(false)">
            <Icon icon="lucide:calendar-days" />
            {{ saving ? 'Saving…' : (form.id ? 'Update Schedule' : 'Create Schedule') }}
          </button>
        </footer>
      </section>

      <section class="schedule-table-card">
        <header class="table-headline">
          <h2>Your Schedules <span>{{ filteredSchedules.length }}</span></h2>
          <div class="table-tools">
            <label><Icon icon="lucide:search" /><input v-model="search" placeholder="Search schedules" /></label>
            <select v-model="statusFilter">
              <option value="">All statuses</option>
              <option value="Active">Active</option>
              <option value="Paused">Paused</option>
            </select>
          </div>
        </header>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Frequency</th>
              <th>Next Run</th>
              <th>Last Run</th>
              <th>Status</th>
              <th>Runs</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="schedule in filteredSchedules" :key="schedule.id">
              <td><strong>{{ schedule.name }}</strong><small>{{ schedule.copy }}</small></td>
              <td>{{ schedule.frequency }}</td>
              <td>{{ schedule.next }}</td>
              <td><span>{{ schedule.last }}</span><small :class="schedule.resultTone">{{ schedule.result }}</small></td>
              <td><b :class="schedule.statusTone">{{ schedule.status }}</b></td>
              <td>{{ schedule.runs }}</td>
              <td class="actions">
                <button title="Run now" @click="runNow(schedule)"><Icon icon="lucide:play" /></button>
                <button title="Run history" @click="openRuns(schedule)"><Icon icon="lucide:history" /></button>
                <button title="Edit" @click="editSchedule(schedule)"><Icon icon="lucide:pencil" /></button>
                <div class="menu-wrap">
                  <button title="More" @click="toggleMenu(schedule.id)"><Icon icon="lucide:more-vertical" /></button>
                  <div v-if="openMenuId === schedule.id" class="row-menu">
                    <button @click="toggleActive(schedule)">
                      <Icon :icon="schedule.active ? 'lucide:pause' : 'lucide:play'" />
                      {{ schedule.active ? 'Pause' : 'Resume' }}
                    </button>
                    <button class="danger" @click="removeSchedule(schedule)">
                      <Icon icon="lucide:trash-2" /> Delete
                    </button>
                  </div>
                </div>
              </td>
            </tr>
            <tr v-if="!loading && !filteredSchedules.length">
              <td colspan="7" class="empty-row">
                <Icon icon="lucide:calendar-clock" />
                <strong>No schedules yet</strong>
                <small>Create a scheduled run above to automate your agent.</small>
              </td>
            </tr>
          </tbody>
        </table>
        <p class="showing">Showing {{ filteredSchedules.length }} of {{ schedules.length }} schedules</p>
      </section>
    </section>

    <aside class="schedule-rail">
      <section class="rail-card how-card">
        <h2>How scheduling works</h2>
        <p>Aadml runs your agent automatically on the schedule you define. Each run uses the latest agent configuration and data.</p>
        <article v-for="step in steps" :key="step.title">
          <span :class="step.tone"><Icon :icon="step.icon" /></span>
          <div><strong>{{ step.title }}</strong><p>{{ step.copy }}</p></div>
        </article>
      </section>

      <section class="rail-card templates-card">
        <h2>Common templates</h2>
        <p>Use a template to get started quickly.</p>
        <button v-for="template in templates" :key="template.title" @click="applyTemplate(template)">
          <span :class="template.tone"><Icon :icon="template.icon" /></span>
          <span><strong>{{ template.title }}</strong><small>{{ template.copy }}</small></span>
          <Icon icon="lucide:chevron-right" />
        </button>
      </section>

      <section class="rail-card tips-card">
        <h2>Tips</h2>
        <ul>
          <li v-for="tip in tips" :key="tip"><Icon icon="lucide:check" />{{ tip }}</li>
        </ul>
        <button @click="openDocs">Learn more about scheduling <Icon icon="lucide:external-link" /></button>
      </section>
    </aside>

    <div v-if="openMenuId" class="menu-backdrop" @click="openMenuId = null"></div>

    <!-- Run history -->
    <div v-if="runsModal" class="runs-modal-backdrop" @click.self="closeRuns">
      <div class="runs-modal">
        <header class="runs-head">
          <div class="runs-head-txt">
            <h3>Run history</h3>
            <p>{{ runsModal.name }}</p>
          </div>
          <button class="runs-close" title="Close" @click="closeRuns"><Icon icon="lucide:x" /></button>
        </header>
        <div class="runs-body">
          <div v-if="runsLoading" class="runs-state"><Icon icon="lucide:loader-2" class="spin" /> Loading runs…</div>
          <div v-else-if="!runsList.length" class="runs-state">
            <Icon icon="lucide:calendar-clock" />
            <span>No runs yet — this schedule hasn't fired.</span>
          </div>
          <ul v-else class="runs-list">
            <li v-for="run in runsList" :key="run.id" class="run-item">
              <div class="run-top">
                <span class="run-dot" :class="'dot-' + run.status"></span>
                <span class="run-status">{{ run.status }}</span>
                <span v-if="run.manual" class="run-badge">manual</span>
                <span class="run-meta">
                  <span v-if="run.duration_seconds != null">{{ run.duration_seconds }}s</span>
                  <span v-if="run.cost_usd && run.cost_usd !== '0'">${{ run.cost_usd }}</span>
                  <span>{{ fmtDate(run.started_at) }}</span>
                </span>
              </div>
              <p v-if="run.error" class="run-error">{{ run.error }}</p>
              <p v-else-if="runAnswer(run)" class="run-answer">{{ runAnswer(run) }}</p>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup>
import { Icon } from '@iconify/vue'
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'

const router = useRouter()

const agents = ref([])
const models = ref([])
const rawSchedules = ref([])
const loading = ref(true)
const saving = ref(false)
const copied = ref(false)
const search = ref('')
const statusFilter = ref('')
const openMenuId = ref(null)
const templateMenuOpen = ref(false)

// Run history drill-down (per-schedule ScheduleRun list, fetched on open)
const runsModal = ref(null)     // the schedule row whose runs are shown, or null
const runsList = ref([])
const runsLoading = ref(false)

const form = reactive({
  id: null,               // 'as_<n>' when editing
  agent_id: '',
  name: '',
  prompt: '',
  frequency: 'Daily',
  time: '08:00',
  interval_value: '15',
  interval_unit: 'Minutes',
  dow: 1,                 // day of week for Weekly (0=Sun … 6=Sat); no visible picker yet
  timezone: '(UTC +05:00) Asia/Karachi',
  model: '',
  system_prompt: '',
  read_only: true,
  expires_at: '',         // optional auto-stop date (YYYY-MM-DD); '' = runs indefinitely
})

// ---- cron helpers ---------------------------------------------------------
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const pad = (n) => String(n).padStart(2, '0')

function buildCron() {
  const [h, m] = (form.time || '08:00').split(':')
  const hh = parseInt(h || '0', 10)
  const mm = parseInt(m || '0', 10)
  if (form.frequency === 'Every') {
    const max = form.interval_unit === 'Minutes' ? 59 : 23
    const interval = Math.max(1, Math.min(max, parseInt(form.interval_value, 10) || 1))
    return form.interval_unit === 'Minutes'
      ? `*/${interval} * * * *`
      : `0 */${interval} * * *`
  }
  if (form.frequency === 'Hourly') return `${mm} * * * *`
  if (form.frequency === 'Weekly') return `${mm} ${hh} * * ${form.dow ?? 1}`
  return `${mm} ${hh} * * *`
}

function describeCron(cron) {
  if (!cron) return '—'
  const p = cron.trim().split(/\s+/)
  if (p.length < 5) return cron
  const [min, hr, , , dow] = p
  if (min.startsWith('*/') && hr === '*') {
    const interval = parseInt(min.slice(2), 10) || 1
    return `Every ${interval} minute${interval === 1 ? '' : 's'}`
  }
  if (min === '0' && hr.startsWith('*/')) {
    const interval = parseInt(hr.slice(2), 10) || 1
    return `Every ${interval} hour${interval === 1 ? '' : 's'}`
  }
  if (hr === '*') return 'Every hour'
  const t = `${pad(parseInt(hr, 10))}:${pad(parseInt(min, 10))}`
  if (dow && dow !== '*') {
    const idx = parseInt(dow, 10)
    return `Weekly on ${DOW[idx] || 'Mon'} ${t}`
  }
  return `Daily at ${t}`
}

const cronPreview = computed(() => buildCron())
const timezoneName = computed(() => (
  form.timezone.match(/[A-Za-z_]+\/[A-Za-z_]+/)?.[0] || 'server time'
))
const cronDescription = computed(() => {
  return `${describeCron(cronPreview.value)} (${timezoneName.value})`
})

const formattedRunTime = computed(() => {
  const [hours = '8', minutes = '00'] = (form.time || '08:00').split(':')
  const hour = Number(hours)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${String(displayHour).padStart(2, '0')}:${minutes} ${suffix}`
})

const intervalMax = computed(() => form.interval_unit === 'Minutes' ? 59 : 23)
const normalizedInterval = computed(() => {
  return Math.max(1, Math.min(intervalMax.value, parseInt(form.interval_value, 10) || 1))
})

function normalizeIntervalInput() {
  form.interval_value = String(normalizedInterval.value)
}

const nextRunLabel = computed(() => {
  if (form.frequency === 'Every') {
    const unit = form.interval_unit === 'Minutes' ? 'minute' : 'hour'
    return `In ${normalizedInterval.value} ${unit}${normalizedInterval.value === 1 ? '' : 's'}`
  }
  if (form.frequency === 'Hourly') return 'Within the next hour'
  if (form.frequency === 'Weekly') return `Next ${DOW[form.dow ?? 1]} at ${formattedRunTime.value}`

  const now = new Date()
  const [hours = '8', minutes = '0'] = (form.time || '08:00').split(':')
  const runMinutes = Number(hours) * 60 + Number(minutes)
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  return `${runMinutes > currentMinutes ? 'Today' : 'Tomorrow'} at ${formattedRunTime.value}`
})

async function copyCron() {
  try {
    await navigator.clipboard.writeText(cronPreview.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch { /* clipboard blocked — ignore */ }
}

// ---- date formatting ------------------------------------------------------
function fmtDate(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

// ---- run history ----------------------------------------------------------
async function openRuns(schedule) {
  openMenuId.value = null
  runsModal.value = schedule
  runsList.value = []
  runsLoading.value = true
  try {
    const res = await api.getScheduleRuns(schedule.id)
    runsList.value = res.data?.runs || []
  } catch (e) {
    notify.error('Could not load run history')
    runsList.value = []
  } finally {
    runsLoading.value = false
  }
}
function closeRuns() {
  runsModal.value = null
  runsList.value = []
}
function runAnswer(run) {
  return (run && run.task_results && run.task_results.final_answer) || ''
}

// ---- table rows -----------------------------------------------------------
const schedules = computed(() => rawSchedules.value.map((s) => {
  const active = !!s.active
  const failed = !active && (s.consecutive_failures > 0 || s.last_error)
  return {
    id: s.id,
    active,
    name: s.template_name || s.name || 'Untitled',
    copy: s.prompt || '',
    frequency: describeCron(s.schedule),
    next: active ? fmtDate(s.next_run) : '—',
    last: fmtDate(s.last_run),
    result: s.last_run ? (s.last_error ? 'Failed' : 'Success') : '',
    resultTone: s.last_error ? 'failed' : 'success',
    status: active ? 'Active' : (failed ? 'Failed' : 'Paused'),
    statusTone: active ? 'active' : (failed ? 'failed-chip' : 'paused'),
    runs: s.run_count ?? 0,
    raw: s,
  }
}))

const filteredSchedules = computed(() => {
  const q = search.value.trim().toLowerCase()
  return schedules.value.filter((s) => {
    if (statusFilter.value && s.status !== statusFilter.value) return false
    if (q && !(`${s.name} ${s.copy}`.toLowerCase().includes(q))) return false
    return true
  })
})

// ---- payload build --------------------------------------------------------
function numOrNull(v) {
  if (v === '' || v == null) return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

// Extract the IANA name (e.g. "Asia/Karachi") from the dropdown label for the backend.
function extractTz(label) {
  return (label || '').match(/[A-Za-z_]+\/[A-Za-z_]+/)?.[0] || 'UTC'
}

function buildPayload(extra = {}) {
  // Schedules carry NO limits — spend/iterations come from the agent's budget + config (enforced by the
  // runtime's BudgetSession). Only the task, cadence, optional model/system-prompt, and read-only ship.
  const overrides = {}
  if (form.model) overrides.model_id = form.model   // model id from the picker; backend resolves it
  if (form.system_prompt) overrides.system_prompt = form.system_prompt

  return {
    name: form.name.trim(),
    prompt: form.prompt.trim(),
    schedule: buildCron(),
    timezone: extractTz(form.timezone),
    profile_overrides: overrides,
    read_only: !!form.read_only,
    // Optional auto-stop: end of the chosen day (backend parses the datetime); '' → null = runs indefinitely.
    expires_at: form.expires_at ? `${form.expires_at}T23:59:59` : null,
    ...extra,
  }
}

// ---- CRUD -----------------------------------------------------------------
async function loadSchedules() {
  loading.value = true
  try {
    const { data } = await api.listSchedules()
    const rows = data?.results || data || []
    // Standalone page manages agent schedules (created here / by automation tools).
    rawSchedules.value = rows.filter((r) => r.source === 'agent_tool' || String(r.id).startsWith('as_'))
  } catch (e) {
    notify.error('Failed to load schedules')
  } finally {
    loading.value = false
  }
}

async function loadAgents() {
  try {
    const { data } = await api.getAgents()
    const rows = data?.results || data || []
    agents.value = rows.filter((a) => !a.is_builtin_agent)
  } catch {
    agents.value = []
  }
}

async function loadModels() {
  try {
    const { data } = await api.getLLMModels()
    models.value = data?.results || data || []
  } catch {
    models.value = []
  }
}

async function submitSchedule(asDraft = false) {
  if (!form.agent_id) return notify.error('Please select an agent')
  if (!form.name.trim()) return notify.error('Schedule name is required')
  if (!form.prompt.trim()) return notify.error('Describe what the agent should do')

  saving.value = true
  try {
    // Drafts are created paused (active:false); editing never changes active from here.
    const payload = form.id ? buildPayload() : buildPayload(asDraft ? { active: false } : {})
    if (form.id) {
      await api.updateSchedule(form.id, payload)
      notify.success('Schedule updated')
    } else {
      await api.createAgentSchedule(form.agent_id, payload)
      notify.success(asDraft ? 'Saved as draft (paused)' : 'Schedule created')
    }
    resetForm()
    await loadSchedules()
  } catch (e) {
    const msg = e?.response?.data?.error || 'Failed to save schedule'
    notify.error(msg)
  } finally {
    saving.value = false
  }
}

function editSchedule(row) {
  const s = row.raw
  const ov = s.profile_overrides || {}
  const p = (s.schedule || '').trim().split(/\s+/)
  form.id = s.id
  form.agent_id = s.agent_profile_id || ''
  form.name = row.name
  form.prompt = s.prompt || ''
  // derive frequency / time from cron
  if (p.length >= 5) {
    if (p[0]?.startsWith('*/') && p[1] === '*') {
      form.frequency = 'Every'
      form.interval_value = String(parseInt(p[0].slice(2), 10) || 1)
      form.interval_unit = 'Minutes'
    } else if (p[0] === '0' && p[1]?.startsWith('*/')) {
      form.frequency = 'Every'
      form.interval_value = String(parseInt(p[1].slice(2), 10) || 1)
      form.interval_unit = 'Hours'
    } else if (p[1] === '*') { form.frequency = 'Hourly'; form.time = '08:00' }
    else {
      form.time = `${pad(parseInt(p[1], 10))}:${pad(parseInt(p[0], 10))}`
      if (p[4] && p[4] !== '*') { form.frequency = 'Weekly'; form.dow = parseInt(p[4], 10) }
      else form.frequency = 'Daily'
    }
  }
  form.model = ov.model_id || ov.model || ''
  form.system_prompt = ov.system_prompt || ''
  // Map the stored IANA timezone back onto the dropdown label (two options today).
  const tz = s.timezone || 'UTC'
  if (tz.includes('Karachi')) form.timezone = '(UTC +05:00) Asia/Karachi'
  else if (tz.includes('Eastern')) form.timezone = '(UTC -05:00) US/Eastern'
  form.read_only = !!s.read_only
  form.expires_at = s.expires_at ? String(s.expires_at).slice(0, 10) : ''
  openMenuId.value = null
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function resetForm() {
  form.id = null
  form.agent_id = ''
  form.name = ''
  form.prompt = ''
  form.frequency = 'Daily'
  form.time = '08:00'
  form.interval_value = '15'
  form.interval_unit = 'Minutes'
  form.dow = 1
  form.model = ''
  form.system_prompt = ''
  form.read_only = true
  form.expires_at = ''
}

async function runNow(row) {
  try {
    await api.runSchedule(row.id)
    notify.success(`“${row.name}” dispatched`)
  } catch {
    notify.error('Failed to run schedule')
  }
}

async function toggleActive(row) {
  openMenuId.value = null
  try {
    await api.updateSchedule(row.id, { active: !row.active })
    notify.success(row.active ? 'Schedule paused' : 'Schedule resumed')
    await loadSchedules()
  } catch {
    notify.error('Failed to update schedule')
  }
}

async function removeSchedule(row) {
  openMenuId.value = null
  const ok = await confirm({
    title: 'Delete schedule?',
    message: `“${row.name}” will be removed permanently.`,
    confirmText: 'Delete',
    danger: true,
  })
  if (!ok) return
  try {
    await api.deleteSchedule(row.id)
    notify.success('Schedule deleted')
    await loadSchedules()
  } catch {
    notify.error('Failed to delete schedule')
  }
}

function toggleMenu(id) {
  openMenuId.value = openMenuId.value === id ? null : id
}

function applyTemplate(t) {
  templateMenuOpen.value = false
  form.id = null
  form.name = t.title
  form.prompt = t.prompt
  form.frequency = t.frequency
  form.time = t.time || '08:00'
  form.dow = t.dow ?? 1
  openMenuId.value = null
  window.scrollTo({ top: 0, behavior: 'smooth' })
  notify.info(`Loaded “${t.title}” template — pick an agent, then Create Schedule.`)
}

function openDocs() {
  router.push({ name: 'dashboard-documentation' }).catch(() => {})
}

onMounted(() => {
  loadAgents()
  loadModels()
  loadSchedules()
})

const steps = [
  { title: 'Define the task', copy: 'Tell your agent what to do.', icon: 'lucide:calendar-check', tone: 'blue' },
  { title: 'Set when & how often', copy: 'Choose frequency and time that works for you.', icon: 'lucide:timer-reset', tone: 'violet' },
  { title: 'We handle the rest', copy: 'Your agent runs automatically and logs results.', icon: 'lucide:search-check', tone: 'green' },
]

const templates = [
  {
    title: 'Daily Report', copy: 'Every day at 08:00', icon: 'lucide:calendar-days', tone: 'blue',
    frequency: 'Daily', time: '08:00', dow: 1,
    prompt: 'Generate a daily report summarizing yesterday’s activity and key metrics, then deliver it.',
  },
  {
    title: 'Hourly Sync', copy: 'Every hour', icon: 'lucide:database-zap', tone: 'green',
    frequency: 'Hourly', time: '08:00', dow: 1,
    prompt: 'Sync the latest data from connected sources and flag anything that changed since the last run.',
  },
  {
    title: 'Weekly Summary', copy: 'Every Monday at 09:00', icon: 'lucide:clipboard-list', tone: 'violet',
    frequency: 'Weekly', time: '09:00', dow: 1,
    prompt: 'Produce a weekly performance summary for the past 7 days with highlights and trends.',
  },
  {
    title: 'Data Cleanup', copy: 'Every Sunday at 02:00', icon: 'lucide:trash-2', tone: 'amber',
    frequency: 'Weekly', time: '02:00', dow: 0,
    prompt: 'Review recent data for duplicates or stale entries and clean them up (read-only unless approved).',
  },
]

const tips = [
  'Use limits to control costs and avoid runaway runs.',
  'Pause after failures helps prevent repeated errors.',
  'You can edit or pause schedules anytime.',
  'All runs are logged in the Activity section.',
]
</script>

<style scoped>
.schedules-page {
  display: grid;
  grid-template-columns: minmax(0, 72fr) minmax(280px, 28fr);
  gap: 24px;
  width: 100%;
  max-width: 1600px;
  min-height: 100%;
  margin: 0 auto;
  padding: 20px 24px 28px;
  box-sizing: border-box;
  background: #f7f9fc;
  color: #111936;
}
.schedules-main { min-width: 0; max-width: none; width: 100%; justify-self: stretch; }
.page-head {
  grid-column: 1 / -1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: -4px;
}
h1, h2, h3, p { margin: 0; }
h1 { font-size: 23px; line-height: 1.12; font-weight: 850; letter-spacing: 0; }
.page-head p, .create-head p, .form-section p, .rail-card p, .showing { color: #5c6d85; font-size: 11.5px; line-height: 1.45; }
.page-head p { margin-top: 8px; }
button, input, select, textarea { font: inherit; }
.demo-btn, .ghost, .primary, .template-btn {
  height: 36px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-size: 11.5px; font-weight: 850;
}
.demo-btn, .ghost, .template-btn { border: 1px solid #d9e3f0; background: #fff; color: #3156e9; padding: 0 14px; }
.primary { border: 0; background: linear-gradient(135deg, #3156e9, #5b3ee8); color: #fff; padding: 0 22px; box-shadow: 0 12px 24px rgba(49,86,233,.18); }
.primary:disabled { opacity: .6; cursor: default; }
.create-card, .schedule-table-card, .rail-card {
  border: 1px solid #dfe7f2; border-radius: 11px; background: #fff; box-shadow: 0 8px 22px rgba(15,23,42,.03);
}
.create-card { overflow: hidden; margin-bottom: 14px; }
.create-head {
  display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 22px 24px; border-bottom: 1px solid #e8eef7;
}
.head-title { display: flex; align-items: center; gap: 14px; }
.head-title > span {
  width: 40px; height: 40px; border-radius: 11px; display: grid; place-items: center; background: #eef4ff; color: #3156e9;
}
.head-title svg { width: 22px; height: 22px; }
.create-head h2, .table-headline h2, .rail-card h2 { font-size: 14px; font-weight: 850; }
.form-grid { display: grid; border-bottom: 1px solid #e8eef7; }
.form-grid.top { grid-template-columns: 1.65fr .9fr .85fr; }
.form-grid.middle { grid-template-columns: 1.45fr 1.55fr; }
.form-section { padding: 20px 22px; border-right: 1px solid #e8eef7; }
.form-section:last-child { border-right: 0; }
.form-section h3, .safety-row h3 {
  display: flex; align-items: center; gap: 9px; color: #3156e9; font-size: 11.5px; font-weight: 850; margin-bottom: 18px;
}
.form-section h3 span, .safety-row h3 span {
  width: 18px; height: 18px; border-radius: 999px; display: grid; place-items: center; background: #3156e9; color: #fff; font-size: 9.5px;
}
label { display: grid; gap: 7px; color: #52637a; font-size: 11px; font-weight: 750; }
.basic label + label, .form-section label + label { margin-top: 16px; }
input, select, textarea {
  width: 100%; border: 1px solid #d7e1ee; border-radius: 7px; background: #fff; color: #334155; font-size: 11px; font-weight: 500;
}
input, select { height: 32px; padding: 0 12px; }
input:disabled { background: #f1f5f9; color: #94a3b8; }
textarea { height: 56px; padding: 10px 12px; resize: vertical; }
input::placeholder, textarea::placeholder { color: #94a3b8; font-weight: 500; }
.two-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
.show-more {
  margin-top: 12px; border: 0; background: transparent; color: #3156e9; display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 850; padding: 0;
}
.limit-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.limit-grid label:nth-child(n+4) { grid-column: span 1; }
.limits p { margin-top: 12px; }
.safety-row {
  display: grid; grid-template-columns: 1.45fr 1.55fr; border-bottom: 1px solid #e8eef7; background: #f7faff;
}
.safety-row article { padding: 18px 22px; border-right: 1px solid #e8eef7; }
.safety-row article:last-child { border-right: 0; }
.checkbox-row { display: flex; align-items: flex-start; gap: 10px; }
.checkbox-row input { width: 14px; height: 14px; padding: 0; accent-color: #3156e9; }
.checkbox-row strong { display: block; color: #0f172a; font-size: 11.5px; }
.checkbox-row small { display: block; color: #64748b; font-size: 10.5px; font-weight: 700; margin-top: 4px; }
.preview > span { display: block; color: #52637a; font-size: 11.5px; font-weight: 850; margin-bottom: 10px; }
.preview div { display: flex; align-items: center; gap: 12px; }
.preview em {
  border-radius: 999px; background: #eaf1ff; color: #3156e9; padding: 4px 8px; font-style: normal; font-size: 10px; font-weight: 900;
}
.preview code { border-radius: 999px; background: #fff; border: 1px solid #dfe7f2; padding: 5px 12px; color: #3156e9; font-size: 10.5px; font-weight: 850; }
.preview p { color: #334155; font-size: 11.5px; font-weight: 750; flex: 1; }
.preview button {
  height: 29px; border: 1px solid #d9e3f0; border-radius: 7px; background: #fff; color: #52637a; display: inline-flex; align-items: center; gap: 6px; padding: 0 10px; font-size: 10.5px; font-weight: 850;
}
.create-actions { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; }

/* Screenshot-aligned scheduled-run form */
.create-card {
  position: relative;
  overflow: hidden;
  margin-bottom: 16px;
  border-color: #e5e9f1;
  border-radius: 14px;
  box-shadow: 0 8px 24px rgba(28,35,55,.055);
}
.create-head {
  padding: 16px 20px;
  border-bottom-color: #e8ebf1;
}
.head-title { gap: 12px; }
.head-title > span {
  width: 44px;
  height: 44px;
  border-radius: 11px;
  flex: 0 0 auto;
  background: linear-gradient(145deg, #f0efff, #f8f7ff);
  color: #654cff;
}
.head-title svg { width: 24px; height: 24px; }
.create-head h2 {
  font-size: 19px;
  line-height: 1.15;
  font-weight: 750;
  letter-spacing: -.15px;
}
.create-head p { margin-top: 4px; color: #65708b; font-size: 12.5px; }
.template-picker { position: relative; }
.template-btn {
  height: 40px;
  padding: 0 14px;
  border-radius: 8px;
  color: #4657f5;
  font-size: 12.5px;
  font-weight: 750;
}
.template-btn svg { width: 19px; height: 19px; }
.template-menu {
  position: absolute;
  top: 56px;
  right: 0;
  z-index: 40;
  width: 260px;
  padding: 7px;
  border: 1px solid #dde2ed;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 18px 42px rgba(23,30,55,.17);
}
.template-menu button {
  width: 100%;
  display: grid;
  grid-template-columns: 24px 1fr;
  gap: 10px;
  align-items: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  padding: 10px;
  color: #4f46e5;
  text-align: left;
}
.template-menu button:hover { background: #f5f4ff; }
.template-menu strong, .template-menu small { display: block; }
.template-menu strong { color: #17203d; font-size: 12.5px; }
.template-menu small { margin-top: 2px; color: #77819b; font-size: 11px; }
.create-body {
  display: grid;
  gap: 20px;
  padding: 24px;
}
.schedule-basics {
  display: grid;
  grid-template-columns: 1.05fr 1.05fr 1.5fr;
  gap: 20px;
  padding: 0;
}
.step-field h3, .panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  color: #202944;
  font-size: 14px;
  font-weight: 680;
}
.step-field h3 svg, .panel-title svg {
  width: 17px;
  height: 17px;
  color: #6b59e8;
}
.step-index {
  width: 18px;
  height: 18px;
  display: inline-grid;
  place-items: center;
  flex: 0 0 auto;
  border: 1px solid #ddd8ff;
  border-radius: 6px;
  background: #f5f3ff;
  color: #6250dc;
  font-size: 10px;
  line-height: 1;
  font-weight: 800;
}
.panel-title small { margin-left: 4px; color: #8b93a8; font-size: 10px; font-weight: 600; }
.create-card label {
  display: grid;
  gap: 7px;
  color: #3e4966;
  font-size: 12px;
  font-weight: 650;
}
.create-card input, .create-card select, .create-card textarea {
  width: 100%;
  border: 1px solid #d6dcea;
  border-radius: 9px;
  background: #fff;
  color: #29324d;
  font-size: 14px;
  font-weight: 500;
  outline: none;
}
.create-card input, .create-card select { height: 44px; padding: 0 14px; }
.create-card input:focus, .create-card select:focus, .create-card textarea:focus {
  border-color: #7357f3;
  box-shadow: 0 0 0 2px rgba(115,87,243,.08);
}
.create-card input:disabled { background: #f1f5f9; color: #94a3b8; }
.create-card textarea { height: 80px; padding: 12px 14px 28px; resize: vertical; }
.create-card input::placeholder, .create-card textarea::placeholder { color: #8b93aa; font-weight: 500; }
.textarea-wrap { position: relative; }
.textarea-wrap > span {
  position: absolute;
  right: 15px;
  bottom: 12px;
  color: #707991;
  font-size: 12px;
}
.form-panel {
  border: 1px solid #e1e5ee;
  border-radius: 10px;
  background: #fff;
}
.when-panel { padding: 18px 20px; }
.when-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px 16px;
  align-items: end;
}
.field-control { position: relative; }
.field-control > svg, .field-control > b {
  position: absolute;
  z-index: 1;
  left: 13px;
  top: 50%;
  width: 18px;
  height: 18px;
  transform: translateY(-50%);
  color: #65708b;
}
.field-control > b { width: auto; height: auto; font-size: 19px; font-weight: 500; }
.field-control input, .field-control select { padding-left: 40px; }
.interval-control {
  position: relative;
  display: grid;
  grid-template-columns: minmax(72px, .75fr) minmax(110px, 1.25fr);
}
.interval-control > svg {
  position: absolute;
  z-index: 2;
  left: 13px;
  top: 50%;
  width: 18px;
  height: 18px;
  transform: translateY(-50%);
  color: #65708b;
  pointer-events: none;
}
.interval-control input {
  padding-left: 40px;
  border-radius: 9px 0 0 9px;
}
.interval-control select {
  border-left: 0;
  border-radius: 0 9px 9px 0;
}
.interval-control input:focus, .interval-control select:focus {
  position: relative;
  z-index: 1;
}
.label-with-icon { display: inline-flex; align-items: center; gap: 8px; }
.label-with-icon svg { width: 17px; height: 17px; }
.next-run {
  grid-column: 1 / -1;
  min-height: 54px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  background: linear-gradient(135deg, #f1efff, #f9f7ff);
  color: #5744f4;
}
.next-run > svg { width: 20px; height: 20px; flex: 0 0 auto; }
.next-run > div { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.next-run strong { display: block; margin: 0; color: #202947; font-size: 12px; }
.next-run p, .next-run small { display: block; color: #6254e9; font-size: 12px; line-height: 1.35; }
.settings-grid, .bottom-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: 1fr;
  gap: 20px;
}
.advanced-panel, .limits-panel { height: 100%; min-height: 0; padding: 18px 20px; }
.advanced-grid {
  display: grid;
  grid-template-columns: 1fr 1.16fr;
  gap: 14px;
}
.system-prompt { grid-column: 1 / -1; }
.show-more {
  margin-top: 12px;
  color: #4657f5;
  gap: 7px;
  font-size: 13px;
  font-weight: 750;
}
.limit-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.limits-panel > p { margin-top: 12px; color: #707991; font-size: 11px; }
.safety-panel, .preview { height: 100%; min-height: 104px; padding: 16px 20px; }
.toggle-row { display: flex !important; align-items: center; gap: 14px !important; cursor: pointer; }
.toggle-row input { position: absolute; opacity: 0; pointer-events: none; }
.toggle {
  position: relative;
  width: 44px;
  height: 25px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: #c9cede;
  transition: background .2s ease;
}
.toggle::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 19px;
  height: 19px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 5px rgba(22,28,45,.2);
  transition: transform .2s ease;
}
.toggle-row input:checked + .toggle { background: linear-gradient(135deg, #7255f5, #5541ee); }
.toggle-row input:checked + .toggle::after { transform: translateX(19px); }
.toggle-row strong { display: block; color: #17203d; font-size: 13px; }
.toggle-row small { display: block; margin-top: 4px; color: #737d94; font-size: 12px; font-weight: 500; }
.preview-title { color: #17203d; }
.preview-title svg { color: #24bd7a; }
.preview > div { display: flex; align-items: center; gap: 12px; }
.preview em {
  border-radius: 9px;
  background: #f1efff;
  color: #5544ed;
  padding: 7px 10px;
  font-style: normal;
  font-size: 11px;
  font-weight: 800;
}
.preview code {
  border: 0;
  border-radius: 9px;
  background: #f1efff;
  padding: 8px 14px;
  color: #5544ed;
  font-size: 12px;
  font-weight: 800;
}
.preview p { color: #29324d; font-size: 12.5px; font-weight: 600; flex: 1; }
.preview button {
  height: 42px;
  border: 1px solid #d9ddea;
  border-radius: 9px;
  color: #29324d;
  padding: 0 16px;
  font-size: 12px;
  font-weight: 750;
}
.create-actions { padding: 0 24px 20px; }
.create-actions .ghost, .create-actions .primary {
  height: 44px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 750;
}
.create-actions .ghost { padding: 0 24px; color: #26314e; }
.create-actions .primary {
  min-width: 210px;
  padding: 0 26px;
  background: linear-gradient(135deg, #6946ef, #563df0);
  box-shadow: 0 12px 24px rgba(91,63,239,.2);
}
.schedule-table-card { overflow: hidden; }
.table-headline { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px 18px; border-bottom: 1px solid #e8eef7; }
.table-headline h2 span { margin-left: 8px; border-radius: 999px; background: #edf2f7; color: #64748b; padding: 2px 8px; font-size: 11px; }
.table-tools { display: flex; gap: 10px; align-items: center; }
.table-tools label {
  width: 170px; height: 34px; border: 1px solid #d7e1ee; border-radius: 999px; display: flex; align-items: center; gap: 8px; padding: 0 12px; background: #fff;
}
.table-tools label input { border: 0; height: auto; padding: 0; min-width: 0; }
.table-tools svg { color: #94a3b8; }
.table-tools select { width: 118px; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th { text-align: left; color: #64748b; font-size: 10.5px; font-weight: 850; padding: 10px 18px; border-bottom: 1px solid #e8eef7; }
td { color: #334155; font-size: 11.5px; font-weight: 750; padding: 10px 18px; border-bottom: 1px solid #eef3f8; vertical-align: middle; white-space: pre-line; }
td strong { display: block; color: #0f172a; font-size: 11.5px; margin-bottom: 4px; }
td small { display: block; color: #64748b; font-size: 10.5px; line-height: 1.25; }
.success { color: #16a34a; }
.failed { color: #dc2626; }
td b {
  display: inline-flex; align-items: center; border-radius: 999px; padding: 4px 9px; font-size: 9.5px; font-weight: 850;
}
.active { background: #dcfce7; color: #047857; }
.paused { background: #fef3c7; color: #b45309; }
.failed-chip { background: #fee2e2; color: #dc2626; }
.actions { display: flex; gap: 8px; }
.actions button {
  width: 28px; height: 28px; border-radius: 999px; border: 1px solid #d9e3f0; background: #fff; color: #52637a; display: grid; place-items: center;
}
.menu-wrap { position: relative; }
.row-menu {
  position: absolute; right: 0; top: 34px; z-index: 30; min-width: 150px; background: #fff; border: 1px solid #dfe7f2; border-radius: 9px; box-shadow: 0 12px 28px rgba(15,23,42,.14); padding: 6px; display: grid; gap: 2px;
}
.row-menu button {
  width: 100%; height: 32px; border: 0; border-radius: 6px; background: transparent; color: #334155; display: flex; align-items: center; gap: 8px; padding: 0 10px; font-size: 11.5px; font-weight: 750; justify-content: flex-start;
}
.row-menu button:hover { background: #f1f5fb; }
.row-menu button.danger { color: #dc2626; }
.row-menu svg { width: 15px; height: 15px; }
.menu-backdrop { position: fixed; inset: 0; z-index: 20; }
.empty-row {
  text-align: center; padding: 38px 18px; white-space: normal;
}
.empty-row svg { width: 30px; height: 30px; color: #94a3b8; }
.empty-row strong { display: block; color: #334155; font-size: 12.5px; margin-top: 8px; }
.empty-row small { display: block; color: #94a3b8; font-size: 11px; margin-top: 4px; }
.showing { padding: 12px 18px; }
.schedule-rail {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
  align-content: start;
  align-self: start;
  position: sticky;
  top: 24px;
  max-height: calc(100vh - 48px);
  overflow-y: auto;
  padding-right: 2px;
  scrollbar-width: thin;
}
.rail-card { padding: 16px; }
.how-card > p, .templates-card > p { margin: 8px 0 14px; }
.how-card article { display: flex; gap: 11px; align-items: flex-start; margin-top: 13px; }
.how-card article > span, .templates-card button > span:first-child {
  width: 34px; height: 34px; border-radius: 9px; display: grid; place-items: center; flex: 0 0 auto;
}
.blue { background: #eef4ff; color: #3156e9; }
.violet { background: #f1efff; color: #6d5dfc; }
.green { background: #e9fbf2; color: #059669; }
.amber { background: #fff7ed; color: #f59e0b; }
.how-card strong, .templates-card strong { display: block; font-size: 11.5px; font-weight: 850; margin-bottom: 5px; }
.templates-card button {
  width: 100%; min-height: 50px; border: 1px solid #dfe7f2; border-radius: 8px; background: #fff; display: grid; grid-template-columns: 34px 1fr 16px; gap: 10px; align-items: center; padding: 8px; text-align: left; margin-top: 8px;
}
.templates-card small { color: #64748b; font-size: 10.5px; font-weight: 700; }
.templates-card button > svg { color: #94a3b8; }
.tips-card ul { list-style: none; padding: 0; margin: 12px 0 15px; display: grid; gap: 9px; }
.tips-card li { display: flex; gap: 9px; align-items: flex-start; color: #52637a; font-size: 10.75px; line-height: 1.35; font-weight: 750; }
.tips-card li svg { color: #16a34a; flex: 0 0 auto; width: 14px; height: 14px; }
.tips-card button {
  border: 0; background: transparent; color: #3156e9; padding: 0; display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 850;
}
@media (max-width: 1200px) {
  .schedules-page { grid-template-columns: 1fr; }
  .schedule-rail {
    position: static;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    max-height: none;
    overflow: visible;
    padding-right: 0;
  }
}
@media (max-width: 900px) {
  .form-grid.top, .form-grid.middle, .safety-row { grid-template-columns: 1fr; }
  .form-section, .safety-row article { border-right: 0; border-bottom: 1px solid #e8eef7; }
  .schedule-basics { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
  .task-field { grid-column: 1 / -1; }
  .settings-grid, .bottom-grid { grid-template-columns: 1fr; }
}
@media (max-width: 760px) {
  .schedules-page { padding: 12px; }
  .page-head, .create-head, .table-headline, .table-tools { flex-direction: column; align-items: stretch; }
  .demo-btn, .template-btn, .table-tools label, .table-tools select { width: 100%; }
  .two-fields, .limit-grid { grid-template-columns: 1fr; }
  .create-head { padding: 16px; }
  .head-title { align-items: flex-start; }
  .head-title > span { width: 42px; height: 42px; }
  .head-title svg { width: 23px; height: 23px; }
  .create-head h2 { font-size: 18px; }
  .create-head p { font-size: 12px; }
  .template-menu { left: 0; right: auto; width: 100%; }
  .create-body { gap: 16px; padding: 16px; }
  .schedule-basics, .when-grid, .advanced-grid { grid-template-columns: 1fr; gap: 16px; padding-left: 0; padding-right: 0; }
  .task-field, .system-prompt { grid-column: auto; }
  .when-panel, .advanced-panel, .limits-panel, .safety-panel, .preview { padding: 16px; }
  .preview div { flex-wrap: wrap; }
  .preview p { flex-basis: 100%; }
  .create-actions { flex-direction: column; gap: 10px; padding: 0 16px 16px; }
  .create-actions .ghost, .create-actions .primary { width: 100%; min-width: 0; padding: 0 16px; }
  .schedule-rail { grid-template-columns: 1fr; }
  .schedule-table-card { overflow-x: auto; }
  table { min-width: 820px; }
}

/* ── Run history modal ─────────────────────────────────────────────────── */
.runs-modal-backdrop {
  position: fixed; inset: 0; z-index: 60;
  background: rgba(15, 23, 42, 0.45);
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.runs-modal {
  width: 100%; max-width: 620px; max-height: 80vh;
  display: flex; flex-direction: column;
  background: #fff; border-radius: 16px;
  box-shadow: 0 24px 60px rgba(16, 24, 40, 0.24); overflow: hidden;
}
.runs-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid #eef2f6;
}
.runs-head-txt h3 { margin: 0; font-size: 16px; font-weight: 700; color: #0f172a; }
.runs-head-txt p { margin: 2px 0 0; font-size: 13px; color: #64748b; }
.runs-close {
  display: grid; place-items: center; width: 32px; height: 32px;
  border: none; border-radius: 8px; background: #f1f5f9; color: #475569; cursor: pointer;
}
.runs-close:hover { background: #e2e8f0; }
.runs-body { padding: 12px 16px; overflow-y: auto; }
.runs-state {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 40px 20px; color: #64748b; font-size: 13px; text-align: center;
}
.runs-state svg { width: 22px; height: 22px; }
.runs-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.run-item { border: 1px solid #eef2f6; border-radius: 10px; padding: 10px 12px; background: #fbfdff; }
.run-top { display: flex; align-items: center; gap: 8px; }
.run-dot { width: 8px; height: 8px; border-radius: 999px; background: #cbd5e1; flex: none; }
.dot-completed { background: #10b981; }
.dot-running { background: #f59e0b; }
.dot-failed, .dot-dead { background: #ef4444; }
.run-status { font-size: 12.5px; font-weight: 650; color: #0f172a; text-transform: capitalize; }
.run-badge { font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 6px; background: #eef2ff; color: #4f46e5; }
.run-meta { margin-left: auto; display: flex; gap: 12px; font-size: 12px; color: #64748b; }
.run-error {
  margin: 6px 0 0; font-size: 12px; color: #b42318;
  background: #fef3f2; border-radius: 6px; padding: 6px 8px; white-space: pre-wrap;
}
.run-answer { margin: 6px 0 0; font-size: 12.5px; color: #334155; white-space: pre-wrap; overflow-wrap: anywhere; }
.spin { animation: runs-spin 0.9s linear infinite; }
@keyframes runs-spin { to { transform: rotate(360deg); } }
</style>
