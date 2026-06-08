<!--
  EmulatorInspector — the "under the hood" debug view for the Emulator. For a selected
  assistant turn it shows: tokens & model, the full trace with raw tool I/O, the RAG
  chunks retrieved, the REAL system prompt the model received (from the workspace debug
  logs), and the raw WS event log. Read-only; driven by data the Emulator captured plus
  the debug-logs fetch endpoint.
-->
<template>
  <div class="flex flex-col h-full bg-slate-50">
    <div class="px-4 py-2 flex items-center justify-between shrink-0">
      <span class="text-sm font-bold text-gray-900">Inspector</span>
      <select v-if="turns.length > 1" v-model.number="sel"
              class="text-xs border border-gray-200 rounded px-1.5 py-0.5 bg-white max-w-[60%] truncate">
        <option v-for="(t, i) in turns" :key="i" :value="i">{{ turnLabel(t, i) }}</option>
      </select>
    </div>

    <div v-if="!turns.length" class="flex-1 flex items-center justify-center text-center p-6 text-sm text-gray-400">
      Send a message — the Inspector shows what the agent did under the hood.
    </div>

    <div v-else class="flex-1 overflow-y-auto px-3 pb-4 space-y-3 text-[13px]">
      <!-- Tokens & model -->
      <section class="bg-white border border-gray-200 rounded-xl p-3">
        <h4 class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Tokens &amp; model</h4>
        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-700">
          <div class="flex justify-between"><span class="text-gray-400">Model</span><span class="font-medium truncate ml-2">{{ modelName || '—' }}</span></div>
          <div class="flex justify-between"><span class="text-gray-400">Total</span><span class="font-medium">{{ fmt(cur.usage?.total_tokens) }}</span></div>
          <div class="flex justify-between"><span class="text-gray-400">Prompt ↑</span><span>{{ fmt(cur.usage?.prompt_tokens) }}</span></div>
          <div class="flex justify-between"><span class="text-gray-400">Completion ↓</span><span>{{ fmt(cur.usage?.completion_tokens) }}</span></div>
        </div>
      </section>

      <!-- Trace -->
      <section class="bg-white border border-gray-200 rounded-xl p-3">
        <h4 class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Trace</h4>
        <div v-if="cur.activity?.steps?.length" class="space-y-1">
          <div v-for="s in cur.activity.steps" :key="s.id" class="flex items-center gap-2">
            <span class="w-1.5 h-1.5 rounded-full shrink-0"
                  :class="s.status === 'error' ? 'bg-red-500' : (s.status === 'running' ? 'bg-indigo-500' : 'bg-emerald-500')"></span>
            <span class="flex-1 min-w-0 truncate" :class="s.status === 'error' ? 'text-red-600' : 'text-gray-700'">{{ s.label }}</span>
            <span class="text-[11px] text-gray-400 shrink-0">{{ secs(s) != null ? secs(s).toFixed(1) + 's' : '' }}</span>
          </div>
        </div>
        <!-- Raw tool I/O -->
        <div v-if="cur.toolIO?.length" class="mt-2 pt-2 border-t border-gray-100 space-y-1.5">
          <div v-for="(tio, i) in cur.toolIO" :key="i" class="text-[12px]">
            <button @click="toggle('tio' + sel + '-' + i)"
                    class="w-full flex items-center gap-1.5 text-left hover:bg-slate-50 rounded px-1 py-0.5">
              <span :class="tio.ok === false ? 'text-red-500' : 'text-amber-600'">🔧</span>
              <span class="font-medium text-gray-700 truncate flex-1">{{ tio.name }}</span>
              <span v-if="tio.endTs" class="text-[10px] text-gray-400">{{ ((tio.endTs - tio.startTs) / 1000).toFixed(1) }}s</span>
              <span class="text-gray-300">{{ open.has('tio' + sel + '-' + i) ? '▾' : '▸' }}</span>
            </button>
            <div v-if="open.has('tio' + sel + '-' + i)" class="pl-4 pr-1 pb-1 space-y-1">
              <div class="text-[10px] uppercase text-gray-400">input</div>
              <pre class="text-[11px] bg-slate-50 border border-gray-100 rounded p-1.5 overflow-x-auto whitespace-pre-wrap break-words max-h-40">{{ pretty(tio.input) }}</pre>
              <div class="text-[10px] uppercase text-gray-400">output</div>
              <pre class="text-[11px] bg-slate-50 border border-gray-100 rounded p-1.5 overflow-x-auto whitespace-pre-wrap break-words max-h-48">{{ pretty(tio.output) }}</pre>
            </div>
          </div>
        </div>
        <div v-if="!cur.activity?.steps?.length && !cur.toolIO?.length" class="text-gray-400">No trace.</div>
      </section>

      <!-- Knowledge retrieved (RAG) -->
      <section v-if="cur.knowledge?.length" class="bg-white border border-gray-200 rounded-xl p-3">
        <h4 class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Knowledge retrieved (RAG)</h4>
        <div class="space-y-1.5">
          <div v-for="(c, i) in cur.knowledge" :key="i" class="border border-gray-100 rounded p-1.5 bg-slate-50">
            <div class="flex items-center justify-between text-[11px]">
              <span class="font-medium text-gray-700 truncate">{{ c.name }}</span>
              <span class="text-emerald-600 shrink-0 ml-2">relevance {{ Number(c.score).toFixed(2) }}</span>
            </div>
            <div class="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{{ c.preview }}</div>
          </div>
        </div>
      </section>

      <!-- System prompt (actual, from workspace debug logs) -->
      <section class="bg-white border border-gray-200 rounded-xl p-3">
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">System prompt (actual)</h4>
          <div class="flex items-center gap-2">
            <select v-if="debug.turns?.length" v-model="debugTs" @change="loadDebug" class="text-[11px] border border-gray-200 rounded px-1 py-0.5 bg-white">
              <option v-for="t in [...debug.turns].reverse()" :key="t.ts" :value="t.ts">{{ fmtTs(t.ts) }}</option>
            </select>
            <button @click="loadDebug" :disabled="loadingDebug" class="text-[11px] text-indigo-600 hover:text-indigo-800 disabled:opacity-50">↻</button>
          </div>
        </div>
        <div v-if="loadingDebug" class="text-gray-400 text-[12px]">Loading…</div>
        <div v-else-if="!debug.latest" class="text-gray-400 text-[12px]">No server-side prompt log for this conversation yet.</div>
        <template v-else>
          <pre class="text-[11px] bg-slate-900 text-slate-100 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words max-h-72">{{ systemPromptText }}</pre>
          <button @click="toggle('fullmsgs')" class="mt-1 text-[11px] text-indigo-600 hover:text-indigo-800">
            {{ open.has('fullmsgs') ? 'Hide' : 'Show' }} full message array ({{ debug.latest.prompt?.message_count || 0 }} msgs)
          </button>
          <pre v-if="open.has('fullmsgs')" class="mt-1 text-[10px] bg-slate-50 border border-gray-100 rounded p-1.5 overflow-x-auto whitespace-pre-wrap break-words max-h-72">{{ pretty(debug.latest.prompt?.messages) }}</pre>
        </template>
      </section>

      <!-- Raw events -->
      <section class="bg-white border border-gray-200 rounded-xl p-3">
        <button @click="toggle('rawevents')" class="w-full flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          <span>Raw events ({{ cur.events?.length || 0 }})</span>
          <span class="text-gray-300">{{ open.has('rawevents') ? '▾' : '▸' }}</span>
        </button>
        <pre v-if="open.has('rawevents')" class="mt-2 text-[10px] bg-slate-50 border border-gray-100 rounded p-1.5 overflow-x-auto whitespace-pre-wrap break-words max-h-80">{{ pretty(cur.events) }}</pre>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import api from '../../services/api'
