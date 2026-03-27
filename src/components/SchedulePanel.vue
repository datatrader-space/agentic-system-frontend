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
          rows="4"
          placeholder="What should the agent do on each run?"
          class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
        ></textarea>
      </div>

      <!-- Friendly Schedule Builder -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Run Frequency</label>
        <div class="grid grid-cols-2 gap-3">
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

          <div v-if="freq === 'custom'" class="col-span-2">
            <input
              v-model="customCron"
              type="text"
              placeholder="* * * * *  (min hour dom month dow)"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
            />
          </div>
        </div>

        <div class="mt-2 flex items-center gap-2">
          <span class="text-xs text-gray-400">Schedule:</span>
          <code class="text-xs px-2 py-0.5 bg-white border border-gray-200 rounded text-indigo-600 font-mono">{{ computedCron }}</code>
          <span class="text-xs text-gray-500">→ {{ humanDescription }}</span>
        </div>
      </div>

      <!-- Advanced Settings (Collapsible) -->
      <div>
        <button
          @click="showAdvanced = !showAdvanced"
          class="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition"
        >
          <span class="text-xs">{{ showAdvanced ? '▼' : '▶' }}</span>
          Advanced Settings
        </button>
        <div v-if="showAdvanced" class="mt-3 space-y-3 pl-3 border-l-2 border-indigo-200">
          <!-- Profile Overrides -->
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">LLM Provider</label>
            <select
              v-model="schedProvId"
              class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
            >
              <option :value="null">All Providers</option>
              <option v-for="p in llmProviders" :key="p.id" :value="p.id">
                {{ p.name }} ({{ p.provider_type }})
              </option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Model Override</label>
            <select
              v-model="form.profile_overrides.model_id"
              class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
            >
              <option :value="null">Use agent default</option>
              <option v-for="m in filteredSchedModels" :key="m.id" :value="m.id">
                {{ m.name }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">System Prompt Override</label>
            <textarea
              v-model="form.profile_overrides.system_prompt"
              rows="2"
              placeholder="Override agent system prompt for this schedule"
              class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
            ></textarea>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Temperature</label>
              <input
                v-model.number="form.profile_overrides.temperature"
                type="number" min="0" max="2" step="0.1"
                placeholder="0.7"
                class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Budget ($/run)</label>
              <input
                v-model.number="form.profile_overrides.budget_usd"
                type="number" min="0" step="0.01"
                placeholder="1.00"
                class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Max Iterations</label>
              <input
                v-model.number="form.profile_overrides.max_iterations"
                type="number" min="1" max="50"
                placeholder="10"
                class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <!-- Guardrails -->
          <div class="pt-2 border-t border-gray-200">
            <label class="block text-xs font-semibold text-gray-600 mb-2">Guardrails</label>
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="block text-xs text-gray-500 mb-1">Max Total Runs</label>
                <input
                  v-model.number="form.max_runs"
                  type="number" min="1"
                  placeholder="∞"
                  class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">Daily Budget Cap ($)</label>
                <input
                  v-model="form.daily_budget_cap"
                  type="number" min="0" step="0.01"
                  placeholder="No limit"
                  class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">Pause After Failures</label>
                <input
                  v-model.number="form.auto_pause_on_failures"
                  type="number" min="0"
                  placeholder="3"
                  class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
            <div class="mt-2 flex items-center gap-4">
              <label class="flex items-center gap-2 text-sm">
                <input type="checkbox" v-model="form.read_only" class="rounded text-indigo-600" />
                <span class="text-gray-600">Read-only mode</span>
              </label>
              <div class="flex-1">
                <input
                  v-model="form.expires_at"
                  type="datetime-local"
                  placeholder="No expiry"
                  class="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
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
        class="bg-white border border-gray-200 rounded-lg transition hover:border-indigo-200 overflow-hidden"
      >
        <!-- Card Header -->
        <div class="p-4 cursor-pointer" @click="toggleExpanded(s.id)">
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1 flex-wrap">
                <span class="text-xs text-gray-400">{{ expandedSchedules.has(s.id) ? '▼' : '▶' }}</span>
                <span class="font-medium text-gray-900">{{ s.name }}</span>
                <span class="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded font-mono">{{ describeCron(s.schedule) }}</span>
                <span
                  :class="s.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
                  class="text-xs px-2 py-0.5 rounded font-medium"
                >
                  {{ s.active ? 'Active' : 'Paused' }}
                </span>
                <span v-if="s.consecutive_failures > 0" class="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded font-medium">
                  {{ s.consecutive_failures }} failures
                </span>
                <span v-if="s.total_cost_usd && s.total_cost_usd !== '0'" class="text-xs text-gray-400">
                  ${{ parseFloat(s.total_cost_usd).toFixed(4) }}
                </span>
              </div>
              <div class="flex items-center gap-4 text-xs text-gray-400">
                <span v-if="s.last_run">Last: {{ timeAgo(s.last_run) }}</span>
                <span v-if="s.next_run">Next: {{ timeAgo(s.next_run) }}</span>
                <span>{{ s.run_count }} runs</span>
                <span v-if="s.read_only" class="text-amber-500">🔒 read-only</span>
                <span v-if="s.max_runs" class="text-gray-400">max {{ s.max_runs }}</span>
              </div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0" @click.stop>
              <button
                @click="fireSchedule(s)"
                :disabled="firingId === s.id"
                class="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition font-medium disabled:opacity-50"
                title="Run now"
              >
                {{ firingId === s.id ? '...' : '▶ Run' }}
              </button>
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

        <!-- Expanded Detail -->
        <div v-if="expandedSchedules.has(s.id)" class="border-t border-gray-100 bg-gray-50">
          <!-- Detail Tabs -->
          <div class="flex border-b border-gray-200 px-4">
            <button
              v-for="tab in detailTabs"
              :key="tab.key"
              @click="activeDetailTab[s.id] = tab.key"
              class="px-3 py-2 text-xs font-medium border-b-2 transition"
              :class="(activeDetailTab[s.id] || 'overview') === tab.key
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'"
            >
              {{ tab.label }}
            </button>
          </div>

          <div class="p-4">
            <!-- Overview Tab -->
            <div v-if="(activeDetailTab[s.id] || 'overview') === 'overview'" class="space-y-3">
              <div>
                <label class="block text-xs font-semibold text-gray-500 mb-1">Prompt</label>
                <pre class="text-sm text-gray-800 bg-white border border-gray-200 rounded-lg p-3 whitespace-pre-wrap max-h-48 overflow-y-auto">{{ s.prompt }}</pre>
              </div>
              <div class="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <label class="text-xs text-gray-500">Run Count</label>
                  <p class="font-medium">{{ s.run_count }}</p>
                </div>
                <div>
                  <label class="text-xs text-gray-500">Total Cost</label>
                  <p class="font-medium">${{ parseFloat(s.total_cost_usd || 0).toFixed(4) }}</p>
                </div>
                <div>
                  <label class="text-xs text-gray-500">Last Run</label>
                  <p class="font-medium">{{ s.last_run ? formatDate(s.last_run) : 'Never' }}</p>
                </div>
                <div>
                  <label class="text-xs text-gray-500">Next Run</label>
                  <p class="font-medium">{{ s.next_run ? formatDate(s.next_run) : '—' }}</p>
                </div>
              </div>
              <div v-if="s.last_error" class="bg-red-50 border border-red-200 rounded-lg p-3">
                <label class="text-xs font-semibold text-red-600 mb-1 block">Last Error</label>
                <pre class="text-xs text-red-700 whitespace-pre-wrap">{{ s.last_error }}</pre>
              </div>
            </div>

            <!-- Profile & Tools Tab -->
            <div v-if="(activeDetailTab[s.id] || 'overview') === 'profile'" class="space-y-3">
              <div v-if="s.profile_overrides && Object.keys(s.profile_overrides).length > 0">
                <div class="grid grid-cols-2 gap-3 text-sm">
                  <div v-if="s.profile_overrides.model_id">
                    <label class="text-xs text-gray-500">Model</label>
                    <p class="font-mono text-xs bg-white px-2 py-1 border rounded">{{ s.profile_overrides.model_id }}</p>
                  </div>
                  <div v-if="s.profile_overrides.temperature != null">
                    <label class="text-xs text-gray-500">Temperature</label>
                    <p class="font-medium">{{ s.profile_overrides.temperature }}</p>
                  </div>
                  <div v-if="s.profile_overrides.budget_usd">
                    <label class="text-xs text-gray-500">Budget/Run</label>
                    <p class="font-medium">${{ s.profile_overrides.budget_usd }}</p>
                  </div>
                  <div v-if="s.profile_overrides.max_iterations">
                    <label class="text-xs text-gray-500">Max Iterations</label>
                    <p class="font-medium">{{ s.profile_overrides.max_iterations }}</p>
                  </div>
                </div>
                <div v-if="s.profile_overrides.system_prompt" class="mt-3">
                  <label class="text-xs text-gray-500">System Prompt Override</label>
                  <pre class="text-xs bg-white border rounded p-2 whitespace-pre-wrap max-h-32 overflow-y-auto mt-1">{{ s.profile_overrides.system_prompt }}</pre>
                </div>
                <div v-if="s.profile_overrides.tools?.length" class="mt-3">
                  <label class="text-xs text-gray-500">Tools Override</label>
                  <div class="flex gap-1 flex-wrap mt-1">
                    <span v-for="t in s.profile_overrides.tools" :key="t" class="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded">{{ t }}</span>
                  </div>
                </div>
              </div>
              <p v-else class="text-sm text-gray-400 italic">No profile overrides — uses agent defaults.</p>
            </div>

            <!-- Guardrails Tab -->
            <div v-if="(activeDetailTab[s.id] || 'overview') === 'guardrails'" class="space-y-3">
              <div class="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <label class="text-xs text-gray-500">Max Runs</label>
                  <p class="font-medium">{{ s.max_runs || '∞' }}</p>
                </div>
                <div>
                  <label class="text-xs text-gray-500">Daily Budget Cap</label>
                  <p class="font-medium">{{ s.daily_budget_cap ? '$' + s.daily_budget_cap : 'No limit' }}</p>
                </div>
                <div>
                  <label class="text-xs text-gray-500">Pause After Failures</label>
                  <p class="font-medium">{{ s.auto_pause_on_failures || '0 (never)' }}</p>
                </div>
                <div>
                  <label class="text-xs text-gray-500">Read-Only Mode</label>
                  <p class="font-medium">{{ s.read_only ? '🔒 Yes' : 'No' }}</p>
                </div>
                <div>
                  <label class="text-xs text-gray-500">Expires At</label>
                  <p class="font-medium">{{ s.expires_at ? formatDate(s.expires_at) : 'Never' }}</p>
                </div>
                <div>
                  <label class="text-xs text-gray-500">Consecutive Failures</label>
                  <p class="font-medium" :class="s.consecutive_failures > 0 ? 'text-red-600' : ''">{{ s.consecutive_failures }}</p>
                </div>
              </div>
            </div>

            <!-- Run History Tab -->
            <div v-if="(activeDetailTab[s.id] || 'overview') === 'runs'">
              <div v-if="loadingRuns[s.id]" class="text-center py-4 text-gray-400 text-sm">Loading runs...</div>
              <div v-else-if="!runHistory[s.id]?.runs?.length" class="text-center py-4 text-gray-400 text-sm">No runs yet.</div>
              <div v-else class="space-y-2">
                <!-- Flow summary -->
                <div v-if="runHistory[s.id]?.flow" class="text-xs text-gray-500 mb-2 flex gap-4">
                  <span>Flow: {{ runHistory[s.id].flow.status }}</span>
                  <span>{{ runHistory[s.id].flow.total_signals }} signals</span>
                  <span>Cost: ${{ runHistory[s.id].flow.total_cost_usd }}</span>
                </div>
                <!-- Runs list -->
                <div
                  v-for="run in runHistory[s.id].runs"
                  :key="run.signal_id"
                  class="bg-white border border-gray-200 rounded-lg p-3"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span
                        class="w-2 h-2 rounded-full"
                        :class="{
                          'bg-green-500': run.status === 'processed',
                          'bg-yellow-500': run.status === 'processing' || run.status === 'pending',
                          'bg-red-500': run.status === 'failed' || run.status === 'dead',
                        }"
                      ></span>
                      <span class="text-sm font-medium">Signal #{{ run.signal_id }}</span>
                      <span v-if="run.manual" class="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded">manual</span>
                      <span class="text-xs text-gray-400">{{ run.status }}</span>
                    </div>
                    <div class="flex items-center gap-3 text-xs text-gray-400">
                      <span v-if="run.cost_usd">${{ run.cost_usd }}</span>
                      <span>{{ timeAgo(run.created_at) }}</span>
                    </div>
                  </div>
                  <div v-if="run.result_summary" class="mt-2">
                    <pre class="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded p-2 whitespace-pre-wrap max-h-32 overflow-y-auto">{{ run.result_summary }}</pre>
                  </div>
                  <div v-if="run.error" class="mt-2">
                    <pre class="text-xs text-red-600 bg-red-50 border border-red-100 rounded p-2 whitespace-pre-wrap max-h-24 overflow-y-auto">{{ run.error }}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, watch } from 'vue'
