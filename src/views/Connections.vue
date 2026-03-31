<template>
  <div class="connections-container p-6 lg:p-8 space-y-8">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
             <div class="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center shrink-0">
                 <svg class="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
             </div>
             Connections
          </h1>
          <p class="mt-1.5 text-sm sm:text-base text-slate-500">
            Connect your accounts — agents will use them automatically
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <!-- Segmented Filter Control -->
          <div class="flex p-1 bg-slate-100/80 rounded-[10px] border border-slate-200/50">
             <button
                @click="activeTab = 'personal'"
                :class="['px-4 py-1.5 rounded-md text-[13px] font-semibold transition-all duration-200 flex items-center gap-1.5',
                  activeTab === 'personal'
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
                    : 'text-slate-500 hover:text-slate-700']"
             >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                Personal
             </button>
             <button
                v-if="orgData"
                @click="activeTab = 'organization'"
                :class="['px-4 py-1.5 rounded-md text-[13px] font-semibold transition-all duration-200 flex items-center gap-1.5',
                  activeTab === 'organization'
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
                    : 'text-slate-500 hover:text-slate-700']"
             >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                {{ orgData.name || 'Organization' }}
             </button>
             <button
                @click="activeTab = 'credentials'"
                :class="['px-4 py-1.5 rounded-md text-[13px] font-semibold transition-all duration-200 flex items-center gap-1.5',
                  activeTab === 'credentials'
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
                    : 'text-slate-500 hover:text-slate-700']"
             >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg>
                Credentials
             </button>
          </div>

          <router-link
            to="/docs/connections"
            class="px-3 py-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-[10px] transition-colors flex items-center justify-center p-2"
            title="Provider Docs"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
          </router-link>
          
          <button
            v-if="isAdmin"
            @click="openCreateModal"
            class="px-5 py-2.5 bg-slate-900 text-white rounded-[10px] hover:bg-slate-800 transition-all font-semibold shadow-[0_2px_4px_rgba(0,0,0,0.1)] text-[13px] flex items-center gap-2"
          >
            <svg class="w-4 h-4 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
            Add Provider
          </button>
        </div>
      </div>

      <!-- Credentials Tab Content -->
      <div v-if="activeTab === 'credentials'" class="bg-white rounded-[16px] shadow-sm border border-slate-200/60" style="min-height: 500px;">
        <CredentialManager />
      </div>

      <!-- OAuth Provider Content (shown for personal/organization tabs) -->
      <template v-else>

      <!-- Integrated Metrics Bar -->
      <div class="bg-white rounded-[16px] shadow-sm border border-slate-200/60 overflow-hidden mb-8">
        <div class="grid grid-cols-2 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          <div class="p-5 sm:p-6 lg:px-8 flex flex-col justify-center">
            <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Available Providers</p>
            <span class="text-3xl font-bold tracking-tight text-slate-900">{{ providers.length }}</span>
          </div>
          <div class="p-5 sm:p-6 lg:px-8 flex flex-col justify-center border-l-0 md:border-l border-slate-100">
            <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Personal Connections</p>
            <span class="text-3xl font-bold tracking-tight text-emerald-600">{{ personalConnectedCount }}</span>
          </div>
          <div v-if="orgData" class="p-5 sm:p-6 lg:px-8 flex flex-col justify-center border-l-0 md:border-l border-slate-100">
            <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Org Connections</p>
            <span class="text-3xl font-bold tracking-tight text-purple-600">{{ orgConnectedCount }}</span>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p class="mt-4 text-gray-600">Loading providers...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="providers.length === 0" class="bg-white rounded-lg shadow-lg p-12 text-center">
        <div class="text-6xl mb-4">🔌</div>
        <h2 class="text-2xl font-bold text-gray-900 mb-2">No Providers Available</h2>
        <p class="text-gray-600 mb-6 max-w-md mx-auto">
          No OAuth providers configured yet.
        </p>
        <button
          v-if="isAdmin"
          @click="openCreateModal"
          class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
        >
          Add First Provider
        </button>
        <p v-else class="text-gray-500 text-sm">An admin needs to set up provider credentials.</p>
      </div>

      <!-- Provider Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="provider in providers"
          :key="provider.slug"
          class="group bg-white rounded-[16px] shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-200 border relative flex flex-col overflow-hidden"
          :class="[provider.enabled ? 'border-slate-200/80' : 'border-slate-200/40 opacity-70 grayscale-[30%]']"
        >
          <!-- Provider Header -->
          <div class="p-5 sm:p-6 flex-1 flex flex-col">
            <div class="flex items-start justify-between mb-4">
              <div class="flex items-start gap-4">
                <div
                  class="w-12 h-12 rounded-xl flex items-center justify-center text-2xl border shadow-sm shrink-0"
                  :style="{ backgroundColor: (provider.color || '#6366f1') + '15', borderColor: (provider.color || '#6366f1') + '30' }"
                >
                  {{ provider.icon || '🔗' }}
                </div>
                <div class="pt-0.5">
                  <div class="flex items-center gap-2">
                    <h3 class="text-[16px] font-bold text-slate-900 truncate">{{ provider.name }}</h3>
                  </div>
                  <div class="flex items-center gap-2 mt-1">
                    <span class="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase border bg-slate-50 text-slate-500 border-slate-200">
                      {{ provider.category || 'general' }}
                    </span>
                    <span
                      v-if="!provider.enabled"
                      class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase bg-slate-100 text-slate-500 border border-slate-200"
                    >
                      Disabled
                    </span>
                    <!-- Connected Microdot Status -->
                    <span
                      v-else-if="getConnection(provider).connected"
                      class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase bg-emerald-50 text-emerald-600 border border-emerald-100"
                    >
                       <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Connected
                    </span>
                    <span
                      v-else
                      class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase bg-slate-50 text-slate-500 border border-slate-200"
                    >
                       Not Connected
                    </span>
                  </div>
                </div>
              </div>

              <!-- Admin actions -->
              <div v-if="isAdmin" class="flex gap-1 shrink-0 -mr-2">
                <button
                  @click.stop="openConfigureModal(provider)"
                  class="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors flex items-center justify-center gap-1"
                  :title="provider.has_credentials ? 'Update credentials' : 'Add credentials'"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                </button>
                <button
                  @click.stop="openEditModal(provider)"
                  class="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center justify-center gap-1"
                  title="Edit provider"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                </button>
                <button
                  @click.stop="handleDeleteProvider(provider)"
                  class="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-1"
                  title="Delete provider"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
              </div>
            </div>

            <!-- Account Label (If connected) -->
            <div v-if="getConnection(provider).connected && getConnection(provider).account_label" class="mb-4">
               <span class="text-[12px] font-medium text-slate-700 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">
                 {{ getConnection(provider).account_label }}
               </span>
            </div>

            <div class="mt-auto space-y-4">
              <!-- Scopes -->
              <div v-if="getConnection(provider).connected && getConnection(provider).scopes_granted?.length">
                <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Granted Scopes</div>
                <div class="flex flex-wrap gap-1.5">
                  <span
                    v-for="scope in getConnection(provider).scopes_granted.slice(0, 4)"
                    :key="scope"
                    class="text-[11px] font-mono bg-slate-50 border border-slate-100 text-slate-600 px-2 py-1 rounded-[6px]"
                  >
                    {{ shortenScope(scope) }}
                  </span>
                  <span
                    v-if="getConnection(provider).scopes_granted.length > 4"
                    class="text-[11px] font-mono text-slate-400 px-1 py-1"
                  >
                    +{{ getConnection(provider).scopes_granted.length - 4 }}
                  </span>
                </div>
              </div>

              <!-- Scope mismatch warning -->
              <div v-if="getConnection(provider).connected && getMissingScopes(provider).length > 0" class="p-3 bg-amber-50/60 border border-amber-200/60 rounded-[10px]">
                <div class="flex items-center gap-1.5 mb-2">
                   <svg class="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                   <span class="text-[11px] text-amber-800 font-semibold tracking-wide uppercase">New scopes available</span>
                </div>
                <div class="flex flex-wrap gap-1.5 pl-5.5">
                  <span
                    v-for="scope in getMissingScopes(provider).slice(0, 3)"
                    :key="scope"
                    class="text-[10px] font-mono bg-amber-100/50 border border-amber-200/50 text-amber-800 px-1.5 py-0.5 rounded-[4px]"
                  >
                    {{ shortenScope(scope) }}
                  </span>
                  <span v-if="getMissingScopes(provider).length > 3" class="text-[10px] text-amber-600 py-0.5">
                    +{{ getMissingScopes(provider).length - 3 }} more
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Actions Footer -->
          <div class="px-5 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between mt-auto">
            <!-- Warning block on bottom left -->
            <div v-if="!provider.has_credentials" class="flex items-center gap-1.5 text-[11px] font-medium text-amber-600">
               <svg class="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
               Needs Credentials
            </div>
            <!-- Blank div if credential exists -->
            <div v-else></div>

            <!-- Right side action buttons -->
            <div class="flex items-center gap-2">
              <template v-if="getConnection(provider).connected">
                <button
                  @click="openScopePicker(provider)"
                  :disabled="actionLoading === provider.slug"
                  class="px-3 py-1.5 text-[12px] font-semibold text-blue-600 hover:bg-blue-50 rounded-[8px] transition-colors flex items-center gap-1.5"
                >
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                  Reconnect
                </button>
                <button
                  @click="handleDisconnect(provider)"
                  :disabled="actionLoading === provider.slug"
                  class="px-3 py-1.5 text-[12px] font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-[8px] transition-colors"
                >
                  {{ actionLoading === provider.slug ? '...' : 'Disconnect' }}
                </button>
              </template>
              
              <template v-else>
                <button
                  v-if="isAdmin && !provider.has_credentials"
                  @click.stop="openConfigureModal(provider)"
                  class="px-3 py-1.5 text-[12px] font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200 rounded-[8px] transition-colors"
                >
                  Add Credentials
                </button>
              
                <button
                  v-if="provider.has_credentials"
                  @click="openScopePicker(provider)"
                  :disabled="!provider.enabled || actionLoading === provider.slug"
                  :class="[
                    'px-4 py-1.5 text-[12px] font-semibold rounded-[8px] transition-all shadow-[0_1px_2px_rgba(0,0,0,0.05)]',
                    provider.enabled
                      ? 'bg-slate-900 text-white hover:bg-slate-800'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  ]"
                >
                  {{ actionLoading === provider.slug ? 'Connecting...' : 'Connect' }}
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>

      </template> <!-- end OAuth provider content -->

      <!-- ─── Provider Create/Edit Modal ─── -->
      <Teleport to="body">
        <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" @click.self="closeModal">
          <div class="bg-white rounded-[20px] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col mx-auto overflow-hidden border border-slate-200/50">
            <!-- Modal Header -->
            <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white z-10 shrink-0">
              <h2 class="text-[18px] font-bold tracking-tight text-slate-900">
                {{ editingProvider ? 'Edit Provider' : 'Add OAuth Provider' }}
              </h2>
              <button @click="closeModal" class="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-lg transition-colors">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <!-- Modal Body (Scrollable) -->
            <div class="px-6 py-6 space-y-7 overflow-y-auto flex-1">
              <!-- Presets Selector -->
              <div v-if="!editingProvider" class="p-4 bg-slate-50 border border-slate-200/60 rounded-[12px]">
                <label class="block text-[13px] font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                   <svg class="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path></svg>
                   Start from a Preset <span class="text-slate-400 font-medium normal-case">(Optional)</span>
                </label>
                <select
                  v-model="selectedPreset"
                  @change="applyPreset"
                  class="w-full bg-white border border-slate-200 rounded-[8px] px-3 py-2 text-[13px] font-medium text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all outline-none"
                >
                  <option value="">-- Start from scratch --</option>
                  <option v-for="preset in presets" :key="preset.id" :value="preset.id">
                    {{ preset.icon }} {{ preset.name }}
                  </option>
                </select>
                <p class="text-[11px] text-slate-500 mt-2 font-medium">
                  Selecting a preset auto-fills the URLs right away. You only need to provide the Client ID and Secret.
                </p>
              </div>

              <!-- Identity -->
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-[12px] font-semibold text-slate-700 mb-1.5">Name <span class="text-red-500">*</span></label>
                  <input v-model="form.name" type="text" placeholder="Google" class="w-full bg-slate-50 border border-slate-200 rounded-[8px] px-3 py-2 text-[13px] font-medium text-slate-900 focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all outline-none placeholder:text-slate-400" />
                </div>
                <div>
                  <label class="block text-[12px] font-semibold text-slate-700 mb-1.5">Slug <span class="text-red-500">*</span></label>
                  <input
                    v-model="form.slug"
                    type="text"
                    placeholder="google"
                    :disabled="!!editingProvider"
                    :class="[
                      'w-full border rounded-[8px] px-3 py-2 text-[13px] font-medium transition-all outline-none placeholder:text-slate-400',
                      editingProvider ? 'bg-slate-100 border-slate-200/60 text-slate-500 cursor-not-allowed' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900'
                    ]"
                  />
                </div>
              </div>

              <!-- OAuth Endpoints -->
              <div>
                <label class="block text-[12px] font-semibold text-slate-700 mb-1.5">Authorization URL <span class="text-red-500">*</span></label>
                <input v-model="form.authorization_url" type="url" placeholder="https://accounts.google.com/o/oauth2/v2/auth" class="w-full bg-slate-50 border border-slate-200 rounded-[8px] px-3 py-2 text-[13px] font-medium text-slate-900 focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all outline-none placeholder:text-slate-400 font-mono" />
              </div>
              <div>
                <label class="block text-[12px] font-semibold text-slate-700 mb-1.5">Token URL <span class="text-red-500">*</span></label>
                <input v-model="form.token_url" type="url" placeholder="https://oauth2.googleapis.com/token" class="w-full bg-slate-50 border border-slate-200 rounded-[8px] px-3 py-2 text-[13px] font-medium text-slate-900 focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all outline-none placeholder:text-slate-400 font-mono" />
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-[12px] font-semibold text-slate-700 mb-1.5">UserInfo URL</label>
                  <input v-model="form.userinfo_url" type="url" placeholder="https://..." class="w-full bg-slate-50 border border-slate-200 rounded-[8px] px-3 py-2 text-[13px] font-medium text-slate-900 focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all outline-none placeholder:text-slate-400 font-mono" />
                </div>
                <div>
                  <label class="block text-[12px] font-semibold text-slate-700 mb-1.5">Revocation URL</label>
                  <input v-model="form.revocation_url" type="url" placeholder="https://..." class="w-full bg-slate-50 border border-slate-200 rounded-[8px] px-3 py-2 text-[13px] font-medium text-slate-900 focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all outline-none placeholder:text-slate-400 font-mono" />
                </div>
              </div>

              <!-- Client Credentials -->
              <div class="bg-slate-50 border border-slate-200/60 rounded-[12px] p-5">
                <div class="flex items-center gap-2 mb-4">
                  <div class="w-6 h-6 rounded-md bg-white border border-slate-200 shadow-sm flex items-center justify-center shrink-0">
                    <svg class="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                  </div>
                  <h3 class="text-[13px] font-bold text-slate-800">Client Credentials</h3>
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-[10px] font-bold tracking-wider uppercase text-slate-500 mb-1.5">Client ID</label>
                    <input v-model="form.client_id" type="text" :placeholder="editingProvider ? '(unchanged)' : 'your-client-id'" class="w-full bg-white border border-slate-200 rounded-[8px] px-3 py-2 text-[13px] font-medium text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all outline-none placeholder:text-slate-400" />
                  </div>
                  <div>
                    <label class="block text-[10px] font-bold tracking-wider uppercase text-slate-500 mb-1.5">Client Secret</label>
                    <input v-model="form.client_secret" type="password" :placeholder="editingProvider ? '(unchanged)' : 'your-client-secret'" class="w-full bg-white border border-slate-200 rounded-[8px] px-3 py-2 text-[13px] font-medium text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all outline-none placeholder:text-slate-400" />
                  </div>
                </div>
                <p class="text-[11px] text-slate-500 mt-2.5 font-medium flex items-center gap-1.5">
                  <svg class="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  {{ editingProvider ? 'Leave blank to keep existing credentials.' : 'Provider will be auto-enabled when credentials are set.' }}
                </p>
              </div>

              <!-- UI & Metadata -->
              <div class="grid grid-cols-3 gap-4">
                <div>
                  <label class="block text-[12px] font-semibold text-slate-700 mb-1.5">Icon</label>
                  <input v-model="form.icon" type="text" placeholder="🔗" class="w-full bg-slate-50 border border-slate-200 rounded-[8px] px-3 py-2 text-[16px] text-center font-medium text-slate-900 focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all outline-none" />
                </div>
                <div>
                  <label class="block text-[12px] font-semibold text-slate-700 mb-1.5">Color</label>
                  <div class="flex items-center gap-2">
                    <input v-model="form.color" type="color" class="w-9 h-9 rounded-md cursor-pointer border-0 p-0 shrink-0" />
                    <input v-model="form.color" type="text" placeholder="#6366f1" class="w-full bg-slate-50 border border-slate-200 rounded-[8px] px-2.5 py-2 text-[13px] font-mono text-slate-600 focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all outline-none" />
                  </div>
                </div>
                <div>
                  <label class="block text-[12px] font-semibold text-slate-700 mb-1.5">Category</label>
                  <select v-model="form.category" class="w-full bg-slate-50 border border-slate-200 rounded-[8px] px-3 py-2 text-[13px] font-medium text-slate-900 focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all outline-none">
                    <option value="general">General</option>
                    <option value="productivity">Productivity</option>
                    <option value="social">Social</option>
                    <option value="developer">Developer</option>
                    <option value="cloud">Cloud</option>
                  </select>
                </div>
              </div>

              <!-- Available Scopes Builder -->
              <div>
                <div class="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
                  <label class="block text-[13px] font-bold text-slate-800">Available Scopes</label>
                  <button
                    @click="addScopeRow"
                    class="text-[12px] px-2.5 py-1.5 bg-slate-100 text-slate-600 hover:text-slate-900 rounded-[8px] hover:bg-slate-200 transition-colors font-semibold flex items-center gap-1.5"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                    Add Scope
                  </button>
                </div>

                <div v-if="availableScopes.length === 0" class="text-[12px] text-slate-400 font-medium py-6 text-center border border-dashed border-slate-200/80 bg-slate-50/50 rounded-xl">
                  No scopes defined. Click "+ Add Scope" to add one.
                </div>

                <div v-else class="space-y-2.5">
                  <!-- Header -->
                  <div class="grid grid-cols-12 gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2">
                    <div class="col-span-1 text-center">Def</div>
                    <div class="col-span-4">Scope URL</div>
                    <div class="col-span-3">Label</div>
                    <div class="col-span-3">Risk</div>
                    <div class="col-span-1"></div>
                  </div>

                  <!-- Scope Rows -->
                  <div
                    v-for="(s, idx) in availableScopes"
                    :key="idx"
                    class="grid grid-cols-12 gap-2 items-center bg-white border border-slate-200 rounded-[8px] p-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                  >
                    <div class="col-span-1 flex justify-center">
                      <input
                        type="checkbox"
                        :checked="defaultScopeSet.has(s.scope)"
                        @change="toggleDefaultScope(s.scope)"
                        class="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                        title="Include by default"
                      />
                    </div>
                    <div class="col-span-4">
                      <input
                        v-model="s.scope"
                        type="text"
                        placeholder="gmail.readonly"
                        class="w-full bg-slate-50 border border-slate-100 rounded-[6px] px-2 py-1.5 text-[11px] font-mono text-slate-600 focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all placeholder:font-sans"
                      />
                    </div>
                    <div class="col-span-3">
                      <input
                        v-model="s.label"
                        type="text"
                        placeholder="Read-only"
                        class="w-full bg-slate-50 border border-slate-100 rounded-[6px] px-2 py-1.5 text-[12px] font-medium text-slate-900 focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all"
                      />
                    </div>
                    <div class="col-span-3">
                      <select v-model="s.risk" class="w-full bg-slate-50 border border-slate-100 rounded-[6px] px-2 py-1.5 text-[12px] font-medium text-slate-700 focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all">
                        <option value="read">🟢 Read</option>
                        <option value="write">🟡 Write</option>
                        <option value="admin">🔴 Admin</option>
                      </select>
                    </div>
                    <div class="col-span-1 flex justify-center">
                      <button
                        @click="removeScopeRow(idx)"
                        class="text-slate-400 hover:text-red-500 p-1.5 rounded-md hover:bg-red-50 transition-colors"
                        title="Remove Scope"
                      >
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Extra Auth Params -->
              <div>
                <label class="block text-[12px] font-semibold text-slate-700 mb-1.5">Extra Auth Params <span class="text-slate-400 font-medium">(JSON)</span></label>
                <input v-model="extraParamsInput" type="text" placeholder='{"access_type": "offline", "prompt": "consent"}' class="w-full bg-slate-50 border border-slate-200 rounded-[8px] px-3 py-2 text-[13px] font-medium text-slate-900 focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all outline-none font-mono placeholder:font-sans" />
              </div>

              <!-- Resource Discovery -->
              <div class="p-4 rounded-[12px] bg-slate-50 border border-slate-200/60 mt-6">
                <div class="flex items-center gap-1.5 mb-3">
                   <svg class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
                   <h3 class="text-[12px] font-bold tracking-wide uppercase text-slate-500">Resource Discovery <span class="text-slate-400 font-medium normal-case">(Optional)</span></h3>
                </div>
                <div class="grid grid-cols-1 gap-4">
                  <div>
                    <label class="block text-[12px] font-semibold text-slate-700 mb-1.5">Resource URL</label>
                    <input v-model="form.resource_url" type="text" placeholder="https://api.atlassian.com/oauth/token/accessible-resources" class="w-full bg-slate-50 border border-slate-200 rounded-[8px] px-3 py-2 text-[13px] font-medium text-slate-900 focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all outline-none font-mono placeholder:font-sans" />
                    <p class="text-[10px] text-slate-400 mt-1.5 font-medium">Called after OAuth to discover tenant/instance info (e.g. cloudId)</p>
                  </div>
                  <div>
                    <label class="block text-[12px] font-semibold text-slate-700 mb-1.5">API Base Template</label>
                    <input v-model="form.api_base_template" type="text" placeholder="https://api.atlassian.com/ex/jira/{cloud_id}" class="w-full bg-slate-50 border border-slate-200 rounded-[8px] px-3 py-2 text-[13px] font-medium text-slate-900 focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all outline-none font-mono placeholder:font-sans" />
                    <p class="text-[10px] text-slate-400 mt-1.5 font-medium">URL template with <code class="bg-slate-100 px-1 py-0.5 rounded text-slate-500">{placeholders}</code> resolved from discovery response</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Modal Footer -->
            <div class="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 mt-auto shrink-0">
               <button @click="closeModal" class="px-5 py-2.5 text-[13px] font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-[10px] transition-colors">
                 Cancel
               </button>
               <button
                 @click="handleSaveProvider"
                 :disabled="saving"
                 class="px-6 py-2.5 text-[13px] font-semibold bg-slate-900 text-white rounded-[10px] hover:bg-slate-800 transition-all shadow-[0_2px_4px_rgba(0,0,0,0.1)] disabled:opacity-50 flex items-center gap-2"
               >
                 {{ saving ? 'Saving...' : (editingProvider ? 'Update Provider' : 'Create Provider') }}
               </button>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- ─── Scope Picker Modal (Connect flow) ─── -->
      <Teleport to="body">
        <div v-if="showScopePicker" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="closeScopePicker">
          <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4">
            <!-- Header -->
            <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div class="flex items-center gap-3">
                <div
                  class="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                  :style="{ backgroundColor: (scopePickerProvider?.color || '#6366f1') + '15' }"
                >
                  {{ scopePickerProvider?.icon || '🔗' }}
                </div>
                <h2 class="text-lg font-bold text-gray-900">Connect to {{ scopePickerProvider?.name }}</h2>
              </div>
              <button @click="closeScopePicker" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            <!-- Body: Scope checkboxes -->
            <div class="px-6 py-5">
              <p class="text-sm text-gray-600 mb-4">Select the permissions you want to grant:</p>

              <div v-if="pickerScopes.length === 0" class="text-sm text-gray-400 italic">
                No scopes configured — all default permissions will be requested.
              </div>

              <div v-else class="space-y-2 max-h-64 overflow-y-auto">
                <label
                  v-for="s in pickerScopes"
                  :key="s.scope"
                  class="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition"
                >
                  <input
                    type="checkbox"
                    v-model="s.selected"
                    class="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-medium text-gray-900">{{ s.label || s.scope }}</span>
                      <span
                        class="text-xs px-1.5 py-0.5 rounded-full"
                        :class="s.risk === 'admin' ? 'bg-red-100 text-red-700'
                          : s.risk === 'write' ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'"
                      >
                        {{ s.risk === 'admin' ? '🔴 Admin' : s.risk === 'write' ? '🟡 Write' : '🟢 Read' }}
                      </span>
                    </div>
                    <div class="text-xs text-gray-400 mt-0.5 font-mono">{{ s.scope }}</div>
                  </div>
                </label>
              </div>
            </div>

            <!-- Footer -->
            <div class="flex justify-between items-center px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button
                v-if="pickerScopes.length > 0"
                @click="toggleAllPickerScopes"
                class="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                {{ allPickerSelected ? 'Deselect All' : 'Select All' }}
              </button>
              <div v-else></div>
              <div class="flex gap-3">
                <button @click="closeScopePicker" class="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition">
                  Cancel
                </button>
                <button
                  @click="confirmConnect"
                  class="px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Connect
                </button>
              </div>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- ─── Configure Credentials Modal ─── -->
      <Teleport to="body">
        <div v-if="showConfigureModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="closeConfigureModal">
          <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <!-- Header -->
            <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div class="flex items-center gap-3">
                <div
                  class="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                  :style="{ backgroundColor: (configureProvider?.color || '#6366f1') + '15' }"
                >
                  {{ configureProvider?.icon || '🔗' }}
                </div>
                <div>
                  <h2 class="text-lg font-bold text-gray-900">Configure {{ configureProvider?.name }}</h2>
                  <p class="text-xs text-gray-500">Add OAuth client credentials</p>
                </div>
              </div>
              <button @click="closeConfigureModal" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            <!-- Body -->
            <div class="px-6 py-5 space-y-4">
              <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                <strong>🔒 Encrypted:</strong> Credentials are encrypted at rest and never exposed via API.
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Client ID *</label>
                <input
                  v-model="configureForm.client_id"
                  type="text"
                  placeholder="your-client-id.apps.googleusercontent.com"
                  class="form-input"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Client Secret *</label>
                <input
                  v-model="configureForm.client_secret"
                  type="password"
                  placeholder="GOCSPX-xxxxx"
                  class="form-input"
                />
              </div>
            </div>

            <!-- Footer -->
            <div class="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button @click="closeConfigureModal" class="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition">
                Cancel
              </button>
              <button
                @click="handleConfigure"
                :disabled="savingConfigure || !configureForm.client_id || !configureForm.client_secret"
                class="px-5 py-2 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition disabled:opacity-50"
              >
                {{ savingConfigure ? 'Saving...' : 'Save Credentials' }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- Toast -->
      <Teleport to="body">
        <div
          v-if="toast.show"
          class="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium transition-all duration-300"
          :class="toast.success ? 'bg-green-600' : 'bg-red-600'"
        >
          {{ toast.message }}
        </div>
      </Teleport>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import api from '../services/api'
import CredentialManager from '../components/tools/CredentialManager.vue'

export default {
  name: 'Connections',
  components: { CredentialManager },
  setup() {
    const providers = ref([])
    const orgData = ref(null)
    const loading = ref(false)
    const activeTab = ref('personal')
    const actionLoading = ref(null)
    const toast = ref({ show: false, success: true, message: '' })
    const isAdmin = ref(false)

    // Modal state
    const presets = ref([])
    const selectedPreset = ref('')
    const showModal = ref(false)
    const editingProvider = ref(null)
    const saving = ref(false)
    const form = ref(emptyForm())
    const availableScopes = ref([])       // [{scope, label, risk}]
    const defaultScopeSet = ref(new Set()) // scope strings that are defaults
    const extraParamsInput = ref('')

    // Scope picker state (connect flow)
    const showScopePicker = ref(false)
    const scopePickerProvider = ref(null)
    const pickerScopes = ref([])           // [{scope, label, risk, selected}]

    // Configure credentials modal state
    const showConfigureModal = ref(false)
    const configureProvider = ref(null)
    const configureForm = ref({ client_id: '', client_secret: '' })
    const savingConfigure = ref(false)

    function emptyForm() {
      return {
        name: '', slug: '',
        authorization_url: '', token_url: '',
        userinfo_url: '', revocation_url: '',
        client_id: '', client_secret: '',
        icon: '🔗', color: '#6366f1', category: 'general',
        resource_url: '', api_base_template: '',
      }
    }

    // ── Computed ──
    const personalConnectedCount = computed(() =>
      providers.value.filter(p => p.personal?.connected).length
    )
    const orgConnectedCount = computed(() =>
      providers.value.filter(p => p.organization?.connected).length
    )
    const allPickerSelected = computed(() =>
      pickerScopes.value.length > 0 && pickerScopes.value.every(s => s.selected)
    )

    // ── Helpers ──
    const getConnection = (provider) => {
      if (activeTab.value === 'organization' && provider.organization) {
        return provider.organization
      }
      return provider.personal || { connected: false }
    }

    const shortenScope = (scope) => {
      const parts = scope.split('/')
      return parts[parts.length - 1] || scope
    }

    const getMissingScopes = (provider) => {
      const conn = getConnection(provider)
      if (!conn.connected) return []
      const granted = new Set(conn.scopes_granted || [])
      const allAvailable = (provider.available_scopes || []).map(s => s.scope || s)
      return allAvailable.filter(s => !granted.has(s))
    }

    const showToast = (success, message) => {
      toast.value = { show: true, success, message }
      setTimeout(() => { toast.value.show = false }, 3000)
    }

    // ── Data ──
    const loadProviders = async () => {
      loading.value = true
      try {
        const response = await api.getConnectionProviders()
        providers.value = response.data || []
        const withOrg = providers.value.find(p => p.organization)
        if (withOrg) {
          orgData.value = { name: withOrg.organization.name }
        }
      } catch (error) {
        console.error('Failed to load providers:', error)
        showToast(false, 'Failed to load providers')
      } finally {
        loading.value = false
      }
    }

    const checkAdmin = async () => {
      try {
        const resp = await api.checkAuth()
        const user = resp.data?.user
        isAdmin.value = user?.is_staff || user?.is_org_admin || false
      } catch { isAdmin.value = false }
    }

    const loadPresets = async () => {
      try {
        const response = await api.getConnectionPresets()
        presets.value = response.data || []
      } catch (error) {
        console.error('Failed to load presets:', error)
      }
    }

    const applyPreset = () => {
      if (!selectedPreset.value) return
      const preset = presets.value.find(p => p.id === selectedPreset.value)
      if (!preset) return

      form.value = {
        name: preset.name,
        slug: preset.slug,
        authorization_url: preset.authorization_url,
        token_url: preset.token_url,
        userinfo_url: preset.userinfo_url,
        revocation_url: preset.revocation_url,
        client_id: '',
        client_secret: '',
        icon: preset.icon,
        color: preset.color,
        category: preset.category,
        resource_url: '',
        api_base_template: ''
      }

      if (preset.extra_auth_params && Object.keys(preset.extra_auth_params).length > 0) {
        extraParamsInput.value = JSON.stringify(preset.extra_auth_params, null, 2)
      } else {
        extraParamsInput.value = ''
      }

      availableScopes.value = preset.scopes.map(s => ({
        scope: s.id,
        label: s.label,
        risk: s.risk
      }))
      
      defaultScopeSet.value = new Set(
        preset.scopes.filter(s => s.default).map(s => s.id)
      )
    }

    // ── Scope Builder (admin modal) ──
    const addScopeRow = () => {
      availableScopes.value.push({ scope: '', label: '', risk: 'read' })
    }

    const removeScopeRow = (idx) => {
      const removed = availableScopes.value.splice(idx, 1)
      if (removed[0]) defaultScopeSet.value.delete(removed[0].scope)
    }

    const toggleDefaultScope = (scope) => {
      if (defaultScopeSet.value.has(scope)) {
        defaultScopeSet.value.delete(scope)
      } else {
        defaultScopeSet.value.add(scope)
      }
      // trigger reactivity
      defaultScopeSet.value = new Set(defaultScopeSet.value)
    }

    // ── Scope Picker (connect flow) ──
    const openScopePicker = (provider) => {
      scopePickerProvider.value = provider
      const avail = provider.available_scopes || []
      const defaults = new Set(provider.default_scopes || [])

      if (avail.length === 0) {
        // No defined scopes, just connect directly with defaults
        handleConnect(provider, provider.default_scopes || [])
        return
      }

      pickerScopes.value = avail.map(s => ({
        scope: s.scope || s,
        label: s.label || s.scope || s,
        risk: s.risk || 'read',
        selected: defaults.has(s.scope || s),
      }))
      showScopePicker.value = true
    }

    const closeScopePicker = () => {
      showScopePicker.value = false
      scopePickerProvider.value = null
    }

    const toggleAllPickerScopes = () => {
      const allSelected = allPickerSelected.value
      pickerScopes.value.forEach(s => { s.selected = !allSelected })
    }

    const confirmConnect = () => {
      const selected = pickerScopes.value.filter(s => s.selected).map(s => s.scope)
      const provider = scopePickerProvider.value
      closeScopePicker()
      handleConnect(provider, selected)
    }

    // ── Provider Create/Edit Modal ──
    const openCreateModal = () => {
      editingProvider.value = null
      selectedPreset.value = ''
      form.value = emptyForm()
      availableScopes.value = []
      defaultScopeSet.value = new Set()
      extraParamsInput.value = ''
      showModal.value = true
    }

    const openEditModal = (provider) => {
      editingProvider.value = provider
      form.value = {
        name: provider.name,
        slug: provider.slug,
        authorization_url: provider.authorization_url || '',
        token_url: provider.token_url || '',
        userinfo_url: provider.userinfo_url || '',
        revocation_url: provider.revocation_url || '',
        client_id: '',
        client_secret: '',
        icon: provider.icon || '🔗',
        color: provider.color || '#6366f1',
        category: provider.category || 'general',
        resource_url: provider.resource_url || '',
        api_base_template: provider.api_base_template || '',
      }
      // Load available_scopes into builder
      const avail = provider.available_scopes || []
      availableScopes.value = avail.map(s => ({
        scope: typeof s === 'string' ? s : (s.scope || ''),
        label: typeof s === 'string' ? '' : (s.label || ''),
        risk: typeof s === 'string' ? 'read' : (s.risk || 'read'),
      }))
      defaultScopeSet.value = new Set(provider.default_scopes || [])
      extraParamsInput.value = provider.extra_auth_params ? JSON.stringify(provider.extra_auth_params) : ''
      showModal.value = true
    }

    const closeModal = () => {
      showModal.value = false
      editingProvider.value = null
    }

    // ── Configure Credentials Modal ──
    const openConfigureModal = (provider) => {
      configureProvider.value = provider
      configureForm.value = { client_id: '', client_secret: '' }
      showConfigureModal.value = true
    }

    const closeConfigureModal = () => {
      showConfigureModal.value = false
      configureProvider.value = null
    }

    const handleConfigure = async () => {
      if (!configureForm.value.client_id || !configureForm.value.client_secret) return
      savingConfigure.value = true
      try {
        await api.configureProvider(configureProvider.value.slug, configureForm.value)
        showToast(true, `Credentials saved for ${configureProvider.value.name} — provider enabled!`)
        closeConfigureModal()
        await loadProviders()
      } catch (error) {
        showToast(false, error.response?.data?.error || 'Failed to save credentials')
      } finally {
        savingConfigure.value = false
      }
    }

    const handleSaveProvider = async () => {
      const f = form.value
      if (!f.name || !f.authorization_url || !f.token_url) {
        showToast(false, 'Name, Authorization URL, and Token URL are required')
        return
      }
      if (!editingProvider.value && !f.slug) {
        showToast(false, 'Slug is required')
        return
      }

      saving.value = true
      try {
        // Build available_scopes array (structured)
        const available_scopes = availableScopes.value
          .filter(s => s.scope.trim())
          .map(s => ({ scope: s.scope.trim(), label: s.label.trim(), risk: s.risk }))

        // Build default_scopes from checkboxes
        const validScopeStrings = new Set(available_scopes.map(s => s.scope))
        const default_scopes = [...defaultScopeSet.value].filter(s => validScopeStrings.has(s))

        let extra_auth_params = {}
        if (extraParamsInput.value.trim()) {
          try {
            extra_auth_params = JSON.parse(extraParamsInput.value)
          } catch {
            showToast(false, 'Invalid JSON in Extra Auth Params')
            saving.value = false
            return
          }
        }

        const payload = {
          name: f.name,
          authorization_url: f.authorization_url,
          token_url: f.token_url,
          userinfo_url: f.userinfo_url,
          revocation_url: f.revocation_url,
          icon: f.icon,
          color: f.color,
          category: f.category,
          default_scopes,
          available_scopes,
          extra_auth_params,
          resource_url: f.resource_url || '',
          api_base_template: f.api_base_template || '',
        }

        if (f.client_id && f.client_secret) {
          payload.client_id = f.client_id
          payload.client_secret = f.client_secret
        }

        if (editingProvider.value) {
          await api.updateProvider(editingProvider.value.slug, payload)
          showToast(true, `Updated ${f.name}`)
        } else {
          payload.slug = f.slug
          await api.createProvider(payload)
          showToast(true, `Created ${f.name}`)
        }

        closeModal()
        await loadProviders()
      } catch (error) {
        console.error('Save provider failed:', error)
        showToast(false, error.response?.data?.error || 'Failed to save provider')
      } finally {
        saving.value = false
      }
    }

    const handleDeleteProvider = async (provider) => {
      if (!confirm(`Delete "${provider.name}"? All connections to this provider will be removed.`)) return

      actionLoading.value = provider.slug
      try {
        await api.deleteProvider(provider.slug)
        showToast(true, `Deleted ${provider.name}`)
        await loadProviders()
      } catch (error) {
        showToast(false, error.response?.data?.error || 'Failed to delete')
      } finally {
        actionLoading.value = null
      }
    }

    // ── Connect / Disconnect ──
    const handleConnect = async (provider, selectedScopes = []) => {
      actionLoading.value = provider.slug
      try {
        const opts = {}
        if (activeTab.value === 'organization') opts.owner = 'org'
        if (selectedScopes.length > 0) opts.scopes = selectedScopes.join(',')

        const response = await api.startConnection(provider.slug, opts)
        const redirectUrl = response.data?.redirect_url
        if (!redirectUrl) {
          showToast(false, 'No redirect URL received')
          actionLoading.value = null
          return
        }

        const popup = window.open(redirectUrl, 'oauth-connection', 'width=600,height=700,left=200,top=100')
        if (!popup) {
          showToast(false, 'Popup blocked — please allow popups for this site')
          actionLoading.value = null
          return
        }

        let settled = false
        const cleanup = () => {
          if (settled) return
          settled = true
          window.removeEventListener('message', onMessage)
          clearInterval(popupPoll)
          clearTimeout(timeout)
          actionLoading.value = null
        }

        const onMessage = (event) => {
          if (event.data?.type === 'oauth-connection-result') {
            if (event.data.status === 'success') {
              showToast(true, `Connected to ${provider.name}!`)
              loadProviders()
            } else {
              showToast(false, event.data.error || 'Connection failed')
            }
            cleanup()
          }
        }
        window.addEventListener('message', onMessage)

        // Poll for popup closed (user closed window without completing)
        const popupPoll = setInterval(() => {
          if (popup.closed) {
            if (!settled) {
              showToast(false, 'Connection window was closed')
            }
            cleanup()
          }
        }, 500)

        // Hard timeout fallback (2 min)
        const timeout = setTimeout(() => {
          cleanup()
        }, 120000)
      } catch (error) {
        showToast(false, error.response?.data?.error || 'Failed to start connection')
        actionLoading.value = null
      }
    }

    const handleDisconnect = async (provider) => {
      if (!confirm(`Disconnect from ${provider.name}? Agents using this connection will lose access.`)) return

      actionLoading.value = provider.slug
      try {
        const opts = {}
        if (activeTab.value === 'organization') opts.owner = 'org'
        await api.disconnectConnection(provider.slug, opts)
        showToast(true, `Disconnected from ${provider.name}`)
        await loadProviders()
      } catch (error) {
        showToast(false, error.response?.data?.error || 'Failed to disconnect')
      } finally {
        actionLoading.value = null
      }
    }

    onMounted(() => {
      checkAdmin()
      loadProviders()
      loadPresets()
    })

    return {
      providers, orgData, loading, activeTab, actionLoading, toast, isAdmin,
      presets, selectedPreset, applyPreset,
      showModal, editingProvider, saving, form, availableScopes, defaultScopeSet, extraParamsInput,
      showScopePicker, scopePickerProvider, pickerScopes, allPickerSelected,
      showConfigureModal, configureProvider, configureForm, savingConfigure,
      personalConnectedCount, orgConnectedCount,
      getConnection, shortenScope, getMissingScopes,
      addScopeRow, removeScopeRow, toggleDefaultScope,
      openScopePicker, closeScopePicker, toggleAllPickerScopes, confirmConnect,
      openCreateModal, openEditModal, closeModal, handleSaveProvider, handleDeleteProvider,
      openConfigureModal, closeConfigureModal, handleConfigure,
      handleConnect, handleDisconnect,
    }
  }
}
</script>

<style scoped>
.connections-container {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.form-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}
</style>
