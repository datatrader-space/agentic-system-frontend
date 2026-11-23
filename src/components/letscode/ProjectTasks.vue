<!--
  ProjectTasks: background tasks of a Let's Code project (ADM-1328, LETS_CODE_EDITOR_GAPS_2026_PLAN.md G15). The person
  gives the Coding Agent a request or a GitHub issue of the project's own repository; it works on its own branch while
  the page is closed and ends in a pull request. GitHub's webhook brings the pull request's failed checks and reviews
  back as fix turns in the task's own chat, a bounded number of times. Opened from the editor's top bar, beside
  Variables. GET / POST /api/lets-code/projects/<repo_id>/tasks/. No native dialogs.
-->
<template>
  <div class="pt">
    <button
      ref="triggerEl" type="button" class="pt-trigger" aria-haspopup="dialog" :aria-expanded="open ? 'true' : 'false'"
      :aria-label="waitingCount ? `Background tasks, ${waitingCount} waiting for you` : 'Background tasks'"
      title="Background tasks that end in a pull request" data-test="tasks-open" @click="openPanel"
    >
      <Icon icon="lucide:list-checks" aria-hidden="true" />
      <span class="pt-trigger-t">Tasks</span>
      <span v-if="waitingCount" class="pt-badge" aria-hidden="true">{{ waitingCount }}</span>
    </button>

    <Teleport to="body">
      <div v-if="open" class="pt-overlay" :data-theme="ideTheme" @pointerdown.self="close">
        <div
          ref="dialogEl" class="pt-dialog" role="dialog" aria-modal="true" aria-labelledby="pt-title"
          aria-describedby="pt-desc" @keydown.esc.stop="close" @keydown.tab="trapTab"
        >
          <header class="pt-head">
            <div class="pt-head-t">
              <h2 id="pt-title" class="pt-title">Background tasks</h2>
              <p id="pt-desc" class="pt-desc">
                The Coding Agent works on a task on its own branch, while this page is closed, and ends in a pull
                request. When the pull request's checks fail or someone reviews it, it pushes fixes, up to
                {{ maxFixes }} times on its own. You get a notification when it needs you.
              </p>
            </div>
            <button ref="closeEl" type="button" class="pt-ibtn" aria-label="Close" @click="close"><Icon icon="lucide:x" /></button>
          </header>

          <div class="pt-body vm-scroll">
            <form class="pt-start" novalidate data-test="task-form" @submit.prevent="startTask">
              <fieldset class="pt-fs" :disabled="starting">
                <legend class="pt-legend">Start a task</legend>
                <label class="pt-label" for="pt-text">What should it do?</label>
                <textarea id="pt-text" v-model="text" class="pt-input pt-textarea" rows="3" maxlength="8000"
                          placeholder="Add a dark mode toggle to the settings page…" data-test="task-text"
                          :aria-invalid="startError ? 'true' : 'false'" :aria-describedby="startError ? 'pt-start-err' : 'pt-consent'"></textarea>
                <label class="pt-label" for="pt-issue">Or a GitHub issue of this repository</label>
                <input id="pt-issue" v-model="issueUrl" class="pt-input mono" type="url" inputmode="url" autocomplete="off"
                       spellcheck="false" placeholder="https://github.com/owner/repository/issues/123" data-test="task-issue"
                       :aria-invalid="startError ? 'true' : 'false'" />
                <p id="pt-consent" class="pt-hint">{{ consent }}</p>
                <p v-if="startError" id="pt-start-err" class="pt-err" role="alert">{{ startError }}</p>
                <div class="pt-row end">
                  <button type="submit" class="pt-btn primary" :disabled="starting || (!text.trim() && !issueUrl.trim())" data-test="task-start">
                    <Icon :icon="starting ? 'lucide:loader-2' : 'lucide:play'" :class="{ spin: starting }" aria-hidden="true" />
                    {{ starting ? 'Starting…' : 'Start task' }}
                  </button>
                </div>
              </fieldset>
            </form>

            <section class="pt-sec" aria-labelledby="pt-list-title">
              <h3 id="pt-list-title" class="pt-h3">Tasks</h3>
              <div v-if="loading && !loaded" class="pt-skel" aria-busy="true" aria-label="Loading the tasks"><span v-for="n in 3" :key="n"></span></div>
              <div v-else-if="loadError" class="pt-load-err" role="alert">
                <p>{{ loadError }}</p>
                <button type="button" class="pt-btn" @click="load">Try again</button>
              </div>
              <p v-else-if="!tasks.length" class="pt-empty">No tasks yet. Start one above.</p>
              <ul v-else class="pt-list" aria-label="Tasks" aria-live="polite">
                <li v-for="t in tasks" :key="t.task_id" class="pt-task" :data-test="`task-${t.task_id}`">
                  <div class="pt-task-main">
                    <span class="pt-task-title">{{ t.title }}</span>
                    <span class="pt-chip" :class="t.state" :data-test="`task-state-${t.task_id}`">
                      <Icon :icon="stateIcon(t.state)" :class="{ spin: t.state === 'running' }" aria-hidden="true" />
                      {{ t.state_label }}
                    </span>
                  </div>
                  <div class="pt-meta">
                    <code class="pt-branch" translate="no" :title="`Branch ${t.branch}`"><Icon icon="lucide:git-branch" aria-hidden="true" /> {{ t.branch }}</code>
                    <a v-if="t.pr_url" class="pt-link" :href="t.pr_url" target="_blank" rel="noopener noreferrer" data-test="task-pr">
                      <Icon icon="lucide:git-pull-request" aria-hidden="true" /> Pull request #{{ t.pr_number }}
                      <span class="sr-only">(opens GitHub in a new tab)</span>
                    </a>
                    <a v-if="t.issue_url" class="pt-link" :href="t.issue_url" target="_blank" rel="noopener noreferrer">
                      Issue #{{ t.issue_number }}<span class="sr-only"> (opens GitHub in a new tab)</span>
                    </a>
                    <span v-if="t.pr_url" class="pt-fixes">{{ t.fixes_used }} of {{ t.fixes_max }} automatic fixes</span>
                  </div>
                  <p v-if="t.status_reason" class="pt-reason">{{ t.status_reason }}</p>
                  <div class="pt-actions">
                    <button type="button" class="pt-btn sm" :aria-label="`Open the chat of ${t.title}`" @click="openChat(t)">
                      <Icon icon="lucide:message-square" aria-hidden="true" /> Open chat
                    </button>
                    <button v-if="!ENDED.has(t.state)" type="button" class="pt-btn sm ghost danger" :disabled="stopping === t.task_id"
                            :aria-label="`Stop ${t.title}`" @click="stopTask(t)">
                      <Icon :icon="stopping === t.task_id ? 'lucide:loader-2' : 'lucide:square'" :class="{ spin: stopping === t.task_id }" aria-hidden="true" /> Stop
                    </button>
                  </div>
                </li>
              </ul>
            </section>

            <section class="pt-sec" aria-labelledby="pt-hook-title">
              <h3 id="pt-hook-title" class="pt-h3">Checks and reviews from GitHub</h3>
              <template v-if="!webhook.set_up">
                <p class="pt-text">
                  So the agent hears about failed checks and reviews, GitHub sends them to AADML. Connect it once for
                  this repository; AADML adds the webhook with your GitHub account when GitHub allows it.
                </p>
              </template>
              <template v-else>
                <p class="pt-text" data-test="hook-state">
                  <Icon icon="lucide:check-circle-2" class="pt-ok" aria-hidden="true" />
                  Connected for {{ webhook.repository }}.
                  {{ webhook.last_delivery_at ? `Last heard from GitHub ${when(webhook.last_delivery_at)}.` : 'Nothing heard from GitHub yet.' }}
                </p>
              </template>
              <div v-if="reveal" class="pt-reveal" data-test="hook-reveal">
                <p class="pt-warn" role="status">{{ reveal.github_refused }}</p>
                <label class="pt-label" for="pt-hook-url">Payload URL</label>
                <div class="pt-row">
                  <input id="pt-hook-url" class="pt-input mono" type="text" readonly :value="reveal.url" />
                  <button type="button" class="pt-ibtn" aria-label="Copy the payload URL" title="Copy" @click="copy(reveal.url)"><Icon icon="lucide:copy" /></button>
                </div>
                <label class="pt-label" for="pt-hook-secret">Secret (shown this once)</label>
                <div class="pt-row">
                  <input id="pt-hook-secret" class="pt-input mono" :type="showSecret ? 'text' : 'password'" readonly :value="reveal.secret" autocomplete="off" />
                  <button type="button" class="pt-ibtn" :aria-label="showSecret ? 'Hide the secret' : 'Show the secret'" :title="showSecret ? 'Hide' : 'Show'" @click="showSecret = !showSecret">
                    <Icon :icon="showSecret ? 'lucide:eye-off' : 'lucide:eye'" />
                  </button>
                  <button type="button" class="pt-ibtn" aria-label="Copy the secret" title="Copy" @click="copy(reveal.secret)"><Icon icon="lucide:copy" /></button>
                </div>
                <p class="pt-hint">Content type: application/json. Events: {{ (reveal.events || []).join(', ') }}.</p>
              </div>
              <p v-if="hookError" class="pt-err" role="alert">{{ hookError }}</p>
              <div class="pt-row end">
                <button v-if="webhook.set_up" type="button" class="pt-btn sm ghost" :disabled="hookBusy" @click="setUpHook(true)">
                  Make a new secret
                </button>
                <button v-if="!webhook.set_up" type="button" class="pt-btn" :disabled="hookBusy" data-test="hook-connect" @click="setUpHook(false)">
                  <Icon :icon="hookBusy ? 'lucide:loader-2' : 'lucide:webhook'" :class="{ spin: hookBusy }" aria-hidden="true" />
                  {{ hookBusy ? 'Connecting…' : 'Connect GitHub checks' }}
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import tasksApi from '@/services/projectTasksApi'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import { useIdeTheme } from '@/composables/useIdeTheme'
import { usePoller } from '@/composables/usePoller'

