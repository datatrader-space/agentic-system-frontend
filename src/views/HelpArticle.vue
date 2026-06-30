<template>
  <main class="ha-page">
    <section class="ha-main" v-if="content">
      <nav class="breadcrumbs">
        <template v-for="(b, i) in content.breadcrumbs" :key="i">
          <RouterLink v-if="b.url" :to="b.url">{{ b.label }}</RouterLink>
          <span v-else>{{ b.label }}</span>
          <Icon v-if="i < content.breadcrumbs.length - 1" icon="lucide:chevron-right" class="bc-sep" />
        </template>
      </nav>

      <header class="ha-head">
        <span :class="['type-badge', content.tone || 'blue']">{{ typeLabel(content.type) }}</span>
        <h1>{{ content.title }}</h1>
        <p v-if="content.summary" class="ha-summary">{{ content.summary }}</p>
        <div class="ha-meta">
          <span v-if="content.product_area"><Icon icon="lucide:folder" /> {{ content.product_area }}</span>
          <span v-if="content.difficulty" class="cap"><Icon icon="lucide:bar-chart-3" /> {{ content.difficulty }}</span>
          <span><Icon icon="lucide:clock-3" /> {{ content.estimated_read_time }} min read</span>
          <span><Icon icon="lucide:calendar" /> Updated {{ shortDate(content.last_updated) }}</span>
        </div>
        <div v-if="appAction" class="ha-actions">
          <button class="action-btn" @click="goTo(appAction.url)">{{ appAction.label }} <Icon icon="lucide:arrow-right" /></button>
        </div>
      </header>

      <article class="ha-body">
        <section
          v-for="s in sections"
          :key="s.anchor"
          :id="s.anchor"
          :ref="el => sectionEls[s.anchor] = el"
          :class="['ha-section', { highlight: highlightAnchor === s.anchor }]">
          <h2 v-if="s.heading && s.heading.toLowerCase() !== 'overview'" class="sec-h">
            {{ s.heading }}
            <a class="anchor-link" :href="`#${s.anchor}`" @click.prevent="jumpTo(s.anchor)"><Icon icon="lucide:link" /></a>
          </h2>
          <div class="md" v-html="render(s.body)"></div>
        </section>
      </article>

      <section class="ha-feedback">
        <template v-if="!feedbackSent">
          <span>Was this helpful?</span>
          <button class="fb yes" @click="sendFeedback(true)"><Icon icon="lucide:thumbs-up" /> Yes</button>
          <button class="fb no" @click="sendFeedback(false)"><Icon icon="lucide:thumbs-down" /> No</button>
        </template>
        <span v-else class="fb-thanks"><Icon icon="lucide:check" /> Thanks for your feedback!</span>
      </section>

      <nav v-if="prevItem || nextItem" class="ha-prevnext">
        <RouterLink v-if="prevItem" :to="prevItem.url" class="pn prev">
          <Icon icon="lucide:arrow-left" /><span><small>Previous</small><strong>{{ prevItem.title }}</strong></span>
        </RouterLink>
        <span v-else />
        <RouterLink v-if="nextItem" :to="nextItem.url" class="pn next">
          <span><small>Next</small><strong>{{ nextItem.title }}</strong></span><Icon icon="lucide:arrow-right" />
        </RouterLink>
      </nav>
    </section>

    <section class="ha-main" v-else-if="loadError">
      <p class="empty">This article isn’t available.
        <RouterLink to="/dashboard/help-center">Back to Help Center</RouterLink>
      </p>
    </section>

    <aside class="ha-rail" v-if="content">
      <section v-if="toc.length" class="rail-card toc">
        <h3>On this page</h3>
        <a v-for="t in toc" :key="t.anchor" :href="`#${t.anchor}`"
           :class="{ active: highlightAnchor === t.anchor }" @click.prevent="jumpTo(t.anchor)">{{ t.heading }}</a>
      </section>

      <section v-if="guidedTours.length" class="rail-card related tours">
        <h3>Guided tours</h3>
        <div v-for="t in guidedTours" :key="t.slug" class="tour-row">
          <span class="r-icon coral"><Icon icon="lucide:route" /></span>
          <span class="t-meta"><strong>{{ t.title }}</strong><small>{{ t.steps_count }} steps · {{ t.estimated_minutes }} min</small></span>
          <button class="t-start" @click="startTour(t.slug)"><Icon icon="lucide:play" /> Start</button>
        </div>
      </section>

      <section v-for="(items, rel) in relations" :key="rel" class="rail-card related">
        <h3>{{ relationLabel(rel) }}</h3>
        <RouterLink v-for="it in items" :key="it.slug" :to="it.url" class="related-row">
          <span :class="['r-icon', toneFor(it.type)]"><Icon :icon="iconFor(it.type)" /></span>
          <span><strong>{{ it.title }}</strong><small v-if="it.summary">{{ it.summary }}</small></span>
        </RouterLink>
      </section>

      <section class="rail-card need-help">
        <h3>Still need help?</h3>
        <button class="help-cta ghost" @click="assistantOpen = true"><Icon icon="lucide:sparkles" /> Ask the Help Assistant</button>
        <RouterLink to="/dashboard/help-center/support" class="help-cta"><Icon icon="lucide:life-buoy" /> Contact support</RouterLink>
      </section>
    </aside>

    <HelpAssistant v-model:open="assistantOpen" :current-page="`article:${route.params.slug}`" :product-area="content && content.product_area" />
  </main>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch, nextTick } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { marked } from 'marked'
