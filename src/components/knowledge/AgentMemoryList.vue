<template>
  <div class="space-y-4">
    <!-- Autopilot activity strip -->
    <div v-if="activity.length" class="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-semibold text-gray-600">Autopilot activity</span>
        <button @click="loadAll" class="text-xs text-indigo-600 hover:underline">Refresh</button>
      </div>
      <div class="flex gap-2 flex-wrap">
        <span v-for="r in activity" :key="r.id"
              class="text-[11px] px-2 py-0.5 rounded-full border"
              :class="runClass(r)"
              :title="`${r.status}${r.skip_reason ? ' · ' + r.skip_reason : ''} · ${fmt(r.created_at)}`">
          {{ r.status === 'done' ? `saved ${r.actions_count}` : (r.skip_reason || r.status) }}
        </span>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex gap-2 flex-wrap items-center">
      <select v-model="scope" @change="loadMemory"
              class="text-sm border border-gray-300 rounded-lg px-2 py-1.5">
        <option value="">All scopes</option>
        <option value="user">User (across chats)</option>
        <option value="project">Project (repo)</option>
        <option value="agent">Agent</option>
        <option value="conversation">Conversation</option>
      </select>
      <select v-model="status" @change="loadMemory"
              class="text-sm border border-gray-300 rounded-lg px-2 py-1.5">
        <option value="">Live (active + candidate)</option>
        <option value="active">Active</option>
        <option value="candidate">Candidate</option>
        <option value="superseded">Superseded</option>
      </select>
      <input v-model="q" @keyup.enter="loadMemory" type="text" placeholder="Search memory…"
             class="flex-1 min-w-[180px] text-sm border border-gray-300 rounded-lg px-3 py-1.5" />
      <button @click="loadMemory" class="text-sm px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
        Search
      </button>
    </div>

    <!-- List -->
    <div v-if="loading" class="text-center py-10 text-gray-400 text-sm">Loading memory…</div>
    <div v-else-if="!memories.length" class="text-center py-10 text-gray-400">
      <p class="text-sm">No memories yet</p>
      <p class="text-xs mt-1">The agent saves these automatically from chat, or when you say “remember …”.</p>
    </div>
    <ul v-else class="space-y-2">
      <li v-for="m in memories" :key="m.id"
          class="rounded-lg border border-gray-200 p-3 flex items-start justify-between gap-3 hover:border-gray-300">
        <div class="min-w-0">
          <p class="text-sm text-gray-800 break-words">{{ m.content }}</p>
          <div class="flex gap-1.5 flex-wrap mt-1.5">
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">{{ m.scope }}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{{ m.kind }}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded" :class="statusClass(m.status)">{{ m.status }}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700">{{ byLabel(m.created_by) }}</span>
          </div>
        </div>
        <button @click="forget(m)" :disabled="busy"
                class="text-xs text-red-500 hover:text-red-700 shrink-0" title="Forget this memory">
          Delete
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import api from '../../services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'

const props = defineProps({ agentProfile: { type: Object, required: true } })

const memories = ref([])
const activity = ref([])
const loading = ref(false)
const busy = ref(false)
const scope = ref('')
const status = ref('')
const q = ref('')

const byLabel = (b) => ({ autopilot: 'auto', assistant_tool: 'assistant', user: 'you',
                          system: 'system', developer: 'dev', dreaming: 'dreamed' }[b] || b || '—')
const statusClass = (s) => ({
  active: 'bg-green-50 text-green-700', candidate: 'bg-amber-50 text-amber-700',
  superseded: 'bg-gray-100 text-gray-500', archived: 'bg-gray-100 text-gray-400',
}[s] || 'bg-gray-100 text-gray-600')
const runClass = (r) => r.status === 'done'
  ? 'bg-green-50 text-green-700 border-green-200'
  : (r.skip_reason === 'secret' ? 'bg-red-50 text-red-600 border-red-200'
      : 'bg-gray-50 text-gray-500 border-gray-200')
const fmt = (t) => { try { return new Date(t).toLocaleString() } catch { return '' } }

async function loadMemory() {
  if (!props.agentProfile?.id) return
  loading.value = true
  try {
    const { data } = await api.getAgentMemory(props.agentProfile.id,
      { scope: scope.value || undefined, status: status.value || undefined, q: q.value || undefined })
    memories.value = data.memories || []
  } catch (e) {
    notify.error('Could not load memory')
  } finally {
    loading.value = false
  }
}

async function loadActivity() {
  if (!props.agentProfile?.id) return
  try {
    const { data } = await api.getAgentMemoryActivity(props.agentProfile.id)
    activity.value = data.runs || []
  } catch { /* non-fatal */ }
}

async function loadAll() { await Promise.all([loadMemory(), loadActivity()]) }

async function forget(m) {
  if (!(await confirm({ title: 'Forget memory?', message: m.content, confirmText: 'Delete', danger: true }))) return
  busy.value = true
  try {
    await api.forgetMemory(m.id)
    memories.value = memories.value.filter(x => x.id !== m.id)
    notify.success('Forgotten')
  } catch (e) {
    notify.error('Could not delete that memory')
  } finally {
    busy.value = false
  }
}

watch(() => props.agentProfile?.id, loadAll)
onMounted(loadAll)
</script>
