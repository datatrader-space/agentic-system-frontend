<!--
  The address a trigger receives requests on (webhook, channel, connector), with Copy (ADM-1333, F14).

  F14: the old Copy said "Copied" even when there was nothing to copy (no address before the first save) or the copy
  failed. Now "Copied" shows only after navigator.clipboard.writeText resolves. When it fails, or the browser has no
  clipboard, the window says so and shows the address in a selected read-only field to copy by hand. Before the first
  save there is no address and no Copy button.
-->
<template>
  <div class="iu">
    <span class="iu-label" :id="`${uid}-label`">{{ label }}</span>
    <template v-if="address">
      <div class="iu-row">
        <code class="iu-addr" translate="no" :aria-labelledby="`${uid}-label`">{{ method ? `${method} ` : '' }}{{ address }}</code>
        <button type="button" class="iu-btn" :aria-label="`Copy the ${label.toLowerCase()}`" @click="copy">
          <Icon :icon="state === 'copied' ? 'lucide:check' : 'lucide:copy'" aria-hidden="true" />
          <span>{{ state === 'copied' ? 'Copied' : 'Copy' }}</span>
        </button>
      </div>
      <p class="iu-status" role="status">{{ state === 'copied' ? 'The address is on your clipboard.' : '' }}</p>
      <div v-if="state === 'failed'" class="iu-fail" role="alert">
        <p>The address could not be copied ({{ failReason }}). Select it below and copy it yourself.</p>
        <label class="sr-only" :for="`${uid}-manual`">{{ label }}</label>
        <input :id="`${uid}-manual`" ref="manualEl" class="iu-manual" type="text" readonly :value="address" @focus="$event.target.select()">
      </div>
    </template>
    <p v-else class="iu-empty">{{ emptyText }}</p>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, useId, watch } from 'vue'
import { Icon } from '@iconify/vue'

const props = defineProps({
  // The stored path (`/api/workflow-graph-hooks/…/`) or a full URL; empty before the first save.
  path: { type: String, default: '' },
  label: { type: String, default: 'Address' },
  method: { type: String, default: '' },
  // Said when there is no address: before the first save, or (ADM-1339) when the person's role is not shown it.
  emptyText: { type: String, default: 'Save the workflow to get the address.' },
})
const uid = `iu-${useId()}`
const state = ref('idle')          // idle | copied | failed
const failReason = ref('')
const manualEl = ref(null)

// A path is shown and copied as a full address on this site, which is what the sender needs.
const address = computed(() => {
  const p = props.path || ''
  if (!p) return ''
  if (/^https?:\/\//i.test(p)) return p
  return typeof window !== 'undefined' ? `${window.location.origin}${p.startsWith('/') ? '' : '/'}${p}` : p
})
watch(address, () => { state.value = 'idle' })

let resetTimer = null
async function copy() {
  clearTimeout(resetTimer)
  state.value = 'idle'
  const clip = typeof navigator !== 'undefined' ? navigator.clipboard : null
  if (!clip || typeof clip.writeText !== 'function') {
    fail('this browser does not allow it here')
    return
  }
  try {
    await clip.writeText(address.value)
    state.value = 'copied'
    resetTimer = setTimeout(() => { if (state.value === 'copied') state.value = 'idle' }, 2500)
  } catch (e) {
    fail(e?.name === 'NotAllowedError' ? 'the browser refused access to the clipboard' : 'the clipboard is not available')
  }
}
function fail(reason) {
  failReason.value = reason
  state.value = 'failed'
  nextTick(() => manualEl.value?.focus())
}
</script>

<style scoped>
.iu { display: grid; gap: 5px; min-width: 0; }
.iu-label { font-size: 12px; font-weight: 600; color: var(--vm-ink-soft); }
.iu-row { display: flex; gap: 6px; align-items: stretch; min-width: 0; }
.iu-addr {
  flex: 1; min-width: 0; padding: 7px 9px; border: 1px solid var(--vm-line-2); border-radius: 6px; background: var(--vm-surface-soft);
  font-family: var(--vm-font-mono, ui-monospace, monospace); font-size: 12px; color: var(--vm-ink); overflow-wrap: anywhere;
}
.iu-btn {
  display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; min-height: 34px; padding: 6px 10px;
  border: 1px solid var(--vm-line-2); border-radius: 6px; background: var(--vm-surface); color: var(--vm-ink-soft);
  font: inherit; font-size: 12px; cursor: pointer;
}
.iu-btn:hover { background: var(--vm-surface-soft); color: var(--vm-ink); }
.iu-btn:focus-visible, .iu-manual:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.iu-btn :deep(svg) { width: 14px; height: 14px; }
.iu-status { margin: 0; min-height: 0; font-size: 12px; color: var(--vm-green-ink); }
.iu-fail { display: grid; gap: 6px; padding: 8px 10px; border-radius: 6px; background: var(--vm-red-soft); }
.iu-fail p { margin: 0; font-size: 12px; color: var(--vm-red-ink); }
.iu-manual {
  width: 100%; min-height: 34px; padding: 6px 8px; border: 1px solid var(--vm-line-2); border-radius: 6px;
  background: var(--vm-surface); color: var(--vm-ink); font-family: var(--vm-font-mono, ui-monospace, monospace); font-size: 12px;
}
.iu-empty { margin: 0; font-size: 12px; color: var(--vm-ink-faint); }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
@media (pointer: coarse) { .iu-btn, .iu-manual { min-height: 44px; } }
</style>
