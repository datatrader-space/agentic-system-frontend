<template>
  <div class="pricing-page">
    <!-- Header with subtle animated background -->
    <div class="page-header">
      <div class="header-glow"></div>
      <h1 class="gradient-text">Simple, Transparent Pricing</h1>
      <p>Unlock the full potential of AI development.</p>
      
      <!-- Visual Toggle (Standard Pro SaaS Element) -->
      <div class="billing-toggle">
        <button class="toggle-btn active">Monthly</button>
        <button class="toggle-btn">Yearly <span class="save-tag">Save 20%</span></button>
      </div>
    </div>

    <div class="pricing-container">
      <!-- Pricing Grid -->
      <div class="pricing-grid">
        <div class="pricing-card" v-for="plan in plans" :key="plan.name" :class="{ featured: plan.featured }">
          <div v-if="plan.featured" class="badge">Most Popular</div>
          
          <h3>{{ plan.name }}</h3>
          <p class="description">{{ plan.description }}</p>
          
          <div class="price-wrapper">
            <div class="price">
              <span class="currency">$</span>
              <span class="amount">{{ plan.price }}</span>
            </div>
            <span class="period">per {{ plan.period }}</span>
          </div>

          <ul class="features">
            <li v-for="feature in plan.features" :key="feature">
              <svg class="check" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
              {{ feature }}
            </li>
          </ul>
          
          <router-link to="/login" class="btn" :class="plan.featured ? 'btn-primary' : 'btn-secondary'">
            {{ plan.cta }}
          </router-link>
        </div>
      </div>

      <!-- Enterprise Section -->
      <div class="enterprise-section">
        <div class="enterprise-content">
          <div class="enterprise-text">
            <h2>Enterprise</h2>
            <p>Custom solutions for large organizations requiring maximum control.</p>
            <ul class="enterprise-list">
              <li>
                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                On-Premise Deployment
              </li>
              <li>
                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                Dedicated Support
              </li>
              <li>
                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                Custom Integrations
              </li>
            </ul>
            <router-link to="/contact" class="btn btn-enterprise">Contact Sales</router-link>
          </div>
          <!-- Decorative Visual for Enterprise -->
          <div class="enterprise-visual">
            <div class="visual-card"></div>
            <div class="visual-card"></div>
          </div>
        </div>
      </div>

      <!-- Interactive FAQ Accordion -->
      <div class="faq-section">
        <div class="section-title">
          <h2>Frequently Asked Questions</h2>
          <p>Everything you need to know about the product and billing.</p>
        </div>
        
        <div class="faq-list">
          <div 
            class="faq-item" 
            v-for="(faq, index) in faqs" 
            :key="index"
            :class="{ active: activeFaq === index }"
            @click="toggleFaq(index)"
          >
            <div class="faq-question">
              <h4>{{ faq.question }}</h4>
              <svg class="chevron" :class="{ rotate: activeFaq === index }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </div>
            <div class="faq-answer" ref="faqContent">
              <p>{{ faq.answer }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useMeta } from '../composables/useMeta'
import api from '../services/api'

useMeta({
  title: 'Pricing — AADML',
  description: 'Simple, transparent pricing for AI agent automation. Start free.',
})

const billingCycle = ref('monthly')
const isYearly = computed(() => billingCycle.value === 'yearly')

// Static fallback plans
const staticPlans = [
  {
    name: 'Starter', price: 0, yearlyPrice: 0, period: 'month',
    description: 'Perfect for individual developers exploring AI agents',
    cta: 'Start Free', featured: false,
    features: ['2 agents', '1 workspace', 'Access to built-in tools', 'Community support', 'Local LLM support (Ollama)']
  },
  {
    name: 'Professional', price: 49, yearlyPrice: 39, period: 'month',
    description: 'For teams ready to scale their development',
    cta: 'Start Free Trial', featured: true,
    features: ['20 agents', '10 workspaces', '50 schedules', '140+ tools', 'Signals & webhooks',
               'Dream pipeline', 'MCP servers', 'Priority support']
  },
  {
    name: 'Team', price: 199, yearlyPrice: 166, period: 'month',
    description: 'Advanced features for growing teams',
    cta: 'Start Free Trial', featured: false,
    features: ['Unlimited agents', 'Unlimited workspaces', 'Unlimited schedules',
               'Everything in Pro', 'SSO integration', 'Audit log export', 'Priority support']
  }
]

const plans = ref(staticPlans)

