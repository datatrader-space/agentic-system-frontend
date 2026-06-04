<template>
  <button
    v-if="nav.canGoBack || alwaysShow"
    @click="handleBack"
    class="back-button group"
    :class="[variant === 'ghost' ? 'back-button--ghost' : 'back-button--default', sizeClass]"
    :title="label || 'Back'"
  >
    <svg class="back-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 12H5m0 0l7 7m-7-7l7-7" />
    </svg>
    <span v-if="showLabel && labelText" class="back-label">{{ labelText }}</span>
  </button>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useNavigationHistory } from '../composables/useNavigationHistory'

const props = defineProps({
  fallback: { type: String, default: '/agents' },
  label: { type: String, default: '' },
  showLabel: { type: Boolean, default: true },
  variant: { type: String, default: 'default' }, // 'default' | 'ghost'
  size: { type: String, default: 'md' }, // 'sm' | 'md'
  alwaysShow: { type: Boolean, default: true },
})

const router = useRouter()
const nav = useNavigationHistory()

const labelText = computed(() => {
  if (props.label) return props.label
  return nav.previousLabel || 'Back'
})

const sizeClass = computed(() =>
  props.size === 'sm' ? 'back-button--sm' : 'back-button--md'
)

const handleBack = () => {
  nav.goBack(router, props.fallback)
}
</script>

<style scoped>
.back-button {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-weight: 600;
  border-radius: 9999px;
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
  outline: none;
  flex-shrink: 0;
}

.back-button--md {
  padding: 0.375rem 0.75rem;
}

.back-button--sm {
  padding: 0.25rem 0.5rem;
}

.back-button--default {
  background: rgba(0, 0, 0, 0.04);
  color: #374151;
}

.back-button--default:hover {
  background: rgba(0, 0, 0, 0.08);
  color: #111827;
}

.back-button--ghost {
  background: transparent;
  color: #6b7280;
}

.back-button--ghost:hover {
  background: rgba(0, 0, 0, 0.04);
  color: #111827;
}

.back-icon {
  width: 1.125rem;
  height: 1.125rem;
  flex-shrink: 0;
  transition: transform 0.15s ease;
}

.back-button:hover .back-icon {
  transform: translateX(-2px);
}

.back-label {
  font-size: 0.8125rem;
  line-height: 1;
  white-space: nowrap;
}

.back-button--sm .back-icon {
  width: 0.875rem;
  height: 0.875rem;
}

.back-button--sm .back-label {
  font-size: 0.75rem;
}
</style>
