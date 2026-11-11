<!--
  ProjectEnv: the project's environment variables (LETS_CODE_PREVIEW_AND_ENV_PLAN.md section 3, ADM-1205 phase D).
  The person's Terminal and the Coding Agent's commands run with them; the agent knows their names only. A value is
  write-only (owner, 2026-11-11): the server never sends one back, so this lists names and when each changed, and a
  change is typed again. Opened from the editor's top bar, beside Commands. GET / PUT
  /api/lets-code/projects/<repo_id>/env/. No native dialogs.
-->
<template>
  <div class="pe">
    <button
      ref="triggerEl" type="button" class="pe-trigger" aria-label="Environment variables" aria-haspopup="dialog"
      :aria-expanded="open ? 'true' : 'false'" :title="'Environment variables for the Terminal and the Coding Agent'"
      data-test="env-open" @click="openPanel"
    >
      <Icon icon="lucide:key-round" aria-hidden="true" />
      <span class="pe-trigger-t">Variables</span>
    </button>

    <Teleport to="body">
      <div v-if="open" class="pe-overlay" :data-theme="ideTheme" @pointerdown.self="close">
        <form
          ref="dialogEl" class="pe-dialog" role="dialog" aria-modal="true" aria-labelledby="pe-title" aria-describedby="pe-desc"
          novalidate @submit.prevent="save" @keydown.esc.stop="close" @keydown.tab="trapTab"
        >
          <header class="pe-head">
            <div class="pe-head-t">
              <h2 id="pe-title" class="pe-title">Environment variables</h2>
              <p id="pe-desc" class="pe-desc">
                Your Terminal and the Coding Agent's commands run with these. Values are encrypted and never shown
                again after you save them; the agent sees the names only. A terminal that is already open keeps the
                values it started with: open a new one.
              </p>
            </div>
            <button ref="closeEl" type="button" class="pe-ibtn" aria-label="Close" @click="close"><Icon icon="lucide:x" /></button>
          </header>

          <div class="pe-body vm-scroll">
            <div v-if="loading" class="pe-skel" aria-busy="true" aria-label="Loading the variables"><span v-for="n in 4" :key="n"></span></div>
            <div v-else-if="loadError" class="pe-load-err" role="alert">
              <p>{{ loadError }}</p>
              <button type="button" class="pe-btn" @click="load">Try again</button>
            </div>
            <template v-else>
              <p v-if="!rows.length" class="pe-empty">No variables yet. Add one below, or paste a .env file.</p>
              <ul v-else class="pe-list" aria-label="Variables">
                <li v-for="r in rows" :key="r.key" class="pe-row" :class="r.state" :data-test="`env-${r.key}`">
                  <div class="pe-row-main">
                    <code class="pe-key" translate="no">{{ r.key }}</code>
                    <span class="pe-state">{{ stateText(r) }}</span>
                  </div>
                  <div v-if="editing === r.key" class="pe-edit">
                    <label class="sr-only" :for="`pe-v-${r.key}`">New value for {{ r.key }}</label>
                    <input :id="`pe-v-${r.key}`" ref="editEl" v-model="editValue" class="pe-input mono" :type="showValue ? 'text' : 'password'"
                           autocomplete="off" spellcheck="false" placeholder="Type the new value…" @keydown.enter.prevent="keepEdit(r.key)" />
                    <button type="button" class="pe-ibtn sm" :aria-label="showValue ? 'Hide what you typed' : 'Show what you typed'"
                            :title="showValue ? 'Hide' : 'Show'" @click="showValue = !showValue">
                      <Icon :icon="showValue ? 'lucide:eye-off' : 'lucide:eye'" aria-hidden="true" />
                    </button>
                    <button type="button" class="pe-btn sm" @click="keepEdit(r.key)">Keep</button>
                    <button type="button" class="pe-btn sm ghost" @click="cancelEdit">Cancel</button>
                  </div>
                  <div v-else class="pe-actions">
                    <template v-if="r.state === 'saved'">
                      <button type="button" class="pe-btn sm ghost" :aria-label="`Change ${r.key}`" @click="startEdit(r.key)">Change</button>
                      <button type="button" class="pe-btn sm ghost danger" :aria-label="`Remove ${r.key}`" @click="removeKey(r.key)">Remove</button>
                    </template>
                    <button v-else type="button" class="pe-btn sm ghost" :aria-label="`Undo the change to ${r.key}`" @click="undo(r.key)">Undo</button>
                  </div>
                </li>
              </ul>

              <fieldset class="pe-add">
                <legend class="pe-legend">Add a variable</legend>
                <div class="pe-add-row">
                  <div class="pe-add-name">
                    <label class="pe-label" for="pe-new-key">Name</label>
                    <input id="pe-new-key" v-model="newKey" class="pe-input mono" type="text" autocomplete="off" spellcheck="false"
                           autocapitalize="characters" placeholder="DATABASE_URL" :aria-invalid="addError ? 'true' : 'false'"
                           :aria-describedby="addError ? 'pe-add-err' : undefined" @input="addError = ''" />
                  </div>
                  <div class="pe-add-value">
                    <label class="pe-label" for="pe-new-value">Value</label>
                    <div class="pe-inline">
                      <input id="pe-new-value" v-model="newValue" class="pe-input mono" :type="showNew ? 'text' : 'password'"
                             autocomplete="off" spellcheck="false" placeholder="Its value…" @keydown.enter.prevent="addOne" />
                      <button type="button" class="pe-ibtn sm" :aria-label="showNew ? 'Hide what you typed' : 'Show what you typed'"
                              :title="showNew ? 'Hide' : 'Show'" @click="showNew = !showNew">
                        <Icon :icon="showNew ? 'lucide:eye-off' : 'lucide:eye'" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <button type="button" class="pe-btn" :disabled="!newKey.trim()" data-test="env-add" @click="addOne">
                    <Icon icon="lucide:plus" aria-hidden="true" /> Add
                  </button>
                </div>
                <p v-if="addError" id="pe-add-err" class="pe-err" role="alert">{{ addError }}</p>
                <details class="pe-paste" :open="pasteOpen" @toggle="pasteOpen = $event.target.open">
                  <summary>Paste a .env file</summary>
                  <label class="sr-only" for="pe-paste-text">The .env file's text</label>
                  <textarea id="pe-paste-text" v-model="pasteText" class="pe-input mono pe-textarea" rows="5" spellcheck="false"
                            autocomplete="off" placeholder="API_URL=https://api.example.com&#10;SECRET_KEY=…"></textarea>
                  <div class="pe-inline end">
                    <p v-if="pasteNote" class="pe-hint" role="status">{{ pasteNote }}</p>
                    <button type="button" class="pe-btn sm" :disabled="!pasteText.trim()" @click="addPasted">Add these</button>
                  </div>
                </details>
              </fieldset>
              <p v-if="formError" class="pe-banner" role="alert">{{ formError }}</p>
            </template>
          </div>

          <footer v-if="!loading && !loadError" class="pe-foot">
            <p class="pe-when" role="status">{{ pendingText }}</p>
            <button type="button" class="pe-btn" @click="close">Cancel</button>
            <button type="submit" class="pe-btn primary" :disabled="saving || !pendingCount" data-test="env-save">
              <Icon :icon="saving ? 'lucide:loader-2' : 'lucide:check'" :class="{ spin: saving }" aria-hidden="true" />
              {{ saving ? 'Saving…' : 'Save' }}
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
import { checkEnvKey, parseDotEnv } from '@/utils/projectEnv'

