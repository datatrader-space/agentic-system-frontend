<script setup>
// One machine's "Agent log" fold on the Your machines page (agent 1.9.3, ADM-1365): the newest lines of the machine
// agent's own log, oldest first, read again every AGENT_LOG_REFRESH_MS while the fold is open. For an Admin only: the
// backend refuses anyone else (machines_api.machine_log). Every line was redacted by the machine and by AADML.
import { computed, nextTick, onUnmounted, ref } from 'vue';
import { ChevronDown, RefreshCw } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import { machinesApi, agentLogEmpty, agentLogUpdated, AGENT_LOG_REFRESH_MS } from '../api/machines.js';

const props = defineProps({ machine: { type: Object, required: true }, now: { type: Number, default: () => Date.now() } });
const open = ref(false); const loading = ref(false); const error = ref(''); const answer = ref(null);
const box = ref(null);
const regionId = computed(() => `agent-log-${props.machine.id}`);
const lines = computed(() => answer.value?.lines || []);
const empty = computed(() => (answer.value ? agentLogEmpty(answer.value, props.machine) : ''));
const updated = computed(() => agentLogUpdated(answer.value?.updated_at, props.now));

let timer = null; let gone = false;
async function load() {
  if (loading.value || gone) return;
  loading.value = true;
  const box_ = box.value;
  const atBottom = !box_ || box_.scrollHeight - box_.scrollTop - box_.clientHeight < 24;
  try {
    answer.value = await machinesApi.log(props.machine.id);
    error.value = '';
    if (atBottom) { await nextTick(); if (box.value) box.value.scrollTop = box.value.scrollHeight; }
  } catch (e) { error.value = e.message; }
  finally {
    loading.value = false;
    clearTimeout(timer);
    if (open.value && !gone) timer = setTimeout(load, AGENT_LOG_REFRESH_MS);
  }
}
function toggle() {
  open.value = !open.value;
  clearTimeout(timer);
  if (open.value) load();
}
onUnmounted(() => { gone = true; clearTimeout(timer); });
</script>

<template>
  <div class="agent-log">
    <button type="button" class="agent-log-toggle" :aria-expanded="open" :aria-controls="regionId" @click="toggle">
      <ChevronDown :size="15" aria-hidden="true" :class="{ 'is-open': open }"/> Agent log
    </button>
    <div v-if="open" :id="regionId" class="agent-log-body" role="region" :aria-label="`Agent log of ${machine.name}`" :aria-busy="loading">
      <div class="agent-log-bar">
        <span class="agent-log-when">{{ updated || (loading && !answer ? 'Loading…' : '') }}</span>
        <UiButton :aria-label="`Refresh the agent log of ${machine.name}`" :disabled="loading" @click="load">
          <RefreshCw :size="14" aria-hidden="true" :class="{ spin: loading }"/> Refresh
        </UiButton>
      </div>
      <p v-if="error" class="field-error" role="alert">{{ error }}</p>
      <p v-else-if="empty" class="agent-log-empty">{{ empty }}</p>
      <pre v-if="lines.length" ref="box" class="agent-log-lines" tabindex="0" :aria-label="`${lines.length} lines, newest at the bottom`">{{ lines.join('\n') }}</pre>
    </div>
  </div>
</template>

<style scoped>
.agent-log{margin-top:10px}
.agent-log-toggle{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 4px;border:0;background:none;color:#52627b;font:inherit;font-size:13px;font-weight:550;cursor:pointer}
.agent-log-toggle:hover{color:var(--aadml-primary)}
.agent-log-toggle:focus-visible{outline:3px solid var(--aadml-outline);outline-offset:2px;border-radius:4px}
.agent-log-toggle svg{transition:transform .15s}
.agent-log-toggle svg.is-open{transform:rotate(180deg)}
.agent-log-body{border:1px solid #e3e8ef;border-radius:10px;background:#fff;padding:10px 12px;margin-top:4px}
.agent-log-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}
.agent-log-when{font-size:12px;color:#7b889e}
.agent-log-empty{font-size:12.5px;color:#475569;margin:4px 0}
.agent-log-lines{margin:0;max-height:320px;overflow:auto;background:#0f172a;color:#e2e8f0;border-radius:8px;padding:10px 12px;font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere}
.agent-log-lines:focus-visible{outline:3px solid var(--aadml-outline);outline-offset:2px}
.spin{animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.spin{animation:none}.agent-log-toggle svg{transition:none}}
</style>
