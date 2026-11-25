<!--
  One workflow step on the canvas (plan §3.2): a 200×64 card with its category tile, a title and ONE badge line.
  Every setting lives in the node window (WfNodeModal); the card shows no fields.

  The run state, the validation problem and the agent's proposal marks come from the canvas context (WF_CANVAS), never
  from the node's data (D1 rule 1). Colour is never the only signal: each state also has an icon and a word, read by
  assistive tech through the node's aria-label (set by WfCanvas from nodeAriaLabel).
-->
<template>
  <div
    class="wf-node"
    :class="[`is-${view.state}`, { 'is-selected': selected, 'is-ghost': view.ghost, 'is-trigger': isTrigger, 'is-off': off, [`mark-${view.mark}`]: !!view.mark }]"
    :style="{ '--wf-node-cat': `var(${category.token})`, '--wf-node-cat-soft': `var(${category.token}-soft)` }"
    @mouseenter="setHover(true)"
    @mouseleave="setHover(false)"
    @focusin="setHover(true)"
    @focusout="setHover(false)"
  >
    <Handle v-if="!isTrigger" type="target" :position="Position.Left" class="wf-h wf-h--in" :connectable="!view.ghost" />

    <span class="wf-node__tile" aria-hidden="true"><Icon :icon="icon" /></span>
    <span class="wf-node__body">
      <span class="wf-node__title" :title="title">{{ title }}</span>
      <span class="wf-node__badge" :class="{ 'is-setup': badge.needsSetup }" :title="off ? offTitle : badge.text">
        <span v-if="off" class="wf-node__off"><Icon icon="lucide:circle-slash" aria-hidden="true" />Off</span>
        <Icon v-if="badge.needsSetup" icon="lucide:circle-dashed" aria-hidden="true" />{{ badge.text }}
      </span>
    </span>

    <span
      v-if="showStatus"
      class="wf-node__status"
      :class="`is-${view.state}`"
      :title="view.error ? `${statusLabel}: ${view.error}` : (view.issue ? `${statusLabel}: ${view.issue}` : statusLabel)"
      aria-hidden="true"
    >
      <Icon :icon="statusIcon" />
    </span>
    <span v-if="view.mark" class="wf-node__mark" :class="`is-${view.mark}`" aria-hidden="true">{{ MARK_SIGN[view.mark] }}</span>

    <!-- Outputs. An output with nothing connected shows a + that opens the picker and connects the new step. A deciding
         step (a condition's true / false, a Data table Exists step's exists / missing) has one output per branch. -->
    <template v-if="branchHandles.length">
      <template v-for="h in branchHandles" :key="h.id">
        <Handle :id="h.id" type="source" :position="Position.Right" class="wf-h wf-h--out" :class="`wf-h--${h.id}`" :style="{ top: h.top }" :connectable="!view.ghost" />
        <span class="wf-h-label" :class="`wf-h-label--${h.id}`" :style="{ top: h.top }" aria-hidden="true">{{ h.id }}</span>
        <button
          v-if="canAdd && !view.connected.has(h.id)"
          type="button" class="wf-plus nodrag nopan" :class="`wf-plus--${h.id}`" :style="{ top: h.top }"
          :aria-label="`Add a step on the ${h.id} branch of ${title}`" :title="`Add a step on the ${h.id} branch`"
          @click.stop="ctx.pick({ mode: 'from', source: { nodeId: id, handle: h.id } })"
        ><Icon icon="lucide:plus" aria-hidden="true" /></button>
      </template>
    </template>
    <template v-else>
      <Handle type="source" :position="Position.Right" class="wf-h wf-h--out" :connectable="!view.ghost" />
      <button
        v-if="canAdd && !view.connected.has('')"
        type="button" class="wf-plus nodrag nopan" :aria-label="`Add a step after ${title}`" title="Add the next step"
        @click.stop="ctx.pick({ mode: 'from', source: { nodeId: id, handle: null } })"
      ><Icon icon="lucide:plus" aria-hidden="true" /></button>
    </template>
    <template v-if="hasErrorOutput">
      <Handle id="error" type="source" :position="Position.Bottom" class="wf-h wf-h--error" :connectable="!view.ghost" />
      <span class="wf-h-label wf-h-label--error" aria-hidden="true">on error</span>
      <button
        v-if="canAdd && !view.connected.has('error')"
        type="button" class="wf-plus wf-plus--error nodrag nopan" :aria-label="`Add a step that runs when ${title} fails`"
        title="Add a step for failures" @click.stop="ctx.pick({ mode: 'from', source: { nodeId: id, handle: 'error' } })"
      ><Icon icon="lucide:plus" aria-hidden="true" /></button>
    </template>

    <!-- An agent proposal: accept or reject this change (plan §3.4). -->
    <span v-if="view.mark && view.hunk != null" class="wf-node__hunk nodrag nopan">
      <button type="button" class="wf-hunk-btn is-accept" :aria-label="`Accept the proposed ${MARK_WORD[view.mark]} of ${title}`" title="Accept" @click.stop="ctx.accept(view.hunk)"><Icon icon="lucide:check" aria-hidden="true" /></button>
      <button type="button" class="wf-hunk-btn is-reject" :aria-label="`Reject the proposed ${MARK_WORD[view.mark]} of ${title}`" title="Reject" @click.stop="ctx.reject(view.hunk)"><Icon icon="lucide:x" aria-hidden="true" /></button>
    </span>

    <!-- Hover toolbar (plan §3.2). Read only (a viewer or runner, ADM-1339): Open, and Test up to here for a runner. -->
    <NodeToolbar v-if="!view.ghost && !view.mark" :is-visible="toolbarVisible" :position="Position.Top" :offset="6">
      <div class="wf-node-toolbar" role="toolbar" :aria-label="`${title} actions`" @mouseenter="setHover(true)" @mouseleave="setHover(false)" @focusin="setHover(true)" @focusout="setHover(false)">
        <button type="button" class="wf-tb-btn nodrag nopan" :aria-label="`Open ${title}`" title="Open (Enter)" @click.stop="ctx.open(id)"><Icon icon="lucide:settings-2" aria-hidden="true" /></button>
        <button v-if="view.canRun !== false" type="button" class="wf-tb-btn nodrag nopan" :disabled="view.running" :aria-label="`Test up to ${title}`" title="Test up to here" @click.stop="ctx.testUntil(id)"><Icon icon="lucide:flask-conical" aria-hidden="true" /></button>
        <template v-if="!view.readOnly">
          <button type="button" class="wf-tb-btn nodrag nopan" :aria-label="`Rename ${title}`" title="Rename (F2)" @click.stop="ctx.rename(id)"><Icon icon="lucide:pencil" aria-hidden="true" /></button>
          <button
            v-if="canOff" type="button" class="wf-tb-btn nodrag nopan" :class="{ 'is-on': off }"
            :aria-label="`${off ? 'Turn step on' : 'Turn step off'}: ${title}`" :title="offButtonTitle" @click.stop="ctx.toggleOff(id)"
          ><Icon :icon="off ? 'lucide:circle-play' : 'lucide:circle-slash'" aria-hidden="true" /></button>
          <button type="button" class="wf-tb-btn nodrag nopan" :aria-label="`Duplicate ${title}`" title="Duplicate" @click.stop="ctx.duplicate(id)"><Icon icon="lucide:copy-plus" aria-hidden="true" /></button>
          <button type="button" class="wf-tb-btn is-danger nodrag nopan" :aria-label="`Delete ${title}`" title="Delete" @click.stop="ctx.remove({ nodeIds: [id] })"><Icon icon="lucide:trash-2" aria-hidden="true" /></button>
        </template>
      </div>
    </NodeToolbar>
  </div>
