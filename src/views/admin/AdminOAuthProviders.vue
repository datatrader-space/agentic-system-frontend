<template>
  <div class="op admin-page">
    <header class="op-head admin-page-header">
      <div>
        <h1 class="admin-page-title">OAuth Providers</h1>
        <p>The sign-in apps connectors use, one per provider for the whole platform: each person signs in with their
          own account through them. A client secret is stored encrypted and is never shown again.</p>
      </div>
      <button class="btn primary" @click="router.push('/admin-dashboard/oauth-providers/new')"><Icon icon="lucide:plus" /> Add provider</button>
    </header>

    <section class="card admin-surface">
      <div v-if="loading" class="state">Loading…</div>
      <div v-else-if="error" class="state err" role="alert">Couldn’t load the providers. <button class="link" @click="load">Try again</button></div>
      <div v-else-if="!rows.length" class="state">No OAuth providers yet. <button class="link" @click="router.push('/admin-dashboard/oauth-providers/new')">Add one</button>.</div>
      <div class="admin-table-scroll" v-else><table class="tbl admin-table">
        <thead><tr><th>Provider</th><th>Used by</th><th>Sign-ins</th><th>Client</th><th>Status</th><th class="r">Actions</th></tr></thead>
        <tbody>
          <tr v-for="p in rows" :key="p.slug" :data-provider="p.slug">
            <td>
              <div class="name">
                <span class="logo" aria-hidden="true">
                  <Icon v-if="isIconName(p.icon)" :icon="p.icon" />
                  <img v-else-if="isImage(p.icon)" :src="p.icon" alt="" />
                  <b v-else>{{ (p.name || '?').charAt(0) }}</b>
                </span>
                <div><strong>{{ p.name }}</strong><div class="sub admin-muted">{{ p.slug }} · {{ p.category || 'general' }}</div></div>
              </div>
            </td>
            <td>
              <span v-if="!(p.services || []).length" class="muted admin-muted">No connector</span>
              <span v-else class="used">{{ p.services.map(s => s.name).join(', ') }}</span>
            </td>
            <td class="muted admin-muted">{{ p.connection_count ?? 0 }}</td>
            <td><span :class="['pill', p.has_credentials ? 'on' : 'warn']">{{ p.has_credentials ? 'Set' : 'Missing' }}</span></td>
            <td><span :class="['pill', p.enabled ? 'on' : 'off']">{{ p.enabled ? 'Enabled' : 'Disabled' }}</span></td>
            <td class="actions">
              <button class="ic" title="Set the client ID and secret" :aria-label="`Set the client for ${p.name}`" @click="openClient(p)"><Icon icon="lucide:key-round" /></button>
              <button class="ic" title="Edit" :aria-label="`Edit ${p.name}`" @click="openEdit(p)"><Icon icon="lucide:pencil" /></button>
              <button class="ic" :title="p.enabled ? 'Disable' : 'Enable'" :aria-label="`${p.enabled ? 'Disable' : 'Enable'} ${p.name}`"
                      :disabled="busy === p.slug" @click="toggle(p)"><Icon :icon="p.enabled ? 'lucide:eye-off' : 'lucide:eye'" /></button>
              <button class="ic danger" title="Delete" :aria-label="`Delete ${p.name}`" @click="confirmRow = p"><Icon icon="lucide:trash-2" /></button>
            </td>
          </tr>
        </tbody>
      </table></div>
    </section>

    <!-- Edit -->
    <div v-if="editing" class="backdrop admin-overlay" @click.self="editing = null" @keydown.esc.stop.prevent="editing = null">
      <form class="drawer admin-dialog" role="dialog" aria-modal="true" aria-labelledby="op-edit-title" @submit.prevent="saveEdit">
        <header class="d-head"><h2 id="op-edit-title" class="admin-section-title">Edit {{ editing.name }}</h2>
          <button type="button" class="ic" aria-label="Close" @click="editing = null"><Icon icon="lucide:x" /></button></header>
        <div class="d-body">
          <label for="op-name">Name<input id="op-name" v-model="form.name" required /></label>
          <label for="op-category">Category<input id="op-category" v-model="form.category" /></label>
          <label for="op-auth">Authorization URL<input id="op-auth" v-model="form.authorization_url" required /></label>
          <label for="op-token">Token URL<input id="op-token" v-model="form.token_url" required /></label>
          <label for="op-userinfo">User info URL<input id="op-userinfo" v-model="form.userinfo_url" /></label>
          <label for="op-revoke">Revocation URL<input id="op-revoke" v-model="form.revocation_url" /></label>
          <label for="op-base">API base template<input id="op-base" v-model="form.api_base_template" placeholder="https://api.example.com/{cloud_id}" /></label>
          <fieldset class="scopes">
            <legend>Scopes <small>Only the ones marked Default are requested at sign-in.</small></legend>
            <div v-for="(s, i) in scopes" :key="i" class="scope-row">
              <input v-model="s.scope" :aria-label="`Scope ${i + 1}`" placeholder="read" />
              <input v-model="s.label" :aria-label="`Scope ${i + 1} label`" placeholder="What it allows" />
              <select v-model="s.risk" :aria-label="`Scope ${i + 1} risk`"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="read">Read</option></select>
              <label class="chk"><input v-model="s.default" type="checkbox" /> Default</label>
              <button type="button" class="ic" :aria-label="`Remove scope ${i + 1}`" @click="scopes.splice(i, 1)"><Icon icon="lucide:x" /></button>
            </div>
            <button type="button" class="link" @click="scopes.push({ scope: '', label: '', risk: 'low', default: false })"><Icon icon="lucide:plus" /> Add scope</button>
          </fieldset>
          <label for="op-extra">Extra authorization parameters (JSON)<textarea id="op-extra" v-model="extraJson" rows="3" spellcheck="false" placeholder='{"prompt": "consent"}'></textarea></label>
          <p v-if="editError" class="form-err" role="alert">{{ editError }}</p>
        </div>
        <footer class="m-actions"><button type="button" class="btn ghost" @click="editing = null">Cancel</button>
          <button class="btn primary" :disabled="saving">{{ saving ? 'Saving…' : 'Save' }}</button></footer>
      </form>
    </div>

    <!-- Client ID and secret -->
    <div v-if="clientFor" class="backdrop center admin-overlay" @click.self="clientFor = null" @keydown.esc.stop.prevent="clientFor = null">
      <form class="modal admin-dialog" role="dialog" aria-modal="true" aria-labelledby="op-client-title" @submit.prevent="saveClient">
        <h2 id="op-client-title" class="admin-section-title">{{ clientFor.name }} client</h2>
        <p>From the app registered with {{ clientFor.name }}. Saving replaces the current client and enables the provider.</p>
        <label for="op-cid">Client ID<input id="op-cid" v-model="client.client_id" autocomplete="off" spellcheck="false" required /></label>
        <label for="op-csecret">Client secret<input id="op-csecret" v-model="client.client_secret" type="password" autocomplete="new-password" required /></label>
        <p v-if="clientError" class="form-err" role="alert">{{ clientError }}</p>
        <div class="m-actions"><button type="button" class="btn ghost" @click="clientFor = null">Cancel</button>
          <button class="btn primary" :disabled="saving || !client.client_id.trim() || !client.client_secret.trim()">{{ saving ? 'Saving…' : 'Save client' }}</button></div>
      </form>
    </div>

    <!-- Delete -->
    <div v-if="confirmRow" class="backdrop center admin-overlay" @click.self="confirmRow = null" @keydown.esc.stop.prevent="confirmRow = null">
      <div class="modal admin-dialog" role="dialog" aria-modal="true" aria-labelledby="op-delete-title">
        <h2 id="op-delete-title" class="admin-section-title">Delete {{ confirmRow.name }}?</h2>
        <template v-if="(confirmRow.services || []).length">
          <p class="form-err" role="alert">{{ confirmRow.name }} can’t be deleted while these connectors sign in through it:
            <strong>{{ confirmRow.services.map(s => s.name).join(', ') }}</strong>. Remove or relink them first.</p>
          <div class="m-actions"><button class="btn ghost" @click="confirmRow = null">Close</button></div>
        </template>
        <template v-else>
          <p>Its {{ confirmRow.connection_count || 0 }} sign-in(s) are removed with it. This can’t be undone.</p>
          <p v-if="deleteError" class="form-err" role="alert">{{ deleteError }}</p>
          <div class="m-actions"><button class="btn ghost" @click="confirmRow = null">Cancel</button>
            <button class="btn danger" :disabled="saving" @click="remove">{{ saving ? 'Deleting…' : 'Delete' }}</button></div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
