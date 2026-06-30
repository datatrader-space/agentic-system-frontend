<template>
  <div v-if="open" class="ha-backdrop" @click.self="close">
    <section class="ha-modal">
      <header class="ha-head">
        <div class="ha-title"><span class="ha-spark"><Icon icon="lucide:sparkles" /></span>
          <div><h2>Help Assistant</h2><small>Answers only from the Help Center, with sources.</small></div>
        </div>
        <button class="ha-x" @click="close"><Icon icon="lucide:x" /></button>
      </header>

      <div class="ha-body">
        <form class="ha-ask" @submit.prevent="ask">
          <Icon icon="lucide:message-circle-question" />
          <input ref="inputEl" v-model="question" placeholder="Ask a question, e.g. how do I connect GitHub?" />
          <button type="submit" class="ask-btn" :disabled="loading || !question.trim()">
            <Icon :icon="loading ? 'lucide:loader-2' : 'lucide:arrow-up'" :class="{ spin: loading }" />
          </button>
        </form>

        <div v-if="loading" class="ha-loading">
          <span class="dot" /><span class="dot" /><span class="dot" />
          <p>Searching the Help Center…</p>
        </div>

        <div v-else-if="error" class="ha-state"><Icon icon="lucide:alert-triangle" /><p>Something went wrong. Try again.</p></div>

        <template v-else-if="result">
          <!-- Grounded answer -->
          <div v-if="!result.no_answer" class="ha-answer">
            <p class="answer-text">{{ result.answer }}</p>

            <div v-if="result.sources?.length" class="ha-sources">
              <h3>Sources</h3>
              <button v-for="(s, i) in result.sources" :key="i" class="source" @click="openSource(s)">
                <span class="s-num">{{ i + 1 }}</span>
                <span class="s-text">
                  <strong>{{ s.content_title }} › {{ s.section_heading }}</strong>
                  <small v-html="s.excerpt"></small>
                </span>
                <span class="s-open">Open <Icon icon="lucide:arrow-right" /></span>
              </button>
            </div>

            <div v-if="result.suggested_actions?.length" class="ha-actions">
              <button v-for="(a, i) in result.suggested_actions" :key="i" :class="['act', i === 0 ? 'primary' : '']" @click="doAction(a)">
                {{ a.label }} <Icon icon="lucide:arrow-right" />
              </button>
            </div>
          </div>

          <!-- No reliable answer -->
          <div v-else class="ha-noanswer">
            <Icon icon="lucide:search-x" />
            <p>{{ result.fallback_message }}</p>
            <div class="ha-actions">
              <button v-for="(a, i) in result.suggested_actions" :key="i" :class="['act', i === 0 ? 'primary' : '']" @click="doAction(a)">{{ a.label }}</button>
            </div>
          </div>
        </template>

        <div v-else class="ha-hint">
          <p>Ask anything about agents, knowledge bases, integrations, workflows, billing, and more.</p>
          <div class="examples">
            <button v-for="ex in examples" :key="ex" @click="question = ex; ask()">{{ ex }}</button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import api from '../../services/api'
import { useGuidedTour } from '../../composables/useGuidedTour'

const { launch: launchTour } = useGuidedTour()

const props = defineProps({
  open: { type: Boolean, default: false },
  initialQuestion: { type: String, default: '' },
  currentPage: { type: String, default: '' },
  productArea: { type: String, default: '' },
})
const emit = defineEmits(['update:open'])

const router = useRouter()
const question = ref('')
const result = ref(null)
const loading = ref(false)
const error = ref(false)
const inputEl = ref(null)

const examples = ['How do I connect GitHub?', 'How do I add a knowledge base?', 'How does billing work?']

function close() { emit('update:open', false) }

async function ask() {
  const q = question.value.trim()
  if (!q) return
  loading.value = true; error.value = false; result.value = null
  try {
    const { data } = await api.askHelpAssistant({ question: q, current_page: props.currentPage, product_area: props.productArea })
    result.value = data
  } catch (e) { error.value = true }
  loading.value = false
}

function openSource(s) {
  close()
  if (s.url) router.push(s.url)
}
function doAction(a) {
  close()
  if (a.type === 'start_tour' && a.tour_slug) { launchTour(a.tour_slug); return }
  if (a.url) router.push(a.url)
}

watch(() => props.open, async (v) => {
  if (v) {
    if (props.initialQuestion) { question.value = props.initialQuestion; ask() }
    await nextTick(); inputEl.value?.focus()
  } else {
    result.value = null; error.value = false
  }
})
</script>

