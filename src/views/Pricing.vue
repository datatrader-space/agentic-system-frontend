<template>
  <PublicLayout>
    <!-- Header -->
    <section class="relative overflow-hidden">
      <HeroBackdrop />
      <div class="relative z-10 mx-auto max-w-7xl px-4 pb-6 pt-16 text-center sm:px-6 lg:px-8 lg:pt-24">
        <h1 v-reveal class="font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
          Pay only for what you use
        </h1>
        <p v-reveal class="mx-auto mt-4 max-w-xl text-lg text-ink-soft">
          No plans, no subscriptions. Top up your balance and use every part of AADML: agents, chat, Video Studio and
          model training. Every account starts with ${{ startingCredit }} of credit.
        </p>
      </div>
    </section>

    <!-- How it works -->
    <section class="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
      <div class="grid items-stretch gap-6 md:grid-cols-3">
        <div v-for="step in steps" :key="step.title" v-reveal class="plan" :class="{ featured: step.featured }">
          <span class="step-ic" aria-hidden="true"><Icon :icon="step.icon" class="h-5 w-5" /></span>
          <h3 class="mt-4 text-xl font-bold text-ink">{{ step.title }}</h3>
          <p class="mt-2 text-sm leading-relaxed text-ink-soft">{{ step.text }}</p>
        </div>
      </div>
      <div class="mt-8 text-center">
        <router-link to="/login" class="plan-cta is-primary inline-flex px-8">Start with ${{ startingCredit }} free</router-link>
      </div>
    </section>

    <!-- What it covers -->
    <section class="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
      <div class="rounded-2xl border border-line bg-surface p-8 shadow-s" v-reveal>
        <h2 class="font-display text-2xl font-extrabold text-ink">One balance for everything</h2>
        <ul class="mt-5 grid gap-3 sm:grid-cols-2">
          <li v-for="item in covers" :key="item" class="flex items-start gap-2.5 text-sm text-ink-soft">
            <Icon icon="lucide:check" class="mt-0.5 h-4 w-4 shrink-0 text-teal" />
            <span>{{ item }}</span>
          </li>
        </ul>
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
        <p class="mt-3 text-ink-soft">How your balance works.</p>
      </div>
      <div class="space-y-3">
        <button
          v-for="(faq, i) in faqs"
          :key="i"
          type="button"
          class="faq"
          :class="{ open: activeFaq === i }"
          :aria-expanded="activeFaq === i"
          @click="toggleFaq(i)"
        >
          <span class="flex items-center justify-between gap-4">
            <span class="font-semibold text-ink">{{ faq.question }}</span>
            <Icon icon="lucide:chevron-down" class="h-5 w-5 shrink-0 text-ink-faint transition-transform" :class="{ 'rotate-180': activeFaq === i }" />
          </span>
          <span v-show="activeFaq === i" class="mt-3 block text-sm leading-relaxed text-ink-soft">{{ faq.answer }}</span>
        </button>
      </div>
    </section>
  </PublicLayout>
</template>

<script setup>
import { ref } from 'vue'
import { Icon } from '@iconify/vue'
import PublicLayout from '../components/public/PublicLayout.vue'
import HeroBackdrop from '../components/public/HeroBackdrop.vue'
import { useMeta } from '../composables/useMeta'

useMeta({
  title: 'Pricing — AADML',
  description: 'Pay-as-you-go pricing for AI agents, Video Studio and model training. No plans or subscriptions: top up and pay only for what you use.',
})

const startingCredit = 1

const steps = [
  { icon: 'lucide:gift', title: 'Start free', text: 'Every new account gets $1 of credit to try agents, chat and tools once its email is verified. No card needed.' },
  { icon: 'lucide:credit-card', title: 'Top up from $5', featured: true,
    text: 'Add $5, $10, $25, $50 or any amount up to $500 with a card, on Stripe\'s secure page. No subscription.' },
  { icon: 'lucide:gauge', title: 'Pay per use',
    text: 'Each AI call, image, video, search, sandbox minute and training job is taken from your balance at its price. Your history shows every charge.' },
]

const covers = [
  'Agents and chat on the best AI models, with no API keys to manage',
  'Video Studio: images, video, voice and music',
  'Model training, evaluation and model merges',
  'Web search, browsing and sandboxes',
  'Schedules, webhooks and workflows that run on their own',
  'A notification when your balance runs low, so nothing stops by surprise',
]

const enterprise = ['On-premise deployment', 'Dedicated support & SLA', 'Custom integrations', 'SSO & advanced RBAC']

const faqs = ref([
  { question: 'Is there a subscription?', answer: 'No. There are no plans and nothing renews. You top up when you want, and your balance is used only when you use AADML.' },
  { question: 'What happens when my balance reaches $0?', answer: 'Anything that costs money (chats, agents, schedules, video and training jobs) pauses until you top up. Nothing is charged beyond your balance on purpose, and a stopped run can be resumed after the top-up.' },
  { question: 'Do I need my own AI provider keys?', answer: 'No. AADML runs on its own platform AI providers, and the usage is charged to your balance.' },
  { question: 'Does my balance expire?', answer: 'No. What you top up stays on your balance until you use it.' },
  { question: 'Where do I see what I paid for?', answer: 'Billing shows your balance, every top-up with its Stripe receipt, and every charge with what it was for.' },
])

const activeFaq = ref(null)
const toggleFaq = (i) => { activeFaq.value = activeFaq.value === i ? null : i }
</script>

<style scoped>
.plan {
  position: relative; display: flex; flex-direction: column;
  border-radius: 20px; border: 1px solid var(--vm-border);
  background: var(--vm-surface); padding: 30px 26px;
  box-shadow: var(--vm-shadow-s);
  transition: box-shadow .22s, border-color .22s;
}
.plan:hover { box-shadow: var(--vm-shadow-m); border-color: rgba(37,99,235,.35); }
.plan.featured { border-color: var(--vm-primary); box-shadow: var(--vm-shadow-l); }
.step-ic { display: inline-grid; place-items: center; width: 40px; height: 40px; border-radius: 10px;
  color: var(--vm-primary); background: var(--vm-primary-soft); }
.plan-cta {
  display: inline-flex; justify-content: center;
  padding: 13px; border-radius: 12px;
  font-weight: 600; text-decoration: none; transition: opacity .18s;
}
.plan-cta.is-primary { color: #fff; background: var(--vm-g-brand); box-shadow: var(--vm-glow-p); }
.plan-cta:hover { opacity: .92; }
.plan-cta:focus-visible, .faq:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; }

.ent-card {
  width: 170px; height: 230px; border-radius: 18px;
  border: 1px solid var(--vm-border);
  background: var(--vm-g-warm);
}
.ent-card--lift { transform: translateY(-22px); background: var(--vm-g-cool); opacity: .85; }

.faq {
  display: block; width: 100%; text-align: left;
  cursor: pointer; border-radius: 14px;
  border: 1px solid var(--vm-border); background: var(--vm-surface);
  padding: 18px 22px; transition: border-color .2s, background .2s;
}
.faq.open { border-color: var(--vm-primary); background: var(--vm-primary-soft); }
@media (prefers-reduced-motion: reduce) { .plan, .plan-cta, .faq { transition: none; } }
</style>
