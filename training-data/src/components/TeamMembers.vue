<script setup>
// Members and Roles (workspace settings → Team Members): invite people by e-mail or with a link, the people of this
// workspace with their role in each project, and the invitations still waiting. Backend: api/members.js.
import { computed, onMounted, ref } from 'vue';
import { Mail, Send, Copy, Users, RefreshCw, Power, MoreVertical, Check, ChevronDown } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import UiDialog from './UiDialog.vue';
import { members as api, emailsOf } from '../api/members.js';

const body = ref(null); const loading = ref(true); const error = ref(''); const notice = ref(''); const busy = ref(false);
const emails = ref(''); const name = ref(''); const role = ref('labeller'); const chosen = ref([]); const results = ref([]);
const projectSearch = ref(''); const projectPicker = ref(null);
const projectOptions = computed(() => (body.value?.projects || []).filter(p => p.name.toLowerCase().includes(projectSearch.value.toLowerCase())));
const projectSummary = computed(() => { const selected = (body.value?.projects || []).filter(p => chosen.value.includes(p.id)); return selected.length === 1 ? selected[0].name : selected.length ? `${selected.length} projects selected` : 'Select projects'; });
const linkRole = ref('labeller'); const copied = ref(false);
const sort = ref('name'); const roleFilter = ref('');
const editing = ref(null);                   // {person, entry} while the role menu is open
const removing = ref(null);

function take(answer) { body.value = answer; if (!chosen.value.length && answer.projects.length) chosen.value = [answer.projects[0].id]; }
async function load() {
  loading.value = true; error.value = '';
  try { take(await api.load()); } catch (e) { error.value = e.message; } finally { loading.value = false; }
}
onMounted(load);
async function run(call, said) {
  busy.value = true; error.value = ''; notice.value = '';
  try { const answer = await call(); take(answer); if (said) notice.value = typeof said === 'function' ? said(answer) : said; return answer; }
  catch (e) { error.value = e.message; return null; } finally { busy.value = false; }
}

const roleLabel = value => body.value?.roles.find(r => r.value === value)?.label || value;
const linkRoles = computed(() => (body.value?.roles || []).filter(r => r.by_link));
const several = computed(() => emailsOf(emails.value).length > 1);
// The link that matches the chosen projects and role, while it works.
const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));
const currentLink = computed(() => (body.value?.links || []).find(l => l.state === 'active' && l.may_manage && l.role === linkRole.value
  && sameSet(l.projects.map(p => p.id), chosen.value)) || null);
const otherLinks = computed(() => (body.value?.links || []).filter(l => l !== currentLink.value));
const people = computed(() => {
  const rows = [...(body.value?.people || [])].filter(p => !roleFilter.value || p.roles.some(r => r.role === roleFilter.value));
  return sort.value === 'email' ? rows.sort((a, b) => a.email.localeCompare(b.email)) : rows.sort((a, b) => a.name.localeCompare(b.name));
});
const domain = computed(() => (body.value?.people.find(p => p.you)?.email || '').split('@')[1] || 'your domain');

function toggleProject(id) { chosen.value = chosen.value.includes(id) ? chosen.value.filter(x => x !== id) : [...chosen.value, id]; }
async function invite() {
  results.value = [];
  const answer = await run(() => api.invite({ emails: emailsOf(emails.value), projects: chosen.value, role: role.value, name: name.value }));
  if (answer) { results.value = answer.results; if (answer.results.every(r => r.ok)) { emails.value = ''; name.value = ''; } }
}
const makeLink = () => run(() => api.makeLink({ projects: chosen.value, role: linkRole.value }), 'The link is ready. It works for 7 days or for 25 people.');
const linkAction = (link, action) => run(() => api.link(link.id, action), action === 'renew' ? 'A new link was made; the old one stopped working.' : 'The link was turned off.');
async function copy(link) {
  try { await navigator.clipboard.writeText(link.url); copied.value = true; setTimeout(() => { copied.value = false; }, 1600); }
  catch { notice.value = 'Copy did not work here: select the address and copy it.'; }
}
const changeRole = (person, entry, value) => { editing.value = null; return run(() => api.setRole(person.id, entry.project, value)); };
async function remove() {
  const { person, entry } = removing.value; removing.value = null;
  await run(() => api.removeRole(person.id, entry.project), `${person.name} has no role in “${entry.project_name}” now.`);
}
const invitation = (row, action) => run(() => api.invitation(row.id, action), action === 'resend' ? `The invitation to ${row.email} was sent again.` : `The invitation to ${row.email} was cancelled.`);
const until = iso => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
</script>

