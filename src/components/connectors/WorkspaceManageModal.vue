<template>
  <div class="fixed inset-0 z-50 flex justify-end bg-black/30" @click.self="$emit('close')">
    <div class="w-full max-w-2xl h-full bg-white shadow-2xl flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
        <div class="flex items-center gap-3 min-w-0">
          <span class="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-500 shrink-0">
            <svg class="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
          </span>
          <div class="min-w-0">
            <h2 class="text-[15px] font-bold text-ink truncate">{{ ws.name }}</h2>
            <span class="inline-flex items-center gap-1.5 text-[11px] font-semibold" :class="statusTextClass">
              <span class="w-1.5 h-1.5 rounded-full" :class="statusDotClass"></span>{{ statusLabel(ws.status) }}
            </span>
          </div>
        </div>
        <button @click="$emit('close')" class="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
        <!-- Connection -->
        <section>
          <h3 class="text-[13px] font-bold text-ink mb-2">Connect this sandbox</h3>
          <div class="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div class="text-[11px] font-semibold text-ink-faint uppercase tracking-wide mb-1">Run on the machine (Python)</div>
            <div class="flex items-center gap-2">
              <code class="flex-1 text-[11px] text-ink bg-white border border-slate-200 rounded-lg px-3 py-2 overflow-x-auto whitespace-nowrap">{{ pythonCommand }}</code>
              <button @click="copy(pythonCommand)" class="ws-icon-btn" title="Copy">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              </button>
            </div>
            <div class="text-[11px] font-semibold text-ink-faint uppercase tracking-wide mt-2 mb-1">Or Docker</div>
            <div class="flex items-center gap-2">
              <code class="flex-1 text-[11px] text-ink bg-white border border-slate-200 rounded-lg px-3 py-2 overflow-x-auto whitespace-nowrap">{{ dockerCommand }}</code>
              <button @click="copy(dockerCommand)" class="ws-icon-btn" title="Copy">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              </button>
            </div>
          </div>

          <div class="mt-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div class="flex items-center justify-between mb-1">
              <span class="text-[11px] font-semibold text-ink-faint uppercase tracking-wide">Auth token</span>
              <button @click="regenerate" :disabled="busy" class="text-[11px] font-semibold text-violet-700 hover:underline disabled:opacity-50">Regenerate</button>
            </div>
            <div class="flex items-center gap-2">
              <code class="flex-1 text-[12px] text-ink bg-white border border-slate-200 rounded-lg px-3 py-2 truncate">{{ showToken ? ws.token : maskedToken }}</code>
              <button @click="showToken = !showToken" class="ws-icon-btn" :title="showToken ? 'Hide' : 'Show'">
                <svg v-if="showToken" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <button @click="copy(ws.token)" class="ws-icon-btn" title="Copy"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button>
            </div>
          </div>
        </section>

        <!-- Tabs -->
        <section>
          <div class="flex gap-1 p-1 bg-slate-100 rounded-xl w-max mb-3">
            <button v-for="t in ['Agents', 'Activity', 'Bridges', 'Credentials']" :key="t" @click="tab = t"
              :class="['px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-colors', tab === t ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-slate-700']">
              {{ t }}
            </button>
          </div>

          <!-- Agents -->
          <div v-if="tab === 'Agents'">
            <div class="flex items-center gap-2 mb-3">
              <select v-model="assignId" class="flex-1 px-3 py-2 text-[13px] text-ink bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300">
                <option value="">Assign an agent…</option>
                <option v-for="a in assignableAgents" :key="a.id" :value="a.id">{{ a.name }}</option>
              </select>
              <button @click="assignAgent" :disabled="!assignId || busy" class="px-3.5 py-2 rounded-lg text-[13px] font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50">Assign</button>
            </div>
            <p v-if="!assignments.length" class="py-4 text-center text-[12px] text-ink-faint">No agents assigned to this sandbox.</p>
            <div v-for="as in assignments" :key="as.id" class="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-slate-200/70 mb-2">
              <span class="min-w-0 flex-1 text-[13px] font-semibold text-ink truncate">{{ as.agent_name }}</span>
              <label class="relative inline-flex items-center cursor-pointer shrink-0">
                <input type="checkbox" :checked="as.enabled" @change="toggleAssignment(as)" class="sr-only peer" />
                <div class="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-violet-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"></div>
              </label>
              <button @click="removeAssignment(as)" class="text-[11px] font-semibold text-red-600 hover:underline shrink-0">Remove</button>
            </div>
          </div>

          <!-- Activity -->
          <div v-else-if="tab === 'Activity'">
            <p v-if="!activity.length" class="py-4 text-center text-[12px] text-ink-faint">No recent activity.</p>
            <div v-for="(a, i) in activity" :key="i" class="flex items-start gap-2 px-3 py-2 text-[12px] border-b border-slate-100 last:border-0">
              <span class="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0"></span>
              <span class="min-w-0 flex-1 text-ink-soft truncate">{{ a.action || a.tool_name || a.event || 'activity' }}</span>
              <span class="text-ink-faint shrink-0">{{ a.created_at ? timeAgo(a.created_at) : '' }}</span>
            </div>
          </div>

          <!-- Bridges (shared services/MCP/agents on this workspace) -->
          <div v-else-if="tab === 'Bridges'">
            <p v-if="!bridges.length" class="py-4 text-center text-[12px] text-ink-faint">No shared resources bridged to this sandbox.</p>
            <div v-for="(b, i) in bridges" :key="i" class="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-slate-200/70 mb-2">
              <span class="min-w-0 flex-1 text-[13px] font-semibold text-ink truncate">{{ b.name || b.resource_name || b.kind || 'resource' }}</span>
              <span class="text-[11px] text-ink-faint shrink-0">{{ b.type || b.resource_type || b.visibility || '' }}</span>
            </div>
          </div>

          <!-- Credentials sync (push a credential to the sandbox agent) -->
          <div v-else>
            <p class="text-[11px] text-ink-faint mb-3">Push a credential to this sandbox so its agents can authenticate. Stored encrypted; injected at runtime.</p>
            <div class="space-y-2">
              <input v-model="cred.service_slug" placeholder="Service slug (e.g. jira)" class="ws-input" />
              <div class="flex gap-2">
                <select v-model="cred.auth_type" class="ws-input">
                  <option value="bearer">Bearer</option>
                  <option value="api_key">API key</option>
                  <option value="basic">Basic</option>
                </select>
                <input v-model="cred.header_name" placeholder="Header (Authorization)" class="ws-input" />
              </div>
              <input v-model="cred.value" type="password" placeholder="Secret value" class="ws-input" />
              <button @click="syncCredential" :disabled="!cred.service_slug || !cred.value || busy"
                class="w-full px-4 py-2 rounded-lg text-[13px] font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50">
                {{ busy ? 'Syncing…' : 'Sync credential' }}
              </button>
            </div>
          </div>
        </section>
      </div>

      <!-- Footer -->
      <div class="px-5 py-3 border-t border-slate-200 flex items-center justify-between shrink-0">
        <button @click="del" :disabled="busy" class="text-[12px] font-semibold text-red-600 hover:underline disabled:opacity-50">Delete sandbox</button>
        <button @click="$emit('close')" class="px-3.5 py-2 rounded-lg text-[13px] font-semibold text-ink-soft bg-slate-100 hover:bg-slate-200">Done</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import api from '../../services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'

