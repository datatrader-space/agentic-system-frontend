<template>
  <div class="cfg-root">
    <div v-if="loading" class="cfg-loading">
      <span class="spin"></span> Loading agent…
    </div>

    <div v-else class="cfg">
      <!-- ===================== Top bar ===================== -->
      <div class="cfg-bar">
        <div class="bar-left">
          <button class="back" @click="goBack"><Icon icon="lucide:chevron-left" /> Agents</button>
          <span class="sep">/</span>
          <span class="nm">{{ (agent && agent.name) || 'New Agent' }}</span>
          <span v-if="needsPublish" class="pill dirty"><span class="d"></span> Unsaved changes</span>
          <span v-else class="pill ok"><Icon icon="lucide:check" /> Published</span>
        </div>
        <AgentTabSwitcher class="cfg-switch" />
        <div class="bar-right">
          <button class="gbtn" @click="showWorkspace = true"><Icon icon="lucide:folder" /> Workspace</button>
          <button v-if="agent && agent.id" class="gbtn violet" @click="showDeploy = true"><Icon icon="lucide:rocket" /> Deploy</button>
          <div class="save-wrap">
            <div class="save-split" :class="needsPublish ? 'is-dirty' : 'is-ok'">
              <button class="save-main" :disabled="saving" @click="triggerSave">
                <Icon v-if="!saving" :icon="needsPublish ? 'lucide:upload-cloud' : 'lucide:check-circle-2'" />
                {{ saving ? 'Saving…' : (needsPublish ? 'Save & Publish' : 'Saved & Published') }}
              </button>
              <button class="save-caret" :disabled="saving" @click="showSaveMenu = !showSaveMenu"><Icon icon="lucide:chevron-down" /></button>
            </div>
            <div v-if="showSaveMenu" class="save-menu" @click.stop>
              <button @click="triggerSave(); showSaveMenu = false"><Icon icon="lucide:upload-cloud" /> Save &amp; Publish</button>
              <button @click="triggerSaveDraft(); showSaveMenu = false"><Icon icon="lucide:file-text" /> Save as draft</button>
              <div class="div"></div>
              <button :disabled="!(agent && agent.id)" @click="saveAsTemplate(); showSaveMenu = false"><Icon icon="lucide:layout-template" /> Save as template</button>
              <button :disabled="!(agent && agent.id)" @click="showDeploy = true; showSaveMenu = false"><Icon icon="lucide:share-2" /> Deploy &amp; Share…</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ===================== Wizard step rail ===================== -->
      <div class="rail vm-scroll">
        <button
          v-for="(s, i) in steps"
          :key="s.id"
          class="step"
          :class="{ cur: activeStep === s.id, done: i < activeIndex }"
          @click="scrollToSection(s.id)"
        >
          <span class="n"><Icon v-if="i < activeIndex" icon="lucide:check" /><template v-else>{{ s.n }}</template></span>
          {{ s.label }}
        </button>
      </div>

      <!-- ===================== Body ===================== -->
      <div class="cfg-body">
        <div ref="builderHost" class="builder-host">
          <AgentBuilder
            ref="builderRef"
            v-model:agent="agent"
            layout="canvas"
            :is-saving="saving"
            :save-fn="saveAgent"
            @save="saveAgent"
            @dirty="dirty = $event"
            @close="goBack"
            @open-workspace="showWorkspace = true"
          />
        </div>

        <div class="dock">
          <AgentEmulator
            :key="publishedVersion"
            :class="{ 'pointer-events-none opacity-40 select-none': needsPublish }"
            :agent-id="!needsPublish && agent && agent.id ? agent.id : null"
            :model-name="agent && agent.default_model_name ? agent.default_model_name : ''"
          />
          <div v-if="needsPublish" class="lock">
            <span class="ring"><Icon icon="lucide:lock" /></span>
            <b>Publish to test your agent</b>
            <p>The live preview unlocks once you Save &amp; Publish your changes.</p>
            <button class="mini" :disabled="saving" @click="triggerSave">{{ saving ? 'Saving…' : 'Save & Publish' }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Workspace slide-over -->
    <AgentWorkspacePanel :agent="agent" v-model="showWorkspace" />
    <!-- Deploy & share (publish, public link, embed code, chat bubble, branding) -->
    <DeploySettings :agent="agent" v-model="showDeploy" />
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import api from '../services/api'
import { notify } from '@/composables/useNotify'
import AgentBuilder from '../components/AgentBuilder.vue'
import AgentEmulator from '../components/AgentEmulator.vue'
import AgentWorkspacePanel from '../components/AgentWorkspacePanel.vue'
import DeploySettings from '../components/agent/DeploySettings.vue'
import AgentTabSwitcher from '../components/agent/AgentTabSwitcher.vue'

const route = useRoute()
const router = useRouter()
const agent = ref(null)
const loading = ref(true)
const saving = ref(false)
const showWorkspace = ref(false)
const showSaveMenu = ref(false)
const showDeploy = ref(false)
const builderRef = ref(null)
const builderHost = ref(null)
// When true, the next saveAgent() also publishes (snapshot + status) on the backend.
const publishAfterSave = ref(false)

// Publish state: the form is "dirty" when it differs from what's saved. A never-saved agent (no id)
// always needs publishing. The live Emulator stays disabled — and Save & Publish stays red — until
// the agent is published clean. `publishedVersion` bumps on each publish to remount the Emulator so
// it always reflects the saved agent (incl. its saved mode).
const dirty = ref(false)
const publishedVersion = ref(0)
const needsPublish = computed(() => dirty.value || !(agent.value && agent.value.id))

/* ---- Wizard step rail (scrolls the builder canvas to each section anchor) ---- */
const steps = [
  { id: 'sec-general', n: 1, label: 'General' },
  { id: 'sec-prompt', n: 2, label: 'System Prompt' },
  { id: 'sec-knowledge', n: 3, label: 'Knowledge' },
  { id: 'sec-tools', n: 4, label: 'Tools' },
  { id: 'sec-autonomy', n: 5, label: 'Autonomy' },
  { id: 'sec-advanced', n: 6, label: 'Advanced' },
]
const activeStep = ref('sec-general')
const activeIndex = computed(() => Math.max(0, steps.findIndex(s => s.id === activeStep.value)))

function scrollToSection(id) {
  const host = builderHost.value
  if (!host) return
  const el = host.querySelector('#' + id)
  if (!el) return
  // Scroll within the builder's own scroll container (robust vs scrollIntoView,
  // which can scroll the wrong ancestor and land on empty space).
  const scroller = host.querySelector('.agent-builder > .overflow-y-auto')
    || host.querySelector('.agent-builder .overflow-y-auto')
  if (scroller) {
    const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 14
    scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  } else {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

let io = null
function setupSpy() {
  teardownSpy()
  if (!builderHost.value || typeof IntersectionObserver === 'undefined') return
  io = new IntersectionObserver((entries) => {
    // Pick the top-most intersecting section as the active step.
    const visible = entries.filter(e => e.isIntersecting)
    if (visible.length) {
      visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      activeStep.value = visible[0].target.id
    }
  }, { rootMargin: '-8% 0px -72% 0px', threshold: 0.01 })
  steps.forEach(s => {
    const el = builderHost.value.querySelector('#' + s.id)
    if (el) io.observe(el)
  })
}
function teardownSpy() { if (io) { io.disconnect(); io = null } }

// Save & Publish: save the draft, then publish (snapshot + status) on the backend.
function triggerSave() {
  publishAfterSave.value = true
  if (builderRef.value && builderRef.value.save) builderRef.value.save()
}
// Save as draft: persist edits only — does NOT publish (the live/public agent keeps its snapshot).
function triggerSaveDraft() {
  publishAfterSave.value = false
  if (builderRef.value && builderRef.value.save) builderRef.value.save()
}

async function saveAsTemplate() {
  if (!(agent.value && agent.value.id)) return
  try {
    await api.saveAgentAsTemplate(agent.value.id, { name: `${agent.value.name} Template` })
    notify.success('Saved as template — available when creating a new agent')
  } catch (e) {
    notify.error('Failed to save template')
  }
}

// Pull a human-readable message out of an axios error (DRF returns field errors on 400).
function extractApiError(e) {
  const d = e && e.response && e.response.data
  if (!d) return (e && e.message) || 'Unknown error'
  if (typeof d === 'string') return d
  if (d.error) return d.error
  if (d.detail) return d.detail
  try {
    return Object.entries(d)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join(' · ')
  } catch (_) {
    return (e && e.message) || 'Request failed'
  }
}

function blankAgent() {
  return {
    name: '',
    description: '',
    tool_ids: [],
    code_mode_enabled: false,
    code_mode_services: [],
    builder_mode_enabled: false,
    prompt_mode: 'append',
    max_history_messages: 0,  // 0 = Auto (backend manages history by token budget + summarization)
  }
}

async function load() {
  loading.value = true
  const id = route.params.id
  if (id && id !== 'new') {
    try {
      const res = await api.get(`/agents/${id}/`)
      const a = res.data || {}
      if (!a.tool_ids && a.tools) a.tool_ids = a.tools.map(t => t.id)
      if (!a.tool_ids) a.tool_ids = []
      agent.value = a
    } catch (e) {
      console.error('Failed to load agent', e)
      agent.value = blankAgent()
    }
  } else {
    agent.value = blankAgent()
  }
  loading.value = false
  await nextTick()
  setupSpy()
}

async function saveAgent(agentData) {
  try {
    saving.value = true
    const dataToSave = agentData || agent.value
    let res
    if (dataToSave.id) {
      res = await api.patch(`/agents/${dataToSave.id}/`, dataToSave)
    } else {
      res = await api.post('/agents/', dataToSave)
      // Switch to edit mode (stay in dashboard shell) to prevent duplicate creates
      router.replace(`/dashboard/agents/${res.data.id}/configure`)
    }
    let a = res.data
    // Save & Publish: snapshot + status=published on the backend (powers public share/runtime).
    if (publishAfterSave.value && a.id) {
      try {
        const pres = await api.publishAgent(a.id)
        if (pres.data) a = pres.data
      } catch (e) { /* non-fatal — the save itself succeeded */ }
    }
    publishAfterSave.value = false
    if (!a.tool_ids && a.tools) a.tool_ids = a.tools.map(t => t.id)
    agent.value = a
    // Reset the dirty baseline and remount the Emulator so it reflects the saved agent.
    await nextTick()
    if (builderRef.value && builderRef.value.markClean) builderRef.value.markClean()
    dirty.value = false
    publishedVersion.value++
    return a
  } catch (e) {
    notify.error('Failed to save agent: ' + extractApiError(e))
    return null
  } finally {
    saving.value = false
  }
}

function goBack() {
  router.push('/dashboard/agents')
}

// Close the save menu on any outside click.
const closeSaveMenu = () => { showSaveMenu.value = false }

// Reload when navigating between agents (e.g. new -> configure/:id)
watch(() => route.params.id, () => load())
onMounted(() => {
  load()
  document.addEventListener('click', closeSaveMenu)
})
onBeforeUnmount(() => {
  teardownSpy()
  document.removeEventListener('click', closeSaveMenu)
})
</script>

<style scoped>
.cfg-root { height: 100%; font-family: var(--vm-font-sans); color: var(--vm-ink); }
.cfg { display: flex; flex-direction: column; height: 100%; }
.cfg-loading { display: flex; align-items: center; justify-content: center; gap: 10px; height: 100%; color: var(--vm-ink-faint); font-size: 14px; }
.spin { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--vm-line-2); border-top-color: var(--vm-violet); animation: vmSpin .8s linear infinite; }
@keyframes vmSpin { to { transform: rotate(360deg); } }

/* top bar */
.cfg-bar { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; padding: 14px 22px; background: var(--vm-glass-strong); backdrop-filter: blur(16px); border-bottom: 1px solid var(--vm-line); flex: 0 0 auto; }
/* centered switcher — hidden below xl to avoid crowding the dense top bar */
.cfg-switch { position: absolute; left: 50%; transform: translateX(-50%); display: none; }
@media (min-width: 1280px) { .cfg-switch { display: inline-flex; } }
.bar-left { display: flex; align-items: center; gap: 11px; min-width: 0; }
.back { display: inline-flex; align-items: center; gap: 4px; border: none; background: transparent; cursor: pointer; font: 600 13px var(--vm-font-sans); color: var(--vm-violet-d); }
.back :deep(svg) { width: 16px; height: 16px; }
.sep { color: var(--vm-ink-faint); }
.nm { font-family: var(--vm-font-display); font-size: 18px; font-weight: 700; letter-spacing: -.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pill { display: inline-flex; align-items: center; gap: 6px; font: 700 11px var(--vm-font-sans); padding: 5px 11px; border-radius: 999px; }
.pill.dirty { color: #B45309; background: rgba(245, 158, 11, .14); }
.pill.dirty .d { width: 7px; height: 7px; border-radius: 50%; background: var(--vm-amber); }
.pill.ok { color: #059669; background: rgba(16, 185, 129, .12); }
.pill :deep(svg) { width: 13px; height: 13px; }

.bar-right { display: flex; align-items: center; gap: 9px; }
.gbtn { display: inline-flex; align-items: center; gap: 7px; border: 1px solid var(--vm-line-2); background: var(--vm-surface); cursor: pointer; padding: 9px 14px; border-radius: 12px; font: 600 13px var(--vm-font-sans); color: var(--vm-ink-soft); transition: .2s var(--vm-ease); }
.gbtn:hover { transform: translateY(-1px); box-shadow: var(--vm-shadow-s); color: var(--vm-ink); }
.gbtn.violet { color: var(--vm-violet-d); border-color: rgba(124, 58, 237, .3); }
.gbtn :deep(svg) { width: 15px; height: 15px; }

.save-wrap { position: relative; }
.save-split { display: flex; border-radius: 12px; overflow: hidden; box-shadow: var(--vm-glow-v); }
.save-split.is-ok { box-shadow: 0 6px 18px rgba(16, 185, 129, .32); }
.save-main, .save-caret { border: none; cursor: pointer; color: #fff; font: 700 13.5px var(--vm-font-sans); display: flex; align-items: center; gap: 8px; transition: filter .2s; }
.save-split.is-dirty .save-main, .save-split.is-dirty .save-caret { background: var(--vm-g-brand); }
.save-split.is-ok .save-main, .save-split.is-ok .save-caret { background: linear-gradient(120deg, #10B981, #14B8A6); }
.save-main { padding: 10px 16px; }
.save-main:hover, .save-caret:hover { filter: brightness(1.06); }
.save-main:disabled { opacity: .6; cursor: default; }
.save-caret { padding: 10px 9px; border-left: 1px solid rgba(255, 255, 255, .25); }
.save-main :deep(svg) { width: 15px; height: 15px; } .save-caret :deep(svg) { width: 15px; height: 15px; }
.save-menu { position: absolute; right: 0; top: calc(100% + 8px); width: 230px; background: var(--vm-glass-strong); backdrop-filter: blur(18px); border: 1px solid var(--vm-line); border-radius: 14px; box-shadow: var(--vm-shadow-l); padding: 6px; z-index: 40; }
.save-menu button { width: 100%; display: flex; align-items: center; gap: 10px; padding: 9px 11px; border: none; background: transparent; border-radius: 10px; font: 600 13px var(--vm-font-sans); color: var(--vm-ink-soft); cursor: pointer; }
.save-menu button:hover { background: var(--vm-surface); color: var(--vm-ink); }
.save-menu button:disabled { opacity: .4; cursor: default; }
.save-menu button :deep(svg) { width: 15px; height: 15px; }
.save-menu .div { height: 1px; background: var(--vm-line); margin: 5px 0; }

/* wizard rail */
.rail { display: flex; gap: 8px; padding: 14px 22px; overflow-x: auto; flex: 0 0 auto; border-bottom: 1px solid var(--vm-line); background: rgba(255, 255, 255, .4); backdrop-filter: blur(8px); }
.rail::-webkit-scrollbar { height: 0; }
.step { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; border: 1px solid var(--vm-line); background: var(--vm-glass-strong); cursor: pointer; padding: 7px 14px; border-radius: 999px; font: 700 12.5px var(--vm-font-sans); color: var(--vm-ink-faint); transition: .2s var(--vm-ease); }
.step:hover { transform: translateY(-1px); color: var(--vm-ink-soft); }
.step .n { width: 19px; height: 19px; border-radius: 50%; background: var(--vm-line-2); color: #fff; font-size: 10px; display: flex; align-items: center; justify-content: center; }
.step .n :deep(svg) { width: 11px; height: 11px; }
.step.done { color: #0D9488; border-color: transparent; background: #E6FBF6; }
.step.done .n { background: var(--vm-teal); }
.step.cur { color: var(--vm-violet-d); border-color: transparent; background: var(--vm-violet-soft); box-shadow: var(--vm-shadow-s); }
.step.cur .n { background: var(--vm-g-brand); }

/* body */
.cfg-body { flex: 1; min-height: 0; display: flex; overflow: hidden; }
.builder-host { flex: 1; min-width: 0; height: 100%; }
.dock { width: 420px; flex: 0 0 auto; position: relative; border-left: 1px solid var(--vm-line); background: var(--vm-glass-strong); backdrop-filter: blur(14px); }
@media (max-width: 1180px) { .dock { width: 360px; } }
@media (max-width: 900px) { .cfg-body { flex-direction: column; } .dock { width: 100%; height: 60vh; border-left: none; border-top: 1px solid var(--vm-line); } }

/* lock overlay */
.lock { position: absolute; inset: 0; z-index: 10; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center; padding: 24px; background: rgba(255, 255, 255, .55); backdrop-filter: blur(3px); }
.lock .ring { width: 62px; height: 62px; border-radius: 50%; background: var(--vm-g-brand); display: flex; align-items: center; justify-content: center; color: #fff; box-shadow: var(--vm-glow-v); animation: vmFloat 4s ease-in-out infinite; }
.lock .ring :deep(svg) { width: 28px; height: 28px; }
.lock b { font-family: var(--vm-font-display); font-size: 15px; }
.lock p { font-size: 12.5px; color: var(--vm-ink-soft); max-width: 30ch; }
.lock .mini { border: none; cursor: pointer; padding: 9px 16px; border-radius: 11px; background: var(--vm-g-brand); color: #fff; font: 700 12px var(--vm-font-sans); box-shadow: var(--vm-glow-v); }
.lock .mini:disabled { opacity: .6; }

/* ===== Restyle the existing builder canvas (presentational only, via :deep) ===== */
.builder-host { height: 100%; }
/* Solid readable surface (NOT transparent) so white section cards always pop. */
.builder-host :deep(.agent-builder) { background: transparent; }
.builder-host :deep(.agent-builder > .flex-1) {
  background:
    radial-gradient(120% 80% at 0% 0%, rgba(199,182,255,.16), transparent 60%),
    radial-gradient(120% 80% at 100% 0%, rgba(255,182,217,.14), transparent 60%),
    var(--vm-bg) !important;
}
.builder-host :deep(.vm-anchor) { scroll-margin-top: 16px; }

/* widen the canvas a touch + comfortable rhythm */
.builder-host :deep(.agent-builder .max-w-3xl) { max-width: 760px !important; }

/* section cards → solid white, rounded, clear shadow, hover lift */
.builder-host :deep(.agent-builder .bg-white.rounded-xl) {
  background: #ffffff !important;
  border-radius: 22px !important;
  border: 1px solid var(--vm-line) !important;
  box-shadow: var(--vm-shadow-m) !important;
  padding: 22px !important;
  transition: box-shadow .3s var(--vm-ease), transform .3s var(--vm-ease);
}
.builder-host :deep(.agent-builder .bg-white.rounded-xl:hover) {
  box-shadow: var(--vm-shadow-l) !important;
}

/* section header number badge → gradient tile */
.builder-host :deep(.agent-builder .w-7.h-7.rounded-lg) {
  width: 40px !important; height: 40px !important;
  border-radius: 13px !important;
  font-size: 15px !important;
  box-shadow: var(--vm-shadow-m);
}
.builder-host :deep(.agent-builder .w-7.h-7.bg-indigo-600) { background: var(--vm-g-brand) !important; }
.builder-host :deep(.agent-builder .w-7.h-7.bg-emerald-600) { background: var(--vm-g-teal) !important; }
.builder-host :deep(.agent-builder .w-7.h-7.bg-violet-600) { background: linear-gradient(120deg,#0EA5E9,#7C3AED) !important; }

/* inputs / textareas / selects → rounded + sky focus ring */
.builder-host :deep(.agent-builder input[type="text"]),
.builder-host :deep(.agent-builder input:not([type])),
.builder-host :deep(.agent-builder textarea),
.builder-host :deep(.agent-builder select) {
  border-radius: 12px !important;
  transition: box-shadow .2s var(--vm-ease2), border-color .2s;
}
.builder-host :deep(.agent-builder input[type="text"]:focus),
.builder-host :deep(.agent-builder textarea:focus),
.builder-host :deep(.agent-builder select:focus) {
  border-color: var(--vm-sky) !important;
  box-shadow: 0 0 0 4px rgba(14, 165, 233, .16) !important;
}
</style>
