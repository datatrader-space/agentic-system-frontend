<template>
  <section class="canvas-shell" :class="{ 'is-mobile': isMobile }">
    <!-- Header -->
    <header class="cv-head">
      <div class="cv-title-wrap">
        <span class="cv-dot" :class="statusClass" :title="canvas.status"></span>
        <h3 class="cv-title" :title="canvas.title">{{ canvas.title || defaultTitle }}</h3>
        <span v-if="cap.storeInfo && canvas.route" class="cv-store-chip" :title="'Route: ' + canvas.route">{{ canvas.route }}</span>
        <span v-if="canvas.displayRevision" class="cv-rev">Revision {{ canvas.displayRevision }}</span>
      </div>
      <div class="cv-head-actions">
        <button v-if="cap.publish" class="cv-publish" title="Publish the storefront (goes live once approved)"
                :disabled="!canvas.previewUrl" @click="publish">Publish</button>
        <button class="cv-icon" title="Revision history" @click="revOpen = !revOpen" :class="{ on: revOpen }">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 3v6h6" /><path d="M12 7v5l3 2" /></svg>
        </button>
        <button v-if="cap.openInTab" class="cv-icon" title="Open in new tab" @click="openInTab" :disabled="!canOpenInTab">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="M10 14 21 3" /></svg>
        </button>
        <button class="cv-icon" title="Close canvas" @click="canvas.close()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12" stroke-linecap="round" /></svg>
        </button>
      </div>
    </header>

    <!-- Toolbar: tabs + viewport + zoom + refresh -->
    <div class="cv-toolbar">
      <div class="cv-tabs">
        <button v-for="tab in tabs" :key="tab" class="cv-tab" :class="{ active: activeTab === tab }" @click="activeTab = tab">{{ tab }}</button>
        <!-- web_builder route selector: switch the page/route the preview renders (A12). -->
        <select v-if="cap.routeSelector" class="cv-route" :value="canvas.route" title="Choose a page/route"
                @change="onRouteChange($event.target.value)">
          <option v-for="opt in pageOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </div>
      <div class="cv-tools">
        <div v-if="cap.viewport" class="cv-viewport">
          <button v-for="(v, key) in canvas.viewportPresets" :key="key" class="cv-vp" :class="{ active: canvas.viewport === key }" :title="v.label" @click="canvas.setViewport(key)">
            <svg v-if="key === 'desktop'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8m-4-4v4" /></svg>
            <svg v-else-if="key === 'tablet'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" /></svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M12 18h.01" /></svg>
          </button>
        </div>
        <span v-if="cap.viewport" class="cv-width">{{ widthLabel }}</span>
        <div v-if="cap.zoom" class="cv-zoom">
          <button class="cv-icon sm" title="Zoom out" @click="zoomBy(-10)">−</button>
          <span>{{ zoom }}%</span>
          <button class="cv-icon sm" title="Zoom in" @click="zoomBy(10)">+</button>
        </div>
        <button class="cv-icon sm" title="Refresh preview" @click="canvas.refreshPreview()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /></svg>
        </button>
        <button class="cv-icon sm" :class="{ on: canvas.selectMode }"
                :title="canvas.selectMode ? 'Click an element in the preview to select it' : 'Select an element to edit'"
                @click="toggleSelect">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3l7 18 2-7 7-2z" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>

    <!-- Revision history dropdown -->
    <div v-if="revOpen" class="cv-revlist" @mouseleave="revOpen = false">
      <!-- web_builder: Kurumera BuilderVersion history (append-only; restore creates a new version) -->
      <template v-if="isWebBuilder">
        <p v-if="!canvas.builderVersions.length" class="cv-rev-empty">No version history yet.</p>
        <button v-for="v in canvas.builderVersions" :key="v.id" class="cv-rev-row" @click="restoreVersion(v.id)">
          <span class="cv-rev-n">{{ v.label || 'Version' }}</span>
          <span class="cv-rev-sum">{{ v.created_at ? new Date(v.created_at).toLocaleString() : '' }}</span>
          <span class="cv-rev-sz">Restore</span>
        </button>
      </template>
      <!-- static: local CanvasRevision snapshots -->
      <template v-else>
        <p v-if="!canvas.revisions.length" class="cv-rev-empty">No revisions yet.</p>
        <button v-for="r in [...canvas.revisions].reverse()" :key="r.revision" class="cv-rev-row"
          :class="{ active: r.revision === (canvas.revision || canvas.activeRevision) }" @click="restore(r.revision)">
          <span class="cv-rev-n">Revision {{ r.revision }}</span>
          <span class="cv-rev-sum">{{ r.summary || '—' }}</span>
          <span class="cv-rev-sz">{{ fmtKB(r.size_bytes) }}</span>
        </button>
      </template>
    </div>

    <!-- Body -->
    <div class="cv-body">
      <!-- status overlay: keep last good preview visible underneath -->
      <div v-if="canvas.status === 'preparing' || canvas.status === 'updating'" class="cv-overlay">
        <div class="cv-spinner"></div>
        <span>{{ overlayLabel }}</span>
      </div>

      <!-- Preview tab -->
      <div v-show="activeTab === 'Preview'" class="cv-stage" :class="['vp-' + canvas.viewport, { selecting: canvas.selectMode }]">
        <div v-if="canvas.selectMode" class="cv-select-hint">Click an element in the preview to select it · Esc to cancel</div>

        <!-- web_builder: signed, short-lived, cross-origin storefront preview (Phase 3B). -->
        <template v-if="isWebBuilder">
          <div v-if="!canvas.previewUrl && canvas.previewError" class="cv-empty">
            <p>Could not load the store preview.</p>
            <button class="cv-retry-btn" @click="retryPreview">Retry</button>
          </div>
          <div v-else-if="!canvas.previewUrl && canvas.status !== 'preparing'" class="cv-empty">
            <p>Ask the agent to design your store — the live preview appears here.</p>
          </div>
          <div v-else class="cv-frame-wrap" :style="frameWrapStyle">
            <iframe
              ref="wbFrameEl"
              :key="canvas.previewSrcKey"
              :src="canvas.previewUrl"
              class="cv-frame"
              :style="frameStyle"
              sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
              referrerpolicy="no-referrer"
              title="Store preview"
              @load="onWbFrameLoad"
            ></iframe>
            <!-- Refresh failed but the last-good preview is still on screen: non-blocking Retry (A11). -->
            <div v-if="canvas.previewError" class="cv-retry-banner">
              <span>Preview didn't refresh.</span>
              <button @click="retryPreview">Retry</button>
            </div>
          </div>
        </template>

        <!-- static: local HTML rendered via <iframe srcdoc> (unchanged). -->
        <template v-else>
          <div v-if="!canvas.html && canvas.status !== 'preparing'" class="cv-empty">
            <p>Ask the agent to design a page — the live preview appears here.</p>
          </div>
          <div v-else class="cv-frame-wrap" :style="frameWrapStyle">
            <iframe
              ref="frameEl"
              :key="canvas.frameSrcKey"
              :srcdoc="frameHtml"
              class="cv-frame"
              :style="frameStyle"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              referrerpolicy="no-referrer"
              title="Design preview"
              @load="onFrameLoad"
            ></iframe>
          </div>
        </template>
      </div>

      <!-- HTML tab (static only) -->
      <pre v-if="cap.codeTabs" v-show="activeTab === 'HTML'" class="cv-code"><code>{{ canvas.html }}</code></pre>

      <!-- CSS tab (static only) -->
      <pre v-if="cap.codeTabs" v-show="activeTab === 'CSS'" class="cv-code"><code>{{ extractedCss || '/* No inline &lt;style&gt; found. */' }}</code></pre>

      <!-- Assets tab (static only) -->
      <div v-if="cap.codeTabs" v-show="activeTab === 'Assets'" class="cv-assets">
        <p v-if="!assets.length" class="cv-empty-sm">No embedded/linked images detected.</p>
        <ul v-else>
          <li v-for="(a, i) in assets" :key="i"><span class="cv-asset-kind">{{ a.kind }}</span><span class="cv-asset-src">{{ a.src }}</span></li>
        </ul>
      </div>
    </div>

    <!-- Selected-element bar (Phase 5): shows what a click targeted; the agent edits THIS on next msg. -->
    <div v-if="canvas.selectedElement" class="cv-selbar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3l7 18 2-7 7-2z" stroke-linejoin="round"/></svg>
      <span v-if="canvas.selectedElement.provider === 'web_builder'" class="cv-sel-label">Selected: <strong>{{ canvas.selectedElement.tag ? '<' + canvas.selectedElement.tag + '>' : canvas.selectedElement.element_id }}</strong>
        <em v-if="canvas.selectedElement.label">{{ canvas.selectedElement.label }}</em></span>
      <span v-else class="cv-sel-label">Selected: <strong>&lt;{{ canvas.selectedElement.tag }}&gt;</strong>
        <em v-if="canvas.selectedElement.label">{{ canvas.selectedElement.label }}</em></span>
      <span class="cv-sel-hint">— tell the agent what to change</span>
      <button class="cv-sel-x" title="Clear selection" @click="canvas.clearSelection()">×</button>
    </div>

    <!-- Footer summary card -->
    <footer class="cv-foot">
      <!-- static: the downloadable HTML document -->
      <template v-if="!isWebBuilder">
        <div class="cv-foot-file">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
          <div>
            <strong>index.html</strong>
            <small>{{ fmtKB(currentSize) }} · HTML Document · rev {{ canvas.displayRevision }}</small>
          </div>
        </div>
        <button v-if="cap.download" class="cv-foot-btn" @click="download" :disabled="!canvas.html">Download</button>
      </template>
      <!-- web_builder: the live storefront (store / page / route) -->
      <template v-else>
        <div class="cv-foot-file">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9" stroke-linecap="round"/></svg>
          <div>
            <strong>{{ canvas.title || 'Storefront' }}</strong>
            <small>{{ canvas.route }} · Web Builder · rev {{ canvas.displayRevision }}</small>
          </div>
        </div>
      </template>
    </footer>
  </section>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useCanvasStore } from '../../stores/useCanvasStore'

