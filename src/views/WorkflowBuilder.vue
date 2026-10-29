<template>
  <div ref="builderRoot" class="wfb-root" :class="{ 'is-loading': loading, 'has-load-error': !!loadError }">
    <header class="wfb-bar">
      <div class="bar-left">
        <button type="button" class="lnk" @click="goBack" aria-label="Back to workflows"><Icon icon="lucide:arrow-left" /><span>Workflows</span></button>
        <span class="sep" aria-hidden="true">/</span>
        <input v-if="renaming" ref="nameInputEl" v-model="nameDraft" class="name-in" aria-label="Workflow name" maxlength="200"
          @keydown.enter.prevent="commitRename" @keydown.esc.stop="cancelRename" @blur="commitRename" />
        <button v-else class="name-display" :disabled="loading || !!loadError" @click="startRename" title="Rename workflow">{{ name || 'Untitled workflow' }}<Icon icon="lucide:pencil" /></button>
        <span v-if="!loading && !loadError" class="wf-status" :class="wfStatus">{{ wfStatus }}</span>
        <span class="save-state" role="status">{{ loading ? 'Loading...' : loadError ? 'Unavailable' : busy ? 'Working...' : dirty ? 'Unsaved changes' : 'Saved' }}</span>
      </div>
      <div class="bar-right">
        <button class="gbtn" :disabled="actionsDisabled || !dirty" @click="save" title="Save (Ctrl/Cmd+S)"><Icon icon="lucide:save" />Save</button>
        <button class="gbtn" :disabled="actionsDisabled || running" @click="runGraph(true)" title="Test without external side effects"><Icon icon="lucide:flask-conical" />Test</button>
        <button v-if="!running" class="gbtn run" :disabled="actionsDisabled" @click="runGraph(false)"><Icon icon="lucide:play" />Run</button>
        <button v-else class="gbtn stop" :disabled="stopping || starting || !activeRunId" @click="stopRun"><Icon icon="lucide:square" />{{ stopping ? 'Stopping...' : 'Stop' }}</button>
        <button class="gbtn publish-action" :disabled="actionsDisabled || running" @click="publish"><Icon icon="lucide:upload" />Publish</button>
        <button v-if="wfStatus === 'published'" class="gbtn lifecycle-action" :disabled="actionsDisabled" @click="setLifecycle('paused')">Pause</button>
        <button v-else-if="wfStatus === 'paused'" class="gbtn lifecycle-action" :disabled="actionsDisabled" @click="setLifecycle('published')">Resume</button>
        <div class="wf-menu">
          <button class="gbtn more-btn" @click="menuOpen = !menuOpen" aria-label="More workflow actions" :aria-expanded="menuOpen" aria-controls="workflow-actions"><Icon icon="lucide:ellipsis" /></button>
          <div v-if="menuOpen" class="wf-menu-back" @click="menuOpen = false"></div>
          <div v-if="menuOpen" id="workflow-actions" class="wf-menu-pop" @click="menuOpen = false">
            <button :disabled="actionsDisabled" @click="validateGraph"><Icon icon="lucide:shield-check" />Validate workflow</button>
            <button @click="openVersions"><Icon icon="lucide:history" />Version history</button>
            <button :disabled="!dirty || actionsDisabled" @click="resetChanges"><Icon icon="lucide:undo-2" />Discard changes</button>
            <button :disabled="actionsDisabled" @click="duplicateWorkflow"><Icon icon="lucide:copy" />Duplicate workflow</button>
            <button class="danger" :disabled="actionsDisabled || running" @click="deleteWorkflow"><Icon icon="lucide:archive" />Archive workflow</button>
          </div>
        </div>
      </div>
    </header>
    <div class="wfb-workspace-tools" aria-label="Editor controls">
      <div class="editor-panel-tools">
        <button class="gbtn" :aria-pressed="!paletteCollapsed" @click="togglePalette"><Icon icon="lucide:panel-left" />Nodes</button>
        <button class="gbtn" :aria-pressed="!inspectorCollapsed" @click="toggleInspector"><Icon icon="lucide:panel-right" />Inspector</button>
        <button class="gbtn" :aria-pressed="logOpen" @click="toggleLog"><Icon icon="lucide:terminal" />Log<span v-if="logErrorCount" class="error-count">{{ logErrorCount }}</span></button>
      </div>
      <span class="canvas-meta">{{ nodeCount }} nodes / {{ getEdges.length }} connections</span>
      <button class="gbtn" @click="openRuns"><Icon icon="lucide:list-tree" />Runs</button>
      <button class="gbtn icon-button" aria-label="Workflow help and keyboard shortcuts" @click="showHelp = true"><Icon icon="lucide:circle-help" /></button>
    </div>
    <div v-if="loadError" class="wfb-load-error" role="alert">{{ loadError }}<button class="gbtn" @click="load">Try again</button></div>
    <div class="wfb-body" :inert="loading || !!loadError"><div v-if="loading || loadError" class="workbench-blocker" :aria-busy="loading"><span v-if="loading">Loading workflow...</span></div>
      <!-- Left palette (resizable, searchable, category-grouped) -->
      <aside v-show="!paletteCollapsed" aria-label="Node library" class="wfb-palette" :style="{ width: paletteW + 'px' }">
        <button class="add-node-btn" @click="openPalette()">＋ Add node <kbd>⌘K</kbd></button>
        <input v-model="sidebarSearch" class="pal-search" aria-label="Filter node library" placeholder="Search nodes…" />
        <div class="pal-scroll">
          <p v-if="!sidebarGroups.length" class="pal-empty">No nodes match “{{ sidebarSearch }}”.</p>
          <div v-for="g in sidebarGroups" :key="g.key" class="pal-cat">
            <div class="pal-cat-h">{{ g.label }}</div>
            <button type="button" v-for="p in g.items" :key="p.type" class="pal-card" :class="'fam-' + p.type.split('.')[0]"
              draggable="true" @dragstart="onDragStart($event, p.type)" @click="addQuick(p.type)" :title="'Drag to canvas or click to add — ' + p.sub">
              <span class="pal-card-ic"><Icon :icon="wfIcon(p.type)" /></span>
              <span class="pal-card-txt"><span class="pal-card-l">{{ p.label }}</span><span class="pal-card-s">{{ p.sub }}</span></span>
            </button>
          </div>
          <button class="pal-more" @click="openPalette()">Browse tools &amp; MCP →</button>
        </div>
        <div class="pal-footer"><button @click="showHelp = true"><Icon icon="lucide:keyboard" />Shortcuts</button><button @click="resetLayout" title="Reset panel sizes"><Icon icon="lucide:panels-top-left" />Reset layout</button></div>
      </aside>
      <div v-show="!paletteCollapsed" class="wfb-divider v" @pointerdown="startResize('palette', $event)"></div>
      <button class="wfb-tab tab-left" :aria-label="paletteCollapsed ? 'Show node library' : 'Hide node library'" :title="paletteCollapsed ? 'Show palette' : 'Hide palette'" @click="togglePalette">{{ paletteCollapsed ? '»' : '«' }}</button>

      <!-- Canvas -->
      <div class="canvas-wrap" @drop="onDrop" @dragover.prevent @dragenter.prevent>
        <VueFlow :delete-key-code="null" @node-drag-stop="markDirty" :node-types="nodeTypes" :default-viewport="{ zoom: 1 }"
          @node-click="onNodeClick" @pane-click="selected = null; selectedEdge = null">
          <Background pattern-color="#cbd5e1" :gap="18" />
          <Controls />
        </VueFlow>
        <div v-if="loading" class="canvas-overlay">Loading…</div>
        <div v-if="running" class="run-banner">
          <div class="run-title">
            <Icon icon="lucide:loader-2" class="spin" />
            <div>
              <h3>{{ runBannerTitle }}</h3>
              <p>{{ runStartedLabel || 'Starting…' }}</p>
            </div>
            <button @click="openRuns()">View full run details <Icon icon="lucide:arrow-right" /></button>
          </div>
          <div class="run-metrics">
            <span><small>Total nodes</small><b>{{ runStats.total }}</b></span>
            <span><small>Completed</small><b>{{ runStats.completed }} <Icon icon="lucide:check-circle-2" /></b></span>
            <span><small>Running</small><b>{{ runStats.running }} <Icon icon="lucide:loader-2" class="spin" /></b></span>
            <span><small>Skipped</small><b>{{ runStats.warnings }} <Icon icon="lucide:triangle-alert" /></b></span>
            <span><small>Failed</small><b>{{ runStats.failed }} <Icon icon="lucide:x-circle" /></b></span>
          </div>
        </div>

        <!-- empty canvas hero -->
        <div v-if="!loading && !loadError && !nodeCount" class="canvas-empty">
          <div class="ce-card">
            <div class="ce-ic">🧩</div>
            <h3 class="ce-title">Build your first workflow</h3>
            <p class="ce-sub">Start with a trigger, then add an agent or action. Drag from the left palette, or pick a starter:</p>
            <div class="ce-btns">
              <button class="ce-btn" @click="addQuick('trigger.manual')">▶ Manual Trigger</button>
              <button class="ce-btn" @click="addQuick('trigger.schedule')">⏰ Schedule</button>
              <button class="ce-btn" @click="addQuick('trigger.webhook')">🔗 Webhook</button>
              <button class="ce-btn" @click="addQuick('agent.run')">🤖 Agent</button>
              <button class="ce-btn" @click="addQuick('action.http')">🌐 HTTP</button>
            </div>
            <button class="ce-more" @click="openPalette()">Browse all nodes (⌘K)</button>
          </div>
        </div>

        <!-- live run / validation log dock (resizable + collapsible) -->
        <div v-if="logOpen" class="log-console" :style="{ height: logH + 'px' }">
          <div class="log-resize" @pointerdown="startResize('log', $event)" title="Drag to resize"></div>
          <div class="log-h">
            <span><Icon icon="lucide:activity" class="log-head-ic" />Run log</span>
            <span class="log-summary" :class="{ running }">{{ runSummary }}</span>
            <div class="flex-1"></div>
            <button class="log-btn" :class="{ on: logErrorsOnly }" :disabled="!logErrorCount && !logErrorsOnly"
              @click="logErrorsOnly = !logErrorsOnly" :aria-label="logErrorsOnly ? 'Show all logs' : 'Errors only'" :title="logErrorsOnly ? 'Show all' : 'Errors only'">⚠ {{ logErrorCount }}</button>
            <button class="log-btn" :disabled="!logEntries.length" @click="copyLog">Copy</button>
            <button class="log-btn" :disabled="!logEntries.length" @click="resetLog()">Clear</button>
            <button class="log-btn" @click="toggleLog()">Hide</button>
          </div>
          <div class="log-body" ref="logBodyEl">
            <p v-if="!visibleLog.length" class="log-empty">{{ logEntries.length ? 'No errors 🎉' : 'No activity yet — Validate or ▶ Run to see live logs here.' }}</p>
            <div v-for="(e, i) in visibleLog" :key="i" class="log-line" :class="'lv-' + e.level">
              <Icon :icon="logIcon(e.level)" class="log-ic" /><span class="log-t">{{ e.t }}</span><span class="log-msg">{{ e.text }}</span>
            </div>
          </div>
        </div>
        <!-- collapsed-log reopen pill -->
        <button v-else class="log-reopen" @click="toggleLog()"><Icon icon="lucide:activity" /> Run log <span class="log-summary">{{ runSummary }}</span></button>

        <div v-if="timelineRows.length && timelineOpen" class="run-timeline"
          :style="{ bottom: (logOpen ? logH + 24 : 44) + 'px' }">
          <div class="timeline-head">
            <strong><Icon icon="lucide:list-tree" class="tl-head-ic" />Run Timeline</strong>
            <span v-if="runDetail">Run #{{ runDetail.id }} · {{ runDetail.status }}<template v-if="runDetail.duration_ms != null"> · {{ fmtDuration(runDetail.duration_ms) }}</template></span>
            <span v-else>Live</span>
            <div class="flex-1"></div>
            <button class="tl-head-btn" @click="timelineOpen = false">Collapse</button>
          </div>
          <div class="timeline-body">
            <!-- `row.id` is unique per ATTEMPT (a retried node appears more than once); `row.nodeId`
                 is what selects a node on the canvas. Using row.id for either of those would break
                 click-to-select and the active highlight. -->
            <button v-for="row in timelineRows" :key="row.id" class="timeline-row"
              :class="{ active: selected && selected.id === row.nodeId, superseded: row.superseded }"
              @click="selectNode(row.nodeId)">
              <span>{{ row.time }}</span>
              <Icon :icon="row.icon" :class="[row.state, { spin: row.running }]" />
              <strong>{{ row.title }}</strong>
              <em>{{ row.sub }}</em>
              <span v-if="row.running" class="tl-badge">Running</span>
              <span v-if="row.errorCode" class="tl-errcode">{{ row.errorCode }}</span>
              <b :class="row.state">{{ row.status }}</b>
            </button>
          </div>
        </div>
        <!-- collapsed-timeline reopen pill -->
        <button v-else-if="timelineRows.length && !timelineOpen" class="tl-reopen"
          :style="{ bottom: (logOpen ? logH + 12 : 44) + 'px' }" @click="timelineOpen = true">
          <Icon icon="lucide:list-tree" /> Run timeline <span class="log-summary">{{ timelineRows.length }} steps</span>
        </button>
      </div>

      <!-- inspector divider + collapse tab -->
      <div v-show="!inspectorCollapsed" class="wfb-divider v" @pointerdown="startResize('inspector', $event)"></div>
      <button class="wfb-tab tab-right" :aria-label="inspectorCollapsed ? 'Show inspector' : 'Hide inspector'" :title="inspectorCollapsed ? 'Show inspector' : 'Hide inspector'" @click="toggleInspector">{{ inspectorCollapsed ? '«' : '»' }}</button>

      <!-- Inspector -->
      <aside class="inspector wfb-inspector" v-if="selected && !inspectorCollapsed" :style="{ width: inspectorW + 'px' }">
        <div class="ins-h ins-sticky">
          <div class="ins-node-title">
            <span class="ins-node-icon"><Icon :icon="wfIcon(selected.type)" /></span>
            <span>
              <strong>{{ nodeLabel(selected.type) }}</strong>
              <small>{{ nodeSubtitle(selected.type) }}</small>
            </span>
          </div>
          <div class="ins-h-actions">
            <button class="del close-inspector" aria-label="Close inspector" @click="toggleInspector"><Icon icon="lucide:x" /></button>
            <button class="del" @click="deleteSelected" title="Delete node" aria-label="Delete node"><Icon icon="lucide:trash-2" /></button>
          </div>
        </div>
        <!-- shared tool-name autocomplete (used by foreach inner-tool; SchemaForm makes its own per field) -->
        <datalist id="wf-tools"><option v-for="t in toolNames" :key="t" :value="t" /></datalist>

        <template v-if="selected.type === 'trigger.manual'">
          <div class="manual-panel">
            <label class="ins-l">Description</label>
            <textarea v-model="selected.data.description" rows="4" class="ins-in"
              placeholder="Describe when this workflow should be started." @input="markDirty"></textarea>

            <div class="manual-section-head">
              <div>
                <strong>Inputs</strong>
                <span>Collect values when this workflow runs.</span>
              </div>
              <button class="kv-add" @click="addInput">+ Add input</button>
            </div>

            <div v-if="Array.isArray(selected.data.inputs) && selected.data.inputs.length" class="manual-inputs">
              <div v-for="(input, i) in selected.data.inputs" :key="i" class="kv-row">
                <input v-model="input.key" class="ins-in mono" placeholder="key" @input="markDirty" />
                <input v-model="input.default" class="ins-in" placeholder="default value" @input="markDirty" />
                <button class="kv-del" aria-label="Remove input" @click="removeInput(i)">x</button>
              </div>
            </div>
            <div v-else class="manual-empty">
              <strong>No inputs yet</strong>
              <span>Add an input to prompt the user before a run starts.</span>
            </div>

            <label class="ins-l">Notes</label>
            <textarea v-model="selected.data.notes" rows="3" class="ins-in"
              placeholder="Optional note shown on the node" @input="markDirty"></textarea>

            <div class="manual-about">
              <strong>About manual triggers</strong>
              <p>Manual triggers run on demand from the Run or Test controls. Inputs are available as variables for downstream nodes.</p>
            </div>
          </div>
        </template>

        <template v-else-if="selected.type === 'agent.run'">
          <label class="ins-l">Agent</label>
          <select v-model="selected.data.agent_id" class="ins-in" @change="onAgentPicked">
            <option :value="null" disabled>Select an agent…</option>
            <option v-for="a in agents" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
          <div class="lbl-row"><label class="ins-l">Prompt</label><button class="insvar" @click="openDataPicker('prompt')">＋ Insert variable</button></div>
          <textarea v-model="selected.data.prompt" rows="6" class="ins-in"
            placeholder="What should the agent do? Insert variables from previous nodes." @input="markDirty" @blur="onFieldBlur('prompt', $event)"></textarea>
          <label class="ins-l">Output</label>
          <select v-model="selected.data.output_mode" class="ins-in" @change="markDirty">
            <option value="text">Text (default)</option>
            <option value="json">JSON object</option>
            <option value="schema">JSON schema (typed fields)</option>
          </select>
          <template v-if="selected.data.output_mode === 'schema'">
            <label class="ins-l">Schema fields</label>
            <div v-for="(f, i) in (selected.data.output_schema || [])" :key="i" class="kv-row">
              <input v-model="f.name" class="ins-in mono" placeholder="field" @input="markDirty" />
              <select v-model="f.type" class="ins-in" style="max-width:90px" @change="markDirty">
                <option>string</option><option>number</option><option>boolean</option><option>object</option><option>array</option>
              </select>
              <label class="req-chk" title="Required"><input type="checkbox" v-model="f.required" @change="markDirty" />req</label>
              <button class="kv-del" aria-label="Remove schema field" @click="removeSchemaField(i)">×</button>
            </div>
            <button class="kv-add" @click="addSchemaField">+ Add field</button>
            <p class="ins-hint">The model is forced to return JSON; fields become pickable as <code>nodes.&lt;id&gt;.output.&lt;field&gt;</code>.</p>
          </template>
        </template>

        <template v-else-if="selected.type === 'action.mcp_tool'">
          <label class="ins-l">Agent context</label>
          <select v-model="selected.data.agent_id" class="ins-in" @change="onMcpAgentPicked">
            <option :value="null" disabled>Select an agent…</option>
            <option v-for="a in agents" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
          <label class="ins-l">MCP server</label>
          <input class="ins-in" :value="selected.data.server_name || ('#' + selected.data.server_id)" disabled />
          <label class="ins-l">MCP tool</label>
          <input class="ins-in mono" :value="selected.data.tool_name" disabled />
          <div class="lbl-row"><label class="ins-l">Params (JSON)</label><button class="insvar" @click="openDataPicker('params_json')">＋ Insert variable</button></div>
          <textarea v-model="selected.data.params_json" rows="5" class="ins-in mono" placeholder='{ "query": "{{trigger.keyword}}" }' @input="markDirty" @blur="onFieldBlur('params_json', $event)"></textarea>
          <p class="ins-hint">Deterministic single MCP call (no LLM). Runs with the agent's credentials &amp; assigned tools. Write/destructive MCP tools are blocked unattended.</p>
        </template>

        <template v-else-if="selected.type === 'trigger.webhook'">
          <div class="webhook-panel">
            <label class="ins-l">Description</label>
            <p class="ins-note">Starts the workflow when an HTTP request is received.</p>
            <label class="ins-l">Endpoint URL</label>
            <p class="ins-hint">Copy this URL and POST to it to trigger the workflow.</p>
            <div class="endpoint-box">
              <code>{{ webhookFor(selected.id) || '/api/workflow-graph-hooks/' + selected.id + '/' }}</code>
              <button title="Copy endpoint" @click="copy(webhookFor(selected.id) || '')"><Icon icon="lucide:copy" /></button>
            </div>
            <label class="ins-l">Method</label>
            <select class="ins-in" disabled>
              <option>POST</option>
            </select>
            <label class="ins-l">Notes</label>
            <textarea v-model="selected.data.notes" rows="4" class="ins-in"
              placeholder="Optional notes about this node..." @input="markDirty"></textarea>
            <button class="test-here" @click="runUpTo(selected.id)"><Icon icon="lucide:play" />Test up to here</button>
          </div>
        </template>

        <template v-else-if="selected.type === 'logic.condition'">
          <div class="condition-panel">
            <label class="ins-l">Description</label>
            <p class="ins-note">{{ selected.data.description || 'Route leads based on score and source.' }}</p>

            <div class="condition-head">
              <div>
                <strong>Conditions</strong>
                <span>{{ conditionJoin(selected) === 'OR' ? 'If ANY condition is met, go to True path.' : 'If ALL conditions are met, go to True path.' }}</span>
              </div>
            </div>

            <div class="condition-builder">
              <div v-for="(row, i) in conditionRows(selected)" :key="i" class="condition-row">
                <label>
                  <span>Field</span>
                  <input v-model="row.field" class="ins-in mono" list="wf-cond-fields"
                    placeholder="{{nodes.x.output.score}}" @input="markDirty" />
                </label>
                <label>
                  <span>Operator</span>
                  <select v-model="row.operator" class="ins-in" @change="markDirty">
                    <option>&gt;</option>
                    <option>&lt;</option>
                    <option>&gt;=</option>
                    <option>&lt;=</option>
                    <option>=</option>
                    <option>!=</option>
                    <option>contains</option>
                  </select>
                </label>
                <label>
                  <span>Value</span>
                  <input v-model="row.value" class="ins-in" @input="markDirty" />
                </label>
                <button class="condition-del" title="Remove condition" aria-label="Remove condition" @click="removeCondition(i)">
                  <Icon icon="lucide:trash-2" />
                </button>
              </div>
              <datalist id="wf-cond-fields"><option v-for="v in conditionVarSuggestions" :key="v" :value="v" /></datalist>
              <select v-if="conditionRows(selected).length > 1" class="condition-join"
                v-model="selected.data.join" @change="markDirty">
                <option value="AND">Match ALL (AND)</option>
                <option value="OR">Match ANY (OR)</option>
              </select>
              <button class="condition-add" @click="addCondition"><Icon icon="lucide:plus" />Add condition</button>
            </div>

            <div class="condition-section">
              <strong>Fallback (False path)</strong>
              <span>What happens when conditions are not met.</span>
              <div class="fallback-box">Connect the False handle to the next step for unmatched items.</div>
            </div>

            <div class="condition-section">
              <strong>Summary</strong>
              <span>The True path is used when the following condition matches:</span>
              <code>{{ conditionSummary(selected.data) }}</code>
            </div>

            <details class="advanced-row">
              <summary>Advanced options</summary>
              <p>Case sensitive string comparison. </p>
            </details>
          </div>
        </template>

        <template v-else-if="selected.type === 'logic.foreach'">
          <label class="ins-l">Items</label>
          <input v-model="selected.data.items_template" class="ins-in mono"
            placeholder="{{node.<id>.text}} or {{trigger.items}}" @input="markDirty" />
          <p class="ins-hint">A JSON array or comma-separated list. Each entry is available as <code>&#123;&#123;item&#125;&#125;</code>.</p>
          <label class="ins-l">Run per item</label>
          <select v-model="selected.data.do.type" class="ins-in" @change="onForeachTypeChange">
            <option value="action.channel">Send to channel</option>
            <option value="action.tool">Run tool</option>
            <option value="action.http">HTTP request</option>
            <option value="agent.run">Run agent</option>
            <option value="action.subworkflow">Run sub-workflow</option>
          </select>
          <template v-if="selected.data.do.type === 'action.channel'">
            <label class="ins-l">Channel</label>
            <select v-model="selected.data.do.data.kind" class="ins-in" @change="markDirty">
              <option value="log">Log</option><option value="slack">Slack</option><option value="webhook">Webhook</option>
              <option value="telegram">Telegram</option><option value="email">Email</option>
            </select>
            <input v-if="selected.data.do.data.kind === 'slack'" v-model="selected.data.do.data.slack_channel" class="ins-in" placeholder="#general" @input="markDirty" />
            <input v-if="selected.data.do.data.kind === 'webhook'" v-model="selected.data.do.data.url" class="ins-in" placeholder="https://…" @input="markDirty" />
            <input v-if="selected.data.do.data.kind === 'telegram'" v-model="selected.data.do.data.chat_id" class="ins-in" placeholder="Telegram chat id" @input="markDirty" />
            <input v-if="selected.data.do.data.kind === 'email'" v-model="selected.data.do.data.to" class="ins-in" placeholder="to@example.com" @input="markDirty" />
            <label class="ins-l">Message</label>
            <textarea v-model="selected.data.do.data.message" rows="3" class="ins-in" placeholder="Hello {{item}}" @input="markDirty"></textarea>
          </template>
          <template v-else-if="selected.data.do.type === 'action.tool'">
            <label class="ins-l">Tool name</label>
            <input v-model="selected.data.do.data.tool" class="ins-in mono" list="wf-tools" placeholder="TOOL_NAME" @input="markDirty" />
            <label class="ins-l">Params (JSON)</label>
            <textarea v-model="selected.data.do.data.params_json" rows="3" class="ins-in mono" placeholder='{ "q": "{{item}}" }' @input="markDirty"></textarea>
          </template>
          <template v-else-if="selected.data.do.type === 'action.http'">
            <label class="ins-l">Method</label>
            <select v-model="selected.data.do.data.method" class="ins-in" @change="markDirty">
              <option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option>
            </select>
            <label class="ins-l">URL</label>
            <input v-model="selected.data.do.data.url" class="ins-in" placeholder="https://…/{{item}}" @input="markDirty" />
          </template>
          <template v-else-if="selected.data.do.type === 'agent.run'">
            <label class="ins-l">Agent</label>
            <select v-model="selected.data.do.data.agent_id" class="ins-in" @change="markDirty">
              <option :value="undefined" disabled>Select an agent…</option>
              <option v-for="a in agents" :key="a.id" :value="a.id">{{ a.name }}</option>
            </select>
            <label class="ins-l">Prompt</label>
            <textarea v-model="selected.data.do.data.prompt" rows="3" class="ins-in" placeholder="Process {{item}}" @input="markDirty"></textarea>
          </template>
          <template v-else-if="selected.data.do.type === 'action.subworkflow'">
            <label class="ins-l">Sub-workflow</label>
            <select v-model="selected.data.do.data.graph_id" class="ins-in" @change="markDirty">
              <option :value="undefined" disabled>Select a workflow…</option>
              <option v-for="g in subgraphOptions" :key="g.id" :value="g.id">{{ g.name }}</option>
            </select>
            <p class="ins-hint">Each item runs the chosen workflow. <code>&#123;&#123;item&#125;&#125;</code> is passed in the trigger payload.</p>
          </template>
        </template>

        <!-- schema-driven config (manual / schedule / channel-trigger / tool / script / channel / http / condition / delay / approval / subworkflow) -->
        <template v-else>
          <SchemaForm :data="selected.data" :fields="defFields(selected.type) || []"
            :lists="{ tools: toolNames, graphs: subgraphOptions.map(g => [g.id, g.name]), scripts: scriptOptions }"
            @change="onSchemaChange" @insert="openDataPicker" @blur="onFieldBlur" />
          <p v-if="defHint(selected.type)" class="ins-hint">{{ defHint(selected.type) }}</p>

          <!-- channel-trigger inbound URL tail -->
          <template v-if="defTail(selected.type) === 'channelUrl'">
            <p class="ins-note">Save to generate the inbound URL; your channel adapter POSTs messages to it.</p>
            <div v-if="channelFor(selected.id)" class="ins-out">POST {{ channelFor(selected.id) }}</div>
            <p v-else class="ins-hint">URL appears after the first save.</p>
          </template>

          <!-- connector-event inbound URL tail: without the address the node is configurable but
               unusable, because there is nothing to give the provider -->
          <template v-if="defTail(selected.type) === 'connectorUrl'">
            <p class="ins-note">Save to generate the inbound URL, then register it with the provider.</p>
            <div v-if="connectorFor(selected.id)" class="ins-out">POST {{ connectorFor(selected.id) }}</div>
            <p v-else class="ins-hint">URL appears after the first save.</p>
            <p class="ins-hint">Sign the body with the binding's secret as
              <code>X-Signature: sha256=&lt;hmac&gt;</code>. The provider's event type is read from
              <code>X-GitHub-Event</code> / <code>X-Event-Type</code>.</p>
          </template>

          <!-- approval decision tail (shown while a run is waiting on this node) -->
          <div v-if="defTail(selected.type) === 'approval' && selected.data.__status === 'waiting' && activeRunId" class="appr-box">
            <p class="appr-q">Awaiting your decision</p>
            <div class="appr-btns">
              <button class="appr-yes" :disabled="busy" @click="decide('approve')">✓ Approve</button>
              <button class="appr-no" :disabled="busy" @click="decide('reject')">✕ Reject</button>
            </div>
          </div>
        </template>

        <!-- shared reliability / advanced settings (failable nodes) -->
        <template v-if="hasReliability(selected.type)">
          <button type="button" class="adv-h" :aria-expanded="advOpen" @click="advOpen = !advOpen">{{ advOpen ? '▾' : '▸' }} Advanced · reliability</button>
          <div v-if="advOpen" class="adv-body">
            <label class="ins-l">Retries</label>
            <input v-model.number="selected.data.retries" type="number" min="0" max="5" class="ins-in" placeholder="0" @input="markDirty" />
            <label class="ins-l">Retry backoff (seconds)</label>
            <input v-model.number="selected.data.retry_backoff_seconds" type="number" min="0" max="30" class="ins-in" placeholder="0" @input="markDirty" />
            <label class="ins-l">Timeout (seconds)</label>
            <input v-model.number="selected.data.timeout_seconds" type="number" min="0" class="ins-in" placeholder="none" @input="markDirty" />
            <label class="ins-l">On error</label>
            <select v-model="selected.data.on_error" class="ins-in" @change="markDirty">
              <option value="stop">Stop the run (default)</option>
              <option value="continue">Continue to next nodes</option>
            </select>
            <p class="ins-hint">Or wire the <b>on error</b> handle to route failures to a recovery branch.</p>
          </div>
        </template>

        <template v-if="showSharedNotes(selected.type)">
          <label class="ins-l">Notes</label>
          <textarea v-model="selected.data.notes" rows="2" class="ins-in" placeholder="Optional note shown on the node" @input="markDirty"></textarea>
        </template>

        <div v-if="selected.data.__error" class="ins-err" role="alert">⚠ {{ selected.data.__error }}</div>

        <!-- Node Output panel (Phase C) — last run's input/output/error -->
        <template v-if="selectedNodeRun">
          <div class="op-h">
            <span>Last run · {{ selectedNodeRun.status }}</span>
            <span class="op-tabs">
              <button v-for="t in ['output','input','error']" :key="t" class="op-tab" :class="{ on: opTab === t }" @click="opTab = t">{{ t }}</button>
            </span>
          </div>
          <pre class="op-body">{{ nodeRunView }}</pre>
        </template>

        <div v-if="showSharedActions(selected.type)" class="ins-actions">
          <button class="rerun-here" @click="runUpTo(selected.id)" :disabled="running">▶ Test up to here</button>
          <button v-if="activeRunId && !running" class="rerun-here" @click="rerun(selected.id)">↻ Re-run from here</button>
        </div>
      </aside>

      <!-- Edge inspector -->
      <aside class="inspector wfb-inspector" v-else-if="selectedEdge && !inspectorCollapsed" :style="{ width: inspectorW + 'px' }">
        <div class="ins-h ins-sticky">
          <span>connection</span>
          <button class="del" @click="deleteEdge" title="Delete connection" aria-label="Delete connection">🗑</button>
        </div>
        <label class="ins-l">Edge label</label>
        <input v-model="edgeLabel" class="ins-in" placeholder="e.g. on success" @input="onEdgeLabel" />
        <p class="ins-hint">Labels annotate the wire on the canvas. Branch handles (true/false/on-error) are set by which handle you connect.</p>
      </aside>

      <!-- Inspector empty state -->
      <aside class="inspector wfb-inspector ins-empty-wrap" v-else-if="!inspectorCollapsed" :style="{ width: inspectorW + 'px' }">
        <div class="ins-empty">
          <div class="ins-empty-ic">⚙️</div>
          <p class="ins-empty-t">Nothing selected</p>
          <p class="ins-empty-s">Click a node to configure it, or a connection to label it.</p>
        </div>
      </aside>
    </div>

    <div v-if="showHelp" class="modal-scrim" @click.self="showHelp = false">
      <section class="run-form help-dialog" role="dialog" aria-modal="true" aria-label="Workflow help" tabindex="-1">
        <div class="rf-h">Workflow help<button class="x" aria-label="Close workflow help" @click="showHelp = false"><Icon icon="lucide:x" /></button></div>
        <div class="rf-body"><p>Add a trigger, connect your steps, then select a node to configure it. Validate before you test.</p><p>Test uses a dry run. Run can perform real actions. Publish makes the saved version available to triggers; Pause stops new triggered runs.</p>
          <dl><dt>Ctrl / Cmd + K</dt><dd>Add a node</dd><dt>Ctrl / Cmd + S</dt><dd>Save changes</dd><dt>Ctrl / Cmd + C / V</dt><dd>Copy / paste selected nodes</dd><dt>Delete / Backspace</dt><dd>Remove a selected node or connection</dd><dt>Escape</dt><dd>Close the active panel or dialog</dd></dl>
        </div><div class="rf-foot"><button class="gbtn" @click="showHelp = false">Done</button></div>
      </section>
    </div>

    <!-- Run history drawer -->
    <div v-if="showRuns" class="drawer-scrim" @click.self="showRuns = false">
      <div class="drawer" role="dialog" aria-modal="true" :aria-label="showRuns ? 'Run history' : 'Version history'" tabindex="-1">
        <div class="drawer-h">
          <b>Run history</b>
          <button @click="showRuns = false" class="x">×</button>
        </div>
        <div v-if="metrics" class="metrics-bar">
          <div class="met"><span class="met-v">{{ metrics.success_rate != null ? Math.round(metrics.success_rate * 100) + '%' : '—' }}</span><span class="met-l">success</span></div>
          <div class="met"><span class="met-v">{{ fmtDuration(metrics.avg_duration_ms) }}</span><span class="met-l">avg time</span></div>
          <div class="met"><span class="met-v">{{ fmtCost(metrics.total_cost) }}</span><span class="met-l">total cost</span></div>
          <div class="met"><span class="met-v">{{ metrics.total_runs }}</span><span class="met-l">runs</span></div>
        </div>
        <div v-if="historyLoading" class="drawer-empty" role="status">Loading runs?</div><div v-else-if="historyError" class="drawer-empty" role="alert">{{ historyError }}<button class="gbtn" @click="openRuns">Try again</button></div><div v-else-if="!runs.length" class="drawer-empty">No runs yet. Press ▶ Run.</div>
        <div v-else class="drawer-list">
          <button v-for="r in runs" :key="r.id" class="run-row" @click="openRun(r.id)">
            <span class="w-2 h-2 rounded-full" :class="dotClass(r.status)"></span>
            <span class="run-id">Run #{{ r.id }}</span>
            <span v-if="r.dry_run" class="run-dry">test</span>
            <span class="run-st">{{ r.status }}</span>
            <span class="run-dur">{{ fmtDuration(r.duration_ms) }}</span>
            <span class="run-time">{{ fmt(r.created_at) }}</span>
          </button>
        </div>
        <div v-if="runDetail" class="run-detail">
          <div class="rd-h">
            Run #{{ runDetail.id }} · {{ runDetail.status }}
            <span v-if="runDetail.dry_run" class="run-dry">test</span>
            <span class="rd-meta">{{ fmtDuration(runDetail.duration_ms) }}<template v-if="runDetail.cost"> · {{ fmtCost(runDetail.cost) }}</template></span>
            <button v-if="runDetail.status === 'failed' && !running" class="rd-rerun" @click="rerun()">↻ Re-run failed</button>
          </div>
          <div v-for="nr in runDetail.node_runs" :key="nr.id" class="rd-node">
            <span class="w-2 h-2 rounded-full" :class="dotClass(nr.status)"></span>
            <span class="rd-nt">{{ nr.node_type }}</span>
            <span class="rd-id">{{ nr.node_id }}</span>
            <span class="rd-st">{{ nr.status }}</span>
            <span v-if="nr.duration_ms != null" class="rd-dur">{{ fmtDuration(nr.duration_ms) }}</span>
            <div v-if="nr.error" class="rd-err">{{ nr.error }}</div>
            <StudioJobList v-if="nr.output?.awaiting_media_job && nr.output.job_id" :ids="[nr.output.job_id]" @settled="resumeMediaRun" />
            <a v-if="nr.output?.attachment_id && nr.output.url" :href="nr.output.url" target="_blank" rel="noopener noreferrer">Open media result</a>
            <div v-else-if="nr.output && (nr.output.text || nr.output.reason)" class="rd-out">{{ nr.output.text || nr.output.reason }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Run-with-inputs modal (manual trigger inputs) -->
    <div v-if="showRunForm" class="modal-scrim" @click.self="showRunForm = false">
      <div class="run-form" role="dialog" aria-modal="true" aria-label="Run with inputs" tabindex="-1">
        <div class="rf-h">Run with inputs<button class="x" @click="showRunForm = false">×</button></div>
        <div class="rf-body">
          <div v-for="k in runFormFields" :key="k" class="rf-row">
            <label class="ins-l">{{ k }}</label>
            <input v-model="runForm[k]" class="ins-in" :placeholder="k" />
          </div>
        </div>
        <div class="rf-foot">
          <button class="gbtn" @click="showRunForm = false">Cancel</button>
          <button class="gbtn run" :disabled="starting || busy" @click="startRun({ ...runForm })">{{ pendingDry ? '🧪 Test' : '▶ Run' }}</button>
        </div>
      </div>
    </div>

    <!-- Version history drawer -->
    <div v-if="showVersions" class="drawer-scrim" @click.self="showVersions = false">
      <div class="drawer" role="dialog" aria-modal="true" :aria-label="showRuns ? 'Run history' : 'Version history'" tabindex="-1">
        <div class="drawer-h">
          <b>Version history</b>
          <button @click="showVersions = false" class="x">×</button>
        </div>
        <p class="ver-hint">Published versions are snapshotted here. Restore rolls the canvas back to that snapshot.</p>
        <div v-if="versionsLoading" class="drawer-empty" role="status">Loading versions?</div><div v-else-if="versionsError" class="drawer-empty" role="alert">{{ versionsError }}<button class="gbtn" @click="openVersions">Try again</button></div><div v-else-if="!versions.length" class="drawer-empty">No saved versions yet. Publish to snapshot one.</div>
        <div v-else class="drawer-list ver-list">
          <div v-for="v in versions" :key="v.id" class="ver-row">
            <div class="ver-info">
              <span class="ver-num">v{{ v.version }}</span>
              <span class="ver-lbl">{{ v.label || 'Published' }}</span>
              <span class="ver-time">{{ fmt(v.created_at) }}</span>
            </div>
            <button class="ver-restore" :disabled="busy" @click="restoreVersion(v)">Restore</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Command-palette: add node -->
    <div v-if="showPalette" class="modal-scrim pal-scrim" @click.self="showPalette = false">
      <div class="cmd-pal" role="dialog" aria-modal="true" aria-label="Add a node" tabindex="-1">
        <!-- step 2: choose an agent context for a deterministic MCP tool -->
        <template v-if="mcpPick">
          <div class="cmd-search cmd-back"><button class="cmd-backbtn" @click="mcpPick = null">←</button> Choose agent context</div>
          <div class="cmd-body cmd-ctx">
            <p class="cmd-ctx-h">{{ mcpPick.serverName }}: <b>{{ mcpPick.toolName }}</b></p>
            <p class="cmd-ctx-note">MCP tools need an agent for credentials &amp; permissions. The agent must have the “{{ mcpPick.serverName }}” server attached — the run fails clearly otherwise.</p>
            <label class="ins-l">Agent</label>
            <select v-model="mcpPick.agentId" class="ins-in">
              <option :value="null" disabled>Select an agent…</option>
              <option v-for="a in mcpAgentOptions" :key="a.id" :value="a.id">{{ a.name }}</option>
            </select>
          </div>
          <div class="cmd-foot cmd-foot-btns">
            <button class="gbtn" @click="mcpPick = null">Back</button>
            <button class="gbtn save" :disabled="!mcpPick.agentId" @click="confirmMcpPick">Add MCP tool node</button>
          </div>
        </template>
        <!-- step 1: searchable catalog -->
        <template v-else>
          <div class="cmd-head">
            <div>
              <h2 id="add-node-title">Add a node</h2>
              <p id="add-node-description">Choose a node to add to your workflow.</p>
            </div>
            <button class="cmd-close" @click="showPalette = false" aria-label="Close add node">×</button>
          </div>
          <div class="cmd-search-wrap">
            <svg class="cmd-search-ic" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"/></svg>
            <input ref="palSearchEl" v-model="paletteSearch" class="cmd-search" type="search" aria-label="Search nodes" placeholder="Search nodes..." @keydown.esc="showPalette = false" />
            <kbd>Ctrl K</kbd>
          </div>
          <div class="cmd-tabs" role="group" aria-label="Node categories">
            <button v-for="tab in paletteTabs" :key="tab.key" type="button" :class="{ active: activePaletteTab === tab.key }" @click="activePaletteTab = tab.key">{{ tab.label }}</button>
          </div>
          <div class="cmd-body">
            <p v-if="paletteLoading" class="cmd-empty">Loading catalog…</p>
            <p v-else-if="!visiblePaletteGroups.length" class="cmd-empty">{{ paletteSearch ? `No matches for ${paletteSearch}.` : 'No nodes available in this category.' }}</p>
            <div v-else-if="featuredPaletteItems.length" class="cmd-featured">
              <div class="cmd-section-head">
                <span>Featured</span>
                <button type="button" @click="showFeatured = false">View all</button>
              </div>
              <div class="cmd-feature-grid">
                <button v-for="it in featuredPaletteItems" :key="'featured:' + it.key" class="cmd-feature-card" @click="addFromPalette(it)">
                  <span class="cmd-ic" :class="'fam-' + (it.family || 'action')"><Icon :icon="itemIcon(it)" /></span>
                  <span class="cmd-feature-title">{{ it.label }}</span>
                  <span class="cmd-feature-sub">{{ it.sub }}</span>
                </button>
              </div>
            </div>
            <div v-for="grp in visiblePaletteGroups" :key="grp.key" class="cmd-grp">
              <component :is="grp.collapsible ? 'button' : 'div'" class="cmd-grp-h" :aria-expanded="grp.collapsible ? isGroupOpen(grp) : undefined" :class="{ 'cmd-grp-toggle': grp.collapsible }" @click="grp.collapsible && toggleGroup(grp)">
                <span v-if="grp.collapsible" class="cmd-caret">{{ isGroupOpen(grp) ? '▾' : '▸' }}</span>
                {{ grp.label }}<span class="cmd-grp-n">{{ grp.items.length }}</span>
              </component>
              <template v-if="isGroupOpen(grp)">
                <button v-for="it in grp.items" :key="it.key" class="cmd-item" @click="addFromPalette(it)">
                  <span class="cmd-ic" :class="'fam-' + (it.family || 'action')"><Icon :icon="itemIcon(it)" /></span>
                  <span class="cmd-txt">
                    <span class="cmd-l">{{ it.label }}</span>
                    <span class="cmd-s">{{ it.sub }}</span>
                  </span>
                  <span v-if="it.badge" class="cmd-badge">{{ it.badge }}</span>
                </button>
              </template>
            </div>
          </div>
          <div class="cmd-foot"><kbd>Esc</kbd> close · click to add at canvas center</div>
        </template>
      </div>
    </div>

    <!-- Data Picker: output-tree variable selector — click OR drag a field into the input -->
    <div v-if="showDataPicker" class="modal-scrim" @click.self="showDataPicker = false">
      <div class="cmd-pal" role="dialog" aria-modal="true" aria-label="Insert variable" tabindex="-1">
        <div class="cmd-search cmd-back">Insert variable<button class="cmd-backbtn" style="margin-left:auto" @click="showDataPicker = false">×</button></div>
        <div class="cmd-body">
          <p v-if="!pickerSources.length" class="cmd-empty">No upstream data yet. Connect a previous node, or run / test to capture sample values.</p>
          <div v-for="src in pickerSources" :key="src.id" class="cmd-grp">
            <OutputTree :node="src.root" :base="src.base" @pick="insertExpr" @dragvar="showDataPicker = false" />
          </div>
        </div>
        <div class="cmd-foot">Click to insert at the cursor, or <b>drag</b> a field onto an input. Arrays offer <span class="mono">.first</span> + <span class="mono">[index]</span>.</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, provide, onMounted, onBeforeUnmount, markRaw } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { Icon } from '@iconify/vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import WfNode from '../components/workflows/WfNode.vue'
