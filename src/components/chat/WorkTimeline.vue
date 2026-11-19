<template>
  <!-- A WORK turn, drawn like Claude Code's chat (ADM-1302): one continuous rail, a dot per row, every row in the
       order it happened. Narration and the answer are drawn by the host through the `text` slot (ChatMessage's own
       markdown, code copy and media), approvals and questions through `pending`. A plan is reviewed on its own
       card and followed on the task list, never drawn on the rail (PLAN_REVIEW_LIKE_CLAUDE_PLAN.md). -->
  <section class="wt" :class="{ 'wt-live': running }" aria-label="What the agent did" data-test="work-timeline">
    <ol class="wt-rail">
      <li v-for="r in rows" :key="r.key" class="wt-row" :class="`wt-${r.kind}`" data-test="wt-row" :data-kind="r.kind">
        <span class="wt-dot" :class="`is-${rowDot(r)}`" aria-hidden="true"></span>

        <!-- What the model wrote in this round, and the answer: the host's own rendering. -->
        <div v-if="r.kind === 'text' || r.kind === 'answer'" class="wt-body wt-textbody">
          <slot name="text" :text="r.kind === 'answer' ? '' : r.step.text" :answer="r.kind === 'answer'">
            <p class="wt-plain">{{ r.kind === 'answer' ? '' : r.step.text }}</p>
          </slot>
        </div>

        <!-- A thought: folded to "Thought for Ns", open to its words. -->
        <div v-else-if="r.kind === 'thought'" class="wt-body">
          <button type="button" class="wt-head wt-head-quiet" :aria-expanded="isOpen(r) ? 'true' : 'false'"
                  :aria-controls="`wt-p-${uid}-${r.key}`" data-test="wt-toggle" @click="toggle(r)">
            <span class="wt-thought-label">{{ thoughtLabel(r.step) }}</span>
            <svg class="wt-chev" :class="{ open: isOpen(r) }" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M7.3 5.3a1 1 0 0 1 1.4 0l4 4a1 1 0 0 1 0 1.4l-4 4a1 1 0 1 1-1.4-1.4L10.6 10 7.3 6.7a1 1 0 0 1 0-1.4Z" clip-rule="evenodd"/></svg>
          </button>
          <p v-if="isOpen(r) && r.step.hiddenThought" :id="`wt-p-${uid}-${r.key}`" class="wt-thought-text"
             data-test="wt-thought-text">This model keeps its reasoning private, so only how long it thought is shown.</p>
          <div v-else-if="isOpen(r)" :id="`wt-p-${uid}-${r.key}`" class="wt-thought-text" data-test="wt-thought-text"
               v-html="renderInlineMarkdown(stripThinkTags(r.step.reasoningText))"></div>
        </div>

        <!-- A tool call or a subagent: the name in bold and what it did; under it the start of its IN and OUT (a few
             faded lines, as Claude Code shows them), whole once opened. A Read shows its path alone. -->
        <div v-else-if="r.kind === 'tool' || r.kind === 'subagent'" class="wt-body">
          <button type="button" class="wt-head" :aria-expanded="isOpen(r) ? 'true' : 'false'"
                  :aria-controls="`wt-p-${uid}-${r.key}`" data-test="wt-toggle" @click="toggle(r)">
            <span class="wt-name" translate="no">{{ toolName(r.step) }}</span>
            <span class="wt-desc" :class="{ 'is-path': !showsPreview(r.step) }" translate="no" :title="toolDescription(r.step)">{{ toolDescription(r.step) }}</span>
            <span v-if="r.step.durationMs != null && r.step.durationMs >= 1000" class="wt-dur">{{ fmtSeconds(r.step.durationMs) }}</span>
            <svg class="wt-chev" :class="{ open: isOpen(r) }" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M7.3 5.3a1 1 0 0 1 1.4 0l4 4a1 1 0 0 1 0 1.4l-4 4a1 1 0 1 1-1.4-1.4L10.6 10 7.3 6.7a1 1 0 0 1 0-1.4Z" clip-rule="evenodd"/></svg>
          </button>
          <p v-if="r.step.status === 'failed' && r.step.reason" class="wt-note wt-note-err">{{ r.step.reason }}<template v-if="r.step.nextAction">. {{ r.step.nextAction }}</template></p>
          <p v-else-if="r.step.status === 'held' && r.step.reason" class="wt-note">{{ r.step.reason }}</p>
          <p v-else-if="r.step.status === 'interrupted'" class="wt-note">{{ r.step.reason || 'Stopped before it finished.' }}</p>

          <!-- What the subagent used, nested under it. -->
          <ul v-if="r.kind === 'subagent' && subagentChildren(r.step).length" class="wt-children" data-test="wt-children">
            <li v-for="c in subagentChildren(r.step)" :key="c.key" class="wt-child">
              <span class="wt-dot wt-dot-sm" :class="c.failed ? 'is-failed' : 'is-done'" aria-hidden="true"></span>
              <span class="wt-name" translate="no">{{ c.name }}</span>
            </li>
          </ul>

          <div v-if="r.step.media && r.step.media.length" class="wt-media">
            <MediaThumb v-for="(m, i) in r.step.media" :key="`${r.key}-m${i}`" :item="m" :src="m.url" alt="What this step made"
                        class="wt-media-thumb" />
          </div>

          <!-- Open: IN and OUT whole (a long one scrolls in its box; nothing is cut). -->
          <div v-if="isOpen(r)" :id="`wt-p-${uid}-${r.key}`" class="wt-io" data-test="wt-io" data-open="true">
            <p v-if="ioState(r).loading" class="wt-io-msg" role="status">Loading…</p>
            <p v-else-if="ioState(r).error" class="wt-io-msg wt-note-err" role="alert">{{ ioState(r).error }}</p>
            <template v-else>
              <div class="wt-io-row">
                <span class="wt-io-label" aria-hidden="true">IN</span>
                <pre class="wt-pre" tabindex="0" translate="no" aria-label="Input" data-test="wt-in">{{ inText(r) || 'Not shown for this call.' }}</pre>
                <button v-if="inText(r)" type="button" class="wt-copy" aria-label="Copy the input" @click="copy(inText(r), `${r.key}-in`)">{{ copied === `${r.key}-in` ? 'Copied' : 'Copy' }}</button>
              </div>
              <div class="wt-io-row">
                <span class="wt-io-label" aria-hidden="true">OUT</span>
                <div class="wt-io-out">
                  <pre v-if="diffLines(withIo(r)).length" class="wt-pre wt-diff" tabindex="0" translate="no" aria-label="Changes" data-test="wt-diff"><span
                    v-for="(d, i) in diffLines(withIo(r))" :key="i" class="wt-diff-line" :class="diffClass(d.sign)">{{ d.sign === '@' ? d.text : `${d.sign} ${d.text}` }}
