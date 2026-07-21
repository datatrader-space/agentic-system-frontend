<template>
  <main class="training-page">
    <header class="page-head">
      <div>
        <h1>Training Data</h1>
        <p>Control whether your agent runs are captured to improve the models, and pull your own corpus.</p>
      </div>
      <span class="status-chip" :class="consent.allow_training ? 'on' : 'off'">
        <Icon :icon="consent.allow_training ? 'lucide:circle-check' : 'lucide:circle-slash'" />
        {{ consent.allow_training ? 'Capturing' : 'Excluded' }}
      </span>
    </header>

    <!-- ── Consent ─────────────────────────────────────────────────────── -->
    <section class="panel">
      <header class="section-head">
        <div>
          <h2>Capture consent</h2>
          <p>Capture is <strong>on by default</strong>. Turn it off any time to exclude your runs from training.
             Secrets are always scrubbed at capture; personal data is redacted on export.</p>
        </div>
      </header>

      <div v-if="loadingConsent" class="state-banner">Loading your preferences…</div>

      <div v-else class="toggle-list">
        <label class="toggle-row master">
          <span class="tr-text">
            <b>Capture my agent runs for training</b>
            <em>Exact prompts, reasoning, tool calls and outcomes from your chats &amp; tasks.</em>
          </span>
          <input type="checkbox" class="switch" v-model="consent.allow_training" />
        </label>

        <label v-for="k in kinds" :key="k.key"
               class="toggle-row sub" :class="{ dim: !consent.allow_training }">
          <span class="tr-text"><b>{{ k.label }}</b><em>{{ k.hint }}</em></span>
          <input type="checkbox" class="switch" v-model="consent[k.key]" :disabled="!consent.allow_training" />
        </label>

        <label class="toggle-row sub" :class="{ dim: !consent.allow_training }">
          <span class="tr-text">
            <b>Redact personal data on export</b>
            <em>Replace emails / phone numbers / tokens with placeholders when the corpus leaves the system.</em>
          </span>
          <input type="checkbox" class="switch" v-model="consent.pii_redact_on_export" :disabled="!consent.allow_training" />
        </label>
      </div>

      <footer class="panel-foot">
        <button class="primary" :disabled="savingConsent || loadingConsent" @click="saveConsent">
          <Icon icon="lucide:save" /> {{ savingConsent ? 'Saving…' : 'Save preferences' }}
        </button>
        <span v-if="!consent.explicit && !loadingConsent" class="muted">
          You're on the default (capture on). Saving records your explicit choice.
        </span>
      </footer>
    </section>

    <!-- ── Corpus ──────────────────────────────────────────────────────── -->
    <section class="panel">
      <header class="section-head">
        <div>
          <h2>Your training corpus</h2>
          <p>Preview and download the samples captured from your own runs, in the format you need.</p>
        </div>
      </header>

      <div class="corpus-controls">
        <div class="pills">
          <button v-for="f in FORMATS" :key="f.key"
                  :class="['pill', { active: fmt === f.key }]" :title="f.hint" @click="fmt = f.key">
            {{ f.label }}
          </button>
        </div>
        <div class="corpus-actions">
          <button class="ghost" :disabled="loadingCorpus" @click="preview">
            <Icon icon="lucide:eye" /> {{ loadingCorpus ? 'Assembling…' : 'Preview' }}
          </button>
          <button class="primary" :disabled="!rows.length" @click="download">
            <Icon icon="lucide:download" /> Download JSONL
          </button>
        </div>
      </div>

      <p class="fmt-hint">{{ activeFormat.hint }}</p>

      <div v-if="corpus" class="corpus-meta">
        <span><b>{{ corpus.count }}</b> samples</span>
        <span>from <b>{{ corpus.runs }}</b> run(s)</span>
        <span>{{ corpus.redacted ? 'PII redacted' : 'raw' }}</span>
        <span>capped at {{ corpus.capped_at }} runs</span>
      </div>

      <div v-if="loadingCorpus" class="state-banner">Assembling samples…</div>
      <pre v-else-if="rows.length" class="json-preview">{{ previewText }}</pre>
      <div v-else-if="corpus" class="state-banner empty">No samples captured for this format yet.</div>
      <div v-else class="state-banner empty">Pick a format and hit <b>Preview</b>.</div>

      <p v-if="rows.length > PREVIEW_N" class="muted small">
        Showing first {{ PREVIEW_N }} of {{ rows.length }} — download for the full set.
      </p>
    </section>
  </main>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import api from '../services/api'
