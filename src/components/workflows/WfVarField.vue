<!--
  A text field that shows workflow variables as pills (ADM-1333, plan §3.3, D3).

    <WfVarField id="f-prompt" label="Prompt" multiline v-bind="editor.bindText('prompt', 'Prompt')" />

  THE FIELD STAYS PLAIN TEXT. What is saved is exactly the text the engine reads. A mirror layer behind the field draws
  each {{…}} token as a pill: in colour when it resolves against the last run, neutral when it is well formed but has no
  value yet, and red (wavy underline, and listed under the field with the reason) when its root is unknown, its node is
  not in the workflow, it is the node itself, or the node is not upstream. Hovering a red pill shows the reason too.

  INSERTING A TOKEN, three ways, all at the caret:
    - type {{ or @ (at the start of a word) to open a picker of the keys;
    - drop a key dragged from the Input pane (nothing closes on dragstart, F19);
    - press Enter on a key in the Input pane: it goes into the field focused last (WCAG 2.5.7, via the node editor).

  Props `keys` and `check` default to the node window's editor, so the field works inside the window with no wiring.
  Emits: update:modelValue (the whole new text), focus, blur.
-->
<template>
  <div class="wvf" :class="{ 'wvf--multi': multiline, 'wvf--mono': mono, 'wvf--bad': problems.length > 0 }">
    <div class="wvf-box" @mousemove="onHover" @mouseleave="hoverMessage = ''">
      <div ref="mirrorEl" class="wvf-mirror" :class="{ 'wvf-mirror--multi': multiline }" aria-hidden="true"><template v-for="(seg, i) in segments" :key="i"><span v-if="seg.token" class="wvf-pill" :class="`is-${seg.state}`" :data-problem="seg.message || null">{{ seg.text }}</span><template v-else>{{ seg.text }}</template></template>&#8203;</div>
      <textarea
        v-if="multiline"
        :id="id"
        ref="fieldEl"
        class="wvf-field"
        :rows="rows"
        :value="text"
        :placeholder="placeholder"
        :disabled="disabled"
        :title="hoverMessage || undefined"
        :aria-describedby="describedByIds"
        :aria-invalid="problems.length ? 'true' : undefined"
        autocomplete="off"
        spellcheck="false"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
        @scroll="syncScroll"
        @keydown="onKeydown"
        @dragover="onDragOver"
        @drop="onDrop"
      />
      <input
        v-else
        :id="id"
        ref="fieldEl"
        class="wvf-field"
        type="text"
        :value="text"
        :placeholder="placeholder"
        :disabled="disabled"
        :title="hoverMessage || undefined"
        :aria-describedby="describedByIds"
        :aria-invalid="problems.length ? 'true' : undefined"
        autocomplete="off"
        spellcheck="false"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
        @scroll="syncScroll"
        @keydown="onKeydown"
        @dragover="onDragOver"
        @drop="onDrop"
      />
    </div>

    <div v-if="picker.open" class="wvf-picker" @keydown.esc.stop.prevent="closePicker(true)">
      <AppCommandList
        :items="pickerKeys"
        :groups="pickerGroups"
        :label="`Insert a variable into ${label}`"
        placeholder="Search variables"
        empty-text="Nothing upstream to insert yet. Connect a step before this one, or run upstream."
        @select="onPick"
      />
      <p class="wvf-picker-hint">Enter inserts. Esc closes.</p>
    </div>

    <ul v-if="problems.length" :id="problemsId" class="wvf-problems">
      <li v-for="p in problems" :key="`${p.start}-${p.raw}`">
        <Icon icon="lucide:circle-alert" aria-hidden="true" />
        <span><code translate="no">{{ p.raw }}</code> {{ p.message }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, useId } from 'vue'
import { Icon } from '@iconify/vue'
import AppCommandList from '@/components/common/AppCommandList.vue'
import { checkTemplateTokens, insertAt } from '@/utils/wfVarExpr'
import { useOptionalNodeEditor } from './settings/nodeEditor'
import { WF_VAR_MIME } from './wfNodeModalModel'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  id: { type: String, required: true },
  label: { type: String, required: true },
  multiline: { type: Boolean, default: false },
  rows: { type: Number, default: 3 },
  mono: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  describedby: { type: String, default: '' },
  // [{ id: '{{token}}', label, group?, description? }]; default: every key the node window's Input pane lists.
  keys: { type: Array, default: null },
  groups: { type: Array, default: null },
  // (text) => tokens with { start, end, raw, problem, message, state }; default: the node window's check.
  check: { type: Function, default: null },
})
const emit = defineEmits(['update:modelValue', 'focus', 'blur'])

const editor = useOptionalNodeEditor()
const problemsId = `wvf-problems-${useId()}`
const fieldEl = ref(null)
const mirrorEl = ref(null)
const hoverMessage = ref('')
const picker = reactive({ open: false, from: 0, to: 0 })
let lastCaret = null
let previousLength = 0