const props = defineProps({ workspace: { type: Object, required: true } })
const emit = defineEmits(['close', 'changed'])

const ws = ref({ ...props.workspace })
const tab = ref('Agents')
const showToken = ref(false)
const busy = ref(false)
const assignments = ref([])
const availableAgents = ref([])
const activity = ref([])
const assignId = ref('')
const bridges = ref([])
const cred = ref({ service_slug: '', auth_type: 'bearer', header_name: 'Authorization', value: '' })

watch(tab, (t) => { if (t === 'Bridges') loadBridges() })

async function loadBridges() {
  try {
    const { data } = await api.get(`/workspaces/${ws.value.id}/bridges/`)
    bridges.value = data.bridges ?? data ?? []
  } catch {
    bridges.value = []
  }
}
async function syncCredential() {
  if (!cred.value.service_slug || !cred.value.value) return
  busy.value = true
  try {
    await api.post(`/workspaces/${ws.value.id}/credential-sync/`, cred.value)
    notify.success('Credential synced to sandbox')
    cred.value = { service_slug: '', auth_type: 'bearer', header_name: 'Authorization', value: '' }
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to sync credential')
  } finally {
    busy.value = false
  }
}

const maskedToken = computed(() => {
  const t = ws.value.token || ''
  return t ? t.slice(0, 8) + '••••••••' + t.slice(-4) : '— no token —'
})
const wsServerUrl = computed(() => {
  const loc = window.location
  return `${loc.protocol === 'https:' ? 'wss' : 'ws'}://${loc.host}`
})
const pythonCommand = computed(
  () => `python -m agent_runtime --server ${wsServerUrl.value} --token ${ws.value.token || '<TOKEN>'}`
)
const dockerCommand = computed(
  () => `docker run -d --restart unless-stopped -e SERVER=${wsServerUrl.value} -e TOKEN=${ws.value.token || '<TOKEN>'} -v /path/to/workspace:/workspace darrxscale/workspace-agent:latest`
)
const assignedIds = computed(() => new Set(assignments.value.map((a) => a.agent_profile_id ?? a.agent_id)))
const assignableAgents = computed(() => availableAgents.value.filter((a) => !assignedIds.value.has(a.id)))

