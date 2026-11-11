<script setup>
// The Records page (ADM-1210 §3.3, §3.5): the records the project's apps sent (or a file brought), for every kind of
// project, and the only page of a data-only project. Filters, a table of records read a page at a time ("Show more"),
// one record opened in a side panel (payload and annotations as read-only JSON, decision D2; its file; its training
// photo or its examples; who it is assigned to), deleting one or several on request with a reason (decision D1), and
// the JSON export. Backend: training_models_data/records_api.py — every right is checked there, and a person sees only
// the records their role reaches.
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { Database, Download, FileText, Search, Trash2, X, RefreshCw, Check } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import UiDialog from './UiDialog.vue';
import { RECORD_FILTERS, MOST_AT_ONCE, recordsApi, exportUrl, searchRefusal, filtered, payloadPreview, pretty, sizeText, deletedWords, refusalRows, tooMany, toggled } from '../api/records.js';
import { KIND_LABEL, STATE_LABEL, SPLIT_LABEL } from '../api/llm.js';

const props = defineProps({ project: { type: Object, required: true } });
const emit = defineEmits(['navigate']);
const rights = computed(() => props.project?.rights || []);
const when = iso => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');
const SOURCE = { api: 'Sent by an app', partner_alias: 'Sent by a partner app', import: 'From a file' };
const sourceText = s => SOURCE[s] || s || '';

// ── the list: only the newest request fills the page ──
const filters = reactive({ ...RECORD_FILTERS });
const rows = ref([]); const total = ref(0); const matching = ref(0); const next = ref(null);
const loading = ref(false); const error = ref(''); const loaded = ref(false);
// What this person may do; the first answer says it, the project's rights until then.
const may = ref({ delete: rights.value.includes('upload'), export: rights.value.includes('overview'), assigned_filter: rights.value.includes('batch') });
const searchError = computed(() => searchRefusal(filters.q));
let asked = 0;
async function load(more = false) {
  if (searchError.value) return;
  const mine = ++asked;
  loading.value = true; error.value = '';
  try {
    const body = await recordsApi.list(props.project.ref, filters, { cursor: more ? next.value : '', assigned: may.value.assigned_filter });
    if (mine !== asked) return;
    rows.value = more ? [...rows.value, ...body.records] : body.records;
    total.value = body.total; matching.value = body.matching; next.value = body.next; may.value = body.may || may.value; loaded.value = true;
    if (!more) picked.value = picked.value.filter(id => rows.value.some(r => r.id === id));
  } catch (e) { if (mine === asked) error.value = e.message; }
  finally { if (mine === asked) loading.value = false; }
}
let timer = null;
watch(filters, () => { clearTimeout(timer); timer = setTimeout(() => load(), 300); });
onMounted(() => load());
onUnmounted(() => clearTimeout(timer));
function clearFilters() { Object.assign(filters, RECORD_FILTERS); }
const anyFilter = computed(() => filtered(filters, may.value.assigned_filter));
const shownRows = computed(() => rows.value.map(r => ({ ...r, preview: payloadPreview(r.payload) })));

// ── selection: the Dataset tab's bar ──
const picked = ref([]);
const pickedTooMany = computed(() => tooMany(picked.value.length, 'records'));
const allShown = computed(() => rows.value.length > 0 && rows.value.every(r => picked.value.includes(r.id)));
function selectAll() { picked.value = [...new Set([...picked.value, ...rows.value.map(r => r.id)])]; }
function pick(id) { picked.value = toggled(picked.value, id); }

// ── one record in the side panel ──
const opened = ref(null); const openLoading = ref(false); const openError = ref(''); const panelTitle = ref(null);
let opener = null; let openAsked = 0;
async function open(row, event) {
  opener = event?.currentTarget || null;
  const mine = ++openAsked;
  openLoading.value = true; openError.value = ''; opened.value = { id: row.id, summary: row };
  await nextTick(); panelTitle.value?.focus();
  try { const body = await recordsApi.get(props.project.ref, row.id); if (mine === openAsked) opened.value = body; }
  catch (e) { if (mine === openAsked) openError.value = e.message; }
  finally { if (mine === openAsked) openLoading.value = false; }
}
function closePanel() { openAsked++; opened.value = null; openError.value = ''; openLoading.value = false; nextTick(() => opener?.focus?.()); }
const detail = computed(() => (opened.value && 'payload' in opened.value ? opened.value : null));
const mismatch = computed(() => { const m = detail.value?.group_mismatch; return m == null || m === '' ? '' : typeof m === 'string' ? m : pretty(m); });

