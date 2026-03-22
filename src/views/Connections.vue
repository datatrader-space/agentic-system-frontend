<template>
  <div class="connections-container p-6 bg-gray-50 min-h-screen">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">🔗 Connections</h1>
          <p class="text-gray-600 mt-1">Connect your accounts — agents will use them automatically</p>
        </div>
        <div class="flex items-center gap-3">
          <router-link
            to="/docs/connections"
            class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium flex items-center gap-2 text-sm"
          >
            📖 Provider Docs
          </router-link>
          <button
            v-if="isAdmin"
            @click="openCreateModal"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium flex items-center gap-2 text-sm"
          >
            <span class="text-lg">+</span>
            Add Provider
          </button>
          <button
            @click="activeTab = 'personal'"
            :class="['px-4 py-2 rounded-lg text-sm font-medium transition',
              activeTab === 'personal'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200']"
          >
            👤 Personal
          </button>
          <button
            v-if="orgData"
            @click="activeTab = 'organization'"
            :class="['px-4 py-2 rounded-lg text-sm font-medium transition',
              activeTab === 'organization'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200']"
          >
            🏢 {{ orgData.name || 'Organization' }}
          </button>
          <button
            @click="activeTab = 'credentials'"
            :class="['px-4 py-2 rounded-lg text-sm font-medium transition',
              activeTab === 'credentials'
                ? 'bg-amber-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200']"
          >
            🔑 Credentials
          </button>
        </div>
      </div>
      <!-- Credentials Tab Content -->
      <div v-if="activeTab === 'credentials'" class="bg-white rounded-xl shadow-sm border border-gray-100" style="min-height: 500px;">
        <CredentialManager />
      </div>

      <!-- OAuth Provider Content (shown for personal/organization tabs) -->
      <template v-else>

      <!-- Stats -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="bg-white p-4 rounded-lg shadow">
          <div class="text-sm text-gray-600">Available Providers</div>
          <div class="text-2xl font-bold text-gray-900">{{ providers.length }}</div>
        </div>
        <div class="bg-white p-4 rounded-lg shadow">
          <div class="text-sm text-gray-600">Personal Connections</div>
          <div class="text-2xl font-bold text-green-600">{{ personalConnectedCount }}</div>
        </div>
        <div class="bg-white p-4 rounded-lg shadow" v-if="orgData">
          <div class="text-sm text-gray-600">Org Connections</div>
          <div class="text-2xl font-bold text-purple-600">{{ orgConnectedCount }}</div>
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
          class="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100 overflow-hidden"
        >
          <!-- Provider Header -->
          <div class="p-5">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                  :style="{ backgroundColor: (provider.color || '#6366f1') + '15' }"
                >
                  {{ provider.icon || '🔗' }}
                </div>
                <div>
                  <h3 class="font-semibold text-gray-900">{{ provider.name }}</h3>
                  <span
                    class="text-xs px-2 py-0.5 rounded-full"
                    :class="provider.category === 'productivity'
                      ? 'bg-blue-100 text-blue-700'
                      : provider.category === 'social'
                        ? 'bg-pink-100 text-pink-700'
                        : provider.category === 'developer'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'"
                  >
                    {{ provider.category || 'general' }}
                  </span>
                </div>
              </div>
              <!-- Admin actions -->
              <div v-if="isAdmin" class="flex gap-1">
                <button
                  @click.stop="openConfigureModal(provider)"
                  class="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition"
                  :title="provider.has_credentials ? 'Update credentials' : 'Add credentials'"
                >
                  ⚙️
                </button>
                <button
                  @click.stop="openEditModal(provider)"
                  class="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                  title="Edit provider"
                >
                  ✏️
                </button>
                <button
                  @click.stop="handleDeleteProvider(provider)"
                  class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                  title="Delete provider"
                >
                  🗑️
                </button>
              </div>
            </div>

            <!-- Enabled/disabled badge -->
            <div v-if="!provider.enabled" class="flex items-center gap-2 mb-3">
              <span class="w-2 h-2 rounded-full bg-yellow-400"></span>
              <span class="text-sm text-yellow-700 font-medium">Disabled</span>
            </div>

            <!-- Connection Status -->
            <div v-else-if="getConnection(provider).connected" class="flex items-center gap-2 mb-3">
              <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span class="text-sm text-green-700 font-medium">Connected</span>
              <span v-if="getConnection(provider).account_label" class="text-sm text-gray-500">
                — {{ getConnection(provider).account_label }}
              </span>
            </div>
            <div v-else class="flex items-center gap-2 mb-3">
              <span class="w-2 h-2 rounded-full bg-gray-300"></span>
              <span class="text-sm text-gray-500">Not connected</span>
            </div>

            <!-- Scopes -->
            <div v-if="getConnection(provider).connected && getConnection(provider).scopes_granted?.length" class="mb-3">
              <div class="text-xs text-gray-500 mb-1">Granted Scopes</div>
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="scope in getConnection(provider).scopes_granted.slice(0, 3)"
                  :key="scope"
                  class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
                >
                  {{ shortenScope(scope) }}
                </span>
                <span
                  v-if="getConnection(provider).scopes_granted.length > 3"
                  class="text-xs text-gray-400"
                >
                  +{{ getConnection(provider).scopes_granted.length - 3 }} more
                </span>
              </div>
            </div>

            <!-- Scope mismatch warning -->
            <div v-if="getConnection(provider).connected && getMissingScopes(provider).length > 0" class="mb-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
              <div class="text-xs text-amber-700 font-medium mb-1">⚠️ New scopes available — reconnect to enable:</div>
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="scope in getMissingScopes(provider).slice(0, 3)"
                  :key="scope"
                  class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded"
                >
                  {{ shortenScope(scope) }}
                </span>
                <span v-if="getMissingScopes(provider).length > 3" class="text-xs text-amber-500">
                  +{{ getMissingScopes(provider).length - 3 }} more
                </span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
            <div v-if="!provider.has_credentials" class="flex items-center justify-between mb-3">
              <div class="text-xs text-amber-600 flex items-center gap-1">
                ⚠️ Needs credentials
              </div>
              <button
                v-if="isAdmin"
                @click.stop="openConfigureModal(provider)"
                class="text-xs px-3 py-1 bg-amber-100 text-amber-700 hover:bg-amber-200 rounded-lg font-medium transition"
              >
                ⚙️ Add Credentials
              </button>
            </div>
            <div v-else></div>

            <div class="flex gap-2">
              <template v-if="getConnection(provider).connected">
                <button
                  @click="openScopePicker(provider)"
                  :disabled="actionLoading === provider.slug"
                  class="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition font-medium"
                >
                  🔄 Reconnect
                </button>
                <button
                  @click="handleDisconnect(provider)"
                  :disabled="actionLoading === provider.slug"
                  class="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition font-medium"
                >
                  {{ actionLoading === provider.slug ? '...' : 'Disconnect' }}
                </button>
              </template>
              <button
                v-else
                @click="openScopePicker(provider)"
                :disabled="!provider.has_credentials || !provider.enabled || actionLoading === provider.slug"
                :class="[
                  'px-4 py-1.5 text-sm rounded-lg transition font-medium',
                  provider.has_credentials && provider.enabled
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                ]"
              >
                {{ actionLoading === provider.slug ? 'Connecting...' : 'Connect' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      </template> <!-- end OAuth provider content -->

      <!-- ─── Provider Create/Edit Modal ─── -->
      <Teleport to="body">
        <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="closeModal">
          <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
            <!-- Modal Header -->
            <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 class="text-lg font-bold text-gray-900">
                {{ editingProvider ? 'Edit Provider' : 'Add OAuth Provider' }}
              </h2>
              <button @click="closeModal" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            <!-- Modal Body -->
            <div class="px-6 py-5 space-y-5">
              <!-- Presets Selector -->
              <div v-if="!editingProvider" class="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                <label class="block text-sm font-semibold text-blue-900 mb-2">✨ Start from a Preset (Optional)</label>
                <select
                  v-model="selectedPreset"
                  @change="applyPreset"
                  class="w-full form-input bg-white border-blue-200 focus:border-blue-500 focus:ring-blue-500 text-sm"
                >
                  <option value="">-- Start from scratch --</option>
                  <option v-for="preset in presets" :key="preset.id" :value="preset.id">
                    {{ preset.icon }} {{ preset.name }}
                  </option>
                </select>
                <p class="text-xs text-blue-700 mt-2">
                  Selecting a preset auto-fills the URLs and recommended scopes. You'll only need to provide the Client ID and Secret.
                </p>
              </div>

              <!-- Identity -->
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input v-model="form.name" type="text" placeholder="Google" class="form-input" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
                  <input
                    v-model="form.slug"
                    type="text"
                    placeholder="google"
                    :disabled="!!editingProvider"
                    :class="['form-input', editingProvider ? 'bg-gray-100 cursor-not-allowed' : '']"
                  />
                </div>
              </div>

              <!-- OAuth Endpoints -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Authorization URL *</label>
                <input v-model="form.authorization_url" type="url" placeholder="https://accounts.google.com/o/oauth2/v2/auth" class="form-input" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Token URL *</label>
                <input v-model="form.token_url" type="url" placeholder="https://oauth2.googleapis.com/token" class="form-input" />
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">UserInfo URL</label>
                  <input v-model="form.userinfo_url" type="url" placeholder="https://..." class="form-input" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Revocation URL</label>
                  <input v-model="form.revocation_url" type="url" placeholder="https://..." class="form-input" />
                </div>
              </div>

              <!-- Client Credentials -->
              <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 class="text-sm font-semibold text-blue-800 mb-3">🔐 Client Credentials</h3>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs font-medium text-blue-700 mb-1">Client ID</label>
                    <input v-model="form.client_id" type="text" :placeholder="editingProvider ? '(unchanged)' : 'your-client-id'" class="form-input text-sm" />
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-blue-700 mb-1">Client Secret</label>
                    <input v-model="form.client_secret" type="password" :placeholder="editingProvider ? '(unchanged)' : 'your-client-secret'" class="form-input text-sm" />
                  </div>
                </div>
                <p class="text-xs text-blue-600 mt-2">
                  {{ editingProvider ? 'Leave blank to keep existing credentials.' : 'Provider will be auto-enabled when credentials are set.' }}
                </p>
              </div>

              <!-- UI & Metadata -->
              <div class="grid grid-cols-3 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                  <input v-model="form.icon" type="text" placeholder="🔗" class="form-input text-center text-xl" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Color</label>
                  <div class="flex items-center gap-2">
                    <input v-model="form.color" type="color" class="w-10 h-10 rounded cursor-pointer border-0" />
                    <input v-model="form.color" type="text" placeholder="#6366f1" class="form-input flex-1" />
                  </div>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select v-model="form.category" class="form-input">
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
                <div class="flex items-center justify-between mb-2">
                  <label class="block text-sm font-medium text-gray-700">Available Scopes</label>
                  <button
                    @click="addScopeRow"
                    class="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition font-medium"
                  >
                    + Add Scope
                  </button>
                </div>

                <div v-if="availableScopes.length === 0" class="text-sm text-gray-400 italic py-2">
                  No scopes defined. Click "+ Add Scope" to add one.
                </div>

                <div v-else class="space-y-2">
                  <!-- Header -->
                  <div class="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
                    <div class="col-span-1">Default</div>
                    <div class="col-span-4">Scope</div>
                    <div class="col-span-3">Label</div>
                    <div class="col-span-2">Risk</div>
                    <div class="col-span-2"></div>
                  </div>

                  <!-- Scope Rows -->
                  <div
                    v-for="(s, idx) in availableScopes"
                    :key="idx"
                    class="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-lg px-2 py-1.5"
                  >
                    <div class="col-span-1 flex justify-center">
                      <input
                        type="checkbox"
                        :checked="defaultScopeSet.has(s.scope)"
                        @change="toggleDefaultScope(s.scope)"
                        class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        title="Include by default"
                      />
                    </div>
                    <div class="col-span-4">
                      <input
                        v-model="s.scope"
                        type="text"
                        placeholder="https://www.googleapis.com/auth/gmail.readonly"
                        class="form-input text-xs"
                      />
                    </div>
                    <div class="col-span-3">
                      <input
                        v-model="s.label"
                        type="text"
                        placeholder="Gmail (read-only)"
                        class="form-input text-xs"
                      />
                    </div>
                    <div class="col-span-2">
                      <select v-model="s.risk" class="form-input text-xs">
                        <option value="read">🟢 Read</option>
                        <option value="write">🟡 Write</option>
                        <option value="admin">🔴 Admin</option>
                      </select>
                    </div>
                    <div class="col-span-2 flex justify-end">
                      <button
                        @click="removeScopeRow(idx)"
                        class="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50 transition"
                      >
                        ✕ Remove
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Extra Auth Params -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Extra Auth Params (JSON)</label>
                <input v-model="extraParamsInput" type="text" placeholder='{"access_type": "offline", "prompt": "consent"}' class="form-input" />
              </div>

              <!-- Resource Discovery -->
              <div class="grid grid-cols-1 gap-4 p-4 rounded-xl bg-purple-50/50 border border-purple-100">
                <p class="text-xs font-semibold text-purple-700 uppercase tracking-wider">Resource Discovery (Optional)</p>
                <div>
                  <label class="block text-xs font-medium text-gray-600 mb-1">Resource URL</label>
                  <input v-model="form.resource_url" type="text" placeholder="https://api.atlassian.com/oauth/token/accessible-resources" class="form-input text-xs" />
                  <p class="text-xs text-gray-400 mt-0.5">Called after OAuth to discover tenant/instance info (e.g. cloudId)</p>
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-600 mb-1">API Base Template</label>
                  <input v-model="form.api_base_template" type="text" placeholder="https://api.atlassian.com/ex/jira/{cloud_id}" class="form-input text-xs" />
                  <p class="text-xs text-gray-400 mt-0.5">URL template with {placeholders} resolved from discovery response</p>
                </div>
              </div>
            </div>

            <!-- Modal Footer -->
            <div class="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button @click="closeModal" class="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition">
                Cancel
              </button>
              <button
                @click="handleSaveProvider"
                :disabled="saving"
                class="px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
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
