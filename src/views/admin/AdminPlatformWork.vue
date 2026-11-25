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
              {{ m.name }} · {{ m.workspace }}{{ m.online ? '' : ' (offline)' }}
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
          {{ settings.machine_refusal || `${settings.machine?.name} is online and can run platform work.` }}
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

      <p v-if="settings.updated_by" class="pw-updated">Last changed by {{ settings.updated_by }}<template v-if="settings.updated_at">, {{ new Date(settings.updated_at).toLocaleString() }}</template>.</p>
    </template>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { CircleCheck, RefreshCw, Save, Server, TriangleAlert } from 'lucide-vue-next'
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

function apply(data) {
  settings.value = data
  machines.value = data.machines || []
  machinePick.value = data.machine ? String(data.machine.id) : ''
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
@media (max-width: 640px) { .pw-row { flex-direction: column; align-items: stretch; } .pw-select { min-width: 0; } }
</style>
