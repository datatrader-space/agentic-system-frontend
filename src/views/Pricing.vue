<template>
  <PublicLayout>
    <!-- Header -->
    <section class="relative overflow-hidden">
      <HeroBackdrop />
      <div class="relative z-10 mx-auto max-w-7xl px-4 pb-6 pt-16 text-center sm:px-6 lg:px-8 lg:pt-24">
        <h1 v-reveal class="font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
          Simple, transparent pricing
        </h1>
        <p v-reveal class="mx-auto mt-4 max-w-xl text-lg text-ink-soft">
          Start free and bring your own model keys. Upgrade as your team grows.
        </p>

        <!-- Billing toggle -->
        <div v-reveal class="mt-8 inline-flex items-center rounded-xl border border-line bg-surface p-1 shadow-s">
          <button class="toggle" :class="{ active: !isYearly }" @click="billingCycle = 'monthly'">Monthly</button>
          <button class="toggle" :class="{ active: isYearly }" @click="billingCycle = 'yearly'">
            Yearly <span class="save">Save 20%</span>
          </button>
        </div>
      </div>
    </section>

    <!-- Pricing grid -->
    <section class="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
      <div class="grid items-stretch gap-6 md:grid-cols-3">
        <div
          v-for="plan in plans"
          :key="plan.name"
          v-reveal
          class="plan"
          :class="{ featured: plan.featured }"
        >
          <span v-if="plan.featured" class="badge">Most popular</span>
          <h3 class="text-xl font-bold text-ink">{{ plan.name }}</h3>
          <p class="mt-1 min-h-[40px] text-sm text-ink-soft">{{ plan.description }}</p>

          <div class="mt-5 flex items-end gap-1">
            <span class="text-2xl font-semibold text-ink-faint">$</span>
            <span class="font-display text-5xl font-extrabold leading-none text-ink">{{ displayPrice(plan) }}</span>
            <span class="mb-1 text-sm text-ink-faint">/mo</span>
          </div>
          <p v-if="isYearly && plan.yearlyPrice" class="mt-1 text-xs text-ink-faint">billed annually</p>
          <p v-else class="mt-1 text-xs text-transparent">.</p>

          <ul class="mt-6 space-y-3 border-t border-line pt-5">
            <li v-for="feature in plan.features" :key="feature" class="flex items-start gap-2.5 text-sm text-ink-soft">
              <Icon icon="lucide:check" class="mt-0.5 h-4 w-4 shrink-0 text-teal" />
              <span>{{ feature }}</span>
            </li>
          </ul>

          <router-link to="/login" class="plan-cta" :class="plan.featured ? 'is-primary' : 'is-ghost'">
            {{ plan.cta }}
          </router-link>
        </div>
      </div>
    </section>

    <!-- Enterprise -->
    <section class="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
      <div class="grid items-center gap-8 rounded-2xl border border-line bg-surface p-10 shadow-m md:grid-cols-2" v-reveal>
        <div>
          <h2 class="font-display text-3xl font-extrabold text-ink">Enterprise</h2>
          <p class="mt-3 text-ink-soft">Custom solutions for organizations that need maximum control and dedicated support.</p>
          <ul class="mt-5 space-y-3">
            <li v-for="item in enterprise" :key="item" class="flex items-center gap-3 text-ink-soft">
              <Icon icon="lucide:check-circle-2" class="h-5 w-5 text-violet" /> {{ item }}
            </li>
          </ul>
          <router-link to="/contact" class="mt-7 inline-flex rounded-xl bg-ink px-7 py-3 font-semibold text-white transition-transform hover:-translate-y-0.5">
            Contact sales
          </router-link>
        </div>
        <div class="hidden justify-center gap-4 md:flex">
          <div class="ent-card"></div>
          <div class="ent-card ent-card--lift"></div>
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section class="mx-auto max-w-3xl px-4 pb-24 sm:px-6 lg:px-8">
      <div class="mb-10 text-center" v-reveal>
        <h2 class="font-display text-3xl font-extrabold text-ink">Frequently asked questions</h2>
        <p class="mt-3 text-ink-soft">Everything you need to know about plans and billing.</p>
      </div>
      <div class="space-y-3">
        <div
          v-for="(faq, i) in faqs"
          :key="i"
          class="faq"
          :class="{ open: activeFaq === i }"
          @click="toggleFaq(i)"
        >
          <div class="flex items-center justify-between gap-4">
            <h4 class="font-semibold text-ink">{{ faq.question }}</h4>
            <Icon icon="lucide:chevron-down" class="h-5 w-5 shrink-0 text-ink-faint transition-transform" :class="{ 'rotate-180': activeFaq === i }" />
          </div>
          <div v-show="activeFaq === i" class="mt-3 text-sm leading-relaxed text-ink-soft">{{ faq.answer }}</div>
        </div>
      </div>
    </section>
  </PublicLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import PublicLayout from '../components/public/PublicLayout.vue'
import HeroBackdrop from '../components/public/HeroBackdrop.vue'
import { useMeta } from '../composables/useMeta'
import api from '../services/api'

useMeta({
  title: 'Pricing — AADML',
  description: 'Simple, transparent pricing for AI agent automation. Start free, bring your own keys, upgrade as you scale.',
})

const billingCycle = ref('monthly')
const isYearly = computed(() => billingCycle.value === 'yearly')

