<template>
  <PublicLayout>
    <div ref="pageRoot" class="page-main">
      <!-- ── Hero ─────────────────────────────────────────────────────── -->
      <section class="page-hero" id="top">
        <div class="shell page-hero-grid">
          <div class="reveal">
            <div class="section-kicker">Complete feature system</div>
            <h1>Everything an agent needs to <em>finish the work.</em></h1>
            <p>
              From a streaming, tool-using agent to coding sandboxes, visual workflows,
              browser and Android execution, cited knowledge, event infrastructure,
              observability, and institutional governance—one coherent platform.
            </p>
            <div class="hero-actions">
              <a class="btn" href="#build">Explore the feature system <span>→</span></a>
              <router-link class="btn secondary" to="/how-it-works">See platform architecture</router-link>
            </div>
            <div class="feature-index">
              <a v-for="f in featureIndex" :key="f.id" :href="`#${f.id}`">{{ f.label }}</a>
            </div>
          </div>

          <!-- Capability card -->
          <div class="cap-card reveal">
            <div class="cap-head">
              <span class="cap-dots"><i style="background:var(--blue)"></i><i style="background:var(--green)"></i><i style="background:var(--green)"></i></span>
              <span class="cap-host"><b>aadml</b> <span>· what your agents can do</span></span>
              <span class="cap-verify"><span style="width:7px;height:7px;border-radius:50%;background:var(--green);display:inline-block"></span>Verified</span>
            </div>
            <div class="cap-title-wrap">
              <h3 class="cap-title">One platform — every capability</h3>
              <div class="cap-sub">Capabilities · 100% active</div>
            </div>
            <div class="cap-rows">
              <div v-for="(c, i) in capabilities" :key="c.label" class="cap-row" :style="{ '--d': (0.12 * (i + 1)).toFixed(2) + 's' }">
                <span class="cap-check">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>
                </span>
                <span class="cap-label">{{ c.label }}</span>
                <span class="cap-cat">{{ c.cat }}</span>
              </div>
            </div>
            <div class="cap-foot">
              <b>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--green)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>
                Verified · ticket #4821 resolved
              </b>
              <span>release v2.14.1 deployed · 48 tests passed</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Feature groups ───────────────────────────────────────────── -->
      <section
        v-for="(group, gi) in groups"
        :key="group.kicker"
        class="content-section"
        :class="{ soft: gi % 2 === 1 }"
        :id="group.anchor"
      >
        <div class="shell">
          <div class="group-title reveal">
            <div>
              <div class="section-kicker">{{ group.kicker }}</div>
              <h2>{{ group.title }}</h2>
            </div>
            <p>{{ group.copy }}</p>
          </div>

          <div
            v-for="block in group.blocks"
            :key="block.id"
            class="feature-block"
            :class="{ reverse: block.reverse }"
            :id="block.id"
          >
            <div class="feature-copy reveal" :style="{ '--tone': block.tone }">
              <div class="slug">{{ block.slug }}</div>
              <h3>{{ block.title }}</h3>
              <p>{{ block.body }}</p>
              <ul><li v-for="li in block.items" :key="li">{{ li }}</li></ul>
              <div v-if="block.cta" class="hero-actions">
                <router-link class="btn" :to="block.cta.to">{{ block.cta.label }} <span>→</span></router-link>
              </div>
            </div>
            <!-- The UI mockup markup varies per block; rendered via a sub-component -->
            <FeatureMock class="reveal" :block="block" />
          </div>
        </div>
      </section>

      <!-- ── CTA ──────────────────────────────────────────────────────── -->
      <section class="cta" id="contact">
        <div class="shell">
          <div class="cta-panel reveal">
            <div><h2>One platform. The whole agent lifecycle.</h2></div>
            <div class="cta-copy">
              <p>
                Define, execute, supervise, inspect, and improve—without stitching together
                five disconnected products.
              </p>
              <div class="cta-actions">
                <router-link class="btn light" to="/how-it-works">See the platform <span>→</span></router-link>
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
import { ref } from 'vue'
import PublicLayout from '../components/public/PublicLayout.vue'
import FeatureMock from '../components/public/FeatureMock.vue'
import { useReveal } from '../composables/useReveal'

