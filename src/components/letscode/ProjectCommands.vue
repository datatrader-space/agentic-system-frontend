<!--
  ProjectCommands: how this project is installed, built, tested, linted, type-checked and run, and the port it serves
  on (AGENT_ENGINE_CAPABILITIES_PLAN.md section 3, open decision D3). The Coding Agent writes these from commands that
  worked and uses them on later turns; the person sees and corrects them here. Opened from the editor's top bar, beside
  Deploy: they describe the whole project, not a file, and the bar is where the project's own settings live.
  GET / PUT /api/lets-code/projects/<repo_id>/facts/. No native dialogs.
-->
<template>
  <div class="pc">
    <button
      ref="triggerEl" type="button" class="pc-trigger" aria-label="Project commands" aria-haspopup="dialog" :aria-expanded="open ? 'true' : 'false'"
      :disabled="!ready" :title="ready ? 'How this project is installed, built, tested and run' : 'The project is still being prepared'"
      data-test="commands-open" @click="openPanel"
    >
      <Icon icon="lucide:square-terminal" aria-hidden="true" />
      <span class="pc-trigger-t">Commands</span>
    </button>

    <Teleport to="body">
      <div v-if="open" class="pc-overlay" :data-theme="ideTheme" @pointerdown.self="close">
        <form
          ref="dialogEl" class="pc-dialog" role="dialog" aria-modal="true" aria-labelledby="pc-title" aria-describedby="pc-desc"
          novalidate @submit.prevent="save" @keydown.esc.stop="close" @keydown.tab="trapTab"
        >
          <header class="pc-head">
            <div class="pc-head-t">
              <h2 id="pc-title" class="pc-title">Project commands</h2>
              <p id="pc-desc" class="pc-desc">The coding agent fills these in from commands that worked in this project, and uses them to install, build, test and run it. Correct any that are wrong.</p>
            </div>
            <button ref="closeEl" type="button" class="pc-ibtn" aria-label="Close" @click="close"><Icon icon="lucide:x" /></button>
          </header>

          <div class="pc-body vm-scroll">
            <div v-if="loading" class="pc-skel" aria-busy="true" aria-label="Loading the commands"><span v-for="n in 7" :key="n"></span></div>
            <div v-else-if="loadError" class="pc-load-err" role="alert">
              <p>{{ loadError }}</p>
              <button type="button" class="pc-btn" @click="load">Try again</button>
            </div>
            <template v-else>
              <div v-for="f in FIELDS" :key="f.key" class="pc-row" :data-test="`fact-${f.key}`">
                <label class="pc-label" :for="`pc-${f.key}`">{{ f.label }}</label>
                <div class="pc-field">
                  <input
                    :id="`pc-${f.key}`" v-model="draft[f.key]" class="pc-input mono" type="text" spellcheck="false" autocomplete="off"
                    :placeholder="f.placeholder" :aria-invalid="errors[f.key] ? 'true' : 'false'"
                    :aria-describedby="errors[f.key] ? `pc-${f.key}-err` : undefined" @input="errors[f.key] = ''"
                  />
                  <p v-if="errors[f.key]" :id="`pc-${f.key}-err`" class="pc-err" role="alert">{{ errors[f.key] }}</p>
                </div>
              </div>
              <div class="pc-row" data-test="fact-port">
                <label class="pc-label" for="pc-port">Port</label>
                <div class="pc-field">
                  <input
                    id="pc-port" v-model="draft.port" class="pc-input pc-port" type="text" inputmode="numeric" autocomplete="off"
                    placeholder="3000" :aria-invalid="errors.port ? 'true' : 'false'"
                    :aria-describedby="errors.port ? 'pc-port-err' : 'pc-port-hint'" @input="errors.port = ''"
                  />
                  <p v-if="errors.port" id="pc-port-err" class="pc-err" role="alert">{{ errors.port }}</p>
                  <p v-else id="pc-port-hint" class="pc-hint">Where the running app listens. Leave empty when it has none.</p>
                </div>
              </div>
              <p v-if="formError" class="pc-banner" role="alert">{{ formError }}</p>
            </template>
          </div>

          <footer v-if="!loading && !loadError" class="pc-foot">
            <p class="pc-when" role="status">{{ updatedText }}</p>
            <button type="button" class="pc-btn" @click="close">Cancel</button>
            <button type="submit" class="pc-btn primary" :disabled="saving || !changed" data-test="commands-save">
              <Icon :icon="saving ? 'lucide:loader-2' : 'lucide:check'" :class="{ spin: saving }" aria-hidden="true" />
              {{ saving ? 'Saving' : 'Save' }}
            </button>
          </footer>
        </form>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import api from '@/services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import { useIdeTheme } from '@/composables/useIdeTheme'

