<template>
  <div class="nb" :class="{ collapsed }">
    <button class="nb-btn" :title="collapsed ? 'Notifications' : ''" aria-label="Notifications" @click="toggle">
      <Icon icon="lucide:bell" />
      <span v-if="!collapsed" class="nb-label">Notifications</span>
      <span v-if="unread > 0" class="nb-badge">{{ unread > 99 ? '99+' : unread }}</span>
    </button>

    <Teleport to="body">
      <div v-if="open" class="nb-backdrop" @click="open = false" />
      <transition name="nb-pop">
        <section v-if="open" class="nb-panel" role="dialog" aria-label="Notifications">
          <header class="nb-head">
            <strong>Notifications</strong>
            <button v-if="unread > 0" class="nb-mark" @click="markAll">Mark all read</button>
          </header>
          <div class="nb-list">
            <div v-if="loading && !items.length" class="nb-empty">Loading…</div>
            <div v-else-if="!items.length" class="nb-empty">
              <Icon icon="lucide:bell-off" /><span>You're all caught up.</span>
            </div>
            <button v-for="n in items" :key="n.id" class="nb-item" :class="{ unread: !n.is_read }" @click="open_item(n)">
              <span class="nb-dot" :class="{ on: !n.is_read }" />
              <span class="nb-body">
                <span class="nb-title">{{ n.title }}</span>
                <span v-if="n.body" class="nb-text">{{ n.body }}</span>
                <span class="nb-time">{{ ago(n.created_at) }}</span>
              </span>
            </button>
          </div>
          <footer v-if="hasNext" class="nb-foot">
            <button class="nb-more" :disabled="loading" @click="loadMore">Load more</button>
          </footer>
        </section>
      </transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import api from '../../services/api'

defineProps({ collapsed: { type: Boolean, default: false } })
const router = useRouter()

const unread = ref(0)
const items = ref([])
const open = ref(false)
const loading = ref(false)
const page = ref(1)
const hasNext = ref(false)
let poll = null

async function loadCount() {
  try { const { data } = await api.getNotifUnreadCount(); unread.value = data?.count || 0 } catch (e) { /* silent */ }
}
async function loadList(reset = true) {
  loading.value = true
  if (reset) { page.value = 1; items.value = [] }
  try {
    const { data } = await api.getNotifications({ page: page.value, per_page: 15 })
    items.value = reset ? (data?.results || []) : [...items.value, ...(data?.results || [])]
    hasNext.value = !!data?.has_next
    unread.value = data?.unread_count ?? unread.value
  } catch (e) { /* silent */ }
  loading.value = false
}
function loadMore() { page.value += 1; loadList(false) }

async function toggle() {
  open.value = !open.value
  if (open.value) await loadList(true)
}
async function markAll() {
  try { await api.markAllNotifsRead(); items.value = items.value.map(n => ({ ...n, is_read: true })); unread.value = 0 } catch (e) { /* silent */ }
}
async function open_item(n) {
  if (!n.is_read) {
    try { await api.markNotifRead(n.id); n.is_read = true; unread.value = Math.max(0, unread.value - 1) } catch (e) { /* silent */ }
  }
  const url = n.metadata?.action_url || (n.metadata?.agent_id ? `/dashboard/agents/${n.metadata.agent_id}/editor` : '')
  if (url) { open.value = false; router.push(url) }
}

// Relative time (compact).
function ago(iso) {
  try {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
    if (s < 60) return 'just now'
    if (s < 3600) return `${Math.floor(s / 60)}m ago`
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`
    return `${Math.floor(s / 86400)}d ago`
  } catch { return '' }
}

onMounted(() => { loadCount(); poll = setInterval(loadCount, 30000) })
onBeforeUnmount(() => { if (poll) clearInterval(poll) })
</script>

<style scoped>
.nb-btn { position: relative; display: flex; align-items: center; gap: 10px; width: 100%; border: 0; background: transparent; border-radius: 10px; padding: 9px 12px; font-size: 0.8125rem; font-weight: 600; color: var(--vm-ink-soft, #475569); cursor: pointer; }
.nb-btn:hover { background: rgba(99,102,241,.08); color: var(--vm-ink, #0f172a); }
.nb-btn svg { width: 18px; height: 18px; flex-shrink: 0; }
.nb.collapsed .nb-btn { justify-content: center; }
.nb-badge { position: absolute; top: 3px; left: 22px; min-width: 16px; height: 16px; padding: 0 4px; display: grid; place-items: center; border-radius: 999px; background: #ef4444; color: #fff; font-size: 10px; font-weight: 800; line-height: 1; }
.nb.collapsed .nb-badge { left: auto; right: 8px; }

.nb-backdrop { position: fixed; inset: 0; z-index: 120; }
.nb-panel { position: fixed; left: 16px; bottom: 78px; z-index: 121; width: 360px; max-width: calc(100vw - 32px); max-height: 66vh; display: flex; flex-direction: column; background: #fff; border: 1px solid #e5ebf3; border-radius: 14px; box-shadow: 0 24px 60px rgba(15,23,42,.24); overflow: hidden; }
.nb-head { display: flex; align-items: center; justify-content: space-between; padding: 13px 15px; border-bottom: 1px solid #eef2f7; }
.nb-head strong { font-size: 14px; font-weight: 800; color: #0f172a; }
.nb-mark { border: 0; background: transparent; color: #4f46e5; font-size: 12px; font-weight: 700; cursor: pointer; }
.nb-list { flex: 1; overflow-y: auto; }
.nb-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 16px; color: #94a3b8; font-size: 13px; }
.nb-empty svg { width: 26px; height: 26px; }
.nb-item { display: flex; align-items: flex-start; gap: 10px; width: 100%; border: 0; border-bottom: 1px solid #f4f6fa; background: transparent; padding: 12px 15px; text-align: left; cursor: pointer; }
.nb-item:hover { background: #fafbff; }
.nb-item.unread { background: #f5f8ff; }
.nb-dot { margin-top: 6px; width: 8px; height: 8px; border-radius: 50%; background: transparent; flex-shrink: 0; }
.nb-dot.on { background: #4f46e5; }
.nb-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.nb-title { font-size: 13px; font-weight: 700; color: #0f172a; }
.nb-text { font-size: 12px; color: #64748b; line-height: 1.4; }
.nb-time { font-size: 11px; color: #a3adba; margin-top: 2px; }
.nb-foot { padding: 8px; border-top: 1px solid #eef2f7; text-align: center; }
.nb-more { border: 0; background: transparent; color: #4f46e5; font-size: 12.5px; font-weight: 700; cursor: pointer; }
.nb-pop-enter-active, .nb-pop-leave-active { transition: opacity .15s, transform .15s; }
.nb-pop-enter-from, .nb-pop-leave-to { opacity: 0; transform: translateY(8px); }
</style>
