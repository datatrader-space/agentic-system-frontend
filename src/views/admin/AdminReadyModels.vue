<template>
  <div class="rm admin-page">
    <header class="admin-page-header">
      <div class="rm-heading">
        <span class="rm-page-icon"><Boxes :size="22" aria-hidden="true" /></span>
        <div>
          <h1 class="admin-page-title">Ready-to-use models</h1>
          <p>
            The models people use in Ready to use. Only you start, stop and price them. A model runs on RunPod or on one
            of your GPU machines until you stop it, never on AADML's own server. People pay from their balance for each
            answer.
          </p>
        </div>
      </div>
      <div class="rm-head-actions">
        <a class="btn" href="#rm-add" data-test="rm-go-add" @click.prevent="goAdd"><Plus :size="15" aria-hidden="true" />Add a model</a>
        <button class="btn" type="button" :disabled="loading || refreshing" data-test="rm-refresh" @click="refresh()">
          <RefreshCw :size="15" aria-hidden="true" :class="{ 'rm-spin': refreshing }" />{{ refreshing ? 'Refreshing…' : 'Refresh' }}
        </button>
      </div>
    </header>

    <!-- Says each state change aloud (a model turning On, Failed, ...). -->
    <p class="admin-sr-only" aria-live="polite" role="status" data-test="rm-live">{{ announcement }}</p>

    <div v-if="loading" class="rm-browse" role="status" aria-label="Loading the ready-to-use models">
      <div class="rm-skeleton rm-skeleton-list"></div><div class="rm-skeleton rm-skeleton-panel"></div>
    </div>

    <div v-else-if="loadError" class="rm-load-error admin-surface" role="alert" data-test="rm-load-error">
      <TriangleAlert :size="18" aria-hidden="true" />
      <span>{{ loadError }}</span>
      <button class="btn" type="button" @click="load">Try again</button>
    </div>

    <template v-else>
      <p v-if="!models.length" class="rm-empty admin-surface" data-test="rm-empty">
        <Boxes :size="20" aria-hidden="true" />
        No ready-to-use model is in the catalogue yet. Add one from Hugging Face below.
      </p>

      <template v-else>
        <!-- Filters: state (with how many are in each), kind, name. -->
        <div class="rm-filters" data-test="rm-filters">
          <div class="rm-states" role="group" aria-label="Show models that are">
            <button v-for="f in stateFilters" :key="f.key" type="button" class="rm-state-filter"
                    :class="{ 'is-on': stateFilter === f.key }" :aria-pressed="stateFilter === f.key ? 'true' : 'false'"
                    :data-test="`rm-filter-${f.key}`" @click="stateFilter = f.key">
              {{ f.label }} <span class="rm-count">{{ f.count }}</span>
            </button>
          </div>
          <div class="rm-filter-fields">
            <label class="admin-sr-only" for="rm-kind-filter">What it does</label>
            <select id="rm-kind-filter" v-model="kindFilter" data-test="rm-kind-filter">
              <option value="">Every kind</option>
              <option v-for="k in modelKinds" :key="k.kind" :value="k.kind">{{ k.label }}</option>
            </select>
            <div class="rm-find">
              <Search :size="15" aria-hidden="true" />
              <label class="admin-sr-only" for="rm-name-filter">Find a model by name</label>
              <input id="rm-name-filter" v-model.trim="nameFilter" type="search" placeholder="Find by name…"
                     autocomplete="off" data-test="rm-name-filter" />
            </div>
          </div>
          <p class="rm-running" data-test="rm-running"><strong>{{ runningCount }}</strong> of {{ models.length }} running</p>
        </div>

        <div class="rm-browse" :class="{ 'is-detail': mobileDetail }">
          <!-- Every model at a glance. A row opens its details beside it (below it on a phone). -->
          <section class="rm-list admin-surface" aria-labelledby="rm-list-title" data-test="rm-table">
            <h2 id="rm-list-title" class="admin-sr-only">All models</h2>
            <ul v-if="listModels.length" class="rm-rows">
              <li v-for="row in listModels" :key="row.key">
                <button type="button" class="rm-row" :class="{ 'is-chosen': row.key === selectedKey }"
                        :aria-current="row.key === selectedKey ? 'true' : undefined" :data-test="`rm-row-${row.key}`"
                        @click="choose(row.key)">
                  <span class="rm-state" :class="`is-${row.state || 'off'}`" data-test="rm-row-state">
                    <component :is="STATE_ICON[row.state] || CircleOff" :size="13" aria-hidden="true"
                               :class="{ 'rm-spin': row.state === 'starting' }" />{{ stateWord(row.state) }}
                  </span>
                  <span class="rm-row-main">
                    <strong>{{ row.name || row.key }}</strong>
                    <span class="rm-row-sub">{{ row.kind_label || 'Model' }}<template v-if="row.state !== 'off' && row.host">, on {{ whereWords(row) }}</template></span>
                    <span v-if="fileState(row) === 'fetching'" class="rm-row-note"><LoaderCircle :size="12" class="rm-spin" aria-hidden="true" />Fetching its files</span>
                    <span v-else-if="fileState(row) === 'failed'" class="rm-row-note is-bad"><TriangleAlert :size="12" aria-hidden="true" />Its files could not be fetched</span>
                  </span>
                  <span class="rm-row-side">
                    <span class="rm-row-price">{{ row.for_sale === false ? 'Not for sale' : row.price_text || 'No price yet' }}</span>
                    <span v-if="row.admin_only" class="rm-tag is-warn" data-test="rm-admin-tag">Admin only</span>
                  </span>
                  <ChevronRight :size="16" class="rm-row-go" aria-hidden="true" />
                </button>
              </li>
            </ul>
            <div v-else class="rm-none" data-test="rm-none">
              <p>No model matches these filters.</p>
              <button class="btn" type="button" @click="clearFilters">Show every model</button>
            </div>
          </section>

          <!-- The chosen model: run it, sell it, its files, remove it. -->
          <section v-for="m in shownModels" :key="m.key" class="rm-panel admin-surface" :data-test="`rm-model-${m.key}`"
                   :aria-labelledby="`rm-name-${m.key}`" tabindex="-1" ref="panelEl">
            <button class="btn rm-back" type="button" data-test="rm-back" @click="mobileDetail = false">
              <ArrowLeft :size="15" aria-hidden="true" />All models
            </button>
            <div class="rm-panel-head">
              <div>
                <h2 :id="`rm-name-${m.key}`" class="rm-panel-title">{{ m.name || m.key }}</h2>
                <p v-if="m.kind_label" class="rm-panel-kind" data-test="rm-kind">{{ m.kind_label }}</p>
              </div>
              <span class="rm-state is-big" :class="`is-${m.state || 'off'}`" data-test="rm-state">
                <component :is="STATE_ICON[m.state] || CircleOff" :size="14" aria-hidden="true"
                           :class="{ 'rm-spin': m.state === 'starting' }" />{{ stateWord(m.state) }}
              </span>
            </div>

            <!-- Long waits, shown as they go: the start on a machine, and the fetch of its files. -->
            <div v-if="m.state === 'starting'" class="rm-wait" data-test="rm-progress">
              <span>{{ m.progress?.label || 'Starting. This can take a few minutes.' }}</span>
              <progress v-if="m.progress && m.progress.percent != null" :value="m.progress.percent" max="100"
                        :aria-label="`${m.name || m.key} starting: ${m.progress.percent}%`"></progress>
              <progress v-else :aria-label="`${m.name || m.key} is starting`"></progress>
            </div>
            <div v-if="fileState(m) === 'fetching'" class="rm-wait" data-test="rm-fetching">
              <span>{{ m.files_text || 'Being fetched by AADML.' }}</span>
              <progress v-if="percentOf(m) != null" :value="percentOf(m)" max="100"
                        :aria-label="`Files of ${m.name || m.key}: ${percentOf(m)}%`" data-test="rm-files-bar"></progress>
              <progress v-else :aria-label="`Files of ${m.name || m.key} are being fetched`"></progress>
            </div>
            <p v-if="m.state === 'failed' && m.failure_reason" class="rm-failure" role="alert" data-test="rm-failure">
              <TriangleAlert :size="15" aria-hidden="true" />{{ m.failure_reason }}
            </p>

            <!-- Run it: the primary action. -->
            <div class="rm-group">
              <h3 class="rm-group-title">Run it</h3>
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
                </div>
                <button v-if="!running(m)" class="btn primary rm-main-action" type="button"
                        :disabled="isBusy(m.key) || !hostPick[m.key]" :aria-describedby="`rm-host-help-${m.key}`"
                        data-test="rm-start" @click="start(m)">
                  <Play :size="15" aria-hidden="true" />{{ busy[m.key] === 'start' ? 'Starting…' : 'Start' }}
                </button>
                <button v-else class="btn rm-main-action rm-stop" type="button" :disabled="isBusy(m.key) || stopAsk === m.key"
                        data-test="rm-stop" @click="askStop(m)">
                  <Square :size="15" aria-hidden="true" />{{ busy[m.key] === 'stop' ? 'Stopping…' : 'Stop' }}
                </button>
              </div>
              <small :id="`rm-host-help-${m.key}`" class="rm-help" data-test="rm-host-help">{{ hostHelp(m) }}</small>

              <!-- In-page confirmation before a stop: every call is refused until it is started again. -->
              <div v-if="stopAsk === m.key" class="rm-confirm" role="group" :aria-labelledby="`rm-stop-q-${m.key}`"
                   data-test="rm-stop-confirm" @keydown.esc.stop.prevent="stopAsk = null">
                <p :id="`rm-stop-q-${m.key}`">
                  <strong>Stop {{ m.name || m.key }}?</strong> Every call is refused until it is started again.
                </p>
                <div class="rm-confirm-actions">
                  <button class="btn" type="button" @click="stopAsk = null">Keep it running</button>
                  <button :ref="el => { if (el) confirmEl = el }" class="btn rm-danger-solid" type="button" :disabled="isBusy(m.key)"
                          data-test="rm-stop-yes" @click="stop(m)">Stop {{ m.name || m.key }}</button>
                </div>
              </div>
            </div>

            <!-- About it -->
            <dl class="rm-facts">
              <div><dt>Where it runs</dt><dd data-test="rm-where">{{ whereWords(m) }}</dd></div>
              <div v-if="m.state !== 'off' && (m.started_by || m.started_at)">
                <dt>Started</dt><dd data-test="rm-started">{{ startedWords(m) }}</dd>
              </div>
              <div v-if="m.state === 'off' && m.stopped_at"><dt>Stopped</dt><dd>{{ when(m.stopped_at) }}</dd></div>
              <div v-if="m.gpu_gb != null"><dt>GPU memory</dt>
                <dd data-test="rm-gpu">{{ m.gpu_gb ? `${m.gpu_gb} GB` : 'None: it runs on a CPU too' }}</dd></div>
              <div v-if="m.licence"><dt>Licence</dt><dd data-test="rm-licence">{{ m.licence }}</dd></div>
              <div><dt>Free tries</dt><dd data-test="rm-free">{{ m.free_per_day }} a person a day</dd></div>
              <div v-if="m.camera_model || m.kind === 'walls'" class="rm-facts-wide"><dt>Files</dt>
                <dd data-test="rm-files">
                  <span :class="{ 'rm-bad': fileState(m) === 'failed' }">{{ m.files_ready ? 'Ready' : fileState(m) === 'fetching' ? 'Being fetched (progress above)' : (m.files_text || 'Not made ready yet') }}</span>
                  <span v-for="p in m.camera_model?.parts || []" :key="p.repo" class="rm-part"> · {{ p.repo }} @ {{ p.revision }}</span>
                </dd></div>
            </dl>
            <button v-if="(m.camera_model || m.kind === 'walls') && !m.files_ready" class="btn rm-quiet" type="button"
                    :disabled="isBusy(m.key)" data-test="rm-fetch" @click="fetchAgain(m)">
              <RefreshCw :size="14" aria-hidden="true" />{{ busy[m.key] === 'fetch' ? 'Asking…' : 'Fetch its files again' }}
            </button>

            <!-- Selling: its price and who may use it. -->
            <div class="rm-group">
              <h3 class="rm-group-title">Who uses it and its price</h3>
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
                </div>
                <button class="btn" type="submit" :disabled="isBusy(m.key) || !priceChanged(m)" data-test="rm-price-save">
                  <Save :size="15" aria-hidden="true" />{{ busy[m.key] === 'price' ? 'Saving…' : 'Save price' }}
                </button>
              </form>
              <small :id="`rm-price-help-${m.key}`" class="rm-help" data-test="rm-price-now">
                <template v-if="m.for_sale === false">Its licence does not allow commercial use: it is yours to test, never offered to people or sold.</template>
                <template v-else-if="m.usd_per_image == null">Not for sale. Every paid call is refused until a price is set.</template>
                <template v-else>Now {{ m.price_text || `$${m.usd_per_image} an image` }}. Empty it to stop selling.</template>
              </small>
              <em v-if="priceErrors[m.key]" class="rm-error" role="alert" data-test="rm-price-error">{{ priceErrors[m.key] }}</em>

              <div class="rm-admin-only">
                <label class="rm-check" :for="`rm-admin-only-${m.key}`">
                  <input :id="`rm-admin-only-${m.key}`" type="checkbox" :checked="!!m.admin_only"
                         :disabled="isBusy(m.key) || m.admin_only_locked" :aria-describedby="`rm-admin-only-help-${m.key}`"
                         data-test="rm-admin-only" @change="saveAdminOnly(m, $event.target.checked)" />
                  <span>Admin only</span>
                </label>
                <small :id="`rm-admin-only-help-${m.key}`" class="rm-help" data-test="rm-admin-only-help">
                  <template v-if="m.admin_only_locked">Its licence does not allow commercial use, so it stays admin only: people see it in Ready to use, disabled.</template>
                  <template v-else-if="m.admin_only">People see it in Ready to use, disabled; only platform administrators try it, use it and choose it for agents.</template>
                  <template v-else>Everyone may try it, use it and choose it for agents. Tick it to keep it for platform administrators.</template>
                </small>
              </div>
            </div>

            <p v-if="modelErrors[m.key]" class="rm-error rm-banner" role="alert" data-test="rm-error">{{ modelErrors[m.key] }}</p>

            <!-- Remove: kept apart, asked first in a dialog. -->
            <div v-if="m.camera_model" class="rm-remove-zone">
              <div>
                <strong>Remove from the list</strong>
                <small class="rm-help">{{ running(m) ? 'Stop it first to remove it.' : 'No feature can choose it afterwards. Its files and history are kept.' }}</small>
              </div>
              <button class="btn rm-danger-ghost" type="button" :disabled="isBusy(m.key) || running(m)"
                      data-test="rm-remove" @click="askRemove(m)">
                <Trash2 :size="15" aria-hidden="true" />Remove
              </button>
            </div>
          </section>
        </div>
      </template>

      <!-- A model from Hugging Face (backend camera_models.py): a row, never a constant in code. -->
      <section id="rm-add" class="rm-card admin-surface" aria-labelledby="rm-add-title" data-test="rm-add" tabindex="-1">
        <div class="rm-card-head">
          <div>
            <h2 id="rm-add-title" class="admin-section-title">Add a ready-to-use model</h2>
            <p class="rm-muted">
              AADML reads the model at its newest commit (or the one you give), pins it, and fetches its files once on the
              platform machine. A model with code of its own is refused.
            </p>
          </div>
        </div>
        <!-- The licence rules, said once. -->
        <ul class="rm-rules" aria-label="Licence rules">
          <li><ShieldCheck :size="15" aria-hidden="true" /><span><strong>Licence that does not allow commercial use:</strong> the model is yours to test only. It stays Admin only and is never sold.</span></li>
          <li><Lock :size="15" aria-hidden="true" /><span><strong>Gated model:</strong> accept its terms on AADML's Hugging Face account first; AADML fetches it with its own token.</span></li>
        </ul>

        <ol class="rm-steps" aria-label="Steps to add a model">
          <li v-for="(s, i) in STEPS" :key="s" :class="{ 'is-done': i < addStep, 'is-now': i === addStep }"
              :aria-current="i === addStep ? 'step' : undefined">
            <span class="rm-step-n" aria-hidden="true"><Check v-if="i < addStep" :size="13" /><template v-else>{{ i + 1 }}</template></span>{{ s }}
          </li>
        </ol>

        <!-- Step 1: search as you type (ADM-1365 phase 2b; the owner, 2026-11-26): results come a moment after typing
             stops, most downloaded first; Enter searches at once; an older answer never replaces a newer one. -->
        <h3 class="rm-step-title">1. Find it on Hugging Face</h3>
        <form class="rm-search" role="search" @submit.prevent="searchHub" data-test="rm-search">
          <div class="rm-field rm-search-box"><label for="rm-search-q">Search Hugging Face</label>
            <div class="rm-search-input">
              <Search :size="16" aria-hidden="true" />
              <input id="rm-search-q" v-model.trim="searchForm.q" type="search" placeholder="A model name: qwen, llama, segformer…"
                     autocomplete="off" spellcheck="false" aria-describedby="rm-search-said" data-test="rm-search-q" />
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
                <span class="rm-found-facts">
                  <span>{{ r.licence_name || r.licence || 'No licence named' }}</span>
                  <span v-if="r.size">{{ r.size }} parameters</span><span v-else-if="r.size_label">{{ r.size_label }}</span>
                  <span v-if="r.need_gb_run" data-test="rm-found-gpu">To run: about {{ r.need_gb_run }} GB GPU</span>
                  <span v-if="r.downloads">{{ r.downloads.toLocaleString() }} downloads</span>
                </span>
                <span class="rm-found-tags">
                  <span v-if="r.commercial === false" class="rm-tag is-warn">Not for commercial use: yours to test only</span>
                  <span v-if="r.gated" class="rm-tag">Gated</span>
                  <span v-if="r.task" class="rm-tag is-plain">{{ r.task }}</span>
                </span>
              </span>
              <small v-if="r.why_not" :id="`rm-why-${r.repo}`" class="rm-found-note rm-found-why">{{ r.why_not }}</small>
              <small v-else-if="r.gated && r.gated_note" class="rm-muted rm-found-note">{{ r.gated_note }}</small>
              <span class="rm-found-cta">{{ !r.addable ? 'Cannot be added yet' : addForm.repo === r.repo ? 'Chosen' : 'Use this' }}</span>
            </button>
          </li>
        </ul>

        <!-- Steps 2 and 3: check what the search filled in (or type it yourself), then add. -->
        <h3 class="rm-step-title">2. Check the details</h3>
        <p class="rm-muted rm-step-hint">{{ addForm.repo ? 'Filled in from your choice. Check each field.' : 'Choose a result above, or type the model yourself.' }}</p>
        <form class="rm-add-form" novalidate @submit.prevent="addCamera">
          <div class="rm-field"><label for="rm-add-repo">Hugging Face model</label>
            <input id="rm-add-repo" v-model.trim="addForm.repo" placeholder="owner/name" autocomplete="off" spellcheck="false"
                   :aria-invalid="repoError ? 'true' : 'false'" aria-describedby="rm-add-repo-help"
                   data-test="rm-add-repo" @blur="touched.repo = true" />
            <small id="rm-add-repo-help" :class="{ 'rm-error': repoError }" data-test="rm-add-repo-help">{{ repoError || 'As on Hugging Face: owner/name.' }}</small></div>
          <div class="rm-field"><label for="rm-add-kind">What it does</label>
            <select id="rm-add-kind" v-model="addForm.kind" data-test="rm-add-kind">
              <option v-for="k in addKinds" :key="k.key" :value="k.key">{{ k.label }}</option>
            </select></div>
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
          <div class="rm-field"><label for="rm-add-name">Name people read</label>
            <input id="rm-add-name" v-model.trim="addForm.name" placeholder="Qwen3-VL 8B" data-test="rm-add-name" /></div>
          <div class="rm-field"><label for="rm-add-key">Key</label>
            <input id="rm-add-key" v-model.trim="addForm.key" placeholder="qwen3-vl-8b" autocomplete="off" spellcheck="false"
                   :aria-invalid="keyError ? 'true' : 'false'" aria-describedby="rm-add-key-help" data-test="rm-add-key" />
            <small id="rm-add-key-help" :class="{ 'rm-error': keyError }" data-test="rm-add-key-help">{{ keyError || '3 to 40 lowercase letters, digits and dashes.' }}</small></div>
          <div class="rm-field"><label for="rm-add-gpu">GPU memory it needs (GB)</label>
            <input id="rm-add-gpu" v-model.trim="addForm.gpu_gb" inputmode="numeric" :placeholder="gpuPlaceholder"
                   :aria-invalid="gpuError ? 'true' : 'false'" aria-describedby="rm-add-gpu-help" data-test="rm-add-gpu" />
            <small id="rm-add-gpu-help" :class="{ 'rm-error': gpuError }" data-test="rm-add-gpu-help">{{ gpuError || gpuHelp }}</small></div>
          <div class="rm-field"><label for="rm-add-revision">Commit (optional)</label>
            <input id="rm-add-revision" v-model.trim="addForm.revision" placeholder="The newest" autocomplete="off" spellcheck="false"
                   data-test="rm-add-revision" /></div>
          <div v-if="TUNING[addForm.kind]" class="rm-field"><label for="rm-add-tuning">{{ TUNING[addForm.kind].label }}</label>
            <input id="rm-add-tuning" v-model.trim="addForm.tuning" inputmode="decimal"
                   :placeholder="TUNING[addForm.kind].hint" data-test="rm-add-tuning" />
            <small>Empty: the platform's own.</small></div>
          <div class="rm-add-actions">
            <h3 class="rm-step-title">3. Add it</h3>
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
                  <span class="rm-dot" :class="{ 'is-on': mc.online }" aria-hidden="true"></span>{{ mc.online ? 'Online' : 'Offline' }}<template v-if="mc.unavailable"> · {{ mc.unavailable }}</template>
                </div>
              </div>
            </div>
            <button v-if="mc.licence === 'needed'" class="btn" type="button" :disabled="licenceBusy === mc.id"
                    :data-test="`rm-licence-${mc.id}`" @click="licenceAsk = mc.id">
              <ShieldCheck :size="15" aria-hidden="true" />Accept the SAM License for {{ mc.workspace }}
            </button>
            <span v-else class="rm-muted rm-licence-ok"><Check :size="14" aria-hidden="true" />SAM License accepted</span>

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

    <!-- Remove asks first, in the page's own dialog (never a native one). -->
    <div v-if="removing" class="rm-overlay admin-overlay" data-test="rm-remove-overlay" @click.self="removeAsk = null"
         @keydown.esc.stop.prevent="removeAsk = null">
      <div class="rm-dialog admin-dialog" role="alertdialog" aria-modal="true" tabindex="-1" aria-labelledby="rm-remove-q"
           aria-describedby="rm-remove-said" data-test="rm-remove-confirm">
        <span class="rm-dialog-icon"><Trash2 :size="18" aria-hidden="true" /></span>
        <h2 id="rm-remove-q" class="admin-section-title">Remove {{ removing.name || removing.key }} from the list?</h2>
        <p id="rm-remove-said">No feature can choose it afterwards. Its files and history are kept.</p>
        <p v-if="modelErrors[removing.key]" class="rm-error" role="alert">{{ modelErrors[removing.key] }}</p>
        <div class="rm-confirm-actions">
          <button ref="keepEl" class="btn" type="button" data-test="rm-remove-no" @click="removeAsk = null">Keep it</button>
          <button class="btn rm-danger-solid" type="button" :disabled="isBusy(removing.key)" data-test="rm-remove-yes"
                  @click="remove(removing)">{{ busy[removing.key] === 'remove' ? 'Removing…' : `Remove ${removing.name || removing.key}` }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ArrowLeft, Boxes, Check, ChevronRight, CircleCheck, CircleOff, Cpu, LoaderCircle, Lock, Play, Plus, RefreshCw, Save,
  Search, ShieldCheck, Square, Trash2, TriangleAlert } from 'lucide-vue-next'
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
const removing = computed(() => models.value.find(m => m.key === removeAsk.value) || null)
const keepEl = ref(null)
const panelEl = ref(null)
const adding = ref(false)
const addError = ref('')
const addForm = reactive({ kind: 'detector', repo: '', key: '', name: '', gpu_gb: '', revision: '', tuning: '', task: '' })
const touched = reactive({ repo: false })
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
// The kinds that run only on a GPU (backend camera_models.GPU_KINDS): their GPU memory is never 0.
const GPU_KINDS = ['chat', 'vision', 'image_gen', 'video_gen']
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
  if (!listOpen.value && addForm.repo) return `${addForm.repo} is chosen: check the details below. Type again to search again.`
  const n = shownFound.value.length
  return n ? `The ${n === 1 ? 'model' : `${n} most downloaded models`} for "${searchedFor.value}". Choose one to fill in the details.`
    : `No model on Hugging Face matches "${searchedFor.value}" for this kind. Try other words, or All models.`
})
// The GPU memory the search row says it needs to run (need_gb_run, as the Open models card says "To run: about N GB
// GPU"); never worked out here. Without it the field stays empty and the server works it out when it adds the model.
const filledGpu = ref(null)
// A result fills the form: its repository, kind, task and GPU memory; the key and name are the admin's to check.
function useFound(r) {
  const name = String(r.repo || '').split('/').pop() || ''
  if (!r.addable) return
  const kind = TASK_KINDS[r.task] || r.kind || 'chat'
  const gpu = Number.isInteger(r.need_gb_run) && r.need_gb_run > 0 ? r.need_gb_run : null
  filledGpu.value = gpu
  Object.assign(addForm, { repo: r.repo, kind, name: r.name || name, gpu_gb: gpu == null ? '' : String(gpu),
    key: name.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40),
    task: kind === 'photo' || kind === 'chat' || MEDIA_TASKS[kind] ? (r.task || '') : '' })
  listOpen.value = false
  nextTick(() => document.getElementById('rm-add-name')?.focus())
}
// The one number a model of each kind carries (backend camera_models.TUNING); empty: the platform's own.
const TUNING = {
  detector: { name: 'threshold', label: 'How sure an object must be (0.05 to 0.99)', hint: '0.5' },
  sounds: { name: 'threshold', label: 'How sure a sound must be (0.01 to 0.99)', hint: '0.3' },
  faces: { name: 'match', label: 'How close two faces must be to be one person (0 to 1)', hint: '0.363' },
  search: { name: 'near', label: 'How close words must be to match (0 to 1)', hint: '0.68' },
}

