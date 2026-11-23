<template>
  <Teleport to="body">
    <div v-if="open" class="es-scrim" @mousedown="emit('close')" />
    <div v-if="open" ref="panel" class="es" role="dialog" aria-modal="false" aria-labelledby="es-title"
         :data-theme="ideTheme" :style="{ left: `${pos.x}px`, top: `${pos.y}px` }" @keydown.esc.stop="emit('close')">
      <div class="es-head">
        <h2 id="es-title" class="es-title">Editor settings</h2>
        <button type="button" class="es-x" aria-label="Close editor settings" @click="emit('close')">
          <Icon icon="lucide:x" aria-hidden="true" />
        </button>
      </div>
      <label class="es-row">
        <span>Font size</span>
        <select v-model.number="settings.fontSize" class="es-select">
          <option v-for="v in CHOICES.fontSize" :key="v" :value="v">{{ v }} px</option>
        </select>
      </label>
      <label class="es-row">
        <span>Tab size</span>
        <select v-model="tabSize" class="es-select">
          <option v-for="v in CHOICES.tabSize" :key="v" :value="String(v)">{{ v === 'auto' ? "The file's own" : `${v} spaces` }}</option>
        </select>
      </label>
      <label class="es-row">
        <span>Line numbers</span>
        <select v-model="settings.lineNumbers" class="es-select">
          <option value="on">Shown</option>
          <option value="relative">Relative to the cursor</option>
          <option value="off">Hidden</option>
        </select>
      </label>
      <label class="es-row">
        <span>Show whitespace</span>
        <select v-model="settings.whitespace" class="es-select">
          <option value="none">Never</option>
          <option value="selection">In a selection</option>
          <option value="all">Always</option>
        </select>
      </label>
      <label class="es-row es-check">
        <span>Wrap long lines</span>
        <input v-model="settings.wordWrap" type="checkbox" />
      </label>
      <label class="es-row es-check">
        <span>Minimap</span>
        <input v-model="settings.minimap" type="checkbox" />
      </label>
      <label class="es-row es-check" title="TypeScript, JavaScript and Python files are formatted before they are saved">
        <span>Format on save</span>
        <input v-model="settings.formatOnSave" type="checkbox" data-test="es-format-on-save" />
      </label>
      <!-- Autosave (ADM-1322): off unless chosen; always the save that checks the file was not changed on disk. -->
      <label class="es-row" title="A file changed in the project since you opened it is asked about, never overwritten">
        <span>Autosave</span>
        <select v-model="settings.autoSave" class="es-select" data-test="es-autosave">
          <option value="off">Off</option>
          <option value="afterDelay">After a pause in typing</option>
          <option value="onFocusChange">When the editor loses focus</option>
        </select>
      </label>
      <label v-if="settings.autoSave === 'afterDelay'" class="es-row">
        <span>Pause before saving</span>
        <select v-model.number="settings.autoSaveDelay" class="es-select" data-test="es-autosave-delay">
          <option v-for="v in CHOICES.autoSaveDelay" :key="v" :value="v">{{ v < 1000 ? `${v}\u00a0ms` : `${v / 1000}\u00a0s` }}</option>
        </select>
      </label>
      <label class="es-row es-check" title="Vim keys: Esc for normal mode, i to type, : for commands (:w saves)">
        <span>Vim keys</span>
        <input v-model="settings.vim" type="checkbox" data-test="es-vim" />
      </label>
      <!-- Inline suggestions (ADM-1316): saved on the server, which checks them on every request; off by default. -->
      <fieldset class="es-group" aria-describedby="es-ic-note" data-test="es-inline">
        <legend class="es-legend">Inline suggestions</legend>
        <label class="es-row es-check">
          <span>Suggest code as I type</span>
          <input type="checkbox" :checked="ic.enabled" :disabled="ic.saving || !ic.loaded" data-test="es-inline-enabled"
                 @change="saveInline({ enabled: $event.target.checked })" />
        </label>
        <label class="es-row" for="es-ic-limit">
          <span>Daily limit</span>
          <span class="es-money">
            <span aria-hidden="true">$</span>
            <input id="es-ic-limit" v-model="limitDraft" class="es-input" type="text" inputmode="decimal" autocomplete="off"
                   :disabled="ic.saving || !ic.loaded" data-test="es-inline-limit"
                   @keydown.enter.prevent="saveLimit" @blur="saveLimit" />
          </span>
        </label>
        <p id="es-ic-note" class="es-note">
          Paid from your balance; each suggestion is listed in Usage.
          <template v-if="ic.loaded">Today: {{ spentText }} of ${{ ic.dailyLimitUsd }} (resets at midnight UTC).</template>
          <template v-if="ic.loaded && ic.modelName"> Model: {{ ic.modelName }}.</template>
          <template v-else-if="ic.loaded"> No model is set for suggestions yet.</template>
        </p>
        <p v-if="ic.error" class="es-error" role="alert">{{ ic.error }}</p>
      </fieldset>
      <div class="es-foot">
        <button type="button" class="es-reset" @click="reset">Restore the defaults</button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
