<template>
  <div class="code-browser" :class="narrow ? ['narrow', `pane-${pane}`] : []">
    <!-- Left Sidebar: File Tree. On a narrow screen (640 px and less) its tab row is the switch between the editor and
         one sidebar view, one at a time (ADM-1128, 2026-11-17). -->
    <div class="cb-sidebar" :style="narrow ? null : { width: sidebarWidth + 'px' }">
      <div class="sidebar-header">
        <div class="sidebar-tabs" role="tablist" aria-label="Browser views">
          <button
            v-if="narrow"
            type="button" role="tab" :aria-selected="pane === 'editor' ? 'true' : 'false'"
            @click="pane = 'editor'"
            :class="{ active: pane === 'editor' }"
            class="sidebar-tab" title="Editor" data-test="cb-pane-editor">
            <Icon icon="lucide:file-code-2" aria-hidden="true" />
            <span class="sidebar-tab-label">Editor</span>
          </button>
          <button
            type="button" role="tab" :aria-selected="sideSelected('files') ? 'true' : 'false'"
            @click="showSide('files')"
            :class="{ active: sideSelected('files') }"
            class="sidebar-tab" title="Files">
            <Icon icon="lucide:folder" aria-hidden="true" />
            <span class="sidebar-tab-label">Files</span>
          </button>
          <button
            type="button" role="tab" :aria-selected="sideSelected('search') ? 'true' : 'false'"
            @click="openSearch"
            :class="{ active: sideSelected('search') }"
            class="sidebar-tab" title="Search in files">
            <Icon icon="lucide:search" aria-hidden="true" />
            <span class="sidebar-tab-label">Search</span>
          </button>
          <!-- The file's symbols, from its language server (ADM-1322). -->
          <button
            type="button" role="tab" :aria-selected="sideSelected('outline') ? 'true' : 'false'"
            @click="showSide('outline')"
            :class="{ active: sideSelected('outline') }"
            class="sidebar-tab" title="Outline" data-test="cb-outline-tab">
            <Icon icon="lucide:list-tree" aria-hidden="true" />
            <span class="sidebar-tab-label">Outline</span>
          </button>
          <button
            type="button" role="tab" :aria-selected="sideSelected('scm') ? 'true' : 'false'"
            @click="showSide('scm')"
            :class="{ active: sideSelected('scm') }"
            class="sidebar-tab" title="Source control">
            <Icon icon="lucide:git-branch" aria-hidden="true" />
            <span class="sidebar-tab-label">Source control</span>
            <span v-if="scmCount > 0" class="scm-tabcount" :aria-label="`${scmCount} changes`">{{ scmCount }}</span>
          </button>
          <button
            v-if="debuggerStore && editable"
            type="button" role="tab" :aria-selected="sideSelected('debug') ? 'true' : 'false'"
            @click="showSide('debug')"
            :class="{ active: sideSelected('debug') }"
            class="sidebar-tab" title="Run and Debug">
            <Icon icon="lucide:bug-play" aria-hidden="true" />
            <span class="sidebar-tab-label">Run and Debug</span>
            <span v-if="debuggerStore.running.value" class="scm-tabcount" aria-label="debugging">●</span>
          </button>
        </div>
      </div>

      <div class="sidebar-content">
        <!-- File Tree -->
        <div v-if="sidebarTab === 'files'" class="file-tree">
          <div class="search-box explorer-bar">
            <input
              v-model="fileSearch"
              type="search"
              aria-label="Find a file by name"
              placeholder="Find a file by name"
              class="search-input" />
            <template v-if="editable">
              <button type="button" class="xbar-btn" title="New file" aria-label="New file" @click="startNew('file', '')">
                <Icon icon="lucide:file-plus" aria-hidden="true" />
              </button>
              <button type="button" class="xbar-btn" title="New folder" aria-label="New folder" @click="startNew('directory', '')">
                <Icon icon="lucide:folder-plus" aria-hidden="true" />
              </button>
              <button type="button" class="xbar-btn" title="Upload files" aria-label="Upload files" @click="pickUpload('')">
                <Icon icon="lucide:upload" aria-hidden="true" />
              </button>
              <input ref="uploadInput" type="file" multiple class="xbar-file" tabindex="-1" aria-hidden="true"
                     @change="onPicked" />
            </template>
          </div>
          <p v-if="uploading" class="xbar-status" role="status" aria-live="polite">{{ uploading }}</p>
          <div
            class="tree-list"
            :class="{ 'drop-root': dropTarget === '' }"
            @dragover="onDragOver($event, '')"
            @dragleave="onDragLeave"
            @drop="onDrop($event, '')"
            @contextmenu="onTreeContextMenu">
            <!-- Every file whose name matches (flat) -->
            <template v-if="fileSearch.trim()">
              <div v-if="searching" class="loading">Searching…</div>
              <div v-else-if="!searchResults.length" class="empty">No matches</div>
              <div v-else>
                <div
                  v-for="r in searchResults"
                  :key="r.path"
                  class="tree-node search-hit"
                  role="button" tabindex="0"
                  @click="openFile(r.path)"
                  @keydown.enter.prevent="openFile(r.path)">
                  <Icon class="node-iconify" :icon="iconFor(r)"
                        :style="iconColor(r) ? { color: iconColor(r) } : {}" />
                  <span class="node-name">{{ r.name }}</span>
                  <span class="node-path">{{ r.path }}</span>
                  <span v-if="r.gitignored" class="node-gi" title="Gitignored: kept in your workspace only, never committed">local-only</span>
                </div>
              </div>
            </template>
            <!-- Lazy directory tree -->
            <template v-else>
              <div v-if="loading" class="loading" role="status" aria-live="polite">{{ treeWaiting ? `The project's sandbox is starting. Trying again in ${treeWaiting}s…` : 'Loading files' }}</div>
              <div v-else-if="treeError" class="tree-error" role="alert">
                <Icon icon="lucide:cloud-off" class="tree-error-ic" aria-hidden="true" />
                <p class="tree-error-t">{{ treeError }}</p>
                <button type="button" class="tree-error-retry" :disabled="loading" @click="loadFiles">
                  <Icon icon="lucide:refresh-cw" aria-hidden="true" /> Try again
                </button>
                <!-- The sandbox platform is down (ADM-1206): it is on our side, so support is one click away. -->
                <router-link v-if="treeErrorDown" to="/dashboard/help-center/support" class="tree-error-help">
                  Contact support
                </router-link>
              </div>
              <template v-else>
                <div v-if="!rootNodes.length && !(pending && pending.parent === '' && pending.mode !== 'rename')" class="empty">
                  {{ editable ? 'No files yet. Create one, or drop files here.' : 'No files found' }}
                </div>
                <div v-else role="tree" aria-label="Project files">
                  <PendingRow v-if="pending && pending.parent === '' && pending.mode !== 'rename'" :level="0" />
                  <FileTreeNode
                    v-for="file in rootNodes"
                    :key="file.path"
                    :file="file"
                    @select="openFile" />
                </div>
              </template>
            </template>
          </div>
        </div>

        <!-- Source Control -->
        <div v-else-if="sidebarTab === 'scm'" class="scm-pane">
          <SourceControlPanel ref="scmPanel" :system-id="systemId" :repo-id="repositoryId" :project-name="projectName" @count="scmCount = $event" @open-diff="openDiff" @open-file="openFile" @open-merge="openMerge" @changed="refreshAfterScm" @published="emit('published', $event)" @branch="emit('branch', $event)" />
        </div>

        <!-- Outline (ADM-1322): the symbols of the file being edited; a click shows one in the editor. -->
        <div v-else-if="sidebarTab === 'outline'" class="scm-pane">
          <OutlineView :path="outlineFile ? outlineFile.path : ''" :symbols="outlineView.symbols" :state="outlineView.state"
                       :current-key="outlineCurrentKey" @reveal="revealSymbol" />
        </div>

        <!-- Run and Debug (ADM-1205 phase F item 17). -->
        <div v-else-if="sidebarTab === 'debug' && debuggerStore" class="scm-pane">
          <RunDebugPanel />
        </div>

        <!-- Search inside the files: kept while another tab is open, so its results are there on return. -->
        <div v-show="sidebarTab === 'search'" class="search-pane">
          <ContentSearch ref="contentSearch" :system-id="systemId" :repo-id="repositoryId" :is-unsaved="isUnsavedPath" @open="openAt" @written="onSearchWritten" />
        </div>
      </div>
      <ExplorerMenu :open="menu.open" :x="menu.x" :y="menu.y" :items="menu.items" :label="menu.label"
                    @select="onMenuSelect" @close="menu.open = false" />
      <QuickOpen :open="quickOpen" :system-id="systemId" :repo-id="repositoryId" @close="closeQuickOpen" @pick="onQuickPick" />
      <EditorSettings :open="settingsOpen" :anchor="settingsAnchor" @close="settingsOpen = false" />
      <!-- The command palette (Ctrl+Shift+P) and a tab's menu (right-click, Shift+F10), ADM-1322. -->
      <CommandPalette :open="paletteOpen" :commands="paletteCommands" @close="closePalette" @run="runPaletteCommand" />
      <ExplorerMenu :open="tabMenu.open" :x="tabMenu.x" :y="tabMenu.y" :items="tabMenu.items" :label="tabMenu.label"
                    @select="onTabMenuSelect" @close="tabMenu.open = false" />

      <!-- Resize Handle -->
      <div class="resize-handle" role="separator" aria-orientation="vertical" aria-label="Resize the file list" @mousedown="startResize"></div>
    </div>

    <!-- Center: Editor Panel. Two editor groups side by side (ADM-1322), as VS Code's: a tab opened to the side moves to
         the second group; each group has its own tabs and the tab it shows; the group last clicked or typed in is the
         one Save, the keys and the language servers act on. On a narrow screen one group shows at a time. -->
    <div class="editor-panel">
      <div class="editor-groups" :class="{ split }">
        <section
          v-for="view in groupViews" :key="view.g"
          class="editor-group"
          :class="{ focused: split && focusedGroup === view.g, 'group-hidden': narrow && split && focusedGroup !== view.g }"
          :aria-label="split ? `Editor group ${view.g + 1}` : undefined" :data-test="`cb-group-${view.g}`"
          @pointerdown.capture="focusGroup(view.g)" @focusin="focusGroup(view.g)">
          <!-- Tab Bar: drag a tab to reorder it or into the other group; pinned tabs come first. -->
          <div
            class="tab-bar" v-if="view.g === 1 || openTabs.length > 0 || chatOn"
            :class="{ 'tab-drop-end': tabDrop && tabDrop.g === view.g && tabDrop.id == null }"
            @dragover="onTabDragOver($event, view.g, null)" @dragleave="onTabDragLeave" @drop="onTabDrop($event, view.g, null)">
            <!-- Only the tabs are in the tablist (its own box, laid out as if it were not there); the + and the editor's
                 buttons sit beside it, so the tablist holds tabs alone (ADM-1322 review). -->
            <div class="tab-list" role="tablist" :aria-label="split ? `Tabs of editor group ${view.g + 1}` : 'Open tabs'">
            <!-- The Coding Agent's chats are editor tabs, as Claude Code's are in VS Code (ADM-1221, owner 2026-11-12). Each
                 runs on its own: leaving one never stops it, and its dot says what it is doing. They are in the first group. -->
            <template v-if="view.g === 0">
              <div
                v-for="ct in (chatOn ? chatTabs.tabs : [])"
                :key="'chat-' + ct.key"
                role="tab" tabindex="0" :aria-selected="chatTabFront(ct) ? 'true' : 'false'"
                data-test="cb-chat-tab" :title="chatTabs.title(ct)"
                @click="chatTabs.select(ct)"
                @keydown.enter.self="chatTabs.select(ct)"
                :class="['tab', 'chat-tab', { active: chatTabFront(ct) }]">
                <Icon class="tab-icon chat-tab-icon" icon="lucide:sparkles" aria-hidden="true" />
                <span class="tab-name">{{ chatTabs.title(ct) }}</span>
                <span v-if="chatTabs.state(ct) !== 'idle'" class="chat-dot" :class="chatTabs.state(ct)" role="img"
                      :aria-label="chatTabs.stateLabel(ct)" data-test="cb-chat-dot"></span>
                <button type="button" @click.stop="chatTabs.close(ct)" class="tab-close" data-test="cb-chat-close"
                        :aria-label="`Close ${chatTabs.title(ct)}`" title="Close (the chat stays in Chat history)"><Icon icon="lucide:x" /></button>
              </div>
            </template>
            <div
              v-for="tab in view.tabs"
              :key="tab.id"
              role="tab" tabindex="0" :aria-selected="isShown(tab, view.g) ? 'true' : 'false'"
              :data-tab-id="tab.id" draggable="true"
              :aria-description="tab.pinned ? 'Pinned' : undefined"
              @click="showFile(tab.id)"
              @keydown="onTabKey($event, tab)"
              @auxclick="onTabAuxClick($event, tab)"
              @contextmenu.prevent="openTabMenu($event, tab)"
              @dragstart="onTabDragStart($event, tab)" @dragend="onTabDragEnd"
              @dragover.stop="onTabDragOver($event, view.g, tab)" @drop.stop="onTabDrop($event, view.g, tab)"
              :class="['tab', { active: isShown(tab, view.g), pinned: tab.pinned, 'tab-drop-before': tabDrop && tabDrop.id === tab.id,
                                dragging: tabDrag === tab.id }]">
              <Icon v-if="tab.type === 'diff'" class="tab-icon" icon="lucide:file-diff" aria-hidden="true" />
              <Icon v-else-if="tab.type === 'review'" class="tab-icon" icon="lucide:list-checks" aria-hidden="true" />
              <Icon v-else-if="tab.type === 'merge'" class="tab-icon" icon="lucide:git-merge" aria-hidden="true" />
              <Icon v-else class="tab-icon" :icon="iconFor({ name: tab.name, type: 'file' })" aria-hidden="true"
                    :style="iconColor({ name: tab.name, type: 'file' }) ? { color: iconColor({ name: tab.name, type: 'file' }) } : {}" />
              <span class="tab-name">{{ tab.name }}</span>
              <span v-if="isDirty(tab)" class="tab-dot" title="Unsaved changes" aria-label="Unsaved changes"></span>
              <button v-if="tab.pinned" type="button" @click.stop="togglePin(tab)" class="tab-close tab-pin" data-test="cb-tab-unpin"
                      :aria-label="`Unpin ${tab.name}`" title="Pinned: Close others leaves it open. Click to unpin."><Icon icon="lucide:pin" /></button>
              <button v-else type="button" @click.stop="closeTab(tab.id)" class="tab-close" :aria-label="`Close ${tab.name}`"><Icon icon="lucide:x" /></button>
            </div>
            </div>
            <button v-if="view.g === 0 && chatOn" type="button" class="tab-new-chat" data-test="cb-new-chat" title="New Coding Agent chat"
                    aria-label="New Coding Agent chat" @click="chatTabs.newChat()">
              <Icon icon="lucide:plus" aria-hidden="true" />
            </button>
            <div v-if="editable" class="tab-actions" role="toolbar" aria-label="Editor actions">
              <!-- A markdown file's preview (ADM-1322): beside its text, or in its place. -->
              <template v-if="view.tab && isMarkdownTab(view.tab) && !(view.g === 0 && chatFront)">
                <button v-if="!narrow" type="button" class="tab-tool" :class="{ on: view.tab.mdView === 'split' }" data-test="cb-md-side"
                        :aria-pressed="view.tab.mdView === 'split' ? 'true' : 'false'" aria-label="Preview beside the text"
                        title="Markdown preview beside the text" @click="setMdView(view.tab, 'split')">
                  <Icon icon="lucide:columns-2" aria-hidden="true" />
                </button>
                <button type="button" class="tab-tool" :class="{ on: view.tab.mdView === 'preview' }" data-test="cb-md-preview"
                        :aria-pressed="view.tab.mdView === 'preview' ? 'true' : 'false'" aria-label="Show the preview"
                        title="Markdown preview in place of the text" @click="setMdView(view.tab, 'preview')">
                  <Icon icon="lucide:eye" aria-hidden="true" />
                </button>
              </template>
              <!-- Blame (ADM-1321): who last changed each line, read once when turned on, never on each keystroke. -->
              <button v-if="view.tab && view.tab.type === 'file' && !(view.g === 0 && chatFront)" type="button" class="tab-tool" :class="{ on: blameOn }"
                      :aria-pressed="blameOn ? 'true' : 'false'" aria-label="Show who changed each line"
                      :title="blameOn ? 'Hide who changed each line' : 'Blame: who changed each line, and when'" @click="toggleBlame">
                <Icon icon="lucide:user-round-search" aria-hidden="true" />
              </button>
              <!-- Split (Ctrl+\): this tab moves to the other group; the second group's own button closes it. -->
              <button v-if="view.g === 0 && !split && view.tab && canOpenToSide(view.tab) && !chatFront" type="button" class="tab-tool"
                      data-test="cb-split" aria-label="Open to the side" title="Open to the side (Ctrl+\)" @click="moveToOtherGroup(view.tab)">
                <Icon icon="lucide:columns-2" aria-hidden="true" />
              </button>
              <button v-if="narrow && split" type="button" class="tab-tool" data-test="cb-other-group"
                      :aria-label="`Show editor group ${2 - view.g}`" :title="`Show editor group ${2 - view.g}`" @click="focusGroup(1 - view.g, { show: true })">
                <Icon :icon="view.g === 0 ? 'lucide:panel-right' : 'lucide:panel-left'" aria-hidden="true" />
              </button>
              <button v-if="view.g === 1" type="button" class="tab-tool" data-test="cb-close-group"
                      aria-label="Close this editor group" title="Close this editor group" @click="closeGroup(1)">
                <Icon icon="lucide:square-x" aria-hidden="true" />
              </button>
              <button type="button" class="tab-gear" title="Editor settings" aria-label="Editor settings"
                      :aria-expanded="settingsOpen ? 'true' : 'false'" @click="openSettings">
                <Icon icon="lucide:settings-2" aria-hidden="true" />
              </button>
              <button type="button" class="save-btn" :disabled="!view.tab || !isDirty(view.tab) || saving" @click="saveTab(view.tab)">
                {{ saving ? 'Saving…' : 'Save' }}
              </button>
            </div>
          </div>

          <!-- Breadcrumbs (ADM-1322): the file's folders, its name, and the symbols the cursor is in. -->
          <EditorBreadcrumbs
            v-if="view.tab && view.tab.type === 'file' && !(view.g === 0 && chatFront)"
            :path="view.tab.path" :chain="crumbChain(view)"
            @folder="revealInFiles" @symbol="(s) => revealSymbol(s, view.g)" />

          <!-- Monaco Editor -->
          <div class="editor-container" :class="{ 'tab-drop-side': editorDrop === view.g }"
               @dragover="onEditorDragOver($event, view.g)" @dragleave="onEditorDragLeave" @drop="onEditorDrop($event, view.g)">
            <p v-if="editorDrop === view.g" class="drop-hint" aria-hidden="true">{{ split ? `Move to editor group ${view.g + 1}` : 'Open to the side' }}</p>
            <!-- The Coding Agent's chat (the page passes it in): kept mounted while a file is in front, so a running chat
                 is never stopped or reloaded by switching tabs. -->
            <div v-if="view.g === 0" v-show="chatFront" class="chat-host" data-test="cb-chat-host"><slot name="chat" /></div>
            <!-- Review the Coding Agent's changes since a message (ADM-1314, ADM-1329): one per message, kept mounted while
                 another tab is in front, so the change shown, the cursor and comments not sent yet are still there. -->
            <ReviewChanges
              v-for="rt in view.reviews" v-show="isShown(rt, view.g)" :key="rt.id"
              :system-id="systemId" :repo-id="repositoryId" :message-id="rt.messageId" :conversation-id="rt.conversationId"
              :diff-editor="MonacoDiffEditor" :diff-options="diffOptions" :theme="monacoTheme" :monaco="() => monacoNs"
              :is-unsaved="isUnsavedPath" :send="sendReview"
              @written="onReviewWritten" @loaded="(n) => onReviewLoaded(rt, n)" @comments="(n) => { rt.comments = n }"
              @open-file="openFile"
            />
            <template v-if="!(view.g === 0 && chatFront)">
            <!-- A change from Source control: side by side, the last commit on the left and the file now on the right,
                 as VS Code shows it. Read-only: edits are made in the file's own tab. -->
            <!-- A conflicted file in the 3-way merge editor (ADM-1321). -->
            <MergeEditor
              v-if="view.tab && view.tab.type === 'merge'" :key="view.tab.id"
              :system-id="systemId" :repo-id="repositoryId" :path="view.tab.path" :language="view.tab.language"
              :editor="MonacoEditor" :diff-editor="MonacoDiffEditor" :diff-options="diffOptions" :editor-options="editorOptions"
              :theme="monacoTheme" :monaco="() => monacoNs"
              @resolved="onMergeResolved(view.tab, $event)" @open-file="openFile" @edited="(on) => { view.tab.edited = on }"
            />
            <template v-else-if="view.tab && view.tab.type === 'diff'">
              <div v-if="view.tab.loading" class="empty-editor" role="status" aria-live="polite">
                <p class="empty-editor-s">{{ view.tab.waiting ? `The project's sandbox is starting. Trying again in ${view.tab.waiting}s…` : 'Loading the changes…' }}</p>
              </div>
              <div v-else-if="view.tab.note" class="empty-editor" role="status">
                <Icon :icon="view.tab.noteIcon || 'lucide:file-diff'" class="empty-editor-ic" aria-hidden="true" />
                <p class="empty-editor-t">{{ view.tab.path }}</p>
                <p class="empty-editor-s">{{ view.tab.note }}</p>
              </div>
              <div v-else class="diff-wrap">
                <!-- Stage or unstage ONE change of the file (ADM-1321), as VS Code's Stage Selected Ranges. -->
                <div v-if="view.tab.hunks && !view.tab.hunks.redacted && (hunkCount(view.tab) || view.tab.hunks.unstaged.whole || view.tab.hunks.staged.whole)" class="hunk-bar" role="group" aria-label="Changes in this file">
                  <template v-for="side in hunkSides(view.tab)" :key="side.key">
                    <span v-if="side.items.length" class="hunk-side">{{ side.label }}</span>
                    <span v-for="(h, i) in side.items" :key="side.key + h.header" class="hunk">
                      <button type="button" class="hunk-go" :aria-label="`Go to ${side.label.toLowerCase()} change ${i + 1}, ${hunkLines(h)}`" @click="revealHunk(h)">
                        {{ hunkLines(h) }}
                      </button>
                      <button type="button" class="hunk-act" :disabled="view.tab.staging"
                              :aria-label="`${side.unstage ? 'Unstage' : 'Stage'} change ${i + 1}, ${hunkLines(h)}`"
                              :title="side.unstage ? 'Unstage this change' : 'Stage this change'" @click="stageHunk(view.tab, h, side.unstage)">
                        <Icon :icon="side.unstage ? 'lucide:minus' : 'lucide:plus'" aria-hidden="true" />
                      </button>
                    </span>
                  </template>
                  <span v-if="view.tab.hunks.unstaged.whole || view.tab.hunks.staged.whole" class="hunk-note">
                    A new, deleted, renamed or binary file is staged whole, from Source control.
                  </span>
                </div>
                <MonacoDiffEditor
                  :value="view.tab.modified"
                  :original="view.tab.originalText"
                  :language="view.tab.language"
                  :theme="monacoTheme"
                  :options="diffOptions"
                  class="monaco-editor"
                  @editorDidMount="(d) => onDiffMount(d, view.g)"
                />
              </div>
            </template>
            <!-- A Review tab is drawn above (ReviewChanges); nothing else shows under it. -->
            <span v-else-if="view.tab && view.tab.type === 'review'" hidden></span>
            <!-- A picture shows as itself, on a checkerboard so transparency reads, never larger than it is. An SVG can
                 also be opened as its code. -->
            <div v-else-if="view.tab && view.tab.type === 'image'" class="image-view">
              <div v-if="view.tab.loading" class="empty-editor" role="status" aria-live="polite">
                <p class="empty-editor-s">{{ view.tab.waiting ? `The project's sandbox is starting. Trying again in ${view.tab.waiting}s…` : 'Loading the picture…' }}</p>
              </div>
              <div v-else-if="view.tab.error" class="empty-editor" role="alert">
                <Icon icon="lucide:image-off" class="empty-editor-ic" aria-hidden="true" />
                <p class="empty-editor-t">{{ view.tab.path }}</p>
                <p class="empty-editor-s">{{ view.tab.error }}</p>
              </div>
              <template v-else>
                <div class="image-stage">
                  <img :src="view.tab.url" :alt="view.tab.name" class="image-img" @load="onImageLoad(view.tab, $event)" />
                </div>
                <div class="image-meta">
                  <span>{{ view.tab.name }}</span>
                  <span v-if="view.tab.width">{{ view.tab.width }} × {{ view.tab.height }} px</span>
                  <span>{{ formatBytes(view.tab.size) }}</span>
                  <button v-if="view.tab.canCode" type="button" class="image-code-btn" @click="openFile(view.tab.path, { asCode: true })">
                    <Icon icon="lucide:code" aria-hidden="true" /> Open as code
                  </button>
                </div>
              </template>
            </div>
            <!-- A file's text. A markdown file can show its preview beside the text or in its place (ADM-1322); the
                 editor stays mounted under the preview, so its undo, cursor and language features are kept. -->
            <div v-else-if="view.tab" class="text-view" :class="`mdv-${mdViewOf(view.tab)}`">
              <MonacoEditor
                v-show="mdViewOf(view.tab) !== 'preview'"
                :value="view.tab.content"
                :language="view.tab.language"
                :path="view.tab.path"
                :options="editorOptions"
                :theme="monacoTheme"
                class="monaco-editor"
                @change="(v) => onEditorChange(v, view.g)"
                @editorDidMount="(ed) => onEditorMount(ed, view.g)"
              />
              <!-- Sanitised twice (utils/markdownPreview): no script, frame or event handler; links open in a new tab. -->
              <article v-if="mdViewOf(view.tab) !== 'text'" :ref="(el) => onPreviewEl(el, view.tab)" class="md-preview" tabindex="0"
                       data-test="cb-md-render" v-html="mdHtml(view.tab)"
                       :aria-label="`Preview of ${view.tab.name}`" @click="onPreviewClick($event, view.tab)"></article>
            </div>
            <div v-else class="empty-editor">
              <Icon icon="lucide:file-code" class="empty-editor-ic" aria-hidden="true" />
              <p class="empty-editor-t">No file open</p>
              <p class="empty-editor-s">Pick a file from the list to open it here.</p>
            </div>
            </template>
          </div>
          <!-- Vim keys (ADM-1322): the mode and the ":" command line of this group's editor. -->
          <div v-if="editable && editorSettings.vim" v-show="view.tab && view.tab.type === 'file' && mdViewOf(view.tab) !== 'preview' && !(view.g === 0 && chatFront)"
               :ref="(el) => setVimBar(view.g, el)" class="vim-bar" data-test="cb-vim-bar" aria-live="polite"></div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, shallowRef, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount, h, inject } from 'vue'
