<template>
  <div class="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 sm:p-8" @click.self="$emit('close')">
    <div class="w-full max-w-6xl h-[88vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 shrink-0">
        <div class="flex items-center gap-2.5">
          <span class="w-7 h-7 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
          </span>
          <h2 class="text-[15px] font-bold text-ink">Integration Hub</h2>
        </div>
        <div class="flex items-center gap-2">
          <div v-if="!detailItem" class="flex gap-1 p-1 bg-slate-100 rounded-lg">
            <button @click="view = 'hub'" :class="['px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors', view === 'hub' ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-slate-700']">Integration Hub</button>
            <button @click="view = 'installed'" :class="['px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors', view === 'installed' ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-slate-700']">Installed Integrations</button>
          </div>
          <button @click="$emit('close')" class="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-ink-soft bg-slate-100 hover:bg-slate-200 flex items-center gap-1.5">
            Close <kbd class="text-[10px] text-slate-400 font-sans">Esc</kbd>
          </button>
        </div>
      </div>

      <!-- ============ DETAIL VIEW ============ -->
      <div v-if="detailItem" class="flex-1 min-h-0 overflow-y-auto">
        <div class="max-w-4xl mx-auto px-6 py-6">
          <button @click="closeDetail" class="flex items-center gap-2 text-[15px] font-bold text-ink mb-5 hover:text-violet-700">
            <Icon icon="lucide:arrow-left" class="w-5 h-5" /> {{ detailItem.name }}
          </button>

          <!-- Title row -->
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-center gap-3">
              <span class="w-14 h-14 rounded-xl border border-slate-200 flex items-center justify-center bg-white">
                <Icon :icon="detailItem.icon" class="w-9 h-9" />
              </span>
              <div>
                <div class="flex items-center gap-1.5">
                  <span class="text-[16px] font-bold text-ink">{{ detailItem.name }}</span>
                  <Icon v-if="detailItem.verified" icon="lucide:badge-check" class="w-4 h-4 text-violet-500" />
                </div>
                <div class="text-[12px] text-ink-faint">By {{ detailItem.author }}</div>
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button class="w-9 h-9 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center" title="Share">
                <Icon icon="lucide:share-2" class="w-4 h-4" />
              </button>
              <template v-if="isInstalled(detailItem)">
                <button @click="toggleDisable" :disabled="busy" class="px-3.5 py-2 rounded-lg text-[13px] font-semibold text-ink-soft bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50">
                  {{ current && current.enabled === false ? 'Enable' : 'Disable' }}
                </button>
                <button @click="uninstall" :disabled="busy" class="px-3.5 py-2 rounded-lg text-[13px] font-semibold text-red-600 bg-white border border-red-200 hover:bg-red-50 disabled:opacity-50">Disconnect</button>
              </template>
              <button v-else-if="!detailItem.soon" @click="startInstall" class="px-4 py-2 rounded-lg text-[13px] font-semibold text-white bg-slate-900 hover:bg-slate-800 flex items-center gap-2">
                <Icon icon="lucide:download" class="w-4 h-4" /> Install Integration
              </button>
              <span v-else class="px-3 py-2 rounded-lg text-[12px] font-semibold text-slate-400 bg-slate-100">Coming soon</span>
            </div>
          </div>

          <!-- Setup panel (after Install clicked, or when installed) -->
          <div v-if="setupOpen || isInstalled(detailItem)" class="mt-6 rounded-xl border border-slate-200 overflow-hidden">
            <div class="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
              <span class="text-[13px] font-bold text-ink">Set Up {{ detailItem.name }} Integration</span>
              <button v-if="!isInstalled(detailItem)" @click="setupOpen = false" class="text-[12px] font-semibold text-ink-faint hover:text-ink">Cancel</button>
            </div>

            <!-- Version row -->
            <div v-if="isInstalled(detailItem)" class="flex items-center justify-between px-4 py-3 text-[12px] border-b border-slate-100">
              <div class="flex gap-6">
                <div><div class="text-ink-faint">Version</div><div class="font-semibold text-ink">{{ detailItem.version }}</div></div>
                <div><div class="text-ink-faint">{{ detailItem.name }}</div><a class="font-semibold text-violet-700 hover:underline" :href="detailItem.sourceUrl" target="_blank" rel="noopener">Source Code ↗</a></div>
              </div>
              <span class="text-ink-faint">About Integration</span>
            </div>

            <div class="p-4">
              <div class="flex items-center justify-between gap-3 mb-3">
                <span class="text-[13px] font-bold text-ink">Connections</span>
                <select v-model="connMethod" class="px-3 py-1.5 text-[12px] font-semibold text-ink bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300">
                  <option v-if="authMethods.includes('oauth2')" value="oauth">Connect with OAuth — Recommended</option>
                  <option v-if="authMethods.includes('github_app')" value="app">Configure with your own GitHub App — Advanced</option>
                  <option v-if="authMethods.includes('personal_access_token')" value="pat">Personal Access Token — Advanced / Manual</option>
                </select>
              </div>

              <!-- Connected state -->
              <div v-if="isInstalled(detailItem)" class="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5">
                <div class="flex items-center gap-2">
                  <Icon icon="lucide:check-circle" class="w-5 h-5 text-emerald-500" />
                  <p class="text-[13px] font-bold text-emerald-800">Connected to {{ detailItem.name }}</p>
                  <span class="text-[10px] font-semibold text-emerald-700 bg-emerald-100 rounded px-1.5 py-0.5 capitalize">{{ (current?.auth_method || '').replace(/_/g, ' ') }}</span>
                </div>
                <dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
                  <div><dt class="text-emerald-700/70">Account</dt><dd class="font-semibold text-emerald-900">{{ current?.account_login || '—' }}</dd></div>
                  <div><dt class="text-emerald-700/70">Status</dt><dd class="font-semibold text-emerald-900 capitalize">{{ current?.status }}</dd></div>
                  <div class="col-span-2">
                    <dt class="text-emerald-700/70">Granted scopes</dt>
                    <dd class="font-semibold text-emerald-900">{{ (current?.scopes_granted?.length ? current.scopes_granted.join(', ') : '—') }}</dd>
                  </div>
                  <div class="col-span-2">
                    <dt class="text-emerald-700/70 mb-1">Available tools ({{ current?.capabilities?.length || 0 }})</dt>
                    <dd class="flex flex-wrap gap-1.5">
                      <span v-for="cap in (current?.capabilities || [])" :key="cap" class="text-[10px] font-semibold text-emerald-800 bg-white border border-emerald-200 rounded px-1.5 py-0.5">{{ cap }}</span>
                    </dd>
                  </div>
                </dl>
              </div>

              <!-- Not connected: method-specific -->
              <div v-else class="rounded-xl border border-slate-200 bg-slate-50/40 p-5">
                <!-- OAuth (recommended) -->
                <div v-if="connMethod === 'oauth'" class="text-center py-2">
                  <template v-if="current?.oauth_configured">
                    <p class="text-[13px] text-ink-soft">You are not connected to {{ detailItem.name }}</p>
                    <button @click="connectWithOAuth" :disabled="busy" class="mt-3 px-4 py-2 rounded-lg text-[13px] font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 inline-flex items-center gap-2">
                      <Icon icon="lucide:lock" class="w-4 h-4" /> {{ busy ? 'Connecting…' : 'Connect with OAuth' }}
                    </button>
                    <p class="text-[11px] text-ink-faint mt-2">Requesting scopes: <code class="hub-code">{{ (current?.requested_scopes || []).join(' ') }}</code>. Tokens are stored encrypted server-side.</p>
                  </template>
                  <template v-else>
                    <Icon icon="lucide:info" class="w-6 h-6 text-amber-500 mx-auto" />
                    <p class="mt-2 text-[13px] font-semibold text-ink">OAuth provider is not configured yet</p>
                    <p class="text-[11px] text-ink-faint mt-1">Set <code class="hub-code">{{ envName }}_CLIENT_ID</code> / <code class="hub-code">{{ envName }}_CLIENT_SECRET</code> on the backend to enable OAuth. You can use manual setup (Personal Access Token) for now.</p>
                    <button @click="connMethod = 'pat'" class="mt-3 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100">Use Personal Access Token</button>
                  </template>
                </div>

                <!-- GitHub App (advanced) — honest not-configured -->
                <div v-else-if="connMethod === 'app'" class="text-center py-3">
                  <Icon icon="lucide:info" class="w-6 h-6 text-amber-500 mx-auto" />
                  <p class="mt-2 text-[13px] font-semibold text-ink">GitHub App setup is not fully configured yet</p>
                  <p class="text-[11px] text-ink-faint mt-1 max-w-md mx-auto">Create a GitHub App (App ID, private key, installation ID, webhook secret) and connect it. Use OAuth or a Personal Access Token for now.</p>
                  <button @click="notifyGithubApp" class="mt-3 px-4 py-2 rounded-lg text-[13px] font-semibold text-ink-soft bg-slate-100 hover:bg-slate-200 inline-flex items-center gap-2">Learn more</button>
                </div>

                <!-- PAT (advanced / manual) -->
                <div v-else>
                  <label class="block text-[12px] font-semibold text-ink mb-1">{{ detailItem.name }} {{ detailItem.id === 'slack' ? 'token' : 'Personal Access Token' }}</label>
                  <input v-model="token" type="password" :placeholder="detailItem.id === 'slack' ? 'xoxb-… or xoxp-…' : 'ghp_…'" class="w-full px-3 py-2.5 text-[13px] text-ink bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300" />
                  <p class="text-[11px] text-ink-faint mt-1.5">Validated against {{ detailItem.name }} and stored encrypted server-side — never exposed to the browser.</p>
                  <button @click="installWithToken" :disabled="!token.trim() || busy" class="mt-3 px-4 py-2 rounded-lg text-[13px] font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2">
                    <Icon icon="lucide:lock" class="w-4 h-4" /> {{ busy ? 'Connecting…' : 'Connect with token' }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Description -->
          <p class="mt-6 text-[13px] text-ink-soft leading-relaxed">{{ detailItem.longDesc }}</p>

          <!-- Migration notes -->
          <template v-if="detailItem.migration?.length">
            <h3 class="mt-7 text-[15px] font-bold text-ink">Migrating from version <code class="hub-code">0.x</code> to <code class="hub-code">1.x</code></h3>
            <p class="mt-1 text-[12px] text-ink-soft">Version <code class="hub-code">1.0</code> introduces several changes. If migrating from <code class="hub-code">0.x</code>, note the following:</p>
            <div v-for="(m, i) in detailItem.migration" :key="i" class="mt-2 rounded-lg bg-slate-50 border-l-2 border-slate-300 px-4 py-3 text-[12px] text-ink-soft leading-relaxed">{{ m }}</div>
          </template>

          <!-- Configuration -->
          <template v-if="detailItem.config?.length">
            <h3 class="mt-7 text-[15px] font-bold text-ink">Configuration</h3>
            <div v-for="(c, i) in detailItem.config" :key="i" class="mt-3">
              <h4 class="text-[13px] font-bold text-ink">{{ c.title }}</h4>
              <p class="mt-1 text-[12px] text-ink-soft leading-relaxed">{{ c.body }}</p>
            </div>
          </template>

          <!-- Cards -->
          <template v-if="detailItem.cards">
            <h3 class="mt-7 text-[15px] font-bold text-ink">Cards</h3>
            <div v-if="detailItem.cards.actions?.length" class="mt-3">
              <div class="text-[13px] font-bold text-ink">Action Cards</div>
              <p class="text-[11px] text-ink-faint mb-2">Cards to perform specific operations within a workflow</p>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <div v-for="a in detailItem.cards.actions" :key="a.name" class="rounded-lg border border-slate-200 px-3 py-2.5 flex items-center gap-2.5">
                  <span class="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0"><Icon icon="lucide:settings-2" class="w-4 h-4" /></span>
                  <div class="min-w-0"><div class="text-[12px] font-bold text-ink truncate">{{ a.name }}</div><div class="text-[11px] text-ink-faint truncate">{{ a.desc }}</div></div>
                </div>
              </div>
            </div>
            <div v-if="detailItem.cards.triggers?.length" class="mt-4">
              <div class="text-[13px] font-bold text-ink">Trigger Cards</div>
              <p class="text-[11px] text-ink-faint mb-2">Cards that listen for specific events to start a workflow</p>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <div v-for="t in detailItem.cards.triggers" :key="t.name" class="rounded-lg border border-slate-200 px-3 py-2.5 flex items-center gap-2.5">
                  <span class="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0"><Icon icon="lucide:zap" class="w-4 h-4" /></span>
                  <div class="min-w-0 flex-1"><div class="text-[12px] font-bold text-ink truncate">{{ t.name }}</div><div v-if="t.desc" class="text-[11px] text-ink-faint truncate">{{ t.desc }}</div></div>
                  <Icon icon="lucide:radio" class="w-4 h-4 text-emerald-500 shrink-0" />
                </div>
              </div>
            </div>
          </template>

          <div class="h-8"></div>
        </div>
      </div>

      <!-- ============ GRID / DIRECTORY VIEW ============ -->
      <template v-else>
        <div class="px-5 pt-4 shrink-0">
          <div class="relative">
            <svg class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="11" cy="11" r="7"/><path stroke-linecap="round" d="M21 21l-4-4"/></svg>
            <input v-model="query" placeholder="Search integrations…" class="w-full pl-9 pr-3 py-2.5 text-[13px] text-ink bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 focus:bg-white" />
          </div>
        </div>

        <div class="flex-1 min-h-0 flex">
          <aside class="w-56 shrink-0 border-r border-slate-100 p-3 overflow-y-auto">
            <button v-for="c in categories" :key="c" @click="activeCategory = c"
              :class="['w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-left transition-colors mb-0.5', activeCategory === c ? 'bg-slate-100 text-ink font-semibold' : 'text-ink-soft hover:bg-slate-50']">
              <Icon :icon="categoryIcon(c)" class="w-4 h-4 shrink-0 text-slate-400" />{{ c }}
            </button>
          </aside>

          <div class="flex-1 min-w-0 overflow-y-auto p-5">
            <div v-if="view === 'installed'">
              <h3 class="text-[15px] font-bold text-ink mb-1">Installed integrations</h3>
              <p class="text-[12px] text-ink-faint mb-4">Connectors connected in this scope.</p>
              <p v-if="!installedItems.length" class="py-10 text-center text-[13px] text-ink-faint">Nothing installed yet — connect one from the Integration Hub.</p>
              <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                <div v-for="c in installedItems" :key="c.kind + c.id" class="rounded-xl border border-slate-200 p-4 flex items-center gap-2.5">
                  <span class="w-9 h-9 rounded-lg bg-white border border-slate-200/60 flex items-center justify-center overflow-hidden shrink-0">
                    <Icon v-if="c.icon && c.icon.includes(':')" :icon="c.icon" class="w-6 h-6" />
                    <span v-else class="font-bold text-slate-600">{{ (c.name||'?').charAt(0) }}</span>
                  </span>
                  <div class="min-w-0"><div class="text-[13px] font-bold text-ink truncate">{{ c.name }}</div><div class="text-[11px] text-emerald-600 font-semibold">Connected</div></div>
                </div>
              </div>
            </div>

            <div v-else>
              <template v-for="group in visibleGroups" :key="group.title">
                <div class="mb-6">
                  <div class="flex items-center gap-2 mb-1">
                    <h3 class="text-[15px] font-bold text-ink">{{ group.title }}</h3>
                    <span class="text-[11px] font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">{{ group.items.length }}</span>
                  </div>
                  <p class="text-[12px] text-ink-faint mb-3">{{ group.subtitle }}</p>
                  <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    <button v-for="item in group.items" :key="item.id" @click="openDetail(item)"
                      class="group text-left rounded-xl border border-slate-200 p-4 hover:border-violet-300 hover:shadow-sm transition-all">
                      <div class="flex items-start justify-between">
                        <div class="flex items-center gap-2.5 min-w-0">
                          <Icon :icon="item.icon" class="w-9 h-9 shrink-0" />
                          <div class="min-w-0">
                            <div class="flex items-center gap-1.5">
                              <span class="text-[13px] font-bold text-ink truncate">{{ item.name }}</span>
                              <Icon v-if="item.verified" icon="lucide:badge-check" class="w-3.5 h-3.5 text-violet-500 shrink-0" />
                            </div>
                            <div class="text-[11px] text-ink-faint truncate">By {{ item.author }}</div>
                          </div>
                        </div>
                        <span v-if="item.soon" class="text-[10px] font-semibold text-slate-400 bg-slate-100 rounded-md px-2 py-1 shrink-0">Soon</span>
                        <span v-else-if="isInstalled(item)" class="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 rounded-md px-2 py-1 shrink-0"><Icon icon="lucide:check" class="w-3 h-3" />Installed</span>
                        <span v-else class="w-7 h-7 rounded-lg bg-violet-50 text-violet-700 group-hover:bg-violet-600 group-hover:text-white flex items-center justify-center transition-colors shrink-0"><Icon icon="lucide:plus" class="w-4 h-4" /></span>
                      </div>
                      <p class="mt-3 text-[12px] text-ink-soft leading-relaxed line-clamp-2">{{ item.desc }}</p>
                    </button>
                  </div>
                </div>
              </template>
              <p v-if="!visibleGroups.length" class="py-12 text-center text-[13px] text-ink-faint">No integrations match “{{ query }}”.</p>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Icon } from '@iconify/vue'
