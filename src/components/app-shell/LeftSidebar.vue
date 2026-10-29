<template>
  <aside class="sidebar" :class="{ collapsed }" aria-label="Sidebar">
    <!-- Brand + workspace -->
    <div class="sidebar-top">
      <router-link to="/dashboard" class="brand" :title="collapsed ? 'Aadml' : ''">
        <span class="brand-mark"><BrandMark :alt="collapsed ? 'Aadml' : ''" /></span>
        <span v-if="!collapsed" class="brand-text">Aadml<span class="brand-v">v2</span></span>
      </router-link>

      <div v-if="!collapsed" class="ws-switcher-wrap">
        <WorkspaceSwitcher />
      </div>
    </div>

    <!-- New Chat -->
    <button class="new-chat" data-tour="new-chat" :class="{ collapsed }" :title="collapsed ? 'New Chat (Ctrl/Cmd+K)' : ''" aria-label="New chat" @click="newChat">
      <Plus :size="18" :stroke-width="1.8" aria-hidden="true" />
      <span v-if="!collapsed">New chat</span>
      <kbd v-if="!collapsed" aria-hidden="true">Ctrl K</kbd>
    </button>

    <!-- Scrollable nav -->
    <div class="sidebar-scroll">
      <!-- Pointing at a link (hover or keyboard focus) starts downloading that page's code. -->
      <nav class="nav-group" aria-label="Primary" @mouseover="onNavIntent" @focusin="onNavIntent">
        <template v-for="(item, i) in visibleNav" :key="item.to">
          <div v-if="sectionLabels[item.to]" class="nav-section" :class="{ 'is-first': i === 0, 'is-collapsed': collapsed }" aria-hidden="true"><span v-if="!collapsed">{{ sectionLabels[item.to] }}</span></div>
          <SidebarNavItem
            v-bind="item"
            :index="i"
            :collapsed="collapsed"
            @toggle="toggleNavGroup(item)"
          />
          <!-- Projects, right after Home (agentic-docs/CHAT_PROJECTS_PLAN.md; owner, 2026-10-16) -->
          <SidebarProjects v-if="item.to === '/dashboard'" :collapsed="collapsed" />
        </template>
      </nav>

      <!-- Recent chats — global across agents: preview line + agent · time,
           capped per group with a per-group "Show more". -->
    </div>

    <!-- Footer: user + collapse toggle -->
    <div class="sidebar-footer">
      <NotificationBell :collapsed="collapsed" />

      <SidebarProfileMenu
        :email="currentUser?.email || ''"
        :name="currentUser?.username || 'Account'"
        :initials="initials"
        :plan="balanceLabel"
        :collapsed="collapsed"
        @navigate="openProfilePage"
        @logout="logout"
        @tour="startTour"
      />

      <button v-if="showCollapseToggle" class="collapse-toggle" :title="collapsed ? 'Expand (Ctrl/Cmd+B)' : 'Collapse (Ctrl/Cmd+B)'" :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'" @click="layout.toggleSidebar()">
        <component :is="collapsed ? PanelLeftOpen : PanelLeftClose" :size="17" :stroke-width="1.7" aria-hidden="true" />
        <span v-if="!collapsed">Collapse sidebar</span>
      </button>
    </div>
  </aside>
</template>

<script setup>
import { computed, inject, onMounted, ref } from 'vue'
import api from '../../services/api'
import { useRoute, useRouter } from 'vue-router'
import { House, Bot, BookOpen, Files, Workflow, Database, Clapperboard, CalendarClock, Activity, ShieldCheck, Plus, PanelLeftClose, PanelLeftOpen } from 'lucide-vue-next'
import BrandMark from '../common/BrandMark.vue'
import { prefetchFromEvent, prefetchRoutesWhenIdle } from '../../utils/prefetchRoute'
import { useLayoutStore } from '../../stores/useLayoutStore'
import { useChatStore } from '../../stores/useChatStore'
import SidebarNavItem from './SidebarNavItem.vue'
import SidebarProjects from './SidebarProjects.vue'
import NotificationBell from './NotificationBell.vue'
import WorkspaceSwitcher from '../layout/WorkspaceSwitcher.vue'
import SidebarProfileMenu from './SidebarProfileMenu.vue'
import { useOnboarding } from '../../composables/useOnboarding'
import { balanceText } from '../../utils/money'

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