// The add form's checks, said under each field as the admin types.
const REPO = /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/
const KEY = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/
const needsGpu = computed(() => GPU_KINDS.includes(addForm.kind))
const repoError = computed(() => (addForm.repo && (touched.repo || addError.value) && !REPO.test(addForm.repo)
  ? 'Name the model as it is on Hugging Face: owner/name.' : ''))
const keyError = computed(() => (addForm.key && !KEY.test(addForm.key) ? 'A key is 3 to 40 lowercase letters, digits and dashes.' : ''))
const gpuError = computed(() => {
  if (addForm.gpu_gb === '') return ''
  const gpu = Number(addForm.gpu_gb)
  if (!Number.isInteger(gpu) || gpu < 0 || gpu > 192) return 'The GPU memory is a whole number of GB, 0 to 192.'
  if (gpu === 0 && needsGpu.value) return 'This kind runs only on a GPU. Enter its GB, or leave it empty for AADML to work it out.'
  return ''
})
const gpuPlaceholder = computed(() => (needsGpu.value ? 'Empty: AADML works it out' : '0: it runs on a CPU too'))
const gpuHelp = computed(() => {
  if (filledGpu.value != null && addForm.gpu_gb === String(filledGpu.value)) return `About ${filledGpu.value} GB to run, from its size on Hugging Face.`
  return needsGpu.value ? 'Leave it empty and AADML works it out from the model\'s size.' : 'Leave it empty if it runs on a CPU too.'
})
const STEPS = ['Find it', 'Check the details', 'Add it']
const addStep = computed(() => (!addForm.repo ? 0 : REPO.test(addForm.repo) && KEY.test(addForm.key) && !gpuError.value ? 2 : 1))

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
// Why Start cannot be pressed, or what Run on means now: a disabled control always says why.
function hostHelp(m) {
  if (running(m)) return 'Stop it to move it to another place.'
  if (!hostPick[m.key]) return 'Choose where it runs to start it.'
  return hostPick[m.key] === 'runpod' ? 'RunPod time is paid by AADML.' : 'It runs on your machine until you stop it.'
}
// Where a model's files stand: the server's ``files_state`` (ready, fetching, failed), '' when ready or none to fetch.
// An older server sends no files_state: its sentence is read then.
function fileState(m) {
  if (!(m.camera_model || m.kind === 'walls') || m.files_ready) return ''
  if (m.files_state) return m.files_state === 'ready' ? '' : m.files_state
  return /^Its files could not be/.test(m.files_text || '') ? 'failed' : 'fetching'
}
// The upload's share for a progress bar: the server's ``files_percent`` (else "(35%)" in an older server's sentence).
function percentOf(m) {
  if (m && m.files_percent != null) return Math.min(100, Number(m.files_percent))
  const hit = /\((\d{1,3})%\)/.exec((m && m.files_text) || '')
  return hit ? Math.min(100, Number(hit[1])) : null
}

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

