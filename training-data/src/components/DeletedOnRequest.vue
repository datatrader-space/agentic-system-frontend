<script setup>
// "Deleted on request" (ADM-1210 §3.8): what was deleted because a person asked, newest first, read a page at a time
// with "Show more" (never cut). For a vision project the photos (review_api.deletions: the removed copy's sha256), for a
// language-model project the examples (llm/review_api.deletions). Shown to people with the overview right; the server
// refuses anyone else. ``load(page)`` asks for one page ({before, before_id} of the page before; none: the first).
import { onMounted, ref } from 'vue';
import { ShieldCheck } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import { deletionRow } from '../api/dataset.js';

const props = defineProps({
  load: { type: Function, required: true },
  kind: { type: String, default: 'photo' },          // 'photo' | 'example'
});
const rows = ref([]); const next = ref(null); const loading = ref(false); const error = ref(''); const loaded = ref(false);
const when = iso => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');

async function read(more = false) {
  loading.value = true; error.value = '';
  try {
    const body = await props.load(more ? next.value : null);
    const page = (body.deletions || []).map(r => deletionRow(r, props.kind));
    rows.value = more ? [...rows.value, ...page] : page;
    next.value = body.more ? body.next : null;
    loaded.value = true;
  } catch (e) { error.value = e.message; } finally { loading.value = false; }
}
onMounted(() => read());
defineExpose({ reload: () => read() });
</script>

<template>
  <div class="deletions">
    <p class="deletions-help">{{ kind === 'example' ? 'Each example deleted because a person asked: it is never made again from where it came.' : 'Each photo deleted because a person asked: the same picture sent again is not taken in again.' }} Published dataset versions keep what they froze and are listed.</p>
    <p v-if="error" class="field-error" role="alert">{{ error }} <button type="button" class="link-button" @click="read()">Try again</button></p>
    <p v-if="loading && !rows.length" class="deletions-help">Loading…</p>
    <div v-else-if="loaded && !rows.length && !error" class="model-empty deletions-empty"><ShieldCheck :size="32" aria-hidden="true"/><h3>Nothing deleted on request</h3><p>{{ kind === 'example' ? 'An example deleted on request from its page is listed here.' : 'A photo deleted on request from this tab or the Records page is listed here.' }}</p></div>
    <div v-else-if="rows.length" class="table-wrap deletions-wrap">
      <table class="ws-table deletions-table">
        <caption class="sr-only">{{ kind === 'example' ? 'Examples deleted on request' : 'Photos deleted on request' }}</caption>
        <thead><tr><th scope="col">{{ kind === 'example' ? 'Example' : 'Photo (sha256)' }}</th><th scope="col">When</th><th scope="col">By</th><th scope="col">Reason</th><th scope="col">Versions it was in</th></tr></thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td :data-label="kind === 'example' ? 'Example' : 'Photo (sha256)'"><span class="deletions-sha" :title="r.full" translate="no">{{ r.what }}</span><small v-if="kind === 'example' && r.full !== r.what">{{ r.full }}</small></td>
            <td data-label="When"><time :datetime="r.at">{{ when(r.at) }}</time></td>
            <td data-label="By">{{ r.by }}</td>
            <td data-label="Reason" class="deletions-reason">{{ r.reason || '—' }}</td>
            <td data-label="Versions it was in">{{ r.versions.length ? r.versions.join(', ') : 'None' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="next" class="deletions-more"><UiButton :disabled="loading" @click="read(true)">{{ loading ? 'Loading…' : 'Show more' }}</UiButton></div>
  </div>
</template>

<style scoped>
.deletions{display:grid;gap:12px}
.deletions-help{margin:0;font-size:12px!important;color:#5f6d82!important}
.deletions-empty{padding:32px 20px}
.deletions-empty h3{margin:10px 0 4px}
.deletions-wrap{max-width:100%;overflow:auto;border:1px solid #e3e8ef;border-radius:10px;background:#fff}
.deletions-table{width:100%;border-collapse:collapse;background:#fff}
.deletions-table thead th{padding:11px 14px;background:#f7f9fc;border-bottom:1px solid #e5eaf1;color:#5f6d82;font-size:11px;font-weight:600;text-align:left;white-space:nowrap}
.deletions-table td{padding:12px 14px;border-bottom:1px solid #edf0f5;vertical-align:top;font-size:12px;color:#43536c;overflow-wrap:anywhere}
.deletions-table tbody tr:last-child td{border-bottom:0}
.deletions-table td small{display:block;color:#5f6d82;font-size:11px;margin-top:4px}
.deletions-sha{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;color:#24344c}
.deletions-reason{max-width:36ch;white-space:pre-wrap}
.deletions-more{display:flex;justify-content:center}
.link-button{background:none;border:0;padding:0;color:var(--aadml-primary);font:inherit;text-decoration:underline;cursor:pointer}
.link-button:focus-visible{outline:2px solid var(--aadml-focus);outline-offset:2px}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media(max-width:650px){
  .deletions-table thead{display:none}
  .deletions-table,.deletions-table tbody,.deletions-table tr,.deletions-table td{display:block;width:100%}
  .deletions-table tr{border-bottom:1px solid #e9eaf0;padding:8px 0}
  .deletions-table td{border:0!important;padding:5px 14px!important}
  .deletions-table td[data-label]::before{content:attr(data-label);display:block;font-size:11px;color:#5f6d82;margin-bottom:2px}
}
</style>
