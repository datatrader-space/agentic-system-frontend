<template>
  <!-- Video Studio's own dashboard inside the AADML app (owner, 2026-10-19): its own side navigation, like the
       admin dashboard. Below 1024px the navigation is a drawer: the menu button opens it; picking a page, tapping
       outside or Escape closes it. -->
  <div class="vs-shell" @keydown.esc="closeMenu(true)">
    <div v-if="menuOpen" class="vs-backdrop" aria-hidden="true" @click="closeMenu(true)"></div>
    <aside ref="sidebar" :inert="mobile && !menuOpen ? '' : undefined" :aria-hidden="mobile && !menuOpen ? 'true' : undefined" @keydown.tab="trapMenu" id="vs-sidebar" class="vs-sidebar" :class="{ open: menuOpen }" aria-label="Video Studio" data-test="video-studio-nav">
      <router-link to="/video-studio" class="vs-brand">
        <!-- The AADML mark: Video Studio is part of AADML (owner, 2026-10-20). -->
        <span class="vs-mark"><BrandMark /></span>
        <span>Video Studio</span>
      </router-link>
      <button type="button" class="vs-nav-close" aria-label="Close Video Studio menu" @click="closeMenu(true)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
      <div class="vs-nav-scroll">
      <nav class="vs-nav" aria-label="Video Studio pages">
        <div v-for="(group,index) in groups" :key="group.label" class="vs-group">
          <button v-if="group.label !== 'Home'" type="button" class="vs-group-toggle" :aria-expanded="!!groupOpen[group.label]" :aria-controls="`vs-group-${index}`" @click="toggleGroup(group.label)"><span>{{ group.label }}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" :class="{ open: groupOpen[group.label] }" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg></button>
          <div :id="`vs-group-${index}`" v-show="group.label === 'Home' || groupOpen[group.label]">
            <router-link v-for="item in group.items" :key="item.id" :to="featureLink(item)" class="vs-nav-item" :class="{ active: isActive(item) }" :aria-current="isActive(item) ? 'page' : undefined" :data-test="'vs-nav-' + item.id">
              <svg viewBox="0 0 24 24" class="vs-nav-ico" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="studioIcons[item.icon]" /></svg><span class="vs-nav-label">{{ item.label }}</span><span v-if="item.status !== 'live'" class="vs-status" :class="item.status">{{ item.status === 'soon' ? 'Soon' : 'Beta' }}</span>
            </router-link>
          </div>
        </div>
      </nav>
      </div>
      <div class="vs-fixed-workspace" aria-label="Your workspace">
        <router-link v-for="item in workspace" :key="item.id" :to="featureLink(item)" class="vs-nav-item" :class="{ active: isActive(item) }" :aria-current="isActive(item) ? 'page' : undefined" :data-test="'vs-nav-' + item.id"><svg viewBox="0 0 24 24" class="vs-nav-ico" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path :d="studioIcons[item.icon]" /></svg><span class="vs-nav-label">{{ item.label }}</span></router-link>
        <StudioRecentChats />
      </div>
      <div class="vs-foot">
        <router-link :to="backTo" class="vs-back" data-test="vs-back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
               aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          <span>Back to AADML</span>
        </router-link>
        <p v-if="email" class="vs-user" :title="email">{{ email }}</p>
      </div>
    </aside>

    <main class="vs-main" :inert="mobile && menuOpen ? '' : undefined">
      <div class="vs-topbar">
        <button ref="menuTrigger" type="button" class="vs-menu-btn" aria-controls="vs-sidebar" :aria-expanded="String(menuOpen)" aria-label="Open Video Studio menu"
                @click="menuOpen = !menuOpen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
      </div>
      <router-view v-slot="{ Component }"><component :is="Component" :key="route.path" /></router-view>
    </main>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../../services/api'
