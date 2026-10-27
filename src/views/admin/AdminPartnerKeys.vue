<template>
  <div class="pk">
    <header class="pk-head">
      <div>
        <h1>Partner Agent API</h1>
        <p>Issue a bearer key to a partner so their app can create &amp; manage AI agents on-demand,
           inside that partner's own account and workspace. The key <strong>is</strong> the partner's
           identity — every agent it creates is owned by them.</p>
      </div>
      <router-link class="pk-btn" :to="{ name: 'admin-partner-guide' }">Integration guide</router-link>
    </header>

    <!-- Issue a key -->
    <section class="pk-card">
      <div class="pk-card-h">
        <h2>Issue a key</h2>
        <span class="pk-sub">Pick the partner user, then generate. The full key is shown only once.</span>
      </div>

      <div class="pk-gen">
        <!-- Partner picker -->
        <div class="pk-picker">
          <input
            v-model="userQuery"
            class="pk-input"
            type="text"
            placeholder="Search partner by name or email…"
            @input="onSearch"
            @focus="showResults = true" />
          <div v-if="showResults && userResults.length" class="pk-results">
            <button
              v-for="u in userResults"
              :key="u.id"
              class="pk-result"
              @click="selectUser(u)">
              <span class="pk-result-name">{{ u.username }}</span>
              <span class="pk-result-mail">{{ u.email }}</span>
            </button>
          </div>
        </div>

        <input v-model="newName" class="pk-input pk-name" type="text" maxlength="120"
               placeholder="Label (e.g. “Acme integration”)" />

        <button class="pk-btn primary" :disabled="generating || !selectedUser" @click="generate">
          {{ generating ? 'Generating…' : 'Generate key' }}
        </button>
      </div>

      <div v-if="selectedUser" class="pk-selected">
        Partner: <strong>{{ selectedUser.username }}</strong>
        <span class="pk-result-mail">{{ selectedUser.email }}</span>
        <button class="pk-btn ghost sm" @click="clearUser">Change</button>
      </div>

      <!-- Freshly created key (shown once) -->
      <div v-if="freshKey" class="pk-fresh">
        <div class="pk-fresh-label">New key — copy it now, it won't be shown again. Share it with the partner securely.</div>
        <div class="pk-fresh-row">
          <code class="pk-key">{{ freshKey }}</code>
          <button class="pk-btn" @click="copy(freshKey)">Copy</button>
          <button class="pk-btn ghost" @click="freshKey = ''">Dismiss</button>
        </div>
      </div>
    </section>

    <!-- Existing keys -->
    <section class="pk-card">
      <div class="pk-card-h"><h2>Keys</h2></div>
      <div v-if="loading" class="pk-empty">Loading…</div>
      <div v-else-if="!keys.length" class="pk-empty">No keys yet. Issue one above.</div>
      <div v-else class="pk-table-wrap">
      <table class="pk-table">
        <thead>
          <tr><th>Label</th><th>Partner</th><th>Key</th><th>Status</th><th class="pk-nowrap">Per-agent sign-ins</th><th>Requests</th><th>Last used</th><th>Created</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="k in keys" :key="k.id" :class="{ revoked: k.revoked }">
            <td>{{ k.name || '—' }}</td>
            <td>
              <div class="pk-partner">{{ k.user_label || '—' }}</div>
            </td>
            <td><code class="pk-hint">{{ k.key_hint || '••••' }}</code></td>
            <td>
              <span class="pk-pill" :class="k.revoked ? 'rev' : 'act'">{{ k.revoked ? 'Revoked' : 'Active' }}</span>
            </td>
            <td>
              <button
                type="button"
                role="switch"
                class="pk-switch"
                :class="{ on: k.is_partner_account }"
                :aria-checked="k.is_partner_account ? 'true' : 'false'"
                :aria-label="`Per-agent sign-ins for ${k.user_label || 'this partner'}`"
                :disabled="switching === k.user_id"
                @click="flipPartnerSwitch(k)">
                <span class="pk-switch-knob" />
              </button>
              <span class="pk-switch-text">{{ k.is_partner_account ? 'On' : 'Off' }}</span>
            </td>
            <td>{{ k.request_count?.toLocaleString?.() ?? k.request_count }}</td>
            <td>{{ fmt(k.last_used_at) }}</td>
            <td>{{ fmt(k.created_at) }}</td>
            <td class="pk-actions">
              <button class="pk-btn sm" @click="openOrigins(k)">
                Return addresses{{ k.allowed_return_origins?.length ? ` (${k.allowed_return_origins.length})` : '' }}
              </button>
              <button class="pk-btn sm" @click="rotate(k)">Rotate</button>
              <button v-if="!k.revoked" class="pk-btn sm" @click="toggle(k, true)">Revoke</button>
              <button v-else class="pk-btn sm" @click="toggle(k, false)">Reactivate</button>
              <button class="pk-btn danger sm" @click="remove(k)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </section>

    <!-- Quick-start -->
    <section class="pk-card">
      <div class="pk-card-h">
        <h2>Quick start (for the partner)</h2>
        <router-link class="pk-btn" :to="{ name: 'admin-partner-guide' }">Open the full guide</router-link>
      </div>
      <div class="pk-quick">
        <div><span class="pk-q-k">Base URL</span><code>{{ baseUrl }}</code></div>
        <div><span class="pk-q-k">Auth header</span><code>Authorization: Bearer &lt;key&gt;</code></div>
      </div>
      <ol class="pk-steps">
        <li><strong>Create</strong> — <code>POST {{ baseUrl }}</code> with <code>{"name":"…","prompt":"…","workspace_name":"…"}</code>.</li>
        <li><strong>List</strong> — <code>GET {{ baseUrl }}</code> → the partner's own agents.</li>
        <li><strong>Manage</strong> — <code>GET/PATCH/DELETE {{ baseUrl }}&lt;id&gt;/</code>, plus <code>/pause/</code> &amp; <code>/unpause/</code>.</li>
      </ol>
      <p class="pk-mini">Agents are owned by the partner's account. <code>workspace_name</code> places the agent
        in a named workspace (created if new); omit it to use the partner's default workspace.</p>

      <h3 class="pk-sub-h">Connect a connector for one agent, without the chat</h3>
      <p class="pk-mini">For a partner with per-agent sign-ins on. The partner asks for a sign-in link, opens it in
        the store owner's browser, and the sign-in is saved for that agent only.</p>
      <div class="pk-copy-rows">
        <div v-for="row in connectRows" :key="row.label" class="pk-copy-row">
          <span class="pk-q-k">{{ row.label }}</span>
          <code class="pk-copy-code">{{ row.text }}</code>
          <button class="pk-btn sm" :aria-label="`Copy: ${row.label}`" @click="copy(row.text)">Copy</button>
        </div>
      </div>
      <p class="pk-mini">Send <code>return_url</code> to bring the browser back to the partner's page afterwards
        (with <code>connect_id</code> and <code>connected=1</code> or <code>0</code>). It must match one of the key's
        <strong>Return addresses</strong>. <router-link :to="{ name: 'admin-partner-guide', hash: '#signing-in-from-your-own-page-without-the-chat' }">See the full example</router-link>.</p>
    </section>

    <!-- Return addresses for one key -->
    <div v-if="originsKey" class="pk-drawer-mask pk-center" @click.self="closeOrigins" @keydown.esc="closeOrigins">
      <section class="pk-modal" role="dialog" aria-modal="true" aria-labelledby="pk-origins-title">
        <h3 id="pk-origins-title">Return addresses for “{{ originsKey.name || originsKey.key_hint }}”</h3>
        <p class="pk-mini">
          After a store signs in from a link this key asked for, the browser goes back to the partner's page.
          Only these addresses are accepted. One per line, like <code>https://shop.example.com</code> or
          <code>https://*.example.com</code> for every subdomain. Leave empty to accept none.
        </p>
        <label class="pk-q-k" for="pk-origins-input">Addresses</label>
        <textarea id="pk-origins-input" ref="originsInput" v-model="originsText" class="pk-input pk-textarea"
                  rows="5" spellcheck="false" placeholder="https://*.example.com" />
        <p v-if="originsError" class="pk-error" role="alert">{{ originsError }}</p>
        <div class="pk-modal-actions">
          <button class="pk-btn ghost" @click="closeOrigins">Cancel</button>
          <button class="pk-btn primary" :disabled="savingOrigins" @click="saveOrigins">
            {{ savingOrigins ? 'Saving…' : 'Save addresses' }}
          </button>
        </div>
      </section>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import api from '../../services/api'
