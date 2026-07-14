<script setup>
// Inline live plan artifact card (INLINE_PLAN_ARTIFACT_PLAN.md — approved UI design gate).
// Renders ONE plan snapshot in its full state set: awaiting-approval · active · blocked · failed ·
// revised · completed (compact) · reconnecting. Purely presentational — data via props, actions via
// emit. Robust to both pushed snapshots (carry status_user/plan_status_user) and hydrated snapshots
// (only raw status) via a client-side user-facing map.
import { computed, ref, watch } from 'vue'

const props = defineProps({
  plan: { type: Object, required: true },       // normalized plan-view snapshot
  busy: { type: Boolean, default: false },       // an approval request is in flight
  readOnly: { type: Boolean, default: false },
  connState: { type: String, default: 'ready' }, // 'ready'|'loading'|'stale'|'error'
})
const emit = defineEmits(['decide'])

// storage → user-facing maps (fallback when the snapshot didn't carry *_user, e.g. a hydrated GET).
const PLAN_MAP = {
  draft: 'draft', planning: 'draft', pending_approval: 'awaiting_approval', approved: 'active',
  executing: 'active', paused: 'paused', blocked: 'blocked', completed: 'completed', failed: 'failed',
  cancelled: 'cancelled', changes_requested: 'revised', rejected: 'cancelled', superseded: 'revised',
}
const STEP_MAP = {
  pending: 'pending', started: 'in_progress', completed: 'completed', skipped: 'skipped',
  blocked: 'blocked', failed: 'failed',
}
const PLAN_LABEL = {
  draft: 'Planning', awaiting_approval: 'Awaiting approval', active: 'Active', paused: 'Paused',
  blocked: 'Blocked', failed: 'Failed', completed: 'Completed', cancelled: 'Cancelled', revised: 'Revised',
}
const STEP_ICON = {
  pending: '', in_progress: '●', completed: '✓', blocked: '!', failed: '×', skipped: '–',
}

const isRoadmap = computed(() => props.plan?.plan_purpose === 'roadmap')
const planState = computed(() => props.plan?.plan_status_user || PLAN_MAP[props.plan?.plan_status] || 'active')
const planLabel = computed(() => (isRoadmap.value ? 'Roadmap' : (PLAN_LABEL[planState.value] || planState.value)))
const steps = computed(() => props.plan?.steps || [])
const total = computed(() => props.plan?.total_step_count ?? steps.value.length)
const done = computed(() => props.plan?.completed_step_count
  ?? steps.value.filter((s) => stepState(s) === 'completed' || stepState(s) === 'skipped').length)
const currentStepId = computed(() => props.plan?.current_step_id || null)
const version = computed(() => props.plan?.version_number || 1)
const progressPct = computed(() => (total.value ? Math.round((done.value / total.value) * 100) : 0))
const reconnecting = computed(() => props.connState === 'stale' || props.connState === 'loading')

function stepState(s) { return s.status_user || STEP_MAP[s.status] || 'pending' }

const canAct = computed(() => !props.readOnly
  && Array.isArray(props.plan?.available_actions)
  && props.plan.available_actions.includes('approve'))
const awaiting = computed(() => planState.value === 'awaiting_approval' || planState.value === 'revised')

// Expansion: collapsed when completed/cancelled (compact); expanded otherwise. Roadmaps expanded.
const expanded = ref(true)
watch(planState, (s) => {
  expanded.value = isRoadmap.value || !['completed', 'cancelled'].includes(s)
}, { immediate: true })

// Transient "updated" indicator on a version bump.
const justUpdated = ref(false)
let _updTimer = null
watch(version, (nv, ov) => {
  if (ov != null && nv !== ov) {
    justUpdated.value = true
    if (_updTimer) clearTimeout(_updTimer)
    _updTimer = setTimeout(() => { justUpdated.value = false }, 2600)
  }
})

// Per-step details disclosure (deep plans only).
const openDetails = ref({})
function toggleDetails(id) { openDetails.value = { ...openDetails.value, [id]: !openDetails.value[id] } }

