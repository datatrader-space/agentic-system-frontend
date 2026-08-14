<template>
  <div class="ops">
    <!-- Header -->
    <header class="ops-head">
      <div>
        <h1>Operations</h1>
        <p>Platform health &amp; subsystem status — task outbox, capability broker, artifacts, ingestion, scripts, delegation.</p>
      </div>
      <div class="ops-actions">
        <label class="ops-auto" :class="{ on: autoRefresh }">
          <input type="checkbox" v-model="autoRefresh" @change="onAutoToggle" />
          <span class="ops-auto-dot"></span> Auto
        </label>
        <button class="ops-refresh" :disabled="loading" @click="load">
          <svg viewBox="0 0 24 24" :class="{ spin: loading }" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Refresh
        </button>
      </div>
    </header>

    <!-- Health banner -->
    <div v-if="metrics" class="ops-banner" :class="health.tone">
      <span class="ops-banner-dot"></span>
      <span class="ops-banner-msg">{{ health.message }}</span>
      <span class="ops-banner-meta">
        <span v-if="metrics.storage?.artifact_backend" class="ops-chip">
          storage: {{ metrics.storage.artifact_backend }}
        </span>
        <span class="ops-updated">updated {{ updatedAt || '—' }}</span>
      </span>
    </div>

    <!-- Error -->
    <div v-if="error" class="ops-error">
      <div class="ops-error-title">Couldn’t load operations metrics</div>
      <div class="ops-error-msg">{{ error }}</div>
      <button class="ops-refresh" @click="load">Try again</button>
    </div>

    <!-- Loading skeleton -->
    <div v-else-if="loading && !metrics" class="ops-sections">
      <div v-for="i in 3" :key="i" class="ops-section">
        <div class="ops-skel-title"></div>
        <div class="ops-tiles">
          <div v-for="j in 4" :key="j" class="ops-tile ops-skel"></div>
        </div>
      </div>
    </div>

    <!-- Sections -->
    <div v-else-if="metrics" class="ops-sections">
      <section v-for="sec in sections" :key="sec.key" class="ops-section">
        <div class="ops-section-head">
          <span class="ops-section-ico" v-html="sec.icon"></span>
          <h2>{{ sec.title }}</h2>
          <span v-if="sec.unavailable" class="ops-unavail">unavailable</span>
        </div>

        <div v-if="!sec.unavailable" class="ops-tiles">
          <div v-for="t in sec.tiles" :key="t.label" class="ops-tile" :class="t.tone">
            <div class="ops-tile-top">
              <span class="ops-tile-label">{{ t.label }}</span>
              <span v-if="t.tone && t.tone !== 'neutral'" class="ops-pill" :class="t.tone">
                <span class="ops-pill-dot"></span>{{ t.status }}
              </span>
            </div>
            <div class="ops-tile-val" :class="{ badge: t.badge }">{{ t.value }}</div>
            <div v-if="t.note" class="ops-tile-note">{{ t.note }}</div>
          </div>
        </div>

        <!-- version chips (pipeline) -->
        <div v-if="sec.chips" class="ops-chips">
          <span v-for="c in sec.chips" :key="c.k" class="ops-verchip">
            <span class="ops-verchip-k">{{ c.k }}</span>{{ c.v }}
          </span>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import api from '../../services/api'

const loading = ref(true)
const error = ref('')
const metrics = ref(null)
const updatedAt = ref('')
const autoRefresh = ref(false)
let timer = null

async function load() {
  loading.value = true
  try {
    error.value = ''
    const { data } = await api.get('/ops/metrics/')
    metrics.value = data
    updatedAt.value = new Date().toLocaleTimeString()
  } catch (e) {
    error.value = e?.response?.status === 403
      ? 'Admin access is required to view operations metrics.'
      : (e?.response?.data?.detail || e?.message || 'Failed to load metrics.')
  } finally {
    loading.value = false
  }
}

function onAutoToggle() {
  clearInterval(timer)
  if (autoRefresh.value) timer = setInterval(load, 15000)
}

onMounted(load)
onBeforeUnmount(() => clearInterval(timer))

