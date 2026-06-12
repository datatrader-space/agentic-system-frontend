<template>
  <div :class="['agent-builder flex flex-col h-full bg-white w-full', layout === 'tabs' ? 'pt-14 sm:pt-16' : '']">
    <div v-if="layout === 'tabs'" class="relative z-10 p-3 sm:p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
      <div class="flex items-center gap-2 min-w-0">
        <button @click="$emit('close')" class="sm:hidden flex items-center text-gray-500 hover:text-gray-700 flex-shrink-0 -ml-1">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h2 class="font-bold text-gray-800 flex-shrink-0 text-sm sm:text-base truncate">Agent Configuration</h2>
      </div>
      <div class="flex gap-2 flex-shrink-0 ml-2 sm:ml-4">
        <button
            v-if="layout === 'canvas'"
            @click="$emit('open-workspace')"
            class="px-2.5 sm:px-3 py-1.5 border border-gray-200 text-gray-700 text-xs sm:text-sm rounded hover:bg-gray-50 flex items-center gap-1.5"
            title="Open agent workspace"
        >
            <Folder class="w-4 h-4" /> <span class="hidden sm:inline">Workspace</span>
        </button>
        <button
            @click="save"
            :disabled="isSaving"
            class="px-2.5 sm:px-3 py-1.5 bg-indigo-600 text-white text-xs sm:text-sm rounded hover:bg-indigo-700 disabled:opacity-50 min-w-[80px] sm:min-w-[100px]"
        >
            {{ isSaving ? 'Saving...' : 'Save & Publish' }}
        </button>
      </div>
    </div>


    <!-- Tabs Header (hidden in canvas layout — sections stack instead) -->
    <div v-if="layout === 'tabs'" class="flex border-b border-gray-200 px-4 shrink-0 bg-white">
        <button 
            v-for="tab in ['General', 'Knowledge', 'Tools', 'Credentials', 'Signals', 'Schedules']" 
            :key="tab"
            @click="activeTab = tab"
            :class="['px-4 py-3 text-sm font-medium border-b-2 transition-colors', activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700']"
        >
            {{ tab }}
        </button>
    </div>

    <div :class="['flex-1 overflow-y-auto p-6', layout === 'canvas' ? 'bg-gray-50' : '']">
      <div :class="layout === 'canvas' ? 'max-w-3xl mx-auto space-y-5' : 'space-y-5'">

      <!-- TAB: GENERAL -->
      <div v-if="layout === 'canvas'" id="sec-general" class="vm-anchor flex items-center gap-3 pt-1">
        <span class="w-7 h-7 rounded-lg bg-indigo-600 text-white text-sm font-bold flex items-center justify-center shrink-0">1</span>
        <div>
          <div class="text-[15px] font-bold text-gray-900 leading-tight">General</div>
          <div class="text-xs text-gray-500">Identity, model &amp; behavior</div>
        </div>
      </div>
      <div v-if="layout === 'canvas'" class="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3">
        <div class="text-xs font-semibold text-gray-600 mb-2">✨ Quick start — apply a template to the instructions</div>
        <div class="flex flex-wrap gap-2">
          <button v-for="t in agentTemplates" :key="t.key" type="button" @click="applyTemplate(t)"
            class="text-xs px-3 py-1.5 rounded-full bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition">
            {{ t.icon }} {{ t.label }}
          </button>
        </div>
      </div>
      <div v-if="layout === 'canvas' || activeTab === 'General'"
        :class="['space-y-6', layout === 'canvas' ? 'bg-white rounded-xl border border-gray-200 p-5 shadow-sm' : '']">
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

             <label class="block text-sm font-medium text-gray-700 mb-1 mt-4">Default Model</label>
             
             <!-- Model Search -->
             <input 
                v-model="modelSearchQuery"
                type="text"
                placeholder="Search models by name..."
                class="w-full px-3 py-2 mb-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
             />
             
             <!-- Model Dropdown -->
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
             
             <!-- Selected Model Info -->
             <div v-if="selectedModelInfo" class="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div class="flex items-start justify-between mb-2">
                    <div class="flex-1">
                        <div class="text-xs font-medium text-gray-700 mb-1">{{ selectedModelInfo.name }}</div>
                        <div class="text-xs text-gray-500">
                            Context: {{ selectedModelInfo.context_window?.toLocaleString() || 'N/A' }} tokens
                        </div>
                    </div>
                </div>
                
                <!-- Capabilities -->
                <div v-if="selectedModelInfo.capabilities.length > 0" class="flex flex-wrap gap-1.5 mt-2">
                    <span 
                        v-for="cap in selectedModelInfo.capabilities" 
                        :key="cap"
                        :class="['text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1', getCapabilityStyle(cap)]"
                    >
                        <span>{{ getCapabilityIcon(cap) }}</span>
                        <span>{{ formatCapability(cap) }}</span>
                    </span>
                </div>
                
                <!-- Description (if available) -->
                <div v-if="selectedModelInfo.description" class="text-xs text-gray-600 mt-2 line-clamp-2">
                    {{ selectedModelInfo.description }}
                </div>
             </div>

             <!-- Capability models (multi-model): optional per-task models the agent switches to when
                  its main model can't do something (e.g. generate an image). -->
             <div class="mt-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">
                    Capability models <span class="text-xs font-normal text-gray-400">— optional</span>
                </label>
                <p class="text-xs text-gray-500 mb-2 leading-snug">
                    Let this agent use a specialized model for a task its main model can't do — e.g.
                    generate images, or read an uploaded image. Leave on <strong>Auto</strong> to use the
                    main model, or auto-pick any capable model you've added.
                </p>
                <div class="space-y-2">
                    <div v-for="role in capabilityRoles" :key="role.key" class="flex items-center gap-2">
                        <span class="text-xs text-gray-600 w-32 shrink-0">{{ role.label }}</span>
                        <select
                            :value="internalAgent[role.key] || ''"
                            @change="internalAgent[role.key] = $event.target.value ? parseInt($event.target.value) : null"
                            class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white">
                            <option :value="null">Auto / main model</option>
                            <option v-for="m in capabilityModelOptions" :key="m.id" :value="m.id">
                                {{ m.name }}
                            </option>
                        </select>
                    </div>
                </div>
                <p v-if="!hasAnyCapabilityModels" class="text-[11px] text-amber-600 mt-2 leading-snug">
                    No active models yet. Add or enable models for your providers on the AI Providers page,
                    then pick the one to use for each task here.
                </p>
             </div>
        </div>

        <!-- Conversation Memory is hidden — every agent uses Auto (the backend fits history to the
             model's context window + summarizes older turns). max_history_messages stays at its
             default 0 (= Auto); the legacy manual cap below is kept in code but never shown. -->
        <div v-if="false" class="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div class="flex items-start justify-between gap-3">
                <div>
                    <label class="block text-sm font-medium text-gray-700">Conversation Memory</label>
                    <p class="text-xs text-gray-500 mt-0.5">
                        <template v-if="historyMode === 'auto'">
                            Auto (recommended) — managed by token budget &amp; summarization.
                        </template>
                        <template v-else>
                            Manual cap: {{ internalAgent.max_history_messages }} recent messages.
                        </template>
                    </p>
                </div>
                <button type="button" @click="showHistoryAdvanced = !showHistoryAdvanced"
                        class="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-700">
                    {{ showHistoryAdvanced ? 'Hide' : 'Advanced' }}
                </button>
            </div>

            <div v-if="showHistoryAdvanced" class="mt-3 pt-3 border-t border-gray-200">
                <div class="inline-flex rounded-md border border-gray-300 overflow-hidden mb-3">
                    <button type="button" @click="historyMode = 'auto'"
                        :class="['text-xs px-3 py-1 transition', historyMode === 'auto' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50']">
                        Auto (recommended)
                    </button>
                    <button type="button" @click="historyMode = 'manual'"
                        :class="['text-xs px-3 py-1 transition', historyMode === 'manual' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50']">
                        Manual
                    </button>
                </div>

                <div v-if="historyMode === 'manual'" class="flex items-center gap-4">
                    <input
                        type="range"
                        v-model.number="internalAgent.max_history_messages"
                        min="2"
                        max="100"
                        step="1"
                        class="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    >
                    <span class="text-sm font-mono font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg min-w-[4rem] text-center">
                        {{ internalAgent.max_history_messages || 50 }}
                    </span>
                </div>
                <p class="text-xs text-gray-500 mt-2">
                    <template v-if="historyMode === 'auto'">
                        The backend fits history to the model's context window, keeps tool-call/result pairs together, and summarizes older turns — no fixed message count to tune.
                    </template>
                    <template v-else>
                        Hard cap on recent messages sent to the LLM (a backstop — the token budget still applies). Lower = fewer tokens &amp; faster.
                    </template>
                </p>
            </div>
        </div>

        <div id="sec-prompt" class="vm-anchor">
            <label class="block text-sm font-medium text-gray-700 mb-1">
                System Prompt
                <span class="text-xs font-normal text-gray-500 ml-1">
                  {{ (internalAgent.prompt_mode || 'append') === 'append' ? '— just write your agent’s instructions' : '(advanced template with placeholders)' }}
                </span>
            </label>
            
            <!-- Prompt Mode Toggle -->
            <div class="flex items-center gap-2 mb-2">
              <span class="text-xs text-gray-500">Mode:</span>
              <div class="inline-flex rounded-md border border-gray-300 overflow-hidden">
                <button
                  @click="internalAgent.prompt_mode = 'append'"
                  :class="[
                    'text-xs px-3 py-1 transition',
                    (internalAgent.prompt_mode || 'append') === 'append'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  ]"
                  title="Tool docs are appended after your prompt"
                >
                  Append
                </button>
                <button
                  @click="internalAgent.prompt_mode = 'override'"
                  :class="[
                    'text-xs px-3 py-1 transition border-l border-gray-300',
                    internalAgent.prompt_mode === 'override'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  ]"
                  title="Your prompt is the complete system prompt. Use {{tool_protocol}} to place tool docs."
                >
                  Override
                </button>
              </div>
              <span v-if="(internalAgent.prompt_mode || 'append') === 'append'" class="text-xs text-gray-400">
                Tool docs appended after your prompt
              </span>
              <span v-else class="text-xs text-gray-400">
                Your prompt IS the system prompt — use <code class="text-indigo-500">{<!-- -->{tool_protocol}}</code> for tool docs
              </span>
            </div>
            
            <!-- APPEND (default, user-facing): nothing to insert — tools / knowledge / Code Mode are
                 added automatically on publish, based on this agent's settings. -->
            <div v-if="(internalAgent.prompt_mode || 'append') === 'append'" class="flex flex-wrap items-center gap-1.5 mb-2">
              <span class="text-xs text-gray-500">Added automatically:</span>
              <span class="text-xs px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">🛠 Tools</span>
              <span class="text-xs px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">📚 Knowledge base</span>
              <span
                :class="[
                  'text-xs px-2 py-1 rounded-full border',
                  internalAgent.code_mode_enabled
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-gray-50 border-gray-200 text-gray-400'
                ]"
                :title="internalAgent.code_mode_enabled ? 'Code Mode is ON for this agent' : 'Toggle Code Mode on in Tools to include it'"
              >⚡ Code Mode <span class="opacity-70">{{ internalAgent.code_mode_enabled ? 'on' : 'off' }}</span></span>

              <button
                @click="previewPrompt"
                :disabled="loadingPreview"
                class="ml-auto text-xs px-3 py-1 rounded-full bg-violet-100 border border-violet-300 text-violet-700 hover:bg-violet-200 transition flex items-center gap-1"
              >
                <span v-if="loadingPreview" class="animate-spin">↻</span>
                <span v-else>👁</span>
                {{ loadingPreview ? 'Loading...' : 'Preview Full Prompt' }}
              </button>
            </div>

            <!-- OVERRIDE (advanced): insertable placeholders for hand-positioning sections. -->
            <div v-else class="flex flex-wrap gap-1.5 mb-2">
              <button
                v-for="ph in placeholders"
                :key="ph.tag"
                @click="insertPlaceholder(ph.tag)"
                :class="[
                  'text-xs px-2 py-1 rounded-full border transition font-mono',
                  internalAgent.system_prompt_template?.includes(ph.tag)
                    ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                    : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600'
                ]"
                :title="ph.description"
              >
                {{ ph.tag }}
                <span v-if="internalAgent.system_prompt_template?.includes(ph.tag)" class="ml-0.5">✓</span>
              </button>

              <button
                @click="previewPrompt"
                :disabled="loadingPreview"
                class="ml-auto text-xs px-3 py-1 rounded-full bg-violet-100 border border-violet-300 text-violet-700 hover:bg-violet-200 transition flex items-center gap-1"
              >
                <span v-if="loadingPreview" class="animate-spin">↻</span>
                <span v-else>👁</span>
                {{ loadingPreview ? 'Loading...' : 'Preview Full Prompt' }}
              </button>
            </div>
            
        <div class="relative">
            <textarea 
                ref="promptTextarea"
                v-model="internalAgent.system_prompt_template"
                rows="10"
                class="w-full px-3 py-2 font-mono text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-gray-50"
                placeholder="You are a helpful assistant..."
            ></textarea>
            <div class="flex justify-between text-xs text-gray-400 mt-1 px-1">
              <span>{{ (internalAgent.system_prompt_template || '').length }} chars (~{{ Math.round((internalAgent.system_prompt_template || '').length / 4) }} tokens)</span>
              <span v-if="(internalAgent.prompt_mode || 'append') === 'append'">Tools, knowledge &amp; Code Mode are added automatically on publish</span>
              <span v-else>Use <code class="text-indigo-500">{<!-- -->{tool_protocol}}</code> where you want tool docs injected</span>
            </div>
        </div>
      </div>

      <!-- Tool delivery (per-agent overrides for cost vs. simplicity) -->
      <div class="bg-white rounded-xl border border-gray-200 p-4 mt-4">
        <h3 class="text-sm font-semibold text-gray-800 mb-1">Tool delivery</h3>
        <p class="text-xs text-gray-500 mb-3">How this agent's tools are presented to the model. Defaults follow the system setting.</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">Tool shortlist</label>
            <select v-model="internalAgent.tool_shortlist_mode"
                    class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white">
              <option value="default">Use system default</option>
              <option value="on">On — few active tools, request the rest (best with many tools)</option>
              <option value="off">Off — all assigned tools available directly (best with few tools)</option>
            </select>
            <p class="text-[11px] text-gray-400 mt-1 leading-snug">On is token-efficient for big tool sets; Off removes the request-access step.</p>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">Tool format</label>
            <select v-model="internalAgent.tool_delivery_mode"
                    class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white">
              <option value="default">Use system default</option>
              <option value="native">Native function-calling (tools array)</option>
              <option value="text">Full schemas in prompt (text protocol)</option>
            </select>
            <p class="text-[11px] text-gray-400 mt-1 leading-snug">Native uses the provider's tools API; text embeds full schemas in the prompt.</p>
          </div>
        </div>
      </div>

      <!-- Prompt Preview Modal -->
      <teleport to="body">
      <div v-if="showPromptPreview" class="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" @click.self="showPromptPreview = false">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
          <div class="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <div>
              <h3 class="font-bold text-gray-800 flex items-center gap-2">
                👁 System Prompt Preview
              </h3>
              <div v-if="promptPreviewData" class="flex gap-3 mt-1">
                <span class="text-xs text-gray-500">{{ promptPreviewData.char_count?.toLocaleString() }} chars</span>
                <span class="text-xs text-gray-500">~{{ promptPreviewData.estimated_tokens?.toLocaleString() }} tokens</span>
                <span v-for="(size, name) in promptPreviewData.sections" :key="name"
                  class="text-xs px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded"
                >
                  {{ name }}: {{ (size / 1024).toFixed(1) }}KB
                </span>
              </div>
            </div>
            <button @click="showPromptPreview = false" class="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
          </div>
          <div class="flex-1 overflow-y-auto p-4">
            <pre v-if="promptPreviewData" class="whitespace-pre-wrap text-sm font-mono text-gray-800 leading-relaxed">{{ promptPreviewData.prompt }}</pre>
            <div v-else class="text-center text-gray-400 py-8">Loading...</div>
          </div>
          <div class="p-3 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
            <span class="text-xs text-gray-500">This is exactly what the LLM receives as the system message</span>
            <div class="flex gap-2">
              <button
                @click="copyPromptPreview"
                class="px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
              >
                📋 Copy
              </button>
              <button @click="showPromptPreview = false" class="px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition">Close</button>
            </div>
          </div>
        </div>
      </div>
      </teleport>
      </div>

      </div>

      <!-- TAB: KNOWLEDGE -->
      <div v-if="layout === 'canvas'" id="sec-knowledge" class="vm-anchor flex items-center gap-3 pt-2">
        <span class="w-7 h-7 rounded-lg bg-emerald-600 text-white text-sm font-bold flex items-center justify-center shrink-0">2</span>
        <div>
          <div class="text-[15px] font-bold text-gray-900 leading-tight">Knowledge</div>
          <div class="text-xs text-gray-500">What should your agent know?</div>
        </div>
      </div>
      <div v-if="layout === 'canvas'" class="flex flex-wrap gap-2">
        <button type="button" @click="$refs.fileInput && $refs.fileInput.click()"
          class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition inline-flex items-center gap-1.5">
          <Upload class="w-4 h-4" /> Upload file
        </button>
        <button v-for="s in knowledgeSources" :key="s.key" type="button" disabled
          :title="s.label + ' — connect later (backend coming soon)'"
          :style="{ color: s.color, borderColor: s.color + '55', background: s.color + '0f' }"
          class="text-xs font-semibold px-3 py-1.5 rounded-lg border cursor-not-allowed flex items-center gap-1.5">
          <component :is="s.icon" class="w-3.5 h-3.5" /> {{ s.label }}
          <span class="ml-0.5 text-[9px] uppercase rounded px-1 py-0.5" :style="{ background: s.color + '22' }">soon</span>
        </button>
      </div>
      <div v-if="layout === 'canvas' || activeTab === 'Knowledge'"
        :class="['space-y-6', layout === 'canvas' ? 'bg-white rounded-xl border border-gray-200 p-5 shadow-sm' : '']">


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
                    v-if="layout !== 'canvas'"
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

                    <!-- RAG index status -->
                    <div v-if="fileIndex(file).stage === 'ready'" class="flex items-center gap-1.5 text-xs text-emerald-600 mt-1">
                        <span>✓</span>
                        <span>Knowledge base ready<span v-if="fileIndex(file).chunkCount"> · {{ fileIndex(file).chunkCount }} chunks indexed</span></span>
                    </div>
                    <div v-else-if="fileIndex(file).stage === 'failed'" class="text-xs text-red-600 mt-1 flex items-center gap-2">
                        <span class="truncate">⚠ {{ fileIndex(file).message || file.index_error || 'Indexing failed' }}</span>
                        <button @click.stop="retryIndex(file)" class="underline text-indigo-600 hover:text-indigo-800 shrink-0">Retry</button>
                    </div>
                    <div v-else class="mt-1.5">
                        <div class="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                            <span>{{ stageLabel(fileIndex(file).stage) }}</span>
                            <span v-if="fileIndex(file).percent">{{ fileIndex(file).percent }}%</span>
                        </div>
                        <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div class="h-full bg-indigo-500 transition-all duration-300"
                                 :class="{ 'animate-pulse': !fileIndex(file).percent }"
                                 :style="{ width: (fileIndex(file).percent || 10) + '%' }"></div>
                        </div>
                        <div v-if="fileIndex(file).message" class="text-[10px] text-gray-400 mt-1 truncate">{{ fileIndex(file).message }}</div>
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
      <div v-if="layout === 'canvas'" id="sec-tools" class="vm-anchor flex items-center gap-3 pt-2">
        <span class="w-7 h-7 rounded-lg bg-violet-600 text-white text-sm font-bold flex items-center justify-center shrink-0">3</span>
        <div>
          <div class="text-[15px] font-bold text-gray-900 leading-tight">Tools</div>
          <div class="text-xs text-gray-500">What can your agent do?</div>
        </div>
      </div>

      <!-- Connectors — assign connected connectors (GitHub/Slack/MCP/services) to THIS agent.
           Assigning a connector adds ALL its tools; refine per-tool allow/deny on the Connectors page. -->
      <div v-if="(layout === 'canvas' || activeTab === 'Tools')"
        :class="['space-y-3', layout === 'canvas' ? 'bg-white rounded-xl border border-gray-200 p-5 shadow-sm' : '']">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2 min-w-0">
            <div class="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center text-violet-700 shrink-0">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
            </div>
            <div class="min-w-0">
              <div class="text-sm font-semibold text-gray-800">Connectors</div>
              <div class="text-xs text-gray-500">Assign a connected connector — its tools are added to this agent.</div>
            </div>
          </div>
          <button type="button" @click="openConnectorsHub"
            class="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 transition-colors shrink-0 inline-flex items-center gap-1.5">
            <Icon icon="lucide:search" class="w-3.5 h-3.5" /> Browse &amp; connect
          </button>
        </div>

        <p v-if="connectorsLoading" class="text-xs text-gray-400 py-2">Loading connectors…</p>
        <div v-else-if="!connectedConnectors.length" class="rounded-lg border border-dashed border-gray-200 bg-gray-50/60 px-4 py-5 text-center">
          <p class="text-[13px] font-medium text-gray-600">No connected connectors yet</p>
          <p class="text-[11px] text-gray-400 mt-0.5">Connect GitHub, Slack, an MCP server, or a service, then assign it here.</p>
          <button type="button" @click="openConnectorsHub" class="mt-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100">Browse &amp; connect</button>
        </div>
        <div v-else>
          <!-- Up to 5 shown; expand to a scrollable list for the rest. -->
          <div :class="['space-y-2', showAllConnectors ? 'max-h-72 overflow-y-auto pr-1' : '']">
            <div v-for="c in displayedConnectors" :key="c.kind + ':' + c.id"
              class="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5 hover:border-violet-200 transition-colors">
              <Icon v-if="c.icon && c.icon.includes(':')" :icon="c.icon" class="w-7 h-7 shrink-0" />
              <span v-else class="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">{{ (c.name||'?').charAt(0) }}</span>
              <div class="min-w-0 flex-1">
                <div class="text-[13px] font-semibold text-gray-800 truncate">{{ c.name }}</div>
                <div class="text-[11px] text-gray-400 truncate">
                  {{ connectorKindLabel(c) }} · {{ connectorTools(c).length }} tools
                  <span v-if="connectorTools(c).length === 0" class="text-amber-500">(none synced yet)</span>
                </div>
              </div>
              <button type="button" @click="toggleConnector(c)" :disabled="!connectorTools(c).length"
                :class="['px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors shrink-0 disabled:opacity-40',
                  connectorAssigned(c) ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                                       : 'text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200']">
                {{ connectorAssigned(c) ? '✓ Assigned' : 'Assign' }}
              </button>
            </div>
          </div>
          <button v-if="connectedConnectors.length > 5" type="button" @click="showAllConnectors = !showAllConnectors"
            class="mt-2 text-[12px] font-semibold text-violet-600 hover:underline">
            {{ showAllConnectors ? 'Show less' : `Show ${connectedConnectors.length - 5} more` }}
          </button>
          <p class="text-[11px] text-gray-400 pt-1.5">Fine-tune per-tool allow / ask / deny on the <button type="button" @click="openConnectorsHub" class="text-violet-600 font-semibold hover:underline">Connectors page</button> (this agent's scope).</p>
        </div>
      </div>

      <div v-if="layout === 'canvas' || activeTab === 'Tools'"
        :class="['space-y-6', layout === 'canvas' ? 'bg-white rounded-xl border border-gray-200 p-5 shadow-sm' : '']">

      <!-- Code Mode Toggle -->
      <div class="bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-xl p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center text-lg">⚡</div>
            <div>
              <div class="text-sm font-semibold text-gray-800">Code Mode</div>
              <div class="text-xs text-gray-500 mt-0.5">Replace individual API tools with search + execute meta-tools</div>
            </div>
          </div>
          <button 
            @click="internalAgent.code_mode_enabled = !internalAgent.code_mode_enabled"
            :class="[
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2',
              internalAgent.code_mode_enabled ? 'bg-violet-600' : 'bg-gray-300'
            ]"
          >
            <span
              :class="[
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm',
                internalAgent.code_mode_enabled ? 'translate-x-6' : 'translate-x-1'
              ]"
            />
          </button>
        </div>
        
        <!-- Expanded info when enabled -->
        <div v-if="internalAgent.code_mode_enabled" class="mt-3 pt-3 border-t border-violet-200/60">
          <div class="flex items-start gap-2 text-xs text-gray-600">
            <span class="text-violet-500 mt-0.5">ℹ</span>
            <div>
              <p class="mb-1">When enabled, the agent uses <strong>CODE_MODE_SEARCH</strong> to discover API endpoints and <strong>CODE_MODE_EXECUTE</strong> to run authenticated Python code — instead of loading hundreds of individual tools.</p>
              <p class="text-gray-400">Reduces context window usage by ~90%. Requires valid service credentials.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Builder Mode Toggle (Admin only) -->
      <div class="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-lg">🏗️</div>
            <div>
              <div class="text-sm font-semibold text-gray-800">Builder Mode</div>
              <div class="text-xs text-gray-500 mt-0.5">Agent can register OAuth providers during conversations</div>
            </div>
          </div>
          <button 
            @click="internalAgent.builder_mode_enabled = !internalAgent.builder_mode_enabled"
            :class="[
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2',
              internalAgent.builder_mode_enabled ? 'bg-amber-600' : 'bg-gray-300'
            ]"
          >
            <span
              :class="[
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm',
                internalAgent.builder_mode_enabled ? 'translate-x-6' : 'translate-x-1'
              ]"
            />
          </button>
        </div>
        
        <!-- Expanded info when enabled -->
        <div v-if="internalAgent.builder_mode_enabled" class="mt-3 pt-3 border-t border-amber-200/60">
          <div class="flex items-start gap-2 text-xs text-gray-600">
            <span class="text-amber-500 mt-0.5">ℹ</span>
            <div>
              <p class="mb-1">When enabled, the agent can use <strong>SETUP_SERVICE_AUTH</strong> to prompt the user to connect a service (available to everyone), and <strong>REGISTER_OAUTH_PROVIDER</strong> to register new OAuth providers (admin only).</p>
              <p class="text-gray-400">The agent never sees the actual credentials. New providers are created disabled until client credentials are added.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Autonomy & safety (v3) -->
      <div id="sec-autonomy" class="vm-anchor">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-semibold text-gray-900">Autonomy &amp; safety</h3>
          <span :class="['text-[11px] font-medium px-2 py-0.5 rounded-full', autonomyBadgeClass]">{{ autonomyLabel }}</span>
        </div>

        <div class="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 shadow-sm overflow-hidden">
          <!-- Auto Mode -->
          <div class="flex items-start justify-between gap-4 p-4">
            <div class="flex items-start gap-3 min-w-0">
              <div class="mt-0.5 w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Zap class="w-[18px] h-[18px]" />
              </div>
              <div class="min-w-0">
                <div class="text-sm font-medium text-gray-900">Auto Mode</div>
                <p class="text-xs text-gray-500 mt-0.5 leading-relaxed">Runs tools automatically, including scheduled runs. Risky actions are reviewed by the AI safety policy instead of waiting for your approval.</p>
              </div>
            </div>
            <button type="button" role="switch" :aria-checked="internalAgent.execution_mode === 'autonomous'"
              @click="toggleAutoMode()"
              :class="['relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500',
                       internalAgent.execution_mode === 'autonomous' ? 'bg-teal-600' : 'bg-gray-200']">
              <span :class="['inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
                             internalAgent.execution_mode === 'autonomous' ? 'translate-x-[22px]' : 'translate-x-0.5']" />
            </button>
          </div>

          <!-- Planning Mode -->
          <div class="p-4">
            <div class="flex items-start justify-between gap-4">
              <div class="flex items-start gap-3 min-w-0">
                <div class="mt-0.5 w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <ClipboardList class="w-[18px] h-[18px]" />
                </div>
                <div class="min-w-0">
                  <div class="text-sm font-medium text-gray-900">Planning Mode</div>
                  <p class="text-xs text-gray-500 mt-0.5 leading-relaxed">The agent drafts a plan and gets it approved before taking any action.</p>
                </div>
              </div>
              <button type="button" role="switch" :aria-checked="internalAgent.plan_mode_enabled"
                @click="internalAgent.plan_mode_enabled = !internalAgent.plan_mode_enabled"
                :class="['relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500',
                         internalAgent.plan_mode_enabled ? 'bg-indigo-600' : 'bg-gray-200']">
                <span :class="['inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
                               internalAgent.plan_mode_enabled ? 'translate-x-[22px]' : 'translate-x-0.5']" />
              </button>
            </div>
            <label v-if="internalAgent.plan_mode_enabled" class="mt-3 ml-12 flex items-start gap-2.5 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" v-model="internalAgent.plan_approval_required"
                class="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
              <span>Require plan approval. <span class="text-gray-400">Off + Auto Mode → the AI policy reviews the plan automatically.</span></span>
            </label>
          </div>

          <!-- Checkpoints (advanced, collapsed) -->
          <div class="bg-gray-50/70">
            <button type="button" @click="showCheckpoints = !showCheckpoints"
              class="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-100/60 transition-colors">
              <span class="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Checkpoints · Advanced</span>
              <ChevronDown :class="['w-4 h-4 text-gray-400 transition-transform', showCheckpoints ? 'rotate-180' : '']" />
            </button>
            <div v-if="showCheckpoints" class="px-4 pb-4 space-y-3">
              <div class="flex items-center justify-between gap-4">
                <div class="min-w-0">
                  <div class="text-xs font-medium text-gray-700">Pause every N tool calls</div>
                  <div class="text-[11px] text-gray-400 mt-0.5">Leave blank to disable.</div>
                </div>
                <input type="number" min="1" v-model.number="internalAgent.checkpoint_every_n_steps"
                       class="w-20 px-2.5 py-1.5 text-sm text-gray-800 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none" placeholder="Off" />
              </div>
              <label class="flex items-start gap-2.5 text-xs text-gray-700 cursor-pointer">
                <input type="checkbox" v-model="internalAgent.checkpoint_on_phase_boundary"
                  class="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                <span>Pause between plan phases <span class="text-gray-400">(Phase Gate)</span></span>
              </label>
              <label class="flex items-start gap-2.5 text-xs text-gray-700 cursor-pointer">
                <input type="checkbox" v-model="internalAgent.verify_after_completion"
                  class="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                <span>Verify work after completion <span class="text-gray-400">(self-check + summary)</span></span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Rules + Policy add-on: soft Behavioral Rules (guidance), separated from enforced policy -->
      <div class="bg-white border border-gray-200 rounded-xl p-4">
        <AgentRulesEditor v-model="internalAgent.agent_rules" />
      </div>

      <!-- Integrations (WebSocket / Webhook / Public widget) live in the top-bar "Deploy" panel
           for the canvas layout — no inline duplicate here. -->

      <!-- Tools — canvas: new ToolPicker; tabs/drawer: legacy list -->
      <div v-if="layout === 'canvas'">
        <div class="flex items-center justify-between mb-2">
          <label class="block text-sm font-medium text-gray-700">Capabilities (Tools)</label>
          <span class="text-xs text-gray-500">{{ selectedToolsCount }} selected</span>
        </div>
        <ToolPicker v-model="internalAgent.tool_ids" :tools="availableTools" />
      </div>
      <div v-if="layout === 'tabs'">
        <div class="flex justify-between items-center mb-2">
             <label class="block text-sm font-medium text-gray-700">Capabilities (Tools)</label>
             <div class="flex items-center gap-3">
               <span class="text-xs text-gray-500">{{ selectedToolsCount }} selected</span>
               <!-- View Mode Toggle -->
               <div class="flex gap-1 bg-gray-100 rounded p-0.5">
                 <button
                   @click="toolsViewMode = 'selected'"
                   :class="[
                     'px-2 py-1 text-xs font-medium rounded transition',
                     toolsViewMode === 'selected' 
                       ? 'bg-white text-indigo-700 shadow-sm' 
                       : 'text-gray-600 hover:text-gray-800'
                   ]"
                 >
                   Selected ({{ selectedToolsCount }})
                 </button>
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
        <div class="mb-3 relative">
            <input
                v-model="toolSearchQuery"
                type="text"
                :placeholder="toolsViewMode === 'selected' ? 'Search selected tools...' : 'Search tools by name or description...'"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none pr-8"
            />
            <button 
              v-if="toolSearchQuery" 
              @click="toolSearchQuery = ''" 
              class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg"
            >×</button>
        </div>

        <!-- Bulk Action Bar (appears when searching) -->
        <div v-if="toolSearchQuery && !loadingTools" class="mb-2 flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
          <span class="text-xs text-indigo-700">
            {{ currentFilteredToolIds.length }} tools match "{{ toolSearchQuery }}"
          </span>
          <div class="flex gap-2">
            <button
              @click="selectAllFiltered"
              class="text-xs px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition font-medium"
            >
              Select All {{ currentFilteredToolIds.length }}
            </button>
            <button
              @click="deselectAllFiltered"
              class="text-xs px-3 py-1 bg-white text-indigo-700 border border-indigo-300 rounded hover:bg-indigo-100 transition font-medium"
            >
              Deselect All {{ currentFilteredToolIds.length }}
            </button>
          </div>
        </div>

        <div class="border border-gray-200 rounded-lg max-h-[600px] overflow-y-auto">
            <div v-if="loadingTools" class="p-4 text-center text-sm text-gray-500">Loading tools...</div>

            <!-- SELECTED VIEW -->
            <div v-else-if="toolsViewMode === 'selected'">
              <div v-if="selectedToolsList.length === 0" class="p-8 text-center">
                <div class="text-3xl mb-3">🔧</div>
                <p class="text-sm text-gray-600 font-medium mb-1">No tools assigned yet</p>
                <p class="text-xs text-gray-500 mb-3">Switch to "By Category" or "By Service" to browse and add tools</p>
                <button
                  @click="toolsViewMode = 'category'"
                  class="px-4 py-2 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 font-medium"
                >
                  Browse Tools
                </button>
              </div>
              <div v-else class="divide-y divide-gray-100">
                <div
                  v-for="tool in filteredSelectedTools"
                  :key="tool.id"
                  class="flex items-start p-3 hover:bg-red-50 cursor-pointer transition group"
                  @click="toggleTool(tool.id)"
                >
                  <div class="flex items-center h-5">
                    <input
                      type="checkbox"
                      :checked="true"
                      class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                  </div>
                  <div class="ml-3 text-sm flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <label class="font-medium text-gray-700 cursor-pointer truncate">{{ tool.name }}</label>
                      <span v-if="tool.category" class="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded flex-shrink-0">{{ tool.category }}</span>
                    </div>
                    <p class="text-gray-500 text-xs mt-0.5 line-clamp-1">{{ tool.description }}</p>
                  </div>
                  <button
                    class="text-xs text-red-400 opacity-0 group-hover:opacity-100 transition flex-shrink-0 ml-2 hover:text-red-600"
                    title="Remove tool"
                  >
                    remove
                  </button>
                </div>
              </div>
            </div>

            <!-- SERVICE VIEW -->
            <div v-else-if="toolsViewMode === 'service' && groupedFilteredToolsByService.length > 0">
              <div v-for="service in groupedFilteredToolsByService" :key="service.id" class="border-b border-gray-100 last:border-b-0">
                <!-- Service Header (clickable to expand/collapse) -->
                <div
                  class="bg-gray-50 px-3 py-2.5 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition select-none"
                  @click="toggleServiceExpand(service.id)"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <svg
                        class="w-3.5 h-3.5 text-gray-400 transition-transform duration-200"
                        :class="{ 'rotate-90': expandedServices[service.id] }"
                        fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                      <span class="text-xs font-semibold text-gray-700">{{ service.name }}</span>
                      <!-- Selected count badge -->
                      <span
                        v-if="countSelectedInService(service.tools) > 0"
                        class="text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-medium"
                      >
                        {{ countSelectedInService(service.tools) }}/{{ service.tools.length }}
                      </span>
                      <!-- Credential Badge -->
                      <span
                        v-if="service.hasCredentials && !service.isMcp && !service.isBuiltin"
                        class="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-medium"
                      >
                        ✓ Credentials
                      </span>
                      <span
                        v-else-if="!service.hasCredentials && !service.isMcp && !service.isBuiltin"
                        class="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium"
                      >
                        ⚠ No Credentials
                      </span>
                    </div>
                    <div class="flex items-center gap-2">
                      <button 
                        @click.stop="toggleServiceTools(service.tools)" 
                        class="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium px-1.5 py-0.5 rounded hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition"
                      >
                        {{ areAllServiceToolsSelected(service.tools) ? 'Deselect All' : 'Add All' }}
                      </button>
                      <span class="text-xs text-gray-400">{{ service.tools.length }}</span>
                    </div>
                  </div>
                </div>

                <!-- Tools in this service (collapsible) -->
                <div v-show="expandedServices[service.id]" class="divide-y divide-gray-100">
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
                    <div class="bg-gray-50 px-3 py-2 border-b border-gray-200 sticky top-0 z-10">
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
                  <p class="font-medium text-gray-700 mb-2">No services found</p>
                  <p class="text-xs mb-3">
                    Tools need service metadata. Try searching by category instead.
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
      <div v-if="layout === 'canvas'" id="sec-advanced" class="vm-anchor pt-8 mt-4 border-t-2 border-gray-200">
        <span class="text-xs font-bold uppercase tracking-wide text-gray-400">Advanced</span>
      </div>
      <h3 v-if="layout === 'canvas'" class="text-sm font-bold text-gray-800 pt-1">Credentials</h3>
      <div v-if="layout === 'canvas' || activeTab === 'Credentials'"
        :class="['space-y-6', layout === 'canvas' ? 'bg-white rounded-xl border border-gray-200 p-5 shadow-sm' : '']">
          <!-- Service & Built-in Tool Credentials -->
          <div class="border border-gray-200 rounded-lg overflow-hidden bg-white max-h-[600px] overflow-y-auto">
            <!-- Reuse the standalone component which supports both Service and Built-in tools -->
            <CredentialManager :agent-profile="internalAgent" />
          </div>
      </div>

      <!-- (Old per-agent "MCP Servers" credential section removed — MCP is now managed as a
           connector on the Connectors page; assign it to the agent in the Connectors section above.) -->

      <!-- (Communication Channels section removed.) -->
      <!-- Canvas shows Signal Processing inside the Tools section (above); this
           remains only for the legacy tabbed layout's "Signals" tab. -->
      <div v-if="activeTab === 'Signals'">
        <SignalPanel :agent="internalAgent" />
      </div>

      <!-- TAB: SCHEDULES -->
      <h3 v-if="layout === 'canvas'" class="text-sm font-bold text-gray-800 pt-3">Automation &amp; Schedules</h3>
      <div v-if="layout === 'canvas' || activeTab === 'Schedules'"
        :class="layout === 'canvas' ? 'bg-white rounded-xl border border-gray-200 p-5 shadow-sm' : ''">
        <SchedulePanel :agent="internalAgent" />
      </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { marked } from 'marked';
