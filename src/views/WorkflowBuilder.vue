<template>
  <div class="wfb-root">
    <!-- Top bar -->
    <div class="wfb-bar">
      <div class="wf-brand" aria-hidden="true"><span></span></div>
      <div class="bar-left">
        <button class="lnk" @click="goBack">Workflows</button>
        <span class="sep">/</span>
        <input v-if="renaming" ref="nameInputEl" v-model="nameDraft" class="name-in"
          @keydown.enter="commitRename" @keydown.esc="cancelRename" @blur="commitRename" />
        <button v-else class="name-display" @click="startRename" title="Click to rename">
          {{ name || 'Customer intake automation' }}<span class="name-edit">✎</span>
        </button>
        <span class="pill draft">Draft</span>
      </div>
      <div class="bar-right">
        <button class="gbtn secondary-action" :class="{ on: logOpen }" @click="toggleLog()">Log</button>
        <button class="gbtn secondary-action" @click="openVersions">Versions</button>
        <button class="gbtn secondary-action" @click="openRuns">Runs</button>
        <button class="gbtn" :disabled="busy" @click="validateGraph"><Icon icon="lucide:shield-check" />Validate</button>
        <button v-if="!running" class="gbtn" :disabled="busy" @click="runGraph(true)" title="Test run"><Icon icon="lucide:flask-conical" />Test</button>
        <button v-if="!running" class="gbtn run" :disabled="busy" @click="runGraph(false)"><Icon icon="lucide:play" />Run</button>
        <button v-else class="gbtn stop" @click="stopRun"><Icon icon="lucide:square" />Stop</button>
        <button v-if="dirty" class="gbtn reset-action" :disabled="busy" @click="resetChanges" title="Discard unsaved changes">Reset</button>
        <button class="gbtn" :disabled="busy" @click="save"><Icon icon="lucide:save" />{{ busy ? 'Saving...' : 'Save' }}</button>
        <button class="gbtn save" :disabled="busy" @click="publish"><Icon icon="lucide:rocket" />Publish</button>
        <div class="wf-menu">
          <button class="gbtn more-btn" @click="menuOpen = !menuOpen" title="More">...</button>
          <div v-if="menuOpen" class="wf-menu-back" @click="menuOpen = false"></div>
          <div v-if="menuOpen" class="wf-menu-pop" @click="menuOpen = false">
            <button @click="duplicateWorkflow">⧉ Duplicate</button>
            <button class="danger" @click="deleteWorkflow">🗑 Delete workflow</button>
            <template v-if="isDev">
              <div class="wf-menu-sep">Examples (dev)</div>
              <button @click="loadOverviewDemo"><Icon icon="lucide:layout-dashboard" /> Overview demo</button>
              <button @click="loadConditionDemo"><Icon icon="lucide:split" /> Branching demo</button>
              <button @click="loadRunDemo"><Icon icon="lucide:activity" /> Run debug demo</button>
            </template>
          </div>
        </div>
      </div>
    </div>

    <div class="wfb-title-strip">
      <div>
        <h1>Workflow Builder</h1>
        <p>Design and automate multi-step agent workflows.</p>
      </div>
      <button class="title-help" @click="openPalette">Browse nodes</button>
    </div>

    <div class="wfb-body">
      <!-- Left palette (resizable, searchable, category-grouped) -->
      <aside v-show="!paletteCollapsed" class="wfb-palette" :style="{ width: paletteW + 'px' }">
        <button class="add-node-btn" @click="openPalette()">＋ Add node <kbd>⌘K</kbd></button>
        <input v-model="sidebarSearch" class="pal-search" placeholder="Search nodes…" />
        <div class="pal-scroll">
          <p v-if="!sidebarGroups.length" class="pal-empty">No nodes match “{{ sidebarSearch }}â€.</p>
          <div v-for="g in sidebarGroups" :key="g.key" class="pal-cat">
            <div class="pal-cat-h">{{ g.label }}</div>
            <div v-for="p in g.items" :key="p.type" class="pal-card" :class="'fam-' + p.type.split('.')[0]"
              draggable="true" @dragstart="onDragStart($event, p.type)" @click="addQuick(p.type)" :title="'Drag to canvas or click to add — ' + p.sub">
              <span class="pal-card-ic"><Icon :icon="wfIcon(p.type)" /></span>
              <span class="pal-card-txt"><span class="pal-card-l">{{ p.label }}</span><span class="pal-card-s">{{ p.sub }}</span></span>
            </div>
          </div>
          <button class="pal-more" @click="openPalette()">Browse tools &amp; MCP →</button>
        </div>
        <div class="pal-footer" aria-label="Workflow builder shortcuts">
          <button title="Docs">□</button>
          <button title="Help">?</button>
          <button title="Settings">⚙</button>
        </div>
      </aside>
      <div v-show="!paletteCollapsed" class="wfb-divider v" @pointerdown="startResize('palette', $event)"></div>
      <button class="wfb-tab tab-left" :title="paletteCollapsed ? 'Show palette' : 'Hide palette'" @click="togglePalette">{{ paletteCollapsed ? '»' : '«' }}</button>

      <!-- Canvas -->
      <div class="canvas-wrap" @drop="onDrop" @dragover.prevent @dragenter.prevent>
        <VueFlow :node-types="nodeTypes" :default-viewport="{ zoom: 1 }" fit-view-on-init
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

        <div v-if="!loading && nodeCount && !guideHidden" class="wfb-guide">
          <button class="guide-x" aria-label="Dismiss guide" @click="guideHidden = true">x</button>
          <h2>How to build your first workflow</h2>
          <p>Follow these steps to get started.</p>
          <div class="guide-steps">
            <span><b>1</b><strong>Add a trigger</strong><em>Drag a trigger node to start your workflow.</em></span>
            <span><b>2</b><strong>Add steps</strong><em>Add actions, agents, or logic to define what happens next.</em></span>
            <span><b>3</b><strong>Connect nodes</strong><em>Drag from the right handle to the left handle of the next node.</em></span>
            <span><b>4</b><strong>Test &amp; run</strong><em>Test your workflow, then run it when ready.</em></span>
          </div>
          <button class="guide-docs" @click="openPalette">Learn more in docs -></button>
        </div>

        <!-- empty canvas hero -->
        <div v-if="!loading && !nodeCount" class="canvas-empty">
          <div class="ce-card">
            <div class="ce-ic">🧩</div>
            <h3 class="ce-title">Build your first workflow</h3>
            <p class="ce-sub">Start with a trigger, then add an agent or action. Drag from the left palette, or pick a starter:</p>
            <div class="ce-btns">
              <button class="ce-btn" @click="addQuick('trigger.manual')">▶ Manual Trigger</button>
              <button class="ce-btn" @click="addQuick('trigger.schedule')">â° Schedule</button>
              <button class="ce-btn" @click="addQuick('trigger.webhook')">🔗 Webhook</button>
              <button class="ce-btn" @click="addQuick('agent.run')">🤖 Agent</button>
              <button class="ce-btn" @click="addQuick('action.http')">ðŸŒ HTTP</button>
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
            <button class="log-btn" :class="{ on: logErrorsOnly }" :disabled="!logErrorCount"
              @click="logErrorsOnly = !logErrorsOnly" :title="logErrorsOnly ? 'Show all' : 'Errors only'">⚠ {{ logErrorCount }}</button>
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
            <button v-for="row in timelineRows" :key="row.id" class="timeline-row"
              :class="{ active: selected && selected.id === row.id }" @click="selectNode(row.id)">
              <span>{{ row.time }}</span>
              <Icon :icon="row.icon" :class="[row.state, { spin: row.running }]" />
              <strong>{{ row.title }}</strong>
              <em>{{ row.sub }}</em>
              <span v-if="row.running" class="tl-badge">Running</span>
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
      <button class="wfb-tab tab-right" :title="inspectorCollapsed ? 'Show inspector' : 'Hide inspector'" @click="toggleInspector">{{ inspectorCollapsed ? '«' : '»' }}</button>

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
            <span class="ins-enabled">Enabled</span>
            <button class="del" @click="deleteSelected" title="Delete node"><Icon icon="lucide:trash-2" /></button>
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
                <button class="kv-del" @click="removeInput(i)">x</button>
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
              <button class="kv-del" @click="removeSchemaField(i)">×</button>
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
                <button class="condition-del" title="Remove condition" @click="removeCondition(i)">
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
              <div class="fallback-box">Route to path B (False)<b>B</b></div>
            </div>

            <div class="condition-section">
              <strong>Summary</strong>
              <span>Leads will go to the True path when the following is true:</span>
              <code>{{ conditionSummary(selected.data) }}</code>
            </div>

            <details class="advanced-row">
              <summary>Advanced options</summary>
              <p>Case sensitive string comparison. <a href="#">Learn more</a></p>
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
          <div class="adv-h" @click="advOpen = !advOpen">{{ advOpen ? '▾' : '▸' }} Advanced · reliability</div>
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

        <div v-if="selected.data.__error" class="ins-err">⚠ {{ selected.data.__error }}</div>

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
          <button class="del" @click="deleteEdge" title="Delete connection">🗑</button>
        </div>
        <label class="ins-l">Edge label</label>
        <input v-model="edgeLabel" class="ins-in" placeholder="e.g. on success" @input="onEdgeLabel" />
        <p class="ins-hint">Labels annotate the wire on the canvas. Branch handles (true/false/on-error) are set by which handle you connect.</p>
      </aside>

      <!-- Inspector empty state -->
      <aside class="inspector wfb-inspector ins-empty-wrap" v-else-if="!inspectorCollapsed" :style="{ width: inspectorW + 'px' }">
        <div class="ins-empty">
          <div class="ins-empty-ic">âš™ï¸</div>
          <p class="ins-empty-t">Nothing selected</p>
          <p class="ins-empty-s">Click a node to configure it, or a connection to label it.</p>
        </div>
      </aside>
    </div>

    <!-- Run history drawer -->
    <div v-if="showRuns" class="drawer-scrim" @click.self="showRuns = false">
      <div class="drawer">
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
        <div v-if="!runs.length" class="drawer-empty">No runs yet. Press ▶ Run.</div>
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
            <div v-else-if="nr.output && (nr.output.text || nr.output.reason)" class="rd-out">{{ nr.output.text || nr.output.reason }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Run-with-inputs modal (manual trigger inputs) -->
    <div v-if="showRunForm" class="modal-scrim" @click.self="showRunForm = false">
      <div class="run-form">
        <div class="rf-h">Run with inputs<button class="x" @click="showRunForm = false">×</button></div>
        <div class="rf-body">
          <div v-for="k in runFormFields" :key="k" class="rf-row">
            <label class="ins-l">{{ k }}</label>
            <input v-model="runForm[k]" class="ins-in" :placeholder="k" />
          </div>
        </div>
        <div class="rf-foot">
          <button class="gbtn" @click="showRunForm = false">Cancel</button>
          <button class="gbtn run" @click="startRun({ ...runForm })">{{ pendingDry ? '🧪 Test' : '▶ Run' }}</button>
        </div>
      </div>
    </div>

    <!-- Version history drawer -->
    <div v-if="showVersions" class="drawer-scrim" @click.self="showVersions = false">
      <div class="drawer">
        <div class="drawer-h">
          <b>Version history</b>
          <button @click="showVersions = false" class="x">×</button>
        </div>
        <p class="ver-hint">Published versions are snapshotted here. Restore rolls the canvas back to that snapshot.</p>
        <div v-if="!versions.length" class="drawer-empty">No saved versions yet. Publish to snapshot one.</div>
        <div v-else class="drawer-list ver-list">
          <div v-for="v in versions" :key="v.id" class="ver-row">
            <div class="ver-info">
              <span class="ver-num">v{{ v.version }}</span>
              <span class="ver-lbl">{{ v.label || 'Published' }}</span>
              <span class="ver-time">{{ fmt(v.created_at) }}</span>
            </div>
            <button class="ver-restore" @click="restoreVersion(v)">Restore</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Command-palette: add node -->
    <div v-if="showPalette" class="modal-scrim pal-scrim" @click.self="showPalette = false">
      <div class="cmd-pal">
        <!-- step 2: choose an agent context for a deterministic MCP tool -->
        <template v-if="mcpPick">
          <div class="cmd-search cmd-back"><button class="cmd-backbtn" @click="mcpPick = null">â†</button> Choose agent context</div>
          <div class="cmd-body cmd-ctx">
            <p class="cmd-ctx-h">{{ mcpPick.serverName }}: <b>{{ mcpPick.toolName }}</b></p>
            <p class="cmd-ctx-note">MCP tools need an agent for credentials &amp; permissions. The agent must have the “{{ mcpPick.serverName }}â€ server attached — the run fails clearly otherwise.</p>
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
              <h2>Add a node</h2>
              <p>Choose a node to add to your workflow.</p>
            </div>
            <button class="cmd-close" @click="showPalette = false" aria-label="Close add node">×</button>
          </div>
          <div class="cmd-search-wrap">
            <svg class="cmd-search-ic" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"/></svg>
            <input ref="palSearchEl" v-model="paletteSearch" class="cmd-search" placeholder="Search nodes..." @keydown.esc="showPalette = false" />
            <kbd>⌘ K</kbd>
          </div>
          <div class="cmd-tabs" role="tablist" aria-label="Node categories">
            <button v-for="tab in paletteTabs" :key="tab.key" type="button" :class="{ active: activePaletteTab === tab.key }" @click="activePaletteTab = tab.key">{{ tab.label }}</button>
          </div>
          <div class="cmd-body">
            <p v-if="paletteLoading" class="cmd-empty">Loading catalog…</p>
            <p v-else-if="!visiblePaletteGroups.length" class="cmd-empty">No matches for "{{ paletteSearch }}".</p>
            <div v-else-if="featuredPaletteItems.length" class="cmd-featured">
              <div class="cmd-section-head">
                <span>Featured</span>
                <button type="button" @click="activePaletteTab = 'all'">View all</button>
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
              <div class="cmd-grp-h" :class="{ 'cmd-grp-toggle': grp.collapsible }" @click="grp.collapsible && toggleGroup(grp)">
                <span v-if="grp.collapsible" class="cmd-caret">{{ isGroupOpen(grp) ? '▾' : '▸' }}</span>
                {{ grp.label }}<span class="cmd-grp-n">{{ grp.items.length }}</span>
              </div>
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
      <div class="cmd-pal">
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
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import WfNode from '../components/workflows/WfNode.vue'
import SchemaForm from '../components/workflows/SchemaForm.vue'
import OutputTree from '../components/workflows/OutputTree.vue'
import { WF_TYPES, wfDef, wfFields, wfPaletteItems, wfDefaultData, wfOutputSample } from '../config/wfNodeDefinitions'
import { loadLayout, saveLayout, LAYOUT_BOUNDS } from '../utils/wfLayoutPrefs'
import api from '../services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'

const route = useRoute()
const router = useRouter()
const graphId = route.params.id

const {
  addNodes, addEdges, onConnect, onNodeClick: vfOnNodeClick, onEdgeClick: vfOnEdgeClick, screenToFlowCoordinate,
  getNodes, getEdges, setNodes, setEdges, removeNodes, removeEdges, toObject, setViewport, vueFlowRef,
} = useVueFlow()

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
  'trigger.webhook': 'lucide:webhook',
  'trigger.schedule': 'lucide:clock-3',
  'trigger.channel': 'lucide:message-square',
  'trigger.manual': 'lucide:square-play',
  'agent.run': 'lucide:bot',
  'action.channel': 'logos:slack-icon',
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
const busy = ref(false)
const running = ref(false)
const dirty = ref(false)
const savedSnapshot = ref(null)   // last-saved { name, graph } for Reset (Phase 3A)
const renaming = ref(false)       // inline workflow-name edit
const nameDraft = ref('')
const nameInputEl = ref(null)
const selected = ref(null)
const agents = ref([])
const guideHidden = ref(false)
const showRuns = ref(false)
const runs = ref([])
const runDetail = ref(null)
const activeRunId = ref(null)
const version = ref(1)
const toolNames = ref([])
const graphTriggers = ref([])
const advOpen = ref(false)
const allGraphs = ref([])      // for sub-workflow picker
const scripts = ref([])        // for the action.script picker ([{id, name, file_path}])
const showRunForm = ref(false)
const runForm = ref({})
const runFormFields = ref([])
const pendingDry = ref(false)
const selectedEdge = ref(null)
let clipboard = []
const showVersions = ref(false)
const versions = ref([])
const metrics = ref(null)
let pollTimer = null
let runSocket = null

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

// ── resizable layout (Phase 2C) — sizes + collapse flags persisted to localStorage only ──
const _lp = loadLayout()
const paletteW = ref(_lp.paletteW)
const inspectorW = ref(_lp.inspectorW)
const logH = ref(_lp.logH)
const paletteCollapsed = ref(_lp.paletteCollapsed)
const inspectorCollapsed = ref(_lp.inspectorCollapsed)
function persistLayout() {
  saveLayout({ paletteW: paletteW.value, inspectorW: inspectorW.value, logH: logH.value,
    paletteCollapsed: paletteCollapsed.value, inspectorCollapsed: inspectorCollapsed.value, logOpen: logOpen.value })
}
function togglePalette() { paletteCollapsed.value = !paletteCollapsed.value; persistLayout() }
function toggleInspector() { inspectorCollapsed.value = !inspectorCollapsed.value; persistLayout() }
// Drag-to-resize: pointer capture on a divider updates the bound size, clamped, then persists on release.
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
const logOpen = ref(false)
const logEntries = ref([])
let _loggedKeys = new Set()
function resetLog() { logEntries.value = []; _loggedKeys = new Set() }
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
function copyLog() {
  const text = logEntries.value.map(e => `[${e.t}] ${e.level}: ${e.text}`).join('\n')
  try { navigator.clipboard.writeText(text); notify.success('Logs copied') } catch { notify.error('Copy failed') }
}
function copy(text) {
  try { navigator.clipboard.writeText(text || ''); notify.success('Copied') } catch { notify.error('Copy failed') }
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
  { key: 'trigger', label: 'Triggers' }, { key: 'agent', label: 'AI / Agents' },
  { key: 'action', label: 'Actions' }, { key: 'logic', label: 'Logic' },
]
const sidebarGroups = computed(() => {
  const q = sidebarSearch.value.trim().toLowerCase()
  const m = (...s) => !q || s.filter(Boolean).some(x => String(x).toLowerCase().includes(q))
  return SIDEBAR_GROUPS
    .map(g => ({ ...g, items: palette
      .filter(p => p.type.split('.')[0] === g.key && m(p.label, p.sub, p.type))
      .sort((a, b) => (PALETTE_SORT[a.type] || 99) - (PALETTE_SORT[b.type] || 99)) }))
    .filter(g => g.items.length)
})

// canvas empty-state quick-add (normal node creation logic, placed at canvas centre)
const nodeCount = computed(() => getNodes.value.length)
function addQuick(type) {
  const id = newId()
  addNodes([{ id, type, position: _canvasCenter(), data: defaultData(type) }])
  markDirty()
  selected.value = getNodes.value.find(n => n.id === id) || null
  selectedEdge.value = null
}

function starterWorkflow() {
  const nodes = [
    { id: 'wf_webhook', type: 'trigger.webhook', position: { x: 80, y: 350 },
      data: { ...defaultData('trigger.webhook'), label: 'Webhook Trigger', notes: '', __status: 'success' } },
    { id: 'wf_agent', type: 'agent.run', position: { x: 370, y: 350 },
      data: { ...defaultData('agent.run'), label: 'Run Agent', agent_name: 'Intake Agent', __status: 'success' } },
    { id: 'wf_channel', type: 'action.channel', position: { x: 660, y: 350 },
      data: { ...defaultData('action.channel'), label: 'Send to Channel', kind: 'slack', slack_channel: '#customer-intake', __status: 'success' } },
    { id: 'wf_http', type: 'action.http', position: { x: 300, y: 535 },
      data: { ...defaultData('action.http'), label: 'HTTP Request', method: 'GET', url: 'https://api.example.com', __status: 'success' } },
  ]
  const edges = [
    { id: 'e_webhook_agent', source: 'wf_webhook', target: 'wf_agent' },
    { id: 'e_agent_channel', source: 'wf_agent', target: 'wf_channel' },
  ]
  return { nodes, edges, selectedId: 'wf_webhook' }
}

function conditionWorkflow() {
  const nodes = [
    { id: 'cond_webhook', type: 'trigger.webhook', position: { x: 20, y: 360 },
      data: { ...defaultData('trigger.webhook'), label: 'Webhook Trigger', __status: 'success' } },
    { id: 'cond_enrich', type: 'action.tool', position: { x: 270, y: 360 },
      data: { ...defaultData('action.tool'), label: 'Enrich Lead Data', tool: 'Find & enrich contact', __status: 'success' } },
    { id: 'cond_condition', type: 'logic.condition', position: { x: 545, y: 360 },
      data: { ...defaultData('logic.condition'), label: 'If / Else Condition', expression: 'lead_score > 70 and source = demo_request',
        description: 'Route leads based on score and source.',
        conditions: [{ field: 'lead_score', operator: '>', value: '70' }, { field: 'source', operator: '=', value: 'demo_request' }],
        __status: 'success' } },
    { id: 'cond_agent', type: 'agent.run', position: { x: 830, y: 345 },
      data: { ...defaultData('agent.run'), label: 'Run Agent', agent_name: 'Qualify lead', __status: 'success' } },
    { id: 'cond_crm', type: 'action.tool', position: { x: 830, y: 500 },
      data: { ...defaultData('action.tool'), label: 'Create CRM Record', tool: 'Create lead in HubSpot', __status: 'success' } },
    { id: 'cond_slack', type: 'action.channel', position: { x: 420, y: 650 },
      data: { ...defaultData('action.channel'), label: 'Send Slack Alert', kind: 'slack', slack_channel: 'Notify sales channel', __status: 'success' } },
    { id: 'cond_review', type: 'action.tool', position: { x: 690, y: 650 },
      data: { ...defaultData('action.tool'), label: 'Add to Review Queue', tool: 'Requires manual review', __status: 'success' } },
  ]
  const edges = [
    { id: 'e_cw_enrich', source: 'cond_webhook', target: 'cond_enrich' },
    { id: 'e_enrich_condition', source: 'cond_enrich', target: 'cond_condition' },
    { id: 'e_true_agent', source: 'cond_condition', target: 'cond_agent', label: 'A True' },
    { id: 'e_agent_crm', source: 'cond_agent', target: 'cond_crm' },
    { id: 'e_false_slack', source: 'cond_condition', target: 'cond_slack', label: 'B False' },
    { id: 'e_false_review', source: 'cond_condition', target: 'cond_review', label: 'B False' },
  ]
  return { nodes, edges, selectedId: 'cond_condition' }
}

function runDebugWorkflow() {
  const base = starterWorkflow()
  const nodes = [
    base.nodes[0],
    { ...base.nodes[1], data: { ...base.nodes[1].data, __status: 'running' } },
    base.nodes[2],
    { ...base.nodes[3], position: { x: 410, y: 520 }, data: { ...base.nodes[3].data, __status: 'success' } },
    { id: 'wf_script', type: 'action.script', position: { x: 900, y: 350 },
      data: { ...defaultData('action.script'), label: 'Run Script', script_id: null, notes: 'Enrich user data', __status: 'pending' } },
  ]
  const edges = [
    ...base.edges,
    { id: 'e_channel_script', source: 'wf_channel', target: 'wf_script' },
    { id: 'e_agent_http', source: 'wf_agent', target: 'wf_http', style: 'dashed' },
  ]
  return { nodes, edges, selectedId: 'wf_agent' }
}

function applyWorkflowState(state, isRun = false) {
  const hydrated = state.nodes.map(n => ({ ...n, data: hydrate(n.type, n.data || {}) }))
  setNodes(hydrated)
  setEdges(state.edges)
  selected.value = hydrated.find(n => n.id === state.selectedId) || null
  selectedEdge.value = null
  running.value = isRun
  logOpen.value = false
  guideHidden.value = isRun
}
function loadOverviewDemo() { applyWorkflowState(starterWorkflow(), false) }
function loadConditionDemo() { applyWorkflowState(conditionWorkflow(), false) }
function loadRunDemo() { applyWorkflowState(runDebugWorkflow(), true) }
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
const isDev = !!import.meta.env.DEV

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
const timelineRows = computed(() => nodeRuns.value.map(nr => {
  const node = getNodes.value.find(n => n.id === nr.node_id)
  const st = nr.status || 'pending'
  const dur = nr.duration_ms != null ? fmtDuration(nr.duration_ms) : (st === 'running' ? 'Running…' : st)
  return {
    id: nr.node_id,
    time: fmtClock(nr.started_at),
    icon: statusIcon(st),
    state: st,
    title: node?.data?.label || nodeLabel(nr.node_type) || nr.node_id,
    sub: nodeSubtitle(nr.node_type) || nr.node_type,
    status: dur,
    running: st === 'running',
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
  { key: 'trigger', label: 'Triggers' },
  { key: 'agent', label: 'AI / Agents' },
  { key: 'action', label: 'Actions' },
  { key: 'logic', label: 'Logic' },
]
const activePaletteTab = ref('all')
const paletteTabs = [
  { key: 'all', label: 'All' },
  { key: 'trigger', label: 'Triggers' },
  { key: 'agent', label: 'AI / Agents' },
  { key: 'action', label: 'Actions' },
  { key: 'logic', label: 'Logic' },
  { key: 'data', label: 'Data' },
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
    const items = palette.filter(p => p.type.split('.')[0] === g.key && p.type !== 'action.mcp_tool' && match(p.label, p.sub, p.type))
      .map(p => ({ key: p.type, icon: p.icon, label: p.label, sub: p.sub, family: g.key, kind: 'node', nodeType: p.type }))
    if (items.length) groups.push({ key: g.key, label: g.label, items, collapsible: false })
  }
  // tools & APIs — grouped by category (collapsed by default; one section per category/connector)
  const byCat = {}
  for (const t of catalogTools.value) {
    if (!match(t.name, t.description, t.category, t.category_label)) continue
    const cat = t.category || 'other'
    if (!byCat[cat]) byCat[cat] = { label: t.category_label || _prettyCat(cat), items: [] }
    byCat[cat].items.push({ key: 'tool:' + t.name, icon: _CONNECTOR_CATS.has(cat) ? '🔌' : 'ðŸ› ï¸',
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
  if (paletteSearching.value) return []
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
  activePaletteTab.value = 'all'
  mcpPick.value = null
  await nextTick(); palSearchEl.value?.focus()
  if (_catalogLoaded) return
  paletteLoading.value = true
  try {
    const [tools, mcp] = await Promise.all([
      api.get('/tools/').catch(() => ({ data: {} })),
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
    return screenToFlowCoordinate({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
  }
  return { x: 250 + Math.random() * 80, y: 160 + Math.random() * 80 }
}

function _dropNode(type, data) {
  const id = newId()
  // place near the source node when quick-adding, else canvas centre
  let pos = _canvasCenter()
  const src = quickAddSource.value && getNodes.value.find(n => n.id === quickAddSource.value)
  if (src) pos = { x: (src.position?.x || 0) + 280, y: (src.position?.y || 0) }
  addNodes([{ id, type, position: pos, data }])
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
    _dropNode('agent.run', { ...defaultData('agent.run'), notes: `Use an agent that has the “${it.mcpName}â€ MCP server attached.` })
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
const markDirty = () => { dirty.value = true }

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

function runUpTo(nodeId) {
  pendingDry.value = false
  startRun({}, nodeId)
}

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
  const fresh = clipboard.map(c => {
    const id = newId(); idMap[c._oldId] = id
    const { __status, __error, ...data } = c.data
    return { id, type: c.type, position: { x: c.position.x + 48, y: c.position.y + 48 }, data }
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
function onKeydown(e) {
  // Ctrl/Cmd+K opens the Add-node palette from anywhere (even while typing).
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); openPalette(); return }
  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); save(); return }
  if (e.key === 'Escape') { showPalette.value = false; selected.value = null; selectedEdge.value = null; return }
  const tag = (e.target?.tagName || '').toLowerCase()
  if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selected.value) deleteSelected()
    else if (selectedEdge.value) deleteEdge()
    return
  }
  if (!(e.ctrlKey || e.metaKey)) return
  if (e.key === 'c') { copySelection() }
  else if (e.key === 'v') { pasteSelection() }
}

// ── load / save ──
async function load() {
  loading.value = true
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
    name.value = g.name
    version.value = g.version || 1
    graphTriggers.value = g.triggers || []
    agents.value = (ag?.results || ag || [])
    allGraphs.value = (allG?.results || allG || [])
    scripts.value = (scr?.results || scr || [])
    const graph = g.graph || {}
    const graphNodes = graph.nodes || []
    const useReferenceStarter = graphNodes.length <= 1
    const starter = useReferenceStarter ? starterWorkflow() : null
    // A pre-populated starter is an editable scaffold, not a completed run — drop the demo success badges.
    const rawNodes = starter
      ? starter.nodes.map(n => { const { __status, __error, ...data } = (n.data || {}); return { ...n, data } })
      : graphNodes
    const hydratedNodes = rawNodes.map(n => ({ ...n, data: hydrate(n.type, n.data || {}) }))
    setNodes(hydratedNodes)
    setEdges(starter ? starter.edges : (graph.edges || []))
    if (!starter && graph.viewport && setViewport) { try { setViewport(graph.viewport) } catch {} }
    if (starter) {
      selected.value = hydratedNodes.find(n => n.id === starter.selectedId) || hydratedNodes[0] || null
      selectedEdge.value = null
    }
    loadToolNames()
    dirty.value = false
    _takeSnapshot(g.name, starter ? currentGraph() : graph)   // baseline for Reset
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to load workflow')
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
  const d = { ...(data || {}) }
  if (type === 'action.tool') d.params_json = JSON.stringify(d.params || {}, null, 2)
  if (type === 'action.mcp_tool') d.params_json = JSON.stringify(d.params || {}, null, 2)
  if (type === 'action.http') d.json_text = d.json ? JSON.stringify(d.json, null, 2) : ''
  if (type === 'logic.foreach') {
    d.do = d.do || { type: 'action.channel', data: { kind: 'log', message: 'item {{item}}' } }
    d.do.data = d.do.data || {}
    if (d.do.type === 'action.tool') d.do.data.params_json = JSON.stringify(d.do.data.params || {}, null, 2)
  }
  return d
}
// serialize editable node data back to the backend shape (JSON-text fields → objects; drop UI meta)
function serializeData(type, data) {
  const { __status, __error, params_json, json_text, ...rest } = (data || {})
  if (type === 'action.tool' || type === 'action.mcp_tool') {
    try { rest.params = params_json ? JSON.parse(params_json) : {} } catch { rest.params = {} }
  }
  if (type === 'action.http') {
    if (json_text && json_text.trim()) { try { rest.json = JSON.parse(json_text) } catch {} }
  }
  if (type === 'logic.foreach' && rest.do) {
    const inner = { type: rest.do.type, data: { ...(rest.do.data || {}) } }
    if (inner.type === 'action.tool') {
      const pj = inner.data.params_json
      try { inner.data.params = pj ? JSON.parse(pj) : {} } catch { inner.data.params = {} }
      delete inner.data.params_json
    }
    rest.do = inner
  }
  return rest
}
function currentGraph() {
  const obj = toObject()
  return {
    nodes: (obj.nodes || []).map(n => ({ id: n.id, type: n.type, position: n.position, data: serializeData(n.type, n.data) })),
    edges: (obj.edges || []).map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle, ...(e.label ? { label: e.label } : {}) })),
    viewport: obj.viewport || {},
  }
}
async function loadToolNames() {
  try {
    const { data } = await api.get('/tools/')
    const list = data?.tools || data?.results || data || []
    toolNames.value = list.map(t => (typeof t === 'string' ? t : (t.name || t.tool || ''))).filter(Boolean)
  } catch { /* optional */ }
}

async function save() {
  busy.value = true
  try {
    const { data } = await api.saveWorkflowGraph(graphId, { name: name.value, graph: currentGraph() })
    version.value = data.version || version.value
    graphTriggers.value = data.triggers || graphTriggers.value   // webhook URLs / schedule status
    dirty.value = false
    _takeSnapshot(name.value, currentGraph())   // new Reset baseline
    notify.success('Workflow saved')
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to save')
  } finally {
    busy.value = false
  }
}

async function publish() {
  busy.value = true
  try {
    const { data } = await api.saveWorkflowGraph(graphId, { name: name.value, graph: currentGraph(), status: 'published' })
    version.value = data.version || version.value
    graphTriggers.value = data.triggers || graphTriggers.value
    dirty.value = false
    notify.success(`Published (v${version.value})`)
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to publish')
  } finally {
    busy.value = false
  }
}

// Live run status over WebSocket (push); polling (below) remains a fallback for both.
function openRunSocket(runId) {
  try { runSocket?.close() } catch {}
  try {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    runSocket = new WebSocket(`${proto}://${location.host}/ws/workflow-graph-run/${runId}/`)
    runSocket.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data); const d = msg.data || {}
        if (d.node_id) {
          const n = getNodes.value.find(x => x.id === d.node_id)
          if (n) n.data.__status = d.status || (msg.event === 'node_started' ? 'running' : n.data.__status)
          if (msg.event === 'node_started') addNodeLog(d.node_id, 'running')
          if (msg.event === 'node_finished') addNodeLog(d.node_id, d.status, (d.output && d.output.text) || d.error || (d.output && d.output.reason) || '')
        }
        if (msg.event === 'run_finished') { running.value = false; addLog(d.status === 'success' ? 'success' : 'error', `■ Run ${d.status || 'finished'}`); try { runSocket.close() } catch {}; loadRuns() }
      } catch {}
    }
    runSocket.onerror = () => { try { runSocket.close() } catch {} }
  } catch { /* WS optional — polling covers it */ }
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
function runGraph(dry = false) {
  pendingDry.value = !!dry
  const inputs = manualInputs()
  if (inputs.length) {
    runForm.value = Object.fromEntries(inputs.map(i => [i.key, i.default ?? '']))
    runFormFields.value = inputs.map(i => i.key)
    showRunForm.value = true
    return
  }
  startRun({})
}
async function startRun(payload, until = null) {
  showRunForm.value = false
  const dry = pendingDry.value
  if (dirty.value) await save()
  running.value = true
  timelineOpen.value = true
  resetLog(); addLog(dry ? 'warn' : 'info', until ? `▶ Test up to ${until}` : (dry ? '🧪 Test run (dry-run — no real side-effects)' : '▶ Run started')); logOpen.value = true
  getNodes.value.forEach(n => { n.data.__status = 'pending' })
  try {
    const { data } = await api.runWorkflowGraph(graphId, { payload: payload || {}, dry_run: dry, until_node: until })
    if (!data.run_id) { running.value = false; return }
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
  }
}

function pollRun(runId) {
  clearInterval(pollTimer)
  const tick = async () => {
    try {
      const { data } = await api.getWorkflowGraphRun(runId)
      runDetail.value = data
      const byNode = {}
      for (const nr of data.node_runs || []) byNode[nr.node_id] = nr
      getNodes.value.forEach(n => { if (byNode[n.id]) n.data.__status = byNode[n.id].status })
      // log any node transitions the WS didn't already capture (dedupe handles overlap)
      for (const nr of data.node_runs || []) addNodeLog(nr.node_id, nr.status, (nr.output && nr.output.text) || nr.error || (nr.output && nr.output.reason) || '')
      if (['success', 'failed', 'cancelled'].includes(data.status)) {
        clearInterval(pollTimer); running.value = false
        addLog(data.status === 'success' ? 'success' : 'error', `■ Run #${runId}: ${data.status}`)
        notify[data.status === 'success' ? 'success' : 'error'](`Run #${runId}: ${data.status}`)
        loadRuns()
      }
    } catch {
      clearInterval(pollTimer); running.value = false
    }
  }
  tick()
  pollTimer = setInterval(tick, 1200)
}

async function stopRun() {
  if (!activeRunId.value) return
  try {
    await api.cancelWorkflowGraphRun(activeRunId.value)
    addLog('warn', 'â¹ Stop requested — halting at the next node…')
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to stop')
  }
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
  try { const { data } = await api.getWorkflowGraphRuns(graphId); runs.value = data || [] } catch {}
}
async function openRuns() {
  showRuns.value = true
  loadRuns()
  try { const { data } = await api.getWorkflowGraphMetrics(graphId); metrics.value = data } catch { metrics.value = null }
}
function fmtDuration(ms) {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}
function fmtCost(c) { return c ? `$${Number(c).toFixed(4)}` : '$0' }

async function openVersions() {
  showVersions.value = true
  try { const { data } = await api.getWorkflowGraphVersions(graphId); versions.value = data || [] }
  catch { notify.error('Failed to load versions') }
}
async function restoreVersion(v) {
  if (!(await confirm({ title: 'Restore this version?', message: `Roll the canvas back to v${v.version}? Save your current canvas first if you want to keep it.`, confirmText: 'Restore' }))) return
  try {
    const { data } = await api.restoreWorkflowGraphVersion(graphId, v.id)
    version.value = data.version || version.value
    // reload the canvas from the restored graph
    const graph = data.graph || {}
    setNodes((graph.nodes || []).map(n => ({ ...n, data: hydrate(n.type, n.data || {}) })))
    setEdges(graph.edges || [])
    if (graph.viewport && setViewport) { try { setViewport(graph.viewport) } catch {} }
    dirty.value = false
    showVersions.value = false
    notify.success(`Restored — now v${version.value}`)
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to restore')
  }
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
  } catch {}
}

function goBack() { router.push('/dashboard/workflow-builder') }

// ── workflow-level actions (Phase 3B) ──
const menuOpen = ref(false)
async function duplicateWorkflow() {
  busy.value = true
  try {
    if (dirty.value) await save()
    const { data } = await api.createWorkflowGraph({ name: `${name.value} (copy)`, graph: currentGraph() })
    notify.success('Workflow duplicated')
    router.push(`/dashboard/workflow-builder/${data.id}`)
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to duplicate')
  } finally { busy.value = false }
}
async function deleteWorkflow() {
  // Archive (soft-delete): keeps run history + any workflow budget's spend; hidden from the list.
  if (!(await confirm({ title: 'Archive workflow?', message: `Archive“${name.value}â€? It will be hidden from the list, but its run history and budget spend are kept.`, confirmText: 'Archive' }))) return
  try {
    await api.deleteWorkflowGraph(graphId)
    notify.success('Workflow archived')
    router.push('/dashboard/workflow-builder')
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to archive')
  }
}

onMounted(async () => { await load(); loadRuns(); window.addEventListener('keydown', onKeydown) })
onBeforeUnmount(() => { clearInterval(pollTimer); try { runSocket?.close() } catch {}; window.removeEventListener('keydown', onKeydown) })
</script>

<style scoped>
.wfb-root { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--vm-bg, #f8fafc); }
.wfb-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px; background: #fff; border-bottom: 1px solid #e2e8f0; }
.bar-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
.lnk { font-size: 13px; font-weight: 600; color: #475569; }
.lnk:hover { color: #7c3aed; }
.sep { color: #cbd5e1; }
.name-in { font-size: 14px; font-weight: 700; color: #0f172a; border: 1px solid #a78bfa; border-radius: 8px; padding: 4px 8px; min-width: 200px; outline: none; }
.name-display { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 700; color: #0f172a; border: 1px solid transparent; border-radius: 8px; padding: 4px 8px; max-width: 320px; }
.name-display:hover { border-color: #e2e8f0; background: #f8fafc; }
.name-display .name-edit { font-size: 11px; color: #cbd5e1; }
.name-display:hover .name-edit { color: #7c3aed; }
/* overflow menu */
.wf-menu { position: relative; }
.wf-menu-back { position: fixed; inset: 0; z-index: 40; }
.wf-menu-pop { position: absolute; right: 0; top: calc(100% + 4px); z-index: 41; min-width: 180px; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,.14); padding: 5px; }
.wf-menu-pop button { display: block; width: 100%; text-align: left; font-size: 12.5px; font-weight: 600; color: #334155; padding: 8px 10px; border-radius: 7px; }
.wf-menu-pop button:hover { background: #f1f5f9; }
.wf-menu-pop button.danger { color: #b91c1c; } .wf-menu-pop button.danger:hover { background: #fef2f2; }
.log-btn.on { background: #7f1d1d; color: #fecaca; }
.rd-dur { font-size: 10px; color: #94a3b8; flex-shrink: 0; }
.pill { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 999px; }
.pill.dirty { color: #b45309; background: #fef3c7; } .pill.ok { color: #059669; background: #d1fae5; }
.pill.ver { color: #475569; background: #f1f5f9; }
.bar-right { display: flex; align-items: center; gap: 8px; }
.gbtn { font-size: 13px; font-weight: 600; padding: 7px 13px; border-radius: 9px; background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0; cursor: pointer; }
.gbtn:hover { background: #e2e8f0; } .gbtn:disabled { opacity: .55; cursor: default; }
.gbtn.run { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
.gbtn.stop { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
.gbtn.save { background: #7c3aed; color: #fff; border-color: #7c3aed; }
.rerun-here { margin-top: 12px; width: 100%; font-size: 12px; font-weight: 600; padding: 7px; border-radius: 8px;
  background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; }
.rerun-here:hover { background: #e0e7ff; }
.rd-rerun { float: right; font-size: 10.5px; font-weight: 700; color: #4338ca; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 6px; padding: 2px 7px; }
.gbtn.on { background: #0f172a; color: #fff; border-color: #0f172a; }
/* run-log console (bottom of canvas) */
.log-console { position: absolute; left: 0; right: 0; bottom: 0; height: 180px; background: #0b1220; color: #cbd5e1;
  border-top: 1px solid #1e293b; display: flex; flex-direction: column; z-index: 5; }
.log-h { display: flex; align-items: center; gap: 8px; padding: 5px 10px; background: #0f172a; border-bottom: 1px solid #1e293b;
  font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; }
.log-btn { font-size: 10.5px; font-weight: 600; color: #94a3b8; padding: 2px 7px; border-radius: 6px; }
.log-btn:hover { background: #1e293b; color: #e2e8f0; }
.log-body { flex: 1; overflow-y: auto; padding: 6px 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; }
.log-empty { color: #64748b; font-style: italic; padding: 8px 0; }
.log-line { display: flex; gap: 8px; padding: 1px 0; white-space: pre-wrap; }
.log-t { color: #475569; flex-shrink: 0; }
.lv-info .log-msg { color: #cbd5e1; }
.lv-success .log-msg { color: #34d399; }
.lv-warn .log-msg { color: #fbbf24; }
.lv-error .log-msg { color: #f87171; }
/* log dock resize handle + summary + reopen pill */
.log-resize { position: absolute; top: 0; left: 0; right: 0; height: 6px; cursor: ns-resize; }
.log-resize:hover { background: rgba(124,58,237,.4); }
.log-summary { font-size: 10px; font-weight: 600; text-transform: none; letter-spacing: 0; color: #64748b; }
.log-summary.running { color: #34d399; }
.log-reopen { position: absolute; right: 12px; bottom: 8px; z-index: 5; font-size: 11px; font-weight: 600; color: #475569;
  background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 5px 10px; box-shadow: 0 1px 4px rgba(0,0,0,.08); display: flex; gap: 6px; align-items: center; }
.log-reopen:hover { border-color: #a78bfa; }
.log-reopen .log-summary { color: #94a3b8; }

.wfb-body { flex: 1; min-height: 0; display: flex; position: relative; }
/* ── resizable layout: dividers + collapse tabs ── */
.wfb-divider { flex-shrink: 0; width: 5px; cursor: col-resize; background: transparent; position: relative; }
.wfb-divider::after { content: ''; position: absolute; left: 2px; top: 0; bottom: 0; width: 1px; background: #e2e8f0; }
.wfb-divider:hover::after { background: #a78bfa; width: 2px; left: 1.5px; }
.wfb-tab { position: absolute; top: 50%; transform: translateY(-50%); z-index: 6; width: 16px; height: 44px; font-size: 11px;
  background: #fff; border: 1px solid #e2e8f0; color: #94a3b8; display: flex; align-items: center; justify-content: center; }
.wfb-tab:hover { color: #7c3aed; border-color: #a78bfa; }
.wfb-tab.tab-left { left: 0; border-radius: 0 8px 8px 0; border-left: none; }
.wfb-tab.tab-right { right: 0; border-radius: 8px 0 0 8px; border-right: none; }
/* left palette (resizable) */
.wfb-palette { flex-shrink: 0; border-right: 1px solid #e2e8f0; background: #fff; display: flex; flex-direction: column; min-height: 0; }
.add-node-btn { margin: 10px 10px 8px; font-size: 13px; font-weight: 700; color: #fff; background: #7c3aed; border-radius: 10px; padding: 9px; box-shadow: 0 1px 4px rgba(124,58,237,.25); display: flex; align-items: center; justify-content: center; gap: 6px; }
.add-node-btn:hover { opacity: .94; }
.add-node-btn kbd { font-size: 9px; background: rgba(255,255,255,.22); border-radius: 4px; padding: 0 4px; }
.pal-search { margin: 0 10px 8px; padding: 7px 10px; font-size: 12.5px; border: 1px solid #e2e8f0; border-radius: 9px; outline: none; }
.pal-search:focus { border-color: #a78bfa; }
.pal-scroll { flex: 1; overflow-y: auto; padding: 0 10px 12px; }
.pal-empty { font-size: 12px; color: #94a3b8; text-align: center; padding: 20px 0; }
.pal-cat { margin-bottom: 8px; }
.pal-cat-h { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #cbd5e1; padding: 6px 2px 4px; }
.pal-card { display: flex; align-items: center; gap: 9px; padding: 7px 9px; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 6px; cursor: grab; background: #fff; }
.pal-card:hover { border-color: #a78bfa; box-shadow: 0 1px 4px rgba(0,0,0,.05); }
.pal-card.fam-trigger { border-left: 3px solid #0d9488; } .pal-card.fam-agent { border-left: 3px solid #4f46e5; } .pal-card.fam-action { border-left: 3px solid #7c3aed; } .pal-card.fam-logic { border-left: 3px solid #64748b; }
.pal-card-ic { width: 26px; height: 26px; border-radius: 7px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0; }
.pal-card-txt { min-width: 0; display: flex; flex-direction: column; }
.pal-card-l { font-size: 12px; font-weight: 600; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pal-card-s { font-size: 10px; color: #94a3b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pal-more { width: 100%; margin-top: 6px; font-size: 11.5px; font-weight: 600; color: #4338ca; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 7px; }
.pal-more:hover { background: #e0e7ff; }
/* canvas empty hero */
.canvas-empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
.ce-card { pointer-events: auto; max-width: 420px; text-align: center; background: rgba(255,255,255,.9); backdrop-filter: blur(6px); border: 1px solid #e2e8f0; border-radius: 18px; box-shadow: 0 12px 40px rgba(0,0,0,.08); padding: 28px 30px; }
.ce-ic { font-size: 34px; }
.ce-title { font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 6px; }
.ce-sub { font-size: 12.5px; color: #64748b; margin: 8px 0 16px; line-height: 1.5; }
.ce-btns { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.ce-btn { font-size: 12px; font-weight: 600; color: #334155; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 9px; padding: 7px 11px; }
.ce-btn:hover { border-color: #a78bfa; color: #7c3aed; background: #f5f3ff; }
.ce-more { margin-top: 14px; font-size: 11.5px; font-weight: 600; color: #7c3aed; }
.ce-more:hover { text-decoration: underline; }
/* inspector empty state + sticky header */
.ins-sticky { position: sticky; top: -14px; background: #fff; z-index: 2; margin: -14px -14px 10px; padding: 14px 14px 8px; border-bottom: 1px solid #f1f5f9; }
.ins-empty-wrap { display: flex; align-items: center; justify-content: center; }
.ins-empty { text-align: center; color: #94a3b8; padding: 24px; }
.ins-empty-ic { font-size: 26px; opacity: .6; }
.ins-empty-t { font-size: 13px; font-weight: 700; color: #64748b; margin-top: 8px; }
.ins-empty-s { font-size: 11.5px; margin-top: 4px; line-height: 1.5; }
/* command palette modal */
.pal-scrim { align-items: flex-start; }
.cmd-pal { width: 560px; max-width: 94vw; margin-top: 8vh; max-height: 76vh; background: #fff; border-radius: 14px; box-shadow: 0 24px 64px rgba(0,0,0,.28); display: flex; flex-direction: column; overflow: hidden; }
.cmd-search { padding: 14px 16px; font-size: 15px; border: none; border-bottom: 1px solid #e2e8f0; outline: none; }
.cmd-body { flex: 1; overflow-y: auto; padding: 6px 8px; }
.cmd-empty { padding: 28px; text-align: center; color: #94a3b8; font-size: 13px; }
.cmd-grp { margin-bottom: 6px; }
.cmd-grp-h { display: flex; align-items: center; gap: 6px; padding: 8px 10px 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #94a3b8; }
.cmd-grp-toggle { cursor: pointer; border-radius: 6px; }
.cmd-grp-toggle:hover { color: #475569; background: #f8fafc; }
.cmd-caret { font-size: 9px; color: #cbd5e1; }
.cmd-grp-n { font-size: 9.5px; color: #cbd5e1; }
.cmd-item { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 8px 10px; border-radius: 9px; }
.cmd-item:hover { background: #f5f3ff; }
.cmd-ic { width: 28px; height: 28px; border-radius: 8px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
.cmd-ic.fam-trigger { background: #ccfbf1; } .cmd-ic.fam-agent { background: #e0e7ff; } .cmd-ic.fam-action { background: #ede9fe; } .cmd-ic.fam-logic { background: #f1f5f9; }
.cmd-txt { min-width: 0; flex: 1; display: flex; flex-direction: column; }
.cmd-l { font-size: 13px; font-weight: 600; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cmd-s { font-size: 11px; color: #94a3b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cmd-badge { flex-shrink: 0; font-size: 9px; font-weight: 800; text-transform: uppercase; color: #6d28d9; background: #ede9fe; border-radius: 5px; padding: 2px 6px; }
.cmd-foot { padding: 8px 14px; border-top: 1px solid #e2e8f0; background: #f8fafc; font-size: 10.5px; color: #94a3b8; }
.cmd-foot kbd { font-size: 9.5px; background: #fff; border: 1px solid #e2e8f0; border-radius: 4px; padding: 0 4px; }
.cmd-foot-btns { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 14px; }
.cmd-back { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; color: #0f172a; }
.cmd-backbtn { font-size: 16px; color: #64748b; padding: 0 4px; }
.cmd-ctx { padding: 14px 16px; }
.cmd-ctx-h { font-size: 13px; color: #334155; margin-bottom: 6px; }
.cmd-ctx-note { font-size: 11.5px; color: #94a3b8; line-height: 1.45; margin-bottom: 12px; }
/* insert-variable affordance + label row */
.lbl-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.insvar { font-size: 10.5px; font-weight: 700; color: #4338ca; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 6px; padding: 2px 7px; }
.insvar:hover { background: #e0e7ff; }
.req-chk { display: flex; align-items: center; gap: 3px; font-size: 10px; color: #64748b; flex-shrink: 0; }
/* node output panel */
.op-h { display: flex; align-items: center; justify-content: space-between; margin-top: 14px; padding-top: 10px; border-top: 1px dashed #e2e8f0; font-size: 11px; font-weight: 700; color: #64748b; }
.op-tabs { display: flex; gap: 4px; }
.op-tab { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #94a3b8; padding: 2px 7px; border-radius: 6px; }
.op-tab.on { color: #4338ca; background: #eef2ff; }
.op-body { margin-top: 6px; max-height: 200px; overflow: auto; background: #0b1220; color: #cbd5e1; border-radius: 8px; padding: 8px 10px; font-family: ui-monospace, Menlo, monospace; font-size: 11px; white-space: pre-wrap; word-break: break-word; }
.ins-actions { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
.ins-actions .rerun-here { margin-top: 0; }
.canvas-wrap { flex: 1; min-width: 0; position: relative; }
.canvas-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(248,250,252,.7); font-size: 13px; color: #64748b; }
.inspector { width: 300px; flex-shrink: 0; border-left: 1px solid #e2e8f0; background: #fff; padding: 14px; overflow-y: auto; }
.ins-h { display: flex; align-items: center; justify-content: space-between; font-size: 12px; font-weight: 700; color: #7c3aed; margin-bottom: 10px; }
.del { color: #ef4444; display: inline-flex; align-items: center; }
.ins-h-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.ins-enabled { font-size: 11px; font-weight: 700; color: #059669; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 999px; padding: 3px 10px; }
.ins-l { display: block; font-size: 11px; font-weight: 600; color: #475569; margin: 10px 0 4px; }
.ins-in { width: 100%; font-size: 13px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; }
.ins-in:focus { outline: none; border-color: #a78bfa; box-shadow: 0 0 0 3px rgba(167,139,250,.2); }
.ins-note { font-size: 12px; color: #64748b; line-height: 1.5; }
.ins-hint { font-size: 10.5px; color: #94a3b8; margin-top: 6px; line-height: 1.4; }
.ins-in.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
.ins-err { margin-top: 10px; font-size: 11.5px; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 7px 9px; }
.ins-status { margin-top: 10px; font-size: 11.5px; border-radius: 8px; padding: 7px 9px; }
.ins-status.st-success { color: #047857; background: #ecfdf5; } .ins-status.st-failed { color: #b91c1c; background: #fef2f2; }
.ins-out { margin-top: 4px; font-size: 11px; color: #334155; white-space: pre-wrap; max-height: 160px; overflow: auto; }
.drawer-scrim { position: fixed; inset: 0; background: rgba(0,0,0,.3); z-index: 50; display: flex; justify-content: flex-end; }
.drawer { width: 380px; max-width: 90vw; height: 100%; background: #fff; box-shadow: -8px 0 24px rgba(0,0,0,.12); display: flex; flex-direction: column; }
.drawer-h { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid #e2e8f0; }
.drawer-h .x { font-size: 22px; color: #94a3b8; line-height: 1; }
.drawer-empty { padding: 40px 14px; text-align: center; font-size: 13px; color: #94a3b8; }
.drawer-list { padding: 8px; border-bottom: 1px solid #e2e8f0; max-height: 40%; overflow-y: auto; }
.run-row { display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 9px; border-radius: 8px; font-size: 12px; }
.run-row:hover { background: #f1f5f9; }
.run-id { font-weight: 700; color: #0f172a; } .run-st { color: #64748b; } .run-time { margin-left: auto; color: #94a3b8; font-size: 10.5px; }
.run-detail { flex: 1; overflow-y: auto; padding: 10px 12px; }
.rd-h { font-size: 12px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
.rd-node { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; padding: 6px 0; border-bottom: 1px dashed #eef2f7; font-size: 11.5px; }
.rd-nt { font-weight: 600; color: #334155; } .rd-id { color: #94a3b8; } .rd-st { margin-left: auto; color: #64748b; }
.rd-err { width: 100%; color: #b91c1c; font-size: 11px; } .rd-out { width: 100%; color: #475569; font-size: 11px; white-space: pre-wrap; }
.bg-emerald-500 { background:#10b981 } .bg-red-500 { background:#ef4444 } .bg-indigo-500 { background:#6366f1 } .bg-slate-300 { background:#cbd5e1 } .bg-amber-400 { background:#fbbf24 }
/* manual inputs (key/value rows) */
.kv-row { display: flex; gap: 5px; margin-bottom: 5px; }
.kv-row .ins-in { margin: 0; }
.kv-del { flex-shrink: 0; width: 26px; border: 1px solid #e2e8f0; border-radius: 7px; color: #94a3b8; background: #f8fafc; }
.kv-del:hover { color: #b91c1c; border-color: #fecaca; }
.kv-add { margin-top: 2px; font-size: 11.5px; font-weight: 600; color: #4338ca; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 7px; padding: 5px 10px; }
.kv-add:hover { background: #e0e7ff; }
/* approval decision box */
.appr-box { margin-top: 12px; padding: 10px; border: 1px solid #fde68a; background: #fffbeb; border-radius: 10px; }
.appr-q { font-size: 12px; font-weight: 700; color: #b45309; margin-bottom: 8px; }
.appr-btns { display: flex; gap: 8px; }
.appr-yes, .appr-no { flex: 1; font-size: 12px; font-weight: 700; padding: 7px; border-radius: 8px; border: 1px solid; }
.appr-yes { color: #047857; background: #ecfdf5; border-color: #a7f3d0; } .appr-yes:hover { background: #d1fae5; }
.appr-no { color: #b91c1c; background: #fef2f2; border-color: #fecaca; } .appr-no:hover { background: #fee2e2; }
.appr-yes:disabled, .appr-no:disabled { opacity: .55; }
/* advanced/reliability section */
.adv-h { margin-top: 14px; padding: 7px 0; font-size: 11.5px; font-weight: 700; color: #64748b; cursor: pointer; border-top: 1px dashed #e2e8f0; user-select: none; }
.adv-h:hover { color: #334155; }
.adv-body { padding-top: 2px; }
/* run-with-inputs modal */
.modal-scrim { position: fixed; inset: 0; background: rgba(0,0,0,.3); z-index: 60; display: flex; align-items: center; justify-content: center; }
.run-form { width: 360px; max-width: 90vw; background: #fff; border-radius: 14px; box-shadow: 0 16px 48px rgba(0,0,0,.2); overflow: hidden; }
.rf-h { display: flex; align-items: center; justify-content: space-between; padding: 13px 16px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 700; color: #0f172a; }
.rf-h .x { font-size: 22px; color: #94a3b8; line-height: 1; }
.rf-body { padding: 12px 16px; max-height: 60vh; overflow-y: auto; }
.rf-row { margin-bottom: 8px; }
.rf-foot { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 16px; border-top: 1px solid #e2e8f0; background: #f8fafc; }
/* run metrics bar */
.metrics-bar { display: flex; gap: 8px; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
.met { flex: 1; text-align: center; }
.met-v { display: block; font-size: 15px; font-weight: 800; color: #0f172a; }
.met-l { display: block; font-size: 9.5px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: .04em; }
.run-dry { font-size: 9px; font-weight: 800; color: #b45309; background: #fef3c7; border-radius: 5px; padding: 1px 5px; text-transform: uppercase; }
.run-dur { color: #94a3b8; font-size: 10.5px; }
.rd-meta { font-size: 10.5px; font-weight: 600; color: #94a3b8; margin-left: 8px; }
/* version history */
.ver-hint { padding: 8px 14px; font-size: 11px; color: #94a3b8; }
.ver-list { max-height: none; }
.ver-row { display: flex; align-items: center; gap: 8px; padding: 9px 10px; border-radius: 9px; }
.ver-row:hover { background: #f8fafc; }
.ver-info { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.ver-num { font-size: 12px; font-weight: 800; color: #4338ca; background: #eef2ff; border-radius: 6px; padding: 2px 7px; }
.ver-lbl { font-size: 12px; color: #334155; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ver-time { margin-left: auto; font-size: 10px; color: #94a3b8; flex-shrink: 0; }
.ver-restore { flex-shrink: 0; font-size: 11px; font-weight: 700; color: #4338ca; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 7px; padding: 5px 11px; }
.ver-restore:hover { background: #e0e7ff; }

/* Screen 25 workflow builder refresh */
.wfb-root {
  background: #f6f9fd;
  font-family: Inter, var(--vm-font-sans), system-ui, sans-serif;
  color: #0f172a;
}
.wfb-bar {
  min-height: 58px;
  padding: 10px 24px;
  background: #ffffff;
  border-bottom: 1px solid #e5edf6;
}
.bar-left {
  gap: 8px;
}
.lnk,
.name-display,
.name-in {
  font-size: 13px;
}
.lnk {
  color: #64748b;
  font-weight: 700;
  font-size: 0;
}
.lnk:hover {
  color: #2563eb;
}
.lnk::after {
  content: "Workflows";
  font-size: 13px;
}
.name-display {
  font-weight: 800;
  color: #172033;
}
.name-edit {
  display: none;
}
.pill {
  border-radius: 999px;
  font-size: 10px;
  letter-spacing: 0;
  padding: 3px 8px;
}
.pill.ver {
  color: #475569;
  background: #f1f5f9;
}
.pill.dirty {
  color: #92400e;
  background: #fff3d6;
  font-size: 0;
}
.pill.ok {
  color: #047857;
  background: #dffbea;
}
.pill.dirty::after {
  content: "Unsaved";
  font-size: 10px;
}
.bar-right {
  gap: 8px;
}
.bar-right > .gbtn:nth-child(-n+3) {
  display: none;
}
.gbtn {
  height: 38px;
  padding: 0 14px;
  border-radius: 9px;
  background: #ffffff;
  border: 1px solid #dbe5f0;
  color: #1e293b;
  font-size: 13px;
  font-weight: 800;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
}
.bar-right > .gbtn:nth-child(5),
.bar-right > .gbtn:nth-child(6),
.wf-menu > .gbtn {
  font-size: 0;
}
.bar-right > .gbtn:nth-child(5)::after {
  content: "Test";
  font-size: 13px;
}
.bar-right > .gbtn:nth-child(6)::after {
  content: "Run";
  font-size: 13px;
}
.bar-right > .gbtn.stop:nth-child(6)::after {
  content: "Stop";
}
.wf-menu > .gbtn::after {
  content: "More";
  font-size: 13px;
}
.gbtn:hover {
  background: #f8fbff;
  border-color: #cbd8e8;
}
.gbtn.run {
  color: #047857;
  background: #ecfdf5;
  border-color: #b7f3d5;
}
.gbtn.save {
  color: #ffffff;
  background: #2563eb;
  border-color: #2563eb;
  box-shadow: 0 10px 22px rgba(37, 99, 235, 0.2);
}
.wfb-title-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 28px 16px;
  background: #f6f9fd;
  border-bottom: 1px solid #e5edf6;
}
.wfb-title-strip h1 {
  margin: 0;
  font-size: 24px;
  line-height: 1.15;
  font-weight: 850;
  letter-spacing: -0.01em;
  color: #0f172a;
}
.wfb-title-strip p {
  margin: 5px 0 0;
  font-size: 13px;
  color: #60708a;
}
.title-help {
  height: 36px;
  padding: 0 14px;
  border: 1px solid #dbe5f0;
  border-radius: 9px;
  background: #ffffff;
  color: #2563eb;
  font-size: 13px;
  font-weight: 800;
}
.wfb-body {
  padding: 16px 24px 22px;
  gap: 12px;
}
.wfb-palette,
.inspector {
  border: 1px solid #dbe5f0;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
}
.wfb-palette {
  overflow: hidden;
}
.add-node-btn {
  height: 40px;
  margin: 14px 14px 10px;
  border-radius: 9px;
  background: #2563eb;
  box-shadow: 0 10px 22px rgba(37, 99, 235, 0.18);
}
.add-node-btn kbd {
  display: none;
}
.pal-search {
  height: 38px;
  margin: 0 14px 12px;
  border-color: #dbe5f0;
  border-radius: 9px;
  color: #172033;
}
.pal-scroll {
  padding: 0 14px 14px;
}
.pal-cat-h {
  color: #7b8aa4;
  font-size: 10px;
  letter-spacing: 0.08em;
  padding: 12px 2px 7px;
}
.pal-card {
  min-height: 58px;
  border-color: #e2eaf4;
  border-radius: 10px;
  padding: 9px 10px;
  box-shadow: none;
}
.pal-card:hover {
  border-color: #b9c9df;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
}
.pal-card-ic {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: #eef4ff;
  font-size: 0;
}
.pal-card-ic::before {
  content: "";
  width: 13px;
  height: 13px;
  border: 2px solid #2563eb;
  border-radius: 4px;
}
.pal-card-l {
  font-size: 13px;
  font-weight: 800;
}
.pal-card-s {
  font-size: 11px;
  color: #64748b;
}
.pal-more {
  background: #f6f9ff;
  color: #2563eb;
  border-color: #d7e4ff;
}
.wfb-divider,
.wfb-tab {
  display: none;
}
.canvas-wrap {
  min-height: 640px;
  border: 1px solid #dbe5f0;
  border-radius: 12px;
  overflow: hidden;
  background: #f8fbff;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.6), 0 8px 24px rgba(15, 23, 42, 0.035);
}
.canvas-wrap :deep(.vue-flow__background) {
  opacity: 0.78;
}
.canvas-wrap :deep(.vue-flow__controls) {
  left: 16px;
  bottom: 16px;
  border: 1px solid #dbe5f0;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
}
.wfb-guide {
  position: absolute;
  top: 18px;
  left: 50%;
  z-index: 4;
  width: min(520px, calc(100% - 48px));
  transform: translateX(-50%);
  padding: 18px 20px;
  border: 1px solid #dbe5f0;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.09);
}
.guide-x {
  position: absolute;
  top: 10px;
  right: 12px;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  color: #94a3b8;
}
.guide-eyebrow {
  font-size: 11px;
  font-weight: 850;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #2563eb;
}
.wfb-guide h2 {
  margin: 6px 0 6px;
  font-size: 18px;
  font-weight: 850;
  color: #0f172a;
}
.wfb-guide p {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: #60708a;
}
.guide-steps {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}
.guide-steps span {
  padding: 6px 9px;
  border-radius: 999px;
  background: #eef4ff;
  color: #1d4ed8;
  font-size: 11px;
  font-weight: 800;
}
.inspector {
  padding: 0;
}
.ins-sticky {
  top: 0;
  margin: 0;
  padding: 18px;
  border-bottom: 1px solid #e8eef7;
}
.ins-node-title {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.ins-node-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: #eef4ff;
  color: #2563eb;
  flex-shrink: 0;
}
.ins-node-title strong {
  display: block;
  font-size: 16px;
  line-height: 1.2;
  font-weight: 850;
  color: #0f172a;
}
.ins-node-title small {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}
.del {
  color: #ef4444;
  font-size: 12px;
  font-weight: 800;
}
.wfb-inspector > :not(.ins-sticky) {
  margin-left: 18px;
  margin-right: 18px;
}
.manual-panel {
  padding-bottom: 18px;
}
.ins-l {
  margin-top: 16px;
  color: #334155;
  font-size: 12px;
  font-weight: 800;
}
.ins-in {
  border-color: #dbe5f0;
  border-radius: 9px;
  color: #172033;
  font-size: 13px;
}
.manual-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 18px;
}
.manual-section-head strong {
  display: block;
  font-size: 14px;
  color: #0f172a;
}
.manual-section-head span {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: #64748b;
}
.manual-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 96px;
  margin-top: 12px;
  padding: 18px;
  border: 1px dashed #cbd8e8;
  border-radius: 12px;
  background: #f8fbff;
  text-align: center;
}
.manual-empty strong {
  color: #0f172a;
  font-size: 13px;
}
.manual-empty span,
.manual-about p {
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}
.manual-about {
  margin-top: 18px;
  padding: 14px;
  border: 1px solid #e2eaf4;
  border-radius: 12px;
  background: #f8fbff;
}
.manual-about strong {
  color: #0f172a;
  font-size: 13px;
}
.manual-about p {
  margin: 6px 0 0;
}
.kv-add {
  color: #2563eb;
  background: #eef4ff;
  border-color: #d7e4ff;
}

@media (max-width: 1180px) {
  .wfb-body {
    padding: 12px;
  }
  .wfb-title-strip {
    padding: 16px;
  }
}

/* Screen 25 exact alignment pass */
.wfb-root {
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: #f8fbff !important;
}
.wfb-bar {
  min-height: 64px !important;
  padding: 0 22px !important;
  border-bottom-color: #dbe5f0 !important;
}
.bar-left {
  gap: 12px !important;
}
.sep {
  color: #d8e2ee !important;
}
.lnk::before {
  content: "<";
  margin-right: 8px;
  color: #64748b;
}
.lnk::after,
.pill.dirty::after,
.bar-right > .gbtn::after,
.wf-menu > .gbtn::after {
  content: none !important;
  display: none !important;
}
.wfb-root .lnk {
  font-size: 13px !important;
  font-weight: 750 !important;
  color: #4f6178 !important;
}
.name-display {
  padding: 0 !important;
  font-size: 14px !important;
  font-weight: 850 !important;
}
.pill.ver,
.pill.dirty,
.pill.ok {
  padding: 5px 10px !important;
  font-size: 11px !important;
  font-weight: 850 !important;
}
.secondary-action {
  display: none !important;
}
.bar-right {
  gap: 10px !important;
}
.gbtn {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  min-width: 78px;
  height: 38px !important;
  padding: 0 16px !important;
  border-radius: 8px !important;
  font-size: 13px !important;
  font-weight: 800 !important;
  line-height: 1 !important;
  background: #ffffff !important;
  border-color: #d4e0ef !important;
  color: #102033 !important;
}
.gbtn.secondary-action {
  display: none !important;
}
.gbtn.run {
  color: #047857 !important;
  background: #ecfdf5 !important;
  border-color: #abe6ce !important;
}
.gbtn.save {
  color: #ffffff !important;
  background: #2d5bf0 !important;
  border-color: #2d5bf0 !important;
}
.wf-menu > .gbtn {
  min-width: 64px;
}
.wfb-title-strip {
  min-height: 76px !important;
  padding: 16px 22px !important;
  background: #ffffff !important;
  border-bottom-color: #dbe5f0 !important;
}
.wfb-title-strip h1 {
  font-size: 22px !important;
  line-height: 1.15 !important;
  font-weight: 850 !important;
}
.wfb-root .wfb-title-strip h1 {
  font-size: 22px !important;
  line-height: 1.15 !important;
  font-weight: 850 !important;
}
.wfb-title-strip p {
  margin-top: 6px !important;
  font-size: 13px !important;
  font-weight: 500 !important;
  color: #51617a !important;
}
.wfb-root .wfb-title-strip p {
  font-size: 13px !important;
  line-height: 1.35 !important;
}
.title-help {
  display: none !important;
}
.wfb-body {
  flex: 1 !important;
  gap: 0 !important;
  padding: 0 !important;
  background: #f8fbff !important;
}
.wfb-palette {
  width: 268px !important;
  min-width: 268px !important;
  max-width: 268px !important;
  border-width: 0 1px 0 0 !important;
  border-color: #dbe5f0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}
.add-node-btn {
  height: 36px !important;
  margin: 12px 16px 10px !important;
  border-radius: 7px !important;
  font-size: 13px !important;
  font-weight: 850 !important;
  background: #2d63ed !important;
  box-shadow: 0 10px 20px rgba(45, 99, 237, 0.22) !important;
}
.pal-search {
  height: 36px !important;
  margin: 0 16px 10px !important;
  padding: 0 14px !important;
  border-radius: 7px !important;
  font-size: 12px !important;
  font-weight: 600 !important;
}
.pal-scroll {
  padding: 0 16px 16px !important;
}
.pal-cat {
  margin-bottom: 10px !important;
}
.pal-cat-h {
  padding: 8px 2px 6px !important;
  font-size: 11px !important;
  letter-spacing: 0 !important;
  color: #7b8da9 !important;
}
.pal-card {
  min-height: 45px !important;
  margin-bottom: 6px !important;
  padding: 7px 9px !important;
  border: 1px solid #dce6f2 !important;
  border-left: 1px solid #dce6f2 !important;
  border-radius: 7px !important;
  background: #ffffff !important;
}
.pal-card-ic {
  width: 28px !important;
  height: 28px !important;
  border-radius: 7px !important;
  background: #eef5ff !important;
}
.pal-card-l {
  font-size: 12px !important;
  font-weight: 850 !important;
}
.pal-card-s {
  margin-top: 1px !important;
  font-size: 10px !important;
  font-weight: 600 !important;
  color: #64748b !important;
}
.pal-more {
  height: 34px !important;
  border-radius: 7px !important;
  font-size: 12px !important;
  font-weight: 850 !important;
}
.canvas-wrap {
  min-height: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  background-color: #fbfdff !important;
  background-image: radial-gradient(#d2dceb 1px, transparent 1px) !important;
  background-size: 24px 24px !important;
}
.canvas-wrap :deep(.vue-flow__background) {
  opacity: 0 !important;
}
.canvas-wrap :deep(.vue-flow__controls) {
  left: 18px !important;
  bottom: 18px !important;
  border-radius: 8px !important;
}
.wfb-guide {
  top: 20px !important;
  width: min(880px, calc(100% - 96px)) !important;
  padding: 22px 24px 18px !important;
  border-radius: 8px !important;
  border-color: #dbe5f0 !important;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.07) !important;
}
.guide-x {
  top: 16px !important;
  right: 18px !important;
  color: #6b7f9b !important;
  font-size: 18px !important;
}
.wfb-guide h2 {
  margin: 0 0 6px !important;
  font-size: 14px !important;
  line-height: 1.25 !important;
  font-weight: 850 !important;
}
.wfb-guide p {
  font-size: 12px !important;
  font-weight: 500 !important;
  color: #60708a !important;
}
.guide-steps {
  display: grid !important;
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 0 !important;
  margin-top: 22px !important;
}
.guide-steps span {
  display: grid !important;
  grid-template-columns: 34px 1fr !important;
  grid-template-rows: auto auto !important;
  column-gap: 12px !important;
  min-height: 58px !important;
  padding: 0 22px 0 0 !important;
  border-right: 1px solid #dfe7f2 !important;
  border-radius: 0 !important;
  background: transparent !important;
  color: #0f172a !important;
  font-size: 12px !important;
}
.guide-steps span:last-child {
  border-right: 0 !important;
}
.guide-steps b {
  grid-row: 1 / span 2;
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: #edf4ff;
  color: #2563eb;
  font-size: 12px;
  font-weight: 850;
}
.guide-steps strong {
  font-size: 12px;
  line-height: 1.25;
  font-weight: 850;
  color: #0f172a;
}
.guide-steps em {
  margin-top: 3px;
  font-style: normal;
  font-size: 11px;
  line-height: 1.35;
  font-weight: 500;
  color: #60708a;
}
.guide-docs {
  margin-top: 12px;
  color: #2563eb;
  font-size: 12px;
  font-weight: 850;
}
.wfb-inspector {
  width: 420px !important;
  min-width: 420px !important;
  max-width: 420px !important;
  border-width: 0 0 0 1px !important;
  border-color: #dbe5f0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}
.ins-sticky {
  min-height: 76px !important;
  padding: 18px 22px !important;
  border-bottom-color: #dbe5f0 !important;
}
.ins-node-icon {
  width: 38px !important;
  height: 38px !important;
  border-radius: 9px !important;
  background: #dff7f3 !important;
  color: #0f766e !important;
}
.ins-node-title strong {
  font-size: 14px !important;
  font-weight: 850 !important;
}
.ins-node-title small {
  font-size: 12px !important;
  font-weight: 500 !important;
  color: #60708a !important;
}
.del {
  width: 30px !important;
  height: 30px !important;
  display: grid !important;
  place-items: center !important;
  font-size: 0 !important;
  color: #718198 !important;
}
.del::after {
  content: "x";
  font-size: 18px;
  line-height: 1;
}
.wfb-inspector > :not(.ins-sticky) {
  margin-left: 22px !important;
  margin-right: 22px !important;
}
.manual-panel {
  padding-top: 12px !important;
}
.ins-l {
  margin: 18px 0 8px !important;
  font-size: 12px !important;
  font-weight: 850 !important;
  color: #1f2f46 !important;
}
.ins-in {
  min-height: 40px !important;
  border-radius: 8px !important;
  border-color: #d6e1ee !important;
  font-size: 13px !important;
  font-weight: 500 !important;
}
textarea.ins-in {
  line-height: 1.45 !important;
}
.manual-section-head {
  margin-top: 20px !important;
}
.manual-section-head strong {
  font-size: 12px !important;
  font-weight: 850 !important;
}
.manual-section-head span {
  display: none !important;
}
.kv-add {
  height: 30px !important;
  padding: 0 12px !important;
  border-radius: 7px !important;
  font-size: 12px !important;
  font-weight: 850 !important;
}
.manual-empty {
  min-height: 134px !important;
  margin-top: 12px !important;
  border-radius: 8px !important;
  border-color: #cfdced !important;
  background: #ffffff !important;
}
.manual-empty strong {
  font-size: 13px !important;
  font-weight: 850 !important;
}
.manual-empty span {
  max-width: 250px;
  font-size: 12px !important;
  font-weight: 500 !important;
}
.manual-about {
  margin-top: 28px !important;
  padding: 18px 20px !important;
  border: 0 !important;
  border-radius: 9px !important;
  background: #f0f6ff !important;
}
.manual-about strong {
  font-size: 13px !important;
  font-weight: 850 !important;
}
.manual-about p {
  margin-top: 12px !important;
  font-size: 12px !important;
  line-height: 1.8 !important;
}

@media (max-width: 1360px) {
  .wfb-palette {
    width: 244px !important;
    min-width: 244px !important;
    max-width: 244px !important;
  }
  .wfb-inspector {
    width: 360px !important;
    min-width: 360px !important;
    max-width: 360px !important;
  }
  .wfb-guide {
    width: min(760px, calc(100% - 64px)) !important;
  }
}

/* Workflow builder 2026 multi-state design */
.wfb-root {
  background: #ffffff !important;
}
.wfb-bar {
  min-height: 72px !important;
  padding: 0 18px !important;
  gap: 20px !important;
  background: #ffffff !important;
  border-bottom: 1px solid #dce5f2 !important;
  box-shadow: 0 1px 0 rgba(15, 23, 42, 0.02) !important;
}
.wf-brand {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 7px;
  background: linear-gradient(145deg, #111b3a, #070d22);
  box-shadow: 0 10px 24px rgba(10, 18, 40, 0.18);
  flex: 0 0 auto;
}
.wf-brand span,
.wf-brand span::before,
.wf-brand span::after {
  display: block;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #ffffff;
  content: "";
}
.wf-brand span {
  position: relative;
  transform: translateY(-6px);
}
.wf-brand span::before {
  position: absolute;
  left: -8px;
  top: 14px;
}
.wf-brand span::after {
  position: absolute;
  right: -8px;
  top: 14px;
}
.bar-left {
  flex: 1;
  gap: 12px !important;
}
.wfb-root .lnk {
  font-size: 15px !important;
  font-weight: 760 !important;
  color: #687895 !important;
}
.lnk::before {
  display: none !important;
}
.sep {
  font-size: 18px !important;
  color: #cbd6e6 !important;
}
.name-display {
  max-width: 460px !important;
  font-size: 16px !important;
  font-weight: 850 !important;
  color: #0b1530 !important;
}
.pill.draft {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  padding: 0 12px !important;
  border: 1px solid #ffd8a8;
  background: #fff4e4;
  color: #b45406;
  border-radius: 10px;
  font-size: 13px !important;
  font-weight: 850 !important;
}
.pill.draft::before {
  content: "";
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #fb8c00;
}
.bar-right {
  gap: 14px !important;
}
.reset-action,
.secondary-action {
  display: none !important;
}
.gbtn {
  min-width: 96px !important;
  height: 42px !important;
  padding: 0 18px !important;
  border-radius: 8px !important;
  border-color: #d5dfed !important;
  background: #ffffff !important;
  color: #17233b !important;
  font-size: 14px !important;
  font-weight: 820 !important;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.03) !important;
}
.gbtn.run {
  min-width: 124px !important;
  background: #ecfff6 !important;
  color: #058047 !important;
  border-color: #6bd6a8 !important;
}
.gbtn.run::after {
  content: "⌄" !important;
  display: inline !important;
  margin-left: 14px;
  color: #058047;
}
.gbtn.save::after {
  content: "⌄" !important;
  display: inline !important;
  margin-left: 12px;
}
.gbtn.save {
  min-width: 132px !important;
  color: #ffffff !important;
  background: #1f5af6 !important;
  border-color: #1f5af6 !important;
  box-shadow: 0 10px 24px rgba(31, 90, 246, 0.22) !important;
}
.more-btn {
  min-width: 58px !important;
  width: 58px !important;
  padding: 0 !important;
  font-size: 20px !important;
  letter-spacing: 2px !important;
}
.wfb-title-strip {
  display: none !important;
}
.wfb-body {
  height: calc(100% - 72px) !important;
  background: #ffffff !important;
}
.wfb-palette {
  width: 292px !important;
  min-width: 292px !important;
  max-width: 292px !important;
  display: flex !important;
  flex-direction: column !important;
  border-color: #dce5f2 !important;
}
.add-node-btn {
  height: 42px !important;
  margin: 16px 18px 12px !important;
  border-radius: 8px !important;
  font-size: 15px !important;
  background: #245cff !important;
}
.add-node-btn::after {
  content: "⌄";
  margin-left: auto;
  font-size: 14px;
}
.pal-search {
  height: 42px !important;
  margin: 0 18px 16px !important;
  padding-left: 42px !important;
  font-size: 14px !important;
  background: #ffffff;
  box-shadow: inset 0 0 0 1px #dce5f2;
}
.wfb-palette::before {
  content: "⌕";
  position: absolute;
  left: 32px;
  top: 76px;
  z-index: 1;
  color: #7e8aa3;
  font-size: 18px;
}
.pal-scroll {
  flex: 1 !important;
  padding: 0 18px 14px !important;
}
.pal-cat-h {
  padding: 10px 0 8px !important;
  text-transform: uppercase;
  color: #60708a !important;
  font-size: 12px !important;
  font-weight: 850 !important;
}
.pal-card {
  min-height: 56px !important;
  padding: 9px 12px !important;
  margin-bottom: 8px !important;
  border-radius: 8px !important;
  border-color: #dce5f2 !important;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.025) !important;
}
.pal-card:hover {
  border-color: #2b62ff !important;
  box-shadow: 0 10px 22px rgba(37, 99, 235, 0.1) !important;
}
.pal-card-ic {
  width: 34px !important;
  height: 34px !important;
  border-radius: 8px !important;
  background: #eef4ff !important;
}
.pal-card.fam-trigger .pal-card-ic { background: #f0e9ff !important; }
.pal-card.fam-agent .pal-card-ic { background: #e8fbff !important; }
.pal-card.fam-action .pal-card-ic { background: #edfdf4 !important; }
.pal-card.fam-logic .pal-card-ic { background: #fff4dd !important; }
.pal-card-l {
  font-size: 13px !important;
  color: #111b34 !important;
}
.pal-card-s {
  font-size: 11px !important;
  color: #5f6f89 !important;
}
.pal-more {
  height: 36px !important;
  margin-top: 10px !important;
  border-radius: 8px !important;
  background: #f4f7ff !important;
}
.pal-footer {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
  padding: 16px 18px 18px;
  border-top: 1px solid #dce5f2;
}
.pal-footer button {
  height: 28px;
  color: #6b7d99;
  font-size: 22px;
  font-weight: 700;
}
.canvas-wrap {
  background-color: #fbfdff !important;
  background-image: radial-gradient(#cbd9ed 1.15px, transparent 1.15px) !important;
  background-size: 24px 24px !important;
}
.wfb-guide {
  top: 34px !important;
  width: min(820px, calc(100% - 96px)) !important;
  padding: 30px 34px 26px !important;
  border-radius: 9px !important;
  background: #ffffff !important;
  border-color: #dce5f2 !important;
}
.wfb-guide h2 {
  font-size: 20px !important;
}
.wfb-guide p {
  font-size: 14px !important;
}
.guide-steps {
  margin-top: 28px !important;
}
.guide-steps strong {
  font-size: 13px !important;
}
.guide-steps em {
  font-size: 12px !important;
}
.guide-docs {
  margin-top: 22px !important;
  font-size: 13px !important;
}
.log-reopen {
  right: 22px !important;
  bottom: 22px !important;
}
.wfb-inspector {
  width: 410px !important;
  min-width: 410px !important;
  max-width: 410px !important;
  background: #ffffff !important;
}
.ins-sticky {
  min-height: 108px !important;
  padding: 22px 22px 14px !important;
}
.ins-sticky::after {
  content: "Configure    Settings";
  position: absolute;
  left: 22px;
  right: 22px;
  bottom: 0;
  height: 38px;
  border-bottom: 1px solid #dce5f2;
  color: #2563eb;
  white-space: pre;
  font-size: 14px;
  font-weight: 850;
  line-height: 38px;
  box-shadow: inset 0 -2px 0 #2563eb;
}
.ins-node-icon {
  width: 48px !important;
  height: 48px !important;
  border-radius: 10px !important;
  background: #efe7ff !important;
  color: #7c3aed !important;
}
.ins-node-title strong {
  font-size: 16px !important;
}
.ins-node-title small {
  font-size: 13px !important;
}
.ins-node-title::after {
  content: "Enabled";
  margin-left: auto;
  padding: 6px 12px;
  border-radius: 999px;
  background: #ddfbea;
  color: #10a464;
  font-size: 12px;
  font-weight: 850;
}
.manual-panel,
.wfb-inspector > :not(.ins-sticky) {
  padding-top: 10px !important;
}
.ins-l {
  font-size: 13px !important;
}
.ins-in {
  min-height: 46px !important;
  border-radius: 8px !important;
  font-size: 14px !important;
}
textarea.ins-in {
  min-height: 92px !important;
}
.manual-empty {
  min-height: 126px !important;
}
.manual-about {
  background: #f4f7ff !important;
}
.cmd-pal {
  width: 660px !important;
  max-width: min(660px, 92vw) !important;
  margin-top: 86px !important;
  border: 1px solid #dce5f2;
  border-radius: 10px !important;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.18) !important;
}
.cmd-pal::before {
  content: "Add a node\aChoose a node to add to your workflow.";
  display: block;
  white-space: pre;
  padding: 24px 26px 8px;
  color: #102033;
  font-size: 20px;
  line-height: 1.55;
  font-weight: 850;
}
.cmd-search {
  height: 44px !important;
  margin: 0 26px 14px;
  padding: 0 16px !important;
  border: 1px solid #dce5f2 !important;
  border-radius: 8px !important;
  font-size: 14px !important;
}
.cmd-body {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  padding: 0 26px 26px !important;
}
.cmd-grp {
  display: contents;
}
.cmd-grp-h {
  grid-column: 1 / -1;
  padding: 12px 0 2px !important;
  color: #233552 !important;
  font-size: 12px !important;
}
.cmd-item {
  min-height: 68px;
  align-items: center;
  gap: 10px;
  padding: 12px !important;
  border: 1px solid #dce5f2;
  border-radius: 8px !important;
  background: #ffffff;
}
.cmd-ic {
  width: 32px !important;
  height: 32px !important;
}
.cmd-l {
  font-size: 12px !important;
  font-weight: 850 !important;
}
.cmd-s {
  font-size: 10.5px !important;
  color: #60708a !important;
}
.cmd-foot {
  display: none !important;
}
.gbtn svg {
  width: 16px;
  height: 16px;
  margin-right: 8px;
  stroke-width: 2.2;
}
.more-btn svg,
.gbtn.run::after,
.gbtn.save::after {
  margin-right: 0;
}
.pal-card-ic::before,
.cmd-ic::before,
.ins-node-icon::before {
  content: none !important;
  display: none !important;
}
.pal-card-ic,
.cmd-ic,
.ins-node-icon {
  color: #2563eb;
}
.pal-card-ic svg,
.cmd-ic svg,
.ins-node-icon svg {
  width: 18px;
  height: 18px;
  display: block;
}
.pal-card.fam-trigger .pal-card-ic,
.cmd-ic.fam-trigger,
.ins-node-icon {
  color: #7c3aed;
}
.pal-card.fam-agent .pal-card-ic,
.cmd-ic.fam-agent {
  color: #4f46e5;
}
.pal-card.fam-action .pal-card-ic,
.cmd-ic.fam-action {
  color: #0f9f6e;
}
.pal-card.fam-logic .pal-card-ic,
.cmd-ic.fam-logic {
  color: #f59e0b;
}
.log-h > span:first-child {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}
.log-head-ic {
  width: 14px;
  height: 14px;
}
.log-line {
  align-items: flex-start;
}
.log-ic {
  width: 14px;
  height: 14px;
  margin-top: 1px;
  flex-shrink: 0;
}
.lv-info .log-ic { color: #60a5fa; }
.lv-success .log-ic { color: #22c55e; }
.lv-warn .log-ic { color: #f59e0b; }
.lv-error .log-ic { color: #ef4444; }
.log-reopen svg {
  width: 14px;
  height: 14px;
  color: #2563eb;
}

@media (max-width: 1360px) {
  .wfb-palette {
    width: 270px !important;
    min-width: 270px !important;
    max-width: 270px !important;
  }
  .wfb-inspector {
    width: 360px !important;
    min-width: 360px !important;
    max-width: 360px !important;
  }
  .cmd-body {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

/* Final workflow-builder screen matching fixes */
.wfb-root,
.wfb-body,
.canvas-wrap {
  min-width: 0 !important;
  overflow: hidden !important;
}
.pal-card-ic::before,
.pal-card-ic::after,
.cmd-ic::before,
.cmd-ic::after,
.ins-node-icon::before,
.ins-node-icon::after {
  content: none !important;
  display: none !important;
}
.pal-card-ic,
.cmd-ic,
.ins-node-icon {
  display: grid !important;
  place-items: center !important;
  font-size: 0 !important;
}
.pal-card-ic svg,
.cmd-ic svg,
.ins-node-icon svg {
  display: block !important;
  width: 19px !important;
  height: 19px !important;
}
.webhook-panel {
  padding-top: 8px;
}
.webhook-panel .ins-note {
  margin: 0 0 16px;
  color: #51617a;
  font-size: 13px;
  line-height: 1.55;
}
.endpoint-box {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 74px;
  padding: 14px 14px;
  border: 1px solid #d6e1ee;
  border-radius: 8px;
  background: #fbfdff;
}
.endpoint-box code {
  flex: 1;
  color: #40506a;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.55;
  white-space: normal;
  word-break: break-word;
}
.endpoint-box button {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 7px;
  color: #60708a;
}
.endpoint-box svg,
.test-here svg {
  width: 16px;
  height: 16px;
}
.test-here {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 42px;
  margin-top: 22px;
  border: 1px solid #bfcfff;
  border-radius: 8px;
  background: #eef3ff;
  color: #2553d8;
  font-size: 14px;
  font-weight: 850;
}
.log-console {
  border-radius: 0 !important;
}
.log-reopen {
  border-radius: 10px !important;
  background: #ffffff !important;
}
.run-banner {
  position: absolute;
  top: 28px;
  left: 42px;
  right: 42px;
  z-index: 5;
  padding: 20px 22px 18px;
  border: 1px solid #dce5f2;
  border-radius: 14px;
  background: rgba(255,255,255,0.98);
  box-shadow: 0 14px 36px rgba(15, 23, 42, 0.09);
}
.run-title {
  display: flex;
  align-items: center;
  gap: 14px;
}
.run-title h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 850;
  color: #0f172a;
}
.run-title p {
  margin: 4px 0 0;
  font-size: 13px;
  color: #60708a;
}
.run-title > button {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 16px;
  border: 1px solid #dce5f2;
  border-radius: 8px;
  color: #2563eb;
  font-size: 13px;
  font-weight: 850;
}
.spin {
  animation: wfSpin 1s linear infinite;
}
@keyframes wfSpin { to { transform: rotate(360deg); } }
.run-metrics {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0;
  margin-top: 20px;
}
.run-metrics span {
  padding: 0 22px;
  border-left: 1px solid #e2e8f0;
}
.run-metrics span:first-child {
  border-left: 0;
  padding-left: 0;
}
.run-metrics small {
  display: block;
  color: #64748b;
  font-size: 12px;
  margin-bottom: 7px;
}
.run-metrics b {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  color: #0f172a;
  font-size: 22px;
  font-weight: 850;
}
.run-metrics svg {
  width: 18px;
  height: 18px;
}
.run-timeline {
  position: absolute;
  left: 74px;
  right: 36px;
  bottom: 44px;
  z-index: 6;
  max-height: 42vh;
  display: flex;
  flex-direction: column;
  padding: 16px 20px 14px;
  border: 1px solid #dce5f2;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.1);
}
.timeline-body { overflow-y: auto; }
.tl-head-ic { vertical-align: -2px; margin-right: 6px; color: #2563eb; }
.tl-head-btn { font-size: 12px; font-weight: 700; color: #2563eb; padding: 4px 10px; border-radius: 7px; }
.tl-head-btn:hover { background: #eff4ff; }
.tl-reopen {
  position: absolute; left: 74px; z-index: 6;
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11.5px; font-weight: 700; color: #2563eb;
  background: #fff; border: 1px solid #dce5f2; border-radius: 9px;
  padding: 6px 12px; box-shadow: 0 4px 14px rgba(15,23,42,.1);
}
.tl-reopen:hover { background: #f5f8ff; }
.tl-reopen .log-summary { color: #94a3b8; font-weight: 600; }
.timeline-head,
.timeline-row {
  display: grid;
  grid-template-columns: 110px 28px 180px 1fr 110px;
  align-items: center;
  gap: 10px;
}
.timeline-head {
  display: flex;
  gap: 16px;
  padding-bottom: 12px;
  color: #0f172a;
}
.timeline-head span {
  color: #94a3b8;
  font-size: 12px;
}
.timeline-head button {
  margin-left: auto;
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}
.timeline-row {
  width: 100%;
  min-height: 46px;
  padding: 0 8px;
  border-top: 1px solid #edf2f7;
  text-align: left;
}
.timeline-row:hover {
  background: #f8fbff;
}
.timeline-row span,
.timeline-row em {
  color: #64748b;
  font-size: 12px;
  font-style: normal;
}
.timeline-row strong {
  color: #0f172a;
  font-size: 13px;
}
.timeline-row b {
  justify-self: end;
  color: #64748b;
  font-size: 12px;
  font-weight: 750;
}
.timeline-row svg.success { color: #10b981; }
.timeline-row svg.running { color: #2563eb; animation: wfSpin 1s linear infinite; }
.timeline-row svg.warning { color: #f59e0b; }
.timeline-row b.running {
  padding: 5px 12px;
  border-radius: 999px;
  background: #eef4ff;
  color: #2563eb;
}
.timeline-row b.warning { color: #f59e0b; }
.timeline-row svg.failed { color: #ef4444; }
.timeline-row svg.skipped, .timeline-row svg.pending, .timeline-row svg.waiting { color: #94a3b8; }
.timeline-row b.failed { color: #ef4444; }
.timeline-row.active { background: #f1f5ff; box-shadow: inset 3px 0 0 #2563eb; }
.tl-badge { padding: 3px 10px; border-radius: 999px; background: #eef4ff; color: #2563eb; font-size: 11px; font-weight: 750; justify-self: end; }
.wf-menu-sep { margin: 6px 6px 3px; padding-top: 6px; border-top: 1px solid #eef2f7; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #94a3b8; }
.condition-head {
  margin-top: 18px;
}
.condition-head strong,
.condition-section strong {
  display: block;
  color: #0f172a;
  font-size: 13px;
  font-weight: 850;
}
.condition-head span,
.condition-section span {
  display: block;
  margin-top: 6px;
  color: #64748b;
  font-size: 12px;
}
.condition-builder {
  margin-top: 14px;
  padding: 12px;
  border: 1px solid #dce5f2;
  border-radius: 10px;
}
.condition-row {
  display: grid;
  grid-template-columns: 1fr 82px 1fr 32px;
  gap: 8px;
  align-items: end;
  margin-bottom: 10px;
}
.condition-row label span {
  display: block;
  margin: 0 0 6px;
  color: #64748b;
  font-size: 11px;
  font-weight: 750;
}
.condition-row .ins-in {
  min-height: 36px !important;
  font-size: 12px !important;
}
.condition-del {
  display: grid;
  place-items: center;
  height: 36px;
  color: #94a3b8;
}
.condition-del svg {
  width: 15px;
  height: 15px;
}
.condition-join {
  width: 84px;
  height: 36px;
  margin-bottom: 10px;
  border: 1px solid #dce5f2;
  border-radius: 8px;
  color: #334155;
  font-size: 12px;
  font-weight: 750;
}
.condition-add {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 12px;
  border: 1px solid #bfcfff;
  border-radius: 8px;
  color: #2563eb;
  font-size: 13px;
  font-weight: 850;
}
.condition-section {
  margin-top: 20px;
  padding-top: 18px;
  border-top: 1px solid #edf2f7;
}
.fallback-box,
.condition-section code {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 42px;
  margin-top: 12px;
  padding: 0 12px;
  border: 1px solid #dce5f2;
  border-radius: 8px;
  background: #ffffff;
  color: #334155;
  font-size: 12px;
}
.fallback-box b {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 7px;
  background: #ffe4e9;
  color: #e11d48;
}
.advanced-row {
  margin-top: 20px;
  color: #475569;
  font-size: 12px;
}
.advanced-row summary {
  cursor: pointer;
  font-weight: 800;
}
.canvas-wrap:has(.run-banner) .wfb-guide,
.canvas-wrap:has(.run-banner) .log-reopen,
.canvas-wrap:has(.run-banner) .log-console {
  display: none !important;
}

/* Add-node modal: screen workflow-builder-screens reference */
.pal-scrim {
  align-items: flex-start;
  background: rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(2px);
}
.cmd-pal {
  width: min(760px, calc(100vw - 40px)) !important;
  max-height: min(82vh, 890px) !important;
  margin-top: 88px !important;
  border: 1px solid #e2e8f0 !important;
  border-radius: 14px !important;
  background: #fff !important;
  box-shadow: 0 26px 70px rgba(15, 23, 42, 0.18) !important;
  overflow: hidden !important;
}
.cmd-pal::before {
  display: none !important;
}
.cmd-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 26px 28px 12px;
}
.cmd-head h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: #0f172a;
}
.cmd-head p {
  margin: 7px 0 0;
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
}
.cmd-close {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  color: #64748b;
  font-size: 20px;
  line-height: 1;
}
.cmd-close:hover {
  background: #f8fafc;
  color: #0f172a;
}
.cmd-search-wrap {
  position: relative;
  margin: 0 28px;
}
.cmd-search-wrap .cmd-search {
  width: 100%;
  height: 46px;
  padding: 0 58px 0 42px !important;
  border: 1px solid #dbe4f0 !important;
  border-radius: 8px !important;
  background: #fff !important;
  color: #0f172a !important;
  font-size: 14px !important;
  font-weight: 600 !important;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.03);
}
.cmd-search-wrap .cmd-search:focus {
  border-color: #93b4ff !important;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.11);
}
.cmd-search-ic {
  position: absolute;
  left: 15px;
  top: 50%;
  width: 18px;
  height: 18px;
  transform: translateY(-50%);
  color: #8a98ad;
  pointer-events: none;
}
.cmd-search-wrap kbd {
  position: absolute;
  right: 13px;
  top: 50%;
  transform: translateY(-50%);
  border: 0;
  color: #94a3b8;
  background: transparent;
  font-size: 12px;
  font-weight: 800;
}
.cmd-tabs {
  display: flex;
  align-items: center;
  gap: 24px;
  margin: 14px 28px 0;
  border-bottom: 1px solid #e2e8f0;
  overflow-x: auto;
}
.cmd-tabs button {
  position: relative;
  height: 42px;
  color: #64748b;
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
}
.cmd-tabs button.active {
  color: #2563eb;
}
.cmd-tabs button.active::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 3px;
  border-radius: 999px 999px 0 0;
  background: #2563eb;
}
.cmd-body {
  padding: 18px 28px 26px !important;
}
.cmd-featured {
  margin-bottom: 18px;
}
.cmd-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  color: #0f172a;
  font-size: 12px;
  font-weight: 900;
}
.cmd-section-head button {
  color: #2563eb;
  font-size: 12px;
  font-weight: 800;
}
.cmd-feature-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.cmd-feature-card {
  min-height: 116px;
  padding: 15px;
  border: 1px solid #dbe4f0;
  border-radius: 8px;
  background: #fff;
  text-align: left;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.03);
}
.cmd-feature-card:hover,
.cmd-item:hover {
  border-color: #b9cdfb;
  background: #fbfdff;
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.07);
}
.cmd-feature-title {
  display: block;
  margin-top: 10px;
  color: #0f172a;
  font-size: 13px;
  font-weight: 900;
}
.cmd-feature-sub {
  display: block;
  margin-top: 4px;
  color: #64748b;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.35;
}
.cmd-grp {
  margin: 18px 0 0 !important;
}
.cmd-grp-h {
  padding: 0 0 9px !important;
  color: #334155 !important;
  font-size: 12px !important;
  font-weight: 900 !important;
  letter-spacing: 0 !important;
  text-transform: none !important;
}
.cmd-grp-n {
  margin-left: 4px;
  color: #94a3b8;
}
.cmd-grp > template,
.cmd-grp {
  --cmd-row-gap: 10px;
}
.cmd-item {
  display: inline-flex !important;
  width: calc(25% - 9px) !important;
  min-height: 58px;
  margin: 0 8px 10px 0;
  padding: 10px 12px !important;
  border: 1px solid #dbe4f0;
  border-radius: 8px !important;
  background: #fff;
  vertical-align: top;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.03);
}
.cmd-ic {
  width: 32px !important;
  height: 32px !important;
  border-radius: 8px !important;
}
.cmd-ic.fam-trigger {
  background: #ede9fe !important;
  color: #7c3aed;
}
.cmd-ic.fam-agent {
  background: #eef2ff !important;
  color: #4f46e5;
}
.cmd-ic.fam-action {
  background: #dcfce7 !important;
  color: #059669;
}
.cmd-ic.fam-logic {
  background: #fff7ed !important;
  color: #f97316;
}
.cmd-l {
  color: #0f172a !important;
  font-size: 12px !important;
  font-weight: 900 !important;
}
.cmd-s {
  color: #64748b !important;
  font-size: 10px !important;
  font-weight: 600 !important;
}
.cmd-foot {
  display: none !important;
}
@media (max-width: 820px) {
  .cmd-pal {
    margin-top: 34px !important;
  }
  .cmd-feature-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .cmd-item {
    width: calc(50% - 8px) !important;
  }
}
@media (max-width: 520px) {
  .cmd-feature-grid {
    grid-template-columns: 1fr;
  }
  .cmd-item {
    width: 100% !important;
    margin-right: 0;
  }
}
</style>




