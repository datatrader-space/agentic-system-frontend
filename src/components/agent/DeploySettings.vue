<!--
  Deploy & Integrate — the single surface for connecting an agent to the outside world.
  Three independent channels, each its own toggle + inline config + integration guide:
    1. Live Chat (WebSocket)  — real-time streaming chat for your app   (agent.ws_chat_enabled)
    2. Webhook (async events) — backend triggers; advanced + monitoring  (agent.signal_enabled)
    3. Public Widget (embed)  — drop-in chat bubble for a public site    (share.is_public)
  Styled with the Vibrant Light Mesh system (vm tokens · lucide icons · gradient accents).
-->
<template>
  <Teleport to="body">
    <Transition name="di">
      <div v-if="modelValue" class="di-overlay">
        <div class="di-backdrop" @click="close"></div>
        <aside class="di-panel vm-scroll">
          <!-- header -->
          <header class="di-head">
            <div class="di-head-l">
              <span class="di-rocket"><Icon icon="lucide:rocket" :width="18" /></span>
              <div class="min-w-0">
                <h2 class="di-title">Deploy &amp; Integrate</h2>
                <p class="di-sub">Connect this agent to the outside world</p>
              </div>
              <span v-if="anyLive" class="di-livepill"><span class="vm-orb is-live"></span> Live</span>
            </div>
            <div class="di-head-r">
              <button class="di-publish" :disabled="busy" @click="publish">
                <Icon :icon="busy ? 'lucide:loader-2' : 'lucide:upload-cloud'" :width="15" :class="busy && 'di-spin'" />
                {{ busy ? 'Publishing…' : 'Publish Changes' }}
              </button>
              <button class="di-close" @click="close" aria-label="Close"><Icon icon="lucide:x" :width="18" /></button>
            </div>
          </header>

          <div v-if="loading" class="di-loading"><span class="vm-skel" style="width:180px;height:14px"></span></div>

          <div v-else class="di-body">
            <p class="di-intro">Turn on any combination of the three channels below — each works on its own.</p>

            <!-- ════════════ 1. LIVE CHAT (WebSocket) ════════════ -->
            <section class="di-card" :class="{ 'is-on': wsOn }">
              <div class="di-card-head">
                <span class="di-chip" :style="{ background: 'var(--vm-g-cool)' }"><Icon icon="lucide:messages-square" :width="20" /></span>
                <div class="di-card-meta">
                  <div class="di-card-title">Live Chat <span class="di-tag">WebSocket</span></div>
                  <div class="di-card-desc">Real-time streaming chat for your app — tools, HITL &amp; usage included.</div>
                </div>
                <button class="di-toggle" :class="wsOn && 'on on-cool'" :disabled="busy" @click="toggleWs"><span class="di-knob" /></button>
              </div>

              <div v-if="wsOn" class="di-card-body">
                <div>
                  <label class="di-label">WebSocket URL</label>
                  <div class="di-field"><code>{{ wsChatUrl }}</code><button class="di-iconbtn" title="Copy" @click="copy(wsChatUrl)"><Icon icon="lucide:copy" :width="15" /></button></div>
                </div>

                <div>
                  <label class="di-label">Access key <span class="di-label-hint">backend only — never ship to a browser</span></label>
                  <div class="di-field">
                    <code>{{ agent.signal_api_key ? (showApiKey ? agent.signal_api_key : '••••••••••••••••••••') : 'Not generated yet' }}</code>
                    <button v-if="agent.signal_api_key" class="di-iconbtn" :title="showApiKey ? 'Hide' : 'Show'" @click="showApiKey = !showApiKey"><Icon :icon="showApiKey ? 'lucide:eye-off' : 'lucide:eye'" :width="15" /></button>
                    <button class="di-btn" :disabled="rotatingKey" @click="rotateApiKey">
                      <Icon :icon="rotatingKey ? 'lucide:loader-2' : (agent.signal_api_key ? 'lucide:refresh-cw' : 'lucide:key-round')" :width="14" :class="rotatingKey && 'di-spin'" />
                      {{ agent.signal_api_key ? 'Rotate' : 'Generate' }}
                    </button>
                  </div>
                  <p class="di-hint">Auth: <code class="di-kbd">?token=&lt;KEY&gt;</code> or <code class="di-kbd">Authorization: Bearer &lt;KEY&gt;</code></p>
                </div>

                <!-- short-lived chat token for browser apps -->
                <div class="di-callout">
                  <div class="di-callout-head"><Icon icon="lucide:shield-check" :width="16" /> Browser app? Use a short-lived chat token</div>
                  <p class="di-callout-sub">Your backend mints one from the key — the browser never holds the access key.</p>
                  <div class="di-field di-field-sm">
                    <code>POST {{ chatTokenUrl }}</code>
                    <button class="di-iconbtn sm" title="Copy" @click="copy(chatTokenUrl)"><Icon icon="lucide:copy" :width="14" /></button>
                    <button class="di-btn sm" :disabled="mintingToken" @click="mintTestToken"><Icon :icon="mintingToken ? 'lucide:loader-2' : 'lucide:sparkles'" :width="13" :class="mintingToken && 'di-spin'" /> Test mint</button>
                  </div>
                  <div v-if="testToken" class="di-field di-field-sm" style="margin-top:8px">
                    <code class="di-ok">{{ testToken }}</code>
                    <span class="di-ttl">expires {{ testTokenTtl }}s</span>
                  </div>
                </div>

                <GuideLink tab="websocket" />
              </div>
            </section>

            <!-- ════════════ 2. WEBHOOK (async events) ════════════ -->
            <section class="di-card" :class="{ 'is-on': webhookOn }">
              <div class="di-card-head">
                <span class="di-chip" :style="{ background: 'var(--vm-g-teal)' }"><Icon icon="lucide:webhook" :width="19" /></span>
                <div class="di-card-meta">
                  <div class="di-card-title">Webhook <span class="di-tag">async events</span></div>
                  <div class="di-card-desc">Trigger the agent from backend events; poll the result. No live user needed.</div>
                </div>
                <button class="di-toggle" :class="webhookOn && 'on on-teal'" :disabled="busy" @click="toggleWebhook"><span class="di-knob" /></button>
              </div>

              <div v-if="webhookOn" class="di-card-body">
                <div>
                  <label class="di-label">POST URL</label>
                  <div class="di-field"><code>{{ webhookUrl }}</code><button class="di-iconbtn" title="Copy" @click="copy(webhookUrl)"><Icon icon="lucide:copy" :width="15" /></button></div>
                  <p class="di-hint">Auth: <code class="di-kbd">Bearer &lt;KEY&gt;</code> or HMAC <code class="di-kbd">X-Signature</code>. Returns <code class="di-kbd">202</code> + a <code class="di-kbd">result_url</code> to poll.</p>
                </div>

                <div class="di-acc">
                  <button class="di-acc-head" @click="showAdvanced = !showAdvanced">
                    <span><Icon icon="lucide:sliders-horizontal" :width="14" /> Advanced &amp; monitoring</span>
                    <Icon :icon="showAdvanced ? 'lucide:chevron-up' : 'lucide:chevron-down'" :width="16" class="di-acc-caret" />
                  </button>
                  <div v-if="!showAdvanced" class="di-acc-hint">Concurrency · stats · HMAC · Redis · test · log · dead letters</div>
                  <div v-if="showAdvanced" class="di-acc-body"><SignalPanel :agent="agent" mode="monitoring" /></div>
                </div>

                <GuideLink tab="webhook" />
              </div>
            </section>

            <!-- ════════════ 3. PUBLIC WIDGET (embed) ════════════ -->
            <section class="di-card" :class="{ 'is-on': share.is_public }">
              <div class="di-card-head">
                <span class="di-chip" :style="{ background: 'var(--vm-g-warm)' }"><Icon icon="lucide:globe" :width="19" /></span>
                <div class="di-card-meta">
                  <div class="di-card-title">Public Widget <span class="di-tag">embed</span></div>
                  <div class="di-card-desc">Drop-in chat bubble for a public website — anyone can chat, no login.</div>
                </div>
                <button class="di-toggle" :class="share.is_public && 'on on-warm'" :disabled="busy" @click="toggleShare"><span class="di-knob" /></button>
              </div>

              <div v-if="share.is_public" class="di-card-body di-widget">
                <div class="di-widget-cfg">
                  <div>
                    <label class="di-label">Share link</label>
                    <div class="di-field"><code>{{ shareUrl }}</code><button class="di-iconbtn" title="Copy" @click="copy(shareUrl)"><Icon icon="lucide:copy" :width="15" /></button><a :href="shareUrl" target="_blank" class="di-iconbtn" title="Open"><Icon icon="lucide:external-link" :width="15" /></a></div>
                    <button class="di-textbtn danger" @click="regenerate"><Icon icon="lucide:rotate-ccw" :width="12" /> Regenerate (revokes old)</button>
                  </div>

                  <div>
                    <label class="di-label">Embed code</label>
                    <pre class="di-pre">{{ embedCode }}</pre>
                    <button class="di-textbtn" @click="copy(embedCode)"><Icon icon="lucide:copy" :width="12" /> Copy code</button>
                  </div>

                  <div class="di-grid2">
                    <div>
                      <label class="di-label">Chat interface</label>
                      <div class="di-seg">
                        <button v-for="o in ['toggle','embedded']" :key="o" :class="{ on: s.chat_interface === o }" @click="s.chat_interface = o">
                          <Icon :icon="o === 'toggle' ? 'lucide:message-circle' : 'lucide:layout-panel-top'" :width="14" /> {{ o === 'toggle' ? 'Toggle' : 'Embedded' }}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label class="di-label">Launcher</label>
                      <div class="di-seg">
                        <button v-for="o in ['bubble','element']" :key="o" :class="{ on: s.launcher === o }" @click="s.launcher = o">
                          <Icon :icon="o === 'bubble' ? 'lucide:message-square' : 'lucide:square-mouse-pointer'" :width="14" /> {{ o === 'bubble' ? 'Bubble' : 'Element' }}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label class="di-label">Identity &amp; appearance</label>
                    <div class="di-stack">
                      <input v-model="s.branding.name" placeholder="Display name" class="di-input" />
                      <input v-model="s.branding.greeting" placeholder="Greeting message" class="di-input" />
                      <div class="di-row">
                        <input v-model="s.branding.avatar_url" placeholder="Avatar image URL" class="di-input" />
                        <label class="di-color"><input type="color" v-model="s.branding.theme_color" /></label>
                      </div>
                      <input v-model="s.button_image_url" placeholder="Launcher button image URL (defaults to avatar)" class="di-input" />
                    </div>
                  </div>

                  <div class="di-inline-toggle">
                    <div>
                      <div class="di-inline-title">Proactive message</div>
                      <div class="di-inline-desc">A nudge shown above the launcher</div>
                    </div>
                    <button class="di-toggle sm" :class="s.proactive.enabled && 'on on-violet'" @click="s.proactive.enabled = !s.proactive.enabled"><span class="di-knob" /></button>
                  </div>
                  <input v-if="s.proactive.enabled" v-model="s.proactive.text" placeholder="e.g. Need a hand? Ask me anything" class="di-input" />

                  <label class="di-check"><input type="checkbox" v-model="s.allow_uploads" /> Allow file uploads</label>

                  <div class="di-actions">
                    <button class="di-btn grow" :disabled="busy" @click="saveSettings"><Icon icon="lucide:save" :width="14" /> {{ busy ? 'Saving…' : 'Save widget settings' }}</button>
                    <GuideLink tab="widget" />
                  </div>
                </div>

                <div class="di-preview">
                  <div class="di-label">Live preview</div>
                  <div class="di-preview-frame"><iframe v-if="embedUrl" :key="previewKey" :src="embedUrl" frameborder="0"></iframe></div>
                </div>
              </div>
              <div v-else class="di-empty">Enable the share link to configure the webchat appearance.</div>
            </section>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, reactive, computed, watch, h } from 'vue'
