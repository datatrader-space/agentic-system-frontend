<template>
  <main class="tutorial-detail">
    <section class="td-main" v-if="tutorial">
      <RouterLink to="/dashboard/help-center/tutorials" class="back-link">
        <Icon icon="lucide:arrow-left" /> All tutorials
      </RouterLink>

      <header class="td-head">
        <span :class="['td-icon', tutorial.tone || 'blue']"><Icon :icon="tutorial.icon || 'lucide:book-open'" /></span>
        <div>
          <h1>{{ tutorial.title }}</h1>
          <p>{{ tutorial.summary }}</p>
          <div class="td-meta">
            <span><Icon icon="lucide:list-checks" /> {{ steps.length }} steps</span>
            <span><Icon icon="lucide:clock-3" /> {{ tutorial.estimated_minutes }} min</span>
            <span class="cap"><Icon icon="lucide:bar-chart-3" /> {{ tutorial.difficulty }}</span>
            <span v-if="completed" class="done-pill"><Icon icon="lucide:check" /> Completed</span>
          </div>
        </div>
      </header>

      <div class="td-progress"><i :style="{ width: percent + '%' }" /></div>

      <section v-if="tutorial.video_url" class="td-video">
        <a :href="tutorial.video_url" target="_blank" rel="noopener">
          <Icon icon="lucide:play" /> Watch the video
        </a>
      </section>

      <article v-if="activeStep" class="td-step">
        <div class="step-head">
          <span class="step-num">{{ activeStep.order }}</span>
          <h2>{{ activeStep.title }}</h2>
        </div>
        <div class="step-body" v-html="activeStep.content_html || activeStep.content"></div>
        <a v-if="activeStep.video_url" :href="activeStep.video_url" target="_blank" rel="noopener" class="step-video">
          <Icon icon="lucide:play" /> Watch step video
        </a>
      </article>

      <div class="td-actions">
        <button class="ghost" :disabled="stepIndex === 0" @click="prev">
          <Icon icon="lucide:arrow-left" /> Previous
        </button>
        <span class="step-count">Step {{ stepIndex + 1 }} of {{ steps.length }}</span>
        <button v-if="stepIndex < steps.length - 1" class="primary" @click="next">
          Next <Icon icon="lucide:arrow-right" />
        </button>
        <button v-else class="primary" @click="finish">
          <Icon icon="lucide:check" /> Finish tutorial
        </button>
      </div>
    </section>

    <section class="td-main" v-else-if="loadError">
      <p class="empty">This tutorial isn’t available.
        <RouterLink to="/dashboard/help-center/tutorials">Back to tutorials</RouterLink>
      </p>
    </section>

    <aside class="td-rail" v-if="tutorial">
      <section class="rail-card">
        <h2>Steps</h2>
        <ol class="step-list">
          <li v-for="(s, i) in steps" :key="s.id"
              :class="{ active: i === stepIndex, done: doneSteps.includes(s.order) }"
              @click="goStep(i)">
            <span class="dot"><Icon :icon="doneSteps.includes(s.order) ? 'lucide:check' : 'lucide:circle'" /></span>
            {{ s.title }}
          </li>
        </ol>
      </section>
    </aside>
  </main>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import api from '../services/api'
import { setBreadcrumbLabel } from '@/composables/useBreadcrumbs'

const route = useRoute()
const slug = route.params.slug

const tutorial = ref(null)

setBreadcrumbLabel(() => tutorial.value?.title)
const steps = ref([])
const stepIndex = ref(0)
const doneSteps = ref([])
const completed = ref(false)
const loadError = ref(false)

const activeStep = computed(() => steps.value[stepIndex.value] || null)
const percent = computed(() => {
  if (completed.value) return 100
  if (!steps.value.length) return 0
  return Math.round((doneSteps.value.length / steps.value.length) * 100)
})

async function load() {
  try {
    const { data } = await api.getTutorial(slug)
    tutorial.value = data
    steps.value = data.steps || []
    doneSteps.value = data.completed_steps || []
    completed.value = data.progress_status === 'completed'
    stepIndex.value = Math.min(Math.max(0, data.current_step || 0), Math.max(0, steps.value.length - 1))
  } catch (e) {
    loadError.value = true
  }
}

async function markStep(order, extra = {}) {
  try {
    await api.updateTutorialProgress(slug, { status: 'in_progress', completed_step: order, current_step: stepIndex.value, ...extra })
  } catch (e) { /* best-effort */ }
}

function goStep(i) { stepIndex.value = i }

async function next() {
  const cur = activeStep.value
  if (cur && !doneSteps.value.includes(cur.order)) doneSteps.value.push(cur.order)
  if (cur) await markStep(cur.order)
  if (stepIndex.value < steps.value.length - 1) stepIndex.value += 1
}

function prev() { if (stepIndex.value > 0) stepIndex.value -= 1 }

