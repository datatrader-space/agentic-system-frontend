<script setup>
// The workspace's Deployments page: for every project this person sees in full, what answers in staging and in
// production, whether it answered at its last check, and how often it was called in the last 7 days. Deploying,
// stopping and going back are done on the project's own Deployments page (backend: app_api.py workspace/deployments/).
import { computed, ref } from 'vue';
import { Server, RefreshCw } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import { workspaceApi, projectLink, environmentState, modelName, timeAgo } from '../api/workspace.js';

const rows = ref(null); const error = ref(''); const busy = ref(false);
async function load() {
  busy.value = true;
  try { rows.value = (await workspaceApi.deployments()).projects; error.value = ''; }
  catch (e) { error.value = e.message; rows.value = rows.value || []; }
  finally { busy.value = false; }
}
load();
const deployed = computed(() => (rows.value || []).filter(row => row.deployed));
const idle = computed(() => (rows.value || []).filter(row => !row.deployed));
const day = iso => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '');
</script>

<template>
  <div class="studio ws-deployments">
    <div class="studio-actions">
      <p class="lead">Where each project's model answers. A model goes live from its project's Deployments page once it is approved.</p>
      <UiButton :disabled="busy" @click="load"><RefreshCw :size="14"/> Refresh</UiButton>
    </div>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <p v-if="!rows" class="muted">Loading deployments…</p>
    <section v-else-if="!deployed.length" class="model-empty">
      <Server :size="40"/>
      <h2>Nothing is deployed yet</h2>
      <p>Train a model in a project, approve it, then deploy it to staging or production from that project's Deployments page. It is listed here as soon as it answers.</p>
    </section>
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
    <details v-if="rows&&idle.length" class="idle">
      <summary>{{ idle.length }} project{{ idle.length===1?'':'s' }} with nothing deployed</summary>
      <ul><li v-for="row in idle" :key="row.project.ref"><span>{{ row.project.name }}</span><a class="text-link" :href="projectLink(row.project.ref,'deploy')">Open its Deployments page</a></li></ul>
    </details>
  </div>
</template>

<style scoped>
.lead{margin:0!important;font-size:13px;flex:1;min-width:240px;color:#4c5d74!important}
.muted{font-size:12px!important;color:#5f6d82!important}
.model-empty h2{margin:6px 0 0}
.ws-table td{vertical-align:top;font-size:13px}
.ws-table td small{display:block;color:#5f6d82;font-size:11px;margin-top:5px;max-width:300px;line-height:1.5}
.row-actions{white-space:nowrap;text-align:right}
.row-actions .button{min-height:32px;padding:6px 12px}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.badge--amber{color:#93610b;background:#fff4dc}
.idle{margin-top:22px;font-size:13px}
.idle summary{cursor:pointer;color:var(--aadml-primary)}
.idle ul{list-style:none;padding:0;margin:10px 0 0}
.idle li{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #eef0f4;flex-wrap:wrap}
.idle .text-link{margin:0}
@media(max-width:650px){
  .ws-table thead{display:none}
  .ws-table,.ws-table tbody,.ws-table tr,.ws-table td{display:block;width:100%}
  .ws-table tr{border-bottom:1px solid #e9eaf0;padding:10px 0}
  .ws-table td{border:0!important;padding:6px 14px!important}
  .ws-table td[data-label]::before{content:attr(data-label);display:block;font-size:11px;color:#5f6d82;margin-bottom:4px}
  .row-actions{text-align:left}
}
</style>
