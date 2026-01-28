<template>
  <div class="contact-page">
    <div class="page-header">
      <div class="header-bg"></div>
      <h1 class="gradient-text">Get in Touch</h1>
      <p>Have questions? We'd love to hear from you.</p>
    </div>

    <div class="contact-wrapper">
      <div class="contact-grid">
        
        <!-- Left Column: The Form -->
        <div class="form-card">
          <div class="card-header">
            <h2>Send a Message</h2>
            <p>We usually reply within 24 hours.</p>
          </div>

          <form @submit.prevent="submitForm" class="contact-form">
            <div class="form-row">
              <div class="form-group">
                <label for="name">Name</label>
                <input type="text" id="name" v-model="form.name" required placeholder="Jane Doe">
              </div>
              <div class="form-group">
                <label for="email">Email</label>
                <input type="email" id="email" v-model="form.email" required placeholder="jane@company.com">
              </div>
            </div>

            <div class="form-group">
              <label for="company">Company</label>
              <input type="text" id="company" v-model="form.company" placeholder="Acme Inc.">
            </div>

            <div class="form-group">
              <label for="subject">Subject</label>
              <div class="select-wrapper">
                <select id="subject" v-model="form.subject" required>
                  <option value="" disabled selected>Select a topic...</option>
                  <option value="sales">Sales Inquiry</option>
                  <option value="support">Technical Support</option>
                  <option value="partnership">Partnership Opportunity</option>
                  <option value="feedback">Product Feedback</option>
                  <option value="other">Other</option>
                </select>
                <div class="select-arrow">▼</div>
              </div>
            </div>

            <div class="form-group">
              <label for="message">Message</label>
              <textarea id="message" v-model="form.message" rows="5" required placeholder="Tell us how we can help..."></textarea>
            </div>

            <button type="submit" class="btn-submit">
              <span>Send Message</span>
              <svg class="icon-right" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
              </svg>
            </button>
          </form>
        </div>

        <!-- Right Column: Contact Info -->
        <div class="info-column">
          <div class="info-card">
            <div class="info-item">
              <div class="icon-box email">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                </svg>
              </div>
              <div class="text-content">
                <h4>Email Us</h4>
                <p>support@aiagents.dev</p>
                <p class="sub">sales@aiagents.dev</p>
              </div>
            </div>

            <div class="divider"></div>

            <div class="info-item">
              <div class="icon-box location">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
              </div>
              <div class="text-content">
                <h4>Office</h4>
                <p>123 Innovation Drive</p>
                <p class="sub">San Francisco, CA 94102</p>
              </div>
            </div>

            <div class="divider"></div>

            <div class="info-item">
              <div class="icon-box hours">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <div class="text-content">
                <h4>Business Hours</h4>
                <p>Mon - Fri, 9:00 - 18:00 PST</p>
              </div>
            </div>
          </div>

          <!-- Socials integrated into sidebar -->
          <div class="social-card">
            <h4>Follow Us</h4>
            <div class="social-row">
              <a href="#" class="social-link">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
              </a>
              <a href="#" class="social-link">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
              </a>
              <a href="#" class="social-link">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"></path></svg>
              </a>
            </div>
          </div>

          <div class="cta-card">
            <h4>Prefer Chat?</h4>
            <p>Start a conversation with our support team.</p>
            <a href="#" class="btn-chat">Start Chat</a>
          </div>
        </div>
      </div>

      <!-- Bottom Links -->
      <div class="helpful-links">
        <h4>Looking for something else?</h4>
        <div class="link-tags">
          <router-link to="/pricing">Pricing Plans</router-link>
          <span>•</span>
          <router-link to="/faq">Help Center</router-link>
          <span>•</span>
          <router-link to="/how-it-works">How It Works</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

// Preserved Logic
const form = ref({
  name: '',
  email: '',
  company: '',
  subject: '',
  message: ''
})

const submitForm = () => {
  alert(`Thank you for your message! We'll get back to you at ${form.value.email} soon.`)
  // Reset form
  form.value = {
    name: '',
    email: '',
    company: '',
    subject: '',
    message: ''
  }
}
</script>

<style scoped>
/* --- 1. THEME VARIABLES --- */
/* --- 1. THEME VARIABLES --- */
.contact-page {
  /* Most variables are now global */
  width: 100%;
  min-height: 100vh;
  background-color: var(--bg-body);
  color: var(--text-primary);
  overflow-x: hidden;
}

/* --- 2. HEADER --- */
.page-header {
  text-align: center;
  padding: 6rem 1.5rem 4rem;
  position: relative;
}

.header-bg {
  position: absolute;
  top: -50%; left: 50%;
  transform: translateX(-50%);
  width: 1000px; height: 600px;
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

/* --- 3. LAYOUT GRID --- */
.contact-wrapper {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 1.5rem 6rem;
}

.contact-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 3rem;
  align-items: start;
}

