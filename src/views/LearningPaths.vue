<template>
  <main class="lp-page">
    <section class="lp-main">
      <nav class="breadcrumbs">
        <RouterLink to="/dashboard/help-center">Help Center</RouterLink>
        <Icon icon="lucide:chevron-right" class="bc-sep" />
        <span>Learning paths</span>
      </nav>

      <header class="lp-head">
        <div>
          <h1>Learning paths</h1>
          <p>Guided, ordered tracks that take you from zero to confident — step by step.</p>
        </div>
        <RouterLink to="/dashboard/help-center" class="search-link"><Icon icon="lucide:search" /> Search help</RouterLink>
      </header>

      <div v-if="loading" class="lp-grid">
        <div v-for="n in 4" :key="n" class="lp-card skeleton"><span class="skel s1" /><span class="skel s2" /><span class="skel s3" /></div>
      </div>

      <div v-else-if="error" class="state error">
        <Icon icon="lucide:alert-triangle" /><p>Couldn’t load learning paths.</p>
        <button class="btn" @click="load">Retry</button>
      </div>

      <div v-else-if="!paths.length" class="state empty">
        <Icon icon="lucide:route" /><p>No learning paths yet.</p>
        <RouterLink to="/dashboard/help-center/docs" class="btn">Browse documentation</RouterLink>
      </div>

      <div v-else class="lp-grid">
        <RouterLink v-for="p in paths" :key="p.slug" :to="`/dashboard/help-center/learning-paths/${p.slug}`" class="lp-card">
          <div class="lp-top">
            <span :class="['lp-icon', p.tone || 'blue']"><Icon :icon="p.icon || 'lucide:rocket'" /></span>
            <span v-if="p.difficulty" :class="['diff', p.difficulty]">{{ p.difficulty }}</span>
          </div>
          <h3>{{ p.title }}</h3>
          <p>{{ p.summary }}</p>
          <div class="lp-meta">
            <span><Icon icon="lucide:clock-3" /> {{ p.estimated_read_time }} min</span>
            <span class="go">Start path <Icon icon="lucide:arrow-right" /></span>
          </div>
          <div v-if="progressOf(p.slug)" class="lp-progress"><i :style="{ width: progressOf(p.slug) + '%' }" /></div>
        </RouterLink>
      </div>
    </section>
  </main>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { Icon } from '@iconify/vue'
import api from '../services/api'
import { pathProgressPercent } from '../composables/useHelpProgress'

const paths = ref([])
const loading = ref(true)
const error = ref(false)

function progressOf(slug) { return pathProgressPercent(slug) }

async function load() {
  loading.value = true; error.value = false
  try {
    const { data } = await api.getHelpLearningPaths()
    paths.value = data?.learning_paths || []
  } catch (e) { error.value = true }
  loading.value = false
}
onMounted(load)
</script>

<style scoped>
.lp-page { min-height: 100%; padding: 30px 36px 60px; background: #f8fbff; color: #0f172a; }
.lp-main { max-width: 1040px; margin: 0 auto; }
.breadcrumbs { display: flex; align-items: center; gap: 6px; font-size: 12.5px; margin-bottom: 16px; }
.breadcrumbs a { color: #2563eb; text-decoration: none; font-weight: 700; }
.breadcrumbs span { color: #64748b; }
.bc-sep { width: 13px; height: 13px; color: #cbd5e1; }
.lp-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 22px; }
.lp-head h1 { margin: 0; font-size: 25px; font-weight: 850; }
.lp-head p { margin: 8px 0 0; color: #64748b; font-size: 14px; max-width: 560px; }
.search-link { display: inline-flex; align-items: center; gap: 7px; height: 38px; border: 1px solid #dbe4f0; border-radius: 9px; background: #fff; padding: 0 14px; color: #334155; font-size: 13px; font-weight: 700; text-decoration: none; }
.search-link svg { width: 15px; height: 15px; }
.lp-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.lp-card { display: block; border: 1px solid #dfe7f2; border-radius: 14px; background: #fff; padding: 20px; text-decoration: none; color: inherit; box-shadow: 0 1px 2px rgba(15,23,42,.04); transition: border-color .15s, box-shadow .15s, transform .15s; }
.lp-card:hover { border-color: #b9c9ff; box-shadow: 0 12px 28px rgba(37,99,235,.10); transform: translateY(-2px); }
.lp-top { display: flex; align-items: center; justify-content: space-between; }
.lp-icon { display: grid; width: 44px; height: 44px; place-items: center; border-radius: 11px; }
.lp-icon svg { width: 22px; height: 22px; }
.blue { background: #eef4ff; color: #2563eb; } .violet { background: #f2efff; color: #7c3aed; }
.teal { background: #e7fbf6; color: #0faaa5; } .coral { background: #fff1ed; color: #f15b3d; }
.diff { border-radius: 6px; padding: 3px 9px; font-size: 10.5px; font-weight: 850; text-transform: capitalize; }
.diff.beginner { background: #dff8ef; color: #059669; } .diff.intermediate { background: #fff5d9; color: #b7791f; } .diff.advanced { background: #fff1f3; color: #e11d48; }
.lp-card h3 { margin: 14px 0 0; font-size: 16px; font-weight: 850; }
.lp-card p { margin: 7px 0 0; color: #64748b; font-size: 13px; line-height: 1.5; }
.lp-meta { display: flex; align-items: center; justify-content: space-between; margin-top: 16px; color: #64748b; font-size: 12.5px; font-weight: 600; }
.lp-meta span { display: inline-flex; align-items: center; gap: 5px; }
.lp-meta svg { width: 14px; height: 14px; }
.go { color: #2563eb; font-weight: 800; }
.lp-progress { height: 5px; margin-top: 14px; border-radius: 999px; background: #eef2f7; overflow: hidden; }
.lp-progress i { display: block; height: 100%; background: #2563eb; border-radius: inherit; }
.state { display: grid; place-items: center; gap: 12px; padding: 60px 20px; text-align: center; color: #64748b; }
.state svg { width: 34px; height: 34px; color: #cbd5e1; }
.state.error svg { color: #f59e0b; }
.btn { display: inline-flex; align-items: center; height: 36px; border: 1px solid #dbe4f0; border-radius: 9px; background: #fff; padding: 0 16px; color: #2563eb; font-size: 13px; font-weight: 700; text-decoration: none; cursor: pointer; }
.skeleton { pointer-events: none; }
.skel { display: block; border-radius: 8px; background: linear-gradient(90deg,#eef2f7,#f8fafc,#eef2f7); background-size: 200% 100%; animation: sh 1.2s infinite; }
.skel.s1 { width: 44px; height: 44px; } .skel.s2 { width: 60%; height: 16px; margin-top: 16px; } .skel.s3 { width: 100%; height: 12px; margin-top: 10px; }
@keyframes sh { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
@media (max-width: 760px) { .lp-page { padding: 22px 16px; } .lp-grid { grid-template-columns: 1fr; } .lp-head { flex-direction: column; } }
</style>