</span></pre>
                  <pre class="wt-pre" tabindex="0" translate="no" aria-label="Output" data-test="wt-out">{{ outText(r) || (r.step.status === 'running' ? 'Running…' : 'No output.') }}</pre>
                </div>
                <button v-if="outText(r)" type="button" class="wt-copy" aria-label="Copy the output" @click="copy(outText(r), `${r.key}-out`)">{{ copied === `${r.key}-out` ? 'Copied' : 'Copy' }}</button>
              </div>
            </template>
          </div>
          <!-- Closed: the start of IN and OUT, fading out. A click on it opens the row (the header is the keyboard's
               way in, so this preview is not a second button). -->
          <div v-else-if="showsPreview(r.step) && (inPreview(r) || outPreview(r))" class="wt-io is-closed"
               data-test="wt-preview" aria-hidden="true" @click="toggle(r)">
            <div v-if="inPreview(r)" class="wt-io-row">
              <span class="wt-io-label">IN</span>
              <pre class="wt-pre" translate="no">{{ inPreview(r) }}</pre>
            </div>
            <div v-if="outPreview(r)" class="wt-io-row">
              <span class="wt-io-label">OUT</span>
              <pre class="wt-pre" translate="no">{{ outPreview(r) }}</pre>
            </div>
          </div>
        </div>

        <!-- A message the person sent while the run worked, taken in here. -->
        <p v-else-if="r.kind === 'steer'" class="wt-body wt-steer"><span class="wt-steer-by">You added:</span> {{ r.step.label }}</p>

        <!-- The earlier conversation summarized to fit the context window. -->
        <p v-else-if="r.kind === 'compaction'" class="wt-body wt-compact" data-test="wt-compaction">{{ r.step.label }}</p>

      </li>

      <!-- Approvals and questions for this turn, on its rail. -->
      <li v-if="$slots.pending" class="wt-row wt-pending" data-test="wt-row" data-kind="pending">
        <span class="wt-dot is-waiting" aria-hidden="true"></span>
        <div class="wt-body"><slot name="pending" /></div>
      </li>
    </ol>

    <!-- What it is doing now, how long it has taken, and its tokens ("Inferring… (12s · 3.4k tokens)"). -->
    <!-- Only the label is announced: the elapsed time changes every second and would be read out each time. -->
    <div v-if="running" class="wt-status" data-test="wt-status">
      <svg class="wt-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/></svg>
      <span class="wt-status-label" role="status" aria-live="polite">{{ statusText }}</span>
      <span class="wt-status-meta">({{ elapsed }}<template v-if="tokensText"> · {{ tokensText }}</template>)</span>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import api from '../../services/api'
