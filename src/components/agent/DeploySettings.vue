<!--
  DeploySettings — Botpress-style "Deploy Settings" slide-over for an agent: enable the
  public share link, copy the Embed Code, choose Chat Interface (Toggle/Embedded) + Launcher
  (Bubble/Custom Element), set the Button Image, Proactive Message and branding, with a live
  preview iframe. v-model controls open/close.
-->
<template>
  <Teleport to="body">
    <div v-if="modelValue" class="fixed inset-0 z-[90] flex">
      <div class="absolute inset-0 bg-gray-900/40" @click="$emit('update:modelValue', false)"></div>
      <div class="relative ml-auto h-full w-full max-w-3xl bg-white shadow-2xl flex flex-col">
        <!-- header -->
        <div class="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0">
          <div class="flex items-center gap-2">
            <span class="text-lg">🚀</span>
            <h2 class="font-bold text-gray-900">Deploy Settings</h2>
            <span v-if="share.is_public" class="text-[11px] text-emerald-600 font-medium">● Live</span>
          </div>
          <div class="flex items-center gap-2">
            <button @click="publish" :disabled="busy"
              class="text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-semibold">
              {{ busy ? 'Publishing…' : 'Publish Changes' }}
            </button>
            <button @click="$emit('update:modelValue', false)" class="text-gray-400 hover:text-gray-600 text-xl">×</button>
          </div>
        </div>

        <div v-if="loading" class="p-8 text-center text-gray-400 text-sm">Loading…</div>

        <div v-else class="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-[1fr_360px]">
          <!-- settings -->
          <div class="p-5 space-y-6">
            <!-- share toggle -->
            <div class="flex items-center justify-between bg-slate-50 border border-gray-200 rounded-xl p-4">
              <div>
                <div class="text-sm font-semibold text-gray-800">Public share link</div>
                <div class="text-xs text-gray-500 mt-0.5">Anyone with the link can chat — no login.</div>
              </div>
              <button @click="toggleShare" :disabled="busy"
                :class="['relative inline-flex h-6 w-11 items-center rounded-full transition', share.is_public ? 'bg-emerald-500' : 'bg-gray-300']">
                <span :class="['inline-block h-4 w-4 rounded-full bg-white transition-transform', share.is_public ? 'translate-x-6' : 'translate-x-1']" />
              </button>
            </div>

            <template v-if="share.is_public">
              <!-- share url -->
              <div>
                <label class="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Your agent is live</label>
                <div class="flex gap-2">
                  <input :value="shareUrl" readonly class="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-slate-50 font-mono" />
                  <button @click="copy(shareUrl)" class="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Copy</button>
                  <a :href="shareUrl" target="_blank" class="px-3 py-2 text-sm border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50">Preview ↗</a>
                </div>
                <button @click="regenerate" class="text-[11px] text-gray-400 hover:text-red-500 mt-1.5">Regenerate link (revokes the old one)</button>
              </div>

              <!-- embed code -->
              <div>
                <label class="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Embed Code</label>
                <p class="text-xs text-gray-500 mb-1.5">Copy &amp; paste into your website.</p>
                <pre class="text-[11px] font-mono bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words">{{ embedCode }}</pre>
                <button @click="copy(embedCode)" class="text-xs text-indigo-600 hover:text-indigo-800 mt-1">Copy code</button>
              </div>

              <!-- chat interface -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Chat Interface</label>
                <div class="grid grid-cols-2 gap-3">
                  <button v-for="o in ['toggle','embedded']" :key="o" @click="s.chat_interface = o"
                    :class="['border rounded-xl p-3 text-center text-sm', s.chat_interface === o ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50']">
                    <div class="text-lg mb-1">{{ o === 'toggle' ? '🗨️' : '▭' }}</div>{{ o === 'toggle' ? 'Toggle' : 'Embedded' }}
                  </button>
                </div>
              </div>

              <!-- launcher -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Chat Launcher</label>
                <div class="grid grid-cols-2 gap-3">
                  <button v-for="o in ['bubble','element']" :key="o" @click="s.launcher = o"
                    :class="['border rounded-xl p-3 text-center text-sm', s.launcher === o ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50']">
                    <div class="text-lg mb-1">{{ o === 'bubble' ? '💬' : '⚙' }}</div>{{ o === 'bubble' ? 'Chat Bubble' : 'Custom Element' }}
                  </button>
                </div>
              </div>

              <!-- branding -->
              <div class="space-y-3">
                <label class="block text-sm font-medium text-gray-700">Bot identity &amp; appearance</label>
                <input v-model="s.branding.name" placeholder="Display name" class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                <input v-model="s.branding.greeting" placeholder="Greeting message" class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                <div class="flex gap-3">
                  <input v-model="s.branding.avatar_url" placeholder="Avatar image URL" class="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                  <label class="flex items-center gap-2 text-sm text-gray-600">Color
                    <input type="color" v-model="s.branding.theme_color" class="w-8 h-8 rounded border border-gray-200" />
                  </label>
                </div>
                <input v-model="s.button_image_url" placeholder="Launcher button image URL (defaults to avatar)" class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
              </div>

              <!-- proactive -->
              <div class="bg-slate-50 border border-gray-200 rounded-xl p-4">
                <div class="flex items-center justify-between">
                  <div class="text-sm font-semibold text-gray-800">Proactive Message</div>
                  <button @click="s.proactive.enabled = !s.proactive.enabled"
                    :class="['relative inline-flex h-6 w-11 items-center rounded-full transition', s.proactive.enabled ? 'bg-indigo-600' : 'bg-gray-300']">
                    <span :class="['inline-block h-4 w-4 rounded-full bg-white transition-transform', s.proactive.enabled ? 'translate-x-6' : 'translate-x-1']" />
                  </button>
                </div>
                <input v-if="s.proactive.enabled" v-model="s.proactive.text" placeholder="A short message shown above the launcher" class="w-full mt-2 px-3 py-2 text-sm border border-gray-200 rounded-lg" />
              </div>

              <label class="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" v-model="s.allow_uploads" /> Allow file uploads
              </label>

              <button @click="saveSettings" :disabled="busy"
                class="w-full py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-semibold text-sm">
                {{ busy ? 'Saving…' : 'Save deploy settings' }}
              </button>
            </template>
            <div v-else class="text-sm text-gray-400 text-center py-6">Enable the share link to configure the webchat.</div>
          </div>

          <!-- live preview -->
          <div v-if="share.is_public" class="border-l border-gray-200 bg-slate-100 p-4 hidden lg:block">
            <div class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Live preview</div>
            <div class="rounded-xl overflow-hidden border border-gray-200 bg-white" style="height: 70vh">
              <iframe v-if="embedUrl" :key="previewKey" :src="embedUrl" class="w-full h-full" frameborder="0"></iframe>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import api from '../../services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  agent: { type: Object, default: null },
})
defineEmits(['update:modelValue'])

