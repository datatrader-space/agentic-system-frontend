<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, useId, watch } from 'vue'
import { Settings, Gauge, Globe, CircleHelp, ListChecks, Blocks, Info, LogOut, ChevronRight, ChevronUp, Check, ArrowLeft } from 'lucide-vue-next'

const props = defineProps({
  email: { type: String, default: '' },
  name: { type: String, default: 'Account' },
  initials: { type: String, default: '?' },
  plan: { type: String, default: 'Free Plan' },
  collapsed: Boolean,
})
const emit = defineEmits(['logout', 'navigate'])
const menuId = useId()
const trigger = ref(null)
const popup = ref(null)
const opened = ref(false)
const page = ref('main')
const position = ref({})
const account = computed(() => props.email || props.name || 'Account')
// Static frontend menu. Destinations reuse existing dashboard pages; no new API calls.
const groups = [
  [{ label: 'Settings', icon: Settings, to: '/dashboard/settings/general' },
    { label: 'Usage', icon: Gauge, to: '/dashboard/settings/usage' },
    { label: 'Language', icon: Globe, page: 'language' },
    { label: 'Get help', icon: CircleHelp, to: '/dashboard/help-center' }],
  [{ label: 'View all plans', icon: ListChecks, to: '/dashboard/billing' },
    { label: 'Get apps and extensions', icon: Blocks, to: '/dashboard/integrations' },
    { label: 'Learn more', icon: Info, page: 'learn' }],
]
function close(restore = false) {
  opened.value = false
  page.value = 'main'
  if (restore) trigger.value?.focus()
}
async function open(edge = 'first') {
  if (opened.value) { close(); return }
  const bounds = trigger.value.getBoundingClientRect()
  const width = Math.min(280, window.innerWidth - 24)
  position.value = {
    left: `${Math.max(12, Math.min(bounds.left, window.innerWidth - width - 12))}px`,
    bottom: `${window.innerHeight - bounds.top + 8}px`,
    width: `${width}px`,
    maxHeight: `${Math.max(100, bounds.top - 20)}px`,
  }
  page.value = 'main'
  opened.value = true
  await nextTick()
  const items = popup.value?.querySelectorAll('[role="menuitem"]:not(:disabled)')
  if (edge === 'last') items?.[items.length - 1]?.focus()
  else items?.[0]?.focus()
}
function navigate(to) { close(true); emit('navigate', to) }
function logout() { close(); emit('logout') }
async function showPage(value) {
  page.value = value
  await nextTick()
  popup.value?.querySelector('[role="menuitem"]')?.focus()
}
function keydown(event) {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return }
  const items = Array.from(popup.value?.querySelectorAll('[role="menuitem"]:not(:disabled)') || [])
  const index = items.indexOf(document.activeElement)
  let next
  if (event.key === 'ArrowDown') next = (index + 1) % items.length
  if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length
  if (event.key === 'Home') next = 0
  if (event.key === 'End') next = items.length - 1
  if (next !== undefined) { event.preventDefault(); items[next]?.focus() }
}
function outside(event) {
  if (!trigger.value?.contains(event.target) && !popup.value?.contains(event.target)) close()
}
function dismiss() { close() }
onMounted(() => {
  document.addEventListener('pointerdown', outside)
  document.addEventListener('focusin', outside)
  window.addEventListener('resize', dismiss)
})
onUnmounted(() => {
  document.removeEventListener('pointerdown', outside)
  document.removeEventListener('focusin', outside)
  window.removeEventListener('resize', dismiss)
})
watch(() => props.collapsed, dismiss)
</script>