import api from '../services/api';
import CredentialManager from './tools/CredentialManager.vue';
import AgentRulesEditor from './agent/AgentRulesEditor.vue';
import { MAX_RULE_LEN as RULE_MAX_LEN, MAX_RULES as RULE_MAX_COUNT, cleanRules as cleanAgentRules, rulesValid as agentRulesValid } from './agent/agentRules';
import SchedulePanel from './SchedulePanel.vue';
import ToolPicker from './ToolPicker.vue';
import SignalPanel from './SignalPanel.vue';
import { Upload, Globe, Table2, Search, Type, FileText, Braces, Folder, Zap, ClipboardList, ChevronDown } from 'lucide-vue-next';
import { modeKey, modeLabel } from '../composables/agentModes';
import { Icon } from '@iconify/vue';
import { notify } from '@/composables/useNotify';
import { confirm } from '@/composables/useConfirm';

const props = defineProps({
    agent: {
        type: Object,
        required: true
    },
    isSaving: {
        type: Boolean,
        default: false
    },
    // 'tabs' (default, legacy drawer) | 'canvas' (single-scroll builder — Phase 1 UI upgrade)
    layout: {
        type: String,
        default: 'tabs'
    },
    // Awaitable persist function from the host page (AgentBuilderCanvas.saveAgent).
    // Returns the saved agent (with id) or null. Enables lazy draft-on-demand so
    // features that need an agent id (file upload, prompt preview) work on /new.
    saveFn: {
        type: Function,
        default: null
    }
});

