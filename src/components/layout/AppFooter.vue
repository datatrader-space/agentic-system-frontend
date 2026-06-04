<template>
  <footer v-if="isPublicPage" class="site-footer">
    <div class="footer-container">
      <div class="footer-grid">
        <!-- Brand -->
        <div class="footer-brand">
          <div class="footer-logo">
            <span class="logo-text">AADML</span>
          </div>
          <p class="footer-tagline">AI Agent Development & Management Platform</p>
        </div>

        <!-- Product -->
        <div class="footer-col">
          <h4>Product</h4>
          <router-link to="/features">Features</router-link>
          <router-link to="/pricing">Pricing</router-link>
          <router-link to="/how-it-works">How It Works</router-link>
        </div>

        <!-- Resources -->
        <div class="footer-col">
          <h4>Resources</h4>
          <router-link to="/docs">Documentation</router-link>
          <router-link to="/blog">Blog</router-link>
          <router-link to="/about">About</router-link>
        </div>

        <!-- Legal -->
        <div class="footer-col">
          <h4>Company</h4>
          <router-link to="/contact">Contact</router-link>
          <router-link to="/login">Sign In</router-link>
        </div>
      </div>

      <div class="footer-bottom">
        <span>&copy; {{ year }} AADML. All rights reserved.</span>
        <span class="footer-built">Built with ♥ for agentic AI</span>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const year = new Date().getFullYear()

const isPublicPage = computed(() => !!route.meta.public)
</script>

<style scoped>
.site-footer {
  background: var(--bg-surface, #0a0a0f);
  border-top: 1px solid var(--border, rgba(255,255,255,0.08));
  color: var(--text-muted, #6b7280);
  padding: 4rem 2rem 2rem;
}

.footer-container {
  max-width: 1200px;
  margin: 0 auto;
}

.footer-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 3rem;
  margin-bottom: 3rem;
}

.footer-brand {
  max-width: 280px;
}

.logo-text {
  font-size: 1.25rem;
  font-weight: 800;
  background: linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.footer-tagline {
  margin-top: 0.75rem;
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--text-muted, #6b7280);
}

.footer-col h4 {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--text-secondary, #9ca3af);
  margin-bottom: 1rem;
}

.footer-col a {
  display: block;
  color: var(--text-muted, #6b7280);
  text-decoration: none;
  font-size: 0.9rem;
  padding: 0.3rem 0;
  transition: color 0.15s;
}

.footer-col a:hover {
  color: var(--text-primary, #fff);
}

.footer-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 2rem;
  border-top: 1px solid var(--border, rgba(255,255,255,0.06));
  font-size: 0.8rem;
}

.footer-built {
  opacity: 0.5;
}

@media (max-width: 768px) {
  .footer-grid {
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
  }
  .footer-brand {
    grid-column: 1 / -1;
  }
  .footer-bottom {
    flex-direction: column;
    gap: 0.5rem;
    text-align: center;
  }
}
</style>
