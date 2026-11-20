<script setup>
// The Workplace view of Cloud Streaming (backend workplace_api.py; SMART_CAMERA_AI_PLAN.md Phase H): the Admin's switch
// and terms (with the staff notice in English and Urdu), people and their own consent links, attendance (and its CSV for
// HR or payroll), desks now, space use, and the plate lists. Nothing is recognised until the terms are accepted and
// each person consented on their own link; the server enforces it, this page only offers it.
import { computed, onMounted, ref, watch } from 'vue';
import { Copy, Download, Link as LinkIcon, Plus, RefreshCw, Trash2, UserX } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import { percent, pkDay, workplaceApi } from '../api/workplace.js';

const part = ref('setup');                      // setup | people | attendance | desks | usage | plates
const PARTS = [['setup', 'Setup'], ['people', 'People'], ['attendance', 'Attendance'], ['desks', 'Desks now'],
  ['usage', 'Space use'], ['plates', 'Plates']];
const error = ref(''); const said = ref(''); const busy = ref(false);
const settings = ref(null); const forbidden = ref(false);
async function call(work, after) {
  busy.value = true; error.value = ''; said.value = '';
  try { const answer = await work(); if (after) after(answer); said.value = answer?.said || ''; return answer; }
  catch (e) { error.value = e.message; if (e.status === 403) forbidden.value = true; return null; }
  finally { busy.value = false; }
}

// ── setup ──
const loadSettings = () => call(() => workplaceApi.settings(), a => { settings.value = a.settings; });
const draft = ref({ accept: false, notice: false, day_start: '09:00', day_end: '18:00', faces_on: false, plates_on: false });
watch(settings, s => { if (s) draft.value = { accept: s.accepted, notice: !!s.notice_confirmed_at, day_start: s.day_start || '09:00', day_end: s.day_end || '18:00', faces_on: s.faces_on, plates_on: s.plates_on }; });
function saveSettings() {
  const s = settings.value; const d = draft.value;
  const body = { day_start: d.day_start, day_end: d.day_end, faces_on: d.faces_on, plates_on: d.plates_on };
  if (d.accept && !s.accepted) body.accept = s.terms.version;
  if (d.notice && !s.notice_confirmed_at) body.notice_confirmed = true;
  return call(() => workplaceApi.saveSettings(body), a => { settings.value = a.settings; said.value = 'Saved.'; });
}

// ── people ──
const people = ref([]); const newPerson = ref({ name: '', employee_id: '', email: '', badge_number: '', department: '' });
const shownLink = ref(null);                    // { name, link }: shown once
const loadPeople = () => call(() => workplaceApi.people(), a => { people.value = a.people || []; });
function addPerson() {
  return call(() => workplaceApi.addPerson(newPerson.value), a => {
    people.value = a.people || []; shownLink.value = { name: newPerson.value.name, link: a.link };
    newPerson.value = { name: '', employee_id: '', email: '', badge_number: '', department: '' };
  });
}
const newLink = p => call(() => workplaceApi.newLink(p.id), a => { shownLink.value = { name: p.name, link: a.link }; loadPeople(); });
const withdraw = p => call(() => workplaceApi.withdraw(p.id), () => loadPeople());
const removePerson = p => call(() => workplaceApi.removePerson(p.id), () => loadPeople());
async function copyLink() { try { await navigator.clipboard.writeText(shownLink.value.link); said.value = 'The link is copied.'; } catch { /* the link is shown to copy by hand */ } }

// ── attendance ──
const since = ref(pkDay(6)); const until = ref(pkDay(0)); const rows = ref([]);
const loadAttendance = () => call(() => workplaceApi.attendance({ since: since.value, until: until.value }), a => { rows.value = a.rows || []; });
const csvUrl = computed(() => workplaceApi.attendanceCsvUrl({ since: since.value, until: until.value }));