const { theme: ideTheme } = useIdeTheme()
const props = defineProps({ repoId: { type: Number, required: true } })
const emit = defineEmits(['open-chat'])

// A task in one of these has nothing left to stop.
const ENDED = new Set(['merged', 'closed', 'stopped'])
const STATE_ICONS = {
  running: 'lucide:loader-2', waiting: 'lucide:hand', no_pr: 'lucide:circle-dashed', pr_open: 'lucide:git-pull-request',
  needs_you: 'lucide:alert-circle', merged: 'lucide:git-merge', closed: 'lucide:x-circle', stopped: 'lucide:square',
}

const open = ref(false)
const loading = ref(false)
const loaded = ref(false)
const loadError = ref('')
const tasks = ref([])
const webhook = ref({ set_up: false, events: [] })
const maxFixes = ref(3)
const consent = ref('')
const text = ref('')
const issueUrl = ref('')
const starting = ref(false)
const startError = ref('')
const stopping = ref('')
const hookBusy = ref(false)
const hookError = ref('')
const reveal = ref(null)                 // { url, secret, events, github_refused }: shown once, never stored
const showSecret = ref(false)
const triggerEl = ref(null)
const dialogEl = ref(null)
const closeEl = ref(null)

const waitingCount = computed(() => tasks.value.filter((t) => t.state === 'waiting' || t.state === 'needs_you').length)

