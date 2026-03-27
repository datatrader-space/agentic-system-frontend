<template>
    <div class="agent-playground h-full flex flex-col bg-gray-100 overflow-hidden">

        <!-- Top Bar: Agent Info -->
        <div
            class="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-3 md:px-4 shrink-0 shadow-sm z-10">
            <div class="flex items-center gap-2 sm:gap-4 min-w-0">
                <BackButton fallback="/agents" size="sm" variant="ghost" />
                <div class="h-6 w-px bg-gray-200 hidden sm:block"></div>
                <h1 class="text-sm sm:text-lg font-bold text-gray-800 truncate">
                    {{ agent.id ? agent.name || 'Edit Agent' : 'New Agent' }}
                </h1>
            </div>

            <!-- Right: Actions -->
            <div class="flex items-center gap-2 flex-shrink-0">
                <button v-if="agent.id && isOwner" @click="toggleWorkspace"
                    class="h-9 px-3 rounded-lg border transition-all flex items-center gap-2 group text-xs font-semibold"
                    :class="showWorkspace ? 'bg-blue-50 border-blue-200 text-blue-600' : wsRouting?.routed ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'"
                    :title="wsRouting?.routed ? `Routed â†’ ${wsRouting.workspace.workspace_name}` : 'Workspace'">
                    <svg class="w-4 h-4 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <span class="hidden lg:inline">{{ wsRouting?.routed ? wsRouting.workspace.workspace_name : 'Workspace' }}</span>
                </button>
                
                <button v-if="agent.id" @click="showCredentials = !showCredentials"
                    class="h-9 px-3 rounded-lg border transition-all flex items-center gap-2 group text-xs font-semibold"
                    :class="showCredentials ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'"
                    title="Credentials">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    <span class="hidden lg:inline">Credentials</span>
                </button>
                
                <button v-if="isOwner" @click="showBuilder = !showBuilder"
                    class="h-9 px-3 rounded-lg border transition-all flex items-center gap-2 group text-xs font-semibold"
                    :class="showBuilder ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'"
                    title="Configure Agent">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                        <circle cx="12" cy="12" r="3" />
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                    </svg>
                    <span class="hidden lg:inline">Configure</span>
                </button>
            </div>
        </div>

        <!-- Main Workspace -->
        <div class="flex-1 flex h-0 overflow-hidden">

            <!-- Left: Builder (MODAL OVERLAY) -->
            <div v-if="showBuilder && isOwner" class="fixed inset-0 z-50 bg-black/50 flex justify-end"
                @click.self="showBuilder = false">
                <!-- Resize handle -->
                <div class="h-full w-1.5 cursor-col-resize hover:bg-indigo-400 active:bg-indigo-500 transition-colors flex items-center justify-center group"
                    @mousedown="startBuilderResize">
                    <div class="w-0.5 h-8 bg-gray-400 group-hover:bg-white rounded-full"></div>
                </div>
                <div class="h-full bg-white shadow-2xl animate-in slide-in-from-right duration-200 overflow-y-auto"
                    :style="{ width: builderWidth + 'px' }">
                    <AgentBuilder v-if="agent" v-model:agent="agent" :isSaving="saving" @save="saveAgent" @close="showBuilder = false" />
                </div>
            </div>

            <!-- Credentials Panel (slide-over, accessible to all users) -->
            <div v-if="showCredentials" class="fixed inset-0 z-50 bg-black/50 flex justify-end"
                @click.self="showCredentials = false">
                <div class="h-full w-full sm:w-[500px] bg-white shadow-2xl animate-in slide-in-from-right duration-200 flex flex-col">
                    <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
                        <h2 class="text-base font-bold text-gray-800">ðŸ”‘ Credentials</h2>
                        <button @click="showCredentials = false" class="p-1.5 hover:bg-gray-100 rounded text-gray-500 transition">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    <div class="flex-1 overflow-y-auto">
                        <CredentialManager v-if="agent.id" :agent-profile="agent" />
                    </div>
                </div>
            </div>


            <!-- Workspace Panel (slide-over) -->
            <div v-if="showWorkspace" class="fixed inset-0 z-50 bg-black/50 flex justify-end"
                @click.self="showWorkspace = false">
                <div class="h-full w-full sm:w-[520px] bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
                    <!-- Header -->
                    <div class="flex items-center justify-between px-3 sm:px-5 py-3 sm:py-4 border-b border-gray-200 shrink-0">
                        <div class="flex items-center gap-2">
                            <button @click="showWorkspace = false" class="flex sm:hidden items-center gap-1 text-gray-700 hover:text-gray-900 mr-1 min-h-[44px] min-w-[44px]">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                                <span class="text-sm font-medium">Back</span>
                            </button>
                            <svg class="w-5 h-5 hidden sm:block" :class="wsRouting?.routed ? 'text-green-600' : 'text-blue-600'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                            <h2 class="text-sm sm:text-base font-bold text-gray-800">{{ wsRouting?.routed ? 'Remote Workspace' : 'Local Workspace' }}</h2>
                            <span v-if="!wsRouting?.routed && wsFiles.length" class="text-xs text-gray-400 ml-1">({{ wsFormatSize(wsTotalSize) }})</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <button @click="loadWorkspace" :disabled="wsLoading"
                                class="p-1.5 hover:bg-gray-100 rounded text-gray-500 transition" title="Refresh">
                                <svg class="w-4 h-4" :class="{ 'animate-spin': wsLoading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </button>
                            <button @click="showWorkspace = false" class="p-1.5 hover:bg-gray-100 rounded text-gray-500 transition">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    </div>

                    <!-- Content -->
                    <div class="flex-1 overflow-y-auto">
                        <!-- Routing Status Banner -->
                        <div v-if="wsRouting?.routed" class="mx-3 mt-3 mb-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <div class="flex items-center gap-2 mb-1">
                                <span class="w-2 h-2 rounded-full bg-green-500"></span>
                                <span class="text-sm font-semibold text-green-800">Remote Routing Active</span>
                            </div>
                            <p class="text-xs text-green-700 leading-relaxed">
                                Tools execute on <strong>{{ wsRouting.workspace.workspace_name }}</strong>
                                <span v-if="wsRouting.workspace.workspace_path"> Â· {{ wsRouting.workspace.workspace_path }}</span>
                                <span v-if="wsRouting.workspace.agent_version"> Â· v{{ wsRouting.workspace.agent_version }}</span>
                            </p>
                        </div>
                        <!-- Antigravity Status Badge (always visible when workspace is routed) -->
                        <div v-if="wsRouting?.routed" class="mx-3 mt-2 p-2.5 rounded-lg" :class="cascadeStatus?.available ? 'bg-purple-50 border border-purple-200' : 'bg-gray-50 border border-gray-200'">
                            <div class="flex items-center gap-2">
                                <span class="text-sm">âœ¨</span>
                                <span class="text-xs font-semibold" :class="cascadeStatus?.available ? 'text-purple-800' : 'text-gray-500'">Antigravity</span>
                                <span v-if="cascadeStatus?.available" class="ml-auto text-[10px] text-purple-500 font-mono">port:{{ cascadeStatus.ls_port }}</span>
                                <span v-else class="ml-auto flex items-center gap-1">
                                    <span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                                    <span class="text-[10px] text-gray-400">Not detected</span>
                                </span>
                            </div>
                            <p v-if="cascadeStatus?.available && cascadeSessions.length" class="text-[10px] text-purple-600 mt-1">
                                {{ cascadeSessions.length }} session(s) available
                            </p>
                            <p v-else-if="!cascadeStatus?.available" class="text-[10px] text-gray-400 mt-1">
                                Open Antigravity IDE on this workspace to enable
                            </p>
                        </div>
                        <div v-else-if="wsRouting && !wsRouting.routed" class="mx-3 mt-3 mb-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                            <p class="text-xs text-gray-500">Tools execute locally on the server. Assign this agent to a workspace and enable routing to execute remotely.</p>
                        </div>
                        <!-- Loading -->
                        <div v-if="wsLoading" class="flex items-center justify-center py-16">
                            <div class="animate-spin w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full"></div>
                        </div>

                        <!-- Empty -->
                        <div v-else-if="!wsFiles.length" class="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
                            <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                            <p class="text-sm">Workspace is empty</p>
                            <p class="text-xs text-gray-300">Files created by the agent will appear here</p>
                        </div>

                        <!-- Selection Toolbar -->
                        <div v-if="wsFiles.length" class="px-3 pt-2 flex items-center gap-2">
                            <!-- Sort toggle -->
                            <button @click="wsSortBy = wsSortBy === 'name' ? 'time' : 'name'"
                                class="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition flex items-center gap-1"
                                :title="wsSortBy === 'time' ? 'Sorted by recent' : 'Sorted by name'">
                                <svg v-if="wsSortBy === 'time'" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                <svg v-else class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"/></svg>
                                {{ wsSortBy === 'time' ? 'Recent' : 'Name' }}
                            </button>
                            <button v-if="!wsSelectionMode" @click="wsSelectionMode = true"
                                class="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition">
                                Select
                            </button>
                            <template v-else>
                                <button @click="wsBulkDelete" :disabled="!wsSelectedPaths.size"
                                    class="text-xs px-2 py-1 rounded transition"
                                    :class="wsSelectedPaths.size ? 'bg-red-100 hover:bg-red-200 text-red-600' : 'bg-gray-100 text-gray-400 cursor-not-allowed'">
                                    ðŸ—‘ï¸ Delete ({{ wsSelectedPaths.size }})
                                </button>
                                <button @click="wsSelectionMode = false; wsSelectedPaths = new Set()"
                                    class="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition">
                                    Cancel
                                </button>
                            </template>
                        </div>
                        
                        <!-- File Tree (recursive component) -->
                        <div v-if="wsFiles.length" class="p-3">
                            <WorkspaceTreeNode
                                :entries="wsSortedFiles"
                                :expandedDirs="wsExpandedDirs"
                                :previewPath="wsPreviewPath"
                                :getFileIcon="getFileIcon"
                                :formatSize="wsFormatSize"
                                :selectionMode="wsSelectionMode"
                                :selectedPaths="wsSelectedPaths"
                                @toggle-dir="wsToggleDir"
                                @read-file="wsReadFile"
                                @delete="wsDeleteEntry"
                                @toggle-select="wsToggleSelect"
                            />
                        </div>
                    </div>


                </div>
            </div>

            <!-- Prompt Builder Modal -->
            <PromptBuilder ref="promptBuilder" @insert="insertPrompt" />

            <!-- File Viewer Modal (images, videos, code) -->
            <FileViewer ref="fileViewer" :agentId="agent?.id" />

            <!-- HITL Modal -->
            <HITLModal
                :requests="hitlRequests"
                @respond="handleHitlRespond"
                @dismiss="handleHitlDismiss"
                @skip="handleHitlSkip"
            />



            <!-- Right: Preview / Chat -->
            <div class="flex-1 flex flex-col bg-white relative overflow-hidden">
                <!-- Desktop Navigation (Focused Design) -->
                <div class="hidden md:flex p-3 border-b border-gray-100 bg-white items-center justify-between sticky top-0 z-20">
                    <!-- Left: Navigation Actions -->
                    <div class="flex items-center gap-3">
                        <!-- Back to Preview (Primary Action) -->
                        <button v-if="activeTab !== 'chat'" @click="activeTab = 'chat'"
                            class="bg-blue-600 text-white text-[10px] font-black tracking-widest px-5 py-2 rounded-full shadow-lg hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all duration-300 flex items-center gap-2 group">
                            <svg class="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M11 19l-7-7 7-7" />
                            </svg>
                            BACK TO PREVIEW
                        </button>

                        <!-- Focused Tabs (Only in Chat Mode) -->
                        <div v-else class="flex bg-gray-100/80 backdrop-blur-md rounded-full p-1 gap-1 shadow-inner border border-gray-200/50">
                            <button v-for="tab in [
                                { id: 'knowledge', label: 'KNOWLEDGE' },
                                { id: 'data', label: 'DATA' },
                                { id: 'flows', label: 'FLOWS' },
                                { id: 'automation', label: 'AUTOMATION' }
                            ]" :key="tab.id" @click="activeTab = tab.id"
                                class="text-[10px] font-black tracking-widest px-4 py-1.5 rounded-full text-gray-500 hover:text-gray-700 hover:bg-white/50 transition-all duration-300">
                                {{ tab.label }}
                            </button>
                            
                            <!-- More Dropdown (Icon Only) -->
                            <div class="relative" ref="moreTabsRef">
                                <button @click="showMoreTabs = !showMoreTabs"
                                    class="text-gray-500 hover:text-gray-700 hover:bg-white/50 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300"
                                    title="More Options">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 5v.01M12 12v.01M12 19v.01" />
                                    </svg>
                                </button>
                                
                                <transition enter-active-class="transition duration-100 ease-out"
                                    enter-from-class="transform scale-95 opacity-0"
                                    enter-to-class="transform scale-100 opacity-100"
                                    leave-active-class="transition duration-75 ease-in"
                                    leave-from-class="transform scale-100 opacity-100"
                                    leave-to-class="transform scale-95 opacity-0">
                                    <div v-if="showMoreTabs" class="absolute left-0 mt-2 w-48 bg-white border border-gray-200 rounded-2xl shadow-2xl py-2 z-50 overflow-hidden">
                                        <button @click="activeTab = 'trace'; showMoreTabs = false"
                                            class="w-full text-left px-4 py-2 text-[10px] font-black tracking-widest text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors uppercase flex items-center gap-2">
                                            <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span> TRACE
                                        </button>
                                        <button @click="activeTab = 'tools'; showMoreTabs = false"
                                            class="w-full text-left px-4 py-2 text-[10px] font-black tracking-widest text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors uppercase flex items-center gap-2">
                                            <span class="w-1.5 h-1.5 rounded-full bg-orange-500"></span> TOOLS
                                        </button>
                                    </div>
                                </transition>
                            </div>
                        </div>
                    </div>

                    <!-- Right: Conversation Switcher -->
                    <div v-if="agent.id" class="relative flex-shrink-0" ref="convSwitcherRef">
                        <button @click="showConvSwitcher = !showConvSwitcher"
                            class="group flex items-center gap-2 h-9 px-3 rounded-lg border border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 transition-all duration-200">
                            <div class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" v-if="isTyping"></div>
                            <svg v-else class="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg>
                            <span class="text-xs font-semibold text-gray-700 truncate max-w-[100px] sm:max-w-[140px]">
                                {{ currentConvTitle || 'Select Conversation' }}
                            </span>
                            <svg class="w-3 h-3 text-gray-400 group-hover:text-blue-500 transition-all duration-200" :class="{ 'rotate-180': showConvSwitcher }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        <!-- Dropdown -->
                        <div v-if="showConvSwitcher"
                            class="absolute right-0 top-full mt-1 w-[calc(100vw-2rem)] sm:w-72 max-w-sm bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
                            <!-- New Conversation -->
                            <button @click="createNewConversation"
                                class="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-blue-600 hover:bg-blue-50 border-b border-gray-100 font-medium">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                                </svg>
                                New Conversation
                            </button>
                            <!-- New AG Session -->
                            <button v-if="wsRouting?.routed" @click="createNewCascadeSession"
                                class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-purple-50 border-b border-gray-100 font-medium"
                                :class="cascadeStatus?.available ? 'text-purple-600' : 'text-gray-400 cursor-not-allowed'"
                                :disabled="!cascadeStatus?.available">
                                <span class="text-sm">âœ¨</span>
                                New AG Session
                                <span v-if="!cascadeStatus?.available" class="text-[10px] text-gray-400 ml-auto">(not connected)</span>
                            </button>
                            <!-- Conversation List -->
                            <div class="max-h-64 overflow-y-auto" @scroll="onConvListScroll">
                                <div v-for="conv in conversations" :key="conv.id"
                                    class="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition border-b border-gray-50 last:border-0 flex items-center group/conv"
                                    :class="{ 'bg-blue-50 border-l-2 border-l-blue-500': conv.id === activeSessionId }">
                                    <button @click="switchConversation(conv.id)" class="flex-1 text-left min-w-0">
                                        <div class="flex items-center justify-between">
                                            <span class="text-sm font-medium text-gray-800 truncate max-w-[160px] flex items-center gap-1">
                                                <span v-if="conv._source === 'cascade'" title="Antigravity">âœ¨</span>
                                                {{ conv.title || 'Untitled' }}
                                            </span>
                                            <span class="text-[10px] text-gray-400 flex-shrink-0 ml-2">
                                                {{ conv.message_count || 0 }} msgs
                                            </span>
                                        </div>
                                        <div class="text-[10px] text-gray-400 mt-0.5">
                                            {{ formatConvTime(conv.updated_at) }}
                                        </div>
                                    </button>
                                    <button @click.stop="deleteConversation(conv.id)"
                                        class="ml-2 p-1 rounded hover:bg-red-100 text-gray-300 hover:text-red-500 transition opacity-0 group-hover/conv:opacity-100 flex-shrink-0"
                                        title="Delete conversation">
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                                <div v-if="conversations.length === 0" class="px-3 py-4 text-center text-xs text-gray-400">
                                    No conversations yet
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Mobile Navigation (Focused Design) -->
                <div class="flex md:hidden p-3 border-b border-gray-100 bg-white items-center sticky top-0 z-20 gap-2">
                    <!-- Back Button if active tab is NOT chat -->
                    <button v-if="activeTab !== 'chat'" @click="activeTab = 'chat'"
                        class="bg-blue-600 text-white text-[10px] font-black tracking-widest px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M11 19l-7-7 7-7" />
                        </svg>
                        BACK TO PREVIEW
                    </button>

                    <!-- Main Mobile Tabs (Only in Chat Mode) -->
                    <div v-else class="flex items-center gap-1.5 overflow-x-auto scrollbar-hide flex-1">
                        <button v-for="tab in [
                            { id: 'knowledge', icon: '📚', label: 'Context' },
                            { id: 'flows', icon: '🔄', label: 'Flows' },
                            { id: 'automation', icon: '⚡', label: 'Auto' }
                        ]" :key="tab.id" @click="activeTab = tab.id"
                            class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                            <span class="text-xs">{{ tab.icon }}</span>
                            <span class="text-[10px] font-bold uppercase tracking-wider">{{ tab.label }}</span>
                        </button>
                        
                        <!-- Mobile More Icon -->
                        <button @click="showMoreTabs = !showMoreTabs"
                            class="bg-gray-100 text-gray-500 w-8 h-8 rounded-full flex items-center justify-center border border-gray-200">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01" />
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- Trace Tab -->
                <div v-if="activeTab === 'trace'"
                    class="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center">
                    <SessionTrace v-if="activeSessionId" :session-id="activeSessionId" class="w-full h-full" />
                    <div v-else class="text-gray-400">
                        <div class="text-4xl mb-2 text-center">ðŸ”</div>
                        <p>Start a session to view trace details.</p>
                    </div>
                </div>

                <!-- Tools Tab -->
                <div v-if="activeTab === 'tools'" class="flex-1 min-h-0 overflow-y-auto flex flex-col">
                    <ToolsPanel v-if="agent.id" :agent-profile="agent" class="w-full h-full" />
                    <div v-else class="flex flex-col items-center justify-center h-full text-gray-400">
                        <div class="text-5xl mb-3">ðŸ”§</div>
                        <p class="text-lg font-medium">Tools Operations Panel</p>
                        <p class="text-sm mt-1">Save the agent to access tool management features</p>
                    </div>
                </div>

                <!-- Automation Tab -->
                <div v-if="activeTab === 'automation'" class="flex-1 min-h-0 overflow-y-auto flex flex-col">
                    <AutomationPanel v-if="agent.id" :agent-profile="agent" class="w-full h-full" />
                    <div v-else class="flex flex-col items-center justify-center h-full text-gray-400">
                        <div class="text-5xl mb-3">âš¡</div>
                        <p class="text-lg font-medium">Automation Panel</p>
                        <p class="text-sm mt-1">Save the agent to access workflows & scheduling</p>
                    </div>
                </div>


                <!-- Chat Interface (Always Active) -->
                <div v-if="activeTab === 'chat'" class="flex-1 flex flex-col overflow-hidden w-full bg-white">
                    <!-- Feed -->
                    <div class="flex-1 overflow-y-auto overflow-x-hidden pb-52 md:pb-32 bg-white" ref="feed" @scroll="handleScroll">
                        <!-- Restoring Session Indicator -->
                        <div v-if="isRestoring"
                            class="flex flex-col items-center justify-center h-full text-blue-600">
                            <svg class="w-12 h-12 animate-spin mb-4" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor"
                                    stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
                                </path>
                            </svg>
                            <p class="text-lg font-medium">Restoring Session...</p>
                            <p class="text-sm mt-1 text-blue-400">Reconnecting to your previous conversation</p>
                        </div>

                        <div v-else-if="chatEvents.length === 0 && !isTyping"
                            class="flex flex-col items-center justify-center h-full text-gray-400">
                            <div class="text-5xl mb-3">âœ¨</div>
                            <p class="text-lg font-medium">Agent {{ agent.name }} is ready</p>
                            <p class="text-sm mt-1 text-gray-400">Start a conversation below</p>
                        </div>

                        <div v-for="event in chatEvents" :key="event.id"
                            class="w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <!-- User -->
                            <div v-if="event.type === 'user'" class="group hover:bg-gray-50/50 transition-colors">
                                <div class="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
                                    <div class="flex items-start gap-2 sm:gap-4 justify-end">
                                        <div class="flex-1 pt-1 flex flex-col items-end">
                                            <div
                                                class="bg-blue-600 text-white px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl rounded-br-md max-w-[92%] sm:max-w-[85%] leading-relaxed whitespace-pre-wrap shadow-sm text-sm sm:text-base">
                                                {{ event.content }}
                                                <!-- Attached file badges -->
                                                <div v-if="event.attachments && event.attachments.length" class="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-blue-500/30">
                                                    <span v-for="(fname, fi) in event.attachments" :key="fi"
                                                        class="inline-flex items-center gap-1 text-xs bg-blue-500/40 text-blue-100 px-2 py-0.5 rounded-full">
                                                        <span>{{ getFileIcon(fname) }}</span>
                                                        <span class="max-w-[120px] truncate">{{ fname }}</span>
                                                    </span>
                                                </div>
                                            </div>
                                            <!-- Action Buttons -->
                                            <div
                                                class="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button @click="retryUserMessage(event)"
                                                    class="p-1.5 hover:bg-gray-200/70 rounded text-gray-600 hover:text-gray-900 transition-colors"
                                                    title="Retry this message">
                                                    <svg class="w-4 h-4" fill="none" stroke="currentColor"
                                                        viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round"
                                                            stroke-width="2"
                                                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                    </svg>
                                                </button>
                                                <button @click="editUserMessage(event)"
                                                    class="p-1.5 hover:bg-gray-200/70 rounded text-gray-600 hover:text-gray-900 transition-colors"
                                                    title="Edit message">
                                                    <svg class="w-4 h-4" fill="none" stroke="currentColor"
                                                        viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round"
                                                            stroke-width="2"
                                                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                        <div
                                            class="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs sm:text-sm font-semibold flex-shrink-0">
                                            U
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Assistant -->
                            <div v-if="event.type === 'assistant'"
                                class="group bg-gray-50/50 hover:bg-gray-50/70 transition-colors border-b border-gray-100/50">
                                <div class="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
                                    <div class="flex items-start gap-2 sm:gap-4">
                                        <!-- Avatar -->
                                        <div
                                            class="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs sm:text-sm font-semibold flex-shrink-0">
                                            AI
                                        </div>
                                        <div class="flex-1 pt-1 min-w-0">
                                            <!-- Streaming Indicator -->
                                            <div v-if="isProcessing && chatEvents[chatEvents.length - 1].id === event.id"
                                                class="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                                <svg class="w-3 h-3 animate-pulse" fill="currentColor"
                                                    viewBox="0 0 20 20">
                                                    <circle cx="10" cy="10" r="3" />
                                                </svg>
                                                <span>Generating...</span>
                                            </div>


                                            <!-- Content: Show rendered HTML during streaming (throttled updates), final render on completion -->
                                            <div v-if="event.streaming"
                                                class="prose prose-sm prose-slate max-w-none prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-code:text-blue-600 prose-code:bg-blue-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-a:text-blue-600 text-gray-800 leading-relaxed"
                                                v-html="event.renderedHtml || event.content">
                                            </div>
                                            <div v-else
                                                class="prose prose-sm prose-slate max-w-none prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-code:text-blue-600 prose-code:bg-blue-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-a:text-blue-600 text-gray-800 leading-relaxed"
                                                v-html="event.renderedHtml || formatMarkdown(event.content)">
                                            </div>

                                            <!-- Media Renderer for message artifacts (native generation) -->
                                            <MediaRenderer 
                                                v-if="hasMediaArtifacts(event.data)" 
                                                :artifacts="getMediaArtifacts(event.data)"
                                                class="mt-3"
                                            />

                                            <!-- Action Buttons -->
                                            <div
                                                class="flex gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button @click="copyToClipboard(event.content)"
                                                    class="p-1.5 hover:bg-gray-200/70 rounded text-gray-600 hover:text-gray-900 transition-colors"
                                                    title="Copy response">
                                                    <svg class="w-4 h-4" fill="none" stroke="currentColor"
                                                        viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round"
                                                            stroke-width="2"
                                                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                    </svg>
                                                </button>
                                                <button @click="regenerateResponse(event)"
                                                    class="p-1.5 hover:bg-gray-200/70 rounded text-gray-600 hover:text-gray-900 transition-colors"
                                                    title="Regenerate response">
                                                    <svg class="w-4 h-4" fill="none" stroke="currentColor"
                                                        viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round"
                                                            stroke-width="2"
                                                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Agent Planning -->
                            <div v-if="event.type === 'agent_planning'"
                                class="group bg-indigo-50/40 border-b border-indigo-100/50">
                                <div class="max-w-5xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
                                    <button v-if="event.completed" @click="event.collapsed = !event.collapsed"
                                        class="w-full flex items-start gap-4 text-left hover:bg-indigo-50/60 transition-colors rounded p-2 -m-2">
                                        <div
                                            class="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs sm:text-sm flex-shrink-0">
                                            <span v-if="event.collapsed">ðŸ§ </span>
                                            <span v-else>âœ“</span>
                                        </div>
                                        <div class="flex-1 pt-1 min-w-0">
                                            <div
                                                class="text-sm font-semibold text-indigo-900 mb-1 flex items-center gap-2">
                                                <span>Planning Complete</span>
                                                <svg :class="['w-4 h-4 text-indigo-600 transition-transform', event.collapsed ? '' : 'rotate-180']"
                                                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round"
                                                        stroke-width="2" d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                            <div v-show="!event.collapsed" class="mt-2 text-sm text-indigo-700">
                                                {{ event.data.message || event.data.status }}
                                            </div>
                                        </div>
                                    </button>
                                    <div v-else class="flex items-start gap-2 sm:gap-4">
                                        <div
                                            class="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs sm:text-sm flex-shrink-0">
                                            <svg class="w-4 h-4 sm:w-5 sm:h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor"
                                                    stroke-width="4"></circle>
                                                <path class="opacity-75" fill="currentColor"
                                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
                                                </path>
                                            </svg>
                                        </div>
                                        <div class="flex-1 pt-1 min-w-0">
                                            <div class="text-xs sm:text-sm font-semibold text-indigo-900 mb-1">Analyzing Request
                                            </div>
                                            <div class="text-xs sm:text-sm text-indigo-700 break-words">{{ event.data.message ||
                                                event.data.status }}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Agent Plan Generated -->
                            <div v-if="event.type === 'agent_plan_generated'"
                                class="group bg-blue-50/40 border-b border-blue-100/50">
                                <div class="max-w-5xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
                                    <button @click="event.collapsed = !event.collapsed"
                                        class="w-full flex items-start gap-2 sm:gap-4 text-left hover:bg-blue-50/60 transition-colors rounded p-2 -m-2">
                                        <div
                                            class="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs sm:text-sm flex-shrink-0">
                                            ðŸ“‹
                                        </div>
                                        <div class="flex-1 pt-1 min-w-0">
                                            <div
                                                class="text-sm font-semibold text-blue-900 mb-1 flex items-center gap-2">
                                                <span>Execution Plan Generated</span>
                                                <span
                                                    class="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">{{
                                                        event.data.step_count }} steps</span>
                                                <svg :class="['w-4 h-4 text-blue-600 transition-transform', event.collapsed ? '' : 'rotate-180']"
                                                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round"
                                                        stroke-width="2" d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                            <div v-show="!event.collapsed" class="mt-2">
                                                <div v-if="event.data.plan && event.data.plan.steps" class="space-y-2">
                                                    <div v-for="(step, idx) in event.data.plan.steps" :key="idx"
                                                        class="bg-white border border-blue-200 rounded p-3">
                                                        <div class="flex items-start gap-2">
                                                            <span
                                                                class="text-xs font-bold text-blue-600 bg-blue-100 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">{{
                                                                    step.id }}</span>
                                                            <div class="flex-1 min-w-0">
                                                                <p class="text-xs sm:text-sm text-blue-900 break-words">{{ step.description }}
                                                                </p>
                                                                <span :class="['text-xs px-2 py-0.5 rounded inline-block mt-1',
                                                                    step.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                                        step.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                                                                            'bg-gray-100 text-gray-600']">
                                                                    {{ step.status }}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            <!-- Agent Step (Hidden by default - just shows in execution flow) -->
                            <div v-if="event.type === 'agent_step' && !event.collapsed"
                                class="group bg-teal-50/20 border-l-4 border-teal-400">
                                <div class="max-w-5xl mx-auto px-3 sm:px-4 py-2">
                                    <div class="flex items-center gap-3">
                                        <div
                                            class="w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center text-white text-xs flex-shrink-0">
                                            {{ event.data.step + 1 }}
                                        </div>
                                        <div class="flex-1">
                                            <div class="text-xs font-medium text-teal-700">Executing step {{
                                                event.data.step + 1 }}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Tool Call -->
                            <div v-if="event.type === 'tool_call'"
                                class="group bg-amber-50/30 border-b border-amber-100/50">
                                <div class="max-w-5xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
                                    <div class="flex items-start gap-2 sm:gap-4">
                                        <div
                                            class="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-amber-500 flex items-center justify-center text-white text-xs sm:text-sm flex-shrink-0">
                                            ðŸ› ï¸
                                        </div>
                                        <div class="flex-1 pt-1 min-w-0">
                                            <div class="text-xs sm:text-sm font-semibold text-amber-900 mb-1 break-words">Using Tool: {{
                                                event.data.tool }}</div>
                                            <div class="font-mono text-[10px] sm:text-xs text-amber-800 bg-amber-50 p-2 rounded overflow-x-auto max-w-full break-all">{{
                                                event.data.params }}</div>
                                            <button v-if="getFileFromTool(event.data.tool, event.data.params)"
                                                @click="openFileViewer(getFileFromTool(event.data.tool, event.data.params))"
                                                class="mt-2 text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 px-2 py-1 rounded transition opacity-0 group-hover:opacity-100 flex items-center gap-1">
                                                <svg class="w-3 h-3" fill="none" stroke="currentColor"
                                                    viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round"
                                                        stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                                View File
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Tool Result -->
                            <div v-if="event.type === 'tool_result'"
                                class="group border-b" :class="event.data.document ? 'bg-emerald-50/30 border-emerald-100/50' : 'bg-purple-50/30 border-purple-100/50'">
                                <div class="max-w-5xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
                                    <div class="flex items-start gap-2 sm:gap-4">
                                        <div
                                            class="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white text-xs sm:text-sm flex-shrink-0"
                                            :class="event.data.document ? 'bg-emerald-500' : 'bg-purple-500'">
                                            {{ event.data.document ? '📄' : '📄' }}
                                        </div>
                                        <div class="flex-1 pt-1 min-w-0">
                                            <!-- Document Card -->
                                            <div v-if="event.data.document" class="space-y-3">
                                                <div class="bg-white rounded-xl border border-emerald-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                                                    <!-- Card Header -->
                                                    <div class="px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-between">
                                                        <div class="flex items-center gap-2 min-w-0">
                                                            <span class="text-white text-lg flex-shrink-0">📋</span>
                                                            <div class="min-w-0">
                                                                <h4 class="text-sm font-bold text-white truncate">{{ event.data.document.title }}</h4>
                                                                <p class="text-[10px] text-emerald-100 font-medium">v{{ event.data.document.version }} · {{ event.data.document.sections_count }} sections</p>
                                                            </div>
                                                        </div>
                                                        <span class="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-full flex-shrink-0"
                                                            :class="{
                                                                'bg-blue-100 text-blue-700': event.data.document.doc_type === 'seo_audit',
                                                                'bg-purple-100 text-purple-700': event.data.document.doc_type === 'plan',
                                                                'bg-amber-100 text-amber-700': event.data.document.doc_type === 'report',
                                                                'bg-indigo-100 text-indigo-700': event.data.document.doc_type === 'code_review',
                                                                'bg-rose-100 text-rose-700': event.data.document.doc_type === 'analysis',
                                                                'bg-gray-100 text-gray-700': !['seo_audit','plan','report','code_review','analysis'].includes(event.data.document.doc_type)
                                                            }">
                                                            {{ event.data.document.doc_type.replace('_', ' ') }}
                                                        </span>
                                                    </div>
                                                    <!-- Card Body -->
                                                    <div class="px-4 py-3">
                                                        <!-- Tags -->
                                                        <div v-if="event.data.document.tags && event.data.document.tags.length" class="flex flex-wrap gap-1.5 mb-3">
                                                            <span v-for="tag in event.data.document.tags.slice(0, 5)" :key="tag"
                                                                class="px-2 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-600 rounded-full">
                                                                {{ tag }}
                                                            </span>
                                                        </div>
                                                        <!-- Actions -->
                                                        <div class="flex items-center gap-2">
                                                            <a :href="'/api' + event.data.document.view_url"
                                                                target="_blank"
                                                                class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors border border-emerald-200">
                                                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                </svg>
                                                                View Document
                                                            </a>
                                                            <a :href="'/api' + event.data.document.download_url"
                                                                download
                                                                class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg transition-colors border border-gray-200">
                                                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                                </svg>
                                                                Download
                                                            </a>
                                                            <a :href="'/api' + event.data.document.download_url + '?format=markdown'"
                                                                download
                                                                class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-lg transition-colors border border-gray-200">
                                                                <span class="text-[10px]">MD</span>
                                                            </a>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <!-- Standard Tool Result (non-document) -->
                                            <template v-else>
                                                <div class="text-xs sm:text-sm font-semibold text-purple-900 mb-1 break-words">Tool Result: {{
                                                    event.data.tool_name }}</div>
                                            
                                                <!-- Request URL (for remote tools) -->
                                                <div v-if="event.data.request_url"
                                                    class="text-xs text-purple-600 mb-2 font-mono flex items-center gap-1.5 min-w-0">
                                                    <span class="px-1.5 py-0.5 rounded text-white text-[10px] font-bold uppercase flex-shrink-0"
                                                        :class="{
                                                            'bg-green-500': event.data.request_method === 'GET',
                                                            'bg-blue-500': event.data.request_method === 'POST',
                                                            'bg-amber-500': event.data.request_method === 'PATCH' || event.data.request_method === 'PUT',
                                                            'bg-red-500': event.data.request_method === 'DELETE',
                                                            'bg-gray-500': !['GET','POST','PATCH','PUT','DELETE'].includes(event.data.request_method)
                                                        }">
                                                        {{ event.data.request_method }}
                                                    </span>
                                                    <span class="truncate" :title="event.data.request_url">{{ event.data.request_url }}</span>
                                                </div>
                                            
                                                <!-- Media Renderer for artifacts -->
                                                <MediaRenderer 
                                                    v-if="hasMediaArtifacts(event.data)" 
                                                    :artifacts="getMediaArtifacts(event.data)"
                                                    class="mb-3"
                                                />
                                            
                                                <div
                                                    class="font-mono text-[10px] sm:text-xs text-purple-800 bg-white border border-purple-200 p-2 rounded max-h-40 overflow-y-auto overflow-x-auto break-all">
                                                    {{ formatToolResult(event.data.result) }}</div>
                                            </template>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Thought -->
                            <div v-if="event.type === 'thought'"
                                class="group bg-purple-50/20 border-b border-purple-100/30">
                                <div class="max-w-5xl mx-auto px-3 sm:px-4 py-3">
                                    <div class="flex items-start gap-2 sm:gap-4">
                                        <div
                                            class="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-purple-400 flex items-center justify-center text-white text-xs sm:text-sm flex-shrink-0">
                                            ðŸ’­
                                        </div>
                                        <div class="flex-1 pt-1 text-xs sm:text-sm text-purple-700 min-w-0 break-words">
                                            {{ event.content }}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Error -->
                            <div v-if="event.type === 'error'" class="group bg-red-50/30 border-b border-red-100/50">
                                <div class="max-w-5xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
                                    <div class="flex items-start gap-2 sm:gap-4">
                                        <div
                                            class="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-red-500 flex items-center justify-center text-white text-xs sm:text-sm flex-shrink-0">
                                            âŒ
                                        </div>
                                        <div class="flex-1 pt-1 min-w-0">
                                            <div class="text-xs sm:text-sm font-semibold text-red-900 mb-1">Error</div>
                                            <div class="text-xs sm:text-sm text-red-700 leading-relaxed break-words">{{ event.content ||
                                                event.data?.message || event.data?.error || 'An unknown error occurred'
                                                }}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Typing Indicator -->
                        <div v-if="isTyping"
                            class="bg-gray-50/30 border-b border-gray-100/50 animate-in fade-in duration-300">
                            <div class="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
                                <div class="flex items-start gap-4">
                                    <div
                                        class="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                                        AI
                                    </div>
                                    <div class="pt-1">
                                        <div class="flex items-center gap-1.5">
                                            <span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                                                style="animation-delay: 0ms; animation-duration: 0.6s"></span>
                                            <span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                                                style="animation-delay: 150ms; animation-duration: 0.6s"></span>
                                            <span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                                                style="animation-delay: 300ms; animation-duration: 0.6s"></span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Input (Glassmorphism Design) -->
                    <div
                        class="absolute bottom-14 md:bottom-0 left-0 right-0 bg-white/60 backdrop-blur-xl border-t border-white/20 pt-6 pb-4 md:pb-4">
                        <div class="max-w-5xl mx-auto px-4">
                            <!-- Input Container -->
                            <div class="relative group">
                                <div
                                    class="relative bg-white/80 backdrop-blur-sm border-2 border-gray-200/50 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 focus-within:border-blue-400 focus-within:ring-8 focus-within:ring-blue-500/10">
                                    <!-- Attachment Preview Strip -->
                                    <div v-if="pendingFiles.length" class="px-3 pt-3 pb-0">
                                        <div class="flex flex-wrap gap-2">
                                            <div v-for="(file, idx) in pendingFiles" :key="idx"
                                                class="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm group/file hover:border-blue-300 transition-colors">
                                                <span class="text-base">{{ getFileIcon(file.name) }}</span>
                                                <span class="max-w-[150px] truncate text-gray-700 font-medium">{{ file.name }}</span>
                                                <span class="text-gray-400 text-xs">{{ formatFileSize(file.size) }}</span>
                                                <button @click="removePendingFile(idx)"
                                                    class="ml-1 p-0.5 hover:bg-red-100 rounded text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover/file:opacity-100">
                                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                                                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="flex items-end gap-2 p-3">
                                        <!-- Left Actions -->
                                        <div class="flex items-center gap-1 flex-shrink-0 pb-1">
                                            <button @click="triggerFileInput"
                                                class="relative p-2 hover:bg-gray-100 rounded-xl transition-all duration-200 text-gray-500 hover:text-gray-700 active:scale-95"
                                                :class="{ 'text-blue-600 bg-blue-50': pendingFiles.length > 0 }"
                                                title="Attach files">
                                                <svg class="w-5 h-5" fill="none" stroke="currentColor"
                                                    viewBox="0 0 24 24" stroke-width="2">
                                                    <path stroke-linecap="round" stroke-linejoin="round"
                                                        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                                </svg>
                                                <span v-if="pendingFiles.length" class="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 text-white text-[10px] rounded-full flex items-center justify-center font-bold">{{ pendingFiles.length }}</span>
                                            </button>
                                            <input ref="fileInputRef" type="file" multiple :accept="ACCEPTED_EXTENSIONS"
                                                class="hidden" @change="handleFilesSelected" />
                                        </div>

                                        <!-- Input Textarea -->
                                        <textarea v-model="userMessage" placeholder="Type your message here..."
                                            class="flex-1 px-3 py-2.5 bg-transparent border-none outline-none text-gray-900 placeholder-gray-400 resize-none overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
                                            style="max-height: 200px; min-height: 24px; line-height: 1.5;"
                                            @keydown.enter.exact.prevent="sendMessage" @input="autoResizeTextarea"
                                            :disabled="isProcessing" rows="1" ref="inputRef"></textarea>

                                        <!-- Right Actions -->
                                        <div class="flex items-center gap-1 flex-shrink-0 pb-1">
                                            <!-- Stop Button (when agent session is active) -->
                                            <button v-if="isAgentSessionActive || isProcessing || isTyping"
                                                @click="stopExecution"
                                                class="p-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all duration-200 shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50"
                                                title="Stop generating">
                                                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                    <rect x="6" y="6" width="12" height="12" rx="2" />
                                                </svg>
                                            </button>

                                            <!-- Send Button -->
                                            <button v-else @click="sendMessage" :disabled="!userMessage.trim() && !pendingFiles.length" :class="[
                                                'p-2.5 rounded-xl transition-all duration-200 active:scale-95 shadow-md',
                                                (userMessage.trim() || pendingFiles.length)
                                                    ? 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg'
                                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                                            ]" title="Send message">
                                                <svg class="w-4 h-4" fill="none" stroke="currentColor"
                                                    viewBox="0 0 24 24" stroke-width="2.5">
                                                    <path stroke-linecap="round" stroke-linejoin="round"
                                                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>

                                    <!-- Character Count / Status Bar (Optional) -->
                                    <div v-if="userMessage.length > 500" class="px-4 pb-2 pt-0">
                                        <div class="text-xs text-gray-400 text-right">
                                            {{ userMessage.length }} characters
                                        </div>
                                    </div>
                                </div>

                                <!-- Keyboard Shortcut Hint -->
                                <div class="hidden sm:flex items-center justify-between mt-2 px-1">
                                    <p class="text-xs text-gray-500">
                                        Press <kbd
                                            class="px-1.5 py-0.5 text-xs font-semibold text-gray-600 bg-gray-100 border border-gray-300 rounded">Enter</kbd>
                                        to send
                                    </p>
                                    <p class="text-xs text-gray-400">
                                        Agent can make mistakes. Verify important information.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Floating Scroll Buttons -->
                    <div class="absolute bottom-36 md:bottom-32 right-4 sm:right-8 flex flex-col gap-2 z-30 pointer-events-none">
                        <button v-if="showScrollTop" @click="scrollToTop"
                            class="p-2.5 sm:p-3 bg-white/90 backdrop-blur shadow-xl border border-gray-100 rounded-full text-blue-600 hover:text-blue-700 hover:scale-110 active:scale-95 transition-all duration-300 pointer-events-auto group min-w-[44px] min-h-[44px] flex items-center justify-center"
                            title="Scroll to top">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"
                                    d="M5 15l7-7 7 7" />
                            </svg>
                        </button>
                        <button v-if="showScrollBottom" @click="scrollToBottom(true)"
                            class="p-2.5 sm:p-3 bg-white/90 backdrop-blur shadow-xl border border-gray-100 rounded-full text-blue-600 hover:text-blue-700 hover:scale-110 active:scale-95 transition-all duration-300 pointer-events-auto min-w-[44px] min-h-[44px] flex items-center justify-center"
                            title="Scroll to bottom">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"
                                    d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- Knowledge Interface -->
                <div v-if="activeTab === 'knowledge'" class="flex-1 flex flex-col overflow-hidden">
                    <AgentMemoryPanel v-if="agent.id" :agent-profile="agent" class="w-full h-full" />
                    <div v-else class="flex flex-col items-center justify-center h-full text-gray-400">
                        <div class="text-5xl mb-3">🧠</div>
                        <p class="text-lg font-medium">Agent Memory</p>
                        <p class="text-sm mt-1">Save the agent to access memory and knowledge cards</p>
                    </div>
                </div>

                <!-- Data Panel -->
                <div v-if="activeTab === 'data'" class="flex-1 flex flex-col overflow-hidden">
                    <AgentDataPanel v-if="agent.id" :agent-profile="agent" class="w-full h-full" />
                    <div v-else class="flex flex-col items-center justify-center h-full text-gray-400">
                        <div class="text-5xl mb-3">🗄️</div>
                        <p class="text-lg font-medium">Agent Data</p>
                        <p class="text-sm mt-1">Save the agent to access its data collections</p>
                    </div>
                </div>

                <!-- Flows Panel -->
                <div v-if="activeTab === 'flows'" class="flex-1 flex flex-col overflow-hidden">
                    <AgentFlowPanel v-if="agent.id" :agent-profile="agent" class="w-full h-full" />
                    <div v-else class="flex flex-col items-center justify-center h-full text-gray-400">
                        <div class="text-5xl mb-3">🔄</div>
                        <p class="text-lg font-medium">Agent Flows</p>
                        <p class="text-sm mt-1">Save the agent to access flow tracking</p>
                    </div>
                </div>
            </div>

        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, nextTick, onBeforeUnmount, watch, computed } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router';
