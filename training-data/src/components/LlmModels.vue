<script setup>
// The models page's LLM form (plan §2.1): every chat model version with its base model and licence, the dataset and
// method it was trained with, its parent, its loss curve, the smoke answer and the model card.
// Backend: llm/app_api.py chat_models.
import { onMounted, ref } from 'vue';
import { RefreshCw, Box } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import { llmApi, lossPoints, lossInWords, cardFacts } from '../api/llm.js';
import { ago } from '../api/training.js';
import './llm.css';

const props = defineProps({ project: Object });
const emit = defineEmits(['navigate']);
const models = ref(null); const error = ref('');

async function load() {
  error.value = '';
  try { models.value = (await llmApi.models(props.project.ref)).models; } catch (e) { error.value = e.message; }
}
onMounted(load);
</script>

<template>
  <div class="studio llm-models">
    <div class="studio-actions"><p>Every model a run produced, on its base model. A model trained from a research-only base model is never released.</p><UiButton @click="load"><RefreshCw :size="15" /> Refresh</UiButton></div>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <p v-if="!models && !error" class="llm-loading">Loading…</p>
    <section v-if="models && !models.length" class="panel empty-state"><Box :size="30" /><h2>No model yet</h2><p>A training run that succeeds registers one here.</p><UiButton @click="emit('navigate', 'train')">Go to training</UiButton></section>
    <article v-for="m in models || []" :key="m.version" class="panel llm-model">
      <header><h2>{{ m.name }}</h2><UiBadge tone="purple">{{ m.method_label }}</UiBadge><UiBadge v-if="m.research_only" tone="dark">Research only</UiBadge><span class="field-help">{{ ago(m.created_at) }}</span></header>
      <dl class="llm-facts">
        <dt>Base model</dt><dd>{{ m.base_model }} · {{ m.licence }}</dd>
        <dt>Trained on</dt><dd>{{ m.dataset_version }} by run {{ m.run }}{{ m.parent ? `, starting from ${m.parent}` : '' }}</dd>
        <dt>Loss</dt><dd>{{ m.metrics.train_loss != null ? `training ${m.metrics.train_loss.toFixed(3)}` : '—' }}{{ m.metrics.eval_loss != null ? `, validation ${m.metrics.eval_loss.toFixed(3)}` : '' }} · {{ m.metrics.steps }} steps</dd>
        <dt>Smoke answer</dt><dd>“{{ m.smoke_answer.question }}” → {{ m.smoke_answer.answer }}</dd>
        <dt>Archive</dt><dd><code>{{ m.artifact_sha256.slice(0, 16) }}</code></dd>
      </dl>
      <figure v-if="lossPoints(m.metrics.history)" class="llm-curve-figure">
        <svg class="llm-curve" viewBox="-2 -2 244 64" role="img" :aria-label="`Training loss of ${m.name}, ${lossInWords(m.metrics.history)}`"><polyline :points="lossPoints(m.metrics.history)" fill="none" stroke="currentColor" stroke-width="1.5" /></svg>
        <figcaption class="field-help">Training loss {{ lossInWords(m.metrics.history) }}</figcaption>
      </figure>
      <details><summary>Model card</summary><dl class="llm-facts"><template v-for="[label, value] in cardFacts(m.card)" :key="label"><dt>{{ label }}</dt><dd>{{ value }}</dd></template></dl>
        <details><summary>The whole card (JSON)</summary><pre class="code-block">{{ JSON.stringify(m.card, null, 2) }}</pre></details></details>
    </article>
  </div>
</template>

<style scoped>
.llm-models{display:grid;gap:16px}
.llm-model header{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.llm-model header h2{margin:0}
.llm-curve-figure{margin:8px 0}
.llm-curve{width:240px;height:64px;color:#7c3aed}
</style>
