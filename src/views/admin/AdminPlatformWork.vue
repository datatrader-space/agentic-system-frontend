<template>
  <div class="pw admin-page">
    <header class="admin-page-header">
      <div class="pw-heading">
        <span class="pw-page-icon"><Server :size="24" aria-hidden="true" /></span>
        <div>
          <div class="pw-eyebrow">AI &amp; agents</div>
          <h1 class="admin-page-title">Platform work</h1>
          <p>
            Where AADML's own work runs: building, testing, scanning, clearing and signing its images, and making its
            models ready and downloading their files. RunPod is for
            people who have no machine of their own; the platform's work runs on the platform machine, or on RunPod
            when you choose it here. AADML never moves it to the other place by itself.
          </p>
        </div>
      </div>
      <button class="btn" type="button" :disabled="loading" data-test="pw-refresh" @click="load">
        <RefreshCw :size="15" aria-hidden="true" />Refresh
      </button>
    </header>

    <div v-if="loading" class="pw-loading" role="status" aria-label="Loading the platform work settings">
      <div v-for="n in 2" :key="n" class="pw-skeleton"></div>
    </div>

    <div v-else-if="loadError" class="pw-load-error admin-surface" role="alert" data-test="pw-load-error">
      <TriangleAlert :size="18" aria-hidden="true" />
      <span>{{ loadError }}</span>
      <button class="btn" type="button" @click="load">Try again</button>
    </div>

    <template v-else>
      <section class="pw-card admin-surface" aria-labelledby="pw-machine-title" data-test="pw-machine">
        <h2 id="pw-machine-title">Platform machine</h2>
        <p class="pw-help">One of your own machines. Its agent holds the platform's secrets and runs the platform's jobs.</p>
        <div class="pw-row">
          <label class="pw-label" for="pw-machine-pick">Machine</label>
          <select id="pw-machine-pick" v-model="machinePick" class="pw-select" :disabled="saving === 'machine'">
            <option value="" disabled>Choose a machine</option>
            <option v-for="m in machines" :key="m.id" :value="String(m.id)">
              {{ m.specs ? `${m.specs} · ` : '' }}{{ m.name }} · {{ m.workspace }}{{ m.online ? '' : ' (offline)' }}
            </option>
          </select>
          <button class="btn btn-primary" type="button" data-test="pw-machine-save"
                  :disabled="!machinePick || machinePick === String(settings.machine?.id || '') || saving === 'machine'"
                  @click="save('machine', Number(machinePick))">
            <Save :size="15" aria-hidden="true" />{{ saving === 'machine' ? 'Saving…' : 'Save' }}
          </button>
        </div>
        <p v-if="!machines.length" class="pw-help">You have no machine yet. Add one under Your machines in Training Data.</p>
        <p class="pw-state" :class="settings.machine_refusal ? 'is-bad' : 'is-good'" role="status" data-test="pw-machine-state">
          <component :is="settings.machine_refusal ? TriangleAlert : CircleCheck" :size="15" aria-hidden="true" />
          {{ settings.machine_refusal || `${settings.machine?.name}${settings.machine?.specs ? ` (${settings.machine.specs})` : ''} is online and can run platform work.` }}
        </p>
      </section>

      <section class="pw-card admin-surface" aria-labelledby="pw-builds-title" data-test="pw-builds">
        <h2 id="pw-builds-title">Build images on</h2>
        <p class="pw-help">Where an image is built, tested, scanned, cleared and signed. One signing key is used in both places.</p>
        <div class="pw-places" role="radiogroup" aria-labelledby="pw-builds-title">
          <label v-for="p in settings.places" :key="p.value" class="pw-place" :class="{ 'is-on': settings.builds_on === p.value }">
            <input type="radio" name="pw-builds-on" :value="p.value" :checked="settings.builds_on === p.value"
                   :disabled="saving === 'builds_on'" @change="save('builds_on', p.value)">
            <span>{{ p.label }}</span>
          </label>
        </div>
        <p class="pw-help">If the chosen place cannot build now, the build is refused and says why; it is never moved to the other place.</p>
      </section>

      <section class="pw-card admin-surface" aria-labelledby="pw-prepares-title" data-test="pw-prepares">
        <h2 id="pw-prepares-title">Prepare models and download files on</h2>
        <p class="pw-help">
          Where AADML downloads a model's files from its publisher (Hugging Face, RF-DETR) and makes a published model
          ready to serve. On the platform machine, the Hugging Face token comes from its secret store. A download a person
          pays for (an open model they added) always runs on RunPod.
        </p>
        <div class="pw-places" role="radiogroup" aria-labelledby="pw-prepares-title">
          <label v-for="p in settings.places" :key="p.value" class="pw-place" :class="{ 'is-on': settings.prepares_on === p.value }">
            <input type="radio" name="pw-prepares-on" :value="p.value" :checked="settings.prepares_on === p.value"
                   :disabled="saving === 'prepares_on'" @change="save('prepares_on', p.value)">
            <span>{{ p.label }}</span>
          </label>
        </div>
        <p class="pw-help">If the chosen place cannot run it now, it is refused and says why; it is never moved to the other place.</p>
      </section>

      <section class="pw-card admin-surface" aria-labelledby="pw-jobs-title" data-test="pw-jobs">
        <h2 id="pw-jobs-title">Platform jobs</h2>
        <p class="pw-help">
          The platform's own jobs: image builds, tests, scans and signatures, preparations and downloads. While one runs,
          its machine sends its stage, the build step and its container's last lines (agent 1.9.3), and this list is read
          again every {{ JOBS_REFRESH_SECONDS }} seconds.
        </p>
        <p v-if="!jobs.length" class="pw-help" data-test="pw-jobs-empty">No platform job has run yet.</p>
        <ul v-else class="pw-jobs">
          <li v-for="j in jobs" :key="j.id" class="pw-job" :data-test="`pw-job-${j.id}`">
            <div class="pw-job-head">
              <strong>{{ jobWords(j) }}</strong>
              <span class="pw-job-state" :class="`is-${j.state}`">{{ j.state_label }}</span>
            </div>
            <p class="pw-job-meta">
              {{ j.machine?.name }}<template v-if="j.stage"> · stage {{ j.stage }}</template><template v-if="j.build_step"> · step {{ j.build_step }}</template><template v-if="j.reported_at"> · last report {{ new Date(j.reported_at).toLocaleTimeString() }}</template>
            </p>
            <p v-if="j.failure" class="pw-job-failure">{{ j.failure }}</p>
            <template v-if="tailOf(j).length">
              <button type="button" class="pw-fold" :aria-expanded="isOpen(j)" :aria-controls="`pw-job-log-${j.id}`" @click="toggle(j)">
                <ChevronDown :size="15" aria-hidden="true" :class="{ 'is-open': isOpen(j) }" />
                {{ j.log_tail?.length ? 'Last lines of its container' : 'The end of its log' }}
              </button>
              <pre v-if="isOpen(j)" :id="`pw-job-log-${j.id}`" class="pw-job-log" tabindex="0">{{ tailOf(j).join('\n') }}</pre>
            </template>
          </li>
        </ul>
      </section>

      <p v-if="settings.updated_by" class="pw-updated">Last changed by {{ settings.updated_by }}<template v-if="settings.updated_at">, {{ new Date(settings.updated_at).toLocaleString() }}</template>.</p>
    </template>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { ChevronDown, CircleCheck, RefreshCw, Save, Server, TriangleAlert } from 'lucide-vue-next'