import MediaThumb from '../common/MediaThumb.vue'
import { fmtTokens } from '../../composables/tokens'
import { stripThinkTags } from '../../composables/useAgentTimeline'
import { renderInlineMarkdown } from '../../utils/inlineMarkdown'
import {
  workRows, toolName, toolDescription, ioText, outputText, diffLines, dotState, thoughtLabel, subagentChildren, needsLoad,
  elapsedText, showsPreview,
} from './workRail'

const props = defineProps({
  steps: { type: Array, default: () => [] },
  // The turn ended (its answer, its error, or a stop): the answer is the last row and nothing runs.
  finished: { type: Boolean, default: false },
  // The turn has an answer to show (the host draws it in the `text` slot).
  hasAnswer: { type: Boolean, default: false },
  // The live status line: shown while the turn works.
  running: { type: Boolean, default: false },
  statusLabel: { type: String, default: '' },
  tokens: { type: Number, default: null },
  startedAt: { type: Number, default: null },
  // The conversation, for loading a long IN/OUT by its ref.
  conversationId: { type: [String, Number], default: '' },
  // The turn's plan card has no place among the rows (a snapshot saved without it): drawn first.
})

// The ids that tie a row's button to its panel (`aria-controls`), unique per timeline on the page.
const uid = `wt${Math.random().toString(36).slice(2, 8)}`

const rows = computed(() => workRows(props.steps, { finished: props.finished, hasAnswer: props.hasAnswer }))

function rowDot(r) {
  if (r.kind === 'text' || r.kind === 'answer' || r.kind === 'steer' || r.kind === 'compaction') {
    return r.kind === 'steer' ? 'steer' : 'quiet'
  }
  if (r.kind === 'thought') return r.step.status === 'running' ? 'running' : 'quiet'
  return dotState(r.step)
}

// Which rows are open. Keyed by the row, so a live row stays open as it updates.
const open = reactive({})
function isOpen(r) { return !!open[r.key] }
function toggle(r) {
  open[r.key] = !open[r.key]
  if (open[r.key] && (r.kind === 'tool' || r.kind === 'subagent') && needsLoad(r.step)) loadIo(r)
}