// Try to fetch from API
onMounted(async () => {
  try {
    const { data } = await api.get('/plans/')
    if (data.plans && data.plans.length > 0) {
      plans.value = data.plans.map((p, i) => ({
        name: p.name,
        price: Number(p.price_monthly_usd),
        yearlyPrice: p.price_yearly_usd ? Math.round(Number(p.price_yearly_usd) / 12) : 0,
        period: 'month',
        description: p.description || staticPlans[i]?.description || '',
        cta: p.tier === 'free' ? 'Start Free' : 'Start Free Trial',
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
  if (plan.max_agents !== null) features.push(`${plan.max_agents} agents`)
  else features.push('Unlimited agents')
  if (plan.max_workspaces !== null) features.push(`${plan.max_workspaces} workspaces`)
  else features.push('Unlimited workspaces')
  if (plan.max_schedules !== null && plan.max_schedules > 0) features.push(`${plan.max_schedules} schedules`)
  else if (plan.max_schedules === null) features.push('Unlimited schedules')
  if (plan.max_members !== null) features.push(`${plan.max_members} team members`)
  else features.push('Unlimited members')
  if (plan.features?.dream) features.push('Dream pipeline')
  if (plan.features?.signals) features.push('Signals & webhooks')
  if (plan.features?.sso) features.push('SSO integration')
  return features
}

const displayPrice = (plan) => {
  return isYearly.value ? (plan.yearlyPrice || plan.price) : plan.price
}

const faqs = ref([
  { question: 'Can I change plans later?', answer: 'Yes! You can upgrade or downgrade at any time. Changes take effect immediately.' },
  { question: 'What LLMs do you support?', answer: 'Local models via Ollama, and cloud providers including OpenRouter (100+ models), OpenAI, Anthropic, and xAI.' },
  { question: 'Is there a free trial?', answer: 'Yes, all paid plans come with a 14-day free trial. No credit card required.' },
  { question: 'What happens if I exceed limits?', answer: 'Free plan pauses until next cycle. Paid plans have soft limits — we\'ll notify you to upgrade.' },
  { question: 'Can I use my own LLM API keys?', answer: 'Absolutely! Bring your own keys for any supported provider.' },
])

const activeFaq = ref(null)

const toggleFaq = (index) => {
  activeFaq.value = activeFaq.value === index ? null : index
}

</script>

<style scoped>
/* --- 1. THEME VARIABLES --- */
/* --- 1. THEME VARIABLES --- */
.pricing-page {
  /* Most variables are now global */
  width: 100%;
  min-height: 100vh;
  background-color: var(--bg-body);
  color: var(--text-primary);
  overflow-x: hidden;
  position: relative;
}

.pricing-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem 8rem;
}

/* --- 2. HEADER & TOGGLE --- */
.page-header {
  text-align: center;
  padding: 8rem 1.5rem 5rem;
  position: relative;
}

.header-glow {
  position: absolute;
  top: -50%; left: 50%;
  transform: translateX(-50%);
  width: 1000px; height: 600px;
  background: radial-gradient(circle, var(--primary) 0%, transparent 60%);
  opacity: 0.2;
  z-index: 0;
  pointer-events: none;
}

.gradient-text {
  background: var(--gradient-text);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-size: 3.5rem;
  font-weight: 800;
  margin-bottom: 1rem;
  position: relative;
  z-index: 1;
}

.page-header > p {
  color: var(--text-muted);
  font-size: 1.25rem;
  margin-bottom: 3rem;
  position: relative;
  z-index: 1;
}

.billing-toggle {
  display: inline-flex;
  background: var(--bg-surface);
  padding: 4px;
  border-radius: 12px;
  border: 1px solid var(--border);
  position: relative;
  z-index: 1;
}

.toggle-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: 0.3s;
}

.toggle-btn.active {
  background: var(--bg-card);
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
}

.save-tag {
  background: rgba(16, 185, 129, 0.2);
  color: var(--success);
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 6px;
}

/* --- 3. PRICING CARDS (Glassmorphism) --- */
.pricing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-bottom: 8rem;
  align-items: start;
}

.pricing-card {
  background: var(--bg-glass);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  padding: 2.5rem 2rem;
  border-radius: 20px;
  position: relative;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
}

.pricing-card:hover {
  transform: translateY(-8px);
  border-color: var(--primary);
  box-shadow: var(--shadow-xl);
}

.pricing-card.featured {
  background: var(--bg-card-solid);
  border: 1px solid var(--primary);
  transform: scale(1.05);
  z-index: 2;
  box-shadow: var(--shadow-xl);
}

.pricing-card.featured:hover {
  transform: scale(1.05) translateY(-8px);
}

.badge {
  position: absolute;
  top: -14px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--gradient-primary);
  color: var(--text-primary);
  padding: 0.4rem 1.25rem;
  border-radius: 50px;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  box-shadow: 0 4px 12px var(--primary-glow);
}

.pricing-card h3 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
  text-align: center;
}

.description {
  text-align: center;
  color: var(--text-muted);
  font-size: 0.95rem;
  margin-bottom: 2rem;
  min-height: 40px;
}

.price-wrapper {
  text-align: center;
  margin-bottom: 2.5rem;
}

.price {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
}

.currency {
  font-size: 1.5rem;
  color: var(--text-muted);
  font-weight: 600;
}

.amount {
  font-size: 4rem;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1;
}

.period {
  display: block;
  color: var(--text-muted);
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

.features {
  list-style: none;
  padding: 0;
  margin-bottom: 2.5rem;
  flex-grow: 1;
  border-top: 1px solid var(--border-light);
  padding-top: 1.5rem;
}

.features li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0;
  color: var(--text-secondary);
  font-size: 0.95rem;
}

.check {
  width: 20px;
  height: 20px;
  color: var(--primary);
  flex-shrink: 0;
}

.btn {
  display: block;
  width: 100%;
  padding: 1rem;
  text-align: center;
  border-radius: 10px;
  font-weight: 600;
  text-decoration: none;
  transition: 0.3s;
  cursor: pointer;
}

.btn-primary {
  background: var(--primary);
  color: var(--text-primary);
  box-shadow: 0 4px 15px var(--primary-glow);
}

.btn-primary:hover {
  background: var(--primary);
  opacity: 0.9;
  transform: translateY(-2px);
}

.btn-secondary {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border);
}

