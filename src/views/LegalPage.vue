<template>
  <PublicLayout>
    <div class="legal-shell">
      <!-- ── Article ── -->
      <main class="legal-main">
        <!-- Loading -->
        <div v-if="loading" class="space-y-4 py-6">
          <div class="vm-skel h-9 w-2/5"></div>
          <div class="vm-skel h-4 w-1/4"></div>
          <div class="vm-skel h-4 w-4/5"></div>
          <div class="vm-skel h-4 w-3/5"></div>
          <div class="vm-skel h-4 w-4/6"></div>
        </div>

        <!-- Not published / unknown slug -->
        <div v-else-if="!doc" class="missing">
          <Icon icon="lucide:file-question" class="mx-auto h-12 w-12 text-ink-faint" />
          <h2>{{ error || 'Document not available' }}</h2>
          <p>
            This legal document hasn’t been published yet. If you need it, email
            <a href="mailto:privacy@aadml.com" class="text-violet font-semibold">privacy@aadml.com</a>
            and we’ll send you a copy.
          </p>
          <router-link to="/" class="text-violet font-semibold">← Back to home</router-link>
        </div>

        <!-- Document -->
        <article v-else class="legal-article">
          <span class="legal-eyebrow">{{ doc.category || 'Legal' }}</span>
          <h1 class="legal-title">{{ doc.title }}</h1>
          <p v-if="doc.excerpt" class="legal-lead">{{ doc.excerpt }}</p>

          <div class="legal-dates">
            <span v-if="doc.last_updated" class="legal-pill">
              <Icon icon="lucide:history" class="h-3.5 w-3.5" /> Last updated {{ formatDate(doc.last_updated) }}
            </span>
            <span v-if="doc.effective_date" class="legal-pill">
              <Icon icon="lucide:calendar-check" class="h-3.5 w-3.5" /> Effective {{ formatDate(doc.effective_date) }}
            </span>
          </div>

          <div ref="bodyEl" class="legal-body" v-html="doc.content_html || ''"></div>

          <!-- Other legal documents -->
          <div v-if="siblings.length" class="legal-more">
            <div class="legal-more-label">Other legal documents</div>
            <div class="legal-more-grid">
              <router-link
                v-for="s in siblings"
                :key="s.slug"
                :to="`/legal/${s.slug}`"
                class="legal-more-card"
              >
                <span class="legal-more-title">{{ s.title }}</span>
                <span v-if="s.excerpt" class="legal-more-desc">{{ s.excerpt }}</span>
              </router-link>
            </div>
          </div>
        </article>
      </main>

      <!-- ── On this page ── -->
      <aside v-if="doc && toc.length" class="legal-toc">
        <div class="toc-sticky">
          <div class="toc-label">On this page</div>
          <ul class="toc-list">
            <li v-for="h in toc" :key="h.id" :class="{ sub: h.level === 3, active: activeId === h.id }">
              <a :href="`#${h.id}`" @click.prevent="scrollTo(h.id)">{{ h.text }}</a>
            </li>
          </ul>
          <div class="toc-contact">
            <Icon icon="lucide:mail" class="h-4 w-4 text-violet" />
            <span>Privacy questions? <a href="mailto:privacy@aadml.com">privacy@aadml.com</a></span>
          </div>
        </div>
      </aside>
    </div>
  </PublicLayout>
</template>

<script setup>
/**
 * LegalPage — one component for every backend-managed legal document.
 *
 * The body is authored in the CMS (ContentPage, page_type='legal') and served by
 * GET /api/legal/documents/<slug>/, so legal text can be amended without a frontend
 * deploy. The slug comes from route.meta.legalSlug for the permanent short URLs
 * (/privacy) and from route.params.slug for the generic /legal/:slug route.
 */
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import PublicLayout from '../components/public/PublicLayout.vue'
import { useMeta } from '../composables/useMeta'
import { setBreadcrumbLabel } from '@/composables/useBreadcrumbs'
import api from '../services/api'

const route = useRoute()
const doc = ref(null)
const siblings = ref([])
const loading = ref(true)
const error = ref('')
const bodyEl = ref(null)
const toc = ref([])
const activeId = ref('')
let scrollHost = null

