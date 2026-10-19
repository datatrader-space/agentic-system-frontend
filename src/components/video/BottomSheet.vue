<template>
  <!-- Below 1024px (plan 4.4) the content opens in a bottom sheet from its trigger button; wider, it renders in
       place and the trigger is not shown. One component, so a control has one markup in both layouts. -->
  <div class="bs-host">
    <template v-if="narrow">
      <button ref="triggerEl" type="button" class="bs-trigger" :data-test="testId ? testId + '-open' : null"
              :aria-expanded="open ? 'true' : 'false'" @click="show">
        <span class="bs-trigger-label">{{ label }}</span><span v-if="summary" class="bs-trigger-sum">{{ summary }}</span>
      </button>
      <Teleport to="body">
        <div v-if="open" class="bs-backdrop" @click.self="hide">
          <section ref="sheetEl" class="bs-sheet" role="dialog" aria-modal="true" :aria-label="label"
                   :data-test="testId" tabindex="-1" @keydown.esc.prevent="hide">
            <header class="bs-head">
              <h2 class="bs-title">{{ label }}</h2>
              <button type="button" class="bs-close" aria-label="Close" @click="hide">×</button>
            </header>
            <div class="bs-body"><slot :sheet="true" /></div>
          </section>
        </div>
      </Teleport>
    </template>
    <slot v-else :sheet="false" />
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  summary: { type: String, default: '' },
  testId: { type: String, default: '' },
  breakpoint: { type: Number, default: 1024 },
})
const open = ref(false)
const triggerEl = ref(null)
const sheetEl = ref(null)
const query = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia(`(max-width: ${props.breakpoint - 1}px)`) : null
const narrow = ref(!!(query && query.matches))
function onChange(e) { narrow.value = e.matches; if (!e.matches) open.value = false }

async function show() {
  open.value = true
  await nextTick()
  const first = sheetEl.value && sheetEl.value.querySelector('button, select, input, textarea, [tabindex]:not([tabindex="-1"])')
  ;(first || sheetEl.value)?.focus()
}
function hide() {
  open.value = false
  nextTick(() => triggerEl.value?.focus())
}
defineExpose({ hide, show })
onMounted(() => { if (query) query.addEventListener ? query.addEventListener('change', onChange) : query.addListener(onChange) })
onBeforeUnmount(() => { if (query) query.removeEventListener ? query.removeEventListener('change', onChange) : query.removeListener(onChange) })
</script>

<style scoped>
.bs-host { min-width: 0; }
.bs-trigger { width: 100%; min-height: 44px; display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 0 14px; border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 12px; background: var(--vm-surface-2, #f8fafc);
  color: var(--vm-ink, #0f172a); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; text-align: left; }
.bs-trigger-sum { color: var(--vm-ink-soft, #64748b); font-weight: 400; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bs-trigger:focus-visible, .bs-close:focus-visible { outline: 2px solid var(--vm-violet-d, #4f46e5); outline-offset: 2px; }
.bs-backdrop { position: fixed; inset: 0; z-index: 2000; background: rgba(15, 23, 42, .45); display: flex; align-items: flex-end; }
.bs-sheet { width: 100%; max-height: 85dvh; display: flex; flex-direction: column; background: var(--vm-surface, #fff);
  border-radius: 18px 18px 0 0; box-shadow: 0 -12px 40px rgba(15, 23, 42, .25); padding-bottom: env(safe-area-inset-bottom); outline: none; }
.bs-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 8px 8px 18px;
  border-bottom: 1px solid var(--vm-line-2, #e5e7eb); }
.bs-title { margin: 0; font-size: 15px; color: var(--vm-ink, #0f172a); }
.bs-close { min-width: 44px; min-height: 44px; border: none; background: transparent; font-size: 22px; cursor: pointer; color: var(--vm-ink-soft, #64748b); }
.bs-body { overflow-y: auto; padding: 16px 18px 20px; display: grid; gap: 12px; }
@media (prefers-reduced-motion: no-preference) { .bs-sheet { animation: bs-up .18s ease-out; } }
@keyframes bs-up { from { transform: translateY(24px); opacity: .6; } to { transform: none; opacity: 1; } }
</style>