import { RouterLink } from 'vue-router'
import { Icon } from '@iconify/vue'
import api from '../../services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import SignalPanel from '../SignalPanel.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  agent: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue'])
const close = () => emit('update:modelValue', false)

const loading = ref(false)
const busy = ref(false)
const share = ref({})
const previewKey = ref(0)
const showApiKey = ref(false)
const rotatingKey = ref(false)
const showAdvanced = ref(false)
const mintingToken = ref(false)
const testToken = ref('')
const testTokenTtl = ref(0)
const s = reactive({
  chat_interface: 'toggle', launcher: 'bubble', button_image_url: '', allow_uploads: false,
  proactive: { enabled: false, text: '', delay_s: 4 },
  branding: { name: '', greeting: '', avatar_url: '', theme_color: '#7C3AED' },
})

const agentId = computed(() => props.agent && props.agent.id)
const wsOn = computed(() => props.agent && props.agent.ws_chat_enabled !== false)
const webhookOn = computed(() => !!(props.agent && props.agent.signal_enabled))
const anyLive = computed(() => wsOn.value || webhookOn.value || share.value.is_public)

const publicOrigin = window.location.origin
const apiBase = (import.meta.env.VITE_PUBLIC_API_BASE || window.location.origin).replace(/\/+$/, '')
const shareToken = computed(() => share.value.public_share_token || '')
const shareUrl = computed(() => (shareToken.value ? `${publicOrigin}/a/${share.value.public_slug || shareToken.value}` : ''))
const embedUrl = computed(() => (shareToken.value ? `${publicOrigin}/embed/${shareToken.value}` : ''))
const widgetSrc = computed(() => `${publicOrigin}/webchat/widget.js`)
const webhookUrl = computed(() => `${apiBase}/api/agents/${agentId.value}/webhook/`)
const chatTokenUrl = computed(() => `${apiBase}/api/agents/${agentId.value}/chat-token/`)
const wsChatUrl = computed(() => {
  let host, scheme
  try { const u = new URL(apiBase); host = u.host; scheme = u.protocol === 'https:' ? 'wss' : 'ws' }
  catch (e) { host = window.location.host; scheme = window.location.protocol === 'https:' ? 'wss' : 'ws' }
  return `${scheme}://${host}/ws/chat/repository/0/`
})

