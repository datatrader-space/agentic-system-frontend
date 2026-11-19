<template>
  <div class="rm admin-page">
    <header class="admin-page-header">
      <div class="rm-heading">
        <span class="rm-page-icon"><Boxes :size="24" aria-hidden="true" /></span>
        <div>
          <div class="rm-eyebrow">AI &amp; agents</div>
          <h1 class="admin-page-title">Ready-to-use models</h1>
          <p>
            Only you start and stop these models. One runs on RunPod or on one of your own GPU machines until you stop
            it; a call never starts it. People pay for each image it answers, from their balance.
          </p>
        </div>
      </div>
      <button class="btn" type="button" :disabled="loading || refreshing" data-test="rm-refresh" @click="refresh()">
        <RefreshCw :size="15" aria-hidden="true" />{{ refreshing ? 'Refreshing…' : 'Refresh' }}
      </button>
    </header>

    <!-- Says each state change aloud (a model turning On, Failed, ...). -->
    <p class="admin-sr-only rm-sr" aria-live="polite" role="status" data-test="rm-live">{{ announcement }}</p>

    <div v-if="loading" class="rm-loading" role="status" aria-label="Loading the ready-to-use models">
      <div v-for="n in 2" :key="n" class="rm-skeleton"></div>
    </div>

    <div v-else-if="loadError" class="rm-load-error admin-surface" role="alert" data-test="rm-load-error">
      <TriangleAlert :size="18" aria-hidden="true" />
      <span>{{ loadError }}</span>
      <button class="btn" type="button" @click="load">Try again</button>
    </div>

    <template v-else>
      <p v-if="!models.length" class="empty admin-surface" data-test="rm-empty">
        No ready-to-use model is in the catalogue yet.
      </p>

      <section v-for="m in models" :key="m.key" class="rm-card admin-surface" :data-test="`rm-model-${m.key}`"
               :aria-labelledby="`rm-name-${m.key}`">
        <div class="rm-card-head">
          <h2 :id="`rm-name-${m.key}`" class="admin-section-title">{{ m.name || m.key }}</h2>
          <span class="rm-state" :class="`is-${m.state || 'off'}`" data-test="rm-state">
            <component :is="STATE_ICON[m.state] || CircleOff" :size="14" aria-hidden="true"
                       :class="{ 'rm-spin': m.state === 'starting' }" />
            {{ stateWord(m.state) }}
          </span>
        </div>
        <p v-if="m.state === 'failed' && m.failure_reason" class="rm-failure" role="alert" data-test="rm-failure">
          {{ m.failure_reason }}
        </p>

        <dl class="rm-facts">
          <div><dt>Where it runs</dt><dd data-test="rm-where">{{ whereWords(m) }}</dd></div>
          <div v-if="m.state !== 'off' && (m.started_by || m.started_at)">
            <dt>Started</dt><dd data-test="rm-started">{{ startedWords(m) }}</dd>
          </div>
          <div v-if="m.state === 'off' && m.stopped_at"><dt>Stopped</dt><dd>{{ when(m.stopped_at) }}</dd></div>
          <div><dt>Free tries</dt><dd data-test="rm-free">{{ m.free_per_day }} a person a day</dd></div>
        </dl>

        <!-- Run on, Start and Stop -->
        <div class="rm-run">
          <div class="rm-field">
            <label :for="`rm-host-${m.key}`">Run on</label>
            <select :id="`rm-host-${m.key}`" v-model="hostPick[m.key]" :disabled="isBusy(m.key) || running(m)"
                    :aria-describedby="`rm-host-help-${m.key}`" data-test="rm-host">
              <option value="runpod">RunPod</option>
              <option v-for="mc in machines" :key="mc.id" :value="`machine:${mc.id}`" :disabled="!!mc.unavailable">
                {{ machineWords(mc) }}{{ mc.unavailable ? ` (${mc.unavailable})` : '' }}
              </option>
            </select>
            <small :id="`rm-host-help-${m.key}`">
              {{ running(m) ? 'Stop it to move it to another place.' : 'RunPod time is paid by AADML; your machine is yours.' }}
            </small>
          </div>
          <div class="rm-run-actions">
            <button v-if="!running(m)" class="btn primary" type="button" :disabled="isBusy(m.key) || !hostPick[m.key]"
                    data-test="rm-start" @click="start(m)">
              <Play :size="15" aria-hidden="true" />{{ busy[m.key] === 'start' ? 'Starting…' : 'Start' }}
            </button>
            <button v-else class="btn danger" type="button" :disabled="isBusy(m.key)" data-test="rm-stop"
                    @click="askStop(m)">
              <Square :size="15" aria-hidden="true" />{{ busy[m.key] === 'stop' ? 'Stopping…' : 'Stop' }}
            </button>
          </div>
        </div>

        <!-- In-page confirmation before a stop: every call is refused until it is started again. -->
        <div v-if="stopAsk === m.key" class="rm-confirm" role="group" :aria-labelledby="`rm-stop-q-${m.key}`"
             data-test="rm-stop-confirm" @keydown.esc.stop.prevent="stopAsk = null">
          <p :id="`rm-stop-q-${m.key}`">
            <strong>Stop {{ m.name || m.key }}?</strong> Every call is refused until it is started again.
          </p>
          <div class="rm-confirm-actions">
            <button class="btn" type="button" @click="stopAsk = null">Keep it running</button>
            <button :ref="el => { if (el) confirmEl = el }" class="btn danger" type="button" :disabled="isBusy(m.key)"
                    data-test="rm-stop-yes" @click="stop(m)">Stop {{ m.name || m.key }}</button>
          </div>
        </div>

        <!-- Price per image -->
        <form class="rm-price" novalidate @submit.prevent="savePrice(m)">
          <div class="rm-field">
            <label :for="`rm-price-${m.key}`">Price per image (USD)</label>
            <div class="rm-money">
              <span aria-hidden="true">$</span>
              <input :id="`rm-price-${m.key}`" v-model.trim="pricePick[m.key]" inputmode="decimal" autocomplete="off"
                     placeholder="Not for sale" :disabled="isBusy(m.key)"
                     :aria-invalid="priceErrors[m.key] ? 'true' : 'false'"
                     :aria-describedby="`rm-price-help-${m.key}`" data-test="rm-price" />
            </div>
            <small :id="`rm-price-help-${m.key}`" data-test="rm-price-now">
              <template v-if="m.usd_per_image == null">Not for sale. Every paid call is refused until a price is set.</template>
              <template v-else>Now {{ m.price_text || `$${m.usd_per_image} an image` }}. Empty it to stop selling.</template>
            </small>
            <em v-if="priceErrors[m.key]" class="rm-error" role="alert" data-test="rm-price-error">{{ priceErrors[m.key] }}</em>
          </div>
          <button class="btn" type="submit" :disabled="isBusy(m.key) || !priceChanged(m)" data-test="rm-price-save">
            <Save :size="15" aria-hidden="true" />{{ busy[m.key] === 'price' ? 'Saving…' : 'Save price' }}
          </button>
        </form>

        <p v-if="modelErrors[m.key]" class="rm-error rm-banner" role="alert" data-test="rm-error">{{ modelErrors[m.key] }}</p>
      </section>

      <!-- The admin's own GPU machines, connected through the AADML machine agent. -->
      <section class="rm-card admin-surface" aria-labelledby="rm-machines-title" data-test="rm-machines">
        <h2 id="rm-machines-title" class="admin-section-title">Your GPU machines</h2>
        <p v-if="!machines.length" class="rm-muted">
          None of your machines is connected. Connect one with the AADML machine agent to run a model on it.
        </p>
        <ul v-else class="rm-machine-list">
          <li v-for="mc in machines" :key="mc.id" :data-test="`rm-machine-${mc.id}`">
            <div class="rm-machine-main">
              <Cpu :size="16" aria-hidden="true" />
              <div>
                <strong>{{ mc.name }}</strong>
                <span class="rm-muted"> · {{ mc.gpu || 'No GPU reported' }} · {{ mc.workspace }}</span>
                <div class="rm-muted">
                  {{ mc.online ? 'Online' : 'Offline' }}<template v-if="mc.unavailable"> · {{ mc.unavailable }}</template>
                </div>
              </div>
            </div>
            <button v-if="mc.licence === 'needed'" class="btn" type="button" :disabled="licenceBusy === mc.id"
                    :data-test="`rm-licence-${mc.id}`" @click="licenceAsk = mc.id">
              <ShieldCheck :size="15" aria-hidden="true" />Accept the SAM License for {{ mc.workspace }}
            </button>
            <span v-else class="rm-muted rm-licence-ok">SAM License accepted</span>

            <div v-if="licenceAsk === mc.id" class="rm-confirm" role="group" :aria-labelledby="`rm-lic-q-${mc.id}`"
                 data-test="rm-licence-confirm" @keydown.esc.stop.prevent="licenceAsk = null">
              <p :id="`rm-lic-q-${mc.id}`">
                <strong>Accept the SAM License for {{ mc.workspace }}?</strong> You accept it for this workspace, so its
                machines may run SAM 3. Your name and the time are recorded.
              </p>
              <div class="rm-confirm-actions">
                <button class="btn" type="button" @click="licenceAsk = null">Cancel</button>
                <button class="btn primary" type="button" :disabled="licenceBusy === mc.id" data-test="rm-licence-yes"
                        @click="acceptLicence(mc)">{{ licenceBusy === mc.id ? 'Accepting…' : 'Accept the SAM License' }}</button>
              </div>
            </div>
            <p v-if="licenceErrors[mc.id]" class="rm-error" role="alert">{{ licenceErrors[mc.id] }}</p>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Boxes, CircleCheck, CircleOff, Cpu, LoaderCircle, Play, RefreshCw, Save, ShieldCheck, Square, TriangleAlert } from 'lucide-vue-next'
