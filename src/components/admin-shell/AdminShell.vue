<template>
  <div class="admin-shell" :class="{ 'is-collapsed': collapsed }" :data-admin-theme="theme" @keydown="onKeydown">
    <a class="admin-skip" href="#admin-main">Skip to page content</a>
    <button v-if="menuOpen" class="admin-backdrop" aria-label="Close navigation" tabindex="-1" @click="closeMenu"></button>
    <aside id="admin-sidebar" ref="sidebar" class="admin-sidebar" :class="{ open: menuOpen }" aria-label="Admin navigation" :inert="mobile && !menuOpen ? true : undefined">
      <div class="admin-brand"><span class="admin-logo"><ShieldCheck :size="21" aria-hidden="true" /></span><div class="admin-brand-copy"><strong>AADML <span>Admin</span></strong><small>Platform workspace</small></div><button class="admin-mobile-close admin-icon-button" type="button" aria-label="Close navigation" @click="closeMenu"><X :size="18" /></button></div>
      <button v-if="collapsed && !mobile" class="admin-rail-search" type="button" aria-label="Expand navigation and search" @click="expandSearch"><Search :size="17" /></button>
      <label v-else class="admin-nav-search"><Search :size="15" aria-hidden="true" /><span class="admin-sr-only">Find an admin page</span><input ref="searchInput" v-model="query" type="search" placeholder="Find a page…" /><button v-if="query" class="admin-search-clear" type="button" aria-label="Clear navigation search" @click="query = ''"><X :size="13" /></button></label>
      <nav class="admin-nav" aria-label="Admin pages">
        <section v-for="group in visibleGroups" :key="group.key" class="admin-nav-group">
          <button class="admin-group-heading" type="button" :aria-expanded="!closedGroups.includes(group.key) || !!query" :aria-controls="`admin-group-${group.key}`" @click="toggleGroup(group.key)"><span>{{ group.label }}</span><ChevronDown :size="12" :class="{ closed: closedGroups.includes(group.key) && !query }" aria-hidden="true" /></button>
          <div v-show="!closedGroups.includes(group.key) || query || (collapsed && !mobile)" :id="`admin-group-${group.key}`" class="admin-group-items">
            <RouterLink v-for="item in group.items" :key="item.to" :to="item.to" class="admin-nav-item" :class="{ active: current.key === item.key }" :title="collapsed ? item.label : undefined" :aria-label="item.label" :aria-current="current.key === item.key ? 'page' : undefined">
              <svg viewBox="0 0 24 24" class="admin-nav-ico" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path v-for="(d, i) in item.icon" :key="i" :d="d" /></svg><span class="admin-nav-label">{{ item.label }}</span>
            </RouterLink>
          </div>
        </section>
        <div v-if="!visibleGroups.length" class="admin-nav-empty">No pages match “{{ query }}”.<button type="button" @click="query = ''">Clear search</button></div>
      </nav>
      <div class="admin-sidebar-footer"><a :href="djangoAdminUrl" target="_blank" rel="noopener" class="admin-nav-item" title="Django Admin (raw DB)" aria-label="Django Admin (raw DB)"><ArrowUpRight :size="17" aria-hidden="true" /><span class="admin-nav-label">Database admin</span></a><RouterLink to="/dashboard/chat/new" class="admin-nav-item" title="Back to app" aria-label="Back to app"><ArrowLeft :size="17" aria-hidden="true" /><span class="admin-nav-label">Back to app</span></RouterLink><div class="admin-user"><span class="admin-user-avatar" aria-hidden="true">{{ (user?.email || user?.username || 'A').slice(0,1).toUpperCase() }}</span><div class="admin-user-copy"><strong>{{ user?.email || user?.username || 'Admin workspace' }}</strong><small>Platform administration</small></div></div></div>
    </aside>
    <div class="admin-workspace">
      <header class="admin-topbar">
        <button ref="menuButton" type="button" class="admin-icon-button admin-nav-toggle" :aria-label="mobile ? (menuOpen ? 'Close navigation' : 'Open navigation') : (collapsed ? 'Expand sidebar' : 'Collapse sidebar')" aria-controls="admin-sidebar" :aria-expanded="mobile ? menuOpen : !collapsed" @click="toggleMenu"><Menu v-if="mobile" :size="19" /><PanelLeftOpen v-else-if="collapsed" :size="19" /><PanelLeftClose v-else :size="19" /></button>
        <nav class="admin-location" aria-label="Breadcrumb"><RouterLink to="/admin-dashboard/overview">Admin</RouterLink><span aria-hidden="true">/</span><span class="admin-location-group">{{ currentGroup?.label }}</span><span class="admin-location-group" aria-hidden="true">/</span><strong aria-current="page">{{ current.label }}</strong></nav>
        <div class="admin-topbar-actions"><span class="admin-workspace-badge">Platform control</span><button type="button" class="admin-icon-button" :aria-label="theme === 'light' ? 'Use dark theme' : 'Use light theme'" @click="toggleTheme"><Moon v-if="theme === 'light'" :size="17" /><Sun v-else :size="17" /></button></div>
      </header>
      <main id="admin-main" ref="main" class="admin-main" tabindex="-1">
        <RouterView v-slot="{ Component }"><Suspense><component :is="Component" :key="route.path" /><template #fallback><div class="admin-route-loading" role="status" aria-label="Loading admin page"><div class="admin-loading-heading"></div><div class="admin-loading-grid"><div v-for="n in 4" :key="n"></div></div><div class="admin-loading-content"></div><span class="admin-sr-only">Loading page…</span></div></template></Suspense></RouterView>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { ShieldCheck, Search, X, ChevronDown, Menu, PanelLeftOpen, PanelLeftClose, Moon, Sun, ArrowLeft, ArrowUpRight } from 'lucide-vue-next'
