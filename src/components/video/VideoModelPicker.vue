<template>
  <!-- The model picker (owner, 2026-10-19: "show models list nice, not raw"). A pill that opens a panel: search,
       Auto (the agent's pick), then every offered model grouped by maker, each with what it can do in plain words.
       kind 'video' lists video models, kind 'image' the image models of Image mode (D14). Picking goes through
       pickRoute / pickImageModel, so a model that would change a setting shows the switch notice first (never
       silently). In the phone settings sheet the list opens in place instead of floating. -->
  <div ref="root" class="vmp" :class="{ 'in-sheet': inSheet, 'two-line': twoLine }" @keydown.esc.stop="close">
    <button ref="trigger" type="button" class="vmp-pill" :data-test="isImage ? 'image-model' : 'video-route'" aria-haspopup="listbox"
            :aria-expanded="open ? 'true' : 'false'" :aria-label="noun + ': ' + (twoLine ? selectionLabel + ', ' + resolvedName : currentLabel)" :title="twoLine ? resolvedName : currentLabel" @click="toggle">
      <span class="vmp-ic" aria-hidden="true" v-html="isImage ? ICON.image : ICON.clip"></span>
      <span v-if="inSheet" class="vmp-pill-label">{{ noun }}</span>
      <span v-if="twoLine" class="vmp-pill-copy"><span class="vmp-pill-primary">{{ selectionLabel }}</span><span v-if="resolvedName" class="vmp-pill-secondary" :title="resolvedName">{{ resolvedName }}</span></span><span v-else class="vmp-pill-text">{{ currentLabel }}</span>
      <span class="vmp-chev" aria-hidden="true" v-html="ICON.chev"></span>
    </button>

    <div v-if="open" class="vmp-panel" :class="{ 'align-end': alignEnd }" :data-test="kind + '-model-panel'">
      <label class="vmp-search">
        <span class="vmp-sr">Search {{ isImage ? 'image' : 'video' }} models</span>
        <span class="vmp-search-ic" aria-hidden="true" v-html="ICON.search"></span>
        <input ref="searchEl" v-model="q" type="search" placeholder="Search models" autocomplete="off" @keydown.down.prevent="focusOption(0)" />
      </label>
      <div class="vmp-list" role="listbox" :aria-label="isImage ? 'Image models' : 'Video models'" @keydown="onListKey">
        <button v-if="!q" type="button" role="option" class="vmp-opt" :class="{ on: !selectedId }" :aria-selected="!selectedId ? 'true' : 'false'"
                :data-test="kind + '-model-auto'" @click="pick('')">
          <span class="vmp-opt-main">
            <span class="vmp-opt-name">Auto</span>
            <span class="vmp-opt-meta">{{ autoMeta }}</span>
          </span>
          <span v-if="!selectedId" class="vmp-check" aria-hidden="true" v-html="ICON.check"></span>
        </button>
        <template v-for="g in groups" :key="g.maker">
          <p class="vmp-group" role="presentation">{{ g.maker }}</p>
          <button v-for="r in g.models" :key="idOf(r)" type="button" role="option" class="vmp-opt" :class="{ on: isSelected(r), off: !usable(r) }"
                  :aria-selected="isSelected(r) ? 'true' : 'false'" :aria-disabled="usable(r) ? undefined : 'true'"
                  :data-test="kind + '-model-' + idOf(r)" @click="usable(r) && pick(String(idOf(r)))">
            <span class="vmp-opt-main">
              <span class="vmp-opt-name">{{ nameOf(r) }}
                <span v-if="ownKey(r)" class="vmp-tag" title="Renders on your own provider key">Your key</span></span>
              <span class="vmp-opt-meta">{{ describe(r) }}</span>
              <span v-if="!isImage && r.references && r.references.summary" class="vmp-opt-meta" :data-test="kind + '-model-refs-' + idOf(r)">{{ r.references.summary }}</span>
            </span>
            <span v-if="isSelected(r)" class="vmp-check" aria-hidden="true" v-html="ICON.check"></span>
          </button>
        </template>
        <p v-if="q && !groups.length" class="vmp-none">No model matches “{{ q }}”.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useVideoStore } from '../../stores/useVideoStore'

