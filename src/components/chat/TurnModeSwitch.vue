<script setup>
// Chat / Work — the mode switch, at the top of the surface it governs.
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

const chat = useChatStore()
</script>

<template>
  <div class="tms" role="group" aria-label="Response mode">
    <button type="button" class="tms__opt" :class="{ 'is-on': chat.turnMode !== 'work' }"
            data-test="turnmode-chat" :aria-pressed="chat.turnMode !== 'work'"
            title="Answer in this turn"
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
.tms__opt:focus-visible { outline: 2px solid var(--acc, #2f7bed); outline-offset: 2px; }
</style>
