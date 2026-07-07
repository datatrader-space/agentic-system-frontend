<template>
  <PublicLayout>
    <div class="shell page-main">
      <article class="post-article">
        <!-- Header -->
        <nav class="crumb">
          <router-link to="/blog">Blog</router-link>
          <span aria-hidden="true">›</span>
          <span>{{ post.category }}</span>
        </nav>
        <div class="post-cat-line">
          <span class="cat">{{ post.category }}</span>
          <span class="dim">{{ readLabel(post) }}</span>
        </div>
        <h1 class="post-title">{{ post.title }}</h1>
        <div class="post-author">
          <span class="who" :style="avatarStyle">{{ initial(post.author) }}</span>
          <div>
            <div class="who-name">By {{ post.author || 'AADML Team' }}</div>
            <div class="who-date">{{ post.date }}</div>
          </div>
        </div>

        <!-- Hero image -->
        <div class="post-hero" :style="heroBg"></div>

        <!-- Body -->
        <div v-if="loading" class="mt-10 space-y-4">
          <div class="vm-skel h-4 w-full"></div>
          <div class="vm-skel h-4 w-11/12"></div>
          <div class="vm-skel h-4 w-3/4"></div>
        </div>
        <div v-else class="post-body" v-html="bodyHtml"></div>

        <!-- Footer -->
        <footer class="post-foot-bar">
          <div v-if="post.tags?.length">
            <h4>Tags</h4>
            <div class="tag-row">
              <span v-for="tag in post.tags" :key="tag" class="tag">#{{ tag }}</span>
            </div>
          </div>
          <div>
            <h4>Share</h4>
            <div class="share-row">
              <button class="share" title="Copy link" @click="copyLink"><Icon icon="lucide:link" class="h-4 w-4" /></button>
              <a class="share" :href="shareX" target="_blank" rel="noopener" title="Share on X"><Icon icon="lucide:twitter" class="h-4 w-4" /></a>
              <a class="share" :href="shareLinkedIn" target="_blank" rel="noopener" title="Share on LinkedIn"><Icon icon="lucide:linkedin" class="h-4 w-4" /></a>
            </div>
          </div>
        </footer>
      </article>

      <!-- Related -->
      <section v-if="relatedPosts.length" class="related">
        <h3 class="related-title">You might also like</h3>
        <div class="blog-grid">
          <router-link v-for="r in relatedPosts" :key="r.slug" :to="`/blog/${r.slug}`" class="post-card">
            <div class="post-art" :style="cardBg(r)"><span class="post-tag">{{ r.category || 'Article' }}</span></div>
            <div class="post-body-card">
              <h3>{{ r.title }}</h3>
              <p class="dim">{{ r.date }}</p>
            </div>
          </router-link>
        </div>
      </section>

      <!-- CTA -->
      <section class="cta" style="padding:40px 0 90px">
        <div class="cta-panel">
          <div><h2>Ready to transform your workflow?</h2></div>
          <div class="cta-copy">
            <p>Join the teams using governed AI agents to ship faster—code-aware, context-aware, and cost-aware.</p>
            <div class="cta-actions">
              <router-link to="/login" class="btn light">Get started free <span>↗</span></router-link>
            </div>
          </div>
        </div>
      </section>
    </div>
  </PublicLayout>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import { blogPosts as allPosts } from '../data/blogPosts'
import PublicLayout from '../components/public/PublicLayout.vue'
import { useMeta } from '../composables/useMeta'
import api from '../services/api'
import { notify } from '@/composables/useNotify'
import { setBreadcrumbLabel } from '@/composables/useBreadcrumbs'

const route = useRoute()
const loading = ref(false)
const post = ref({ slug: '', title: 'Loading…', author: '', date: '', readTime: 5, category: '', tags: [], content: '' })
const relatedPosts = ref([])

setBreadcrumbLabel(() => post.value?.title)