</template>

<script setup>
import { computed, inject, ref, onBeforeUnmount } from 'vue'
import { Icon } from '@iconify/vue'
import { Handle, Position } from '@vue-flow/core'
import { NodeToolbar } from '@vue-flow/node-toolbar'
import { WF_CATEGORIES, wfBranchHandles, wfCategory, wfIcon } from '@/config/wfNodeDefinitions'
import { NODE_STATUS_LABELS, NODE_STATUS_ICONS } from '@/utils/wfNodeView'
import { nodeBadge, nodeTitle, hasReliability, nodeIsOff, canTurnOff, offButtonTitle as offTitleFor, OFF_EXPLAINED } from './wfNodeData'
import { WF_CANVAS } from './wfCanvasContext'

defineOptions({ inheritAttrs: false })
const props = defineProps({
  id: { type: String, required: true },
  type: { type: String, required: true },
  data: { type: Object, default: () => ({}) },
  selected: { type: Boolean, default: false },
})

// Two branches sit at 30% and 70% of the card's height (a condition's true / false, exists / missing).
const BRANCH_TOPS = ['30%', '70%']
const MARK_SIGN = { add: '+', change: '~', remove: '−' }
const MARK_WORD = { add: 'addition', change: 'change', remove: 'removal' }

const ctx = inject(WF_CANVAS)
const view = computed(() => ctx.nodeView(props.id))
const category = computed(() => WF_CATEGORIES[wfCategory(props.type)])
const icon = computed(() => wfIcon(props.type))
const title = computed(() => nodeTitle(props.type, props.data))
const badge = computed(() => nodeBadge(props.type, props.data))
const isTrigger = computed(() => props.type.startsWith('trigger.'))
const branchHandles = computed(() => {
  const ids = wfBranchHandles(props.type, props.data)
  return ids.map((id, i) => ({ id, top: BRANCH_TOPS[i] || `${Math.round(((i + 1) * 100) / (ids.length + 1))}%` }))
})
const hasErrorOutput = computed(() => hasReliability(props.type))
// Turned off (ADM-1343): the run skips the step and passes on its input. Shown by a word and an icon, not by fading alone.
const off = computed(() => nodeIsOff(props.data))
const canOff = computed(() => canTurnOff(props.type))
const offTitle = computed(() => `Turned off. ${OFF_EXPLAINED[props.type] || OFF_EXPLAINED.default}`)
const offButtonTitle = computed(() => offTitleFor(props.type, off.value))
const canAdd = computed(() => !view.value.ghost && !view.value.readOnly)
const statusLabel = computed(() => NODE_STATUS_LABELS[view.value.state] || view.value.state)
const statusIcon = computed(() => NODE_STATUS_ICONS[view.value.state] || 'lucide:circle')
// Idle and ready are told by the badge line; every run state and "invalid" gets the corner badge.
const showStatus = computed(() => !['idle', 'configured'].includes(view.value.state))

const hovered = ref(false)
let hideTimer = null
function setHover(on) {
  clearTimeout(hideTimer)
  if (on) hovered.value = true
  else hideTimer = setTimeout(() => { hovered.value = false }, 160)
}
onBeforeUnmount(() => clearTimeout(hideTimer))
const toolbarVisible = computed(() => hovered.value || (props.selected && ctx.singleSelected(props.id)))
</script>