import { notify } from '../../composables/useNotify'
import { confirm } from '../../composables/useConfirm'

const keys = ref([])
const baseUrl = ref('/api/partner/agents/')
const loading = ref(true)
const generating = ref(false)
const newName = ref('')
const freshKey = ref('')

// Partner picker
const userQuery = ref('')
const userResults = ref([])
const selectedUser = ref(null)
const showResults = ref(false)
let searchTimer = null


function fmt(ts) {
  if (!ts) return '—'
  try { return new Date(ts).toLocaleString() } catch { return ts }
}

async function load() {
  loading.value = true
  try {
    const { data } = await api.getPartnerKeys()
    keys.value = data.keys || []
    if (data.base_url) baseUrl.value = data.base_url
  } catch (e) {
    notify.error('Failed to load partner keys: ' + (e.response?.data?.detail || e.message))
  } finally {
    loading.value = false
  }
}

function onSearch() {
  selectedUser.value = null
  clearTimeout(searchTimer)
  const q = userQuery.value.trim()
  if (!q) { userResults.value = []; return }
  searchTimer = setTimeout(async () => {
    try {
      const { data } = await api.searchPartnerUsers(q)
      userResults.value = data.users || []
      showResults.value = true
    } catch { userResults.value = [] }
  }, 250)
}