const pageRoot = ref(null)
useReveal(pageRoot)

const featureIndex = [
  { id: 'agent-studio', label: 'Agent Studio' },
  { id: 'knowledge', label: 'Knowledge & RAG' },
  { id: 'connectors', label: 'Connectors & MCP' },
  { id: 'code', label: 'Daytona coding' },
  { id: 'workflow', label: 'Workflow Builder' },
  { id: 'browser', label: 'Browser' },
  { id: 'android', label: 'Android' },
  { id: 'signals', label: 'Signals' },
  { id: 'media', label: 'Media' },
  { id: 'observability', label: 'Observability' },
  { id: 'governance', label: 'Governance' },
]

const capabilities = [
  { label: 'Write & review code', cat: "Let's Code" },
  { label: 'Deploy to AWS', cat: 'DevOps' },
  { label: 'Run browsers & Android', cat: 'Execution' },
  { label: 'Query databases & APIs', cat: 'Tools' },
  { label: 'Build visual workflows', cat: 'Workflows' },
  { label: 'Ground answers in knowledge', cat: 'RAG' },
  { label: 'Monitor & auto-fix prod', cat: 'Signals' },
  { label: 'Govern every action', cat: 'Security' },
]

const groups = [
  {
    anchor: 'build',
    kicker: 'Build intelligence',
    title: 'Shape the agent brain, knowledge, and tools.',
    copy: 'Define reusable agent profiles, ground them in institutional knowledge, and expose exactly the systems and actions they are allowed to use.',
    blocks: [
      {
        id: 'agent-studio', slug: 'Agent Studio', tone: 'var(--blue)', mock: 'agent',
        title: 'Configure reusable agents once. Run them everywhere.',
        body: 'Set the system prompt, model, tools, knowledge, execution mode, policies, and publishing surface in one editor. Organization policy merges into each agent at runtime.',
        items: ['Manual, assisted, or autonomous execution', 'Prompt, model, tools, knowledge, and budgets in one profile', 'Public widgets with token-scoped access', 'Organization-level forbidden tools and risk ceilings'],
      },
      {
        id: 'knowledge', slug: 'Knowledge & RAG', tone: 'var(--green)', reverse: true, mock: 'knowledge',
        title: 'Ground every answer in your own content.',
        body: 'Upload documents or crawl entire sites. AADML chunks, embeds, indexes, retrieves, and cites the exact passages used during a run.',
        items: ['Files and website crawls indexed automatically', 'Top-k retrieval inside a guarded context block', 'Citation chips link to exact source passages', 'Scheduled re-crawls keep institutional knowledge fresh'],
      },
      {
        id: 'connectors', slug: 'Connectors & MCP', tone: 'var(--red)', mock: 'connectors',
        title: 'Connect anything. Control every action.',
        body: 'Manage OAuth and PAT accounts, REST and GraphQL services, databases, and MCP servers in one registry. AADML discovers schemas and classifies actions by risk.',
        items: ['Native connectors plus any API or MCP server', 'Read, write, and destructive action classification', 'Per-tool allow · ask · deny at organization and agent scope', 'Connection health, circuit breakers, and credential vaults'],
      },
    ],
  },
  {
    anchor: 'execute',
    kicker: 'Execute in real environments',
    title: 'Code, web, mobile, and operational workflows.',
    copy: 'Agents move through governed environments that expose files, terminals, browsers, devices, databases, and people while preserving artifacts and approval history.',
    blocks: [
      {
        id: 'code', slug: "Let's Code + Daytona", tone: 'var(--green)', mock: 'code',
        title: 'A web IDE where the agent writes, tests, and proposes code.',
        body: 'Clone a real repository into a Daytona sandbox and pair it with a coding agent. The agent plans, edits, runs tests, and produces a reviewable diff.',
        items: ['Fast isolated workspace creation', 'Clone, index, edit, terminal, dependencies, and preview', 'File- and hunk-level diff acceptance', 'Export to a GitHub pull request—never directly to main'],
      },
      {
        id: 'workflow', slug: 'Workflow Builder', tone: 'var(--blue)', mock: 'workflow',
        title: 'Compose agents, tools, logic, and humans.',
        body: 'Build visible, reusable systems from triggers, agent runs, tool actions, conditions, loops, delays, approvals, and sub-workflows.',
        items: ['Manual, schedule, webhook, Slack, Telegram, and email triggers', 'Agent, action, logic, approval, foreach, and sub-workflow nodes', 'Templated data flow and drag-to-insert outputs', 'Dry run, live overlays, retries, replay, versions, and node-level I/O'],
        cta: { to: '/how-it-works', label: 'Open the Workflow Builder page' },
      },
      {
        id: 'browser', slug: 'Browser automation', tone: 'var(--amber)', reverse: true, mock: 'browser',
        title: 'Operate authenticated web systems with evidence.',
        body: 'Use controlled browser sessions for research, public portals, enterprise applications, data extraction, testing, forms, and file exchange.',
        items: ['DOM, screenshot, network, download, and upload tools', 'Multi-tab navigation and authenticated sessions', 'Recordings, artifacts, and step-level inspection', 'Approval before external submissions or irreversible actions'],
      },
      {
        id: 'android', slug: 'Android device tools', tone: 'var(--violet)', mock: 'android',
        title: 'Run governed workflows on real and virtual devices.',
        body: 'Operate Android devices through ADB, Appium, accessibility services, emulators, and device farms with session isolation and full evidence.',
        items: ['Tap, type, swipe, install, launch, inspect, and capture', 'Device assignment, locks, and session isolation', 'Logs, screen recordings, screenshots, and artifacts', 'Checkpoints and approvals before consequential actions'],
      },
    ],
  },
  {
    anchor: 'operate',
    kicker: 'Operate continuously',
    title: 'Events, media, traces, and institutional control.',
    copy: 'Turn one-off agent runs into reliable operating systems that react to events, preserve every artifact, and remain understandable to operators and auditors.',
    blocks: [
      {
        id: 'signals', slug: 'Signals & schedules', tone: 'var(--red)', mock: 'signals',
        title: 'Agents that work while you sleep.',
        body: 'Cron schedules and inbound webhooks feed a Redis-backed durable queue with retries, dead-letter alerts, checkpoints, and budget caps.',
        items: ['Auto-minted webhook URLs with HMAC verification', 'Cron schedules with daily budgets and read-only modes', 'Signals wake, route, resume, and escalate workflows', 'Queues, streams, locks, caches, and rate limits in Redis'],
      },
      {
        id: 'media', slug: 'Media pipeline', tone: 'var(--amber)', reverse: true, mock: 'media',
        title: 'Generate media end to end with agents.',
        body: 'Orchestrate multi-stage media generation from brief to script, image, video, document, and publication while preserving every intermediate artifact.',
        items: ['Image, video, and document generation as tools', 'Multi-stage pipelines with checkpoints and previews', 'Durable downloadable artifacts and reusable links', 'Insert generated outputs directly into chat or workflows'],
      },
      {
        id: 'observability', slug: 'Observability', tone: 'var(--blue)', mock: 'observability',
        title: 'Every token, trace, dollar, and artifact—visible.',
        body: 'Transparent metering and tracing across chat, workflows, signals, schedules, devices, and coding workspaces.',
        items: ['Per-response and per-session token and dollar metering', 'Request logs with drill-in to full run traces', 'Cost by source, provider, model, workspace, and mission', 'Stop reasons, cache hits, tool counts, latency, and replay'],
      },
      {
        id: 'governance', slug: 'Team & governance', tone: 'var(--green)', reverse: true, mock: 'governance',
        title: 'Collaborate with real access control.',
        body: 'Organizations and workspaces carry roles, invitations, data boundaries, credential policies, budgets, and an immutable history of privileged and denied actions.',
        items: ['Owner, admin, member, viewer, and billing roles', 'Workspace-scoped agents, data, connectors, and knowledge', 'Encrypted credential vaults and customer isolation', 'Immutable audit trail, retention, approvals, and escalation'],
      },
    ],
  },
]
</script>
