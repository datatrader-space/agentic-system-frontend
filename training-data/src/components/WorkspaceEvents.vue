<script setup>
// Vision events: what the apps of the workspace's vision projects sent (each event that arrived: its file's type and size,
// whether it was labelled, never what it carried) and what they asked the deployed models (each prediction and how it
// ended), newest first. A Labeller's projects show only the records assigned to them, and no predictions. Backend:
// app_api.py workspace/events/.
import { ref, watch } from 'vue';
import { ChartNoAxesCombined, RefreshCw } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import { workspaceApi, projectLink, timeAgo, bytesText } from '../api/workspace.js';

const kind = ref('received'); const project = ref('');
const events = ref(null); const projects = ref([]); const next = ref(null);
const error = ref(''); const busy = ref(false);

async function load(more = false) {
  busy.value = true;
  try {
    const body = await workspaceApi.events({ kind: kind.value, project: project.value, before: more ? next.value : '' });
    events.value = more ? [...events.value, ...body.events] : body.events;
    next.value = body.more ? body.next : null; projects.value = body.projects; error.value = '';
  } catch (e) { error.value = e.message; events.value = events.value || []; }
  finally { busy.value = false; }
}
watch([kind, project], () => { events.value = null; next.value = null; load(); }, { immediate: true });
const at = iso => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
</script>

<template>
  <div class="studio ws-events">
    <div class="studio-actions">
      <div class="studio-tabs" role="tablist" aria-label="Kind of event">
        <button role="tab" :aria-selected="kind==='received'" :class="{active:kind==='received'}" @click="kind='received'">Received from apps</button>
        <button role="tab" :aria-selected="kind==='predictions'" :class="{active:kind==='predictions'}" @click="kind='predictions'">Predictions</button>
      </div>
      <select v-model="project" class="compact-select" aria-label="Project"><option value="">All projects</option><option v-for="p in projects.filter(p => kind==='received' || p.predictions)" :key="p.ref" :value="p.ref">{{ p.name }}</option></select>
      <UiButton :disabled="busy" @click="load()"><RefreshCw :size="14"/> Refresh</UiButton>
    </div>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <p v-if="events===null" class="muted">Loading events…</p>
    <section v-else-if="!events.length" class="model-empty">
      <ChartNoAxesCombined :size="40"/>
      <template v-if="kind==='received'"><h2>No event has arrived yet</h2><p>An app sends a project its photos and events with a key from that project's Connect app page. Each one is listed here as it arrives.</p></template>
      <template v-else><h2>No prediction was asked for yet</h2><p>An app asks a project's deployed model for predictions with a key from its Deployments page. Each call is listed here with how it ended.</p></template>
    </section>
    <template v-else>
      <div class="table-wrap">
        <table v-if="kind==='received'" class="ws-table">
          <thead><tr><th>Arrived</th><th>Project</th><th>Sent by</th><th>File</th><th>Labelled</th></tr></thead>
          <tbody>
            <tr v-for="e in events" :key="e.id">
              <td data-label="Arrived">{{ at(e.at) }} <small>{{ timeAgo(e.at) }}</small></td>
              <td data-label="Project"><a class="text-link" :href="projectLink(e.project.ref,'dataset')">{{ e.project.name }}</a></td>
              <td data-label="Sent by">{{ e.source }}<small v-if="e.key">Key: {{ e.key }}</small></td>
              <td data-label="File"><template v-if="e.file?.image">{{ e.file.type.replace('image/','').toUpperCase() }} photo, {{ e.file.width }} × {{ e.file.height }}<small>{{ bytesText(e.file.bytes) }}{{ e.marked ? ', and a copy with its own marks' : '' }}</small></template><template v-else-if="e.file">A file<small>{{ e.file.type }}, {{ bytesText(e.file.bytes) }}</small></template><span v-else class="muted">Data only</span></td>
              <td data-label="Labelled"><UiBadge v-if="e.annotated" tone="green">Labelled</UiBadge><UiBadge v-else>Not yet</UiBadge><small v-if="e.verdict">Reviewed: {{ e.verdict }}</small></td>
            </tr>
          </tbody>
        </table>
        <table v-else class="ws-table">
          <thead><tr><th>Asked</th><th>Project</th><th>App</th><th>Model</th><th>Result</th><th>Took</th></tr></thead>
          <tbody>
            <tr v-for="e in events" :key="e.id">
              <td data-label="Asked">{{ at(e.at) }} <small>{{ timeAgo(e.at) }}</small></td>
              <td data-label="Project"><a class="text-link" :href="projectLink(e.project.ref,'deploy')">{{ e.project.name }}</a><small>{{ e.environment === 'production' ? 'Production' : 'Staging' }}</small></td>
              <td data-label="App">{{ e.app }}</td>
              <td data-label="Model">{{ e.model || '—' }}</td>
              <td data-label="Result"><UiBadge :tone="e.answered ? 'green' : 'amber'">{{ e.answered ? 'Answered' : 'Not answered' }}</UiBadge><small>{{ e.outcome.replaceAll('_',' ') }}, HTTP {{ e.status }}</small></td>
              <td data-label="Took">{{ e.ms < 1000 ? `${e.ms} ms` : `${(e.ms/1000).toFixed(1)} s` }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="more"><UiButton v-if="next" :disabled="busy" @click="load(true)">{{ busy ? 'Loading…' : 'Show older events' }}</UiButton><span v-else class="muted">{{ events.length }} event{{ events.length===1?'':'s' }}, all shown.</span></div>
    </template>
  </div>
</template>

<style scoped>
.studio-actions>.studio-tabs{margin:0;flex:1;min-width:240px}
.compact-select{padding:9px 12px!important;font-size:12px}
.muted{font-size:12px!important;color:#5f6d82!important}
.model-empty h2{margin:6px 0 0}
.ws-table td{vertical-align:top;font-size:13px}
.ws-table td small{display:block;color:#5f6d82;font-size:11px;margin-top:4px}
.ws-table .text-link{margin:0;font-size:13px}
.badge--amber{color:#93610b;background:#fff4dc}
.more{display:flex;justify-content:center;margin:18px 0}
@media(max-width:650px){
  .ws-table thead{display:none}
  .ws-table,.ws-table tbody,.ws-table tr,.ws-table td{display:block;width:100%}
  .ws-table tr{border-bottom:1px solid #e9eaf0;padding:10px 0}
  .ws-table td{border:0!important;padding:6px 14px!important}
  .ws-table td[data-label]::before{content:attr(data-label);display:block;font-size:11px;color:#5f6d82;margin-bottom:2px}
}
</style>