import api from '../../services/api'
import { notify } from '../../composables/useNotify'

// The admin API (backend FIND_OBJECTS_AND_OWN_CLASSES_PLAN.md section 10.5). The model list always comes from it.
const STATE_WORD = { on: 'On', starting: 'Starting', off: 'Off', failed: 'Failed' }
const STATE_ICON = { on: CircleCheck, starting: LoaderCircle, off: CircleOff, failed: TriangleAlert }
const POLL_MS = 5000

const loading = ref(true)
const refreshing = ref(false)
const loadError = ref('')
const models = ref([])
const machines = ref([])
const hostPick = reactive({})
const pricePick = reactive({})
const priceErrors = reactive({})
const modelErrors = reactive({})
const busy = reactive({})
const stopAsk = ref(null)
const licenceAsk = ref(null)
const licenceBusy = ref(null)
const licenceErrors = reactive({})
const announcement = ref('')
let confirmEl = null
let pollTimer = null
let disposed = false

// The server's own words: {error: 'words'}, {error: {message}}, or {detail}.
function words(e, fallback) {
  const d = e?.response?.data
  const err = d?.error
  return (typeof err === 'string' ? err : err?.message) || d?.detail || fallback
}
function stateWord(s) { return STATE_WORD[s] || 'Off' }
function when(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString()
}
function who(by) {
  if (!by) return ''
  return typeof by === 'object' ? (by.name || by.username || by.email || '') : String(by)
}
function machineWords(mc) { return [mc.name, mc.gpu].filter(Boolean).join(' · ') }
function whereWords(m) {
  if (m.host === 'runpod') return 'RunPod'
  if (m.host === 'machine') return m.machine ? machineWords(m.machine) : 'One of your machines'
  return 'Not running anywhere'
}
function startedWords(m) {
  const by = who(m.started_by)
  return [by ? `by ${by}` : '', when(m.started_at)].filter(Boolean).join(', ')
}
function running(m) { return m.state === 'on' || m.state === 'starting' }
function isBusy(key) { return !!busy[key] }
function priceChanged(m) { return (pricePick[m.key] || '') !== (m.usd_per_image == null ? '' : String(m.usd_per_image)) }

