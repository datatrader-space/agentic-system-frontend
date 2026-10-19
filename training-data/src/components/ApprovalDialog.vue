<script setup>
// Approving a model (a demo on staging, or a release) or revoking an approval, with the note or reason the backend
// asks for. Used by the Models page and the Deploy page; the call is the Models page's (app_api.py models/<n>/approve|
// revoke/), and every rule — a smoke model is never released, a revoked approval stays as history — is the backend's.
import { ref, watch } from 'vue';
import UiButton from './UiButton.vue';
import UiDialog from './UiDialog.vue';
import { modelsApi, unanswered } from '../api/models.js';

// ``asked``: null, or {type: 'approve', model} / {type: 'revoke', model, approval}.
const props = defineProps({ asked: Object, projectRef: { type: String, required: true } });
const emit = defineEmits(['close', 'done', 'unanswered']);
const kind = ref('demo'); const text = ref(''); const error = ref(''); const busy = ref(false);
watch(() => props.asked, () => { kind.value = 'demo'; text.value = ''; error.value = ''; });

async function send() {
  const { type, model, approval } = props.asked;
  busy.value = true; error.value = '';
  try {
    const body = type === 'approve' ? { kind: kind.value, note: text.value.trim() } : { approval: approval.id, reason: text.value.trim() };
    emit('done', await modelsApi.act(props.projectRef, model.number, type, body));
  } catch (e) {
    if (unanswered(e)) emit('unanswered'); else error.value = e.message;
  } finally { busy.value = false; }
}
</script>

<template>
  <UiDialog :open="!!asked" :title="asked?.type==='revoke' ? 'Revoke the approval' : 'Approve this model'" @close="emit('close')">
    <template v-if="asked?.type==='approve'">
      <p class="dialog-description">An approval is what lets {{ asked.model.name }} {{ asked.model.version }} be deployed: a demo on staging, or a release to production. It covers exactly the file that is approved.</p>
      <label class="field-label">Approve for
        <select v-model="kind" class="text-input"><option value="demo">Demo on staging</option><option value="release" :disabled="!!asked.model.release_refusal">Release{{ asked.model.release_refusal ? ' (not possible)' : '' }}</option></select></label>
      <p v-if="asked.model.release_refusal" class="field-help">{{ asked.model.release_refusal }}</p>
      <label class="field-label">Note<textarea v-model="text" class="text-input" rows="3" placeholder="What was checked before approving"></textarea></label>
    </template>
    <template v-else-if="asked">
      <p class="dialog-description">The {{ asked.approval.kind_label.toLowerCase() }} approval of {{ asked.model.name }} {{ asked.model.version }} is revoked. What is already live stays live until another version replaces it. Say why.</p>
      <label class="field-label">Reason<textarea v-model="text" class="text-input" rows="3"></textarea></label>
    </template>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <div v-if="asked" class="dialog-actions"><UiButton @click="emit('close')">Cancel</UiButton>
      <UiButton variant="primary" :class="{'danger-fill':asked.type==='revoke'}" :disabled="busy||(asked.type==='revoke'&&!text.trim())" @click="send">{{ asked.type==='revoke' ? 'Revoke' : 'Approve' }}</UiButton></div>
  </UiDialog>
</template>

<style scoped>
.danger-fill{background:#d92d20;border-color:#d92d20}
</style>