const text = computed(() => (props.modelValue === null || props.modelValue === undefined ? '' : String(props.modelValue)))
const pickerKeys = computed(() => props.keys || editor?.varKeys.value || [])
const pickerGroups = computed(() => props.groups || (editor ? editor.sources.value.map((s) => ({ id: s.id, label: s.label })) : []))

const tokens = computed(() => {
  if (props.check) return props.check(text.value)
  if (editor) return editor.checkText(text.value)
  return checkTemplateTokens(text.value).map((t) => ({ ...t, state: t.problem ? 'error' : 'plain' }))
})
const problems = computed(() => tokens.value.filter((t) => t.state === 'error' || t.problem))
const describedByIds = computed(() => [props.describedby, problems.value.length ? problemsId : ''].filter(Boolean).join(' ') || undefined)

const segments = computed(() => {
  const out = []
  let at = 0
  for (const t of [...tokens.value].sort((a, b) => a.start - b.start)) {
    if (t.start < at) continue
    if (t.start > at) out.push({ text: text.value.slice(at, t.start) })
    out.push({ text: text.value.slice(t.start, t.end), token: true, state: t.problem ? 'error' : t.state || 'plain', message: t.message })
    at = t.end
  }
  if (at < text.value.length) out.push({ text: text.value.slice(at) })
  return out
})

// ── typing ──
function onInput(e) {
  const value = e.target.value
  const grew = value.length > previousLength
  previousLength = value.length
  emit('update:modelValue', value)
  if (!grew) return
  const caret = e.target.selectionStart ?? value.length
  const before = value.slice(0, caret)
  if (before.endsWith('{{') && !before.endsWith('{{{')) openPicker(caret - 2, caret)
  else if (before.endsWith('@') && (caret === 1 || /\s/.test(before[caret - 2]))) openPicker(caret - 1, caret)
}

function onKeydown(e) {
  if (e.key === 'Escape' && picker.open) { e.preventDefault(); e.stopPropagation(); closePicker(true) }
}

function onFocus(e) {
  previousLength = text.value.length
  editor?.registerField(fieldApi)
  emit('focus', e)
}
function onBlur(e) {
  rememberCaret()
  emit('blur', e)
}
function rememberCaret() {
  const el = fieldEl.value
  if (el && typeof el.selectionStart === 'number') lastCaret = { start: el.selectionStart, end: el.selectionEnd }
}

function syncScroll() {
  const el = fieldEl.value
  const m = mirrorEl.value
  if (!el || !m) return
  m.scrollTop = el.scrollTop
  m.scrollLeft = el.scrollLeft
}

// ── inserting ──
function write(start, end, token) {
  const next = insertAt(text.value, start, end, token)
  const caret = (start ?? text.value.length) + token.length
  lastCaret = { start: caret, end: caret }
  previousLength = next.length
  emit('update:modelValue', next)
  return caret
}

function focusAt(caret) {
  nextTick(() => {
    const el = fieldEl.value
    if (!el) return
    el.focus()
    try { el.setSelectionRange(caret, caret) } catch { /* a disabled field has no selection */ }
  })
}

/** Insert `token` at the caret the field last had (keyboard pick from the Input pane). */
function insert(token) {
  const el = fieldEl.value
  const focused = el && typeof document !== 'undefined' && document.activeElement === el
  const caret = focused ? { start: el.selectionStart, end: el.selectionEnd } : lastCaret
  write(caret?.start ?? null, caret?.end ?? null, token)
}

const fieldApi = { insert, get label() { return props.label } }

function openPicker(from, to) {
  picker.open = true
  picker.from = from
  picker.to = to
}
function closePicker(refocus) {
  picker.open = false
  if (refocus) focusAt(lastCaret?.start ?? picker.to)
}
function onPick(item) {
  const caret = write(picker.from, picker.to, item.id)
  picker.open = false
  editor?.announce(`Inserted ${item.id} into ${props.label}.`)
  focusAt(caret)
}

// ── drag and drop (F19: the drag source in the Input pane stays mounted; nothing closes on dragstart) ──
const carriesToken = (e) => Array.from(e.dataTransfer?.types || []).includes(WF_VAR_MIME)

function onDragOver(e) {
  if (!carriesToken(e) || props.disabled) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'copy'
}

// The character offset under a point, measured on the mirror (which lays the text out exactly as the field does).
function offsetFromPoint(x, y) {
  const mirror = mirrorEl.value
  if (!mirror || typeof document.createRange !== 'function') return null
  const range = document.createRange()
  if (typeof range.getBoundingClientRect !== 'function') return null
  const walker = document.createTreeWalker(mirror, NodeFilter.SHOW_TEXT)
  let offset = 0
  let best = null
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const len = n.textContent.length
    for (let i = 0; i < len; i += 1) {
      range.setStart(n, i)
      range.setEnd(n, i + 1)
      const r = range.getBoundingClientRect()
      if (!r || (!r.width && !r.height) || y < r.top || y > r.bottom) continue
      const pos = x < r.left + r.width / 2 ? offset + i : offset + i + 1
      const dist = x < r.left ? r.left - x : x > r.right ? x - r.right : 0
      if (!best || dist < best.dist) best = { pos, dist }
    }
    offset += len
  }
  return best ? Math.min(best.pos, text.value.length) : null
}

