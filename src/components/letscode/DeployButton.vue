<template>
  <div class="dp">
    <button
      ref="triggerEl" type="button" class="dp-trigger" :class="{ busy: !!current?.active, ok: current?.state === 'READY' && !current?.active }"
      aria-haspopup="dialog" :aria-expanded="open" :disabled="!ready"
      :title="ready ? 'Deploy this project to Vercel' : 'The project is still being prepared'" @click="openPanel"
    >
      <Icon :icon="current?.active ? 'lucide:loader-2' : 'simple-icons:vercel'" :class="{ spin: current?.active }" aria-hidden="true" />
      <span>{{ current?.active ? stateLabel(current.state) : 'Deploy' }}</span>
    </button>

    <Teleport to="body">
      <div v-if="open" class="dp-overlay" @pointerdown.self="close">
        <div ref="dialogEl" class="dp-dialog" role="dialog" aria-modal="true" aria-labelledby="dp-title" @keydown.esc.stop="close" @keydown.tab="trapTab">

          <!-- Header: the project and where it deploys -->
          <header class="dp-head">
            <div class="dp-proj-ic" aria-hidden="true"><Icon icon="lucide:box" /></div>
            <div class="dp-head-t">
              <p class="dp-crumb">Deployments <Icon icon="lucide:chevron-right" aria-hidden="true" /> <b>{{ projectName || 'Project' }}</b></p>
              <h2 id="dp-title" class="dp-title">{{ projectName || 'Project' }}</h2>
              <p class="dp-sub"><Icon icon="simple-icons:vercel" aria-hidden="true" /> Deployment to <b>Vercel</b>
                <template v-if="conn.connected"> · <span class="dp-acct">{{ conn.account_name || 'your account' }}</span></template></p>
            </div>
            <div class="dp-head-a">
              <a v-if="conn.connected && current?.inspector_url" class="dp-btn" :href="current.inspector_url" target="_blank" rel="noopener noreferrer">
                <Icon icon="lucide:external-link" aria-hidden="true" /> View on Vercel
              </a>
              <div v-if="conn.connected" class="dp-more">
                <button type="button" class="dp-ibtn" aria-label="More" :aria-expanded="moreOpen" @click="moreOpen = !moreOpen"><Icon icon="lucide:more-horizontal" /></button>
                <div v-if="moreOpen" class="dp-menu" role="menu">
                  <button type="button" role="menuitem" :disabled="disconnecting" @click="disconnect">
                    <Icon icon="lucide:unplug" aria-hidden="true" /> {{ disconnecting ? 'Disconnecting' : 'Disconnect Vercel' }}
                  </button>
                </div>
              </div>
              <button ref="closeEl" type="button" class="dp-ibtn" aria-label="Close" @click="close"><Icon icon="lucide:x" /></button>
            </div>
          </header>

          <div class="dp-body vm-scroll">
            <div v-if="loading" class="dp-skel" aria-busy="true"><span></span><span></span><span></span></div>

            <!-- Not set up on this server -->
            <div v-else-if="!conn.configured" class="dp-center">
              <Icon icon="lucide:plug-zap" class="dp-big-ic" aria-hidden="true" />
              <p>Vercel deploys are not set up on this server yet.</p>
            </div>

            <!-- Connect Vercel -->
            <div v-else-if="!conn.connected" class="cv">
              <div class="cv-logos" aria-hidden="true">
                <span class="cv-logo aadml"><img :src="AADML_LOGO" alt="" /></span>
                <span class="cv-dots"><i></i><i></i><i></i></span>
                <span class="cv-logo vercel"><Icon icon="simple-icons:vercel" /></span>
              </div>
              <h3 class="cv-h">{{ conn.needs_reconnect ? 'Reconnect Vercel' : 'Connect Vercel' }}</h3>
              <p class="cv-p">{{ conn.needs_reconnect ? 'Your Vercel connection stopped working. Connect it again to keep deploying.'
                : 'Link your Vercel workspace with AADML to deploy, monitor and manage this project.' }}</p>
              <div class="cv-field">
                <span class="cv-lbl">Workspace</span>
                <div class="cv-ws"><Icon icon="lucide:users" aria-hidden="true" /> You choose your account or team on Vercel's page</div>
              </div>
              <div class="cv-field">
                <span class="cv-lbl">AADML will be able to:</span>
                <ul class="cv-perms">
                  <li v-for="p in PERMS" :key="p.t"><Icon :icon="p.i" class="pi" aria-hidden="true" /><span>{{ p.t }}</span><Icon icon="lucide:check" class="ck" aria-hidden="true" /></li>
                </ul>
              </div>
              <button type="button" class="dp-btn primary wide" :disabled="connecting" @click="connect">
                {{ connecting ? 'Waiting for Vercel' : 'Continue to Vercel' }}
                <Icon :icon="connecting ? 'lucide:loader-2' : 'lucide:arrow-right'" :class="{ spin: connecting }" aria-hidden="true" />
              </button>
              <p class="cv-fine">Your sites deploy to your own account. No Vercel account? Signing up is free.</p>
            </div>

            <!-- Connected -->
            <template v-else>
              <div class="tabs" role="tablist" aria-label="Deployment settings">
                <button v-for="t in TABS" :id="`dp-tab-${t.k}`" :key="t.k" type="button" role="tab" class="tab"
                        :aria-selected="tab === t.k" :aria-controls="`dp-pane-${t.k}`" :tabindex="tab === t.k ? 0 : -1"
                        @click="tab = t.k" @keydown.right.prevent="moveTab(1)" @keydown.left.prevent="moveTab(-1)">
                  <Icon :icon="t.i" aria-hidden="true" /> {{ t.l }}
                </button>
              </div>

              <div v-show="tab === 'deploy'" id="dp-pane-deploy" role="tabpanel" aria-labelledby="dp-tab-deploy" class="pane">
                <DeployProgress v-if="current" :dep="current" :lines="logLines" :branch="branch" :project-name="projectName" @open-env="tab = 'env'" />
                <div v-else class="dp-center">
                  <Icon icon="lucide:rocket" class="dp-big-ic" aria-hidden="true" />
                  <p class="dp-center-h">Not deployed yet</p>
                  <p>Deploy a preview first: it gets its own link. Publish to production when you are happy with it.</p>
                </div>
              </div>
              <div v-if="visited.domains" v-show="tab === 'domains'" id="dp-pane-domains" role="tabpanel" aria-labelledby="dp-tab-domains" class="pane">
                <DeployDomains :repo-id="repoId" />
              </div>
              <div v-if="visited.env" v-show="tab === 'env'" id="dp-pane-env" role="tabpanel" aria-labelledby="dp-tab-env" class="pane">
                <DeployEnv :repo-id="repoId" :skipped-paths="current?.skipped_paths || []" />
              </div>
              <div v-show="tab === 'history'" id="dp-pane-history" role="tabpanel" aria-labelledby="dp-tab-history" class="pane">
                <p v-if="!deployments.length" class="dp-muted">No deploys yet.</p>
                <ul v-else class="hist">
                  <li v-for="d in deployments" :key="d.id" class="hist-row">
                    <span class="hist-dot" :class="toneOf(d.state)" aria-hidden="true"></span>
                    <span class="hist-t"><b>{{ d.target === 'production' ? 'Production' : 'Preview' }}</b> · {{ stateLabel(d.state) }}</span>
                    <span class="hist-by">{{ d.started_by === 'agent' ? 'Coding Agent' : 'You' }}</span>
                    <span class="hist-when">{{ when(d.created_at) }}</span>
                    <a v-if="d.url && d.state === 'READY'" class="dp-ibtn" :href="d.url" target="_blank" rel="noopener noreferrer" :aria-label="`Open the ${d.target} deploy from ${when(d.created_at)}`"><Icon icon="lucide:external-link" /></a>
                  </li>
                </ul>
              </div>
            </template>
          </div>

          <!-- Actions -->
          <footer v-if="conn.configured && conn.connected && !loading" class="dp-foot">
            <p class="dp-foot-note"><Icon icon="lucide:shield-check" aria-hidden="true" /> Files with secrets (.env, keys) are never uploaded.</p>
            <button v-if="current?.active" type="button" class="dp-btn" :disabled="cancelling" @click="cancel">
              <Icon icon="lucide:square" aria-hidden="true" /> {{ cancelling ? 'Cancelling' : 'Cancel' }}
            </button>
            <button type="button" class="dp-btn" :disabled="!!starting || !!current?.active" @click="deploy('production')">
              <Icon :icon="starting === 'production' ? 'lucide:loader-2' : 'lucide:globe'" :class="{ spin: starting === 'production' }" aria-hidden="true" /> Publish to production
            </button>
            <button type="button" class="dp-btn primary" :disabled="!!starting || !!current?.active" @click="deploy('preview')">
              <Icon :icon="starting === 'preview' ? 'lucide:loader-2' : 'lucide:rocket'" :class="{ spin: starting === 'preview' }" aria-hidden="true" /> Deploy preview
            </button>
          </footer>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
