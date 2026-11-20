<!--
  Retries, backoff, timeout and on-error for a step (ADM-1333). Numbers are saved as numbers within the engine's
  bounds (F5); a timeout must be more than 0 seconds (schemas.py `timeout.invalid`), or empty for none.
-->
<template>
  <section class="rs" :aria-labelledby="`${uid}-h`">
    <button
      :id="`${uid}-h`" type="button" class="rs-toggle" :aria-expanded="open ? 'true' : 'false'" :aria-controls="`${uid}-body`"
      @click="open = !open"
    >
      <Icon :icon="open ? 'lucide:chevron-down' : 'lucide:chevron-right'" aria-hidden="true" />Reliability
      <span v-if="summary" class="rs-sum">{{ summary }}</span>
    </button>
    <div v-show="open" :id="`${uid}-body`" class="rs-body">
      <div class="rs-field">
        <label class="rs-label" :for="`${uid}-retries`">Retries</label>
        <NumberField :id="`${uid}-retries`" label="Retries" :model-value="d.retries ?? null" :min="0" :max="5" integer optional placeholder="0"
          @update:model-value="(v) => editor.set('retries', v ?? undefined, 'Retries')" />
      </div>
      <div class="rs-field">
        <label class="rs-label" :for="`${uid}-backoff`">Retry backoff (seconds)</label>
        <NumberField :id="`${uid}-backoff`" label="Retry backoff" :model-value="d.retry_backoff_seconds ?? null" :min="0" :max="30" optional placeholder="0"
          @update:model-value="(v) => editor.set('retry_backoff_seconds', v ?? undefined, 'Retry backoff')" />
      </div>
      <div class="rs-field">
        <label class="rs-label" :for="`${uid}-timeout`">Timeout (seconds)</label>
        <NumberField :id="`${uid}-timeout`" label="Timeout" :model-value="d.timeout_seconds ?? null" :min="0" min-exclusive optional placeholder="None"
          @update:model-value="(v) => editor.set('timeout_seconds', v ?? undefined, 'Timeout')" />
      </div>
      <div class="rs-field">
        <label class="rs-label" :for="`${uid}-onerr`">When the step fails</label>
        <select :id="`${uid}-onerr`" class="rs-in" :value="d.on_error || 'stop'" @change="editor.set('on_error', $event.target.value, 'When the step fails')">
          <option value="stop">Stop the run</option>
          <option value="continue">Continue with the next steps</option>
        </select>
      </div>
      <p class="rs-help">Or connect the step's on-error handle on the canvas to send failures to a recovery step.</p>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, useId } from 'vue'
import { Icon } from '@iconify/vue'
import NumberField from './NumberField.vue'
import { useNodeEditor } from './nodeEditor'

const editor = useNodeEditor()
const uid = `rs-${useId()}`
const d = computed(() => editor.data.value)
const summary = computed(() => [
  d.value.retries ? `${d.value.retries} ${d.value.retries === 1 ? 'retry' : 'retries'}` : '',
  d.value.timeout_seconds ? `timeout ${d.value.timeout_seconds} s` : '',
  d.value.on_error === 'continue' ? 'continues on error' : '',
].filter(Boolean).join(' · '))
const open = ref(!!summary.value)
</script>

<style scoped>
.rs { border-top: 1px solid var(--vm-line); padding-top: 10px; }
.rs-toggle {
  display: flex; align-items: center; gap: 6px; width: 100%; min-height: 32px; padding: 4px 2px; border: 0; background: none;
  color: var(--vm-ink); font: inherit; font-size: 13px; font-weight: 600; text-align: left; cursor: pointer; border-radius: 6px;
}
.rs-toggle :deep(svg) { width: 16px; height: 16px; color: var(--vm-ink-faint); }
.rs-toggle:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.rs-sum { margin-left: auto; font-size: 12px; font-weight: 400; color: var(--vm-ink-faint); }
.rs-body { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; padding-top: 8px; }
.rs-field { display: grid; gap: 5px; align-content: start; }
.rs-label { font-size: 12px; font-weight: 600; color: var(--vm-ink-soft); }
.rs-in {
  width: 100%; min-height: 34px; padding: 6px 8px; border: 1px solid var(--vm-line-2); border-radius: 6px;
  background-color: var(--vm-surface); color: var(--vm-ink); font: inherit; font-size: 13px;
}
.rs-in:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.rs-help { grid-column: 1 / -1; margin: 0; font-size: 12px; color: var(--vm-ink-faint); }
@media (pointer: coarse) { .rs-toggle, .rs-in { min-height: 44px; } }
</style>