import api from '../../services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import { connectOAuth } from '@/composables/useOAuthConnect'

const props = defineProps({
  connectors: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'installed'])

const view = ref('hub')
const query = ref('')
const activeCategory = ref('Popular')

// Detail / install state
const detailItem = ref(null)
const setupOpen = ref(false)
const connMethod = ref('oauth') // OAuth is the recommended default
const token = ref('')
const busy = ref(false)

// Live built-in service status (keyed by service key), fetched from the backend.
const services = ref({})
// Status of the service whose detail page is open (drives the install/connected panel).
const current = computed(() => (detailItem.value ? services.value[detailItem.value.id] : null))
// Env-var prefix for the "OAuth not configured" hint (GITHUB / SLACK / ...).
const envName = computed(() => (detailItem.value?.id || '').toUpperCase())
const authMethods = computed(() => current.value?.auth_methods || ['oauth', 'pat'])

async function refreshServices() {
  try {
    const { data } = await api.getConnectorServices()
    const map = {}
    for (const s of data.services || []) map[s.key] = s
    services.value = map
  } catch {
    /* leave as-is */
  }
}

const categories = [
  'Popular', 'Communication & Channels', 'CRM & Sales', 'Customer Support',
  'Marketing & Email', 'E-commerce & Payments', 'Project Management', 'AI Models',
  'Business Operations', 'Developer Tools', 'File Management', 'Other',
]
function categoryIcon(c) {
  return {
    Popular: 'lucide:star', 'Communication & Channels': 'lucide:messages-square', 'CRM & Sales': 'lucide:users',
    'Customer Support': 'lucide:headphones', 'Marketing & Email': 'lucide:mail', 'E-commerce & Payments': 'lucide:shopping-cart',
    'Project Management': 'lucide:kanban', 'AI Models': 'lucide:sparkles', 'Business Operations': 'lucide:building-2',
    'Developer Tools': 'lucide:code', 'File Management': 'lucide:file', Other: 'lucide:circle-ellipsis',
  }[c] || 'lucide:circle'
}