// ── deleting on request: always through the dialog, with a reason ──
const targets = ref([]); const reason = ref(''); const deleting = ref(false); const deleteError = ref('');
const told = ref(''); const failed = ref([]);
function askDelete(ids) {
  const refusal = tooMany(ids.length, 'records');
  if (refusal) { error.value = refusal; return; }
  targets.value = [...ids]; reason.value = ''; deleteError.value = '';
}
const nameOf = id => { const r = rows.value.find(x => x.id === id); return r ? `The record received ${when(r.received_at)}` : `Record ${id}`; };
async function confirmDelete() {
  if (!reason.value.trim()) { deleteError.value = 'Give the reason for the deletion (for example: the customer asked for it).'; return; }
  deleting.value = true; deleteError.value = '';
  try {
    const answer = await recordsApi.remove(props.project.ref, targets.value, reason.value.trim());
    failed.value = refusalRows(answer.failed, 'record', nameOf);
    const notGone = new Set(failed.value.map(f => f.id));
    const gone = targets.value.filter(id => !notGone.has(id));
    rows.value = rows.value.filter(r => !gone.includes(r.id));
    picked.value = picked.value.filter(id => !gone.includes(id));
    total.value = Math.max(0, total.value - answer.deleted); matching.value = Math.max(0, matching.value - answer.deleted);
    if (opened.value && gone.includes(opened.value.id)) closePanel();
    told.value = deletedWords(answer);
    targets.value = [];
  } catch (e) { deleteError.value = e.message; }
  finally { deleting.value = false; }
}
const deleteTitle = computed(() => (targets.value.length === 1 ? 'Delete this record on request' : `Delete ${targets.value.length} records on request`));
</script>