import { marked } from 'marked';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css'; // Or any other style
import api from '../services/api';
import AgentBuilder from '../components/AgentBuilder.vue';
import CredentialManager from '../components/tools/CredentialManager.vue';
import SessionTrace from '../components/SessionTrace.vue';
import PromptBuilder from '../components/PromptBuilder.vue';
import FileViewer from '../components/FileViewer.vue';
import ToolsPanel from '../components/tools/ToolsPanel.vue';
import MediaRenderer from '../components/MediaRenderer.vue';
import WorkspaceTreeNode from '../components/WorkspaceTreeNode.vue';
import HITLModal from '../components/HITLModal.vue';
import AutomationPanel from '../components/AutomationPanel.vue';
import AgentMemoryPanel from '../components/knowledge/AgentMemoryPanel.vue';
import AgentFlowPanel from '../components/knowledge/AgentFlowPanel.vue';
import AgentDataPanel from '../components/knowledge/AgentDataPanel.vue';
import BackButton from '../components/BackButton.vue';

const route = useRoute();
const router = useRouter();

const agent = ref({
    name: 'New Agent',
    description: '',
    system_prompt_template: 'You are a helpful AI assistant enabled with tools.',
    prompt_mode: 'append',
    knowledge_scope: 'system',
    tool_ids: [],
    temperature: 0.7,
    max_history_messages: 50
});

