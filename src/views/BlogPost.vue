<template>
  <PublicLayout>
    <article class="mx-auto max-w-3xl px-4 pb-10 pt-10 sm:px-6 lg:px-8">
      <!-- Breadcrumb -->
      <nav class="flex items-center gap-2 text-sm text-ink-faint">
        <router-link to="/blog" class="text-violet">Blog</router-link>
        <span>/</span><span>{{ post.category }}</span>
      </nav>

      <!-- Header -->
      <header class="mt-6 text-center">
        <div class="flex items-center justify-center gap-3 text-sm">
          <span class="cat">{{ post.category }}</span>
          <span class="text-ink-faint">{{ readLabel(post) }}</span>
        </div>
        <h1 class="mt-5 font-display text-4xl font-extrabold leading-tight tracking-tight text-ink">{{ post.title }}</h1>
        <div class="mt-6 flex items-center justify-center gap-3 border-t border-line pt-6">
          <img :src="avatarUrl" alt="" class="h-11 w-11 rounded-full" />
          <div class="text-left">
            <div class="font-semibold text-ink">By {{ post.author || 'AADML Team' }}</div>
            <div class="text-sm text-ink-faint">{{ post.date }}</div>
          </div>
        </div>
      </header>

      <!-- Hero image -->
      <div class="mt-8 h-72 w-full overflow-hidden rounded-2xl" :style="heroBg"></div>

      <!-- Body -->
      <div v-if="loading" class="mt-10 space-y-4">
        <div class="vm-skel h-4 w-full"></div>
        <div class="vm-skel h-4 w-11/12"></div>
        <div class="vm-skel h-4 w-3/4"></div>
      </div>
      <div v-else class="post-body mt-10" v-html="bodyHtml"></div>

      <!-- Footer -->
      <footer class="mt-12 flex flex-col gap-6 border-t border-line pt-8 sm:flex-row sm:items-start sm:justify-between">
        <div v-if="post.tags?.length">
          <h4 class="text-xs font-semibold uppercase tracking-wider text-ink-faint">Tags</h4>
          <div class="mt-3 flex flex-wrap gap-2">
            <span v-for="tag in post.tags" :key="tag" class="tag">#{{ tag }}</span>
          </div>
        </div>
        <div>
          <h4 class="text-xs font-semibold uppercase tracking-wider text-ink-faint">Share</h4>
          <div class="mt-3 flex gap-2">
            <button class="share" title="Copy link" @click="copyLink"><Icon icon="lucide:link" class="h-4 w-4" /></button>
            <a class="share" :href="shareX" target="_blank" rel="noopener" title="Share on X"><Icon icon="lucide:twitter" class="h-4 w-4" /></a>
            <a class="share" :href="shareLinkedIn" target="_blank" rel="noopener" title="Share on LinkedIn"><Icon icon="lucide:linkedin" class="h-4 w-4" /></a>
          </div>
        </div>
      </footer>
    </article>

    <!-- Related -->
    <section v-if="relatedPosts.length" class="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <h3 class="mb-6 font-display text-2xl font-extrabold text-ink">You might also like</h3>
      <div class="grid gap-6 sm:grid-cols-3">
        <router-link v-for="r in relatedPosts" :key="r.slug" :to="`/blog/${r.slug}`" class="rel-card">
          <div class="h-36 w-full" :style="cardBg(r)"></div>
          <div class="p-5">
            <span class="cat">{{ r.category || 'Article' }}</span>
            <h4 class="mt-2 line-clamp-2 font-bold text-ink">{{ r.title }}</h4>
            <p class="mt-1 text-sm text-ink-faint">{{ r.date }}</p>
          </div>
        </router-link>
      </div>
    </section>

    <!-- CTA -->
    <section class="mx-auto max-w-5xl px-4 pb-24 sm:px-6 lg:px-8">
      <div class="cta-box">
        <h2 class="font-display text-3xl font-extrabold text-white">Ready to transform your workflow?</h2>
        <p class="mx-auto mt-3 max-w-lg text-blue-100">Join the developers using AI agents to ship faster.</p>
        <router-link to="/login" class="mt-7 inline-flex rounded-xl bg-white px-7 py-3 font-bold text-violet transition-transform hover:-translate-y-0.5">Get started free</router-link>
      </div>
    </section>
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

