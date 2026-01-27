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
          <div class="visual-placeholder">
            <!-- Placeholder for AI-generated hero image/video -->
            <div class="animated-gradient"></div>
            <div class="floating-elements">
              <div class="code-snippet">
                <span class="comment">// AI analyzes your code</span><br>
                <span class="keyword">agent</span>.<span class="method">generate</span>(<span class="string">"feature"</span>)
              </div>
              <div class="ai-indicator">
                <div class="pulse"></div>
                <span>AI Working</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Overview -->
    <section class="features-section">
      <div class="section-header">
        <h2>Everything You Need to Build Faster</h2>
        <p>Powerful AI agents with deep code understanding and seamless workflow integration</p>
      </div>
      
      <div class="features-grid">
        <div class="feature-card" v-for="feature in features" :key="feature.title">
          <div class="feature-icon" v-html="feature.icon"></div>
          <h3>{{ feature.title }}</h3>
          <p>{{ feature.description }}</p>
        </div>
      </div>

      <div class="cta-center">
        <router-link to="/features" class="btn btn-outline">
          Explore All Features →
        </router-link>
      </div>
    </section>

    <!-- Use Cases -->
    <section class="use-cases-section">
      <div class="section-header">
        <h2>Built for Every Team</h2>
        <p>From solo developers to enterprise teams</p>
      </div>

      <div class="use-cases-grid">
        <div class="use-case-card">
          <div class="use-case-badge">Developers</div>
          <h3>Ship Features Faster</h3>
          <p>Automate boilerplate, generate tests, and refactor code with AI assistance.</p>
          <ul>
            <li>Intelligent code completion</li>
            <li>Automated test generation</li>
            <li>Smart refactoring suggestions</li>
          </ul>
        </div>

        <div class="use-case-card">
          <div class="use-case-badge">Businesses</div>
          <h3>Scale Development</h3>
          <p>Reduce development costs and accelerate time-to-market with AI-powered automation.</p>
          <ul>
            <li>Faster feature delivery</li>
            <li>Reduced technical debt</li>
            <li>Consistent code quality</li>
          </ul>
        </div>

        <div class="use-case-card">
          <div class="use-case-badge">Enterprises</div>
          <h3>Enterprise-Grade Control</h3>
          <p>Deploy AI agents with security, compliance, and custom integrations.</p>
          <ul>
            <li>On-premise deployment</li>
            <li>Custom tool integration</li>
            <li>Advanced security controls</li>
          </ul>
        </div>

        <div class="use-case-card">
          <div class="use-case-badge">Agencies</div>
          <h3>Deliver More Projects</h3>
          <p>Handle multiple client projects efficiently with intelligent automation.</p>
          <ul>
            <li>Multi-project management</li>
            <li>Rapid prototyping</li>
            <li>Client-ready documentation</li>
          </ul>
        </div>
      </div>
    </section>

    <!-- Social Proof / Stats -->
    <section class="stats-section">
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
    </section>

    <!-- Final CTA -->
    <section class="final-cta-section">
      <h2>Ready to Transform Your Workflow?</h2>
      <p>Join developers and teams already building with AI agents</p>
      <router-link to="/login" class="btn btn-primary btn-large">
        Start Building Now
      </router-link>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue'

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
</script>

<style scoped>
.landing-page {
  width: 100%;
  overflow-x: hidden;
}

/* Hero Section */
.hero-section {
  min-height: 90vh;
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 4rem 2rem;
  position: relative;
  overflow: hidden;
}

.hero-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('data:image/svg+xml,<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" stroke-width="0.5" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>');
  opacity: 0.3;
}

.hero-content {
  max-width: 1400px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: center;
  position: relative;
  z-index: 1;
}

.hero-title {
  font-size: 3.5rem;
  font-weight: 800;
  line-height: 1.2;
  margin-bottom: 1.5rem;
  animation: fadeInUp 0.8s ease-out;
}

