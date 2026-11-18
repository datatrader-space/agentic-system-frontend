<template>
  <!-- Who can open a project and how (ADM-1248). Managers change it; everyone else sees who has access. The server
       checks every change; this dialog only hides what the person's abilities do not allow. -->
  <div v-if="open" class="psd-scrim" data-test="share-dialog" @click.self="close">
    <section ref="panel" class="psd" role="dialog" aria-modal="true" :aria-labelledby="titleId" tabindex="-1" @keydown.esc.prevent="close" @keydown.tab="trap">
      <header class="psd-head">
        <h2 :id="titleId">Share “{{ title || 'Untitled video' }}”</h2>
        <button type="button" class="psd-x" aria-label="Close sharing" @click="close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
      </header>

      <p v-if="loading" class="psd-note" role="status">Loading who has access…</p>
      <p v-else-if="loadError" class="psd-note psd-bad" role="alert">{{ loadError }} <button type="button" class="psd-btn" @click="load">Try again</button></p>

      <template v-else-if="access">
        <p v-if="!can.manage" class="psd-note" data-test="share-readonly">You are {{ article(roleLabel(access.my_role)) }} on this project. Only its owner and managers change who has access.</p>

        <section class="psd-sec" aria-labelledby="psd-people">
          <h3 id="psd-people">People with access</h3>
          <ul class="psd-people">
            <li v-for="m in access.members" :key="m.user_id + m.source" data-test="share-member">
              <span class="psd-avatar" aria-hidden="true">{{ initials(m.name || m.email) }}</span>
              <span class="psd-who"><strong>{{ m.name || m.email }}</strong><small>{{ m.email }}<template v-if="m.source === 'workspace'">, from the workspace</template></small></span>
              <span v-if="m.source === 'owner'" class="psd-role">Owner</span>
              <template v-else-if="can.manage && m.source === 'invite'">
                <label class="psd-sr" :for="`psd-role-${m.user_id}`">Role for {{ m.name || m.email }}</label>
                <select :id="`psd-role-${m.user_id}`" class="psd-select" :value="m.role" :disabled="busy" @change="changeRole(m, $event.target.value)">
                  <option v-for="r in INVITE_ROLES" :key="r" :value="r">{{ ROLE_LABELS[r] }}</option>
                </select>
                <button type="button" class="psd-btn quiet" :disabled="busy" :aria-label="`Remove ${m.name || m.email}`" data-test="share-remove" @click="removeMember(m)">Remove</button>
              </template>
              <span v-else class="psd-role">{{ roleLabel(m.role) }}</span>
            </li>
          </ul>
          <form v-if="can.manage" class="psd-row" data-test="share-invite" @submit.prevent="invite">
            <label class="psd-field grow"><span>Invite by email</span><input v-model.trim="email" type="email" autocomplete="email" placeholder="name@company.com" required /></label>
            <label class="psd-field"><span>Role</span>
              <select v-model="inviteRole" class="psd-select"><option v-for="r in INVITE_ROLES" :key="r" :value="r">{{ ROLE_LABELS[r] }}</option></select>
            </label>
            <button type="submit" class="psd-btn primary" :disabled="busy || !email">Invite</button>
          </form>
          <p v-if="can.manage" class="psd-hint">{{ ROLE_HELP[inviteRole] }}. People you invite must be in this project's workspace.</p>
        </section>

        <section v-if="can.manage && access.workspace" class="psd-sec" aria-labelledby="psd-ws">
          <h3 id="psd-ws">Workspace</h3>
          <label class="psd-switch">
            <input type="checkbox" role="switch" :checked="access.visibility === 'workspace'" :disabled="busy" data-test="share-visibility" @change="setVisibility($event.target.checked)" />
            <span>Everyone in {{ access.workspace.name }} can open this project</span>
          </label>
          <p class="psd-hint">Admins become managers, members editors and viewers viewers. Billing members never see projects.</p>
        </section>

        <section v-if="can.manage" class="psd-sec" aria-labelledby="psd-links">
          <h3 id="psd-links">Links</h3>
          <ul v-if="(access.links || []).length" class="psd-links">
            <li v-for="l in access.links" :key="l.link_id" data-test="share-link">
              <span class="psd-who"><strong>{{ LINK_PERMISSIONS[l.permission] }}, {{ LINK_AUDIENCES[l.audience].toLowerCase() }}</strong>
                <small>Ends {{ day(l.expires_at) }}. Opened {{ l.use_count || 0 }} {{ l.use_count === 1 ? 'time' : 'times' }}{{ l.last_used_at ? `, last ${day(l.last_used_at)}` : '' }}.</small></span>
              <button type="button" class="psd-btn quiet" :disabled="busy" data-test="share-revoke" @click="revoke(l)">Revoke</button>
            </li>
          </ul>
          <p v-else class="psd-hint">No links yet. A link works only for people who are signed in.</p>
          <form class="psd-row" data-test="share-link-form" @submit.prevent="makeLink">
            <label class="psd-field"><span>Permission</span>
              <select v-model="linkPermission" class="psd-select"><option v-for="(label, k) in LINK_PERMISSIONS" :key="k" :value="k">{{ label }}</option></select>
            </label>
            <label class="psd-field"><span>Who can use it</span>
              <select v-model="linkAudience" class="psd-select">
                <option value="workspace">{{ LINK_AUDIENCES.workspace }}</option>
                <option value="anyone" :disabled="linkPermission === 'edit'">{{ LINK_AUDIENCES.anyone }}</option>
              </select>
            </label>
            <label class="psd-field small"><span>Days</span><input v-model.number="linkDays" type="number" min="1" max="90" required /></label>
            <button type="submit" class="psd-btn primary" :disabled="busy || !validDays">Create link</button>
          </form>
          <p v-if="linkPermission === 'edit'" class="psd-hint">Edit links work only for people in this workspace.</p>
          <div v-if="newLink" class="psd-new" data-test="share-new-link">
            <p>Copy this link now. It is shown only once.</p>
            <div class="psd-row"><label class="psd-sr" for="psd-url">New link</label><input id="psd-url" ref="urlInput" class="psd-url" :value="newLink" readonly @focus="$event.target.select()" />
              <button type="button" class="psd-btn" data-test="share-copy" @click="copy">{{ copied ? 'Copied' : 'Copy link' }}</button></div>
          </div>
        </section>

        <section v-if="can.own && transferable.length" class="psd-sec" aria-labelledby="psd-owner">
          <h3 id="psd-owner">Ownership</h3>
          <div class="psd-row">
            <label class="psd-field grow"><span>Make someone else the owner</span>
              <select v-model="transferTo" class="psd-select" data-test="share-transfer-select"><option value="">Choose a person</option><option v-for="m in transferable" :key="m.user_id" :value="String(m.user_id)">{{ m.name || m.email }}</option></select>
            </label>
            <button v-if="!confirmTransfer" type="button" class="psd-btn" :disabled="!transferTo || busy" @click="confirmTransfer = true">Transfer</button>
          </div>
          <div v-if="confirmTransfer" class="psd-confirm" role="group" aria-label="Confirm transfer">
            <p>You will become a manager of this project. The new owner decides who keeps access.</p>
            <button type="button" class="psd-btn danger" :disabled="busy" data-test="share-transfer-confirm" @click="transfer">Transfer ownership</button>
            <button type="button" class="psd-btn quiet" @click="confirmTransfer = false">Keep it</button>
          </div>
        </section>

        <p v-if="error" class="psd-note psd-bad" role="alert" data-test="share-error">{{ error }}</p>
        <p v-else-if="done" class="psd-note psd-ok" role="status">{{ done }}</p>
      </template>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { INVITE_ROLES, LINK_AUDIENCES, LINK_PERMISSIONS, ROLE_HELP, ROLE_LABELS, day, errorText, sharing } from '../../services/studioSharing'