const GITHUB = {
  id: 'github', name: 'GitHub', author: 'Agentic', verified: true, popular: true,
  category: 'Developer Tools', icon: 'logos:github-icon', version: '1.0.0',
  provider_slug: 'github',
  sourceUrl: 'https://docs.github.com/en/rest',
  desc: 'Manage GitHub issues, pull requests, and repositories.',
  longDesc:
    'Streamline your development workflow by seamlessly integrating GitHub. This integration lets you manage and automate your GitHub repositories, issues, and pull requests directly from your agents — collaborate effectively, track progress, and ensure smooth development cycles with features like real-time notifications, issue management, and pull request merging.',
  migration: [
    'The integration now supports both GitHub Apps and personal access tokens for authentication. GitHub Apps are recommended for organizations, while personal access tokens are suitable for individual users.',
    'The "Find Target" action now requires the repo field to be specified — it should contain the repository name. The discussion channel was removed from this action.',
    'The number tag on channels was removed. Pull requests now have a pullRequestNumber tag, and issues have an issueNumber tag.',
  ],
  config: [
    { title: 'Automatic configuration with OAuth (recommended)', body: 'Authorize the platform GitHub app with least-privilege scopes (read:user, user:email, repo). The token is stored encrypted server-side and used to authenticate API calls. Requires GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET on the backend.' },
    { title: 'Personal Access Token (manual)', body: 'Generate a fine-grained GitHub personal access token with Repository permissions (Issues + Pull requests: Read & write). Paste it under "Install Integration" → Personal Access Token. Validated against GitHub and stored encrypted server-side.' },
    { title: 'Custom GitHub App (advanced)', body: 'Create your own GitHub App and provide its credentials. Not fully wired yet — use OAuth or a Personal Access Token for now.' },
  ],
  cards: {
    actions: [
      { name: 'Create Issue', desc: 'Open an issue in a repository' },
      { name: 'Comment on Issue', desc: 'Add a comment to an issue' },
    ],
    triggers: [
      { name: 'List Repositories', desc: 'List accessible repositories' }, { name: 'Get Repository', desc: 'Get repository details' },
      { name: 'List Branches', desc: 'List repository branches' }, { name: 'Read File', desc: 'Read a file from a repo' },
      { name: 'List Directory', desc: 'List files and folders' }, { name: 'Search Repositories', desc: 'Search repositories' },
      { name: 'Search Code', desc: 'Search code in repos' }, { name: 'List Issues', desc: 'List issues in a repo' },
    ],
  },
}

