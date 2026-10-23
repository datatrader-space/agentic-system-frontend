<template>
  <section class="st-workspace hf" aria-label="Creative suite">
    <nav class="hf-quick" aria-label="Quick tools"><RouterLink v-for="tool in quickTools" :key="tool.id" :to="featureLink(tool)" class="st-button" :data-test="`studio-quick-${tool.id}`">{{ tool.id === 'marketing' ? 'Product video' : tool.label }}<span v-if="tool.status === 'soon'" class="st-pill soon">Soon</span></RouterLink></nav>
    <p v-if="loading" class="st-status" role="status">Loading your recent work...</p>
    <div v-for="error in errors" :key="error" class="st-error" role="alert">{{ error }} <button type="button" class="st-button" @click="load">Try again</button></div>
    <section v-if="recent.length" class="hf-continue" aria-labelledby="continue-title"><h2 id="continue-title">Continue</h2><ul class="hf-recent-grid"><li v-for="item in recent" :key="item.key"><RouterLink :to="item.to"><img v-if="item.thumbnail" :src="item.thumbnail" alt="" loading="lazy" /><svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path :d="studioIcons[item.icon] || studioIcons.folder" /></svg><span><strong>{{ item.title }}</strong><small><template v-if="item.page">{{ item.page }} &middot; </template>{{ item.type }}</small></span></RouterLink></li></ul></section>
    <section v-else-if="!loading && !errors.length && firstVisit" class="hf-start" aria-labelledby="start-title"><h2 id="start-title">Start here</h2><p class="st-muted">Choose a starting point, add your input, then review the price on its card.</p><ul class="hf-start-grid"><li v-for="start in starts" :key="start.title"><RouterLink :to="start.to" class="st-button"><strong>{{ start.title }}</strong><span>{{ start.preset }}</span></RouterLink></li></ul></section>
    <header class="hf-heading"><div><h2>All tools</h2><p class="st-muted">A page for each part of your creative workflow.</p></div><label class="st-field"><span class="st-sr">Filter features</span><select v-model="group" class="st-input"><option>All features</option><option v-for="name in STUDIO_GROUPS.filter(name => name !== 'Home')" :key="name">{{ name }}</option></select></label></header>
    <section v-for="section in sections" :key="section.label" class="hf-section"><h3>{{ section.label }}</h3><ul class="hf-grid" aria-label="Studio features"><li v-for="feature in section.items" :key="feature.id"><RouterLink :to="featureLink(feature)" class="hf-card" :class="{ 'is-soon': feature.status === 'soon' }" :data-test="`studio-feature-${feature.id}`"><div class="hf-card-head"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="studioIcons[feature.icon]" /></svg><span v-if="feature.status !== 'live'" class="st-pill" :class="feature.status">{{ feature.status === 'soon' ? `Soon · ${feature.phase}` : 'Beta' }}</span></div><h3>{{ feature.label }}</h3><p>{{ feature.purpose }}</p></RouterLink></li></ul></section>
    <p class="hf-help st-muted"><RouterLink to="/video-studio/help" class="st-link">How the Studio works</RouterLink><span>Review each run's price on its approval card before it starts. Image session approval follows your choice on the card.</span></p>
  </section>
