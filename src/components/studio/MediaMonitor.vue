<template>
  <div class="mm" data-test="media-monitor">
    <template v-if="shown.length">
      <figure v-for="item in shown" :key="item.attachment_id" class="mm-item">
        <img v-if="item.media_type === 'image'" :src="item.url || item.thumbnail_url" :alt="item.name" />
        <video v-else-if="item.media_type === 'video'" :src="item.url" controls preload="metadata" :aria-label="item.name" />
        <audio v-else-if="item.media_type === 'audio'" :src="item.url" controls preload="metadata" :aria-label="item.name" />
        <figcaption><strong>{{ item.role }}</strong> {{ item.name }}</figcaption>
      </figure>
    </template>
    <p v-else class="st-empty"><strong>Nothing on the monitor yet</strong>{{ empty }}</p>
  </div>
</template>
<script setup>
import { computed } from 'vue'
// The page's inputs as they will be used, side by side: what you add on the left shows here.
const props = defineProps({ items: { type: Array, default: () => [] }, empty: { type: String, default: 'Add your inputs on the left to see them here.' } })
const shown = computed(() => props.items.filter(item => item?.attachment_id && (item.url || item.thumbnail_url)))
</script>
<style scoped>
.mm{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr));gap:16px;min-width:0}.mm-item{display:grid;gap:8px;margin:0;min-width:0}.mm-item img,.mm-item video{width:100%;max-height:min(52vh,520px);object-fit:contain;border:1px solid var(--vm-line);background:var(--vm-bg)}.mm-item audio{width:100%}.mm-item figcaption{font-size:12px;color:var(--vm-ink-soft);overflow-wrap:anywhere}.mm-item figcaption strong{display:block;color:var(--vm-ink);font-weight:500}
</style>
