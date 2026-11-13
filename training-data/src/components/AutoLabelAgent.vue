<script setup>
import { onMounted, ref, nextTick } from 'vue';
import { CornerDownRight, Sparkles } from 'lucide-vue-next';
import AssistantChat from './AssistantChat.vue';
import UiButton from './UiButton.vue';
import { workspaceApi } from '../api/workspace.js';
defineProps({ context: String });
const emit = defineEmits(['settled']);
const agentId = ref(null); const error = ref(''); const loading = ref(false); const draft = ref(''); const chat = ref(null);
const suggestions = ['Help me detect the objects I care about', 'A class is missing from the preview', 'Reduce false positives', 'Save a reusable labeling workflow'];
async function load() {
  loading.value = true; error.value = '';
  try { const body = await workspaceApi.assistant(); agentId.value = body.agent_id; if (!agentId.value) throw new Error('The assistant is not available.'); }
  catch (e) { error.value = e.message; } finally { loading.value = false; }
}
onMounted(load);
function suggest(text) { draft.value = text; nextTick(() => chat.value?.focus()); }
</script>
<template>
  <section class="auto-agent" aria-label="Auto Label assistant">
    <div class="auto-agent-caption">Auto Label assistant <span>Training Assistant</span></div>
    <details class="auto-agent-context"><summary>Context shared when you send</summary><p>Project, batch and selected image IDs, model and class settings. Batch images are not attached automatically.</p><pre>{{ context }}</pre></details>
    <p v-if="loading" class="auto-agent-status" role="status">Opening the assistant…</p>
    <div v-else-if="error" role="alert" class="field-error">{{ error }} <UiButton @click="load">Try again</UiButton></div>
    <AssistantChat v-else-if="agentId" ref="chat" v-model:draft="draft" :agent-id="agentId" :request-context="context" message-placeholder="Describe how to label your images…" @settled="emit('settled')">
      <template #intro><div class="auto-agent-intro"><Sparkles :size="22"/><h3>How should we label your images?</h3><p>Start with your goal, or tell us what is missing from the preview.</p><button v-for="text in suggestions" :key="text" @click="suggest(text)"><CornerDownRight :size="13"/>{{ text }}</button></div></template>
    </AssistantChat>
  </section>
</template>
<style scoped>
.auto-agent{display:flex;flex-direction:column;min-height:0;height:100%;padding:14px;overflow:hidden}.auto-agent-caption{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:600}.auto-agent-caption span{font-size:10px;font-weight:400;color:#64748b}.auto-agent-context{font-size:10px;color:#64748b;margin-top:12px}.auto-agent-context summary{cursor:pointer}.auto-agent-context p{line-height:1.5}.auto-agent-context pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:140px;overflow:auto;font-size:9px}.auto-agent-intro{padding:20px 0}.auto-agent-intro>svg{color:#2563eb}.auto-agent-intro h3{font-size:14px;line-height:1.5;margin:12px 0 7px}.auto-agent-intro p{font-size:12px;line-height:1.6;color:#64748b;margin:0 0 16px}.auto-agent-intro button{display:flex;align-items:center;gap:8px;text-align:left;width:100%;border:0;background:none;padding:10px 3px;color:#334155;font-size:11px;line-height:1.5;border-radius:5px}.auto-agent-intro button:hover{background:#eff6ff}.auto-agent-status{font-size:12px;color:#64748b}.auto-agent :deep(.chat){flex:1;min-height:0;max-width:100%;gap:10px}.auto-agent :deep(.chat--empty){justify-content:flex-end;padding-bottom:0}.auto-agent :deep(.chat-intro){margin:auto 0}.auto-agent :deep(.chat-log){font-size:12px}.auto-agent :deep(.composer){margin-top:auto;padding:10px}.auto-agent :deep(.composer textarea){font-size:12px}.auto-agent :deep(.approval),.auto-agent :deep(.plan){min-width:0;overflow-wrap:anywhere}.auto-agent :deep(.msg){max-width:100%}
</style>
