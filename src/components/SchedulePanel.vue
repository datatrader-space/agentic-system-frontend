<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <div>
        <h3 class="text-lg font-semibold text-gray-900">Scheduled Runs</h3>
        <p class="text-xs text-gray-500 mt-1">Run this agent automatically on a recurring schedule.</p>
      </div>
      <button
        @click="showForm = !showForm; editingId = null; resetForm()"
        class="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition font-medium flex items-center gap-1"
      >
        <span v-if="showForm">Cancel</span>
        <span v-else>+ Add Schedule</span>
      </button>
    </div>

    <!-- Add/Edit Form -->
    <div v-if="showForm" class="bg-indigo-50 border border-indigo-200 rounded-lg p-5 space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          v-model="form.name"
          type="text"
          placeholder="Daily report, Hourly sync..."
          class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Prompt</label>
        <textarea
          v-model="form.prompt"
          rows="3"
          placeholder="What should the agent do on each run?"
          class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
        ></textarea>
      </div>

      <!-- Friendly Schedule Builder -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Run Frequency</label>
        <div class="grid grid-cols-2 gap-3">
          <!-- Frequency -->
          <div>
            <select
              v-model="freq"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
            >
              <option value="every_minute">Every Minute</option>
              <option value="every_5">Every 5 Minutes</option>
              <option value="every_15">Every 15 Minutes</option>
              <option value="every_30">Every 30 Minutes</option>
              <option value="hourly">Every Hour</option>
              <option value="daily">Daily</option>
              <option value="weekdays">Weekdays Only</option>
              <option value="weekly">Weekly</option>
              <option value="custom">Custom (cron)</option>
            </select>
          </div>

          <!-- Time picker (shown for daily/weekdays/weekly) -->
          <div v-if="showTimePicker">
            <div class="flex gap-2">
              <select v-model="hour" class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white">
                <option v-for="h in 24" :key="h-1" :value="h-1">{{ String(h-1).padStart(2,'0') }}:00</option>
              </select>
              <select v-model="minute" class="w-20 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white">
                <option :value="0">:00</option>
                <option :value="15">:15</option>
                <option :value="30">:30</option>
                <option :value="45">:45</option>
              </select>
            </div>
          </div>

          <!-- Day picker (shown for weekly) -->
          <div v-if="freq === 'weekly'" class="col-span-2">
            <label class="block text-xs text-gray-500 mb-1">Day of Week</label>
            <div class="flex gap-1">
              <button
                v-for="(day, idx) in ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']"
                :key="day"
                @click="weekday = idx + 1"
                :class="[
                  'px-3 py-1.5 text-xs rounded-lg border transition font-medium',
                  weekday === idx + 1
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                ]"
              >
                {{ day }}
              </button>
            </div>
          </div>

          <!-- Custom cron input -->
          <div v-if="freq === 'custom'" class="col-span-2">
            <input
              v-model="customCron"
              type="text"
              placeholder="* * * * *  (min hour dom month dow)"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
            />
          </div>
        </div>

        <!-- Preview -->
        <div class="mt-2 flex items-center gap-2">
          <span class="text-xs text-gray-400">Schedule:</span>
          <code class="text-xs px-2 py-0.5 bg-white border border-gray-200 rounded text-indigo-600 font-mono">{{ computedCron }}</code>
          <span class="text-xs text-gray-500">→ {{ humanDescription }}</span>
        </div>
      </div>

      <button
        @click="saveSchedule"
        :disabled="saving || !form.name || !form.prompt || !computedCron"
        class="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 font-medium"
      >
        {{ saving ? 'Saving...' : (editingId ? 'Update Schedule' : 'Create Schedule') }}
      </button>
    </div>

    <!-- Schedule List -->
    <div v-if="loading" class="text-center py-8 text-gray-500 text-sm">Loading schedules...</div>
    <div v-else-if="schedules.length === 0 && !showForm" class="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
      <div class="text-4xl mb-3">⏰</div>
      <p class="text-gray-600 font-medium mb-1">No scheduled runs</p>
      <p class="text-xs text-gray-500">Create a schedule to run this agent automatically.</p>
    </div>
    <div v-else class="space-y-3">
      <div
        v-for="s in schedules"
        :key="s.id"
        class="bg-white border border-gray-200 rounded-lg p-4 transition hover:border-indigo-200"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="font-medium text-gray-900">{{ s.name }}</span>
              <span class="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded font-mono">{{ describeCron(s.schedule) }}</span>
              <span
                :class="s.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
                class="text-xs px-2 py-0.5 rounded font-medium"
              >
                {{ s.active ? 'Active' : 'Paused' }}
              </span>
            </div>
            <p class="text-xs text-gray-500 line-clamp-2 mb-2">{{ s.prompt }}</p>
            <div class="flex items-center gap-4 text-xs text-gray-400">
              <span v-if="s.last_run">Last: {{ timeAgo(s.last_run) }}</span>
              <span v-if="s.next_run">Next: {{ timeAgo(s.next_run) }}</span>
              <span>{{ s.run_count }} runs</span>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <button
              @click="toggleActive(s)"
              :class="s.active ? 'text-amber-600 hover:text-amber-700' : 'text-green-600 hover:text-green-700'"
              class="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50 transition font-medium"
            >
              {{ s.active ? 'Pause' : 'Resume' }}
            </button>
            <button
              @click="editSchedule(s)"
              class="text-xs px-2 py-1 text-gray-600 border border-gray-200 rounded hover:bg-gray-50 transition"
            >
              Edit
            </button>
            <button
              @click="deleteSchedule(s)"
              class="text-xs px-2 py-1 text-red-500 border border-red-200 rounded hover:bg-red-50 transition"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import api from '../services/api'