function stateIcon(state) { return STATE_ICONS[state] || 'lucide:circle' }
function when(iso) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

async function load({ signal } = {}) {
  loading.value = true
  try {
    const { data } = await tasksApi.list(props.repoId, { signal })
    tasks.value = Array.isArray(data?.tasks) ? data.tasks : []
    webhook.value = data?.webhook || { set_up: false, events: [] }
    if (data?.max_auto_fixes) maxFixes.value = data.max_auto_fixes
    if (data?.consent) consent.value = data.consent
    loadError.value = ''
    loaded.value = true
    return data
  } catch (e) {
    if (!loaded.value) loadError.value = e?.response?.data?.error || 'The tasks could not be loaded.'
    throw e
  } finally {
    loading.value = false
  }
}
// While the panel is open its tasks stay current; the page pauses it when hidden.
const poller = usePoller(load, { interval: 5000 })

async function startTask() {
  startError.value = ''
  if (starting.value || (!text.value.trim() && !issueUrl.value.trim())) return
  starting.value = true
  try {
    const { data } = await tasksApi.start(props.repoId, { text: text.value.trim(), issue_url: issueUrl.value.trim() })
    if (data?.task) tasks.value = [data.task, ...tasks.value.filter((t) => t.task_id !== data.task.task_id)]
    text.value = ''
    issueUrl.value = ''
    notify.success('Task started. It works on its own branch; you get a notification when it needs you.')
    poller.refresh()
  } catch (e) {
    startError.value = e?.response?.data?.error || 'The task was not started.'
  } finally {
    starting.value = false
  }
}

