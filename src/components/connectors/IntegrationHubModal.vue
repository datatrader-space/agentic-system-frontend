<template>
  <div class="hub-overlay fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 sm:p-8" @click.self="$emit('close')">
    <div class="hub-modal w-full max-w-6xl h-[88vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
      <!-- Header -->
      <div class="hub-header flex items-center justify-between px-5 py-3.5 border-b border-slate-200 shrink-0">
        <div class="flex items-center gap-2.5">
          <span class="hub-mark w-7 h-7 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
          </span>
          <div>
            <h2 class="hub-title text-[15px] font-bold text-ink">Connector Catalog</h2>
            <p class="hub-subtitle">Connect Aadml with the tools and services you use every day.</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <div v-if="!detailItem" class="hub-tabs flex gap-1 p-1 bg-slate-100 rounded-lg">
            <button @click="view = 'hub'" :class="['px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors', view === 'hub' ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-slate-700']">Catalog</button>
            <button @click="view = 'installed'" :class="['px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors', view === 'installed' ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-slate-700']">Installed Integrations <span class="hub-tab-count">{{ installedItems.length }}</span></button>
          </div>
          <button @click="$emit('close')" class="hub-close px-3 py-1.5 rounded-lg text-[12px] font-semibold text-ink-soft bg-slate-100 hover:bg-slate-200 flex items-center gap-1.5">
            <Icon icon="lucide:x" class="h-4 w-4" />
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

            <div class="p-4" v-if="!detailItem.mcpSlug">
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

            <!-- Kurumera / MCP OAuth connect (sibling of the service panel above) -->
            <div class="p-4" v-else>
              <div class="mb-3"><span class="text-[13px] font-bold text-ink">Connection</span></div>
              <div v-if="isInstalled(detailItem)" class="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5">
                <div class="flex items-center gap-2">
                  <Icon icon="lucide:check-circle" class="w-5 h-5 text-emerald-500" />
                  <p class="text-[13px] font-bold text-emerald-800">Connected to {{ detailItem.name }}</p>
                </div>
                <p class="text-[12px] text-emerald-700/80 mt-2">{{ mcpServer?.tool_count_total || 0 }} tool{{ (mcpServer?.tool_count_total || 0) === 1 ? '' : 's' }} available to your agents.</p>
              </div>
              <div v-else class="rounded-xl border border-slate-200 bg-slate-50/40 p-5 text-center py-4">
                <p class="text-[13px] text-ink-soft">Sign in to {{ detailItem.name }} to give your agents its tools.</p>
                <button @click="connectMcpOAuth" :disabled="busy" class="mt-3 px-4 py-2 rounded-lg text-[13px] font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 inline-flex items-center gap-2">
                  <Icon icon="lucide:lock" class="w-4 h-4" /> {{ busy ? 'Waiting for authorization…' : 'Connect with OAuth' }}
                </button>
                <p class="text-[11px] text-ink-faint mt-2">Opens the {{ detailItem.name }} sign-in in a new window. Tokens are stored encrypted server-side and refreshed automatically.</p>
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
        <div class="catalog-shell flex-1 min-h-0 overflow-hidden">
          <div class="catalog-toolbar">
            <div class="catalog-search relative">
              <svg class="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="11" cy="11" r="7"/><path stroke-linecap="round" d="M21 21l-4-4"/></svg>
              <input v-model="query" placeholder="Search integrations..." />
            </div>
            <select v-model="activeCategory"><option value="All Categories">All Categories</option><option v-for="c in categories.filter(c => c !== 'Popular')" :key="c" :value="c">{{ c }}</option></select>
            <select disabled><option>All Providers</option></select>
            <select disabled><option>Sort: Popular</option></select>
          </div>

          <div class="catalog-body">
            <main class="catalog-main">
              <h3>{{ view === 'installed' ? 'Installed Integrations' : 'All Integrations' }}</h3>
              <p>{{ view === 'installed' ? 'Connectors connected in this scope.' : 'Browse and connect integrations to extend Aadml.' }}</p>

              <div v-if="view === 'installed'" class="catalog-grid">
                <article v-for="c in installedItems" :key="c.kind + c.id" class="catalog-card">
                  <span class="catalog-logo"><Icon v-if="c.icon && c.icon.includes(':')" :icon="c.icon" /><span v-else>{{ (c.name || '?').charAt(0) }}</span></span>
                  <div class="catalog-card-title"><strong>{{ c.name }}</strong><Icon icon="lucide:badge-check" /></div>
                  <span class="catalog-by">Connected</span>
                </article>
              </div>
              <p v-if="view === 'installed' && !installedItems.length" class="catalog-empty">Nothing installed yet. Connect one from the connector catalog.</p>

              <div v-if="view !== 'installed'" class="catalog-grid">
                <article v-for="item in catalogItems" :key="item.id" class="catalog-card" @click="openDetail(item)">
                  <div class="catalog-card-head">
                    <span class="catalog-logo"><Icon :icon="item.icon" /></span>
                    <div>
                      <div class="catalog-card-title"><strong>{{ item.name }}</strong><Icon v-if="item.verified" icon="lucide:badge-check" /></div>
                      <span class="catalog-by">By {{ item.author }}</span>
                    </div>
                  </div>
                  <p>{{ item.desc }}</p>
                  <div class="catalog-tags"><span v-for="tag in item.tags" :key="tag">{{ tag }}</span></div>
                  <button class="catalog-connect" :class="{ 'is-connected': isInstalled(item) }" @click.stop="openDetail(item)">
                    <template v-if="isInstalled(item)"><Icon icon="lucide:check" /> Connected</template>
                    <template v-else><Icon icon="lucide:plus" /> {{ item.id === 'custom-mcp' ? 'Add Custom' : 'Connect' }}</template>
                  </button>
                </article>
              </div>
              <p v-if="view !== 'installed' && !catalogItems.length" class="catalog-empty">No integrations match "{{ query }}".</p>
              <button v-if="view !== 'installed'" class="catalog-request">Can't find what you need? Request an integration <Icon icon="lucide:external-link" /></button>
            </main>

            <aside class="catalog-info">
              <h4>About Integrations</h4>
              <section>
                <Icon icon="lucide:plug" />
                <strong>What are connectors?</strong>
                <p>Connectors let Aadml securely interact with your tools and services so your agents can take action and get things done.</p>
              </section>
              <section>
                <Icon icon="lucide:scan-line" />
                <strong>Understanding scopes</strong>
                <p>Scopes define the specific data and actions Aadml can access. You can review and change scopes anytime.</p>
                <button>Learn about scopes</button>
              </section>
              <section>
                <Icon icon="lucide:badge-check" />
                <strong>How installation works</strong>
                <ol>
                  <li>Choose an integration</li>
                  <li>Review requested scopes</li>
                  <li>Authorize securely</li>
                  <li>Start building with your data</li>
                </ol>
                <button>View installation guide</button>
              </section>
              <div class="catalog-security">
                <Icon icon="lucide:shield-check" />
                <strong>Security you can trust</strong>
                <p>We use industry-standard encryption and never store your credentials in plain text.</p>
                <a>Learn more about security <Icon icon="lucide:external-link" /></a>
              </div>
            </aside>
          </div>
        </div>

        <div v-if="false" class="hub-search px-5 pt-4 shrink-0">
          <div class="relative">
            <svg class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="11" cy="11" r="7"/><path stroke-linecap="round" d="M21 21l-4-4"/></svg>
            <input v-model="query" placeholder="Search integrations…" class="w-full pl-9 pr-3 py-2.5 text-[13px] text-ink bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 focus:bg-white" />
          </div>
        </div>

        <div v-if="false" class="flex-1 min-h-0 flex">
          <aside class="hub-sidebar w-56 shrink-0 border-r border-slate-100 p-3 overflow-y-auto">
            <button v-for="c in categories" :key="c" @click="activeCategory = c"
              :class="['w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-left transition-colors mb-0.5', activeCategory === c ? 'bg-slate-100 text-ink font-semibold' : 'text-ink-soft hover:bg-slate-50']">
              <Icon :icon="categoryIcon(c)" class="w-4 h-4 shrink-0 text-slate-400" />{{ c }}
            </button>
          </aside>

          <div class="hub-content flex-1 min-w-0 overflow-y-auto p-5">
            <div v-if="view === 'installed'">
              <h3 class="text-[15px] font-bold text-ink mb-1">Installed integrations</h3>
              <p class="text-[12px] text-ink-faint mb-4">Connectors connected in this scope.</p>
              <p v-if="!installedItems.length" class="py-10 text-center text-[13px] text-ink-faint">Nothing installed yet — connect one from the connector catalog.</p>
              <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                <div v-for="c in installedItems" :key="c.kind + c.id" class="hub-installed-card rounded-xl border border-slate-200 p-4 flex items-center gap-2.5">
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
                      class="hub-card group text-left rounded-xl border border-slate-200 p-4 hover:border-violet-300 hover:shadow-sm transition-all">
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
const activeCategory = ref('All Categories')

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

