<template>
  <main class="gtd-page">
    <section class="gtd-main" v-if="tour">
      <header class="gtd-head">
        <span :class="['gtd-icon', tour.tone || 'blue']"><Icon :icon="tour.icon || 'lucide:route'" /></span>
        <div>
          <h1>{{ tour.title }}</h1>
          <p>{{ tour.description }}</p>
          <div class="gtd-meta">
            <span><Icon icon="lucide:list-checks" /> {{ steps.length }} steps</span>
            <span><Icon icon="lucide:clock-3" /> {{ tour.estimated_minutes }} min</span>
            <span v-if="tour.difficulty" class="cap"><Icon icon="lucide:bar-chart-3" /> {{ tour.difficulty }}</span>
            <span v-if="tour.status !== 'not_started'" :class="['status', tour.status]">{{ statusLabel(tour.status) }}</span>
          </div>
          <button class="start" @click="start"><Icon icon="lucide:play" /> {{ ctaLabel(tour.status) }}</button>
        </div>
      </header>

      <section class="gtd-steps">
        <h2>What you’ll do</h2>
        <ol>
          <li v-for="(s, i) in steps" :key="i">
            <span class="num">{{ i + 1 }}</span>
            <div><strong>{{ s.title }}</strong><p>{{ s.body }}</p></div>
          </li>
        </ol>
      </section>

      <section v-if="related.length" class="gtd-related">
        <h2>Related help</h2>
        <div class="rel-grid">
          <RouterLink v-for="r in related" :key="r.slug" :to="r.url" class="rel-card">
            <span :class="['r-icon', toneFor(r.type)]"><Icon :icon="iconFor(r.type)" /></span>
            <span><strong>{{ r.title }}</strong><small v-if="r.summary">{{ r.summary }}</small></span>
          </RouterLink>
        </div>
      </section>
    </section>

    <section class="gtd-main" v-else-if="loadError">
      <p class="empty">This tour isn’t available. <RouterLink to="/dashboard/help-center/guided-tours">Back to tours</RouterLink></p>
    </section>
    <section class="gtd-main" v-else>
      <div class="state"><Icon icon="lucide:loader-2" class="spin" /><p>Loading…</p></div>
    </section>
  </main>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import api from '../services/api'
import { useGuidedTour } from '../composables/useGuidedTour'
import { setBreadcrumbLabel } from '@/composables/useBreadcrumbs'

const route = useRoute()
const { launch } = useGuidedTour()

const tour = ref(null)
const steps = ref([])
const related = ref([])
const loadError = ref(false)

setBreadcrumbLabel(() => tour.value?.title)

const ICONS = { doc: 'lucide:file-text', guide: 'lucide:book-open', tutorial: 'lucide:play-circle', integration: 'lucide:link-2', faq: 'lucide:help-circle', learning_path: 'lucide:rocket' }
const TONES = { doc: 'blue', guide: 'blue', tutorial: 'teal', integration: 'violet', faq: 'coral', learning_path: 'blue' }
function iconFor(t) { return ICONS[t] || 'lucide:file-text' }
function toneFor(t) { return TONES[t] || 'blue' }
function statusLabel(s) { return { in_progress: 'In progress', completed: 'Completed', skipped: 'Skipped' }[s] || '' }
function ctaLabel(s) { return s === 'in_progress' ? 'Continue tour' : s === 'completed' ? 'Restart tour' : 'Start tour' }

async function load() {
  loadError.value = false; tour.value = null
  try {
    const { data } = await api.getHelpGuidedTour(route.params.slug)
    tour.value = data.tour
    steps.value = data.steps || []
    related.value = data.related_content || []
  } catch (e) { loadError.value = true }
}
function start() { launch(route.params.slug, { restart: tour.value?.status === 'completed' }) }

onMounted(load)
watch(() => route.params.slug, load)
</script>

<style scoped>
.gtd-page { min-height: 100%; padding: 30px 36px 60px; background: #f8fbff; color: #0f172a; }
.gtd-main { max-width: 760px; margin: 0 auto; }
.gtd-head { display: flex; gap: 16px; align-items: flex-start; }
.gtd-icon { display: grid; width: 52px; height: 52px; flex-shrink: 0; place-items: center; border-radius: 13px; } .gtd-icon svg { width: 26px; height: 26px; }
.blue { background: #eef4ff; color: #2563eb; } .violet { background: #f2efff; color: #7c3aed; } .teal { background: #e7fbf6; color: #0faaa5; } .amber { background: #fff7e6; color: #d97706; } .coral { background: #fff1ed; color: #f15b3d; }
.gtd-head h1 { margin: 0; font-size: 25px; font-weight: 850; }
.gtd-head p { margin: 8px 0 0; color: #475569; font-size: 14.5px; line-height: 1.5; }
.gtd-meta { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 12px; color: #64748b; font-size: 12.5px; font-weight: 600; }
.gtd-meta span { display: inline-flex; align-items: center; gap: 5px; } .gtd-meta svg { width: 14px; height: 14px; } .cap { text-transform: capitalize; }
.status { border-radius: 6px; padding: 2px 9px; font-size: 10.5px; font-weight: 850; }
.status.in_progress { background: #eef4ff; color: #2563eb; } .status.completed { background: #dff8ef; color: #059669; } .status.skipped { background: #fff5d9; color: #b7791f; }
.start { display: inline-flex; align-items: center; gap: 8px; height: 42px; margin-top: 18px; border: 0; border-radius: 10px; background: #4f46e5; color: #fff; padding: 0 20px; font-size: 14px; font-weight: 850; cursor: pointer; } .start svg { width: 16px; height: 16px; }
.gtd-steps { margin-top: 30px; } .gtd-steps h2, .gtd-related h2 { margin: 0 0 14px; font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: #64748b; font-weight: 850; }
.gtd-steps ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
.gtd-steps li { display: flex; gap: 13px; border: 1px solid #eef2f7; border-radius: 11px; background: #fff; padding: 13px 15px; }
.num { display: grid; width: 26px; height: 26px; flex-shrink: 0; place-items: center; border-radius: 999px; background: #eef2ff; color: #4f46e5; font-size: 12px; font-weight: 850; }
.gtd-steps strong { font-size: 14px; font-weight: 800; } .gtd-steps p { margin: 4px 0 0; color: #64748b; font-size: 13px; line-height: 1.5; }
.gtd-related { margin-top: 30px; }
.rel-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.rel-card { display: flex; align-items: center; gap: 11px; border: 1px solid #dfe7f2; border-radius: 11px; background: #fff; padding: 12px; text-decoration: none; color: inherit; } .rel-card:hover { border-color: #b9c9ff; }
.r-icon { display: grid; width: 34px; height: 34px; flex-shrink: 0; place-items: center; border-radius: 9px; } .r-icon svg { width: 17px; height: 17px; }
.rel-card strong { display: block; font-size: 13px; font-weight: 800; } .rel-card small { display: block; margin-top: 2px; color: #94a3b8; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.state { display: grid; place-items: center; gap: 12px; padding: 50px; color: #64748b; } .state svg { width: 30px; height: 30px; color: #cbd5e1; }
.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
.empty { color: #64748b; } .empty a { color: #2563eb; font-weight: 700; }
@media (max-width: 760px) { .gtd-page { padding: 22px 16px; } .rel-grid { grid-template-columns: 1fr; } }
</style>
