<template>
  <main class="ht-page">
    <section class="ht-main">
      <header class="ht-hero">
        <div>
          <span class="ht-kicker"><Icon icon="lucide:layers-3" /> Help library</span>
          <h1>{{ activeArea || 'Explore help topics' }}</h1>
          <p>Find the right guide, troubleshooting note, or best practice for every part of Aadml.</p>
        </div>
        <div class="ht-search">
          <Icon icon="lucide:search" />
          <input v-model="q" type="search" placeholder="Search topics, articles, and guides..." />
          <button v-if="q" class="ht-x" aria-label="Clear" @click="q = ''"><Icon icon="lucide:x" /></button>
        </div>
      </header>

      <section class="ht-stats">
        <article>
          <span><Icon icon="lucide:library" /></span>
          <div><strong>{{ totalCount }}</strong><small>Total articles</small></div>
        </article>
        <article>
          <span><Icon icon="lucide:folder-open" /></span>
          <div><strong>{{ areas.length }}</strong><small>Topic areas</small></div>
        </article>
        <article>
          <span><Icon icon="lucide:sparkles" /></span>
          <div><strong>{{ filtered.length }}</strong><small>{{ activeArea || q ? 'Matching results' : 'Ready to browse' }}</small></div>
        </article>
      </section>

      <section class="ht-topic-panel">
        <div class="ht-panel-head">
          <div>
            <h2>Browse by topic</h2>
            <p>Choose an area to focus the article list.</p>
          </div>
          <RouterLink to="/dashboard/help-center/documentation">
            Documentation home
            <Icon icon="lucide:arrow-right" />
          </RouterLink>
        </div>
        <nav class="ht-topic-grid" aria-label="Help topics">
          <button :class="{ active: !activeArea }" @click="selectArea('')">
            <span class="topic-icon all"><Icon icon="lucide:layout-grid" /></span>
            <span><strong>All topics</strong><small>{{ totalCount }} articles</small></span>
          </button>
          <button v-for="a in areas" :key="a.name" :class="{ active: activeArea === a.name }" @click="selectArea(a.name)">
            <span :class="['topic-icon', toneForArea(a.name)]"><Icon :icon="areaIcon(a.name)" /></span>
            <span><strong>{{ a.name }}</strong><small>{{ a.count }} article{{ a.count === 1 ? '' : 's' }}</small></span>
          </button>
        </nav>
      </section>

      <div class="ht-results-head">
        <div>
          <h2>{{ activeArea || 'All articles' }}</h2>
          <p>{{ filtered.length }} article{{ filtered.length === 1 ? '' : 's' }}{{ q ? ` matching "${q}"` : '' }}</p>
        </div>
        <button v-if="activeArea || q" class="ht-clear" @click="clearAll">
          <Icon icon="lucide:x" />
          Clear filters
        </button>
      </div>

      <div v-if="loading" class="ht-state">Loading...</div>
      <div v-else-if="!filtered.length" class="ht-state">
        <Icon icon="lucide:file-search" />
        <p>No articles {{ activeArea ? `in ${activeArea}` : '' }}{{ q ? ` match "${q}"` : '' }}.</p>
        <button v-if="activeArea || q" class="ht-clear" @click="clearAll">Clear filters</button>
      </div>
      <div v-else class="ht-grid">
        <button v-for="a in filtered" :key="a.slug" class="ht-card" @click="openArticle(a)">
          <div class="ht-card-top">
            <span :class="['ht-ico', a.tone || 'blue']"><Icon :icon="a.icon || 'lucide:file-text'" /></span>
            <span v-if="a.difficulty" :class="['ht-diff', a.difficulty]">{{ a.difficulty }}</span>
          </div>
          <h3>{{ a.title }}</h3>
          <p>{{ a.summary }}</p>
          <div class="ht-meta">
            <span v-if="a.product_area"><Icon icon="lucide:folder" /> {{ a.product_area }}</span>
            <span v-if="a.estimated_read_time"><Icon icon="lucide:clock-3" /> {{ a.estimated_read_time }} min</span>
          </div>
          <span class="ht-open">Open article <Icon icon="lucide:arrow-right" /></span>
        </button>
      </div>
    </section>
  </main>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import api from '../services/api'

const route = useRoute()
const router = useRouter()

const allContent = ref([])
const areas = ref([])
const loading = ref(true)
const q = ref(typeof route.query.q === 'string' ? route.query.q : '')

function routeArea() {
  return route.params.productArea || (typeof route.query.area === 'string' ? route.query.area : '')
}
const activeArea = ref(routeArea())
const totalCount = computed(() => areas.value.reduce((n, a) => n + a.count, 0))

