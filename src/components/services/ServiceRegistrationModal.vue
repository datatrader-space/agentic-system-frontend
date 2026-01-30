<template>
  <div class="w-full">
    <!-- Header -->
    <div class="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-6 rounded-t-lg">
      <div>
        <h2 class="text-2xl font-bold">Register New Service</h2>
        <p class="text-sm text-white/80 mt-1">{{ stepDescriptions[currentStep] }}</p>
      </div>

      <!-- Progress Steps -->
      <div class="flex items-center gap-2 mt-6">
        <div
          v-for="(step, index) in steps"
          :key="index"
          class="flex-1"
        >
          <div
            class="h-2 rounded-full transition"
            :class="index <= currentStep ? 'bg-white' : 'bg-white/30'"
          ></div>
          <div class="text-xs text-white/70 mt-1 text-center font-medium">{{ step }}</div>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="p-8 min-h-[600px]">
        <!-- Step 1: Basic Info -->
        <div v-if="currentStep === 0">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Service Name *</label>
              <input
                v-model="formData.name"
                type="text"
                placeholder="e.g., Jira, Slack, GitHub"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                v-model="formData.category"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select category</option>
                <option value="project_management">Project Management</option>
                <option value="communication">Communication</option>
                <option value="file_storage">File Storage</option>
                <option value="code_repository">Code Repository</option>
                <option value="task_management">Task Management</option>
                <option value="crm">CRM</option>
                <option value="marketing">Marketing</option>
                <option value="analytics">Analytics</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Description *</label>
              <textarea
                v-model="formData.description"
                rows="3"
                placeholder="Describe what this service does"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              ></textarea>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Icon (Emoji)</label>
              <input
                v-model="formData.icon"
                type="text"
                placeholder="🌐"
                maxlength="2"
                class="w-20 px-3 py-2 border border-gray-300 rounded text-center text-2xl focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <!-- Step 2: API Configuration -->
        <div v-else-if="currentStep === 1">
          <div class="space-y-4">
            <!-- Discovery Method Selector -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">How would you like to add actions? *</label>
              <div class="space-y-2">
                <label class="flex items-start gap-3 p-3 border rounded cursor-pointer hover:bg-gray-50 transition" :class="formData.discovery_method === 'openapi' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'">
                  <input type="radio" v-model="formData.discovery_method" value="openapi" class="mt-1" />
                  <div class="flex-1">
                    <div class="font-medium">📄 OpenAPI/Swagger Spec</div>
                    <div class="text-sm text-gray-600">Automatically discover from OpenAPI 3.0 or Swagger 2.0 specification</div>
                  </div>
                </label>

                <label class="flex items-start gap-3 p-3 border rounded cursor-pointer hover:bg-gray-50 transition" :class="formData.discovery_method === 'postman' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'">
                  <input type="radio" v-model="formData.discovery_method" value="postman" class="mt-1" />
                  <div class="flex-1">
                    <div class="font-medium">📮 Postman Collection</div>
                    <div class="text-sm text-gray-600">Import from Postman collection (v2.x format)</div>
                  </div>
                </label>

                <label class="flex items-start gap-3 p-3 border rounded cursor-pointer hover:bg-gray-50 transition" :class="formData.discovery_method === 'graphql' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'">
                  <input type="radio" v-model="formData.discovery_method" value="graphql" class="mt-1" />
                  <div class="flex-1">
                    <div class="font-medium">🔷 GraphQL Schema</div>
                    <div class="text-sm text-gray-600">Auto-discover from GraphQL endpoint using introspection</div>
                  </div>
                </label>

                <label class="flex items-start gap-3 p-3 border rounded cursor-pointer hover:bg-gray-50 transition" :class="formData.discovery_method === 'html_docs' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'">
                  <input type="radio" v-model="formData.discovery_method" value="html_docs" class="mt-1" />
                  <div class="flex-1">
                    <div class="font-medium">📖 HTML Documentation</div>
                    <div class="text-sm text-gray-600">Extract endpoints from HTML documentation (experimental)</div>
                  </div>
                </label>

                <label class="flex items-start gap-3 p-3 border rounded cursor-pointer hover:bg-gray-50 transition" :class="formData.discovery_method === 'manual' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'">
                  <input type="radio" v-model="formData.discovery_method" value="manual" class="mt-1" />
                  <div class="flex-1">
                    <div class="font-medium">✍️ Manual Entry</div>
                    <div class="text-sm text-gray-600">I'll add actions manually later</div>
                  </div>
                </label>
              </div>
            </div>

            <!-- Base URL (always shown) -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Base URL *</label>
              <input
                v-model="formData.base_url"
                type="url"
                placeholder="https://api.example.com"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <p class="text-xs text-gray-500 mt-1">The base URL for all API requests</p>
            </div>

            <!-- OpenAPI/Swagger -->
            <div v-if="formData.discovery_method === 'openapi'">
              <label class="block text-sm font-medium text-gray-700 mb-1">OpenAPI Spec URL</label>
              <input
                v-model="formData.api_spec_url"
                type="url"
                placeholder="https://api.example.com/openapi.json"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 mb-2"
              />
              <div class="text-center text-gray-500 text-sm">or upload file</div>
              <input
                type="file"
                @change="handleOpenAPIUpload"
                accept=".json,.yaml,.yml"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 mt-2"
              />
              <p class="text-xs text-gray-500 mt-1">OpenAPI 3.0 or Swagger 2.0 specification (JSON or YAML)</p>
              <div v-if="openAPISpec" class="bg-green-50 border border-green-200 rounded p-2 mt-2">
                <span class="text-green-700 text-sm">✅ Spec file loaded</span>
              </div>
            </div>

            <!-- Postman Collection -->
            <div v-if="formData.discovery_method === 'postman'">
              <label class="block text-sm font-medium text-gray-700 mb-1">Postman Collection</label>
              <input
                v-model="formData.api_spec_url"
                type="url"
                placeholder="https://api.example.com/collection.json or upload file"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 mb-2"
              />
              <div class="text-center text-gray-500 text-sm">or</div>
              <input
                type="file"
                @change="handlePostmanUpload"
                accept=".json"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 mt-2"
              />
              <p class="text-xs text-gray-500 mt-1">Upload or provide URL to Postman Collection v2.x JSON</p>
            </div>

            <!-- GraphQL -->
            <div v-if="formData.discovery_method === 'graphql'">
              <label class="block text-sm font-medium text-gray-700 mb-1">GraphQL Endpoint URL</label>
              <input
                v-model="formData.api_spec_url"
                type="url"
                placeholder="https://api.example.com/graphql"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 mb-2"
              />
              <p class="text-xs text-gray-500 mt-1">GraphQL endpoint (will use introspection query)</p>
              <div class="text-center text-gray-500 text-sm my-2">or upload schema file</div>
              <input
                type="file"
                @change="handleGraphQLUpload"
                accept=".graphql,.gql,.json"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <p class="text-xs text-gray-500 mt-1">GraphQL SDL schema (.graphql) or introspection JSON</p>
              <div v-if="graphQLSchema" class="bg-green-50 border border-green-200 rounded p-2 mt-2">
                <span class="text-green-700 text-sm">✅ Schema file loaded</span>
              </div>
            </div>

            <!-- HTML Documentation -->
            <div v-if="formData.discovery_method === 'html_docs'">
              <label class="block text-sm font-medium text-gray-700 mb-1">Documentation URL</label>
              <input
                v-model="formData.api_spec_url"
                type="url"
                placeholder="https://api.example.com/docs"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 mb-2"
              />
              <p class="text-xs text-gray-500 mt-1">URL to API documentation page</p>
              <div class="text-center text-gray-500 text-sm my-2">or upload HTML file</div>
              <input
                type="file"
                @change="handleHTMLDocsUpload"
                accept=".html,.htm,.md,.txt"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <p class="text-xs text-gray-500 mt-1">HTML, Markdown, or text documentation</p>
              <div v-if="htmlDocsContent" class="bg-green-50 border border-green-200 rounded p-2 mt-2">
                <span class="text-green-700 text-sm">✅ Documentation file loaded</span>
              </div>
              <div class="bg-yellow-50 border border-yellow-200 rounded p-3 mt-2">
                <p class="text-xs text-yellow-800">⚠️ Experimental: Extracts endpoints using pattern matching. Results should be reviewed.</p>
              </div>
            </div>

            <!-- Manual Entry Notice -->
            <div v-if="formData.discovery_method === 'manual'" class="bg-blue-50 border border-blue-200 rounded p-4">
              <p class="text-sm text-blue-800">You can add actions manually after creating the service.</p>
            </div>

            <!-- Discover Button -->
            <button
              v-if="formData.discovery_method !== 'manual' && (formData.api_spec_url || postmanCollection || openAPISpec || graphQLSchema || htmlDocsContent)"
              @click="discoverActions"
              :disabled="discovering"
              class="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition disabled:opacity-50"
            >
              {{ discovering ? 'Discovering...' : '🔍 Discover Actions' }}
            </button>

            <!-- Discovery Results -->
            <div v-if="discoveredData" class="bg-green-50 border border-green-200 rounded p-4">
              <div class="flex items-center gap-2 text-green-700 font-medium mb-2">
                <span>✅</span>
                <span>Discovered {{ discoveredData.total_actions }} actions!</span>
              </div>
              <div class="text-sm text-gray-600">
                Found {{ Object.keys(discoveredData.categories).length }} categories
              </div>
              <div v-if="discoveredData.note" class="text-xs text-gray-500 mt-2">
                {{ discoveredData.note }}
              </div>
            </div>
          </div>
        </div>

        <!-- Step 3: Select & Review Actions -->
        <div v-else-if="currentStep === 2">
          <div v-if="!discoveredData" class="text-center py-8">
            <p class="text-gray-600">No actions discovered yet.</p>
            <p class="text-sm text-gray-500 mt-2">Go back and discover actions from API spec.</p>
          </div>

          <div v-else>
            <div class="mb-4">
              <h3 class="font-medium text-gray-900 mb-2">Select & Review Actions</h3>
              <p class="text-sm text-gray-600">Expand categories to view, edit, and approve individual actions</p>
            </div>

            <div class="space-y-3 max-h-96 overflow-y-auto">
              <div
                v-for="(categoryData, categoryName) in discoveredData.categories"
                :key="categoryName"
                class="border rounded-lg"
              >
                <!-- Category Header -->
                <div
                  class="p-4 cursor-pointer hover:bg-gray-50 transition"
                  @click="toggleCategoryExpanded(categoryName)"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2 flex-1">
                      <input
                        type="checkbox"
                        :checked="selectedCategories.includes(categoryName)"
                        @click.stop="toggleCategory(categoryName)"
                        class="rounded"
                      />
                      <span class="text-lg">{{ expandedCategories.includes(categoryName) ? '▼' : '▶' }}</span>
                      <h4 class="font-medium text-gray-900">{{ categoryData.name }}</h4>
                      <span class="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                        {{ getSelectedActionsInCategory(categoryName).length }}/{{ categoryData.count }}
                      </span>
                    </div>
                    <div v-if="discoveredData.recommended_categories.includes(categoryName)" class="ml-2">
                      <span class="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                        Recommended
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Expanded Actions List -->
                <div v-if="expandedCategories.includes(categoryName)" class="border-t bg-gray-50">
                  <div class="p-3 space-y-2">
                    <div
                      v-for="(action, idx) in categoryData.actions"
                      :key="idx"
                      class="bg-white border rounded p-3"
                    >
                      <div class="flex items-start gap-3">
                        <input
                          type="checkbox"
                          :checked="isActionSelected(categoryName, action)"
                          @change="toggleAction(categoryName, action)"
                          class="mt-1 rounded"
                        />
                        <div class="flex-1 space-y-2">
                          <!-- Action Header -->
                          <div class="flex items-center gap-2">
                            <span 
                              class="px-2 py-0.5 text-xs font-mono rounded"
                              :class="{
                                'bg-green-100 text-green-700': action.http_method === 'GET',
                                'bg-blue-100 text-blue-700': action.http_method === 'POST',
                                'bg-yellow-100 text-yellow-700': action.http_method === 'PUT',
                                'bg-red-100 text-red-700': action.http_method === 'DELETE'
                              }"
                            >
                              {{ action.http_method }}
                            </span>
                            <span class="text-sm text-gray-500 font-mono">{{ action.endpoint_path }}</span>
                          </div>

                          <!-- Editable Name -->
                          <div>
                            <label class="text-xs text-gray-600">Action Name</label>
                            <input
                              v-model="action.name"
                              type="text"
                              class="w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-blue-500"
                              @click.stop
                            />
                          </div>

                          <!-- Editable Description -->
                          <div>
                            <label class="text-xs text-gray-600">Description</label>
                            <textarea
                              v-model="action.description"
                              rows="2"
                              class="w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-blue-500"
                              @click.stop
                            ></textarea>
                          </div>

                          <!-- Parameter Count -->
                          <div class="text-xs text-gray-500">
                            {{ action.parameters?.length || 0 }} parameters
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <div class="text-sm text-blue-700">
                <strong>{{ getTotalSelectedActions() }} actions</strong> selected
              </div>
            </div>
          </div>
        </div>

        <!-- Step 4: Schema Review (NEW) -->
        <div v-else-if="currentStep === 3">
          <div v-if="!discoveredData || selectedCategories.length === 0" class="text-center py-8">
            <p class="text-gray-600">No actions selected.</p>
            <p class="text-sm text-gray-500 mt-2">Go back and select action categories.</p>
          </div>

          <div v-else>
            <div class="mb-4">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="font-medium text-gray-900">Review Parameters & Examples</h3>
                  <p class="text-sm text-gray-600">Review parameter examples, edit as needed</p>
                </div>
                <button
                  @click="enrichWithAI"
                  :disabled="enriching"
                  class="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition disabled:opacity-50 text-sm"
                >
                  {{ enriching ? 'Enriching...' : '✨ Enhance with AI' }}
                </button>
              </div>
            </div>

            <!-- Action Parameters List -->
            <div class="space-y-4 max-h-96 overflow-y-auto">
              <div
                v-for="action in getSelectedActions()"
                :key="action.name"
                class="border rounded-lg p-4"
              >
                <div class="flex items-center gap-2 mb-3">
                  <span class="px-2 py-0.5 text-xs font-mono rounded" 
                    :class="{
                      'bg-green-100 text-green-700': action.http_method === 'GET',
                      'bg-blue-100 text-blue-700': action.http_method === 'POST',
                      'bg-yellow-100 text-yellow-700': action.http_method === 'PUT',
                      'bg-red-100 text-red-700': action.http_method === 'DELETE'
                    }"
                  >
                    {{ action.http_method }}
                  </span>
                  <span class="font-medium text-gray-900">{{ action.name }}</span>
                  <span class="text-sm text-gray-500 font-mono">{{ action.endpoint_path }}</span>
                </div>

                <!-- Parameters -->
                <div v-if="action.parameters && action.parameters.length > 0" class="space-y-2">
                  <div
                    v-for="(param, pIdx) in action.parameters.slice(0, 5)"
                    :key="pIdx"
                    class="flex items-center gap-3 text-sm bg-gray-50 rounded p-2"
                  >
                    <div class="flex-1">
                      <div class="flex items-center gap-2">
                        <span class="font-mono text-gray-800">{{ param.name }}</span>
                        <span class="text-xs text-gray-500">({{ param.type }})</span>
                        <span v-if="param.required" class="text-xs text-red-500">*</span>
                        <span 
                          v-if="param.example_source" 
                          class="text-xs px-1 rounded"
                          :class="{
                            'bg-green-100 text-green-700': param.example_source === 'spec',
                            'bg-purple-100 text-purple-700': param.example_source === 'llm',
                            'bg-blue-100 text-blue-700': param.example_source === 'user'
                          }"
                        >
                          {{ param.example_source === 'spec' ? '📄' : param.example_source === 'llm' ? '🤖' : '👤' }}
                        </span>
                      </div>
                      <div class="text-xs text-gray-500 truncate">{{ param.description || 'No description' }}</div>
                    </div>
                    <input
                      v-model="param.example"
                      type="text"
                      :placeholder="param.example || 'Add example...'"
                      class="w-32 px-2 py-1 text-xs border rounded focus:ring-1 focus:ring-blue-500"
                      @input="param.example_source = 'user'"
                    />
                  </div>
                  <div v-if="action.parameters.length > 5" class="text-xs text-gray-500 text-center">
                    +{{ action.parameters.length - 5 }} more parameters
                  </div>
                </div>
                <div v-else class="text-sm text-gray-500 italic">
                  No parameters
                </div>
              </div>
            </div>

            <div class="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p class="text-sm text-yellow-800">
                💡 Examples help the AI understand how to use these actions. You can edit them now or later.
              </p>
            </div>
          </div>
        </div>

        <!-- Step 5: Review -->
        <div v-else-if="currentStep === 4">
          <div class="space-y-6">
            <div>
              <h3 class="font-medium text-gray-900 mb-4">Review Service Configuration</h3>

              <div class="space-y-3">
                <div class="flex justify-between py-2 border-b">
                  <span class="text-gray-600">Name:</span>
                  <span class="font-medium">{{ formData.name }}</span>
                </div>
                <div class="flex justify-between py-2 border-b">
                  <span class="text-gray-600">Category:</span>
                  <span class="font-medium">{{ formData.category || 'N/A' }}</span>
                </div>
                <div class="flex justify-between py-2 border-b">
                  <span class="text-gray-600">Base URL:</span>
                  <span class="font-medium text-sm">{{ formData.base_url }}</span>
                </div>
                <div class="flex justify-between py-2 border-b">
                  <span class="text-gray-600">Auth Type:</span>
                  <span class="font-medium">{{ formData.auth_type }}</span>
                </div>
                <div class="flex justify-between py-2 border-b">
                  <span class="text-gray-600">Categories Selected:</span>
                  <span class="font-medium">{{ selectedCategories.length }}</span>
                </div>
                <div class="flex justify-between py-2">
                  <span class="text-gray-600">Total Actions:</span>
                  <span class="font-medium text-blue-600">{{ getTotalSelectedActions() }}</span>
                </div>
              </div>
            </div>

            <div class="bg-yellow-50 border border-yellow-200 rounded p-4">
              <div class="flex gap-2">
                <span class="text-yellow-600">⚠️</span>
                <div class="text-sm text-yellow-800">
                  <strong>Note:</strong> After registration, all selected actions will be created as tools
                  and immediately available in the Tool Registry.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="border-t border-gray-200 px-8 py-6 bg-gray-50 flex justify-between rounded-b-lg">
        <button
          v-if="currentStep > 0"
          @click="currentStep--"
          class="px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded transition"
        >
          ← Back
        </button>
        <div v-else></div>

        <div class="flex gap-3">
          <button
            v-if="currentStep < steps.length - 1"
            @click="nextStep"
            :disabled="!canProceed"
            class="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next →
          </button>
          <button
            v-else
            @click="registerService"
            :disabled="registering || !canProceed"
            class="px-6 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded transition disabled:opacity-50"
          >
            {{ registering ? 'Registering...' : 'Register Service' }}
          </button>
        </div>
      </div>
    </div>
  
