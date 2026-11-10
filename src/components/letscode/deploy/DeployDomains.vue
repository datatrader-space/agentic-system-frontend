<template>
  <section class="dd" aria-labelledby="dd-h">
    <div class="dd-head">
      <h3 id="dd-h" class="h">Custom domains</h3>
      <p class="p">Point your own domain at this project. Add it here, then create the DNS record shown at your domain's provider.</p>
    </div>

    <form class="add" @submit.prevent="add">
      <label class="sr-only" for="dd-name">Domain</label>
      <input id="dd-name" v-model="name" class="inp" type="text" inputmode="url" autocomplete="off" spellcheck="false"
             placeholder="www.example.com" :disabled="adding" :aria-invalid="!!addError" aria-describedby="dd-err" />
      <button type="submit" class="btn primary" :disabled="adding || !name.trim()">
        <Icon :icon="adding ? 'lucide:loader-2' : 'lucide:plus'" :class="{ spin: adding }" aria-hidden="true" /> Add
      </button>
    </form>
    <p v-if="addError" id="dd-err" class="err" role="alert">{{ addError }}</p>

    <ul v-if="loading" class="list" aria-busy="true"><li class="skel"></li><li class="skel"></li></ul>
    <p v-else-if="!domains.length" class="empty">No custom domain yet. Your project is reachable on its vercel.app address.</p>
    <ul v-else class="list">
      <li v-for="d in domains" :key="d.name" class="dom">
        <div class="dom-top">
          <span class="dot" :class="toneOf(d)" aria-hidden="true"></span>
          <span class="dom-name">{{ d.name }}</span>
          <span class="dom-state" :class="toneOf(d)">{{ stateOf(d) }}</span>
          <button v-if="toneOf(d) !== 'ok'" type="button" class="btn sm" :disabled="busy === d.name" @click="verify(d)">
            <Icon :icon="busy === d.name ? 'lucide:loader-2' : 'lucide:refresh-cw'" :class="{ spin: busy === d.name }" aria-hidden="true" /> Check again
          </button>
          <button type="button" class="ibtn" :aria-label="`Remove ${d.name}`" :disabled="busy === d.name" @click="remove(d)"><Icon icon="lucide:trash-2" /></button>
        </div>
        <div v-if="toneOf(d) !== 'ok' && (d.verification?.length || d.dns?.length)" class="dns">
          <p class="dns-h">Create {{ (d.verification?.length || 0) + (d.dns?.length || 0) === 1 ? 'this record' : 'these records' }} at your DNS provider:</p>
          <table>
            <thead><tr><th scope="col">Type</th><th scope="col">Name</th><th scope="col">Value</th><th><span class="sr-only">Copy</span></th></tr></thead>
            <tbody>
              <tr v-for="r in records(d)" :key="r.type + r.name + r.value">
                <td class="mono">{{ r.type }}</td><td class="mono">{{ r.name }}</td><td class="mono val">{{ r.value }}</td>
                <td><button type="button" class="ibtn" :aria-label="`Copy ${r.type} value`" @click="copy(r.value)"><Icon icon="lucide:copy" /></button></td>
              </tr>
            </tbody>
          </table>
          <p class="fine">DNS changes can take a few minutes to an hour. Vercel issues the HTTPS certificate once the record is found.</p>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import api from '@/services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'

const props = defineProps({ repoId: { type: Number, required: true } })
const domains = ref([])
const loading = ref(false)
const name = ref('')
const adding = ref(false)
const addError = ref('')
const busy = ref('')
const errorOf = (e, f) => e?.response?.data?.error || e?.message || f

const toneOf = (d) => (d.verified && d.configured !== false ? 'ok' : 'wait')
const stateOf = (d) => (!d.verified ? 'Needs verification' : d.configured === false ? 'Set the DNS record' : 'Valid configuration')
function records(d) {
  const out = (d.verification || []).map((v) => ({ type: v.type, name: v.domain, value: v.value }))
  if (d.verified || !out.length) out.push(...(d.dns || []))
  return out
}

