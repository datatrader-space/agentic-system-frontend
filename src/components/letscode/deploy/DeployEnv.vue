<template>
  <section class="de" aria-labelledby="de-h">
    <div>
      <h3 id="de-h" class="h">Environment variables</h3>
      <p class="p">Secrets your app needs on Vercel. Values are stored as sensitive: no one can read them back, not even AADML.</p>
    </div>

    <div v-for="f in envFiles" :key="f" class="imp">
      <Icon icon="lucide:shield-alert" class="imp-ic" aria-hidden="true" />
      <span><code>{{ f }}</code> was not uploaded with the project.</span>
      <button type="button" class="btn sm" :disabled="importing === f" @click="importFile(f)">
        <Icon :icon="importing === f ? 'lucide:loader-2' : 'lucide:copy-plus'" :class="{ spin: importing === f }" aria-hidden="true" /> Copy its values to Vercel
      </button>
    </div>

    <form class="add" @submit.prevent="save">
      <div class="f">
        <label for="de-key">Name</label>
        <input id="de-key" v-model="key" class="inp mono" type="text" autocomplete="off" spellcheck="false" placeholder="DATABASE_URL" :disabled="saving" />
      </div>
      <div class="f grow">
        <label for="de-val">Value</label>
        <input id="de-val" v-model="value" class="inp mono" type="password" autocomplete="new-password" spellcheck="false" placeholder="••••••••" :disabled="saving" />
      </div>
      <fieldset class="f tg">
        <legend>Environments</legend>
        <label><input v-model="targets" type="checkbox" value="production" /> Production</label>
        <label><input v-model="targets" type="checkbox" value="preview" /> Preview</label>
      </fieldset>
      <button type="submit" class="btn primary" :disabled="saving || !key.trim() || !targets.length">
        <Icon :icon="saving ? 'lucide:loader-2' : 'lucide:plus'" :class="{ spin: saving }" aria-hidden="true" /> Save
      </button>
    </form>
    <p v-if="error" class="err" role="alert">{{ error }}</p>

    <ul v-if="loading" class="list" aria-busy="true"><li class="skel"></li><li class="skel"></li></ul>
    <p v-else-if="!env.length" class="empty">No environment variables yet.</p>
    <ul v-else class="list">
      <li v-for="e in env" :key="e.id" class="row">
        <span class="mono k">{{ e.key }}</span>
        <span class="mono dots" aria-label="Value hidden">••••••••</span>
        <span class="t">{{ targetText(e.target) }}</span>
        <button type="button" class="ibtn" :aria-label="`Remove ${e.key}`" :disabled="busy === e.id" @click="remove(e)"><Icon icon="lucide:trash-2" /></button>
      </li>
    </ul>
    <p class="fine">A change applies to the next deploy.</p>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import api from '@/services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'

const props = defineProps({
  repoId: { type: Number, required: true },
  skippedPaths: { type: Array, default: () => [] },
})
const env = ref([])
const loading = ref(false)
const key = ref('')
const value = ref('')
const targets = ref(['production', 'preview'])
const saving = ref(false)
const error = ref('')
const busy = ref('')
const importing = ref('')
const errorOf = (e, f) => e?.response?.data?.error || e?.message || f

// Only .env files are offered for copying; keys and certificates are not settings.
const envFiles = computed(() => props.skippedPaths.filter((p) => /(^|\/)\.env(\.|$)/.test(p)))
const targetText = (t) => (t || []).map((x) => x[0].toUpperCase() + x.slice(1)).join(' · ')

async function load() {
  loading.value = true
  try { env.value = (await api.getVercelEnv(props.repoId)).data.env || [] }
  catch (e) { notify.error(errorOf(e, 'Could not load the environment variables')) }
  finally { loading.value = false }
}
async function save() {
  saving.value = true
  error.value = ''
  try {
    const { data } = await api.setVercelEnv(props.repoId, [{ key: key.value.trim(), value: value.value, target: targets.value }])
    if (data.failed?.length) error.value = data.failed.map((f) => `${f.key}: ${f.message}`).join(' ')
    else { key.value = ''; value.value = '' }
    await load()
  } catch (e) { error.value = errorOf(e, 'The variable was not saved') }
  finally { saving.value = false; value.value = error.value ? value.value : '' }
}
async function remove(e) {
  if (!(await confirm({ title: `Remove ${e.key}?`, message: 'The next deploy will not have this variable.', confirmText: 'Remove', danger: true }))) return
  busy.value = e.id
  try { await api.deleteVercelEnv(props.repoId, e.id); env.value = env.value.filter((x) => x.id !== e.id) }
  catch (err) { notify.error(errorOf(err, 'Could not remove the variable')) }
  finally { busy.value = '' }
}
async function importFile(path) {
  if (!(await confirm({ title: `Copy ${path} to Vercel?`, message: `Every value in ${path} is saved to this project on Vercel for production and preview. The values are not shown to anyone.`, confirmText: 'Copy values' }))) return
  importing.value = path
  try {
    const { data } = await api.importVercelEnv(props.repoId, path, ['production', 'preview'])
    const n = (data.saved || []).length
    notify.success(`${n} ${n === 1 ? 'variable' : 'variables'} copied from ${path}`)
    if (data.skipped?.length) notify.error(`Not copied (names Vercel does not allow): ${data.skipped.join(', ')}`)
    await load()
  } catch (e) { notify.error(errorOf(e, `Could not copy ${path}`)) }
  finally { importing.value = '' }
}
onMounted(load)
defineExpose({ load })
</script>

