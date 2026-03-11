<template>
  <div class="space-y-6">
    <!-- Enable Signals Toggle -->
    <div class="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center text-lg">⚡</div>
          <div>
            <div class="text-sm font-semibold text-gray-800">Signal Processing</div>
            <div class="text-xs text-gray-500 mt-0.5">Agent reacts to external events (webhooks, Redis streams)</div>
          </div>
        </div>
        <button 
          @click="toggleSignals"
          :class="[
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2',
            agent.signal_enabled ? 'bg-emerald-600' : 'bg-gray-300'
          ]"
        >
          <span :class="['inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm', agent.signal_enabled ? 'translate-x-6' : 'translate-x-1']" />
        </button>
      </div>
    </div>

    <template v-if="agent.signal_enabled">
      <!-- Concurrency Mode -->
      <div class="border border-gray-200 rounded-xl overflow-hidden">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <span class="text-sm font-semibold text-gray-700">🔀 Concurrency Mode</span>
        </div>
        <div class="p-4 space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-medium text-gray-700">Parallel Processing</div>
              <div class="text-xs text-gray-500 mt-0.5">
                {{ agent.signal_parallel 
                  ? 'Different signal types can run concurrently' 
                  : 'Signals execute one at a time (sequential)' }}
              </div>
            </div>
            <button 
              @click="agent.signal_parallel = !agent.signal_parallel"
              :class="[
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
                agent.signal_parallel ? 'bg-indigo-600' : 'bg-gray-300'
              ]"
            >
              <span :class="['inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm', agent.signal_parallel ? 'translate-x-6' : 'translate-x-1']" />
            </button>
          </div>
          
          <div v-if="agent.signal_parallel" class="flex items-center gap-3 pt-2 border-t border-gray-100">
            <label class="text-sm text-gray-600 whitespace-nowrap">Max concurrent</label>
            <input 
              type="number" v-model.number="agent.signal_max_concurrent" min="1" max="20"
              class="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none text-center"
            />
            <span class="text-xs text-gray-400">per signal type</span>
          </div>

          <div class="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-xs text-blue-700">
            <strong>{{ agent.signal_parallel ? 'Parallel:' : 'Sequential:' }}</strong>
            {{ agent.signal_parallel 
              ? 'Multiple signals of different types can be processed at the same time. Same-type signals still wait in queue.' 
              : 'One signal at a time. Others wait in queue until the current one finishes (5 min timeout).' }}
          </div>
        </div>
      </div>

      <!-- Stats Dashboard -->
      <div v-if="stats" class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="bg-white border border-gray-200 rounded-lg p-3 text-center">
          <div class="text-2xl font-bold text-indigo-600">{{ stats.queue?.pending || 0 }}</div>
          <div class="text-xs text-gray-500 mt-1">Pending</div>
        </div>
        <div class="bg-white border border-gray-200 rounded-lg p-3 text-center">
          <div class="text-2xl font-bold text-emerald-600">{{ stats.totals?.processed || 0 }}</div>
          <div class="text-xs text-gray-500 mt-1">Processed</div>
        </div>
        <div class="bg-white border border-gray-200 rounded-lg p-3 text-center">
          <div class="text-2xl font-bold text-red-500">{{ stats.totals?.dead || 0 }}</div>
          <div class="text-xs text-gray-500 mt-1">Dead Letters</div>
        </div>
        <div class="bg-white border border-gray-200 rounded-lg p-3 text-center">
          <div class="text-2xl font-bold text-gray-700">${{ stats.cost?.today_usd || '0' }}</div>
          <div class="text-xs text-gray-500 mt-1">Today's Cost</div>
        </div>
      </div>

      <!-- Webhook Configuration -->
      <div class="border border-gray-200 rounded-xl overflow-hidden">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-gray-700">🔗 Webhook Endpoint</span>
          </div>
          <button 
            @click="showWebhookConfig = !showWebhookConfig" 
            class="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
          >
            {{ showWebhookConfig ? 'Hide' : 'Configure' }}
          </button>
        </div>

        <div class="p-4 space-y-3">
          <!-- Webhook URL (always visible) -->
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">Webhook URL</label>
            <div class="flex gap-2">
              <code class="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 font-mono truncate">
                {{ webhookUrl }}
              </code>
              <button @click="copyToClipboard(webhookUrl)" class="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm">
                📋
              </button>
            </div>
          </div>

          <!-- API Key -->
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">API Key</label>
            <div class="flex gap-2">
              <code class="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 font-mono truncate">
                {{ agent.signal_api_key ? (showApiKey ? agent.signal_api_key : '••••••••••••••••') : 'Not generated yet' }}
              </code>
              <button v-if="agent.signal_api_key" @click="showApiKey = !showApiKey" class="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm">
                {{ showApiKey ? '🙈' : '👁' }}
              </button>
              <button @click="rotateApiKey" :disabled="rotatingKey" class="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm disabled:opacity-50">
                {{ rotatingKey ? '...' : agent.signal_api_key ? '🔄' : 'Generate' }}
              </button>
            </div>
          </div>

          <!-- Extended config -->
          <template v-if="showWebhookConfig">
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">Rate Limit (signals/min)</label>
              <input 
                type="number" v-model.number="agent.signal_rate_limit" min="1" max="1000"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">Daily Budget (USD, empty = unlimited)</label>
              <input 
                type="number" v-model="agent.signal_daily_budget_usd" step="0.01" min="0"
                placeholder="No limit"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">HMAC Webhook Secret</label>
              <input 
                type="password" v-model="agent.signal_webhook_secret"
                placeholder="For Slack, GitHub, Stripe HMAC verification"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">Signal Prompt Template</label>
              <textarea 
                v-model="agent.signal_prompt_template" rows="4"
                placeholder="Custom prompt template (leave empty for default). Use {{signal_type}}, {{payload}}, {{flow_context}}"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono resize-none"
              ></textarea>
            </div>
          </template>
        </div>
      </div>

      <!-- Redis Bridge -->
      <div class="border border-gray-200 rounded-xl overflow-hidden">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-gray-700">📡 Redis Stream Bridge</span>
            <span v-if="agent.signal_redis_url && agent.signal_redis_url !== 'redis://••••••••'" 
                  class="text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">
              🟢 Configured
            </span>
            <span v-else class="text-[10px] px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">
              ⚪ Not set up
            </span>
          </div>
          <button @click="showBridgeConfig = !showBridgeConfig" class="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
            {{ showBridgeConfig ? 'Hide' : 'Configure' }}
          </button>
        </div>
        <div v-if="showBridgeConfig || (!agent.signal_redis_url || agent.signal_redis_url === 'redis://••••••••' ? !agent.signal_stream_key : false)" class="p-4 space-y-3">
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
            <strong>How it works:</strong> Enter your Redis URL and stream key, then <strong>Save the agent</strong>. 
            When a workspace agent is connected, it will automatically start consuming from this stream and route messages to this agent.
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">Redis URL</label>
            <input 
              type="password" v-model="agent.signal_redis_url"
              placeholder="redis://your-redis:6379/0"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
            />
            <p class="text-xs text-gray-400 mt-1">Encrypted at rest. The workspace agent connects to this Redis instance.</p>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">Stream Key</label>
            <input 
              v-model="agent.signal_stream_key"
              placeholder="my-app:events"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
            />
            <p class="text-xs text-gray-400 mt-1">The Redis stream key to XREAD from (e.g. <code>worker:events</code>).</p>
          </div>
          <div v-if="agent.signal_redis_url && agent.signal_stream_key" class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
            💡 Click <strong>Save Agent</strong> (top-right) to apply. The workspace agent will auto-connect to this stream after saving.
          </div>
        </div>
      </div>

      <!-- Test Signal -->
      <div class="border border-gray-200 rounded-xl overflow-hidden">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <span class="text-sm font-semibold text-gray-700">🧪 Test Signal</span>
          <button @click="showTestPanel = !showTestPanel" class="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
            {{ showTestPanel ? 'Hide' : 'Show' }}
          </button>
        </div>
        <div v-if="showTestPanel" class="p-4 space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">Signal Type</label>
              <input v-model="testSignalType" placeholder="test.ping" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">Flow Key (optional)</label>
              <input v-model="testFlowKey" placeholder="my_flow" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">Payload (JSON)</label>
            <textarea v-model="testPayload" rows="3" placeholder='{"message": "Hello!"}' class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono resize-none"></textarea>
          </div>
          <button 
            @click="sendTest" :disabled="sendingTest"
            class="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <span v-if="sendingTest" class="animate-spin">↻</span>
            {{ sendingTest ? 'Sending...' : '⚡ Send Test Signal' }}
          </button>
          <div v-if="testResult" :class="['text-sm rounded-lg p-3 text-center', testResultError ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200']">
            {{ testResult }}
          </div>
        </div>
      </div>

      <!-- Signal Log -->
      <div class="border border-gray-200 rounded-xl overflow-hidden">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <span class="text-sm font-semibold text-gray-700">📋 Signal Log</span>
          <div class="flex items-center gap-2">
            <select v-model="logStatusFilter" @change="loadSignals" class="text-xs px-2 py-1 border border-gray-300 rounded bg-white">
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="processed">Processed</option>
              <option value="failed">Failed</option>
              <option value="dead">Dead</option>
            </select>
            <button @click="loadSignals" class="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Refresh</button>
          </div>
        </div>
        <div class="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
          <div v-if="loadingSignals" class="p-6 text-center text-sm text-gray-500">Loading signals...</div>
          <div v-else-if="signals.length === 0" class="p-6 text-center">
            <div class="text-3xl mb-2">📭</div>
            <p class="text-sm text-gray-500">No signals yet. Send a test signal or configure a webhook.</p>
          </div>
          <div v-for="sig in signals" :key="sig.id" class="px-4 py-3 hover:bg-gray-50 transition">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 min-w-0">
                <span :class="statusBadge(sig.status)" class="text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                  {{ sig.status }}
                </span>
                <span class="text-sm font-medium text-gray-800 truncate">{{ sig.signal_type }}</span>
                <span v-if="sig.flow_key" class="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded">{{ sig.flow_key }}</span>
              </div>
              <div class="flex items-center gap-2 flex-shrink-0 ml-2">
                <span v-if="sig.cost_usd" class="text-xs text-gray-400">${{ sig.cost_usd }}</span>
                <span class="text-xs text-gray-400">{{ formatTime(sig.created_at) }}</span>
                <button v-if="sig.status === 'dead' || sig.status === 'failed'" @click="retrySignal(sig.id)" class="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Retry</button>
                <button v-if="sig.status === 'pending' || sig.status === 'processing'" @click="cancelSignal(sig.id)" class="text-xs text-red-500 hover:text-red-700 font-medium">Cancel</button>
              </div>
            </div>
            <div v-if="sig.error" class="text-xs text-red-500 mt-1 truncate">{{ sig.error }}</div>
          </div>
        </div>
      </div>

      <!-- Flows -->
      <div v-if="flows.length > 0" class="border border-gray-200 rounded-xl overflow-hidden">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <span class="text-sm font-semibold text-gray-700">🔄 Active Flows</span>
        </div>
        <div class="divide-y divide-gray-100">
          <div v-for="flow in flows" :key="flow.id" class="px-4 py-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-gray-800">{{ flow.flow_key }}</span>
                <span :class="flow.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'" class="text-[10px] px-2 py-0.5 rounded-full font-medium">{{ flow.status }}</span>
              </div>
              <div class="flex items-center gap-3 text-xs text-gray-500">
                <span>{{ flow.total_signals }} signals</span>
                <span>${{ flow.total_cost_usd }}</span>
                <span>gen {{ flow.conversation_gen }}</span>
              </div>
            </div>
            <div v-if="flow.context_summary" class="text-xs text-gray-500 mt-1 line-clamp-2">{{ flow.context_summary }}</div>
          </div>
        </div>
      </div>

      <!-- Dead Letters -->
      <div v-if="deadLetters.length > 0" class="border border-red-200 rounded-xl overflow-hidden bg-red-50/30">
        <div class="bg-red-50 px-4 py-3 border-b border-red-200 flex items-center justify-between">
          <span class="text-sm font-semibold text-red-700">💀 Dead Letters ({{ deadLetters.length }})</span>
        </div>
        <div class="divide-y divide-red-100">
          <div v-for="dl in deadLetters" :key="dl.id" class="px-4 py-3">
            <div class="flex items-center justify-between">
              <div>
                <span class="text-sm font-medium text-gray-800">Signal #{{ dl.signal_id }}</span>
                <span class="text-xs text-gray-500 ml-2">{{ dl.signal_type }}</span>
              </div>
              <button @click="retrySignal(dl.signal_id)" class="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 font-medium">Retry</button>
            </div>
            <div class="text-xs text-red-600 mt-1">{{ dl.error_summary }}</div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import api from '../services/api'