function selectUser(u) {
  selectedUser.value = u
  userQuery.value = ''
  userResults.value = []
  showResults.value = false
}

function clearUser() {
  selectedUser.value = null
  userQuery.value = ''
}

async function generate() {
  if (!selectedUser.value) return
  generating.value = true
  try {
    const { data } = await api.createPartnerKey(selectedUser.value.id, newName.value.trim())
    freshKey.value = data.key
    newName.value = ''
    selectedUser.value = null
    notify.success('Key generated — copy it now')
    await load()
  } catch (e) {
    notify.error('Failed to generate: ' + (e.response?.data?.detail || e.response?.data?.error || e.message))
  } finally {
    generating.value = false
  }
}

async function toggle(k, revoked) {
  if (revoked) {
    const ok = await confirm({
      title: 'Revoke this key?',
      message: `“${k.name || k.key_hint}” will stop working immediately.`,
      confirmText: 'Revoke',
      danger: true,
    })
    if (!ok) return
  }
  try {
    await api.togglePartnerKey(k.id, revoked)
    notify.success(revoked ? 'Key revoked' : 'Key reactivated')
    await load()
  } catch (e) {
    notify.error('Failed: ' + (e.response?.data?.detail || e.message))
  }
}

async function rotate(k) {
  const ok = await confirm({
    title: 'Rotate this key?',
    message: `A new secret is issued and “${k.name || k.key_hint}” stops working immediately. Share the new value with the partner.`,
    confirmText: 'Rotate',
    danger: true,
  })
  if (!ok) return
  try {
    const { data } = await api.rotatePartnerKey(k.id)
    freshKey.value = data.key
    notify.success('Key rotated — copy the new value now')
    await load()
  } catch (e) {
    notify.error('Failed to rotate: ' + (e.response?.data?.detail || e.message))
  }
}

async function remove(k) {
  const ok = await confirm({
    title: 'Delete this key?',
    message: `“${k.name || k.key_hint}” will be permanently removed. This cannot be undone.`,
    confirmText: 'Delete',
    danger: true,
  })
  if (!ok) return
  try {
    await api.deletePartnerKey(k.id)
    notify.success('Key deleted')
    await load()
  } catch (e) {
    notify.error('Failed to delete: ' + (e.response?.data?.detail || e.message))
  }
}

// Own sign-ins per agent (ADM-1082). The switch belongs to the partner's account, so every key of that
// partner shows the same state.
const switching = ref(null)

async function flipPartnerSwitch(k) {
  const who = k.user_label || 'this partner'
  const turnOn = !k.is_partner_account
  const ok = await confirm(turnOn ? {
    title: `Give each of ${who}'s agents its own sign-ins?`,
    message: `Each agent will use only the connector sign-ins and keys saved for it. Sign-ins saved on ${who}'s `
      + 'own account stop reaching the agents, so each store signs in again.',
    confirmText: 'Turn on',
  } : {
    title: `Share sign-ins across ${who}'s agents again?`,
    message: `Every agent will use ${who}'s own sign-ins again, as on a normal account. `
      + 'Sign-ins saved for one agent stay with that agent.',
    confirmText: 'Turn off',
    danger: true,
  })
  if (!ok) return
  switching.value = k.user_id
  try {
    await api.setPartnerAccountSwitch(k.user_id, turnOn)
    notify.success(turnOn ? 'Per-agent sign-ins turned on' : 'Per-agent sign-ins turned off')
    await load()
  } catch (e) {
    notify.error('Could not change the switch: ' + (e.response?.data?.detail || e.message))
  } finally {
    switching.value = null
  }
}

