<template>
  <aside class="sidebar" :class="{ collapsed }" aria-label="Sidebar">
    <!-- Brand + workspace -->
    <div class="sidebar-top">
      <router-link to="/dashboard" class="brand" :title="collapsed ? 'Aadml' : ''">
        <span class="brand-mark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true">
            <path d="M6 12.5l4 4L18 8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
        <span v-if="!collapsed" class="brand-text">Aadml<span class="brand-v">v2</span></span>
      </router-link>

      <div v-if="!collapsed" class="ws-switcher-wrap">
        <WorkspaceSwitcher />
      </div>
    </div>

    <!-- New Chat -->
    <button class="new-chat" data-tour="new-chat" :class="{ collapsed }" :title="collapsed ? 'New Chat (Ctrl/Cmd+K)' : ''" aria-label="New chat" @click="newChat">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M12 5v14m-7-7h14" stroke-linecap="round" />
      </svg>
      <span v-if="!collapsed">New Chat</span>
    </button>

    <!-- Scrollable nav -->
    <div class="sidebar-scroll">
      <nav class="nav-group" aria-label="Primary">
        <SidebarNavItem
          v-for="(item, i) in visibleNav"
          :key="item.to"
          v-bind="item"
          :index="i"
          :collapsed="collapsed"
          @toggle="toggleNavGroup(item)"
        />
      </nav>

      <!-- Recent chats — global across agents: preview line + agent · time,
           capped per group with a per-group "Show more". -->
    </div>

    <!-- Footer: user + collapse toggle -->
    <div class="sidebar-footer">
      <NotificationBell :collapsed="collapsed" />
      <button class="take-tour" :class="{ collapsed }" :title="collapsed ? 'Take a tour' : ''" aria-label="Take a tour" @click="startTour">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" stroke-linecap="round" stroke-linejoin="round" /><line x1="12" y1="17" x2="12.01" y2="17" stroke-linecap="round" /></svg>
        <span v-if="!collapsed">Take a tour</span>
      </button>

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
import { computed, inject, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLayoutStore } from '../../stores/useLayoutStore'
import { useChatStore } from '../../stores/useChatStore'
import SidebarNavItem from './SidebarNavItem.vue'
import NotificationBell from './NotificationBell.vue'
import WorkspaceSwitcher from '../layout/WorkspaceSwitcher.vue'
import { useOnboarding } from '../../composables/useOnboarding'

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
  { to: '/dashboard', exact: true, label: 'Home', 'data-tour': 'home', icon: ['M3 12l9-9 9 9', 'M5 10v10h14V10'] },
  // Hidden for now (routes/pages still work directly): Let's Code + Workflow Builder.
  // { to: '/dashboard/lets-code', match: '/dashboard/lets-code', label: "Let's Code", 'data-tour': 'lets-code', icon: ['M16 18l6-6-6-6', 'M8 6l-6 6 6 6'] },
  { to: '/dashboard/agents', match: '/dashboard/agents', label: 'Agents', 'data-tour': 'agents', icon: ['M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93', 'M12 18a8 8 0 0 1-8-8', 'M20 10a8 8 0 0 1-8 8', 'M12 11.5a1.5 1.5 0 1 0 0 .01'] },
  { to: '/dashboard/connectors', label: 'Connectors', 'data-tour': 'connectors', icon: ['M13.83 10.17a4 4 0 0 0-5.66 0l-4 4a4 4 0 1 0 5.66 5.66l1.1-1.1', 'M10.17 13.83a4 4 0 0 0 5.66 0l4-4a4 4 0 1 0-5.66-5.66l-1.1 1.1'] },
  { to: '/dashboard/knowledge', match: '/dashboard/knowledge', label: 'Knowledge & RAG', 'data-tour': 'knowledge', icon: ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'] },
  // { to: '/dashboard/workflow-builder', match: '/dashboard/workflow-builder', label: 'Workflow Builder', 'data-tour': 'workflow', icon: ['M4 4h6v6H4z', 'M14 14h6v6h-6z', 'M10 7h4a3 3 0 0 1 3 3v4'] },
  { to: '/dashboard/schedules', label: 'Schedules', 'data-tour': 'schedules', icon: ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M12 14v3l2 1'] },
  { to: '/dashboard/activity', label: 'Activity', 'data-tour': 'activity', icon: ['M22 12h-4l-3 9L9 3l-3 9H2'] },
  { to: '/dashboard/budgets', label: 'Budgets', 'data-tour': 'budgets', icon: ['M12 1v22', 'M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6'] },
  { to: '/dashboard/organization', match: '/dashboard/organization', label: 'Organization', 'data-tour': 'organization', icon: ['M3 21h18', 'M5 21V7l7-4 7 4v14', 'M9 21v-6h6v6', 'M9 9h.01', 'M15 9h.01'] },
  { to: '/admin-dashboard', match: '/admin-dashboard', label: 'Admin', adminOnly: true, icon: ['M12 2 4 5v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V5z', 'M9 12l2 2 4-4'] },
  { to: '/dashboard/settings/general', match: '/dashboard/settings', label: 'Settings', 'data-tour': 'settings', icon: ['M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M19.4 15a1.65 1.65 0 0 0 .33 1.82M4.6 9a1.65 1.65 0 0 0-.33-1.82'] },
  { to: '/dashboard/help-center', match: '/dashboard/help-center', label: 'Help Center', 'data-tour': 'help-center', icon: ['M9.09 9a3 3 0 1 1 5.83 1c0 2-3 2.25-3 4', 'M12 17h.01', 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z'] },
]

// Admin-only nav entries (e.g. LLM Context — ops stats, backed by an IsAdminUser endpoint)
// are hidden from non-staff users. `is_staff` comes from /auth/me (UserSerializer).
const isAdmin = computed(() => !!(currentUser.value && currentUser.value.is_staff))
const visibleNav = computed(() => primaryNav.filter((item) => {
  if (item.adminOnly && !isAdmin.value) return false
  return true
}))

const toggleNavGroup = () => {
  return
}

const newChat = () => {
  layout.closeMobileNav()
  chat.reset()
  if (route.path !== '/dashboard/chat/new') router.push('/dashboard/chat/new')
}

// Replay the feature tour on demand (resets the completed flag + relaunches).
const onboarding = useOnboarding()
const startTour = () => {
  layout.closeMobileNav()
  onboarding.resetTour()
}
</script>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  width: 256px;
  height: 100%;
  font-family: var(--vm-font-sans);
  background: var(--vm-glass);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-right: 1px solid var(--vm-line);
  box-shadow: var(--vm-shadow-m);
  transition: width 0.2s var(--vm-ease2);
}
.sidebar.collapsed {
  width: 76px;
}

/* Top */
.sidebar-top {
  padding: 18px 14px 8px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 11px;
  text-decoration: none;
}
.brand-mark {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--vm-g-brand);
  box-shadow: var(--vm-glow-v);
  animation: vmPop .7s var(--vm-ease) both;
}
.brand-mark svg { width: 21px; height: 21px; }
.brand-letter {
  color: #fff;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1;
}
.brand-text {
  font-family: var(--vm-font-display);
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -.02em;
  color: var(--vm-ink);
}
.brand-v {
  font-size: 0.625rem;
  font-weight: 700;
  background: var(--vm-g-brand);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  vertical-align: super;
  margin-left: 1px;
}
.ws-switcher-wrap {
  margin-top: 14px;
}

/* New Chat */
.new-chat {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  margin: 10px 14px 12px;
  padding: 13px 14px;
  font-family: var(--vm-font-sans);
  font-size: 0.875rem;
  font-weight: 700;
  color: #fff;
  background: var(--vm-g-cool);
  border: none;
  border-radius: 15px;
  cursor: pointer;
  box-shadow: var(--vm-glow-v);
  transition: transform 0.2s var(--vm-ease);
}
.new-chat:hover { transform: translateY(-2px) scale(1.02); }
.new-chat:active { transform: scale(0.97); }
.new-chat::after {
  content: "";
  position: absolute;
  top: 0;
  left: -120%;
  width: 60%;
  height: 100%;
  background: linear-gradient(100deg, transparent, rgba(255, 255, 255, .5), transparent);
  transform: skewX(-20deg);
  animation: vmShine 4s ease-in-out infinite;
}
.new-chat svg { width: 17px; height: 17px; }
.new-chat.collapsed { margin: 10px 12px 12px; padding: 13px 0; }

/* Scroll area */
.sidebar-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 12px 12px;
}
.sidebar-scroll::-webkit-scrollbar { width: 0; }
.nav-group {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

/* Footer */
.sidebar-footer {
  border-top: 1px solid var(--vm-line);
  padding: 10px 12px;
}
.take-tour {
  display: flex; align-items: center; gap: 10px; width: 100%;
  margin-bottom: 6px; padding: 9px 12px;
  font: 600 0.8125rem var(--vm-font-sans);
  color: var(--vm-ink-soft); background: transparent; border: none; border-radius: 11px;
  cursor: pointer; transition: background .15s, color .15s;
}
.take-tour:hover { background: var(--vm-violet-soft); color: var(--vm-violet-d); }
.take-tour svg { width: 16px; height: 16px; flex-shrink: 0; }
.take-tour.collapsed { justify-content: center; padding: 9px 0; }
.user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px;
  border-radius: 12px;
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
  font-weight: 700;
  color: #fff;
  background: var(--vm-g-brand);
  border-radius: 50%;
}
.user-info { display: flex; flex-direction: column; line-height: 1.2; flex: 1; min-width: 0; }
.user-name { font-size: 0.8125rem; font-weight: 700; color: var(--vm-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.user-plan { font-size: 0.6875rem; color: var(--vm-ink-faint); }
.logout-btn {
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; flex-shrink: 0;
  background: transparent; border: none; border-radius: 9px;
  color: var(--vm-ink-faint); cursor: pointer; transition: all 0.15s;
}
.logout-btn:hover { background: rgba(239, 68, 68, .1); color: var(--vm-danger); }
.logout-btn svg { width: 16px; height: 16px; }

.collapse-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin-top: 6px;
  padding: 8px 12px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--vm-ink-faint);
  background: transparent;
  border: none;
  border-radius: 11px;
  cursor: pointer;
  transition: background 0.15s;
}
.collapse-toggle:hover { background: var(--vm-glass-strong); color: var(--vm-ink-soft); }
.collapse-toggle svg { width: 16px; height: 16px; transition: transform 0.2s; }
.sidebar.collapsed .collapse-toggle { justify-content: center; }

