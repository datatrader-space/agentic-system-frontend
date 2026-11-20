<script setup>
// How a model's answer is shown: Polygons or Masks, the two ways of one model or pair (sourceFamilies.js). Both ask the
// same model and get the same shapes; a mask is drawn filled. One component, so the model picker (Auto Label, "Find
// Objects with AI") and the editor's found shapes switch alike. Shown only when the chosen model has both ways.
import { computed } from 'vue';
import { Shapes, PaintBucket } from 'lucide-vue-next';
import { familyOfId, groupSources, idFor, labelsOfId, waysOf } from '../sourceFamilies.js';

const props = defineProps({
  sources: { type: Array, default: () => [] },
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue']);
const family = computed(() => familyOfId(groupSources(props.sources), props.modelValue));
const labels = computed(() => labelsOfId(props.sources, props.modelValue));
const ways = computed(() => waysOf(family.value));
function setWay(way) { if (family.value) emit('update:modelValue', idFor(family.value, way)); }
</script>

<template>
  <div v-if="family && ways.length > 1" class="source-ways" role="radiogroup" aria-label="How the answer is shown">
    <button v-for="way in ways" :key="way" type="button" role="radio" :aria-checked="labels===way" :class="{ on: labels===way }"
            :disabled="disabled" @click="setWay(way)">
      <PaintBucket v-if="way==='masks'" :size="15" aria-hidden="true"/><Shapes v-else :size="15" aria-hidden="true"/>
      {{ way === 'masks' ? 'Masks' : 'Polygons' }}
    </button>
  </div>
</template>

<style scoped>
.source-ways { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; border-radius: 10px; background: #f2f4f7; }
.source-ways button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 40px; border: 0; border-radius: 8px;
  background: none; color: #475467; font-size: 14px; font-weight: 500; cursor: pointer; transition: background .15s, color .15s; }
.source-ways button.on { background: #fff; color: #16213a; box-shadow: 0 1px 3px #10182826; }
.source-ways button:focus-visible { outline: 2px solid var(--aadml-focus); outline-offset: 1px; }
@media (prefers-reduced-motion: reduce) { .source-ways button { transition: none; } }
</style>