// The person's prepaid balance under their name (there are no plans: backend PAYMENTS_TOPUP_PLAN.md). Read once
// when the sidebar mounts; the Billing page shows it live. Empty until it arrives, and when it cannot be read.
const balanceLabel = ref('')
onMounted(async () => {
  try {
    const { data } = await api.billingWallet()
    balanceLabel.value = data?.wallet?.exempt ? 'Platform staff' : `Balance ${balanceText(data?.wallet?.balance_exact_usd)}`
  } catch (e) { balanceLabel.value = '' }
})
const logout = inject('logout', () => {})
const openSettings = inject('openSettings', null)

const collapsed = computed(() => !props.forceExpanded && layout.sidebarCollapsed)
const showCollapseToggle = computed(() => !props.forceExpanded)

const initials = computed(() => {
  const name = currentUser.value?.username
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
})

// Nav items — each `to` points at a working route (existing top-level routes
// stay alive through Phase 5; dashboard children render inside this shell).
const sectionLabels = { '/dashboard': 'Workspace', '/dashboard/workflow-builder': 'Create', '/dashboard/schedules': 'Manage' }
const primaryNav = [
  { to: '/dashboard', exact: true, label: 'Home', 'data-tour': 'home', iconComponent: House },
  // Hidden for now (route/page still works directly): Let's Code. To show it again, also import CodeXml from lucide-vue-next.
  // { to: '/dashboard/lets-code', match: '/dashboard/lets-code', label: "Let's Code", 'data-tour': 'lets-code', iconComponent: CodeXml },
  { to: '/dashboard/agents', match: '/dashboard/agents', label: 'Agents', 'data-tour': 'agents', iconComponent: Bot },
  { to: '/dashboard/knowledge', match: '/dashboard/knowledge', label: 'Knowledge & RAG', 'data-tour': 'knowledge', iconComponent: BookOpen },
  // The AADML Asset Library: the files of the person's chats only (Video Studio and Training Data keep their own).
  { to: '/dashboard/assets', match: '/dashboard/assets', label: 'Asset Library', 'data-tour': 'assets', iconComponent: Files },
  { to: '/dashboard/workflow-builder', match: '/dashboard/workflow-builder', label: 'Workflow Builder', 'data-tour': 'workflow', iconComponent: Workflow },
  // Runs has no nav entry of its own — it is reached from the Workflow Builder page's Runs button.
  // The route stays live (/dashboard/workflow-runs) and the page is still CROSS-workflow; only its
  // entry point moved, so the sidebar does not carry two lines for one feature.
  // Training Data is its own page (training-data/index.html), served at this path by nginx, so it is a plain
  // link. Shown to everyone signed in; the page lists only the projects each person may see.
  { to: '/dashboard/training-data/', external: true, label: 'Training Data', 'data-tour': 'training-data', iconComponent: Database },
  // Video Studio is its own dashboard inside this app, with its own side navigation (owner, 2026-10-19). This is
  // the one way in: the chat composer has no video mode.
  { to: '/video-studio', match: '/video-studio', label: 'Video Studio', 'data-tour': 'video-studio', iconComponent: Clapperboard },
  { to: '/dashboard/schedules', label: 'Schedules', 'data-tour': 'schedules', iconComponent: CalendarClock },
  { to: '/dashboard/activity', label: 'Activity', 'data-tour': 'activity', iconComponent: Activity },
  { to: '/admin-dashboard', match: '/admin-dashboard', label: 'Admin', adminOnly: true, iconComponent: ShieldCheck },
]

// Admin-only nav entries (e.g. LLM Context — ops stats, backed by an IsAdminUser endpoint)
// are hidden from non-staff users. `is_staff` comes from /auth/me (UserSerializer).
const isAdmin = computed(() => !!(currentUser.value && currentUser.value.is_staff))
const visibleNav = computed(() => primaryNav.filter((item) => {
  if (item.adminOnly && !isAdmin.value) return false
  return true
}))

const onNavIntent = (e) => prefetchFromEvent(router, e)
// The same routes, fetched ahead while the browser is idle (the page Training Data opens is not this app's).
onMounted(() => prefetchRoutesWhenIdle(router, visibleNav.value.filter((item) => !item.external).map((item) => item.to)))