const SLACK = {
  id: 'slack', name: 'Slack', author: 'Agentic', verified: true, popular: true,
  category: 'Communication & Channels', icon: 'logos:slack-icon', version: '1.0.0',
  provider_slug: 'slack',
  sourceUrl: 'https://api.slack.com/web',
  desc: 'List channels, read messages, list users, and post to Slack.',
  longDesc:
    'Connect Slack to let your agents read channel activity and post messages on your behalf. Authenticate once with OAuth (or a Slack token) and the platform manages credentials and runtime access — no manual bot setup per agent.',
  config: [
    { title: 'Connect with OAuth (recommended)', body: 'Authorize a Slack app to grant least-privilege bot scopes (channels:read, channels:history, chat:write, users:read). Requires SLACK_CLIENT_ID / SLACK_CLIENT_SECRET configured on the backend.' },
    { title: 'Connect with a token (manual)', body: 'Paste a Slack bot token (xoxb-…) or user token (xoxp-…). It is validated via auth.test and stored encrypted server-side.' },
  ],
  cards: {
    actions: [
      { name: 'Post Message', desc: 'Send a message to a channel' },
      { name: 'Reply to Thread', desc: 'Reply in a thread' },
      { name: 'Add Reaction', desc: 'React to a message' },
      { name: 'Upload File', desc: 'Upload a file to a channel' },
    ],
    triggers: [
      { name: 'List Channels', desc: 'Channels the account can see' },
      { name: 'Read Channel History', desc: 'Recent messages in a channel' },
      { name: 'List Users', desc: 'Workspace members' },
      { name: 'Search Messages', desc: 'Search messages (user token)' },
      { name: 'List Files', desc: 'Files in the workspace' },
      { name: 'Get Team Info', desc: 'Connected workspace info' },
    ],
  },
}

