<template>
  <div class="features-page">
    <div class="page-header">
      <h1>Powerful AI Features</h1>
      <p>Everything you need to build, test, and deploy with confidence</p>
    </div>

    <div class="features-container">
      <div class="feature-detail" v-for="(feature, index) in features" :key="index">
        <div class="feature-content" :class="{ reverse: index % 2 === 1 }">
          <div class="feature-text">
            <div class="feature-badge">{{ feature.category }}</div>
            <h2>{{ feature.title }}</h2>
            <p class="feature-description">{{ feature.description }}</p>
            <ul class="feature-benefits">
              <li v-for="benefit in feature.benefits" :key="benefit">{{ benefit }}</li>
            </ul>
          </div>
          <div class="feature-demo">
            <div class="demo-placeholder">
              <!-- Placeholder for AI-generated demo video/image -->
              <div class="demo-icon" v-html="feature.icon"></div>
              <p class="demo-label">{{ feature.demoLabel }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="cta-section">
      <h2>Ready to Experience These Features?</h2>
      <router-link to="/login" class="btn btn-primary btn-large">
        Get Started Now
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const features = ref([
  {
    category: 'Code Intelligence',
    title: 'Deep Code Understanding',
    description: 'Our AI agents analyze your entire codebase to understand structure, relationships, and dependencies.',
    demoLabel: 'Code Relationship Mapping',
    icon: '<svg class="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>',
    benefits: [
      'Automatic dependency detection',
      'Cross-file relationship mapping',
      'Impact analysis for changes',
      'Smart code navigation'
    ]
  },
  {
    category: 'Automation',
    title: 'Multi-Tool Orchestration',
    description: 'Access 50+ built-in tools and create custom integrations for complete workflow automation.',
    demoLabel: 'Tool Execution Pipeline',
    icon: '<svg class="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>',
    benefits: [
      'File system operations',
      'Shell command execution',
      'Database interactions',
      'API integration tools',
      'Custom tool development'
    ]
  },
  {
    category: 'Testing',
    title: 'Intelligent Test Generation',
    description: 'Automatically generate comprehensive test suites with smart coverage analysis.',
    demoLabel: 'Auto-Generated Test Suite',
    icon: '<svg class="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
    benefits: [
      'Unit test generation',
      'Integration test creation',
      'Edge case detection',
      'Coverage optimization',
      'Test maintenance automation'
    ]
  },
  {
    category: 'Collaboration',
    title: 'Real-Time Agent Assistance',
    description: 'Work alongside AI agents that understand your goals and provide contextual help.',
    demoLabel: 'Interactive Collaboration',
    icon: '<svg class="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"></path></svg>',
    benefits: [
      'Natural language queries',
      'Context-aware suggestions',
      'Continuous learning',
      'Session persistence',
      'Multi-agent workflows'
    ]
  },
  {
    category: 'Flexibility',
    title: 'Custom LLM Integration',
    description: 'Choose from local open-source models or cloud providers based on your needs.',
    demoLabel: 'Multi-Provider Support',
    icon: '<svg class="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>',
    benefits: [
      'Ollama local models',
      'Claude integration',
      'GPT support',
      'Custom model endpoints',
      'Cost optimization'
    ]
  },
  {
    category: 'Enterprise',
    title: 'Security & Compliance',
    description: 'Enterprise-grade security controls with full audit trails and access management.',
    demoLabel: 'Security Dashboard',
    icon: '<svg class="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>',
    benefits: [
      'Role-based access control',
      'Complete audit logging',
      'Data encryption',
      'Compliance reporting',
      'On-premise deployment options'
    ]
  }
])
</script>

<style scoped>
.features-page {
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

.features-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 4rem 2rem;
}

.feature-detail {
  margin-bottom: 6rem;
}

.feature-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: center;
  background: white;
  padding: 3rem;
  border-radius: 1rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
}

.feature-content.reverse {
  direction: rtl;
}

.feature-content.reverse > * {
  direction: ltr;
}

.feature-badge {
  display: inline-block;
  padding: 0.5rem 1rem;
  background: #ede9fe;
  color: #7c3aed;
  border-radius: 2rem;
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 1rem;
}

.feature-text h2 {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 1rem;
}

.feature-description {
  font-size: 1.125rem;
  color: #6b7280;
  line-height: 1.8;
  margin-bottom: 2rem;
}

.feature-benefits {
  list-style: none;
  padding: 0;
}

.feature-benefits li {
  padding: 0.75rem 0;
  color: #4b5563;
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.feature-benefits li::before {
  content: '✓';
  color: #10b981;
  font-weight: 700;
  font-size: 1.25rem;
}

.feature-demo {
  height: 400px;
}

.demo-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  gap: 1.5rem;
  padding: 2rem;
}

.demo-icon {
  opacity: 0.9;
}

.demo-label {
  font-size: 1.25rem;
  font-weight: 600;
  opacity: 0.9;
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
  margin-bottom: 2rem;
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
  
  .feature-content {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
  
  .feature-demo {
    height: 300px;
  }
}
</style>