const props = defineProps({ inSheet: { type: Boolean, default: false }, kind: { type: String, default: 'video' }, twoLine: Boolean })
const video = useVideoStore()
const isImage = computed(() => props.kind === 'image')
const noun = computed(() => (isImage.value ? 'Image model' : 'Video model'))
const items = computed(() => (isImage.value ? video.image.models : video.routes))
function idOf(r) { return isImage.value ? r.model_id : r.route_id }
const root = ref(null)
const trigger = ref(null)
const searchEl = ref(null)
const open = ref(false)
const q = ref('')
// A panel that would run past the right edge of the window opens from the pill's right edge instead.
const alignEnd = ref(false)

const S = (d, w = '1.8') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`
const ICON = {
  clip: S('<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>'),
  image: S('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M3 17l5-5 4 4 3-3 6 6"/>'),
  chev: S('<path d="M7 10l5 5 5-5"/>', '2'),
  check: S('<path d="M5 12.5l4.5 4.5L19 7.5"/>', '2.2'),
  search: S('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>'),
}

// While a switch waits for the person, the picker shows the model they chose.
const selectedId = computed(() => {
  const p = video.pendingSwitch
  if (isImage.value) return String(p && p.kind === 'image' ? p.modelId : (video.image.modelId || ''))
  return String(p && p.kind !== 'image' ? p.routeId : (video.routeId || ''))
})
// The default may be any connection of a model (the user's own key, a second connection), not only the first.
function hasRoute(r, id) {
  if (isImage.value) return String(r.model_id) === String(id)
  return String(r.route_id) === String(id) || (r.connections || []).some((c) => String(c.route_id) === String(id))
}
const defaultId = computed(() => (isImage.value ? video.image.defaultModelId : video.defaultRouteId))
const autoName = computed(() => {
  const r = defaultId.value ? items.value.find((x) => hasRoute(x, defaultId.value)) : null
  return r ? nameOf(r) : ''
})
const autoMeta = computed(() => {
  if (isImage.value) return autoName.value ? `The agent's image model, ${autoName.value}` : "The agent's image model"
  return autoName.value ? `The agent picks ${autoName.value} unless a task needs another` : 'The agent picks a model for each task'
})
const currentLabel = computed(() => {
  const r = selectedId.value && items.value.find((x) => hasRoute(x, selectedId.value))
  return r ? nameOf(r) : `Auto${autoName.value ? ` (${autoName.value})` : ''}`
})
const selectionLabel = computed(() => selectedId.value ? 'Selected model' : 'Auto')
const resolvedName = computed(() => selectedId.value ? currentLabel.value : autoName.value)
function isSelected(r) { return !!selectedId.value && hasRoute(r, selectedId.value) }

// "Google: Veo 3.1" → maker "Google", model "Veo 3.1". An image model carries its maker.
function maker(r) {
  if (isImage.value) return r.maker || 'Other'
  const i = String(r.name || '').indexOf(': ')
  return i > 0 ? r.name.slice(0, i) : (r.creator || 'Other')
}
function shortName(name) { const s = String(name || ''); const i = s.indexOf(': '); return i > 0 ? s.slice(i + 2) : s }
function nameOf(r) { return isImage.value ? String(r.name || r.model || '') : shortName(r.name) }
const mixed = computed(() => (isImage.value ? video.image.models.some((r) => r.platform)
  : video.routes.some((r) => (r.connections || []).some((c) => c.connection === 'AADML'))))
function ownKey(r) {
  if (isImage.value) return mixed.value && !!r.own_key
  return mixed.value && (r.connections || []).some((c) => c.connection && c.connection !== 'AADML')
}
function usable(r) { return isImage.value || (r.state === 'active' && (r.offered || []).length > 0) }