// The list: filtered by state, kind and name; running ones first, then starting, failed, off; by name within each.
const stateFilter = ref('all')
const kindFilter = ref('')
const nameFilter = ref('')
const STATE_RANK = { on: 0, starting: 1, failed: 2, off: 3 }
const stateOf = m => (STATE_WORD[m.state] ? m.state : 'off')
const stateFilters = computed(() => [{ key: 'all', label: 'All', count: models.value.length },
  ...['on', 'starting', 'failed', 'off'].map(s => ({ key: s, label: STATE_WORD[s], count: models.value.filter(m => stateOf(m) === s).length }))])
const modelKinds = computed(() => {
  const seen = new Map()
  for (const m of models.value) if (m.kind && !seen.has(m.kind)) seen.set(m.kind, { kind: m.kind, label: m.kind_label || m.kind })
  return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label))
})
const listModels = computed(() => {
  const q = nameFilter.value.toLowerCase()
  return models.value
    .filter(m => stateFilter.value === 'all' || stateOf(m) === stateFilter.value)
    .filter(m => !kindFilter.value || m.kind === kindFilter.value)
    .filter(m => !q || `${m.name || ''} ${m.key}`.toLowerCase().includes(q))
    .sort((a, b) => (STATE_RANK[a.state] ?? 3) - (STATE_RANK[b.state] ?? 3) || String(a.name || a.key).localeCompare(String(b.name || b.key)))
})
function clearFilters() { stateFilter.value = 'all'; kindFilter.value = ''; nameFilter.value = '' }
const runningCount = computed(() => models.value.filter(m => m.state === 'on').length)

