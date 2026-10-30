<script setup>
import { Search, RefreshCw, X } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
defineProps({ title: String, query: String, status: String, states: { type: Array, default: () => [] }, count: Number, total: Number, loading: Boolean });
defineEmits(['update:query', 'update:status', 'refresh']);
</script>

<template>
  <div class="deployment-toolbar">
    <div class="deployment-list-title"><h3>{{ title }}</h3><span aria-live="polite">{{ count }} of {{ total }}</span></div>
    <div class="deployment-filters">
      <label class="deployment-search"><Search :size="15" aria-hidden="true"/><span class="toolbar-sr">Search {{ title }}</span><input type="search" :value="query" :placeholder="`Search ${title.toLowerCase()}…`" @input="$emit('update:query', $event.target.value)"/></label>
      <label><span class="toolbar-sr">Filter {{ title }} by status</span><select :value="status" @change="$emit('update:status', $event.target.value)"><option value="">All statuses</option><option v-for="state in states" :key="state.value" :value="state.value">{{ state.label }}</option></select></label>
      <UiButton v-if="query || status" @click="$emit('update:query', ''); $emit('update:status', '')"><X :size="14" aria-hidden="true"/> Clear</UiButton>
      <UiButton :disabled="loading" @click="$emit('refresh')"><RefreshCw :size="14" aria-hidden="true"/> Refresh</UiButton>
    </div>
  </div>
</template>

<style scoped>
.deployment-toolbar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;margin:26px 0 15px}.deployment-list-title{display:flex;align-items:center;gap:9px}.deployment-list-title h3{font-size:15px;color:#17243b}.deployment-list-title>span{font-size:10px;color:#748198;border:1px solid #e3e8ef;background:#fff;padding:3px 6px;border-radius:5px}.deployment-filters{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.deployment-search{display:flex;align-items:center;gap:7px;border:1px solid #dbe2ec;border-radius:8px;background:#fff;padding:0 10px;color:#8491a6;min-width:0}.deployment-search input{width:170px;min-width:0;min-height:40px;border:0;outline:none;background:transparent;font-size:12px;color:#34445c}.deployment-search:focus-within{outline:2px solid var(--aadml-focus);outline-offset:2px}.deployment-filters select{max-width:180px;min-height:40px;padding:8px 28px 8px 11px;border:1px solid #dbe2ec;border-radius:8px;background:#fff;color:#52627a;font-size:12px}.deployment-filters :deep(.button){min-height:40px}.toolbar-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
@media(max-width:650px){.deployment-filters{width:100%}.deployment-search{flex:1;min-width:150px}.deployment-search input{width:100%}.deployment-filters select{max-width:150px}}
</style>
