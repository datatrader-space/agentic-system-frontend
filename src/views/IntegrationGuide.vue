<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div class="max-w-4xl mx-auto px-6 pt-4 flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-gray-900 flex items-center gap-2"><span>🔌</span> Integration Guide</h1>
          <p class="text-sm text-gray-500 mt-0.5">Use <span class="font-medium text-gray-700">{{ agentName }}</span> from another project</p>
        </div>
        <button @click="goBack" class="text-sm text-indigo-600 hover:text-indigo-800 font-medium">&larr; Back</button>
      </div>
      <!-- Tabs -->
      <div class="max-w-4xl mx-auto px-6">
        <nav class="flex gap-1 -mb-px">
          <button v-for="t in tabs" :key="t.id" @click="setTab(t.id)"
            :class="['px-4 py-2.5 text-sm font-medium border-b-2 transition', tab === t.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-800']">
            {{ t.icon }} {{ t.label }}
          </button>
        </nav>
      </div>
    </div>

    <div class="max-w-4xl mx-auto px-6 py-8 space-y-10">

      <!-- ════════════ WEBSOCKET ════════════ -->
      <template v-if="tab === 'websocket'">
        <section>
          <h2 class="text-lg font-semibold text-gray-900 mb-1">💬 Live chat over WebSocket <span class="align-middle text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-100 rounded px-1.5 py-0.5 ml-1">Best for chat</span></h2>
          <p class="text-sm text-gray-600">Real-time, streamed replies — best for chat UIs and interactive use. This is what most integrations want.</p>
        </section>

        <section>
          <div class="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
            <div class="font-medium text-indigo-900 text-sm mb-1">🧠 Sessions &amp; memory — read this first</div>
            <p class="text-sm text-indigo-800/90">The agent remembers a conversation only while you reuse the same <code class="kbd">conversation_id</code>. On the <b>first</b> message send none; the server replies with a <code class="kbd">conversation_created</code> event carrying a new <code class="kbd">conversation_id</code>. <b>Save it and send it back on every later message</b> for that user. Omit it and each message starts a brand-new chat with no memory of the last reply.</p>
          </div>
        </section>

        <section>
          <h2 class="text-base font-semibold text-gray-900 mb-3">Connection details</h2>
          <div class="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <UrlRow label="WebSocket Chat URL" :value="wsChatUrl" cid="ws" :copied="copied" @copy="copy" />
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">Access Key <span class="text-gray-400">(backend only)</span></label>
              <div class="flex gap-2">
                <code class="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono truncate">{{ apiKey }}</code>
                <button v-if="hasKey" @click="copy(apiKey, 'key')" class="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">{{ copied === 'key' ? '✓' : '📋' }}</button>
              </div>
              <p v-if="!hasKey" class="text-xs text-amber-600 mt-1">No key yet — generate one in the Deploy panel, then refresh.</p>
            </div>
          </div>
        </section>

        <section>
          <h2 class="text-base font-semibold text-gray-900 mb-2">Authentication</h2>
          <p class="text-sm text-gray-700">Provide a token on the handshake — <b>query param</b> <code class="kbd">?token=&lt;TOKEN&gt;</code> or header <code class="kbd">Authorization: Bearer &lt;TOKEN&gt;</code>. The connection is locked to this one agent.</p>
          <div class="mt-3 bg-violet-50 border border-violet-200 rounded-xl p-4">
            <div class="font-medium text-violet-900 text-sm mb-1">🔐 Browser apps: use a short-lived chat token</div>
            <p class="text-sm text-violet-800/90">Never ship the access key to a browser. Your <b>backend</b> mints a short-lived token from the key and hands it to the browser, which connects with it like any other token.</p>
            <UrlRow class="mt-2" label="Mint endpoint (server-side)" :value="`POST ${chatTokenUrl}`" cid="ctok" :copied="copied" @copy="copy" />
            <CodeBlock :code="chatTokenExample" :id="'ctokex'" :copied="copied" @copy="copy" />
          </div>
        </section>

        <section>
          <h2 class="text-base font-semibold text-gray-900 mb-2">Live chat (Python)</h2>
          <p class="text-sm text-gray-600 mb-2">Keep one <code class="kbd">conversation_id</code> per user/session and resend it every turn so the agent <b>remembers context</b>.</p>
          <CodeBlock :code="pyWs" :id="'pyws'" :copied="copied" @copy="copy" />
        </section>

        <section>
          <h2 class="text-base font-semibold text-gray-900 mb-2">Live chat (Node.js / browser)</h2>
          <CodeBlock :code="jsWs" :id="'jsws'" :copied="copied" @copy="copy" />
        </section>

        <section>
          <h2 class="text-base font-semibold text-gray-900 mb-2">Server → client events</h2>
          <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table class="w-full text-sm">
              <thead class="bg-gray-50 text-gray-500 text-xs uppercase"><tr><th class="text-left px-4 py-2">Event type</th><th class="text-left px-4 py-2">Meaning / field</th></tr></thead>
              <tbody class="divide-y divide-gray-100">
                <tr><td class="px-4 py-2 font-mono text-xs">conversation_created</td><td class="px-4 py-2">First message only — save <code class="kbd">conversation_id</code></td></tr>
                <tr><td class="px-4 py-2 font-mono text-xs">assistant_typing</td><td class="px-4 py-2">Typing indicator</td></tr>
                <tr><td class="px-4 py-2 font-mono text-xs">assistant_message_chunk</td><td class="px-4 py-2">Streamed text in field <code class="kbd">chunk</code></td></tr>
                <tr><td class="px-4 py-2 font-mono text-xs">assistant_message_complete</td><td class="px-4 py-2">Reply finished — <code class="kbd">full_message</code> + <code class="kbd">usage</code> (always present)</td></tr>
                <tr><td class="px-4 py-2 font-mono text-xs">tool_call / tool_result</td><td class="px-4 py-2">Agent is using a tool (call uses <code class="kbd">tool</code>; result uses <code class="kbd">tool_name</code>)</td></tr>
                <tr><td class="px-4 py-2 font-mono text-xs">error</td><td class="px-4 py-2">Something went wrong (field <code class="kbd">error</code>)</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>

      <!-- ════════════ WEBHOOK ════════════ -->
      <template v-else-if="tab === 'webhook'">
        <section>
          <h2 class="text-lg font-semibold text-gray-900 mb-1">🪝 Push an event via Webhook</h2>
          <p class="text-sm text-gray-600">Fire-and-forget for backend events — no live user waiting. Returns <code class="kbd">202</code> + a <code class="kbd">result_url</code> you poll for the reply &amp; usage.</p>
          <p class="text-sm text-gray-600 mt-1">Building a back-and-forth chat instead of one-off events? Add a stable <code class="kbd">flow_key</code> (below) so the agent keeps context — or use <b>WebSocket</b>, which is built for chat.</p>
        </section>

        <section>
          <h2 class="text-base font-semibold text-gray-900 mb-3">Connection details</h2>
          <div class="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <UrlRow label="Webhook URL (POST)" :value="webhookUrl" cid="wh" :copied="copied" @copy="copy" />
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">API Key</label>
              <div class="flex gap-2">
                <code class="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono truncate">{{ apiKey }}</code>
                <button v-if="hasKey" @click="copy(apiKey, 'key')" class="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">{{ copied === 'key' ? '✓' : '📋' }}</button>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 class="text-base font-semibold text-gray-900 mb-2">Authentication</h2>
          <ul class="text-sm text-gray-700 space-y-1 list-disc pl-5">
            <li>Header <code class="kbd">Authorization: Bearer &lt;API_KEY&gt;</code>, <b>or</b></li>
            <li>HMAC <code class="kbd">X-Signature: sha256=&lt;hex&gt;</code> (set the HMAC secret in the Deploy panel → Webhook → Advanced).</li>
          </ul>
        </section>

        <section>
          <h2 class="text-base font-semibold text-gray-900 mb-2">1 — Send the event</h2>
          <CodeBlock :code="curlWh" :id="'curl'" :copied="copied" @copy="copy" />
        </section>

        <section>
          <h2 class="text-base font-semibold text-gray-900 mb-2">2 — Poll for the result</h2>
          <p class="text-sm text-gray-600 mb-2">The <code class="kbd">202</code> returns a <code class="kbd">result_url</code>. Poll it until <code class="kbd">status</code> is <code class="kbd">processed</code> — the result carries <code class="kbd">response</code>, <code class="kbd">usage</code> and <code class="kbd">cost_usd</code>.</p>
          <CodeBlock :code="curlPoll" :id="'poll'" :copied="copied" @copy="copy" />
        </section>

        <section>
          <h2 class="text-base font-semibold text-gray-900 mb-2">Sessions &amp; memory <span class="align-middle text-[10px] font-semibold uppercase tracking-wide text-indigo-700 bg-indigo-100 rounded px-1.5 py-0.5">multi-turn chat</span></h2>
          <div class="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-2">
            <p class="text-sm text-indigo-900">By default each webhook call is independent — fine for one-off events, but a chat loses context every message. To keep memory across calls, send the <b>same</b> <code class="kbd">flow_key</code> for every message in one conversation (e.g. one per end-user or per chat thread):</p>
            <CodeBlock :code="curlWhFlow" :id="'whflow'" :copied="copied" @copy="copy" />
            <ul class="text-sm text-indigo-800/90 space-y-1 list-disc pl-5">
              <li>Same <code class="kbd">flow_key</code> → same persistent conversation; the agent sees prior turns + a rolling summary.</li>
              <li>Use a different <code class="kbd">flow_key</code> per user/thread to keep them isolated.</li>
              <li>For a live, streamed chat experience prefer the <b>WebSocket</b> tab — webhook is async (you poll) and best for backend events.</li>
            </ul>
          </div>
        </section>
      </template>

      <!-- ════════════ WIDGET ════════════ -->
      <template v-else>
        <section>
          <h2 class="text-lg font-semibold text-gray-900 mb-1">🌐 Embeddable widget</h2>
          <p class="text-sm text-gray-600">A drop-in chat bubble for a public website — anonymous visitors, no login. Enable the <b>Public Widget</b> in the Deploy panel first.</p>
        </section>

        <section v-if="!shareToken" class="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
          The public share link isn't enabled yet. Turn on <b>Public Widget</b> in the Deploy panel, then refresh this page to see your embed code.
        </section>

        <template v-else>
          <section>
            <h2 class="text-base font-semibold text-gray-900 mb-3">Your public links</h2>
            <div class="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <UrlRow label="Share link (full page)" :value="shareUrl" cid="share" :copied="copied" @copy="copy" />
            </div>
          </section>

          <section>
            <h2 class="text-base font-semibold text-gray-900 mb-2">Embed on your site</h2>
            <p class="text-sm text-gray-600 mb-2">Paste this before <code class="kbd">&lt;/body&gt;</code>. Only the public share token is exposed — no secrets.</p>
            <CodeBlock :code="embedCode" :id="'embed'" :copied="copied" @copy="copy" />
          </section>

          <section>
            <h2 class="text-base font-semibold text-gray-900 mb-2">Good to know</h2>
            <ul class="text-sm text-gray-700 space-y-1 list-disc pl-5">
              <li>Public chat runs with guardrails (rate-limited, destructive tools blocked) and only serves the <b>published</b> snapshot.</li>
              <li>Appearance (name, greeting, color, launcher, proactive message) is configured in the Deploy panel → Public Widget.</li>
              <li>Regenerating the link in the Deploy panel revokes the old one immediately.</li>
            </ul>
          </section>
        </template>
      </template>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../services/api'

