<template>
  <main class="approvals-page">
    <section class="approvals-main">
      <header class="page-head">
        <div>
          <h1>Approvals</h1>
          <p>Requests from connected apps (such as Claude or ChatGPT) that are waiting for you. Nothing runs
            until you approve it here, and each approval starts exactly one thing.</p>
        </div>
        <button class="refresh" type="button" :disabled="loading" @click="load">
          <Icon icon="lucide:refresh-cw" :class="{ spin: loading }" /> Refresh
        </button>
      </header>

      <section class="panel">
        <header class="section-head">
          <h2>Waiting for you</h2>
          <span class="pill" :class="{ warn: items.length }">{{ items.length }} pending</span>
        </header>

        <p v-if="error" class="error-row">{{ error }}</p>
        <p v-else-if="!loading && !items.length" class="muted-row" data-test="approvals-empty">
          Nothing is waiting for you.
        </p>

        <article v-for="a in items" :key="a.id" class="req" :data-test="'approval-' + a.id">
          <div class="req-body">
            <div class="req-top">
              <span class="who">{{ a.requested_by_client }}</span>
              <span v-if="a.agent" class="agent">· {{ a.agent }}</span>
              <span class="when">{{ ago(a.requested_at) }}</span>
            </div>
            <p class="what">{{ a.action || a.summary }}</p>
            <p v-if="a.risk" class="risk"><Icon icon="lucide:shield-alert" /> {{ a.risk }}</p>
            <p v-if="a.expires_at" class="expires">Expires {{ when(a.expires_at) }} — no answer counts as no.</p>
          </div>
          <div class="req-actions">
            <button type="button" class="btn approve" :disabled="busy === a.id"
                    :data-test="'approve-' + a.id" @click="decide(a, 'approve')">Approve</button>
            <button type="button" class="btn reject" :disabled="busy === a.id"
                    :data-test="'reject-' + a.id" @click="decide(a, 'reject')">Reject</button>
          </div>
        </article>
      </section>
    </section>
  </main>
</template>

<script setup>
// Approvals raised through MCP. A chat approval appears as a card in the chat that raised it; one raised by
// a connected app belongs to no chat, so before this page there was nowhere in AADML to answer it — and
// the Canvas gate deliberately refuses an approval given by the very app that asked.
import { ref, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import api from '../services/api'
import { useNotify } from '../composables/useNotify'
import { useConfirm } from '../composables/useConfirm'

const notify = useNotify()
const confirm = useConfirm()

const items = ref([])
const loading = ref(false)
const error = ref('')
const busy = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const d = (await api.getPendingApprovals()).data || {}
    items.value = d.items || []
  } catch (e) {
    error.value = e?.response?.data?.error || 'Could not load your approvals.'
  } finally {
    loading.value = false
  }
}

async function decide(a, decision) {
  if (decision === 'reject') {
    const ok = await confirm({
      title: 'Reject this request?',
      message: 'Nothing will run. The app that asked is told you said no.',
      confirmText: 'Reject', danger: true,
    })
    if (!ok) return
  }
  busy.value = a.id
  try {
    await api.decideApproval(a.id, decision)
    items.value = items.value.filter((x) => x.id !== a.id)
    notify.success(decision === 'approve'
      ? 'Approved — the app can now go ahead, once.'
      : 'Rejected — nothing will run.')
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Could not record your decision.')
    await load()
  } finally {
    busy.value = ''
  }
}

function ago(iso) {
  if (!iso) return ''
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
function when(iso) { try { return new Date(iso).toLocaleString() } catch { return iso } }

onMounted(load)
</script>

<style scoped>
.approvals-page { padding: 28px 32px; }
.approvals-main { max-width: 1100px; margin: 0 auto; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 18px; }
.page-head h1 { margin: 0; font-size: 24px; font-weight: 850; }
.page-head p { margin: 8px 0 0; color: #64748b; font-size: 13px; max-width: 70ch; }
.refresh { display: inline-flex; align-items: center; gap: 6px; border: 1px solid #e2e8f0; background: #fff;
  border-radius: 10px; padding: 8px 12px; font-size: 13px; font-weight: 600; cursor: pointer; }
.refresh:disabled { opacity: .6; cursor: default; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
.panel { background: #fff; border: 1px solid #e5ebf3; border-radius: 14px; padding: 20px; }
.section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.section-head h2 { margin: 0; font-size: 16px; font-weight: 800; }
.pill { font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 999px; background: #f1f5f9; color: #475569; }
.pill.warn { background: #eff6ff; color: #2563eb; }
.muted-row { color: #64748b; font-size: 13px; margin: 12px 0 0; }
.error-row { color: #b91c1c; font-size: 13px; margin: 12px 0 0; }
.req { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
  padding: 14px 0; border-top: 1px solid #eef2f7; }
.req:first-of-type { border-top: 0; }
.req-body { min-width: 0; flex: 1; }
.req-top { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; font-size: 13px; }
.who { font-weight: 800; }
.agent { color: #475569; }
.when { color: #94a3b8; margin-left: auto; }
.what { margin: 6px 0 0; font-size: 14px; line-height: 1.5; overflow-wrap: anywhere; }
.risk { display: flex; align-items: center; gap: 6px; margin: 8px 0 0; color: #b45309; font-size: 12.5px; }
.expires { margin: 6px 0 0; color: #94a3b8; font-size: 12px; }
.req-actions { display: flex; gap: 8px; flex-shrink: 0; }
.btn { border-radius: 10px; padding: 8px 14px; font-size: 13px; font-weight: 700; cursor: pointer; border: 1px solid transparent; }
.btn:disabled { opacity: .6; cursor: default; }
.btn:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
.approve { background: #2563eb; color: #fff; }
.reject { background: #fff; color: #b91c1c; border-color: #fecaca; }
@media (max-width: 640px) {
  .approvals-page { padding: 20px 16px; }
  .req { flex-direction: column; }
  .when { margin-left: 0; }
}
</style>
