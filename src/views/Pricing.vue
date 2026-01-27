<template>
  <div class="pricing-page">
    <div class="page-header">
      <h1>Simple, Transparent Pricing</h1>
      <p>Choose the plan that's right for your team</p>
    </div>

    <div class="pricing-container">
      <div class="pricing-grid">
        <div class="pricing-card" v-for="plan in plans" :key="plan.name" :class="{ featured: plan.featured }">
          <div v-if="plan.featured" class="badge">Most Popular</div>
          <h3>{{ plan.name }}</h3>
          <div class="price">
            <span class="currency">$</span>
            <span class="amount">{{ plan.price }}</span>
            <span class="period">/{{ plan.period }}</span>
          </div>
          <p class="description">{{ plan.description }}</p>
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

      <div class="enterprise-section">
        <h2>Enterprise</h2>
        <p>Custom solutions for large organizations</p>
        <div class="enterprise-features">
          <div class="feature-item">
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
            </svg>
            <div>
              <h4>On-Premise Deployment</h4>
              <p>Full control with self-hosted infrastructure</p>
            </div>
          </div>
          <div class="feature-item">
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
            </svg>
            <div>
              <h4>Dedicated Support</h4>
              <p>24/7 priority support with SLA guarantees</p>
            </div>
          </div>
          <div class="feature-item">
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
            <div>
              <h4>Custom Integrations</h4>
              <p>Tailored tools and workflow integration</p>
            </div>
          </div>
        </div>
        <router-link to="/contact" class="btn btn-enterprise">Contact Sales</router-link>
      </div>

      <div class="faq-section">
        <h2>Frequently Asked Questions</h2>
        <div class="faq-grid">
          <div class="faq-item" v-for="faq in faqs" :key="faq.question">
            <h4>{{ faq.question }}</h4>
            <p>{{ faq.answer }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const plans = ref([
  {
    name: 'Starter',
    price: 0,
    period: 'month',
    description: 'Perfect for individual developers exploring AI agents',
    cta: 'Start Free',
    featured: false,
    features: [
      '1 active system',
      '10 AI agent sessions/month',
      'Access to 20+ built-in tools',
      'Community support',
      'Local LLM support (Ollama)'
    ]
  },
  {
    name: 'Professional',
    price: 49,
    period: 'month',
    description: 'For teams ready to scale their development',
    cta: 'Start Free Trial',
    featured: true,
    features: [
      'Unlimited systems',
      'Unlimited AI agent sessions',
      'Access to 50+ built-in tools',
      'Priority email support',
      'Cloud LLM integration (Claude, GPT)',
      'Custom tool development',
      'Advanced analytics',
      'GitHub integration'
    ]
  },
  {
    name: 'Team',
    price: 199,
    period: 'month',
    description: 'Advanced features for growing development teams',
    cta: 'Start Free Trial',
    featured: false,
    features: [
      'Everything in Professional',
      'Up to 10 team members',
      'Role-based access control',
      'Shared workspaces',
      'Team analytics dashboard',
      'SSO integration',
      'Priority chat support',
      'Training sessions'
    ]
  }
])

const faqs = ref([
  {
    question: 'Can I change plans later?',
    answer: 'Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately and we\'ll prorate your billing accordingly.'
  },
  {
    question: 'What LLMs do you support?',
    answer: 'We support local models via Ollama, and cloud providers including Claude (Anthropic), GPT (OpenAI), and custom API endpoints.'
  },
  {
    question: 'Is there a free trial?',
    answer: 'Yes, all paid plans come with a 14-day free trial. No credit card required to start.'
  },
  {
    question: 'What happens if I exceed my usage limits?',
    answer: 'For the Starter plan, sessions will be paused until the next billing cycle. Paid plans have no hard limits—we\'ll contact you to discuss upgrading if needed.'
  },
  {
    question: 'Do you offer refunds?',
    answer: 'Yes, we offer a 30-day money-back guarantee for all paid plans. If you\'re not satisfied, contact us for a full refund.'
  },
  {
    question: 'Can I use my own LLM API keys?',
    answer: 'Absolutely! You can bring your own API keys for Claude, GPT, or any compatible LLM provider.'
  }
])
</script>

<style scoped>
.pricing-page {
  min-height: 100vh;
  background: #f9fafb;
}

.page-header {
  text-align: center;
  padding: 6rem 2rem 4rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.page-header h1 {
  font-size: 3rem;
  font-weight: 800;
  margin-bottom: 1rem;
}

.page-header p {
  font-size: 1.5rem;
  opacity: 0.95;
}

.pricing-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 4rem 2rem;
}

.pricing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 2rem;
  margin-bottom: 6rem;
}