// Teleported to the body, outside the editor: it carries the editor's own light or dark (ADM-1205).
const { theme: ideTheme } = useIdeTheme()

const props = defineProps({ repoId: { type: Number, required: true } })

const open = ref(false)
const loading = ref(false)
const loadError = ref('')
const saving = ref(false)
const formError = ref('')
const saved = ref([])                    // [{ key, updated_at }] from the server: names only
const pending = reactive({})             // { KEY: 'value' (set) | null (remove) }
const editing = ref('')
const editValue = ref('')
const showValue = ref(false)
const newKey = ref('')
const newValue = ref('')
const showNew = ref(false)
const addError = ref('')
const pasteOpen = ref(false)
const pasteText = ref('')
const pasteNote = ref('')
const triggerEl = ref(null)
const dialogEl = ref(null)
const closeEl = ref(null)
const editEl = ref(null)

const pendingCount = computed(() => Object.keys(pending).length)
const pendingText = computed(() => {
  const n = pendingCount.value
  return n ? `${n} ${n === 1 ? 'change' : 'changes'} not saved yet` : ''
})

// Every saved name and every name about to be added, by name; each with what will happen to it.
const rows = computed(() => {
  const byKey = new Map(saved.value.map((v) => [v.key, { key: v.key, updated_at: v.updated_at, state: 'saved' }]))
  for (const [key, value] of Object.entries(pending)) {
    const had = byKey.get(key)
    byKey.set(key, { key, updated_at: had?.updated_at || null, state: value === null ? 'remove' : had ? 'change' : 'new' })
  }
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key))
})

