<template>
  <main class="lpd-page">
    <section class="lpd-main" v-if="path">
      <nav class="breadcrumbs">
        <RouterLink to="/dashboard/help-center">Help Center</RouterLink>
        <Icon icon="lucide:chevron-right" class="bc-sep" />
        <RouterLink to="/dashboard/help-center/learning-paths">Learning paths</RouterLink>
        <Icon icon="lucide:chevron-right" class="bc-sep" />
        <span>{{ path.title }}</span>
      </nav>

      <header class="lpd-head">
        <span :class="['lpd-icon', path.tone || 'blue']"><Icon :icon="path.icon || 'lucide:rocket'" /></span>
        <div>
          <h1>{{ path.title }}</h1>
          <p v-if="path.summary">{{ path.summary }}</p>
          <div class="lpd-meta">
            <span v-if="path.difficulty" class="cap"><Icon icon="lucide:bar-chart-3" /> {{ path.difficulty }}</span>
            <span><Icon icon="lucide:list-checks" /> {{ steps.length }} steps</span>
            <span><Icon icon="lucide:clock-3" /> ~{{ totalMinutes }} min</span>
          </div>
        </div>
      </header>

      <div v-if="path.body" class="lpd-body md" v-html="render(path.body)"></div>

      <section v-if="steps.length" class="lpd-progress-card">
        <div class="prog-head">
          <strong>{{ doneCount }} of {{ steps.length }} completed</strong>
          <button class="cta" @click="goContinue">
            {{ doneCount === 0 ? 'Start path' : (doneCount === steps.length ? 'Review' : 'Continue') }}
            <Icon icon="lucide:arrow-right" />
          </button>
        </div>
        <div class="prog-bar"><i :style="{ width: percent + '%' }" /></div>
      </section>

      <ol v-if="steps.length" class="steps">
        <li v-for="(s, i) in steps" :key="s.slug" :class="['step', stepState(i)]">
          <button class="check" @click="toggle(s)" :aria-label="isDone(s) ? 'Mark incomplete' : 'Mark complete'">
            <Icon :icon="isDone(s) ? 'lucide:check-circle-2' : (stepState(i) === 'current' ? 'lucide:circle-dot' : 'lucide:circle')" />
          </button>
          <div class="step-body">
            <div class="step-top">
              <span class="step-n">Step {{ i + 1 }}</span>
              <span :class="['stype', s.type]">{{ typeLabel(s.type) }}</span>
              <span class="step-time"><Icon icon="lucide:clock-3" /> {{ s.estimated_read_time }} min</span>
            </div>
            <RouterLink :to="s.url" class="step-title">{{ s.title }}</RouterLink>
            <p v-if="s.summary">{{ s.summary }}</p>
            <RouterLink :to="s.url" class="step-open">{{ isDone(s) ? 'Revisit' : 'Open' }} <Icon icon="lucide:arrow-right" /></RouterLink>
          </div>
        </li>
      </ol>

      <div v-else class="state empty">
        <Icon icon="lucide:list-checks" /><p>This path has no steps yet.</p>
        <RouterLink to="/dashboard/help-center/docs" class="btn">Browse documentation</RouterLink>
      </div>

      <section v-for="(items, rel) in relations" :key="rel" class="related">
        <h3>{{ relationLabel(rel) }}</h3>
        <div class="rel-grid">
          <RouterLink v-for="it in items" :key="it.slug" :to="it.url" class="rel-card">
            <span :class="['r-icon', toneFor(it.type)]"><Icon :icon="iconFor(it.type)" /></span>
            <span><strong>{{ it.title }}</strong><small v-if="it.summary">{{ it.summary }}</small></span>
          </RouterLink>
        </div>
      </section>
    </section>

    <section class="lpd-main" v-else-if="loadError">
      <p class="empty-text">This learning path isn’t available.
        <RouterLink to="/dashboard/help-center/learning-paths">Back to learning paths</RouterLink>
      </p>
    </section>
    <section class="lpd-main" v-else>
      <div class="state"><Icon icon="lucide:loader-2" class="spin" /><p>Loading…</p></div>
    </section>
  </main>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { marked } from 'marked'
import api from '../services/api'
import { isStepDone, toggleStep, setPathTotal, getCompleted } from '../composables/useHelpProgress'

