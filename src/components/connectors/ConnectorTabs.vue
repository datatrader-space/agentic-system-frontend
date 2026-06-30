<template>
  <!-- Filter tab strip + inline category/type dropdowns + search (Aadml). -->
  <div class="ct-bar">
    <div class="ct-tabs">
      <button
        v-for="t in tabs"
        :key="t.value"
        @click="$emit('update:active', t.value)"
        :class="['ct-tab', active === t.value ? 'on' : '']"
      >
        {{ t.label }}
        <span v-if="t.count != null" class="ct-tab-count">{{ t.count }}</span>
      </button>
    </div>

    <div class="ct-controls">
      <div class="ct-select">
        <select :value="category" @change="$emit('update:category', $event.target.value)">
          <option v-for="c in categories" :key="c.value" :value="c.value">{{ c.label }}</option>
        </select>
        <Icon icon="lucide:chevron-down" class="ct-chev" />
      </div>
      <div class="ct-select">
        <select :value="typeFilter" @change="$emit('update:typeFilter', $event.target.value)">
          <option v-for="t in typeOptions" :key="t.value" :value="t.value">{{ t.label }}</option>
        </select>
        <Icon icon="lucide:chevron-down" class="ct-chev" />
      </div>
      <div class="ct-search">
        <Icon icon="lucide:search" class="ct-search-ic" />
        <input
          :value="query"
          @input="$emit('update:query', $event.target.value)"
          placeholder="Search connectorsâ€¦"
          class="ct-search-input"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { Icon } from '@iconify/vue'

defineProps({
  tabs: { type: Array, default: () => [] }, // [{ value, label, count }]
  active: { type: String, default: 'all' },
  category: { type: String, default: 'all' },
  typeFilter: { type: String, default: 'all' },
  query: { type: String, default: '' },
  categories: {
    type: Array,
    default: () => [
      { value: 'all', label: 'All Categories' },
      { value: 'builtin', label: 'Built-in services' },
      { value: 'service', label: 'Registered services' },
      { value: 'mcp', label: 'MCP servers' },
    ],
  },
  typeOptions: {
    type: Array,
    default: () => [
      { value: 'all', label: 'All Types' },
      { value: 'oauth', label: 'OAuth' },
      { value: 'api_key', label: 'API key' },
      { value: 'env', label: 'Env vars' },
      { value: 'none', label: 'No auth' },
    ],
  },
})
defineEmits(['update:active', 'update:category', 'update:typeFilter', 'update:query'])
</script>

<style scoped>
.ct-bar {
  display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;
  margin-bottom: 16px; padding: 0 4px; border-radius: 0;
  background: transparent; border: 0; box-shadow: none;
}
.ct-tabs { display: flex; gap: 22px; flex-wrap: wrap; order: 1; width: 100%; }
.ct-tab {
  position: relative; display: inline-flex; align-items: center; gap: 6px; padding: 0 0 12px; border-radius: 0; border: none; cursor: pointer;
  font: 750 13px var(--vm-font-sans); color: #64748B; background: transparent; transition: color .15s;
}
.ct-tab:hover { color: #2563EB; }
.ct-tab.on { color: #2563EB; background: transparent; box-shadow: none; }
.ct-tab.on::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 2px; border-radius: 999px; background: #2563EB; }
.ct-tab-count { display: none; }

.ct-controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; order: 2; width: 100%; }
.ct-search { position: relative; order: -1; }
.ct-select { position: relative; display: flex; align-items: center; }
.ct-chev { position: absolute; right: 11px; width: 14px; height: 14px; color: #64748B; pointer-events: none; }
.ct-select select {
  appearance: none; height: 38px; padding: 0 34px 0 14px; border-radius: 9px; border: 1px solid #DDE5F0;
  background: #fff; font: 750 13px var(--vm-font-sans); color: #0F172A; cursor: pointer; min-width: 160px;
}
.ct-select select:focus { outline: none; border-color: var(--vm-sky); box-shadow: 0 0 0 4px rgba(46,144,250,.16); }
.ct-search-ic { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 15px; height: 15px; color: #94A3B8; }
.ct-search-input {
  width: 285px; max-width: 100%; height: 38px; padding: 0 12px 0 36px; border-radius: 9px;
  border: 1px solid #DDE5F0; background: #fff; font: 600 13px var(--vm-font-sans); color: #0F172A;
}
.ct-search-input:focus { outline: none; border-color: var(--vm-sky); box-shadow: 0 0 0 4px rgba(46,144,250,.16); }
</style>