import SchemaForm from '../components/workflows/SchemaForm.vue'
import StudioJobList from '../components/studio/StudioJobList.vue'
import { hydrateMediaNode, serializeMediaNode } from '../services/mediaWorkflowNode'
import OutputTree from '../components/workflows/OutputTree.vue'
import { WF_TYPES, wfDef, wfFields, wfPaletteItems, wfDefaultData, wfOutputSample } from '../config/wfNodeDefinitions'
import { loadLayout, saveLayout, LAYOUT_BOUNDS, LAYOUT_DEFAULTS } from '../utils/wfLayoutPrefs'
import api from '../services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import { usePoller } from '@/composables/usePoller'
import { reconnectingSocket } from '@/utils/reconnectingSocket'
import { WorkflowInputError, workflowJson } from '../utils/workflowInput'
import { freeWorkflowPosition } from '../utils/workflowNodePlacement'
import { RUN_STOP_STATUSES, runStopKind, fetchAllAgents } from '../utils/workflowRunPolling'

const route = useRoute()
const router = useRouter()
const graphId = route.params.id

const {
  addNodes, addEdges, onConnect, onNodeClick: vfOnNodeClick, onEdgeClick: vfOnEdgeClick, screenToFlowCoordinate,
  getNodes, getEdges, setNodes, setEdges, removeNodes, removeEdges, toObject, setViewport, vueFlowRef, fitView, onNodesInitialized,
} = useVueFlow()