import { STUDIO_GROUPS, studioFeatures, studioIcons, featureLink, orderedFeatures, loadStudioFeatures } from '../../services/studioFeatures'
import BrandMark from '../common/BrandMark.vue'
import StudioRecentChats from './StudioRecentChats.vue'
import { useChatStore } from '../../stores/useChatStore'

const route = useRoute()
const chat = useChatStore()
const user = ref(null)
const menuOpen = ref(false), sidebar = ref(null), menuTrigger = ref(null)
provide('studioUser', user)
const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(max-width: 1023px)') : null
const mobile = ref(media?.matches ?? false)
function mediaChanged(event) { mobile.value = event.matches; if (!event.matches) closeMenu() }
const STORAGE = 'aadml.studio.navigation.groups'
function readGroups() {
  let saved = {}
  try { saved = JSON.parse(localStorage.getItem(STORAGE) || '{}') || {} } catch { /* works without storage */ }
  return Object.fromEntries(STUDIO_GROUPS.map(group => [group, typeof saved[group] === 'boolean' ? saved[group] : ['Home','Create','Workspace'].includes(group)]))
}
const groupOpen = ref(readGroups())
const fixed = ['library','projects','help']
const workspace = computed(() => fixed.map(id => studioFeatures.value.find(f => f.id === id)))
const groups = computed(() => STUDIO_GROUPS.map(label => ({ label, items: orderedFeatures().filter(feature => feature.group === label && !fixed.includes(feature.id)) })).filter(group => group.items.length))
function toggleGroup(group) { groupOpen.value[group] = !groupOpen.value[group] }
watch(groupOpen, value => { try { localStorage.setItem(STORAGE, JSON.stringify(value)) } catch { /* nonessential preference */ } }, { deep: true })
function isActive(item) {
  if (item.id === 'home') return route.path === '/video-studio' || route.path === '/video-studio/'
  return route.path === item.route || route.path.startsWith(item.route + '/') && item.id !== 'characters'
}
watch(() => route.fullPath, () => {
  menuOpen.value = false
  const current = studioFeatures.value.find(isActive)
  if (current) groupOpen.value[current.group] = true
}, { immediate: true })
function closeMenu(restore = false) { menuOpen.value = false; if (restore && mobile.value) nextTick(() => menuTrigger.value?.focus()) }
function trapMenu(event) {
  if (!mobile.value || !menuOpen.value) return
  const items = [...sidebar.value.querySelectorAll('a[href],button:not(:disabled)')].filter(item => item.getClientRects().length)
  const index = items.indexOf(document.activeElement)
  if (event.shiftKey && index <= 0) { event.preventDefault(); items.at(-1)?.focus() }
  else if (!event.shiftKey && index === items.length - 1) { event.preventDefault(); items[0]?.focus() }
}
let previousOverflow, overflowLocked = false, alive = true
watch([menuOpen, mobile], async ([open, narrow]) => {
  if (open && narrow) {
    if (!overflowLocked) { previousOverflow = document.body.style.overflow; overflowLocked = true }
    document.body.style.overflow = 'hidden'
    await nextTick(); sidebar.value?.querySelector('a')?.focus()
  } else if (overflowLocked) { document.body.style.overflow = previousOverflow; overflowLocked = false }
})
const email = computed(() => (user.value && (user.value.email || user.value.username)) || '')
// Back to the chat this video belongs to, else a new chat.
const backTo = computed(() => (chat.conversationId ? `/dashboard/chat/${chat.conversationId}` : '/dashboard/chat/new'))

onMounted(async () => {
  // The grading-suite palette goes on <body> so what the Studio opens over itself (bottom sheets, the Library
  // drawer, approval dialogs, notifications) takes it too.
  document.body.classList.add('vs-theme')
  media?.addEventListener?.('change', mediaChanged)
  // The navigation shows each page's status as the server reports it for this person.
  loadStudioFeatures().catch(() => { /* the plan's status stays shown */ })
  try { const response = await api.checkAuth(); if (alive) user.value = response.data?.user || null } catch { /* the page still works */ }
})
onBeforeUnmount(() => { alive = false; document.body.classList.remove('vs-theme'); media?.removeEventListener?.('change', mediaChanged); if (overflowLocked) document.body.style.overflow = previousOverflow })
</script>

