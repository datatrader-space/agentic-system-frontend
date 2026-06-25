<template>
  <PublicLayout>
    <!-- Hero -->
    <section class="relative overflow-hidden">
      <HeroBackdrop />
      <div class="relative z-10 mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8 lg:pt-24">
      <div class="grid items-start gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div v-reveal>
          <div class="eyebrow">Engineering Journal</div>
          <h1 class="hero-title">Thoughts on the <span class="vm-grad-text">agentic era</span>.</h1>
          <p class="hero-sub">In-depth technical analysis, product updates, and philosophical musings on the future of autonomous systems and developer workflows.</p>
        </div>
        <div v-reveal class="lg:pt-10">
          <div class="search">
            <Icon icon="lucide:search" class="h-4 w-4 text-ink-faint" />
            <input v-model="query" type="text" placeholder="Search articles…" />
          </div>
        </div>
      </div>
      <div class="mt-8 border-b border-line"></div>
      </div>
    </section>

    <!-- Body -->
    <section class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
      <div v-if="loading" class="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div class="vm-skel h-80 rounded-2xl"></div>
        <div class="vm-skel h-80 rounded-2xl"></div>
      </div>

      <div v-else-if="!filtered.length" class="py-20 text-center text-ink-soft">No articles found.</div>

      <div v-else class="blog-grid">
        <!-- Featured -->
        <router-link v-if="featured" :to="`/blog/${featured.slug}`" class="featured" v-reveal>
          <div class="featured-img" :style="bg(featured)"></div>
          <div class="featured-body">
            <div class="meta-row">
              <span class="cat">{{ featured.category }}</span>
              <span class="muted">{{ featured.readTime }} min read</span>
            </div>
            <h2 class="featured-title">{{ featured.title }}</h2>
            <p class="featured-excerpt">{{ featured.excerpt }}</p>
            <div class="author">
              <span class="avatar" :style="avatarBg(featured.author)">{{ initial(featured.author) }}</span>
              <div><div class="a-name">{{ featured.author || 'AADML Team' }}</div><div class="a-role">Author</div></div>
            </div>
          </div>
        </router-link>

        <!-- Sidebar -->
        <aside class="aside" v-reveal>
          <div class="card">
            <h3>Categories</h3>
            <div class="chips">
              <button class="chip" :class="{ active: activeCat === 'All Posts' }" @click="activeCat = 'All Posts'">All Posts</button>
              <button v-for="c in categories" :key="c" class="chip" :class="{ active: activeCat === c }" @click="activeCat = c">{{ c }}</button>
            </div>
          </div>

          <div class="protocol">
            <h3>The Protocol</h3>
            <p>Get bi-weekly updates on agentic workflows and platform updates delivered to your inbox.</p>
            <form @submit.prevent="subscribe">
              <input v-model="email" type="email" required placeholder="email@example.com" class="p-input" />
              <button type="submit" class="p-btn">Subscribe</button>
            </form>
          </div>
        </aside>

        <!-- Card grid -->
        <div class="cards">
          <router-link v-for="post in rest" :key="post.slug" :to="`/blog/${post.slug}`" class="post-card" v-reveal>
            <div class="card-img" :style="bg(post)"></div>
            <div class="card-body">
              <span class="cat-label">{{ post.category }}</span>
              <h3 class="card-title">{{ post.title }}</h3>
              <p class="card-excerpt">{{ post.excerpt }}</p>
              <div class="card-foot">
                <span class="author sm">
                  <span class="avatar sm" :style="avatarBg(post.author)">{{ initial(post.author) }}</span>
                  <span class="a-name">{{ post.author || 'AADML' }}</span>
                </span>
                <span class="muted">{{ post.date }}</span>
              </div>
            </div>
          </router-link>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="pager">
          <button class="pg-arrow" :disabled="page === 1" @click="go(page - 1)"><Icon icon="lucide:chevron-left" class="h-4 w-4" /></button>
          <button v-for="n in pageList" :key="n" class="pg" :class="{ active: n === page, dots: n === '…' }" :disabled="n === '…'" @click="n !== '…' && go(n)">{{ n }}</button>
          <button class="pg-arrow" :disabled="page === totalPages" @click="go(page + 1)"><Icon icon="lucide:chevron-right" class="h-4 w-4" /></button>
        </div>
      </div>
    </section>
  </PublicLayout>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { blogPosts as staticPosts } from '../data/blogPosts'
import { Icon } from '@iconify/vue'
import PublicLayout from '../components/public/PublicLayout.vue'
import HeroBackdrop from '../components/public/HeroBackdrop.vue'
import { useMeta } from '../composables/useMeta'
import api from '../services/api'
import { notify } from '@/composables/useNotify'

