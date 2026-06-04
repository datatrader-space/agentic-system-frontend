<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div class="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span>🔌</span> Integration Guide
          </h1>
          <p class="text-sm text-gray-500 mt-0.5">
            Use <span class="font-medium text-gray-700">{{ agentName }}</span> from another project
          </p>
        </div>
        <button @click="goBack" class="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
          &larr; Back
        </button>
      </div>
    </div>

    <div class="max-w-4xl mx-auto px-6 py-8 space-y-10">

      <!-- Overview -->
      <section>
        <h2 class="text-lg font-semibold text-gray-900 mb-2">Two ways to integrate</h2>
        <div class="grid md:grid-cols-2 gap-4">
          <div class="bg-white border border-gray-200 rounded-xl p-4">
            <div class="font-medium text-gray-800 mb-1">💬 WebSocket — live chat</div>
            <p class="text-sm text-gray-600">Real-time, streamed replies. Best for chat UIs and interactive use. This is what most integrations want.</p>
          </div>
          <div class="bg-white border border-gray-200 rounded-xl p-4">
            <div class="font-medium text-gray-800 mb-1">🪝 Webhook — fire &amp; forget</div>
            <p class="text-sm text-gray-600">POST an event; the agent processes it in the background. Returns <code class="text-xs bg-gray-100 px-1 rounded">202</code> immediately — it does <b>not</b> return the reply.</p>
          </div>
        </div>
      </section>

      <!-- Prerequisites -->
      <section>
        <h2 class="text-lg font-semibold text-gray-900 mb-2">Prerequisites</h2>
        <ul class="text-sm text-gray-700 space-y-1 list-disc pl-5">
          <li><b>Signals enabled</b> on this agent (toggle on the Signals tab).</li>
          <li>A <b>default model</b> configured (otherwise the agent can't reply).</li>
          <li>An <b>API key</b> generated (the <code class="text-xs bg-gray-100 px-1 rounded">Generate</code> button on the Signals tab).</li>
        </ul>
      </section>

      <!-- Connection details -->
      <section>
        <h2 class="text-lg font-semibold text-gray-900 mb-3">Your connection details</h2>
        <div class="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">WebSocket Chat URL</label>
            <div class="flex gap-2">
              <code class="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono truncate">{{ wsChatUrl }}</code>
              <button @click="copy(wsChatUrl, 'ws')" class="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">{{ copied === 'ws' ? '✓' : '📋' }}</button>
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">Webhook URL</label>
            <div class="flex gap-2">
              <code class="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono truncate">{{ webhookUrl }}</code>
              <button @click="copy(webhookUrl, 'wh')" class="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">{{ copied === 'wh' ? '✓' : '📋' }}</button>
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">API Key</label>
            <div class="flex gap-2">
              <code class="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono truncate">{{ apiKey }}</code>
              <button v-if="hasKey" @click="copy(apiKey, 'key')" class="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">{{ copied === 'key' ? '✓' : '📋' }}</button>
            </div>
            <p v-if="!hasKey" class="text-xs text-amber-600 mt-1">No key yet — generate one on the Signals tab, then refresh this page.</p>
          </div>
        </div>
      </section>

      <!-- Auth -->
      <section>
        <h2 class="text-lg font-semibold text-gray-900 mb-2">Authentication</h2>
        <p class="text-sm text-gray-700">
          The <b>same API key</b> authenticates both channels. The connection is locked to this one agent — no account
          login or password is shared. Provide the key as:
        </p>
        <ul class="text-sm text-gray-700 space-y-1 list-disc pl-5 mt-2">
          <li>WebSocket: query param <code class="text-xs bg-gray-100 px-1 rounded">?token=&lt;API_KEY&gt;</code> or header <code class="text-xs bg-gray-100 px-1 rounded">Authorization: Bearer &lt;API_KEY&gt;</code></li>
          <li>Webhook: header <code class="text-xs bg-gray-100 px-1 rounded">Authorization: Bearer &lt;API_KEY&gt;</code></li>
        </ul>
      </section>

      <!-- WebSocket example -->
      <section>
        <h2 class="text-lg font-semibold text-gray-900 mb-2">💬 Live chat over WebSocket (Python)</h2>
        <p class="text-sm text-gray-600 mb-2">
          Keep one <code class="text-xs bg-gray-100 px-1 rounded">conversation_id</code> per user/session and resend it every
          turn so the agent <b>remembers context</b>.
        </p>
        <CodeBlock :code="pyWs" :id="'pyws'" :copied="copied" @copy="copy" />
      </section>

      <!-- JS example -->
      <section>
        <h2 class="text-lg font-semibold text-gray-900 mb-2">💬 Live chat (Node.js / browser)</h2>
        <CodeBlock :code="jsWs" :id="'jsws'" :copied="copied" @copy="copy" />
      </section>

      <!-- Event protocol -->
      <section>
        <h2 class="text-lg font-semibold text-gray-900 mb-2">Server → client events</h2>
        <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr><th class="text-left px-4 py-2">Event type</th><th class="text-left px-4 py-2">Meaning / field</th></tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr><td class="px-4 py-2 font-mono text-xs">conversation_created</td><td class="px-4 py-2">First message only — save <code class="text-xs bg-gray-100 px-1 rounded">conversation_id</code></td></tr>
              <tr><td class="px-4 py-2 font-mono text-xs">assistant_typing</td><td class="px-4 py-2">Typing indicator</td></tr>
              <tr><td class="px-4 py-2 font-mono text-xs">assistant_message_chunk</td><td class="px-4 py-2">Streamed text in field <code class="text-xs bg-gray-100 px-1 rounded">chunk</code></td></tr>
              <tr><td class="px-4 py-2 font-mono text-xs">assistant_message_complete</td><td class="px-4 py-2">Reply finished — full text in <code class="text-xs bg-gray-100 px-1 rounded">full_message</code></td></tr>
              <tr><td class="px-4 py-2 font-mono text-xs">tool_call / tool_result</td><td class="px-4 py-2">Agent is using a tool</td></tr>
              <tr><td class="px-4 py-2 font-mono text-xs">error</td><td class="px-4 py-2">Something went wrong (field <code class="text-xs bg-gray-100 px-1 rounded">error</code>)</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Webhook example -->
      <section>
        <h2 class="text-lg font-semibold text-gray-900 mb-2">🪝 Push an event via Webhook</h2>
        <p class="text-sm text-gray-600 mb-2">Fire-and-forget — returns <code class="text-xs bg-gray-100 px-1 rounded">202</code> with a <code class="text-xs bg-gray-100 px-1 rounded">signal_id</code>; the reply is not returned here.</p>
        <CodeBlock :code="curlWh" :id="'curl'" :copied="copied" @copy="copy" />
      </section>

      <!-- Notes -->
      <section>
        <h2 class="text-lg font-semibold text-gray-900 mb-2">Notes</h2>
        <ul class="text-sm text-gray-700 space-y-1 list-disc pl-5">
          <li>Treat the API key like a password. You can <b>rotate</b> it anytime on the Signals tab (the old one stops working immediately).</li>
          <li>The connection is scoped to this agent only — it can't reach your other agents.</li>
          <li>Persist <code class="text-xs bg-gray-100 px-1 rounded">conversation_id</code> per end-user to keep continuous memory across reconnects.</li>
        </ul>
      </section>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../services/api'

const route = useRoute()
const router = useRouter()

const agentId = computed(() => route.params.agentId || '<AGENT_ID>')
const agentName = ref('this agent')
const apiKey = ref('<YOUR_API_KEY>')
const hasKey = computed(() => apiKey.value && !apiKey.value.startsWith('<'))
const copied = ref('')

// Public backend base (matches SignalPanel logic)
const apiBase = (import.meta.env.VITE_PUBLIC_API_BASE || window.location.origin).replace(/\/+$/, '')

const webhookUrl = computed(() => `${apiBase}/api/agents/${agentId.value}/webhook/`)
const wsChatUrl = computed(() => {
  let host, scheme
  try {
    const u = new URL(apiBase)
    host = u.host
    scheme = u.protocol === 'https:' ? 'wss' : 'ws'
  } catch (e) {
    host = window.location.host
    scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
  }
  return `${scheme}://${host}/ws/chat/repository/0/`
})

const pyWs = computed(() => `# pip install websocket-client
import json, websocket

API_KEY = "${apiKey.value}"
WS_URL  = "${wsChatUrl.value}?token=" + API_KEY

ws = websocket.create_connection(WS_URL)
conversation_id = None

def chat(message):
    global conversation_id
    payload = {"type": "chat_message", "message": message}
    if conversation_id is not None:
        payload["conversation_id"] = conversation_id   # keep one thread = memory
    ws.send(json.dumps(payload))
    while True:
        evt = json.loads(ws.recv())
        t = evt.get("type")
        if t == "conversation_created":
            conversation_id = evt["conversation_id"]    # capture once, reuse
        elif t == "assistant_message_chunk":
            print(evt.get("chunk", ""), end="", flush=True)
        elif t == "assistant_message_complete":
            print(); break
        elif t == "error":
            print("ERROR:", evt); break

chat("Hello, what can you do?")
chat("And what did I just ask?")   # same conversation -> remembers
ws.close()`)

const jsWs = computed(() => `// npm install ws   (browser: WebSocket is built-in)
import WebSocket from 'ws';

const API_KEY = "${apiKey.value}";
const ws = new WebSocket("${wsChatUrl.value}?token=" + API_KEY);
let conversationId = null;

ws.onopen = () => ws.send(JSON.stringify({ type: "chat_message", message: "Hello!" }));
ws.onmessage = (e) => {
  const evt = JSON.parse(e.data);
  if (evt.type === "conversation_created") conversationId = evt.conversation_id;
  else if (evt.type === "assistant_message_chunk") process.stdout.write(evt.chunk);
  else if (evt.type === "assistant_message_complete") ws.close();
  else if (evt.type === "error") console.error(evt);
};`)

const curlWh = computed(() => `curl -X POST "${webhookUrl.value}" \\
  -H "Authorization: Bearer ${apiKey.value}" \\
  -H "Content-Type: application/json" \\
  -d '{"signal_type":"order.created","payload":{"order_id":987}}'`)

async function copy(text, id) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = id
    setTimeout(() => { if (copied.value === id) copied.value = '' }, 1500)
  } catch (e) { /* ignore */ }
}

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push('/dashboard/agents')
}

onMounted(async () => {
  const id = route.params.agentId
  if (!id) return
  try {
    const res = await api.get(`/agents/${id}/`)
    const a = res.data || {}
    if (a.name) agentName.value = a.name
    if (a.signal_api_key) apiKey.value = a.signal_api_key
  } catch (e) {
    // not logged in / not found — guide still renders with placeholders
  }
})

// Tiny inline code-block component with a copy button
const CodeBlock = {
  props: ['code', 'id', 'copied'],
  emits: ['copy'],
  setup(props, { emit }) {
    return () => h('div', { class: 'relative' }, [
      h('button', {
        class: 'absolute top-2 right-2 text-xs px-2 py-1 bg-gray-700 text-gray-200 rounded hover:bg-gray-600',
        onClick: () => emit('copy', props.code, props.id),
      }, props.copied === props.id ? '✓ Copied' : 'Copy'),
      h('pre', { class: 'bg-gray-900 text-gray-100 rounded-xl p-4 overflow-x-auto text-xs leading-relaxed' },
        h('code', null, props.code)),
    ])
  },
}
</script>