function when(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function stateText(r) {
  if (r.state === 'new') return 'New: saved when you press Save'
  if (r.state === 'change') return 'New value: saved when you press Save'
  if (r.state === 'remove') return 'Removed when you press Save'
  const w = when(r.updated_at)
  return w ? `Set · changed ${w}` : 'Set'
}

function reset() {
  for (const k of Object.keys(pending)) delete pending[k]
  editing.value = ''
  editValue.value = ''
  newKey.value = ''
  newValue.value = ''
  addError.value = ''
  pasteText.value = ''
  pasteNote.value = ''
  formError.value = ''
  showValue.value = false
  showNew.value = false
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const { data } = await api.getProjectEnv(props.repoId)
    saved.value = Array.isArray(data?.variables) ? data.variables : []
  } catch (e) {
    loadError.value = e?.response?.data?.error || 'The variables could not be loaded.'
  } finally {
    loading.value = false
  }
}

async function startEdit(key) {
  editing.value = key
  editValue.value = ''
  showValue.value = false
  await nextTick()
  const el = Array.isArray(editEl.value) ? editEl.value[0] : editEl.value
  el?.focus()
}
function keepEdit(key) {
  pending[key] = editValue.value
  cancelEdit()
}
function cancelEdit() { editing.value = ''; editValue.value = ''; showValue.value = false }
function removeKey(key) { pending[key] = null }
function undo(key) { delete pending[key] }

function addOne() {
  const key = newKey.value.trim()
  const why = checkEnvKey(key)
  if (why) { addError.value = why; return }
  pending[key] = newValue.value
  newKey.value = ''
  newValue.value = ''
  showNew.value = false
  addError.value = ''
}

function addPasted() {
  const { values, skipped } = parseDotEnv(pasteText.value)
  let added = 0
  const refused = []
  for (const [key, value] of Object.entries(values)) {
    const why = checkEnvKey(key)
    if (why) { refused.push(key); continue }
    pending[key] = value
    added += 1
  }
  pasteText.value = ''
  const parts = [`${added} ${added === 1 ? 'variable' : 'variables'} added`]
  if (refused.length) parts.push(`not allowed: ${refused.join(', ')}`)
  if (skipped) parts.push(`${skipped} ${skipped === 1 ? 'line' : 'lines'} not read`)
  pasteNote.value = `${parts.join('; ')}. Press Save to keep them.`
}

async function save() {
  formError.value = ''
  if (!pendingCount.value || saving.value) return
  saving.value = true
  try {
    const { data } = await api.saveProjectEnv(props.repoId, { ...pending })
    saved.value = Array.isArray(data?.variables) ? data.variables : []
    reset()
    notify.success('Variables saved. Open a new terminal to use them there.')
  } catch (e) {
    formError.value = e?.response?.data?.error || 'The variables were not saved.'
  } finally {
    saving.value = false
  }
}

