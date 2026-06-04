<template>
  <!-- Modal Overlay -->
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" @mousedown.self="$emit('close')">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="$emit('close')"></div>

    <!-- Modal Card -->
    <div class="relative w-full max-w-2xl bg-white rounded-[20px] shadow-[0_32px_64px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col max-h-[90vh]">

      <!-- Header -->
      <div class="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-6 shrink-0">
        <div class="flex items-start justify-between">
          <div>
            <h2 class="text-[22px] font-extrabold tracking-tight">Register New Service</h2>
            <p class="text-[13px] text-white/75 mt-1 font-medium">{{ stepDescriptions[currentStep] }}</p>
          </div>
          <button @click="$emit('close')" class="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors ml-4 shrink-0 mt-0.5">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- Progress Steps -->
        <div class="flex items-end gap-2 mt-6">
          <div v-for="(step, index) in steps" :key="index" class="flex-1">
            <div class="h-1.5 rounded-full transition-all duration-300" :class="index <= currentStep ? 'bg-white' : 'bg-white/25'"></div>
            <div class="text-[11px] text-white/65 mt-1.5 text-center font-bold uppercase tracking-wide">{{ step }}</div>
          </div>
        </div>
      </div>

      <!-- Scrollable Body -->
      <div class="flex-1 overflow-y-auto p-8">

        <!-- Step 1: Basic Info -->
        <div v-if="currentStep === 0" class="space-y-5">
          <div>
            <label class="block text-[13px] font-bold text-slate-700 mb-1.5">Service Name <span class="text-red-500">*</span></label>
            <input
              v-model="formData.name"
              type="text"
              placeholder="e.g., Jira, Slack, GitHub"
              class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-[10px] text-slate-800 font-medium text-[14px] focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-400"
            />
          </div>

          <div>
            <label class="block text-[13px] font-bold text-slate-700 mb-1.5">Category</label>
            <select
              v-model="formData.category"
              class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-[10px] text-slate-800 font-medium text-[14px] focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
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
            <label class="block text-[13px] font-bold text-slate-700 mb-1.5">Description <span class="text-red-500">*</span></label>
            <textarea
              v-model="formData.description"
              rows="3"
              placeholder="Describe what this service does"
              class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-[10px] text-slate-800 font-medium text-[14px] focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none placeholder:text-slate-400"
            ></textarea>
          </div>

          <div>
            <label class="block text-[13px] font-bold text-slate-700 mb-1.5">Icon (Emoji)</label>
            <input
              v-model="formData.icon"
              type="text"
              placeholder="ðŸŒ"
              maxlength="2"
              class="w-20 px-3 py-3 bg-slate-50 border border-slate-200 rounded-[10px] text-center text-2xl focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </div>
        </div>

        <!-- Step 2: API Configuration -->
        <div v-else-if="currentStep === 1" class="space-y-5">
          <!-- Discovery Method Selector -->
          <div>
            <label class="block text-[13px] font-bold text-slate-700 mb-2.5">How would you like to add actions? <span class="text-red-500">*</span></label>
            <div class="space-y-2">
              <label v-for="method in discoveryMethods" :key="method.value" class="flex items-start gap-3 p-4 border-2 rounded-[12px] cursor-pointer transition-all"
                :class="formData.discovery_method === method.value ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'">
                <input type="radio" v-model="formData.discovery_method" :value="method.value" class="mt-0.5 accent-indigo-600" />
                <div class="flex-1">
                  <div class="font-bold text-slate-800 text-[14px]">{{ method.icon }} {{ method.label }}</div>
                  <div class="text-[12px] text-slate-500 mt-0.5">{{ method.desc }}</div>
                </div>
              </label>
            </div>
          </div>

          <!-- Base URL -->
          <div>
            <label class="block text-[13px] font-bold text-slate-700 mb-1.5">Base URL <span class="text-red-500">*</span></label>
            <input
              v-model="formData.base_url"
              type="url"
              placeholder="https://api.example.com"
              class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-[10px] text-slate-800 font-mono text-[13px] focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
            <p class="text-[12px] text-slate-400 mt-1.5 font-medium">The base URL for all API requests</p>
          </div>

          <!-- OpenAPI/Swagger -->
          <div v-if="formData.discovery_method === 'openapi'" class="space-y-3">
            <label class="block text-[13px] font-bold text-slate-700">OpenAPI Spec URL</label>
            <input v-model="formData.api_spec_url" type="url" placeholder="https://api.example.com/openapi.json"
              class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-[10px] text-slate-800 font-mono text-[13px] focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" />
            <div class="flex items-center gap-3"><div class="flex-1 h-px bg-slate-200"></div><span class="text-[12px] text-slate-400 font-medium">or upload file</span><div class="flex-1 h-px bg-slate-200"></div></div>
            <label class="flex items-center gap-3 p-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[10px] cursor-pointer hover:bg-indigo-50/50 hover:border-indigo-300 transition-all">
              <svg class="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
              <span class="text-[13px] text-slate-500 font-medium">{{ openAPISpec ? 'âœ… Spec file loaded' : 'Upload OpenAPI 3.0 or Swagger 2.0 (.json, .yaml, .yml)' }}</span>
              <input type="file" @change="handleOpenAPIUpload" accept=".json,.yaml,.yml" class="hidden" />
            </label>
          </div>

          <!-- Postman Collection -->
          <div v-if="formData.discovery_method === 'postman'" class="space-y-3">
            <label class="block text-[13px] font-bold text-slate-700">Postman Collection URL</label>
            <input v-model="formData.api_spec_url" type="url" placeholder="https://... or upload file"
              class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-[10px] font-mono text-[13px] focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" />
            <div class="flex items-center gap-3"><div class="flex-1 h-px bg-slate-200"></div><span class="text-[12px] text-slate-400 font-medium">or</span><div class="flex-1 h-px bg-slate-200"></div></div>
            <label class="flex items-center gap-3 p-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[10px] cursor-pointer hover:bg-indigo-50/50 hover:border-indigo-300 transition-all">
              <svg class="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
              <span class="text-[13px] text-slate-500 font-medium">{{ postmanCollection ? 'âœ… Collection loaded' : 'Upload Postman Collection v2.x (.json)' }}</span>
              <input type="file" @change="handlePostmanUpload" accept=".json" class="hidden" />
            </label>
          </div>

          <!-- GraphQL -->
          <div v-if="formData.discovery_method === 'graphql'" class="space-y-3">
            <label class="block text-[13px] font-bold text-slate-700">GraphQL Endpoint URL</label>
            <input v-model="formData.api_spec_url" type="url" placeholder="https://api.example.com/graphql"
              class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-[10px] font-mono text-[13px] focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" />
            <div class="flex items-center gap-3"><div class="flex-1 h-px bg-slate-200"></div><span class="text-[12px] text-slate-400 font-medium">or upload schema file</span><div class="flex-1 h-px bg-slate-200"></div></div>
            <label class="flex items-center gap-3 p-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[10px] cursor-pointer hover:bg-indigo-50/50 hover:border-indigo-300 transition-all">
              <svg class="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
              <span class="text-[13px] text-slate-500 font-medium">{{ graphQLSchema ? 'âœ… Schema loaded' : 'Upload GraphQL SDL schema or introspection JSON' }}</span>
              <input type="file" @change="handleGraphQLUpload" accept=".graphql,.gql,.json" class="hidden" />
            </label>
          </div>

          <!-- HTML Docs -->
          <div v-if="formData.discovery_method === 'html_docs'" class="space-y-3">
            <label class="block text-[13px] font-bold text-slate-700">Documentation URL</label>
            <input v-model="formData.api_spec_url" type="url" placeholder="https://api.example.com/docs"
              class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-[10px] font-mono text-[13px] focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" />
            <label class="flex items-center gap-3 p-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[10px] cursor-pointer hover:bg-amber-50/50 hover:border-amber-300 transition-all">
              <svg class="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
              <span class="text-[13px] text-slate-500 font-medium">{{ htmlDocsContent ? 'âœ… Documentation loaded' : 'Upload HTML, Markdown, or text docs' }}</span>
              <input type="file" @change="handleHTMLDocsUpload" accept=".html,.htm,.md,.txt" class="hidden" />
            </label>
            <div class="bg-amber-50 border border-amber-200 rounded-[10px] px-4 py-3 flex items-start gap-2">
              <span class="text-amber-500 text-lg leading-none mt-0.5">âš ï¸</span>
              <p class="text-[12px] text-amber-800 font-medium">Experimental: Extracts endpoints using pattern matching. Results should be reviewed.</p>
            </div>
          </div>

          <!-- Manual Entry Notice -->
          <div v-if="formData.discovery_method === 'manual'" class="bg-blue-50 border border-blue-200 rounded-[12px] px-4 py-4 flex items-start gap-3">
            <svg class="w-5 h-5 text-blue-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <p class="text-[13px] text-blue-800 font-medium">You can add actions manually after creating the service. No API spec is required right now.</p>
          </div>

          <!-- Discover Button -->
          <button
            v-if="formData.discovery_method !== 'manual' && (formData.api_spec_url || postmanCollection || openAPISpec || graphQLSchema || htmlDocsContent)"
            @click="discoverActions"
            :disabled="discovering"
            class="w-full px-5 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-[12px] font-bold text-[14px] hover:opacity-90 transition-opacity disabled:opacity-50 shadow-md flex items-center justify-center gap-2"
          >
            <svg v-if="discovering" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            {{ discovering ? 'Discovering Actions...' : 'ðŸ” Discover Actions' }}
          </button>

          <!-- Discovery Results -->
          <div v-if="discoveredData" class="bg-emerald-50 border border-emerald-200 rounded-[12px] px-4 py-4 flex items-start gap-3">
            <span class="text-emerald-600 text-xl leading-none">âœ…</span>
            <div>
              <p class="text-[14px] font-bold text-emerald-800">Discovered {{ discoveredData.total_actions }} actions!</p>
              <p class="text-[12px] text-emerald-600 mt-0.5">Found {{ Object.keys(discoveredData.categories).length }} categories</p>
              <p v-if="discoveredData.note" class="text-[11px] text-emerald-500 mt-1 font-mono">{{ discoveredData.note }}</p>
            </div>
          </div>
        </div>

        <!-- Step 3: Select & Review Actions -->
        <div v-else-if="currentStep === 2">
          <div v-if="!discoveredData" class="py-12 text-center">
            <div class="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
            </div>
            <p class="text-[15px] font-bold text-slate-600">No actions discovered yet</p>
            <p class="text-[13px] text-slate-400 mt-1.5">Go back and discover actions from your API spec.</p>
          </div>

          <div v-else>
            <div class="flex items-center justify-between mb-5">
              <div>
                <h3 class="text-[16px] font-extrabold text-slate-900">Select Actions</h3>
                <p class="text-[12px] text-slate-500 mt-0.5">Expand categories to view, edit, and approve individual actions</p>
              </div>
              <span class="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-[8px] text-[13px] font-bold">{{ getTotalSelectedActions() }} selected</span>
            </div>

            <div class="space-y-3 max-h-80 overflow-y-auto pr-1">
              <div v-for="(categoryData, categoryName) in discoveredData.categories" :key="categoryName" class="border border-slate-200 rounded-[12px] overflow-hidden">
                <div class="p-4 cursor-pointer hover:bg-slate-50 transition-colors flex items-center justify-between" @click="toggleCategoryExpanded(categoryName)">
                  <div class="flex items-center gap-3 flex-1">
                    <input type="checkbox" :checked="selectedCategories.includes(categoryName)" @click.stop="toggleCategory(categoryName)" class="rounded accent-indigo-600 w-4 h-4" />
                    <span class="text-slate-400 text-sm">{{ expandedCategories.includes(categoryName) ? 'â–¼' : 'â–¶' }}</span>
                    <h4 class="font-bold text-slate-900 text-[14px]">{{ categoryData.name }}</h4>
                    <span class="px-2 py-0.5 text-[11px] bg-slate-100 text-slate-500 rounded-full font-bold">{{ getSelectedActionsInCategory(categoryName).length }}/{{ categoryData.count }}</span>
                    <span v-if="discoveredData.recommended_categories.includes(categoryName)" class="px-2 py-0.5 text-[11px] bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full font-bold">Recommended</span>
                  </div>
                </div>
                <div v-if="expandedCategories.includes(categoryName)" class="border-t border-slate-100 bg-slate-50/50 p-3 space-y-2">
                  <div v-for="(action, idx) in categoryData.actions" :key="idx" class="bg-white border border-slate-100 rounded-[10px] p-3">
                    <div class="flex items-start gap-3">
                      <input type="checkbox" :checked="isActionSelected(categoryName, action)" @change="toggleAction(categoryName, action)" class="mt-1 rounded accent-indigo-600 w-4 h-4" />
                      <div class="flex-1 space-y-2">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="px-2 py-0.5 text-[11px] font-mono font-bold rounded-md" :class="{ 'bg-emerald-100 text-emerald-700': action.http_method === 'GET', 'bg-blue-100 text-blue-700': action.http_method === 'POST', 'bg-amber-100 text-amber-700': action.http_method === 'PUT', 'bg-red-100 text-red-700': action.http_method === 'DELETE' }">{{ action.http_method }}</span>
                          <span class="text-[11px] text-slate-500 font-mono">{{ action.endpoint_path }}</span>
                        </div>
                        <input v-model="action.name" type="text" class="w-full px-2.5 py-1.5 text-[12px] bg-slate-50 border border-slate-200 rounded-[6px] font-medium focus:outline-none focus:bg-white focus:border-indigo-300 transition-all" @click.stop />
                        <textarea v-model="action.description" rows="2" class="w-full px-2.5 py-1.5 text-[12px] bg-slate-50 border border-slate-200 rounded-[6px] focus:outline-none focus:bg-white focus:border-indigo-300 transition-all resize-none" @click.stop></textarea>
                        <div class="text-[11px] text-slate-400 font-bold">{{ action.parameters?.length || 0 }} parameters</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 4: Schema Review -->
        <div v-else-if="currentStep === 3">
          <div v-if="!discoveredData || selectedCategories.length === 0" class="py-12 text-center">
            <p class="text-[15px] font-bold text-slate-600">No actions selected</p>
            <p class="text-[13px] text-slate-400 mt-1.5">Go back and select action categories first.</p>
          </div>

          <div v-else>
            <div class="flex items-center justify-between mb-5">
              <div>
                <h3 class="text-[16px] font-extrabold text-slate-900">Review Parameters & Examples</h3>
                <p class="text-[12px] text-slate-500 mt-0.5">Review parameter examples, edit as needed</p>
              </div>
              <button @click="enrichWithAI" :disabled="enriching"
                class="px-4 py-2 bg-purple-600 text-white rounded-[10px] hover:bg-purple-700 transition font-bold text-[13px] disabled:opacity-50 flex items-center gap-2">
                <svg v-if="enriching" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                {{ enriching ? 'Enhancing...' : 'âœ¨ Enhance with AI' }}
              </button>
            </div>

            <div class="space-y-4 max-h-80 overflow-y-auto pr-1">
              <div v-for="action in getSelectedActions()" :key="action.name" class="border border-slate-200 rounded-[12px] p-4">
                <div class="flex items-center gap-2 mb-3">
                  <span class="px-2 py-0.5 text-[11px] font-mono font-bold rounded-md" :class="{ 'bg-emerald-100 text-emerald-700': action.http_method === 'GET', 'bg-blue-100 text-blue-700': action.http_method === 'POST', 'bg-amber-100 text-amber-700': action.http_method === 'PUT', 'bg-red-100 text-red-700': action.http_method === 'DELETE' }">{{ action.http_method }}</span>
                  <span class="font-bold text-slate-900 text-[14px]">{{ action.name }}</span>
                  <span class="text-[12px] text-slate-400 font-mono">{{ action.endpoint_path }}</span>
                </div>

                <div v-if="action.parameters && action.parameters.length > 0" class="space-y-2">
                  <div v-for="(param, pIdx) in action.parameters.slice(0, 5)" :key="pIdx" class="flex items-center gap-3 text-[12px] bg-slate-50 rounded-[8px] p-2.5">
                    <div class="flex-1">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-mono font-bold text-slate-800">{{ param.name }}</span>
                        <span class="text-slate-400">({{ param.type }})</span>
                        <span v-if="param.required" class="text-red-500 font-bold text-[11px]">required</span>
                        <span v-if="param.example_source" class="text-[10px] px-1.5 py-0.5 rounded font-bold" :class="{ 'bg-emerald-100 text-emerald-700': param.example_source === 'spec', 'bg-purple-100 text-purple-700': param.example_source === 'llm', 'bg-blue-100 text-blue-700': param.example_source === 'user' }">{{ param.example_source === 'spec' ? 'ðŸ“„ spec' : param.example_source === 'llm' ? 'ðŸ¤– ai' : 'ðŸ‘¤ user' }}</span>
                      </div>
                      <div class="text-slate-400 truncate mt-0.5">{{ param.description || 'No description' }}</div>
                    </div>
                    <input v-model="param.example" type="text" :placeholder="param.example || 'Add example...'"
                      class="w-32 px-2.5 py-1.5 text-[12px] bg-white border border-slate-200 rounded-[6px] focus:outline-none focus:border-indigo-300 transition-all" @input="param.example_source = 'user'" />
                  </div>
                  <div v-if="action.parameters.length > 5" class="text-[11px] text-slate-400 font-bold text-center">+{{ action.parameters.length - 5 }} more parameters</div>
                </div>
                <div v-else class="text-[12px] text-slate-400 italic">No parameters</div>
              </div>
            </div>

            <div class="mt-4 bg-amber-50 border border-amber-200 rounded-[12px] px-4 py-3 flex items-start gap-2">
              <span class="text-amber-500 shrink-0 mt-0.5">ðŸ’¡</span>
              <p class="text-[12px] text-amber-800 font-medium">Examples help the AI understand how to use these actions. You can edit them now or later.</p>
            </div>
          </div>
        </div>

        <!-- Step 5: Review -->
        <div v-else-if="currentStep === 4">
          <h3 class="text-[16px] font-extrabold text-slate-900 mb-5">Review Service Configuration</h3>

          <div class="bg-slate-50 rounded-[14px] border border-slate-200 overflow-hidden mb-5">
            <div v-for="(item, idx) in reviewItems" :key="idx" class="flex items-center justify-between px-5 py-3.5" :class="idx < reviewItems.length - 1 ? 'border-b border-slate-100' : ''">
              <span class="text-[13px] font-bold text-slate-500 uppercase tracking-wide">{{ item.label }}</span>
              <span class="text-[14px] font-bold text-slate-900 font-mono truncate max-w-[280px]">{{ item.value }}</span>
            </div>
          </div>

          <div class="bg-amber-50 border border-amber-200 rounded-[12px] px-4 py-4 flex items-start gap-3">
            <span class="text-amber-500 text-xl leading-none mt-0.5">âš ï¸</span>
            <div class="text-[13px] text-amber-800">
              <strong>Note:</strong> After registration, all selected actions will be created as tools and immediately available in the Tool Registry.
            </div>
          </div>
        </div>

      </div><!-- end scrollable body -->

      <!-- Footer -->
      <div class="shrink-0 border-t border-slate-100 bg-slate-50/80 px-8 py-5 flex items-center justify-between">
        <button v-if="currentStep > 0" @click="currentStep--"
          class="px-5 py-2.5 text-[14px] font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-[10px] transition-all flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          Back
        </button>
        <div v-else></div>

        <div class="flex items-center gap-3">
          <button @click="$emit('close')" class="px-5 py-2.5 text-[14px] font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-[10px] transition-all">Cancel</button>
          <button v-if="currentStep < steps.length - 1" @click="nextStep" :disabled="!canProceed"
            class="px-6 py-2.5 text-[14px] font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 rounded-[10px] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md flex items-center gap-2">
            Next
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </button>
          <button v-else @click="registerService" :disabled="registering || !canProceed"
            class="px-6 py-2.5 text-[14px] font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 rounded-[10px] transition-all disabled:opacity-40 shadow-md flex items-center gap-2">
            <svg v-if="registering" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            {{ registering ? 'Registering...' : 'âœ… Register Service' }}
          </button>
        </div>
      </div>

    </div><!-- end modal card -->
  </div><!-- end overlay -->
