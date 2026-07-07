<template>
  <PublicLayout>
    <div ref="pageRoot" class="page-main">
      <!-- ── Hero + category filter ───────────────────────────────────── -->
      <section class="page-hero" id="top" style="padding-bottom:34px">
        <div class="shell">
          <div class="reveal" style="max-width:760px">
            <div class="section-kicker">The AADML blog</div>
            <h1 style="max-width:14ch">Field notes on <em>governed</em> execution.</h1>
            <p>
              Engineering deep-dives, operating patterns, and lessons from running agents in
              laboratories, public services, infrastructure, and software—where consequences are real.
            </p>
          </div>
          <div class="blog-cats reveal">
            <a href="#" :class="{ on: activeCat === 'All Posts' }" @click.prevent="activeCat = 'All Posts'">All</a>
            <a v-for="c in categories" :key="c" href="#" :class="{ on: activeCat === c }" @click.prevent="activeCat = c">{{ c }}</a>
          </div>
        </div>
      </section>

      <!-- ── Loading skeleton ─────────────────────────────────────────── -->
      <section v-if="loading" class="content-section" style="padding-top:30px">
        <div class="shell">
          <div class="vm-skel" style="height:380px;border-radius:30px"></div>
        </div>
      </section>

      <template v-else>
        <!-- ── Featured post ──────────────────────────────────────────── -->
        <section v-if="featured" class="content-section" style="padding-top:30px">
          <div class="shell">
            <router-link :to="`/blog/${featured.slug}`" class="blog-feature reveal">
              <div class="blog-feature-art" :style="bg(featured)">
                <span class="blog-feature-tag">Featured · {{ featured.category }}</span>
                <div class="blog-feature-orb">{{ orbLabel(featured) }}</div>
              </div>
              <div class="blog-feature-body">
                <div class="section-kicker">{{ featured.category }}</div>
                <h2>{{ featured.title }}</h2>
                <p>{{ featured.excerpt }}</p>
                <div class="blog-meta">
                  <span class="who" :style="avatarBg(featured.author)">{{ initial(featured.author) }}</span>
                  {{ featured.author }}<template v-if="featured.readTime"> · {{ featured.readTime }} min read</template><template v-if="featured.date"> · {{ featured.date }}</template>
                </div>
              </div>
            </router-link>
          </div>
        </section>

        <!-- ── Recent grid ────────────────────────────────────────────── -->
        <section class="content-section soft" style="padding-top:64px">
          <div class="shell">
            <div class="section-head-wide reveal">
              <div><div class="section-kicker">Latest</div><h2>Recent writing.</h2></div>
              <p>Patterns, postmortems, and product notes from the team building the governed execution layer.</p>
            </div>

            <div v-if="rest.length" class="blog-grid stagger">
              <router-link v-for="p in rest" :key="p.slug" :to="`/blog/${p.slug}`" class="post-card">
                <div class="post-art" :style="bg(p)"><span class="post-tag">{{ p.category }}</span><span class="sym">{{ symbolFor(p.category) }}</span></div>
                <div class="post-body">
                  <h3>{{ p.title }}</h3>
                  <p>{{ p.excerpt }}</p>
                  <div class="post-foot"><span class="who" :style="avatarBg(p.author)">{{ initial(p.author) }}</span>{{ p.author }}<template v-if="p.readTime"> · {{ p.readTime }} min</template></div>
                </div>
              </router-link>
            </div>
            <p v-else class="blog-empty">No posts match your filter yet.</p>

            <!-- Pagination -->
            <div v-if="totalPages > 1" class="blog-pager">
              <button v-for="n in pageList" :key="n" class="pg-btn" :class="{ on: n === page }" :disabled="n === '…'" @click="n !== '…' && go(n)">{{ n }}</button>
            </div>
          </div>
        </section>
      </template>

      <!-- ── Newsletter ───────────────────────────────────────────────── -->
      <section class="content-section" style="padding-top:30px">
        <div class="shell">
          <div class="news-band reveal">
            <div>
              <div class="section-kicker" style="color:#9ed8c0">Field notes, monthly</div>
              <h2>Get new writing on governed execution.</h2>
            </div>
            <form class="news-form" @submit.prevent="subscribe">
              <input v-model="email" type="email" placeholder="you@institution.org" aria-label="Email address" required />
              <button class="btn light" type="submit">Subscribe <span>↗</span></button>
            </form>
          </div>
        </div>
      </section>
    </div>
  </PublicLayout>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { blogPosts as staticPosts } from '../data/blogPosts'
import PublicLayout from '../components/public/PublicLayout.vue'
import { useMeta } from '../composables/useMeta'
import { useReveal } from '../composables/useReveal'
import api from '../services/api'
import { notify } from '@/composables/useNotify'

useMeta({
  title: 'Blog — AADML',
  description: 'Field notes on governed execution — engineering deep-dives, operating patterns, and product updates from the AADML team.',
})

const pageRoot = ref(null)
useReveal(pageRoot)

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
    gradient: p.hero_gradient || 'linear-gradient(135deg,var(--blue-2),var(--green-2))', image: p.og_image_url || '',
  }
}
function mapStatic(p) {
  return {
    slug: p.slug, title: p.title, excerpt: p.excerpt, category: p.category || 'Engineering',
    author: p.author, readTime: typeof p.readTime === 'number' ? p.readTime : 6, date: p.date || '',
    gradient: p.gradient || p.color || 'linear-gradient(135deg,var(--blue-2),var(--green-2))', image: p.image || '',
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
function bg(p) {
  if (p.image) return { backgroundImage: `url(${p.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  return { background: p.gradient }
}
function orbLabel(p) {
  // Two short words from the title for the featured orb.
  return (p.title || 'AADML').split(/\s+/).slice(0, 2).join(' ')
}
const SYMBOLS = { Engineering: '◇', Workflows: '⬡', Governance: '§', 'Field report': '↯', 'Field reports': '↯', Product: '↗' }
function symbolFor(cat) { return SYMBOLS[cat] || '§' }
function subscribe() { notify.success(`Subscribed: ${email.value}`); email.value = '' }
</script>

<style scoped>
.page-main { padding-bottom: 40px; }
.blog-empty { text-align: center; color: var(--muted); padding: 40px 0; }

/* Featured card + post cards are router-links; keep them looking like blocks. */
.blog-feature, .post-card { color: inherit; text-decoration: none; cursor: pointer; }

.blog-pager { display: flex; justify-content: center; gap: 8px; margin-top: 36px; }
.pg-btn {
  min-width: 40px; height: 40px; padding: 0 12px;
  border: 1px solid var(--line); border-radius: 12px; background: var(--paper-2);
  font-weight: 800; font-size: 13px; color: #536159; cursor: pointer;
}
.pg-btn:hover:not(:disabled) { border-color: var(--ink); color: var(--ink); }
.pg-btn.on { background: var(--ink); border-color: var(--ink); color: #fff; }
.pg-btn:disabled { cursor: default; opacity: .6; }
</style>
