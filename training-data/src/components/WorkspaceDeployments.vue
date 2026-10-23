<script setup>
// The workspace's Deployments page, laid out as Roboflow's (owner, 2026-10-21): tabs for every way of deploying, of
// which the Cloud API is AADML's today and the others say Coming soon; the Overview with the successful calls of the
// workspace's models over a chosen range, the ways to deploy, "Improve model", and the projects deployed and not yet
// deployed. Deploying, stopping and going back are done on a project's own Deployments page.
// Backend: app_api.py workspace/deployments/?range= (and workspace/models/ for "Improve model").
import { computed, ref, watch } from 'vue';
import {
  ArrowRight, BookOpen, Check, ChartColumn, ChartLine, Cloud, Cpu, KeyRound, Layers, Network, Plus, RefreshCw,
  Rocket, Server, Sparkles, Video, Zap,
} from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import UiDialog from './UiDialog.vue';
import {
  workspaceApi, projectLink, environmentState, modelName, timeAgo, RUN_RANGES, API_REFERENCE, runsChart, runsDay,
} from '../api/workspace.js';

const emit = defineEmits(['navigate', 'create']);

const TABS = [
  { id: 'overview', name: 'Overview', icon: ChartLine },
  { id: 'dedicated', name: 'Dedicated Deployments', icon: Server, soon: 'A model on servers of its own, kept for your apps only and sized for steady traffic.' },
  { id: 'batch', name: 'Batch Processing', icon: Layers, soon: 'Run a model over a whole folder of photos or videos at once, from this page, the command line or code, and download what it found.' },
  { id: 'edge', name: 'Edge Devices', icon: Cpu, soon: 'Run a model on your own hardware, such as a camera box or a laptop, so photos never leave your site.' },
  { id: 'streaming', name: 'Cloud Streaming', icon: Video, soon: 'Point a model at a live video stream and receive its answers while the video plays.' },
  { id: 'cost', name: 'Cost Benchmark', icon: ChartColumn, soon: 'Compare what a model costs per thousand calls on each way of deploying it.' },
];
const tab = ref('overview');
const current = computed(() => TABS.find(t => t.id === tab.value));

// The page's data: the projects and their deployments, and the successful calls over the chosen range.
const range = ref('1m');
const data = ref(null); const error = ref(''); const busy = ref(false);
async function load() {
  busy.value = true;
  try { data.value = await workspaceApi.deployments(range.value); error.value = ''; }
  catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}
watch(range, load, { immediate: true });
const rows = computed(() => data.value?.projects || []);
const deployed = computed(() => rows.value.filter(row => row.deployed));
const idle = computed(() => rows.value.filter(row => !row.deployed));
const runs = computed(() => data.value?.runs || null);

// The chart: a smooth area of successful calls; the readout follows the pointer, or the arrow keys.
const W = 1000; const H = 200;
const chart = computed(() => runsChart(runs.value?.series || [], W, H));
const hover = ref(null);
const point = computed(() => (hover.value === null || !runs.value ? null : runs.value.series[hover.value]));
function pointAt(event) {
  const n = runs.value?.series.length || 0;
  if (!n) return;
  const box = event.currentTarget.getBoundingClientRect();
  hover.value = Math.min(n - 1, Math.max(0, Math.round(((event.clientX - box.left) / box.width) * (n - 1))));
}
function step(by) {
  const n = runs.value?.series.length || 0;
  if (n) hover.value = Math.min(n - 1, Math.max(0, (hover.value ?? n - 1) + by));
}
const ticks = computed(() => {
  const series = runs.value?.series || [];
  if (!series.length) return [];
  const picks = [...new Set([0, Math.floor((series.length - 1) / 2), series.length - 1])];
  return picks.map(i => ({ left: (chart.value.xs[i] / W) * 100, text: runsDay(series[i].day, runs.value.bucket) }));
});
const total = computed(() => (runs.value ? runs.value.answered.toLocaleString() : '—'));
const said = computed(() => {
  if (!runs.value) return '';
  const label = RUN_RANGES.find(([key]) => key === runs.value.range)?.[1];
  return `${runs.value.answered} successful call${runs.value.answered === 1 ? '' : 's'} of ${runs.value.calls}, ${label === 'All Time' ? 'all time' : `last ${label}`}.`;
});