const saving = ref(false);
const systems = ref([]);
const repositories = ref([]);
// New: LLM Models
const llmModels = ref([]);
const selectedContext = ref({ system: null, repo: null, model: null });
const activeSessionId = ref(null); // This is actually conversation_id in the new backend logic
const conversations = ref([]); // All conversations for this agent
  const convPage = ref(1);
  const convTotalPages = ref(1);
  const isLoadingMoreConvs = ref(false);
const cascadeSessions = ref([]); // Antigravity cascade sessions
const cascadeStatus = ref(null); // { available: bool, ls_port, ls_pid, ... }
const showConvSwitcher = ref(false); // Conversation dropdown toggle
const showMoreTabs = ref(false); // "More" tabs dropdown toggle
const convSwitcherRef = ref(null); // Ref for click-outside detection
const moreTabsRef = ref(null); // Ref for click-outside detection
const chatEvents = ref([]);
const userMessage = ref('');
const isProcessing = ref(false);
const isTyping = ref(false); // Typing indicator state
const ignoringMessages = ref(false); // Flag to ignore messages after stop
const isAgentSessionActive = ref(false); // Track if agent session is running (for stop button)
const activeTab = ref('chat');

// Tab helper for responsive tab bars
const tabClass = (tabId) => activeTab.value === tabId
    ? 'text-blue-600 font-bold border-b-2 border-blue-600'
    : 'text-gray-400 hover:text-gray-600';

// Mobile tab items with icons and short labels
const mobileTabItems = [
    { id: 'chat', icon: '💬', shortLabel: 'Chat' },
    { id: 'knowledge', icon: '📚', shortLabel: 'Knowledge' },
    { id: 'data', icon: '🗄️', shortLabel: 'Data' },
    { id: 'flows', icon: '🔄', shortLabel: 'Flows' },
    { id: 'trace', icon: '🔍', shortLabel: 'Trace' },
    { id: 'tools', icon: '🔧', shortLabel: 'Tools' },
    { id: 'automation', icon: '⚡', shortLabel: 'Auto' },
];

