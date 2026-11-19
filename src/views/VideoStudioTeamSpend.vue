<template>
  <!-- Team spend in Video Studio (ADM-1248): what each member of a workspace spent this month from their own balance,
       and the monthly limit or pause their admins set. The server decides what each person sees: admins, the
       organization's owner and the billing role see everyone; others see their own row. -->
  <section class="vts" aria-labelledby="vts-title" data-test="team-spend">
    <header class="vts-head">
      <h1 id="vts-title">Team spend</h1>
      <p>Everyone pays for what they make from their own balance. A workspace admin can set a monthly limit for a member, or pause their renders. A render that would pass the limit is not started, and nothing is charged.</p>
    </header>
    <div class="vts-controls">
      <label v-if="workspaces.length" class="vts-field"><span>Workspace</span>
        <select :value="workspaceId" data-test="vts-workspace" @change="chooseWorkspace($event.target.value)"><option v-if="!workspaceId" value="" disabled>Choose a workspace</option><option v-for="w in workspaces" :key="w.id" :value="String(w.id)">{{ w.name }}{{ w.org_name && w.org_name !== w.name ? ` (${w.org_name})` : '' }}</option></select></label>
      <p v-if="data" class="vts-month">Month: {{ monthName }}</p>
    </div>
    <p v-if="!workspaces.length && !loading" class="vts-note">You are not in a workspace yet.</p>
    <p v-else-if="workspaces.length && !workspaceId && !loading" class="vts-note" data-test="vts-choose">You are in personal mode. Choose a workspace to see what its members spent.</p>
    <p v-if="loading" class="vts-note" role="status">Loading spend…</p>
    <p v-else-if="error" class="vts-bad" role="alert">{{ error }} <button type="button" class="vts-btn" @click="load">Try again</button></p>
    <div v-else-if="data" class="vts-table-wrap">
      <table class="vts-table">
        <caption class="vts-sr">Video Studio spend by member in {{ data.workspace?.name }}</caption>
        <thead><tr><th scope="col">Member</th><th scope="col">Spent</th><th scope="col">Held now</th><th scope="col">Monthly limit</th><th scope="col">Renders</th><th v-if="data.can_manage" scope="col"><span class="vts-sr">Save</span></th></tr></thead>
        <tbody>
          <tr v-for="m in data.members" :key="m.user.id" data-test="vts-row">
            <th scope="row"><strong>{{ personName(m.user, me) }}</strong><small>{{ [personDetail(m.user, me), m.role].filter(Boolean).join(', ') }}</small></th>
            <td data-label="Spent">{{ money(m.spent_usd) }}<span v-if="m.monthly_limit_usd != null" class="vts-meter" :style="{ '--p': pct(m) }" aria-hidden="true"></span></td>
            <td data-label="Held now">{{ money(m.held_usd) }}</td>
            <td data-label="Monthly limit">
              <template v-if="data.can_manage">
                <label class="vts-sr" :for="`vts-limit-${m.user.id}`">Monthly limit for {{ isMe(m.user, me) ? 'you' : personName(m.user, me) }} in dollars, blank for no limit</label>
                <span class="vts-money"><span aria-hidden="true">$</span><input :id="`vts-limit-${m.user.id}`" v-model.trim="edits[m.user.id].limit" type="text" inputmode="decimal" placeholder="No limit" data-test="vts-limit" /></span>
              </template>
              <template v-else>{{ m.monthly_limit_usd != null ? money(m.monthly_limit_usd) : 'No limit' }}</template>
            </td>
            <td data-label="Renders">
              <label v-if="data.can_manage" class="vts-check"><input v-model="edits[m.user.id].paused" type="checkbox" data-test="vts-paused" /> Paused</label>
              <template v-else>{{ m.paused ? 'Paused' : 'Allowed' }}</template>
            </td>
            <td v-if="data.can_manage" class="vts-save">
              <button type="button" class="vts-btn" :disabled="!dirty(m) || !valid(m) || saving === m.user.id" data-test="vts-save" @click="save(m)">{{ saving === m.user.id ? 'Saving…' : 'Save' }}</button>
              <small v-if="!valid(m)" class="vts-bad">Enter an amount like 25 or 25.50.</small>
            </td>
          </tr>
          <tr v-if="!data.members.length"><td :colspan="data.can_manage ? 6 : 5">No member has spent anything this month.</td></tr>
        </tbody>
      </table>
      <p v-if="saveError" class="vts-bad" role="alert" data-test="vts-error">{{ saveError }}</p>
      <p v-else-if="saved" class="vts-ok" role="status">{{ saved }}</p>
    </div>
  </section>
