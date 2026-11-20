<template>
  <!-- Single sign-on for an organization (ADM-1248): its verified email domains and its identity provider
       connections (OIDC or SAML). Only the organization's owners and admins may read or change them; the server
       refuses everyone else, and this page shows what it answered. Client secrets and certificates are write-only. -->
  <section class="sso" aria-labelledby="sso-title" data-test="org-sso">
    <h2 id="sso-title" class="sso-title">Single sign-on</h2>
    <p class="sso-lead">People with an email on a verified domain can sign in through your identity provider. Verify each domain first, then add a connection.</p>

    <p v-if="forbidden" class="sso-bad" role="alert" data-test="sso-forbidden">{{ forbidden }}</p>
    <template v-else>
      <section class="sso-card" aria-labelledby="sso-domains">
        <h3 id="sso-domains">Verified domains</h3>
        <p v-if="domainsLoading" class="sso-muted" role="status">Loading domains…</p>
        <ul v-else-if="domains.length" class="sso-list">
          <li v-for="d in domains" :key="d.id" data-test="sso-domain">
            <div class="sso-line"><strong>{{ d.domain }}</strong>
              <span class="sso-pill" :class="d.verified ? 'ok' : 'wait'">{{ d.verified ? `Verified ${day(d.verified_at)}` : 'Not verified yet' }}</span></div>
            <div v-if="!d.verified" class="sso-dns">
              <p>Add this TXT record at your DNS provider, then select Verify. It can take a few minutes to appear.</p>
              <dl><dt>Name</dt><dd><code>{{ d.txt_name }}</code><button type="button" class="sso-link" @click="copy(d.txt_name)">Copy</button></dd>
                <dt>Value</dt><dd><code>{{ d.txt_value }}</code><button type="button" class="sso-link" @click="copy(d.txt_value)">Copy</button></dd></dl>
              <p v-if="d.last_error" class="sso-bad" role="alert">{{ d.last_error }}</p>
            </div>
            <div class="sso-actions">
              <button v-if="!d.verified" type="button" class="sso-btn primary" :disabled="busy" data-test="sso-verify" @click="verify(d)">Verify</button>
              <button v-if="confirmDomain !== d.id" type="button" class="sso-btn quiet" :disabled="busy" @click="confirmDomain = d.id">Remove</button>
              <span v-else class="sso-confirm">Sign-in through SSO stops for this domain. <button type="button" class="sso-btn danger" data-test="sso-domain-remove" :disabled="busy" @click="removeDomain(d)">Remove domain</button><button type="button" class="sso-btn quiet" @click="confirmDomain = null">Keep</button></span>
            </div>
          </li>
        </ul>
        <p v-else class="sso-muted">No domains yet.</p>
        <form class="sso-row" data-test="sso-domain-form" @submit.prevent="addDomain">
          <label class="sso-field grow"><span>Domain</span><input v-model.trim="newDomain" type="text" placeholder="company.com" autocomplete="off" required /></label>
          <button type="submit" class="sso-btn primary" :disabled="busy || !newDomain">Add domain</button>
        </form>
        <p class="sso-muted">Public email domains such as gmail.com cannot be verified, and a domain belongs to one organization only.</p>
      </section>

      <section class="sso-card" aria-labelledby="sso-conns">
        <div class="sso-line"><h3 id="sso-conns">Connections</h3>
          <button v-if="!form" type="button" class="sso-btn" data-test="sso-new" @click="edit()">Add a connection</button></div>
        <p v-if="connsLoading" class="sso-muted" role="status">Loading connections…</p>
        <ul v-else-if="connections.length" class="sso-list">
          <li v-for="c in connections" :key="c.id" data-test="sso-connection">
            <div class="sso-line"><strong>{{ c.name }}</strong><span class="sso-pill">{{ c.protocol === 'saml' ? 'SAML' : 'OpenID Connect' }}</span>
              <span class="sso-pill" :class="c.enabled ? 'ok' : 'wait'">{{ c.enabled ? 'On' : 'Off' }}</span>
              <span v-if="c.enforced" class="sso-pill warn">Required for your domains</span></div>
            <dl class="sso-provider">
              <template v-if="c.protocol === 'oidc'"><dt>Redirect URI to register</dt><dd><code>{{ c.redirect_uri }}</code><button type="button" class="sso-link" @click="copy(c.redirect_uri)">Copy</button></dd></template>
              <template v-else>
                <dt>ACS URL</dt><dd><code>{{ c.acs_url }}</code><button type="button" class="sso-link" @click="copy(c.acs_url)">Copy</button></dd>
                <dt>Entity ID</dt><dd><code>{{ c.sp_entity_id }}</code><button type="button" class="sso-link" @click="copy(c.sp_entity_id)">Copy</button></dd>
                <dt>Metadata URL</dt><dd><code>{{ c.sp_metadata_url }}</code><button type="button" class="sso-link" @click="copy(c.sp_metadata_url)">Copy</button></dd>
              </template>
            </dl>
            <div class="sso-actions">
              <button type="button" class="sso-btn" @click="edit(c)">Edit</button>
              <button v-if="confirmConn !== c.id" type="button" class="sso-btn quiet" @click="confirmConn = c.id">Delete</button>
              <span v-else class="sso-confirm">People sign in another way from then on. <button type="button" class="sso-btn danger" data-test="sso-conn-delete" :disabled="busy" @click="removeConn(c)">Delete connection</button><button type="button" class="sso-btn quiet" @click="confirmConn = null">Keep</button></span>
            </div>
          </li>
        </ul>
        <p v-else-if="!form" class="sso-muted">No connection yet.</p>

        <form v-if="form" class="sso-form" data-test="sso-form" @submit.prevent="save">
          <fieldset class="sso-proto" :disabled="!!form.id"><legend>Protocol</legend>
            <label><input v-model="form.protocol" type="radio" value="oidc" /> OpenID Connect</label>
            <label><input v-model="form.protocol" type="radio" value="saml" /> SAML 2.0</label></fieldset>
          <label class="sso-field"><span>Name people see</span><input v-model.trim="form.name" type="text" maxlength="120" placeholder="Acme Okta" required /></label>
          <template v-if="form.protocol === 'oidc'">
            <label class="sso-field"><span>Issuer URL</span><input v-model.trim="form.issuer_url" type="url" placeholder="https://acme.okta.com" required /></label>
            <label class="sso-field"><span>Client ID</span><input v-model.trim="form.client_id" type="text" autocomplete="off" required /></label>
            <label class="sso-field"><span>Client secret</span><input v-model="form.client_secret" type="password" autocomplete="new-password" :placeholder="form.has_client_secret ? 'Saved. Leave blank to keep it.' : ''" :required="!form.has_client_secret" /></label>
          </template>
          <template v-else>
            <label class="sso-field"><span>Identity provider entity ID</span><input v-model.trim="form.idp_entity_id" type="text" required /></label>
            <label class="sso-field"><span>Metadata URL</span><input v-model.trim="form.idp_metadata_url" type="url" placeholder="https://idp.example.com/metadata" /></label>
            <p class="sso-muted">Or, without a metadata URL, the sign-in URL and signing certificate:</p>
            <label class="sso-field"><span>Sign-in (SSO) URL</span><input v-model.trim="form.idp_sso_url" type="url" /></label>
            <label class="sso-field"><span>Signing certificate (PEM)</span><textarea v-model="form.idp_x509_cert" rows="4" :placeholder="form.has_idp_x509_cert ? 'Saved. Leave blank to keep it.' : '-----BEGIN CERTIFICATE-----'"></textarea></label>
          </template>
          <label class="sso-field"><span>Role for people who join through it</span>
            <select v-model="form.default_role"><option value="member">Member</option><option value="viewer">Viewer</option><option value="billing">Billing</option></select></label>
          <label class="sso-check"><input v-model="form.enabled" type="checkbox" /> On</label>
          <label class="sso-check"><input v-model="form.enforced" type="checkbox" :disabled="!form.enabled" /> Require it for everyone on your verified domains</label>
          <p v-if="form.enforced" class="sso-warn">Password, Google and GitHub sign-in stop working for emails on your verified domains. This organization's owners can still sign in with their password, in case the identity provider fails.</p>
          <div class="sso-actions"><button type="submit" class="sso-btn primary" :disabled="busy">{{ form.id ? 'Save connection' : 'Add connection' }}</button><button type="button" class="sso-btn quiet" @click="form = null">Cancel</button></div>
        </form>
      </section>
      <p v-if="error" class="sso-bad" role="alert" data-test="sso-error">{{ error }}</p>
      <p v-else-if="done" class="sso-ok" role="status">{{ done }}</p>
    </template>
  </section>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import tenancyApi from '../../services/tenancyApi'
