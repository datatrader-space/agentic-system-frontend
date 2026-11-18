<template>
  <!-- A project's shared canvas (ADM-1248, decision D9): sticky notes and storyboard scenes that everyone on the
       project sees move as they move. Yjs in the browser; the server relays and stores it, checks the person's access
       on connect and on every change, and names each cursor itself. A person who can only view never writes. -->
  <section class="pcv" aria-label="Project canvas" data-test="project-canvas">
    <div class="pcv-bar">
      <span class="pcv-status" :class="status" role="status" data-test="canvas-status">{{ statusText }}</span>
      <ul class="pcv-people" aria-label="On this canvas now">
        <li v-for="p in peers" :key="p.clientId" :style="{ '--c': p.color }" :title="p.name"><span aria-hidden="true">{{ initials(p.name) }}</span><span class="pcv-sr">{{ p.name }}</span></li>
      </ul>
      <div v-if="canEdit && !fatal" class="pcv-tools">
        <button type="button" class="pcv-btn primary" data-test="canvas-add" :disabled="status !== 'connected'" @click="addNote()">＋ Note</button>
        <button v-if="missingScenes.length" type="button" class="pcv-btn" data-test="canvas-add-scenes" :disabled="status !== 'connected'" @click="addScenes">Place {{ missingScenes.length }} {{ missingScenes.length === 1 ? 'scene' : 'scenes' }}</button>
      </div>
    </div>
    <p v-if="!canEdit && !fatal" class="pcv-note" data-test="canvas-readonly">You can view this canvas. Ask the project’s owner or a manager for edit access to change it.</p>
    <p v-if="fatal" class="pcv-note bad" role="alert" data-test="canvas-fatal">{{ fatal }}</p>

    <div ref="viewport" class="pcv-viewport" tabindex="0" aria-label="Canvas board. Use Tab to reach a note; arrow keys move a selected note." @pointermove="onPointerMove" @pointerleave="clearCursor">
      <div class="pcv-board" :style="{ width: BOARD_W + 'px', height: BOARD_H + 'px' }">
        <article v-for="c in cards" :key="c.id" class="pcv-card" :class="[c.color, c.kind, { dragging: drag && drag.id === c.id }]" data-test="canvas-card"
                 :style="{ transform: `translate(${pos(c).x}px, ${pos(c).y}px)`, width: c.w + 'px', minHeight: c.h + 'px' }">
          <header class="pcv-handle" :tabindex="canEdit ? 0 : -1" :aria-label="canEdit ? `Move ${c.kind === 'scene' ? 'scene' : 'note'}: ${c.text.slice(0, 40) || 'empty'}` : undefined"
                  @pointerdown="startDrag($event, c)" @keydown="nudge($event, c)">
            <span class="pcv-kind">{{ c.kind === 'scene' ? 'Scene' : 'Note' }}</span>
            <span v-if="canEdit" class="pcv-card-tools">
              <button v-for="col in COLORS" :key="col" type="button" class="pcv-swatch" :class="[col, { on: c.color === col }]" :aria-label="`Make it ${col}`" :aria-pressed="c.color === col ? 'true' : 'false'" @pointerdown.stop @click="patch(c, { color: col })"></button>
              <button type="button" class="pcv-del" :aria-label="`Delete this ${c.kind === 'scene' ? 'scene card' : 'note'}`" data-test="canvas-delete" @pointerdown.stop @click="remove(c)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
            </span>
          </header>
          <label class="pcv-sr" :for="`pcv-text-${c.id}`">Text</label>
          <textarea :id="`pcv-text-${c.id}`" class="pcv-text" :value="c.text" :readonly="!canEdit" maxlength="2000" rows="3" data-test="canvas-text"
                    @change="patch(c, { text: $event.target.value })"></textarea>
        </article>
        <span v-for="p in cursors" :key="'cur' + p.clientId" class="pcv-cursor" :style="{ transform: `translate(${p.cursor.x}px, ${p.cursor.y}px)`, '--c': p.color }" aria-hidden="true">
          <svg viewBox="0 0 16 16"><path d="M1 1l5 14 2-6 6-2z" /></svg><span>{{ p.name }}</span>
        </span>
        <p v-if="status === 'connected' && !cards.length" class="pcv-empty">{{ canEdit ? 'An empty canvas. Add a note, or place the storyboard’s scenes, and plan the video together.' : 'Nothing on this canvas yet.' }}</p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, inject, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { canvasSocketBase } from '../../services/studioSharing'

