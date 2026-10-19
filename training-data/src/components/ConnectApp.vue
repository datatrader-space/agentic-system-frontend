<script setup>
// Connect app: the keys an app sends this project its data with, and how to send (the old UI's "Send data" tab).
// Backend: training_models_data/app_api.py — keys/, keys/<id>/rotate|revoke/, sending/. Only the project's Owner
// manages keys; a new key is in the one answer that made it and is never shown again.
import { computed, onMounted, ref } from 'vue';
import { KeyRound, Copy, RotateCw, Ban, Plug } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import UiDialog from './UiDialog.vue';
import { listKeys, createKey, rotateKey, revokeKey, sendingGuide, ago } from '../api/training.js';
import { llmApi, pathName } from '../api/llm.js';

const props = defineProps({ project: Object });
const emit = defineEmits(['navigate']);
const owner = computed(() => (props.project?.rights || []).includes('manage'));
const loading = ref(true); const error = ref(''); const keys = ref(null); const guide = ref(null);
const keyName = ref(''); const busy = ref(false); const fresh = ref(null); const copied = ref('');
const confirm = ref(null);
// A language-model project's form of this page (plan §2.1): how an app sends conversations, and the key mapping for
// payloads of the app's own shape (llm/app_api.py chat_sending_guide, chat_mapping).
const isLlm = computed(() => props.project?.family === 'llm');
const mapping = ref(null); const chosen = ref({ user: '', assistant: '', system: '', group: '', system_text: '' }); const mapped = ref('');
function showMapping(body) {
  mapping.value = body;
  const m = body.mapping || {};
  const key = path => (path ? JSON.stringify(path) : '');
  chosen.value = { user: key(m.user), assistant: key(m.assistant), system: key(m.system), group: key(m.group), system_text: m.system_text || '' };
}
async function saveMapping() {
  if (busy.value) return; busy.value = true; error.value = ''; mapped.value = '';
  const path = value => (value ? JSON.parse(value) : null);
  try {
    const body = await llmApi.saveMapping(props.project.ref, { user: path(chosen.value.user), assistant: path(chosen.value.assistant),
      system: path(chosen.value.system), group: path(chosen.value.group), system_text: chosen.value.system_text });
    showMapping(body);
    mapped.value = `Saved. ${body.made?.made ?? 0} waiting record(s) became examples; ${body.waiting} still wait.`;
  } catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}

async function load() {
  if (!props.project || !owner.value) { loading.value = false; return; }
  loading.value = true; error.value = '';
  try {
    [keys.value, guide.value] = await Promise.all([listKeys(props.project.ref), isLlm.value ? llmApi.sending(props.project.ref) : sendingGuide(props.project.ref)]);
    if (isLlm.value) showMapping(await llmApi.mapping(props.project.ref));
  }
  catch (e) { error.value = e.message; }
  finally { loading.value = false; }
}
onMounted(load);

async function make() {
  if (busy.value) return; busy.value = true; error.value = '';
  try { fresh.value = await createKey(props.project.ref, keyName.value.trim()); keyName.value = ''; await load(); }
  catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}
async function act() {
  const { kind, row } = confirm.value; confirm.value = null; busy.value = true; error.value = '';
  try {
    if (kind === 'rotate') fresh.value = await rotateKey(props.project.ref, row.id);
    else await revokeKey(props.project.ref, row.id);
    await load();
  } catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}
