<script setup>
// A project's Analytics page: its photos and labels in figures — the classes drawn, where each photo stands, the photo
// sizes, a CSV of every photo — and how the app's own model does, by what its users did with the model's walls.
// Every figure is counted by the backend (app_api.py analytics/…); nothing here is typed in or estimated.
import { computed, ref, watch } from 'vue';
import { Download, RefreshCw } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import { analyticsApi, csvUrl, share, bytesText, scatter } from '../api/analytics.js';

const props = defineProps({ projectRef: { type: String, required: true } });
const data = ref(null); const error = ref(''); const loading = ref(false);
const app = ref(null); const appError = ref(''); const days = ref(30);

async function load() {
  loading.value = true; error.value = '';
  try { data.value = await analyticsApi.load(props.projectRef); } catch (e) { error.value = e.message; } finally { loading.value = false; }
}
async function loadApp() {
  appError.value = '';
  try { app.value = await analyticsApi.app(props.projectRef, days.value); } catch (e) { appError.value = e.message; }
}
watch(() => props.projectRef, () => { data.value = null; app.value = null; load(); loadApp(); }, { immediate: true });
watch(days, loadApp);
function refresh() { load(); loadApp(); }

const most = computed(() => Math.max(1, ...(data.value?.classes || []).map(c => c.count)));
const accepted = computed(() => data.value?.statuses.find(s => s.status === 'Accepted')?.count || 0);
const plot = computed(() => scatter(data.value?.sizes.points || []));
const showTable = ref(false);

// The app's model.
const answered = computed(() => (app.value?.outcomes || []).filter(o => app.value.answered_keys.includes(o.key)));
const unasked = computed(() => (app.value?.outcomes || []).find(o => o.key === 'unasked'));
const busiest = computed(() => Math.max(1, ...(app.value?.days || []).map(d => d.total)));
const diagonal = value => (value === null || value === undefined ? '—' : `${(value * 100).toFixed(2)}% of the diagonal`);
const dayText = day => new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
</script>

