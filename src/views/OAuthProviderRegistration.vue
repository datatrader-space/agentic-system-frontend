<template>
  <main class="oauth-page">
    <section v-if="created" class="success-card">
      <div class="success-mark"><Icon icon="lucide:check" /></div>
      <h1>{{ form.name }} is ready</h1>
      <p>
        It is a platform-wide provider: every user can now connect their own {{ form.name }} account through it.
        The client secret is stored encrypted and is never shown again.
      </p>

      <div class="next-list">
        <article>
          <span>1</span>
          <div>
            <strong>Test the connection</strong>
            <small>Sign in with your own {{ form.name }} account. This runs the real authorization flow end to end.</small>
            <small v-if="test.state === 'ok'" class="test-ok">Connected{{ test.label ? ` as ${test.label}` : '' }} — the provider works.</small>
            <small v-else-if="test.state === 'error'" class="test-error">{{ test.message }}</small>
          </div>
          <button :disabled="test.state === 'running'" @click="testConnection">
            {{ test.state === 'running' ? 'Waiting for sign-in…' : test.state === 'ok' ? 'Test again' : 'Test connection' }}
          </button>
        </article>
        <article>
          <span>2</span>
          <div>
            <strong>Use it from a service</strong>
            <small>A service links this provider with <code>oauth_provider="{{ form.slug }}"</code>; each user connects their own account.</small>
          </div>
          <button @click="router.push('/dashboard/connectors')">Open Connectors</button>
        </article>
      </div>
      <button class="primary center" @click="router.push('/dashboard/connections')">View connections</button>
    </section>

    <section v-else class="oauth-main">
      <RouterLink to="/dashboard/connectors" class="back-link"><Icon icon="lucide:arrow-left" /> Back to Connectors</RouterLink>
      <header class="page-head">
        <div>
          <h1>Add OAuth Provider</h1>
          <p>Register a provider once for the whole platform; every user then connects their own account through it.</p>
        </div>
      </header>

      <div v-if="adminChecked && !isPlatformAdmin" class="notice notice-warn">
        Only platform administrators can add OAuth providers. You can fill in the form, but saving will be refused.
      </div>

      <nav class="stepper" aria-label="Registration steps">
        <button v-for="s in steps" :key="s.n" :class="{ active: step === s.n, done: step > s.n }" @click="step = s.n">
          <span><Icon v-if="step > s.n" icon="lucide:check" /><template v-else>{{ s.n }}</template></span>
          <small>{{ s.label }}</small>
        </button>
      </nav>

      <section v-if="step === 1" class="panel">
        <label for="oauth-preset">
          <span>Start from a preset</span>
          <select id="oauth-preset" v-model="presetId" @change="applyPreset">
            <option value="">Custom provider</option>
            <option v-for="p in presets" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </label>
        <p class="panel-copy">A preset fills the endpoints and scopes the provider documents. You still add your own app's client ID and secret.</p>
        <div class="form-grid two">
          <label for="oauth-name"><span>Provider Name *</span><input id="oauth-name" v-model="form.name" placeholder="Slack" /></label>
          <label for="oauth-slug"><span>Slug *</span><input id="oauth-slug" v-model="form.slug" placeholder="slack" /></label>
        </div>
        <label for="oauth-category">
          <span>Category *</span>
          <select id="oauth-category" v-model="form.category">
            <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
          </select>
        </label>
        <div class="notice">
          <Icon icon="lucide:globe" />
          Platform-wide: every user sees this provider and connects their <strong>own</strong> account. Nobody uses yours.
        </div>
      </section>

      <section v-if="step === 2" class="panel">
        <h2>Authorization Endpoints</h2>
        <p class="panel-copy">Used in the OAuth 2.0 authorization code flow. All must be https.</p>
        <label for="oauth-auth-url"><span>Authorization URL *</span><input id="oauth-auth-url" v-model="form.authorization_url" placeholder="https://slack.com/oauth/v2/authorize" /></label>
        <label for="oauth-token-url"><span>Token URL *</span><input id="oauth-token-url" v-model="form.token_url" placeholder="https://slack.com/api/oauth.v2.access" /></label>
        <label for="oauth-userinfo-url"><span>User Info URL</span><input id="oauth-userinfo-url" v-model="form.userinfo_url" placeholder="https://slack.com/api/auth.test" /></label>
        <label for="oauth-revoke-url"><span>Revocation URL</span><input id="oauth-revoke-url" v-model="form.revocation_url" placeholder="https://slack.com/api/auth.revoke" /></label>
        <div class="notice">
          <Icon icon="lucide:link" />
          <span>Register this redirect URL in the provider's app settings:
            <code>{{ callbackUrl }}</code>
            <button type="button" class="copy" @click="copy(callbackUrl)">Copy</button>
          </span>
        </div>
      </section>

      <section v-if="step === 3" class="panel">
        <h2>Authentication Details</h2>
        <div class="form-grid two">
          <label for="oauth-client-id"><span>Client ID *</span><input id="oauth-client-id" v-model="form.client_id" autocomplete="off" spellcheck="false" placeholder="From the provider's app settings" /></label>
          <label for="oauth-client-secret"><span>Client Secret *</span><input id="oauth-client-secret" v-model="form.client_secret" type="password" autocomplete="new-password" spellcheck="false" placeholder="Stored encrypted, never shown again" /></label>
        </div>
        <label class="status-row">
          <span>Use PKCE</span>
          <button type="button" class="switch" :class="{ on: form.pkce }" role="switch" :aria-checked="form.pkce" @click="form.pkce = !form.pkce"><i /></button>
          <small>Only if the provider requires it (e.g. X/Twitter). Leave off for Slack, GitHub and Google.</small>
        </label>
        <label class="check-row">
          <input v-model="form.scopes_on_app" type="checkbox" />
          <span>Scopes are set on the provider's app, not requested at sign-in (e.g. Supabase)</span>
        </label>
        <div class="scopes-head">
          <div><h2>Scopes{{ form.scopes_on_app ? '' : ' *' }}</h2><p class="panel-copy">What users are asked to grant. Only scopes marked Default are requested; they must also be enabled on the provider's app.</p></div>
          <button type="button" @click="addScope"><Icon icon="lucide:plus" /> Add scope</button>
        </div>
        <p v-if="!scopes.length" class="panel-copy">No scopes yet. Pick a preset in step 1 or add them here.</p>
        <div class="scope-list">
          <article v-for="(scope, i) in scopes" :key="i">
            <input v-model="scope.scope" :aria-label="`Scope ${i + 1}`" placeholder="channels:read" />
            <input v-model="scope.label" :aria-label="`Scope ${i + 1} label`" placeholder="Read public channels" />
            <select v-model="scope.risk" :aria-label="`Scope ${i + 1} risk`"><option value="low">Low risk</option><option value="medium">Medium risk</option><option value="high">High risk</option></select>
            <label><input v-model="scope.default" type="checkbox" /> Default</label>
            <button type="button" :aria-label="`Remove scope ${i + 1}`" @click="scopes.splice(i, 1)"><Icon icon="lucide:x" /></button>
          </article>
        </div>
      </section>

      <section v-if="step === 4" class="review-grid">
        <article class="panel"><header><h2>Configuration Summary</h2><button @click="step = 1">Edit</button></header><dl><dt>Provider Name</dt><dd>{{ form.name || '-' }}</dd><dt>Slug</dt><dd>{{ form.slug || '-' }}</dd><dt>Category</dt><dd>{{ form.category }}</dd><dt>Availability</dt><dd>Platform-wide</dd></dl></article>
        <article class="panel"><header><h2>Endpoints</h2><button @click="step = 2">Edit</button></header><dl><dt>Authorization URL</dt><dd>{{ form.authorization_url || '-' }}</dd><dt>Token URL</dt><dd>{{ form.token_url || '-' }}</dd><dt>User Info URL</dt><dd>{{ form.userinfo_url || '-' }}</dd><dt>Revocation URL</dt><dd>{{ form.revocation_url || '-' }}</dd></dl></article>
        <article class="panel"><header><h2>Authentication</h2><button @click="step = 3">Edit</button></header><dl><dt>Client ID</dt><dd>{{ form.client_id || '-' }}</dd><dt>Client Secret</dt><dd>{{ form.client_secret ? '••••••••••••' : '-' }}</dd><dt>PKCE</dt><dd>{{ form.pkce ? 'On' : 'Off' }}</dd><dt>Scopes</dt><dd>{{ form.scopes_on_app ? 'Set on the app' : 'Requested at sign-in' }}</dd></dl></article>
        <article class="panel"><header><h2>Scopes ({{ defaultScopes.length }} requested)</h2><button @click="step = 3">Edit</button></header><ul class="scope-review"><li v-for="s in defaultScopes" :key="s"><i />{{ s }}</li></ul></article>
        <article v-if="problems.length" class="panel wide">
          <h2>Fix before creating</h2>
          <ul class="problems"><li v-for="p in problems" :key="p">{{ p }}</li></ul>
        </article>
      </section>

      <footer class="page-actions">
        <button class="secondary" :disabled="step === 1" @click="step--">Back</button>
        <button v-if="step < 4" class="primary" @click="step++">Next</button>
        <button v-else class="primary" :disabled="saving || problems.length > 0" @click="createProvider">
          {{ saving ? 'Creating…' : 'Create provider' }}
        </button>
      </footer>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import api from '../services/api'