const props = defineProps({
  agent: { type: Object, required: true }
})

const schedules = ref([])
const loading = ref(false)
const saving = ref(false)
const showForm = ref(false)
const editingId = ref(null)
const form = ref({ name: '', prompt: '' })

// Schedule builder state
const freq = ref('daily')
const hour = ref(8)
const minute = ref(0)
const weekday = ref(1) // 1=Mon
const customCron = ref('')

const showTimePicker = computed(() =>
  ['daily', 'weekdays', 'weekly'].includes(freq.value)
)

const computedCron = computed(() => {
  const m = minute.value
  const h = hour.value
  switch (freq.value) {
    case 'every_minute': return '* * * * *'
    case 'every_5':      return '*/5 * * * *'
    case 'every_15':     return '*/15 * * * *'
    case 'every_30':     return '*/30 * * * *'
    case 'hourly':       return '0 * * * *'
    case 'daily':        return `${m} ${h} * * *`
    case 'weekdays':     return `${m} ${h} * * 1-5`
    case 'weekly':       return `${m} ${h} * * ${weekday.value}`
    case 'custom':       return customCron.value
    default:             return '0 8 * * *'
  }
})

const humanDescription = computed(() => {
  const pad = n => String(n).padStart(2, '0')
  const t = `${pad(hour.value)}:${pad(minute.value)}`
  const dayNames = ['','Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  switch (freq.value) {
    case 'every_minute': return 'Runs every minute'
    case 'every_5':      return 'Runs every 5 minutes'
    case 'every_15':     return 'Runs every 15 minutes'
    case 'every_30':     return 'Runs every 30 minutes'
    case 'hourly':       return 'Runs at the start of every hour'
    case 'daily':        return `Runs daily at ${t}`
    case 'weekdays':     return `Runs Mon–Fri at ${t}`
    case 'weekly':       return `Runs every ${dayNames[weekday.value]} at ${t}`
    case 'custom':       return customCron.value || 'Enter cron expression'
    default:             return ''
  }
})

