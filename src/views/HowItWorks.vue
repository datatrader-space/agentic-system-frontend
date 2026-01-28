<template>
  <div class="how-it-works-page">
    <!-- Header -->
    <div class="page-header">
      <div class="header-bg"></div>
      <h1 class="gradient-text">How It Works</h1>
      <p>Four simple steps to transform your development workflow.</p>
    </div>

    <!-- Interactive Timeline -->
    <div class="timeline-container">
      <div class="timeline-line"></div> <!-- The connecting line -->
      
      <div 
        class="step-card" 
        v-for="(step, index) in steps" 
        :key="index"
        :class="{ 'left': index % 2 === 0, 'right': index % 2 !== 0 }"
      >
        <div class="step-marker">
          <span>{{ index + 1 }}</span>
        </div>
        
        <div class="card-content">
          <div class="icon-box">
            <div v-html="step.icon" class="step-icon"></div>
          </div>
          <h2>{{ step.title }}</h2>
          <p>{{ step.description }}</p>
        </div>
      </div>
    </div>

    <!-- Live Simulation Section (The "Demo") -->
    <div class="simulation-section">
      <div class="container">
        <div class="split-layout">
          <div class="sim-text">
            <h2>Watch AI Agents in Action</h2>
            <p>See how the system analyzes context, generates code, and tests solutions in real-time.</p>
            <ul class="check-list">
              <li>Real-time execution logs</li>
              <li>Automatic dependency detection</li>
              <li>Self-correcting generation</li>
            </ul>
          </div>
          
          <!-- The "Terminal" Simulation -->
          <div class="terminal-simulator">
            <div class="term-header">
              <span class="term-dot red"></span>
              <span class="term-dot yellow"></span>
              <span class="term-dot green"></span>
              <span class="term-title">agent_execution.log</span>
            </div>
            <div class="term-body">
              <div class="log-line">
                <span class="timestamp">[10:42:01]</span>
                <span class="log-info">INFO</span>
                <span>Initializing neural context...</span>
              </div>
              <div class="log-line">
                <span class="timestamp">[10:42:02]</span>
                <span class="log-success">SUCCESS</span>
                <span>Codebase analyzed. 14 files indexed.</span>
              </div>
              <div class="log-line">
                <span class="timestamp">[10:42:05]</span>
                <span class="log-info">INFO</span>
                <span>Orchestrating tools: fs, shell, git...</span>
              </div>
              <div class="log-line typing">
                <span class="timestamp">[10:42:12]</span>
                <span class="log-process">PROCESSING</span>
                <span>Generating AuthController components_</span>
                <span class="cursor">|</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tech Stack Section -->
    <div class="tech-section">
      <div class="container">
        <h3 class="tech-title">Powered By Cutting-Edge Technology</h3>
        <div class="tech-grid">
          <div class="tech-pill">
            <span class="pill-icon">🤖</span>
            <div class="pill-text">
              <strong>LLMs</strong>
              <span>GPT, Claude, Custom</span>
            </div>
          </div>
          <div class="tech-pill">
            <span class="pill-icon">🔧</span>
            <div class="pill-text">
              <strong>Tools</strong>
              <span>50+ Integrations</span>
            </div>
          </div>
          <div class="tech-pill">
            <span class="pill-icon">🔒</span>
            <div class="pill-text">
              <strong>Security</strong>
              <span>Enterprise Grade</span>
            </div>
          </div>
          <div class="tech-pill">
            <span class="pill-icon">☁️</span>
            <div class="pill-text">
              <strong>Deploy</strong>
              <span>Cloud & On-Prem</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- CTA -->
    <div class="cta-section">
      <div class="container">
        <div class="cta-box">
          <h2>Ready to Accelerate Development?</h2>
          <p>Join thousands of teams using AI agents today.</p>
          <router-link to="/login" class="btn-primary">
            Start Free Trial
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