<template>
  <div class="members-page">
    <p class="members-crumb">{{ body?.workspace?.name || 'Workspace' }} <span>/</span> Manage project access</p>
    <p v-if="loading">Loading…</p>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <div v-if="notice" class="notice" role="status"><Check :size="16"/><span>{{ notice }}</span></div>
    <template v-if="body">
      <div class="members-top">
        <section class="panel members-invite">
          <h3>Invite team members</h3>
          <p class="members-sub"><Mail :size="15"/> A role is given in the projects you choose.</p>
          <template v-if="body.can_invite">
            <div class="members-project-field">
              <label id="invite-project-label">Projects <span>{{ chosen.length }} selected</span></label>
              <details ref="projectPicker" class="members-project-picker" @keydown.esc.prevent="projectPicker.open=false;projectPicker.querySelector('summary').focus()" @focusout="event => { if (!event.currentTarget.contains(event.relatedTarget)) projectPicker.open=false; }">
                <summary aria-labelledby="invite-project-label invite-project-value"><span id="invite-project-value">{{ projectSummary }}</span><ChevronDown :size="14" aria-hidden="true"/></summary>
                <div class="members-project-menu">
                  <input v-model="projectSearch" class="text-input" aria-label="Search projects to invite to" placeholder="Search projects..."/>
                  <div class="members-project-options"><label v-for="p in projectOptions" :key="p.id" :class="{on:chosen.includes(p.id)}"><input type="checkbox" :checked="chosen.includes(p.id)" :disabled="busy" @change="toggleProject(p.id)"><span>{{ p.name }}</span></label><p v-if="!projectOptions.length">No projects found.</p></div>
                  <button type="button" class="members-picker-done" @click="projectPicker.open=false;projectPicker.querySelector('summary').focus()">Done &middot; {{ chosen.length }} selected</button>
                </div>
              </details>
            </div>
            <form class="members-invite-form" @submit.prevent="invite">
              <label v-if="!several">Full name<input v-model="name" class="text-input" aria-label="Name of the person invited" required maxlength="150" placeholder="Enter full name"></label>
              <label :class="{'members-bulk-email':several}">Email address<input v-model="emails" class="text-input" aria-label="E-mail addresses" required placeholder="name@company.com"></label>
              <label>Project role<select v-model="role" class="text-input" aria-label="Role of the people invited"><option v-for="r in body.roles" :key="r.value" :value="r.value">{{ r.label }}</option></select></label>
              <UiButton type="submit" variant="primary" :disabled="busy||!emails.trim()||!chosen.length||(!several&&!name.trim())"><Send :size="15"/> Send Invite</UiButton>
              <p class="members-form-help">Separate email addresses with commas to invite multiple people.</p>
            </form>
            <ul v-if="results.length" class="members-results"><li v-for="r in results" :key="r.email" :class="{bad:!r.ok}"><strong>{{ r.email }}</strong> {{ r.said }}</li></ul>
            <details class="members-link-section"><summary>Invite with a link</summary>
            <div class="members-row">
              <input class="text-input members-link" readonly aria-label="Invite link" :value="currentLink?.url || ''" :placeholder="body.can_bring_in ? 'Make a link for the chosen projects and role' : 'Only an owner or admin of the organisation can make a link'">
              <UiButton v-if="currentLink" @click="copy(currentLink)"><Copy :size="15"/> {{ copied ? 'Copied' : 'Copy' }}</UiButton>
              <UiButton v-else :disabled="busy||!body.can_bring_in||!chosen.length" @click="makeLink">Make link</UiButton>
              <select v-model="linkRole" class="text-input members-role" aria-label="Role a link gives"><option v-for="r in linkRoles" :key="r.value" :value="r.value">{{ r.label }}</option></select>
            </div>
            <p v-if="currentLink" class="members-hint">Works until {{ until(currentLink.expires_at) }} or for {{ currentLink.max_uses - currentLink.uses }} more {{ currentLink.max_uses - currentLink.uses === 1 ? 'person' : 'people' }}. Anyone with it can join with a verified e-mail. <button class="link-button" :disabled="busy" @click="linkAction(currentLink,'renew')"><RefreshCw :size="12"/> Make a new link</button> · <button class="link-button" :disabled="busy" @click="linkAction(currentLink,'off')"><Power :size="12"/> Turn off</button></p>
            <p v-else class="members-hint">A link gives Data preparer, Labeller or Viewer in the chosen projects, for 7 days or 25 people. An Owner is invited by e-mail.</p>
            </details>
            <label class="members-domain"><input type="checkbox" disabled> Allow verified <strong>@{{ domain }}</strong> e-mails to discover and ask to join this workspace. <UiBadge>Coming soon</UiBadge></label>
          </template>
          <p v-else class="members-hint">You are an Owner of no project here, so you cannot invite anyone. The people below are the ones you work with.</p>
        </section>
        <details class="panel members-roles"><summary><Users :size="17"/> Role guide <ChevronDown :size="14" aria-hidden="true"/></summary>
          <dl><template v-for="r in body.roles" :key="r.value"><dt>{{ r.label }}</dt><dd>{{ r.help }}</dd></template></dl>
          <p class="members-hint">A role is given per project. A person can be a Labeller in one project and an Owner in another.</p>
        </details>
      </div>

      <section class="panel members-table">
        <header><h3>Members <span class="members-total">{{ people.length }}</span></h3>
          <div class="members-filters">
            <select v-model="sort" class="text-input" aria-label="Sort"><option value="name">Sort by Name</option><option value="email">Sort by E-mail</option></select>
            <select v-model="roleFilter" class="text-input" aria-label="Role"><option value="">All roles</option><option v-for="r in body.roles" :key="r.value" :value="r.value">{{ r.label }}</option></select>
          </div>
        </header>
        <table>
          <thead><tr><th>Name</th><th>Role in each project</th><th class="members-actions"><span class="sr-only">Actions</span></th></tr></thead>
          <tbody>
            <tr v-for="person in people" :key="person.id">
              <td><div class="members-person"><span class="members-avatar">{{ (person.name || person.email).slice(0,1).toUpperCase() }}</span><div><strong>{{ person.name }}</strong> <UiBadge v-if="person.you">You</UiBadge><span v-if="person.name!==person.email" class="members-mail">{{ person.email }}</span></div></div></td>
              <td><span v-for="entry in person.roles" :key="entry.project" class="members-chip">{{ entry.project_name }}: <b>{{ entry.role_label }}</b>
                <button v-if="entry.may_change" class="icon-button" :aria-label="`Change the role of ${person.name} in ${entry.project_name}`" @click="editing={person,entry}"><MoreVertical :size="14"/></button></span>
                <span v-if="!person.roles.length" class="members-mail">No role in a project you can see</span></td>
              <td/>
            </tr>
            <tr v-if="!people.length"><td colspan="3" class="members-empty">No members match this role.</td></tr>
          </tbody>
        </table>
      </section>

      <section v-if="body.waiting.length" class="panel members-table">
        <header><h3>Invitations waiting</h3></header>
        <table>
          <thead><tr><th>E-mail</th><th>Projects</th><th>Sent</th><th class="members-actions"><span class="sr-only">Actions</span></th></tr></thead>
          <tbody><tr v-for="row in body.waiting" :key="row.id">
            <td><strong>{{ row.name || row.email }}</strong> <span v-if="row.name" class="members-mail">{{ row.email }}</span></td>
            <td><span v-for="p in row.projects" :key="p.name" class="members-chip">{{ p.name }}: <b>{{ p.role_label }}</b></span></td>
            <td class="members-mail">{{ until(row.sent_at) }}{{ row.by ? ` by ${row.by}` : '' }}</td>
            <td class="members-actions"><template v-if="row.may_manage"><UiButton :disabled="busy" @click="invitation(row,'resend')">Resend</UiButton><UiButton :disabled="busy" @click="invitation(row,'cancel')">Cancel</UiButton></template></td>
          </tr></tbody>
        </table>
      </section>

      <section v-if="otherLinks.length" class="panel members-table">
        <header><h3>Invite links</h3></header>
        <table>
          <thead><tr><th>Gives</th><th>State</th><th>Made</th><th class="members-actions"><span class="sr-only">Actions</span></th></tr></thead>
          <tbody><tr v-for="l in otherLinks" :key="l.id">
            <td>{{ l.role_label }} in {{ l.projects.map(p => p.name).join(', ') }}</td>
            <td><UiBadge :tone="l.state==='active'?'green':undefined">{{ l.state_label }}</UiBadge> <span class="members-mail">{{ l.uses }} of {{ l.max_uses }} joined</span></td>
            <td class="members-mail">{{ until(l.created_at) }}{{ l.by ? ` by ${l.by}` : '' }}</td>
            <td class="members-actions"><template v-if="l.may_manage&&l.state==='active'"><UiButton @click="copy(l)"><Copy :size="14"/> Copy</UiButton><UiButton :disabled="busy" @click="linkAction(l,'off')">Turn off</UiButton></template></td>
          </tr></tbody>
        </table>
      </section>
    </template>

    <UiDialog :open="!!editing" :title="editing ? `Role of ${editing.person.name}` : ''" @close="editing=null">
      <template v-if="editing">
        <p class="dialog-description">In “{{ editing.entry.project_name }}”. {{ body.roles.find(r => r.value === editing.entry.role)?.help }}</p>
        <div class="members-role-choices"><button v-for="r in body.roles" :key="r.value" :class="{on:r.value===editing.entry.role}" :disabled="busy" @click="changeRole(editing.person, editing.entry, r.value)"><strong>{{ r.label }}</strong><span>{{ r.help }}</span></button></div>
        <div class="dialog-actions"><UiButton class="danger" @click="removing=editing;editing=null">Remove from this project</UiButton><UiButton @click="editing=null">Close</UiButton></div>
      </template>
    </UiDialog>
    <UiDialog :open="!!removing" title="Remove from the project" @close="removing=null">
      <template v-if="removing">
        <p class="dialog-description">{{ removing.person.name }} loses the role {{ removing.entry.role_label }} in “{{ removing.entry.project_name }}”, with the photos assigned to them. When it was their last role and they came in by an invitation, their access to the workspace is withdrawn too.</p>
        <div class="dialog-actions"><UiButton @click="removing=null">Cancel</UiButton><UiButton variant="primary" :disabled="busy" @click="remove">Remove</UiButton></div>
      </template>
    </UiDialog>
  </div>
