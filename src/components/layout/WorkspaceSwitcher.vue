<template>
  <div v-if="!tenancyDisabled" class="ws-switcher" ref="triggerRef">
    <button
      ref="buttonRef"
      type="button"
      class="ws-trigger"
      :class="{ 'ws-trigger--open': isOpen }"
      aria-haspopup="dialog"
      :aria-expanded="isOpen"
      :aria-controls="dropdownId"
      :title="activeWorkspaceName || 'Personal mode'"
      @click="toggle"
      @keydown.down.prevent="openFromKeyboard"
    >
      <span class="ws-trigger-icon" :style="{ color: wsColor }"><Building2 v-if="activeWorkspace" :size="17" /><User v-else :size="17" /></span>
      <span class="ws-trigger-copy"><span class="ws-name">{{ activeWorkspaceName || 'Personal mode' }}</span><span class="ws-context">{{ activeOrg?.name || 'Personal account' }}</span></span>
      <ChevronDown class="ws-caret" :size="15" aria-hidden="true" />
    </button>

    <Teleport to="body">
      <transition name="ws-dropdown">
        <div v-if="isOpen" :id="dropdownId" ref="dropdownRef" class="ws-dropdown" :style="dropdownStyle" role="dialog" aria-label="Switch workspace" @keydown="onDropdownKey">
          <div class="ws-dropdown-heading">Switch workspace</div>
          <label class="ws-search"><Search :size="15" aria-hidden="true" /><input ref="searchRef" v-model="query" type="search" placeholder="Find a workspace..." aria-label="Find a workspace" /></label>
          <div class="ws-dropdown-content">
            <div class="ws-personal-mode">
              <button type="button" class="ws-item ws-item--personal" :class="{ 'ws-item--active': !activeWorkspace }" :aria-current="!activeWorkspace ? 'true' : undefined" @click="exitWorkspaceMode">
                <span class="ws-item-icon ws-personal-icon"><User :size="16" aria-hidden="true" /></span>
                <span class="ws-item-copy"><span class="ws-item-name">Personal mode</span><span class="ws-item-description">No workspace selected</span></span>
                <Check v-if="!activeWorkspace" class="ws-check" :size="16" aria-label="Selected" />
              </button>
            </div>
            <div v-if="loading" class="ws-loading" role="status"><div class="ws-spinner" aria-hidden="true"></div><span>Loading workspaces...</span></div>
            <div v-else-if="error" class="ws-empty" role="alert"><p>Could not load your workspaces.</p><button type="button" class="ws-create-link" @click="loadMyOrgs">Try again</button></div>
            <template v-else>
              <div v-for="org in filteredOrgs" :key="org.id" class="ws-org-group">
                <div class="ws-org-label"><Building2 :size="13" class="ws-org-icon" aria-hidden="true" /><span class="ws-org-name" :title="org.name">{{ org.name }}</span><span v-if="org.is_personal" class="ws-personal-badge">Personal</span></div>
                <button v-for="ws in org.workspaces" :key="ws.id" type="button" class="ws-item" :class="{ 'ws-item--active': activeWorkspace?.id === ws.id }" :aria-current="activeWorkspace?.id === ws.id ? 'true' : undefined" :title="ws.name" @click="select(ws, org.original)">
                  <span class="ws-item-icon" :style="{ color: stringToColor(ws.name) }">{{ ws.name?.trim().charAt(0).toUpperCase() || 'W' }}</span>
                  <span class="ws-item-copy"><span class="ws-item-name">{{ ws.name }}</span><span v-if="ws.member_count != null" class="ws-item-description">{{ ws.member_count }} {{ ws.member_count === 1 ? 'member' : 'members' }}</span></span>
                  <Check v-if="activeWorkspace?.id === ws.id" class="ws-check" :size="16" aria-label="Selected" />
                </button>
                <p v-if="!org.workspaces.length" class="ws-group-empty">No workspaces yet</p>
              </div>
              <p v-if="!filteredOrgs.length" class="ws-empty" role="status">{{ query.trim() ? 'No matching workspaces.' : 'Create an organization to get started.' }}</p>
            </template>
          </div>
          <div class="ws-footer">
            <router-link v-if="activeOrg" :to="`/org/${activeOrg.slug}/settings`" class="ws-footer-link" @click="close()"><Settings2 :size="16" aria-hidden="true" /><span>Organization settings</span></router-link>
            <button type="button" class="ws-footer-link" :disabled="!myOrgs.length || loading" @click="openCreateWorkspace"><Plus :size="16" aria-hidden="true" /><span>New workspace</span></button>
            <button type="button" class="ws-footer-link" @click="openCreateOrg"><Building2 :size="16" aria-hidden="true" /><span>New organization</span></button>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- Create Workspace Modal (also teleported) -->
    <Teleport to="body">
      <transition name="ws-modal">
        <div v-if="showCreateModal" class="ws-modal-backdrop" @click.self="showCreateModal = false">
          <div class="ws-modal">
            <h3 class="ws-modal-title">New Workspace</h3>
            <div>
              <div class="ws-form-group">
                <label>Name</label>
                <input v-model="newWsName" placeholder="e.g. Engineering" class="ws-input" required />
              </div>
              <div class="ws-form-group">
                <label>Slug</label>
                <input v-model="newWsSlug" placeholder="engineering" class="ws-input" />
              </div>
              <div class="ws-modal-actions">
                <button type="button" class="ws-btn-cancel" @click="showCreateModal = false">Cancel</button>
                <button type="button" class="ws-btn-create" :disabled="creating" @click="createWorkspace">
                  {{ creating ? 'Creating…' : 'Create' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- Create Organisation Modal -->
    <Teleport to="body">
      <transition name="ws-modal">
        <div v-if="showCreateOrgModal" class="ws-modal-backdrop" @click.self="showCreateOrgModal = false">
          <div class="ws-modal">
            <h3 class="ws-modal-title">Create Organisation</h3>
            <div>
              <div class="ws-form-group">
                <label>Organisation Name</label>
                <input v-model="newOrgName" placeholder="e.g. Acme Corp" class="ws-input" @keydown.enter="createOrg" autofocus />
              </div>
              <div class="ws-form-group">
                <label>Slug <span style="color:#6b7280;font-weight:400">(used in URLs)</span></label>
                <input v-model="newOrgSlug" placeholder="acme-corp" class="ws-input" />
              </div>
              <div v-if="createOrgError" class="ws-form-error">{{ createOrgError }}</div>
              <div class="ws-modal-actions">
                <button type="button" class="ws-btn-cancel" @click="showCreateOrgModal = false">Cancel</button>
                <button type="button" class="ws-btn-create" :disabled="creatingOrg || !newOrgName.trim()" @click="createOrg">
                  {{ creatingOrg ? 'Creating…' : 'Create' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick, useId } from 'vue'
import { useRouter } from 'vue-router'
import { Building2, Check, ChevronDown, Plus, Search, Settings2, User } from 'lucide-vue-next'
import { useWorkspace } from '../../composables/useWorkspace'
import tenancyApi from '../../services/tenancyApi'
import { notify } from '@/composables/useNotify'

const router = useRouter()
const {
  activeWorkspace, activeOrg, myOrgs, loading, error, tenancyDisabled,
  switchWorkspace, clearWorkspace, loadMyOrgs,
  activeWorkspaceName,
} = useWorkspace()

const isOpen = ref(false)
const triggerRef = ref(null)
const dropdownRef = ref(null)
const buttonRef = ref(null)
const searchRef = ref(null)
const query = ref('')
const dropdownId = `workspace-switcher-${useId()}`
const filteredOrgs = computed(() => {
  const term = query.value.trim().toLowerCase()
  return myOrgs.value.map(org => ({ ...org, original: org,
    workspaces: (org.workspaces || []).filter(ws => !term || `${org.name} ${ws.name}`.toLowerCase().includes(term)),
  })).filter(org => !term || org.workspaces.length || org.name.toLowerCase().includes(term))
})
const showCreateModal = ref(false)
const newWsName = ref('')
const newWsSlug = ref('')
const creating = ref(false)

// Create Organisation state
const showCreateOrgModal = ref(false)
const newOrgName = ref('')
const newOrgSlug = ref('')
const creatingOrg = ref(false)
const createOrgError = ref('')

// Computed dropdown position (fixed, so it escapes header overflow:hidden)
const dropdownStyle = ref({})

function updateDropdownPos() {
  if (!triggerRef.value) return
  const rect = triggerRef.value.getBoundingClientRect()
  const padding = 12
  const width = Math.min(304, window.innerWidth - padding * 2)
  const left = Math.max(padding, Math.min(rect.left, window.innerWidth - width - padding))
  const below = window.innerHeight - rect.bottom - 8 - padding
  const above = rect.top - 8 - padding
  const opensAbove = below < 280 && above > below
  dropdownStyle.value = {
    position: 'fixed',
    ...(opensAbove ? { bottom: `${window.innerHeight - rect.top + 8}px` } : { top: `${rect.bottom + 8}px` }),
    left: `${left}px`,
    width: `${width}px`,
    maxHeight: `${Math.max(0, Math.min(560, opensAbove ? above : below))}px`,
    zIndex: 80,
  }
}

// Generate consistent color from workspace name
function stringToColor(str) {
  const palette = [
    '#2563EB', '#1D4ED8', '#2E90FA', '#14b8a6',
    '#f59e0b', '#10b981', '#3b82f6', '#ef4444',
  ]
  let hash = 0
  for (let c of str) hash = c.charCodeAt(0) + ((hash << 5) - hash)
  return palette[Math.abs(hash) % palette.length]
}

const wsColor = computed(() =>
  activeWorkspace.value ? stringToColor(activeWorkspace.value.name) : '#2563EB'
)

async function toggle() {
  if (isOpen.value) { close(); return }
  query.value = ''
  isOpen.value = true
  updateDropdownPos()
  if (!myOrgs.value.length) loadMyOrgs()
  await nextTick()
  searchRef.value?.focus()
}

function close(restoreFocus = false) {
  isOpen.value = false
  if (restoreFocus) buttonRef.value?.focus()
}
async function openFromKeyboard() {
  if (!isOpen.value) await toggle()
  dropdownRef.value?.querySelector('.ws-item')?.focus()
}
function onDropdownKey(event) {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  if (event.target.matches('input') && ['Home', 'End'].includes(event.key)) return
  const items = [...dropdownRef.value.querySelectorAll('button:not(:disabled), a[href]')]
  if (!items.length) return
  const index = items.indexOf(document.activeElement)
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : index < 0 ? (event.key === 'ArrowUp' ? items.length - 1 : 0) : (index + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length
  event.preventDefault()
  items[next]?.focus()
}
function onFocusOutside(event) {
  if (isOpen.value && !triggerRef.value?.contains(event.target) && !dropdownRef.value?.contains(event.target)) close()
}

function select(ws, org) {
  switchWorkspace(ws, org)
  close()
  router.push(`/workspace/${ws.id}`)
}

function exitWorkspaceMode() {
  clearWorkspace()
  close()
  router.push('/')
}

function openCreateWorkspace() {
  close()
  newWsName.value = ''
  newWsSlug.value = ''
  showCreateModal.value = true
}

watch(newWsName, (val) => {
  newWsSlug.value = val.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
})

async function createWorkspace() {
  if (!newWsName.value) return
  // Use activeOrg, or fall back to first loaded org
  const org = activeOrg.value || myOrgs.value[0]
  if (!org) {
    console.warn('[WorkspaceSwitcher] No org available to create workspace under')
    return
  }
  creating.value = true
  try {
    const res = await tenancyApi.createWorkspace(org.slug, {
      name: newWsName.value,
      slug: newWsSlug.value || newWsName.value.toLowerCase().replace(/\s+/g, '-'),
    })
    await loadMyOrgs()
    switchWorkspace(res.data, org)
    showCreateModal.value = false
  } catch (err) {
    console.error('[WorkspaceSwitcher] Create failed:', err?.response?.data || err)
    notify.error(err?.response?.data?.detail || err?.response?.data?.name?.[0] || 'Failed to create workspace')
  }
  creating.value = false
}

function openCreateOrg() {
  close()
  newOrgName.value = ''
  newOrgSlug.value = ''
  createOrgError.value = ''
  showCreateOrgModal.value = true
}

watch(newOrgName, (val) => {
  newOrgSlug.value = val.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
})

async function createOrg() {
  if (!newOrgName.value.trim()) return
  creatingOrg.value = true
  createOrgError.value = ''
  try {
    const res = await tenancyApi.createOrg({
      name: newOrgName.value.trim(),
      slug: newOrgSlug.value || undefined,
    })
    await loadMyOrgs()
    // Auto-select the first workspace in the new org
    const org = res.data
    const firstWs = org.workspaces?.[0]
    if (firstWs) {
      switchWorkspace(firstWs, org)
    }
    showCreateOrgModal.value = false
    router.push(firstWs ? `/workspace/${firstWs.id}` : '/')
  } catch (err) {
    if (err?.response?.status === 409) {
      createOrgError.value = err.response.data?.detail || 'You can only own one organisation at this time.'
    } else {
      createOrgError.value = err?.response?.data?.slug?.[0] || err?.response?.data?.detail || 'Failed to create organisation.'
    }
  }
  creatingOrg.value = false
}

// Close on outside click
function onClickOutside(e) {
  const trigger = triggerRef.value
  const dropdown = dropdownRef.value
  if (!trigger?.contains(e.target) && !dropdown?.contains(e.target)) {
    close()
  }
}

// Reposition on scroll / resize
function onReposition() {
  if (isOpen.value) updateDropdownPos()
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside)
  document.addEventListener('focusin', onFocusOutside)
  window.addEventListener('scroll', onReposition, { passive: true, capture: true })
  window.addEventListener('resize', onReposition, { passive: true })
  // Deferred to idle, not to first-open: the switcher is shell chrome on every dashboard page, so its
  // org list must not race the route's own data — but it still needs to be populated before the user
  // opens the dropdown (loading it on open would flash an empty menu). The response is 60s-cached.
  if (typeof requestIdleCallback === 'function') requestIdleCallback(() => loadMyOrgs(), { timeout: 2000 })
  else setTimeout(loadMyOrgs, 1500)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onClickOutside)
  document.removeEventListener('focusin', onFocusOutside)
  window.removeEventListener('scroll', onReposition, true)
  window.removeEventListener('resize', onReposition)
})
</script>

<style scoped>
.ws-switcher{position:relative;min-width:0;width:100%;max-width:240px}
.ws-trigger{display:flex;align-items:center;gap:10px;min-width:0;width:100%;min-height:46px;padding:8px 10px;border:1px solid #e1e6ed;border-radius:10px;background:#fff;color:#253248;font:inherit;text-align:left;cursor:pointer;transition:background .15s,border-color .15s}
.ws-trigger:hover{background:#f8fafc;border-color:#cbd5e1}.ws-trigger--open{background:#f8faff;border-color:#b7caf5}.ws-trigger:focus-visible{outline:2px solid #2563eb;outline-offset:2px}
.ws-trigger-icon{display:grid;place-items:center;flex-shrink:0;width:29px;height:29px;border:1px solid #e4eaf4;border-radius:8px;background:#f5f8ff}.ws-trigger-copy{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}.ws-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:1.4;font-weight:600}.ws-context{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#8a94a4;font-size:10px;line-height:1.3;font-weight:400}.ws-caret{flex-shrink:0;color:#8b96a7;transition:transform .15s}.ws-trigger--open .ws-caret{transform:rotate(180deg)}
</style>

<!-- Global styles for teleported dropdown (not scoped) -->
<style>
.ws-dropdown{display:flex;flex-direction:column;box-sizing:border-box;background:#fff;border:1px solid #e1e6ed;border-radius:13px;box-shadow:0 18px 48px #17243b24,0 2px 6px #17243b0a;overflow:hidden;color:#263248;font-family:Inter,system-ui,-apple-system,'Segoe UI',sans-serif;text-align:left}
.ws-dropdown *{box-sizing:border-box}.ws-dropdown-heading{flex-shrink:0;padding:16px 16px 10px;font-size:12px;font-weight:600;color:#344155}.ws-search{display:flex;align-items:center;gap:8px;flex-shrink:0;margin:0 12px 10px;padding:8px 9px;border:1px solid #e4e8ef;border-radius:7px;color:#929cab;background:#fafbfc}.ws-search:focus-within{background:#fff;border-color:#a6bdec;box-shadow:0 0 0 2px #2563eb0a}.ws-search input{width:100%;min-width:0;border:0;outline:0;padding:0;background:none;font:inherit;font-size:12px;font-weight:400;color:#263248;line-height:1.5}.ws-search input::placeholder{color:#939cab}
.ws-dropdown-content{min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;padding:0 6px 6px}.ws-personal-mode{padding:0 0 7px;margin-bottom:5px;border-bottom:1px solid #edf0f5}.ws-item{display:flex;align-items:center;gap:10px;width:100%;min-height:42px;padding:8px 10px;border:0;border-radius:7px;background:none;color:#344155;font:inherit;font-size:12px;text-align:left;cursor:pointer;transition:background .12s}.ws-item:hover{background:#f4f6f9}.ws-item--active{background:#eff4ff;color:#2563eb}.ws-item--active:hover{background:#e8f0ff}.ws-item-icon{display:grid;place-items:center;flex-shrink:0;width:28px;height:28px;border:1px solid #e4e9f1;border-radius:7px;background:#fff;font-size:12px;font-weight:600}.ws-personal-icon{background:#f3f6fc;color:#697c99;border-color:transparent}.ws-item--active .ws-personal-icon{background:#e1ebff;color:#2563eb}.ws-item-copy{display:flex;flex-direction:column;gap:3px;flex:1;min-width:0}.ws-item-name{display:block;overflow-wrap:anywhere;white-space:normal;line-height:1.4;font-weight:500}.ws-item-description{font-size:10px;line-height:1.4;color:#8b96a8;font-weight:400}.ws-check{flex-shrink:0;color:#2563eb}
.ws-org-group{padding:5px 0}.ws-org-group+.ws-org-group{border-top:1px solid #edf0f5;margin-top:4px}.ws-org-label{display:flex;align-items:flex-start;gap:6px;padding:9px 10px 7px;min-width:0;color:#8792a3;font-size:10px;line-height:1.5;font-weight:500}.ws-org-icon{flex-shrink:0;margin-top:1px}.ws-org-name{min-width:0;flex:1;overflow-wrap:anywhere}.ws-personal-badge{flex-shrink:0;border:1px solid #e7ebf2;background:#f8fafc;border-radius:4px;padding:0 5px;font-size:9px;color:#8090a7;font-weight:400}.ws-group-empty{margin:6px 10px 10px;font-size:11px;color:#94a3b8}.ws-empty{padding:16px 10px;margin:0;font-size:12px;line-height:1.6;color:#8290a4}.ws-empty p{margin:0 0 6px}.ws-loading{display:flex;align-items:center;gap:9px;padding:20px 10px;font-size:12px;color:#8290a4}.ws-spinner{width:15px;height:15px;border:2px solid #e2eaff;border-top-color:#2563eb;border-radius:50%;animation:ws-spin .7s linear infinite}@keyframes ws-spin{to{transform:rotate(360deg)}}
.ws-footer{flex-shrink:0;border-top:1px solid #edf0f5;padding:6px;background:#fcfcfd}.ws-footer-link{display:flex;align-items:center;gap:10px;width:100%;padding:9px 10px;border:0;border-radius:6px;background:none;color:#69788e;font:inherit;font-size:12px;line-height:1.4;font-weight:400;text-align:left;text-decoration:none;cursor:pointer}.ws-footer-link svg{flex-shrink:0}.ws-footer-link:hover:not(:disabled){background:#f0f3f8;color:#253b5c}.ws-footer-link:disabled{opacity:.4;cursor:default}.ws-dropdown button:focus-visible,.ws-dropdown a:focus-visible{outline:2px solid #2563eb;outline-offset:-2px}
.ws-dropdown-enter-active,.ws-dropdown-leave-active{transition:opacity .14s,transform .14s}.ws-dropdown-enter-from,.ws-dropdown-leave-to{opacity:0;transform:translateY(-4px)}
@media(prefers-reduced-motion:reduce){.ws-dropdown-enter-active,.ws-dropdown-leave-active{transition:none}}

/* --- Create Modal --- */
.ws-modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(3px);
  z-index: 100000;
  display: flex; align-items: center; justify-content: center;
}
.ws-modal {
  background: #ffffff;
  border: 1px solid #dfe7f2;
  border-radius: 10px;
  padding: 24px;
  width: 360px;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.14);
}
.ws-modal-enter-active, .ws-modal-leave-active { transition: all 0.2s ease; }
.ws-modal-enter-from, .ws-modal-leave-to { opacity: 0; transform: scale(0.94); }

.ws-modal-title { font-size: 17px; font-weight: 850; color: #0f172a; margin: 0 0 20px; }
.ws-form-group { margin-bottom: 16px; }
.ws-form-group label { display: block; font-size: 12px; color: #334155; margin-bottom: 6px; font-weight: 800; }
.ws-input {
  width: 100%; box-sizing: border-box;
  background: #fff;
  border: 1px solid #d8e2f0;
  border-radius: 8px;
  color: #0f172a;
  padding: 9px 12px;
  font-size: 13px;
  font-weight: 650;
  outline: none;
  transition: border-color 0.15s;
}
.ws-input:focus { border-color: #2563EB; }
.ws-modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 24px; }
.ws-btn-cancel {
  padding: 8px 16px; border-radius: 8px;
  background: #fff; border: 1px solid #d8e2f0;
  color: #334155; cursor: pointer; font-size: 12.5px; font-weight: 850;
  transition: all 0.15s;
}
.ws-btn-cancel:hover { color: #0f172a; background: #f8fbff; }
.ws-btn-create {
  padding: 8px 20px; border-radius: 8px;
  background: #2563eb;
  border: none; color: #fff;
  cursor: pointer; font-size: 12.5px; font-weight: 850;
  transition: opacity 0.15s;
}
.ws-btn-create:disabled { opacity: 0.6; cursor: not-allowed; }
.ws-btn-create:not(:disabled):hover { opacity: 0.9; }

.ws-form-error {
  color: #f87171;
  font-size: 12px;
  margin-top: -8px;
  margin-bottom: 8px;
}

button.ws-create-link {
  background: none;
  border: none;
  color: #2563EB;
  font-weight: 850;
  font-size: 12.5px;
  cursor: pointer;
  padding: 0;
}
button.ws-create-link:hover { text-decoration: underline; }
</style>
