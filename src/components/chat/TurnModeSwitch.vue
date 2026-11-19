<script setup>
// Chat / Work — the mode switch, at the top of the surface it governs (LONG_RUN_LIKE_CLAUDE_CODE_PLAN §3.2). PLAN is
// picked in the composer's Mode menu beside Manual and Autonomous, like Claude Code's plan mode (owner, 2026-11-19);
// while it is on, a chip here says so and its × goes back to Chat or Work.
//
// THREE MODES, ONE ENGINE, NO "AUTO". Auto meant "let the router decide", and there is no routing call any more. Every
// mode runs the same loop on the run host: the run keeps going when you leave, you are notified when it needs you or
// finishes, the running cost shows live. They differ only in what the agent is told:
//   * Chat — answer; the agent plans only if it chooses to.
//   * Work — carry the work through; plan first when it takes three or more steps (the plan card asks you before
//     anything changes).
//   * Plan — read only, write a plan, and ask before changing anything.
//
// The mode is the CONVERSATION's: the backend keeps the person's choice on it (`turn_mode` on the conversation) and
// the store reads it when the chat opens, so a reload or another device shows the same switch. A Coding Agent project
// chat starts on Work; every other chat starts on Chat.
//
// One component, mounted by the welcome screen and the thread. A radio group: one mode is always selected.
import { computed } from 'vue'
import { useChatStore } from '../../stores/useChatStore'

// `compact` is the composer's size, not a different control.
defineProps({ compact: { type: Boolean, default: false } })

const chat = useChatStore()

const MODES = [
  { id: 'chat', label: 'Chat', hint: 'Chat: the agent answers; it plans only if it chooses to.' },
  { id: 'work', label: 'Work', hint: 'Work: the agent carries the work through, and plans first when it takes three or more steps. It keeps going if you leave, and you are notified when it needs you or finishes.' },
]

// The switch shows Chat or Work; while Plan is on, the one Plan goes back to.
const shown = computed(() => (chat.turnMode === 'plan' ? chat.planReturnMode : chat.turnMode))
function pick(mode) { chat.setTurnMode(mode) }

// Arrow keys move the selection, as in any radio group (WAI-ARIA radio group pattern).
function onKey(e, i) {
  const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
  if (!step) return
  e.preventDefault()
  const next = MODES[(i + step + MODES.length) % MODES.length]
  pick(next.id)
  const group = e.currentTarget && e.currentTarget.parentElement
  const btn = group && group.querySelector(`[data-test="turnmode-${next.id}"]`)
  if (btn && btn.focus) btn.focus()
}
</script>

<template>
  <div class="tms-wrap">
    <div class="tms" :class="{ 'tms--sm': compact }" role="radiogroup" aria-label="Mode">
      <button v-for="(m, i) in MODES" :key="m.id" type="button" class="tms__opt" role="radio"
              :class="{ 'is-on': shown === m.id }" :data-test="`turnmode-${m.id}`"
              :aria-checked="shown === m.id" :tabindex="shown === m.id ? 0 : -1"
              :title="m.hint" @click="pick(m.id)" @keydown="onKey($event, i)">{{ m.label }}</button>
    </div>
    <!-- Plan is on (picked in the Mode menu): said here, with the way back. -->
    <span v-if="chat.turnMode === 'plan'" class="tms-plan" data-test="turnmode-plan-on"
          title="Plan: the agent only reads, writes a plan and asks you before changing anything.">
      Plan mode
      <button type="button" class="tms-plan__x" data-test="turnmode-plan-off"
              :aria-label="`Leave plan mode (back to ${shown === 'work' ? 'Work' : 'Chat'})`" @click="chat.leavePlanMode()">×</button>
    </span>
  </div>
</template>

<style scoped>
.tms-wrap { display: inline-flex; align-items: center; gap: 6px; min-width: 0; }
.tms-plan { display: inline-flex; align-items: center; gap: 2px; padding: 0 2px 0 10px; min-height: 28px; border-radius: 999px;
            background: var(--vm-violet-soft, var(--vm-surface-soft)); color: var(--vm-violet-d, var(--vm-link));
            font-size: 12.5px; font-weight: 600; white-space: nowrap; }
.tms-plan__x { display: grid; place-items: center; width: 24px; height: 24px; border: 0; border-radius: 999px; background: transparent;
               color: inherit; font-size: 15px; line-height: 1; cursor: pointer; }
.tms-plan__x:hover { background: color-mix(in srgb, currentColor 12%, transparent); }
.tms-plan__x:focus-visible { outline: 2px solid var(--vm-violet-d, #4f46e5); outline-offset: 1px; }
@media (max-width: 640px) { .tms-plan__x { width: 32px; height: 32px; } }
.tms { display: inline-flex; gap: 2px; padding: 3px; border-radius: 999px;
       background: var(--surf2, var(--vm-surface-soft)); border: 1px solid var(--line, var(--vm-line-2)); }
.tms__opt { border: 0; background: transparent; border-radius: 999px; padding: 5px 20px; min-height: 28px;
            font-size: 13px; line-height: 18px; font-weight: 500; cursor: pointer; touch-action: manipulation;
            color: var(--ink2, var(--vm-ink-faint)); transition: background .15s ease, color .15s ease; }
.tms__opt:hover:not(.is-on) { color: var(--ink, var(--vm-ink)); }
.tms__opt.is-on { background: var(--surf, var(--vm-surface)); color: var(--ink, var(--vm-ink)); font-weight: 600;
                  box-shadow: 0 1px 2px rgba(16, 24, 40, .08); }
.tms--sm { padding: 2px; }
.tms--sm .tms__opt { padding: 3px 12px; font-size: 12px; line-height: 17px; min-height: 24px; }
.tms__opt:focus-visible { outline: 2px solid var(--acc, #2f7bed); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .tms__opt { transition: none; } }
</style>
