<template>
  <div class="features-page">
    <!-- Page Header -->
    <div class="page-header">
      <!-- Subtle glow effect in header -->
      <div class="header-glow"></div>
      <h1 class="gradient-text">Powerful AI Features</h1>
      <p class="header-subtitle">Everything you need to build, test, and deploy with confidence.</p>
    </div>

    <div class="features-container">
      <!-- Feature Loop -->
      <div class="feature-detail" v-for="(feature, index) in features" :key="index">
        <!-- Alternating Layout: Standard vs Reverse -->
        <div class="feature-content" :class="{ reverse: index % 2 === 1 }">
          
          <!-- Text Content -->
          <div class="feature-text">
            <div class="feature-badge">{{ feature.category }}</div>
            <h2>{{ feature.title }}</h2>
            <p class="feature-description">{{ feature.description }}</p>
            
            <ul class="feature-benefits">
              <li v-for="benefit in feature.benefits" :key="benefit">
                <svg class="check-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                {{ benefit }}
              </li>
            </ul>
          </div>

          <!-- Visual Content -->
          <div class="feature-demo">
            <!-- Simulating a UI Window/Card -->
            <div class="demo-card">
              <div class="demo-header">
                <div class="dots">
                  <div class="dot red"></div>
                  <div class="dot yellow"></div>
                  <div class="dot green"></div>
                </div>
                <div class="demo-title">{{ feature.demoLabel }}</div>
              </div>
              <div class="demo-body">
                <div class="icon-glow" v-html="feature.icon"></div>
              </div>
              <!-- Decorative background grid -->
              <div class="grid-bg"></div>
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- Bottom CTA -->
    <div class="cta-section">
      <div class="container">
        <div class="cta-box">
          <h2>Ready to Experience These Features?</h2>
          <p>Start building with intelligent agents today.</p>
          <router-link to="/login" class="btn btn-primary">
            Get Started Now
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useMeta } from '../composables/useMeta'

useMeta({
  title: 'Features — AADML',
  description: 'Explore the full capabilities of the AADML AI agent platform: 140+ tools, multi-LLM routing, signal system, MCP integration, knowledge cycles, and workspace teams.',
})

const features = ref([
  {
    category: 'Tooling',
    title: 'Multi-Tool Agents',
    description: '140+ built-in tools across 15+ categories. Agents autonomously choose the right tool for each step — from shell commands to media generation.',
    demoLabel: 'Tool Execution Pipeline',
    icon: '<svg class="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>',
    benefits: [
      'SSH, bash, and Python execution',
      'Browser automation and web search',
      'AWS, email, and cloud integrations',
      'Media generation (images, video)',
      'Custom REST API tool registration'
    ]
  },
  {
    category: 'Automation',
    title: 'Signal System & Schedules',
    description: 'Event-driven agent execution. Cron schedules, webhooks, Redis streams, and signal bridges fire agents with budget caps and auto-pause guardrails.',
    demoLabel: 'Signal Flow Dashboard',
    icon: '<svg class="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>',
    benefits: [
      'Cron-scheduled agent runs',
      'Webhook ingestion (Shopify, Stripe, GitHub)',
      'Signal chaining and aggregator patterns',
      'Budget caps and auto-pause on failures',
      'Cross-run KV store for state persistence'
    ]
  },
  {
    category: 'Intelligence',
    title: 'Multi-LLM Routing',
    description: 'Route each agent to the ideal model. OpenRouter (100+ models), OpenAI, Anthropic, xAI, Google, or 100% free local Ollama.',
    demoLabel: 'Provider Configuration',
    icon: '<svg class="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"></path></svg>',
    benefits: [
      '6 LLM providers supported',
      'Per-agent model and temperature overrides',
      'Cost tracking per request and per agent',
      'Auto model sync from provider APIs',
      'Latency monitoring and analytics'
    ]
  },
  {
    category: 'Extensibility',
    title: 'MCP Integration',
    description: 'Connect any Model Context Protocol server. Tools auto-discover from connected servers with circuit breakers and health monitoring.',
    demoLabel: 'MCP Server Manager',
    icon: '<svg class="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>',
    benefits: [
      'One-click MCP server connection',
      'Auto tool discovery and schema caching',
      'Circuit breaker with automatic recovery',
      'Per-agent MCP credentials with encryption',
      'Workspace-scoped MCP server isolation'
    ]
  },
  {
    category: 'Learning',
    title: 'Knowledge & Dream Pipeline',
    description: 'Agents learn from every interaction. Knowledge cards capture insights. The Dream pipeline consolidates learnings across sessions.',
    demoLabel: 'Knowledge Dashboard',
    icon: '<svg class="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>',
    benefits: [
      'MANAGE_KNOWLEDGE tool for agent self-memory',
      'Automatic knowledge extraction from conversations',
      'Dream consolidation cycles (merge, prune, rank)',
      'Cross-run memory via SCHEDULE_KV_STORE',
      'REPORT_RESULTS for structured output storage'
    ]
  },
  {
    category: 'Enterprise',
    title: 'Workspace Teams & Security',
    description: 'Multi-tenant organizations with workspaces, RBAC, encrypted credential vaults, complete audit trails, and login monitoring.',
    demoLabel: 'Security Dashboard',
    icon: '<svg class="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>',
    benefits: [
      'Multi-tenant orgs and workspaces',
      'Role-based access control (owner/admin/member/viewer)',
      'Encrypted credential vaults (never leaked to agents)',
      'Login attempt tracking and security monitoring',
      'Self-hosted Docker deployment with full audit trails'
    ]
  }
])
</script>

