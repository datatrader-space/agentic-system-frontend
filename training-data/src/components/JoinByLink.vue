<script setup>
// A person opened an invite link (`?join=…`): what it gives, and Join (backend: join/, invite_links.py).
import { onMounted, ref } from 'vue';
import UiButton from './UiButton.vue';
import UiDialog from './UiDialog.vue';
import { joinLink } from '../api/members.js';

const props = defineProps({ token: String });
const emit = defineEmits(['close', 'joined']);
const info = ref(null); const error = ref(''); const busy = ref(false);
// UiDialog opens on a change of , so it is opened once the dialog is on the page.
const shown = ref(false);
onMounted(async () => { shown.value = true; try { info.value = await joinLink.look(props.token); } catch (e) { error.value = e.message; } });
async function join() {
  busy.value = true; error.value = '';
  try { emit('joined', await joinLink.join(props.token)); } catch (e) { error.value = e.message; } finally { busy.value = false; }
}
</script>

<template>
  <UiDialog :open="shown" title="Join a workspace" @close="emit('close')">
    <p v-if="!info&&!error" class="dialog-description">Reading the invite link…</p>
    <template v-if="info">
      <p class="dialog-description"><strong>{{ info.by || 'A member' }}</strong> invites you to the workspace <strong>{{ info.workspace }}</strong> of {{ info.organization }}, as <strong>{{ info.role_label }}</strong> in: {{ info.projects.join(', ') }}.</p>
      <p v-if="info.joined" class="dialog-description">You joined with this link already.</p>
      <p v-else-if="info.refused" class="field-error" role="alert">{{ info.refused }}</p>
      <p v-else class="dialog-description">A role you have already in one of these projects stays as it is.</p>
    </template>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <div class="dialog-actions">
      <UiButton @click="emit('close')">{{ info?.joined ? 'Close' : 'Not now' }}</UiButton>
      <UiButton v-if="info&&!info.refused" variant="primary" :disabled="busy" @click="join">{{ info.joined ? 'Open the projects' : 'Join' }}</UiButton>
    </div>
  </UiDialog>
</template>