// Deploy a Let's Code project to the person's OWN Vercel account (ADM-1203, LETS_CODE_VERCEL_DEPLOY_PLAN.md):
// connect once, deploy a preview, watch it build, open it live, publish to production after confirming, and set the
// project's domains and environment variables. The Vercel token never reaches the browser.
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { Icon } from '@iconify/vue'
import api from '@/services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import { runOAuthPopup } from '@/composables/useOAuthPopup'
import { usePoller } from '@/composables/usePoller'
import DeployProgress from './deploy/DeployProgress.vue'
import DeployDomains from './deploy/DeployDomains.vue'
import DeployEnv from './deploy/DeployEnv.vue'

const props = defineProps({
  repoId: { type: Number, required: true },
  projectName: { type: String, default: '' },
  branch: { type: String, default: '' },
  ready: { type: Boolean, default: true },
})

// The app icon from public/, as a plain URL (not a bundled import).
const AADML_LOGO = "/icon-192.png"
const PERMS = [
  { i: 'lucide:folder', t: 'Create and update projects' },
  { i: 'lucide:rocket', t: 'Create deployments' },
  { i: 'lucide:file-text', t: 'Read build logs' },
  { i: 'lucide:globe', t: 'Add custom domains' },
  { i: 'lucide:key-round', t: 'Set environment variables' },
]
const TABS = [
  { k: 'deploy', l: 'Deployment', i: 'lucide:rocket' },
  { k: 'domains', l: 'Domains', i: 'lucide:globe' },
  { k: 'env', l: 'Environment variables', i: 'lucide:key-round' },
  { k: 'history', l: 'History', i: 'lucide:history' },
]
const LABELS = { PREPARING: 'Uploading files', QUEUED: 'Queued', INITIALIZING: 'Starting the build', BUILDING: 'Building',
  READY: 'Ready', ERROR: 'Build failed', FAILED: 'Not deployed', CANCELED: 'Cancelled' }