import { notify } from '@/composables/useNotify'
import { connectOAuth } from '@/composables/useOAuthConnect'

const router = useRouter()
const step = ref(1)
const saving = ref(false)
const created = ref(false)
const steps = [{ n: 1, label: 'Basic Info' }, { n: 2, label: 'Endpoints' }, { n: 3, label: 'Auth & Scopes' }, { n: 4, label: 'Review' }]
const categories = ['General', 'Communication', 'Productivity', 'Developer Tools', 'CRM', 'Marketing', 'Social']

const presets = ref([])
const presetId = ref('')
const isPlatformAdmin = ref(false)
const adminChecked = ref(false)
const test = reactive({ state: 'idle', message: '', label: '' })

const form = reactive({
  name: '',
  slug: '',
  category: 'General',
  icon: '🔗',
  color: '#635BFF',
  authorization_url: '',
  token_url: '',
  userinfo_url: '',
  revocation_url: '',
  client_id: '',
  client_secret: '',
  pkce: false,
  scopes_on_app: false,
  extra_auth_params: {},
})
const scopes = ref([])

// The callback the backend sends providers to — the value to register in the provider's app.
const callbackUrl = `${window.location.origin}/api/connections/callback/`

const defaultScopes = computed(() => scopes.value.filter((s) => s.default && s.scope.trim()).map((s) => s.scope.trim()))
const SLUG = /^[a-z0-9][a-z0-9-]{0,48}$/
const isHttps = (u) => /^https:\/\/[^\s/$.?#][^\s]*$/i.test(String(u || '').trim())

const problems = computed(() => {
  const out = []
  if (!form.name.trim()) out.push('Provider name is required.')
  if (!SLUG.test(form.slug.trim())) out.push('Slug must be lowercase letters, digits and dashes.')
  if (!isHttps(form.authorization_url)) out.push('Authorization URL must be an https URL.')
  if (!isHttps(form.token_url)) out.push('Token URL must be an https URL.')
  if (form.userinfo_url && !isHttps(form.userinfo_url)) out.push('User Info URL must be an https URL.')
  if (form.revocation_url && !isHttps(form.revocation_url)) out.push('Revocation URL must be an https URL.')
  if (!form.client_id.trim()) out.push('Client ID is required.')
  if (!form.client_secret.trim()) out.push('Client secret is required.')
  if (!defaultScopes.value.length && !form.scopes_on_app) {
    out.push('Mark at least one scope as Default — providers refuse a request with none. If the provider sets scopes on its app, tick that option instead.')
  }
  return out
})

function slugify(v) {
  return String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function applyPreset() {
  const p = presets.value.find((x) => x.id === presetId.value)
  if (!p) return
  form.name = p.name
  form.slug = p.slug || slugify(p.name)
  form.category = categories.find((c) => slugify(c) === slugify(p.category)) || 'General'
  form.icon = p.icon || '🔗'
  form.color = p.color || '#635BFF'
  form.authorization_url = p.authorization_url || ''
  form.token_url = p.token_url || ''
  form.userinfo_url = p.userinfo_url || ''
  form.revocation_url = p.revocation_url || ''
  const extra = { ...(p.extra_auth_params || {}) }
  form.pkce = Boolean(extra.pkce)
  form.scopes_on_app = Boolean(extra.scopes_on_app)
  delete extra.pkce
  delete extra.scopes_on_app
  form.extra_auth_params = extra
  scopes.value = (p.scopes || []).map((s) => ({
    scope: s.id || s.scope || '',
    label: s.label || '',
    risk: ['low', 'medium', 'high'].includes(s.risk) ? s.risk : 'low',
    default: Boolean(s.default),
  }))
}

function addScope() { scopes.value.push({ scope: '', label: '', risk: 'low', default: true }) }

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text)
    notify.success('Copied')
  } catch {
    notify.error('Could not copy — select the URL and copy it manually.')
  }
}