const loading = ref(false)
const busy = ref(false)
const share = ref({})
const previewKey = ref(0)
const s = reactive({
  chat_interface: 'toggle', launcher: 'bubble', button_image_url: '', allow_uploads: false,
  proactive: { enabled: false, text: '', delay_s: 4 },
  branding: { name: '', greeting: '', avatar_url: '', theme_color: '#4f46e5' },
})

const agentId = computed(() => props.agent && props.agent.id)

// Public URLs are served by THIS (frontend) origin — /a, /embed and /webchat/widget.js all
// live here, not on the API host. window.location.origin is correct in dev (:5173, proxies
// /api + /ws to the backend) and in prod (same origin).
const publicOrigin = window.location.origin
const shareToken = computed(() => share.value.public_share_token || '')
const shareUrl = computed(() => (shareToken.value ? `${publicOrigin}/a/${share.value.public_slug || shareToken.value}` : ''))
const embedUrl = computed(() => (shareToken.value ? `${publicOrigin}/embed/${shareToken.value}` : ''))
const widgetSrc = computed(() => `${publicOrigin}/webchat/widget.js`)

const embedCode = computed(() => {
  if (!shareToken.value) return ''
  const mode = s.chat_interface === 'embedded' ? 'embedded' : 'bubble'
  return `<script src="${widgetSrc.value}"><\/script>\n`
    + `<script>\n  AgentChat.init({ token: "${shareToken.value}", mode: "${mode}" });\n<\/script>`
})

function applySettings(ss) {
  if (!ss) return
  s.chat_interface = ss.chat_interface || 'toggle'
  s.launcher = ss.launcher || 'bubble'
  s.button_image_url = ss.button_image_url || ''
  s.allow_uploads = !!ss.allow_uploads
  s.proactive = { enabled: false, text: '', delay_s: 4, ...(ss.proactive || {}) }
  s.branding = { name: '', greeting: '', avatar_url: '', theme_color: '#4f46e5', ...(ss.branding || {}) }
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
  try { await api.updateAgentShareSettings(agentId.value, { ...s }); await api.publishAgent(agentId.value); previewKey.value++; notify.success('Published ✓') }
  catch (e) { notify.error('Publish failed') }
  finally { busy.value = false }
}

async function regenerate() {
  if (!(await confirm({ title: 'Regenerate link?', message: 'The current public link will stop working immediately.', confirmText: 'Regenerate', danger: true }))) return
  busy.value = true
  try { const res = await api.regenerateAgentShare(agentId.value); share.value = res.data; previewKey.value++; notify.success('Link regenerated') }
  catch (e) { notify.error('Failed') } finally { busy.value = false }
}

function copy(text) { try { navigator.clipboard.writeText(text); notify.success('Copied') } catch (e) { /* noop */ } }

watch(() => props.modelValue, (open) => { if (open) load() })
</script>