const embedCode = computed(() => {
  if (!shareToken.value) return ''
  const mode = s.chat_interface === 'embedded' ? 'embedded' : 'bubble'
  return `<script src="${widgetSrc.value}"><\/script>\n`
    + `<script>\n  AgentChat.init({ token: "${shareToken.value}", mode: "${mode}" });\n<\/script>`
})

// Guide link — small render fn (just a styled router-link with an icon).
const GuideLink = (p) => h(RouterLink, {
  to: `/dashboard/integration-guide/${agentId.value}?tab=${p.tab}`,
  target: '_blank', rel: 'noopener', class: 'di-guide',
}, () => [h(Icon, { icon: 'lucide:book-open', width: 14 }), ' Integration guide', h(Icon, { icon: 'lucide:arrow-up-right', width: 13 })])
GuideLink.props = ['tab']

function applySettings(ss) {
  if (!ss) return
  s.chat_interface = ss.chat_interface || 'toggle'
  s.launcher = ss.launcher || 'bubble'
  s.button_image_url = ss.button_image_url || ''
  s.allow_uploads = !!ss.allow_uploads
  s.proactive = { enabled: false, text: '', delay_s: 4, ...(ss.proactive || {}) }
  s.branding = { name: '', greeting: '', avatar_url: '', theme_color: '#7C3AED', ...(ss.branding || {}) }
}

