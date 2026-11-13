<script setup>
import { computed } from 'vue';
import { Images, Scan, Video, FileText, FileArchive, ArrowUpRight } from 'lucide-vue-next';

const props = defineProps({ formats: { type: Array, default: () => [] }, loading: Boolean });
defineEmits(['browse']);
const catalogueLabel = computed(() => props.loading ? 'Loading formats…'
  : props.formats.length ? `Explore ${props.formats.length} formats` : 'Explore formats');
</script>

<template>
  <section class="upload-formats" aria-label="Supported formats">
    <h3>Supported formats</h3>
    <div class="formats-panel">
      <div class="formats-grid">
        <div class="format-kind format-images"><strong><Images :size="16" aria-hidden="true"/> Images</strong><span>.jpg, .png, .bmp, .webp, .avif</span></div>
        <div class="format-kind"><strong><Scan :size="16" aria-hidden="true"/> Annotations</strong><button class="formats-link" :disabled="loading" @click="$emit('browse')">{{ catalogueLabel }}<ArrowUpRight :size="12" aria-hidden="true"/></button></div>
        <div class="format-kind"><strong><Video :size="16" aria-hidden="true"/> Videos</strong><span>.mov, .mp4</span></div>
        <div class="format-kind"><strong><FileText :size="16" aria-hidden="true"/> PDFs</strong><span>.pdf</span></div>
        <div class="format-kind"><strong><FileArchive :size="16" aria-hidden="true"/> ZIPs</strong><span>.zip</span></div>
      </div>
      <p class="format-limits">Images: max 30 MB · 16,384 pixels per side · 179 megapixels. Videos: max 3 GB. ZIPs: max 8 GB.</p>
      <p class="format-detail">PDFs: max 95 MiB. Browse annotation formats to check import availability.</p>
    </div>
  </section>
</template>

<style scoped>
.upload-formats{width:100%;max-width:780px;container-type:inline-size;text-align:left}
.upload-formats h3{text-align:center;font-size:12px;font-weight:500;letter-spacing:0;color:var(--muted);margin:0 0 12px}
.formats-panel{background:var(--surface,#fff);border:1px solid #dce3ee;border-radius:12px;padding:20px 18px 15px;box-shadow:0 2px 4px #0f172a03}
.formats-grid{display:grid;grid-template-columns:1.9fr 1.55fr 1fr .7fr .7fr;gap:16px}
.format-kind{display:flex;flex-direction:column;gap:8px;min-width:0}
.format-kind strong{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:550;white-space:nowrap;color:var(--aadml-navy,#0f172a)}
.format-kind strong svg{color:#64748b}
.format-kind>span,.formats-link{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:10px;line-height:1.6;color:#64748b;white-space:nowrap}
.formats-link{display:inline-flex;align-items:center;gap:3px;align-self:flex-start;padding:0;border:0;background:none;color:var(--accent);cursor:pointer}
.formats-link:hover:not(:disabled){text-decoration:underline;text-underline-offset:3px}
.formats-link:focus-visible{outline:2px solid var(--accent);outline-offset:4px;border-radius:2px}
.format-limits{font-size:10px;line-height:1.7;color:#64748b;margin:16px 0 0;padding-top:13px;border-top:1px solid #edf1f6}
.format-detail{font-size:10px;line-height:1.7;color:#64748b;margin:3px 0 0}
@container(max-width:650px){.formats-grid{grid-template-columns:1.5fr 1.2fr 1fr;gap:18px}.format-images{grid-column:span 2}}
@container(max-width:390px){.formats-grid{grid-template-columns:1fr 1fr}.format-images{grid-column:1/-1}.formats-panel{padding:18px 16px}.format-kind>span,.formats-link{white-space:normal}}
</style>
