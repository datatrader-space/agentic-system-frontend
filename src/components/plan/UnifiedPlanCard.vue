<script setup>
// Unified plan experience (Planning Consolidation Phase 3).
// One component for BOTH plan approval and live execution progress, driven by the normalized
// plan-view contract. Replaces the visible responsibilities of PlanChecklist + PlanApprovalCard
// within the modern timeline. Legacy components are retained as rollback fallback (not removed).
import { computed, ref, watch, nextTick } from 'vue'

const props = defineProps({
  plan: { type: Object, required: true },   // normalized plan-view snapshot
  busy: { type: Boolean, default: false },  // an approval request is in flight
  readOnly: { type: Boolean, default: false }, // public/unauthenticated surface
})
const emit = defineEmits(['decide']) // { decision: 'approve'|'reject'|'request_changes', comment }

const STATUS_LABEL = {
  draft: 'Planning', pending_approval: 'Awaiting approval', approved: 'Approved',
  changes_requested: 'Changes requested', rejected: 'Rejected', executing: 'In progress',
  paused: 'Paused', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled',
}
const STEP_ICON = { pending: '○', started: '◐', completed: '✓', failed: '✕', skipped: '–' }

const status = computed(() => props.plan?.plan_status || 'draft')
const statusLabel = computed(() => STATUS_LABEL[status.value] || status.value)
const steps = computed(() => props.plan?.steps || [])
const total = computed(() => props.plan?.total_step_count ?? steps.value.length)
const completed = computed(() => props.plan?.completed_step_count ?? 0)
const currentStepId = computed(() => props.plan?.current_step_id || null)

const canAct = computed(() => !props.readOnly
  && Array.isArray(props.plan?.available_actions)
  && props.plan.available_actions.includes('approve'))

const awaitingApproval = computed(() => status.value === 'pending_approval' || status.value === 'changes_requested')

// Default expansion: expanded while awaiting approval / changes / rejected / failed; collapsed when completed.
const expanded = ref(false)
const _defaultExpanded = () => ['pending_approval', 'changes_requested', 'rejected', 'failed'].includes(status.value)
watch(status, () => { expanded.value = _defaultExpanded() }, { immediate: true })

const showRevise = ref(false)
const reviseText = ref('')
const reviseBox = ref(null)

async function openRevise() {
  showRevise.value = true
  await nextTick()
  reviseBox.value?.focus()
}
function submitDecision(decision) {
  if (props.busy || !canAct.value) return
  if (decision === 'request_changes' && !showRevise.value) { openRevise(); return }
  emit('decide', { decision, comment: decision === 'request_changes' ? reviseText.value.trim() : '' })
  showRevise.value = false
  reviseText.value = ''
}

const progressPct = computed(() => (total.value ? Math.round((completed.value / total.value) * 100) : 0))
</script>

<template>
  <section class="uplan" :class="`is-${status}`" role="group"
           :aria-label="`Plan: ${plan.title || 'Untitled'} — ${statusLabel}`">
    <header class="uplan__head">
      <button class="uplan__toggle" type="button" :aria-expanded="expanded"
              @click="expanded = !expanded">
        <span class="uplan__caret" :class="{ open: expanded }" aria-hidden="true">▸</span>
        <span class="uplan__title">{{ plan.title || 'Plan' }}</span>
      </button>
      <span class="uplan__badge" :class="`badge-${status}`" role="status" aria-live="polite">
        {{ statusLabel }}
      </span>
      <span v-if="plan.version_number" class="uplan__ver" :title="`Plan version ${plan.version_number}`">
        v{{ plan.version_number }}
      </span>
    </header>

    <p v-if="plan.summary && expanded" class="uplan__summary">{{ plan.summary }}</p>

    <!-- progress -->
    <div v-if="total" class="uplan__progress" :aria-label="`${completed} of ${total} steps complete`">
      <div class="uplan__bar"><div class="uplan__fill" :style="{ width: progressPct + '%' }" /></div>
      <span class="uplan__count" aria-hidden="true">{{ completed }}/{{ total }}</span>
    </div>

    <div v-if="expanded" class="uplan__body">
      <!-- steps / live checklist -->
      <ol class="uplan__steps" role="list">
        <li v-for="s in steps" :key="s.step_id" class="uplan__step" :class="[`step-${s.status}`, { current: s.step_id === currentStepId }]">
          <span class="uplan__stepicon" aria-hidden="true">{{ STEP_ICON[s.status] || '○' }}</span>
          <span class="uplan__steptxt">
            <span class="uplan__steptitle">{{ s.title || s.description }}</span>
            <span v-if="!readOnly && s.failure_summary" class="uplan__stepfail">{{ s.failure_summary }}</span>
          </span>
          <span class="uplan__stepstatus visually-hidden">{{ s.status }}</span>
        </li>
      </ol>

      <!-- approval affordances -->
      <div v-if="awaitingApproval && canAct" class="uplan__approve">
        <p class="uplan__note">
          Approving <strong>starts this plan</strong>. It does not approve later risky tools — those
          are confirmed separately as they occur.
        </p>
        <div v-if="showRevise" class="uplan__revise">
          <label class="visually-hidden" for="uplan-revise">Requested changes</label>
          <textarea id="uplan-revise" ref="reviseBox" v-model="reviseText" rows="2"
                    placeholder="Describe the changes you want…" :disabled="busy" />
        </div>
        <div class="uplan__actions">
          <button type="button" class="btn btn-approve" :disabled="busy" @click="submitDecision('approve')">
            Approve
          </button>
          <button type="button" class="btn btn-reject" :disabled="busy" @click="submitDecision('reject')">
            Reject
          </button>
          <button type="button" class="btn btn-revise" :disabled="busy" @click="submitDecision('request_changes')">
            {{ showRevise ? 'Send changes' : 'Request changes' }}
          </button>
        </div>
      </div>

      <p v-if="readOnly" class="uplan__ro" aria-live="polite">Read-only view.</p>
    </div>
  </section>