import { lazyComponent } from '@/utils/lazyComponent'
// MONACO IS LOADED WHEN AN EDITOR IS ACTUALLY SHOWN, not on every page view.
//
// MEASURED on production, chat route: total JS 5,856 KB across 30 files, of which monaco was 4,154 KB
// -- 71% of everything -- and it arrived at 359ms in the FIRST wave with index/vue-core/vendor,
// before AppShell at 912ms. It was `modulepreload`ed from index.html on every page, because a static
// import here put it in the entry graph: three views import CodeBrowser, so monaco reached the
// initial chunk set no matter which route the user opened. `vite.config.js` states the intent --
// "Deliberately NOT listed: monaco-editor ... they're route-level/dynamic" -- and a static import is
// what made that untrue.
//
// Both halves have to be dynamic. Importing only the component would still pull the namespace below.
// `applyDecorations` is unreachable until `onEditorMount` fires, so by the time `Range` is needed the
// namespace has resolved; the guard is there for the case where it has not.
let monacoNs = null
// Monaco's own language list, once it has loaded: every file opens in the language Monaco knows for it (ADM-1200).
const monacoLanguages = shallowRef(null)
function noteMonacoLoaded(ns) {
  // Before Monaco holds a file: rename, code actions, inlay hints and formatting come from the language servers only
  // (ADM-1319). A read-only editor loses nothing by it: it neither renames, fixes nor formats.
  if (monacoNs !== ns) leaveEditingToServers(ns)
  monacoNs = ns
  if (!monacoLanguages.value) {
    try { monacoLanguages.value = ns.languages.getLanguages() } catch { /* the fallback list stays */ }
  }
}
// lazyComponent: an error state + one guarded reload when the chunk is stale (F-C1).
const MonacoEditor = lazyComponent(async () => {
  await import('@/utils/monacoWorkers')        // before the editor starts: it asks for its workers at once
  noteMonacoLoaded(await import('monaco-editor'))
  const mod = await import('monaco-editor-vue3')
  return mod.default || mod
})
// The same lazy load, for a change's side-by-side diff (Source control).
const MonacoDiffEditor = lazyComponent(async () => {
  await import('@/utils/monacoWorkers')
  noteMonacoLoaded(await import('monaco-editor'))
  const mod = await import('monaco-editor-vue3')
  return mod.DiffEditor
})
import { Icon } from '@iconify/vue'
import { codeSelection } from '@/utils/codeMentions'
import api from '../services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import { useIdeTheme } from '@/composables/useIdeTheme'
import SourceControlPanel from '@/components/letscode/SourceControlPanel.vue'
import ExplorerMenu from '@/components/letscode/ExplorerMenu.vue'
import ContentSearch from '@/components/letscode/ContentSearch.vue'
import QuickOpen from '@/components/letscode/QuickOpen.vue'
import EditorSettings from '@/components/letscode/EditorSettings.vue'
import { useEditorSettings, monacoOptions } from '@/composables/useEditorSettings'
import { noteOpened, forgetRecent } from '@/utils/quickOpen'
import { saveBlob } from '@/utils/saveBlob'
import { filesFromDrop, filesFromPicker, uploadParts, tooLarge, MAX_FILE_BYTES } from '@/utils/droppedFiles'
import { whileSandboxStarts } from '@/utils/sandboxStarting'
import { projectCache } from '@/services/projectCache'
import { languageFor } from '@/utils/editorLanguage'
import { CODING_CHAT_TABS } from '@/stores/useCodingChatTabs'
import { LANGUAGE_SERVERS, leaveEditingToServers, applyTextEdits, rangeOf, setupLogNotification } from '@/stores/useLanguageServers'
import { DEBUGGER } from '@/stores/useDebugger'
import { bindConflictActions } from '@/utils/mergeConflicts'
import { SIDE_BY_SIDE_MIN_PX } from '@/utils/diffLayout'
import RunDebugPanel from '@/components/letscode/RunDebugPanel.vue'
import ReviewChanges from '@/components/letscode/ReviewChanges.vue'
import MergeEditor from '@/components/letscode/MergeEditor.vue'
import { blameDecorations } from '@/utils/blame'
import CommandPalette from '@/components/letscode/CommandPalette.vue'
import OutlineView from '@/components/letscode/OutlineView.vue'
import EditorBreadcrumbs from '@/components/letscode/EditorBreadcrumbs.vue'
import { GROUPS, groupOf, tabsOfGroup, canMoveGroup, moveTab, stepTab, othersToClose, rightToClose } from '@/utils/editorGroups'
import { symbolsOf, symbolChainAt } from '@/utils/editorSymbols'
import { renderMarkdownPreview, isMarkdownPath, projectLinkOf } from '@/utils/markdownPreview'
import { startVim } from '@/utils/vimMode'

// Real per-extension file icons (colorful brand logos where available, lucide fallbacks otherwise).
const EXT_ICON = {
  py: 'logos:python', js: 'logos:javascript', mjs: 'logos:javascript', cjs: 'logos:javascript',
  ts: 'logos:typescript-icon', tsx: 'logos:react', jsx: 'logos:react', vue: 'logos:vue',
  json: 'lucide:braces', jsonc: 'lucide:braces',
  md: 'lucide:file-text', markdown: 'lucide:file-text', rst: 'lucide:file-text', txt: 'lucide:file-text',
  html: 'logos:html-5', htm: 'logos:html-5', css: 'logos:css-3', scss: 'logos:sass', sass: 'logos:sass', less: 'logos:less',
  yml: 'lucide:settings-2', yaml: 'lucide:settings-2', toml: 'lucide:settings-2', ini: 'lucide:settings-2', cfg: 'lucide:settings-2', conf: 'lucide:settings-2',
  env: 'lucide:settings-2', sh: 'lucide:terminal', bash: 'lucide:terminal', zsh: 'lucide:terminal', bat: 'lucide:terminal', cmd: 'lucide:terminal', ps1: 'lucide:terminal',
  sql: 'lucide:database', db: 'lucide:database', sqlite: 'lucide:database',
  go: 'logos:go', rs: 'logos:rust', rb: 'logos:ruby', php: 'logos:php', java: 'logos:java', kt: 'logos:kotlin',
  swift: 'logos:swift', cs: 'logos:c-sharp', c: 'lucide:file-code', h: 'lucide:file-code', cpp: 'lucide:file-code', cc: 'lucide:file-code', hpp: 'lucide:file-code',
  dart: 'logos:dart', scala: 'logos:scala', r: 'logos:r-lang', lua: 'logos:lua', ex: 'logos:elixir', exs: 'logos:elixir',
  xml: 'lucide:code', svg: 'lucide:image', png: 'lucide:image', jpg: 'lucide:image', jpeg: 'lucide:image', gif: 'lucide:image', webp: 'lucide:image', ico: 'lucide:image',
  pdf: 'lucide:file-type', csv: 'lucide:table', xlsx: 'lucide:table', xls: 'lucide:table',
  zip: 'lucide:file-archive', tar: 'lucide:file-archive', gz: 'lucide:file-archive', rar: 'lucide:file-archive',
  lock: 'lucide:lock', log: 'lucide:scroll-text',
}
function iconFor(file) {
  if (file.type === 'directory') return file.expanded ? 'lucide:folder-open' : 'lucide:folder'
  const name = (file.name || '').toLowerCase()
  if (name === 'dockerfile') return 'logos:docker-icon'
  if (name.startsWith('.env')) return 'lucide:settings-2'
  if (name === '.gitignore' || name === '.gitattributes') return 'logos:git-icon'
  if (name === 'package.json') return 'logos:nodejs-icon'
  if (name === 'requirements.txt' || name === 'pyproject.toml' || name === 'pipfile') return 'logos:python'
  const ext = name.includes('.') ? name.split('.').pop() : ''
  return EXT_ICON[ext] || 'lucide:file'
}
function iconColor(file) {
  // directories get the info blue; files using a lucide (monochrome) icon get a neutral tint.
  if (file.type === 'directory') return 'var(--vm-sky)'
  return (iconFor(file).startsWith('lucide:')) ? 'var(--vm-ink-faint)' : ''
}

const props = defineProps({
  repositoryId: {
    type: Number,
    required: true
  },
  systemId: {
    type: Number,
    required: true
  },
  // Opt-in editing (Let's Code IDE). Default false → existing usages stay read-only.
  editable: {
    type: Boolean,
    default: false
  },
  // The project's name: the repository name Source control's Publish suggests for a new project (ADM-1183).
  projectName: {
    type: String,
    default: ''
  }
})
// A new project was published to GitHub from Source control: the page reloads the project (its GitHub address,
// its branches).
// send-review: the Review tab's comments, as one message for the chat that made the change ({ conversationId, text,
// done(ok) }: the page answers whether the chat took it).
const emit = defineEmits(['published', 'branch', 'ask-selection', 'send-review'])

// State
const sidebarTab = ref('files')
const scmCount = ref(0)               // Source Control change-count badge
const sidebarWidth = ref(300)
const fileSearch = ref('')
const rootNodes = ref([])             // lazy tree: top-level entries; dirs load children on expand
const loading = ref(false)
const treeError = ref('')             // why the files could not be listed (e.g. the project's sandbox is off)
const treeErrorDown = ref(false)      // that reason is the sandbox platform being down (code SANDBOX_DOWN)
// Seconds until the next try while the project's sandbox wakes (the server answers "starting" at once, 4101aaa3).
const treeWaiting = ref(0)
let unmounted = false
const _wait = { onWaiting: (s) => { treeWaiting.value = s }, isCancelled: () => unmounted }
const searchResults = ref([])         // flat results when the search box is non-empty
const searching = ref(false)
const openTabs = ref([])
// The Coding Agent's chat tabs: only where the Let's Code page provides them (and its chat, in the "chat" slot, is bound).
const chatTabs = inject(CODING_CHAT_TABS, null)
const chatOn = computed(() => !!(chatTabs && chatTabs.bound))
const chatFront = computed(() => chatOn.value && chatTabs.front)
function chatTabFront(ct) { return chatFront.value && chatTabs.isActive(ct) }
// The chat is in the first editor group: a file opened in the second leaves it in front (ADM-1322).
function showFilesInFront() { if (chatTabs && focusedGroup.value === 0) chatTabs.showFiles(); pane.value = 'editor' }

// A NARROW SCREEN (640 px and less) shows one pane at a time: the editor (its file and chat tabs) or one sidebar view,
// chosen in the sidebar's tab row, which gains an Editor tab (ADM-1128, 2026-11-17). Side by side at 375 px the file
// list got 162 px and the editor 198 px. Opening a file, a diff or a search result, or bringing a chat to the front,
// shows the editor; a sidebar tab shows its view. Wider screens are unchanged.
const NARROW = '(max-width: 640px)'
const narrowQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(NARROW) : null
const narrow = ref(!!narrowQuery?.matches)
const pane = ref('editor')
function onNarrowChange(e) { narrow.value = !!e.matches }
narrowQuery?.addEventListener?.('change', onNarrowChange)
onBeforeUnmount(() => narrowQuery?.removeEventListener?.('change', onNarrowChange))
function showSide(tab) { sidebarTab.value = tab; pane.value = 'side' }
function sideSelected(tab) { return sidebarTab.value === tab && !(narrow.value && pane.value === 'editor') }
watch(chatFront, (front) => { if (front) { pane.value = 'editor'; focusedGroup.value = 0 } })
// A file tab, or a file opened from the tree, search or Source control, comes in front of the chat.
function showFile(id) {
  const tab = openTabs.value.find(t => t.id === id)
  if (tab) focusedGroup.value = groupOf(tab)
  showFilesInFront()
  activeTabId.value = id
}
// A tab opened before Monaco loaded got the short fallback list's language: give it Monaco's.
watch(monacoLanguages, (langs) => {
  if (!langs) return
  for (const tab of openTabs.value) {
    if (tab.path && tab.language != null) tab.language = languageFor(tab.path, langs)
  }
})
// ── THE TWO EDITOR GROUPS (ADM-1322; utils/editorGroups) ─────────────────────────────────────────────────────
// Each group shows one of its tabs; `focusedGroup` is the one clicked or typed in last. `activeTabId` is the focused
// group's tab, so Save, the keys, blame and the language servers act on what the person is working in. Making a tab
// active puts a new tab in the focused group, and focuses the group of one already open.
const groups = reactive(GROUPS.map(() => ({ activeId: null })))
const focusedGroup = ref(0)
const split = computed(() => openTabs.value.some(t => groupOf(t) === 1))
const activeTabId = computed({
  get: () => groups[focusedGroup.value].activeId,
  set: (id) => {
    const tab = id == null ? null : openTabs.value.find(t => t.id === id)
    if (tab) {
      if (tab.group == null) tab.group = focusedGroup.value
      else focusedGroup.value = groupOf(tab)
    }
    groups[focusedGroup.value].activeId = id
  },
})
// The chat covers the first group's files: the focused group's editor is not shown then.
const coverFocused = computed(() => chatFront.value && focusedGroup.value === 0)
const saving = ref(false)

// Monaco follows the editor's own theme (useIdeTheme: the app's until the person picks one): light 'vs', dark
// 'vs-dark'.
const { isDark } = useIdeTheme()
const monacoTheme = computed(() => (isDark.value ? 'vs-dark' : 'vs'))
watch(monacoTheme, (t) => { try { monacoNs && monacoNs.editor.setTheme(t) } catch { /* editor not loaded */ } })

// Editor options (readOnly unless `editable`)
// The person's editor settings (font size, wrap, minimap, line numbers, whitespace; the gear beside Save).
const { settings: editorSettings } = useEditorSettings()
const editorOptions = computed(() => ({
  readOnly: !props.editable,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  theme: monacoTheme.value,
  folding: true,
  ...monacoOptions(editorSettings),
  // As VS Code: matching brackets in matching colours, and their guides.
  bracketPairColorization: { enabled: true, independentColorPoolPerBracketType: false },
  guides: { bracketPairs: 'active', indentation: true, highlightActiveIndentation: true },
  'semanticHighlighting.enabled': true,
  // The gutter where breakpoints are set (the debugger, ADM-1205 phase F item 17).
  glyphMargin: !!(props.editable && debuggerStore),
}))