const staticPlans = [
  {
    name: 'Starter', price: 0, yearlyPrice: 0,
    description: 'For individual developers exploring AI agents.',
    cta: 'Start free', featured: false,
    features: ['2 agents', '1 workspace', 'Built-in tools', 'Local LLM (Ollama)', 'Community support'],
  },
  {
    name: 'Professional', price: 49, yearlyPrice: 39,
    description: 'For teams ready to scale their automation.',
    cta: 'Start free trial', featured: true,
    features: ['20 agents', '10 workspaces', '50 schedules', '1,800+ tools', 'Signals & webhooks', 'MCP servers', 'Priority support'],
  },
  {
    name: 'Team', price: 199, yearlyPrice: 166,
    description: 'Advanced governance for growing organizations.',
    cta: 'Start free trial', featured: false,
    features: ['Unlimited agents', 'Unlimited workspaces', 'Everything in Pro', 'SSO integration', 'Audit log export', 'Dedicated support'],
  },
]

const plans = ref(staticPlans)

onMounted(async () => {
  try {
    const { data } = await api.get('/plans/')
    if (data.plans && data.plans.length > 0) {
      plans.value = data.plans.map((p, i) => ({
        name: p.name,
        price: Number(p.price_monthly_usd),
        yearlyPrice: p.price_yearly_usd ? Math.round(Number(p.price_yearly_usd) / 12) : 0,
        description: p.description || staticPlans[i]?.description || '',
        cta: p.tier === 'free' ? 'Start free' : 'Start free trial',
        featured: p.tier === 'pro',
        features: buildFeatureList(p),
      }))
    }
  } catch (e) {
    console.debug('Pricing: using static fallback', e.message)
  }
})

function buildFeatureList(plan) {
  const features = []
  features.push(plan.max_agents != null ? `${plan.max_agents} agents` : 'Unlimited agents')
  features.push(plan.max_workspaces != null ? `${plan.max_workspaces} workspaces` : 'Unlimited workspaces')
  if (plan.max_schedules != null && plan.max_schedules > 0) features.push(`${plan.max_schedules} schedules`)
  else if (plan.max_schedules == null) features.push('Unlimited schedules')
  features.push(plan.max_members != null ? `${plan.max_members} team members` : 'Unlimited members')
  if (plan.features?.signals) features.push('Signals & webhooks')
  if (plan.features?.dream) features.push('Dream pipeline')
  if (plan.features?.sso) features.push('SSO integration')
  return features
}

function displayPrice(plan) {
  return isYearly.value ? (plan.yearlyPrice ?? plan.price) : plan.price
}

const enterprise = ['On-premise deployment', 'Dedicated support & SLA', 'Custom integrations', 'SSO & advanced RBAC']

const faqs = ref([
  { question: 'Can I change plans later?', answer: 'Yes — upgrade or downgrade anytime. Changes take effect immediately and limits adjust to match.' },
  { question: 'What models do you support?', answer: 'Local models via Ollama, plus OpenRouter (100+ models), OpenAI, Anthropic, Google, and xAI. Bring your own keys.' },
  { question: 'Is there a free trial?', answer: 'Yes — paid plans include a 14-day free trial, no credit card required.' },
  { question: 'What happens if I exceed my limits?', answer: 'Free plans pause until the next cycle. Paid plans have soft limits — we notify you before anything stops.' },
  { question: 'Can I self-host?', answer: 'Absolutely. Deploy with Docker Compose on your own infrastructure with full audit trails and RBAC.' },
])

const activeFaq = ref(null)
const toggleFaq = (i) => { activeFaq.value = activeFaq.value === i ? null : i }
</script>

<style scoped>
.toggle {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 9px 18px; border-radius: 10px;
  font-size: .9rem; font-weight: 600; color: var(--vm-ink-soft);
  background: transparent; border: none; cursor: pointer;
  transition: background .2s, color .2s;
}
.toggle.active { background: var(--vm-primary-soft); color: var(--vm-primary); }
.save { padding: 2px 7px; border-radius: 6px; font-size: .65rem; color: var(--vm-green); background: rgba(16,185,129,.12); }

.plan {
  position: relative; display: flex; flex-direction: column;
  border-radius: 20px; border: 1px solid var(--vm-border);
  background: var(--vm-surface); padding: 30px 26px;
  box-shadow: var(--vm-shadow-s);
  transition: transform .22s var(--vm-ease), box-shadow .22s, border-color .22s;
}
.plan:hover { transform: translateY(-5px); box-shadow: var(--vm-shadow-m); border-color: rgba(37,99,235,.35); }
.plan.featured { border-color: var(--vm-primary); box-shadow: var(--vm-shadow-l); }
.badge {
  position: absolute; top: -13px; left: 50%; transform: translateX(-50%);
  padding: 5px 16px; border-radius: 999px;
  font-size: .7rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
  color: #fff; background: var(--vm-g-brand); box-shadow: var(--vm-glow-p);
}
.plan-cta {
  display: inline-flex; justify-content: center;
  margin-top: 26px; padding: 13px; border-radius: 12px;
  font-weight: 600; text-decoration: none; transition: transform .18s var(--vm-ease);
}
.plan-cta.is-primary { color: #fff; background: var(--vm-g-brand); box-shadow: var(--vm-glow-p); }
.plan-cta.is-ghost { color: var(--vm-ink); border: 1px solid var(--vm-border); }
.plan-cta:hover { transform: translateY(-2px); }

.ent-card {
  width: 170px; height: 230px; border-radius: 18px;
  border: 1px solid var(--vm-border);
  background: var(--vm-g-warm);
}
.ent-card--lift { transform: translateY(-22px); background: var(--vm-g-cool); opacity: .85; }

.faq {
  cursor: pointer; border-radius: 14px;
  border: 1px solid var(--vm-border); background: var(--vm-surface);
  padding: 18px 22px; transition: border-color .2s, background .2s;
}
.faq.open { border-color: var(--vm-primary); background: var(--vm-primary-soft); }
</style>