<style scoped>
.de { display: flex; flex-direction: column; gap: 14px; }
.h { margin: 0; font: 700 15px var(--vm-font-sans); }
.p { margin: 4px 0 0; font-size: 13px; line-height: 1.5; color: var(--vm-ink-soft); }
.mono { font-family: var(--vm-font-mono); }
.imp { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; padding: 10px 12px; border: 1px dashed color-mix(in srgb, var(--vm-amber) 55%, transparent); border-radius: 12px; background: color-mix(in srgb, var(--vm-amber) 7%, transparent); font-size: 13px; }
.imp-ic { width: 16px; height: 16px; color: color-mix(in srgb, var(--vm-amber) 70%, var(--vm-ink)); }
.imp code { font: 12.5px var(--vm-font-mono); }
.imp .btn { margin-left: auto; }
.add { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; padding: 12px; border: 1px solid var(--vm-line-2); border-radius: 12px; background: var(--vm-surface-soft); }
.f { display: flex; flex-direction: column; gap: 5px; min-width: 150px; }
.f.grow { flex: 1; }
.f label, .f legend { font: 600 12px var(--vm-font-sans); color: var(--vm-ink-soft); }
.tg { border: none; margin: 0; padding: 0; min-width: 0; }
.tg label { display: inline-flex; align-items: center; gap: 6px; margin-right: 12px; min-height: 38px; font: 500 13px var(--vm-font-sans); color: var(--vm-ink); cursor: pointer; }
.inp { min-height: 38px; padding: 0 12px; border: 1px solid var(--vm-line-2); border-radius: var(--vm-r); background: var(--vm-surface); color: var(--vm-ink); font-size: 13.5px; }
.inp:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.err { margin: -6px 0 0; color: var(--vm-danger); font-size: 13px; }
.empty, .fine { margin: 0; font-size: 12.5px; color: var(--vm-ink-soft); }
.list { list-style: none; margin: 0; padding: 0; border: 1px solid var(--vm-line-2); border-radius: 12px; overflow: hidden; }
.skel { height: 44px; background: var(--vm-surface-soft); border-top: 1px solid var(--vm-line); }
.row { display: flex; align-items: center; gap: 12px; padding: 9px 12px; background: var(--vm-surface); }
.row + .row { border-top: 1px solid var(--vm-line); }
.k { font-size: 13px; word-break: break-all; }
.dots { color: var(--vm-ink-faint); font-size: 13px; }
.t { margin-left: auto; font-size: 12px; color: var(--vm-ink-soft); white-space: nowrap; }
.btn { display: inline-flex; align-items: center; gap: 6px; min-height: 38px; padding: 0 14px; border: 1px solid var(--vm-line-2); border-radius: var(--vm-r); background: var(--vm-surface); color: var(--vm-ink); font: 600 13px var(--vm-font-sans); cursor: pointer; }
.btn.sm { min-height: 30px; padding: 0 10px; font-size: 12.5px; }
.btn.primary { background: var(--vm-violet); border-color: var(--vm-violet); color: #fff; }
.btn:hover:not(:disabled) { border-color: var(--vm-violet); }
.btn.primary:hover:not(:disabled) { background: var(--vm-violet-d); }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.btn :deep(svg) { width: 14px; height: 14px; }
.ibtn { display: grid; place-items: center; width: 30px; height: 30px; border: none; border-radius: 7px; background: transparent; color: var(--vm-ink-soft); cursor: pointer; }
.ibtn:hover:not(:disabled) { background: var(--vm-surface-soft); color: var(--vm-ink); }
.ibtn :deep(svg) { width: 14px; height: 14px; }
.btn:focus-visible, .ibtn:focus-visible, .tg input:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 640px) { .inp, .btn { min-height: 44px; font-size: 16px; } .f { width: 100%; } .ibtn { width: 44px; height: 44px; } }
@media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
</style>