// Preserved Logic & Data
const steps = ref([
  {
    title: 'Connect Your Codebase',
    description: 'Point our AI agents to your repository. They analyze your code structure, dependencies, and relationships to build a deep understanding of your project.',
    icon: '<svg class="w-32 h-32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>'
  },
  {
    title: 'Define Your Tasks',
    description: 'Describe what you want to build using natural language. The AI understands context, requirements, and technical constraints automatically.',
    icon: '<svg class="w-32 h-32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>'
  },
  {
    title: 'AI Agents Work',
    description: 'Watch as agents orchestrate tools, generate code, run tests, and iterate based on results. Full transparency with real-time execution logs.',
    icon: '<svg class="w-32 h-32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>'
  },
  {
    title: 'Review & Deploy',
    description: 'Review generated code, approve changes, and deploy with confidence. Agents provide detailed explanations and documentation for all modifications.',
    icon: '<svg class="w-32 h-32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
  }
])
</script>

<style scoped>
/* --- 1. THEME VARIABLES --- */
/* --- 1. THEME VARIABLES --- */
.how-it-works-page {
  /* Most variables are now global */
  width: 100%;
  min-height: 100vh;
  background-color: var(--bg-body);
  color: var(--text-primary);
  overflow-x: hidden;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

/* --- 2. HEADER --- */
.page-header {
  text-align: center;
  padding: 6rem 1.5rem 5rem;
  position: relative;
}

.header-bg {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 800px; height: 400px;
  background: radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%);
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
  position: relative;
  z-index: 1;
}

/* --- 3. TIMELINE (HOW IT WORKS) --- */
.timeline-container {
  position: relative;
  max-width: 1000px;
  margin: 0 auto 8rem;
  padding: 0 2rem;
}

/* The central vertical line */
.timeline-line {
  position: absolute;
  left: 50%;
  top: 0; bottom: 0;
  width: 2px;
  background: linear-gradient(180deg, var(--primary) 0%, transparent 100%);
  opacity: 0.3;
  transform: translateX(-50%);
  z-index: 0;
}

.step-card {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 6rem;
  z-index: 1;
}

/* Alternating Layout */
.step-card.left { justify-content: flex-start; }
.step-card.right { justify-content: flex-end; }

/* The Circle Number */
.step-marker {
  position: absolute;
  width: 50px; height: 50px;
  border-radius: 50%;
  background: var(--bg-body);
  border: 2px solid var(--primary);
  color: var(--primary);
  font-weight: 800;
  font-size: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  box-shadow: 0 0 20px var(--primary-glow);
}

.step-card.left .step-marker { left: 50%; margin-left: -25px; }
.step-card.right .step-marker { right: 50%; margin-right: -25px; }

/* The Content Box */
.card-content {
  width: 45%;
  background: var(--bg-glass);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 2.5rem;
  position: relative;
  transition: all 0.4s ease;
}

.card-content:hover {
  transform: translateY(-5px);
  border-color: var(--primary);
  box-shadow: var(--shadow-xl);
}

.step-card.left .card-content { margin-left: 5%; } /* Offset for line */
.step-card.right .card-content { margin-right: 5%; }

/* Icons inside cards */
.icon-box {
  width: 64px; height: 64px;
  background: var(--primary-light);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
  color: var(--primary);
}

.step-icon { width: 32px; height: 32px; }

.card-content h2 {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: var(--text-primary);
}

.card-content p {
  color: var(--text-muted);
  line-height: 1.6;
  font-size: 1rem;
}

/* --- 4. SIMULATION SECTION (THE DEMO) --- */
.simulation-section {
  background: var(--gradient-surface);
  padding: 6rem 0;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

.split-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: center;
}

.sim-text h2 {
  font-size: 2.5rem;
  margin-bottom: 1.5rem;
  background: var(--gradient-text);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.sim-text p {
  color: var(--text-muted);
  font-size: 1.125rem;
  margin-bottom: 2rem;
  line-height: 1.6;
}

.check-list {
  list-style: none;
  padding: 0;
}

.check-list li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  font-size: 1.1rem;
  color: var(--text-secondary);
}

.check-list li::before {
  content: '✓';
  color: #10b981;
  font-weight: bold;
}

