<template>
  <div class="cfg-root">
    <div v-if="loading" class="cfg-loading">
      <span class="spin"></span> Loading agentâ€¦
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
        <div class="bar-right">
          <button class="gbtn" @click="showWorkspace = true"><Icon icon="lucide:folder" /> Workspace</button>
          <button v-if="agent && agent.id" class="gbtn violet" @click="showDeploy = true"><Icon icon="lucide:rocket" /> Deploy</button>
          <div class="save-wrap" v-if="!wizard">
            <div class="save-split" :class="needsPublish ? 'is-dirty' : 'is-ok'">
              <button class="save-main" :disabled="saving" @click="triggerSave">
                <Icon v-if="!saving" :icon="needsPublish ? 'lucide:upload-cloud' : 'lucide:check-circle-2'" />
                {{ saving ? 'Savingâ€¦' : (needsPublish ? 'Save & Publish' : 'Saved & Published') }}
              </button>
              <button class="save-caret" :disabled="saving" @click="showSaveMenu = !showSaveMenu"><Icon icon="lucide:chevron-down" /></button>
            </div>
            <div v-if="showSaveMenu" class="save-menu" @click.stop>
              <button @click="triggerSave(); showSaveMenu = false"><Icon icon="lucide:upload-cloud" /> Save &amp; Publish</button>
              <button @click="triggerSaveDraft(); showSaveMenu = false"><Icon icon="lucide:file-text" /> Save as draft</button>
              <div class="div"></div>
              <button :disabled="!(agent && agent.id)" @click="saveAsTemplate(); showSaveMenu = false"><Icon icon="lucide:layout-template" /> Save as template</button>
              <button :disabled="!(agent && agent.id)" @click="showDeploy = true; showSaveMenu = false"><Icon icon="lucide:share-2" /> Deploy &amp; Shareâ€¦</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ===================== Step rail (only in the advanced/legacy editor â€” the create flow has no stepper) ===================== -->
      <div v-if="!wizard" class="rail vm-scroll" data-tour="agent-rail">
        <button
          v-for="(s, i) in railSteps"
          :key="s.id"
          class="step"
          :class="{ cur: wizard ? i === wizardIndex : activeStep === s.id, done: wizard ? i < wizardIndex : i < activeIndex }"
          :disabled="wizard && i > maxReached"
          @click="wizard ? goToStep(i) : scrollToSection(s.id)"
        >
          <span class="n"><Icon v-if="(wizard ? i < wizardIndex : i < activeIndex)" icon="lucide:check" /><template v-else>{{ s.n }}</template></span>
          {{ s.label }}
        </button>
      </div>

      <!-- ===================== Body ===================== -->
      <div class="cfg-body" :class="{ wizard }">
        <div class="builder-col">
          <!-- Step 0 â€” blank vs template chooser -->
          <div v-if="atStart" class="start-host vm-scroll">
            <AgentStartStep :creating-id="creatingId" @blank="nextStep" @use-template="useTemplate" />
          </div>

          <!-- Step 1 â€” agent basics (name / purpose / workspace â†’ Create Agent) -->
          <div v-else-if="wizard" class="start-host vm-scroll">
            <AgentBasicsStep :agent="agent" :creating="saving" @create="createFromBasics" @back="prevStep" />
          </div>

          <!-- Editor (existing agent) â€” full builder with scroll-spy -->
          <div v-else ref="builderHost" class="builder-host">
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
        </div>

        <div class="dock" v-if="!wizard">
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
            <button class="mini" :disabled="saving" @click="triggerSave">{{ saving ? 'Savingâ€¦' : 'Save & Publish' }}</button>
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
import AgentStartStep from '../components/agent-builder/AgentStartStep.vue'
import AgentBasicsStep from '../components/agent-builder/AgentBasicsStep.vue'
import AgentEmulator from '../components/AgentEmulator.vue'
import AgentWorkspacePanel from '../components/AgentWorkspacePanel.vue'
import DeploySettings from '../components/agent/DeploySettings.vue'

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
// always needs publishing. The live Emulator stays disabled â€” and Save & Publish stays red â€” until
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
  { id: 'sec-workflows', n: 4, label: 'Workflows' },
  { id: 'sec-scripts', n: 5, label: 'Scripts' },
  { id: 'sec-data', n: 6, label: 'Data' },
  { id: 'sec-memory', n: 7, label: 'Memory' },
  { id: 'sec-flow', n: 8, label: 'Flow' },
  { id: 'sec-tools', n: 9, label: 'Tools' },
  { id: 'sec-autonomy', n: 10, label: 'Autonomy' },
  { id: 'sec-advanced', n: 11, label: 'Advanced' },
]
const activeStep = ref('sec-general')
const activeIndex = computed(() => Math.max(0, steps.findIndex(s => s.id === activeStep.value)))

