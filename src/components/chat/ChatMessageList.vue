<template>
  <div class="msg-list-wrap">
    <div ref="scrollEl" class="msg-list" @scroll.passive="onScroll">
      <div ref="innerEl" class="msg-list-inner" role="log" aria-live="polite" aria-label="Conversation">
      <!-- Older history. A long thread opens on its most recent page (the server windows it), so this
           is how the rest is pulled in — on demand, oldest-ward, keeping scroll position. -->
      <div v-if="chat.messagesHasMore" class="load-earlier">
        <button type="button" class="load-earlier-btn" :disabled="chat.loadingOlder"
                @click="loadEarlier">
          {{ chat.loadingOlder ? 'Loading…' : 'Load earlier messages' }}
        </button>
      </div>

      <template v-for="m in chat.messages" :key="m.id">
        <!-- RUN SCAFFOLDING IS NOT SOMETHING THE USER SAID. A resumed run's continuation prompt is persisted
             as a role='user' row (the runtime reads the conversation back as turns), so the thread drew it as
             the operator's own blue bubble (production conv 1561). The prompt is suppressed rather than
             restyled. Only the bubble is skipped: anything anchored to the message still renders in place. -->
        <!-- "APPROVE & RUN" IS AN APPROVAL, NOT A MESSAGE. The turn that carries out the plan is given
             a fixed instruction the person never typed; it was drawn as their own bubble after a reload. -->
        <div v-if="m.kind === 'plan_approval'" class="msg-approval" data-test="plan-approval-row">
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.3 3.29 6.8-6.8a1 1 0 0 1 1.4 0Z" clip-rule="evenodd"/></svg>
          <span>You approved the plan</span>
        </div>
        <ChatMessage
          v-else-if="!isRunScaffolding(m)"
          :message="presentMessage ? presentMessage(m) : m"
          :work-box="workUserIds.has(m.id)"
          @retry="chat.retryLast()"
          @regenerate="chat.regenerate(m.id)"
          @edit="chat.editAndResend(m.id, prepareEdit ? prepareEdit(m, $event) : $event)"
          @feedback="(value, detail) => chat.setFeedback(m.id, value, detail)"
        >
          <!-- A WORK turn's approvals and questions go on its rail (ADM-1302), under the newest turn's last row. -->
          <template v-if="isWorkTurn(m) && m.id === latestAssistantId && $slots['rail-pending']" #rail-pending>
            <slot name="rail-pending" />
          </template>
        </ChatMessage>
        <!-- A surface's own cards for this message (Let's Code: the proposed diff, the running app's preview). -->
        <slot name="after-message" :message="m" />
      </template>
      <!-- Where the thread ends: what the run is waiting on, in the conversation's flow (the plan card of a Chat or
           Plan turn, PLAN_REVIEW_LIKE_CLAUDE_PLAN.md). -->
      <div v-if="$slots['after-thread']" class="msg-after" data-test="msg-after-thread"><slot name="after-thread" /></div>

      </div>
    </div>

    <!-- Jump to the newest message. Shown only while the user has scrolled away from the bottom, so
         reading back over a long run never fights the stream. The dot marks content that arrived
         while they were away. -->
    <transition name="jump-fade">
      <button v-if="!atBottom" type="button" class="jump-latest" :class="{ unread: hasNew }"
              data-test="jump-latest" :aria-label="hasNew ? 'Jump to newest messages' : 'Jump to the end'"
              @click="jumpToLatest">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
        <span v-if="hasNew" class="jump-dot" aria-hidden="true"></span>
      </button>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useChatStore } from '../../stores/useChatStore'
import ChatMessage from './ChatMessage.vue'

// Optional display-only adapter; store messages and requests are never modified.
defineProps({ presentMessage: Function, prepareEdit: Function })

const chat = useChatStore()

// A role='user' row the SERVER wrote to carry a run forward, not something the operator typed.
// `authoredBy` is stamped by agent/headless_consumer.py; it is absent on every ordinary message and
// on every row written before the marker existed, so both read as the user's own — which is correct.
const isRunScaffolding = (m) => m.role === 'user' && m.authoredBy === 'system'

// A Work turn (ADM-1302): its approvals are drawn on its rail, not after it.
const isWorkTurn = (m) => !!m && m.role === 'assistant' && m.turnMode === 'work'
// The person's messages that a Work turn answers: drawn as a box, as Claude Code draws them (ADM-1302). A message
// with no answer yet takes the mode it was sent in (the conversation's).
const workUserIds = computed(() => {
  const ids = new Set()
  const list = chat.messages || []
  let nextMode = chat.turnMode
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i]
    if (!m) continue
    if (m.role === 'assistant') nextMode = m.turnMode || ''
    else if (nextMode === 'work') ids.add(m.id)
  }
  return ids
})
const latestAssistantId = computed(() => {
  const list = chat.messages || []
  for (let i = list.length - 1; i >= 0; i--) if (list[i] && list[i].role === 'assistant') return list[i].id
  return null
})
const scrollEl = ref(null)
const innerEl = ref(null)

