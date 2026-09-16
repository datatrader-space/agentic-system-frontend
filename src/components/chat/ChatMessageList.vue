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
        <!-- Work mode sections the thread by iteration. A Work run is N dispatches and each produces
             its own answer, so without this a long run reads as an undifferentiated wall of attempts
             with no way to tell which iteration any of them came from. Absent from ordinary chat. -->
        <WorkIterationBar v-if="!hasWorkRail && !chat._workRunActive && chat.iterationBoundaries.has(m.id)"
                          :divider="chat.iterationBoundaries.get(m.id)" />
        <!-- RUN SCAFFOLDING IS NOT SOMETHING THE USER SAID. A work run's continuation segments are
             persisted as role='user' rows (the runtime reads the conversation back as turns), so the
             thread drew "Continue the task you were working on… DO THE NEXT PIECE OF WORK" as the
             operator's own blue bubble — twice, in production conv 1561. The rail and the iteration
             bar already say a new segment started, so the prompt itself is suppressed rather than
             restyled. Only the bubble is skipped: anything anchored to the message (plan artifacts
             below) still renders in place. -->
        <ChatMessage
          v-if="!isRunScaffolding(m)"
          :message="m"
          @retry="chat.retryLast()"
          @regenerate="chat.regenerate(m.id)"
          @edit="chat.editAndResend(m.id, $event)"
          @feedback="(value, detail) => chat.setFeedback(m.id, value, detail)"
        />
        <!-- Inline live plan artifact — the ONLY plan UI in chat. Rendered at its durable anchor,
             keyed by plan_id, in exact chronological place. Updates in place from pushed plan_event
             frames; no polling, no detached card. -->
        <!-- A plan renders at its FIRST anchor and nowhere else. The store now refuses to anchor one
             plan twice, but a snapshot hydrated from the server carries whatever anchors the server
             wrote, and a plan drawn twice is the most confusing thing on the page -- two cards with the
             same steps, updating together. Deciding it here means neither source can produce it. -->
        <template v-if="m.planArtifacts && m.planArtifacts.length">
          <div v-for="a in m.planArtifacts" :key="a.plan_id" class="msg-plan">
            <InlinePlanArtifact v-if="isFirstAnchor(m.id, a.plan_id)"
                                :run-id="a.run_id" :plan-id="a.plan_id" />
          </div>
        </template>
      </template>

      <!-- The foot of the thread: which iteration is running now, or how the run ended. This is the
           gap the user actually reported — between two iterations nothing is streaming at all while
           the backend verifies the goal and dispatches the next segment, and with nothing rendered
           there the run looked finished. -->
        <!-- Not while a Work run is live: `work_segment` lands a moment before the run's first plan
             snapshot, and in that moment this bar flashed up and was replaced by the rail (conv 1578). -->
        <WorkIterationBar v-if="!hasWorkRail && !chat._workRunActive" />
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
import InlinePlanArtifact from '../plan/InlinePlanArtifact.vue'
import WorkIterationBar from './WorkIterationBar.vue'
import { usePlanStore } from '../../stores/usePlanStore'

const chat = useChatStore()
// The rail owns the Work narrative; the iteration bar repeats its segment and attempt counts.
const _plan = usePlanStore()
const hasWorkRail = computed(() => _plan.hasWorkRail(chat.conversationId))

// A role='user' row the SERVER wrote to carry a work run forward, not something the operator typed.
// `authoredBy` is stamped by agent/headless_consumer.py; it is absent on every ordinary message and
// on every row written before the marker existed, so both read as the user's own — which is correct.
const isRunScaffolding = (m) => m.role === 'user' && m.authoredBy === 'system'

// plan_id -> the id of the FIRST message anchoring it. Recomputed with the thread, so a late anchor
// landing on an earlier message still wins and the card does not jump.
const firstAnchorByPlan = computed(() => {
  const out = {}
  for (const m of (chat.messages || [])) {
    for (const a of (m.planArtifacts || [])) {
      if (a && a.plan_id && out[a.plan_id] === undefined) out[a.plan_id] = m.id
    }
  }
  return out
})
function isFirstAnchor(messageId, planId) {
  return firstAnchorByPlan.value[planId] === messageId
}
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
  atBottom.value = true
  hasNew.value = false
}

function onScroll() {
  const el = scrollEl.value
  if (!el || prepending.value) return
  const at = distanceFromBottom(el) <= BOTTOM_SLACK
  atBottom.value = at
  if (at) hasNew.value = false      // they came back on their own; nothing is unread any more
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
  border: 1px solid var(--vm-line-2, #e4e8ee);
  background: var(--vm-surface, #fff);
  color: var(--vm-ink-soft, #5b6472);
  box-shadow: var(--vm-shadow-s, 0 2px 10px rgba(16, 24, 40, 0.12));
  cursor: pointer;
  z-index: 3;
  transition: transform .15s var(--vm-ease), box-shadow .15s, color .15s;
}
.jump-latest:hover {
  transform: translateX(-50%) translateY(-1px);
  color: var(--vm-violet-d, #6d5ef1);
  box-shadow: var(--vm-shadow-m, 0 6px 18px rgba(16, 24, 40, 0.16));
}
.jump-latest:focus-visible { outline: 2px solid var(--vm-accent, #3a5bd9); outline-offset: 2px; }
.jump-latest svg {
  width: 18px; height: 18px; fill: none; stroke: currentColor;
  stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
}
/* Something arrived while they were reading further up. */
.jump-latest.unread { border-color: var(--vm-violet-d, #6d5ef1); color: var(--vm-violet-d, #6d5ef1); }
.jump-dot {
  position: absolute; top: 1px; right: 1px;
  width: 9px; height: 9px; border-radius: 50%;
  background: var(--vm-violet-d, #6d5ef1);
  border: 2px solid var(--vm-surface, #fff);
}

.jump-fade-enter-active, .jump-fade-leave-active { transition: opacity .15s, transform .15s; }
.jump-fade-enter-from, .jump-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(6px);
}
@media (prefers-reduced-motion: reduce) {
  .jump-latest, .jump-fade-enter-active, .jump-fade-leave-active { transition: none; }
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