<style>
/* Video Studio palette: a colour-grading suite. Footage is judged against a neutral grey surround with no hue, so
   the chrome is neutral greys; AADML blue is the one accent (the main action, the current page, focus). Same token
   names as style.css, so every component built on them re-skins. --vs-* are the few the Studio adds. */
body.vs-theme {
  color-scheme: dark;
  --vm-bg: #1E1F22;
  --vm-surface: #25262A;
  --vm-surface-soft: #2E2F34;
  --vm-surface-2: #2E2F34;
  --vm-border: #3A3B41;
  --vm-line: #3A3B41;
  --vm-line-2: #34353A;
  --vm-ink: #EDEDEF;
  --vm-ink-soft: #B3B4BA;
  --vm-ink-faint: #8E8F96;
  --vm-violet: #3B82F6;
  --vm-violet-d: #2563EB;
  --vm-violet-soft: rgba(59, 130, 246, .16);
  --vm-primary: #3B82F6;
  --vm-primary-d: #2563EB;
  --vm-primary-soft: rgba(59, 130, 246, .16);
  --vm-glass: rgba(37, 38, 42, .86);
  --vm-glass-strong: rgba(37, 38, 42, .96);
  --vm-shadow-s: 0 1px 2px rgba(0, 0, 0, .4);
  --vm-shadow-m: 0 10px 30px rgba(0, 0, 0, .45);
  --vm-shadow-l: 0 24px 60px rgba(0, 0, 0, .55);
  --vs-accent-ink: #8DB4FF;
  --vs-ok-bg: rgba(60, 203, 127, .14);
  --vs-ok-ink: #7FE0A8;
  --vs-warn-bg: rgba(242, 179, 65, .12);
  --vs-warn-line: rgba(242, 179, 65, .45);
  --vs-warn-ink: #F5C76A;
  --vs-bad-bg: rgba(255, 110, 110, .12);
  --vs-bad-ink: #FF9C9C;
  --vs-scrim: rgba(0, 0, 0, .6);
  background: var(--vm-bg);
}
</style>

<style scoped>
.vs-fixed-workspace{flex:none;padding:10px 0;border-top:1px solid var(--vm-line-2)}.vs-fixed-workspace :deep(.vrc){max-height:165px;margin-top:12px}

.vs-shell { display: flex; height: 100vh; height: 100dvh; overflow: hidden; background: var(--vm-bg); color: var(--vm-ink); font-family: var(--vm-font-sans); }
.vs-sidebar { width: 232px; flex-shrink: 0; display: flex; flex-direction: column; box-sizing: border-box; height: 100%; overflow: hidden;
  padding: 14px 10px 12px; background: var(--vm-bg); border-right: 1px solid var(--vm-line-2); }
.vs-brand { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 10px; margin-bottom: 14px; border-radius: 6px;
  color: var(--vm-ink); font-size: 15px; font-weight: 600; letter-spacing: -.01em; text-decoration: none; }
