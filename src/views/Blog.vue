<template>
  <div class="blog-page">
    <!-- Header -->
    <div class="page-header">
      <div class="header-bg"></div>
      <h1 class="gradient-text">Blog</h1>
      <p>Insights on AI, automation, and the future of development</p>
    </div>

    <div class="blog-container">
      <!-- Main Content Area -->
      <div class="main-content">
        
        <!-- Featured Post (Index 0) -->
        <article class="blog-card featured-card" v-if="blogPosts.length > 0">
          <div class="card-image-wrapper">
            <div class="image-placeholder" :style="{ background: blogPosts[0].color }"></div>
            <div class="category-overlay">
              <span class="post-category">{{ blogPosts[0].category }}</span>
            </div>
          </div>
          <div class="card-content">
            <div class="post-meta">
              <span class="post-date">{{ blogPosts[0].date }}</span>
              <span class="separator">•</span>
              <span class="post-read-time">{{ blogPosts[0].readTime }} min read</span>
            </div>
            <h2>{{ blogPosts[0].title }}</h2>
            <p>{{ blogPosts[0].excerpt }}</p>
            <router-link :to="`/blog/${blogPosts[0].slug}`" class="read-more">
              Read Article <span class="arrow">→</span>
            </router-link>
          </div>
        </article>

        <!-- Standard Posts Grid (Index 1+) -->
        <div class="regular-grid">
          <article class="blog-card" v-for="(post, index) in blogPosts" :key="post.id" v-show="index > 0">
            <div class="card-image-wrapper">
              <div class="image-placeholder" :style="{ background: post.color }"></div>
              <div class="category-overlay">
                <span class="post-category">{{ post.category }}</span>
              </div>
            </div>
            <div class="card-content">
              <div class="post-meta">
                <span class="post-date">{{ post.date }}</span>
                <span class="separator">•</span>
                <span class="post-read-time">{{ post.readTime }} min read</span>
              </div>
              <h2>{{ post.title }}</h2>
              <p>{{ post.excerpt }}</p>
              <router-link :to="`/blog/${post.slug}`" class="read-more">
                Read Article <span class="arrow">→</span>
              </router-link>
            </div>
          </article>
        </div>
      </div>

      <!-- Sidebar -->
      <aside class="sidebar">
        <!-- Categories -->
        <div class="sidebar-widget">
          <h3>Categories</h3>
          <ul class="category-list">
            <li v-for="cat in categories" :key="cat.name">
              <a href="#">
                <span>{{ cat.name }}</span>
                <span class="count">{{ cat.count }}</span>
              </a>
            </li>
          </ul>
        </div>

        <!-- Popular Posts -->
        <div class="sidebar-widget popular-widget">
          <h3>Trending</h3>
          <ul class="popular-list">
            <li v-for="post in popularPosts" :key="post.id">
              <router-link :to="`/blog/${post.slug}`" class="popular-link">
                <div class="trending-number">#{{ post.id }}</div>
                <span>{{ post.title }}</span>
              </router-link>
            </li>
          </ul>
        </div>

        <!-- Newsletter -->
        <div class="sidebar-widget newsletter-widget">
          <h3>Stay Updated</h3>
          <p>Get the latest insights on AI development.</p>
          <form @submit.prevent="subscribe" class="subscribe-form">
            <input type="email" placeholder="Enter your email" v-model="email" required>
            <button type="submit" class="btn-subscribe">
              Subscribe
            </button>
          </form>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { blogPosts as allPosts } from '../data/blogPosts'

const email = ref('')
const blogPosts = ref(allPosts)

const categories = ref([
  { name: 'AI Trends', count: 12 },
  { name: 'Productivity', count: 8 },
  { name: 'Tutorial', count: 15 },
  { name: 'Case Study', count: 6 },
  { name: 'Testing', count: 5 },
  { name: 'Technical', count: 10 }
])

const popularPosts = computed(() => {
  return allPosts.slice(0, 3)
})

const subscribe = () => {
  alert(`Subscribed with: ${email.value}`)
  email.value = ''
}
</script>

<style scoped>
/* --- 1. THEME VARIABLES --- */
/* --- 1. THEME VARIABLES --- */
.blog-page {
  /* Most variables are now global */
  width: 100%;
  min-height: 100vh;
  background-color: var(--bg-body);
  color: var(--text-primary);
  overflow-x: hidden;
}

/* --- 2. PAGE HEADER --- */
.page-header {
  position: relative;
  text-align: center;
  padding: 6rem 1.5rem 5rem;
  overflow: hidden;
}

.header-bg {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.15) 0%, transparent 60%);
  z-index: 0;
}

