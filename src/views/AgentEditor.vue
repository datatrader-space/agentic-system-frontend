<template>
  <div class="flex h-full flex-col bg-[#F8FAFC] font-[Inter,system-ui,sans-serif]">
    <div v-if="loading" class="flex h-full items-center justify-center text-sm text-[#667085]">Loading agent…</div>

    <template v-else>
      <!-- Editor header -->
      <header class="border-b border-[#E5E7EB] bg-white px-6 pt-3 pb-4">
        <div class="mb-2 flex items-center gap-1.5 text-[12.5px] text-[#667085]">
          <button class="font-medium text-[#475569] hover:text-[#2563EB]"
                  @click="go(shellBase === '/admin-dashboard' ? '/admin-dashboard/builtin-agents' : '/dashboard/agents')">Agents</button>
          <ChevronRight :size="13" :stroke-width="2" class="text-[#98A2B3]" />
          <span class="font-semibold text-[#344054]">{{ agent.name || 'New Agent' }}</span>
          <Pencil :size="13" :stroke-width="2" class="cursor-pointer text-[#98A2B3] hover:text-[#2563EB]" />
        </div>

        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="flex items-center gap-2.5">
            <h1 class="truncate text-[24px] font-bold tracking-tight text-[#0F172A]">{{ agent.name || 'New Agent' }}</h1>
            <span v-if="agent.publish_status === 'published'" class="inline-flex items-center gap-1.5 rounded-full bg-[#E6F7EE] px-2.5 py-0.5 text-[11.5px] font-semibold text-[#027A48]">
              <span class="h-1.5 w-1.5 rounded-full bg-[#12B76A]" /> Published
            </span>
            <span v-else class="inline-flex items-center gap-1.5 rounded-full bg-[#FEF3E2] px-2.5 py-0.5 text-[11.5px] font-semibold text-[#B54708]">Draft</span>
          </div>

          <div class="flex flex-col items-end gap-1">
            <div class="flex items-center gap-2">
              <button class="btn-icon"><MoreHorizontal :size="16" :stroke-width="2" /></button>
              <button v-if="agent.id" class="btn-secondary" :disabled="saving" @click="openChat">
                <MessageCircle :size="15" :stroke-width="2" /> Chat
              </button>
              <button v-if="agent.id" class="btn-secondary" :disabled="pausing" @click="togglePause">
                <component :is="agent.is_paused ? Play : PauseIcon" :size="15" :stroke-width="2" />
                {{ pausing ? '…' : (agent.is_paused ? 'Resume' : 'Pause') }}
              </button>
              <button class="btn-secondary" @click="save"><Save :size="15" :stroke-width="2" /> {{ saving ? 'Saving…' : 'Save' }}</button>
              <button class="btn-primary" @click="saveAndPublish"><Rocket :size="15" :stroke-width="2" /> Configure / Publish</button>
            </div>
            <span v-if="lastSaved" class="text-[11.5px] text-[#98A2B3]">Last saved {{ lastSaved }}</span>
          </div>
        </div>
      </header>

      <!-- Paused banner: a paused agent refuses to start new runs until resumed. -->
      <div v-if="agent.is_paused" class="flex items-center gap-2.5 border-b border-[#FDE68A] bg-[#FFFBEB] px-6 py-2.5 text-[13px] text-[#92400E]">
        <PauseIcon :size="16" :stroke-width="2" />
        <span><strong>This agent is paused</strong> and won't start new runs.<span v-if="agent.paused_reason"> Reason: {{ agent.paused_reason }}.</span></span>
        <button class="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-[#B45309] px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60" :disabled="pausing" @click="togglePause">
          <Play :size="13" :stroke-width="2" /> Resume
        </button>
      </div>

      <!-- Stepper (dashed connectors) -->
      <nav class="flex items-center gap-2 overflow-x-auto border-b border-[#E5E7EB] bg-white px-6 py-4">
        <template v-for="(s, i) in steps" :key="s.key">
          <button class="flex shrink-0 items-center gap-2.5 text-left" @click="openStep(s.key)">
            <span class="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-bold transition"
                  :class="s.key === step ? 'bg-[#2563EB] text-white' : (stepDone(i) ? 'bg-[#E6F7EE] text-[#12B76A]' : 'bg-white text-[#667085] ring-1 ring-[#E5E7EB]')">{{ s.n }}</span>
            <span class="leading-tight">
              <span class="block text-[13px] font-semibold" :class="s.key === step ? 'text-[#2563EB]' : 'text-[#0F172A]'">{{ s.title }}</span>
              <span class="block text-[11px] text-[#667085]">{{ s.sub }}</span>
            </span>
          </button>
          <span v-if="i < steps.length - 1" class="mx-1 h-px min-w-[24px] flex-1 border-t border-dashed border-[#D0D5DD]" />
        </template>
      </nav>

      <!-- Body — keyed on `step` so Vue always remounts the active step. Without this the heavy
           v-if/v-else-if chain can skip a patch when the async save() reassigns `agent` mid-switch,
           leaving the previous screen on-screen (the intermittent "screen didn't change" bug). -->
      <div :key="step" class="min-h-0 flex-1 overflow-y-auto py-5">
        <AgentIdentityStep v-if="step === 'identity'" :agent="agent" :is-new="isNew" />
        <DefineBrainStep v-else-if="step === 'brain'" :agent="agent" />
        <KnowledgeToolsStep v-else-if="step === 'tools'" :agent="agent" @saved="mergeAgent" />
        <SubAgentsStep v-else-if="step === 'team'" :agent="agent" @saved="mergeAgent" />
        <SkillsStep v-else-if="step === 'skills'" :agent="agent" @saved="mergeAgent" />
        <CredentialsStep v-else-if="step === 'credentials'" :agent="agent" />
        <AutonomySafetyStep v-else-if="step === 'autonomy'" :agent="agent" @open-step="openStep" />
        <ScopeAssistantStep v-else-if="step === 'scope'" :agent="agent" />
        <TestPublishMonitorStep v-else-if="step === 'final'" :agent="agent" :save-first="flushPendingEdits" @published="mergeAgent" />
        <div v-else class="mx-auto max-w-3xl px-8 py-10 text-center">
          <div class="rounded-2xl border border-dashed border-[#E5E7EB] bg-white p-10">
            <p class="text-[15px] font-semibold text-[#0F172A]">{{ currentStep.title }}</p>
            <p class="mx-auto mt-1 max-w-md text-[13px] text-[#64748B]">This step is being redesigned next.</p>
          </div>
        </div>
      </div>

      <!-- Footer nav. Right padding clears the floating help button (fixed, 56px wide, 30px from the right):
           with px-6 it sat on top of the primary action and cut "Continue to Final" off (live test 2026-09-25). -->
      <footer v-if="!isFinalStep" class="flex items-center justify-between border-t border-[#E5E7EB] bg-white py-3 pl-6 pr-24">
        <button class="btn-secondary" :disabled="stepIndex === 0" @click="prev"><ArrowLeft :size="15" :stroke-width="2" /> Back</button>
        <div class="flex items-center gap-3">
          <button v-if="step === 'tools' || step === 'credentials'" class="btn-secondary" @click="next">Skip for now</button>
          <button v-if="stepIndex < steps.length - 1" class="btn-primary" @click="next">{{ nextLabel }} <ArrowRight :size="15" :stroke-width="2" /></button>
          <button v-else class="btn-primary" @click="saveAndPublish"><Rocket :size="15" :stroke-width="2" /> {{ agent.publish_status === 'published' ? 'Update' : 'Publish' }}</button>
        </div>
      </footer>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronRight, ChevronDown, ArrowLeft, ArrowRight, Save, Play, Pause as PauseIcon, Rocket, Pencil, MoreHorizontal, MessageCircle, UploadCloud } from 'lucide-vue-next'