// The platform's OAuth providers (ADM-1151). This replaced the provider controls of the retired Connections page;
// adding one runs the registration wizard. Every call here is staff-only on the server (`_is_provider_admin`).
import { ref, onMounted, inject } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import api from '../../services/api'

const router = useRouter()
const notify = inject('notify', () => {})
const rows = ref([])
const loading = ref(true)
const error = ref(false)
const busy = ref(null)
const saving = ref(false)

const editing = ref(null)
const form = ref({})
const scopes = ref([])
const extraJson = ref('')
const editError = ref('')

const clientFor = ref(null)
const client = ref({ client_id: '', client_secret: '' })
const clientError = ref('')

const confirmRow = ref(null)
const deleteError = ref('')

const isIconName = (v) => typeof v === 'string' && /^[a-z0-9-]+:[a-z0-9-]+$/i.test(v)
const isImage = (v) => typeof v === 'string' && /^(https:\/\/|data:image\/)/.test(v)
const errorOf = (e, fallback) => e?.response?.data?.error || e?.response?.data?.detail || fallback

async function load() {
  loading.value = true; error.value = false
  try { const { data } = await api.getConnectionProviders(); rows.value = Array.isArray(data) ? data : [] }
  catch { error.value = true }
  loading.value = false
}

function openEdit(p) {
  editError.value = ''
  form.value = { name: p.name || '', category: p.category || '', authorization_url: p.authorization_url || '',
    token_url: p.token_url || '', userinfo_url: p.userinfo_url || '', revocation_url: p.revocation_url || '',
    api_base_template: p.api_base_template || '' }
  const defaults = new Set(p.default_scopes || [])
  scopes.value = (p.available_scopes || []).map((s) => {
    const scope = typeof s === 'string' ? s : (s.scope || '')
    return { scope, label: typeof s === 'string' ? '' : (s.label || ''), risk: typeof s === 'string' ? 'read' : (s.risk || 'low'),
      default: defaults.has(scope) }
  })
  for (const d of defaults) if (!scopes.value.some((s) => s.scope === d)) scopes.value.push({ scope: d, label: '', risk: 'low', default: true })
  extraJson.value = p.extra_auth_params && Object.keys(p.extra_auth_params).length ? JSON.stringify(p.extra_auth_params, null, 2) : ''
  editing.value = p
}

