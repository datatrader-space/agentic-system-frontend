<template>
  <div class="space-y-8 px-4 py-6 sm:px-8 max-w-7xl mx-auto admin-page">
    <div class="flex items-center justify-between">
      <div class="admin-page-header">
        <h1 class="text-3xl font-bold text-gray-900 admin-page-title">Platform APIs</h1>
        <p class="mt-2 text-gray-600">
          The platform's AI providers and web search engines. People never add keys of their own: they pick from these
          models, and every call is charged to their balance. Only platform administrators see this page.
        </p>
      </div>
    </div>

    <!-- Page tabs — one view at a time instead of four stacked sections -->
    <div class="flex gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-fit overflow-x-auto admin-tabs" role="tablist" aria-label="Platform API sections">
      <button v-for="t in pageTabs" :key="t.key" @click="pageTab = t.key" type="button" role="tab" :aria-selected="pageTab === t.key" :tabindex="pageTab === t.key ? 0 : -1"
              :data-tour="'tab-' + t.key"
              class="px-4 py-2 text-[13px] font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center gap-2"
              :class="pageTab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'">
        {{ t.label }}
        <span v-if="t.key === 'providers' && providers.length" class="text-[11px] font-bold px-1.5 py-0.5 rounded-md"
              :class="pageTab === t.key ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-500'">{{ providers.length }}</span>
        <span v-if="t.key === 'models' && modelTotal" class="text-[11px] font-bold px-1.5 py-0.5 rounded-md"
              :class="pageTab === t.key ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-500'">{{ modelTotal }}</span>
      </button>
    </div>

    <PageLoader v-if="loading && !hasLoaded" label="Loading providers…" min-height="320px" />
    <template v-else>
    <!-- Which provider everything runs on, why, and a manual switch to another one (same backend switch the
         chat offers when a provider caps out — here it can be asked for at any time, in either direction). -->

    <!-- Configured Providers -->
    <div v-show="pageTab === 'providers'" class="bg-white rounded-[16px] shadow-sm border border-slate-200/60 overflow-hidden">
      <div class="p-5 sm:p-6 pb-4 sm:pb-5 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between gap-4">
        <div>
          <h2 class="text-base font-bold text-slate-900 admin-section-title">Configured Providers</h2>
          <p class="text-[13px] text-slate-500 mt-0.5">Your chat model providers, and the providers Video Studio uses for images, video and audio.</p>
        </div>
        <button @click="showAddProvider = !showAddProvider" type="button" data-tour="add-provider"
                class="px-3.5 py-2 text-[13px] font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors whitespace-nowrap flex items-center gap-1.5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="showAddProvider ? 'M6 18L18 6M6 6l12 12' : 'M12 4v16m8-8H4'"></path></svg>
          {{ showAddProvider ? 'Close' : 'Add Provider' }}
        </button>
      </div>
      
      <div class="p-0">
        <div v-if="providers.length === 0" class="p-8 text-center text-[13px] font-medium text-slate-500">
          No providers configured yet.
        </div>
        <div v-else class="divide-y divide-slate-100">
          <div
            v-for="provider in providers"
            :key="provider.id"
            class="group flex flex-col sm:flex-row sm:items-center justify-between p-5 sm:p-6 hover:bg-slate-50/50 transition-colors gap-4"
          >
            <div class="flex items-start gap-4">
               <!-- Icon Container -->
               <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-white border border-slate-200 shadow-sm flex items-center justify-center shrink-0">
                  <svg v-if="provider.provider_type === 'ollama'" class="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"></path></svg>
                  <svg v-else-if="provider.provider_type === 'openai'" class="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                  <svg v-else class="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>
               </div>
               
               <!-- Details -->
               <div>
                  <div class="flex items-center gap-2 mb-0.5">
                      <p class="font-semibold text-slate-900 text-[14px]">{{ provider.name }}</p>
                      <span v-if="provider.has_api_key" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-100"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Key Set</span>
                      <span v-else class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-100"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>No Key</span>
                  </div>
                  <label class="mt-1 mb-1 flex items-center gap-2 text-[12px] text-slate-600" data-test="provider-available-to">
                    <span class="font-semibold">Available to</span>
                    <select :value="provider.partner_account || ''" class="bg-white border border-slate-200 rounded-[6px] px-2 py-1 text-[12px]"
                            :aria-label="`Who can use ${provider.name}`" @change="setAvailableTo(provider, $event.target.value)">
                      <option value="">Everyone (platform)</option>
                      <option v-for="pa in partnerAccounts" :key="pa.id" :value="pa.id">Only partner: {{ pa.label }}</option>
                      <option v-if="provider.partner_account && !partnerAccounts.some(pa => pa.id === provider.partner_account)" :value="provider.partner_account">
                        Only partner: {{ provider.partner_account_name || provider.partner_account }} (partner switch off)
                      </option>
                    </select>
                  </label>
                  <p class="text-[12px] font-mono text-slate-500 truncate max-w-[200px] sm:max-w-md">
                    <span class="font-bold text-slate-400 mr-1">{{ provider.provider_type.toUpperCase() }}</span>
                    <span v-if="provider.base_url">{{ provider.base_url }}</span>
                  </p>
                  <!-- Decision L-D1 (VIDEO_STUDIO_LAUNCH_PLAN.md): Studio renders Google's media models via OpenRouter. -->
                  <p v-if="provider.provider_type === 'gemini'" class="mt-0.5 text-[12px] text-slate-600" data-test="gemini-studio-note">Google's video (Veo) and image models run in Video Studio through OpenRouter.</p>
                  <!-- Scheduled model sync: switch + last outcome (written server-side on every sync) -->
                  <div v-if="SYNCABLE_TYPES.includes(provider.provider_type)" class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                    <label class="inline-flex items-center gap-1.5 cursor-pointer text-slate-600" title="Re-sync this provider's model list every day so new models appear on their own">
                      <input type="checkbox" class="h-3 w-3 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30"
                             :checked="autoSyncOn(provider)" :disabled="savingAutoSync[provider.id]"
                             @change="setAutoSync(provider, $event.target.checked)" />
                      Auto-sync daily
                    </label>
                    <span class="text-slate-300">·</span>
                    <span v-if="isSyncing(provider)" class="text-slate-500" data-test="model-sync-running">Syncing models…</span>
                    <span v-else-if="!provider.metadata?.model_sync" class="text-slate-400">Not synced yet</span>
                    <span v-else-if="provider.metadata.model_sync.status === 'error'" class="text-red-600 break-words max-w-[200px] sm:max-w-md"
                          :title="provider.metadata.model_sync.error">
                      Last sync failed {{ timeAgo(provider.metadata.model_sync.last_attempt_at) }}: {{ provider.metadata.model_sync.error }}
                    </span>
                    <span v-else-if="provider.metadata.model_sync.status === 'skipped'" class="text-amber-600">
                      Sync skipped: {{ provider.metadata.model_sync.error }}
                    </span>
                    <span v-else class="text-slate-500">
                      Synced {{ timeAgo(provider.metadata.model_sync.last_success_at) }}
                    </span>
                  </div>
                  <!-- Test result (persistent so the failure reason stays readable) -->
                  <p v-if="testResults[provider.id]" class="mt-1 text-[11px] font-medium break-words max-w-[200px] sm:max-w-md"
                     :class="testResults[provider.id].success ? 'text-emerald-600' : 'text-red-600'">
                    {{ testResults[provider.id].success ? '✓ ' : '✗ ' }}{{ testResults[provider.id].message }}
                  </p>
               </div>
            </div>
            
            <!-- Actions -->
            <div class="flex items-center gap-3">
              <!-- Custom Toggle -->
              <label class="relative inline-flex items-center cursor-pointer mr-2">
                <input type="checkbox" v-model="provider.is_active" @change="toggleProvider(provider)" class="sr-only peer">
                <div class="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                <span class="ml-2 text-[12px] font-medium" :class="provider.is_active ? 'text-slate-700' : 'text-slate-400'">{{ provider.is_active ? 'Active' : 'Disabled' }}</span>
              </label>

              <!-- Test connection / key -->
              <button
                @click="testProvider(provider)"
                :disabled="testing[provider.id]"
                class="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm whitespace-nowrap disabled:opacity-50"
                title="Make a tiny live call to verify the key + model work"
              >
                {{ testing[provider.id] ? 'Testing…' : 'Test' }}
              </button>

              <!-- Sync Buttons -->
              <button
                v-if="SYNCABLE_TYPES.includes(provider.provider_type)"
                @click="syncModels(provider)"
                :disabled="isSyncing(provider)"
                class="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm whitespace-nowrap disabled:opacity-50"
              >
                {{ isSyncing(provider) ? 'Syncing…' : 'Sync Models' }}
              </button>

              <!-- Delete Button -->
              <button
                @click="removeProvider(provider)"
                class="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete Provider"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Add New Provider Form (collapsible) -->
      <div v-show="showAddProvider" class="border-t border-slate-100 bg-slate-50/50 p-5 sm:p-6">
        <h3 class="text-sm font-bold text-slate-900 mb-4 admin-section-title">Add New Provider</h3>
        <form @submit.prevent="createProvider" class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">Name</label>
            <input aria-label="E.g. Production Anthropic" v-model="newProvider.name" class="w-full bg-white border border-slate-200 rounded-[8px] px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm" placeholder="e.g. Production Anthropic" required />
          </div>
          <div>
            <label for="new-provider-type" class="block text-[13px] font-semibold text-slate-700 mb-1.5">Provider Type</label>
            <!-- The menu is the server's list (GET /llm/provider-types/), never a copy kept here. -->
            <select id="new-provider-type" v-model="newProvider.provider_type" :disabled="!providerTypes.length" data-test="provider-type"
                    class="w-full bg-white border border-slate-200 rounded-[8px] px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm">
              <optgroup v-for="group in providerTypeGroups" :key="group.kind" :label="group.label">
                <option v-for="t in group.types" :key="t.type" :value="t.type">{{ t.label }}</option>
              </optgroup>
            </select>
            <p v-if="providerTypesError" class="mt-1 text-[12px] text-red-600" role="alert">{{ providerTypesError }}</p>
            <p v-else-if="selectedProviderType?.kind === 'media'" class="mt-1 text-[12px] text-slate-600" data-test="provider-type-makes">
              Makes {{ makesText(selectedProviderType.makes) }} in Video Studio. It is never used for chat.
            </p>
          </div>
          <div>
            <label for="new-provider-base-url" class="block text-[13px] font-semibold text-slate-700 mb-1.5">Base URL</label>
            <input id="new-provider-base-url" v-model="newProvider.base_url" data-test="provider-base-url"
                   class="w-full bg-white border border-slate-200 rounded-[8px] px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                   :placeholder="selectedProviderType?.base_url_hint || 'Leave empty to use the provider\'s own address'" />
            <p class="mt-1 text-[12px] text-slate-600">Only for a self-hosted server, a proxy, or a provider that gives each account its own address.</p>
          </div>
          <div>
            <label for="new-provider-available-to" class="block text-[13px] font-semibold text-slate-700 mb-1.5">Available to</label>
            <select id="new-provider-available-to" v-model="newProvider.partner_account" data-test="new-provider-available-to"
                    class="w-full bg-white border border-slate-200 rounded-[8px] px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm">
              <option :value="null">Everyone (a general platform API)</option>
              <option v-for="pa in partnerAccounts" :key="pa.id" :value="pa.id">Only partner: {{ pa.label }}</option>
            </select>
            <p class="mt-1 text-[12px] text-slate-600">A partner with its own keys uses only those. Its usage is still charged to its balance.</p>
          </div>
          <div>
            <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">API Key</label>
            <input aria-label="Paste the provider's API key" v-model="newProvider.api_key" autocomplete="off" class="w-full bg-white border border-slate-200 rounded-[8px] px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm" placeholder="Paste the provider's API key" />
          </div>
          <div class="md:col-span-2 flex justify-end mt-2">
            <button type="submit" class="px-5 py-2.5 bg-slate-900 text-white rounded-[10px] hover:bg-slate-800 transition-all font-semibold shadow-sm border border-transparent shadow-[0_2px_4px_rgba(0,0,0,0.1)] text-[13px] flex items-center gap-2">
               <svg class="w-4 h-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
               Add Provider
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Models for internal operations — per-user choice (falls back to the agent's default model) -->
    <div v-show="pageTab === 'internal'" class="bg-white rounded-[16px] shadow-sm border border-slate-200/60 overflow-hidden">
      <div class="p-5 sm:p-6 pb-4 sm:pb-5 border-b border-slate-100 bg-slate-50/30">
        <h2 class="text-base font-bold text-slate-900 admin-section-title">Models for internal operations</h2>
        <p class="text-[13px] text-slate-500 mt-0.5">Pick which model runs each internal task. Leave as <strong>Agent default</strong> to use the agent's own model.</p>
      </div>
      <!-- A failed read of the saved picks is an error with Retry. It used to render every operation as
           "Agent default", and saving that page then overwrote the real picks. -->
      <div v-if="opLoadError" class="p-5 sm:p-6">
        <LoadError title="Couldn't load your internal model choices" :message="opLoadError" :retrying="opRetrying" @retry="retryInternalTab" />
      </div>
      <template v-else>
      <!-- Tab bar: one tab per internal operation -->
      <div class="px-5 sm:px-6 pt-4 flex gap-1 border-b border-slate-100 overflow-x-auto">
        <button v-for="op in operationDefs" :key="op.key" @click="opActiveTab = op.key" type="button"
                class="px-3.5 py-2 text-[13px] font-semibold rounded-t-lg -mb-px border-b-2 transition-colors whitespace-nowrap"
                :class="opActiveTab === op.key ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'">
          {{ op.label }}
        </button>
      </div>

      <!-- Active tab: pick provider → model → save -->
      <div class="p-5 sm:p-6">
        <template v-for="op in operationDefs" :key="op.key">
          <div v-show="opActiveTab === op.key">
            <p class="text-[12px] text-slate-400 mb-4 leading-snug">{{ op.help }}</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
              <div>
                <label class="block text-[12px] font-semibold text-slate-600 mb-1.5">Provider</label>
                <select aria-label="Op Provider" v-model="opProvider[op.key]" @change="onOpProviderChange(op.key)"
                        class="w-full bg-white border border-slate-200 rounded-[8px] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm font-medium text-slate-700 cursor-pointer">
                  <option :value="null">Agent default</option>
                  <option v-for="p in providers" :key="p.id" :value="p.id">{{ p.name }}</option>
                </select>
              </div>
              <div>
                <label class="block text-[12px] font-semibold text-slate-600 mb-1.5">Model</label>
                <select aria-label="Op Models" v-model="opModels[op.key]" :disabled="!opProvider[op.key]"
                        class="w-full bg-white border border-slate-200 rounded-[8px] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm font-medium text-slate-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50">
                  <option :value="null">{{ opProvider[op.key] ? 'Select a model…' : 'Agent default' }}</option>
                  <option v-for="m in modelsForProvider(opProvider[op.key], false)" :key="m.id" :value="m.id">{{ m.name }}</option>
                </select>
                <p v-if="opProvider[op.key] && !providerModelsReady(opProvider[op.key])"
                   class="text-[11px] text-slate-400 mt-1">Loading this provider's models…</p>
                <p v-else-if="opProvider[op.key] && modelsForProvider(opProvider[op.key], false).length === 0"
                   class="text-[11px] text-amber-600 mt-1">No active chat models for this provider — sync or activate models below.</p>
              </div>
            </div>
            <div class="flex items-center gap-3 mt-4">
              <button @click="saveOperationModels" type="button"
                      class="px-4 py-2 text-[13px] font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors">Save</button>
              <span class="text-[12px] text-slate-400">Current: <strong class="text-slate-600">{{ currentLabel(op.key) || 'Agent default' }}</strong></span>
            </div>
          </div>
        </template>
      </div>

      <!-- Embedding model — defaults to the fast local model; switching requires re-index -->
      <div class="px-5 sm:px-6 pb-5 sm:pb-6 border-t border-slate-100 pt-5">
        <label class="block text-[13px] font-semibold text-slate-700">Embedding model
          <span class="text-[11px] font-normal text-slate-400">— used for knowledge / RAG vectors</span></label>
        <p class="text-[11px] text-slate-400 mt-0.5 mb-3 leading-snug">Default is <strong>text-embedding-3-small</strong> (served via your OpenAI or OpenRouter provider). Pick a larger model (e.g. text-embedding-3-large) to override. Switching to a <strong>different</strong> model <strong>requires re-indexing</strong> — existing knowledge won't match the new embedder until you re-index. The <strong>same</strong> model on another provider (text-embedding-3-small on OpenRouter or OpenAI) makes the same vectors, so your knowledge carries over as it is.<span v-if="embeddingHealth.supported_dims && embeddingHealth.supported_dims.length"> Only models whose dimension is one of <strong>{{ embeddingHealth.supported_dims.join(', ') }}</strong> can be selected (each has a native ANN index).</span></p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
          <div>
            <label class="block text-[12px] font-semibold text-slate-600 mb-1.5">Provider</label>
            <select aria-label="Emb Provider" v-model="embProvider" @change="onEmbProviderChange"
                    class="w-full bg-white border border-slate-200 rounded-[8px] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm font-medium text-slate-700 cursor-pointer">
              <option :value="null">Default — text-embedding-3-small (OpenAI/OpenRouter)</option>
              <option v-for="p in providers" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-[12px] font-semibold text-slate-600 mb-1.5">Model</label>
            <select aria-label="Embedding model id" v-model="opModels.embedding_model_id" :disabled="!embProvider"
                    class="w-full bg-white border border-slate-200 rounded-[8px] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm font-medium text-slate-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50">
              <option :value="null">{{ embProvider ? 'Select a model…' : 'Default — text-embedding-3-small' }}</option>
              <option v-for="m in embModels" :key="m.id" :value="m.id">{{ m.name }}</option>
            </select>
            <p v-if="embProvider && !providerModelsReady(embProvider)"
               class="text-[11px] text-slate-400 mt-1">Loading this provider's models…</p>
            <p v-else-if="embProvider && embModels.length === 0"
               class="text-[11px] text-amber-600 mt-1 flex items-center gap-2">
              <span>No models found for this provider.</span>
              <button type="button" @click="syncEmbeddingModels" :disabled="syncingEmb"
                      class="inline-flex items-center gap-1 underline text-indigo-600 hover:text-indigo-800 disabled:opacity-60">
                <span v-if="syncingEmb" class="w-3 h-3 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin"></span>
                {{ syncingEmb ? 'Syncing…' : 'Sync now to discover them' }}
              </button>
            </p>
            <p v-if="embProvider && providerModelsReady(embProvider) && embProviderType === 'openrouter' && embModels.length === 0" class="text-[11px] text-amber-600 mt-1">
              No OpenRouter embedding models found yet. Click <strong>“Sync now to discover them”</strong> above — OpenRouter offers ~26 embedding models (e.g. gemini-embedding-2, e5, gte) that are only fetched on a fresh sync.
            </p>
          </div>
        </div>
        <div class="flex items-center gap-3 mt-4">
          <button @click="onEmbeddingChange" type="button"
                  class="px-4 py-2 text-[13px] font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors">Save</button>
          <span class="text-[12px] text-slate-400">Current: <strong class="text-slate-600">{{ currentLabel('embedding_model_id') || 'Default (text-embedding-3-small)' }}</strong></span>
        </div>
        <!-- Retrieval mode: confirms the embedding dimension actually matches the vector store (fast
             native ANN) vs the per-user numpy fallback. Surfaced so 'reindex finished' is verifiable. -->
        <div v-if="embeddingHealth.embedder_dim" class="mt-3 max-w-2xl text-[12px]">
          <span v-if="embeddingHealth.native_ann"
                class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Native ANN active · {{ embeddingHealth.embedder_dim }}-dim (matches the vector store)
          </span>
          <span v-else
                class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200"
                :title="`Your model is ${embeddingHealth.embedder_dim}-dim but the shared vector store is ${embeddingHealth.column_dim}-dim. Retrieval uses the correct per-user fallback (slower). Other users are unaffected.`">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Fallback retrieval · model {{ embeddingHealth.embedder_dim }}-dim ≠ store {{ embeddingHealth.column_dim }}-dim
          </span>
        </div>
        <!-- Atomic switch in progress: the PREVIOUS model is still answering while the new index builds.
             Shown when a switch is pinned and no live poll is running on this page (e.g. after reload). -->
        <div v-if="embeddingHealth.switching && !reindexProgress.active" class="mt-3 p-3.5 rounded-[10px] bg-sky-50 border border-sky-200 max-w-2xl">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[12px] font-semibold text-sky-700">Switching embedding model — previous model still answering</span>
            <span class="text-[12px] font-semibold tabular-nums text-sky-700">{{ embeddingHealth.switch_done }} / {{ embeddingHealth.switch_total }} · {{ embeddingHealth.switch_percent }}%</span>
          </div>
          <div class="h-2 rounded-full bg-sky-100 overflow-hidden">
            <div class="h-full bg-sky-500 rounded-full transition-all duration-500 ease-out" :style="{ width: embeddingHealth.switch_percent + '%' }"></div>
          </div>
          <div class="flex flex-col sm:flex-row sm:items-center gap-2 mt-2">
            <p class="text-[11px] text-sky-500 flex-1">Your knowledge keeps answering with the previous model — it flips to the new one automatically when the rebuild finishes. No downtime.</p>
            <button @click="reindexEmbeddings" :disabled="reindexing" type="button"
                    class="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60 transition-colors whitespace-nowrap">
              {{ reindexing ? 'Resuming…' : 'Resume / finish rebuild' }}
            </button>
          </div>
        </div>
        <!-- Live re-index progress: the re-embed runs on Celery; we poll status so the user sees it move
             and finish (instead of a button that silently flips back). -->
        <div v-else-if="reindexProgress.active" class="mt-3 p-3.5 rounded-[10px] bg-indigo-50 border border-indigo-200 max-w-2xl">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[12px] font-semibold text-indigo-700 flex items-center gap-2">
              <span class="w-3.5 h-3.5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></span>
              Re-indexing knowledge…
            </span>
            <span class="text-[12px] font-semibold tabular-nums text-indigo-700">{{ reindexProgress.done }} / {{ reindexProgress.total }} · {{ reindexProgress.percent }}%</span>
          </div>
          <div class="h-2 rounded-full bg-indigo-100 overflow-hidden">
            <div class="h-full bg-indigo-500 rounded-full transition-all duration-500 ease-out" :style="{ width: reindexProgress.percent + '%' }"></div>
          </div>
          <p class="text-[11px] mt-1.5" :class="reindexProgress.note ? 'text-amber-600' : 'text-indigo-400'">
            {{ reindexProgress.note || 'Runs in the background — you can keep working; this updates live.' }}
          </p>
        </div>
        <!-- Completion confirmation (clears on the next change/reindex). -->
        <div v-else-if="reindexProgress.done_flag" class="mt-3 flex items-center gap-2 p-3 rounded-[10px] bg-emerald-50 border border-emerald-200 max-w-2xl">
          <svg class="w-4 h-4 text-emerald-600 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z" clip-rule="evenodd"/></svg>
          <span class="text-[12px] font-semibold text-emerald-700">Re-indexing complete{{ reindexProgress.total ? ` — ${reindexProgress.total} chunk(s) realigned` : '' }}.</span>
        </div>
        <div v-else-if="embeddingDirty" class="mt-3 flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-[10px] bg-amber-50 border border-amber-200 max-w-2xl">
          <p class="text-[12px] text-amber-700 flex-1 leading-snug">Embedding model changed. Your existing knowledge must be <strong>re-indexed</strong> with the new embedder — until then, RAG retrieval returns no matches.</p>
          <button @click="reindexEmbeddings" :disabled="reindexing" type="button"
                  class="px-3.5 py-2 text-[12px] font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60 transition-colors whitespace-nowrap">
            {{ reindexing ? 'Re-indexing…' : 'Re-index now' }}
          </button>
        </div>
        <!-- Persistent drift warning: chunks embedded by a different model are silently ignored by RAG. -->
        <div v-else-if="embeddingHealth.needs_reindex" class="mt-3 flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-[10px] bg-amber-50 border border-amber-200 max-w-2xl">
          <p class="text-[12px] text-amber-700 flex-1 leading-snug">
            <!-- Two different facts: another MODEL keeps a chunk out of answers; an older CHUNKER does not. -->
            <template v-if="embeddingHealth.embedder_stale_chunks === undefined">
              <strong>{{ embeddingHealth.stale_chunks }}</strong> of {{ embeddingHealth.total_chunks }} knowledge chunk(s) were embedded with a different model and are <strong>not being used in answers</strong>. Re-index to fix.
            </template>
            <template v-else>
              <span v-if="embeddingHealth.embedder_stale_chunks > 0">
                <strong>{{ embeddingHealth.embedder_stale_chunks }}</strong> of {{ embeddingHealth.total_chunks }} knowledge chunk(s) were embedded with a different model and are <strong>not being used in answers</strong>. Re-index to fix.
              </span>
              <span v-if="embeddingHealth.chunker_stale_chunks > 0">
                <strong>{{ embeddingHealth.chunker_stale_chunks }}</strong> of {{ embeddingHealth.total_chunks }} chunk(s) were split by an older version of the chunker. They are still used in answers; re-indexing re-splits them for better matches.
              </span>
            </template>
          </p>
          <button @click="reindexEmbeddings" :disabled="reindexing" type="button"
                  class="px-3.5 py-2 text-[12px] font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60 transition-colors whitespace-nowrap">
            {{ reindexing ? 'Re-indexing…' : 'Re-index now' }}
          </button>
        </div>
      </div>
      </template>
    </div>

    <!-- Models Configuration -->
    <div v-show="pageTab === 'models'" class="bg-white rounded-[16px] shadow-sm border border-slate-200/60 overflow-hidden">
      <div class="p-5 sm:p-6 pb-4 sm:pb-5 border-b border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-base font-bold text-slate-900 admin-section-title">Configured Models</h2>
          <p class="text-[13px] text-slate-500 mt-0.5">Assign models to providers for chat selection.</p>
        </div>
        <div class="flex items-center gap-2 w-full sm:w-auto">
          <select aria-label="Provider filter" v-model="modelFilter" class="flex-1 sm:flex-none bg-white border border-slate-200 rounded-[8px] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm font-medium text-slate-700 cursor-pointer">
            <option value="">All Providers</option>
            <option v-for="provider in providers" :key="provider.id" :value="provider.id">
              {{ provider.name }}
            </option>
          </select>
          <button @click="showAddModel = !showAddModel" type="button"
                  class="px-3.5 py-2 text-[13px] font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors whitespace-nowrap flex items-center gap-1.5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="showAddModel ? 'M6 18L18 6M6 6l12 12' : 'M12 4v16m8-8H4'"></path></svg>
            {{ showAddModel ? 'Close' : 'Add Model' }}
          </button>
        </div>
      </div>

      <div class="p-0">
        <div v-if="modelsLoading && modelRows.length === 0" class="p-8 text-center text-[13px] font-medium text-slate-400">
          Loading models…
        </div>
        <div v-else-if="modelCount === 0 && !modelFilter" class="p-8 text-center text-[13px] font-medium text-slate-500">
          No models configured yet.
        </div>
        <div v-else-if="modelCount === 0" class="p-8 text-center text-[13px] font-medium text-slate-500">
          No models for this provider.
        </div>
        <div v-else class="divide-y divide-slate-100 max-h-[640px] overflow-y-auto" :class="{ 'opacity-60': modelsLoading }">
          <div
            v-for="model in modelRows"
            :key="model.id"
            class="group flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 hover:bg-slate-50/50 transition-colors gap-4"
          >
            <div class="flex items-center gap-4">
               <div class="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100/50 text-indigo-500 flex items-center justify-center shrink-0">
                   <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
               </div>
               <div>
                  <p class="font-bold text-slate-900 text-[14px]">{{ model.name }}</p>
                  <p class="text-[12px] font-mono text-slate-500 mt-0.5 inline-flex items-center gap-1.5">
                    <span class="font-semibold text-slate-400 uppercase">{{ model.provider_name }}</span>
                    <span class="w-1 h-1 rounded-full bg-slate-300"></span>
                    {{ model.model_id }}
                  </p>
                  <p v-if="modelResults[model.id]" class="text-[11px] font-medium mt-0.5 break-words"
                     :class="modelResults[model.id].success ? 'text-emerald-600' : 'text-red-600'">
                    {{ modelResults[model.id].success ? '✓ ' : '✗ ' }}{{ modelResults[model.id].message }}
                  </p>
               </div>
            </div>

            <div class="flex items-center gap-4">
              <!-- Test this exact model -->
              <button
                @click="testModel(model)"
                :disabled="testingModel[model.id]"
                class="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm whitespace-nowrap disabled:opacity-50"
                title="Make a tiny live call with this exact model"
              >
                {{ testingModel[model.id] ? 'Testing…' : 'Test' }}
              </button>
              <!-- Custom Toggle -->
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" v-model="model.is_active" @change="toggleModel(model)" class="sr-only peer">
                <div class="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-500"></div>
                <span class="ml-2.5 text-[12px] font-semibold" :class="model.is_active ? 'text-slate-700' : 'text-slate-400'">{{ model.is_active ? 'Active' : 'Disabled' }}</span>
              </label>

              <!-- Delete Button -->
              <button
                @click="removeModel(model)"
                class="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-1"
                title="Delete Model"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="modelCount > MODELS_PER_PAGE" class="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/30">
          <span class="text-[12px] text-slate-500">
            Showing {{ (modelPage - 1) * MODELS_PER_PAGE + 1 }}–{{ Math.min(modelPage * MODELS_PER_PAGE, modelCount) }} of {{ modelCount }}
          </span>
          <div class="flex items-center gap-1.5">
            <button @click="modelPage = Math.max(1, modelPage - 1)" :disabled="modelPage <= 1" type="button"
                    class="px-2.5 py-1 text-[12px] font-semibold rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Prev</button>
            <span class="text-[12px] font-semibold text-slate-600 px-1">{{ modelPage }} / {{ totalModelPages }}</span>
            <button @click="modelPage = Math.min(totalModelPages, modelPage + 1)" :disabled="modelPage >= totalModelPages" type="button"
                    class="px-2.5 py-1 text-[12px] font-semibold rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Next</button>
          </div>
        </div>
      </div>

      <!-- Add New Model Form (collapsible) -->
      <div v-show="showAddModel" class="border-t border-slate-100 bg-slate-50/50 p-5 sm:p-6">
        <h3 class="text-sm font-bold text-slate-900 mb-4 admin-section-title">Add New Model</h3>
        <form @submit.prevent="createModel" class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">Provider</label>
            <select aria-label="Provider" v-model="newModel.provider" class="w-full bg-white border border-slate-200 rounded-[8px] px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm cursor-pointer" required>
              <option value="" disabled>Select provider</option>
              <option v-for="provider in providers" :key="provider.id" :value="provider.id">
                {{ provider.name }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">Model Name</label>
            <input aria-label="E.g. GPT-4o" v-model="newModel.name" class="w-full bg-white border border-slate-200 rounded-[8px] px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm" placeholder="e.g. GPT-4o" required />
          </div>
          <div>
            <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">Model ID</label>
            <input aria-label="Gpt-4o" v-model="newModel.model_id" class="w-full bg-white border border-slate-200 rounded-[8px] px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm font-mono text-sm" placeholder="gpt-4o" required />
          </div>
          <div>
            <label class="block text-[13px] font-semibold text-slate-700 mb-1.5">Context Window</label>
            <input aria-label="128000" v-model.number="newModel.context_window" type="number" class="w-full bg-white border border-slate-200 rounded-[8px] px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm" placeholder="128000" />
          </div>
          <div class="md:col-span-2 flex justify-end mt-2">
            <button type="submit" class="px-5 py-2.5 bg-slate-900 text-white rounded-[10px] hover:bg-slate-800 transition-all font-semibold shadow-sm border border-transparent shadow-[0_2px_4px_rgba(0,0,0,0.1)] text-[13px] flex items-center gap-2">
               <svg class="w-4 h-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
               Add Model
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Web search engines: the platform's keys; each search is charged to the person's balance -->
    <div v-show="pageTab === 'search'" class="bg-white rounded-[16px] shadow-sm border border-slate-200/60 overflow-hidden" data-test="search-engines">
      <div class="p-5 sm:p-6 pb-4 sm:pb-5 border-b border-slate-100 bg-slate-50/30">
        <h2 class="text-base font-bold text-slate-900 admin-section-title">Web search engines</h2>
        <p class="text-[13px] text-slate-600 mt-0.5">The platform's own keys. Each search is charged to the person's balance at
          this price × the markup. An engine with no price is never used, so it can never run free. Model-based search
          runs on the AI providers above and is charged by its tokens.</p>
      </div>
      <div class="divide-y divide-slate-100">
        <form v-for="e in searchEngines" :key="e.engine" class="p-5 sm:p-6 grid gap-4 md:grid-cols-[180px_1fr_160px_auto] items-end"
              @submit.prevent="saveSearchEngine(e)">
          <div>
            <p class="font-semibold text-slate-900 text-[14px]">{{ e.label }}</p>
            <p class="text-[12px]" :class="e.usable ? 'text-emerald-700' : 'text-slate-500'">{{ e.usable ? 'In use' : (e.has_api_key ? 'Not in use' : 'No key') }}</p>
          </div>
          <div class="grid gap-2">
            <label class="text-[12px] font-semibold text-slate-700" :for="`se-key-${e.engine}`">API key</label>
            <input aria-label="New Key" :id="`se-key-${e.engine}`" v-model="e.newKey" autocomplete="off" type="password"
                   class="w-full bg-white border border-slate-200 rounded-[8px] px-3 py-2 text-[14px]"
                   :placeholder="e.has_api_key ? 'Saved (enter a new key to replace it)' : 'Paste the engine\'s API key'" />
            <template v-if="'cx' in (e.config || {})">
              <label class="text-[12px] font-semibold text-slate-700" :for="`se-cx-${e.engine}`">Search engine id (cx)</label>
              <input aria-label="Cx" :id="`se-cx-${e.engine}`" v-model="e.config.cx" class="w-full bg-white border border-slate-200 rounded-[8px] px-3 py-2 text-[14px]" />
            </template>
          </div>
          <div class="grid gap-2">
            <label class="text-[12px] font-semibold text-slate-700" :for="`se-price-${e.engine}`">Cost per search ($)</label>
            <input aria-label="0.008" :id="`se-price-${e.engine}`" v-model="e.price_per_search_usd" inputmode="decimal" placeholder="0.008"
                   class="w-full bg-white border border-slate-200 rounded-[8px] px-3 py-2 text-[14px]" />
          </div>
          <div class="flex items-center gap-3">
            <label class="inline-flex items-center gap-2 text-[13px] text-slate-700">
              <input v-model="e.is_active" type="checkbox" class="h-4 w-4" /> On
            </label>
            <button type="submit" :disabled="e.saving" class="px-4 py-2 bg-slate-900 text-white rounded-[10px] text-[13px] font-semibold disabled:opacity-50">
              {{ e.saving ? 'Saving…' : 'Save' }}
            </button>
          </div>
        </form>
        <p v-if="!searchEngines.length" class="p-6 text-[13px] text-slate-600">Loading…</p>
      </div>
    </div>

    <!-- Recent Requests -->
    <div v-show="pageTab === 'activity'" class="bg-white rounded-[16px] shadow-sm border border-slate-200/60 overflow-hidden mb-8">
      <div class="p-5 sm:p-6 pb-4 sm:pb-5 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
        <div>
          <h2 class="text-base font-bold text-slate-900 admin-section-title">Recent LLM Requests</h2>
          <p class="text-[13px] text-slate-500 mt-0.5">Last 15 requests grouped by provider and model.</p>
        </div>
        <div v-if="activityLoading" class="text-[13px] font-medium text-slate-400 flex items-center gap-2">
            <svg class="animate-spin h-3.5 w-3.5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            Loading...
        </div>
      </div>
      <div class="p-0">
        <div v-if="activityLoading && groupedRequests.length === 0" class="p-8 text-center text-[13px] font-medium text-slate-400">
          Loading recent requests…
        </div>
        <div v-else-if="groupedRequests.length === 0" class="p-8 text-center text-[13px] font-medium text-slate-500">
          No request history yet.
        </div>
        <div v-else class="p-5 sm:p-6 space-y-6">
          <div v-for="group in groupedRequests" :key="group.label" class="border border-slate-200/60 rounded-[12px] overflow-hidden shadow-sm">
            <div class="px-4 py-3 border-b border-slate-100 bg-slate-50/80 flex items-center gap-2">
               <svg class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
               <span class="text-[13px] font-bold text-slate-700">{{ group.label.replace(' / ', ' • ') }}</span>
            </div>
            <div class="divide-y divide-slate-100 text-[13px]">
              <div
                v-for="request in group.requests"
                :key="request.id"
                class="px-4 py-2.5 grid grid-cols-2 sm:grid-cols-5 gap-3 items-center hover:bg-slate-50/30 transition-colors"
              >
                <div class="flex items-center gap-1.5">
                   <div class="w-2 h-2 rounded-full" :class="request.status === 'error' ? 'bg-red-500' : 'bg-emerald-500'"></div>
                   <span class="font-medium capitalize" :class="request.status === 'error' ? 'text-red-700' : 'text-slate-900'">
                     {{ request.status }}
                   </span>
                </div>
                <span class="text-slate-500 font-mono text-[12px] whitespace-nowrap">{{ formatLatency(request.latency_ms) }}</span>
                <span class="text-slate-500 hidden sm:inline-block"><span class="font-semibold text-slate-700">{{ request.total_tokens ?? '—' }}</span> tokens</span>
                <span class="text-emerald-600 font-mono font-medium hidden sm:inline-block">${{ (request.cost_estimate || 0).toFixed(4) }}</span>
                <span class="text-slate-400 text-[12px] text-right sm:text-left">{{ formatDate(request.created_at) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </template>
  </div>
</template>

<script setup>
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import api, { clearApiCache } from '../services/api'
import { usePoller } from '../composables/usePoller'
import PageLoader from '../components/common/PageLoader.vue'
import LoadError from '../components/common/LoadError.vue'
import { confirm } from '@/composables/useConfirm'

const notify = inject('notify', () => {})

// Page-level initial-load state → drives the full-page spinner on first paint.
const loading = ref(true)
const hasLoaded = ref(false)

// Pull a readable, user-facing message out of an API error. Handles DRF shapes: a string body,
// {error}/{detail}/{message}, or field errors like {name: ["You already have a provider named…"]}.
const apiError = (e, fallback = 'Something went wrong') => {
  const d = e?.response?.data
  if (!d) return e?.message || fallback
  if (typeof d === 'string') return d
  if (d.error) return d.error
  if (d.detail) return d.detail
  if (d.message) return d.message
  const first = Object.values(d).flat?.()[0]
  return (typeof first === 'string' && first) || fallback
}

const providers = ref([])
const modelFilter = ref('')

// Page-level tabs so the four areas aren't stacked into one long scroll.
const pageTabs = [
  { key: 'providers', label: 'Providers' },
  { key: 'models', label: 'Models' },
  { key: 'internal', label: 'Internal & Embedding' },
  { key: 'search', label: 'Web search' },
  { key: 'activity', label: 'Activity' },
]

// The platform's web search engines (keys never come back from the server; `newKey` is only what is typed now).
const searchEngines = ref([])
const loadSearchEngines = async () => {
  const { data } = await api.getPlatformSearchEngines()
  searchEngines.value = (data.engines || []).map(e => ({ ...e, config: { ...(e.config || {}) }, newKey: '', saving: false }))
}
const saveSearchEngine = async (e) => {
  e.saving = true
  try {
    const body = { price_per_search_usd: e.price_per_search_usd === '' ? null : e.price_per_search_usd,
      is_active: !!e.is_active, config: e.config }
    if (e.newKey && e.newKey.trim()) body.api_key = e.newKey.trim()
    const { data } = await api.updatePlatformSearchEngine(e.engine, body)
    Object.assign(e, { ...data.engine, config: { ...(data.engine.config || {}) }, newKey: '', saving: false })
    notify(`${e.label} saved`, 'success')
  } catch (err) {
    e.saving = false
    notify(apiError(err, 'Could not save the search engine'), 'error')
  }
}
const pageTab = ref('providers')
const showAddProvider = ref(false)   // add-forms are collapsed by default to save vertical space
const showAddModel = ref(false)

// EACH TAB FETCHES ITS OWN DATA, THE FIRST TIME IT IS OPENED. The page used to download all four tabs'
// data before showing the first one: every model row in full (~900 KB for an OpenRouter account) to
// render ten of them, a usage report to show its last 15 lines, and the embedding health check.
// `providers` is the tab the page opens on, so it is what mount loads.
const tabLoaded = ref({ providers: true })
const openTab = async (key) => {
  if (tabLoaded.value[key]) return
  tabLoaded.value[key] = true
  try {
    if (key === 'models') await loadModelsPage()
    else if (key === 'internal') await Promise.all([loadOperationModels(), loadEmbeddingHealth()])
    else if (key === 'activity') await loadRecentRequests()
    else if (key === 'search') await loadSearchEngines()
  } catch (e) {
    tabLoaded.value[key] = false     // so opening the tab again retries
    notify(apiError(e, 'Failed to load this tab'), 'error')
  }
}

// Configured Models: one page of 10 at a time, paged and filtered by the server.
const modelPage = ref(1)
const MODELS_PER_PAGE = 10
const modelRows = ref([])
const modelCount = ref(0)
const modelsLoading = ref(false)
// The Models tab's count comes with the providers, so the badge needs no model rows.
const modelTotal = computed(() => providers.value.reduce((n, p) => n + (p.model_count || 0), 0))

// The pickers on the Internal & Embedding tab fetch models ONE PROVIDER AT A TIME, when a picker points at
// that provider. `selectedModels` are the saved picks' own rows, which arrive with the picks themselves.
const modelsByProvider = ref({})     // { [providerId]: rows }
const selectedModels = ref([])
const providerModelsReady = (pid) => !pid || !!modelsByProvider.value[pid]
// A provider's rows, or — until its list arrives — just the saved picks on it, so a picker shows its
// current choice at once instead of an empty box.
const providerModels = (pid) => modelsByProvider.value[pid] || selectedModels.value.filter((m) => m.provider === pid)
const modelIndex = computed(() => {
  const index = {}
  for (const m of selectedModels.value) index[m.id] = m
  for (const rows of Object.values(modelsByProvider.value)) for (const m of rows) index[m.id] = m
  return index
})
const loadProviderModels = async (pid, force = false) => {
  if (!pid || (!force && modelsByProvider.value[pid])) return
  const { data } = await api.getLlmModels({ slim: 1, provider: pid })
  modelsByProvider.value = { ...modelsByProvider.value, [pid]: data.results || data }
}
// The list behind every provider a picker currently points at.
const pickerProviders = () => [...new Set([...Object.values(opProvider.value), embProvider.value].filter(Boolean))]
const loadPickerLists = (force = false) =>
  Promise.all(pickerProviders().map((pid) => loadProviderModels(pid, force).catch(() => {})))

// After anything that adds, removes or re-syncs models: re-read what is on screen, and forget the lists
// that are not (a picker fetches them again when it next needs them).
const refreshModels = async () => {
  const shown = new Set(tabLoaded.value.internal ? pickerProviders() : [])
  modelsByProvider.value = Object.fromEntries(
    Object.entries(modelsByProvider.value).filter(([pid]) => shown.has(Number(pid))))
  await Promise.all([
    tabLoaded.value.models ? loadModelsPage() : null,
    tabLoaded.value.internal ? loadPickerLists(true) : null,
  ])
}

// ── Models for internal operations (per-user; null = agent default) ──
const operationDefs = [
  { key: 'ask_llm_model_id', label: 'ASK_LLM', help: "Model the agent's ASK_LLM tool uses." },
  { key: 'summarize_model_id', label: 'Compact & summarization', help: 'Model that summarizes / compacts long conversation history.' },
  { key: 'artifact_summarize_model_id', label: 'Artifact summarization', help: 'Model that summarizes large tool outputs (else fast deterministic head/tail).' },
  { key: 'turn_router_model_id', label: 'Turn router / manager', help: 'Fast model that pre-routes each turn (greeting vs tool task vs deep task). Leave as Agent default to use a built-in fast model (Haiku) on the agent\'s own provider.' },
  { key: 'enrichment_model_id', label: 'CRS Enrichment Pipeline', help: 'Model for the CRS code-artifact enrichment pipeline AND connector/service schema enrichment. Leave unset to skip enrichment. CRS (a background task) uses the repository owner\'s pick.' },
  { key: 'verifier_model_id', label: 'Final verifier / LLM judge', help: 'Model for the final-answer grounding judge (catches fabrication / ungrounded claims). Leave as Agent default to fall back to the summarize model.' },
  { key: 'rag_contextual_model_id', label: 'RAG Contextual LLM', help: 'Model that writes per-chunk retrieval context (contextual retrieval) and extracts facts for complete-document answers. Leave as Agent default to use the agent\'s own model.' },
  { key: 'planning_model_id', label: 'Planning LLM', help: 'Model used for PLANNING — the triage (plan depth) and detailed-planner calls when the agent drafts a plan. Leave as Agent default to plan with the agent\'s main model; pick a stronger model for better plans or a cheaper one to save cost.' },
]
const opModels = ref({ ask_llm_model_id: null, summarize_model_id: null, artifact_summarize_model_id: null, turn_router_model_id: null, enrichment_model_id: null, verifier_model_id: null, rag_contextual_model_id: null, planning_model_id: null, embedding_model_id: null })
const embeddingDirty = ref(false)
const reindexing = ref(false)
// Persistent embedding-health (independent of a just-made change): how many stored chunks were
// embedded by a different model than the current one and are therefore ignored by retrieval.
const embeddingHealth = ref({ needs_reindex: false, stale_chunks: 0, total_chunks: 0 })
const loadEmbeddingHealth = async () => {
  try {
    const r = await api.getEmbeddingStatus()
    embeddingHealth.value = r.data || { needs_reindex: false, stale_chunks: 0, total_chunks: 0 }
  } catch (e) { /* non-fatal: just hides the banner */ }
}

// Active operation tab + the provider chosen for each operation (provider → model → save).
const opActiveTab = ref('ask_llm_model_id')
const opProvider = ref({ ask_llm_model_id: null, summarize_model_id: null, artifact_summarize_model_id: null, turn_router_model_id: null, enrichment_model_id: null, verifier_model_id: null, rag_contextual_model_id: null, planning_model_id: null })
const embProvider = ref(null)
// Embedding models for the selected provider. If the provider has any models flagged is_embedding
// (OpenRouter/OpenAI sync tags them), show ONLY those so the user isn't hunting through hundreds of
// chat models. Otherwise fall back to all active models (providers whose flag is unreliable).
const embModels = computed(() => {
  const active = providerModels(embProvider.value).filter((m) => m.is_active !== false)
  const flagged = active.filter((m) => m.is_embedding)
  return flagged.length ? flagged : active
})
const syncingEmb = ref(false)
const embProviderType = computed(() => {
  const p = providers.value.find((x) => x.id === embProvider.value)
  return p ? (p.provider_type || p.type) : null
})

// Discover the selected provider's embedding models on demand (e.g. text-embedding-3-small for OpenAI),
// then refresh the model list so the dropdown populates — no hunting for a sync button elsewhere.
const syncEmbeddingModels = async () => {
  if (!embProvider.value || syncingEmb.value) return
  syncingEmb.value = true
  try {
    const provider = providers.value.find((p) => p.id === embProvider.value)
    const started = await startSync(provider || { id: embProvider.value }, { announce: false })
    const state = started?.status === 'syncing' ? await waitForSync(embProvider.value) : started
    if (state?.status === 'error') throw new Error(state.error || 'the sync failed')
    await Promise.all([refreshModels(), loadProviders().catch(() => {})])
    // `notify` here is the INJECTED function form notify(msg, type) — NOT the imported object with
    // .success()/.error() methods. Calling notify.success(...) throws "is not a function".
    if (embModels.value.length) notify(`Found ${embModels.value.length} model(s)`, 'success')
    else notify('Provider returned no models — check the API key for this provider.', 'info')
  } catch (e) {
    notify('Sync failed: ' + (e.response?.data?.error || e.message), 'error')
  } finally {
    syncingEmb.value = false
  }
}

// Active models for a provider, split by chat vs embedding so each picker only shows what fits.
const modelsForProvider = (pid, embedding = false) => {
  if (!pid) return []
  return providerModels(pid).filter((m) => m.is_active !== false && !!m.is_embedding === embedding)
}
// Choosing a provider in a picker is what fetches that provider's models.
const onOpProviderChange = (key) => {
  opModels.value[key] = null
  loadProviderModels(opProvider.value[key]).catch((e) => notify(apiError(e, 'Failed to load models'), 'error'))
}
const onEmbProviderChange = () => {
  opModels.value.embedding_model_id = null
  loadProviderModels(embProvider.value).catch((e) => notify(apiError(e, 'Failed to load models'), 'error'))
}
const currentLabel = (key) => {
  const m = modelIndex.value[opModels.value[key]]
  return m ? `${m.provider_name} • ${m.name}` : ''
}
// After the saved selections load, pre-select the provider that owns each chosen model.
const deriveOpProviders = () => {
  for (const key of ['ask_llm_model_id', 'summarize_model_id', 'artifact_summarize_model_id', 'turn_router_model_id', 'enrichment_model_id', 'verifier_model_id', 'rag_contextual_model_id', 'planning_model_id']) {
    const m = modelIndex.value[opModels.value[key]]
    opProvider.value[key] = m ? m.provider : null
  }
  const em = modelIndex.value[opModels.value.embedding_model_id]
  embProvider.value = em ? em.provider : null
}

// The saved picks are read, or the tab shows an error: never the "Agent default" blanks as if saved.
const opLoadError = ref('')
const opRetrying = ref(false)
const retryInternalTab = async () => {
  opRetrying.value = true
  try { await openTab('internal') } finally { opRetrying.value = false }
}
const loadOperationModels = async () => {
  try {
    const r = await api.getOperationModels()
    selectedModels.value = r.data.selected_models || []
    opModels.value = {
      ask_llm_model_id: r.data.ask_llm_model_id ?? null,
      summarize_model_id: r.data.summarize_model_id ?? null,
      artifact_summarize_model_id: r.data.artifact_summarize_model_id ?? null,
      turn_router_model_id: r.data.turn_router_model_id ?? null,
      enrichment_model_id: r.data.enrichment_model_id ?? null,
      verifier_model_id: r.data.verifier_model_id ?? null,
      rag_contextual_model_id: r.data.rag_contextual_model_id ?? null,
      planning_model_id: r.data.planning_model_id ?? null,
      embedding_model_id: r.data.embedding_model_id ?? null,
    }
    deriveOpProviders()
    opLoadError.value = ''
    await loadPickerLists()
  } catch (e) {
    opLoadError.value = apiError(e, 'Check your connection and try again.')
    throw e
  }
}
const saveOperationModels = async () => {
  try {
    await api.updateOperationModels(opModels.value)
    notify('Operation models saved', 'success')
  } catch (e) {
    notify('Failed to save: ' + (e.response?.data?.error || e.message), 'error')
  }
}
const onEmbeddingChange = async () => {
  const label = currentLabel('embedding_model_id') || 'Default (text-embedding-3-small)'
  try {
    const res = await api.updateOperationModels(opModels.value)
    reindexProgress.value.done_flag = false        // a new change supersedes any prior "complete" note
    if (res?.data?.embedding_switch === 'same_model') {
      // The same model on another provider: the stored vectors were kept (renamed server-side), so there
      // is nothing to re-index -- telling the user to re-index would send them to pay for what they have.
      embeddingDirty.value = false
      notify(`Embedding model saved${label ? ' — ' + label : ''}. Same model on a new provider: your knowledge base keeps working as it is, nothing to re-index.`, 'success')
    } else {
      embeddingDirty.value = true
      notify(`Embedding model saved${label ? ' — ' + label : ''}. Re-index your knowledge to apply it.`, 'success')
    }
    // Refresh the health badge so the user immediately sees the new model vs. the stored vectors.
    await loadEmbeddingHealth()
  } catch (e) {
    // The backend rejects models whose dimension has no native ANN index (400) — surface that clearly.
    notify('Failed to save: ' + (e.response?.data?.error || e.message), 'error')
  }
}

// Live re-index progress. The re-embed runs on Celery (async), so the POST only ENQUEUES it; we then
// POLL the status endpoint — `stale_chunks` falls toward 0 as the worker re-embeds, which drives the bar.
const reindexProgress = ref({ active: false, total: 0, done: 0, percent: 0, done_flag: false, note: '' })
let _reindexTimer = null
const _clearReindexTimer = () => { if (_reindexTimer) { clearTimeout(_reindexTimer); _reindexTimer = null } }

const _pollReindex = async () => {
  _reindexTimer = null
  const p = reindexProgress.value
  try {
    const r = await api.getEmbeddingStatus()
    const d = r.data || {}
    embeddingHealth.value = { ...embeddingHealth.value, ...d }
    // Atomic switch: the old model keeps serving while the new gen builds — progress comes from the
    // switch_* fields, and "complete" is the FLIP (switching → false). Otherwise (plain re-index) the
    // bar is driven by stale_chunks falling to 0.
    const switching = !!d.switching
    const total = switching ? (d.switch_total || p.total || 0) : (d.total_chunks || p.total || 0)
    const done = switching ? (d.switch_done || 0) : Math.max(0, total - (d.stale_chunks || 0))
    p.total = total
    p.done = done
    p.percent = switching ? (d.switch_percent || 0) : (total ? Math.round((done / total) * 100) : 100)

    const complete = switching ? false : (!d.needs_reindex || (d.stale_chunks || 0) === 0)
    // For a switch, completion is detected when `switching` drops to false (the flip happened) AFTER we
    // saw it true at least once.
    const flipped = !switching && p._sawSwitch
    if (complete || flipped) {                                 // ── complete / flipped ──
      p.percent = 100
      p.done = p.total
      p.active = false
      p.done_flag = true
      p.note = ''
      reindexing.value = false
      embeddingDirty.value = false
      notify(flipped ? 'Switch complete — now serving the new embedding model.'
                     : (p.total ? `Re-indexing complete — ${p.total} chunk(s) realigned${d.embedder_dim ? ' at ' + d.embedder_dim + '-dim' : ''}.`
                                : 'Re-indexing complete.'), 'success')
      if (d.native_ann === false) {
        notify(`Note: retrieval uses the per-user fallback (model ${d.embedder_dim}-dim ≠ store ${d.column_dim}-dim) — other users unaffected.`, 'info')
      }
      return
    }
    if (switching) p._sawSwitch = true

    // ── still running: stall detection + safety cap ──
    p._polls = (p._polls || 0) + 1
    p._stall = (done === p._lastDone) ? (p._stall || 0) + 1 : 0
    p._lastDone = done
    if (done === 0 && p._stall >= 4) {
      p.note = 'Waiting on the background worker — re-indexing runs on Celery, so make sure the worker is running.'
    } else if (p._stall >= 8) {
      p.note = 'Still working in the background — you can leave this page; progress is saved.'
    } else {
      p.note = ''
    }
    if (p._polls > 80) {                                       // ~4 min cap — stop polling, keep banner honest
      p.active = false
      reindexing.value = false
      p.note = ''
      notify('Re-indexing is still running in the background — reopen this page later to see the final state.', 'info')
      return
    }
    _reindexTimer = setTimeout(_pollReindex, 3000)
  } catch (e) {
    // Transient status error — back off and retry a few times before giving up.
    p._polls = (p._polls || 0) + 1
    if (p._polls > 80) { p.active = false; reindexing.value = false; return }
    _reindexTimer = setTimeout(_pollReindex, 4000)
  }
}

const reindexEmbeddings = async () => {
  if (reindexing.value) return
  // Re-index is never auto-started on save — it's a paid action (generates new embeddings billed to
  // Activity/Usage), so require an explicit confirmation that states the scope + cost first.
  const total = embeddingHealth.value.total_chunks || embeddingHealth.value.stale_chunks || 0
  const ok = await confirm({
    title: 'Re-index knowledge?',
    message: `This re-embeds ${total ? total.toLocaleString() + ' knowledge chunk(s)' : 'your knowledge'} `
           + `with the current embedding model. It runs in the background and generates new embeddings — `
           + `the cost is metered to your Activity / Usage as embedding cost (a local model is free). `
           + `You can keep working while it runs.`,
    confirmText: 'Re-index now',
    cancelText: 'Cancel',
  })
  if (!ok) return
  _clearReindexTimer()
  reindexing.value = true
  reindexProgress.value = { active: true, total: 0, done: 0, percent: 0, done_flag: false, note: '',
                            _polls: 0, _stall: 0, _lastDone: -1, _sawSwitch: false }
  try {
    const r = await api.reindexEmbeddings()
    const d = r.data || {}
    const total = d.total_chunks ?? d.stale_chunks ?? 0
    reindexProgress.value.total = total
    let msg = d.stale_chunks ? `Re-indexing started — realigning ${d.stale_chunks} chunk(s)` : 'Re-indexing started'
    if (d.embedder_dim) msg += ` at ${d.embedder_dim}-dim`
    notify(msg, d.native_ann === false ? 'info' : 'success')
    if (total === 0) {                                          // nothing to do — finish immediately
      reindexProgress.value.active = false
      reindexProgress.value.done_flag = true
      reindexProgress.value.percent = 100
      reindexing.value = false
      notify('No knowledge chunks to re-index.', 'info')
      return
    }
    _reindexTimer = setTimeout(_pollReindex, 2500)              // begin live polling
  } catch (e) {
    reindexProgress.value.active = false
    reindexing.value = false
    notify('Failed to start re-index: ' + (e.response?.data?.error || e.message), 'error')
  }
}
onBeforeUnmount(_clearReindexTimer)

const newProvider = ref({
  name: '',
  provider_type: 'openrouter',   // cloud default — not local Ollama (avoids accidental ollama providers)
  base_url: '',
  api_key: '',
  is_active: true,
  partner_account: null,         // null = a general platform API; a partner account's id = only that partner's
})

// Partner accounts (the partner switch on) a provider can be dedicated to, from the Partner Agent API keys page.
const partnerAccounts = ref([])
const loadPartnerAccounts = async () => {
  try {
    const { data } = await api.getPartnerKeys()
    const rows = Array.isArray(data) ? data : (data?.keys || data?.results || [])
    const seen = new Map()
    for (const k of rows) {
      if (k.is_partner_account && k.user_id != null && !seen.has(k.user_id)) seen.set(k.user_id, { id: k.user_id, label: k.user_label || `user ${k.user_id}` })
    }
    partnerAccounts.value = [...seen.values()]
  } catch (e) {
    partnerAccounts.value = []
  }
}
const setAvailableTo = async (provider, value) => {
  const partner = value ? Number(value) : null
  try {
    await api.updateLlmProvider(provider.id, { ...provider, partner_account: partner })
    notify(partner ? 'Now only that partner can use this provider' : 'Now a platform API for everyone', 'success')
    await loadProviders()
  } catch (e) {
    notify(apiError(e, 'Could not change who can use this provider'), 'error')
    await loadProviders()
  }
}

const newModel = ref({
  provider: '',
  name: '',
  model_id: '',
  context_window: 0,
  is_active: true
})

// Provider/model connectivity test state.
const testing = ref({})        // { [providerId]: boolean }
const testResults = ref({})    // { [providerId]: { success, message } }
const testingModel = ref({})   // { [modelId]: boolean }
const modelResults = ref({})   // { [modelId]: { success, message } }

// Every provider type the server supports, from GET /llm/provider-types/: the add form's menu, which types sync
// their model list, and each type's address hint.
const providerTypes = ref([])
const providerTypesError = ref('')
const loadProviderTypes = async () => {
  providerTypesError.value = ''
  try {
    const { data } = await api.getLlmProviderTypes()
    providerTypes.value = data?.types || []
  } catch (e) {
    providerTypesError.value = apiError(e, "Couldn't load the provider types. Reload the page to try again.")
  }
}
const providerTypeGroups = computed(() => [
  { kind: 'chat', label: 'Chat models', types: providerTypes.value.filter((t) => t.kind === 'chat') },
  { kind: 'media', label: 'Images, video and audio', types: providerTypes.value.filter((t) => t.kind === 'media') },
].filter((g) => g.types.length))
const selectedProviderType = computed(() => providerTypes.value.find((t) => t.type === newProvider.value.provider_type))
const makesText = (makes = []) => {
  const words = makes.map((m) => ({ text: 'transcripts' }[m] || (m === 'image' ? 'images' : m)))
  return words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}` : (words[0] || '')
}
// Provider types whose model list the backend can discover (provider_model_sync.SYNCABLE_TYPES).
const SYNCABLE_TYPES = computed(() => providerTypes.value.filter((t) => t.syncable).map((t) => t.type))
const syncing = ref({})          // { [providerId]: boolean } while the Sync request itself is in flight
const savingAutoSync = ref({})   // { [providerId]: boolean }

// Absent means ON — the backend re-syncs every provider daily unless it was switched off.
const autoSyncOn = (provider) => provider.metadata?.auto_sync_models !== false

const setAutoSync = async (provider, enabled) => {
  savingAutoSync.value[provider.id] = true
  const previous = provider.metadata
  provider.metadata = { ...(provider.metadata || {}), auto_sync_models: enabled }
  try {
    const res = await api.updateLlmProvider(provider.id, { ...provider })
    if (res?.data?.metadata) provider.metadata = res.data.metadata
    notify(enabled ? 'Daily model sync on' : 'Daily model sync off', 'success')
  } catch (e) {
    provider.metadata = previous
    notify(apiError(e, 'Failed to update auto-sync'), 'error')
  } finally {
    savingAutoSync.value[provider.id] = false
  }
}

const timeAgo = (iso) => {
  if (!iso) return ''
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (Number.isNaN(seconds)) return ''
  if (seconds < 60) return 'just now'
  const units = [['d', 86400], ['h', 3600], ['m', 60]]
  for (const [label, size] of units) {
    if (seconds >= size) return `${Math.floor(seconds / size)}${label} ago`
  }
  return 'just now'
}

const loadProviders = async () => {
  const response = await api.getLlmProviders()
  providers.value = response.data.results || response.data
  if (providers.value.some(syncRunning)) syncPoller.start({ immediate: false })
}

// ── Model sync: it runs on the server in the background ──
// Adding a provider and pressing Sync Models both answer at once with `model_sync.status === 'syncing'`;
// the page then asks for that provider's sync state every few seconds until it is ok, skipped or error.
const syncRunning = (provider) => provider?.metadata?.model_sync?.status === 'syncing'
const isSyncing = (provider) => !!syncing.value[provider.id] || syncRunning(provider)
const syncsStartedHere = new Set()   // only a sync started on this page says how it ended
const syncWaiters = {}               // { [providerId]: [resolve] } — the embedding picker waits for its sync

const setSyncState = (provider, state) => {
  if (state) provider.metadata = { ...(provider.metadata || {}), model_sync: state }
}

const syncFinished = async (provider) => {
  const state = provider.metadata.model_sync
  if (syncsStartedHere.delete(provider.id)) {
    if (state.status === 'ok') {
      notify(`Synced ${(state.created || 0) + (state.updated || 0)} models from ${provider.name} (${state.created || 0} new, ${state.updated || 0} updated)`, 'success')
    } else if (state.status === 'skipped') {
      notify(`Sync skipped: ${state.error}`, 'info')
    } else {
      notify(`Model sync failed for ${provider.name}: ${state.error || 'upstream error'}`, 'error')
    }
  }
  for (const resolve of syncWaiters[provider.id] || []) resolve(state)
  delete syncWaiters[provider.id]
}

const syncPoller = usePoller(async ({ signal }) => {
  const finished = []
  for (const provider of providers.value.filter(syncRunning)) {
    const { data } = await api.getModelSync(provider.id, { signal })
    setSyncState(provider, data?.model_sync)
    if (!syncRunning(provider)) finished.push(provider)
  }
  if (finished.length) {
    // The sync wrote models server-side; the cached model and provider lists are from before it.
    clearApiCache()
    await Promise.all(finished.map(syncFinished))
    await Promise.all([refreshModels().catch(() => {}), loadProviders().catch(() => {})])
  }
  return providers.value.some(syncRunning)
}, { interval: 3000, stopWhen: (stillRunning) => !stillRunning })

const waitForSync = (providerId) => new Promise((resolve) => {
  (syncWaiters[providerId] = syncWaiters[providerId] || []).push(resolve)
})

// POST the sync and start watching it. Throws when the server refused to start it. `announce: false` when
// the caller says itself how it ended (the embedding picker).
const startSync = async (provider, { announce = true } = {}) => {
  syncing.value[provider.id] = true
  try {
    const { data } = await api.syncModels(provider.id)
    setSyncState(provider, data?.model_sync)
    if (announce) syncsStartedHere.add(provider.id)
    syncPoller.start({ immediate: false })
    return data?.model_sync
  } finally {
    syncing.value[provider.id] = false
  }
}

const loadModelsPage = async () => {
  // Every platform model, whoever it is for (admin view), not only the ones this administrator may pick.
  const params = { slim: 1, page: modelPage.value, page_size: MODELS_PER_PAGE, scope: 'platform' }
  if (modelFilter.value) params.provider = modelFilter.value
  modelsLoading.value = true
  try {
    const { data } = await api.getLlmModels(params)
    modelRows.value = data.results || []
    modelCount.value = data.count || 0
  } catch (e) {
    // A page past the end (its last model was just deleted): step back, and the page watcher re-reads.
    if (e?.response?.status === 404 && modelPage.value > 1) { modelPage.value -= 1; return }
    throw e
  } finally {
    modelsLoading.value = false
  }
}

// Activity: the last 15 requests — asked for as 15 requests, not as a whole usage report.
const recentRequests = ref([])
const activityLoading = ref(false)
const loadRecentRequests = async () => {
  activityLoading.value = true
  try {
    const { data } = await api.getLlmRequests({ page_size: 15 })
    recentRequests.value = data.results || []
  } finally {
    activityLoading.value = false
  }
}

// Live test: a tiny 1-token call through the provider (optionally a specific model). Shows the real
// reason on failure (e.g. "Key limit exceeded") so you catch a bad key/limit before a chat fails.
const testProvider = async (provider, model = null) => {
  testing.value[provider.id] = true
  try {
    const res = await api.testLlmProvider(provider.id, model)
    const d = res.data || {}
    testResults.value[provider.id] = {
      success: !!d.success,
      message: d.message || (d.success ? 'Connected.' : 'Failed.'),
    }
  } catch (e) {
    const msg = e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Test failed'
    testResults.value[provider.id] = { success: false, message: msg }
  } finally {
    testing.value[provider.id] = false
  }
}

// Test one exact model (passes its model_id; keyed by model id so each row shows its own result).
const testModel = async (model) => {
  testingModel.value[model.id] = true
  try {
    const res = await api.testLlmProvider(model.provider, model.model_id)
    const d = res.data || {}
    modelResults.value[model.id] = {
      success: !!d.success,
      message: d.message || (d.success ? 'Connected.' : 'Failed.'),
    }
  } catch (e) {
    const msg = e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Test failed'
    modelResults.value[model.id] = { success: false, message: msg }
  } finally {
    testingModel.value[model.id] = false
  }
}

const createProvider = async () => {
  try {
    const { data } = await api.createLlmProvider(newProvider.value)
    // The provider is saved; its models sync in the background, and the list says when that is done.
    if (syncRunning(data)) {
      syncsStartedHere.add(data.id)
      notify('Provider added — syncing its models…', 'success')
    } else {
      notify('Provider added', 'success')
    }
    newProvider.value = {
      name: '',
      provider_type: 'openrouter',
      base_url: '',
      api_key: '',
      is_active: true,
      partner_account: null,
    }
    await Promise.all([loadProviders(), refreshModels()])
    showAddProvider.value = false
  } catch (e) {
    // e.g. duplicate name → backend returns {name: ["You already have a provider named …"]}
    notify(apiError(e, 'Failed to add provider'), 'error')
  }
}

const createModel = async () => {
  try {
    await api.createLlmModel(newModel.value)
    notify('Model added', 'success')
    newModel.value = {
      provider: '',
      name: '',
      model_id: '',
      context_window: 0,
      is_active: true
    }
    await Promise.all([loadProviders(), refreshModels()])     // providers carry the model counts
    showAddModel.value = false
  } catch (e) {
    notify(apiError(e, 'Failed to add model'), 'error')
  }
}

const toggleProvider = async (provider) => {
  await api.updateLlmProvider(provider.id, {
    ...provider,
    is_active: provider.is_active
  })
  notify('Provider updated', 'success')
}

const toggleModel = async (model) => {
  await api.updateLlmModel(model.id, {
    ...model,
    is_active: model.is_active
  })
  notify('Model updated', 'success')
  // The pickers list active models only, so a list already fetched for this provider is now out of date.
  if (modelsByProvider.value[model.provider]) loadProviderModels(model.provider, true).catch(() => {})
}

const removeProvider = async (provider) => {
  if (!(await confirm({ title: 'Delete provider?', message: `Delete provider "${provider.name}"?`, confirmText: 'Delete', danger: true }))) return
  await api.deleteLlmProvider(provider.id)
  notify('Provider deleted', 'success')
  await Promise.all([loadProviders(), refreshModels()])
}

const removeModel = async (model) => {
  if (!(await confirm({ title: 'Delete model?', message: `Delete model "${model.name}"?`, confirmText: 'Delete', danger: true }))) return
  await api.deleteLlmModel(model.id)
  notify('Model deleted', 'success')
  await Promise.all([loadProviders(), refreshModels()])       // providers carry the model counts
}

// Generic manual re-sync — works for every syncable provider type via one backend endpoint.
const syncModels = async (provider) => {
  if (isSyncing(provider)) return
  try {
    await startSync(provider)
  } catch (error) {
    notify('Failed to sync: ' + apiError(error, 'upstream error'), 'error')
    // The backend records every attempt on the provider — refresh to show it.
    await loadProviders().catch(() => {})
  }
}

const totalModelPages = computed(() => Math.max(1, Math.ceil(modelCount.value / MODELS_PER_PAGE)))

const groupedRequests = computed(() => {
  const recent = recentRequests.value
  const groups = {}
  recent.forEach((request) => {
    const label = `${request.provider || 'unknown'} / ${request.model || 'default'}`
    if (!groups[label]) {
      groups[label] = []
    }
    groups[label].push(request)
  })
  return Object.entries(groups).map(([label, requests]) => ({ label, requests }))
})

const formatLatency = (value) => {
  if (value === null || value === undefined) return '—'
  return `${Math.round(value)} ms`
}

const formatDate = (value) => {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

// A page turn or a provider filter re-reads the one page on screen. Changing the filter goes back to
// page 1; if that moves the page, the page watcher does the read, otherwise the filter watcher does.
const reloadModelsPage = () => loadModelsPage().catch((e) => notify(apiError(e, 'Failed to load models'), 'error'))
watch(modelPage, reloadModelsPage)
watch(modelFilter, () => {
  if (modelPage.value !== 1) modelPage.value = 1
  else reloadModelsPage()
})
watch(pageTab, openTab)

onMounted(async () => {
  // Only the tab the page opens on. Every other tab loads its own data when it is first opened (openTab).
  try {
    await Promise.all([loadProviders(), loadProviderTypes(), loadPartnerAccounts()])
  } catch (e) {
    notify(apiError(e, 'Failed to load providers'), 'error')
  } finally {
    loading.value = false
    hasLoaded.value = true
  }
})
</script>

<style scoped>
.input {
  @apply w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500;
}

.btn-primary {
  @apply bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700;
}
</style>