import api from '../services/api'
import { notify } from '@/composables/useNotify'
import { changedFields, snapshot, withoutReadOnly, idListsFrom } from '../composables/agentDiff'
import DefineBrainStep from '../components/agent-editor/DefineBrainStep.vue'
import AgentIdentityStep from '../components/agent-editor/AgentIdentityStep.vue'
import KnowledgeToolsStep from '../components/agent-editor/KnowledgeToolsStep.vue'
import SubAgentsStep from '../components/agent-editor/SubAgentsStep.vue'
import SkillsStep from '../components/agent-editor/SkillsStep.vue'
import CredentialsStep from '../components/agent-editor/CredentialsStep.vue'
import AutonomySafetyStep from '../components/agent-editor/AutonomySafetyStep.vue'
import ScopeAssistantStep from '../components/agent-editor/ScopeAssistantStep.vue'
import TestPublishMonitorStep from '../components/agent-editor/TestPublishMonitorStep.vue'
import { ago } from '../components/dashboard/time'
import { provideEditorShell } from '../composables/editorShell'

const route = useRoute()
const router = useRouter()
const go = (to) => router.push(to)

// This editor is mounted in BOTH shells (/dashboard and /admin-dashboard). Every self-navigation
// stays inside the shell it was opened from, so an admin editing a system agent is never bounced
// into the user dashboard.
const shellBase = computed(() => (route.path.startsWith('/admin-dashboard') ? '/admin-dashboard' : '/dashboard'))
// The steps ask this where their links go (composables/editorShell.js) instead of assuming /dashboard.
provideEditorShell({
  isAdmin: computed(() => shellBase.value === '/admin-dashboard'),
  href: (to) => router.resolve(to).href,
})

