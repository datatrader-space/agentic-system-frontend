<template>
  <div class="landing-page">
    <!-- Hero Section -->
    <section class="hero-section">
      <div class="hero-content">
        <div class="hero-text">
          <h1 class="hero-title">
            AI-Powered Code Generation
            <span class="gradient-text">Reimagined</span>
          </h1>
          <p class="hero-subtitle">
            Transform your development workflow with intelligent agents that understand your codebase,
            automate repetitive tasks, and accelerate delivery for developers, businesses, and enterprises.
          </p>
          
          <div class="cta-buttons">
            <router-link to="/login" class="btn btn-primary">
              Get Started Free
            </router-link>
            <router-link to="/how-it-works" class="btn btn-secondary">
              See How It Works
            </router-link>
          </div>
          
          <p class="trust-badge">
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            Trusted by developers, businesses, enterprises, and marketing agencies
          </p>
        </div>

        <div class="hero-visual">
          <!-- AI Terminal Animation -->
          <div class="terminal-window">
            <div class="ai-badge">
              <div class="ai-status"></div>
              <span>AI Agent Working...</span>
            </div>
            <div class="terminal-header">
              <div class="dots">
                <div class="dot red"></div>
                <div class="dot yellow"></div>
                <div class="dot green"></div>
              </div>
              <div class="terminal-title">agent.js — readonly</div>
            </div>
            <div class="terminal-body">
              <div 
                v-for="(line, index) in terminalLines" 
                :key="index" 
                class="code-line" 
                :class="{ visible: line.visible }"
              >
                <span class="line-num">{{ index + 1 }}</span>
                <span v-html="line.html"></span>
                <span v-if="index === terminalLines.length - 1 && isTyping" class="cursor"></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Overview (Bento Grid) -->
    <section class="features-section">
      <div class="container">
        <div class="section-header">
          <h2>Everything You Need to Build Faster</h2>
          <p>Powerful AI agents with deep code understanding and seamless workflow integration</p>
        </div>
        
        <div class="bento-grid">
          <div 
            v-for="(feature, index) in features" 
            :key="feature.title" 
            class="bento-card"
            :class="{ 
              'bento-large': index === 0, 
              'bento-tall': index === 2 || index === 5 
            }"
          >
            <div class="feature-icon" v-html="feature.icon"></div>
            <div>
              <h3>{{ feature.title }}</h3>
              <p>{{ feature.description }}</p>
            </div>
            <div class="card-visual"></div>
          </div>
        </div>

        <div class="cta-center">
          <router-link to="/features" class="btn btn-outline">
            Explore All Features →
          </router-link>
        </div>
      </div>
    </section>

    <!-- Use Cases (Tabs) -->
    <section class="use-cases-section">
      <div class="container">
        <div class="section-header">
          <h2>Built for Every Team</h2>
          <p>From solo developers to enterprise teams</p>
        </div>

        <div class="tabs">
          <button 
            v-for="tab in useCases" 
            :key="tab.badge"
            class="tab-btn"
            :class="{ active: activeTab === tab.badge }"
            @click="activeTab = tab.badge"
          >
            {{ tab.badge }}
          </button>
        </div>

        <div class="tab-content active">
          <div class="use-case-card">
            <div class="use-case-badge">{{ activeTabContent.badge }}</div>
            <h3>{{ activeTabContent.title }}</h3>
            <p>{{ activeTabContent.desc }}</p>
            <ul>
              <li v-for="item in activeTabContent.items" :key="item">
                <span class="check-icon">✓</span> {{ item }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <!-- Social Proof / Stats -->
    <section class="stats-section">
      <div class="container">
        <div class="stats-grid">
          <div class="stat">
            <div class="stat-number">10x</div>
            <div class="stat-label">Faster Development</div>
          </div>
          <div class="stat">
            <div class="stat-number">95%</div>
            <div class="stat-label">Code Quality Score</div>
          </div>
          <div class="stat">
            <div class="stat-number">50+</div>
            <div class="stat-label">Built-in Tools</div>
          </div>
          <div class="stat">
            <div class="stat-number">24/7</div>
            <div class="stat-label">AI Availability</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Final CTA -->
    <section class="final-cta-section">
      <div class="container">
        <div class="cta-box">
          <div class="cta-content">
            <h2>Ready to Transform Your Workflow?</h2>
            <p>Join developers and teams already building with AI agents</p>
            <router-link to="/login" class="btn btn-primary btn-large">
              Start Building Now
            </router-link>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

// --- Original Features Data ---
const features = ref([
  {
    title: 'Intelligent Code Analysis',
    description: 'Deep understanding of your codebase with relationship mapping and dependency tracking.',
    icon: '<svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>'
  },
  {
    title: 'Multi-Tool Integration',
    description: 'Access 50+ built-in tools plus custom integrations for complete automation.',
    icon: '<svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>'
  },
  {
    title: 'Real-Time Collaboration',
    description: 'Work alongside AI agents that understand context and maintain consistency.',
    icon: '<svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>'
  },
  {
    title: 'Automated Testing',
    description: 'Generate comprehensive test suites automatically with intelligent coverage.',
    icon: '<svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
  },
  {
    title: 'Custom LLM Support',
    description: 'Use your preferred AI models - from local Ollama to Claude and GPT.',
    icon: '<svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>'
  },
  {
    title: 'Enterprise Security',
    description: 'Built-in security controls, audit trails, and compliance-ready infrastructure.',
    icon: '<svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>'
  }
])

// --- Use Cases Data (Refactored from original HTML to Tabs) ---
const activeTab = ref('Developers')

const useCases = ref([
  {
    badge: 'Developers',
    title: 'Ship Features Faster',
    desc: 'Automate boilerplate, generate tests, and refactor code with AI assistance.',
    items: ['Intelligent code completion', 'Automated test generation', 'Smart refactoring suggestions']
  },
  {
    badge: 'Businesses',
    title: 'Scale Development',
    desc: 'Reduce development costs and accelerate time-to-market with AI-powered automation.',
    items: ['Faster feature delivery', 'Reduced technical debt', 'Consistent code quality']
  },
  {
    badge: 'Enterprises',
    title: 'Enterprise-Grade Control',
    desc: 'Deploy AI agents with security, compliance, and custom integrations.',
    items: ['On-premise deployment', 'Custom tool integration', 'Advanced security controls']
  },
  {
    badge: 'Agencies',
    title: 'Deliver More Projects',
    desc: 'Handle multiple client projects efficiently with intelligent automation.',
    items: ['Multi-project management', 'Rapid prototyping', 'Client-ready documentation']
  }
])

const activeTabContent = computed(() => {
  return useCases.value.find(c => c.badge === activeTab.value) || useCases.value[0]
})

// --- Terminal Animation Logic ---
const terminalLines = ref([
  { html: '', visible: false }
])
const isTyping = ref(true)

const codeSequence = [
  { html: '<span class="c-purple">const</span> <span class="c-blue">agent</span> = <span class="c-yellow">new</span> <span class="c-blue">AutoAgent</span>();', delay: 100 },
  { html: '<span class="c-gray">// Initializing neural context...</span>', delay: 800 },
  { html: '<span class="c-purple">await</span> agent.<span class="c-green">analyzeProject</span>(<span class="c-blue">"./src"</span>);', delay: 1600 },
  { html: '<span class="c-purple">const</span> <span class="c-blue">feature</span> = <span class="c-green">"user-authentication"</span>;', delay: 2400 },
  { html: '<span class="c-gray">// Generating secure endpoints...</span>', delay: 3200 },
  { html: '<span class="c-purple">const</span> <span class="c-blue">result</span> = <span class="c-purple">await</span> agent.<span class="c-green">generate</span>(feature);', delay: 4000 },
  { html: '<span class="c-green">console</span>.<span class="c-green">log</span>(<span class="c-blue">result</span>.status);', delay: 5000 },
  { html: '<span class="c-gray">// Output: "Success - 100% Coverage"</span>', delay: 5800 },
]

let currentTime = 0

onMounted(() => {
  // Run terminal sequence
  codeSequence.forEach((line, index) => {
    setTimeout(() => {
      terminalLines.value.push({ html: line.html, visible: true })
      // Auto scroll
      const body = document.querySelector('.terminal-body')
      if(body) body.scrollTop = body.scrollHeight
    }, currentTime + line.delay)
    currentTime += line.delay
  })

  // Reset loop
  setTimeout(() => {
    isTyping.value = false
    setTimeout(() => {
      terminalLines.value = [{ html: '', visible: false }]
      isTyping.value = true
      onMounted() // Restart
    }, 3000)
  }, currentTime + 2000)
})

</script>

<style scoped>
/* --- 1. CORE VARIABLES --- */
.landing-page {
  /* Most variables are now global in style.css */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  width: 100%;
  overflow-x: hidden;
  color: var(--text-primary);
  background: var(--bg-body);
  min-height: 100vh;
}

.container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

/* --- 2. HERO SECTION --- */
.hero-section {
  position: relative;
  padding: 80px 24px 100px;
  overflow: hidden;
  background: var(--gradient-surface);
}

/* Background Effects */
.hero-section::before {
  content: '';
  position: absolute;
  top: -200px;
  right: -200px;
  width: 800px;
  height: 800px;
  background: radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%);
  pointer-events: none;
}