import { stepSeconds } from '../../composables/activityStream'

const props = defineProps({
  agentId: { type: [Number, String], default: null },
  conversationId: { type: [Number, String], default: null },
  modelName: { type: String, default: '' },
  turns: { type: Array, default: () => [] }, // [{ prompt, content, activity, usage, toolIO, knowledge, events }]
})

const sel = ref(0)
const open = ref(new Set())
const debug = ref({ turns: [], latest: null })
const debugTs = ref('')
const loadingDebug = ref(false)

// Default to the latest turn whenever the turn count changes.
watch(() => props.turns.length, (n) => { sel.value = Math.max(0, n - 1) }, { immediate: true })

const cur = computed(() => props.turns[sel.value] || {})

const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString())
const secs = (s) => stepSeconds(s)
const pretty = (x) => {
  if (x == null) return '—'
  if (typeof x === 'string') return x
  try { return JSON.stringify(x, null, 2) } catch { return String(x) }
}
function turnLabel(t, i) {
  const p = (t.prompt || '').trim()
  return p ? `${i + 1}. ${p.slice(0, 40)}` : `Turn ${i + 1}`
}
function fmtTs(ts) {
  // 20260606_102934_544698 -> 10:29:34
  const m = /^\d{8}_(\d{2})(\d{2})(\d{2})/.exec(ts || '')
  return m ? `${m[1]}:${m[2]}:${m[3]}` : ts
}
function toggle(key) {
  const s = new Set(open.value)
  s.has(key) ? s.delete(key) : s.add(key)
  open.value = s
}

const systemPromptText = computed(() => {
  const msgs = debug.value.latest?.prompt?.messages
  if (!Array.isArray(msgs)) return '—'
  const sys = msgs.find((m) => m.role === 'system')
  return (sys && (typeof sys.content === 'string' ? sys.content : pretty(sys.content))) || '(no system message)'
})

async function loadDebug() {
  if (!props.agentId) return
  loadingDebug.value = true
  try {
    const params = {}
    if (props.conversationId) params.conversation = props.conversationId
    if (debugTs.value) params.ts = debugTs.value
    const res = await api.getAgentDebugLogs(props.agentId, params)
    debug.value = res.data || { turns: [], latest: null }
    if (debug.value.latest && !debugTs.value) debugTs.value = debug.value.latest.ts
  } catch (e) {
    debug.value = { turns: [], latest: null }
  } finally {
    loadingDebug.value = false
  }
}

watch(() => props.conversationId, () => { debugTs.value = ''; loadDebug() })
onMounted(loadDebug)
</script>
