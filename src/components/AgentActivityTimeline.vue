<template>
  <div v-if="show" class="agent-timeline">
    <!-- Bordered card. RUNNING → live "Working" header + rows. DONE → collapses to a single
         "✓ Done · N steps · Xs · Yk tokens" header; click to expand the full row detail. -->
    <div class="at-card" :class="{ 'at-warn': summaryWarn }">
      <!-- DONE: collapsible summary header -->
      <button v-if="isComplete && steps && steps.length" type="button" class="at-head" @click="expanded = !expanded">
        <svg class="at-check" :class="summaryWarn ? 'warn' : 'ok'" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.3 3.29 6.8-6.8a1 1 0 0 1 1.4 0Z" clip-rule="evenodd"/></svg>
        <span class="at-head-text">{{ headLabel }}<span v-if="steps.length"> · {{ steps.length }} step{{ steps.length === 1 ? '' : 's' }}</span><span v-if="tokensText && !publicSafe"> · {{ tokensText }}</span></span>
        <svg class="at-chevron" :class="{ open: expanded }" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" clip-rule="evenodd"/></svg>
      </button>

      <!-- RUNNING: live "Working" header -->
      <div v-else-if="running && !isComplete && steps && steps.length" class="at-head-live">
        <span class="at-dot" aria-hidden="true"></span>
        <span>Working</span>
        <span v-if="tokensText && !publicSafe" class="at-head-tok">· {{ tokensText }}</span>
      </div>

      <!-- Rows: shown live while running; when done, only after expanding. -->
      <ul v-if="steps && steps.length && (!isComplete || expanded)" class="agent-steps" :class="{ 'at-rows-done': isComplete }">
        <li
          v-for="step in steps"
          :key="step.stepId"
          class="agent-step"
          :class="`is-${step.status}`"
        >
          <span class="agent-step-icon" :class="`icon-${step.status}`">
            <template v-if="step.status === 'running'"><span class="agent-spinner sm" aria-hidden="true"></span></template>
            <template v-else-if="step.status === 'failed'">✕</template>
            <template v-else-if="step.status === 'interrupted'">⊘</template>
            <template v-else>✓</template>
          </span>
          <div class="agent-step-body">
            <div class="agent-step-head">
              <span class="agent-step-label">{{ step.label }}</span>
              <span v-if="step.durationMs != null && !publicSafe" class="agent-step-dur">{{ fmtDuration(step.durationMs) }}</span>
            </div>
            <!-- Streamed model reasoning folded under its step (ChatGPT-style). Never on public. -->
            <div v-if="step.reasoningText && !publicSafe" class="at-reason-text">{{ step.reasoningText }}</div>
            <!-- Only safe, backend-provided fields. No raw args/prompts/internals. On the public tier
                 (publicSafe) we refuse to render reason/next_action even if the backend accidentally sent
                 them — only a generic friendly failure note. Summaries are kept out of the main row to
                 stay clean (they remain available in the builder/debug section). -->
            <template v-if="!publicSafe">
              <div v-if="step.status === 'failed' && step.reason" class="agent-step-detail agent-step-error">
                {{ step.reason }}
              </div>
              <div v-if="step.status === 'failed' && step.nextAction" class="agent-step-detail agent-step-next">
                ↳ {{ step.nextAction }}
              </div>
              <div v-if="step.status === 'interrupted'" class="agent-step-detail agent-step-warn">
                {{ step.reason || 'Interrupted before finishing.' }}
              </div>
            </template>
            <div v-else-if="step.status === 'failed'" class="agent-step-detail agent-step-error">
              I couldn’t complete this step.
            </div>
          </div>
        </li>
      </ul>

      <!-- Fallback: a live status arrived before any row exists (back-compat / flag edge cases). -->
      <div v-else-if="running && statusLabel && !isComplete" class="agent-status-line">
        <span class="agent-spinner" aria-hidden="true"></span>
        <span class="agent-status-label">{{ statusLabel }}</span>
      </div>

      <!-- Model reasoning — folded INTO the one panel (ChatGPT-style "Thought for…"). Shown live and in
           the expanded done view. Never on the public tier (and the backend never sends reasoning there). -->
      <div v-if="!publicSafe && reasoning && reasoning.length && (!isComplete || expanded)"
           class="at-reasoning" :class="{ 'at-rows-done': isComplete }">
        <div v-for="(it, i) in reasoning" :key="`r${i}`" class="at-reason-item">
          <div class="at-reason-phrase">{{ it.label || 'Thinking' }}</div>
          <div v-if="it.text" class="at-reason-text">{{ it.text }}</div>
        </div>
      </div>
    </div>

    <!-- Sources footer. -->
    <div v-if="sources && sources.length" class="agent-sources">
      <span class="agent-sources-label">Sources used:</span>
      <span class="agent-sources-list">{{ sourceNames }}</span>
    </div>

    <!-- Builder/debug details (emulator only; gated by `debug`). The main timeline above stays clean —
         everything builder-specific lives here, collapsed by default. We render ONLY fields the backend
         actually sent for the builder tier (raw tool name, args_preview, duration, fuller reason, source
         refs, summary counts) — nothing is reconstructed on the frontend. -->
    <details v-if="debug && !publicSafe && hasDebug" class="agent-debug">
      <summary class="agent-debug-summary">Debug details (builder)</summary>
      <div class="agent-debug-body">
        <div v-if="steps && steps.length" class="agent-debug-block">
          <div v-for="step in steps" :key="`dbg-${step.stepId}`" class="agent-debug-step">
            <div class="agent-debug-line">
              <code v-if="step.tool" class="agent-debug-tool">{{ step.tool }}</code>
              <span class="agent-debug-status" :class="`s-${step.status}`">{{ step.status }}</span>
              <span v-if="step.durationMs != null" class="agent-debug-dur">{{ fmtDuration(step.durationMs) }}</span>
            </div>
            <div v-if="step.argsPreview" class="agent-debug-args"><span class="k">args</span> {{ step.argsPreview }}</div>
            <div v-if="step.reason" class="agent-debug-args agent-debug-err"><span class="k">reason</span> {{ step.reason }}</div>
            <div v-if="step.nextAction" class="agent-debug-args"><span class="k">next</span> {{ step.nextAction }}</div>
          </div>
        </div>
        <div v-if="sources && sources.length" class="agent-debug-block">
          <div v-for="(s, i) in sources" :key="`dbgsrc-${i}`" class="agent-debug-args">
            <span class="k">{{ s.kind || 'source' }}</span> {{ s.name }}<span v-if="s.ref" class="agent-debug-ref"> · {{ s.ref }}</span>
          </div>
        </div>
        <div v-if="summary" class="agent-debug-block agent-debug-args">
          <span class="k">turn</span> {{ summary.finalStatus }}
          <template v-if="summary.toolsUsedCount != null"> · tools={{ summary.toolsUsedCount }}</template>
          <template v-if="summary.sourcesUsedCount != null"> · sources={{ summary.sourcesUsedCount }}</template>
          <template v-if="summary.hadApproval != null"> · approval={{ summary.hadApproval }}</template>
          <template v-if="summary.hadFailures != null"> · failures={{ summary.hadFailures }}</template>
          <template v-if="summary.durationMs != null"> · {{ fmtDuration(summary.durationMs) }}</template>
        </div>
      </div>
    </details>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { fmtTokens } from '../composables/tokens'

