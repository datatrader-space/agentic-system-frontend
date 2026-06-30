<template>
  <main class="db-page">
    <!-- Sidebar -->
    <aside class="db-sidebar">
      <div class="db-side-inner">
        <h3>Documentation</h3>
        <nav class="area-nav">
          <button :class="{ active: !activeArea }" @click="selectArea('')">
            <Icon icon="lucide:layout-grid" /> All areas <span class="cnt">{{ totalCount }}</span>
          </button>
          <button v-for="a in areas" :key="a.name" :class="{ active: activeArea === a.name }" @click="selectArea(a.name)">
            <Icon :icon="areaIcon(a.name)" /> {{ a.name }} <span class="cnt">{{ a.count }}</span>
          </button>
        </nav>
        <div class="side-foot">
          <RouterLink to="/dashboard/help-center/api-reference" class="side-link"><Icon icon="lucide:code-2" /> API reference</RouterLink>
          <RouterLink to="/dashboard/help-center/learning-paths" class="side-link"><Icon icon="lucide:graduation-cap" /> Learning paths</RouterLink>
        </div>
      </div>
    </aside>

    <!-- Main -->
    <section class="db-main">
      <nav class="breadcrumbs">
        <RouterLink to="/dashboard/help-center">Help Center</RouterLink>
        <Icon icon="lucide:chevron-right" class="bc-sep" />
        <RouterLink to="/dashboard/help-center/docs">Docs</RouterLink>
        <template v-if="activeArea">
          <Icon icon="lucide:chevron-right" class="bc-sep" />
          <span>{{ activeArea }}</span>
        </template>
      </nav>

      <header class="db-head">
        <div>
          <h1>{{ activeArea || 'Documentation' }}</h1>
          <p>Browse concepts, guides, and references{{ activeArea ? ` for ${activeArea}` : '' }}.</p>
        </div>
        <button class="ask-ai" @click="assistantOpen = true"><Icon icon="lucide:sparkles" /> Ask Assistant</button>
      </header>

      <div class="db-filters">
        <div class="search">
          <Icon icon="lucide:search" />
          <input v-model="q" placeholder="Search docs…" @input="onSearch" />
          <button v-if="q" class="cx" @click="q = ''; reload()"><Icon icon="lucide:x" /></button>
        </div>
        <div class="diff-pills">
          <button :class="{ active: !difficulty }" @click="setDifficulty('')">All levels</button>
          <button v-for="d in ['beginner','intermediate','advanced']" :key="d" :class="{ active: difficulty === d }" @click="setDifficulty(d)">{{ d }}</button>
        </div>
        <span class="count">{{ results.length }} article{{ results.length === 1 ? '' : 's' }}</span>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="card-grid">
        <div v-for="n in 6" :key="n" class="doc-card skeleton"><span class="skel s1" /><span class="skel s2" /><span class="skel s3" /></div>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="state error"><Icon icon="lucide:alert-triangle" /><p>Couldn’t load docs.</p><button class="btn" @click="reload">Retry</button></div>

      <!-- Empty -->
      <div v-else-if="!results.length" class="state empty">
        <Icon icon="lucide:file-search" /><p>No docs match your filters.</p>
        <button class="btn" @click="clearFilters">Clear filters</button>
      </div>

      <!-- Grouped (all areas) or flat (single area) -->
      <template v-else>
        <template v-if="!activeArea">
          <section v-for="group in grouped" :key="group.area" class="db-group">
            <div class="group-head">
              <h2>{{ group.area }}</h2>
              <button class="view-area" @click="selectArea(group.area)">View all <Icon icon="lucide:arrow-right" /></button>
            </div>
            <div class="card-grid">
              <RouterLink v-for="d in group.items" :key="d.slug" :to="`/dashboard/help-center/article/${d.slug}`" class="doc-card">
                <div class="dc-top"><span :class="['dc-type', d.tone || 'blue']"><Icon :icon="d.icon || 'lucide:file-text'" /></span><span v-if="d.difficulty" :class="['diff', d.difficulty]">{{ d.difficulty }}</span></div>
                <h3>{{ d.title }}</h3>
                <p>{{ d.summary }}</p>
                <div class="dc-meta"><span><Icon icon="lucide:clock-3" /> {{ d.estimated_read_time }} min</span><span>Updated {{ shortDate(d.last_updated) }}</span></div>
              </RouterLink>
            </div>
          </section>
        </template>
        <div v-else class="card-grid">
          <RouterLink v-for="d in results" :key="d.slug" :to="`/dashboard/help-center/article/${d.slug}`" class="doc-card">
            <div class="dc-top"><span :class="['dc-type', d.tone || 'blue']"><Icon :icon="d.icon || 'lucide:file-text'" /></span><span v-if="d.difficulty" :class="['diff', d.difficulty]">{{ d.difficulty }}</span></div>
            <h3>{{ d.title }}</h3>
            <p>{{ d.summary }}</p>
            <div class="dc-meta"><span><Icon icon="lucide:clock-3" /> {{ d.estimated_read_time }} min</span><span>Updated {{ shortDate(d.last_updated) }}</span></div>
          </RouterLink>
        </div>
      </template>
    </section>

    <HelpAssistant v-model:open="assistantOpen" current-page="docs" :product-area="activeArea" />
  </main>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import api from '../services/api'
