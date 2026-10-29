<script setup>
// The workspace Models page's "Open models" tab: search Hugging Face Hub for open models AADML can train or serve,
// and add one to this workspace as a base model for training. The backend decides what is shown and what may be added
// (training_models_data/open_models.py); this page shows its answers as text only, never as HTML.
import { computed, onUnmounted, ref } from 'vue';
import { Search, Box, MessageSquareText, Image as ImageIcon, Lock, ExternalLink, Download, Heart, Plus, Trash2, Check, Scale } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import UiDialog from './UiDialog.vue';
import {
  openModelsApi, KINDS, USES, QUERY_LIMIT, POLL_MS, queryProblem, hubLink, shortCount, bytesText, usesText, stateBadge,
  anyFetching, hiddenSummary, mergePage, resultsSaid, addRefusal, addedFor,
} from '../api/openModels.js';

const kind = ref('chat'); const use = ref('train'); const words = ref('');
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
  if (again) more.value = true; else searching.value = true;
  try {
    const page = await openModelsApi.search({ q: words.value, kind: kind.value, use: use.value, cursor: again ? next.value : '' });
    if (mine !== asked) return;
    results.value = again ? mergePage(results.value, page.results) : page.results;
    hidden.value = again ? sumHidden(hidden.value, page.hidden) : page.hidden || {};
    reasons.value = page.reasons || {}; next.value = page.next || ''; mayAdd.value = !!page.may?.add; gatedEnabled.value = !!page.gated_enabled;
    searched.value = true; said.value = resultsSaid(results.value.length, !!next.value);
  } catch (e) { if (mine === asked) { error.value = e.message; said.value = e.message; } }
  finally { if (mine === asked) { searching.value = false; more.value = false; } }
}
function sumHidden(a, b) { const out = { ...a }; for (const [k, n] of Object.entries(b || {})) out[k] = (out[k] || 0) + n; return out; }
const filters = { kind, use };
function choose(name, value) { const which = filters[name]; if (which.value === value) return; which.value = value; search(); }
search();

// ── the workspace's added models ─────────────────────────────────────────────────────────────────
const added = ref(null); const listError = ref('');
let timer = null; let alive = true;
async function loadAdded() {
  try { const body = await openModelsApi.list(); added.value = body.models; mayAdd.value = mayAdd.value || !!body.may?.add; listError.value = ''; }
  catch (e) { listError.value = e.message; added.value = added.value || []; }
  clearTimeout(timer);
  if (alive && anyFetching(added.value)) timer = setTimeout(loadAdded, POLL_MS);
}
loadAdded();
onUnmounted(() => { alive = false; clearTimeout(timer); });