const RES = ['480p', '540p', '720p', '768p', '1080p', '2K', '4K']
// An image model in plain words: its shapes, how many reference images it takes, its price when known.
function describeImage(r) {
  const sh = r.shapes || []
  // The shapes a video starts from (16:9, 9:16) are named first: an image here is often a video's opening shot.
  const video = ['16:9', '9:16'].filter((x) => sh.includes(x))
  const parts = [sh.length <= 1 ? 'Square only'
    : video.length ? `${sh.length} shapes, including ${video.join(' and ')}` : `${sh.length} shapes: ${sh.join(', ')}`]
  const n = Number(r.max_references || 0)
  parts.push(n ? `up to ${n} reference image${n === 1 ? '' : 's'}` : 'from words only')
  if (r.price_per_image) parts.push(`$${Number(r.price_per_image).toFixed(3)} an image`)
  return parts.join(', ')
}
// What the model does, in plain words: what it starts from, its clip lengths, its best resolution, sound.
function describe(r) {
  if (isImage.value) return describeImage(r)
  if (r.state !== 'active') return 'Not offered right now'
  const t = new Set(r.offered || [])
  if (!t.size) return 'Not available for new videos yet'
  const from = [t.has('text_to_video') && 'text', t.has('image_to_video') && 'an image'].filter(Boolean)
  const parts = [from.length ? `From ${from.join(' or ')}` : 'Edits video']
  if (t.has('first_last_frame')) parts.push('opening and closing shots')
  // The reference limits get their own line (refLine); without that data, say only that it takes references.
  if (t.has('reference_to_video') && !(r.references && r.references.summary)) parts.push('references')
  if (t.has('edit_uploaded') || t.has('edit_generated')) parts.push('edits video')
  const o = r.outputs || {}
  const d = (o.durations || []).map(Number).filter((n) => n > 0)
  if (d.length) { const lo = Math.min(...d); const hi = Math.max(...d); parts.push(lo === hi ? `${lo} s` : `${lo}–${hi} s`) }
  const best = (o.resolutions || []).slice().sort((a, b) => RES.indexOf(a) - RES.indexOf(b)).pop()
  if (best) parts.push(`up to ${best}`)
  if (o.audio) parts.push('sound')
  return parts.join(', ')
}
const groups = computed(() => {
  const term = q.value.trim().toLowerCase()
  const by = {}
  for (const r of items.value) {
    if (term && !`${r.name} ${r.model_id} ${r.model || ''} ${describe(r)}`.toLowerCase().includes(term)) continue
    ;(by[maker(r)] = by[maker(r)] || []).push(r)
  }
  return Object.keys(by).sort((a, b) => a.localeCompare(b)).map((m) => ({
    maker: m,
    // Usable models first, then by name.
    models: by[m].sort((a, b) => (usable(b) - usable(a)) || nameOf(a).localeCompare(nameOf(b))),
  }))
})

async function toggle() {
  open.value = !open.value
  if (!open.value) return
  q.value = ''
  alignEnd.value = false
  await nextTick()
  const panel = root.value && root.value.querySelector('.vmp-panel')
  if (panel && getComputedStyle(panel).position === 'absolute' && panel.getBoundingClientRect().right > window.innerWidth - 8) alignEnd.value = true
  searchEl.value?.focus()
}
function close() { if (open.value) { open.value = false; trigger.value?.focus() } }
function pick(id) {
  if (isImage.value) video.pickImageModel(id)
  else video.pickRoute(id)
  close()
}
function options() { return Array.from(root.value?.querySelectorAll('.vmp-opt:not(.off)') || []) }
function focusOption(i) { const list = options(); if (list.length) list[Math.max(0, Math.min(i, list.length - 1))].focus() }
function onListKey(e) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
  e.preventDefault()
  const list = options()
  const i = list.indexOf(document.activeElement)
  if (e.key === 'Home') return focusOption(0)
  if (e.key === 'End') return focusOption(list.length - 1)
  if (e.key === 'ArrowUp' && i <= 0) return searchEl.value?.focus()
  focusOption(i + (e.key === 'ArrowDown' ? 1 : -1))
}
function onOutside(e) { if (open.value && root.value && !root.value.contains(e.target)) open.value = false }
onMounted(() => document.addEventListener('pointerdown', onOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside))
</script>

<style scoped>
/* The cap sits on the wrapper: a percentage cap on the pill alone does not shrink the wrapper in a row of settings,
   which left a gap after a long model name. */