const route = useRoute()
const router = useRouter()

const tabs = [
  { id: 'websocket', label: 'WebSocket', icon: '💬' },
  { id: 'webhook', label: 'Webhook', icon: '🪝' },
  { id: 'widget', label: 'Widget', icon: '🌐' },
]
const validTabs = tabs.map(t => t.id)
const tab = ref(validTabs.includes(route.query.tab) ? route.query.tab : 'websocket')
function setTab(id) {
  tab.value = id
  router.replace({ query: { ...route.query, tab: id } })
}

const agentId = computed(() => route.params.agentId || '<AGENT_ID>')
const agentName = ref('this agent')
const apiKey = ref('<YOUR_API_KEY>')
const hasKey = computed(() => apiKey.value && !apiKey.value.startsWith('<'))
const shareToken = ref('')
const publicSlug = ref('')
const copied = ref('')

const publicOrigin = window.location.origin
const apiBase = (import.meta.env.VITE_PUBLIC_API_BASE || window.location.origin).replace(/\/+$/, '')

const webhookUrl = computed(() => `${apiBase}/api/agents/${agentId.value}/webhook/`)
const chatTokenUrl = computed(() => `${apiBase}/api/agents/${agentId.value}/chat-token/`)
const resultUrl = computed(() => `${apiBase}/api/agents/${agentId.value}/signals/<SIGNAL_ID>/`)
const wsChatUrl = computed(() => {
  let host, scheme
  try { const u = new URL(apiBase); host = u.host; scheme = u.protocol === 'https:' ? 'wss' : 'ws' }
  catch (e) { host = window.location.host; scheme = window.location.protocol === 'https:' ? 'wss' : 'ws' }
  return `${scheme}://${host}/ws/chat/repository/0/`
})
const shareUrl = computed(() => (shareToken.value ? `${publicOrigin}/a/${publicSlug.value || shareToken.value}` : ''))
const widgetSrc = computed(() => `${publicOrigin}/webchat/widget.js`)
const embedCode = computed(() => shareToken.value
  ? `<script src="${widgetSrc.value}"><\/script>\n<script>\n  AgentChat.init({ token: "${shareToken.value}", mode: "bubble" });\n<\/script>`
  : '')

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