const loading = ref(true)
const saving = ref(false)
let resaveQueued = false                 // trailing-save flag: re-save after an in-flight save finishes
const agent = ref({})
// What the server last confirmed for this agent. A save sends ONLY the fields that differ from it.
//
// It used to PATCH the whole object the editor loaded. The editor keeps that object in memory (it does not
// refetch an agent it already holds), so any field changed ELSEWHERE since — the run mode switched from the
// chat composer, above all — was written straight back to its old value by the next save here. A user
// switched their agent to Autonomous in chat and found it back on Manual (2026-09-17).
let serverCopy = {}
const step = ref('identity')

// One editor, two modes: "new" (no id yet — created on the first Continue/Save) and "edit".
const isNew = computed(() => !(agent.value && agent.value.id))
function blankAgent() {
  // canvas_mode is explicitly OFF for new agents — the per-message composer toggle still works when off;
  // the stored flag is only for headless-over-WS operation (see AutonomySafetyStep Canvas Mode card).
  return { name: '', description: '', tool_ids: [], prompt_mode: 'append', max_history_messages: 0,
           tool_delivery_mode: 'default', stream_reasoning: false, canvas_mode: false }
}

const isStaff = ref(false)
const BASE_STEPS = [
  { key: 'identity', title: 'Agent Identity', sub: 'Name, purpose & workspace' },
  { key: 'brain', title: 'Define Brain', sub: 'Behavior & instructions' },
  { key: 'tools', title: 'Knowledge & Tools', sub: 'Sources & capabilities' },
  { key: 'team', title: 'Team & Sub-Agents', sub: 'Delegate to your other agents' },
  { key: 'skills', title: 'Skills', sub: 'Playbooks & know-how' },
  { key: 'credentials', title: 'Credentials', sub: 'Vault & permissions' },
  { key: 'autonomy', title: 'Autonomy & Safety', sub: 'Controls & limits' },
  // Staff-only "Scope & Assistant" is spliced in here (before the final step).
  { key: 'final', title: 'Test, Publish & Monitor', sub: 'Validate & operate' },
]
// Insert the staff-only step before 'final', then number sequentially.
const steps = computed(() => {
  const out = BASE_STEPS.slice()
  if (isStaff.value) {
    out.splice(out.length - 1, 0, { key: 'scope', title: 'Scope & Assistant', sub: 'Grounding, built-in & assistant' })
  }
  return out.map((s, i) => ({ ...s, n: i + 1 }))
})
const stepIndex = computed(() => Math.max(0, steps.value.findIndex(s => s.key === step.value)))
const currentStep = computed(() => steps.value[stepIndex.value] || steps.value[0])
const isFinalStep = computed(() => step.value === 'final' || currentStep.value.key === 'final')
// The three steps that name where they lead take that name from the step that ACTUALLY comes next. They
// were hardcoded: leaving Knowledge & Tools said "Credentials" (Team is next), and leaving Autonomy said
// "Final" even for staff, whose next step is Scope.
const NEXT_NAMES = { team: 'Team', autonomy: 'Autonomy', scope: 'Scope', final: 'Final' }
const nextLabel = computed(() => {
  if (isNew.value && step.value === 'identity') return 'Create Agent'
  const nxt = steps.value[stepIndex.value + 1]
  if (nxt && ['tools', 'credentials', 'autonomy'].includes(step.value)) return `Continue to ${NEXT_NAMES[nxt.key] || nxt.title}`
  return 'Continue'
})
const stepDone = (i) => i < stepIndex.value
// New mode needs a name to create the draft. Asked by every path that would POST — Continue AND the
// header Save, which used to send the empty name and report only "Failed to save".
function missingName() {
  if (agent.value.id || (agent.value.name || '').trim()) return false
  notify.warning('Please name your agent first.')
  return true
}
// Stepper click. Every step after the first loads and saves against the agent's id (/agents/<id>/…), so
// before the agent exists opening one only produced requests to /agents/undefined/….
function openStep(key) {
  if (!agent.value.id && key !== steps.value[0].key) {
    notify.warning('Create the agent first — name it and press Create Agent.')
    return
  }
  step.value = key
}
async function next() {
  if (stepIndex.value >= steps.value.length - 1) return
  if (missingName()) return
  if (!agent.value.id) {
    // FIRST save must complete: we need the new draft's id before later steps can load/save against it.
    // The target step rides along in the replaced URL (see save), because replacing the route rebuilds
    // this component in the dashboard shell and a step set only here would be lost with it.
    const target = steps.value[stepIndex.value + 1].key
    const ok = await save({ thenStep: target })
    if (!ok) return
    step.value = target
    return
  }
  // Already created → advance the UI immediately and persist THIS step's changes in the background
  // (non-blocking, quiet — the header's "Last saved" reflects it). The trailing-save guard ensures rapid
  // Continue clicks don't drop edits.
  step.value = steps.value[stepIndex.value + 1].key
  save({ quiet: true })
}
function prev() { if (stepIndex.value > 0) step.value = steps.value[stepIndex.value - 1].key }
function applyQueryStep() {
  // A new agent (no id in the route) has only its first step — same rule as openStep.
  if (!route.params.id) return
  const q = String(route.query.step || '')
  if (q === 'test' || q === 'deploy' || q === 'publish') {
    step.value = 'final'
    return
  }
  const hit = steps.value.find(s => s.key === q)
  if (hit) step.value = hit.key
}