const diffOptions = computed(() => ({
  readOnly: true,
  originalEditable: false,
  renderSideBySide: true,
  renderSideBySideInlineBreakpoint: SIDE_BY_SIDE_MIN_PX,     // inline only when two columns do not fit (diffLayout.js)
  automaticLayout: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  fontSize: editorSettings.fontSize,
  wordWrap: editorSettings.wordWrap ? 'on' : 'off',
  bracketPairColorization: { enabled: true },
}))

// A tab's id. `Date.now()` alone gave two tabs opened in the same millisecond one id (a kept file opens at once).
let _tabSeq = 0
const nextTabId = () => Date.now() * 1000 + (_tabSeq++ % 1000)

// A change from Source control opens as its own tab ("app.py (changes)"), like VS Code's diff editor.
// From History, ``sha`` (and ``from`` for a rename): the file as that commit changed it, its own tab "app.py (abc1234)".
async function openDiff({ path, sha = '', short = '', from = '' }) {
  showFilesInFront()
  const existing = openTabs.value.find(t => t.type === 'diff' && !t.compare && t.path === path && (t.sha || '') === sha)
  if (existing) { activeTabId.value = existing.id; return }
  const tab = {
    id: nextTabId(), type: 'diff', path, sha, from, name: `${path.split('/').pop()} (${sha ? (short || sha.slice(0, 7)) : 'changes'})`,
    language: detectLanguage(path), loading: true, note: '', noteIcon: '', originalText: '', modified: '',
  }
  openTabs.value.push(tab)
  activeTabId.value = tab.id
  await loadDiffInto(openTabs.value.find(t => t.id === tab.id))
}
async function loadDiffInto(live) {
  if (live.compare) return            // a "Compare first" tab holds what was read then; nothing to fetch
  live.loading = true
  live.note = ''
  live.noteIcon = ''
  try {
    const { data } = await whileSandboxStarts(() => (live.sha
      ? api.getSourceControlDiff(props.systemId, props.repositoryId, live.path, { sha: live.sha, from: live.from })
      : api.getSourceControlDiff(props.systemId, props.repositoryId, live.path)),
      { onWaiting: (s) => { live.waiting = s }, isCancelled: () => unmounted })
    if (data.redacted) { live.note = 'This file holds secrets, so its values are not shown.'; live.noteIcon = 'lucide:lock' }
    else if (data.binary) { live.note = 'Binary file. There is no text to compare.' }
    else if (data.original === undefined && data.modified === undefined) { live.note = 'The changes cannot be shown for this file.' }
    // Discarded or committed since the tab opened: say so instead of two identical sides.
    else if (!live.sha && (data.original || '') === (data.modified || '')) { live.note = 'This file has no changes now.'; live.noteIcon = 'lucide:check-circle-2' }
    else {
      live.originalText = data.original || ''; live.modified = data.modified || ''
      if (!live.sha) await loadHunksInto(live)
    }
  } catch (e) {
    live.note = e?.response?.data?.error || 'The changes could not be loaded.'
  } finally {
    live.loading = false
  }
}

function isDirty(tab) {
  return props.editable && tab && tab.type === 'file' && tab.original !== undefined && tab.content !== tab.original
}

function onEditorChange(value, g = focusedGroup.value) {
  if (!props.editable) return
  const tab = openTabs.value.find(t => t.id === groups[g].activeId)
  if (tab && tab.type === 'file') tab.content = value
}

// SAVE NEVER REPLACES A CHANGE UNSEEN (ADM-1323). Each file tab keeps `diskSha`, the sha256 of the file on disk as the
// editor last read or wrote it (`tab.sha` is a diff tab's commit). Save sends it; a file the Coding Agent, a command
// or the terminal changed since answers 409 CHANGED_ON_DISK, nothing is written, and the person chooses.
// A tab whose unsaved edits started from a copy older than the file on disk, with no sha to say which: a well-formed
// sha no file has, so its next Save is asked about instead of overwriting.
const CHANGED_SINCE_OPENED = '0'.repeat(64)
const compareName = (path) => `${path.split('/').pop()} (on disk ↔ yours)`

async function writeTab(tab, sha, { quiet = false } = {}) {
  const text = tab.content
  const { data } = await api.saveFileContent(props.systemId, props.repositoryId, tab.path, text, sha || undefined)
  tab.original = text
  tab.diskSha = data?.sha ?? null
  projectCache.file.set(props.repositoryId, tab.path, text)
  if (!quiet) notify.success(`Saved ${tab.name}`)          // an autosave says nothing: the tab's dot goes
  blameRead.delete(tab.path)
  nextTick(applyBlame)
}

// ── Staging one change, the merge editor and blame (ADM-1321) ──────────────────────────────────────────────────
// A working-tree diff tab also holds the file's hunks: each change not staged yet (Stage) and each staged one
// (Unstage). A hunk is staged exactly as read; a file changed since is refused by the server and read again here.
async function loadHunksInto(live) {
  try {
    const { data } = await api.getSourceControlHunks(props.systemId, props.repositoryId, live.path)
    live.hunks = data
  } catch {
    live.hunks = null                     // the diff still shows; the file is staged whole from Source control
  }
}
const hunkCount = (tab) => (tab.hunks?.unstaged?.hunks?.length || 0) + (tab.hunks?.staged?.hunks?.length || 0)
function hunkSides(tab) {
  return [
    { key: 'u', label: 'Not staged', unstage: false, items: tab.hunks?.unstaged?.hunks || [] },
    { key: 's', label: 'Staged', unstage: true, items: tab.hunks?.staged?.hunks || [] },
  ]
}
function hunkLines(h) {
  const n = Math.max(1, h.new_lines)
  return n === 1 ? `line ${h.new_start}` : `lines ${h.new_start}–${h.new_start + n - 1}`
}
function revealHunk(h) {
  try {
    const ed = diffInst?.getModifiedEditor?.()
    ed?.revealLineInCenter(Math.max(1, h.new_start))
    ed?.setPosition({ lineNumber: Math.max(1, h.new_start), column: 1 })
    ed?.focus()
  } catch { /* the diff went away */ }
}
async function stageHunk(tab, h, unstage) {
  if (tab.staging) return
  tab.staging = true
  try {
    const { data } = await whileSandboxStarts(() => api.stageSourceControlChange(props.systemId, props.repositoryId,
      { path: tab.path, patch: h.patch, index: tab.hunks.index, unstage }), _wait)
    tab.hunks = data.hunks
    notify.success(unstage ? `Unstaged a change in ${tab.path}` : `Staged a change in ${tab.path}`)
  } catch (e) {
    const data = e?.response?.data
    if (data?.hunks) tab.hunks = data.hunks
    else await loadHunksInto(tab)
    notify.error(data?.error || 'That change could not be staged. Look at the changes again.')
  } finally {
    tab.staging = false
  }
  if (scmPanel.value?.refresh) { try { scmPanel.value.refresh() } catch { /* unmounting */ } }
  else loadScmCount()
}

// A conflicted file opens in its own tab, "app.py (merge)".
function openMerge(path) {
  showFilesInFront()
  const existing = openTabs.value.find(t => t.type === 'merge' && t.path === path)
  if (existing) { activeTabId.value = existing.id; return }
  const tab = { id: nextTabId(), type: 'merge', path, name: `${path.split('/').pop()} (merge)`, language: detectLanguage(path) }
  openTabs.value.push(tab)
  activeTabId.value = tab.id
}
async function onMergeResolved(tab) {
  if (scmPanel.value?.refresh) { try { scmPanel.value.refresh() } catch { /* unmounting */ } }
  else loadScmCount()
  if (tab) await closeTab(tab.id)
  await reloadOpenTabs()
}

// Blame: read once per file while it is on (and again after a save or a change in the project); a tab with unsaved
// edits shows none, as its lines no longer match the file the blame was read for.
const blameOn = ref(false)
const blameRead = new Map()
let blameDecos = null
function clearBlame() {
  try { blameDecos && blameDecos.clear() } catch { /* the editor went away */ }
  blameDecos = null
}
function toggleBlame() {
  blameOn.value = !blameOn.value
  applyBlame()
}
async function applyBlame() {
  clearBlame()
  const tab = activeTab.value
  if (!blameOn.value || coverFocused.value || !tab || tab.type !== 'file' || isDirty(tab)) return
  let data = blameRead.get(tab.path)
  if (!data) {
    try {
      ({ data } = await whileSandboxStarts(() => api.getSourceControlBlame(props.systemId, props.repositoryId, tab.path), _wait))
    } catch (e) {
      if (activeTab.value === tab) notify.info(e?.response?.data?.error || `Who changed ${tab.name} could not be read.`)
      return
    }
    blameRead.set(tab.path, data)
  }
  if (!blameOn.value || activeTab.value !== tab || isDirty(tab) || !editorInst || !monacoNs) return
  clearBlame()
  try { blameDecos = editorInst.createDecorationsCollection(blameDecorations(monacoNs.Range, data)) } catch { /* gone */ }
}

async function saveActive() {
  return saveTab(openTabs.value.find(t => t.id === activeTabId.value))
}

// One tab's save, by the person (Save, Ctrl+S, :w) or by autosave (`auto`: 'delay' after a pause in typing, 'focus'
// when the editor loses the focus; ADM-1322). Both send the sha the tab read: a file changed on disk is never
// overwritten, it raises the same question. After that question autosave pauses for the tab until the person saves it
// themselves, so an automatic save never replaces a version they were just shown. An autosave says nothing when it
// works, and does not format after a pause in typing (the text would move under the cursor; VS Code skips it too).
async function saveTab(tab, { auto = null } = {}) {
  if (!tab || !isDirty(tab) || tab.saving || tab.asking) return
  if (!auto && saving.value) return
  if (auto && tab.autoSaveHeld) return
  tab.saving = true
  if (!auto) saving.value = true
  try {
    if (auto !== 'delay') await formatBeforeSave(tab)
    await writeTab(tab, tab.diskSha, { quiet: !!auto })
    if (!auto) tab.autoSaveHeld = false
  } catch (e) {
    if (e?.response?.status === 409 && e.response.data?.code === 'CHANGED_ON_DISK') {
      if (auto) tab.autoSaveHeld = true
      tab.saving = false
      await changedOnDisk(tab)
      if (auto && tab.autoSaveHeld && isDirty(tab) && openTabs.value.some(t => t.id === tab.id)) {
        notify.info(`Autosave is paused for ${tab.name} until you save it yourself.`)
      }
    } else if (auto) {
      tab.autoSaveHeld = true
      notify.error(`${tab.name} was not saved automatically: ${e?.response?.data?.error || 'the save failed'}. `
        + 'Autosave is paused for it until you save it yourself.')
    } else notify.error(e?.response?.data?.error || 'Failed to save file')
  } finally {
    tab.saving = false
    if (!auto) saving.value = false
  }
}

// FORMAT ON SAVE (ADM-1319; the editor's settings, off unless chosen). A TypeScript, JavaScript or Python file is
// formatted first and its text takes the result. A formatter that fails never stops the save: the text is saved as it
// is and one notification says why it was not formatted.
async function formatBeforeSave(tab) {
  if (!editorSettings.formatOnSave || !languages || !languages.canFormat(tab.path)) return
  const text = tab.content
  let edits
  try {
    edits = await languages.formatEdits(tab.path, text)
  } catch (e) {
    // Python formatting still being set up (the project's first format) or not set up: the save goes on unformatted.
    if (e.preparing) {
      notify.info(`${tab.name} was saved without formatting: Python formatting is being set up in your project `
        + '(first time only). It will format once setup finishes.')
    } else {
      notify.warning(...setupLogNotification(`${tab.name} was saved without formatting: ${e.message}`, e))
    }
    return
  }
  if (!edits.length) return
  if (tab.content !== text) {
    notify.warning(`${tab.name} was saved without formatting: its text changed while it was being formatted.`)
    return
  }
  editOpenFile(tab.path, edits)
}

// A language server's change to a file open in a tab (ADM-1319: a rename, a quick fix, formatting): it goes into the
// tab's text, so the tab becomes unsaved and the person saves it. The tab shown changes through Monaco, so Undo takes
// it back. Returns the tab's new text, or null when the file is not open in a tab (the change is then written to the
// file on disk by the language servers' store).
function editOpenFile(path, edits) {
  const tab = openTabs.value.find(t => t.type === 'file' && t.path === path)
  if (!tab || tab.content == null) return null
  const model = tab.id === activeTabId.value && !coverFocused.value && editorInst && editorInst.getModel ? editorInst.getModel() : null
  if (model && model.getValue() === tab.content && typeof editorInst.executeEdits === 'function') {
    editorInst.pushUndoStop?.()
    editorInst.executeEdits('lets-code-language-server', edits.map((e) => ({ range: rangeOf(e.range), text: e.newText ?? '',
      forceMoveMarkers: true })))
    editorInst.pushUndoStop?.()
    tab.content = model.getValue()
  } else {
    tab.content = applyTextEdits(tab.content, edits)
  }
  return tab.content
}

async function changedOnDisk(tab) {
  if (tab.asking) return                                       // one question at a time (a save and an autosave)
  tab.asking = true
  let overwrite
  try {
    overwrite = await confirm({
      title: `${tab.name} changed in the project`,
      message: `The Coding Agent, a command or the terminal changed ${tab.path} after you opened it. `
        + 'Overwrite it with your version, or compare the two first.',
      confirmText: 'Overwrite with mine',
      cancelText: 'Compare first',
      danger: true,
    })
  } finally {
    tab.asking = false
  }
  if (!openTabs.value.some(t => t.id === tab.id)) return       // closed meanwhile
  if (overwrite) {
    try {
      await writeTab(tab, null)                                // no sha: the person chose to replace it
      tab.autoSaveHeld = false                                 // they chose their text: autosave goes on
    } catch (e) {
      notify.error(e?.response?.data?.error || 'Failed to save file')
    }
    return
  }
  await compareWithDisk(tab)
}

// "Compare first": the file as it is on disk now beside the person's unsaved text, in a read-only compare tab next to
// the file's. Their text is not touched. The tab now names the version just read, so their next Save is a deliberate
// overwrite of what they have seen; a file that changes again has another sha and is asked about again.
async function compareWithDisk(tab) {
  let data
  try {
    ({ data } = await whileSandboxStarts(() => api.getFileContent(props.systemId, props.repositoryId, tab.path), _wait))
  } catch (e) {
    notify.error(e?.response?.data?.error || `${tab.name} could not be read from the project.`)
    return
  }
  const live = openTabs.value.find(t => t.id === tab.id)
  if (!live) return
  const disk = data.content
  live.original = disk
  live.diskSha = data.sha ?? null
  projectCache.file.set(props.repositoryId, live.path, disk)
  if (live.content === disk) {
    notify.info(`${live.name} in the project is already the same as your version.`)
    return
  }
  const sides = { originalText: disk, modified: live.content, loading: false, note: '', noteIcon: '' }
  let cmp = openTabs.value.find(t => t.type === 'diff' && t.compare && t.path === live.path)
  if (cmp) Object.assign(cmp, sides)
  else {
    cmp = {
      id: nextTabId(), type: 'diff', compare: true, path: live.path, sha: '', from: '', name: compareName(live.path),
      language: live.language, group: groupOf(live), ...sides,
    }
    openTabs.value.splice(openTabs.value.findIndex(t => t.id === live.id) + 1, 0, cmp)
  }
  activeTabId.value = cmp.id
  notify.info(`Your text in ${live.name} is unchanged. Saving it now will overwrite the version on disk.`)
}

function onKeydown(e) {
  const ctrl = e.ctrlKey || e.metaKey
  if (!ctrl || e.altKey) return
  const k = (e.key || '').toLowerCase()
  if (k === 's' && !e.shiftKey) {
    if (props.editable) { e.preventDefault(); saveActive() }
  } else if (k === 'p' && e.shiftKey) {
    // The command palette (ADM-1322), as VS Code's Ctrl+Shift+P. Monaco's own list stays on F1.
    e.preventDefault(); openPalette()
  } else if ((k === '\\' || e.code === 'Backslash') && !e.shiftKey) {
    // Split: the tab shown opens to the side (ADM-1322).
    if (canOpenToSide(activeTab.value) && !coverFocused.value) { e.preventDefault(); moveToOtherGroup(activeTab.value) }
  } else if ((k === 'p' || k === 'e') && !e.shiftKey) {
    // Go to file, as VS Code (never the browser's print or its address bar).
    e.preventDefault(); openQuickOpen()
  } else if (k === 'f' && e.shiftKey) {
    e.preventDefault(); openSearch()
  }
}

// ── Go to file (Ctrl+P / Ctrl+E) and the editor's settings (ADM-1205, phase A) ─────────────────────────────────
const quickOpen = ref(false)
let quickOpenFrom = null
function openQuickOpen() { quickOpenFrom = document.activeElement; quickOpen.value = true }
function closeQuickOpen() {
  quickOpen.value = false
  const back = quickOpenFrom
  quickOpenFrom = null
  nextTick(() => { if (back && document.contains(back)) back.focus?.() })
}
function onQuickPick({ path, line }) {
  quickOpenFrom = null
  if (line) openAt({ path, line, column: 1 })
  else openFile(path)
}
const settingsOpen = ref(false)
const settingsAnchor = ref(null)
// Under the gear that was pressed (each editor group has one); from the command palette, under the focused group's.
function openSettings(e) {
  const at = e?.currentTarget || document.querySelector?.(`[data-test="cb-group-${focusedGroup.value}"] .tab-gear`)
  settingsAnchor.value = at?.getBoundingClientRect?.() || null
  settingsOpen.value = true
}

// The text editor itself, once Monaco has made it: a search result opens its file at the matching line.
// Each editor group has its own Monaco editor (`editors`, `diffs`); `editorInst` / `diffInst` are the focused group's.
// The language servers, the debugger and a merge's conflict actions bind to one editor: the focused group's, again
// when the focus moves to the other group (ADM-1322).
let editorInst = null
let diffInst = null
const editors = GROUPS.map(() => null)
const diffs = GROUPS.map(() => null)
function onEditorMount(editor, g = 0) {
  editors[g] = editor || null
  try { monacoNs && monacoNs.editor.setTheme(monacoTheme.value) } catch { /* noop */ }
  if (!editor) return
  addAskAction(editor)
  try {
    editor.onDidFocusEditorWidget?.(() => focusGroup(g))
    editor.onDidBlurEditorWidget?.(() => autoSaveOnFocusChange(groups[g].activeId))
    editor.onDidChangeCursorPosition?.((e) => { cursors[g] = { line: e.position.lineNumber, column: e.position.column } })
    editor.onDidDispose?.(() => {
      if (editors[g] === editor) editors[g] = null
      if (editorInst === editor) editorInst = null
      stopVimOn(g)
    })
  } catch { /* an editor without these events keeps working without them */ }
  startVimOn(g)
  if (g === focusedGroup.value) useEditor(g)
  else applyLanguage()
}
// The focused group's editor takes the bindings (it is the one being typed in).
function useEditor(g) {
  diffInst = diffs[g]
  const editor = editors[g]
  if (!editor) return
  editorInst = editor
  applyLanguage()
  revealPending()
  // The project's language servers (ADM-1205 phase F item 16): hover, completion, go to definition, references and
  // problems for the files open in tabs; another file opens here through openAt. Rename, quick fixes and formatting
  // change a file open in a tab through editOpenFile (ADM-1319).
  if (languages && props.editable) {
    releaseLanguages = languages.bind({ monaco: () => monacoNs, editor: () => editorInst, activeTab, openTabs, openAt,
      editOpenFile })
  }
  // The debugger (ADM-1205 phase F item 17): breakpoints in the gutter, the paused line, F5 / F9.
  if (debuggerStore && props.editable) {
    releaseDebugger = debuggerStore.bind({ monaco: () => monacoNs, editor: () => editorInst, activeTab, openAt })
  }
  // A merge's conflict blocks (ADM-1205): VS Code's "Accept current / incoming / both changes" above each one.
  if (props.editable) {
    if (releaseConflicts) releaseConflicts()
    releaseConflicts = bindConflictActions({ monaco: () => monacoNs, editor: () => editorInst })
  }
}
let releaseConflicts = null
onBeforeUnmount(() => { if (releaseConflicts) releaseConflicts() })
const languages = inject(LANGUAGE_SERVERS, null)
// Only this editor's own binding is released: a newer editor may already have bound (the editor is re-created when
// the project turns ready).
let releaseLanguages = null
onBeforeUnmount(() => { if (releaseLanguages) releaseLanguages() })
const debuggerStore = inject(DEBUGGER, null)
let releaseDebugger = null
onBeforeUnmount(() => { if (releaseDebugger) releaseDebugger() })

