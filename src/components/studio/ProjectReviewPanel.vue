<template>
  <!-- Review of a project (ADM-1248): comments with replies and time codes, and approvals, on the whole project, one
       scene or one version. What a person may do comes from the server (abilities, can_edit/can_delete/can_resolve). -->
  <section class="prp" aria-label="Review" data-test="review-panel">
    <label class="prp-target"><span>Reviewing</span>
      <select v-model="targetKey" data-test="review-target">
        <option v-for="t in allTargets" :key="key(t)" :value="key(t)">{{ t.label }}</option>
      </select>
    </label>

    <section class="prp-block" aria-labelledby="prp-approvals">
      <h3 id="prp-approvals">Approvals</h3>
      <p v-if="approvalsError" class="prp-bad" role="alert">{{ approvalsError }}</p>
      <ul v-if="approvals.length" class="prp-decisions">
        <li v-for="a in approvals" :key="a.user.id" data-test="review-decision">
          <span class="prp-mark" :class="a.decision === 'approved' ? 'ok' : 'warn'">{{ a.decision === 'approved' ? 'Approved' : 'Changes requested' }}</span>
          <span><strong data-test="review-person">{{ personName(a.user, me) }}</strong><small v-if="personDetail(a.user, me)" class="prp-email">{{ personDetail(a.user, me) }}</small><small>{{ when(a.updated_at) }}</small><span v-if="a.note" class="prp-note">{{ a.note }}</span></span>
        </li>
      </ul>
      <p v-else class="prp-muted">No decisions yet.</p>
      <form v-if="abilities.approve" class="prp-decide" data-test="review-decide" @submit.prevent>
        <label class="prp-field"><span>Note (optional)</span><textarea v-model="decisionNote" rows="2" maxlength="2000" placeholder="What should change, or why it is ready" /></label>
        <div class="prp-actions">
          <button type="button" class="prp-btn ok" :disabled="deciding" data-test="review-approve" @click="decide('approved')">Approve</button>
          <button type="button" class="prp-btn warn" :disabled="deciding" data-test="review-changes" @click="decide('changes_requested')">Request changes</button>
          <button v-if="mine" type="button" class="prp-btn quiet" :disabled="deciding" data-test="review-withdraw" @click="decide('none')">Withdraw my decision</button>
        </div>
      </form>
    </section>

    <section class="prp-block" aria-labelledby="prp-comments">
      <div class="prp-row"><h3 id="prp-comments">Comments</h3>
        <label class="prp-check"><input v-model="showResolved" type="checkbox" /> Show resolved</label></div>
      <p v-if="loading" class="prp-muted" role="status">Loading comments…</p>
      <p v-else-if="commentsError" class="prp-bad" role="alert">{{ commentsError }} <button type="button" class="prp-btn" @click="loadComments">Try again</button></p>
      <p v-else-if="!threads.length" class="prp-muted">{{ abilities.comment ? 'No comments yet. Start the conversation below.' : 'No comments yet.' }}</p>
      <ol class="prp-threads">
        <li v-for="c in threads" :key="c.comment_id" class="prp-thread" :class="{ resolved: c.resolved }" data-test="review-comment">
          <article class="prp-comment">
            <header><strong data-test="review-person">{{ personName(c.author, me) }}</strong><small v-if="personDetail(c.author, me)" class="prp-email">{{ personDetail(c.author, me) }}</small><small>{{ when(c.created_at) }}{{ c.edited_at ? ', edited' : '' }}</small>
              <span v-if="c.timecode_ms != null" class="prp-time">at {{ clock(c.timecode_ms) }}</span>
              <span v-if="c.resolved" class="prp-mark ok">Resolved{{ c.resolved_by ? ` by ${isMe(c.resolved_by, me) ? 'you' : personName(c.resolved_by, me)}` : '' }}</span></header>
            <form v-if="editing === c.comment_id" class="prp-edit" @submit.prevent="saveEdit(c)">
              <label class="prp-sr" :for="`prp-edit-${c.comment_id}`">Edit comment</label>
              <textarea :id="`prp-edit-${c.comment_id}`" v-model="editText" rows="3" maxlength="5000" required />
              <div class="prp-actions"><button type="submit" class="prp-btn primary" :disabled="!editText.trim() || busy">Save</button><button type="button" class="prp-btn quiet" @click="editing = ''">Cancel</button></div>
            </form>
            <p v-else class="prp-body">{{ c.body }}</p>
            <div class="prp-actions small">
              <button v-if="abilities.comment && !c.resolved" type="button" class="prp-link" @click="startReply(c)">Reply</button>
              <button v-if="c.can_resolve" type="button" class="prp-link" :disabled="busy" data-test="review-resolve" @click="resolve(c, !c.resolved)">{{ c.resolved ? 'Reopen' : 'Resolve' }}</button>
              <button v-if="c.can_edit && editing !== c.comment_id" type="button" class="prp-link" @click="startEdit(c)">Edit</button>
              <button v-if="c.can_delete && confirmDelete !== c.comment_id" type="button" class="prp-link" @click="confirmDelete = c.comment_id">Delete</button>
              <span v-if="confirmDelete === c.comment_id" class="prp-confirm">Delete this comment? <button type="button" class="prp-link bad" data-test="review-delete" :disabled="busy" @click="remove(c)">Delete</button><button type="button" class="prp-link" @click="confirmDelete = ''">Keep</button></span>
            </div>
          </article>
          <ol v-if="c.replies.length" class="prp-replies">
            <li v-for="r in c.replies" :key="r.comment_id"><article class="prp-comment">
              <header><strong data-test="review-person">{{ personName(r.author, me) }}</strong><small v-if="personDetail(r.author, me)" class="prp-email">{{ personDetail(r.author, me) }}</small><small>{{ when(r.created_at) }}{{ r.edited_at ? ', edited' : '' }}</small></header>
              <form v-if="editing === r.comment_id" class="prp-edit" @submit.prevent="saveEdit(r)">
                <label class="prp-sr" :for="`prp-edit-${r.comment_id}`">Edit reply</label>
                <textarea :id="`prp-edit-${r.comment_id}`" v-model="editText" rows="2" maxlength="5000" required />
                <div class="prp-actions"><button type="submit" class="prp-btn primary" :disabled="!editText.trim() || busy">Save</button><button type="button" class="prp-btn quiet" @click="editing = ''">Cancel</button></div>
              </form>
              <p v-else class="prp-body">{{ r.body }}</p>
              <div class="prp-actions small">
                <button v-if="r.can_edit && editing !== r.comment_id" type="button" class="prp-link" @click="startEdit(r)">Edit</button>
                <button v-if="r.can_delete" type="button" class="prp-link" :disabled="busy" @click="remove(r)">Delete</button>
              </div>
            </article></li>
          </ol>
          <form v-if="replyTo === c.comment_id" class="prp-reply" @submit.prevent="send(c)">
            <label class="prp-sr" :for="`prp-reply-${c.comment_id}`">Reply to {{ isMe(c.author, me) ? 'your comment' : personName(c.author, me) }}</label>
            <textarea :id="`prp-reply-${c.comment_id}`" ref="replyBox" v-model="replyText" rows="2" maxlength="5000" placeholder="Write a reply" required />
            <div class="prp-actions"><button type="submit" class="prp-btn primary" :disabled="!replyText.trim() || busy">Reply</button><button type="button" class="prp-btn quiet" @click="replyTo = ''">Cancel</button></div>
          </form>
        </li>
      </ol>
      <form v-if="abilities.comment" class="prp-new" data-test="review-new-comment" @submit.prevent="send()">
        <label class="prp-field"><span>Add a comment</span><textarea v-model="text" rows="3" maxlength="5000" placeholder="What do you notice?" required /></label>
        <div class="prp-actions">
          <label v-if="target.type === 'version'" class="prp-field inline"><span>At (m:ss, optional)</span><input v-model.trim="timecode" type="text" inputmode="numeric" placeholder="0:12" pattern="\d{1,3}:[0-5]\d" /></label>
          <button type="submit" class="prp-btn primary" :disabled="!text.trim() || busy || !timecodeOk" data-test="review-send">Comment</button>
        </div>
      </form>
      <p v-else class="prp-muted">You can view this project. Ask its owner or a manager to let you comment.</p>
      <p v-if="actionError" class="prp-bad" role="alert" data-test="review-error">{{ actionError }}</p>
    </section>
  </section>
