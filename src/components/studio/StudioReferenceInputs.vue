<template>
  <div class="sri" data-test="studio-reference-inputs">
    <div class="sri-slots">
      <InputSlot v-for="slot in groups" :key="slot.id" v-bind="slot" tabindex="-1" :data-studio-required-empty="slot.required && !slot.items.length ? 'true' : 'false'" @add-files="emit('add-files', slot, $event)" @pick="emit('pick', slot, $event)" @remove="emit('remove', $event.key)" />
    </div>
    <div v-if="unassigned.length" class="sri-kept"><strong>Kept references</strong><p class="st-muted">Changing a preset keeps these inputs. Remove any you do not want to send.</p><div v-for="item in unassigned" :key="item.key"><span>{{ item.name }}</span><button type="button" class="st-button" @click="emit('remove', item.key)">Remove</button></div></div>
  </div>
</template>
<script setup>
import InputSlot from './InputSlot.vue'
defineProps({ groups: { type: Array, default: () => [] }, unassigned: { type: Array, default: () => [] } })
const emit = defineEmits(['add-files','pick','remove'])
</script>
<style scoped>
.sri{display:grid;gap:16px;min-width:0}.sri-slots{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));gap:18px}.sri-kept{display:grid;gap:8px;font-size:12px}.sri-kept>div{display:flex;align-items:center;gap:8px}.sri-kept>div>span{flex:1;overflow-wrap:anywhere}
</style>
