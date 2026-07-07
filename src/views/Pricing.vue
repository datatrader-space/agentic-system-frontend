<template>
  <PublicLayout>
    <div ref="pageRoot" class="page-main">
      <!-- ── Hero ─────────────────────────────────────────────────────── -->
      <section class="page-hero" id="top">
        <div class="shell page-hero-grid">
          <div class="reveal">
            <div class="section-kicker">Pricing</div>
            <h1>Start with one workflow. <em>Scale</em> to an institution.</h1>
            <p>
              Begin free, grow with your team, and deploy into enterprise, private, or
              sovereign environments—keeping the same execution model and governance the
              whole way.
            </p>
            <div class="hero-actions">
              <a class="btn" href="#plans">See the plans <span>→</span></a>
              <router-link class="btn secondary" to="/contact">Talk to sales</router-link>
            </div>
            <div class="subnav">
              <a href="#plans">Plans</a><a href="#compare">Compare</a>
              <a href="#metering">Metering</a><a href="#faq">FAQ</a>
            </div>
          </div>
          <div class="diagram-card reveal">
            <div class="platform-stack">
              <div v-for="s in stack" :key="s.name" class="stack-row"><b>{{ s.name }}</b><span>{{ s.desc }}</span></div>
            </div>
            <div class="stack-caption">One operating model · priced for every stage</div>
          </div>
        </div>
      </section>

      <!-- ── Plans ────────────────────────────────────────────────────── -->
      <section class="content-section" id="plans">
        <div class="shell">
          <div class="section-head-wide reveal">
            <div><div class="section-kicker">Plans</div><h2>One execution layer, priced for every stage.</h2></div>
            <p>
              Every plan includes persistent workspaces, governed tools, full activity history,
              and human approval gates. Higher tiers add scale, identity, deployment options,
              and assurance.
            </p>
          </div>

          <!-- Billing toggle (only meaningful when a plan has yearly pricing) -->
          <div class="billing-toggle reveal">
            <button class="bt-opt" :class="{ on: billingCycle === 'monthly' }" @click="billingCycle = 'monthly'">Monthly</button>
            <button class="bt-opt" :class="{ on: billingCycle === 'yearly' }" @click="billingCycle = 'yearly'">
              Yearly <span class="bt-save">save ~20%</span>
            </button>
          </div>

          <div class="price-grid stagger">
            <article v-for="p in plans" :key="p.name" class="price-card" :class="{ feature: p.featured }">
              <span v-if="p.flag" class="price-flag">{{ p.flag }}</span>
              <div class="price-name">{{ p.name }}</div>
              <div class="price-amt">{{ priceLabel(p) }}<small v-if="p.unit"> {{ p.unit }}</small></div>
              <div class="price-sub">{{ p.sub }}</div>
              <router-link v-if="p.cta.to" :class="['btn', p.featured ? '' : 'secondary']" :to="p.cta.to">{{ p.cta.label }}</router-link>
              <ul class="price-feats"><li v-for="f in p.feats" :key="f">{{ f }}</li></ul>
            </article>
          </div>
        </div>
      </section>

      <!-- ── Compare ──────────────────────────────────────────────────── -->
      <section class="content-section soft" id="compare">
        <div class="shell">
          <div class="section-head-wide reveal">
            <div><div class="section-kicker">Compare</div><h2>What changes as you scale.</h2></div>
            <p>
              The execution model is identical across tiers. What grows is capacity, identity,
              deployment surface, and the depth of governance and assurance.
            </p>
          </div>
          <div class="compare reveal">
            <div class="compare-row head">
              <div>Capability</div><div>Developer</div><div>Team</div><div>Enterprise</div><div>Sovereign</div>
            </div>
            <div v-for="row in compare" :key="row.label" class="compare-row">
              <div class="lbl">{{ row.label }}</div>
              <div v-for="(cell, ci) in row.cells" :key="ci" class="cell" :class="{ yes: cell === '✓' || row.yes }">{{ cell }}</div>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Metering ─────────────────────────────────────────────────── -->
      <section class="content-section" id="metering">
        <div class="shell">
          <div class="section-head-wide reveal">
            <div><div class="section-kicker">Metering</div><h2>Pay for execution—bounded by your budgets.</h2></div>
            <p>
              Beyond seats, execution is metered transparently. Every mission and organization
              carries budgets and ceilings, so autonomy never outruns intent.
            </p>
          </div>
          <div class="meter-grid stagger">
            <article v-for="m in metering" :key="m.title" class="meter-box">
              <div class="sym">{{ m.sym }}</div><h3>{{ m.title }}</h3><p>{{ m.body }}</p>
            </article>
          </div>
          <p style="margin-top:18px;font:700 11px var(--mono);color:var(--muted);text-transform:uppercase;letter-spacing:.06em">
            Budgets &amp; ceilings apply per mission and per org · read-only modes available · no surprise overages
          </p>
        </div>
      </section>

      <!-- ── FAQ ──────────────────────────────────────────────────────── -->
      <section class="content-section soft" id="faq">
        <div class="shell">
          <div class="section-head-wide reveal">
            <div><div class="section-kicker">FAQ</div><h2>Common questions.</h2></div>
            <p>
              Short answers on plans, metering, and deployment. For anything specific to your
              institution, talk to the North Rays team.
            </p>
          </div>
          <div class="faq-grid stagger">
            <div v-for="f in faq" :key="f.q" class="faq"><h3>{{ f.q }}</h3><p>{{ f.a }}</p></div>
          </div>
        </div>
      </section>

      <!-- ── CTA ──────────────────────────────────────────────────────── -->
      <section class="cta" id="contact">
        <div class="shell">
          <div class="cta-panel reveal">
            <div><h2>Find the right plan for consequential work.</h2></div>
            <div class="cta-copy">
              <p>
                Start free today, or talk to North Rays about a team, enterprise, or sovereign
                deployment with the governance your institution requires.
              </p>
              <div class="cta-actions">
                <router-link class="btn light" to="/login">Start free <span>→</span></router-link>
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
import { ref, onMounted } from 'vue'
import PublicLayout from '../components/public/PublicLayout.vue'
import { useMeta } from '../composables/useMeta'
import { useReveal } from '../composables/useReveal'
import api from '../services/api'