// ── helpers ──────────────────────────────────────────────────────────────
const num = (n) => (n ?? 0).toLocaleString()
function bytes(n) {
  if (n == null) return '—'
  const u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let v = n, i = 0
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${i === 0 ? v : v.toFixed(v < 10 ? 1 : 0)} ${u[i]}`
}
const ok = (s) => (s && s.error) ? { error: true } : (s || {})

const ICON = {
  outbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
  broker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  artifacts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.27 6.96 8.73 5.05 8.73-5.05M12 22.08V12"/></svg>',
  pipeline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
  scripts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/></svg>',
  delegation: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  governance: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
}

const sections = computed(() => {
  const m = metrics.value || {}
  const out = ok(m.outbox), led = ok(m.capability_ledger), art = ok(m.artifacts)
  const pipe = ok(m.ingestion_pipeline), scr = ok(m.scripts), del = ok(m.delegations), gov = ok(m.governance)
  const cur = pipe.current || {}

  const deadTone = (out.dead > 0) ? 'critical' : 'good'
  const staleSrcTone = (pipe.stale_sources > 0) ? 'warning' : 'good'
  const staleChkTone = (pipe.stale_chunks > 0) ? 'warning' : 'good'

  return [
    {
      key: 'outbox', title: 'Task Outbox', icon: ICON.outbox, unavailable: !!out.error,
      tiles: [
        { label: 'Pending', value: num(out.pending), tone: 'neutral',
          note: `${num(out.pending_due)} due now` },
        { label: 'Dispatched', value: num(out.dispatched), tone: 'neutral' },
        { label: 'Dead-letter', value: num(out.dead), tone: deadTone,
          status: out.dead > 0 ? 'attention' : 'clear',
          note: out.dead > 0 ? 'exhausted retries' : 'none' },
      ],
    },
    {
      key: 'broker', title: 'Capability Broker', icon: ICON.broker, unavailable: !!led.error,
      tiles: [
        { label: 'Allowed', value: num(led.allowed), tone: 'neutral', note: 'tool calls authorized' },
        { label: 'Denied', value: num(led.denied), tone: 'neutral', note: 'fail-closed enforcement' },
      ],
    },
    {
      key: 'artifacts', title: 'Artifacts & Storage', icon: ICON.artifacts, unavailable: !!art.error,
      tiles: [
        { label: 'Artifacts', value: num(art.count), tone: 'neutral' },
        { label: 'Active grants', value: num(art.active_grants), tone: 'neutral', note: 'explicit shares' },
        ...(art.stored_bytes != null
          ? [{ label: 'Stored', value: bytes(art.stored_bytes), tone: 'neutral', note: 'deduped blobs' }]
          : []),
        { label: 'Backend', value: (m.storage?.artifact_backend || '—'), tone: 'neutral', badge: true },
      ],
    },
    {
      key: 'pipeline', title: 'Ingestion Pipeline', icon: ICON.pipeline, unavailable: !!pipe.error,
      tiles: [
        { label: 'Stale sources', value: num(pipe.stale_sources), tone: staleSrcTone,
          status: pipe.stale_sources > 0 ? 'behind' : 'current',
          note: pipe.stale_sources > 0 ? 'below current extractor' : 'up to date' },
        { label: 'Stale chunks', value: num(pipe.stale_chunks), tone: staleChkTone,
          status: pipe.stale_chunks > 0 ? 'behind' : 'current',
          note: pipe.stale_chunks > 0 ? 'below current chunker' : 'up to date' },
      ],
      chips: [
        { k: 'extractor', v: cur.extractor || '—' },
        { k: 'chunker', v: cur.chunker || '—' },
        { k: 'embedding', v: cur.embedding_model_default || '—' },
      ],
    },
    {
      key: 'scripts', title: 'Registered Scripts', icon: ICON.scripts, unavailable: !!scr.error,
      tiles: [
        { label: 'Scripts', value: num(scr.scripts), tone: 'neutral', note: 'active' },
        { label: 'Versions', value: num(scr.versions), tone: 'neutral', note: 'immutable history' },
      ],
    },
    {
      key: 'delegations', title: 'Multi-Agent Delegation', icon: ICON.delegation, unavailable: !!del.error,
      tiles: [
        { label: 'Delegations', value: num(del.total), tone: 'neutral', note: 'total handoffs' },
        { label: 'Verified', value: num(del.verified), tone: 'neutral',
          note: `${del.completed ? Math.round(100 * del.verified / del.completed) : 0}% of completed` },
        { label: 'Failed', value: num(del.failed), tone: (del.failed > 0) ? 'warning' : 'good',
          status: del.failed > 0 ? 'attention' : 'clear',
          note: del.failed > 0 ? 'sub-tasks failed' : 'none' },
        { label: 'Unverified', value: num(del.unverified_completed),
          tone: (del.unverified_completed > 0) ? 'warning' : 'good',
          status: del.unverified_completed > 0 ? 'review' : 'clear',
          note: 'completed but not verified' },
        { label: 'Ephemeral agents', value: num(del.live_ephemeral_agents), tone: 'neutral',
          note: 'live spawned specialists' },
      ],
    },
    {
      key: 'governance', title: 'Governance', icon: ICON.governance, unavailable: !!gov.error,
      tiles: [
        { label: 'Untrusted skills', value: num(gov.skills_untrusted), tone: 'neutral',
          note: 'awaiting trust review' },
        { label: 'Imported skills', value: num(gov.skills_imported),
          tone: (gov.skills_imported > 0) ? 'warning' : 'good',
          status: gov.skills_imported > 0 ? 'review' : 'clear', note: 'promote before scripts run' },
        { label: 'Bare agents', value: num(gov.bare_agents),
          tone: (gov.bare_agents > 0) ? 'warning' : 'good',
          status: gov.bare_agents > 0 ? 'check' : 'clear', note: 'no tools or skills' },
        { label: 'Paused agents', value: num(gov.paused_agents), tone: 'neutral' },
      ],
    },
  ]
})

const health = computed(() => {
  const m = metrics.value || {}
  const out = ok(m.outbox), pipe = ok(m.ingestion_pipeline)
  const crit = (out.dead || 0) > 0
  const warn = (pipe.stale_sources || 0) > 0 || (pipe.stale_chunks || 0) > 0
  if (crit) return { tone: 'critical', message: `${out.dead} task(s) in the dead-letter queue — needs attention` }
  if (warn) {
    const parts = []
    if (pipe.stale_sources > 0) parts.push(`${pipe.stale_sources} stale source(s)`)
    if (pipe.stale_chunks > 0) parts.push(`${pipe.stale_chunks} stale chunk(s)`)
    return { tone: 'warning', message: `Pipeline behind current versions — ${parts.join(', ')}` }
  }
  return { tone: 'healthy', message: 'All systems nominal' }
})
</script>

<style scoped>
.ops { padding: 32px 36px; max-width: 1180px; }

/* header */
.ops-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
.ops-head h1 { font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -.01em; }
.ops-head p { color: #64748b; margin-top: 6px; font-size: 14px; max-width: 640px; }
.ops-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.ops-refresh {
  display: inline-flex; align-items: center; gap: 7px; background: #4f46e5; color: #fff;
  border: none; border-radius: 10px; padding: 9px 14px; font-size: 13px; font-weight: 600; cursor: pointer;
  transition: background .15s;
}
.ops-refresh:hover { background: #4338ca; }
.ops-refresh:disabled { opacity: .6; cursor: default; }
.ops-refresh svg { width: 15px; height: 15px; }
.ops-refresh svg.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.ops-auto {
  display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; color: #64748b; font-weight: 600;
  cursor: pointer; user-select: none; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 10px;
  background: #fff;
}
.ops-auto input { display: none; }
.ops-auto-dot { width: 8px; height: 8px; border-radius: 50%; background: #cbd5e1; transition: background .15s; }
.ops-auto.on { color: #4f46e5; border-color: #c7d2fe; background: #eef2ff; }
.ops-auto.on .ops-auto-dot { background: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,.15); }

/* banner */
.ops-banner {
  display: flex; align-items: center; gap: 12px; margin: 22px 0 4px; padding: 13px 16px;
  border-radius: 12px; border: 1px solid; font-size: 13.5px; font-weight: 600;
}
.ops-banner-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.ops-banner.healthy { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; }
.ops-banner.healthy .ops-banner-dot { background: #16a34a; box-shadow: 0 0 0 3px rgba(22,163,74,.15); }
.ops-banner.warning { background: #fffbeb; border-color: #fde68a; color: #b45309; }
.ops-banner.warning .ops-banner-dot { background: #d97706; box-shadow: 0 0 0 3px rgba(217,119,6,.15); }
.ops-banner.critical { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }
.ops-banner.critical .ops-banner-dot { background: #dc2626; box-shadow: 0 0 0 3px rgba(220,38,38,.15); }
.ops-banner-msg { flex: 1; }
.ops-banner-meta { display: flex; align-items: center; gap: 10px; font-weight: 500; }
.ops-chip { background: rgba(15,23,42,.06); color: #475569; border-radius: 999px; padding: 3px 10px; font-size: 11.5px; font-weight: 600; }
.ops-updated { color: #94a3b8; font-size: 12px; font-weight: 500; }

/* error */
.ops-error { margin-top: 22px; background: #fff; border: 1px solid #fecaca; border-radius: 14px; padding: 22px; }
.ops-error-title { font-weight: 700; color: #b91c1c; font-size: 15px; }
.ops-error-msg { color: #64748b; font-size: 13.5px; margin: 6px 0 14px; }

/* sections */
.ops-sections { display: flex; flex-direction: column; gap: 26px; margin-top: 22px; }
.ops-section-head { display: flex; align-items: center; gap: 9px; margin-bottom: 13px; }
.ops-section-ico { color: #4f46e5; display: inline-flex; }
.ops-section-ico :deep(svg) { width: 17px; height: 17px; }
.ops-section-head h2 { font-size: 13px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: .04em; }
.ops-unavail { font-size: 11px; color: #94a3b8; background: #f1f5f9; border-radius: 6px; padding: 2px 8px; font-weight: 600; }

/* tiles */
.ops-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 14px; }
.ops-tile { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px 17px; position: relative; }
.ops-tile.good { }
.ops-tile.warning { border-color: #fde68a; background: #fffdf5; }
.ops-tile.critical { border-color: #fecaca; background: #fef6f6; }
.ops-tile-top { display: flex; align-items: center; justify-content: space-between; min-height: 18px; }
.ops-tile-label { font-size: 11.5px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .03em; }
.ops-tile-val { font-size: 28px; font-weight: 800; color: #0f172a; margin-top: 8px; font-variant-numeric: tabular-nums; letter-spacing: -.02em; }
.ops-tile-val.badge { font-size: 16px; text-transform: uppercase; letter-spacing: .04em; display: inline-block;
  background: #eef2ff; color: #4338ca; border-radius: 8px; padding: 4px 11px; margin-top: 10px; }
.ops-tile-note { font-size: 12px; color: #94a3b8; margin-top: 5px; }

/* status pills */
.ops-pill { display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 700;
  text-transform: uppercase; letter-spacing: .02em; border-radius: 999px; padding: 3px 8px; }
.ops-pill-dot { width: 6px; height: 6px; border-radius: 50%; }
.ops-pill.good { background: #f0fdf4; color: #15803d; }
.ops-pill.good .ops-pill-dot { background: #16a34a; }
.ops-pill.warning { background: #fffbeb; color: #b45309; }
.ops-pill.warning .ops-pill-dot { background: #d97706; }
.ops-pill.critical { background: #fef2f2; color: #b91c1c; }
.ops-pill.critical .ops-pill-dot { background: #dc2626; }

/* version chips */
.ops-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 13px; }
.ops-verchip { display: inline-flex; align-items: center; gap: 7px; background: #fff; border: 1px solid #e2e8f0;
  border-radius: 999px; padding: 5px 12px 5px 6px; font-size: 12px; color: #334155; font-weight: 600;
  font-variant-numeric: tabular-nums; }
.ops-verchip-k { background: #f1f5f9; color: #64748b; border-radius: 999px; padding: 2px 8px; font-size: 10.5px;
  text-transform: uppercase; letter-spacing: .03em; }

/* skeletons */
.ops-skel-title { height: 13px; width: 140px; border-radius: 6px; background: #eef2f7; margin-bottom: 13px; }
.ops-tile.ops-skel { height: 96px; background: linear-gradient(90deg, #f1f5f9 25%, #e9eef5 37%, #f1f5f9 63%);
  background-size: 400% 100%; animation: shimmer 1.4s ease infinite; border-color: #eef2f7; }
@keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }

@media (max-width: 640px) {
  .ops { padding: 22px 16px; }
  .ops-head { flex-direction: column; }
}
</style>
