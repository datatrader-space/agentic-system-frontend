<template>
  <main class="schedules-page">
    <section class="schedules-main">
      <header class="page-head">
        <div>
          <h1>Automation & Schedules</h1>
          <p>Create recurring runs for your agent to automate tasks, reports, and workflows.</p>
        </div>
        <button class="demo-btn"><Icon icon="lucide:play" /> Watch demo</button>
      </header>

      <section class="create-card">
        <header class="create-head">
          <div class="head-title">
            <span><Icon icon="lucide:calendar-clock" /></span>
            <div>
              <h2>{{ form.id ? 'Edit Scheduled Run' : 'Create a Scheduled Run' }}</h2>
              <p>Define what your agent should do, when, and how often.</p>
            </div>
          </div>
          <button class="template-btn"><Icon icon="lucide:calendar-days" /> Use template <Icon icon="lucide:chevron-down" /></button>
        </header>

        <section class="form-grid top">
          <article class="form-section basic">
            <h3><span>1</span> Basic Info</h3>
            <label>
              <span>Agent</span>
              <select v-model="form.agent_id">
                <option value="" disabled>Select an agent…</option>
                <option v-for="a in agents" :key="a.id" :value="a.id">{{ a.name }}</option>
              </select>
            </label>
            <label>
              <span>Schedule name</span>
              <input v-model="form.name" placeholder="Daily report, Hourly sync..." />
            </label>
            <label>
              <span>What should the agent do?</span>
              <textarea v-model="form.prompt" placeholder="Describe the goal or task for each run..." />
            </label>
          </article>

          <article class="form-section">
            <h3><span>2</span> Run Frequency</h3>
            <label>
              <span>Frequency</span>
              <select v-model="form.frequency">
                <option>Daily</option>
                <option>Hourly</option>
                <option>Weekly</option>
              </select>
            </label>
            <p>Choose how often this schedule should run.</p>
          </article>

          <article class="form-section">
            <h3><span>3</span> Timing</h3>
            <label>
              <span>Time of day</span>
              <input v-model="form.time" type="time" :disabled="form.frequency === 'Hourly'" value="08:00" />
            </label>
            <label>
              <span>Timezone</span>
              <select v-model="form.timezone">
                <option>(UTC +05:00) Asia/Karachi</option>
                <option>(UTC -05:00) US/Eastern</option>
              </select>
            </label>
          </article>
        </section>

        <section class="form-grid middle">
          <article class="form-section advanced">
            <h3><span>4</span> Advanced Settings</h3>
            <div class="two-fields">
              <label>
                <span>LLM Provider</span>
                <select><option>All Providers</option></select>
              </label>
              <label>
                <span>Model Override (optional)</span>
                <input v-model="form.model" placeholder="Select model" />
              </label>
            </div>
            <label>
              <span>System Prompt Override (optional)</span>
              <input v-model="form.system_prompt" placeholder="Override agent system prompt for this schedule..." />
            </label>
            <button class="show-more">Show more options <Icon icon="lucide:chevron-down" /></button>
          </article>

          <article class="form-section limits">
            <h3><span>5</span> Limits & Controls</h3>
            <div class="limit-grid">
              <label>
                <span>Budget per run ($)</span>
                <input v-model="form.budget_per_run" placeholder="1.00" />
              </label>
              <label>
                <span>Max iterations</span>
                <input v-model="form.max_iterations" placeholder="10" />
              </label>
              <label>
                <span>Daily budget cap ($)</span>
                <input v-model="form.daily_budget_cap" placeholder="No limit" />
              </label>
              <label>
                <span>Max total runs</span>
                <input v-model="form.max_runs" placeholder="∞" />
              </label>
              <label>
                <span>Pause after failures</span>
                <input v-model="form.auto_pause_on_failures" placeholder="3" />
              </label>
            </div>
            <p>Set limits to control spend and ensure reliability.</p>
          </article>
        </section>

        <section class="safety-row">
          <article>
            <h3><span>6</span> Safety</h3>
            <label class="checkbox-row">
              <input type="checkbox" v-model="form.read_only" />
              <span><strong>Read-only mode</strong><small>Allow the agent to read data but prevent any changes.</small></span>
            </label>
          </article>
          <article class="preview">
            <span>Schedule preview</span>
            <div>
              <em>CRON</em>
              <code>{{ cronPreview }}</code>
              <p>{{ cronDescription }}</p>
              <button @click="copyCron"><Icon icon="lucide:copy" /> {{ copied ? 'Copied' : 'Copy' }}</button>
            </div>
          </article>
        </section>

        <footer class="create-actions">
          <button class="ghost" v-if="form.id" @click="resetForm">Cancel edit</button>
          <button class="ghost" v-else>Save as draft</button>
          <button class="primary" :disabled="saving" @click="submitSchedule">
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
const rawSchedules = ref([])
const loading = ref(true)
const saving = ref(false)
const copied = ref(false)
const search = ref('')
const statusFilter = ref('')
const openMenuId = ref(null)