// A long IN or OUT the saved timeline kept as its ref: loaded whole from the server on expand (owner only).
const loaded = reactive({})
function ioState(r) { return loaded[r.key] || {} }
async function loadIo(r) {
  const cur = loaded[r.key]
  if (cur && (cur.loading || cur.done)) return
  loaded[r.key] = { loading: true }
  try {
    const res = await api.get(`/conversations/${props.conversationId}/tool-result/`, { params: { ref: r.step.ioRef } })
    const d = (res && res.data) || {}
    loaded[r.key] = { done: true, input: d.input, output: d.output }
  } catch (e) {
    const status = e && e.response && e.response.status
    loaded[r.key] = { error: status === 404 ? 'This call\'s full text is no longer kept.' : 'The full text could not be loaded. Close and open the row to try again.' }
  }
}
// The row with what was loaded for it.
function withIo(r) {
  const l = loaded[r.key]
  if (!l || !l.done) return r.step
  return { ...r.step, input: r.step.input != null ? r.step.input : l.input,
           output: r.step.output != null ? r.step.output : l.output }
}
function inText(r) { return ioText(withIo(r).input) }
function outText(r) {
  const s = withIo(r)
  if (s.output != null && s.output !== '') return outputText(s.output)
  return s.error ? ioText(s.error) : ''
}
// A closed row's preview: what is held in the page (the whole text, or the saved head of a long one), shown a few
// lines deep by the style. Nothing is fetched for a preview.
function inPreview(r) { return inText(r) || ioText(r.step.inputHead) }
function outPreview(r) {
  const t = outText(r) || ioText(r.step.outputHead)
  return t || (r.step.status === 'running' ? 'Running…' : '')
}
function diffClass(sign) {
  return sign === '+' ? 'is-add' : sign === '-' ? 'is-del' : sign === '@' ? 'is-hunk' : ''
}

const copied = ref('')
async function copy(text, key) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = key
    setTimeout(() => { if (copied.value === key) copied.value = '' }, 1500)
  } catch { /* clipboard blocked: nothing to say */ }
}

function fmtSeconds(ms) {
  const s = ms / 1000
  return s < 10 ? `${s.toFixed(1)}s` : `${Math.round(s)}s`
}

// The live status line.
const now = ref(Date.now())
let timer = null
function startTimer() { if (!timer) timer = setInterval(() => { now.value = Date.now() }, 1000) }
function stopTimer() { if (timer) { clearInterval(timer); timer = null } }
watch(() => props.running, (on) => { if (on) startTimer(); else stopTimer() }, { immediate: true })
onBeforeUnmount(stopTimer)
const elapsed = computed(() => elapsedText(props.startedAt ? now.value - props.startedAt : 0))
const statusText = computed(() => {
  const t = String(props.statusLabel || '').trim().replace(/…+$|\.+$/, '')
  return `${t || 'Working'}…`
})
const tokensText = computed(() => (props.tokens != null && props.tokens > 0 ? `${fmtTokens(props.tokens)} tokens` : ''))
</script>

<style scoped>
.wt { margin: 2px 0 4px; color: var(--vm-ink); font-size: 13.5px; line-height: 1.55; }
.wt-rail { position: relative; list-style: none; margin: 0; padding: 0 0 0 22px; }
/* The one continuous line every dot sits on. */
.wt-rail::before { content: ''; position: absolute; left: 6.5px; top: 10px; bottom: 10px; width: 1px; background: var(--vm-line-2); }
.wt-row { position: relative; padding: 3px 0; min-width: 0; }
.wt-row + .wt-row { margin-top: 10px; }
/* Each dot sits ON the line (opaque, so the line passes behind it on any surface it is drawn on). */
.wt-dot { position: absolute; left: -19px; top: 11px; width: 8px; height: 8px; border-radius: 50%; background: var(--vm-ink-faint); }
.wt-row.wt-text .wt-dot, .wt-row.wt-answer .wt-dot { top: 12px; }
.wt-dot-sm { position: static; display: inline-block; width: 6px; height: 6px; box-shadow: none; flex: 0 0 auto; }
.wt-dot.is-done { background: var(--vm-green); }
.wt-dot.is-failed { background: var(--vm-red-ink); }
.wt-dot.is-waiting { background: var(--vm-amber); }
.wt-dot.is-notrun { background: var(--vm-line-2); box-shadow: inset 0 0 0 1.5px var(--vm-ink-faint); }
.wt-dot.is-quiet { width: 7px; height: 7px; left: -18.5px; background: var(--vm-ink-faint); opacity: .6; }
.wt-dot.is-steer { background: var(--vm-link); }
.wt-dot.is-running { background: var(--vm-violet); animation: wt-pulse 1.4s ease-in-out infinite; }
@keyframes wt-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .4; } }