async function openPanel() {
  reset()
  open.value = true
  load()
  await nextTick()
  closeEl.value?.focus()
}
async function close() {
  if (!open.value) return
  const typing = newKey.value.trim() || newValue.value || editing.value || pasteText.value.trim()
  if ((pendingCount.value || typing) && !saving.value) {
    const discard = await confirm({
      title: 'Discard your changes?',
      message: 'Your changes to the environment variables are not saved.',
      confirmText: 'Discard',
      danger: true,
    })
    if (!discard) return
  }
  reset()
  open.value = false
  nextTick(() => triggerEl.value?.focus())
}
function trapTab(e) {
  const items = [...(dialogEl.value?.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]') || [])]
    .filter((el) => el.offsetParent !== null)
  if (!items.length) return
  const first = items[0]
  const last = items[items.length - 1]
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
}

watch(() => props.repoId, () => { open.value = false; saved.value = []; reset() })
watch(open, (v) => { document.documentElement.style.overflow = v ? 'hidden' : '' })
onBeforeUnmount(() => { document.documentElement.style.overflow = ''; reset() })

defineExpose({ openPanel, load })
</script>

<style scoped>
.pe { position: relative; --pe-on: #fff; }
.pe-trigger { display: inline-flex; align-items: center; gap: 7px; min-height: 34px; padding: 0 12px; border: 1px solid var(--vm-line-2); border-radius: 8px; background: var(--vm-surface); color: var(--vm-ink); font: 600 13px var(--vm-font-sans); cursor: pointer; transition: border-color .15s, background-color .15s; touch-action: manipulation; }
.pe-trigger:hover { border-color: var(--vm-violet); background: var(--vm-violet-soft); }
.pe-trigger :deep(svg) { width: 15px; height: 15px; color: var(--vm-violet); }
.pe-trigger:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; }

.pe-overlay { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 24px; background: color-mix(in srgb, #000 55%, transparent); backdrop-filter: blur(2px); overscroll-behavior: contain; }
.pe-dialog { width: min(640px, 100%); max-height: min(780px, calc(100vh - 48px)); display: flex; flex-direction: column; margin: 0; border: 1px solid var(--vm-line-2); border-radius: 16px; background: var(--vm-surface); color: var(--vm-ink); box-shadow: 0 30px 80px rgba(0, 0, 0, .35); overflow: hidden; font-family: var(--vm-font-sans); }

.pe-head { display: flex; align-items: flex-start; gap: 12px; padding: 18px 20px 14px; border-bottom: 1px solid var(--vm-line); }
.pe-head-t { flex: 1; min-width: 0; }
.pe-title { margin: 0; font: 800 18px/1.25 var(--vm-font-display); text-wrap: balance; }
.pe-desc { margin: 6px 0 0; max-width: 64ch; font-size: 13px; line-height: 1.5; color: var(--vm-ink-soft); }

.pe-body { flex: 1; min-height: 0; overflow-y: auto; padding: 8px 20px 16px; overscroll-behavior: contain; }
.pe-empty { margin: 12px 0; font-size: 13.5px; color: var(--vm-ink-faint); }
.pe-list { list-style: none; margin: 0; padding: 0; }
.pe-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 10px 0; border-bottom: 1px solid var(--vm-line); }
.pe-row-main { flex: 1 1 220px; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.pe-key { font: 600 13px var(--vm-font-mono); color: var(--vm-ink); overflow-wrap: anywhere; }
.pe-state { font-size: 12px; color: var(--vm-ink-faint); }
.pe-row.new .pe-state, .pe-row.change .pe-state { color: var(--vm-violet); }
.pe-row.remove .pe-key { text-decoration: line-through; color: var(--vm-ink-faint); }
.pe-row.remove .pe-state { color: var(--vm-red-ink); }
.pe-actions { display: flex; gap: 6px; flex: 0 0 auto; }
.pe-edit { flex: 1 1 100%; display: flex; align-items: center; gap: 6px; }

.pe-add { margin: 16px 0 0; padding: 12px 14px 14px; border: 1px solid var(--vm-line-2); border-radius: 10px; }
.pe-legend { padding: 0 6px; font-size: 13px; font-weight: 700; color: var(--vm-ink); }
.pe-add-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr) auto; gap: 10px; align-items: end; }
.pe-label { display: block; margin-bottom: 5px; font-size: 12.5px; font-weight: 600; color: var(--vm-ink-soft); }
.pe-inline { display: flex; align-items: center; gap: 6px; }
.pe-inline.end { justify-content: flex-end; margin-top: 8px; }
.pe-input { width: 100%; min-height: 38px; padding: 0 11px; border: 1px solid var(--vm-line-2); border-radius: 8px; background: var(--vm-surface); color: var(--vm-ink); font: 13px var(--vm-font-sans); transition: border-color .15s, box-shadow .15s; }
.pe-input.mono { font-family: var(--vm-font-mono); font-size: 12.5px; }
.pe-input::placeholder { color: var(--vm-ink-faint); opacity: .7; }
.pe-input:focus { outline: none; border-color: var(--vm-focus); box-shadow: 0 0 0 3px color-mix(in srgb, var(--vm-focus) 18%, transparent); }
.pe-input[aria-invalid="true"] { border-color: var(--vm-danger); }
.pe-textarea { min-height: 96px; padding: 8px 11px; resize: vertical; line-height: 1.5; margin-top: 8px; }
.pe-paste { margin-top: 12px; }
.pe-paste summary { cursor: pointer; font-size: 13px; font-weight: 600; color: var(--vm-link, var(--vm-violet)); width: fit-content; }
.pe-paste summary:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; border-radius: 4px; }
.pe-err { margin: 6px 0 0; font-size: 12.5px; color: var(--vm-red-ink); }
.pe-hint { margin: 0 auto 0 0; font-size: 12px; color: var(--vm-ink-soft); }
.pe-banner { margin: 12px 0 0; padding: 9px 12px; border: 1px solid color-mix(in srgb, var(--vm-danger) 35%, transparent); border-radius: 8px; background: color-mix(in srgb, var(--vm-danger) 7%, transparent); color: var(--vm-red-ink); font-size: 13px; }
.pe-load-err { padding: 24px 0; text-align: center; color: var(--vm-ink-soft); font-size: 13.5px; }
.pe-load-err p { margin: 0 0 12px; }
.pe-skel { display: flex; flex-direction: column; gap: 12px; padding: 10px 0; }
.pe-skel span { height: 38px; border-radius: 8px; background: var(--vm-surface-soft); animation: pe-pulse 1.4s ease-in-out infinite; }

