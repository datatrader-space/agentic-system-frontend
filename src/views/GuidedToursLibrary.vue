<template>
  <main class="gtl-page">
    <section class="gtl-main">
      <header class="gtl-head">
        <div>
          <h1>Guided tours</h1>
          <p>Interactive, step-by-step walkthroughs that run right inside the product.</p>
        </div>
      </header>

      <div class="gtl-filters">
        <div class="search">
          <Icon icon="lucide:search" />
          <input v-model="q" placeholder="Search tours…" @input="onSearch" />
        </div>
        <select v-model="area" @change="load"><option value="">All areas</option><option v-for="a in areaOptions" :key="a" :value="a">{{ a }}</option></select>
        <select v-model="difficulty" @change="load"><option value="">All levels</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select>
      </div>

      <div v-if="loading" class="gtl-grid">
        <div v-for="n in 4" :key="n" class="tour-card skeleton"><span class="skel s1" /><span class="skel s2" /><span class="skel s3" /></div>
      </div>
      <div v-else-if="error" class="state error"><Icon icon="lucide:alert-triangle" /><p>Couldn’t load tours.</p><button class="btn" @click="load">Retry</button></div>
      <div v-else-if="!tours.length" class="state empty"><Icon icon="lucide:route" /><p>No guided tours found.</p></div>

      <div v-else class="gtl-grid">
        <article v-for="t in tours" :key="t.slug" class="tour-card">
          <div class="tc-top">
            <span :class="['tc-icon', t.tone || 'blue']"><Icon :icon="t.icon || 'lucide:route'" /></span>
            <span :class="['status', t.status]">{{ statusLabel(t.status) }}</span>
          </div>
          <RouterLink :to="t.url" class="tc-title">{{ t.title }}</RouterLink>
          <p>{{ t.description }}</p>
          <div class="tc-meta">
            <span><Icon icon="lucide:list-checks" /> {{ t.steps_count }} steps</span>
            <span><Icon icon="lucide:clock-3" /> {{ t.estimated_minutes }} min</span>
            <span v-if="t.difficulty" class="cap"><Icon icon="lucide:bar-chart-3" /> {{ t.difficulty }}</span>
          </div>
          <div class="tc-actions">
            <button class="cta" @click="startTour(t)">
              <Icon icon="lucide:play" /> {{ ctaLabel(t.status) }}
            </button>
            <RouterLink :to="t.url" class="details">Details</RouterLink>
          </div>
        </article>
      </div>
    </section>
  </main>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { Icon } from '@iconify/vue'
import api from '../services/api'
import { useGuidedTour } from '../composables/useGuidedTour'

const { launch } = useGuidedTour()

const tours = ref([])
const loading = ref(true)
const error = ref(false)
const q = ref('')
const area = ref('')
const difficulty = ref('')
const areaOptions = ref([])

function statusLabel(s) { return { not_started: 'Not started', in_progress: 'In progress', completed: 'Completed', skipped: 'Skipped' }[s] || 'Not started' }
function ctaLabel(s) { return s === 'in_progress' ? 'Continue' : s === 'completed' ? 'Restart' : 'Start tour' }

async function load() {
  loading.value = true; error.value = false
  try {
    const params = {}
    if (q.value.trim()) params.q = q.value.trim()
    if (area.value) params.product_area = area.value
    if (difficulty.value) params.difficulty = difficulty.value
    const { data } = await api.getHelpGuidedTours(params)
    tours.value = data?.tours || []
    if (!areaOptions.value.length) {
      areaOptions.value = [...new Set(tours.value.map(t => t.product_area).filter(Boolean))].sort()
    }
  } catch (e) { error.value = true }
  loading.value = false
}
let _t = null
function onSearch() { clearTimeout(_t); _t = setTimeout(load, 280) }
function startTour(t) { launch(t.slug, { restart: t.status === 'completed' }) }

onMounted(load)
</script>

