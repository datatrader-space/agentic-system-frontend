<template>
  <PublicLayout>
    <!-- Header -->
    <section class="relative overflow-hidden">
      <HeroBackdrop />
      <div class="relative z-10 mx-auto max-w-7xl px-4 pb-10 pt-16 text-center sm:px-6 lg:px-8 lg:pt-24">
        <span v-reveal class="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-ink-soft shadow-s">
          <Icon icon="lucide:sparkles" class="h-4 w-4 text-violet" /> Platform capabilities
        </span>
        <h1 v-reveal class="mx-auto mt-6 max-w-3xl font-display text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
          One platform. Every capability an agent needs.
        </h1>
        <p v-reveal class="mx-auto mt-5 max-w-2xl text-lg text-ink-soft">
          From a browser-based coding agent to webhook automation and multi-tenant governance — accurate to what ships today, with beta work clearly marked.
        </p>
      </div>
    </section>

    <!-- Groups -->
    <section class="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <div v-for="group in groups" :key="group.title" class="mb-16" v-reveal>
        <div class="mb-6 flex items-center gap-3">
          <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-soft text-violet">
            <Icon :icon="group.icon" class="h-5 w-5" />
          </span>
          <h2 class="font-display text-2xl font-extrabold tracking-tight text-ink">{{ group.title }}</h2>
        </div>
        <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <article v-for="f in group.items" :key="f.title" class="feature-card">
            <div class="flex items-start justify-between gap-3">
              <span class="feature-icon"><Icon :icon="f.icon" class="h-5 w-5" /></span>
              <span class="status" :class="f.status === 'Beta' ? 'is-beta' : 'is-shipped'">{{ f.status }}</span>
            </div>
            <h3 class="mt-4 font-bold text-ink">{{ f.title }}</h3>
            <p class="mt-2 text-sm leading-relaxed text-ink-soft">{{ f.desc }}</p>
          </article>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
      <div class="flex flex-col items-center justify-between gap-6 rounded-2xl border border-line bg-surface p-10 text-center shadow-m sm:flex-row sm:text-left" v-reveal>
        <div>
          <h2 class="font-display text-2xl font-extrabold text-ink">See it on your own repo</h2>
          <p class="mt-2 text-ink-soft">Start free, bring your own model keys, and self-host in minutes.</p>
        </div>
        <div class="flex shrink-0 gap-3">
          <router-link to="/login" class="cta-primary">Get started</router-link>
          <router-link to="/pricing" class="cta-ghost">Pricing</router-link>
        </div>
      </div>
    </section>
  </PublicLayout>
</template>

<script setup>
import { Icon } from '@iconify/vue'
import PublicLayout from '../components/public/PublicLayout.vue'
import HeroBackdrop from '../components/public/HeroBackdrop.vue'
import { useMeta } from '../composables/useMeta'

useMeta({
  title: 'Features — AADML',
  description: 'Explore AADML: the Let’s Code agentic IDE, 1,800+ tools, code intelligence, knowledge & RAG, webhook/cron automation, multi-tenant governance, and full cost observability.',
})

