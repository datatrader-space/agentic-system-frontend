<!--
  Add or change a database connection (ADM-1363): the engine (fixed once saved), where it is (host, port with the
  engine's default, database, user, or a MongoDB connection string), the password, TLS, Access and an optional SSH
  tunnel (bastion host, user, a private key file or a password, and the pinned host key).

  No secret is ever shown back: every secret field starts empty and says "Leave empty to keep" when one is saved; a
  "Clear" box removes it (databaseConnectionForm.js decides what is sent). A weaker TLS mode shows what it means. The
  Access choice shows the server's advice for the engine (a database user with only read rights).
-->
<template>
  <AppDialog :open="open" :title="editing ? `Edit ${original?.name || 'connection'}` : 'Add a database connection'" size="lg" @update:open="emit('update:open', $event)">
    <PageLoader v-if="loading" label="Loading the connection…" />
    <p v-else-if="loadError" class="dcd-err" role="alert">{{ loadError }}</p>
    <form v-else :id="formId" class="dcd" novalidate @submit.prevent="save(false)">
      <div class="dcd-grid">
        <Field :id="`${formId}-name`" label="Name" :error="err('name')" class="dcd-wide">
          <input :id="`${formId}-name`" v-model="form.name" class="dcd-in" type="text" maxlength="120" autocomplete="off" placeholder="Orders database" :aria-invalid="ariaInvalid('name')">
        </Field>
        <Field :id="`${formId}-engine`" label="Engine" :help="editing ? 'The engine of a saved connection cannot change.' : ''">
          <select :id="`${formId}-engine`" v-model="form.engine" class="dcd-in" :disabled="editing" @change="onEngine">
            <option v-for="e in engines" :key="e.value" :value="e.value">{{ e.label }}</option>
          </select>
        </Field>

        <template v-if="form.engine === 'mongodb'">
          <fieldset class="dcd-radios dcd-wide">
            <legend class="dcd-label">Connect with</legend>
            <label><input v-model="form.mongo_mode" type="radio" :name="`${formId}-mongo`" value="uri"> A connection string</label>
            <label><input v-model="form.mongo_mode" type="radio" :name="`${formId}-mongo`" value="host"> A host and port</label>
          </fieldset>
        </template>

        <template v-if="usesUri">
          <Field :id="`${formId}-uri`" label="Connection string" :error="err('uri')" class="dcd-wide"
                 :help="form.has_uri ? 'A connection string is saved. Leave empty to keep it.' : 'mongodb+srv://user:password@cluster.example.net/. It holds the password, so it is stored encrypted and never shown again.'">
            <input :id="`${formId}-uri`" v-model="form.uri" class="dcd-in mono" type="password" autocomplete="new-password" spellcheck="false"
                   :placeholder="form.has_uri ? 'Leave empty to keep the saved connection string' : 'mongodb+srv://…'" :aria-invalid="ariaInvalid('uri')">
          </Field>
          <label v-if="form.has_uri" class="dcd-check dcd-wide"><input v-model="form.clear_uri" type="checkbox"> Clear the saved connection string</label>
          <Field :id="`${formId}-db`" label="Database (optional)" help="When the connection string does not name one.">
            <input :id="`${formId}-db`" v-model="form.database" class="dcd-in mono" type="text" autocomplete="off" spellcheck="false">
          </Field>
        </template>
        <template v-else>
          <Field :id="`${formId}-host`" label="Host" :error="err('host')" :help="form.ssh.enabled ? 'As the SSH bastion reaches it: a private address is fine here.' : 'A public host name or address. Private addresses are refused; use an SSH tunnel for a private database.'">
            <input :id="`${formId}-host`" v-model="form.host" class="dcd-in mono" type="text" autocomplete="off" spellcheck="false" placeholder="db.example.com" :aria-invalid="ariaInvalid('host')">
          </Field>
          <Field :id="`${formId}-port`" label="Port" :error="err('port')" :help="`The ${engineLabel} default is ${defaultPort(form.engine, engines)}.`">
            <input :id="`${formId}-port`" v-model.number="form.port" class="dcd-in mono" type="number" min="1" max="65535" inputmode="numeric" :aria-invalid="ariaInvalid('port')">
          </Field>
          <Field :id="`${formId}-db`" :label="form.engine === 'redis' ? 'Database number (optional)' : 'Database'" :error="err('database')">
            <input :id="`${formId}-db`" v-model="form.database" class="dcd-in mono" type="text" autocomplete="off" spellcheck="false" :placeholder="form.engine === 'redis' ? '0' : ''" :aria-invalid="ariaInvalid('database')">
          </Field>
          <Field :id="`${formId}-user`" :label="form.engine === 'redis' ? 'User (optional)' : 'User'">
            <input :id="`${formId}-user`" v-model="form.username" class="dcd-in mono" type="text" autocomplete="off" spellcheck="false">
          </Field>
          <Field :id="`${formId}-pw`" label="Password" class="dcd-wide" :help="form.has_password ? 'A password is saved. Leave empty to keep it.' : 'Stored encrypted. It is never shown again.'">
            <input :id="`${formId}-pw`" v-model="form.password" class="dcd-in" type="password" autocomplete="new-password" :placeholder="form.has_password ? 'Leave empty to keep the saved password' : ''">
          </Field>
          <label v-if="form.has_password" class="dcd-check dcd-wide"><input v-model="form.clear_password" type="checkbox"> Clear the saved password</label>
        </template>
      </div>

      <!-- TLS -->
      <fieldset class="dcd-set">
        <legend class="dcd-label">Encryption (TLS)</legend>
        <label v-for="m in tlsModes" :key="m.value" class="dcd-radio"><input v-model="form.tls_mode" type="radio" :name="`${formId}-tls`" :value="m.value"> {{ m.label }}</label>
        <p v-if="TLS_WARNINGS[form.tls_mode]" class="dcd-warn" role="alert"><Icon icon="lucide:shield-alert" aria-hidden="true" /><span>{{ TLS_WARNINGS[form.tls_mode] }}</span></p>
      </fieldset>

      <!-- Access -->
      <fieldset class="dcd-set">
        <legend class="dcd-label">Access</legend>
        <label v-for="a in accessModes" :key="a.value" class="dcd-radio">
          <input v-model="form.access" type="radio" :name="`${formId}-access`" :value="a.value"> {{ a.label }}
          <span class="dcd-sub">{{ a.value === 'read_write' ? 'Workflow steps may write. An agent\'s write always asks you first on an approval card.' : 'Workflows and agents can only read. The database enforces it.' }}</span>
        </label>
        <p v-if="advice" class="dcd-note"><Icon icon="lucide:shield-check" aria-hidden="true" /><span>{{ advice }}</span></p>
      </fieldset>

      <!-- SSH tunnel -->
      <fieldset class="dcd-set">
        <legend class="dcd-label">SSH tunnel</legend>
        <label class="dcd-check"><input v-model="form.ssh.enabled" type="checkbox"> Connect through an SSH bastion (for a database on a private network)</label>
        <div v-if="form.ssh.enabled" class="dcd-grid">
          <Field :id="`${formId}-sh`" label="SSH host" :error="err('ssh.host')" help="The bastion's public address.">
            <input :id="`${formId}-sh`" v-model="form.ssh.host" class="dcd-in mono" type="text" autocomplete="off" spellcheck="false" :aria-invalid="ariaInvalid('ssh.host')">
          </Field>
          <Field :id="`${formId}-sp`" label="SSH port" :error="err('ssh.port')">
            <input :id="`${formId}-sp`" v-model.number="form.ssh.port" class="dcd-in mono" type="number" min="1" max="65535" :aria-invalid="ariaInvalid('ssh.port')">
          </Field>
          <Field :id="`${formId}-su`" label="SSH user" :error="err('ssh.username')">
            <input :id="`${formId}-su`" v-model="form.ssh.username" class="dcd-in mono" type="text" autocomplete="off" spellcheck="false" :aria-invalid="ariaInvalid('ssh.username')">
          </Field>
          <fieldset class="dcd-radios">
            <legend class="dcd-label">Sign in with</legend>
            <label><input v-model="form.ssh.auth" type="radio" :name="`${formId}-ssh-auth`" value="key"> A private key</label>
            <label><input v-model="form.ssh.auth" type="radio" :name="`${formId}-ssh-auth`" value="password"> A password</label>
          </fieldset>
          <template v-if="form.ssh.auth === 'key'">
            <div class="dcd-field dcd-wide">
              <span class="dcd-label">Private key</span>
              <div class="dcd-key">
                <button type="button" class="tp-btn" @click="keyInput?.click()"><Icon icon="lucide:key-round" aria-hidden="true" />{{ keyFileName ? 'Choose another file' : 'Upload the key file' }}</button>
                <input ref="keyInput" type="file" class="tp-sr" tabindex="-1" aria-hidden="true" @change="onKeyFile">
                <span v-if="keyFileName" class="dcd-sub"><Icon icon="lucide:check" aria-hidden="true" />{{ keyFileName }} read. It is sent when you save.</span>
                <span v-else-if="form.ssh.has_private_key" class="dcd-sub">A key is saved. Leave it to keep it.</span>
              </div>
              <label class="dcd-sub" :for="`${formId}-pk`">Or paste it</label>
              <textarea :id="`${formId}-pk`" v-model="form.ssh.private_key" class="dcd-in mono" rows="3" spellcheck="false" autocomplete="off"
                        :placeholder="form.ssh.has_private_key ? 'Leave empty to keep the saved key' : '-----BEGIN OPENSSH PRIVATE KEY-----'" :aria-invalid="ariaInvalid('ssh.private_key')" @input="keyFileName = ''" />
              <p v-if="err('ssh.private_key')" class="dcd-err">{{ err('ssh.private_key') }}</p>
              <label v-if="form.ssh.has_private_key" class="dcd-check"><input v-model="form.ssh.clear_private_key" type="checkbox"> Clear the saved key</label>
            </div>
            <Field :id="`${formId}-kp`" label="Key passphrase (optional)" :help="form.ssh.has_key_passphrase ? 'A passphrase is saved. Leave empty to keep it.' : ''">
              <input :id="`${formId}-kp`" v-model="form.ssh.key_passphrase" class="dcd-in" type="password" autocomplete="new-password">
            </Field>
          </template>
          <Field v-else :id="`${formId}-spw`" label="SSH password" :error="err('ssh.password')" :help="form.ssh.has_password ? 'A password is saved. Leave empty to keep it.' : ''">
            <input :id="`${formId}-spw`" v-model="form.ssh.password" class="dcd-in" type="password" autocomplete="new-password" :aria-invalid="ariaInvalid('ssh.password')">
          </Field>
          <div class="dcd-field dcd-wide">
            <span class="dcd-label">Host key</span>
            <p v-if="form.ssh.host_key_fingerprint" class="dcd-fp">
              <Icon icon="lucide:fingerprint" aria-hidden="true" />
              <code translate="no">{{ form.ssh.host_key_type }} {{ form.ssh.host_key_fingerprint }}</code>
              <span v-if="form.ssh.host_key_pinned_at" class="dcd-sub">pinned {{ when(form.ssh.host_key_pinned_at) }}</span>
            </p>
            <p v-else class="dcd-sub">Pinned on the first connection: the fingerprint is kept, and a bastion that later shows another key is refused.</p>
            <label v-if="form.ssh.host_key_fingerprint" class="dcd-check"><input v-model="form.ssh.reset_host_key" type="checkbox"> Reset the host key (the bastion's key changed on purpose; the next test pins the new one)</label>
          </div>
        </div>
      </fieldset>

      <p v-if="outboundIps.length" class="dcd-note">
        <Icon icon="lucide:network" aria-hidden="true" />
        <span>Allow these addresses in your database's firewall: <code v-for="ip in outboundIps" :key="ip" translate="no" class="dcd-ip">{{ ip }}</code>. {{ outboundNote }}</span>
      </p>

      <div v-if="testResult" class="dcd-test" :class="testResult.ok ? 'is-ok' : 'is-bad'" role="status">
        <Icon :icon="testResult.ok ? 'lucide:circle-check' : 'lucide:circle-alert'" aria-hidden="true" />
        <span><strong>{{ testResult.ok ? 'Connected.' : 'The test failed.' }}</strong> {{ testResult.message }}<template v-if="testResult.host_key_fingerprint"> Host key: <code translate="no">{{ testResult.host_key_fingerprint }}</code></template></span>
      </div>
      <p v-if="saveError" class="dcd-err" role="alert">{{ saveError }}</p>
    </form>
    <template #footer>
      <button type="button" class="tp-btn" @click="emit('update:open', false)">{{ savedOnce ? 'Close' : 'Cancel' }}</button>
      <button type="button" class="tp-btn" :disabled="busy || loading || !!loadError" @click="save(true)">
        <Icon :icon="busy && testing ? 'lucide:loader-circle' : 'lucide:plug-zap'" :class="{ spin: busy && testing }" aria-hidden="true" />Save and test
      </button>
      <button type="submit" class="tp-btn tp-btn--primary" :form="formId" :disabled="busy || loading || !!loadError">{{ busy && !testing ? 'Saving…' : 'Save' }}</button>
    </template>
  </AppDialog>
</template>

<script setup>
import { computed, defineComponent, h, onMounted, onUpdated, ref, useId, watch } from 'vue'
import { Icon } from '@iconify/vue'
import AppDialog from '../common/AppDialog.vue'
import PageLoader from '../common/PageLoader.vue'
import api from '@/services/api'
import { notify } from '@/composables/useNotify'
import {
  ACCESS_FALLBACK, ENGINE_FALLBACK, TLS_FALLBACK, TLS_WARNINGS, buildPayload, connectionErrorText, defaultPort, emptyForm,
  formFromProjection, formProblems, normalizeOptions,
} from './databaseConnectionForm'
import '../workflow-tables/workflow-tables.css'

// A labelled field: the label, the control (slot), its help or its error. The control (the element with `id`) is
// described by the help or the error that is shown (aria-describedby, set after each render).
const Field = defineComponent({
  props: { id: String, label: String, help: { type: String, default: '' }, error: { type: String, default: '' } },
  setup(p, { slots }) {
    const describe = () => {
      const el = typeof document !== 'undefined' ? document.getElementById(p.id) : null
      if (!el) return
      const target = p.error ? `${p.id}-err` : (p.help ? `${p.id}-help` : '')
      if (target) el.setAttribute('aria-describedby', target)
      else el.removeAttribute('aria-describedby')
    }
    onMounted(describe)
    onUpdated(describe)
    return () => h('div', { class: 'dcd-field' }, [
      h('label', { class: 'dcd-label', for: p.id }, p.label),
      slots.default?.(),
      p.error ? h('p', { class: 'dcd-err', id: `${p.id}-err` }, p.error) : (p.help ? h('p', { class: 'dcd-sub', id: `${p.id}-help` }, p.help) : null),
    ])
  },
})

const props = defineProps({
  open: { type: Boolean, default: false },
  // The connection to edit ({ id, ... } projection), or null to add one.
  connection: { type: Object, default: null },
  // The list response's reference data: { engines, tls_modes, access, read_only_advice, outbound_ips, outbound_ips_note }.
  meta: { type: Object, default: () => ({}) },
  workspace: { type: [String, Number], default: null },
})
const emit = defineEmits(['update:open', 'saved'])

const formId = `dcd-${useId()}`
const engines = computed(() => normalizeOptions(props.meta.engines, ENGINE_FALLBACK))
const tlsModes = computed(() => normalizeOptions(props.meta.tls_modes, TLS_FALLBACK))
const accessModes = computed(() => normalizeOptions(props.meta.access, ACCESS_FALLBACK))
const outboundIps = computed(() => (Array.isArray(props.meta.outbound_ips) ? props.meta.outbound_ips : []))
const outboundNote = computed(() => props.meta.outbound_ips_note || 'An address does not prove which customer is calling: the database user does.')

const editing = computed(() => !!props.connection?.id)
const original = ref(null)
const form = ref(emptyForm())
const loading = ref(false)
const loadError = ref('')
const busy = ref(false)
const testing = ref(false)
const tried = ref(false)
const saveError = ref('')
const testResult = ref(null)
const savedOnce = ref(false)
const keyInput = ref(null)
const keyFileName = ref('')
const savedId = ref(null)

const engineLabel = computed(() => engines.value.find((e) => e.value === form.value.engine)?.label || form.value.engine)
const usesUri = computed(() => form.value.engine === 'mongodb' && form.value.mongo_mode === 'uri')
const advice = computed(() => props.meta.read_only_advice?.[form.value.engine] || original.value?.read_only_advice || '')
const problems = computed(() => formProblems(form.value, { editing: editing.value }))
const err = (key) => (tried.value ? problems.value[key] || '' : '')
const ariaInvalid = (key) => (err(key) ? 'true' : 'false')
const when = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString() }

async function start() {
  tried.value = false
  saveError.value = ''
  testResult.value = null
  savedOnce.value = false
  keyFileName.value = ''
  original.value = null
  savedId.value = props.connection?.id ?? null
  loadError.value = ''
  if (!editing.value) { form.value = emptyForm(engines.value[0]?.value || 'postgres', engines.value); return }
  // The owner's fields (host, user, has_password, ssh) come from the connection's own read.
  loading.value = true
  try {
    const { data } = await api.getDatabaseConnection(props.connection.id)
    original.value = data
    form.value = formFromProjection(data, engines.value)
  } catch (e) {
    loadError.value = connectionErrorText(e, 'The connection could not be loaded')
  } finally {
    loading.value = false
  }
}
watch(() => props.open, (o) => { if (o) start() }, { immediate: true })

function onEngine() {
  const f = form.value
  const known = engines.value.map((e) => Number(e.default_port)).filter(Boolean)
  // Keep a port the person typed; replace one that was only the previous engine's default.
  if (f.port === '' || known.includes(Number(f.port))) f.port = defaultPort(f.engine, engines.value)
}

async function onKeyFile(ev) {
  const file = ev.target.files?.[0]
  ev.target.value = ''
  if (!file) return
  if (file.size > 64 * 1024) { notify.error('That file is too large to be an SSH private key.'); return }
  form.value.ssh.private_key = await file.text()
  form.value.ssh.clear_private_key = false
  keyFileName.value = file.name
}

async function save(andTest) {
  tried.value = true
  saveError.value = ''
  testResult.value = null
  if (Object.keys(problems.value).length) return
  busy.value = true
  testing.value = andTest
  try {
    const id = savedId.value
    const payload = buildPayload(form.value, { editing: id != null, workspace: props.workspace })
    let saved
    if (id != null) {
      const { data } = await api.updateDatabaseConnection(id, payload)
      saved = data?.connection || data
    } else {
      const { data } = await api.createDatabaseConnection(payload)
      saved = data
    }
    savedId.value = saved?.id ?? id
    savedOnce.value = true
    // The secrets just sent are not kept in the page: the form now shows them as saved.
    original.value = { ...(original.value || {}), ...saved }
    const mongoMode = form.value.mongo_mode
    form.value = { ...formFromProjection(original.value, engines.value), mongo_mode: mongoMode }
    keyFileName.value = ''
    emit('saved', saved)
    if (andTest) {
      const { data } = await api.testDatabaseConnection(savedId.value)
      testResult.value = data
      emit('saved', { ...saved, last_test: { at: new Date().toISOString(), ok: !!data?.ok, message: data?.message || '' } })
    } else {
      notify.success(id != null ? 'Connection saved' : 'Connection added')
      emit('update:open', false)
    }
  } catch (e) {
    saveError.value = connectionErrorText(e, 'The connection was not saved')
    const field = e?.response?.data?.field
    if (field) saveError.value = `${saveError.value} (${field})`
  } finally {
    busy.value = false
    testing.value = false
  }
}
</script>

<style scoped>
.dcd { display: grid; gap: 16px; }
.dcd-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.dcd-wide { grid-column: 1 / -1; }
.dcd :deep(.dcd-field) { display: grid; gap: 4px; min-width: 0; align-content: start; }
.dcd :deep(.dcd-label), .dcd-label { font-size: 12px; font-weight: 600; color: var(--vm-ink-soft); }
.dcd :deep(.dcd-sub), .dcd-sub { margin: 0; font-size: 12px; line-height: 1.45; color: var(--vm-ink-faint); display: inline-flex; gap: 4px; align-items: center; }
.dcd :deep(.dcd-err), .dcd-err { margin: 0; font-size: 12px; color: var(--vm-red-ink); }
.dcd-in { width: 100%; min-height: 36px; padding: 7px 9px; border: 1px solid var(--vm-line-2); border-radius: 6px; background: var(--vm-surface); color: var(--vm-ink); font: inherit; font-size: 13px; }
.dcd-in.mono { font-family: var(--vm-font-mono, ui-monospace, monospace); font-size: 12px; }
.dcd-in:disabled { background: var(--vm-surface-soft); color: var(--vm-ink-soft); cursor: not-allowed; }
.dcd-in:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.dcd-in[aria-invalid="true"] { border-color: var(--vm-red-ink); }
.dcd-set { display: grid; gap: 8px; margin: 0; padding: 12px; border: 1px solid var(--vm-line); border-radius: 8px; min-width: 0; }
.dcd-set > legend { padding: 0 4px; }
.dcd-radio { display: grid; grid-template-columns: auto 1fr; gap: 2px 8px; align-items: center; font-size: 13px; color: var(--vm-ink); cursor: pointer; }
.dcd-radio .dcd-sub { grid-column: 2; }
.dcd-radios { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 0; padding: 0; border: 0; font-size: 13px; color: var(--vm-ink); }
.dcd-radios legend { width: 100%; margin-bottom: 4px; }
.dcd-radios label { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; cursor: pointer; }
.dcd input[type="radio"], .dcd input[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--vm-primary); }
.dcd-check { display: flex; align-items: center; gap: 8px; min-height: 32px; font-size: 13px; color: var(--vm-ink-soft); cursor: pointer; }
.dcd-warn, .dcd-note, .dcd-test { display: flex; gap: 8px; align-items: flex-start; margin: 0; padding: 8px 10px; border-radius: 6px; font-size: 12px; line-height: 1.5; }
.dcd-warn { background: var(--vm-amber-soft); color: var(--vm-amber-ink); }
.dcd-note { background: var(--vm-surface-soft); color: var(--vm-ink-soft); }
.dcd-test.is-ok { background: var(--vm-green-soft); color: var(--vm-green-ink); }
.dcd-test.is-bad { background: var(--vm-red-soft); color: var(--vm-red-ink); }
.dcd :deep(svg) { width: 14px; height: 14px; flex-shrink: 0; }
.dcd-warn :deep(svg), .dcd-note :deep(svg), .dcd-test :deep(svg) { margin-top: 2px; }
.dcd-ip { margin: 0 3px; padding: 1px 5px; border-radius: 4px; background: var(--vm-surface); font: 12px var(--vm-font-mono, ui-monospace, monospace); color: var(--vm-ink); }
.dcd-key { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.dcd-fp { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 0; font-size: 12px; color: var(--vm-ink-soft); }
.dcd-fp code { font: 12px var(--vm-font-mono, ui-monospace, monospace); color: var(--vm-ink); overflow-wrap: anywhere; }
@media (max-width: 640px) { .dcd-grid { grid-template-columns: minmax(0, 1fr); } }
@media (pointer: coarse) { .dcd-in, .dcd-check, .dcd-radios label { min-height: 44px; } }
</style>
