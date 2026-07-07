<template>
  <PublicLayout>
    <div ref="pageRoot">
      <!-- ── Hero ─────────────────────────────────────────────────────── -->
      <section class="hero">
        <div class="shell hero-grid">
          <div>
            <div class="eyebrow">The operating layer for intelligent systems</div>
            <h1>Intelligence should not stop at the <em>screen.</em></h1>
            <p>
              From a laboratory instrument to a national service, from a codebase to a
              field device—AADML gives agents governed access to tools, data, workspaces,
              signals, people, and the environments where work actually happens.
            </p>
            <div class="hero-actions">
              <a class="btn" href="#missions">Explore real missions <span>→</span></a>
              <a class="btn secondary" href="#platform">See the platform</a>
            </div>
            <div class="hero-note">
              <span>Visual workflows</span><span>Browser &amp; Android execution</span>
              <span>Daytona workspaces</span><span>Signals, Redis &amp; webhooks</span>
              <span>Human governance</span>
            </div>
          </div>

          <div ref="heroPanel" class="world-panel reveal" :style="panelStyle" aria-label="AADML connected domain map">
            <div class="connector c1"></div><div class="connector c2"></div><div class="connector c3"></div>
            <div class="connector c4"></div><div class="connector c5"></div><div class="connector c6"></div>
            <div class="core">
              <div><strong>AADML</strong><span>Reason · execute · govern</span></div>
              <div class="pulse"></div><div class="pulse p2"></div>
            </div>
            <div v-for="o in orbitCards" :key="o.cls" class="orbit-card" :class="o.cls">
              <b><span class="dot" :style="{ background: o.color }"></span>{{ o.title }}</b>
              <small>{{ o.body }}</small>
            </div>
            <div class="panel-label">One governed execution layer · many domains</div>
          </div>
        </div>
      </section>

      <!-- ── Institution strip ────────────────────────────────────────── -->
      <div class="institution-strip">
        <div class="shell">
          <div class="strip-label">Built to move across disciplines—not trapped inside a developer console</div>
          <div class="domains">
            <div v-for="d in domains" :key="d" class="domain">{{ d }}</div>
          </div>
        </div>
      </div>

      <!-- ── Platform / principles ────────────────────────────────────── -->
      <section id="platform">
        <div class="shell intro-grid">
          <div class="reveal">
            <div class="section-kicker">A broader idea of an agent platform</div>
            <h2 class="statement">Models produce intelligence. <strong>Institutions require execution.</strong></h2>
          </div>
          <div class="principles stagger">
            <article v-for="p in principles" :key="p.num" class="principle">
              <div class="num">{{ p.num }}</div>
              <h3>{{ p.title }}</h3>
              <p>{{ p.body }}</p>
            </article>
          </div>
        </div>
      </section>

      <!-- ── Missions (tabbed) ────────────────────────────────────────── -->
      <section class="missions" id="missions">
        <div class="shell">
          <div class="mission-head">
            <div>
              <div class="section-kicker">Missions, not demos</div>
              <h2 class="section-title">The same platform. Radically different work.</h2>
            </div>
            <p class="section-copy">
              AADML is not defined by a single use case. It is the common execution layer
              beneath research, public administration, infrastructure, field operations,
              healthcare, and software systems.
            </p>
          </div>
          <div class="mission-tabs" role="tablist">
            <button
              v-for="(m, key) in missions"
              :key="key"
              class="mission-tab"
              :class="{ active: activeMission === key }"
              @click="activeMission = key"
            >{{ m.tab }}</button>
          </div>
          <div class="mission-stage reveal">
            <div class="mission-copy-card">
              <div>
                <div class="sector">{{ current.sector }}</div>
                <h3>{{ current.title }}</h3>
                <p>{{ current.body }}</p>
              </div>
              <div class="mission-outcomes">
                <div v-for="o in current.outcomes" :key="o.head" class="outcome">
                  <b>{{ o.head }}</b>{{ o.text }}
                </div>
              </div>
            </div>
            <div class="mission-console">
              <div class="console-top">
                <span>{{ current.console }}</span>
                <span class="console-status">running</span>
              </div>
              <div class="mission-flow">
                <div
                  v-for="(s, i) in current.steps"
                  :key="i"
                  class="flow-row"
                  :class="{ active: s[2] === 'active' }"
                >
                  <div class="flow-index">{{ s[2] === 'done' ? '✓' : i + 1 }}</div>
                  <div><b>{{ s[0] }}</b><span>{{ s[1] }}</span></div>
                  <div class="flow-state">{{ s[2] }}</div>
                </div>
              </div>
              <div class="console-footer">
                <div class="console-metric"><small>Workspace</small><b>{{ current.workspace }}</b></div>
                <div class="console-metric"><small>Signals</small><b>{{ current.signals }}</b></div>
                <div class="console-metric"><small>Human gates</small><b>{{ current.gates }}</b></div>
                <div class="console-metric"><small>Artifacts</small><b>{{ current.artifacts }}</b></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Workflow builder canvas ──────────────────────────────────── -->
      <section class="workflow-section" id="workflow">
        <div class="shell">
          <div class="section-kicker">Visual orchestration</div>
          <h2 class="section-title">Make the institution visible.</h2>
          <p class="section-copy">
            The Workflow Builder turns complex operations into systems people can inspect.
            Chain signals, agents, deterministic logic, tools, waits, approvals,
            sub-workflows, and channels on one canvas.
          </p>
          <div class="workflow-wrap reveal">
            <div class="workflow-toolbar">
              <b>Cross-domain incident workflow</b>
              <div class="toolset">
                <span class="tool-chip">+ Trigger</span><span class="tool-chip">+ Agent</span>
                <span class="tool-chip">+ Logic</span><span class="tool-chip">+ Approval</span>
              </div>
              <button class="run-btn" @click="run">{{ label }}</button>
            </div>
            <div class="canvas">
              <div class="wire w1"></div><div class="wire w2"></div><div class="wire w3"></div>
              <div class="wire w4"></div><div class="wire w5"></div><div class="wire w6"></div>
              <div class="wire w7"></div><div class="wire w8"></div>
              <div
                v-for="(n, i) in nodes"
                :key="i"
                class="node"
                :class="[n.cls, { running: runningIndex === i }]"
              >
                <span class="badge" :style="{ background: n.badge }"></span>
                <small>{{ n.kind }}</small><b>{{ n.title }}</b><span>{{ n.body }}</span>
              </div>
              <div class="canvas-note">Schedules · webhooks · signals · queues · retries · loops · SLAs · replay</div>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Execution surfaces ───────────────────────────────────────── -->
      <section>
        <div class="shell">
          <div class="section-kicker">Execution surfaces</div>
          <h2 class="section-title">Agents work where the work lives.</h2>
          <p class="section-copy">
            A mission can move between web systems, mobile devices, reproducible code
            environments, and private machines while preserving one state and one audit trail.
          </p>
          <div class="execution-grid stagger">
            <article v-for="e in execCards" :key="e.title" class="exec-card" :style="{ '--tone': e.tone }">
              <div class="symbol">{{ e.symbol }}</div>
              <h3>{{ e.title }}</h3>
              <p>{{ e.body }}</p>
              <ul><li v-for="li in e.items" :key="li">{{ li }}</li></ul>
            </article>
          </div>
        </div>
      </section>

      <!-- ── Science band ─────────────────────────────────────────────── -->
      <section class="science-band" id="science">
        <div class="shell science-grid">
          <div class="science-copy reveal">
            <div class="section-kicker">Science &amp; laboratories</div>
            <h2>From data collection to defensible evidence.</h2>
            <p>
              Scientific work is not a chat problem. It is a chain of protocols, instruments,
              samples, calculations, exceptions, approvals, and records. AADML can coordinate
              that chain without erasing the human scientist.
            </p>
            <div class="science-list">
              <div v-for="(s, i) in scienceSteps" :key="i"><span>0{{ i + 1 }}</span><span>{{ s }}</span></div>
            </div>
          </div>
          <div class="lab-board reveal">
            <div class="lab-head">
              <span>RESEARCH WORKSPACE · RUN-042</span>
              <span style="color:var(--green)">● evidence synchronized</span>
            </div>
            <div class="sample-grid">
              <div class="lab-panel">
                <h4>Sequence quality window</h4>
                <div class="sequence"><span v-for="(c, i) in sequence" :key="i">{{ c }}</span></div>
              </div>
              <div class="lab-panel">
                <h4>Signal distribution</h4>
                <div class="chart"><div v-for="(h, i) in bars" :key="i" class="bar" :style="{ height: h + '%' }"></div></div>
              </div>
              <div class="lab-panel protocol">
                <h4>Protocol execution</h4>
                <div v-for="(r, i) in protocol" :key="i" class="protocol-row">
                  <i>{{ i + 1 }}</i>
                  <div><b>{{ r.title }}</b><br><span style="color:var(--muted)">{{ r.note }}</span></div>
                  <span :style="{ color: r.color }">{{ r.state }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Government band ──────────────────────────────────────────── -->
      <section class="public-section" id="government">
        <div class="shell public-grid">
          <div class="public-map reveal">
            <svg viewBox="0 0 700 560" fill="none">
              <path d="M70 240C170 112 258 90 358 173C464 260 528 166 633 105" stroke="#d84d37" stroke-width="2" stroke-dasharray="6 8"/>
              <path d="M100 430C220 346 286 358 350 284C444 177 522 359 624 419" stroke="#165f46" stroke-width="2" stroke-dasharray="6 8"/>
              <circle cx="70" cy="240" r="7" fill="#d84d37"/><circle cx="633" cy="105" r="7" fill="#d84d37"/>
              <circle cx="100" cy="430" r="7" fill="#165f46"/><circle cx="624" cy="419" r="7" fill="#165f46"/>
            </svg>
            <div class="gov-core">Public<br/>mission<br/>control</div>
            <div v-for="c in govCards" :key="c.cls" class="public-card" :class="c.cls">
              <b>{{ c.title }}</b><small>{{ c.body }}</small>
            </div>
          </div>
          <div class="public-copy reveal">
            <div class="section-kicker">Government &amp; public systems</div>
            <h2>Automate the process. Preserve the institution.</h2>
            <p>
              Public systems need more than speed. They need accountability, policy fidelity,
              data boundaries, human authority, and records that can survive scrutiny. AADML
              separates what an agent may recommend, what it may execute, and what must remain
              with a person.
            </p>
            <div class="gov-list">
              <div v-for="g in govItems" :key="g" class="gov-item">{{ g }}</div>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Event fabric ─────────────────────────────────────────────── -->
      <section>
        <div class="shell event-grid">
          <div class="event-copy reveal">
            <div class="section-kicker">Event fabric</div>
            <h2>Signals wake agents. Redis keeps work moving.</h2>
            <p>
              Institutional work arrives as change: a sample fails, a payment is missed, a device
              becomes available, a sensor crosses a limit, a citizen submits a case, or a deployment
              breaks. AADML turns those changes into durable, governed workflows.
            </p>
            <div class="infra-boxes">
              <div v-for="b in infra" :key="b.title" class="infra-box">
                <strong>{{ b.mark }}</strong><b>{{ b.title }}</b><p>{{ b.body }}</p>
              </div>
            </div>
          </div>
          <div class="event-stack reveal">
            <div v-for="ev in events" :key="ev.time" class="event-card">
              <div class="event-time">{{ ev.time }}</div>
              <div><b>{{ ev.name }}</b><span>{{ ev.desc }}</span></div>
              <div class="event-route">{{ ev.route }}</div>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Architecture (dark band) ─────────────────────────────────── -->
      <section class="architecture" id="architecture">
        <div class="shell">
          <div class="section-kicker">Architecture</div>
          <h2 class="section-title">Intelligence is only one layer.</h2>
          <p class="section-copy">
            AADML connects the surfaces people see, the environments agents use, the events
            that wake them, and the controls institutions require.
          </p>
          <div class="arch-grid reveal">
            <div v-for="row in architecture" :key="row.name" class="arch-row">
              <div class="arch-name">{{ row.name }}</div>
              <div class="arch-items"><span v-for="it in row.items" :key="it">{{ it }}</span></div>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Governance ───────────────────────────────────────────────── -->
      <section id="security">
        <div class="shell governance-grid">
          <div class="reveal">
            <div class="section-kicker">Governed autonomy</div>
            <h2>Scale agency without surrendering authority.</h2>
            <p class="section-copy">
              Every agent is an identity operating inside a bounded environment. Define where it
              may work, what it may see, what it may spend, and which decisions must remain human.
            </p>
          </div>
          <div class="gov-cards stagger">
            <article v-for="g in govGovernance" :key="g.title" class="gov-card">
              <div class="mini">{{ g.mini }}</div>
              <b>{{ g.title }}</b><p>{{ g.body }}</p>
            </article>
          </div>
        </div>
      </section>

      <!-- ── CTA ──────────────────────────────────────────────────────── -->
      <section class="cta" id="contact">
        <div class="shell">
          <div class="cta-panel reveal">
            <div><h2>Build the layer between intelligence and the world.</h2></div>
            <div class="cta-copy">
              <p>
                Begin with one workflow, one laboratory, one department, or one operating team.
                Keep the same execution model as the system expands.
              </p>
              <div class="cta-actions">
                <router-link class="btn light" to="/login">Enter AADML <span>↗</span></router-link>
                <router-link class="btn secondary" style="border-color:rgba(255,255,255,.55);color:white" to="/contact">Talk to North Rays</router-link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </PublicLayout>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useMouseInElement } from '@vueuse/core'
