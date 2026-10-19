<script setup>
// Workspace settings → Trash: the projects of this workspace in the Trash that this person is an Owner of. Restore one,
// or delete it for good now (by typing its name); the others are deleted for good when their 30 days are over.
// Backend: app_api.py trash/ (trash.py).
import { onMounted, ref } from 'vue';
import { Check, RotateCcw, Trash2 } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiDialog from './UiDialog.vue';
import { listTrash, trashAction } from '../api/training.js';

const emit = defineEmits(['restored']);
const rows = ref([]); const days = ref(30); const loading = ref(true); const error = ref(''); const notice = ref(''); const busy = ref(false);
const deleting = ref(null); const confirmText = ref('');
async function load() {
  loading.value = true; error.value = '';
  try { const body = await listTrash(); rows.value = body.projects; days.value = body.days; } catch (e) { error.value = e.message; } finally { loading.value = false; }
}
onMounted(load);
async function act(row, action, body) {
  busy.value = true; error.value = ''; notice.value = '';
  try { const answer = await trashAction(row.id, action, body); rows.value = answer.projects; notice.value = answer.said; deleting.value = null; if (action === 'restore') emit('restored'); }
  catch (e) { error.value = e.message; } finally { busy.value = false; }
}
const when = iso => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const daysLeft = iso => Math.max(0, Math.ceil((new Date(iso) - Date.now()) / 86400000));
</script>

<template>
  <div class="trash-page">
    <h2>Trash</h2>
    <p class="trash-intro">Projects moved to the Trash are hidden from everyone: their apps can neither send them data nor get predictions from their models. Restore one within {{ days }} days; after that it is deleted for good, with its photos, labels and files.</p>
    <div v-if="notice" class="notice" role="status"><Check :size="16"/><span>{{ notice }}</span></div>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <p v-if="loading">Loading…</p>
    <div v-else-if="!rows.length" class="panel trash-empty"><Trash2 :size="26"/><strong>The Trash is empty</strong><span>Projects you move to the Trash appear here.</span></div>
    <section v-else class="panel trash-table">
      <table>
        <thead><tr><th>Project</th><th>Moved to the Trash</th><th>Deleted for good</th><th class="trash-actions"><span class="sr-only">Actions</span></th></tr></thead>
        <tbody><tr v-for="row in rows" :key="row.id">
          <td><strong>{{ row.name }}</strong><span class="trash-meta">{{ row.kind }}</span></td>
          <td class="trash-meta">{{ when(row.trashed_at) }}{{ row.by ? ` by ${row.by}` : '' }}</td>
          <td class="trash-meta">{{ when(row.deletes_at) }} · in {{ daysLeft(row.deletes_at) }} day{{ daysLeft(row.deletes_at) === 1 ? '' : 's' }}</td>
          <td class="trash-actions"><UiButton :disabled="busy" @click="act(row,'restore')"><RotateCcw :size="14"/> Restore</UiButton><UiButton class="danger" :disabled="busy" @click="deleting=row;confirmText=''">Delete now</UiButton></td>
        </tr></tbody>
      </table>
    </section>
    <UiDialog :open="!!deleting" title="Delete for good" @close="deleting=null">
      <template v-if="deleting">
        <p class="dialog-description">“{{ deleting.name }}” is deleted now with its photos, records, labels and files. This cannot be undone. Type the project name to confirm.</p>
        <input v-model="confirmText" class="text-input" :aria-label="`Type ${deleting.name} to confirm`" :placeholder="deleting.name">
        <div class="dialog-actions"><UiButton @click="deleting=null">Cancel</UiButton><UiButton variant="primary" class="danger-fill" :disabled="busy||confirmText.trim()!==deleting.name" @click="act(deleting,'delete',{confirm:confirmText.trim()})">Delete for good</UiButton></div>
      </template>
    </UiDialog>
  </div>
</template>

<style scoped>
.trash-page{max-width:1000px}
.trash-page>h2{font-size:22px;font-weight:600}
.trash-intro{font-size:13px;margin:6px 0 18px;max-width:720px}
.trash-empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:40px;color:#6d7c92}
.trash-empty strong{color:#16213a}
.trash-table{padding:0;overflow:hidden}
.trash-table table{width:100%;border-collapse:collapse;font-size:13px}
.trash-table th{text-align:left;font-size:11px;font-weight:500;letter-spacing:.5px;text-transform:uppercase;color:#6d7c92;background:#f8f9fb;padding:10px 18px}
.trash-table td{padding:12px 18px;border-top:1px solid #eef0f4;vertical-align:middle}
.trash-table td strong{display:block}
.trash-meta{color:#6d7c92;font-size:12px}
.trash-actions{text-align:right;white-space:nowrap}
.trash-actions .button{margin-left:6px;min-height:30px;padding:6px 10px;font-size:12px}
.danger{color:#b42318;border-color:#fda29b}
.danger-fill{background:#d92d20;border-color:#d92d20}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
</style>
