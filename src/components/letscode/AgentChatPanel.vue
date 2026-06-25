<template>
  <div class="acp">
    <div class="acp-head">
      <div class="acp-head-top">
        <Icon icon="lucide:sparkles" class="logo" />
        <span class="title">Agentic AI</span>
      </div>
      <div class="acp-head-sel">
        <label class="sel" title="Agent persona">
          <Icon icon="lucide:bot" />
          <select v-model="agentId">
            <option value="">Default agent</option>
            <option v-for="a in agents" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </label>
        <label class="sel" title="Model">
          <Icon icon="lucide:cpu" />
          <select v-model="modelId">
            <option value="">Auto model</option>
            <option v-for="m in models" :key="m.id" :value="m.id">{{ m.label }}</option>
          </select>
        </label>
      </div>
    </div>

    <div ref="scrollEl" class="acp-msgs vm-scroll">
      <div v-if="!messages.length" class="acp-empty">
        <span class="orb"><Icon icon="lucide:wand-2" /></span>
        <p class="t">Ask the agent to code</p>
        <p class="s">Describe a change and it will plan, edit your project, and show a diff to accept.</p>
        <div class="chips">
          <button v-for="c in CHIPS" :key="c" class="chip" :disabled="!crsReady" @click="send(c)">{{ c }}</button>
        </div>
      </div>

      <div v-for="(m, i) in messages" :key="i" class="msg" :class="m.role">
        <div v-if="m.role === 'user'" class="bubble user">{{ m.text }}</div>
        <template v-else>
          <div class="ai-row"><span class="ai-ic"><Icon icon="lucide:sparkles" /></span><span class="ai-nm">Agentic AI</span></div>
          <div v-if="m.task && m.task.plan && m.task.plan.length" class="ai-plan">
            <div class="ai-plan-h">Plan</div>
            <ol><li v-for="(s, si) in m.task.plan" :key="si">{{ s }}</li></ol>
          </div>
          <div v-if="isRunning(m.task)" class="ai-run">
            <span class="vm-orb is-live"></span> {{ statusLabel(m.task) }}…
          </div>
          <div v-if="m.task && m.task.error_message" class="ai-err">
            <Icon icon="lucide:alert-triangle" /> {{ m.task.error_message }}
          </div>
          <div v-if="m.task && m.task.diff_summary && m.task.diff_summary.answer" class="ai-answer">{{ m.task.diff_summary.answer }}</div>
          <div v-if="m.task && m.task.diff_summary && m.task.diff_summary.ask_user" class="ai-clarify">
            <div class="clq"><Icon icon="lucide:help-circle" /> {{ m.task.diff_summary.ask_user.question }}</div>
            <div class="copts">
              <button v-for="o in m.task.diff_summary.ask_user.options" :key="o.id"
                      class="copt" :class="{ custom: o.id === 'CUSTOM' }" @click="onClarify(m, o)">
                <span class="cl">{{ o.label }}</span>
                <span v-if="o.description" class="cd">{{ o.description }}</span>
              </button>
            </div>
            <div v-if="m.task.diff_summary.ask_user.reason" class="creason">{{ m.task.diff_summary.ask_user.reason }}</div>
          </div>
          <ProposedChangesCard
            v-if="m.task && hasDiff(m.task)"
            :task="m.task" :busy="busy" :exporting="exporting === m.task.id"
            @accept="onExport(m)" @keep="onKeep(m)" @discard="onDiscard(m)" @copy="onCopy(m)"
            @revert-file="onRevertFile(m, $event)" @revert-hunk="onRevertHunk(m, $event)"
          />
        </template>
      </div>
    </div>

    <div class="acp-composer">
      <div v-if="!crsReady" class="acp-gate"><span class="vm-orb is-idle"></span> Indexing project — chat unlocks when ready.</div>
      <div class="acp-input">
        <textarea
          v-model="input" rows="2" :disabled="!crsReady || sending"
          placeholder="Ask Agentic AI to code, refactor or debug…"
          @keydown.enter.exact.prevent="send()"
        ></textarea>
        <button class="send" :disabled="!crsReady || sending || !input.trim()" @click="send()">
          <Icon :icon="sending ? 'lucide:loader-2' : 'lucide:arrow-up'" :class="{ spin: sending }" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { Icon } from '@iconify/vue'
import api from '../../services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import ProposedChangesCard from './ProposedChangesCard.vue'

