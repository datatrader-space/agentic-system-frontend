<script setup>
import { computed, onMounted, ref } from 'vue';
import { ArrowDown, Boxes, Check, Save, SlidersHorizontal } from 'lucide-vue-next';
import { labelingWorkflows } from '../api/labelingWorkflows.js';
import UiButton from './UiButton.vue';
import UiDialog from './UiDialog.vue';
const props = defineProps({ project: String, definition: Object, canSave: Boolean, disabled: Boolean, sourceName: String });
const emit = defineEmits(['apply']);
const rows = ref([]); const selected = ref(''); const name = ref(''); const busy = ref(false); const error = ref('');
const notice = ref(''); const confirm = ref(false);
const row = computed(() => rows.value.find(item => item.id === selected.value));
const matches = computed(() => row.value && row.value.name === name.value.trim() && JSON.stringify(row.value.definition) === JSON.stringify(props.definition));
const shown = computed(() => row.value?.definition || props.definition);
async function reload() {
  error.value = '';
  try { rows.value = (await labelingWorkflows.list(props.project)).workflows; }
  catch (e) { error.value = e.message; }
}
onMounted(reload);
function choose() { name.value = row.value?.name || ''; notice.value = ''; }
async function save() {
  busy.value = true; error.value = ''; notice.value = '';
  try {
    const saved = await labelingWorkflows.save(props.project, name.value.trim(), props.definition, row.value);
    rows.value = [saved, ...rows.value.filter(item => item.id !== saved.id)]; selected.value = saved.id;
    notice.value = 'Workflow saved to this project.';
  } catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}
async function use() {
  busy.value = true; error.value = ''; notice.value = '';
  try {
    const body = await labelingWorkflows.use(props.project, row.value);
    emit('apply', body); confirm.value = false;
    notice.value = 'Workflow applied. Run a preview when you are ready.';
  } catch (e) { error.value = e.message; confirm.value = false; }
  finally { busy.value = false; }
}
defineExpose({ reload });
</script>
<template>
  <section class="label-workflow" aria-label="Reusable labeling workflow">
    <div class="workflow-heading"><div><h3>Labeling workflow</h3><p>Reuse a model and class instructions across batches in this project.</p></div><UiButton :disabled="busy" @click="reload">Refresh</UiButton></div>
    <div class="workflow-fields">
      <label>Saved workflows<select v-model="selected" class="text-input" :disabled="busy" @change="choose"><option value="">New workflow</option><option v-for="item in rows" :key="item.id" :value="item.id">{{ item.name }} · v{{ item.revision }}</option></select></label>
      <label>Workflow name<input v-model="name" class="text-input" placeholder="Name your labeling workflow" maxlength="80" :readonly="!canSave" :disabled="busy"></label>
    </div>
    <div class="workflow-actions"><span class="workflow-state">{{ matches ? 'Saved · current configuration' : row ? 'Saved workflow selected' : 'Not saved' }}</span><UiButton v-if="canSave" :disabled="busy||disabled||!name.trim()||!definition.classes.length" @click="save"><Save :size="14"/>{{ row ? 'Update with current settings' : 'Save current settings' }}</UiButton><UiButton variant="primary" :disabled="busy||disabled||!row" @click="confirm=true"><Check :size="14"/>Use this workflow</UiButton></div>
    <p v-if="error" class="field-error" role="alert">{{ error }} Reload before retrying if another person changed this workflow.</p>
    <p v-if="notice" class="workflow-notice" role="status">{{ notice }}</p>
    <div class="workflow-graph" aria-label="Workflow stages">
      <article><span class="workflow-node-icon"><Boxes :size="20"/></span><div><small>1 · Model &amp; run location</small><h4>{{ shown.source === definition.source ? sourceName : shown.source || 'Choose a model' }}</h4><p>{{ shown.where || 'Default run location' }}</p></div></article>
      <ArrowDown :size="20" aria-hidden="true"/>
      <article><span class="workflow-node-icon"><SlidersHorizontal :size="20"/></span><div><small>2 · Class instructions</small><div class="workflow-class-list"><span v-for="item in shown.classes" :key="item.name" :title="item.description"><i :style="{background:item.color}"/>{{ item.name }}</span></div><p>Descriptions guide supported models. Model capabilities still apply.</p></div></article>
      <ArrowDown :size="20" aria-hidden="true"/>
      <article><span class="workflow-node-icon"><Check :size="20"/></span><div><small>3 · Preview &amp; human review</small><h4>Review before accepting labels</h4><p>Run a sample preview, then explicitly label the batch. Every draft needs review.</p></div></article>
    </div>
    <p class="workflow-footnote">Saving records the current model and selected classes. Using a saved workflow applies its settings and may add or update project class descriptions and colors. It starts no inference and approves no labels.</p>
    <UiDialog :open="confirm" title="Use this labeling workflow?" @close="confirm=false"><p class="dialog-description">Apply <strong>{{ row?.name }}</strong> to this batch’s Auto Label settings? Its classes may be added to the project, and matching class colors and descriptions updated. Existing project classes remain. The server checks your permissions and the class lock.</p><p class="dialog-description">Preview and batch labeling still require your explicit action.</p><div class="dialog-actions"><UiButton @click="confirm=false">Cancel</UiButton><UiButton variant="primary" :disabled="busy||disabled" @click="use">Apply workflow</UiButton></div></UiDialog>
  </section>
</template>
<style scoped>
.label-workflow{flex:1;min-height:0;overflow:auto;padding:18px 12px;color:#334155}.workflow-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.workflow-heading h3{font-size:16px;margin:0 0 6px}.workflow-heading p,.workflow-footnote{font-size:12px;color:#64748b;line-height:1.6;margin:0}.workflow-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:20px 0 12px}.workflow-fields label{display:flex;flex-direction:column;gap:7px;font-size:11px}.workflow-fields .text-input{width:100%;min-width:0;font-size:12px}.workflow-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.workflow-state{font-size:11px;color:#64748b;margin-right:auto}.workflow-actions .button,.workflow-heading .button{font-size:11px;padding:7px 10px}.workflow-graph{display:flex;flex-direction:column;align-items:center;gap:12px;padding:28px 10px;color:#94a3b8}.workflow-graph article{display:flex;align-items:flex-start;gap:14px;width:100%;max-width:480px;border:1px solid #dce3ed;background:#fff;border-radius:10px;padding:18px;box-shadow:0 2px 5px #0f172a04;color:#334155}.workflow-node-icon{padding:9px;background:#eff6ff;color:#2563eb;border-radius:8px}.workflow-graph small{font-size:10px;color:#64748b}.workflow-graph h4{font-size:13px;margin:7px 0;overflow-wrap:anywhere}.workflow-graph p{font-size:11px;color:#64748b;line-height:1.6;margin:6px 0 0}.workflow-class-list{display:flex;flex-wrap:wrap;gap:7px;margin:10px 0}.workflow-class-list span{display:flex;align-items:center;gap:5px;font-size:11px;background:#f8fafc;padding:5px 8px;border-radius:5px}.workflow-class-list i{width:7px;height:7px;border-radius:50%}.workflow-notice{font-size:12px;color:#047857}.workflow-footnote{max-width:600px;margin:auto}@media(max-width:700px){.workflow-fields{grid-template-columns:1fr}.label-workflow{overflow:visible}.workflow-graph{padding:20px 0}}
</style>
