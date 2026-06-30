<template>
  <main class="support-page">
    <section class="support-main">
      <header class="support-head">
        <div>
          <h1>Support</h1>
          <p>Open a ticket and track your conversations with our team.</p>
        </div>
        <button v-if="view !== 'new'" class="primary" @click="openNew">
          <Icon icon="lucide:plus" /> New ticket
        </button>
      </header>

      <!-- New ticket form -->
      <section v-if="view === 'new'" class="panel form-panel">
        <div class="panel-head">
          <h2>New support ticket</h2>
          <button class="link" @click="view = 'list'">Cancel</button>
        </div>
        <label class="field">
          <span>Subject</span>
          <input v-model="form.subject" type="text" placeholder="Briefly describe your issue" />
        </label>
        <div class="field-row">
          <label class="field">
            <span>Category</span>
            <select v-model="form.category">
              <option :value="null">General</option>
              <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </label>
          <label class="field">
            <span>Priority</span>
            <select v-model="form.priority">
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
        </div>
        <label class="field">
          <span>Message</span>
          <textarea v-model="form.message" rows="6" placeholder="Tell us what's going on, with steps to reproduce if it's a bug."></textarea>
        </label>
        <div class="form-actions">
          <button class="primary" :disabled="!canSubmit || submitting" @click="submit">
            {{ submitting ? 'Submitting…' : 'Submit ticket' }}
          </button>
        </div>
      </section>

      <!-- Ticket detail -->
      <section v-else-if="view === 'detail' && active" class="panel detail-panel">
        <div class="panel-head">
          <button class="link" @click="backToList"><Icon icon="lucide:arrow-left" /> All tickets</button>
          <span :class="['status-pill', active.status]">{{ active.status }}</span>
        </div>
        <h2>{{ active.subject }}</h2>
        <div class="detail-meta">
          <span>{{ active.reference }}</span>
          <span class="dot">•</span>
          <span>{{ active.category_name || 'General' }}</span>
          <span class="dot">•</span>
          <span :class="['prio', active.priority]">{{ active.priority }} priority</span>
        </div>

        <div class="thread">
          <article v-for="m in active.messages" :key="m.id" :class="['msg', m.is_staff_reply ? 'staff' : 'user']">
            <div class="msg-head">
              <strong>{{ m.author_name }}</strong>
              <small>{{ formatDate(m.created_at) }}</small>
            </div>
            <p>{{ m.body }}</p>
          </article>
        </div>

        <div v-if="active.status !== 'closed'" class="reply-box">
          <textarea v-model="reply" rows="3" placeholder="Write a reply…"></textarea>
          <div class="reply-actions">
            <button class="ghost" @click="closeTicket">Close ticket</button>
            <button class="primary" :disabled="!reply.trim() || replying" @click="sendReply">
              {{ replying ? 'Sending…' : 'Send reply' }}
            </button>
          </div>
        </div>
        <div v-else class="closed-note">
          This ticket is closed.
          <button class="link" @click="reopen">Reopen</button>
        </div>
      </section>

      <!-- Ticket list -->
      <section v-else class="panel list-panel">
        <div class="list-filters">
          <button v-for="f in filters" :key="f.value"
                  :class="{ active: statusFilter === f.value }" @click="statusFilter = f.value">
            {{ f.label }}
          </button>
        </div>

        <div v-if="loading" class="empty">Loading tickets…</div>
        <div v-else-if="!filteredTickets.length" class="empty">
          <Icon icon="lucide:inbox" />
          <p>No tickets yet.</p>
          <button class="primary" @click="openNew">Open your first ticket</button>
        </div>
        <ul v-else class="ticket-list">
          <li v-for="t in filteredTickets" :key="t.id" @click="openTicket(t.reference)">
            <div class="t-main">
              <strong>{{ t.subject }}</strong>
              <small>{{ t.reference }} · {{ t.category_name || 'General' }} · {{ t.message_count }} message{{ t.message_count === 1 ? '' : 's' }}</small>
            </div>
            <span :class="['prio', t.priority]">{{ t.priority }}</span>
            <span :class="['status-pill', t.status]">{{ t.status }}</span>
            <Icon icon="lucide:chevron-right" />
          </li>
        </ul>
      </section>
    </section>

    <aside class="support-rail">
      <section class="rail-card">
        <h2>Other ways to get help</h2>
        <RouterLink to="/dashboard/help-center/documentation" class="rail-row">
          <span class="blue"><Icon icon="lucide:book-open" /></span>
          <span><strong>Documentation</strong><small>Guides and references</small></span>
          <Icon icon="lucide:chevron-right" />
        </RouterLink>
        <RouterLink to="/dashboard/help-center/tutorials" class="rail-row">
          <span class="violet"><Icon icon="lucide:play-circle" /></span>
          <span><strong>Tutorials</strong><small>Step-by-step videos</small></span>
          <Icon icon="lucide:chevron-right" />
        </RouterLink>
        <button class="rail-row" @click="goTo('/dashboard/chat/new')">
          <span class="teal"><Icon icon="lucide:sparkles" /></span>
          <span><strong>Ask the AI assistant</strong><small>Instant answers</small></span>
          <Icon icon="lucide:chevron-right" />
        </button>
      </section>

      <section class="rail-card tips">
        <h2>Faster resolutions</h2>
        <ul>
          <li><Icon icon="lucide:check" /> Include steps to reproduce</li>
          <li><Icon icon="lucide:check" /> Add the agent or workflow name</li>
          <li><Icon icon="lucide:check" /> Mention any error messages</li>
        </ul>
      </section>
    </aside>
  </main>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import api from '../services/api'