import PublicLayout from '../components/public/PublicLayout.vue'
import { useReveal } from '../composables/useReveal'
import { useNodeRunner } from '../composables/useNodeRunner'

const pageRoot = ref(null)
useReveal(pageRoot)

// Subtle mouse parallax on the hero orbit panel (editorial-restrained: ≤10px).
// Disabled under reduced-motion and when the cursor leaves the panel.
const heroPanel = ref(null)
const reduceMotion = typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const { elementX, elementY, elementWidth, elementHeight, isOutside } = useMouseInElement(heroPanel)
const panelStyle = computed(() => {
  if (reduceMotion || isOutside.value || !elementWidth.value) return {}
  const dx = elementX.value / elementWidth.value - 0.5
  const dy = elementY.value / elementHeight.value - 0.5
  const max = 10
  return { transform: `translate(${(-dx * max).toFixed(1)}px, ${(-dy * max).toFixed(1)}px)` }
})

// ── Static content data (ported from index.html) ──────────────────────
const orbitCards = [
  { cls: 'o1', color: 'var(--blue)', title: 'Genome laboratory', body: 'Protocol execution, instrument data, reproducible evidence.' },
  { cls: 'o2', color: 'var(--red)', title: 'Public services', body: 'Casework, policy rules, citizen workflows, human review.' },
  { cls: 'o3', color: 'var(--green)', title: 'Energy operations', body: 'Signals, incidents, field teams, governed remediation.' },
  { cls: 'o4', color: 'var(--violet)', title: 'Software systems', body: 'Daytona sandboxes, code, tests, deployment, observability.' },
  { cls: 'o5', color: 'var(--amber)', title: 'Clinical operations', body: 'Documents, approvals, scheduling, traceable decisions.' },
  { cls: 'o6', color: '#2a9bb8', title: 'Field & mobile', body: 'Android devices, browser portals, remote machines, sensors.' },
]

