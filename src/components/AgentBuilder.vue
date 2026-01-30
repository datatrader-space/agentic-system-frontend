<template>
  <div class="agent-builder flex flex-col h-full bg-white w-full pt-16">
    <div class="relative z-10 p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
      <h2 class="font-bold text-gray-800 flex-shrink-0 max-w-[300px] truncate">Agent Configuration</h2>
      <div class="flex gap-2 flex-shrink-0 min-w-[120px] ml-4">
        <button 
            @click="save" 
            :disabled="isSaving"
            class="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50 min-w-[100px]"
        >
            {{ isSaving ? 'Saving...' : 'Save Agent' }}
        </button>
      </div>
    </div>


    <!-- Tabs Header -->
    <div class="flex border-b border-gray-200 px-4 shrink-0 bg-white">
        <button 
            v-for="tab in ['General', 'Knowledge', 'Tools', 'Credentials']" 
            :key="tab"
            @click="activeTab = tab"
            :class="['px-4 py-3 text-sm font-medium border-b-2 transition-colors', activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700']"
        >
            {{ tab }}
        </button>
    </div>

    <div class="flex-1 overflow-y-auto p-6 space-y-6">
      
      <!-- TAB: GENERAL -->
      <div v-if="activeTab === 'General'" class="space-y-6">
      <div class="space-y-4">
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input 
                v-model="internalAgent.name"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="e.g. Django Migration Expert"
            />
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea 
                v-model="internalAgent.description"
                rows="2"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                placeholder="What does this agent do?"
            ></textarea>
        </div>
      </div>

      <hr />

      <!-- Soul (Prompt) & Model -->
      <div class="space-y-4">
        <div>
             <label class="block text-sm font-medium text-gray-700 mb-1">LLM Provider</label>
             <select 
                v-model="selectedProviderId"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white mb-2"
             >
                <option :value="null">All Providers</option>
                <option v-for="p in llmProviders" :key="p.id" :value="p.id">
                    {{ p.name }} ({{ p.provider_type }})
                </option>
             </select>

             <label class="block text-sm font-medium text-gray-700 mb-1">Default Model</label>
             <select 
                ref="modelSelect"
                :value="internalAgent.default_model || ''"
                @change="internalAgent.default_model = $event.target.value ? parseInt($event.target.value) : null"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
             >
                <option :value="null">Select a model...</option>
                <option v-for="m in filteredModels" :key="m.id" :value="m.id">
                    {{ m.name }}
                </option>
             </select>
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
                System Prompt
                <span v-pre class="text-xs font-normal text-gray-500 ml-1">(Use {{tools}} for automatic injection)</span>
            </label>
        <div class="relative">
            <textarea 
                v-model="internalAgent.system_prompt_template"
                rows="8"
                class="w-full px-3 py-2 font-mono text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-gray-50"
                placeholder="You are a helpful assistant..."
            ></textarea>
        </div>
      </div>
      </div>

      </div>

      <!-- TAB: KNOWLEDGE -->
      <div v-if="activeTab === 'Knowledge'" class="space-y-6">


      <hr />

      <!-- Agent Knowledge Base -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Knowledge Base & Files</label>
        <div class="space-y-3">
             <!-- Upload -->
            <div class="flex gap-2">
                <input 
                    type="file" 
                    ref="fileInput"
                    class="hidden" 
                    @change="handleFileUpload"
                />
                <button 
                    @click="$refs.fileInput.click()"
                    class="flex-1 px-3 py-2 border border-gray-300 border-dashed rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-indigo-600 transition flex items-center justify-center gap-2"
                    :disabled="uploading"
                >
                    <span v-if="uploading">Uploading...</span>
                    <span v-else>+ Upload Knowledge File</span>
                </button>
            </div>

            <!-- File List -->
            <div class="space-y-2">
                <!-- If no files -->
                <div v-if="(!internalAgent.knowledge_files || internalAgent.knowledge_files.length === 0)" class="text-xs text-gray-400 text-center italic py-2">
                    No files uploaded. Agent relies on prompt only.
                </div>

                <div 
                    v-for="file in internalAgent.knowledge_files" 
                    :key="file.id"
                    class="group relative bg-white border border-gray-200 rounded-lg p-3 hover:border-indigo-300 transition"
                >
                    <!-- Header -->
                    <div class="flex justify-between items-start mb-1">
                        <div class="font-medium text-sm text-gray-800 truncate pr-4">{{ file.name }}</div>
                        <button 
                             class="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                             title="Remove File"
                             @click.stop="removeFile(file)"
                        >
                            ×
                        </button>
                    </div>

                    <!-- Analysis Preview -->
                    <div 
                        v-if="file.analysis" 
                        @click="viewAnalysis(file)"
                        class="text-xs text-gray-600 bg-gray-50 p-2 rounded mt-1 line-clamp-3 cursor-pointer hover:bg-indigo-50 transition relative group/analysis"
                    >
                        <span class="font-bold text-indigo-600">AI Analysis:</span> {{ file.analysis }}
                        <div class="absolute inset-x-0 bottom-0 text-center bg-gradient-to-t from-white/90 to-transparent text-[10px] text-indigo-500 font-bold opacity-0 group-hover/analysis:opacity-100">Click to expand</div>
                    </div>
                    <div v-else class="text-xs text-gray-400 italic mt-1">
                        Analysis pending...
                    </div>
                </div>
            </div>
        </div>
      </div>

      <!-- Analysis Modal -->
      <div v-if="showAnalysisModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="showAnalysisModal = false">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div class="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 class="font-bold text-gray-800 flex items-center gap-2">
                    📄 Analysis: {{ selectedAnalysisFile?.name }}
                </h3>
                <button @click="showAnalysisModal = false" class="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
            </div>
            <div class="p-6 overflow-y-auto prose prose-sm max-w-none text-gray-800" v-html="formatMarkdown(selectedAnalysisFile?.analysis || '')">
            </div>
            <div class="p-3 border-t border-gray-100 bg-gray-50 flex justify-between">
                <button 
                    @click="reRunAnalysis" 
                    :disabled="isReAnalyzing"
                    class="px-4 py-2 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 text-sm flex items-center gap-2"
                >
                    <span v-if="isReAnalyzing" class="animate-spin">↻</span>
                    <span v-else>⚡</span>
                    {{ isReAnalyzing ? 'Analyzing...' : 'Re-Run Analysis' }}
                </button>
                <button @click="showAnalysisModal = false" class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm">Close</button>
            </div>
        </div>
      </div>

      </div>

      <!-- TAB: TOOLS -->
      <div v-if="activeTab === 'Tools'" class="space-y-6">

      <!-- Tools -->
      <div>
        <div class="flex justify-between items-center mb-2">
             <label class="block text-sm font-medium text-gray-700">Capabilities (Tools)</label>
             <div class="flex items-center gap-3">
               <span class="text-xs text-gray-500">{{ selectedToolsCount }} selected</span>
               <!-- View Mode Toggle -->
               <div class="flex gap-1 bg-gray-100 rounded p-0.5">
                 <button
                   @click="toolsViewMode = 'category'"
                   :class="[
                     'px-2 py-1 text-xs font-medium rounded transition',
                     toolsViewMode === 'category' 
                       ? 'bg-white text-indigo-700 shadow-sm' 
                       : 'text-gray-600 hover:text-gray-800'
                   ]"
                 >
                   By Category
                 </button>
                 <button
                   @click="toolsViewMode = 'service'"
                   :class="[
                     'px-2 py-1 text-xs font-medium rounded transition',
                     toolsViewMode === 'service' 
                       ? 'bg-white text-indigo-700 shadow-sm' 
                       : 'text-gray-600 hover:text-gray-800'
                   ]"
                 >
                   By Service
                 </button>
               </div>
             </div>
        </div>

        <!-- Search Box -->
        <div class="mb-3">
            <input
                v-model="toolSearchQuery"
                type="text"
                placeholder="Search tools by name or description..."
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
        </div>

        <div class="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
            <div v-if="loadingTools" class="p-4 text-center text-sm text-gray-500">Loading tools...</div>

            <!-- SERVICE VIEW -->
            <div v-else-if="toolsViewMode === 'service' && groupedFilteredToolsByService.length > 0">
              <div v-for="service in groupedFilteredToolsByService" :key="service.id" class="border-b border-gray-100 last:border-b-0">
                <!-- Service Header -->
                <div class="bg-gray-50 px-3 py-2 sticky top-0 z-10 border-b border-gray-200">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-semibold text-gray-700">{{ service.name }}</span>
                      <!-- Credential Badge -->
                      <span
                        v-if="service.hasCredentials"
                        class="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-medium"
                        title="Has valid credentials"
                      >
                        ✓ Credentials
                      </span>
                      <span
                        v-else
                        class="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium"
                        title="Missing credentials - add in Credentials tab"
                      >
                        ⚠ No Credentials
                      </span>
                      <button 
                        @click.stop="toggleServiceTools(service.tools)" 
                        class="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium px-1.5 py-0.5 rounded hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition"
                      >
                        {{ areAllServiceToolsSelected(service.tools) ? 'Deselect All' : 'Add All Tools' }}
                      </button>
                    </div>
                    <span class="text-xs text-gray-500">{{ service.tools.length }} tools</span>
                  </div>
                </div>

                <!-- Tools in this service -->
                <div class="divide-y divide-gray-100">
                  <div
                    v-for="tool in service.tools"
                    :key="tool.id"
                    class="flex items-start p-3 hover:bg-gray-50 cursor-pointer transition"
                    @click="toggleTool(tool.id)"
                  >
                    <div class="flex items-center h-5">
                      <input
                        type="checkbox"
                        :checked="internalAgent.tool_ids.includes(tool.id)"
                        class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                    </div>
                    <div class="ml-3 text-sm flex-1">
                      <label class="font-medium text-gray-700 cursor-pointer block">{{ tool.name }}</label>
                      <p class="text-gray-500 text-xs mt-0.5">{{ tool.description }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- CATEGORY VIEW -->
            <div v-else-if="toolsViewMode === 'category' && Object.keys(groupedFilteredTools).length > 0">
                <div v-for="(tools, category) in groupedFilteredTools" :key="category" class="border-b border-gray-100 last:border-b-0">
                    <!-- Category Header -->
                    <div class="bg-gray-50 px-3 py-2 sticky top-0 z-10 border-b border-gray-200">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <span class="text-xs font-semibold text-gray-600 uppercase tracking-wide">{{ category }}</span>
                                <button 
                                    @click.stop="toggleCategory(category)" 
                                    class="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium px-1.5 py-0.5 rounded hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition"
                                >
                                    {{ areAllSelected(category) ? 'Deselect All' : 'Select All' }}
                                </button>
                            </div>
                            <span class="text-xs text-gray-500">{{ tools.length }} tools</span>
                        </div>
                    </div>

                    <!-- Tools in this category -->
                    <div class="divide-y divide-gray-100">
                        <div
                            v-for="tool in tools"
                            :key="tool.id"
                            class="flex items-start p-3 hover:bg-gray-50 cursor-pointer transition"
                            @click="toggleTool(tool.id)"
                        >
                            <div class="flex items-center h-5">
                                <input
                                    type="checkbox"
                                    :checked="internalAgent.tool_ids.includes(tool.id)"
                                    class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                />
                            </div>
                            <div class="ml-3 text-sm flex-1">
                                <label class="font-medium text-gray-700 cursor-pointer block">{{ tool.name }}</label>
                                <p class="text-gray-500 text-xs mt-0.5">{{ tool.description }}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- No results -->
            <div v-else class="p-8 text-center text-sm text-gray-500">
                <div v-if="toolsViewMode === 'service'">
                  <div class="text-3xl mb-3">🏢</div>
                  <p class="font-medium text-gray-700 mb-2">Service grouping not available</p>
                  <p class="text-xs mb-3">
                    Tools loaded from the registry don't include service metadata yet.
                  </p>
                  <button
                    @click="toolsViewMode = 'category'"
                    class="px-4 py-2 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 font-medium"
                  >
                    Switch to Category View
                  </button>
                </div>
                <div v-else>
                  No tools found matching "{{ toolSearchQuery }}"
                </div>
            </div>
        </div>
      </div>

      </div>

      <!-- TAB: CREDENTIALS -->
      <div v-if="activeTab === 'Credentials'" class="space-y-6">
        <div>
          <div class="flex justify-between items-center mb-2">
            <label class="block text-sm font-medium text-gray-700">Service Credentials</label>
            <button
              @click="openAddCredentialModal()"
              class="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 font-medium"
            >
              + Add Credential
            </button>
          </div>
          <p class="text-xs text-gray-500 mb-4">
            Manage encrypted credentials for remote service tools. Each service can have multiple credentials (e.g., Production, Staging).
          </p>

          <!-- Loading State -->
          <div v-if="loadingCredentials" class="text-center py-8 text-gray-500">
            <div class="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent rounded-full mb-2"></div>
            <p class="text-sm">Loading credentials...</p>
          </div>

          <!-- Credentials List Grouped by Service -->
          <div v-else class="space-y-4">
            <!-- Service Groups -->
            <div v-for="service in credentialsByService" :key="service.id" class="border border-gray-200 rounded-lg overflow-hidden">
              <div class="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <h3 class="font-medium text-gray-800">{{ service.name }}</h3>
                  <p class="text-xs text-gray-500">{{ service.credentials.length }} credential(s)</p>
                </div>
                <button
                  @click="openAddCredentialModal(service.id)"
                  class="text-xs px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 font-medium"
                >
                  + Add Credential
                </button>
              </div>

              <!-- Credentials for this service -->
              <div class="divide-y divide-gray-100">
                <div
                  v-for="cred in service.credentials"
                  :key="cred.id"
                  class="p-4 hover:bg-gray-50 transition"
                >
                  <div class="flex justify-between items-start">
                    <div class="flex-1">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="font-medium text-gray-800">{{ cred.credential_name }}</span>
                        <span v-if="cred.is_default" class="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
                          Default
                        </span>
                        <span
                          :class="[
                            'text-xs px-2 py-0.5 rounded font-medium',
                            cred.is_valid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          ]"
                        >
                          {{ cred.is_valid ? '✓ Valid' : '✗ Invalid' }}
                        </span>
                      </div>
                      <div class="flex gap-4 text-xs text-gray-500">
                        <span>Auth: {{ cred.auth_type }}</span>
                        <span v-if="cred.last_used_at">Last used: {{ formatDate(cred.last_used_at) }}</span>
                        <span v-else>Never used</span>
                      </div>
                    </div>

                    <div class="flex gap-2">
                      <button
                        v-if="!cred.is_default"
                        @click="setAsDefault(cred.id)"
                        class="text-xs px-2 py-1 text-gray-600 hover:text-indigo-600 border border-gray-300 rounded hover:border-indigo-300"
                        title="Set as default"
                      >
                        Set Default
                      </button>
                      <button
                        @click="testCredential(cred.id)"
                        class="text-xs px-2 py-1 text-gray-600 hover:text-green-600 border border-gray-300 rounded hover:border-green-300"
                        title="Test credential"
                      >
                        Test
                      </button>
                      <button
                        @click="deleteCredential(cred.id)"
                        class="text-xs px-2 py-1 text-gray-600 hover:text-red-600 border border-gray-300 rounded hover:border-red-300"
                        title="Delete credential"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- No Credentials -->
            <div v-if="credentials.length === 0" class="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <div class="text-4xl mb-2">🔐</div>
              <p class="text-gray-600 font-medium mb-1">No credentials configured</p>
              <p class="text-xs text-gray-500 mb-4">Add credentials for remote service tools to enable them</p>
              <button
                @click="openAddCredentialModal()"
                class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium"
              >
                Add Your First Credential
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Add/Edit Credential Modal -->
      <div v-if="showCredentialModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="showCredentialModal = false">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md">
          <div class="p-4 border-b border-gray-100 flex justify-between items-center">
            <h3 class="font-bold text-gray-800">Add Credential</h3>
            <button @click="showCredentialModal = false" class="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
          </div>

          <div class="p-6 space-y-4">
            <!-- Service Selection -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Service</label>
              <select
                v-model="credentialForm.service_id"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-gray-900"
              >
                <option :value="null" class="text-gray-900">Select a service...</option>
                <option v-for="svc in availableServices" :key="svc.id" :value="svc.id" class="text-gray-900">
                  {{ svc.name }}
                </option>
              </select>
            </div>

            <!-- Credential Name -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                v-model="credentialForm.credential_name"
                type="text"
                placeholder="e.g., Production API Key"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <!-- Auth Type -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Auth Type</label>
              <select
                v-model="credentialForm.auth_type"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="api_key">API Key</option>
                <option value="bearer">Bearer Token</option>
                <option value="basic">Basic Auth</option>
                <option value="oauth">OAuth</option>
              </select>
            </div>

            <!-- Dynamic fields based on auth type -->
            <div v-if="credentialForm.auth_type === 'api_key'" class="space-y-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                <input
                  v-model="credentialForm.api_key"
                  type="password"
                  placeholder="sk-..."
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono text-sm"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Header Name</label>
                <input
                  v-model="credentialForm.header_name"
                  type="text"
                  placeholder="X-API-Key"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div v-if="credentialForm.auth_type === 'bearer'">
              <label class="block text-sm font-medium text-gray-700 mb-1">Bearer Token</label>
              <input
                v-model="credentialForm.token"
                type="password"
                placeholder="eyJ..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono text-sm"
              />
            </div>

            <div v-if="credentialForm.auth_type === 'basic'" class="space-y-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  v-model="credentialForm.username"
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  v-model="credentialForm.password"
                  type="password"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div class="p-4 border-t border-gray-100 flex justify-end gap-2">
            <button
              @click="showCredentialModal = false"
              class="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              @click="saveCredential"
              :disabled="savingCredential"
              class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {{ savingCredential ? 'Saving...' : 'Save Credential' }}
            </button>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { marked } from 'marked';