async function stopTask(t) {
  const ok = await confirm({
    title: 'Stop this task?',
    message: `"${t.title}" stops now and makes no more automatic fixes. Its branch and pull request stay on GitHub.`,
    confirmText: 'Stop task',
    danger: true,
  })
  if (!ok) return
  stopping.value = t.task_id
  try {
    const { data } = await tasksApi.stop(props.repoId, t.task_id)
    if (data?.task) tasks.value = tasks.value.map((x) => (x.task_id === t.task_id ? data.task : x))
  } catch (e) {
    notify.error(e?.response?.data?.error || 'The task was not stopped.')
  } finally {
    stopping.value = ''
  }
}

async function setUpHook(newSecret) {
  if (newSecret) {
    const ok = await confirm({
      title: 'Make a new secret?',
      message: 'GitHub\'s deliveries are refused until you put the new secret in the webhook\'s settings on GitHub.',
      confirmText: 'Make a new secret',
      danger: true,
    })
    if (!ok) return
  }
  hookBusy.value = true
  hookError.value = ''
  try {
    const { data } = await tasksApi.setUpWebhook(props.repoId, newSecret ? { new_secret: true } : {})
    webhook.value = { ...webhook.value, ...data }
    reveal.value = data?.secret ? { url: data.url, secret: data.secret, events: data.events, github_refused: data.github_refused } : null
    showSecret.value = false
    if (!data?.secret) notify.success('GitHub checks and reviews are connected.')
  } catch (e) {
    hookError.value = e?.response?.data?.error || 'GitHub was not connected.'
  } finally {
    hookBusy.value = false
  }
}

async function copy(value) {
  try {
    await navigator.clipboard.writeText(String(value || ''))
    notify.success('Copied')
  } catch {
    notify.error('Could not copy. Select the text and copy it.')
  }
}

function openChat(t) {
  emit('open-chat', t.conversation_id)
  close()
}