// The model shown in the panel: the one the admin chose, else the first running one, else the first.
const selectedKey = ref('')
const mobileDetail = ref(false)
const shownModels = computed(() => models.value.filter(m => m.key === selectedKey.value))
function choose(key) {
  selectedKey.value = key
  stopAsk.value = null
  mobileDetail.value = true
  // On a phone the panel replaces the list: move to it, so a screen reader and the keyboard follow.
  nextTick(() => {
    const el = Array.isArray(panelEl.value) ? panelEl.value[0] : panelEl.value
    if (el && window.matchMedia?.('(max-width: 1023px)').matches) { el.focus?.(); el.scrollIntoView?.({ block: 'start' }) }
  })
}
watch(models, now => {
  if (!now.length) { selectedKey.value = ''; return }
  if (!now.some(m => m.key === selectedKey.value)) selectedKey.value = (now.find(m => m.state === 'on') || now[0]).key
}, { deep: false })
function goAdd() {
  const el = document.getElementById('rm-add')
  el?.scrollIntoView?.({ block: 'start' })
  document.getElementById('rm-search-q')?.focus()
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
    value ? `${m.name || m.key} now costs $${value} ${m.price_unit || 'an image'}.` : `${m.name || m.key} is not for sale now.`,
    { resetPrice: true })
}