useMeta({
  title: 'Blog — AADML',
  description: 'Thoughts on the agentic era — technical analysis, product updates, and the future of autonomous developer workflows.',
})

const PAGE_SIZE = 7
const loading = ref(true)
const posts = ref([])
const query = ref('')
const activeCat = ref('All Posts')
const page = ref(1)
const email = ref('')

onMounted(async () => {
  try {
    const { data } = await api.get('/content/pages/', { params: { type: 'blog', published: 'true' } })
    if (data.pages && data.pages.length) {
      posts.value = data.pages.map(mapApi)
    } else {
      posts.value = staticPosts.map(mapStatic)
    }
  } catch (e) {
    posts.value = staticPosts.map(mapStatic)
  } finally {
    loading.value = false
  }
})

function mapApi(p) {
  return {
    slug: p.slug, title: p.title, excerpt: p.excerpt, category: p.category || 'Engineering',
    author: p.author, readTime: p.read_time_minutes || 5,
    date: p.published_at ? new Date(p.published_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '',
    gradient: p.hero_gradient || 'linear-gradient(135deg,#2563EB,#14B8A6)', image: p.og_image_url || '',
  }
}
function mapStatic(p) {
  return {
    slug: p.slug, title: p.title, excerpt: p.excerpt, category: p.category || 'Engineering',
    author: p.author, readTime: typeof p.readTime === 'number' ? p.readTime : 6, date: p.date || '',
    gradient: p.gradient || p.color || 'linear-gradient(135deg,#2563EB,#14B8A6)', image: p.image || '',
  }
}

const categories = computed(() => {
  const set = new Set()
  posts.value.forEach(p => p.category && set.add(p.category))
  return [...set].slice(0, 6)
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return posts.value.filter(p => {
    if (activeCat.value !== 'All Posts' && p.category !== activeCat.value) return false
    if (q && !(`${p.title} ${p.excerpt}`.toLowerCase().includes(q))) return false
    return true
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const pageItems = computed(() => filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
const featured = computed(() => pageItems.value[0] || null)
const rest = computed(() => pageItems.value.slice(1))

const pageList = computed(() => {
  const t = totalPages.value
  if (t <= 5) return Array.from({ length: t }, (_, i) => i + 1)
  const list = [1]
  if (page.value > 3) list.push('…')
  for (let n = Math.max(2, page.value - 1); n <= Math.min(t - 1, page.value + 1); n++) list.push(n)
  if (page.value < t - 2) list.push('…')
  list.push(t)
  return list
})

function go(n) { page.value = n; window.scrollTo({ top: 0, behavior: 'smooth' }) }
watch([query, activeCat], () => { page.value = 1 })

function initial(name) { return (name || 'A').trim().charAt(0).toUpperCase() }
function avatarBg(name) {
  const hues = ['#2563EB', '#14B8A6', '#7c3aed', '#0891b2', '#1e40af']
  const h = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return { background: hues[h % hues.length] }
}
function bg(p) {
  if (p.image) return { backgroundImage: `url(${p.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  return { background: p.gradient }
}
function subscribe() { notify.success(`Subscribed: ${email.value}`); email.value = '' }
</script>

<style scoped>
.eyebrow { font-size: .8rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--vm-primary); }
.hero-title { margin-top: 12px; font-family: var(--vm-font-display); font-size: clamp(2.2rem, 5vw, 3.4rem); font-weight: 800; letter-spacing: -.02em; color: var(--vm-ink); line-height: 1.05; }
.hero-sub { margin-top: 16px; max-width: 560px; font-size: 1.02rem; line-height: 1.65; color: var(--vm-ink-soft); }
.search { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 12px; border: 1px solid var(--vm-border); background: var(--vm-surface); box-shadow: var(--vm-shadow-s); }
.search input { flex: 1; border: none; outline: none; background: transparent; font-size: .92rem; color: var(--vm-ink); }

.blog-grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 28px; align-items: start; }
.muted { color: var(--vm-ink-faint); font-size: .8rem; }
.cat { display: inline-block; padding: 4px 10px; border-radius: 7px; font-size: .68rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--vm-primary); background: var(--vm-primary-soft); }
.cat-label { font-size: .7rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--vm-primary); }

/* Featured */
.featured { grid-column: 1; display: grid; grid-template-columns: 1fr 1fr; overflow: hidden; border-radius: 20px; border: 1px solid var(--vm-border); background: var(--vm-surface); box-shadow: var(--vm-shadow-s); text-decoration: none; transition: transform .2s var(--vm-ease), box-shadow .2s, border-color .2s; }
.featured:hover { transform: translateY(-3px); box-shadow: var(--vm-shadow-m); border-color: rgba(37,99,235,.3); }
.featured-img { min-height: 340px; }
.featured-body { padding: 30px; display: flex; flex-direction: column; }
.meta-row { display: flex; align-items: center; gap: 12px; }
.featured-title { margin-top: 16px; font-family: var(--vm-font-display); font-size: 1.7rem; font-weight: 800; line-height: 1.15; color: var(--vm-ink); }
.featured-excerpt { margin-top: 12px; color: var(--vm-ink-soft); line-height: 1.6; flex: 1; }
.author { display: flex; align-items: center; gap: 10px; margin-top: 22px; }
.author.sm { margin-top: 0; gap: 8px; }
.avatar { display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 50%; color: #fff; font-weight: 700; font-size: .9rem; }
.avatar.sm { width: 26px; height: 26px; font-size: .72rem; }
.a-name { font-weight: 600; font-size: .85rem; color: var(--vm-ink); }
.a-role { font-size: .76rem; color: var(--vm-ink-faint); }

/* Sidebar */
.aside { grid-column: 2; grid-row: 1; display: flex; flex-direction: column; gap: 22px; }
.card { border: 1px solid var(--vm-border); border-radius: 18px; background: var(--vm-surface); padding: 24px; box-shadow: var(--vm-shadow-s); }
.card h3 { font-size: 1.25rem; font-weight: 800; color: var(--vm-ink); }
.chips { margin-top: 16px; display: flex; flex-wrap: wrap; gap: 10px; }
.chip { padding: 8px 16px; border-radius: 999px; border: none; font-size: .82rem; font-weight: 600; color: var(--vm-ink-soft); background: var(--vm-surface-soft); cursor: pointer; transition: background .15s, color .15s; }
.chip.active { color: #fff; background: var(--vm-primary); }
.chip:hover:not(.active) { background: #e2e8f0; }

.protocol { border-radius: 18px; padding: 24px; color: #fff; background: var(--vm-g-brand); box-shadow: var(--vm-glow-p); position: relative; overflow: hidden; }
.protocol h3 { font-size: 1.3rem; font-weight: 800; }
.protocol p { margin-top: 10px; font-size: .88rem; line-height: 1.55; color: rgba(255,255,255,.85); }
.p-input { width: 100%; margin-top: 16px; padding: 11px 14px; border-radius: 10px; border: none; background: rgba(255,255,255,.18); color: #fff; outline: none; font-size: .88rem; }
.p-input::placeholder { color: rgba(255,255,255,.7); }
.p-btn { width: 100%; margin-top: 10px; padding: 11px; border-radius: 10px; border: none; font-weight: 700; color: var(--vm-primary); background: #fff; cursor: pointer; }

/* Card grid */
.cards { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 8px; }
.post-card { display: flex; flex-direction: column; overflow: hidden; border-radius: 16px; border: 1px solid var(--vm-border); background: var(--vm-surface); box-shadow: var(--vm-shadow-s); text-decoration: none; transition: transform .2s var(--vm-ease), box-shadow .2s, border-color .2s; }
.post-card:hover { transform: translateY(-4px); box-shadow: var(--vm-shadow-m); border-color: rgba(37,99,235,.3); }
.card-img { height: 180px; }
.card-body { padding: 20px; display: flex; flex-direction: column; flex: 1; }
.card-title { margin-top: 8px; font-size: 1.1rem; font-weight: 700; line-height: 1.3; color: var(--vm-ink); }
.card-excerpt { margin-top: 8px; font-size: .85rem; line-height: 1.55; color: var(--vm-ink-soft); flex: 1; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.card-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 16px; }

/* Pagination */
.pager { grid-column: 1 / -1; display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 36px; }
.pg, .pg-arrow { min-width: 40px; height: 40px; padding: 0 10px; border-radius: 11px; border: 1px solid var(--vm-border); background: var(--vm-surface); color: var(--vm-ink-soft); font-weight: 600; font-size: .88rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
.pg.active { background: var(--vm-primary); color: #fff; border-color: transparent; }
.pg.dots { border: none; background: none; cursor: default; }
.pg-arrow:disabled { opacity: .4; cursor: not-allowed; }

@media (max-width: 1023px) {
  .blog-grid { grid-template-columns: 1fr; }
  .aside { grid-column: 1; grid-row: auto; flex-direction: row; flex-wrap: wrap; }
  .aside .card, .aside .protocol { flex: 1; min-width: 260px; }
  .featured { grid-column: 1; }
  .cards { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
  .featured { grid-template-columns: 1fr; }
  .featured-img { min-height: 200px; }
  .cards { grid-template-columns: 1fr; }
}
</style>
