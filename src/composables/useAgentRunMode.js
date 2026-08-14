import { ref, computed, watch, onMounted } from 'vue'
import api from '../services/api'
import { confirm } from './useConfirm'
import { modeKey, modeLabel, modeDotClass, MODE_OPTIONS, normalizeRunMode, isAutonomous } from './agentModes'

/**
 * Run-mode state for one agent: load, choose, persist.
 *
 * Two surfaces need this and must not drift apart — the standalone mode pill (own agents) and the Mode
 * section inside the shared agent's model dropdown. The autonomous confirmation and, more importantly, the
 * shared-agent write rule below are exactly the things that must never exist in two copies.
 *
 * THE SHARED-AGENT RULE. A shared (system-owned) agent is ONE AgentProfile row serving every user, so
 * PATCHing `agent_run_mode` on it would switch the mode for everyone on the platform. Those users get a
 * per-user override row instead (POST select-run-mode/). Which path applies is read from the agent itself,
 * never assumed by the caller.
 *
 * @param {() => (number|string|null)} getAgentId  reactive getter for the agent id
 * @param {() => string} [getInitialMode]          reactive getter for a mode the surface already knows
 */
export function useAgentRunMode(getAgentId, getInitialMode = () => 'manual') {
  const mode = ref(normalizeRunMode(getInitialMode()))
  const isShared = ref(false)
  const saving = ref(false)
  const error = ref('')

  watch(getInitialMode, (v) => { if (v) mode.value = normalizeRunMode(v) })

  // The 4 canonical run modes live in one pure module (agentModes.js) so it stays the single source of
  // truth and is unit-tested independently of any component.
  const isAuto = computed(() => isAutonomous(mode.value))
  const activeKey = computed(() => modeKey(mode.value))
  const label = computed(() => modeLabel(mode.value))
  const dotClass = computed(() => modeDotClass(mode.value))
  const options = computed(() => MODE_OPTIONS.map((o) => ({ ...o, active: o.key === activeKey.value })))

  // Authoritatively sync from the backend on mount (surfaces may pass only an agent id).
  const load = async () => {
    const id = getAgentId()
    if (!id) return
    try {
      const res = await api.getAgent(id)
      const a = res?.data || {}
      isShared.value = !!(a.is_platform_super_agent || a.is_builtin_agent)
      // effective_run_mode is what THIS caller's chats actually run as — on a shared agent that is their
      // own override, not the admin's platform default sitting in agent_run_mode.
      const resolved = a.effective_run_mode || a.agent_run_mode
      if (resolved) mode.value = normalizeRunMode(resolved)
    } catch { /* keep whatever the surface passed in */ }
  }
  onMounted(load)

  /** Apply a mode. Resolves true when it was saved, false when cancelled or it failed. */
  const select = async (opt) => {
    const id = getAgentId()
    if (opt.active || saving.value || !id) return false
    const next = opt.patch.agent_run_mode
    if (isAutonomous(next)) {
      const ok = await confirm({
        title: 'Enable autonomous execution?',
        message: 'This agent will choose and run tools automatically, including during scheduled runs. Risky actions are reviewed by the AI safety policy instead of waiting for your approval.',
        confirmText: 'Enable',
      })
      if (!ok) return false
    }
    saving.value = true; error.value = ''
    try {
      if (isShared.value) await api.selectAgentRunMode(id, next)
      else await api.updateAgent(id, opt.patch)
      mode.value = next
      return true
    } catch {
      error.value = 'Could not update mode.'
      return false
    } finally {
      saving.value = false
    }
  }

  return { mode, isShared, saving, error, isAuto, activeKey, label, dotClass, options, select, load }
}