const stateLabel = (s) => LABELS[s] || s || ''
const toneOf = (s) => (s === 'READY' ? 'ok' : ['ERROR', 'FAILED'].includes(s) ? 'bad' : s === 'CANCELED' ? 'off' : 'run')
const errorOf = (e, f) => e?.response?.data?.error || e?.message || f
function when(iso) {
  const d = iso ? new Date(iso) : null
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
}

const open = ref(false)
const loading = ref(false)
const conn = ref({ configured: true, connected: false, account_name: '', is_team: false, needs_reconnect: false })
const deployments = ref([])
const logLines = ref([])
const tab = ref('deploy')
const visited = reactive({ domains: false, env: false })
const connecting = ref(false)
const disconnecting = ref(false)
const starting = ref('')
const cancelling = ref(false)
const moreOpen = ref(false)
const triggerEl = ref(null)
const dialogEl = ref(null)
const closeEl = ref(null)
const current = computed(() => deployments.value[0] || null)

watch(tab, (t) => { if (t in visited) visited[t] = true })

async function load() {
  loading.value = !deployments.value.length && open.value
  try {
    const { data } = await api.getVercelDeployments(props.repoId)
    deployments.value = data.deployments || []
    if (data.connection) conn.value = data.connection
  } catch (e) {
    if (open.value) notify.error(errorOf(e, 'Could not load the deployments'))
  } finally {
    loading.value = false
  }
  if (current.value) {
    if (current.value.active) poller.start()
    else if (open.value && !logLines.value.length && current.value.has_build) refreshLog()
  }
}