</template>

<script setup>
import { computed, inject, onMounted, reactive, ref } from 'vue'
import { errorText, isMe, money, personDetail, personName, sharing } from '../services/studioSharing'
import { useStudioWorkspace } from '../composables/useStudioWorkspace'

// The workspace the Studio menu shows, kept in step with it (ISSUE-19).
const { workspaces, workspaceId, loadWorkspaces, chooseWorkspace } = useStudioWorkspace({ onChange: () => load() })
// The signed-in person (the Studio shell provides it): their own row says "You" (ISSUE-15).
const me = inject('studioUser', ref(null))
const data = ref(null), loading = ref(true), error = ref('')
const edits = reactive({}), saving = ref(null), saveError = ref(''), saved = ref('')
const monthName = computed(() => {
  const m = /^(\d{4})-(\d{2})$/.exec(data.value?.month || '')
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : data.value?.month || ''
})
const AMOUNT = /^\d{1,7}(\.\d{1,2})?$/
function pct(m) { const lim = Number(m.monthly_limit_usd); return lim > 0 ? `${Math.min(100, (Number(m.spent_usd) + Number(m.held_usd || 0)) / lim * 100)}%` : '100%' }
function valid(m) { const v = edits[m.user.id]?.limit ?? ''; return v === '' || AMOUNT.test(v) }
function dirty(m) {
  const e = edits[m.user.id]; if (!e) return false
  const was = m.monthly_limit_usd == null ? '' : String(Number(m.monthly_limit_usd))
  return (e.limit === '' ? '' : String(Number(e.limit))) !== was || !!e.paused !== !!m.paused
}
function resetEdits() {
  Object.keys(edits).forEach(k => delete edits[k])
  for (const m of data.value?.members || []) edits[m.user.id] = { limit: m.monthly_limit_usd == null ? '' : String(Number(m.monthly_limit_usd)), paused: !!m.paused }
}
async function load() {
  if (!workspaceId.value) { data.value = null; loading.value = false; return }
  loading.value = true; error.value = ''; saved.value = ''; saveError.value = ''
  try { data.value = (await sharing.memberSpend(workspaceId.value)).data; resetEdits() }
  catch (e) { data.value = null; error.value = errorText(e, 'Spend could not be loaded.') } finally { loading.value = false }
}
async function save(m) {
  const e = edits[m.user.id]
  saving.value = m.user.id; saveError.value = ''; saved.value = ''
  try {
    const { data: row } = await sharing.setMemberSpend(workspaceId.value, m.user.id, { monthly_limit_usd: e.limit === '' ? null : Number(e.limit).toFixed(2), paused: !!e.paused })
    Object.assign(m, row); edits[m.user.id] = { limit: m.monthly_limit_usd == null ? '' : String(Number(m.monthly_limit_usd)), paused: !!m.paused }
    saved.value = isMe(m.user, me.value) ? 'Saved for you.' : `Saved for ${personName(m.user, me.value)}.`
  } catch (err) { saveError.value = errorText(err, 'The limit could not be saved.') } finally { saving.value = null }
}
onMounted(async () => {
  await loadWorkspaces()
  await load()
})
</script>

