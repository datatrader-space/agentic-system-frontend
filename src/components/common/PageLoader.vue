<template>
  <div class="page-loader" :style="minHeight ? { minHeight } : null" role="status" aria-live="polite">
    <span class="page-loader__spin" :style="{ width: size, height: size }"></span>
    <span v-if="label" class="page-loader__label">{{ label }}</span>
  </div>
</template>

<script setup>
/**
 * Consistent full-area loading spinner shown while a page/panel fetches its data.
 * Theme-agnostic (plain CSS, no design-token dependency) so it looks right on every
 * page — the Vibrant-Mesh agent pages and the Tailwind settings/admin pages alike.
 */
defineProps({
  label: { type: String, default: 'Loading…' },
  size: { type: String, default: '30px' },
  // Optional fixed area height so the spinner sits centered instead of hugging the top.
  minHeight: { type: String, default: '240px' },
})
</script>

<style scoped>
.page-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  padding: 32px 0;
  color: #64748b; /* slate-500 */
}
.page-loader__spin {
  border-radius: 50%;
  border: 3px solid rgba(99, 102, 241, 0.18); /* indigo-500 @ low alpha */
  border-top-color: #6366f1;                   /* indigo-500 */
  animation: pageLoaderSpin 0.8s linear infinite;
}
.page-loader__label {
  font-size: 13px;
  font-weight: 500;
}
@keyframes pageLoaderSpin { to { transform: rotate(360deg); } }
</style>