async function load() {
  loading.value = true
  try { domains.value = (await api.getVercelDomains(props.repoId)).data.domains || [] }
  catch (e) { notify.error(errorOf(e, 'Could not load the domains')) }
  finally { loading.value = false }
}
async function add() {
  adding.value = true
  addError.value = ''
  try {
    const { data } = await api.addVercelDomain(props.repoId, name.value.trim())
    domains.value = [data, ...domains.value.filter((d) => d.name !== data.name)]
    name.value = ''
  } catch (e) { addError.value = errorOf(e, 'The domain was not added') }
  finally { adding.value = false }
}
async function verify(d) {
  busy.value = d.name
  try {
    const { data } = await api.verifyVercelDomain(props.repoId, d.name)
    domains.value = domains.value.map((x) => (x.name === d.name ? data : x))
    if (toneOf(data) !== 'ok') notify.error('Not found yet. DNS changes can take a while; try again in a few minutes.')
  } catch (e) { notify.error(errorOf(e, 'Could not check the domain')) }
  finally { busy.value = '' }
}
async function remove(d) {
  if (!(await confirm({ title: `Remove ${d.name}?`, message: 'The domain stops pointing at this project on Vercel. Your DNS records are not changed.', confirmText: 'Remove', danger: true }))) return
  busy.value = d.name
  try {
    await api.removeVercelDomain(props.repoId, d.name)
    domains.value = domains.value.filter((x) => x.name !== d.name)
  } catch (e) { notify.error(errorOf(e, 'Could not remove the domain')) }
  finally { busy.value = '' }
}
async function copy(v) {
  try { await navigator.clipboard.writeText(v); notify.success('Copied') } catch { /* no clipboard here */ }
}
onMounted(load)
defineExpose({ load })
</script>

<style scoped>
.dd { display: flex; flex-direction: column; gap: 14px; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.h { margin: 0; font: 700 15px var(--vm-font-sans); }
.p { margin: 4px 0 0; font-size: 13px; line-height: 1.5; color: var(--vm-ink-soft); }
.add { display: flex; gap: 8px; }
.inp { flex: 1; min-width: 0; min-height: 38px; padding: 0 12px; border: 1px solid var(--vm-line-2); border-radius: var(--vm-r); background: var(--vm-surface); color: var(--vm-ink); font: 14px var(--vm-font-sans); }
.inp:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.err { margin: -6px 0 0; color: var(--vm-danger); font-size: 13px; }
.empty { margin: 0; font-size: 13px; color: var(--vm-ink-soft); }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.skel { height: 52px; border-radius: 12px; background: var(--vm-surface-soft); }
.dom { padding: 12px 14px; border: 1px solid var(--vm-line-2); border-radius: 12px; background: var(--vm-surface-soft); }
.dom-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.dot { width: 9px; height: 9px; border-radius: 50%; }
.dot.ok { background: var(--vm-green, #16a34a); }
.dot.wait { background: var(--vm-amber); }
.dom-name { font: 700 14px var(--vm-font-sans); word-break: break-all; }
.dom-state { margin-left: auto; font: 500 12.5px var(--vm-font-sans); }
.dom-state.ok { color: color-mix(in srgb, var(--vm-green, #16a34a) 80%, var(--vm-ink)); }
.dom-state.wait { color: color-mix(in srgb, var(--vm-amber) 70%, var(--vm-ink)); }
.dns { margin-top: 10px; }
.dns-h { margin: 0 0 6px; font-size: 13px; color: var(--vm-ink-soft); }
table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
th { text-align: left; font: 600 11.5px var(--vm-font-sans); color: var(--vm-ink-soft); padding: 4px 8px 4px 0; }
td { padding: 6px 8px 6px 0; border-top: 1px solid var(--vm-line); vertical-align: middle; }
.mono { font-family: var(--vm-font-mono); }
.val { word-break: break-all; }
.fine { margin: 8px 0 0; font-size: 12px; color: var(--vm-ink-soft); }
.btn { display: inline-flex; align-items: center; gap: 6px; min-height: 38px; padding: 0 14px; border: 1px solid var(--vm-line-2); border-radius: var(--vm-r); background: var(--vm-surface); color: var(--vm-ink); font: 600 13px var(--vm-font-sans); cursor: pointer; }
.btn.sm { min-height: 30px; padding: 0 10px; font-size: 12.5px; }
.btn.primary { background: var(--vm-violet); border-color: var(--vm-violet); color: #fff; }
.btn:hover:not(:disabled) { border-color: var(--vm-violet); }
.btn.primary:hover:not(:disabled) { background: var(--vm-violet-d); }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.btn :deep(svg) { width: 14px; height: 14px; }
.ibtn { display: grid; place-items: center; width: 30px; height: 30px; border: none; border-radius: 7px; background: transparent; color: var(--vm-ink-soft); cursor: pointer; }
.ibtn:hover:not(:disabled) { background: var(--vm-surface); color: var(--vm-ink); }
.ibtn :deep(svg) { width: 14px; height: 14px; }
.btn:focus-visible, .ibtn:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 640px) { .inp, .btn { min-height: 44px; font-size: 16px; } .ibtn { width: 44px; height: 44px; } .dom-state { margin-left: 0; width: 100%; } }
@media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
</style>