async function load() {
  if (!agentId.value) return
  loading.value = true
  try {
    const res = await api.getAgentShare(agentId.value)
    share.value = res.data || {}
    applySettings(share.value.share_settings)
  } catch (e) { notify.error('Could not load deploy settings') }
  finally { loading.value = false }
}

async function toggleWs() {
  const next = !wsOn.value
  busy.value = true
  try {
    await api.updateAgent(agentId.value, { ws_chat_enabled: next })
    props.agent.ws_chat_enabled = next
    if (next && !props.agent.signal_api_key) notify.info('WebSocket chat on — generate an access key to let external apps connect')
    else notify.success(next ? 'WebSocket chat enabled' : 'WebSocket chat disabled')
  } catch (e) { notify.error('Failed: ' + (e.response?.data?.error || e.message)) }
  finally { busy.value = false }
}

async function toggleWebhook() {
  const next = !webhookOn.value
  busy.value = true
  try {
    await api.updateAgent(agentId.value, { signal_enabled: next })
    props.agent.signal_enabled = next
    notify.success(next ? 'Webhook enabled' : 'Webhook disabled')
  } catch (e) { notify.error('Failed: ' + (e.response?.data?.error || e.message)) }
  finally { busy.value = false }
}

async function rotateApiKey() {
  if (props.agent.signal_api_key && !(await confirm('Generate a new key? The old one stops working immediately.'))) return
  rotatingKey.value = true
  try {
    const res = await api.rotateSignalApiKey(agentId.value)
    props.agent.signal_api_key = res.data.api_key
    showApiKey.value = true
  } catch (e) { notify.error('Failed to generate key: ' + (e.response?.data?.error || e.message)) }
  finally { rotatingKey.value = false }
}