const CATALOG = [
  GITHUB,
  SLACK,
  { id: 'gmail', name: 'Gmail', author: 'Agentic', verified: true, soon: true, category: 'Marketing & Email', icon: 'logos:google-gmail', desc: 'Read, send, and organize email from Gmail.' },
  { id: 'notion', name: 'Notion', author: 'Agentic', verified: true, soon: true, category: 'Business Operations', icon: 'logos:notion-icon', desc: 'Read and update Notion pages and databases.' },
  { id: 'postgres', name: 'PostgreSQL', author: 'Agentic', verified: true, soon: true, category: 'Developer Tools', icon: 'logos:postgresql', desc: 'Query and inspect PostgreSQL databases.' },
  { id: 'stripe', name: 'Stripe', author: 'Agentic', verified: true, soon: true, category: 'E-commerce & Payments', icon: 'logos:stripe', desc: 'Manage payments, customers, and subscriptions.' },
]

function isInstalled(item) {
  return !!services.value[item.id]?.connected
}

const matchesQuery = (item) => {
  const q = query.value.trim().toLowerCase()
  if (!q) return true
  return item.name.toLowerCase().includes(q) || (item.desc || '').toLowerCase().includes(q)
}
const visibleGroups = computed(() => {
  const items = CATALOG.filter(matchesQuery)
  if (activeCategory.value === 'Popular' && !query.value.trim()) {
    const groups = []
    const popular = items.filter((i) => i.popular)
    if (popular.length) groups.push({ title: 'Popular', subtitle: 'Most used integrations', items: popular })
    const byCat = {}
    for (const i of items) (byCat[i.category] ||= []).push(i)
    for (const cat of categories) {
      if (cat === 'Popular' || !byCat[cat]) continue
      groups.push({ title: cat, subtitle: catSubtitle(cat), items: byCat[cat] })
    }
    return groups
  }
  const filtered = query.value.trim() ? items : items.filter((i) => i.category === activeCategory.value)
  if (!filtered.length) return []
  return [{ title: query.value.trim() ? 'Results' : activeCategory.value, subtitle: catSubtitle(activeCategory.value), items: filtered }]
})
function catSubtitle(cat) {
  return {
    'Developer Tools': 'APIs, SDKs, and development platforms', 'Communication & Channels': 'Chat, messaging, and channels',
    'Marketing & Email': 'Email and marketing platforms', 'Business Operations': 'Docs, ops, and productivity',
    'E-commerce & Payments': 'Stores, payments, and billing',
  }[cat] || ''
}
// Map a known provider/service to its real brand logo (iconify), so installed cards show the platform
// logo instead of a letter fallback. Falls back to any iconify icon the connector already carries.
const _LOGO_BY_KEY = {
  github: 'logos:github-icon', slack: 'logos:slack-icon', gmail: 'logos:google-gmail',
  notion: 'logos:notion-icon', postgres: 'logos:postgresql', postgresql: 'logos:postgresql',
  stripe: 'logos:stripe', shopify: 'logos:shopify',
}
function _logoFor(item) {
  if (item.icon && item.icon.includes(':')) return item.icon            // connector already has a logo
  const key = String(item.provider_slug || item.id || item.name || '').toLowerCase().trim()
  return _LOGO_BY_KEY[key] || null                                       // null -> letter fallback
}
// Dedupe key: a built-in service can appear BOTH in props.connectors (kind='builtin') and in the
// services map — without this, GitHub shows twice. Normalize on provider/name so each platform is one.
function _identityKey(item) {
  return String(item.provider_slug || item.name || item.id || '')
    .toLowerCase().replace(/\s+/g, '')
}
const installedItems = computed(() => {
  const out = []
  const seen = new Set()
  const add = (it) => {
    const k = _identityKey(it)
    if (!k || seen.has(k)) return
    seen.add(k)
    out.push({ ...it, icon: _logoFor(it) })
  }
  // Unified connector list first (carries real icon + provider_slug for built-ins/services/MCP).
  for (const c of props.connectors) {
    if (c.connected) add({ kind: c.kind, id: c.id, name: c.name, icon: c.icon, provider_slug: c.provider_slug })
  }
  // Built-in services fetched here — only added if not already represented above (dedupe).
  for (const s of Object.values(services.value)) {
    if (s.connected) add({ kind: 'service', id: s.key, name: s.name, provider_slug: s.key })
  }
  return out
})

