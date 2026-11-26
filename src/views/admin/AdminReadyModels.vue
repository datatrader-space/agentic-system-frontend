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
            it; a call never starts it. People pay for each image it answers, from their balance. No model ever runs
            on AADML's own server. Each camera feature chooses among the running models of its kind.
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

      <!-- One card for the model chosen (owner, 2026-11-26): choose it here, or click it in the table below; its
           details, where it runs, Start and Stop and its price are all in this card. -->
      <div v-if="models.length" class="rm-chooser admin-surface" data-test="rm-chooser">
        <div class="rm-field rm-chooser-field">
          <label for="rm-choose">Model</label>
          <select id="rm-choose" v-model="selectedKey" data-test="rm-choose">
            <optgroup v-for="g in modelGroups" :key="g.label" :label="g.label">
              <option v-for="mm in g.models" :key="mm.key" :value="mm.key">{{ mm.name || mm.key }} · {{ stateWord(mm.state) }}</option>
            </optgroup>
          </select>
        </div>
        <p class="rm-muted rm-chooser-count">{{ runningCount }} of {{ models.length }} running</p>
      </div>
      <section v-for="m in shownModels" :key="m.key" class="rm-card rm-card-chosen admin-surface" :data-test="`rm-model-${m.key}`"
               :aria-labelledby="`rm-name-${m.key}`">
        <div class="rm-card-head">
          <h2 :id="`rm-name-${m.key}`" class="admin-section-title">{{ m.name || m.key }}</h2>
          <span class="rm-state" :class="`is-${m.state || 'off'}`" data-test="rm-state">
            <component :is="STATE_ICON[m.state] || CircleOff" :size="14" aria-hidden="true"
                       :class="{ 'rm-spin': m.state === 'starting' }" />
            {{ stateWord(m.state) }}
          </span>
        </div>
        <!-- While it starts on a machine: the machine's own progress (its files, its server image), as Try shows it. -->
        <div v-if="m.state === 'starting' && m.progress" class="rm-progress" data-test="rm-progress">
          <span>{{ m.progress.label }}</span>
          <progress v-if="m.progress.percent != null" :value="m.progress.percent" max="100"
                    :aria-label="`${m.name || m.key}: ${m.progress.percent}%`"></progress>
        </div>
        <p v-if="m.state === 'failed' && m.failure_reason" class="rm-failure" role="alert" data-test="rm-failure">
          {{ m.failure_reason }}
        </p>

        <dl class="rm-facts">
          <div v-if="m.kind_label"><dt>What it does</dt><dd data-test="rm-kind">{{ m.kind_label }}</dd></div>
          <div v-if="m.licence"><dt>Licence</dt><dd data-test="rm-licence">{{ m.licence }}</dd></div>
          <div v-if="m.gpu_gb != null"><dt>GPU memory</dt>
            <dd data-test="rm-gpu">{{ m.gpu_gb ? `${m.gpu_gb} GB` : 'None: it runs on a CPU too' }}</dd></div>
          <div v-if="m.camera_model"><dt>Files</dt>
            <dd data-test="rm-files">{{ m.files_ready ? 'Ready' : 'Being fetched by AADML' }}
              <template v-for="p in m.camera_model.parts" :key="p.repo"> · {{ p.repo }} @ {{ p.revision }}</template>
            </dd></div>
          <!-- A published model AADML hosts (kind walls: Aadml-Vision-seg-A0): its files
               are made once by its preparation job; the server says where they stand (files_text). -->
          <div v-else-if="m.kind === 'walls'"><dt>Files</dt>
            <dd data-test="rm-files">{{ m.files_ready ? 'Ready' : (m.files_text || 'Not made ready yet') }}</dd></div>
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
              <option value="" disabled>Choose where it runs</option>
              <option value="runpod">RunPod</option>
              <option v-for="mc in machines" :key="mc.id" :value="`machine:${mc.id}`" :disabled="!!fitWords(mc, m)">
                {{ machineWords(mc) }}{{ fitWords(mc, m) ? ` (${fitWords(mc, m)})` : '' }}
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
            <button v-if="(m.camera_model || m.kind === 'walls') && !m.files_ready" class="btn" type="button" :disabled="isBusy(m.key)"
                    data-test="rm-fetch" @click="fetchAgain(m)">
              <RefreshCw :size="15" aria-hidden="true" />Fetch its files again
            </button>
            <button v-if="m.camera_model && !running(m)" class="btn" type="button" :disabled="isBusy(m.key)"
                    data-test="rm-remove" @click="removeAsk = m.key">
              <Trash2 :size="15" aria-hidden="true" />Remove
            </button>
          </div>
        </div>

        <div v-if="removeAsk === m.key" class="rm-confirm" role="group" :aria-labelledby="`rm-remove-q-${m.key}`"
             data-test="rm-remove-confirm" @keydown.esc.stop.prevent="removeAsk = null">
          <p :id="`rm-remove-q-${m.key}`">
            <strong>Remove {{ m.name || m.key }} from the list?</strong> No feature can choose it afterwards. Its
            files and history are kept.
          </p>
          <div class="rm-confirm-actions">
            <button class="btn" type="button" @click="removeAsk = null">Keep it</button>
            <button class="btn danger" type="button" :disabled="isBusy(m.key)" data-test="rm-remove-yes"
                    @click="remove(m)">Remove {{ m.name || m.key }}</button>
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
            <label :for="`rm-price-${m.key}`">Price {{ m.price_unit || 'an image' }} (USD)</label>
            <div class="rm-money">
              <span aria-hidden="true">$</span>
              <input :id="`rm-price-${m.key}`" v-model.trim="pricePick[m.key]" inputmode="decimal" autocomplete="off"
                     placeholder="Not for sale" :disabled="isBusy(m.key) || m.for_sale === false"
                     :aria-invalid="priceErrors[m.key] ? 'true' : 'false'"
                     :aria-describedby="`rm-price-help-${m.key}`" data-test="rm-price" />
            </div>
            <small :id="`rm-price-help-${m.key}`" data-test="rm-price-now">
              <template v-if="m.for_sale === false">Its licence does not allow commercial use: it is yours to test, never offered to people or sold.</template>
              <template v-else-if="m.usd_per_image == null">Not for sale. Every paid call is refused until a price is set.</template>
              <template v-else>Now {{ m.price_text || `$${m.usd_per_image} an image` }}. Empty it to stop selling.</template>
            </small>
            <em v-if="priceErrors[m.key]" class="rm-error" role="alert" data-test="rm-price-error">{{ priceErrors[m.key] }}</em>
          </div>
          <button class="btn" type="submit" :disabled="isBusy(m.key) || !priceChanged(m)" data-test="rm-price-save">
            <Save :size="15" aria-hidden="true" />{{ busy[m.key] === 'price' ? 'Saving…' : 'Save price' }}
          </button>
        </form>

        <!-- Admin only (owner, 2026-11-26): everyone sees it in Ready to use; only platform administrators use it. -->
        <div class="rm-admin-only">
          <label class="rm-check" :for="`rm-admin-only-${m.key}`">
            <input :id="`rm-admin-only-${m.key}`" type="checkbox" :checked="!!m.admin_only"
                   :disabled="isBusy(m.key) || m.admin_only_locked" :aria-describedby="`rm-admin-only-help-${m.key}`"
                   data-test="rm-admin-only" @change="saveAdminOnly(m, $event.target.checked)" />
            <span>Admin only</span>
          </label>
          <small :id="`rm-admin-only-help-${m.key}`" data-test="rm-admin-only-help">
            <template v-if="m.admin_only_locked">Its licence does not allow commercial use, so it stays admin only: people see it in Ready to use, disabled.</template>
            <template v-else-if="m.admin_only">People see it in Ready to use, disabled; only platform administrators try it, use it and choose it for agents.</template>
            <template v-else>Everyone may try it, use it and choose it for agents. Tick it to keep it for platform administrators.</template>
          </small>
        </div>

        <p v-if="modelErrors[m.key]" class="rm-error rm-banner" role="alert" data-test="rm-error">{{ modelErrors[m.key] }}</p>
      </section>

      <!-- Every model at a glance: which run, where, at what price. A name opens that model in the card above. -->
      <section v-if="models.length" class="rm-card admin-surface" aria-labelledby="rm-table-title" data-test="rm-table">
        <h2 id="rm-table-title" class="admin-section-title">All models</h2>
        <table class="rm-table">
          <caption class="admin-sr-only">Every ready-to-use model, its state, where it runs and its price</caption>
          <thead>
            <tr><th scope="col">Model</th><th scope="col">What it does</th><th scope="col">State</th>
              <th scope="col">Where it runs</th><th scope="col">Price</th><th scope="col">Started</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in tableModels" :key="row.key" :class="{ 'is-chosen': row.key === selectedKey }"
                :data-test="`rm-row-${row.key}`">
              <th scope="row" data-label="Model">
                <button type="button" class="rm-row-pick" :aria-current="row.key === selectedKey ? 'true' : undefined"
                        @click="choose(row.key)">{{ row.name || row.key }}</button>
              </th>
              <td data-label="What it does">{{ row.kind_label || '—' }}</td>
              <td data-label="State"><span class="rm-state" :class="`is-${row.state || 'off'}`">
                <component :is="STATE_ICON[row.state] || CircleOff" :size="13" aria-hidden="true"
                           :class="{ 'rm-spin': row.state === 'starting' }" />{{ stateWord(row.state) }}</span></td>
              <td data-label="Where it runs">{{ row.state === 'off' ? '—' : whereWords(row) }}</td>
              <td data-label="Price">{{ row.for_sale === false ? 'Not for sale (your own)' : row.price_text || 'Not for sale yet' }}<span v-if="row.admin_only" class="rm-admin-tag" data-test="rm-admin-tag">Admin only</span></td>
              <td data-label="Started">{{ row.state !== 'off' && (row.started_by || row.started_at) ? startedWords(row) : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- A camera model from Hugging Face (backend camera_models.py): a row, never a constant in code. -->
      <section class="rm-card admin-surface" aria-labelledby="rm-add-title" data-test="rm-add">
        <h2 id="rm-add-title" class="admin-section-title">Add a ready-to-use model</h2>
        <p class="rm-muted">
          Name a model on Hugging Face, or search for one. AADML reads it at its newest commit (or the one you give) and
          pins it, refuses one with code of its own, and fetches its files once on the platform machine. A gated model is
          fetched with AADML's own Hugging Face token: accept its terms on AADML's Hugging Face account first. A model
          whose licence does not allow commercial use is yours to test only: people never see it and it is never sold.
          Chat and photo models are offered to everyone in Ready to use once you start and price them.
        </p>
        <!-- Search as you type (ADM-1365 phase 2b; the owner, 2026-11-26): results come a moment after typing stops,
             most downloaded first; Enter searches at once; an older answer never replaces a newer one. -->
        <form class="rm-search" role="search" @submit.prevent="searchHub" data-test="rm-search">
          <div class="rm-field rm-search-box"><label for="rm-search-q">Search Hugging Face</label>
            <div class="rm-search-input">
              <Search :size="16" aria-hidden="true" />
              <input id="rm-search-q" v-model.trim="searchForm.q" type="search" placeholder="Type a model name: qwen, llama, segformer…"
                     autocomplete="off" aria-describedby="rm-search-said" data-test="rm-search-q" />
              <LoaderCircle v-if="searching" :size="16" class="rm-spin" aria-hidden="true" />
            </div></div>
          <div class="rm-field rm-search-kind"><label for="rm-search-kind">Kind</label>
            <select id="rm-search-kind" v-model="searchForm.kind" data-test="rm-search-kind">
              <option v-for="k in SEARCH_KINDS" :key="k.key" :value="k.key">{{ k.label }}</option>
            </select></div>
        </form>
        <p id="rm-search-said" class="rm-muted rm-search-said" aria-live="polite" data-test="rm-search-said">{{ searchSaid }}</p>
        <p v-if="searchError" class="rm-error rm-banner" role="alert">{{ searchError }}</p>
        <ul v-if="listOpen && found.length" class="rm-found" data-test="rm-found">
          <li v-for="r in shownFound" :key="r.repo" :class="{ 'is-picked': addForm.repo === r.repo, 'is-off': !r.addable }">
            <button type="button" class="rm-found-pick" :disabled="!r.addable" :aria-describedby="r.why_not ? `rm-why-${r.repo}` : undefined"
                    @click="useFound(r)" :data-test="`rm-found-use-${r.repo}`">
              <span class="rm-found-main">
                <strong>{{ r.repo }}</strong>
                <span class="rm-muted">{{ r.licence_name || r.licence }}<template v-if="r.size"> · {{ r.size }} parameters</template><template v-if="r.downloads"> · {{ r.downloads.toLocaleString() }} downloads</template></span>
                <span v-if="r.commercial === false" class="rm-tag is-warn">Not for commercial use: yours to test only</span>
                <span v-if="r.gated" class="rm-tag">Gated</span>
                <span v-if="r.task" class="rm-tag is-plain">{{ r.task }}</span>
              </span>
              <small v-if="r.why_not" :id="`rm-why-${r.repo}`" class="rm-found-note rm-found-why">{{ r.why_not }}</small>
              <small v-else-if="r.gated && r.gated_note" class="rm-muted rm-found-note">{{ r.gated_note }}</small>
              <span class="rm-found-cta">{{ !r.addable ? 'Cannot be added yet' : addForm.repo === r.repo ? 'Chosen' : 'Use this' }}</span>
            </button>
          </li>
        </ul>
        <form class="rm-add-form" novalidate @submit.prevent="addCamera">
          <div class="rm-field"><label for="rm-add-kind">What it does</label>
            <select id="rm-add-kind" v-model="addForm.kind" data-test="rm-add-kind">
              <option v-for="k in addKinds" :key="k.key" :value="k.key">{{ k.label }}</option>
            </select></div>
          <div class="rm-field"><label for="rm-add-repo">Hugging Face model</label>
            <input id="rm-add-repo" v-model.trim="addForm.repo" placeholder="owner/name" autocomplete="off"
                   data-test="rm-add-repo" /></div>
          <div class="rm-field"><label for="rm-add-key">Key</label>
            <input id="rm-add-key" v-model.trim="addForm.key" placeholder="qwen3-vl-8b" autocomplete="off"
                   data-test="rm-add-key" /><small>3 to 40 lowercase letters, digits and dashes.</small></div>
          <div class="rm-field"><label for="rm-add-name">Name people read</label>
            <input id="rm-add-name" v-model.trim="addForm.name" placeholder="Qwen3-VL 8B" data-test="rm-add-name" /></div>
          <div class="rm-field"><label for="rm-add-gpu">GPU memory it needs (GB)</label>
            <input id="rm-add-gpu" v-model.trim="addForm.gpu_gb" inputmode="numeric" placeholder="0: it runs on a CPU too"
                   data-test="rm-add-gpu" /></div>
          <div class="rm-field"><label for="rm-add-revision">Commit (optional)</label>
            <input id="rm-add-revision" v-model.trim="addForm.revision" placeholder="the newest" autocomplete="off"
                   data-test="rm-add-revision" /></div>
          <div v-if="addForm.kind === 'photo'" class="rm-field"><label for="rm-add-task">What the photo model does</label>
            <select id="rm-add-task" v-model="addForm.task" data-test="rm-add-task">
              <option value="" disabled>Choose its task</option>
              <option v-for="t in PHOTO_TASKS" :key="t.value" :value="t.value">{{ t.label }}</option>
            </select></div>
          <div v-if="MEDIA_TASKS[addForm.kind]" class="rm-field"><label for="rm-add-media-task">What it makes from</label>
            <select id="rm-add-media-task" v-model="addForm.task" data-test="rm-add-media-task">
              <option value="" disabled>Choose its task</option>
              <option v-for="t in MEDIA_TASKS[addForm.kind]" :key="t.value" :value="t.value">{{ t.label }}</option>
            </select></div>
          <div v-if="TUNING[addForm.kind]" class="rm-field"><label for="rm-add-tuning">{{ TUNING[addForm.kind].label }}</label>
            <input id="rm-add-tuning" v-model.trim="addForm.tuning" inputmode="decimal"
                   :placeholder="TUNING[addForm.kind].hint" data-test="rm-add-tuning" /></div>
          <div class="rm-add-actions">
            <button class="btn primary" type="submit" :disabled="adding" data-test="rm-add-save">
              <Plus :size="15" aria-hidden="true" />{{ adding ? 'Reading Hugging Face…' : 'Add the model' }}
            </button>
          </div>
          <p v-if="addError" class="rm-error rm-banner" role="alert" data-test="rm-add-error">{{ addError }}</p>
        </form>
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
                <span class="rm-muted"> · {{ (mc.gpus && mc.gpus.join(', ')) || mc.gpu || 'No GPU reported' }} · {{ mc.workspace }}</span>
                <span v-if="mc.gpu_in_use_gb" class="rm-muted"> · {{ mc.gpu_in_use_gb }} GB of GPU memory in use</span>
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
import { Boxes, CircleCheck, CircleOff, Cpu, LoaderCircle, Play, Plus, RefreshCw, Save, Search, ShieldCheck, Square, Trash2, TriangleAlert } from 'lucide-vue-next'
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
const kinds = ref([])
const removeAsk = ref(null)
const adding = ref(false)
const addError = ref('')
const addForm = reactive({ kind: 'detector', repo: '', key: '', name: '', gpu_gb: '', revision: '', tuning: '', task: '' })
// A photo model is served for one of these tasks (backend open_models.DEPLOY_TASKS['photo']).
const PHOTO_TASKS = [
  { value: 'image-segmentation', label: 'Outlines areas (segmentation)' },
  { value: 'object-detection', label: 'Finds objects (detection)' },
  { value: 'image-classification', label: 'Names what a photo shows (classification)' },
  { value: 'depth-estimation', label: 'Estimates depth' },
]
// Image and video generation models (ADM-1365 phase 2c) are served for one of these tasks (backend media serving).
const MEDIA_TASKS = {
  image_gen: [{ value: 'text-to-image', label: 'Words (text to image)' }, { value: 'image-to-image', label: 'A photo and words (image to image)' }],
  video_gen: [{ value: 'text-to-video', label: 'Words (text to video)' }, { value: 'image-to-video', label: 'A photo and words (image to video)' }],
}
// A Hugging Face task the form is filled from: its kind here (a video-understanding model is a chat model with vision).
const TASK_KINDS = { 'text-to-image': 'image_gen', 'image-to-image': 'image_gen', 'text-to-video': 'video_gen', 'image-to-video': 'video_gen',
  'video-text-to-text': 'chat' }
// The kinds the server lists, and always the two generation kinds (named as the backend names them).
const MEDIA_KIND_LABELS = [{ key: 'image_gen', label: 'Image generation' }, { key: 'video_gen', label: 'Video generation' }]
const addKinds = computed(() => [...kinds.value, ...MEDIA_KIND_LABELS.filter(m => !kinds.value.some(k => k.key === m.key))])
// A task belongs to its kind: another kind chosen by hand drops a task it does not offer.
// A chat model keeps the Hub task it was chosen with (no menu): text, images and text, or video and text (video
// understanding, served on chat-serve; backend camera_models.CHAT_TASKS).
const CHAT_TASKS = ['text-generation', 'image-text-to-text', 'video-text-to-text'].map(value => ({ value }))
const tasksOf = kind => (kind === 'photo' ? PHOTO_TASKS : kind === 'chat' ? CHAT_TASKS : MEDIA_TASKS[kind] || [])
watch(() => addForm.kind, kind => { if (addForm.task && !tasksOf(kind).some(t => t.value === addForm.task)) addForm.task = '' })
const searchForm = reactive({ q: '', kind: 'all' })
// What the admin may look for (backend open_models.ADMIN_KINDS): every model on Hugging Face, none hidden; each result
// says whether AADML can serve it now and, if not, why (no server for its kind yet, pickle weights, code of its own).
const SEARCH_KINDS = [
  { key: 'all', label: 'All models' }, { key: 'chat', label: 'Chat models' }, { key: 'photo', label: 'Photo models' },
  { key: 'image_generation', label: 'Image generation' }, { key: 'video_generation', label: 'Video generation' },
  { key: 'video_understanding', label: 'Video understanding' },
]
const searching = ref(false)
const searchError = ref('')
const found = ref([])
const searchedFor = ref('')
// Search as you type: a moment after typing stops (SEARCH_WAIT_MS), from SEARCH_MIN letters; each search is numbered
// and only the newest answer is shown, so a slow older answer never replaces a newer one.
const SEARCH_WAIT_MS = 400
const SEARCH_MIN = 2
let searchTimer = null
let asked = 0
async function searchHub() {
  clearTimeout(searchTimer)
  const q = searchForm.q
  if (q.length < SEARCH_MIN) { asked++; found.value = []; searchedFor.value = ''; searching.value = false; return }
  const mine = ++asked
  searching.value = true; searchError.value = ''
  try {
    const { data } = await api.readyModelSearch({ q, kind: searchForm.kind })
    if (disposed || mine !== asked) return
    found.value = data?.results || []
    searchedFor.value = q
  } catch (e) {
    if (!disposed && mine === asked) { searchError.value = words(e, 'Hugging Face could not be searched now.'); found.value = [] }
  } finally { if (mine === asked) searching.value = false }
}
// The owner, 2026-11-26: at most 10 results, and the list closes once one is chosen; typing again opens it.
const SEARCH_SHOWN = 10
const listOpen = ref(true)
const shownFound = computed(() => found.value.slice(0, SEARCH_SHOWN))
watch(() => [searchForm.q, searchForm.kind], () => {
  listOpen.value = true
  clearTimeout(searchTimer)
  searchTimer = setTimeout(searchHub, SEARCH_WAIT_MS)
})
const searchSaid = computed(() => {
  if (searching.value) return 'Searching Hugging Face…'
  if (searchForm.q.length < SEARCH_MIN) return 'Type at least 2 letters: the most downloaded models that match show here.'
  if (!searchedFor.value) return ''
  if (!listOpen.value && addForm.repo) return `${addForm.repo} is chosen: check the form below. Type again to search again.`
  const n = shownFound.value.length
  return n ? `The ${n === 1 ? 'model' : `${n} most downloaded models`} for "${searchedFor.value}". Choose one to fill the form below.`
    : `No model on Hugging Face matches "${searchedFor.value}" for this kind. Try other words, or All models.`
})
// A result fills the form: its repository and kind; the key and name are the admin's to check.
function useFound(r) {
  const name = String(r.repo || '').split('/').pop() || ''
  if (!r.addable) return
  const kind = TASK_KINDS[r.task] || r.kind || 'chat'
  Object.assign(addForm, { repo: r.repo, kind, name: r.name || name,
    key: name.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40),
    task: kind === 'photo' || kind === 'chat' || MEDIA_TASKS[kind] ? (r.task || '') : '' })
  listOpen.value = false
  nextTick(() => document.getElementById('rm-add-key')?.focus())
}
// The one number a model of each kind carries (backend camera_models.TUNING); empty: the platform's own.
const TUNING = {
  detector: { name: 'threshold', label: 'How sure an object must be (0.05 to 0.99)', hint: '0.5' },
  sounds: { name: 'threshold', label: 'How sure a sound must be (0.01 to 0.99)', hint: '0.3' },
  faces: { name: 'match', label: 'How close two faces must be to be one person (0 to 1)', hint: '0.363' },
  search: { name: 'near', label: 'How close words must be to match (0 to 1)', hint: '0.68' },
}
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
// A machine by what it has, then its short name (the server's words, machines.specs; owner, 2026-11-26).
function machineWords(mc) { return mc.specs ? `${mc.specs} · ${mc.name}` : [mc.name, mc.gpu].filter(Boolean).join(' · ') }
// Why ``m`` cannot start on ``mc`` now ('' when it can): the machine's own judgement of each model, else SAM 3's.
function fitWords(mc, m) {
  if (mc.fits && Object.prototype.hasOwnProperty.call(mc.fits, m.key)) return mc.fits[m.key] || ''
  return mc.unavailable || ''
}
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
  else if (!hostPick[row.key]) {
    // The platform machine is the default place (ADM-1365 phase 3). When it cannot take the model now, nothing is
    // picked: the admin chooses (RunPod is never picked in its place). With no platform machine chosen: RunPod.
    const own = row.platform_machine && machines.value.find(mc => mc.id === row.platform_machine.id)
    hostPick[row.key] = !row.platform_machine ? 'runpod' : own && !fitWords(own, row) ? `machine:${own.id}` : ''
  }
  const priceNow = row.usd_per_image == null ? '' : String(row.usd_per_image)
  if (resetPrice || !before || (pricePick[row.key] || '') === (before.usd_per_image == null ? '' : String(before.usd_per_image))) {
    pricePick[row.key] = priceNow
  }
}
function take(data) {
  machines.value = data.machines || []
  if (Array.isArray(data.kinds)) kinds.value = data.kinds
  const rows = data.models || []
  models.value = models.value.filter(m => rows.some(r => r.key === m.key))
  for (const row of rows) takeModel(row)
  models.value.sort((a, b) => rows.findIndex(r => r.key === a.key) - rows.findIndex(r => r.key === b.key))
}

