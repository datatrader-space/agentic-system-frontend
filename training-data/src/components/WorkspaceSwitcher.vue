<script setup>
// The workspace switcher at the top of the sidebar: the workspaces this person can open, by organisation, and
// "Create workspace" (backend: workspaces/, tenancy's create_workspace). Choosing one writes the same selection the
// AADML dashboard keeps (activeWorkspaceId / activeWorkspace / activeOrg), so both work in the same workspace, and the
// page loads again in it.
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Check, ChevronsUpDown, Plus } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiDialog from './UiDialog.vue';
import { workspaces as api, chooseWorkspace } from '../api/workspaces.js';

const props = defineProps({ session: Object });
const open = ref(false); const body = ref(null); const error = ref(''); const root = ref(null);
const creating = ref(false); const newName = ref(''); const newOrg = ref(''); const busy = ref(false); const createError = ref('');
const groups = computed(() => {
  const out = new Map();
  for (const w of body.value?.workspaces || []) {
    if (!out.has(w.organization.slug)) out.set(w.organization.slug, { name: w.organization.name, items: [] });
    out.get(w.organization.slug).items.push(w);
  }
  return [...out.values()];
});
async function load() { error.value = ''; try { body.value = await api.list(); } catch (e) { error.value = e.message; } }
function toggle() { open.value = !open.value; if (open.value && !body.value) load(); }
function choose(w) { open.value = false; if (w.id !== body.value?.current) chooseWorkspace(w); }
function startCreate() { open.value = false; createError.value = ''; newName.value = ''; newOrg.value = body.value?.can_create_in?.[0]?.slug || ''; creating.value = true; }
async function create() {
  busy.value = true; createError.value = '';
  try { const made = await api.create({ organization: newOrg.value, name: newName.value.trim() }); creating.value = false; chooseWorkspace(made.workspace); }
  catch (e) { createError.value = e.message; } finally { busy.value = false; }
}
function away(event) { if (open.value && !root.value?.contains(event.target)) open.value = false; }
function escape(event) { if (event.key === 'Escape') open.value = false; }
onMounted(() => { document.addEventListener('pointerdown', away); document.addEventListener('keydown', escape); });
onUnmounted(() => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', escape); });
</script>

<template>
  <div ref="root" class="ws-switcher">
    <button class="workspace-switch" aria-label="Switch workspace" :aria-expanded="open" @click="toggle">
      <span>{{ session.workspace.initials }}</span><strong>{{ session.workspace.name }}</strong><ChevronsUpDown class="ws-chevron" :size="14"/>
    </button>
    <div v-if="open" class="ws-menu" role="menu">
      <p v-if="!body&&!error" class="ws-note">Loading…</p>
      <p v-if="error" class="ws-note ws-error">{{ error }}</p>
      <template v-for="g in groups" :key="g.name">
        <p class="ws-org">{{ g.name }}</p>
        <button v-for="w in g.items" :key="w.id" role="menuitemradio" :aria-checked="w.id===body.current" :class="['ws-item',{on:w.id===body.current}]" @click="choose(w)">
          <i/><span>{{ w.name }}<small v-if="w.home"> · Personal Mode</small></span><Check v-if="w.id===body.current" :size="15"/>
        </button>
      </template>
      <button v-if="body?.can_create_in?.length" class="ws-item ws-create" role="menuitem" @click="startCreate"><Plus :size="15"/> Create workspace</button>
    </div>
    <UiDialog :open="creating" title="Create workspace" @close="creating=false">
      <form @submit.prevent="create">
        <label class="field-label">Name<input v-model="newName" class="text-input" maxlength="100" required placeholder="e.g. Room walls team"></label>
        <label v-if="(body?.can_create_in||[]).length>1" class="field-label">Organisation<select v-model="newOrg" class="text-input"><option v-for="o in body.can_create_in" :key="o.slug" :value="o.slug">{{ o.name }}</option></select></label>
        <p class="dialog-description">You are its admin. Projects, people and uploads stay in the workspace they belong to; the page opens in the new workspace.</p>
        <p v-if="createError" class="field-error" role="alert">{{ createError }}</p>
        <div class="dialog-actions"><UiButton type="button" @click="creating=false">Cancel</UiButton><UiButton type="submit" variant="primary" :disabled="busy||!newName.trim()">Create</UiButton></div>
      </form>
    </UiDialog>
  </div>
</template>

<style scoped>
.ws-switcher{position:relative}
.ws-chevron{margin-left:auto;flex-shrink:0;opacity:.7}
.ws-menu{position:absolute;left:0;top:calc(100% + 6px);z-index:60;width:250px;background:#fff;color:#16213a;border:1px solid #dfe3ea;border-radius:10px;box-shadow:0 14px 34px #0f172a33;padding:8px;max-height:60vh;overflow:auto}
.ws-org{font-size:10px;letter-spacing:.8px;text-transform:uppercase;color:#6d7c92;margin:6px 8px 4px;font-weight:600}
.ws-item{display:flex;align-items:center;gap:9px;width:100%;background:none;border:1px solid transparent;border-radius:7px;padding:8px 9px;font-size:13px;color:#16213a;text-align:left}
.ws-item:hover{background:var(--aadml-tint)}
.ws-item.on{border-color:var(--aadml-focus);background:var(--aadml-tint)}
.ws-item>i{width:7px;height:7px;border-radius:50%;background:#12b76a;flex-shrink:0}
.ws-item.on>i{background:var(--aadml-primary)}
.ws-item>span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ws-item small{color:#6d7c92}
.ws-create{border-top:1px solid #eef0f4;border-radius:0 0 7px 7px;margin-top:6px;color:#5b6b82}
.ws-note{font-size:12px;padding:6px 8px}
.ws-error{color:#b42318}
</style>