<template>
  <div class="analytics-page">
    <div class="studio-actions">
      <p class="analytics-meta">Counted from this project's photos and labels.</p>
      <UiButton :disabled="loading" @click="refresh"><RefreshCw :size="15"/> Refresh</UiButton>
      <a class="button button--secondary" :href="csvUrl(projectRef)" download><Download :size="15"/> Download CSV</a>
    </div>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <p v-if="!data&&!error">Loading…</p>
    <template v-else-if="data">
      <div class="metric-grid">
        <article><span>Photos</span><strong>{{ data.photos }}</strong><small>{{ data.nothing_drawn }} with nothing drawn · {{ data.golden }} golden</small></article>
        <article><span>Labels</span><strong>{{ data.labels }}</strong><small>{{ data.shapes }} shapes drawn on {{ data.drawn_on }} photos</small></article>
        <article><span>Accepted</span><strong>{{ accepted }}</strong><small>{{ share(accepted, data.photos) }} of the photos</small></article>
        <article><span>Photo size (median)</span><strong>{{ data.sizes.width.median ? `${Math.round(data.sizes.width.median)} × ${Math.round(data.sizes.height.median)}` : '—' }}</strong><small>{{ bytesText(data.sizes.bytes.total) }} in all</small></article>
      </div>

      <section class="panel">
        <h2>Class distribution</h2>
        <p class="analytics-meta">Shapes of each class, on the label a person sees on each photo: the approved one, else a finished one, else the newest draft.</p>
        <p v-if="!data.classes.length" class="analytics-meta">Nothing is drawn yet.</p>
        <div v-for="c in data.classes" :key="c.name" class="bar-row">
          <span class="bar-name">{{ c.name }}</span>
          <div class="bar-track" :title="`${c.name}: ${c.count} shapes (${share(c.count, data.shapes)})`"><i :style="{width:`${(c.count/most)*100}%`}"></i></div>
          <strong>{{ c.count }}</strong><span class="bar-share">{{ share(c.count, data.shapes) }}</span>
        </div>
      </section>

      <div class="analytics-grid">
        <section class="panel">
          <h2>Review readiness</h2>
          <p class="analytics-meta">Where each photo stands on its way to a dataset version.</p>
          <div v-for="s in data.statuses" :key="s.status" class="stat-row"><span>{{ s.status }}</span><UiBadge :tone="s.status==='Accepted'?'green':s.status==='Changes requested'&&s.count?'amber':'neutral'">{{ s.count }}</UiBadge></div>
          <h3 class="sub">Splits</h3>
          <div v-for="k in ['train','val','test','unassigned']" :key="k" class="stat-row"><span>{{ {train:'Train',val:'Validation',test:'Test',unassigned:'Not given a home yet'}[k] }}</span><UiBadge>{{ data.splits[k] ?? 0 }}</UiBadge></div>
          <h3 class="sub">Labels</h3>
          <div v-for="s in data.label_states" :key="s.state" class="stat-row"><span>{{ s.label }}</span><UiBadge>{{ s.count }}</UiBadge></div>
        </section>
        <section class="panel">
          <h2>Photo sizes</h2>
          <p class="analytics-meta">Width and height of the photos as they are stored; a larger dot is more photos of that size.</p>
          <p v-if="!data.photos" class="analytics-meta">No photos yet.</p>
          <template v-else>
            <svg class="size-plot" viewBox="0 0 520 260" role="img" :aria-label="`Photo sizes: widths ${data.sizes.width.min} to ${data.sizes.width.max} pixels, heights ${data.sizes.height.min} to ${data.sizes.height.max} pixels`">
              <line x1="36" y1="224" x2="484" y2="224" class="axis"/><line x1="36" y1="36" x2="36" y2="224" class="axis"/>
              <text x="50" y="242" class="tick">{{ plot.minW }}</text><text x="470" y="242" class="tick" text-anchor="end">{{ plot.maxW }}</text>
              <text x="260" y="256" class="tick" text-anchor="middle">width, px</text>
              <text x="30" y="54" class="tick" text-anchor="end">{{ plot.maxH }}</text><text x="30" y="210" class="tick" text-anchor="end">{{ plot.minH }}</text>
              <text x="36" y="24" class="tick">height, px</text>
              <circle v-for="d in plot.dots" :key="`${d.width}x${d.height}`" :cx="d.x" :cy="d.y" :r="d.r" class="dot"><title>{{ d.width }} × {{ d.height }} px: {{ d.count }} photo{{ d.count===1?'':'s' }}</title></circle>
            </svg>
            <div class="size-facts">
              <div><span>Width</span><strong>{{ data.sizes.width.min }} – {{ data.sizes.width.max }} px</strong></div>
              <div><span>Height</span><strong>{{ data.sizes.height.min }} – {{ data.sizes.height.max }} px</strong></div>
              <div><span>Landscape · portrait · square</span><strong>{{ data.sizes.orientation.landscape }} · {{ data.sizes.orientation.portrait }} · {{ data.sizes.orientation.square }}</strong></div>
              <div><span>File size (median)</span><strong>{{ bytesText(data.sizes.bytes.median) }}</strong></div>
            </div>
            <div v-for="m in data.sizes.megapixels" :key="m.label" class="stat-row"><span>{{ m.label }}</span><UiBadge>{{ m.count }}</UiBadge></div>
            <button class="link-button" @click="showTable=!showTable">{{ showTable ? 'Hide' : 'Show' }} the sizes as a table</button>
            <div v-if="showTable" class="table-wrap"><table><thead><tr><th>Width</th><th>Height</th><th>Photos</th></tr></thead>
              <tbody><tr v-for="p in data.sizes.points" :key="`${p.width}x${p.height}`"><td>{{ p.width }} px</td><td>{{ p.height }} px</td><td>{{ p.count }}</td></tr></tbody></table></div>
          </template>
        </section>
      </div>

      <section class="panel">
        <div class="app-head"><h2>How the app's model does</h2>
          <select v-if="app" v-model.number="days" class="text-input compact" aria-label="Period"><option v-for="p in app.periods" :key="p.value" :value="p.value">{{ p.label }}</option></select></div>
        <p class="analytics-meta">Counted from the events the app sends: each time a user confirmed walls, whether they kept the model's walls, adjusted them, or drew them by hand.</p>
        <p v-if="appError" class="field-error" role="alert">{{ appError }}</p>
        <p v-else-if="!app">Loading…</p>
        <p v-else-if="!app.events" class="analytics-meta empty">No wall events from the app in this period.</p>
        <template v-else>
          <div class="metric-grid">
            <article><span>Model answers</span><strong>{{ app.detections }}</strong><small>{{ app.unconfirmed_detections }} not followed by a confirmation</small></article>
            <article><span>Confirmations</span><strong>{{ app.confirmations }}</strong><small>{{ app.answered }} after a model answer</small></article>
            <article><span>Photos</span><strong>{{ app.photos }}</strong><small>with an answer or a confirmation</small></article>
            <article><span>Drawn by hand, no answer</span><strong>{{ unasked?.count ?? 0 }}</strong><small>nothing to compare with</small></article>
          </div>
          <h3 class="sub">After a model answer</h3>
          <div v-for="o in answered" :key="o.key" class="bar-row">
            <span class="bar-name">{{ o.label }}</span>
            <div class="bar-track" :title="`${o.label}: ${o.count} (${share(o.count, app.answered)}); median change ${diagonal(o.median)}`"><i :style="{width:`${(o.share||0)*100}%`}"></i></div>
            <strong>{{ o.count }}</strong><span class="bar-share">{{ share(o.count, app.answered) }}</span>
          </div>
          <div class="table-wrap"><table>
            <thead><tr><th>What the user did</th><th>Confirmations</th><th>Share</th><th>Walls unchanged</th><th>Median corner change</th></tr></thead>
            <tbody><tr v-for="o in answered" :key="o.key"><td>{{ o.label }}</td><td>{{ o.count }}</td><td>{{ share(o.count, app.answered) }}</td><td>{{ o.unchanged }} of {{ o.measured }}</td><td>{{ diagonal(o.median) }}</td></tr></tbody>
          </table></div>
          <template v-if="app.models.length">
            <h3 class="sub">By model</h3>
            <div class="table-wrap"><table>
              <thead><tr><th>Model</th><th>Answers</th><th>Median time</th><th>Kept</th><th>Adjusted</th><th>Drawn instead</th></tr></thead>
              <tbody><tr v-for="m in app.models" :key="m.name"><td>{{ m.name }}</td><td>{{ m.detections }}</td><td>{{ m.median_ms === null ? '—' : `${m.median_ms} ms` }}</td><td>{{ m.kept }}</td><td>{{ m.adjusted }}</td><td>{{ m.replaced }}</td></tr></tbody>
            </table></div>
          </template>
          <template v-if="app.days.length">
            <h3 class="sub">Confirmations by day</h3>
            <svg class="day-plot" :viewBox="`0 0 ${Math.max(320, app.days.length*22)} 140`" role="img" aria-label="Confirmations by day">
              <g v-for="(d, i) in app.days" :key="d.day">
                <rect :x="i*22+4" :y="120 - (d.total/busiest)*100" width="14" :height="Math.max(1,(d.total/busiest)*100)" rx="4" class="day-bar"><title>{{ dayText(d.day) }}: {{ d.total }} confirmations ({{ d.kept }} kept, {{ d.adjusted }} adjusted, {{ d.replaced }} drawn instead, {{ d.unasked }} with no answer); {{ d.detections }} model answers</title></rect>
              </g>
              <line x1="0" y1="120.5" :x2="Math.max(320, app.days.length*22)" y2="120.5" class="axis"/>
              <text x="4" y="136" class="tick">{{ dayText(app.days[0].day) }}</text>
              <text :x="Math.max(320, app.days.length*22) - 4" y="136" class="tick" text-anchor="end">{{ dayText(app.days[app.days.length-1].day) }}</text>
            </svg>
          </template>
        </template>
      </section>
    </template>
  </div>