// ── Detail / install actions (service-generic; driven by the open detailItem) ──
function openDetail(item) {
  detailItem.value = item
  setupOpen.value = false
  token.value = ''
  connMethod.value = services.value[item.id]?.oauth_configured ? 'oauth' : 'pat'
}
function closeDetail() {
  detailItem.value = null
}
function startInstall() {
  setupOpen.value = true
  connMethod.value = current.value?.oauth_configured ? 'oauth' : 'pat'
}

async function afterChange() {
  await refreshServices()
  emit('installed') // parent reloads its connector list too
}

// OAuth — only when the backend reports the provider is configured; otherwise honest message.
async function connectWithOAuth() {
  const svc = detailItem.value
  if (!current.value?.oauth_configured) {
    notify.warning('OAuth provider is not configured yet. You can use manual setup (Personal Access Token) for now.')
    return
  }
  busy.value = true
  try {
    await connectOAuth(api, svc.provider_slug || svc.id, {})
    notify.success(`Connected to ${svc.name}`)
    await afterChange()
  } catch (e) {
    notify.error(e?.message || `${svc.name} OAuth failed`)
  } finally {
    busy.value = false
  }
}

function notifyGithubApp() {
  notify.info('GitHub App setup is not fully configured yet. Use OAuth or a Personal Access Token for now.')
}