/* ===================== Guided wizard (NEW agent only) =====================
   The 7 builder sections are flat siblings in AgentBuilder's canvas. While creating a
   new agent we show ONE grouped step at a time (Back/Next + validation); once the agent
   is saved (has an id) we fall back to the free-scroll + scroll-spy editor. AgentBuilder
   itself is untouched â€” we just toggle the visibility of its top-level section nodes. */
const isNew = computed(() => !(agent.value && agent.value.id))
const wizard = computed(() => isNew.value)

// Create flow = two custom steps. Deep configuration happens AFTER creation, in the editor
// (the agent overview â†’ Configure), so the create wizard stays minimal.
const wizardSteps = [
  { id: 'start', n: 1, label: 'Get Started', sections: [],
    title: 'Create a new agent', help: 'Start from scratch or use a template to build your agent.' },
  { id: 'basics', n: 2, label: 'Create Agent', sections: ['sec-general'],
    title: 'Agent basics', help: 'Give your agent a name and purpose to get started.' },
]
const wizardIndex = ref(0)
// Step 0 ("Start") shows the blank-vs-template chooser instead of the builder sections.
const atStart = computed(() => wizard.value && wizardIndex.value === 0)
const creatingId = ref(null)
const maxReached = ref(0)
const curWizard = computed(() => wizardSteps[wizardIndex.value] || wizardSteps[0])
const railSteps = computed(() => (wizard.value ? wizardSteps : steps))
const canNext = computed(() => {
  if (curWizard.value.id === 'basics') return !!(agent.value && (agent.value.name || '').trim())
  return true
})

// The builder's 7 sections (#sec-*) are nested at MIXED depths (e.g. #sec-prompt lives inside
// the General card), so they're not a flat sibling partition. To show one step we: assign every
// node its "owning section" in document order, then add the `wiz-hidden` CLASS to the top-most
// subtrees that contain NO active-section content. We never touch inline `display`, so the
// builder's own v-show fields keep working.
function builderRoot() {
  const host = builderHost.value
  const scroller = host && host.querySelector('.agent-builder > .flex-1')
  return scroller ? scroller.firstElementChild : null   // .max-w-3xl.space-y-5
}

function clearWizHidden(root) {
  root.querySelectorAll('.wiz-hidden').forEach(el => el.classList.remove('wiz-hidden'))
  root.classList.remove('wiz-hidden')
}

function applyWizardStep(retry = 0) {
  // The create wizard no longer steps through AgentBuilder sections (Start + Basics are custom
  // components), so section hiding is a no-op now. Kept for the watchers below.
  return
  // eslint-disable-next-line no-unreachable
  if (!wizard.value || wizardIndex.value === 0) return
  const root = builderRoot()
  if (!root) { if (retry < 6) setTimeout(() => applyWizardStep(retry + 1), 80); return }
  clearWizHidden(root)

  const active = new Set(curWizard.value.sections)
  const all = [root, ...root.querySelectorAll('*')]   // document order
  let cur = null
  for (const el of all) {
    if (el.id && el.id.indexOf('sec-') === 0) cur = el.id
    el.__sec = cur
  }
  // bottom-up: an element "has active content" if it (or any descendant) is owned by an active
  // section, or it sits before the first anchor (chrome â†’ always shown).
  const hasActive = new Map()
  for (let i = all.length - 1; i >= 0; i--) {
    const el = all[i]
    let h = (el.__sec === null) || active.has(el.__sec)
    if (!h) for (const c of el.children) { if (hasActive.get(c)) { h = true; break } }
    hasActive.set(el, h)
  }
  // top-down: hide the highest fully-inactive subtrees
  ;(function walk(el) {
    for (const c of el.children) {
      if (!hasActive.get(c)) c.classList.add('wiz-hidden')
      else walk(c)
    }
  })(root)

  const scroller = builderHost.value && builderHost.value.querySelector('.agent-builder > .flex-1')
  if (scroller) scroller.scrollTop = 0
}