const AREA_ICONS = {
  'Getting Started': 'lucide:rocket',
  'Agents': 'lucide:bot',
  'Knowledge Base': 'lucide:book-open',
  'Workflows': 'lucide:workflow',
  'Integrations': 'lucide:link-2',
  'Connectors': 'lucide:link-2',
  'Billing': 'lucide:credit-card',
  'API & Developers': 'lucide:code',
  'Troubleshooting': 'lucide:life-buoy',
  'Security': 'lucide:shield',
  'Account Settings': 'lucide:user',
  'Tools': 'lucide:wrench',
  'General': 'lucide:file-text',
}
const TONES = ['blue', 'violet', 'teal', 'orange', 'rose', 'green']
function areaIcon(name) { return AREA_ICONS[name] || 'lucide:folder' }
function toneForArea(name) {
  const index = Math.abs(String(name || '').split('').reduce((n, ch) => n + ch.charCodeAt(0), 0)) % TONES.length
  return TONES[index]
}

const filtered = computed(() => {
  const query = q.value.trim().toLowerCase()
  let list = allContent.value
  if (activeArea.value) list = list.filter(a => (a.product_area || 'General').toLowerCase() === activeArea.value.toLowerCase())
  if (query) list = list.filter(a => `${a.title} ${a.summary || ''}`.toLowerCase().includes(query))
  return list
})

function openArticle(a) {
  if (a.url) router.push(a.url)
  else if (a.slug) router.push(`/dashboard/help-center/article/${a.slug}`)
}
function selectArea(name) {
  activeArea.value = name || ''
  router.replace({ path: '/dashboard/help-center/topics', query: name ? { area: name } : {} })
}
function clearAll() { q.value = ''; selectArea('') }

async function load() {
  loading.value = true
  try {
    const { data } = await api.getHelpList({})
    allContent.value = data?.results || []
    areas.value = data?.areas || []
  } catch (e) {
    allContent.value = []
    areas.value = []
  }
  loading.value = false
}

watch(() => route.fullPath, () => { activeArea.value = routeArea() })
onMounted(load)
</script>

<style scoped>
.ht-page {
  min-height: 100%;
  padding: 28px 32px 64px;
  background: #f8fbff;
  color: #0f172a;
}

.ht-main {
  width: 100%;
  max-width: 1240px;
  margin: 0 auto;
}

.ht-hero,
.ht-topic-panel,
.ht-card,
.ht-stats article {
  border: 1px solid #dfe7f2;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 10px 26px rgba(15, 23, 42, .04);
}

.ht-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(340px, 440px);
  gap: 26px;
  align-items: end;
  padding: 26px 28px;
  overflow: hidden;
}

.ht-kicker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #2563eb;
  font-size: 12px;
  font-weight: 850;
}

.ht-kicker svg {
  width: 16px;
  height: 16px;
}

.ht-hero h1 {
  margin: 10px 0 0;
  font-size: 30px;
  line-height: 1.12;
  font-weight: 900;
  letter-spacing: 0;
}

.ht-hero p {
  max-width: 620px;
  margin: 9px 0 0;
  color: #52617a;
  font-size: 14px;
  line-height: 1.55;
}

.ht-search {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 48px;
  min-width: 0;
  border: 1px solid #d8e2f0;
  border-radius: 10px;
  background: #fbfdff;
  padding: 0 12px 0 15px;
}

.ht-search svg {
  width: 17px;
  height: 17px;
  flex-shrink: 0;
  color: #8090aa;
}

.ht-search input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  color: #0f172a;
  font-size: 13px;
}

.ht-search input::placeholder {
  color: #94a3b8;
}

.ht-x {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border: 0;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
}

.ht-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 14px;
}

.ht-stats article {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 82px;
  padding: 16px;
}

.ht-stats article > span {
  display: grid;
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 10px;
  background: #eef4ff;
  color: #2563eb;
}

.ht-stats svg {
  width: 20px;
  height: 20px;
}

.ht-stats strong {
  display: block;
  color: #061735;
  font-size: 22px;
  font-weight: 900;
  line-height: 1;
}

.ht-stats small {
  display: block;
  margin-top: 5px;
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}

.ht-topic-panel {
  margin-top: 14px;
  padding: 18px;
}

.ht-panel-head,
.ht-results-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.ht-panel-head h2,
.ht-results-head h2 {
  margin: 0;
  color: #0f172a;
  font-size: 18px;
  font-weight: 900;
}

.ht-panel-head p,
.ht-results-head p {
  margin: 5px 0 0;
  color: #64748b;
  font-size: 12.5px;
}

.ht-panel-head a {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  color: #2563eb;
  font-size: 12.5px;
  font-weight: 850;
  text-decoration: none;
}

