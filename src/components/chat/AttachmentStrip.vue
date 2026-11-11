<template>
  <!-- The files to send with the next message, as every chat composer shows them (ADM-1205 phase E: one copy). -->
  <ul v-if="attachments.length" class="attach-strip" aria-label="Attached files">
    <li v-for="(a, i) in attachments" :key="`${a.name}-${i}`" class="attach-chip">
      <img v-if="a.isImage && a.url" :src="a.url" class="attach-thumb" :alt="a.name" width="32" height="32" />
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="attach-fileicon" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
      <span class="attach-name" :title="a.name">{{ a.name }}</span>
      <button type="button" class="attach-x" :aria-label="`Remove ${a.name}`" title="Remove" @click="$emit('remove', i)">×</button>
    </li>
  </ul>
</template>

<script setup>
defineProps({ attachments: { type: Array, default: () => [] } })
defineEmits(['remove'])
</script>

<style scoped>
.attach-strip { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0 4px 8px; list-style: none; }
.attach-chip {
  display: inline-flex; align-items: center; gap: 6px; max-width: 220px; min-width: 0;
  padding: 4px 6px 4px 4px; background: var(--vm-bg); border: 1px solid var(--vm-line); border-radius: 10px;
}
.attach-thumb { width: 32px; height: 32px; object-fit: cover; border-radius: 6px; flex-shrink: 0; }
.attach-fileicon { width: 22px; height: 22px; color: var(--vm-ink-soft); flex-shrink: 0; }
.attach-name { font-size: 0.75rem; color: var(--vm-ink-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.attach-x {
  flex-shrink: 0; width: 18px; height: 18px; line-height: 1; border: none; border-radius: 9999px;
  background: var(--vm-line-2); color: var(--vm-ink-soft); font-size: 14px; cursor: pointer; touch-action: manipulation;
  transition: background-color .15s, color .15s;
}
.attach-x:hover { background: color-mix(in srgb, var(--vm-ink) 18%, transparent); color: var(--vm-ink); }
.attach-x:focus-visible { outline: 2px solid var(--vm-focus, var(--vm-violet)); outline-offset: 1px; }
@media (pointer: coarse) { .attach-x { width: 32px; height: 32px; } }
</style>