.wt-body { min-width: 0; }
.wt-plain { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }

/* A row's header: one line, the whole row is the button. */
.wt-head { display: flex; align-items: baseline; gap: 8px; width: 100%; min-height: 30px; padding: 4px 6px; margin-left: -6px;
  border: 0; border-radius: 8px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer;
  transition: background-color .15s; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
.wt-head:hover { background: color-mix(in srgb, var(--vm-ink) 5%, transparent); }
.wt-head:focus-visible { outline: 2px solid var(--vm-focus, var(--vm-violet)); outline-offset: 1px; }
.wt-head-quiet { color: var(--vm-ink-faint); }
.wt-name { flex: 0 0 auto; font-weight: 650; color: var(--vm-ink); font-size: 13px; }
.wt-desc { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--vm-ink-soft);
  font-family: var(--vm-font-mono, ui-monospace, monospace); font-size: 12.5px; }
.wt-desc.is-path { color: var(--vm-link); }
.wt-dur { flex: 0 0 auto; color: var(--vm-ink-faint); font-size: 12px; font-variant-numeric: tabular-nums; }
.wt-chev { flex: 0 0 auto; align-self: center; width: 14px; height: 14px; color: var(--vm-ink-faint); transition: transform .15s; }
.wt-chev.open { transform: rotate(90deg); }
.wt-thought-label { font-size: 13px; }
.wt-thought-text { margin: 2px 0 4px; padding-left: 2px; color: var(--vm-ink-soft); font-size: 13px; white-space: pre-wrap;
  overflow-wrap: anywhere; }

.wt-note { margin: 2px 0 0; font-size: 12.5px; color: var(--vm-ink-soft); overflow-wrap: anywhere; }
.wt-note-err { color: var(--vm-red-ink); }

/* IN and OUT: ONE box, a narrow gutter naming each part (as Claude Code draws it), monospace. Closed, each part shows
   its first lines fading out; open, the whole text, a long one scrolling inside its part. Nothing is cut. */
.wt-io { margin: 6px 0 2px; border: 1px solid var(--vm-line); border-radius: 8px; background: var(--vm-surface-soft);
  overflow: hidden; }
.wt-io-row { position: relative; display: grid; grid-template-columns: 38px minmax(0, 1fr); align-items: start; }
.wt-io-row + .wt-io-row { border-top: 1px solid var(--vm-line); }
.wt-io-label { padding: 7px 0 0 10px; font: 600 10.5px/1.5 var(--vm-font-mono, ui-monospace, monospace); letter-spacing: .04em;
  color: var(--vm-ink-faint); user-select: none; }
.wt-io-out { min-width: 0; }
.wt-io-msg { margin: 0; padding: 8px 12px; font-size: 12.5px; color: var(--vm-ink-soft); }
.wt-pre { margin: 0; padding: 6px 12px 6px 2px; max-height: 360px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere;
  font: 12px/1.5 var(--vm-font-mono, ui-monospace, monospace); color: var(--vm-ink); background: transparent; }
