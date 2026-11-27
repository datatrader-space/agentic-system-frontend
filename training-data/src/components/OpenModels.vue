<script setup>
// The workspace Models page's "Open models" tab: search Hugging Face Hub for open models AADML can train or serve,
// and add one to this workspace as a base model for training. The backend decides what is shown and what may be added
// (training_models_data/open_models.py); this page shows its answers as text only, never as HTML.
// Use model and Try it of an added model are the Models page's (WorkspaceModels.vue): it passes the workspace's ready
// open models (``usable``, app_api.open_model_rows, with their ``may`` flags), and its Try panel goes in the ``trying``
// slot under this list.
import { computed, onUnmounted, ref, watch } from 'vue';
import { Code, Play, RefreshCw, Globe, ShieldCheck, Boxes, Search, Box, MessageSquareText, Image as ImageIcon, Lock, ExternalLink, Download, Heart, Plus, Trash2, Check, Scale, Wallet, Copy } from 'lucide-vue-next';
import DeploymentHeader from './DeploymentHeader.vue';
import DeploymentMetrics from './DeploymentMetrics.vue';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import UiDialog from './UiDialog.vue';
import {
  openModelsApi, SEARCH_KINDS, SHOWN, TYPE_PAUSE_MS, QUERY_LIMIT, POLL_MS, queryProblem, hubLink, shortCount, usesText, stateBadge,
  anyFetching, hiddenSummary, mergePage, resultsSaid, addRefusal, addedFor, quoteLines, quoteNote, modelBadge, storageLine,
  placeChoices, quoteFor, placeLine,
  trainNote, gpuFacts, kindLabel, sizeShown,
} from '../api/openModels.js';

const props = defineProps({ usable: { type: Array, default: () => [] } });
const emit = defineEmits(['use', 'try', 'changed']);
// The Models page's row of an added model, by its id: present only once it is ready in this workspace.
const usableById = computed(() => new Map(props.usable.map(row => [row.id, row])));
const usableOf = m => usableById.value.get(m.id) || null;

const kind = ref('all'); const words = ref('');
// Search as you type (owner, 2026-11-26): the search is asked a moment after the last key, or at once on Enter.
const shown = ref(SHOWN);
let pause = null;
watch(words, () => { clearTimeout(pause); pause = setTimeout(() => search(), TYPE_PAUSE_MS); });
watch(kind, () => { clearTimeout(pause); search(); });
const visible = computed(() => results.value.slice(0, shown.value));
const results = ref([]); const next = ref(''); const hidden = ref({}); const reasons = ref({});
const mayAdd = ref(false); const gatedEnabled = ref(false); const searching = ref(false); const more = ref(false); const searched = ref(false);
const error = ref(''); const said = ref('');
const day = iso => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); };
const leftOut = computed(() => hiddenSummary(hidden.value, reasons.value));
const problem = computed(() => queryProblem(words.value));

// Each search is numbered: an older answer that comes back after a newer search was started is dropped.
let asked = 0;
async function search({ again = false } = {}) {
  if (problem.value) { error.value = problem.value; return; }
  error.value = '';
  const mine = ++asked;
  if (again) more.value = true; else { searching.value = true; shown.value = SHOWN; }
  try {
    const page = await openModelsApi.search({ q: words.value, kind: kind.value, cursor: again ? next.value : '' });
    if (mine !== asked) return;
    results.value = again ? mergePage(results.value, page.results) : page.results;
    hidden.value = again ? sumHidden(hidden.value, page.hidden) : page.hidden || {};
    reasons.value = page.reasons || {}; next.value = page.next || ''; mayAdd.value = !!page.may?.add; gatedEnabled.value = !!page.gated_enabled;
    searched.value = true; said.value = resultsSaid(results.value.length, !!next.value);
  } catch (e) { if (mine === asked) { error.value = e.message; said.value = e.message; } }
  finally { if (mine === asked) { searching.value = false; more.value = false; } }
}
function sumHidden(a, b) { const out = { ...a }; for (const [k, n] of Object.entries(b || {})) out[k] = (out[k] || 0) + n; return out; }
// Show more: the next results already read, else the Hub's next page.
function showMore() { if (results.value.length > shown.value) shown.value += SHOWN; else { shown.value += SHOWN; search({ again: true }); } }
const hasMore = computed(() => results.value.length > shown.value || !!next.value);
search();

