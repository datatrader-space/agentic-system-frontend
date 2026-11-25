<!--
  BackgroundEventCard: one task of a chat message the SERVER wrote when background tasks ended (`ChatMessage.kind =
  system_event`, its `metadata.background_tasks`, one card per task; ADM-1360 release, CODING_AGENT_BACKGROUND_WORK_PLAN.md
  section 3). A compact event,
  never drawn as the person's own message: "Background command finished · npm test · failed (exit 1)", the last lines
  of its output and Open. Open needs the Let's Code page's background-tasks controller; elsewhere the card has none.
  Lazy: ChatMessageList loads it the first time such a message is shown.
-->
<template>
  <section class="bge" :class="tone" role="group" :aria-label="title" data-test="bg-event-card">
    <div class="bge-head">
      <span class="bge-ic" aria-hidden="true"><Icon :icon="kindIcon(task.kind)" /></span>
      <p class="bge-title">
        <span class="bge-text">{{ title }}</span>
      </p>
      <a v-if="canOpen && openType(task) === 'workflow_run' && workflowRunHref(task)" class="bge-open" :href="workflowRunHref(task)"
         target="_blank" rel="noopener noreferrer" data-test="bg-event-open">
        Open<span class="sr-only"> the workflow run (opens in a new tab)</span>
      </a>
      <button v-else-if="canOpen && openType(task) !== 'workflow_run'" type="button" class="bge-open" data-test="bg-event-open"
              :aria-label="openLabel(task)" @click="open">
        Open
      </button>
    </div>
    <pre v-if="task.output_tail" ref="tailEl" class="bge-tail" translate="no" tabindex="0" aria-label="The last lines of its output">{{ task.output_tail }}</pre>
  </section>
</template>

<script setup>
import { computed, inject, nextTick, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { BACKGROUND_TASKS } from '@/stores/useBackgroundTasks'
import { eventTitle, kindIcon, openLabel, openType, toneOf } from '@/components/letscode/backgroundTaskText'
import { openTask, workflowRunHref } from '@/components/letscode/backgroundTaskActions'

// The task as the message saved it (a TASK).
const props = defineProps({ task: { type: Object, required: true } })
const ctl = inject(BACKGROUND_TASKS, null)
const tailEl = ref(null)

// The task as the message saved it; the list's newer copy (same id) when the panel has it.
const task = computed(() => {
  const saved = props.task || {}
  const live = ctl && saved.id != null ? ctl.listFor(ctl.conversationId).find((x) => String(x.id) === String(saved.id)) : null
  return { ...saved, ...(live ? { open: live.open || saved.open } : {}) }
})
const tone = computed(() => toneOf(task.value))
const title = computed(() => eventTitle(task.value))
const canOpen = computed(() => !!ctl && task.value.id != null)

function open() {
  const saved = task.value
  const live = ctl.listFor(ctl.conversationId).find((x) => String(x.id) === String(saved.id))
  openTask(ctl, live || saved)
}
// The last lines show first: the tail is scrolled to its end, never cut in code.
function toEnd() { nextTick(() => { const el = tailEl.value; if (el) el.scrollTop = el.scrollHeight }) }
onMounted(toEnd)
watch(() => task.value.output_tail, toEnd)
</script>

<style scoped>
.bge {
  margin: 0 0 14px; padding: 8px 10px; border: 1px solid var(--vm-line, #e2e8f0); border-left: 3px solid var(--vm-ink-faint, #94a3b8);
  border-radius: 8px; background: var(--vm-surface-soft, #f8fafc); color: var(--vm-ink-soft, #475569);
  font: 12.5px/1.45 var(--vm-font-sans, inherit);
}
.bge.done { border-left-color: var(--vm-green, #16a34a); }
.bge.failed { border-left-color: var(--vm-danger, #dc2626); }
.bge.stopped { border-left-color: var(--vm-ink-faint, #94a3b8); }
.bge.running { border-left-color: var(--vm-violet, #7c3aed); }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.bge-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
.bge-ic { flex: 0 0 auto; display: grid; place-items: center; color: var(--vm-ink-soft, #475569); }
.bge-ic :deep(svg) { width: 15px; height: 15px; }
.bge-title { flex: 1 1 auto; min-width: 0; margin: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.bge-text { min-width: 0; overflow-wrap: anywhere; color: var(--vm-ink, #0f172a); }
.bge-open { flex: 0 0 auto; display: inline-flex; align-items: center; min-height: 30px; padding: 0 10px; border: 1px solid var(--vm-line-2, #cbd5e1); border-radius: 8px; background: var(--vm-surface, #fff); color: var(--vm-ink, #0f172a); font: 600 12px var(--vm-font-sans, inherit); text-decoration: none; cursor: pointer; transition: background-color .15s; touch-action: manipulation; }
.bge-open:hover { background: var(--vm-surface-soft, #f1f5f9); }
.bge-open:focus-visible, .bge-tail:focus-visible { outline: 2px solid var(--vm-focus, var(--vm-violet, #7c3aed)); outline-offset: 2px; }
.bge-tail { margin: 6px 0 0; max-height: calc(5 * 1.5em + 12px); overflow: auto; padding: 6px 8px; border-radius: 6px; background: var(--vm-bg, #fff); border: 1px solid var(--vm-line, #e2e8f0); font: 11.5px/1.5 var(--vm-font-mono, ui-monospace, monospace); color: var(--vm-ink-soft, #475569); white-space: pre-wrap; overflow-wrap: anywhere; }
@media (max-width: 640px) {
  .bge-open { min-height: 44px; padding: 0 14px; }
}
</style>