<template>
  <div class="studio records-page">
    <div v-if="told" class="notice" role="status"><Check :size="17" aria-hidden="true"/><span>{{ told }}</span><button class="icon-button" aria-label="Dismiss notification" @click="told=''"><X :size="16"/></button></div>
    <div v-if="failed.length" class="records-failed" role="alert">
      <p><strong>{{ failed.length }} record{{ failed.length === 1 ? ' was' : 's were' }} not deleted.</strong></p>
      <ul><li v-for="f in failed" :key="f.id">{{ f.name }}: {{ f.why }}</li></ul>
      <button class="icon-button" aria-label="Dismiss the list" @click="failed=[]"><X :size="15"/></button>
    </div>

    <div class="studio-actions records-head">
      <p class="records-count" aria-live="polite">{{ loaded ? (anyFilter ? `${matching} of ${total} record${total === 1 ? '' : 's'} match` : `${total} record${total === 1 ? '' : 's'}`) : 'The data your apps sent to this project, record by record.' }}</p>
      <div class="records-head-actions">
        <UiButton :disabled="loading" @click="load()"><RefreshCw :size="15" aria-hidden="true"/> Refresh</UiButton>
        <a v-if="may.export" class="button button--secondary" :href="exportUrl(project.ref)" download><Download :size="15" aria-hidden="true"/> Export JSON</a>
      </div>
    </div>

    <form class="records-filters" role="search" aria-label="Filter records" @submit.prevent="load()">
      <label class="records-search"><span class="sr-only">Search the records</span><span class="search-field"><Search :size="16" aria-hidden="true"/><input v-model="filters.q" type="search" name="q" autocomplete="off" spellcheck="false" placeholder="Search payload, annotations or key…" :aria-invalid="!!searchError" aria-describedby="records-search-error"></span></label>
      <label class="records-filter">Annotated<select v-model="filters.annotated" class="compact-select" name="annotated"><option value="">Any</option><option value="yes">Yes</option><option value="no">No</option></select></label>
      <label class="records-filter">File<select v-model="filters.has_file" class="compact-select" name="has_file"><option value="">Any</option><option value="yes">Has a file</option><option value="no">No file</option></select></label>
      <label v-if="may.assigned_filter" class="records-filter">Assigned<select v-model="filters.assigned" class="compact-select" name="assigned"><option value="">Any</option><option value="yes">Assigned</option><option value="no">Not assigned</option></select></label>
      <label class="records-filter">From<input v-model="filters.from" class="compact-select" type="date" name="from" :max="filters.to || undefined"></label>
      <label class="records-filter">To<input v-model="filters.to" class="compact-select" type="date" name="to" :min="filters.from || undefined"></label>
      <UiButton v-if="anyFilter" @click="clearFilters">Clear filters</UiButton>
    </form>
    <p v-if="searchError" id="records-search-error" class="field-error" role="alert">{{ searchError }}</p>

    <div v-if="may.delete && rows.length" class="studio-actions records-selection" role="group" aria-label="Selected records">
      <span aria-live="polite">{{ picked.length }} selected</span>
      <UiButton :disabled="allShown" @click="selectAll">Select all shown</UiButton>
      <UiButton class="danger" :disabled="!picked.length || !!pickedTooMany" @click="askDelete(picked)"><Trash2 :size="14" aria-hidden="true"/> Delete selected</UiButton>
      <UiButton :disabled="!picked.length" @click="picked=[]">Clear selection</UiButton>
    </div>
    <p v-if="pickedTooMany" class="field-error" role="alert">{{ pickedTooMany }}</p>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>

    <div :class="['records-layout', { 'records-layout--open': opened }]">
      <section class="records-main" aria-label="Records">
        <p v-if="loading && !rows.length">Loading…</p>
        <div v-else-if="loaded && !rows.length && !error" class="model-empty">
          <Database :size="40" aria-hidden="true"/>
          <h2>{{ anyFilter ? 'No record matches these filters' : 'No records yet' }}</h2>
          <p>{{ anyFilter ? 'Change the filters or clear them to see every record.' : 'Records arrive when an app sends data to this project with its key, or when a file is uploaded.' }}</p>
          <div class="studio-actions centred"><UiButton v-if="anyFilter" @click="clearFilters">Clear filters</UiButton><UiButton v-else variant="primary" @click="emit('navigate','connect')">Connect an app</UiButton></div>
        </div>
        <div v-else-if="rows.length" class="records-wrap">
          <table class="ws-table records-table">
            <caption class="sr-only">Records, newest first</caption>
            <thead><tr>
              <th v-if="may.delete" scope="col" class="records-check"><span class="sr-only">Select</span></th>
              <th scope="col">Received</th><th scope="col">Payload</th><th scope="col">What it has</th><th scope="col"><span class="sr-only">Open</span></th>
            </tr></thead>
            <tbody>
              <tr v-for="r in shownRows" :key="r.id" :class="{ 'records-row--open': opened?.id === r.id }">
                <td v-if="may.delete" class="records-check"><input type="checkbox" :checked="picked.includes(r.id)" :aria-label="`Select the record received ${when(r.received_at)}`" @change="pick(r.id)"></td>
                <td data-label="Received"><time :datetime="r.received_at">{{ when(r.received_at) }}</time><small>{{ sourceText(r.source) }}</small></td>
                <td data-label="Payload"><code class="records-preview" :title="r.payload?.full || ''" translate="no">{{ r.preview || '(nothing)' }}</code></td>
                <td data-label="What it has"><div class="records-badges">
                  <UiBadge :tone="r.has_file ? 'purple' : 'neutral'">{{ r.has_file ? (r.file?.is_image ? 'Picture' : 'File') : 'No file' }}</UiBadge>
                  <UiBadge :tone="r.annotated ? 'green' : 'neutral'">{{ r.annotated ? 'Annotated' : 'Not annotated' }}</UiBadge>
                  <UiBadge v-if="r.assignees" :tone="r.assignees.length ? 'purple' : 'neutral'" :title="r.assignees.map(a => a.name).join(', ')">{{ r.assignees.length ? `Assigned to ${r.assignees.length === 1 ? r.assignees[0].name : `${r.assignees.length} people`}` : 'Not assigned' }}</UiBadge>
                </div></td>
                <td class="row-actions"><UiButton @click="open(r, $event)">Open<span class="sr-only"> the record received {{ when(r.received_at) }}</span></UiButton></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="next" class="records-more"><UiButton :disabled="loading" @click="load(true)">{{ loading ? 'Loading…' : 'Show more' }}</UiButton></div>
      </section>

      <aside v-if="opened" class="records-panel" aria-labelledby="record-panel-title" @keydown.esc="closePanel">
        <header class="records-panel-head">
          <h2 id="record-panel-title" ref="panelTitle" tabindex="-1">Record received {{ when(opened.received_at || opened.summary?.received_at) }}</h2>
          <button class="icon-button" aria-label="Close the record" @click="closePanel"><X :size="18"/></button>
        </header>
        <p v-if="openLoading">Loading…</p>
        <p v-if="openError" class="field-error" role="alert">{{ openError }}</p>
        <template v-if="detail">
          <dl class="records-facts">
            <dt>Source</dt><dd>{{ sourceText(detail.source) || '—' }}</dd>
            <dt>Record id</dt><dd><code translate="no">{{ detail.id }}</code></dd>
            <template v-if="detail.idempotency_key"><dt>Idempotency key</dt><dd><code translate="no">{{ detail.idempotency_key }}</code></dd></template>
            <dt>Annotated</dt><dd>{{ detail.annotated_at ? `${when(detail.annotated_at)}${detail.annotated_by ? ` by ${detail.annotated_by}` : ''}` : 'Not yet' }}</dd>
            <template v-if="detail.assignees"><dt>Assigned to</dt><dd>{{ detail.assignees.length ? detail.assignees.map(a => a.name).join(', ') : 'Nobody' }}</dd></template>
          </dl>
          <p v-if="mismatch" class="records-note" role="note"><strong>The group this record names does not match its photo's.</strong> <span>{{ mismatch }}</span></p>

          <h3>File</h3>
          <p v-if="!detail.file" class="records-muted">This record came without a file.</p>
          <template v-else><div v-for="f in [detail.file, detail.marked_file].filter(Boolean)" :key="f.url" class="records-file">
            <img v-if="f.is_image" :src="f.url" :alt="f === detail.marked_file ? 'The picture with the sender\'s own marks' : 'The record\'s picture'" :width="f.width || undefined" :height="f.height || undefined" loading="lazy">
            <div><strong translate="no">{{ f.name }}</strong><small>{{ [f === detail.marked_file ? 'With the sender’s marks' : '', f.content_type, sizeText(f.size_bytes), f.width ? `${f.width} × ${f.height}` : ''].filter(Boolean).join(', ') }}</small>
              <div class="records-links"><a v-if="f.is_image" :href="f.url" target="_blank" rel="noopener"><FileText :size="14" aria-hidden="true"/> Open</a><a :href="f.download_url" download><Download :size="14" aria-hidden="true"/> Download</a></div></div>
          </div></template>

          <template v-if="detail.photo">
            <h3>Training photo</h3>
            <div class="records-file"><img :src="detail.photo.thumbnail || detail.photo.url" alt="The training photo made from this record" :width="detail.photo.width || undefined" :height="detail.photo.height || undefined" loading="lazy">
              <div><small>{{ detail.photo.group_id ? `${({ train: 'Training', val: 'Validation', test: 'Test' })[detail.photo.split] || 'Unassigned'}, group ${detail.photo.group_id}` : 'In the unassigned pool' }}{{ detail.photo.golden ? ', golden' : '' }}</small>
                <div class="records-links"><a :href="detail.photo.url" target="_blank" rel="noopener"><FileText :size="14" aria-hidden="true"/> Open the photo</a></div></div></div>
          </template>
          <template v-if="detail.examples?.length">
            <h3>Examples made from it <UiBadge>{{ detail.examples.length }}</UiBadge></h3>
            <ul class="records-examples"><li v-for="x in detail.examples" :key="x.id"><strong>Example {{ x.id }}</strong> <UiBadge :tone="x.state === 'approved' ? 'green' : x.state === 'flagged' ? 'purple' : 'neutral'">{{ STATE_LABEL[x.state] || x.state }}</UiBadge><small>{{ [KIND_LABEL[x.kind] || x.kind, SPLIT_LABEL[x.split] || x.split].filter(Boolean).join(', ') }}</small><p>{{ x.preview || '(no text)' }}</p></li></ul>
          </template>

          <h3>Payload</h3>
          <pre class="code-block records-json" tabindex="0" aria-label="The payload, as JSON">{{ pretty(detail.payload) }}</pre>
          <h3>Annotations</h3>
          <pre class="code-block records-json" tabindex="0" aria-label="The annotations, as JSON">{{ pretty(detail.annotations) }}</pre>
          <p class="records-muted">Read only. An agent annotates a record with its tools.</p>

          <div v-if="detail.may?.delete" class="records-panel-actions"><UiButton class="danger" @click="askDelete([detail.id])"><Trash2 :size="14" aria-hidden="true"/> Delete this record</UiButton></div>
        </template>
      </aside>
    </div>

    <UiDialog :open="targets.length > 0" :title="deleteTitle" @close="targets=[]">
      <p class="dialog-description">{{ targets.length === 1 ? 'The record is deleted for good, with what was made from it:' : `The ${targets.length} records are deleted for good, each with what was made from it:` }}</p>
      <ul class="records-goes">
        <li>its file, unless another record uses the same file;</li>
        <li>its training photo, which is never taken in again when the same picture is sent;</li>
        <li>its examples, which are never made again.</li>
      </ul>
      <p class="dialog-description">Published dataset versions keep what they froze. This cannot be undone.</p>
      <label class="field-label">Reason<textarea v-model="reason" class="text-input" rows="3" maxlength="500" name="reason" placeholder="e.g. the customer asked for it" :aria-invalid="!!deleteError"></textarea></label>
      <p v-if="deleteError" class="field-error" role="alert">{{ deleteError }}</p>
      <div class="dialog-actions"><UiButton @click="targets=[]">Cancel</UiButton><UiButton variant="primary" class="danger-fill" :disabled="deleting || !reason.trim()" @click="confirmDelete">{{ deleting ? 'Deleting…' : targets.length === 1 ? 'Delete the record' : `Delete ${targets.length} records` }}</UiButton></div>
    </UiDialog>
  </div>