const props = defineProps({
  systemId: { type: [String, Number], required: true },
  repoId: { type: [String, Number], required: true },
  crsReady: { type: Boolean, default: false },
  agentName: { type: String, default: '' },
})
const emit = defineEmits(['changed', 'activity', 'proposal'])

const CHIPS = ['Add input validation + tests', 'Refactor for readability', 'Fix bugs you can find', 'Write a README']
const messages = ref([])
const input = ref('')
const sending = ref(false)
const busy = ref(false)
const exporting = ref(false)
const scrollEl = ref(null)
const models = ref([])
const modelId = ref('')   // '' = Auto (server picks the user's default usable model)
const agents = ref([])
const agentId = ref('')   // '' = no persona override (coding loop default)
let timer = null

async function loadPickers() {
  try {
    const { data } = await api.getLLMModels()
    const list = data?.results || data || []
    models.value = list.filter(m => !m.is_embedding).map(m => ({ id: m.id, label: m.name || m.model_id }))
  } catch { models.value = [] }
  try {
    const { data } = await api.getAgents()
    const list = data?.results || data || []
    agents.value = list.map(a => ({ id: a.id, name: a.name }))
  } catch { agents.value = [] }
}
onMounted(loadPickers)

const RUNNING = ['queued', 'planning', 'editing', 'verifying', 'exporting']
const isRunning = (t) => t && RUNNING.includes(t.status)
const hasDiff = (t) => t && (t.diff_summary?.files?.length || t.diff_text)
const statusLabel = (t) => ({
  queued: 'Queued', planning: 'Planning', editing: 'Editing', verifying: 'Verifying', exporting: 'Exporting',
}[t?.status] || 'Working')

function scrollDown() { nextTick(() => { const e = scrollEl.value; if (e) e.scrollTop = e.scrollHeight }) }

function pollTask(msg) {
  if (timer) clearInterval(timer)
  timer = setInterval(async () => {
    try {
      const { data } = await api.getCodingTask(props.systemId, props.repoId, msg.task.id)
      msg.task = data
      emit('activity', (data.steps || []).map(s => s.message))
      if (!isRunning(data)) {
        clearInterval(timer); timer = null; sending.value = false
        emit('changed'); emit('proposal', hasDiff(data) ? data : null); scrollDown()
      }
    } catch { clearInterval(timer); timer = null; sending.value = false }
  }, 1600)
}

async function send(text) {
  const prompt = (text || input.value).trim()
  if (!prompt) return
  if (!props.crsReady) { notify.warning('The project is still indexing — please wait.'); return }
  messages.value.push({ role: 'user', text: prompt })
  input.value = ''
  sending.value = true
  scrollDown()
  try {
    const { data } = await api.startCodingTask(props.systemId, props.repoId, prompt, modelId.value || null, agentId.value || null)
    const msg = { role: 'assistant', task: data }
    messages.value.push(msg)
    scrollDown()
    pollTask(msg)
  } catch (e) {
    sending.value = false
    const d = e?.response?.data || {}
    if (e?.response?.status === 403 && d.disabled) {
      messages.value.push({ role: 'assistant', task: { error_message: 'Coding is disabled on the server (CODING_WORKSPACE_ENABLED).' } })
    } else {
      notify.error(d.error || 'Failed to start coding')
    }
  }
}