// "Improve model": a model of the workspace, opened on its project's Models page.
const models = ref([]);
workspaceApi.models().then(body => { models.value = body.models || []; improve.value = models.value[0] ? key(models.value[0]) : ''; }).catch(() => {});
const key = m => `${m.project.ref}#${m.number}`;
const improve = ref('');
const improving = computed(() => models.value.find(m => key(m) === improve.value));

// The lists below the overview.
const listTab = ref('deployed');
const keysOpen = ref(false);
const day = iso => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '');
function openTab(id) { tab.value = id; }
function showDeployed() { listTab.value = 'deployed'; document.getElementById('ws-deploy-lists')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
</script>

<template>
  <div class="studio ws-deployments">
    <nav class="deploy-tabs" role="tablist" aria-label="Ways to deploy">
      <!-- As Roboflow's, the tabs carry no tags; a tab not built yet opens a Coming soon panel. -->
      <button v-for="t in TABS" :key="t.id" type="button" role="tab" :aria-selected="tab===t.id" :class="{active:tab===t.id}" :title="t.soon ? 'Coming soon' : undefined" @click="openTab(t.id)">
        <component :is="t.icon" :size="15"/> {{ t.name }}
      </button>
    </nav>

    <section v-if="current.soon" class="panel soon" role="tabpanel">
      <span class="soon-icon"><component :is="current.icon" :size="26"/></span>
      <div><h2>{{ current.name }} <UiBadge tone="purple">Coming soon</UiBadge></h2>
        <p>{{ current.soon }} It is not available in AADML yet. Today a model answers through the Cloud API: its project's Deployments page puts it live in staging or production.</p>
        <UiButton @click="tab='overview'">Back to Overview</UiButton></div>
    </section>

    <div v-else role="tabpanel">
      <p v-if="error" class="field-error" role="alert">{{ error }}</p>

      <section class="runs" :class="{ refreshing: busy && data }" aria-labelledby="runs-label">
        <div class="runs-top">
          <div class="ranges" role="group" aria-label="Time range">
            <button v-for="[value, label] in RUN_RANGES" :key="value" type="button" :aria-pressed="range===value" :class="{active:range===value}" @click="range=value">{{ label }}</button>
          </div>
          <span class="runs-note">From your apps' calls <button class="icon-only" type="button" :disabled="busy" aria-label="Refresh" title="Refresh" @click="load"><RefreshCw :size="14"/></button></span>
        </div>
        <div class="runs-hero">
          <span class="digits">{{ total }}</span><span class="bolt" aria-hidden="true"><Zap :size="22"/></span>
        </div>
        <p id="runs-label" class="runs-label">successful calls</p>
        <div v-if="!data" class="chart-wait" aria-hidden="true"></div>
        <div v-else class="chart" tabindex="0" role="img" :aria-label="said"
             @pointermove="pointAt" @pointerleave="hover=null" @focus="step(0)" @blur="hover=null"
             @keydown.left.prevent="step(-1)" @keydown.right.prevent="step(1)">
          <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" aria-hidden="true">
            <path class="area" :d="chart.area"/>
            <path class="line" :d="chart.line" vector-effect="non-scaling-stroke"/>
            <line class="base" x1="0" :y1="H - 1" :x2="W" :y2="H - 1" vector-effect="non-scaling-stroke"/>
          </svg>
          <template v-if="point">
            <span class="crosshair" :style="{ left: `${chart.xs[hover] / W * 100}%` }"></span>
            <span class="dot" :style="{ left: `${chart.xs[hover] / W * 100}%`, top: `${chart.ys[hover] / H * 100}%` }"></span>
            <div class="tip" :class="{ flip: chart.xs[hover] > W * 0.7 }" :style="{ left: `${chart.xs[hover] / W * 100}%` }" role="status">
              <strong>{{ runsDay(point.day, runs.bucket) }}</strong>
              <span>{{ point.answered.toLocaleString() }} successful</span><small>{{ point.calls.toLocaleString() }} call{{ point.calls===1?'':'s' }} in all</small>
            </div>
          </template>
          <div class="ticks" aria-hidden="true"><span v-for="t in ticks" :key="t.left" :style="{ left: `${t.left}%` }">{{ t.text }}</span></div>
        </div>
        <details v-if="runs && runs.series.length" class="as-table">
          <summary>Show as a table</summary>
          <div class="table-wrap"><table class="ws-table">
            <thead><tr><th>{{ runs.bucket === 'week' ? 'Week' : 'Day' }}</th><th>Successful calls</th><th>All calls</th></tr></thead>
            <tbody><tr v-for="p in [...runs.series].reverse()" :key="p.day"><td>{{ runsDay(p.day, runs.bucket) }}</td><td>{{ p.answered }}</td><td>{{ p.calls }}</td></tr></tbody>
          </table></div>
        </details>
      </section>

      <section class="ask">
        <p>Not sure which deployment type to use?</p>
        <UiButton @click="emit('navigate', 'agent')"><Sparkles :size="15"/> Ask the AADML Agent</UiButton>
      </section>

      <section class="ways" aria-label="Ways to deploy">
        <button type="button" class="way" @click="showDeployed">
          <span class="way-icon"><Cloud :size="18"/></span>
          <span><strong>Cloud API</strong><small>Your model answers at its own address in staging and production, called with your app's key.</small></span>
          <ArrowRight :size="16" class="way-go"/>
        </button>
        <button type="button" class="way" @click="openTab('dedicated')">
          <span class="way-icon"><Server :size="18"/></span>
          <span><strong>Dedicated Deployments <UiBadge tone="purple">Coming soon</UiBadge></strong><small>Private cloud servers for your workloads.</small></span>
          <ArrowRight :size="16" class="way-go"/>
        </button>
        <button type="button" class="way" @click="openTab('batch')">
          <span class="way-icon"><Layers :size="18"/></span>
          <span><strong>Batch Processing <UiBadge tone="purple">Coming soon</UiBadge></strong><small>Process large volumes of photos and videos via the app, the command line or code.</small></span>
          <ArrowRight :size="16" class="way-go"/>
        </button>
      </section>

      <section class="improve">
        <label for="improve-model"><Network :size="16"/> Improve model:</label>
        <select id="improve-model" v-model="improve" class="text-input compact" :disabled="!models.length">
          <option v-if="!models.length" value="">No model trained yet</option>
          <option v-for="m in models" :key="key(m)" :value="key(m)">{{ m.project.name }}: {{ m.name }} {{ m.version || '' }}</option>
        </select>
        <a v-if="improving" class="button button--primary small" :href="projectLink(improving.project.ref, 'models')"><ChartLine :size="14"/> Analyze Model</a>
        <UiButton v-else variant="primary" class="small" disabled><ChartLine :size="14"/> Analyze Model</UiButton>
      </section>

      <section id="ws-deploy-lists" class="lists">
        <div class="lists-head">
          <div class="list-tabs" role="tablist" aria-label="Projects">
            <button type="button" role="tab" :aria-selected="listTab==='deployed'" :class="{active:listTab==='deployed'}" @click="listTab='deployed'"><Rocket :size="15"/> Deployments</button>
            <button type="button" role="tab" :aria-selected="listTab==='idle'" :class="{active:listTab==='idle'}" @click="listTab='idle'"><Layers :size="15"/> Not Yet Deployed</button>
          </div>
          <div class="list-actions">
            <a class="button icon-button-box" :href="API_REFERENCE" aria-label="API reference" title="API reference"><BookOpen :size="16"/></a>
            <UiButton @click="keysOpen=true"><KeyRound :size="15"/> API Keys</UiButton>
            <UiButton @click="emit('create')"><Plus :size="15"/> Create Project</UiButton>
          </div>
        </div>

        <p v-if="!data && !error" class="muted">Loading deployments…</p>
        <template v-else-if="listTab==='deployed'">
          <div v-if="!deployed.length" class="list-empty">
            <span class="empty-icon"><Rocket :size="22"/></span>
            <h3>Nothing is deployed yet</h3>
            <p>Train a model in a project, approve it, then deploy it to staging or production from that project's Deployments page.</p>
            <div class="empty-actions"><UiButton @click="listTab='idle'">See projects not yet deployed</UiButton><UiButton variant="primary" @click="emit('navigate','models')"><Network :size="15"/> Try a Model</UiButton></div>
          </div>
          <div v-else class="table-wrap">
            <table class="ws-table">
              <thead><tr><th>Project</th><th>Staging</th><th>Production</th><th>Calls, last 7 days</th><th><span class="sr-only">Open</span></th></tr></thead>
              <tbody>
                <tr v-for="row in deployed" :key="row.project.ref">
                  <td data-label="Project"><strong>{{ row.project.name }}</strong></td>
                  <td v-for="env in row.environments" :key="env.key" :data-label="env.label">
                    <UiBadge :tone="environmentState(env)[0]">{{ environmentState(env)[1] }}</UiBadge>
                    <small v-if="env.live">{{ modelName(env.live.model) }}, revision {{ env.live.number }}<template v-if="env.live.live_at">, live since {{ day(env.live.live_at) }}</template></small>
                    <small v-if="env.live&&env.live.healthy===false">It did not answer at its last check, {{ timeAgo(env.live.checked_at) }}. Its Deployments page checks it again.</small>
                    <small v-if="env.starting">{{ modelName(env.starting.model) }} is starting as revision {{ env.starting.number }}.</small>
                  </td>
                  <td data-label="Calls, last 7 days"><template v-if="row.usage">{{ row.usage.calls }} <small>{{ row.usage.answered }} answered, last {{ timeAgo(row.usage.last) }}</small></template><span v-else class="muted">None</span></td>
                  <td class="row-actions"><a class="button" :href="projectLink(row.project.ref,'deploy')">{{ row.may.deploy ? 'Manage' : 'Open' }}</a></td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
        <template v-else>
          <div v-if="!idle.length" class="list-empty">
            <span class="empty-icon"><Check :size="22"/></span>
            <h3>Everything here is deployed.</h3>
            <p>You can view the Deployments tab, or create another project if you are ready to deploy more.</p>
            <div class="empty-actions"><UiButton @click="listTab='deployed'"><Rocket :size="15"/> View Deployments</UiButton><UiButton variant="primary" @click="emit('navigate','models')"><Network :size="15"/> Try a Model</UiButton></div>
          </div>
          <ul v-else class="idle-list">
            <li v-for="row in idle" :key="row.project.ref">
              <span><strong>{{ row.project.name }}</strong>
                <small v-if="row.models_ready">{{ row.models_ready }} model{{ row.models_ready===1?'':'s' }} trained, not deployed yet</small>
                <small v-else>No model trained yet</small></span>
              <a v-if="row.models_ready" class="button" :href="projectLink(row.project.ref,'deploy')"><Rocket :size="14"/> {{ row.may.deploy ? 'Deploy' : 'Open' }}</a>
              <a v-else class="button" :href="projectLink(row.project.ref,'train')">Train a model</a>
            </li>
          </ul>
        </template>
      </section>
    </div>

    <UiDialog :open="keysOpen" title="API keys" @close="keysOpen=false">
      <p class="dialog-description">An app calls a project's model with a key of its own, made on the project's Connect app page. Keys are never shown again after they are made.</p>
      <p v-if="!rows.length" class="muted">No project yet.</p>
      <ul class="key-list"><li v-for="row in rows" :key="row.project.ref"><span>{{ row.project.name }}</span><a class="text-link" :href="projectLink(row.project.ref,'connect')" @click="keysOpen=false">Its keys</a></li></ul>
      <div class="dialog-actions"><UiButton @click="keysOpen=false">Close</UiButton></div>
    </UiDialog>
  </div>
</template>

<style scoped>
.muted{font-size:12px!important;color:#5f6d82!important}
.deploy-tabs{display:flex;gap:4px;border-bottom:1px solid #e3e6ed;margin:-4px 0 22px;overflow-x:auto;scrollbar-width:thin}
.deploy-tabs button{display:inline-flex;align-items:center;gap:7px;white-space:nowrap;background:none;border:0;border-bottom:2px solid transparent;padding:12px 12px;color:#5f6d82;font:inherit;font-size:13px;cursor:pointer;transition:color .15s,border-color .15s}
.deploy-tabs button:hover{color:#162139}
.deploy-tabs button.active{color:var(--aadml-primary);border-color:var(--aadml-primary);font-weight:600}
.deploy-tabs .badge{margin-left:2px}
.soon{display:flex;gap:18px;align-items:flex-start;padding:28px}
.soon h2{display:flex;align-items:center;gap:10px;margin:2px 0 8px}
.soon p{max-width:620px;margin:0 0 16px}
.soon-icon,.way-icon,.empty-icon{display:grid;place-items:center;flex-shrink:0;border-radius:10px;background:var(--aadml-soft);color:var(--aadml-primary)}
.soon-icon{width:52px;height:52px}
/* the overview */
.runs{background:var(--aadml-tint);border:1px solid var(--aadml-soft);border-radius:12px;padding:18px 20px 14px;transition:opacity .2s}
.runs.refreshing{opacity:.6}
.runs-top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.ranges{display:flex;gap:4px}
.ranges button{border:0;background:none;border-radius:7px;padding:6px 11px;font:inherit;font-size:12px;font-weight:600;color:#4c5d74;cursor:pointer}
.ranges button:hover{background:#eef2f8}
.ranges button.active{background:var(--aadml-soft);color:var(--aadml-primary)}
.runs-note{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#5f6d82}
.icon-only{display:grid;place-items:center;width:28px;height:28px;border:0;border-radius:7px;background:none;color:#5f6d82;cursor:pointer}
.icon-only:hover{background:#eef2f8;color:var(--aadml-primary)}
.runs-hero{display:flex;justify-content:center;align-items:stretch;gap:8px;margin-top:6px}
.digits,.bolt{display:grid;place-items:center;border:1px solid #d9e0ea;border-radius:8px;background:#fff;box-shadow:0 2px 0 #e6ebf2}
.digits{min-width:76px;padding:2px 12px;font-size:34px;font-weight:700;color:#162139;font-variant-numeric:tabular-nums;letter-spacing:.01em}
.bolt{width:46px;color:#162139}
.runs-label{text-align:center;margin:8px 0 6px!important;font-size:14px;color:#4c5d74!important}
.chart,.chart-wait{position:relative;height:190px;margin:6px 0 22px}
.chart{cursor:crosshair;outline:none}
.chart:focus-visible{outline:2px solid var(--aadml-focus);outline-offset:4px;border-radius:6px}
.chart svg{width:100%;height:100%;display:block;overflow:visible}
.chart .area{fill:var(--aadml-primary);opacity:.12}
.chart .line{fill:none;stroke:var(--aadml-primary);stroke-width:2}
.chart .base{stroke:#c9d3e2;stroke-width:1}
.crosshair{position:absolute;top:0;bottom:0;width:1px;background:#9fb1cc;pointer-events:none}
.dot{position:absolute;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:var(--aadml-primary);box-shadow:0 0 0 2px #fff;pointer-events:none}
.tip{position:absolute;top:4px;transform:translateX(10px);display:flex;flex-direction:column;gap:2px;min-width:140px;padding:8px 10px;border:1px solid #e0e6ef;border-radius:8px;background:#fff;box-shadow:0 6px 18px #0f172a1f;font-size:12px;color:#162139;pointer-events:none;z-index:2}
.tip.flip{transform:translateX(calc(-100% - 10px))}
.tip small{color:#5f6d82;font-size:11px}
.ticks{position:absolute;left:0;right:0;bottom:-20px;height:16px;font-size:11px;color:#5f6d82}
.ticks span{position:absolute;transform:translateX(-50%);white-space:nowrap}
.ticks span:first-child{transform:none}
.ticks span:last-child{transform:translateX(-100%)}
.chart-wait{border-radius:8px;background:linear-gradient(90deg,var(--aadml-tint),var(--aadml-soft),var(--aadml-tint))}
.as-table{font-size:12px;color:#4c5d74;margin-top:4px}
.as-table summary{cursor:pointer;color:var(--aadml-primary);width:max-content}
.as-table .table-wrap{max-height:260px;margin-top:8px}
.ask{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin:22px 0 18px;padding:14px 18px;border:1px solid #e3e8f1;border-radius:12px;background:linear-gradient(100deg,#f7f9fc,#fff 60%,var(--aadml-tint))}
.ask p{margin:0!important;color:#162139!important;font-size:14px;font-weight:500}
.ways{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.way{display:flex;align-items:center;gap:14px;padding:16px;border:1px solid #dde3ec;border-radius:12px;background:#fff;text-align:left;font:inherit;color:inherit;cursor:pointer;transition:border-color .15s,box-shadow .15s}
.way:hover{border-color:var(--aadml-outline);box-shadow:0 4px 14px #0f172a0d}
.way:focus-visible{outline:2px solid var(--aadml-focus);outline-offset:2px}
.way-icon{width:40px;height:40px}
.way strong{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:14px;color:#162139}
.way small{display:block;margin-top:3px;font-size:13px;line-height:1.45;color:#4c5d74}
.way-go{margin-left:auto;flex-shrink:0;color:#7c8aa0}
.improve{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:18px 0 24px;padding:12px 16px;border:1px solid #e3e8f1;border-radius:12px;background:#f8f9fb}
.improve label{display:inline-flex;align-items:center;gap:7px;font-size:14px;color:#162139}
.improve label svg{color:var(--aadml-primary)}
.improve select{max-width:340px;min-width:200px}
.button.small,.small{min-height:32px;padding:6px 12px;font-size:13px}
.lists-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;border-bottom:1px solid #e3e6ed;margin-bottom:14px}
.list-tabs{display:flex;gap:4px}
.list-tabs button{display:inline-flex;align-items:center;gap:7px;background:none;border:0;border-bottom:2px solid transparent;padding:12px 12px;font:inherit;font-size:14px;color:#5f6d82;cursor:pointer}
.list-tabs button.active{color:var(--aadml-primary);border-color:var(--aadml-primary);font-weight:600}
.list-actions{display:flex;gap:8px;padding-bottom:8px;flex-wrap:wrap}
.icon-button-box{display:grid;place-items:center;width:40px;padding:0}
.list-empty{text-align:center;padding:30px 20px;border:1px solid #e3e8f1;border-radius:12px;background:#fff}
.empty-icon{width:46px;height:46px;margin:0 auto;border-radius:50%;background:#f1f4f8;color:#4c5d74}
.list-empty h3{margin:12px 0 6px;font-size:16px}
.list-empty p{margin:0 auto 16px;max-width:520px}
.empty-actions{display:flex;justify-content:center;gap:10px;flex-wrap:wrap}
.ws-table td{vertical-align:top;font-size:13px}
.ws-table td small{display:block;color:#5f6d82;font-size:11px;margin-top:5px;max-width:300px;line-height:1.5}
.row-actions{white-space:nowrap;text-align:right}
.row-actions .button{min-height:32px;padding:6px 12px}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.badge--amber{color:#93610b;background:#fff4dc}
.idle-list{list-style:none;padding:0;margin:0;border:1px solid #e3e8f1;border-radius:12px;background:#fff}
.idle-list li{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid #eef0f4;flex-wrap:wrap}
.idle-list li:last-child{border-bottom:0}
.idle-list small{display:block;font-size:12px;color:#5f6d82;margin-top:2px}
.idle-list .button{min-height:32px;padding:6px 12px}
.key-list{list-style:none;padding:0;margin:8px 0 0}
.key-list li{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #eef0f4}
.key-list .text-link{margin:0}
@media(max-width:900px){.ways{grid-template-columns:1fr}}
@media(max-width:650px){
  .runs{padding:14px}
  .digits{font-size:28px}
  .chart,.chart-wait{height:150px}
  .improve select{min-width:0;flex:1}
  .ws-table thead{display:none}
  .ws-table,.ws-table tbody,.ws-table tr,.ws-table td{display:block;width:100%}
  .ws-table tr{border-bottom:1px solid #e9eaf0;padding:10px 0}
  .ws-table td{border:0!important;padding:6px 14px!important}
  .ws-table td[data-label]::before{content:attr(data-label);display:block;font-size:11px;color:#5f6d82;margin-bottom:4px}
  .row-actions{text-align:left}
}
@media(prefers-reduced-motion:reduce){.runs,.way,.deploy-tabs button{transition:none}}
</style>