import { day, errorText } from '../../services/studioSharing'

const props = defineProps({ orgSlug: { type: String, required: true } })
const domains = ref([]), connections = ref([]), domainsLoading = ref(true), connsLoading = ref(true)
const forbidden = ref(''), error = ref(''), done = ref(''), busy = ref(false)
const newDomain = ref(''), confirmDomain = ref(null), confirmConn = ref(null), form = ref(null)
const slug = () => encodeURIComponent(props.orgSlug)
const FIELDS = ['protocol', 'name', 'issuer_url', 'client_id', 'idp_entity_id', 'idp_metadata_url', 'idp_sso_url', 'enabled', 'enforced', 'default_role']

function refused(e) {
  const s = e?.response?.status
  if (s === 403 || s === 404) { forbidden.value = 'Only this organization’s owners and admins can see and change single sign-on.'; return true }
  return false
}
async function loadDomains() {
  domainsLoading.value = true
  try { domains.value = (await tenancyApi.getOrgDomains(slug())).data?.domains || [] }
  catch (e) { if (!refused(e)) error.value = errorText(e, 'Domains could not be loaded.') } finally { domainsLoading.value = false }
}
async function loadConns() {
  connsLoading.value = true
  try { connections.value = (await tenancyApi.getOrgSso(slug())).data?.connections || [] }
  catch (e) { if (!refused(e)) error.value = errorText(e, 'Connections could not be loaded.') } finally { connsLoading.value = false }
}
async function run(fn, ok) {
  busy.value = true; error.value = ''; done.value = ''
  try { await fn(); done.value = ok } catch (e) { error.value = errorText(e) } finally { busy.value = false }
}
const addDomain = () => run(async () => { await tenancyApi.addOrgDomain(slug(), newDomain.value.toLowerCase()); newDomain.value = ''; await loadDomains() }, 'Domain added. Add its TXT record, then verify it.')
async function verify(d) {
  busy.value = true; error.value = ''; done.value = ''
  try {
    const { data } = await tenancyApi.verifyOrgDomain(slug(), d.id)
    domains.value = domains.value.map(x => (x.id === d.id ? data : x))
    if (data.verified) done.value = `${d.domain} is verified.`
    else if (!data.last_error) error.value = 'The TXT record was not found yet. Try again in a few minutes.'
  } catch (e) { error.value = errorText(e) } finally { busy.value = false }
}
const removeDomain = (d) => run(async () => { await tenancyApi.removeOrgDomain(slug(), d.id); confirmDomain.value = null; await loadDomains() }, 'Domain removed.')
function edit(c = null) {
  error.value = ''; done.value = ''
  form.value = c ? { ...Object.fromEntries(FIELDS.map(k => [k, c[k] ?? ''])), id: c.id, enabled: !!c.enabled, enforced: !!c.enforced, has_client_secret: !!c.has_client_secret, has_idp_x509_cert: !!c.has_idp_x509_cert, client_secret: '', idp_x509_cert: '' }
    : { protocol: 'oidc', name: '', issuer_url: '', client_id: '', client_secret: '', idp_entity_id: '', idp_metadata_url: '', idp_sso_url: '', idp_x509_cert: '', enabled: true, enforced: false, default_role: 'member' }
}
const save = () => run(async () => {
  const f = form.value
  const body = Object.fromEntries(FIELDS.map(k => [k, f[k]]))
  if (!f.enabled) body.enforced = false
  // Write-only: blank keeps what is saved.
  if (f.client_secret) body.client_secret = f.client_secret
  if (f.idp_x509_cert && f.idp_x509_cert.trim()) body.idp_x509_cert = f.idp_x509_cert.trim()
  if (f.id) await tenancyApi.updateOrgSso(slug(), f.id, body)
  else await tenancyApi.createOrgSso(slug(), body)
  form.value = null; await loadConns()
}, 'Connection saved.')
const removeConn = (c) => run(async () => { await tenancyApi.deleteOrgSso(slug(), c.id); confirmConn.value = null; await loadConns() }, 'Connection deleted.')
async function copy(text) {
  try { await navigator.clipboard.writeText(text); done.value = 'Copied.'; error.value = '' } catch { error.value = 'Copy did not work here. Select the text and copy it with your keyboard.' }
}
function loadAll() { forbidden.value = ''; error.value = ''; loadDomains(); loadConns() }
watch(() => form.value?.enabled, on => { if (form.value && !on) form.value.enforced = false })
watch(() => props.orgSlug, loadAll)
onMounted(loadAll)
</script>

