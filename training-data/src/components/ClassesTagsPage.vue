<script setup>
// A project's Classes & tags page: the classes (wall, window and door, which every walls model learns, then the
// project's own label-only classes) with how often each is drawn, and the photo tags with how many photos carry each.
// Add, change and remove a class; lock the classes (Owner); rename or remove a tag on every photo. Tags are put on
// photos on the Dataset page. Backend: app_api.py classes-tags/, classes/, class-lock/, tags/<remove|rename>/.
import { computed, ref, watch } from 'vue';
import { Check, Lock, Plus, Search, X } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import UiDialog from './UiDialog.vue';
import { classesApi, usageText, matching } from '../api/classes.js';

const props = defineProps({ projectRef: { type: String, required: true } });
const emit = defineEmits(['navigate']);
const tab = ref('Classes');
const data = ref(null); const error = ref(''); const notice = ref(''); const busy = ref(false); const words = ref('');

async function load() {
  try { data.value = await classesApi.load(props.projectRef); error.value = ''; } catch (e) { error.value = e.message; }
}
watch(() => props.projectRef, () => { data.value = null; load(); }, { immediate: true });

const rows = computed(() => matching(tab.value === 'Classes' ? data.value?.classes : data.value?.tags, words.value));

// One dialog at a time: add or edit a class, remove a class, rename or remove a tag, add a tag (explained).
const dialog = ref(null); const form = ref({}); const dialogError = ref('');
function open(type, row = null) {
  dialog.value = { type, row }; dialogError.value = '';
  form.value = type === 'class' ? { name: row?.name || '', color: row?.color || '#8b5cf6', description: row?.description || '' }
    : type === 'rename' ? { to: row.name } : {};
}
const title = computed(() => ({ class: dialog.value?.row ? `Edit "${dialog.value.row.name}"` : 'Add a class', removeClass: 'Remove the class',
  rename: 'Rename the tag', removeTag: 'Remove the tag', addTag: 'Add a tag' }[dialog.value?.type] || ''));

async function run(call, done) {
  busy.value = true; dialogError.value = ''; error.value = '';
  try { const answer = await call(); notice.value = done(answer); dialog.value = null; await load(); }
  catch (e) { if (dialog.value) dialogError.value = e.message; else error.value = e.message; }
  finally { busy.value = false; }
}
function saveClass() {
  const { row } = dialog.value; const body = { color: form.value.color, description: form.value.description };
  if (row) return run(() => classesApi.updateClass(props.projectRef, row.name, body), () => `"${row.name}" is changed.`);
  return run(() => classesApi.addClass(props.projectRef, { ...body, name: form.value.name.trim() }), a => `"${a.added}" is added. It is drawn and kept with the labels, and is not trained on.`);
}
const removeClass = () => run(() => classesApi.removeClass(props.projectRef, dialog.value.row.name), () => `"${dialog.value.row.name}" is removed.`);
const renameTag = () => run(() => classesApi.tag(props.projectRef, 'rename', { tag: dialog.value.row.name, to: form.value.to }), a => a.said);
const removeTag = () => run(() => classesApi.tag(props.projectRef, 'remove', { tag: dialog.value.row.name }), a => a.said);
async function toggleLock(event) {
  const locked = event.target.checked;
  busy.value = true; error.value = '';
  try { notice.value = (await classesApi.lock(props.projectRef, locked)).said; await load(); }
  catch (e) { error.value = e.message; event.target.checked = !locked; } finally { busy.value = false; }
}
</script>