const emit = defineEmits(['update:agent', 'save', 'close', 'open-workspace', 'dirty']);

// Local copy for editing
const internalAgent = ref({
    default_model: null,  // Ensure this property exists for Vue reactivity
    // Capability roster (multi-model) — optional per-task models (null = auto / main model).
    image_model: null,
    vision_model: null,
    audio_model: null,
    video_model: null,
    code_mode_enabled: false,  // Code Mode: search+execute vs individual tools
    code_mode_services: [],    // RemoteService IDs (empty = all credentialed)
    builder_mode_enabled: false,  // Builder Mode: agent can register OAuth providers
    // Autonomous execution (v3) — defaults match the backend (manual / OFF).
    execution_mode: 'manual',
    plan_mode_enabled: false,
    plan_approval_required: true,
    checkpoint_every_n_steps: null,
    checkpoint_on_phase_boundary: false,
    verify_after_completion: false,
    // Rules + Policy add-on. Soft `agent_rules` is editable here. Per-agent hard `agent_policy` is
    // EMPTY by default (no-op) — org-wide guardrails live in GlobalAgentPolicy; an admin tightens a
    // single agent via the Django admin. Matches the backend default ({}).
    agent_rules: [],
    agent_policy: {},
    ...props.agent
});

// Autonomy section: a small badge that reflects the resulting mode (Manual / Auto / Plan / Plan + Auto),
// and a collapsed-by-default Advanced (checkpoints) sub-section.
const showCheckpoints = ref(false);
const autonomyMode = computed(() => modeKey(internalAgent.value.execution_mode, internalAgent.value.plan_mode_enabled));
const autonomyLabel = computed(() => modeLabel(internalAgent.value.execution_mode, internalAgent.value.plan_mode_enabled));
const autonomyBadgeClass = computed(() => ({
  manual: 'bg-gray-100 text-gray-600',
  auto: 'bg-teal-50 text-teal-700',
  plan: 'bg-indigo-50 text-indigo-700',
  plan_auto: 'bg-violet-50 text-violet-700',
}[autonomyMode.value] || 'bg-gray-100 text-gray-600'));