.vmp { position: relative; min-width: 0; max-width: min(260px, 100%); }
.vmp-pill { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; max-width: 100%; padding: 0 10px; box-sizing: border-box;
  border: 1px solid var(--vm-line, #dce3ee); border-radius: 999px; background: transparent; color: var(--vm-ink, #0f172a); font: inherit; font-size: 13px; cursor: pointer; }
.vmp-pill:hover, .vmp-pill[aria-expanded="true"] { background: var(--vm-surface, #f1f5f9); }
.vmp-ic { width: 16px; height: 16px; flex-shrink: 0; color: var(--vm-ink-soft, #64748b); }
.vmp-ic :deep(svg), .vmp-chev :deep(svg), .vmp-check :deep(svg), .vmp-search-ic :deep(svg) { display: block; width: 100%; height: 100%; }
.vmp-pill-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vmp-pill-label { flex: 0 0 96px; color: var(--vm-ink-soft, #64748b); text-align: left; }
.vmp-chev { width: 12px; height: 12px; flex-shrink: 0; margin-left: 2px; color: var(--vm-ink-soft, #64748b); }

.vmp-panel { position: absolute; left: 0; bottom: calc(100% + 8px); z-index: 40; display: flex; flex-direction: column; width: min(420px, 86vw);
  max-height: min(520px, 62vh); border: 1px solid var(--vm-line, #dce3ee); border-radius: 10px; background: var(--vm-surface, #fff);
  box-shadow: var(--vm-shadow-l, 0 14px 34px rgba(15, 23, 42, .14)); overflow: hidden; }
.vmp-panel.align-end { left: auto; right: 0; }
.vmp-search { position: relative; display: block; flex-shrink: 0; padding: 8px; border-bottom: 1px solid var(--vm-line-2, #e5e7eb); }
.vmp-search-ic { position: absolute; left: 20px; top: 50%; width: 16px; height: 16px; transform: translateY(-50%); color: var(--vm-ink-faint, #94a3b8); pointer-events: none; }
.vmp-search input { width: 100%; min-height: 38px; box-sizing: border-box; padding: 0 10px 0 34px; border: 1px solid var(--vm-line, #dce3ee); border-radius: 6px;
  background: var(--vm-surface-2, #f8fafc); color: var(--vm-ink, #0f172a); font: inherit; font-size: 13.5px; }
.vmp-search input:focus-visible { outline: 2px solid var(--vm-violet, #4f46e5); outline-offset: 0; }
.vmp-list { flex: 1; min-height: 0; overflow-y: auto; padding: 4px 6px 8px; overscroll-behavior: contain; }
.vmp-group { position: sticky; top: -4px; z-index: 1; margin: 6px 0 0; padding: 8px 8px 4px; background: var(--vm-surface, #fff);
  font-size: 12px; font-weight: 600; color: var(--vm-ink-soft, #64748b); }
.vmp-opt { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 48px; padding: 7px 10px; box-sizing: border-box; border: 0; border-radius: 6px;
  background: transparent; color: var(--vm-ink, #0f172a); font: inherit; text-align: left; cursor: pointer; }
.vmp-opt:hover, .vmp-opt:focus-visible { background: var(--vm-surface-2, #f1f5f9); outline: none; }
.vmp-opt:focus-visible { box-shadow: inset 0 0 0 2px var(--vm-violet, #4f46e5); }
.vmp-opt.on { background: var(--vm-violet-soft, #eef2ff); }
.vmp-opt.off { cursor: not-allowed; opacity: .5; }
.vmp-opt.off:hover { background: transparent; }
.vmp-opt-main { display: grid; gap: 2px; min-width: 0; flex: 1; }
.vmp-opt-name { display: flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 500; }
.vmp-opt-meta { font-size: 12px; line-height: 1.4; color: var(--vm-ink-soft, #64748b); }
.vmp-tag { padding: 1px 6px; border: 1px solid var(--vm-line, #dce3ee); border-radius: 4px; font-size: 11px; font-weight: 500; color: var(--vm-ink-soft, #64748b); }
.vmp-check { width: 16px; height: 16px; flex-shrink: 0; color: var(--vs-accent-ink, var(--vm-violet-d, #4f46e5)); }
.vmp-none { margin: 0; padding: 16px 10px; font-size: 13px; color: var(--vm-ink-soft, #64748b); }
.vmp-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.vmp-pill:focus-visible { outline: 2px solid var(--vm-violet, #4f46e5); outline-offset: 2px; }

.vmp.two-line .vmp-pill{min-height:54px;max-width:100%;border-radius:8px}.vmp-pill-copy{display:grid;gap:2px;min-width:0;flex:1;text-align:left}.vmp-pill-primary{font-size:13px;font-weight:600}.vmp-pill-secondary{font-size:12px;font-weight:400;color:var(--vm-ink-soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* In the phone settings sheet: a full-width row, and the list opens in place below it. */
.vmp.in-sheet { width: 100%; max-width: none; }
.vmp.in-sheet .vmp-pill { width: 100%; max-width: none; min-height: 48px; border-radius: 8px; }
.vmp.in-sheet .vmp-pill-text { flex: 1; text-align: left; }
.vmp.in-sheet .vmp-panel { position: static; width: 100%; max-height: 52vh; margin-top: 8px; box-shadow: none; }
@media (pointer: coarse) { .vmp-pill { min-height: 44px; } .vmp-opt { min-height: 52px; } .vmp-search input { min-height: 44px; font-size: 16px; } }
</style>