async function saveEdit() {
  editError.value = ''
  let extra = {}
  if (extraJson.value.trim()) {
    try { extra = JSON.parse(extraJson.value) } catch { editError.value = 'Extra authorization parameters must be valid JSON.'; return }
    if (!extra || typeof extra !== 'object' || Array.isArray(extra)) { editError.value = 'Extra authorization parameters must be a JSON object.'; return }
  }
  const list = scopes.value.filter((s) => s.scope.trim()).map((s) => ({ scope: s.scope.trim(), label: s.label.trim(), risk: s.risk }))
  const payload = { ...form.value, available_scopes: list,
    default_scopes: scopes.value.filter((s) => s.default && s.scope.trim()).map((s) => s.scope.trim()),
    extra_auth_params: extra }
  saving.value = true
  try {
    await api.updateProvider(editing.value.slug, payload)
    notify(`Saved ${payload.name}`, 'success')
    editing.value = null
    await load()
  } catch (e) { editError.value = errorOf(e, 'Could not save the provider.') }
  saving.value = false
}

function openClient(p) { clientError.value = ''; client.value = { client_id: '', client_secret: '' }; clientFor.value = p }

async function saveClient() {
  saving.value = true; clientError.value = ''
  try {
    await api.configureProvider(clientFor.value.slug, { client_id: client.value.client_id.trim(), client_secret: client.value.client_secret.trim() })
    notify(`Saved the ${clientFor.value.name} client`, 'success')
    clientFor.value = null
    await load()
  } catch (e) { clientError.value = errorOf(e, 'Could not save the client.') }
  saving.value = false
}

async function toggle(p) {
  busy.value = p.slug
  try { await api.updateProvider(p.slug, { enabled: !p.enabled }); await load() }
  catch (e) { notify(errorOf(e, 'Could not update the provider'), 'error') }
  busy.value = null
}

async function remove() {
  saving.value = true; deleteError.value = ''
  try {
    await api.deleteProvider(confirmRow.value.slug)
    notify(`Deleted ${confirmRow.value.name}`, 'success')
    confirmRow.value = null
    await load()
  } catch (e) { deleteError.value = errorOf(e, 'Could not delete the provider.') }
  saving.value = false
}

onMounted(load)
</script>