import api from '../services/api';

const props = defineProps({
    agent: {
        type: Object,
        required: true
    },
    isSaving: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['update:agent', 'save']);

// Local copy for editing
const internalAgent = ref({
    default_model: null,  // Ensure this property exists for Vue reactivity
    ...props.agent
});
const availableTools = ref([]);
const llmProviders = ref([]);
const llmModels = ref([]);
const selectedProviderId = ref(null);
const loadingTools = ref(false);
const isUpdatingFromProp = ref(false);
const uploading = ref(false);
const isReAnalyzing = ref(false);
const fileInput = ref(null);
const modelSelect = ref(null);
const showAnalysisModal = ref(false);
const selectedAnalysisFile = ref(null);
const toolSearchQuery = ref('');
const activeTab = ref('General');
const toolsViewMode = ref('category'); // 'category' or 'service'

// Credentials state
const credentials = ref([]);
const availableServices = ref([]);
const loadingCredentials = ref(false);
const showCredentialModal = ref(false);
const savingCredential = ref(false);
const credentialForm = ref({
    service_id: null,
    credential_name: '',
    auth_type: 'api_key',
    api_key: '',
    header_name: 'X-API-Key',
    token: '',
    username: '',
    password: ''
});

const scopes = [
    { value: 'system', label: 'Full System' },
    { value: 'repository', label: 'Repository' },
    { value: 'none', label: 'None' }
];

const getScopeDescription = (scope) => {
    const map = {
        'system': 'Agent can access documentation and code across the entire system.',
        'repository': 'Agent is restricted to the specific repository it is launched in.',
        'none': 'No RAG access. Pure logic and external tools only.'
    };
    return map[scope] || '';
};

const selectedToolsCount = computed(() => {
    return internalAgent.value.tool_ids ? internalAgent.value.tool_ids.length : 0;
});

const credentialsByService = computed(() => {
    const serviceMap = {};
    
    // Group credentials by service
    credentials.value.forEach(cred=> {
        if (!serviceMap[cred.service_id]) {
            serviceMap[cred.service_id] = {
                id: cred.service_id,
                name: cred.service_name,
                credentials: []
            };
        }
        serviceMap[cred.service_id].credentials.push(cred);
    });
    
    return Object.values(serviceMap);
});

// Group tools by service with credential status
const groupedFilteredToolsByService = computed(() => {
    const query = toolSearchQuery.value.toLowerCase().trim();
    const filtered = query
        ? availableTools.value.filter(tool =>
            tool.name.toLowerCase().includes(query) ||
            (tool.description && tool.description.toLowerCase().includes(query))
        )
        : availableTools.value;
    
    console.log('Tools available for service grouping:', filtered.length);
    if (filtered.length > 0) {
        console.log('Sample tool structure:', JSON.stringify(filtered[0], null, 2));
    }
    
    // Group by service
    const serviceMap = {};
    
    filtered.forEach(tool => {
        // Check if this is a remote tool (multiple ways to identify)
        const isRemoteTool = 
            tool.tool_type === 'remote' || 
            tool.type === 'remote' ||
            tool.category === 'remote' ||
            tool.service ||
            tool.service_id ||
            tool.service_name;
        
        if (isRemoteTool) {
            // Handle different tool data structures
            let serviceId = null;
            let serviceName = 'Unknown Service';
            
            if (tool.service) {
                // Check if service is an object or just an ID
                if (typeof tool.service === 'object') {
                    serviceId = tool.service.id;
                    serviceName = tool.service.name || tool.service_name || 'Unknown Service';
                } else {
                    // service is just an ID
                    serviceId = tool.service;
                    serviceName = tool.service_name || `Service ${serviceId}`;
                }
            } else if (tool.service_id) {
                serviceId = tool.service_id;
                serviceName = tool.service_name || `Service ${serviceId}`;
            }
            
            // Only add if we found a service
            if (serviceId) {
                if (!serviceMap[serviceId]) {
                    // Check if we have credentials for this service
                    const hasCredentials = credentials.value.some(
                        cred => cred.service_id === serviceId && cred.is_valid
                    );
                    
                    serviceMap[serviceId] = {
                        id: serviceId,
                        name: serviceName,
                        tools: [],
                        hasCredentials: hasCredentials
                    };
                }
                serviceMap[serviceId].tools.push(tool);
            } else {
                console.warn('Remote tool has no service ID:', tool.name, tool);
            }
        }
    });
    
    // Sort services alphabetically
    const sortedServices = Object.values(serviceMap).sort((a, b) => 
        a.name.localeCompare(b.name)
    );
    
    console.log('Service grouped tools:', sortedServices.length, 'services found');
    sortedServices.forEach(svc => {
        console.log(`  - ${svc.name}: ${svc.tools.length} tools`);
    });
    
    return sortedServices;
});

// Filter and group tools by category
const groupedFilteredTools = computed(() => {
    // Filter tools based on search query
    const query = toolSearchQuery.value.toLowerCase().trim();
    const filtered = query
        ? availableTools.value.filter(tool =>
            tool.name.toLowerCase().includes(query) ||
            (tool.description && tool.description.toLowerCase().includes(query))
        )
        : availableTools.value;

    // Group by category
    const grouped = {};
    filtered.forEach(tool => {
        const category = tool.category || 'other';
        if (!grouped[category]) {
            grouped[category] = [];
        }
        grouped[category].push(tool);
    });

    // Sort categories alphabetically
    const sortedGrouped = {};
    Object.keys(grouped).sort().forEach(key => {
        sortedGrouped[key] = grouped[key];
    });

    return sortedGrouped;
});

const filteredModels = computed(() => {
    if (!selectedProviderId.value) return llmModels.value;
    return llmModels.value.filter(m => m.provider === selectedProviderId.value);
});

const fetchTools = async () => {
    try {
        loadingTools.value = true;
        // Fetch ALL pages of ToolDefinitions from our API
        let allTools = [];
        let nextUrl = '/tools/definitions/';

        while (nextUrl) {
            const response = await api.get(nextUrl);
            const data = response.data;

            // Add results from this page
            if (data.results) {
                allTools = allTools.concat(data.results);
            } else {
                // Fallback for non-paginated response
                allTools = data;
                break;
            }

            // Get next page URL (extract path from full URL and remove /api prefix)
            if (data.next) {
                const url = new URL(data.next);
                let path = url.pathname + url.search;
                // Remove /api prefix since api.get() adds it automatically
                if (path.startsWith('/api/')) {
                    path = path.substring(4);
                }
                nextUrl = path;
            } else {
                nextUrl = null;
            }
        }

        availableTools.value = allTools;
        console.log(`Loaded ${allTools.length} tools total`);
    } catch (e) {
        console.error("Failed to fetch tools", e);
    } finally {
        loadingTools.value = false;
    }
};

const fetchProviders = async () => {
    try {
        const res = await api.getLlmProviders();
        llmProviders.value = res.data.results || res.data;
    } catch (e) {
        console.error("Failed to fetch providers", e);
    }
};

const fetchModels = async () => {
    try {
        console.log('Fetching LLM models...');
        const res = await api.getLlmModels();
        llmModels.value = res.data.results || res.data;
        
        // Initial setup of selectedProviderId if model is already selected
        if (internalAgent.value.default_model) {
            const model = llmModels.value.find(m => m.id === internalAgent.value.default_model);
            if (model) {
                selectedProviderId.value = model.provider;
            }
        }
    } catch (e) {
        console.error("Failed to fetch models", e);
    }
};

const toggleTool = (toolId) => {
    if (!internalAgent.value.tool_ids) {
        internalAgent.value.tool_ids = [];
    }
    
    const index = internalAgent.value.tool_ids.indexOf(toolId);
    if (index === -1) {
        internalAgent.value.tool_ids.push(toolId);
    } else {
        internalAgent.value.tool_ids.splice(index, 1);
    }
};

const areAllSelected = (categoryName) => {
    // If we're filtering, we only care about visible tools in this category
    const tools = groupedFilteredTools.value[categoryName] || [];
    if (tools.length === 0) return false;
    // Check if ALL visible tools in this category are selected
    if (!internalAgent.value.tool_ids) return false;
    return tools.every(t => internalAgent.value.tool_ids.includes(t.id));
};

const toggleCategory = (categoryName) => {
    if (!internalAgent.value.tool_ids) {
        internalAgent.value.tool_ids = [];
    }

    const tools = groupedFilteredTools.value[categoryName] || [];
    const allSelected = areAllSelected(categoryName);
    
    if (allSelected) {
        // Deselect all visible tools in this category
        tools.forEach(t => {
            const idx = internalAgent.value.tool_ids.indexOf(t.id);
            if (idx !== -1) internalAgent.value.tool_ids.splice(idx, 1);
        });
    } else {
        // Select all visible tools in this category
        tools.forEach(t => {
            if (!internalAgent.value.tool_ids.includes(t.id)) {
                internalAgent.value.tool_ids.push(t.id);
            }
        });
    }
};

const areAllServiceToolsSelected = (tools) => {
    if (!tools || tools.length === 0) return false;
    if (!internalAgent.value.tool_ids) return false;
    return tools.every(t => internalAgent.value.tool_ids.includes(t.id));
};

const toggleServiceTools = (tools) => {
    if (!internalAgent.value.tool_ids) {
        internalAgent.value.tool_ids = [];
    }

    const allSelected = areAllServiceToolsSelected(tools);
    
    if (allSelected) {
        // Deselect all tools in this service
        tools.forEach(t => {
            const idx = internalAgent.value.tool_ids.indexOf(t.id);
            if (idx !== -1) internalAgent.value.tool_ids.splice(idx, 1);
        });
    } else {
        // Select all tools in this service
        tools.forEach(t => {
            if (!internalAgent.value.tool_ids.includes(t.id)) {
                internalAgent.value.tool_ids.push(t.id);
            }
        });
    }
};

const save = () => {
    // Read the model selection directly from internalAgent which is now v-model bound
    const modelId = internalAgent.value.default_model;
    
    // Create the payload with the current form values
    const agentData = {
        ...internalAgent.value,
        default_model: modelId
    };
    
    console.log('Saving agent with default_model:', modelId);
    emit('save', agentData);
};

const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!internalAgent.value.id) {
        alert("Please save the agent first to upload files.");
        return;
    }

    try {
        uploading.value = true;
        const res = await api.uploadAgentFile(internalAgent.value.id, file);
        
        // Add to list
        if (!internalAgent.value.knowledge_files) {
            internalAgent.value.knowledge_files = [];
        }
        internalAgent.value.knowledge_files.unshift(res.data);
        
        // Clear input
        if (fileInput.value) fileInput.value.value = '';
    } catch (e) {
        alert("Upload failed: " + (e.response?.data?.error || e.message));
    } finally {
        uploading.value = false;
    }
};