async function mintTestToken() {
  mintingToken.value = true
  try {
    const res = await api.mintChatToken(agentId.value)
    testToken.value = res.data.token
    testTokenTtl.value = res.data.expires_in
  } catch (e) { notify.error('Mint failed: ' + (e.response?.data?.error || e.message)) }
  finally { mintingToken.value = false }
}

async function toggleShare() {
  busy.value = true
  try {
    const res = share.value.is_public ? await api.disableAgentShare(agentId.value) : await api.enableAgentShare(agentId.value)
    if (share.value.is_public) { share.value = { ...share.value, is_public: false } }
    else { share.value = res.data; applySettings(share.value.share_settings); notify.success('Share link enabled') }
  } catch (e) { notify.error('Failed: ' + (e.response?.data?.error || e.message)) }
  finally { busy.value = false }
}

async function saveSettings() {
  busy.value = true
  try {
    const res = await api.updateAgentShareSettings(agentId.value, { ...s })
    share.value = res.data
    previewKey.value++
    notify.success('Saved — click Publish Changes to make it live')
  } catch (e) { notify.error('Save failed') }
  finally { busy.value = false }
}

async function publish() {
  busy.value = true
  try {
    if (share.value.is_public) await api.updateAgentShareSettings(agentId.value, { ...s })
    await api.publishAgent(agentId.value)
    previewKey.value++
    notify.success('Published ✓')
  } catch (e) { notify.error('Publish failed') }
  finally { busy.value = false }
}

async function regenerate() {
  if (!(await confirm({ title: 'Regenerate link?', message: 'The current public link will stop working immediately.', confirmText: 'Regenerate', danger: true }))) return
  busy.value = true
  try { const res = await api.regenerateAgentShare(agentId.value); share.value = res.data; previewKey.value++; notify.success('Link regenerated') }
  catch (e) { notify.error('Failed') } finally { busy.value = false }
}

function copy(text) { try { navigator.clipboard.writeText(text); notify.success('Copied') } catch (e) { /* noop */ } }

watch(() => props.modelValue, (open) => { if (open) { testToken.value = ''; load() } })
</script>