<style scoped>
.op { padding: 28px 32px 60px; }
.op-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 20px; }
.op-head h1 { margin: 0; font-size: 22px; font-weight: 800; }
.op-head p { margin: 6px 0 0; color: var(--admin-muted, #64748b); font-size: 13px; max-width: 680px; line-height: 1.5; }
.btn { display: inline-flex; align-items: center; gap: 7px; height: 38px; border-radius: 9px; padding: 0 15px; font-size: 13px; font-weight: 700; border: 1px solid transparent; cursor: pointer; }
.btn.primary { background: #4f46e5; color: #fff; } .btn.ghost { background: var(--admin-surface, #fff); border-color: var(--admin-line, #d8e2f0); color: var(--admin-ink, #334155); } .btn.danger { background: #dc2626; color: #fff; }
.btn:disabled { opacity: .6; cursor: default; } .btn svg { width: 15px; height: 15px; }
.btn:focus-visible, .ic:focus-visible, .link:focus-visible { outline: 2px solid #4f46e5; outline-offset: 2px; }
.card { background: var(--admin-surface, #fff); border: 1px solid #e5ebf3; border-radius: 14px; box-shadow: 0 1px 2px rgba(15,23,42,.04); overflow: hidden; }
.state { padding: 44px; text-align: center; color: var(--admin-muted, #64748b); } .state.err { color: #b45309; }
.link { display: inline-flex; align-items: center; gap: 4px; border: 0; background: transparent; color: #4f46e5; font-weight: 700; cursor: pointer; font-size: 13px; }
.link svg { width: 14px; height: 14px; }
.tbl { width: 100%; border-collapse: collapse; }
.tbl th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: var(--admin-muted, #64748b); padding: 12px 16px; border-bottom: 1px solid var(--admin-line, #eef2f7); background: var(--admin-soft, #f8fafc); }
.tbl th.r { text-align: right; }
.tbl td { padding: 13px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; vertical-align: middle; }
.tbl tr:last-child td { border-bottom: 0; }
.name { display: flex; align-items: center; gap: 10px; }
.logo { display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: 8px; border: 1px solid #e5ebf3; background: #fff; flex: none; }
.logo svg, .logo img { width: 20px; height: 20px; } .logo b { font-size: 13px; color: var(--admin-muted, #64748b); }
.sub { color: var(--admin-muted, #94a3b8); font-size: 11.5px; margin-top: 2px; }
.muted { color: var(--admin-muted, #94a3b8); }
.used { font-weight: 600; }
.pill { border-radius: 6px; padding: 3px 9px; font-size: 10.5px; font-weight: 850; }
.pill.on { background: #dcfce7; color: #15803d; } .pill.off { background: var(--admin-soft, #f1f5f9); color: var(--admin-muted, #64748b); } .pill.warn { background: #fef3c7; color: #b45309; }
.actions { text-align: right; white-space: nowrap; }
.ic { display: inline-grid; place-items: center; width: 32px; height: 32px; border: 0; background: transparent; border-radius: 8px; color: var(--admin-muted, #64748b); cursor: pointer; }
.ic:hover { background: #eef2f7; color: var(--admin-ink, #0f172a); } .ic.danger:hover { background: #fee2e2; color: #dc2626; } .ic svg { width: 16px; height: 16px; }
.ic:disabled { opacity: .4; cursor: default; }
.backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.45); display: flex; justify-content: flex-end; z-index: 60; }
.backdrop.center { align-items: center; justify-content: center; padding: 20px; }
.drawer { background: var(--admin-surface, #fff); width: 560px; max-width: 100vw; height: 100%; display: flex; flex-direction: column; }
.d-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px; border-bottom: 1px solid #eef2f7; }
.d-head h2, .modal h2 { margin: 0; font-size: 17px; }
.d-body { padding: 18px 22px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; flex: 1; }
.drawer .m-actions { padding: 14px 22px; border-top: 1px solid #eef2f7; margin: 0; }
.modal { background: var(--admin-surface, #fff); border-radius: 14px; padding: 24px; width: 440px; max-width: 92vw; display: flex; flex-direction: column; gap: 12px; }
.modal p { color: var(--admin-muted, #64748b); font-size: 13px; margin: 0; }
label { display: flex; flex-direction: column; gap: 5px; font-size: 12px; font-weight: 700; color: var(--admin-ink, #334155); }
input, select, textarea { font: inherit; font-size: 13px; font-weight: 500; padding: 8px 10px; border: 1px solid var(--admin-line, #d8e2f0); border-radius: 8px; background: var(--admin-surface, #fff); color: var(--admin-ink, #0f172a); }
textarea { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 2px solid #a5b4fc; outline-offset: 0; }
.scopes { border: 1px solid var(--admin-line, #e5ebf3); border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
.scopes legend { font-size: 12px; font-weight: 700; padding: 0 4px; } .scopes legend small { font-weight: 500; color: var(--admin-muted, #64748b); }
.scope-row { display: grid; grid-template-columns: 1fr 1.3fr 88px auto 32px; gap: 6px; align-items: center; }
.chk { flex-direction: row; align-items: center; gap: 4px; font-weight: 600; white-space: nowrap; }
.form-err { color: #b91c1c !important; font-size: 12.5px; font-weight: 600; }
.m-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; }
@media (max-width: 680px) { .op { padding: 20px 16px; } .scope-row { grid-template-columns: 1fr 1fr; } }
</style>