const jsWs = computed(() => `// browser: WebSocket is built-in. For a browser app, fetch a short-lived
// token from YOUR backend first (see Authentication), then connect with it.
const TOKEN = "<CHAT_TOKEN_OR_API_KEY>";
const ws = new WebSocket("${wsChatUrl.value}?token=" + encodeURIComponent(TOKEN));
let conversationId = null;

ws.onopen = () => ws.send(JSON.stringify({ type: "chat_message", message: "Hello!" }));
ws.onmessage = (e) => {
  const evt = JSON.parse(e.data);
  if (evt.type === "conversation_created") conversationId = evt.conversation_id;
  else if (evt.type === "assistant_message_chunk") document.write(evt.chunk);
  else if (evt.type === "assistant_message_complete") ws.close();
  else if (evt.type === "error") console.error(evt);
};`)

const chatTokenExample = computed(() => `# Your backend (holds the API key) mints a short-lived token:
curl -X POST "${chatTokenUrl.value}" \\
  -H "Authorization: Bearer ${apiKey.value}"
# -> { "token": "…", "expires_in": 300 }   then hand "token" to the browser`)

const curlWh = computed(() => `curl -X POST "${webhookUrl.value}" \\
  -H "Authorization: Bearer ${apiKey.value}" \\
  -H "Content-Type: application/json" \\
  -d '{"signal_type":"order.created","payload":{"order_id":987}}'
# -> 202 { "signal_id": 123, "result_url": "/api/agents/${agentId.value}/signals/123/" }`)