let initialFitPending = true, savedViewport = null
onNodesInitialized(() => {
  if (!initialFitPending) return
  initialFitPending = false
  if (savedViewport && window.innerWidth >= 1000) setViewport(savedViewport)
  else fitView({ padding: 0.2, maxZoom: 1 })
})

// Node types + palette + defaults now come from the central registry (wfNodeDefinitions.js).
const nodeTypes = Object.fromEntries(WF_TYPES.map(t => [t, markRaw(WfNode)]))
// Schema-form helpers (null fields → the node keeps a bespoke inspector template).
const defFields = (type) => wfFields(type)
const defHint = (type) => wfDef(type)?.hint || ''
const defTail = (type) => wfDef(type)?.customTail || ''
const nodeIcon = (type) => wfDef(type)?.icon || ''
const nodeLabel = (type) => wfDef(type)?.label || type
const nodeSubtitle = (type) => wfDef(type)?.sub || 'Configure this node'
const customInspectorTypes = new Set(['trigger.manual', 'trigger.webhook'])
const showSharedNotes = (type) => !customInspectorTypes.has(type)
const showSharedActions = (type) => type !== 'trigger.webhook'

const WF_ICON_MAP = {
  'llm.call': 'lucide:sparkles',
  'trigger.webhook': 'lucide:webhook',
  'trigger.schedule': 'lucide:clock-3',
  'trigger.channel': 'lucide:message-square',
  'trigger.manual': 'lucide:square-play',
  'agent.run': 'lucide:bot',
  'action.channel': 'lucide:send',
  'action.http': 'lucide:globe-2',
  'action.tool': 'lucide:wrench',
  'action.script': 'lucide:scan-line',
  'action.mcp_tool': 'lucide:plug-zap',
  'action.subworkflow': 'lucide:workflow',
  'logic.condition': 'lucide:split',
  'logic.approval': 'lucide:badge-check',
  'logic.foreach': 'lucide:repeat-2',
  'logic.delay': 'lucide:timer',
}
const FAMILY_ICON_MAP = {
  media: 'lucide:film',
  trigger: 'lucide:webhook',
  agent: 'lucide:bot',
  action: 'lucide:wrench',
  logic: 'lucide:split',
  data: 'lucide:database',
}
const wfIcon = (type) => WF_ICON_MAP[type] || FAMILY_ICON_MAP[String(type || '').split('.')[0]] || 'lucide:square'
const itemIcon = (item) => {
  if (item?.nodeType) return wfIcon(item.nodeType)
  const key = String(item?.key || '')
  const label = `${item?.label || ''} ${item?.sub || ''}`.toLowerCase()
  if (key.startsWith('mcptool:')) return 'lucide:plug-zap'
  if (key.startsWith('mcpsrv:')) return 'lucide:server-cog'
  if (label.includes('slack')) return 'logos:slack-icon'
  if (label.includes('notion')) return 'logos:notion-icon'
  if (label.includes('stripe')) return 'logos:stripe'
  if (label.includes('google')) return 'logos:google-icon'
  if (label.includes('airtable')) return 'logos:airtable'
  if (label.includes('email')) return 'lucide:mail'
  if (label.includes('database')) return 'lucide:database'
  return FAMILY_ICON_MAP[item?.family] || 'lucide:wrench'
}
const logIcon = (level) => ({
  success: 'lucide:check-circle-2',
  warn: 'lucide:triangle-alert',
  warning: 'lucide:triangle-alert',
  error: 'lucide:x-circle',
  failed: 'lucide:x-circle',
  info: 'lucide:info',
}[level] || 'lucide:circle-dot')