import { useNotify } from '../composables/useNotify'

const notify = useNotify()

// ── consent ──
const consent = reactive({
  allow_training: true, capture_llm_io: true, capture_reasoning: true,
  capture_tool_io: true, pii_redact_on_export: true, explicit: false, default_on: true,
})
const loadingConsent = ref(true)
const savingConsent = ref(false)
const kinds = [
  { key: 'capture_llm_io', label: 'Prompts & responses', hint: 'The exact model input and its answer for each step.' },
  { key: 'capture_reasoning', label: 'Model reasoning', hint: 'The chain-of-thought the model produced.' },
  { key: 'capture_tool_io', label: 'Tool inputs & outputs', hint: 'Verbatim arguments and results of every tool call.' },
]

async function loadConsent() {
  loadingConsent.value = true
  try {
    const { data } = await api.getTrainingConsent()
    Object.assign(consent, data)
  } catch (e) {
    notify.error(e?.response?.data?.detail || 'Failed to load your preferences')
  } finally {
    loadingConsent.value = false
  }
}

async function saveConsent() {
  savingConsent.value = true
  try {
    await api.setTrainingConsent({
      allow_training: consent.allow_training,
      capture_llm_io: consent.capture_llm_io,
      capture_reasoning: consent.capture_reasoning,
      capture_tool_io: consent.capture_tool_io,
      pii_redact_on_export: consent.pii_redact_on_export,
    })
    consent.explicit = true
    notify.success('Training preferences saved')
  } catch (e) {
    notify.error(e?.response?.data?.detail || 'Failed to save preferences')
  } finally {
    savingConsent.value = false
  }
}

// ── corpus ──
const FORMATS = [
  { key: 'sft', label: 'SFT', hint: 'Supervised: system + messages + tools → completion (one per LLM round).' },
  { key: 'trajectory', label: 'Trajectory', hint: 'The full ordered agentic run: reasoning → tool call → result → answer.' },
  { key: 'toolcall', label: 'Tool calls', hint: 'Function-calling pairs: tool + arguments → result / error.' },
  { key: 'preference', label: 'Preference', hint: 'DPO pairs from your feedback: chosen vs rejected answers.' },
  { key: 'plan', label: 'Plan', hint: 'Planning: request → triage decision + plan steps with rationale.' },
]
const PREVIEW_N = 20
const fmt = ref('sft')
const corpus = ref(null)
const rows = ref([])
const loadingCorpus = ref(false)
const activeFormat = computed(() => FORMATS.find((f) => f.key === fmt.value) || FORMATS[0])
const previewText = computed(() =>
  rows.value.slice(0, PREVIEW_N).map((r) => JSON.stringify(r, null, 2)).join('\n\n'))

async function preview() {
  loadingCorpus.value = true
  corpus.value = null
  rows.value = []
  try {
    const { data } = await api.pullTrainingCorpus(fmt.value)
    corpus.value = data
    rows.value = data.rows || []
  } catch (e) {
    notify.error(e?.response?.data?.detail || 'Failed to pull your corpus')
  } finally {
    loadingCorpus.value = false
  }
}