const slug = computed(() => route.meta.legalSlug || route.params.slug || 'privacy-policy')

useMeta({
  title: () => (doc.value ? `${doc.value.meta_title || doc.value.title} — AADML` : 'Legal — AADML'),
  description: () => doc.value?.meta_description || doc.value?.excerpt,
})
setBreadcrumbLabel(() => doc.value?.title)

async function load(target) {
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get(`/legal/documents/${target}/`)
    doc.value = data.document
    siblings.value = data.siblings || []
  } catch (e) {
    doc.value = null
    siblings.value = []
    error.value = e?.response?.status === 404 ? 'Document not found' : 'Could not load this document'
  } finally {
    loading.value = false
    await nextTick()
    buildToc()
  }
}

function slugify(t) {
  return (t || '').toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
}

/** Give every heading a stable id (markdown's toc extension may already have) and index it. */
function buildToc() {
  const root = bodyEl.value
  if (!root) { toc.value = []; return }
  const seen = new Set()
  toc.value = Array.from(root.querySelectorAll('h2, h3')).map((h) => {
    let id = h.id || slugify(h.textContent)
    while (!id || seen.has(id)) id = `${id || 'section'}-${seen.size}`
    seen.add(id)
    h.id = id
    return { id, text: h.textContent, level: h.tagName === 'H3' ? 3 : 2 }
  })
}

/** PublicLayout owns the scroll container (body is overflow:hidden), so scroll THAT. */
function host() {
  if (!scrollHost) scrollHost = document.querySelector('.public-shell')
  return scrollHost
}

function scrollTo(id) {
  const el = document.getElementById(id)
  const container = host()
  if (!el) return
  if (container) container.scrollTo({ top: el.offsetTop - 90, behavior: 'smooth' })
  else el.scrollIntoView({ behavior: 'smooth' })
  activeId.value = id
}

function onScroll() {
  const container = host()
  const top = (container?.scrollTop || 0) + 120
  let current = ''
  for (const h of toc.value) {
    const el = document.getElementById(h.id)
    if (el && el.offsetTop <= top) current = h.id
  }
  activeId.value = current
}

function formatDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

onMounted(async () => {
  await load(slug.value)
  host()?.addEventListener('scroll', onScroll, { passive: true })
})
onUnmounted(() => host()?.removeEventListener('scroll', onScroll))

watch(slug, async (next) => {
  if (!next) return
  await load(next)
  host()?.scrollTo({ top: 0 })
})
</script>

<style scoped>
.legal-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 40px;
  max-width: 80rem;
  margin: 0 auto;
  padding: 32px 16px 72px;
}
@media (min-width: 1024px) {
  .legal-shell { grid-template-columns: minmax(0, 1fr) 260px; padding: 40px 32px 96px; }
}

.legal-main { min-width: 0; }
.legal-article { max-width: 46rem; }

.legal-eyebrow {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 999px;
  background: var(--vm-primary-soft);
  color: var(--vm-primary);
  font-size: .72rem;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.legal-title {
  margin: 16px 0 0;
  font-family: var(--vm-font-display, inherit);
  font-size: clamp(2rem, 4vw, 2.75rem);
  font-weight: 800;
  letter-spacing: -.02em;
  color: var(--vm-ink);
}
.legal-lead { margin-top: 12px; font-size: 1.05rem; line-height: 1.65; color: var(--vm-ink-soft); }

.legal-dates { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
.legal-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--vm-border);
  border-radius: 999px;
  background: var(--vm-surface);
  font-size: .78rem;
  font-weight: 600;
  color: var(--vm-ink-soft);
}

