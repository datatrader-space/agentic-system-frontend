<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { Search, X, Settings, ArrowUpRight } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import { SETTINGS_SECTIONS } from './settingsSections'
import { confirmState } from '../../composables/useConfirm'

const props = defineProps({ initialSection: { type: String, default: 'general' }, returnFocus: { default: null } })
const emit = defineEmits(['close'])
const activeKey = ref(SETTINGS_SECTIONS.some(section => section.key === props.initialSection) ? props.initialSection : 'general')
const active = computed(() => SETTINGS_SECTIONS.find(section => section.key === activeKey.value))
const query = ref('')
const panel = ref(null)
const search = ref(null)
const content = ref(null)
const dialogHost = ref(null)
const nestedActive = ref(false)
let mainFocus
const focusRoot = () => nestedActive.value ? dialogHost.value?.querySelector('[data-settings-owned-dialog]') : panel.value
provide('settingsDialogHost', dialogHost)
provide('settingsOverlayActive', async (open) => {
  if (open === nestedActive.value) return
  if (open) mainFocus = panel.value?.contains(document.activeElement) ? document.activeElement : search.value
  nestedActive.value = open
  await nextTick()
  if (open) {
    const root = focusRoot()
    ;(root?.querySelector('button:not(:disabled), input:not(:disabled), [tabindex="0"]') || root)?.focus()
  } else (mainFocus?.isConnected ? mainFocus : search.value)?.focus()
})
const groups = computed(() => ['Preferences', 'Workspace', 'Usage & billing', 'Account'].map(label => ({
  label,
  sections: SETTINGS_SECTIONS.filter(section => section.group === label && `${section.label} ${section.search}`.toLowerCase().includes(query.value.trim().toLowerCase())),
})).filter(group => group.sections.length))
let previousFocus
let appRoot
let previousInert
let previousOverflow
let lastFocus

