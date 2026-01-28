<template>
  <div class="blog-post-page">
    <!-- Navigation Breadcrumb (Visual only for context) -->
    <nav class="breadcrumb">
      <router-link to="/blog">Blog</router-link>
      <span class="separator">/</span>
      <span class="current">{{ post.category }}</span>
    </nav>

    <!-- Main Article -->
    <article class="post-container">
      <header class="post-header">
        <div class="post-meta-top">
          <span class="post-category">{{ post.category }}</span>
          <span class="post-read-time">{{ post.readTime }} min read</span>
        </div>
        
        <h1 class="post-title">{{ post.title }}</h1>
        
        <div class="author-row">
          <div class="author-avatar">
            <!-- Placeholder Avatar -->
            <img src="https://ui-avatars.com/api/?name=Sarah+Chen&background=8b5cf6&color=fff" alt="Author">
          </div>
          <div class="author-info">
            <div class="author-name">By {{ post.author }}</div>
            <div class="post-date">{{ post.date }}</div>
          </div>
        </div>
      </header>

      <!-- Feature Image with Gradient Overlay -->
      <div class="post-hero-image">
        <div class="image-placeholder" :style="{ background: post.color }"></div>
        <div class="image-overlay"></div>
      </div>

      <!-- Content Area (Deep styled typography) -->
      <div class="post-content">
        <div v-html="post.content"></div>
      </div>

      <!-- Footer Tags & Share -->
      <footer class="post-footer">
        <div class="footer-top">
          <div class="tags-container">
            <h4>Tags</h4>
            <div class="tags">
              <span class="tag" v-for="tag in post.tags" :key="tag">#{{ tag }}</span>
            </div>
          </div>
          
          <div class="share-container">
            <h4>Share this post</h4>
            <div class="social-buttons">
              <button class="social-btn twitter" title="Share on Twitter">
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
              </button>
              <button class="social-btn linkedin" title="Share on LinkedIn">
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
              </button>
              <button class="social-btn link" title="Copy Link">
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
              </button>
            </div>
          </div>
        </div>
      </footer>
    </article>

    <!-- Related Posts Section -->
    <aside class="related-posts-section">
      <div class="container">
        <h3 class="related-title">You might also like</h3>
        <div class="related-grid">
          <router-link 
            v-for="related in relatedPosts" 
            :key="related.id"
            :to="`/blog/${related.slug}`"
            class="related-card"
          >
            <div class="related-image" :style="{ background: related.color }"></div>
            <div class="related-content">
              <span class="related-category">AI Trends</span>
              <h4>{{ related.title }}</h4>
              <p class="related-date">{{ related.date }}</p>
            </div>
          </router-link>
        </div>
      </div>
    </aside>

    <!-- Bottom CTA -->
    <div class="cta-section">
      <div class="cta-box">
        <h2>Ready to Transform Your Development Workflow?</h2>
        <p>Join thousands of developers using AI agents to accelerate their projects.</p>
        <router-link to="/login" class="btn btn-primary">
          Get Started Free
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { blogPosts as allPosts } from '../data/blogPosts'

const route = useRoute()

const post = ref({
  id: 0,
  slug: '',
  title: 'Loading...',
  author: '',
  date: '',
  readTime: 0,
  category: '',
  color: '',
  tags: [],
  content: ''
})

const relatedPosts = ref([])