</template>


<script>
import { ref, computed } from 'vue'
import api from '../../services/api'

export default {
  name: 'ServiceRegistrationWizard',
  emits: ['registered', 'close'],
  setup(props, { emit }) {
    const currentStep = ref(0)
    const discovering = ref(false)
    const registering = ref(false)
    const enriching = ref(false)

    const discoveryMethods = [
      { value: 'openapi', icon: 'ðŸ“„', label: 'OpenAPI/Swagger Spec', desc: 'Automatically discover from OpenAPI 3.0 or Swagger 2.0 specification' },
      { value: 'postman', icon: 'ðŸ“®', label: 'Postman Collection',   desc: 'Import from Postman collection (v2.x format)' },
      { value: 'graphql', icon: 'ðŸ”·', label: 'GraphQL Schema',        desc: 'Auto-discover from GraphQL endpoint using introspection' },
      { value: 'html_docs', icon: 'ðŸ“–', label: 'HTML Documentation', desc: 'Extract endpoints from HTML documentation (experimental)' },
      { value: 'manual',   icon: 'âœï¸', label: 'Manual Entry',         desc: "I'll add actions manually later" }
    ]

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
            alert(`âœ… Postman collection loaded successfully! Found ${actionCount} items.`)
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
            alert('âœ… OpenAPI spec loaded successfully!')
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
            alert('âœ… GraphQL schema loaded successfully!')
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
          alert('âœ… Documentation file loaded successfully!')
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
          if (!confirm(`âš ï¸ You have ${actions.length} selected actions. Only the first 20 will be enriched to prevent timeout. Continue?`)) {
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
          let message = `âœ¨ Enrichment complete!\n\n`
          message += `âœ… Enriched: ${stats.enriched}/${stats.total}\n`
          if (stats.validated > 0) {
            message += `âœ“ Validated: ${stats.validated}\n`
          }
          if (stats.repaired > 0) {
            message += `ðŸ”§ Auto-repaired: ${stats.repaired}\n`
          }
          if (stats.skipped > 0) {
            message += `âš ï¸ Skipped (errors): ${stats.skipped}\n`
          }
          message += `\nCheck the updated parameter examples!`
          
          alert(message)
        }
        
      } catch (error) {
        console.error('Failed to enrich schemas:', error)
        if (error.code === 'ECONNABORTED') {
          alert('â±ï¸ Request timed out. Try selecting fewer actions (max 20 recommended).')
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
                  // ðŸ†• Include enriched data if available
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

    const reviewItems = computed(() => [
      { label: 'Name',        value: formData.value.name || 'â€”' },
      { label: 'Category',    value: formData.value.category || 'N/A' },
      { label: 'Base URL',    value: formData.value.base_url || 'â€”' },
      { label: 'Auth Type',   value: formData.value.auth_type || 'â€”' },
      { label: 'Categories',  value: String(selectedCategories.value.length) },
      { label: 'Total Actions', value: String(getTotalSelectedActions()) }
    ])

    return {
      currentStep,
      discovering,
      registering,
      enriching,
      steps,
      stepDescriptions,
      discoveryMethods,
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
      reviewItems,
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