// ── desks, space use, plates ──
const desks = ref([]); const usage = ref([]);
const loadDesks = () => call(() => workplaceApi.occupancy(), a => { desks.value = a.zones || []; });
const loadUsage = () => call(() => workplaceApi.usage({ since: since.value, until: until.value }), a => { usage.value = a.zones || []; });
const plates = ref([]); const newPlate = ref({ plate: '', label: '', list: 'allow' }); const recent = ref([]);
const loadPlates = () => call(() => workplaceApi.plates(), a => { plates.value = a.plates || []; })
  .then(() => workplaceApi.sightings('plate').then(a => { recent.value = a.sightings || []; }).catch(() => {}));
const addPlate = () => call(() => workplaceApi.addPlate(newPlate.value), a => { plates.value = a.plates || []; newPlate.value = { plate: '', label: '', list: 'allow' }; });
const removePlate = p => call(() => workplaceApi.removePlate(p.id), () => loadPlates());

const loaders = { setup: loadSettings, people: loadPeople, attendance: loadAttendance, desks: loadDesks, usage: loadUsage, plates: loadPlates };
watch(part, now => loaders[now]?.());
onMounted(loadSettings);
const ready = computed(() => !!settings.value?.accepted);
</script>

<template>
  <section class="wp" aria-label="Workplace">
    <div class="wp-parts" role="tablist" aria-label="Workplace">
      <button v-for="[id, label] in PARTS" :key="id" type="button" role="tab" :aria-selected="part === id" :class="{ on: part === id }" @click="part = id">{{ label }}</button>
    </div>
    <p v-if="forbidden" class="wp-muted">The workplace features are for the Admins of this workspace. Desks now and Space use are for everyone who sees the cameras.</p>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <p v-else-if="said" class="wp-muted" role="status">{{ said }}</p>

    <!-- Setup -->
    <div v-if="part === 'setup' && settings" class="wp-card">
      <h3>Before anything runs</h3>
      <ul class="wp-points"><li v-for="p in settings.terms.points" :key="p">{{ p }}</li></ul>
      <details><summary>Staff notice to give your staff (English and Urdu)</summary><p class="wp-notice">{{ settings.staff_notice }}</p></details>
      <label class="wp-check"><input v-model="draft.accept" type="checkbox" :disabled="settings.accepted"> I accept these terms for this workspace (version {{ settings.terms.version }})</label>
      <label class="wp-check"><input v-model="draft.notice" type="checkbox" :disabled="!!settings.notice_confirmed_at"> My staff were given the notice in writing, and signs are up where cameras are</label>
      <div class="wp-row">
        <label>Working day from <input v-model="draft.day_start" class="text-input" type="time"></label>
        <label>to <input v-model="draft.day_end" class="text-input" type="time"></label>
      </div>
      <label class="wp-check"><input v-model="draft.faces_on" type="checkbox" :disabled="!ready && !(draft.accept && draft.notice)"> Face recognition (only people who consented on their own link)</label>
      <label class="wp-check"><input v-model="draft.plates_on" type="checkbox" :disabled="!ready && !(draft.accept && draft.notice)"> Number plates (read on vehicle events)</label>
      <UiButton variant="primary" class="small" :disabled="busy" @click="saveSettings">Save</UiButton>
    </div>

    <!-- People -->
    <div v-else-if="part === 'people'" class="wp-card">
      <form class="wp-row" @submit.prevent="addPerson">
        <input v-model="newPerson.name" class="text-input" maxlength="120" placeholder="Name" aria-label="Name" required>
        <input v-model="newPerson.employee_id" class="text-input" maxlength="60" placeholder="Employee ID" aria-label="Employee ID">
        <input v-model="newPerson.badge_number" class="text-input" maxlength="60" placeholder="Badge number" aria-label="Badge number">
        <input v-model="newPerson.department" class="text-input" maxlength="80" placeholder="Department" aria-label="Department">
        <UiButton type="submit" variant="primary" class="small" :disabled="busy || !newPerson.name.trim()"><Plus :size="13" aria-hidden="true"/> Add person</UiButton>
      </form>
      <div v-if="shownLink" class="wp-link" role="status">
        <strong>{{ shownLink.name }}'s own link (shown only now):</strong>
        <code>{{ shownLink.link }}</code>
        <UiButton class="small" @click="copyLink"><Copy :size="13" aria-hidden="true"/> Copy</UiButton>
        <p class="wp-muted">Give it to them only. On it they read what is done, and agree with a photo of their own face, or not.</p>
      </div>
      <table v-if="people.length" class="wp-table">
        <thead><tr><th scope="col">Name</th><th scope="col">Employee ID</th><th scope="col">Badge</th><th scope="col">Consent</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>
          <tr v-for="p in people" :key="p.id">
            <td>{{ p.name }}<small v-if="p.department"> · {{ p.department }}</small></td><td>{{ p.employee_id }}</td><td>{{ p.badge_number }}</td>
            <td>{{ p.state_label }}<small v-if="p.consent_at"> {{ new Date(p.consent_at).toLocaleDateString() }}</small></td>
            <td class="wp-acts">
              <UiButton class="small" :disabled="busy" :aria-label="`New link for ${p.name}`" @click="newLink(p)"><LinkIcon :size="13" aria-hidden="true"/></UiButton>
              <UiButton v-if="p.state === 'consented'" class="small" :disabled="busy" :aria-label="`Withdraw ${p.name}`" @click="withdraw(p)"><UserX :size="13" aria-hidden="true"/></UiButton>
              <UiButton class="small sp-danger" :disabled="busy" :aria-label="`Remove ${p.name}`" @click="removePerson(p)"><Trash2 :size="13" aria-hidden="true"/></UiButton>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="wp-muted">No people yet. Add them, then give each their own link.</p>
    </div>

    <!-- Attendance -->
    <div v-else-if="part === 'attendance'" class="wp-card">
      <div class="wp-row">
        <label>From <input v-model="since" class="text-input" type="date"></label>
        <label>To <input v-model="until" class="text-input" type="date"></label>
        <UiButton class="small" :disabled="busy" @click="loadAttendance"><RefreshCw :size="13" aria-hidden="true"/> Show</UiButton>
        <a class="button small" :href="csvUrl"><Download :size="13" aria-hidden="true"/> CSV for HR</a>
      </div>
      <table v-if="rows.length" class="wp-table">
        <thead><tr><th scope="col">Day</th><th scope="col">Name</th><th scope="col">First seen</th><th scope="col">Last seen</th><th scope="col">Hours</th><th scope="col">Note</th></tr></thead>
        <tbody><tr v-for="r in rows" :key="`${r.day}-${r.person}`"><td>{{ r.day }}</td><td>{{ r.name }}</td><td>{{ r.first_seen }}</td><td>{{ r.last_seen }}</td><td>{{ r.hours }}</td><td>{{ [r.late ? 'late' : '', r.left_early ? 'left early' : ''].filter(Boolean).join(', ') }}</td></tr></tbody>
      </table>
      <p v-else class="wp-muted">No one was recognised in these days. Times are Pakistan time.</p>
    </div>

    <!-- Desks now -->
    <div v-else-if="part === 'desks'" class="wp-card">
      <UiButton class="small" :disabled="busy" @click="loadDesks"><RefreshCw :size="13" aria-hidden="true"/> Refresh</UiButton>
      <ul v-if="desks.length" class="wp-desks">
        <li v-for="d in desks" :key="d.zone_id" :class="{ taken: d.occupied }">
          <strong>{{ d.zone }}</strong><small>{{ d.camera }}</small>
          <span>{{ d.occupied ? (d.people.length ? d.people.join(', ') : 'Taken') : 'Free' }}</span>
          <small v-if="!d.live">no stream running</small>
        </li>
      </ul>
      <p v-else class="wp-muted">Draw desks as zones on a camera (its Zones tab) and run the ready detector on it.</p>
    </div>

    <!-- Space use -->
    <div v-else-if="part === 'usage'" class="wp-card">
      <div class="wp-row">
        <label>From <input v-model="since" class="text-input" type="date"></label>
        <label>To <input v-model="until" class="text-input" type="date"></label>
        <UiButton class="small" :disabled="busy" @click="loadUsage"><RefreshCw :size="13" aria-hidden="true"/> Show</UiButton>
      </div>
      <ul v-if="usage.length" class="wp-usage">
        <li v-for="u in usage" :key="u.zone_id"><span class="wp-bar" :style="{ width: percent(u.used_share) }"></span>
          <strong>{{ u.zone }}</strong> <small>{{ u.camera }}</small> <span>{{ percent(u.used_share) }} used · {{ u.occupied_hours }} of {{ u.watched_hours }} hours watched</span></li>
      </ul>
      <p v-else class="wp-muted">No zone was watched in these days.</p>
    </div>

    <!-- Plates -->
    <div v-else-if="part === 'plates'" class="wp-card">
      <form class="wp-row" @submit.prevent="addPlate">
        <input v-model="newPlate.plate" class="text-input" maxlength="20" placeholder="Plate, e.g. LEA-1234" aria-label="Plate" required>
        <input v-model="newPlate.label" class="text-input" maxlength="80" placeholder="Whose (optional)" aria-label="Whose">
        <select v-model="newPlate.list" class="text-input" aria-label="List"><option value="allow">Allow</option><option value="deny">Deny (alert)</option></select>
        <UiButton type="submit" variant="primary" class="small" :disabled="busy"><Plus :size="13" aria-hidden="true"/> Add</UiButton>
      </form>
      <ul v-if="plates.length" class="wp-list"><li v-for="p in plates" :key="p.id"><strong>{{ p.plate }}</strong> <span>{{ p.list === 'deny' ? 'Deny' : 'Allow' }}</span> <small>{{ p.label }}</small>
        <UiButton class="small sp-danger" :aria-label="`Remove ${p.plate}`" @click="removePlate(p)"><Trash2 :size="13" aria-hidden="true"/></UiButton></li></ul>
      <h4>Read lately</h4>
      <ul v-if="recent.length" class="wp-list"><li v-for="(s, i) in recent" :key="i"><strong>{{ s.value }}</strong> <small>{{ s.camera }} · {{ s.at }}</small></li></ul>
      <p v-else class="wp-muted">No plate read yet. Add the "Number plates at the gate" ready-made rule to a camera.</p>
    </div>
  </section>