const curlWhFlow = computed(() => `# Reuse the SAME flow_key every turn -> the agent keeps context.
curl -X POST "${webhookUrl.value}" \\
  -H "Authorization: Bearer ${apiKey.value}" \\
  -H "Content-Type: application/json" \\
  -d '{"signal_type":"chat.message","flow_key":"user-42","payload":{"message":"And what did I just ask?"}}'
# Same flow_key as the previous message -> remembers. New flow_key -> fresh chat.`)

const curlPoll = computed(() => `curl "${resultUrl.value}" \\
  -H "Authorization: Bearer ${apiKey.value}"
# -> { "status": "processed", "response": "…", "cost_usd": 0.0042,
#      "usage": { "prompt_tokens": …, "completion_tokens": …, "total_tokens": …,
#                 "cached_tokens": …, "cost_usd": …, "model": "…", "provider": "…" } }`)

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
    if (a.public_share_token) shareToken.value = a.public_share_token
    if (a.public_slug) publicSlug.value = a.public_slug
  } catch (e) {
    // not logged in / not found — guide still renders with placeholders
  }
})

// Inline helpers: copy-able URL row + code block.
const UrlRow = (p, { emit }) => h('div', { class: p.class }, [
  h('label', { class: 'block text-xs font-medium text-gray-500 mb-1' }, p.label),
  h('div', { class: 'flex gap-2' }, [
    h('code', { class: 'flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono truncate' }, p.value),
    h('button', { class: 'px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm', onClick: () => emit('copy', p.value, p.cid) }, p.copied === p.cid ? '✓' : '📋'),
  ]),
])
UrlRow.props = ['label', 'value', 'cid', 'copied', 'class']
UrlRow.emits = ['copy']

const CodeBlock = {
  props: ['code', 'id', 'copied'],
  emits: ['copy'],
  setup(props, { emit }) {
    return () => h('div', { class: 'relative' }, [
      h('button', {
        class: 'absolute top-2 right-2 text-xs px-2 py-1 bg-gray-700 text-gray-200 rounded hover:bg-gray-600',
        onClick: () => emit('copy', props.code, props.id),
      }, props.copied === props.id ? '✓ Copied' : 'Copy'),
      h('pre', { class: 'bg-gray-900 text-gray-100 rounded-xl p-4 overflow-x-auto text-xs leading-relaxed' }, h('code', null, props.code)),
    ])
  },
}
</script>

<style scoped>
.kbd { font-size: 0.7rem; background: #f3f4f6; padding: 0.05rem 0.3rem; border-radius: 0.25rem; }
</style>