const groups = [
  {
    title: 'Core agent engine',
    icon: 'lucide:cpu',
    items: [
      { icon: 'lucide:repeat', title: 'ReAct agent runtime', desc: 'Multi-step reasoning with streaming tool calls over WebSocket, with full event replay on reconnect.', status: 'Shipped' },
      { icon: 'lucide:user-check', title: 'Human-in-the-loop', desc: 'Agents request approval for risky tools, ask to clarify when unsure, and pause for your decision.', status: 'Shipped' },
      { icon: 'lucide:bot', title: 'Autonomous runner', desc: 'Background execution for signals and schedules with planning, working memory, and budget guardrails.', status: 'Shipped' },
    ],
  },
  {
    title: 'Code intelligence & Let’s Code',
    icon: 'lucide:code-2',
    items: [
      { icon: 'lucide:panel-left', title: 'Let’s Code IDE', desc: 'Clone a GitHub repo, browse files, and chat with an agent that proposes diffs you review and export as a PR.', status: 'Shipped' },
      { icon: 'lucide:git-compare', title: 'Reviewable diffs', desc: 'Per-file and per-hunk accept/revert against a clone — focused verify runs before anything ships.', status: 'Shipped' },
      { icon: 'lucide:network', title: 'Graph-aware retrieval', desc: 'Symbol and call-graph indexing (CRS) grounds edits in callers, callees, imports, and related tests.', status: 'Beta' },
    ],
  },
  {
    title: 'Knowledge & RAG',
    icon: 'lucide:book-open',
    items: [
      { icon: 'lucide:file-text', title: 'Document knowledge', desc: 'Upload PDFs, text, and markdown — chunked and embedded for per-agent semantic retrieval.', status: 'Shipped' },
      { icon: 'lucide:globe', title: 'Website crawler', desc: 'Index sites via sitemap or crawl, grouped as one source with live progress.', status: 'Shipped' },
      { icon: 'lucide:brain', title: 'Self-learning (Dream)', desc: 'Agents distil knowledge cards from their own history and inject them into future runs.', status: 'Shipped' },
    ],
  },
  {
    title: 'Tools & integrations',
    icon: 'lucide:wrench',
    items: [
      { icon: 'lucide:boxes', title: '1,800+ tools', desc: 'Builtin + MCP + OpenAPI/Postman services, lazily loaded and authorized per agent.', status: 'Shipped' },
      { icon: 'lucide:search', title: 'Semantic tool discovery', desc: 'Agents find the right tool via embedding search instead of a bloated prompt.', status: 'Shipped' },
      { icon: 'lucide:plug', title: 'MCP servers', desc: 'Connect stdio/HTTP/SSE MCP servers with credential injection and circuit breakers.', status: 'Shipped' },
    ],
  },
  {
    title: 'Automation',
    icon: 'lucide:zap',
    items: [
      { icon: 'lucide:webhook', title: 'Signals (webhooks)', desc: 'External systems fire agents with idempotency, HMAC auth, retries, and a dead-letter queue.', status: 'Shipped' },
      { icon: 'lucide:calendar-clock', title: 'Schedules (cron)', desc: 'Run agents periodically with per-schedule budgets, max runs, and auto-pause on failure.', status: 'Shipped' },
      { icon: 'lucide:workflow', title: 'Workflow builder', desc: 'Compose multi-step automations on a node canvas with retries, approvals, and sub-workflows.', status: 'Beta' },
    ],
  },
  {
    title: 'Security, governance & cost',
    icon: 'lucide:shield-check',
    items: [
      { icon: 'lucide:building-2', title: 'Multi-tenancy', desc: 'Organizations, workspaces, teams, and RBAC with workspace-scoped resources and audit trails.', status: 'Shipped' },
      { icon: 'lucide:key-round', title: 'Encrypted credentials', desc: 'Fernet-encrypted vaults and OAuth connections — secrets are never exposed to agents or logs.', status: 'Shipped' },
      { icon: 'lucide:bar-chart-3', title: 'Cost observability', desc: 'Every LLM call is logged with tokens, latency, and frozen cost — per user, agent, and source.', status: 'Shipped' },
    ],
  },
]
</script>

<style scoped>
.feature-card {
  border-radius: 16px;
  border: 1px solid var(--vm-border);
  background: var(--vm-surface);
  padding: 22px;
  box-shadow: var(--vm-shadow-s);
  transition: transform .2s var(--vm-ease), box-shadow .2s, border-color .2s;
}
.feature-card:hover { transform: translateY(-3px); box-shadow: var(--vm-shadow-m); border-color: rgba(37,99,235,.3); }
.feature-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 42px; height: 42px; border-radius: 12px;
  color: var(--vm-primary); background: var(--vm-primary-soft);
}
.status {
  padding: 3px 9px; border-radius: 999px;
  font-size: .65rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
}
.is-shipped { color: var(--vm-green); background: rgba(16,185,129,.12); }
.is-beta { color: var(--vm-accent); background: var(--vm-accent-soft); }

.cta-primary {
  display: inline-flex; padding: 12px 24px; border-radius: 12px;
  font-weight: 600; color: #fff; text-decoration: none; background: var(--vm-g-brand);
  box-shadow: var(--vm-glow-p); transition: transform .18s var(--vm-ease);
}
.cta-primary:hover { transform: translateY(-2px); }
.cta-ghost {
  display: inline-flex; padding: 12px 24px; border-radius: 12px;
  font-weight: 600; color: var(--vm-ink); text-decoration: none;
  border: 1px solid var(--vm-border);
}
.cta-ghost:hover { border-color: var(--vm-primary); }
</style>