import api from '../../services/api'
import { adminItems, adminGroups, adminDescriptions, adminSection } from './adminNavigation'
import { useAdminDialogs } from './useAdminDialogs'
import './admin-workspace.css'

useAdminDialogs()

const route = useRoute()
const user = ref(null), query = ref(''), menuOpen = ref(false), closedGroups = ref([])
function preference(key, fallback) { try { return localStorage.getItem(key) || fallback } catch { return fallback } }
function persist(key, value) { try { localStorage.setItem(key, value) } catch { /* preferences are optional */ } }
const collapsed = ref(preference('aadml-admin-sidebar', 'expanded') === 'collapsed')
const theme = ref(preference('aadml-admin-theme', 'light') === 'dark' ? 'dark' : 'light')
const mobile = ref(false), sidebar = ref(null), menuButton = ref(null), searchInput = ref(null), main = ref(null)
let media
const current = computed(() => adminSection(route.path || '/admin-dashboard/overview'))
const currentGroup = computed(() => adminGroups.find(g => g.paths.includes(current.value.key)))
const visibleGroups = computed(() => adminGroups.map(group => ({ ...group, items: group.paths.map(key => adminItems.find(i => i.key === key)).filter(item => item && (!query.value.trim() || `${item.label} ${adminDescriptions[item.key]} ${group.label}`.toLowerCase().includes(query.value.trim().toLowerCase()))) })).filter(g => g.items.length))
const djangoAdminUrl = computed(() => { const { protocol, hostname, port } = window.location; return port === '5173' ? `${protocol}//${hostname}:8000/admin/` : '/admin/' })
function toggleTheme() { theme.value = theme.value === 'light' ? 'dark' : 'light'; persist('aadml-admin-theme', theme.value) }
async function toggleMenu() { if (!mobile.value) { collapsed.value = !collapsed.value; persist('aadml-admin-sidebar', collapsed.value ? 'collapsed' : 'expanded'); return } menuOpen.value = !menuOpen.value; if (menuOpen.value) { await nextTick(); sidebar.value?.querySelector('input')?.focus() } else menuButton.value?.focus() }
function closeMenu() { if (!menuOpen.value) return; menuOpen.value = false; menuButton.value?.focus() }
async function expandSearch() { collapsed.value = false; persist('aadml-admin-sidebar', 'expanded'); await nextTick(); searchInput.value?.focus() }
function toggleGroup(key) { closedGroups.value = closedGroups.value.includes(key) ? closedGroups.value.filter(k => k !== key) : [...closedGroups.value, key] }
function onMediaChange(event) { mobile.value = event.matches; if (!event.matches) menuOpen.value = false }
function onKeydown(event) {
  if (event.key === 'Escape' && menuOpen.value) { event.preventDefault(); closeMenu(); return }
  if (mobile.value && menuOpen.value && event.key === 'Tab') {
    const targets = [...sidebar.value.querySelectorAll('a[href], button:not([disabled]), input:not([disabled])')].filter(el => el.getClientRects().length)
    const first = targets[0], last = targets[targets.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
  const group = event.target.closest?.('.admin-tabs')
  if (!group || !event.target.closest('button') || !['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key) || event.defaultPrevented) return
  const buttons = [...group.querySelectorAll('button:not([disabled])')], index = buttons.indexOf(event.target.closest('button'))
  if (index < 0) return
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length
  event.preventDefault(); buttons[next]?.focus(); buttons[next]?.click()
}
watch(() => route.path, async () => { closeMenu(); const group = currentGroup.value?.key; closedGroups.value = closedGroups.value.filter(k => k !== group); await nextTick(); main.value?.scrollTo?.({ top: 0 }) })
onMounted(async () => { media = window.matchMedia?.('(max-width: 899px)'); if (media) { onMediaChange(media); media.addEventListener('change', onMediaChange) } try { const response = await api.getCurrentUser?.(); user.value = response?.data?.user || (await api.checkAuth()).data?.user } catch { /* identity remains protected by the existing route and server guards */ } })
onBeforeUnmount(() => media?.removeEventListener('change', onMediaChange))
</script>
