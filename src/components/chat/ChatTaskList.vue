<!--
  ChatTaskList: the agent's task list for the open conversation (TODO_WRITE, AGENT_ENGINE_CAPABILITIES_PLAN.md
  section 7). The shared chat store holds it (`chat.todos`, from the conversation on load and from each `todo_update`
  frame), so it is the same list in the main chat and in Let's Code's chat panel. Drawn just above the composer:
  one line with the step the agent is on and "2 of 5 done", a rail with one segment per task, and the whole list
  when opened. Hidden when the agent has written no list.

  ONLY A LIVE TURN SPINS (ADM-1296). An item in progress spins while the host's turn is running (`running`); otherwise
  it is drawn still. When its run settles, the server marks such an item `stopped` with a reason ("Paused — balance ran
  out", "Stopped by you", "Not done — the turn ended before this was finished"), drawn still, with that reason.
-->
<template>
  <section v-if="items.length" class="ctl" :class="{ open, compact }" aria-label="Task list" data-test="task-list">
    <button
      type="button" class="ctl-head" :aria-expanded="open ? 'true' : 'false'" :aria-controls="listId"
      :title="open ? 'Hide the tasks' : 'Show the tasks'" @click="open = !open"
    >
      <Icon :icon="allDone ? 'lucide:list-checks' : 'lucide:list-todo'" class="ctl-ic" aria-hidden="true" />
      <span class="ctl-now" :class="{ done: allDone }">{{ headline }}</span>
      <span v-if="!current && stopped && stopped.reason" class="ctl-why" data-test="task-stopped-why">{{ stopped.reason }}</span>
      <span class="ctl-count" data-test="task-count">{{ done }} of {{ items.length }} done</span>
      <Icon :icon="open ? 'lucide:chevron-down' : 'lucide:chevron-up'" class="ctl-chev" aria-hidden="true" />
    </button>
    <!-- One segment per task, in the list's order: the shape of the whole job at a glance. -->
    <div class="ctl-rail" aria-hidden="true">
      <span v-for="(t, i) in items" :key="i" class="ctl-seg" :class="[t.status, { live: running }]"></span>
    </div>
    <!-- Live updates are read out as one short line, not the whole list each time. -->
    <p class="sr-only" aria-live="polite" data-test="task-live">{{ spoken }}</p>
    <ol v-show="open" :id="listId" class="ctl-list">
      <li v-for="(t, i) in items" :key="i" class="ctl-item" :class="t.status" :data-status="t.status">
        <span class="ctl-mark" aria-hidden="true">
          <Icon v-if="t.status === 'completed'" icon="lucide:circle-check" />
          <Icon v-else-if="t.status === 'in_progress' && running" icon="lucide:loader-circle" class="ctl-spin"
                data-test="task-spinner" />
          <Icon v-else-if="t.status === 'in_progress'" icon="lucide:circle-dot" />
          <Icon v-else-if="t.status === 'stopped'" icon="lucide:circle-pause" />
          <Icon v-else icon="lucide:circle" />
        </span>
        <span class="ctl-text">
          {{ t.status === 'in_progress' && running ? (t.activeForm || t.content) : t.content }}
          <span v-if="t.status === 'stopped' && t.reason" class="ctl-reason" data-test="task-reason">{{ t.reason }}</span>
        </span>
        <span class="sr-only">{{ STATUS_WORDS[t.status] }}</span>
      </li>
    </ol>
  </section>
</template>

<script setup>
import { computed, ref, useId } from 'vue'
import { Icon } from '@iconify/vue'

const props = defineProps({
  // [{ content, status: 'pending' | 'in_progress' | 'completed' | 'stopped', activeForm, reason }] (the chat store's
  // `todos`; `stopped` and its `reason` are written by the server when the run settles).
  todos: { type: Array, default: () => [] },
  // The host's turn is running now. An item in progress spins only then: a stored status alone is not a live turn.
  running: { type: Boolean, default: false },
  // A narrow panel (Let's Code's chat): tighter spacing, same content.
  compact: { type: Boolean, default: false },
  // Shown closed to its one-line summary at first (a phone: the conversation keeps the room); a tap opens it.
  startClosed: { type: Boolean, default: false },
})

const STATUS_WORDS = { completed: '(done)', in_progress: '(in progress)', pending: '(not started)', stopped: '(stopped)' }
const listId = `ctl-list-${useId()}`

const open = ref(!props.startClosed)
const items = computed(() => (props.todos || []).filter((t) => t && t.content))
const done = computed(() => items.value.filter((t) => t.status === 'completed').length)
const allDone = computed(() => items.value.length > 0 && done.value === items.value.length)
const current = computed(() => items.value.find((t) => t.status === 'in_progress') || null)
const stopped = computed(() => items.value.find((t) => t.status === 'stopped') || null)
const headline = computed(() => {
  if (current.value) return props.running ? (current.value.activeForm || current.value.content) : current.value.content
  if (stopped.value) return stopped.value.content
  if (allDone.value) return 'All tasks done'
  const next = items.value.find((t) => t.status === 'pending')
  return next ? `Next: ${next.content}` : 'Tasks'
})
const spoken = computed(() => {
  const now = current.value ? (current.value.activeForm || current.value.content)
    : (stopped.value ? `${stopped.value.content}: ${stopped.value.reason || 'stopped'}` : '')
  return `${done.value} of ${items.value.length} tasks done. ${now}`.trim()
})
</script>

<style scoped>
.ctl {
  max-width: 728px; margin: 0 auto 6px; border: 1px solid var(--vm-line); border-radius: 12px;
  background: var(--vm-surface); color: var(--vm-ink); font-family: var(--vm-font-sans); overflow: hidden;
}
.ctl.compact { max-width: none; margin: 0 0 8px; border-radius: 10px; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

.ctl-head {
  display: flex; align-items: center; gap: 8px; width: 100%; min-height: 40px; padding: 8px 12px;
  border: none; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer;
  transition: background-color .15s;
}
.ctl-head:hover { background: var(--vm-surface-soft); }
.ctl-head:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: -2px; }
.ctl-ic { flex: 0 0 auto; width: 16px; height: 16px; color: var(--vm-violet); }
.ctl-now { flex: 1 1 auto; min-width: 0; font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ctl-now.done { color: var(--vm-green-ink); }
.ctl-count { flex: 0 0 auto; font-size: 12px; color: var(--vm-ink-soft); font-variant-numeric: tabular-nums; }
.ctl-why { flex: 0 1 auto; min-width: 0; max-width: 45%; font-size: 12px; color: var(--vm-amber-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ctl-chev { flex: 0 0 auto; width: 15px; height: 15px; color: var(--vm-ink-faint); }

.ctl-rail { display: flex; gap: 3px; padding: 0 12px 8px; }
.ctl-seg { flex: 1 1 0; height: 4px; border-radius: 2px; background: var(--vm-line-2); }
.ctl-seg.completed { background: var(--vm-green); }
.ctl-seg.in_progress { background: var(--vm-violet); }
.ctl-seg.in_progress.live { animation: ctl-breathe 1.6s ease-in-out infinite; }
.ctl-seg.stopped { background: var(--vm-amber-ink); }

.ctl-list { list-style: none; margin: 0; padding: 2px 8px 8px; border-top: 1px solid var(--vm-line); max-height: 220px; overflow-y: auto; }
.ctl-item { display: flex; align-items: flex-start; gap: 8px; padding: 6px 4px; font-size: 13px; line-height: 1.45; }
.ctl-mark { flex: 0 0 auto; display: grid; place-items: center; width: 16px; height: 19px; }
.ctl-mark :deep(svg) { width: 15px; height: 15px; }
.ctl-item.pending .ctl-mark { color: var(--vm-ink-faint); }
.ctl-item.completed .ctl-mark { color: var(--vm-green); }
.ctl-item.completed .ctl-text { color: var(--vm-ink-soft); text-decoration: line-through; text-decoration-color: color-mix(in srgb, var(--vm-ink-soft) 55%, transparent); }
.ctl-item.in_progress .ctl-mark { color: var(--vm-violet); }
.ctl-item.in_progress .ctl-text { font-weight: 600; }
.ctl-item.stopped .ctl-mark { color: var(--vm-amber-ink); }
.ctl-text { min-width: 0; overflow-wrap: anywhere; }
.ctl-reason { display: block; font-size: 12px; color: var(--vm-ink-soft); }
.ctl-spin { animation: ctl-spin 1.1s linear infinite; }

.ctl.compact .ctl-head { padding: 7px 10px; }
.ctl.compact .ctl-rail { padding: 0 10px 7px; }

@keyframes ctl-spin { to { transform: rotate(360deg); } }
@keyframes ctl-breathe { 50% { opacity: .45; } }
@media (max-width: 640px) {
  .ctl-head { min-height: 44px; }
}
@media (prefers-reduced-motion: reduce) {
  .ctl-spin, .ctl-seg.in_progress.live { animation: none; }
}
</style>
