<template>
  <PublicLayout>
    <div ref="pageRoot" class="page-main">
      <!-- ── Hero ─────────────────────────────────────────────────────── -->
      <section class="page-hero" id="top">
        <div class="shell page-hero-grid">
          <div class="reveal">
            <div class="section-kicker">Our mission</div>
            <h1>Make agentic execution <em>accountable.</em></h1>
            <p>
              Models can reason. We build the layer that lets them <em>act</em>—inside real
              systems, under real controls, with a person in charge of the decisions that matter.
            </p>
            <div class="hero-actions">
              <a class="btn" href="#principles">What we believe <span>→</span></a>
              <router-link class="btn secondary" to="/features">See the platform</router-link>
            </div>
          </div>
          <div class="diagram-card reveal">
            <div class="platform-stack">
              <div v-for="s in pillars" :key="s.name" class="stack-row"><b>{{ s.name }}</b><span>{{ s.desc }}</span></div>
            </div>
            <div class="stack-caption">One operating model · from a single workflow to an institution</div>
          </div>
        </div>
      </section>

      <!-- ── Statement ────────────────────────────────────────────────── -->
      <section class="content-section" id="statement">
        <div class="shell intro-grid">
          <div class="reveal">
            <div class="section-kicker">Why we exist</div>
            <h2 class="statement">Intelligence should not stop at the <strong>screen.</strong></h2>
          </div>
          <div class="reveal">
            <p class="section-copy">
              Most AI stops at a chat box. Real work doesn't. It moves through browsers, devices,
              code, databases, documents, schedules, and people—and it has consequences. AADML
              exists to give agents governed access to those environments, so an organization can
              automate consequential work without giving up authority, evidence, or control.
            </p>
            <p class="section-copy" style="margin-top:18px">
              We would rather ship a smaller set of capabilities that are honest, inspectable, and
              safe than a longer list that hides what an agent actually did.
            </p>
          </div>
        </div>
      </section>

      <!-- ── Principles ───────────────────────────────────────────────── -->
      <section class="content-section soft" id="principles">
        <div class="shell">
          <div class="section-head-wide reveal">
            <div><div class="section-kicker">Principles</div><h2>How we build.</h2></div>
            <p>Four commitments that shape every decision—from the runtime to this website.</p>
          </div>
          <div class="lifecycle">
            <article v-for="(p, i) in principles" :key="p.title" class="life-card reveal" :style="{ '--tone': p.tone }">
              <small>0{{ i + 1 }} · {{ p.tag }}</small>
              <h3>{{ p.title }}</h3>
              <p>{{ p.body }}</p>
            </article>
          </div>
        </div>
      </section>

      <!-- ── What we're building toward ───────────────────────────────── -->
      <section class="content-section" id="vision">
        <div class="shell governance-grid">
          <div class="reveal">
            <div class="section-kicker">The long view</div>
            <h2>A common execution layer for consequential work.</h2>
            <p class="section-copy">
              The same governed model should serve one team's first automation and an entire
              institution's operations—without changing how autonomy is bounded, evidenced, and
              reviewed. That is the layer we are building toward.
            </p>
          </div>
          <div class="gov-cards reveal">
            <article v-for="v in beliefs" :key="v.title" class="gov-card">
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
              <p>Start with one governed workflow—or talk to us about where you want to take it.</p>
              <div class="cta-actions">
                <router-link class="btn light" to="/login">Get started <span>↗</span></router-link>
                <router-link class="btn secondary" style="border-color:rgba(255,255,255,.55);color:white" to="/contact">Talk to the team</router-link>
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
  title: 'Mission — AADML',
  description: "AADML's mission: make agentic execution accountable — governed access to tools, data, and environments, with humans in control of consequential decisions.",
})

const pageRoot = ref(null)
useReveal(pageRoot)

const pillars = [
  { name: 'Execution', desc: 'Agents act in real environments, not just chat' },
  { name: 'Governance', desc: 'Autonomy is only acceptable when accountable' },
  { name: 'Evidence', desc: 'Every action and decision is preserved for review' },
  { name: 'Authority', desc: 'People stay in control of consequential steps' },
]

const principles = [
  { tone: 'var(--blue)', tag: 'EXECUTION', title: 'Act, don’t just answer', body: 'Value comes from work completed in real systems—browsers, devices, code, data—not from transcripts.' },
  { tone: 'var(--green)', tag: 'GOVERNANCE', title: 'Accountable by design', body: 'Identity, budgets, approvals, and audit are built into the runtime, never bolted on afterward.' },
  { tone: 'var(--red)', tag: 'AUTHORITY', title: 'Humans keep the wheel', body: 'The most consequential decisions stop at a person—by default, not as an option.' },
  { tone: 'var(--violet)', tag: 'HONESTY', title: 'Say what it really does', body: 'We describe capabilities as they are today, so teams can trust what they deploy.' },
]

const beliefs = [
  { mini: 'Trust', title: 'Governed autonomy', body: 'Every agent is an identity in a bounded environment—where it works, what it sees, and what it may spend.' },
  { mini: 'Clarity', title: 'Inspectable by default', body: 'Operations become systems people can read: visible workflows, traces, and signed action receipts.' },
  { mini: 'Safety', title: 'Fail toward humans', body: 'When confidence drops or an action is consequential, work escalates to a person instead of proceeding.' },
  { mini: 'Openness', title: 'Your data, your keys', body: 'Bring your own model keys, and self-host the whole platform with Docker when you need to.' },
]
</script>