.btn-secondary:hover {
  background: var(--bg-surface);
  border-color: var(--text-secondary);
}

/* --- 4. ENTERPRISE SECTION --- */
.enterprise-section {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 24px;
  padding: 4rem;
  margin-bottom: 8rem;
  overflow: hidden;
  position: relative;
}

/* Background decoration for enterprise */
.enterprise-section::after {
  content: '';
  position: absolute;
  right: -50px; top: -50px;
  width: 300px; height: 300px;
  background: var(--primary);
  filter: blur(150px);
  opacity: 0.2;
}

.enterprise-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: center;
  position: relative;
  z-index: 1;
}

.enterprise-text h2 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  color: var(--text-primary);
}

.enterprise-text > p {
  color: var(--text-muted);
  margin-bottom: 2rem;
  font-size: 1.1rem;
}

.enterprise-list {
  list-style: none;
  padding: 0;
  margin-bottom: 2.5rem;
}

.enterprise-list li {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  font-size: 1.1rem;
  color: var(--text-secondary);
}

.enterprise-list .icon {
  width: 24px; height: 24px;
  color: var(--primary);
}

.btn-enterprise {
  background: var(--text-primary);
  color: var(--text-inverse);
  width: fit-content;
  padding: 1rem 2.5rem;
  border-radius: 10px;
  font-weight: 700;
}

.btn-enterprise:hover {
  background: var(--bg-surface);
}

.enterprise-visual {
  display: flex;
  gap: 1rem;
  justify-content: center;
  position: relative;
}

.visual-card {
  width: 200px; height: 260px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  position: relative;
  overflow: hidden;
}
.visual-card:first-child {
  transform: translateY(20px);
  z-index: 2;
}
.visual-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, var(--primary-light), transparent);
}

/* --- 5. INTERACTIVE FAQ ACCORDION --- */
.faq-section {
  max-width: 800px;
  margin: 0 auto;
}

.section-title {
  text-align: center;
  margin-bottom: 4rem;
}

.section-title h2 { font-size: 2.5rem; margin-bottom: 1rem; }
.section-title p { color: var(--text-muted); }

.faq-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.faq-item {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
}

.faq-item.active {
  border-color: var(--primary);
  background: var(--primary-light);
}

.faq-question {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  font-weight: 600;
  font-size: 1.1rem;
  color: var(--text-primary);
}

.chevron {
  width: 20px; height: 20px;
  color: var(--text-muted);
  transition: transform 0.3s ease;
}

.chevron.rotate {
  transform: rotate(180deg);
  color: var(--primary);
}

.faq-answer {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease-out;
  padding: 0 2rem;
}

.faq-item.active .faq-answer {
  max-height: 200px; /* Arbitrary large height */
  padding-bottom: 1.5rem;
}

.faq-answer p {
  color: var(--text-muted);
  line-height: 1.7;
  font-size: 1rem;
}

/* --- 6. RESPONSIVE --- */
@media (max-width: 1024px) {
  .enterprise-content {
    grid-template-columns: 1fr;
    text-align: center;
  }
  .enterprise-list li {
    justify-content: center;
  }
  .btn-enterprise {
    margin: 0 auto;
  }
  .enterprise-visual {
    display: none;
  }
}

@media (max-width: 768px) {
  .gradient-text { font-size: 2.5rem; }
  .pricing-card.featured { transform: scale(1); }
  .pricing-card.featured:hover { transform: translateY(-8px); }
  
  .enterprise-section { padding: 2.5rem 1.5rem; }
  .enterprise-text h2 { font-size: 2rem; }
  
  .faq-question { padding: 1.25rem; font-size: 1rem; }
}
</style>