// request_changes inline box
const showRevise = ref(false)
const reviseText = ref('')
function submitDecision(decision) {
  if (props.busy || !canAct.value) return
  if (decision === 'request_changes' && !showRevise.value) { showRevise.value = true; return }
  emit('decide', { decision, comment: decision === 'request_changes' ? reviseText.value.trim() : '' })
  showRevise.value = false
  reviseText.value = ''
}
</script>

<template>
  <section class="ipc" :class="[`state-${planState}`, { collapsed: !expanded, roadmap: isRoadmap }]"
           role="group" :aria-label="`Plan: ${plan.title || 'Untitled'} — ${planLabel}`">
    <header class="ipc-hd">
      <button class="ipc-caret" type="button" :aria-expanded="expanded"
              :aria-label="expanded ? 'Collapse plan' : 'Expand plan'" @click="expanded = !expanded">
        <span class="ipc-done-ic" v-if="planState === 'completed'" aria-hidden="true">✓</span>
        <span v-else class="ipc-chev" :class="{ open: expanded }" aria-hidden="true">▸</span>
      </button>
      <span class="ipc-title">{{ plan.title || 'Plan' }}</span>
      <span v-if="justUpdated" class="ipc-upd" role="status" aria-live="polite">updated</span>
      <span v-if="reconnecting" class="ipc-pill pill-reconnect" role="status">Reconnecting…</span>
      <span v-else class="ipc-pill" :class="`pill-${isRoadmap ? 'revised' : planState}`" role="status" aria-live="polite">
        {{ planLabel }}<span v-if="planState === 'revised' && version">&nbsp;· v{{ version }}</span>
      </span>
      <span v-if="!isRoadmap && total" class="ipc-progress" aria-hidden="true">{{ done }} / {{ total }}</span>
    </header>

    <div v-if="!isRoadmap && total && expanded" class="ipc-rail" :class="`rail-${planState}`"
         :aria-label="`${done} of ${total} steps complete`">
      <i :style="{ width: progressPct + '%' }"></i>
    </div>

    <template v-if="expanded">
      <ul class="ipc-steps" role="list">
        <li v-for="(s, i) in steps" :key="s.step_id"
            :class="[isRoadmap ? 'milestone' : stepState(s), { current: !isRoadmap && s.step_id === currentStepId }]"
            :aria-label="`Step ${i + 1}, ${s.title || s.description}, ${isRoadmap ? 'milestone' : stepState(s)}`">
          <span class="ipc-ic" aria-hidden="true">{{ isRoadmap ? `M${i + 1}` : STEP_ICON[stepState(s)] }}</span>
          <span class="ipc-body">
            <span class="ipc-label">{{ s.title || s.description }}</span>
            <span v-if="stepState(s) === 'blocked'" class="ipc-subtag tag-blocked">
              waiting<span v-if="s.block_reason || s.reason"> · {{ s.block_reason || s.reason }}</span>
            </span>
            <span v-else-if="stepState(s) === 'failed' && s.failure_summary" class="ipc-subtag tag-failed">
              failed · {{ s.failure_summary }}
            </span>
            <span v-if="s.details" class="ipc-detwrap">
              <button type="button" class="ipc-dettoggle" :aria-expanded="!!openDetails[s.step_id]"
                      @click="toggleDetails(s.step_id)">
                <span class="ipc-detcaret" :class="{ open: openDetails[s.step_id] }" aria-hidden="true">▸</span>Details
              </button>
              <span v-if="openDetails[s.step_id]" class="ipc-details">{{ s.details }}</span>
            </span>
          </span>
        </li>
      </ul>

      <div v-if="awaiting && canAct" class="ipc-ft">
        <div v-if="showRevise" class="ipc-revise">
          <label class="ipc-sr" for="ipc-revise">Requested changes</label>
          <textarea id="ipc-revise" v-model="reviseText" rows="2"
                    placeholder="Describe the changes you want…" :disabled="busy"></textarea>
        </div>
        <div class="ipc-actions">
          <span class="ipc-ftnote">Approving starts this plan.</span>
          <span class="ipc-spacer"></span>
          <button type="button" class="btn" :disabled="busy" @click="submitDecision('request_changes')">
            {{ showRevise ? 'Send changes' : 'Edit' }}
          </button>
          <button type="button" class="btn" :disabled="busy" @click="submitDecision('reject')">Reject</button>
          <button type="button" class="btn primary" :disabled="busy" @click="submitDecision('approve')">
            Approve &amp; run
          </button>
        </div>
      </div>
      <p v-else-if="readOnly" class="ipc-ro">Read-only view.</p>
    </template>
  </section>
