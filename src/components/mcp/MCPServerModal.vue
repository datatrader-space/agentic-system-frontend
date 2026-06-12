<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="px-6 py-5 border-b border-slate-100 flex justify-between items-start">
        <div>
          <h2 class="text-lg font-bold text-slate-900">{{ isEditMode ? 'Edit' : 'Add a' }} tool server</h2>
          <p class="text-[13px] text-slate-500 mt-0.5">Connect an MCP server to give your agents more tools.</p>
        </div>
        <button @click="$emit('close')" class="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
      </div>

      <div class="p-6 space-y-5">
        <!-- Step 1: choose type -->
        <div>
          <label class="block text-[13px] font-semibold text-slate-700 mb-2">How do you connect to it?</label>
          <div class="grid grid-cols-2 gap-3">
            <button type="button" @click="form.mode = 'hosted'"
              class="text-left px-4 py-3 rounded-xl border-2 transition-colors"
              :class="form.mode === 'hosted' ? 'border-indigo-500 bg-indigo-50/40' : 'border-slate-200 hover:border-slate-300'">
              <div class="text-[13px] font-semibold text-slate-800">🌐 Hosted (URL)</div>
              <div class="text-[11px] text-slate-500 mt-0.5">A server you reach over the web.</div>
            </button>
            <button type="button" @click="form.mode = 'local'"
              class="text-left px-4 py-3 rounded-xl border-2 transition-colors"
              :class="form.mode === 'local' ? 'border-indigo-500 bg-indigo-50/40' : 'border-slate-200 hover:border-slate-300'">
              <div class="text-[13px] font-semibold text-slate-800">💻 Local program</div>
              <div class="text-[11px] text-slate-500 mt-0.5">Runs a command on the server. Advanced.</div>
            </button>
          </div>
        </div>

        <!-- Name -->
        <div>
          <label class="block text-[13px] font-semibold text-slate-700 mb-1">Name</label>
          <input v-model="form.name" type="text" placeholder="e.g. My Company API"
            class="w-full px-3 py-2 text-[14px] border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none">
        </div>

        <!-- Hosted path -->
        <template v-if="form.mode === 'hosted'">
          <div>
            <label class="block text-[13px] font-semibold text-slate-700 mb-1">Server URL</label>
            <input v-model="form.endpoint_url" type="url" placeholder="https://example.com/mcp"
              class="w-full px-3 py-2 text-[14px] border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none font-mono">
          </div>

          <!-- Auth -->
          <div>
            <label class="block text-[13px] font-semibold text-slate-700 mb-1">Does it need a key?</label>
            <select v-model="form.auth.type" @change="headersTouched = true"
              class="w-full px-3 py-2 text-[14px] border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none bg-white">
              <option value="none">No — it's open</option>
              <option value="bearer">Bearer token</option>
              <option value="api_key">API key (header)</option>
              <option value="custom">Custom header</option>
            </select>
            <p v-if="isEditMode && form.auth.type === 'none'" class="text-[11px] text-slate-400 mt-1">
              Existing credentials are kept unless you choose a type and enter a new value.
            </p>
            <div v-if="form.auth.type !== 'none'" class="mt-2 space-y-2">
              <input v-if="form.auth.type === 'api_key' || form.auth.type === 'custom'"
                v-model="form.auth.header_name" @input="headersTouched = true" type="text"
                :placeholder="form.auth.type === 'api_key' ? 'Header name (e.g. X-API-Key)' : 'Header name (e.g. Authorization)'"
                class="w-full px-3 py-2 text-[14px] border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none font-mono">
              <input v-model="form.auth.token" @input="headersTouched = true" type="password"
                placeholder="Paste the token / key"
                class="w-full px-3 py-2 text-[14px] border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none font-mono">
            </div>
          </div>

          <!-- Extra headers — for things like ngrok-skip-browser-warning that must be sent on every
               request (in addition to auth). -->
          <div>
            <label class="block text-[13px] font-semibold text-slate-700 mb-1">
              Extra headers <span class="text-[11px] font-normal text-slate-400">— optional</span>
            </label>
            <p class="text-[11px] text-slate-400 mb-2 leading-snug">
              Sent on every request. Use this for things like
              <code class="bg-slate-100 px-1 rounded">ngrok-skip-browser-warning</code> = <code class="bg-slate-100 px-1 rounded">true</code>.
            </p>
            <div v-for="(row, i) in form.extraHeaders" :key="i" class="flex gap-2 mb-2">
              <input v-model="row.name" @input="headersTouched = true" type="text" placeholder="Header name"
                class="flex-1 px-3 py-2 text-[13px] border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-mono">
              <input v-model="row.value" @input="headersTouched = true" type="text" placeholder="value"
                class="flex-1 px-3 py-2 text-[13px] border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-mono">
              <button type="button" @click="form.extraHeaders.splice(i, 1); headersTouched = true" class="px-2 text-slate-400 hover:text-red-500">✕</button>
            </div>
            <button type="button" @click="form.extraHeaders.push({ name: '', value: '' }); headersTouched = true"
              class="text-[12px] font-semibold text-indigo-600 hover:text-indigo-700">+ Add header</button>
          </div>
        </template>

        <!-- Local path -->
        <template v-else>
          <div>
            <label class="block text-[13px] font-semibold text-slate-700 mb-1">Command</label>
            <input v-model="form.command" type="text" placeholder="npx"
              class="w-full px-3 py-2 text-[14px] border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none font-mono">
            <p class="text-[11px] text-slate-400 mt-1">The program to run, e.g. <code class="bg-slate-100 px-1 rounded">npx</code>, <code class="bg-slate-100 px-1 rounded">uvx</code>, <code class="bg-slate-100 px-1 rounded">python</code>.</p>
          </div>
          <div>
            <label class="block text-[13px] font-semibold text-slate-700 mb-1">Arguments</label>
            <textarea v-model="argsText" rows="3" placeholder="-y&#10;@modelcontextprotocol/server-github"
              class="w-full px-3 py-2 text-[13px] border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none font-mono"></textarea>
            <p class="text-[11px] text-slate-400 mt-1">One per line.</p>
          </div>
          <!-- Simple env vars (key/value) -->
          <div>
            <label class="block text-[13px] font-semibold text-slate-700 mb-1">Keys &amp; secrets <span class="text-[11px] font-normal text-slate-400">— optional</span></label>
            <div v-for="(row, i) in form.envVars" :key="i" class="flex gap-2 mb-2">
              <input v-model="row.key" type="text" placeholder="GITHUB_TOKEN"
                class="flex-1 px-3 py-2 text-[13px] border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-mono">
              <input v-model="row.value" type="password" placeholder="value"
                class="flex-1 px-3 py-2 text-[13px] border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-mono">
              <button type="button" @click="form.envVars.splice(i, 1)" class="px-2 text-slate-400 hover:text-red-500">✕</button>
            </div>
            <button type="button" @click="form.envVars.push({ key: '', value: '' })" class="text-[12px] font-semibold text-indigo-600 hover:text-indigo-700">+ Add</button>
          </div>
        </template>

        <!-- Description (optional, both) -->
        <div>
          <label class="block text-[13px] font-semibold text-slate-700 mb-1">What is it for? <span class="text-[11px] font-normal text-slate-400">— optional</span></label>
          <input v-model="form.description" type="text" placeholder="Short description"
            class="w-full px-3 py-2 text-[14px] border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none">
        </div>

        <!-- Result -->
        <div v-if="testResult" class="p-3 rounded-xl text-[13px]"
          :class="testResult.success ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'">
          <p class="font-semibold" :class="testResult.success ? 'text-emerald-800' : 'text-red-800'">
            {{ testResult.success ? '✓ Connected' : '✗ Could not connect' }}
          </p>
          <p :class="testResult.success ? 'text-emerald-700' : 'text-red-700'">{{ testResult.message }}</p>
          <ul v-if="testResult.remediation?.steps" class="list-disc ml-4 mt-1 text-red-600 text-[12px]">
            <li v-for="(s, i) in testResult.remediation.steps" :key="i">{{ s }}</li>
          </ul>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
        <template v-if="savedOk">
          <button @click="finish" class="px-5 py-2 bg-slate-900 text-white rounded-lg text-[13px] font-semibold hover:bg-slate-800">Done</button>
        </template>
        <template v-else>
          <button @click="$emit('close')" class="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg text-[13px] font-semibold hover:bg-slate-200">Cancel</button>
          <button @click="handleSubmit" :disabled="saving || !canSave"
            class="px-5 py-2 bg-indigo-600 text-white rounded-lg text-[13px] font-semibold hover:bg-indigo-700 disabled:opacity-50">
            {{ saving ? 'Connecting…' : (isEditMode ? 'Save changes' : 'Add server') }}
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed } from 'vue'
import api from '../../services/api'
import { notify } from '@/composables/useNotify'