function resetSections() {
  const root = builderRoot()
  if (root) clearWizHidden(root)
}

function goToStep(i) {
  if (i < 0 || i >= wizardSteps.length || i > maxReached.value) return
  wizardIndex.value = i
}
function nextStep() {
  if (!canNext.value) { notify.warning('Please give your agent a name first.'); return }
  if (wizardIndex.value < wizardSteps.length - 1) {
    wizardIndex.value++
    maxReached.value = Math.max(maxReached.value, wizardIndex.value)
  }
}
function prevStep() { if (wizardIndex.value > 0) wizardIndex.value-- }
function createFromWizard() {
  if (!canNext.value) { notify.warning('Please give your agent a name first.'); return }
  triggerSaveDraft()   // creates the agent (no publish) â†’ navigates to the editor
}

// Basics step â†’ "Create Agent": create the agent (name/purpose), then land on the agent overview.
async function createFromBasics() {
  if (!(agent.value && (agent.value.name || '').trim())) {
    notify.warning('Please give your agent a name first.')
    return
  }
  try {
    saving.value = true
    const res = await api.post('/agents/', agent.value)
    const id = res.data && res.data.id
    if (id) {
      notify.success('Agent created')
      router.push(`/dashboard/agents/${id}/editor`)   // â†’ new editor (Define Brain, Screen 14)
    } else {
      notify.error('Could not create the agent')
    }
  } catch (e) {
    notify.error('Could not create the agent: ' + extractApiError(e))
  } finally {
    saving.value = false
  }
}

// Start step â†’ "use template": clone the builtin template into a new agent, open it in the editor.
async function useTemplate(t) {
  if (creatingId.value) return
  creatingId.value = t.id
  try {
    const res = await api.createAgentFromTemplate({ template_id: t.id })
    const id = res.data && res.data.id
    if (id) {
      notify.success(`Created from â€œ${t.name}â€`)
      router.push(`/dashboard/agents/${id}/editor`)
    } else {
      notify.error('Could not create from template')
    }
  } catch (e) {
    notify.error('Could not create from template: ' + extractApiError(e))
  } finally {
    creatingId.value = null
  }
}

watch(wizardIndex, () => nextTick(applyWizardStep))
watch(wizard, (w) => nextTick(() => {
  if (w) { applyWizardStep() } else { resetSections(); setupSpy() }
}))

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
// Save as draft: persist edits only â€” does NOT publish (the live/public agent keeps its snapshot).
function triggerSaveDraft() {
  publishAfterSave.value = false
  if (builderRef.value && builderRef.value.save) builderRef.value.save()
}

