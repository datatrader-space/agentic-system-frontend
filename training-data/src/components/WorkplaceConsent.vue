<script setup>
// A person's own workplace page (backend workplace_api.py; SMART_CAMERA_AI_PLAN.md Phase H, features 12 and 63),
// opened from their own link (?consent=<secret>), with no sign-in: the link is the only authority. It says what the
// cameras do there and why, and lets the person consent by taking or choosing a photo of their own face (the only way
// they can be recognised), see their own attendance, withdraw (their face data is deleted at once) and erase their
// records. Their photo goes to AADML only when they press Agree; nothing is sent before.
import { computed, onMounted, ref } from 'vue';
import { Check, CircleAlert, ShieldCheck, Trash2, UserX } from 'lucide-vue-next';
import { workplaceMeApi } from '../api/phone.js';

const props = defineProps({ secret: { type: String, required: true } });
const me = ref(null); const error = ref(''); const said = ref(''); const busy = ref(false);
const agree = ref(false); const photo = ref(null); const preview = ref('');
const confirmErase = ref(false);

onMounted(async () => {
  try { me.value = await workplaceMeApi.get(props.secret); } catch (e) { error.value = e.message; }
});
function pick(event) {
  photo.value = event.target.files?.[0] || null;
  if (preview.value) URL.revokeObjectURL(preview.value);
  preview.value = photo.value ? URL.createObjectURL(photo.value) : '';
}
async function act(work) {
  busy.value = true; error.value = '';
  try { const answer = await work(); me.value = answer; said.value = answer?.said || ''; }
  catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}
const consent = () => act(() => workplaceMeApi.consent(props.secret, photo.value));
const withdraw = () => act(() => workplaceMeApi.withdraw(props.secret));
const erase = () => { confirmErase.value = false; return act(() => workplaceMeApi.erase(props.secret)); };
const consented = computed(() => me.value?.state === 'consented');
</script>

<template>
  <main class="wc">
    <h1><ShieldCheck :size="22" aria-hidden="true"/> Your workplace and its cameras</h1>
    <p v-if="error" class="wc-error" role="alert"><CircleAlert :size="16" aria-hidden="true"/> {{ error }}</p>
    <template v-if="me">
      <p class="wc-lead">Hello {{ me.name }}. <strong>{{ me.workplace }}</strong> uses cameras with AADML. Read what is done and why, then choose.</p>
      <section class="wc-card" aria-labelledby="wc-what">
        <h2 id="wc-what">What is done</h2>
        <ul><li v-for="p in me.points" :key="p">{{ p }}</li></ul>
        <details><summary>The notice your workplace gives its staff (English and Urdu)</summary><p class="wc-notice">{{ me.notice }}</p></details>
      </section>

      <section v-if="!consented" class="wc-card" aria-labelledby="wc-agree">
        <h2 id="wc-agree">Agree, with a photo of yourself</h2>
        <p v-if="!me.faces_on" class="wc-muted">Face recognition is not switched on at your workplace yet, so you cannot agree now.</p>
        <template v-else>
          <p class="wc-muted">Take or choose one clear photo of your face, facing the camera, in good light. It is turned into face data that only your workplace's cameras use to recognise you. You can withdraw at any time.</p>
          <label class="wc-file">Your photo <input type="file" accept="image/*" capture="user" @change="pick"></label>
          <img v-if="preview" :src="preview" alt="Your photo" class="wc-preview">
          <label class="wc-check"><input v-model="agree" type="checkbox"> I agree that my workplace's cameras recognise my face for attendance, desks and entrances, as described above.</label>
          <button type="button" class="wc-button primary" :disabled="busy || !agree || !photo" @click="consent"><Check :size="16" aria-hidden="true"/> Agree</button>
        </template>
      </section>

      <section v-else class="wc-card" aria-labelledby="wc-yours">
        <h2 id="wc-yours">You agreed<template v-if="me.consent_at"> on {{ new Date(me.consent_at).toLocaleDateString() }}</template></h2>
        <button type="button" class="wc-button" :disabled="busy" @click="withdraw"><UserX :size="16" aria-hidden="true"/> Withdraw my consent</button>
        <p class="wc-muted">Withdrawing deletes your face data at once; you are no longer recognised.</p>
      </section>

      <section class="wc-card" aria-labelledby="wc-records">
        <h2 id="wc-records">Your records, last 30 days</h2>
        <p v-if="!me.attendance.length" class="wc-muted">Nothing is recorded of you.</p>
        <table v-else class="wc-table">
          <thead><tr><th scope="col">Day</th><th scope="col">First seen</th><th scope="col">Last seen</th><th scope="col">Cameras</th></tr></thead>
          <tbody><tr v-for="r in me.attendance" :key="r.day"><td>{{ r.day }}</td><td>{{ r.first_seen }}</td><td>{{ r.last_seen }}</td><td>{{ r.cameras.join(', ') }}</td></tr></tbody>
        </table>
        <button v-if="!confirmErase" type="button" class="wc-button danger" :disabled="busy" @click="confirmErase = true"><Trash2 :size="16" aria-hidden="true"/> Erase my records</button>
        <span v-else class="wc-confirm">Erase all your records and withdraw? <button type="button" class="wc-button danger" :disabled="busy" @click="erase">Yes, erase</button> <button type="button" class="wc-button" @click="confirmErase = false">Cancel</button></span>
      </section>
      <p v-if="said" class="wc-said" role="status">{{ said }}</p>
      <p v-if="me.link_ends" class="wc-muted">This link works until {{ new Date(me.link_ends).toLocaleDateString() }}. Ask your workplace for a new one after that.</p>
    </template>
    <p v-else-if="!error" class="wc-muted" role="status">Loading…</p>
  </main>
</template>

<style scoped>
.wc{max-width:640px;margin:0 auto;padding:24px 16px 48px;font:15px/1.6 Inter,system-ui,sans-serif;color:#1e293b}
.wc h1{display:flex;gap:8px;align-items:center;font-size:22px;margin:0 0 12px}
.wc h2{font-size:16px;margin:0 0 8px}
.wc-lead{margin:0 0 16px}
.wc-card{border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:0 0 14px;background:#fff}
.wc-card ul{margin:0 0 8px;padding-left:20px}
.wc-notice{white-space:pre-line;font-size:14px;color:#334155}
.wc-muted{color:#64748b;font-size:14px;margin:8px 0}
.wc-file{display:grid;gap:6px;font-weight:600;margin:8px 0}
.wc-preview{max-width:180px;border-radius:10px;display:block;margin:8px 0}
.wc-check{display:flex;gap:8px;align-items:flex-start;margin:10px 0}
.wc-button{display:inline-flex;gap:6px;align-items:center;min-height:44px;padding:0 16px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;font:inherit;font-weight:600;cursor:pointer}
.wc-button.primary{background:#2563eb;border-color:#2563eb;color:#fff}
.wc-button.danger{color:#b91c1c;border-color:#fecaca}
.wc-button:disabled{opacity:.5;cursor:default}
.wc-table{width:100%;border-collapse:collapse;font-size:14px;margin:0 0 10px}
.wc-table th,.wc-table td{text-align:left;padding:6px;border-bottom:1px solid #eef2f7}
.wc-error{display:flex;gap:6px;align-items:center;color:#b91c1c}
.wc-said{color:#166534;font-weight:600}
.wc-confirm{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
</style>