async function installWithToken() {
  if (!token.value.trim()) return
  const svc = detailItem.value
  busy.value = true
  try {
    await api.connectServicePat(svc.id, token.value.trim())
    token.value = ''
    notify.success(`${svc.name} connected`)
    await afterChange()
  } catch (e) {
    notify.error(e?.response?.data?.error || `Failed to connect ${svc.name}`)
  } finally {
    busy.value = false
  }
}
async function uninstall() {
  const svc = detailItem.value
  if (!(await confirm({ title: `Disconnect ${svc.name}?`, message: `Remove the ${svc.name} connection? Agents will lose its tools.`, confirmText: 'Disconnect', danger: true }))) return
  busy.value = true
  try {
    await api.disconnectService(svc.id)
    notify.success(`${svc.name} disconnected`)
    setupOpen.value = false
    await afterChange()
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to disconnect')
  } finally {
    busy.value = false
  }
}
async function toggleDisable() {
  const svc = detailItem.value
  busy.value = true
  try {
    if (current.value?.enabled) {
      await api.disableService(svc.id)
      notify.success(`${svc.name} disabled`)
    } else {
      await api.enableService(svc.id)
      notify.success(`${svc.name} enabled`)
    }
    await afterChange()
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to update')
  } finally {
    busy.value = false
  }
}

function onKey(e) {
  if (e.key === 'Escape') {
    if (detailItem.value) closeDetail()
    else emit('close')
  }
}
onMounted(() => {
  refreshServices()
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.hub-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.78em;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 5px;
  padding: 1px 5px;
  color: #334155;
}
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