function download() {
  if (!rows.value.length) return
  const jsonl = rows.value.map((r) => JSON.stringify(r)).join('\n')
  const blob = new Blob([jsonl], { type: 'application/x-ndjson' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `agent-corpus-${fmt.value}.jsonl`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

onMounted(loadConsent)
</script>

<style scoped>
.training-page { max-width: 940px; margin: 0 auto; padding: 24px 20px 64px; display: flex; flex-direction: column; gap: 20px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h1 { font-size: 1.6rem; font-weight: 700; margin: 0; }
.page-head p { margin: 6px 0 0; opacity: .7; max-width: 60ch; }

.status-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px;
  font-size: .82rem; font-weight: 600; white-space: nowrap; }
.status-chip.on { background: rgba(34,197,94,.14); color: #16a34a; }
.status-chip.off { background: rgba(148,163,184,.18); color: #64748b; }

.panel { border: 1px solid rgba(148,163,184,.22); border-radius: 14px; background: rgba(148,163,184,.05);
  padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.section-head h2 { font-size: 1.12rem; font-weight: 700; margin: 0; }
.section-head p { margin: 4px 0 0; opacity: .7; font-size: .9rem; max-width: 70ch; }

.toggle-list { display: flex; flex-direction: column; gap: 2px; }
.toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 12px 4px; border-bottom: 1px solid rgba(148,163,184,.14); }
.toggle-row:last-child { border-bottom: none; }
.toggle-row.master { padding-bottom: 14px; }
.toggle-row.sub { padding-left: 12px; }
.toggle-row.dim { opacity: .45; }
.tr-text { display: flex; flex-direction: column; gap: 3px; }
.tr-text b { font-weight: 600; font-size: .95rem; }
.tr-text em { font-style: normal; opacity: .65; font-size: .82rem; }

/* Switch */
.switch { appearance: none; -webkit-appearance: none; width: 42px; height: 24px; border-radius: 999px;
  background: rgba(148,163,184,.4); position: relative; cursor: pointer; transition: background .16s; flex: none; }
.switch::after { content: ''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px;
  border-radius: 50%; background: #fff; transition: transform .16s; box-shadow: 0 1px 3px rgba(0,0,0,.25); }
.switch:checked { background: var(--accent, #6366f1); }
.switch:checked::after { transform: translateX(18px); }
.switch:disabled { cursor: not-allowed; }

.panel-foot { display: flex; align-items: center; gap: 14px; }
.muted { opacity: .6; font-size: .84rem; }
.muted.small { font-size: .78rem; }

.corpus-controls { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.pills { display: flex; gap: 6px; flex-wrap: wrap; }
.pill { padding: 7px 13px; border-radius: 999px; border: 1px solid rgba(148,163,184,.3);
  background: transparent; color: inherit; cursor: pointer; font-size: .84rem; font-weight: 500; transition: all .14s; }
.pill:hover { border-color: rgba(148,163,184,.55); }
.pill.active { background: var(--accent, #6366f1); border-color: var(--accent, #6366f1); color: #fff; }
.corpus-actions { display: flex; gap: 8px; }
.fmt-hint { margin: 0; opacity: .6; font-size: .82rem; }

.corpus-meta { display: flex; gap: 16px; flex-wrap: wrap; font-size: .84rem; opacity: .8; }
.corpus-meta b { font-weight: 700; }

.json-preview { margin: 0; max-height: 460px; overflow: auto; padding: 14px; border-radius: 10px;
  background: rgba(15,23,42,.75); color: #cbd5e1; font-size: .76rem; line-height: 1.5;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre; }

.state-banner { padding: 16px; border-radius: 10px; background: rgba(148,163,184,.1); font-size: .88rem; opacity: .85; }
.state-banner.empty { text-align: center; }

button.primary, button.ghost { display: inline-flex; align-items: center; gap: 7px; padding: 8px 15px;
  border-radius: 9px; font-size: .86rem; font-weight: 600; cursor: pointer; border: 1px solid transparent; transition: all .14s; }
button.primary { background: var(--accent, #6366f1); color: #fff; }
button.primary:hover:not(:disabled) { filter: brightness(1.08); }
button.ghost { background: transparent; border-color: rgba(148,163,184,.35); color: inherit; }
button.ghost:hover:not(:disabled) { border-color: rgba(148,163,184,.6); }
button:disabled { opacity: .5; cursor: not-allowed; }
</style>
