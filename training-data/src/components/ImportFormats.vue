<script setup>
import { computed, ref } from 'vue';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
const props = defineProps({ loading: Boolean, error: String, formats: { type: Array, default: () => [] } });
const emit = defineEmits(['choose']);
const query = ref(''); const task = ref('all'); const direction = ref('all'); const selected = ref(null);
const tasks = [{ key: 'all', name: 'All formats' }, { key: 'detection', name: 'Object Detection' },
  { key: 'segmentation', name: 'Instance Segmentation' }, { key: 'keypoints', name: 'Keypoint Detection' },
  { key: 'classification', name: 'Classification' }];
const filtered = computed(() => props.formats.filter(format => (task.value === 'all' || format.tasks.includes(task.value))
  && (direction.value === 'all' || format[direction.value])
  && `${format.name} ${format.extension}`.toLowerCase().includes(query.value.toLowerCase())));
const count = key => props.formats.filter(format => key === 'all' || format.tasks.includes(key)).length;
</script>

<template>
  <section class="import-formats" aria-label="Annotation import formats">
    <h2>Annotation formats</h2><p>Find your dataset’s format and check how to bring its labels into AADML.</p>
    <nav class="format-tasks" aria-label="Annotation task"><button v-for="item in tasks" :key="item.key" :aria-pressed="task === item.key" @click="task = item.key">{{ item.name }} <span>{{ count(item.key) }}</span></button></nav>
    <div class="format-search"><label>Filter by data transfer <select v-model="direction" aria-label="Data transfer"><option value="all">All formats</option><option value="import">Import available</option><option value="export">Export available</option></select></label><label>Search formats <input v-model="query" class="text-input" type="search" placeholder="COCO, YOLO, CSV…"/></label></div>
    <p v-if="loading" role="status">Loading format support…</p><p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <p>Showing {{ filtered.length }} of {{ formats.length }} formats. Import and export availability reflects AADML’s installed readers.</p>
    <div class="format-grid"><button v-for="format in filtered" :key="format.key" class="format-card" @click="selected = format"><strong>{{ format.name }}</strong><span>{{ format.extension }}</span><UiBadge :tone="format.import ? 'green' : 'neutral'">{{ format.import ? 'Import available' : 'Import unavailable' }}</UiBadge><small>{{ format.tasks.map(key => tasks.find(item => item.key === key)?.name || key).join(' · ') }}</small></button></div>
    <section v-if="selected" class="format-guide" aria-live="polite"><h3>{{ selected.name }}</h3><p>{{ selected.packaging }}</p><p>Class names come from your annotations. Boxes, oriented boxes, polygons, polylines, masks, keypoints and classification labels retain their type; importing does not approve them or start training.</p><p v-if="!selected.import">This reader is not available on the connected backend yet. No label data will be silently discarded or reported as imported.</p><div class="dialog-actions"><UiButton @click="selected = null">Close guide</UiButton><UiButton v-if="selected.import" variant="primary" @click="emit('choose', selected)">Import this format</UiButton></div></section>
  </section>
</template>

<style scoped>
.import-formats h2{font-size:22px;margin-bottom:10px}.import-formats p{font-size:13px;margin:12px 0}.format-tasks{display:flex;flex-wrap:wrap;gap:8px;margin:22px 0}.format-tasks button{padding:10px 12px;border:1px solid var(--aadml-outline);border-radius:6px;background:transparent;cursor:pointer}.format-tasks button[aria-pressed=true]{background:var(--aadml-soft);color:var(--accent);border-color:var(--accent)}.format-tasks span{margin-left:8px}.format-search{display:flex;gap:18px;flex-wrap:wrap}.format-search label{display:grid;gap:6px;flex:1;min-width:170px;font-size:12px}.format-search select{padding:10px;border:1px solid var(--aadml-outline);border-radius:6px;background:transparent}.format-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;max-height:370px;overflow:auto}.format-card{text-align:left;padding:18px;border:1px solid var(--aadml-outline);border-radius:8px;background:transparent;display:flex;align-items:flex-start;flex-direction:column;gap:10px;cursor:pointer;color:inherit}.format-card small{font-size:11px}.format-card>span{font-size:12px}.format-guide{border:1px solid var(--aadml-outline);border-radius:8px;padding:18px;margin-top:16px}
</style>