</template>

<style scoped>
.uplan { border: 1px solid var(--border, #e2e2e5); border-radius: 10px; padding: 12px 14px;
  background: var(--surface, #fff); display: flex; flex-direction: column; gap: 8px; font-size: 14px; }
.uplan__head { display: flex; align-items: center; gap: 8px; }
.uplan__toggle { display: flex; align-items: center; gap: 6px; background: none; border: 0;
  cursor: pointer; padding: 0; font: inherit; color: inherit; font-weight: 600; flex: 1; text-align: left; }
.uplan__caret { transition: transform .15s ease; display: inline-block; }
.uplan__caret.open { transform: rotate(90deg); }
.uplan__badge { font-size: 12px; padding: 2px 8px; border-radius: 999px; background: var(--muted, #eef); white-space: nowrap; }
.badge-pending_approval { background: #fff3cd; color: #7a5b00; }
.badge-executing { background: #e0f0ff; color: #0b5cad; }
.badge-completed { background: #e3f6e8; color: #1a7f3c; }
.badge-failed, .badge-rejected { background: #fde2e1; color: #a1281f; }
.badge-changes_requested { background: #fdebd0; color: #92510a; }
.uplan__ver { font-size: 12px; color: var(--muted-fg, #888); }
.uplan__summary { margin: 0; color: var(--muted-fg, #555); }
.uplan__progress { display: flex; align-items: center; gap: 8px; }
.uplan__bar { flex: 1; height: 6px; background: var(--muted, #eee); border-radius: 3px; overflow: hidden; }
.uplan__fill { height: 100%; background: var(--accent, #3b82f6); transition: width .3s ease; }
.uplan__count { font-variant-numeric: tabular-nums; font-size: 12px; color: var(--muted-fg, #666); }
.uplan__steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.uplan__step { display: flex; align-items: flex-start; gap: 8px; padding: 3px 4px; border-radius: 6px; }
.uplan__step.current { background: var(--muted, #f3f6ff); }
.uplan__step.step-completed .uplan__stepicon { color: #1a7f3c; }
.uplan__step.step-failed .uplan__stepicon { color: #a1281f; }
.uplan__steptxt { display: flex; flex-direction: column; gap: 2px; }
.uplan__stepfail { font-size: 12px; color: #a1281f; }
.uplan__note { font-size: 12.5px; color: var(--muted-fg, #555); background: var(--muted, #f7f7fa);
  padding: 6px 8px; border-radius: 6px; margin: 0; }
.uplan__revise textarea { width: 100%; box-sizing: border-box; border: 1px solid var(--border, #ccc);
  border-radius: 6px; padding: 6px; font: inherit; resize: vertical; }
.uplan__actions { display: flex; gap: 8px; flex-wrap: wrap; }
.btn { border: 0; border-radius: 6px; padding: 6px 14px; font: inherit; cursor: pointer; font-weight: 600; }
.btn:disabled { opacity: .55; cursor: default; }
.btn-approve { background: #1a7f3c; color: #fff; }
.btn-reject { background: #a1281f; color: #fff; }
.btn-revise { background: var(--muted, #e6e6ea); color: inherit; }
.btn:focus-visible, .uplan__toggle:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: 2px; }
.uplan__ro { font-size: 12px; color: var(--muted-fg, #888); margin: 0; }
.visually-hidden { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;
  overflow: hidden; clip: rect(0 0 0 0); border: 0; }
@media (prefers-reduced-motion: reduce) { .uplan__caret, .uplan__fill { transition: none; } }
@media (prefers-color-scheme: dark) {
  .uplan { background: var(--surface, #1c1c1f); border-color: var(--border, #333); }
}
</style>
