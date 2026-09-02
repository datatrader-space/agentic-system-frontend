<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" @mousedown.self="$emit('close')">
    <div class="absolute inset-0 bg-slate-950/35 backdrop-blur-[5px]" @click="$emit('close')"></div>

    <div class="relative w-full max-w-[980px] bg-white rounded-[12px] border border-slate-200 shadow-[0_28px_80px_rgba(15,23,42,0.24)] overflow-hidden flex flex-col max-h-[92vh]">

      <!-- Header -->
      <div class="bg-white text-slate-950 px-8 pt-6 pb-4 shrink-0">
        <div class="flex items-start justify-between">
          <div>
            <h2 class="text-[20px] font-bold tracking-[-0.01em]">Register New Service</h2>
            <p class="text-[13px] text-slate-500 mt-1 font-medium">Add a new service that your agents can use.</p>
          </div>
          <button @click="$emit('close')" class="w-9 h-9 rounded-[8px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors ml-4 shrink-0 mt-0.5">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- Progress Steps -->
        <div class="mt-5 rounded-[10px] border border-slate-200 bg-white px-8 py-5">
          <div class="grid grid-cols-6 items-start">
            <div v-for="(step, index) in steps" :key="index" class="relative flex flex-col items-center">
              <div v-if="index > 0" class="absolute right-1/2 top-[13px] h-px w-full bg-slate-200"></div>
              <div class="relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition-all" :class="index <= currentStep ? 'bg-violet-600 text-white shadow-[0_5px_16px_rgba(124,58,237,0.28)]' : 'bg-slate-100 text-slate-500'">{{ index + 1 }}</div>
              <div class="mt-2 text-center text-[10px] font-bold leading-tight" :class="index === currentStep ? 'text-violet-700' : 'text-slate-500'">{{ step }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Scrollable Body -->
      <div class="flex-1 overflow-y-auto px-8 pb-4">
        <div class="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside class="rounded-[10px] border border-slate-200 bg-white overflow-hidden">
            <div class="flex min-h-[210px] items-center justify-center border-b border-slate-200 bg-[radial-gradient(circle_at_center,#ede9fe_0,#ede9fe_38%,#ffffff_39%,#ffffff_100%)]">
              <div class="flex h-[116px] w-[116px] items-center justify-center rounded-full bg-violet-100">
                <div class="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 shadow-[0_18px_42px_rgba(124,58,237,0.38)]">
                  <svg class="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" d="M12 3.75 4.75 7.8 12 12l7.25-4.2L12 3.75Z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" d="M4.75 7.8v8.1L12 20.25l7.25-4.35V7.8M12 12v8.25"/>
                  </svg>
                </div>
              </div>
            </div>
            <div class="px-6 py-5">
              <h3 class="text-[13px] font-bold text-slate-950">Why register a service?</h3>
              <ul class="mt-4 space-y-4 text-[12px] font-medium leading-5 text-slate-600">
                <li class="flex gap-3"><span class="mt-0.5 text-violet-600">✓</span><span>Agents can securely access your API endpoints</span></li>
                <li class="flex gap-3"><span class="mt-0.5 text-violet-600">✓</span><span>Standardized authentication and security</span></li>
                <li class="flex gap-3"><span class="mt-0.5 text-violet-600">✓</span><span>Define actions with structured schema</span></li>
                <li class="flex gap-3"><span class="mt-0.5 text-violet-600">✓</span><span>Track usage, cost, and performance</span></li>
              </ul>
            </div>
          </aside>

          <section class="rounded-[10px] border border-slate-200 bg-white p-7">

        <!-- Step 1: Basic Info -->
        <div v-if="currentStep === 0" class="space-y-5">
          <h3 class="text-[15px] font-bold text-slate-950">Basic Information</h3>
          <div>
            <label class="block text-[12px] font-bold text-slate-700 mb-1.5">Service Name <span class="text-red-500">*</span></label>
            <input
              v-model="formData.name"
              type="text"
              placeholder="Enter service name"
              class="w-full h-10 px-3 bg-white border border-slate-200 rounded-[8px] text-slate-900 font-medium text-[13px] focus:outline-none focus:border-violet-400 focus:ring-3 focus:ring-violet-100 transition-all placeholder:text-slate-400"
            />
          </div>

          <div>
            <label class="block text-[12px] font-bold text-slate-700 mb-1.5">Category <span class="text-red-500">*</span></label>
            <select
              v-model="formData.category"
              class="w-full h-10 px-3 bg-white border border-slate-200 rounded-[8px] text-slate-900 font-medium text-[13px] focus:outline-none focus:border-violet-400 focus:ring-3 focus:ring-violet-100 transition-all"
            >
              <option value="">Select a category</option>
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
            <label class="block text-[12px] font-bold text-slate-700 mb-1.5">Description <span class="text-red-500">*</span></label>
            <textarea
              v-model="formData.description"
              rows="4"
              maxlength="500"
              placeholder="Describe what this service does, its main capabilities, and how agents will use it."
              class="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-[8px] text-slate-900 font-medium text-[13px] leading-5 focus:outline-none focus:border-violet-400 focus:ring-3 focus:ring-violet-100 transition-all resize-none placeholder:text-slate-400"
            ></textarea>
            <div class="mt-1 text-right text-[11px] font-medium text-slate-400">{{ formData.description.length }}/500</div>
          </div>

          <div>
            <label class="block text-[12px] font-bold text-slate-700 mb-2">Icon <span class="font-medium text-slate-400">(Optional)</span></label>
            <input
              v-model="formData.icon"
              type="text"
              placeholder="🌐"
              maxlength="2"
              class="w-20 h-10 px-3 bg-white border border-slate-200 rounded-[8px] text-center text-[13px] font-bold focus:outline-none focus:border-violet-400 focus:ring-3 focus:ring-violet-100 transition-all"
            />
          </div>

          <div>
            <label class="block text-[12px] font-bold text-slate-700 mb-2">Visibility <span class="text-red-500">*</span></label>
            <div class="grid gap-3 sm:grid-cols-2">
              <label class="flex cursor-pointer items-start gap-3 rounded-[9px] border p-4 transition"
                :class="formData.visibility === 'private' ? 'border-violet-500 bg-violet-50/40 shadow-[0_0_0_1px_rgba(124,58,237,0.12)]' : 'border-slate-200 bg-white hover:border-slate-300'">
                <input type="radio" v-model="formData.visibility" value="private" class="mt-1 accent-violet-600" />
                <span>
                  <span class="block text-[13px] font-bold text-slate-900">Private</span>
                  <span class="block text-[11px] font-medium text-slate-500">Only for this organization</span>
                </span>
              </label>
              <label class="flex cursor-pointer items-start gap-3 rounded-[9px] border p-4 transition"
                :class="formData.visibility === 'public' ? 'border-violet-500 bg-violet-50/40 shadow-[0_0_0_1px_rgba(124,58,237,0.12)]' : 'border-slate-200 bg-white hover:border-slate-300'">
                <input type="radio" v-model="formData.visibility" value="public" class="mt-1 accent-violet-600" />
                <span>
                  <span class="block text-[13px] font-bold text-slate-900">Public</span>
                  <span class="block text-[11px] font-medium text-slate-500">Available to all organizations</span>
                </span>
              </label>
            </div>
          </div>

          <label class="flex items-start gap-3 border-t border-slate-100 pt-4">
            <input type="checkbox" v-model="formData.enable_all_workspaces" class="mt-0.5 rounded accent-violet-600" />
            <span>
              <span class="block text-[12px] font-bold text-slate-900">Enable for all workspaces</span>
              <span class="block text-[11px] font-medium text-slate-500">Allow access and usage of this service across all workspaces</span>
            </span>
          </label>
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
              <span class="text-[13px] text-slate-500 font-medium">{{ openAPISpec ? '✅ Spec file loaded' : 'Upload OpenAPI 3.0 or Swagger 2.0 (.json, .yaml, .yml)' }}</span>
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
              <span class="text-[13px] text-slate-500 font-medium">{{ postmanCollection ? '✅ Collection loaded' : 'Upload Postman Collection v2.x (.json)' }}</span>
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
              <span class="text-[13px] text-slate-500 font-medium">{{ graphQLSchema ? '✅ Schema loaded' : 'Upload GraphQL SDL schema or introspection JSON' }}</span>
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
              <span class="text-[13px] text-slate-500 font-medium">{{ htmlDocsContent ? '✅ Documentation loaded' : 'Upload HTML, Markdown, or text docs' }}</span>
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
            {{ discovering ? 'Discovering Actions...' : '🔍 Discover Actions' }}
          </button>

          <!-- Discovery Results -->
          <div v-if="discoveredData" class="bg-emerald-50 border border-emerald-200 rounded-[12px] px-4 py-4 flex items-start gap-3">
            <span class="text-emerald-600 text-xl leading-none">✅</span>
            <div>
              <p class="text-[14px] font-bold text-emerald-800">Discovered {{ discoveredData.total_actions }} actions!</p>
              <p class="text-[12px] text-emerald-600 mt-0.5">Found {{ Object.keys(discoveredData.categories).length }} categories</p>
              <p v-if="discoveredData.note" class="text-[11px] text-emerald-500 mt-1 font-mono">{{ discoveredData.note }}</p>
            </div>
          </div>
        </div>

        <!-- Step 3: Authentication -->
        <div v-else-if="currentStep === 2" class="space-y-5">
          <div>
            <h3 class="text-[15px] font-bold text-slate-950">Authentication</h3>
            <p class="text-[12px] text-slate-500 mt-1 font-medium">How agents authenticate to this API. Credentials are encrypted at rest.</p>
          </div>

          <div class="space-y-2">
            <label v-for="t in authTypes" :key="t.value"
              class="flex items-start gap-3 p-4 border-2 rounded-[12px] cursor-pointer transition-all"
              :class="formData.auth_type === t.value ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'">
              <input type="radio" v-model="formData.auth_type" :value="t.value" class="mt-0.5 accent-indigo-600" />
              <div class="flex-1">
                <div class="font-bold text-slate-800 text-[14px]">{{ t.icon }} {{ t.label }}</div>
                <div class="text-[12px] text-slate-500 mt-0.5">{{ t.desc }}</div>
              </div>
            </label>
          </div>

          <!-- API Key -->
          <div v-if="formData.auth_type === 'api_key'" class="space-y-3 border-t border-slate-100 pt-4">
            <div class="grid gap-3 sm:grid-cols-2">
              <div>
                <label class="block text-[12px] font-bold text-slate-700 mb-1.5">Key Name <span class="text-red-500">*</span></label>
                <input v-model="formData.auth_config.key_name" type="text" placeholder="X-API-Key"
                  class="w-full h-10 px-3 bg-white border border-slate-200 rounded-[8px] font-mono text-[13px] focus:outline-none focus:border-violet-400 transition-all" />
              </div>
              <div>
                <label class="block text-[12px] font-bold text-slate-700 mb-1.5">Send In</label>
                <select v-model="formData.auth_config.placement"
                  class="w-full h-10 px-3 bg-white border border-slate-200 rounded-[8px] text-[13px] font-medium focus:outline-none focus:border-violet-400 transition-all">
                  <option value="header">Header</option>
                  <option value="query">Query parameter</option>
                </select>
              </div>
            </div>
            <div>
              <label class="block text-[12px] font-bold text-slate-700 mb-1.5">Key Value <span class="text-red-500">*</span></label>
              <input v-model="formData.auth_config.key_value" type="password" placeholder="Your API key"
                class="w-full h-10 px-3 bg-white border border-slate-200 rounded-[8px] font-mono text-[13px] focus:outline-none focus:border-violet-400 transition-all" />
            </div>
            <div>
              <label class="block text-[12px] font-bold text-slate-700 mb-1.5">Value Prefix <span class="font-medium text-slate-400">(optional)</span></label>
              <input v-model="formData.auth_config.prefix" type="text" placeholder="e.g. Token "
                class="w-full h-10 px-3 bg-white border border-slate-200 rounded-[8px] font-mono text-[13px] focus:outline-none focus:border-violet-400 transition-all" />
            </div>
          </div>

          <!-- Bearer -->
          <div v-else-if="formData.auth_type === 'bearer'" class="space-y-3 border-t border-slate-100 pt-4">
            <label class="block text-[12px] font-bold text-slate-700 mb-1.5">Token <span class="text-red-500">*</span></label>
            <input v-model="formData.auth_config.token" type="password" placeholder="Sent as: Authorization: Bearer &lt;token&gt;"
              class="w-full h-10 px-3 bg-white border border-slate-200 rounded-[8px] font-mono text-[13px] focus:outline-none focus:border-violet-400 transition-all" />
          </div>

          <!-- Basic -->
          <div v-else-if="formData.auth_type === 'basic'" class="grid gap-3 sm:grid-cols-2 border-t border-slate-100 pt-4">
            <div>
              <label class="block text-[12px] font-bold text-slate-700 mb-1.5">Username <span class="text-red-500">*</span></label>
              <input v-model="formData.auth_config.username" type="text"
                class="w-full h-10 px-3 bg-white border border-slate-200 rounded-[8px] text-[13px] focus:outline-none focus:border-violet-400 transition-all" />
            </div>
            <div>
              <label class="block text-[12px] font-bold text-slate-700 mb-1.5">Password <span class="text-red-500">*</span></label>
              <input v-model="formData.auth_config.password" type="password"
                class="w-full h-10 px-3 bg-white border border-slate-200 rounded-[8px] text-[13px] focus:outline-none focus:border-violet-400 transition-all" />
            </div>
          </div>

          <!-- OAuth 2.0 -->
          <div v-else-if="formData.auth_type === 'oauth2'" class="space-y-3 border-t border-slate-100 pt-4">
            <div>
              <label class="block text-[12px] font-bold text-slate-700 mb-1.5">Authorization URL <span class="text-red-500">*</span></label>
              <input v-model="formData.auth_config.authorization_url" type="url" placeholder="https://auth.example.com/authorize"
                class="w-full h-10 px-3 bg-white border border-slate-200 rounded-[8px] font-mono text-[13px] focus:outline-none focus:border-violet-400 transition-all" />
            </div>
            <div>
              <label class="block text-[12px] font-bold text-slate-700 mb-1.5">Token URL <span class="text-red-500">*</span></label>
              <input v-model="formData.auth_config.token_url" type="url" placeholder="https://auth.example.com/oauth/token"
                class="w-full h-10 px-3 bg-white border border-slate-200 rounded-[8px] font-mono text-[13px] focus:outline-none focus:border-violet-400 transition-all" />
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <div>
                <label class="block text-[12px] font-bold text-slate-700 mb-1.5">Client ID <span class="text-red-500">*</span></label>
                <input v-model="formData.auth_config.client_id" type="text"
                  class="w-full h-10 px-3 bg-white border border-slate-200 rounded-[8px] font-mono text-[13px] focus:outline-none focus:border-violet-400 transition-all" />
              </div>
              <div>
                <label class="block text-[12px] font-bold text-slate-700 mb-1.5">Client Secret <span class="font-medium text-slate-400">(optional for PKCE)</span></label>
                <input v-model="formData.auth_config.client_secret" type="password"
                  class="w-full h-10 px-3 bg-white border border-slate-200 rounded-[8px] font-mono text-[13px] focus:outline-none focus:border-violet-400 transition-all" />
              </div>
            </div>
            <div>
              <label class="block text-[12px] font-bold text-slate-700 mb-1.5">Scopes</label>
              <input v-model="formData.auth_config.scopes" type="text" placeholder="read:jira-work write:jira-work offline_access"
                class="w-full h-10 px-3 bg-white border border-slate-200 rounded-[8px] font-mono text-[13px] focus:outline-none focus:border-violet-400 transition-all" />
            </div>
            <div class="bg-indigo-50 border border-indigo-200 rounded-[10px] px-4 py-3 text-[12px] text-indigo-800">
              Register this redirect URI with your OAuth provider:
              <code class="font-mono font-bold">{{ oauthRedirectUri }}</code>
              <div class="mt-1.5 text-indigo-600">After registering, open the service from Connectors and click <strong>Connect</strong> — each user authorizes their own account.</div>
            </div>
          </div>

          <div v-if="!authComplete" class="bg-amber-50 border border-amber-200 rounded-[12px] px-4 py-3 flex items-start gap-2">
            <span class="text-amber-500 shrink-0 mt-0.5">!</span>
            <p class="text-[12px] text-amber-800 font-medium">
              Fill in: <strong>{{ missingAuthFields.join(', ') }}</strong>. Without a working credential every tool from this service will fail with 401.
            </p>
          </div>
        </div>

        <!-- Step 4: Select & Review Actions -->
        <div v-else-if="currentStep === 3">
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
                    <span class="text-slate-400 text-sm">{{ expandedCategories.includes(categoryName) ? '▼' : '▶' }}</span>
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

        <!-- Step 5: Schema Review -->
        <div v-else-if="currentStep === 4">
          <div v-if="!discoveredData || getTotalSelectedActions() === 0" class="py-12 text-center">
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
                {{ enriching ? 'Enhancing...'
                   : (pendingEnrichCount > 0 ? `✨ Enhance ${pendingEnrichCount} with AI` : '✨ Re-enhance all') }}
              </button>
            </div>

            <!-- Recover a previous run rather than re-paying for it. -->
            <div v-if="recoverable && pendingEnrichCount > 0 && !enriching"
              class="mb-4 flex items-center justify-between gap-3 rounded-[12px] border border-indigo-200 bg-indigo-50 px-4 py-3">
              <p class="text-[12px] font-medium text-indigo-800">
                Your last enrichment run has <strong>{{ recoverable.enriched_by_llm }}</strong> finished actions
                <span v-if="recoverable.service_name">from &ldquo;{{ recoverable.service_name }}&rdquo;</span>.
                Restore them instead of running it again?
              </p>
              <button @click="restoreEnrichment"
                class="shrink-0 rounded-[8px] bg-indigo-600 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-indigo-700 transition">
                Restore
              </button>
            </div>

            <!-- Live progress. Enrichment runs in the background over ALL selected actions; it is no
                 longer capped at 20 with the remainder silently discarded. -->
            <div v-if="enriching" class="mb-4 rounded-[12px] border border-purple-200 bg-purple-50 px-4 py-3">
              <div class="flex items-center justify-between text-[12px] font-bold text-purple-800">
                <span>Enriching {{ enrichProgress.done }} / {{ enrichProgress.total }}</span>
                <span>{{ enrichProgress.percent }}%</span>
              </div>
              <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-purple-100">
                <div class="h-full bg-purple-600 transition-all duration-300" :style="{ width: enrichProgress.percent + '%' }"></div>
              </div>
              <p v-if="enrichProgress.current" class="mt-2 truncate text-[11px] font-mono text-purple-600">{{ enrichProgress.current }}</p>
              <p v-if="enrichProgress.model" class="mt-1 text-[11px] font-medium text-purple-500">Model: {{ enrichProgress.model }}</p>
            </div>

            <div v-else-if="enrichedCount > 0" class="mb-4 rounded-[12px] border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[12px] font-bold text-emerald-800">
              AI-enriched {{ enrichedCount }} of {{ getTotalSelectedActions() }} selected actions.
              <span v-if="pendingEnrichCount > 0" class="font-medium text-emerald-600">
                Run it again to enrich the remaining {{ pendingEnrichCount }} — the finished ones are skipped.
              </span>
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
                        <span v-if="param.example_source" class="text-[10px] px-1.5 py-0.5 rounded font-bold" :class="{ 'bg-emerald-100 text-emerald-700': param.example_source === 'spec', 'bg-purple-100 text-purple-700': param.example_source === 'llm', 'bg-blue-100 text-blue-700': param.example_source === 'user' }">{{ param.example_source === 'spec' ? '📄 spec' : param.example_source === 'llm' ? '🤖 ai' : '👤 user' }}</span>
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
              <span class="text-amber-500 shrink-0 mt-0.5">💡</span>
              <p class="text-[12px] text-amber-800 font-medium">Examples help the AI understand how to use these actions. You can edit them now or later.</p>
            </div>
          </div>
        </div>

        <!-- Step 6: Review -->
        <div v-else-if="currentStep === 5">
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
              <strong>Note:</strong> After registration, all selected actions will be created as tools and immediately available to assign to your agents.
            </div>
          </div>
        </div>

          </section>
        </div>
      </div><!-- end scrollable body -->

      <!-- Footer -->
      <div class="shrink-0 border-t border-slate-100 bg-white px-8 py-5 flex items-center justify-between">
        <button v-if="currentStep > 0" @click="currentStep--"
          class="px-5 py-2.5 text-[14px] font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-[10px] transition-all flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          Back
        </button>
        <div v-else></div>

        <div class="flex items-center gap-3">
          <span v-if="draftSaving" class="text-[12px] font-medium text-slate-400">Saving draft…</span>
          <span v-else-if="draftSavedAt" class="text-[12px] font-medium text-emerald-600">
            Draft saved {{ draftSavedAt.toLocaleTimeString() }}
          </span>
          <button @click="saveDraft({ silent: false })" :disabled="draftSaving || !formData.name"
            class="px-4 py-2.5 text-[13px] font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-[10px] transition-all disabled:opacity-40">
            Save draft
          </button>
          <button @click="$emit('close')" class="px-5 py-2.5 text-[14px] font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-[10px] transition-all">Cancel</button>
          <button v-if="currentStep < steps.length - 1" @click="nextStep" :disabled="!canProceed"
            class="px-6 py-2.5 text-[14px] font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 rounded-[8px] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md flex items-center gap-2">
            Next
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </button>
          <button v-else @click="registerService" :disabled="registering || !canProceed"
            class="px-6 py-2.5 text-[14px] font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 rounded-[10px] transition-all disabled:opacity-40 shadow-md flex items-center gap-2">
            <svg v-if="registering" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            {{ registering ? 'Registering...' : '✅ Register Service' }}
          </button>
        </div>
      </div>

    </div><!-- end modal card -->
  </div><!-- end overlay -->
</template>


<script>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import api from '../../services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'

export default {
  name: 'ServiceRegistrationWizard',
  emits: ['registered', 'close'],
  setup(props, { emit }) {
    const currentStep = ref(0)
    const discovering = ref(false)
    const registering = ref(false)
    const enriching = ref(false)

    const discoveryMethods = [
      { value: 'openapi', icon: '📄', label: 'OpenAPI/Swagger Spec', desc: 'Automatically discover from OpenAPI 3.0 or Swagger 2.0 specification' },
      { value: 'postman', icon: '📮', label: 'Postman Collection',   desc: 'Import from Postman collection (v2.x format)' },
      { value: 'graphql', icon: '🔷', label: 'GraphQL Schema',        desc: 'Auto-discover from GraphQL endpoint using introspection' },
      { value: 'html_docs', icon: '📖', label: 'HTML Documentation', desc: 'Extract endpoints from HTML documentation (experimental)' },
      { value: 'manual',   icon: '✏️', label: 'Manual Entry',         desc: "I'll add actions manually later" }
    ]

    const steps = ['Basic Info', 'API Config', 'Authentication', 'Select Actions', 'Schema Review', 'Review']
    const stepDescriptions = [
      'Basic service information',
      'API endpoint and spec configuration',
      'How agents authenticate to this API',
      'Choose which actions to enable',
      'Review parameters, add examples, optionally enhance with AI',
      'Review and confirm'
    ]

    // Auth types the BACKEND actually supports (agent/services/service_auth.py). The wizard used to
    // hardcode auth_type:'bearer' with an empty auth_config and had no auth step at all, so every
    // service registered here had NO credential and all of its tools 401'd at call time.
    const authTypes = [
      { value: 'none',   icon: '🔓', label: 'No Auth',      desc: 'Public API — no credential needed' },
      { value: 'api_key', icon: '🔑', label: 'API Key',      desc: 'A key sent as a header or query parameter' },
      { value: 'bearer', icon: '🎟️', label: 'Bearer Token', desc: 'A static token sent as Authorization: Bearer <token>' },
      { value: 'basic',  icon: '👤', label: 'Basic Auth',   desc: 'Username and password' },
      { value: 'oauth2', icon: '🔐', label: 'OAuth 2.0',    desc: 'Per-user consent flow — each user connects their own account' }
    ]

    const formData = ref({
      name: '',
      description: '',
      category: '',
      icon: '',
      base_url: '',
      api_spec_url: '',
      discovery_method: 'openapi',
      auth_type: 'none',
      auth_config: {
        key_name: '', key_value: '', placement: 'header', prefix: '',
        token: '',
        username: '', password: '',
        authorization_url: '', token_url: '', client_id: '', client_secret: '', scopes: ''
      },
      visibility: 'private',            // 'private' (creator only) | 'public' (all workspace members)
      enable_all_workspaces: false      // link the service to every workspace in the org
    })

    // Only the fields that belong to the chosen auth type are sent; the backend drops unknown keys
    // anyway, but this keeps a stale password out of an api_key payload.
    const AUTH_FIELDS = {
      none: [],
      api_key: ['key_name', 'key_value', 'placement', 'prefix'],
      bearer: ['token'],
      basic: ['username', 'password'],
      oauth2: ['authorization_url', 'token_url', 'client_id', 'client_secret', 'scopes']
    }
    const REQUIRED_AUTH_FIELDS = {
      none: [], api_key: ['key_name', 'key_value'], bearer: ['token'],
      basic: ['username', 'password'],
      oauth2: ['authorization_url', 'token_url', 'client_id']   // client_secret optional (PKCE)
    }

    const authPayload = () => {
      const out = {}
      for (const f of (AUTH_FIELDS[formData.value.auth_type] || [])) {
        const v = formData.value.auth_config[f]
        if (v !== undefined && v !== null && v !== '') out[f] = v
      }
      return out
    }

    const missingAuthFields = computed(() =>
      (REQUIRED_AUTH_FIELDS[formData.value.auth_type] || [])
        .filter(f => !formData.value.auth_config[f]))

    const authComplete = computed(() => missingAuthFields.value.length === 0)

    // Must match `_get_callback_url` in agent/view_handlers/oauth_views.py.
    const oauthRedirectUri = computed(() => `${window.location.origin}/api/oauth/callback/`)

    const enrichJobId = ref(null)
    const enrichProgress = ref({ done: 0, total: 0, percent: 0, current: null, model: null })

    // ── Draft auto-save ──────────────────────────────────────────────────────────────────────────
    // The Drafts dialog has always promised "Drafts auto-save during registration", but THIS wizard
    // never called the endpoint — so a browser refresh or a backend restart lost everything, including
    // a completed AI enrichment pass over hundreds of actions. The wizard it replaced did auto-save;
    // consolidating onto this one dropped that, so it is restored here.
    const draftServiceId = ref(null)
    // A restored v3 draft has no inlined spec; enriching further actions needs it re-uploaded.
    const specReuploadNeeded = ref(false)
    const draftSavedAt = ref(null)
    const draftSaving = ref(false)
    let draftTimer = null

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
      // Step 2: Authentication — a declared auth type must be complete, or its tools will 401.
      if (currentStep.value === 2) {
        return authComplete.value
      }
      // Step 3: Select Actions - need at least one action selected
      if (currentStep.value === 3) {
        return getTotalSelectedActions() > 0
      }
      // Step 4: Schema Review - always can proceed
      // Step 5: Review - always can proceed
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
            notify.success(`✅ Postman collection loaded successfully! Found ${actionCount} items.`)
          } catch (error) {
            console.error('Failed to parse Postman collection:', error)
            notify.error('Failed to parse Postman collection: ' + error.message)
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
            notify.success('✅ OpenAPI spec loaded successfully!')
          } catch (error) {
            console.error('Failed to parse OpenAPI spec:', error)
            notify.error('Failed to parse OpenAPI spec: ' + error.message)
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
            notify.success('✅ GraphQL schema loaded successfully!')
          } catch (error) {
            console.error('Failed to parse GraphQL schema:', error)
            notify.error('Failed to parse GraphQL schema: ' + error.message)
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
          notify.success('✅ Documentation file loaded successfully!')
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

        // Auto-select recommended categories — AND materialize their actions.
        // Previously only `selectedCategories` was set here, so a recommended category rendered with a
        // ticked checkbox but contributed 0 to the count ("Projects ☑ 0/21"), and its actions were
        // never enriched — yet registration still created every one of them.
        const recommended = response.data.recommended_categories || []
        selectedCategories.value = []
        selectedActions.value = {}
        recommended.forEach(catName => {
          const cat = response.data.categories?.[catName]
          if (cat && cat.actions && cat.actions.length) {
            selectedCategories.value.push(catName)
            selectedActions.value[catName] = [...cat.actions]
          }
        })

      } catch (error) {
        console.error('Failed to discover actions:', error)
        notify.error('Failed to discover actions: ' + (error.response?.data?.error || error.message))
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

    // Apply one enriched action back onto the selection AND the discovery cache, so the review
    // screen and the registration payload both carry the enriched schema.
    const applyEnriched = (enrichedAction) => {
      Object.values(selectedActions.value).forEach(actions => {
        const i = (actions || []).findIndex(a => a.name === enrichedAction.name)
        if (i > -1) actions[i] = { ...actions[i], ...enrichedAction }
      })
      Object.values(discoveredData.value?.categories || {}).forEach(category => {
        const i = (category.actions || []).findIndex(a => a.name === enrichedAction.name)
        if (i > -1) category.actions[i] = { ...category.actions[i], ...enrichedAction }
      })
    }

    /**
     * Enrich EVERY selected action via the background job.
     *
     * The old flow POSTed the whole list to a synchronous endpoint that silently kept only the first
     * 20 and discarded the rest - with no way to ever reach them, since re-clicking re-sent the same
     * first 20. It also reported "Enriched: 20/20" when the backend had made zero LLM calls, because
     * a skipped enrichment returned the same shape as a successful one.
     */
    /**
     * Re-apply the caller's last enrichment run instead of paying for it again.
     *
     * Enrichment is minutes of wall-clock and ~4 LLM calls per action, but the wizard holds the result
     * in browser memory — a refresh, a stale tab, or a backend restart loses all of it while the
     * schemas are still cached server-side. Matching is by action name, so a re-discovered spec picks
     * its own work back up.
     */
    const recoverable = ref(null)

    const checkRecoverableEnrichment = async () => {
      try {
        const { data } = await api.getLatestEnrichment()
        recoverable.value = (data?.results?.length) ? data : null
      } catch (error) {
        console.debug('No recoverable enrichment:', error?.message)
        recoverable.value = null
      }
    }

    const restoreEnrichment = () => {
      const results = recoverable.value?.results || []
      if (!results.length) return
      const wanted = new Set(getSelectedActions().map(a => a.name))
      let applied = 0
      results.forEach(r => {
        if (wanted.has(r.name)) { applyEnriched(r); applied++ }
      })
      recoverable.value = null
      if (applied) {
        saveDraft()
        notify.show(`Restored ${applied} previously enriched actions — no re-run needed.`)
      } else {
        notify.error('That run does not match the actions selected here.')
      }
    }

    const enrichWithAI = async () => {
      const all = getSelectedActions()
      if (!all.length) {
        notify.error('Select at least one action first.')
        return
      }

      // Never re-enrich what a model has already done. Each action costs ~4 LLM calls, so re-sending
      // the whole selection on a second run re-bills every success to redo work that is already
      // there. Actions that were skipped or that failed carry no `enriched_by_llm`, so they ARE
      // picked up — which is what makes "run it again to cover the rest" literally true.
      let actions = all.filter(a => !a.enriched_by_llm)
      if (!actions.length) {
        if (!(await confirm(
          `All ${all.length} selected actions are already AI-enriched. Enrich them all again?`))) {
          return
        }
        actions = all
      }

      enriching.value = true
      enrichProgress.value = { done: 0, total: actions.length, percent: 0, current: null, model: null }
      try {
        const { data } = await api.startEnrichmentJob({
          service_name: formData.value.name,
          actions,
          openapi_doc: openAPISpec.value || null
        })
        enrichJobId.value = data.job_id
        enrichProgress.value.model = data.model
        await pollEnrichmentJob(data.job_id)
      } catch (error) {
        console.error('Failed to start enrichment:', error)
        const code = error.response?.data?.error
        if (code === 'no_usable_model') {
          // The exact condition that used to be reported as a green "Enriched: 20/20".
          notify.error(error.response?.data?.detail
            || 'No LLM provider is configured for this account. Add one on the AI Provider page.')
        } else {
          notify.error('Failed to start enrichment: ' + (code || error.message))
        }
        enriching.value = false
      }
    }

    const pollEnrichmentJob = async (jobId) => {
      const started = Date.now()
      const MAX_MS = 30 * 60 * 1000
      try {
        while (Date.now() - started < MAX_MS) {
          await new Promise(r => setTimeout(r, 1500))
          const { data } = await api.getEnrichmentJobStatus(jobId)
          enrichProgress.value = {
            done: data.done || 0,
            total: data.total || 0,
            percent: data.percent || 0,
            current: data.current || null,
            model: data.model || enrichProgress.value.model
          }
          if (data.state === 'done') {
            (data.results || []).forEach(applyEnriched)
            saveDraft()          // enrichment is the expensive state — make it durable at once
            const byLlm = data.enriched_by_llm || 0
            const failed = data.skipped_error || 0
            let msg = 'Enriched ' + byLlm + '/' + data.total + ' actions'
            if (data.model) msg += ' using ' + data.model
            if (failed) msg += ' - ' + failed + ' could not be enriched'
            notify.show(msg)
            return
          }
          if (data.state === 'failed') {
            // A worker restarted mid-job (a deploy) reports `worker_stopped` with the count it did
            // reach, so partial work is kept rather than the whole run being thrown away.
            if (data.error === 'worker_stopped' && (data.results || []).length) {
              (data.results || []).forEach(applyEnriched)
              saveDraft()        // keep whatever the dead worker did finish
            }
            notify.error(data.error_detail || data.error || 'Enrichment failed.')
            return
          }
        }
        notify.error('Enrichment is taking unusually long - check back on the service page.')
      } catch (error) {
        console.error('Enrichment polling failed:', error)
        notify.error('Lost track of the enrichment job: '
          + (error.response?.data?.error || error.message))
      } finally {
        enriching.value = false
        enrichJobId.value = null
      }
    }

    /**
     * Everything needed to rebuild the wizard, enriched schemas included — but NOT the raw spec.
     *
     * The uploaded OpenAPI document is ~525 KB for a real Jira spec. Shipping it on every 20s
     * autosave is megabytes of pointless upload that makes the save slow and failure-prone, and it is
     * fully recoverable by re-uploading. `discoveredData` already carries every discovered action, so
     * the spec is only needed to re-run enrichment — which the restore path handles by asking for the
     * file again. Secrets are excluded too: auth is sent separately and encrypted server-side.
     */
    const wizardSnapshot = () => {
      const { auth_config: _omitAuth, ...safeForm } = formData.value
      return {
        version: 3,
        currentStep: currentStep.value,
        formData: safeForm,
        discoveredData: discoveredData.value,
        selectedCategories: selectedCategories.value,
        selectedActions: selectedActions.value,
        expandedCategories: expandedCategories.value,
        hadSpecUpload: !!openAPISpec.value
      }
    }

    const saveDraft = async ({ silent = true } = {}) => {
      if (draftSaving.value) return
      if (!formData.value.name) return          // nothing identifiable to save yet
      draftSaving.value = true
      try {
        const { data } = await api.saveDraft({
          service_id: draftServiceId.value,
          wizard_state: wizardSnapshot(),
          current_step: currentStep.value,
          name: formData.value.name,
          description: formData.value.description,
          category: formData.value.category,
          base_url: formData.value.base_url,
          auth_type: formData.value.auth_type,
          // Secrets are encrypted server-side by service_auth before they touch the DB.
          auth_config: authPayload()
        })
        if (data?.service_id) draftServiceId.value = data.service_id
        draftSavedAt.value = new Date()
        if (!silent) notify.show('Draft saved.')
      } catch (error) {
        console.error('Draft save failed:', error)
        if (!silent) {
          notify.error('Could not save draft: '
            + (error.response?.data?.error || error.message))
        }
      } finally {
        draftSaving.value = false
      }
    }

    /** Rebuild from a previously saved draft, including any enrichment already paid for. */
    const restoreDraft = (draft) => {
      const st = draft?.wizard_state
      if (!st) return false
      draftServiceId.value = draft.id ?? draft.service_id ?? null
      if (st.formData) formData.value = { ...formData.value, ...st.formData }
      if (st.discoveredData) discoveredData.value = st.discoveredData
      if (st.selectedActions) selectedActions.value = st.selectedActions
      if (st.selectedCategories) selectedCategories.value = st.selectedCategories
      if (st.expandedCategories) expandedCategories.value = st.expandedCategories
      // v2 drafts inlined the spec; v3 deliberately does not. Re-upload is only needed to enrich
      // MORE actions — everything already enriched is restored above.
      if (st.openAPISpec) openAPISpec.value = st.openAPISpec
      if (typeof st.currentStep === 'number') currentStep.value = st.currentStep
      specReuploadNeeded.value = !openAPISpec.value && !!st.hadSpecUpload
      return true
    }

    onMounted(async () => {
      // Offer the most recent draft back rather than silently starting over.
      try {
        const { data } = await api.listDrafts()
        const latest = (data?.drafts || data || [])[0]
        if (latest && latest.wizard_state) {
          const enriched = Object.values(latest.wizard_state.selectedActions || {})
            .flat().filter(a => a?.enriched_by_llm).length
          const detail = enriched ? ` It already has ${enriched} AI-enriched actions.` : ''
          if (await confirm(`Resume your unfinished "${latest.name || 'service'}" registration?${detail}`)) {
            restoreDraft(latest)
          }
        }
      } catch (error) {
        console.debug('No draft to restore:', error?.message)
      }
      // Autosave on a timer AND on every step change (below), so the expensive state — the enriched
      // schemas — is never more than 20s from durable.
      draftTimer = setInterval(() => { saveDraft() }, 20000)
      checkRecoverableEnrichment()
    })

    onBeforeUnmount(() => {
      if (draftTimer) clearInterval(draftTimer)
      draftTimer = null
    })

    const nextStep = () => {
      if (currentStep.value < steps.length - 1) {
        currentStep.value++
        saveDraft()
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
          auth_config: authPayload(),
          discovery_method: formData.value.discovery_method,
          api_spec_url: formData.value.api_spec_url,
          visibility: formData.value.visibility,
          enable_all_workspaces: formData.value.enable_all_workspaces
        })

        const serviceId = serviceResponse.data.service_id

        // Step 2: Create EXACTLY the actions the user selected.
        //
        // This used to iterate `selectedCategories` and push every action of each category, ignoring
        // the per-action selection entirely — so a review screen showing "33 actions" registered 78,
        // including 45 the user had never seen. `selectedActions` is the single source of truth for
        // the count, the enrichment set, the review screen AND this payload.
        if (discoveredData.value) {
          const actionsToCreate = []
          Object.entries(selectedActions.value).forEach(([categoryName, actions]) => {
            (actions || []).forEach(action => {
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
          })

          if (actionsToCreate.length > 0) {
            // `expected_count` lets the backend refuse the write if this payload ever again diverges
            // from what the review screen displayed.
            await api.createServiceActions(serviceId, {
              actions: actionsToCreate,
              expected_count: actionsToCreate.length
            })
          }
        }

        if (serviceResponse.data?.requires_oauth_connect) {
          notify.show('Service registered. Open it from Connectors and click Connect to authorize '
            + 'your account before agents can use its tools.')
        } else if (serviceResponse.data?.auth_configured === false) {
          notify.show('Service registered, but its credential is incomplete — its tools will fail '
            + 'until you finish setup on the service’s Authentication tab.')
        }

        emit('registered')

      } catch (error) {
        console.error('Failed to register service:', error)
        notify.error('Failed to register service: ' + (error.response?.data?.error || error.message))
      } finally {
        registering.value = false
      }
    }

    // Every row derives from `selectedActions` — ONE source of truth. "Categories" used to be read
    // from `selectedCategories` while "Total Actions" came from `selectedActions`, so the two rows
    // described different sets (7 categories / 33 actions, then 78 registered).
    const selectedCategoryNames = computed(() =>
      Object.entries(selectedActions.value)
        .filter(([, actions]) => (actions || []).length > 0)
        .map(([name]) => name))

    const enrichedCount = computed(() =>
      getSelectedActions().filter(a => a.enriched_by_llm).length)

    // What a click would actually send — already-enriched actions are skipped.
    const pendingEnrichCount = computed(() =>
      getSelectedActions().filter(a => !a.enriched_by_llm).length)

    const reviewItems = computed(() => [
      { label: 'Name',        value: formData.value.name || '—' },
      { label: 'Category',    value: formData.value.category || 'N/A' },
      { label: 'Base URL',    value: formData.value.base_url || '—' },
      { label: 'Auth Type',   value: formData.value.auth_type || '—' },
      { label: 'Auth Status', value: formData.value.auth_type === 'none'
          ? 'No auth'
          : (formData.value.auth_type === 'oauth2'
              ? 'Client configured — connect after registering'
              : (authComplete.value ? 'Credential set' : 'Incomplete')) },
      { label: 'Categories',  value: String(selectedCategoryNames.value.length) },
      { label: 'Total Actions', value: String(getTotalSelectedActions()) },
      { label: 'AI Enriched', value: `${enrichedCount.value} / ${getTotalSelectedActions()}` }
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
      saveDraft,
      draftSavedAt,
      draftSaving,
      specReuploadNeeded,
      authTypes,
      authComplete,
      missingAuthFields,
      oauthRedirectUri,
      enrichJobId,
      enrichProgress,
      enrichedCount,
      pendingEnrichCount,
      recoverable,
      restoreEnrichment,
      selectedCategoryNames,
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