/* The Terminal UI */
.terminal-simulator {
  background: #0d1117; /* Keep terminal dark always */
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: var(--shadow-xl);
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.9rem;
}

.term-header {
  background: #161b22;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.term-dot { width: 10px; height: 10px; border-radius: 50%; }
.red { background: #ff5f56; } .yellow { background: #ffbd2e; } .green { background: #27c93f; }

.term-title {
  flex-grow: 1;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.8rem;
}

.term-body {
  padding: 1.5rem;
  background: radial-gradient(circle at top right, rgba(16, 185, 129, 0.05), transparent);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.log-line {
  display: flex;
  gap: 1rem;
  color: #d1d5db;
}

.timestamp { color: #6b7280; min-width: 80px; }
.log-info { color: #60a5fa; font-weight: bold; min-width: 80px; }
.log-success { color: #10b981; font-weight: bold; min-width: 80px; }
.log-process { color: #8b5cf6; font-weight: bold; min-width: 100px; }

/* Typing Animation */
.typing .cursor {
  display: inline-block;
  width: 8px; height: 16px;
  background: #8b5cf6;
  animation: blink 1s step-end infinite;
  vertical-align: middle;
}

@keyframes blink { 50% { opacity: 0; } }

/* --- 5. TECH STACK --- */
.tech-section {
  padding: 6rem 0;
}

.tech-title {
  text-align: center;
  font-size: 2rem;
  margin-bottom: 3rem;
  color: var(--text-primary);
}

.tech-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.tech-pill {
  background: var(--bg-glass);
  border: 1px solid var(--border);
  border-radius: 50px; /* Full rounded pill */
  padding: 1rem 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: 0.3s;
  cursor: default;
}

.tech-pill:hover {
  background: var(--primary-light);
  border-color: var(--primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.pill-icon { font-size: 1.5rem; }
.pill-text { display: flex; flex-direction: column; line-height: 1.2; }
.pill-text strong { color: var(--text-primary); font-size: 1rem; }
.pill-text span { color: var(--text-muted); font-size: 0.85rem; }

/* --- 6. CTA --- */
.cta-section {
  padding-bottom: 8rem;
}

.cta-box {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 24px;
  padding: 5rem 2rem;
  text-align: center;
  position: relative;
  overflow: hidden;
}

.cta-box::before {
  content: '';
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background: radial-gradient(circle at top left, rgba(139, 92, 246, 0.2), transparent);
}

.cta-box h2 {
  font-size: 2.5rem;
  color: var(--text-primary);
  margin-bottom: 1rem;
  position: relative;
  z-index: 2;
}

.cta-box p {
  color: var(--text-secondary);
  font-size: 1.25rem;
  margin-bottom: 2.5rem;
  position: relative;
  z-index: 2;
}

.btn-primary {
  background: var(--bg-surface);
  color: var(--primary);
  padding: 1rem 3rem;
  border-radius: 12px;
  font-weight: 700;
  text-decoration: none;
  display: inline-block;
  transition: 0.3s;
  position: relative;
  z-index: 2;
  box-shadow: var(--shadow-lg);
}

.btn-primary:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-xl);
  color: var(--primary-light);
}

/* --- 7. RESPONSIVE --- */
@media (max-width: 1024px) {
  .timeline-line { left: 40px; }
  
  .step-card {
    flex-direction: column;
    align-items: flex-start;
    padding-left: 90px; /* Space for the line */
  }
  
  .step-card.left, .step-card.right {
    justify-content: flex-start;
  }
  
  .step-marker { left: 15px !important; margin-left: 0 !important; }
  
  .card-content { width: 100%; margin: 0 !important; }
  
  .split-layout { grid-template-columns: 1fr; }
  .terminal-simulator { margin-top: 2rem; }
}

@media (max-width: 768px) {
  .gradient-text { font-size: 2.5rem; }
  .sim-text h2 { font-size: 2rem; }
  .cta-box { padding: 3rem 1.5rem; }
  .cta-box h2 { font-size: 2rem; }
}
</style>