const domains = ['Science', 'Laboratories', 'Government', 'Healthcare', 'Infrastructure', 'Industry', 'Software']

const principles = [
  { num: '01', title: 'Persistent environments', body: 'Workspaces hold files, terminals, browsers, task state, data connections, and artifacts across hours, days, or long-running programs.' },
  { num: '02', title: 'Tools beyond software', body: 'Connect APIs, databases, MCP servers, lab systems, Android devices, browser portals, cloud infrastructure, and private networks.' },
  { num: '03', title: 'Event-driven operations', body: 'Signals, schedules, queues, Redis streams, and webhooks wake work at the moment a condition changes—not when someone types a prompt.' },
  { num: '04', title: 'Governed autonomy', body: 'Identity, RBAC, budgets, credentials, approvals, audit trails, tenant isolation, and deployment boundaries make autonomy operationally acceptable.' },
]

const missions = {
  lab: {
    tab: 'Laboratory', sector: 'Laboratory intelligence',
    title: 'Turn a protocol into a traceable, reproducible operation.',
    body: 'An agent watches instrument output, checks controls, retrieves the current protocol, identifies an anomalous sample, prepares the evidence package, and requests human review before changing the run.',
    console: 'mission · assay-anomaly-review', workspace: 'lab-run-042', signals: '12 received', gates: '1 pending', artifacts: '9 preserved',
    outcomes: [
      { head: 'Evidence preserved', text: 'Every input, transformation, and decision remains attached to the run.' },
      { head: 'Human authority retained', text: 'Protocol deviations and sensitive actions stop at approval gates.' },
      { head: 'Systems connected', text: 'LIMS, documents, instruments, storage, and notifications share one workflow.' },
      { head: 'Reproducible by design', text: 'Agents can replay the exact execution path with its artifacts.' },
    ],
    steps: [
      ['Ingest instrument output', 'Signal normalized and attached to run', 'done'],
      ['Retrieve current protocol', 'Revision 8.4 verified', 'done'],
      ['Validate controls', '11 checks passed · 1 variance', 'done'],
      ['Run computational review', 'Daytona environment snapshot created', 'active'],
      ['Scientist approval', 'Protocol deviation requires human authority', 'pending'],
      ['Publish evidence record', 'LIMS + storage + notification', 'pending'],
    ],
  },
  government: {
    tab: 'Government', sector: 'Public administration',
    title: 'Move a citizen case through policy, evidence, and human authority.',
    body: 'AADML classifies the submission, checks required documents, reads the governing policy, retrieves agency records, prepares a case summary, and routes exceptions to the responsible officer.',
    console: 'mission · public-benefits-case', workspace: 'case-21874', signals: '7 received', gates: '2 pending', artifacts: '14 preserved',
    outcomes: [
      { head: 'Policy fidelity', text: 'Eligibility paths are assembled with citations to the governing rules.' },
      { head: 'Human authority retained', text: 'A caseworker decision is required before the case can finalize.' },
      { head: 'Records isolated', text: 'Tenant boundaries keep agency data separated and auditable.' },
      { head: 'Accountable by design', text: 'Every classification and retrieval is preserved for review.' },
    ],
    steps: [
      ['Receive case submission', 'Webhook verified and tenant isolated', 'done'],
      ['Classify documents', 'Identity and evidence types extracted', 'done'],
      ['Evaluate policy rules', 'Eligibility path assembled with citations', 'done'],
      ['Retrieve agency records', 'Browser + internal system access', 'active'],
      ['Caseworker decision', 'Recommendation cannot finalize the case', 'pending'],
      ['Issue notice', 'Approved template and delivery channel', 'pending'],
    ],
  },
  health: {
    tab: 'Healthcare', sector: 'Clinical operations',
    title: 'Coordinate care operations without hiding the decision path.',
    body: 'The workflow gathers referrals, validates documents, schedules the next action, checks policy and availability, prepares a structured summary, and stops for clinical or administrative review where required.',
    console: 'mission · referral-coordination', workspace: 'patient-op-771', signals: '9 received', gates: '2 pending', artifacts: '11 preserved',
    outcomes: [
      { head: 'Grounded recommendations', text: 'Policy and history are attached as sources to every step.' },
      { head: 'Human authority retained', text: 'Sensitive clinical decisions remain with a person.' },
      { head: 'Approved channels only', text: 'Participants are notified through governed, compliant routes.' },
      { head: 'Traceable coordination', text: 'The full referral timeline is preserved for audit.' },
    ],
    steps: [
      ['Receive referral', 'Documents and metadata verified', 'done'],
      ['Retrieve policy and history', 'Grounded sources attached', 'done'],
      ['Check capacity', 'Schedules and service availability queried', 'done'],
      ['Prepare coordination plan', 'Agent composes traceable recommendation', 'active'],
      ['Clinical / admin review', 'Sensitive decision remains human', 'pending'],
      ['Notify participants', 'Approved channels only', 'pending'],
    ],
  },
  field: {
    tab: 'Field operations', sector: 'Field operations',
    title: 'Connect live conditions to the people and devices that can act.',
    body: 'A sensor or field report becomes a signal. AADML evaluates severity, assigns a mobile device or field team, opens the required portal, preserves evidence, and escalates the action under policy.',
    console: 'mission · field-incident-respond', workspace: 'region-7-incident', signals: '18 received', gates: '1 pending', artifacts: '22 preserved',
    outcomes: [
      { head: 'Severity-aware routing', text: 'Rules and agent reasoning combine to prioritize the response.' },
      { head: 'Human authority retained', text: 'High-impact actions require supervisor authorization.' },
      { head: 'Devices governed', text: 'Android devices and operators are reserved and isolated per task.' },
      { head: 'Evidence preserved', text: 'Photos, logs, and the incident timeline are kept intact.' },
    ],
    steps: [
      ['Receive condition signal', 'Source and location verified', 'done'],
      ['Assess severity', 'Rules + agent reasoning combined', 'done'],
      ['Assign field resource', 'Android device and operator reserved', 'done'],
      ['Open operational portals', 'Browser automation executing', 'active'],
      ['Supervisor authorization', 'High-impact action requires approval', 'pending'],
      ['Close with evidence', 'Photos, logs, and timeline preserved', 'pending'],
    ],
  },
  software: {
    tab: 'Software', sector: 'Software & infrastructure',
    title: 'Let agents investigate, change, test, and recover real systems.',
    body: 'The agent opens a persistent workspace, reproduces the issue in Daytona, edits the repository, runs tests, requests approval, deploys, watches the result, and preserves a complete activity trail.',
    console: 'mission · production-remediation', workspace: 'daytona-fix-482', signals: '15 received', gates: '1 pending', artifacts: '17 preserved',
    outcomes: [
      { head: 'Reproducible fixes', text: 'Issues are reproduced in a snapshotted Daytona workspace.' },
      { head: 'Human authority retained', text: 'Deployment is blocked until a person authorizes it.' },
      { head: 'Evidence linked', text: 'Code and runtime evidence are tied to the root cause.' },
      { head: 'Safe recovery', text: 'A rollback checkpoint is prepared before every deploy.' },
    ],
    steps: [
      ['Receive production alert', 'Signal routed with service context', 'done'],
      ['Open Daytona workspace', 'Repository, dependencies, logs ready', 'done'],
      ['Identify root cause', 'Code and runtime evidence linked', 'done'],
      ['Patch and run tests', '48 checks executing', 'active'],
      ['Production approval', 'Deployment blocked until authorized', 'pending'],
      ['Deploy and observe', 'Rollback checkpoint prepared', 'pending'],
    ],
  },
}
const activeMission = ref('lab')
const current = computed(() => missions[activeMission.value])

