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
      <AppBreadcrumbs />
      <router-view v-slot="{ Component }">
        <Suspense>
          <component :is="Component" :key="route.fullPath" />
          <template #fallback>
            <div class="admin-route-loading">
              <div class="admin-skeleton__toolbar">
                <span class="vm-skel admin-skeleton__search"></span>
                <span class="vm-skel admin-skeleton__filter"></span>
                <span class="vm-skel admin-skeleton__filter short"></span>
              </div>
              <div class="admin-skeleton__grid">
                <article v-for="item in 6" :key="item" class="admin-skeleton__card">
                  <div class="admin-skeleton__top">
                    <span class="vm-skel admin-skeleton__avatar"></span>
                    <span class="vm-skel admin-skeleton__pill"></span>
                  </div>
                  <span class="vm-skel admin-skeleton__line title"></span>
                  <span class="vm-skel admin-skeleton__line"></span>
                  <span class="vm-skel admin-skeleton__line wide"></span>
                  <span class="vm-skel admin-skeleton__line mid"></span>
                  <div class="admin-skeleton__foot">
                    <span class="vm-skel"></span>
                    <span class="vm-skel"></span>
                  </div>
                </article>
              </div>
            </div>
          </template>
        </Suspense>
      </router-view>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '../../services/api'
import AppBreadcrumbs from '../common/AppBreadcrumbs.vue'

const route = useRoute()
const user = ref(null)