async function createProvider() {
  if (problems.value.length || saving.value) return
  saving.value = true
  try {
    const cleanScopes = scopes.value.filter((s) => s.scope.trim())
    await api.createProvider({
      name: form.name.trim(),
      slug: form.slug.trim(),
      authorization_url: form.authorization_url.trim(),
      token_url: form.token_url.trim(),
      userinfo_url: form.userinfo_url.trim(),
      revocation_url: form.revocation_url.trim(),
      icon: form.icon,
      color: form.color,
      category: slugify(form.category).replace(/-/g, '_'),
      default_scopes: defaultScopes.value,
      // The stored shape is {scope, label, risk} (agent/models.py OAuthProvider.available_scopes); the Connections
      // page reads `.scope`.
      available_scopes: cleanScopes.map((s) => ({ scope: s.scope.trim(), label: s.label.trim(), risk: s.risk })),
      client_id: form.client_id.trim(),
      client_secret: form.client_secret.trim(),
      extra_auth_params: {
        ...form.extra_auth_params,
        ...(form.pkce ? { pkce: true } : {}),
        ...(form.scopes_on_app ? { scopes_on_app: true } : {}),
      },
    })
    // The secret has done its job; do not keep it in this page's memory.
    form.client_secret = ''
    created.value = true
    notify.success(`${form.name} provider created`)
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to create provider')
  } finally {
    saving.value = false
  }
}