// The editor's settings (ADM-1205, phase A; autosave and vim keys, ADM-1322), opened from the gear beside Save or the
// command palette. Changes apply at once and are kept in this browser (useEditorSettings).
import { ref, computed, watch, nextTick } from 'vue'
import { Icon } from '@iconify/vue'
import { useEditorSettings, CHOICES } from '@/composables/useEditorSettings'
import { useIdeTheme } from '@/composables/useIdeTheme'
import { useInlineSuggestions } from '@/composables/useInlineSuggestions'

const props = defineProps({
  open: { type: Boolean, default: false },
  anchor: { type: Object, default: null },        // the gear's DOMRect
})
const emit = defineEmits(['close'])

const { settings, reset } = useEditorSettings()
const { theme: ideTheme } = useIdeTheme()
// Inline suggestions: the server's setting (read when the panel opens), not this browser's.
const { state: ic, load: loadInline, save: saveInline } = useInlineSuggestions()
const limitDraft = ref(ic.dailyLimitUsd)
watch(() => ic.dailyLimitUsd, (v) => { limitDraft.value = v })
function saveLimit() {
  const v = String(limitDraft.value || '').trim().replace(/^[$]/, '')
  if (!v || v === ic.dailyLimitUsd) { limitDraft.value = ic.dailyLimitUsd; return }
  saveInline({ daily_limit_usd: v }).then((ok) => { if (!ok) limitDraft.value = ic.dailyLimitUsd })
}
const spentText = computed(() => {
  const v = Number(ic.spentTodayUsd) || 0
  return v > 0 && v < 0.01 ? 'under $0.01' : `$${v.toFixed(2)}`
})
const tabSize = computed({
  get: () => String(settings.tabSize),
  set: (v) => { settings.tabSize = v === 'auto' ? 'auto' : Number(v) },
})

const panel = ref(null)
const pos = ref({ x: 0, y: 0 })
watch(() => props.open, async (open) => {
  if (!open) return
  loadInline({ force: true })
  const a = props.anchor
  pos.value = { x: a ? a.right : 0, y: a ? a.bottom + 6 : 0 }
  await nextTick()
  const el = panel.value
  if (!el) return
  const m = 8
  pos.value = {
    x: Math.max(m, Math.min(pos.value.x - el.offsetWidth, window.innerWidth - el.offsetWidth - m)),
    y: Math.max(m, Math.min(pos.value.y, window.innerHeight - el.offsetHeight - m)),
  }
  el.querySelector('select, input, button')?.focus()
}, { immediate: true })
</script>

<style scoped>
.es-scrim { position: fixed; inset: 0; z-index: 60; }
.es {
  position: fixed; z-index: 61; width: 300px; max-width: calc(100vw - 16px); padding: 12px 14px;
  max-height: calc(100vh - 16px); overflow-y: auto; overscroll-behavior: contain;
  background: var(--vm-surface); color: var(--vm-ink); border: 1px solid var(--vm-line-2); border-radius: 10px;
  box-shadow: var(--vm-shadow-l); font: 13px var(--vm-font-sans);
}
.es-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.es-title { margin: 0; font-size: 14px; font-weight: 600; color: var(--vm-ink); }
.es-x {
  display: grid; place-items: center; width: 26px; height: 26px; border: 0; border-radius: 6px; background: transparent;
  color: var(--vm-ink-soft); cursor: pointer;
}
.es-x:hover { background: color-mix(in srgb, var(--vm-ink) 7%, transparent); color: var(--vm-ink); }
.es-x :deep(svg) { width: 15px; height: 15px; }
.es-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 36px; color: var(--vm-ink-soft); }
.es-select {
  min-width: 150px; padding: 4px 8px; font: 13px var(--vm-font-sans); color: var(--vm-ink);
  background: var(--vm-surface-soft); border: 1px solid var(--vm-line-2); border-radius: 6px;
}
.es-check input { width: 16px; height: 16px; accent-color: var(--vm-violet); }
.es-select:focus-visible, .es-check input:focus-visible, .es-x:focus-visible, .es-reset:focus-visible {
  outline: 2px solid var(--vm-focus); outline-offset: 2px;
}
.es-group { margin: 8px 0 0; padding: 8px 0 0; border: 0; border-top: 1px solid var(--vm-line); }
.es-legend { padding: 0; font-size: 12.5px; font-weight: 600; color: var(--vm-ink); }
.es-money { display: inline-flex; align-items: center; gap: 4px; color: var(--vm-ink-soft); }
.es-input {
  width: 88px; padding: 4px 8px; font: 13px var(--vm-font-sans); color: var(--vm-ink);
  background: var(--vm-surface-soft); border: 1px solid var(--vm-line-2); border-radius: 6px;
}
.es-input:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; }
.es-note { margin: 4px 0 0; font-size: 12px; line-height: 1.5; color: var(--vm-ink-soft); }
.es-error { margin: 4px 0 0; font-size: 12px; color: var(--vm-danger); }
.es-foot { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--vm-line); }
.es-reset { border: 0; background: transparent; color: var(--vm-link); font: 500 12.5px var(--vm-font-sans); cursor: pointer; padding: 4px 0; }
.es-reset:hover { text-decoration: underline; }
@media (pointer: coarse) { .es-row { min-height: 44px; } .es-select { min-height: 36px; } }
</style>