function mergeAgent(data) {
  // Child steps call this with what the SERVER returned (publish, rollback) or with exactly the keys
  // their own PATCH just changed (team, skills, knowledge attach), so it is confirmed state, not a
  // pending edit.
  if (data) {
    // A whole agent from the server carries the rows but never the write-only id lists. Derive the ones
    // it speaks for — a rollback that restored the tools must not leave the editor on the old tool_ids.
    const confirmed = { ...idListsFrom(data, { onlyReturned: true }), ...data }
    agent.value = { ...agent.value, ...confirmed }
    serverCopy = { ...serverCopy, ...snapshot(confirmed) }
  }
}

// Handed to the final step so ITS Publish button saves first, like the header's "Configure / Publish".
// save() does not run while another save is in flight — it queues a trailing one and answers false —
// and arriving on the final step with Continue starts exactly such a background save. Wait that out,
// or a quick Publish would be dropped without a word.
async function flushPendingEdits() {
  while (saving.value) await new Promise(r => setTimeout(r, 60))
  return save({ quiet: true })
}

// Header "Chat" — jump straight into a chat with THIS agent, pre-selected via ?agent=<id> exactly like
// the Agents library card's Chat button (no picker step). Pending edits are flushed first so the chat
// exercises the config that's on screen; a failed save keeps the user here with the error toast.
// Chat only exists in the user dashboard shell, so an admin editing a system agent lands there too.
async function openChat() {
  if (!agent.value.id || saving.value) return
  if (!(await save({ quiet: true }))) return
  router.push({ path: '/dashboard/chat/new', query: { agent: agent.value.id } })
}

const pausing = ref(false)
async function togglePause() {
  if (!agent.value.id || pausing.value) return
  pausing.value = true
  try {
    const wasPaused = agent.value.is_paused
    const { data } = wasPaused
      ? await api.unpauseAgent(agent.value.id)
      : await api.pauseAgent(agent.value.id, 'Paused from the editor')
    agent.value = { ...agent.value, ...data }
    serverCopy = { ...serverCopy, ...snapshot(data) }
    notify.success(wasPaused ? 'Agent resumed' : 'Agent paused — it won’t start new runs')
  } catch (e) { notify.error('Could not update pause state') }
  pausing.value = false
}

