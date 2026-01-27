<template>
  <div class="about-page">
    <div class="page-header">
      <h1>About Us</h1>
      <p>Building the future of AI-powered development</p>
    </div>

    <div class="about-container">
      <section class="mission-section">
        <h2>Our Mission</h2>
        <p class="lead">
          We believe developers should spend their time solving creative problems, not fighting with boilerplate code and repetitive tasks. 
          Our mission is to empower every developer, team, and organization with intelligent AI agents that augment human creativity and accelerate innovation.
        </p>
      </section>

      <section class="story-section">
        <div class="story-content">
          <h2>Our Story</h2>
          <p>
            Founded in 2024 by a team of developers frustrated with the slow pace of traditional development workflows, 
            we set out to build a platform that would fundamentally change how software is created.
          </p>
          <p>
            After experiencing firsthand the power of AI language models for code generation, we realized the missing piece 
            wasn't just better models—it was intelligent orchestration, tool integration, and deep codebase understanding.
          </p>
          <p>
            Today, we're proud to serve developers, businesses, enterprises, and agencies worldwide, helping them ship 
            features faster, reduce technical debt, and focus on what matters: building amazing products.
          </p>
        </div>
        <div class="story-image">
          <div class="image-placeholder">
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
            </svg>
          </div>
        </div>
      </section>

      <section class="values-section">
        <h2>Our Values</h2>
        <div class="values-grid">
          <div class="value-card">
            <div class="value-icon">🎯</div>
            <h3>Developer-First</h3>
            <p>Every decision we make starts with asking: "Will this make developers' lives better?"</p>
          </div>
          <div class="value-card">
            <div class="value-icon">🔓</div>
            <h3>Open & Transparent</h3>
            <p>We believe in open source, transparent pricing, and honest communication with our users.</p>
          </div>
          <div class="value-card">
            <div class="value-icon">⚡</div>
            <h3>Innovation</h3>
            <p>We push the boundaries of what's possible with AI while maintaining practical, production-ready solutions.</p>
          </div>
          <div class="value-card">
            <div class="value-icon">🤝</div>
            <h3>Community</h3>
            <p>We're building more than software—we're building a community of developers shaping the future of coding.</p>
          </div>
        </div>
      </section>

      <section class="team-section">
        <h2>Leadership Team</h2>
        <div class="team-grid">
          <div class="team-member">
            <div class="member-avatar">SC</div>
            <h3>Sarah Chen</h3>
            <p class="role">Co-Founder & CEO</p>
            <p class="bio">Former engineering lead at Google, passionate about democratizing AI for developers.</p>
          </div>
          <div class="team-member">
            <div class="member-avatar">MP</div>
            <h3>Michael Park</h3>
            <p class="role">Co-Founder & CTO</p>
            <p class="bio">AI researcher with a background in compiler design and distributed systems.</p>
          </div>
          <div class="team-member">
            <div class="member-avatar">AR</div>
            <h3>Aisha Rahman</h3>
            <p class="role">VP of Engineering</p>
            <p class="bio">Infrastructure expert who scaled platforms at Netflix and Stripe.</p>
          </div>
          <div class="team-member">
            <div class="member-avatar">DL</div>
            <h3>David Lee</h3>
            <p class="role">Head of Product</p>
            <p class="bio">Product leader focused on developer experience and enterprise adoption.</p>
          </div>
        </div>
      </section>

      <section class="stats-section">
        <div class="stats-grid">
          <div class="stat">
            <div class="stat-number">10k+</div>
            <div class="stat-label">Active Developers</div>
          </div>
          <div class="stat">
            <div class="stat-number">500+</div>
            <div class="stat-label">Enterprise Customers</div>
          </div>
          <div class="stat">
            <div class="stat-number">1M+</div>
            <div class="stat-label">AI Sessions Per Month</div>
          </div>
          <div class="stat">
            <div class="stat-number">50+</div>
            <div class="stat-label">Countries Worldwide</div>
          </div>
        </div>
      </section>

      <section class="cta-section">
        <h2>Join Us on This Journey</h2>
        <p>Whether you're a developer, team lead, or enterprise decision-maker, we'd love to have you as part of our community.</p>
        <div class="cta-buttons">
          <router-link to="/login" class="btn btn-primary">Get Started Free</router-link>
          <router-link to="/contact" class="btn btn-secondary">Contact Us</router-link>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
// No reactive data needed for this static page
</script>

<style scoped>
.about-page {
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

.about-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 4rem 2rem;
}

section {
  margin-bottom: 6rem;
}

h2 {
  font-size: 2.5rem;
  font-weight: 700;
  color: #1f2937;
  text-align: center;
  margin-bottom: 3rem;
}

.mission-section {
  text-align: center;
}

.lead {
  font-size: 1.5rem;
  color: #4b5563;
  line-height: 1.8;
  max-width: 900px;
  margin: 0 auto;
}

.story-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: center;
}

.story-content h2 {
  text-align: left;
  margin-bottom: 2rem;
}

.story-content p {
  color: #4b5563;
  font-size: 1.125rem;
  line-height: 1.8;
  margin-bottom: 1.5rem;
}

.story-image {
  height: 400px;
}

.image-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-placeholder .icon {
  width: 120px;
  height: 120px;
  color: white;
  opacity: 0.8;
}

.values-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 2rem;
}

.value-card {
  background: white;
  padding: 2.5rem 2rem;
  border-radius: 1rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  text-align: center;
  transition: all 0.3s ease;
}

.value-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 24px rgba(102, 126, 234, 0.15);
}

.value-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.value-card h3 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 1rem;
}

.value-card p {
  color: #6b7280;
  line-height: 1.6;
}

.team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 3rem;
}

.team-member {
  text-align: center;
}

.member-avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 2rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.5rem;
}

.team-member h3 {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.role {
  color: #667eea;
  font-weight: 600;
  margin-bottom: 1rem;
}

.bio {
  color: #6b7280;
  line-height: 1.6;
  font-size: 0.875rem;
}

.stats-section {
  background: white;
  padding: 4rem 2rem;
  border-radius: 1rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 3rem;
  text-align: center;
}

.stat-number {
  font-size: 3rem;
  font-weight: 800;
  color: #667eea;
  margin-bottom: 0.5rem;
}

.stat-label {
  color: #6b7280;
  font-size: 1rem;
}

.cta-section {
  text-align: center;
  padding: 4rem 2rem;
  background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
  border-radius: 1rem;
  color: white;
}

.cta-section h2 {
  color: white;
}

.cta-section p {
  font-size: 1.25rem;
  opacity: 0.9;
  margin-bottom: 2rem;
  max-width: 700px;
  margin-left: auto;
  margin-right:auto;
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
  transition: all 0.2s ease;
  display: inline-block;
}

.btn-primary {
  background: white;
  color: #1f2937;
}

.btn-primary:hover {
  background: #f3f4f6;
  transform: translateY(-2px);
}

.btn-secondary {
  background: transparent;
  color: white;
  border: 2px solid white;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
}

@media (max-width: 768px) {
  .page-header h1 {
    font-size: 2rem;
  }
  
  .story-section {
    grid-template-columns: 1fr;
  }
  
  .story-content h2 {
    text-align: center;
  }
  
  h2 {
    font-size: 2rem;
  }
  
  .lead {
    font-size: 1.125rem;
  }
}
</style>
