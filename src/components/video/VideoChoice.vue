<template>
  <!-- One setting of the chosen video model (shape, length, resolution), as a pill that opens a panel like the model
       picker (owner, 2026-10-20: no raw browser lists). Only the values the model offers are passed in, so switching
       model changes what is offered. A setting with a single value is shown as a fact, not a dropdown of one. In the
       phone settings sheet the panel opens in place. -->
  <div ref="root" class="vch" :class="{ 'in-sheet': inSheet }" @keydown.esc.stop="close">
    <span v-if="options.length === 1" class="vch-pill fixed" :title="`${label}: ${current.label}, the only one this model offers`"
          :data-test="testId" :aria-label="`${label}: ${current.label}, the only one this model offers`">
      <span class="vch-ic" aria-hidden="true" v-html="icon"></span>
      <span v-if="inSheet" class="vch-label">{{ label }}</span>
      <span class="vch-text">{{ current.label }}</span>
    </span>
    <template v-else>
      <button ref="trigger" type="button" class="vch-pill" :data-test="testId" aria-haspopup="listbox" :aria-expanded="open ? 'true' : 'false'"
              :aria-label="`${label}: ${current.label}`" :title="label" @click="toggle">
        <span class="vch-ic" aria-hidden="true" v-html="icon"></span>
        <span v-if="inSheet" class="vch-label">{{ label }}</span>
        <span class="vch-text">{{ current.label }}</span>
        <span class="vch-chev" aria-hidden="true" v-html="CHEV"></span>
      </button>
      <div v-if="open" class="vch-panel" :class="'is-' + layout" role="listbox" :aria-label="label" :data-test="testId + '-panel'" @keydown="onKey">
        <p class="vch-title">{{ label }}</p>
        <div class="vch-options">
          <button v-for="o in options" :key="o.value" type="button" role="option" class="vch-opt" :class="{ on: isOn(o) }"
                  :aria-selected="isOn(o) ? 'true' : 'false'" :data-value="o.value" @click="choose(o)">
            <span v-if="o.glyph" class="vch-glyph" aria-hidden="true" v-html="o.glyph"></span>
            <span class="vch-opt-main">
              <span class="vch-opt-label">{{ o.label }}</span>
              <span v-if="o.hint && layout === 'list'" class="vch-opt-hint">{{ o.hint }}</span>
            </span>
            <span v-if="isOn(o) && layout === 'list'" class="vch-check" aria-hidden="true" v-html="CHECK"></span>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  // [{ value, label, hint?, glyph? }] — only what the chosen model offers.
  options: { type: Array, default: () => [] },
  label: { type: String, required: true },
  icon: { type: String, default: '' },
  // 'list' (one per row, with a hint) or 'grid' (many short values, e.g. seconds).
  layout: { type: String, default: 'list' },
  inSheet: { type: Boolean, default: false },
  testId: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])
const root = ref(null)
const trigger = ref(null)
const open = ref(false)
const CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10l5 5 5-5"/></svg>'
const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'

function isOn(o) { return String(o.value) === String(props.modelValue) }
const current = computed(() => props.options.find(isOn) || props.options[0] || { label: '' })

async function toggle() {
  open.value = !open.value
  if (!open.value) return
  await nextTick()
  const on = root.value && (root.value.querySelector('.vch-opt.on') || root.value.querySelector('.vch-opt'))
  on && on.focus()
}
function close() { if (open.value) { open.value = false; trigger.value && trigger.value.focus() } }
function choose(o) {
  emit('update:modelValue', o.value)
  close()
}
function onKey(e) {
  const keys = ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End']
  if (!keys.includes(e.key)) return
  e.preventDefault()
  const list = Array.from(root.value.querySelectorAll('.vch-opt'))
  const i = list.indexOf(document.activeElement)
  const next = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1
    : i + (['ArrowDown', 'ArrowRight'].includes(e.key) ? 1 : -1)
  const el = list[Math.max(0, Math.min(next, list.length - 1))]
  el && el.focus()
}
function onOutside(e) { if (open.value && root.value && !root.value.contains(e.target)) open.value = false }
onMounted(() => document.addEventListener('pointerdown', onOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside))
</script>

