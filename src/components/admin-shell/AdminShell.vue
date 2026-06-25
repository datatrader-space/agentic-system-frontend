<template>
  <div class="admin-shell">
    <!-- Sidebar -->
    <aside class="admin-sidebar">
      <div class="admin-brand">
        <span class="admin-logo">⚙</span>
        <div>
          <div class="admin-title">Admin</div>
          <div class="admin-sub">Platform control</div>
        </div>
      </div>

      <nav class="admin-nav">
        <router-link v-for="item in nav" :key="item.to" :to="item.to" class="admin-nav-item"
                     :class="{ active: isActive(item) }">
          <svg viewBox="0 0 24 24" class="admin-nav-ico" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <path v-for="(d, i) in item.icon" :key="i" :d="d" />
          </svg>
          <span>{{ item.label }}</span>
        </router-link>
      </nav>

      <div class="admin-nav-divider"></div>
      <a :href="djangoAdminUrl" target="_blank" rel="noopener" class="admin-nav-item">
        <svg viewBox="0 0 24 24" class="admin-nav-ico" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 3h7v7" /><path d="M10 14 21 3" /><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
        </svg>
        <span>Django Admin (raw DB)</span>
      </a>

      <div class="admin-foot">
        <router-link to="/dashboard/chat/new" class="admin-back">← Back to app</router-link>
        <div v-if="user" class="admin-user">{{ user.email || user.username }}</div>
      </div>
    </aside>

    <!-- Main -->
    <main class="admin-main">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '../../services/api'

const route = useRoute()
const user = ref(null)

const nav = [
  { to: '/admin-dashboard/overview', label: 'Overview', icon: ['M3 13h8V3H3zM13 21h8V3h-8zM3 21h8v-6H3z'] },
  { to: '/admin-dashboard/platform', label: 'Platform & Users', icon: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 7a4 4 0 1 0 0 .01', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'] },
  { to: '/admin-dashboard/knowledge', label: 'Knowledge & Crawl', icon: ['M2 12a10 10 0 1 0 20 0 10 10 0 1 0-20 0', 'M2 12h20', 'M12 2a15 15 0 0 1 0 20a15 15 0 0 1 0-20'] },
  { to: '/admin-dashboard/model-pricing', label: 'Model Pricing', icon: ['M12 1v22', 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'] },
  { to: '/admin-dashboard/llm-context', label: 'LLM Context', icon: ['M4 7V4h16v3', 'M9 20h6', 'M12 4v16', 'M4 12h16'] },
  { to: '/admin-dashboard/crawler-export', label: 'Crawler Export API', icon: ['M21 2H3v16h5v4l4-4h5l4-4z', 'M8 9h8', 'M8 13h6'] },
]

// Django admin lives on the backend (:8000 in dev; same origin in prod).
const djangoAdminUrl = computed(() => {
  const { protocol, hostname, port } = window.location
  if (port === '5173') return `${protocol}//${hostname}:8000/admin/`
  return '/admin/'
})

function isActive(item) {
  return route.path === item.to || route.path.startsWith(item.to + '/')
}

onMounted(async () => {
  try { user.value = (await api.getCurrentUser?.()).data?.user || (await api.checkAuth()).data?.user } catch { /* noop */ }
})
</script>

<style scoped>
.admin-shell { display: flex; min-height: 100vh; background: #0f172a; color: #e2e8f0; }
.admin-sidebar {
  width: 248px; flex-shrink: 0; background: #111827; border-right: 1px solid #1f2937;
  display: flex; flex-direction: column; padding: 18px 12px; position: sticky; top: 0; height: 100vh;
}
.admin-brand { display: flex; align-items: center; gap: 10px; padding: 4px 8px 18px; }
.admin-logo { font-size: 22px; }
.admin-title { font-weight: 700; font-size: 15px; color: #fff; }
.admin-sub { font-size: 11px; color: #64748b; }
.admin-nav { display: flex; flex-direction: column; gap: 2px; }
.admin-nav-item {
  display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 9px;
  color: #94a3b8; font-size: 13.5px; font-weight: 500; text-decoration: none; transition: all .15s;
}
.admin-nav-item:hover { background: #1e293b; color: #e2e8f0; }
.admin-nav-item.active { background: #4f46e5; color: #fff; }
.admin-nav-ico { width: 18px; height: 18px; flex-shrink: 0; }
.admin-nav-divider { height: 1px; background: #1f2937; margin: 12px 8px; }
.admin-foot { margin-top: auto; padding: 12px 8px 4px; border-top: 1px solid #1f2937; }
.admin-back { color: #818cf8; font-size: 12.5px; text-decoration: none; font-weight: 600; }
.admin-back:hover { color: #a5b4fc; }
.admin-user { font-size: 11px; color: #64748b; margin-top: 8px; word-break: break-all; }
.admin-main { flex: 1; min-width: 0; overflow-x: hidden; background: #f8fafc; color: #0f172a; }
</style>