const props = defineProps({
  projectId: { type: String, required: true },
  canEdit: { type: Boolean, default: false },
  scenes: { type: Array, default: () => [] },   // [{scene_id, title}]
})
const BOARD_W = 2400, BOARD_H = 1600
const COLORS = ['plain', 'amber', 'green', 'blue', 'red']
const PEER_COLORS = ['#8DB4FF', '#7FE0A8', '#F5C76A', '#FF9C9C', '#C4A7FF', '#7FD6E0']
const CLOSE = { 4401: 'You are signed out. Sign in again to see this canvas.', 4403: 'You no longer have access to this canvas.', 4404: 'This project no longer exists.' }
const studioUser = inject('studioUser', ref(null))

const viewport = ref(null)
const status = ref('connecting'), fatal = ref('')
const cards = shallowRef([]), peers = shallowRef([]), drag = ref(null)
let doc = null, provider = null, map = null, lastCursor = 0
const statusText = computed(() => fatal.value ? 'Disconnected' : status.value === 'connected' ? 'Live' : status.value === 'connecting' ? 'Connecting…' : 'Reconnecting…')
const cursors = computed(() => peers.value.filter(p => p.cursor))
const missingScenes = computed(() => {
  const placed = new Set(cards.value.filter(c => c.kind === 'scene').map(c => String(c.scene_id)))
  return props.scenes.filter(s => s.scene_id && !placed.has(String(s.scene_id)))
})

