<template>
  <!-- How full the model's context window is, like Claude Code's ring. It shows the last measurement the run sent
       (`context_usage` frame, or the conversation's saved one) and nothing before there is one. Hover or focus shows
       the words; colour is never the only signal (the words say "summarizes soon" too). The panel also carries
       "Compact now" (Claude Code's /compact): it stays open while that runs and says what came of it. -->
  <span v-if="usage" class="cur" :class="['is-' + level, { 'is-open': running }]">
    <span class="cur-meter" :class="'is-' + level" tabindex="0" role="meter"
          :aria-valuenow="usage.percent" aria-valuemin="0" aria-valuemax="100"
          :aria-valuetext="summary" :aria-label="'Context window: ' + summary"
          data-test="context-usage-ring">
      <svg viewBox="0 0 20 20" class="cur-svg" aria-hidden="true">
        <circle cx="10" cy="10" r="7.5" class="cur-track" />
        <circle cx="10" cy="10" r="7.5" class="cur-arc" :stroke-dasharray="dash" transform="rotate(-90 10 10)" />
      </svg>
    </span>
    <span class="cur-tip">
      <span class="cur-tip-head">{{ usage.percent }}% of context used</span>
      <span class="cur-tip-line">{{ fmtTokens(usage.used) }} of {{ fmtTokens(usage.window) }} tokens</span>
      <span v-if="usage.compactAt" class="cur-tip-line">{{ compactLine }}</span>
      <button type="button" class="cur-act" data-test="compact-now"
              :disabled="!canCompact" @click="chat.compactNow()">
        {{ running ? 'Compacting…' : 'Compact Now' }}
      </button>
      <span v-if="chat.isStreaming && !running" class="cur-tip-note">Available when the reply has finished.</span>
      <span class="cur-tip-note" :class="{ 'is-err': failed }" role="status" aria-live="polite"
            data-test="compact-status">{{ statusLine }}</span>
    </span>
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { useChatStore } from '../../stores/useChatStore'
import { fmtTokens } from '../../composables/tokens'

const chat = useChatStore()
const usage = computed(() => chat.contextUsage)

const CIRC = 2 * Math.PI * 7.5
const dash = computed(() => {
  const p = usage.value ? usage.value.percent : 0
  const on = (Math.max(p, p > 0 ? 3 : 0) / 100) * CIRC   // a sliver stays visible at 1-2%
  return `${on} ${CIRC}`
})

// near = within 10 points of the summarize point; full = at or past it.
const level = computed(() => {
  const u = usage.value
  if (!u || !u.compactAt) return 'ok'
  if (u.percent >= u.compactAt) return 'full'
  if (u.percent >= u.compactAt - 10) return 'near'
  return 'ok'
})

const compactLine = computed(() => {
  const u = usage.value
  if (level.value === 'full') return 'The earlier conversation is summarized on the next step'
  if (level.value === 'near') return `The earlier conversation is summarized soon, at ${u.compactAt}%`
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
.cur-track { fill: none; stroke: var(--vm-line-2); stroke-width: 2.5; }
.cur-arc { fill: none; stroke: var(--vm-ink-faint); stroke-width: 2.5; stroke-linecap: round;
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

@media (prefers-reduced-motion: reduce) { .cur-arc, .cur-act { transition: none; } }
</style>