.ht-panel-head a svg {
  width: 15px;
  height: 15px;
}

.ht-topic-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.ht-topic-grid button {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  min-height: 72px;
  border: 1px solid #dfe7f2;
  border-radius: 10px;
  background: #fbfdff;
  padding: 12px;
  text-align: left;
  cursor: pointer;
  transition: border-color .15s ease, box-shadow .15s ease, transform .12s ease;
}

.ht-topic-grid button:hover {
  border-color: #c7d2fe;
  box-shadow: 0 10px 24px rgba(37, 99, 235, .08);
  transform: translateY(-1px);
}

.ht-topic-grid button.active {
  border-color: #2563eb;
  background: #f5f8ff;
  box-shadow: 0 0 0 1px #2563eb inset;
}

.topic-icon {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 10px;
}

.topic-icon svg {
  width: 18px;
  height: 18px;
}

.ht-topic-grid strong {
  display: block;
  overflow: hidden;
  color: #0f172a;
  font-size: 13px;
  font-weight: 900;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ht-topic-grid small {
  display: block;
  margin-top: 3px;
  color: #64748b;
  font-size: 11.5px;
  font-weight: 800;
}

.ht-results-head {
  margin: 22px 0 12px;
}

.ht-clear {
  display: inline-flex;
  height: 34px;
  align-items: center;
  gap: 7px;
  border: 1px solid #d8e2f0;
  border-radius: 8px;
  background: #fff;
  padding: 0 13px;
  color: #334155;
  font-size: 12.5px;
  font-weight: 800;
  cursor: pointer;
}

.ht-clear svg {
  width: 14px;
  height: 14px;
}

.ht-state {
  border: 1px solid #dfe7f2;
  border-radius: 12px;
  background: #fff;
  padding: 58px 12px;
  text-align: center;
  color: #94a3b8;
}

.ht-state svg {
  width: 30px;
  height: 30px;
  margin-bottom: 10px;
}

.ht-state p {
  margin: 0;
  color: #64748b;
  font-size: 14px;
  font-weight: 800;
}

.ht-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.ht-card {
  display: flex;
  min-height: 204px;
  flex-direction: column;
  align-items: flex-start;
  border-radius: 12px;
  padding: 16px;
  text-align: left;
  cursor: pointer;
  transition: border-color .15s ease, box-shadow .15s ease, transform .12s ease;
}

.ht-card:hover {
  border-color: #c7d2fe;
  box-shadow: 0 14px 30px rgba(37, 99, 235, .10);
  transform: translateY(-2px);
}

.ht-card-top {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
}

.ht-ico {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 10px;
}

.ht-ico svg {
  width: 19px;
  height: 19px;
}

.ht-diff {
  border-radius: 999px;
  background: #eef2ff;
  padding: 4px 9px;
  color: #4f46e5;
  font-size: 10px;
  font-weight: 900;
  text-transform: capitalize;
}

.ht-diff.beginner {
  background: #dcfce7;
  color: #16a34a;
}

.ht-diff.advanced {
  background: #fef2f2;
  color: #dc2626;
}

.ht-card h3 {
  margin: 0 0 7px;
  color: #0f172a;
  font-size: 15px;
  font-weight: 900;
  line-height: 1.25;
}

.ht-card p {
  display: -webkit-box;
  min-height: 40px;
  margin: 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: #475569;
  font-size: 12.5px;
  line-height: 1.55;
}

.ht-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 14px;
  color: #8090aa;
  font-size: 11.5px;
  font-weight: 800;
}

.ht-meta span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.ht-meta svg {
  width: 12px;
  height: 12px;
}

.ht-open {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: auto;
  padding-top: 16px;
  color: #2563eb;
  font-size: 12px;
  font-weight: 900;
}

.ht-open svg {
  width: 14px;
  height: 14px;
}

.all,
.blue { background: #eef4ff; color: #2563eb; }
.violet { background: #f2efff; color: #4f46e5; }
.teal { background: #e7fbf6; color: #0faaa5; }
.orange { background: #fff3e6; color: #f97316; }
.rose { background: #fff1f3; color: #f43f5e; }
.green { background: #e9fbf1; color: #10b981; }
.coral { background: #fff1ef; color: #f97362; }

@media (max-width: 1180px) {
  .ht-topic-grid,
  .ht-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .ht-page {
    padding: 22px 16px 54px;
  }
  .ht-hero,
  .ht-stats {
    grid-template-columns: 1fr;
  }
  .ht-panel-head,
  .ht-results-head {
    flex-direction: column;
  }
}

@media (max-width: 640px) {
  .ht-topic-grid,
  .ht-grid {
    grid-template-columns: 1fr;
  }
}
</style>