<style scoped>
.vch { position: relative; min-width: 0; max-width: 100%; }
.vch-pill { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; max-width: 100%; padding: 0 10px; box-sizing: border-box;
  border: 1px solid var(--vm-line, #dce3ee); border-radius: 999px; background: transparent; color: var(--vm-ink, #0f172a); font: inherit; font-size: 13px;
  cursor: pointer; white-space: nowrap; }
button.vch-pill:hover, .vch-pill[aria-expanded="true"] { background: var(--vm-surface, #f1f5f9); }
.vch-pill.fixed { cursor: default; color: var(--vm-ink-soft, #64748b); border-style: dashed; }
.vch-ic { width: 16px; height: 16px; flex-shrink: 0; color: var(--vm-ink-soft, #64748b); }
.vch-ic :deep(svg), .vch-chev :deep(svg), .vch-check :deep(svg), .vch-glyph :deep(svg) { display: block; width: 100%; height: 100%; }
.vch-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
.vch-label { flex: 0 0 96px; color: var(--vm-ink-soft, #64748b); text-align: left; }
.vch-chev { width: 12px; height: 12px; flex-shrink: 0; margin-left: 2px; color: var(--vm-ink-soft, #64748b); }

.vch-panel { position: absolute; left: 0; bottom: calc(100% + 8px); z-index: 40; min-width: 200px; max-height: min(420px, 60vh); overflow-y: auto; padding: 6px;
  border: 1px solid var(--vm-line, #dce3ee); border-radius: 10px; background: var(--vm-surface, #fff); box-shadow: var(--vm-shadow-l, 0 14px 34px rgba(15, 23, 42, .14)); }
.vch-panel.is-grid { width: 264px; }
.vch-title { margin: 2px 6px 6px; font-size: 12px; font-weight: 600; color: var(--vm-ink-soft, #64748b); }
.vch-options { display: grid; gap: 2px; }
.is-grid .vch-options { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 4px; }
.vch-opt { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 40px; padding: 6px 10px; box-sizing: border-box; border: 0; border-radius: 6px;
  background: transparent; color: var(--vm-ink, #0f172a); font: inherit; font-size: 13.5px; text-align: left; cursor: pointer; }
.is-grid .vch-opt { justify-content: center; padding: 0; font-variant-numeric: tabular-nums; border: 1px solid var(--vm-line-2, #e5e7eb); }
.vch-opt:hover, .vch-opt:focus-visible { background: var(--vm-surface-2, #f1f5f9); outline: none; }
.vch-opt:focus-visible { box-shadow: inset 0 0 0 2px var(--vm-violet, #4f46e5); }
.vch-opt.on { background: var(--vm-violet-soft, #eef2ff); }
.is-grid .vch-opt.on { border-color: var(--vm-violet, #4f46e5); }
.vch-glyph { width: 22px; height: 18px; flex-shrink: 0; color: var(--vm-ink-soft, #64748b); }
.vch-opt.on .vch-glyph { color: var(--vs-accent-ink, var(--vm-violet-d, #4f46e5)); }
.vch-opt-main { display: grid; gap: 1px; min-width: 0; flex: 1; }
.is-grid .vch-opt-main { flex: none; }
.vch-opt-label { font-weight: 500; font-variant-numeric: tabular-nums; }
.vch-opt-hint { font-size: 12px; color: var(--vm-ink-soft, #64748b); }
.vch-check { width: 16px; height: 16px; flex-shrink: 0; color: var(--vs-accent-ink, var(--vm-violet-d, #4f46e5)); }
.vch-pill:focus-visible { outline: 2px solid var(--vm-violet, #4f46e5); outline-offset: 2px; }

/* In the phone settings sheet: a full-width labelled row; the panel opens in place below it. */
.vch.in-sheet { width: 100%; }
.vch.in-sheet .vch-pill { width: 100%; max-width: none; min-height: 48px; border-radius: 8px; }
.vch.in-sheet .vch-text { flex: 1; text-align: left; }
.vch.in-sheet .vch-panel { position: static; width: 100%; max-height: 46vh; margin-top: 8px; box-shadow: none; }
@media (pointer: coarse) { .vch-pill { min-height: 44px; } .vch-opt { min-height: 44px; } }
</style>