const props = defineProps({
  agent: { type: Object, required: true }
})

const emit = defineEmits(['update:agent'])

// UI state
const showWebhookConfig = ref(false)
const showBridgeConfig = ref(false)
const showTestPanel = ref(false)
const showApiKey = ref(false)
const rotatingKey = ref(false)
const redisUrlDirty = ref(false)  // Track if user edited the Redis URL

// Stats
const stats = ref(null)
const signals = ref([])
const flows = ref([])
const deadLetters = ref([])
const loadingSignals = ref(false)
const logStatusFilter = ref('')

// Test signal
const testSignalType = ref('test.ping')
const testFlowKey = ref('')
const testPayload = ref('{"message": "Hello from test!"}')
const sendingTest = ref(false)
const testResult = ref('')
const testResultError = ref(false)

const webhookUrl = computed(() => {
  const base = window.location.origin
  return `${base}/api/agents/${props.agent.id}/webhook/`
})

import { computed } from 'vue'

function toggleSignals() {
  props.agent.signal_enabled = !props.agent.signal_enabled
  if (props.agent.signal_enabled) {
    loadAll()
  }
}

async function loadAll() {
  if (!props.agent.id || !props.agent.signal_enabled) return
  try {
    const [statsRes, signalsRes, flowsRes, deadRes] = await Promise.all([
      api.getSignalStats(props.agent.id),
      api.getSignals(props.agent.id, { status: logStatusFilter.value || undefined, limit: 50 }),
      api.getSignalFlows(props.agent.id),
      api.getDeadLetters(props.agent.id),
    ])
    stats.value = statsRes.data
    signals.value = signalsRes.data.signals || []
    flows.value = flowsRes.data.flows || []
    deadLetters.value = deadRes.data.dead_letters || []
  } catch (e) {
    console.warn('Failed to load signal data:', e)
  }
}

