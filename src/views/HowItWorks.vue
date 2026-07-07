<template>
  <PublicLayout>
    <div ref="pageRoot" class="page-main">
      <!-- ── Hero ─────────────────────────────────────────────────────── -->
      <section class="page-hero" id="top">
        <div class="shell page-hero-grid">
          <div class="reveal">
            <div class="section-kicker">How it works</div>
            <h1>From an idea to a <em>governed</em> operation.</h1>
            <p>
              Build an agent, ground it in knowledge and tools, wake it with signals, and keep a
              human in the loop for the decisions that matter—inspecting every step along the way.
            </p>
            <div class="hero-actions">
              <a class="btn" href="#lifecycle">See the lifecycle <span>→</span></a>
              <router-link class="btn secondary" to="/features">Explore features</router-link>
            </div>
          </div>
          <div class="diagram-card reveal">
            <div class="platform-stack">
              <div v-for="s in stack" :key="s.name" class="stack-row"><b>{{ s.name }}</b><span>{{ s.desc }}</span></div>
            </div>
            <div class="stack-caption">One model · configure once, run anywhere</div>
          </div>
        </div>
      </section>

      <!-- ── Lifecycle ────────────────────────────────────────────────── -->
      <section class="content-section" id="lifecycle">
        <div class="shell">
          <div class="section-head-wide reveal">
            <div><div class="section-kicker">The lifecycle</div><h2>Five stages, one execution layer.</h2></div>
            <p>Every mission moves through the same governed lifecycle—so a first workflow and an institutional deployment share one operating model.</p>
          </div>
          <div class="lifecycle">
            <article v-for="(l, i) in lifecycle" :key="l.title" class="life-card reveal" :style="{ '--tone': l.tone }">
              <small>0{{ i + 1 }} · {{ l.tag }}</small>
              <h3>{{ l.title }}</h3>
              <p>{{ l.body }}</p>
            </article>
          </div>
        </div>
      </section>

      <!-- ── Steps + runtime board ────────────────────────────────────── -->
      <section class="content-section soft" id="steps">
        <div class="shell">
          <div class="section-head-wide reveal">
            <div><div class="section-kicker">Build it</div><h2>Four steps to a working agent.</h2></div>
            <p>Configure the brain, equip the tools, automate the trigger, and watch it run—each step visible and reversible.</p>
          </div>
          <div class="runtime-grid">
            <div class="runtime-board reveal">
              <div class="runtime-top"><span>mission · onboarding-assistant</span><span>live</span></div>
              <div v-for="(s, i) in steps" :key="s.title" class="job-row" :class="{ active: i === 2 }">
                <div class="job-icon">{{ i + 1 }}</div>
                <div><b>{{ s.title }}</b><span>{{ s.description }}</span></div>
                <div class="job-state">{{ i < 2 ? 'done' : i === 2 ? 'running' : 'queued' }}</div>
              </div>
            </div>
            <div class="runtime-side">
              <article class="info-card reveal"><div class="icon">◎</div><h3>Governed by default</h3><p>Budgets, approval gates, and tool policy apply at execution time—no consequential action slips past a human.</p><ul><li>Per-mission and per-org budgets</li><li>Approval before external writes</li><li>Immutable activity history</li></ul></article>
              <article class="info-card reveal"><div class="icon">↯</div><h3>Wake on any event</h3><p>Cron schedules, webhooks, and Redis signals start work the moment a condition changes.</p><ul><li>HMAC-verified webhooks</li><li>Durable queue with retries</li><li>Dead-letter recovery</li></ul></article>
            </div>
          </div>
        </div>
      </section>

      <!-- ── CTA ──────────────────────────────────────────────────────── -->
      <section class="cta" id="contact">
        <div class="shell">
          <div class="cta-panel reveal">
            <div><h2>Start with one mission. Keep the same model as you scale.</h2></div>
            <div class="cta-copy">
              <p>Build your first agent free, then grow it into a governed institutional deployment.</p>
              <div class="cta-actions">
                <router-link class="btn light" to="/login">Get started <span>↗</span></router-link>
                <router-link class="btn secondary" style="border-color:rgba(255,255,255,.55);color:white" to="/docs">Read the docs</router-link>
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
import { useMeta } from '../composables/useMeta'
import { useReveal } from '../composables/useReveal'

useMeta({
  title: 'How It Works — AADML',
  description: 'From configuring an agent to a governed operation: build, ground, automate with signals, and keep humans in the loop.',
})

const pageRoot = ref(null)
useReveal(pageRoot)

const stack = [
  { name: 'Build', desc: 'Prompt, model, tools, knowledge, and budgets in one profile' },
  { name: 'Ground', desc: 'Documents, RAG, databases, and structured memory' },
  { name: 'Execute', desc: 'Browser, Android, Daytona, and remote runners' },
  { name: 'Govern', desc: 'RBAC, approvals, budgets, and audit trails' },
  { name: 'Operate', desc: 'Signals, schedules, retries, and replay' },
]

const lifecycle = [
  { tone: 'var(--blue)', tag: 'BUILD', title: 'Configure the agent', body: 'Set the prompt, model, execution mode, tools, and budget once—organization policy merges in at runtime.' },
  { tone: 'var(--green)', tag: 'GROUND', title: 'Add knowledge & tools', body: 'Index documents and sites for cited RAG, and expose exactly the systems and actions the agent may use.' },
  { tone: 'var(--amber)', tag: 'EXECUTE', title: 'Run in real environments', body: 'Move through browsers, devices, and Daytona sandboxes while preserving one state and one audit trail.' },
  { tone: 'var(--red)', tag: 'GOVERN', title: 'Keep humans in control', body: 'Gate consequential actions behind approval, apply budgets and ceilings, and preserve an immutable record.' },
  { tone: 'var(--violet)', tag: 'OPERATE', title: 'Automate & observe', body: 'Wake work on signals and schedules, then inspect every token, trace, dollar, and artifact.' },
]

const steps = ref([
  { title: 'Configure your agent', description: 'Pick a model, write a system prompt, and set budget guardrails.' },
  { title: 'Equip with tools', description: 'Assign built-in tools or connect MCP servers for external capabilities.' },
  { title: 'Automate with signals', description: 'Cron schedules, webhook triggers, or manual chat—executed under policy.' },
  { title: 'Monitor & learn', description: 'Review execution logs, cost analytics, and traces for every run.' },
])
</script>