</template>

<style scoped>
.members-page{max-width:1100px}
.members-crumb{font-size:13px;color:#6d7c92;margin-bottom:22px}
.members-page>h2{font-size:22px;font-weight:600}
.members-intro{font-size:13px;margin:6px 0 20px}
.members-top{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:18px;margin-bottom:22px}
.members-invite h3,.members-roles h3,.members-table h3{font-size:15px;font-weight:600}
.members-sub{display:flex;align-items:center;gap:7px;font-size:13px;margin:6px 0 14px}
.members-projects{border:0;padding:0;margin:0 0 12px;display:flex;flex-wrap:wrap;gap:8px}
.members-projects legend{font-size:12px;font-weight:600;margin-bottom:6px}
.members-projects label{display:flex;align-items:center;gap:6px;border:1px solid #dfe3ea;border-radius:16px;padding:5px 11px;font-size:12px;cursor:pointer}
.members-projects label.on{border-color:var(--aadml-focus);background:var(--aadml-tint);color:var(--aadml-primary)}
.members-projects input{accent-color:var(--aadml-primary)}
.members-row{display:flex;gap:8px;align-items:center}
.members-row .text-input{flex:1;min-width:0;padding:10px 12px;font-size:13px}
.members-row .members-role{flex:0 0 150px}
.members-name{margin-top:8px;padding:9px 12px;font-size:13px}
.members-link{font-family:ui-monospace,Consolas,monospace;font-size:11px!important;color:#475467}
.members-label{font-size:13px;margin:18px 0 8px}
.members-hint{font-size:12px!important;color:#6d7c92;margin:8px 0 0!important;line-height:1.6}
.members-domain{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;margin-top:16px;color:#6d7c92}
.members-results{list-style:none;padding:0;margin:10px 0 0;font-size:12px}
.members-results li{padding:6px 10px;border-radius:6px;background:#ecfdf3;color:#05603a;margin-bottom:6px}
.members-results li.bad{background:#fef3f2;color:#b42318}
.members-roles{display:flex;flex-direction:column;gap:8px;color:#5b6b82}
.members-roles>svg{color:var(--aadml-primary)}
.members-roles dl{font-size:12px;margin:4px 0}
.members-roles dt{font-weight:600;color:#16213a;margin-top:8px}
.members-roles dd{margin:2px 0 0}
.members-table{padding:0;margin-bottom:18px;overflow:hidden}
.members-table header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid #eef0f4}
.members-filters{display:flex;gap:8px}
.members-filters .text-input{padding:7px 10px;font-size:12px;width:auto}
.members-table table{width:100%;border-collapse:collapse;font-size:13px}
.members-table th{text-align:left;font-size:11px;font-weight:500;letter-spacing:.5px;text-transform:uppercase;color:#6d7c92;background:#f8f9fb;padding:10px 18px}
.members-table td{padding:12px 18px;border-top:1px solid #eef0f4;vertical-align:middle}
.members-mail{color:#6d7c92;font-size:12px}
.members-chip{display:inline-flex;align-items:center;gap:4px;margin:2px 8px 2px 0;font-size:12px}
.members-chip .icon-button{min-width:22px;min-height:22px;padding:2px}
.members-actions{text-align:right;white-space:nowrap}
.members-actions .button{margin-left:6px;min-height:30px;padding:6px 10px;font-size:12px}
.members-role-choices{display:flex;flex-direction:column;gap:8px;margin:14px 0}
.members-role-choices button{display:flex;flex-direction:column;align-items:flex-start;gap:3px;text-align:left;background:#fff;border:1px solid #dfe3ea;border-radius:8px;padding:10px 12px;font-size:12px;color:#5b6b82}
.members-role-choices button strong{font-size:13px;color:#16213a}
.members-role-choices button.on,.members-role-choices button:hover{border-color:var(--aadml-focus);background:var(--aadml-tint)}
.danger{color:#b42318;border-color:#fda29b}
.link-button{display:inline-flex;align-items:center;gap:3px;background:none;border:0;padding:0;color:var(--aadml-primary);font:inherit;cursor:pointer;text-decoration:underline}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
@media(max-width:900px){.members-top{grid-template-columns:1fr}.members-row{flex-wrap:wrap}.members-row .members-role{flex:1 1 140px}}
</style>

<style scoped src="./members-layout.css"></style>