const props = defineProps({
  statusLabel: { type: String, default: '' },
  steps: { type: Array, default: () => [] },
  sources: { type: Array, default: () => [] },
  summary: { type: Object, default: null },
  isComplete: { type: Boolean, default: false },
  hasFailures: { type: Boolean, default: false },
  running: { type: Boolean, default: false },
  // Builder/debug tier (emulator). When true, render the extra collapsible "Debug details" section
  // with the builder-only fields the backend sent. NEVER enable on the user/public tiers.
  debug: { type: Boolean, default: false },
  // Public tier (shared widget). Defense-in-depth: render ONLY friendly labels + status + source
  // names. Suppresses summary text, durations, counts, raw reason/next_action, and the debug section
  // even if the backend accidentally sent them. Always wins over `debug`.
  publicSafe: { type: Boolean, default: false },
  // Optional total token count for the "Done · N steps · Xs · Yk tokens" header (hosts pass the
  // turn's usage). Hidden on the public tier. null → the token chip is simply omitted.
  tokens: { type: Number, default: null },
  // Model reasoning items [{ label, text }] folded into this one panel (ChatGPT-style). Hosts derive
  // them from the activity via reasoningItems(). Empty/omitted → no reasoning section. Never on public.
  reasoning: { type: Array, default: () => [] },
})