const canvas = useCanvasStore()
// Provider-aware chrome: the capability map (keyed by provider) decides which tabs/controls render.
const cap = computed(() => canvas.capabilities)
const isWebBuilder = computed(() => canvas.isWebBuilder)
const tabs = computed(() => cap.value.tabs)
const defaultTitle = computed(() => (isWebBuilder.value ? 'Store Preview' : 'Static Design Canvas'))
const activeTab = ref('Preview')
const revOpen = ref(false)
const zoom = ref(100)
const frameEl = ref(null)     // static provider: <iframe srcdoc> element
const wbFrameEl = ref(null)   // web_builder provider: signed cross-origin <iframe src> element
const isMobile = computed(() => typeof window !== 'undefined' && window.innerWidth < 768)

// Keep the active tab valid when the provider changes (web_builder has only 'Preview').
watch(tabs, (list) => { if (!list.includes(activeTab.value)) activeTab.value = 'Preview' }, { immediate: true })

const overlayLabel = computed(() => {
  if (isWebBuilder.value) return canvas.status === 'updating' ? 'Updating store…' : 'Preparing store preview…'
  return canvas.status === 'updating' ? 'Updating design…' : 'Preparing live preview…'
})

// web_builder route selector options — always include the active route so the <select> has a value even
// before the page list arrives from the backend.
const pageOptions = computed(() => {
  const list = (canvas.pages || []).map((p) => ({
    value: p.route ?? p.handle ?? p.id,
    label: p.name || p.route || p.handle || String(p.id),
  }))
  if (!list.some((o) => o.value === canvas.route)) list.unshift({ value: canvas.route, label: canvas.route || '/' })
  return list
})
function onRouteChange(v) { canvas.switchRoute(v) }
function retryPreview() { canvas.loadPreviewUrl() }
function publish() { canvas.publish() }
const canOpenInTab = computed(() => (isWebBuilder.value ? !!canvas.previewUrl : !!canvas.html))

