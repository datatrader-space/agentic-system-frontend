<template>
  <div class="contact-page">
    <div class="page-header">
      <h1>Get in Touch</h1>
      <p>We'd love to hear from you</p>
    </div>

    <div class="contact-container">
      <div class="contact-grid">
        <div class="contact-form-section">
          <h2>Send Us a Message</h2>
          <form @submit.prevent="submitForm" class="contact-form">
            <div class="form-row">
              <div class="form-group">
                <label for="name">Name *</label>
                <input type="text" id="name" v-model="form.name" required>
              </div>
              <div class="form-group">
                <label for="email">Email *</label>
                <input type="email" id="email" v-model="form.email" required>
              </div>
            </div>

            <div class="form-group">
              <label for="company">Company</label>
              <input type="text" id="company" v-model="form.company">
            </div>

            <div class="form-group">
              <label for="subject">Subject *</label>
              <select id="subject" v-model="form.subject" required>
                <option value="">Select a topic...</option>
                <option value="sales">Sales Inquiry</option>
                <option value="support">Technical Support</option>
                <option value="partnership">Partnership Opportunity</option>
                <option value="feedback">Product Feedback</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div class="form-group">
              <label for="message">Message *</label>
              <textarea id="message" v-model="form.message" rows="6" required></textarea>
            </div>

            <button type="submit" class="btn btn-primary">Send Message</button>
          </form>
        </div>

        <div class="contact-info-section">
          <div class="info-card">
            <div class="info-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
              </svg>
            </div>
            <h3>Email Us</h3>
            <p>support@aiagents.dev</p>
            <p class="secondary">sales@aiagents.dev</p>
          </div>

          <div class="info-card">
            <div class="info-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
            </div>
            <h3>Office</h3>
            <p>123 Innovation Drive</p>
            <p>San Francisco, CA 94102</p>
          </div>

          <div class="info-card">
            <div class="info-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h3>Business Hours</h3>
            <p>Monday - Friday</p>
            <p>9:00 AM - 6:00 PM PST</p>
          </div>

          <div class="info-card">
            <div class="info-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
              </svg>
            </div>
            <h3>Live Chat</h3>
            <p>Available for paid customers</p>
            <a href="#" class="chat-link">Start a conversation →</a>
          </div>

          <div class="social-links">
            <h3>Follow Us</h3>
            <div class="social-icons">
              <a href="#" class="social-icon twitter">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"></path>
                </svg>
              </a>
              <a href="#" class="social-icon linkedin">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"></path>
                </svg>
              </a>
              <a href="#" class="social-icon github">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"></path>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      <div class="faq-prompt">
        <h3>Looking for answers?</h3>
        <p>Check our <router-link to="/pricing">Pricing</router-link> page for plan details or visit our <router-link to="/how-it-works">How It Works</router-link> guide.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

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
.contact-page {
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

.contact-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 4rem 2rem;
}

.contact-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 4rem;
  margin-bottom: 4rem;
}

.contact-form-section h2 {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 2rem;
}

.contact-form {
  background: white;
  padding: 3rem;
  border-radius: 1rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 1rem;
  transition: border-color 0.2s ease;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.btn {
  width: 100%;
  padding: 1rem;
  border: none;
  border-radius: 0.5rem;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover {
  background: #5a67d8;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.contact-info-section {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.info-card {
  background: white;
  padding: 2rem;
  border-radius: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.info-icon {
  width: 48px;
  height: 48px;
  background: #ede9fe;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
}

.info-icon svg {
  width: 24px;
  height: 24px;
  color: #667eea;
}

.info-card h3 {
  font-size: 1.125rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 0.75rem;
}

.info-card p {
  color: #6b7280;
  line-height: 1.6;
  margin-bottom: 0.25rem;
}

.info-card p.secondary {
  font-size: 0.875rem;
}

.chat-link {
  color: #667eea;
  font-weight: 600;
  text-decoration: none;
  display: inline-block;
  margin-top: 0.5rem;
}

.chat-link:hover {
  color: #5a67d8;
}

.social-links {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 2rem;
  border-radius: 1rem;
}

.social-links h3 {
  font-size: 1.125rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
}

.social-icons {
  display: flex;
  gap: 1rem;
}

.social-icon {
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.social-icon:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}

.social-icon svg {
  width: 20px;
  height: 20px;
  color: white;
}

.faq-prompt {
  background: white;
  padding: 3rem;
  border-radius: 1rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  text-align: center;
}

.faq-prompt h3 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 1rem;
}

.faq-prompt p {
  color: #6b7280;
  font-size: 1.125rem;
}

.faq-prompt a {
  color: #667eea;
  font-weight: 600;
  text-decoration: none;
}

.faq-prompt a:hover {
  text-decoration: underline;
}

@media (max-width: 1024px) {
  .contact-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .page-header h1 {
    font-size: 2rem;
  }
  
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .contact-form {
    padding: 2rem;
  }
}
</style>