<style scoped>
/* ── shell ── */
.di-overlay { position: fixed; inset: 0; z-index: 90; display: flex; font-family: var(--vm-font-sans); }
.di-backdrop { position: absolute; inset: 0; background: rgba(25, 20, 39, .34); backdrop-filter: blur(2px); }
.di-panel { position: relative; margin-left: auto; height: 100%; width: 100%; max-width: 720px; background: var(--vm-bg);
  box-shadow: -24px 0 60px rgba(25,20,39,.18); display: flex; flex-direction: column; overflow-y: auto; }

/* enter/leave */
.di-enter-active, .di-leave-active { transition: opacity .22s var(--vm-ease2); }
.di-enter-active .di-panel, .di-leave-active .di-panel { transition: transform .28s var(--vm-ease2); }
.di-enter-from, .di-leave-to { opacity: 0; }
.di-enter-from .di-panel, .di-leave-to .di-panel { transform: translateX(40px); }

/* ── header ── */
.di-head { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 16px 20px; background: var(--vm-glass-strong); backdrop-filter: blur(16px); border-bottom: 1px solid var(--vm-line); }
.di-head-l { display: flex; align-items: center; gap: 12px; min-width: 0; }
.di-rocket { width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; color: #fff; background: var(--vm-g-brand); box-shadow: var(--vm-shadow-s); flex: 0 0 auto; }
.di-title { font-family: var(--vm-font-display); font-weight: 700; font-size: 17px; color: var(--vm-ink); line-height: 1.1; }
.di-sub { font-size: 12px; color: var(--vm-ink-faint); margin-top: 1px; }
.di-livepill { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: var(--vm-green); background: rgba(16,185,129,.1); padding: 4px 9px; border-radius: 999px; }
.di-head-r { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
.di-publish { display: inline-flex; align-items: center; gap: 7px; font-weight: 600; font-size: 13px; color: #fff; padding: 9px 16px;
  border-radius: 12px; background: var(--vm-g-brand); box-shadow: var(--vm-shadow-s); transition: box-shadow .18s, transform .18s; }
.di-publish:hover:not(:disabled) { box-shadow: var(--vm-glow-v); transform: translateY(-1px); }
.di-publish:disabled { opacity: .6; }
.di-close { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; color: var(--vm-ink-faint); transition: background .15s, color .15s; }
.di-close:hover { background: rgba(25,20,39,.06); color: var(--vm-ink); }

/* ── body ── */
.di-body { padding: 18px 20px 32px; display: flex; flex-direction: column; gap: 14px; }
.di-loading { padding: 28px 20px; }
.di-intro { font-size: 13px; color: var(--vm-ink-soft); }

/* ── card ── */
.di-card { border: 1px solid var(--vm-line); border-radius: var(--vm-r); background: #FCFBFE; padding: 16px 18px; transition: box-shadow .2s, border-color .2s, background .2s; }
.di-card.is-on { background: var(--vm-surface); box-shadow: var(--vm-shadow-m); border-color: transparent; }
.di-card-head { display: flex; align-items: flex-start; gap: 13px; }
.di-chip { width: 42px; height: 42px; border-radius: 13px; display: grid; place-items: center; color: #fff; box-shadow: var(--vm-shadow-s); flex: 0 0 auto; }
.di-card-meta { flex: 1; min-width: 0; padding-top: 1px; }
.di-card-title { font-family: var(--vm-font-display); font-weight: 700; font-size: 15px; color: var(--vm-ink); display: flex; align-items: center; gap: 8px; }
.di-tag { font-family: var(--vm-font-sans); font-weight: 600; font-size: 10px; letter-spacing: .03em; text-transform: uppercase; color: var(--vm-ink-faint); background: rgba(25,20,39,.05); padding: 2px 7px; border-radius: 6px; }
.di-card-desc { font-size: 12.5px; color: var(--vm-ink-soft); margin-top: 3px; line-height: 1.45; }
.di-card-body { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--vm-line); display: flex; flex-direction: column; gap: 14px; }

/* ── toggle ── */
.di-toggle { position: relative; width: 46px; height: 27px; border-radius: 999px; background: #DEDCE6; flex: 0 0 auto; transition: background .26s var(--vm-ease2); }
.di-toggle.sm { width: 42px; height: 25px; }
.di-toggle:disabled { opacity: .6; cursor: default; }
.di-toggle .di-knob { position: absolute; top: 3px; left: 3px; width: 21px; height: 21px; border-radius: 50%; background: #fff; box-shadow: 0 2px 5px rgba(25,20,39,.28); transition: transform .26s var(--vm-ease); }
.di-toggle.sm .di-knob { width: 19px; height: 19px; }
.di-toggle.on .di-knob { transform: translateX(19px); }
.di-toggle.sm.on .di-knob { transform: translateX(17px); }
.di-toggle.on.on-cool { background: var(--vm-g-cool); }
.di-toggle.on.on-teal { background: var(--vm-g-teal); }
.di-toggle.on.on-warm { background: var(--vm-g-warm); }
.di-toggle.on.on-violet { background: var(--vm-violet); }

/* ── field row ── */
.di-label { display: block; font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--vm-ink-faint); margin-bottom: 6px; }
.di-label-hint { text-transform: none; letter-spacing: 0; font-weight: 500; color: var(--vm-ink-faint); opacity: .8; margin-left: 4px; }
.di-field { display: flex; align-items: center; gap: 8px; }
.di-field > code { flex: 1; min-width: 0; font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 12.5px; color: var(--vm-ink-soft);
  background: #F5F4FA; border: 1px solid var(--vm-line); border-radius: 12px; padding: 9px 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.di-field-sm > code { font-size: 11.5px; padding: 7px 10px; }
.di-field code.di-ok { color: var(--vm-green); background: rgba(16,185,129,.06); border-color: rgba(16,185,129,.2); }
.di-ttl { font-size: 10px; color: var(--vm-ink-faint); white-space: nowrap; }
.di-hint { font-size: 11.5px; color: var(--vm-ink-faint); margin-top: 6px; line-height: 1.5; }
.di-kbd { font-family: ui-monospace, monospace; font-size: 10.5px; background: rgba(25,20,39,.06); color: var(--vm-ink-soft); padding: 1px 5px; border-radius: 5px; }

/* ── buttons ── */
.di-iconbtn { display: inline-grid; place-items: center; width: 38px; height: 38px; border-radius: 11px; color: var(--vm-ink-soft);
  background: #F1EFF7; border: 1px solid var(--vm-line); transition: background .15s, color .15s; flex: 0 0 auto; }
.di-iconbtn:hover { background: var(--vm-violet-soft); color: var(--vm-violet); }
.di-iconbtn.sm { width: 32px; height: 32px; border-radius: 9px; }
.di-btn { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; font-size: 13px; color: #fff; padding: 9px 15px; white-space: nowrap;
  border-radius: 12px; background: var(--vm-g-brand); box-shadow: var(--vm-shadow-s); transition: box-shadow .18s, transform .18s; flex: 0 0 auto; }
.di-btn:hover:not(:disabled) { box-shadow: var(--vm-glow-v); transform: translateY(-1px); }
.di-btn:disabled { opacity: .55; }
.di-btn.sm { font-size: 12px; padding: 7px 11px; border-radius: 10px; }
.di-btn.grow { flex: 1; justify-content: center; }
.di-textbtn { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 500; color: var(--vm-ink-faint); margin-top: 7px; transition: color .15s; }
.di-textbtn:hover { color: var(--vm-violet); }
.di-textbtn.danger:hover { color: var(--vm-danger); }
.di-guide { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: var(--vm-violet); align-self: flex-start; }
.di-guide:hover { color: var(--vm-violet-d); }

/* ── chat-token callout ── */
.di-callout { border: 1px solid var(--vm-violet-soft); background: linear-gradient(180deg, #FBF9FF, #fff); border-radius: 14px; padding: 12px 14px; }
.di-callout-head { display: flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 600; color: var(--vm-violet-d); }
.di-callout-sub { font-size: 11.5px; color: var(--vm-ink-soft); margin: 3px 0 9px; line-height: 1.45; }

/* ── accordion (advanced) ── */
.di-acc { border: 1px solid var(--vm-line); border-radius: 12px; overflow: hidden; }
.di-acc-head { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 13px; background: #F7F6FB;
  font-size: 12.5px; font-weight: 600; color: var(--vm-ink-soft); transition: background .15s; }
.di-acc-head:hover { background: #F1EFF7; }
.di-acc-head span { display: inline-flex; align-items: center; gap: 7px; }
.di-acc-hint { padding: 6px 13px 10px; font-size: 11px; color: var(--vm-ink-faint); }
.di-acc-body { padding: 13px; border-top: 1px solid var(--vm-line); }

/* ── widget config ── */
.di-widget { display: grid; grid-template-columns: 1fr; gap: 16px; }
@media (min-width: 900px) { .di-widget { grid-template-columns: 1fr 280px; } }
.di-widget-cfg { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.di-pre { font-family: ui-monospace, monospace; font-size: 11px; line-height: 1.55; background: #1E1B2E; color: #E8E5F2; border-radius: 12px; padding: 12px; overflow-x: auto; white-space: pre-wrap; word-break: break-word; }
.di-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.di-seg { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.di-seg button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; font-size: 12px; font-weight: 500; padding: 8px; border-radius: 10px;
  border: 1px solid var(--vm-line); color: var(--vm-ink-soft); background: #fff; transition: all .15s; }
.di-seg button.on { border-color: var(--vm-violet); background: var(--vm-violet-soft); color: var(--vm-violet-d); font-weight: 600; }
.di-stack { display: flex; flex-direction: column; gap: 9px; }
.di-row { display: flex; gap: 10px; }
.di-input { width: 100%; font-size: 13px; color: var(--vm-ink); background: #fff; border: 1px solid var(--vm-line-2); border-radius: 11px; padding: 9px 12px; transition: border-color .15s, box-shadow .15s; }
.di-input:focus { outline: none; border-color: var(--vm-violet); box-shadow: 0 0 0 3px var(--vm-violet-soft); }
.di-color { display: grid; place-items: center; width: 44px; border: 1px solid var(--vm-line-2); border-radius: 11px; cursor: pointer; overflow: hidden; }
.di-color input { width: 30px; height: 30px; border: none; background: none; cursor: pointer; padding: 0; }
.di-inline-toggle { display: flex; align-items: center; justify-content: space-between; gap: 10px; background: #F7F6FB; border: 1px solid var(--vm-line); border-radius: 12px; padding: 11px 13px; }
.di-inline-title { font-size: 13px; font-weight: 600; color: var(--vm-ink); }
.di-inline-desc { font-size: 11.5px; color: var(--vm-ink-faint); margin-top: 1px; }
.di-check { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--vm-ink-soft); }
.di-check input { width: 16px; height: 16px; accent-color: var(--vm-violet); }
.di-actions { display: flex; align-items: center; gap: 12px; }
.di-preview { display: none; }
@media (min-width: 900px) { .di-preview { display: block; } }
.di-preview-frame { margin-top: 7px; height: 58vh; border-radius: 14px; overflow: hidden; border: 1px solid var(--vm-line-2); background: #fff; box-shadow: var(--vm-shadow-s); }
.di-preview-frame iframe { width: 100%; height: 100%; }
.di-empty { margin-top: 12px; font-size: 12.5px; color: var(--vm-ink-faint); }

/* spinner */
.di-spin { animation: di-rot .8s linear infinite; }
@keyframes di-rot { to { transform: rotate(360deg); } }
</style>