// "Ask the Coding Agent about this" (ADM-1205 phase E): the selected lines, or the line the cursor is on, go to the
// chat with their file and line numbers. In the editor's right-click menu and on Ctrl+L, as in other code editors.
// Only in the editor of a file (a diff has no single file to name).
function selectionOf(editor) { return codeSelection(editor?.getModel?.(), editor?.getSelection?.(), activeTab.value) }
function addAskAction(editor) {
  if (!editor || !monacoNs || typeof editor.addAction !== 'function') return
  try {
    editor.addAction({
      id: 'lets-code.ask-coding-agent',
      label: 'Ask the Coding Agent about this',
      keybindings: [monacoNs.KeyMod.CtrlCmd | monacoNs.KeyCode.KeyL],
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 0.5,
      run: (ed) => { const s = selectionOf(ed); if (s) emit('ask-selection', s) },
    })
  } catch { /* an editor that cannot take actions keeps working without it */ }
}
function onDiffMount(editor, g = 0) {
  diffs[g] = editor || null
  try {
    editor?.onDidDispose?.(() => { if (diffs[g] === editor) diffs[g] = null; if (diffInst === editor) diffInst = null })
  } catch { /* noop */ }
  if (g === focusedGroup.value) diffInst = diffs[g]
  applyLanguage()
}

// EVERY FILE IS COLOURED IN ITS OWN LANGUAGE (ADM-1205). The editor component keeps ONE Monaco model for every tab
// and never re-reads its `language` prop (monaco-editor-vue3 1.0.5 watches only `value` and `options`): a tab switch
// changed the text, never the language, so every file was coloured as the first one opened (a .ts after a .json had
// no TypeScript colours). The active tab's language is set on the model here, and on both sides of a diff.
function applyLanguage() {
  if (!monacoNs) return
  for (const g of GROUPS) {
    const tab = groupTab(g)
    if (!tab) continue
    const lang = tab.language || 'plaintext'
    const set = (model) => {
      try { if (model && model.getLanguageId() !== lang) monacoNs.editor.setModelLanguage(model, lang) } catch { /* disposed */ }
    }
    const editor = editors[g]
    if (tab.type === 'file' && editor && editor.getModel) {
      const model = editor.getModel()
      set(model)
      // Tab size is the model's own option (Monaco ignores it as an editor option); "auto" leaves the file's.
      const size = editorSettings.tabSize
      if (size !== 'auto') { try { model?.updateOptions({ tabSize: size, indentSize: size, insertSpaces: true }) } catch { /* disposed */ } }
    }
    const diff = diffs[g]
    if (tab.type === 'diff' && diff && diff.getModel) {
      const pair = diff.getModel()
      if (pair) { set(pair.original); set(pair.modified) }
    }
  }
}

// Computed
const activeTab = computed(() => {
  return openTabs.value.find(t => t.id === activeTabId.value)
})
// The model's language follows the tab shown in each group (see applyLanguage).
watch(() => [...GROUPS.map((g) => groups[g].activeId), ...GROUPS.map((g) => groupTab(g)?.language), editorSettings.tabSize],
  () => nextTick(applyLanguage), { flush: 'post' })
// Blame follows the tab shown, and steps aside while it has unsaved edits (ADM-1321).
watch(() => [activeTabId.value, activeTab.value && isDirty(activeTab.value), coverFocused.value], () => nextTick(applyBlame))

// Build a reactive tree node from a server entry. `expanded`/`loaded`/`loading`/`children` are plain
// fields — they live inside the reactive `rootNodes` array, so mutating them updates the tree.
function makeNode(e) {
  return {
    name: e.name, path: e.path, type: e.type, size: e.size,
    gitignored: !!e.gitignored,
    expanded: false, loaded: false, loading: false, children: [],
  }
}

// Fresh entries into the nodes already shown, matched by path: a folder keeps its open state and its children, so a
// refresh never collapses what the person opened.
function mergeNodes(old, entries) {
  const byPath = new Map((old || []).map(n => [n.path, n]))
  return (entries || []).map(e => {
    const n = byPath.get(e.path)
    if (n && n.type === e.type) { n.name = e.name; n.size = e.size; n.gitignored = !!e.gitignored; return n }
    return makeNode(e)
  })
}

// One folder's entries from the project, kept for the next open (ADM-1196). Asking for a folder already on its way
// (a hover, then the click) waits for that answer instead of asking twice.
const _dirInflight = new Map()
function fetchDir(path) {
  if (_dirInflight.has(path)) return _dirInflight.get(path)
  const repoId = props.repositoryId
  const p = whileSandboxStarts(() => api.getRepositoryFiles(props.systemId, repoId, { path }), _wait)
    .then((res) => {
      const entries = res.data.entries || res.data.files || []
      projectCache.dir.set(repoId, path, entries)
      return entries
    })
    .finally(() => { _dirInflight.delete(path) })
  _dirInflight.set(path, p)
  return p
}

// A folder the pointer rests on is read before the click, so the click finds it ready.
function prefetchDir(path) {
  if (projectCache.dir.get(props.repositoryId, path) || _dirInflight.has(path)) return
  fetchDir(path).catch(() => { /* the click asks again and says why */ })
}

// Toggle a directory. A folder read before shows at once and is refreshed in the background; one never read shows
// its spinner until it arrives. The backend returns EVERYTHING (node_modules, venv): a folder is read when opened.
async function expandDir(node) {
  if (node.type !== 'directory') return
  node.expanded = !node.expanded
  if (!node.expanded) return
  if (!node.loaded) {
    const kept = projectCache.dir.get(props.repositoryId, node.path)
    if (kept) { node.children = mergeNodes(node.children, kept); node.loaded = true }
  }
  node.loading = !node.loaded
  try {
    node.children = mergeNodes(node.children, await fetchDir(node.path))
    node.loaded = true
  } catch (e) {
    console.error('Failed to load directory:', node.path, e)
    node.children = []
    node.expanded = false
    node.loaded = false
    notify.error(e?.response?.data?.error || 'Could not open this folder')
  } finally {
    node.loading = false
  }
}

// Debounced server-side name search: every file whose name matches (never the first N).
let _searchTimer = null
watch(fileSearch, (q) => {
  clearTimeout(_searchTimer)
  q = (q || '').trim()
  if (!q) { searchResults.value = []; searching.value = false; return }
  searching.value = true
  _searchTimer = setTimeout(() => runSearch(q), 250)
})

async function runSearch(q) {
  searching.value = true
  try {
    const res = await api.getRepositoryFiles(props.systemId, props.repositoryId, { search: q })
    searchResults.value = res.data.entries || []
  } catch (e) {
    console.error('File search failed:', e)
    searchResults.value = []
  } finally {
    searching.value = false
  }
}

// Methods
// The tree: the project's last-read top level at once, then the fresh one (ADM-1196).
async function loadFiles() {
  treeError.value = ''
  treeErrorDown.value = false
  const kept = projectCache.dir.get(props.repositoryId, '')
  if (kept && !rootNodes.value.length) rootNodes.value = kept.map(makeNode)
  loading.value = !rootNodes.value.length
  try {
    rootNodes.value = mergeNodes(rootNodes.value, await fetchDir(''))
  } catch (error) {
    console.error('Failed to load files:', error, error.response?.data)
    rootNodes.value = []
    // "Not found" / "not yours": nothing kept for this project is shown again.
    if ([403, 404].includes(error?.response?.status)) projectCache.forget(props.repositoryId)
    // A Let's Code project's files are in its sandbox: when that is off or cannot start, say so (ADM-1128).
    treeError.value = error?.response?.data?.error || 'The files could not be loaded.'
    treeErrorDown.value = error?.response?.data?.code === 'SANDBOX_DOWN'
  } finally {
    loading.value = false
  }
}

// Source control's change count, read with the tree rather than when its tab is first opened. The panel shows the
// same status at once when opened (projectCache), then reads it again.
async function loadScmCount() {
  const kept = projectCache.status.get(props.repositoryId)
  if (kept) scmCount.value = (kept.changes || []).length + (kept.untracked || []).length
  try {
    const { data } = await whileSandboxStarts(() => api.getSourceControlStatus(props.systemId, props.repositoryId),
      { isCancelled: () => unmounted })
    if (data && typeof data === 'object' && 'clean' in data) {
      projectCache.status.set(props.repositoryId, data)
      scmCount.value = (data.changes || []).length + (data.untracked || []).length
    }
  } catch { /* the badge only: the Source control tab says what went wrong when it is opened */ }
}

// What the agent changed shows at once, as in VS Code: the tree reloads with the same folders open, Source control
// reloads, and an open file without unsaved edits shows its new content (a remount closed every tab).
const scmPanel = ref(null)
async function refresh() {
  await reloadTree()
  if (scmPanel.value?.refresh) { try { scmPanel.value.refresh() } catch { /* unmounting */ } }
  else loadScmCount()                       // the tab is closed: its count still follows the change
  await reloadOpenTabs()
}
// After the person's own action in Source control (a discard, a commit): the files and open tabs reload; Source
// control already holds its new state.
async function refreshAfterScm() {
  await reloadTree()
  await reloadOpenTabs()
}
// The tree again, with the same folders open: each open folder is read again and merged into what is shown. A
// folder that is gone closes. A closed folder read before is read again when next opened.
async function reloadTree() {
  await loadFiles()
  const again = async (nodes) => {
    for (const n of nodes || []) {
      if (n.type !== 'directory' || !n.expanded) continue
      try {
        n.children = mergeNodes(n.children, await fetchDir(n.path))
        n.loaded = true
      } catch {
        n.children = []; n.expanded = false; n.loaded = false
        continue
      }
      await again(n.children)
    }
  }
  await again(rootNodes.value)
}
// Open files without unsaved edits show their new content; an open diff shows the change as it is now.
async function reloadOpenTabs() {
  blameRead.clear()
  nextTick(applyBlame)
  for (const tab of openTabs.value) {
    if (tab.type === 'diff') { await loadDiffInto(tab); continue }
    if (tab.type === 'image') { await loadImageInto(tab); continue }
    if (tab.type !== 'file' || isDirty(tab)) continue
    try {
      const { data } = await api.getFileContent(props.systemId, props.repositoryId, tab.path)
      // Edits typed while it was read are never replaced.
      if (!isDirty(tab)) { tab.content = data.content; tab.original = data.content; tab.diskSha = data.sha ?? null }
      projectCache.file.set(props.repositoryId, tab.path, data.content)
    } catch { /* a file the change removed keeps its last content in its tab */ }
  }
}
// THE PROJECT SAID WHAT CHANGED (ADM-1196, Phase 2): a watcher in the project's sandbox reports the folders whose
// contents changed, from the editor, the Coding Agent or a command. Only those are read again: an open folder is
// merged, a closed one is read on its next open, a file open in it without unsaved edits shows its new content, and
// Source control reads its status. A burst of reports is applied once. `reset`: the watcher restarted and cannot say
// what changed meanwhile, so everything open is read again.
let _changedDirs = new Set()
let _changedReset = false
let _changeTimer = null
function findNode(path) {
  let nodes = rootNodes.value
  let found = null
  const parts = path.split('/')
  for (let i = 0; i < parts.length; i++) {
    const want = parts.slice(0, i + 1).join('/')
    found = (nodes || []).find(n => n.path === want && n.type === 'directory') || null
    if (!found) return null
    nodes = found.children
  }
  return found
}
function onFilesChanged({ dirs = [], reset = false } = {}) {
  for (const d of dirs) if (typeof d === 'string') _changedDirs.add(d)
  if (reset) _changedReset = true
  clearTimeout(_changeTimer)
  _changeTimer = setTimeout(applyFileChanges, 250)
}
const dirOf = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '')
async function applyFileChanges() {
  _changeTimer = null
  if (unmounted) return
  const dirs = [..._changedDirs]
  const reset = _changedReset
  _changedDirs = new Set()
  _changedReset = false
  if (reset) {
    await refresh()
    return
  }
  for (const d of dirs) {
    projectCache.dir.drop(props.repositoryId, d)
    if (d === '') { if (!treeError.value) await loadFiles(); continue }
    const node = findNode(d)
    if (!node) continue
    if (!node.expanded) { node.loaded = false; continue }
    try {
      node.children = mergeNodes(node.children, await fetchDir(d))
      node.loaded = true
    } catch {
      node.children = []; node.expanded = false; node.loaded = false
    }
  }
  const changed = new Set(dirs)
  for (const tab of openTabs.value) {
    if (!changed.has(dirOf(tab.path || ''))) continue
    if (tab.type === 'diff') { await loadDiffInto(tab); continue }
    if (tab.type === 'image') { await loadImageInto(tab); continue }
    if (tab.type !== 'file' || isDirty(tab)) continue
    try {
      const { data } = await api.getFileContent(props.systemId, props.repositoryId, tab.path)
      if (!isDirty(tab)) { tab.content = data.content; tab.original = data.content; tab.diskSha = data.sha ?? null }
      projectCache.file.set(props.repositoryId, tab.path, data.content)
    } catch { /* removed: its tab keeps its last content */ }
  }
  if (scmPanel.value?.refresh) { try { scmPanel.value.refresh() } catch { /* unmounting */ } }
  else loadScmCount()
}
onBeforeUnmount(() => clearTimeout(_changeTimer))

// "View changes" from the chat: the Source control list, as VS Code's Source Control view.
function showSourceControl() {
  showSide('scm')
  try { scmPanel.value?.refresh?.() } catch { /* the panel mounts with fresh state */ }
}
// How many open files have edits that are not saved: the IDE asks before leaving the project or the page (ADM-1200).
const unsavedCount = computed(() => openTabs.value.filter(isDirty).length)

// "Review changes" from the chat (ADM-1314): the changes since that message, in a Review tab of their own. One tab per
// message: asked again, the tab already open comes in front.
const reviewTabs = computed(() => openTabs.value.filter(t => t.type === 'review'))
// Until the review has loaded, a tab opened without a count (from the person's message) is just "Review".
const reviewName = (n) => (n == null ? 'Review' : `Review: ${n} ${n === 1 ? 'file' : 'files'}`)
function openReview({ messageId, conversationId = null, count = null } = {}) {
  if (messageId == null || messageId === '') return
  showFilesInFront()
  const existing = openTabs.value.find(t => t.type === 'review' && String(t.messageId) === String(messageId))
  if (existing) { activeTabId.value = existing.id; return }
  const tab = { id: nextTabId(), type: 'review', path: '', messageId, conversationId, name: reviewName(count), comments: 0 }
  openTabs.value.push(tab)
  activeTabId.value = tab.id
}
function onReviewLoaded(tab, n) { tab.name = reviewName(n) }
// A file the review wrote or deleted: its folder is read again, as when the project's watcher reports it, so its tab
// (without unsaved edits) shows it at once.
function onReviewWritten(path) { onFilesChanged({ dirs: [dirOf(path || '')] }) }
// Files a Search replace changed (ADM-1320): their folders are read again, so a tab without unsaved edits shows the new
// text; a tab with unsaved edits keeps them (Search asked first), and saving it later asks which version to keep.
function onSearchWritten(paths) { onFilesChanged({ dirs: [...new Set((paths || []).map(dirOf))] }) }
function isUnsavedPath(path) { return openTabs.value.some(t => t.type === 'file' && t.path === path && isDirty(t)) }
function sendReview({ conversationId, text }) {
  return new Promise((resolve) => emit('send-review', { conversationId, text, done: (ok) => resolve(!!ok) }))
}
defineExpose({ refresh, showSourceControl, onFilesChanged, unsavedCount, openReview, openAt })