import api from '../../services/api'
import { notify } from '../../composables/useNotify'

// Where the platform's own work runs (backend platform_work.py, PLATFORM_OFF_RUNPOD_PLAN.md, ADM-1365). Platform admins
// only; every change is audited on the server.
const loading = ref(true)
const loadError = ref('')
const settings = ref({ places: [] })
const machines = ref([])
const machinePick = ref('')
const saving = ref('')
const jobs = ref([])
const opened = ref(new Set())
const JOBS_REFRESH_SECONDS = 10
const ACTIVE = new Set(['queued', 'running', 'uploaded'])
const KIND_WORDS = { image_build: 'Build', image_test: 'Test', image_scan: 'Scan', image_sign: 'Signature',
  fetch: 'Download', preparation: 'Preparation' }

function jobWords(j) {
  const kind = KIND_WORDS[j.job_kind] || KIND_WORDS[j.kind] || j.kind
  return j.family ? `${kind} of ${j.family}` : kind
}
// While a job runs, the last lines its machine sent; once it ended, the end of its log.
function tailOf(j) {
  if (j.log_tail?.length) return j.log_tail
  return j.log_end ? j.log_end.split('\n') : []
}
const isOpen = j => opened.value.has(j.id)
function toggle(j) {
  const next = new Set(opened.value)
  if (next.has(j.id)) next.delete(j.id); else next.add(j.id)
  opened.value = next
}