const props = defineProps({ open: { type: Boolean, default: false }, projectId: { type: String, default: '' }, title: { type: String, default: '' } })
const emit = defineEmits(['close', 'changed'])
const titleId = `psd-title-${Math.random().toString(36).slice(2, 8)}`
const panel = ref(null), urlInput = ref(null)
const access = ref(null), loading = ref(false), loadError = ref(''), busy = ref(false), error = ref(''), done = ref('')
const email = ref(''), inviteRole = ref('editor')
const linkPermission = ref('view'), linkAudience = ref('workspace'), linkDays = ref(14), newLink = ref(''), copied = ref(false)
const transferTo = ref(''), confirmTransfer = ref(false)
const can = computed(() => access.value?.abilities || {})
const validDays = computed(() => Number.isInteger(linkDays.value) && linkDays.value >= 1 && linkDays.value <= 90)
const transferable = computed(() => (access.value?.members || []).filter(m => m.source !== 'owner' && m.user_id !== access.value?.owner?.id))
watch(linkPermission, p => { if (p === 'edit') linkAudience.value = 'workspace' })

function roleLabel(r) { return ROLE_LABELS[r] || 'Viewer' }
function article(word) { return /^[AEIOU]/.test(word) ? `an ${word.toLowerCase()}` : `a ${word.toLowerCase()}` }
function initials(s) { return String(s || '?').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') }
let opener = null
async function load() {
  if (!props.projectId) return
  loading.value = true; loadError.value = ''
  try { access.value = (await sharing.access(props.projectId)).data }
  catch (e) { loadError.value = errorText(e, 'Who has access could not be loaded.') }
  finally { loading.value = false }
}
watch(() => [props.open, props.projectId], async ([o]) => {
  if (!o) return
  opener = typeof document !== 'undefined' ? document.activeElement : null
  newLink.value = ''; error.value = ''; done.value = ''; confirmTransfer.value = false
  await load(); await nextTick(); panel.value?.focus?.()
}, { immediate: true })
function close() { emit('close'); nextTick(() => opener?.focus?.()) }
function trap(event) {
  const items = [...(panel.value?.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)') || [])]
  if (!items.length) return
  const i = items.indexOf(document.activeElement)
  if (event.shiftKey && i <= 0) { event.preventDefault(); items.at(-1).focus() }
  else if (!event.shiftKey && i === items.length - 1) { event.preventDefault(); items[0].focus() }
}
async function run(fn, ok) {
  busy.value = true; error.value = ''; done.value = ''
  try { await fn(); done.value = ok; emit('changed') } catch (e) { error.value = errorText(e) } finally { busy.value = false }
}
const invite = () => run(async () => { await sharing.invite(props.projectId, email.value, inviteRole.value); email.value = ''; await load() }, 'Invited.')
const changeRole = (m, role) => run(async () => { await sharing.setRole(props.projectId, m.user_id, role); await load() }, 'Role changed.')
const removeMember = (m) => run(async () => { await sharing.remove(props.projectId, m.user_id); await load() }, `${m.name || m.email} no longer has access.`)
const setVisibility = (on) => run(async () => { access.value = (await sharing.update(props.projectId, { visibility: on ? 'workspace' : 'private' })).data }, on ? 'Shared with the workspace.' : 'Only the people listed can open it.')
const revoke = (l) => run(async () => { await sharing.revokeLink(props.projectId, l.link_id); await load() }, 'Link revoked. It stopped working at once.')
const makeLink = () => run(async () => {
  const { data } = await sharing.createLink(props.projectId, { permission: linkPermission.value, audience: linkAudience.value, expires_in_days: linkDays.value })
  newLink.value = data.url; copied.value = false; await load(); await nextTick(); urlInput.value?.focus?.()
}, 'Link created.')
const transfer = () => run(async () => { access.value = (await sharing.transfer(props.projectId, Number(transferTo.value))).data; transferTo.value = ''; confirmTransfer.value = false }, 'Ownership transferred.')
async function copy() {
  try { await navigator.clipboard.writeText(newLink.value); copied.value = true }
  catch { urlInput.value?.select?.(); error.value = 'Copy did not work here. The link is selected: copy it with your keyboard.' }
}
</script>

<style scoped>
.psd-scrim{position:fixed;inset:0;z-index:50;display:grid;place-items:center;padding:16px;background:var(--vs-scrim,rgba(0,0,0,.6))}
.psd{width:min(640px,100%);max-height:calc(100dvh - 32px);overflow:auto;box-sizing:border-box;padding:22px;border:1px solid var(--vm-line);border-radius:11px;background:var(--vm-surface);color:var(--vm-ink);box-shadow:var(--vm-shadow-l);outline:none}
.psd-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.psd h2{margin:0;font-size:19px;font-weight:550;letter-spacing:-.01em;overflow-wrap:anywhere}
.psd-x{display:grid;place-items:center;width:44px;height:44px;border:0;border-radius:6px;background:none;color:var(--vm-ink-soft);cursor:pointer}.psd-x:hover{background:var(--vm-surface-2);color:var(--vm-ink)}.psd-x svg{width:20px;height:20px}
.psd-sec{display:grid;gap:10px;padding-top:18px;margin-top:18px;border-top:1px solid var(--vm-line-2)}.psd h3{margin:0;font-size:13px;font-weight:600;color:var(--vm-ink)}
.psd-people,.psd-links{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.psd-people li,.psd-links li{display:flex;align-items:center;gap:10px;min-height:44px}
.psd-avatar{display:grid;place-items:center;flex:none;width:30px;height:30px;border-radius:50%;background:var(--vm-primary-soft);color:var(--vs-accent-ink,var(--vm-link));font-size:11px;font-weight:600}
.psd-who{display:grid;gap:2px;flex:1;min-width:0}.psd-who strong{font-size:13px;font-weight:500;overflow-wrap:anywhere}.psd-who small{font-size:11.5px;color:var(--vm-ink-soft);overflow-wrap:anywhere}
.psd-role{font-size:12px;color:var(--vm-ink-soft);white-space:nowrap}
.psd-row{display:flex;flex-wrap:wrap;align-items:flex-end;gap:8px}.psd-field{display:grid;gap:5px;font-size:11.5px;color:var(--vm-ink-soft)}.psd-field.grow{flex:1 1 200px}.psd-field.small input{width:72px}
.psd input:not([type=checkbox]),.psd-select{min-height:40px;box-sizing:border-box;padding:0 10px;border:1px solid var(--vm-line);border-radius:6px;background:var(--vm-bg);color:var(--vm-ink);font:inherit;font-size:13px}
.psd input:focus-visible,.psd-select:focus-visible{outline:2px solid var(--vs-accent-ink,var(--vm-link));outline-offset:1px}
.psd-btn{min-height:40px;padding:0 14px;border:1px solid var(--vm-line);border-radius:6px;background:transparent;color:var(--vm-ink);font:inherit;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap}.psd-btn:hover:not(:disabled){background:var(--vm-surface-2)}.psd-btn:disabled{opacity:.55;cursor:not-allowed}
.psd-btn.primary{background:var(--vm-violet-d);border-color:transparent;color:#fff}.psd-btn.primary:hover:not(:disabled){background:var(--vm-violet)}.psd-btn.quiet{border-color:transparent;color:var(--vm-ink-soft)}.psd-btn.danger{border-color:var(--vm-danger);color:var(--vm-red-ink)}
.psd-switch{display:flex;align-items:center;gap:10px;min-height:44px;font-size:13px;cursor:pointer}.psd-switch input{width:18px;height:18px;accent-color:var(--vm-violet)}
.psd-hint{margin:0;font-size:12px;line-height:1.6;color:var(--vm-ink-soft)}.psd-note{margin:14px 0 0;font-size:13px;line-height:1.6;color:var(--vm-ink-soft)}.psd-bad{color:var(--vs-bad-ink,var(--vm-red-ink))}.psd-ok{color:var(--vs-ok-ink,var(--vm-green-ink))}
.psd-new{display:grid;gap:8px;padding:12px;border:1px solid var(--vm-primary-line);border-radius:8px;background:var(--vm-primary-soft)}.psd-new p{margin:0;font-size:12.5px}.psd-url{flex:1 1 220px;min-width:0}
.psd-confirm{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px;border:1px solid var(--vm-danger);border-radius:8px;background:var(--vm-red-soft)}.psd-confirm p{flex:1 1 100%;margin:0;font-size:12.5px}
.psd-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media(max-width:640px){.psd{padding:16px}.psd input:not([type=checkbox]),.psd-select{font-size:16px;min-height:44px}.psd-btn{min-height:44px}.psd-people li{flex-wrap:wrap}.psd-people li .psd-who{flex-basis:calc(100% - 40px)}}
</style>