// Workflow canvas
const nodes = [
  { cls: 'n1', badge: 'var(--red)', kind: 'Signal / webhook', title: 'condition.changed', body: 'Normalized event enters the mission.' },
  { cls: 'n2', badge: 'var(--violet)', kind: 'Agent', title: 'Interpret & plan', body: 'Reason over policy, evidence, and context.' },
  { cls: 'n3', badge: 'var(--green)', kind: 'Data & state', title: 'Postgres + Redis', body: 'Query records; coordinate queue and checkpoint.' },
  { cls: 'n4', badge: 'var(--blue)', kind: 'Tool', title: 'Browser automation', body: 'Operate authenticated portals and retrieve evidence.' },
  { cls: 'n5', badge: 'var(--amber)', kind: 'Execution surface', title: 'Android device', body: 'Tap, type, inspect, capture, and preserve artifacts.' },
  { cls: 'n6', badge: 'var(--violet)', kind: 'Workspace', title: 'Daytona task', body: 'Run code, analysis, validation, or transformation.' },
  { cls: 'n7', badge: 'var(--red)', kind: 'Human authority', title: 'Review & release', body: 'Approve the consequential action and publish the record.' },
]
const { runningIndex, label, run } = useNodeRunner(nodes.length)

const execCards = [
  { tone: 'var(--blue-2)', symbol: '↗', title: 'Browser automation', body: 'Authenticated, observable browser sessions for portals, research, forms, testing, extraction, and controlled submissions.', items: ['DOM, screenshots, network, downloads', 'Multi-tab navigation and uploads', 'Approval gates before external writes'] },
  { tone: 'var(--amber-2)', symbol: '⌁', title: 'Android tools', body: 'Operate real or virtual Android devices through ADB, Appium, accessibility services, and governed device farms.', items: ['Tap, type, swipe, install, inspect', 'Device assignment and isolation', 'Recordings, logs, and checkpoints'] },
  { tone: 'var(--violet-2)', symbol: '◇', title: 'Daytona workspaces', body: 'Fast, reproducible development and analysis sandboxes for coding agents and computational workflows.', items: ['Repositories, files, terminal, dependencies', 'Snapshots, previews, lifecycle control', 'Reviewable diffs and durable artifacts'] },
  { tone: 'var(--green-2)', symbol: '⌂', title: 'Remote runners', body: 'Extend AADML into a laptop, server, private network, instrument workstation, or protected institutional environment.', items: ['Read files and execute commands', 'Operate internal tools and services', 'Private, permissioned, auditable action'] },
]

