<script setup>
import { ref, watch, nextTick, useId } from 'vue';
import { X } from 'lucide-vue-next';
const props = defineProps({ open: Boolean, title: String });
const emit = defineEmits(['close']);
const dialog = ref(null);
const titleId = useId();
let previousFocus;
watch(() => props.open, async (open) => {
  await nextTick();
  if (open) { previousFocus = document.activeElement; dialog.value.showModal(); }
  else { dialog.value.close(); previousFocus?.focus(); }
});
</script>
<template><dialog ref="dialog" class="dialog" :aria-labelledby="titleId" @cancel.prevent="emit('close')">
  <header><h2 :id="titleId">{{ title }}</h2><button class="icon-button" aria-label="Close dialog" @click="emit('close')"><X :size="20" /></button></header>
  <slot />
</dialog></template>