async function onExport(m) {
  const ok = await confirm({
    title: 'Accept & open a pull request?',
    message: 'This pushes a new feature branch and opens a PR. The default branch is never touched.',
    confirmText: 'Accept & PR', cancelText: 'Cancel',
  })
  if (!ok) return
  exporting.value = m.task.id
  try {
    const { data } = await api.exportCodingTask(props.systemId, props.repoId, m.task.id)
    m.task = data
    notify.info('Opening branch + PR…')
    pollExport(m)
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Export failed'); exporting.value = false
  }
}
function pollExport(m) {
  if (timer) clearInterval(timer)
  timer = setInterval(async () => {
    try {
      const { data } = await api.getCodingTask(props.systemId, props.repoId, m.task.id)
      m.task = data
      if (data.status !== 'exporting') { clearInterval(timer); timer = null; exporting.value = false
        if (data.pr_url) notify.success('Pull request opened'); emit('changed') }
    } catch { clearInterval(timer); timer = null; exporting.value = false }
  }, 1600)
}
function onKeep(m) { notify.success('Changes kept in your project'); m.task = { ...m.task, _kept: true }; emit('changed') }
async function onRevertFile(m, path) {
  busy.value = true
  try {
    const { data } = await api.revertCodingFile(props.systemId, props.repoId, m.task.id, path)
    m.task = data
    notify.success(`Rejected ${path}`)
    emit('changed'); emit('proposal', hasDiff(data) ? data : null)
  } catch (e) { notify.error(e?.response?.data?.error || 'Failed to reject file') }
  finally { busy.value = false }
}
async function onRevertHunk(m, { path, hunk }) {
  busy.value = true
  try {
    const { data } = await api.revertCodingHunk(props.systemId, props.repoId, m.task.id, path, hunk)
    m.task = data
    notify.success('Change rejected')
    emit('changed'); emit('proposal', hasDiff(data) ? data : null)
  } catch (e) { notify.error(e?.response?.data?.error || 'Failed to reject change') }
  finally { busy.value = false }
}
async function onDiscard(m) {
  const ok = await confirm({ title: 'Discard these changes?', message: 'The edits will be reverted in your project.', confirmText: 'Discard', cancelText: 'Keep', danger: true })
  if (!ok) return
  busy.value = true
  try {
    const { data } = await api.discardCodingTask(props.systemId, props.repoId, m.task.id)
    m.task = data; notify.success('Changes discarded'); emit('changed'); emit('proposal', null)
  } catch (e) { notify.error(e?.response?.data?.error || 'Discard failed') } finally { busy.value = false }
}
async function onCopy(m) {
  try { await navigator.clipboard.writeText(m.task.diff_text || ''); notify.success('Patch copied') }
  catch { notify.error('Could not copy') }
}
function onClarify(m, o) {
  const base = (m.task && m.task.prompt) || ''
  if (!o || o.id === 'CUSTOM' || (o.label || '').toLowerCase() === 'custom') {
    input.value = base ? `${base} — ` : ''
    notify.info('Type your specific instruction, then send')
    nextTick(() => { const el = scrollEl.value?.parentElement?.querySelector('textarea'); el && el.focus() })
    return
  }
  const clarified = `${base}\n\nClarification: ${o.label}${o.description ? ' — ' + o.description : ''}`
  send(clarified)
}

onBeforeUnmount(() => { if (timer) clearInterval(timer) })
</script>