// PICTURES SHOW AS PICTURES (owner, 2026-11-10: "image still not preview"). The server sends the file's exact
// bytes (files/image/); the tab shows them from a blob: URL, which is freed when the tab closes. An SVG opens as a
// picture too, and "Open as code" opens its text.
const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico', 'svg'])
function extOf(p) {
  const name = (p || '').split('/').pop()
  return name.includes('.') ? name.split('.').pop().toLowerCase() : ''
}
function formatBytes(n) {
  if (!n && n !== 0) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
function onImageLoad(tab, ev) {
  const live = openTabs.value.find(t => t.id === tab.id)
  if (live) { live.width = ev.target.naturalWidth; live.height = ev.target.naturalHeight }
}
// A picture's error body arrives as a Blob: read it, so "starting" is waited for and an error says its words.
function fetchImage(path) {
  return api.getFileImage(props.systemId, props.repositoryId, path).catch(async (e) => {
    const d = e?.response?.data
    if (typeof Blob !== 'undefined' && d instanceof Blob) {
      try { e.response.data = JSON.parse(await d.text()) } catch { e.response.data = {} }
    }
    throw e
  })
}
async function loadImageInto(live) {
  live.loading = !live.url
  live.error = ''
  try {
    const res = await whileSandboxStarts(() => fetchImage(live.path),
      { onWaiting: (s) => { live.waiting = s }, isCancelled: () => unmounted })
    const old = live.url
    live.url = URL.createObjectURL(res.data)
    live.size = res.data.size
    if (old) URL.revokeObjectURL(old)
  } catch (e) {
    if (!live.url) live.error = e?.response?.data?.error || 'The picture could not be shown.'
  } finally {
    live.loading = false
  }
}
async function openImage(filePath) {
  showFilesInFront()
  noteOpened(props.repositoryId, filePath)              // Go to file lists it among the recently opened
  const existing = openTabs.value.find(t => t.path === filePath && t.type === 'image')
  if (existing) { activeTabId.value = existing.id; return }
  const tab = {
    id: nextTabId(), type: 'image', path: filePath, name: filePath.split('/').pop(), url: '', size: 0,
    width: 0, height: 0, loading: true, waiting: 0, error: '', canCode: extOf(filePath) === 'svg',
  }
  openTabs.value.push(tab)
  activeTabId.value = tab.id
  await loadImageInto(openTabs.value.find(t => t.id === tab.id))
}
onBeforeUnmount(() => { for (const t of openTabs.value) if (t.type === 'image' && t.url) URL.revokeObjectURL(t.url) })

async function openFile(filePath, { asCode = false } = {}) {
  showFilesInFront()
  if (!asCode && IMAGE_EXT.has(extOf(filePath))) return openImage(filePath)
  // Check if already open (as text: a picture tab or a changes tab of the same path is another tab)
  const existing = openTabs.value.find(t => t.path === filePath && t.type === 'file')
  if (existing) {
    activeTabId.value = existing.id
    return
  }

  const repoId = props.repositoryId
  const newTab = (content, diskSha = null) => ({
    id: nextTabId(),
    name: filePath.split('/').pop(),
    path: filePath,
    content,
    original: content,   // baseline for dirty tracking (editable mode)
    diskSha,             // the version on disk `original` is (ADM-1323); a copy kept from before has none yet
    language: detectLanguage(filePath),
    type: 'file'
  })
  // A file read before opens at once with what it held then, and is read again (ADM-1196).
  const kept = projectCache.file.get(repoId, filePath)
  let id = null
  if (kept !== null && kept !== undefined) {
    const tab = newTab(kept)
    openTabs.value.push(tab)
    activeTabId.value = id = tab.id
  }
  try {
    const response = await whileSandboxStarts(() => api.getFileContent(props.systemId, repoId, filePath), _wait)
    const content = response.data.content
    const sha = response.data.sha ?? null
    projectCache.file.set(repoId, filePath, content)
    noteOpened(repoId, filePath)                        // Go to file lists it among the recently opened
    const live = id !== null ? openTabs.value.find(t => t.id === id) : null
    if (id === null) {
      const tab = newTab(content, sha)
      openTabs.value.push(tab)
      activeTabId.value = tab.id
    } else if (live && live.original === content) {
      live.diskSha = sha                                // the copy kept is the file on disk: edits start from it
    } else if (live) {
      // Changed since it was last read. Unsaved edits are never replaced: the person is told instead, and their
      // Save asks which version to keep (never the new sha: that would overwrite a version they have not seen).
      if (!isDirty(live)) { live.content = content; live.original = content; live.diskSha = sha }
      else {
        live.diskSha = live.diskSha || CHANGED_SINCE_OPENED
        notify.warning(`${live.name} changed in the project since you opened it. Saving will ask which version to keep.`)
      }
    }
  } catch (error) {
    console.error('Failed to load file:', error)
    const live = id !== null ? openTabs.value.find(t => t.id === id) : null
    if (live && [404, 400].includes(error?.response?.status)) {
      // Kept from before, gone now: the tab closes rather than show a file that is not there.
      openTabs.value = openTabs.value.filter(t => t.id !== id)
      healGroups()                                    // the group shows its last tab, or none
      projectCache.file.set(repoId, filePath, null)
    }
    notify.error(error?.response?.data?.error || 'Could not open the file')
  }
}

async function closeTab(tabId) {
  const index = openTabs.value.findIndex(t => t.id === tabId)
  if (index === -1) return

  const tab = openTabs.value[index]
  if (tab.type === 'review' && tab.comments > 0) {
    const ok = await confirm({
      title: 'Discard your comments?',
      message: `"${tab.name}" has ${tab.comments} ${tab.comments === 1 ? 'comment' : 'comments'} not sent to the Coding Agent. Close without sending?`,
      confirmText: 'Close', cancelText: 'Keep reviewing', danger: true,
    })
    if (!ok) return
  }
  if (tab.type === 'merge' && tab.edited) {
    const ok = await confirm({
      title: 'Discard the merge result?',
      message: `The result for ${tab.path} is not saved. Close without marking it resolved?`,
      confirmText: 'Close', cancelText: 'Keep merging', danger: true,
    })
    if (!ok) return
  }
  if (isDirty(tab)) {
    const ok = await confirm({
      title: 'Discard unsaved changes?',
      message: `"${tab.name}" has unsaved edits. Close without saving?`,
      confirmText: 'Close', cancelText: 'Keep editing', danger: true,
    })
    if (!ok) return
  }

  // Switch to the tab on its left in its group when closing the one the group shows (ADM-1322: each group its own).
  const g = groupOf(tab)
  const at = tabsOfGroup(openTabs.value, g).findIndex(t => t.id === tabId)
  const shown = groups[g].activeId === tabId
  const i = openTabs.value.findIndex(t => t.id === tabId)          // the list may have changed while asking
  if (i === -1) return
  openTabs.value.splice(i, 1)
  if (tab.type === 'image' && tab.url) URL.revokeObjectURL(tab.url)     // the picture's memory goes with its tab
  if (shown) {
    const left = tabsOfGroup(openTabs.value, g)
    groups[g].activeId = left.length ? left[Math.max(0, at - 1)].id : null
  }
  healGroups()
}

function detectLanguage(filePath) {
  return languageFor(filePath, monacoLanguages.value)
}

// Sidebar resize
let isResizing = false
function startResize() {
  isResizing = true
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
}

function handleResize(e) {
  if (!isResizing) return
  const newWidth = e.clientX
  if (newWidth >= 200 && newWidth <= 600) {
    sidebarWidth.value = newWidth
  }
}

function stopResize() {
  isResizing = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
}

// Lifecycle
onMounted(() => {
  loadFiles()
  loadScmCount()                            // alongside the tree, not after it (ADM-1196)
  if (props.editable) window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  unmounted = true
  if (props.editable) window.removeEventListener('keydown', onKeydown)
})

// ── THE EXPLORER'S FILE ACTIONS (ADM-1205, LETS_CODE_IDE_GAPS_PLAN.md phase B) ──────────────────────────────────
// As VS Code's explorer: a context menu (right-click, the Menu key, Shift+F10, or a row's "More" button), New file /
// New folder / Rename typed in place in the tree, Delete after a question, drag a row onto a folder to move it, drop
// files or folders from the computer to upload them, Download a file or a folder (.tar.gz). Every action is the
// server's; the tree then reads the folders it changed.

const baseOf = (p) => p.split('/').pop()
const joinPath = (dir, name) => (dir ? `${dir}/${name}` : name)
const errorOf = (e, fallback) => e?.response?.data?.error || fallback

// A folder the tree shows again with what is in it now (closed: read when next opened).
async function refreshDir(path) {
  projectCache.dir.drop(props.repositoryId, path)
  if (!path) { await loadFiles(); return }
  const node = findNode(path)
  if (!node) return
  if (!node.expanded) { node.loaded = false; return }
  try {
    node.children = mergeNodes(node.children, await fetchDir(path))
    node.loaded = true
  } catch { node.children = []; node.expanded = false; node.loaded = false }
}
// A row the server has just deleted or moved away leaves the tree at once: the folder is read again after, and the
// project's change report for it (which would read a folder that is gone) finds nothing to read.
function dropNode(path) {
  const parent = dirOf(path)
  const list = parent ? findNode(parent)?.children : rootNodes.value
  if (!list) return
  const i = list.findIndex((n) => n.path === path)
  if (i >= 0) list.splice(i, 1)
}
async function openFolder(path) {
  if (!path) return
  const node = findNode(path)
  if (node && !node.expanded) await expandDir(node)
}
function afterChange(...dirs) {
  for (const d of new Set(dirs)) refreshDir(d)
  if (scmPanel.value?.refresh) { try { scmPanel.value.refresh() } catch { /* unmounting */ } }
  else loadScmCount()
}

// The context menu.
const menu = reactive({ open: false, x: 0, y: 0, items: [], label: '', target: null })
function menuItems(node) {
  if (!node) {
    return [
      { id: 'new-file', label: 'New file', icon: 'lucide:file-plus' },
      { id: 'new-folder', label: 'New folder', icon: 'lucide:folder-plus' },
      { id: 'upload', label: 'Upload files', icon: 'lucide:upload' },
      { separator: true },
      { id: 'download', label: 'Download project (.tar.gz)', icon: 'lucide:download' },
    ]
  }
  const dir = node.type === 'directory'
  return [
    ...(dir ? [
      { id: 'new-file', label: 'New file', icon: 'lucide:file-plus' },
      { id: 'new-folder', label: 'New folder', icon: 'lucide:folder-plus' },
      { id: 'upload', label: 'Upload files here', icon: 'lucide:upload' },
      { separator: true },
    ] : [{ id: 'open', label: 'Open', icon: 'lucide:file-text' }, { separator: true }]),
    { id: 'download', label: dir ? 'Download (.tar.gz)' : 'Download', icon: 'lucide:download' },
    { id: 'copy-path', label: 'Copy path', icon: 'lucide:copy' },
    { separator: true },
    { id: 'rename', label: 'Rename', icon: 'lucide:pencil', keys: 'F2' },
    { id: 'delete', label: 'Delete', icon: 'lucide:trash-2', keys: 'Del', danger: true },
  ]
}
function openMenuAt(x, y, node) {
  if (!props.editable) return
  menu.target = node || null
  menu.items = menuItems(node)
  menu.label = node ? `Actions for ${node.name}` : 'Project actions'
  menu.x = x
  menu.y = y
  menu.open = true
}
function openMenuFor(el, node) {
  const r = el.getBoundingClientRect()
  openMenuAt(r.left + Math.min(24, r.width / 2), r.bottom, node)
}
function onTreeContextMenu(e) {
  if (!props.editable) return
  e.preventDefault()
  openMenuAt(e.clientX, e.clientY, null)
}
function onMenuSelect(item) {
  const node = menu.target
  const dir = node ? (node.type === 'directory' ? node.path : dirOf(node.path)) : ''
  switch (item.id) {
    case 'open': return openFile(node.path)
    case 'new-file': return startNew('file', dir)
    case 'new-folder': return startNew('directory', dir)
    case 'upload': return pickUpload(dir)
    case 'download': return downloadEntry(node)
    case 'copy-path': return copyPath(node)
    case 'rename': return startRename(node)
    case 'delete': return deleteEntry(node)
  }
}

// New file / New folder / Rename, typed in place in the tree. Enter saves, Escape cancels, leaving the box saves a
// changed name (as VS Code). A refusal (the name is taken) is said under the box, which stays open.
const pending = ref(null)          // { mode: 'file' | 'directory' | 'rename', parent, node?, value, error, busy }
async function startNew(mode, parent) {
  if (!props.editable) return
  showSide('files')
  fileSearch.value = ''
  await openFolder(parent)
  pending.value = { mode, parent, value: '', error: '', busy: false }
}
function startRename(node) {
  if (!props.editable || !node) return
  pending.value = { mode: 'rename', parent: dirOf(node.path), node, value: node.name, error: '', busy: false }
}
function cancelPending() {
  pending.value = null
}
function nameProblem(name) {
  if (!name) return 'Type a name.'
  if (name.includes('\\')) return 'A name cannot contain "\\".'
  if (name.split('/').some((part) => part === '..' || part === '.')) return 'A name cannot be "." or "..".'
  if (name.split('/').includes('.git')) return 'The .git folder is managed in Source control.'
  return ''
}
async function commitPending({ fromBlur = false } = {}) {
  const p = pending.value
  if (!p || p.busy) return
  const name = (p.value || '').trim().replace(/^\/+|\/+$/g, '')
  if (fromBlur && (!name || (p.mode === 'rename' && name === p.node.name))) { cancelPending(); return }
  if (p.mode === 'rename' && name === p.node.name) { cancelPending(); return }
  const problem = nameProblem(name)
  if (problem) { p.error = problem; return }
  const path = joinPath(p.parent, name)
  p.busy = true
  p.error = ''
  try {
    if (p.mode === 'rename') {
      await api.renameRepositoryEntry(props.systemId, props.repositoryId, p.node.path, path)
      retargetTabs(p.node.path, path)
      pending.value = null
      afterChange(p.parent, dirOf(path))
      notify.success(`Renamed to ${baseOf(path)}`)
    } else {
      await api.createRepositoryEntry(props.systemId, props.repositoryId, path, p.mode)
      pending.value = null
      await refreshDir(p.parent)
      afterChange(dirOf(path))
      if (p.mode === 'file') openFile(path)
    }
  } catch (e) {
    if (pending.value === p) {
      p.busy = false
      p.error = e?.response?.status === 409 ? `${baseOf(path)} is already here. Choose another name.`
        : errorOf(e, p.mode === 'rename' ? 'The name could not be changed.' : 'It could not be created.')
    }
  }
}

// Open tabs follow a renamed or moved file or folder; their unsaved edits stay.
function retargetTabs(oldPath, newPath) {
  forgetRecent(props.repositoryId, oldPath)
  for (const tab of openTabs.value) {
    if (!tab.path || (tab.path !== oldPath && !tab.path.startsWith(`${oldPath}/`))) continue
    const moved = newPath + tab.path.slice(oldPath.length)
    projectCache.file.set(props.repositoryId, tab.path, null)
    tab.path = moved
    tab.name = tab.type !== 'diff' ? baseOf(moved)
      : tab.compare ? compareName(moved) : `${baseOf(moved)} (${tab.sha ? tab.sha.slice(0, 7) : 'changes'})`
    if (tab.type === 'file') projectCache.file.set(props.repositoryId, moved, tab.original)
  }
}

async function deleteEntry(node) {
  if (!props.editable || !node) return
  const dir = node.type === 'directory'
  const under = (t) => t.path === node.path || t.path?.startsWith(`${node.path}/`)
  const unsaved = openTabs.value.filter((t) => under(t) && isDirty(t))
  const ok = await confirm({
    title: `Delete ${node.name}?`,
    message: (dir ? `The folder ${node.path} and everything in it will be deleted from the project.`
      : `${node.path} will be deleted from the project.`)
      + (unsaved.length ? ` Unsaved edits in ${unsaved.map((t) => t.name).join(', ')} will be lost.` : '')
      + ' A committed file can be brought back with Discard in Source control; a file never committed cannot.',
    confirmText: 'Delete', cancelText: 'Keep', danger: true,
  })
  if (!ok) return
  try {
    await api.deleteRepositoryEntry(props.systemId, props.repositoryId, node.path)
  } catch (e) {
    notify.error(errorOf(e, `${node.name} could not be deleted.`))
    return
  }
  for (const t of openTabs.value.filter(under)) {
    if (t.type === 'image' && t.url) URL.revokeObjectURL(t.url)
    projectCache.file.set(props.repositoryId, t.path, null)
  }
  dropNode(node.path)
  const closing = new Set(openTabs.value.filter(under).map((t) => t.id))
  openTabs.value = openTabs.value.filter((t) => !closing.has(t.id))
  healGroups()                                        // a group that showed a deleted file shows its last tab
  forgetRecent(props.repositoryId, node.path)
  afterChange(dirOf(node.path))
  notify.success(`Deleted ${node.name}`)
}

async function moveEntry(fromPath, toDir) {
  if (dirOf(fromPath) === toDir || fromPath === toDir) return
  if (toDir.startsWith(`${fromPath}/`)) { notify.error('A folder cannot be moved into itself.'); return }
  const to = joinPath(toDir, baseOf(fromPath))
  try {
    await api.renameRepositoryEntry(props.systemId, props.repositoryId, fromPath, to)
  } catch (e) {
    notify.error(e?.response?.status === 409 ? `${toDir || 'The project'} already has ${baseOf(fromPath)}.`
      : errorOf(e, `${baseOf(fromPath)} could not be moved.`))
    return
  }
  retargetTabs(fromPath, to)
  dropNode(fromPath)
  await refreshDir(dirOf(fromPath))
  await openFolder(toDir)
  afterChange(toDir)
  notify.success(`Moved ${baseOf(fromPath)} to ${toDir || 'the project'}`)
}

// Uploads: "Upload files" picks, a drop from the computer arrives with a dropped folder's layout. A file that is
// already there is replaced only after the person says so.
const uploadInput = ref(null)
const uploading = ref('')
let uploadDir = ''
function pickUpload(dir) {
  uploadDir = dir || ''
  if (uploadInput.value) { uploadInput.value.value = ''; uploadInput.value.click() }
}
function onPicked(e) {
  const files = filesFromPicker(e.target.files)
  if (files.length) uploadInto(uploadDir, files)
}
async function uploadInto(dir, files) {
  const big = tooLarge(files)
  if (big.length) {
    notify.error(`${big.map((f) => f.path).join(', ')}: larger than ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB, `
      + 'the most one upload can carry. Add it with the Terminal (for example with curl or git).')
    files = files.filter((f) => !big.includes(f))
    if (!files.length) return
  }
  await openFolder(dir)
  let overwrite = false
  let done = 0
  const parts = uploadParts(files)
  try {
    for (let i = 0; i < parts.length; i++) {
      uploading.value = `Uploading ${files.length} ${files.length === 1 ? 'file' : 'files'}… (${done} done)`
      // A file larger than a part goes in pieces (ADM-1269): how far it is, in the same line.
      const onPiece = (sent, total) => {
        uploading.value = `Uploading ${parts[i][0].path}… ${Math.round((100 * sent) / total)}% (${done} done)`
      }
      try {
        await api.uploadRepositoryFiles(props.systemId, props.repositoryId, dir, parts[i], { overwrite, onPiece })
      } catch (e) {
        const there = e?.response?.status === 409 ? e.response.data?.exists : null
        if (!there || overwrite) throw e
        const ok = await confirm({
          title: there.length === 1 ? `Replace ${baseOf(there[0])}?` : `Replace ${there.length} files?`,
          message: `Already in the project: ${there.join(', ')}. Replace with the uploaded ${there.length === 1 ? 'file' : 'files'}?`,
          confirmText: 'Replace', cancelText: 'Cancel upload', danger: true,
        })
        if (!ok) { notify.info(done ? `Uploaded ${done} ${done === 1 ? 'file' : 'files'}; the rest was not uploaded.` : 'Upload cancelled.'); return }
        overwrite = true
        await api.uploadRepositoryFiles(props.systemId, props.repositoryId, dir, parts[i], { overwrite, onPiece })
      }
      done += parts[i].length
    }
    notify.success(`Uploaded ${done} ${done === 1 ? 'file' : 'files'} to ${dir || 'the project'}`)
  } catch (e) {
    notify.error(`${errorOf(e, 'The upload failed.')}${done ? ` ${done} ${done === 1 ? 'file was' : 'files were'} uploaded before it stopped.` : ''}`)
  } finally {
    uploading.value = ''
    const dirs = new Set([dir, ...files.map((f) => dirOf(joinPath(dir, f.path)))])
    afterChange(...dirs)
  }
}

async function downloadEntry(node) {
  const path = node ? node.path : ''
  const name = node ? node.name : (props.projectName || 'project')
  try {
    const res = await whileSandboxStarts(() => api.downloadRepositoryEntry(props.systemId, props.repositoryId, path),
      { isCancelled: () => unmounted })
    const isDir = !node || node.type === 'directory'
    saveBlob(res.data, isDir ? `${name}.tar.gz` : name)
  } catch (e) {
    notify.error(errorOf(e, `${name} could not be downloaded.`))
  }
}

async function copyPath(node) {
  try {
    await navigator.clipboard.writeText(node.path)
    notify.success('Path copied')
  } catch {
    notify.error('The path could not be copied. Your browser did not allow it.')
  }
}

// Drag and drop: a row onto a folder (or onto the list's empty space, the project's top) moves it; files from the
// computer upload into that folder. A closed folder held over for a moment opens.
const dragPath = ref(null)
const dropTarget = ref(null)
const DRAG_TYPE = 'application/x-lets-code-path'
let openTimer = null
function onDragStart(e, node) {
  dragPath.value = node.path
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData(DRAG_TYPE, node.path)
  e.dataTransfer.setData('text/plain', node.path)
}
function onDragEnd() {
  dragPath.value = null
  dropTarget.value = null
  clearTimeout(openTimer)
}
function onDragOver(e, dir, node = null) {
  if (!props.editable) return
  const files = [...(e.dataTransfer?.types || [])].includes('Files')
  if (!dragPath.value && !files) return
  e.preventDefault()
  e.stopPropagation()
  e.dataTransfer.dropEffect = files ? 'copy' : 'move'
  if (dropTarget.value !== dir) {
    dropTarget.value = dir
    clearTimeout(openTimer)
    if (node && node.type === 'directory' && !node.expanded) openTimer = setTimeout(() => expandDir(node), 650)
  }
}
function onDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) { dropTarget.value = null; clearTimeout(openTimer) }
}
async function onDrop(e, dir) {
  if (!props.editable) return
  e.preventDefault()
  e.stopPropagation()
  const from = dragPath.value || e.dataTransfer.getData(DRAG_TYPE)
  onDragEnd()
  if (from) return moveEntry(from, dir)
  const files = await filesFromDrop(e.dataTransfer)
  if (files.length) uploadInto(dir, files)
}

// The Search tab, and a result opening its file at the line.
const contentSearch = ref(null)
function openSearch() {
  showSide('search')
  nextTick(() => contentSearch.value?.focus())
}
let pendingReveal = null
function revealPending() {
  const r = pendingReveal
  if (!r || !editorInst || activeTab.value?.path !== r.path || activeTab.value?.type !== 'file') return
  setTimeout(() => {
    try {
      editorInst.revealLineInCenter(r.line)
      editorInst.setPosition({ lineNumber: r.line, column: r.column || 1 })
      editorInst.focus()
      pendingReveal = null
    } catch { /* the editor went away */ }
  }, 0)
}
async function openAt({ path, line, column }) {
  pendingReveal = { path, line, column }
  await openFile(path)
  await nextTick()
  revealPending()
}
watch(() => activeTab.value && activeTab.value.content, () => { if (pendingReveal) nextTick(revealPending) })

// ── EDITOR GROUPS AND TABS (ADM-1322; utils/editorGroups) ──────────────────────────────────────────────────────
// A group's tabs (pinned first), the tab it shows, and what each group draws.
function groupTab(g) {
  const id = groups[g].activeId
  return id == null ? null : openTabs.value.find(t => t.id === id && groupOf(t) === g) || null
}
const groupViews = computed(() => GROUPS.filter(g => g === 0 || split.value).map(g => ({
  g, tabs: tabsOfGroup(openTabs.value, g), tab: groupTab(g), reviews: reviewTabs.value.filter(t => groupOf(t) === g),
})))
function isShown(tab, g) { return groups[g].activeId === tab.id && !(g === 0 && chatFront.value) }

// Every group shows one of its own tabs (its last when the one it showed has gone). The second group closes when its
// last tab leaves it; when the first group has nothing left (and no chat), the second becomes the only one.
function healGroups() {
  const g1 = tabsOfGroup(openTabs.value, 1)
  if (g1.length && !chatOn.value && !tabsOfGroup(openTabs.value, 0).length && g1.every(canMoveGroup)) {
    for (const t of g1) t.group = 0
    groups[0].activeId = groups[1].activeId
    groups[1].activeId = null
    focusedGroup.value = 0
  }
  for (const g of GROUPS) {
    const mine = tabsOfGroup(openTabs.value, g)
    if (!mine.some(t => t.id === groups[g].activeId)) groups[g].activeId = mine.length ? mine[mine.length - 1].id : null
  }
  if (!split.value && focusedGroup.value !== 0) focusedGroup.value = 0
}
watch(() => openTabs.value.map(t => `${t.id}:${groupOf(t)}`).join(','), healGroups)