<style scoped>
.sso{display:grid;gap:16px;color:var(--vm-ink)}
.sso-title{margin:0;font-size:20px;font-weight:600}.sso-lead{margin:0;max-width:640px;font-size:14px;line-height:1.6;color:var(--vm-ink-soft)}
.sso-card{display:grid;gap:12px;padding:20px;border:1px solid var(--vm-line);border-radius:12px;background:var(--vm-surface)}
.sso h3{margin:0;font-size:15px;font-weight:600}
.sso-list{list-style:none;margin:0;padding:0;display:grid;gap:12px}.sso-list>li{display:grid;gap:10px;padding:14px;border:1px solid var(--vm-line-2);border-radius:10px}
.sso-line{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px}.sso-line strong{flex:1 1 auto;font-size:14px;overflow-wrap:anywhere}
.sso-pill{font-size:11.5px;padding:2px 9px;border-radius:999px;border:1px solid var(--vm-line);color:var(--vm-ink-soft)}
.sso-pill.ok{border-color:transparent;background:var(--vm-green-soft,#e7f8ef);color:var(--vm-green-ink)}.sso-pill.wait{border-color:transparent;background:var(--vm-surface-soft);color:var(--vm-ink-soft)}.sso-pill.warn{border-color:transparent;background:var(--vm-amber-soft,#fff4e0);color:var(--vm-amber-ink,#92400e)}
.sso-dns{display:grid;gap:8px;padding:12px;border-radius:8px;background:var(--vm-surface-soft)}.sso-dns p{margin:0;font-size:13px;color:var(--vm-ink-soft)}
.sso dl{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;margin:0;font-size:13px}.sso dt{color:var(--vm-ink-soft)}.sso dd{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0;min-width:0}
.sso code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.5px;overflow-wrap:anywhere;word-break:break-all}
.sso-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.sso-row{display:flex;flex-wrap:wrap;align-items:flex-end;gap:8px}
.sso-field{display:grid;gap:6px;font-size:12.5px;color:var(--vm-ink-soft)}.sso-field.grow{flex:1 1 220px}
.sso input:not([type=checkbox]):not([type=radio]),.sso select,.sso textarea{box-sizing:border-box;min-height:40px;padding:8px 10px;border:1px solid var(--vm-line);border-radius:8px;background:var(--vm-surface);color:var(--vm-ink);font:inherit;font-size:14px}
.sso textarea{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.5px;resize:vertical}
.sso-form{display:grid;gap:12px;max-width:560px;padding-top:6px}
.sso-proto{display:flex;flex-wrap:wrap;gap:16px;margin:0;padding:0;border:0;font-size:14px}.sso-proto legend{margin-bottom:6px;font-size:12.5px;color:var(--vm-ink-soft)}.sso-proto label{display:flex;align-items:center;gap:6px;min-height:36px;cursor:pointer}
.sso-check{display:flex;align-items:center;gap:8px;min-height:36px;font-size:14px;cursor:pointer}.sso-check input,.sso-proto input{width:17px;height:17px;accent-color:var(--vm-violet)}
.sso-btn{min-height:40px;padding:0 14px;border:1px solid var(--vm-line);border-radius:8px;background:var(--vm-surface);color:var(--vm-ink);font:inherit;font-size:13px;font-weight:500;cursor:pointer}.sso-btn:hover:not(:disabled){background:var(--vm-surface-soft)}.sso-btn:disabled{opacity:.55;cursor:not-allowed}
.sso-btn.primary{background:var(--vm-violet);border-color:transparent;color:#fff}.sso-btn.primary:hover:not(:disabled){background:var(--vm-violet-d)}.sso-btn.quiet{border-color:transparent;background:transparent;color:var(--vm-ink-soft)}.sso-btn.danger{border-color:var(--vm-danger);color:var(--vm-danger)}
.sso-link{min-height:28px;padding:0;border:0;background:none;color:var(--vm-link);font:inherit;font-size:12.5px;cursor:pointer}
.sso-confirm{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:13px;color:var(--vm-ink-soft)}
.sso-muted{margin:0;font-size:13px;color:var(--vm-ink-soft)}.sso-bad{margin:0;font-size:13px;color:var(--vm-danger)}.sso-ok{margin:0;font-size:13px;color:var(--vm-green-ink)}.sso-warn{margin:0;font-size:13px;line-height:1.6;color:var(--vm-amber-ink,#92400e)}
.sso :focus-visible{outline:2px solid var(--vm-sky,var(--vm-violet));outline-offset:2px}
@media(max-width:640px){.sso-card{padding:14px}.sso input:not([type=checkbox]):not([type=radio]),.sso select,.sso textarea{font-size:16px;min-height:44px}.sso-btn{min-height:44px}.sso dl{grid-template-columns:1fr}}
</style>
