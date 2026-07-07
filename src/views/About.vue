<template>
  <PublicLayout>
    <div ref="pageRoot" class="page-main">
      <!-- ── Hero ─────────────────────────────────────────────────────── -->
      <section class="page-hero" id="top">
        <div class="shell page-hero-grid">
          <div class="reveal">
            <div class="section-kicker">About AADML</div>
            <h1>Intelligence should <em>act</em>—responsibly.</h1>
            <p>
              AADML is the governed execution layer for intelligent systems. We build the layer
              between capable models and the environments where consequential work actually
              happens—so autonomy stays accountable.
            </p>
            <div class="hero-actions">
              <router-link class="btn" to="/features">See what we build <span>→</span></router-link>
              <router-link class="btn secondary" to="/contact">Talk to us</router-link>
            </div>
          </div>
          <div class="diagram-card reveal">
            <div class="platform-stack">
              <div v-for="s in beliefs" :key="s.name" class="stack-row"><b>{{ s.name }}</b><span>{{ s.desc }}</span></div>
            </div>
            <div class="stack-caption">A North Rays platform · built for consequential work</div>
          </div>
        </div>
      </section>

      <!-- ── Mission statement + principles ───────────────────────────── -->
      <section class="content-section" id="mission">
        <div class="shell intro-grid">
          <div class="reveal">
            <div class="section-kicker">Why we exist</div>
            <h2 class="statement">Models produce intelligence. <strong>We make it accountable.</strong></h2>
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

      <!-- ── Stats ────────────────────────────────────────────────────── -->
      <section class="content-section soft" id="scale">
        <div class="shell">
          <div class="section-head-wide reveal">
            <div><div class="section-kicker">Built for scale</div><h2>One model, many domains.</h2></div>
            <p>The same execution layer runs beneath research, public administration, infrastructure, field operations, healthcare, and software.</p>
          </div>
          <div class="infra-boxes stagger">
            <div v-for="s in stats" :key="s.label" class="infra-box">
              <strong>{{ s.value }}</strong><b>{{ s.label }}</b><p>{{ s.note }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Values ───────────────────────────────────────────────────── -->
      <section class="content-section" id="values">
        <div class="shell governance-grid">
          <div class="reveal">
            <div class="section-kicker">How we build</div>
            <h2>Principles we don't trade away.</h2>
            <p class="section-copy">
              Governance is not a feature bolted on at the end. It is the reason the platform exists,
              and it shapes every decision we make.
            </p>
          </div>
          <div class="gov-cards stagger">
            <article v-for="v in values" :key="v.title" class="gov-card">
              <div class="mini">{{ v.mini }}</div>
              <b>{{ v.title }}</b><p>{{ v.body }}</p>
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
              <p>Join the teams putting governed AI agents to work on consequential problems.</p>
              <div class="cta-actions">
                <router-link class="btn light" to="/login">Get started <span>↗</span></router-link>
                <router-link class="btn secondary" style="border-color:rgba(255,255,255,.55);color:white" to="/contact">Contact the team</router-link>
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
  title: 'About — AADML',
  description: 'AADML is the governed execution layer for intelligent systems—built by North Rays for consequential work across science, government, infrastructure, and software.',
})

const pageRoot = ref(null)
useReveal(pageRoot)

const beliefs = [
  { name: 'Execution', desc: 'Intelligence must act in real environments, not just chat' },
  { name: 'Governance', desc: 'Autonomy is only acceptable when it is accountable' },
  { name: 'Evidence', desc: 'Every decision and artifact is preserved for review' },
  { name: 'Human authority', desc: 'People stay in control of consequential decisions' },
]

const principles = [
  { num: '01', title: 'Execution over demos', body: 'We measure success by governed work completed in real systems—not by chat transcripts.' },
  { num: '02', title: 'Accountability by design', body: 'Identity, budgets, approvals, and audit trails are built into the runtime, not bolted on.' },
  { num: '03', title: 'Human authority retained', body: 'The most consequential decisions always remain with a person, by design.' },
  { num: '04', title: 'One model, many domains', body: 'The same execution layer serves a single workflow and an entire institution.' },
]

const stats = [
  { value: '6', label: 'Execution surfaces', note: 'Browser, Android, Daytona, remote runners, and more.' },
  { value: '150+', label: 'Built-in tools', note: 'Plus any MCP server, REST/GraphQL API, or database you connect.' },
  { value: '100%', label: 'Actions audited', note: 'Every privileged, denied, and approved action is recorded.' },
]

const values = [
  { mini: 'Trust', title: 'Governed autonomy', body: 'Every agent is an identity in a bounded environment—where it works, what it sees, and what it may spend.' },
  { mini: 'Clarity', title: 'Make it inspectable', body: 'Operations become systems people can read: visible workflows, traces, and evidence for every run.' },
  { mini: 'Safety', title: 'Fail toward humans', body: 'When confidence falls or an action is consequential, work escalates to a person instead of proceeding.' },
  { mini: 'Sovereignty', title: 'Your data, your rules', body: 'Deploy in cloud, VPC, on-premise, or air-gapped environments with residency and retention controls.' },
]
</script>