// Collapsed by default once the turn is done (matches the legacy "Done · N steps" card); the user
// expands to see the full step detail. While running, rows are always shown.
const expanded = ref(false)

const show = computed(
  () =>
    (props.running && !!props.statusLabel) ||
    (props.steps && props.steps.length > 0) ||
    (props.sources && props.sources.length > 0) ||
    !!props.summary,
)

const hasDebug = computed(
  () => (props.steps && props.steps.length > 0) || (props.sources && props.sources.length > 0) || !!props.summary,
)

const summaryWarn = computed(() => {
  const s = props.summary
  return props.hasFailures || !!(s && (s.finalStatus === 'interrupted'))
})

// Collapsed-header headline (legacy "Done" wording). Public stays simple.
const doneLabel = computed(() => {
  const s = props.summary
  if (props.publicSafe) return (s && s.finalStatus === 'failed') ? 'Could not complete' : 'Completed'
  if (s && s.finalStatus === 'interrupted') return 'Interrupted — connection lost'
  if (s && s.finalStatus === 'failed') return 'Could not complete'
  return summaryWarn.value || props.hasFailures ? 'Completed with issues' : 'Done'
})

const durationText = computed(() => {
  const ms = props.summary && props.summary.durationMs
  return ms != null ? fmtDuration(ms) : ''
})

// ChatGPT-style collapsed headline. Normal completion → "Thought for {time}"; abnormal turns keep the
// clear status wording. Public stays simple.
const headLabel = computed(() => {
  const s = props.summary
  if (props.publicSafe) return doneLabel.value
  if (s && (s.finalStatus === 'interrupted' || s.finalStatus === 'failed')) return doneLabel.value
  if (summaryWarn.value || props.hasFailures) return doneLabel.value
  return durationText.value ? `Thought for ${durationText.value}` : 'Done'
})

const tokensText = computed(() =>
  props.tokens != null && props.tokens > 0 ? `${fmtTokens(props.tokens)} tokens` : '',
)

// Deduplicate display names (a single source may be cited with multiple refs).
const sourceNames = computed(() => {
  const seen = []
  for (const s of props.sources || []) {
    const name = s.name || s.kind
    if (name && !seen.includes(name)) seen.push(name)
  }
  return seen.join(', ')
})