const route = useRoute()
const router = useRouter()

const path = ref(null)
const steps = ref([])
const relations = ref({})
const totalMinutes = ref(0)
const loadError = ref(false)
const tick = ref(0)  // bump to recompute progress after toggles

const REL_LABEL = { related: 'Related', prerequisite: 'Prerequisites', next_step: 'Next steps', tutorial: 'Tutorials', documentation: 'Documentation', guided_tour: 'Guided tours', integration: 'Integrations', troubleshooting: 'Troubleshooting' }
const ICONS = { doc: 'lucide:file-text', guide: 'lucide:book-open', tutorial: 'lucide:play-circle', integration: 'lucide:link-2', faq: 'lucide:help-circle', learning_path: 'lucide:rocket', guided_tour: 'lucide:route' }
const TONES = { doc: 'blue', guide: 'blue', tutorial: 'teal', integration: 'violet', faq: 'coral', learning_path: 'blue', guided_tour: 'coral' }
const TYPE_LABEL = { doc: 'Doc', guide: 'Guide', tutorial: 'Tutorial', integration: 'Integration', faq: 'FAQ', guided_tour: 'Tour' }

function relationLabel(r) { return REL_LABEL[r] || r }
function iconFor(t) { return ICONS[t] || 'lucide:file-text' }
function toneFor(t) { return TONES[t] || 'blue' }
function typeLabel(t) { return TYPE_LABEL[t] || 'Doc' }
function render(md) { try { return marked.parse(md || '') } catch { return md || '' } }

const slug = computed(() => route.params.slug)
function isDone(s) { tick.value; return isStepDone(slug.value, s.slug) }
const doneCount = computed(() => { tick.value; return getCompleted(slug.value).filter(d => steps.value.some(s => s.slug === d)).length })
const percent = computed(() => steps.value.length ? Math.round((doneCount.value / steps.value.length) * 100) : 0)

function stepState(i) {
  if (isStepDone(slug.value, steps.value[i].slug)) return 'done'
  const firstIncomplete = steps.value.findIndex(s => !isStepDone(slug.value, s.slug))
  return i === firstIncomplete ? 'current' : 'upcoming'
}
function toggle(s) { toggleStep(slug.value, s.slug, !isStepDone(slug.value, s.slug)); tick.value++ }
function goContinue() {
  const next = steps.value.find(s => !isStepDone(slug.value, s.slug)) || steps.value[0]
  if (next) router.push(next.url)
}

async function load() {
  loadError.value = false; path.value = null
  try {
    const { data } = await api.getHelpLearningPath(slug.value)
    path.value = data.path
    steps.value = data.steps || []
    relations.value = data.relations || {}
    totalMinutes.value = data.total_minutes || 0
    setPathTotal(slug.value, steps.value.length)
  } catch (e) { loadError.value = true }
}
onMounted(load)
watch(slug, load)
</script>