<style scoped>
.acp { display: flex; flex-direction: column; height: 100%; background: var(--vm-surface); border-left: 1px solid var(--vm-line); font-family: var(--vm-font-sans); }
.acp-head { display: flex; flex-direction: column; gap: 8px; padding: 11px 14px; border-bottom: 1px solid var(--vm-line); flex: 0 0 auto; }
.acp-head-top { display: flex; align-items: center; gap: 7px; }
.acp-head .logo { width: 16px; height: 16px; color: var(--vm-violet-d); }
.acp-head .title { font: 800 13px var(--vm-font-sans); color: var(--vm-ink); letter-spacing: .02em; }
.acp-head-sel { display: flex; gap: 7px; }
.acp-head .sel { flex: 1; min-width: 0; display: inline-flex; align-items: center; gap: 5px; font: 600 11px var(--vm-font-sans); color: var(--vm-ink-soft); background: var(--vm-surface-soft); padding: 4px 6px 4px 9px; border-radius: 8px; }
.acp-head .sel :deep(svg) { width: 12px; height: 12px; flex: 0 0 auto; }
.acp-head .sel select { flex: 1; min-width: 0; border: none; background: transparent; font: 600 11px var(--vm-font-sans); color: var(--vm-ink); cursor: pointer; outline: none; }
.acp-msgs { flex: 1; min-height: 0; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 12px; }
.acp-empty { margin: auto; text-align: center; max-width: 30ch; }
.acp-empty .orb { width: 44px; height: 44px; border-radius: 14px; background: var(--vm-violet-soft); color: var(--vm-violet-d); display: inline-flex; align-items: center; justify-content: center; }
.acp-empty .orb :deep(svg) { width: 20px; height: 20px; }
.acp-empty .t { font: 700 14px var(--vm-font-sans); color: var(--vm-ink); margin-top: 10px; }
.acp-empty .s { font-size: 12.5px; color: var(--vm-ink-soft); margin-top: 4px; }
.acp-empty .chips { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-top: 12px; }
.chip { font: 600 11.5px var(--vm-font-sans); border: 1px solid var(--vm-line-2); background: var(--vm-surface); color: var(--vm-ink-soft); padding: 6px 10px; border-radius: 999px; cursor: pointer; }
.chip:hover:not(:disabled) { border-color: var(--vm-violet); color: var(--vm-violet-d); }
.chip:disabled { opacity: .5; cursor: not-allowed; }
.msg.user { display: flex; justify-content: flex-end; }
.bubble.user { background: var(--vm-g-brand); color: #fff; padding: 9px 13px; border-radius: 14px 14px 4px 14px; font-size: 13px; max-width: 85%; width: fit-content; }
.ai-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.ai-ic { width: 20px; height: 20px; border-radius: 6px; background: var(--vm-violet-soft); color: var(--vm-violet-d); display: inline-flex; align-items: center; justify-content: center; }
.ai-ic :deep(svg) { width: 12px; height: 12px; }
.ai-nm { font: 700 12px var(--vm-font-sans); color: var(--vm-ink); }
.ai-plan { background: var(--vm-surface-soft); border-radius: 10px; padding: 9px 12px; }
.ai-plan-h { font: 700 10px var(--vm-font-sans); text-transform: uppercase; letter-spacing: .05em; color: var(--vm-ink-faint); margin-bottom: 4px; }
.ai-plan ol { margin: 0; padding-left: 18px; } .ai-plan li { font-size: 12.5px; color: var(--vm-ink-soft); margin: 2px 0; }
.ai-run { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--vm-ink-soft); padding: 4px 0; }
.ai-answer { font-size: 13px; line-height: 1.55; color: var(--vm-ink-soft); background: var(--vm-surface-soft); border: 1px solid var(--vm-line); border-radius: 10px; padding: 10px 12px; white-space: pre-wrap; word-break: break-word; }
.ai-clarify { border: 1px solid var(--vm-line-2); border-radius: 12px; padding: 11px 12px; background: var(--vm-surface); }
.ai-clarify .clq { display: flex; align-items: center; gap: 7px; font: 700 13px var(--vm-font-sans); color: var(--vm-ink); margin-bottom: 9px; }
.ai-clarify .clq :deep(svg) { width: 15px; height: 15px; color: var(--vm-violet-d); flex: 0 0 auto; }
.copts { display: flex; flex-direction: column; gap: 6px; }
.copt { text-align: left; border: 1px solid var(--vm-line-2); background: var(--vm-surface); border-radius: 10px; padding: 8px 11px; cursor: pointer; display: flex; flex-direction: column; gap: 2px; transition: .15s var(--vm-ease2); }
.copt:hover { border-color: var(--vm-violet); background: var(--vm-violet-soft); }
.copt.custom { border-style: dashed; }
.copt .cl { font: 700 12.5px var(--vm-font-sans); color: var(--vm-ink); }
.copt .cd { font-size: 11.5px; color: var(--vm-ink-faint); }
.creason { font-size: 11px; color: var(--vm-ink-faint); margin-top: 8px; font-style: italic; }
.ai-err { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--vm-danger); background: rgba(239,68,68,.08); border-radius: 9px; padding: 8px 10px; }
.ai-err :deep(svg) { width: 15px; height: 15px; }
.acp-composer { flex: 0 0 auto; border-top: 1px solid var(--vm-line); padding: 10px 12px; }
.acp-gate { display: flex; align-items: center; gap: 7px; font-size: 11.5px; color: var(--vm-ink-faint); margin-bottom: 8px; }
.acp-input { display: flex; gap: 8px; align-items: flex-end; background: var(--vm-surface-soft); border: 1px solid var(--vm-line-2); border-radius: 14px; padding: 8px 8px 8px 12px; }
.acp-input textarea { flex: 1; border: none; background: transparent; resize: none; font: 13px var(--vm-font-sans); color: var(--vm-ink); outline: none; max-height: 120px; }
.send { width: 34px; height: 34px; flex: 0 0 auto; border: none; border-radius: 10px; background: var(--vm-g-brand); color: #fff; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
.send:disabled { opacity: .5; cursor: not-allowed; }
.send :deep(svg) { width: 17px; height: 17px; }
.spin { animation: acp-spin 1s linear infinite; } @keyframes acp-spin { to { transform: rotate(360deg); } }
</style>