const bodyHtml = computed(() => post.value.content_html || post.value.content || '')
const heroBg = computed(() => cardBg(post.value))
const avatarStyle = computed(() => avatarBg(post.value.author))
const shareX = computed(() => `https://twitter.com/intent/tweet?url=${encodeURIComponent(currentUrl())}&text=${encodeURIComponent(post.value.title || '')}`)
const shareLinkedIn = computed(() => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(currentUrl())}`)

useMeta({
  title: computed(() => post.value.title ? `${post.value.title} — AADML Blog` : 'Blog — AADML'),
  description: computed(() => post.value.excerpt || 'Field notes on governed execution.'),
  ogType: 'article',
  image: computed(() => post.value.image || post.value.og_image_url || ''),
  jsonLd: computed(() => ({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.value.title,
    author: { '@type': 'Person', name: post.value.author || 'AADML Team' },
    datePublished: post.value.published_at || undefined,
  })),
})

function currentUrl() { return typeof window !== 'undefined' ? window.location.href : '' }
function cardBg(p) {
  if (!p) return {}
  if (p.image || p.og_image_url) return { backgroundImage: `url(${p.image || p.og_image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  return { background: p.gradient || p.color || p.hero_gradient || 'linear-gradient(135deg,var(--blue-2),var(--green-2))' }
}
function readLabel(p) {
  const t = p.readTime
  if (typeof t === 'string') return t.includes('read') ? t : `${t} min read`
  return `${t || 5} min read`
}
function initial(name) { return (name || 'A').trim().charAt(0).toUpperCase() }
function avatarBg(name) {
  const pairs = [
    { background: 'var(--green-2)', color: 'var(--green)' },
    { background: 'var(--blue-2)', color: 'var(--blue)' },
    { background: 'var(--red-2)', color: 'var(--red)' },
    { background: 'var(--amber-2)', color: '#8b5b14' },
    { background: 'var(--violet-2)', color: 'var(--violet)' },
  ]
  const h = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return pairs[h % pairs.length]
}

async function loadPost() {
  const slug = route.params.slug
  const fallback = allPosts.find(p => p.slug === slug)
  if (fallback) post.value = fallback
  relatedPosts.value = allPosts.filter(p => p.slug !== slug).slice(0, 3)
  window.scrollTo({ top: 0, behavior: 'smooth' })

  // Prefer live CMS content when available
  try {
    loading.value = !fallback
    const { data } = await api.get(`/content/pages/${slug}/`)
    if (data.page) {
      const p = data.page
      post.value = {
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        author: p.author || 'AADML Team',
        category: p.category || 'Article',
        date: p.published_at ? new Date(p.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : (fallback?.date || ''),
        published_at: p.published_at,
        readTime: p.read_time_minutes || 5,
        tags: p.tags || fallback?.tags || [],
        content_html: p.content_html,
        hero_gradient: p.hero_gradient,
        og_image_url: p.og_image_url,
      }
    }
  } catch (e) {
    console.debug('BlogPost: using static fallback', e.message)
  } finally {
    loading.value = false
  }
}

function copyLink() {
  navigator.clipboard?.writeText(currentUrl())
  notify.success('Link copied')
}

watch(() => route.params.slug, loadPost)
onMounted(loadPost)
</script>

<style scoped>
.page-main { padding-bottom: 20px; }
.post-article { max-width: 780px; margin: 0 auto; padding: 30px 0 20px; }

.crumb { display: flex; align-items: center; gap: 8px; font-size: .8rem; color: var(--muted); margin-bottom: 22px; }
.crumb a { color: var(--muted); text-decoration: none; }
.crumb a:hover { color: var(--blue); }

.post-cat-line { display: flex; align-items: center; gap: 12px; }
.cat { font: 800 10px var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--green); }
.dim { color: var(--muted); font-size: .85rem; }

.post-title { font-family: var(--serif); font-weight: 500; font-size: clamp(36px, 5vw, 62px); line-height: 1.02; letter-spacing: -.035em; color: var(--ink); margin: 14px 0 24px; }

.post-author { display: flex; align-items: center; gap: 12px; border-top: 1px solid var(--line); padding-top: 22px; }
.who { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; font: 800 14px var(--mono); }
.who-name { font-weight: 700; color: var(--ink); }
.who-date { font-size: .85rem; color: var(--muted); }

.post-hero { margin-top: 26px; height: 300px; width: 100%; border-radius: 24px; border: 1px solid var(--line); overflow: hidden; }

/* Rendered article body */
.post-body { margin-top: 34px; font-size: 1.08rem; line-height: 1.85; color: #3a4a43; }
.post-body :deep(.lead) { font-size: 1.25rem; color: var(--ink); margin-bottom: 2rem; }
.post-body :deep(h2) { font-family: var(--serif); font-weight: 500; font-size: 1.9rem; letter-spacing: -.02em; color: var(--ink); margin: 2.6rem 0 1rem; }
.post-body :deep(h3) { font-size: 1.25rem; font-weight: 800; color: var(--ink); margin: 1.8rem 0 .6rem; }
.post-body :deep(p) { margin-bottom: 1.1rem; }
.post-body :deep(ul), .post-body :deep(ol) { padding-left: 1.4rem; margin-bottom: 1.1rem; }
.post-body :deep(li) { margin-bottom: .5rem; }
.post-body :deep(strong) { color: var(--ink); }
.post-body :deep(a) { color: var(--blue); text-decoration: none; }
.post-body :deep(a:hover) { text-decoration: underline; }
.post-body :deep(blockquote) { border-left: 4px solid var(--blue); background: var(--blue-2); padding: 1.2rem 1.5rem; margin: 2rem 0; border-radius: 0 12px 12px 0; font-style: italic; color: var(--ink); }
.post-body :deep(code) { background: var(--blue-2); color: var(--blue); padding: .12rem .4rem; border-radius: 5px; font-size: .88em; font-family: var(--mono); }
.post-body :deep(pre) { background: #0d1117; color: #e6edf3; padding: 16px 18px; border-radius: 14px; overflow-x: auto; margin: 1.4rem 0; }
.post-body :deep(pre code) { background: none; color: inherit; padding: 0; }
.post-body :deep(img) { max-width: 100%; border-radius: 14px; margin: 1.4rem 0; }

.post-foot-bar { margin-top: 40px; display: flex; flex-wrap: wrap; gap: 28px; justify-content: space-between; border-top: 1px solid var(--line); padding-top: 26px; }
.post-foot-bar h4 { font: 800 10px var(--mono); letter-spacing: .12em; text-transform: uppercase; color: var(--muted); margin: 0 0 12px; }
.tag-row { display: flex; flex-wrap: wrap; gap: 8px; }
.tag { border: 1px solid var(--line); border-radius: 999px; padding: 6px 12px; font-size: 12px; font-weight: 700; color: #536159; background: var(--paper-2); }
.share-row { display: flex; gap: 8px; }
.share {
  display: grid; place-items: center; width: 38px; height: 38px; border-radius: 11px;
  color: var(--muted); border: 1px solid var(--line); background: var(--paper-2);
  cursor: pointer; transition: transform .2s ease, background .2s, color .2s, border-color .2s;
}
.share:hover { color: #fff; background: var(--ink); border-color: var(--ink); transform: translateY(-2px); }

/* Related */
.related { padding: 20px 0 10px; }
.related-title { font-family: var(--serif); font-weight: 500; font-size: 2rem; letter-spacing: -.02em; color: var(--ink); margin: 0 0 24px; }
.post-card { color: inherit; text-decoration: none; }
.post-body-card { padding: 18px 20px 22px; }
.post-body-card h3 { font-family: var(--serif); font-weight: 500; font-size: 20px; line-height: 1.15; color: var(--ink); margin: 0 0 6px; }
</style>