useMeta({
  title: 'Pricing — AADML',
  description: 'Start free and scale to an institution — transparent, execution-metered pricing with per-mission and per-org budget ceilings.',
})

const pageRoot = ref(null)
useReveal(pageRoot)

const billingCycle = ref('monthly')

// Designed marketing tiers — used as the fallback when the backend has no plans.
const staticPlans = [
  {
    name: 'Developer', monthly: 0, yearly: 0, unit: '', sub: 'For building, testing, and a first real workflow.',
    cta: { to: '/login', label: 'Start free' },
    feats: ['1 workspace · browser & Daytona sandbox', 'Community connectors & MCP', 'Limited monthly execution minutes', 'Activity history & basic audit', 'Email & community support'],
  },
  {
    name: 'Team', monthly: 49, yearly: 39, unit: '/ seat / mo', featured: true, flag: 'Most popular',
    sub: 'For teams running governed automations in production.',
    cta: { to: '/contact', label: 'Start a team' },
    feats: ['Everything in Developer', 'Unlimited workspaces & missions', 'Signals, schedules & Workflow Builder', 'Approval gates & role-based access', 'Slack & WhatsApp channels', 'Per-mission & per-org budgets'],
  },
  {
    name: 'Enterprise', amount: 'Custom', sub: 'For institutions with scale, identity, and assurance needs.',
    cta: { to: '/contact', label: 'Contact sales' },
    feats: ['Everything in Team', 'SSO / SAML & SCIM provisioning', 'Dedicated environment or VPC', 'Advanced governance & evaluations', 'SLAs & priority support', 'Usage analytics & cost controls'],
  },
  {
    name: 'Sovereign', amount: 'Contact', sub: 'For public, regulated, and air-gapped deployments.',
    cta: { to: '/contact', label: 'Talk to us' },
    feats: ['Everything in Enterprise', 'On-premise & air-gapped runners', 'Data residency & retention controls', 'Tenant & agency isolation', 'Security review & compliance support', 'Sovereign Remote Runner network'],
  },
]

const plans = ref(staticPlans)

// Prefer live subscription plans from the backend (GET /api/plans/), fall back to
// the designed tiers when none are configured.
onMounted(async () => {
  try {
    const { data } = await api.get('/plans/')
    if (data.plans && data.plans.length) {
      plans.value = data.plans.map((p, i) => {
        // "Contact us" tiers: enterprise/sovereign, or a $0 plan that isn't the free tier.
        const monthly = p.price_monthly_usd != null ? Number(p.price_monthly_usd) : null
        const isContact =
          ['enterprise', 'sovereign', 'custom'].includes(p.tier) ||
          (p.tier !== 'free' && (monthly === 0 || monthly == null) && p.max_agents == null)
        return {
          name: p.name,
          amount: isContact ? 'Custom' : undefined,
          monthly,
          yearly: p.price_yearly_usd ? Math.round(Number(p.price_yearly_usd) / 12) : null,
          unit: isContact ? '' : '/ mo',
          sub: p.description || staticPlans[i]?.sub || 'A governed execution plan.',
          featured: p.tier === 'pro',
          flag: p.tier === 'pro' ? 'Most popular' : '',
          cta: {
            to: p.tier === 'free' ? '/login' : '/contact',
            label: p.tier === 'free' ? 'Start free' : isContact ? 'Contact sales' : 'Start free trial',
          },
          feats: buildFeatureList(p),
        }
      })
    }
  } catch (e) {
    console.debug('Pricing: using static plans', e.message)
  }
})

