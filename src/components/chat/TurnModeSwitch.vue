<script setup>
// Auto / Chat / Work — the mode switch, at the top of the surface it governs.
//
// AUTO IS THE DEFAULT AND IS NOT A THIRD MODE. Work is not a separate feature to be opted into: the
// turn's single semantic call already proposes a work goal when the request is multi-step and
// long-running, and `_freeze_work_goal` opens one on that proposal alone. This control exists only to
// OVERRIDE that judgement, so its resting state has to say "I have not overridden anything".
//
// It read "Chat" before, which was wrong twice over. It presented the platform's own decision as the
// user's, and because the store sent nothing for 'chat' the explicit choice was byte-identical to no
// choice -- so the suppression branch that exists precisely to protect someone who said "just answer
// me" could never be reached from this switch.
//
// IT LIVES HERE RATHER THAN IN THE COMPOSER because of what it actually controls. The composer's other
// pills are per-message settings: which agent, which run mode, whether this one message makes an image.
// This chooses what KIND OF THING the session does — answer me, or go away and work — and a control at
// that altitude belongs above the conversation, not tucked beside the attach button where it reads as
// one more per-message option.
//
// One component, mounted by both the welcome screen and the thread, after the first version of this was
// written twice into two composers and was invisible on the screen a task actually starts from.
import { useChatStore } from '../../stores/useChatStore'

// `compact` is the composer's size, not a different control. The welcome screen gives this the whole
// width above the greeting, where it is the only thing to look at; inside the composer it sits in a row
// of 32px controls and has to match their weight or it shouts over the send button.
defineProps({ compact: { type: Boolean, default: false } })

const chat = useChatStore()
</script>

<template>
  <div class="tms" :class="{ 'tms--sm': compact }" role="group" aria-label="Response mode">
    <button type="button" class="tms__opt" :class="{ 'is-on': chat.turnMode === 'auto' }"
            data-test="turnmode-auto" :aria-pressed="chat.turnMode === 'auto'"
            title="Let the model choose — it works to a goal when the request needs many steps, and answers directly when it does not"
            @click="chat.setTurnMode('auto')">Auto<span
              v-if="chat.turnMode === 'auto' && chat.lastResolvedMode" class="tms__res"
              data-test="turnmode-resolved">{{ chat.lastResolvedMode === 'work' ? 'Work' : 'Chat' }}</span></button>
    <button type="button" class="tms__opt" :class="{ 'is-on': chat.turnMode === 'chat' }"
            data-test="turnmode-chat" :aria-pressed="chat.turnMode === 'chat'"
            title="Answer in this turn, even if the request looks long"
            @click="chat.setTurnMode('chat')">Chat</button>
    <button type="button" class="tms__opt" :class="{ 'is-on': chat.turnMode === 'work' }"
            data-test="turnmode-work" :aria-pressed="chat.turnMode === 'work'"
            title="Work to a goal across as many turns as it takes"
            @click="chat.setTurnMode('work')">Work</button>
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
/* WHAT AUTO CHOSE. Shown only on Auto: once the user has overridden the decision there is nothing
   left to report, and repeating their own choice back at them is noise. */
.tms__res { margin-left: 6px; padding: 1px 6px; border-radius: 999px; font-size: 11px;
            line-height: 15px; font-weight: 600; color: var(--ink2, #667085);
            background: var(--surf2, #f2f4f7); border: 1px solid var(--line, #e3e6ea); }
.tms__opt.is-on .tms__res { color: var(--acc, #2f7bed); }
.tms--sm { padding: 2px; }
.tms--sm .tms__opt { padding: 3px 12px; font-size: 12px; line-height: 17px; }
.tms__opt:focus-visible { outline: 2px solid var(--acc, #2f7bed); outline-offset: 2px; }
</style>
