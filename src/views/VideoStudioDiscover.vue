<template>
  <section class="discover st-workspace" aria-labelledby="discover-title" data-test="studio-discover">
    <header class="discover-heading"><div class="discover-eyebrow">DISCOVER YOUR CREATIVE STUDIO</div><h1 id="discover-title">What will you create next?</h1><p>Choose a look or a tool. Your agent helps with the rest.</p><RouterLink class="st-button primary" to="/video-studio/dashboard" aria-label="Ask your Studio agent"><span class="discover-agent-label">✧ Ask your Studio agent →</span><span class="discover-agent-short" aria-hidden="true">✧ Ask agent</span></RouterLink></header>
    <nav class="discover-views" aria-label="Discover views"><button v-for="view in views" :key="view.id" type="button" :aria-pressed="active === view.id" :class="{ active: active === view.id }" @click="active = view.id">{{ view.label }} <span>{{ view.id === 'tools' ? features.length : studioLooks.length }}</span></button></nav>
    <div class="discover-toolbar"><div><h2>{{ active === 'tools' ? 'All tools' : 'Choose a look. Make it yours.' }}</h2><p>{{ active === 'tools' ? 'A page for each part of your creative workflow.' : 'Each look is a prepared prompt and the references it needs. Open one and make it yours.' }}</p></div><div v-if="active === 'tools'" class="discover-mode"><span>Open creative tools in</span><StudioModeSwitch /></div></div>
    <div class="discover-controls"><div class="discover-filters" role="group" aria-label="Filter features"><button v-for="name in active === 'tools' ? ['All features', ...categories] : ['All', ...lookCategories]" :key="name" type="button" :aria-pressed="(active === 'tools' ? category : lookCategory) === name" @click="active === 'tools' ? category = name : lookCategory = name">{{ name }}</button></div><div class="discover-search-row"><label class="discover-search"><span class="st-sr">Search {{ active === 'tools' ? 'features' : 'looks' }}</span><input v-model="query" type="search" :placeholder="active === 'tools' ? 'Search tools, features or what you want to do…' : 'Find a look or style…'" /></label><span>{{ active === 'tools' ? sections.reduce((total,section) => total + section.items.length,0) + ' tools' : shownLooks.length + ' looks' }}</span></div></div>
    <template v-if="active === 'tools'"><section v-for="section in sections" :key="section.label" :data-count="section.items.length" class="discover-section"><div class="discover-section-title"><h2>{{ section.label }}</h2><small>{{ section.items.length }} tools</small></div><div class="discover-tools"><RouterLink v-for="feature in section.items" :key="feature.id" :to="toolLink(feature)" class="discover-tool" :data-test="`discover-tool-${feature.id}`"><div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path :d="studioIcons[feature.icon]" /></svg><h3>{{ feature.label }}</h3><span v-if="feature.status !== 'live'" class="st-pill">{{ feature.status === 'soon' ? 'Soon' : 'Beta' }}</span><span class="discover-arrow">↗</span></div><p>{{ feature.purpose }}</p><footer><span>{{ creative(feature.id) ? (video.studioMode === 'agent' ? '✧ Open in Agent' : '☷ Open in Manual') : 'Open '+feature.label }}</span><small v-if="lookCount(feature.id)">{{ lookCount(feature.id) }} ready-made looks</small></footer></RouterLink></div></section></template>
    <div v-else class="discover-look-collection"><div class="discover-look-options"><label><span>Creative tool</span><select v-model="lookTool" aria-label="Filter looks by creative tool"><option value="">All {{ lookToolCount }} tools</option><option v-for="feature in features.filter(f => creative(f.id))" :key="feature.id" :value="feature.id">{{ feature.label }}</option></select></label><label><span>Sort templates</span><select v-model="sort" aria-label="Sort templates"><option>Featured</option><option>Name A–Z</option><option>Fewest inputs</option></select></label></div><section v-if="route.query.saved" id="my-templates" ref="mineSection" class="discover-look-group discover-mine" aria-labelledby="discover-mine-title" tabindex="-1" data-test="my-templates"><h2 id="discover-mine-title">My templates <span class="discover-mine-count">{{ mine.templates.value.length }}</span></h2><p v-if="mine.error.value" class="st-error" role="alert">{{ mine.error.value }} <button type="button" class="st-button" @click="mine.reload()">Try again</button></p><p v-else-if="mine.loading.value" class="st-status" role="status">Loading your templates…</p><p v-else-if="!mine.templates.value.length" class="st-empty" role="status" data-test="my-templates-empty">No templates of your own yet. Open a look, change its texts and choose Save as my template.</p><ul v-else class="discover-mine-list"><li v-for="template in mine.templates.value" :key="template.id" class="discover-mine-card" :data-test="`my-template-${template.id}`"><form v-if="renaming === template.id" class="discover-mine-rename" :aria-label="`Rename ${template.title}`" @submit.prevent="saveRename(template)" @keydown.esc.prevent="stopRename(template)"><label class="st-field">Template name<input :ref="setRenameInput" v-model="renameText" class="st-input" data-test="my-template-rename-input" :maxlength="TEMPLATE_TITLE_MAX" required :aria-invalid="renameError ? 'true' : undefined" :aria-describedby="renameError ? `rename-error-${template.id}` : undefined" /></label><div class="discover-mine-actions"><button type="submit" class="st-button primary" data-test="my-template-rename-save" :disabled="busy || !renameText.trim()">{{ busy ? 'Saving…' : 'Save name' }}</button><button type="button" class="st-button" :disabled="busy" @click="stopRename(template)">Cancel</button></div><p v-if="renameError" :id="`rename-error-${template.id}`" class="st-error" role="alert" data-test="my-template-error">{{ renameError }}</p></form><template v-else><small>{{ getStudioFeature(template.page)?.label || template.page }}</small><h3>{{ template.title }}</h3><p>{{ promptStart(template.prompt) }}</p><footer class="discover-mine-actions"><RouterLink v-if="useLink(template)" :to="useLink(template)" class="st-button primary" data-test="my-template-use" :aria-label="`Use ${template.title}`">Use</RouterLink><span v-else class="st-muted">This page is not available.</span><button :ref="el => setRenameButton(template.id, el)" type="button" class="st-button" data-test="my-template-rename" :aria-label="`Rename ${template.title}`" :disabled="busy" @click="startRename(template)">Rename</button><button type="button" class="st-button" data-test="my-template-delete" :aria-label="`Delete ${template.title}`" :disabled="busy" @click="removeTemplate(template)">Delete</button></footer></template></li></ul><p v-if="listError" class="st-error" role="alert" data-test="my-template-list-error">{{ listError }}</p></section><section v-for="group in lookGroups" :key="group.title" class="discover-look-group"><h2>{{ group.title }}</h2><div class="discover-looks" :class="{featured:group.featured}"><article v-for="look in group.items" :key="look.id" class="discover-look-card"><button type="button" class="discover-save" :aria-label="(saved.ids.value.includes(look.id) ? 'Unsave ' : 'Save ') + look.title" :aria-pressed="saved.ids.value.includes(look.id)" @click="saved.toggle(look.id)">{{ saved.ids.value.includes(look.id) ? '♥' : '♡' }}</button><RouterLink :to="{ path: getStudioFeature(look.feature)?.route, query: { preset: look.id, mode: 'agent' } }" class="discover-look" :data-test="`discover-look-${look.id}`"><StudioLookMedia :look="look" /><div><small>{{ getStudioFeature(look.feature)?.label }}</small><h3>{{ look.title }} <span>↗</span></h3><p>{{ look.purpose }}</p><footer>Prepared prompt <span>Use this look →</span></footer></div></RouterLink></article></div></section></div>
    <p v-if="active === 'tools' ? !sections.length : !shownLooks.length" class="st-empty" role="status">{{ route.query.saved ? 'No saved looks yet. Save a look with its heart button to find it here.' : 'No matches. Try another phrase or category.' }} <RouterLink v-if="route.query.saved" to="/video-studio?view=looks" class="st-link">Browse all looks</RouterLink></p>
    <p class="discover-foot st-muted">Start with the result you want. Review each price on its approval card before anything is generated.</p>
  </section>
