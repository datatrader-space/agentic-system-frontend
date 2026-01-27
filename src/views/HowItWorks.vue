<template>
  <div class="how-it-works-page">
    <div class="page-header">
      <h1>How It Works</h1>
      <p>Four simple steps to transform your development workflow</p>
    </div>

    <div class="steps-container">
      <div class="step" v-for="(step, index) in steps" :key="index">
        <div class="step-number">{{ index + 1 }}</div>
        <div class="step-content">
          <h2>{{ step.title }}</h2>
          <p>{{ step.description }}</p>
          <div class="step-visual">
            <div class="visual-placeholder" v-html="step.icon"></div>
          </div>
        </div>
        <div v-if="index < steps.length - 1" class="step-connector"></div>
      </div>
    </div>

    <div class="demo-section">
      <h2>See It In Action</h2>
      <p>Watch how AI agents transform development workflows</p>
      <div class="demo-video">
        <div class="video-placeholder">
          <svg class="play-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <p>Demo Video Coming Soon</p>
        </div>
      </div>
    </div>

    <div class="tech-stack-section">
      <h2>Powered By Cutting-Edge Technology</h2>
      <div class="tech-grid">
        <div class="tech-item">
          <h3>🤖 AI Models</h3>
          <p>Ollama, Claude, GPT, Custom LLMs</p>
        </div>
        <div class="tech-item">
          <h3>🔧 50+ Tools</h3>
          <p>File operations, shell commands, databases, APIs</p>
        </div>
        <div class="tech-item">
          <h3>🔒 Secure</h3>
          <p>Enterprise-grade security & compliance</p>
        </div>
        <div class="tech-item">
          <h3>☁️ Flexible</h3>
          <p>Cloud or on-premise deployment</p>
        </div>
      </div>
    </div>

    <div class="cta-section">
      <h2>Ready to Get Started?</h2>
      <p>Join teams already accelerating development with AI</p>
      <div class="cta-buttons">
        <router-link to="/login" class="btn btn-primary btn-large">
          Start Free Trial
        </router-link>
        <router-link to="/features" class="btn btn-secondary btn-large">
          Explore Features
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

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
.how-it-works-page {
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

.steps-container {
  max-width: 900px;
  margin: 4rem auto;
  padding: 0 2rem;
}

.step {
  position: relative;
  margin-bottom: 4rem;
}

.step-number {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: 700;
  margin: 0 auto 2rem;
  box-shadow: 0 8px 16px rgba(102, 126, 234, 0.3);
}

.step-content {
  background: white;
  padding: 3rem;
  border-radius: 1rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
}

.step-content h2 {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 1rem;
  text-align: center;
}

.step-content p {
  font-size: 1.125rem;
  color: #6b7280;
  line-height: 1.8;
  text-align: center;
  margin-bottom: 2rem;
}

.step-visual {
  display: flex;
  justify-content: center;
}

.visual-placeholder {
  color: #667eea;
  opacity: 0.8;
}

.step-connector {
  width: 4px;
  height: 60px;
  background: linear-gradient(to bottom, #667eea, #764ba2);
  margin: 0 auto;
  opacity: 0.3;
}

.demo-section {
  max-width: 1200px;
  margin: 6rem auto;
  padding: 0 2rem;
  text-align: center;
}

.demo-section h2 {
  font-size: 2.5rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 1rem;
}

.demo-section p {
  font-size: 1.25rem;
  color: #6b7280;
  margin-bottom: 3rem;
}

.demo-video {
  background: white;
  border-radius: 1rem;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.video-placeholder {
  aspect-ratio: 16 / 9;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  gap: 1.5rem;
}

.play-icon {
  width: 80px;
  height: 80px;
  opacity: 0.9;
}

.video-placeholder p {
  font-size: 1.5rem;
  font-weight: 600;
  opacity: 0.9;
}

.tech-stack-section {
  background: white;
  padding: 6rem 2rem;
  margin-top: 6rem;
}

.tech-stack-section h2 {
  text-align: center;
  font-size: 2.5rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 3rem;
}

.tech-grid {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
}

.tech-item {
  text-align: center;
  padding: 2rem;
  background: #f9fafb;
  border-radius: 1rem;
  transition: transform 0.3s ease;
}

.tech-item:hover {
  transform: translateY(-8px);
}

.tech-item h3 {
  font-size: 1.5rem;
  color: #1f2937;
  margin-bottom: 0.75rem;
}

.tech-item p {
  color: #6b7280;
  font-size: 1rem;
}

.cta-section {
  text-align: center;
  padding: 6rem 2rem;
  background: #1f2937;
  color: white;
}

.cta-section h2 {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
}

.cta-section p {
  font-size: 1.25rem;
  opacity: 0.9;
  margin-bottom: 2rem;
}

.cta-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
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
  background: #667eea;
  color: white;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
  background: #5a67d8;
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

@media (max-width: 768px) {
  .page-header h1 {
    font-size: 2rem;
  }
  
  .page-header p {
    font-size: 1.125rem;
  }
  
  .step-content {
    padding: 2rem;
  }
  
  .cta-buttons {
    flex-direction: column;
    align-items: center;
  }
}
</style>