const statusLabel = (s) => ({ connected: 'Connected', disconnected: 'Offline', pending: 'Pending' }[s] || s || 'Unknown')
const statusDotClass = computed(() => (ws.value.status === 'connected' ? 'bg-emerald-500' : 'bg-slate-300'))
const statusTextClass = computed(() => (ws.value.status === 'connected' ? 'text-emerald-600' : 'text-slate-400'))

function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text)
    notify.success('Copied to clipboard')
  } catch {
    notify.error('Failed to copy')
  }
}

async function loadDetail() {
  try {
    const { data } = await api.get(`/workspaces/${ws.value.id}/`)
    ws.value = { ...ws.value, ...data }
  } catch { /* keep summary */ }
}
async function loadAgents() {
  try {
    const [a, p] = await Promise.all([
      api.get(`/workspaces/${ws.value.id}/agents/`),
      api.getAgents(),
    ])
    assignments.value = a.data.assignments || []
    availableAgents.value = p.data?.results || p.data || []
  } catch { /* noop */ }
}
async function loadActivity() {
  try {
    const { data } = await api.get(`/workspaces/${ws.value.id}/activity/?limit=30`)
    activity.value = data.activity || []
  } catch { activity.value = [] }
}

async function regenerate() {
  if (!(await confirm('Regenerate token? The current agent will need to reconnect.'))) return
  busy.value = true
  try {
    const { data } = await api.post(`/workspaces/${ws.value.id}/regenerate-token/`)
    ws.value = { ...ws.value, token: data.token }
    showToken.value = true
    notify.success('Token regenerated')
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to regenerate token')
  } finally {
    busy.value = false
  }
}
async function assignAgent() {
  if (!assignId.value) return
  busy.value = true
  try {
    await api.post(`/workspaces/${ws.value.id}/agents/`, { agent_profile_id: assignId.value })
    assignId.value = ''
    await loadAgents()
    emit('changed')
    notify.success('Agent assigned')
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to assign agent')
  } finally {
    busy.value = false
  }
}
async function removeAssignment(as) {
  if (!(await confirm(`Remove agent "${as.agent_name}"?`))) return
  try {
    await api.delete(`/workspaces/${ws.value.id}/agents/`, { data: { assignment_id: as.id } })
    await loadAgents()
    emit('changed')
    notify.success('Agent removed')
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to remove agent')
  }
}
async function toggleAssignment(as) {
  try {
    await api.patch(`/workspaces/${ws.value.id}/agents/`, { assignment_id: as.id, enabled: !as.enabled })
    as.enabled = !as.enabled
    notify.success(as.enabled ? 'Routing enabled' : 'Routing disabled')
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to toggle routing')
  }
}
async function del() {
  if (!(await confirm({ title: 'Delete sandbox?', message: `Delete "${ws.value.name}"? This cannot be undone.`, confirmText: 'Delete', danger: true }))) return
  busy.value = true
  try {
    await api.delete(`/workspaces/${ws.value.id}/`)
    notify.success('Sandbox deleted')
    emit('changed')
    emit('close')
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to delete sandbox')
    busy.value = false
  }
}

onMounted(() => {
  loadDetail()
  loadAgents()
  loadActivity()
})
</script>

<style scoped>
.ws-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 9px;
  color: #64748b;
  background: #fff;
  border: 1px solid #e2e8f0;
  transition: all 0.12s;
}
.ws-icon-btn:hover {
  color: #1D4ED8;
  border-color: #ddd6fe;
  background: #f5f3ff;
}
.ws-input {
  width: 100%;
  padding: 8px 12px;
  font-size: 13px;
  color: #0f172a;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  outline: none;
}
.ws-input:focus {
  border-color: #BFDBFE;
  box-shadow: 0 0 0 2px #ddd6fe;
}
</style>