const scienceSteps = [
  'Ingest instrument output, sample metadata, documents, and live signals.',
  'Run analysis in a reproducible Daytona environment with fixed dependencies.',
  'Compare results against controls, protocols, and previous runs.',
  'Escalate deviations, preserve evidence, and create a review-ready record.',
]
const sequence = 'ATCGGCTAACGTTAGCGATCCTAGGCTAACGTTAGCGATCCTAGGCTA'.split('')
const bars = [34, 48, 73, 58, 90, 67, 46, 82, 64]
const protocol = [
  { title: 'Retrieve current assay protocol', note: 'Source verified · revision 8.4', state: 'Complete', color: 'var(--green)' },
  { title: 'Validate controls and sample metadata', note: '11 checks passed · 1 variance detected', state: 'Complete', color: 'var(--green)' },
  { title: 'Run computational review in Daytona', note: 'Environment snapshot attached', state: 'Running', color: 'var(--blue)' },
  { title: 'Scientist review of protocol deviation', note: 'No automated release permitted', state: 'Required', color: 'var(--red)' },
]

const govCards = [
  { cls: 'pc1', title: 'Benefits casework', body: 'Documents · policy · review' },
  { cls: 'pc2', title: 'Municipal operations', body: 'Signals · routing · field teams' },
  { cls: 'pc3', title: 'Regulatory workflow', body: 'Evidence · inspections · audit' },
  { cls: 'pc4', title: 'Emergency coordination', body: 'Events · escalation · response' },
]
const govItems = [
  'Sovereign or private deployment', 'Policy-aware approval gates', 'Case-level audit history',
  'Agency and tenant isolation', 'Budget and usage controls', 'Browser, mobile, and legacy portals',
  'Human escalation by confidence', 'Reproducible evidence packages',
]