async function copy(text, what) {
  try { await navigator.clipboard.writeText(text); copied.value = what; setTimeout(() => { copied.value = ''; }, 2000); }
  catch { copied.value = ''; }
}
const curl = computed(() => guide.value && isLlm.value ? [
  `curl -X POST '${guide.value.endpoint}' \\`,
  `  -H 'Authorization: Bearer <your key>' \\`,
  `  -H 'Idempotency-Key: <one value per conversation>' \\`,
  `  -H 'Content-Type: application/json' \\`,
  `  -d '${JSON.stringify({ payload: guide.value.example_payload })}'`,
].join('\n') : guide.value ? [
  `curl -X POST '${guide.value.endpoint}' \\`,
  `  -H 'Authorization: Bearer <your key>' \\`,
  `  -H 'Idempotency-Key: <a unique id for this record>' \\`,
  guide.value.vision ? `  -F 'payload=${guide.value.payload_line}' \\` : `  -H 'Content-Type: application/json' \\`,
  guide.value.vision ? `  -F 'file=@photo.jpg'` : `  -d '{"payload": ${guide.value.payload_line}}'`,
].join('\n') : '');
</script>

<template>
  <div class="studio connect-app">
    <section v-if="!owner" class="panel empty-state"><KeyRound :size="30" /><h2>Connect an app</h2><p>Only the project's Owner creates keys and sees how an app sends this project its data.</p></section>
    <template v-else>
      <div v-if="error" class="notice" role="alert"><span>{{ error }}</span></div>
      <section class="panel">
        <div class="eyebrow">KEYS</div>
        <h2>Let an app send its data here</h2>
        <p>An app (FitMyWall, a shop, a sensor) sends each record with a key. A key is shown once, when it is made: keep it in the app's settings.</p>
        <p v-if="keys && !keys.can_create" class="connect-refused"><UiBadge>Not yet</UiBadge> {{ keys.refused }}</p>
        <form v-else class="connect-new" @submit.prevent="make"><label class="field-label">Key name<input v-model="keyName" class="text-input" maxlength="120" placeholder="e.g. FitMyWall app"></label><UiButton type="submit" variant="primary" :disabled="busy">{{ busy ? 'Creating…' : 'Create key' }}</UiButton></form>
        <div v-if="fresh" class="connect-fresh" role="status"><strong>Your new key. Copy it now: it will not be shown again.</strong><code>{{ fresh.key }}</code><UiButton @click="copy(fresh.key, 'key')"><Copy :size="15" /> {{ copied === 'key' ? 'Copied' : 'Copy key' }}</UiButton><UiButton @click="fresh = null">I have kept it</UiButton></div>
        <p v-if="loading" class="field-help">Loading…</p>
        <table v-else-if="keys && keys.keys.length" class="connect-table"><thead><tr><th>Key</th><th>Name</th><th>Made</th><th>Last used</th><th>Requests</th><th></th></tr></thead><tbody>
          <tr v-for="row in keys.keys" :key="row.id" :class="{revoked: row.revoked}"><td><code>{{ row.hint }}</code></td><td>{{ row.name || '—' }}</td><td>{{ ago(row.created_at) }}</td><td>{{ row.last_used_at ? ago(row.last_used_at) : 'Never' }}</td><td>{{ row.requests }}</td>
            <td><UiBadge v-if="row.revoked">Revoked</UiBadge><template v-else><UiButton :disabled="busy || !keys.can_create" @click="confirm = {kind: 'rotate', row}"><RotateCw :size="14" /> Replace</UiButton> <UiButton :disabled="busy" @click="confirm = {kind: 'revoke', row}"><Ban :size="14" /> Revoke</UiButton></template></td></tr>
        </tbody></table>
        <p v-else-if="keys" class="field-help">No key yet.</p>
      </section>

      <section v-if="guide && isLlm" class="panel">
        <div class="eyebrow">INTEGRATION GUIDE</div>
        <h2><Plug :size="18" /> How your app sends conversations</h2>
        <p>Send one conversation per request to this address, as JSON, with the project key. Every conversation becomes one training example at once.</p>
        <label class="field-label">Address<div class="connect-line"><code>{{ guide.endpoint }}</code><UiButton @click="copy(guide.endpoint, 'address')"><Copy :size="15" /> {{ copied === 'address' ? 'Copied' : 'Copy' }}</UiButton></div></label>
        <p v-if="guide.training_refused" class="connect-refused"><UiBadge>Note</UiBadge> {{ guide.training_refused }}</p>
        <h3>Example</h3>
        <pre class="code-block">{{ curl }}</pre>
        <UiButton @click="copy(curl, 'curl')"><Copy :size="15" /> {{ copied === 'curl' ? 'Copied' : 'Copy example' }}</UiButton>
        <h3>The payload</h3>
        <pre class="code-block">{{ JSON.stringify(guide.example_payload, null, 2) }}</pre>
        <table class="connect-table"><thead><tr><th>Field</th><th>Needed</th><th>What it is</th></tr></thead><tbody>
          <tr v-for="field in guide.fields" :key="field.key"><td><code>{{ field.key }}</code></td><td>{{ field.required ? 'Yes' : 'No' }}</td><td>{{ field.about }}</td></tr>
        </tbody></table>
        <p class="field-help">{{ guide.file_part }}</p>
        <h3>A payload of your own shape</h3>
        <p>{{ guide.mapping_about }}</p>
        <template v-if="mapping">
          <p class="field-help">{{ mapping.records }} record(s) received; {{ mapping.waiting }} wait for a mapping.</p>
          <div v-if="mapping.keys.length" class="connect-mapping">
            <label v-for="(label, field) in {user: 'User message', assistant: 'Assistant answer', system: 'System message (optional)', group: 'Conversation id (optional)'}" :key="field" class="field-label">{{ label }}
              <select v-model="chosen[field]" class="text-input"><option value="">{{ field === 'user' || field === 'assistant' ? 'Choose…' : 'None' }}</option>
                <option v-for="k in mapping.keys" :key="JSON.stringify(k.path)" :value="JSON.stringify(k.path)">{{ pathName(k.path) }} ({{ k.records }} records{{ k.example ? `, e.g. ${String(k.example).slice(0, 40)}` : '' }})</option></select></label>
            <label class="field-label">Fixed system message (optional)<input v-model="chosen.system_text" class="text-input" maxlength="4000" placeholder="Used when no key holds it"></label>
          </div>
          <p v-else class="field-help">No record has arrived yet: the keys to map show here once one has.</p>
          <UiButton v-if="mapping.keys.length" variant="primary" :disabled="busy" @click="saveMapping">Save the mapping</UiButton>
          <p v-if="mapped" class="field-help" role="status">{{ mapped }}</p>
        </template>
        <h3>What the address answers</h3>
        <table class="connect-table"><thead><tr><th>Status</th><th>Body</th><th>When</th></tr></thead><tbody>
          <tr v-for="answer in guide.answers" :key="answer.status + answer.body"><td>{{ answer.status }}</td><td><code>{{ answer.body }}</code></td><td>{{ answer.when }}</td></tr>
        </tbody></table>
        <p class="field-help">{{ guide.after }}</p>
      </section>

      <section v-else-if="guide" class="panel">
        <div class="eyebrow">INTEGRATION GUIDE</div>
        <h2><Plug :size="18" /> How to send</h2>
        <p>Send one record per request to this address. {{ guide.vision ? `Send the photo as the part named file (${guide.formats.join(', ')}, at most ${guide.file_mb} MB) and the record as the part named payload.` : 'Send the record as JSON.' }} The payload is at most {{ guide.payload_mb }} MB. {{ guide.rate }}</p>
        <label class="field-label">Address<div class="connect-line"><code>{{ guide.endpoint }}</code><UiButton @click="copy(guide.endpoint, 'address')"><Copy :size="15" /> {{ copied === 'address' ? 'Copied' : 'Copy' }}</UiButton></div></label>
        <p class="field-help">Received so far: {{ guide.received }}{{ guide.newest ? `, the newest ${ago(guide.newest)}` : '' }}.</p>
        <p v-if="guide.training_refused" class="connect-refused"><UiBadge>Note</UiBadge> {{ guide.training_refused }}</p>
        <h3>Example</h3>
        <pre class="code-block">{{ curl }}</pre>
        <UiButton @click="copy(curl, 'curl')"><Copy :size="15" /> {{ copied === 'curl' ? 'Copied' : 'Copy example' }}</UiButton>
        <h3>The payload</h3>
        <pre class="code-block">{{ guide.payload_pretty }}</pre>
        <p v-if="guide.group_rule" class="field-help">{{ guide.group_rule }}</p>
        <table v-if="guide.fields?.length" class="connect-table"><thead><tr><th>Field</th><th>Needed</th><th>What it is</th></tr></thead><tbody>
          <tr v-for="field in guide.fields" :key="field.key"><td><code>{{ field.key }}</code></td><td>{{ field.needed }}</td><td>{{ field.what }}</td></tr>
        </tbody></table>
        <h3>What the address answers</h3>
        <table class="connect-table"><thead><tr><th>Status</th><th>Body</th><th>When</th></tr></thead><tbody>
          <tr v-for="answer in guide.answers" :key="answer.status + answer.body"><td>{{ answer.status }}</td><td><code>{{ answer.body }}</code></td><td>{{ answer.when }}</td></tr>
        </tbody></table>
        <template v-if="guide.partner">
          <h3>FitMyWall's own address</h3>
          <p>FitMyWall sends <code>{{ guide.partner.schema }}</code> events with its Partner API key to <code>{{ guide.partner.endpoint }}</code>. Received: {{ guide.partner.received }}.</p>
          <table class="connect-table"><thead><tr><th>Field</th><th>Needed</th><th>What it is</th></tr></thead><tbody>
            <tr v-for="field in guide.partner.fields" :key="field.key"><td><code>{{ field.key }}</code></td><td>{{ field.needed }}</td><td>{{ field.what }}</td></tr>
          </tbody></table>
        </template>
      </section>
    </template>
    <UiDialog :open="!!confirm" :title="confirm?.kind === 'rotate' ? 'Replace this key?' : 'Revoke this key?'" @close="confirm = null">
      <p class="dialog-description">{{ confirm?.kind === 'rotate' ? `${confirm?.row.hint} stops working now and a new key is made. Put the new key in the app.` : `${confirm?.row.hint} stops working now. An app that still uses it is refused.` }}</p>
      <div class="dialog-actions"><UiButton @click="confirm = null">Cancel</UiButton><UiButton variant="primary" @click="act">{{ confirm?.kind === 'rotate' ? 'Replace key' : 'Revoke key' }}</UiButton></div>
    </UiDialog>
  </div>
</template>

<style scoped>
.connect-app{display:grid;gap:20px}.connect-app h3{margin:22px 0 8px}
.connect-new{display:flex;gap:12px;align-items:flex-end;margin:16px 0}.connect-new .field-label{flex:1;margin:0}
.connect-fresh{display:grid;gap:10px;padding:16px;margin:16px 0;border:1px solid #99f6e4;border-radius:8px;background:#f0fdfa;color:#0f766e}
.connect-fresh>.button{justify-self:start}
.connect-fresh code,.connect-line code{word-break:break-all;font-size:13px}
.connect-line{display:flex;gap:12px;align-items:center;margin-top:6px}
.connect-refused{display:flex;gap:8px;align-items:center}
.connect-table{width:100%;border-collapse:collapse;margin-top:14px;font-size:13px}
.connect-table th{text-align:left;font-weight:600;color:#475569;padding:8px;border-bottom:1px solid #e2e8f0}
.connect-table td{padding:8px;border-bottom:1px solid #f1f5f9;vertical-align:top}
.connect-table tr.revoked td{color:#94a3b8}
.code-block{white-space:pre-wrap;word-break:break-all;font-size:12px;min-height:0}
.connect-mapping{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:12px 0}
</style>