function saveAdminOnly(m, value) {
  return act(m, 'admin-only', () => api.readyModelSetAdminOnly(m.key, value),
    value ? `${m.name || m.key} is for platform administrators only now.` : `${m.name || m.key} is for everyone now.`)
}

function fetchAgain(m) {
  return act(m, 'fetch', () => api.readyModelCameraFetch(m.key), `AADML fetches the files of ${m.name || m.key}.`)
}
async function askRemove(m) {
  modelErrors[m.key] = ''
  removeAsk.value = m.key
  await nextTick()
  keepEl.value?.focus()               // the safe choice has the focus first
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

// A refused field takes the focus, so the admin lands on what to fix.
function focusField(id) { nextTick(() => document.getElementById(id)?.focus()) }
async function addCamera() {
  addError.value = ''
  touched.repo = true
  if (!REPO.test(addForm.repo)) { addError.value = 'Name the model as it is on Hugging Face: owner/name.'; focusField('rm-add-repo'); return }
  if (!KEY.test(addForm.key)) { addError.value = 'A key is 3 to 40 lowercase letters, digits and dashes.'; focusField('rm-add-key'); return }
  if (gpuError.value) { addError.value = gpuError.value; focusField('rm-add-gpu'); return }
  const gpu = addForm.gpu_gb === '' ? 0 : Number(addForm.gpu_gb)   // 0 for a GPU kind: the server works it out
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
    if (data && data.key) { takeModel(data); selectedKey.value = data.key }
    Object.assign(addForm, { repo: '', key: '', name: '', gpu_gb: '', revision: '', tuning: '', task: '' })
    touched.repo = false; filledGpu.value = null
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

// Every 5 seconds while a model is starting or its files are being fetched; never when nothing is, nor after leaving.
const inProgress = computed(() => models.value.some(m => m.state === 'starting' || fileState(m) === 'fetching'))
function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null } }
watch(inProgress, (on) => {
  if (on && !pollTimer && !disposed) pollTimer = setInterval(() => refresh({ quiet: true }), POLL_MS)
  else if (!on) stopPolling()
})