const name = ref('')
const loading = ref(true)
const loadError = ref(''), starting = ref(false), stopping = ref(false)
const builderRoot = ref(null), showHelp = ref(false)
const historyLoading = ref(false), historyError = ref(''), versionsLoading = ref(false), versionsError = ref('')
const actionsDisabled = computed(() => loading.value || !!loadError.value || busy.value || starting.value)
const busy = ref(false)
const running = ref(false)
const dirty = ref(false)
const savedSnapshot = ref(null)   // last-saved { name, graph } for Reset (Phase 3A)
const renaming = ref(false)       // inline workflow-name edit
const nameDraft = ref('')
const nameInputEl = ref(null)
const selected = ref(null)
const agents = ref([])
const showRuns = ref(false)
const runs = ref([])
const runDetail = ref(null)
const activeRunId = ref(null)
const version = ref(1)
// Optimistic-concurrency token from the server. Sent back on every content save so two open
// tabs cannot silently overwrite each other; refreshed from every response that returns one.
const etag = ref('')
const wfStatus = ref('draft')
const toolNames = ref([])
const graphTriggers = ref([])
const advOpen = ref(false)
const allGraphs = ref([])      // for sub-workflow picker
const scripts = ref([])        // for the action.script picker ([{id, name, file_path}])
const showRunForm = ref(false)
const runForm = ref({})
const runFormFields = ref([])
const pendingDry = ref(false), pendingUntil = ref(null)
const selectedEdge = ref(null)
let clipboard = []
const showVersions = ref(false)
const versions = ref([])
const metrics = ref(null)
const runSocket = reconnectingSocket({ onMessage: (ev) => onRunSocketMessage(ev) })
let unmounted = false

// node types that support retries/timeout/on_error
const RELIABILITY_TYPES = ['agent.run', 'action.channel', 'action.tool', 'action.http', 'action.script',
  'action.subworkflow', 'logic.foreach', 'logic.approval']
const hasReliability = (t) => RELIABILITY_TYPES.includes(t)
const subgraphOptions = computed(() => allGraphs.value.filter(g => String(g.id) !== String(graphId)))
// [value, label] pairs for the action.script picker (SchemaForm enum optionsKey='scripts')
const scriptOptions = computed(() => scripts.value.map(s => [s.id, s.name || s.file_path || `Script #${s.id}`]))

function addInput() {
  if (!Array.isArray(selected.value.data.inputs)) selected.value.data.inputs = []
  selected.value.data.inputs.push({ key: '', default: '' })
  markDirty()
}
function removeInput(i) { selected.value.data.inputs.splice(i, 1); markDirty() }
function addSchemaField() {
  if (!Array.isArray(selected.value.data.output_schema)) selected.value.data.output_schema = []
  selected.value.data.output_schema.push({ name: '', type: 'string', required: false })
  markDirty()
}
function removeSchemaField(i) { selected.value.data.output_schema.splice(i, 1); markDirty() }
function onSubgraphPicked() {
  const g = allGraphs.value.find(x => String(x.id) === String(selected.value.data.graph_id))
  if (g) selected.value.data.graph_name = g.name
  markDirty()
}
// SchemaForm change → mark dirty + derive companion fields (e.g. graph_id → graph_name)
function onSchemaChange(key, val) {
  markDirty()
  if (!selected.value) return
  if (key === 'graph_id') {
    const id = val === '' || val == null ? null : (Number(val) || val)
    selected.value.data.graph_id = id
    const g = allGraphs.value.find(x => String(x.id) === String(id))
    selected.value.data.graph_name = g ? g.name : ''
  }
}
async function decide(decision) {
  if (!activeRunId.value || !selected.value) return
  busy.value = true
  try {
    await api.approveWorkflowGraphRun(activeRunId.value, selected.value.id, decision)
    addLog('info', `${decision === 'approve' ? '✓ Approved' : '✕ Rejected'} — resuming…`)
    running.value = true
    openRunSocket(activeRunId.value)
    pollRun(activeRunId.value)
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to submit decision')
  } finally {
    busy.value = false
  }
}

function webhookFor(nodeId) {
  const t = graphTriggers.value.find(x => x.node_id === nodeId && x.kind === 'webhook')
  return t?.webhook_path || ''
}
function channelFor(nodeId) {
  const t = graphTriggers.value.find(x => x.node_id === nodeId && x.kind === 'channel')
  return t?.channel_path || ''
}
function connectorFor(nodeId) {
  const t = graphTriggers.value.find(x => x.node_id === nodeId && x.kind === 'connector')
  return t?.connector_path || ''
}

// ── resizable layout (Phase 2C) — sizes + collapse flags persisted to localStorage only ──
const _lp = loadLayout()
const paletteW = ref(_lp.paletteW)
const inspectorW = ref(_lp.inspectorW)
const logH = ref(_lp.logH)
const paletteCollapsed = ref(_lp.paletteCollapsed || window.innerWidth < 1000)
const inspectorCollapsed = ref(_lp.inspectorCollapsed || window.innerWidth < 1200)
function persistLayout() {
  saveLayout({ paletteW: paletteW.value, inspectorW: inspectorW.value, logH: logH.value,
    paletteCollapsed: paletteCollapsed.value, inspectorCollapsed: inspectorCollapsed.value, logOpen: logOpen.value })
}
function togglePalette() { paletteCollapsed.value = !paletteCollapsed.value; if (window.innerWidth < 1000 && !paletteCollapsed.value) inspectorCollapsed.value = true; persistLayout() }
function toggleInspector() { inspectorCollapsed.value = !inspectorCollapsed.value; if (window.innerWidth < 1000 && !inspectorCollapsed.value) paletteCollapsed.value = true; persistLayout() }
function resetLayout() {
  paletteW.value = LAYOUT_DEFAULTS.paletteW; inspectorW.value = LAYOUT_DEFAULTS.inspectorW; logH.value = LAYOUT_DEFAULTS.logH
  paletteCollapsed.value = window.innerWidth < 1000; inspectorCollapsed.value = window.innerWidth < 1200; logOpen.value = false; persistLayout()
}
let _resize = null
function startResize(which, e) {
  const map = { palette: paletteW, inspector: inspectorW, log: logH }
  _resize = { which, ref: map[which], startPos: which === 'log' ? e.clientY : e.clientX, startVal: map[which].value }
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', endResize)
  e.preventDefault()
}
function onResizeMove(e) {
  if (!_resize) return
  const [min, max] = LAYOUT_BOUNDS[_resize.which === 'palette' ? 'paletteW' : _resize.which === 'inspector' ? 'inspectorW' : 'logH']
  let delta
  if (_resize.which === 'palette') delta = e.clientX - _resize.startPos          // grow right
  else if (_resize.which === 'inspector') delta = _resize.startPos - e.clientX   // grow left
  else delta = _resize.startPos - e.clientY                                      // log grows up
  _resize.ref.value = Math.min(max, Math.max(min, _resize.startVal + delta))
}
function endResize() {
  _resize = null
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', endResize)
  persistLayout()
}