</template>

<style scoped>
.analytics-meta{font-size:12px!important;color:#6d7c92!important;margin:4px 0 12px!important}
.analytics-meta.empty{padding:24px 0;text-align:center}
.studio-actions>.analytics-meta{margin:0!important;flex:1}
a.button{text-decoration:none;color:inherit}
.metric-grid small{font-size:11px;color:#6d7c92}
.analytics-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:20px 0}
.panel>h2{margin-top:0}
.sub{font-size:12px!important;font-weight:600;color:#33415c;margin:18px 0 4px!important}
.bar-row{display:grid;grid-template-columns:minmax(90px,200px) 1fr 48px 52px;align-items:center;gap:12px;padding:6px 0;font-size:12px}
.bar-name{color:#33415c;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar-track{height:10px;background:#f0f2f6;border-radius:4px;overflow:hidden}
.bar-track i{display:block;height:100%;background:var(--aadml-focus);border-radius:0 4px 4px 0;min-width:2px}
.bar-row strong{text-align:right;color:#162139}
.bar-share{color:#6d7c92;text-align:right}
.stat-row{padding:9px 0!important;font-size:12px}
.size-plot{width:100%;height:auto;margin:6px 0 10px}
.axis{stroke:#d7dbe3;stroke-width:1}
.tick{font-size:10px;fill:#6d7c92}
.dot{fill:var(--aadml-focus);fill-opacity:.55;stroke:#fff;stroke-width:2}
.dot:hover{fill-opacity:.9}
.size-facts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
.size-facts>div{border:1px solid #e6e8ee;border-radius:7px;padding:8px 10px}
.size-facts span{display:block;font-size:11px;color:#6d7c92}
.size-facts strong{font-size:13px}
.link-button{background:none;border:0;color:var(--aadml-primary);font-size:12px;padding:8px 0;text-decoration:underline;cursor:pointer}
.app-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.text-input.compact{width:auto;padding:8px 10px;font-size:12px}
.table-wrap{margin-top:12px}
.table-wrap td,.table-wrap th{padding:9px 12px;font-size:12px}
.day-plot{width:100%;height:auto;max-height:180px;margin-top:6px}
.day-bar{fill:var(--aadml-focus)}
.day-bar:hover{fill:var(--aadml-primary)}
.badge--amber{color:#93610b;background:#fff4dc}
@media(max-width:900px){.analytics-grid{grid-template-columns:1fr}.metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