const nav = [
  { to: '/admin-dashboard/overview', label: 'Overview', icon: ['M3 13h8V3H3zM13 21h8V3h-8zM3 21h8v-6H3z'] },
  { to: '/admin-dashboard/operations', label: 'Operations', icon: ['M22 12h-4l-3 9L9 3l-3 9H2'] },
  { to: '/admin-dashboard/platform', label: 'Platform & Users', icon: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 7a4 4 0 1 0 0 .01', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'] },
  { to: '/admin-dashboard/guardrails', label: 'System Guardrails', icon: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'] },
  { to: '/admin-dashboard/knowledge', label: 'Knowledge & Crawl', icon: ['M2 12a10 10 0 1 0 20 0 10 10 0 1 0-20 0', 'M2 12h20', 'M12 2a15 15 0 0 1 0 20a15 15 0 0 1 0-20'] },
  { to: '/admin-dashboard/model-pricing', label: 'Model Pricing', icon: ['M12 1v22', 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'] },
  { to: '/admin-dashboard/llm-context', label: 'LLM Context', icon: ['M4 7V4h16v3', 'M9 20h6', 'M12 4v16', 'M4 12h16'] },
  { to: '/admin-dashboard/conversation-steps', label: 'Conversation Steps', icon: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'] },
  { to: '/admin-dashboard/training-data', label: 'Training Data', icon: ['M4 6c0-1.66 3.58-3 8-3s8 1.34 8 3-3.58 3-8 3-8-1.34-8-3z', 'M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6', 'M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6'] },
  { to: '/admin-dashboard/crawler-export', label: 'Crawler Export API', icon: ['M21 2H3v16h5v4l4-4h5l4-4z', 'M8 9h8', 'M8 13h6'] },
  { to: '/admin-dashboard/partner-keys', label: 'Partner Agent API', icon: ['M15 7a2 2 0 0 1 2 2m4-2a6 6 0 0 1-7.7 5.7l-4 4a2 2 0 0 1-1.4.6H8v2H6v2H2v-4l6.3-6.3A6 6 0 1 1 21 7z'] },
  { to: '/admin-dashboard/help-center', match: '/admin-dashboard/help-center', label: 'Help Center', icon: ['M4 4h16v16H4z', 'M8 8h8', 'M8 12h8', 'M8 16h5'] },
  { to: '/admin-dashboard/help-analytics', label: 'Help Analytics', icon: ['M3 3v18h18', 'M7 16l4-4 3 3 5-6'] },
  { to: '/admin-dashboard/builtin-agents', label: 'Built-in Agents', icon: ['M12 8V4H8', 'M4 12a8 8 0 0 1 8-8', 'M2 14h2', 'M20 14h2', 'M15 13v2', 'M9 13v2', 'M6 10h12v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z'] },
  { to: '/admin-dashboard/super-agent', label: 'Super Agent', icon: ['M12 2l2.4 5.4 5.6.6-4.2 3.9 1.2 5.6L12 14.9 7 17.5l1.2-5.6L4 8l5.6-.6L12 2z'] },
  { to: '/admin-dashboard/trace-waterfall', label: 'Trace Waterfall', icon: ['M3 3v18h18', 'M7 8h6', 'M7 12h10', 'M7 16h4'] },
  { to: '/admin-dashboard/eval-snapshot', label: 'Eval Snapshot', icon: ['M3 3v18h18', 'M7 16l4-4 3 3 5-6'] },
  { to: '/admin-dashboard/learning', label: 'Learning Monitor', icon: ['M12 3 2 8l10 5 10-5z', 'M6 10.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-5.5', 'M22 8v6'] },
  { to: '/admin-dashboard/cost', label: 'Cost per Org', icon: ['M3 3v18h18', 'M7 16v-5', 'M12 16V8', 'M17 16v-3'] },
  { to: '/admin-dashboard/speed-cache', label: 'Speed & Cache', icon: ['M13 2 3 14h9l-1 8 10-12h-9l1-8z'] },
  { to: '/admin-dashboard/registry-governance', label: 'Registry Governance', icon: ['M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z', 'M9 12l2 2 4-4'] },
  { to: '/admin-dashboard/capability-graph', label: 'Capability Graph', icon: ['M21 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M9 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M21 19a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M8.59 13.51l6.83 3.98', 'M15.41 6.51l-6.82 3.98'] },
  { to: '/admin-dashboard/runtime-metrics', label: 'Runtime Metrics', icon: ['M22 12h-4l-3 9L9 3l-3 9H2'] },
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
.admin-shell { display: flex; height: 100vh; overflow: hidden; background: #0f172a; color: #e2e8f0; }
.admin-sidebar {
  width: 248px; flex-shrink: 0; background: #111827; border-right: 1px solid #1f2937;
  display: flex; flex-direction: column; padding: 18px 12px; height: 100vh; overflow-y: auto;
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
.admin-main { flex: 1; min-width: 0; height: 100vh; overflow-y: auto; overflow-x: hidden; background: #f8fafc; color: #0f172a; }
.admin-route-loading {
  width: 100%;
  min-height: 320px;
  padding: 32px;
}
.admin-skeleton__toolbar { display: flex; gap: 10px; margin-bottom: 18px; }
.admin-skeleton__search { width: min(420px, 52%); height: 40px; border-radius: 9px; }
.admin-skeleton__filter { width: 140px; height: 40px; border-radius: 9px; }
.admin-skeleton__filter.short { width: 110px; }
.admin-skeleton__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
.admin-skeleton__card {
  min-height: 238px;
  border: 1px solid #dfe7f2;
  border-radius: 10px;
  background: #fff;
  padding: 22px;
  box-shadow: 0 8px 22px rgba(15, 23, 42, .035);
}
.admin-skeleton__top { display: flex; align-items: flex-start; justify-content: space-between; }
.admin-skeleton__avatar { width: 54px; height: 54px; border-radius: 16px; }
.admin-skeleton__pill { width: 54px; height: 22px; border-radius: 999px; }
.admin-skeleton__line { display: block; width: 78%; height: 13px; margin-top: 12px; }
.admin-skeleton__line.title { width: 56%; height: 18px; margin-top: 18px; }
.admin-skeleton__line.wide { width: 100%; }
.admin-skeleton__line.mid { width: 88%; margin-top: 8px; }
.admin-skeleton__foot { display: flex; gap: 9px; margin-top: 20px; }
.admin-skeleton__foot span { flex: 1; height: 38px; }
@media (max-width: 680px) {
  .admin-route-loading { padding: 22px 16px; }
  .admin-skeleton__toolbar { flex-direction: column; }
  .admin-skeleton__search,
  .admin-skeleton__filter,
  .admin-skeleton__filter.short { width: 100%; }
}
</style>
