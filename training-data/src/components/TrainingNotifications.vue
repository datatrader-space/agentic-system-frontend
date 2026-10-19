<script setup>
// This person's Training notifications, newest first. Opening one marks it read and goes to its assignment.
import { onMounted, ref } from 'vue';
import { Bell } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import { listNotifications, readNotification, readAllNotifications } from '../api/notifications.js';

const emit = defineEmits(['changed']);
const rows = ref([]); const unread = ref(0); const loading = ref(true); const error = ref(''); const busy = ref(false);

async function load() {
  try { const body = await listNotifications(); rows.value = body.notifications; unread.value = body.unread; error.value = ''; emit('changed', body.unread); }
  catch (e) { error.value = `Notifications could not be loaded: ${e.message}`; }
  finally { loading.value = false; }
}
async function open(row) {
  busy.value = true;
  try { const body = await readNotification(row.id); location.assign(body.link || row.link); }
  catch (e) { error.value = e.message; busy.value = false; }
}
async function readAll() {
  busy.value = true;
  try { await readAllNotifications(); await load(); } catch (e) { error.value = e.message; } finally { busy.value = false; }
}
onMounted(load);
</script>

<template>
  <section class="panel training-config">
    <div class="section-heading"><h2>Notifications <span class="count">{{ unread }} unread</span></h2><UiButton :disabled="busy || !unread" @click="readAll">Mark all read</UiButton></div>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <p v-if="loading">Loading…</p>
    <div v-else-if="!rows.length" class="mini-empty"><Bell :size="28" /><strong>No notifications yet</strong><span>You are told here when an assignment is given to you, returned, approved or sent back.</span></div>
    <div v-for="row in rows" :key="row.id" class="stat-row">
      <span><strong>{{ row.title }}</strong><br>{{ row.body }}<br><small>{{ new Date(row.at).toLocaleString() }}</small></span>
      <UiBadge v-if="!row.read" tone="purple">New</UiBadge>
      <UiButton :disabled="busy" @click="open(row)">{{ row.label }}</UiButton>
    </div>
  </section>
</template>
