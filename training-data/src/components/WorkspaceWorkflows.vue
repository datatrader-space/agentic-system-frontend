<script setup>
// The Workflows page: the person's own workflows of AADML's Workflow Builder (AADML lists only the workflows of the
// person signed in), each opened in the builder, where workflows are made, edited and run.
import { ref } from 'vue';
import { GitBranch, Plus, RefreshCw } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import { workspaceApi, workflowLink, WORKFLOW_BUILDER, WORKFLOW_RUNS, timeAgo } from '../api/workspace.js';

const rows = ref(null); const error = ref(''); const busy = ref(false);
async function load() {
  busy.value = true;
  try { const body = await workspaceApi.workflows(); rows.value = Array.isArray(body) ? body : body.results || []; error.value = ''; }
  catch (e) { error.value = e.message; rows.value = rows.value || []; }
  finally { busy.value = false; }
}
load();
const STATUS = { published: ['green', 'Published'], draft: ['neutral', 'Draft'] };
const statusOf = row => STATUS[row.status] || ['neutral', row.status ? row.status.charAt(0).toUpperCase() + row.status.slice(1) : 'Draft'];
const RUN = { completed: 'green', succeeded: 'green', success: 'green', failed: 'amber', error: 'amber', running: 'purple', pending: 'purple', queued: 'purple' };
</script>

<template>
  <div class="studio ws-workflows">
    <div class="studio-actions">
      <p class="lead">Workflows run steps one after another: an agent, a tool, a condition. They are made and run in AADML's Workflow Builder.</p>
      <UiButton :disabled="busy" @click="load"><RefreshCw :size="14"/> Refresh</UiButton>
      <a class="button" :href="WORKFLOW_RUNS">See every run</a>
      <a class="button button--primary" :href="WORKFLOW_BUILDER"><Plus :size="15"/> New workflow</a>
    </div>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <p v-if="!rows" class="muted">Loading workflows…</p>
    <section v-else-if="!rows.length" class="model-empty">
      <GitBranch :size="40"/>
      <h2>No workflow yet</h2>
      <p>A workflow is made in AADML's Workflow Builder. The ones you make are listed here.</p>
      <a class="button button--primary" :href="WORKFLOW_BUILDER"><Plus :size="15"/> New workflow</a>
    </section>
    <div v-else class="table-wrap">
      <table class="ws-table">
        <thead><tr><th>Workflow</th><th>State</th><th>Steps</th><th>Runs</th><th>Last run</th><th>Changed</th><th><span class="sr-only">Open</span></th></tr></thead>
        <tbody>
          <tr v-for="w in rows" :key="w.id">
            <td data-label="Workflow"><strong>{{ w.name }}</strong><small v-if="w.description">{{ w.description }}</small></td>
            <td data-label="State"><UiBadge :tone="statusOf(w)[0]">{{ statusOf(w)[1] }}</UiBadge></td>
            <td data-label="Steps">{{ w.node_count }}</td>
            <td data-label="Runs">{{ w.run_count }}</td>
            <td data-label="Last run"><template v-if="w.last_run"><UiBadge :tone="RUN[w.last_run.status] || 'neutral'">{{ w.last_run.status }}</UiBadge><small>{{ timeAgo(w.last_run.created_at) }}</small></template><span v-else class="muted">Never run</span></td>
            <td data-label="Changed">{{ timeAgo(w.updated_at) }}</td>
            <td class="row-actions"><a class="button" :href="workflowLink(w.id)">Open in the builder</a></td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="muted note"><UiBadge tone="purple">Coming soon</UiBadge> A workflow that starts by itself when a Training model answers or goes live.</p>
  </div>
</template>

<style scoped>
.lead{margin:0!important;font-size:13px;flex:1;min-width:240px;color:#4c5d74!important}
.muted{font-size:12px!important;color:#5f6d82!important}
.note{margin-top:18px!important}
.model-empty h2{margin:6px 0 0}
.model-empty .button{margin-top:6px}
.ws-table td{vertical-align:top;font-size:13px}
.ws-table td small{display:block;color:#5f6d82;font-size:11px;margin-top:4px;max-width:380px}
.row-actions{white-space:nowrap;text-align:right}
.row-actions .button{min-height:32px;padding:6px 12px}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.badge--amber{color:#93610b;background:#fff4dc}
@media(max-width:650px){
  .ws-table thead{display:none}
  .ws-table,.ws-table tbody,.ws-table tr,.ws-table td{display:block;width:100%}
  .ws-table tr{border-bottom:1px solid #e9eaf0;padding:10px 0}
  .ws-table td{border:0!important;padding:6px 14px!important}
  .ws-table td[data-label]::before{content:attr(data-label);display:block;font-size:11px;color:#5f6d82;margin-bottom:2px}
  .row-actions{text-align:left}
}
</style>