// Takes one model's row from the server; keeps the admin's unsaved price unless it was just saved.
function takeModel(row, { resetPrice = false } = {}) {
  const i = models.value.findIndex(x => x.key === row.key)
  const before = i >= 0 ? models.value[i] : null
  if (i >= 0) models.value.splice(i, 1, row)
  else models.value.push(row)
  if (before && before.state !== row.state) announcement.value = `${row.name || row.key} is ${stateWord(row.state)}.`
  if (row.host === 'runpod') hostPick[row.key] = 'runpod'
  else if (row.host === 'machine' && row.machine) hostPick[row.key] = `machine:${row.machine.id}`
  else if (!hostPick[row.key]) hostPick[row.key] = 'runpod'
  const priceNow = row.usd_per_image == null ? '' : String(row.usd_per_image)
  if (resetPrice || !before || (pricePick[row.key] || '') === (before.usd_per_image == null ? '' : String(before.usd_per_image))) {
    pricePick[row.key] = priceNow
  }
}
function take(data) {
  machines.value = data.machines || []
  const rows = data.models || []
  models.value = models.value.filter(m => rows.some(r => r.key === m.key))
  for (const row of rows) takeModel(row)
  models.value.sort((a, b) => rows.findIndex(r => r.key === a.key) - rows.findIndex(r => r.key === b.key))
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const { data } = await api.readyModelsAdmin()
    if (!disposed) take(data)
  } catch (e) {
    if (!disposed) loadError.value = words(e, 'The ready-to-use models could not be loaded.')
  } finally {
    loading.value = false
  }
}
// A quiet reload (polling, Refresh): keeps the page as it is when it fails and says why.
async function refresh({ quiet = false } = {}) {
  if (refreshing.value) return
  refreshing.value = true
  try {
    const { data } = await api.readyModelsAdmin()
    if (!disposed) { take(data); loadError.value = '' }
  } catch (e) {
    if (!disposed && !quiet) notify.error(words(e, 'The ready-to-use models could not be refreshed.'))
  } finally {
    refreshing.value = false
  }
}

