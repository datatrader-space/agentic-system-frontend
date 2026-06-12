<template>
  <aside class="ctx-panel">
    <!-- Header -->
    <div class="ctx-header">
      <span class="ctx-title">Context</span>
      <div class="ctx-actions">
        <button class="ctx-icon-btn" title="Refresh" aria-label="Refresh context" @click="store.loadSystems()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M23 4v6h-6M1 20v-6h6" stroke-linecap="round" stroke-linejoin="round" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
        <button v-if="overlay" class="ctx-icon-btn" title="Close" aria-label="Close panel" @click="$emit('close')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" /></svg>
        </button>
        <button v-else class="ctx-icon-btn" title="Hide panel (Ctrl/Cmd+J)" aria-label="Hide context panel" @click="layout.toggleRightPanel()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
      </div>
    </div>

    <div class="ctx-body">
      <!-- Loading skeleton -->
      <div v-if="store.loading && !store.loaded" class="skeleton-card">
        <div class="sk-line w40" /><div class="sk-line w70" /><div class="sk-line w50" />
        <div class="sk-stats"><div class="sk-box" /><div class="sk-box" /></div>
      </div>

      <!-- Error -->
      <div v-else-if="store.error" class="state-block">
        <p class="state-title">Couldn't load systems</p>
        <p class="state-sub">{{ store.error }}</p>
        <button class="state-btn" @click="store.loadSystems()">Retry</button>
      </div>

      <!-- Empty (no systems) -->
      <div v-else-if="store.loaded && !store.hasSystems" class="state-block">
        <div class="state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>
        </div>
        <p class="state-title">No systems yet</p>
        <p class="state-sub">Create an agent system to see its context here.</p>
        <router-link class="state-btn" to="/dashboard/systems" @click="closeOverlay">View Systems</router-link>
      </div>

      <!-- Content -->
      <template v-else-if="cur">
        <!-- System switcher (only when multiple) -->
        <select
          v-if="store.systems.length > 1"
          class="sys-select"
          :value="store.currentId"
          @change="onSelect($event)"
        >
          <option v-for="s in store.systems" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
        </select>

        <!-- Current system card -->
        <div class="sys-card">
          <div class="sys-card-head">
            <span class="sys-label">Current System</span>
            <span class="sys-badge" :class="statusClass(cur.status)">{{ cur.status || 'unknown' }}</span>
          </div>
          <div class="sys-name">{{ cur.name }}</div>
          <div v-if="cur.description" class="sys-type">{{ cur.description }}</div>
          <div class="sys-created">Created {{ formatDate(cur.created_at) }}</div>
          <div class="sys-stats">
            <div class="stat"><span class="stat-val">{{ cur.repositories_count ?? store.repositories.length }}</span><span class="stat-key">Repositories</span></div>
            <div class="stat"><span class="stat-val">{{ cur.knowledge_count ?? 0 }}</span><span class="stat-key">Knowledge</span></div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="ctx-tabs">
          <button
            v-for="tab in tabs"
            :key="tab"
            class="ctx-tab"
            :class="{ active: layout.activeRightTab === tab }"
            @click="layout.setRightTab(tab)"
          >{{ tab }}</button>
        </div>

        <div class="ctx-tab-content">
          <!-- Context: repositories -->
          <template v-if="active === 'Context'">
            <div class="section-title">Repositories</div>
            <div v-if="store.detailLoading" class="sk-line w70" />
            <ul v-else-if="store.repositories.length" class="list">
              <li v-for="r in store.repositories" :key="r.id" class="list-row">
                <span class="dot" :class="statusClass(r.status)"></span>
                <span class="list-name">{{ r.name || r.repo_name || ('Repo #' + r.id) }}</span>
                <span class="list-meta">{{ r.status || '' }}</span>
              </li>
            </ul>
            <p v-else class="muted">No repositories in this system.</p>
          </template>

          <!-- Activity -->
          <template v-else-if="active === 'Activity'">
            <div class="section-title">Recent Activity</div>
            <div v-if="store.detailLoading" class="sk-line w70" />
            <ul v-else-if="store.activity.length" class="list">
              <li v-for="a in store.activity" :key="a.id" class="list-row">
                <span class="dot" :class="statusClass(a.status)"></span>
                <span class="list-name">{{ a.title || a.name || a.description || ('Task #' + a.id) }}</span>
                <span class="list-meta">{{ timeAgo(a.created_at) }}</span>
              </li>
            </ul>
            <p v-else class="muted">No recent activity.</p>
          </template>

          <!-- Tools -->
          <template v-else-if="active === 'Tools'">
            <p class="muted">Manage the tools available to your agents.</p>
            <router-link class="link-btn" to="/dashboard/tools" @click="closeOverlay">Open Tool Registry →</router-link>
            <router-link class="link-btn" to="/dashboard/connectors" @click="closeOverlay">Manage Connectors →</router-link>
          </template>

          <!-- Files -->
          <template v-else-if="active === 'Files'">
            <p class="muted">Open a repository to browse its files.</p>
            <ul v-if="store.repositories.length" class="list">
              <li v-for="r in store.repositories" :key="r.id">
                <router-link class="file-link" :to="`/systems/${store.currentId}/repositories/${r.id}`" @click="closeOverlay">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke-linecap="round" stroke-linejoin="round" /></svg>
                  {{ r.name || ('Repo #' + r.id) }}
                </router-link>
              </li>
            </ul>
          </template>

          <!-- Settings -->
          <template v-else>
            <p class="muted">System configuration and details.</p>
            <router-link class="link-btn" :to="`/systems/${store.currentId}`" @click="closeOverlay">Open System →</router-link>
            <router-link class="link-btn" to="/dashboard/systems" @click="closeOverlay">All Systems →</router-link>
          </template>
        </div>
      </template>
    </div>
  </aside>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useLayoutStore } from '../../stores/useLayoutStore'