import api from '../services/api'
import HelpAssistant from '../components/help/HelpAssistant.vue'
import { useGuidedTour } from '../composables/useGuidedTour'

const route = useRoute()
const router = useRouter()
const assistantOpen = ref(false)
const { launch: launchTour } = useGuidedTour()
const guidedTours = ref([])
function startTour(slug) { launchTour(slug) }

const content = ref(null)
const sections = ref([])
const toc = ref([])
const relations = ref({})
const loadError = ref(false)
const feedbackSent = ref(false)
const highlightAnchor = ref('')
const sectionEls = reactive({})
const prevItem = ref(null)
const nextItem = ref(null)

const TYPE_LABEL = { doc: 'Documentation', guide: 'Guide', tutorial: 'Tutorial', integration: 'Integration', faq: 'FAQ', learning_path: 'Learning path', guided_tour: 'Guided tour' }
const REL_LABEL = { related: 'Related', prerequisite: 'Prerequisites', next_step: 'Next steps', tutorial: 'Tutorials', documentation: 'Documentation', guided_tour: 'Guided tours', integration: 'Integrations', troubleshooting: 'Troubleshooting' }
const ICONS = { doc: 'lucide:file-text', guide: 'lucide:book-open', tutorial: 'lucide:play-circle', integration: 'lucide:link-2', faq: 'lucide:help-circle', learning_path: 'lucide:rocket', guided_tour: 'lucide:route' }
const TONES = { doc: 'blue', guide: 'blue', tutorial: 'teal', integration: 'violet', faq: 'coral', learning_path: 'blue', guided_tour: 'coral' }

function typeLabel(t) { return TYPE_LABEL[t] || 'Article' }
function relationLabel(r) { return REL_LABEL[r] || r }
function iconFor(t) { return ICONS[t] || 'lucide:file-text' }
function toneFor(t) { return TONES[t] || 'blue' }
function shortDate(d) { try { return new Date(d).toLocaleDateString() } catch { return '' } }
function render(md) { try { return marked.parse(md || '') } catch { return md || '' } }
function goTo(r) { if (r) router.push(r) }

// The "Open in app" related action (first integration/related target with an app route).
const appAction = computed(() => {
  const lists = Object.values(relations.value || {})
  for (const items of lists) {
    for (const it of items) {
      if (it.url && !it.url.startsWith('/dashboard/help-center')) {
        return { label: `Open ${it.title}`, url: it.url }
      }
    }
  }
  return null
})

async function load() {
  loadError.value = false; feedbackSent.value = false
  try {
    const { data } = await api.getHelpContent(route.params.slug)
    content.value = data.content
    sections.value = data.sections || []
    toc.value = data.toc || []
    relations.value = data.relations || {}
    guidedTours.value = data.guided_tours || []
    prevItem.value = data.prev || null
    nextItem.value = data.next || null
    await nextTick()
    handleHash()
  } catch (e) {
    loadError.value = true; content.value = null
  }
}

