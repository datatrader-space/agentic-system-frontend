<template>
  <div ref="scrollEl" class="msg-list">
    <div class="msg-list-inner" role="log" aria-live="polite" aria-label="Conversation">
      <!-- Older history. A long thread opens on its most recent page (the server windows it), so this
           is how the rest is pulled in — on demand, oldest-ward, keeping scroll position. -->
      <div v-if="chat.messagesHasMore" class="load-earlier">
        <button type="button" class="load-earlier-btn" :disabled="chat.loadingOlder"
                @click="loadEarlier">
          {{ chat.loadingOlder ? 'Loading…' : 'Load earlier messages' }}
        </button>
      </div>

      <template v-for="m in chat.messages" :key="m.id">
        <ChatMessage
          :message="m"
          @retry="chat.retryLast()"
          @regenerate="chat.regenerate(m.id)"
          @edit="chat.editAndResend(m.id, $event)"
          @feedback="(value, detail) => chat.setFeedback(m.id, value, detail)"
        />
        <!-- Inline live plan artifact — the ONLY plan UI in chat. Rendered at its durable anchor,
             keyed by plan_id, in exact chronological place. Updates in place from pushed plan_event
             frames; no polling, no detached card. -->
        <template v-if="m.planArtifacts && m.planArtifacts.length">
          <div v-for="a in m.planArtifacts" :key="a.plan_id" class="msg-plan">
            <InlinePlanArtifact :run-id="a.run_id" :plan-id="a.plan_id" />
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useChatStore } from '../../stores/useChatStore'
import ChatMessage from './ChatMessage.vue'
import InlinePlanArtifact from '../plan/InlinePlanArtifact.vue'

const chat = useChatStore()
const scrollEl = ref(null)

const scrollToBottom = () => {
  const el = scrollEl.value
  if (el) el.scrollTop = el.scrollHeight
}

// Track the streaming tail length so we follow tokens as they arrive.
const lastLen = computed(() => {
  const m = chat.messages[chat.messages.length - 1]
  return m ? (m.content || '').length : 0
})

// Set while an older page is being prepended. messages.length grows on a prepend exactly as it does on
// a new reply, so without this the auto-follow below would yank the user from the history they just
// asked for down to the bottom of the thread.
const prepending = ref(false)

watch(
  () => [chat.messages.length, lastLen.value],
  () => { if (!prepending.value) nextTick(scrollToBottom) }
)

// Pull the previous page and keep the user's viewport anchored on the message they were reading:
// content is added ABOVE them, so shift scrollTop by exactly how much the content grew.
async function loadEarlier() {
  const el = scrollEl.value
  const before = el ? el.scrollHeight : 0
  const prevTop = el ? el.scrollTop : 0
  prepending.value = true
  try {
    await chat.loadOlderMessages()
    await nextTick()
    if (el) el.scrollTop = prevTop + (el.scrollHeight - before)
  } finally {
    prepending.value = false
  }
}

onMounted(() => nextTick(scrollToBottom))
</script>

<style scoped>
.msg-list {
  height: 100%;
  overflow-y: auto;
}
.msg-list-inner {
  padding: 28px 16px 16px;
}
/* Plan card aligned to the same centered content column as the message bubbles. It flows with the
   conversation (in chronological order) — no sticky/pinned behaviour. */
.msg-plan { max-width: 760px; margin: 0 auto 22px; }

/* "Load earlier messages" — top of the thread, same centered column as the bubbles. */
.load-earlier { max-width: 760px; margin: 0 auto 18px; display: flex; justify-content: center; }
.load-earlier-btn {
  padding: 7px 16px;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  color: var(--vm-ink-soft, #5b6472);
  background: var(--vm-surface, #fff);
  border: 1px solid var(--vm-line-2, #e4e8ee);
  border-radius: 9999px;
  cursor: pointer;
  transition: transform .15s var(--vm-ease), box-shadow .15s, color .15s;
}
.load-earlier-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--vm-shadow-s);
  color: var(--vm-violet-d, #6d5ef1);
}
.load-earlier-btn:disabled { opacity: .6; cursor: default; }
.load-earlier-btn:focus-visible { outline: 2px solid var(--vm-accent, #3a5bd9); outline-offset: 2px; }
</style>
