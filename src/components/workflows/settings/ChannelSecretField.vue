<!--
  The signing secret of a channel trigger (ADM-1333, backend B9): `data.secret_var` names one of the workflow's SECRET
  variables (only those are offered; a secret's value is never shown). Slack and Telegram sign their deliveries; with
  no secret chosen, every delivery is refused (403 `signature_not_configured`). Validate reports that as the warning
  `config.secret_missing`, and a name that is not a secret variable as the error `config.secret_var_unknown`; both
  show here, beside the field.
-->
<template>
  <div class="csf">
    <label class="csf-label" :for="`${uid}-sel`">Signing secret</label>
    <select
      :id="`${uid}-sel`" class="csf-in" :value="current" :aria-describedby="`${uid}-help`"
      :aria-invalid="errors.length ? 'true' : undefined"
      @change="pick($event.target.value)"
    >
      <option value="">No secret chosen</option>
      <option v-if="current && !names.includes(current)" :value="current">{{ current }} (not a secret variable)</option>
      <option v-for="n in names" :key="n" :value="n">{{ n }}</option>
    </select>
    <p :id="`${uid}-help`" class="csf-help">Slack: the app's signing secret. Telegram: the webhook secret token.</p>
    <p v-if="!names.length" class="csf-help">This workflow has no secret variables yet. Add one in the workflow's variables and mark it secret.</p>
    <p v-for="w in warnings" :key="`w-${w.message}`" class="csf-msg csf-msg--warn">
      <Icon icon="lucide:triangle-alert" aria-hidden="true" /><span>{{ w.message }}</span>
    </p>
    <p v-for="e in errors" :key="`e-${e.message}`" class="csf-msg csf-msg--err" role="alert">
      <Icon icon="lucide:circle-alert" aria-hidden="true" /><span>{{ e.message }}</span>
    </p>
  </div>
</template>

<script setup>
import { computed, useId } from 'vue'
import { Icon } from '@iconify/vue'
import { useNodeEditor } from './nodeEditor'

const editor = useNodeEditor()
const uid = `csf-${useId()}`
const names = computed(() => editor.lists.value.secretVars)
const current = computed(() => String(editor.data.value.secret_var || ''))

const here = computed(() => editor.issues.value.filter((i) => i.path === 'data.secret_var'
  || i.code === 'config.secret_missing' || i.code === 'config.secret_var_unknown'))
const warnings = computed(() => here.value.filter((i) => i.level === 'warning'))
const errors = computed(() => here.value.filter((i) => i.level === 'error'))

function pick(name) { editor.set('secret_var', name || undefined, 'Signing secret') }
</script>

<style scoped>
.csf { display: grid; gap: 5px; }
.csf-label { font-size: 12px; font-weight: 600; color: var(--vm-ink-soft); }
.csf-in {
  width: 100%; min-height: 34px; padding: 6px 8px; border: 1px solid var(--vm-line-2); border-radius: 6px;
  background-color: var(--vm-surface); color: var(--vm-ink); font: inherit; font-size: 13px;
}
.csf-in[aria-invalid='true'] { border-color: var(--vm-red-ink); }
.csf-in:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.csf-help { margin: 0; font-size: 12px; line-height: 1.5; color: var(--vm-ink-faint); }
.csf-msg { display: flex; gap: 6px; align-items: flex-start; margin: 0; padding: 7px 9px; border-radius: 6px; font-size: 12px; line-height: 1.45; }
.csf-msg :deep(svg) { width: 14px; height: 14px; flex-shrink: 0; margin-top: 2px; }
.csf-msg--warn { background: var(--vm-amber-soft); color: var(--vm-amber-ink); }
.csf-msg--err { background: var(--vm-red-soft); color: var(--vm-red-ink); }
@media (pointer: coarse) { .csf-in { min-height: 44px; } }
</style>
