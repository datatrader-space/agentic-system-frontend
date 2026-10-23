<template>
  <span v-if="locate" ref="anchor" hidden />
  <Teleport v-if="error && target" :to="target"><span class="st-error" role="alert">{{ error.message }}</span></Teleport>
  <p v-else-if="error" class="st-error" role="alert"><strong v-if="error.field">{{ error.field }}: </strong>{{ error.message }}<span v-if="error.alternatives?.length"> Alternatives: {{ error.alternatives.join(', ') }}</span></p>
</template>
<script setup>
import { nextTick, onMounted, ref, shallowRef, watch } from 'vue'
const props = defineProps({ error: Object, locate: Boolean })
const anchor = ref(null), target = shallowRef(null)
async function locateField() {
  await nextTick()
  if (!props.locate || !props.error?.field) { target.value = null; return }
  const field = props.error.field.replace(/^request\./,'')
  target.value = [...(anchor.value?.closest('.creative-form')?.querySelectorAll('[data-field]') || [])].find(el => el.dataset.field === field) || null
}
onMounted(locateField)
watch(() => props.error, locateField)
</script>