</template>
<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { RouterLink } from 'vue-router'
import { studioFeatures, STUDIO_GROUPS, getStudioFeature, studioIcons } from '../services/studioFeatures'
import { studioLooks } from '../services/studioLooks'
import StudioModeSwitch from '../components/studio/StudioModeSwitch.vue'
import { useVideoStore } from '../stores/useVideoStore'
import StudioLookMedia from '../components/studio/StudioLookMedia.vue'
import { useStudioSavedLooks } from '../composables/useStudioSavedLooks'
import { useStudioTemplates, TEMPLATE_TITLE_MAX } from '../composables/useStudioTemplates'
import { confirm } from '../composables/useConfirm'
import '../components/studio/studio.css'
const route = useRoute(), router = useRouter()
watch(() => [route.query.conversation, route.query.project], ([conversation,project]) => { if (conversation || project) router.replace({ path: '/video-studio/dashboard', query: route.query, hash: route.hash }) }, { immediate: true })
const video = useVideoStore()
const lookTool=ref(''), lookCategory=ref('All'), sort=ref('Featured')
const lookCategories=[...new Set(studioLooks.map(look => look.category))]
const saved = useStudioSavedLooks()
const active = ref(route.query.view === 'looks' || route.query.saved ? 'looks' : 'tools'), category = ref('All features'), query = ref('')
watch(() => [route.query.view, route.query.saved], ([view, onlySaved]) => { if (view === 'looks' || onlySaved) active.value = 'looks' })
const views = [{ id: 'tools', label: 'All tools' }, { id: 'looks', label: 'Ready-made looks' }]
const features = computed(() => studioFeatures.value.filter(f => f.id !== 'home'))
const categories = STUDIO_GROUPS.filter(name => name !== 'Home')
const creative = id => !['projects','library','help'].includes(id)
// The tools that have looks, counted from the catalogue rather than written into the label.
const lookToolCount = computed(() => features.value.filter(f => creative(f.id)).length)
const toolLink = feature => creative(feature.id) ? { path: feature.route, query: { mode: video.studioMode } } : feature.route
const lookCount = id => studioLooks.filter(look => look.feature === id).length
const matches = text => text.toLowerCase().includes(query.value.trim().toLowerCase())
const sections = computed(() => categories.filter(name => category.value === 'All features' || category.value === name).map(label => ({ label, items: features.value.filter(f => f.group === label && matches(f.label+' '+f.purpose)) })).filter(section => section.items.length))
const shownLooks = computed(() => studioLooks.filter(look => (!route.query.saved || saved.ids.value.includes(look.id)) && (!lookTool.value || look.feature === lookTool.value) && (lookCategory.value === 'All' || look.category === lookCategory.value) && matches(look.title+' '+look.purpose+' '+getStudioFeature(look.feature)?.label)).slice().sort((a,b) => sort.value === 'Name A–Z' ? a.title.localeCompare(b.title) : sort.value === 'Fewest inputs' ? a.slots.filter(s=>s.required).length - b.slots.filter(s=>s.required).length : 0))
// My templates: the person's own saved directions. Use opens the template's page filled in (nothing is sent there);
// Rename asks for the name in the card; Delete asks first in the app's confirm dialog.
const mine = useStudioTemplates()
const renaming = ref(null), renameText = ref(''), renameError = ref(''), listError = ref(''), busy = ref(false), mineSection = ref(null)
const renameButtons = {}
let renameInput = null
const setRenameInput = el => { renameInput = el }
const setRenameButton = (id, el) => { if (el) renameButtons[id] = el; else delete renameButtons[id] }
const promptStart = text => { const value = String(text || '').replace(/\s+/g, ' ').trim(); return value.length > 140 ? value.slice(0, 140).trimEnd() + '…' : value }
function useLink(template) { const path = getStudioFeature(template.page)?.route; return path ? { path, query: { template: String(template.id), mode: video.studioMode } } : null }
async function startRename(template) { renaming.value = template.id; renameText.value = template.title; renameError.value = ''; listError.value = ''; await nextTick(); renameInput?.focus(); renameInput?.select?.() }
async function stopRename(template) { if (busy.value) return; renaming.value = null; renameError.value = ''; await nextTick(); renameButtons[template.id]?.focus() }
async function saveRename(template) {
  if (busy.value) return
  busy.value = true; renameError.value = ''
  try {
    const result = await mine.rename(template.id, renameText.value)
    if (result.ok) { renaming.value = null; await nextTick(); renameButtons[template.id]?.focus() }
    else if (!mine.find(template.id)) { renaming.value = null; listError.value = result.error || '' }
    else renameError.value = result.error || 'Could not rename your template.'
  } finally { busy.value = false }
}
async function removeTemplate(template) {
  if (busy.value) return
  listError.value = ''
  const ok = await confirm({ title: 'Delete template?', message: `"${template.title}" is removed from your account. This cannot be undone.`, confirmText: 'Delete', danger: true })
  if (!ok) return
  busy.value = true
  try { const result = await mine.remove(template.id); if (!result.ok && result.error) listError.value = result.error } finally { busy.value = false }
}
// The sidebar's My templates link opens this view at #my-templates.
watch(() => [route.hash, route.query.saved, mine.ready.value], async ([hash, onlySaved]) => { if (hash === '#my-templates' && onlySaved) { await nextTick(); mineSection.value?.scrollIntoView?.({ block: 'start' }); mineSection.value?.focus?.({ preventScroll: true }) } }, { immediate: true })
const featuredIds=['image-look-1','video-look-1','video-look-3']
const lookGroups=computed(()=>{
  const showFeatured=!route.query.saved&&!query.value&&!lookTool.value&&lookCategory.value==='All'&&sort.value==='Featured'
  return showFeatured ? [{title:'Featured looks',featured:true,items:shownLooks.value.filter(l=>featuredIds.includes(l.id))},{title:'All ready-made looks',items:shownLooks.value.filter(l=>!featuredIds.includes(l.id))}] : [{title:route.query.saved?'Saved templates':'All ready-made looks',items:shownLooks.value}]
})