import { useSystemStore } from '../../stores/useSystemStore'

defineProps({ overlay: { type: Boolean, default: false } })
const emit = defineEmits(['close'])

const layout = useLayoutStore()
const store = useSystemStore()

const tabs = ['Context', 'Tools', 'Files', 'Activity', 'Settings']
const active = computed(() => layout.activeRightTab)
const cur = computed(() => store.current)

const onSelect = (e) => store.selectSystem(e.target.value)
const closeOverlay = () => emit('close')

const statusClass = (status) => {
  const s = (status || '').toLowerCase()
  if (['active', 'ready', 'done', 'completed', 'analyzed', 'connected'].some((k) => s.includes(k))) return 'ok'
  if (['error', 'failed'].some((k) => s.includes(k))) return 'err'
  if (['initializing', 'pending', 'running', 'analyzing', 'processing'].some((k) => s.includes(k))) return 'warn'
  return ''
}

const formatDate = (d) => {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return '—'
  }
}

const timeAgo = (d) => {
  if (!d) return ''
  const diff = Date.now() - new Date(d).getTime()
  if (Number.isNaN(diff)) return ''
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

onMounted(() => {
  if (!store.loaded && !store.loading) store.loadSystems()
})
</script>

<style scoped>
.ctx-panel { display: flex; flex-direction: column; width: 320px; height: 100%; background: #fff; border-left: 1px solid #e7eaf0; }
.ctx-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #eef1f5; }
.ctx-title { font-size: 0.875rem; font-weight: 600; color: #0f172a; }
.ctx-actions { display: flex; gap: 2px; }
.ctx-icon-btn { display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; background: transparent; border: none; border-radius: 8px; color: #64748b; cursor: pointer; transition: background 0.15s, color 0.15s; }
.ctx-icon-btn:hover { background: #f1f5f9; color: #0f172a; }
.ctx-icon-btn svg { width: 16px; height: 16px; }

.ctx-body { flex: 1; min-height: 0; overflow-y: auto; padding: 16px; }

.sys-select {
  width: 100%; margin-bottom: 12px; padding: 8px 10px;
  font-size: 0.8125rem; color: #0f172a;
  border: 1px solid #e2e8f0; border-radius: 9px; background: #fff; cursor: pointer;
}

.sys-card { border: 1px solid #e7eaf0; border-radius: 14px; padding: 16px; }
.sys-card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.sys-label { font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #94a3b8; }
.sys-badge { padding: 2px 9px; font-size: 0.6875rem; font-weight: 600; border-radius: 999px; color: #475569; background: #f1f5f9; }
.sys-badge.ok { color: #16a34a; background: #f0fdf4; }
.sys-badge.warn { color: #b45309; background: #fef3c7; }
.sys-badge.err { color: #dc2626; background: #fef2f2; }
.sys-name { font-size: 1.0625rem; font-weight: 700; color: #0f172a; }
.sys-type { font-size: 0.8125rem; color: #64748b; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.sys-created { font-size: 0.75rem; color: #94a3b8; margin-top: 2px; }
.sys-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 14px; }
.stat { display: flex; flex-direction: column; }
.stat-val { font-size: 1.0625rem; font-weight: 700; color: #4f46e5; }
.stat-key { font-size: 0.625rem; color: #94a3b8; }

.ctx-tabs { display: flex; gap: 2px; margin: 16px 0 12px; border-bottom: 1px solid #eef1f5; overflow-x: auto; }
.ctx-tab { padding: 8px 10px; font-size: 0.8125rem; font-weight: 500; color: #64748b; background: transparent; border: none; border-bottom: 2px solid transparent; cursor: pointer; white-space: nowrap; transition: color 0.15s, border-color 0.15s; }
.ctx-tab:hover { color: #0f172a; }
.ctx-tab.active { color: #4f46e5; border-bottom-color: #4f46e5; }

.section-title { font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #94a3b8; margin-bottom: 8px; }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.list-row { display: flex; align-items: center; gap: 8px; padding: 7px 8px; border-radius: 8px; font-size: 0.8125rem; color: #334155; }
.list-row:hover { background: #f8fafc; }
.list-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.list-meta { font-size: 0.6875rem; color: #94a3b8; flex-shrink: 0; }
.dot { width: 7px; height: 7px; border-radius: 50%; background: #cbd5e1; flex-shrink: 0; }
.dot.ok { background: #10b981; } .dot.warn { background: #f59e0b; } .dot.err { background: #ef4444; }
.muted { font-size: 0.8125rem; color: #94a3b8; margin: 0 0 12px; line-height: 1.5; }

.link-btn, .file-link {
  display: flex; align-items: center; gap: 8px;
  padding: 9px 12px; margin-bottom: 6px;
  font-size: 0.8125rem; font-weight: 500; color: #4f46e5;
  text-decoration: none; border: 1px solid #e7eaf0; border-radius: 9px;
  transition: background 0.15s, border-color 0.15s;
}
.link-btn:hover, .file-link:hover { background: #fafaff; border-color: #c7d2fe; }
.file-link svg { width: 15px; height: 15px; }

/* States */
.state-block { text-align: center; padding: 32px 12px; }
.state-icon { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; margin-bottom: 12px; color: #cbd5e1; background: #f8fafc; border-radius: 12px; }
.state-icon svg { width: 22px; height: 22px; }
.state-title { font-size: 0.9375rem; font-weight: 600; color: #334155; margin: 0 0 4px; }
.state-sub { font-size: 0.8125rem; color: #94a3b8; margin: 0 0 16px; }
.state-btn { display: inline-block; padding: 8px 16px; font-size: 0.8125rem; font-weight: 500; color: #fff; background: linear-gradient(135deg, #6366f1, #8b5cf6); border: none; border-radius: 9px; cursor: pointer; text-decoration: none; }

/* Skeleton */
.skeleton-card { border: 1px solid #eef1f5; border-radius: 14px; padding: 16px; }
.sk-line { height: 12px; border-radius: 6px; background: linear-gradient(90deg, #f1f5f9, #e2e8f0, #f1f5f9); background-size: 200% 100%; animation: shimmer 1.4s infinite; margin-bottom: 10px; }
.sk-line.w40 { width: 40%; } .sk-line.w50 { width: 50%; } .sk-line.w70 { width: 70%; }
.sk-stats { display: flex; gap: 8px; margin-top: 6px; }
.sk-box { flex: 1; height: 40px; border-radius: 8px; background: linear-gradient(90deg, #f1f5f9, #e2e8f0, #f1f5f9); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
</style>