// The group clicked or typed in. `show`: also put the keyboard focus in its editor (on a narrow screen the group then
// shows, the other hides).
function focusGroup(g, { show = false } = {}) {
  if (g === 1 && !split.value) return
  if (focusedGroup.value !== g) focusedGroup.value = g
  if (show) nextTick(() => { try { editors[g]?.focus?.() } catch { /* gone */ } })
}
watch(focusedGroup, (g) => {
  diffInst = diffs[g]
  if (editors[g] && editors[g] !== editorInst) useEditor(g)
})

// "Open to the side" (Ctrl+\, the tab's menu, or a tab dropped on the editor): the tab moves to the other group and is
// shown there. A Review or merge tab stays where it is (it holds comments or a merge result not saved). A group's only
// tab is not offered (with nothing left behind, the group would close, as VS Code's does), unless the chat stays there.
function canOpenToSide(tab) {
  return !!tab && canMoveGroup(tab)
    && (groupOf(tab) === 1 || chatOn.value || tabsOfGroup(openTabs.value, 0).length > 1)
}
function moveToOtherGroup(tab, to = 1 - groupOf(tab)) {
  if (!tab || !canMoveGroup(tab) || groupOf(tab) === to) return
  openTabs.value = moveTab(openTabs.value, tab.id, { group: to })
  focusedGroup.value = to
  groups[to].activeId = tab.id
  if (to === 0 && chatTabs) chatTabs.showFiles()
  pane.value = 'editor'
  healGroups()
}
// Close a group: each of its tabs closes as a tab does (one with unsaved edits asks first).
async function closeGroup(g) {
  for (const t of tabsOfGroup(openTabs.value, g)) await closeTab(t.id)
}
async function closeTabs(list) { for (const t of list) await closeTab(t.id) }
function togglePin(tab) { if (tab) tab.pinned = !tab.pinned }
async function saveAll() { for (const t of openTabs.value.filter(isDirty)) await saveTab(t) }

// A tab's keys: Enter / Space show it, Delete closes it, Left / Right / Home / End move along the row,
// Ctrl+Shift+PageUp / PageDown move the tab itself, the Menu key or Shift+F10 open its menu.
function focusTabEl(id) {
  nextTick(() => document.querySelector?.(`.code-browser [data-tab-id="${id}"]`)?.focus())
}
function onTabKey(e, tab) {
  if (e.target !== e.currentTarget) return                       // the tab's own close or unpin button
  const ctrl = e.ctrlKey || e.metaKey
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showFile(tab.id) }
  else if (e.key === 'Delete' && !ctrl) { e.preventDefault(); closeTab(tab.id) }
  else if (ctrl && e.shiftKey && (e.key === 'PageUp' || e.key === 'PageDown')) {
    e.preventDefault()
    openTabs.value = stepTab(openTabs.value, tab.id, e.key === 'PageUp' ? -1 : 1)
    focusTabEl(tab.id)
  } else if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) && !ctrl) {
    const row = [...(e.currentTarget.parentElement?.querySelectorAll('[role="tab"]') || [])]
    const at = row.indexOf(e.currentTarget)
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? row.length - 1
      : (at + (e.key === 'ArrowLeft' ? -1 : 1) + row.length) % row.length
    e.preventDefault()
    row[to]?.focus()
  } else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
    e.preventDefault()
    const r = e.currentTarget.getBoundingClientRect()
    openTabMenuAt(r.left + 12, r.bottom, tab)
  }
}
// The middle button closes a tab (a pinned one stays).
function onTabAuxClick(e, tab) {
  if (e.button !== 1 || tab.pinned) return
  e.preventDefault()
  closeTab(tab.id)
}

// A tab's menu.
const tabMenu = reactive({ open: false, x: 0, y: 0, items: [], label: '', target: null })
function tabMenuItems(tab) {
  const g = groupOf(tab)
  const row = tabsOfGroup(openTabs.value, g).filter(t => !!t.pinned === !!tab.pinned)
  const at = row.indexOf(tab)
  return [
    { id: 'pin', label: tab.pinned ? 'Unpin' : 'Pin', icon: tab.pinned ? 'lucide:pin-off' : 'lucide:pin' },
    ...(canOpenToSide(tab) ? [{ id: 'side', icon: 'lucide:columns-2',
      label: split.value ? `Move to editor group ${2 - g}` : 'Open to the side', keys: split.value ? '' : 'Ctrl+\\' }] : []),
    { id: 'left', label: 'Move left', icon: 'lucide:arrow-left', keys: 'Ctrl+Shift+PgUp', disabled: at <= 0 },
    { id: 'right', label: 'Move right', icon: 'lucide:arrow-right', keys: 'Ctrl+Shift+PgDn', disabled: at === row.length - 1 },
    { separator: true },
    { id: 'close', label: 'Close', icon: 'lucide:x', keys: 'Del' },
    { id: 'close-others', label: 'Close others', icon: 'lucide:copy-x', disabled: !othersToClose(openTabs.value, tab.id).length },
    { id: 'close-right', label: 'Close to the right', icon: 'lucide:arrow-right-to-line', disabled: !rightToClose(openTabs.value, tab.id).length },
    ...(tab.path ? [{ separator: true },
      { id: 'reveal', label: 'Show in Files', icon: 'lucide:folder-search' },
      { id: 'copy-path', label: 'Copy path', icon: 'lucide:copy' }] : []),
  ]
}
function openTabMenuAt(x, y, tab) {
  tabMenu.target = tab
  tabMenu.items = tabMenuItems(tab)
  tabMenu.label = `Actions for the tab ${tab.name}`
  tabMenu.x = x
  tabMenu.y = y
  tabMenu.open = true
}
function openTabMenu(e, tab) { openTabMenuAt(e.clientX, e.clientY, tab) }
function onTabMenuSelect(item) {
  const tab = tabMenu.target
  if (!tab || !openTabs.value.some(t => t.id === tab.id)) return
  switch (item.id) {
    case 'pin': return togglePin(tab)
    case 'side': return moveToOtherGroup(tab)
    case 'left': case 'right':
      openTabs.value = stepTab(openTabs.value, tab.id, item.id === 'left' ? -1 : 1)
      return focusTabEl(tab.id)
    case 'close': return closeTab(tab.id)
    case 'close-others': return closeTabs(othersToClose(openTabs.value, tab.id))
    case 'close-right': return closeTabs(rightToClose(openTabs.value, tab.id))
    case 'reveal': return revealInFiles(tab.path, { file: true })
    case 'copy-path': return copyPath({ path: tab.path })
  }
}

// Drag a tab along its row, onto the other group's row, or onto an editor (the side: "Open to the side").
const TAB_DRAG = 'application/x-lets-code-tab'
const tabDrag = ref(null)            // the id of the tab being dragged
const tabDrop = ref(null)            // where it would land: { g, id } (before that tab; id null: the end of the row)
const editorDrop = ref(null)         // the group whose editor it would open in
const draggedTab = () => (tabDrag.value == null ? null : openTabs.value.find(t => t.id === tabDrag.value) || null)
function onTabDragStart(e, tab) {
  tabDrag.value = tab.id
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData(TAB_DRAG, String(tab.id))
  e.dataTransfer.setData('text/plain', tab.path || tab.name)
}
function onTabDragEnd() { tabDrag.value = null; tabDrop.value = null; editorDrop.value = null }
function onTabDragOver(e, g, target) {
  const tab = draggedTab()
  if (!tab || (g !== groupOf(tab) && !canMoveGroup(tab))) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  const id = target ? target.id : null
  if (!tabDrop.value || tabDrop.value.g !== g || tabDrop.value.id !== id) tabDrop.value = { g, id }
}
function onTabDragLeave(e) { if (!e.currentTarget.contains(e.relatedTarget)) tabDrop.value = null }
function onTabDrop(e, g, target) {
  const tab = draggedTab()
  if (!tab) return
  e.preventDefault()
  onTabDragEnd()
  const moved = moveTab(openTabs.value, tab.id, { group: g, beforeId: target ? target.id : null })
  if (moved === openTabs.value) return
  openTabs.value = moved
  showFile(tab.id)
  healGroups()
}
// The editor area: with one group, a tab dropped on it opens to the side; with two, it moves into that group.
const editorDropTo = (g) => (split.value ? g : 1)
function onEditorDragOver(e, g) {
  const tab = draggedTab()
  if (!canOpenToSide(tab) || groupOf(tab) === editorDropTo(g) || (narrow.value && !split.value)) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  editorDrop.value = g
}
function onEditorDragLeave(e) { if (!e.currentTarget.contains(e.relatedTarget)) editorDrop.value = null }
function onEditorDrop(e, g) {
  const tab = draggedTab()
  if (!tab || editorDrop.value !== g) return
  e.preventDefault()
  onTabDragEnd()
  moveToOtherGroup(tab, editorDropTo(g))
}

// ── MARKDOWN PREVIEW (ADM-1322; utils/markdownPreview) ──────────────────────────────────────────────────────────
// A .md tab shows its text (the default), its preview beside the text, or the preview alone. The editor stays mounted
// under the preview. Rendered once per text.
const isMarkdownTab = (tab) => !!tab && tab.type === 'file' && isMarkdownPath(tab.path)
const mdViewOf = (tab) => (isMarkdownTab(tab) && ['split', 'preview'].includes(tab.mdView) ? tab.mdView : 'text')
function setMdView(tab, mode) { if (isMarkdownTab(tab)) tab.mdView = tab.mdView === mode ? 'text' : mode }
const mdRendered = new WeakMap()
function mdHtml(tab) {
  const text = tab.content ?? ''
  const kept = mdRendered.get(tab)
  if (kept && kept.text === text) return kept.html
  const html = renderMarkdownPreview(text)
  mdRendered.set(tab, { text, html })
  return html
}
// A picture the file names by a project path ("docs/shot.png", "../logo.svg") is the project's own file: read through
// the editor's signed-in API (files/image, as an image tab is) and shown from a blob: URL, since a plain <img src>
// would ask the app, not the project (live, 2026-11-20). Each project file is read once; the URLs are freed on unmount.
const previewImages = new Map()                  // project path → Promise<blob: URL | ''>
function previewImageUrl(path) {
  if (!previewImages.has(path)) {
    previewImages.set(path, api.getFileImage(props.systemId, props.repositoryId, path)
      .then((res) => URL.createObjectURL(res.data)).catch(() => ''))
  }
  return previewImages.get(path)
}
function onPreviewEl(el, tab) {
  if (!el) return
  nextTick(() => {
    for (const img of el.querySelectorAll('img[src]')) {
      if (img.dataset.lcSrc) continue
      const path = projectLinkOf(img.getAttribute('src'), tab.path)
      if (!path) continue                        // a web address loads as it is
      img.dataset.lcSrc = path
      img.removeAttribute('src')
      previewImageUrl(path).then((url) => { if (url) img.src = url; else img.alt = `${img.alt || path} (not found in the project)` })
    }
  })
}
onBeforeUnmount(() => {
  for (const p of previewImages.values()) p.then((url) => { if (url) URL.revokeObjectURL(url) })
  previewImages.clear()
})
// A link to another file of the project opens it in a tab; an anchor in the same file does nothing (the preview has
// no heading ids); every other link opens in a new browser tab (target="_blank", rel="noopener").
function onPreviewClick(e, tab) {
  const a = e.target?.closest?.('a')
  if (!a) return
  const href = a.getAttribute('href') || ''
  if (href.startsWith('#')) { e.preventDefault(); return }
  const path = projectLinkOf(href, tab.path)
  if (path) { e.preventDefault(); openFile(path) }
}

// ── OUTLINE AND BREADCRUMBS (ADM-1322; utils/editorSymbols) ─────────────────────────────────────────────────────
// Each group's file is asked for its symbols when it is shown and after a pause in typing, and again when its language
// server becomes ready. Nothing is shown for a file no language server answers for.
const cursors = reactive(GROUPS.map(() => ({ line: 1, column: 1 })))
const symbolsByPath = reactive({})               // path → { state: 'starting' | 'ready' | 'none', symbols }
const symbolTimers = new Map()
const SYMBOLS_WAIT_MS = 400
const SYMBOLS_RETRY_MS = 1500
const SYMBOLS_RETRIES = 40                       // a server still starting is asked again for a minute
function wantSymbols(tab, wait = SYMBOLS_WAIT_MS) {
  if (!tab || tab.type !== 'file' || !tab.path) return
  clearTimeout(symbolTimers.get(tab.path))
  symbolTimers.set(tab.path, setTimeout(() => readSymbols(tab.path), wait))
}
async function readSymbols(path, tries = 0) {
  symbolTimers.delete(path)
  if (unmounted) return
  if (!openTabs.value.some(t => t.type === 'file' && t.path === path)) { delete symbolsByPath[path]; return }
  if (!languages || typeof languages.documentSymbols !== 'function') { symbolsByPath[path] = { state: 'none', symbols: [] }; return }
  let r
  try { r = await languages.documentSymbols(path) } catch { r = { state: 'none' } }
  if (unmounted) return
  const kept = symbolsByPath[path]
  if (r && r.state === 'ready') symbolsByPath[path] = { state: 'ready', symbols: symbolsOf(r.result) }
  else if (r && r.state === 'starting') {
    if (!kept || kept.state !== 'ready') symbolsByPath[path] = { state: 'starting', symbols: [] }
    if (tries < SYMBOLS_RETRIES && !symbolTimers.has(path)) {
      symbolTimers.set(path, setTimeout(() => readSymbols(path, tries + 1), SYMBOLS_RETRY_MS))
    }
  } else symbolsByPath[path] = { state: 'none', symbols: [] }
}
const shownText = GROUPS.map(() => ({ path: null, text: null }))
watch(() => GROUPS.map(g => { const t = groupTab(g); return t && t.type === 'file' ? [t.path, t.content] : null }), (now) => {
  now.forEach((pair, g) => {
    const seen = shownText[g]
    if (!pair) { seen.path = null; seen.text = null; return }
    const [path, text] = pair
    if (seen.path === path && seen.text === text) return
    const first = seen.path !== path
    seen.path = path
    seen.text = text
    wantSymbols(groupTab(g), first && !symbolsByPath[path] ? 0 : SYMBOLS_WAIT_MS)
  })
}, { immediate: true })
if (languages && languages.servers) {
  watch(() => Object.values(languages.servers).map(s => s && s.state).join(','), () => {
    for (const g of GROUPS) wantSymbols(groupTab(g), 0)
  })
}
onBeforeUnmount(() => { for (const t of symbolTimers.values()) clearTimeout(t); symbolTimers.clear() })

function symbolsOfTab(tab) { return (tab && tab.type === 'file' && symbolsByPath[tab.path]) || null }
function crumbChain(view) {
  const s = symbolsOfTab(view.tab)
  if (!s || s.state !== 'ready') return []
  const c = cursors[view.g]
  return symbolChainAt(s.symbols, c.line, c.column)
}
// The Outline view shows the focused group's file.
const outlineFile = computed(() => (activeTab.value && activeTab.value.type === 'file' && !coverFocused.value ? activeTab.value : null))
const outlineView = computed(() => {
  const tab = outlineFile.value
  if (!tab) return { state: 'none', symbols: [] }
  return symbolsOfTab(tab) || { state: languages ? 'starting' : 'none', symbols: [] }
})
const outlineCurrentKey = computed(() => {
  const s = outlineView.value
  if (s.state !== 'ready') return ''
  const c = cursors[focusedGroup.value]
  const chain = symbolChainAt(s.symbols, c.line, c.column)
  return chain.length ? chain[chain.length - 1].key : ''
})
// A symbol from the Outline or the breadcrumbs: its name selected, in the middle of the editor.
function revealSymbol(s, g = focusedGroup.value) {
  const tab = groupTab(g)
  const ed = editors[g]
  if (!s || !tab) return
  if (mdViewOf(tab) === 'preview') tab.mdView = 'split'
  pane.value = 'editor'
  const r = s.selection || s.range
  const range = { startLineNumber: r.startLine, startColumn: r.startColumn, endLineNumber: r.endLine, endColumn: r.endColumn }
  nextTick(() => {
    try {
      ed?.setSelection?.(range)
      ed?.revealRangeInCenter?.(range)
      ed?.focus?.()
    } catch { /* the editor went away */ }
  })
}
// A folder of the breadcrumbs (or a tab's "Show in Files"): the Files view, with the folders down to it open.
async function revealInFiles(path, { file = false } = {}) {
  showSide('files')
  fileSearch.value = ''
  const parts = (path || '').split('/').filter(Boolean)
  const upto = file ? parts.length - 1 : parts.length
  for (let i = 1; i <= upto; i++) await openFolder(parts.slice(0, i).join('/'))
}

// ── AUTOSAVE (ADM-1322; the editor's settings, off unless chosen) ────────────────────────────────────────────────
// 'afterDelay': a tab with unsaved edits is saved after a pause in typing. 'onFocusChange': when its editor loses the
// focus, another tab is shown in its group, or the browser window is left. Always saveTab: the version-checked save.
const autoTimers = new Map()          // tab id → the timer of its next save
const autoSeen = new Map()            // tab id → the text that timer is for
function scheduleAutoSave(tab) {
  clearTimeout(autoTimers.get(tab.id))
  autoTimers.set(tab.id, setTimeout(() => {
    autoTimers.delete(tab.id)
    if (!openTabs.value.some(t => t.id === tab.id)) return
    if (tab.saving) scheduleAutoSave(tab)            // the last save is still going: this text is saved after it
    else saveTab(tab, { auto: 'delay' })
  }, editorSettings.autoSaveDelay))
}
function clearAutoSave() {
  for (const t of autoTimers.values()) clearTimeout(t)
  autoTimers.clear()
  autoSeen.clear()
}
watch(() => openTabs.value.map(t => (t.type === 'file' && isDirty(t) ? t.content : null)), () => {
  if (!props.editable || editorSettings.autoSave !== 'afterDelay') return
  for (const t of openTabs.value) {
    if (t.type !== 'file' || !isDirty(t) || t.autoSaveHeld || autoSeen.get(t.id) === t.content) continue
    autoSeen.set(t.id, t.content)
    scheduleAutoSave(t)
  }
})
watch(() => [editorSettings.autoSave, editorSettings.autoSaveDelay], clearAutoSave)
function autoSaveOnFocusChange(id) {
  if (!props.editable || editorSettings.autoSave !== 'onFocusChange' || id == null) return
  const tab = openTabs.value.find(t => t.id === id && t.type === 'file')
  if (tab && isDirty(tab)) saveTab(tab, { auto: 'focus' })
}
watch(() => GROUPS.map(g => groups[g].activeId), (now, before) => {
  (before || []).forEach((id, g) => { if (id !== now[g]) autoSaveOnFocusChange(id) })
})
function onWindowBlur() { for (const t of openTabs.value) autoSaveOnFocusChange(t.id) }
onMounted(() => { if (props.editable) window.addEventListener('blur', onWindowBlur) })
onBeforeUnmount(() => { window.removeEventListener('blur', onWindowBlur); clearAutoSave() })

// ── VIM KEYS (ADM-1322; the editor's settings, off unless chosen; utils/vimMode) ────────────────────────────────
// Each group's editor gets them, with its mode and ":" line in the bar under it. ":w" saves, ":q" closes the tab.
const vimBars = GROUPS.map(() => null)
const vimStops = GROUPS.map(() => null)
let vimFailed = false
function setVimBar(g, el) { vimBars[g] = el || null }
async function startVimOn(g) {
  const editor = editors[g]
  if (!props.editable || !editorSettings.vim || vimStops[g] || !editor) return
  vimStops[g] = 'starting'
  await nextTick()
  let stop
  try {
    stop = await startVim(editor, vimBars[g], {
      write: () => saveTab(groupTab(g)),
      quit: () => { const t = groupTab(g); if (t) closeTab(t.id) },
    })
  } catch (e) {
    if (vimStops[g] === 'starting') vimStops[g] = null
    if (!vimFailed) {
      vimFailed = true
      notify.error(`Vim keys could not be turned on: ${e?.message || 'they did not load'}. The editor works as before.`)
    }
    return
  }
  if (vimStops[g] !== 'starting' || editors[g] !== editor || !editorSettings.vim) {
    stop()
    if (vimStops[g] === 'starting') vimStops[g] = null
    return
  }
  vimStops[g] = stop
}
function stopVimOn(g) {
  const stop = vimStops[g]
  vimStops[g] = null
  if (typeof stop === 'function') stop()
}
watch(() => editorSettings.vim, (on) => { for (const g of GROUPS) { if (on) startVimOn(g); else stopVimOn(g) } })
onBeforeUnmount(() => { for (const g of GROUPS) stopVimOn(g) })