// Teleported to the body, outside the editor: it carries the editor's own light or dark (ADM-1205).
const { theme: ideTheme } = useIdeTheme()

const props = defineProps({
  repoId: { type: Number, required: true },
  ready: { type: Boolean, default: true },
})

const FIELDS = [
  { key: 'install', label: 'How to install', placeholder: 'npm ci' },
  { key: 'build', label: 'How to build', placeholder: 'npm run build' },
  { key: 'test', label: 'How to test', placeholder: 'npm test' },
  { key: 'lint', label: 'How to lint', placeholder: 'npx eslint .' },
  { key: 'typecheck', label: 'How to type-check', placeholder: 'npx tsc --noEmit' },
  { key: 'serve', label: 'How to run', placeholder: 'npm run dev' },
]
const KEYS = [...FIELDS.map((f) => f.key), 'port']
const blank = () => Object.fromEntries(KEYS.map((k) => [k, '']))

const open = ref(false)
const loading = ref(false)
const loadError = ref('')
const saving = ref(false)
const formError = ref('')
const updatedAt = ref(null)
const saved = reactive(blank())
const draft = reactive(blank())
const errors = reactive(blank())
const triggerEl = ref(null)
const dialogEl = ref(null)
const closeEl = ref(null)

// What the server holds, as the text in each box: a missing command or port is an empty box.
function take(data) {
  const facts = data?.facts || {}
  for (const k of KEYS) {
    const v = facts[k]
    saved[k] = v == null ? '' : String(v)
    draft[k] = saved[k]
    errors[k] = ''
  }
  updatedAt.value = data?.updated_at || null
}

