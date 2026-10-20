<script setup>
// The workspace's Training audit log: who did what to which project, model, app or person, and whether it was allowed,
// newest first. Read by the workspace's Admins and the owners of its organisation (backend: app_api.py
// workspace/audit/); anyone else is told so.
import { ref, watch } from 'vue';
import { ClipboardList, RefreshCw } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import { workspaceApi, timeAgo } from '../api/workspace.js';

const outcome = ref(''); const events = ref(null); const next = ref(null);
const error = ref(''); const refused = ref(''); const busy = ref(false);
async function load(more = false) {
  busy.value = true;
  try {
    const body = await workspaceApi.audit({ outcome: outcome.value, before: more ? next.value : '' });
    events.value = more ? [...events.value, ...body.events] : body.events;
    next.value = body.more ? body.next : null; error.value = ''; refused.value = '';
  } catch (e) {
    if (e.status === 403) refused.value = e.message; else error.value = e.message;
    events.value = events.value || [];
  } finally { busy.value = false; }
}
watch(outcome, () => { events.value = null; next.value = null; load(); }, { immediate: true });
const at = iso => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
</script>

<template>
  <div class="studio ws-audit">
    <section v-if="refused" class="model-empty"><ClipboardList :size="40"/><h2>The audit log is not yours to read</h2><p>{{ refused }}</p></section>
    <template v-else>
      <div class="studio-actions">
        <p class="lead">Every Training action recorded in this workspace: who did it, to what, and whether it was allowed. Rows are never changed or removed.</p>
        <select v-model="outcome" class="compact-select" aria-label="Show"><option value="">Everything</option><option value="allowed">Allowed</option><option value="denied">Refused</option></select>
        <UiButton :disabled="busy" @click="load()"><RefreshCw :size="14"/> Refresh</UiButton>
      </div>
      <p v-if="error" class="field-error" role="alert">{{ error }}</p>
      <p v-if="events===null" class="muted">Loading the audit log…</p>
      <section v-else-if="!events.length" class="model-empty"><ClipboardList :size="40"/><h2>Nothing recorded{{ outcome ? ' with this result' : '' }} yet</h2><p>Changes to projects, people, models, deployments and apps are recorded here as they happen.</p></section>
      <template v-else>
        <div class="table-wrap">
          <table class="ws-table">
            <thead><tr><th>When</th><th>Who</th><th>What</th><th>On</th><th>Result</th></tr></thead>
            <tbody>
              <tr v-for="e in events" :key="e.id">
                <td data-label="When">{{ at(e.at) }}<small>{{ timeAgo(e.at) }}</small></td>
                <td data-label="Who">{{ e.by }}</td>
                <td data-label="What">{{ e.label }}</td>
                <td data-label="On"><code v-if="e.item">{{ e.item }}</code><span v-else class="muted">—</span></td>
                <td data-label="Result"><UiBadge :tone="e.outcome==='denied' ? 'amber' : 'green'">{{ e.outcome==='denied' ? 'Refused' : 'Allowed' }}</UiBadge><small v-if="e.reason">{{ e.reason }}</small></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="more"><UiButton v-if="next" :disabled="busy" @click="load(true)">{{ busy ? 'Loading…' : 'Show older entries' }}</UiButton><span v-else class="muted">{{ events.length }} entr{{ events.length===1?'y':'ies' }}, all shown.</span></div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.lead{margin:0!important;font-size:13px;flex:1;min-width:240px;color:#4c5d74!important}
.compact-select{padding:9px 12px!important;font-size:12px}
.muted{font-size:12px!important;color:#5f6d82!important}
.model-empty h2{margin:6px 0 0}
.ws-table td{vertical-align:top;font-size:13px}
.ws-table td small{display:block;color:#5f6d82;font-size:11px;margin-top:4px;max-width:340px}
.ws-table code{font-size:11px;background:#f4f5f8;border-radius:4px;padding:2px 6px;color:#33445c;overflow-wrap:anywhere}
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