const adding = ref(''); const cardError = ref({});
async function add(row) {
  adding.value = row.repo; cardError.value = { ...cardError.value, [row.repo]: '' };
  try {
    const body = await openModelsApi.add(row.repo);
    row.added = { id: body.model.id, state: body.model.state, state_label: body.model.state_label };
    said.value = `${row.name} was added. ${body.model.state === 'fetching' ? 'Its files are being fetched.' : stateBadge(body.model.state)[1]}.`;
    await loadAdded();
  } catch (e) { cardError.value = { ...cardError.value, [row.repo]: e.message }; said.value = e.message; }
  finally { adding.value = ''; }
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
</script>

<template>
  <div class="om-page">
    <p class="om-intro">Find open models on Hugging Face that AADML can train or deploy. Only models whose licence allows commercial use, with safetensors weights and no code of their own, are shown.</p>

    <form class="om-toolbar" role="search" @submit.prevent="search()">
      <label class="om-search">
        <span class="sr-only">Search Hugging Face models</span>
        <Search :size="16" aria-hidden="true"/>
        <input v-model="words" type="search" :maxlength="QUERY_LIMIT + 20" :placeholder="kind==='photo' ? 'Search photo models, e.g. segformer' : 'Search chat models, e.g. qwen or llama'" :aria-invalid="!!problem" aria-describedby="om-query-help">
      </label>
      <div class="om-segmented" role="radiogroup" aria-label="Kind of model">
        <button v-for="k in KINDS" :key="k.value" type="button" role="radio" :aria-checked="kind===k.value" :class="{on: kind===k.value}" @click="choose('kind', k.value)">
          <MessageSquareText v-if="k.value==='chat'" :size="15" aria-hidden="true"/><ImageIcon v-else :size="15" aria-hidden="true"/>{{ k.label }}</button>
      </div>
      <div class="om-segmented" role="radiogroup" aria-label="What it is for">
        <button v-for="u in USES" :key="u.value" type="button" role="radio" :aria-checked="use===u.value" :class="{on: use===u.value}" @click="choose('use', u.value)">{{ u.label }}</button>
      </div>
      <UiButton type="submit" variant="primary" :disabled="searching"><span v-if="searching" class="om-spinner" aria-hidden="true"></span><Search v-else :size="15" aria-hidden="true"/>{{ searching ? 'Searching…' : 'Search' }}</UiButton>
    </form>
    <p id="om-query-help" class="om-help">{{ problem || 'Most downloaded first. Add a model to train from it in this workspace\'s projects, or to deploy it as is.' }}</p>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <p class="sr-only" aria-live="polite">{{ said }}</p>

    <section class="om-section" aria-labelledby="om-added">
      <h2 id="om-added">Added to this workspace <span class="count">{{ added ? added.length : '' }}</span></h2>
      <p v-if="listError" class="field-error" role="alert">{{ listError }}</p>
      <p v-if="!added" class="muted">Loading…</p>
      <p v-else-if="!added.length" class="muted">None yet. Add a model below and it is offered in the Train tab of this workspace's projects once its files are fetched.</p>
      <ul v-else class="om-added">
        <li v-for="m in added" :key="m.id">
          <div class="om-added-name"><strong>{{ m.name }}</strong><small>{{ m.publisher }}, {{ m.kind === 'chat' ? 'chat' : 'photo' }}, {{ m.size }}, {{ bytesText(m.bytes) }}, commit {{ (m.revision || "").slice(0, 12) }}</small></div>
          <div class="om-added-licence"><Scale :size="14" aria-hidden="true"/>{{ m.licence_name }}</div>
          <UiBadge :tone="stateBadge(m.state)[0]">{{ stateBadge(m.state)[1] }}</UiBadge>
          <p v-if="m.failure" class="om-failure">{{ m.failure }}</p>
          <p v-if="addedFor(m)" class="om-note">{{ addedFor(m) }}</p>
          <p v-if="m.state==='ready' && m.kind==='photo' && (m.uses || []).includes('train')" class="om-note">Training from an added photo model opens when the photo trainer takes one.</p>
          <div class="om-added-actions">
            <a class="button" :href="hubLink(m.repo)" target="_blank" rel="noopener noreferrer" :aria-label="`${m.name} on Hugging Face (opens a new tab)`"><ExternalLink :size="14" aria-hidden="true"/></a>
            <UiButton v-if="mayAdd" :disabled="m.state==='fetching'" :title="m.state==='fetching' ? 'It can be removed once its fetch has ended.' : ''" @click="askRemove(m)"><Trash2 :size="14" aria-hidden="true"/>Remove</UiButton>
          </div>
        </li>
      </ul>
    </section>

    <section class="om-section" aria-labelledby="om-results" :aria-busy="searching">
      <h2 id="om-results">On Hugging Face <span v-if="searched" class="count">{{ results.length }}</span></h2>
      <p v-if="leftOut" class="om-left-out">{{ leftOut }}</p>
      <p v-if="searching && !results.length" class="muted">Searching Hugging Face…</p>
      <div v-else-if="searched && !results.length && !error" class="om-empty">
        <Box :size="28" aria-hidden="true"/>
        <p>No model on this page can be {{ use === 'train' ? 'trained' : 'deployed' }} here. Try other words, or switch between Photo and Chat.</p>
      </div>
      <div class="om-grid">
        <article v-for="row in results" :key="row.repo" class="panel om-card">
          <div class="om-card-head"><UiBadge>{{ row.kind === 'chat' ? 'Chat' : 'Photo' }}</UiBadge><UiBadge v-if="row.task">{{ row.task }}</UiBadge><UiBadge v-if="row.added" :tone="stateBadge(row.added.state)[0]">{{ stateBadge(row.added.state)[1] }}</UiBadge></div>
          <h3>{{ row.name }}</h3>
          <p class="om-publisher">{{ row.publisher }}</p>
          <dl class="om-facts">
            <div><dt>Size</dt><dd>{{ row.size }}</dd></div>
            <div><dt><Download :size="12" aria-hidden="true"/>Downloads</dt><dd>{{ shortCount(row.downloads) }}</dd></div>
            <div><dt><Heart :size="12" aria-hidden="true"/>Likes</dt><dd>{{ shortCount(row.likes) }}</dd></div>
            <div v-if="day(row.updated)"><dt>Updated</dt><dd>{{ day(row.updated) }}</dd></div>
          </dl>
          <div class="om-licence">
            <p><Scale :size="14" aria-hidden="true"/><strong>{{ row.licence_name }}</strong></p>
            <p class="om-licence-use">{{ row.licence_terms || row.licence_use }}</p>
          </div>
          <p v-if="row.gated" class="om-gated"><Lock :size="14" aria-hidden="true"/>{{ row.gated_note || 'Its publisher asks for its terms to be accepted before a download.' }}</p>
          <p class="om-uses">{{ usesText(row.uses) }}</p>
          <div class="om-card-actions">
            <UiButton v-if="!row.added" variant="primary" :disabled="!!cannotAdd(row) || adding===row.repo" :title="cannotAdd(row)" :aria-describedby="cannotAdd(row) ? `why-${row.repo}` : undefined" @click="add(row)">
              <span v-if="adding===row.repo" class="om-spinner on-primary" aria-hidden="true"></span><Plus v-else :size="15" aria-hidden="true"/>{{ adding===row.repo ? 'Adding…' : 'Add to workspace' }}</UiButton>
            <span v-else class="om-added-mark"><Check :size="15" aria-hidden="true"/>Added</span>
            <a class="button" :href="hubLink(row.repo)" target="_blank" rel="noopener noreferrer" :aria-label="`${row.name} on Hugging Face (opens a new tab)`"><ExternalLink :size="14" aria-hidden="true"/>Hugging Face</a>
          </div>
          <p v-if="cannotAdd(row) && !row.added" :id="`why-${row.repo}`" class="sr-only">{{ cannotAdd(row) }}</p>
          <p v-if="cardError[row.repo]" class="field-error" role="alert">{{ cardError[row.repo] }}</p>
        </article>
      </div>
      <div v-if="next" class="om-more"><UiButton :disabled="more" @click="search({ again: true })"><span v-if="more" class="om-spinner" aria-hidden="true"></span>{{ more ? 'Loading…' : 'Show more results' }}</UiButton></div>
    </section>

    <UiDialog :open="!!removing" :title="removing ? `Remove ${removing.name}?` : ''" @close="removing=null">
      <template v-if="removing">
        <p class="dialog-description">It is no longer offered in this workspace's Train tabs, and its fetched files are deleted. A model already trained from it keeps it: then it cannot be removed.</p>
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
.om-search{display:flex;align-items:center;gap:9px;flex:1 1 280px;min-width:0;max-width:440px;min-height:44px;padding:0 12px;border:1px solid #dfe1e9;border-radius:9px;background:#fff;color:#6b778c}
.om-search:focus-within{outline:3px solid var(--aadml-outline);outline-offset:2px;border-color:var(--aadml-focus)}
.om-search input{flex:1;min-width:0;border:0;outline:none;background:transparent;font-size:14px;color:#152237;padding:10px 0}
.om-segmented{display:inline-flex;padding:3px;border-radius:9px;background:#f1f3f7;gap:2px}
.om-segmented button{display:inline-flex;align-items:center;gap:6px;min-height:38px;padding:7px 14px;border:0;border-radius:7px;background:transparent;color:#4d5a70;font-size:13px;font-weight:550;transition:background-color .15s,color .15s}
.om-segmented button.on{background:#fff;color:var(--aadml-primary);box-shadow:0 1px 3px #1d2a4224}
.om-segmented button:hover:not(.on){color:#1d2a42}
.om-help{margin:8px 0 0;font-size:12px;color:#5f6d82}
.om-section{margin-top:28px}
.om-section > h2{display:flex;align-items:center;gap:10px;font-size:16px;margin:0 0 12px}
.om-left-out{margin:0 0 14px;font-size:12px;color:#5f6d82;max-width:90ch}
.om-added{list-style:none;margin:0;padding:0;border:1px solid #e3e6ed;border-radius:12px;background:#fff}
.om-added li{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;align-items:center;gap:8px 16px;padding:12px 16px;border-bottom:1px solid #eef0f4}
.om-added li:last-child{border-bottom:0}
.om-added-name{min-width:0}
.om-added-name strong{display:block;font-size:14px;overflow-wrap:anywhere}
.om-added-name small{display:block;font-size:12px;color:#5f6d82;margin-top:2px}
.om-added-licence{display:flex;align-items:center;gap:6px;font-size:12px;color:#33415a}
.om-added-actions{display:flex;gap:6px}
.om-added-actions .button{min-height:36px;padding:6px 10px}
.om-failure,.om-note{grid-column:1 / -1;margin:0;font-size:12px}
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
.om-spinner{width:14px;height:14px;border-radius:50%;border:2px solid var(--aadml-soft);border-top-color:var(--aadml-primary);animation:om-spin 1s linear infinite;flex-shrink:0}
.om-spinner.on-primary{border-color:#ffffff55;border-top-color:#fff}
@keyframes om-spin{to{transform:rotate(360deg)}}
.badge--amber{color:#93610b;background:#fff4dc}
.muted{font-size:12px;color:#5f6d82}
.count{font-size:12px;font-weight:500;color:#5f6d82}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media (prefers-reduced-motion: reduce){.om-spinner{animation:none}.om-segmented button{transition:none}}
@media (max-width:640px){
  .om-toolbar{align-items:stretch}
  .om-search{flex-basis:100%;max-width:none}
  .om-segmented{display:flex;flex:1 1 100%}
  .om-segmented button{flex:1 1 0;justify-content:center;min-width:0;padding:7px 6px}
  .om-toolbar > .button{flex:1 1 100%;justify-content:center;min-height:44px}
  .om-added li{grid-template-columns:minmax(0,1fr) auto}
  .om-added-licence{grid-column:1 / -1}
  .om-added-actions{grid-column:1 / -1}
  .om-grid{grid-template-columns:minmax(0,1fr)}
}
</style>