.hero-section::after {
  content: '';
  position: absolute;
  bottom: -300px;
  left: -200px;
  width: 700px;
  height: 700px;
  background: radial-gradient(circle, rgba(236, 72, 153, 0.1) 0%, transparent 70%);
  pointer-events: none;
}

.hero-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5rem;
  align-items: center;
  position: relative;
  z-index: 1;
}

.hero-text {
  max-width: 600px;
}

.hero-title {
  font-size: clamp(2.5rem, 5vw, 4rem);
  font-weight: 800;
  line-height: 1.1;
  margin-bottom: 1.5rem;
  letter-spacing: -0.03em;
  color: var(--text-primary);
}

.gradient-text {
  display: block;
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subtitle {
  font-size: 1.125rem;
  line-height: 1.7;
  color: var(--text-secondary);
  margin-bottom: 2.5rem;
  max-width: 95%;
}

.cta-buttons {
  display: flex;
  gap: 1rem;
  margin-bottom: 2.5rem;
  flex-wrap: wrap;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.875rem 1.75rem;
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.9375rem;
  text-decoration: none;
  transition: all 0.25s ease;
  border: 1px solid transparent;
  cursor: pointer;
}

.btn-primary {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: white;
  box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(139, 92, 246, 0.5);
}

.btn-secondary {
  background: var(--glass-bg);
  border: 1px solid var(--border);
  color: var(--text-primary);
  backdrop-filter: blur(10px);
}

.btn-secondary:hover {
  background: var(--bg-surface);
  border-color: var(--border-strong);
}

.btn-large {
  padding: 1.125rem 2.25rem;
  font-size: 1rem;
}

.trust-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-muted);
  font-size: 0.875rem;
}
.trust-badge .icon {
  width: 1.25rem;
  height: 1.25rem;
  color: #10b981;
}