// ── the workspace's added models ─────────────────────────────────────────────────────────────────
const added = ref(null); const listError = ref(''); const listing = ref(false);
let timer = null; let alive = true;
async function loadAdded() {
  if (listing.value) return;
  listing.value = true;
  try { const body = await openModelsApi.list(); added.value = body.models; mayAdd.value = mayAdd.value || !!body.may?.add; listError.value = ''; }
  catch (e) { listError.value = e.message; added.value = added.value || []; }
  finally { listing.value = false; }
  clearTimeout(timer);
  if (alive && anyFetching(added.value)) timer = setTimeout(loadAdded, POLL_MS);
}
loadAdded();
// When a model becomes ready, is removed or is added, the Models page reloads its rows (Use model, Try it).
let readySeen = null;
watch(added, now => {
  const ready = (now || []).filter(m => m.state === 'ready').map(m => m.id).sort().join(',');
  if (readySeen !== null && ready !== readySeen) emit('changed');
  readySeen = ready;
});
onUnmounted(() => { alive = false; clearTimeout(timer); clearTimeout(pause); });

// Add opens a dialog with what adding costs: the backend's quote (the fetch, about and at most, and the storage a day,
// with the markup in), never a price worked out here. Add in the dialog adds; Cancel adds nothing. The person chooses
// where it is downloaded (their machines, AADML's platform machine or RunPod; ADM-1365 phase 2b): nothing is picked
// for them, and Add waits for the choice.
const adding = ref(''); const cardError = ref({});
const confirming = ref(null); const quote = ref(null); const quoting = ref(false); const quoteError = ref(''); const addError = ref('');
const place = ref('');
const choices = computed(() => placeChoices(quote.value));
const shownQuote = computed(() => quoteFor(quote.value, place.value));
let quoted = 0;
async function askAdd(row) {
  confirming.value = row; quote.value = null; quoteError.value = ''; addError.value = ''; quoting.value = true; place.value = '';
  const mine = ++quoted;
  try { const body = await openModelsApi.quote(row.repo); if (mine === quoted) quote.value = body; }
  catch (e) { if (mine === quoted) quoteError.value = e.message; }
  finally { if (mine === quoted) quoting.value = false; }
}
function cancelAdd() { if (adding.value) return; quoted++; confirming.value = null; quote.value = null; quoting.value = false; }
async function add() {
  const row = confirming.value;
  if (!row || !quote.value || !place.value) return;
  adding.value = row.repo; addError.value = ''; cardError.value = { ...cardError.value, [row.repo]: '' };
  try {
    const body = await openModelsApi.add(row.repo, place.value);
    row.added = { id: body.model.id, state: body.model.state, state_label: body.model.state_label };
    said.value = `${row.name} was added. ${body.model.state === 'fetching' ? 'Its files are being fetched.' : stateBadge(body.model.state)[1]}.`;
    confirming.value = null; quote.value = null;
    await loadAdded();
  } catch (e) { addError.value = e.message; said.value = e.message; }
  finally { adding.value = ''; }
}

// Make a copy of a model kept for the person's own machines, so RunPod can use it: the same quote, the full copy's
// two places only (AADML's platform machine or RunPod), chosen by the person.
const copying = ref(null); const copyQuote = ref(null); const copyPlace = ref(''); const copyBusy = ref(false); const copyError = ref('');
const copyChoices = computed(() => placeChoices(copyQuote.value, { only: ['platform', 'runpod'] }));
async function askCopy(model) {
  copying.value = model; copyQuote.value = null; copyPlace.value = ''; copyError.value = '';
  try { copyQuote.value = await openModelsApi.quote(model.repo); } catch (e) { copyError.value = e.message; }
}
async function makeCopy() {
  if (!copying.value || !copyPlace.value) return;
  copyBusy.value = true; copyError.value = '';
  try {
    await openModelsApi.copy(copying.value.id, copyPlace.value);
    said.value = `A copy of ${copying.value.name} is being made.`;
    copying.value = null; await loadAdded();
  } catch (e) { copyError.value = e.message; said.value = e.message; }
  finally { copyBusy.value = false; }
}