/* ── Rendered markdown ── */
.legal-body { margin-top: 32px; color: var(--vm-ink-soft); font-size: .97rem; line-height: 1.75; }
.legal-body :deep(h2) {
  margin: 40px 0 12px;
  padding-top: 8px;
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: -.01em;
  color: var(--vm-ink);
  scroll-margin-top: 90px;
}
.legal-body :deep(h3) {
  margin: 28px 0 8px;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--vm-ink);
  scroll-margin-top: 90px;
}
.legal-body :deep(p) { margin: 14px 0; }
.legal-body :deep(ul), .legal-body :deep(ol) { margin: 14px 0; padding-left: 22px; list-style: disc; }
.legal-body :deep(ol) { list-style: decimal; }
.legal-body :deep(li) { margin: 7px 0; }
.legal-body :deep(strong) { color: var(--vm-ink); font-weight: 650; }
.legal-body :deep(a) { color: var(--vm-primary); text-decoration: underline; text-underline-offset: 2px; }
.legal-body :deep(table) { width: 100%; margin: 18px 0; border-collapse: collapse; font-size: .9rem; }
.legal-body :deep(th), .legal-body :deep(td) {
  padding: 10px 12px; border: 1px solid var(--vm-border); text-align: left;
}
.legal-body :deep(th) { background: var(--vm-surface-soft); color: var(--vm-ink); font-weight: 600; }
.legal-body :deep(blockquote) {
  margin: 18px 0; padding: 2px 16px; border-left: 3px solid var(--vm-border); color: var(--vm-ink-faint);
}

/* ── Other documents ── */
.legal-more { margin-top: 56px; padding-top: 28px; border-top: 1px solid var(--vm-border); }
.legal-more-label {
  font-size: .72rem; font-weight: 700; letter-spacing: .08em;
  text-transform: uppercase; color: var(--vm-ink-faint);
}
.legal-more-grid { display: grid; gap: 12px; margin-top: 14px; }
@media (min-width: 640px) { .legal-more-grid { grid-template-columns: 1fr 1fr; } }
.legal-more-card {
  display: block;
  padding: 16px;
  border: 1px solid var(--vm-border);
  border-radius: 14px;
  background: var(--vm-surface);
  text-decoration: none;
  transition: border-color .15s, transform .15s, box-shadow .15s;
}
.legal-more-card:hover {
  border-color: var(--vm-primary);
  transform: translateY(-1px);
  box-shadow: var(--vm-shadow-s);
}
.legal-more-title { display: block; font-weight: 650; color: var(--vm-ink); }
.legal-more-desc {
  display: block; margin-top: 4px; font-size: .84rem; line-height: 1.5; color: var(--vm-ink-faint);
}

/* ── TOC ── */
.legal-toc { display: none; }
@media (min-width: 1024px) { .legal-toc { display: block; } }
.toc-sticky { position: sticky; top: 90px; }
.toc-label {
  font-size: .72rem; font-weight: 700; letter-spacing: .08em;
  text-transform: uppercase; color: var(--vm-ink-faint);
}
.toc-list { margin-top: 12px; border-left: 1px solid var(--vm-border); }
.toc-list li { list-style: none; }
.toc-list li a {
  display: block;
  padding: 6px 0 6px 14px;
  margin-left: -1px;
  border-left: 2px solid transparent;
  font-size: .84rem;
  line-height: 1.45;
  color: var(--vm-ink-faint);
  text-decoration: none;
  transition: color .15s, border-color .15s;
}
.toc-list li.sub a { padding-left: 26px; font-size: .8rem; }
.toc-list li a:hover { color: var(--vm-ink); }
.toc-list li.active a { color: var(--vm-primary); border-left-color: var(--vm-primary); font-weight: 600; }

.toc-contact {
  display: flex;
  gap: 8px;
  margin-top: 24px;
  padding: 14px;
  border: 1px solid var(--vm-border);
  border-radius: 14px;
  background: var(--vm-surface);
  font-size: .82rem;
  line-height: 1.5;
  color: var(--vm-ink-soft);
}
.toc-contact a { color: var(--vm-primary); text-decoration: none; font-weight: 600; }

/* ── Empty state ── */
.missing { padding: 64px 0; text-align: center; }
.missing h2 { margin-top: 16px; font-size: 1.4rem; font-weight: 700; color: var(--vm-ink); }
.missing p { margin: 10px auto 18px; max-width: 32rem; color: var(--vm-ink-soft); line-height: 1.6; }
</style>