function onDrop(e) {
  if (!carriesToken(e) || props.disabled) return
  e.preventDefault()
  const token = e.dataTransfer.getData(WF_VAR_MIME)
  if (!token) return
  const el = fieldEl.value
  let at = offsetFromPoint(e.clientX, e.clientY)
  let end = at
  if (at === null) {
    const focused = el && document.activeElement === el
    const caret = focused ? { start: el.selectionStart, end: el.selectionEnd } : lastCaret
    at = caret?.start ?? null
    end = caret?.end ?? null
  }
  const caret = write(at, end, token)
  editor?.announce(`Inserted ${token} into ${props.label}.`)
  focusAt(caret)
}

// ── the reason of a red pill, on hover ──
function onHover(e) {
  const mirror = mirrorEl.value
  if (!mirror) return
  for (const pill of mirror.querySelectorAll('[data-problem]')) {
    for (const r of pill.getClientRects()) {
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        hoverMessage.value = pill.dataset.problem
        return
      }
    }
  }
  hoverMessage.value = ''
}

onBeforeUnmount(() => editor?.unregisterField(fieldApi))

defineExpose({ insert, focus: () => fieldEl.value?.focus() })
</script>

<style scoped>
.wvf { position: relative; min-width: 0; }
.wvf-box { position: relative; border-radius: 6px; background: var(--vm-surface); }
.wvf-mirror, .wvf-field {
  margin: 0; padding: 7px 9px; border: 1px solid transparent; border-radius: 6px;
  font-family: inherit; font-size: 13px; line-height: 1.5; letter-spacing: normal;
  box-sizing: border-box; width: 100%;
}
.wvf--mono .wvf-mirror, .wvf--mono .wvf-field { font-family: var(--vm-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 12px; }
.wvf-mirror {
  position: absolute; inset: 0; overflow: hidden; pointer-events: none;
  color: transparent; white-space: pre;
}
.wvf-mirror--multi { white-space: pre-wrap; overflow-wrap: break-word; scrollbar-gutter: stable; }
.wvf-field {
  position: relative; display: block; min-height: 34px;
  border-color: var(--vm-line-2); background: transparent; color: var(--vm-ink); caret-color: var(--vm-ink);
}
textarea.wvf-field { resize: vertical; white-space: pre-wrap; overflow-wrap: break-word; scrollbar-gutter: stable; }
.wvf-field::placeholder { color: var(--vm-ink-faint); }
.wvf-field:hover:not(:disabled) { border-color: var(--vm-ink-faint); }
.wvf-field:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.wvf-field:disabled { opacity: .6; cursor: not-allowed; }
.wvf--bad .wvf-field { border-color: var(--vm-red-ink); }
.wvf-pill { border-radius: 4px; }
.wvf-pill.is-ok { background: var(--vm-primary-soft); box-shadow: 0 0 0 1px var(--vm-primary-line); }
.wvf-pill.is-plain { background: var(--vm-surface-soft); box-shadow: 0 0 0 1px var(--vm-line-2); }
.wvf-pill.is-error {
  background: var(--vm-red-soft); box-shadow: 0 0 0 1px var(--vm-red-ink);
  text-decoration: underline wavy var(--vm-red-ink); text-underline-offset: 3px;
}
.wvf-picker {
  position: absolute; z-index: 20; left: 0; right: 0; top: calc(100% + 4px);
  display: flex; flex-direction: column; min-width: 260px; max-height: 320px; padding: 8px;
  border: 1px solid var(--vm-line-2); border-radius: 8px; background: var(--vm-surface);
  box-shadow: var(--vm-shadow-l);
}
.wvf-picker :deep(.app-cmd) { min-height: 0; flex: 1; }
.wvf-picker-hint { margin: 6px 2px 0; font-size: 11px; color: var(--vm-ink-faint); }
.wvf-problems { margin: 6px 0 0; padding: 0; list-style: none; display: grid; gap: 4px; }
.wvf-problems li { display: flex; gap: 6px; align-items: flex-start; font-size: 12px; line-height: 1.45; color: var(--vm-red-ink); }
.wvf-problems li :deep(svg) { width: 14px; height: 14px; flex-shrink: 0; margin-top: 2px; }
.wvf-problems code { font-family: var(--vm-font-mono, ui-monospace, monospace); overflow-wrap: anywhere; }
@media (pointer: coarse) { .wvf-field { min-height: 44px; } }
</style>