const removing = ref(null); const removeBusy = ref(false); const removeError = ref('');
function askRemove(model) { removing.value = model; removeError.value = ''; }
async function remove() {
  removeBusy.value = true; removeError.value = '';
  try {
    await openModelsApi.remove(removing.value.id);
    for (const row of results.value) if (row.added?.id === removing.value.id) row.added = null;
    said.value = `${removing.value.name} was removed from this workspace.`;
    removing.value = null; await loadAdded();
  } catch (e) { removeError.value = e.message; } finally { removeBusy.value = false; }
}
const cannotAdd = row => addRefusal(row, { mayAdd: mayAdd.value, gatedEnabled: gatedEnabled.value });
const openMetrics = computed(() => [
  { label: 'Added models', value: added.value?.length || 0, hint: 'In this workspace', icon: Boxes },
  { label: 'Files ready', value: (added.value || []).filter(m => m.state === 'ready').length, hint: 'Fetched and available', icon: Check },
  { label: 'Fetching', value: (added.value || []).filter(m => m.state === 'fetching').length, hint: 'Preparing model files', icon: Download },
]);
// Enter searches at once instead of after the pause.
function searchNow() { clearTimeout(pause); search(); }
</script>

<template>
  <div class="om-page">
    <DeploymentHeader title="Open Models" heading-id="open-heading" eyebrow="DISCOVER YOUR NEXT FOUNDATION." :icon="Globe" description="Find supported models on Hugging Face and add them to your workspace for training or deployment."/>
    <DeploymentMetrics :items="openMetrics" :loaded="!!added && !listError"/>
    <div class="models-info"><ShieldCheck :size="17" aria-hidden="true"/><p>Every model the Hub returns is shown. Each card says whether you can add it and, if not, why: safetensors weights and no custom code are always required.</p></div>

    <section class="om-section" aria-labelledby="om-added">
      <div class="models-list-head"><div><h3 id="om-added">Workspace models <span class="models-count">{{ added ? added.length : '—' }}</span></h3><p>Models available to your workspace's training and deployment flows.</p></div><UiButton :disabled="listing" @click="loadAdded"><RefreshCw :size="14" aria-hidden="true"/> Refresh</UiButton></div>
      <div v-if="listError" class="models-error" role="alert"><span>{{ listError }}</span><UiButton :disabled="listing" @click="loadAdded">Try again</UiButton></div>
      <p v-if="!added" class="muted">Loading…</p>
      <div v-else-if="!added.length && !listError" class="om-workspace-empty"><span class="model-row-icon"><Box :size="22" aria-hidden="true"/></span><div><h4>No open models added yet</h4><p>Discover a model below. After its files are fetched, it becomes available for its supported uses.</p></div></div>
      <ul v-else-if="added.length" class="om-added">
        <li v-for="m in added" :key="m.id">
          <div class="om-row-head">
            <span class="model-row-icon" aria-hidden="true"><MessageSquareText v-if="m.kind==='chat'" :size="18"/><ImageIcon v-else :size="18"/></span>
            <div class="om-added-name"><strong>{{ m.name }}</strong><small>{{ m.publisher }} · {{ kindLabel(m.kind) }} · {{ sizeShown(m) }} · commit {{ (m.revision || "").slice(0, 12) }}</small></div>
            <div class="om-row-tags"><span class="om-added-licence"><Scale :size="14" aria-hidden="true"/>{{ m.licence_name }}</span><UiBadge :tone="modelBadge(m)[0]">{{ modelBadge(m)[1] }}</UiBadge></div>
          </div>
          <div class="om-row-notes">
            <p v-if="m.failure" class="om-failure">{{ m.failure }}</p>
            <p v-if="storageLine(m)" :class="['om-note', 'om-storage', { unpaid: m.unpaid }]"><Wallet :size="13" aria-hidden="true"/>{{ storageLine(m) }}</p>
            <p v-if="addedFor(m)" class="om-note">{{ addedFor(m) }}</p>
            <p v-if="placeLine(m)" class="om-note om-place-note">{{ placeLine(m) }}</p>
            <p v-if="m.copy_failure" class="om-failure">The copy failed: {{ m.copy_failure }}</p>
            <p v-if="m.state==='ready' && m.kind==='photo' && (m.uses || []).includes('train')" class="om-note" data-test="om-train-note">{{ trainNote(m) }}</p>
          </div>
          <div class="om-added-actions">
            <div class="om-row-manage">
              <a class="button" :href="hubLink(m.repo)" target="_blank" rel="noopener noreferrer" :aria-label="`${m.name} on Hugging Face (opens a new tab)`"><ExternalLink :size="14" aria-hidden="true"/>Hugging Face</a>
              <!-- A failed fetch is fetched again from its row (live, 2026-11-12: Remove was the only way out, then Add again). The
                   same dialog as Add: its price first; the backend pins it anew (open_models.add). -->
              <UiButton v-if="mayAdd && m.state==='failed'" variant="primary" :disabled="adding===m.repo" @click="askAdd(m)"><RefreshCw :size="14" aria-hidden="true"/>{{ adding===m.repo ? 'Fetching…' : 'Fetch again' }}</UiButton>
              <UiButton v-if="mayAdd && placeLine(m)" @click="askCopy(m)"><Copy :size="14" aria-hidden="true"/>Make a copy</UiButton>
              <UiButton v-if="mayAdd" :disabled="m.state==='fetching'" :title="m.state==='fetching' ? 'It can be removed once its fetch has ended.' : ''" @click="askRemove(m)"><Trash2 :size="14" aria-hidden="true"/>Remove</UiButton>
            </div>
            <div class="om-row-use">
              <UiButton v-if="usableOf(m)?.may.use" :disabled="!usableOf(m).may.try" :title="!usableOf(m).may.try ? 'Your role in this workspace reads only: it starts nothing.' : ''" @click="emit('try', usableOf(m))"><Play :size="14" aria-hidden="true"/>Try it</UiButton>
              <UiButton v-if="usableOf(m)?.use && usableOf(m).may.use" variant="primary" @click="emit('use', usableOf(m))"><Code :size="14" aria-hidden="true"/>Use model</UiButton>
            </div>
          </div>
        </li>
      </ul>
    </section>
    <slot name="trying"/>

    <div class="models-list-head"><div><h3>Discover models</h3><p>Search the Hub by name, model family, and intended use.</p></div><span class="models-source-label"><Globe :size="13" aria-hidden="true"/> Hugging Face Hub</span></div>
    <form class="om-toolbar" role="search" @submit.prevent="searchNow">
      <label class="om-search">
        <span class="sr-only">Search Hugging Face models</span>
        <Search :size="16" aria-hidden="true"/>
        <input v-model="words" type="search" :maxlength="QUERY_LIMIT + 20" placeholder="Search Hugging Face models, e.g. qwen, segformer or flux" :aria-invalid="!!problem" aria-describedby="om-query-help" data-test="om-words">
        <span v-if="searching" class="om-spinner" aria-hidden="true"></span>
      </label>
      <label class="om-kind"><span class="sr-only">Kind of model</span>
        <select v-model="kind" class="compact-select" aria-label="Kind of model" data-test="om-kind">
          <option v-for="k in SEARCH_KINDS" :key="k.value" :value="k.value">{{ k.label }}</option>
        </select>
      </label>
    </form>
    <p id="om-query-help" class="om-help">{{ problem || 'The most downloaded first, as you type. A model that cannot be added here says why.' }}</p>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <p class="sr-only" aria-live="polite">{{ said }}</p>

    <section class="om-section" aria-labelledby="om-results" :aria-busy="searching">
      <div class="models-list-head"><h3 id="om-results">Search results <span v-if="searched" class="models-count">{{ results.length }}</span></h3><span class="models-source-label">Most downloaded first</span></div>
      <p v-if="leftOut" class="om-left-out">{{ leftOut }}</p>
      <p v-if="searching && !results.length" class="muted">Searching Hugging Face…</p>
      <div v-else-if="searched && !results.length && !error" class="om-empty">
        <Box :size="28" aria-hidden="true"/>
        <p>No model on Hugging Face matches. Try other words, or another kind.</p>
      </div>
      <div class="om-grid">
        <article v-for="row in visible" :key="row.repo" class="panel om-card" :class="{ 'om-card--off': !row.added && !!cannotAdd(row) }" :data-test="`om-card-${row.repo}`">
          <div class="om-card-head"><UiBadge v-if="row.kind">{{ kindLabel(row.kind) }}</UiBadge><UiBadge v-if="row.commercial === false" tone="amber">Not for commercial use</UiBadge><UiBadge v-if="row.gated" tone="amber">Gated</UiBadge><UiBadge v-if="row.task">{{ row.task }}</UiBadge><UiBadge v-if="row.added" :tone="stateBadge(row.added.state)[0]">{{ stateBadge(row.added.state)[1] }}</UiBadge></div>
          <h3>{{ row.name }}</h3>
          <p class="om-publisher">{{ row.publisher }}</p>
          <dl class="om-facts">
            <div><dt>Size</dt><dd>{{ sizeShown(row) }}</dd></div>
            <div><dt><Download :size="12" aria-hidden="true"/>Downloads</dt><dd>{{ shortCount(row.downloads) }}</dd></div>
            <div><dt><Heart :size="12" aria-hidden="true"/>Likes</dt><dd>{{ shortCount(row.likes) }}</dd></div>
            <div v-if="day(row.updated)"><dt>Updated</dt><dd>{{ day(row.updated) }}</dd></div>
            <div v-for="[term, value] in gpuFacts(row)" :key="term"><dt>{{ term }}</dt><dd>{{ value }}</dd></div>
          </dl>
          <div class="om-licence">
            <p><Scale :size="14" aria-hidden="true"/><strong>{{ row.licence_name }}</strong></p>
            <p class="om-licence-use">{{ row.licence_terms || row.licence_use }}</p>
          </div>
          <p v-if="row.gated" class="om-gated"><Lock :size="14" aria-hidden="true"/>{{ row.gated_note || 'Its publisher asks for its terms to be accepted before a download.' }}</p>
          <p class="om-uses">{{ usesText(row.uses) }}</p>
          <p v-if="row.size_note" class="om-note" data-test="om-size-note">{{ row.size_note }}</p>
          <div class="om-card-actions">
            <UiButton v-if="!row.added" variant="primary" :disabled="!!cannotAdd(row) || adding===row.repo" :title="cannotAdd(row)" :aria-describedby="cannotAdd(row) ? `why-${row.repo}` : undefined" @click="askAdd(row)">
              <span v-if="adding===row.repo" class="om-spinner on-primary" aria-hidden="true"></span><Plus v-else :size="15" aria-hidden="true"/>{{ adding===row.repo ? 'Adding…' : 'Add to workspace' }}</UiButton>
            <span v-else class="om-added-mark"><Check :size="15" aria-hidden="true"/>Added</span>
            <a class="button" :href="hubLink(row.repo)" target="_blank" rel="noopener noreferrer" :aria-label="`${row.name} on Hugging Face (opens a new tab)`"><ExternalLink :size="14" aria-hidden="true"/>Hugging Face</a>
          </div>
          <p v-if="cannotAdd(row) && !row.added" :id="`why-${row.repo}`" class="om-why-not" data-test="om-why-not">{{ cannotAdd(row) }}</p>
          <p v-if="cardError[row.repo]" class="field-error" role="alert">{{ cardError[row.repo] }}</p>
        </article>
      </div>
      <div v-if="hasMore" class="om-more"><UiButton :disabled="more" @click="showMore"><span v-if="more" class="om-spinner" aria-hidden="true"></span>{{ more ? 'Loading…' : 'Show more results' }}</UiButton></div>
    </section>

    <UiDialog :open="!!confirming" :title="confirming ? `Add ${confirming.name}?` : ''" @close="cancelAdd">
      <template v-if="confirming">
        <p class="dialog-description">Choose where it is downloaded. It is charged to your balance.</p>
        <p v-if="quoting" class="muted" role="status"><span class="om-spinner" aria-hidden="true"></span> Reading what it costs…</p>
        <p v-else-if="quoteError" class="field-error" role="alert">{{ quoteError }}</p>
        <template v-else-if="quote">
          <fieldset class="om-places">
            <legend>Download it on</legend>
            <label v-for="c in choices" :key="c.value" :class="['om-place', { on: place === c.value, off: !!c.refused }]">
              <input v-model="place" type="radio" name="om-place" :value="c.value" :disabled="!!c.refused || !!adding">
              <span class="om-place-text"><strong>{{ c.label }}</strong><small>{{ c.refused || c.help }}</small></span>
              <span v-if="c.price && !c.refused" class="om-place-price">{{ c.price }}</span>
            </label>
          </fieldset>
          <dl class="om-quote">
            <div v-for="line in quoteLines(shownQuote)" :key="line.label"><dt>{{ line.label }}</dt><dd>{{ line.value }}</dd></div>
          </dl>
          <p v-if="quote.licence_terms" class="om-quote-terms"><Scale :size="14" aria-hidden="true"/>{{ quote.licence_terms }}</p>
          <p v-if="place && quoteNote(shownQuote)" class="om-quote-note"><Wallet :size="15" aria-hidden="true"/><span>{{ quoteNote(shownQuote) }}</span></p>
        </template>
        <p v-if="addError" class="field-error" role="alert">{{ addError }}</p>
        <div class="om-dialog-actions">
          <UiButton :disabled="!!adding" @click="cancelAdd">Cancel</UiButton>
          <UiButton variant="primary" :disabled="!quote || quoting || !!adding || !place" :title="!place ? 'Choose where it is downloaded first.' : ''" @click="add"><span v-if="adding" class="om-spinner on-primary" aria-hidden="true"></span>{{ adding ? 'Adding…' : 'Add' }}</UiButton>
        </div>
      </template>
    </UiDialog>

    <UiDialog :open="!!copying" :title="copying ? `Make a copy of ${copying.name}?` : ''" @close="copying=null">
      <template v-if="copying">
        <p class="dialog-description">A full copy is kept in AADML's storage, so it can also run on RunPod. While it is made the model waits; if it fails, it keeps working on your machines.</p>
        <p v-if="!copyQuote && !copyError" class="muted" role="status"><span class="om-spinner" aria-hidden="true"></span> Reading what it costs…</p>
        <fieldset v-if="copyQuote" class="om-places">
          <legend>Make the copy on</legend>
          <label v-for="c in copyChoices" :key="c.value" :class="['om-place', { on: copyPlace === c.value, off: !!c.refused }]">
            <input v-model="copyPlace" type="radio" name="om-copy-place" :value="c.value" :disabled="!!c.refused || copyBusy">
            <span class="om-place-text"><strong>{{ c.label }}</strong><small>{{ c.refused || c.help }}</small></span>
            <span v-if="c.price && !c.refused" class="om-place-price">{{ c.price }}</span>
          </label>
        </fieldset>
        <p v-if="copyError" class="field-error" role="alert">{{ copyError }}</p>
        <div class="om-dialog-actions">
          <UiButton :disabled="copyBusy" @click="copying=null">Cancel</UiButton>
          <UiButton variant="primary" :disabled="!copyPlace || copyBusy" @click="makeCopy"><span v-if="copyBusy" class="om-spinner on-primary" aria-hidden="true"></span>{{ copyBusy ? 'Starting…' : 'Make a copy' }}</UiButton>
        </div>
      </template>
    </UiDialog>

    <UiDialog :open="!!removing" :title="removing ? `Remove ${removing.name}?` : ''" @close="removing=null">
      <template v-if="removing">
        <p class="dialog-description">It is no longer offered in this workspace's Train tabs, its fetched files are deleted and its storage is no longer charged. A model already trained from it keeps it: then it cannot be removed.</p>
        <p v-if="removeError" class="field-error" role="alert">{{ removeError }}</p>
        <div class="om-dialog-actions">
          <UiButton @click="removing=null">Keep it</UiButton>
          <UiButton variant="primary" :disabled="removeBusy" @click="remove"><span v-if="removeBusy" class="om-spinner on-primary" aria-hidden="true"></span>{{ removeBusy ? 'Removing…' : 'Remove' }}</UiButton>
        </div>
      </template>
    </UiDialog>
  </div>