import HelpAssistant from '../components/help/HelpAssistant.vue'

const route = useRoute()
const router = useRouter()
const assistantOpen = ref(false)

const results = ref([])
const areas = ref([])
const loading = ref(true)
const error = ref(false)
const q = ref(typeof route.query.q === 'string' ? route.query.q : '')
const difficulty = ref('')

const activeArea = computed(() => route.params.productArea || '')
const totalCount = computed(() => areas.value.reduce((n, a) => n + a.count, 0))

const AREA_ICONS = {
  'Getting Started': 'lucide:rocket', 'Agents': 'lucide:bot', 'Knowledge Base': 'lucide:book-open',
  'Workflows': 'lucide:workflow', 'Integrations': 'lucide:link-2', 'Billing': 'lucide:credit-card',
  'API & Developers': 'lucide:code', 'Troubleshooting': 'lucide:life-buoy', 'Security': 'lucide:shield',
  'Account Settings': 'lucide:user',
}
function areaIcon(name) { return AREA_ICONS[name] || 'lucide:folder' }
function shortDate(d) { try { return new Date(d).toLocaleDateString() } catch { return '' } }

const grouped = computed(() => {
  const map = {}
  for (const d of results.value) {
    const a = d.product_area || 'General'
    ;(map[a] = map[a] || []).push(d)
  }
  return Object.entries(map).map(([area, items]) => ({ area, items })).sort((a, b) => a.area.localeCompare(b.area))
})

async function load() {
  loading.value = true; error.value = false
  try {
    const params = { type: 'doc' }
    if (activeArea.value) params.product_area = activeArea.value
    if (difficulty.value) params.difficulty = difficulty.value
    if (q.value.trim()) params.q = q.value.trim()
    const { data } = await api.getHelpList(params)
    results.value = data?.results || []
    if (data?.areas?.length) areas.value = data.areas
  } catch (e) { error.value = true; results.value = [] }
  loading.value = false
}
function reload() { load() }

let _t = null
function onSearch() { clearTimeout(_t); _t = setTimeout(load, 280) }
function setDifficulty(d) { difficulty.value = d; load() }
function selectArea(name) {
  router.push(name ? `/dashboard/help-center/docs/${name}` : '/dashboard/help-center/docs')
}
function clearFilters() { q.value = ''; difficulty.value = ''; if (activeArea.value) selectArea(''); else load() }

onMounted(load)
watch(activeArea, load)
</script>

