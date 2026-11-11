<template>
  <!-- The files found by name, as Go to file (Ctrl+P) and an @ mention in the chat show them (one copy). -->
  <ul :id="listId" class="fr-list" role="listbox" :aria-label="label">
    <li v-for="(f, i) in items" :id="`${listId}-${i}`" :key="f.path" role="option" class="fr-item"
        :class="{ on: i === active }" :aria-selected="i === active ? 'true' : 'false'"
        @mousemove="$emit('hover', i)" @mousedown.prevent="$emit('pick', f)">
      <Icon icon="lucide:file" class="fr-ic" aria-hidden="true" />
      <span class="fr-name" translate="no"><template v-for="(p, k) in mark(f.name, highlight)" :key="k"><mark v-if="p.hit" class="fr-hit">{{ p.text }}</mark><span v-else>{{ p.text }}</span></template></span>
      <span class="fr-path" translate="no">{{ dirOf(f.path) }}</span>
      <span v-if="recentTag" class="fr-tag">recently opened</span>
    </li>
  </ul>
</template>

<script setup>
import { Icon } from '@iconify/vue'
import { mark } from '@/utils/quickOpen'

defineProps({
  items: { type: Array, default: () => [] },
  active: { type: Number, default: 0 },
  highlight: { type: String, default: '' },
  recentTag: { type: Boolean, default: false },
  listId: { type: String, required: true },
  label: { type: String, default: 'Files' },
})
defineEmits(['pick', 'hover'])
const dirOf = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '')
</script>

<style scoped>
.fr-list { list-style: none; margin: 0; padding: 0 4px 6px; overflow-y: auto; }
.fr-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; cursor: pointer; min-width: 0; }
.fr-item.on { background: color-mix(in srgb, var(--vm-violet) 14%, transparent); }
.fr-ic { width: 15px; height: 15px; flex: 0 0 auto; color: var(--vm-ink-faint); }
.fr-name { flex: 0 0 auto; color: var(--vm-ink); font-weight: 500; }
.fr-hit { background: transparent; color: var(--vm-link); font-weight: 700; padding: 0; }
.fr-path { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--vm-ink-faint); font-size: 12px; }
.fr-tag { flex: 0 0 auto; font-size: 11px; color: var(--vm-ink-faint); }
@media (pointer: coarse) { .fr-item { min-height: 44px; } }
</style>