async function act(m, kind, call, okWords, opts) {
  busy[m.key] = kind
  modelErrors[m.key] = ''
  try {
    const { data } = await call()
    if (disposed) return true
    if (data && data.key) takeModel(data, opts)
    else await refresh({ quiet: true })
    notify.success(okWords)
    return true
  } catch (e) {
    if (disposed) return false
    const why = words(e, `${m.name || m.key} could not be changed.`)
    modelErrors[m.key] = why
    notify.error(why)
    return false
  } finally {
    busy[m.key] = ''
  }
}

function start(m) {
  const pick = hostPick[m.key] || 'runpod'
  const body = pick === 'runpod' ? { host: 'runpod' } : { host: 'machine', machine: Number(pick.slice('machine:'.length)) }
  return act(m, 'start', () => api.readyModelStart(m.key, body), `Starting ${m.name || m.key}.`)
}
async function askStop(m) {
  stopAsk.value = m.key
  await nextTick()
  confirmEl?.focus()
}
async function stop(m) {
  const ok = await act(m, 'stop', () => api.readyModelStop(m.key), `${m.name || m.key} is stopped.`)
  if (ok) stopAsk.value = null
}

// A price in US dollars, like 0.002; empty = not for sale.
const PRICE = /^\d+(\.\d+)?$/
function savePrice(m) {
  const raw = (pricePick[m.key] || '').replace(/^\$/, '').trim()
  priceErrors[m.key] = ''
  if (raw && !PRICE.test(raw)) { priceErrors[m.key] = 'Enter a price in US dollars, like 0.002, or leave it empty.'; return }
  if (raw && !(Number(raw) > 0)) { priceErrors[m.key] = 'A price must be more than $0. Leave it empty to stop selling.'; return }
  const value = raw || null
  return act(m, 'price', () => api.readyModelSetPrice(m.key, value),
    value ? `${m.name || m.key} now costs $${value} an image.` : `${m.name || m.key} is not for sale now.`,
    { resetPrice: true })
}

async function acceptLicence(mc) {
  licenceBusy.value = mc.id
  licenceErrors[mc.id] = ''
  try {
    await api.readyModelAcceptLicence(mc.id)
    if (disposed) return
    licenceAsk.value = null
    notify.success(`SAM License accepted for ${mc.workspace}.`)
    // Every machine of that workspace changes; read them all again.
    await refresh({ quiet: true })
  } catch (e) {
    if (disposed) return
    const why = words(e, 'The SAM License could not be recorded.')
    licenceErrors[mc.id] = why
    notify.error(why)
  } finally {
    licenceBusy.value = null
  }
}

// Every 5 seconds while a model is starting; never after leaving the page.
const anyStarting = computed(() => models.value.some(m => m.state === 'starting'))
function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null } }
watch(anyStarting, (on) => {
  if (on && !pollTimer && !disposed) pollTimer = setInterval(() => refresh({ quiet: true }), POLL_MS)
  else if (!on) stopPolling()
})

onMounted(load)
onBeforeUnmount(() => { disposed = true; stopPolling() })
</script>

