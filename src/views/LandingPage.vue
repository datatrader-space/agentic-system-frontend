<template>
  <PublicLayout>
    <!-- ── Hero ─────────────────────────────────────────────── -->
    <section class="relative overflow-hidden">
      <HeroBackdrop />
      <div class="relative z-10 mx-auto max-w-7xl px-4 pb-16 pt-16 sm:px-6 lg:px-8 lg:pb-24 lg:pt-24">
      <div class="grid items-center gap-12 lg:grid-cols-2">
        <div v-reveal>
          <span class="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-ink-soft shadow-s">
            <span class="vm-orb is-live"></span>
            Now shipping — Let’s Code agentic IDE
          </span>
          <h1 class="mt-6 font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-6xl">
            The agentic OS for
            <span class="vm-grad-text">coding & knowledge work</span>
          </h1>
          <p class="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
            One platform where agents read your code, edit with reviewable diffs, run and verify, retrieve from your knowledge, and automate on a schedule — code-aware, context-aware, and cost-aware. Self-hostable and built for teams.
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <router-link to="/login" class="hero-btn-primary">
              Get started free
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-5 w-5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </router-link>
            <router-link to="/how-it-works" class="hero-btn-ghost">See how it works</router-link>
          </div>
          <p class="mt-7 flex items-center gap-2 text-sm text-ink-faint">
            <Icon icon="lucide:shield-check" class="h-5 w-5 text-teal" />
            Edits land as reviewable diffs — accept hunk-by-hunk, never silent writes.
          </p>
        </div>

        <!-- Hero visual: animated agent terminal -->
        <div v-reveal class="relative">
          <div class="terminal">
            <div class="terminal-badge">
              <span class="vm-orb is-live"></span> Agent working…
            </div>
            <div class="terminal-bar">
              <span class="dot" style="background:#ff5f56"></span>
              <span class="dot" style="background:#ffbd2e"></span>
              <span class="dot" style="background:#27c93f"></span>
              <span class="terminal-file">agent · vividmind-v2</span>
            </div>
            <div class="terminal-body">
              <div v-for="(line, i) in shownLines" :key="i" class="code-line">
                <span class="ln">{{ i + 1 }}</span><span v-html="line"></span>
              </div>
              <span v-if="typing" class="caret"></span>
            </div>
          </div>
          <div class="pointer-events-none absolute -bottom-6 -right-4 hidden rounded-2xl border border-line bg-surface px-4 py-3 shadow-l sm:block" v-reveal>
            <div class="flex items-center gap-2 text-sm font-semibold text-ink">
              <Icon icon="lucide:git-pull-request" class="h-4 w-4 text-violet" /> PR opened · 3 files
            </div>
            <div class="mt-0.5 text-xs text-ink-faint">+128 −42 · verified ✓</div>
          </div>
        </div>
      </div>
      </div>
    </section>

    <!-- ── Logo cloud ──────────────────────────────────────── -->
    <section class="border-y border-line bg-surface/60">
      <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p class="text-center text-xs font-semibold uppercase tracking-[0.2em] text-ink-faint">
          Works with every major model provider
        </p>
        <div class="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          <span v-for="p in providers" :key="p" class="text-base font-semibold text-ink-faint transition-colors hover:text-ink">{{ p }}</span>
        </div>
      </div>
    </section>

    <!-- ── Feature bento ───────────────────────────────────── -->
    <section class="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
      <div class="mx-auto max-w-2xl text-center" v-reveal>
        <h2 class="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Everything an agent needs to ship work</h2>
        <p class="mt-4 text-lg text-ink-soft">A complete, self-hostable platform — not a wrapper. Reason, retrieve, edit, run, and automate in one place.</p>
      </div>

      <div class="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="(f, i) in features"
          :key="f.title"
          v-reveal
          class="bento"
          :class="{ 'sm:col-span-2': i === 0 }"
        >
          <span class="bento-icon"><Icon :icon="f.icon" class="h-6 w-6" /></span>
          <h3 class="mt-5 text-lg font-bold text-ink">{{ f.title }}</h3>
          <p class="mt-2 text-[0.95rem] leading-relaxed text-ink-soft">{{ f.desc }}</p>
          <span v-if="f.badge" class="bento-badge">{{ f.badge }}</span>
        </article>
      </div>

      <div class="mt-12 text-center" v-reveal>
        <router-link to="/features" class="hero-btn-ghost">Explore all features →</router-link>
      </div>
    </section>

    <!-- ── How it works ────────────────────────────────────── -->
    <section class="border-y border-line bg-g-warm">
      <div class="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div class="mx-auto max-w-2xl text-center" v-reveal>
          <h2 class="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">From prompt to pull request</h2>
          <p class="mt-4 text-lg text-ink-soft">The agent decides when to answer, edit, run, or ask — you stay in control.</p>
        </div>
        <div class="mt-14 grid gap-6 md:grid-cols-3">
          <div v-for="(s, i) in steps" :key="s.title" v-reveal class="step">
            <span class="step-num">{{ i + 1 }}</span>
            <h3 class="mt-4 text-lg font-bold text-ink">{{ s.title }}</h3>
            <p class="mt-2 text-[0.95rem] leading-relaxed text-ink-soft">{{ s.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Stats ───────────────────────────────────────────── -->
    <section class="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div class="grid gap-8 rounded-2xl border border-line bg-surface p-10 shadow-m sm:grid-cols-4" v-reveal>
        <div v-for="st in stats" :key="st.label" class="text-center">
          <div class="font-display text-4xl font-extrabold text-ink">{{ st.value }}</div>
          <div class="mt-1 text-xs font-semibold uppercase tracking-wider text-ink-faint">{{ st.label }}</div>
        </div>
      </div>
    </section>

    <!-- ── Final CTA ───────────────────────────────────────── -->
    <section class="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
      <div class="cta-box" v-reveal>
        <h2 class="font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Ready to deploy your first agent?</h2>
        <p class="mx-auto mt-4 max-w-xl text-lg text-blue-100">Self-host with Docker in minutes, or start on the cloud. Bring your own model keys.</p>
        <div class="mt-8 flex flex-wrap justify-center gap-3">
          <router-link to="/login" class="cta-btn-light">Start building now</router-link>
          <router-link to="/pricing" class="cta-btn-outline">View pricing</router-link>
        </div>
      </div>
    </section>
  </PublicLayout>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { Icon } from '@iconify/vue'
import PublicLayout from '../components/public/PublicLayout.vue'
import HeroBackdrop from '../components/public/HeroBackdrop.vue'
import { useMeta } from '../composables/useMeta'

useMeta({
  title: 'AADML — The agentic OS for coding & knowledge work',
  description: 'Build, deploy, and manage AI agents that read your code, propose reviewable diffs, run and verify, retrieve from your knowledge, and automate on a schedule. 1,800+ tools, every major model provider, self-hostable.',
  jsonLd: {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'AADML',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web, Docker',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    description: 'The agentic OS for coding and knowledge work — code-aware, context-aware, cost-aware automation.',
  },
})

const providers = ['OpenAI', 'Anthropic', 'Google', 'OpenRouter', 'xAI', 'Ollama']

const features = [
  { icon: 'lucide:code-2', title: 'Let’s Code agentic IDE', desc: 'Clone a repo in the browser. The agent reads, edits, and proposes reviewable diffs you accept hunk-by-hunk — then exports a GitHub PR. No silent writes.' },
  { icon: 'lucide:wrench', title: '1,800+ tools', desc: 'Builtin tools, any MCP server, and any OpenAPI/Postman service — lazily loaded and authorized per agent, so the model never drowns in a giant prompt.' },
  { icon: 'lucide:git-branch', title: 'Code intelligence', desc: 'Symbol- and graph-aware retrieval grounds every change in how your codebase actually fits together — callers, callees, imports, and related tests.', badge: 'Beta' },
  { icon: 'lucide:book-open', title: 'Knowledge & RAG', desc: 'Ground agents in your uploaded docs and crawled websites with hybrid semantic + keyword search, per agent.' },
  { icon: 'lucide:zap', title: 'Automation', desc: 'Fire agents from webhooks (signals) or cron (schedules) with budget caps, retries, dead-letter recovery, and human-in-the-loop approval.' },
  { icon: 'lucide:building-2', title: 'Multi-tenant & cost-metered', desc: 'Orgs, workspaces, RBAC, encrypted credential vaults, and per-token cost accounting baked in from day one — not bolted on.' },
]

const steps = [
  { title: 'Ask or assign', desc: 'Start a conversation or trigger an agent from a webhook or schedule. It retrieves the right context first.' },
  { title: 'Edit & verify', desc: 'The agent proposes minimal diffs against a clone, runs focused checks, and asks when it’s unsure.' },
  { title: 'Review & ship', desc: 'You review per-file and per-hunk, accept what’s right, and export a pull request — guardrails intact.' },
]

const stats = [
  { value: '1,800+', label: 'Tools' },
  { value: '6', label: 'Model providers' },
  { value: '100+', label: 'Models' },
  { value: '24/7', label: 'Autonomous' },
]

/* ── Animated terminal ── */
const sequence = [
  '<span class="c-gray">// agent: implement the change</span>',
  '<span class="c-violet">search_code</span>(<span class="c-str">"checkout limit enforcement"</span>)',
  '<span class="c-gray">// 3 results · ranked by graph proximity</span>',
  '<span class="c-violet">propose_diff</span>({ files: <span class="c-num">3</span> })',
  '<span class="c-gray">// running focused verify…</span>',
  '<span class="c-ok">✓ py_compile ok · 4 related tests pass</span>',
  '<span class="c-violet">export_pr</span>({ base: <span class="c-str">"main"</span> })',
  '<span class="c-ok">✓ PR opened · awaiting review</span>',
]
const shownLines = ref([])
const typing = ref(true)
let timers = []

function run() {
  shownLines.value = []
  typing.value = true
  let d = 350
  sequence.forEach((line) => {
    timers.push(setTimeout(() => { shownLines.value.push(line) }, d))
    d += 650
  })
  timers.push(setTimeout(() => { typing.value = false }, d + 400))
  timers.push(setTimeout(run, d + 3200))
}

onMounted(run)
onUnmounted(() => { timers.forEach(clearTimeout); timers = [] })
</script>

<style scoped>
.hero-btn-primary {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 13px 24px; border-radius: 13px;
  font-weight: 600; color: #fff; text-decoration: none;
  background: var(--vm-g-brand); box-shadow: var(--vm-glow-p);
  transition: transform .18s var(--vm-ease), box-shadow .18s;
}
.hero-btn-primary:hover { transform: translateY(-2px); box-shadow: var(--vm-glow-v); }

.hero-btn-ghost {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 13px 22px; border-radius: 13px;
  font-weight: 600; color: var(--vm-ink); text-decoration: none;
  background: var(--vm-surface); border: 1px solid var(--vm-border); box-shadow: var(--vm-shadow-s);
  transition: transform .18s var(--vm-ease), border-color .18s;
}
.hero-btn-ghost:hover { transform: translateY(-2px); border-color: var(--vm-primary); }

/* Terminal */
.terminal {
  position: relative;
  border-radius: 18px;
  overflow: hidden;
  background: linear-gradient(180deg, #0d1117, #161b22);
  box-shadow: var(--vm-shadow-l);
  border: 1px solid rgba(255,255,255,.08);
  height: 360px;
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
}
.terminal-badge {
  position: absolute; top: -1px; right: 18px;
  display: inline-flex; align-items: center; gap: 8px;
  padding: 7px 14px; border-radius: 0 0 12px 12px;
  font-size: .75rem; font-weight: 600; color: #e5e7eb;
  background: rgba(37,99,235,.9);
}
.terminal-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,.06);
}
.dot { width: 12px; height: 12px; border-radius: 50%; }
.terminal-file { margin-left: 12px; font-size: .8rem; color: #6b7280; }
.terminal-body { padding: 18px 20px; font-size: .86rem; color: #e6edf3; overflow: hidden; }
.code-line { display: flex; gap: 18px; margin-bottom: 6px; animation: vmCardIn .3s var(--vm-ease2) both; }
.ln { color: #484f58; min-width: 16px; text-align: right; user-select: none; }
.caret { display: inline-block; width: 8px; height: 15px; background: #2563EB; animation: blink 1s step-end infinite; }
@keyframes blink { 50% { opacity: 0; } }
.c-gray { color: #8b949e; } .c-violet { color: #79c0ff; } .c-str { color: #7ee787; }
.c-num { color: #f2cc60; } .c-ok { color: #56d364; }

/* Bento */
.bento {
  position: relative;
  border-radius: 18px;
  border: 1px solid var(--vm-border);
  background: var(--vm-surface);
  padding: 26px;
  box-shadow: var(--vm-shadow-s);
  transition: transform .22s var(--vm-ease), box-shadow .22s, border-color .22s;
}
.bento:hover { transform: translateY(-4px); box-shadow: var(--vm-shadow-m); border-color: rgba(37,99,235,.35); }
.bento-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 48px; height: 48px; border-radius: 13px;
  color: var(--vm-primary); background: var(--vm-primary-soft);
}
.bento-badge {
  position: absolute; top: 20px; right: 20px;
  padding: 3px 9px; border-radius: 999px;
  font-size: .65rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
  color: var(--vm-accent); background: var(--vm-accent-soft);
}

/* Steps */
.step {
  border-radius: 18px; border: 1px solid var(--vm-border);
  background: var(--vm-glass-strong); backdrop-filter: blur(10px);
  padding: 28px; box-shadow: var(--vm-shadow-s);
}
.step-num {
  display: inline-flex; align-items: center; justify-content: center;
  width: 40px; height: 40px; border-radius: 12px;
  font-family: var(--vm-font-display); font-weight: 800; color: #fff;
  background: var(--vm-g-brand);
}

/* CTA */
.cta-box {
  position: relative; overflow: hidden;
  border-radius: 26px; padding: 72px 32px; text-align: center;
  background: var(--vm-g-multi); box-shadow: var(--vm-shadow-l);
}
.cta-btn-light {
  display: inline-flex; padding: 13px 28px; border-radius: 13px;
  font-weight: 700; text-decoration: none; color: var(--vm-primary); background: #fff;
  transition: transform .18s var(--vm-ease);
}
.cta-btn-light:hover { transform: translateY(-2px); }
.cta-btn-outline {
  display: inline-flex; padding: 13px 28px; border-radius: 13px;
  font-weight: 700; text-decoration: none; color: #fff;
  border: 1px solid rgba(255,255,255,.5);
  transition: background .18s;
}
.cta-btn-outline:hover { background: rgba(255,255,255,.14); }
</style>