/* --- 3. TERMINAL ANIMATION --- */
.hero-visual {
  position: relative;
  perspective: 1000px;
}

.terminal-window {
  background: linear-gradient(180deg, #0d1117 0%, #161b22 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.05),
    0 25px 60px -15px rgba(0, 0, 0, 0.6),
    0 0 40px rgba(139, 92, 246, 0.1);
  font-family: var(--font-mono);
  overflow: hidden;
  position: relative;
  height: 380px;
  transform: rotateY(-2deg) rotateX(2deg);
  transition: transform 0.3s ease;
}

.terminal-window:hover {
  transform: rotateY(0) rotateX(0);
}

.ai-badge {
  position: absolute;
  top: -16px;
  right: 24px;
  background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
  border: 1px solid rgba(139, 92, 246, 0.3);
  padding: 0.5rem 1.25rem;
  border-radius: 50px;
  display: flex;
  align-items: center;
  gap: 0.625rem;
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.4),
    0 0 20px rgba(139, 92, 246, 0.15);
  z-index: 10;
  animation: float 4s ease-in-out infinite;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #e5e7eb;
}

.ai-status {
  width: 8px;
  height: 8px;
  background: #8b5cf6;
  border-radius: 50%;
  box-shadow: 0 0 12px #8b5cf6;
  animation: pulse-glow 2s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 12px #8b5cf6; }
  50% { box-shadow: 0 0 20px #8b5cf6, 0 0 30px rgba(139, 92, 246, 0.5); }
}

.terminal-header {
  background: rgba(22, 27, 34, 0.8);
  padding: 0.875rem 1.25rem;
  display: flex;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.dots {
  display: flex;
  gap: 8px;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.red { background: #ff5f56; }
.yellow { background: #ffbd2e; }
.green { background: #27c93f; }

.terminal-title {
  margin-left: 1rem;
  font-size: 0.8125rem;
  color: #6b7280;
  flex-grow: 1;
  text-align: center;
}

.terminal-body {
  padding: 1.5rem;
  font-size: 0.9rem;
  color: #e6edf3;
  overflow-y: auto;
  height: calc(100% - 40px);
}

.code-line {
  display: flex;
  margin-bottom: 0.25rem;
  opacity: 0;
  transform: translateX(-5px);
  transition: opacity 0.2s, transform 0.2s;
}
.code-line.visible { opacity: 1; transform: translateX(0); }
.line-num {
  color: #484f58;
  margin-right: 1.5rem;
  user-select: none;
  text-align: right;
  min-width: 20px;
}
.c-purple { color: #d2a8ff; }
.c-blue { color: #a5d6ff; }
.c-green { color: #7ee787; }
.c-yellow { color: #e3b341; }
.c-gray { color: #8b949e; }
.cursor {
  display: inline-block;
  width: 8px; height: 16px;
  background: var(--primary);
  animation: blink 1s step-end infinite;
  vertical-align: middle;
}
@keyframes blink { 50% { opacity: 0; } }
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

/* --- 4. FEATURES (BENTO GRID) --- */
.features-section {
  padding: 100px 24px;
  background: var(--bg-body);
}

.section-header {
  text-align: center;
  margin-bottom: 4rem;
}

.section-header h2 {
  font-size: clamp(2rem, 4vw, 2.75rem);
  font-weight: 700;
  margin-bottom: 1rem;
  color: var(--text-primary);
}

.section-header p {
  color: var(--text-muted);
  font-size: 1.125rem;
  max-width: 600px;
  margin: 0 auto;
}

.bento-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 260px);
  gap: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

.bento-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 2rem;
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  backdrop-filter: blur(10px);
}

.bento-card:hover {
  border-color: var(--primary-glow);
  transform: translateY(-4px);
  box-shadow: var(--shadow-xl);
}

.bento-large { grid-column: span 2; }
.bento-tall { grid-row: span 2; }

.feature-icon {
  color: var(--primary);
  margin-bottom: 1.25rem;
  width: 48px;
  height: 48px;
}

.bento-card h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.625rem;
  color: var(--text-primary);
}

.bento-card p {
  color: var(--text-muted);
  font-size: 0.9375rem;
  line-height: 1.6;
}

.card-visual {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 50%;
  height: 50%;
  background: radial-gradient(circle at bottom right, rgba(139, 92, 246, 0.08), transparent);
  pointer-events: none;
}

.cta-center {
  text-align: center;
  margin-top: 3.5rem;
}

.btn-outline {
  background: transparent;
  color: var(--primary);
  border: 2px solid var(--primary-glow);
  padding: 0.875rem 1.75rem;
}

.btn-outline:hover {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

/* --- 5. USE CASES (TABS) --- */
.use-cases-section {
  padding: 100px 24px;
  background: var(--bg-surface);
}

.tabs {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
  margin-bottom: 3rem;
  flex-wrap: wrap;
}

.tab-btn {
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-muted);
  padding: 0.75rem 1.5rem;
  border-radius: 50px;
  cursor: pointer;
  transition: all 0.25s ease;
  font-size: 0.9375rem;
  font-weight: 500;
}

.tab-btn.active,
.tab-btn:hover {
  background: var(--gradient-primary);
  color: white;
  border-color: transparent;
  box-shadow: 0 4px 20px rgba(139, 92, 246, 0.3);
}

.tab-content {
  max-width: 800px;
  margin: 0 auto;
  animation: fadeUp 0.4s ease-out;
}

.use-case-card {
  background: var(--bg-card);
  padding: 3rem;
  border-radius: 20px;
  border: 1px solid var(--border);
  text-align: center;
  backdrop-filter: blur(10px);
}

.use-case-badge {
  display: inline-block;
  padding: 0.375rem 1rem;
  background: var(--primary-light);
  color: var(--primary);
  border-radius: 50px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 1.25rem;
}

.use-case-card h3 {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: var(--text-primary);
}

.use-case-card p {
  color: var(--text-muted);
  margin-bottom: 2rem;
  font-size: 1.0625rem;
  line-height: 1.6;
}

.use-case-card ul {
  list-style: none;
  padding: 0;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 0.875rem;
}

.use-case-card li {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  color: var(--text-secondary);
  font-size: 0.9375rem;
}

.check-icon {
  color: var(--primary);
  font-weight: bold;
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* --- 6. STATS --- */
.stats-section {
  padding: 100px 24px;
  text-align: center;
  background: var(--bg-body);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 2.5rem;
  max-width: 1000px;
  margin: 0 auto;
}

.stat-number {
  font-size: clamp(2.5rem, 5vw, 3.5rem);
  font-weight: 800;
  margin-bottom: 0.5rem;
  background: var(--gradient-text);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stat-label {
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1.5px;
  font-size: 0.8125rem;
  font-weight: 500;
}

/* --- 7. FINAL CTA --- */
.final-cta-section {
  padding: 100px 24px;
  text-align: center;
  background: var(--bg-body);
}

.cta-box {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 28px;
  padding: 5rem 2.5rem;
  max-width: 1000px;
  margin: 0 auto;
  position: relative;
  overflow: hidden;
}

.cta-box::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at top left, rgba(236, 72, 153, 0.15), transparent 50%),
              radial-gradient(circle at bottom right, rgba(139, 92, 246, 0.15), transparent 50%);
  pointer-events: none;
}

.cta-content {
  position: relative;
  z-index: 2;
}

.cta-content h2 {
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 700;
  margin-bottom: 1.25rem;
  color: var(--text-primary);
}

.cta-content p {
  color: var(--text-secondary);
  font-size: 1.125rem;
  margin-bottom: 2.5rem;
}

/* --- RESPONSIVE --- */
@media (max-width: 1024px) {
  .hero-content {
    grid-template-columns: 1fr;
    text-align: center;
    gap: 3rem;
  }

  .hero-text {
    max-width: 100%;
  }

  .hero-subtitle {
    margin: 0 auto 2rem;
    max-width: 100%;
  }

  .cta-buttons {
    justify-content: center;
  }

  .trust-badge {
    justify-content: center;
  }

  .bento-grid {
    grid-template-columns: 1fr;
    grid-template-rows: auto;
  }

  .bento-large,
  .bento-tall {
    grid-column: auto;
    grid-row: auto;
  }
}

@media (max-width: 768px) {
  .hero-section {
    padding: 60px 16px 80px;
  }

  .terminal-window {
    height: 300px;
    transform: none;
  }

  .terminal-window:hover {
    transform: none;
  }

  .ai-badge {
    font-size: 0.75rem;
    padding: 0.375rem 0.875rem;
  }

  .cta-box {
    padding: 3.5rem 1.5rem;
    border-radius: 20px;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    font-size: 0.875rem;
  }
}

@media (max-width: 480px) {
  .cta-buttons {
    flex-direction: column;
  }

  .btn {
    width: 100%;
  }

  .tabs {
    gap: 0.5rem;
  }

  .tab-btn {
    padding: 0.625rem 1rem;
    font-size: 0.8125rem;
  }
}
</style>