function select(key) {
  activeKey.value = key
  if (content.value) content.value.scrollTop = 0
}
function close() { if (!confirmState.open && !nestedActive.value) emit('close') }
const focusable = () => [...(focusRoot()?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') || [])]
  .filter(element => !element.closest('[hidden], [inert]') && element.getAttribute('type') !== 'hidden' && element.getClientRects().length)
function onKey(event) {
  // The existing confirmation host must keep control of destructive-action approvals.
  if (confirmState.open || event.defaultPrevented) return
  const nestedDialog = event.target.closest?.('[role="dialog"], [role="alertdialog"]')
  if (nestedDialog && nestedDialog !== focusRoot()) return
  if (nestedActive.value && event.key === 'Escape') return
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
  if (event.key !== 'Tab') return
  const items = focusable()
  if (!items.length) { event.preventDefault(); focusRoot()?.focus(); return }
  const index = items.indexOf(document.activeElement)
  event.preventDefault()
  const next = index < 0 ? (event.shiftKey ? items.length - 1 : 0) : (index + (event.shiftKey ? -1 : 1) + items.length) % items.length
  items[next]?.focus()
}
function containFocus(event) {
  if (confirmState.open) return
  const root = focusRoot()
  if (root?.contains(event.target)) lastFocus = event.target
  else (root?.contains(lastFocus) ? lastFocus : root?.querySelector('button:not(:disabled), input:not(:disabled)') || root)?.focus()
}
watch(() => confirmState.open, async (open, wasOpen) => {
  if (!open && wasOpen) { await nextTick(); (lastFocus?.isConnected ? lastFocus : search.value)?.focus() }
})
onMounted(async () => {
  previousFocus = props.returnFocus || document.activeElement
  appRoot = document.getElementById('app')
  previousInert = appRoot?.getAttribute('inert')
  appRoot?.setAttribute('inert', '')
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  document.addEventListener('keydown', onKey)
  document.addEventListener('focusin', containFocus)
  await nextTick()
  search.value?.focus()
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  document.removeEventListener('focusin', containFocus)
  if (previousInert == null) appRoot?.removeAttribute('inert')
  else appRoot?.setAttribute('inert', previousInert)
  document.body.style.overflow = previousOverflow
  if (previousFocus?.isConnected && !previousFocus.closest('[inert]')) previousFocus.focus()
  else document.querySelector('.nav-toggle')?.focus()
})
</script>

<template>
  <Teleport to="body">
    <div class="settings-overlay" @click.self="close">
      <section ref="panel" class="settings-modal" role="dialog" aria-modal="true" aria-label="Settings" tabindex="-1" :inert="confirmState.open || nestedActive ? '' : undefined">
        <aside class="settings-rail">
          <div class="settings-brand"><Settings :size="17" aria-hidden="true" /><h2>Settings</h2></div>
          <label class="settings-search"><Search :size="15" aria-hidden="true" /><input ref="search" v-model="query" type="search" placeholder="Search settings" aria-label="Search settings sections" /></label>
          <nav aria-label="Settings sections">
            <div v-for="group in groups" :key="group.label" class="settings-group">
              <h3>{{ group.label }}</h3>
              <button v-for="section in group.sections" :key="section.key" type="button" :class="{ selected: activeKey === section.key }" :aria-current="activeKey === section.key ? 'page' : undefined" @click="select(section.key)">
                <component :is="section.icon" :size="16" :stroke-width="1.7" aria-hidden="true" /><span>{{ section.label }}</span>
              </button>
            </div>
            <p v-if="!groups.length" class="settings-no-results" role="status">No matching sections.</p>
          </nav>
          <span class="settings-rail-footer">AADML workspace</span>
        </aside>
        <div class="settings-main">
          <header class="settings-modal-header"><h2>{{ active.label }}</h2><RouterLink v-if="active.fullPage" :to="active.fullPage" class="settings-full-page" @click="close">Open full page<ArrowUpRight :size="13" aria-hidden="true" /></RouterLink><button type="button" class="settings-close" aria-label="Close settings" @click="close"><X :size="18" aria-hidden="true" /></button></header>
          <div ref="content" class="settings-modal-content" :data-section="activeKey">
            <Suspense :timeout="0">
              <component :is="active.component" :key="activeKey" v-bind="active.modalProps || {}" />
              <template #fallback><p class="settings-loading" role="status">Loading {{ active.label.toLowerCase() }} settings...</p></template>
            </Suspense>
          </div>
        </div>
      </section>
      <div ref="dialogHost" class="settings-dialog-host" :inert="confirmState.open ? '' : undefined" />
    </div>
  </Teleport>
</template>

<style scoped>
.settings-overlay{position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;padding:32px 24px;background:#18202d66;backdrop-filter:blur(3px);font-family:Inter,system-ui,-apple-system,'Segoe UI',sans-serif}
.settings-modal{--vm-ink:#18212f;--vm-ink-soft:#475569;--vm-ink-faint:#718096;--vm-surface:#fff;--vm-surface-soft:#f6f7f9;--vm-line:#e5e7eb;--vm-primary:#2563eb;display:grid;grid-template-columns:208px minmax(0,1fr);width:min(1040px,100%);height:min(720px,calc(100dvh - 64px));overflow:hidden;border:1px solid #d9dde3;border-radius:16px;background:#fff;box-shadow:0 24px 80px #11182730,0 3px 10px #1118270d;color:#1f2937;outline:none;text-align:left}
.settings-rail{display:flex;flex-direction:column;min-height:0;padding:22px 12px 14px;border-right:1px solid #e8e9ed;background:#fafafa}
.settings-brand{display:flex;gap:9px;align-items:center;padding:0 8px 18px;color:#475569}.settings-brand h2{font-size:14px;font-weight:600;margin:0;letter-spacing:-.2px;color:#263142}
.settings-search{display:flex;align-items:center;gap:7px;padding:8px 9px;background:#fff;border:1px solid #e1e4e8;border-radius:8px;color:#8c94a1}.settings-search:focus-within{border-color:#9db6ed;box-shadow:0 0 0 2px #2563eb0c}.settings-search input{min-width:0;width:100%;padding:0;border:0;outline:none;background:transparent;font:inherit;font-size:12px;line-height:1.4;font-weight:400;color:#334155}
.settings-rail nav{flex:1;min-height:0;overflow-y:auto;margin-top:18px}.settings-group+.settings-group{margin-top:19px}.settings-group h3{margin:0 8px 6px;font-size:10px;line-height:1.5;font-weight:500;color:#9298a3;text-transform:uppercase;letter-spacing:.6px}.settings-group button{display:flex;align-items:center;gap:10px;width:100%;min-height:35px;padding:8px 10px;border:0;border-radius:7px;background:none;color:#606775;text-align:left;font-size:12px;font-weight:450;cursor:pointer}.settings-group button:hover{background:#eeeef0;color:#303846}.settings-group button.selected{background:#e9e9ec;color:#202733;font-weight:550}.settings-group button svg{flex-shrink:0}.settings-group button:focus-visible,.settings-close:focus-visible{outline:2px solid #2563eb;outline-offset:-2px}.settings-rail-footer{padding:14px 8px 0;color:#a0a5af;font-size:10px}.settings-no-results{font-size:12px;line-height:1.5;color:#7b8493;padding:8px}
.settings-dialog-host{position:fixed;inset:0;pointer-events:none}.settings-dialog-host :deep(>*){pointer-events:auto}
.settings-main{display:flex;flex-direction:column;min-width:0;min-height:0}.settings-modal-header{display:flex;align-items:center;justify-content:space-between;flex-shrink:0;min-height:66px;padding:18px 28px 14px;border-bottom:1px solid #f0f1f3}.settings-modal-header h2{font-size:16px;letter-spacing:-.3px;font-weight:600;margin:0;color:#1f2937}.settings-full-page{display:inline-flex;align-items:center;gap:4px;margin-left:auto;margin-right:14px;color:#62728b;font-size:11px;text-decoration:none}.settings-full-page:hover{color:#2563eb}.settings-full-page:focus-visible{outline:2px solid #2563eb;outline-offset:3px}
.settings-close{display:grid;place-items:center;width:30px;height:30px;border:0;border-radius:7px;background:transparent;color:#75808e;cursor:pointer}.settings-close:hover{background:#f3f4f6;color:#111827}
.settings-modal-content{flex:1;min-width:0;min-height:0;overflow:auto;overscroll-behavior:contain;padding:8px 28px 28px;scrollbar-width:thin;scrollbar-color:#c9ccd3 transparent}.settings-loading{font-size:13px;color:#718096;padding:20px 0}
/* Compact the existing panels only inside this modal. Validation, confirmations and handlers stay in their original components. */
.settings-modal-content :deep(>.panel){gap:0;border:0;border-radius:0;padding:0;box-shadow:none;background:transparent}
.settings-modal-content :deep(.card){border:0;border-radius:0;padding:20px 0;box-shadow:none;background:transparent}
.settings-modal-content :deep(.card+.card){border-top:1px solid #eceef2}.settings-modal-content :deep(.card-title){font-size:13px;line-height:1.5;margin-bottom:4px}.settings-modal-content :deep(.card-sub){font-size:12px;line-height:1.5;margin:0 0 14px;color:#7a8493}
.settings-modal-content :deep(.row){gap:18px;min-width:0;padding:10px 0}.settings-modal-content :deep(.row-label){font-size:12px;font-weight:500}.settings-modal-content :deep(.row-hint){font-size:11px;line-height:1.5;color:#7a8493;max-width:440px}.settings-modal-content :deep(.row>div:first-child){min-width:0}.settings-modal-content :deep(.row>button){flex-shrink:0}
.settings-modal-content :deep(.field){display:grid;grid-template-columns:110px minmax(0,1fr);gap:5px 16px;align-items:center;margin-top:12px}.settings-modal-content :deep(.field label){font-size:12px}.settings-modal-content :deep(.field>span){grid-column:2;font-size:11px}.settings-modal-content :deep(.field input){min-width:0;width:100%;box-sizing:border-box;font-size:12px;padding:8px 10px;border-radius:7px}.settings-modal-content :deep(.name-row){min-width:0}
.settings-modal-content :deep(.save-btn),.settings-modal-content :deep(.tour-btn){font-size:12px;padding:7px 12px;border-radius:7px;background:#2563eb;box-shadow:none}.settings-modal-content :deep(.seg-btn){font-size:12px;padding:5px 10px}.settings-modal-content :deep(.seg){flex-shrink:0}.settings-modal-content :deep(.inp){min-width:0;max-width:100%;font-size:12px;padding:8px 10px}.settings-modal-content :deep(.confirm-row){flex-wrap:wrap;min-width:0}.settings-modal-content :deep(.form){gap:8px}
.settings-modal-content :deep(.cost-page),.settings-modal-content :deep(.sandboxes-page),.settings-modal-content :deep(.billing){padding:12px 0;background:transparent;max-width:none;min-height:0}.settings-modal-content :deep(.cost-header),.settings-modal-content :deep(.page-head),.settings-modal-content :deep(.head){gap:12px;flex-wrap:wrap;margin-bottom:20px}.settings-modal-content :deep(h1){font-size:18px;line-height:1.4;letter-spacing:-.3px}.settings-modal-content :deep(.metric-grid){grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.settings-modal-content :deep(.metric-card){padding:14px;min-height:0}.settings-modal-content :deep(.metric-card strong){font-size:22px}.settings-modal-content :deep(.analytics-grid){grid-template-columns:minmax(0,1fr)}.settings-modal-content :deep(.panel){min-width:0}.settings-modal-content :deep(.chart-panel){padding:16px}.settings-modal-content :deep(table){font-size:11px}.settings-modal-content :deep(.table-wrap){overflow:auto}.settings-modal-content :deep(.ns){max-width:none;padding-top:16px}.settings-modal-content :deep(.ns-head h2){font-size:15px}.settings-modal-content :deep(.ns-head p){font-size:12px}.settings-modal-content :deep(.ns-title){font-size:12px}.settings-modal-content :deep(.ns-desc){font-size:11px}.settings-modal-content :deep(.ns-row){padding-block:14px}
.settings-modal-content[data-section=providers] :deep(>.space-y-8){padding-top:16px}.settings-modal-content[data-section=providers] :deep(.text-3xl){font-size:18px;line-height:1.4}.settings-modal-content[data-section=providers] :deep(.space-y-8>:not([hidden])~:not([hidden])){margin-top:18px}.settings-modal-content[data-section=providers] :deep(.sm\:p-6){padding:16px}.settings-modal-content[data-section=providers] :deep(.sm\:max-w-md){max-width:260px}
@media(max-width:900px){.settings-modal{grid-template-columns:180px minmax(0,1fr)}.settings-modal-content{padding-inline:20px}.settings-modal-header{padding-inline:20px}.settings-modal-content :deep(.row){flex-wrap:wrap}.settings-modal-content :deep(.row.toggle){flex-wrap:nowrap}.settings-modal-content :deep(.md\:grid-cols-2){grid-template-columns:minmax(0,1fr)}}
@media(max-width:600px){.settings-overlay{padding:12px}.settings-modal{display:flex;flex-direction:column;height:calc(100dvh - 24px);border-radius:12px}.settings-rail{padding:14px 14px 10px;border-right:0;border-bottom:1px solid #e8e9ed;flex-shrink:0}.settings-brand,.settings-rail-footer{display:none}.settings-search{margin-right:34px}.settings-rail nav{display:flex;gap:8px;overflow-x:auto;overflow-y:visible;margin-top:12px;flex:none;padding-bottom:3px}.settings-group{display:contents}.settings-group h3{display:none}.settings-group button{width:auto;white-space:nowrap;flex-shrink:0;min-height:32px;padding:6px 9px;gap:6px;font-size:11px}.settings-main{flex:1}.settings-modal-header{min-height:52px;padding:12px 18px}.settings-close{position:absolute;right:24px;top:25px}.settings-modal-content{padding:0 18px 24px}.settings-modal-content :deep(.field){grid-template-columns:1fr;gap:5px}.settings-modal-content :deep(.field>span){grid-column:1}.settings-modal-content :deep(.metric-grid){grid-template-columns:1fr}.settings-modal-content :deep(.exec-options){grid-template-columns:1fr}}
</style>