async function loadSignals() {
  loadingSignals.value = true
  try {
    const res = await api.getSignals(props.agent.id, { status: logStatusFilter.value || undefined, limit: 50 })
    signals.value = res.data.signals || []
  } catch (e) {
    console.warn('Failed to load signals:', e)
  } finally {
    loadingSignals.value = false
  }
}

async function rotateApiKey() {
  if (!confirm('Generate a new API key? The old one will be invalidated.')) return
  rotatingKey.value = true
  try {
    const res = await api.rotateSignalApiKey(props.agent.id)
    props.agent.signal_api_key = res.data.api_key
    showApiKey.value = true
  } catch (e) {
    alert('Failed to generate API key: ' + (e.response?.data?.error || e.message))
  } finally {
    rotatingKey.value = false
  }
}

async function sendTest() {
  sendingTest.value = true
  testResult.value = ''
  try {
    let payload = {}
    try { payload = JSON.parse(testPayload.value) } catch { payload = { raw: testPayload.value } }
    const res = await api.sendTestSignal(props.agent.id, {
      signal_type: testSignalType.value || 'test.ping',
      payload,
      flow_key: testFlowKey.value || undefined,
    })
    testResult.value = `Signal dispatched (ID: ${res.data.signal_id})`
    testResultError.value = false
    setTimeout(loadAll, 2000) // Refresh after processing
  } catch (e) {
    testResult.value = 'Failed: ' + (e.response?.data?.error || e.message)
    testResultError.value = true
  } finally {
    sendingTest.value = false
  }
}

async function retrySignal(signalId) {
  try {
    await api.retrySignal(props.agent.id, signalId)
    loadAll()
  } catch (e) {
    alert('Retry failed: ' + (e.response?.data?.error || e.message))
  }
}

async function cancelSignal(signalId) {
  try {
    await api.cancelSignal(props.agent.id, signalId)
    loadAll()
  } catch (e) {
    alert('Cancel failed: ' + (e.response?.data?.error || e.message))
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text)
}

function statusBadge(status) {
  const map = {
    pending: 'bg-amber-100 text-amber-700',
    processing: 'bg-blue-100 text-blue-700',
    processed: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-red-100 text-red-700',
    dead: 'bg-red-200 text-red-800',
    paused: 'bg-gray-100 text-gray-600',
  }
  return map[status] || 'bg-gray-100 text-gray-600'
}

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diff = (now - d) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return Math.floor(diff/60) + 'm ago'
  if (diff < 86400) return Math.floor(diff/3600) + 'h ago'
  return d.toLocaleDateString()
}

onMounted(() => {
  if (props.agent.signal_enabled) loadAll()
})

watch(() => props.agent.id, () => {
  if (props.agent.signal_enabled) loadAll()
})
</script>
