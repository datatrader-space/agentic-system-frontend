<template>
  <div class="blog-page">
    <div class="page-header">
      <h1>Blog</h1>
      <p>Insights on AI, automation, and the future of development</p>
    </div>

    <div class="blog-container">
      <div class="blog-grid">
        <article class="blog-card" v-for="post in blogPosts" :key="post.id">
          <div class="blog-image">
            <div class="image-placeholder" :style="{ background: post.color }">
              <span class="post-category">{{ post.category }}</span>
            </div>
          </div>
          <div class="blog-content">
            <div class="post-meta">
              <span class="post-date">{{ post.date }}</span>
              <span class="post-read-time">{{ post.readTime }} min read</span>
            </div>
            <h2>{{ post.title }}</h2>
            <p>{{ post.excerpt }}</p>
            <router-link :to="`/blog/${post.slug}`" class="read-more">
              Read More →
            </router-link>
          </div>
        </article>
      </div>

      <div class="blog-sidebar">
        <div class="sidebar-section">
          <h3>Categories</h3>
          <ul class="category-list">
            <li v-for="cat in categories" :key="cat.name">
              <a href="#">{{ cat.name }} <span class="count">({{ cat.count }})</span></a>
            </li>
          </ul>
        </div>

        <div class="sidebar-section">
          <h3>Popular Posts</h3>
          <ul class="popular-posts">
            <li v-for="post in popularPosts" :key="post.id">
              <router-link :to="`/blog/${post.slug}`">{{ post.title }}</router-link>
            </li>
          </ul>
        </div>

        <div class="sidebar-section newsletter">
          <h3>Stay Updated</h3>
          <p>Get the latest posts delivered to your inbox</p>
          <form @submit.prevent="subscribe" class="subscribe-form">
            <input type="email" placeholder="Your email" v-model="email" required>
            <button type="submit" class="btn-subscribe">Subscribe</button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const email = ref('')

const blogPosts = ref([
  {
    id: 1,
    slug: 'ai-powered-development-2026',
    title: 'The Future of AI-Powered Development in 2026',
    excerpt: 'Exploring how AI agents are transforming software development workflows and dramatically increasing productivity across teams.',
    date: 'Jan 20, 2026',
    readTime: 5,
    category: 'AI Trends',
    color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  },
  {
    id: 2,
    slug: '10-ways-ai-agents-boost-productivity',
    title: '10 Ways AI Agents Boost Developer Productivity',
    excerpt: 'Discover practical use cases where AI agents can save hours of manual work and improve code quality.',
    date: 'Jan 15, 2026',
    readTime: 8,
    category: 'Productivity',
    color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
  },
  {
    id: 3,
    slug: 'getting-started-with-agentic-systems',
    title: 'Getting Started with Agentic Systems',
    excerpt: 'A beginner-friendly guide to implementing AI agents in your development workflow.',
    date: 'Jan 10, 2026',
    readTime: 6,
    category: 'Tutorial',
    color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
  },
  {
    id: 4,
    slug: 'enterprise-ai-adoption',
    title: 'Enterprise AI Adoption: Lessons Learned',
    excerpt: 'Real-world experiences from enterprises deploying AI agents at scale.',
    date: 'Jan 5, 2026',
    readTime: 10,
    category: 'Case Study',
    color: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
  },
  {
    id: 5,
    slug: 'ai-testing-automation',
    title: 'Automating Testing with AI: A Complete Guide',
    excerpt: 'How AI agents can generate comprehensive test suites and improve code coverage.',
    date: 'Dec 28, 2025',
    readTime: 7,
    category: 'Testing',
    color: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
  },
  {
    id: 6,
    slug: 'llm-comparison-guide',
    title: 'Comparing LLMs for Code Generation',
    excerpt: 'An in-depth comparison of Ollama, Claude, GPT, and other models for development tasks.',
    date: 'Dec 20, 2025',
    readTime: 12,
    category: 'Technical',
    color: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)'
  }
])

const categories = ref([
  { name: 'AI Trends', count: 12 },
  { name: 'Productivity', count: 8 },
  { name: 'Tutorial', count: 15 },
  { name: 'Case Study', count: 6 },
  { name: 'Testing', count: 5 },
  { name: 'Technical', count: 10 }
])

const popularPosts = ref([
  { id: 1, slug: '10-ways-ai-agents-boost-productivity', title: '10 Ways AI Agents Boost Productivity' },
  { id: 2, slug: 'getting-started-with-agentic-systems', title: 'Getting Started with Agentic Systems' },
  { id: 3, slug: 'llm-comparison-guide', title: 'Comparing LLMs for Code Generation' }
])

const subscribe = () => {
  alert(`Subscribed with: ${email.value}`)
  email.value = ''
}
</script>

<style scoped>
.blog-page {
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

.blog-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 4rem 2rem;
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 4rem;
}

.blog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 2rem;
  align-content: start;
}

.blog-card {
  background: white;
  border-radius: 1rem;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.blog-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 24px rgba(102, 126, 234, 0.2);
}

.blog-image {
  position: relative;
  height: 200px;
  overflow: hidden;
}

.image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.post-category {
  background: rgba(255, 255, 255, 0.95);
  color: #667eea;
  padding: 0.5rem 1rem;
  border-radius: 2rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.blog-content {
  padding: 2rem;
}

.post-meta {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  font-size: 0.875rem;
  color: #6b7280;
}

.blog-content h2 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 1rem;
  line-height: 1.3;
}

.blog-content p {
  color: #6b7280;
  line-height: 1.6;
  margin-bottom: 1.5rem;
}

.read-more {
  color: #667eea;
  font-weight: 600;
  text-decoration: none;
  transition: color 0.2s ease;
}

.read-more:hover {
  color: #5a67d8;
}

.blog-sidebar {
  position: sticky;
  top: 2rem;
  height: fit-content;
}

.sidebar-section {
  background: white;
  padding: 2rem;
  border-radius: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  margin-bottom: 2rem;
}

.sidebar-section h3 {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 1.5rem;
}

.category-list {
  list-style: none;
  padding: 0;
}

.category-list li {
  margin-bottom: 0.75rem;
}

.category-list a {
  color: #4b5563;
  text-decoration: none;
  display: flex;
  justify-content: space-between;
  transition: color 0.2s ease;
}

.category-list a:hover {
  color: #667eea;
}

.count {
  color: #9ca3af;
  font-size: 0.875rem;
}

.popular-posts {
  list-style: none;
  padding: 0;
}

.popular-posts li {
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.popular-posts li:last-child {
  border-bottom: none;
}

.popular-posts a {
  color: #4b5563;
  text-decoration: none;
  font-weight: 500;
  line-height: 1.4;
  transition: color 0.2s ease;
}

.popular-posts a:hover {
  color: #667eea;
}

.newsletter {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.newsletter h3 {
  color: white;
}

.newsletter p {
  opacity: 0.95;
  margin-bottom: 1.5rem;
}

.subscribe-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.subscribe-form input {
  padding: 0.75rem;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
}

.btn-subscribe {
  padding: 0.75rem;
  background: white;
  color: #667eea;
  border: none;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-subscribe:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

@media (max-width: 1024px) {
  .blog-container {
    grid-template-columns: 1fr;
  }
  
  .blog-sidebar {
    position: static;
  }
}

@media (max-width: 768px) {
  .page-header h1 {
    font-size: 2rem;
  }
  
  .page-header p {
    font-size: 1.125rem;
  }
  
  .blog-grid {
    grid-template-columns: 1fr;
  }
}
</style>