// How close to the end still counts as "at the end". A few pixels of slack matter: fractional
// scrollHeight on zoomed or hi-dpi displays means scrollTop never exactly equals the maximum, and a
// strict comparison would report the user as scrolled-away while they sit at the bottom — turning the
// follow off permanently and showing the jump button over an already-complete view.
const BOTTOM_SLACK = 64

// Is the viewport parked at the end of the thread? This is the ONLY thing that decides whether new
// content scrolls: while true the thread follows the stream, while false the user is reading and is
// left alone. It starts true so a freshly-opened chat follows immediately.
const atBottom = ref(true)
// Content arrived while the user was reading further up — the jump button says so rather than making
// them guess whether anything happened.
const hasNew = ref(false)
// Set while an older page is being prepended. messages.length grows on a prepend exactly as it does on
// a new reply, and the content height jumps, so without this both the watcher and the resize observer
// below would yank the user from the history they just asked for down to the bottom of the thread.
const prepending = ref(false)

const distanceFromBottom = (el) => el.scrollHeight - el.scrollTop - el.clientHeight

const scrollToBottom = () => {
  const el = scrollEl.value
  if (!el) return
  el.scrollTop = el.scrollHeight
  lastTop = el.scrollTop
  atBottom.value = true
  hasNew.value = false
}

// Last scrollTop seen, so a scroll event can tell the USER moving up from content growing underneath.
let lastTop = 0

function onScroll() {
  const el = scrollEl.value
  if (!el || prepending.value) return
  const at = distanceFromBottom(el) <= BOTTOM_SLACK
  // ONLY AN UPWARD SCROLL LEAVES THE BOTTOM. The scroll event our own `scrollToBottom` triggers arrives
  // asynchronously; by then the new turn's "Working" card may already have grown the content, so the
  // distance check alone read "the user scrolled away" and switched the follow off at the start of every
  // turn — the live card sat behind the composer under a jump button (live test 2026-09-25). A reader
  // who scrolls up still stops the follow; content growth never does.
  const movedUp = el.scrollTop < lastTop - 2
  lastTop = el.scrollTop
  if (at) {
    atBottom.value = true
    hasNew.value = false             // they came back on their own; nothing is unread any more
  } else if (movedUp) {
    atBottom.value = false
  }
}

function jumpToLatest() {
  // Instant, not smoothed: this is a "take me there" control, and animating it over a long thread
  // means watching hundreds of messages fly past before arriving.
  scrollToBottom()
}

// Follow the streaming tail. Length alone is not enough to keep the view pinned (see the observer
// below) but it is what makes the thread track text as it is typed out.
const lastLen = computed(() => {
  const m = chat.messages[chat.messages.length - 1]
  return m ? (m.content || '').length : 0
})

watch(() => [chat.messages.length, lastLen.value], ([len], [prevLen] = []) => {
  if (prepending.value) return
  // THE USER JUST SPOKE. Sending a message is an unambiguous request to be at the end of the
  // conversation, so it re-arms the follow even if they had scrolled up to re-read something first.
  const last = chat.messages[chat.messages.length - 1]
  if (len > (prevLen || 0) && last && last.role === 'user') {
    nextTick(scrollToBottom)
    return
  }
  if (atBottom.value) nextTick(scrollToBottom)
  else hasNew.value = true
})

// THE REASON AUTO-SCROLL DID NOT HOLD.
//
// The watcher above fires on the message TEXT changing, and the text is not what moves the bottom of
// this thread. An agent answer ends with rendered images — a wall-detection reply carries six — and
// they load AFTER the markdown, growing the page by hundreds of pixels without altering a single
// character. Activity timelines, reasoning panels and plan cards expand the same way. So the scroll
// landed correctly and the content then grew past it, leaving the user mid-thread with a scrollbar
// they had to drag themselves.
//
// Observing the content box catches every one of those, whatever caused them, because it measures the
// thing that actually matters: how tall the conversation now is.
let ro = null
onMounted(() => {
  nextTick(scrollToBottom)
  if (typeof ResizeObserver === 'undefined' || !innerEl.value) return
  ro = new ResizeObserver(() => {
    if (prepending.value) return
    if (atBottom.value) scrollToBottom()
    else hasNew.value = true
  })
  ro.observe(innerEl.value)
})
onBeforeUnmount(() => { if (ro) { ro.disconnect(); ro = null } })

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
    // Released on the NEXT tick so the resize observer's own callback — which fires from the height
    // change this prepend just caused — still sees the guard and leaves the restored position alone.
    nextTick(() => { prepending.value = false })
  }
}