// The model shown in the card (owner, 2026-11-26): the one the admin chose, else the first running one, else the first.
const selectedKey = ref('')
const KIND_ORDER = ['segment', 'walls', 'chat', 'photo']
const modelGroups = computed(() => {
  const groups = new Map()
  for (const m of models.value) {
    const label = m.kind_label || 'Other'
    if (!groups.has(label)) groups.set(label, { label, kind: m.kind, models: [] })
    groups.get(label).models.push(m)
  }
  const rank = g => { const i = KIND_ORDER.indexOf(g.kind); return i < 0 ? KIND_ORDER.length : i }
  return [...groups.values()].sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label))
})
const shownModels = computed(() => models.value.filter(m => m.key === selectedKey.value))
const runningCount = computed(() => models.value.filter(m => m.state === 'on').length)
// The table: running ones first, then starting, failed, off; by name within each.
const STATE_RANK = { on: 0, starting: 1, failed: 2, off: 3 }
const tableModels = computed(() => [...models.value].sort((a, b) =>
  (STATE_RANK[a.state] ?? 3) - (STATE_RANK[b.state] ?? 3) || String(a.name || a.key).localeCompare(String(b.name || b.key))))
function choose(key) {
  selectedKey.value = key
  nextTick(() => document.getElementById('rm-choose')?.scrollIntoView?.({ block: 'nearest' }))
}
watch(models, now => {
  if (!now.length) { selectedKey.value = ''; return }
  if (!now.some(m => m.key === selectedKey.value)) selectedKey.value = (now.find(m => m.state === 'on') || now[0]).key
}, { deep: false })

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