</template>

<style scoped>
.wp{display:grid;gap:12px;margin-top:12px}
.wp-parts{display:flex;flex-wrap:wrap;gap:4px}
.wp-parts button{min-height:34px;padding:0 12px;border:0;border-radius:8px;background:none;font:inherit;font-size:14px;font-weight:600;color:#475569;cursor:pointer}
.wp-parts button.on{background:var(--aadml-soft);color:var(--aadml-primary)}
.wp-card{display:grid;gap:10px;padding:14px;border:1px solid #eef1f5;border-radius:12px}
.wp-card h3,.wp-card h4{margin:0;font-size:15px}
.wp-points{margin:0;padding-left:20px;font-size:14px}
.wp-notice{white-space:pre-line;font-size:13px;color:#334155}
.wp-check{display:flex;gap:8px;align-items:flex-start;font-size:14px}
.wp-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.wp-row label{display:flex;gap:6px;align-items:center;font-size:13px}
.wp-muted{margin:0;font-size:13px;color:#5f6d82}
.wp-link{display:grid;gap:6px;padding:10px;border-radius:10px;background:#f0fdf4}
.wp-link code{word-break:break-all;font-size:12px}
.wp-table{width:100%;border-collapse:collapse;font-size:13px}
.wp-table th,.wp-table td{text-align:left;padding:6px;border-bottom:1px solid #eef2f7}
.wp-acts{display:flex;gap:4px}
.wp-desks{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px}
.wp-desks li{display:grid;gap:2px;padding:10px;border-radius:10px;border:1px solid #bbf7d0;background:#f0fdf4}
.wp-desks li.taken{border-color:#fde68a;background:#fffbeb}
.wp-desks small{color:#64748b}
.wp-usage{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.wp-usage li{position:relative;padding:8px;border-radius:8px;border:1px solid #eef1f5;overflow:hidden;font-size:13px}
.wp-bar{position:absolute;inset:0 auto 0 0;background:rgba(37,99,235,.12);z-index:-1}
.wp-list{list-style:none;margin:0;padding:0;display:grid;gap:4px;font-size:13px}
.wp-list li{display:flex;gap:8px;align-items:center}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
</style>
