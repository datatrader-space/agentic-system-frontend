<script setup>
/**
 * Shared ingestion-status badge for the unified MarkItDown document pipeline.
 * Renders one of: uploaded → queued → converting → chunking → embedding → ready | failed.
 * Used by both the chat attachment strip and the agent Knowledge Base list so the states line up
 * with the backend DocumentSource.conversion_status vocabulary.
 */
import { computed } from 'vue'

const props = defineProps({
  status: { type: String, default: 'queued' },
  error: { type: String, default: '' },
  compact: { type: Boolean, default: false },
})

const MAP = {
  uploaded:   { label: 'Uploaded',   cls: 'is-wait', busy: true },
  queued:     { label: 'Queued',     cls: 'is-wait', busy: true },
  pending:    { label: 'Preparing',  cls: 'is-wait', busy: true },
  converting: { label: 'Converting', cls: 'is-busy', busy: true },
  reading:    { label: 'Converting', cls: 'is-busy', busy: true },
  chunking:   { label: 'Chunking',   cls: 'is-busy', busy: true },
  embedding:  { label: 'Embedding',  cls: 'is-busy', busy: true },
  ready:      { label: 'Ready',      cls: 'is-ok',   busy: false },
  failed:     { label: 'Failed',     cls: 'is-err',  busy: false },
}

const info = computed(() => MAP[props.status] || MAP.queued)
const title = computed(() => (props.status === 'failed' && props.error) ? props.error : info.value.label)
</script>

<template>
  <span class="isb" :class="info.cls" :title="title" :data-test="`status-${status}`">
    <span v-if="info.busy" class="isb-dot" aria-hidden="true"></span>
    <span v-else-if="status === 'ready'" class="isb-ico" aria-hidden="true">✓</span>
    <span v-else class="isb-ico" aria-hidden="true">!</span>
    <span v-if="!compact" class="isb-label">{{ info.label }}</span>
  </span>
</template>

<style scoped>
.isb { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700;
  padding: 2px 8px; border-radius: 999px; line-height: 1.6; white-space: nowrap; }
.isb-label { letter-spacing: .01em; }
.is-wait { background: #eef2f7; color: #64748b; }
.is-busy { background: #eff6ff; color: #1d4ed8; }
.is-ok   { background: #ecfdf3; color: #067647; }
.is-err  { background: #fef2f2; color: #dc2626; }
.isb-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor;
  animation: isb-pulse 1s ease-in-out infinite; }
.isb-ico { font-weight: 900; }
@keyframes isb-pulse { 0%,100% { opacity: .35; } 50% { opacity: 1; } }
</style>