const form = reactive({
  id: null,               // 'as_<n>' when editing
  agent_id: '',
  name: '',
  prompt: '',
  frequency: 'Daily',
  time: '08:00',
  dow: 1,                 // day of week for Weekly (0=Sun … 6=Sat); no visible picker yet
  timezone: '(UTC +05:00) Asia/Karachi',
  model: '',
  system_prompt: '',
  budget_per_run: '',
  max_iterations: '',
  daily_budget_cap: '',
  max_runs: '',
  auto_pause_on_failures: '3',
  read_only: true,
})

// ---- cron helpers ---------------------------------------------------------
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const pad = (n) => String(n).padStart(2, '0')

function buildCron() {
  const [h, m] = (form.time || '08:00').split(':')
  const hh = parseInt(h || '0', 10)
  const mm = parseInt(m || '0', 10)
  if (form.frequency === 'Hourly') return `${mm} * * * *`
  if (form.frequency === 'Weekly') return `${mm} ${hh} * * ${form.dow ?? 1}`
  return `${mm} ${hh} * * *`
}

function describeCron(cron) {
  if (!cron) return '—'
  const p = cron.trim().split(/\s+/)
  if (p.length < 5) return cron
  const [min, hr, , , dow] = p
  if (hr === '*') return 'Every hour'
  const t = `${pad(parseInt(hr, 10))}:${pad(parseInt(min, 10))}`
  if (dow && dow !== '*') {
    const idx = parseInt(dow, 10)
    return `Weekly on ${DOW[idx] || 'Mon'} ${t}`
  }
  return `Daily at ${t}`
}

