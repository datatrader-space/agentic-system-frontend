<script setup>
// Chat / Work — the mode switch, at the top of the surface it governs.
//
// TWO BUTTONS, THREE STATES. Auto is the default and it is deliberately NOT a button: Work is not a
// feature to opt into, it is what the turn's own semantic call chooses when the request needs many
// steps over a long time, and `_freeze_work_goal` opens a goal on that proposal alone. A third button
// for "let the model decide" put the platform's decision on the same footing as the user's, and it
// printed the answer twice over -- "Auto [Chat] · Chat · Work" showed the word Chat in two places
// meaning two different things.
//
// So the switch shows the two modes and HIGHLIGHTS THE ONE IN EFFECT. On Auto that highlight is a
// readout of what the model chose (`lastResolvedMode`), marked as such; clicking either button pins
// it, and clicking the pinned one releases back to Auto. Nothing in the control claims to be a choice
// the user made unless they made it.
//
// Pinning has to be real, not cosmetic. The store previously sent nothing for 'chat', so an explicit
// "just answer me" was byte-identical to no choice at all and the suppression branch that exists to
// honour it could never be reached from here.
//
// IT LIVES HERE RATHER THAN IN THE COMPOSER because of what it actually controls. The composer's other
// pills are per-message settings: which agent, which run mode, whether this one message makes an image.
// This chooses what KIND OF THING the session does — answer me, or go away and work — and a control at
// that altitude belongs above the conversation, not tucked beside the attach button where it reads as
// one more per-message option.
//
// One component, mounted by both the welcome screen and the thread, after the first version of this was
// written twice into two composers and was invisible on the screen a task actually starts from.
import { computed } from 'vue'
import { useChatStore } from '../../stores/useChatStore'

// `compact` is the composer's size, not a different control. The welcome screen gives this the whole
// width above the greeting, where it is the only thing to look at; inside the composer it sits in a row
// of 32px controls and has to match their weight or it shouts over the send button.
defineProps({ compact: { type: Boolean, default: false } })

const chat = useChatStore()

// WHICH MODE IS IN EFFECT — the user's pin if they set one, otherwise what the model last chose.
// Before any turn has run there is nothing to report, and Chat is the honest thing to show: a run that
// never needed to work is what most turns are.
const shown = computed(() =>
  (chat.turnMode === 'auto' ? (chat.lastResolvedMode || 'chat') : chat.turnMode))
// Is the highlight the user's instruction, or the model's decision? The two must not look alike — that
// conflation is the whole reason this control was rebuilt.
const pinned = computed(() => chat.turnMode !== 'auto')

function pick(mode) {
  // Clicking the pinned mode RELEASES it. Without this there is no way back to Auto once anything is
  // pinned, and Auto is the state that should hold for almost every conversation.
  chat.setTurnMode(pinned.value && chat.turnMode === mode ? 'auto' : mode)
}

function hint(mode) {
  const what = mode === 'work'
    ? 'work to a goal across as many turns as it takes'
    : 'answer in this turn'
  if (chat.turnMode === mode) return `Pinned: always ${what}. Click to let the model choose again.`
  if (pinned.value) return `Click to pin: always ${what}.`
  return `The model is choosing. Click to pin: always ${what}.`
}
</script>

<template>
  <div class="tms" :class="{ 'tms--sm': compact, 'tms--auto': !pinned }" role="group"
       aria-label="Response mode">
    <button type="button" class="tms__opt"
            :class="{ 'is-on': shown === 'chat', 'is-pinned': pinned && shown === 'chat' }"
            data-test="turnmode-chat" :aria-pressed="chat.turnMode === 'chat'"
            :title="hint('chat')" @click="pick('chat')">Chat</button>
    <button type="button" class="tms__opt"
            :class="{ 'is-on': shown === 'work', 'is-pinned': pinned && shown === 'work' }"
            data-test="turnmode-work" :aria-pressed="chat.turnMode === 'work'"
            :title="hint('work')" @click="pick('work')">Work</button>
  </div>
</template>

<style scoped>
.tms { display: inline-flex; gap: 2px; padding: 3px; border-radius: 999px;
       background: var(--surf2, #f2f4f7); border: 1px solid var(--line, #e3e6ea); }
.tms__opt { border: 0; background: transparent; border-radius: 999px; padding: 5px 20px;
            font-size: 13px; line-height: 18px; font-weight: 500; cursor: pointer;
            color: var(--ink2, #667085); transition: background .15s ease, color .15s ease; }
.tms__opt:hover:not(.is-on) { color: var(--ink, #111827); }
.tms__opt.is-on { background: var(--surf, #fff); color: var(--ink, #111827); font-weight: 600;
                  box-shadow: 0 1px 2px rgba(16, 24, 40, .08); }
/* A PIN AND A READOUT MUST NOT LOOK THE SAME. Pinned is the solid, committed state; on Auto the same
   highlight is drawn lighter and dashed, so "the model chose Work" never reads as "you chose Work". */
.tms__opt.is-on:not(.is-pinned) { font-weight: 500; color: var(--ink2, #667085);
                                  box-shadow: none; border: 1px dashed var(--line, #d7dbe0); }
.tms--auto { background: transparent; }
.tms--sm { padding: 2px; }
.tms--sm .tms__opt { padding: 3px 12px; font-size: 12px; line-height: 17px; }
.tms__opt:focus-visible { outline: 2px solid var(--acc, #2f7bed); outline-offset: 2px; }
</style>
