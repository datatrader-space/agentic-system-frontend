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

// Verification-tier badge on a completed step — HOW the runner verified its outcome (runner-owned, not a
// model claim). outcome = a provider receipt / read-back; artifact = structure/schema validation; semantic =
// a bounded semantic check; presence = the deliverable exists (honestly weaker than outcome-verified).
const TIER_META = {
  outcome_verified: { label: 'Verified', cls: 'outcome', title: 'Outcome verified by a provider receipt or read-back reconciliation' },
  artifact_verified: { label: 'Validated', cls: 'artifact', title: 'Output structure / schema validation passed' },
  semantically_verified: { label: 'Reviewed', cls: 'semantic', title: 'Passed a bounded semantic acceptance check' },
  presence_verified: { label: 'Produced', cls: 'presence', title: 'Deliverable is present (presence-verified, not outcome-verified)' },
}
const tierMeta = (t) => TIER_META[String(t || '').toLowerCase()] || null
const tierLabel = (t) => tierMeta(t)?.label || ''
const tierTitle = (t) => tierMeta(t)?.title || ''
const tierClass = (t) => tierMeta(t)?.cls || 'presence'

const status = computed(() => props.plan?.plan_status || 'draft')
const statusLabel = computed(() => STATUS_LABEL[status.value] || status.value)
// A ROADMAP is a strategic display artifact (non-executable) — render milestones, NOT an execution
// checklist: no progress bar, no ✓/current-step states, a distinct "Roadmap" badge, expanded by default.
const isRoadmap = computed(() => props.plan?.plan_purpose === 'roadmap')
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
const _defaultExpanded = () => isRoadmap.value || ['pending_approval', 'changes_requested', 'rejected', 'failed'].includes(status.value)
watch(status, () => { expanded.value = _defaultExpanded() }, { immediate: true })

// Per-step "Details" disclosure (deep plans only carry step.details). Collapsed by default; keyed by
// step_id so each step toggles independently. A step with no details renders no toggle at all.
const openDetails = ref({})
function toggleDetails(id) { openDetails.value = { ...openDetails.value, [id]: !openDetails.value[id] } }

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
      <span class="uplan__badge" :class="isRoadmap ? 'badge-roadmap' : `badge-${status}`" role="status" aria-live="polite">
        {{ isRoadmap ? 'Roadmap' : statusLabel }}
      </span>
      <span v-if="plan.version_number" class="uplan__ver" :title="`Plan version ${plan.version_number}`">
        v{{ plan.version_number }}
      </span>
    </header>

    <p v-if="plan.summary && expanded" class="uplan__summary">{{ plan.summary }}</p>

    <!-- progress (execution only — a roadmap is not executed, so no ✓ progress) -->
    <div v-if="total && !isRoadmap" class="uplan__progress" :aria-label="`${completed} of ${total} steps complete`">
      <div class="uplan__bar"><div class="uplan__fill" :style="{ width: progressPct + '%' }" /></div>
      <span class="uplan__count" aria-hidden="true">{{ completed }}/{{ total }}</span>
    </div>

    <div v-if="expanded" class="uplan__body">
      <!-- steps / live checklist -->
      <ol class="uplan__steps" :class="{ 'is-roadmap': isRoadmap }" role="list">
        <li v-for="(s, i) in steps" :key="s.step_id" class="uplan__step"
            :class="isRoadmap ? 'is-milestone' : [`step-${s.status}`, { current: s.step_id === currentStepId }]">
          <span class="uplan__stepicon" aria-hidden="true">{{ isRoadmap ? `M${i + 1}` : (STEP_ICON[s.status] || '○') }}</span>
          <span class="uplan__steptxt">
            <span class="uplan__steptitle">{{ s.title || s.description }}</span>
            <span v-if="s.status === 'completed' && tierLabel(s.tier)" class="uplan__tier"
                  :class="`tier-${tierClass(s.tier)}`" :title="tierTitle(s.tier)">{{ tierLabel(s.tier) }}</span>
            <span v-if="!readOnly && s.failure_summary" class="uplan__stepfail">{{ s.failure_summary }}</span>
            <!-- optional per-step DETAILS (deep plans) — collapsed disclosure; nothing when empty -->
            <template v-if="s.details">
              <button type="button" class="uplan__detailstoggle" :aria-expanded="!!openDetails[s.step_id]"
                      @click="toggleDetails(s.step_id)">
                <span class="uplan__detailscaret" :class="{ open: openDetails[s.step_id] }" aria-hidden="true">▸</span>
                Details
              </button>
              <span v-if="openDetails[s.step_id]" class="uplan__stepdetails">{{ s.details }}</span>
            </template>
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
/* Roadmap = strategic display artifact (distinct from execution states). */
.badge-roadmap { background: #ede9fe; color: #6d28d9; }
.uplan__steps.is-roadmap { counter-reset: none; }
.uplan__step.is-milestone .uplan__stepicon {
  font-size: 11px; font-weight: 700; color: #6d28d9;
  background: #ede9fe; border-radius: 6px; padding: 1px 5px; min-width: 22px; text-align: center;
}
.uplan__step.is-milestone { opacity: 1; }   /* no execution dimming/current-step highlight */
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
.uplan__detailstoggle { align-self: flex-start; display: inline-flex; align-items: center; gap: 4px;
  background: none; border: 0; cursor: pointer; padding: 0; font: inherit; font-size: 12px;
  color: var(--muted-fg, #666); font-weight: 600; }
.uplan__detailscaret { transition: transform .15s ease; display: inline-block; font-size: 10px; }
.uplan__detailscaret.open { transform: rotate(90deg); }
.uplan__stepdetails { font-size: 12.5px; color: var(--muted-fg, #555); line-height: 1.45;
  background: var(--muted, #f7f7fa); padding: 6px 8px; border-radius: 6px; margin-top: 2px; white-space: pre-wrap; }
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
@media (prefers-reduced-motion: reduce) { .uplan__caret, .uplan__fill, .uplan__detailscaret { transition: none; } }
@media (prefers-color-scheme: dark) {
  .uplan { background: var(--surface, #1c1c1f); border-color: var(--border, #333); }
}
/* Verification-tier badge on a completed step */
.uplan__tier { display: inline-block; margin-left: 8px; font-size: 10px; font-weight: 700;
  letter-spacing: .04em; text-transform: uppercase; padding: 1px 7px; border-radius: 999px;
  border: 1px solid transparent; vertical-align: middle; }
.uplan__tier.tier-outcome { color: #0b7a4b; background: #e4f6ee; border-color: #bfe6d6; }
.uplan__tier.tier-artifact { color: #1d5fb8; background: #e6effb; border-color: #c6dbf5; }
.uplan__tier.tier-semantic { color: #7a53c9; background: #efe9fb; border-color: #ddd0f5; }
.uplan__tier.tier-presence { color: #8a6d1a; background: #f7efd9; border-color: #ecdcaf; }
@media (prefers-color-scheme: dark) {
  .uplan__tier.tier-outcome { color: #3ddba0; background: #12291f; border-color: #1f4536; }
  .uplan__tier.tier-artifact { color: #7fb0f5; background: #142033; border-color: #26364f; }
  .uplan__tier.tier-semantic { color: #b9a4f0; background: #211a33; border-color: #38305a; }
  .uplan__tier.tier-presence { color: #e2c266; background: #2a2410; border-color: #493d18; }
}
</style>
