<template>
  <section class="sv" aria-label="Versions">
    <header><h2>Keep the version you like.</h2><p class="st-muted">Earlier {{ kind === 'image' ? 'pictures' : 'video takes' }} stay in this conversation, newest first. Choosing one makes it the active {{ kind }}: it is free and makes nothing new.</p></header>
    <button v-if="kind === 'video' && playable.length" type="button" class="st-button" @click="openPreview">{{ playable.length > 1 ? 'Preview and compare takes' : 'Preview this take' }}</button>
    <div v-if="kind === 'video' && showPreview && versions.length"><button type="button" class="st-button" @click="showPreview = false">Close preview</button><VideoPanel bare /></div>
    <p v-if="loading && !versions.length" class="st-status" role="status">Loading versions…</p>
    <p v-else-if="meta.error && !versions.length" class="st-error" role="alert" data-test="versions-error">{{ meta.error }} <button type="button" class="st-button" @click="load()">Try again</button></p>
    <p v-else-if="!versions.length" class="st-empty"><strong>{{ kind === 'image' ? 'No image versions yet.' : 'No video takes yet.' }}</strong>Your completed media stays in My results and Library. Every {{ kind === 'image' ? 'picture' : 'take' }} made in this conversation is listed here.</p>
    <ul v-if="versions.length"><li v-for="version in versions" :key="version.attachment_id"><MediaThumb v-if="version.attachment_id" class="sv-thumb" :item="{ ...version, media_type: version.media_type || kind }" :src="(version.media_type || kind) === 'image' ? version.url : ''" alt="" /><div><strong>{{ version.title || `Version ${version.version || 1}` }}</strong><small>v{{ version.version || 1 }} <span v-if="version.is_active">· Active version</span></small></div><button type="button" class="st-button" :disabled="version.is_active || selecting || chat.isBusy || video.busy" @click="select(version)">{{ version.is_active ? 'Active version' : 'Use this version · free' }}</button></li></ul>
    <p v-if="meta.error && versions.length" class="st-error" role="alert">{{ meta.error }}</p>
    <button v-if="versions.length && meta.hasMore" type="button" class="st-button" data-test="versions-more" :disabled="loading" @click="load(true)">{{ loading ? 'Loading…' : 'Load older versions' }}</button>
  </section>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useChatStore } from '../../stores/useChatStore'
import { useVideoStore } from '../../stores/useVideoStore'
import { lazyComponent } from '../../utils/lazyComponent'
import MediaThumb from '../common/MediaThumb.vue'
const VideoPanel = lazyComponent(() => import('../video/VideoPanel.vue'))
// type: 'video' | 'image'. Without one, the Image page (…/image) lists pictures and every other page video takes.
const props = defineProps({ type: { type: String, default: '' } })
const route = useRoute()
const kind = computed(() => props.type === 'image' || props.type === 'video' ? props.type : /\/image\/?$/.test(route?.path || '') ? 'image' : 'video')
const chat = useChatStore(), video = useVideoStore(), selecting = ref(false)
const owned = computed(() => !!chat.conversationId && String(video.conversationId) === String(chat.conversationId))
const versions = computed(() => owned.value ? ((kind.value === 'image' ? video.imageVersions : video.versions) || []) : [])
const meta = computed(() => (owned.value && video.versionsMeta?.[kind.value]) || {})
const loading = computed(() => !!meta.value.loading)
const showPreview = ref(false), playable = computed(() => versions.value.filter(version => version.url))
watch(() => chat.conversationId, () => { showPreview.value = false })
function openPreview() { if (!playable.value.length) return; video.previewAttachmentId = playable.value[0].attachment_id; video.compareAttachmentId = playable.value[1]?.attachment_id || null; video.panelTab = 'preview'; showPreview.value = true }
function load(more = false) { if (owned.value) return video.loadVersions({ type: kind.value, more }) }
watch(() => [chat.conversationId, kind.value], () => load(), { immediate: true })
async function select(version) { if (!chat.conversationId || selecting.value || chat.isBusy || video.busy || version.is_active || !versions.value.includes(version)) return; selecting.value = true; try { await video.restore(version, { conversationId: chat.conversationId, type: kind.value }) } finally { selecting.value = false } }
</script>
<style scoped>
.sv{display:grid;gap:20px;max-width:1100px;margin:auto}.sv header{display:grid;gap:10px}.sv header p{font-size:13px;line-height:1.8}.sv ul{list-style:none;display:grid;gap:12px;margin:0;padding:0}.sv li{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:18px;border:1px solid var(--vm-line);border-radius:9px;background:var(--vm-surface)}.sv li>div{display:grid;gap:7px;min-width:0;flex:1}.sv .sv-thumb{flex:0 0 auto;width:72px;height:54px;object-fit:cover;border-radius:5px;background:var(--vm-bg)}.sv strong{overflow-wrap:anywhere;font-size:14px;font-weight:500}.sv small{font-size:12px;color:var(--vm-ink-soft)}@media(max-width:767px){.sv li{align-items:flex-start;flex-direction:column}.sv button{min-height:44px}}
</style>