/* Screen 25 sidebar refresh */
.sidebar {
  width: 228px;
  background: #fbfdff;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  border-right: 1px solid #e3ebf6;
  box-shadow: none;
}
.sidebar.collapsed {
  width: 72px;
}
.sidebar-top {
  padding: 18px 16px 10px;
}
.brand {
  gap: 12px;
}
.brand-mark {
  width: 36px;
  height: 36px;
  border-radius: 11px;
  color: #fff;
  background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%);
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.22);
  animation: none;
}
.brand-mark svg {
  width: 19px;
  height: 19px;
}
.brand-letter {
  display: none;
}
.brand-text {
  font-family: Inter, var(--vm-font-display), var(--vm-font-sans);
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: #111827;
}
.brand-v {
  color: #2563eb;
  background: none;
  -webkit-background-clip: initial;
  background-clip: initial;
}
.ws-switcher-wrap {
  margin-top: 16px;
}
.new-chat {
  margin: 12px 14px;
  height: 44px;
  padding: 0 16px;
  border-radius: 8px;
  background: #2563eb;
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.2);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.new-chat::after {
  display: none;
}
.new-chat:hover {
  transform: translateY(-1px);
  background: #1d4ed8;
  box-shadow: 0 10px 20px rgba(37, 99, 235, 0.24);
}
.new-chat.collapsed {
  margin: 12px 12px;
}
.sidebar-scroll {
  padding: 6px 12px 14px;
}
.nav-group {
  gap: 4px;
}
.sidebar-footer {
  border-top: 1px solid #e8eef7;
  padding: 10px 12px 12px;
  background: #fbfdff;
}
.take-tour,
.collapse-toggle {
  border-radius: 9px;
  color: #64748b;
}
.take-tour:hover,
.collapse-toggle:hover {
  background: #f1f6ff;
  color: #1d4ed8;
}
.user {
  padding: 8px 6px;
  border-radius: 10px;
}
.avatar {
  background: #2563eb;
}
</style>