// ── F3: user-visible run/validation log (so users don't need the server terminal) ──
watch(selected, node => { if (node) { inspectorCollapsed.value = false; if (window.innerWidth < 1000) paletteCollapsed.value = true } })
const logOpen = ref(_lp.logOpen)
const logEntries = ref([])
let _loggedKeys = new Set()
function resetLog() { logEntries.value = []; logErrorsOnly.value = false; _loggedKeys = new Set() }
function addLog(level, text) {
  logEntries.value.push({ t: new Date().toLocaleTimeString(), level, text })
  if (logEntries.value.length > 300) logEntries.value.splice(0, logEntries.value.length - 300)
}
function addNodeLog(nodeId, status, extra = '') {
  const key = nodeId + ':' + status
  if (_loggedKeys.has(key)) return        // dedupe across WS + polling
  _loggedKeys.add(key)
  const level = status === 'success' ? 'success'
    : status === 'skipped' ? 'warn' : status === 'running' ? 'info' : 'error'
  addLog(level, `node ${nodeId} → ${status}${extra ? ' · ' + String(extra).slice(0, 140) : ''}`)
}
// ── log UX (Phase 3C): auto-scroll, errors-only filter, copy ──
const logBodyEl = ref(null)
const logErrorsOnly = ref(false)
const visibleLog = computed(() => logErrorsOnly.value ? logEntries.value.filter(e => e.level === 'error') : logEntries.value)
const logErrorCount = computed(() => logEntries.value.filter(e => e.level === 'error').length)
watch(() => logEntries.value.length, () => {
  nextTick(() => { const el = logBodyEl.value; if (el) el.scrollTop = el.scrollHeight })   // pin to latest
})
async function copyLog() {
  const text = logEntries.value.map(e => `[${e.t}] ${e.level}: ${e.text}`).join('\n')
  try { await navigator.clipboard.writeText(text); notify.success('Logs copied') } catch { notify.error('Copy failed') }
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text || ''); notify.success('Copied') } catch { notify.error('Copy failed') }
}

const palette = wfPaletteItems()   // from the central registry
const PALETTE_SORT = {
  'trigger.webhook': 1,
  'trigger.schedule': 2,
  'trigger.channel': 3,
  'trigger.manual': 4,
  'agent.run': 1,
  'action.channel': 1,
  'action.http': 2,
  'action.tool': 3,
  'action.script': 4,
  'action.subworkflow': 5,
  'logic.condition': 1,
  'logic.approval': 2,
  'logic.foreach': 3,
  'logic.delay': 4,
}

// ── left palette sidebar: searchable, category-grouped (base nodes; tools/MCP live in the + modal) ──
const sidebarSearch = ref('')
const SIDEBAR_GROUPS = [
  { key: 'media', label: 'Studio media' },
  { key: 'trigger', label: 'Triggers' }, { key: 'agent', label: 'AI / Agents' },
  { key: 'action', label: 'Actions' }, { key: 'logic', label: 'Logic' },
]
const sidebarGroups = computed(() => {
  const q = sidebarSearch.value.trim().toLowerCase()
  const m = (...s) => !q || s.filter(Boolean).some(x => String(x).toLowerCase().includes(q))
  return SIDEBAR_GROUPS
    .map(g => ({ ...g, items: palette
      .filter(p => (p.type === 'llm.call' ? 'agent' : p.type.split('.')[0]) === g.key && m(p.label, p.sub, p.type))
      .sort((a, b) => (PALETTE_SORT[a.type] || 99) - (PALETTE_SORT[b.type] || 99)) }))
    .filter(g => g.items.length)
})

// canvas empty-state quick-add (normal node creation logic, placed at canvas centre)
const nodeCount = computed(() => getNodes.value.length)
function addQuick(type) {
  if (loading.value || loadError.value) return
  const id = newId()
  addNodes([{ id, type, position: freeWorkflowPosition(getNodes.value, _canvasCenter()), data: defaultData(type) }])
  markDirty()
  selected.value = getNodes.value.find(n => n.id === id) || null
  selectedEdge.value = null
}

function selectNode(id) {
  selected.value = getNodes.value.find(n => n.id === id) || null
  selectedEdge.value = null
}

// logs dock
function toggleLog() { logOpen.value = !logOpen.value; persistLayout() }
const runSummary = computed(() => {
  if (running.value) return 'Running…'
  const r = runDetail.value || runs.value[0]
  if (!r) return 'No runs yet'
  const dur = r.duration_ms != null ? ' · ' + fmtDuration(r.duration_ms) : ''
  return `Run #${r.id} · ${r.status}${dur}`
})

// example/demo canvases are dev-only helpers (not shown to end users)

// ── live run overlay (banner + timeline) driven by the real run detail ──
const timelineOpen = ref(true)
const NODE_STATUS_ICON = {
  success: 'lucide:check-circle-2', running: 'lucide:loader-2', failed: 'lucide:x-circle',
  waiting: 'lucide:pause-circle', skipped: 'lucide:minus-circle', pending: 'lucide:circle-dashed',
}
function statusIcon(s) { return NODE_STATUS_ICON[s] || 'lucide:circle-dashed' }
function fmtClock(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }) }
  catch { return '—' }
}
const nodeRuns = computed(() => (runDetail.value?.node_runs) || [])

/**
 * Attempt history for the timeline (ADM-278).
 *
 * `runDetail.node_runs` is a PROJECTION: one row per node, showing only the LATEST attempt. That is
 * right for watching a live run and lossy for a post-mortem — a node that failed twice and then
 * succeeded shows only the success, so "did the earlier try already reach the provider?" becomes
 * unanswerable from the canvas. `attemptRows` prefers the full attempt feed when the run detail
 * carries it and falls back to the projection otherwise, so an older API response still renders.
 *
 * The attempt vocabulary (`succeeded`) is mapped to the projection's (`success`) here, because every
 * icon, colour and filter downstream is keyed on the latter.
 */
const ATTEMPT_STATE = {
  succeeded: 'success', failed: 'failed', skipped: 'skipped', waiting: 'waiting',
  running: 'running', leased: 'running', pending: 'pending', reconciling: 'running', dead: 'failed',
}
const attemptRows = computed(() => {
  const attempts = runDetail.value?.timeline
  if (!Array.isArray(attempts) || !attempts.length) return null
  return attempts.map(a => ({
    node_id: a.node_id,
    node_type: a.node_type,
    status: ATTEMPT_STATE[a.status] || a.status,
    duration_ms: a.duration_ms,
    started_at: a.started_at,
    attempt: a.attempt,
    superseded: a.superseded,
    error_code: a.error_code,
  }))
})

const timelineRows = computed(() => (attemptRows.value || nodeRuns.value).map((nr, i) => {
  const node = getNodes.value.find(n => n.id === nr.node_id)
  const st = nr.status || 'pending'
  const dur = nr.duration_ms != null ? fmtDuration(nr.duration_ms) : (st === 'running' ? 'Running…' : st)
  // A retried node appears more than once, so the key cannot be the node id alone — Vue would reuse
  // one row for every attempt and only the last would render.
  const attemptNo = nr.attempt || 1
  return {
    id: `${nr.node_id}#${attemptNo}#${i}`,
    nodeId: nr.node_id,
    time: fmtClock(nr.started_at),
    icon: statusIcon(st),
    state: st,
    title: node?.data?.label || nodeLabel(nr.node_type) || nr.node_id,
    sub: nodeSubtitle(nr.node_type) || nr.node_type,
    // Attempt number only when there IS more than one — noise on the common path otherwise.
    status: attemptNo > 1 ? `${dur} · try ${attemptNo}` : dur,
    running: st === 'running',
    superseded: !!nr.superseded,
    errorCode: nr.error_code || '',
  }
}))
const runStats = computed(() => {
  const rows = nodeRuns.value
  const by = s => rows.filter(r => r.status === s).length
  return {
    total: getNodes.value.length || rows.length,
    completed: by('success'),
    running: by('running') + by('waiting'),
    warnings: by('skipped'),
    failed: by('failed'),
  }
})
const runBannerTitle = computed(() => {
  const dry = runDetail.value ? runDetail.value.dry_run : pendingDry.value
  return dry ? 'Test run in progress' : 'Run in progress'
})
const runStartedLabel = computed(() => {
  const r = runDetail.value
  if (!r) return ''
  const started = fmtClock(r.started_at || r.created_at)
  return `Started ${started}${activeRunId.value ? ' · Run ID: ' + activeRunId.value : ''}`
})

// ── command-palette (Add node) state + catalog ──
const showPalette = ref(false)
const paletteSearch = ref('')
const paletteLoading = ref(false)
const catalogTools = ref([])     // [{name, category, description}] from /tools/
const mcpCatalog = ref({ enabled: false, servers: [] })  // {enabled, servers:[{id,name,slug,tools:[{name,description}]}]}
const palSearchEl = ref(null)
const mcpPick = ref(null)        // pending MCP-tool selection awaiting an agent context
const quickAddSource = ref(null) // node id a quick-add (+) will auto-connect the new node from
// WfNode's hover "+" calls this → open palette pre-wired to connect from that node.
provide('wfQuickAdd', (sourceId) => openPalette(sourceId))
let _catalogLoaded = false

const NODE_GROUPS = [
  { key: 'media', label: 'Studio media' },
  { key: 'trigger', label: 'Triggers' },
  { key: 'agent', label: 'AI / Agents' },
  { key: 'action', label: 'Actions' },
  { key: 'logic', label: 'Logic' },
]
const activePaletteTab = ref('all'), showFeatured = ref(true)
const paletteTabs = [
  { key: 'all', label: 'All' },
  { key: 'trigger', label: 'Triggers' },
  { key: 'agent', label: 'AI / Agents' },
  { key: 'action', label: 'Actions' },
  { key: 'logic', label: 'Logic' },
  { key: 'media', label: 'Media' },
  { key: 'integrations', label: 'Integrations' },
]

function _prettyCat(c) { return String(c || 'other').replace(/[._-]/g, ' ').replace(/\b\w/g, m => m.toUpperCase()) }
const _CONNECTOR_CATS = new Set(['service', 'remote', 'github', 'slack', 'notion', 'gmail', 'mcp'])

const paletteGroups = computed(() => {
  const q = paletteSearch.value.trim().toLowerCase()
  const match = (...s) => !q || s.filter(Boolean).some(x => String(x).toLowerCase().includes(q))
  const groups = []
  // base node types, grouped by family (exclude action.mcp_tool — reached via the MCP drill-in)
  for (const g of NODE_GROUPS) {
    const items = palette.filter(p => (p.type === 'llm.call' ? 'agent' : p.type.split('.')[0]) === g.key && p.type !== 'action.mcp_tool' && match(p.label, p.sub, p.type))
      .map(p => ({ key: p.type, icon: p.icon, label: p.label, sub: p.sub, family: g.key, kind: 'node', nodeType: p.type }))
    if (items.length) groups.push({ key: g.key, label: g.label, items, collapsible: false })
  }
  // tools & APIs — grouped by category (collapsed by default; one section per category/connector)
  const byCat = {}
  for (const t of catalogTools.value) {
    if (!match(t.name, t.description, t.category, t.category_label)) continue
    const cat = t.category || 'other'
    if (!byCat[cat]) byCat[cat] = { label: t.category_label || _prettyCat(cat), items: [] }
    byCat[cat].items.push({ key: 'tool:' + t.name, icon: _CONNECTOR_CATS.has(cat) ? '🔌' : '🛠️',
      label: t.name, sub: t.description || cat, family: 'action', kind: 'tool', toolName: t.name,
      badge: _CONNECTOR_CATS.has(cat) ? 'connector' : null })
  }
  for (const cat of Object.keys(byCat).sort()) {
    groups.push({ key: 'toolcat:' + cat, label: 'Tools · ' + byCat[cat].label,
                  items: byCat[cat].items.slice(0, 50), collapsible: true })
  }
  // MCP servers → one collapsible section per server. Server row = Run agent (AI decides);
  // individual tool = deterministic action.mcp_tool (after choosing an agent context).
  if (mcpCatalog.value.enabled) {
    for (const s of (mcpCatalog.value.servers || [])) {
      const items = []
      if (match(s.name, s.slug))
        items.push({ key: 'mcpsrv:' + s.id, icon: '🧩', label: `${s.name} (whole server)`,
                     sub: 'AI decides — Run agent', family: 'agent', kind: 'mcp-server', mcpName: s.name, badge: 'via agent' })
      for (const t of (s.tools || [])) {
        if (match(t.name, t.description, s.name))
          items.push({ key: `mcptool:${s.id}:${t.name}`, icon: '🔧', label: t.name,
                       sub: t.description || 'deterministic MCP tool', family: 'action', kind: 'mcp-tool',
                       serverId: s.id, serverName: s.name, toolName: t.name, badge: 'deterministic' })
      }
      if (items.length) groups.push({ key: 'mcp:' + s.id, label: 'MCP · ' + s.name, items, collapsible: true })
    }
  }
  return groups
})

