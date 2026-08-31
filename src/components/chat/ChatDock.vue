<template>
  <section class="dock">
    <!-- Tab strip. Always present: it carries the dock's own close button, and with only one pane open
         there would otherwise be no way to dismiss the panel (CanvasShell has its own X; the Artifacts
         panel does not). The Canvas tab appears only when there is a canvas to show. -->
    <div class="dock-tabs" role="tablist">
      <button v-if="canvasAvailable" class="dock-tab" role="tab" :aria-selected="tab === 'canvas'"
              :class="{ on: tab === 'canvas' }" @click="select('canvas')">Canvas</button>
      <button class="dock-tab" role="tab" :aria-selected="tab === 'artifacts'"
              :class="{ on: tab === 'artifacts' }" @click="select('artifacts')">
        Artifacts
        <span v-if="artifacts.unseen" class="dock-badge">{{ artifacts.unseen }}</span>
      </button>
      <button class="dock-x" title="Close panel" aria-label="Close panel" @click="closeDock">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>

    <!-- Panes are kept MOUNTED and hidden rather than v-if'd away: switching to Artifacts and back must
         not tear down the canvas iframe (it would reload the preview and lose scroll/selection). -->
    <div class="dock-body">
      <CanvasShell v-if="canvasAvailable" v-show="tab === 'canvas'" class="dock-pane" />
      <ArtifactsPanel v-show="tab === 'artifacts'" class="dock-pane" />
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import CanvasShell from '../canvas/CanvasShell.vue'
import ArtifactsPanel from '../artifacts/ArtifactsPanel.vue'
import { useCanvasStore } from '../../stores/useCanvasStore'
import { useArtifactsStore } from '../../stores/useArtifactsStore'

const canvas = useCanvasStore()
const artifacts = useArtifactsStore()

const canvasAvailable = computed(() => canvas.open && canvas.hasCanvas)

// Which pane is on top. Whichever surface the user (or the agent) most recently opened wins; with no
// canvas at all the dock can only be showing Artifacts.
const _tab = ref('canvas')
const tab = computed(() => (canvasAvailable.value ? _tab.value : 'artifacts'))

function select(t) {
  _tab.value = t
  if (t === 'artifacts') artifacts.unseen = 0
}

// The agent producing a design pulls the canvas forward; the user opening Artifacts pulls that forward.
watch(canvasAvailable, (on) => { if (on) _tab.value = 'canvas' })
watch(() => artifacts.open, (on) => { if (on) { _tab.value = 'artifacts'; artifacts.unseen = 0 } })

function closeDock() {
  if (tab.value === 'artifacts') {
    artifacts.closePanel()
    if (canvasAvailable.value) _tab.value = 'canvas'
  } else {
    canvas.close()
    if (artifacts.open) _tab.value = 'artifacts'
  }
}
</script>

<style scoped>
.dock { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--vm-surface, #fff); border-left: 1px solid var(--vm-line-2, #e5e7eb); }
.dock-tabs { display: flex; align-items: center; gap: 4px; padding: 6px 8px; border-bottom: 1px solid var(--vm-line-2, #e5e7eb); }
.dock-tab { position: relative; display: inline-flex; align-items: center; gap: 6px; border: none; background: transparent; border-radius: 9px; padding: 6px 12px; font-size: 12.5px; font-weight: 700; color: var(--vm-ink-soft, #64748b); cursor: pointer; }
.dock-tab:hover { background: var(--vm-surface-2, #f1f5f9); }
.dock-tab.on { background: var(--vm-violet-soft, #eef2ff); color: var(--vm-violet-d, #4f46e5); }
.dock-badge { min-width: 16px; height: 16px; padding: 0 4px; border-radius: 9999px; background: var(--vm-violet-d, #4f46e5); color: #fff; font-size: 10px; font-weight: 700; display: grid; place-items: center; }
.dock-x { margin-left: auto; display: grid; place-items: center; width: 28px; height: 28px; border: none; background: transparent; border-radius: 8px; color: var(--vm-ink-soft, #64748b); cursor: pointer; }
.dock-x:hover { background: var(--vm-surface-2, #f1f5f9); }
.dock-x svg { width: 15px; height: 15px; }
.dock-body { flex: 1 1 auto; min-height: 0; position: relative; }
.dock-pane { height: 100%; min-height: 0; }
</style>