<style scoped>
.ha-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.5); display: flex; align-items: flex-start; justify-content: center; padding: 8vh 20px 20px; z-index: 80; }
.ha-modal { width: 640px; max-width: 100%; max-height: 80vh; display: flex; flex-direction: column; background: #fff; border-radius: 16px; box-shadow: 0 30px 70px rgba(15,23,42,.3); overflow: hidden; }
.ha-head { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; border-bottom: 1px solid #eef2f7; }
.ha-title { display: flex; align-items: center; gap: 12px; }
.ha-spark { display: grid; width: 38px; height: 38px; place-items: center; border-radius: 11px; background: linear-gradient(135deg,#6366f1,#8b5cf6); color: #fff; }
.ha-spark svg { width: 19px; height: 19px; }
.ha-title h2 { margin: 0; font-size: 16px; font-weight: 850; }
.ha-title small { color: #94a3b8; font-size: 11.5px; }
.ha-x { border: 0; background: transparent; color: #64748b; cursor: pointer; } .ha-x svg { width: 18px; height: 18px; }
.ha-body { flex: 1; overflow-y: auto; padding: 18px 20px 22px; }
.ha-ask { display: flex; align-items: center; gap: 10px; border: 1px solid #d8e2f0; border-radius: 12px; padding: 4px 6px 4px 14px; }
.ha-ask:focus-within { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.12); }
.ha-ask > svg { width: 18px; height: 18px; color: #94a3b8; }
.ha-ask input { flex: 1; border: 0; outline: 0; height: 40px; font-size: 14px; }
.ask-btn { display: grid; place-items: center; width: 36px; height: 36px; border: 0; border-radius: 9px; background: #4f46e5; color: #fff; cursor: pointer; }
.ask-btn:disabled { opacity: .5; } .ask-btn svg { width: 17px; height: 17px; }
.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
.ha-loading { display: grid; place-items: center; gap: 12px; padding: 36px 0; color: #94a3b8; }
.ha-loading .dot { display: inline-block; width: 8px; height: 8px; margin: 0 3px; border-radius: 50%; background: #c7d2fe; animation: bounce 1.2s infinite; }
.ha-loading .dot:nth-child(2) { animation-delay: .15s; } .ha-loading .dot:nth-child(3) { animation-delay: .3s; }
@keyframes bounce { 0%,80%,100% { transform: scale(.7); opacity: .5; } 40% { transform: scale(1); opacity: 1; } }
.ha-loading p { margin: 0; font-size: 13px; }
.ha-state { display: grid; place-items: center; gap: 10px; padding: 36px 0; color: #64748b; } .ha-state svg { width: 30px; height: 30px; color: #f59e0b; }
.ha-answer { margin-top: 18px; }
.answer-text { margin: 0; color: #0f172a; font-size: 14.5px; line-height: 1.65; }
.ha-sources { margin-top: 20px; } .ha-sources h3 { margin: 0 0 10px; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; font-weight: 850; }
.source { display: flex; align-items: flex-start; gap: 11px; width: 100%; border: 1px solid #e5ebf3; border-radius: 11px; background: #fff; padding: 12px; margin-bottom: 8px; text-align: left; cursor: pointer; }
.source:hover { border-color: #c7d2fe; background: #fbfcff; }
.s-num { display: grid; width: 22px; height: 22px; flex-shrink: 0; place-items: center; border-radius: 6px; background: #eef2ff; color: #4f46e5; font-size: 11px; font-weight: 850; }
.s-text { min-width: 0; flex: 1; }
.s-text strong { display: block; font-size: 12.5px; font-weight: 800; }
.s-text small { display: block; margin-top: 3px; color: #64748b; font-size: 11.5px; line-height: 1.5; }
.s-text small :deep(mark) { background: #fef3c7; padding: 0 2px; border-radius: 3px; }
.s-open { flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px; color: #4f46e5; font-size: 11.5px; font-weight: 800; } .s-open svg { width: 13px; height: 13px; }
.ha-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.act { display: inline-flex; align-items: center; gap: 6px; height: 36px; border: 1px solid #dbe4f0; border-radius: 9px; background: #fff; padding: 0 14px; color: #334155; font-size: 12.5px; font-weight: 700; cursor: pointer; }
.act svg { width: 14px; height: 14px; }
.act.primary { background: #4f46e5; color: #fff; border-color: #4f46e5; }
.ha-noanswer { display: grid; place-items: center; gap: 12px; padding: 28px 0; text-align: center; color: #64748b; }
.ha-noanswer svg { width: 32px; height: 32px; color: #cbd5e1; } .ha-noanswer p { margin: 0; font-size: 13.5px; max-width: 380px; }
.ha-hint { margin-top: 18px; color: #64748b; font-size: 13px; }
.ha-hint p { margin: 0 0 12px; }
.examples { display: flex; flex-wrap: wrap; gap: 8px; }
.examples button { border: 1px solid #dbe4f0; border-radius: 999px; background: #fff; padding: 7px 13px; color: #334155; font-size: 12px; font-weight: 600; cursor: pointer; }
.examples button:hover { border-color: #c7d2fe; color: #4f46e5; }
@media (max-width: 640px) { .ha-backdrop { padding: 4vh 12px 12px; } }
</style>