const router = useRouter()
const notify = inject('notify', (m) => console.log(m))

const view = ref('list')            // list | new | detail
const tickets = ref([])
const categories = ref([])
const active = ref(null)
const loading = ref(true)
const submitting = ref(false)
const replying = ref(false)
const reply = ref('')
const statusFilter = ref('all')

const filters = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

const form = ref({ subject: '', category: null, priority: 'normal', message: '' })
const canSubmit = computed(() => form.value.subject.trim() && form.value.message.trim())

const filteredTickets = computed(() => {
  if (statusFilter.value === 'all') return tickets.value
  return tickets.value.filter(t => t.status === statusFilter.value)
})

function goTo(r) { if (r) router.push(r) }
function formatDate(d) {
  try { return new Date(d).toLocaleString() } catch { return '' }
}

async function loadTickets() {
  loading.value = true
  try {
    const { data } = await api.getSupportTickets()
    tickets.value = data?.tickets || []
  } catch (e) { /* keep empty */ }
  loading.value = false
}

async function loadCategories() {
  try {
    const { data } = await api.getSupportCategories()
    categories.value = data?.categories || []
  } catch (e) { /* optional */ }
}

function openNew() { view.value = 'new' }
function backToList() { view.value = 'list'; active.value = null; loadTickets() }

async function submit() {
  if (!canSubmit.value) return
  submitting.value = true
  try {
    const { data } = await api.createSupportTicket(form.value)
    active.value = data
    view.value = 'detail'
    form.value = { subject: '', category: null, priority: 'normal', message: '' }
    notify('Ticket created', 'success')
    loadTickets()
  } catch (e) {
    notify('Could not create ticket', 'error')
  }
  submitting.value = false
}

async function openTicket(ref) {
  try {
    const { data } = await api.getSupportTicket(ref)
    active.value = data
    view.value = 'detail'
  } catch (e) { notify('Could not open ticket', 'error') }
}

async function sendReply() {
  if (!reply.value.trim()) return
  replying.value = true
  try {
    await api.replySupportTicket(active.value.reference, { body: reply.value })
    reply.value = ''
    const { data } = await api.getSupportTicket(active.value.reference)
    active.value = data
  } catch (e) { notify('Could not send reply', 'error') }
  replying.value = false
}

async function closeTicket() {
  try {
    const { data } = await api.updateSupportTicket(active.value.reference, { status: 'closed' })
    active.value = data
    notify('Ticket closed', 'success')
  } catch (e) { notify('Could not close ticket', 'error') }
}

async function reopen() {
  try {
    const { data } = await api.updateSupportTicket(active.value.reference, { status: 'open' })
    active.value = data
  } catch (e) { notify('Could not reopen ticket', 'error') }
}

onMounted(() => {
  loadCategories()
  loadTickets()
  // Deep-link: /dashboard/help-center/support?new=1 opens the form.
  if (router.currentRoute.value.query.new) view.value = 'new'
  const ref = router.currentRoute.value.query.ref
  if (ref) openTicket(ref)
})
</script>

