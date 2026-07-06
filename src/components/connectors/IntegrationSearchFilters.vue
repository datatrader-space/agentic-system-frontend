<template>
  <!-- Search + filter row (Aadml). v-model:query / v-model:category / v-model:typeFilter -->
  <div class="isf-row">
    <div class="isf-search">
      <Icon icon="lucide:search" class="isf-search-ic" />
      <input
        :value="query"
        @input="$emit('update:query', $event.target.value)"
        :placeholder="searchPlaceholder"
        class="isf-search-input"
      />
    </div>

    <div class="isf-selects">
      <div class="isf-select">
        <Icon icon="lucide:layout-grid" class="isf-select-ic" />
        <select :value="category" @change="$emit('update:category', $event.target.value)">
          <option v-for="c in categories" :key="c" :value="c">{{ c === 'Popular' ? 'All Categories' : c }}</option>
        </select>
        <Icon icon="lucide:chevron-down" class="isf-chev" />
      </div>

      <div class="isf-select">
        <Icon icon="lucide:sliders-horizontal" class="isf-select-ic" />
        <select :value="typeFilter" @change="$emit('update:typeFilter', $event.target.value)">
          <option v-for="t in typeOptions" :key="t.value" :value="t.value">{{ t.label }}</option>
        </select>
        <Icon icon="lucide:chevron-down" class="isf-chev" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { Icon } from '@iconify/vue'

defineProps({
  query: { type: String, default: '' },
  category: { type: String, default: 'Popular' },
  typeFilter: { type: String, default: 'all' },
  categories: { type: Array, default: () => [] },
  searchPlaceholder: { type: String, default: 'Search integrations…' },
  typeOptions: {
    type: Array,
    default: () => [
      { value: 'all', label: 'All Types' },
      { value: 'oauth', label: 'OAuth' },
      { value: 'pat', label: 'Personal token' },
      { value: 'soon', label: 'Coming soon' },
    ],
  },
})
defineEmits(['update:query', 'update:category', 'update:typeFilter'])
</script>

<style scoped>
.isf-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.isf-search { position: relative; flex: 1 1 280px; min-width: 220px; }
.isf-search-ic { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; color: var(--vm-ink-faint); }
.isf-search-input {
  width: 100%; padding: 10px 14px 10px 36px; border-radius: 12px;
  border: 1px solid var(--vm-line-2); background: var(--vm-surface);
  font: 500 13px var(--vm-font-sans); color: var(--vm-ink);
}
.isf-search-input:focus { outline: none; border-color: var(--vm-sky); box-shadow: 0 0 0 4px rgba(46,144,250,.16); }
.isf-selects { display: flex; gap: 10px; flex-wrap: wrap; }
.isf-select { position: relative; display: flex; align-items: center; }
.isf-select-ic { position: absolute; left: 11px; width: 15px; height: 15px; color: var(--vm-ink-faint); pointer-events: none; }
.isf-chev { position: absolute; right: 10px; width: 15px; height: 15px; color: var(--vm-ink-faint); pointer-events: none; }
.isf-select select {
  appearance: none; padding: 10px 30px 10px 33px; border-radius: 12px; border: 1px solid var(--vm-line-2);
  background: var(--vm-surface); font: 600 13px var(--vm-font-sans); color: var(--vm-ink); cursor: pointer; min-width: 168px;
}
.isf-select select:focus { outline: none; border-color: var(--vm-sky); box-shadow: 0 0 0 4px rgba(46,144,250,.16); }
</style>

