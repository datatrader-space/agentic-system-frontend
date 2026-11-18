<script setup>
// Where an RTMP stream's camera or encoder sends its video (CLOUD_STREAMING_PLAN.md §14; backend rtmp_push.py): the
// Server, and, only in the answer that made the key (adding the stream, or "Rotate key"), the Stream key and the full
// address, each with a copy button and a plain warning to keep the key secret. The page never stores the key: it is
// gone when the dialog or the page closes. `push` is pushDetails() of the answer.
import { ref } from 'vue';
import { Check, Copy, TriangleAlert } from 'lucide-vue-next';
import { PUSH_KEY_WARNING, PUSH_OBS_HELP } from '../api/streaming.js';

const props = defineProps({
  push: { type: Object, required: true },
  idPrefix: { type: String, default: 'push' },
});

const copied = ref(''); const copyFailed = ref(false);
async function copy(text, what) {
  copyFailed.value = false;
  try {
    await navigator.clipboard.writeText(text);
    copied.value = what;
    setTimeout(() => { if (copied.value === what) copied.value = ''; }, 2000);
  } catch { copied.value = ''; copyFailed.value = true; }
}
const rows = () => [
  { key: 'server', label: 'Server', value: props.push.server },
  ...(props.push.streamKey ? [{ key: 'key', label: 'Stream key', value: props.push.streamKey },
    { key: 'url', label: 'Full address (for a device with one address field)', value: props.push.url }] : []),
].filter(row => row.value);
const select = event => event.target.select();
</script>

<template>
  <div class="pd">
    <div v-for="row in rows()" :key="row.key" class="pd-row">
      <label :for="`${idPrefix}-${row.key}`">{{ row.label }}</label>
      <div class="pd-value">
        <input :id="`${idPrefix}-${row.key}`" class="text-input pd-mono" type="text" readonly spellcheck="false" autocomplete="off" :value="row.value" @focus="select">
        <button type="button" class="pd-copy" :aria-label="`Copy the ${row.label.split(' (')[0].toLowerCase()}`" :title="copied === row.key ? 'Copied' : 'Copy'" @click="copy(row.value, row.key)">
          <Check v-if="copied === row.key" :size="15" aria-hidden="true"/><Copy v-else :size="15" aria-hidden="true"/>
        </button>
      </div>
    </div>
    <template v-if="push.streamKey">
      <p class="pd-warn"><TriangleAlert :size="15" aria-hidden="true"/><span>{{ PUSH_KEY_WARNING }}</span></p>
      <p class="pd-help">{{ PUSH_OBS_HELP }} Only an encrypted RTMPS connection is accepted.</p>
    </template>
    <p v-else class="pd-help">The stream key was shown once, when it was made. If it is lost, rotate it: a new one is shown, and the old one stops working.</p>
    <p v-if="copyFailed" class="pd-help" role="alert">Copying did not work in this browser: select the text and copy it.</p>
    <p class="pd-sr" aria-live="polite">{{ copied ? 'Copied.' : '' }}</p>
  </div>
</template>

<style scoped>
.pd{display:grid;gap:10px}
.pd-row label{display:block;font-size:13px;font-weight:600;color:#1d2a42;margin:0 0 6px}
.pd-value{display:flex;gap:6px;min-width:0}
.pd-mono{flex:1;min-width:0;min-height:40px;margin:0;padding:8px 10px;font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:#f8fafc}
.pd-mono:focus-visible{outline:2px solid var(--aadml-focus);outline-offset:2px}
.pd-copy{display:grid;place-items:center;flex:0 0 40px;width:40px;height:40px;border:1px solid #d6dde7;border-radius:8px;background:#fff;color:#33415a;cursor:pointer}
.pd-copy:hover{background:#f1f4f8;color:var(--aadml-primary)}
.pd-copy:focus-visible{outline:2px solid var(--aadml-focus);outline-offset:2px}
.pd-warn{display:flex;gap:8px;align-items:flex-start;margin:0;padding:10px 12px;border-radius:8px;background:#fffaeb;color:#7a2e0e;font-size:13px;line-height:1.5}
.pd-warn svg{flex:0 0 auto;margin-top:2px}
.pd-help{margin:0;font-size:12px;line-height:1.6;color:#4b5a70}
.pd-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
</style>