const showBuilder = ref(false); // Default to false (modal hidden)
const builderWidth = ref(700); // Default wider panel

const startBuilderResize = (e) => {
  e.preventDefault()
  const startX = e.clientX
  const startWidth = builderWidth.value

  const onMouseMove = (moveEvent) => {
    const delta = startX - moveEvent.clientX
    builderWidth.value = Math.min(Math.max(startWidth + delta, 400), window.innerWidth * 0.9)
  }

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}
const showWorkspace = ref(false);
const showCredentials = ref(false);

// Computed: is current user the agent owner?
const isOwner = computed(() => agent.value?.is_owner !== false);
const wsFiles = ref([]);
const wsTotalSize = ref(0);
const wsLoading = ref(false);
const wsExpandedDirs = ref({});
const wsPreviewContent = ref(null);
const wsPreviewPath = ref(null);
const wsRouting = ref(null); // { routed: true/false, workspace: {...} }
const wsSelectionMode = ref(false);
const wsSelectedPaths = ref(new Set());

// HITL state
const hitlRequests = ref([]);

const checkWorkspaceRouting = async () => {
    if (!agent.value?.id) return;
    try {
        const { data } = await api.getAgentWorkspaceRouting(agent.value.id);
        wsRouting.value = data;
    } catch (e) {
        wsRouting.value = null;
    }
};

const toggleWorkspace = async () => {
    showWorkspace.value = !showWorkspace.value;
    if (showWorkspace.value) {
        await checkWorkspaceRouting();
        loadWorkspace();
        fetchCascadeStatus();
    }
};

const loadWorkspace = async () => {
    if (!agent.value?.id) return;
    wsLoading.value = true;
    try {
        // If routing is active, fetch remote files from workspace agent
        if (wsRouting.value?.routed) {
            const wsId = wsRouting.value.workspace.workspace_id;
            // Cross-platform Python one-liner â€” works on Windows and Linux
            const pyCmd = `python -c "import os,json;print(json.dumps([{'name':e,'type':'directory' if os.path.isdir(e) else 'file','size':os.path.getsize(e) if os.path.isfile(e) else 0} for e in sorted(os.listdir('.'))]))"`;
            const { data } = await api.executeWorkspaceCommand(wsId, pyCmd, 10);
            if (data.success && data.output) {
                wsFiles.value = parseRemoteListing(data.output);
                wsTotalSize.value = 0;
            } else {
                wsFiles.value = [];
            }
        } else {
            // Local workspace files
            const { data } = await api.getAgentWorkspace(agent.value.id);
            wsFiles.value = data.files || [];
            wsTotalSize.value = data.total_size || 0;
        }
    } catch (e) {
        console.error('Failed to load workspace:', e);
        wsFiles.value = [];
    } finally {
        wsLoading.value = false;
    }
};

/**
 * Parse remote file listing â€” expects JSON array from Python one-liner.
 * Fallback: tries line-by-line parsing for non-JSON output.
 */
const parseRemoteListing = (output) => {
    if (!output || typeof output !== 'string') return [];
    // The output may have a command echo prefix â€” find the JSON array
    const jsonStart = output.indexOf('[');
    const jsonEnd = output.lastIndexOf(']');
    if (jsonStart !== -1 && jsonEnd !== -1) {
        try {
            const entries = JSON.parse(output.substring(jsonStart, jsonEnd + 1));
            return entries.map(e => ({
                name: e.name,
                type: e.type || 'file',
                size: e.size || 0,
                children: e.type === 'directory' ? [] : undefined,
            }));
        } catch (e) {
            // JSON parse failed, fall through to line-by-line
        }
    }
    // Fallback: line-by-line
    const entries = [];
    for (const line of output.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('$') || trimmed.startsWith('total ')) continue;
        if (trimmed.length < 256 && !trimmed.includes('  ')) {
            entries.push({ name: trimmed, type: 'file', size: 0 });
        }
    }
    return entries;
};

const wsToggleDir = (path) => {
    wsExpandedDirs.value[path] = !wsExpandedDirs.value[path];
};

const wsSortBy = ref('name'); // 'name' | 'time'

// Sort entries recursively according to wsSortBy
const sortEntries = (entries) => {
    const sorted = [...entries].sort((a, b) => {
        // Directories first, then files
        if (a.is_dir && !b.is_dir) return -1;
        if (!a.is_dir && b.is_dir) return 1;
        if (wsSortBy.value === 'time') {
            // Most recent first
            return (b.modified || 0) - (a.modified || 0);
        }
        // Alphabetical
        return (a.name || '').localeCompare(b.name || '');
    });
    return sorted.map(e => e.is_dir && e.children ? { ...e, children: sortEntries(e.children) } : e);
};

const wsSortedFiles = computed(() => sortEntries(wsFiles.value));

// Build flat list of all files from the sorted tree (for FileViewer navigation)
const flattenFiles = (entries) => {
    const result = [];
    for (const e of entries) {
        if (e.is_dir && e.children) {
            result.push(...flattenFiles(e.children));
        } else if (!e.is_dir) {
            result.push(e);
        }
    }
    return result;
};

const wsReadFile = async (entry) => {
    if (entry.is_dir) return;
    // Open ALL files through the enhanced FileViewer modal with sibling navigation
    // Use sorted tree so arrow nav matches displayed order
    const siblings = flattenFiles(wsSortedFiles.value);
    fileViewer.value?.open(entry, agent.value.id, siblings);
};

const wsDeleteEntry = async (entry) => {
    const label = entry.is_dir ? 'folder and all its contents' : 'file';
    if (!confirm(`Delete this ${label}?\n${entry.path}`)) return;
    try {
        await api.deleteWorkspaceFile(agent.value.id, entry.path);
        if (wsPreviewPath.value === entry.path) {
            wsPreviewContent.value = null;
            wsPreviewPath.value = null;
        }
        wsSelectedPaths.value.delete(entry.path);
        await loadWorkspace();
    } catch (e) {
        console.error('Delete failed:', e);
    }
};

const wsDownloadFile = async () => {
    if (!wsPreviewPath.value) return;
    try {
        const res = await api.downloadWorkspaceFile(agent.value.id, wsPreviewPath.value);
        const url = URL.createObjectURL(res.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = wsPreviewPath.value.split('/').pop();
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error('Download failed:', e);
    }
};

const wsToggleSelect = (path) => {
    const s = new Set(wsSelectedPaths.value);
    if (s.has(path)) s.delete(path);
    else s.add(path);
    wsSelectedPaths.value = s;
};

const wsBulkDelete = async () => {
    const count = wsSelectedPaths.value.size;
    if (!count) return;
    if (!confirm(`Delete ${count} selected item(s)?`)) return;
    try {
        await api.bulkDeleteWorkspaceFiles(agent.value.id, [...wsSelectedPaths.value]);
        wsSelectedPaths.value = new Set();
        wsSelectionMode.value = false;
        wsPreviewContent.value = null;
        wsPreviewPath.value = null;
        await loadWorkspace();
    } catch (e) {
        console.error('Bulk delete failed:', e);
    }
};

const wsFormatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};
const knowledgeDocs = ref([]);
const loadingDocs = ref(false);
const selectedDoc = ref(null);
const analyzingDoc = ref(false);
const docAnalysis = ref('');
const feed = ref(null); // Fix: Add ref for scroll container
const inputRef = ref(null); // Textarea ref for auto-resize
const promptBuilder = ref(null);
const fileViewer = ref(null);
const showScrollTop = ref(false);
const showScrollBottom = ref(false);
const isRestoring = ref(false);

// File upload state
const pendingFiles = ref([]);
const fileInputRef = ref(null);
const uploadingFiles = ref(false);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;
const ACCEPTED_EXTENSIONS = '.txt,.pdf,.docx,.csv,.json,.yaml,.yml,.md,.py,.js,.ts,.jsx,.tsx,.xlsx,.xls,.html,.xml,.log,.sql,.sh,.bat,.ps1,.cfg,.ini,.toml,.env,.gitignore,.css,.scss,.vue,.go,.rs,.java,.c,.cpp,.h,.rb,.php';

const triggerFileInput = () => {
    fileInputRef.value?.click();
};

const handleFilesSelected = (event) => {
    const files = Array.from(event.target.files || []);
    for (const file of files) {
        if (pendingFiles.value.length >= MAX_FILES) {
            alert(`Maximum ${MAX_FILES} files allowed per message.`);
            break;
        }
        if (file.size > MAX_FILE_SIZE) {
            alert(`File "${file.name}" exceeds 10MB limit.`);
            continue;
        }
        pendingFiles.value.push(file);
    }
    // Reset input so same file can be re-selected
    event.target.value = '';
};

const removePendingFile = (index) => {
    pendingFiles.value.splice(index, 1);
};

const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const getFileIcon = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const icons = {
        pdf: 'ðŸ“„', docx: 'ðŸ“', doc: 'ðŸ“', xlsx: 'ðŸ“Š', xls: 'ðŸ“Š', csv: 'ðŸ“Š',
        json: 'ðŸ”§', yaml: 'ðŸ”§', yml: 'ðŸ”§', toml: 'ðŸ”§', xml: 'ðŸ”§',
        py: 'ðŸ', js: 'ðŸ“œ', ts: 'ðŸ“œ', jsx: 'ðŸ“œ', tsx: 'ðŸ“œ', vue: 'ðŸ“œ',
        html: 'ðŸŒ', css: 'ðŸŽ¨', scss: 'ðŸŽ¨',
        md: 'ðŸ“–', txt: 'ðŸ“ƒ', log: 'ðŸ“ƒ',
        sql: 'ðŸ—ƒï¸', sh: 'âš™ï¸', bat: 'âš™ï¸', ps1: 'âš™ï¸',
        go: 'ðŸ“œ', rs: 'ðŸ“œ', java: 'ðŸ“œ', c: 'ðŸ“œ', cpp: 'ðŸ“œ', h: 'ðŸ“œ', rb: 'ðŸ“œ', php: 'ðŸ“œ'
    };
    return icons[ext] || 'ðŸ“Ž';
};

const uploadPendingFiles = async () => {
    if (!pendingFiles.value.length || !activeSessionId.value) return [];
    uploadingFiles.value = true;
    const uploadedNames = [];
    try {
        for (const file of pendingFiles.value) {
            try {
                await api.uploadConversationFile(activeSessionId.value, file);
                uploadedNames.push(file.name);
            } catch (err) {
                console.error(`Failed to upload ${file.name}:`, err);
            }
        }
        pendingFiles.value = [];
    } finally {
        uploadingFiles.value = false;
    }
    return uploadedNames;
};

const handleScroll = () => {
    if (!feed.value) return;
    const container = feed.value;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    // Show top button if scrolled down more than 400px
    showScrollTop.value = scrollTop > 400;

    // Show bottom button if more than 200px away from bottom
    showScrollBottom.value = (scrollHeight - scrollTop - clientHeight) > 400;
};

const scrollToTop = () => {
    if (feed.value) {
        feed.value.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }
};

const openPromptBuilder = () => {
    promptBuilder.value?.open();
};

const insertPrompt = (text) => {
    userMessage.value = text;
};

const getFileFromTool = (toolName, params) => {
    if (!['WRITE_FILE', 'READ_FILE', 'APPEND_FILE'].includes(toolName)) return null;
    try {
        const p = typeof params === 'string' ? JSON.parse(params) : params;
        return p.file || p.path || p.target_file || p.source_file;
    } catch (e) {
        return null;
    }
};

const openFileViewer = (path) => {
    fileViewer.value?.open(path);
};

const fetchContextData = async () => {
    try {
        const [sysRes, modelRes] = await Promise.all([
            api.getSystems(),
            api.getLlmModels()
        ]);
        systems.value = sysRes.data.results || sysRes.data;
        llmModels.value = modelRes.data.results || modelRes.data;
    } catch (e) {
        console.error("Context load failed", e);
    }
};

// Consolidated repository logic
const fetchRepositories = async (systemId) => {
    if (!systemId) {
        repositories.value = [];
        return;
    }
    try {
        const res = await api.getRepositories(systemId);
        repositories.value = res.data.results || res.data;
    } catch (e) {
        console.error("Failed to load repositories", e);
    }
};

watch(() => selectedContext.value.system, (newSysId) => {
    // Only reset if we are NOT in the middle of a restore (heuristic: if repo is verified?)
    // Actually, just let it reset, then fetchLastConversation re-sets it.
    // However, Vue watcher runs synchronously. 
    // If I set system, this runs: sets repo=null.
    // Then I set repo=saved.
    // It works fine.
    if (repositories.value.length > 0 && repositories.value[0].system !== newSysId) {
        selectedContext.value.repo = null;
    }
    fetchRepositories(newSysId);
    knowledgeDocs.value = [];
    selectedDoc.value = null;
});

const restoreSession = async (sessionId) => {
    try {
        isRestoring.value = true;
        console.log(`[Restore] Restoring session: ${sessionId}`);

        // 0. Fetch conversation details to restore context
        try {
            const convRes = await api.getConversation(sessionId);
            const conversation = convRes.data;

            // Restore context from conversation
            if (conversation.system) {
                selectedContext.value.system = conversation.system;
                await fetchRepositories(conversation.system);
                selectedContext.value.repo = conversation.repository;
            }
            if (conversation.llm_model) {
                selectedContext.value.model = conversation.llm_model;
            }
        } catch (err) {
            console.warn('[Restore] Could not fetch conversation details:', err);
        }

        // 1. Fetch events from backend API
        const response = await api.getSessionEvents(sessionId);

        if (!response.data) {
            console.error('[Restore] Invalid response from backend');
            localStorage.removeItem('agent_active_session_id');
            return;
        }

        const events = response.data.events || [];
        console.log(`[Restore] Replaying ${events.length} events...`);

        // 2. Replay events to update UI state
        for (const eventWrapper of events) {
            // Construct the event object expected by the WebSocket handler
            // The backend returns { event_type: "tool_call", data: {...}, created_at: "..." }
            const constructedEvent = {
                type: eventWrapper.event_type,
                ...eventWrapper.data
            };

            // Manually add events based on type
            if (eventWrapper.event_type === 'user') {
                chatEvents.value.push({
                    id: Date.now() + Math.random(),
                    type: 'user',
                    content: eventWrapper.data.content || eventWrapper.data.message,
                    data: eventWrapper.data
                });
            } else if (eventWrapper.event_type === 'assistant') {
                chatEvents.value.push({
                    id: Date.now() + Math.random(),
                    type: 'assistant',
                    content: eventWrapper.data.content || eventWrapper.data.message,
                    data: {
                        ...eventWrapper.data,
                        media_artifacts: eventWrapper.data.media_artifacts || []
                    }
                });
            } else if (eventWrapper.event_type === 'tool_call') {
                chatEvents.value.push({
                    id: Date.now() + Math.random(),
                    type: 'tool_call',
                    content: null,
                    data: {
                        tool: eventWrapper.data.tool,
                        params: eventWrapper.data.params
                    }
                });
            } else if (eventWrapper.event_type === 'tool_result') {
                chatEvents.value.push({
                    id: Date.now() + Math.random(),
                    type: 'tool_result',
                    content: null,
                    data: {
                        tool_name: eventWrapper.data.tool_name,
                        result: eventWrapper.data.result,
                        success: eventWrapper.data.success,
                        request_url: eventWrapper.data.request_url || '',
                        request_method: eventWrapper.data.request_method || ''
                    }
                });
            } else if (eventWrapper.event_type === 'agent_planning') {
                chatEvents.value.push({
                    id: `planning_${Date.now()}`,
                    type: 'agent_planning',
                    content: eventWrapper.data.message || eventWrapper.data.status,
                    data: eventWrapper.data,
                    collapsed: true,
                    completed: true
                });
            } else if (eventWrapper.event_type === 'agent_plan_generated') {
                chatEvents.value.push({
                    id: `plan_${Date.now()}`,
                    type: 'agent_plan_generated',
                    content: null,
                    data: eventWrapper.data,
                    collapsed: true
                });
            } else if (eventWrapper.event_type === 'agent_step') {
                chatEvents.value.push({
                    id: `step_${eventWrapper.data.step}_${Date.now()}`,
                    type: 'agent_step',
                    content: eventWrapper.data.thought,
                    data: eventWrapper.data,
                    collapsed: true
                });
            } else if (eventWrapper.event_type === 'thought') {
                chatEvents.value.push({
                    id: Date.now() + Math.random(),
                    type: 'thought',
                    content: eventWrapper.data.content || eventWrapper.data.message,
                    data: eventWrapper.data
                });
            } else if (eventWrapper.event_type === 'error') {
                chatEvents.value.push({
                    id: Date.now() + Math.random(),
                    type: 'error',
                    content: eventWrapper.data.message || eventWrapper.data.error || 'An error occurred',
                    data: eventWrapper.data
                });
            }
        }

        // 3. Update local state
        activeSessionId.value = sessionId;
        isAgentSessionActive.value = true; // Assume active until we see completion

        // Check if the history actually finished the session
        const lastEvent = events[events.length - 1];
        if (lastEvent && (lastEvent.event_type === 'agent_session_complete' || lastEvent.event_type === 'error')) {
            isAgentSessionActive.value = false;
            localStorage.removeItem('agent_active_session_id');
        }

        // Scroll to bottom after restoration
        await nextTick();
        scrollToBottom(true);

    } catch (err) {
        console.error('[Restore] Failed to restore session:', err);
        if (err.response?.status === 404) {
            console.log('[Restore] Session not found or expired');
        }
        localStorage.removeItem('agent_active_session_id');
    } finally {
        isRestoring.value = false;
    }
};

