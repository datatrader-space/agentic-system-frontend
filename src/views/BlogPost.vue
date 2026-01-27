<template>
  <div class="blog-post-page">
    <article class="post-container">
      <header class="post-header">
        <div class="post-category">{{ post.category }}</div>
        <h1>{{ post.title }}</h1>
        <div class="post-meta">
          <span class="author">By {{ post.author }}</span>
          <span class="separator">•</span>
          <span class="date">{{ post.date }}</span>
          <span class="separator">•</span>
          <span class="read-time">{{ post.readTime }} min read</span>
        </div>
      </header>

      <div class="post-image">
        <div class="image-placeholder" :style="{ background: post.color }"></div>
      </div>

      <div class="post-content">
        <div v-html="post.content"></div>
      </div>

      <footer class="post-footer">
        <div class="tags">
          <span class="tag" v-for="tag in post.tags" :key="tag">#{{ tag }}</span>
        </div>
        <div class="share-buttons">
          <h4>Share this post</h4>
          <div class="social-buttons">
            <button class="social-btn twitter">Twitter</button>
            <button class="social-btn linkedin">LinkedIn</button>
            <button class="social-btn facebook">Facebook</button>
          </div>
        </div>
      </footer>
    </article>

    <aside class="related-posts">
      <h3>Related Posts</h3>
      <div class="related-grid">
        <router-link 
          v-for="related in relatedPosts" 
          :key="related.id"
          :to="`/blog/${related.slug}`"
          class="related-card"
        >
          <div class="related-image" :style="{ background: related.color }"></div>
          <div class="related-content">
            <h4>{{ related.title }}</h4>
            <p class="related-date">{{ related.date }}</p>
          </div>
        </router-link>
      </div>
    </aside>

    <div class="cta-section">
      <h2>Ready to Transform Your Development Workflow?</h2>
      <p>Start using AI agents to accelerate your projects today</p>
      <router-link to="/login" class="btn btn-primary btn-large">
        Get Started Free
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

// In a real app, this would fetch from an API based on route.params.slug
const post = ref({
  id: 1,
  slug: 'ai-powered-development-2026',
  title: 'The Future of AI-Powered Development in 2026',
  author: 'Sarah Chen',
  date: 'January 20, 2026',
  readTime: 5,
  category: 'AI Trends',
  color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  tags: ['AI', 'Development', 'Automation', 'Productivity'],
  content: `
    <p class="lead">The landscape of software development is undergoing a dramatic transformation. AI-powered agents are no longer science fiction—they're actively reshaping how we write, test, and deploy code.</p>

    <h2>The Rise of Intelligent Agents</h2>
    <p>Gone are the days when developers had to manually scaffold projects, write boilerplate code, and spend hours debugging. AI agents can now understand context, analyze codebases, and make intelligent suggestions that save countless hours.</p>

    <p>What makes 2026 particularly exciting is the convergence of several key technologies:</p>
    <ul>
      <li><strong>Advanced language models</strong> that truly understand code semantics</li>
      <li><strong>Tool orchestration</strong> enabling agents to use dozens of development tools seamlessly</li>
      <li><strong>Context retention</strong> allowing agents to maintain state across long coding sessions</li>
      <li><strong>Multi-modal capabilities</strong> processing code, documentation, and visual designs together</li>
    </ul>

    <h2>Real-World Impact</h2>
    <p>We're seeing teams report productivity gains of 10x or more in specific tasks. A developer who used to spend 2 hours writing unit tests can now have comprehensive test suites generated in minutes. Code reviews that took days now happen in hours, with AI agents catching potential issues before human reviewers even look.</p>

    <blockquote>
      "AI agents haven't replaced developers—they've made us exponentially more effective. We're spending less time on repetitive tasks and more time on creative problem-solving."
      <cite>— Michael Torres, Senior Engineer at TechCorp</cite>
    </blockquote>

    <h2>The Enterprise Perspective</h2>
    <p>Enterprises are particularly excited about the scalability benefits. Training new developers is faster when they have an AI pair programmer guiding them. Legacy code modernization projects that would take years can now be completed in months.</p>

    <p>Security teams love the audit trails and compliance features. Every AI-generated change is logged, reviewed, and validated before deployment. This level of transparency was impossible with traditional development workflows.</p>

    <h2>What's Next?</h2>
    <p>Looking ahead to the rest of 2026, we expect to see:</p>
    <ul>
      <li>AI agents handling entire microservices end-to-end</li>
      <li>Automatic performance optimization at scale</li>
      <li>Predictive debugging that catches issues before they occur</li>
      <li>Natural language interfaces for complex DevOps tasks</li>
    </ul>

    <p>The future of development isn't about replacing humans—it's about augmenting our capabilities and letting us focus on what we do best: creative problem-solving and innovation.</p>

    <p>If you haven't started exploring AI-powered development tools yet, 2026 is the year to begin. The gap between early adopters and laggards is widening rapidly.</p>
  `
})