const viewAnalysis = (file) => {
    selectedAnalysisFile.value = file;
    showAnalysisModal.value = true;
};

const formatMarkdown = (text) => {
    if (!text) return '';
    return marked(text);
};

const removeFile = async (file) => {
    if (!confirm(`Are you sure you want to delete ${file.name}?`)) return;
    try {
        await api.deleteGenericFile(file.id);
        // Update local list
        internalAgent.value.knowledge_files = internalAgent.value.knowledge_files.filter(f => f.id !== file.id);
    } catch (e) {
        alert("Failed to delete file: " + (e.response?.data?.error || e.message));
    }
};

const reRunAnalysis = async () => {
    if (!selectedAnalysisFile.value) return;
    
    isReAnalyzing.value = true;
    try {
        const res = await api.analyzeContextFile(selectedAnalysisFile.value.id);
        
        // Update modal state (which points to file obj reference? wait selectedAnalysisFile is ref)
        // If selectedAnalysisFile is the same object ref as in the list, updating it updates the list.
        selectedAnalysisFile.value.analysis = res.data.analysis;
        
        // Ensure reactivity if ref changed
        const idx = internalAgent.value.knowledge_files.findIndex(f => f.id === selectedAnalysisFile.value.id);
        if (idx !== -1) {
            internalAgent.value.knowledge_files[idx].analysis = res.data.analysis;
        }
    } catch (e) {
        alert("Analysis failed: " + e.message);
    } finally {
        isReAnalyzing.value = false;
    }
};

