<template>
  <!-- Plan mode's card (PLAN_REVIEW_LIKE_CLAUDE_PLAN.md), in the conversation where the run paused: the agent wrote
       its plan to a file and asks the person what to do with it. The plan itself is read beside the chat ("Open the
       plan"), never repeated here. It offers exactly the answers the server sent; "keep planning" needs notes. -->
  <section class="pmc" role="group" aria-labelledby="pmc-title" data-test="plan-mode-card">
    <header class="pmc-head">
      <Icon icon="lucide:clipboard-list" class="pmc-icon" aria-hidden="true" />
      <h3 id="pmc-title" class="pmc-title">Plan ready for review</h3>
      <span class="pmc-wait" data-test="pmc-waiting">Waiting for you</span>
    </header>

    <div class="pmc-body">
      <p class="pmc-lead">The run is paused and nothing has been changed. Read the plan, then choose how to go on.</p>

      <button type="button" class="pmc-open" data-test="pmc-open-plan" @click="openPlan">
        <Icon icon="lucide:file-text" aria-hidden="true" />
        <span class="pmc-open-name" translate="no">{{ planPath || 'The plan' }}</span>
        <span class="pmc-open-act">Open the plan <Icon icon="lucide:panel-right-open" aria-hidden="true" /></span>
      </button>

      <form v-if="notesOpen" class="pmc-notes" @submit.prevent="sendNotes">
        <label class="pmc-label" :for="notesId">What should change in the plan? <span class="pmc-req">(required)</span></label>
        <textarea :id="notesId" ref="notesEl" v-model="notes" class="pmc-input" rows="3" required
                  :aria-invalid="tried && !notes.trim() ? 'true' : 'false'" :aria-describedby="tried && !notes.trim() ? notesId + '-err' : undefined"
                  name="plan-notes" autocomplete="off"
                  placeholder="For example: keep the old API working, and add tests first…"
                  data-test="pmc-notes" @keydown.ctrl.enter.prevent="sendNotes" @keydown.meta.enter.prevent="sendNotes"></textarea>
        <p v-if="tried && !notes.trim()" :id="notesId + '-err'" class="pmc-err" role="alert">Write what should change, so the agent knows how to plan again.</p>
        <div class="pmc-row">
          <button type="submit" class="pmc-btn primary" :disabled="sent" data-test="pmc-send-notes">
            <Icon icon="lucide:send" aria-hidden="true" /> Send and keep planning
          </button>
          <button type="button" class="pmc-btn" :disabled="sent" @click="notesOpen = false">Back</button>
        </div>
      </form>

      <template v-else>
        <div class="pmc-answers" data-test="pmc-answers">
          <button v-for="(a, i) in answers" :key="a.id" type="button" class="pmc-btn"
                  :class="{ primary: i === 0 && a.id !== notesAnswer, ghost: a.id === notesAnswer }"
                  :disabled="sent" :data-test="`pmc-answer-${a.id}`" @click="pick(a)">
            <Icon :icon="ICONS[a.id] || 'lucide:check'" aria-hidden="true" /> {{ a.title }}
          </button>
        </div>
        <!-- "Run on its own" is offered only when the agent runs on its own or the person owns it
             (plan_mode.answers_for): approving a plan never gives more than the agent's owner allowed. -->
        <p v-if="!offersRunOnItsOwn" class="pmc-note" data-test="pmc-no-autonomy">
          This agent asks before risky changes, as its owner set it, so "run on its own" is not offered.
        </p>
      </template>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { usePlanReviewStore } from '@/stores/usePlanReviewStore'
import { useChatStore } from '@/stores/useChatStore'

const props = defineProps({
  // The `hitl_request` as the chat store keeps it: { request_id, payload: { kind: 'plan_approval', ... } }.
  request: { type: Object, required: true },
  // The conversation the card belongs to (its plan never shows in another chat).
  conversationId: { type: [String, Number], default: null },
})
const emit = defineEmits(['respond'])

const ICONS = {
  run_on_its_own: 'lucide:play',
  ask_before_each_change: 'lucide:list-checks',
  keep_planning: 'lucide:pencil',
}

const payload = computed(() => props.request?.payload || {})
const planPath = computed(() => String(payload.value.plan_file?.path || ''))
// Exactly the answers the server offered (run_on_its_own only when it is offered), in its order.
const answers = computed(() => (Array.isArray(payload.value.answers) ? payload.value.answers : [])
  .filter((a) => a && a.id && a.title))
const notesAnswer = computed(() => payload.value.notes_answer || 'keep_planning')
const offersRunOnItsOwn = computed(() => answers.value.some((a) => a.id === 'run_on_its_own'))

// The plan opens beside the chat (the chat's Plan tab, or Let's Code's editor preview), from the plan under review.
const plans = usePlanReviewStore()
// Its conversation: given by the host, else the request's own (a Work turn's rail mounts it through the approval card).
const convId = computed(() => props.conversationId ?? props.request?.conversation_id ?? null)
function openPlan() {
  plans.show(props.request, convId.value)
  plans.openPanel()
}

const notesId = computed(() => `pmc-notes-${props.request?.request_id || 'x'}`)
const notesOpen = ref(false)
const notes = ref('')
const tried = ref(false)
const sent = ref(false)
const notesEl = ref(null)

watch(() => props.request?.request_id, () => {
  notesOpen.value = false; notes.value = ''; tried.value = false; sent.value = false
})

// What the card leaves behind once answered (the one line in the conversation).
function answerLine(id) {
  if (id === notesAnswer.value) return 'Changes sent: the agent is planning again'
  const a = answers.value.find((x) => x.id === id)
  return `Plan approved: ${a ? a.title.replace(/^Yes,\s*/i, '') : id}`
}

function respond(id, feedback = '') {
  if (sent.value) return
  sent.value = true
  plans.show(props.request, convId.value)
  plans.answered(props.request.request_id, answerLine(id))
  // An approved plan leaves plan mode for Chat or Work, as Claude Code does; "keep planning" stays in it.
  if (id !== notesAnswer.value) useChatStore().leavePlanMode()
  emit('respond', { request_id: props.request.request_id, response_value: id, feedback })
}

function pick(a) {
  if (a.id === notesAnswer.value) {
    notesOpen.value = true
    nextTick(() => notesEl.value && notesEl.value.focus())
    return
  }
  respond(a.id)
}

function sendNotes() {
  tried.value = true
  const text = notes.value.trim()
  if (!text) return
  respond(notesAnswer.value, text)
}
</script>

<style scoped>
.pmc { pointer-events: auto; width: 100%; box-sizing: border-box; display: flex; flex-direction: column;
       background: var(--vm-surface); color: var(--vm-ink); border: 1px solid var(--vm-line-2);
       border-left: 3px solid var(--vm-violet); border-radius: 12px; overflow: hidden; }
.pmc-head { display: flex; align-items: center; gap: 8px; padding: 12px 16px 4px; }
.pmc-icon { width: 16px; height: 16px; flex: 0 0 auto; color: var(--vm-violet); }
.pmc-title { margin: 0; font-size: 14px; font-weight: 650; color: var(--vm-ink); }
.pmc-wait { margin-left: auto; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 600;
            background: var(--vm-amber-soft); color: var(--vm-amber-ink); }
.pmc-body { padding: 4px 16px 14px; overflow: auto; min-height: 0; }
.pmc-lead { margin: 0 0 10px; font-size: 14px; line-height: 1.5; color: var(--vm-ink-soft); }
.pmc-open { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 44px; margin: 0 0 12px; padding: 8px 12px;
            border: 1px solid var(--vm-line-2); border-radius: 8px; background: var(--vm-surface-soft); color: var(--vm-ink);
            text-align: left; cursor: pointer; transition: border-color .15s, background-color .15s; }
.pmc-open:hover { border-color: var(--vm-violet); }
.pmc-open:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 2px; }
.pmc-open :deep(svg) { width: 15px; height: 15px; flex: 0 0 auto; }
.pmc-open-name { min-width: 0; flex: 1 1 auto; font: 12.5px var(--vm-font-mono); color: var(--vm-ink-soft);
                 overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pmc-open-act { display: inline-flex; align-items: center; gap: 4px; flex: 0 0 auto; font-size: 13px; font-weight: 600;
                color: var(--vm-violet-d, var(--vm-violet)); }
.pmc-note { margin: 10px 0 0; font-size: 13px; line-height: 1.45; color: var(--vm-ink-soft); }
.pmc-label { margin: 0 0 4px; font-size: 12px; font-weight: 600; color: var(--vm-ink-soft); display: block; }
.pmc-req { font-weight: 400; color: var(--vm-ink-faint); }
.pmc-answers, .pmc-row { display: flex; flex-wrap: wrap; gap: 8px; }
.pmc-btn { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 0 14px; border-radius: 8px;
           border: 1px solid var(--vm-line-2); background: var(--vm-surface); color: var(--vm-ink);
           font-size: 14px; font-weight: 600; cursor: pointer; transition: background-color .15s, border-color .15s; }
.pmc-btn:hover:not(:disabled) { background: var(--vm-surface-soft); }
.pmc-btn.primary { background: var(--vm-violet); border-color: var(--vm-violet); color: #fff; }
.pmc-btn.primary:hover:not(:disabled) { background: var(--vm-violet-d, var(--vm-violet)); }
.pmc-btn.ghost { border-color: transparent; background: transparent; color: var(--vm-ink-soft); }
.pmc-btn.ghost:hover:not(:disabled) { color: var(--vm-ink); background: var(--vm-surface-soft); }
.pmc-btn:disabled { opacity: .55; cursor: not-allowed; }
.pmc-btn:focus-visible, .pmc-input:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 2px; }
.pmc-btn :deep(svg) { width: 15px; height: 15px; }
.pmc-notes { display: flex; flex-direction: column; gap: 6px; }
.pmc-input { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid var(--vm-line-2); border-radius: 8px;
             background: var(--vm-surface); color: var(--vm-ink); font: 14px/1.5 var(--vm-font-sans); resize: vertical; }
.pmc-input::placeholder { color: var(--vm-ink-faint); opacity: 1; }
.pmc-input[aria-invalid='true'] { border-color: var(--vm-danger); }
.pmc-err { margin: 0; font-size: 13px; color: var(--vm-red-ink); }
@media (max-width: 640px) {
  .pmc-btn { min-height: 44px; flex: 1 1 100%; justify-content: center; }
  .pmc-input { font-size: 16px; }
}
</style>