const cronPreview = computed(() => buildCron())
const cronDescription = computed(() => {
  const tz = form.timezone.match(/[A-Za-z_]+\/[A-Za-z_]+/)?.[0] || 'server time'
  return `${describeCron(cronPreview.value)} (${tz})`
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

function buildPayload() {
  const overrides = {}
  if (form.model && form.model !== 'Select model') overrides.model = form.model
  if (form.system_prompt) overrides.system_prompt = form.system_prompt
  const bpr = numOrNull(form.budget_per_run)
  if (bpr != null) overrides.budget_per_run = bpr
  const mi = numOrNull(form.max_iterations)
  if (mi != null) overrides.max_iterations = Math.round(mi)

  const maxRuns = (form.max_runs === '' || form.max_runs === '∞') ? null : numOrNull(form.max_runs)
  const dailyCap = (String(form.daily_budget_cap).toLowerCase().includes('limit')) ? null : numOrNull(form.daily_budget_cap)

  return {
    name: form.name.trim(),
    prompt: form.prompt.trim(),
    schedule: buildCron(),
    profile_overrides: overrides,
    daily_budget_cap: dailyCap,
    max_runs: maxRuns != null ? Math.round(maxRuns) : null,
    auto_pause_on_failures: Math.round(numOrNull(form.auto_pause_on_failures) ?? 3),
    read_only: !!form.read_only,
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

async function submitSchedule() {
  if (!form.agent_id) return notify.error('Please select an agent')
  if (!form.name.trim()) return notify.error('Schedule name is required')
  if (!form.prompt.trim()) return notify.error('Describe what the agent should do')

  saving.value = true
  try {
    const payload = buildPayload()
    if (form.id) {
      await api.updateSchedule(form.id, payload)
      notify.success('Schedule updated')
    } else {
      await api.createAgentSchedule(form.agent_id, payload)
      notify.success('Schedule created')
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
    if (p[1] === '*') { form.frequency = 'Hourly'; form.time = '08:00' }
    else {
      form.time = `${pad(parseInt(p[1], 10))}:${pad(parseInt(p[0], 10))}`
      if (p[4] && p[4] !== '*') { form.frequency = 'Weekly'; form.dow = parseInt(p[4], 10) }
      else form.frequency = 'Daily'
    }
  }
  form.model = ov.model || ''
  form.system_prompt = ov.system_prompt || ''
  form.budget_per_run = ov.budget_per_run != null ? String(ov.budget_per_run) : ''
  form.max_iterations = ov.max_iterations != null ? String(ov.max_iterations) : ''
  form.daily_budget_cap = s.daily_budget_cap != null ? String(s.daily_budget_cap) : ''
  form.max_runs = s.max_runs != null ? String(s.max_runs) : ''
  form.auto_pause_on_failures = s.auto_pause_on_failures != null ? String(s.auto_pause_on_failures) : '3'
  form.read_only = !!s.read_only
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
  form.dow = 1
  form.model = ''
  form.system_prompt = ''
  form.budget_per_run = ''
  form.max_iterations = ''
  form.daily_budget_cap = ''
  form.max_runs = ''
  form.auto_pause_on_failures = '3'
  form.read_only = true
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
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 18px;
  min-height: 100%;
  padding: 28px;
  background: #f8fbff;
  color: #0f172a;
}
.schedules-main { max-width: 1220px; width: 100%; justify-self: center; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 18px; }
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
.schedule-rail { display: grid; gap: 14px; align-content: start; margin-top: 56px; }
.rail-card { padding: 18px; }
.how-card > p, .templates-card > p { margin: 10px 0 18px; }
.how-card article { display: flex; gap: 14px; align-items: flex-start; margin-top: 18px; }
.how-card article > span, .templates-card button > span:first-child {
  width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center; flex: 0 0 auto;
}
.blue { background: #eef4ff; color: #3156e9; }
.violet { background: #f1efff; color: #6d5dfc; }
.green { background: #e9fbf2; color: #059669; }
.amber { background: #fff7ed; color: #f59e0b; }
.how-card strong, .templates-card strong { display: block; font-size: 11.5px; font-weight: 850; margin-bottom: 5px; }
.templates-card button {
  width: 100%; min-height: 56px; border: 1px solid #dfe7f2; border-radius: 8px; background: #fff; display: grid; grid-template-columns: 38px 1fr 16px; gap: 12px; align-items: center; padding: 10px; text-align: left; margin-top: 10px;
}
.templates-card small { color: #64748b; font-size: 10.5px; font-weight: 700; }
.templates-card button > svg { color: #94a3b8; }
.tips-card ul { list-style: none; padding: 0; margin: 14px 0 18px; display: grid; gap: 12px; }
.tips-card li { display: flex; gap: 9px; align-items: flex-start; color: #52637a; font-size: 10.75px; line-height: 1.35; font-weight: 750; }
.tips-card li svg { color: #16a34a; flex: 0 0 auto; width: 14px; height: 14px; }
.tips-card button {
  border: 0; background: transparent; color: #3156e9; padding: 0; display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 850;
}
@media (max-width: 1320px) {
  .schedules-page { grid-template-columns: 1fr; }
  .schedule-rail { grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 0; }
}
@media (max-width: 1050px) {
  .form-grid.top, .form-grid.middle, .safety-row { grid-template-columns: 1fr; }
  .form-section, .safety-row article { border-right: 0; border-bottom: 1px solid #e8eef7; }
  .schedule-rail { grid-template-columns: 1fr; }
}
@media (max-width: 760px) {
  .schedules-page { padding: 18px; }
  .page-head, .create-head, .table-headline, .table-tools { flex-direction: column; align-items: stretch; }
  .demo-btn, .template-btn, .table-tools label, .table-tools select { width: 100%; }
  .two-fields, .limit-grid { grid-template-columns: 1fr; }
  .preview div { flex-wrap: wrap; }
  .schedule-table-card { overflow-x: auto; }
  table { min-width: 820px; }
}
</style>
