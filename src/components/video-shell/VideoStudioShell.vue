<template>
  <!-- Video Studio's own dashboard inside the AADML app (owner, 2026-10-19): its own side navigation, like the
       admin dashboard. Below 1024px the navigation is a drawer: the menu button opens it; picking a page, tapping
       outside or Escape closes it. -->
  <div class="vs-shell" :class="{ 'vs-keyboard-open': keyboardOpen }" :style="{ '--studio-visible-height': viewportHeight }" @keydown.esc="closeMenu(true)">
    <div v-if="menuOpen" class="vs-backdrop" aria-hidden="true" @click="closeMenu(true)"></div>
    <aside ref="sidebar" :inert="mobile && !menuOpen ? '' : undefined" :aria-hidden="mobile && !menuOpen ? 'true' : undefined" @keydown.tab="trapMenu" id="vs-sidebar" class="vs-sidebar" :class="{ open: menuOpen }" aria-label="Video Studio" data-test="video-studio-nav">
      <router-link to="/video-studio" class="vs-brand">
        <!-- The AADML mark: Video Studio is part of AADML (owner, 2026-10-20). -->
        <span class="vs-mark"><BrandMark /></span>
        <span class="vs-brand-name">AADML<small>STUDIO</small></span><small class="vs-design-version" aria-label="Design version 8">08</small>
      </router-link>
      <button type="button" class="vs-nav-close" aria-label="Close Video Studio menu" @click="closeMenu(true)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
      <WorkspaceSwitcher class="vs-workspace-switch"><template #trigger="{ workspace, organization }"><span class="vs-workspace-avatar">{{ (workspace?.name || 'AADML').charAt(0).toUpperCase() }}</span><span class="vs-workspace-copy"><b>{{ workspace?.name || 'AADML Studio' }}</b><small>{{ organization?.name || 'Personal workspace' }}</small></span><StudioNavIcon name="down" /></template></WorkspaceSwitcher>
      <div class="vs-nav-scroll">
        <nav class="vs-nav" aria-label="Video Studio pages">
          <section class="vs-workspace-nav" aria-label="Workspace navigation">
            <h2 class="vs-nav-section">WORKSPACE</h2>
            <router-link v-for="item in workspaceTop" :key="item.id" :to="item.to" class="vs-nav-item" :class="{ active: item.active }" :aria-current="item.active ? 'page' : undefined" :data-test="'vs-nav-' + item.id"><StudioNavIcon :name="item.icon" class="vs-nav-ico" /><span class="vs-nav-label">{{ item.label }}</span></router-link>
            <button type="button" class="vs-nav-item vs-history-link" data-test="studio-history-open" @click="openHistory"><StudioNavIcon name="clock" class="vs-nav-ico" /><span class="vs-nav-label">Chat history</span></button>
            <router-link :to="{ path: '/video-studio', query: { view: 'looks', saved: '1' } }" class="vs-nav-item" :class="{active: !!route.query.saved && route.hash !== '#my-templates'}" :aria-current="route.query.saved && route.hash !== '#my-templates' ? 'page' : undefined" data-test="vs-nav-saved"><StudioNavIcon name="heart" class="vs-nav-ico" /><span class="vs-nav-label">Saved templates</span><small>{{ savedLooks.ids.value.length }}</small></router-link>
            <router-link :to="{ path: '/video-studio', query: { view: 'looks', saved: '1' }, hash: '#my-templates' }" class="vs-nav-item" :class="{active: !!route.query.saved && route.hash === '#my-templates'}" :aria-current="route.query.saved && route.hash === '#my-templates' ? 'page' : undefined" data-test="vs-nav-my-templates"><StudioNavIcon name="layers" class="vs-nav-ico" /><span class="vs-nav-label">My templates</span><small>{{ myTemplates.templates.value.length }}</small></router-link>
            <router-link v-for="item in workspace" :key="item.id" :to="featureLink(item)" class="vs-nav-item" :class="{active:isActive(item)}" :aria-current="isActive(item) ? 'page' : undefined" :data-test="'vs-nav-' + item.id"><StudioNavIcon :name="workspaceIcons[item.id]" class="vs-nav-ico" /><span class="vs-nav-label">{{ item.label }}</span></router-link>
          </section>
          <section class="vs-creative-nav" aria-label="Creative tools">
            <div class="vs-nav-section vs-tools-heading"><h2>CREATIVE TOOLS</h2><button type="button" aria-label="Find a creative tool" @click="workspaceBar?.openSearch()"><StudioNavIcon name="search" /></button></div>
            <div v-for="(group,index) in groups" :key="group.label" class="vs-group">
              <button type="button" class="vs-group-toggle" :aria-expanded="!!groupOpen[group.label]" :aria-controls="`vs-group-${index}`" @click="toggleGroup(group.label)"><StudioNavIcon :name="group.icon" class="vs-nav-ico" /><span class="vs-nav-label">{{ group.label }}</span><StudioNavIcon name="down" class="vs-group-caret" :class="{open:groupOpen[group.label]}" /></button>
              <div :id="`vs-group-${index}`" v-show="groupOpen[group.label]" class="vs-group-items">
                <router-link v-for="item in group.items" :key="item.id" :to="featureLink(item)" class="vs-nav-item" :class="{active:isActive(item)}" :aria-current="isActive(item) ? 'page' : undefined" :data-test="'vs-nav-' + item.id"><StudioNavIcon :name="item.icon" class="vs-nav-ico" /><span class="vs-nav-label">{{ item.label }}</span><span v-if="item.status !== 'live'" class="vs-status" :class="item.status">{{ item.status === 'soon' ? 'Soon' : 'Beta' }}</span></router-link>
              </div>
            </div>
          </section>
          <StudioRecentChats class="vs-nav-recent" :limit="3" @history="openHistory" />
        </nav>
      </div>
      <div class="vs-foot">
        <button type="button" class="vs-nav-item vs-history-link" @click="designNotes?.showModal()"><StudioNavIcon name="layers" class="vs-nav-ico" /><span>Design notes</span></button>
        <router-link to="/video-studio/help" class="vs-nav-item" :class="{active:route.path === '/video-studio/help'}" data-test="vs-nav-help"><StudioNavIcon name="info" class="vs-nav-ico" /><span>Help &amp; shortcuts</span></router-link>
        <div class="vs-workspace-status"><span></span>Studio workspace<small>v8</small></div>
      </div>
    </aside>

    <main class="vs-main" :inert="mobile && menuOpen ? '' : undefined">
      <div class="vs-topbar">
        <button ref="menuTrigger" type="button" class="vs-menu-btn" aria-controls="vs-sidebar" :aria-expanded="String(menuOpen)" aria-label="Open Video Studio menu"
                @click="menuOpen = !menuOpen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
      </div>
      <StudioWorkspaceBar ref="workspaceBar" :title="pageTitle" :user="user" @history="openHistory" /><div class="vs-route"><router-view v-slot="{ Component }"><component :is="Component" :key="route.path" /></router-view></div>
    </main>
    <dialog ref="designNotes" class="vs-history-dialog" aria-labelledby="vs-design-title"><header><h2 id="vs-design-title">Design notes</h2><button type="button" class="st-button" aria-label="Close design notes" @click="designNotes.close()">×</button></header><p>Start with a creative goal or a ready-made look. Agent helps prepare the brief; Manual keeps the existing tool controls available. Review the actual estimate and approval card before generating media.</p><p>Template previews illustrate a direction. Your references, compatible models and approved settings determine the result.</p><a href="https://aadml-video-studio-concept-1030.sajid623942.chatgpt.site/#dashboard" target="_blank" rel="noopener">Approved design reference ↗</a><router-link :to="backTo" class="vs-back" data-test="vs-back">Back to AADML</router-link></dialog>
    <dialog ref="historyDialog" class="vs-history-dialog" aria-labelledby="vs-history-title" @cancel.prevent="closeHistory()"><header><h2 id="vs-history-title">Chat history</h2><button type="button" class="st-button" aria-label="Close chat history" @click="closeHistory()">×</button></header><div v-if="historyOpen" @click="historyClick"><StudioRecentChats history /></div></dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../../services/api'