</template>

<script>
import { ref, computed } from 'vue'
import api from '../../services/api'

export default {
  name: 'ServiceRegistrationWizard',
  emits: ['registered'],
  setup(props, { emit }) {
    const currentStep = ref(0)
    const discovering = ref(false)
    const registering = ref(false)
    const enriching = ref(false)

    const steps = ['Basic Info', 'API Config', 'Select Actions', 'Schema Review', 'Review']
    const stepDescriptions = [
      'Basic service information',
      'API endpoint and spec configuration',
      'Choose which action categories to enable',
      'Review parameters, add examples, optionally enhance with AI',
      'Review and confirm'
    ]

    const formData = ref({
      name: '',
      description: '',
      category: '',
      icon: '',
      base_url: '',
      api_spec_url: '',
      discovery_method: 'openapi',
      auth_type: 'bearer',
      auth_config: {}
    })

    const discoveredData = ref(null)
    const selectedCategories = ref([])
    const expandedCategories = ref([])
    const selectedActions = ref({}) // { categoryName: [action1, action2, ...] }
    const postmanCollection = ref(null)
    const openAPISpec = ref(null)
    const graphQLSchema = ref(null)
    const htmlDocsContent = ref(null)

    const canProceed = computed(() => {
      if (currentStep.value === 0) {
        return formData.value.name && formData.value.description
      }
      if (currentStep.value === 1) {
        return formData.value.base_url
      }
      // Step 2: Select Actions - need at least one action selected
      if (currentStep.value === 2) {
        return getTotalSelectedActions() > 0
      }
      // Step 3: Schema Review - always can proceed
      // Step 4: Review - always can proceed
      return true
    })

    const handlePostmanUpload = (event) => {
      const file = event.target.files[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            postmanCollection.value = JSON.parse(e.target.result)
            console.log('Postman collection loaded:', postmanCollection.value)
            const actionCount = postmanCollection.value?.item?.length || 0
            alert(`✅ Postman collection loaded successfully! Found ${actionCount} items.`)
          } catch (error) {
            console.error('Failed to parse Postman collection:', error)
            alert('Failed to parse Postman collection: ' + error.message)
          }
        }
        reader.readAsText(file)
      }
    }

    const handleOpenAPIUpload = (event) => {
      const file = event.target.files[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const content = e.target.result
            // Try JSON first, then YAML
            if (file.name.endsWith('.json')) {
              openAPISpec.value = JSON.parse(content)
            } else {
              // For YAML files, we'll send as raw text and parse on backend
              openAPISpec.value = { _raw: content, _format: 'yaml' }
            }
            console.log('OpenAPI spec loaded:', file.name)
            alert('✅ OpenAPI spec loaded successfully!')
          } catch (error) {
            console.error('Failed to parse OpenAPI spec:', error)
            alert('Failed to parse OpenAPI spec: ' + error.message)
          }
        }
        reader.readAsText(file)
      }
    }

    const handleGraphQLUpload = (event) => {
      const file = event.target.files[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const content = e.target.result
            if (file.name.endsWith('.json')) {
              // Introspection result JSON
              graphQLSchema.value = JSON.parse(content)
            } else {
              // SDL schema file (.graphql, .gql)
              graphQLSchema.value = { _sdl: content }
            }
            console.log('GraphQL schema loaded:', file.name)
            alert('✅ GraphQL schema loaded successfully!')
          } catch (error) {
            console.error('Failed to parse GraphQL schema:', error)
            alert('Failed to parse GraphQL schema: ' + error.message)
          }
        }
        reader.readAsText(file)
      }
    }

    const handleHTMLDocsUpload = (event) => {
      const file = event.target.files[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          htmlDocsContent.value = e.target.result
          console.log('HTML docs loaded:', file.name, '- Length:', htmlDocsContent.value.length)
          alert('✅ Documentation file loaded successfully!')
        }
        reader.readAsText(file)
      }
    }

    const discoverActions = async () => {
      discovering.value = true
      try {
        const payload = {
          discovery_method: formData.value.discovery_method,
          service_type: formData.value.name.toLowerCase()
        }

        // Add method-specific data based on discovery method
        const method = formData.value.discovery_method

        // Prefer uploaded files over URLs
        if (method === 'postman' && postmanCollection.value) {
          payload.postman_collection = postmanCollection.value
          console.log('Sending Postman collection with', postmanCollection.value?.item?.length || 0, 'items')
        } else if (method === 'openapi' && openAPISpec.value) {
          payload.openapi_spec = openAPISpec.value
          console.log('Sending uploaded OpenAPI spec')
        } else if (method === 'graphql' && graphQLSchema.value) {
          payload.graphql_schema = graphQLSchema.value
          console.log('Sending uploaded GraphQL schema')
        } else if (method === 'html_docs' && htmlDocsContent.value) {
          payload.html_content = htmlDocsContent.value
          console.log('Sending uploaded HTML docs, length:', htmlDocsContent.value.length)
        } else if (formData.value.api_spec_url) {
          // Fallback to URL if no file uploaded
          payload.api_spec_url = formData.value.api_spec_url
          console.log('Sending API spec URL:', formData.value.api_spec_url)
        }

        console.log('Discovery payload:', { method: payload.discovery_method, hasUploadedContent: !payload.api_spec_url })
        const response = await api.discoverServiceActions(payload)

        discoveredData.value = response.data

        // Auto-fill base URL if discovered
        if (response.data.base_url && !formData.value.base_url) {
          formData.value.base_url = response.data.base_url
        }

        // Auto-select recommended categories
        selectedCategories.value = response.data.recommended_categories || []

      } catch (error) {
        console.error('Failed to discover actions:', error)
        alert('Failed to discover actions: ' + (error.response?.data?.error || error.message))
      } finally {
        discovering.value = false
      }
    }

    const toggleCategory = (categoryName) => {
      const index = selectedCategories.value.indexOf(categoryName)
      if (index > -1) {
        // Deselecting category - remove it
        selectedCategories.value.splice(index, 1)
        // Also deselect all actions in this category
        delete selectedActions.value[categoryName]
      } else {
        // Selecting category - add it and select all actions
        selectedCategories.value.push(categoryName)
        if (discoveredData.value && discoveredData.value.categories[categoryName]) {
          selectedActions.value[categoryName] = [...discoveredData.value.categories[categoryName].actions]
        }
      }
    }

    const toggleCategoryExpanded = (categoryName) => {
      const index = expandedCategories.value.indexOf(categoryName)
      if (index > -1) {
        expandedCategories.value.splice(index, 1)
      } else {
        expandedCategories.value.push(categoryName)
      }
    }

    const isActionSelected = (categoryName, action) => {
      if (!selectedActions.value[categoryName]) return false
      return selectedActions.value[categoryName].some(a => a.name === action.name)
    }

    const toggleAction = (categoryName, action) => {
      if (!selectedActions.value[categoryName]) {
        selectedActions.value[categoryName] = []
      }
      
      const idx = selectedActions.value[categoryName].findIndex(a => a.name === action.name)
      if (idx > -1) {
        // Deselect action
        selectedActions.value[categoryName].splice(idx, 1)
        // If no actions left in category, remove from selectedCategories
        if (selectedActions.value[categoryName].length === 0) {
          const catIdx = selectedCategories.value.indexOf(categoryName)
          if (catIdx > -1) {
            selectedCategories.value.splice(catIdx, 1)
          }
        }
      } else {
        // Select action
        selectedActions.value[categoryName].push(action)
        // Add category to selectedCategories if not already there
        if (!selectedCategories.value.includes(categoryName)) {
          selectedCategories.value.push(categoryName)
        }
      }
    }

    const getSelectedActionsInCategory = (categoryName) => {
      return selectedActions.value[categoryName] || []
    }

    const getTotalSelectedActions = () => {
      let total = 0
      Object.values(selectedActions.value).forEach(actions => {
        total += actions.length
      })
      return total
    }

    const getSelectedActions = () => {
      const actions = []
      Object.values(selectedActions.value).forEach(categoryActions => {
        actions.push(...categoryActions)
      })
      return actions
    }

    const enrichWithAI = async () => {
      enriching.value = true
      try {
        const actions = getSelectedActions()
        
        // Warn if too many actions
        if (actions.length > 20) {
          if (!confirm(`⚠️ You have ${actions.length} selected actions. Only the first 20 will be enriched to prevent timeout. Continue?`)) {
            enriching.value = false
            return
          }
        }
        
        // Get OpenAPI doc for enrichment (if available)
        const openAPIDoc = openAPISpec.value || null
        
        const response = await api.enrichSchemas({
          service_name: formData.value.name,
          actions: actions,
          openapi_doc: openAPIDoc
        })

        // Update the discovered data with enriched schemas
        if (response.data && response.data.enriched_actions) {
          // Map enriched actions back to categories
          response.data.enriched_actions.forEach(enrichedAction => {
            selectedCategories.value.forEach(catName => {
              const category = discoveredData.value.categories[catName]
              if (category && category.actions) {
                const idx = category.actions.findIndex(a => a.name === enrichedAction.name)
                if (idx > -1) {
                  // Update with enriched data
                  category.actions[idx] = { ...category.actions[idx], ...enrichedAction }
                }
              }
            })
          })
          
          // Show detailed success message
          const stats = response.data.stats
          let message = `✨ Enrichment complete!\n\n`
          message += `✅ Enriched: ${stats.enriched}/${stats.total}\n`
          if (stats.validated > 0) {
            message += `✓ Validated: ${stats.validated}\n`
          }
          if (stats.repaired > 0) {
            message += `🔧 Auto-repaired: ${stats.repaired}\n`
          }
          if (stats.skipped > 0) {
            message += `⚠️ Skipped (errors): ${stats.skipped}\n`
          }
          message += `\nCheck the updated parameter examples!`
          
          alert(message)
        }
        
      } catch (error) {
        console.error('Failed to enrich schemas:', error)
        if (error.code === 'ECONNABORTED') {
          alert('⏱️ Request timed out. Try selecting fewer actions (max 20 recommended).')
        } else {
          alert('Failed to enrich schemas: ' + (error.response?.data?.error || error.message))
        }
      } finally {
        enriching.value = false
      }
    }

    const nextStep = () => {
      if (currentStep.value < steps.length - 1) {
        currentStep.value++
      }
    }

    const registerService = async () => {
      registering.value = true
      try {
        // Step 1: Create service
        const serviceResponse = await api.createService({
          name: formData.value.name,
          description: formData.value.description,
          category: formData.value.category,
          icon: formData.value.icon,
          base_url: formData.value.base_url,
          auth_type: formData.value.auth_type,
          auth_config: formData.value.auth_config,
          discovery_method: formData.value.discovery_method,
          api_spec_url: formData.value.api_spec_url
        })

        const serviceId = serviceResponse.data.service_id

        // Step 2: Create actions for selected categories
        if (discoveredData.value && selectedCategories.value.length > 0) {
          const actionsToCreate = []

          selectedCategories.value.forEach(categoryName => {
            const category = discoveredData.value.categories[categoryName]
            if (category && category.actions) {
              category.actions.forEach(action => {
                actionsToCreate.push({
                  name: action.name,
                  description: action.description,
                  action_group: categoryName,
                  endpoint_path: action.endpoint_path,
                  http_method: action.http_method,
                  parameters: action.parameters,
                  request_body_schema: action.request_body_schema,
                  response_schema: action.response_schema,
                  // 🆕 Include enriched data if available
                  invocation_schema: action.invocation_schema,
                  llm_notes: action.llm_notes,
                  risk_level: action.risk_level,
                  execution_pattern: action.execution_pattern || 'simple'
                })
              })
            }
          })

          if (actionsToCreate.length > 0) {
            await api.createServiceActions(serviceId, {
              actions: actionsToCreate
            })
          }
        }

        emit('registered')

      } catch (error) {
        console.error('Failed to register service:', error)
        alert('Failed to register service: ' + (error.response?.data?.error || error.message))
      } finally {
        registering.value = false
      }
    }

    return {
      currentStep,
      discovering,
      registering,
      enriching,
      steps,
      stepDescriptions,
      formData,
      discoveredData,
      selectedCategories,
      expandedCategories,
      selectedActions,
      postmanCollection,
      openAPISpec,
      graphQLSchema,
      htmlDocsContent,
      canProceed,
      handlePostmanUpload,
      handleOpenAPIUpload,
      handleGraphQLUpload,
      handleHTMLDocsUpload,
      discoverActions,
      toggleCategory,
      toggleCategoryExpanded,
      isActionSelected,
      toggleAction,
      getSelectedActionsInCategory,
      getTotalSelectedActions,
      getSelectedActions,
      enrichWithAI,
      nextStep,
      registerService
    }
  }
}
</script>