function buildFeatureList(plan) {
  const f = []
  f.push(plan.max_agents != null ? `${plan.max_agents} agents` : 'Unlimited agents')
  f.push(plan.max_workspaces != null ? `${plan.max_workspaces} workspaces` : 'Unlimited workspaces')
  if (plan.max_schedules != null && plan.max_schedules > 0) f.push(`${plan.max_schedules} schedules`)
  else if (plan.max_schedules == null) f.push('Unlimited schedules')
  f.push(plan.max_members != null ? `${plan.max_members} team members` : 'Unlimited members')
  if (plan.max_mcp_servers != null && plan.max_mcp_servers > 0) f.push(`${plan.max_mcp_servers} MCP servers`)
  if (plan.features?.signals) f.push('Signals & webhooks')
  if (plan.features?.sso) f.push('SSO integration')
  return f
}

// Render the amount for a plan card given the billing cycle. Non-numeric plans
// (Enterprise "Custom", Sovereign "Contact") pass through their literal amount.
function priceLabel(p) {
  if (p.amount) return p.amount
  const val = billingCycle.value === 'yearly' ? (p.yearly ?? p.monthly) : p.monthly
  if (val == null) return 'Custom'
  return val === 0 ? '$0' : `$${val}`
}

const stack = [
  { name: 'Developer', desc: 'Build and test · free to start' },
  { name: 'Team', desc: 'Signals, approvals, roles, and budgets' },
  { name: 'Enterprise', desc: 'SSO, dedicated environment, SLAs, evals' },
  { name: 'Sovereign', desc: 'On-premise, residency, and audit controls' },
  { name: 'Metering', desc: 'Tokens · workspace minutes · tool calls' },
  { name: 'Controls', desc: 'Per-mission and per-org budgets & ceilings' },
]

const compare = [
  { label: 'Workspaces', cells: ['1', 'Unlimited', 'Unlimited', 'Unlimited'] },
  { label: 'Execution surfaces', cells: ['Browser · Daytona', 'All', 'All', 'All + private'] },
  { label: 'Signals & schedules', cells: ['—', '✓', '✓', '✓'] },
  { label: 'Workflow Builder', cells: ['Preview', '✓', '✓', '✓'] },
  { label: 'Approval gates & RBAC', cells: ['Basic', '✓', 'Advanced', 'Advanced'], yes: false },
  { label: 'SSO / SAML & SCIM', cells: ['—', '—', '✓', '✓'] },
  { label: 'Deployment', cells: ['Cloud', 'Cloud', 'Dedicated · VPC', 'On-prem · sovereign'] },
  { label: 'Audit, retention & isolation', cells: ['Basic', 'Standard', 'Advanced', 'Full controls'] },
  { label: 'Support', cells: ['Community', 'Priority email', 'SLA', 'Dedicated'] },
]

const metering = [
  { sym: '∑', title: 'Model tokens', body: 'Input and output tokens across reasoning and tool use, reported per run, per agent, and per organization.' },
  { sym: '⧗', title: 'Workspace minutes', body: 'Active compute time for Daytona, browser sessions, Android devices, and Remote Runner work.' },
  { sym: '↹', title: 'Tool calls', body: 'Connector, API, and automation invocations—rate-limited and capped by per-tool policy.' },
]

const faq = [
  { q: 'Is there really a free tier?', a: 'Yes. Developer is free and includes a real workspace, browser and Daytona sandboxes, and a monthly execution allowance—enough to ship a first governed workflow.' },
  { q: 'How does metering work?', a: 'Execution is billed on model tokens, active workspace minutes, and tool calls. Every mission and organization has budgets and ceilings you set in advance.' },
  { q: 'Can I cap spend?', a: 'Per-mission and per-org budgets, per-tool limits, and read-only modes prevent runaway cost. Work pauses or escalates instead of exceeding a ceiling.' },
  { q: 'Can we deploy in our own environment?', a: 'Enterprise supports dedicated environments and VPC. Sovereign adds on-premise, air-gapped runners, data residency, and retention controls.' },
  { q: 'Do you offer annual billing?', a: 'Team and above can be billed annually with volume and commitment discounts. Talk to sales for an institutional agreement.' },
  { q: 'What support is included?', a: 'Community for Developer, priority email for Team, SLA-backed support for Enterprise, and a dedicated team for Sovereign deployments.' },
]
</script>

<style scoped>
.billing-toggle {
  display: inline-flex;
  gap: 4px;
  margin: 0 0 26px;
  padding: 5px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--paper-2);
}
.bt-opt {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 18px;
  border: none;
  border-radius: 999px;
  background: transparent;
  font-family: var(--sans);
  font-size: 13px;
  font-weight: 800;
  color: #536159;
  cursor: pointer;
  transition: background .18s ease, color .18s ease;
}
.bt-opt.on { background: var(--ink); color: #fff; }
.bt-save {
  font: 800 9px var(--mono);
  letter-spacing: .04em;
  text-transform: uppercase;
  padding: 3px 7px;
  border-radius: 999px;
  background: var(--green-2);
  color: var(--green);
}
.bt-opt.on .bt-save { background: rgba(255, 255, 255, .18); color: #cbeadd; }
</style>