//Credential Management Functions
const fetchCredentials = async () => {
    if (!internalAgent.value.id) return;
    
    try {
        loadingCredentials.value = true;
        const res = await api.get(`/agents/${internalAgent.value.id}/credentials/`);
        credentials.value = res.data.credentials || [];
    } catch (e) {
        console.error('Failed to fetch credentials:', e);
    } finally {
        loadingCredentials.value = false;
    }
};

const fetchServices = async () => {
    try {
        const res = await api.get('/services/');
        availableServices.value = res.data.services || res.data.results || res.data;
        console.log('Loaded services:', availableServices.value.length);
    } catch (e) {
        console.error('Failed to fetch services:', e);
    }
};

const openAddCredentialModal = (serviceId = null) => {
    credentialForm.value = {
        service_id: serviceId,
        credential_name: '',
        auth_type: 'api_key',
        api_key: '',
        header_name: 'X-API-Key',
        token: '',
        username: '',
        password: ''
    };
    showCredentialModal.value = true;
};

const saveCredential = async () => {
    if (!internalAgent.value.id) {
        alert('Please save the agent first');
        return;
    }
    
    if (!credentialForm.value.service_id) {
        alert('Please select a service');
        return;
    }
    
    try {
        savingCredential.value = true;
        
        // Build credentials object based on auth type
        const credentials_data = {};
        if (credentialForm.value.auth_type === 'api_key') {
            credentials_data.api_key = credentialForm.value.api_key;
            credentials_data.header_name = credentialForm.value.header_name;
        } else if (credentialForm.value.auth_type === 'bearer') {
            credentials_data.token = credentialForm.value.token;
        } else if (credentialForm.value.auth_type === 'basic') {
            credentials_data.username = credentialForm.value.username;
            credentials_data.password = credentialForm.value.password;
        }
        
        await api.post(`/agents/${internalAgent.value.id}/credentials/create/`, {
            service_id: credentialForm.value.service_id,
            credential_name: credentialForm.value.credential_name,
            auth_type: credentialForm.value.auth_type,
            credentials: credentials_data
        });
        
        showCredentialModal.value = false;
        await fetchCredentials();
       
    } catch (e) {
        alert('Failed to save credential: ' + (e.response?.data?.error || e.message));
    } finally {
        savingCredential.value = false;
    }
};