<style scoped>
/* --- 1. THEME VARIABLES --- */
/* --- 1. THEME VARIABLES --- */
.features-page {
  /* Most variables are now global */
  width: 100%;
  min-height: 100vh;
  background-color: var(--bg-body);
  color: var(--text-primary);
  overflow-x: hidden;
  position: relative;
}

.container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

/* --- 2. PAGE HEADER --- */
.page-header {
  text-align: center;
  padding: 8rem 2rem 6rem;
  position: relative;
}

.header-glow {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 600px; height: 400px;
  background: radial-gradient(circle, var(--primary) 0%, transparent 70%);
  opacity: 0.15;
  z-index: 0;
  pointer-events: none;
}

.gradient-text {
  background: var(--gradient-text);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-size: 3.5rem;
  font-weight: 800;
  margin-bottom: 1.5rem;
  position: relative;
  z-index: 1;
}

.header-subtitle {
  color: var(--text-muted);
  font-size: 1.25rem;
  max-width: 600px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
}

/* --- 3. FEATURE CONTAINER --- */
.features-container {
  max-width: 1280px;
  margin: 0 auto;
  padding-bottom: 6rem;
}

.feature-detail {
  margin-bottom: 6rem;
  padding: 0 2rem;
}

/* Alternating Grid Layout */
.feature-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5rem;
  align-items: center;
  max-width: 1280px;
  margin: 0 auto;
}

/* RTL Hack for Alternating Layout */
.feature-content.reverse {
  direction: rtl;
}

.feature-content.reverse > * {
  direction: ltr;
}

/* --- 4. TEXT STYLING --- */
.feature-text {
  position: relative;
  z-index: 2;
}

.feature-badge {
  display: inline-block;
  padding: 0.4rem 1rem;
  background: var(--primary-light);
  color: var(--primary);
  border: 1px solid var(--primary-glow);
  border-radius: 50px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 1.5rem;
  font-family: var(--font-mono, monospace);
}

.feature-text h2 {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 1.5rem;
  line-height: 1.2;
}

.feature-description {
  font-size: 1.125rem;
  color: var(--text-muted);
  line-height: 1.7;
  margin-bottom: 2rem;
}

.feature-benefits {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.feature-benefits li {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 1rem;
  color: var(--text-secondary);
}

.check-icon {
  width: 20px; height: 20px;
  color: #10b981; /* Green */
  flex-shrink: 0;
}

/* --- 5. VISUAL DEMO (The "Window") --- */
.feature-demo {
  position: relative;
  height: 100%;
  min-height: 420px;
}

.demo-card {
  width: 100%;
  height: 100%;
  background: #0d1117; /* Keep dark for code/terminal vibes */
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow-xl);
  overflow: hidden;
  position: relative;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.demo-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 30px 60px -12px rgba(139, 92, 246, 0.15);
  border-color: var(--primary);
}

/* Window Header */
.demo-header {
  background: #161b22;
  padding: 1rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
}

.dots { display: flex; gap: 6px; }
.dot { width: 10px; height: 10px; border-radius: 50%; }
.red { background: #ff5f56; } .yellow { background: #ffbd2e; } .green { background: #27c93f; }

.demo-title {
  margin-left: 1rem;
  font-size: 0.8rem;
  color: var(--text-muted);
  font-family: var(--font-mono, monospace);
}

/* Window Body */
.demo-body {
  height: calc(100% - 41px);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  background: radial-gradient(circle at center, rgba(139, 92, 246, 0.05), transparent 60%);
}

.icon-glow {
  width: 120px;
  height: 120px;
  color: var(--primary);
  filter: drop-shadow(0 0 20px var(--primary-glow));
  animation: float 6s ease-in-out infinite;
}

.grid-bg {
  position: absolute;
  inset: 0;
  background-image: 
    linear-gradient(var(--border) 1px, transparent 1px),
    linear-gradient(90deg, var(--border) 1px, transparent 1px);
  background-size: 40px 40px;
  opacity: 0.05;
  pointer-events: none;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

/* --- 6. CTA SECTION --- */
.cta-section {
  padding: 6rem 0;
  background: var(--bg-surface);
  border-top: 1px solid var(--border);
}

.cta-box {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 24px;
  padding: 5rem 2rem;
  text-align: center;
  position: relative;
  overflow: hidden;
  max-width: 1000px;
  margin: 0 auto;
}

.cta-box::before {
  content: '';
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background: radial-gradient(circle at top left, rgba(236, 72, 153, 0.15), transparent);
}

.cta-box h2 {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
  position: relative;
  z-index: 2;
}

.cta-box p {
  color: var(--text-secondary);
  font-size: 1.2rem;
  margin-bottom: 2.5rem;
  position: relative;
  z-index: 2;
}

/* --- 7. BUTTONS --- */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 1rem 2.5rem;
  border-radius: 8px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.3s ease;
  position: relative;
  z-index: 2;
}

.btn-primary {
  background: var(--primary);
  color: white;
  box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(139, 92, 246, 0.6);
}

/* --- 8. RESPONSIVE --- */
@media (max-width: 1024px) {
  .gradient-text { font-size: 2.5rem; }
  .feature-content { grid-template-columns: 1fr; gap: 3rem; }
  .feature-demo { order: -1; } /* Visual on top on mobile */
  .feature-demo { min-height: 300px; }
}

@media (max-width: 768px) {
  .gradient-text { font-size: 2rem; }
  .feature-detail { padding: 0 1.5rem; margin-bottom: 4rem; }
  .feature-text h2 { font-size: 1.75rem; }
  .page-header { padding-top: 6rem; }
  .cta-box h2 { font-size: 1.75rem; }
}
</style>