/* --- 4. FORM CARD (Glassmorphism) --- */
/* --- 4. FORM CARD (Glassmorphism) --- */
.form-card {
  background: var(--bg-card);
  backdrop-filter: blur(16px);
  border: 1px solid var(--border);
  border-radius: 24px;
  padding: 3rem;
  position: relative;
  box-shadow: var(--shadow-xl);
}

/* Subtle purple glow behind form */
.form-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, var(--primary), transparent);
  opacity: 0.5;
}

.card-header {
  margin-bottom: 2.5rem;
}

.card-header h2 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.card-header p {
  color: var(--text-muted);
}

/* --- 5. FORM STYLING --- */
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

.form-group {
  margin-bottom: 1.5rem;
  position: relative;
}

.form-group label {
  display: block;
  margin-bottom: 0.75rem;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-left: 0.25rem;
}

/* Inputs */
.form-group input,
.form-group textarea {
  width: 100%;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1rem 1.25rem;
  color: var(--text-primary);
  font-size: 1rem;
  font-family: inherit;
  transition: all 0.3s ease;
}

/* Custom Select */
.select-wrapper {
  position: relative;
}

.form-group select {
  width: 100%;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1rem 1.25rem;
  color: var(--text-primary);
  font-size: 1rem;
  font-family: inherit;
  appearance: none;
  cursor: pointer;
  transition: all 0.3s ease;
}

.select-arrow {
  position: absolute;
  right: 1.25rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  font-size: 0.8rem;
  pointer-events: none;
}

/* Focus States */
.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 4px var(--primary-glow);
  background: var(--bg-card-solid);
}

/* Button */
.btn-submit {
  width: 100%;
  background: linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%);
  color: white;
  border: none;
  padding: 1.25rem;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  cursor: pointer;
  transition: 0.3s;
  box-shadow: 0 4px 20px var(--primary-glow);
}

.btn-submit:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px var(--primary-glow);
}

.icon-right {
  width: 20px; height: 20px;
}

/* --- 6. INFO COLUMN (Right Side) --- */
.info-column {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.info-card {
  background: var(--bg-card);
  backdrop-filter: blur(16px);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 2rem;
}

.info-item {
  display: flex;
  gap: 1.25rem;
  align-items: flex-start;
}

.icon-box {
  width: 48px; height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: 0.3s;
}

.icon-box.email { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
.icon-box.location { background: rgba(16, 185, 129, 0.15); color: #34d399; }
.icon-box.hours { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }

.icon-box svg {
  width: 24px; height: 24px;
}

.text-content h4 {
  color: white;
  font-size: 1.125rem;
  margin-bottom: 0.5rem;
}

.text-content p {
  color: var(--text-muted);
  font-size: 0.95rem;
  line-height: 1.5;
}

.text-content p.sub {
  color: var(--text-muted);
  opacity: 0.7;
  font-size: 0.85rem;
  margin-top: -0.25rem;
}

.divider {
  height: 1px;
  background: var(--border);
  margin: 1.5rem 0;
}

/* Social Card */
.social-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 1.5rem;
}

.social-card h4 {
  color: var(--text-primary);
  margin-bottom: 1rem;
  font-size: 1rem;
}

.social-row {
  display: flex;
  gap: 1rem;
}

.social-link {
  width: 40px; height: 40px;
  border-radius: 10px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: 0.2s;
}

.social-link:hover {
  background: var(--primary);
  border-color: var(--primary);
  transform: translateY(-2px);
}

.social-link svg {
  width: 20px; height: 20px;
  color: var(--text-muted);
}

.social-link:hover svg {
  color: white;
}

/* Chat CTA */
.cta-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 1.5rem;
  text-align: center;
}

.cta-card h4 {
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.cta-card p {
  color: var(--text-muted);
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.btn-chat {
  display: inline-block;
  width: 100%;
  padding: 0.75rem;
  background: transparent;
  border: 1px solid var(--primary);
  color: var(--primary);
  border-radius: 8px;
  text-align: center;
  font-weight: 600;
  font-size: 0.9rem;
  transition: 0.2s;
}

.btn-chat:hover {
  background: var(--primary);
  color: white;
}

/* --- 7. FOOTER LINKS --- */
.helpful-links {
  text-align: center;
  margin-top: 4rem;
  padding-top: 2rem;
  border-top: 1px solid var(--border);
}

.helpful-links h4 {
  color: var(--text-primary);
  margin-bottom: 1.5rem;
  font-weight: 600;
}

.link-tags {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  font-size: 0.95rem;
}

.link-tags span { color: var(--border); }

.link-tags a {
  color: var(--text-muted);
  text-decoration: none;
  transition: 0.2s;
}

.link-tags a:hover {
  color: var(--primary);
}

/* --- 8. RESPONSIVE --- */
@media (max-width: 900px) {
  .contact-grid {
    grid-template-columns: 1fr;
  }
  
  .contact-wrapper {
    padding-bottom: 4rem;
  }
}

@media (max-width: 600px) {
  .form-row { grid-template-columns: 1fr; }
  .gradient-text { font-size: 2.5rem; }
  .link-tags { flex-direction: column; gap: 0.75rem; }
  .link-tags span { display: none; }
}
</style>