const describeCron = (cron) => {
  if (!cron) return ''
  // Common patterns → human readable
  const map = {
    '* * * * *': 'Every minute',
    '*/5 * * * *': 'Every 5 min',
    '*/15 * * * *': 'Every 15 min',
    '*/30 * * * *': 'Every 30 min',
    '0 * * * *': 'Hourly',
  }
  if (map[cron]) return map[cron]

  const parts = cron.split(' ')
  if (parts.length !== 5) return cron

  const [m, h, , , dow] = parts
  const time = `${h.padStart(2,'0')}:${m.padStart(2,'0')}`
  const dayNames = {'1':'Mon','2':'Tue','3':'Wed','4':'Thu','5':'Fri','6':'Sat','0':'Sun','7':'Sun'}

  if (dow === '1-5') return `Weekdays ${time}`
  if (dow !== '*' && dayNames[dow]) return `${dayNames[dow]} ${time}`
  if (dow === '*' && h !== '*' && m !== '*') return `Daily ${time}`
  return cron
}

const resetForm = () => {
  form.value = { name: '', prompt: '' }
  freq.value = 'daily'
  hour.value = 8
  minute.value = 0
  weekday.value = 1
  customCron.value = ''
}

const loadSchedules = async () => {
  if (!props.agent?.id) return
  loading.value = true
  try {
    const res = await api.get(`/agents/${props.agent.id}/schedules/`)
    schedules.value = res.data
  } catch (e) {
    console.error('Failed to load schedules:', e)
  } finally {
    loading.value = false
  }
}

const saveSchedule = async () => {
  saving.value = true
  try {
    const payload = { ...form.value, schedule: computedCron.value }
    if (editingId.value) {
      await api.put(`/agents/${props.agent.id}/schedules/${editingId.value}/`, payload)
    } else {
      await api.post(`/agents/${props.agent.id}/schedules/`, payload)
    }
    resetForm()
    showForm.value = false
    editingId.value = null
    await loadSchedules()
  } catch (e) {
    alert(e.response?.data?.error || 'Failed to save schedule')
  } finally {
    saving.value = false
  }
}

const editSchedule = (s) => {
  editingId.value = s.id
  form.value = { name: s.name, prompt: s.prompt }
  // Try to parse cron back into builder state
  parseCronToBuilder(s.schedule)
  showForm.value = true
}

const parseCronToBuilder = (cron) => {
  const presets = {
    '* * * * *': 'every_minute',
    '*/5 * * * *': 'every_5',
    '*/15 * * * *': 'every_15',
    '*/30 * * * *': 'every_30',
    '0 * * * *': 'hourly',
  }
  if (presets[cron]) { freq.value = presets[cron]; return }

  const parts = cron.split(' ')
  if (parts.length !== 5) { freq.value = 'custom'; customCron.value = cron; return }

  const [m, h, , , dow] = parts
  minute.value = parseInt(m) || 0
  hour.value = parseInt(h) || 0

  if (dow === '1-5') { freq.value = 'weekdays' }
  else if (dow === '*') { freq.value = 'daily' }
  else { freq.value = 'weekly'; weekday.value = parseInt(dow) || 1 }
}

const toggleActive = async (s) => {
  try {
    await api.patch(`/agents/${props.agent.id}/schedules/${s.id}/`, { active: !s.active })
    s.active = !s.active
  } catch (e) {
    alert('Failed to toggle schedule')
  }
}

const deleteSchedule = async (s) => {
  if (!confirm(`Delete schedule "${s.name}"?`)) return
  try {
    await api.delete(`/agents/${props.agent.id}/schedules/${s.id}/`)
    await loadSchedules()
  } catch (e) {
    alert('Failed to delete schedule')
  }
}

const timeAgo = (dateStr) => {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const future = diff < 0
  const abs = Math.abs(diff)
  const mins = Math.floor(abs / 60000)
  if (mins < 1) return future ? 'soon' : 'just now'
  if (mins < 60) return `${mins}m ${future ? 'from now' : 'ago'}`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ${future ? 'from now' : 'ago'}`
  const days = Math.floor(hours / 24)
  return `${days}d ${future ? 'from now' : 'ago'}`
}

watch(() => props.agent?.id, loadSchedules)
onMounted(loadSchedules)
</script>