const lastSavedAt = ref(null)
const lastSaved = computed(() => (lastSavedAt.value ? ago(lastSavedAt.value) : ''))

async function load() {
  const id = route.params.id
  // New mode — no id yet: start from a blank draft (created on first Continue/Save).
  if (!id) {
    agent.value = blankAgent()
    lastSavedAt.value = null
    loading.value = false
    return
  }
  // Already holding this agent (e.g. just created + route replaced) — don't refetch/flash.
  if (agent.value && String(agent.value.id) === String(id)) {
    loading.value = false
    return
  }
  loading.value = true
  try {
    const res = await api.get(`/agents/${id}/`)
    const a = res.data || {}
    // Always derive tool_ids from the authoritative `tools` so a later PATCH preserves the real set
    // (never wipes it). The GET doesn't return tool_ids (write-only), so without this a save could send [].
    // The same for knowledge_source_ids / sub_agent_ids / skill_ids, and BEFORE the snapshot: their steps
    // used to derive them on mount, so merely opening Team or Skills made the draft differ from the server
    // copy and the next save re-sent a list nobody had touched.
    Object.assign(a, idListsFrom(a))
    agent.value = a
    serverCopy = snapshot(a)
    lastSavedAt.value = a.updated_at || null
  } catch (e) {
    notify.error('Failed to load agent')
  } finally {
    loading.value = false
  }
}

// Why a save was refused, in the server's words when it gave any: a duplicate name answers
// 400 {"name": ["An agent with this name already exists."]}, and "Failed to save" told the user nothing.
function saveErrorReason(e) {
  const d = e?.response?.data
  if (!d || typeof d !== 'object') return ''
  const first = (v) => (Array.isArray(v) ? v[0] : v)
  if (typeof first(d.name) === 'string') return first(d.name)
  if (typeof d.detail === 'string') return d.detail
  for (const [field, v] of Object.entries(d)) {
    const msg = first(v)
    if (typeof msg === 'string' && msg) return field === 'non_field_errors' ? msg : `${field}: ${msg}`
  }
  return ''
}

// A newly created agent moves from /agents/new to its own URL, carrying the step to open on.
function openAgentRoute(stepKey) {
  if (!agent.value.id) return
  router.replace({ path: `${shellBase.value}/agents/${agent.value.id}/editor`, query: { step: stepKey } })
}

// `thenStep` — the step to land on once a NEW agent has been created (Continue passes the next one).
// `holdRoute` — the caller moves to the new agent's URL itself, once it has finished (saveAndPublish).
async function save({ quiet = false, thenStep = null, holdRoute = false } = {}) {
  if (missingName()) return false
  // If a save is already in flight, queue a trailing one so the latest edits aren't lost (rapid Continue).
  if (saving.value) { resaveQueued = true; return false }
  saving.value = true
  try {
    let res
    if (agent.value.id) {
      // Only what differs from the server copy, and never a key the server only returns.
      const changes = withoutReadOnly(changedFields(agent.value, serverCopy))
      if (!Object.keys(changes).length) {
        lastSavedAt.value = new Date().toISOString()
        if (!quiet) notify.success('Saved')
        return true
      }
      res = await api.patch(`/agents/${agent.value.id}/`, changes)
      agent.value = { ...agent.value, ...res.data }
      serverCopy = snapshot(agent.value)
    } else {
      // First save in new mode → create. The POST goes without tool_ids and the tools follow in their own
      // PATCH. (The omission once protected the backend's default-tool assignment from being wiped by an
      // empty list. The backend assigns NO default tools on create any more, so all the omission did was
      // throw away the tools picked before the first save — a template's, above all — and then overwrite
      // the local list with the server's empty one.)
      const { tool_ids: pickedTools, ...payload } = agent.value
      res = await api.post('/agents/', withoutReadOnly(payload))
      let created = res.data || {}
      let toolsNotAdded = false
      if (created.id && Array.isArray(pickedTools) && pickedTools.length) {
        try {
          const patched = await api.patch(`/agents/${created.id}/`, { tool_ids: pickedTools })
          created = { ...created, ...patched.data }
        } catch (e) {
          // The agent exists; only its tools did not make it. Keep it, and adopt the server's tool list
          // rather than showing tools the agent does not have.
          toolsNotAdded = true
        }
      }
      // Adopt every id list from what the server holds, exactly as load() does.
      agent.value = { ...agent.value, ...created, ...idListsFrom(created) }
      serverCopy = snapshot(agent.value)
      if (toolsNotAdded) {
        notify.warning('The agent was created, but its tools could not be added. You can add them in Knowledge & Tools.', { timeout: 9000 })
      }
      // The step travels in the URL: the dashboard shell keys the routed view on route.path, so this
      // replace REBUILDS the editor, and the new one would otherwise open on step 1. With ?step= it opens
      // on the next step after "Create Agent", and stays on the current one after a plain Save — whether
      // or not the component is rebuilt.
      if (!holdRoute) openAgentRoute(thenStep || step.value)
    }
    lastSavedAt.value = new Date().toISOString()
    if (!quiet) notify.success('Saved')
    return true
  } catch (e) {
    const reason = saveErrorReason(e)
    notify.error(reason || 'Failed to save')
    return false
  } finally {
    saving.value = false
    if (resaveQueued) { resaveQueued = false; save({ quiet: true }) }  // flush the latest state
  }
}