</template>

<style scoped>
.records-page{display:grid;gap:0}
.records-head{justify-content:space-between;margin-top:0}
.records-count{margin:0;font-size:13px;color:#43536c!important;font-variant-numeric:tabular-nums}
.records-head-actions{display:flex;gap:8px;flex-wrap:wrap}
.records-head-actions a.button{display:inline-flex;align-items:center;gap:6px;text-decoration:none}
.records-filters{display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px;margin:0 0 12px}
.records-search{flex:1 1 260px;min-width:0}
.records-search .search-field{max-width:none;min-height:42px}
.records-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;font-size:13px;color:#24344c;min-height:40px}
.records-search .search-field:focus-within{outline:2px solid var(--aadml-focus);outline-offset:1px}
.records-filter{display:flex;flex-direction:column;gap:4px;font-size:11px;font-weight:600;color:#5f6d82}
.records-filter .compact-select{min-height:42px;min-width:118px;max-width:200px;border:1px solid #dbe2ec;border-radius:8px;background:#fff;color:#24344c;font-size:12px;padding:0 10px}
.records-filter .compact-select:focus-visible{outline:2px solid var(--aadml-focus);outline-offset:1px}
.records-selection{margin:4px 0 12px;font-size:12px}
.records-selection>span{font-variant-numeric:tabular-nums;color:#24344c}
.danger{color:#b42318;border-color:#fda29b}
.danger-fill{background:#d92d20;border-color:#d92d20}
.records-failed{position:relative;padding:12px 44px 12px 16px;margin-bottom:16px;border:1px solid #fecdca;background:#fef3f2;border-radius:8px;font-size:12px;color:#7a271a}
.records-failed p{margin:0;color:#7a271a!important}
.records-failed ul{margin:6px 0 0;padding-left:18px}
.records-failed .icon-button{position:absolute;top:8px;right:8px}
.records-layout{display:grid;grid-template-columns:minmax(0,1fr);gap:16px;align-items:start}
.records-layout--open{grid-template-columns:minmax(0,1fr) minmax(320px,420px)}
.records-main{min-width:0}
.records-wrap{max-width:100%;overflow:auto;border:1px solid #e3e8ef;border-radius:10px;background:#fff}
.records-table{width:100%;border-collapse:collapse;background:#fff}
.records-table thead th{padding:11px 14px;background:#f7f9fc;border-bottom:1px solid #e5eaf1;color:#5f6d82;font-size:11px;font-weight:600;text-align:left;white-space:nowrap}
.records-table td{padding:12px 14px;border-bottom:1px solid #edf0f5;vertical-align:top;font-size:12px;color:#43536c;overflow-wrap:anywhere}
.records-table tbody tr:last-child td{border-bottom:0}
.records-table tbody tr:hover{background:#fafcff}
.records-table tr.records-row--open{background:var(--aadml-tint)}
.records-table td small{display:block;color:#5f6d82;font-size:11px;margin-top:4px}
.records-table time{white-space:nowrap;font-variant-numeric:tabular-nums;color:#24344c}
.records-check{width:1%}
.records-check input{width:18px;height:18px;margin:2px 0 0;accent-color:var(--aadml-focus);cursor:pointer}
.records-preview{display:block;max-width:56ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;color:#24344c;background:none}
.records-badges{display:flex;flex-wrap:wrap;gap:4px}
.row-actions{width:1%;white-space:nowrap}
.records-more{display:flex;justify-content:center;margin:16px 0 0}
.records-panel{position:sticky;top:16px;max-height:calc(100vh - 32px);overflow:auto;overscroll-behavior:contain;background:#fff;border:1px solid #e3e8ef;border-radius:10px;padding:18px 20px}
.records-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.records-panel-head h2{margin:0;font-size:15px;line-height:1.4}
.records-panel-head h2:focus-visible{outline:2px solid var(--aadml-focus);outline-offset:2px;border-radius:3px}
.records-panel h3{display:flex;align-items:center;gap:6px;font-size:13px;margin:20px 0 8px}
.records-facts{display:grid;grid-template-columns:auto minmax(0,1fr);gap:6px 12px;font-size:12px;margin:14px 0 0}
.records-facts dt{color:#5f6d82}.records-facts dd{margin:0;color:#24344c;overflow-wrap:anywhere}
.records-facts code{font-size:11px}
.records-note{margin:12px 0 0;padding:10px 12px;border-radius:8px;background:#fffbeb;border:1px solid #fde68a;font-size:12px;color:#7a4b06!important;white-space:pre-wrap}
.records-muted{font-size:12px!important;color:#5f6d82!important;margin:0}
.records-file{display:flex;gap:12px;align-items:flex-start;margin-bottom:10px}
.records-file img{flex:none;width:96px;height:72px;object-fit:cover;border-radius:6px;background:var(--aadml-soft)}
.records-file>div{min-width:0}
.records-file strong{display:block;font-size:12px;color:#24344c;overflow-wrap:anywhere}
.records-file small{display:block;font-size:11px;color:#5f6d82;margin-top:3px}
.records-links{display:flex;gap:14px;margin-top:6px;font-size:12px}
.records-links a{display:inline-flex;align-items:center;gap:4px;color:var(--aadml-primary);font-weight:550;min-height:28px}
.records-links a:focus-visible{outline:2px solid var(--aadml-focus);outline-offset:2px;border-radius:3px}
.records-examples{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.records-examples li{padding:10px 12px;border:1px solid #e8edf5;border-radius:8px;font-size:12px}
.records-examples small{display:block;color:#5f6d82;margin-top:3px}
.records-examples p{margin:6px 0 0;font-size:12px;color:#43536c!important;overflow-wrap:anywhere}
.records-json{min-height:0;max-height:320px;overflow:auto;padding:14px;font-size:11.5px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere;margin:0}
.records-json:focus-visible{outline:2px solid var(--aadml-focus);outline-offset:2px}
.records-panel-actions{display:flex;justify-content:flex-end;margin-top:18px;padding-top:14px;border-top:1px solid #eef0f4}
.records-goes{margin:8px 0 0;padding-left:18px;font-size:12px;color:#43536c;line-height:1.6}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media(max-width:1100px){
  .records-layout--open{grid-template-columns:minmax(0,1fr)}
  .records-panel{position:fixed;z-index:40;top:0;right:0;bottom:0;width:min(440px,100%);max-height:none;border-radius:0;border-width:0 0 0 1px;box-shadow:-12px 0 40px #0f172a26;padding:18px 16px}
}
@media(max-width:650px){
  .records-filter{flex:1 1 calc(50% - 10px)}
  .records-filter .compact-select{max-width:none;width:100%;min-width:0}
  .records-table thead{display:none}
  .records-table,.records-table tbody,.records-table tr,.records-table td{display:block;width:100%}
  .records-table tr{position:relative;border-bottom:1px solid #e9eaf0;padding:8px 0}
  .records-table td{border:0!important;padding:5px 14px!important}
  .records-table td[data-label]::before{content:attr(data-label);display:block;font-size:11px;color:#5f6d82;margin-bottom:2px}
  .records-table td.records-check{position:absolute;top:8px;right:8px;width:auto;padding:4px!important}
  .records-preview{white-space:normal;max-width:none;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical}
  .row-actions{width:100%;white-space:normal}
  .row-actions .button{width:100%;min-height:44px}
}
@media(prefers-reduced-motion:no-preference){.records-table tbody tr{transition:background-color .15s}}
</style>