let jobsTimer = null
let gone = false
function followJobs() {
  clearTimeout(jobsTimer)
  if (!gone && jobs.value.some(j => ACTIVE.has(j.state))) jobsTimer = setTimeout(refreshJobs, JOBS_REFRESH_SECONDS * 1000)
}
// Read the jobs again without touching the settings the admin may be choosing.
async function refreshJobs() {
  try {
    jobs.value = (await api.platformWorkAdmin()).data?.jobs || []
  } catch { /* the next refresh or the Refresh button tries again */ }
  followJobs()
}

function apply(data) {
  settings.value = data
  machines.value = data.machines || []
  machinePick.value = data.machine ? String(data.machine.id) : ''
  jobs.value = data.jobs || []
  followJobs()
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    apply((await api.platformWorkAdmin()).data)
  } catch (e) {
    loadError.value = e?.response?.data?.error || 'The platform work settings could not be read. Try again.'
  } finally {
    loading.value = false
  }
}

async function save(name, value) {
  saving.value = name
  try {
    apply((await api.platformWorkSet({ [name]: value })).data)
    notify.success(name === 'machine' ? 'Platform machine saved.'
      : name === 'builds_on' ? `Images are built on ${settings.value.builds_on_words} from now on.`
        : `Models are prepared and downloaded on ${settings.value.prepares_on_words} from now on.`)
  } catch (e) {
    notify.error(e?.response?.data?.error || 'The setting was not saved. Try again.')
    await load()
  } finally {
    saving.value = ''
  }
}

onMounted(load)
onUnmounted(() => { gone = true; clearTimeout(jobsTimer) })
</script>

<style scoped>
.pw-heading { display: flex; gap: 14px; align-items: flex-start; }
.pw-page-icon { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; background: #eff6ff; color: #2563eb; flex: none; }
.pw-eyebrow { font-size: 12px; font-weight: 600; color: #64748b; }
.pw-heading p { max-width: 70ch; color: #475569; line-height: 1.6; }
.pw-card { padding: 18px 20px; margin-top: 16px; }
.pw-card h2 { font-size: 16px; margin: 0 0 4px; }
.pw-help { color: #475569; font-size: 13px; line-height: 1.6; margin: 6px 0; }
.pw-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 10px; }
.pw-label { font-weight: 600; font-size: 13px; }
.pw-select { min-width: min(360px, 100%); padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; }
.pw-state { display: flex; gap: 8px; align-items: center; margin: 12px 0 0; font-size: 13px; }
.pw-state.is-good { color: #047857; }
.pw-state.is-bad { color: #b45309; }
.pw-places { display: flex; gap: 10px; flex-wrap: wrap; margin: 10px 0; }
.pw-place { display: flex; gap: 8px; align-items: center; padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 10px; cursor: pointer; min-height: 44px; }
.pw-place.is-on { border-color: #2563eb; background: #eff6ff; color: #1d4ed8; }
.pw-place input:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
.pw-updated { color: #64748b; font-size: 12px; margin-top: 12px; }
.pw-loading { display: grid; gap: 12px; margin-top: 16px; }
.pw-skeleton { height: 120px; border-radius: 12px; background: #f1f5f9; }
.pw-load-error { display: flex; gap: 10px; align-items: center; padding: 14px 16px; margin-top: 16px; color: #b91c1c; }
.pw-jobs { list-style: none; margin: 10px 0 0; padding: 0; display: grid; gap: 10px; }
.pw-job { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; }
.pw-job-head { display: flex; justify-content: space-between; gap: 10px; align-items: center; flex-wrap: wrap; }
.pw-job-state { font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: #f1f5f9; color: #334155; }
.pw-job-state.is-running, .pw-job-state.is-queued, .pw-job-state.is-uploaded { background: #eff6ff; color: #1d4ed8; }
.pw-job-state.is-done { background: #ecfdf5; color: #047857; }
.pw-job-state.is-failed { background: #fef2f2; color: #b91c1c; }
.pw-job-meta { color: #64748b; font-size: 12px; margin: 4px 0 0; overflow-wrap: anywhere; }
.pw-job-failure { color: #b91c1c; font-size: 13px; margin: 6px 0 0; overflow-wrap: anywhere; }
.pw-fold { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 4px; border: 0; background: none; color: #334155; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.pw-fold:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; border-radius: 4px; }
.pw-fold svg { transition: transform .15s; }
.pw-fold svg.is-open { transform: rotate(180deg); }
.pw-job-log { margin: 4px 0 0; max-height: 320px; overflow: auto; background: #0f172a; color: #e2e8f0; border-radius: 8px; padding: 10px 12px; font: 12px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
.pw-job-log:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .pw-fold svg { transition: none; } }
@media (max-width: 640px) { .pw-row { flex-direction: column; align-items: stretch; } .pw-select { min-width: 0; } }
</style>