onMounted(load)
onBeforeUnmount(() => { disposed = true; stopPolling(); clearTimeout(searchTimer) })
</script>

<style scoped>
/* The admin shell's tokens; amber is this page's one extra (admin only, not for commercial use). */
.rm { --rm-warn: #8a4b00; --rm-warn-soft: #fff4e0; }
:global(.admin-shell[data-admin-theme="dark"]) .rm { --rm-warn: #f6c177; --rm-warn-soft: #3a2c14; }

.rm-heading { display: flex; gap: 14px; align-items: flex-start; min-width: 0; }
.rm-page-icon { display: grid; place-items: center; flex: none; width: 42px; height: 42px; border-radius: 10px;
  background: var(--admin-accent-soft); color: var(--admin-accent); }
.rm-head-actions { display: flex; flex-wrap: wrap; gap: 8px; }

.rm-skeleton { border-radius: 10px; background: var(--admin-soft); min-height: 320px; }
.rm-load-error { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 16px; color: var(--admin-danger); }
.rm-empty { display: flex; align-items: center; gap: 10px; padding: 20px; margin: 0 0 16px; color: var(--admin-muted); font-size: 13px; }

/* Filters */
.rm-filters { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; margin-bottom: 12px; }
.rm-states { display: inline-flex; flex-wrap: wrap; gap: 2px; padding: 3px; border: 1px solid var(--admin-line); border-radius: 8px;
  background: var(--admin-surface); }
.rm-state-filter { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 11px; border: 0; border-radius: 6px;
  background: transparent; color: var(--admin-muted); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer;
  transition: background-color 150ms, color 150ms; }
.rm-state-filter:hover { color: var(--admin-ink); background: var(--admin-soft); }
.rm-state-filter.is-on { background: var(--admin-accent-soft); color: var(--admin-accent); }
.rm-count { min-width: 18px; padding: 0 5px; border-radius: 999px; background: var(--admin-soft); color: var(--admin-ink);
  font-size: 11px; font-variant-numeric: tabular-nums; text-align: center; }
.rm-state-filter.is-on .rm-count { background: var(--admin-surface); color: var(--admin-accent); }
.rm-filter-fields { display: flex; flex-wrap: wrap; gap: 8px; flex: 1 1 320px; }
.rm-filter-fields select { flex: 0 1 220px; }
.rm-find { position: relative; display: flex; align-items: center; flex: 1 1 180px; max-width: 320px; }
.rm-find svg { position: absolute; left: 10px; color: var(--admin-muted); pointer-events: none; }
.rm-find input { width: 100%; padding-left: 32px; }
.rm-running { margin: 0 0 0 auto; color: var(--admin-muted); font-size: 12.5px; white-space: nowrap; }
.rm-running strong { color: var(--admin-success); font-size: 15px; font-variant-numeric: tabular-nums; }

/* List and panel */
.rm-browse { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 16px; align-items: start; margin-bottom: 20px; }
.rm-list { overflow: hidden; }
.rm-rows { list-style: none; margin: 0; padding: 0; }
.rm-rows li + li { border-top: 1px solid var(--admin-line); }
.rm-row { position: relative; display: grid; grid-template-columns: 92px minmax(0, 1fr) auto 16px; align-items: center; gap: 10px;
  width: 100%; min-height: 56px; padding: 10px 12px 10px 14px; border: 0; background: transparent; color: inherit; font: inherit;
  text-align: left; cursor: pointer; transition: background-color 150ms; }
.rm-row:hover { background: var(--admin-soft); }
.rm-row.is-chosen { background: var(--admin-accent-soft); }
.rm-row.is-chosen::before { content: ''; position: absolute; left: 0; top: 6px; bottom: 6px; width: 3px; border-radius: 0 3px 3px 0;
  background: var(--admin-accent); }
.rm-row:focus-visible { outline: 2px solid var(--admin-accent); outline-offset: -2px; }
.rm-row-main { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.rm-row-main strong { font-size: 13px; overflow-wrap: anywhere; }
.rm-row-sub { color: var(--admin-muted); font-size: 12px; overflow-wrap: anywhere; }
.rm-row-note { display: inline-flex; align-items: center; gap: 4px; color: var(--admin-accent); font-size: 11.5px; }
.rm-row-note.is-bad { color: var(--admin-danger); }
.rm-row-side { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; text-align: right; }
.rm-row-price { font-size: 12px; color: var(--admin-ink); font-variant-numeric: tabular-nums; white-space: nowrap; }
.rm-row-go { color: var(--admin-muted); }
.rm-none { padding: 24px 16px; text-align: center; color: var(--admin-muted); }
.rm-none p { margin: 0 0 10px; }

.rm-state { display: inline-flex; align-items: center; justify-content: center; gap: 5px; width: max-content; padding: 3px 9px;
  border-radius: 999px; font-size: 11.5px; font-weight: 650; border: 1px solid var(--admin-line); background: var(--admin-soft);
  color: var(--admin-muted); }
.rm-state.is-on { color: var(--admin-success); border-color: currentColor; background: color-mix(in srgb, var(--admin-success) 10%, var(--admin-surface)); }
.rm-state.is-starting { color: var(--admin-accent); border-color: currentColor; background: var(--admin-accent-soft); }
.rm-state.is-failed { color: var(--admin-danger); border-color: currentColor; background: color-mix(in srgb, var(--admin-danger) 9%, var(--admin-surface)); }
.rm-state.is-big { padding: 5px 12px; font-size: 12.5px; }

.rm-panel { position: sticky; top: 16px; padding: 20px 22px; max-height: calc(100dvh - 105px); overflow-y: auto; outline: none; }
.rm-back { display: none; margin-bottom: 12px; }
.rm-panel-head { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 10px; }
.rm-panel-title { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -.3px; overflow-wrap: anywhere; }
.rm-panel-kind { margin: 2px 0 0; color: var(--admin-muted); font-size: 12.5px; }

.rm-wait { display: flex; flex-direction: column; gap: 7px; margin: 14px 0 0; padding: 10px 12px; border-radius: 8px;
  background: var(--admin-accent-soft); color: var(--admin-ink); font-size: 12.5px; overflow-wrap: anywhere; }
.rm-wait progress { width: 100%; height: 6px; accent-color: var(--admin-accent); }
.rm-failure { display: flex; gap: 8px; align-items: flex-start; margin: 14px 0 0; padding: 10px 12px; border-radius: 8px;
  background: color-mix(in srgb, var(--admin-danger) 9%, var(--admin-surface)); color: var(--admin-danger); font-size: 12.5px; overflow-wrap: anywhere; }
.rm-failure svg { flex: none; margin-top: 2px; }

.rm-group { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--admin-line); }
.rm-group-title { margin: 0 0 10px; font-size: 13px; font-weight: 650; }
.rm-run, .rm-price { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; }
.rm-main-action { min-width: 120px; min-height: 38px; font-size: 12.5px; }
.rm-stop { color: var(--admin-danger); border-color: color-mix(in srgb, var(--admin-danger) 45%, var(--admin-line)); }
.rm-help { display: block; margin-top: 6px; font-size: 12px; color: var(--admin-muted); }
.rm-field { display: flex; flex-direction: column; gap: 4px; flex: 1 1 240px; min-width: 0; }
.rm-field label { font-size: 12.5px; font-weight: 600; color: var(--admin-ink); }
.rm-field select, .rm-field input { width: 100%; min-width: 0; }
.rm-field small { font-size: 12px; color: var(--admin-muted); }
.rm-field input[aria-invalid="true"] { border-color: var(--admin-danger); }
.rm-money { display: flex; align-items: center; gap: 6px; }
.rm-money span { color: var(--admin-muted); font-weight: 600; }

.rm-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px 20px; margin: 18px 0 0;
  padding-top: 16px; border-top: 1px solid var(--admin-line); }
.rm-facts div { min-width: 0; }
.rm-facts-wide { grid-column: 1 / -1; }
.rm-facts dt { font-size: 12px; color: var(--admin-muted); }
.rm-facts dd { margin: 2px 0 0; font-size: 13px; color: var(--admin-ink); overflow-wrap: anywhere; }
.rm-part { color: var(--admin-muted); font-size: 12px; }
.rm-bad { color: var(--admin-danger); }
.rm-quiet { margin-top: 10px; color: var(--admin-muted); }
.rm-quiet:hover:not(:disabled) { color: var(--admin-ink); }

.rm-admin-only { margin-top: 14px; }
.rm-check { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; cursor: pointer; min-height: 32px; }
.rm-check input { width: 16px; height: 16px; cursor: pointer; accent-color: var(--admin-accent); }
.rm-check input:disabled { cursor: not-allowed; }

.rm-remove-zone { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin-top: 22px;
  padding: 12px 14px; border: 1px dashed color-mix(in srgb, var(--admin-danger) 40%, var(--admin-line)); border-radius: 8px; }
.rm-remove-zone strong { font-size: 12.5px; }
.rm-remove-zone .rm-help { margin-top: 2px; }
.rm-danger-ghost { color: var(--admin-danger); }
.rm-danger-solid { background: var(--admin-danger); border-color: var(--admin-danger); color: #fff; }
:global(.admin-shell[data-admin-theme="dark"]) .rm-danger-solid { color: #1a0d0c; }

.rm-tag { display: inline-block; font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: 999px;
  background: var(--admin-accent-soft); color: var(--admin-accent); white-space: nowrap; }
.rm-tag.is-warn { background: var(--rm-warn-soft); color: var(--rm-warn); }
.rm-tag.is-plain { background: var(--admin-soft); color: var(--admin-ink); font-weight: 500; }

/* Add a model */
.rm-card { padding: 20px 22px; margin-bottom: 16px; min-width: 0; scroll-margin-top: 16px; outline: none; }
.rm-card-head p { margin: 4px 0 0; max-width: 760px; }
.rm-rules { list-style: none; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 8px; margin: 14px 0 0; padding: 0; }
.rm-rules li { display: flex; gap: 8px; align-items: flex-start; padding: 10px 12px; border-radius: 8px; background: var(--admin-soft);
  font-size: 12.5px; line-height: 1.5; }
.rm-rules svg { flex: none; margin-top: 2px; color: var(--rm-warn); }
.rm-steps { list-style: none; display: flex; flex-wrap: wrap; gap: 6px 22px; margin: 18px 0 4px; padding: 0; counter-reset: none; }
.rm-steps li { display: inline-flex; align-items: center; gap: 8px; color: var(--admin-muted); font-size: 12.5px; font-weight: 600; }
.rm-step-n { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; border: 1.5px solid var(--admin-line);
  font-size: 11.5px; font-variant-numeric: tabular-nums; }
.rm-steps li.is-now { color: var(--admin-ink); }
.rm-steps li.is-now .rm-step-n { border-color: var(--admin-accent); color: var(--admin-accent); }
.rm-steps li.is-done .rm-step-n { border-color: var(--admin-success); background: var(--admin-success); color: var(--admin-surface); }
.rm-step-title { margin: 20px 0 6px; font-size: 13px; font-weight: 650; }
.rm-step-hint { margin: 0; }
.rm-search { display: grid; grid-template-columns: minmax(0, 1fr) 200px; align-items: end; gap: 12px; }
.rm-search-input { position: relative; display: flex; align-items: center; }
.rm-search-input > svg:first-child { position: absolute; left: 12px; color: var(--admin-muted); pointer-events: none; }
.rm-search-input input { padding-left: 36px; padding-right: 36px; min-height: 42px; }
.rm-search-input .rm-spin { position: absolute; right: 12px; color: var(--admin-accent); }
.rm-search-said { margin: 6px 0 0; min-height: 18px; }
.rm-found { list-style: none; margin: 10px 0 4px; padding: 0; display: grid; gap: 8px; max-height: 420px; overflow-y: auto; }
.rm-found-pick { width: 100%; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 4px 12px;
  padding: 10px 12px; border: 1px solid var(--admin-line); border-radius: 10px; background: var(--admin-surface); text-align: left; cursor: pointer;
  font: inherit; color: inherit; min-height: 44px; transition: border-color 150ms, background-color 150ms; }
.rm-found-pick:hover:not(:disabled) { border-color: var(--admin-accent); }
.rm-found-pick:focus-visible { outline: 2px solid var(--admin-accent); outline-offset: 2px; }
.rm-found li.is-picked .rm-found-pick { border-color: var(--admin-accent); background: var(--admin-accent-soft); }
.rm-found-main { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.rm-found-main strong { overflow-wrap: anywhere; }
.rm-found-facts { display: flex; flex-wrap: wrap; gap: 2px 14px; color: var(--admin-muted); font-size: 12px; }
.rm-found-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.rm-found-tags:empty { display: none; }
.rm-found-note { grid-column: 1; }
.rm-found li.is-off .rm-found-pick { cursor: not-allowed; background: var(--admin-soft); color: var(--admin-ink); opacity: 1; }
.rm-found li.is-off .rm-found-cta { color: var(--admin-muted); }
.rm-found-why { color: var(--rm-warn); font-size: 12px; }
.rm-found-cta { grid-row: 1; grid-column: 2; font-size: 12.5px; font-weight: 600; color: var(--admin-accent); white-space: nowrap; }
.rm-add-form { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); align-items: start; gap: 14px 14px; margin-top: 12px; }
.rm-add-actions { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 14px; padding-top: 14px;
  border-top: 1px solid var(--admin-line); }
.rm-add-actions .rm-step-title { margin: 0; }
.rm-add-actions .btn { min-height: 38px; min-width: 150px; }

.rm-confirm { margin-top: 12px; padding: 12px 14px; border-radius: 8px; border: 1px solid var(--admin-line); background: var(--admin-soft); }
.rm-confirm p { margin: 0 0 10px; font-size: 13px; color: var(--admin-ink); }
.rm-confirm-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }

.rm-overlay { position: fixed; inset: 0; z-index: 120; display: grid; place-items: center; padding: 16px;
  background: rgb(15 23 42 / 45%); overscroll-behavior: contain; }
.rm :where(button, a, select) { touch-action: manipulation; }
.rm-panel-title, .rm h2 { text-wrap: balance; }
.rm-dialog { width: min(440px, 100%); padding: 22px; border-radius: 12px; background: var(--admin-surface); color: var(--admin-ink);
  border: 1px solid var(--admin-line); box-shadow: 0 20px 50px rgb(15 23 42 / 25%); }
.rm-dialog h2 { margin: 12px 0 6px; }
.rm-dialog p { margin: 0 0 16px; color: var(--admin-muted); font-size: 13px; }
.rm-dialog-icon { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 10px;
  background: color-mix(in srgb, var(--admin-danger) 12%, var(--admin-surface)); color: var(--admin-danger); }

.rm-error { color: var(--admin-danger); font-size: 12.5px; font-style: normal; overflow-wrap: anywhere; }
.rm-field small.rm-error { color: var(--admin-danger); }
.rm-banner { margin: 12px 0 0; }
.rm-muted { color: var(--admin-muted); font-size: 12.5px; }

.rm-machine-list { list-style: none; margin: 10px 0 0; padding: 0; display: grid; gap: 10px; }
.rm-machine-list li { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px;
  padding: 10px 0; border-top: 1px solid var(--admin-line); }
.rm-machine-list li .rm-confirm, .rm-machine-list li .rm-error { flex-basis: 100%; }
.rm-machine-main { display: flex; gap: 10px; align-items: flex-start; min-width: 0; overflow-wrap: anywhere; }
.rm-licence-ok { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; color: var(--admin-success); }
.rm-dot { display: inline-block; width: 7px; height: 7px; margin-right: 6px; border-radius: 50%; background: var(--admin-muted); }
.rm-dot.is-on { background: var(--admin-success); }

.rm :where(button, select, input, a):focus-visible { outline: 2px solid var(--admin-accent); outline-offset: 2px; }
.rm-spin { animation: rm-spin 1s linear infinite; }
@keyframes rm-spin { to { transform: rotate(360deg); } }

/* Up to a small laptop: the list, then the chosen model in its place with a way back. */
@media (max-width: 1023px) {
  .rm-browse { grid-template-columns: minmax(0, 1fr); }
  .rm-browse.is-detail .rm-list { display: none; }
  .rm-browse:not(.is-detail) .rm-panel { display: none; }
  .rm-panel { position: static; max-height: none; overflow: visible; }
  .rm-back { display: inline-flex; }
  .rm-running { margin-left: 0; }
}
@media (max-width: 767px) {
  .rm-card, .rm-panel { padding: 16px; }
  .rm :where(.btn, select, input) { min-height: 44px; }
  .rm-add-actions .btn, .rm-main-action, .rm-state-filter { min-height: 44px; }
  .rm-states { display: grid; grid-template-columns: repeat(5, auto); justify-content: space-between; width: 100%; }
  .rm-state-filter { justify-content: center; gap: 4px; padding: 0 6px; }
  .rm-filter-fields select, .rm-find { flex: 1 1 100%; max-width: none; }
  .rm-row { grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "state side" "main main"; gap: 6px 10px; }
  .rm-row > .rm-state { grid-area: state; }
  .rm-row-main { grid-area: main; }
  .rm-row-side { grid-area: side; flex-direction: row; align-items: center; }
  .rm-row-go { display: none; }
  .rm-search { grid-template-columns: minmax(0, 1fr); }
  .rm-main-action, .rm-price > .btn, .rm-machine-list .btn, .rm-add-actions .btn, .rm-remove-zone .btn { width: 100%; }
  .rm-confirm-actions .btn { flex: 1 1 auto; }
  .rm-overlay { place-items: end center; padding: 0; }
  .rm-dialog { width: 100%; border-radius: 12px 12px 0 0; }
}
@media (prefers-reduced-motion: reduce) {
  .rm-spin { animation: none; }
  .rm-row, .rm-state-filter, .rm-found-pick { transition: none; }
}
</style>
