<script setup>
// How far a download on the person's own machine is (backend machines.download_progress; owner, 2026-11-11: "add real
// progress so user can know"). The words are in the stage's own label beside it ("Downloading SAM 3: weights, 1.2 GB of
// 3.4 GB (35%)"); this is the bar, shown only while the total is known. A machine gone quiet is said in the words.
defineProps({ download: { type: Object, default: null } });
</script>

<template>
  <div v-if="download && download.percent !== null && download.percent !== undefined" class="download-bar">
    <progress max="100" :value="download.percent" :aria-label="`Downloaded: ${download.percent}%`"></progress>
    <span class="download-percent" aria-hidden="true">{{ download.percent }}%</span>
  </div>
</template>

<style scoped>
.download-bar { display: flex; align-items: center; gap: 10px; margin: 6px 0 10px; max-width: 520px; }
.download-bar progress { flex: 1; height: 8px; appearance: none; border: 0; border-radius: 999px; overflow: hidden;
  background: var(--aadml-tint, #e8effd); }
.download-bar progress::-webkit-progress-bar { background: var(--aadml-tint, #e8effd); border-radius: 999px; }
.download-bar progress::-webkit-progress-value { background: var(--aadml-primary, #2563eb); border-radius: 999px;
  transition: width 300ms ease; }
.download-bar progress::-moz-progress-bar { background: var(--aadml-primary, #2563eb); border-radius: 999px; }
.download-percent { font-size: 13px; font-variant-numeric: tabular-nums; color: var(--aadml-navy, #0f172a); min-width: 3ch; }
@media (prefers-reduced-motion: reduce) { .download-bar progress::-webkit-progress-value { transition: none; } }
</style>