<style scoped>
.support-page {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 28px;
  min-height: 100%;
  padding: 30px 34px;
  background: #f8fbff;
  color: #0f172a;
}
.support-main { max-width: 900px; width: 100%; justify-self: center; }
.support-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
.support-head h1 { margin: 0; font-size: 22px; font-weight: 850; }
.support-head p { margin: 7px 0 0; color: #64748b; font-size: 13px; }
.primary { display: inline-flex; align-items: center; gap: 8px; height: 38px; border: 0; border-radius: 9px; background: #2563eb; padding: 0 16px; color: #fff; font-size: 12.5px; font-weight: 850; }
.primary:disabled { opacity: .55; }
.primary svg { width: 15px; height: 15px; }
.ghost { height: 38px; border: 1px solid #dbe4f0; border-radius: 9px; background: #fff; padding: 0 16px; color: #334155; font-size: 12.5px; font-weight: 850; }
.link { border: 0; background: transparent; color: #2563eb; font-size: 12.5px; font-weight: 850; display: inline-flex; align-items: center; gap: 6px; }
.link svg { width: 15px; height: 15px; }
.panel { border: 1px solid #dfe7f2; border-radius: 13px; background: #fff; padding: 20px; box-shadow: 0 8px 22px rgba(15, 23, 42, .04); }
.panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.panel-head h2 { margin: 0; font-size: 16px; font-weight: 850; }
.field { display: block; margin-bottom: 14px; }
.field > span { display: block; margin-bottom: 6px; color: #334155; font-size: 12px; font-weight: 800; }
.field input, .field select, .field textarea {
  width: 100%; border: 1px solid #d8e2f0; border-radius: 9px; background: #fff;
  padding: 10px 12px; color: #0f172a; font-size: 13.5px; font-family: inherit; outline: none;
}
.field input:focus, .field select:focus, .field textarea:focus { border-color: #2563eb; }
.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.form-actions { display: flex; justify-content: flex-end; margin-top: 6px; }
.list-filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.list-filters button { height: 30px; border: 1px solid #dbe4f0; border-radius: 999px; background: #fff; padding: 0 14px; color: #334155; font-size: 12px; font-weight: 800; }
.list-filters button.active { border-color: #2563eb; background: #2563eb; color: #fff; }
.ticket-list { list-style: none; margin: 0; padding: 0; }
.ticket-list li { display: grid; grid-template-columns: minmax(0, 1fr) auto auto 16px; align-items: center; gap: 12px; padding: 14px 4px; border-top: 1px solid #edf2f7; cursor: pointer; }
.ticket-list li:first-child { border-top: 0; }
.ticket-list li:hover { background: #f8fbff; }
.t-main strong { display: block; font-size: 13.5px; font-weight: 850; }
.t-main small { display: block; margin-top: 3px; color: #64748b; font-size: 11.5px; }
.ticket-list li > svg { width: 16px; height: 16px; color: #94a3b8; }
.status-pill { border-radius: 7px; padding: 4px 10px; font-size: 10.5px; font-weight: 850; text-transform: capitalize; }
.status-pill.open { background: #eaf1ff; color: #2563eb; }
.status-pill.pending { background: #fff5d9; color: #b7791f; }
.status-pill.resolved { background: #dff8ef; color: #059669; }
.status-pill.closed { background: #f1f5f9; color: #64748b; }
.prio { font-size: 11px; font-weight: 850; text-transform: capitalize; }
.prio.low { color: #64748b; } .prio.normal { color: #2563eb; }
.prio.high { color: #d97706; } .prio.urgent { color: #dc2626; }
.detail-meta { display: flex; align-items: center; gap: 8px; margin: 8px 0 18px; color: #64748b; font-size: 12px; font-weight: 700; }
.detail-meta .dot { color: #cbd5e1; }
.thread { display: grid; gap: 12px; }
.msg { border: 1px solid #e5ebf3; border-radius: 10px; padding: 14px; }
.msg.staff { background: #f4f8ff; border-color: #dbe7ff; }
.msg-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 6px; }
.msg-head strong { font-size: 12.5px; font-weight: 850; }
.msg-head small { color: #94a3b8; font-size: 11px; }
.msg p { margin: 0; color: #334155; font-size: 13.5px; line-height: 1.55; white-space: pre-wrap; }
.reply-box { margin-top: 18px; }
.reply-box textarea { width: 100%; border: 1px solid #d8e2f0; border-radius: 9px; padding: 10px 12px; font-family: inherit; font-size: 13.5px; outline: none; }
.reply-box textarea:focus { border-color: #2563eb; }
.reply-actions { display: flex; justify-content: space-between; margin-top: 10px; }
.closed-note { margin-top: 16px; color: #64748b; font-size: 12.5px; }
.empty { display: grid; place-items: center; gap: 10px; padding: 40px 0; color: #64748b; font-size: 13px; text-align: center; }
.empty svg { width: 32px; height: 32px; color: #cbd5e1; }
.support-rail { display: grid; align-content: start; gap: 16px; }
.rail-card { border: 1px solid #dfe7f2; border-radius: 13px; background: #fff; padding: 18px; box-shadow: 0 8px 22px rgba(15, 23, 42, .04); }
.rail-card h2 { margin: 0 0 12px; font-size: 14px; font-weight: 850; }
.rail-row { display: flex; width: 100%; align-items: center; gap: 12px; border: 1px solid #e5ebf3; border-radius: 9px; background: #fff; padding: 10px; margin-bottom: 8px; text-align: left; text-decoration: none; color: inherit; cursor: pointer; }
.rail-row > span:first-child { display: grid; width: 36px; height: 36px; place-items: center; border-radius: 9px; flex-shrink: 0; }
.rail-row > span:first-child svg { width: 18px; height: 18px; }
.rail-row > span:nth-child(2) { flex: 1; min-width: 0; }
.rail-row strong { display: block; font-size: 12.5px; font-weight: 850; }
.rail-row small { display: block; margin-top: 2px; color: #64748b; font-size: 11.5px; }
.rail-row > svg { width: 15px; height: 15px; color: #94a3b8; }
.blue { background: #eef4ff; color: #2563eb; }
.violet { background: #f2efff; color: #7c3aed; }
.teal { background: #e7fbf6; color: #0faaa5; }
.tips ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.tips li { display: flex; align-items: center; gap: 9px; color: #475569; font-size: 12.5px; font-weight: 650; }
.tips li svg { width: 15px; height: 15px; color: #10b981; }
@media (max-width: 1100px) {
  .support-page { grid-template-columns: 1fr; }
}
@media (max-width: 680px) {
  .support-page { padding: 22px 16px; }
  .field-row { grid-template-columns: 1fr; }
}
</style>
