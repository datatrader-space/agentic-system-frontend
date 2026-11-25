<!--
  BackgroundTaskCard: one background task as Claude Code's background-tasks sheet shows it (ADM-1360 release,
  CODING_AGENT_BACKGROUND_WORK_PLAN.md section 3). A card, not a row of buttons: the whole card opens the task (the
  drawer, or a workflow run's page); a small round Stop sits top right while it runs.
    - panel: the kind's icon (a blue dot for a running workflow or agent), the name (two lines at most, cut by CSS), the
      kind word and the live elapsed time or the result word, "Needs you" when an agent waits on the person, then
      "N agents · 1.9M tokens", the description, the last output line (a command or monitor) and the Phases: each with
      its done/total, a row of progress squares and a table of its agents (Agent · Tokens · Time) behind a chevron.
    - chat: the compact card the chat shows when a task starts: name, kind word, agents, time and one row of squares.
  Every value comes from the task the server sends; what is absent is not drawn. Lazy (with the list or the chat).
-->
<template>
  <article class="bgc" :class="[variant, toneOf(task), { running }]" :data-test="`bgc-${task.id}`" :data-kind="task.kind">
    <div class="bgc-head">
      <span v-if="liveDot" class="bgc-dot" aria-hidden="true"></span>
      <span v-else class="bgc-ic" aria-hidden="true"><Icon :icon="kindIcon(task.kind)" /></span>
      <div class="bgc-main">
        <a v-if="isLink" class="bgc-open" :href="workflowRunHref(task)" target="_blank" rel="noopener noreferrer"
           :aria-label="openLabel(task)" data-test="bgc-open">{{ task.name || 'Background task' }}</a>
        <button v-else type="button" class="bgc-open" :aria-label="openLabel(task)" data-test="bgc-open" @click="open">
          {{ task.name || 'Background task' }}
        </button>
        <!-- One line of words with real spaces between them (read aloud and copied as words, not run together). -->
        <p class="bgc-meta" data-test="bgc-meta"><span class="bgc-kind">{{ kindWord(task.kind) }}</span>{{ ' ' }}<template v-for="s in metaStats" :key="s.word"><span><b>{{ s.n }}</b> {{ s.word }}</span>{{ ' ' }}</template><span class="bgc-status" data-test="bgc-status">{{ statusText(task, now) }}</span><template v-if="needsPerson(task)">{{ ' ' }}<span class="bgc-needs" data-test="bgc-needs">Needs you</span></template></p>
      </div>
      <Icon v-if="variant === 'chat'" icon="lucide:chevron-right" class="bgc-chev" aria-hidden="true" />
      <button v-else-if="running && ctl" type="button" class="bgc-stop" data-test="bgc-stop"
              :disabled="!!ctl.stopping" :aria-busy="stoppingThis ? 'true' : 'false'"
              :aria-label="`Stop ${task.name || 'the task'}`" :title="stoppingThis ? 'Stopping…' : 'Stop'" @click="stop">
        <Icon :icon="stoppingThis ? 'lucide:loader-2' : 'lucide:circle-stop'" :class="{ spin: stoppingThis }" aria-hidden="true" />
      </button>
    </div>

    <div class="bgc-body">
      <p v-if="variant === 'panel' && stats.length" class="bgc-stats" data-test="bgc-stats">
        <template v-for="(s, i) in stats" :key="s.word"><template v-if="i">{{ ' ' }}</template><span><b>{{ s.n }}</b> {{ s.word }}</span></template>
      </p>
      <p v-if="variant === 'panel' && task.description" class="bgc-desc" data-test="bgc-desc">{{ task.description }}</p>
      <code v-if="showsOutput(task) && lastLine" class="bgc-tail" translate="no" :title="lastLine" data-test="bgc-tail">{{ lastLine }}</code>
      <p v-if="ctl && ctl.stopErrors[String(task.id)]" class="bgc-err" role="alert" data-test="bgc-stop-err">{{ ctl.stopErrors[String(task.id)] }}</p>

      <!-- The chat card: every agent of every phase in one row of squares. -->
      <div v-if="variant === 'chat' && items.length" class="bgc-sq" role="img" :aria-label="progressSummary(task)" data-test="bgc-squares">
        <span v-for="(it, i) in items" :key="i" class="sq" :class="itemState(it)"></span>
      </div>

      <!-- The panel card: its phases. -->
      <section v-if="variant === 'panel' && hasPhases(task)" class="bgc-phases" :aria-labelledby="`${uid}-ph`" data-test="bgc-phases">
        <p :id="`${uid}-ph`" class="bgc-ph-h">Phases</p>
        <div v-for="(ph, pi) in task.progress.phases" :key="pi" class="bgc-ph" :data-test="`bgc-phase-${pi}`">
          <div class="bgc-ph-head">
            <span class="bgc-ph-t">{{ ph.title || `Phase ${pi + 1}` }}</span>
            <span class="bgc-ph-n" data-test="bgc-phase-count">{{ phaseCounts(ph).done }}/{{ phaseCounts(ph).total }}</span>
            <button type="button" class="bgc-ph-tg" :disabled="!itemsOf(ph).length"
                    :aria-expanded="isOpen(pi, ph) ? 'true' : 'false'" :aria-controls="`${uid}-t${pi}`"
                    :aria-label="`${isOpen(pi, ph) ? 'Hide' : 'Show'} the agents of ${ph.title || `phase ${pi + 1}`}`"
                    data-test="bgc-phase-toggle" @click="toggle(pi, ph)">
              <Icon :icon="isOpen(pi, ph) ? 'lucide:chevron-down' : 'lucide:chevron-right'" aria-hidden="true" />
            </button>
          </div>
          <div v-if="squaresOf(ph).length" class="bgc-sq" role="img" :aria-label="phaseSummary(ph)" data-test="bgc-phase-squares">
            <span v-for="(st, si) in squaresOf(ph)" :key="si" class="sq" :class="st"></span>
          </div>
          <table v-if="isOpen(pi, ph)" :id="`${uid}-t${pi}`" class="bgc-tbl" data-test="bgc-phase-table">
            <thead><tr><th scope="col">Agent</th><th scope="col">Tokens</th><th scope="col">Time</th></tr></thead>
            <tbody>
              <tr v-for="(it, ii) in itemsOf(ph)" :key="ii" :class="itemState(it)">
                <td class="ag" :title="it.label">{{ it.label }}</td>
                <td>{{ it.tokens != null && it.tokens !== '' ? tokens(it.tokens) : '' }}</td>
                <td>{{ itemState(it) === 'done' || itemState(it) === 'failed' ? (it.seconds != null ? duration(it.seconds) : '') : '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </article>
</template>

<script setup>
import { computed, inject, ref, useId } from 'vue'
import { Icon } from '@iconify/vue'
import { BACKGROUND_TASKS } from '@/stores/useBackgroundTasks'
import { useClock } from '@/composables/useClock'
import {
  allItems, duration, hasPhases, itemState, kindIcon, kindWord, needsPerson, openLabel, openType, phaseCounts,
  phaseSummary, progressSummary, showsOutput, statsOf, statusText, toneOf, tokens,
} from './backgroundTaskText'
import { openTask, stopWithConfirm, workflowRunHref } from './backgroundTaskActions'

const props = defineProps({
  task: { type: Object, required: true },
  // 'panel' (the sheet and the bottom panel's tab) or 'chat' (the compact card in the chat).
  variant: { type: String, default: 'panel' },
})
const emit = defineEmits(['opened'])
const ctl = inject(BACKGROUND_TASKS, null)
const now = useClock()
const uid = useId()

const running = computed(() => props.task.state === 'running')
const liveDot = computed(() => running.value && (props.task.kind === 'workflow' || props.task.kind === 'subagent'))
const isLink = computed(() => openType(props.task) === 'workflow_run' && !!workflowRunHref(props.task))
const stoppingThis = computed(() => !!ctl && ctl.stopping === String(props.task.id))
const stats = computed(() => statsOf(props.task))
const items = computed(() => allItems(props.task))
// The chat card's meta line names its agents too.
const metaStats = computed(() => (props.variant === 'chat' ? stats.value.filter((x) => x.word.startsWith('agent')) : []))
// The last output line: the server's `tail_line`, else the last line of its tail. Shown whole; CSS cuts it.
const lastLine = computed(() => {
  if (props.task.tail_line) return String(props.task.tail_line)
  const lines = String(props.task.output_tail || '').split(/\r?\n/).filter((l) => l.trim())
  return lines.length ? lines[lines.length - 1] : ''
})

const itemsOf = (ph) => (Array.isArray(ph?.items) ? ph.items : [])
// One square per agent; a phase the server sent only counts for: its done ones filled, the rest waiting.
function squaresOf(ph) {
  const list = itemsOf(ph)
  if (list.length) return list.map(itemState)
  const c = phaseCounts(ph)
  return Array.from({ length: Math.max(0, c.total) }, (_, i) => (i < c.done ? 'done' : 'pending'))
}
// A phase with agents shows its table until the person closes it (as Claude Code's do); one without has none.
const closed = ref(new Set())
const isOpen = (pi, ph) => itemsOf(ph).length > 0 && !closed.value.has(pi)
function toggle(pi, ph) {
  if (!itemsOf(ph).length) return
  const next = new Set(closed.value)
  if (next.has(pi)) next.delete(pi)
  else next.add(pi)
  closed.value = next
}

function open() {
  openTask(ctl, props.task)
  emit('opened', props.task)
}
function stop() { return stopWithConfirm(ctl, props.task) }
</script>

<style scoped>
.bgc {
  position: relative; padding: 12px 12px 12px 14px; border: 1px solid var(--vm-line); border-radius: 14px;
  background: var(--vm-surface-soft); color: var(--vm-ink); font: 13px/1.45 var(--vm-font-sans); min-width: 0;
  transition: border-color .15s;
}
.bgc:hover { border-color: var(--vm-line-2); }
.bgc.chat { max-width: min(440px, 100%); }
.bgc-head { display: flex; align-items: flex-start; gap: 10px; min-width: 0; }
.bgc-ic { flex: 0 0 auto; display: grid; place-items: center; width: 20px; height: 20px; margin-top: 1px; color: var(--vm-ink-soft); }
.bgc-ic :deep(svg) { width: 16px; height: 16px; }
.bgc-dot { flex: 0 0 auto; width: 9px; height: 9px; margin: 6px 5px 0 6px; border-radius: 50%; background: var(--vm-link); }
.bgc-main { flex: 1 1 auto; min-width: 0; }
/* The name opens the card: its hit area is the whole card (the stop button and the phase controls sit above it). */
.bgc-open {
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden;
  margin: 0; padding: 0; border: none; background: none; color: inherit; text-align: left; text-decoration: none;
  font: 600 14px/1.35 var(--vm-font-sans); overflow-wrap: anywhere; cursor: pointer; touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.bgc-open::after { content: ''; position: absolute; inset: 0; border-radius: 14px; }
.bgc-open:focus-visible { outline: none; }
.bgc-open:focus-visible::after { outline: 2px solid var(--vm-focus, var(--vm-violet)); outline-offset: -2px; }
.bgc-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; margin: 3px 0 0; font-size: 12.5px; color: var(--vm-ink-soft); font-variant-numeric: tabular-nums; }
.bgc-kind { color: var(--vm-ink); }
.bgc-meta b, .bgc-stats b { font-weight: 500; color: var(--vm-ink); }
.bgc-needs { padding: 0 7px; border: 1px solid var(--vm-amber); border-radius: 999px; background: var(--vm-amber-soft); color: var(--vm-amber-ink); font: 600 11.5px/18px var(--vm-font-sans); }
.bgc.failed .bgc-status { color: var(--vm-red-ink); }
.bgc-chev { flex: 0 0 auto; width: 16px; height: 16px; margin-top: 2px; color: var(--vm-ink-faint); }
.bgc-stop {
  position: relative; z-index: 1; flex: 0 0 auto; display: grid; place-items: center; width: 44px; height: 44px; margin: -12px -10px -10px 0;
  border: none; border-radius: 50%; background: transparent; color: var(--vm-ink-soft); cursor: pointer;
  transition: background-color .15s, color .15s; touch-action: manipulation; -webkit-tap-highlight-color: transparent;
}
.bgc-stop :deep(svg) { width: 20px; height: 20px; }
.bgc-stop:hover:not(:disabled) { background: var(--vm-red-soft); color: var(--vm-red-ink); }
.bgc-stop:disabled { opacity: .55; cursor: not-allowed; }
.bgc-stop:focus-visible { outline: 2px solid var(--vm-focus, var(--vm-violet)); outline-offset: 1px; }
.bgc-body { padding-left: 30px; min-width: 0; }
.bgc-stats { display: flex; flex-wrap: wrap; gap: 4px 14px; margin: 8px 0 0; font-size: 12.5px; color: var(--vm-ink-soft); font-variant-numeric: tabular-nums; }
.bgc-desc { margin: 8px 0 0; font-size: 12.5px; line-height: 1.5; color: var(--vm-ink-soft); overflow-wrap: anywhere; }
.bgc-tail { display: block; margin-top: 6px; min-width: 0; font: 12px/1.5 var(--vm-font-mono); color: var(--vm-ink-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bgc-err { position: relative; z-index: 1; margin: 6px 0 0; font-size: 12px; color: var(--vm-red-ink); overflow-wrap: anywhere; }
/* Progress squares: filled grey = done, blue = running, outline = waiting, red = failed (the text says it too). */
.bgc-sq { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
.sq { width: 11px; height: 11px; border-radius: 3px; background: var(--vm-ink-faint); }
.sq.running { background: var(--vm-link); }
.sq.failed { background: var(--vm-danger); }
.sq.pending { background: transparent; box-shadow: inset 0 0 0 1.5px var(--vm-line-2); }
.bgc-phases { position: relative; z-index: 1; margin-top: 12px; }
.bgc-ph-h { margin: 0 0 6px; font: 600 12.5px var(--vm-font-sans); color: var(--vm-ink); }
.bgc-ph + .bgc-ph { margin-top: 10px; }
.bgc-ph-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
.bgc-ph-t { flex: 1 1 auto; min-width: 0; font-size: 13.5px; color: var(--vm-ink); overflow-wrap: anywhere; }
.bgc-ph-n { flex: 0 0 auto; font-size: 12.5px; color: var(--vm-ink-soft); font-variant-numeric: tabular-nums; }
.bgc-ph-tg { flex: 0 0 auto; display: grid; place-items: center; width: 28px; height: 28px; border: none; border-radius: 8px; background: transparent; color: var(--vm-ink-soft); cursor: pointer; transition: background-color .15s, color .15s; touch-action: manipulation; }
.bgc-ph-tg :deep(svg) { width: 16px; height: 16px; }
.bgc-ph-tg:hover:not(:disabled) { background: var(--vm-surface); color: var(--vm-ink); }
.bgc-ph-tg:disabled { cursor: default; opacity: .6; }
.bgc-ph-tg:focus-visible { outline: 2px solid var(--vm-focus, var(--vm-violet)); outline-offset: 1px; }
.bgc-ph .bgc-sq { margin-top: 4px; }
.bgc-tbl { width: 100%; margin-top: 8px; border-collapse: collapse; table-layout: fixed; font-size: 12.5px; font-variant-numeric: tabular-nums; }
.bgc-tbl th { padding: 0 0 4px; font-weight: 400; color: var(--vm-ink-soft); text-align: right; }
.bgc-tbl th:first-child, .bgc-tbl td:first-child { text-align: left; }
.bgc-tbl th:nth-child(2), .bgc-tbl td:nth-child(2) { width: 64px; }
.bgc-tbl th:nth-child(3), .bgc-tbl td:nth-child(3) { width: 76px; }
.bgc-tbl td { padding: 2px 0; text-align: right; color: var(--vm-ink); }
.bgc-tbl td.ag { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 8px; }
.bgc-tbl tr.pending td { color: var(--vm-ink-soft); }
.bgc-tbl tr.failed td.ag { color: var(--vm-red-ink); }
.spin { animation: bgcspin 1s linear infinite; }
@keyframes bgcspin { to { transform: rotate(360deg); } }
@media (max-width: 640px) {
  .bgc-ph-tg { width: 44px; height: 44px; margin: -8px -8px -8px 0; }
  .bgc-open { font-size: 15px; }
}
@media (prefers-reduced-motion: reduce) {
  .spin { animation: none; }
}
</style>