.wt-pre:focus-visible { outline: 2px solid var(--vm-focus, var(--vm-violet)); outline-offset: -2px; }
/* Closed: three lines, fading out; the whole box opens the row. */
.wt-io.is-closed { cursor: pointer; }
.wt-io.is-closed .wt-pre { max-height: calc(12px * 1.5 * 3 + 12px); overflow: hidden; color: var(--vm-ink-soft);
  -webkit-mask-image: linear-gradient(to bottom, #000 45%, transparent); mask-image: linear-gradient(to bottom, #000 45%, transparent); }
.wt-io.is-closed:hover { border-color: var(--vm-line-2); }
/* Copy: shown on hover or focus, always on touch. */
.wt-copy { position: absolute; top: 3px; right: 4px; min-height: 26px; padding: 0 9px; border: 1px solid var(--vm-line);
  border-radius: 6px; background: var(--vm-surface); color: var(--vm-ink-soft); font: 600 11.5px var(--vm-font-sans, inherit);
  cursor: pointer; opacity: 0; transition: opacity .15s, background-color .15s, color .15s;
  touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
.wt-io-row:hover .wt-copy, .wt-io-row:focus-within .wt-copy { opacity: 1; }
.wt-copy:hover { color: var(--vm-ink); }
.wt-copy:focus-visible { opacity: 1; outline: 2px solid var(--vm-focus, var(--vm-violet)); outline-offset: 1px; }
.wt-diff { border-bottom: 1px solid var(--vm-line); }
.wt-diff-line { display: block; }
.wt-diff-line.is-add { color: var(--vm-green-ink); background: var(--vm-green-soft); }
.wt-diff-line.is-del { color: var(--vm-red-ink); background: var(--vm-red-soft); }
.wt-diff-line.is-hunk { color: var(--vm-ink-faint); }

.wt-children { list-style: none; margin: 2px 0 2px 4px; padding: 0 0 0 12px; border-left: 1px solid var(--vm-line-2);
  display: flex; flex-direction: column; gap: 3px; }
.wt-child { display: flex; align-items: center; gap: 8px; font-size: 12.5px; }
.wt-child .wt-name { font-weight: 600; font-size: 12.5px; }

.wt-media { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0; }
.wt-media-thumb { width: 96px; height: 96px; object-fit: cover; border-radius: 8px; border: 1px solid var(--vm-line); }

.wt-steer { margin: 0; color: var(--vm-ink); overflow-wrap: anywhere; }
.wt-steer-by { font-weight: 600; color: var(--vm-link); }
.wt-compact { margin: 0; font-style: italic; color: var(--vm-ink-soft); }

/* Approvals and questions sit IN the rail as a card of their own (HITLModal inline, PermissionCard). */
.wt-pending .wt-body { display: flex; flex-direction: column; gap: 8px; }
.wt-pending :deep(.hitl-overlay--inline) { position: static; inset: auto; display: block; padding: 0; background: transparent; z-index: auto; }
.wt-pending :deep(.hitl-modal) { width: 100%; min-width: 0; max-width: 100%; max-height: none; }

/* The live status line, under the last row. */
.wt-status { display: flex; align-items: center; gap: 7px; margin: 6px 0 2px 1px; color: var(--vm-ink-soft); font-size: 13px; }
.wt-glyph { width: 13px; height: 13px; color: var(--vm-violet); animation: wt-spin 2.4s linear infinite; flex: 0 0 auto; }
.wt-status-label { color: var(--vm-ink); }
.wt-status-meta { color: var(--vm-ink-faint); font-variant-numeric: tabular-nums; }
@keyframes wt-spin { to { transform: rotate(360deg); } }

@media (pointer: coarse) {
  .wt-head { min-height: 44px; }
  .wt-copy { min-height: 44px; min-width: 44px; opacity: 1; }
}
/* The open row's text keeps clear of its Copy button. */
.wt-io-row:has(.wt-copy) .wt-pre { padding-right: 64px; }
@media (prefers-reduced-motion: reduce) {
  .wt-dot.is-running, .wt-glyph { animation: none; }
  .wt-head, .wt-chev, .wt-copy { transition: none; }
}
</style>