// Catalog is BACKEND-DRIVEN (GET /api/connectors/catalog/) — services + system-default MCP + coming
// soon are assembled server-side; nothing about the catalog is hardcoded here.
const catalog = ref([])
async function loadCatalog() {
  try { const { data } = await api.getConnectorCatalog(); catalog.value = data.items || [] }
  catch { /* leave as-is */ }
}

// The seeded system-default MCP server behind an `mcpSlug` card (Kurumera), from the unified connector list.
function _mcpServerFor(item) {
  if (!item?.mcpSlug) return null
  return props.connectors.find(c => c.kind === 'mcp'
    && (c.slug === item.mcpSlug || String(c.name || '').toLowerCase() === item.mcpSlug)) || null
}
function isInstalled(item) {
  if (item.mcpSlug) return !!_mcpServerFor(item)?.connected
  return !!services.value[item.id]?.connected
}

const matchesQuery = (item) => {
  const q = query.value.trim().toLowerCase()
  if (!q) return true
  return item.name.toLowerCase().includes(q) || (item.desc || '').toLowerCase().includes(q)
}
const catalogItems = computed(() => {
  let items = catalog.value.filter(matchesQuery)
  if (activeCategory.value && activeCategory.value !== 'Popular' && activeCategory.value !== 'All Categories') {
    items = items.filter((i) => i.category === activeCategory.value)
  }
  return items
})
const visibleGroups = computed(() => {
  const items = catalog.value.filter(matchesQuery)
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

// â”€â”€ Detail / install actions (service-generic; driven by the open detailItem) â”€â”€
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

// ── Kurumera / MCP OAuth connect ─────────────────────────────────────────────
const mcpServer = computed(() => _mcpServerFor(detailItem.value))
let _oauthPollIv = null
let _oauthDone = false
function _finishMcpOauth() {
  if (_oauthDone) return                                     // dedupe poll vs postMessage
  _oauthDone = true
  if (_oauthPollIv) { clearInterval(_oauthPollIv); _oauthPollIv = null }
  busy.value = false
  notify.success(`Connected to ${detailItem.value?.name || 'the server'}`)
  const srv = mcpServer.value
  if (srv?.id) api.refreshMCPTools(srv.id).catch(() => {})   // fetch its tools
  afterChange()                                              // reload connectors → card flips to Connected
}
function _onMcpOauthMsg(ev) {
  const d = ev && ev.data
  if (!d || d.type !== 'mcp_oauth_result') return
  if (d.ok) _finishMcpOauth()
  else { busy.value = false; notify.error(d.message || 'Connection failed') }
}
onMounted(() => window.addEventListener('message', _onMcpOauthMsg))
onBeforeUnmount(() => {
  window.removeEventListener('message', _onMcpOauthMsg)
  if (_oauthPollIv) clearInterval(_oauthPollIv)
})

async function connectMcpOAuth() {
  const srv = mcpServer.value
  if (!srv?.id) { notify.error('This connector isn\'t available yet — reload and try again.'); return }
  busy.value = true
  _oauthDone = false
  try {
    const { data } = await api.mcpOauthInitiate({ server_id: srv.id })
    const url = data && data.authorize_url
    if (!url) throw new Error('No authorization URL returned.')
    window.open(url, 'mcp_oauth', 'width=560,height=720')
    // The popup's postMessage is often severed by the browser's Cross-Origin-Opener-Policy after a
    // cross-origin OAuth redirect — so don't depend on it. Poll the connection status (backend = source of
    // truth); _onMcpOauthMsg still fires when the opener isn't severed, deduped via _finishMcpOauth.
    const connId = data && data.connection_id
    if (connId) {
      if (_oauthPollIv) clearInterval(_oauthPollIv)
      let tries = 0
      _oauthPollIv = setInterval(async () => {
        tries++
        try {
          const { data: st } = await api.mcpOauthStatus(connId)
          if (st?.connected) return _finishMcpOauth()
          if (st?.status === 'error') { clearInterval(_oauthPollIv); _oauthPollIv = null; busy.value = false; notify.error(st.error || 'Connection failed') }
        } catch { /* keep polling */ }
        if (tries >= 90) { clearInterval(_oauthPollIv); _oauthPollIv = null; busy.value = false }   // ~3 min timeout
      }, 2000)
    }
  } catch (e) {
    busy.value = false
    notify.error(e?.response?.data?.error || e?.message || 'Could not start OAuth for this connector.')
  }
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
  loadCatalog()
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

/* Screen 27 connector browser modal */
.hub-overlay {
  align-items: center;
  background: rgba(15, 23, 42, .42);
  backdrop-filter: blur(3px);
}
.hub-modal {
  max-width: 1500px;
  height: min(92vh, 900px);
  border: 1px solid rgba(226, 232, 240, .95);
  border-radius: 16px;
  box-shadow: 0 30px 90px rgba(15, 23, 42, .28);
}
.hub-header {
  min-height: 76px;
  padding: 18px 24px;
  background: #fff;
  border-color: #E2E8F0;
}
.hub-mark {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  color: #2563EB;
  background: #EAF0FF;
}
.hub-title {
  font-size: 20px;
  line-height: 1.2;
  letter-spacing: -0.01em;
  color: #0F172A;
}
.hub-subtitle {
  margin-top: 3px;
  font-size: 12.5px;
  color: #64748B;
}
.hub-tabs {
  height: 38px;
  align-items: center;
  border: 1px solid #E2E8F0;
  background: #F8FAFC;
}
.hub-tabs button {
  height: 30px;
  border-radius: 7px;
  padding-inline: 13px;
  color: #64748B;
}
.hub-tab-count {
  display: inline-grid;
  min-width: 20px;
  height: 20px;
  place-items: center;
  margin-left: 6px;
  border-radius: 999px;
  background: #EEF2FF;
  color: #64748B;
  font-size: 11px;
}
.hub-close {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 1px solid #E2E8F0;
  border-radius: 9px;
  background: #fff;
  color: #64748B;
  padding: 0;
}
.hub-search {
  padding: 18px 24px 14px;
  background: #fff;
}
.hub-search input {
  height: 42px;
  border-color: #DDE5F0;
  border-radius: 10px;
  background: #fff;
  font-weight: 600;
}
.hub-sidebar {
  width: 260px;
  border-color: #E2E8F0;
  background: #FBFCFE;
  padding: 14px;
}
.hub-sidebar button {
  min-height: 38px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 700;
}
.hub-content {
  padding: 22px 24px;
  background: #fff;
}
.hub-content h3 {
  font-size: 16px;
  font-weight: 800;
  color: #0F172A;
}
.hub-content h3 + span {
  background: #F1F5F9;
}
.hub-card,
.hub-installed-card {
  min-height: 138px;
  border-color: #E2E8F0;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(16, 24, 40, .03);
}
.hub-card:hover {
  border-color: #BFDBFE;
  box-shadow: 0 8px 22px rgba(15, 23, 42, .08);
}
.hub-card :deep(.text-\[13px\].font-bold),
.hub-installed-card :deep(.text-\[13px\].font-bold) {
  color: #0F172A;
}
.hub-card :deep(.text-ink-soft),
.hub-card :deep(.text-ink-faint),
.hub-installed-card :deep(.text-ink-faint) {
  color: #64748B;
}
@media (max-width: 900px) {
  .hub-modal { height: 90vh; }
  .hub-sidebar { width: 210px; }
}

.catalog-shell {
  background: #fff;
  display: flex;
  flex-direction: column;
}
.catalog-toolbar {
  display: grid;
  grid-template-columns: minmax(360px, 1fr) 150px 150px 140px;
  gap: 14px;
  padding: 18px 24px;
  border-top: 1px solid #F1F5F9;
  border-bottom: 1px solid #E2E8F0;
}
.catalog-search input,
.catalog-toolbar select {
  width: 100%;
  height: 40px;
  border: 1px solid #DDE5F0;
  border-radius: 9px;
  background: #fff;
  color: #0F172A;
  font-size: 13px;
  font-weight: 650;
  outline: none;
}
.catalog-search input {
  padding: 0 14px 0 42px;
}
.catalog-toolbar select {
  padding: 0 34px 0 14px;
}
.catalog-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 24px;
  flex: 1;
  min-height: 0;
  padding: 22px 24px 24px;
  overflow-y: auto;
}
.catalog-main {
  min-width: 0;
}
.catalog-main > h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  color: #0F172A;
}
.catalog-main > p {
  margin: 6px 0 18px;
  font-size: 12.5px;
  color: #64748B;
}
.catalog-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}
.catalog-card {
  min-height: 178px;
  border: 1px solid #E2E8F0;
  border-radius: 13px;
  background: #fff;
  padding: 20px;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(16, 24, 40, .04);
  transition: border-color .15s, box-shadow .15s, transform .15s;
}
.catalog-card:hover {
  border-color: #BFDBFE;
  box-shadow: 0 10px 26px rgba(15, 23, 42, .08);
  transform: translateY(-1px);
}
.catalog-card-head {
  display: flex;
  align-items: center;
  gap: 18px;
}
.catalog-logo {
  display: grid;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 11px;
  background: #F8FAFC;
}
.catalog-logo svg {
  width: 36px;
  height: 36px;
}
.catalog-card-title {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #0F172A;
  font-size: 15px;
}
.catalog-card-title svg {
  width: 14px;
  height: 14px;
  color: #2563EB;
}
.catalog-by {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #64748B;
}
.catalog-card > p {
  min-height: 38px;
  margin: 18px 0 12px;
  color: #64748B;
  font-size: 12.5px;
  line-height: 1.55;
}
.catalog-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}
.catalog-tags span {
  border-radius: 999px;
  background: #F1F5F9;
  padding: 4px 10px;
  color: #64748B;
  font-size: 11px;
  font-weight: 750;
}
.catalog-connect {
  display: inline-flex;
  height: 34px;
  align-items: center;
  gap: 7px;
  border: 1px solid #DDE5F0;
  border-radius: 8px;
  background: #fff;
  padding: 0 14px;
  color: #2563EB;
  font-size: 12.5px;
  font-weight: 800;
}
.catalog-connect svg {
  width: 14px;
  height: 14px;
}
.catalog-connect.is-connected {
  color: #047857;
  border-color: #A7F3D0;
  background: #ECFDF5;
}
.catalog-request {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  margin-top: 20px;
  color: #2563EB;
  font-size: 12.5px;
  font-weight: 750;
}
.catalog-request svg {
  width: 13px;
  height: 13px;
}
.catalog-info {
  align-self: start;
  position: sticky;
  top: 0;
  max-height: none;
  overflow: visible;
  border: 1px solid #E2E8F0;
  border-radius: 13px;
  background: #fff;
  padding: 20px;
  box-shadow: 0 1px 2px rgba(16, 24, 40, .04);
}
.catalog-info h4 {
  margin: 0 0 20px;
  color: #0F172A;
  font-size: 14px;
  font-weight: 800;
}
.catalog-info section {
  border-bottom: 1px solid #E2E8F0;
  padding: 0 0 22px;
  margin-bottom: 22px;
}
.catalog-info section > svg,
.catalog-security > svg {
  width: 18px;
  height: 18px;
  color: #2563EB;
  margin-bottom: 14px;
}
.catalog-info strong,
.catalog-security strong {
  display: block;
  color: #0F172A;
  font-size: 12.5px;
  font-weight: 800;
}
.catalog-info p,
.catalog-info li,
.catalog-security p {
  margin-top: 9px;
  color: #64748B;
  font-size: 12px;
  line-height: 1.55;
}
.catalog-info ol {
  margin: 12px 0 0;
  padding-left: 18px;
}
.catalog-info button {
  height: 36px;
  margin-top: 14px;
  border: 1px solid #DDE5F0;
  border-radius: 8px;
  background: #fff;
  padding: 0 14px;
  color: #344054;
  font-size: 12px;
  font-weight: 800;
}
.catalog-security {
  border: 1px solid #DDE5F0;
  border-radius: 12px;
  background: #F8FBFF;
  padding: 16px;
}
.catalog-security a {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 10px;
  color: #2563EB;
  font-size: 11.5px;
  font-weight: 800;
}
.catalog-security a svg {
  width: 12px;
  height: 12px;
}
.catalog-empty {
  padding: 56px 0;
  text-align: center;
  color: #64748B;
  font-size: 13px;
}
@media (max-width: 1180px) {
  .catalog-body { grid-template-columns: 1fr; overflow-y: auto; }
  .catalog-info { display: none; }
  .catalog-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 760px) {
  .catalog-toolbar { grid-template-columns: 1fr; }
  .catalog-grid { grid-template-columns: 1fr; }
}
</style>