// Phase 5 click-to-select — a tiny bridge script injected into the previewed page. When "armed" by
// the parent it outlines elements on hover and, on click, posts the clicked element's markup back to
// this component (which stores it as the edit target). Kept self-contained; talks only via postMessage.
// NOTE: `<\/script>` is escaped so the Vue SFC compiler doesn't treat it as the end of this block.
const SELECT_BRIDGE = `
<script data-cv-bridge>(function(){
  if (window.__cvBridge) return; window.__cvBridge = true;
  var armed = false, hovered = null, picked = null;
  var OUT = '2px solid #6d28d9', HOV = '2px dashed #a78bfa';
  function clearHover(){ if(hovered){ hovered.style.outline = (hovered===picked)?OUT:''; hovered=null; } }
  function setPicked(el){ if(picked && picked!==el){ picked.style.outline=''; } picked=el; if(el){ el.style.outline=OUT; el.style.outlineOffset='1px'; } }
  function onOver(e){ if(!armed) return; if(e.target===document.body||e.target===document.documentElement) return; clearHover(); hovered=e.target; if(hovered!==picked){ hovered.style.outline=HOV; hovered.style.outlineOffset='1px'; } }
  function onOut(e){ if(!armed) return; if(hovered && hovered!==picked) hovered.style.outline=''; hovered=null; }
  function onClick(e){ if(!armed) return; var el=e.target; if(!el||el===document.body||el===document.documentElement) return; e.preventDefault(); e.stopPropagation();
    setPicked(el);
    var text=(el.textContent||'').replace(/\\s+/g,' ').trim().slice(0,80);
    var oh=el.outerHTML||''; var trunc=oh.length>6000; if(trunc) oh=oh.slice(0,6000);
    armed=false; clearHover();
    parent.postMessage({source:'cv-bridge', type:'cv-selected', payload:{tag:(el.tagName||'').toLowerCase(), label:text, html:oh, truncated:trunc}}, '*');
  }
  document.addEventListener('mouseover', onOver, true);
  document.addEventListener('mouseout', onOut, true);
  document.addEventListener('click', onClick, true);
  window.addEventListener('message', function(ev){ var d=ev.data||{}; if(d.type==='cv-arm'){ armed=!!d.armed; if(!armed) clearHover(); } else if(d.type==='cv-clear'){ setPicked(null); } });
})();<\/script>`