.pe-foot { display: flex; align-items: center; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--vm-line); background: var(--vm-surface-soft); }
.pe-when { margin: 0 auto 0 0; font-size: 12.5px; color: var(--vm-ink-soft); }
.pe-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 38px; padding: 0 15px; border: 1px solid var(--vm-line-2); border-radius: var(--vm-r); background: var(--vm-surface); color: var(--vm-ink); font: 600 13px var(--vm-font-sans); cursor: pointer; transition: border-color .15s, background-color .15s; touch-action: manipulation; white-space: nowrap; }
.pe-btn:hover:not(:disabled) { border-color: var(--vm-violet); background: var(--vm-violet-soft); }
.pe-btn.sm { min-height: 30px; padding: 0 10px; font-size: 12.5px; }
.pe-btn.ghost { border-color: transparent; background: transparent; }
.pe-btn.ghost:hover:not(:disabled) { border-color: var(--vm-line-2); background: var(--vm-surface-soft); }
.pe-btn.danger { color: var(--vm-red-ink); }
.pe-btn.primary { background: var(--vm-violet); border-color: var(--vm-violet); color: var(--pe-on); }
.pe-btn.primary:hover:not(:disabled) { background: var(--vm-violet-d); border-color: var(--vm-violet-d); }
.pe-btn:disabled { opacity: .55; cursor: not-allowed; }
.pe-btn :deep(svg) { width: 15px; height: 15px; }
.pe-ibtn { display: grid; place-items: center; width: 36px; height: 36px; flex: 0 0 auto; border: none; border-radius: 8px; background: transparent; color: var(--vm-ink-soft); cursor: pointer; touch-action: manipulation; }
.pe-ibtn.sm { width: 32px; height: 32px; }
.pe-ibtn:hover { background: var(--vm-surface-soft); color: var(--vm-ink); }
.pe-ibtn :deep(svg) { width: 17px; height: 17px; }
.pe-btn:focus-visible, .pe-ibtn:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

.spin { animation: pe-spin 1s linear infinite; }
@keyframes pe-spin { to { transform: rotate(360deg); } }
@keyframes pe-pulse { 50% { opacity: .5; } }

@media (max-width: 900px) { .pe-trigger-t { display: none; } }
@media (max-width: 640px) {
  .pe-overlay { padding: 12px; }
  .pe-add-row { grid-template-columns: 1fr; }
  .pe-input { min-height: 44px; font-size: 16px; }
  .pe-input.mono { font-size: 15px; }
  .pe-btn, .pe-ibtn, .pe-trigger { min-height: 44px; }
  .pe-ibtn, .pe-ibtn.sm { width: 44px; height: 44px; }
}
@media (prefers-reduced-motion: reduce) { .spin, .pe-skel span { animation: none; } }
</style>