<style scoped>
.rm-heading { display: flex; gap: 14px; align-items: flex-start; min-width: 0; }
.rm-page-icon { display: grid; place-items: center; flex: none; width: 44px; height: 44px; border-radius: 10px;
  background: var(--admin-accent-soft, #eeedff); color: var(--admin-accent, #4f46e5); }
.rm-eyebrow { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--admin-muted, #667085); }

.rm-loading { display: grid; gap: 12px; }
.rm-skeleton { height: 180px; border-radius: 10px; background: var(--admin-soft, #f4f6fa); }
.rm-load-error { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 16px;
  color: var(--admin-danger, #b42318); }

.rm-card { padding: 18px 20px; margin-bottom: 16px; min-width: 0; }
.rm-card-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
.rm-card-head h2 { margin: 0; font-size: 16px; }
.rm-state { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px;
  font-size: 12px; font-weight: 650; border: 1px solid var(--admin-line, #e3e7ee);
  background: var(--admin-soft, #f4f6fa); color: var(--admin-muted, #667085); }
.rm-state.is-on { color: var(--admin-success, #147d57); border-color: currentColor; }
.rm-state.is-starting { color: var(--admin-accent, #4f46e5); border-color: currentColor; }
.rm-state.is-failed { color: var(--admin-danger, #b42318); border-color: currentColor; }
.rm-spin { animation: rm-spin 1.2s linear infinite; }
@keyframes rm-spin { to { transform: rotate(360deg); } }
.rm-failure { margin: 10px 0 0; color: var(--admin-danger, #b42318); font-size: 13px; overflow-wrap: anywhere; }

.rm-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px 20px; margin: 14px 0; }
.rm-facts div { min-width: 0; }
.rm-facts dt { font-size: 11px; color: var(--admin-muted, #667085); text-transform: uppercase; letter-spacing: .05em; }
.rm-facts dd { margin: 2px 0 0; font-size: 13px; color: var(--admin-ink, #172033); overflow-wrap: anywhere; }

.rm-run, .rm-price { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; padding-top: 14px;
  border-top: 1px solid var(--admin-line, #e3e7ee); margin-top: 14px; }
.rm-field { display: flex; flex-direction: column; gap: 4px; flex: 1 1 260px; min-width: 0; }
.rm-field label { font-size: 12.5px; font-weight: 600; color: var(--admin-ink, #172033); }
.rm-field select, .rm-field input { width: 100%; min-width: 0; }
.rm-field small { font-size: 12px; color: var(--admin-muted, #667085); }
.rm-money { display: flex; align-items: center; gap: 6px; }
.rm-money span { color: var(--admin-muted, #667085); font-weight: 600; }
.rm-run-actions { display: flex; gap: 8px; }

.rm-confirm { margin-top: 12px; padding: 12px 14px; border-radius: 8px; border: 1px solid var(--admin-line, #e3e7ee);
  background: var(--admin-soft, #f4f6fa); }
.rm-confirm p { margin: 0 0 10px; font-size: 13px; color: var(--admin-ink, #172033); }
.rm-confirm-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }

.rm-error { color: var(--admin-danger, #b42318); font-size: 12.5px; font-style: normal; overflow-wrap: anywhere; }
.rm-banner { margin: 12px 0 0; }
.rm-muted { color: var(--admin-muted, #667085); font-size: 12.5px; }

.rm-machine-list { list-style: none; margin: 10px 0 0; padding: 0; display: grid; gap: 10px; }
.rm-machine-list li { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px;
  padding: 10px 0; border-top: 1px solid var(--admin-line, #e3e7ee); }
.rm-machine-list li .rm-confirm, .rm-machine-list li .rm-error { flex-basis: 100%; }
.rm-machine-main { display: flex; gap: 10px; align-items: flex-start; min-width: 0; overflow-wrap: anywhere; }
.rm-licence-ok { white-space: nowrap; }

.rm :where(button, select, input):focus-visible { outline: 2px solid var(--admin-accent, #4f46e5); outline-offset: 2px; }

@media (max-width: 767px) {
  .rm-card { padding: 16px; }
  .rm :where(.btn, select, input) { min-height: 44px; }
  .rm-run-actions, .rm-run-actions .btn, .rm-price > .btn, .rm-machine-list .btn { width: 100%; justify-content: center; }
  .rm-confirm-actions .btn { flex: 1 1 auto; justify-content: center; }
}
@media (prefers-reduced-motion: reduce) { .rm-spin { animation: none; } }
</style>
