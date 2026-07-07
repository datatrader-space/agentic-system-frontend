<template>
  <PublicLayout>
    <div ref="pageRoot" class="page-main">
      <!-- ── Hero ─────────────────────────────────────────────────────── -->
      <section class="page-hero" id="top" style="padding-bottom:40px">
        <div class="shell">
          <div class="reveal" style="max-width:760px">
            <div class="section-kicker">Contact</div>
            <h1 style="max-width:16ch">Let's talk about <em>consequential</em> work.</h1>
            <p>
              Whether you're shipping a first workflow or planning an institutional deployment,
              the North Rays team is here to help you put governed AI agents to work.
            </p>
          </div>
        </div>
      </section>

      <!-- ── Form + info ──────────────────────────────────────────────── -->
      <section class="content-section" style="padding-top:20px">
        <div class="shell">
          <div class="contact-grid">
            <!-- Form -->
            <form class="contact-form reveal" @submit.prevent="submitForm">
              <div class="cf-row">
                <label>Name
                  <input v-model="form.name" type="text" required placeholder="Jane Doe" />
                </label>
                <label>Email
                  <input v-model="form.email" type="email" required placeholder="you@institution.org" />
                </label>
              </div>
              <div class="cf-row">
                <label>Company
                  <input v-model="form.company" type="text" placeholder="Organization" />
                </label>
                <label>Subject
                  <input v-model="form.subject" type="text" placeholder="How can we help?" />
                </label>
              </div>
              <label>Message
                <textarea v-model="form.message" rows="6" required placeholder="Tell us about your use case, scale, and timeline…"></textarea>
              </label>
              <button class="btn" type="submit">Send message <span>↗</span></button>
            </form>

            <!-- Info cards -->
            <div class="contact-side reveal">
              <article v-for="c in channels" :key="c.title" class="info-card">
                <div class="icon">{{ c.icon }}</div>
                <h3>{{ c.title }}</h3>
                <p>{{ c.body }}</p>
                <ul><li v-for="l in c.lines" :key="l">{{ l }}</li></ul>
              </article>
            </div>
          </div>
        </div>
      </section>

      <!-- ── CTA ──────────────────────────────────────────────────────── -->
      <section class="cta">
        <div class="shell">
          <div class="cta-panel reveal">
            <div><h2>Prefer to explore first?</h2></div>
            <div class="cta-copy">
              <p>Start free with a real workspace, or read the docs to see how governed execution works end to end.</p>
              <div class="cta-actions">
                <router-link class="btn light" to="/login">Start free <span>→</span></router-link>
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
import { notify } from '@/composables/useNotify'

useMeta({
  title: 'Contact — AADML',
  description: 'Talk to the North Rays team about deploying governed AI agents—from a first workflow to an enterprise or sovereign deployment.',
})

const pageRoot = ref(null)
useReveal(pageRoot)

// Preserved logic
const form = ref({ name: '', email: '', company: '', subject: '', message: '' })

const submitForm = () => {
  notify.success(`Thank you for your message! We'll get back to you at ${form.value.email} soon.`)
  form.value = { name: '', email: '', company: '', subject: '', message: '' }
}

const channels = [
  { icon: '✉', title: 'Sales', body: 'Team, enterprise, and sovereign deployments with the governance your institution requires.', lines: ['hello@northrays.com', 'Response within 1 business day'] },
  { icon: '⛑', title: 'Support', body: 'Help with agents, workflows, connectors, and execution surfaces.', lines: ['Priority email for Team+', 'SLA-backed for Enterprise'] },
  { icon: '⚖', title: 'Security & compliance', body: 'Security reviews, data residency, and compliance for regulated environments.', lines: ['security@northrays.com', 'On-prem & air-gapped options'] },
]
</script>

<style scoped>
.page-main { padding-bottom: 40px; }

.contact-grid {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 24px;
  align-items: start;
}

.contact-form {
  border: 1px solid var(--line);
  border-radius: 28px;
  background: var(--paper-2);
  box-shadow: var(--shadow-sm);
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.cf-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.contact-form label {
  display: flex; flex-direction: column; gap: 7px;
  font: 800 10px var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--muted);
}
.contact-form input,
.contact-form textarea {
  font-family: var(--sans); font-size: 14px; font-weight: 500; color: var(--ink);
  border: 1px solid var(--line); border-radius: 12px; background: #fff;
  padding: 12px 14px; outline: none; text-transform: none; letter-spacing: normal;
  transition: border-color .15s, box-shadow .15s;
}
.contact-form input:focus,
.contact-form textarea:focus { border-color: var(--blue); box-shadow: 0 0 0 3px var(--blue-2); }
.contact-form textarea { resize: vertical; }
.contact-form .btn { align-self: flex-start; margin-top: 6px; }

.contact-side { display: grid; gap: 14px; }

@media (max-width: 900px) {
  .contact-grid { grid-template-columns: 1fr; }
}
@media (max-width: 560px) {
  .cf-row { grid-template-columns: 1fr; }
}
</style>
