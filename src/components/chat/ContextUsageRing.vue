<template>
  <!-- How full the model's context window is, like Claude Code's ring. It shows the last measurement the run sent
       (`context_usage` frame, or the conversation's saved one) and nothing before there is one. Hover or focus shows
       the words; colour is never the only signal (from 85% of the auto-compact point the words say how much is left,
       as Claude Code's "Context left until auto-compact" does). The panel also carries "Compact now" (Claude Code's
       /compact) with an optional focus for the summary: it stays open while that runs and says what came of it. -->
  <span v-if="usage" class="cur" :class="['is-' + level, { 'is-open': running }]">
    <span class="cur-meter" :class="'is-' + level" tabindex="0" role="meter"
          :aria-valuenow="usage.percent" aria-valuemin="0" aria-valuemax="100"
          :aria-valuetext="summary" :aria-label="'Context window: ' + summary"
          data-test="context-usage-ring">
      <!-- A filled pie in a closed ring, as a gauge: a thin open arc beside Send read as a loading spinner while
           nothing ran (owner, 2026-11-25). The wedge is a circle of half the radius whose stroke is as wide as the
           radius, cut by its dash: the share used, from twelve o'clock. -->
      <svg viewBox="0 0 20 20" class="cur-svg" aria-hidden="true">
        <circle cx="10" cy="10" r="8" class="cur-track" />
        <circle cx="10" cy="10" r="3.5" class="cur-arc" :stroke-dasharray="dash" transform="rotate(-90 10 10)" />
      </svg>
    </span>
    <span class="cur-tip">
      <span class="cur-tip-head">{{ usage.percent }}% of context used</span>
      <span class="cur-tip-line">{{ fmtTokens(usage.used) }} of {{ fmtTokens(usage.window) }} tokens</span>
      <span v-if="usage.compactAt" class="cur-tip-line" :class="{ 'is-warn': level !== 'ok' }"
            data-test="compact-line">{{ compactLine }}</span>
      <label class="cur-focus">
        <span class="cur-focus-lbl">Focus on <span class="cur-focus-opt">(optional)</span></span>
        <input v-model="focus" type="text" class="cur-focus-input" data-test="compact-focus" name="compact-focus"
               :maxlength="FOCUS_MAX" autocomplete="off" spellcheck="true" placeholder="the checkout fix, for example…"
               :disabled="!canCompact" @keydown.enter.prevent="compact" />
      </label>
      <button type="button" class="cur-act" data-test="compact-now"
              :disabled="!canCompact" @click="compact">
        {{ running ? 'Compacting…' : 'Compact now' }}
      </button>
      <span v-if="chat.isStreaming && !running" class="cur-tip-note">Available when the reply has finished.</span>
      <span class="cur-tip-note" :class="{ 'is-err': failed }" role="status" aria-live="polite"
            data-test="compact-status">{{ statusLine }}</span>
    </span>
  </span>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useChatStore } from '../../stores/useChatStore'
import { fmtTokens } from '../../composables/tokens'

const chat = useChatStore()
const usage = computed(() => chat.contextUsage)
// The most the server takes as a focus (conversation_checkpoint.FOCUS_MAX_CHARS).
const FOCUS_MAX = 2000
// From this share of the auto-compact point the ring warns and says how much is left (owner, ADM-1301).
const WARN_SHARE = 0.85
const focus = ref('')

const CIRC = 2 * Math.PI * 3.5
const dash = computed(() => {
  const p = usage.value ? usage.value.percent : 0
  const on = (Math.max(p, p > 0 ? 3 : 0) / 100) * CIRC   // a sliver stays visible at 1-2%
  return `${on} ${CIRC}`
})

// The auto-compact point in tokens: the same number the run compacts at (the trigger over the window, as sent).
const trigger = computed(() => {
  const u = usage.value
  return u && u.compactAt ? (u.window * u.compactAt) / 100 : 0
})
// near = at or past 85% of the auto-compact point; full = at or past it.
const level = computed(() => {
  const u = usage.value
  if (!u || !trigger.value) return 'ok'
  if (u.used >= trigger.value) return 'full'
  if (u.used >= trigger.value * WARN_SHARE) return 'near'
  return 'ok'
})
const leftPercent = computed(() => (trigger.value
  ? Math.max(0, Math.min(100, Math.round((1 - usage.value.used / trigger.value) * 100))) : 0))

const compactLine = computed(() => {
  const u = usage.value
  if (level.value === 'full') return 'Auto-compacts on the next step'
  if (level.value === 'near') return `${leftPercent.value}% left until auto-compact`
  return `The earlier conversation is summarized at ${u.compactAt}%`
})

const summary = computed(() => {
  const u = usage.value
  if (!u) return ''
  return `${u.percent}% used, ${fmtTokens(u.used)} of ${fmtTokens(u.window)} tokens`
    + (u.compactAt ? `. ${compactLine.value}` : '')
})