// ── THE COMMAND PALETTE (Ctrl+Shift+P, ADM-1322) ─────────────────────────────────────────────────────────────────
// The editor's commands that can run now; Monaco's own list stays on F1 and is one of them.
const paletteOpen = ref(false)
let paletteFrom = null
function openPalette() { paletteFrom = document.activeElement; paletteOpen.value = true }
function closePalette() {
  paletteOpen.value = false
  const back = paletteFrom
  paletteFrom = null
  nextTick(() => { if (back && document.contains(back)) back.focus?.() })
}
function runPaletteCommand(id) {
  const c = paletteCommands.value.find(x => x.id === id)
  closePalette()
  if (c) nextTick(() => c.run())                    // after the focus is back where it was
}
// One of Monaco's own actions, on the focused group's editor.
function editorAction(id) {
  const ed = editorInst
  if (!ed) return
  try {
    ed.focus?.()
    ed.getAction?.(id)?.run()
  } catch { /* the editor went away */ }
}
// The Terminal's own shortcut (BottomPanel, ADM-1325): the command does exactly what Ctrl+` does.
function terminalKey(newShell) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: newShell ? '~' : '`', code: 'Backquote', ctrlKey: true,
    shiftKey: newShell, bubbles: true, cancelable: true }))
}
const paletteCommands = computed(() => {
  const tab = activeTab.value && !coverFocused.value ? activeTab.value : null
  const file = tab && tab.type === 'file' ? tab : null
  const dirty = openTabs.value.filter(isDirty)
  const md = isMarkdownTab(file)
  const s = editorSettings
  const act = (id, group, label, keys, icon, action) => ({ id, group, label, keys, icon, run: () => editorAction(action) })
  return [
    { id: 'go-to-file', group: 'File', label: 'Go to file', keys: 'Ctrl+P', icon: 'lucide:file-search', run: openQuickOpen },
    file && isDirty(file) && { id: 'save', group: 'File', label: 'Save', keys: 'Ctrl+S', icon: 'lucide:save', run: () => saveTab(file) },
    dirty.length > 0 && { id: 'save-all', group: 'File', label: `Save all (${dirty.length})`, icon: 'lucide:save-all', run: saveAll },
    { id: 'new-file', group: 'File', label: 'New file', icon: 'lucide:file-plus', run: () => startNew('file', '') },
    { id: 'new-folder', group: 'File', label: 'New folder', icon: 'lucide:folder-plus', run: () => startNew('directory', '') },
    { id: 'upload', group: 'File', label: 'Upload files', icon: 'lucide:upload', run: () => pickUpload('') },
    { id: 'download', group: 'File', label: 'Download the project (.tar.gz)', icon: 'lucide:download', run: () => downloadEntry(null) },
    file && act('format', 'Editor', 'Format document', 'Shift+Alt+F', 'lucide:wand-sparkles', 'editor.action.formatDocument'),
    file && act('rename', 'Editor', 'Rename symbol', 'F2', 'lucide:pencil-line', 'editor.action.rename'),
    file && act('quick-fix', 'Editor', 'Quick fix', 'Ctrl+.', 'lucide:lightbulb', 'editor.action.quickFix'),
    file && act('find', 'Editor', 'Find', 'Ctrl+F', 'lucide:search', 'actions.find'),
    file && act('replace', 'Editor', 'Replace', 'Ctrl+H', 'lucide:replace', 'editor.action.startFindReplaceAction'),
    file && act('go-to-line', 'Editor', 'Go to line', 'Ctrl+G', 'lucide:arrow-down-to-line', 'editor.action.gotoLine'),
    file && act('go-to-symbol', 'Editor', 'Go to symbol in file', 'Ctrl+Shift+O', 'lucide:at-sign', 'editor.action.quickOutline'),
    file && act('all-editor-commands', 'Editor', "Show all of the text editor's commands", 'F1', 'lucide:command', 'editor.action.quickCommand'),
    file && act('ask-agent', 'Coding Agent', 'Ask the Coding Agent about this', 'Ctrl+L', 'lucide:sparkles', 'lets-code.ask-coding-agent'),
    file && debuggerStore && act('toggle-breakpoint', 'Debug', 'Toggle breakpoint', 'F9', 'lucide:circle-dot', 'lets-code.toggle-breakpoint'),
    file && { id: 'blame', group: 'Source control', label: blameOn.value ? 'Hide who changed each line' : 'Show who changed each line',
      icon: 'lucide:user-round-search', run: toggleBlame },
    md && { id: 'md-preview', group: 'Markdown', label: file.mdView === 'preview' ? 'Show the text' : 'Show the preview',
      icon: 'lucide:eye', run: () => setMdView(file, 'preview') },
    md && !narrow.value && { id: 'md-side', group: 'Markdown',
      label: file.mdView === 'split' ? 'Close the preview beside the text' : 'Preview beside the text', icon: 'lucide:columns-2',
      run: () => setMdView(file, 'split') },
    { id: 'search', group: 'View', label: 'Search in files', keys: 'Ctrl+Shift+F', icon: 'lucide:search', run: openSearch },
    { id: 'files', group: 'View', label: 'Show the files', icon: 'lucide:folder', run: () => showSide('files') },
    { id: 'outline', group: 'View', label: 'Show the outline', icon: 'lucide:list-tree', run: () => showSide('outline') },
    { id: 'scm', group: 'View', label: 'Show source control', icon: 'lucide:git-branch', run: () => showSide('scm') },
    debuggerStore && { id: 'debug', group: 'View', label: 'Show run and debug', icon: 'lucide:bug-play', run: () => showSide('debug') },
    { id: 'terminal', group: 'View', label: 'Toggle the terminal', keys: 'Ctrl+`', icon: 'lucide:square-terminal', run: () => terminalKey(false) },
    { id: 'new-terminal', group: 'View', label: 'New terminal', keys: 'Ctrl+Shift+`', icon: 'lucide:square-plus', run: () => terminalKey(true) },
    canOpenToSide(tab) && { id: 'split', group: 'View',
      label: split.value ? 'Move the tab to the other editor group' : 'Open to the side', keys: 'Ctrl+\\', icon: 'lucide:columns-2',
      run: () => moveToOtherGroup(tab) },
    split.value && { id: 'other-group', group: 'View', label: 'Go to the other editor group', icon: 'lucide:panel-right',
      run: () => focusGroup(1 - focusedGroup.value, { show: true }) },
    split.value && { id: 'close-group', group: 'View', label: 'Close the second editor group', icon: 'lucide:square-x', run: () => closeGroup(1) },
    tab && { id: 'pin', group: 'Tab', label: tab.pinned ? 'Unpin the tab' : 'Pin the tab', icon: tab.pinned ? 'lucide:pin-off' : 'lucide:pin',
      run: () => togglePin(tab) },
    tab && { id: 'close-tab', group: 'Tab', label: 'Close the tab', icon: 'lucide:x', run: () => closeTab(tab.id) },
    tab && othersToClose(openTabs.value, tab.id).length > 0 && { id: 'close-others', group: 'Tab', label: 'Close the other tabs',
      icon: 'lucide:copy-x', run: () => closeTabs(othersToClose(openTabs.value, tab.id)) },
    { id: 'settings', group: 'Preferences', label: 'Editor settings', icon: 'lucide:settings-2', run: () => openSettings() },
    { id: 'wrap', group: 'Preferences', label: s.wordWrap ? 'Turn word wrap off' : 'Turn word wrap on', icon: 'lucide:wrap-text',
      run: () => { s.wordWrap = !s.wordWrap } },
    { id: 'minimap', group: 'Preferences', label: s.minimap ? 'Hide the minimap' : 'Show the minimap', icon: 'lucide:map',
      run: () => { s.minimap = !s.minimap } },
    { id: 'autosave', group: 'Preferences', label: s.autoSave === 'off' ? 'Turn autosave on (after a pause in typing)' : 'Turn autosave off',
      icon: 'lucide:timer', run: () => { s.autoSave = s.autoSave === 'off' ? 'afterDelay' : 'off' } },
    { id: 'vim', group: 'Preferences', label: s.vim ? 'Turn vim keys off' : 'Turn vim keys on', icon: 'lucide:keyboard',
      run: () => { s.vim = !s.vim } },
  ].filter(Boolean)
})

// Tree node component with directory support (real per-extension icons via @iconify).
// The name box for New file / New folder / Rename (see `pending`).
const PendingRow = {
  props: ['level'],
  setup(rowProps) {
    return () => {
      const p = pending.value
      if (!p) return null
      return h('div', {
        class: 'tree-node pending-row',
        style: p.mode === 'rename' ? {} : { paddingLeft: `${10 + (rowProps.level || 0) * 12}px` },
      }, [
        p.mode === 'rename' ? null : h('span', { class: 'node-expand', 'aria-hidden': 'true' }),
        p.mode === 'rename' ? null : h(Icon, { class: 'node-iconify', icon: p.mode === 'directory' ? 'lucide:folder' : 'lucide:file', style: { color: 'var(--vm-ink-faint)' } }),
        h('div', { class: 'pending-box' }, [
          h('input', {
            class: ['pending-input', { invalid: !!p.error }],
            value: p.value,
            disabled: p.busy,
            'aria-label': p.mode === 'rename' ? `New name for ${p.node.name}` : (p.mode === 'directory' ? 'Folder name' : 'File name'),
            'aria-invalid': p.error ? 'true' : 'false',
            spellcheck: false,
            onInput: (e) => { p.value = e.target.value; p.error = '' },
            onKeydown: (e) => {
              e.stopPropagation()
              if (e.key === 'Enter') { e.preventDefault(); commitPending() }
              else if (e.key === 'Escape') { e.preventDefault(); cancelPending() }
            },
            onBlur: () => commitPending({ fromBlur: true }),
            onClick: (e) => e.stopPropagation(),
            onVnodeMounted: ({ el }) => {
              el.focus()
              const dot = p.mode === 'rename' && p.node.type !== 'directory' ? p.value.lastIndexOf('.') : -1
              el.setSelectionRange(0, dot > 0 ? dot : p.value.length)
            },
          }),
          p.error ? h('p', { class: 'pending-error', role: 'alert' }, p.error) : null,
        ]),
      ])
    }
  },
}

// The editor's own `editable` (inside the node, `props` is the node's: file, level).
const canEdit = () => props.editable

const FileTreeNode = {
  props: ['file', 'level'],
  emits: ['select'],
  setup(props, { emit }) {
    const handleClick = () => {
      if (props.file.type === 'directory') {
        expandDir(props.file)            // lazy: fetch this level's children on first open
      } else {
        emit('select', props.file.path)
      }
    }
    // A closed folder the pointer (or keyboard focus) rests on for a moment is read before the click (ADM-1196).
    let hoverTimer = null
    const warm = () => {
      if (props.file.type !== 'directory' || props.file.expanded || props.file.loaded) return
      clearTimeout(hoverTimer)
      hoverTimer = setTimeout(() => prefetchDir(props.file.path), 120)
    }
    const cool = () => { clearTimeout(hoverTimer); hoverTimer = null }
    onBeforeUnmount(cool)

    const isDir = () => props.file.type === 'directory'
    // Where a drop on this row goes: into the folder itself, or into the folder a file is in.
    const dropDir = () => (isDir() ? props.file.path : dirOf(props.file.path))
    const renaming = () => pending.value?.mode === 'rename' && pending.value.node?.path === props.file.path
    const newHere = () => isDir() && props.file.expanded && pending.value && pending.value.mode !== 'rename'
      && pending.value.parent === props.file.path

    const renderChildren = () => {
      if (props.file.type === 'directory' && props.file.expanded && props.file.children) {
        return [
          newHere() ? h(PendingRow, { key: '__pending__', level: (props.level || 0) + 1 }) : null,
          ...props.file.children.map(child =>
            h(FileTreeNode, {
              key: child.path,
              file: child,
              level: (props.level || 0) + 1,
              onSelect: (path) => emit('select', path)
            })
          ),
        ]
      }
      return []
    }

    const onKey = (e) => {
      if (e.target !== e.currentTarget) return                       // the row's own button, or its name box
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick() }
      else if (!canEdit()) return
      else if (e.key === 'F2') { e.preventDefault(); startRename(props.file) }
      else if (e.key === 'Delete') { e.preventDefault(); deleteEntry(props.file) }
      else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); openMenuFor(e.currentTarget, props.file) }
    }

    return () => h('div', {}, [
      h('div', {
        class: ['tree-node', {
          'drop-target': isDir() && dropTarget.value === props.file.path,
          dragging: dragPath.value === props.file.path,
        }],
        style: { paddingLeft: `${10 + (props.level || 0) * 12}px` },
        role: 'treeitem',
        tabindex: 0,
        'aria-expanded': props.file.type === 'directory' ? String(!!props.file.expanded) : undefined,
        draggable: canEdit() && !renaming() ? 'true' : undefined,
        onClick: renaming() ? undefined : handleClick,
        onMouseenter: warm,
        onMouseleave: cool,
        onFocus: warm,
        onBlur: cool,
        onKeydown: onKey,
        onContextmenu: (e) => { if (!canEdit()) return; e.preventDefault(); e.stopPropagation(); openMenuAt(e.clientX, e.clientY, props.file) },
        onDragstart: (e) => onDragStart(e, props.file),
        onDragend: onDragEnd,
        onDragover: (e) => onDragOver(e, dropDir(), props.file),
        onDrop: (e) => onDrop(e, dropDir()),
      }, [
        props.file.type === 'directory'
          ? h('span', { class: 'node-expand', 'aria-hidden': 'true' }, [
              h(Icon, {
                icon: props.file.loading ? 'lucide:loader-2' : (props.file.expanded ? 'lucide:chevron-down' : 'lucide:chevron-right'),
                class: props.file.loading ? 'node-spin' : '',
              }),
            ])
          : h('span', { class: 'node-expand', 'aria-hidden': 'true' }),
        h(Icon, {
          class: 'node-iconify',
          icon: iconFor(props.file),
          style: iconColor(props.file) ? { color: iconColor(props.file) } : {},
        }),
        renaming() ? h(PendingRow, { level: props.level || 0 }) : h('span', { class: 'node-name' }, props.file.name),
        !renaming() && props.file.gitignored
          ? h('span', { class: 'node-gi', title: 'Gitignored: kept in your workspace only, never committed' }, 'local-only')
          : null,
        canEdit() && !renaming()
          ? h('button', {
              type: 'button',
              class: 'node-more',
              'aria-label': `Actions for ${props.file.name}`,
              title: 'More actions',
              tabindex: -1,
              onClick: (e) => { e.stopPropagation(); openMenuFor(e.currentTarget, props.file) },
            }, [h(Icon, { icon: 'lucide:more-horizontal', 'aria-hidden': 'true' })])
          : null,
      ]),
      ...renderChildren()
    ])
  }
}

</script>

<style scoped>
.code-browser {
  --cb-on-solid: white;   /* text on the solid primary Save button: the same in both themes */
  display: flex;
  height: 100%;
  min-width: 0;
  background: var(--vm-surface);
  color: var(--vm-ink-soft);
  font-family: var(--vm-font-sans);
}

/* Sidebar */
/* `cb-sidebar`, not `sidebar`: the app's theme layer paints `:root[data-theme=dark] .sidebar` (its navigation) dark,
   which reached this panel when the editor's own theme is light (ADM-1205). */
.cb-sidebar {
  position: relative;
  max-width: 45%;
  flex: 0 0 auto;
  border-right: 1px solid var(--vm-line);
  display: flex;
  flex-direction: column;
  background: var(--vm-surface-soft);
  min-width: 0;
}

.sidebar-header {
  border-bottom: 1px solid var(--vm-line);
}

.sidebar-tabs {
  display: flex;
}

.sidebar-tab {
  flex: 1;
  min-width: 0;
  padding: 10px 8px 8px;
  background: transparent;
  color: var(--vm-ink-soft);
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font: 600 12.5px var(--vm-font-sans);
  white-space: nowrap;
  overflow: hidden;
  transition: color .15s, background-color .15s, border-color .15s;
}
.sidebar-tab :deep(svg) { width: 15px; height: 15px; flex: 0 0 auto; }

.sidebar-tab:hover {
  color: var(--vm-ink);
  background: color-mix(in srgb, var(--vm-ink) 4%, transparent);
}

.sidebar-tab.active {
  color: var(--vm-ink);
  border-bottom-color: var(--vm-violet);
}
/* The count never shrinks: in a narrow sidebar the label gives way (ellipsis), never a digit of the count ("23"
   showed as "2", 2026-11-10). */
.sidebar-tab-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.scm-tabcount {
  flex: 0 0 auto;
  margin-left: 2px; background: var(--vm-violet); color: var(--cb-on-solid); font-size: 10px; font-weight: 700;
  border-radius: 8px; padding: 0 5px; line-height: 16px; min-width: 16px; text-align: center;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
}
.scm-pane { height: 100%; min-height: 0; }

.search-box {
  padding: 8px;
  border-bottom: 1px solid var(--vm-line);
}

.search-input {
  width: 100%;
  padding: 6px 10px;
  background: var(--vm-surface);
  border: 1px solid var(--vm-line-2);
  border-radius: 6px;
  color: var(--vm-ink);
  font-size: 13px;
}
.search-input::placeholder { color: var(--vm-ink-faint); }

/* The Files tab's bar: find by name, then New file / New folder / Upload (ADM-1205). */
.explorer-bar { display: flex; align-items: center; gap: 2px; }
.explorer-bar .search-input { flex: 1 1 auto; min-width: 0; margin-right: 4px; }
.xbar-btn {
  flex: 0 0 auto;
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px;
  border: 0; border-radius: 6px;
  background: transparent; color: var(--vm-ink-soft);
  cursor: pointer;
  transition: background-color .15s, color .15s;
}
.xbar-btn :deep(svg) { width: 16px; height: 16px; }
.xbar-btn:hover { background: color-mix(in srgb, var(--vm-ink) 6%, transparent); color: var(--vm-ink); }
.xbar-btn:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.xbar-file { display: none; }
.xbar-status { margin: 0; padding: 6px 10px; font-size: 12px; color: var(--vm-ink-soft); border-bottom: 1px solid var(--vm-line); }
.tree-list.drop-root { box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--vm-violet) 55%, transparent); border-radius: 4px; }
.file-tree { display: flex; flex-direction: column; min-height: 100%; }
.file-tree .tree-list { flex: 1 1 auto; }
.search-pane { height: 100%; min-height: 0; }
@media (pointer: coarse) { .xbar-btn { width: 40px; height: 40px; } }

.search-input:focus {
  outline: none;
  border-color: var(--vm-focus);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--vm-focus) 20%, transparent);
}

.tree-list {
  padding: 4px 0;
}

.node-type {
  font-size: 11px;
  color: var(--vm-ink-soft);
  background: var(--vm-surface);
  border: 1px solid var(--vm-line);
  padding: 1px 6px;
  border-radius: 4px;
}

.loading, .empty {
  padding: 20px;
  text-align: center;
  color: var(--vm-ink-faint);
  font-size: 13px;
  line-height: 1.45;
}

.tree-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 24px 16px;
  text-align: center;
}
.tree-error-ic { width: 22px; height: 22px; color: var(--vm-ink-faint); }
.tree-error-t { margin: 0; font-size: 13px; line-height: 1.5; color: var(--vm-ink-soft); max-width: 32ch; }
.tree-error-retry {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid var(--vm-line);
  border-radius: 6px;
  background: var(--vm-surface);
  color: var(--vm-ink);
  font-size: 13px;
  cursor: pointer;
  transition: background-color 150ms ease, border-color 150ms ease;
}
.tree-error-retry:hover:not(:disabled) { border-color: var(--vm-ink-faint); }
.tree-error-help { font-size: 12.5px; font-weight: 600; color: var(--vm-violet-d); text-decoration: underline; text-underline-offset: 3px; }
.tree-error-help:hover { color: var(--vm-violet); }
.tree-error-help:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; border-radius: 4px; }
.tree-error-retry:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; }
.tree-error-retry:disabled { opacity: 0.6; cursor: default; }
.tree-error-retry :deep(svg) { width: 14px; height: 14px; }

/* Resize Handle */
.resize-handle {
  position: absolute;
  right: -2px;
  top: 0;
  bottom: 0;
  width: 5px;
  cursor: ew-resize;
  background: transparent;
  z-index: 2;
  transition: background-color .15s;
}

