<template>
  <span v-if="locate" ref="anchor" hidden />
  <Teleport v-if="error && target" :to="target"><span class="st-error" role="alert">{{ error.message }}</span></Teleport>
  <p v-else-if="error" class="st-error" role="alert"><strong v-if="fieldName">{{ fieldName }}: </strong>{{ error.message }}<span v-if="others.length"> Models that can: {{ others.join(', ') }}.</span></p>
</template>
<script setup>
import { computed, nextTick, onMounted, ref, shallowRef, watch } from 'vue'
const props = defineProps({ error: Object, locate: Boolean })
// The server names the field ("request.prompt", "model") and, for a model that cannot do it, the ones that can, as
// objects. Both are said in words (2026-10-28: "model: ... Alternatives: [object Object], [object Object]").
const fieldName = computed(() => { const f = String(props.error?.field || '').replace(/^request\./, '').replace(/[._]/g, ' ').trim(); return f ? f[0].toUpperCase() + f.slice(1) : '' })
const others = computed(() => [...new Set((props.error?.alternatives || []).map(a => typeof a === 'string' ? a : a?.name || a?.model_id).filter(Boolean))])
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
