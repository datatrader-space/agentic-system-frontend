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
      <!-- Own agents have no model pill, so their per-turn effort row lives here. Shared agents get
           Mode + Effort together inside the model dropdown instead — one control, never two. -->
      <div class="amp-sep"></div>
      <EffortSlider />
      <div v-if="error" class="amp-error">{{ error }}</div>
    </div>
    <div v-if="open" class="amp-backdrop" @click="open = false"></div>
  </div>
</template>

<script setup>
import EffortSlider from '../chat/EffortSlider.vue'
import { ref } from 'vue'
import { useAgentRunMode } from '../../composables/useAgentRunMode'

const props = defineProps({
  agentId: { type: [Number, String], default: null },
  runMode: { type: String, default: 'manual' },   // canonical agent_run_mode
  // 'down' (header use) or 'up' (composer bottom-bar use — opens above the button).
  placement: { type: String, default: 'down' },
})
const emit = defineEmits(['change'])

const open = ref(false)
// Load/choose/persist — shared with the Mode section inside the shared agent's model dropdown so the
// autonomous confirmation and the shared-agent write rule can never drift between the two surfaces.
const { mode, saving, error, isAuto, label, dotClass, options, select: apply } =
  useAgentRunMode(() => props.agentId, () => props.runMode)

async function select(opt) {
  if (await apply(opt)) emit('change', { ...opt.patch })
  open.value = false
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
.amp-sep { height: 1px; margin: 4px 8px; background: #ececec; }
</style>
