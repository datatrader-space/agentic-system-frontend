<!--
  BackgroundTasksList: the Coding Agent's background tasks of the chat on screen, as Claude Code's background-tasks
  sheet lists them (ADM-1360 release, CODING_AGENT_BACKGROUND_WORK_PLAN.md section 3): two groups, Running (open; a
  wake-up or schedule waiting for its time is here too) and Finished N (closed until opened, newest first, every one of
  them). Each task is a card (BackgroundTaskCard). Drawn in the bottom panel's Background tab and in the pill's popover /
  phone sheet; both read the page's one controller (BACKGROUND_TASKS). Lazy: loaded with the tab or the sheet.
-->
<template>
  <div class="bgt">
    <div v-if="!ctl" class="bgt-empty">Background tasks are shown in a Let's Code chat.</div>
    <template v-else>
      <div v-if="ctl.loading && !tasks.length" class="bgt-skel" aria-busy="true" aria-label="Loading the background tasks">
        <span v-for="n in 3" :key="n"></span>
      </div>
      <div v-else-if="ctl.loadError && !tasks.length" class="bgt-err" role="alert">
        <p>{{ ctl.loadError }}</p>
        <button type="button" class="bgt-btn" data-test="bgt-retry" @click="ctl.load()">Try again</button>
      </div>
      <p v-else-if="!ctl.conversationId" class="bgt-empty">Start a chat with the Coding Agent: its background work shows here.</p>
      <p v-else-if="!tasks.length" class="bgt-empty" data-test="bgt-empty">
        No background tasks in this chat yet. When the Coding Agent runs a command, a server, an agent, a workflow or a
        monitor in the background, or plans work for later, it shows here.
      </p>
      <template v-else>
        <section v-if="runningTasks.length" class="bgt-group" data-test="bgt-running">
          <h3 class="bgt-gh">
            <button type="button" class="bgt-gt" :aria-expanded="runningOpen ? 'true' : 'false'" :aria-controls="`${uid}-run`"
                    data-test="bgt-running-toggle" @click="runningOpen = !runningOpen">
              Running <Icon :icon="runningOpen ? 'lucide:chevron-down' : 'lucide:chevron-right'" aria-hidden="true" />
            </button>
          </h3>
          <ul v-show="runningOpen" :id="`${uid}-run`" class="bgt-list" role="list" aria-label="Running background tasks">
            <li v-for="task in runningTasks" :key="task.id"><BackgroundTaskCard :task="task" @opened="emit('opened', $event)" /></li>
          </ul>
        </section>
        <section v-if="finishedTasks.length" class="bgt-group" data-test="bgt-finished">
          <h3 class="bgt-gh">
            <button type="button" class="bgt-gt" :aria-expanded="finishedOpen ? 'true' : 'false'" :aria-controls="`${uid}-fin`"
                    data-test="bgt-finished-toggle" @click="finishedOpen = !finishedOpen">
              Finished <span class="bgt-gn">{{ finishedTasks.length }}</span>
              <Icon :icon="finishedOpen ? 'lucide:chevron-down' : 'lucide:chevron-right'" aria-hidden="true" />
            </button>
          </h3>
          <ul v-if="finishedOpen" :id="`${uid}-fin`" class="bgt-list" role="list" aria-label="Finished background tasks">
            <li v-for="task in finishedTasks" :key="task.id"><BackgroundTaskCard :task="task" @opened="emit('opened', $event)" /></li>
          </ul>
        </section>
      </template>
    </template>
  </div>
</template>

<script setup>
import { computed, inject, ref, useId } from 'vue'
import { Icon } from '@iconify/vue'
import { BACKGROUND_TASKS } from '@/stores/useBackgroundTasks'
import BackgroundTaskCard from './BackgroundTaskCard.vue'

const emit = defineEmits(['opened'])
const ctl = inject(BACKGROUND_TASKS, null)
const uid = useId()
const runningOpen = ref(true)
const finishedOpen = ref(false)

const tasks = computed(() => (ctl ? ctl.listFor(ctl.conversationId) : []))
const runningTasks = computed(() => tasks.value.filter((t) => t.state === 'running'))
// Newest first by when it ended (else when it started); every one, never capped.
const endedAt = (t) => Date.parse(t.finished_at || t.started_at || '') || 0
const finishedTasks = computed(() => tasks.value.filter((t) => t.state !== 'running').sort((a, b) => endedAt(b) - endedAt(a)))
</script>

<style scoped>
.bgt { font: 13px/1.45 var(--vm-font-sans); color: var(--vm-ink); }
.bgt-empty { margin: 0; padding: 4px 0; color: var(--vm-ink-soft); max-width: 70ch; }
.bgt-err { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; color: var(--vm-red-ink); }
.bgt-err p { margin: 0; }
.bgt-skel { display: flex; flex-direction: column; gap: 8px; }
.bgt-skel span { display: block; height: 64px; border-radius: 14px; background: var(--vm-surface-soft); animation: bgtpulse 1.4s ease-in-out infinite; }
@keyframes bgtpulse { 50% { opacity: .55; } }
.bgt-group + .bgt-group { margin-top: 12px; }
.bgt-gh { margin: 0 0 8px; font: inherit; }
.bgt-gt {
  display: inline-flex; align-items: center; gap: 6px; min-height: 30px; padding: 0 6px 0 2px; border: none; border-radius: 8px;
  background: transparent; color: var(--vm-ink-soft); font: 500 13px var(--vm-font-sans); cursor: pointer;
  transition: color .15s, background-color .15s; touch-action: manipulation; -webkit-tap-highlight-color: transparent;
}
.bgt-gt:hover { color: var(--vm-ink); background: var(--vm-surface-soft); }
.bgt-gt:focus-visible { outline: 2px solid var(--vm-focus, var(--vm-violet)); outline-offset: 2px; }
.bgt-gt :deep(svg) { width: 15px; height: 15px; }
.bgt-gn { font-variant-numeric: tabular-nums; }
.bgt-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
/* The list is never capped: cards off screen are not laid out until scrolled to. */
.bgt-list > li { content-visibility: auto; contain-intrinsic-size: auto 72px; }
.bgt-btn { display: inline-flex; align-items: center; min-height: 30px; padding: 0 10px; border: 1px solid var(--vm-line-2); border-radius: 8px; background: var(--vm-surface); color: var(--vm-ink); font: 600 12.5px var(--vm-font-sans); cursor: pointer; transition: background-color .15s; touch-action: manipulation; }
.bgt-btn:hover { background: var(--vm-surface-soft); }
.bgt-btn:focus-visible { outline: 2px solid var(--vm-focus, var(--vm-violet)); outline-offset: 2px; }
@media (max-width: 640px) {
  .bgt-gt, .bgt-btn { min-height: 44px; }
}
@media (prefers-reduced-motion: reduce) {
  .bgt-skel span { animation: none; }
}
</style>
