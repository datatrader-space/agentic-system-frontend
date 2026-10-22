<template>
  <div class="load-error" :class="{ 'load-error--compact': compact }" role="alert">
    <p class="load-error__title">{{ title }}</p>
    <p v-if="message" class="load-error__message">{{ message }}</p>
    <button
      v-if="retryable"
      type="button"
      class="load-error__retry"
      :disabled="retrying"
      @click="$emit('retry')"
    >
      {{ retrying ? 'Retrying…' : retryText }}
    </button>
  </div>
</template>

<script setup>
// The one "this did not load" state (page-speed plan F-M9/F-H10): a failed load shows this with Retry,
// never an empty list ("No X yet") or made-up data that looks like a real result.
defineProps({
  title: { type: String, default: "Couldn't load this" },
  message: { type: String, default: '' },
  retryText: { type: String, default: 'Retry' },
  retryable: { type: Boolean, default: true },
  retrying: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
})
defineEmits(['retry'])
</script>

<style scoped>
.load-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 16px;
  text-align: center;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-card);
}
.load-error--compact {
  padding: 12px;
  gap: 6px;
}
.load-error__title {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
}
.load-error__message {
  margin: 0;
  max-width: 48ch;
  font-size: var(--text-xs);
  color: var(--text-muted);
}
.load-error__retry {
  margin-top: 4px;
  padding: 6px 14px;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  background: transparent;
  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
}
.load-error__retry:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
}
.load-error__retry:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
.load-error__retry:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