async function refreshLog() {
  try { logLines.value = (await api.getVercelDeployment(props.repoId, current.value.id, { log: true })).data.log || [] } catch { /* shown as empty */ }
}

// Follows the running deploy (state + live log) until Vercel says it is done.
const poller = usePoller(async ({ signal }) => {
  const dep = current.value
  if (!dep) return null
  const { data } = await api.getVercelDeployment(props.repoId, dep.id, { log: open.value })
  if (signal?.aborted) return data
  if (data.log) logLines.value = data.log
  deployments.value = [{ ...dep, ...data }, ...deployments.value.slice(1)]
  if (!data.active) {
    if (data.state === 'READY') notify.success(dep.target === 'production' ? 'Your site is live on Vercel' : 'Preview is live on Vercel')
    else if (['ERROR', 'FAILED'].includes(data.state)) notify.error(data.error || 'The deploy did not finish')
  }
  return data
}, { interval: 3000, stopWhen: (d) => !d || !d.active })

function connect() {
  connecting.value = true             // the popup opens inside this click (runOAuthPopup), before any await
  runOAuthPopup(async () => (await api.startVercelConnect()).data?.url, {
    messageTypes: ['vercel_connect_result'],
    verify: async () => !!(await api.getVercelConnection()).data?.connected,
    name: 'vercel-connect',
    timeoutMs: 300000,
  }).then(async (result) => {
    if (result.ok) { await load(); notify.success('Vercel connected') }
    else if (!['cancelled', 'closed'].includes(result.status)) notify.error(result.error || 'Vercel was not connected')
  }).finally(() => { connecting.value = false })
}

async function disconnect() {
  moreOpen.value = false
  if (!(await confirm({ title: 'Disconnect Vercel?', message: 'AADML will no longer deploy to your Vercel account. Sites already deployed stay on Vercel.', confirmText: 'Disconnect', danger: true }))) return
  disconnecting.value = true
  try {
    const { data } = await api.disconnectVercel()
    conn.value = { ...conn.value, connected: false, account_name: '', needs_reconnect: false }
    if (data?.removed_on_vercel === false) notify.error('Disconnected here. Vercel could not be reached: remove AADML under Integrations in your Vercel settings.')
    else notify.success('Vercel disconnected')
  } catch (e) { notify.error(errorOf(e, 'Could not disconnect Vercel')) }
  finally { disconnecting.value = false }
}

async function deploy(target) {
  const body = { target }
  if (target === 'production') {
    const ok = await confirm({
      title: 'Publish to production?',
      message: `This updates the public site of ${props.projectName || 'this project'} on your Vercel account (${conn.value.account_name || 'Vercel'}). People visiting it will see this version.`,
      confirmText: 'Publish', danger: true,
    })
    if (!ok) return
    body.confirm = true
  }
  starting.value = target
  try {
    const { data } = await api.deployToVercel(props.repoId, body)
    deployments.value = [data, ...deployments.value]
    logLines.value = []
    tab.value = 'deploy'
    poller.start()
  } catch (e) {
    if (e?.response?.data?.code === 'VERCEL_NOT_CONNECTED') conn.value = { ...conn.value, connected: false }
    notify.error(errorOf(e, 'The deploy did not start'))
  } finally { starting.value = '' }
}