async function testConnection() {
  test.state = 'running'
  test.message = ''
  try {
    await connectOAuth(api, form.slug, {})
    let label = ''
    try {
      const { data } = await api.getConnections()
      const rows = data?.results || data?.connections || data || []
      const row = (Array.isArray(rows) ? rows : []).find((c) => String(c.provider_slug || '').toLowerCase() === form.slug)
      label = row?.account_label || ''
    } catch { /* the connect succeeded; a missing label is cosmetic */ }
    test.label = label
    test.state = 'ok'
  } catch (e) {
    test.state = 'error'
    test.message = e?.message || 'The sign-in did not complete. Check the redirect URL and scopes on the provider app.'
  }
}

onMounted(async () => {
  try {
    const { data } = await api.getConnectionPresets()
    presets.value = Array.isArray(data) ? data : []
  } catch {
    presets.value = []
  }
  try {
    const { data } = await api.getCurrentUser()
    isPlatformAdmin.value = !!(data?.user?.is_platform_admin ?? data?.is_platform_admin)
  } catch {
    isPlatformAdmin.value = false
  } finally {
    adminChecked.value = true
  }
})
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
.notice { display: flex; align-items: flex-start; gap: 9px; margin-top: 16px; border: 1px solid #dfe7f2; border-radius: 10px; background: #f8fbff; padding: 11px 13px; color: #334155; font-size: 12px; line-height: 1.5; }
.notice svg { width: 16px; height: 16px; flex-shrink: 0; margin-top: 1px; color: #635bff; }
.notice code { background: #fff; border: 1px solid #dfe7f2; border-radius: 6px; padding: 1px 6px; font-size: 11.5px; word-break: break-all; }
.notice .copy { margin-left: 6px; border: 0; background: transparent; color: #635bff; font-size: 12px; font-weight: 850; cursor: pointer; }
.notice-warn { border-color: #fcd9a8; background: #fff8ee; color: #8a4b08; margin-top: 0; margin-bottom: 14px; }
.check-row { display: flex; align-items: center; gap: 8px; margin-top: 18px; }
.check-row input { width: auto; }
.check-row span { margin: 0; font-weight: 750; color: #334155; }
.status-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.status-row span { margin: 0; }
.status-row small { color: #64748b; font-size: 12px; font-weight: 750; }
.switch { width: 40px; height: 23px; border: 0; border-radius: 999px; background: #d0d5dd; padding: 2px; cursor: pointer; }
.switch i { display: block; width: 19px; height: 19px; border-radius: 999px; background: #fff; transition: transform .15s; }
.switch.on { background: #635bff; }
.switch.on i { transform: translateX(17px); }
.switch:focus-visible, button:focus-visible { outline: 2px solid #635bff; outline-offset: 2px; }
.scopes-head button, .page-actions button, .review-grid header button, .next-list button { height: 38px; border-radius: 8px; border: 1px solid #d8e2f0; background: #fff; color: #635bff; font-size: 12px; font-weight: 850; cursor: pointer; }
.scopes-head { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-top: 22px; }
.scopes-head button { display: inline-flex; align-items: center; gap: 7px; padding: 0 13px; }
.scope-list { display: grid; gap: 8px; margin-top: 12px; }
.scope-list article { display: grid; grid-template-columns: 1.1fr 1.4fr 130px 100px 34px; gap: 9px; align-items: center; }
.scope-list label { margin: 0; display: flex; gap: 6px; align-items: center; color: #64748b; font-size: 12px; font-weight: 750; }
.scope-list label input { width: auto; }
.scope-list article > button { display: grid; width: 34px; height: 34px; place-items: center; border: 1px solid #d8e2f0; border-radius: 8px; background: #fff; color: #64748b; cursor: pointer; }
.review-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 18px; }
.review-grid .panel { margin: 0; }
.review-grid .wide { grid-column: 1 / -1; }
.review-grid header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
dl { display: grid; gap: 9px; margin: 0; }
dt { color: #64748b; font-size: 11px; font-weight: 850; }
dd { margin: -24px 0 0 150px; color: #0f172a; font-size: 12px; word-break: break-word; }
.scope-review { display: grid; gap: 7px; margin: 0; padding: 0; list-style: none; max-height: 260px; overflow-y: auto; }
.scope-review li { display: flex; align-items: center; gap: 7px; color: #334155; font-size: 12px; }
.scope-review i { width: 7px; height: 7px; border-radius: 999px; background: #10b981; }
.problems { margin: 10px 0 0; padding-left: 18px; color: #b42318; font-size: 12px; display: grid; gap: 5px; }
.page-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
.primary { border: 0 !important; background: #635bff !important; color: #fff !important; padding: 0 22px; box-shadow: 0 10px 20px rgba(99,91,255,.18); }
.primary:disabled { opacity: .55; cursor: not-allowed; }
.secondary { padding: 0 18px; }
.success-card { min-height: 520px; display: grid; justify-items: center; align-content: center; text-align: center; }
.success-mark { display: grid; width: 92px; height: 92px; place-items: center; border-radius: 999px; background: #10b981; color: #fff; box-shadow: 0 20px 40px rgba(16,185,129,.22); }
.success-mark svg { width: 42px; height: 42px; }
.success-card h1 { margin: 24px 0 0; font-size: 24px; font-weight: 900; }
.success-card > p { margin: 8px 0 0; max-width: 620px; color: #64748b; font-size: 13px; }
.next-list { display: grid; gap: 12px; width: min(100%, 760px); margin: 34px 0 24px; }
.next-list article { display: grid; grid-template-columns: 32px minmax(0, 1fr) 170px; gap: 12px; align-items: center; border: 1px solid #dfe7f2; border-radius: 10px; padding: 14px; text-align: left; }
.next-list article > span { display: grid; width: 26px; height: 26px; place-items: center; border-radius: 999px; background: #eef4ff; color: #635bff; font-size: 12px; font-weight: 900; }
.next-list strong { display: block; font-size: 12px; }
.next-list small { display: block; margin-top: 4px; color: #64748b; font-size: 11px; }
.next-list code { font-size: 11px; }
.next-list .test-ok { color: #067647; font-weight: 750; }
.next-list .test-error { color: #b42318; font-weight: 750; }
.next-list button:disabled { opacity: .6; cursor: progress; }
.center { height: 42px; border-radius: 8px; }
@media (max-width: 900px) {
  .form-grid.two, .review-grid { grid-template-columns: 1fr; }
  .scope-list article { grid-template-columns: 1fr; }
  .next-list article { grid-template-columns: 1fr; }
  dd { margin: 3px 0 0; }
}
</style>