<template>
  <button ref="trigger" class="profile-trigger" :class="{ 'is-collapsed': collapsed, 'is-open': opened }"
    :title="account" :aria-label="`Account menu for ${account}`" aria-haspopup="menu" :aria-expanded="opened" :aria-controls="opened ? menuId : undefined"
    @click="open()" @keydown.down.prevent="open()" @keydown.up.prevent="open('last')" @keydown.esc="close(true)">
    <span class="profile-avatar">{{ initials }}</span>
    <span v-if="!collapsed" class="profile-identity"><strong>{{ account }}</strong><span>{{ plan }}</span></span>
    <ChevronUp v-if="!collapsed" class="profile-chevron" :class="{ rotated: opened }" :size="15" aria-hidden="true" />
  </button>
  <Teleport to="body">
    <div v-if="opened" :id="menuId" ref="popup" class="profile-popup" :style="position" role="menu" aria-label="Account" @keydown="keydown">
      <template v-if="page === 'main'">
        <div class="profile-menu-account" :title="account">{{ account }}</div>
        <div v-for="(group, index) in groups" :key="index" class="profile-menu-group" role="group">
          <button v-for="entry in group" :key="entry.label" type="button" role="menuitem" class="profile-menu-item" :aria-haspopup="entry.page ? 'menu' : undefined" @click="entry.page ? showPage(entry.page) : navigate(entry.to)">
            <component :is="entry.icon" :size="17" :stroke-width="1.7" aria-hidden="true" /><span>{{ entry.label }}</span><ChevronRight v-if="entry.page" class="menu-trailing" :size="14" aria-hidden="true" />
          </button>
        </div>
        <div class="profile-menu-group"><button type="button" role="menuitem" class="profile-menu-item logout-item" @click="logout"><LogOut :size="17" :stroke-width="1.7" aria-hidden="true" /><span>Log out</span></button></div>
      </template>
      <template v-else>
        <button type="button" role="menuitem" class="profile-menu-item submenu-back" @click="showPage('main')"><ArrowLeft :size="16" aria-hidden="true" /><span>{{ page === 'language' ? 'Language' : 'Learn more' }}</span></button>
        <div class="profile-menu-group" v-if="page === 'language'">
          <button type="button" role="menuitem" class="profile-menu-item" @click="close(true)"><Globe :size="17" aria-hidden="true" /><span>English</span><Check class="menu-trailing" :size="16" aria-hidden="true" /></button>
          <p class="profile-menu-note">More languages coming soon.</p>
        </div>
        <div v-else class="profile-menu-group">
          <button type="button" role="menuitem" class="profile-menu-item" @click="navigate('/dashboard/help-center/get-started')">Getting started with AADML</button>
          <button type="button" role="menuitem" class="profile-menu-item" @click="navigate('/dashboard/help-center/documentation')">Documentation</button>
        </div>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.profile-trigger{display:flex;align-items:center;gap:10px;width:100%;min-width:0;padding:9px 6px;border:1px solid transparent;border-radius:10px;background:transparent;color:#334155;text-align:left;font:inherit;cursor:pointer;transition:background .15s}
.profile-trigger:hover,.profile-trigger.is-open{background:#f0f3f8}.profile-trigger:focus-visible{outline:2px solid #2563eb;outline-offset:2px}
.profile-avatar{display:grid;place-items:center;flex-shrink:0;width:34px;height:34px;border-radius:50%;background:#2563eb;color:#fff;font-size:12px;font-weight:600}
.profile-identity{display:flex;flex:1;min-width:0;flex-direction:column;gap:3px;line-height:1.2}.profile-identity strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:600;color:#1e293b}.profile-identity>span{font-size:11px;color:#718096}
.profile-chevron{flex-shrink:0;color:#94a3b8;transition:transform .15s}.profile-chevron.rotated{transform:rotate(180deg)}.is-collapsed{justify-content:center;padding:7px 0}
.profile-popup{position:fixed;z-index:1000;box-sizing:border-box;overflow-y:auto;padding:6px;border:1px solid #dedfe3;border-radius:14px;background:#fff;box-shadow:0 12px 32px #0f172a1a,0 2px 6px #0f172a0d;color:#26282c;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;text-align:left;animation:profile-appear .12s ease-out}
.profile-menu-account{padding:7px 9px 8px;overflow-wrap:anywhere;font-size:12px;color:#808187;line-height:1.4}
.profile-menu-group{padding:3px 0}.profile-menu-group+.profile-menu-group{border-top:1px solid #e7e7e9;margin-top:4px;padding-top:7px}
.profile-menu-item{display:flex;align-items:center;gap:11px;width:100%;min-height:34px;box-sizing:border-box;padding:8px 9px;border:0;border-radius:7px;background:transparent;color:inherit;font:400 13px/1.35 Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;text-align:left;cursor:pointer}
.profile-menu-item:hover,.profile-menu-item:focus-visible{background:#f2f2f3;outline:none}.profile-menu-item svg{flex-shrink:0}.menu-trailing{margin-left:auto;color:#96979c}.logout-item:hover,.logout-item:focus-visible{color:#b42335;background:#fff1f3}.submenu-back{font-weight:600}.profile-menu-note{padding:8px 10px;margin:0;font-size:11px;line-height:1.5;color:#85868b}
@keyframes profile-appear{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
@media(prefers-reduced-motion:reduce){.profile-popup{animation:none}.profile-trigger,.profile-chevron{transition:none}}
</style>