// Computed: current conversation title for switcher button
const currentConvTitle = computed(() => {
    const current = conversations.value.find(c => c.id === activeSessionId.value);
    return current ? (current.title || 'Untitled') : 'Select Conversation';
});

// Format relative time for conversation list
const formatConvTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
};

// Fetch all conversations for this agent (for the switcher)
const fetchConversations = async (reset = true) => {
    if (!agent.value.id) return;
    try {
        if (reset) convPage.value = 1;
        const res = await api.getConversations({
            agent_profile_id: agent.value.id,
            ordering: '-updated_at',
            page: convPage.value
        });
        const totalCount = res.data.count || 0;
        const pageSize = 30;
        convTotalPages.value = Math.ceil(totalCount / pageSize) || 1;
        if (res.data.results) {
            const tagged = res.data.results.map(c => ({ ...c, _source: 'aadml' }));
            if (reset) {
                conversations.value = tagged;
            } else {
                const existingIds = new Set(conversations.value.map(c => c.id));
                conversations.value.push(...tagged.filter(c => !existingIds.has(c.id)));
            }
        }
    } catch (e) {
        console.error("Failed to fetch conversations", e);
    }

    // Also fetch cascade sessions if workspace is routed
    await fetchCascadeSessions();
};

// Fetch Antigravity cascade sessions from workspace
const fetchCascadeSessions = async () => {
    if (!wsRouting.value?.routed) return;
    const wsId = wsRouting.value.workspace.workspace_id;
    try {
        const res = await api.get(`/cascade/sessions/?workspace_id=${wsId}`);
        if (res.data.sessions) {
            cascadeSessions.value = res.data.sessions.map(s => ({
                id: `cascade:${s.cascadeId}`,
                title: s.summary || `AG Session`,
                message_count: s.stepCount,
                updated_at: s.lastModifiedTime,
                _source: 'cascade',
                _cascadeId: s.cascadeId,
            }));
            // Merge into conversations list
            const aadmlConvs = conversations.value.filter(c => c._source !== 'cascade');
            conversations.value = [...aadmlConvs, ...cascadeSessions.value]
                .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
            // Sessions loaded â†’ AG is definitely available, refresh status
            if (!cascadeStatus.value?.available) {
                fetchCascadeStatus();
            }
        }
    } catch (e) {
        // Cascade not available â€” that's fine
        console.debug('Cascade sessions unavailable:', e.message);
    }
};

// Fetch cascade connection status
const fetchCascadeStatus = async () => {
    if (!wsRouting.value?.routed) return;
    const wsId = wsRouting.value.workspace.workspace_id;
    try {
        const res = await api.get(`/cascade/status/?workspace_id=${wsId}`);
        cascadeStatus.value = res.data;
    } catch (e) {
        cascadeStatus.value = null;
    }
};

const fetchLastConversation = async () => {
    if (!agent.value.id) return;
    try {
        const res = await api.getConversations({
            agent_profile_id: agent.value.id,
            ordering: '-updated_at',
            limit: 1
        });

        // Also populate full conversation list for switcher
        await fetchConversations();

        if (res.data.results && res.data.results.length > 0) {
            let lastConv = res.data.results[0];

            // If list view didn't include messages, fetch full details
            if (!lastConv.messages || lastConv.messages.length === 0) {
                try {
                    const detailRes = await api.getConversation(lastConv.id);
                    lastConv = detailRes.data;
                    console.log("Fetched detailed conversation:", lastConv);
                } catch (err) {
                    console.error("Failed to fetch conversation details", err);
                }
            }

            activeSessionId.value = lastConv.id;

            // Restore context
            if (lastConv.system) {
                // Set system. Watcher will trigger and clear repo.
                selectedContext.value.system = lastConv.system;

                // Fetch repos explicitly to ensure data availability for UI
                await fetchRepositories(lastConv.system);

                // Restore repo (overriding validation/watcher clear)
                selectedContext.value.repo = lastConv.repository;
            }
            selectedContext.value.model = lastConv.llm_model;

            // Restore chat history
            if (lastConv.messages) {
                chatEvents.value = lastConv.messages.map(msg => ({
                    id: msg.id,
                    type: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content,
                    data: msg
                }));

                // Aggressive scroll to bottom with multiple attempts
                const scrollToEnd = () => {
                    if (feed.value) {
                        feed.value.scrollTop = feed.value.scrollHeight;
                    }
                };

                // Immediate attempt
                nextTick(scrollToEnd);

                // Fallback attempts with increasing delays
                setTimeout(scrollToEnd, 100);
                setTimeout(scrollToEnd, 300);
                setTimeout(scrollToEnd, 500);
            }

            // Reconnect WS
            const repoId = lastConv.repository || '0';
            connectWebSocket(repoId);
        }
    } catch (e) {
        console.error("Failed to fetch last conversation", e);
    }
};

// Switch to a specific conversation
const loadMoreConversations = async () => {
    if (isLoadingMoreConvs.value || convPage.value >= convTotalPages.value) return;
    isLoadingMoreConvs.value = true;
    convPage.value++;
    await fetchConversations(false);
    isLoadingMoreConvs.value = false;
  };

  const onConvListScroll = (e) => {
    const el = e.target;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
        loadMoreConversations();
    }
  };

  const switchConversation = async (convId) => {
    showConvSwitcher.value = false;
    if (convId === activeSessionId.value) return;

    // Cascade session handling
    if (convId?.startsWith?.('cascade:')) {
        activeSessionId.value = convId;
        chatEvents.value = [];
        const cascadeId = convId.replace('cascade:', '');
        const wsId = wsRouting.value?.workspace?.workspace_id;
        if (wsId) {
            await loadCascadeSteps(cascadeId, wsId);
        }
        return;
    }

    try {
        const detailRes = await api.getConversation(convId);
        const conv = detailRes.data;

        activeSessionId.value = conv.id;
        chatEvents.value = [];

        // Restore context
        if (conv.system) {
            selectedContext.value.system = conv.system;
            await fetchRepositories(conv.system);
            selectedContext.value.repo = conv.repository;
        }
        selectedContext.value.model = conv.llm_model;

        // Load messages
        if (conv.messages) {
            chatEvents.value = conv.messages.map(msg => ({
                id: msg.id,
                type: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content,
                data: msg
            }));

            nextTick(() => {
                if (feed.value) feed.value.scrollTop = feed.value.scrollHeight;
            });
        }

        // Reconnect WS
        const repoId = conv.repository || '0';
        connectWebSocket(repoId);
    } catch (e) {
        console.error("Failed to switch conversation", e);
    }
};

// Safely extract string content from a cascade step (some fields may be objects)
const stepToString = (val) => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    // AG sometimes nests content as {text: '...'} or {message: '...'}
    if (typeof val === 'object') return val.text || val.message || val.content || JSON.stringify(val);
    return String(val);
};

// Load cascade steps and map to chat events
const loadCascadeSteps = async (cascadeId, wsId) => {
    try {
        const res = await api.get(`/cascade/sessions/${cascadeId}/steps/?workspace_id=${wsId}`);
        if (res.data.steps) {
            chatEvents.value = res.data.steps
                .filter(step => {
                    const content = stepToString(step.plannerResponse) || stepToString(step.content) || stepToString(step.userMessage);
                    return !!content;
                })
                .map((step, i) => ({
                    id: `step-${i}`,
                    type: mapStepType(step.type),
                    content: stepToString(step.plannerResponse) || stepToString(step.content) || stepToString(step.userMessage) || '(empty step)',
                    data: step,
                }));
            nextTick(() => {
                if (feed.value) feed.value.scrollTop = feed.value.scrollHeight;
            });
        }
    } catch (e) {
        chatEvents.value.push({ id: Date.now(), type: 'assistant', content: `âš ï¸ Failed to load cascade steps: ${e.message}` });
    }
};

// Map AG step type to chat event type
const mapStepType = (stepType) => {
    // Only 'user' and 'assistant' are safe â€” the chat feed has no template for other types
    if (stepType === 'CORTEX_STEP_TYPE_USER_INPUT') return 'user';
    return 'assistant'; // Everything else renders as assistant message
};

// Poll cascade steps until done
let cascadePollTimer = null;
const pollCascadeSteps = (cascadeId, wsId) => {
    if (cascadePollTimer) clearInterval(cascadePollTimer);
    cascadePollTimer = setInterval(async () => {
        try {
            const res = await api.get(`/cascade/sessions/${cascadeId}/steps/?workspace_id=${wsId}`);
            if (res.data.steps) {
                // Keep user messages, replace rest
                const userEvents = chatEvents.value.filter(e => e.type === 'user');
                const stepEvents = res.data.steps
                    .filter(step => stepToString(step.plannerResponse) || stepToString(step.content) || stepToString(step.userMessage))
                    .map((step, i) => ({
                        id: `step-${i}`,
                        type: mapStepType(step.type),
                        content: stepToString(step.plannerResponse) || stepToString(step.content) || stepToString(step.userMessage) || '',
                        data: step,
                    }));
                chatEvents.value = [...userEvents, ...stepEvents];
                scrollToBottom();

                // Check if all done
                const running = res.data.steps.some(s => s.status === 'CORTEX_STEP_STATUS_RUNNING');
                if (res.data.steps.length > 0 && !running) {
                    clearInterval(cascadePollTimer);
                    cascadePollTimer = null;
                    isProcessing.value = false;
                    isTyping.value = false;
                    isAgentSessionActive.value = false;
                }
            }
        } catch (e) {
            clearInterval(cascadePollTimer);
            cascadePollTimer = null;
            isProcessing.value = false;
        }
    }, 2000);
};

// Create a new conversation for this agent
const createNewConversation = async () => {
    showConvSwitcher.value = false;
    try {
        const res = await api.startAgentChat(agent.value.id, null);
        activeSessionId.value = res.data.conversation_id;
        chatEvents.value = []; // Clear chat
        connectWebSocket(0);

        // Refresh conversation list
        await fetchConversations();
    } catch (e) {
        console.error('Failed to create new conversation:', e);
    }
};

// Create a new Antigravity cascade session
const createNewCascadeSession = async () => {
    showConvSwitcher.value = false;
    const prompt = window.prompt('Enter initial prompt for Antigravity:');
    if (!prompt) return;

    const wsId = wsRouting.value?.workspace?.workspace_id;
    if (!wsId) {
        alert('Workspace not connected');
        return;
    }

    isProcessing.value = true;
    chatEvents.value = [{ id: Date.now(), type: 'user', content: prompt }];

    try {
        const res = await api.post('/cascade/sessions/new/', {
            prompt,
            workspace_id: wsId,
            model: selectedContext.value.model || 246,
        });
        if (res.data.cascade_id) {
            activeSessionId.value = `cascade:${res.data.cascade_id}`;
            pollCascadeSteps(res.data.cascade_id, wsId);
            await fetchConversations();
        }
    } catch (err) {
        chatEvents.value.push({ id: Date.now(), type: 'assistant', content: `âš ï¸ Failed: ${err.message}` });
        isProcessing.value = false;
    }
};

// Delete a conversation
const deleteConversation = async (convId) => {
    if (!confirm('Delete this conversation? This cannot be undone.')) return;
    try {
        await api.delete(`/conversations/${convId}/`);
        // Remove from local list
        conversations.value = conversations.value.filter(c => c.id !== convId);
        // If we deleted the active conversation, switch to another or create new
        if (convId === activeSessionId.value) {
            if (conversations.value.length > 0) {
                switchConversation(conversations.value[0].id);
            } else {
                createNewConversation();
            }
        }
    } catch (e) {
        console.error('Failed to delete conversation:', e);
    }
};

// Click-outside to close conversation switcher
const handleClickOutside = (e) => {
    if (convSwitcherRef.value && !convSwitcherRef.value.contains(e.target)) {
        showConvSwitcher.value = false;
    }
    if (moreTabsRef.value && !moreTabsRef.value.contains(e.target)) {
        showMoreTabs.value = false;
    }
};

onMounted(async () => {
    const id = route.params.id;
    if (id !== 'new') {
        agent.value.id = id; // Set ID early
        await fetchAgent(id);
        await fetchContextData();
        checkWorkspaceRouting(); // Check routing status for toolbar indicator
        fetchCascadeStatus(); // Check Antigravity connection for cascade features

        // Session restoration disabled — was causing "unknown message subscribe" errors
        // and always failing to reconnect dead sessions
        // TODO: Re-enable when backend supports WS subscribe message type
        localStorage.removeItem('agent_active_session_id');

        // Fetch last conversation normally
        await fetchLastConversation();

        // Auto-init chat session if none exists
        if (!activeSessionId.value && agent.value.id) {
            await initChatSession();
        }
    } else {
        await fetchContextData();
    }

    // Register click-outside handler
    document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
    document.removeEventListener('click', handleClickOutside);
});

const initChatSession = async () => {
    try {
        const res = await api.startAgentChat(agent.value.id, null); // No repository needed
        activeSessionId.value = res.data.conversation_id;
        // Use repository ID 0 for agent-only chat (no repo required)
        connectWebSocket(0);

        // Refresh conversation list for switcher
        await fetchConversations();
    } catch (e) {
        console.error('Failed to initialize chat:', e);
    }
};

const loadKnowledge = async () => {
    activeTab.value = 'knowledge';

    // Combine Repo Knowledge + Agent Knowledge
    const docs = [];

    // 1. Agent Knowledge
    if (agent.value.knowledge_files) {
        docs.push(...agent.value.knowledge_files.map(f => ({
            ...f,
            kind: 'agent_file',
            spec_id: f.id, // Use ID as spec_id
            title: f.name || `File ${f.id}`,
            content: null, // Should fetch if needed, but ContextFile has file url
            analyzed: !!f.analysis,
            analysis: f.analysis
        })));
    }

    // 2. Repo Knowledge (if configured)
    if (selectedContext.value.system && selectedContext.value.repo) {
        try {
            loadingDocs.value = true;
            const res = await api.getKnowledgeDocs(selectedContext.value.system, selectedContext.value.repo);
            if (res.data.docs) {
                docs.push(...res.data.docs);
            }
        } catch (e) {
            console.error("Failed to load repo docs", e);
        } finally {
            loadingDocs.value = false;
        }
    }

    knowledgeDocs.value = docs;
};

const selectDoc = async (doc) => {
    selectedDoc.value = doc;

    // If analysis exists locally, show it
    if (doc.analysis) {
        docAnalysis.value = doc.analysis;
        return;
    }

    // Otherwise clear and wait for user to Analyze
    docAnalysis.value = '';
};

const analyzeCurrentDoc = async () => {
    if (!selectedDoc.value) return;

    analyzingDoc.value = true;
    docAnalysis.value = '';

    try {
        let analysis = '';

        if (selectedDoc.value.kind === 'agent_file') {
            // Agent Context File
            const res = await api.analyzeContextFile(selectedDoc.value.spec_id);
            // API returns { status: 'analyzed', analysis: '...' }
            analysis = res.data.analysis;

            // Update local state
            selectedDoc.value.analysis = analysis;
            selectedDoc.value.analyzed = true;

        } else {
            // Repository Knowledge
            const res = await api.analyzeKnowledgeDoc(
                selectedContext.value.system,
                selectedContext.value.repo,
                selectedDoc.value.kind,
                selectedDoc.value.spec_id
            );
            analysis = res.data.summary;
        }

        docAnalysis.value = analysis;

    } catch (e) {
        console.error("Analysis failed", e);
        docAnalysis.value = "Failed to generate analysis: " + e.message;
    } finally {
        analyzingDoc.value = false;
    }
};