<style scoped>
.vts{display:grid;gap:18px;align-content:start;box-sizing:border-box;max-width:100%;min-width:0;padding:28px 32px 32px;color:var(--vm-ink)}.vts>*{min-width:0}
.vts-head{display:grid;gap:8px;max-width:720px}.vts h1{margin:0;font-size:26px;font-weight:550;letter-spacing:-.03em}.vts-head p{margin:0;font-size:13px;line-height:1.7;color:var(--vm-ink-soft)}
.vts-controls{display:flex;flex-wrap:wrap;align-items:flex-end;gap:16px}.vts-field{display:grid;gap:5px;font-size:11.5px;color:var(--vm-ink-soft)}
.vts select,.vts input[type=text]{min-height:40px;box-sizing:border-box;padding:0 10px;border:1px solid var(--vm-line);border-radius:6px;background:var(--vm-surface);color:var(--vm-ink);font:inherit;font-size:13px}
.vts-month{margin:0 0 10px;font-size:13px;color:var(--vm-ink-soft)}
.vts-table-wrap{display:grid;gap:10px}
.vts-table{width:100%;border-collapse:collapse;font-size:13px}.vts-table th,.vts-table td{padding:12px 10px;border-bottom:1px solid var(--vm-line-2);text-align:left;vertical-align:middle}
.vts-table thead th{font-size:11.5px;font-weight:500;color:var(--vm-ink-soft)}.vts-table tbody th{display:grid;gap:2px;font-weight:500}.vts-table small{font-size:11.5px;color:var(--vm-ink-soft);font-weight:400}
.vts-table td{font-variant-numeric:tabular-nums}
.vts-meter{display:block;width:90px;height:4px;margin-top:6px;border-radius:2px;background:linear-gradient(90deg,var(--vm-violet) var(--p),var(--vm-line-2) var(--p))}
.vts-money{display:inline-flex;align-items:center;gap:4px}.vts-money input{width:110px}
.vts-check{display:inline-flex;align-items:center;gap:6px;min-height:40px;cursor:pointer}.vts-check input{width:17px;height:17px;accent-color:var(--vm-violet)}
.vts-btn{min-height:36px;padding:0 12px;border:1px solid var(--vm-line);border-radius:6px;background:transparent;color:var(--vm-ink);font:inherit;font-size:12.5px;font-weight:500;cursor:pointer}.vts-btn:hover:not(:disabled){background:var(--vm-surface-2)}.vts-btn:disabled{opacity:.5;cursor:not-allowed}
.vts-note{margin:0;font-size:13px;color:var(--vm-ink-soft)}.vts-bad{margin:0;color:var(--vs-bad-ink);font-size:12.5px}.vts-ok{margin:0;color:var(--vs-ok-ink);font-size:12.5px}
.vts-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.vts :focus-visible{outline:2px solid var(--vs-accent-ink,var(--vm-link));outline-offset:2px}
@media(max-width:1023px){.vts{padding-left:calc(16px + var(--vs-bar-inset, 0px))}}
/* A phone (ISSUE-17): each member is a stacked card, every value on its own labelled line, nothing wider than the
   screen, so the page never scrolls sideways. */
@media(max-width:720px){.vts{padding:18px 16px}.vts h1{font-size:22px}.vts select,.vts input[type=text]{font-size:16px;min-height:44px}.vts-btn{min-height:44px}
  .vts-field,.vts-field select{width:100%;max-width:100%}.vts-controls{display:grid;gap:10px}.vts-month{margin:0}
  .vts-table,.vts-table tbody,.vts-table tr{display:block;width:100%;box-sizing:border-box}
  .vts-table thead{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
  .vts-table tr{display:grid;gap:6px;padding:14px 0;border-bottom:1px solid var(--vm-line-2)}
  .vts-table th,.vts-table td{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 12px;min-width:0;padding:4px 0;border:0}
  .vts-table tbody th{display:grid;gap:2px;overflow-wrap:anywhere}.vts-table tbody th small{overflow-wrap:anywhere}
  .vts-table td::before{content:attr(data-label);font-size:11.5px;color:var(--vm-ink-soft)}
  .vts-money{flex:0 1 auto;min-width:0}.vts-money input{width:min(140px,100%)}
  .vts-meter{flex-basis:100%;width:100%}
  .vts-table td.vts-save{display:grid;gap:6px}.vts-table td.vts-save::before{content:none}.vts-save .vts-btn{width:100%}
  .vts-table tbody td[colspan]{display:block}.vts-table tbody td[colspan]::before{content:none}}
</style>
