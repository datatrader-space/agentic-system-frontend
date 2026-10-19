<script setup>
import { ref } from 'vue';
import UiButton from './UiButton.vue';
import UiDialog from './UiDialog.vue';
import { checkSession } from '../api/session.js';
const opened = ref(false), busy = ref(false), status = ref(''), identity = ref('');
async function connect() {
  if (busy.value) return;
  busy.value = true; status.value = ''; identity.value = '';
  try { identity.value = (await checkSession()).displayName; }
  catch (error) { status.value = error.message; }
  finally { busy.value = false; }
}
</script>
<template>
  <UiButton @click="opened=true">Backend connection</UiButton>
  <UiDialog :open="opened" title="Backend connection" @close="opened=false">
    <p class="dialog-description">Phase 4 integration is in progress. All project screens still use local sample data.</p>
    <p class="connection-note">Check your existing AADML session through the local backend. This does not connect projects or grant project access.</p>
    <p v-if="identity" role="status" class="connection-success">Session verified: {{identity}}. Project data remains unconnected.</p>
    <p v-if="status" role="alert" class="connection-error">{{status}}</p>
    <ul class="connection-gaps"><li>Projects and uploads: structured responses needed.</li><li>Annotation board: structured batch and photo lists needed.</li><li>Label editor: safe photo and permission loading needed before saving.</li></ul>
    <p class="connection-note">No uploads, invitations, training, or label writes are performed by this check.</p>
    <div class="dialog-actions"><UiButton @click="opened=false">Close</UiButton><UiButton variant="primary" :disabled="busy" @click="connect">{{busy?'Checking session…':'Check session'}}</UiButton></div>
  </UiDialog>
</template>
<style scoped>
.connection-note,.connection-gaps{font-size:13px;line-height:1.7;color:#475569;margin-top:16px}.connection-gaps{padding-left:20px}.connection-success,.connection-error{padding:12px;border-radius:8px;margin-top:16px;font-size:13px}.connection-success{background:#f0fdfa;color:#0f766e}.connection-error{background:#fff1f2;color:#9f1239}
</style>