const paletteSearching = computed(() => !!paletteSearch.value.trim())
const visiblePaletteGroups = computed(() => {
  const tab = activePaletteTab.value
  if (tab === 'all') return paletteGroups.value
  if (tab === 'integrations') return paletteGroups.value.filter(g => g.key.startsWith('toolcat:') || g.key.startsWith('mcp:'))
  if (tab === 'data') {
    const dataNames = new Set(['Transform data', 'Extract data', 'Database lookup', 'Set variable'])
    return paletteGroups.value
      .map(g => ({ ...g, items: g.items.filter(it => dataNames.has(it.label) || /data|database|variable|extract|transform/i.test(`${it.label} ${it.sub}`)) }))
      .filter(g => g.items.length)
  }
  return paletteGroups.value.filter(g => g.key === tab)
})
const featuredPaletteItems = computed(() => {
  if (paletteSearching.value || !showFeatured.value || activePaletteTab.value !== 'all') return []
  const wanted = ['Webhook', 'Schedule', 'Run agent', 'Send to channel']
  const all = paletteGroups.value.flatMap(g => g.items)
  return wanted.map(name => all.find(it => it.label === name)).filter(Boolean)
})
const openGroups = ref(new Set())
function isGroupOpen(g) { return !g.collapsible || paletteSearching.value || openGroups.value.has(g.key) }
function toggleGroup(g) {
  const s = new Set(openGroups.value)
  s.has(g.key) ? s.delete(g.key) : s.add(g.key)
  openGroups.value = s
}

// agents that can run an MCP tool (Phase 1: any owned agent; backend enforces the assigned-tool filter)
const mcpAgentOptions = computed(() => agents.value)

async function openPalette(fromNodeId = null) {
  quickAddSource.value = typeof fromNodeId === 'string' ? fromNodeId : null   // null on the normal "+ Add node"
  showPalette.value = true
  paletteSearch.value = ''
  activePaletteTab.value = 'all'; showFeatured.value = true
  mcpPick.value = null
  await nextTick(); palSearchEl.value?.focus()
  if (_catalogLoaded) return
  paletteLoading.value = true
  try {
    const [tools, mcp] = await Promise.all([
      fetchToolCatalog().catch(() => ({ data: {} })),
      api.getWorkflowMcpCatalog().catch(() => ({ data: { enabled: false, servers: [] } })),
    ])
    const tl = tools?.data?.tools || tools?.data?.results || tools?.data || []
    catalogTools.value = (Array.isArray(tl) ? tl : []).map(t => ({
      name: t.name || t.tool || '', category: t.category || '', category_label: t.category_label || '',
      description: t.description || '' })).filter(t => t.name)
    mcpCatalog.value = { enabled: !!mcp?.data?.enabled, servers: mcp?.data?.servers || [] }
    _catalogLoaded = true
  } catch { /* catalog is best-effort */ } finally {
    paletteLoading.value = false
  }
}

function _canvasCenter() {
  // place new nodes near the center of the visible canvas
  const el = vueFlowRef?.value
  if (el && screenToFlowCoordinate) {
    const r = el.getBoundingClientRect()
    const center = screenToFlowCoordinate({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); return { x: center.x - 115, y: center.y - 55 }
  }
  return { x: 250 + Math.random() * 80, y: 160 + Math.random() * 80 }
}

function _dropNode(type, data) {
  const id = newId()
  // place near the source node when quick-adding, else canvas centre
  let pos = _canvasCenter()
  const src = quickAddSource.value && getNodes.value.find(n => n.id === quickAddSource.value)
  if (src) pos = { x: (src.position?.x || 0) + 280, y: (src.position?.y || 0) }
  addNodes([{ id, type, position: freeWorkflowPosition(getNodes.value, pos), data }])
  if (src) addEdges([{ id: 'e_' + Date.now().toString(36), source: quickAddSource.value, target: id }])  // auto-connect
  quickAddSource.value = null
  markDirty()
  showPalette.value = false
  mcpPick.value = null
  selected.value = getNodes.value.find(n => n.id === id) || null   // open inspector
  selectedEdge.value = null
}

function addFromPalette(it) {
  if (it.kind === 'tool') {
    _dropNode('action.tool', { ...defaultData('action.tool'), tool: it.toolName, label: it.toolName })
  } else if (it.kind === 'mcp-server') {
    // "AI decides how to use this server" → a Run agent node
    _dropNode('agent.run', { ...defaultData('agent.run'), notes: `Use an agent that has the “${it.mcpName}” MCP server attached.` })
  } else if (it.kind === 'mcp-tool') {
    // deterministic MCP call → first choose an agent context, then drop action.mcp_tool
    mcpPick.value = { serverId: it.serverId, serverName: it.serverName, toolName: it.toolName, agentId: null }
  } else {
    _dropNode(it.nodeType, defaultData(it.nodeType))
  }
}

function confirmMcpPick() {
  const p = mcpPick.value
  if (!p || !p.agentId) return
  const a = agents.value.find(x => x.id === p.agentId)
  _dropNode('action.mcp_tool', {
    ...defaultData('action.mcp_tool'),
    agent_id: p.agentId, agent_name: a?.name || '',
    server_id: p.serverId, server_name: p.serverName,
    tool_name: p.toolName, label: `${p.serverName}: ${p.toolName}`,
  })
}

const dotClass = (s) => ({ success: 'bg-emerald-500', failed: 'bg-red-500', running: 'bg-indigo-500', skipped: 'bg-slate-300', pending: 'bg-amber-400' }[s] || 'bg-slate-300')
const fmt = (t) => { try { return new Date(t).toLocaleString() } catch { return t } }
let editRevision = 0
const markDirty = () => { dirty.value = true; editRevision++ }

function defaultData(type) { return wfDefaultData(type) }   // from the central registry

function newId() { return 'n_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }

// ── drag & drop from palette ──
function onDragStart(e, type) { e.dataTransfer.setData('application/wf-type', type); e.dataTransfer.effectAllowed = 'move' }
function onDrop(e) {
  const type = e.dataTransfer.getData('application/wf-type')
  if (!type) return
  const pos = screenToFlowCoordinate ? screenToFlowCoordinate({ x: e.clientX, y: e.clientY }) : { x: e.offsetX, y: e.offsetY }
  addNodes([{ id: newId(), type, position: pos, data: defaultData(type) }])
  markDirty()
}

onConnect((params) => { addEdges([{ ...params, id: 'e_' + Date.now().toString(36) }]); markDirty() })
vfOnNodeClick(({ node }) => { selected.value = node; selectedEdge.value = null })
vfOnEdgeClick(({ edge }) => { selectedEdge.value = edge; selected.value = null })

function onNodeClick() { /* handled by vfOnNodeClick */ }
function onAgentPicked() {
  const a = agents.value.find(x => x.id === selected.value.data.agent_id)
  if (a) selected.value.data.agent_name = a.name
  markDirty()
}
function onMcpAgentPicked() {
  const a = agents.value.find(x => x.id === selected.value.data.agent_id)
  if (a) selected.value.data.agent_name = a.name
  markDirty()
}

// ── Data Picker (visual variable insertion) ──
const showDataPicker = ref(false)
const activeField = ref(null)   // { key, start, end } — which inspector field receives the insert
function onFieldBlur(key, e) {
  const el = e?.target
  activeField.value = { key, start: el?.selectionStart ?? null, end: el?.selectionEnd ?? null }
}
function openDataPicker(key) {
  if (!activeField.value || activeField.value.key !== key) activeField.value = { key, start: null, end: null }
  showDataPicker.value = true
}
function insertExpr(expr) {
  const f = activeField.value
  if (!f || !selected.value) { showDataPicker.value = false; return }
  const cur = String(selected.value.data[f.key] ?? '')
  const s = f.start == null ? cur.length : f.start
  const e = f.end == null ? cur.length : f.end
  selected.value.data[f.key] = cur.slice(0, s) + expr + cur.slice(e)
  markDirty()
  showDataPicker.value = false
}

function _ancestorIds(id) {
  const rev = {}
  getEdges.value.forEach(e => { (rev[e.target] ||= []).push(e.source) })
  const seen = new Set(), stack = [...(rev[id] || [])]
  while (stack.length) { const c = stack.pop(); if (seen.has(c)) continue; seen.add(c); (rev[c] || []).forEach(x => stack.push(x)) }
  return seen
}
function _flattenPaths(obj, prefix = '', out = [], depth = 0) {
  if (depth > 4 || out.length > 60) return out
  if (Array.isArray(obj)) {
    obj.slice(0, 3).forEach((v, i) => _flattenPaths(v, `${prefix}[${i}]`, out, depth + 1))
  } else if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj).slice(0, 30)) {
      if (k === 'usage') continue
      _flattenPaths(obj[k], prefix ? `${prefix}.${k}` : k, out, depth + 1)
    }
  } else {
    out.push({ path: prefix, value: obj })
  }
  return out
}
function _sampleStr(v) {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  return s.length > 40 ? s.slice(0, 40) + '…' : s
}
// Output-tree sources for the Data Picker: trigger/inputs + upstream node outputs (+ loop item).
// Sample = live last-run output → agent schema fields → registry outputSample → {text:'…'} fallback.
const pickerSources = computed(() => {
  if (!selected.value) return []
  const out = []
  const inputs = (getNodes.value.find(n => n.type === 'trigger.manual')?.data?.inputs || []).filter(i => i.key)
  if (inputs.length) {
    const sample = {}; inputs.forEach(i => { sample[i.key] = i.default ?? '' })
    out.push({ id: 'trigger', base: 'trigger', root: { key: 'trigger', value: sample, path: '' } })
    out.push({ id: 'vars', base: 'vars', root: { key: 'vars', value: sample, path: '' } })
  }
  const anc = _ancestorIds(selected.value.id)
  const byId = {}; (runDetail.value?.node_runs || []).forEach(nr => { byId[nr.node_id] = nr })
  for (const n of getNodes.value) {
    if (!anc.has(n.id) || n.type.startsWith('trigger.')) continue
    const live = byId[n.id]?.output
    let sample
    if (live && Object.keys(live).length) sample = live
    else if (n.type === 'agent.run' && (n.data.output_schema || []).length) {
      sample = {}; (n.data.output_schema || []).forEach(f => { if (f.name) sample[f.name] = `(${f.type || 'string'})` })
    } else sample = wfOutputSample(n.type) || { text: '(run to capture sample)' }
    out.push({ id: n.id, base: `nodes.${n.id}.output`, root: { key: n.data.label || n.type, value: sample, path: '' } })
  }
  if ([...anc].some(id => getNodes.value.find(n => n.id === id)?.type === 'logic.foreach'))
    out.push({ id: 'item', base: 'item', root: { key: 'item', value: '(current item)', path: '' } })
  return out
})

function runUpTo(nodeId) { runGraph(true, nodeId) }

// ── Node Output panel ──
const opTab = ref('output')
const selectedNodeRun = computed(() => {
  if (!selected.value) return null
  return (runDetail.value?.node_runs || []).find(nr => nr.node_id === selected.value.id) || null
})
const nodeRunView = computed(() => {
  const nr = selectedNodeRun.value
  if (!nr) return ''
  const v = opTab.value === 'input' ? nr.input : opTab.value === 'error' ? (nr.error || '(none)') : nr.output
  try { return typeof v === 'string' ? v : JSON.stringify(v, null, 2) } catch { return String(v) }
})

function deleteSelected() {
  if (!selected.value) return
  removeNodes([selected.value.id])
  selected.value = null
  markDirty()
}

function conditionRows(node) {
  if (!node?.data.conditions?.length) {
    node.data.conditions = [{ field: '', operator: '=', value: '' }]
  }
  return node.data.conditions
}
function conditionJoin(node) { return String(node?.data?.join || 'AND').toUpperCase() }
// reset the foreach inner-action config when its type changes (avoids stale fields from the old type)
function onForeachTypeChange() {
  const node = selected.value
  if (!node?.data?.do) return
  const t = node.data.do.type
  const seed = {
    'action.channel': { kind: 'log', message: 'item {{item}}' },
    'action.tool': { tool: '', params_json: '{}' },
    'action.http': { method: 'GET', url: '' },
    'agent.run': { agent_id: undefined, prompt: 'Process {{item}}' },
    'action.subworkflow': { graph_id: undefined },
  }[t] || {}
  node.data.do.data = seed
  markDirty()
}
function addCondition() {
  if (!selected.value) return
  conditionRows(selected.value).push({ field: '', operator: '=', value: '' })
  markDirty()
}
function removeCondition(index) {
  if (!selected.value) return
  conditionRows(selected.value).splice(index, 1)
  markDirty()
}
function conditionSummary(data) {
  const rows = data?.conditions?.length ? data.conditions : []
  const joiner = String(data?.join || 'AND').toUpperCase() === 'OR' ? ' or ' : ' and '
  return rows.map(r => `${r.field || 'field'} ${r.operator || '='} ${r.value || 'value'}`).join(joiner) || 'No conditions configured'
}
// suggest {{nodes.<id>.output...}} / {{trigger...}} / {{vars...}} variables for the field datalist
const conditionVarSuggestions = computed(() => {
  const out = ['{{trigger.}}', '{{vars.}}']
  for (const n of getNodes.value) {
    if (selected.value && n.id === selected.value.id) continue
    out.push(`{{nodes.${n.id}.output.text}}`)
  }
  return out
})

// ── edge labels ──
const edgeLabel = computed({
  get: () => selectedEdge.value?.label || '',
  set: (v) => { if (selectedEdge.value) selectedEdge.value.label = v },
})
function onEdgeLabel() { markDirty() }
function deleteEdge() {
  if (!selectedEdge.value) return
  removeEdges([selectedEdge.value.id])
  selectedEdge.value = null
  markDirty()
}

