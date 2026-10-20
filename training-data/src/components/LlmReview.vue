<script setup>
// The annotate page's LLM form (plan §2.1): the review board (Unassigned → Reviewing → In review → Dataset) and the
// editor of one conversation, where its reviewer approves it, fixes the answer, or rejects it, with comments. Flagged
// examples come first. A reviewer sees the reviews given to them. Backend: llm/app_api.py, llm/review.py.
import { computed, onMounted, ref, watch } from 'vue';
import { ArrowLeft, Check, X, Pencil, Send, RefreshCw, MessageSquare } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import UiDialog from './UiDialog.vue';
import LlmConversation from './LlmConversation.vue';
import { llmApi, REVIEW_COLUMNS, reviewColumn, fixableOf, withFixes, findingText, KIND_LABEL } from '../api/llm.js';
import { ago } from '../api/training.js';
import './llm.css';

const props = defineProps({ project: Object, openAssignment: Number });
const emit = defineEmits(['navigate', 'opened']);
const rights = computed(() => props.project?.rights || []);
const board = ref(null); const batch = ref(null); const itemIndex = ref(-1); const error = ref(''); const told = ref('');
const busy = ref(false); const creating = ref(false); const reviewer = ref(''); const reviewName = ref('');
const fixing = ref(false); const fixes = ref({}); const commentText = ref(''); const backDialog = ref(false); const backReason = ref('');

async function loadBoard() {
  error.value = '';
  try { board.value = await llmApi.reviews(props.project.ref); } catch (e) { error.value = e.message; }
}
async function openBatch(number) {
  error.value = ''; itemIndex.value = -1;
  try { batch.value = await llmApi.review(props.project.ref, number); } catch (e) { error.value = e.message; }
}
const columns = computed(() => Object.fromEntries(REVIEW_COLUMNS.map(c => [c, (board.value?.reviews || []).filter(b => reviewColumn(b) === c)])));
// Only the review's reviewer decides, while it is with them (the backend refuses anyone else too).
const isReviewer = computed(() => !!(batch.value && board.value && batch.value.state === 'sent' && board.value.me === batch.value.reviewer_id));
const item = computed(() => itemIndex.value >= 0 ? batch.value?.items[itemIndex.value] : null);

async function create() {
  if (!reviewer.value) { error.value = 'Choose who reviews.'; return; }
  busy.value = true; error.value = '';
  try { const made = await llmApi.createReview(props.project.ref, { reviewer: Number(reviewer.value), name: reviewName.value }); creating.value = false; told.value = `${made.name}: ${made.total} examples sent to ${made.reviewer}.`; await loadBoard(); }
  catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}
function openItem(i) { itemIndex.value = i; fixing.value = false; commentText.value = ''; fixes.value = fixableOf(batch.value.items[i].current); }
async function decide(decision) {
  busy.value = true; error.value = '';
  try {
    const body = { decision };
    if (decision === 'fixed') body.content = withFixes(item.value.current, fixes.value);
    batch.value = await llmApi.decide(props.project.ref, batch.value.number, item.value.id, body);
    fixing.value = false;
    const next = batch.value.items.findIndex((it, i) => i > itemIndex.value && it.decision === 'waiting');
    if (next >= 0) openItem(next); else itemIndex.value = -1;
  } catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}
async function sendComment() {
  if (!commentText.value.trim()) return;
  busy.value = true; error.value = '';
  try { batch.value = await llmApi.comment(props.project.ref, batch.value.number, { text: commentText.value.trim(), item: item.value?.id }); commentText.value = ''; }
  catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}
async function move(name, body) {
  busy.value = true; error.value = '';
  try { batch.value = await llmApi.move(props.project.ref, batch.value.number, name, body); backDialog.value = false; told.value = { return: 'The review is returned for approval.', accept: 'The review is accepted: its decisions stand.', 'send-back': 'The review is sent back to its reviewer.' }[name]; await loadBoard(); }
  catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}
function close() { batch.value = null; itemIndex.value = -1; loadBoard(); }
const itemComments = computed(() => (batch.value?.events || []).filter(e => e.kind === 'comment' && (!item.value || e.item === item.value.position)));

