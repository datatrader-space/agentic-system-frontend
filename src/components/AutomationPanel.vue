<template>
  <div class="automation-panel h-full flex flex-col bg-gray-50">
    <!-- Sub-tabs -->
    <div class="flex items-center gap-1 px-3 sm:px-4 py-2 bg-white border-b border-gray-200 shrink-0 overflow-x-auto scrollbar-hide">
      <button
        v-for="tab in subTabs"
        :key="tab.key"
        @click="activeSubTab = tab.key"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap flex-shrink-0"
        :class="activeSubTab === tab.key
          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'"
      >
        <span>{{ tab.icon }}</span>
        <span>{{ tab.label }}</span>
        <span
          v-if="tab.count > 0"
          class="ml-1 px-1.5 py-0.5 text-[10px] rounded-full"
          :class="activeSubTab === tab.key ? 'bg-indigo-200 text-indigo-800' : 'bg-gray-200 text-gray-600'"
        >{{ tab.count }}</span>
      </button>

      <div class="flex-1"></div>

      <!-- Context buttons -->
      <button
        v-if="activeSubTab === 'workflows'"
        @click="showCreateModal = true"
        class="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
          <path d="M12 5v14m-7-7h14"/>
        </svg>
        New Workflow
      </button>
      <button
        v-if="activeSubTab === 'scripts'"
        @click="showWsBrowser = !showWsBrowser"
        class="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition"
        :class="showWsBrowser
          ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
          : 'bg-indigo-600 text-white hover:bg-indigo-700'"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
          <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
        </svg>
        {{ showWsBrowser ? 'Close Browser' : 'Browse & Add' }}
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 min-h-0 overflow-hidden flex flex-col sm:flex-row">

      <!-- Main content area -->
      <div class="flex-1 overflow-y-auto p-4">

        <!-- WORKFLOWS -->
        <div v-if="activeSubTab === 'workflows'">
          <div v-if="loading.workflows" class="flex items-center justify-center py-16 text-gray-400 gap-2">
            <div class="animate-spin w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full"></div>
            <span class="text-sm">Loading workflows...</span>
          </div>
          <div v-else-if="workflows.length === 0" class="flex flex-col items-center justify-center py-16 text-gray-400">
            <div class="text-4xl mb-3">📋</div>
            <p class="text-sm font-medium text-gray-600">No workflows yet</p>
            <p class="text-xs mt-1">Create your first workflow to automate tasks.</p>
            <button @click="showCreateModal = true" class="mt-4 px-4 py-2 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700">
              Create Workflow
            </button>
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="wf in workflows" :key="wf.id"
              class="bg-white rounded-lg border border-gray-200 p-4 hover:border-indigo-300 hover:shadow-sm transition group"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <h3 class="text-sm font-semibold text-gray-800 truncate">{{ wf.name }}</h3>
                    <span class="px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase"
                      :class="categoryClass(wf.category)">{{ wf.category }}</span>
                  </div>
                  <p class="text-xs text-gray-500 mt-1 line-clamp-2">{{ wf.prompt }}</p>
                  <div class="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                    <span>{{ wf.execution_count || 0 }} runs</span>
                    <span>{{ wf.schedule_count || 0 }} schedules</span>
                  </div>
                </div>
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition ml-3">
                  <button @click="runWorkflow(wf)" class="px-2.5 py-1 bg-green-50 text-green-700 text-xs rounded hover:bg-green-100 font-medium">▶ Run</button>
                  <button @click="editWorkflow(wf)" class="px-2 py-1 text-gray-500 text-xs rounded hover:bg-gray-100">Edit</button>
                  <button @click="deleteWorkflow(wf)" class="px-2 py-1 text-red-500 text-xs rounded hover:bg-red-50">Delete</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- SCHEDULES -->
        <div v-if="activeSubTab === 'schedules'">
          <div v-if="loading.schedules" class="flex items-center justify-center py-16 text-gray-400 gap-2">
            <div class="animate-spin w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full"></div>
            <span class="text-sm">Loading schedules...</span>
          </div>
          <div v-else-if="schedules.length === 0" class="flex flex-col items-center justify-center py-16 text-gray-400">
            <div class="text-4xl mb-3">🕐</div>
            <p class="text-sm font-medium text-gray-600">No schedules</p>
            <p class="text-xs mt-1">Create a workflow first, then schedule it.</p>
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="s in schedules" :key="s.id"
              class="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-4 hover:border-indigo-200 transition"
            >
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-gray-800">{{ s.template_name }}</div>
                <div class="flex items-center gap-2 mt-1 text-xs text-gray-500">
                  <code class="px-1.5 py-0.5 bg-gray-100 rounded text-[11px]">{{ s.schedule }}</code>
                  <span class="px-1.5 py-0.5 bg-gray-100 rounded text-[10px]">{{ s.channel }}</span>
                </div>
              </div>
              <div class="flex items-center gap-2 text-xs text-gray-500">
                <span>Last: {{ s.last_run ? formatDate(s.last_run) : 'Never' }}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="flex items-center gap-1 text-xs">
                  <span class="w-2 h-2 rounded-full" :class="s.active ? 'bg-green-500' : 'bg-gray-400'"></span>
                  {{ s.active ? 'Active' : 'Paused' }}
                </span>
                <button @click="toggleSchedule(s)" class="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50">
                  {{ s.active ? 'Pause' : 'Resume' }}
                </button>
                <button @click="deleteSchedule(s)" class="px-2 py-1 text-xs text-red-500 border border-red-200 rounded hover:bg-red-50">
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- SCRIPTS -->
        <div v-if="activeSubTab === 'scripts'">
          <div v-if="loading.scripts" class="flex items-center justify-center py-16 text-gray-400 gap-2">
            <div class="animate-spin w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full"></div>
            <span class="text-sm">Loading scripts...</span>
          </div>
          <div v-else-if="scripts.length === 0 && !showWsBrowser" class="flex flex-col items-center justify-center py-16 text-gray-400">
            <div class="text-4xl mb-3">💻</div>
            <p class="text-sm font-medium text-gray-600">No scripts registered</p>
            <p class="text-xs mt-1">Browse workspace files to register scripts.</p>
            <button @click="showWsBrowser = true" class="mt-4 px-4 py-2 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700">
              Browse & Add
            </button>
          </div>

          <!-- Folder-grouped script list -->
          <div v-else-if="scripts.length > 0" class="space-y-4">
            <!-- Search -->
            <div class="relative" v-if="scripts.length > 3">
              <input v-model="scriptSearch" type="text" placeholder="Search scripts..."
                class="w-full px-3 py-2 pl-8 text-xs border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none" />
              <svg class="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
            </div>

            <!-- Grouped by folder -->
            <div v-for="(group, folder) in groupedScripts" :key="folder" class="space-y-2">
              <button
                @click="toggleFolder(folder)"
                class="flex items-center gap-2 w-full text-left px-2 py-1 rounded hover:bg-gray-100 transition"
              >
                <svg class="w-3 h-3 text-gray-400 transition-transform" :class="{ 'rotate-90': expandedFolders[folder] }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
                <span class="text-yellow-500 text-sm">📁</span>
                <span class="text-xs font-semibold text-gray-700">{{ folder || 'Root' }}</span>
                <span class="text-[10px] text-gray-400">({{ group.length }})</span>
              </button>

              <div v-if="expandedFolders[folder]" class="ml-6 space-y-2">
                <div
                  v-for="script in group" :key="script.id"
                  class="bg-white rounded-lg border border-gray-200 p-3 hover:border-indigo-300 hover:shadow-sm transition group"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="w-6 h-6 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[9px] flex-shrink-0">&lt;/&gt;</span>
                        <h3 class="text-sm font-semibold text-gray-800">{{ script.name }}</h3>
                        <span class="px-2 py-0.5 text-[10px] font-medium rounded-full" :class="categoryClass(script.category)">{{ script.category }}</span>
                      </div>
                      <p class="text-xs text-gray-500 mt-1 line-clamp-2">{{ script.description || 'No description' }}</p>
                      <div v-if="Object.keys(script.parameters || {}).length" class="mt-1.5 flex flex-wrap gap-1">
                        <span v-for="(_, key) in script.parameters" :key="key"
                          class="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-mono">{{ key }}</span>
                      </div>
                    </div>
                    <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition ml-2">
                      <span class="text-[10px] text-gray-400 mr-1">{{ script.execution_count || 0 }} runs</span>
                      <button @click="removeScript(script)" class="px-1.5 py-0.5 text-red-500 text-[10px] rounded hover:bg-red-50" title="Remove from registry">✕</button>
                    </div>
                  </div>
                  <div class="text-[10px] text-gray-400 font-mono mt-1.5 truncate">{{ script.file_path }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- HISTORY -->
        <div v-if="activeSubTab === 'history'">
          <div class="flex items-center gap-3 mb-3">
            <select v-model="execFilter.status" @change="loadExecutions" class="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white">
              <option value="">All Statuses</option>
              <option value="running">Running</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
            <select v-model="execFilter.triggered_by" @change="loadExecutions" class="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white">
              <option value="">All Triggers</option>
              <option value="manual">Manual</option>
              <option value="schedule">Scheduled</option>
              <option value="monitor">Monitor</option>
            </select>
            <button @click="loadExecutions" class="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">
              ↻ Refresh
            </button>
          </div>

          <div v-if="loading.executions" class="flex items-center justify-center py-16 text-gray-400 gap-2">
            <div class="animate-spin w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full"></div>
            <span class="text-sm">Loading executions...</span>
          </div>
          <div v-else-if="executions.length === 0" class="flex flex-col items-center justify-center py-16 text-gray-400">
            <div class="text-4xl mb-3">📊</div>
            <p class="text-sm font-medium text-gray-600">No executions yet</p>
            <p class="text-xs mt-1">Run a workflow to see history here.</p>
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="ex in executions" :key="ex.id"
              @click="viewExecution(ex)"
              class="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-4 hover:border-indigo-200 transition cursor-pointer"
            >
              <span class="text-xs font-mono text-gray-400 w-8">#{{ ex.id }}</span>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-gray-800 truncate">{{ ex.workflow_name || ex.script_name || '—' }}</div>
                <div class="text-[10px] text-gray-400 mt-0.5">{{ ex.triggered_by }} • {{ formatDate(ex.started_at) }}</div>
              </div>
              <span class="px-2 py-0.5 text-[10px] font-semibold rounded-full"
                :class="statusClass(ex.status)">{{ ex.status }}</span>
              <span class="text-xs text-gray-400 w-16 text-right">{{ ex.duration_seconds ? ex.duration_seconds.toFixed(1) + 's' : '—' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Workspace Browser Sidebar (only on scripts tab) -->
      <div v-if="activeSubTab === 'scripts' && showWsBrowser"
        class="w-full sm:w-72 border-t sm:border-t-0 sm:border-l border-gray-200 bg-white flex flex-col shrink-0 overflow-hidden max-h-[40vh] sm:max-h-none">
        <div class="px-3 py-2 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div class="flex items-center gap-1.5">
            <span class="text-yellow-500">📁</span>
            <span class="text-xs font-bold text-gray-700">Agent Workspace</span>
          </div>
          <div class="flex items-center gap-1">
            <button @click="loadWsFiles" :disabled="wsLoading" class="p-1 hover:bg-gray-200 rounded text-gray-500 transition" title="Refresh">
              <svg class="w-3.5 h-3.5" :class="{ 'animate-spin': wsLoading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
            </button>
            <button @click="showWsBrowser = false" class="p-1 hover:bg-gray-200 rounded text-gray-500 transition">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-2">
          <div v-if="wsLoading" class="flex items-center justify-center py-12">
            <div class="animate-spin w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full"></div>
          </div>
          <div v-else-if="wsFiles.length === 0" class="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
            <span class="text-3xl">📂</span>
            <p class="text-xs">Workspace is empty</p>
          </div>
          <div v-else>
            <WorkspaceTreeNode
              :entries="wsFiles"
              :expandedDirs="wsExpandedDirs"
              :previewPath="null"
              :getFileIcon="getFileIcon"
              :formatSize="wsFormatSize"
              @toggle-dir="wsToggleDir"
              @read-file="wsSelectFile"
              @delete="() => {}"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- CREATE/EDIT WORKFLOW MODAL -->
    <Teleport to="body">
      <div v-if="showCreateModal" class="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" @click.self="showCreateModal = false">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
          <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <h2 class="text-base font-bold text-gray-800">{{ editingWf ? 'Edit Workflow' : 'New Workflow' }}</h2>
            <button @click="showCreateModal = false" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
          </div>
          <div class="p-5 space-y-4">
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1">Name</label>
              <input v-model="wfForm.name" type="text" class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none" placeholder="e.g. Morning Health Check" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1">Category</label>
              <select v-model="wfForm.category" class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none">
                <option value="general">General</option>
                <option value="deployment">Deployment</option>
                <option value="monitoring">Monitoring</option>
                <option value="reporting">Reporting</option>
              </select>
            </div>
            <div v-if="scripts.length > 0">
              <label class="block text-xs font-semibold text-gray-600 mb-1">Script <span class="text-gray-400 font-normal">(optional)</span></label>
              <select v-model="wfForm.script_id" @change="onScriptSelect" class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none">
                <option :value="null">— No script —</option>
                <option v-for="s in scripts" :key="s.id" :value="s.id">{{ s.name }} ({{ s.category }})</option>
              </select>
              <p v-if="wfForm.script_id" class="text-[10px] text-gray-400 mt-1">The workflow will run this script when triggered.</p>
            </div>
            <div v-if="!wfForm.script_id">
              <label class="block text-xs font-semibold text-gray-600 mb-1">Prompt</label>
              <textarea v-model="wfForm.prompt" rows="4" class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none font-mono" placeholder="The prompt to send when this workflow runs."></textarea>
            </div>
            <div class="flex items-center gap-2">
              <input type="checkbox" v-model="wfForm.addSchedule" id="add-schedule" class="accent-indigo-600" />
              <label for="add-schedule" class="text-xs font-medium text-gray-600">Schedule this workflow</label>
            </div>
            <template v-if="wfForm.addSchedule">
              <div>
                <label class="block text-xs font-semibold text-gray-600 mb-1">Cron Expression</label>
                <input v-model="wfForm.schedule" type="text" class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none font-mono" placeholder="0 8 * * *  (8am daily)" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-600 mb-1">Channel</label>
                <select v-model="wfForm.channel" class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none">
                  <option value="log">Log Only</option>
                  <option value="telegram">Telegram</option>
                  <option value="slack">Slack</option>
                  <option value="email">Email</option>
                </select>
              </div>
            </template>
          </div>
          <div class="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 bg-gray-50">
            <button @click="showCreateModal = false" class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button @click="saveWorkflow" :disabled="!wfForm.name || (!wfForm.prompt && !wfForm.script_id)" class="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {{ editingWf ? 'Update' : 'Create' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- SAVE AS SCRIPT MODAL -->
    <Teleport to="body">
      <div v-if="showSaveScriptModal" class="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" @click.self="showSaveScriptModal = false">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
          <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <h2 class="text-base font-bold text-gray-800">Save as Script</h2>
            <button @click="showSaveScriptModal = false" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
          </div>
          <div class="p-5 space-y-4">
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1">File Path</label>
              <div class="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono text-gray-600 truncate">{{ scriptForm.file_path }}</div>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1">Script Name</label>
              <input v-model="scriptForm.name" type="text" class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none" placeholder="e.g. health_check" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1">Category</label>
              <select v-model="scriptForm.category" class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none">
                <option value="general">General</option>
                <option value="deployment">Deployment</option>
                <option value="monitoring">Monitoring</option>
                <option value="reporting">Reporting</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1">Description</label>
              <textarea v-model="scriptForm.description" rows="3" class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none" placeholder="What does this script do?"></textarea>
            </div>
          </div>
          <div class="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 bg-gray-50">
            <button @click="showSaveScriptModal = false" class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button @click="registerScript" :disabled="!scriptForm.name || savingScript" class="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {{ savingScript ? 'Saving...' : 'Register Script' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- EXECUTION DETAIL MODAL -->
    <Teleport to="body">
      <div v-if="selectedExecution" class="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" @click.self="selectedExecution = null">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[80vh] flex flex-col">
          <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
            <h2 class="text-base font-bold text-gray-800">Execution #{{ selectedExecution.id }}</h2>
            <button @click="selectedExecution = null" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
          </div>
          <div class="flex-1 overflow-y-auto p-5 space-y-4">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-[10px] font-semibold text-gray-400 uppercase">Status</label>
                <div class="mt-1"><span class="px-2 py-0.5 text-xs font-semibold rounded-full" :class="statusClass(selectedExecution.status)">{{ selectedExecution.status }}</span></div>
              </div>
              <div>
                <label class="text-[10px] font-semibold text-gray-400 uppercase">Triggered By</label>
                <p class="text-sm text-gray-700 mt-1">{{ selectedExecution.triggered_by }}</p>
              </div>
              <div>
                <label class="text-[10px] font-semibold text-gray-400 uppercase">Started</label>
                <p class="text-sm text-gray-700 mt-1">{{ formatDate(selectedExecution.started_at) }}</p>
              </div>
              <div>
                <label class="text-[10px] font-semibold text-gray-400 uppercase">Duration</label>
                <p class="text-sm text-gray-700 mt-1">{{ selectedExecution.duration_seconds ? selectedExecution.duration_seconds.toFixed(2) + 's' : '—' }}</p>
              </div>
            </div>
            <div v-if="selectedExecution.steps?.length">
              <h3 class="text-xs font-bold text-gray-600 mb-2">Steps</h3>
              <div class="space-y-1">
                <div v-for="(step, i) in selectedExecution.steps" :key="i" class="flex items-center gap-2 py-1.5 px-2 bg-gray-50 rounded text-xs">
                  <span class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                    :class="step.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'">
                    {{ step.status === 'success' ? '✓' : '✗' }}
                  </span>
                  <span class="flex-1 text-gray-700">{{ step.step }}</span>
                  <span v-if="step.duration" class="text-gray-400">{{ step.duration }}s</span>
                </div>
              </div>
            </div>
            <div v-if="selectedExecution.result">
              <h3 class="text-xs font-bold text-gray-600 mb-2">Result</h3>
              <pre class="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto max-h-48 font-mono">{{ selectedExecution.result }}</pre>
            </div>
            <div v-if="selectedExecution.error">
              <h3 class="text-xs font-bold text-gray-600 mb-2">Error</h3>
              <pre class="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 whitespace-pre-wrap overflow-x-auto max-h-48 font-mono">{{ selectedExecution.error }}</pre>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import api from '../services/api'
import WorkspaceTreeNode from './WorkspaceTreeNode.vue'

const props = defineProps({
  agentProfile: { type: Object, default: null }
})

// --- State ---
const activeSubTab = ref('workflows')
const loading = reactive({ workflows: false, schedules: false, scripts: false, executions: false })
const workflows = ref([])
const schedules = ref([])
const scripts = ref([])
const executions = ref([])
const showCreateModal = ref(false)
const editingWf = ref(null)
const selectedExecution = ref(null)
const execFilter = reactive({ status: '', triggered_by: '' })
const scriptSearch = ref('')
const expandedFolders = reactive({})

// Workflow form
const wfForm = reactive({ name: '', prompt: '', category: 'general', script_id: null, addSchedule: false, schedule: '', channel: 'log' })

// Workspace browser
const showWsBrowser = ref(false)
const wsFiles = ref([])
const wsLoading = ref(false)
const wsExpandedDirs = reactive({})

// Save-as-script modal
const showSaveScriptModal = ref(false)
const savingScript = ref(false)
const scriptForm = reactive({ name: '', file_path: '', category: 'general', description: '' })

// --- Computed ---
const subTabs = computed(() => [
  { key: 'workflows', icon: '📋', label: 'Workflows', count: workflows.value.length },
  { key: 'schedules', icon: '🕐', label: 'Schedules', count: schedules.value.length },
  { key: 'scripts', icon: '💻', label: 'Scripts', count: scripts.value.length },
  { key: 'history', icon: '📊', label: 'History', count: executions.value.length },
])

const filteredScripts = computed(() => {
  if (!scriptSearch.value) return scripts.value
  const q = scriptSearch.value.toLowerCase()
  return scripts.value.filter(s =>
    s.name.toLowerCase().includes(q) ||
    (s.description || '').toLowerCase().includes(q) ||
    (s.file_path || '').toLowerCase().includes(q)
  )
})

const groupedScripts = computed(() => {
  const groups = {}
  for (const s of filteredScripts.value) {
    const folder = s.folder || ''
    if (!groups[folder]) groups[folder] = []
    groups[folder].push(s)
  }
  // Ensure all folders are expanded by default the first time
  for (const folder of Object.keys(groups)) {
    if (!(folder in expandedFolders)) expandedFolders[folder] = true
  }
  return groups
})

// --- Helpers ---
const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const categoryClass = (cat) => ({
  'bg-blue-100 text-blue-700': cat === 'general',
  'bg-green-100 text-green-700': cat === 'monitoring',
  'bg-purple-100 text-purple-700': cat === 'deployment',
  'bg-amber-100 text-amber-700': cat === 'reporting',
})

const statusClass = (s) => ({
  'bg-blue-100 text-blue-700': s === 'running',
  'bg-green-100 text-green-700': s === 'success',
  'bg-red-100 text-red-700': s === 'failed',
  'bg-amber-100 text-amber-700': s === 'partial',
})

const toggleFolder = (folder) => {
  expandedFolders[folder] = !expandedFolders[folder]
}

// --- Workspace browser helpers ---
const getFileIcon = (name) => {
  const ext = name.split('.').pop()?.toLowerCase()
  const icons = { py: '🐍', js: '📜', json: '📋', md: '📝', txt: '📄', sh: '⚙️', yml: '⚙️', yaml: '⚙️', css: '🎨', html: '🌐', vue: '💚' }
  return icons[ext] || '📄'
}
const wsFormatSize = (bytes) => {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / 1048576).toFixed(1) + 'MB'
}
const wsToggleDir = (path) => {
  wsExpandedDirs[path] = !wsExpandedDirs[path]
}

const wsSelectFile = (entry) => {
  // Only allow .py files
  if (!entry.name.endsWith('.py')) {
    alert('Only .py files can be registered as scripts.')
    return
  }
  // Pre-fill the save modal
  const baseName = entry.name.replace(/\.py$/, '')
  scriptForm.name = baseName
  scriptForm.file_path = entry.path
  scriptForm.category = 'general'
  scriptForm.description = ''
  showSaveScriptModal.value = true
}

// --- Data loading ---
const loadWorkflows = async () => {
  loading.workflows = true
  try { workflows.value = (await api.get('/workflows/')).data } catch (e) { console.error(e) }
  finally { loading.workflows = false }
}

const loadSchedules = async () => {
  loading.schedules = true
  try { schedules.value = (await api.get('/schedules/')).data } catch (e) { console.error(e) }
  finally { loading.schedules = false }
}

const loadScripts = async () => {
  loading.scripts = true
  try { scripts.value = (await api.get('/scripts/')).data } catch (e) { console.error(e) }
  finally { loading.scripts = false }
}

const loadExecutions = async () => {
  loading.executions = true
  try {
    const params = new URLSearchParams()
    if (execFilter.status) params.set('status', execFilter.status)
    if (execFilter.triggered_by) params.set('triggered_by', execFilter.triggered_by)
    executions.value = (await api.get(`/executions/?${params}`)).data
  } catch (e) { console.error(e) }
  finally { loading.executions = false }
}

const loadWsFiles = async () => {
  if (!props.agentProfile?.id) return
  wsLoading.value = true
  try {
    const { data } = await api.getAgentWorkspace(props.agentProfile.id)
    wsFiles.value = data.files || []
  } catch (e) {
    console.error('Failed to load workspace:', e)
    wsFiles.value = []
  } finally {
    wsLoading.value = false
  }
}

// --- Actions ---
const saveWorkflow = async () => {
  try {
    if (editingWf.value) {
      await api.put(`/workflows/${editingWf.value.id}/`, { name: wfForm.name, prompt: wfForm.prompt, category: wfForm.category })
    } else {
      const profileId = props.agentProfile?.id
      if (!profileId) { alert('Save the agent first'); return }
      const payload = { name: wfForm.name, prompt: wfForm.prompt, category: wfForm.category, profile_id: profileId }
      if (wfForm.script_id) payload.script_id = wfForm.script_id
      const res = await api.post('/workflows/', payload)
      if (wfForm.addSchedule && wfForm.schedule) {
        await api.post('/schedules/', { template_id: res.data.id, profile_id: profileId, schedule: wfForm.schedule, channel: wfForm.channel })
      }
    }
    showCreateModal.value = false
    editingWf.value = null
    Object.assign(wfForm, { name: '', prompt: '', category: 'general', script_id: null, addSchedule: false, schedule: '', channel: 'log' })
    loadWorkflows()
    loadSchedules()
  } catch (e) { alert(e.response?.data?.error || 'Failed to save') }
}

const runWorkflow = async (wf) => {
  try {
    const res = await api.post(`/workflows/${wf.id}/run/`)
    alert(`"${wf.name}" executed: ${res.data.status}`)
    loadExecutions()
  } catch (e) { alert('Failed to run workflow') }
}

const editWorkflow = (wf) => {
  editingWf.value = wf
  wfForm.name = wf.name
  wfForm.prompt = wf.prompt
  wfForm.category = wf.category
  wfForm.addSchedule = false
  showCreateModal.value = true
}

const deleteWorkflow = async (wf) => {
  if (!confirm(`Delete "${wf.name}"?`)) return
  try { await api.delete(`/workflows/${wf.id}/`); loadWorkflows() }
  catch (e) { alert('Failed') }
}

const toggleSchedule = async (s) => {
  try { await api.put(`/schedules/${s.id}/`, { active: !s.active }); loadSchedules() }
  catch (e) { alert('Failed') }
}

const deleteSchedule = async (s) => {
  if (!confirm('Delete schedule?')) return
  try { await api.delete(`/schedules/${s.id}/`); loadSchedules() }
  catch (e) { alert('Failed') }
}

const registerScript = async () => {
  const profileId = props.agentProfile?.id
  if (!profileId) { alert('Save the agent first'); return }
  savingScript.value = true
  try {
    await api.post('/scripts/', {
      profile_id: profileId,
      name: scriptForm.name,
      file_path: scriptForm.file_path,
      description: scriptForm.description,
      category: scriptForm.category,
    })
    showSaveScriptModal.value = false
    loadScripts()
  } catch (e) {
    alert(e.response?.data?.error || 'Failed to register script')
  } finally {
    savingScript.value = false
  }
}

const removeScript = async (script) => {
  if (!confirm(`Remove "${script.name}" from registry?`)) return
  try { await api.delete(`/scripts/${script.id}/`); loadScripts() }
  catch (e) { alert('Failed') }
}

const viewExecution = async (ex) => {
  try { selectedExecution.value = (await api.get(`/executions/${ex.id}/`)).data }
  catch (e) { selectedExecution.value = ex }
}

// --- Lifecycle ---
const onScriptSelect = () => {
  // Clear prompt when script is selected (they're mutually exclusive for now)
  if (wfForm.script_id) {
    wfForm.prompt = ''
  }
}

watch(showWsBrowser, (val) => {
  if (val && wsFiles.value.length === 0) loadWsFiles()
})

onMounted(() => { loadWorkflows(); loadSchedules(); loadScripts(); loadExecutions() })
</script>
