<!--
  One connection on the canvas (plan §3.2): a 40 px hover target, and in the middle a + (insert a step here) and a
  delete button, both `nodrag nopan` so a click never pans the canvas. After a run a connection whose source
  succeeded is drawn in the success colour, with the item count when the source returned a list. A connection that
  goes backwards (its target left of its source) loops under the source instead of crossing the cards.
-->
<template>
  <BaseEdge :id="id" :path="path[0]" :marker-end="markerEnd" :interaction-width="0" :class="edgeClass" />
  <path
    class="wf-edge-hit"
    :d="path[0]"
    fill="none"
    stroke="transparent"
    stroke-width="40"
    @pointerenter="setHover(true)"
    @pointerleave="setHover(false)"
  />
  <EdgeLabelRenderer>
    <div
      class="wf-edge-mid nodrag nopan"
      :class="{ 'is-open': controlsVisible, [`mark-${view.mark}`]: !!view.mark }"
      :style="{ transform: `translate(-50%, -50%) translate(${path[1]}px, ${path[2]}px)` }"
      @pointerenter="setHover(true)"
      @pointerleave="setHover(false)"
      @focusin="setHover(true)"
      @focusout="setHover(false)"
    >
      <span v-if="label" class="wf-edge-label">{{ label }}</span>
      <span v-if="view.items != null" class="wf-edge-items">{{ view.items === 1 ? '1 item' : `${view.items} items` }}</span>
      <template v-if="view.mark && view.hunk != null">
        <span class="wf-edge-sign" :class="`is-${view.mark}`" aria-hidden="true">{{ view.mark === 'add' ? '+' : view.mark === 'remove' ? '−' : '~' }}</span>
        <button type="button" class="wf-hunk-btn is-accept" :aria-label="`Accept the proposed ${view.mark === 'remove' ? 'removal' : 'connection'} from ${from} to ${to}`" title="Accept" @click.stop="ctx.accept(view.hunk)"><Icon icon="lucide:check" aria-hidden="true" /></button>
        <button type="button" class="wf-hunk-btn is-reject" :aria-label="`Reject the proposed ${view.mark === 'remove' ? 'removal' : 'connection'} from ${from} to ${to}`" title="Reject" @click.stop="ctx.reject(view.hunk)"><Icon icon="lucide:x" aria-hidden="true" /></button>
      </template>
      <template v-else-if="!view.ghost && !view.readOnly">
        <button type="button" class="wf-edge-btn" :aria-label="`Insert a step between ${from} and ${to}`" title="Insert a step here" @click.stop="ctx.pick({ mode: 'insert', edgeId: id })"><Icon icon="lucide:plus" aria-hidden="true" /></button>
        <button type="button" class="wf-edge-btn is-danger" :aria-label="`Delete the connection from ${from} to ${to}`" title="Delete connection" @click.stop="ctx.remove({ edgeIds: [id] })"><Icon icon="lucide:trash-2" aria-hidden="true" /></button>
      </template>
    </div>
  </EdgeLabelRenderer>
</template>

<script setup>
import { computed, inject, ref, onBeforeUnmount } from 'vue'
import { Icon } from '@iconify/vue'
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@/utils/wfFlow'
import { WF_CANVAS } from './wfCanvasContext'
import { isBackwards, loopPath } from './wfLayout'

defineOptions({ inheritAttrs: false })
const props = defineProps({
  id: { type: String, required: true },
  source: { type: String, required: true },
  target: { type: String, required: true },
  sourceX: { type: Number, required: true },
  sourceY: { type: Number, required: true },
  targetX: { type: Number, required: true },
  targetY: { type: Number, required: true },
  sourcePosition: { type: String, default: 'right' },
  targetPosition: { type: String, default: 'left' },
  markerEnd: { type: String, default: undefined },
  label: { type: [String, Object], default: '' },
  selected: { type: Boolean, default: false },
})

const ctx = inject(WF_CANVAS)
const view = computed(() => ctx.edgeView(props.id))
// The steps' titles name the buttons ("Insert a step between Fetch and Summarise"); their ids when untitled.
const from = computed(() => view.value.from || props.source)
const to = computed(() => view.value.to || props.target)

const path = computed(() => {
  const { sourceX: sx, sourceY: sy, targetX: tx, targetY: ty } = props
  if (isBackwards(sx, tx)) return loopPath(sx, sy, tx, ty)
  return getBezierPath({ sourceX: sx, sourceY: sy, targetX: tx, targetY: ty, sourcePosition: props.sourcePosition, targetPosition: props.targetPosition })
})

const edgeClass = computed(() => ({
  'wf-edge': true,
  'is-ran': view.value.ran,
  'is-ghost': view.value.ghost,
  [`mark-${view.value.mark}`]: !!view.value.mark,
}))

const hovered = ref(false)
let timer = null
function setHover(on) {
  clearTimeout(timer)
  if (on) hovered.value = true
  else timer = setTimeout(() => { hovered.value = false }, 200)
}
onBeforeUnmount(() => clearTimeout(timer))
const controlsVisible = computed(() => hovered.value || props.selected || !!view.value.mark)
</script>