const route = useRoute()
const loading = ref(false)
const post = ref({ slug: '', title: 'Loading…', author: '', date: '', readTime: 5, category: '', tags: [], content: '' })
const relatedPosts = ref([])

const bodyHtml = computed(() => post.value.content_html || post.value.content || '')
const heroBg = computed(() => cardBg(post.value))
const avatarUrl = computed(() => `https://ui-avatars.com/api/?name=${encodeURIComponent(post.value.author || 'AADML')}&background=2563EB&color=fff`)
const shareX = computed(() => `https://twitter.com/intent/tweet?url=${encodeURIComponent(currentUrl())}&text=${encodeURIComponent(post.value.title || '')}`)
const shareLinkedIn = computed(() => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(currentUrl())}`)

useMeta({
  title: computed(() => post.value.title ? `${post.value.title} — AADML Blog` : 'Blog — AADML'),
  description: computed(() => post.value.excerpt || 'Insights on AI agents and automation.'),
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
  return { background: p.gradient || p.color || p.hero_gradient || 'linear-gradient(135deg,#2563EB,#14B8A6)' }
}
function readLabel(p) {
  const t = p.readTime
  if (typeof t === 'string') return t.includes('read') ? t : `${t} min read`
  return `${t || 5} min read`
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
.cat {
  display: inline-block; padding: 3px 11px; border-radius: 999px;
  font-size: .7rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
  color: var(--vm-primary); background: var(--vm-primary-soft);
}
.tag {
  padding: 6px 12px; border-radius: 8px; font-size: .85rem;
  color: var(--vm-ink-soft); border: 1px solid var(--vm-border); background: var(--vm-surface);
}
.share {
  display: inline-flex; align-items: center; justify-content: center;
  width: 40px; height: 40px; border-radius: 10px; cursor: pointer;
  color: var(--vm-ink-soft); border: 1px solid var(--vm-border); background: var(--vm-surface);
  transition: all .15s;
}
.share:hover { color: #fff; background: var(--vm-primary); border-color: var(--vm-primary); transform: translateY(-2px); }

.rel-card {
  display: block; overflow: hidden; border-radius: 16px;
  border: 1px solid var(--vm-border); background: var(--vm-surface);
  text-decoration: none; box-shadow: var(--vm-shadow-s);
  transition: transform .2s var(--vm-ease), box-shadow .2s, border-color .2s;
}
.rel-card:hover { transform: translateY(-4px); box-shadow: var(--vm-shadow-m); border-color: rgba(37,99,235,.3); }

.cta-box {
  border-radius: 26px; padding: 56px 32px; text-align: center;
  background: var(--vm-g-multi); box-shadow: var(--vm-shadow-l);
}

/* rendered markdown / html body */
.post-body { font-size: 1.08rem; line-height: 1.85; color: var(--vm-ink-soft); }
.post-body :deep(.lead) { font-size: 1.25rem; color: var(--vm-ink); margin-bottom: 2rem; }
.post-body :deep(h2) { font-size: 1.7rem; font-weight: 800; color: var(--vm-ink); margin: 2.6rem 0 1rem; }
.post-body :deep(h3) { font-size: 1.25rem; font-weight: 700; color: var(--vm-ink); margin: 1.8rem 0 .6rem; }
.post-body :deep(p) { margin-bottom: 1.4rem; }
.post-body :deep(ul), .post-body :deep(ol) { padding-left: 1.4rem; margin-bottom: 1.4rem; }
.post-body :deep(li) { margin-bottom: .6rem; }
.post-body :deep(strong) { color: var(--vm-ink); }
.post-body :deep(a) { color: var(--vm-primary); text-decoration: none; }
.post-body :deep(a:hover) { text-decoration: underline; }
.post-body :deep(blockquote) { border-left: 4px solid var(--vm-primary); background: var(--vm-primary-soft); padding: 1.2rem 1.5rem; margin: 2rem 0; border-radius: 0 12px 12px 0; font-style: italic; color: var(--vm-ink); }
.post-body :deep(code) { background: var(--vm-primary-soft); color: var(--vm-primary-d); padding: .12rem .4rem; border-radius: 5px; font-size: .88em; font-family: 'JetBrains Mono', monospace; }
.post-body :deep(pre) { background: #0d1117; color: #e6edf3; border-radius: 12px; padding: 1.1rem 1.4rem; overflow-x: auto; margin: 1.4rem 0; }
.post-body :deep(pre code) { background: none; color: inherit; padding: 0; }
</style>
