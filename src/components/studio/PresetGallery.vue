<template>
  <div class="pg">
    <div class="pg-toolbar"><label class="st-field"><span class="st-sr">Search presets</span><input v-model="query" type="search" class="st-input" placeholder="Search presets" /></label><div class="pg-categories" role="group" aria-label="Preset categories"><button v-for="category in categories" :key="category" type="button" :aria-pressed="active === category" :class="{ active: active === category }" @click="active = category">{{ category }}</button></div></div>
    <p v-if="loading" class="st-status" role="status">Loading presets...</p><div v-else-if="error" class="st-error" role="alert">{{ error }} <button type="button" class="st-button" @click="emit('retry')">Try again</button></div>
    <p v-else-if="!shown.length" class="st-empty" role="status">No presets match. Try another category or search.</p>
    <ul v-else class="pg-grid" aria-label="Preset gallery"><li v-for="preset in shown" :key="preset.id">
      <button type="button" class="pg-card" :class="{ selected: selected === preset.id }" :aria-pressed="selected === preset.id" :disabled="disabled" :aria-label="`Choose ${preset.title}: ${preset.purpose}`" @click="emit('select', preset)" @mouseenter="hovered = preset.id" @mouseleave="hovered = ''" @focus="focused = preset.id" @blur="focused = ''">
        <span class="pg-art"><video v-if="preset.previewUrl && !reduced && (hovered === preset.id || focused === preset.id)" :src="preset.previewUrl" :poster="preset.poster" autoplay loop muted playsinline preload="none" aria-hidden="true" /><img v-else-if="preset.poster" :src="preset.poster" alt="" loading="lazy" /><svg v-else viewBox="0 0 240 150" fill="none" aria-hidden="true"><rect x="45" y="24" width="150" height="102" rx="6" /><path d="M45 104l40-36 32 24 30-28 48 44" /><circle cx="156" cy="52" r="10"/><path d="M30 135h180M30 15h180" /></svg><span class="pg-kind">{{ preset.feature === 'video' ? 'Video' : preset.feature === 'image' ? 'Image' : 'Layout preview' }} preset</span><span v-if="selected === preset.id" class="pg-selected">Selected</span></span>
        <span class="pg-copy"><strong class="pg-title">{{ preset.title }}</strong><span class="pg-description">{{ preset.purpose }}</span><small class="pg-category">{{ preset.category }}</small></span>
      </button>
    </li></ul>
    <p v-if="!loading && !error" class="pg-foot">Illustrations describe a composition. They are not generated examples.</p>
  </div>
</template>
<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
const props = defineProps({ presets: { type: Array, default: () => [] }, selected: String, loading: Boolean, error: String, disabled: Boolean })
const emit = defineEmits(['select','retry'])
const query = ref(''), active = ref('All'), hovered = ref(''), focused = ref('')
const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
const reduced = ref(media?.matches ?? true)
function changed(event) { reduced.value = event.matches }
media?.addEventListener?.('change', changed)
onBeforeUnmount(() => media?.removeEventListener?.('change', changed))
const categories = computed(() => ['All', ...new Set(props.presets.map(preset => preset.category))])
const shown = computed(() => props.presets.filter(preset => (active.value === 'All' || preset.category === active.value) && `${preset.title} ${preset.purpose}`.toLowerCase().includes(query.value.trim().toLowerCase())))
</script>
<style scoped>
.pg-toolbar{display:grid;gap:14px;margin-bottom:22px}.pg-toolbar>.st-field{max-width:340px}.pg-categories{display:flex;flex-wrap:wrap;gap:6px}.pg-categories button{min-height:34px;padding:6px 11px;border:1px solid var(--vm-line);border-radius:6px;background:transparent;color:var(--vm-ink-soft);font:500 12px var(--vm-font-sans);cursor:pointer}.pg-categories button.active{background:var(--vm-surface-2);color:var(--vm-ink)}.pg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,230px),1fr));gap:18px;list-style:none;padding:0;margin:0}.pg-grid li{min-width:0}.pg-card{display:flex;flex-direction:column;width:100%;height:100%;padding:0;border:1px solid var(--vm-line);border-radius:9px;overflow:hidden;background:var(--vm-surface);color:var(--vm-ink);text-align:left;font:inherit;cursor:pointer}.pg-card:hover,.pg-card.selected{border-color:var(--vs-accent-ink)}.pg-card:disabled{cursor:default}.pg-art{position:relative;display:grid;place-items:center;width:100%;aspect-ratio:8/5;background:var(--vm-surface-2);overflow:hidden;color:var(--vm-ink-soft)}.pg-art>svg{width:100%;height:100%;stroke:currentColor;stroke-width:1;opacity:.7}.pg-art img,.pg-art video{width:100%;height:100%;object-fit:cover}.pg-kind{position:absolute;left:12px;bottom:10px;font-size:11px;color:var(--vm-ink-soft);background:var(--vm-surface);border-radius:4px;padding:2px 6px}.pg-selected{position:absolute;right:10px;top:10px;font-size:11px;color:var(--vm-ink);background:var(--vm-surface);padding:3px 7px;border-radius:4px}.pg-copy{display:grid;gap:7px;padding:16px;flex:1}.pg-title{font-size:16px;line-height:1.35;font-weight:600}.pg-description{font-size:14px;line-height:1.55;color:var(--vm-ink-soft)}.pg-category{font-size:12px;color:var(--vs-accent-ink);align-self:end;margin-top:8px}.pg-foot{margin-top:20px!important;color:var(--vm-ink-soft);font-size:12px;line-height:1.5}@media(max-width:767px){.pg-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.pg-copy{padding:12px;gap:6px}.pg-title{font-size:15px}.pg-description{font-size:13px}.pg-art{aspect-ratio:1}.pg-kind{font-size:10px;left:7px;bottom:7px}.pg-categories button{min-height:44px}.pg-selected{top:7px;right:7px}}
</style>
