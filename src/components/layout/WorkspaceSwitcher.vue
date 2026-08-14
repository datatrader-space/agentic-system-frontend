<template>
  <div v-if="!tenancyDisabled" class="ws-switcher" ref="triggerRef">
    <!-- Trigger Button -->
    <button
      class="ws-trigger"
      :class="{ 'ws-trigger--open': isOpen }"
      @click="toggle"
      :title="activeWorkspaceName || 'Workspace'"
    >
      <span class="ws-dot" :style="{ background: wsColor }"></span>
      <span class="ws-name">{{ activeWorkspaceName || 'Workspace' }}</span>
      <svg class="ws-caret" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/>
      </svg>
    </button>

    <!-- Dropdown (teleported to body to escape header overflow) -->
    <Teleport to="body">
      <transition name="ws-dropdown">
        <div
          v-if="isOpen"
          class="ws-dropdown"
          :style="dropdownStyle"
          ref="dropdownRef"
        >
          <!-- Loading -->
          <div v-if="loading" class="ws-loading">
            <div class="ws-spinner"></div>
            <span>Loading…</span>
          </div>

          <template v-else>
            <!-- No orgs -->
            <div v-if="!myOrgs.length" class="ws-empty">
              <p>You haven't created an organisation yet.</p>
              <button class="ws-create-link" @click="openCreateOrg">
                Create Organisation →
              </button>
            </div>

            <!-- Org groups -->
            <template v-else>
              <!-- Personal Mode escape hatch -->
              <div class="ws-personal-mode">
                <button
                  class="ws-item ws-item--personal"
                  :class="{ 'ws-item--active': !activeWorkspace }"
                  @click="exitWorkspaceMode"
                >
                  <svg class="ws-pm-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
                  </svg>
                  <span class="ws-item-name">Personal Mode</span>
                  <svg v-if="!activeWorkspace" class="ws-check" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                  </svg>
                  <span v-else class="ws-pm-hint">No scoping</span>
                </button>
              </div>

              <div
                v-for="org in myOrgs"
                :key="org.id"
                class="ws-org-group"
              >
                <div class="ws-org-label">
                  <svg viewBox="0 0 20 20" fill="currentColor" class="ws-org-icon">
                    <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clip-rule="evenodd"/>
                  </svg>
                  <span class="ws-org-name" :title="org.name">{{ org.name }}</span>
                  <span v-if="org.is_personal" class="ws-personal-badge">Personal</span>
                </div>

                <button
                  v-for="ws in (org.workspaces || [])"
                  :key="ws.id"
                  class="ws-item"
                  :class="{ 'ws-item--active': activeWorkspace?.id === ws.id }"
                  @click="select(ws, org)"
                >
                  <span class="ws-item-dot" :style="{ background: stringToColor(ws.name) }"></span>
                  <span class="ws-item-name">{{ ws.name }}</span>
                  <svg v-if="activeWorkspace?.id === ws.id" class="ws-check" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                  </svg>
                  <span v-else class="ws-members-count">
                    {{ ws.member_count ?? '' }}
                    <span v-if="ws.member_count">members</span>
                  </span>
                </button>
              </div>
            </template>

            <!-- Footer Actions -->
            <div class="ws-footer">
              <router-link
                v-if="activeOrg"
                :to="`/org/${activeOrg.slug}/settings`"
                class="ws-footer-link"
                @click="close"
              >
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/>
                </svg>
                Organisation Settings
              </router-link>
              <button class="ws-footer-link" @click="openCreateWorkspace">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/>
                </svg>
                New Workspace
              </button>
              <button class="ws-footer-link" @click="openCreateOrg">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 01-.553.894l-4 2A1 1 0 0111 18V6a1 1 0 00-1-1H4V4z" clip-rule="evenodd"/>
                  <path fill-rule="evenodd" d="M2 7a1 1 0 011-1h4a1 1 0 011 1v10a1 1 0 01-.553.894l-4 2A1 1 0 012 19V7z" clip-rule="evenodd"/>
                </svg>
                New Organisation
              </button>
            </div>
          </template>
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
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkspace } from '../../composables/useWorkspace'
import tenancyApi from '../../services/tenancyApi'
import { notify } from '@/composables/useNotify'

const router = useRouter()
const {
  activeWorkspace, activeOrg, myOrgs, loading, tenancyDisabled,
  switchWorkspace, clearWorkspace, loadMyOrgs,
  activeWorkspaceName,
} = useWorkspace()

