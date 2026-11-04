<template>
  <label class="sps"><span>Preset</span><select :value="modelValue" :disabled="disabled" aria-label="Preset" data-test="studio-agent-preset" @change="emit('update:modelValue', $event.target.value)"><option value="">Your own idea</option><option v-for="preset in presets" :key="preset.id" :value="preset.id">{{ preset.title }}</option></select></label>
</template>
<script setup>
defineProps({ modelValue: { type: String, default: '' }, presets: { type: Array, default: () => [] }, disabled: Boolean })
const emit = defineEmits(['update:modelValue'])
</script>
<style scoped>
.sps{display:flex;align-items:center;gap:10px;min-width:0;flex-shrink:0}.sps>span{font-size:12px;color:var(--vm-ink-soft)}.sps select{flex:1;min-width:0;width:100%;min-height:36px;padding:8px 10px;border:1px solid var(--vm-line);border-radius:7px;background:var(--vm-surface-2);color:var(--vm-ink);font:500 13px var(--vm-font-sans)}@media(max-width:767px){.sps select{min-height:44px;font-size:16px}}
</style>
