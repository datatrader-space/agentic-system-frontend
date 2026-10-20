<script setup>
// The sidebar's Activity panel (this person's newest Training notifications) and Workspace Settings menu.
import { onMounted, onUnmounted, ref } from 'vue';
import { Bell, Settings, CreditCard, Coins, ClipboardList, Users, KeyRound, Database, Trash2, ListChecks } from 'lucide-vue-next';
import { listNotifications, readNotification, readAllNotifications } from '../api/notifications.js';
import { openLink, timeAgo } from '../api/workspace.js';
const emit = defineEmits(['select', 'unread']);
const root = ref(null);
const opened = ref('');
const settings = [
  ['Plan & Billing', CreditCard], ['Credit Usage', Coins], ['Audit Logs', ClipboardList],
  ['Team Members', Users], ['API Keys', KeyRound], ['Datasources', Database], ['Trash', Trash2],
];
// The newest few notifications; the Notifications page has them all.
const SHOWN = 6;
const activity = ref(null); const unread = ref(0); const failed = ref(''); const busy = ref(false);
async function loadActivity() {
  try { const body = await listNotifications(); activity.value = body.notifications.slice(0, SHOWN); unread.value = body.unread; failed.value = ''; emit('unread', body.unread); }
  catch (error) { failed.value = `Activity could not be loaded: ${error.message}`; activity.value = activity.value || []; }
}
async function openItem(item) {
  busy.value = true;
  try { const body = await readNotification(item.id); opened.value = ''; openLink(body.link || item.link); loadActivity(); }
  catch (error) { failed.value = error.message; } finally { busy.value = false; }
}
async function readAll() {
  busy.value = true;
  try { await readAllNotifications(); await loadActivity(); } catch (error) { failed.value = error.message; } finally { busy.value = false; }
}
function toggle(panel) { opened.value = opened.value === panel ? '' : panel; if (opened.value === 'activity') loadActivity(); }
function dismiss(event) { if (!root.value?.contains(event.target)) opened.value = ''; }
function escape(event) { if (event.key === 'Escape') { const previous = opened.value; opened.value = ''; root.value?.querySelector(`[data-trigger="${previous}"]`)?.focus(); } }
function select(name) { opened.value = ''; emit('select', name); }
onMounted(() => { document.addEventListener('pointerdown', dismiss); document.addEventListener('keydown', escape); });
onUnmounted(() => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape); });
</script>

<template>
  <div ref="root" class="sidebar-utilities">
    <button class="sidebar-utility" :class="{ 'utility-active': opened === 'activity' }" title="Activity" data-trigger="activity" :aria-expanded="opened === 'activity'" aria-controls="activity-panel" @click="toggle('activity')"><Bell :size="15"/><span class="nav-text">Activity</span></button>
    <button class="sidebar-utility" :class="{ 'utility-active': opened === 'settings' }" title="Settings" data-trigger="settings" :aria-expanded="opened === 'settings'" aria-controls="settings-panel" @click="toggle('settings')"><Settings :size="15"/><span class="nav-text">Settings</span></button>
    <section v-if="opened === 'settings'" id="settings-panel" class="utility-panel settings-panel" aria-label="Workspace Settings">
      <h2>Workspace Settings</h2>
      <button v-for="[name, icon] in settings" :key="name" @click="select(name)"><component :is="icon" :size="16"/><span>{{name}}</span></button>
    </section>
    <section v-if="opened === 'activity'" id="activity-panel" class="utility-panel activity-panel" aria-label="Activity">
      <header><h2>Activity</h2><span class="unread-count"><i v-if="unread"/>{{unread}} unread</span><button title="Mark all as read" aria-label="Mark all activity as read" :disabled="!unread||busy" @click="readAll"><ListChecks :size="17"/></button></header>
      <p v-if="failed" class="activity-note" role="alert">{{ failed }}</p>
      <p v-if="activity===null" class="activity-note">Loading…</p>
      <p v-else-if="!activity.length" class="activity-note">Nothing yet. You are told here when an assignment is given to you, returned, approved or sent back.</p>
      <button v-for="item in activity || []" :key="item.id" class="activity-item" :disabled="busy" @click="openItem(item)"><span>{{item.project || 'Training'}}</span><strong><i v-if="!item.read"/>{{item.title}}</strong><span>{{ timeAgo(item.at) }}</span></button>
      <button class="activity-all" @click="select('Notifications')">All notifications</button>
    </section>
  </div>
</template>

<style scoped>
.sidebar-utilities{display:flex;flex-direction:column;gap:6px;position:relative}.sidebar-utility{width:100%}.sidebar-utility.utility-active{background:#202330;outline:1px solid var(--aadml-focus);color:var(--aadml-outline)}.utility-panel{position:fixed;left:calc(var(--workspace-nav,159px) + 7px);bottom:60px;z-index:60;background:#121321;border:1px solid #2c2d3b;border-radius:9px;box-shadow:0 10px 22px #0005;color:#d2d4df;overflow:hidden;text-align:left}.settings-panel{width:194px;padding:8px}.settings-panel h2{font-size:12px;color:#8c91a2;font-weight:600;padding:10px 8px 13px;border-bottom:1px solid #2c2d3b;margin:0 0 6px}.settings-panel>button{display:flex;align-items:center;gap:10px;width:100%;background:none;border:0;color:#d2d4df;padding:12px 8px;border-radius:5px;text-align:left;font-size:13px}.settings-panel>button svg{color:#8c91a2}.settings-panel>button:hover,.settings-panel>button:focus-visible,.activity-item:hover{background:#232536}.activity-panel{width:448px;bottom:100px;max-width:calc(100vw - var(--workspace-nav,159px) - 20px);max-height:calc(100vh - 120px);overflow:auto}.activity-panel header{display:flex;align-items:center;gap:12px;padding:19px 16px;border-bottom:1px solid #2c2d3b}.activity-panel h2{font-size:17px;font-weight:650;margin:0;color:#f2f2f8}.unread-count{margin-left:auto;font-size:12px;color:#8d93a4;display:flex;align-items:center;gap:5px}.activity-panel i{width:8px;height:8px;border-radius:50%;background:var(--aadml-outline);display:inline-block;flex-shrink:0}.activity-panel header button{display:grid;place-items:center;padding:4px;background:#242e3b;border:1px solid #485563;border-radius:5px;color:#b8c7d7}.activity-panel header button:disabled{opacity:.4;cursor:default}.activity-note{padding:14px 16px;font-size:12px;color:#a3a7b6;border-bottom:1px solid #2c2d3b;margin:0;line-height:1.5}.activity-all{display:block;width:100%;background:none;border:0;border-top:1px solid #2c2d3b;padding:12px 16px;color:var(--aadml-outline);font-size:12px;text-align:left}.activity-all:hover{background:#232536}.activity-item{display:flex;flex-direction:column;gap:5px;width:100%;border:0;border-bottom:1px solid #2c2d3b;background:none;padding:14px 16px;color:#a3a7b6;text-align:left;font-size:12px}.activity-item:last-child{border-bottom:0}.activity-item strong{display:flex;align-items:center;gap:6px;font-size:14px;color:#f2f2f8;font-weight:600}.utility-panel button:focus-visible{outline:2px solid var(--aadml-outline);outline-offset:-2px}@media(max-width:700px){.utility-panel{left:166px;max-width:calc(100vw - 174px)}.activity-panel{bottom:90px}.activity-panel header{flex-wrap:wrap;gap:8px}.activity-panel h2{width:100%}.unread-count{margin-left:0}}
</style>