// Auto Mode toggle (with a confirm before enabling autonomous execution).
async function toggleAutoMode() {
    if (internalAgent.value.execution_mode === 'autonomous') {
        internalAgent.value.execution_mode = 'manual';
        return;
    }
    const ok = await confirm({
        title: 'Enable Auto Mode?',
        message: 'This agent will choose and run tools automatically, including during scheduled runs. Risky actions are reviewed by the AI safety policy instead of waiting for your approval.',
        confirmText: 'Enable Auto Mode',
    });
    if (ok) internalAgent.value.execution_mode = 'autonomous';
}

// Conversation memory: Auto (max_history_messages = 0/null, backend manages by token
// budget + summarization) vs Manual (an explicit recent-message cap). Hidden under Advanced.
const showHistoryAdvanced = ref(false);
const historyMode = computed({
    get: () => ((internalAgent.value.max_history_messages || 0) > 0 ? 'manual' : 'auto'),
    set: (mode) => {
        if (mode === 'auto') {
            internalAgent.value.max_history_messages = 0;  // 0 = Auto (backend default)
        } else if ((internalAgent.value.max_history_messages || 0) <= 0) {
            internalAgent.value.max_history_messages = 50;  // seed a sensible manual value
        }
    },
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
const modelSearchQuery = ref(''); // NEW: for model search
const activeTab = ref('General');
const toolsViewMode = ref('selected'); // 'selected', 'category' or 'service'
const expandedServices = ref({}); // Track which service groups are expanded

// Credentials state (maintained for tool badges)
const credentials = ref([]);

// MCP Credentials state
const mcpServers = ref([]);
const selectedMcpServerId = ref('');
const mcpCredentials = ref([]);
const mcpCredentialEntries = ref([{ key: '', value: '' }]);
const savingMcpCredential = ref(false);
const mcpCredentialMessage = ref('');
const mcpCredentialError = ref(false);

// Prompt preview state
const promptTextarea = ref(null);
const showPromptPreview = ref(false);
const loadingPreview = ref(false);
const promptPreviewData = ref(null);
// Advanced (Override-mode only) placeholders for power users who want to position sections by hand.
// In the default Append mode these never appear — tools/knowledge/Code Mode are auto-injected.
const placeholders = [
    { tag: '{{tools}}', description: 'List of assigned tool names and descriptions' },
    { tag: '{{knowledge}}', description: 'Knowledge context from uploaded files' },
    { tag: '{{tool_protocol}}', description: 'Full tool call protocol and documentation' },
    { tag: '{{code_mode}}', description: 'Code mode instructions (if enabled)' },
];

const scopes = [
    { value: 'system', label: 'Full System' },
    { value: 'repository', label: 'Repository' },
    { value: 'none', label: 'None' }
];

// ── Canvas (Phase 3) — quick-start templates ──
// Each template can pre-fill the agent by domain: instructions (always), plus name +
// description (only when empty, never clobbering the user's text) and a set of related
// tools matched against the agent's available tools by keyword.
const agentTemplates = [
    {
        key: 'blank', icon: '✨', label: 'Blank',
        prompt: 'You are a helpful AI assistant.',
    },
    {
        key: 'support', icon: '🎧', label: 'Support',
        name: 'Customer Support Agent',
        description: 'Answers customer questions from the knowledge base and escalates to a human when it can’t help.',
        prompt: 'You are a friendly customer-support assistant.\n- Answer only from the connected Knowledge base.\n- If you can\'t find the answer, say so and offer to connect a human.\n- Keep replies short and clear.',
        toolKeywords: ['email', 'slack', 'ticket', 'zendesk', 'intercom', 'message', 'notify', 'communication'],
    },
    {
        key: 'coding', icon: '💻', label: 'Coding',
        name: 'Coding Assistant',
        description: 'Helps with code, debugging, and reviews using filesystem and execution tools.',
        prompt: 'You are an expert coding assistant.\n- Help with code, debugging, and reviews.\n- Prefer minimal, correct, well-explained changes.\n- Use the available tools to inspect and run code when needed.',
        toolKeywords: ['file', 'code', 'shell', 'execute', 'terminal', 'git', 'repo', 'filesystem', 'python', 'run', 'command'],
    },
    {
        key: 'research', icon: '🔎', label: 'Research',
        name: 'Research Assistant',
        description: 'Gathers, verifies, and synthesizes information with sources and citations.',
        prompt: 'You are a research assistant.\n- Gather, verify, and synthesize information.\n- Cite sources and flag uncertainty.\n- Use web/search tools when available.',
        toolKeywords: ['web', 'search', 'browse', 'scrape', 'http', 'fetch', 'wiki', 'google', 'crawl', 'url'],
    },
    {
        key: 'store', icon: '🛒', label: 'Store assistant',
        name: 'Store Assistant',
        description: 'Helps customers find products and answer questions for your online shop.',
        prompt: 'You are a store assistant for an online shop.\n- Help customers find products and answer questions from the Knowledge base.\n- Be concise and friendly; suggest relevant items.',
        toolKeywords: ['shop', 'product', 'order', 'cart', 'stripe', 'payment', 'ecommerce', 'commerce', 'shopify', 'inventory', 'checkout'],
    },
];

// Match the agent's available tools to a template's keywords (name/category/labels).
function matchToolsForTemplate(t, cap = 12) {
    const kws = (t.toolKeywords || []).map(k => k.toLowerCase());
    if (!kws.length) return [];
    const ids = [];
    for (const tool of (availableTools.value || [])) {
        const hay = [tool.name, tool.category, tool.display_name, tool.category_label]
            .filter(Boolean).join(' ').toLowerCase();
        if (kws.some(k => hay.includes(k))) ids.push(tool.id);
        if (ids.length >= cap) break;
    }
    return ids;
}

const applyTemplate = async (t) => {
    if (!t) return;
    const cur = (internalAgent.value.system_prompt_template || '').trim();
    if (cur && !(await confirm({
        title: 'Apply template?',
        message: `Apply the "${t.label}" template? This sets the instructions, fills in any empty name/description, and adds related tools.`,
        confirmText: 'Apply',
        danger: true,
    }))) return;

    // Instructions — always set from the template.
    internalAgent.value.system_prompt_template = t.prompt;

    // Name + description — only fill when empty, so we never overwrite the user's own text.
    if (t.name && !(internalAgent.value.name || '').trim()) internalAgent.value.name = t.name;
    if (t.description && !(internalAgent.value.description || '').trim()) internalAgent.value.description = t.description;

    // Related tools — add matches on top of any the user already selected (additive).
    const matched = matchToolsForTemplate(t);
    if (matched.length) {
        const set = new Set(internalAgent.value.tool_ids || []);
        matched.forEach(id => set.add(id));
        internalAgent.value.tool_ids = [...set];
    }

    const parts = ['instructions'];
    if (t.name) parts.push('name & description');
    if (matched.length) parts.push(`${matched.length} tool${matched.length === 1 ? '' : 's'}`);
    notify.success(`Applied “${t.label}” template — ${parts.join(', ')}.`);
};

// ── Canvas (Phase 3) — knowledge source types (UI-first; non-upload = connect later) ──
const knowledgeSources = [
    { key: 'website', icon: Globe, label: 'Website', color: '#2563eb' },
    { key: 'table', icon: Table2, label: 'Table', color: '#059669' },
    { key: 'websearch', icon: Search, label: 'Web Search', color: '#475569' },
    { key: 'richtext', icon: Type, label: 'Rich Text', color: '#dc2626' },
    { key: 'notion', icon: FileText, label: 'Notion', color: '#111827' },
    { key: 'api', icon: Braces, label: 'API', color: '#2563EB' },
];

// ── Canvas — channels: live rows + coming-soon chips (Iconify brand logos) ──
const channelRows = [
    { key: 'webhook', icon: 'lucide:webhook', label: 'Webhook', live: true },
    { key: 'websocket', icon: 'lucide:radio', label: 'WebSocket', live: true },
    { key: 'redis', icon: 'logos:redis', label: 'Redis Stream', live: true },
    { key: 'whatsapp', icon: 'logos:whatsapp-icon', label: 'WhatsApp', live: false },
    { key: 'slack', icon: 'logos:slack-icon', label: 'Slack', live: false, error: true },
];
const channelChips = [
    { key: 'telegram', icon: 'logos:telegram', label: 'Telegram' },
    { key: 'instagram', icon: 'logos:instagram-icon', label: 'Instagram' },
    { key: 'messenger', icon: 'logos:messenger', label: 'Messenger' },
    { key: 'more', icon: '', label: '··· More' },
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

// Selected tools list: tools that are currently assigned
const selectedToolsList = computed(() => {
    if (!internalAgent.value.tool_ids || internalAgent.value.tool_ids.length === 0) return [];
    const ids = new Set(internalAgent.value.tool_ids);
    return availableTools.value.filter(tool => ids.has(tool.id));
});

// Filtered selected tools (apply search to selected view)
const filteredSelectedTools = computed(() => {
    const query = toolSearchQuery.value.toLowerCase().trim();
    if (!query) return selectedToolsList.value;
    return selectedToolsList.value.filter(tool =>
        tool.name.toLowerCase().includes(query) ||
        (tool.description && tool.description.toLowerCase().includes(query))
    );
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
    
    // Pre-compute known MCP server prefixes from loaded mcpServers
    const knownPrefixes = [];
    for (const srv of mcpServers.value) {
        if (srv.slug) {
            const normalized = srv.slug.toUpperCase().replace(/-/g, '_').replace(/ /g, '_');
            knownPrefixes.push({
                prefix: normalized + '_',
                name: srv.name || srv.slug,
                slug: normalized,
            });
        }
    }
    // Sort by longest prefix first for greedy matching
    knownPrefixes.sort((a, b) => b.prefix.length - a.prefix.length);
    
    // First pass: collect all MCP tools and group them
    const mcpTools = [];
    const nonMcpTools = [];
    
    filtered.forEach(tool => {
        if (tool.name && tool.name.startsWith('MCP_')) {
            mcpTools.push(tool);
        } else {
            nonMcpTools.push(tool);
        }
    });
    
    // For MCP tools: try known prefixes first, then auto-discover groups from shared prefixes
    const mcpGrouped = {}; // prefix -> { name, tools }
    const unmatched = [];  // tools that didn't match any known prefix
    
    mcpTools.forEach(tool => {
        const suffix = tool.name.substring(4); // Remove "MCP_"
        
        // Try matching known server prefixes
        let matched = false;
        for (const kp of knownPrefixes) {
            if (suffix.startsWith(kp.prefix)) {
                if (!mcpGrouped[kp.slug]) {
                    mcpGrouped[kp.slug] = { name: kp.name, tools: [] };
                }
                mcpGrouped[kp.slug].tools.push(tool);
                matched = true;
                break;
            }
        }
        
        if (!matched) {
            unmatched.push(tool);
        }
    });
    
    // Auto-discover groups for unmatched MCP tools using shared prefix detection
    if (unmatched.length > 0) {
        // Extract all suffixes (after MCP_)
        const suffixes = unmatched.map(t => t.name.substring(4));
        
        // Find common prefixes: for each pair, find the prefix they share up to an underscore boundary
        const prefixCounts = {};
        
        suffixes.forEach(s => {
            // Try progressively shorter prefixes (split by underscore)
            const parts = s.split('_');
            for (let i = 1; i < parts.length; i++) {
                const prefix = parts.slice(0, i).join('_') + '_';
                prefixCounts[prefix] = (prefixCounts[prefix] || 0) + 1;
            }
        });
        
        // Find the best prefix for each tool: the longest prefix that matches 2+ tools
        // Sort prefixes by length descending
        const validPrefixes = Object.entries(prefixCounts)
            .filter(([, count]) => count >= 2)
            .sort(([a], [b]) => b.length - a.length);
        
        unmatched.forEach(tool => {
            const suffix = tool.name.substring(4);
            let found = false;
            
            for (const [prefix] of validPrefixes) {
                if (suffix.startsWith(prefix)) {
                    const slug = prefix.slice(0, -1); // Remove trailing _
                    if (!mcpGrouped[slug]) {
                        const nameParts = slug.split('_').map(p => p.charAt(0) + p.slice(1).toLowerCase());
                        mcpGrouped[slug] = { name: nameParts.join(' '), tools: [] };
                    }
                    mcpGrouped[slug].tools.push(tool);
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                // Single tool — group by first part
                const firstPart = suffix.split('_')[0];
                if (!mcpGrouped[firstPart]) {
                    mcpGrouped[firstPart] = { name: firstPart.charAt(0) + firstPart.slice(1).toLowerCase(), tools: [] };
                }
                mcpGrouped[firstPart].tools.push(tool);
            }
        });
    }
    
    // Build the final service map for grouping
    const serviceMap = {};

    // Add MCP groups to serviceMap
    for (const [slug, group] of Object.entries(mcpGrouped)) {
        const serviceKey = `mcp_${slug}`;
        serviceMap[serviceKey] = {
            id: serviceKey,
            name: `🔌 ${group.name}`,
            tools: group.tools,
            hasCredentials: true,
            isMcp: true,
        };
    }
    
    // Process non-MCP tools
    nonMcpTools.forEach(tool => {
        const isRemoteTool = 
            tool.tool_type === 'remote' || 
            tool.type === 'remote' ||
            tool.category === 'remote' ||
            tool.service ||
            tool.service_id ||
            tool.service_name;
        
        if (isRemoteTool) {
            let serviceId = null;
            let serviceName = 'Unknown Service';
            
            if (tool.service) {
                if (typeof tool.service === 'object') {
                    serviceId = tool.service.id;
                    serviceName = tool.service.name || tool.service_name || 'Unknown Service';
                } else {
                    serviceId = tool.service;
                    serviceName = tool.service_name || `Service ${serviceId}`;
                }
            } else if (tool.service_id) {
                serviceId = tool.service_id;
                serviceName = tool.service_name || `Service ${serviceId}`;
            }
            
            if (serviceId) {
                if (!serviceMap[serviceId]) {
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
            }
        }
        
        // 3. Group built-in tools by category as a fallback
        else if (tool.category && tool.category !== 'mcp') {
            const catKey = `builtin_${tool.category}`;
            const catLabel = tool.category.charAt(0).toUpperCase() + tool.category.slice(1);
            if (!serviceMap[catKey]) {
                serviceMap[catKey] = {
                    id: catKey,
                    name: `⚙️ ${catLabel}`,
                    tools: [],
                    hasCredentials: true,
                    isBuiltin: true,
                };
            }
            serviceMap[catKey].tools.push(tool);
        }
    });
    
    // Sort: MCP first, then services, then built-in
    const sortedServices = Object.values(serviceMap).sort((a, b) => {
        if (a.isMcp && !b.isMcp) return -1;
        if (!a.isMcp && b.isMcp) return 1;
        if (a.isBuiltin && !b.isBuiltin) return 1;
        if (!a.isBuiltin && b.isBuiltin) return -1;
        return a.name.localeCompare(b.name);
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

// Capability roster (multi-model). The dropdowns list the user's OWN models straight from the
// providers' DB — you pick whichever model you want for each role. We deliberately do NOT gate the
// list by a hardcoded "known image models" registry (that would hide new/unknown models); embedding
// models are the only thing excluded since they can't drive chat/media.
const capabilityRoles = [
    { key: 'image_model', label: 'Image generation' },
    { key: 'vision_model', label: 'Image input (vision)' },
    { key: 'audio_model', label: 'Audio generation' },
    { key: 'video_model', label: 'Video generation' },
];
// Capability models come from the SAME provider the agent uses (the LLM Provider selected above),
// so e.g. an OpenRouter agent only sees OpenRouter models. Embedding models excluded.
const capabilityModelOptions = computed(() =>
    llmModels.value.filter(m =>
        m.is_active !== false && !m.is_embedding &&
        (!selectedProviderId.value || m.provider === selectedProviderId.value)));
const hasAnyCapabilityModels = computed(() => capabilityModelOptions.value.length > 0);

const filteredModels = computed(() => {
    let models = selectedProviderId.value
        ? llmModels.value.filter(m => m.provider === selectedProviderId.value)
        : llmModels.value;

    // Apply search filter
    const query = modelSearchQuery.value.toLowerCase().trim();
    if (query) {
        models = models.filter(m => 
            m.name.toLowerCase().includes(query) ||
            m.model_id.toLowerCase().includes(query) ||
            (m.metadata?.description && m.metadata.description.toLowerCase().includes(query))
        );
    }
    
    return models;
});

// Get info about the currently selected model
const selectedModelInfo = computed(() => {
    if (!internalAgent.value.default_model) return null;
    const model = llmModels.value.find(m => m.id === internalAgent.value.default_model);
    if (!model) return null;
    
    return {
        name: model.name,
        context_window: model.context_window,
        capabilities: model.metadata?.capabilities || [],
        description: model.metadata?.description || '',
        modality: model.metadata?.modality || 'text'
    };
});

// Capability badge styling
const getCapabilityStyle = (capability) => {
    const styles = {
        'image_input': 'bg-purple-100 text-purple-700',
        'image_output': 'bg-pink-100 text-pink-700',
        'video_input': 'bg-blue-100 text-blue-700',
        'reasoning': 'bg-indigo-100 text-indigo-700',
        'coding': 'bg-green-100 text-green-700',
        'long_context': 'bg-orange-100 text-orange-700',
        'fast': 'bg-yellow-100 text-yellow-700',
        'free': 'bg-emerald-100 text-emerald-700'
    };
    return styles[capability] || 'bg-gray-100 text-gray-700';
};

// Capability emoji icons
const getCapabilityIcon = (capability) => {
    const icons = {
        'image_input': '🖼️',
        'image_output': '🎨',
        'video_input': '🎥',
        'reasoning': '🧠',
        'coding': '💻',
        'long_context': '📝',
        'fast': '⚡',
        'free': '💰'
    };
    return icons[capability] || '•';
};

// Format capability label
const formatCapability = (capability) => {
    return capability.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

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

// IDs of tools matching the current search query (for bulk actions)
const currentFilteredToolIds = computed(() => {
    const query = toolSearchQuery.value.toLowerCase().trim();
    if (!query) return [];
    return availableTools.value
        .filter(tool =>
            tool.name.toLowerCase().includes(query) ||
            (tool.description && tool.description.toLowerCase().includes(query))
        )
        .map(t => t.id);
});

const selectAllFiltered = () => {
    if (!internalAgent.value.tool_ids) internalAgent.value.tool_ids = [];
    const ids = new Set(internalAgent.value.tool_ids);
    currentFilteredToolIds.value.forEach(id => ids.add(id));
    internalAgent.value.tool_ids = [...ids];
};

const deselectAllFiltered = () => {
    if (!internalAgent.value.tool_ids) return;
    const toRemove = new Set(currentFilteredToolIds.value);
    internalAgent.value.tool_ids = internalAgent.value.tool_ids.filter(id => !toRemove.has(id));
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

const toggleServiceExpand = (serviceId) => {
    expandedServices.value[serviceId] = !expandedServices.value[serviceId];
};

const countSelectedInService = (tools) => {
    if (!internalAgent.value.tool_ids) return 0;
    return tools.filter(t => internalAgent.value.tool_ids.includes(t.id)).length;
};

// Rules + Policy add-on: validate the soft rules on submit. Inline errors are shown by
// <AgentRulesEditor>; this hard-stops the save and toasts the reason (over-length / over-count).
const rulesValid = () => {
    const arr = Array.isArray(internalAgent.value.agent_rules) ? internalAgent.value.agent_rules : [];
    if (!agentRulesValid(arr)) {
        if (arr.length > RULE_MAX_COUNT) notify.error(`You can have at most ${RULE_MAX_COUNT} rules.`);
        else notify.error(`Each rule must be ${RULE_MAX_LEN} characters or fewer.`);
        return false;
    }
    return true;
};

// Build the save payload from the current form values (rules trimmed + emptied-dropped before send).
const buildPayload = () => ({
    ...internalAgent.value,
    default_model: internalAgent.value.default_model,
    agent_rules: cleanAgentRules(internalAgent.value.agent_rules),
});

// ── Dirty / publish state ──────────────────────────────────────────────────────────────────
// `cleanSnapshot` is the savable payload at the last load/save. The form is "dirty" when the
// current payload differs. The host (AgentBuilderCanvas) uses this to redden the Save & Publish
// button and disable the live Emulator until the changes are published.
const cleanSnapshot = ref(null);
function snapshotPayload() {
    try { return JSON.stringify(buildPayload()); } catch { return ''; }
}
function markClean() {
    cleanSnapshot.value = snapshotPayload();
}
const isDirty = computed(() => cleanSnapshot.value !== null && snapshotPayload() !== cleanSnapshot.value);
watch(isDirty, (v) => emit('dirty', v), { immediate: true });
// Baseline for a fresh/new agent (existing agents are baselined when props.agent arrives, below).
onMounted(() => nextTick(markClean));

const save = () => {
    if (!rulesValid()) return;
    console.log('Saving agent with default_model:', internalAgent.value.default_model);
    emit('save', buildPayload());
};

// Lazily persist a draft when a feature needs an agent id (file upload, prompt
// preview) but we're still on /new. Returns the id, or null if it couldn't save.
// Guarded on name only so we never create nameless junk drafts. The host's saveFn
// already surfaces any backend error, so a null return means "abort the action".
const ensuringSave = ref(false);
const ensureSaved = async () => {
    if (internalAgent.value.id) return internalAgent.value.id;
    if (!rulesValid()) return null;

    const name = (internalAgent.value.name || '').trim();
    if (!name) {
        notify.warning('Give your agent a name first — we’ll save a draft automatically.');
        return null;
    }
    if (typeof props.saveFn !== 'function') {
        notify.error('Please save the agent first.');
        return null;
    }

    try {
        ensuringSave.value = true;
        const saved = await props.saveFn(buildPayload());
        if (!saved || !saved.id) return null; // saveFn already toasted the reason
        internalAgent.value.id = saved.id;
        notify.success('Draft saved automatically — keep editing.');
        return saved.id;
    } finally {
        ensuringSave.value = false;
    }
};

// Allow the host page (AgentBuilderCanvas top bar) to trigger save / ensure-saved, and to mark the
// form clean after a successful publish (resets the dirty/red state).
defineExpose({ save, ensureSaved, markClean, isDirty });

// ── Knowledge RAG: upload → confirm → embed + index (live progress over WS) ──
// indexProgress maps documentId -> { stage, percent, message }. It is the live source
// of truth during indexing; file.index_status (from the server) is the fallback.
const indexProgress = ref({});
const kbWs = ref(null);

function kbWsUrl(agentId) {
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${scheme}://${window.location.host}/ws/knowledge-index/${agentId}/`;
}

function connectKbWs() {
    const id = internalAgent.value.id;
    if (!id) return;
    if (kbWs.value && kbWs.value.readyState === WebSocket.OPEN) return;
    if (kbWs.value) { try { kbWs.value.close(); } catch (e) { /* noop */ } kbWs.value = null; }
    try {
        const sock = new WebSocket(kbWsUrl(id));
        kbWs.value = sock;
        sock.onmessage = (e) => {
            let evt; try { evt = JSON.parse(e.data); } catch { return; }
            if (evt.type === 'index_progress') handleIndexProgress(evt);
        };
        sock.onclose = () => { if (kbWs.value === sock) kbWs.value = null; };
        sock.onerror = () => { /* noop — status poll is the fallback */ };
    } catch (err) { /* noop */ }
}

function setProgress(docId, stage, percent, message, chunkCount) {
    indexProgress.value = {
        ...indexProgress.value,
        [docId]: { stage, percent: percent || 0, message: message || '', chunkCount: chunkCount || 0 },
    };
}

function handleIndexProgress(evt) {
    // Progress lives ONLY in the standalone indexProgress map. We deliberately do NOT
    // mutate internalAgent here: that would round-trip through the parent's v-model and
    // replace internalAgent wholesale on EVERY tick, re-rendering the whole builder form
    // (which looks like the page "refreshing"). fileIndex() merges this map for display.
    setProgress(evt.document_id, evt.stage, evt.percent, evt.message, evt.total);
    if (evt.stage === 'ready') notify.success(`Knowledge base ready: ${evt.name}`);
    else if (evt.stage === 'failed') notify.error(`Indexing failed: ${evt.name}${evt.message ? ' — ' + evt.message : ''}`);
}

// Apply a final status fetched via the poll fallback (used when there's no Celery worker
// and indexing ran inline, so no WS events were emitted). Map-only — no form mutation.
function applyStatus(docId, data) {
    const stage = data.index_status || data.stage;
    setProgress(docId, stage, stage === 'ready' ? 100 : 0, data.index_error || '', data.chunk_count);
    if (stage === 'ready') notify.success('Knowledge base ready');
    else if (stage === 'failed') notify.error('Indexing failed: ' + (data.index_error || ''));
}

async function triggerIndex(docId) {
    setProgress(docId, 'queued', 0, 'Queued…');
    connectKbWs();
    try {
        const r = await api.indexAgentFile(docId);
        // Inline fallback (no Celery worker) finishes synchronously and reports queued:false.
        if (r.data && r.data.queued === false) {
            const st = await api.getAgentFileStatus(docId);
            applyStatus(docId, st.data);
        }
    } catch (e) {
        setProgress(docId, 'failed', 0, 'Index trigger failed');
        notify.error('Could not start indexing: ' + (e.response?.data?.error || e.message));
    }
}

function retryIndex(file) {
    triggerIndex(file.id);
}

// Display helper: live progress from the standalone map if present, else the persisted
// server status. Keeping this read-only means progress never mutates (re-renders) the form.
function fileIndex(file) {
    const p = indexProgress.value[file.id];
    if (p) return p;
    const stage = file.index_status || 'pending';
    return { stage, percent: stage === 'ready' ? 100 : 0, message: '', chunkCount: file.chunk_count || 0 };
}

const STAGE_LABELS = {
    queued: 'Queued…', pending: 'Preparing…', reading: 'Reading document…',
    chunking: 'Splitting into chunks…', embedding: 'Generating embeddings…',
};
function stageLabel(stage) { return STAGE_LABELS[stage] || 'Indexing…'; }

const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (fileInput.value) fileInput.value.value = ''; // reset picker so the same file can re-trigger
    if (!file) return;

    // Confirmation before we persist + index the document as agent knowledge.
    const ok = await confirm({
        title: 'Add to knowledge base?',
        message: `Save "${file.name}" as knowledge for this agent? We'll embed and index it so the agent can reference it when answering questions.`,
        confirmText: 'Save & Index',
    });
    if (!ok) return;

    // Lazily create the agent if we don't have an id yet (no "save first" dead-end).
    let id = internalAgent.value.id || await ensureSaved();
    if (!id) return;

    try {
        uploading.value = true;
        const res = await api.uploadAgentFile(id, file);
        const doc = res.data;
        doc.index_status = doc.index_status || 'queued';
        if (!internalAgent.value.knowledge_files) internalAgent.value.knowledge_files = [];
        internalAgent.value.knowledge_files.unshift(doc);

        // Kick off embedding + indexing; progress streams back over the WS.
        await triggerIndex(doc.id);
    } catch (e) {
        notify.error("Upload failed: " + (e.response?.data?.error || e.message));
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
    if (!(await confirm({ title: 'Delete file?', message: `Are you sure you want to delete ${file.name}?`, confirmText: 'Delete', danger: true }))) return;
    try {
        await api.deleteGenericFile(file.id);
        // Update local list
        internalAgent.value.knowledge_files = internalAgent.value.knowledge_files.filter(f => f.id !== file.id);
    } catch (e) {
        notify.error("Failed to delete file: " + (e.response?.data?.error || e.message));
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
        notify.error("Analysis failed: " + e.message);
    } finally {
        isReAnalyzing.value = false;
    }
};

// Credential fetching for tool badges
const fetchCredentials = async () => {
    if (!internalAgent.value.id) return;
    
    try {
        const res = await api.get(`/agents/${internalAgent.value.id}/credentials/`);
        credentials.value = res.data.credentials || [];
    } catch (e) {
        console.error('Failed to fetch credentials:', e);
    }
};

// MCP Credential Management Functions
const fetchMcpServers = async () => {
    try {
        const res = await api.getMCPServers();
        mcpServers.value = res.data.servers || res.data.results || res.data || [];
    } catch (e) {
        console.error('Failed to fetch MCP servers:', e);
    }
};

const loadMcpCredentials = async () => {
    if (!selectedMcpServerId.value || !internalAgent.value.id) return;
    mcpCredentialMessage.value = '';
    try {
        const res = await api.getMCPCredentials(selectedMcpServerId.value, internalAgent.value.id);
        mcpCredentials.value = res.data.credentials || [];
        // Pre-fill entries from existing credential keys
        if (mcpCredentials.value.length) {
            const cred = mcpCredentials.value[0];
            mcpCredentialEntries.value = Object.keys(cred.env_vars || {}).map(key => ({ key, value: '' }));
            if (!mcpCredentialEntries.value.length) mcpCredentialEntries.value = [{ key: '', value: '' }];
        } else {
            // Pre-fill from server env_config keys if available
            const srv = mcpServers.value.find(s => s.id == selectedMcpServerId.value);
            const envKeys = Object.keys(srv?.env_config || {});
            if (envKeys.length) {
                mcpCredentialEntries.value = envKeys.map(key => ({ key, value: '' }));
            } else {
                mcpCredentialEntries.value = [{ key: '', value: '' }];
            }
        }
    } catch (e) {
        console.error('Failed to load MCP credentials:', e);
    }
};

const saveMcpCredentials = async () => {
    if (!internalAgent.value.id) {
        notify.error('Please save the agent first');
        return;
    }
    savingMcpCredential.value = true;
    mcpCredentialMessage.value = '';
    mcpCredentialError.value = false;

    const envVars = {};
    mcpCredentialEntries.value.forEach(e => {
        if (e.key && e.value) envVars[e.key] = e.value;
    });

    try {
        await api.setMCPCredentials(selectedMcpServerId.value, {
            agent_profile_id: internalAgent.value.id,
            env_vars: envVars
        });
        mcpCredentialMessage.value = 'Credentials saved successfully!';
        loadMcpCredentials();
    } catch (e) {
        mcpCredentialError.value = true;
        mcpCredentialMessage.value = e.response?.data?.error || 'Failed to save credentials';
    } finally {
        savingMcpCredential.value = false;
    }
};

const deleteMcpCredential = async (cred) => {
    if (!(await confirm({ title: 'Delete credential?', message: `Delete MCP credential "${cred.name}"?`, confirmText: 'Delete', danger: true }))) return;
    try {
        await api.deleteMCPCredential(selectedMcpServerId.value, cred.id);
        mcpCredentialMessage.value = 'Credential deleted';
        mcpCredentialError.value = false;
        loadMcpCredentials();
    } catch (e) {
        mcpCredentialMessage.value = 'Failed to delete';
        mcpCredentialError.value = true;
    }
};



// Watch activeTab to fetch credentials when tab is opened
watch(() => activeTab.value, (newTab) => {
    if (newTab === 'Credentials' && internalAgent.value.id) {
        fetchMcpServers();
    } else if (newTab === 'Tools' && internalAgent.value.id) {
        // Fetch credentials for service view badges
        fetchCredentials();
    }
});

// Sync prop changes to internal
// Seed with the initial agent id so the first edit's round-trip (same id) does NOT re-baseline and
// wipe the dirty state — only a genuinely different agent (or a fresh id after create) re-baselines.
let _lastBaselineId = props.agent && props.agent.id;
watch(() => props.agent, (newVal) => {
    isUpdatingFromProp.value = true;
    internalAgent.value = {
        default_model: null,  // Ensure reactivity
        ...newVal
    };
    // Ensure array exists
    if (!internalAgent.value.tool_ids) internalAgent.value.tool_ids = [];

    // Re-baseline the clean snapshot only when a DIFFERENT agent arrives (load, or a fresh id after
    // create) — not on the edit round-trip (same id), which would erase the dirty state.
    const nid = newVal && newVal.id;
    if (nid !== _lastBaselineId) {
        _lastBaselineId = nid;
        nextTick(markClean);
    }

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

// ── Prompt Preview Methods ──

const insertPlaceholder = (tag) => {
    const textarea = promptTextarea.value;
    if (!textarea) {
        // Fallback: just append
        internalAgent.value.system_prompt_template = (internalAgent.value.system_prompt_template || '') + '\n' + tag;
        return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = internalAgent.value.system_prompt_template || '';
    internalAgent.value.system_prompt_template = text.substring(0, start) + tag + text.substring(end);
    // Restore cursor position after the inserted tag
    setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + tag.length;
    }, 0);
};

const previewPrompt = async () => {
    // Lazily create the agent if needed — preview is rendered server-side by id.
    const id = internalAgent.value.id || await ensureSaved();
    if (!id) return;

    loadingPreview.value = true;
    showPromptPreview.value = true;
    promptPreviewData.value = null;
    try {
        const response = await api.previewAgentPrompt(id);
        promptPreviewData.value = response.data;
    } catch (err) {
        console.error('Preview prompt failed:', err);
        promptPreviewData.value = {
            prompt: `Error loading preview: ${err.message || 'Unknown error'}`,
            char_count: 0,
            estimated_tokens: 0,
            sections: {},
        };
    } finally {
        loadingPreview.value = false;
    }
};

const copyPromptPreview = async () => {
    if (promptPreviewData.value?.prompt) {
        try {
            await navigator.clipboard.writeText(promptPreviewData.value.prompt);
        } catch {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = promptPreviewData.value.prompt;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
    }
};

// ── Connectors: assign a connected connector (all its tools) to THIS agent ──
const connectedConnectors = ref([]);
const connectorsLoading = ref(false);
const showAllConnectors = ref(false);
// Show up to 5; "Show more" reveals the rest (scrollable).
const displayedConnectors = computed(() =>
    showAllConnectors.value ? connectedConnectors.value : connectedConnectors.value.slice(0, 5));

const loadAgentConnectors = async () => {
    connectorsLoading.value = true;
    try {
        const scope = internalAgent.value?.id ? `agent:${internalAgent.value.id}` : 'global';
        const { data } = await api.getConnectors(scope);
        connectedConnectors.value = (data.connectors || []).filter(c => c.connected);
    } catch (e) {
        connectedConnectors.value = [];
    } finally {
        connectorsLoading.value = false;
    }
};

const connectorKindLabel = (c) =>
    ({ builtin: 'Built-in service', mcp: 'MCP server', service: 'Service' }[c.kind] || 'Connector');

// Map a connector to the availableTools objects it owns (built-in by category prefix,
// MCP by name prefix, service by service id).
const connectorTools = (c) => {
    const tools = availableTools.value || [];
    if (c.kind === 'builtin') {
        const k = String(c.id).toLowerCase();
        return tools.filter(t => {
            const cat = (t.category || '').toLowerCase();
            return cat === k || cat.startsWith(k + '.');
        });
    }
    if (c.kind === 'mcp') {
        const slug = String(c.slug || '').toUpperCase().replace(/[-\s]/g, '_');
        if (!slug) return [];
        return tools.filter(t => String(t.name || '').toUpperCase().startsWith('MCP_' + slug + '_'));
    }
    if (c.kind === 'service') {
        return tools.filter(t => String(t.service_id ?? (t.service && t.service.id) ?? t.service ?? '') === String(c.id));
    }
    return [];
};

const connectorAssigned = (c) => areAllServiceToolsSelected(connectorTools(c));

const toggleConnector = (c) => {
    const ts = connectorTools(c);
    if (!ts.length) { notify.info(`No tools synced for ${c.name} yet`); return; }
    toggleServiceTools(ts);  // adds ALL when none/partial; removes ALL when fully assigned
};

// Open the full Connectors page (Browse + connect + per-tool permissions) in a new tab,
// so the in-progress agent draft isn't lost.
const openConnectorsHub = () => {
    const scope = internalAgent.value?.id ? `?scope=agent:${internalAgent.value.id}` : '';
    window.open(`/dashboard/connectors${scope}`, '_blank', 'noopener');
};

// Reload the connector list when the agent id first appears (draft save / switching agents).
watch(() => internalAgent.value.id, () => loadAgentConnectors());

onMounted(() => {
    fetchTools();
    fetchProviders();
    fetchModels();
    fetchMcpServers();       // needed so MCP connectors can map to their tools
    loadAgentConnectors();
    connectKbWs();
});

// Reconnect the knowledge-index WS when the agent id first appears (lazy draft save)
// or changes (switching agents in Configure).
watch(() => internalAgent.value.id, (id) => { if (id) connectKbWs(); });

onBeforeUnmount(() => {
    if (kbWs.value) { try { kbWs.value.close(); } catch (e) { /* noop */ } kbWs.value = null; }
});
</script>
