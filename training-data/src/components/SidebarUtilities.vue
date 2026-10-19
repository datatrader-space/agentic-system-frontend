<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Bell, Settings, CreditCard, Coins, ClipboardList, Users, KeyRound, Database, Trash2, ListChecks } from 'lucide-vue-next';
const emit = defineEmits(['select']);
const root = ref(null);
const opened = ref('');
const settings = [
  ['Plan & Billing', CreditCard], ['Credit Usage', Coins], ['Audit Logs', ClipboardList],
  ['Team Members', Users], ['API Keys', KeyRound], ['Datasources', Database], ['Trash', Trash2],
];
const activity = ref([
  { project: 'Room Wall Segmentation', title: 'Dataset analytics ready', detail: '3 days ago', unread: true },
  { project: 'Room Wall Segmentation', title: 'Model test finished', detail: '3 days ago · 1 frame processed', unread: true },
  { project: 'SAJIDs Workspace', title: 'Uploaded to SAJIDs Workspace', detail: '3 days ago · 1 file', unread: true },
]);
const unread = computed(() => activity.value.filter(item => item.unread).length);
function toggle(panel) { opened.value = opened.value === panel ? '' : panel; }
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
      <header><h2>Activity</h2><span class="unread-count"><i v-if="unread"/>{{unread}} unread</span><button title="Mark all as read" aria-label="Mark all activity as read" :disabled="!unread" @click="activity.forEach(item => item.unread = false)"><ListChecks :size="17"/></button></header>
      <div class="activity-example">Sample activity · Local preview</div>
      <button v-for="item in activity" :key="item.title" class="activity-item" @click="item.unread = false"><span>{{item.project}}</span><strong><i v-if="item.unread"/>{{item.title}}</strong><span>{{item.detail}}</span></button>
    </section>
  </div>
</template>

<style scoped>
.sidebar-utilities{display:flex;flex-direction:column;gap:6px;position:relative}.sidebar-utility{width:100%}.sidebar-utility.utility-active{background:#202330;outline:1px solid var(--aadml-focus);color:var(--aadml-outline)}.utility-panel{position:fixed;left:calc(var(--workspace-nav,159px) + 7px);bottom:60px;z-index:60;background:#121321;border:1px solid #2c2d3b;border-radius:9px;box-shadow:0 10px 22px #0005;color:#d2d4df;overflow:hidden;text-align:left}.settings-panel{width:194px;padding:8px}.settings-panel h2{font-size:12px;color:#8c91a2;font-weight:600;padding:10px 8px 13px;border-bottom:1px solid #2c2d3b;margin:0 0 6px}.settings-panel>button{display:flex;align-items:center;gap:10px;width:100%;background:none;border:0;color:#d2d4df;padding:12px 8px;border-radius:5px;text-align:left;font-size:13px}.settings-panel>button svg{color:#8c91a2}.settings-panel>button:hover,.settings-panel>button:focus-visible,.activity-item:hover{background:#232536}.activity-panel{width:448px;bottom:100px;max-width:calc(100vw - var(--workspace-nav,159px) - 20px)}.activity-panel header{display:flex;align-items:center;gap:12px;padding:19px 16px;border-bottom:1px solid #2c2d3b}.activity-panel h2{font-size:17px;font-weight:650;margin:0;color:#f2f2f8}.unread-count{margin-left:auto;font-size:12px;color:#8d93a4;display:flex;align-items:center;gap:5px}.activity-panel i{width:8px;height:8px;border-radius:50%;background:var(--aadml-outline);display:inline-block;flex-shrink:0}.activity-panel header button{display:grid;place-items:center;padding:4px;background:#242e3b;border:1px solid #485563;border-radius:5px;color:#b8c7d7}.activity-panel header button:disabled{opacity:.4;cursor:default}.activity-example{padding:8px 16px;font-size:10px;color:#9298ad;border-bottom:1px solid #2c2d3b}.activity-item{display:flex;flex-direction:column;gap:5px;width:100%;border:0;border-bottom:1px solid #2c2d3b;background:none;padding:14px 16px;color:#a3a7b6;text-align:left;font-size:12px}.activity-item:last-child{border-bottom:0}.activity-item strong{display:flex;align-items:center;gap:6px;font-size:14px;color:#f2f2f8;font-weight:600}.utility-panel button:focus-visible{outline:2px solid var(--aadml-outline);outline-offset:-2px}@media(max-width:700px){.utility-panel{left:166px;max-width:calc(100vw - 174px)}.activity-panel{bottom:90px}.activity-panel header{flex-wrap:wrap;gap:8px}.activity-panel h2{width:100%}.unread-count{margin-left:0}}
</style>