// ── copy / paste selected nodes (Ctrl/Cmd+C / +V) ──
function copySelection() {
  const sel = getNodes.value.filter(n => n.selected)
  if (!sel.length) return
  clipboard = sel.map(n => ({ type: n.type, data: JSON.parse(JSON.stringify(n.data || {})),
                              position: { ...n.position }, _oldId: n.id }))
}
function pasteSelection() {
  if (!clipboard.length) return
  const idMap = {}
  const left = Math.min(...clipboard.map(c => c.position.x)), top = Math.min(...clipboard.map(c => c.position.y))
  const size = { width: Math.max(...clipboard.map(c => c.position.x)) - left + 250, height: Math.max(...clipboard.map(c => c.position.y)) - top + 130 }
  const origin = freeWorkflowPosition(getNodes.value, { x: left + 48, y: top + 48 }, size)
  const fresh = clipboard.map(c => {
    const id = newId(); idMap[c._oldId] = id
    const { __status, __error, ...data } = JSON.parse(JSON.stringify(c.data))
    return { id, type: c.type, position: { x: origin.x + c.position.x - left, y: origin.y + c.position.y - top }, data }
  })
  addNodes(fresh)
  // copy edges that were internal to the selection
  const oldIds = new Set(clipboard.map(c => c._oldId))
  const internal = getEdges.value.filter(e => oldIds.has(e.source) && oldIds.has(e.target))
  addEdges(internal.map(e => ({
    id: 'e_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    source: idMap[e.source], target: idMap[e.target],
    sourceHandle: e.sourceHandle, targetHandle: e.targetHandle, label: e.label,
  })))
  markDirty()
}
const modalOpen = computed(() => showPalette.value || showDataPicker.value || showRuns.value || showVersions.value || showRunForm.value || showHelp.value)
let returnFocus = null
watch(modalOpen, async open => {
  if (open) {
    returnFocus = document.activeElement
    await nextTick()
    const dialog = builderRoot.value?.querySelector('[role="dialog"]')
    dialog?.querySelector('input,select,button:not(:disabled)')?.focus()
  } else { returnFocus?.focus?.(); returnFocus = null }
})
function onKeydown(e) {
  if (e.defaultPrevented || document.querySelector('[role="alertdialog"]')) return
  const externalDialog = document.querySelector('[aria-modal="true"]')
  if (externalDialog && !builderRoot.value?.contains(externalDialog)) return
  if (e.key === 'Escape') {
    if (menuOpen.value) menuOpen.value = false
    else if (showDataPicker.value) showDataPicker.value = false
    else if (showPalette.value) showPalette.value = false
    else if (showHelp.value) showHelp.value = false
    else if (showRunForm.value) showRunForm.value = false
    else if (showVersions.value) showVersions.value = false
    else if (showRuns.value) showRuns.value = false
    else { selected.value = null; selectedEdge.value = null }
    e.preventDefault(); return
  }
  if (modalOpen.value) {
    if (e.key === 'Tab') {
      const dialog = builderRoot.value?.querySelector('[role="dialog"]')
      const items = [...(dialog?.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]') || [])].filter(el => !el.hidden && el.getClientRects().length)
      const first = items[0], last = items.at(-1)
      if (!items.length) { e.preventDefault(); dialog?.focus() }
      else if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { e.preventDefault(); first.focus() }
    }
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); e.stopImmediatePropagation(); if (!loading.value && !loadError.value) openPalette(); return }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); e.stopImmediatePropagation(); if (!actionsDisabled.value) save(); return }
  const tag = (e.target?.tagName || '').toLowerCase()
  if (['input','textarea','select','button'].includes(tag) || e.target?.isContentEditable) return
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selected.value) { e.preventDefault(); deleteSelected() }
    else if (selectedEdge.value) { e.preventDefault(); deleteEdge() }
    return
  }
  if (!(e.ctrlKey || e.metaKey)) return
  if (e.key === 'c') copySelection()
  else if (e.key === 'v') pasteSelection()
}
function beforeUnload(e) { if (dirty.value) { e.preventDefault(); e.returnValue = '' } }
onBeforeRouteLeave(() => !dirty.value || confirm({ title: 'Leave without saving?', message: 'Your unsaved workflow changes will be lost.', confirmText: 'Leave', danger: true }))

async function load() {
  loading.value = true; loadError.value = ''
  try {
    // One /workflow-graphs/<id>/bundle/ round-trip (graph + all_graphs + agents)
    // instead of 3 parallel calls. Fall back to the separate calls if unavailable.
    let g, ag, allG, scr
    try {
      const { data } = await api.getWorkflowGraphBundle(graphId)
      g = data.graph
      ag = data.agents
      allG = data.all_graphs
      scr = data.scripts
    } catch (bundleErr) {
      const [{ data: gd }, { data: agd }, gl, sl] = await Promise.all([
        api.getWorkflowGraph(graphId),
        api.getAgents().catch(() => ({ data: [] })),
        api.getWorkflowGraphs().catch(() => ({ data: [] })),
        api.get('/scripts/').catch(() => ({ data: [] })),
      ])
      g = gd; ag = agd; allG = gl?.data; scr = sl?.data
    }
    if (unmounted) return
    name.value = g.name
    version.value = g.version || 1
    etag.value = g.etag || ''
    wfStatus.value = g.status || 'draft'
    graphTriggers.value = g.triggers || []
    agents.value = (ag?.results || ag || [])
    // The bundle's agent slice is the FIRST page of the paginated agent list. When there are more, the
    // agent.run picker would silently miss every agent past it, so read the full list.
    if (ag && !Array.isArray(ag) && ag.next) {
      try { agents.value = await fetchAllAgents(api) } catch { /* keep the first page */ }
    }
    allGraphs.value = (allG?.results || allG || [])
    scripts.value = (scr?.results || scr || [])
    const graph = g.graph || {}
    const graphNodes = graph.nodes || []
    savedViewport = Number.isFinite(graph.viewport?.zoom) ? graph.viewport : null
    initialFitPending = true
    setNodes(graphNodes.map(n => ({ ...n, data: hydrate(n.type, n.data || {}) })))
    setEdges(graph.edges || [])
    selected.value = null; selectedEdge.value = null
    loadToolNames()
    dirty.value = false
    _takeSnapshot(g.name, graph)   // baseline for Reset
  } catch (e) {
    loadError.value = 'Could not load this workflow. Your saved workflow has not been changed.'
  } finally {
    loading.value = false
  }
}

// ── dirty Save / Reset (Phase 3A) ──
function _takeSnapshot(nm, graph) {
  try { savedSnapshot.value = JSON.parse(JSON.stringify({ name: nm, graph: graph || currentGraph() })) }
  catch { savedSnapshot.value = { name: nm, graph: graph || currentGraph() } }
}
async function resetChanges() {
  if (!dirty.value || !savedSnapshot.value) return
  if (!(await confirm({ title: 'Discard unsaved changes?', message: 'Revert this workflow to the last saved version?', confirmText: 'Discard', danger: true }))) return
  const snap = savedSnapshot.value
  name.value = snap.name
  setNodes((snap.graph.nodes || []).map(n => ({ ...n, data: hydrate(n.type, n.data || {}) })))
  setEdges(snap.graph.edges || [])
  if (snap.graph.viewport && setViewport) { try { setViewport(snap.graph.viewport) } catch {} }
  selected.value = null; selectedEdge.value = null
  dirty.value = false
  notify.info('Reverted to last saved version')
}

// ── inline workflow rename (Phase 3A) ──
function startRename() { nameDraft.value = name.value; renaming.value = true; nextTick(() => nameInputEl.value?.focus()) }
function commitRename() {
  const v = (nameDraft.value || '').trim()
  if (v && v !== name.value) { name.value = v; markDirty() }
  renaming.value = false
}
function cancelRename() { renaming.value = false }

// hydrate stored node data into the editable shape (object → JSON-text fields for the inspector)
function hydrate(type, data) {
  if (type === 'media.generate') return hydrateMediaNode(data)
  const d = { ...(data || {}) }
  if (type === 'action.tool') d.params_json = JSON.stringify(d.params || {}, null, 2)
  if (type === 'action.mcp_tool') d.params_json = JSON.stringify(d.params || {}, null, 2)
  // Empty string rather than '{}' when there is no schema: a literal {} in the box reads as
  // "a schema requiring nothing", which is a different statement from "no schema".
  if (type === 'llm.call') d.output_schema_json = d.output_schema ? JSON.stringify(d.output_schema, null, 2) : ''
  if (type === 'action.http') d.json_text = d.json ? JSON.stringify(d.json, null, 2) : ''
  // Empty rather than '{}' when there are no filters: a literal {} reads as "filters that match
  // everything", which is what an empty filter set already means — showing it invites someone to
  // treat the box as required and start typing into it.
  if (type === 'trigger.connector') {
    d.filters_json = (d.filters && Object.keys(d.filters).length) ? JSON.stringify(d.filters, null, 2) : ''
  }
  if (type === 'logic.foreach') {
    d.do = d.do || { type: 'action.channel', data: { kind: 'log', message: 'item {{item}}' } }
    d.do.data = d.do.data || {}
    if (d.do.type === 'action.tool') d.do.data.params_json = JSON.stringify(d.do.data.params || {}, null, 2)
  }
  return d
}
// serialize editable node data back to the backend shape (JSON-text fields → objects; drop UI meta)
function serializeData(type, data) {
  if (type === 'media.generate') return serializeMediaNode(data)
  const { __status, __error, params_json, json_text, output_schema_json, filters_json, ...rest } = (data || {})
  if (type === 'action.tool' || type === 'action.mcp_tool') {
    rest.params = workflowJson(params_json, rest.params || {}, {}, 'Parameters')
  }
  if (type === 'action.http') {
    const body = workflowJson(json_text, rest.json, undefined, 'JSON body')
    if (body === undefined) delete rest.json
    else rest.json = body
  }
  if (type === 'trigger.connector') rest.filters = workflowJson(filters_json, rest.filters || {}, {}, 'Resource filters')
  if (type === 'llm.call') {
    const schema = workflowJson(output_schema_json, rest.output_schema, undefined, 'Output schema')
    if (schema === undefined) delete rest.output_schema
    else rest.output_schema = schema
  }
  if (type === 'logic.foreach' && rest.do) {
    const inner = { type: rest.do.type, data: { ...(rest.do.data || {}) } }
    if (inner.type === 'action.tool') {
      const pj = inner.data.params_json
      inner.data.params = workflowJson(pj, inner.data.params || {}, {}, 'Inner tool parameters')
      delete inner.data.params_json
    }
    rest.do = inner
  }
  return rest
}
function currentGraph() {
  const obj = toObject()
  return {
    nodes: (obj.nodes || []).map(n => {
      try { return { id: n.id, type: n.type, position: n.position, data: serializeData(n.type, n.data) } }
      catch (error) {
        const message = error instanceof WorkflowInputError ? error.message : 'Enter valid JSON in this node.'
        const node = getNodes.value.find(row => row.id === n.id)
        if (node) { node.data.__error = message; selected.value = node; inspectorCollapsed.value = false }
        throw new WorkflowInputError(message)
      }
    }),
    edges: (obj.edges || []).map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle, ...(e.label ? { label: e.label } : {}) })),
    viewport: obj.viewport || {},
  }
}
// ONE /tools/ download per page: the field datalist (loadToolNames) and the Add-node palette both read
// the same catalog, which used to be fetched twice.
let _toolCatalogPromise = null
function fetchToolCatalog() {
  if (!_toolCatalogPromise) {
    _toolCatalogPromise = api.get('/tools/').catch((e) => { _toolCatalogPromise = null; throw e })
  }
  return _toolCatalogPromise
}
async function loadToolNames() {
  try {
    const { data } = await fetchToolCatalog()
    const list = data?.tools || data?.results || data || []
    toolNames.value = list.map(t => (typeof t === 'string' ? t : (t.name || t.tool || ''))).filter(Boolean)
  } catch { /* optional */ }
}

// Applies whatever the server returned so the next save carries a fresh token. Without this the etag
// goes stale after the FIRST save and every subsequent one is refused as a conflict.
function _absorb(data) {
  if (!data) return
  version.value = data.version || version.value
  if (data.etag) etag.value = data.etag
  if (data.status) wfStatus.value = data.status
  graphTriggers.value = data.triggers || graphTriggers.value   // webhook URLs / schedule status
}

// A conflict is NOT a generic failure: someone else's edit is on the server and the local canvas would
// destroy it. It gets its own message telling the user what to do, and the returned etag is deliberately
// NOT absorbed — adopting it would let the next click overwrite the very edit we just warned about.
function _reportSaveError(e, fallback) {
  if (e instanceof WorkflowInputError) { notify.error(e.message); return }
  const s = e?.response?.status
  const d = e?.response?.data || {}
  if (s === 409 || s === 428) return notify.error(d.error || 'Reload before saving — this workflow changed.')
  if (s === 400 && Array.isArray(d.errors) && d.errors.length) {
    const lines = d.errors.slice(0, 4).map(x => (x.node_id ? `${x.node_id}: ` : '') + (x.message || x))
    return notify.error(`${d.error || 'Validation failed'} — ${lines.join('; ')}`)
  }
  notify.error(d.error || fallback)
}

// Save, Ctrl+S, Publish and Run can all ask to save; a second request while one is in flight joins it
// instead of sending a second PUT with the same (soon stale) etag, which the server refuses as a conflict.
let _savePromise = null
function save() {
  if (loading.value || loadError.value) return Promise.resolve(false)
  if (!_savePromise) _savePromise = _doSave().finally(() => { _savePromise = null })
  return _savePromise
}
async function _doSave() {
  busy.value = true
  try {
    const revision = editRevision, savedName = name.value, graph = JSON.parse(JSON.stringify(currentGraph()))
    const { data } = await api.saveWorkflowGraph(graphId, { name: savedName, graph, etag: etag.value })
    _absorb(data)
    dirty.value = editRevision !== revision
    _takeSnapshot(savedName, graph)   // new Reset baseline
    notify.success('Workflow saved')
    return true
  } catch (e) {
    _reportSaveError(e, 'Failed to save')
    return false
  } finally {
    busy.value = false
  }
}

// SAVE THEN PUBLISH, as two calls. The server validates on publish and refuses a broken graph, so the
// canvas has to be persisted first or the validation would be run against the previously saved version
// and report errors the user cannot see on screen. Publishing freezes an immutable version; that is
// what a TRIGGERED run executes, which is why it is worth the extra round-trip.
async function publish() {
  if (actionsDisabled.value) return
  if (dirty.value && !(await save())) return   // save() already reported why
  if (dirty.value) { notify.info('Save your latest changes before publishing.'); return }
  busy.value = true
  try {
    const { data } = await api.saveWorkflowGraph(graphId, { status: 'published' })
    _absorb(data)
    notify.success(`Published (v${version.value})`)
  } catch (e) {
    _reportSaveError(e, 'Failed to publish')
  } finally {
    busy.value = false
  }
}