<style scoped>
.db-page { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 28px; min-height: 100%; padding: 28px 34px 60px; background: #f8fbff; color: #0f172a; }
.db-sidebar { }
.db-side-inner { position: sticky; top: 24px; border: 1px solid #dfe7f2; border-radius: 13px; background: #fff; padding: 16px; box-shadow: 0 1px 2px rgba(15,23,42,.04); }
.db-side-inner h3 { margin: 0 0 12px; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #64748b; font-weight: 850; }
.area-nav { display: grid; gap: 2px; }
.area-nav button { display: flex; align-items: center; gap: 9px; width: 100%; border: 0; background: transparent; border-radius: 9px; padding: 9px 10px; color: #475569; font-size: 13px; font-weight: 650; cursor: pointer; text-align: left; }
.area-nav button svg { width: 16px; height: 16px; color: #94a3b8; }
.area-nav button:hover { background: #f5f8ff; }
.area-nav button.active { background: #eef4ff; color: #2563eb; }
.area-nav button.active svg { color: #2563eb; }
.area-nav .cnt { margin-left: auto; color: #94a3b8; font-size: 11px; font-weight: 800; }
.side-foot { margin-top: 12px; padding-top: 12px; border-top: 1px solid #eef2f7; display: grid; gap: 2px; }
.side-link { display: flex; align-items: center; gap: 9px; padding: 8px 10px; border-radius: 9px; color: #4f46e5; font-size: 12.5px; font-weight: 700; text-decoration: none; }
.side-link:hover { background: #f5f8ff; }
.side-link svg { width: 16px; height: 16px; }
.db-main { min-width: 0; }
.breadcrumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12.5px; margin-bottom: 14px; }
.breadcrumbs a { color: #2563eb; text-decoration: none; font-weight: 700; }
.breadcrumbs span { color: #64748b; }
.bc-sep { width: 13px; height: 13px; color: #cbd5e1; }
.db-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.db-head h1 { margin: 0; font-size: 24px; font-weight: 850; }
.db-head p { margin: 7px 0 0; color: #64748b; font-size: 13.5px; }
.ask-ai { display: inline-flex; align-items: center; gap: 7px; height: 38px; flex-shrink: 0; border: 1px solid #ddd6fe; border-radius: 9px; background: #f5f3ff; padding: 0 14px; color: #7c3aed; font-size: 13px; font-weight: 800; cursor: pointer; }
.ask-ai svg { width: 15px; height: 15px; }
.db-filters { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin: 18px 0; }
.search { position: relative; display: flex; align-items: center; flex: 1; min-width: 220px; }
.search > svg { position: absolute; left: 12px; width: 16px; height: 16px; color: #94a3b8; }
.search input { width: 100%; height: 38px; border: 1px solid #d8e2f0; border-radius: 9px; padding: 0 34px; font-size: 13px; }
.cx { position: absolute; right: 8px; border: 0; background: transparent; color: #94a3b8; cursor: pointer; display: grid; place-items: center; } .cx svg { width: 15px; height: 15px; }
.diff-pills { display: flex; gap: 6px; }
.diff-pills button { height: 34px; border: 1px solid #dbe4f0; border-radius: 999px; background: #fff; padding: 0 13px; color: #334155; font-size: 12px; font-weight: 700; text-transform: capitalize; cursor: pointer; }
.diff-pills button.active { border-color: #2563eb; background: #2563eb; color: #fff; }
.count { color: #64748b; font-size: 12.5px; font-weight: 600; margin-left: auto; }
.db-group { margin-bottom: 26px; }
.group-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.group-head h2 { margin: 0; font-size: 16px; font-weight: 800; }
.view-area { display: inline-flex; align-items: center; gap: 6px; border: 0; background: transparent; color: #2563eb; font-size: 12.5px; font-weight: 800; cursor: pointer; } .view-area svg { width: 14px; height: 14px; }
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
.doc-card { display: block; border: 1px solid #dfe7f2; border-radius: 13px; background: #fff; padding: 16px; text-decoration: none; color: inherit; box-shadow: 0 1px 2px rgba(15,23,42,.03); transition: border-color .15s, box-shadow .15s, transform .15s; }
.doc-card:hover { border-color: #b9c9ff; box-shadow: 0 10px 24px rgba(37,99,235,.08); transform: translateY(-2px); }
.dc-top { display: flex; align-items: center; justify-content: space-between; }
.dc-type { display: grid; width: 38px; height: 38px; place-items: center; border-radius: 10px; } .dc-type svg { width: 19px; height: 19px; }
.blue { background: #eef4ff; color: #2563eb; } .violet { background: #f2efff; color: #7c3aed; } .teal { background: #e7fbf6; color: #0faaa5; } .coral { background: #fff1ed; color: #f15b3d; }
.diff { border-radius: 6px; padding: 3px 8px; font-size: 10px; font-weight: 850; text-transform: capitalize; }
.diff.beginner { background: #dff8ef; color: #059669; } .diff.intermediate { background: #fff5d9; color: #b7791f; } .diff.advanced { background: #fff1f3; color: #e11d48; }
.doc-card h3 { margin: 13px 0 0; font-size: 14.5px; font-weight: 800; }
.doc-card p { margin: 6px 0 0; color: #64748b; font-size: 12.5px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.dc-meta { display: flex; align-items: center; justify-content: space-between; margin-top: 14px; color: #94a3b8; font-size: 11.5px; font-weight: 600; }
.dc-meta span { display: inline-flex; align-items: center; gap: 4px; } .dc-meta svg { width: 12px; height: 12px; }
.state { display: grid; place-items: center; gap: 12px; padding: 56px 20px; text-align: center; color: #64748b; }
.state svg { width: 32px; height: 32px; color: #cbd5e1; } .state.error svg { color: #f59e0b; }
.btn { display: inline-flex; align-items: center; height: 36px; border: 1px solid #dbe4f0; border-radius: 9px; background: #fff; padding: 0 16px; color: #2563eb; font-size: 13px; font-weight: 700; text-decoration: none; cursor: pointer; }
.skeleton { pointer-events: none; }
.skel { display: block; border-radius: 8px; background: linear-gradient(90deg,#eef2f7,#f8fafc,#eef2f7); background-size: 200% 100%; animation: sh 1.2s infinite; }
.skel.s1 { width: 38px; height: 38px; } .skel.s2 { width: 70%; height: 14px; margin-top: 14px; } .skel.s3 { width: 100%; height: 11px; margin-top: 9px; }
@keyframes sh { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
@media (max-width: 900px) {
  .db-page { grid-template-columns: 1fr; padding: 22px 16px; }
  .db-side-inner { position: static; }
  .area-nav { grid-auto-flow: column; grid-auto-columns: max-content; overflow-x: auto; }
  .area-nav .cnt { display: none; }
}
</style>