function handleHash() {
  const anchor = (route.hash || '').replace('#', '')
  if (!anchor) { window.scrollTo({ top: 0 }); return }
  highlight(anchor)
}

let _hlTimer = null
function highlight(anchor) {
  const el = sectionEls[anchor] || document.getElementById(anchor)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  highlightAnchor.value = anchor
  clearTimeout(_hlTimer)
  _hlTimer = setTimeout(() => { highlightAnchor.value = '' }, 4000)
}

function jumpTo(anchor) {
  // Update the hash without a full navigation, then highlight.
  router.replace({ hash: `#${anchor}` })
  highlight(anchor)
}

async function sendFeedback(helpful) {
  feedbackSent.value = true
  try { await api.sendHelpFeedback({ slug: route.params.slug, helpful }) } catch (e) { /* best-effort */ }
}

onMounted(load)
watch(() => route.params.slug, load)
watch(() => route.hash, handleHash)
</script>

<style scoped>
.ha-page { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 32px; min-height: 100%; padding: 30px 36px 60px; background: #f8fbff; color: #0f172a; }
.ha-main { max-width: 760px; width: 100%; justify-self: center; }
.breadcrumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12.5px; margin-bottom: 16px; }
.breadcrumbs a { color: #2563eb; text-decoration: none; font-weight: 700; }
.breadcrumbs span { color: #64748b; }
.bc-sep { width: 13px; height: 13px; color: #cbd5e1; }
.ha-head { border-bottom: 1px solid #e9eef5; padding-bottom: 20px; margin-bottom: 8px; }
.type-badge { display: inline-block; border-radius: 6px; padding: 3px 9px; font-size: 11px; font-weight: 850; }
.ha-head h1 { margin: 12px 0 0; font-size: 27px; font-weight: 850; line-height: 1.2; }
.ha-summary { margin: 10px 0 0; color: #475569; font-size: 15px; line-height: 1.5; }
.ha-meta { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 16px; color: #64748b; font-size: 12.5px; font-weight: 600; }
.ha-meta span { display: inline-flex; align-items: center; gap: 5px; }
.ha-meta svg { width: 14px; height: 14px; }
.cap { text-transform: capitalize; }
.ha-actions { margin-top: 16px; }
.action-btn { display: inline-flex; align-items: center; gap: 7px; height: 38px; border: 0; border-radius: 9px; background: #4f46e5; color: #fff; padding: 0 16px; font-size: 13px; font-weight: 800; cursor: pointer; }
.action-btn svg { width: 15px; height: 15px; }
.ha-body { margin-top: 8px; }
.ha-section { scroll-margin-top: 24px; border-radius: 12px; padding: 10px 14px; margin: 0 -14px; transition: background .3s ease, box-shadow .3s ease; }
.ha-section.highlight { background: #fffbeb; box-shadow: inset 0 0 0 1px #fde68a; }
.sec-h { display: flex; align-items: center; gap: 8px; margin: 22px 0 8px; font-size: 19px; font-weight: 800; }
.anchor-link { color: #cbd5e1; display: inline-flex; }
.anchor-link svg { width: 15px; height: 15px; }
.sec-h:hover .anchor-link { color: #94a3b8; }
.md { color: #334155; font-size: 14.5px; line-height: 1.7; }
.md :deep(p) { margin: 0 0 12px; }
.md :deep(ul), .md :deep(ol) { margin: 0 0 12px; padding-left: 22px; }
.md :deep(li) { margin: 4px 0; }
.md :deep(code) { background: #eef2f7; padding: 2px 6px; border-radius: 5px; font-size: 13px; }
.md :deep(pre) { background: #0f172a; color: #e2e8f0; padding: 14px 16px; border-radius: 10px; overflow: auto; }
.md :deep(pre code) { background: transparent; padding: 0; }
.md :deep(strong) { color: #0f172a; }
.md :deep(a) { color: #2563eb; }
.ha-feedback { display: flex; align-items: center; gap: 12px; margin-top: 32px; padding-top: 20px; border-top: 1px solid #e9eef5; color: #334155; font-size: 13.5px; font-weight: 600; }
.fb { display: inline-flex; align-items: center; gap: 6px; height: 34px; border: 1px solid #d8e2f0; border-radius: 8px; background: #fff; padding: 0 14px; font-size: 12.5px; font-weight: 700; cursor: pointer; }
.fb svg { width: 14px; height: 14px; }
.fb.yes:hover { border-color: #16a34a; color: #16a34a; }
.fb.no:hover { border-color: #dc2626; color: #dc2626; }
.fb-thanks { color: #16a34a; display: inline-flex; align-items: center; gap: 6px; }
.ha-prevnext { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 24px; }
.pn { display: flex; align-items: center; gap: 12px; border: 1px solid #dfe7f2; border-radius: 12px; background: #fff; padding: 14px 16px; text-decoration: none; color: inherit; }
.pn:hover { border-color: #b9c9ff; box-shadow: 0 8px 20px rgba(37,99,235,.07); }
.pn.next { justify-content: flex-end; text-align: right; }
.pn svg { width: 18px; height: 18px; color: #94a3b8; flex-shrink: 0; }
.pn small { display: block; color: #94a3b8; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; }
.pn strong { display: block; margin-top: 3px; font-size: 13.5px; font-weight: 800; }
@media (max-width: 680px) { .ha-prevnext { grid-template-columns: 1fr; } }
.ha-rail { display: grid; align-content: start; gap: 16px; }
.rail-card { border: 1px solid #dfe7f2; border-radius: 13px; background: #fff; padding: 16px 18px; box-shadow: 0 8px 22px rgba(15, 23, 42, .04); }
.rail-card h3 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #64748b; font-weight: 850; }
.toc { position: sticky; top: 24px; }
.toc a { display: block; padding: 6px 0 6px 12px; border-left: 2px solid transparent; color: #64748b; font-size: 12.5px; font-weight: 650; text-decoration: none; }
.toc a:hover { color: #334155; }
.toc a.active { border-color: #2563eb; color: #2563eb; }
.related-row { display: flex; align-items: center; gap: 11px; padding: 8px 0; text-decoration: none; color: inherit; }
.related-row + .related-row { border-top: 1px solid #f1f5f9; }
.r-icon { display: grid; width: 32px; height: 32px; flex-shrink: 0; place-items: center; border-radius: 8px; }
.r-icon svg { width: 16px; height: 16px; }
.blue { background: #eef4ff; color: #2563eb; } .violet { background: #f2efff; color: #7c3aed; }
.teal { background: #e7fbf6; color: #0faaa5; } .coral { background: #fff1ed; color: #f15b3d; }
.tour-row { display: flex; align-items: center; gap: 11px; padding: 8px 0; }
.tour-row + .tour-row { border-top: 1px solid #f1f5f9; }
.t-meta { min-width: 0; flex: 1; }
.t-meta strong { display: block; font-size: 12.5px; font-weight: 800; }
.t-meta small { display: block; margin-top: 2px; color: #94a3b8; font-size: 11px; }
.t-start { display: inline-flex; align-items: center; gap: 5px; height: 30px; border: 0; border-radius: 8px; background: #4f46e5; color: #fff; padding: 0 12px; font-size: 11.5px; font-weight: 800; cursor: pointer; }
.t-start svg { width: 12px; height: 12px; }
.related-row strong { display: block; font-size: 12.5px; font-weight: 800; }
.related-row small { display: block; margin-top: 2px; color: #94a3b8; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.need-help .help-cta { display: flex; align-items: center; gap: 8px; width: 100%; height: 40px; border: 1px solid #dbe4f0; border-radius: 9px; background: #fff; padding: 0 14px; margin-top: 8px; color: #334155; font-size: 13px; font-weight: 700; text-decoration: none; cursor: pointer; }
.need-help .help-cta.ghost { color: #4f46e5; }
.need-help .help-cta svg { width: 16px; height: 16px; }
.empty { color: #64748b; font-size: 15px; }
.empty a { color: #2563eb; font-weight: 700; }
@media (max-width: 1080px) {
  .ha-page { grid-template-columns: 1fr; }
  .ha-rail { order: -1; }
  .toc { position: static; }
}
@media (max-width: 680px) { .ha-page { padding: 22px 16px 50px; } }
</style>