<style scoped>
.lpd-page { min-height: 100%; padding: 30px 36px 60px; background: #f8fbff; color: #0f172a; }
.lpd-main { max-width: 800px; margin: 0 auto; }
.breadcrumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12.5px; margin-bottom: 18px; }
.breadcrumbs a { color: #2563eb; text-decoration: none; font-weight: 700; }
.breadcrumbs span { color: #64748b; }
.bc-sep { width: 13px; height: 13px; color: #cbd5e1; }
.lpd-head { display: flex; gap: 16px; align-items: flex-start; }
.lpd-icon { display: grid; width: 52px; height: 52px; flex-shrink: 0; place-items: center; border-radius: 13px; }
.lpd-icon svg { width: 26px; height: 26px; }
.blue { background: #eef4ff; color: #2563eb; } .violet { background: #f2efff; color: #7c3aed; }
.teal { background: #e7fbf6; color: #0faaa5; } .coral { background: #fff1ed; color: #f15b3d; }
.lpd-head h1 { margin: 0; font-size: 25px; font-weight: 850; }
.lpd-head p { margin: 8px 0 0; color: #475569; font-size: 14.5px; line-height: 1.5; }
.lpd-meta { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 12px; color: #64748b; font-size: 12.5px; font-weight: 600; }
.lpd-meta span { display: inline-flex; align-items: center; gap: 5px; } .lpd-meta svg { width: 14px; height: 14px; }
.cap { text-transform: capitalize; }
.lpd-body { margin: 20px 0 0; color: #334155; font-size: 14px; line-height: 1.65; }
.md :deep(p) { margin: 0 0 10px; }
.lpd-progress-card { margin: 22px 0 18px; border: 1px solid #dfe7f2; border-radius: 13px; background: #fff; padding: 16px 18px; box-shadow: 0 1px 2px rgba(15,23,42,.04); }
.prog-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.prog-head strong { font-size: 13.5px; }
.cta { display: inline-flex; align-items: center; gap: 7px; height: 36px; border: 0; border-radius: 9px; background: #4f46e5; color: #fff; padding: 0 16px; font-size: 13px; font-weight: 800; cursor: pointer; }
.cta svg { width: 15px; height: 15px; }
.prog-bar { height: 7px; margin-top: 14px; border-radius: 999px; background: #eef2f7; overflow: hidden; }
.prog-bar i { display: block; height: 100%; background: #2563eb; border-radius: inherit; transition: width .3s ease; }
.steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
.step { display: flex; gap: 14px; border: 1px solid #dfe7f2; border-radius: 13px; background: #fff; padding: 16px; box-shadow: 0 1px 2px rgba(15,23,42,.03); }
.step.current { border-color: #b9c9ff; box-shadow: 0 8px 20px rgba(37,99,235,.08); }
.step.done { background: #fbfefc; }
.check { border: 0; background: transparent; cursor: pointer; color: #cbd5e1; padding: 0; align-self: flex-start; }
.step.current .check { color: #2563eb; } .step.done .check { color: #10b981; }
.check svg { width: 24px; height: 24px; }
.step-body { min-width: 0; flex: 1; }
.step-top { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.step-n { color: #94a3b8; font-size: 11px; font-weight: 850; text-transform: uppercase; letter-spacing: .04em; }
.stype { border-radius: 6px; padding: 2px 8px; font-size: 10px; font-weight: 850; background: #eef4ff; color: #2563eb; text-transform: capitalize; }
.step-time { color: #94a3b8; font-size: 11.5px; display: inline-flex; align-items: center; gap: 4px; } .step-time svg { width: 12px; height: 12px; }
.step-title { display: block; margin-top: 6px; color: #0f172a; font-size: 15px; font-weight: 800; text-decoration: none; }
.step-title:hover { color: #2563eb; }
.step-body p { margin: 5px 0 0; color: #64748b; font-size: 13px; line-height: 1.5; }
.step-open { display: inline-flex; align-items: center; gap: 5px; margin-top: 10px; color: #2563eb; font-size: 12.5px; font-weight: 800; text-decoration: none; }
.step-open svg { width: 14px; height: 14px; }
.related { margin-top: 28px; }
.related h3 { margin: 0 0 12px; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #64748b; font-weight: 850; }
.rel-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.rel-card { display: flex; align-items: center; gap: 11px; border: 1px solid #dfe7f2; border-radius: 11px; background: #fff; padding: 12px; text-decoration: none; color: inherit; }
.rel-card:hover { border-color: #b9c9ff; }
.r-icon { display: grid; width: 34px; height: 34px; flex-shrink: 0; place-items: center; border-radius: 9px; } .r-icon svg { width: 17px; height: 17px; }
.rel-card strong { display: block; font-size: 13px; font-weight: 800; } .rel-card small { display: block; margin-top: 2px; color: #94a3b8; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.state { display: grid; place-items: center; gap: 12px; padding: 50px 20px; text-align: center; color: #64748b; }
.state svg { width: 30px; height: 30px; color: #cbd5e1; }
.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
.btn { display: inline-flex; align-items: center; height: 36px; border: 1px solid #dbe4f0; border-radius: 9px; background: #fff; padding: 0 16px; color: #2563eb; font-weight: 700; text-decoration: none; }
.empty-text { color: #64748b; } .empty-text a { color: #2563eb; font-weight: 700; }
@media (max-width: 760px) { .lpd-page { padding: 22px 16px; } .rel-grid { grid-template-columns: 1fr; } }
</style>