function injectBridge(html) {
  if (!html) return html
  const idx = html.toLowerCase().lastIndexOf('</body>')
  return idx >= 0 ? html.slice(0, idx) + SELECT_BRIDGE + html.slice(idx) : html + SELECT_BRIDGE
}
const frameHtml = computed(() => injectBridge(canvas.html))

function armFrame(on) {
  try { frameEl.value?.contentWindow?.postMessage({ type: 'cv-arm', armed: !!on }, '*') } catch (_e) { /* ignore */ }
}
// web_builder: the preview is CROSS-ORIGIN, so we can't inject the srcdoc bridge. We post an "arm"
// message to the trusted preview origin (its own in-page listener does the outlining) and receive the
// stable element id back via postMessage (validated in onWindowMessage). Best-effort — the parent side
// is what this ticket owns; the in-preview selection listener is a renderer/backend concern.
function armWbFrame(on) {
  try {
    wbFrameEl.value?.contentWindow?.postMessage(
      { type: 'canvas:arm', armed: !!on },
      canvas.trustedOrigin || '*',
    )
  } catch (_e) { /* ignore */ }
}
function toggleSelect() {
  canvas.setSelectMode(!canvas.selectMode)
  if (isWebBuilder.value) armWbFrame(canvas.selectMode)
  else armFrame(canvas.selectMode)
}
function onFrameLoad() {
  // Re-assert armed state after a (re)load; restore the persistent highlight if something is selected.
  armFrame(canvas.selectMode)
}
function onWbFrameLoad() {
  armWbFrame(canvas.selectMode)
}
function onWindowMessage(ev) {
  const d = ev?.data
  if (!d) return
  // ── web_builder: stable-id selection from the cross-origin preview (A13). ──
  // VALIDATE origin === the trusted preview host AND source === our iframe's window before trusting it.
  if (isWebBuilder.value && d.type === 'canvas:element-selected') {
    const trusted = canvas.trustedOrigin
    if (trusted && ev.origin !== trusted) return
    if (wbFrameEl.value && ev.source !== wbFrameEl.value.contentWindow) return
    if (!d.element_id) return
    canvas.setSelectedElement({
      provider: 'web_builder',
      element_id: d.element_id,
      tag: d.tag || '',
      label: (d.label || '').toString().slice(0, 80),
    })
    armWbFrame(false)
    return
  }
  // ── static: srcdoc bridge (unchanged). ──
  if (d.source !== 'cv-bridge' || d.type !== 'cv-selected') return
  // Only trust our own iframe.
  if (frameEl.value && ev.source !== frameEl.value.contentWindow) return
  canvas.setSelectedElement(d.payload || null)   // also flips selectMode off in the store
  armFrame(false)
}
function onKey(e) {
  if (e.key === 'Escape' && canvas.selectMode) { canvas.setSelectMode(false); armFrame(false) }
}
watch(() => canvas.selectMode, (v) => { if (isWebBuilder.value) armWbFrame(v); else armFrame(v) })
watch(() => canvas.selectedElement, (v) => {
  if (v) return
  try {
    if (isWebBuilder.value) wbFrameEl.value?.contentWindow?.postMessage({ type: 'canvas:clear' }, canvas.trustedOrigin || '*')
    else frameEl.value?.contentWindow?.postMessage({ type: 'cv-clear' }, '*')
  } catch (_e) { /* ignore */ }
})
onMounted(() => { window.addEventListener('message', onWindowMessage); window.addEventListener('keydown', onKey) })
onBeforeUnmount(() => { window.removeEventListener('message', onWindowMessage); window.removeEventListener('keydown', onKey) })