const loadPost = () => {
  const slug = route.params.slug
  const foundPost = allPosts.find(p => p.slug === slug)
  
  if (foundPost) {
    post.value = foundPost
    // Get 3 other posts as related (excluding current)
    relatedPosts.value = allPosts
      .filter(p => p.slug !== slug)
      .slice(0, 3)
    
    // Scroll to top on navigation
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

// Watch for route parameter changes
watch(() => route.params.slug, () => {
  loadPost()
})

onMounted(() => {
  loadPost()
})
</script>

<style scoped>
/* --- 1. THEME VARIABLES --- */
/* --- 1. THEME VARIABLES --- */
.blog-post-page {
  /* Most variables are now global */
  width: 100%;
  min-height: 100vh;
  background-color: var(--bg-body);
  color: var(--text-primary);
  overflow-x: hidden;
  padding-bottom: 6rem;
}

/* --- 2. BREADCRUMB --- */
.breadcrumb {
  max-width: 800px;
  margin: 0 auto;
  padding: 1.5rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-muted);
}

.breadcrumb a {
  color: var(--text-muted);
  text-decoration: none;
  transition: color 0.2s;
}

.breadcrumb a:hover { color: var(--primary); }
.separator { color: var(--border); }
.current { color: var(--text-main); font-weight: 500; }

/* --- 3. MAIN ARTICLE CONTAINER --- */
/* --- 3. MAIN ARTICLE CONTAINER --- */
.post-container {
  max-width: 800px;
  margin: 0 auto 4rem;
  background: var(--bg-card);
  backdrop-filter: blur(20px);
  border: 1px solid var(--border);
  border-radius: 24px;
  overflow: hidden; /* Contains the image */
  box-shadow: var(--shadow-xl);
}

/* --- 4. HEADER --- */
.post-header {
  padding: 3rem 2.5rem 2rem;
  text-align: center;
}

.post-meta-top {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
}

.post-category {
  background: linear-gradient(90deg, rgba(139, 92, 246, 0.2), rgba(236, 72, 153, 0.2));
  border: 1px solid rgba(139, 92, 246, 0.3);
  color: var(--text-secondary);
  padding: 0.4rem 1rem;
  border-radius: 50px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.post-read-time {
  color: var(--text-muted);
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.post-read-time::before {
  content: '';
  width: 4px; height: 4px;
  background: var(--text-muted);
  border-radius: 50%;
}

.post-title {
  font-size: 3rem;
  font-weight: 800;
  line-height: 1.2;
  background: var(--gradient-text);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 2.5rem;
  letter-spacing: -0.02em;
}

.author-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding-top: 2rem;
  border-top: 1px solid var(--border);
}

.author-avatar img {
  width: 48px; height: 48px;
  border-radius: 50%;
  border: 2px solid var(--bg-card);
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

.author-name {
  font-weight: 600;
  color: var(--text-primary);
}

.post-date {
  color: var(--text-muted);
  font-size: 0.875rem;
}

/* --- 5. HERO IMAGE --- */
.post-hero-image {
  position: relative;
  height: 400px;
  width: 100%;
  overflow: hidden;
}

.image-placeholder {
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
}

.image-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, var(--bg-body) 0%, transparent 20%);
}

/* --- 6. CONTENT TYPOGRAPHY (THE CRITICAL PART) --- */
.post-content {
  padding: 3rem 2.5rem 4rem;
  color: var(--text-secondary);
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 1.125rem;
  line-height: 1.8;
}

/* Deep styles for v-html content */
.post-content :deep(.lead) {
  font-size: 1.35rem;
  line-height: 1.6;
  color: var(--text-secondary);
  margin-bottom: 3rem;
  font-weight: 400;
}

.post-content :deep(h2) {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 4rem 0 1.5rem;
  position: relative;
  padding-bottom: 1rem;
}

.post-content :deep(h2::after) {
  content: '';
  position: absolute;
  left: 0; bottom: 0;
  width: 60px; height: 4px;
  background: var(--primary);
  border-radius: 2px;
}

.post-content :deep(p) {
  margin-bottom: 1.75rem;
  color: var(--text-secondary);
}

.post-content :deep(ul) {
  margin: 2rem 0;
  padding-left: 0;
  list-style: none;
}

.post-content :deep(li) {
  margin-bottom: 1rem;
  padding-left: 2rem;
  position: relative;
  color: var(--text-secondary);
}

.post-content :deep(li::before) {
  content: '•';
  color: var(--primary);
  font-size: 1.5rem;
  position: absolute;
  left: 0;
  top: -4px;
}

.post-content :deep(strong) {
  color: var(--text-primary);
  font-weight: 600;
}

.post-content :deep(blockquote) {
  border-left: 4px solid var(--primary);
  background: var(--bg-surface);
  padding: 2rem;
  margin: 3rem 0;
  border-radius: 0 12px 12px 0;
  font-style: italic;
  color: var(--text-secondary);
}

.post-content :deep(cite) {
  display: block;
  margin-top: 1.5rem;
  font-style: normal;
  color: var(--primary);
  font-weight: 600;
  font-size: 0.9rem;
}

/* --- 7. FOOTER & TAGS --- */
.post-footer {
  padding: 2rem 2.5rem 3rem;
  border-top: 1px solid var(--border);
}

.footer-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 2rem;
}

