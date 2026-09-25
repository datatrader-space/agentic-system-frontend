<template>
  <div class="fw">
    <header class="fw-head">
      <div>
        <h1>Fitmywall Data</h1>
        <p>Wall events and room photos FitMyWall forwards to
           <code>POST /api/partner/wall-marking/events/</code>. Each row is one delivered event,
           stored exactly as sent.</p>
      </div>
      <div class="fw-head-actions">
        <button class="fw-btn" :disabled="loading" @click="load">↻ Refresh</button>
        <button class="fw-btn primary" :disabled="exporting || !count" @click="exportJson">
          {{ exporting ? 'Exporting…' : '⬇ Export JSON' }}
        </button>
      </div>
    </header>

    <!-- Totals (all data, unaffected by filters) -->
    <section class="fw-stats">
      <div class="fw-stat"><span class="fw-stat-k">Events</span><span class="fw-stat-v">{{ num(summary.total) }}</span></div>
      <div class="fw-stat"><span class="fw-stat-k">Captures</span><span class="fw-stat-v">{{ num(summary.captures) }}</span></div>
      <div class="fw-stat"><span class="fw-stat-k">Shops</span><span class="fw-stat-v">{{ num(summary.shops) }}</span></div>
      <div class="fw-stat"><span class="fw-stat-k">Photos</span><span class="fw-stat-v">{{ num(summary.images) }}</span></div>
      <div class="fw-stat" :class="{ warn: summary.dims_mismatch }">
        <span class="fw-stat-k">Size mismatches</span><span class="fw-stat-v">{{ num(summary.dims_mismatch) }}</span>
      </div>
      <div class="fw-stat"><span class="fw-stat-k">Last received</span><span class="fw-stat-v sm">{{ ago(summary.last) }}</span></div>
    </section>

    <!-- Filters -->
    <section class="fw-card">
      <div class="fw-filters">
        <input v-model="f.q" class="fw-input grow" type="search" placeholder="Search capture, shop or session…"
               @input="debouncedLoad" />
        <select v-model="f.event" class="fw-input" @change="reload">
          <option value="">All events</option>
          <option v-for="e in facets.events" :key="e" :value="e">{{ e }}</option>
        </select>
        <select v-model="f.shop" class="fw-input" @change="reload">
          <option value="">All shops</option>
          <option v-for="s in facets.shops" :key="s" :value="s">{{ s }}</option>
        </select>
        <select v-model="f.surface" class="fw-input" @change="reload">
          <option value="">All surfaces</option>
          <option v-for="s in facets.surfaces" :key="s" :value="s">{{ s }}</option>
        </select>
        <select v-model="f.dims_match" class="fw-input" @change="reload">
          <option value="">Any photo size</option>
          <option value="true">Size matches</option>
          <option value="false">Size mismatch</option>
        </select>
        <label class="fw-date"><span>From</span><input v-model="f.from" class="fw-input" type="date" @change="reload" /></label>
        <label class="fw-date"><span>To</span><input v-model="f.to" class="fw-input" type="date" @change="reload" /></label>
        <button v-if="hasFilters" class="fw-btn ghost" @click="clearFilters">Clear</button>
      </div>
    </section>

    <!-- Events -->
    <section class="fw-card">
      <div class="fw-card-h">
        <h2>Events <span class="fw-count">{{ num(count) }}</span></h2>
      </div>
      <div v-if="loading && !rows.length" class="fw-empty">Loading…</div>
      <div v-else-if="loadError" class="fw-empty fw-error">
        Couldn't load events: {{ loadError }} <button class="fw-btn sm" @click="load">Retry</button>
      </div>
      <div v-else-if="!rows.length" class="fw-empty">
        {{ hasFilters ? 'No events match these filters.' : 'No events received yet.' }}
      </div>
      <div v-else class="fw-table-wrap">
        <table class="fw-table">
          <thead>
            <tr><th>Photo</th><th>Received</th><th>Event</th><th>Capture</th><th>Shop</th><th>Surface</th>
                <th>Walls</th><th>Size</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.id" class="fw-row" @click="open(r)">
              <td>
                <img v-if="r.image" :src="r.image.url" class="fw-thumb" loading="lazy" alt="" />
                <span v-else class="fw-thumb none">—</span>
              </td>
              <td class="nowrap" :title="fmt(r.received_at)">{{ ago(r.received_at) }}</td>
              <td><span class="fw-pill">{{ r.event }}</span></td>
              <td><code class="fw-mono">{{ r.capture_id }}</code></td>
              <td class="fw-shop" :title="r.shop">{{ r.shop || '—' }}</td>
              <td>{{ r.surface || '—' }}</td>
              <td>{{ r.wall_count }}</td>
              <td>
                <span v-if="r.image_dims_match === true" class="fw-ok">✓</span>
                <span v-else-if="r.image_dims_match === false" class="fw-bad" title="Photo size differs from payload image size">Mismatch</span>
                <span v-else class="fw-muted">—</span>
              </td>
              <td class="fw-actions" @click.stop>
                <button class="fw-btn sm" @click="open(r)">View</button>
                <button class="fw-btn danger sm" @click="remove(r)">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="pages > 1" class="fw-pager">
        <button class="fw-btn sm" :disabled="page <= 1 || loading" @click="go(page - 1)">‹ Prev</button>
        <span>Page {{ page }} of {{ pages }}</span>
        <button class="fw-btn sm" :disabled="page >= pages || loading" @click="go(page + 1)">Next ›</button>
      </div>
    </section>

    <!-- Detail drawer -->
    <div v-if="detailOpen" class="fw-mask" @click.self="close">
      <aside class="fw-drawer">
        <header class="fw-drawer-h">
          <div>
            <h3>{{ detail?.event || 'Event' }}</h3>
            <div class="fw-sub"><code class="fw-mono">{{ detail?.capture_id }}</code></div>
          </div>
          <div class="fw-drawer-actions">
            <button v-if="detail?.image" class="fw-btn" @click="downloadPhoto">⬇ Photo</button>
            <button v-if="detail" class="fw-btn danger" @click="remove(detail, true)">Delete</button>
            <button class="fw-btn ghost" @click="close">✕ Close</button>
          </div>
        </header>

        <div v-if="detailLoading" class="fw-empty pad">Loading…</div>
        <div v-else-if="detail" class="fw-drawer-body">
          <!-- Photo with the walls drawn on it -->
          <div v-if="detail.image" class="fw-photo-block">
            <div class="fw-photo-bar">
              <label class="fw-toggle"><input v-model="showWalls" type="checkbox" /> Show walls</label>
              <span class="fw-muted">{{ detail.image.width }}×{{ detail.image.height }} ·
                {{ kb(detail.image.size_bytes) }} · {{ detail.image.content_type }}</span>
            </div>
            <div class="fw-photo">
              <img :src="detail.image.url" alt="Room photo" />
              <svg v-if="showWalls && polygons.length" class="fw-overlay" :viewBox="`0 0 ${space.w} ${space.h}`"
                   preserveAspectRatio="none">
                <g v-for="(p, i) in polygons" :key="i">
                  <polygon :points="p.points" :fill="p.color" fill-opacity="0.22" :stroke="p.color"
                           :stroke-width="strokeW" stroke-linejoin="round" />
                  <text :x="p.cx" :y="p.cy" :font-size="labelSize" text-anchor="middle" dominant-baseline="middle"
                        class="fw-label" :stroke-width="labelSize / 6">Wall {{ i + 1 }}</text>
                </g>
              </svg>
            </div>
            <p v-if="detail.image_dims_match === false" class="fw-warn">
              The photo is {{ detail.image.width }}×{{ detail.image.height }} but the payload says
              {{ detail.image_width }}×{{ detail.image_height }}. Walls are drawn in the payload's size, so the
              overlay may not line up.
            </p>
          </div>

          <dl class="fw-meta">
            <div><dt>Received</dt><dd>{{ fmt(detail.received_at) }}</dd></div>
            <div><dt>Event time (at)</dt><dd>{{ fmt(detail.occurred_at) }}</dd></div>
            <div><dt>Shop</dt><dd>{{ detail.shop || '—' }}</dd></div>
            <div><dt>Surface</dt><dd>{{ detail.surface || '—' }}</dd></div>
            <div><dt>Session</dt><dd><code class="fw-mono">{{ detail.session_id || '—' }}</code></dd></div>
            <div><dt>Model</dt><dd>{{ detail.model || '—' }}</dd></div>
            <div><dt>Elapsed</dt><dd>{{ detail.elapsed_ms != null ? `${num(Math.round(detail.elapsed_ms))} ms` : '—' }}</dd></div>
            <div><dt>Payload image size</dt><dd>{{ detail.image_width ? `${detail.image_width}×${detail.image_height}` : '—' }}</dd></div>
            <div><dt>Walls</dt><dd>{{ detail.walls?.length || 0 }}</dd></div>
            <div><dt>Schema</dt><dd>{{ detail.schema }}</dd></div>
            <div><dt>Partner key</dt><dd>{{ detail.partner_key || '—' }}</dd></div>
            <div><dt>Owner</dt><dd>{{ detail.owner || '—' }}</dd></div>
            <div class="wide"><dt>Event id</dt><dd><code class="fw-mono">{{ detail.id }}</code></dd></div>
          </dl>

          <div class="fw-json-h">
            <h4>Payload (as received)</h4>
            <button class="fw-btn sm" @click="copy(JSON.stringify(detail.raw_payload, null, 2))">Copy</button>
          </div>
          <pre class="fw-json">{{ JSON.stringify(detail.raw_payload, null, 2) }}</pre>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import api from '../../services/api'