import { STUDIO_GROUPS, studioFeatures, featureLink, orderedFeatures, loadStudioFeatures } from '../../services/studioFeatures'
import BrandMark from '../common/BrandMark.vue'
import WorkspaceSwitcher from '../layout/WorkspaceSwitcher.vue'
import StudioNavIcon from './StudioNavIcon.vue'
import StudioWorkspaceBar from './StudioWorkspaceBar.vue'
import { provideStudioSavedLooks } from '../../composables/useStudioSavedLooks'
import { provideStudioTemplates } from '../../composables/useStudioTemplates'
import { clearStudioDrafts } from '../../services/studioDrafts'
import StudioRecentChats from './StudioRecentChats.vue'
import { useChatStore } from '../../stores/useChatStore'
import { useStudioViewport } from '../../composables/useStudioViewport'

const route = useRoute()
const chat = useChatStore()
const { height: viewportHeight, keyboardOpen } = useStudioViewport()
const user = ref(null)
const savedLooks = provideStudioSavedLooks(user)
const myTemplates = provideStudioTemplates(user)
// Unsent drafts belong to the person who wrote them: when the signed-in person changes or signs out, that person's
// drafts on this browser are removed (sign-out in app.vue also removes them).
watch(() => user.value?.id, (id, previous) => { if (previous && String(id || '') !== String(previous)) clearStudioDrafts(String(previous)) })
const pageTitle = computed(() => route.path.endsWith('/dashboard') ? 'Dashboard' : studioFeatures.value.find(f => f.route === route.path)?.label || 'Discover')
const workspaceBar=ref(null), designNotes=ref(null)
const menuOpen = ref(false), sidebar = ref(null), menuTrigger = ref(null)
const historyDialog = ref(null), historyOpen = ref(false)
let historyTrigger = null
async function openHistory(event) { historyTrigger = event.currentTarget; historyOpen.value = true; await nextTick(); historyDialog.value?.showModal(); historyDialog.value?.querySelector('input')?.focus() }
function closeHistory(restore = true) { historyDialog.value?.close(); historyOpen.value = false; if (restore) nextTick(() => historyTrigger?.focus()) }
function historyClick(event) { if (event.target.closest('a')) closeHistory(false) }
provide('studioUser', user)
const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(max-width: 1023px)') : null
const mobile = ref(media?.matches ?? false)
function mediaChanged(event) { mobile.value = event.matches; if (!event.matches) closeMenu() }
const STORAGE = 'aadml.studio.navigation.v8.groups'
function readGroups() {
  let saved = {}
  try { saved = JSON.parse(localStorage.getItem(STORAGE) || '{}') || {} } catch { /* works without storage */ }
  return Object.fromEntries(STUDIO_GROUPS.map(group => [group, typeof saved[group] === 'boolean' ? saved[group] : false]))
}
const groupOpen = ref(readGroups())
const workspaceIcons = {projects:'folder',library:'library',canvas:'canvas'}
const workspace = computed(() => ['projects','library','canvas'].map(id => studioFeatures.value.find(f => f.id === id)).filter(Boolean))
const workspaceTop = computed(() => [
  {id:'dashboard', label:'Dashboard',to:'/video-studio/dashboard',icon:'layers',active:route.path === '/video-studio/dashboard'},
  {id:'home',label:'Discover',to:'/video-studio',icon:'grid',active:['/video-studio','/video-studio/'].includes(route.path) && !route.query.saved},
])
const groupIcons = {Create:'image','Edit & enhance':'effects',Characters:'person','Video tools':'video','Avatars & shorts':'effects',Story:'grid',Marketing:'effects'}
const groups = computed(() => STUDIO_GROUPS.filter(label => groupIcons[label]).map(label => ({label,icon:groupIcons[label],items:orderedFeatures().filter(feature => feature.group === label)})))
function toggleGroup(group) { groupOpen.value[group] = !groupOpen.value[group] }
watch(groupOpen, value => { try { localStorage.setItem(STORAGE, JSON.stringify(value)) } catch { /* nonessential preference */ } }, { deep: true })
function isActive(item) {
  if (item.id === 'home') return route.path === '/video-studio' || route.path === '/video-studio/'
  return route.path === item.route || route.path.startsWith(item.route + '/') && item.id !== 'characters'
}
watch(() => route.fullPath, () => {
  menuOpen.value = false
  const current = studioFeatures.value.find(isActive)
  if (current && groupIcons[current.group]) groupOpen.value[current.group] = true
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
  --vm-bg: #101216;
  --vm-surface: #20252E;
  --vm-surface-soft: #293449;
  --vm-surface-2: #293449;
  --vm-border: #3C4A60;
  --vm-line: #3C4A60;
  --vm-line-2: #303C50;
  --vm-ink: #E0E8F4;
  --vm-ink-soft: #A7B5CB;
  --vm-ink-faint: #8295B0;
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

<style scoped>
.vs-brand-name{font-size:23px;letter-spacing:.03em;font-weight:650}.vs-brand-name small{display:block;margin-top:5px;font-size:8px;letter-spacing:.25em;color:var(--vm-ink-faint)}.vs-workspace-card{display:flex;align-items:center;gap:10px;margin:8px 0 18px;padding:12px 9px;border:1px solid var(--vm-line);border-radius:9px;background:var(--vm-surface)}.vs-workspace-card>span{display:grid;place-items:center;width:30px;height:30px;border-radius:5px;background:var(--vm-surface-2);font-size:12px}.vs-workspace-card b{display:block;font-size:10px;font-weight:500}.vs-workspace-card small{display:block;font-size:9px;color:var(--vm-ink-faint);margin-top:5px}.vs-route{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column}.vs-main{display:flex;flex-direction:column;--vs-bar-inset:0px}.vs-history-link{width:100%;border:0;background:none;font-family:inherit;text-align:left;cursor:pointer}.vs-history-dialog{width:min(700px,calc(100vw - 24px));max-height:85dvh;border:1px solid var(--vm-line);border-radius:12px;background:var(--vm-surface);color:var(--vm-ink);padding:20px;box-shadow:var(--vm-shadow-l)}.vs-history-dialog::backdrop{background:var(--vs-scrim)}.vs-history-dialog>header{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px}.vs-history-dialog h2{font-size:22px;margin:0}.vs-history-dialog>div{overflow:auto;max-height:65dvh}.vs-history-dialog :deep(.vrc){max-height:none}
@media(max-width:1023px){.vs-main{--vs-bar-inset:0px}.vs-topbar{top:6px}.vs-sidebar{padding-top:22px}}
</style>

<style scoped>
/* Approved v8 sidebar: workspace destinations first, then compact creative groups. */
.vs-sidebar{width:224px;padding:23px 13px 13px;background:#15161a;border-color:#30323b}
.vs-brand{padding:0 10px 23px;margin:0;height:62px;min-height:62px;gap:9px;box-sizing:border-box}
.vs-design-version{margin-left:auto;font-size:9px;border:1px solid #3c4252;border-radius:4px;background:#272b35;color:#9ca9c3;padding:4px 5px}
.vs-brand-name{font-size:22px;letter-spacing:1px;font-weight:700;line-height:1}
.vs-brand-name small{font-size:9px;letter-spacing:3.5px;color:#9ca5b7;margin-top:8px}
.vs-workspace-switch{flex:none;margin-bottom:18px}
.vs-workspace-switch :deep(.ws-trigger){width:100%;min-height:56px;padding:10px 9px;gap:10px;border:1px solid #353944;border-radius:8px;background:#202228;color:#eef0f4;box-shadow:none}
.vs-workspace-avatar{width:28px;height:30px;flex:none;display:grid;place-items:center;border-radius:5px;background:#313b43;color:#c9d7ef;font-size:12px}
.vs-workspace-copy{flex:1;min-width:0;text-align:left;line-height:1.4}
.vs-workspace-copy b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;letter-spacing:-.1px;font-weight:600}
.vs-workspace-copy small{display:block;margin-top:3px;font-size:10px;color:#8e98ac}
.vs-workspace-switch :deep(.ws-trigger)>svg{width:13px;height:13px;color:#8d96a9;flex:none}
.vs-nav-scroll{padding:0 2px 0 0;scrollbar-width:thin;scrollbar-color:#3d4652 transparent}
.vs-nav{gap:0}.vs-nav-section{font-size:10px;font-weight:600;letter-spacing:1.2px;color:#777f91;padding:5px 11px 8px;margin:0;line-height:1.4}
.vs-tools-heading{display:flex;align-items:center;justify-content:space-between;margin-top:15px;padding-bottom:8px}
.vs-tools-heading h2{font:inherit;margin:0}.vs-tools-heading button{padding:0;border:0;background:none;color:#8c95a9;display:grid;place-items:center;min-height:24px;width:24px;cursor:pointer}.vs-tools-heading svg{width:14px;height:14px}
.vs-nav-item{box-sizing:border-box;min-height:39px;padding:9px 11px;margin:2px 0;gap:11px;font-size:12px;line-height:18px;font-weight:400;border:1px solid transparent;color:#a8aebd;border-radius:6px}
.vs-nav-item.active{background:#2b354c;border-color:#414f70;color:#d9e2ff}.vs-nav-item.active::before{display:none}.vs-nav-item.active .vs-nav-ico{color:#b1c7ff}.vs-nav-item:hover{background:#252935;color:#e2e7f2}
.vs-nav-ico{width:17px;height:17px;color:#8f99ae}.vs-nav-item small{font-size:10px;color:#8c99b2}
.vs-group+.vs-group{margin-top:2px}.vs-group-toggle{min-height:40px;padding:11px;gap:11px;font-size:12px;font-weight:400;color:#a9afbd;line-height:18px;border-radius:6px}
.vs-group-toggle>.vs-nav-ico{width:16px;height:16px;color:#8c95a9}.vs-group-toggle>.vs-group-caret{width:12px;height:12px;opacity:.6;transform:none}.vs-group-toggle>.vs-group-caret.open{transform:rotate(180deg)}
.vs-group-items .vs-nav-item{margin-left:21px;width:calc(100% - 24px);min-height:34px;padding:8px 10px;font-size:11px;gap:9px}.vs-group-items .vs-nav-ico{width:14px;height:14px}
.vs-foot{flex:none;margin-top:12px;padding-top:10px;border-color:#343742}.vs-foot .vs-nav-item{font-size:11px;padding:7px 11px;min-height:39px}.vs-workspace-status{display:flex;align-items:center;gap:7px;font-size:10px;color:#858f9f;margin:13px 10px 2px}.vs-workspace-status>span{width:5px;height:5px;border-radius:50%;background:#8594ad}.vs-workspace-status small{margin-left:auto;font-size:9px;color:#9badc2}
.vs-history-dialog>p{font-size:13px;line-height:1.8;margin-bottom:16px;color:var(--vm-ink-soft)}
.vs-nav-recent{flex:none;padding:18px 8px 10px;border-top:1px solid #35465c;margin-top:17px;font-size:11px}
@media(max-width:1023px){.vs-sidebar{width:min(224px,86vw);padding:23px 13px 13px}.vs-nav-item,.vs-group-toggle,.vs-group-items .vs-nav-item{min-height:44px}.vs-nav-close{top:23px}.vs-tools-heading button{width:44px;min-height:44px}}
</style>

<style scoped>@media(max-width:1023px){.vs-design-version{display:none}.vs-brand{padding-right:40px}}</style>

<style scoped>
@media(max-width:1023px){
 .vs-shell{height:var(--studio-visible-height,100dvh)}
 .vs-sidebar{width:min(280px,86vw);padding:16px 12px 10px}
 .vs-brand{height:54px;min-height:54px;padding-bottom:14px}
 .vs-nav-close{top:12px;right:8px}
 .vs-workspace-switch{margin-bottom:12px}
 .vs-foot{padding-top:6px;margin-top:8px}
 .vs-workspace-status{margin-block:8px 0}
 .vs-keyboard-open :deep(.st-page-agent .st-page-head){display:none}
 .vs-keyboard-open :deep(.st-page-agent .st-form>.st-tool-options){display:none}
 .vs-keyboard-open :deep(.st-page-agent){gap:4px;padding-block:4px}
 .vs-keyboard-open :deep(.sap-more summary){min-height:36px;padding-block:8px}
}
</style>