const toggleNavGroup = () => {
  return
}

const openProfilePage = (path) => {
  const section = { '/dashboard/connectors': 'connectors', '/dashboard/integrations': 'integrations', '/dashboard/budgets': 'budgets', '/dashboard/organization': 'organization' }[path]
  if (openSettings && (section || path.startsWith('/dashboard/settings/'))) {
    openSettings(section || path.split('/').pop())
    return
  }
  layout.closeMobileNav()
  router.push(path)
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
.sidebar{display:flex;flex-direction:column;flex-shrink:0;width:248px;height:100%;min-height:0;background:#f8fafc;border-right:1px solid #e5e9f0;color:#475569;font-family:var(--font-sans);transition:width .18s ease}
.sidebar.collapsed{width:72px}.sidebar-top{flex-shrink:0;padding:22px 16px 12px}.brand{display:flex;align-items:center;gap:10px;padding:0 5px;text-decoration:none;width:fit-content}.brand-mark{width:32px;height:32px;flex-shrink:0}.brand-text{font-family:var(--font-sans);font-size:20px;line-height:1.3;font-weight:700;letter-spacing:-.65px;color:#182334}.brand-v{font-size:9px;line-height:1;font-weight:600;letter-spacing:0;color:#2563eb;vertical-align:super;margin-left:3px}.ws-switcher-wrap{margin-top:20px}
.new-chat{display:flex;align-items:center;gap:10px;flex-shrink:0;min-height:40px;margin:4px 16px 14px;padding:9px 12px;border:1px solid #205bde;border-radius:9px;background:#2563eb;box-shadow:0 2px 4px #2563eb17;color:#fff;font-family:inherit;font-size:13px;line-height:20px;font-weight:550;text-align:left;cursor:pointer;transition:background .15s,box-shadow .15s}.new-chat:hover{background:#1d4ed8;box-shadow:0 3px 8px #2563eb20}.new-chat:active{background:#1e40af}.new-chat svg{flex-shrink:0}.new-chat kbd{margin-left:auto;padding:1px 5px;border:1px solid #ffffff38;border-radius:4px;color:#ffffffbf;font-family:inherit;font-size:10px;line-height:18px;font-weight:400}.new-chat.collapsed{justify-content:center;margin:4px 14px 14px;padding:10px 0}
.sidebar-scroll{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:0 12px 16px;scrollbar-width:thin;scrollbar-color:transparent transparent}.sidebar-scroll:hover{scrollbar-color:#d9dfe8 transparent}.sidebar-scroll::-webkit-scrollbar{width:4px}.sidebar-scroll::-webkit-scrollbar-thumb{background:transparent;border-radius:4px}.sidebar-scroll:hover::-webkit-scrollbar-thumb{background:#d9dfe8}.nav-group{display:flex;flex-direction:column;gap:3px}.nav-section{display:flex;align-items:center;min-height:24px;margin-top:8px;padding:4px 12px;color:#6f7b8e;font-size:10px;line-height:1.4;font-weight:550;letter-spacing:.075em;text-transform:uppercase}.nav-section.is-first{margin-top:0;min-height:24px}.nav-section.is-collapsed{min-height:0;height:1px;margin:13px 10px 9px;padding:0;background:#e3e8f0}.nav-section.is-collapsed.is-first{display:none}
.sidebar-footer{flex-shrink:0;padding:8px 12px 12px;border-top:1px solid #e5e9f0;background:#f8fafc}.collapse-toggle{display:flex;align-items:center;gap:11px;width:100%;min-height:34px;margin-top:6px;padding:7px 12px;border:0;border-radius:7px;background:none;color:#728096;font-family:inherit;font-size:11px;line-height:20px;font-weight:450;text-align:left;cursor:pointer}.collapse-toggle:hover{background:#edf1f7;color:#334155}.collapse-toggle svg{flex-shrink:0}.sidebar.collapsed .collapse-toggle{justify-content:center;padding-inline:0}.sidebar.collapsed .sidebar-top{padding:22px 18px 18px}.sidebar.collapsed .brand{padding:0}
.new-chat:focus-visible,.collapse-toggle:focus-visible,.brand:focus-visible{outline:2px solid #2563eb;outline-offset:3px}
@media(prefers-reduced-motion:reduce){.sidebar,.new-chat{transition:none}}
</style>