.gradient-text {
  background: var(--gradient-text);
  -webkit-background-clip: text;
  background-clip: text;
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

/* --- 3. LAYOUT CONTAINER --- */
.blog-container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 1.5rem 6rem;
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 4rem;
  position: relative;
}

.main-content {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

/* --- 4. FEATURED POST (Wide Card) --- */
.featured-card {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  background: var(--bg-card-solid);
  border: 1px solid var(--border);
  border-radius: 20px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.featured-card:hover {
  transform: translateY(-5px);
  border-color: var(--primary);
  box-shadow: var(--shadow-xl);
}

.featured-card .card-image-wrapper {
  height: 100%;
  min-height: 350px;
  position: relative;
}

.featured-card .card-content {
  padding: 3rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

/* --- 5. REGULAR GRID --- */
.regular-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 2rem;
}

.blog-card {
  background: var(--bg-card);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
}

.blog-card:hover {
  transform: translateY(-5px);
  border-color: var(--primary-glow);
  box-shadow: var(--shadow-lg);
}

/* --- 6. CARD INTERNALS --- */
.card-image-wrapper {
  position: relative;
  height: 200px;
  overflow: hidden;
}

.image-placeholder {
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
}

.category-overlay {
  position: absolute;
  top: 1rem; left: 1rem;
  z-index: 2;
}

.post-category {
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255,255,255,0.1);
  color: var(--text-primary);
  padding: 0.4rem 0.8rem;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.card-content {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
}

.post-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.separator {
  color: var(--border);
}

.card-content h2 {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.75rem;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-content p {
  color: var(--text-muted);
  font-size: 0.95rem;
  line-height: 1.6;
  margin-bottom: 1.5rem;
  flex-grow: 1;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.read-more {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--primary);
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s ease;
}

.read-more:hover {
  color: var(--primary-light);
}

.read-more .arrow {
  transition: transform 0.2s ease;
}

.read-more:hover .arrow {
  transform: translateX(4px);
}

/* --- 7. SIDEBAR --- */
.sidebar {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.sidebar-widget {
  background: var(--bg-card);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 2rem;
  position: sticky;
  top: 100px; /* Keeps it visible while scrolling */
  transition: 0.3s;
}

.sidebar-widget h3 {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Category List */
.category-list {
  list-style: none;
  padding: 0;
}

.category-list li {
  margin-bottom: 0.5rem;
}

.category-list a {
  display: flex;
  justify-content: space-between;
  color: var(--text-muted);
  text-decoration: none;
  padding: 0.75rem;
  border-radius: 8px;
  transition: 0.2s;
}

.category-list a:hover {
  background: var(--bg-surface);
  color: var(--text-primary);
}

.count {
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  color: var(--text-primary);
}

/* Trending List */
.popular-list {
  list-style: none;
  padding: 0;
}

.popular-list li {
  margin-bottom: 1rem;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  padding-bottom: 1rem;
}

.popular-list li:last-child {
  border-bottom: none;
}

.popular-link {
  display: flex;
  align-items: center;
  gap: 1rem;
  text-decoration: none;
  color: var(--text-muted);
  font-weight: 500;
  font-size: 0.95rem;
  line-height: 1.4;
  transition: 0.2s;
}

.popular-link:hover {
  color: var(--primary);
}

.trending-number {
  font-family: monospace;
  color: var(--primary);
  opacity: 0.8;
  font-size: 0.9rem;
}

/* Newsletter Widget */
.newsletter-widget {
  background: var(--bg-card);
  border-color: var(--primary-glow);
}

.newsletter-widget p {
  color: var(--text-muted);
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
  line-height: 1.5;
}

.subscribe-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.subscribe-form input {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.8rem;
  color: var(--text-primary);
  outline: none;
  transition: 0.2s;
}

.subscribe-form input:focus {
  border-color: var(--primary);
}

.btn-subscribe {
  background: var(--primary);
  color: var(--text-primary);
  border: none;
  padding: 0.8rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: 0.3s;
}

.btn-subscribe:hover {
  background: #7c3aed;
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
}

/* --- 8. RESPONSIVE --- */
@media (max-width: 1024px) {
  .blog-container {
    grid-template-columns: 1fr;
  }
  
  .sidebar {
    position: static;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 2rem;
  }
}

@media (max-width: 768px) {
  .page-header { padding: 4rem 1.5rem; }
  .gradient-text { font-size: 2.5rem; }
  
  .featured-card {
    grid-template-columns: 1fr;
  }
  
  .featured-card .card-image-wrapper {
    min-height: 200px;
  }
  
  .featured-card .card-content {
    padding: 1.5rem;
  }
}
</style>