const startChatWithContext = () => {
    activeTab.value = 'chat';
    // Optional: Pre-fill message or context system prompt
    if (selectedDoc.value) {
        userMessage.value = `Let's discuss the document: ${selectedDoc.value.title}`;
    }
};

const fetchAgent = async (id) => {
    try {
        const res = await api.get(`/agents/${id}/`);
        // Ensure tool_ids maps to tools objects if API returns expanded objects
        // The serializer expects tool_ids for write, but read might separate them
        const data = res.data;
        if (!data.tool_ids && data.tools) {
            data.tool_ids = data.tools.map(t => t.id);
        }
        agent.value = data;
    } catch (e) {
        console.error("Agent load failed", e);
    }
};

const saveAgent = async (agentData) => {
    try {
        saving.value = true;
        const dataToSave = agentData || agent.value;
        let res;
        if (dataToSave.id) {
            res = await api.patch(`/agents/${dataToSave.id}/`, dataToSave);
        } else {
            res = await api.post('/agents/', dataToSave);
            // Redirect to edit mode to prevent duplicate creates
            router.replace(`/agents/${res.data.id}`);
        }
        agent.value = res.data;
        // Fix up tool ids again if needed
        if (!agent.value.tool_ids && agent.value.tools) {
            agent.value.tool_ids = agent.value.tools.map(t => t.id);
        }
        return agent.value;
    } catch (e) {
        alert("Failed to save agent: " + (e.response?.data?.error || e.message));
        return null;
    } finally {
        saving.value = false;
    }
};

// Custom renderer for code blocks
const renderer = new marked.Renderer();

// Helper to unescape HTML entities if content seems double-escaped
const unescapeHTML = (str) => {
    const p = document.createElement('p');
    p.innerHTML = str;
    return p.textContent || p.innerText || str;
};

const parseWireframe = (text) => {
    // Clean box drawing characters
    const cleanLines = text.split('\n')
        .map(line => line.replace(/[â”Œâ”â””â”˜â”œâ”¤â”€â”‚â€¢]/g, '').trim())
        .filter(line => line.length > 0);

    const data = {
        intent: '',
        steps: [],
        final: ''
    };

    let currentSection = '';
    
    cleanLines.forEach(line => {
        const lowerLine = line.toLowerCase();
        
        if (lowerLine.includes('user intent')) {
            currentSection = 'intent';
            return;
        }
        if (lowerLine.includes('execution steps') || lowerLine.includes('tool call summary')) {
            currentSection = 'steps';
            return;
        }
        if (lowerLine.includes('final output sources') || lowerLine.includes('final result')) {
            currentSection = 'final';
            return;
        }
        if (lowerLine.includes('agent execution wireframe') || lowerLine.includes('tools selected')) {
            return;
        }

        if (currentSection === 'intent') {
            data.intent += (data.intent ? ' ' : '') + line;
        } else if (currentSection === 'steps') {
            // Check if line indicates a new step (starts with a number or bullet)
            if (/^\d+/.test(line) || line.startsWith('Tool:') || line.startsWith('Step')) {
                data.steps.push({ title: line, details: [] });
            } else if (data.steps.length > 0) {
                data.steps[data.steps.length - 1].details.push(line);
            } else {
                 data.intent += (data.intent ? ' ' : '') + line;
            }
        } else if (currentSection === 'final') {
            data.final += (data.final ? ' ' : '') + line;
        }
    });

    return data;
};

const renderWireframeUI = (text) => {
    const data = parseWireframe(text);
    
    let stepsHtml = data.steps.map((step, idx) => `
        <div class="relative pl-8 pb-8 last:pb-0">
            <!-- Timeline Line -->
            ${idx < data.steps.length - 1 ? '<div class="absolute left-[11px] top-6 bottom-0 w-0.5 bg-slate-200"></div>' : ''}
            
            <!-- Timeline Dot -->
            <div class="absolute left-0 top-1 w-6 h-6 rounded-full border-2 border-blue-500 bg-white flex items-center justify-center z-10 shadow-sm">
                <span class="text-[10px] font-bold text-blue-600">${idx + 1}</span>
            </div>
            
            <!-- Step Card -->
            <div class="bg-slate-50 rounded-xl p-4 border border-slate-200 hover:border-blue-300 transition-colors shadow-sm">
                <h4 class="text-sm font-bold text-slate-800 mb-2 font-sans">${step.title}</h4>
                <div class="space-y-1.5 font-sans">
                    ${step.details.map(d => `
                        <p class="text-[12px] text-slate-600 font-medium leading-relaxed">
                            ${d.includes(':') ? `<span class="text-slate-400 font-mono text-[9px] uppercase font-bold mr-2 tracking-wider">${d.split(':')[0]}:</span>${d.split(':').slice(1).join(':')}` : d}
                        </p>
                    `).join('')}
                </div>
            </div>
        </div>
    `).join('');

    return `
        <div class="workflow-visualizer my-12 font-sans max-w-2xl mx-auto selection:bg-blue-100">
            <div class="bg-white rounded-3xl border border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.05)] overflow-hidden">
                <!-- Header -->
                <div class="bg-slate-900 px-6 py-5 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-blue-500 rounded-xl shadow-lg shadow-blue-500/20">
                            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                        </div>
                        <div>
                            <h2 class="text-xs font-black text-white tracking-[0.2em] uppercase">Execution Flow</h2>
                            <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Real-time Agent Trace</p>
                        </div>
                    </div>
                </div>

                <!-- Content Area -->
                <div class="p-8 space-y-8 bg-gradient-to-b from-white to-slate-50/30">
                    <!-- User Intent Node -->
                    <div class="relative pl-8">
                        <div class="absolute left-[11px] top-8 bottom-0 w-0.5 bg-blue-100/50"></div>
                        <div class="absolute left-0 top-1 w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center z-10 shadow-[0_0_15px_rgba(37,99,235,0.4)]">
                            <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                        </div>
                        <div class="bg-[#1e1e1e] rounded-2xl p-6 text-white shadow-2xl">
                            <span class="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2 block">Objectives</span>
                            <p class="text-[13px] font-medium leading-relaxed text-slate-100">${data.intent || 'Analyzing requirements...'}</p>
                        </div>
                    </div>

                    <!-- Steps Timeline -->
                    <div class="ml-1">${stepsHtml}</div>

                    <!-- Final Node -->
                    <div class="relative pl-8 pt-4">
                        <div class="absolute left-0 top-5 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center z-10 shadow-[0_0_15px_rgba(16,185,129,0.4)]">
                            <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                        </div>
                        <div class="bg-emerald-50 rounded-2xl p-6 border border-emerald-100">
                             <span class="text-[9px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-2 block">Resolution</span>
                             <p class="text-[13px] font-bold text-slate-800 leading-relaxed">${data.final || 'Task completed successfully.'}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
};

renderer.code = function ({ text, lang }) {
    const language = lang?.toLowerCase() || 'plaintext';
    
    // Wireframe Detection â€” only for explicitly tagged blocks
    const isWireframe = language === 'wireframe';
    
    if (isWireframe) {
        return renderWireframeUI(text);
    }

    // Regular Code Block
    let unescapedText = text;
    // If we see double escaping like &lt;span, try to unescape once
    if (text.includes('&lt;span') || text.includes('&amp;lt;')) {
        unescapedText = unescapeHTML(text);
    }

    let highlightedCode;
    try {
        const hljsLang = hljs.getLanguage(language) ? language : 'plaintext';
        highlightedCode = hljs.highlight(unescapedText, { language: hljsLang }).value;
    } catch (e) {
        highlightedCode = unescapedText;
    }

    return `
        <div class="code-block-container my-6 rounded-xl overflow-hidden bg-[#0d1117] border border-[#30363d] shadow-2xl group/code">
            <div class="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-[#30363d]">
                <div class="flex items-center gap-2">
                    <span class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.1em] font-mono">${language}</span>
                </div>
                <button 
                    class="copy-code-btn flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-gray-400 hover:text-white transition-all duration-200 rounded-md hover:bg-[#30363d] active:scale-95"
                    data-code="${encodeURIComponent(unescapedText)}"
                    title="Copy to clipboard"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span class="min-w-[40px] text-right">Copy</span>
                </button>
            </div>
            <pre class="p-5 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent selection:bg-blue-500/30"><code class="hljs language-${language} leading-relaxed font-mono text-[13px]">${highlightedCode}</code></pre>
        </div>
    `;
};
marked.setOptions({ renderer });

// Post-process: wrap <table> in scrollable container
const wrapTablesInScroller = (html) => {
    return html.replace(
        /<table([^>]*)>(.*?)<\/table>/gs,
        '<div class="table-scroll-wrapper"><table$1>$2</table></div>'
    );
};

// Helper to identify and style "Data Blocks" in Markdown (e.g., Product details)
const postProcessHtml = (html) => {
    // 1. Wrap "Product Details" sequences (bold fields) in formatted cards
    let processed = html.replace(
        /(<p><strong>(Product|Handle|Product ID|Price|Vendor|Status):<\/strong>.*?<\/p>)+/g,
        '<div class="data-card my-4 p-4 bg-gray-50 border border-gray-100 rounded-xl shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">$0</div>'
    );

    // 2. Identify "Success" messages and wrap them
    processed = processed.replace(
        /<p>(Task Completed Successfully|Success|Completed):?.*?<\/p>/gi,
        '<div class="success-banner my-4 p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl flex items-center gap-3 font-bold text-sm"><span>âœ…</span>$0</div>'
    );

    // 3. Pattern: Detect prominent video generation prompts
    processed = processed.replace(
        /<blockquote>(.*?)<\/blockquote>/gs,
        '<div class="prompt-container my-6 p-6 bg-slate-900 text-slate-100 rounded-2xl border-l-4 border-blue-500 shadow-2xl relative overflow-hidden"><div class="absolute top-0 right-0 p-2 text-[10px] font-black text-slate-700 uppercase tracking-widest">Generation Prompt</div>$1</div>'
    );

    return processed;
};

const formatMarkdown = (text) => postProcessHtml(wrapTablesInScroller(marked(text || '')));
const formatToolResult = (result) => {
    if (typeof result === 'object') return JSON.stringify(result, null, 2);
    return result;
};

// Media Artifact Helper Functions
const hasMediaArtifacts = (eventData) => {
    return eventData?.media_artifacts && 
           Array.isArray(eventData.media_artifacts) && 
           eventData.media_artifacts.length > 0;
};

const getMediaArtifacts = (eventData) => {
    // Transform backend format to MediaRenderer format
    // Backend: { file_url, media_type, ... }
    // MediaRenderer expects: { url, type, ... }
    const artifacts = eventData?.media_artifacts || [];
    return artifacts.map(artifact => ({
        id: artifact.id,
        url: artifact.url || artifact.file_url,
        type: artifact.type || artifact.media_type,
        title: artifact.title || artifact.description,
        description: artifact.description,
        filename: artifact.filename
    }));
};


// WebSo
const ws = ref(null);
const reconnectAttempts = ref(0);
const maxReconnectAttempts = 5;
const reconnectDelay = computed(() => Math.min(1000 * Math.pow(2, reconnectAttempts.value), 5000)); // Exponential backoff: 1s, 2s, 4s, max 5s

const connectWebSocket = (repoId) => {
    const host = import.meta.env.VITE_WS_HOST || window.location.host;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let wsUrl = `${protocol}//${host}/ws/chat/repository/${repoId || '0'}/`;

    // Tenancy: attach workspace context so consumer can bridge tool logs
    const wsId = localStorage.getItem('activeWorkspaceId');
    if (wsId) wsUrl += `?workspace_id=${wsId}`;

    // Check if already connected to the same URL
    if (ws.value && ws.value.url === wsUrl && ws.value.readyState === WebSocket.OPEN) {
        console.log('[Playground] Already connected to:', wsUrl);
        return;
    }

    // Close existing connection
    if (ws.value) {
        console.log('[Playground] Closing previous WS connection');
        ws.value.close();
    }

    console.log('[Playground] Connecting WS:', wsUrl);
    ws.value = new WebSocket(wsUrl);

    ws.value.onopen = () => {
        console.log('[Playground] WS Connected');
        reconnectAttempts.value = 0; // Reset on successful connection

        // Subscribe disabled — backend doesn't handle 'subscribe' message type
        // if (activeSessionId.value && isAgentSessionActive.value) {
        //     ws.value.send(JSON.stringify({ type: 'subscribe', conversation_id: activeSessionId.value }));
        // }
    };

    ws.value.onmessage = (event) => {
        const data = JSON.parse(event.data);

        // Ignore messages if stop was clicked (check FIRST before any logging)
        if (ignoringMessages.value && data.type !== 'stop_acknowledged') {
            console.log('[WS Message] IGNORING:', data.type, '(stop was clicked)');
            return;
        }

        console.log('[WS Message]', data.type, data);

        // Handle typing indicator
        if (data.type === 'assistant_typing') {
            // Don't update typing if we're in ignore mode
            if (!ignoringMessages.value) {
                isTyping.value = data.typing;
                if (data.typing) {
                    isAgentSessionActive.value = true;
                    scrollToBottom();
                }
            }
        } else if (data.type === 'assistant_message_chunk') {
            // CRITICAL: Check ignore flag first
            if (ignoringMessages.value) {
                console.log('[WS Message] DROPPING CHUNK - ignore flag:', ignoringMessages.value);
                return;
            }

            // Check if we're in a special workflow phase (planning, execution)
            const lastEvent = chatEvents.value[chatEvents.value.length - 1];
            const isInWorkflow = lastEvent && ['agent_planning', 'agent_plan_generated', 'agent_step'].includes(lastEvent.type);

            // If in workflow, don't show raw assistant messages - they're part of the workflow
            if (isInWorkflow) {
                console.log('[WS Message] Skipping assistant chunk - in workflow phase');
                return;
            }

            // Set processing flag if not already set (message streaming has started)
            if (!isProcessing.value) {
                isProcessing.value = true;
                isAgentSessionActive.value = true;
            }
            // Stop typing indicator when content starts streaming
            isTyping.value = false;

            // Streaming: append chunk to last assistant message or create new one
            if (chatEvents.value.length > 0 && chatEvents.value[chatEvents.value.length - 1].type === 'assistant') {
                const event = chatEvents.value[chatEvents.value.length - 1];
                event.content += data.chunk;
                event.streaming = true;

                // Throttled render+scroll: at most once per 400ms using rAF
                // Avoids blocking the event loop so incoming WS messages aren't queued up
                const now = performance.now();
                if (!event._nextRenderAt || now >= event._nextRenderAt) {
                    event._nextRenderAt = now + 400;
                    requestAnimationFrame(() => {
                        event.renderedHtml = formatMarkdown(event.content);
                        // Inline scroll â€” avoids nextTick() overhead
                        if (feed.value) {
                            const c = feed.value;
                            if (c.scrollHeight - c.scrollTop - c.clientHeight < 150) {
                                c.scrollTop = c.scrollHeight;
                            }
                        }
                    });
                }
            } else {
                // If not following an assistant message, create a new one
                chatEvents.value.push({
                    id: Date.now(),
                    type: 'assistant',
                    content: data.chunk,
                    streaming: true,
                    renderedHtml: null,
                    data
                });
            }
            // Don't scrollToBottom() on every chunk â€” handled by the throttled rAF above
        } else if (data.type === 'assistant_message_complete') {
            // Check ignore flag before finalizing
            if (ignoringMessages.value) {
                console.log('[WS Message] IGNORING completion due to stop');
                return;
            }

            // Check if this is a DONE message (final result) - always show these
            if (data.full_message && data.full_message.startsWith('DONE:')) {
                // Find or create the final assistant message
                const lastEvent = chatEvents.value[chatEvents.value.length - 1];
                if (lastEvent && lastEvent.type === 'assistant') {
                    lastEvent.content = data.full_message;
                } else {
                    chatEvents.value.push({
                        id: Date.now(),
                        type: 'assistant',
                        content: data.full_message,
                        data
                    });
                }
            }

            // Finalize streaming: do final markdown render and clear streaming state
            const streamingEvent = chatEvents.value.findLast(e => e.type === 'assistant');
            if (streamingEvent) {
                streamingEvent.streaming = false;
                streamingEvent._nextRenderAt = null;  // Reset throttle
                streamingEvent.renderedHtml = formatMarkdown(streamingEvent.content);
            }

            // Finalize the assistant message
            isTyping.value = false;
            isProcessing.value = false;
            isAgentSessionActive.value = false; // Disable stop button
            scrollToBottom();
        } else if (data.type === 'chat_response') {
            // Check ignore flag
            if (ignoringMessages.value) {
                console.log('[WS Message] IGNORING chat_response due to stop');
                return;
            }
            chatEvents.value.push({
                id: Date.now(),
                type: 'assistant',
                content: data.message,
                data
            });
            isProcessing.value = false;
        } else if (data.type === 'assistant') {
            // Native assistant response (e.g., from native media generation)
            if (ignoringMessages.value) {
                console.log('[WS Message] IGNORING assistant due to stop');
                return;
            }
            console.log('[ASSISTANT] Received assistant event:', data);
            console.log('[ASSISTANT] media_artifacts:', data.media_artifacts);
            
            chatEvents.value.push({
                id: Date.now(),
                type: 'assistant',
                content: data.content || data.message,
                data: {
                    ...data,
                    media_artifacts: data.media_artifacts || []
                }
            });
            isProcessing.value = false;
            isTyping.value = false;
            isAgentSessionActive.value = false;
            scrollToBottom();
        } else if (data.type === 'assistant_message') {
            // Assistant message from consumer (native media generation or streaming complete)
            if (ignoringMessages.value) {
                console.log('[WS Message] IGNORING assistant_message due to stop');
                return;
            }
            console.log('[ASSISTANT_MESSAGE] Received:', data);
            
            chatEvents.value.push({
                id: Date.now(),
                type: 'assistant',
                content: data.content || data.message,
                data: {
                    ...data,
                    media_artifacts: data.media_artifacts || []
                }
            });
            isProcessing.value = false;
            isTyping.value = false;
            isAgentSessionActive.value = false;
            scrollToBottom();
        } else if (data.type === 'media_generated') {
            // Media generated event (can be ignored as media is in assistant_message)
            console.log('[MEDIA_GENERATED] Received:', data.media_artifacts);
        } else if (data.type === 'error') {
            // Extract the actual error message from various possible locations
            const errorMessage = data.error || data.message || 'An unknown error occurred';

            chatEvents.value.push({
                id: Date.now(),
                type: 'error',
                content: errorMessage,
                data: {
                    message: errorMessage,
                    error: errorMessage
                }
            });
            isProcessing.value = false;
            isTyping.value = false; // Also reset typing indicator on error
            isAgentSessionActive.value = false;
            // Clear persisted session on error
            localStorage.removeItem('agent_active_session_id');
        } else if (data.type === 'stop_acknowledged') {
            console.log('[STOP] Acknowledged by backend:', data.message);
            // Reset ignore flag now that backend confirmed the stop
            ignoringMessages.value = false;
            isProcessing.value = false;
            isTyping.value = false;
            isAgentSessionActive.value = false;
            // Clear persisted session so page reload doesn't try to restore a dead session
            localStorage.removeItem('agent_active_session_id');
            // Finalize any in-progress streaming message
            const lastEvent = chatEvents.value.findLast(e => e.type === 'assistant');
            if (lastEvent && lastEvent.streaming) {
                lastEvent._nextRenderAt = null;
                lastEvent.content += '\n\nâ¹ï¸ _Stopped by user._';
                lastEvent.streaming = false;
                lastEvent.renderedHtml = formatMarkdown(lastEvent.content);
            }
            scrollToBottom();
        } else if (data.type === 'tool_call') {
            // Tool call event
            chatEvents.value.push({
                id: Date.now(),
                type: 'tool_call',
                content: null,
                data: {
                    tool: data.tool,
                    params: data.params
                }
            });
            isAgentSessionActive.value = true;
            scrollToBottom();
        } else if (data.type === 'tool_result') {
            // Tool result event
            console.log('[MEDIA DEBUG] Received tool_result event:', data);
            console.log('[MEDIA DEBUG] media_artifacts in data:', data.media_artifacts);
            console.log('[MEDIA DEBUG] media_artifacts length:', data.media_artifacts?.length || 0);
            
            chatEvents.value.push({
                id: Date.now(),
                type: 'tool_result',
                content: null,
                data: {
                    tool_name: data.tool_name,
                    result: data.result,
                    success: data.success,
                    request_url: data.request_url || '',
                    request_method: data.request_method || '',
                    media_artifacts: data.media_artifacts || [],
                    document: data.document || null
                }
            });
            
            console.log('[MEDIA DEBUG] Added to chatEvents. Total events:', chatEvents.value.length);
            const lastEvent = chatEvents.value[chatEvents.value.length - 1];
            console.log('[MEDIA DEBUG] Last event data:', lastEvent.data);
            console.log('[MEDIA DEBUG] hasMediaArtifacts check:', hasMediaArtifacts(lastEvent.data));
            
            scrollToBottom();
        } else if (data.type === 'agent_session_created' || data.type === 'agent_event') {
            // Agent session started - enable stop button
            if (data.event === 'session_start' || data.type === 'agent_session_created') {
                isAgentSessionActive.value = true;
                console.log('[Agent Session] Started - stop button enabled');
            }
        } else if (data.type === 'agent_planning') {
            // Handle planning phase - can have multiple states (analyzing_request, thinking, etc.)
            const existingPlanningIdx = chatEvents.value.findIndex(e => e.type === 'agent_planning');

            // Agent is actively working - keep session active
            isAgentSessionActive.value = true;

            if (existingPlanningIdx !== -1) {
                // Update existing planning event
                chatEvents.value[existingPlanningIdx].data = data;
                chatEvents.value[existingPlanningIdx].content = data.message || data.status;
            } else {
                // Create new planning event and mark any previous assistant message as complete
                // Stop any ongoing assistant message streaming
                isProcessing.value = false;

                chatEvents.value.push({
                    id: `planning_${Date.now()}`,
                    type: 'agent_planning',
                    content: data.message || data.status,
                    data,
                    collapsed: false,
                    streamingContent: '' // For capturing plan JSON chunks
                });
            }
            scrollToBottom();
        } else if (data.type === 'agent_plan_generated') {
            // Mark planning as complete and collapsed
            const planningIdx = chatEvents.value.findIndex(e => e.type === 'agent_planning');
            if (planningIdx !== -1) {
                chatEvents.value[planningIdx].collapsed = true;
                chatEvents.value[planningIdx].completed = true;
            }

            // Add plan generated event - this will show the full plan
            chatEvents.value.push({
                id: `plan_${Date.now()}`,
                type: 'agent_plan_generated',
                content: null,
                data,
                collapsed: false // Start expanded, will collapse when execution starts
            });
            scrollToBottom();
        } else if (data.type === 'agent_step') {
            // Don't create duplicate step events for thoughts
            const existingStepIdx = chatEvents.value.findIndex(
                e => e.type === 'agent_step' && e.data.step === data.step
            );

            if (existingStepIdx === -1) {
                // Add step event only if it doesn't exist
                chatEvents.value.push({
                    id: `step_${data.step}_${Date.now()}`,
                    type: 'agent_step',
                    content: data.thought,
                    data,
                    collapsed: true // Start collapsed
                });
                isAgentSessionActive.value = true;
                scrollToBottom();
            }
        } else if (data.type === 'agent_step_start') {
            // Auto-collapse the plan when execution starts
            const planIdx = chatEvents.value.findIndex(e => e.type === 'agent_plan_generated');
            if (planIdx !== -1) {
                chatEvents.value[planIdx].collapsed = true;
            }

            // Stop any streaming
            isProcessing.value = false;
        } else if (data.type === 'plan_step_completed') {
            // Update plan step status if plan is still visible
            const planIdx = chatEvents.value.findIndex(e => e.type === 'agent_plan_generated');
            if (planIdx !== -1 && chatEvents.value[planIdx].data.plan?.steps) {
                const step = chatEvents.value[planIdx].data.plan.steps.find(s => s.id === data.step_id);
                if (step) {
                    step.status = 'completed';
                }
            }
        } else if (data.type === 'agent_session_complete') {
            // Mark execution as complete - disable stop button
            console.log('[Agent Session] Complete - stop button disabled');
            isAgentSessionActive.value = false;
            isProcessing.value = false;
            isTyping.value = false;
            // Clear persisted session since it's complete
            localStorage.removeItem('agent_active_session_id');
        } else if (data.type === 'hitl_request') {
            // HITL: agent is asking the user for input
            console.log('[HITL] Received request:', data.request_id, data.interaction_type);
            hitlRequests.value.push({
                request_id: data.request_id,
                interaction_type: data.interaction_type,
                response_type: data.response_type,
                summary: data.summary,
                services: data.services || [],          // â† credential_setup rows
                payload: data.payload || {},
                options: data.options || [],
                urgency: data.urgency || 'medium',
                timeout_at: data.timeout_at || null
            });
        } else if (data.type === 'hitl_response_ack') {
            // HITL: backend acknowledged our response â€” remove from queue
            console.log('[HITL] Response acknowledged:', data.request_id);
            hitlRequests.value = hitlRequests.value.filter(
                r => r.request_id !== data.request_id
            );
        } else if (['agent_start', 'thought', 'completion'].includes(data.type)) {
            chatEvents.value.push({
                id: Date.now(),
                type: data.type,
                content: data.message || data.content,
                data
            });

            if (data.type === 'completion') {
                isProcessing.value = false;
            }
        }
    };

    ws.value.onerror = (error) => {
        console.error('[Playground] WS Error', error);
    };

    ws.value.onclose = (event) => {
        console.log('[Playground] WS Closed', event.code);

        // Attempt reconnection with backoff if not manually closed
        if (event.code !== 1000 && reconnectAttempts.value < maxReconnectAttempts) {
            reconnectAttempts.value++;
            const delay = reconnectDelay.value;
            console.log(`[Playground] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.value}/${maxReconnectAttempts})...`);

            setTimeout(() => {
                connectWebSocket(repoId);
            }, delay);
        } else if (reconnectAttempts.value >= maxReconnectAttempts) {
            console.error('[Playground] Max reconnection attempts reached, reloading page...');
            // Clear stale session state before reload
            localStorage.removeItem('agent_active_session_id');
            window.location.reload();
        }
    };
};