const statusClass = computed(() => ({
  live: canvas.status === 'live',
  busy: canvas.status === 'preparing' || canvas.status === 'updating',
  err: canvas.status === 'error',
}))

const widthLabel = computed(() => {
  const preset = canvas.viewportPresets[canvas.viewport]
  if (preset?.width) return `${preset.width}px`
  return canvas.designWidth ? `Auto (${canvas.designWidth})` : 'Auto'
})

const currentSize = computed(() => {
  const r = canvas.revisions.find((x) => x.revision === (canvas.revision || canvas.activeRevision))
  return r?.size_bytes || (canvas.html ? new Blob([canvas.html]).size : 0)
})

const frameStyle = computed(() => {
  const preset = canvas.viewportPresets[canvas.viewport]
  const scale = zoom.value / 100
  const s = { transform: `scale(${scale})`, transformOrigin: 'top center' }
  if (preset?.width) s.width = preset.width + 'px'
  return s
})
const frameWrapStyle = computed(() => {
  const preset = canvas.viewportPresets[canvas.viewport]
  return preset?.width ? { maxWidth: preset.width + 'px' } : {}
})

const extractedCss = computed(() => {
  const out = []
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi
  let mm
  while ((mm = re.exec(canvas.html))) out.push(mm[1].trim())
  return out.join('\n\n')
})

const assets = computed(() => {
  const list = []
  const re = /<img[^>]*\ssrc=["']([^"']+)["']/gi
  let mm
  while ((mm = re.exec(canvas.html))) {
    const src = mm[1]
    list.push({ kind: src.startsWith('data:') ? 'embedded' : 'linked', src: src.slice(0, 120) })
  }
  return list
})