.pricing-card {
  background: white;
  padding: 3rem 2rem;
  border-radius: 1rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  position: relative;
  transition: all 0.3s ease;
}

.pricing-card.featured {
  border: 2px solid #667eea;
  transform: scale(1.05);
  box-shadow: 0 12px 24px rgba(102, 126, 234, 0.2);
}

.badge {
  position: absolute;
  top: -1rem;
  left: 50%;
  transform: translateX(-50%);
  background: #667eea;
  color: white;
  padding: 0.5rem 1.5rem;
  border-radius: 2rem;
  font-size: 0.875rem;
  font-weight: 600;
}

.pricing-card h3 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 1rem;
  text-align: center;
}

.price {
  text-align: center;
  margin-bottom: 1.5rem;
}

.currency {
  font-size: 1.5rem;
  color: #6b7280;
  vertical-align: top;
}

.amount {
  font-size: 3.5rem;
  font-weight: 800;
  color: #1f2937;
}

.period {
  font-size: 1rem;
  color: #6b7280;
}

.description {
  text-align: center;
  color: #6b7280;
  margin-bottom: 2rem;
  line-height: 1.6;
}

.features {
  list-style: none;
  padding: 0;
  margin-bottom: 2rem;
}

.features li {
  display: flex;
  align-items: start;
  gap: 0.75rem;
  padding: 0.75rem 0;
  color: #4b5563;
}

.check {
  width: 20px;
  height: 20px;
  color: #10b981;
  flex-shrink: 0;
  margin-top: 2px;
}

.btn {
  display: block;
  width: 100%;
  padding: 1rem;
  text-align: center;
  border-radius: 0.5rem;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s ease;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover {
  background: #5a67d8;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.btn-secondary {
  background: white;
  color: #667eea;
  border: 2px solid #667eea;
}

.btn-secondary:hover {
  background: #667eea;
  color: white;
}

.enterprise-section {
  background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
  color: white;
  padding: 4rem 3rem;
  border-radius: 1rem;
  text-align: center;
  margin-bottom: 6rem;
}

.enterprise-section h2 {
  font-size: 2.5rem;
  font-weight: 800;
  margin-bottom: 1rem;
}

.enterprise-section > p {
  font-size: 1.25rem;
  opacity: 0.9;
  margin-bottom: 3rem;
}

.enterprise-features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
  margin-bottom: 3rem;
  text-align: left;
}

.feature-item {
  display: flex;
  gap: 1.5rem;
}

.feature-item .icon {
  width: 48px;
  height: 48px;
  color: #667eea;
  flex-shrink: 0;
}

.feature-item h4 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.feature-item p {
  opacity: 0.8;
  font-size: 0.875rem;
}

.btn-enterprise {
  display: inline-block;
  padding: 1.25rem 2.5rem;
  background: white;
  color: #1f2937;
  font-size: 1.125rem;
}

.btn-enterprise:hover {
  background: #f3f4f6;
}

.faq-section {
  max-width: 900px;
  margin: 0 auto;
}

.faq-section h2 {
  font-size: 2.5rem;
  font-weight: 700;
  color: #1f2937;
  text-align: center;
  margin-bottom: 3rem;
}

.faq-grid {
  display: grid;
  gap: 2rem;
}

.faq-item {
  background: white;
  padding: 2rem;
  border-radius: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.faq-item h4 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 1rem;
}

.faq-item p {
  color: #6b7280;
  line-height: 1.6;
}

@media (max-width: 768px) {
  .page-header h1 {
    font-size: 2rem;
  }
  
  .pricing-card.featured {
    transform: scale(1);
  }
  
  .enterprise-features {
    grid-template-columns: 1fr;
  }
}
</style>