// Reverse-map an existing env_config (when present) into the friendly auth picker.
function deriveAuth(env) {
  for (const [k, v] of Object.entries(env || {})) {
    if (k.toLowerCase() === 'authorization') {
      if (typeof v === 'string' && v.startsWith('Bearer ')) return { type: 'bearer', token: '', header_name: '' }
      return { type: 'custom', header_name: 'Authorization', token: '' }
    }
    if (k.toUpperCase().startsWith('HEADER_')) return { type: 'api_key', header_name: k.slice(7), token: '' }
  }
  return { type: 'none', token: '', header_name: '' }
}

export default {
  name: 'MCPServerModal',
  props: { server: { type: Object, default: null } },
  emits: ['close', 'saved'],
  setup(props, { emit }) {
    const saving = ref(false)
    const savedOk = ref(false)
    const testResult = ref(null)
    const headersTouched = ref(false)
    const isEditMode = computed(() => !!props.server)

    const s = props.server || {}
    const form = reactive({
      mode: (s.transport_type === 'stdio') ? 'local' : 'hosted',
      name: s.name || '',
      description: s.description || '',
      endpoint_url: s.endpoint_url || '',
      command: s.command || '',
      auth: deriveAuth(s.env_config),
      // Extra request headers (hosted) beyond the single auth header. The FIRST HEADER_*/Authorization
      // is treated as auth (deriveAuth); any others would be extra — but env_config isn't returned in
      // the safe dict, so on edit these start empty and are re-entered if changed.
      extraHeaders: [],
      envVars: Object.entries(s.env_config || {})
        .filter(([k]) => k.toLowerCase() !== 'authorization' && !k.toUpperCase().startsWith('HEADER_'))
        .map(([key, value]) => ({ key, value: '' })),
    })

    const argsText = computed({
      get: () => (Array.isArray(s.args) && !form._argsEdited ? s.args.join('\n') : (form._argsRaw ?? '')),
      set: (val) => { form._argsRaw = val; form._argsEdited = true },
    })
    const argsArray = () => (form._argsEdited ? (form._argsRaw || '') : (Array.isArray(s.args) ? s.args.join('\n') : ''))
      .split('\n').map(a => a.trim()).filter(Boolean)

    const canSave = computed(() =>
      form.name.trim() && (form.mode === 'hosted' ? form.endpoint_url.trim() : form.command.trim()))

    function buildPayload() {
      if (form.mode === 'hosted') {
        const p = { name: form.name, description: form.description, transport_type: 'http', endpoint_url: form.endpoint_url }
        // Only send headers when the user set/changed them (so editing doesn't wipe stored ones).
        // auth + extra_headers are sent together as the full header set.
        if (!isEditMode.value || headersTouched.value) {
          p.auth = { type: form.auth.type, token: form.auth.token, header_name: form.auth.header_name }
          p.extra_headers = form.extraHeaders
            .filter(h => h.name.trim() && h.value)
            .map(h => ({ name: h.name.trim(), value: h.value }))
        }
        return p
      }
      const env = {}
      form.envVars.forEach(r => { if (r.key.trim() && r.value) env[r.key.trim()] = r.value })
      return { name: form.name, description: form.description, transport_type: 'stdio',
               command: form.command, args: argsArray(), env_config: env }
    }

    async function handleSubmit() {
      saving.value = true
      testResult.value = null
      try {
        const payload = buildPayload()
        let serverId = props.server?.id
        if (isEditMode.value) {
          await api.updateMCPServer(serverId, payload)
        } else {
          const res = await api.createMCPServer(payload)
          serverId = res.data?.server?.id
        }
        savedOk.value = true
        // Verify + discover tools so the user sees it worked.
        if (serverId) {
          try {
            const t = await api.testMCPConnection(serverId)
            const d = t.data || {}
            const n = d.tools_count ?? (Array.isArray(d.tools) ? d.tools.length : 0)
            testResult.value = d.success !== false
              ? { success: true, message: `${n} tool${n === 1 ? '' : 's'} found.` }
              : { success: false, message: d.error || 'Saved, but the connection test failed.', remediation: d.remediation }
          } catch (e) {
            const d = e.response?.data || {}
            testResult.value = { success: false, message: d.error || e.message, remediation: d.remediation }
          }
        }
        notify.success(isEditMode.value ? 'Server updated' : 'Server added')
      } catch (error) {
        notify.error('Failed to save: ' + (error.response?.data?.error || error.message))
      } finally {
        saving.value = false
      }
    }

    const finish = () => { emit('saved'); emit('close') }

    return { form, argsText, saving, savedOk, testResult, headersTouched, isEditMode, canSave, handleSubmit, finish }
  }
}
</script>