const infra = [
  { mark: '↯', title: 'Signals', body: 'Normalize events into a common language for routing and escalation.' },
  { mark: 'R', title: 'Redis state', body: 'Queues, streams, locks, caches, rate limits, retries, and checkpoints.' },
  { mark: '↗', title: 'Webhooks', body: 'Inbound and outbound endpoints with signatures, budgets, and read-only modes.' },
]
const events = [
  { time: '08:14:12', name: 'laboratory.control.failed', desc: 'Quality threshold exceeded; protocol review workflow created.', route: 'Lab mission' },
  { time: '08:19:05', name: 'citizen.case.documents.received', desc: 'Documents classified, missing evidence identified, caseworker notified.', route: 'Public service' },
  { time: '08:22:41', name: 'android.device.available', desc: 'Device assigned to controlled mobile workflow; session isolated.', route: 'Mobile fleet' },
  { time: '08:29:18', name: 'workspace.test.failed', desc: 'Daytona emitted diagnostic artifact; remediation branch opened.', route: 'Engineering' },
  { time: '08:36:03', name: 'approval.granted', desc: 'Workflow resumed from checkpoint and completed the authorized action.', route: 'Governance' },
]

const architecture = [
  { name: 'Interfaces', items: ['Web console', 'Chat & embedded UI', 'API & SDKs', 'Slack / WhatsApp', 'Custom applications'] },
  { name: 'Orchestration', items: ['Workflow Builder', 'Roles & plans', 'Multi-agent work', 'Approvals', 'Evaluations'] },
  { name: 'Execution', items: ['Long-running jobs', 'Schedules', 'Retries & waits', 'State & checkpoints', 'Artifacts'] },
  { name: 'Surfaces', items: ['Browser automation', 'Android tools', 'Daytona', 'Remote runners', 'Private machines'] },
  { name: 'Knowledge', items: ['Documents & RAG', 'Databases', 'Structured memory', 'Task history', 'Citations'] },
  { name: 'Event fabric', items: ['Signals', 'Redis', 'Webhooks', 'Queues & streams', 'Dead-letter handling'] },
  { name: 'Governance', items: ['RBAC', 'Credential vaults', 'Policy controls', 'Budgets', 'Audit logs'] },
]

const govGovernance = [
  { mini: 'Identity', title: 'Role-based access', body: 'Separate organizations, workspaces, teams, agents, data, credentials, tools, and tenant boundaries.' },
  { mini: 'Control', title: 'Human approval gates', body: 'Require explicit authorization before consequential changes, submissions, payments, deployments, or external communications.' },
  { mini: 'Evidence', title: 'Immutable activity history', body: 'Preserve commands, tool calls, files, browser activity, state transitions, costs, decisions, and artifacts.' },
  { mini: 'Deployment', title: 'Cloud, VPC, or private environment', body: 'Place execution where institutional policy and data sovereignty require it to live.' },
  { mini: 'Limits', title: 'Budgets and policy ceilings', body: 'Apply financial, temporal, operational, and tool-specific limits to every mission.' },
  { mini: 'Recovery', title: 'Checkpoint, replay, and escalation', body: 'Resume safely, reproduce the execution path, and hand authority to a person when confidence falls.' },
]
</script>