defineExpose({ scrollToBottom, atBottom, hasNew })
</script>

<style scoped>
/* The scroller's positioned parent, so the jump button can sit over the thread without scrolling
   away with it. Takes the height the scroller used to own. */
.msg-list-wrap {
  position: relative;
  height: 100%;
  min-height: 0;
}
.msg-list {
  height: 100%;
  overflow-y: auto;
  overscroll-behavior: contain;   /* a flick at the end must not scroll the page behind the chat */
}

/* Jump to the newest message. Sits just above the composer, centred on the same content column as the
   bubbles, and only exists while the user has scrolled away from the end. */
.jump-latest {
  position: absolute;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: 1px solid var(--vm-line-2, var(--vm-line-2));
  background: var(--vm-surface, var(--vm-surface));
  color: var(--vm-ink-soft, var(--vm-ink-soft));
  box-shadow: var(--vm-shadow-s, 0 2px 10px rgba(16, 24, 40, 0.12));
  cursor: pointer;
  z-index: 3;
  transition: transform .15s var(--vm-ease), box-shadow .15s, color .15s;
}
.jump-latest:hover {
  transform: translateX(-50%);
  color: var(--vm-violet-d, var(--vm-link));
  box-shadow: var(--vm-shadow-m, 0 6px 18px rgba(16, 24, 40, 0.16));
}
.jump-latest:focus-visible { outline: 2px solid var(--vm-accent, #3a5bd9); outline-offset: 2px; }
.jump-latest svg {
  width: 18px; height: 18px; fill: none; stroke: currentColor;
  stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
}
/* Something arrived while they were reading further up. */
.jump-latest.unread { border-color: var(--vm-violet-d, #6d5ef1); color: var(--vm-violet-d, var(--vm-link)); }
.jump-dot {
  position: absolute; top: 1px; right: 1px;
  width: 9px; height: 9px; border-radius: 50%;
  background: var(--vm-violet-d, #6d5ef1);
  border: 2px solid var(--vm-surface, var(--vm-line-2));
}

.jump-fade-enter-active, .jump-fade-leave-active { transition: opacity .15s; }
.jump-fade-enter-from, .jump-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%);
}
/* Phone: the thread gets the width back. 16px side padding on a 390px screen is 8% of it, and the
   28px top gap was sized for a desktop header that is no longer 22px tall here. */
@media (max-width: 640px) {
  .msg-list-inner { padding: 14px 10px 10px; }
  .msg-after, .load-earlier { margin-bottom: 14px; }
}

@media (prefers-reduced-motion: reduce) {
  .jump-latest, .jump-fade-enter-active, .jump-fade-leave-active { transition: none; }
}
.msg-list-inner {
  padding: 28px 16px 16px;
}
/* What the run waits on where the thread ends (a plan card), in the same centered column as the messages. It flows
   with the conversation: never sticky, never over it. */
.msg-after { max-width: 760px; margin: 0 auto 22px; }
.msg-after:empty { display: none; }

/* "Load earlier messages" — top of the thread, same centered column as the bubbles. */
.load-earlier { max-width: 760px; margin: 0 auto 18px; display: flex; justify-content: center; }
.load-earlier-btn {
  padding: 7px 16px;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  color: var(--vm-ink-soft, var(--vm-ink-soft));
  background: var(--vm-surface, var(--vm-surface));
  border: 1px solid var(--vm-line-2, var(--vm-line-2));
  border-radius: 9999px;
  cursor: pointer;
  transition: transform .15s var(--vm-ease), box-shadow .15s, color .15s;
}
.load-earlier-btn:hover:not(:disabled) {
  box-shadow: var(--vm-shadow-s);
  color: var(--vm-violet-d, var(--vm-link));
}
.load-earlier-btn:disabled { opacity: .6; cursor: default; }
.load-earlier-btn:focus-visible { outline: 2px solid var(--vm-accent, #3a5bd9); outline-offset: 2px; }

/* The approval that started a plan: a quiet event line, not a speech bubble. */
.msg-approval { display: flex; align-items: center; justify-content: center; gap: 6px; margin: 4px 0 10px;
  font-size: 12.5px; color: var(--text-secondary, var(--vm-ink-faint)); }
.msg-approval svg { width: 14px; height: 14px; color: var(--success, var(--vm-green-ink)); }
</style>
