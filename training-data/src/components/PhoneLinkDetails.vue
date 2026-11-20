<script setup>
// A phone camera's phone link (CLOUD_STREAMING_PLAN.md §16; backend phone_camera.py), shown ONCE: in the answer that
// made it (adding the camera, or "New phone link" on its page). A QR code (drawn here with uqr: the link never goes to
// an outside QR service), the link to copy, the three steps and when it ends. The page never stores the link: it is
// gone when the dialog or the page closes. `phone` is phoneLinkDetails() of the answer.
import { computed, ref } from 'vue';
import { Check, Copy, TriangleAlert } from 'lucide-vue-next';
import { qrOf } from '../api/phone.js';
import { PHONE_LINK_WARNING, PHONE_STEPS, phoneLinkUntil } from '../api/streaming.js';

const props = defineProps({
  phone: { type: Object, required: true },
  idPrefix: { type: String, default: 'phone-link' },
});

const qr = computed(() => qrOf(props.phone.url));
const until = computed(() => phoneLinkUntil(props.phone));
const copied = ref(false); const copyFailed = ref(false);
async function copy() {
  copyFailed.value = false;
  try {
    await navigator.clipboard.writeText(props.phone.url);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  } catch { copied.value = false; copyFailed.value = true; }
}
const select = event => event.target.select();
</script>

<template>
  <div class="pl">
    <div class="pl-made">
      <svg v-if="qr" class="pl-qr" :viewBox="`0 0 ${qr.size} ${qr.size}`" shape-rendering="crispEdges" role="img" aria-label="QR code of the phone link"><rect :width="qr.size" :height="qr.size" fill="#ffffff"/><path :d="qr.path" fill="#0f172a"/></svg>
      <ol class="pl-steps">
        <li v-for="step in PHONE_STEPS" :key="step">{{ step }}</li>
      </ol>
    </div>
    <div class="pl-row">
      <label :for="`${idPrefix}-url`">Phone link</label>
      <div class="pl-value">
        <input :id="`${idPrefix}-url`" class="text-input pl-mono" type="text" readonly spellcheck="false" autocomplete="off" :value="phone.url" @focus="select">
        <button type="button" class="pl-copy" aria-label="Copy the phone link" :title="copied ? 'Copied' : 'Copy'" @click="copy">
          <Check v-if="copied" :size="15" aria-hidden="true"/><Copy v-else :size="15" aria-hidden="true"/>
        </button>
      </div>
    </div>
    <p class="pl-help">{{ until }} The phone needs a recent Chrome or Safari; no app and no AADML sign-in.</p>
    <p class="pl-warn"><TriangleAlert :size="15" aria-hidden="true"/><span>{{ PHONE_LINK_WARNING }}</span></p>
    <p v-if="copyFailed" class="pl-help" role="alert">Copying did not work in this browser: select the link and copy it.</p>
    <p class="pl-sr" aria-live="polite">{{ copied ? 'Copied.' : '' }}</p>
  </div>
</template>

<style scoped>
.pl{display:grid;gap:10px}
.pl-made{display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.pl-qr{width:168px;height:168px;flex:0 0 auto;border:1px solid #e3e8ef;border-radius:8px;background:#fff}
.pl-steps{margin:0;padding-left:20px;display:grid;gap:6px;font-size:14px;line-height:1.5;color:#1d2a42;min-width:0;flex:1 1 200px}
.pl-row label{display:block;font-size:13px;font-weight:600;color:#1d2a42;margin:0 0 6px}
.pl-value{display:flex;gap:6px;min-width:0}
.pl-mono{flex:1;min-width:0;min-height:40px;margin:0;padding:8px 10px;font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:#f8fafc}
.pl-mono:focus-visible,.pl-copy:focus-visible{outline:2px solid var(--aadml-focus);outline-offset:2px}
.pl-copy{display:grid;place-items:center;flex:0 0 40px;width:40px;height:40px;border:1px solid #d6dde7;border-radius:8px;background:#fff;color:#33415a;cursor:pointer}
.pl-copy:hover{background:#f1f4f8;color:var(--aadml-primary)}
.pl-warn{display:flex;gap:8px;align-items:flex-start;margin:0;padding:10px 12px;border-radius:8px;background:#fffaeb;color:#7a2e0e;font-size:13px;line-height:1.5}
.pl-warn svg{flex:0 0 auto;margin-top:2px}
.pl-help{margin:0;font-size:12px;line-height:1.6;color:#4b5a70}
.pl-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
</style>