function fmtDuration(ms) {
  if (ms == null) return ''
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
</script>

<style scoped>
.agent-timeline {
  @apply text-xs text-gray-500 my-1;
}

/* Live status line */
.agent-status-line {
  @apply flex items-center gap-2 text-gray-600 py-1;
}
.agent-status-label {
  @apply font-medium;
}

/* Spinner */
.agent-spinner {
  @apply inline-block w-3 h-3 rounded-full border-2 border-gray-300 border-t-blue-500;
  animation: agent-spin 0.7s linear infinite;
}
.agent-spinner.sm {
  @apply w-2.5 h-2.5 border;
}
@keyframes agent-spin {
  to {
    transform: rotate(360deg);
  }
}

/* Bordered card (legacy "Done · N steps" look) */
.at-card {
  @apply rounded-lg border border-gray-200 bg-slate-50/70;
}
.at-card.at-warn {
  @apply border-amber-200;
}
/* DONE header — clickable, collapses/expands the rows */
.at-head {
  @apply w-full flex items-center gap-2 px-3 py-2 text-[13px] text-gray-600 rounded-lg hover:bg-slate-100/60 select-none;
}
.at-check {
  @apply w-4 h-4 flex-shrink-0 text-emerald-500;
}
.at-check.warn {
  @apply text-amber-500;
}
.at-head-text {
  @apply text-left;
}
.at-chevron {
  @apply w-3.5 h-3.5 ml-auto text-gray-400 transition-transform;
}
.at-chevron.open {
  transform: rotate(180deg);
}
/* RUNNING header */
.at-head-live {
  @apply flex items-center gap-2 px-3 pt-2 pb-1 text-[12px] text-indigo-600;
}
.at-head-live .at-dot {
  @apply w-1.5 h-1.5 rounded-full bg-indigo-500;
  animation: agent-pulse 1.4s ease-in-out infinite;
}
.at-head-tok {
  @apply ml-auto text-gray-400 tabular-nums;
}
@keyframes agent-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

.agent-steps {
  @apply px-3 pt-1.5 pb-2 space-y-1.5;
}
/* When the card is collapsed→expanded (done), separate the rows from the header. */
.agent-steps.at-rows-done {
  @apply border-t border-gray-100;
}

/* Reasoning section (folded into the one panel) */
.at-reasoning {
  @apply px-3 pt-1.5 pb-2.5 space-y-2;
}
.at-reasoning.at-rows-done {
  @apply border-t border-gray-100;
}
.at-reason-phrase {
  @apply text-[12px] font-medium text-gray-600;
}
.at-reason-text {
  @apply mt-0.5 text-[12px] text-gray-500 italic whitespace-pre-wrap break-words;
}
.agent-step {
  @apply flex items-start gap-2;
}
.agent-step-icon {
  @apply flex items-center justify-center w-4 h-4 flex-shrink-0 mt-0.5 text-[10px] font-bold;
}
.agent-step-icon.icon-ok {
  @apply text-green-600;
}
.agent-step-icon.icon-failed {
  @apply text-red-500;
}
.agent-step-icon.icon-interrupted {
  @apply text-amber-500;
}
.agent-step-body {
  @apply flex-1 min-w-0;
}
.agent-step-head {
  @apply flex items-center justify-between gap-2;
}
.agent-step-label {
  @apply text-gray-700;
}
.agent-step-dur {
  @apply text-gray-400 tabular-nums flex-shrink-0;
}
.agent-step-detail {
  @apply text-gray-500 mt-0.5 break-words;
}
.agent-step-error {
  @apply text-red-500;
}
.agent-step-warn {
  @apply text-amber-600;
}
.agent-step-next {
  @apply text-gray-500 italic;
}

/* Turn summary */
.agent-summary {
  @apply flex items-center gap-1.5 mt-1.5 text-gray-500;
}
.agent-summary-dot {
  @apply inline-block w-1.5 h-1.5 rounded-full bg-green-500;
}
.agent-summary.has-warn .agent-summary-dot {
  @apply bg-amber-500;
}
.agent-summary-label {
  @apply font-medium text-gray-600;
}
.agent-summary-counts {
  @apply text-gray-400;
}

/* Sources footer */
.agent-sources {
  @apply mt-1.5 flex flex-wrap items-center gap-1;
}
.agent-sources-label {
  @apply text-gray-400;
}
.agent-sources-list {
  @apply text-gray-600 font-medium;
}

/* Builder/debug details (emulator only) */
.agent-debug {
  @apply mt-2 rounded-lg border border-slate-200 bg-slate-50/70;
}
.agent-debug-summary {
  @apply cursor-pointer select-none px-2 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-700;
}
.agent-debug-body {
  @apply px-2 pb-2 space-y-2;
}
.agent-debug-block {
  @apply space-y-1;
}
.agent-debug-step {
  @apply space-y-0.5;
}
.agent-debug-line {
  @apply flex items-center gap-2;
}
.agent-debug-tool {
  @apply font-mono text-[11px] text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded;
}
.agent-debug-status {
  @apply text-[10px] uppercase tracking-wide text-slate-400;
}
.agent-debug-status.s-failed {
  @apply text-red-500;
}
.agent-debug-status.s-ok {
  @apply text-green-600;
}
.agent-debug-dur {
  @apply text-[10px] text-slate-400 tabular-nums;
}
.agent-debug-args {
  @apply font-mono text-[11px] text-slate-500 break-all pl-1;
}
.agent-debug-args .k {
  @apply text-slate-400 mr-1;
}
.agent-debug-err {
  @apply text-red-500;
}
.agent-debug-ref {
  @apply text-slate-400;
}
</style>