.vs-mark { display: block; width: 24px; height: 24px; flex-shrink: 0; }
.vs-nav-scroll { flex:1; min-height:0; overflow-y:auto; overscroll-behavior:contain; padding:0 2px 12px; scrollbar-width:thin; }
.vs-group+.vs-group{margin-top:6px}.vs-group-toggle{display:flex;align-items:center;justify-content:space-between;gap:6px;width:100%;min-height:34px;padding:6px 10px;border:0;border-radius:5px;background:transparent;color:var(--vm-ink-soft);font:500 12px var(--vm-font-sans);text-align:left;cursor:pointer}.vs-group-toggle:hover{background:var(--vm-surface)}.vs-group-toggle svg{width:13px;height:13px;transition:transform .15s}.vs-group-toggle svg.open{transform:rotate(90deg)}.vs-nav-label{flex:1;min-width:0}.vs-status{font-size:10px;padding:1px 5px;border-radius:4px;border:1px solid var(--vm-line);color:var(--vm-ink-soft)}.vs-status.beta{color:var(--vs-ok-ink);background:var(--vs-ok-bg)}.vs-nav-close{display:none}.vs-group-toggle:focus-visible,.vs-nav-close:focus-visible{outline:2px solid var(--vs-accent-ink);outline-offset:2px}
.vs-nav { display: flex; flex-direction: column; gap: 2px; }
.vs-nav-item { position: relative; display: flex; align-items: center; gap: 11px; min-height: 40px; padding: 0 10px; border-radius: 6px;
  color: var(--vm-ink-soft); font-size: 13.5px; font-weight: 500; text-decoration: none; transition: background-color .15s, color .15s; }
.vs-nav-item:hover { background: var(--vm-surface); color: var(--vm-ink); }
.vs-nav-item.active { background: var(--vm-surface); color: var(--vm-ink); }
.vs-nav-item.active::before { content: ''; position: absolute; left: -10px; top: 9px; bottom: 9px; width: 2px; border-radius: 0 2px 2px 0; background: var(--vm-violet); }
.vs-nav-item.active .vs-nav-ico { color: var(--vs-accent-ink); }
.vs-nav-ico { width: 18px; height: 18px; flex-shrink: 0; }
.vs-foot { margin-top: auto; padding-top: 10px; border-top: 1px solid var(--vm-line-2); }
.vs-back { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 10px; border-radius: 6px; color: var(--vm-ink-soft);
  font-size: 13px; font-weight: 500; text-decoration: none; }
.vs-back:hover { background: var(--vm-surface); color: var(--vm-ink); }
.vs-back svg { width: 16px; height: 16px; flex-shrink: 0; }
.vs-user { margin: 2px 10px 0; font-size: 12px; color: var(--vm-ink-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vs-brand:focus-visible, .vs-nav-item:focus-visible, .vs-back:focus-visible, .vs-menu-btn:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 2px; }
.vs-main { flex: 1; min-width: 0; height: 100%; overflow-y: auto; overflow-x: hidden; }
.vs-topbar { display: none; }
@media (max-width: 1023px) {
  .vs-brand{padding-right:38px}.vs-nav-close{display:grid;place-items:center;position:absolute;top:14px;right:8px;width:44px;height:44px;border:0;border-radius:6px;background:transparent;color:var(--vm-ink);cursor:pointer}.vs-nav-close svg{width:20px;height:20px}.vs-group-toggle,.vs-nav-item{min-height:44px}
  .vs-sidebar { position: fixed; inset: 0 auto 0 0; z-index: 60; width: min(280px, 86vw); transform: translateX(-100%); transition: transform .2s ease;
    box-shadow: var(--vm-shadow-l); }
  .vs-sidebar.open { transform: translateX(0); }
  .vs-backdrop { position: fixed; inset: 0; z-index: 55; background: var(--vs-scrim); }
  /* One bar on a phone: the menu button sits in the top-left of each page's own bar (pages pad by --vs-bar-inset). */
  .vs-main { position: relative; display: flex; flex-direction: column; --vs-bar-inset: 48px; }
  .vs-topbar { position: absolute; top: 6px; left: 4px; z-index: 41; display: block; }
  .vs-menu-btn { display: grid; place-items: center; width: 44px; height: 44px; border: 0; border-radius: 6px; background: transparent; color: var(--vm-ink); cursor: pointer; }
  .vs-menu-btn svg { width: 20px; height: 20px; }
}
@media (prefers-reduced-motion: reduce) { .vs-sidebar, .vs-nav-item { transition: none; } }
</style>
