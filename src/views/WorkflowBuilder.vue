<template>
  <div class="wfb-root">
    <!-- Top bar -->
    <div class="wfb-bar">
      <div class="bar-left">
        <button class="lnk" @click="goBack">← Workflows</button>
        <span class="sep">/</span>
        <input v-if="renaming" ref="nameInputEl" v-model="nameDraft" class="name-in"
          @keydown.enter="commitRename" @keydown.esc="cancelRename" @blur="commitRename" />
        <button v-else class="name-display" @click="startRename" title="Click to rename">
          {{ name || 'Untitled workflow' }}<span class="name-edit">✎</span>
        </button>
        <span class="pill ver">v{{ version }}</span>
        <span v-if="dirty" class="pill dirty">● Unsaved</span>
        <span v-else class="pill ok">Saved</span>
      </div>
      <div class="bar-right">
        <button class="gbtn" :class="{ on: logOpen }" @click="toggleLog()">Log</button>
        <button class="gbtn" @click="openVersions">Versions</button>
        <button class="gbtn" @click="openRuns">Runs</button>
        <button class="gbtn" :disabled="busy" @click="validateGraph">Validate</button>
        <button v-if="!running" class="gbtn" :disabled="busy" @click="runGraph(true)" title="Test run — simulates side-effects, no real sends/spend">🧪 Test</button>
        <button v-if="!running" class="gbtn run" :disabled="busy" @click="runGraph(false)">▶ Run</button>
        <button v-else class="gbtn stop" @click="stopRun">⏹ Stop</button>
        <button v-if="dirty" class="gbtn" :disabled="busy" @click="resetChanges" title="Discard unsaved changes">Reset</button>
        <button class="gbtn" :disabled="busy" @click="save">{{ busy ? 'Saving…' : 'Save' }}</button>
        <button class="gbtn save" :disabled="busy" @click="publish">Publish</button>
        <div class="wf-menu">
          <button class="gbtn" @click="menuOpen = !menuOpen" title="More">⋯</button>
          <div v-if="menuOpen" class="wf-menu-back" @click="menuOpen = false"></div>
          <div v-if="menuOpen" class="wf-menu-pop" @click="menuOpen = false">
            <button @click="duplicateWorkflow">⧉ Duplicate</button>
            <button class="danger" @click="deleteWorkflow">🗑 Delete workflow</button>
          </div>
        </div>
      </div>
    </div>

    <div class="wfb-body">
      <!-- Left palette (resizable, searchable, category-grouped) -->
      <aside v-show="!paletteCollapsed" class="wfb-palette" :style="{ width: paletteW + 'px' }">
        <button class="add-node-btn" @click="openPalette()">＋ Add node <kbd>⌘K</kbd></button>
        <input v-model="sidebarSearch" class="pal-search" placeholder="Search nodes…" />
        <div class="pal-scroll">
          <p v-if="!sidebarGroups.length" class="pal-empty">No nodes match “{{ sidebarSearch }}”.</p>
          <div v-for="g in sidebarGroups" :key="g.key" class="pal-cat">
            <div class="pal-cat-h">{{ g.label }}</div>
            <div v-for="p in g.items" :key="p.type" class="pal-card" :class="'fam-' + p.type.split('.')[0]"
              draggable="true" @dragstart="onDragStart($event, p.type)" @click="addQuick(p.type)" :title="'Drag to canvas or click to add — ' + p.sub">
              <span class="pal-card-ic">{{ p.icon }}</span>
              <span class="pal-card-txt"><span class="pal-card-l">{{ p.label }}</span><span class="pal-card-s">{{ p.sub }}</span></span>
            </div>
          </div>
          <button class="pal-more" @click="openPalette()">Browse tools &amp; MCP →</button>
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

        <!-- empty canvas hero -->
        <div v-if="!loading && !nodeCount" class="canvas-empty">
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
            <span>Run log</span>
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
              <span class="log-t">{{ e.t }}</span><span class="log-msg">{{ e.text }}</span>
            </div>
          </div>
        </div>
        <!-- collapsed-log reopen pill -->
        <button v-else class="log-reopen" @click="toggleLog()">▴ Run log <span class="log-summary">{{ runSummary }}</span></button>
      </div>

      <!-- inspector divider + collapse tab -->
      <div v-show="!inspectorCollapsed" class="wfb-divider v" @pointerdown="startResize('inspector', $event)"></div>
      <button class="wfb-tab tab-right" :title="inspectorCollapsed ? 'Show inspector' : 'Hide inspector'" @click="toggleInspector">{{ inspectorCollapsed ? '«' : '»' }}</button>

      <!-- Inspector -->
      <aside class="inspector wfb-inspector" v-if="selected && !inspectorCollapsed" :style="{ width: inspectorW + 'px' }">
        <div class="ins-h ins-sticky">
          <span>{{ selected.type }}</span>
          <button class="del" @click="deleteSelected" title="Delete node">🗑</button>
        </div>
        <!-- shared tool-name autocomplete (used by foreach inner-tool; SchemaForm makes its own per field) -->
        <datalist id="wf-tools"><option v-for="t in toolNames" :key="t" :value="t" /></datalist>

        <template v-if="selected.type === 'agent.run'">
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
          <p class="ins-note">Save the graph to generate this webhook's URL, then POST to it to start a run.</p>
          <div v-if="webhookFor(selected.id)" class="ins-out">POST {{ webhookFor(selected.id) }}</div>
          <p v-else class="ins-hint">URL appears after the first save.</p>
        </template>

        <template v-else-if="selected.type === 'logic.foreach'">
          <label class="ins-l">Items</label>
          <input v-model="selected.data.items_template" class="ins-in mono"
            placeholder="{{node.<id>.text}} or {{trigger.items}}" @input="markDirty" />
          <p class="ins-hint">A JSON array or comma-separated list. Each entry is available as <code>&#123;&#123;item&#125;&#125;</code>.</p>
          <label class="ins-l">Run per item</label>
          <select v-model="selected.data.do.type" class="ins-in" @change="markDirty">
            <option value="action.channel">Send to channel</option>
            <option value="action.tool">Run tool</option>
            <option value="action.http">HTTP request</option>
          </select>
          <template v-if="selected.data.do.type === 'action.channel'">
            <label class="ins-l">Channel</label>
            <select v-model="selected.data.do.data.kind" class="ins-in" @change="markDirty">
              <option value="log">Log</option><option value="slack">Slack</option><option value="webhook">Webhook</option>
            </select>
            <input v-if="selected.data.do.data.kind === 'slack'" v-model="selected.data.do.data.slack_channel" class="ins-in" placeholder="#general" @input="markDirty" />
            <input v-if="selected.data.do.data.kind === 'webhook'" v-model="selected.data.do.data.url" class="ins-in" placeholder="https://…" @input="markDirty" />
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
        </template>

        <!-- schema-driven config (manual / schedule / channel-trigger / tool / script / channel / http / condition / delay / approval / subworkflow) -->
        <template v-else>
          <SchemaForm :data="selected.data" :fields="defFields(selected.type) || []"
            :lists="{ tools: toolNames, graphs: subgraphOptions.map(g => [g.id, g.name]) }"
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

        <label class="ins-l">Notes</label>
        <textarea v-model="selected.data.notes" rows="2" class="ins-in" placeholder="Optional note shown on the node" @input="markDirty"></textarea>

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

        <div class="ins-actions">
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
          <div class="ins-empty-ic">⚙️</div>
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
          <input ref="palSearchEl" v-model="paletteSearch" class="cmd-search" placeholder="Search nodes, tools, connectors, MCP…" @keydown.esc="showPalette = false" />
          <div class="cmd-body">
            <p v-if="paletteLoading" class="cmd-empty">Loading catalog…</p>
            <p v-else-if="!paletteGroups.length" class="cmd-empty">No matches for “{{ paletteSearch }}”.</p>
            <div v-for="grp in paletteGroups" :key="grp.key" class="cmd-grp">
              <div class="cmd-grp-h" :class="{ 'cmd-grp-toggle': grp.collapsible }" @click="grp.collapsible && toggleGroup(grp)">
                <span v-if="grp.collapsible" class="cmd-caret">{{ isGroupOpen(grp) ? '▾' : '▸' }}</span>
                {{ grp.label }}<span class="cmd-grp-n">{{ grp.items.length }}</span>
              </div>
              <template v-if="isGroupOpen(grp)">
                <button v-for="it in grp.items" :key="it.key" class="cmd-item" @click="addFromPalette(it)">
                  <span class="cmd-ic" :class="'fam-' + (it.family || 'action')">{{ it.icon }}</span>
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
const showRuns = ref(false)
const runs = ref([])
const runDetail = ref(null)
const activeRunId = ref(null)
const version = ref(1)
const toolNames = ref([])
const graphTriggers = ref([])
const advOpen = ref(false)
const allGraphs = ref([])      // for sub-workflow picker
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
const logOpen = ref(_lp.logOpen)
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