</template>
<script setup>
import { studioChatName } from '../../services/studioMessagePresentation'
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import api from '../../services/api'
import { STUDIO_GROUPS, studioFeatures, studioIcons, featureLink, orderedFeatures, getStudioFeature } from '../../services/studioFeatures'
import { studioOrigin } from '../../services/studioOrigins'
import './studio.css'
const user = inject('studioUser', ref(null))
const group = ref('All features'), loading = ref(true), errors = ref([]), chats = ref([]), projects = ref([]), results = ref([]), firstVisit = ref(true)
const visitKey = computed(() => user.value?.id ? `aadml.studio.home.visited.${user.value.id}` : '')
watch(visitKey, (key, previous) => {
  try { firstVisit.value = !key || localStorage.getItem(key) !== 'visited' } catch { firstVisit.value = true }
  if (previous && key !== previous) { chats.value = []; projects.value = []; results.value = []; load() } else rememberVisit()
}, { immediate: true })
function rememberVisit() { if (!loading.value && !errors.value.length && visitKey.value) try { localStorage.setItem(visitKey.value, 'visited') } catch { /* optional preference */ } }
const features = computed(() => orderedFeatures().filter(f => f.id !== 'home' && (group.value === 'All features' || f.group === group.value)))
const sections = computed(() => STUDIO_GROUPS.map(label => ({ label, items: features.value.filter(f => f.group === label) })).filter(s => s.items.length))
const quickTools = computed(() => ['image','video','marketing','avatar','enhance','elements'].map(getStudioFeature))
const starts = [
  { title: 'A product photo', preset: 'Quiet tabletop', to: { path: '/video-studio/image', query: { preset: 'tabletop-product' } } },
  { title: 'A moving product shot', preset: 'A measured reveal', to: { path: '/video-studio/video', query: { preset: 'product-unveil' } } },
  { title: 'A character reference', preset: 'Character anchor', to: { path: '/video-studio/image', query: { preset: 'character-anchor' } } },
]
const date = item => Date.parse(item.updated_at || item.created_at || '') || 0
function origin(item, fallback) {
  const feature = getStudioFeature(item.studio_feature || item.feature_id)
  return feature && feature.status !== 'soon' ? feature : studioOrigin(user.value?.id, item.attachment_id ? 'attachment' : 'conversation', item.attachment_id || item.conversation_id || item.id) || getStudioFeature(fallback)
}
const recent = computed(() => [
  ...chats.value.map(c => { const f = origin(c, null); return { key: `chat-${c.id}`, title: studioChatName(c.name), thumbnail: f ? c.thumbnail_url : '', icon: f?.icon || 'chat', page: f?.label || '', type: 'Chat', at: date(c), to: { path: f ? featureLink(f) : '/video-studio', query: { conversation: String(c.id) } } } }),
  ...projects.value.map(p => ({ key: `project-${p.project_id}`, title: p.title || 'Untitled project', thumbnail: p.thumbnail_url, icon: 'video', page: 'Video', type: 'Project', at: date(p), to: { path: '/video-studio', query: p.conversation_id ? { conversation: String(p.conversation_id) } : { project: String(p.project_id) } } })),
  ...results.value.map(r => { const f = origin(r, r.media_type === 'image' ? 'image' : 'video'); return { key: `result-${r.attachment_id}`, title: r.title || r.filename || 'Generated result', thumbnail: r.thumbnail_url || (r.media_type === 'image' ? r.url : ''), icon: f.icon, page: f.label, type: 'Result', at: date(r), to: { path: featureLink(f), query: r.conversation_id ? { conversation: String(r.conversation_id), results: '1' } : { results: '1' } } } }),
].sort((a,b) => b.at - a.at).slice(0,6))
let disposed = false, sequence = 0
async function load() {
  const seq = ++sequence
  loading.value = true; errors.value = []
  const responses = await Promise.allSettled([api.get('/video/chats/', { params: { page: 1, page_size: 6 } }), api.get('/video/projects/'), api.get('/video/library/', { params: { source: 'generated', type: 'all', page: 1, limit: 6 } })])
  if (disposed || seq !== sequence) return
  const lists = [chats, projects, results], fields = ['results','projects','items'], names = ['recent chats','projects','generated results']
  responses.forEach((response,index) => { if (response.status === 'fulfilled') lists[index].value = (response.value.data[fields[index]] || []).slice(0,6); else errors.value.push(`Could not load ${names[index]}.`) })
  loading.value = false; rememberVisit()
}
onMounted(load)
onBeforeUnmount(() => { disposed = true; sequence++ })
</script>
<style scoped>
.hf{display:grid;gap:24px;margin-top:24px;text-align:left}.hf-quick{display:flex;gap:8px;flex-wrap:wrap}.hf-quick .st-button{font-size:13px;gap:7px}.hf-heading{display:flex;justify-content:space-between;align-items:center;gap:16px}.hf-heading p,.hf-start>p{font-size:13px;margin-top:6px}.hf-heading select{min-width:160px;font-size:12px}.hf-section{display:grid;gap:12px}.hf-section>h3{font-size:13px;color:var(--vm-ink-soft);font-weight:500}.hf-grid,.hf-recent-grid,.hf-start-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:0;padding:0;list-style:none}.hf-grid li{min-width:0}.hf-card{display:flex;flex-direction:column;gap:10px;min-height:180px;height:100%;padding:18px;border:1px solid var(--vm-line);border-radius:8px;background:var(--vm-surface);color:var(--vm-ink);text-decoration:none;cursor:pointer}.hf-card:hover{background:var(--vm-surface-2);border-color:var(--vm-ink-soft)}.hf-card.is-soon{background:var(--vm-bg);color:var(--vm-ink-soft)}.hf-card-head{display:flex;align-items:center;justify-content:space-between;gap:6px}.hf-card svg{width:24px;height:24px;color:var(--vs-accent-ink)}.hf-card.is-soon svg{color:var(--vm-ink-soft)}.hf-card h3{margin:0;font-size:15px;font-weight:600}.hf-card p{font-size:13px;line-height:1.6;color:var(--vm-ink-soft)}.hf-continue,.hf-start{display:grid;gap:14px;padding-block:20px;border-block:1px solid var(--vm-line-2)}.hf-recent-grid a{display:flex;gap:12px;align-items:center;height:100%;min-height:76px;padding:12px;border:1px solid var(--vm-line);border-radius:8px;background:var(--vm-surface);color:var(--vm-ink);text-decoration:none}.hf-recent-grid img,.hf-recent-grid svg{flex:none;width:48px;height:40px;object-fit:cover;border-radius:4px;color:var(--vm-ink-soft)}.hf-recent-grid a>span{display:grid;gap:6px;min-width:0}.hf-recent-grid strong{font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hf-recent-grid small{font-size:12px;color:var(--vm-ink-soft)}.hf-start-grid a{display:grid;justify-content:start;gap:7px;height:100%;padding:16px}.hf-start-grid strong{font-size:14px;font-weight:600}.hf-start-grid span{font-size:12px;color:var(--vm-ink-soft)}.hf-help{display:flex;flex-wrap:wrap;gap:10px;padding-block:14px;font-size:12px;line-height:1.6}@media(max-width:767px){.hf-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.hf-heading{align-items:flex-start;flex-direction:column}.hf-card{padding:13px;min-height:190px}.hf-card h3{font-size:15px}.hf-card p{font-size:13px}.hf-recent-grid,.hf-start-grid{grid-template-columns:1fr}.hf-heading .st-field{width:100%}.hf-quick .st-button{min-height:44px}}
</style>
