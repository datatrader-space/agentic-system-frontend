<template>
  <main class="oauth-page">
    <section v-if="created" class="success-card">
      <div class="success-mark"><Icon icon="lucide:check" /></div>
      <h1>Provider created successfully!</h1>
      <p>{{ form.name }} has been added to your OAuth providers.</p>
      <div class="next-list">
        <article>
          <span>1</span>
          <div><strong>Share with your organization</strong><small>Make this provider available to organization members.</small></div>
          <button @click="goConnections">Manage Visibility</button>
        </article>
        <article>
          <span>2</span>
          <div><strong>Add default scopes</strong><small>Define recommended scopes for new connections.</small></div>
          <button @click="created = false; step = 3">Manage Scopes</button>
        </article>
        <article>
          <span>3</span>
          <div><strong>View and manage connections</strong><small>See who has connected and with what scopes.</small></div>
          <button @click="goConnections">View Connections</button>
        </article>
      </div>
      <button class="primary center" @click="goConnections">Go to Connections</button>
    </section>

    <section v-else class="oauth-main">
      <RouterLink to="/dashboard/connectors" class="back-link"><Icon icon="lucide:arrow-left" /> Back to Connectors</RouterLink>
      <header class="page-head">
        <div>
          <h1>Add OAuth Provider</h1>
          <p>Register a new provider so agents can connect their accounts.</p>
        </div>
      </header>

      <nav class="stepper" aria-label="Registration steps">
        <button v-for="s in steps" :key="s.n" :class="{ active: step === s.n, done: step > s.n }" @click="step = s.n">
          <span><Icon v-if="step > s.n" icon="lucide:check" /><template v-else>{{ s.n }}</template></span>
          <small>{{ s.label }}</small>
        </button>
      </nav>

      <section v-if="step === 1" class="panel">
        <div class="form-grid two">
          <label><span>Provider Name *</span><input v-model="form.name" placeholder="Google" /></label>
          <label><span>Slug *</span><input v-model="form.slug" placeholder="google" /></label>
        </div>
        <label><span>Category *</span><select v-model="form.category"><option>General</option><option>Communication</option><option>Productivity</option><option>Developer Tools</option><option>CRM</option></select></label>
        <label><span>Description</span><textarea v-model="form.description" rows="4" placeholder="Connect Google Workspace accounts to access Gmail, Drive, Calendar and more." /></label>
        <div class="visibility-grid">
          <button v-for="v in visibility" :key="v.key" :class="{ active: form.visibility === v.key }" @click="form.visibility = v.key">
            <Icon :icon="v.icon" /><strong>{{ v.title }}</strong><small>{{ v.copy }}</small>
          </button>
        </div>
        <label class="status-row"><span>Status</span><button class="switch" :class="{ on: form.enabled }" @click="form.enabled = !form.enabled"><i /></button><small>Active</small></label>
      </section>

      <section v-if="step === 2" class="panel">
        <h2>Authorization Endpoints</h2>
        <p class="panel-copy">These endpoints are used in the OAuth 2.0 authorization code flow.</p>
        <label><span>Authorization URL *</span><input v-model="form.authorization_url" placeholder="https://accounts.google.com/o/oauth2/v2/auth" /></label>
        <label><span>Token URL *</span><input v-model="form.token_url" placeholder="https://oauth2.googleapis.com/token" /></label>
        <label><span>User Info URL</span><input v-model="form.userinfo_url" placeholder="https://openidconnect.googleapis.com/v1/userinfo" /></label>
        <label><span>Revocation URL</span><input v-model="form.revocation_url" placeholder="https://oauth2.googleapis.com/revoke" /></label>
        <div class="discovery-row">
          <label><span>Discovery URL</span><input v-model="form.discovery_url" placeholder="https://accounts.google.com/.well-known/openid-configuration" /></label>
          <button @click="fetchDiscovery" :disabled="discovering">{{ discovering ? 'Fetching...' : 'Fetch from Discovery' }}</button>
        </div>
      </section>

      <section v-if="step === 3" class="panel">
        <h2>Authentication Details</h2>
        <div class="form-grid two">
          <label><span>Client ID *</span><input v-model="form.client_id" placeholder="123456.apps.googleusercontent.com" /></label>
          <label><span>Client Secret *</span><input v-model="form.client_secret" type="password" placeholder="Shared securely and encrypted" /></label>
        </div>
        <label class="status-row"><span>PKCE recommended</span><button class="switch on"><i /></button><small>Required</small></label>
        <div class="scopes-head">
          <div><h2>Scopes</h2><p class="panel-copy">Choose scopes this provider can request.</p></div>
          <button @click="addScope"><Icon icon="lucide:plus" /> Add scope</button>
        </div>
        <div class="scope-list">
          <article v-for="(scope, i) in scopes" :key="i">
            <input v-model="scope.scope" placeholder="openid" />
            <input v-model="scope.label" placeholder="OpenID Connect" />
            <select v-model="scope.risk"><option value="read">Identity</option><option value="write">Write</option><option value="admin">Admin</option></select>
            <label><input v-model="scope.default" type="checkbox" /> Default</label>
            <button @click="scopes.splice(i, 1)"><Icon icon="lucide:x" /></button>
          </article>
        </div>
      </section>

      <section v-if="step === 4" class="review-grid">
        <article class="panel"><header><h2>Configuration Summary</h2><button @click="step = 1">Edit</button></header><dl><dt>Provider Name</dt><dd>{{ form.name || '-' }}</dd><dt>Slug</dt><dd>{{ form.slug || '-' }}</dd><dt>Category</dt><dd>{{ form.category }}</dd><dt>Visibility</dt><dd>{{ form.visibility }}</dd><dt>Status</dt><dd><span class="ok">Active</span></dd></dl></article>
        <article class="panel"><header><h2>Endpoints</h2><button @click="step = 2">Edit</button></header><dl><dt>Authorization URL</dt><dd>{{ form.authorization_url || '-' }}</dd><dt>Token URL</dt><dd>{{ form.token_url || '-' }}</dd><dt>User Info URL</dt><dd>{{ form.userinfo_url || '-' }}</dd><dt>Revocation URL</dt><dd>{{ form.revocation_url || '-' }}</dd></dl></article>
        <article class="panel"><header><h2>Authentication</h2><button @click="step = 3">Edit</button></header><dl><dt>Client ID</dt><dd>{{ form.client_id || '-' }}</dd><dt>Client Secret</dt><dd>••••••••••••</dd><dt>PKCE</dt><dd>Required</dd></dl></article>
        <article class="panel"><header><h2>Scopes ({{ validScopes.length }} selected)</h2><button @click="step = 3">Edit</button></header><ul class="scope-review"><li v-for="s in validScopes" :key="s.scope"><i />{{ s.scope }}</li></ul></article>
        <article class="panel wide test-row"><div><h2>Test Connection</h2><p>Test the OAuth flow to ensure everything is configured correctly.</p></div><button>Test Connection</button></article>
      </section>

      <footer class="page-actions">
        <button class="secondary" :disabled="step === 1" @click="step--">Back</button>
        <button v-if="step < 4" class="primary" @click="step++">Next</button>
        <!-- OAuth provider registration is not fully wired to the backend yet — disabled until then. -->
        <button v-else class="primary" disabled title="OAuth provider registration is coming soon">Coming soon</button>
      </footer>
    </section>
  </main>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import api from '../services/api'