.tags-container h4, .share-container h4 {
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 1rem;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tag {
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--border);
  color: var(--text-muted);
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  transition: 0.2s;
  cursor: default;
}

.tag:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.social-buttons {
  display: flex;
  gap: 0.75rem;
}

.social-btn {
  width: 40px; height: 40px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: rgba(255,255,255,0.05);
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: 0.2s;
}

.social-btn:hover {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--text-primary);
  transform: translateY(-2px);
}

/* --- 8. RELATED POSTS --- */
.related-posts-section {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

.related-title {
  font-size: 1.75rem;
  color: var(--text-primary);
  margin-bottom: 2rem;
  border-left: 4px solid var(--primary);
  padding-left: 1rem;
}

.related-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.related-card {
  background: var(--bg-glass);
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  text-decoration: none;
  transition: 0.3s;
}

.related-card:hover {
  transform: translateY(-5px);
  border-color: var(--primary);
}

.related-image {
  height: 160px;
  width: 100%;
}

.related-content {
  padding: 1.5rem;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}

.related-category {
  font-size: 0.75rem;
  color: var(--primary);
  font-weight: 600;
  margin-bottom: 0.5rem;
  text-transform: uppercase;
}

.related-content h4 {
  color: var(--text-primary);
  font-size: 1.25rem;
  margin-bottom: 0.5rem;
  line-height: 1.4;
}

.related-date {
  color: var(--text-muted);
  font-size: 0.875rem;
  margin-top: auto;
}

/* --- 9. BOTTOM CTA --- */
.cta-section {
  max-width: 1000px;
  margin: 6rem auto 4rem;
  padding: 0 1.5rem;
}

.cta-box {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 24px;
  padding: 5rem 3rem;
  text-align: center;
  position: relative;
  overflow: hidden;
  box-shadow: var(--shadow-xl);
}

/* Decorative Glow */
.cta-box::before {
  content: '';
  position: absolute;
  top: -50%; left: -50%;
  width: 200%; height: 200%;
  background: radial-gradient(circle at center, rgba(139, 92, 246, 0.15), transparent 50%);
  pointer-events: none;
}

.cta-box h2 {
  font-size: 2.5rem;
  color: var(--text-primary);
  margin-bottom: 1.5rem;
  position: relative;
  z-index: 1;
}

.cta-box p {
  color: var(--text-secondary);
  font-size: 1.25rem;
  margin-bottom: 3rem;
  position: relative;
  z-index: 1;
}

.btn {
  display: inline-block;
  padding: 1rem 3rem;
  border-radius: 50px;
  font-weight: 600;
  text-decoration: none;
  transition: 0.3s;
  position: relative;
  z-index: 2;
}

.btn-primary {
  background: white;
  color: var(--primary);
  box-shadow: 0 10px 25px rgba(0,0,0,0.3);
}

.btn-primary:hover {
  transform: translateY(-3px);
  box-shadow: 0 15px 35px rgba(0,0,0,0.4);
}

/* --- RESPONSIVE --- */
@media (max-width: 1024px) {
  .post-title { font-size: 2.5rem; }
  .footer-top {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
}

@media (max-width: 768px) {
  .post-container {
    border-radius: 0;
    margin: 0 0 2rem;
  }
  
  .post-header { padding: 2rem 1.5rem; }
  .post-content { padding: 2rem 1.5rem; }
  
  .post-hero-image { height: 250px; }
  .post-title { font-size: 2rem; }
  
  .cta-box { padding: 3rem 1.5rem; }
  .cta-box h2 { font-size: 1.75rem; }
}
</style>