function zoomBy(d) { zoom.value = Math.max(40, Math.min(150, zoom.value + d)) }
function fmtKB(b) { return b ? `${(b / 1024).toFixed(1)} KB` : '—' }

function restore(rev) {
  revOpen.value = false
  if (rev !== (canvas.revision || canvas.activeRevision)) canvas.restoreRevision(rev)
}

// web_builder: restore a Kurumera BuilderVersion by its id (append-only → creates a new version).
function restoreVersion(versionId) {
  revOpen.value = false
  canvas.restoreBuilderVersion(versionId)
}

function openInTab() {
  // web_builder: open the signed preview URL directly (cross-origin, short-lived).
  if (isWebBuilder.value) {
    if (canvas.previewUrl) window.open(canvas.previewUrl, '_blank', 'noopener,noreferrer')
    return
  }
  if (!canvas.html) return
  const blob = new Blob([canvas.html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
function download() {
  if (!canvas.html) return
  const blob = new Blob([canvas.html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'index.html'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
</script>

<style scoped>
.canvas-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--vm-bg, #fff);
  border-left: 1px solid var(--vm-line, #e5e7eb);
  font-family: var(--vm-font-sans);
}
.cv-head {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 10px 14px; border-bottom: 1px solid var(--vm-line, #e5e7eb); flex-shrink: 0;
}
.cv-title-wrap { display: flex; align-items: center; gap: 8px; min-width: 0; }
.cv-dot { width: 8px; height: 8px; border-radius: 50%; background: #94a3b8; flex: 0 0 auto; }
.cv-dot.live { background: #10b981; }
.cv-dot.busy { background: #f59e0b; animation: cvpulse 1s infinite; }
.cv-dot.err { background: #ef4444; }
@keyframes cvpulse { 50% { opacity: .35; } }
.cv-title { margin: 0; font-size: .9rem; font-weight: 700; color: var(--vm-ink, #111827); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cv-rev { font-size: .68rem; font-weight: 700; color: #6d28d9; background: #ede9fe; padding: 2px 8px; border-radius: 9999px; flex: 0 0 auto; }
.cv-store-chip { font-size: .68rem; font-weight: 600; color: var(--vm-ink-soft, #4b5563); background: var(--vm-surface-2, #f3f4f6); padding: 2px 8px; border-radius: 9999px; flex: 0 0 auto; font-family: var(--vm-font-mono, ui-monospace, monospace); max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cv-head-actions { display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; }
.cv-publish { border: 0; background: var(--vm-g-cool, #6d28d9); color: #fff; border-radius: 8px; padding: 6px 14px; font-size: .76rem; font-weight: 700; cursor: pointer; }
.cv-publish:hover:not(:disabled) { filter: brightness(1.06); }
.cv-publish:disabled { opacity: .45; cursor: default; }
.cv-route { max-width: 180px; height: 30px; border: 1px solid var(--vm-line-2, #e5e7eb); background: var(--vm-surface, #fff); border-radius: 8px; padding: 0 8px; font-size: .76rem; color: var(--vm-ink, #111827); cursor: pointer; margin-left: 6px; }
.cv-retry-btn { margin-top: 10px; border: 1px solid #c4b5fd; background: #f5f3ff; color: #6d28d9; border-radius: 8px; padding: 6px 16px; font-size: .78rem; font-weight: 600; cursor: pointer; }
.cv-retry-btn:hover { filter: brightness(.98); }
.cv-retry-banner { position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); z-index: 13; display: inline-flex; align-items: center; gap: 10px; background: #1f2937; color: #fff; font-size: .74rem; font-weight: 600; padding: 6px 8px 6px 14px; border-radius: 9999px; box-shadow: 0 6px 18px rgba(0,0,0,.25); }
.cv-retry-banner button { border: 0; background: #6d28d9; color: #fff; border-radius: 9999px; padding: 4px 12px; font-size: .72rem; font-weight: 700; cursor: pointer; }
.cv-icon { width: 30px; height: 30px; display: inline-grid; place-items: center; border: 1px solid var(--vm-line-2, #e5e7eb); background: var(--vm-surface, #fff); border-radius: 8px; color: var(--vm-ink-soft, #4b5563); cursor: pointer; }
.cv-icon.sm { width: 26px; height: 26px; font-size: 14px; }
.cv-icon:hover:not(:disabled) { color: #6d28d9; border-color: #c4b5fd; }
.cv-icon.on { color: #6d28d9; border-color: #c4b5fd; background: #f5f3ff; }
.cv-icon svg { width: 15px; height: 15px; }
.cv-icon:disabled { opacity: .4; cursor: default; }
.cv-toolbar {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 7px 12px; border-bottom: 1px solid var(--vm-line, #e5e7eb); flex-wrap: wrap; flex-shrink: 0;
}
.cv-tabs { display: inline-flex; gap: 2px; background: var(--vm-surface-2, #f3f4f6); border-radius: 9px; padding: 3px; }
.cv-tab { border: 0; background: transparent; padding: 5px 12px; border-radius: 7px; font-size: .78rem; font-weight: 600; color: var(--vm-ink-soft, #6b7280); cursor: pointer; }
.cv-tab.active { background: var(--vm-bg, #fff); color: #6d28d9; box-shadow: 0 1px 2px rgba(0,0,0,.06); }
.cv-tools { display: inline-flex; align-items: center; gap: 8px; }
.cv-viewport { display: inline-flex; gap: 2px; background: var(--vm-surface-2, #f3f4f6); border-radius: 8px; padding: 2px; }
.cv-vp { width: 28px; height: 26px; display: inline-grid; place-items: center; border: 0; background: transparent; border-radius: 6px; color: var(--vm-ink-soft, #6b7280); cursor: pointer; }
.cv-vp.active { background: var(--vm-bg, #fff); color: #6d28d9; box-shadow: 0 1px 2px rgba(0,0,0,.06); }
.cv-vp svg { width: 15px; height: 15px; }
.cv-width { font-size: .72rem; color: var(--vm-ink-soft, #6b7280); font-variant-numeric: tabular-nums; min-width: 84px; text-align: center; }
.cv-zoom { display: inline-flex; align-items: center; gap: 4px; font-size: .72rem; font-variant-numeric: tabular-nums; color: var(--vm-ink-soft, #6b7280); }
.cv-revlist { position: absolute; z-index: 20; right: 14px; top: 92px; width: 320px; max-height: 320px; overflow-y: auto; background: var(--vm-bg, #fff); border: 1px solid var(--vm-line, #e5e7eb); border-radius: 10px; box-shadow: 0 18px 40px rgba(0,0,0,.18); padding: 6px; }
.cv-rev-empty, .cv-empty-sm { color: var(--vm-ink-soft, #6b7280); font-size: .78rem; text-align: center; padding: 14px; }
.cv-rev-row { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: center; width: 100%; text-align: left; border: 0; background: transparent; padding: 8px; border-radius: 7px; cursor: pointer; }
.cv-rev-row:hover, .cv-rev-row.active { background: #f5f3ff; }
.cv-rev-n { font-size: .74rem; font-weight: 700; color: #6d28d9; }
.cv-rev-sum { font-size: .74rem; color: var(--vm-ink-soft, #4b5563); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cv-rev-sz { font-size: .68rem; color: #9ca3af; }
.cv-body { position: relative; flex: 1; min-height: 0; overflow: hidden; background: var(--vm-surface-2, #f6f7f9); }
.cv-overlay { position: absolute; inset: 0; z-index: 10; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; background: rgba(255,255,255,.55); backdrop-filter: blur(2px); color: var(--vm-ink-soft, #4b5563); font-size: .82rem; font-weight: 600; }
.cv-spinner { width: 26px; height: 26px; border: 3px solid #ddd6fe; border-top-color: #6d28d9; border-radius: 50%; animation: cvspin .8s linear infinite; }
@keyframes cvspin { to { transform: rotate(360deg); } }
.cv-stage { height: 100%; overflow: auto; display: flex; justify-content: center; padding: 16px; }
.cv-stage.vp-desktop { padding: 0; }
.cv-frame-wrap { width: 100%; height: 100%; background: #fff; box-shadow: 0 2px 14px rgba(0,0,0,.08); }
.cv-stage:not(.vp-desktop) .cv-frame-wrap { border-radius: 12px; overflow: hidden; align-self: flex-start; height: auto; min-height: 100%; }
.cv-frame { width: 100%; height: 100%; min-height: 100%; border: 0; display: block; background: #fff; }
.cv-empty { display: grid; place-items: center; height: 100%; color: var(--vm-ink-soft, #9ca3af); font-size: .85rem; padding: 24px; text-align: center; }
.cv-code { height: 100%; overflow: auto; margin: 0; padding: 14px; font-family: var(--vm-font-mono, ui-monospace, monospace); font-size: .74rem; line-height: 1.5; color: var(--vm-ink, #1f2937); background: var(--vm-bg, #fff); white-space: pre-wrap; word-break: break-word; }
.cv-assets { height: 100%; overflow: auto; padding: 14px; }
.cv-assets ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.cv-assets li { display: flex; gap: 8px; font-size: .74rem; align-items: baseline; }
.cv-asset-kind { flex: 0 0 auto; font-weight: 700; color: #6d28d9; text-transform: uppercase; font-size: .62rem; }
.cv-asset-src { color: var(--vm-ink-soft, #4b5563); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--vm-font-mono, monospace); }
.cv-select-hint { position: absolute; top: 8px; left: 50%; transform: translateX(-50%); z-index: 12; background: #6d28d9; color: #fff; font-size: .72rem; font-weight: 600; padding: 4px 12px; border-radius: 9999px; box-shadow: 0 4px 12px rgba(109,40,217,.3); }
.cv-stage.selecting { cursor: crosshair; }
.cv-selbar { display: flex; align-items: center; gap: 8px; padding: 7px 14px; border-top: 1px solid var(--vm-violet, #c4b5fd); background: var(--vm-violet-soft, #f5f3ff); color: var(--vm-violet, #6d28d9); flex-shrink: 0; font-size: .78rem; }
.cv-selbar svg { width: 15px; height: 15px; flex: 0 0 auto; }
.cv-sel-label { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cv-sel-label em { font-style: normal; opacity: .8; font-weight: 500; }
.cv-sel-hint { color: var(--vm-ink-soft, #6b7280); font-weight: 500; white-space: nowrap; }
.cv-sel-x { margin-left: auto; width: 22px; height: 22px; display: inline-grid; place-items: center; border: 0; border-radius: 6px; background: transparent; color: var(--vm-violet, #6d28d9); font-size: 16px; cursor: pointer; flex: 0 0 auto; }
.cv-sel-x:hover { background: rgba(109,40,217,.14); }
.cv-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 14px; border-top: 1px solid var(--vm-line, #e5e7eb); flex-shrink: 0; }
.cv-foot-file { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
.cv-foot-file svg { width: 18px; height: 18px; color: #6d28d9; flex: 0 0 auto; }
.cv-foot-file strong { font-size: .78rem; color: var(--vm-ink, #111827); display: block; }
.cv-foot-file small { font-size: .68rem; color: var(--vm-ink-soft, #6b7280); }
.cv-foot-btn { border: 1px solid var(--vm-line-2, #e5e7eb); background: var(--vm-surface, #fff); border-radius: 8px; padding: 6px 14px; font-size: .76rem; font-weight: 600; color: var(--vm-ink-soft, #4b5563); cursor: pointer; }
.cv-foot-btn:hover:not(:disabled) { color: #6d28d9; border-color: #c4b5fd; }
.cv-foot-btn:disabled { opacity: .4; cursor: default; }
</style>