// Return addresses for one key.
const originsKey = ref(null)
const originsText = ref('')
const originsError = ref('')
const savingOrigins = ref(false)
const originsInput = ref(null)

async function openOrigins(k) {
  originsKey.value = k
  originsText.value = (k.allowed_return_origins || []).join('\n')
  originsError.value = ''
  await nextTick()
  originsInput.value?.focus()
}

function closeOrigins() {
  originsKey.value = null
}

async function saveOrigins() {
  const origins = originsText.value.split('\n').map((s) => s.trim()).filter(Boolean)
  savingOrigins.value = true
  originsError.value = ''
  try {
    await api.setPartnerReturnOrigins(originsKey.value.id, origins)
    notify.success('Return addresses saved')
    closeOrigins()
    await load()
  } catch (e) {
    originsError.value = e.response?.data?.detail || e.message
  } finally {
    savingOrigins.value = false
  }
}

// The per-agent connect routes (ADM-1082), as full addresses on this site so a copy can be sent as it is.
const connectRows = computed(() => {
  const base = `${window.location.origin}${baseUrl.value}<agent_id>/connections/`
  return [
    { label: 'List connectors', text: `GET ${base}` },
    { label: 'Get a sign-in link', text: `POST ${base}connect/  {"target_kind": "app", "target_id": 17, "return_url": "https://…"}` },
    { label: 'Check one sign-in', text: `GET ${base}status/?connect_id=<connect_id>` },
    { label: 'Remove a sign-in', text: `DELETE ${base}<target_kind>/<target_id>/` },
  ]
})

function copy(text) {
  try { navigator.clipboard.writeText(text); notify.success('Copied') } catch { /* noop */ }
}

onMounted(load)
</script>