async function saveAsTemplate() {
  if (!(agent.value && agent.value.id)) return
  try {
    await api.saveAgentAsTemplate(agent.value.id, { name: `${agent.value.name} Template` })
    notify.success('Saved as template â€” available when creating a new agent')
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
      .join(' Â· ')
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
    tool_delivery_mode: 'default',
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
  if (wizard.value) {
    wizardIndex.value = 0
    maxReached.value = 0
    applyWizardStep()
  } else {
    setupSpy()
  }
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
      router.replace(`/dashboard/agents/${res.data.id}/editor`)
    }
    let a = res.data
    // Save & Publish: snapshot + status=published on the backend (powers public share/runtime).
    if (publishAfterSave.value && a.id) {
      try {
        const pres = await api.publishAgent(a.id)
        if (pres.data) a = pres.data
      } catch (e) { /* non-fatal â€” the save itself succeeded */ }
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
/* ===== Aadml â€” flat, clean light wizard (design.md Â§3). No glass/blur, soft shadows. ===== */
.cfg-root { height: 100%; font-family: var(--vm-font-sans); color: var(--vm-ink); background: var(--vm-bg); }
.cfg { display: flex; flex-direction: column; height: 100%; }
.cfg-loading { display: flex; align-items: center; justify-content: center; gap: 10px; height: 100%; color: var(--vm-ink-faint); font-size: 14px; }
.spin { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--vm-line-2); border-top-color: var(--vm-primary); animation: vmSpin .8s linear infinite; }
@keyframes vmSpin { to { transform: rotate(360deg); } }

/* top bar â€” flat white */
.cfg-bar { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; padding: 13px 24px; background: var(--vm-surface); border-bottom: 1px solid var(--vm-border); flex: 0 0 auto; }
.cfg-switch { position: absolute; left: 50%; transform: translateX(-50%); display: none; }
@media (min-width: 1280px) { .cfg-switch { display: inline-flex; } }
.bar-left { display: flex; align-items: center; gap: 11px; min-width: 0; }
.back { display: inline-flex; align-items: center; gap: 4px; border: none; background: transparent; cursor: pointer; font: 600 13px var(--vm-font-sans); color: var(--vm-primary); }
.back:hover { color: var(--vm-primary-d); }
.back :deep(svg) { width: 16px; height: 16px; }
.sep { color: var(--vm-ink-faint); }
.nm { font-size: 18px; font-weight: 700; letter-spacing: -.01em; color: var(--vm-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pill { display: inline-flex; align-items: center; gap: 6px; font: 600 11.5px var(--vm-font-sans); padding: 4px 10px; border-radius: 999px; }
.pill.dirty { color: #B54708; background: #FEF3E2; }
.pill.dirty .d { width: 7px; height: 7px; border-radius: 50%; background: var(--vm-warning); }
.pill.ok { color: #027A48; background: #E6F7EE; }
.pill :deep(svg) { width: 13px; height: 13px; }

.bar-right { display: flex; align-items: center; gap: 9px; }
.gbtn { display: inline-flex; align-items: center; gap: 7px; border: 1px solid var(--vm-border); background: var(--vm-surface); cursor: pointer; padding: 9px 14px; border-radius: 11px; font: 600 13px var(--vm-font-sans); color: var(--vm-ink-soft); transition: .15s var(--vm-ease2); }
.gbtn:hover { border-color: #cdd5e0; color: var(--vm-ink); }
.gbtn.violet { color: var(--vm-primary); border-color: var(--vm-primary-soft); }
.gbtn :deep(svg) { width: 15px; height: 15px; }

.save-wrap { position: relative; }
.save-split { display: flex; border-radius: 11px; overflow: hidden; box-shadow: 0 1px 2px rgba(21,94,239,.25); }
.save-split.is-ok { box-shadow: 0 1px 2px rgba(18,183,106,.25); }
.save-main, .save-caret { border: none; cursor: pointer; color: #fff; font: 600 13.5px var(--vm-font-sans); display: flex; align-items: center; gap: 8px; transition: filter .15s; }
.save-split.is-dirty .save-main, .save-split.is-dirty .save-caret { background: var(--vm-primary); }
.save-split.is-ok .save-main, .save-split.is-ok .save-caret { background: var(--vm-success); }
.save-main { padding: 10px 16px; }
.save-main:hover, .save-caret:hover { filter: brightness(.96); }
.save-main:disabled { opacity: .6; cursor: default; }
.save-caret { padding: 10px 9px; border-left: 1px solid rgba(255, 255, 255, .25); }
.save-main :deep(svg) { width: 15px; height: 15px; } .save-caret :deep(svg) { width: 15px; height: 15px; }
.save-menu { position: absolute; right: 0; top: calc(100% + 8px); width: 230px; background: var(--vm-surface); border: 1px solid var(--vm-border); border-radius: 13px; box-shadow: var(--vm-shadow-l); padding: 6px; z-index: 40; }
.save-menu button { width: 100%; display: flex; align-items: center; gap: 10px; padding: 9px 11px; border: none; background: transparent; border-radius: 9px; font: 600 13px var(--vm-font-sans); color: var(--vm-ink-soft); cursor: pointer; }
.save-menu button:hover { background: var(--vm-surface-soft); color: var(--vm-ink); }
.save-menu button:disabled { opacity: .4; cursor: default; }
.save-menu button :deep(svg) { width: 15px; height: 15px; }
.save-menu .div { height: 1px; background: var(--vm-border); margin: 5px 0; }

/* wizard rail â€” flat connected stepper */
.rail { display: flex; gap: 8px; padding: 14px 24px; overflow-x: auto; flex: 0 0 auto; border-bottom: 1px solid var(--vm-border); background: var(--vm-surface); }
.rail::-webkit-scrollbar { height: 0; }
.step { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; border: 1px solid var(--vm-border); background: var(--vm-surface); cursor: pointer; padding: 7px 14px; border-radius: 10px; font: 600 12.5px var(--vm-font-sans); color: var(--vm-ink-faint); transition: .15s var(--vm-ease2); }
.step:hover:not(:disabled) { border-color: #cdd5e0; color: var(--vm-ink-soft); }
.step:disabled { opacity: .5; cursor: not-allowed; }
.step .n { width: 20px; height: 20px; border-radius: 50%; background: var(--vm-surface-soft); color: var(--vm-ink-faint); font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.step .n :deep(svg) { width: 12px; height: 12px; }
.step.done { color: #027A48; border-color: #ABEFC6; background: #E6F7EE; }
.step.done .n { background: var(--vm-success); color: #fff; }
.step.cur { color: var(--vm-primary); border-color: var(--vm-primary); background: var(--vm-primary-soft); }
.step.cur .n { background: var(--vm-primary); color: #fff; }

/* body */
.cfg-body { flex: 1; min-height: 0; display: flex; overflow: hidden; }
.builder-col { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; }
.builder-host { flex: 1; min-width: 0; min-height: 0; }
/* Start step (chooser) â€” scrolls within the builder column, flat light canvas */
.start-host { flex: 1; min-width: 0; min-height: 0; overflow-y: auto; background: var(--vm-bg); padding-top: 6px; }

/* Wizard step heading (between rail and builder) */
.wiz-head { padding: 18px 24px 2px; max-width: 820px; width: 100%; margin: 0 auto; }
.wiz-step { font: 700 11px var(--vm-font-sans); letter-spacing: .08em; text-transform: uppercase; color: var(--vm-primary); }
.wiz-title { font-size: 24px; font-weight: 700; letter-spacing: -.01em; color: var(--vm-ink); margin: 5px 0 0; }
.wiz-help { color: var(--vm-ink-soft); font-size: 13.5px; margin: 4px 0 0; }

/* Wizard nav bar (sticky under the builder) */
.wiz-nav { flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 13px 24px; border-top: 1px solid var(--vm-border); background: var(--vm-surface); }
.wiz-back, .wiz-next { display: inline-flex; align-items: center; gap: 8px; font: 600 14px var(--vm-font-sans); padding: 11px 22px; border-radius: 11px; cursor: pointer; border: 1px solid var(--vm-border); background: var(--vm-surface); color: var(--vm-ink-soft); transition: .15s var(--vm-ease2); }
.wiz-back:hover:not(:disabled) { color: var(--vm-ink); border-color: #cdd5e0; }
.wiz-back:disabled { opacity: .45; cursor: not-allowed; }
.wiz-count { font: 600 12px var(--vm-font-sans); color: var(--vm-ink-faint); }
.wiz-next { background: var(--vm-primary); color: #fff; border: none; box-shadow: 0 1px 2px rgba(21,94,239,.25); }
.wiz-next:hover:not(:disabled) { background: var(--vm-primary-d); }
.wiz-next:disabled { opacity: .5; cursor: not-allowed; box-shadow: none; }
.wiz-back :deep(svg), .wiz-next :deep(svg) { width: 16px; height: 16px; }
.dock { width: 420px; flex: 0 0 auto; position: relative; border-left: 1px solid var(--vm-border); background: var(--vm-surface); }
@media (max-width: 1180px) { .dock { width: 360px; } }
@media (max-width: 900px) { .cfg-body { flex-direction: column; } .dock { width: 100%; height: 60vh; border-left: none; border-top: 1px solid var(--vm-border); } }

/* lock overlay */
.lock { position: absolute; inset: 0; z-index: 10; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center; padding: 24px; background: rgba(246, 248, 252, .85); }
.lock .ring { width: 60px; height: 60px; border-radius: 50%; background: var(--vm-primary-soft); display: flex; align-items: center; justify-content: center; color: var(--vm-primary); }
.lock .ring :deep(svg) { width: 26px; height: 26px; }
.lock b { font-size: 15px; font-weight: 700; color: var(--vm-ink); }
.lock p { font-size: 12.5px; color: var(--vm-ink-soft); max-width: 30ch; }
.lock .mini { border: none; cursor: pointer; padding: 9px 16px; border-radius: 10px; background: var(--vm-primary); color: #fff; font: 600 12px var(--vm-font-sans); }
.lock .mini:hover { background: var(--vm-primary-d); }
.lock .mini:disabled { opacity: .6; }

/* ===== Restyle the inner builder canvas (presentational only, via :deep) ===== */
.builder-host { height: 100%; }
.builder-host :deep(.agent-builder) { background: transparent; }
/* Flat light canvas â€” no radial gradients. */
.builder-host :deep(.agent-builder > .flex-1) { background: var(--vm-bg) !important; }
.builder-host :deep(.vm-anchor) { scroll-margin-top: 16px; }
.builder-host :deep(.wiz-hidden) { display: none !important; }

/* comfortable canvas width */
.builder-host :deep(.agent-builder .max-w-3xl) { max-width: 780px !important; }

/* section cards â†’ solid white, soft border + shadow (flat) */
.builder-host :deep(.agent-builder .bg-white.rounded-xl) {
  background: var(--vm-surface) !important;
  border-radius: 16px !important;
  border: 1px solid var(--vm-border) !important;
  box-shadow: var(--vm-shadow-s) !important;
  padding: 22px !important;
}

/* section header number badge â†’ soft tinted square (flat, not gradient) */
.builder-host :deep(.agent-builder .w-7.h-7.rounded-lg) {
  width: 38px !important; height: 38px !important;
  border-radius: 11px !important;
  font-size: 14px !important;
  box-shadow: none !important;
}
.builder-host :deep(.agent-builder .w-7.h-7.bg-indigo-600) { background: var(--vm-primary-soft) !important; color: var(--vm-primary) !important; }
.builder-host :deep(.agent-builder .w-7.h-7.bg-emerald-600) { background: #E3F8F4 !important; color: #0E9384 !important; }
.builder-host :deep(.agent-builder .w-7.h-7.bg-violet-600) { background: var(--vm-primary-soft) !important; color: var(--vm-primary) !important; }

/* inputs / textareas / selects â†’ rounded + blue focus ring */
.builder-host :deep(.agent-builder input[type="text"]),
.builder-host :deep(.agent-builder input:not([type])),
.builder-host :deep(.agent-builder textarea),
.builder-host :deep(.agent-builder select) {
  border-radius: 10px !important;
  transition: box-shadow .15s var(--vm-ease2), border-color .15s;
}
.builder-host :deep(.agent-builder input[type="text"]:focus),
.builder-host :deep(.agent-builder textarea:focus),
.builder-host :deep(.agent-builder select:focus) {
  border-color: var(--vm-primary) !important;
  box-shadow: 0 0 0 3px var(--vm-primary-soft) !important;
}

/* ===== Remap legacy indigo/violet/purple accents â†’ Aadml blue (presentational) =====
   AgentBuilder.vue is heavy on Tailwind indigo/violet utilities (the old purple-ish accent).
   Rather than touch 3000 lines, retarget those utility classes to the v2 blue tokens. */
.builder-host :deep(.bg-indigo-600), .builder-host :deep(.bg-indigo-700),
.builder-host :deep(.bg-violet-600), .builder-host :deep(.bg-violet-700) { background-color: var(--vm-primary) !important; }
.builder-host :deep(.hover\:bg-indigo-700:hover), .builder-host :deep(.hover\:bg-violet-700:hover) { background-color: var(--vm-primary-d) !important; }
.builder-host :deep(.bg-indigo-100), .builder-host :deep(.bg-indigo-50),
.builder-host :deep(.bg-violet-100), .builder-host :deep(.bg-violet-200),
.builder-host :deep(.bg-purple-100) { background-color: var(--vm-primary-soft) !important; }
.builder-host :deep(.text-indigo-500), .builder-host :deep(.text-indigo-600), .builder-host :deep(.text-indigo-700),
.builder-host :deep(.text-indigo-800), .builder-host :deep(.text-violet-500), .builder-host :deep(.text-violet-600),
.builder-host :deep(.text-violet-700), .builder-host :deep(.text-purple-700) { color: var(--vm-primary) !important; }
.builder-host :deep(.border-indigo-100), .builder-host :deep(.border-indigo-200), .builder-host :deep(.border-indigo-300),
.builder-host :deep(.border-indigo-500), .builder-host :deep(.border-indigo-600),
.builder-host :deep(.border-violet-200), .builder-host :deep(.border-violet-300) { border-color: var(--vm-primary-soft) !important; }
.builder-host :deep(.ring-indigo-300), .builder-host :deep(.ring-indigo-500),
.builder-host :deep(.ring-violet-500) { --tw-ring-color: var(--vm-primary) !important; }
</style>