// â”€â”€ HITL Handlers â”€â”€
const handleHitlRespond = ({ request_id, response_value, feedback }) => {
    if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
        console.error('[HITL] Cannot send response â€” WebSocket not connected');
        return;
    }
    console.log('[HITL] Sending response for', request_id);
    ws.value.send(JSON.stringify({
        type: 'hitl_response',
        request_id,
        response_value,
        feedback
    }));
    // Optimistically remove from local queue
    hitlRequests.value = hitlRequests.value.filter(r => r.request_id !== request_id);
};

const handleHitlDismiss = (requestId) => {
    // Remove notification-only requests from queue
    hitlRequests.value = hitlRequests.value.filter(r => r.request_id !== requestId);
};

const handleHitlSkip = (requestId) => {
    // Rotate: move current request to end of queue
    const idx = hitlRequests.value.findIndex(r => r.request_id === requestId);
    if (idx !== -1) {
        const [skipped] = hitlRequests.value.splice(idx, 1);
        hitlRequests.value.push(skipped);
    }
};

const handleChatEvent = (data) => {
    // Legacy handler - may still be used by some message types
    if (data.type === 'assistant_message_chunk') {
        if (chatEvents.value.length > 0 && chatEvents.value[chatEvents.value.length - 1].type === 'assistant') {
            chatEvents.value[chatEvents.value.length - 1].content += data.chunk;
        } else {
            chatEvents.value.push({
                id: Date.now(),
                type: 'assistant',
                content: data.chunk
            });
        }
        isProcessing.value = true; // Still streaming
    } else if (data.type === 'assistant_message_complete') {
        isProcessing.value = false;
        // Ensure full message
        if (chatEvents.value.length > 0 && chatEvents.value[chatEvents.value.length - 1].type === 'assistant') {
            chatEvents.value[chatEvents.value.length - 1].content = data.full_message;
        }
    } else if (data.type === 'tool_call' || data.type === 'agent_tool_call') {
        chatEvents.value.push({
            id: Date.now(),
            type: 'tool_call',
            data: { tool: data.tool, params: data.tool_input || data.params }
        });
        isProcessing.value = true;
    } else if (data.type === 'agent_step' || data.type === 'agent_step_start') {
        if (data.thought) {
            chatEvents.value.push({
                id: Date.now(),
                type: 'thought',
                data: { content: data.thought }
            });
        }
    } else if (data.type === 'tool_result' || data.type === 'agent_tool_result') {
        chatEvents.value.push({
            id: Date.now(),
            type: 'tool_result',
            data: { tool_name: data.tool_name, result: data.result }
        });
    } else if (data.type === 'error' || data.type === 'agent_error') {
        isProcessing.value = false;
        isTyping.value = false;
        const errorMessage = data.error || data.message || 'An unknown error occurred';
        chatEvents.value.push({
            id: Date.now(),
            type: 'error',
            content: errorMessage,
            data: { message: errorMessage, error: errorMessage }
        });
    }

    scrollToBottom();
};

const sendMessage = async () => {
    if (!userMessage.value.trim() && !pendingFiles.value.length) return;

    const content = userMessage.value || (pendingFiles.value.length ? `[Attached ${pendingFiles.value.length} file(s)]` : '');
    const filesToUpload = [...pendingFiles.value];
    userMessage.value = '';
    pendingFiles.value = [];
    resetTextareaHeight(); // Reset textarea to initial height
    isProcessing.value = true;
    isTyping.value = true;
    isAgentSessionActive.value = true;

    // PERSISTENCE: Save active session ID
    if (activeSessionId.value) {
        localStorage.setItem('agent_active_session_id', activeSessionId.value);
    }

    // Add user message to UI (with attachment names)
    const attachmentNames = filesToUpload.map(f => f.name);
    chatEvents.value.push({
        id: Date.now(),
        type: 'user',
        content: content,
        attachments: attachmentNames.length ? attachmentNames : undefined
    });
    scrollToBottom(true);

    // Upload files via REST API before sending WebSocket message
    if (filesToUpload.length && activeSessionId.value) {
        try {
            for (const file of filesToUpload) {
                await api.uploadConversationFile(activeSessionId.value, file);
            }
        } catch (err) {
            console.error('File upload failed:', err);
        }
    }

    // Send to WS (or cascade API for AG sessions)
    const isCascadeSession = activeSessionId.value?.startsWith?.('cascade:');
    if (isCascadeSession) {
        const cascadeId = activeSessionId.value.replace('cascade:', '');
        const wsId = wsRouting.value?.workspace?.workspace_id;
        if (!wsId) {
            chatEvents.value.push({ id: Date.now(), type: 'assistant', content: 'âš ï¸ Workspace not connected' });
            isProcessing.value = false;
            return;
        }
        try {
            await api.post(`/cascade/sessions/${cascadeId}/send/`, {
                prompt: content,
                workspace_id: wsId,
                model: selectedContext.value.model || 246,
            });
            // Poll for steps
            pollCascadeSteps(cascadeId, wsId);
        } catch (err) {
            chatEvents.value.push({ id: Date.now(), type: 'assistant', content: `âš ï¸ Cascade send failed: ${err.message}` });
            isProcessing.value = false;
            isAgentSessionActive.value = false;
        }
    } else if (ws.value && ws.value.readyState === WebSocket.OPEN) {
        ws.value.send(JSON.stringify({
            type: 'chat_message',
            message: content,
            conversation_id: activeSessionId.value, // Must match the one created by start_chat
            agentId: agent.value?.id || null, // Link conversation to agent profile for model config
            model_id: selectedContext.value.model || agent.value?.default_model || null // Use selected or agent's default model
        }));
    } else {
        alert("Connection lost. Please restart session.");
        isProcessing.value = false;
    }
};