function saveAdminOnly(m, value) {
  return act(m, 'admin-only', () => api.readyModelSetAdminOnly(m.key, value),
    value ? `${m.name || m.key} is for platform administrators only now.` : `${m.name || m.key} is for everyone now.`)
}

function fetchAgain(m) {
  return act(m, 'fetch', () => api.readyModelCameraFetch(m.key), `AADML fetches the files of ${m.name || m.key}.`)
}
async function remove(m) {
  busy[m.key] = 'remove'
  modelErrors[m.key] = ''
  try {
    await api.readyModelCameraRemove(m.key)
    if (disposed) return
    removeAsk.value = null
    models.value = models.value.filter(x => x.key !== m.key)
    notify.success(`${m.name || m.key} is off the list.`)
  } catch (e) {
    if (disposed) return
    const why = words(e, `${m.name || m.key} could not be removed.`)
    modelErrors[m.key] = why
    notify.error(why)
  } finally {
    busy[m.key] = ''
  }
}

async function addCamera() {
  addError.value = ''
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(addForm.repo)) {
    addError.value = 'Name the model as it is on Hugging Face: owner/name.'
    return
  }
  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(addForm.key)) {
    addError.value = 'A key is 3 to 40 lowercase letters, digits and dashes.'
    return
  }
  const gpu = addForm.gpu_gb === '' ? 0 : Number(addForm.gpu_gb)
  if (!Number.isInteger(gpu) || gpu < 0 || gpu > 192) { addError.value = 'The GPU memory is a whole number of GB, 0 to 192.'; return }
  if (addForm.kind === 'photo' && !addForm.task) { addError.value = 'Choose what the photo model does.'; return }
  const mediaTasks = MEDIA_TASKS[addForm.kind]
  if (mediaTasks && !mediaTasks.some(t => t.value === addForm.task)) { addError.value = 'Choose what the model makes its result from.'; return }
  const body = { key: addForm.key, name: addForm.name || addForm.key, kind: addForm.kind, gpu_gb: gpu,
    parts: [{ repo: addForm.repo, ...(addForm.revision ? { revision: addForm.revision } : {}) }],
    ...(addForm.kind === 'photo' || mediaTasks || (addForm.kind === 'chat' && addForm.task) ? { task: addForm.task } : {}) }
  const tune = TUNING[addForm.kind]
  if (tune && addForm.tuning !== '') {
    const value = Number(addForm.tuning)
    if (!Number.isFinite(value)) { addError.value = `${tune.label}: a number.`; return }
    body.tuning = { [tune.name]: value }
  }
  adding.value = true
  try {
    const { data } = await api.readyModelCameraAdd(body)
    if (disposed) return
    if (data && data.key) takeModel(data)
    Object.assign(addForm, { repo: '', key: '', name: '', gpu_gb: '', revision: '', tuning: '', task: '' })
    notify.success(`${data?.name || body.name} is added; AADML fetches its files now.`)
  } catch (e) {
    if (!disposed) addError.value = words(e, 'The model could not be added.')
  } finally {
    adding.value = false
  }
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
onBeforeUnmount(() => { disposed = true; stopPolling(); clearTimeout(searchTimer) })
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
.rm-progress { display: flex; flex-direction: column; gap: 6px; margin: 10px 0 0; font-size: 13px;
  color: var(--admin-accent, #4f46e5); overflow-wrap: anywhere; }
.rm-progress progress { width: 100%; height: 6px; }
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
.rm-run-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.rm-chooser { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 12px; padding: 16px 18px; margin-top: 16px;
  border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
.rm-chooser-field { flex: 1 1 360px; max-width: 560px; }
.rm-chooser-field select { min-height: 44px; font-weight: 600; }
.rm-chooser-count { margin: 0 0 10px; }
.rm-admin-only { display: flex; flex-direction: column; gap: 4px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--admin-line, #e5e7eb); }
.rm-check { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; cursor: pointer; min-height: 32px; }
.rm-check input { width: 16px; height: 16px; cursor: pointer; }
.rm-check input:disabled { cursor: not-allowed; }
.rm-admin-only small { color: var(--admin-muted, #475569); }
.rm-admin-tag { display: inline-block; margin-left: 8px; padding: 1px 6px; border-radius: 4px; background: #fef3c7; color: #92400e; font-size: 11px; font-weight: 600; }
.rm-card-chosen { margin-top: 0; border-top-left-radius: 0; border-top-right-radius: 0; border-top: 0; }
.rm-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
.rm-table th, .rm-table td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--admin-line, #e3e7ee); vertical-align: middle; }
.rm-table thead th { font-size: 12px; font-weight: 600; color: var(--admin-muted, #667085); background: var(--admin-soft, #f4f6fa); }
.rm-table tbody tr.is-chosen { background: #eef2ff; }
.rm-row-pick { all: unset; cursor: pointer; font-weight: 600; color: var(--admin-primary, #4f46e5); min-height: 32px; }
.rm-row-pick:hover { text-decoration: underline; }
.rm-row-pick:focus-visible { outline: 2px solid var(--admin-primary, #4f46e5); outline-offset: 2px; border-radius: 4px; }
@media (max-width: 720px) {
  .rm-table thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .rm-table, .rm-table tbody, .rm-table tr, .rm-table th, .rm-table td { display: block; width: 100%; }
  .rm-table tr { padding: 8px 0; border-bottom: 1px solid var(--admin-line, #e3e7ee); }
  .rm-table th, .rm-table td { border: 0; padding: 4px 4px; display: flex; gap: 12px; justify-content: space-between; }
  .rm-table [data-label]::before { content: attr(data-label); font-size: 12px; color: var(--admin-muted, #667085); font-weight: 600; }
}
.rm-add-form { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); align-items: start; gap: 14px 12px;
  margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--admin-line, #e3e7ee); }
.rm-search { display: grid; grid-template-columns: minmax(0, 1fr) 200px; align-items: end; gap: 12px; margin-top: 10px; }
.rm-search-input { position: relative; display: flex; align-items: center; }
.rm-search-input > svg:first-child { position: absolute; left: 12px; color: var(--admin-muted, #667085); pointer-events: none; }
.rm-search-input input { padding-left: 36px; padding-right: 36px; min-height: 42px; }
.rm-search-input .rm-spin { position: absolute; right: 12px; color: var(--admin-primary, #4f46e5); }
.rm-spin { animation: rm-spin 0.9s linear infinite; }
@keyframes rm-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .rm-spin { animation: none; } }
.rm-search-said { margin: 6px 0 0; min-height: 18px; }
.rm-found { list-style: none; margin: 10px 0 4px; padding: 0; display: grid; gap: 8px; max-height: 360px; overflow-y: auto; }
.rm-found-pick { width: 100%; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 4px 12px;
  padding: 10px 12px; border: 1px solid #e4e7ec; border-radius: 10px; background: #fff; text-align: left; cursor: pointer;
  font: inherit; color: inherit; min-height: 44px; transition: border-color 150ms, background-color 150ms; }
.rm-found-pick:hover:not(:disabled) { border-color: var(--admin-primary, #4f46e5); background: #f8f9ff; }
.rm-found-pick:focus-visible { outline: 2px solid var(--admin-primary, #4f46e5); outline-offset: 2px; }
.rm-found li.is-picked .rm-found-pick { border-color: var(--admin-primary, #4f46e5); background: #eef2ff; }
.rm-found-main { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; min-width: 0; }
.rm-found-main strong { overflow-wrap: anywhere; }
.rm-found-note { grid-column: 1; }
.rm-found li.is-off .rm-found-pick { cursor: not-allowed; background: #fafafa; }
.rm-found li.is-off .rm-found-cta { color: var(--admin-muted, #667085); }
.rm-found-why { color: #92400e; font-size: 12px; }
.rm-tag.is-plain { background: #f2f4f7; color: #344054; font-weight: 500; }
.rm-found-cta { grid-row: 1; grid-column: 2; font-size: 12.5px; font-weight: 600; color: var(--admin-primary, #4f46e5); white-space: nowrap; }
.rm-tag { font-size: 11.5px; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: #eef2ff; color: #3730a3; }
.rm-tag.is-warn { background: #fffbeb; color: #92400e; }
@media (max-width: 640px) { .rm-search { grid-template-columns: minmax(0, 1fr); } }
.rm-add-actions { display: flex; gap: 8px; align-self: end; }

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
  .rm-run-actions, .rm-run-actions .btn, .rm-price > .btn, .rm-machine-list .btn, .rm-add-actions,
  .rm-add-actions .btn { width: 100%; justify-content: center; }
  .rm-confirm-actions .btn { flex: 1 1 auto; justify-content: center; }
}
@media (prefers-reduced-motion: reduce) { .rm-spin { animation: none; } }
</style>
