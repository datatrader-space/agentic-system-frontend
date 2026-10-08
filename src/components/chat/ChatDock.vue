<template>
  <!-- EXPANDED: the same dock, drawn large over the chat with a dimmed surround, so the browser's page
       can be read. One root element either way, so the pane keeps the size the chat gives it when it is
       not expanded. A click on the dimmed surround puts it back in the side dock. -->
  <section class="dock" :class="{ expanded: isExpanded }" data-test="dock"
           @click.self="isExpanded && browser.collapse()">
   <div class="dock-box">
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
      <button v-if="tab === 'browser'" class="dock-expand" data-test="dock-expand"
              :title="isExpanded ? 'Back to the side panel' : 'Expand the browser view'"
              :aria-label="isExpanded ? 'Back to the side panel' : 'Expand the browser view'"
              :aria-pressed="isExpanded" @click="isExpanded ? browser.collapse() : browser.expand()">
        <svg v-if="isExpanded" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>
      </button>
      <button class="dock-x" :class="{ 'after-expand': tab === 'browser' }" title="Close panel" aria-label="Close panel" @click="closeDock">
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
   </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
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

// Expanded only while the Browser tab is the one on top: switching to Artifacts shows the ordinary dock.
const isExpanded = computed(() => browser.expanded && tab.value === 'browser')

// Escape puts the view back in the side dock — except while the person is driving the browser, when
// Escape is a key for the remote page (closing a menu there), not for us.
function onKey(event) {
  if (event.key === 'Escape' && isExpanded.value && !browser.mine) browser.collapse()
}
watch(isExpanded, (on) => {
  if (typeof window === 'undefined') return
  if (on) window.addEventListener('keydown', onKey)
  else window.removeEventListener('keydown', onKey)
}, { immediate: true })
onBeforeUnmount(() => { if (typeof window !== 'undefined') window.removeEventListener('keydown', onKey) })

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
.dock { height: 100%; min-height: 0; background: var(--vm-surface, #fff); border-left: 1px solid var(--vm-line-2, #e5e7eb); }
.dock-box { display: flex; flex-direction: column; height: 100%; min-height: 0; }
/* Expanded: over the chat, above its header and the floating help button, below our own dialogs (the
   take-control question and approval cards must stay on top of it). `!important` because the chat gives
   the docked pane an inline width, which means nothing once it is drawn over the page. */
.dock.expanded { position: fixed; inset: 0; z-index: 1500; width: auto !important; height: auto; flex: none !important;
  border-left: none; background: rgba(15, 23, 42, .55); display: grid; place-items: center; padding: 20px; }
.dock.expanded .dock-box { width: min(1480px, 100%); height: 100%; background: var(--vm-surface, #fff); border-radius: 14px; overflow: hidden;
  box-shadow: 0 24px 64px rgba(15, 23, 42, .35); }
.dock-x.after-expand { margin-left: 2px; }
@media (max-width: 640px) { .dock.expanded { padding: 0; } .dock.expanded .dock-box { border-radius: 0; } }
.dock-tabs { display: flex; align-items: center; gap: 4px; padding: 6px 8px; border-bottom: 1px solid var(--vm-line-2, #e5e7eb); }
.dock-tab { position: relative; display: inline-flex; align-items: center; gap: 6px; border: none; background: transparent; border-radius: 9px; padding: 6px 12px; font-size: 12.5px; font-weight: 700; color: var(--vm-ink-soft, #64748b); cursor: pointer; }
.dock-tab:hover { background: var(--vm-surface-2, #f1f5f9); }
.dock-tab.on { background: var(--vm-violet-soft, #eef2ff); color: var(--vm-violet-d, #4f46e5); }
.dock-badge { min-width: 16px; height: 16px; padding: 0 4px; border-radius: 9999px; background: var(--vm-violet-d, #4f46e5); color: #fff; font-size: 10px; font-weight: 700; display: grid; place-items: center; }
.dock-x, .dock-expand { margin-left: auto; display: grid; place-items: center; width: 28px; height: 28px; border: none; background: transparent; border-radius: 8px; color: var(--vm-ink-soft, #64748b); cursor: pointer; }
.dock-x:hover, .dock-expand:hover { background: var(--vm-surface-2, #f1f5f9); }
.dock-x svg, .dock-expand svg { width: 15px; height: 15px; }
.dock-expand[aria-pressed="true"] { color: var(--vm-violet-d, #4f46e5); }
.dock-body { flex: 1 1 auto; min-height: 0; position: relative; }
.dock-pane { height: 100%; min-height: 0; }
</style>