.gradient-text {
  background: linear-gradient(to right, #fbbf24, #f59e0b);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subtitle {
  font-size: 1.25rem;
  line-height: 1.8;
  margin-bottom: 2rem;
  opacity: 0.95;
  animation: fadeInUp 0.8s ease-out 0.2s backwards;
}

.cta-buttons {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  animation: fadeInUp 0.8s ease-out 0.4s backwards;
}

.btn {
  padding: 1rem 2rem;
  border-radius: 0.5rem;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.3s ease;
  display: inline-block;
}

.btn-primary {
  background: white;
  color: #667eea;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}

.btn-large {
  padding: 1.25rem 2.5rem;
  font-size: 1.125rem;
}

.btn-outline {
  background: transparent;
  color: #667eea;
  border: 2px solid #667eea;
}

.btn-outline:hover {
  background: #667eea;
  color: white;
}

.trust-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  opacity: 0.9;
  font-size: 0.875rem;
  animation: fadeInUp 0.8s ease-out 0.6s backwards;
}

.trust-badge .icon {
  width: 1.25rem;
  height: 1.25rem;
}

.hero-visual {
  position: relative;
  height: 500px;
}

.visual-placeholder {
  width: 100%;
  height: 100%;
  border-radius: 1rem;
  overflow: hidden;
  position: relative;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.animated-gradient {
  width: 100%;
  height: 100%;
  background: linear-gradient(45deg, #4f46e5, #7c3aed, #db2777, #f59e0b);
  background-size: 400% 400%;
  animation: gradientShift 15s ease infinite;
}

.floating-elements {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 2rem;
  padding: 2rem;
}

.code-snippet {
  background: rgba(0, 0, 0, 0.8);
  padding: 1.5rem;
  border-radius: 0.5rem;
  font-family: 'Courier New', monospace;
  font-size: 1rem;
  line-height: 1.6;
  animation: float 3s ease-in-out infinite;
}

.comment { color: #6b7280; }
.keyword { color: #a78bfa; }
.method { color: #34d399; }
.string { color: #fbbf24; }

.ai-indicator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: rgba(255, 255, 255, 0.95);
  padding: 0.75rem 1.5rem;
  border-radius: 2rem;
  font-weight: 600;
  color: #1f2937;
  animation: float 3s ease-in-out infinite 1.5s;
}

.pulse {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #10b981;
  animation: pulse 2s ease-in-out infinite;
}

/* Features Section */
.features-section, .use-cases-section {
  padding: 5rem 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.section-header {
  text-align: center;
  margin-bottom: 4rem;
}

.section-header h2 {
  font-size: 2.5rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 1rem;
}

.section-header p {
  font-size: 1.25rem;
  color: #6b7280;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 2rem;
  margin-bottom: 3rem;
}

.feature-card {
  background: white;
  padding: 2rem;
  border-radius: 1rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.feature-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 24px rgba(102, 126, 234, 0.2);
}

.feature-icon {
  color: #667eea;
  margin-bottom: 1rem;
}

.feature-card h3 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.75rem;
}

.feature-card p {
  color: #6b7280;
  line-height: 1.6;
}

.cta-center {
  text-align: center;
  margin-top: 3rem;
}

/* Use Cases */
.use-cases-section {
  background: #f9fafb;
}

.use-cases-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
}

.use-case-card {
  background: white;
  padding: 2rem;
  border-radius: 1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.use-case-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  background: #ede9fe;
  color: #7c3aed;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 1rem;
}

.use-case-card h3 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.75rem;
}

.use-case-card p {
  color: #6b7280;
  margin-bottom: 1.5rem;
  line-height: 1.6;
}

.use-case-card ul {
  list-style: none;
  padding: 0;
}

.use-case-card li {
  padding: 0.5rem 0;
  color: #4b5563;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.use-case-card li::before {
  content: '✓';
  color: #10b981;
  font-weight: 700;
}

/* Stats Section */
.stats-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 4rem 2rem;
}

.stats-grid {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 3rem;
  text-align: center;
}

.stat-number {
  font-size: 3.5rem;
  font-weight: 800;
  margin-bottom: 0.5rem;
}

.stat-label {
  font-size: 1.125rem;
  opacity: 0.9;
}

/* Final CTA */
.final-cta-section {
  padding: 6rem 2rem;
  text-align: center;
  background: #1f2937;
  color: white;
}

.final-cta-section h2 {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
}

.final-cta-section p {
  font-size: 1.25rem;
  opacity: 0.9;
  margin-bottom: 2rem;
}

/* Animations */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes gradientShift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-20px); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.1); }
}

/* Responsive */
@media (max-width: 768px) {
  .hero-content {
    grid-template-columns: 1fr;
    text-align: center;
  }
  
  .hero-title {
    font-size: 2.5rem;
  }
  
  .cta-buttons {
    flex-direction: column;
    align-items: center;
  }
  
  .hero-visual {
    height: 300px;
  }
  
  .section-header h2 {
    font-size: 2rem;
  }
}
</style>
