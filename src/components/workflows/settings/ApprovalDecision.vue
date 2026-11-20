<!--
  Approve or reject an approval step while the live run waits on it (ADM-1333). It acts on the LIVE run only
  (useWorkflowRun.decide), never on a past run being viewed. Approve and Reject are offered only when the server says
  this person may decide (the waiting node's output `can_decide: true`, ADM-1339); anyone else is told who decides.
  The server refuses a decision from anyone else in any case.
-->
<template>
  <div v-if="waiting" class="ad" role="group" aria-label="Approval decision">
    <template v-if="decider.canDecide">
      <p class="ad-q"><Icon icon="lucide:hand" aria-hidden="true" />The run is waiting for your decision on this step.</p>
      <div class="ad-btns">
        <button type="button" class="ad-btn ad-btn--yes" :disabled="run.deciding.value" @click="run.decide(nodeId, 'approve')">
          <Icon icon="lucide:check" aria-hidden="true" />Approve
        </button>
        <button type="button" class="ad-btn ad-btn--no" :disabled="run.deciding.value" @click="run.decide(nodeId, 'reject')">
          <Icon icon="lucide:x" aria-hidden="true" />Reject
        </button>
      </div>
    </template>
    <p v-else class="ad-q"><Icon icon="lucide:hourglass" aria-hidden="true" />{{ decider.text }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { approvalDecider } from '@/utils/workflowAccess'
import { useNodeEditor } from './nodeEditor'

const editor = useNodeEditor()
const run = editor.run
const nodeId = computed(() => editor.node.value?.id)
const state = computed(() => run.nodeStates.value?.[nodeId.value])
const waiting = computed(() => !!run.live.value && !run.viewingPast.value && state.value?.status === 'waiting')
const decider = computed(() => approvalDecider(state.value?.output, editor.doc.meta?.owner))
</script>

<style scoped>
.ad { display: grid; gap: 8px; padding: 10px 12px; border: 1px solid var(--vm-amber-ink); border-radius: 8px; background: var(--vm-amber-soft); }
.ad-q { display: flex; gap: 6px; align-items: center; margin: 0; font-size: 13px; font-weight: 600; color: var(--vm-amber-ink); }
.ad-q :deep(svg), .ad-btn :deep(svg) { width: 16px; height: 16px; }
.ad-btns { display: flex; gap: 8px; flex-wrap: wrap; }
.ad-btn {
  display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 6px 12px; border-radius: 6px;
  border: 1px solid var(--vm-line-2); background: var(--vm-surface); color: var(--vm-ink); font: inherit; font-size: 13px; cursor: pointer;
}
.ad-btn--yes { border-color: var(--vm-green-ink); color: var(--vm-green-ink); }
.ad-btn--no { border-color: var(--vm-red-ink); color: var(--vm-red-ink); }
.ad-btn:hover:not(:disabled) { background: var(--vm-surface-soft); }
.ad-btn:disabled { opacity: .55; cursor: not-allowed; }
.ad-btn:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
@media (pointer: coarse) { .ad-btn { min-height: 44px; } }
</style>