import { notify } from '../../composables/useNotify'
import { confirm } from '../../composables/useConfirm'
import { saveBlob } from '../../utils/saveBlob'

const PAGE_SIZE = 25
const COLORS = ['#4f46e5', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#d946ef', '#84cc16', '#f97316']

const rows = ref([])
const count = ref(0)
const page = ref(1)
const loading = ref(true)
const loadError = ref('')
const exporting = ref(false)
const summary = ref({})
const facets = ref({ events: [], shops: [], surfaces: [] })
const f = reactive({ q: '', event: '', shop: '', surface: '', dims_match: '', from: '', to: '' })

const detailOpen = ref(false)
const detailLoading = ref(false)
const detail = ref(null)
const showWalls = ref(true)

const pages = computed(() => Math.max(1, Math.ceil(count.value / PAGE_SIZE)))
const hasFilters = computed(() => Object.values(f).some(Boolean))

function params(extra = {}) {
  const p = { ...extra }
  for (const [k, v] of Object.entries(f)) if (v) p[k] = typeof v === 'string' ? v.trim() : v
  return p
}

let seq = 0
async function load() {
  const mine = ++seq
  loading.value = true
  try {
    const { data } = await api.getWallEvents(params({ page: page.value, page_size: PAGE_SIZE }))
    if (mine !== seq) return                      // a newer filter change already superseded this one
    loadError.value = ''
    rows.value = data.results || []
    count.value = data.count || 0
    summary.value = data.summary || {}
    facets.value = data.facets || facets.value
    if (page.value > pages.value) { page.value = pages.value; return load() }
  } catch (e) {
    if (mine === seq) {
      loadError.value = errText(e)
      rows.value = []
      notify.error('Failed to load Fitmywall data: ' + errText(e))
    }
  } finally {
    if (mine === seq) loading.value = false
  }
}

function reload() { page.value = 1; load() }

let timer = null
function debouncedLoad() { clearTimeout(timer); timer = setTimeout(reload, 300) }

function go(p) { page.value = p; load() }

function clearFilters() {
  Object.keys(f).forEach(k => { f[k] = '' })
  reload()
}

async function open(r) {
  detailOpen.value = true
  detailLoading.value = true
  detail.value = null
  try {
    detail.value = (await api.getWallEvent(r.id)).data
  } catch (e) {
    notify.error('Failed to load event: ' + errText(e))
    detailOpen.value = false
  } finally {
    detailLoading.value = false
  }
}

function close() { detailOpen.value = false; detail.value = null }

async function remove(r, fromDrawer = false) {
  const ok = await confirm({
    title: 'Delete this event?',
    message: `“${r.event}” for capture ${r.capture_id} will be permanently deleted. Its photo is deleted too `
      + 'unless another event still uses it. This cannot be undone.',
    confirmText: 'Delete',
    danger: true,
  })
  if (!ok) return
  try {
    const { data } = await api.deleteWallEvent(r.id)
    notify.success(data.image_deleted ? 'Event and photo deleted' : 'Event deleted')
    if (fromDrawer || detail.value?.id === r.id) close()
    await load()
  } catch (e) {
    notify.error('Failed to delete: ' + errText(e))
  }
}

async function exportJson() {
  exporting.value = true
  try {
    const { data } = await api.exportWallEvents(params())
    const blob = new Blob([JSON.stringify(data.results, null, 2)], { type: 'application/json;charset=utf-8' })
    saveBlob(blob, `fitmywall-data-${new Date().toISOString().slice(0, 10)}.json`)
    if (data.truncated) notify.warning(`Exported the newest ${num(data.exported)} of ${num(data.count)} events — narrow the filters for the rest`)
    else notify.success(`Exported ${num(data.exported)} events`)
  } catch (e) {
    notify.error('Export failed: ' + errText(e))
  } finally {
    exporting.value = false
  }
}

async function downloadPhoto() {
  const img = detail.value?.image
  if (!img) return
  try {
    const { data } = await api.getWallImage(img.id)
    const ext = (img.content_type || 'image/jpeg').split('/')[1].replace('jpeg', 'jpg')
    saveBlob(data, `${detail.value.capture_id}.${ext}`)
  } catch (e) {
    notify.error('Download failed: ' + errText(e))
  }
}

// ── Wall overlay ────────────────────────────────────────────────────────────────────────────────────
// Walls are in the payload's pixel space (image.width × image.height). If every coordinate is ≤ 1 they
// are normalized 0–1 and are scaled to that space instead.
const space = computed(() => {
  const d = detail.value
  if (!d) return { w: 1, h: 1 }
  return { w: d.image_width || d.image?.width || 1, h: d.image_height || d.image?.height || 1 }
})

const polygons = computed(() => {
  const walls = Array.isArray(detail.value?.walls) ? detail.value.walls : []
  const flat = walls.flat().flat().filter(v => typeof v === 'number')
  const normalized = flat.length > 0 && flat.every(v => v >= 0 && v <= 1)
  const { w, h } = space.value
  return walls.filter(p => Array.isArray(p) && p.length >= 3).map((poly, i) => {
    const pts = poly.map(([x, y]) => (normalized ? [x * w, y * h] : [x, y]))
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length
    const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length
    return { points: pts.map(p => p.join(',')).join(' '), cx, cy, color: COLORS[i % COLORS.length] }
  })
})

const strokeW = computed(() => Math.max(2, Math.round(Math.max(space.value.w, space.value.h) / 400)))
const labelSize = computed(() => Math.max(14, Math.round(Math.max(space.value.w, space.value.h) / 45)))

// ── Formatting ──────────────────────────────────────────────────────────────────────────────────────
function num(v) { return v == null ? '—' : Number(v).toLocaleString() }
function kb(bytes) { return bytes == null ? '—' : bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB` }
function fmt(ts) {
  if (!ts) return '—'
  try { return new Date(ts).toLocaleString() } catch { return ts }
}
function ago(ts) {
  if (!ts) return '—'
  const s = Math.round((Date.now() - new Date(ts).getTime()) / 1000)
  if (Number.isNaN(s)) return ts
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`
  return new Date(ts).toLocaleDateString()
}
function errText(e) { return e.response?.data?.detail || e.response?.data?.error || e.message }
function copy(text) {
  try { navigator.clipboard.writeText(text); notify.success('Copied') } catch { /* noop */ }
}

onMounted(load)
</script>

<style scoped>
.fw { padding: 32px 36px; max-width: 1240px; }
.fw-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
.fw-head h1 { font-size: 24px; font-weight: 800; color: #0f172a; }
.fw-head p { color: #64748b; margin-top: 6px; font-size: 14px; max-width: 700px; line-height: 1.5; }
.fw-head code { font-family: ui-monospace, monospace; font-size: 12.5px; background: #f1f5f9; padding: 1px 6px; border-radius: 5px; color: #0f172a; }
.fw-head-actions { display: flex; gap: 8px; }

.fw-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-top: 20px; }
.fw-stat { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
.fw-stat.warn { border-color: #fde68a; background: #fffbeb; }
.fw-stat-k { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: .03em; font-weight: 600; }
.fw-stat-v { font-size: 22px; font-weight: 800; color: #0f172a; font-variant-numeric: tabular-nums; }
.fw-stat-v.sm { font-size: 15px; font-weight: 700; padding-top: 5px; }

.fw-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 20px; margin-top: 16px; }
.fw-card-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.fw-card-h h2 { font-size: 15px; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 8px; }
.fw-count { font-size: 12px; font-weight: 700; color: #4f46e5; background: #eef2ff; padding: 1px 9px; border-radius: 999px; }

.fw-filters { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.fw-input { border: 1px solid #cbd5e1; border-radius: 9px; padding: 8px 11px; font-size: 13px; color: #0f172a; background: #fff; }
.fw-input:focus { outline: none; border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,.12); }
.fw-input.grow { flex: 1; min-width: 220px; }
select.fw-input { max-width: 240px; text-overflow: ellipsis; }
.fw-date { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #64748b; }

.fw-btn { border: 1px solid #cbd5e1; background: #fff; color: #334155; border-radius: 9px; padding: 8px 14px;
  font-size: 13px; font-weight: 600; cursor: pointer; transition: all .15s; white-space: nowrap; }
.fw-btn:hover:not(:disabled) { border-color: #94a3b8; }
.fw-btn:disabled { opacity: .5; cursor: default; }
.fw-btn.primary { background: #4f46e5; border-color: #4f46e5; color: #fff; }
.fw-btn.primary:hover:not(:disabled) { background: #4338ca; }
.fw-btn.danger { color: #dc2626; border-color: #fecaca; }
.fw-btn.danger:hover { background: #fef2f2; }
.fw-btn.ghost { border-color: transparent; color: #64748b; }
.fw-btn.sm { padding: 5px 10px; font-size: 12px; }

.fw-table-wrap { overflow-x: auto; }
.fw-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.fw-table th { text-align: left; color: #64748b; font-weight: 600; font-size: 11px; text-transform: uppercase;
  letter-spacing: .03em; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
.fw-table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: middle; }
.fw-row { cursor: pointer; }
.fw-row:hover td { background: #f8fafc; }
.fw-thumb { width: 64px; height: 44px; object-fit: cover; border-radius: 6px; border: 1px solid #e2e8f0; display: block; background: #f1f5f9; }
.fw-thumb.none { display: flex; align-items: center; justify-content: center; color: #cbd5e1; }
.fw-pill { font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 999px; background: #eef2ff; color: #4338ca; white-space: nowrap; }
.fw-mono { font-family: ui-monospace, monospace; font-size: 12px; color: #475569; }
.fw-shop { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fw-ok { color: #15803d; font-weight: 700; }
.fw-bad { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: #fef3c7; color: #b45309; }
.fw-muted { color: #94a3b8; font-size: 12px; }
.nowrap { white-space: nowrap; }
.fw-actions { text-align: right; white-space: nowrap; }
.fw-actions .fw-btn { margin-left: 6px; }
.fw-empty { color: #94a3b8; font-size: 13px; padding: 12px 4px; }
.fw-empty.pad { padding: 24px; }
.fw-error { color: #b91c1c; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.fw-pager { display: flex; justify-content: flex-end; align-items: center; gap: 12px; margin-top: 12px; font-size: 13px; color: #64748b; }

.fw-mask { position: fixed; inset: 0; background: rgba(15,23,42,.4); z-index: 50; display: flex; justify-content: flex-end; }
.fw-drawer { width: min(880px, 94vw); height: 100%; background: #fff; box-shadow: -8px 0 32px rgba(0,0,0,.18); display: flex; flex-direction: column; }
.fw-drawer-h { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 16px 22px; border-bottom: 1px solid #e2e8f0; }
.fw-drawer-h h3 { font-size: 16px; font-weight: 700; color: #0f172a; }
.fw-sub { margin-top: 2px; }
.fw-drawer-actions { display: flex; gap: 8px; }
.fw-drawer-body { padding: 18px 22px 28px; overflow-y: auto; }

.fw-photo-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 13px; }
.fw-toggle { display: flex; align-items: center; gap: 6px; color: #334155; font-weight: 600; cursor: pointer; }
.fw-photo { position: relative; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; background: #0f172a; line-height: 0; }
.fw-photo img { width: 100%; height: auto; display: block; }
.fw-overlay { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.fw-label { fill: #fff; stroke: rgba(15,23,42,.85); paint-order: stroke; font-weight: 700; font-family: system-ui, sans-serif; }
.fw-warn { margin-top: 8px; font-size: 12px; color: #b45309; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 8px 10px; line-height: 1.5; }

.fw-meta { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px 20px; margin: 18px 0; }
.fw-meta div.wide { grid-column: 1 / -1; }
.fw-meta dt { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: .03em; font-weight: 600; }
.fw-meta dd { font-size: 13px; color: #0f172a; margin-top: 2px; word-break: break-word; }

.fw-json-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.fw-json-h h4 { font-size: 13px; font-weight: 700; color: #0f172a; }
.fw-json { background: #0f172a; color: #e2e8f0; padding: 14px 16px; border-radius: 10px; overflow: auto; max-height: 360px;
  font-family: ui-monospace, monospace; font-size: 12px; line-height: 1.5; white-space: pre; }

@media (max-width: 720px) {
  .fw { padding: 20px 16px; }
  .fw-drawer-h { flex-wrap: wrap; }
}
</style>