const stopExecution = () => {
    console.log('[STOP] ========== STOP BUTTON CLICKED ==========');
    console.log('[STOP] WS state:', ws.value?.readyState, 'OPEN=', WebSocket.OPEN);
    console.log('[STOP] activeSessionId:', activeSessionId.value);

    // Set the ignore flag FIRST before anything else
    ignoringMessages.value = true;
    console.log('[STOP] Set ignoringMessages = true');

    // Immediately stop UI processing state and disable stop button
    isProcessing.value = false;
    isTyping.value = false;
    isAgentSessionActive.value = false;
    console.log('[STOP] Reset UI state (isProcessing, isTyping, isAgentSessionActive)');

    if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
        console.error('[STOP] WebSocket not connected!');
        // Keep ignore flag active even if WS is closed
        setTimeout(() => {
            ignoringMessages.value = false;
            console.log('[STOP] Reset ignoringMessages after timeout (no WS)');
        }, 2000);
        return;
    }

    // Include conversation_id for proper backend handling
    const stopMessage = {
        type: 'stop_execution',
        conversation_id: activeSessionId.value
    };

    console.log('[STOP] Sending stop message to backend:', stopMessage);
    ws.value.send(JSON.stringify(stopMessage));
    console.log('[STOP] Stop message sent successfully');

    // Reset the flag after 5 seconds as fallback (in case backend doesn't respond)
    setTimeout(() => {
        if (ignoringMessages.value) {
            ignoringMessages.value = false;
            isProcessing.value = false;
            isTyping.value = false;
            isAgentSessionActive.value = false;
            console.log('[STOP] Reset ignoringMessages = false after 5s fallback timeout');
        }
    }, 5000);
};

const retryLast = () => {
    const lastUserEvent = chatEvents.value.slice().reverse().find(e => e.type === 'user');
    if (lastUserEvent) {
        userMessage.value = lastUserEvent.content;
        sendMessage();
    }
};

const scrollToBottom = async (force = false) => {
    await nextTick();
    if (!feed.value) return;

    const container = feed.value;
    const threshold = 100; // pixels
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;

    if (force || isNearBottom) {
        container.scrollTop = container.scrollHeight;
    }
};

// Auto-resize textarea function
const autoResizeTextarea = () => {
    if (!inputRef.value) return;
    const textarea = inputRef.value;
    textarea.style.height = '28px'; // Reset to min height
    const newHeight = Math.min(textarea.scrollHeight, 200); // Max 200px
    textarea.style.height = newHeight + 'px';
};

// Reset textarea height after sending message
const resetTextareaHeight = () => {
    if (inputRef.value) {
        inputRef.value.style.height = '28px';
    }
};

// Message Action Functions
const copyTextToClipboard = async (text) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.warn('Navigator clipboard failed, falling back', err);
        }
    }
    
    // Fallback: Use a hidden textarea
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    
    try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        return successful;
    } catch (err) {
        console.error('Fallback copy failed', err);
        document.body.removeChild(textarea);
        return false;
    }
};

const copyToClipboard = async (text) => {
    // Strip HTML tags for clean copy
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = text;
    const cleanText = tempDiv.textContent || tempDiv.innerText || '';
    await copyTextToClipboard(cleanText);
};

const retryUserMessage = (userEvent) => {
    // Retry the user's own message
    userMessage.value = userEvent.content;
    sendMessage();
};

const editUserMessage = (userEvent) => {
    // Prefill input for editing
    userMessage.value = userEvent.content;
    nextTick(() => {
        if (inputRef.value) {
            inputRef.value.focus();
            autoResizeTextarea();
        }
    });
};

const regenerateResponse = (assistantEvent) => {
    // Find the previous user message that triggered this response
    const assistantIndex = chatEvents.value.findIndex(e => e.id === assistantEvent.id);
    if (assistantIndex > 0) {
        // Look backwards for the user message
        for (let i = assistantIndex - 1; i >= 0; i--) {
            if (chatEvents.value[i].type === 'user') {
                userMessage.value = chatEvents.value[i].content;
                sendMessage();
                break;
            }
        }
    }
};

const retryMessage = (assistantEvent) => {
    // Find the user message that triggered this response
    const assistantIndex = chatEvents.value.findIndex(e => e.id === assistantEvent.id);
    if (assistantIndex > 0) {
        const previousUserMsg = chatEvents.value.slice(0, assistantIndex).reverse().find(e => e.type === 'user');
        if (previousUserMsg) {
            userMessage.value = previousUserMsg.content;
            sendMessage();
        }
    }
};

const correctResponse = (event) => {
    // Placeholder for future feedback/correction feature
    console.log('Correct response clicked for:', event);
    alert('Feedback feature coming soon! This will allow you to suggest corrections to improve the agent.');
};

// Scroll when new events are added (e.g. user sends message, new tool call, etc.)
watch(
    () => chatEvents.value.length,
    () => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (feed.value) {
                    feed.value.scrollTop = feed.value.scrollHeight;
                }
            });
        });
    }
);

// â”€â”€ Streaming auto-scroll â”€â”€
// Auto-scrolls smoothly during streaming.
// If the user manually scrolls, pauses for 2 seconds then auto-resumes.

let streamScrollRafId = null;
let streamScrollFrame = 0;
let lastUserScrollTime = 0;
const STREAM_SCROLL_PAUSE_MS = 2000;  // resume 2s after last manual scroll
const SCROLL_THROTTLE_FRAMES = 8;     // run every 8 frames (~7fps) â€” smooth feel

const handleFeedScroll = () => {
    if (!isProcessing.value) return;
    lastUserScrollTime = Date.now();
};

const startStreamScroll = () => {
    streamScrollFrame = 0;
    lastUserScrollTime = 0; // fresh start â€” immediately scroll on new message
    const loop = () => {
        if (!isProcessing.value) {
            streamScrollRafId = null;
            return;
        }
        streamScrollFrame++;
        if (streamScrollFrame % SCROLL_THROTTLE_FRAMES === 0 && feed.value) {
            const userJustScrolled = (Date.now() - lastUserScrollTime) < STREAM_SCROLL_PAUSE_MS;
            if (!userJustScrolled) {
                feed.value.scrollTo({ top: feed.value.scrollHeight, behavior: 'smooth' });
            }
        }
        streamScrollRafId = requestAnimationFrame(loop);
    };
    if (!streamScrollRafId) {
        streamScrollRafId = requestAnimationFrame(loop);
    }
};

const stopStreamScroll = () => {
    if (streamScrollRafId) {
        cancelAnimationFrame(streamScrollRafId);
        streamScrollRafId = null;
    }
    // Smooth scroll to bottom when streaming finishes
    if (feed.value) {
        feed.value.scrollTo({ top: feed.value.scrollHeight, behavior: 'smooth' });
    }
};

watch(isProcessing, (streaming) => {
    if (streaming) {
        startStreamScroll();
    } else {
        stopStreamScroll();
    }
});

const runAgent = async () => {
    if (agent.value.knowledge_scope === 'system' && !selectedContext.value.system) {
        alert("Please select a System Context for this agent.");
        return;
    }

    // Repository is now optional (Free Agent mode)
    const repoId = selectedContext.value.repo;

    try {
        // Save first (auto-save behavior)
        if (!agent.value.id) {
            const saved = await saveAgent();
            if (!saved) return;
        } else {
            // Also save updates before run
            await saveAgent();
        }

        // Start Chat
        isTyping.value = true;
        const res = await api.post(`/agents/${agent.value.id}/chat/`, {
            system_id: selectedContext.value.system,
            repository_id: repoId,
            llm_model_id: selectedContext.value.model
        });

        // Use conversation_id as the session ID
        activeSessionId.value = res.data.conversation_id || res.data.profile_id;
        chatEvents.value = []; // Clear previous events

        // Connect WS
        // If no repo, we need a way to chat. 
        // Currently WebSocket is /ws/chat/repository/:id/
        // We need a fallback or a generic chat WS for agents.
        // For now, if no repo, we might need to use a dummy ID or a new endpoint.
        // Let's assume backend handles '0' or 'none' or we need to update consumer routing.
        // Implementation Plan said: "If no repository is selected, ensure the consumer still functions (might need to relax get_repository logic)."
        // Let's use a special "agent" chat endpoint or assume repoId=0 works if backend logic allows.
        // Given current backend routing, let's use a dummy ID '0' and ensure backend handles it, 
        // OR better: use `ws/chat/agent/:conversation_id/` if possible?
        // The current consumers.py uses RepositoryChatConsumer mounted at /ws/chat/repository/<repo_id>/
        // We probably need to update routing.py or client side to use a "global" repo or system chat.
        // Let's use the repoId if exists, otherwise '0'.
        connectWebSocket(repoId || '0');

    } catch (e) {
        console.error(e);
        alert("Run failed: " + e.message);
        isAgentSessionActive.value = false;
    }
};

// Clean up WebSocket when leaving the page
onBeforeRouteLeave((to, from, next) => {
    console.log('[Playground] Route leaving, cleaning up WebSocket');
    if (ws.value) {
        ws.value.close();
        ws.value = null;
    }
    // Reset state
    isProcessing.value = false;
    isTyping.value = false;
    isAgentSessionActive.value = false;
    ignoringMessages.value = false;
    // Allow navigation
    next();
});

// Global click handler for copy buttons (delegation)
const handleGlobalClick = (e) => {
    const copyBtn = e.target.closest('.copy-code-btn');
    if (copyBtn) {
        const code = decodeURIComponent(copyBtn.dataset.code);
        copyTextToClipboard(code).then((success) => {
            if (!success) return;
            const span = copyBtn.querySelector('span');
            const svg = copyBtn.querySelector('svg');
            const originalText = span.textContent;
            
            // Success state
            span.textContent = 'Copied!';
            copyBtn.classList.add('text-green-400', 'bg-green-400/10');
            copyBtn.classList.remove('text-gray-400');
            
            // Temporary SVG change (Checkmark)
            const originalPath = svg.innerHTML;
            svg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />';
            
            setTimeout(() => {
                span.textContent = originalText;
                svg.innerHTML = originalPath;
                copyBtn.classList.remove('text-green-400', 'bg-green-400/10');
                copyBtn.classList.add('text-gray-400');
            }, 2000);
        });
    }
};

onMounted(() => {
    window.addEventListener('click', handleGlobalClick);
    fetchContextData();
    if (route.params.id && route.params.id !== 'new') {
        fetchAgent(route.params.id);
    }
});

// Attach scroll listener to feed once the ref is populated
watch(feed, (el) => {
    if (el) {
        el.addEventListener('scroll', handleFeedScroll, { passive: true });
    }
});

onBeforeUnmount(() => {
    window.removeEventListener('click', handleGlobalClick);
    if (feed.value) {
        feed.value.removeEventListener('scroll', handleFeedScroll);
    }
    stopStreamScroll();
    if (ws.value) {
        console.log('[Playground] Cleaning up WebSocket on unmount');
        ws.value.close();
        ws.value = null;
    }
});
</script>

<style scoped>
/* Custom Scrollbar for Textarea */
textarea::-webkit-scrollbar {
    width: 6px;
}

textarea::-webkit-scrollbar-track {
    background: transparent;
}

textarea::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 3px;
}

textarea::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
}

/* Smooth focus transition */
textarea:focus {
    outline: none;
}

/* Kbd tag styling */
kbd {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

/* Smooth animations */
@keyframes slideUp {
    from {
        opacity: 0;
        transform: translateY(10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.group:hover .group-hover\:shadow-xl {
    transition: all 0.2s ease-in-out;
}

/* Markdown and Syntax Highlighting Professional Overrides */
:deep(.prose) {
    color: #374151;
    max-width: none;
}

:deep(.code-block-container pre) {
    margin: 0;
    scrollbar-width: thin;
    scrollbar-color: #30363d transparent;
}

:deep(.code-block-container pre::-webkit-scrollbar) {
    height: 8px;
}

:deep(.code-block-container pre::-webkit-scrollbar-track) {
    background: transparent;
}

:deep(.code-block-container pre::-webkit-scrollbar-thumb) {
    background: #30363d;
    border-radius: 4px;
}

:deep(.hljs) {
    background: transparent !important;
    padding: 0 !important;
    font-size: 0.85rem;
    line-height: 1.6;
    font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
}

:deep(.prose code:not(.hljs)) {
    background-color: #f3f4f6;
    color: #2563eb;
    padding: 0.2rem 0.4rem;
    border-radius: 0.25rem;
    font-weight: 500;
}

:deep(.prose code::before), :deep(.prose code::after) {
    content: "" !important;
}

/* Professional Table Styling */
:deep(.prose table) {
    width: 100%;
    min-width: 600px; /* Ensure table doesn't get too squished */
    margin-top: 1.5rem;
    margin-bottom: 1.5rem;
    border-collapse: collapse;
    font-size: 0.875rem;
    line-height: 1.4;
    text-align: left;
    border: 1px solid #e5e7eb;
    border-radius: 0.8rem;
    overflow: hidden;
    display: table; /* Use table layout for better alignment */
}

/* Wrapper for horizontal scroll */
:deep(.prose) {
    overflow-x: auto;
    scrollbar-width: thin;
    scrollbar-color: #e5e7eb transparent;
}

:deep(.prose::-webkit-scrollbar) {
    height: 6px;
}

:deep(.prose::-webkit-scrollbar-thumb) {
    background-color: #e5e7eb;
    border-radius: 3px;
}

:deep(.prose thead) {
    background-color: #f8fafc;
    border-bottom: 2px solid #e2e8f0;
}

:deep(.prose th) {
    padding: 1rem 1.25rem;
    font-weight: 600;
    color: #1e293b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 0.75rem;
    white-space: nowrap;
}

:deep(.prose td) {
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #f1f5f9;
    color: #475569;
    vertical-align: top;
    min-width: 150px;
}

:deep(.prose tr:last-child td) {
    border-bottom: none;
}

:deep(.prose tr:nth-child(even)) {
    background-color: #f8fafc;
}

:deep(.prose tr:hover) {
    background-color: #f1f5f9;
}

/* Ensure text in prose wraps properly */
:deep(.prose) {
    overflow-wrap: break-word;
    word-wrap: break-word;
}

/* Table scroll wrapper â€” only the table scrolls, not the whole message */
:deep(.table-scroll-wrapper) {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    margin: 1rem 0;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
}

:deep(.table-scroll-wrapper table) {
    margin: 0 !important;
    border: none !important;
    min-width: 400px;
    width: 100%;
}

:deep(.table-scroll-wrapper)::-webkit-scrollbar {
    height: 6px;
}

:deep(.table-scroll-wrapper)::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 3px;
}

:deep(.table-scroll-wrapper)::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
}

:deep(.table-scroll-wrapper)::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
}

/* Scrollbar hide utility for mobile tab bar */
.scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
    display: none;
}

/* Global overflow containment for mobile */
.agent-playground {
    max-width: 100vw;
    overflow-x: hidden;
}

/* Text wrapping for prose content â€” avoid break-all which breaks mid-word */
:deep(.prose p),
:deep(.prose li),
:deep(.prose h1),
:deep(.prose h2),
:deep(.prose h3),
:deep(.prose h4),
:deep(.prose blockquote) {
    overflow-wrap: break-word;
    word-wrap: break-word;
    word-break: break-word;
}

/* Force monospace containers to break on mobile */
.font-mono {
    word-break: break-all;
    overflow-wrap: anywhere;
}

/* Mobile responsive overrides */
@media (max-width: 640px) {
    /* Prose content */
    :deep(.prose) {
        font-size: 0.875rem;
        line-height: 1.6;
        max-width: 100% !important;
        overflow-wrap: break-word;
        word-break: break-word;
    }

    :deep(.prose pre) {
        font-size: 0.7rem;
        padding: 0.75rem;
        border-radius: 0.5rem;
        margin-left: -0.25rem;
        margin-right: -0.25rem;
        max-width: calc(100vw - 3rem);
    }

    :deep(.prose code) {
        font-size: 0.75rem;
        word-break: break-all;
    }

    :deep(.table-scroll-wrapper) {
        margin: 0.75rem 0;
    }

    :deep(.prose table) {
        min-width: 300px;
        font-size: 0.7rem;
    }

    :deep(.prose th) {
        padding: 0.375rem 0.5rem;
        font-size: 0.6rem;
    }

    :deep(.prose td) {
        padding: 0.375rem 0.5rem;
        min-width: 60px;
    }

    :deep(.prose img) {
        border-radius: 0.5rem;
        max-width: 100%;
        height: auto;
    }

    :deep(.prose h1) { font-size: 1.15rem; }
    :deep(.prose h2) { font-size: 1.05rem; }
    :deep(.prose h3) { font-size: 0.95rem; }
    :deep(.prose p) { font-size: 0.8125rem; }
    :deep(.prose li) { font-size: 0.8125rem; }

    /* Constrain all content containers */
    .max-w-5xl {
        max-width: 100% !important;
    }
}

/* iOS safe area padding */
@supports (padding-bottom: env(safe-area-inset-bottom)) {
    .agent-playground {
        padding-bottom: env(safe-area-inset-bottom);
    }
}
</style>
