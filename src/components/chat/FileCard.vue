<template>
  <!-- A file the agent wrote, under its message (as ChatGPT and Claude show a document they made): the file's name and
       what it is; the whole card opens it. Reused for any file an agent hands the person, the plan in plan mode first. -->
  <button type="button" class="fcard" :title="path || name" :aria-label="`Open ${name}`" @click="emit('open')">
    <span class="fcard-tile" aria-hidden="true"><Icon :icon="icon" /></span>
    <span class="fcard-text">
      <span class="fcard-name" translate="no">{{ name }}</span>
      <span v-if="subtitle" class="fcard-sub">{{ subtitle }}</span>
    </span>
    <Icon icon="lucide:panel-right-open" class="fcard-go" aria-hidden="true" />
  </button>
</template>

<script setup>
import { Icon } from '@iconify/vue'

defineProps({
  // The file's name as the person reads it ("2026-11-19-add-a-size-guide-3452fc64.md").
  name: { type: String, required: true },
  // What it is and where it lives ("Plan · docs/plans").
  subtitle: { type: String, default: '' },
  // The full path, shown on hover.
  path: { type: String, default: '' },
  icon: { type: String, default: 'lucide:file-text' },
})
const emit = defineEmits(['open'])
</script>

<style scoped>
.fcard { display: flex; align-items: center; gap: 12px; width: 100%; max-width: 420px; min-height: 56px; margin: 10px 0 2px;
         padding: 8px 12px 8px 8px; box-sizing: border-box; border: 1px solid var(--vm-line-2); border-radius: 12px;
         background: var(--vm-surface); color: var(--vm-ink); text-align: left; cursor: pointer;
         transition: border-color .15s, background-color .15s; }
.fcard:hover { border-color: var(--vm-violet); background: var(--vm-surface-soft); }
.fcard:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 2px; }
.fcard-tile { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; width: 40px; height: 40px;
              border-radius: 10px; background: var(--vm-violet-soft, var(--vm-surface-soft)); color: var(--vm-violet); }
.fcard-tile :deep(svg) { width: 20px; height: 20px; }
.fcard-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1 1 auto; }
.fcard-name { font-size: 14px; font-weight: 600; line-height: 1.3; color: var(--vm-ink);
              overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fcard-sub { font-size: 12.5px; line-height: 1.3; color: var(--vm-ink-soft);
             overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fcard-go { flex: 0 0 auto; width: 16px; height: 16px; color: var(--vm-ink-soft); }
.fcard:hover .fcard-go { color: var(--vm-violet); }
@media (prefers-reduced-motion: reduce) { .fcard { transition: none; } }
</style>
