<script setup>
import { computed, ref } from 'vue';
import { Boxes, WandSparkles, ChartNoAxesCombined, Plus, Upload, Zap, Infinity, Grid2X2, Search } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
const emit = defineEmits(['create']);
const active = ref('My Models');
const query = ref('');
const task = ref('All Tasks');
const tabs = [{name:'My Models',icon:Boxes},{name:'Open Source Models',icon:WandSparkles},{name:'Model Monitoring',icon:ChartNoAxesCombined}];
const models = [
  {name:'SAM3',provider:'Meta AI',task:'Instance Segmentation',icon:Infinity,description:'Segment objects with prompts and detailed masks.'},
  {name:'Qwen VL',provider:'Alibaba',task:'Text Prompting',icon:WandSparkles,description:'Vision-language understanding, captioning, and grounded responses.'},
  {name:'SAM2',provider:'Meta AI',task:'Instance Segmentation',icon:Infinity,description:'Prompt-based segmentation for images and video.'},
  {name:'Florence-2',provider:'Microsoft',task:'Text Prompting',icon:Grid2X2,description:'Vision tasks including captioning, detection, and segmentation.',variants:['Base','Large']},
  {name:'CLIP',provider:'OpenAI',task:'Classification',icon:WandSparkles,description:'Image classification and embeddings using natural language.'},
  {name:'YOLO-World',provider:'Tencent AI Lab',task:'Object Detection',icon:WandSparkles,description:'Open-vocabulary object detection using text prompts.',variants:['Small','Medium','Large']},
  {name:'DocTR',provider:'Mindee',task:'OCR',icon:WandSparkles,description:'Document text detection and recognition with deep learning.'},
  {name:'EasyOCR',provider:'JaidedAI',task:'OCR',icon:WandSparkles,description:'Text recognition across multiple languages and scripts.'},
];
const filtered = computed(() => models.filter(m => (task.value === 'All Tasks' || m.task === task.value) && `${m.name} ${m.provider} ${m.description}`.toLowerCase().includes(query.value.trim().toLowerCase())));
</script>

<template>
  <div class="models-workspace">
    <nav class="models-tabs" aria-label="Models views"><button v-for="item in tabs" :key="item.name" :aria-pressed="active===item.name" @click="active=item.name"><component :is="item.icon" :size="17"/>{{item.name}}</button></nav>
    <section v-if="active==='My Models'" class="models-empty">
      <span class="models-empty-icon"><Boxes :size="34"/></span>
      <h2>No trained models yet.</h2>
      <p>Create a project to prepare your dataset. Training and custom<br class="wide-only"> weight uploads are coming soon.</p>
      <div class="models-actions"><UiButton variant="primary" @click="emit('create')"><Plus :size="17"/>Create a Project</UiButton><UiButton disabled title="Coming soon"><Upload :size="16"/>Upload Weights · Coming soon</UiButton></div>
    </section>
    <section v-if="active!=='Model Monitoring'" class="models-library">
      <h2>Open Source Models</h2><p>Explore the planned model catalog. All models are coming soon and are not connected yet.</p>
      <div class="models-filters"><label><Search :size="16"/><input v-model="query" placeholder="Search models…" aria-label="Search models"></label><select v-model="task" aria-label="Filter models by task"><option>All Tasks</option><option v-for="type in [...new Set(models.map(m=>m.task))]" :key="type">{{type}}</option></select></div>
      <div class="models-grid"><article v-for="model in filtered" :key="model.name" class="model-card">
        <header><span class="model-icon"><component :is="model.icon" :size="22"/></span><div><h3>{{model.name}}</h3><small>{{model.provider}}</small></div><span class="model-task">{{model.task}}</span></header>
        <p>{{model.description}}</p><div class="model-availability"><UiBadge tone="purple">Coming soon</UiBadge></div>
        <footer><select v-if="model.variants" :aria-label="`${model.name} variant`"><option v-for="variant in model.variants" :key="variant">{{variant}}</option></select><UiButton disabled :aria-label="`Use ${model.name} — coming soon`"><Zap :size="14"/>Use Model</UiButton></footer>
      </article></div>
      <div v-if="!filtered.length" class="models-no-results"><Search :size="28"/><h3>No matching models</h3><p>Try another name or task.</p><UiButton @click="query='';task='All Tasks'">Clear filters</UiButton></div>
    </section>
    <section v-else class="models-empty"><span class="models-empty-icon"><ChartNoAxesCombined :size="34"/></span><UiBadge tone="purple">Coming soon</UiBadge><h2>Model Monitoring</h2><p>Requests, latency, errors, and model performance will appear here<br class="wide-only"> when monitoring is connected.</p><UiButton disabled>Configure monitoring</UiButton></section>
  </div>
