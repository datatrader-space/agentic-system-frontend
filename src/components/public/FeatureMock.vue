<template>
  <!-- Per-feature UI mockup for the Features page. The markup varies a lot per
       feature, so each variant is a branch keyed off block.mock. Styling comes
       from the scoped aadml-public + aadml-public-pages sheets. -->

  <!-- Agent Studio -->
  <div v-if="block.mock === 'agent'" class="feature-ui" :style="tone">
    <div class="ui-top"><span class="ui-dots"><i></i><i></i><i></i></span><span class="ui-name">agent profile · support-assistant</span><span class="ui-pill">Draft</span></div>
    <div class="ui-content agent-config">
      <div class="config-box full"><small>System prompt</small><p>You are a support operator. Ground every answer in the knowledge base and hand off when confidence is insufficient.</p></div>
      <div class="config-box"><small>Model</small><b>GPT-4o</b></div>
      <div class="config-box"><small>Execution</small><b>Assisted</b></div>
      <div class="config-box full"><small>Tools · 6 assigned</small><p>web_search · knowledge_lookup · postgres · send_email · github · slack</p></div>
      <div class="config-box full"><small>Inherited policy</small><b>3 tools require approval · production writes prohibited</b></div>
      <div class="ui-badges"><span class="ui-badge on">temp 0.3</span><span class="ui-badge">8k context</span><span class="ui-badge">handoff: human</span><span class="ui-badge warn">risk ceiling: medium</span></div>
    </div>
    <div class="ui-foot"><div class="ui-stat"><small>Tools</small><b>6 assigned</b></div><div class="ui-stat"><small>Knowledge</small><b>42 sources</b></div><div class="ui-stat"><small>Budget / run</small><b>$5.00</b></div></div>
  </div>

  <!-- Knowledge & RAG -->
  <div v-else-if="block.mock === 'knowledge'" class="feature-ui" :style="tone">
    <div class="ui-top"><span class="ui-dots"><i></i><i></i><i></i></span><span class="ui-name">knowledge base</span><span class="ui-live">indexing</span></div>
    <div class="ui-content">
      <div class="kb-row"><div class="mini-icon" style="--tone:var(--blue-2)">WEB</div><div><b>research-institute.org</b><span>175 pages · crawled 2h ago</span></div><span class="status-pill">indexed</span></div>
      <div class="kb-row"><div class="mini-icon" style="--tone:var(--red-2)">PDF</div><div><b>laboratory-qms.pdf</b><span>88 chunks · 14 cited</span></div><span class="status-pill">indexed</span></div>
      <div class="kb-row"><div class="mini-icon" style="--tone:var(--green-2)">MD</div><div><b>response-protocols.md</b><span>12 chunks · v4</span></div><span class="status-pill">indexed</span></div>
      <div class="kb-row"><div class="mini-icon" style="--tone:var(--amber-2)">XLS</div><div><b>pricing-2026.xlsx</b><span>structured extraction · 64%</span></div><span class="status-pill" style="background:var(--amber-2);color:#8b5b14">embedding</span></div>
      <div class="info-card" style="margin-top:16px"><p style="margin:0"><b>Retrieved citations:</b> QMS §4.2 · protocol 17B · research-institute.org/safety</p></div>
    </div>
    <div class="ui-foot"><div class="ui-stat"><small>Sources</small><b>42</b></div><div class="ui-stat"><small>Chunks</small><b>3,184</b></div><div class="ui-stat"><small>Avg recall</small><b class="pos">0.91</b></div></div>
  </div>

  <!-- Connectors & MCP -->
  <div v-else-if="block.mock === 'connectors'" class="feature-ui" :style="tone">
    <div class="ui-top"><span class="ui-dots"><i></i><i></i><i></i></span><span class="ui-name">connectors</span><span class="ui-pill">12 connected</span></div>
    <div class="ui-content">
      <div class="connector-row"><div class="mini-icon" style="--tone:var(--green-2)">GH</div><div><b>GitHub</b><span>37 tools · OAuth</span></div><span class="status-pill">allow</span></div>
      <div class="connector-row"><div class="mini-icon" style="--tone:var(--blue-2)">SL</div><div><b>Slack</b><span>9 tools · OAuth</span></div><span class="status-pill">allow</span></div>
      <div class="connector-row"><div class="mini-icon" style="--tone:var(--amber-2)">PG</div><div><b>Postgres</b><span>query · update · delete</span></div><span class="status-pill" style="background:var(--amber-2);color:#8b5b14">ask</span></div>
      <div class="connector-row"><div class="mini-icon" style="--tone:var(--violet-2)">MCP</div><div><b>filesystem</b><span>stdio · 14 tools</span></div><span class="status-pill">policy</span></div>
      <div class="connector-row"><div class="mini-icon" style="--tone:var(--red-2)">MCP</div><div><b>stripe-mcp</b><span>SSE · financial actions</span></div><span class="status-pill" style="background:var(--red-2);color:var(--red)">deny</span></div>
      <div class="ui-badges"><span class="ui-badge on">read</span><span class="ui-badge warn">write · ask</span><span class="ui-badge" style="background:var(--red-2);border-color:#ecc9c2;color:var(--red)">destructive · deny</span></div>
    </div>
    <div class="ui-foot"><div class="ui-stat"><small>Tools</small><b>71</b></div><div class="ui-stat"><small>Uptime</small><b class="pos">99.9%</b></div><div class="ui-stat"><small>Vault</small><b>8 keys</b></div></div>
  </div>

  <!-- Let's Code + Daytona -->
  <div v-else-if="block.mock === 'code'" class="feature-ui" :style="tone">
    <div class="ui-top"><span class="ui-dots"><i></i><i></i><i></i></span><span class="ui-name">lets-code · agentic-api</span><span class="ui-pill">Daytona · main</span></div>
    <div class="code-window">
      <div class="file-tree">▾ workspace<br>　▾ config<br>　　onboarding.yml<br>　▾ tests<br>　　test_flow.py<br>　README.md</div>
      <div class="code-pane">@@ onboarding:<br><span class="minus">- verification: optional</span><br><span class="plus">+ verification: required</span><br><span class="plus">+ notify_webhook: true</span><br><br>$ pytest -q<br><span style="color:var(--green)">48 passed · 0 failed</span><br><br><button class="btn" style="padding:9px 13px">Accept hunk</button> <button class="btn secondary" style="padding:9px 13px">Export PR</button></div>
    </div>
    <div class="ui-foot"><div class="ui-stat"><small>Tests</small><b class="pos">48 / 48</b></div><div class="ui-stat"><small>Diff</small><b>+2 −1</b></div><div class="ui-stat"><small>Coverage</small><b>94%</b></div></div>
  </div>

  <!-- Workflow Builder -->
  <div v-else-if="block.mock === 'workflow'" class="feature-ui" :style="tone">
    <div class="ui-top"><span class="ui-dots"><i></i><i></i><i></i></span><span class="ui-name">workflow · customer-resolution</span><span class="ui-pill">draft · autosaved</span></div>
    <div style="height:360px;position:relative;background:radial-gradient(circle,rgba(20,34,29,.13) 1px,transparent 1.3px);background-size:23px 23px">
      <div class="bnode" style="left:6%;top:12%"><small>Webhook</small><b>ticket.created</b><span>validated payload</span></div>
      <div class="bnode" style="left:37%;top:12%"><small>Agent</small><b>Triage & plan</b><span>grounded classification</span></div>
      <div class="bnode" style="right:5%;top:12%"><small>Logic</small><b>Confidence ≥ .92</b><span>branch result</span></div>
      <div class="bnode" style="left:18%;bottom:13%"><small>Tool</small><b>Postgres + Redis</b><span>query and state</span></div>
      <div class="bnode" style="left:49%;bottom:13%"><small>Approval</small><b>Sensitive action</b><span>human authority</span></div>
      <div class="bnode" style="right:4%;bottom:13%"><small>Daytona</small><b>Patch + tests</b><span>artifact output</span></div>
      <div class="bwire" style="left:23%;top:28%;width:170px"></div><div class="bwire" style="left:54%;top:28%;width:170px"></div>
      <div class="bwire" style="left:18%;top:36%;width:180px;transform:rotate(45deg)"></div><div class="bwire" style="left:48%;top:36%;width:180px;transform:rotate(45deg)"></div><div class="bwire" style="left:72%;top:36%;width:150px;transform:rotate(48deg)"></div>
    </div>
    <div class="ui-foot"><div class="ui-stat"><small>Nodes</small><b>6</b></div><div class="ui-stat"><small>Runs today</small><b>24</b></div><div class="ui-stat"><small>p95 latency</small><b>2.1s</b></div></div>
  </div>

  <!-- Browser automation -->
  <div v-else-if="block.mock === 'browser'" class="feature-ui browser-window" :style="tone">
    <div class="browser-bar"><span>● ● ●</span><div class="browser-url">https://portal.public-service.gov/application/4821</div><span style="display:inline-flex;align-items:center;gap:6px;color:var(--red);font-weight:800"><span style="width:7px;height:7px;border-radius:50%;background:var(--red);display:inline-block"></span>REC</span></div>
    <div class="browser-body">
      <div class="portal"><h4>Permit review</h4><div class="form-line"></div><div class="form-line"></div><div class="form-line"></div><div class="form-line" style="width:66%"></div><button class="btn" style="margin-top:15px">Prepare submission</button></div>
      <div class="automation-log">10:42 open page ✓<br>10:43 authenticate ✓<br>10:44 extract applicant data ✓<br>10:45 verify attachments ✓<br>10:46 policy check ✓<br>10:47 submission gated<br><span style="color:var(--red)">waiting for approval</span></div>
    </div>
    <div class="ui-foot"><div class="ui-stat"><small>Steps</small><b>6 / 7</b></div><div class="ui-stat"><small>Evidence</small><b>5 captured</b></div><div class="ui-stat"><small>State</small><b style="color:var(--red)">Gated</b></div></div>
  </div>

  <!-- Android -->
  <div v-else-if="block.mock === 'android'" class="feature-ui" :style="tone">
    <div class="ui-top"><span class="ui-dots"><i></i><i></i><i></i></span><span class="ui-name">android session · pixel-8-042</span><span class="ui-live">recording</span></div>
    <div class="phone-stage" style="min-height:330px">
      <div class="phone"><div class="phone-screen"><div style="font-size:12px;font-weight:850">Field inspection</div><div class="app-line"></div><div class="app-line"></div><div class="app-line" style="height:80px"></div><div class="app-line"></div></div><div class="tap-ring"></div></div>
      <div class="phone-log">device: pixel-8-042<br>adb: connected<br>appium: session active<br>step 8/12: upload evidence<br>artifact: video-004.mp4</div>
    </div>
    <div class="ui-foot"><div class="ui-stat"><small>Device</small><b>pixel-8-042</b></div><div class="ui-stat"><small>Step</small><b>8 / 12</b></div><div class="ui-stat"><small>Artifacts</small><b>4</b></div></div>
  </div>

  <!-- Signals & schedules -->
  <div v-else-if="block.mock === 'signals'" class="feature-ui" :style="tone">
    <div class="ui-top"><span class="ui-dots"><i></i><i></i><i></i></span><span class="ui-name">signals inbox · overnight</span><span class="ui-live">live</span></div>
    <div class="ui-content">
      <div class="signal-row"><div class="signal-time">02:14</div><div><b>github.issue.opened</b><span>Triaged, labelled, and reply drafted</span></div><div class="signal-state">done</div></div>
      <div class="signal-row"><div class="signal-time">03:41</div><div><b>payment.failed</b><span>Dunning workflow started and email sent</span></div><div class="signal-state">done</div></div>
      <div class="signal-row"><div class="signal-time">05:02</div><div><b>metrics.anomaly</b><span>On-call paged with root-cause artifact</span></div><div class="signal-state" style="color:var(--amber)">escalated</div></div>
      <div class="signal-row"><div class="signal-time">06:30</div><div><b>digest.schedule</b><span>Morning summary generated</span></div><div class="signal-state">done</div></div>
      <div class="info-card" style="margin-top:16px"><p style="margin:0">18 signals handled · 0 dead-letter · $1.27 spent</p></div>
    </div>
    <div class="ui-foot"><div class="ui-stat"><small>Handled</small><b>18</b></div><div class="ui-stat"><small>Dead-letter</small><b class="pos">0</b></div><div class="ui-stat"><small>Spend</small><b>$1.27</b></div></div>
  </div>

  <!-- Media pipeline -->
  <div v-else-if="block.mock === 'media'" class="feature-ui" :style="tone">
    <div class="ui-top"><span class="ui-dots"><i></i><i></i><i></i></span><span class="ui-name">media pipeline · campaign-q3</span><span class="ui-live">rendering</span></div>
    <div class="ui-content">
      <div class="media-steps"><div class="media-step"><b>Brief</b><span>complete</span></div><div class="media-step"><b>Script</b><span>complete</span></div><div class="media-step"><b>Image</b><span>complete</span></div><div class="media-step"><b>Video</b><span>72%</span></div><div class="media-step"><b>Publish</b><span>waiting</span></div></div>
      <div class="media-preview"></div>
    </div>
    <div class="ui-foot"><div class="ui-stat"><small>Stage</small><b>4 / 5</b></div><div class="ui-stat"><small>ETA</small><b>~3 min</b></div><div class="ui-stat"><small>Artifacts</small><b>7 saved</b></div></div>
  </div>

  <!-- Observability -->
  <div v-else-if="block.mock === 'observability'" class="feature-ui" :style="tone">
    <div class="ui-top"><span class="ui-dots"><i></i><i></i><i></i></span><span class="ui-name">usage & traces</span><span class="ui-pill">last 24h</span></div>
    <div class="ui-content">
      <div class="metric-grid"><div class="metric-box"><small>Spend</small><b>$48.20</b></div><div class="metric-box"><small>Tokens</small><b>3.4M</b></div><div class="metric-box"><small>Avg latency</small><b>1.2s</b></div></div>
      <div class="bars"><i style="height:24%"></i><i style="height:42%"></i><i style="height:36%"></i><i style="height:72%"></i><i style="height:52%"></i><i style="height:82%"></i><i style="height:66%"></i><i style="height:94%"></i><i style="height:59%"></i><i style="height:75%"></i></div>
    </div>
    <div class="ui-foot"><div class="ui-stat"><small>Requests</small><b>1,204</b></div><div class="ui-stat"><small>Cache hit</small><b class="pos">38%</b></div><div class="ui-stat"><small>Error rate</small><b>0.2%</b></div></div>
  </div>

  <!-- Team & governance -->
  <div v-else-if="block.mock === 'governance'" class="feature-ui" :style="tone">
    <div class="ui-top"><span class="ui-dots"><i></i><i></i><i></i></span><span class="ui-name">workspace · national-lab-prod</span><span class="ui-pill">8 members</span></div>
    <div class="ui-content">
      <div class="audit-row"><div class="mini-icon" style="--tone:var(--green-2)">SK</div><div><b>Sajid Khan</b><span>Organization owner</span></div><span class="status-pill">owner</span></div>
      <div class="audit-row"><div class="mini-icon" style="--tone:var(--blue-2)">MR</div><div><b>Maya Rao</b><span>Laboratory operations</span></div><span class="status-pill">admin</span></div>
      <div class="audit-row"><div class="mini-icon" style="--tone:var(--amber-2)">LF</div><div><b>Leo Frank</b><span>Research workspace</span></div><span class="status-pill">member</span></div>
      <div class="audit-row"><div class="mini-icon" style="--tone:var(--violet-2)">AP</div><div><b>Ana Pillai</b><span>Oversight access</span></div><span class="status-pill">viewer</span></div>
      <div class="info-card" style="margin-top:16px"><p style="margin:0"><b>Audit:</b> every privileged, denied, and approval action is written to an immutable record.</p></div>
    </div>
    <div class="ui-foot"><div class="ui-stat"><small>Roles</small><b>4</b></div><div class="ui-stat"><small>Approvals</small><b>3 pending</b></div><div class="ui-stat"><small>Receipts</small><b>Signed</b></div></div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ block: { type: Object, required: true } })
const tone = computed(() => ({ '--tone': props.block.tone }))
</script>
