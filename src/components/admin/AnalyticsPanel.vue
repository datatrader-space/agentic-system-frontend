<template>
  <div class="ap">
    <div class="ap-head">
      <h2>Website Traffic <span class="badge">Last {{ days }} days</span></h2>
      <div class="range">
        <button v-for="d in [7, 30, 90]" :key="d" :class="{ active: days === d }" @click="setDays(d)">{{ d }}d</button>
      </div>
    </div>

    <div v-if="loading" class="ap-loading">Loading analytics…</div>

    <template v-else>
      <!-- Overview cards -->
      <div class="cards">
        <div class="card"><div class="v">{{ num(ov.visitors) }}</div><div class="l">Visitors</div></div>
        <div class="card"><div class="v">{{ num(ov.pageviews) }}</div><div class="l">Pageviews</div></div>
        <div class="card"><div class="v">{{ ov.pages_per_visit || 0 }}</div><div class="l">Pages / visit</div></div>
        <div class="card"><div class="v">{{ num(ov.new_visitors) }}</div><div class="l">New visitors</div></div>
      </div>

      <!-- Timeseries (CSS bars) -->
      <div class="block">
        <h3>Pageviews per day</h3>
        <div class="chart">
          <div v-for="(p, i) in ov.timeseries" :key="i" class="bar-wrap" :title="`${p.date}: ${p.pageviews} views`">
            <div class="bar" :style="{ height: barH(p.pageviews) + '%' }"></div>
          </div>
        </div>
      </div>

      <div class="two-col">
        <!-- Top pages -->
        <div class="block">
          <h3>Top pages</h3>
          <table class="tbl">
            <thead><tr><th>Path</th><th>Views</th><th>Uniques</th></tr></thead>
            <tbody>
              <tr v-for="p in pages" :key="p.path"><td class="path">{{ p.path }}</td><td>{{ p.views }}</td><td>{{ p.uniques }}</td></tr>
              <tr v-if="!pages.length"><td colspan="3" class="empty">No data yet</td></tr>
            </tbody>
          </table>
        </div>

        <!-- Sources -->
        <div class="block">
          <h3>Top sources</h3>
          <div class="rows">
            <div v-for="s in sources.referrers" :key="s.source" class="kv"><span>{{ s.source }}</span><span class="n">{{ s.count }}</span></div>
            <div v-if="!sources.referrers?.length" class="empty">No data yet</div>
          </div>
        </div>
      </div>

      <div class="two-col">
        <!-- Tech -->
        <div class="block">
          <h3>Devices &amp; browsers</h3>
          <div class="rows">
            <div v-for="d in tech.devices" :key="'d'+d.device" class="kv"><span>{{ d.device }}</span><span class="n">{{ d.count }}</span></div>
            <div v-for="b in tech.browsers" :key="'b'+b.browser" class="kv sub"><span>{{ b.browser }}</span><span class="n">{{ b.count }}</span></div>
          </div>
        </div>

        <!-- Funnel -->
        <div class="block">
          <h3>Signup &amp; upgrade funnel</h3>
          <div class="funnel">
            <div v-for="f in funnel" :key="f.step" class="fstep">
              <div class="fbar" :style="{ width: funnelW(f.count) + '%' }"></div>
              <span class="flabel">{{ f.step }}</span><span class="fcount">{{ f.count }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Visitors -->
      <div class="block">
        <h3>Recent visitors</h3>
        <table class="tbl">
          <thead><tr><th>Visitor</th><th>User</th><th>Source</th><th>Device</th><th>Pages</th><th>Last seen</th></tr></thead>
          <tbody>
            <tr v-for="v in visitors" :key="v.visitor_id" class="vrow" @click="openVisitor(v.visitor_id)">
              <td class="mono">{{ v.visitor_id.slice(0, 10) }}…</td>
              <td>{{ v.user || '—' }}</td>
              <td>{{ v.utm_source || hostOf(v.referrer) || 'direct' }}</td>
              <td>{{ v.device }}</td>
              <td>{{ v.pageviews }}</td>
              <td>{{ fmt(v.last_seen) }}</td>
            </tr>
            <tr v-if="!visitors.length"><td colspan="6" class="empty">No visitors yet</td></tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Visitor detail drawer -->
    <div v-if="detail" class="drawer-overlay" @click.self="detail = null">
      <div class="drawer">
        <div class="drawer-head">
          <h3>Visitor {{ detail.visitor.visitor_id.slice(0, 12) }}…</h3>
          <button class="x" @click="detail = null">✕</button>
        </div>
        <div class="meta">
          <div><span>User</span><b>{{ detail.visitor.user || 'anonymous' }}</b></div>
          <div><span>Device</span><b>{{ detail.visitor.device }} · {{ detail.visitor.browser }} · {{ detail.visitor.os }}</b></div>
          <div><span>Source</span><b>{{ detail.visitor.utm_source || hostOf(detail.visitor.referrer) || 'direct' }}</b></div>
          <div><span>Landing</span><b>{{ detail.visitor.landing_path || '—' }}</b></div>
          <div><span>First seen</span><b>{{ fmt(detail.visitor.first_seen) }}</b></div>
        </div>
        <h4>Pageview trail</h4>
        <ol class="trail">
          <li v-for="(pv, i) in detail.pageviews" :key="i"><span class="mono">{{ pv.path }}</span><span class="t">{{ fmt(pv.created_at) }}</span></li>
          <li v-if="!detail.pageviews.length" class="empty">No pageviews</li>
        </ol>
        <template v-if="detail.events.length">
          <h4>Events</h4>
          <ol class="trail">
            <li v-for="(e, i) in detail.events" :key="i"><span>{{ e.name }}</span><span class="t">{{ fmt(e.created_at) }}</span></li>
          </ol>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../../services/api'

const days = ref(30)
const loading = ref(true)
const ov = ref({})
const pages = ref([])
const sources = ref({})
const tech = ref({})
const funnel = ref([])
const visitors = ref([])
const detail = ref(null)

onMounted(load)

async function load() {
  loading.value = true
  try {
    const [o, p, s, t, f, v] = await Promise.all([
      api.analyticsOverview(days.value), api.analyticsPages(days.value),
      api.analyticsSources(days.value), api.analyticsTech(days.value),
      api.analyticsFunnels(days.value), api.analyticsVisitors(days.value),
    ])
    ov.value = o.data
    pages.value = p.data.pages || []
    sources.value = s.data
    tech.value = t.data
    funnel.value = f.data.funnel || []
    visitors.value = v.data.visitors || []
  } catch (e) {
    console.warn('analytics:', e.message)
  } finally {
    loading.value = false
  }
}

function setDays(d) { days.value = d; load() }

async function openVisitor(vid) {
  try { detail.value = (await api.analyticsVisitor(vid)).data } catch (e) { /* ignore */ }
}

const maxViews = () => Math.max(1, ...(ov.value.timeseries || []).map(p => p.pageviews))
function barH(n) { return Math.round((n / maxViews()) * 100) }
const maxFunnel = () => Math.max(1, ...(funnel.value || []).map(f => f.count))
function funnelW(n) { return Math.max(3, Math.round((n / maxFunnel()) * 100)) }
function num(n) { return (n || 0).toLocaleString() }
function fmt(d) { return d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '' }
function hostOf(url) { try { return url ? new URL(url).hostname : '' } catch { return '' } }
</script>

<style scoped>
.ap { display: flex; flex-direction: column; gap: 1.25rem; }
.ap-head { display: flex; align-items: center; justify-content: space-between; }
.ap-head h2 { font-size: 1.2rem; font-weight: 700; display: flex; align-items: center; gap: .5rem; }
.badge { background: rgba(37,99,235,.1); color: #2563EB; padding: .2rem .6rem; border-radius: 6px; font-size: .75rem; font-weight: 600; }
.range button { border: 1px solid var(--border); background: transparent; color: var(--text-muted); padding: 5px 11px; border-radius: 8px; font-size: .8rem; font-weight: 600; cursor: pointer; margin-left: 4px; }
.range button.active { background: rgba(37,99,235,.1); color: #2563EB; border-color: transparent; }
.ap-loading { color: var(--text-muted); padding: 1rem; }

.cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
.card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 1.1rem; text-align: center; }
.card .v { font-size: 1.7rem; font-weight: 800; }
.card .l { color: var(--text-muted); font-size: .8rem; margin-top: .2rem; }

.block { background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 1.2rem; }
.block h3 { font-size: .95rem; font-weight: 700; margin-bottom: .8rem; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }

.chart { display: flex; align-items: flex-end; gap: 3px; height: 120px; }
.bar-wrap { flex: 1; height: 100%; display: flex; align-items: flex-end; }
.bar { width: 100%; background: linear-gradient(180deg, #2563EB, #14B8A6); border-radius: 3px 3px 0 0; min-height: 2px; transition: height .3s; }

.tbl { width: 100%; border-collapse: collapse; }
.tbl th, .tbl td { padding: .5rem .6rem; text-align: left; border-bottom: 1px solid var(--border); font-size: .82rem; }
.tbl th { color: var(--text-muted); font-size: .72rem; text-transform: uppercase; font-weight: 600; }
.tbl td.path, .mono { font-family: 'JetBrains Mono', monospace; font-size: .78rem; }
.vrow { cursor: pointer; }
.vrow:hover { background: rgba(37,99,235,.04); }
.empty { color: var(--text-muted); text-align: center; padding: 1rem; font-size: .82rem; }

.rows { display: flex; flex-direction: column; gap: 2px; }
.kv { display: flex; justify-content: space-between; padding: .4rem .2rem; border-bottom: 1px solid var(--border); font-size: .84rem; }
.kv.sub { color: var(--text-muted); padding-left: 1rem; }
.kv .n { font-weight: 600; }

.funnel { display: flex; flex-direction: column; gap: 8px; }
.fstep { position: relative; background: rgba(37,99,235,.06); border-radius: 8px; height: 34px; display: flex; align-items: center; overflow: hidden; }
.fbar { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, #2563EB, #14B8A6); opacity: .25; }
.flabel { position: relative; padding-left: 12px; font-size: .82rem; }
.fcount { position: relative; margin-left: auto; padding-right: 12px; font-weight: 700; font-size: .85rem; }

.drawer-overlay { position: fixed; inset: 0; z-index: 1100; background: rgba(15,23,42,.4); display: flex; justify-content: flex-end; }
.drawer { width: 100%; max-width: 460px; height: 100%; background: var(--bg-elevated, #fff); padding: 1.4rem; overflow-y: auto; box-shadow: -10px 0 40px rgba(0,0,0,.2); }
.drawer-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.drawer-head h3 { font-size: 1rem; font-weight: 700; }
.x { border: none; background: none; font-size: 1.1rem; cursor: pointer; color: var(--text-muted); }
.meta { display: flex; flex-direction: column; gap: 6px; margin-bottom: 1.2rem; }
.meta div { display: flex; justify-content: space-between; font-size: .82rem; }
.meta span { color: var(--text-muted); }
.drawer h4 { font-size: .8rem; text-transform: uppercase; color: var(--text-muted); margin: 1rem 0 .5rem; }
.trail { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
.trail li { display: flex; justify-content: space-between; gap: 10px; padding: .4rem .6rem; background: rgba(37,99,235,.04); border-radius: 7px; font-size: .8rem; }
.trail .t { color: var(--text-muted); white-space: nowrap; }

@media (max-width: 768px) {
  .cards { grid-template-columns: repeat(2, 1fr); }
  .two-col { grid-template-columns: 1fr; }
}
</style>