const setAsDefault = async (credentialId) => {
    if (!internalAgent.value.id) return;
    
    try {
        await api.post(`/agents/${internalAgent.value.id}/credentials/${credentialId}/set-default/`);
        await fetchCredentials();
    } catch (e) {
        alert('Failed to set default: ' + (e.response?.data?.error || e.message));
    }
};

const testCredential = async (credentialId) => {
    if (!internalAgent.value.id) return;
    
    try {
        const res = await api.post(`/agents/${internalAgent.value.id}/credentials/${credentialId}/test/`);
        if (res.data.success) {
            alert('✓ Credential test successful!');
        } else {
            alert('✗ Test failed: ' + (res.data.error || 'Unknown error'));
        }
    } catch (e) {
        alert('✗ Test failed: ' + (e.response?.data?.error || e.message));
    }
};

const deleteCredential = async (credentialId) => {
    if (!confirm('Are you sure you want to delete this credential?')) return;
    if (!internalAgent.value.id) return;
    
    try {
        await api.delete(`/agents/${internalAgent.value.id}/credentials/${credentialId}/delete/`);
        await fetchCredentials();
    } catch (e) {
        alert('Failed to delete credential: ' + (e.response?.data?.error || e.message));
    }
};

const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString();
};

// Watch activeTab to fetch credentials when tab is opened
watch(() => activeTab.value, (newTab) => {
    if (newTab === 'Credentials' && internalAgent.value.id) {
        fetchCredentials();
        fetchServices();
    } else if (newTab === 'Tools' && internalAgent.value.id) {
        // Fetch credentials for service view badges
        fetchCredentials();
    }
});

// Sync prop changes to internal
watch(() => props.agent, (newVal) => {
    isUpdatingFromProp.value = true;
    internalAgent.value = { 
        default_model: null,  // Ensure reactivity
        ...newVal 
    };
    // Ensure array exists
    if (!internalAgent.value.tool_ids) internalAgent.value.tool_ids = [];
    
    // Release lock after update propagates
    setTimeout(() => { isUpdatingFromProp.value = false; }, 0);
}, { deep: true });

// Sync internal changes to parent
watch(internalAgent, (newVal) => {
    if (isUpdatingFromProp.value) return;
    emit('update:agent', newVal);
}, { deep: true });

// Debug: Watch default_model specifically
watch(() => internalAgent.value.default_model, (newVal, oldVal) => {
    console.log('🔍 default_model changed from', oldVal, 'to', newVal);
}, { immediate: true });

onMounted(() => {
    fetchTools();
    fetchProviders();
    fetchModels();
});
</script>