</template>

<script setup>
import { computed, inject, nextTick, ref, watch } from 'vue'
import { errorText, isMe, personDetail, personName, sharing } from '../../services/studioSharing'

const props = defineProps({
  projectId: { type: String, required: true },
  abilities: { type: Object, default: () => ({}) },
  // [{type: 'scene'|'version', id, label}] besides the whole project.
  targets: { type: Array, default: () => [] },
  initialTarget: { type: Object, default: null },
})
const emit = defineEmits(['decided'])
// The signed-in person (the Studio shell provides it): what they wrote and decided says "You" (ISSUE-15).
const me = inject('studioUser', ref(null))
const allTargets = computed(() => [{ type: 'project', id: props.projectId, label: 'The whole project' }, ...props.targets])
const key = (t) => `${t.type}:${t.id}`
const targetKey = ref(props.initialTarget ? key(props.initialTarget) : `project:${props.projectId}`)
const target = computed(() => allTargets.value.find(t => key(t) === targetKey.value) || allTargets.value[0])
watch(() => props.initialTarget, t => { if (t) targetKey.value = key(t) })

const comments = ref([]), loading = ref(false), commentsError = ref(''), actionError = ref(''), busy = ref(false)
const approvals = ref([]), mine = ref(null), approvalsError = ref(''), decisionNote = ref(''), deciding = ref(false)
const text = ref(''), timecode = ref(''), showResolved = ref(false)
const replyTo = ref(''), replyText = ref(''), replyBox = ref(null), editing = ref(''), editText = ref(''), confirmDelete = ref('')
const timecodeOk = computed(() => !timecode.value || /^\d{1,3}:[0-5]\d$/.test(timecode.value))
const threads = computed(() => {
  const top = comments.value.filter(c => !c.parent_id && (showResolved.value || !c.resolved))
  return top.map(c => ({ ...c, replies: comments.value.filter(r => r.parent_id === c.comment_id) }))
})
const params = () => ({ target_type: target.value.type, target_id: target.value.id })
function when(iso) { return iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '' }
function clock(ms) { const s = Math.floor(Number(ms) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
function toMs(tc) { const [m, s] = tc.split(':').map(Number); return (m * 60 + s) * 1000 }

async function loadComments() {
  loading.value = true; commentsError.value = ''
  try { comments.value = (await sharing.comments(props.projectId, params())).data?.comments || [] }
  catch (e) { commentsError.value = errorText(e, 'Comments could not be loaded.') } finally { loading.value = false }
}
async function loadApprovals() {
  approvalsError.value = ''
  try { const { data } = await sharing.approvals(props.projectId, params()); approvals.value = data?.approvals || []; mine.value = data?.mine || null }
  catch (e) { approvalsError.value = errorText(e, 'Approvals could not be loaded.') }
}
watch(() => [props.projectId, targetKey.value], () => { replyTo.value = ''; editing.value = ''; loadComments(); loadApprovals() }, { immediate: true })

async function act(fn) {
  busy.value = true; actionError.value = ''
  try { await fn(); await loadComments() } catch (e) { actionError.value = errorText(e) } finally { busy.value = false }
}
const send = (parent = null) => act(async () => {
  const body = parent ? { ...params(), body: replyText.value.trim(), parent_id: parent.comment_id }
    : { ...params(), body: text.value.trim(), ...(timecode.value && target.value.type === 'version' ? { timecode_ms: toMs(timecode.value) } : {}) }
  await sharing.comment(props.projectId, body)
  if (parent) { replyText.value = ''; replyTo.value = '' } else { text.value = ''; timecode.value = '' }
})
async function startReply(c) { replyTo.value = c.comment_id; replyText.value = ''; await nextTick(); (Array.isArray(replyBox.value) ? replyBox.value[0] : replyBox.value)?.focus?.() }
function startEdit(c) { editing.value = c.comment_id; editText.value = c.body }
const saveEdit = (c) => act(async () => { await sharing.editComment(c.comment_id, { body: editText.value.trim() }); editing.value = '' })
const resolve = (c, resolved) => act(() => sharing.editComment(c.comment_id, { resolved }))
const remove = (c) => act(async () => { await sharing.deleteComment(c.comment_id); confirmDelete.value = '' })
async function decide(decision) {
  deciding.value = true; approvalsError.value = ''
  try {
    const { data } = await sharing.decide(props.projectId, { ...params(), decision, note: decision === 'none' ? '' : decisionNote.value.trim() })
    approvals.value = data?.approvals || []; mine.value = data?.mine || null; decisionNote.value = ''
    emit('decided', { target: target.value, decision })
  } catch (e) { approvalsError.value = errorText(e, 'Your decision could not be saved.') } finally { deciding.value = false }
}
</script>

<style scoped>
.prp{display:grid;gap:18px;color:var(--vm-ink)}
.prp-target{display:grid;gap:6px;max-width:420px;font-size:12px;color:var(--vm-ink-soft)}
.prp select,.prp textarea,.prp input{box-sizing:border-box;min-height:40px;padding:8px 10px;border:1px solid var(--vm-line);border-radius:6px;background:var(--vm-bg);color:var(--vm-ink);font:inherit;font-size:13px}
.prp textarea{width:100%;resize:vertical;line-height:1.55}
.prp-block{display:grid;gap:12px;padding:18px;border:1px solid var(--vm-line);border-radius:10px;background:var(--vm-surface)}
.prp h3{margin:0;font-size:14px;font-weight:600}.prp-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.prp-decisions,.prp-threads,.prp-replies{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.prp-decisions li{display:flex;align-items:flex-start;gap:10px;font-size:13px}.prp-decisions li>span:last-child{display:grid;gap:2px}
.prp small{font-size:11.5px;color:var(--vm-ink-soft)}.prp-email{overflow-wrap:anywhere}.prp-note{font-size:12.5px;color:var(--vm-ink-soft);white-space:pre-wrap;overflow-wrap:anywhere}
.prp-mark{flex:none;font-size:11px;padding:2px 8px;border-radius:999px;white-space:nowrap}.prp-mark.ok{color:var(--vs-ok-ink);background:var(--vs-ok-bg)}.prp-mark.warn{color:var(--vs-warn-ink);background:var(--vs-warn-bg)}
.prp-thread{display:grid;gap:8px;padding:12px;border:1px solid var(--vm-line-2);border-radius:8px;background:var(--vm-bg)}.prp-thread.resolved{opacity:.75}
.prp-comment{display:grid;gap:6px}.prp-comment header{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px;font-size:13px}
.prp-time{font-size:11.5px;color:var(--vs-accent-ink);font-variant-numeric:tabular-nums}
.prp-body{margin:0;font-size:13.5px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}
.prp-replies{padding-left:14px;border-left:2px solid var(--vm-line-2)}
.prp-actions{display:flex;flex-wrap:wrap;align-items:flex-end;gap:8px}.prp-actions.small{gap:12px}
.prp-field{display:grid;gap:6px;flex:1 1 220px;font-size:12px;color:var(--vm-ink-soft)}.prp-field.inline{flex:0 0 auto}.prp-field.inline input{width:96px}
.prp-btn{min-height:40px;padding:0 14px;border:1px solid var(--vm-line);border-radius:6px;background:transparent;color:var(--vm-ink);font:inherit;font-size:13px;font-weight:500;cursor:pointer}
.prp-btn:hover:not(:disabled){background:var(--vm-surface-2)}.prp-btn:disabled{opacity:.55;cursor:not-allowed}
.prp-btn.primary{background:var(--vm-violet-d);border-color:transparent;color:#fff}.prp-btn.ok{border-color:var(--vs-ok-ink);color:var(--vs-ok-ink)}.prp-btn.warn{border-color:var(--vs-warn-ink);color:var(--vs-warn-ink)}.prp-btn.quiet{border-color:transparent;color:var(--vm-ink-soft)}
.prp-link{min-height:32px;padding:0;border:0;background:none;color:var(--vm-link);font:inherit;font-size:12.5px;cursor:pointer}.prp-link.bad{color:var(--vs-bad-ink)}.prp-link:disabled{opacity:.55}
.prp-confirm{display:inline-flex;align-items:center;gap:10px;font-size:12.5px;color:var(--vm-ink-soft)}
.prp-check{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--vm-ink-soft);cursor:pointer}.prp-check input{min-height:0;width:16px;height:16px;accent-color:var(--vm-violet)}
.prp-muted{margin:0;font-size:13px;color:var(--vm-ink-soft)}.prp-bad{margin:0;font-size:13px;color:var(--vs-bad-ink)}
.prp-new,.prp-reply,.prp-edit,.prp-decide{display:grid;gap:8px}
.prp-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.prp :focus-visible{outline:2px solid var(--vs-accent-ink,var(--vm-link));outline-offset:2px}
@media(max-width:640px){.prp-block{padding:14px}.prp select,.prp textarea,.prp input{font-size:16px}.prp-btn,.prp-link{min-height:44px}}
</style>