</template>

<style scoped>
.ipc {
  --line: var(--vm-border, #e4e8ee); --surf: var(--vm-surface, #fff); --surf2: var(--vm-bg-soft, #f2f4f7);
  --ink: var(--vm-text, #1a1d23); --ink2: var(--vm-text-2, #5b6472); --ink3: var(--vm-text-3, #8a92a0);
  --acc: var(--vm-accent, #3a5bd9);
  --done: #17864a; --done-bg: #e6f6ec; --prog: #3a5bd9; --prog-bg: #eaeffc;
  --blk: #a9640a; --blk-bg: #fbf0dd; --fail: #c0392b; --fail-bg: #fbe9e7;
  border: 1px solid var(--line); border-radius: 12px; background: var(--surf); overflow: hidden;
  display: flex; flex-direction: column; font-size: 14px; color: var(--ink);
}
.ipc-hd { display: flex; align-items: center; gap: 9px; padding: 12px 14px; }
.ipc.collapsed .ipc-hd { border-bottom: 0; }
.ipc:not(.collapsed) .ipc-hd { border-bottom: 1px solid var(--line); }
.ipc-caret { flex: none; width: 22px; height: 22px; display: grid; place-items: center; border: 0;
  background: none; cursor: pointer; border-radius: 6px; color: var(--ink3); padding: 0; }
.ipc-caret:hover { background: var(--surf2); }
.ipc-chev { transition: transform .15s ease; font-size: 11px; }
.ipc-chev.open { transform: rotate(90deg); }
.ipc-done-ic { width: 18px; height: 18px; border-radius: 50%; background: var(--done); color: #fff;
  display: grid; place-items: center; font-size: 11px; font-weight: 700; }
.ipc-title { font-weight: 600; font-size: 14.5px; flex: 1; min-width: 0; letter-spacing: -.005em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ipc-progress { font-variant-numeric: tabular-nums; font-size: 12px; color: var(--ink2); flex: none; }
.ipc-upd { font-size: 11px; font-weight: 600; color: var(--acc); animation: fade 2.6s ease-out; }
@keyframes fade { 0% { opacity: 1 } 80% { opacity: 1 } 100% { opacity: 0 } }
.ipc-pill { font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 999px; white-space: nowrap; flex: none; }
.pill-active { background: var(--prog-bg); color: var(--prog); }
.pill-awaiting_approval { background: var(--prog-bg); color: var(--acc); }
.pill-blocked { background: var(--blk-bg); color: var(--blk); }
.pill-failed, .pill-cancelled { background: var(--fail-bg); color: var(--fail); }
.pill-completed { background: var(--done-bg); color: var(--done); }
.pill-revised, .pill-paused, .pill-draft { background: var(--surf2); color: var(--ink2); }
.pill-reconnect { background: var(--surf2); color: var(--ink3); }

.ipc-rail { height: 3px; background: var(--surf2); position: relative; }
.ipc-rail > i { position: absolute; inset: 0 auto 0 0; background: var(--prog); border-radius: 0 2px 2px 0; transition: width .3s ease; }
.rail-completed > i { background: var(--done); }
.rail-blocked > i { background: var(--blk); }
.rail-failed > i { background: var(--fail); }

.ipc-steps { list-style: none; margin: 0; padding: 6px; display: flex; flex-direction: column; }
.ipc-steps li { display: flex; gap: 11px; align-items: flex-start; padding: 8px 9px; border-radius: 8px; }
.ipc-steps li.current { background: var(--prog-bg); }
.ipc-ic { flex: none; width: 18px; height: 18px; border-radius: 50%; margin-top: 1px; display: grid;
  place-items: center; font-size: 11px; font-weight: 700; border: 1.5px solid var(--ink3); color: var(--ink3); }
li.pending .ipc-ic { border-style: dashed; }
li.in_progress .ipc-ic { border-color: var(--prog); color: var(--prog); }
li.completed .ipc-ic { border-color: var(--done); background: var(--done); color: #fff; }
li.blocked .ipc-ic { border-color: var(--blk); background: var(--blk-bg); color: var(--blk); }
li.failed .ipc-ic { border-color: var(--fail); background: var(--fail); color: #fff; }
li.skipped .ipc-ic { border-color: var(--ink3); color: var(--ink3); }
li.milestone .ipc-ic { border: 0; border-radius: 6px; background: #ede9fe; color: #6d28d9; width: auto; padding: 1px 6px; font-size: 10.5px; }
.ipc-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.ipc-label { color: var(--ink); }
li.completed .ipc-label, li.skipped .ipc-label { color: var(--ink2); }
li.skipped .ipc-label { text-decoration: line-through; }
li.in_progress .ipc-label, li.current .ipc-label { font-weight: 600; }
.ipc-subtag { display: inline-block; align-self: flex-start; font-size: 10.5px; padding: 2px 7px;
  border-radius: 5px; font-variant-numeric: tabular-nums; }
.tag-blocked { background: var(--blk-bg); color: var(--blk); }
.tag-failed { background: var(--fail-bg); color: var(--fail); }
.ipc-detwrap { display: flex; flex-direction: column; gap: 3px; }
.ipc-dettoggle { align-self: flex-start; display: inline-flex; align-items: center; gap: 4px; background: none;
  border: 0; cursor: pointer; padding: 0; font: inherit; font-size: 12px; color: var(--ink2); font-weight: 600; }
.ipc-detcaret { transition: transform .15s ease; font-size: 10px; }
.ipc-detcaret.open { transform: rotate(90deg); }
.ipc-details { font-size: 12.5px; color: var(--ink2); line-height: 1.45; background: var(--surf2);
  padding: 6px 8px; border-radius: 6px; white-space: pre-wrap; }

.ipc-ft { border-top: 1px solid var(--line); padding: 11px 14px; display: flex; flex-direction: column; gap: 8px; }
.ipc-revise textarea { width: 100%; box-sizing: border-box; border: 1px solid var(--line); border-radius: 8px;
  padding: 7px; font: inherit; resize: vertical; background: var(--surf); color: var(--ink); }
.ipc-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ipc-ftnote { font-size: 12px; color: var(--ink3); }
.ipc-spacer { flex: 1; }
.btn { font-size: 12.5px; font-weight: 600; padding: 7px 13px; border-radius: 8px; cursor: pointer;
  border: 1px solid var(--line); background: var(--surf); color: var(--ink); font-family: inherit; }
.btn:hover:not(:disabled) { background: var(--surf2); }
.btn.primary { background: var(--acc); border-color: var(--acc); color: #fff; }
.btn:disabled { opacity: .55; cursor: default; }
.btn:focus-visible, .ipc-caret:focus-visible, .ipc-dettoggle:focus-visible {
  outline: 2px solid var(--acc); outline-offset: 2px; }
.ipc-ro { font-size: 12px; color: var(--ink3); margin: 0; padding: 0 14px 12px; }
.ipc-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); border: 0; }

@media (prefers-reduced-motion: reduce) {
  .ipc-chev, .ipc-rail > i, .ipc-detcaret, .ipc-upd { transition: none; animation: none; }
}
@media (prefers-color-scheme: dark) {
  .ipc { --line: var(--vm-border, #2a313b); --surf: var(--vm-surface, #171b21); --surf2: var(--vm-bg-soft, #1e232b);
    --ink: var(--vm-text, #e9edf3); --ink2: var(--vm-text-2, #a7b0bd); --ink3: var(--vm-text-3, #6f7887);
    --done: #4ec281; --done-bg: #14301f; --prog: #7d96f0; --prog-bg: #1c2740;
    --blk: #e0a95a; --blk-bg: #2f2413; --fail: #f0796b; --fail-bg: #331a17; }
}
</style>
