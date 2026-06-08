<!--
  AgentModePicker — a compact "Modes" dropdown for the chat header (styled after the IDE Modes menu).
  Lets the user flip the agent between Manual / Auto Mode / Planning Mode right from the chat. The
  selection PERSISTS to the agent (PATCH /agents/:id/) so it sticks across every chat with that agent.
  Used by all four chat surfaces (new chat, emulator, old chat, playground).
-->
<template>
  <div class="amp" v-if="agentId">
    <button type="button" class="amp-btn" :class="{ 'amp-on': isAuto }" @click="open = !open" :title="label">
      <span class="amp-dot" :class="dotClass"></span>
      <span class="amp-label">{{ label }}</span>
      <svg class="amp-caret" :class="{ 'amp-caret-open': open }" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" clip-rule="evenodd"/></svg>
    </button>

    <div v-if="open" class="amp-menu" :class="placement === 'up' ? 'amp-menu-up' : 'amp-menu-down'" @click.stop>
      <div class="amp-head">Modes</div>
      <button v-for="opt in options" :key="opt.key" type="button" class="amp-item"
              :class="{ 'amp-item-active': opt.active }" :disabled="saving" @click="select(opt)">
        <span class="amp-item-icon">{{ opt.icon }}</span>
        <span class="amp-item-body">
          <span class="amp-item-title">{{ opt.title }}</span>
          <span class="amp-item-desc">{{ opt.desc }}</span>
        </span>
        <svg v-if="opt.active" class="amp-check" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.3 3.29 6.8-6.8a1 1 0 0 1 1.4 0Z" clip-rule="evenodd"/></svg>
      </button>
      <div v-if="error" class="amp-error">{{ error }}</div>
    </div>
    <div v-if="open" class="amp-backdrop" @click="open = false"></div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import api from '../../services/api'
import { confirm } from '../../composables/useConfirm'
import { modeKey, modeLabel, modeDotClass, MODE_OPTIONS } from '../../composables/agentModes'

const props = defineProps({
  agentId: { type: [Number, String], default: null },
  executionMode: { type: String, default: 'manual' },   // 'manual' | 'autonomous'
  planMode: { type: Boolean, default: false },
  // 'down' (header use) or 'up' (composer bottom-bar use — opens above the button).
  placement: { type: String, default: 'down' },
})
const emit = defineEmits(['change'])

const open = ref(false)
const saving = ref(false)
const error = ref('')
const mode = ref(props.executionMode || 'manual')
const plan = ref(!!props.planMode)

watch(() => props.executionMode, (v) => { mode.value = v || 'manual' })
watch(() => props.planMode, (v) => { plan.value = !!v })

// The 4-mode ↔ (execution_mode, plan_mode_enabled) mapping lives in one pure module (agentModes.js)
// so it stays the single source of truth and is unit-tested independently of this component.
const isAuto = computed(() => mode.value === 'autonomous')
const activeKey = computed(() => modeKey(mode.value, plan.value))
const label = computed(() => modeLabel(mode.value, plan.value))
const dotClass = computed(() => modeDotClass(mode.value, plan.value))

const options = computed(() => MODE_OPTIONS.map((o) => ({ ...o, active: o.key === activeKey.value })))

// Authoritatively sync the current mode from the backend on mount (surfaces may pass only agent-id).
onMounted(async () => {
  if (!props.agentId) return
  try {
    const res = await api.getAgent(props.agentId)
    const a = res?.data || {}
    if (a.execution_mode) mode.value = a.execution_mode
    plan.value = !!a.plan_mode_enabled
  } catch { /* keep prop values */ }
})

async function select(opt) {
  if (opt.active || saving.value || !props.agentId) { open.value = false; return }
  // Confirm before enabling autonomous execution.
  if (opt.patch.execution_mode === 'autonomous') {
    const ok = await confirm({
      title: 'Enable Auto Mode?',
      message: 'This agent will choose and run tools automatically, including during scheduled runs. Risky actions are reviewed by the AI safety policy instead of waiting for your approval.',
      confirmText: 'Enable Auto Mode',
    })
    if (!ok) {
      open.value = false
      return
    }
  }
  saving.value = true; error.value = ''
  try {
    await api.updateAgent(props.agentId, opt.patch)
    mode.value = opt.patch.execution_mode
    plan.value = opt.patch.plan_mode_enabled
    emit('change', { ...opt.patch })
    open.value = false
  } catch (e) {
    error.value = 'Could not update mode.'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.amp { position: relative; display: inline-block; }
.amp-btn { display: inline-flex; align-items: center; gap: 6px; padding: 3px 9px; border-radius: 9999px;
  border: 1px solid #e5e7eb; background: #fff; font-size: 0.72rem; font-weight: 600; color: #374151; cursor: pointer; }
.amp-btn:hover { background: #f9fafb; }
.amp-on { border-color: #99f6e4; background: #f0fdfa; color: #0f766e; }
.amp-dot { width: 7px; height: 7px; border-radius: 9999px; }
.amp-dot-manual { background: #9ca3af; }
.amp-dot-auto { background: #14b8a6; }
.amp-dot-plan { background: #6366f1; }
.amp-caret { width: 13px; height: 13px; color: #9ca3af; transition: transform .15s; }
.amp-caret-open { transform: rotate(180deg); }
.amp-backdrop { position: fixed; inset: 0; z-index: 40; }
.amp-menu { position: absolute; right: 0; z-index: 50; width: 268px;
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.12); padding: 6px; }
.amp-menu-down { top: calc(100% + 6px); }
.amp-menu-up { bottom: calc(100% + 6px); }   /* opens upward from a composer bottom bar */
.amp-head { font-size: 0.62rem; text-transform: uppercase; letter-spacing: .06em; color: #9ca3af; padding: 6px 8px 4px; }
.amp-item { width: 100%; display: flex; align-items: flex-start; gap: 9px; padding: 8px; border: 0; background: transparent;
  border-radius: 8px; text-align: left; cursor: pointer; }
.amp-item:hover { background: #f3f4f6; }
.amp-item-active { background: #f0fdfa; }
.amp-item:disabled { opacity: .5; cursor: default; }
.amp-item-icon { font-size: 0.95rem; line-height: 1.2; }
.amp-item-body { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.amp-item-title { font-size: 0.78rem; font-weight: 600; color: #1f2937; }
.amp-item-desc { font-size: 0.68rem; color: #6b7280; }
.amp-check { width: 15px; height: 15px; color: #14b8a6; margin-top: 2px; }
.amp-error { font-size: 0.68rem; color: #dc2626; padding: 4px 8px; }
</style>