</script>
<style scoped>
.discover{max-width:1680px;margin:auto;padding:38px 36px 50px}.discover-heading{margin-bottom:26px}.discover-eyebrow{font-size:10px;color:var(--vm-ink-faint);letter-spacing:.15em;margin-bottom:12px}.discover-heading h1{font-size:34px;line-height:1.2;font-weight:600;letter-spacing:-.045em}.discover-heading p{color:var(--vm-ink-soft);margin:12px 0 18px;font-size:14px}.discover-views{display:flex;gap:28px;border-bottom:1px solid var(--vm-line);margin-bottom:28px}.discover-views button{display:flex;align-items:center;gap:9px;min-height:52px;padding:10px 0;border:0;border-bottom:2px solid transparent;background:none;color:var(--vm-ink-soft);font:500 14px var(--vm-font-sans);cursor:pointer}.discover-views button.active{color:var(--vm-ink);border-color:var(--vs-accent-ink)}.discover-views span{font-size:11px;border-radius:5px;background:var(--vm-surface-2);padding:3px 6px}.discover-toolbar{display:flex;justify-content:space-between;gap:20px;align-items:center;margin-bottom:20px}.discover-toolbar h2{font-size:24px;letter-spacing:-.03em}.discover-toolbar p{color:var(--vm-ink-soft);margin-top:7px;font-size:13px}.discover-search{width:310px;max-width:100%}.discover-search input{width:100%;padding:11px 14px;border:1px solid var(--vm-line);border-radius:8px;background:var(--vm-surface);color:var(--vm-ink);font:400 13px var(--vm-font-sans)}.discover-filters{display:flex;gap:6px;overflow-x:auto;overscroll-behavior:contain;padding-bottom:15px;margin-bottom:24px}.discover-filters button{white-space:nowrap;padding:9px 12px;min-height:40px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--vm-ink-soft);font:500 12px var(--vm-font-sans);cursor:pointer}.discover-filters button[aria-pressed=true]{border-color:var(--vm-line);background:var(--vm-surface-2);color:var(--vm-ink)}.discover-section{margin-bottom:30px}.discover-section>h2{font-size:19px;margin-bottom:14px}.discover-tools{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}.discover-tool{display:flex;flex-direction:column;gap:15px;min-height:190px;padding:20px;border:1px solid var(--vm-line);border-radius:10px;background:var(--vm-surface);color:var(--vm-ink);text-decoration:none;transition:border-color .15s,background .15s}.discover-tool:hover{border-color:var(--vs-accent-ink);background:var(--vm-surface-2)}.discover-tool>div{display:flex;align-items:center;gap:10px}.discover-tool svg{width:24px;height:24px;flex-shrink:0;color:var(--vs-accent-ink)}.discover-tool h3{font-size:16px;font-weight:500;letter-spacing:-.02em}.discover-tool p{font-size:13px;color:var(--vm-ink-soft);line-height:1.8;flex:1}.discover-arrow{margin-left:auto}.discover-tool footer{display:flex;align-items:center;gap:8px;justify-content:space-between;flex-wrap:wrap;border-top:1px solid var(--vm-line-2);padding-top:12px;font-size:11px;color:var(--vs-accent-ink)}.discover-tool small{font-size:10px;color:var(--vm-ink-faint)}.discover-looks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px 18px}.discover-look{min-width:0;color:var(--vm-ink);text-decoration:none;border-radius:10px;overflow:hidden;border:1px solid var(--vm-line);background:var(--vm-surface)}.discover-look:hover{border-color:var(--vs-accent-ink)}.discover-look>div:last-child{padding:15px}.discover-look small{font-size:10px;color:var(--vs-accent-ink)}.discover-look h3{display:flex;justify-content:space-between;gap:10px;margin:8px 0;font-size:17px;letter-spacing:-.03em}.discover-look p{font-size:12px;line-height:1.8;color:var(--vm-ink-soft)}.discover-look footer{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid var(--vm-line-2);font-size:10px;color:var(--vm-ink-faint)}.discover-look footer span{color:var(--vm-ink)}.discover-foot{padding-top:25px;margin-top:20px;border-top:1px solid var(--vm-line);font-size:12px;line-height:1.8}@media(min-width:1550px){.discover-tools{grid-template-columns:repeat(4,minmax(0,1fr))}.discover-looks{grid-template-columns:repeat(4,minmax(0,1fr))}}@media(max-width:1023px){.discover{padding:25px 22px}.discover-heading{padding-left:var(--vs-bar-inset,0px)}.discover-tools{grid-template-columns:repeat(2,minmax(0,1fr))}.discover-looks{grid-template-columns:repeat(2,minmax(0,1fr))}.discover-toolbar{align-items:flex-start;flex-direction:column}.discover-search{width:100%}}@media(max-width:480px){.discover{padding:22px 16px 35px}.discover-heading h1{font-size:28px}.discover-heading p{font-size:13px;line-height:1.8}.discover-heading{padding-top:3px}.discover-views{gap:22px}.discover-views button{font-size:12px}.discover-tools,.discover-looks{grid-template-columns:1fr}.discover-tool{min-height:175px;padding:18px}.discover-filters button{min-height:44px}.discover-search input{font-size:16px;min-height:44px}}
</style>