<template>
  <div class="classes-page">
    <div class="studio-tabs">
      <button v-for="t in ['Classes','Tags']" :key="t" :class="{active:tab===t}" @click="tab=t">{{ t }} <UiBadge>{{ data ? (t==='Classes' ? data.classes.length : data.tags.length) : '…' }}</UiBadge></button>
    </div>
    <div v-if="notice" class="notice" role="status"><Check :size="16"/><span>{{ notice }}</span><button class="icon-button" aria-label="Dismiss" @click="notice=''"><X :size="14"/></button></div>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <p v-if="!data&&!error">Loading…</p>
    <template v-else-if="data">
      <div class="studio-actions">
        <div class="search-field"><Search :size="17"/><input v-model="words" aria-label="Search classes or tags" placeholder="Search classes or tags…"></div>
        <UiButton v-if="tab==='Classes'" variant="primary" :disabled="busy||!data.may.classes" :title="data.locked ? 'The classes are locked' : ''" @click="open('class')"><Plus :size="16"/> Add class</UiButton>
        <UiButton v-else variant="primary" :disabled="busy" @click="open('addTag')"><Plus :size="16"/> Add tag</UiButton>
        <label v-if="tab==='Classes'" class="lock" :class="{off:!data.may.lock}" :title="data.may.lock ? '' : 'Only the project\'s Owner locks the classes'">
          <input type="checkbox" :checked="data.locked" :disabled="busy||!data.may.lock" @change="toggleLock"> <Lock :size="14"/> Lock classes</label>
      </div>
      <p v-if="tab==='Classes'" class="classes-meta">Wall, window and door are the classes every walls model learns; they cannot be removed. A class the project adds is drawn and kept with the labels, and is not trained on.<template v-if="data.locked"> The classes are locked: nobody adds, changes or removes one.</template></p>
      <p v-else class="classes-meta">Tags are put on photos on the Dataset page. Renaming or removing a tag here changes every photo that carries it.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>{{ tab==='Classes' ? 'Color' : 'Type' }}</th><th>Name</th><th>Usage</th><th>Modify</th></tr></thead>
          <tbody>
            <tr v-for="row in rows" :key="row.name">
              <td><span v-if="tab==='Classes'" class="class-dot" :style="{background:row.color}"/><UiBadge v-else>Tag</UiBadge></td>
              <td><strong>{{ row.name }}</strong><UiBadge v-if="row.trained" tone="purple">Trained on</UiBadge><span v-if="row.description" class="classes-meta"> · {{ row.description }}</span></td>
              <td>{{ tab==='Classes' ? usageText(row) : `${row.photos} photo${row.photos===1?'':'s'}` }}</td>
              <td class="modify">
                <template v-if="tab==='Classes'">
                  <UiButton :disabled="busy||!data.may.classes" @click="open('class', row)">Edit</UiButton>
                  <UiButton v-if="!row.trained" class="danger" :disabled="busy||!data.may.classes" @click="open('removeClass', row)">Remove</UiButton>
                </template>
                <template v-else>
                  <UiButton :disabled="busy||!data.may.tags" @click="open('rename', row)">Rename</UiButton>
                  <UiButton class="danger" :disabled="busy||!data.may.tags" @click="open('removeTag', row)">Remove</UiButton>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="!rows.length" class="empty-state">
          <h3>{{ words ? 'Nothing matches' : tab==='Classes' ? 'No classes' : 'No tags yet' }}</h3>
          <p>{{ tab==='Classes' ? 'Add a class of your own to draw it in the editor.' : 'Tags appear here once photos carry them (Dataset page).' }}</p>
        </div>
      </div>
    </template>

    <UiDialog :open="!!dialog" :title="title" @close="dialog=null">
      <template v-if="dialog?.type==='class'">
        <label v-if="!dialog.row" class="field-label">Name<input v-model="form.name" class="text-input" maxlength="40" placeholder="e.g. radiator"></label>
        <label class="field-label">Color<input v-model="form.color" type="color" class="color-input"></label>
        <label class="field-label">Description<input v-model="form.description" class="text-input" maxlength="300" placeholder="What a labeller should mark with it"></label>
        <p v-if="dialogError" class="field-error" role="alert">{{ dialogError }}</p>
        <div class="dialog-actions"><UiButton @click="dialog=null">Cancel</UiButton><UiButton variant="primary" :disabled="busy||(!dialog.row&&!form.name.trim())" @click="saveClass">{{ dialog.row ? 'Save' : 'Add class' }}</UiButton></div>
      </template>
      <template v-else-if="dialog?.type==='removeClass'">
        <p class="dialog-description">"{{ dialog.row.name }}" is removed from the project. A class that labels still use cannot be removed: remove those shapes first.</p>
        <p v-if="dialogError" class="field-error" role="alert">{{ dialogError }}</p>
        <div class="dialog-actions"><UiButton @click="dialog=null">Cancel</UiButton><UiButton variant="primary" class="danger-fill" :disabled="busy" @click="removeClass">Remove</UiButton></div>
      </template>
      <template v-else-if="dialog?.type==='rename'">
        <p class="dialog-description">"{{ dialog.row.name }}" is renamed on its {{ dialog.row.photos }} photo{{ dialog.row.photos===1?'':'s' }}. A photo that already has the new name keeps one.</p>
        <label class="field-label">New name<input v-model="form.to" class="text-input" maxlength="40"></label>
        <p v-if="dialogError" class="field-error" role="alert">{{ dialogError }}</p>
        <div class="dialog-actions"><UiButton @click="dialog=null">Cancel</UiButton><UiButton variant="primary" :disabled="busy||!form.to?.trim()" @click="renameTag">Rename</UiButton></div>
      </template>
      <template v-else-if="dialog?.type==='removeTag'">
        <p class="dialog-description">"{{ dialog.row.name }}" is taken off its {{ dialog.row.photos }} photo{{ dialog.row.photos===1?'':'s' }}. The photos stay.</p>
        <p v-if="dialogError" class="field-error" role="alert">{{ dialogError }}</p>
        <div class="dialog-actions"><UiButton @click="dialog=null">Cancel</UiButton><UiButton variant="primary" class="danger-fill" :disabled="busy" @click="removeTag">Remove</UiButton></div>
      </template>
      <template v-else-if="dialog?.type==='addTag'">
        <p class="dialog-description">A tag is put on photos: on the Dataset page, select the photos, then add the tag. It appears here with how many photos carry it.</p>
        <div class="dialog-actions"><UiButton @click="dialog=null">Cancel</UiButton><UiButton variant="primary" @click="dialog=null;emit('navigate','dataset')">Open the Dataset page</UiButton></div>
      </template>
    </UiDialog>
  </div>
</template>

<style scoped>
.classes-meta{font-size:12px!important;color:#6d7c92!important;margin:0 0 12px!important}
td .classes-meta{margin:0!important}
.lock{display:inline-flex;align-items:center;gap:6px;font-size:12px;cursor:pointer}
.lock.off{opacity:.6;cursor:not-allowed}
td .badge{margin-left:8px}
.modify{white-space:nowrap}
.modify .button{min-height:30px;padding:6px 10px;font-size:12px;margin-right:6px}
.danger{color:#b42318;border-color:#fda29b}
.danger-fill{background:#d92d20;border-color:#d92d20}
.color-input{display:block;margin-top:8px;width:64px;height:36px;border:1px solid #d9dce5;border-radius:7px;padding:2px;background:white}
</style>