async function cancel() {
  const dep = current.value
  if (!dep) return
  cancelling.value = true
  try {
    const { data } = await api.cancelVercelDeployment(props.repoId, dep.id)
    deployments.value = [{ ...dep, ...data }, ...deployments.value.slice(1)]
  } catch (e) { notify.error(errorOf(e, 'Could not cancel the deploy')) }
  finally { cancelling.value = false }
}

function moveTab(step) {
  const i = TABS.findIndex((t) => t.k === tab.value)
  tab.value = TABS[(i + step + TABS.length) % TABS.length].k
  nextTick(() => dialogEl.value?.querySelector(`#dp-tab-${tab.value}`)?.focus())
}

async function openPanel() {
  open.value = true
  moreOpen.value = false
  load()
  await nextTick()
  closeEl.value?.focus()
}
function close() {
  if (!open.value) return
  open.value = false
  nextTick(() => triggerEl.value?.focus())
}
function trapTab(e) {
  const items = [...(dialogEl.value?.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"], summary, iframe') || [])]
    .filter((el) => el.offsetParent !== null)
  if (!items.length) return
  const first = items[0]
  const last = items[items.length - 1]
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
}

watch(() => props.repoId, () => { deployments.value = []; logLines.value = []; poller.stop(); load() })
watch(open, (v) => { document.documentElement.style.overflow = v ? 'hidden' : '' })
onMounted(load)                // a deploy started from the chat shows as running on the button too
onBeforeUnmount(() => { poller.stop(); document.documentElement.style.overflow = '' })

defineExpose({ load, openPanel })
</script>

<style scoped>
.dp { position: relative; --dp-on: #fff; }
.dp-trigger { display: inline-flex; align-items: center; gap: 7px; min-height: 34px; padding: 0 13px; border: 1px solid var(--vm-line-2); border-radius: 8px; background: var(--vm-ink); color: var(--vm-surface); font: 600 13px var(--vm-font-sans); cursor: pointer; transition: opacity .15s, box-shadow .15s; }
.dp-trigger:hover:not(:disabled) { opacity: .9; box-shadow: 0 2px 10px color-mix(in srgb, var(--vm-ink) 25%, transparent); }
.dp-trigger.busy { background: var(--vm-violet); border-color: var(--vm-violet); color: var(--dp-on); }
.dp-trigger:disabled { opacity: .5; cursor: not-allowed; }
.dp-trigger :deep(svg) { width: 14px; height: 14px; }
.dp-trigger:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; }

.dp-overlay { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 24px; background: color-mix(in srgb, #000 55%, transparent); backdrop-filter: blur(2px); }
.dp-dialog { width: min(980px, 100%); max-height: min(880px, calc(100vh - 48px)); display: flex; flex-direction: column; border: 1px solid var(--vm-line-2); border-radius: 18px; background: var(--vm-surface); color: var(--vm-ink); box-shadow: 0 30px 80px rgba(0, 0, 0, .35); overflow: hidden; }

.dp-head { display: flex; align-items: center; gap: 14px; padding: 18px 20px; border-bottom: 1px solid var(--vm-line); }
.dp-proj-ic { display: grid; place-items: center; width: 48px; height: 48px; flex: 0 0 auto; border: 1px solid var(--vm-line-2); border-radius: 12px; background: var(--vm-surface-soft); }
.dp-proj-ic :deep(svg) { width: 22px; height: 22px; }
.dp-head-t { min-width: 0; flex: 1; }
.dp-crumb { display: flex; align-items: center; gap: 4px; margin: 0; font-size: 12px; color: var(--vm-ink-soft); }
.dp-crumb :deep(svg) { width: 12px; height: 12px; }
.dp-crumb b { color: var(--vm-ink); font-weight: 600; }
.dp-title { margin: 2px 0 0; font: 800 20px/1.2 var(--vm-font-display); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dp-sub { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin: 3px 0 0; font-size: 13px; color: var(--vm-ink-soft); }
.dp-sub :deep(svg) { width: 12px; height: 12px; color: var(--vm-ink); }
.dp-sub b { color: var(--vm-ink); }
.dp-acct { color: var(--vm-ink); font-weight: 600; }
.dp-head-a { display: flex; align-items: center; gap: 6px; }
.dp-more { position: relative; }
.dp-menu { position: absolute; right: 0; top: calc(100% + 4px); z-index: 2; min-width: 190px; padding: 4px; border: 1px solid var(--vm-line-2); border-radius: 10px; background: var(--vm-surface); box-shadow: 0 10px 30px rgba(0,0,0,.18); }
.dp-menu button { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 36px; padding: 0 10px; border: none; border-radius: 7px; background: transparent; color: var(--vm-danger); font: 600 13px var(--vm-font-sans); cursor: pointer; text-align: left; }
.dp-menu button:hover { background: color-mix(in srgb, var(--vm-danger) 8%, transparent); }
.dp-menu :deep(svg) { width: 15px; height: 15px; }

.dp-body { flex: 1; min-height: 0; overflow-y: auto; padding: 18px 20px 20px; }
.dp-skel { display: flex; flex-direction: column; gap: 10px; }
.dp-skel span { height: 64px; border-radius: 12px; background: var(--vm-surface-soft); }
.dp-center { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 40px 20px; text-align: center; color: var(--vm-ink-soft); font-size: 14px; }
.dp-center p { margin: 0; max-width: 46ch; line-height: 1.5; }
.dp-center-h { font: 700 16px var(--vm-font-sans); color: var(--vm-ink); }
.dp-big-ic { width: 34px; height: 34px; color: var(--vm-violet); margin-bottom: 6px; }
.dp-muted { margin: 0; color: var(--vm-ink-soft); font-size: 13px; }

/* Connect Vercel */
.cv { max-width: 520px; margin: 4px auto; display: flex; flex-direction: column; gap: 16px; }
.cv-logos { display: flex; align-items: center; justify-content: center; gap: 14px; }
.cv-logo { display: grid; place-items: center; width: 64px; height: 64px; border-radius: 16px; }
.cv-logo.aadml { border: 1.5px solid var(--vm-violet); background: color-mix(in srgb, var(--vm-violet) 10%, var(--vm-surface)); box-shadow: 0 0 24px color-mix(in srgb, var(--vm-violet) 30%, transparent); }
.cv-logo.aadml img { width: 40px; height: 40px; }
.cv-logo.vercel { border: 1.5px solid var(--vm-line-2); background: #000; color: #fff; }
.cv-logo.vercel :deep(svg) { width: 28px; height: 28px; }
.cv-dots { display: flex; gap: 5px; }
.cv-dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--vm-ink-faint); }
.cv-h { margin: 0; text-align: center; font: 800 26px var(--vm-font-display); }
.cv-p { margin: -6px 0 0; text-align: center; font-size: 14px; line-height: 1.5; color: var(--vm-ink-soft); }
.cv-field { display: flex; flex-direction: column; gap: 7px; }
.cv-lbl { font: 600 13px var(--vm-font-sans); }
.cv-ws { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 14px; border: 1px solid var(--vm-line-2); border-radius: 10px; background: var(--vm-surface-soft); font-size: 13.5px; color: var(--vm-ink-soft); }
.cv-ws :deep(svg) { width: 16px; height: 16px; }
.cv-perms { list-style: none; margin: 0; padding: 0; border: 1px solid var(--vm-line-2); border-radius: 12px; overflow: hidden; }
.cv-perms li { display: flex; align-items: center; gap: 12px; padding: 11px 14px; font-size: 14px; }
.cv-perms li + li { border-top: 1px solid var(--vm-line); }
.cv-perms span { flex: 1; }
.cv-perms .pi { width: 17px; height: 17px; color: var(--vm-ink-soft); }
.cv-perms .ck { width: 17px; height: 17px; color: var(--vm-violet); }
.cv-fine { margin: 0; text-align: center; font-size: 12.5px; color: var(--vm-ink-soft); }

/* Tabs */
.tabs { display: flex; gap: 2px; margin: -4px 0 16px; border-bottom: 1px solid var(--vm-line); overflow-x: auto; }
.tab { display: inline-flex; align-items: center; gap: 7px; min-height: 40px; padding: 0 12px; border: none; border-bottom: 2px solid transparent; margin-bottom: -1px; background: transparent; color: var(--vm-ink-soft); font: 600 13px var(--vm-font-sans); white-space: nowrap; cursor: pointer; }
.tab :deep(svg) { width: 15px; height: 15px; }
.tab:hover { color: var(--vm-ink); }
.tab[aria-selected="true"] { color: var(--vm-ink); border-bottom-color: var(--vm-violet); }
.tab:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: -2px; border-radius: 6px; }

.hist { list-style: none; margin: 0; padding: 0; border: 1px solid var(--vm-line-2); border-radius: 12px; overflow: hidden; }
.hist-row { display: flex; align-items: center; gap: 10px; min-height: 46px; padding: 0 12px; font-size: 13px; }
.hist-row + .hist-row { border-top: 1px solid var(--vm-line); }
.hist-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--vm-ink-faint); }
.hist-dot.ok { background: var(--vm-green, #16a34a); }
.hist-dot.bad { background: var(--vm-danger); }
.hist-dot.run { background: var(--vm-violet); }
.hist-t { flex: 1; min-width: 0; }
.hist-by, .hist-when { color: var(--vm-ink-soft); white-space: nowrap; }

/* Footer */
.dp-foot { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 14px 20px; border-top: 1px solid var(--vm-line); background: var(--vm-surface-soft); }
.dp-foot-note { display: flex; align-items: center; gap: 6px; margin: 0 auto 0 0; font-size: 12.5px; color: var(--vm-ink-soft); }
.dp-foot-note :deep(svg) { width: 14px; height: 14px; }

.dp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 38px; padding: 0 15px; border: 1px solid var(--vm-line-2); border-radius: var(--vm-r); background: var(--vm-surface); color: var(--vm-ink); font: 600 13px var(--vm-font-sans); text-decoration: none; cursor: pointer; transition: border-color .15s, background-color .15s; }
.dp-btn:hover:not(:disabled) { border-color: var(--vm-violet); background: var(--vm-violet-soft); }
.dp-btn.primary { background: var(--vm-violet); border-color: var(--vm-violet); color: var(--dp-on); }
.dp-btn.primary:hover:not(:disabled) { background: var(--vm-violet-d); border-color: var(--vm-violet-d); }
.dp-btn.wide { width: 100%; min-height: 46px; font-size: 14.5px; }
.dp-btn:disabled { opacity: .55; cursor: not-allowed; }
.dp-btn :deep(svg) { width: 15px; height: 15px; }
.dp-ibtn { display: grid; place-items: center; width: 36px; height: 36px; border: none; border-radius: 8px; background: transparent; color: var(--vm-ink-soft); cursor: pointer; }
.dp-ibtn:hover { background: var(--vm-surface-soft); color: var(--vm-ink); }
.dp-ibtn :deep(svg) { width: 17px; height: 17px; }
.dp-btn:focus-visible, .dp-ibtn:focus-visible, .dp-menu button:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; }

.spin { animation: dp-spin 1s linear infinite; }
@keyframes dp-spin { to { transform: rotate(360deg); } }

/* Phones: the window fills the screen; every target is at least 44px. */
@media (max-width: 640px) {
  .dp-overlay { padding: 0; }
  .dp-dialog { width: 100%; max-height: none; height: 100%; border-radius: 0; border: none; }
  .dp-head { padding: 12px 14px; }
  .dp-head-a .dp-btn { display: none; }
  .dp-body { padding: 14px; }
  .dp-foot { padding: 12px 14px; }
  .dp-foot-note { display: none; }
  .dp-foot .dp-btn { flex: 1 1 40%; min-height: 46px; }
  .dp-foot .dp-btn.primary { flex-basis: 100%; order: 3; }
  .dp-trigger { min-height: 44px; }
  .dp-ibtn { width: 44px; height: 44px; }
  .tab { min-height: 44px; }
}
@media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
</style>