const changed = computed(() => KEYS.some((k) => String(draft[k]).trim() !== String(saved[k]).trim()))
const updatedText = computed(() => {
  if (!updatedAt.value) return 'Not filled in yet'
  const d = new Date(updatedAt.value)
  return Number.isNaN(d.getTime()) ? '' : `Last changed ${d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
})

async function load() {
  loading.value = true
  loadError.value = ''
  formError.value = ''
  try {
    const { data } = await api.getProjectFacts(props.repoId)
    take(data)
  } catch (e) {
    loadError.value = messageOf(e?.response?.data?.error) || 'The commands could not be loaded.'
  } finally {
    loading.value = false
  }
}

// Checked here first so a slip is shown at once; the server checks again and its reasons are shown the same way.
function validate() {
  let ok = true
  for (const f of FIELDS) {
    if (/[\r\n]/.test(draft[f.key])) { errors[f.key] = 'Write one command on one line. Join steps with &&.'; ok = false }
  }
  const port = String(draft.port).trim()
  if (port && !(/^\d+$/.test(port) && Number(port) >= 1 && Number(port) <= 65535)) {
    errors.port = 'Enter a whole number from 1 to 65535, or leave it empty.'
    ok = false
  }
  return ok
}

function messageOf(v) {
  if (!v) return ''
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.map(messageOf).filter(Boolean).join(' ')
  if (typeof v === 'object' && v.message) return String(v.message)
  return ''
}
// The server's reasons, put next to the field they are about. It may name fields under `error.fields`, `fields`
// or `facts`, or at the top level; anything else is shown above the buttons.
function applyServerErrors(data) {
  const sources = [data?.error?.fields, data?.fields, data?.facts, data]
  let placed = false
  for (const src of sources) {
    if (!src || typeof src !== 'object' || Array.isArray(src)) continue
    for (const k of KEYS) {
      const why = messageOf(src[k])
      if (why) { errors[k] = why; placed = true }
    }
    if (placed) break
  }
  formError.value = messageOf(data?.error) || (placed ? 'Some commands were not saved. See the reasons above.' : 'The commands were not saved.')
}

async function save() {
  formError.value = ''
  if (!changed.value || saving.value || !validate()) return
  const facts = {}
  for (const f of FIELDS) facts[f.key] = String(draft[f.key]).trim() || null
  const port = String(draft.port).trim()
  facts.port = port ? Number(port) : null
  saving.value = true
  try {
    const { data } = await api.saveProjectFacts(props.repoId, facts)
    take(data)
    notify.success('Commands saved')
  } catch (e) {
    applyServerErrors(e?.response?.data)
  } finally {
    saving.value = false
  }
}

async function openPanel() {
  open.value = true
  load()
  await nextTick()
  closeEl.value?.focus()
}
async function close() {
  if (!open.value) return
  if (changed.value && !saving.value) {
    const discard = await confirm({
      title: 'Discard your changes?',
      message: 'Your changes to the project commands are not saved.',
      confirmText: 'Discard',
      danger: true,
    })
    if (!discard) return
  }
  open.value = false
  nextTick(() => triggerEl.value?.focus())
}
function trapTab(e) {
  const items = [...(dialogEl.value?.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex="0"]') || [])]
    .filter((el) => el.offsetParent !== null)
  if (!items.length) return
  const first = items[0]
  const last = items[items.length - 1]
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
}

watch(() => props.repoId, () => { open.value = false; take({}) })
watch(open, (v) => { document.documentElement.style.overflow = v ? 'hidden' : '' })
onBeforeUnmount(() => { document.documentElement.style.overflow = '' })

defineExpose({ openPanel, load })
</script>

<style scoped>
.pc { position: relative; --pc-on: #fff; }
.pc-trigger { display: inline-flex; align-items: center; gap: 7px; min-height: 34px; padding: 0 12px; border: 1px solid var(--vm-line-2); border-radius: 8px; background: var(--vm-surface); color: var(--vm-ink); font: 600 13px var(--vm-font-sans); cursor: pointer; transition: border-color .15s, background-color .15s; }
.pc-trigger:hover:not(:disabled) { border-color: var(--vm-violet); background: var(--vm-violet-soft); }
.pc-trigger:disabled { opacity: .5; cursor: not-allowed; }
.pc-trigger :deep(svg) { width: 15px; height: 15px; color: var(--vm-violet); }
.pc-trigger:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; }

.pc-overlay { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 24px; background: color-mix(in srgb, #000 55%, transparent); backdrop-filter: blur(2px); }
.pc-dialog { width: min(600px, 100%); max-height: min(760px, calc(100vh - 48px)); display: flex; flex-direction: column; margin: 0; border: 1px solid var(--vm-line-2); border-radius: 16px; background: var(--vm-surface); color: var(--vm-ink); box-shadow: 0 30px 80px rgba(0, 0, 0, .35); overflow: hidden; font-family: var(--vm-font-sans); }

.pc-head { display: flex; align-items: flex-start; gap: 12px; padding: 18px 20px 14px; border-bottom: 1px solid var(--vm-line); }
.pc-head-t { flex: 1; min-width: 0; }
.pc-title { margin: 0; font: 800 18px/1.25 var(--vm-font-display); }
.pc-desc { margin: 6px 0 0; max-width: 62ch; font-size: 13px; line-height: 1.5; color: var(--vm-ink-soft); }

.pc-body { flex: 1; min-height: 0; overflow-y: auto; padding: 8px 20px 16px; }
.pc-row { display: grid; grid-template-columns: 150px 1fr; gap: 6px 14px; align-items: start; padding: 10px 0; border-bottom: 1px solid var(--vm-line); }
.pc-row:last-of-type { border-bottom: none; }
.pc-label { padding-top: 9px; font-size: 13px; font-weight: 600; color: var(--vm-ink); }
.pc-field { min-width: 0; }
.pc-input { width: 100%; min-height: 38px; padding: 0 11px; border: 1px solid var(--vm-line-2); border-radius: 8px; background: var(--vm-surface); color: var(--vm-ink); font: 13px var(--vm-font-sans); transition: border-color .15s, box-shadow .15s; }
.pc-input.mono { font-family: var(--vm-font-mono); font-size: 12.5px; }
.pc-input::placeholder { color: var(--vm-ink-faint); }
.pc-input:focus { outline: none; border-color: var(--vm-focus); box-shadow: 0 0 0 3px color-mix(in srgb, var(--vm-focus) 18%, transparent); }
.pc-input[aria-invalid="true"] { border-color: var(--vm-danger); }
.pc-port { max-width: 140px; font-variant-numeric: tabular-nums; }
.pc-err { margin: 5px 0 0; font-size: 12.5px; color: var(--vm-red-ink); }
.pc-hint { margin: 5px 0 0; font-size: 12px; color: var(--vm-ink-faint); }
.pc-banner { margin: 12px 0 0; padding: 9px 12px; border: 1px solid color-mix(in srgb, var(--vm-danger) 35%, transparent); border-radius: 8px; background: color-mix(in srgb, var(--vm-danger) 7%, transparent); color: var(--vm-red-ink); font-size: 13px; }
.pc-load-err { padding: 24px 0; text-align: center; color: var(--vm-ink-soft); font-size: 13.5px; }
.pc-load-err p { margin: 0 0 12px; }

.pc-skel { display: flex; flex-direction: column; gap: 12px; padding: 10px 0; }
.pc-skel span { height: 38px; border-radius: 8px; background: var(--vm-surface-soft); animation: pc-pulse 1.4s ease-in-out infinite; }

.pc-foot { display: flex; align-items: center; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--vm-line); background: var(--vm-surface-soft); }
.pc-when { margin: 0 auto 0 0; font-size: 12.5px; color: var(--vm-ink-soft); }
.pc-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 38px; padding: 0 15px; border: 1px solid var(--vm-line-2); border-radius: var(--vm-r); background: var(--vm-surface); color: var(--vm-ink); font: 600 13px var(--vm-font-sans); cursor: pointer; transition: border-color .15s, background-color .15s; }
.pc-btn:hover:not(:disabled) { border-color: var(--vm-violet); background: var(--vm-violet-soft); }
.pc-btn.primary { background: var(--vm-violet); border-color: var(--vm-violet); color: var(--pc-on); }
.pc-btn.primary:hover:not(:disabled) { background: var(--vm-violet-d); border-color: var(--vm-violet-d); }
.pc-btn:disabled { opacity: .55; cursor: not-allowed; }
.pc-btn :deep(svg) { width: 15px; height: 15px; }
.pc-ibtn { display: grid; place-items: center; width: 36px; height: 36px; flex: 0 0 auto; border: none; border-radius: 8px; background: transparent; color: var(--vm-ink-soft); cursor: pointer; }
.pc-ibtn:hover { background: var(--vm-surface-soft); color: var(--vm-ink); }
.pc-ibtn :deep(svg) { width: 17px; height: 17px; }
.pc-btn:focus-visible, .pc-ibtn:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; }

.spin { animation: pc-spin 1s linear infinite; }
@keyframes pc-spin { to { transform: rotate(360deg); } }
@keyframes pc-pulse { 50% { opacity: .5; } }

@media (max-width: 900px) { .pc-trigger-t { display: none; } }
@media (max-width: 640px) {
  .pc-overlay { padding: 12px; }
  .pc-row { grid-template-columns: 1fr; }
  .pc-label { padding-top: 0; }
  .pc-input { min-height: 44px; font-size: 16px; }
  .pc-input.mono { font-size: 15px; }
  .pc-btn, .pc-ibtn, .pc-trigger { min-height: 44px; }
  .pc-ibtn { width: 44px; height: 44px; }
}
@media (prefers-reduced-motion: reduce) { .spin, .pc-skel span { animation: none; } }
</style>
