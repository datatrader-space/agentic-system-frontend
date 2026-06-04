<template>
  <aside class="sidebar" :class="{ collapsed }" aria-label="Sidebar">
    <!-- Brand + workspace -->
    <div class="sidebar-top">
      <router-link to="/dashboard" class="brand" :title="collapsed ? 'Agentic v2' : ''">
        <span class="brand-mark">
          <svg viewBox="0 0 32 32" fill="none">
            <rect x="3" y="3" width="26" height="26" rx="8" stroke="url(#sb-g)" stroke-width="2.5" />
            <path d="M10 16l4 4 8-8" stroke="url(#sb-g)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
            <defs>
              <linearGradient id="sb-g" x1="0" y1="0" x2="32" y2="32">
                <stop stop-color="#6366f1" /><stop offset="1" stop-color="#d946ef" />
              </linearGradient>
            </defs>
          </svg>
        </span>
        <span v-if="!collapsed" class="brand-text">Agentic <span class="brand-v">v2</span></span>
      </router-link>

      <div v-if="!collapsed" class="ws-switcher-wrap">
        <WorkspaceSwitcher />
      </div>
    </div>

    <!-- New Chat -->
    <button class="new-chat" :class="{ collapsed }" :title="collapsed ? 'New Chat (Ctrl/Cmd+K)' : ''" aria-label="New chat" @click="newChat">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M12 5v14m-7-7h14" stroke-linecap="round" />
      </svg>
      <span v-if="!collapsed">New Chat</span>
    </button>

    <!-- Scrollable nav + history -->
    <div class="sidebar-scroll">
      <nav class="nav-group" aria-label="Primary">
        <SidebarNavItem
          v-for="item in primaryNav"
          :key="item.to"
          v-bind="item"
          :collapsed="collapsed"
        />
      </nav>

      <!-- Recent chats (real conversations for the selected agent) -->
      <div v-if="!collapsed && chat.sessions.length" class="history">
        <div
          v-for="grp in groupedSessions"
          :key="grp.label"
          class="history-group"
        >
          <div class="history-label">{{ grp.label }}</div>
          <router-link
            v-for="s in grp.items"
            :key="s.id"
            :to="`/dashboard/chat/${s.id}`"
            class="history-item"
            :class="{ active: String(route.params.sessionId) === String(s.id) }"
            @click="layout.closeMobileNav()"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span class="history-title">{{ s.title || 'Untitled chat' }}</span>
          </router-link>
        </div>
      </div>
    </div>

    <!-- Footer: user + collapse toggle -->
    <div class="sidebar-footer">
      <div class="user" :class="{ collapsed }">
        <div class="avatar">{{ initials }}</div>
        <div v-if="!collapsed" class="user-info">
          <span class="user-name">{{ currentUser?.username || 'Account' }}</span>
          <span class="user-plan">{{ currentUser?.github_username ? 'Pro Plan' : 'Free Plan' }}</span>
        </div>
        <button v-if="!collapsed" class="logout-btn" title="Sign out" aria-label="Sign out" @click="logout">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>

      <button v-if="showCollapseToggle" class="collapse-toggle" :title="collapsed ? 'Expand (Ctrl/Cmd+B)' : 'Collapse (Ctrl/Cmd+B)'" :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'" @click="layout.toggleSidebar()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" :style="{ transform: collapsed ? 'rotate(180deg)' : '' }">
          <path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span v-if="!collapsed">Collapse</span>
      </button>
    </div>
  </aside>
</template>

<script setup>
import { computed, inject, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLayoutStore } from '../../stores/useLayoutStore'
import { useChatStore } from '../../stores/useChatStore'
import SidebarNavItem from './SidebarNavItem.vue'
import WorkspaceSwitcher from '../layout/WorkspaceSwitcher.vue'

const props = defineProps({
  // When true (inside the mobile drawer) the sidebar is always expanded and
  // hides the desktop collapse toggle.
  forceExpanded: { type: Boolean, default: false },
})

const layout = useLayoutStore()
const chat = useChatStore()
const route = useRoute()
const router = useRouter()

const currentUser = inject('currentUser', ref(null))
const logout = inject('logout', () => {})

const collapsed = computed(() => !props.forceExpanded && layout.sidebarCollapsed)
const showCollapseToggle = computed(() => !props.forceExpanded)

const initials = computed(() => {
  const name = currentUser.value?.username
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
})