async function finish() {
  const cur = activeStep.value
  if (cur && !doneSteps.value.includes(cur.order)) doneSteps.value.push(cur.order)
  completed.value = true
  try {
    await api.updateTutorialProgress(slug, { status: 'completed', completed_step: cur ? cur.order : undefined })
  } catch (e) { /* best-effort */ }
}

onMounted(load)
</script>

<style scoped>
.tutorial-detail {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 28px;
  min-height: 100%;
  padding: 30px 34px;
  background: #f8fbff;
  color: #0f172a;
}
.td-main { max-width: 880px; width: 100%; justify-self: center; }
.back-link { display: inline-flex; align-items: center; gap: 6px; color: #2563eb; font-size: 12.5px; font-weight: 800; text-decoration: none; margin-bottom: 16px; }
.back-link svg { width: 15px; height: 15px; }
.td-head { display: flex; gap: 16px; align-items: flex-start; }
.td-icon { display: grid; width: 48px; height: 48px; flex-shrink: 0; place-items: center; border-radius: 12px; }
.td-icon svg { width: 24px; height: 24px; }
.blue { background: #eef4ff; color: #2563eb; }
.violet { background: #f2efff; color: #7c3aed; }
.teal { background: #e7fbf6; color: #0faaa5; }
.mint { background: #e7fbf1; color: #10b981; }
.amber { background: #fff7e6; color: #d97706; }
.green { background: #e9fbf1; color: #10b981; }
.td-head h1 { margin: 0; font-size: 22px; font-weight: 850; }
.td-head p { margin: 8px 0 0; color: #64748b; font-size: 13.5px; line-height: 1.5; }
.td-meta { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 12px; color: #64748b; font-size: 12px; font-weight: 700; }
.td-meta span { display: inline-flex; align-items: center; gap: 5px; }
.td-meta svg { width: 14px; height: 14px; }
.cap { text-transform: capitalize; }
.done-pill { color: #059669; }
.td-progress { height: 6px; margin: 22px 0; border-radius: 999px; background: #e8eef7; overflow: hidden; }
.td-progress i { display: block; height: 100%; border-radius: inherit; background: #2563eb; transition: width .25s ease; }
.td-video { margin-bottom: 18px; }
.td-video a, .step-video { display: inline-flex; align-items: center; gap: 8px; color: #2563eb; font-weight: 800; font-size: 13px; text-decoration: none; }
.td-video svg, .step-video svg { width: 16px; height: 16px; }
.td-step { border: 1px solid #dfe7f2; border-radius: 12px; background: #fff; padding: 22px; box-shadow: 0 8px 22px rgba(15, 23, 42, .04); }
.step-head { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.step-num { display: grid; width: 28px; height: 28px; place-items: center; border-radius: 999px; background: #eef4ff; color: #2563eb; font-size: 13px; font-weight: 850; }
.step-head h2 { margin: 0; font-size: 16px; font-weight: 850; }
.step-body { color: #334155; font-size: 14px; line-height: 1.65; }
.step-body :deep(p) { margin: 0 0 12px; }
.step-body :deep(code) { background: #f1f5f9; padding: 2px 6px; border-radius: 5px; font-size: 12.5px; }
.step-body :deep(pre) { background: #0f172a; color: #e2e8f0; padding: 14px; border-radius: 9px; overflow: auto; }
.step-video { margin-top: 14px; }
.td-actions { display: flex; align-items: center; gap: 16px; margin-top: 22px; }
.td-actions .step-count { color: #64748b; font-size: 12px; font-weight: 750; }
.td-actions button { display: inline-flex; align-items: center; gap: 8px; height: 38px; border-radius: 9px; padding: 0 16px; font-size: 12.5px; font-weight: 850; }
.td-actions button svg { width: 15px; height: 15px; }
.primary { border: 0; background: #2563eb; color: #fff; }
.ghost { border: 1px solid #dbe4f0; background: #fff; color: #334155; }
.ghost:disabled { opacity: .5; }
.td-actions button.primary { margin-left: auto; }
.td-rail { display: grid; align-content: start; gap: 16px; }
.rail-card { border: 1px solid #dfe7f2; border-radius: 13px; background: #fff; padding: 18px; box-shadow: 0 8px 22px rgba(15, 23, 42, .04); }
.rail-card h2 { margin: 0 0 12px; font-size: 14px; font-weight: 850; }
.step-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.step-list li { display: flex; align-items: center; gap: 9px; padding: 8px 9px; border-radius: 8px; color: #475569; font-size: 12.5px; font-weight: 700; cursor: pointer; }
.step-list li:hover { background: #f5f8ff; }
.step-list li.active { background: #eef4ff; color: #2563eb; }
.step-list li.done .dot { color: #10b981; }
.step-list .dot svg { width: 14px; height: 14px; }
.empty { color: #64748b; font-size: 14px; }
.empty a { color: #2563eb; font-weight: 800; text-decoration: none; }
@media (max-width: 1100px) {
  .tutorial-detail { grid-template-columns: 1fr; }
  .td-rail { order: -1; }
}
@media (max-width: 680px) {
  .tutorial-detail { padding: 22px 16px; }
}
</style>