onMounted(async () => { await loadBoard(); if (props.openAssignment) { emit('opened'); await openBatch(props.openAssignment); } });
watch(() => props.openAssignment, async n => { if (n) { emit('opened'); await openBatch(n); } });
</script>

<template>
  <div class="studio llm-review">
    <div v-if="told" class="notice" role="status"><Check :size="17" /><span>{{ told }}</span><button class="icon-button" aria-label="Dismiss" @click="told=''"><X :size="16" /></button></div>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>

    <template v-if="!batch">
      <div class="studio-actions"><p>Each example a preparation run flagged, and a sample of the others, is read by a person: approved, fixed or rejected.</p>
        <div><UiButton @click="loadBoard"><RefreshCw :size="15" /> Refresh</UiButton> <UiButton v-if="rights.includes('batch')" variant="primary" @click="creating=true">New review</UiButton></div></div>
      <div class="annotation-board">
        <section v-for="column in REVIEW_COLUMNS" :key="column">
          <h3>{{ column }} <UiBadge>{{ column==='Unassigned' ? (board?.waiting ? board.waiting.flagged + board.waiting.others : 0) : columns[column].length }}</UiBadge></h3>
          <template v-if="column==='Unassigned'">
            <article v-if="board?.waiting" class="batch-card"><strong>Run {{ board.waiting.run }}</strong><p>{{ board.waiting.flagged }} flagged, {{ board.waiting.others }} others not reviewed yet. A new review takes every flagged one and a tenth of the others.</p></article>
            <p v-else class="field-help">{{ board ? 'Run preparation first, on the Dataset page.' : 'Loading…' }}</p>
          </template>
          <button v-for="b in columns[column]" :key="b.number" class="batch-card llm-card" @click="openBatch(b.number)">
            <strong>{{ b.name }}</strong><p>{{ b.total }} examples · {{ b.counts.waiting }} to decide</p>
            <footer>{{ b.reviewer || 'Nobody' }} · {{ ago(b.created_at) }}</footer></button>
        </section>
      </div>
    </template>

    <template v-else-if="!item">
      <div class="studio-actions"><UiButton @click="close"><ArrowLeft :size="16" /> Back to the board</UiButton>
        <div class="dialog-actions">
          <UiButton v-if="isReviewer" variant="primary" :disabled="busy || batch.counts.waiting > 0" @click="move('return')"><Send :size="15" /> Return for approval</UiButton>
          <template v-if="batch.state==='returned' && rights.includes('batch')"><UiButton :disabled="busy" @click="backDialog=true">Send back</UiButton><UiButton variant="primary" :disabled="busy" @click="move('accept')"><Check :size="15" /> Accept</UiButton></template>
        </div></div>
      <section class="panel">
        <h2>{{ batch.name }} <UiBadge>{{ batch.state_label }}</UiBadge></h2>
        <p>Reviewer: {{ batch.reviewer }} · from preparation run {{ batch.run }} · {{ batch.total }} examples: {{ batch.counts.approved + batch.counts.fixed }} approved, {{ batch.counts.rejected }} rejected, {{ batch.counts.waiting }} to decide.</p>
        <p v-if="batch.instructions" class="field-help">{{ batch.instructions }}</p>
        <table class="llm-table"><thead><tr><th>#</th><th>Why</th><th>Kind</th><th>Found</th><th>Decision</th></tr></thead><tbody>
          <tr v-for="(it, i) in batch.items" :key="it.id" class="llm-row" tabindex="0" @click="openItem(i)" @keydown.enter="openItem(i)"><td>{{ it.position }}</td><td><UiBadge :tone="it.why==='flagged' ? 'purple' : 'neutral'">{{ it.why==='flagged' ? 'Flagged' : 'Sample' }}</UiBadge></td><td>{{ KIND_LABEL[it.kind] }}</td>
            <td>{{ it.findings.map(f => findingText(f.code)).join(' · ') || '—' }}</td><td>{{ it.decision_label }}</td></tr>
        </tbody></table>
        <h3>Timeline</h3>
        <ol class="llm-timeline"><li v-for="(e, i) in batch.events" :key="i"><strong>{{ e.by || 'AADML' }}</strong> {{ e.kind==='comment' ? `commented${e.item ? ` on example ${e.item}` : ''}:` : '' }} {{ e.detail }} <span class="field-help">{{ ago(e.at) }}</span></li></ol>
      </section>
    </template>

    <template v-else>
      <div class="studio-actions"><UiButton @click="itemIndex=-1"><ArrowLeft :size="16" /> {{ batch.name }}</UiButton><span>Example {{ item.position }} of {{ batch.total }} · {{ item.decision_label }}</span></div>
      <div class="llm-editor">
        <section class="panel">
          <h2>{{ KIND_LABEL[item.kind] }}</h2>
          <p v-if="item.findings.length" class="field-help">Preparation found: {{ item.findings.map(f => findingText(f.code)).join(' · ') }}</p>
          <LlmConversation v-if="!fixing" :content="item.current" />
          <template v-else>
            <p class="field-help">Correct the answer. The example as it was is kept as an earlier revision.</p>
            <label v-for="(text, field) in fixes" :key="field" class="field-label">{{ {answer:'Answer',chosen:'Better answer',rejected:'Worse answer',text:'Text'}[field] }}<textarea v-model="fixes[field]" class="text-input" rows="6"></textarea></label>
          </template>
          <div v-if="isReviewer" class="dialog-actions">
            <template v-if="!fixing"><UiButton :disabled="busy" @click="decide('rejected')"><X :size="15" /> Reject</UiButton><UiButton :disabled="busy" @click="fixing=true"><Pencil :size="15" /> Fix the answer</UiButton><UiButton variant="primary" :disabled="busy" @click="decide('approved')"><Check :size="15" /> Approve</UiButton></template>
            <template v-else><UiButton @click="fixing=false;fixes=fixableOf(item.current)">Cancel</UiButton><UiButton variant="primary" :disabled="busy" @click="decide('fixed')"><Check :size="15" /> Save the fix and approve</UiButton></template>
          </div>
        </section>
        <aside class="panel">
          <h3><MessageSquare :size="15" /> Comments</h3>
          <ol class="llm-timeline"><li v-for="(c, i) in itemComments" :key="i"><strong>{{ c.by }}</strong> {{ c.detail }} <span class="field-help">{{ ago(c.at) }}</span></li></ol>
          <p v-if="!itemComments.length" class="field-help">No comment on this example.</p>
          <label class="field-label">Comment<textarea v-model="commentText" class="text-input" rows="3" maxlength="4000"></textarea></label>
          <UiButton :disabled="busy || !commentText.trim()" @click="sendComment">Comment</UiButton>
        </aside>
      </div>
    </template>

    <UiDialog :open="creating" title="New review" @close="creating=false">
      <p class="dialog-description">Every example the newest preparation run flagged, and a tenth of the others, goes to one person who may mark examples.</p>
      <label class="field-label">Reviewer<select v-model="reviewer" class="text-input"><option value="">Choose…</option><option v-for="r in board?.reviewers || []" :key="r.id" :value="r.id">{{ r.name }}</option></select></label>
      <label class="field-label">Name (optional)<input v-model="reviewName" class="text-input" maxlength="100"></label>
      <div class="dialog-actions"><UiButton @click="creating=false">Cancel</UiButton><UiButton variant="primary" :disabled="busy" @click="create">Send for review</UiButton></div>
    </UiDialog>
    <UiDialog :open="backDialog" title="Send back to the reviewer" @close="backDialog=false">
      <p class="dialog-description">Every example of this review goes back to {{ batch?.reviewer }} to decide again. A fix that was made is kept in the example's history.</p>
      <label class="field-label">Reason<textarea v-model="backReason" class="text-input" rows="3"></textarea></label>
      <div class="dialog-actions"><UiButton @click="backDialog=false">Cancel</UiButton><UiButton variant="primary" :disabled="busy || !backReason.trim()" @click="move('send-back', {reason: backReason.trim()})">Send back</UiButton></div>
    </UiDialog>
  </div>
</template>

<style scoped>
.llm-review{display:grid;gap:16px}
.llm-card{text-align:left;cursor:pointer;width:100%;font:inherit}
.llm-timeline{list-style:none;padding:0;margin:8px 0;display:grid;gap:6px;font-size:13px}
.llm-editor{display:grid;grid-template-columns:minmax(0,2fr) minmax(240px,1fr);gap:16px;align-items:start}
@media (max-width:900px){.llm-editor{grid-template-columns:1fr}}
</style>
