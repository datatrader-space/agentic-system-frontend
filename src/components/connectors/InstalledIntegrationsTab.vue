<template>
  <!-- Installed integrations grid (Aadml). Emits 'open' (item). -->
  <div>
    <h3 class="iit-title">Installed integrations</h3>
    <p class="iit-sub">Connectors connected in this scope.</p>

    <p v-if="!items.length" class="iit-empty">Nothing installed yet — connect one from the connector catalog.</p>

    <div v-else class="iit-grid">
      <button
        v-for="c in items"
        :key="c.kind + '-' + c.id"
        class="iit-card"
        @click="$emit('open', c)"
      >
        <span class="iit-logo">
          <Icon v-if="c.icon && c.icon.includes(':')" :icon="c.icon" class="w-6 h-6" />
          <span v-else class="iit-fallback">{{ (c.name || '?').charAt(0) }}</span>
        </span>
        <div class="min-w-0 flex-1">
          <div class="iit-name">{{ c.name }}</div>
          <div class="iit-status"><span class="vm-orb is-live"></span>Connected</div>
        </div>
        <Icon icon="lucide:chevron-right" class="iit-chev" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { Icon } from '@iconify/vue'

defineProps({
  // [{ kind, id, name, icon }]
  items: { type: Array, default: () => [] },
})
defineEmits(['open'])
</script>

<style scoped>
.iit-title { font-family: var(--vm-font-display); font-size: 16px; font-weight: 800; color: var(--vm-ink); }
.iit-sub { font-size: 12px; color: var(--vm-ink-faint); margin: 2px 0 18px; }
.iit-empty { padding: 48px 0; text-align: center; font-size: 13px; color: var(--vm-ink-faint); }
.iit-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
@media (min-width: 768px) { .iit-grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1200px) { .iit-grid { grid-template-columns: repeat(3, 1fr); } }
.iit-card {
  display: flex; align-items: center; gap: 12px; text-align: left; cursor: pointer;
  padding: 14px; border-radius: var(--vm-r); background: var(--vm-surface);
  border: 1px solid var(--vm-line-2); box-shadow: var(--vm-shadow-s);
  transition: transform .15s var(--vm-ease2), box-shadow .15s, border-color .15s;
}
.iit-card:hover { transform: translateY(-2px); border-color: var(--vm-sky); box-shadow: var(--vm-shadow-m); }
.iit-logo { width: 40px; height: 40px; border-radius: 11px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: var(--vm-bg); border: 1px solid var(--vm-line); overflow: hidden; }
.iit-fallback { font-weight: 800; color: var(--vm-ink-soft); }
.iit-name { font-size: 13.5px; font-weight: 700; color: var(--vm-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.iit-status { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: #059669; margin-top: 2px; }
.iit-chev { width: 16px; height: 16px; color: var(--vm-ink-faint); flex-shrink: 0; }
</style>