// Pause stops NEW runs starting; runs already in flight are left alone, because an operator stopping a
// misfiring schedule must not also destroy work that is halfway done.
async function setLifecycle(next) {
  busy.value = true
  try {
    const { data } = await api.saveWorkflowGraph(graphId, { status: next })
    _absorb(data)
    notify.success(next === 'paused' ? 'Paused — no new runs will start' : `Status: ${wfStatus.value}`)
  } catch (e) {
    _reportSaveError(e, `Failed to set status to ${next}`)
  } finally {
    busy.value = false
  }
}

// Live run status over WebSocket (push); polling (below) remains a fallback for both. A dropped socket
// reconnects until the run finishes (pushed here, or seen by the poller) or the page is left.
function openRunSocket(runId) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  runSocket.connect(() => `${proto}://${location.host}/ws/workflow-graph-run/${runId}/`)
}
function onRunSocketMessage(ev) {
  try {
    const msg = JSON.parse(ev.data); const d = msg.data || {}
    if (d.node_id) {
      const n = getNodes.value.find(x => x.id === d.node_id)
      if (n) n.data.__status = d.status || (msg.event === 'node_started' ? 'running' : n.data.__status)
      if (msg.event === 'node_started') addNodeLog(d.node_id, 'running')
      if (msg.event === 'node_finished') addNodeLog(d.node_id, d.status, (d.output && d.output.text) || d.error || (d.output && d.output.reason) || '')
    }
    if (msg.event === 'run_finished') { running.value = false; addLog(d.status === 'success' ? 'success' : 'error', `■ Run ${d.status || 'finished'}`); runSocket.close(); loadRuns() }
  } catch {}
}

async function validateGraph() {
  busy.value = true
  try {
    getNodes.value.forEach(n => { delete n.data.__error })   // clear old
    const { data } = await api.validateWorkflowGraph(graphId, currentGraph())
    if (data.ok) {
      notify.success(data.warnings?.length ? `Valid — ${data.warnings.length} warning(s)` : 'Graph is valid ✓')
      addLog('success', `✓ Validation passed${data.warnings?.length ? ` (${data.warnings.length} warning(s))` : ''}`)
      for (const w of data.warnings || []) addLog('warn', `warning: ${w.node_id ? w.node_id + ': ' : ''}${w.message}`)
    } else {
      for (const err of data.errors || []) {
        const n = getNodes.value.find(x => x.id === err.node_id)
        if (n) n.data.__error = err.message
        addLog('error', `validation: ${err.node_id ? err.node_id + ': ' : ''}${err.message}`)
      }
      notify.warning(`${(data.errors || []).length} issue(s) — see highlighted nodes`)
    }
    logOpen.value = true
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Validation failed')
  } finally {
    busy.value = false
  }
}

// ── run + live status (poll) ──
function manualInputs() {
  const t = getNodes.value.find(n => n.type === 'trigger.manual')
  return (t?.data?.inputs || []).filter(i => i && i.key)
}
function runGraph(dry = false, until = null) {
  if (actionsDisabled.value || running.value) return
  pendingDry.value = !!dry; pendingUntil.value = until
  const inputs = manualInputs()
  if (inputs.length) {
    runForm.value = Object.fromEntries(inputs.map(i => [i.key, i.default ?? '']))
    runFormFields.value = inputs.map(i => i.key)
    showRunForm.value = true
    return
  }
  startRun({})
}
async function startRun(payload, until = pendingUntil.value) {
  showRunForm.value = false
  const dry = pendingDry.value
  if (starting.value || running.value || loading.value || loadError.value) return
  starting.value = true
  if (dirty.value && !(await save())) { starting.value = false; return }
  if (dirty.value) { starting.value = false; notify.info('Save your latest changes before running.'); return }
  running.value = true
  timelineOpen.value = true
  resetLog(); addLog(dry ? 'warn' : 'info', until ? `▶ Test up to ${until}` : (dry ? '🧪 Test run (dry-run — no real side-effects)' : '▶ Run started')); logOpen.value = true
  getNodes.value.forEach(n => { n.data.__status = 'pending' })
  try {
    const { data } = await api.runWorkflowGraph(graphId, { payload: payload || {}, dry_run: dry, until_node: until })
    if (!data.run_id) { running.value = false; notify.error('The server did not return a run. Try again.'); return }
    if (unmounted) return   // left the page while the run was starting: no socket or poller for a gone page
    activeRunId.value = data.run_id
    openRunSocket(data.run_id)   // live push
    pollRun(data.run_id)         // fallback / final reconcile
  } catch (e) {
    running.value = false
    const errs = e?.response?.data?.errors
    if (Array.isArray(errs)) {
      for (const err of errs) { const n = getNodes.value.find(x => x.id === err.node_id); if (n) n.data.__error = err.message }
      notify.warning('Graph is invalid — fix highlighted nodes')
    } else {
      notify.error(e?.response?.data?.error || 'Run failed to start')
    }
  } finally { starting.value = false }
}

// Run status poll (fallback to the socket). usePoller gives it: one poll at a time (so the end-of-run
// log and toast cannot fire twice), backoff after an error instead of stopping for good, a pause while
// the tab is hidden, and cancellation on leave. It stops on every state where nothing will change
// without a person: the final ones (success / failed / cancelled / dead) and the ones that wait on a
// human or a long delay (waiting / paused / blocked). Approving restarts it (decide()).
let _pollRunId = null
let mediaResumePending = false
function resumeMediaRun() { if (!runDetail.value?.id) return; mediaResumePending = true; pollRun(runDetail.value.id) }
const _reportedRunEnds = new Set()
const runPoller = usePoller(async ({ signal }) => {
  const runId = _pollRunId
  const { data } = await api.get(`/workflow-graph-runs/${runId}/`, { signal })
  if (runId !== _pollRunId || unmounted) return null
  runDetail.value = data
  const byNode = {}
  for (const nr of data.node_runs || []) byNode[nr.node_id] = nr
  getNodes.value.forEach(n => { if (byNode[n.id]) n.data.__status = byNode[n.id].status })
  // log any node transitions the WS didn't already capture (dedupe handles overlap)
  for (const nr of data.node_runs || []) addNodeLog(nr.node_id, nr.status, (nr.output && nr.output.text) || nr.error || (nr.output && nr.output.reason) || '')
  const kind = runStopKind(data.status)
  if (kind) {
    running.value = false
    if (kind === 'final' && runId === activeRunId.value) runSocket.close()   // a finished run pushes nothing more
    const endKey = `${runId}:${data.status}`
    if (!_reportedRunEnds.has(endKey)) {
      _reportedRunEnds.add(endKey)
      if (kind === 'final') {
        addLog(data.status === 'success' ? 'success' : 'error', `■ Run #${runId}: ${data.status}`)
        notify[data.status === 'success' ? 'success' : 'error'](`Run #${runId}: ${data.status}`)
      } else {
        addLog('warn', `⏸ Run #${runId}: ${data.status} — it continues after a decision or its scheduled delay`)
      }
      loadRuns()
    }
  }
  return data
}, {
  interval: 1200,
  maxInterval: 15000,
  stopWhen: data => {
    if (!data) return false
    if (mediaResumePending && (data.node_runs || []).some(n => n.output?.awaiting_media_job) && runStopKind(data.status) === 'held') return false
    mediaResumePending = false
    return RUN_STOP_STATUSES.includes(data.status)
  },
})
function pollRun(runId) {
  runPoller.stop()
  _pollRunId = runId
  runPoller.start()
}

async function stopRun() {
  if (!activeRunId.value || stopping.value) return
  stopping.value = true
  try { await api.cancelWorkflowGraphRun(activeRunId.value); addLog('warn', 'Stop requested. Waiting for the server to confirm.'); pollRun(activeRunId.value) }
  catch { notify.error('Could not request a stop. Try again.') }
  finally { stopping.value = false }
}

async function rerun(fromNode = null) {
  if (!activeRunId.value) { notify.info('Run the workflow first'); return }
  running.value = true
  resetLog(); addLog('info', fromNode ? `▶ Re-running from ${fromNode}` : '▶ Re-running failed nodes'); logOpen.value = true
  try {
    await api.rerunWorkflowGraphRun(activeRunId.value, fromNode)
    openRunSocket(activeRunId.value)
    pollRun(activeRunId.value)
  } catch (e) {
    running.value = false
    notify.error(e?.response?.data?.error || 'Re-run failed to start')
  }
}

function lastOutputFor(nodeId) {
  const nr = (runDetail.value?.node_runs || []).find(x => x.node_id === nodeId)
  return nr?.output?.text || nr?.error || ''
}

async function loadRuns() {
  historyLoading.value = true; historyError.value = ''
  try { const { data } = await api.getWorkflowGraphRuns(graphId); if (!unmounted) runs.value = data?.results || data || [] }
  catch { if (!unmounted) historyError.value = 'Could not load run history.' }
  finally { if (!unmounted) historyLoading.value = false }
}
async function openRuns() {
  showRuns.value = true
  loadRuns()
  try { const { data } = await api.getWorkflowGraphMetrics(graphId); if (!unmounted) metrics.value = data } catch { metrics.value = null }
}
function fmtDuration(ms) {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}
function fmtCost(c) { return c ? `$${Number(c).toFixed(4)}` : '$0' }

async function openVersions() {
  showVersions.value = true; versionsLoading.value = true; versionsError.value = ''
  try { const { data } = await api.getWorkflowGraphVersions(graphId); if (!unmounted) versions.value = data?.results || data || [] }
  catch { if (!unmounted) versionsError.value = 'Could not load version history.' }
  finally { if (!unmounted) versionsLoading.value = false }
}
async function restoreVersion(v) {
  if (busy.value) return
  if (!(await confirm({ title: 'Restore this version?', message: `Roll the canvas back to v${v.version}? Save your current canvas first if you want to keep it.`, confirmText: 'Restore' }))) return
  busy.value = true
  try {
    const { data } = await api.restoreWorkflowGraphVersion(graphId, v.id)
    _absorb(data)
    // reload the canvas from the restored graph
    const graph = data.graph || {}
    setNodes((graph.nodes || []).map(n => ({ ...n, data: hydrate(n.type, n.data || {}) })))
    setEdges(graph.edges || [])
    if (graph.viewport && setViewport) { try { setViewport(graph.viewport) } catch {} }
    dirty.value = false
    selected.value = null; selectedEdge.value = null
    _takeSnapshot(name.value, graph)
    showVersions.value = false
    // Deliberately NOT "now v<n>". Restoring lands on the DRAFT canvas; triggered runs keep executing
    // the published version until you publish. Saying otherwise is the illusion this used to create.
    notify.success(`Restored v${v.version} onto the canvas — publish to make it live`)
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to restore')
  } finally { busy.value = false }
}
async function openRun(runId) {
  try {
    const { data } = await api.getWorkflowGraphRun(runId)
    runDetail.value = data
    activeRunId.value = runId
    const byNode = {}
    for (const nr of data.node_runs || []) byNode[nr.node_id] = nr
    getNodes.value.forEach(n => { if (byNode[n.id]) n.data.__status = byNode[n.id].status })
    // rebuild the log console from this historical run
    resetLog(); addLog('info', `Viewing Run #${runId} (${data.status})`)
    for (const nr of data.node_runs || []) addNodeLog(nr.node_id, nr.status, (nr.output && nr.output.text) || nr.error || (nr.output && nr.output.reason) || '')
    logOpen.value = true
  } catch { notify.error('Could not load this run. Try again.') }
}

function goBack() { router.push('/dashboard/workflow-builder') }

// ── workflow-level actions (Phase 3B) ──
const menuOpen = ref(false)
async function duplicateWorkflow() {
  if (actionsDisabled.value) return
  if (dirty.value && !(await save())) return
  if (dirty.value) { notify.info('Save your latest changes before duplicating.'); return }
  busy.value = true
  try {
    const { data } = await api.createWorkflowGraph({ name: `${name.value} (copy)`, graph: currentGraph() })
    notify.success('Workflow duplicated')
    router.push(`/dashboard/workflow-builder/${data.id}`)
  } catch { notify.error('Could not duplicate this workflow. Try again.') }
  finally { busy.value = false }
}
async function deleteWorkflow() {
  if (actionsDisabled.value) return
  busy.value = true
  try {
    if (!(await confirm({ title: 'Archive workflow?', message: `Archive "${name.value}"? Run history and budget spend are kept. Unsaved edits will be discarded.`, confirmText: 'Archive', danger: true }))) return
    await api.deleteWorkflowGraph(graphId)
    dirty.value = false
    notify.success('Workflow archived')
    router.push('/dashboard/workflow-builder')
  } catch { notify.error('Could not archive this workflow. Try again.') }
  finally { busy.value = false }
}

// The keydown listener is added BEFORE the first await: added after it, a leave during the load
// attached it to a page that was already gone (and onBeforeUnmount had already run its removal).
let labelsObserver = null, labelSequence = 0
function associateLabels() {
  for (const label of builderRoot.value?.querySelectorAll('label') || []) {
    if (label.htmlFor || label.querySelector('input,textarea,select')) continue
    const next = label.parentElement?.classList.contains('lbl-row') ? label.parentElement.nextElementSibling : label.nextElementSibling
    if (next?.matches('input,textarea,select')) { next.id ||= `workflow-field-${++labelSequence}`; label.htmlFor = next.id }
  }
}
onMounted(async () => {
  window.addEventListener('keydown', onKeydown, true)
  window.addEventListener('beforeunload', beforeUnload)
  labelsObserver = new MutationObserver(associateLabels)
  if (builderRoot.value) labelsObserver.observe(builderRoot.value, { childList: true, subtree: true })
  await load()
  if (unmounted) return
  loadRuns()
})
onBeforeUnmount(() => {
  unmounted = true
  labelsObserver?.disconnect()
  runPoller.stop()
  runSocket.close()
  window.removeEventListener('keydown', onKeydown, true)
  window.removeEventListener('beforeunload', beforeUnload)
  endResize()
})
</script>

<style scoped src="../components/workflows/workflow-builder.css"></style>