const relatedPosts = ref([
  {
    id: 2,
    slug: '10-ways-ai-agents-boost-productivity',
    title: '10 Ways AI Agents Boost Developer Productivity',
    date: 'Jan 15, 2026',
    color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
  },
  {
    id: 3,
    slug: 'getting-started-with-agentic-systems',
    title: 'Getting Started with Agentic Systems',
    date: 'Jan 10, 2026',
    color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
  },
  {
    id: 4,
    slug: 'enterprise-ai-adoption',
    title: 'Enterprise AI Adoption: Lessons Learned',
    date: 'Jan 5, 2026',
    color: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
  }
])
</script>

<style scoped>
.blog-post-page {
  min-height: 100vh;
  background: #f9fafb;
  padding: 4rem 2rem;
}

.post-container {
  max-width: 800px;
  margin: 0 auto 4rem;
  background: white;
  border-radius: 1rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.post-header {
  padding: 3rem 3rem 2rem;
}

.post-category {
  display: inline-block;
  background: #ede9fe;
  color: #7c3aed;
  padding: 0.5rem 1rem;
  border-radius: 2rem;
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 1.5rem;
}

.post-header h1 {
  font-size: 2.5rem;
  font-weight: 800;
  color: #1f2937;
  line-height: 1.2;
  margin-bottom: 1.5rem;
}

.post-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #6b7280;
  font-size: 0.875rem;
}

.separator {
  color: #d1d5db;
}

.post-image {
  height: 400px;
  overflow: hidden;
}

.image-placeholder {
  width: 100%;
  height: 100%;
}

.post-content {
  padding: 3rem;
  color: #374151;
  line-height: 1.8;
  font-size: 1.125rem;
}

.post-content :deep(.lead) {
  font-size: 1.25rem;
  color: #4b5563;
  font-weight: 500;
  margin-bottom: 2rem;
}

.post-content :deep(h2) {
  font-size: 1.875rem;
  font-weight: 700;
  color: #1f2937;
  margin: 2.5rem 0 1.5rem;
}

.post-content :deep(p) {
  margin-bottom: 1.5rem;
}

.post-content :deep(ul) {
  margin: 1.5rem 0;
  padding-left: 2rem;
}

.post-content :deep(li) {
  margin-bottom: 0.75rem;
}

.post-content :deep(blockquote) {
  border-left: 4px solid #667eea;
  padding-left: 1.5rem;
  margin: 2rem 0;
  font-style: italic;
  color: #4b5563;
  background: #f9fafb;
  padding: 1.5rem 1.5rem 1.5rem 2rem;
  border-radius: 0.5rem;
}

.post-content :deep(cite) {
  display: block;
  margin-top: 1rem;
  font-style: normal;
  font-weight: 600;
  color: #667eea;
  font-size: 0.875rem;
}

.post-footer {
  padding: 2rem 3rem 3rem;
  border-top: 1px solid #e5e7eb;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 2rem;
}

.tag {
  background: #f3f4f6;
  color: #4b5563;
  padding: 0.5rem 1rem;
  border-radius: 2rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.share-buttons h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 1rem;
}

.social-buttons {
  display: flex;
  gap: 1rem;
}

.social-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.social-btn.twitter {
  background: #1da1f2;
  color: white;
}

.social-btn.linkedin {
  background: #0077b5;
  color: white;
}

.social-btn.facebook {
  background: #1877f2;
  color: white;
}

.social-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.related-posts {
  max-width: 1200px;
  margin: 0 auto 4rem;
}

.related-posts h3 {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 2rem;
  text-align: center;
}

.related-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.related-card {
  background: white;
  border-radius: 1rem;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  text-decoration: none;
  display: block;
}

.related-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 24px rgba(102, 126, 234, 0.2);
}

.related-image {
  height: 150px;
}

.related-content {
  padding: 1.5rem;
}

.related-content h4 {
  font-size: 1.125rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 0.5rem;
  line-height: 1.4;
}

.related-date {
  color: #6b7280;
  font-size: 0.875rem;
}

.cta-section {
  max-width: 800px;
  margin: 0 auto;
  text-align: center;
  padding: 4rem 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 1rem;
  color: white;
}

.cta-section h2 {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 1rem;
}

.cta-section p {
  font-size: 1.125rem;
  opacity: 0.95;
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
  background: white;
  color: #667eea;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
}

.btn-large {
  padding: 1.25rem 2.5rem;
  font-size: 1.125rem;
}

@media (max-width: 768px) {
  .post-header,
  .post-content,
  .post-footer {
    padding-left: 1.5rem;
    padding-right: 1.5rem;
  }
  
  .post-header h1 {
    font-size: 2rem;
  }
  
  .post-image {
    height: 250px;
  }
  
  .related-grid {
    grid-template-columns: 1fr;
  }
}
</style>