</template>

<style scoped>
.models-workspace{color:#152237}.models-tabs{display:flex;gap:16px;border-bottom:1px solid #e1e4ec;margin-bottom:26px}.models-tabs button{display:flex;align-items:center;gap:8px;background:none;border:0;border-bottom:2px solid transparent;padding:14px 16px;color:#728096;font-size:14px}.models-tabs button[aria-pressed=true]{color:var(--aadml-primary);border-bottom-color:var(--aadml-primary)}.models-empty{min-height:370px;border:1px solid var(--aadml-outline);border-radius:7px;background:radial-gradient(ellipse at 60% 0,var(--aadml-soft) 0,transparent 55%),linear-gradient(30deg,#e1eafa,#fff 55%,var(--aadml-tint));display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;padding:42px 24px;gap:20px;margin-bottom:34px}.models-empty-icon{width:80px;height:80px;border:1px dashed var(--aadml-outline);color:var(--aadml-focus);display:grid;place-items:center;border-radius:8px;margin-bottom:6px}.models-empty h2{font-size:25px;letter-spacing:-.4px}.models-empty p{font-size:14px;line-height:1.6}.models-actions{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:4px}.models-library>h2{font-size:20px;font-weight:600}.models-library>p{font-size:14px;margin-top:5px}.models-filters{display:flex;gap:9px;margin:30px 0}.models-filters label{display:flex;align-items:center;gap:8px;border:1px solid #d4d9e3;border-radius:7px;padding:0 12px;color:#8891a3}.models-filters input{border:0;background:transparent;padding:10px 0;outline:none;width:210px;font-size:13px}.models-filters label:focus-within{outline:2px solid var(--aadml-outline)}.models-filters select,.model-card select{border:1px solid #d4d9e3;background:#fff;color:#33445c;border-radius:6px;padding:9px 12px;font-size:12px}.models-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:24px}.model-card{border:1px solid #d4d9e3;border-radius:8px;padding:16px;background:#fff;box-shadow:0 2px 3px #13223a06;display:flex;flex-direction:column;min-width:0}.model-card header{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.model-icon{width:47px;height:47px;border:1px solid #d4d9e3;border-radius:6px;display:grid;place-items:center;background:#f9fafb;color:#758294;flex-shrink:0}.model-card h3{font-size:16px;letter-spacing:0}.model-card small{font-size:11px;color:#929bad;display:block;margin-top:4px}.model-task{margin-left:auto;background:#f4f5f7;border:1px solid #e2e5eb;padding:5px 7px;border-radius:6px;font-size:10px;color:#66778d}.model-card>p{font-size:13px;line-height:1.6;margin:12px 0;min-height:42px;color:#4c627c}.model-availability{margin-bottom:14px}.model-card footer{display:flex;gap:8px;margin-top:auto}.model-card footer .button{flex:1;color:var(--aadml-focus);border-color:var(--aadml-outline);background:var(--aadml-tint);opacity:1;font-weight:500}.model-card select{min-width:0;max-width:45%;flex:1}.models-no-results{text-align:center;padding:45px;border:1px dashed #ddd;border-radius:8px}.models-no-results h3,.models-no-results p{margin:12px 0}.models-tabs button:focus-visible{outline:2px solid var(--aadml-outline);outline-offset:2px}@media(max-width:1350px){.models-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:650px){.models-grid{grid-template-columns:1fr}.models-tabs{gap:0;overflow:auto}.models-tabs button{padding:12px 10px;font-size:12px;white-space:nowrap}.models-filters{flex-wrap:wrap}.models-empty{min-height:320px}.wide-only{display:none}.models-empty h2{font-size:22px}}
</style>