async function openPanel() {
  open.value = true
  startError.value = ''
  poller.start()
  await nextTick()
  closeEl.value?.focus()
}
function close() {
  if (!open.value) return
  open.value = false
  poller.stop()
  reveal.value = null                     // the secret is never kept on the page
  showSecret.value = false
  nextTick(() => triggerEl.value?.focus())
}
function trapTab(e) {
  const items = [...(dialogEl.value?.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled)') || [])]
    .filter((el) => el.offsetParent !== null)
  if (!items.length) return
  const first = items[0]
  const last = items[items.length - 1]
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
}

watch(() => props.repoId, () => { close(); tasks.value = []; loaded.value = false; webhook.value = { set_up: false, events: [] } })
watch(open, (v) => { document.documentElement.style.overflow = v ? 'hidden' : '' })
onBeforeUnmount(() => { document.documentElement.style.overflow = ''; poller.stop() })

defineExpose({ openPanel, load })
</script>

<style scoped>
.pt { position: relative; --pt-on: #fff; }
.pt-trigger { position: relative; display: inline-flex; align-items: center; gap: 7px; min-height: 34px; padding: 0 12px; border: 1px solid var(--vm-line-2); border-radius: 8px; background: var(--vm-surface); color: var(--vm-ink); font: 600 13px var(--vm-font-sans); cursor: pointer; transition: border-color .15s, background-color .15s; touch-action: manipulation; }
.pt-trigger:hover { border-color: var(--vm-violet); background: var(--vm-violet-soft); }
.pt-trigger :deep(svg) { width: 15px; height: 15px; color: var(--vm-violet); }
.pt-trigger:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; }
.pt-badge { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: var(--vm-violet); color: var(--pt-on); font: 700 11px/18px var(--vm-font-sans); text-align: center; }

.pt-overlay { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 24px; background: color-mix(in srgb, #000 55%, transparent); backdrop-filter: blur(2px); overscroll-behavior: contain; }
.pt-dialog { width: min(680px, 100%); max-height: min(820px, calc(100vh - 48px)); display: flex; flex-direction: column; border: 1px solid var(--vm-line-2); border-radius: 16px; background: var(--vm-surface); color: var(--vm-ink); box-shadow: 0 30px 80px rgba(0, 0, 0, .35); overflow: hidden; font-family: var(--vm-font-sans); }
.pt-head { display: flex; align-items: flex-start; gap: 12px; padding: 18px 20px 14px; border-bottom: 1px solid var(--vm-line); }
.pt-head-t { flex: 1; min-width: 0; }
.pt-title { margin: 0; font: 800 18px/1.25 var(--vm-font-display); text-wrap: balance; }
.pt-desc { margin: 6px 0 0; max-width: 66ch; font-size: 13px; line-height: 1.5; color: var(--vm-ink-soft); }
.pt-body { flex: 1; min-height: 0; overflow-y: auto; padding: 14px 20px 18px; overscroll-behavior: contain; }

.pt-fs { margin: 0; padding: 12px 14px 14px; border: 1px solid var(--vm-line-2); border-radius: 10px; min-width: 0; }
.pt-legend { padding: 0 6px; font-size: 13px; font-weight: 700; }
.pt-label { display: block; margin: 10px 0 5px; font-size: 12.5px; font-weight: 600; color: var(--vm-ink-soft); }
.pt-input { width: 100%; min-height: 38px; padding: 0 11px; border: 1px solid var(--vm-line-2); border-radius: 8px; background: var(--vm-surface); color: var(--vm-ink); font: 13px var(--vm-font-sans); transition: border-color .15s, box-shadow .15s; }
.pt-input.mono { font-family: var(--vm-font-mono); font-size: 12.5px; }
.pt-input::placeholder { color: var(--vm-ink-faint); opacity: .7; }
.pt-input:focus { outline: none; border-color: var(--vm-focus); box-shadow: 0 0 0 3px color-mix(in srgb, var(--vm-focus) 18%, transparent); }
.pt-input[aria-invalid="true"] { border-color: var(--vm-danger); }
.pt-textarea { min-height: 76px; padding: 8px 11px; resize: vertical; line-height: 1.5; }
.pt-hint { margin: 10px 0 0; font-size: 12px; line-height: 1.5; color: var(--vm-ink-soft); }
.pt-err { margin: 8px 0 0; font-size: 12.5px; color: var(--vm-red-ink); }
.pt-warn { margin: 0 0 6px; padding: 9px 12px; border: 1px solid color-mix(in srgb, var(--vm-violet) 35%, transparent); border-radius: 8px; background: var(--vm-violet-soft); font-size: 13px; line-height: 1.5; }
.pt-row { display: flex; align-items: center; gap: 6px; }
.pt-row.end { justify-content: flex-end; margin-top: 12px; }

.pt-sec { margin-top: 20px; }
.pt-h3 { margin: 0 0 8px; font: 700 14px var(--vm-font-sans); }
.pt-text { margin: 0; font-size: 13px; line-height: 1.5; color: var(--vm-ink-soft); display: flex; align-items: flex-start; gap: 6px; }
.pt-ok { flex: 0 0 auto; width: 15px; height: 15px; margin-top: 2px; color: var(--vm-green-ink, var(--vm-violet)); }
.pt-empty { margin: 4px 0; font-size: 13.5px; color: var(--vm-ink-faint); }
.pt-list { list-style: none; margin: 0; padding: 0; }
.pt-task { padding: 12px 0; border-bottom: 1px solid var(--vm-line); }
.pt-task-main { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.pt-task-title { flex: 1 1 240px; min-width: 0; font-size: 13.5px; font-weight: 600; overflow-wrap: anywhere; }
.pt-chip { display: inline-flex; align-items: center; gap: 5px; padding: 2px 9px; border: 1px solid var(--vm-line-2); border-radius: 999px; font-size: 12px; font-weight: 600; color: var(--vm-ink-soft); white-space: nowrap; }
.pt-chip :deep(svg) { width: 13px; height: 13px; }
.pt-chip.running, .pt-chip.pr_open { color: var(--vm-violet); border-color: color-mix(in srgb, var(--vm-violet) 40%, transparent); }
.pt-chip.waiting, .pt-chip.needs_you { color: var(--vm-red-ink); border-color: color-mix(in srgb, var(--vm-danger) 40%, transparent); }
.pt-chip.merged { color: var(--vm-green-ink, var(--vm-ink)); }
.pt-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; margin-top: 6px; font-size: 12.5px; color: var(--vm-ink-soft); }
.pt-branch { display: inline-flex; align-items: center; gap: 4px; font: 12px var(--vm-font-mono); color: var(--vm-ink-soft); overflow-wrap: anywhere; }
.pt-branch :deep(svg), .pt-link :deep(svg) { width: 13px; height: 13px; }
.pt-link { display: inline-flex; align-items: center; gap: 4px; color: var(--vm-link, var(--vm-violet)); font-weight: 600; text-decoration: none; }
.pt-link:hover { text-decoration: underline; }
.pt-link:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; border-radius: 4px; }
.pt-reason { margin: 6px 0 0; font-size: 12.5px; color: var(--vm-ink); }
.pt-actions { display: flex; gap: 6px; margin-top: 8px; }
.pt-reveal { margin-top: 10px; }
.pt-skel { display: flex; flex-direction: column; gap: 10px; }
.pt-skel span { height: 54px; border-radius: 8px; background: var(--vm-surface-soft); animation: pt-pulse 1.4s ease-in-out infinite; }
.pt-load-err { padding: 12px 0; color: var(--vm-ink-soft); font-size: 13.5px; }
.pt-load-err p { margin: 0 0 10px; }

.pt-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 38px; padding: 0 15px; border: 1px solid var(--vm-line-2); border-radius: var(--vm-r); background: var(--vm-surface); color: var(--vm-ink); font: 600 13px var(--vm-font-sans); cursor: pointer; transition: border-color .15s, background-color .15s; touch-action: manipulation; white-space: nowrap; }
.pt-btn:hover:not(:disabled) { border-color: var(--vm-violet); background: var(--vm-violet-soft); }
.pt-btn.sm { min-height: 30px; padding: 0 10px; font-size: 12.5px; }
.pt-btn.ghost { border-color: transparent; background: transparent; }
.pt-btn.ghost:hover:not(:disabled) { border-color: var(--vm-line-2); background: var(--vm-surface-soft); }
.pt-btn.danger { color: var(--vm-red-ink); }
.pt-btn.primary { background: var(--vm-violet); border-color: var(--vm-violet); color: var(--pt-on); }
.pt-btn.primary:hover:not(:disabled) { background: var(--vm-violet-d); border-color: var(--vm-violet-d); }
.pt-btn:disabled { opacity: .55; cursor: not-allowed; }
.pt-btn :deep(svg) { width: 15px; height: 15px; }
.pt-ibtn { display: grid; place-items: center; width: 36px; height: 36px; flex: 0 0 auto; border: none; border-radius: 8px; background: transparent; color: var(--vm-ink-soft); cursor: pointer; touch-action: manipulation; }
.pt-ibtn:hover { background: var(--vm-surface-soft); color: var(--vm-ink); }
.pt-ibtn :deep(svg) { width: 17px; height: 17px; }
.pt-btn:focus-visible, .pt-ibtn:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

.spin { animation: pt-spin 1s linear infinite; }
@keyframes pt-spin { to { transform: rotate(360deg); } }
@keyframes pt-pulse { 50% { opacity: .5; } }

@media (max-width: 900px) { .pt-trigger-t { display: none; } }
@media (max-width: 640px) {
  .pt-overlay { padding: 12px; }
  .pt-input { min-height: 44px; font-size: 16px; }
  .pt-input.mono { font-size: 15px; }
  .pt-btn, .pt-btn.sm, .pt-ibtn, .pt-trigger { min-height: 44px; }
  .pt-ibtn { width: 44px; height: 44px; }
}
@media (prefers-reduced-motion: reduce) { .spin, .pt-skel span { animation: none; } }
</style>