async function saveAndPublish() {
  // A background save may be in flight (Continue starts one); save() would only queue behind it and
  // answer false, and this button would do nothing. Wait it out first.
  while (saving.value) await new Promise(r => setTimeout(r, 60))
  // On a NEW agent the create replaces the route, which rebuilds the editor; the rebuilt one loads the
  // agent as it is at that moment. So publish BEFORE moving to the agent's own URL — otherwise it loaded
  // the draft and showed "Draft" for an agent this very click had just published.
  const wasNew = !agent.value.id
  const ok = await save({ holdRoute: true })
  if (!ok) return
  try {
    const res = await api.publishAgent(agent.value.id)
    if (res.data) {
      agent.value = { ...agent.value, ...res.data }
      serverCopy = { ...serverCopy, ...snapshot(res.data) }
    }
    notify.success('Published')
  } catch (e) {
    notify.error('Failed to publish')
  }
  if (wasNew) openAgentRoute(step.value)
}

watch(() => route.params.id, load)
watch(() => route.query.step, applyQueryStep)
// The URL names the step on screen. It used to keep whatever ?step= the editor was opened with, so after
// moving on a refresh went back to that step (and a link to the step already named there did nothing).
// Only for a saved agent — a new one has no URL of its own yet; openAgentRoute gives it one.
watch(step, (key) => {
  if (!route.params.id || String(route.query.step || '') === key) return
  router.replace({ path: route.path, query: { ...route.query, step: key } })
})
// `?step=scope` names a step that exists only once the user is known to be staff, and the first
// applyQueryStep() runs before /auth/me has answered — so it found no such step and stayed on step 1.
// Apply it again when staff resolves (only for that step: anything else was already applied, and
// re-applying it could pull the user back from a step they have moved to since).
watch(isStaff, (staff) => { if (staff && String(route.query.step || '') === 'scope') applyQueryStep() })
onMounted(() => {
  applyQueryStep(); load()
  // Reveal the staff-only "Scope & Assistant" step for staff users. /auth/me returns { user: {...} }.
  api.getCurrentUser().then(({ data }) => { isStaff.value = !!(data?.user?.is_staff ?? data?.is_staff) }).catch(() => {})
})
</script>

<style scoped>
.btn-secondary { display: inline-flex; align-items: center; gap: 7px; border: 1px solid #E5E7EB; background: #fff; border-radius: 10px; padding: 8px 14px; font-size: 13px; font-weight: 600; color: #344054; cursor: pointer; transition: border-color .15s, color .15s; }
.btn-secondary:hover:not(:disabled) { border-color: #cdd5e0; color: #0F172A; }
.btn-secondary:disabled { opacity: .5; cursor: not-allowed; }
.btn-primary { display: inline-flex; align-items: center; gap: 7px; border: none; background: #2563EB; border-radius: 10px; padding: 9px 16px; font-size: 13px; font-weight: 600; color: #fff; cursor: pointer; box-shadow: 0 1px 2px rgba(37,99,235,.25); transition: background .15s; }
.btn-primary:hover { background: #1D4ED8; }
.btn-icon { display: grid; place-items: center; height: 36px; width: 36px; border: 1px solid #E5E7EB; background: #fff; border-radius: 10px; color: #475569; cursor: pointer; }
.btn-icon:hover { border-color: #cdd5e0; color: #0F172A; }
</style>