const palette = wfPaletteItems()   // from the central registry

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
    .map(g => ({ ...g, items: palette.filter(p => p.type.split('.')[0] === g.key && m(p.label, p.sub, p.type)) }))
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

// logs dock
function toggleLog() { logOpen.value = !logOpen.value; persistLayout() }
const runSummary = computed(() => {
  if (running.value) return 'Running…'
  const r = runDetail.value || runs.value[0]
  if (!r) return 'No runs yet'
  const dur = r.duration_ms != null ? ' · ' + fmtDuration(r.duration_ms) : ''
  return `Run #${r.id} · ${r.status}${dur}`
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
  const tag = (e.target?.tagName || '').toLowerCase()
  if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return
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
    let g, ag, allG
    try {
      const { data } = await api.getWorkflowGraphBundle(graphId)
      g = data.graph
      ag = data.agents
      allG = data.all_graphs
    } catch (bundleErr) {
      const [{ data: gd }, { data: agd }, gl] = await Promise.all([
        api.getWorkflowGraph(graphId),
        api.getAgents().catch(() => ({ data: [] })),
        api.getWorkflowGraphs().catch(() => ({ data: [] })),
      ])
      g = gd; ag = agd; allG = gl?.data
    }
    name.value = g.name
    version.value = g.version || 1
    graphTriggers.value = g.triggers || []
    agents.value = (ag?.results || ag || [])
    allGraphs.value = (allG?.results || allG || [])
    const graph = g.graph || {}
    setNodes((graph.nodes || []).map(n => ({ ...n, data: hydrate(n.type, n.data || {}) })))
    setEdges(graph.edges || [])
    if (graph.viewport && setViewport) { try { setViewport(graph.viewport) } catch {} }
    loadToolNames()
    dirty.value = false
    _takeSnapshot(g.name, graph)   // baseline for Reset
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
    addLog('warn', '⏹ Stop requested — halting at the next node…')
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
  if (!(await confirm({ title: 'Delete workflow?', message: `Delete “${name.value}”? This can't be undone.`, confirmText: 'Delete', danger: true }))) return
  try {
    await api.deleteWorkflowGraph(graphId)
    notify.success('Workflow deleted')
    router.push('/dashboard/workflow-builder')
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to delete')
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
.del { color: #ef4444; }
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
</style>