// "Compact now": the server decides every refusal (a reply being written, too little to compact) and says it in words.
const running = computed(() => chat.compaction.status === 'running')
const failed = computed(() => chat.compaction.status === 'failed')
const canCompact = computed(() => !running.value && !chat.isStreaming && !!chat.conversationId)
function compact() {
  if (!canCompact.value) return
  const text = focus.value.trim()
  chat.compactNow(text)
  focus.value = ''
}
const statusLine = computed(() => {
  const c = chat.compaction
  if (c.status === 'running') return 'Summarizing the earlier conversation…'
  return c.message || ''
})
</script>

<style scoped>
.cur {
  position: relative; display: inline-grid; place-items: center; flex: 0 0 auto;
  width: 28px; height: 28px;
}
.cur-meter {
  display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 50%;
  cursor: default; outline: none;
}
.cur-meter:focus-visible { box-shadow: 0 0 0 2px var(--vm-focus); }
.cur-svg { width: 18px; height: 18px; }
.cur-track { fill: var(--vm-surface-soft); stroke: var(--vm-line-2); stroke-width: 1.5; }
.cur-arc { fill: none; stroke: var(--vm-ink-faint); stroke-width: 7; stroke-linecap: butt;
  transition: stroke-dasharray .3s ease, stroke .2s ease; }
.cur.is-near .cur-arc { stroke: var(--vm-amber-ink); }
.cur.is-full .cur-arc { stroke: var(--vm-red-ink); }

.cur-tip {
  position: absolute; bottom: calc(100% + 8px); right: -6px; z-index: 30;
  display: none; flex-direction: column; gap: 2px; min-width: 200px; max-width: 260px;
  padding: 8px 10px; border-radius: 10px; text-align: left; white-space: normal;
  background: var(--vm-surface); color: var(--vm-ink-soft); border: 1px solid var(--vm-line-2);
  box-shadow: 0 6px 20px rgba(15, 23, 42, .14); font-size: 0.75rem; line-height: 1.4;
  font-variant-numeric: tabular-nums;
}
/* The 8px between the ring and the panel is part of the hover, so the pointer can reach the button. */
.cur-tip::after { content: ''; position: absolute; left: 0; right: 0; top: 100%; height: 10px; }
.cur:hover .cur-tip, .cur:focus-within .cur-tip, .cur.is-open .cur-tip { display: flex; }
.cur-tip-head { color: var(--vm-ink); font-weight: 600; }
.cur.is-near .cur-tip-line.is-warn { color: var(--vm-amber-ink); font-weight: 600; }
.cur.is-full .cur-tip-line.is-warn { color: var(--vm-red-ink); font-weight: 600; }

.cur-focus { display: flex; flex-direction: column; gap: 3px; margin-top: 6px; }
.cur-focus-lbl { color: var(--vm-ink); font-weight: 600; }
.cur-focus-opt { color: var(--vm-ink-soft); font-weight: 400; }
.cur-focus-input {
  width: 100%; min-height: 30px; padding: 4px 8px; border-radius: 8px; box-sizing: border-box;
  border: 1px solid var(--vm-line-2); background: var(--vm-surface); color: var(--vm-ink);
  font: inherit; font-size: 0.8125rem; transition: border-color .15s ease, box-shadow .15s ease;
}
.cur-focus-input::placeholder { color: var(--vm-ink-faint); }
.cur-focus-input:focus-visible { outline: none; border-color: var(--vm-focus); box-shadow: 0 0 0 2px var(--vm-focus); }
.cur-focus-input:disabled { cursor: not-allowed; opacity: .6; }
/* A touch keyboard zooms into a field under 16px. */
@media (pointer: coarse) { .cur-focus-input { font-size: 16px; } }
.cur.is-near .cur-tip-head { color: var(--vm-amber-ink); }
.cur.is-full .cur-tip-head { color: var(--vm-red-ink); }
.cur-tip-note { color: var(--vm-ink-soft); overflow-wrap: anywhere; }
.cur-tip-note:empty { display: none; }
.cur-tip-note.is-err { color: var(--vm-red-ink); }

.cur-act {
  margin-top: 6px; align-self: flex-start; min-height: 28px; padding: 4px 10px; border-radius: 8px;
  border: 1px solid var(--vm-line-2); background: var(--vm-surface); color: var(--vm-ink);
  font: inherit; font-weight: 600; cursor: pointer; touch-action: manipulation;
  transition: background-color .15s ease, border-color .15s ease;
}
.cur-act:hover:not(:disabled) { background: var(--vm-line-2); }
.cur-act:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--vm-focus); }
.cur-act:disabled { cursor: not-allowed; opacity: .6; }

@media (prefers-reduced-motion: reduce) { .cur-arc, .cur-act, .cur-focus-input { transition: none; } }
</style>