import { notify } from '@/composables/useNotify'

const router = useRouter()
const step = ref(1)
const saving = ref(false)
const created = ref(false)
const discovering = ref(false)
const steps = [{ n: 1, label: 'Basic Info' }, { n: 2, label: 'Endpoints' }, { n: 3, label: 'Auth & Scopes' }, { n: 4, label: 'Review' }]
const visibility = [
  { key: 'personal', title: 'Personal', copy: 'Only visible to users in personal scope.', icon: 'lucide:user' },
  { key: 'organization', title: 'Organization', copy: 'Visible to all members in the organization.', icon: 'lucide:building-2' },
  { key: 'public', title: 'Public', copy: 'Available to all organizations.', icon: 'lucide:globe' },
]
const form = reactive({
  name: '',
  slug: '',
  category: 'General',
  description: '',
  visibility: 'personal',
  enabled: true,
  authorization_url: '',
  token_url: '',
  userinfo_url: '',
  revocation_url: '',
  discovery_url: '',
  client_id: '',
  client_secret: '',
})
const scopes = ref([
  { scope: 'openid', label: 'OpenID Connect', risk: 'read', default: true },
  { scope: 'email', label: 'View your email address', risk: 'read', default: true },
  { scope: 'profile', label: 'See your personal info', risk: 'read', default: true },
])
watch(() => form.name, (v) => {
  if (!form.slug) form.slug = String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
})
const validScopes = computed(() => scopes.value.filter(s => s.scope.trim()))
const canCreate = computed(() => form.name && form.slug && form.authorization_url && form.token_url && form.client_id && form.client_secret)
function addScope() { scopes.value.push({ scope: '', label: '', risk: 'read', default: false }) }
function goConnections() { router.push('/dashboard/connections') }
async function fetchDiscovery() {
  if (!form.discovery_url) return
  discovering.value = true
  try {
    const { data } = await api.get(form.discovery_url, { __skipBaseURL: true })
    form.authorization_url = data.authorization_endpoint || form.authorization_url
    form.token_url = data.token_endpoint || form.token_url
    form.userinfo_url = data.userinfo_endpoint || form.userinfo_url
    form.revocation_url = data.revocation_endpoint || form.revocation_url
  } catch {
    notify.warning('Discovery fetch failed. You can enter endpoints manually.')
  } finally {
    discovering.value = false
  }
}
async function createProvider() {
  if (!canCreate.value) return
  saving.value = true
  try {
    const available_scopes = validScopes.value.map(s => ({ scope: s.scope.trim(), label: s.label.trim(), risk: s.risk }))
    await api.createProvider({
      name: form.name,
      slug: form.slug,
      authorization_url: form.authorization_url,
      token_url: form.token_url,
      userinfo_url: form.userinfo_url,
      revocation_url: form.revocation_url,
      icon: '🔗',
      color: '#635BFF',
      category: form.category.toLowerCase().replace(/\s+/g, '_'),
      default_scopes: validScopes.value.filter(s => s.default).map(s => s.scope.trim()),
      available_scopes,
      client_id: form.client_id,
      client_secret: form.client_secret,
      extra_auth_params: {},
      resource_url: '',
      api_base_template: '',
    })
    created.value = true
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to create provider')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.oauth-page { min-height: 100%; background: #f8fbff; color: #061735; padding: 26px 32px 54px; }
.oauth-main, .success-card { max-width: 1180px; margin: 0 auto; }
.back-link { display: inline-flex; align-items: center; gap: 7px; color: #42526f; font-size: 12px; font-weight: 850; text-decoration: none; }
.back-link svg { width: 14px; height: 14px; }
.page-head { margin-top: 18px; margin-bottom: 22px; }
.page-head h1 { margin: 0; font-size: 28px; font-weight: 900; letter-spacing: 0; }
.page-head p { margin: 7px 0 0; color: #52617a; font-size: 13px; }
.stepper { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; border: 1px solid #dfe7f2; border-radius: 13px; background: #fff; padding: 18px 24px; box-shadow: 0 8px 22px rgba(15,23,42,.035); }
.stepper button { display: grid; justify-items: center; gap: 8px; position: relative; border: 0; background: transparent; color: #8090aa; font-weight: 850; }
.stepper button::after { content: ""; position: absolute; top: 16px; left: calc(50% + 22px); right: calc(-50% + 22px); height: 1px; background: #dfe7f2; }
.stepper button:last-child::after { display: none; }
.stepper span { display: grid; width: 30px; height: 30px; place-items: center; border-radius: 999px; background: #eef4ff; color: #5f6b84; font-size: 12px; }
.stepper svg { width: 15px; height: 15px; }
.stepper .active span { background: #635bff; color: #fff; }
.stepper .done span { background: #dff8ef; color: #10b981; }
.stepper small { font-size: 11px; }
.panel, .success-card { margin-top: 18px; border: 1px solid #dfe7f2; border-radius: 13px; background: #fff; padding: 22px; box-shadow: 0 8px 22px rgba(15,23,42,.035); }
.panel h2 { margin: 0; font-size: 15px; font-weight: 900; }
.panel-copy { margin: 6px 0 16px; color: #64748b; font-size: 12px; }
.form-grid.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
label { display: block; margin-top: 15px; }
label span { display: block; margin-bottom: 7px; color: #334155; font-size: 12px; font-weight: 850; }
input, textarea, select { width: 100%; border: 1px solid #d8e2f0; border-radius: 9px; background: #fff; padding: 10px 12px; color: #0f172a; font-size: 13px; outline: none; }
input:focus, textarea:focus, select:focus { border-color: #635bff; box-shadow: 0 0 0 3px #efedff; }
.visibility-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 18px; }
.visibility-grid button { display: grid; gap: 5px; border: 1px solid #dfe7f2; border-radius: 10px; background: #fff; padding: 14px; text-align: left; }
.visibility-grid button.active { border-color: #635bff; box-shadow: 0 0 0 1px #635bff inset; }
.visibility-grid svg { width: 17px; height: 17px; color: #635bff; }
.visibility-grid strong { font-size: 12px; }
.visibility-grid small { color: #64748b; font-size: 11px; line-height: 1.35; }
.status-row { display: flex; align-items: center; gap: 10px; }
.status-row span { margin: 0; }
.status-row small { color: #64748b; font-size: 12px; font-weight: 750; }
.switch { width: 40px; height: 23px; border: 0; border-radius: 999px; background: #d0d5dd; padding: 2px; }
.switch i { display: block; width: 19px; height: 19px; border-radius: 999px; background: #fff; transition: transform .15s; }
.switch.on { background: #635bff; }
.switch.on i { transform: translateX(17px); }
.discovery-row { display: grid; grid-template-columns: minmax(0, 1fr) 180px; gap: 12px; align-items: end; }
.discovery-row button, .scopes-head button, .page-actions button, .review-grid header button, .test-row button, .next-list button { height: 38px; border-radius: 8px; border: 1px solid #d8e2f0; background: #fff; color: #635bff; font-size: 12px; font-weight: 850; }
.scopes-head { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-top: 22px; }
.scopes-head button { display: inline-flex; align-items: center; gap: 7px; padding: 0 13px; }
.scope-list { display: grid; gap: 8px; margin-top: 12px; }
.scope-list article { display: grid; grid-template-columns: 1.1fr 1.4fr 130px 100px 34px; gap: 9px; align-items: center; }
.scope-list label { margin: 0; display: flex; gap: 6px; align-items: center; color: #64748b; font-size: 12px; font-weight: 750; }
.scope-list label input { width: auto; }
.scope-list article > button { display: grid; width: 34px; height: 34px; place-items: center; border: 1px solid #d8e2f0; border-radius: 8px; background: #fff; color: #64748b; }
.review-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 18px; }
.review-grid .panel { margin: 0; }
.review-grid .wide { grid-column: 1 / -1; }
.review-grid header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
dl { display: grid; gap: 9px; margin: 0; }
dt { color: #64748b; font-size: 11px; font-weight: 850; }
dd { margin: -24px 0 0 150px; color: #0f172a; font-size: 12px; word-break: break-word; }
.ok { color: #10b981; font-weight: 850; }
.scope-review { display: grid; gap: 7px; margin: 0; padding: 0; list-style: none; }
.scope-review li { display: flex; align-items: center; gap: 7px; color: #334155; font-size: 12px; }
.scope-review i { width: 7px; height: 7px; border-radius: 999px; background: #10b981; }
.test-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.test-row p { margin: 5px 0 0; color: #64748b; font-size: 12px; }
.page-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
.primary { border: 0 !important; background: #635bff !important; color: #fff !important; padding: 0 22px; box-shadow: 0 10px 20px rgba(99,91,255,.18); }
.primary:disabled { opacity: .55; cursor: not-allowed; }
.secondary { padding: 0 18px; }
.success-card { min-height: 620px; display: grid; justify-items: center; align-content: center; text-align: center; }
.success-mark { display: grid; width: 92px; height: 92px; place-items: center; border-radius: 999px; background: #10b981; color: #fff; box-shadow: 0 20px 40px rgba(16,185,129,.22); }
.success-mark svg { width: 42px; height: 42px; }
.success-card h1 { margin: 24px 0 0; font-size: 24px; font-weight: 900; }
.success-card > p { margin: 8px 0 0; color: #64748b; font-size: 13px; }
.next-list { display: grid; gap: 12px; width: min(100%, 760px); margin: 34px 0 24px; }
.next-list article { display: grid; grid-template-columns: 32px minmax(0, 1fr) 150px; gap: 12px; align-items: center; border: 1px solid #dfe7f2; border-radius: 10px; padding: 14px; text-align: left; }
.next-list article > span { display: grid; width: 26px; height: 26px; place-items: center; border-radius: 999px; background: #eef4ff; color: #635bff; font-size: 12px; font-weight: 900; }
.next-list strong { display: block; font-size: 12px; }
.next-list small { display: block; margin-top: 4px; color: #64748b; font-size: 11px; }
.center { height: 42px; border-radius: 8px; }
@media (max-width: 900px) {
  .form-grid.two, .visibility-grid, .review-grid, .discovery-row { grid-template-columns: 1fr; }
  .scope-list article { grid-template-columns: 1fr; }
  dd { margin: 3px 0 0; }
}
</style>