<style scoped>.discover-look-card{position:relative;min-width:0}.discover-look{display:block;height:100%}.discover-save{position:absolute;z-index:3;top:10px;right:10px;width:36px;height:36px;border:1px solid #ffffff44;border-radius:50%;background:#111b2bba;color:#e2ecff;font-size:19px;cursor:pointer}.discover-save[aria-pressed=true]{background:#bacfea;color:#13243e}.discover-heading{padding-left:0}.discover-heading h1{font-size:34px}.discover{width:100%}@media(max-width:480px){.discover-save{width:44px;height:44px}.discover-heading h1{font-size:27px}.discover-heading{padding-top:0}}</style>

<style scoped>
.discover{max-width:1780px;padding:32px 38px 40px}.discover-heading p{font-size:13px;color:#a1a9b9}.discover-heading .st-button{background:#203954;border-color:#5b7494;color:#d8e7ff;font-size:12px;min-height:42px}.discover-views button{font-size:13px}.discover-toolbar{margin-bottom:22px}.discover-toolbar h2{font-size:23px}.discover-mode{display:flex;align-items:center;gap:12px}.discover-mode>span{font-size:10px;color:#8798b4}.discover-mode :deep(.sm-switch){width:auto;background:#1c2637;border-color:#44536c;padding:4px}.discover-mode :deep(.sm-switch button){font-size:12px;min-height:34px;padding:8px 13px}.discover-mode :deep(.sm-switch button[aria-checked=true]){background:#344f73;border-color:#6b85ad;color:#e0ebff}
.discover-controls{border-top:1px solid #333b49;border-bottom:1px solid #333b49;padding:14px 0 18px;margin-bottom:27px}.discover-filters{padding:0;margin:0 0 14px}.discover-filters button{min-height:34px;padding:8px 11px;font-size:11px}.discover-filters button[aria-pressed=true]{background:#344f73;border-color:#607ba3;color:#dce9ff}.discover-search-row{display:flex;justify-content:space-between;gap:20px;align-items:center}.discover-search-row>span{font-size:10px;color:#8497b7}.discover-search{width:min(495px,100%)}.discover-search input{padding:10px 13px;background:#20232b;border-color:#424956;font-size:12px}
.discover-section-title{display:flex;justify-content:space-between;gap:20px;align-items:center;margin-bottom:16px}.discover-section-title h2{font-size:19px;letter-spacing:-.4px}.discover-section-title small{font-size:9px;color:#7a8da9}.discover-tools{grid-template-columns:repeat(3,minmax(0,1fr))}.discover-section[data-count="2"] .discover-tools{grid-template-columns:repeat(2,minmax(0,1fr))}.discover-section[data-count="4"] .discover-tools{grid-template-columns:repeat(4,minmax(0,1fr))}.discover-tool{min-height:185px;padding:20px;border-color:#3a465b;background:linear-gradient(125deg,#1f2b3e,#1b2535);gap:0;box-shadow:0 1px 0 #ffffff04 inset}.discover-tool>div{min-height:34px;gap:11px}.discover-tool svg{width:34px;height:34px;padding:7px;border:1px solid #526c91;border-radius:7px;background:#344f73;color:#b8d0f4}.discover-tool h3{font-size:15px;line-height:1.4;font-weight:500;color:#dce7fa}.discover-tool p{font-size:12px;line-height:1.85;color:#91a5c5;margin:14px 0 18px}.discover-tool footer{padding-top:12px;border-color:#364963;color:#a6c2ed;font-size:10px}.discover-tool small{font-size:9px;color:#6e8cb4}.discover-tool:hover{border-color:#839bc1;background:linear-gradient(125deg,#2b3e5c,#21324c)}
@media(max-width:1260px){.discover-section[data-count="4"] .discover-tools{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:1023px){.discover{padding:25px 22px}.discover-toolbar{flex-direction:row;align-items:center}.discover-mode{align-items:flex-start;flex-direction:column;gap:7px}.discover-tools{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:680px){.discover-filters{scrollbar-width:none}.discover-filters::-webkit-scrollbar{display:none}.discover{padding:23px 16px}.discover-toolbar{align-items:flex-start;flex-direction:column;gap:16px}.discover-mode{flex-direction:row;align-items:center;flex-wrap:wrap}.discover-mode :deep(.sm-switch button){min-height:44px}.discover-filters button{min-height:44px}.discover-tools,.discover-section[data-count="2"] .discover-tools,.discover-section[data-count="4"] .discover-tools{grid-template-columns:1fr}.discover-search-row{align-items:flex-start;flex-direction:column;gap:10px}.discover-search{width:100%}.discover-search input{font-size:16px}}
</style>

<style scoped>.discover-look-options{display:flex;justify-content:flex-end;gap:12px;margin-bottom:24px}.discover-look-options label{display:grid;gap:6px;font-size:10px;color:#91a2bd;min-width:170px}.discover-look-options select{width:100%;min-width:0;padding:10px 12px;border:1px solid #424e62;border-radius:7px;background:#222b3b;color:#d6e2f4;font:500 12px var(--vm-font-sans)}.discover-look-group{margin-bottom:32px}.discover-look-group>h2{font-size:22px;margin-bottom:18px;font-weight:500;letter-spacing:-.6px}.discover-looks.featured{grid-template-columns:repeat(3,minmax(0,1fr))}.discover-looks.featured :deep(.slm){aspect-ratio:16/10}.discover-looks.featured .discover-look h3{font-size:20px}.discover-looks.featured .discover-look>div:last-child{padding:20px}@media(max-width:680px){.discover-look-options{flex-direction:column;align-items:stretch;gap:10px}.discover-look-options label{min-width:0}.discover-look-options select{font-size:16px;min-height:44px}.discover-looks.featured{grid-template-columns:1fr}.discover-look-group>h2{font-size:20px}}</style>

<style scoped>.discover-mine{scroll-margin-top:16px}.discover-mine:focus{outline:none}.discover-mine:focus-visible{outline:2px solid var(--vs-accent-ink);outline-offset:4px}.discover-mine>h2{display:flex;align-items:center;gap:10px}.discover-mine-count{font-size:11px;border-radius:5px;background:var(--vm-surface-2);padding:3px 6px;color:var(--vm-ink-soft)}.discover-mine-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;list-style:none;margin:0;padding:0}.discover-mine-card{display:flex;flex-direction:column;gap:8px;min-width:0;padding:16px;border:1px solid var(--vm-line);border-radius:10px;background:var(--vm-surface)}.discover-mine-card small{font-size:10px;color:var(--vs-accent-ink)}.discover-mine-card h3{font-size:17px;letter-spacing:-.03em;overflow-wrap:anywhere}.discover-mine-card>p{flex:1;font-size:12px;line-height:1.8;color:var(--vm-ink-soft);overflow-wrap:anywhere}.discover-mine-actions{display:flex;flex-wrap:wrap;gap:8px;padding-top:12px;border-top:1px solid var(--vm-line-2)}.discover-mine-rename{display:grid;gap:10px}.discover-mine-rename .discover-mine-actions{border-top:0;padding-top:0}@media(max-width:1023px){.discover-mine-list{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:680px){.discover-mine-list{grid-template-columns:1fr}.discover-mine-actions .st-button{min-height:44px;flex:1}.discover-mine-rename input{font-size:16px}}</style>

<style scoped>
.discover-agent-short{display:none}
/* Phones lead with useful choices instead of a screen of repeated introductions. */
@media(max-width:680px){
 .discover{padding:16px 14px 28px}
 .discover-heading{margin-bottom:12px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 12px;align-items:center}
 .discover-eyebrow{display:none}
 .discover-heading h1{font-size:23px;letter-spacing:-.7px;line-height:1.25}
 .discover-heading p{grid-column:1/-1;grid-row:2;font-size:12px;line-height:1.6}
 .discover-heading .st-button{font-size:12px;min-height:44px;padding:8px 10px;white-space:nowrap}
 .discover-agent-label{display:none}.discover-agent-short{display:inline}
 .discover-views{margin-bottom:12px;gap:22px}
 .discover-views button{min-height:44px;padding-block:10px;font-size:12px}
 .discover-toolbar{margin:0 0 12px;gap:8px}
 .discover-toolbar>div:first-child{display:none}
 .discover-mode{width:100%;justify-content:space-between;gap:8px}
 .discover-mode>span{font-size:11px}
 .discover-mode :deep(.sm-switch){width:auto}
 .discover-mode :deep(.sm-switch button){min-height:44px;padding:7px 12px}
 .discover-controls{padding:0 0 12px;margin-bottom:16px;border-top:0}
 .discover-filters{margin-bottom:8px;gap:3px}
 .discover-filters button{min-height:44px;padding:8px 10px;font-size:12px}
 .discover-search-row{display:flex;flex-direction:row;align-items:center;gap:10px}
 .discover-search{flex:1;min-width:0}
 .discover-search-row>span{display:none}
 .discover-search input{min-height:44px;font-size:16px}
 .discover-section{margin-bottom:20px}
 .discover-section-title{margin-bottom:10px}
 .discover-section-title h2{font-size:16px}
 .discover-tools,.discover-section[data-count="2"] .discover-tools,.discover-section[data-count="4"] .discover-tools{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
 .discover-tool{min-height:154px;padding:12px;gap:0}
 .discover-tool>div{gap:8px;min-height:30px;flex-wrap:wrap;align-content:flex-start}
 .discover-tool svg{width:28px;height:28px;padding:5px;flex:none}
 .discover-tool h3{font-size:13px;line-height:1.4;flex:1;min-width:0}
 .discover-arrow{display:none}
 .discover-tool p{font-size:11px;line-height:1.6;margin:10px 0 12px}
 .discover-tool footer{font-size:10px;padding-top:8px}
 .discover-tool footer small{display:none}
 .discover-look-options{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}
 .discover-look-options select{padding:10px 7px;font-size:14px}
 .discover-look-group>h2{font-size:18px;margin-bottom:12px}
}
@media(max-width:359px){.discover-tool{padding:10px}.discover-tool>div{gap:6px}.discover-tool h3{font-size:12px}}
</style>

<style scoped>
@media(max-width:680px){
 .discover-looks,.discover-looks.featured{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 10px}
 .discover-look>div:last-child,.discover-looks.featured .discover-look>div:last-child{padding:12px}
 .discover-look h3,.discover-looks.featured .discover-look h3{font-size:14px;line-height:1.4;letter-spacing:-.2px;margin:6px 0}
 .discover-look h3>span{display:none}
 .discover-look p{font-size:11px;line-height:1.6;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
 .discover-look footer{margin-top:10px;padding-top:8px;font-size:10px}
 .discover-look footer>span{display:none}
 .discover-save{top:6px;right:6px}
 .discover-looks.featured :deep(.slm){aspect-ratio:4/3}
}
</style>

<style scoped>
@media(max-width:380px) and (max-height:700px){
 .discover-heading p,.discover-mode>span{display:none}
 .discover-heading h1{font-size:22px}
 .discover-heading,.discover-views,.discover-toolbar{margin-bottom:8px}
 .discover-mode{justify-content:flex-end}
 .discover-tools{gap:8px}
 .discover-tool{min-height:130px;padding:10px}
 .discover-tool p{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;margin:8px 0 0}
 .discover-tool footer{display:none}
}
@media(min-width:600px) and (max-width:1023px) and (max-height:500px){
 .discover{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 12px;padding:12px 16px 24px}
 .discover-heading{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0}
 .discover-heading h1{font-size:22px;line-height:1.2}
 .discover-eyebrow,.discover-heading p,.discover-agent-label{display:none}
 .discover-agent-short{display:inline}
 .discover-heading .st-button{font-size:12px;min-height:44px;padding:8px 12px}
 .discover-views{grid-column:1;grid-row:2;margin:0;gap:20px}
 .discover-views button{min-height:44px;padding-block:10px;font-size:12px}
 .discover-toolbar{grid-column:2;grid-row:2;margin:0;align-items:center}
 .discover-toolbar>div:first-child,.discover-mode>span{display:none}
 .discover-mode :deep(.sm-switch){width:auto}
 .discover-mode :deep(.sm-switch button){min-height:44px}
 .discover-controls{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1fr) 200px;gap:12px;padding:0;margin:0;border:0;min-width:0}
 .discover-filters{margin:0;min-width:0;overflow:auto;scrollbar-width:none;gap:3px}
 .discover-filters button{min-height:44px;font-size:11px;padding:8px 10px}
 .discover-search-row{display:block}.discover-search-row>span{display:none}
 .discover-search{width:100%}.discover-search input{font-size:16px;min-height:44px}
 .discover-section,.discover-look-collection,.discover-foot{grid-column:1/-1;min-width:0;margin-bottom:8px}
 .discover-section-title{margin-bottom:8px}.discover-section-title h2{font-size:16px}
 .discover-tools{grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
 .discover-section[data-count="4"] .discover-tools{grid-template-columns:repeat(4,minmax(0,1fr))}
 .discover-tool{min-height:100px;padding:10px}
 .discover-tool>div{gap:7px;min-height:28px}.discover-tool svg{width:26px;height:26px;padding:5px}
 .discover-tool h3{font-size:13px}.discover-arrow,.discover-tool footer{display:none}
 .discover-tool p{font-size:11px;line-height:1.5;margin:8px 0 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
}
</style>
