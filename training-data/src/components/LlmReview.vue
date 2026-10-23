<script setup>
// The annotate page's LLM form (plan §2.1): the review board (Unassigned → Reviewing → In review → Dataset) and the
// editor of one conversation, where its reviewer approves it, fixes the answer, or rejects it, with comments. Flagged
// examples come first. A reviewer sees the reviews given to them. Backend: llm/app_api.py, llm/review.py.
import { computed, onMounted, ref, watch } from 'vue';
import { ArrowLeft, Check, X, Pencil, Send, RefreshCw, MessageSquare, History, CheckCheck, CornerUpLeft, Circle } from 'lucide-vue-next';
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
  told.value = '';   // a notification about another review does not stay over this one
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

// Event kinds come from the review API. Unknown kinds retain their original detail.
const eventStyles = {
  sent: { label: 'Sent for review', icon: Send, tone: 'blue' },
  approved: { label: 'Example approved', icon: Check, tone: 'green' },
  fixed: { label: 'Fixed and approved', icon: Pencil, tone: 'green' },
  rejected: { label: 'Example rejected', icon: X, tone: 'red' },
  comment: { label: 'Comment added', icon: MessageSquare, tone: 'violet' },
  returned: { label: 'Returned for approval', icon: CornerUpLeft, tone: 'blue' },
  accepted: { label: 'Review accepted', icon: CheckCheck, tone: 'green' },
  sent_back: { label: 'Sent back to reviewer', icon: CornerUpLeft, tone: 'amber' },
};
function eventStyle(kind) { return eventStyles[kind] || { label: 'Review updated', icon: Circle, tone: 'neutral' }; }
function fullTime(value) {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';
}


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
          <UiButton v-if="isReviewer" variant="primary" :disabled="busy || batch.counts.waiting > 0" @click="move('return')"><Send :size="15" /> Return for approval</UiButton><small v-if="isReviewer && batch.counts.waiting > 0" class="field-help">Decide every example first: {{ batch.counts.waiting }} still waiting.</small>
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
        <section class="review-activity" aria-labelledby="review-timeline-title">
          <header class="activity-heading">
            <div class="activity-heading-icon"><History :size="19" aria-hidden="true" /></div>
            <div><h3 id="review-timeline-title">Timeline <span class="activity-count">{{ batch.events?.length || 0 }}</span></h3><p>The activity and decisions behind this review.</p></div>
          </header>
          <ol v-if="batch.events?.length" class="llm-timeline">
            <li v-for="(e, i) in batch.events" :key="i" class="timeline-event" :class="`event-${eventStyle(e.kind).tone}`">
              <span class="event-marker" aria-hidden="true"><component :is="eventStyle(e.kind).icon" :size="15" :stroke-width="1.8" /></span>
              <div class="event-content">
                <div class="event-heading"><strong>{{ eventStyle(e.kind).label }}</strong><span v-if="e.item" class="event-example">Example {{ e.item }}</span><time v-if="fullTime(e.at)" :datetime="e.at" :title="fullTime(e.at)">{{ ago(e.at) }}</time></div>
                <div class="event-actor">{{ e.by || 'AADML' }}</div>
                <p v-if="e.detail" class="event-detail" :class="{ 'event-comment': e.kind === 'comment' }">{{ e.detail }}</p>
              </div>
            </li>
          </ol>
          <p v-else class="activity-empty">No activity recorded for this review yet.</p>
        </section>
      </section>
    </template>

    <template v-else>
      <div class="studio-actions"><UiButton @click="itemIndex=-1"><ArrowLeft :size="16" /> {{ batch.name }}</UiButton><span>Example {{ item.position }} of {{ batch.total }} · {{ item.decision_label }}</span></div>
      <div class="llm-editor">
        <section class="panel">
          <h2>{{ KIND_LABEL[item.kind] }}</h2>
          <p v-if="item.findings.length" class="field-help">Preparation found: {{ item.findings.map(f => findingText(f.code)).join(' · ') }}</p>
          <LlmConversation :content="item.current" />
          <template v-if="fixing">
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
          <ol class="llm-comments"><li v-for="(c, i) in itemComments" :key="i"><strong>{{ c.by }}</strong> {{ c.detail }} <span class="field-help">{{ ago(c.at) }}</span></li></ol>
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
.review-activity{margin-top:32px;padding-top:26px;border-top:1px solid #e9edf5}
.activity-heading{display:flex;align-items:center;gap:12px;margin-bottom:26px}
.activity-heading-icon{display:grid;place-items:center;width:40px;height:40px;flex-shrink:0;border:1px solid #e6ebf4;border-radius:12px;background:#f8faff;color:#6479a2}
.activity-heading h3{display:flex;align-items:center;gap:9px;margin:0;font-size:15px;font-weight:600;letter-spacing:-.2px;color:#24324b}
.activity-count{display:inline-grid;place-items:center;min-width:23px;height:21px;padding:0 6px;box-sizing:border-box;border:1px solid #e5eaf2;border-radius:6px;background:#f8fafc;font-size:11px;font-weight:500;color:#64748b}
.activity-heading p{margin:4px 0 0;font-size:12px;color:#64748b;line-height:1.5}
.llm-timeline{list-style:none;padding:0;margin:0;font-size:13px;max-width:1000px}
.timeline-event{--event-color:#64748b;--event-bg:#f1f5f9;position:relative;display:grid;grid-template-columns:32px minmax(0,1fr);column-gap:16px;padding-bottom:24px}
.timeline-event:not(:last-child)::before{content:'';position:absolute;left:15px;top:35px;bottom:3px;width:2px;background:#e8edf5;border-radius:2px}
.timeline-event:last-child{padding-bottom:0}
.event-blue{--event-color:#4264d8;--event-bg:#eef3ff}.event-green{--event-color:#20805d;--event-bg:#edf8f2}.event-red{--event-color:#c34c58;--event-bg:#fff0f2}.event-violet{--event-color:#8054c7;--event-bg:#f5f0ff}.event-amber{--event-color:#a36b19;--event-bg:#fff7e8}
.event-marker{position:relative;z-index:1;display:grid;place-items:center;box-sizing:border-box;width:32px;height:32px;border:1px solid #00000006;border-radius:50%;background:var(--event-bg);color:var(--event-color)}
.event-content{min-width:0;padding-top:5px}
.event-heading{display:flex;align-items:center;flex-wrap:wrap;gap:6px 10px;min-height:20px}
.event-heading>strong{font-size:13px;font-weight:600;color:#29374e;line-height:1.5}
.event-example{padding:2px 7px;border-radius:5px;background:#f4f6fa;font-size:10px;font-weight:500;color:#64748b}
.event-heading time{margin-left:auto;padding-left:16px;font-size:11px;color:#718096;font-weight:400;white-space:nowrap}
.event-actor{font-size:12px;color:#64748b;margin-top:3px;line-height:1.6;overflow-wrap:anywhere}
.event-detail{font-size:13px;line-height:1.65;color:#475569;margin:7px 0 0;overflow-wrap:anywhere;white-space:pre-wrap}
.event-detail.event-comment{padding:12px 16px;border:1px solid #e9e4f4;border-left:3px solid #c5b3e6;border-radius:0 9px 9px 0;background:#faf8fe;color:#514563}
.activity-empty{font-size:13px;padding:18px 20px;background:#f8fafc;border:1px dashed #dce3ef;border-radius:10px}
.llm-comments{list-style:none;padding:0;margin:12px 0 20px;display:grid;gap:12px;font-size:13px}
.llm-comments li{padding:12px;background:#f8fafc;border:1px solid #e8edf5;border-radius:8px;overflow-wrap:anywhere;white-space:pre-wrap;line-height:1.7}.llm-comments strong{display:block;font-size:12px}.llm-comments .field-help{display:block;font-size:11px;margin-top:5px}
@media(max-width:600px){.review-activity{margin-top:24px;padding-top:22px}.timeline-event{column-gap:12px}.event-heading time{flex-basis:100%;margin-left:0;padding-left:0}.event-detail.event-comment{padding:10px 12px}}
.llm-editor{display:grid;grid-template-columns:minmax(0,2fr) minmax(240px,1fr);gap:16px;align-items:start}
@media (max-width:900px){.llm-editor{grid-template-columns:1fr}}
</style>