.resize-handle:hover {
  background: var(--vm-violet);
}

/* Editor Panel */
.editor-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* The two editor groups (ADM-1322): side by side, each its own tab row, breadcrumbs and editor. The focused one's
   top edge is coloured, as VS Code marks the active group. A narrow screen shows one at a time. */
.editor-groups { flex: 1 1 auto; min-height: 0; display: flex; }
.editor-group { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; overflow: hidden; position: relative; }
.editor-groups.split .editor-group + .editor-group { border-left: 1px solid var(--vm-line); }
.editor-groups.split .editor-group.focused::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: var(--vm-violet); z-index: 3; pointer-events: none;
}
.editor-group.group-hidden { display: none; }

.tab-bar {
  flex: 0 0 auto;
  display: flex;
  background: var(--vm-surface-soft);
  border-bottom: 1px solid var(--vm-line);
  overflow-x: auto;
  overflow-y: hidden;
}

.tab {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 8px 7px 12px;
  background: transparent;
  color: var(--vm-ink-soft);
  border-right: 1px solid var(--vm-line);
  border-bottom: 2px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  font-size: 13px;
  transition: color .15s, background-color .15s;
}

.tab:hover {
  color: var(--vm-ink);
  background: var(--vm-surface);
}

.tab.active {
  background: var(--vm-surface);
  color: var(--vm-ink);
  border-bottom-color: var(--vm-violet);
}

.tab-icon {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
}

.tab-name {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--vm-amber); flex: 0 0 auto; }
.tab:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: -2px; }
/* Pinned tabs (ADM-1322): first in the row, a pin where the close button is; dragging shows where a tab will land. */
.tab-pin { color: var(--vm-ink-soft); }
.tab-pin :deep(svg) { transform: rotate(45deg); }
.tab.dragging { opacity: .5; }
.tab-bar { touch-action: manipulation; }
/* The tablist wraps the tabs only; it takes no box of its own, so the bar lays them out as before. */
.tab-list { display: contents; }
.tab-bar .tab { user-select: none; }
.tab.tab-drop-before { box-shadow: inset 2px 0 0 var(--vm-violet); }
.tab-bar.tab-drop-end { box-shadow: inset -2px 0 0 var(--vm-violet); }
.editor-container.tab-drop-side::after {
  content: ''; position: absolute; inset: 0; z-index: 4; pointer-events: none;
  background: color-mix(in srgb, var(--vm-violet) 12%, transparent); box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--vm-violet) 55%, transparent);
}
.drop-hint {
  position: absolute; top: 12px; left: 50%; transform: translateX(-50%); z-index: 5; margin: 0; padding: 4px 10px;
  border-radius: 6px; background: var(--vm-surface); color: var(--vm-ink); font: 600 12px var(--vm-font-sans);
  box-shadow: var(--vm-shadow-l); pointer-events: none;
}
/* A file's text, and a markdown file's preview beside it or in its place (ADM-1322). */
.text-view { position: absolute; inset: 0; display: flex; min-width: 0; }
.text-view > .monaco-editor { flex: 1 1 0; min-width: 0; }
.text-view.mdv-split > .md-preview { flex: 1 1 0; border-left: 1px solid var(--vm-line); }
.text-view.mdv-preview > .md-preview { flex: 1 1 auto; }
.md-preview {
  min-width: 0; overflow: auto; padding: 20px 28px; background: var(--vm-surface); color: var(--vm-ink);
  font: 14px/1.6 var(--vm-font-sans); overflow-wrap: anywhere;
}
.md-preview:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: -2px; }
.md-preview :deep(h1), .md-preview :deep(h2), .md-preview :deep(h3) { margin: 1.2em 0 .5em; line-height: 1.3; color: var(--vm-ink); text-wrap: balance; }
.md-preview :deep(h1) { font-size: 1.6em; padding-bottom: .3em; border-bottom: 1px solid var(--vm-line); }
.md-preview :deep(h2) { font-size: 1.3em; padding-bottom: .2em; border-bottom: 1px solid var(--vm-line); }
.md-preview :deep(h1:first-child), .md-preview :deep(h2:first-child) { margin-top: 0; }
.md-preview :deep(p), .md-preview :deep(ul), .md-preview :deep(ol), .md-preview :deep(blockquote) { margin: 0 0 1em; max-width: 80ch; }
.md-preview :deep(a) { color: var(--vm-link); text-decoration: underline; text-underline-offset: 2px; }
.md-preview :deep(code) { font: .9em var(--vm-font-mono); padding: .1em .35em; border-radius: 4px; background: var(--vm-surface-soft); }
.md-preview :deep(pre) { margin: 0 0 1em; padding: 12px 14px; border-radius: 6px; background: var(--vm-surface-soft); overflow: auto; }
.md-preview :deep(pre code) { padding: 0; background: none; }
.md-preview :deep(blockquote) { padding-left: 12px; border-left: 3px solid var(--vm-line-2); color: var(--vm-ink-soft); }
.md-preview :deep(img) { max-width: 100%; height: auto; }
.md-preview :deep(.md-table) { overflow-x: auto; margin: 0 0 1em; }
.md-preview :deep(table) { border-collapse: collapse; }
.md-preview :deep(th), .md-preview :deep(td) { padding: 4px 10px; border: 1px solid var(--vm-line); text-align: left; }
/* Vim keys (ADM-1322): the mode and the ":" command line, under the editor. */
.vim-bar {
  flex: 0 0 auto; min-height: 24px; display: flex; align-items: center; gap: 8px; padding: 0 10px; border-top: 1px solid var(--vm-line);
  background: var(--vm-surface-soft); color: var(--vm-ink-soft); font: 12px var(--vm-font-mono);
}
.vim-bar :deep(input) { flex: 1 1 auto; min-width: 0; border: 0; outline: none; background: transparent; color: var(--vm-ink); font: inherit; }
/* The Coding Agent's chat tabs (ADM-1221): a file tab with the agent's mark and a dot for what the chat is doing. */
.chat-tab-icon { color: var(--vm-violet); }
.chat-dot { width: 7px; height: 7px; border-radius: 50%; flex: 0 0 auto; background: var(--vm-line-2); }
.chat-dot.working { background: var(--vm-violet); animation: cbchatpulse 1.4s ease-in-out infinite; }
.chat-dot.needs_input { background: var(--vm-amber); }
.chat-dot.done { background: var(--vm-green); }
.chat-dot.failed { background: var(--vm-danger); }
@keyframes cbchatpulse { 50% { opacity: .35; } }
@media (prefers-reduced-motion: reduce) { .chat-dot.working { animation: none; } }
.tab-new-chat {
  flex: 0 0 auto; align-self: center; display: grid; place-items: center; width: 28px; height: 28px; margin: 0 4px;
  border: 0; border-radius: 6px; background: transparent; color: var(--vm-ink-soft); cursor: pointer;
  transition: background-color .15s, color .15s;
}
.tab-new-chat :deep(svg) { width: 15px; height: 15px; }
.tab-new-chat:hover { background: color-mix(in srgb, var(--vm-ink) 7%, transparent); color: var(--vm-ink); }
.tab-new-chat:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.chat-host { position: absolute; inset: 0; display: flex; flex-direction: column; min-height: 0; }
.chat-host > * { flex: 1; min-height: 0; }
.tab-actions { margin-left: auto; display: flex; align-items: center; padding: 0 8px; }
.tab-gear, .tab-tool {
  display: grid; place-items: center; width: 30px; height: 30px; margin-right: 6px; border: 0; border-radius: 6px;
  background: transparent; color: var(--vm-ink-soft); cursor: pointer; transition: background-color .15s, color .15s;
}
.tab-gear :deep(svg), .tab-tool :deep(svg) { width: 16px; height: 16px; }
.tab-gear:hover, .tab-tool:hover { background: color-mix(in srgb, var(--vm-ink) 7%, transparent); color: var(--vm-ink); }
.tab-gear:focus-visible, .tab-tool:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.tab-tool.on { color: var(--vm-violet-ink); background: var(--vm-violet-soft); }
.code-browser.narrow .tab-tool { width: 44px; height: 44px; }
/* A diff tab's changes, each staged or unstaged on its own (ADM-1321). */
.diff-wrap { display: flex; flex-direction: column; width: 100%; height: 100%; min-height: 0; }
.diff-wrap .monaco-editor { flex: 1 1 auto; min-height: 0; height: auto; }
.hunk-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 6px 10px; border-bottom: 1px solid var(--vm-line); background: var(--vm-surface-soft); font: 12px var(--vm-font-sans); color: var(--vm-ink-soft); max-height: 30%; overflow: auto; }
.hunk-side { font-weight: 600; color: var(--vm-ink-soft); }
.hunk { display: inline-flex; align-items: center; border: 1px solid var(--vm-line-2); border-radius: 7px; background: var(--vm-surface); overflow: hidden; }
.hunk-go, .hunk-act { border: 0; background: transparent; color: var(--vm-ink); cursor: pointer; font: 12px var(--vm-font-mono); min-height: 26px; transition: background-color .15s, color .15s; }
.hunk-go { padding: 0 8px; }
.hunk-act { display: grid; place-items: center; width: 26px; border-left: 1px solid var(--vm-line-2); color: var(--vm-ink-soft); }
.hunk-go:hover, .hunk-act:hover:not(:disabled) { background: var(--vm-surface-soft); color: var(--vm-ink); }
.hunk-act:disabled { opacity: .5; cursor: progress; }
.hunk-go:focus-visible, .hunk-act:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: -2px; }
.hunk-act :deep(svg) { width: 13px; height: 13px; }
.hunk-note { font-size: 11.5px; color: var(--vm-ink-faint); }
@media (max-width: 640px) { .hunk-go, .hunk-act { min-height: 44px; } .hunk-act { width: 44px; } }
.save-btn { background: var(--vm-violet); color: var(--cb-on-solid); border: none; border-radius: 6px; padding: 5px 12px; font: 600 12.5px var(--vm-font-sans); cursor: pointer; transition: background-color .15s, opacity .15s; }
.save-btn:hover:not(:disabled) { background: var(--vm-violet-d); }
.save-btn:disabled { opacity: .45; cursor: not-allowed; }
.tab-close {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  background: none;
  border: none;
  border-radius: 4px;
  color: var(--vm-ink-faint);
  cursor: pointer;
  transition: color .15s, background-color .15s;
}
.tab-close :deep(svg) { width: 14px; height: 14px; }

.tab-close:hover {
  color: var(--vm-ink);
  background: var(--vm-surface-soft);
}

.editor-container {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.monaco-editor {
  width: 100%;
  height: 100%;
}

/* A picture tab: the picture centred on a checkerboard (transparency reads), never scaled above its own size. */
.image-view { position: absolute; inset: 0; display: flex; flex-direction: column; }
.image-stage {
  flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; padding: 24px; overflow: auto;
  background-color: var(--vm-surface-soft);
  background-image:
    linear-gradient(45deg, color-mix(in srgb, var(--vm-ink) 6%, transparent) 25%, transparent 25%),
    linear-gradient(-45deg, color-mix(in srgb, var(--vm-ink) 6%, transparent) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, color-mix(in srgb, var(--vm-ink) 6%, transparent) 75%),
    linear-gradient(-45deg, transparent 75%, color-mix(in srgb, var(--vm-ink) 6%, transparent) 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
}
.image-img { max-width: 100%; max-height: 100%; object-fit: contain; image-rendering: auto; }
.image-meta {
  display: flex; align-items: center; gap: 16px; padding: 8px 16px; border-top: 1px solid var(--vm-line);
  font: 500 12px var(--vm-font-sans); color: var(--vm-ink-soft); font-variant-numeric: tabular-nums;
}
.image-code-btn {
  margin-left: auto; display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 12px;
  border: 1px solid var(--vm-line); border-radius: 6px; background: transparent; color: var(--vm-ink);
  font: 600 12px var(--vm-font-sans); cursor: pointer; transition: background-color .15s;
}
.image-code-btn:hover { background: color-mix(in srgb, var(--vm-ink) 5%, transparent); }
.image-code-btn:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 2px; }
.image-code-btn :deep(svg) { width: 14px; height: 14px; }

.empty-editor {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 100%;
  padding: 24px;
  text-align: center;
  color: var(--vm-ink-faint);
}
.empty-editor-ic { width: 40px; height: 40px; margin-bottom: 10px; color: var(--vm-ink-faint); }
.empty-editor-t { margin: 0; font: 600 14px var(--vm-font-sans); color: var(--vm-ink-soft); }
.empty-editor-s { margin: 0; font-size: 13px; color: var(--vm-ink-faint); }

/* Scrollbar styling */
.sidebar-content::-webkit-scrollbar,
.tab-bar::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.sidebar-content::-webkit-scrollbar-track,
.tab-bar::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-content::-webkit-scrollbar-thumb,
.tab-bar::-webkit-scrollbar-thumb {
  background: var(--vm-line-2);
  border-radius: 5px;
}

.sidebar-content::-webkit-scrollbar-thumb:hover,
.tab-bar::-webkit-scrollbar-thumb:hover {
  background: var(--vm-ink-faint);
}

@media (max-width: 640px) {
  .sidebar-tab { min-height: 44px; font-size: 12px; }
  /* One pane at a time (ADM-1128): the tab row on top, then the editor or one sidebar view, the full width. */
  .code-browser.narrow { flex-direction: column; }
  .code-browser.narrow .cb-sidebar { width: 100%; max-width: none; border-right: 0; flex: 0 0 auto; }
  .code-browser.narrow.pane-side .cb-sidebar { flex: 1 1 auto; min-height: 0; }
  .code-browser.narrow.pane-editor .sidebar-content,
  .code-browser.narrow .resize-handle,
  .code-browser.narrow.pane-side .editor-panel { display: none; }
  .code-browser.narrow .sidebar-tab { justify-content: center; }
  .code-browser.narrow .sidebar-tab-label {   /* icons only; the name stays for screen readers and in the title */
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0);
    white-space: nowrap; border: 0;
  }
  .tab { min-height: 44px; }
  .tab-close { width: 36px; height: 36px; }
  .code-browser.narrow .tab-gear { width: 44px; height: 44px; }
  /* A markdown preview beside its text: under it, on a narrow screen (no sideways scroll). */
  .text-view.mdv-split { flex-direction: column; }
  .text-view.mdv-split > .md-preview { border-left: 0; border-top: 1px solid var(--vm-line); padding: 16px; }
  .vim-bar { min-height: 32px; }
  .save-btn { min-height: 36px; }
}
</style>

<!-- NON-scoped: the file-tree nodes are rendered by a child component (FileTreeNode), so scoped
     rules don't reach them. Selector-scoped under .code-browser to avoid leaking app-wide. -->
<style>
.code-browser .tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  font-size: 13px;
  line-height: 1.3;
  cursor: pointer;
  white-space: nowrap;
  color: var(--vm-ink-soft);
  transition: background-color .1s;
}
.code-browser .tree-node:hover { background: color-mix(in srgb, var(--vm-ink) 5%, transparent); }
.code-browser .tree-node:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: -2px; border-radius: 4px; }
.code-browser .node-iconify { width: 16px; height: 16px; flex: 0 0 auto; }
.code-browser .node-expand { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 14px; color: var(--vm-ink-faint); }
.code-browser .node-expand svg { width: 13px; height: 13px; }
.code-browser .node-spin { animation: cb-node-spin 1s linear infinite; }
@keyframes cb-node-spin { to { transform: rotate(360deg); } }
.code-browser .node-name { flex: 1 1 auto; min-width: min(4ch, 100%); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--vm-ink); }
/* In a narrow panel the badge gives way first: the name stays readable (375 px, 2026-11-11). */
.code-browser .node-gi { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; margin-left: 6px; font: 600 10px var(--vm-font-sans); color: var(--vm-ink-soft); background: color-mix(in srgb, var(--vm-ink-faint) 16%, transparent); border-radius: 4px; padding: 1px 5px; }
.code-browser .node-path { flex: 0 1 auto; min-width: 0; margin-left: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; color: var(--vm-ink-faint); }
.code-browser .search-hit .node-name { flex: 0 0 auto; }
/* The explorer's file actions (ADM-1205): the row's More button, drag and drop, the name box. */
.code-browser .node-more {
  flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; margin-left: auto; padding: 0;
  border: 0; border-radius: 4px; background: transparent; color: var(--vm-ink-faint); cursor: pointer;
  opacity: 0; transition: opacity .12s, background-color .12s;
}
.code-browser .node-more svg { width: 15px; height: 15px; }
.code-browser .tree-node:hover .node-more, .code-browser .tree-node:focus-within .node-more { opacity: 1; }
.code-browser .node-more:hover { background: color-mix(in srgb, var(--vm-ink) 8%, transparent); color: var(--vm-ink); }
.code-browser .tree-node.drop-target {
  background: color-mix(in srgb, var(--vm-violet) 14%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--vm-violet) 55%, transparent);
  border-radius: 4px;
}
.code-browser .tree-node.dragging { opacity: .5; }
.code-browser .pending-row { cursor: default; align-items: flex-start; }
.code-browser .pending-row:hover { background: transparent; }
.code-browser .pending-box { flex: 1 1 auto; min-width: 0; }
.code-browser .pending-input {
  width: 100%; padding: 2px 6px; font: 13px var(--vm-font-sans);
  color: var(--vm-ink); background: var(--vm-surface);
  border: 1px solid var(--vm-focus); border-radius: 4px; outline: none;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--vm-focus) 22%, transparent);
}
.code-browser .pending-input.invalid { border-color: var(--vm-danger); box-shadow: 0 0 0 2px color-mix(in srgb, var(--vm-danger) 22%, transparent); }
.code-browser .pending-error {
  margin: 4px 0 2px; padding: 4px 6px; font-size: 12px; line-height: 1.4; white-space: normal;
  color: var(--vm-red-ink); background: var(--vm-red-soft); border-radius: 4px;
}
@media (max-width: 640px) { .code-browser .tree-node { min-height: 40px; } }
@media (hover: none), (pointer: coarse) { .code-browser .node-more { opacity: 1; width: 32px; height: 36px; } }
@media (prefers-reduced-motion: reduce) { .code-browser .node-spin { animation: none; } }
/* The debugger's marks in the editor (ADM-1205 phase F item 17), as VS Code's: a red dot per breakpoint, a ringed dot
   for a conditional one, a diamond for a logpoint, a hollow one the debugger could not set; the paused line in amber. */
.code-browser .lc-bp, .code-browser .lc-bp-cond, .code-browser .lc-bp-log, .code-browser .lc-paused-arrow { cursor: pointer; }
.code-browser .lc-bp::before, .code-browser .lc-bp-cond::before, .code-browser .lc-bp-log::before {
  content: ''; position: absolute; left: 50%; top: 50%; width: 10px; height: 10px; margin: -5px 0 0 -5px;
  border-radius: 50%; background: #e51400; box-sizing: border-box;
}
.code-browser .lc-bp-cond::before { border: 2px solid #e51400; background: #fff; }
.code-browser .lc-bp-log::before { border-radius: 2px; transform: rotate(45deg); width: 9px; height: 9px; margin: -4.5px 0 0 -4.5px; }
.code-browser .lc-bp-unverified::before { background: transparent; border: 1.5px solid #8a8a8a; }
.code-browser .lc-paused-line { background: color-mix(in srgb, #ffcc00 22%, transparent); }
.code-browser .lc-paused-arrow::after {
  content: ''; position: absolute; left: 50%; top: 50%; margin: -6px 0 0 -4px;
  border-style: solid; border-width: 6px 0 6px 9px; border-color: transparent transparent transparent #ffcc00;
}
/* A merge's conflict blocks (ADM-1205), in VS Code's colours: this project's side green, the incoming side blue, the
   common ancestor grey; each marker line a stronger tint of its side. */
.code-browser .lc-conflict-current-head { background: color-mix(in srgb, #40c8ae 45%, transparent); }
.code-browser .lc-conflict-current { background: color-mix(in srgb, #40c8ae 18%, transparent); }
.code-browser .lc-conflict-base { background: color-mix(in srgb, #8a8a8a 18%, transparent); }
.code-browser .lc-conflict-sep { background: color-mix(in srgb, #8a8a8a 30%, transparent); }
.code-browser .lc-conflict-incoming { background: color-mix(in srgb, #40a6ff 18%, transparent); }
.code-browser .lc-conflict-incoming-head { background: color-mix(in srgb, #40a6ff 45%, transparent); }
/* Blame (ADM-1321): who changed the line, faint after its end, as GitLens shows it. */
.code-browser .lc-blame-after { color: var(--vm-ink-faint); font-style: italic; opacity: .85; }
</style>