// What another person's browser wrote is checked before it is shown: numbers in range, known colours, text only.
const num = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d }
function clean(id, v) {
  if (!v || typeof v !== 'object') return null
  return { id: String(id), x: num(v.x, 0, BOARD_W - 120, 40), y: num(v.y, 0, BOARD_H - 80, 40), w: num(v.w, 140, 420, 220), h: num(v.h, 80, 400, 120),
    text: typeof v.text === 'string' ? v.text.slice(0, 2000) : '', color: COLORS.includes(v.color) ? v.color : 'plain',
    kind: v.kind === 'scene' ? 'scene' : 'note', scene_id: v.scene_id ? String(v.scene_id) : undefined }
}
function readCards() { cards.value = [...map.entries()].map(([k, v]) => clean(k, v)).filter(Boolean) }
function readPeers() {
  const own = doc.clientID, out = []
  provider.awareness.getStates().forEach((state, clientId) => {
    if (clientId === own || !state?.user) return
    const cursor = state.cursor && Number.isFinite(state.cursor.x) && Number.isFinite(state.cursor.y)
      ? { x: num(state.cursor.x, 0, BOARD_W, 0), y: num(state.cursor.y, 0, BOARD_H, 0) } : null
    out.push({ clientId, name: String(state.user.name || 'Someone').slice(0, 60), color: PEER_COLORS[clientId % PEER_COLORS.length], cursor })
  })
  peers.value = out
}
function initials(s) { return String(s || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') }
const newId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`)

function write(card) { if (props.canEdit && map) map.set(card.id, { ...card }) }
function patch(card, change) { write({ ...card, ...change }) }
function remove(card) { if (props.canEdit && map) map.delete(card.id) }
function visibleSpot() {
  const el = viewport.value
  return { x: num((el?.scrollLeft || 0) + 40 + Math.random() * 80, 0, BOARD_W - 260, 40), y: num((el?.scrollTop || 0) + 40 + Math.random() * 60, 0, BOARD_H - 160, 40) }
}
function addNote() { write({ id: newId(), ...visibleSpot(), w: 220, h: 120, text: '', color: 'amber', kind: 'note' }) }
function addScenes() {
  const start = visibleSpot()
  doc.transact(() => missingScenes.value.forEach((s, i) => write({ id: newId(), x: num(start.x + i * 240, 0, BOARD_W - 260, 40), y: start.y, w: 220, h: 120,
    text: s.title || `Scene ${i + 1}`, color: 'blue', kind: 'scene', scene_id: String(s.scene_id) })))
}

// Dragging moves the note on this screen; the new place is written once, on release.
function pos(c) { return drag.value && drag.value.id === c.id ? { x: drag.value.x, y: drag.value.y } : c }
function startDrag(e, c) {
  if (!props.canEdit || e.button > 0) return
  e.currentTarget.setPointerCapture?.(e.pointerId)
  drag.value = { id: c.id, card: c, x: c.x, y: c.y, sx: e.clientX, sy: e.clientY }
  const move = (ev) => { drag.value = { ...drag.value, x: num(c.x + ev.clientX - drag.value.sx, 0, BOARD_W - c.w, c.x), y: num(c.y + ev.clientY - drag.value.sy, 0, BOARD_H - 80, c.y) } }
  const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); const d = drag.value; drag.value = null; if (d && (d.x !== c.x || d.y !== c.y)) patch(c, { x: Math.round(d.x), y: Math.round(d.y) }) }
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
}
function nudge(e, c) {
  if (!props.canEdit) return
  const step = e.shiftKey ? 50 : 10, d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
  if (!d) return
  e.preventDefault()
  patch(c, { x: num(c.x + d[0], 0, BOARD_W - c.w, c.x), y: num(c.y + d[1], 0, BOARD_H - 80, c.y) })
}
function onPointerMove(e) {
  if (!provider || fatal.value) return
  const now = Date.now(); if (now - lastCursor < 50) return
  lastCursor = now
  const rect = viewport.value.getBoundingClientRect()
  provider.awareness.setLocalStateField('cursor', { x: Math.round(e.clientX - rect.left + viewport.value.scrollLeft), y: Math.round(e.clientY - rect.top + viewport.value.scrollTop) })
}
function clearCursor() { provider?.awareness.setLocalStateField('cursor', null) }

function connect() {
  doc = new Y.Doc()
  map = doc.getMap('cards')
  map.observe(readCards)
  provider = new WebsocketProvider(canvasSocketBase(), props.projectId, doc, { maxBackoffTime: 10000 })
  // The server writes the real name into `user`; this is only what this screen shows before it does.
  provider.awareness.setLocalState({ user: { name: studioUser.value?.first_name || studioUser.value?.username || 'You' }, cursor: null })
  provider.awareness.on('change', readPeers)
  provider.on('status', (e) => { if (!fatal.value) status.value = e.status })
  // A 44xx close is final (y-websocket stops reconnecting by itself): say why instead of retrying forever.
  provider.on('closed', (close) => {
    fatal.value = CLOSE[close?.code] || 'The canvas closed the connection. Reload the page to try again.'
    status.value = 'disconnected'
  })
  readCards()
}
function disconnect() {
  try { provider?.awareness.setLocalState(null) } catch { /* closing anyway */ }
  provider?.destroy(); doc?.destroy(); provider = null; doc = null; map = null
}
onMounted(connect)
watch(() => props.projectId, () => { disconnect(); fatal.value = ''; status.value = 'connecting'; cards.value = []; peers.value = []; connect() })
onBeforeUnmount(disconnect)
defineExpose({ addNote })
</script>

<style scoped>
.pcv{display:grid;gap:12px;min-width:0;color:var(--vm-ink)}
.pcv-bar{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.pcv-status{display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--vm-ink-soft)}.pcv-status::before{content:'';width:8px;height:8px;border-radius:50%;background:var(--vm-ink-faint)}
.pcv-status.connected::before{background:var(--vs-ok-ink)}.pcv-status.connecting::before{background:var(--vs-warn-ink)}
.pcv-people{display:flex;list-style:none;margin:0;padding:0}.pcv-people li{display:grid;place-items:center;width:30px;height:30px;margin-left:-6px;border:2px solid var(--vm-bg);border-radius:50%;background:var(--c);color:#101216;font-size:11px;font-weight:700}.pcv-people li:first-child{margin-left:0}
.pcv-tools{display:flex;gap:8px;margin-left:auto}
.pcv-btn{min-height:40px;padding:0 14px;border:1px solid var(--vm-line);border-radius:6px;background:transparent;color:var(--vm-ink);font:inherit;font-size:13px;font-weight:500;cursor:pointer}.pcv-btn:hover:not(:disabled){background:var(--vm-surface-2)}.pcv-btn:disabled{opacity:.55;cursor:not-allowed}
.pcv-btn.primary{background:var(--vm-violet-d);border-color:transparent;color:#fff}.pcv-btn.primary:hover:not(:disabled){background:var(--vm-violet)}
.pcv-note{margin:0;font-size:13px;color:var(--vm-ink-soft)}.pcv-note.bad{color:var(--vs-bad-ink)}
.pcv-viewport{position:relative;height:min(68vh,720px);overflow:auto;border:1px solid var(--vm-line);border-radius:10px;background-color:var(--vm-bg);
  background-image:radial-gradient(var(--vm-line-2) 1px,transparent 1px);background-size:24px 24px;touch-action:pan-x pan-y;overscroll-behavior:contain}
.pcv-board{position:relative}
.pcv-card{position:absolute;top:0;left:0;display:grid;grid-template-rows:auto 1fr;box-sizing:border-box;border:1px solid var(--vm-line);border-left-width:4px;border-radius:8px;background:var(--vm-surface);box-shadow:var(--vm-shadow-s)}
.pcv-card.amber{border-left-color:var(--vm-amber);background:color-mix(in srgb,var(--vm-surface) 86%,var(--vm-amber))}
.pcv-card.green{border-left-color:var(--vs-ok-ink);background:color-mix(in srgb,var(--vm-surface) 88%,var(--vs-ok-ink))}
.pcv-card.blue{border-left-color:var(--vm-violet);background:color-mix(in srgb,var(--vm-surface) 86%,var(--vm-violet))}
.pcv-card.red{border-left-color:var(--vm-danger);background:color-mix(in srgb,var(--vm-surface) 88%,var(--vm-danger))}
.pcv-card.dragging{box-shadow:var(--vm-shadow-m);z-index:2}
.pcv-handle{display:flex;align-items:center;justify-content:space-between;gap:6px;min-height:32px;padding:4px 6px 0 10px;cursor:grab;touch-action:none;user-select:none}.pcv-card.dragging .pcv-handle{cursor:grabbing}
.pcv-kind{font-size:11px;color:var(--vm-ink-soft)}.pcv-card.scene .pcv-kind{color:var(--vs-accent-ink)}
.pcv-card-tools{display:flex;align-items:center;gap:2px}
.pcv-swatch{width:22px;height:22px;padding:0;border:2px solid transparent;border-radius:50%;cursor:pointer;background:var(--vm-surface-2)}
.pcv-swatch.amber{background:var(--vm-amber)}.pcv-swatch.green{background:var(--vs-ok-ink)}.pcv-swatch.blue{background:var(--vm-violet)}.pcv-swatch.red{background:var(--vm-danger)}.pcv-swatch.on{border-color:var(--vm-ink)}
.pcv-del{display:grid;place-items:center;width:28px;height:28px;border:0;border-radius:5px;background:none;color:var(--vm-ink-soft);cursor:pointer}.pcv-del:hover{color:var(--vm-ink);background:var(--vm-surface-2)}.pcv-del svg{width:14px;height:14px}
.pcv-text{box-sizing:border-box;width:100%;min-height:72px;padding:6px 10px 10px;border:0;background:transparent;color:var(--vm-ink);font:inherit;font-size:13px;line-height:1.5;resize:none}
.pcv-text:focus{outline:none}.pcv-card:focus-within{border-color:var(--vs-accent-ink)}
.pcv-cursor{position:absolute;top:0;left:0;z-index:3;display:flex;align-items:flex-start;gap:2px;pointer-events:none;transition:transform .08s linear}
.pcv-cursor svg{width:14px;height:14px;fill:var(--c);stroke:var(--vm-bg);stroke-width:1}.pcv-cursor span{margin-top:12px;padding:1px 6px;border-radius:4px;background:var(--c);color:#101216;font-size:11px;font-weight:600;white-space:nowrap}
.pcv-empty{position:sticky;top:40%;left:0;margin:0 auto;max-width:360px;padding:120px 16px 0;font-size:13px;line-height:1.6;color:var(--vm-ink-soft);text-align:center}
.pcv-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.pcv :focus-visible{outline:2px solid var(--vs-accent-ink,var(--vm-link));outline-offset:2px}
@media(max-width:640px){.pcv-viewport{height:62vh}.pcv-btn{min-height:44px}.pcv-tools{margin-left:0}.pcv-swatch{width:26px;height:26px}.pcv-del{width:36px;height:36px}.pcv-text{font-size:16px}}
@media(prefers-reduced-motion:reduce){.pcv-cursor{transition:none}}
</style>
