<template>
  <section class="dock">
    <!-- Tab strip. Always present: it carries the dock's own close button, and with only one pane open
         there would otherwise be no way to dismiss the panel (CanvasShell has its own X; the Artifacts
         panel does not). The Canvas tab appears only when there is a canvas to show. -->
    <div class="dock-tabs" role="tablist">
      <button v-if="canvasAvailable" class="dock-tab" role="tab" :aria-selected="tab === 'canvas'"
              :class="{ on: tab === 'canvas' }" @click="select('canvas')">Canvas</button>
      <button v-if="browserAvailable" class="dock-tab" role="tab" :aria-selected="tab === 'browser'"
              :class="{ on: tab === 'browser' }" data-test="dock-tab-browser" @click="select('browser')">Browser</button>
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
      <!-- v-if, not only v-show: closing the Browser pane must close its live connection, so the agent's
           browser stops streaming to nobody. `active` pauses the stream while another tab is on top. -->
      <BrowserPanel v-if="browserAvailable" v-show="tab === 'browser'" :active="tab === 'browser'" class="dock-pane" />
      <ArtifactsPanel v-show="tab === 'artifacts'" class="dock-pane" />
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import CanvasShell from '../canvas/CanvasShell.vue'
import ArtifactsPanel from '../artifacts/ArtifactsPanel.vue'
import BrowserPanel from '../browser/BrowserPanel.vue'
import { useCanvasStore } from '../../stores/useCanvasStore'
import { useArtifactsStore } from '../../stores/useArtifactsStore'
import { useBrowserStore } from '../../stores/useBrowserStore'

const canvas = useCanvasStore()
const artifacts = useArtifactsStore()
const browser = useBrowserStore()

const canvasAvailable = computed(() => canvas.open && canvas.hasCanvas)
const browserAvailable = computed(() => browser.open && browser.hasSession)

// Which pane is on top. Whichever surface the user (or the agent) most recently opened wins. A pane that
// is wanted but no longer there falls to one that is; with neither a canvas nor a browser the dock can
// only be showing Artifacts.
const _tab = ref('canvas')
const tab = computed(() => {
  if (_tab.value === 'canvas' && canvasAvailable.value) return 'canvas'
  if (_tab.value === 'browser' && browserAvailable.value) return 'browser'
  if (_tab.value === 'artifacts') return 'artifacts'
  if (canvasAvailable.value) return 'canvas'
  if (browserAvailable.value) return 'browser'
  return 'artifacts'
})

function select(t) {
  _tab.value = t
  if (t === 'artifacts') artifacts.unseen = 0
}

// The agent producing a design pulls the canvas forward; the user opening Artifacts pulls that forward.
watch(canvasAvailable, (on) => { if (on) _tab.value = 'canvas' })
watch(() => artifacts.open, (on) => { if (on) { _tab.value = 'artifacts'; artifacts.unseen = 0 } })
watch(browserAvailable, (on) => { if (on) _tab.value = 'browser' }, { immediate: true })

// Close the pane that is showing, then show whichever other one is still open.
function closeDock() {
  const closing = tab.value
  if (closing === 'artifacts') artifacts.closePanel()
  else if (closing === 'browser') browser.close()
  else canvas.close()
  if (closing !== 'canvas' && canvasAvailable.value) _tab.value = 'canvas'
  else if (closing !== 'browser' && browserAvailable.value) _tab.value = 'browser'
  else if (closing !== 'artifacts' && artifacts.open) _tab.value = 'artifacts'
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