<style scoped>
.pk { padding: 32px 36px; max-width: 1100px; }
.pk-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.pk-head h1 { font-size: 24px; font-weight: 800; color: #0f172a; }
.pk-head p { color: #64748b; margin-top: 6px; font-size: 14px; max-width: 680px; line-height: 1.5; }

.pk-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin-top: 20px; }
.pk-card-h { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; }
.pk-card-h h2 { font-size: 15px; font-weight: 700; color: #0f172a; }
.pk-sub { font-size: 12px; color: #94a3b8; }

.pk-gen { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-start; }
.pk-picker { position: relative; flex: 1; min-width: 260px; }
.pk-input { width: 100%; border: 1px solid #cbd5e1; border-radius: 9px; padding: 9px 12px; font-size: 14px; color: #0f172a; }
.pk-input:focus { outline: none; border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,.12); }
.pk-name { flex: 1; min-width: 200px; }
.pk-results { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 20; background: #fff;
  border: 1px solid #e2e8f0; border-radius: 10px; box-shadow: 0 8px 24px rgba(15,23,42,.12); max-height: 260px; overflow-y: auto; }
.pk-result { display: flex; flex-direction: column; gap: 2px; width: 100%; text-align: left; padding: 9px 12px;
  border: none; background: none; cursor: pointer; border-bottom: 1px solid #f1f5f9; }
.pk-result:hover { background: #f8fafc; }
.pk-result-name { font-size: 13px; font-weight: 600; color: #0f172a; }
.pk-result-mail { font-size: 12px; color: #94a3b8; }
.pk-selected { margin-top: 12px; font-size: 13px; color: #334155; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

.pk-btn { border: 1px solid #cbd5e1; background: #fff; color: #334155; border-radius: 9px; padding: 8px 14px;
  font-size: 13px; font-weight: 600; cursor: pointer; transition: all .15s; white-space: nowrap;
  display: inline-block; text-decoration: none; }
.pk-btn:hover { border-color: #94a3b8; }
.pk-btn.primary { background: #4f46e5; border-color: #4f46e5; color: #fff; }
.pk-btn.primary:hover { background: #4338ca; }
.pk-btn.primary:disabled { opacity: .5; cursor: default; }
.pk-btn.danger { color: #dc2626; border-color: #fecaca; }
.pk-btn.danger:hover { background: #fef2f2; }
.pk-btn.ghost { border-color: transparent; color: #64748b; }
.pk-btn.sm { padding: 5px 10px; font-size: 12px; }

.pk-fresh { margin-top: 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 11px; padding: 14px; }
.pk-fresh-label { font-size: 12px; font-weight: 700; color: #15803d; margin-bottom: 8px; }
.pk-fresh-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.pk-key { flex: 1; min-width: 280px; background: #052e16; color: #86efac; padding: 9px 12px; border-radius: 8px;
  font-family: ui-monospace, monospace; font-size: 13px; word-break: break-all; }

.pk-table-wrap { overflow-x: auto; }
.pk-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.pk-table th { text-align: left; color: #64748b; font-weight: 600; font-size: 11px; text-transform: uppercase;
  letter-spacing: .03em; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
.pk-table td { padding: 10px; border-bottom: 1px solid #f1f5f9; color: #334155; }
.pk-table tr.revoked { opacity: .55; }
.pk-partner { font-size: 13px; color: #334155; }
.pk-hint { font-family: ui-monospace, monospace; color: #475569; }
.pk-pill { font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 999px; }
.pk-pill.act { background: #dcfce7; color: #15803d; }
.pk-pill.rev { background: #f1f5f9; color: #94a3b8; }
.pk-actions { text-align: right; min-width: 230px; }
.pk-actions .pk-btn { margin: 3px 0 3px 6px; }
.pk-empty { color: #94a3b8; font-size: 13px; padding: 12px 4px; }

.pk-quick { display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 14px; }
.pk-q-k { display: block; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: .03em; margin-bottom: 4px; }
.pk-quick code { font-family: ui-monospace, monospace; font-size: 13px; color: #0f172a; background: #f1f5f9; padding: 3px 8px; border-radius: 6px; }
.pk-steps { margin: 0 0 12px; padding-left: 20px; color: #334155; font-size: 13px; line-height: 1.9; }
.pk-steps code { font-family: ui-monospace, monospace; font-size: 12px; background: #f1f5f9; padding: 2px 6px; border-radius: 5px; color: #0f172a; }
.pk-mini { font-size: 12px; color: #64748b; line-height: 1.7; }
.pk-sub-h { font-size: 13px; font-weight: 700; color: #0f172a; margin: 18px 0 4px; }
.pk-copy-rows { display: flex; flex-direction: column; gap: 8px; margin: 10px 0; }
.pk-copy-row { display: grid; grid-template-columns: 140px 1fr auto; gap: 10px; align-items: center; }
.pk-copy-row .pk-q-k { margin-bottom: 0; }
.pk-copy-code { font-family: ui-monospace, monospace; font-size: 12px; color: #0f172a; background: #f1f5f9;
  padding: 6px 8px; border-radius: 6px; word-break: break-all; }
@media (max-width: 640px) { .pk-copy-row { grid-template-columns: 1fr auto; } .pk-copy-row .pk-q-k { grid-column: 1 / -1; } }
.pk-mini code { font-family: ui-monospace, monospace; background: #f8fafc; padding: 1px 5px; border-radius: 4px; }

.pk-switch { position: relative; width: 36px; height: 20px; border-radius: 999px; border: 1px solid #cbd5e1;
  background: #e2e8f0; cursor: pointer; vertical-align: middle; transition: background-color .15s, border-color .15s; }
.pk-switch.on { background: #4f46e5; border-color: #4f46e5; }
.pk-switch:disabled { opacity: .5; cursor: default; }
.pk-switch:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(79,70,229,.25); }
.pk-switch-knob { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff;
  box-shadow: 0 1px 2px rgba(15,23,42,.2); transition: transform .15s; }
.pk-switch.on .pk-switch-knob { transform: translateX(16px); }
.pk-switch-text { margin-left: 8px; font-size: 12px; color: #475569; }
.pk-table th.pk-nowrap { white-space: nowrap; }
.pk-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(79,70,229,.25); }
@media (prefers-reduced-motion: reduce) { .pk-switch, .pk-switch-knob { transition: none; } }

.pk-drawer-mask.pk-center { justify-content: center; align-items: center; padding: 16px; }
.pk-modal { width: min(520px, 100%); background: #fff; border-radius: 14px; padding: 22px; box-shadow: 0 16px 40px rgba(15,23,42,.2); }
.pk-modal h3 { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
.pk-modal .pk-mini { margin-bottom: 14px; }
.pk-textarea { font-family: ui-monospace, monospace; font-size: 13px; resize: vertical; }
.pk-error { margin-top: 8px; font-size: 12px; color: #dc2626; }
.pk-modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }

.pk-drawer-mask { position: fixed; inset: 0; background: rgba(15,23,42,.4); z-index: 50; display: flex; justify-content: flex-end; }
</style>