import api from '../services/api'

const props = defineProps({
  agent: { type: Object, required: true }
})

const schedules = ref([])
const loading = ref(false)
const saving = ref(false)
const showForm = ref(false)
const showAdvanced = ref(false)
const editingId = ref(null)
const firingId = ref(null)
const expandedSchedules = ref(new Set())
const activeDetailTab = reactive({})
const runHistory = reactive({})
const loadingRuns = reactive({})
const llmProviders = ref([])
const llmModels = ref([])
const schedProvId = ref(null)

const detailTabs = [
  { key: 'overview', label: 'Overview' },
  { key: 'profile', label: 'Profile & Tools' },
  { key: 'guardrails', label: 'Guardrails' },
  { key: 'runs', label: 'Run History' },
]

const form = ref({
  name: '',
  prompt: '',
  profile_overrides: {},
  max_runs: null,
  daily_budget_cap: null,
  read_only: true,
  expires_at: '',
  auto_pause_on_failures: 3,
})

// Schedule builder state
const freq = ref('daily')
const hour = ref(8)
const minute = ref(0)
const weekday = ref(1)
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

const filteredSchedModels = computed(() => {
  if (schedProvId.value) {
    return llmModels.value.filter(m => m.provider === schedProvId.value)
  }
  return llmModels.value
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

  // Handle "every N hours" pattern
  if (h.startsWith('*/')) return `Every ${h.slice(2)}h`

  if (dow === '1-5') return `Weekdays ${time}`
  if (dow !== '*' && dayNames[dow]) return `${dayNames[dow]} ${time}`
  if (dow === '*' && h !== '*' && m !== '*') return `Daily ${time}`
  return cron
}

const resetForm = () => {
  form.value = {
    name: '',
    prompt: '',
    profile_overrides: {},
    max_runs: null,
    daily_budget_cap: null,
    read_only: true,
    expires_at: '',
    auto_pause_on_failures: 3,
  }
  freq.value = 'daily'
  hour.value = 8
  minute.value = 0
  weekday.value = 1
  customCron.value = ''
  showAdvanced.value = false
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
    const payload = {
      name: form.value.name,
      prompt: form.value.prompt,
      schedule: computedCron.value,
    }

    // Include advanced fields if set
    const po = form.value.profile_overrides || {}
    const cleanOverrides = {}
    if (po.model_id) cleanOverrides.model_id = po.model_id
    if (po.system_prompt) cleanOverrides.system_prompt = po.system_prompt
    if (po.temperature != null && po.temperature !== '') cleanOverrides.temperature = po.temperature
    if (po.budget_usd != null && po.budget_usd !== '') cleanOverrides.budget_usd = po.budget_usd
    if (po.max_iterations) cleanOverrides.max_iterations = po.max_iterations
    if (Object.keys(cleanOverrides).length) payload.profile_overrides = cleanOverrides

    if (form.value.max_runs) payload.max_runs = form.value.max_runs
    if (form.value.daily_budget_cap) payload.daily_budget_cap = form.value.daily_budget_cap
    payload.read_only = form.value.read_only
    if (form.value.expires_at) payload.expires_at = new Date(form.value.expires_at).toISOString()
    if (form.value.auto_pause_on_failures != null) payload.auto_pause_on_failures = form.value.auto_pause_on_failures

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
  form.value = {
    name: s.name,
    prompt: s.prompt,
    profile_overrides: { ...(s.profile_overrides || {}) },
    max_runs: s.max_runs,
    daily_budget_cap: s.daily_budget_cap,
    read_only: s.read_only,
    expires_at: s.expires_at ? s.expires_at.slice(0, 16) : '',
    auto_pause_on_failures: s.auto_pause_on_failures,
  }
  parseCronToBuilder(s.schedule)
  showAdvanced.value = !!(s.profile_overrides && Object.keys(s.profile_overrides).length) || !!s.max_runs || !!s.daily_budget_cap
  showForm.value = true
  // Set provider filter based on model override
  if (form.value.profile_overrides.model_id) {
    const model = llmModels.value.find(m => m.id === form.value.profile_overrides.model_id)
    schedProvId.value = model ? model.provider : null
  } else {
    schedProvId.value = null
  }
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

  // Handle "every N hours" like "0 */4 * * *"
  if (h.startsWith('*/')) { freq.value = 'custom'; customCron.value = cron; return }

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

const fireSchedule = async (s) => {
  if (!confirm(`Run "${s.name}" now?`)) return
  firingId.value = s.id
  try {
    const res = await api.post(`/agents/${props.agent.id}/schedules/${s.id}/fire/`)
    alert(`Dispatched! Signal #${res.data.signal_id}`)
    // Refresh runs if tab is open
    if ((activeDetailTab[s.id]) === 'runs') {
      loadRunHistory(s.id)
    }
  } catch (e) {
    alert('Failed to fire schedule: ' + (e.response?.data?.error || e.message))
  } finally {
    firingId.value = null
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

const toggleExpanded = (id) => {
  if (expandedSchedules.value.has(id)) {
    expandedSchedules.value.delete(id)
  } else {
    expandedSchedules.value.add(id)
    if (!activeDetailTab[id]) activeDetailTab[id] = 'overview'
  }
  expandedSchedules.value = new Set(expandedSchedules.value)
}

const loadRunHistory = async (scheduleId) => {
  loadingRuns[scheduleId] = true
  try {
    const res = await api.get(`/agents/${props.agent.id}/schedules/${scheduleId}/runs/`)
    runHistory[scheduleId] = res.data
  } catch (e) {
    console.error('Failed to load run history:', e)
    runHistory[scheduleId] = { runs: [], flow: null }
  } finally {
    loadingRuns[scheduleId] = false
  }
}

// Auto-load runs when runs tab is selected
watch(activeDetailTab, (tabs) => {
  for (const [scheduleId, tab] of Object.entries(tabs)) {
    if (tab === 'runs' && !runHistory[scheduleId]) {
      loadRunHistory(parseInt(scheduleId))
    }
  }
}, { deep: true })

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

const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

watch(() => props.agent?.id, loadSchedules)
onMounted(() => {
  loadSchedules()
  api.getLlmProviders().then(res => {
    llmProviders.value = res.data.results || res.data
  }).catch(() => {})
  api.getLlmModels().then(res => {
    llmModels.value = res.data.results || res.data
  }).catch(() => {})
})
</script>