const isOpen = ref(false)
const triggerRef = ref(null)
const dropdownRef = ref(null)
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
  const sidebar = triggerRef.value.closest?.('aside.sidebar')
  const viewportPadding = 12
  const defaultWidth = 280

  if (sidebar) {
    const sidebarRect = sidebar.getBoundingClientRect()
    const leftEdge = Math.max(sidebarRect.left + 16, rect.left)
    const availableWidth = Math.max(176, Math.floor(sidebarRect.right - leftEdge - 16))
    const width = Math.min(defaultWidth, availableWidth)

    dropdownStyle.value = {
      position: 'fixed',
      top: `${rect.bottom + 8}px`,
      left: `${leftEdge}px`,
      width: `${width}px`,
      maxWidth: `calc(100vw - ${viewportPadding * 2}px)`,
      zIndex: 99999,
    }
    return
  }

  const width = Math.min(defaultWidth, window.innerWidth - viewportPadding * 2)
  const left = Math.max(
    viewportPadding,
    Math.min(rect.left, window.innerWidth - width - viewportPadding),
  )

  dropdownStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 8}px`,
    left: `${left}px`,
    width: `${width}px`,
    maxWidth: `calc(100vw - ${viewportPadding * 2}px)`,
    zIndex: 99999,
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

function toggle() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    updateDropdownPos()
    if (!myOrgs.value.length) loadMyOrgs()
  }
}

function close() { isOpen.value = false }

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
  window.addEventListener('scroll', onReposition, { passive: true })
  window.addEventListener('resize', onReposition, { passive: true })
  // Deferred to idle, not to first-open: the switcher is shell chrome on every dashboard page, so its
  // org list must not race the route's own data — but it still needs to be populated before the user
  // opens the dropdown (loading it on open would flash an empty menu). The response is 60s-cached.
  if (typeof requestIdleCallback === 'function') requestIdleCallback(() => loadMyOrgs(), { timeout: 2000 })
  else setTimeout(loadMyOrgs, 1500)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onClickOutside)
  window.removeEventListener('scroll', onReposition)
  window.removeEventListener('resize', onReposition)
})
</script>

<style scoped>
/* --- Trigger --- */
.ws-switcher { position: relative; }

.ws-trigger {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 0 11px;
  background: #ffffff;
  border: 1px solid #d8e2f0;
  border-radius: 8px;
  color: #334155;
  font-size: 12.5px;
  font-weight: 750;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  max-width: 180px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .035);
}
.ws-trigger:hover { background: #f8fbff; border-color: #cbd9ed; color: #0f172a; }
.ws-trigger--open { background: #eef4ff; border-color: #bcd0f7; color: #2563eb; }

.ws-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.ws-name {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  max-width: 130px;
}
.ws-caret {
  width: 14px; height: 14px;
  color: #94a3b8;
  flex-shrink: 0;
  transition: transform 0.2s ease;
}
.ws-trigger--open .ws-caret { transform: rotate(180deg); }
</style>

<!-- Global styles for teleported dropdown (not scoped) -->
<style>
/* --- Dropdown (teleported, global) --- */
.ws-dropdown {
  width: 280px;
  background: #ffffff;
  border: 1px solid #dfe7f2;
  border-radius: 10px;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.14);
  overflow: hidden;
  color: #0f172a;
  /* position/top/right set via inline style */
}

.ws-dropdown-enter-active, .ws-dropdown-leave-active {
  transition: all 0.18s ease;
}
.ws-dropdown-enter-from, .ws-dropdown-leave-to {
  opacity: 0; transform: translateY(-6px) scale(0.97);
}

/* --- Loading --- */
.ws-loading {
  display: flex; align-items: center; gap: 10px;
  padding: 20px 16px; color: #64748b; font-size: 13px;
}
.ws-spinner {
  width: 16px; height: 16px;
  border: 2px solid #dbe7ff;
  border-top-color: #2563EB;
  border-radius: 50%;
  animation: ws-spin 0.7s linear infinite;
}
@keyframes ws-spin { to { transform: rotate(360deg); } }

/* --- Empty --- */
.ws-empty { padding: 20px 16px; font-size: 13px; color: #64748b; }
.ws-create-link { color: #2563EB; text-decoration: none; font-weight: 750; }

/* --- Org Group --- */
.ws-org-group { padding: 8px 0; }
.ws-org-group + .ws-org-group { border-top: 1px solid #edf2f7; }

.ws-org-label {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px 6px;
  font-size: 10.5px; font-weight: 850;
  color: #64748b;
  text-transform: uppercase; letter-spacing: 0.04em;
  min-width: 0;
}
.ws-org-icon { width: 12px; height: 12px; color: #94a3b8; flex-shrink: 0; }
.ws-org-name {
  min-width: 0; flex: 1;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  line-height: 1.35;
}
.ws-personal-badge {
  flex-shrink: 0;
  background: #eef4ff;
  color: #2563eb;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 850;
  text-transform: none; letter-spacing: 0;
}

/* --- Workspace Item --- */
.ws-item {
  display: flex; align-items: center; gap: 10px;
  width: 100%;
  min-height: 36px;
  padding: 8px 14px;
  background: none; border: none;
  color: #334155; font-size: 12.5px; font-weight: 750;
  cursor: pointer;
  transition: background 0.12s ease;
  text-align: left;
}
.ws-item:hover { background: #f8fbff; }
.ws-item--active { color: #2563eb; background: #eef4ff; }

.ws-item-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.ws-item-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ws-check { width: 14px; height: 14px; color: #2563EB; flex-shrink: 0; }
.ws-members-count { font-size: 11px; color: #94a3b8; white-space: nowrap; }

/* --- Personal Mode --- */
.ws-personal-mode {
  padding: 6px 0;
  border-bottom: 1px solid #edf2f7;
}
.ws-item--personal {
  gap: 10px;
}
.ws-pm-icon { width: 16px; height: 16px; color: #64748b; flex-shrink: 0; }
.ws-item--active .ws-pm-icon { color: #2563eb; }
.ws-pm-hint { font-size: 11px; color: #94a3b8; white-space: nowrap; }

/* --- Footer --- */
.ws-footer {
  border-top: 1px solid #edf2f7;
  padding: 6px 0;
}
.ws-footer-link {
  display: flex; align-items: center; gap: 8px;
  width: 100%;
  padding: 9px 14px;
  background: none; border: none;
  color: #64748b; font-size: 12.5px; font-weight: 750;
  cursor: pointer; text-decoration: none;
  transition: color 0.12s, background 0.12s;
  text-align: left;
}
.ws-footer-link:hover { color: #2563eb; background: #f8fbff; }
.ws-footer-link svg { width: 14px; height: 14px; flex-shrink: 0; }

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