</template>

<style scoped>
.om-page{color:#152237}
.om-intro{max-width:72ch;font-size:13px;color:#4d5a70;margin:0 0 18px}
.om-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.om-kind{flex:0 0 auto}
.om-kind select{min-height:44px}
.om-why-not{color:#92400e;font-size:12px;margin:4px 0 0}
.om-card--off h3,.om-card--off .om-publisher{opacity:.72}
.om-search{display:flex;align-items:center;gap:9px;flex:1 1 280px;min-width:0;max-width:440px;min-height:44px;padding:0 12px;border:1px solid #dfe1e9;border-radius:9px;background:#fff;color:#6b778c}
.om-search:focus-within{outline:3px solid var(--aadml-outline);outline-offset:2px;border-color:var(--aadml-focus)}
.om-search input{flex:1;min-width:0;border:0;outline:none;background:transparent;font-size:14px;color:#152237;padding:10px 0}
.om-help{margin:8px 0 0;font-size:12px;color:#5f6d82}
.om-section{margin-top:28px}
.om-section > h2{display:flex;align-items:center;gap:10px;font-size:16px;margin:0 0 12px}
.om-left-out{margin:0 0 14px;font-size:12px;color:#5f6d82;max-width:90ch}
.om-added{list-style:none;margin:0;padding:0;border:1px solid #e3e6ed;border-radius:12px;background:#fff}
.om-added li{display:flex;flex-direction:column;gap:12px;padding:18px 20px;border-bottom:1px solid #eef0f4}
.om-added li:last-child{border-bottom:0}
.om-row-head{display:flex;align-items:flex-start;gap:12px}
.om-row-head .model-row-icon{flex-shrink:0}
.om-added-name{min-width:0;flex:1}
.om-row-tags{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end}
.om-row-notes{display:flex;flex-direction:column;gap:4px;padding-left:44px}
.om-row-notes:empty{display:none}
.om-added-name strong{display:block;font-size:14px;overflow-wrap:anywhere}
.om-added-name small{display:block;font-size:12px;color:#5f6d82;margin-top:2px}
.om-added-licence{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#33415a}
.om-added-actions{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin-left:44px;padding-top:12px;border-top:1px solid #eef0f4}
.om-row-manage,.om-row-use{display:flex;flex-wrap:wrap;gap:8px}
.om-added-actions .button{padding:7px 12px}
.om-failure,.om-note{margin:0;font-size:12px;line-height:1.5}
.om-failure{color:#b52f40}
.om-note{color:#5f6d82}
.om-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:16px}
.om-card{display:flex;flex-direction:column;gap:6px;padding:20px!important;min-width:0}
.om-card h3{margin:6px 0 0;font-size:16px;overflow-wrap:anywhere}
.om-card-head{display:flex;gap:6px;flex-wrap:wrap}
.om-publisher{margin:0;font-size:12px;color:#5f6d82;overflow-wrap:anywhere}
.om-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 12px;margin:10px 0 4px}
.om-facts dt{display:flex;align-items:center;gap:4px;font-size:11px;color:#6b778c}
.om-facts dd{margin:2px 0 0;font-size:13px;font-weight:600;color:#22304a}
.om-licence{padding:10px 12px;border-radius:9px;background:var(--aadml-soft);border:1px solid #dbe7fd}
.om-licence p{margin:0;display:flex;align-items:center;gap:6px;font-size:13px;color:#1d2a42}
.om-licence svg{color:var(--aadml-primary)}
.om-licence .om-licence-use{display:block;margin-top:4px;font-size:12px;line-height:1.5;color:#33415a}
.om-gated{display:flex;gap:8px;align-items:flex-start;margin:4px 0 0;padding:8px 10px;border-radius:8px;background:#fff7e6;border:1px solid #f5dfb0;color:#6f4500;font-size:12px;line-height:1.5}
.om-gated svg{margin-top:2px}
.om-uses{margin:4px 0 0;font-size:12px;color:#33415a}
.om-card-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:auto;padding-top:12px}
.om-card-actions > *{flex:1 1 auto;justify-content:center;min-height:40px}
.om-added-mark{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:#27765a}
.om-empty{display:flex;align-items:center;gap:14px;padding:20px;border:1px dashed #cfd5e1;border-radius:12px;background:#fafbfc;color:#5f6d82;margin-bottom:16px}
.om-empty p{margin:0;font-size:13px}
.om-more{display:flex;justify-content:center;margin-top:20px}
.om-dialog-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px;flex-wrap:wrap}
.om-places{display:grid;gap:8px;margin:14px 0 0;padding:0;border:0;min-width:0}
.om-places legend{font-size:13px;font-weight:600;color:#1d2a42;margin-bottom:6px;padding:0}
.om-place{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:start;padding:10px 12px;border:1px solid #d5dbe5;border-radius:10px;background:#fff;cursor:pointer;min-height:44px}
.om-place.on{border-color:var(--aadml-primary);background:var(--aadml-soft)}
.om-place.off{cursor:not-allowed;opacity:.7}
.om-place input{margin-top:3px}
.om-place input:focus-visible{outline:2px solid var(--aadml-primary);outline-offset:2px}
.om-place-text{display:grid;gap:2px;min-width:0}
.om-place-text strong{font-size:13px;color:#1d2a42}
.om-place-text small{font-size:12px;line-height:1.5;color:#4a5872}
.om-place-price{font-size:12px;font-weight:600;color:#1d2a42;white-space:nowrap}
.om-quote{display:grid;grid-template-columns:minmax(0,max-content) minmax(0,1fr);gap:8px 16px;margin:14px 0 0;padding:12px 14px;border:1px solid #e3e6ed;border-radius:10px;background:#fafbfc}
.om-quote div{display:contents}
.om-quote dt{font-size:12px;color:#5f6d82}
.om-quote dd{margin:0;font-size:13px;font-weight:600;color:#1d2a42;overflow-wrap:anywhere}
.om-quote-terms{display:flex;gap:6px;align-items:flex-start;margin:10px 0 0;font-size:12px;line-height:1.5;color:#33415a}
.om-quote-terms svg{flex-shrink:0;margin-top:2px;color:var(--aadml-primary)}
.om-quote-note{display:flex;gap:8px;align-items:flex-start;margin:10px 0 0;padding:10px 12px;border-radius:9px;background:var(--aadml-soft);border:1px solid #dbe7fd;font-size:12px;line-height:1.5;color:#1d2a42}
.om-quote-note svg{flex-shrink:0;margin-top:1px;color:var(--aadml-primary)}
.om-storage{display:flex;align-items:center;gap:6px}
.om-storage.unpaid{color:#93610b}
.om-spinner{width:14px;height:14px;border-radius:50%;border:2px solid var(--aadml-soft);border-top-color:var(--aadml-primary);animation:om-spin 1s linear infinite;flex-shrink:0}
.om-spinner.on-primary{border-color:#ffffff55;border-top-color:#fff}
@keyframes om-spin{to{transform:rotate(360deg)}}
.badge--amber{color:#93610b;background:#fff4dc}
.muted{font-size:12px;color:#5f6d82}
.count{font-size:12px;font-weight:500;color:#5f6d82}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media (prefers-reduced-motion: reduce){.om-spinner{animation:none}}
@media (max-width:640px){
  .om-toolbar{align-items:stretch}
  .om-search{flex-basis:100%;max-width:none}
  .om-toolbar > .button{flex:1 1 100%;justify-content:center;min-height:44px}
  .om-added li{padding:16px}
  .om-row-head{flex-wrap:wrap}
  .om-row-tags{flex-basis:100%;justify-content:flex-start;padding-left:44px}
  .om-row-notes,.om-added-actions{padding-left:0;margin-left:0}
  .om-row-use{order:-1;width:100%}
  .om-row-use > *,.om-row-manage > *{flex:1 1 0;justify-content:center}
  .om-row-manage{width:100%}
  .om-grid{grid-template-columns:minmax(0,1fr)}
  .om-quote{grid-template-columns:minmax(0,1fr)}
  .om-place{grid-template-columns:auto minmax(0,1fr)}
  .om-place-price{grid-column:2;white-space:normal}
  .om-dialog-actions > *{flex:1 1 auto;justify-content:center;min-height:44px}
}
</style>