// Nav items — each `to` points at a working route (existing top-level routes
// stay alive through Phase 5; dashboard children render inside this shell).
const primaryNav = [
  { to: '/dashboard/systems', label: 'Systems', icon: ['M3 3h7v9H3z', 'M14 3h7v5h-7z', 'M14 12h7v9h-7z', 'M3 16h7v5H3z'] },
  { to: '/dashboard/agents', match: '/dashboard/agents', label: 'Agents', icon: ['M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93', 'M12 18a8 8 0 0 1-8-8', 'M20 10a8 8 0 0 1-8 8', 'M12 11.5a1.5 1.5 0 1 0 0 .01'] },
  { to: '/dashboard/tools', label: 'Tools', icon: ['M14.7 6.3a4 4 0 0 0 5 5l-9 9a2.1 2.1 0 0 1-3-3l9-9a4 4 0 0 0-2-2z'] },
  { to: '/dashboard/services', label: 'Services', icon: ['M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 14H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9'] },
  { to: '/dashboard/mcp', label: 'MCP', icon: ['M18.36 6.64a9 9 0 1 1-12.73 0', 'M12 2v10'] },
  { to: '/dashboard/benchmarks', label: 'Benchmarks', icon: ['M18 20V10', 'M12 20V4', 'M6 20v-6'] },
  { to: '/dashboard/workspaces', label: 'Workspaces', icon: ['M2 7l10-5 10 5-10 5z', 'M2 17l10 5 10-5', 'M2 12l10 5 10-5'] },
  { to: '/dashboard/activity', label: 'Activity', icon: ['M22 12h-4l-3 9L9 3l-3 9H2'] },
  { to: '/dashboard/settings/general', match: '/dashboard/settings', label: 'Settings', icon: ['M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M19.4 15a1.65 1.65 0 0 0 .33 1.82M4.6 9a1.65 1.65 0 0 0-.33-1.82'] },
]

const groupedSessions = computed(() => {
  const buckets = { Today: [], Yesterday: [], Earlier: [] }
  const now = Date.now()
  for (const s of chat.sessions) {
    const d = s.updated_at || s.created_at
    const diff = d ? Math.floor((now - new Date(d).getTime()) / 86400000) : 999
    const key = diff <= 0 ? 'Today' : diff === 1 ? 'Yesterday' : 'Earlier'
    buckets[key].push(s)
  }
  return Object.entries(buckets)
    .filter(([, items]) => items.length)
    .map(([label, items]) => ({ label, items }))
})

onMounted(() => chat.loadAgents())

const newChat = () => {
  layout.closeMobileNav()
  chat.reset()
  if (route.path !== '/dashboard/chat/new') router.push('/dashboard/chat/new')
}
</script>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  width: 264px;
  height: 100%;
  background: #ffffff;
  border-right: 1px solid #e7eaf0;
  transition: width 0.2s ease;
}
.sidebar.collapsed {
  width: 72px;
}

/* Top */
.sidebar-top {
  padding: 16px 14px 10px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
}
.brand-mark {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
}
.brand-mark svg { width: 100%; height: 100%; }
.brand-text {
  font-size: 1.0625rem;
  font-weight: 700;
  color: #0f172a;
}
.brand-v {
  font-size: 0.7rem;
  font-weight: 600;
  color: #8b5cf6;
  vertical-align: super;
}
.ws-switcher-wrap {
  margin-top: 12px;
}

/* New Chat */
.new-chat {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 4px 14px 10px;
  padding: 10px 14px;
  font-size: 0.875rem;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}
.new-chat:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
}
.new-chat svg { width: 18px; height: 18px; }
.new-chat.collapsed { margin: 4px 12px 10px; padding: 10px 0; }

/* Scroll area */
.sidebar-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 12px 12px;
}
.nav-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* History */
.history { margin-top: 16px; }
.history-group { margin-bottom: 10px; }
.history-label {
  padding: 6px 12px 4px;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #94a3b8;
}
.history-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 9px;
  color: #475569;
  text-decoration: none;
  font-size: 0.8125rem;
  transition: background 0.15s, color 0.15s;
}
.history-item:hover { background: #f1f5f9; color: #0f172a; }
.history-item.active { background: #eef2ff; color: #4f46e5; }
.history-item svg { width: 15px; height: 15px; flex-shrink: 0; opacity: 0.7; }
.history-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Footer */
.sidebar-footer {
  border-top: 1px solid #eef1f5;
  padding: 10px 12px;
}
.user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px;
  border-radius: 10px;
}
.user.collapsed { justify-content: center; }
.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border-radius: 50%;
}
.user-info { display: flex; flex-direction: column; line-height: 1.2; flex: 1; min-width: 0; }
.user-name { font-size: 0.8125rem; font-weight: 600; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.user-plan { font-size: 0.6875rem; color: #94a3b8; }
.logout-btn {
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; flex-shrink: 0;
  background: transparent; border: none; border-radius: 8px;
  color: #94a3b8; cursor: pointer; transition: all 0.15s;
}
.logout-btn:hover { background: #fef2f2; color: #ef4444; }
.logout-btn svg { width: 16px; height: 16px; }

.collapse-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin-top: 6px;
  padding: 8px 12px;
  font-size: 0.8125rem;
  color: #64748b;
  background: transparent;
  border: none;
  border-radius: 9px;
  cursor: pointer;
  transition: background 0.15s;
}
.collapse-toggle:hover { background: #f1f5f9; }
.collapse-toggle svg { width: 16px; height: 16px; transition: transform 0.2s; }
.sidebar.collapsed .collapse-toggle { justify-content: center; }
</style>