<style scoped>
.gtl-page { min-height: 100%; padding: 30px 36px 60px; background: #f8fbff; color: #0f172a; }
.gtl-main { max-width: 1040px; margin: 0 auto; }
.gtl-head h1 { margin: 0; font-size: 25px; font-weight: 850; }
.gtl-head p { margin: 8px 0 0; color: #64748b; font-size: 14px; max-width: 560px; }
.gtl-filters { display: flex; flex-wrap: wrap; gap: 10px; margin: 20px 0; }
.gtl-filters select { height: 38px; border: 1px solid #d8e2f0; border-radius: 9px; padding: 0 10px; font-size: 13px; background: #fff; }
.search { position: relative; display: flex; align-items: center; flex: 1; min-width: 220px; }
.search > svg { position: absolute; left: 12px; width: 16px; height: 16px; color: #94a3b8; }
.search input { width: 100%; height: 38px; border: 1px solid #d8e2f0; border-radius: 9px; padding: 0 12px 0 34px; font-size: 13px; }
.gtl-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.tour-card { border: 1px solid #dfe7f2; border-radius: 14px; background: #fff; padding: 18px; box-shadow: 0 1px 2px rgba(15,23,42,.04); }
.tc-top { display: flex; align-items: center; justify-content: space-between; }
.tc-icon { display: grid; width: 44px; height: 44px; place-items: center; border-radius: 11px; } .tc-icon svg { width: 22px; height: 22px; }
.blue { background: #eef4ff; color: #2563eb; } .violet { background: #f2efff; color: #7c3aed; } .teal { background: #e7fbf6; color: #0faaa5; } .amber { background: #fff7e6; color: #d97706; } .coral { background: #fff1ed; color: #f15b3d; }
.status { border-radius: 6px; padding: 3px 9px; font-size: 10.5px; font-weight: 850; }
.status.not_started { background: #f1f5f9; color: #64748b; } .status.in_progress { background: #eef4ff; color: #2563eb; } .status.completed { background: #dff8ef; color: #059669; } .status.skipped { background: #fff5d9; color: #b7791f; }
.tc-title { display: block; margin-top: 14px; color: #0f172a; font-size: 16px; font-weight: 850; text-decoration: none; } .tc-title:hover { color: #2563eb; }
.tour-card p { margin: 7px 0 0; color: #64748b; font-size: 13px; line-height: 1.5; }
.tc-meta { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 14px; color: #64748b; font-size: 12px; font-weight: 600; }
.tc-meta span { display: inline-flex; align-items: center; gap: 5px; } .tc-meta svg { width: 14px; height: 14px; } .cap { text-transform: capitalize; }
.tc-actions { display: flex; align-items: center; gap: 12px; margin-top: 16px; }
.cta { display: inline-flex; align-items: center; gap: 7px; height: 38px; border: 0; border-radius: 9px; background: #4f46e5; color: #fff; padding: 0 16px; font-size: 13px; font-weight: 800; cursor: pointer; } .cta svg { width: 15px; height: 15px; }
.details { color: #2563eb; font-size: 12.5px; font-weight: 800; text-decoration: none; }
.state { display: grid; place-items: center; gap: 12px; padding: 56px; text-align: center; color: #64748b; } .state svg { width: 32px; height: 32px; color: #cbd5e1; } .state.error svg { color: #f59e0b; }
.btn { display: inline-flex; align-items: center; height: 36px; border: 1px solid #dbe4f0; border-radius: 9px; background: #fff; padding: 0 16px; color: #2563eb; font-weight: 700; cursor: pointer; }
.skeleton { pointer-events: none; }
.skel { display: block; border-radius: 8px; background: linear-gradient(90deg,#eef2f7,#f8fafc,#eef2f7); background-size: 200% 100%; animation: sh 1.2s infinite; }
.skel.s1 { width: 44px; height: 44px; } .skel.s2 { width: 60%; height: 16px; margin-top: 16px; } .skel.s3 { width: 100%; height: 12px; margin-top: 10px; }
@keyframes sh { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
@media (max-width: 760px) { .gtl-page { padding: 22px 16px; } .gtl-grid { grid-template-columns: 1fr; } }
</style>
