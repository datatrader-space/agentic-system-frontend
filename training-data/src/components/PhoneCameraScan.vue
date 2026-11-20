<script setup>
// The page a phone opens from "Scan from phone" in the Add video source dialog (a QR code on the computer): it scans a
// camera's own label (its address, or a serial) with the phone's camera and sends what it read to that dialog, which
// fills the form in. It sends ONE value, for 15 minutes, without signing in; the pairing's secret is its only authority
// and the server checks it (backend camera_pairing.py). Nothing is added from here: the camera is added on the
// computer, after the person checks the form and ticks the consent. The secret leaves the address at once (main.js).
// The scan uses the browser's own reader (BarcodeDetector); a browser without one is told so, and the person can type
// what the label says instead. The video never leaves the phone.
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Camera, Check, CircleAlert, QrCode, Send } from 'lucide-vue-next';
import { cameraPhoneApi, scanFormats } from '../api/phone.js';
import { isPairingLink, PAIRING_SCANNED } from '../api/streaming.js';

const props = defineProps({ secret: { type: String, required: true } });
const info = ref(null); const error = ref(''); const busy = ref(false); const sent = ref('');
const value = ref(''); const limit = computed(() => Number(info.value?.value_limit) || 2000);
const formats = ref([]); const scanning = ref(false); const scanError = ref('');
const video = ref(null);
let stream = null; let detector = null; let timer = null; let gone = false;

onMounted(async () => {
  try { info.value = await cameraPhoneApi.info(props.secret); } catch (e) { error.value = e.message; }
  formats.value = await scanFormats();
});
const until = computed(() => (info.value ? new Date(info.value.expires_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : ''));
const canScan = computed(() => formats.value.length > 0 && !!globalThis.navigator?.mediaDevices?.getUserMedia);

function stopCamera() {
  clearTimeout(timer); timer = null; scanning.value = false;
  if (stream) { stream.getTracks().forEach(track => track.stop()); stream = null; }
}
async function look() {
  if (!scanning.value || gone || !video.value) return;
  try {
    const found = video.value.readyState >= 2 ? await detector.detect(video.value) : [];
    const first = found.find(code => typeof code.rawValue === 'string' && code.rawValue.trim());
    if (first && isPairingLink(first.rawValue)) {
      scanError.value = PAIRING_SCANNED;                 // the computer's pairing QR: go on looking for the label
    } else if (first) {
      scanError.value = '';
      // eslint-disable-next-line no-control-regex
      value.value = first.rawValue.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, limit.value);
      stopCamera();
      return;
    }
  } catch { /* a frame the reader could not take: the next one */ }
  timer = setTimeout(look, 250);
}
async function startScan() {
  scanError.value = ''; sent.value = '';
  try {
    detector = new globalThis.BarcodeDetector({ formats: formats.value });
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
  } catch (e) {
    stopCamera();
    scanError.value = e?.name === 'NotAllowedError' ? 'The camera was not allowed. Allow it in the browser, or type what the label says.'
      : 'The camera could not be opened. Type what the label says instead.';
    return;
  }
  scanning.value = true;
  await Promise.resolve();
  if (video.value) { video.value.srcObject = stream; try { await video.value.play(); } catch { /* muted autoplay */ } }
  look();
}
async function send() {
  const text = value.value.trim();
  if (busy.value || !text) return;
  busy.value = true; error.value = '';
  try {
    const answer = await cameraPhoneApi.send(props.secret, text);
    sent.value = answer?.said || 'Sent to your computer.';
    stopCamera();
  } catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}
onUnmounted(() => { gone = true; stopCamera(); });
</script>

<template>
  <main class="phone">
    <header><span class="mark"><QrCode :size="18" aria-hidden="true"/></span><div><small>AADML Cloud Streaming</small><h1>Scan a camera's label</h1></div></header>
    <p v-if="!info && !error" class="quiet">Opening the pairing…</p>
    <section v-if="error && !info" class="ended" role="alert"><CircleAlert :size="22" aria-hidden="true"/><p>{{ error }}</p></section>
    <template v-if="info && !sent">
      <p class="quiet">Scan the QR code or barcode on the camera (its address or serial number). What you scan goes to the Add video source form on your computer, in {{ info.workspace }}. This works once, until {{ until }}.</p>
      <div v-if="canScan" class="scan">
        <video v-show="scanning" ref="video" class="viewfinder" muted playsinline aria-label="What the phone's camera sees"></video>
        <button v-if="!scanning" class="pick primary" type="button" @click="startScan"><Camera :size="22" aria-hidden="true"/><span>{{ value ? 'Scan again' : 'Scan with the camera' }}</span></button>
        <button v-else class="pick" type="button" @click="stopCamera">Stop the camera</button>
      </div>
      <p v-else class="note" role="status">This phone's browser cannot scan codes. Type what the camera's label says below.</p>
      <p v-if="scanError" class="problem" role="alert">{{ scanError }}</p>
      <label class="field" for="pc-value">What the label says</label>
      <input id="pc-value" v-model="value" class="text" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" :maxlength="limit" placeholder="rtsp://192.168.1.20:554/stream1 or a serial number">
      <p class="hint">Check it before you send it. Only this one value is sent.</p>
      <p v-if="error" class="problem" role="alert">{{ error }}</p>
      <button class="send" type="button" :disabled="busy || !value.trim()" @click="send"><Send :size="16" aria-hidden="true"/> {{ busy ? 'Sending…' : 'Send to my computer' }}</button>
    </template>
    <section v-if="sent" class="sent" role="status"><Check :size="20" aria-hidden="true"/><div><strong>{{ sent }}</strong><p>You can close this page.</p></div></section>
  </main>
</template>

<style scoped>
.phone{max-width:520px;margin:0 auto;padding:24px 16px 48px;font:15px/1.55 Inter,system-ui,sans-serif;color:#162139;background:#fff;min-height:100vh}
header{display:flex;gap:12px;align-items:center;margin-bottom:14px}
.mark{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:var(--aadml-primary,#2563eb);color:#fff;flex-shrink:0}
header small{display:block;font-size:12px;color:#4c5d74}
h1{font-size:21px;margin:2px 0 0;letter-spacing:-.3px}
.quiet{color:#4c5d74;font-size:14px;margin:8px 0 18px}
.scan{display:grid;gap:10px;margin-bottom:14px}
.viewfinder{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:12px;background:#0d1320}
.pick{display:flex;align-items:center;justify-content:center;gap:10px;min-height:56px;padding:12px;border:1px solid #d4d9e3;border-radius:12px;font:inherit;font-weight:600;color:#24324a;background:#f8fafc;cursor:pointer}
.pick.primary{border-color:var(--aadml-primary,#2563eb);color:var(--aadml-primary,#2563eb);background:#eef4ff}
.note{margin:0 0 14px;padding:10px 12px;border-radius:10px;background:#fffaeb;color:#7a4b00;font-size:14px}
.field{display:block;font-size:13px;font-weight:600;color:#1d2a42;margin:8px 0 6px}
.text{display:block;width:100%;box-sizing:border-box;min-height:48px;padding:10px 12px;border:1px solid #c9d1dd;border-radius:10px;font:inherit;font-size:15px;overflow-wrap:anywhere}
.text:focus-visible,.pick:focus-visible,.send:focus-visible{outline:2px solid var(--aadml-focus,#2563eb);outline-offset:2px}
.hint{margin:6px 0 14px;font-size:12px;color:#5f6d82}
.problem{color:#a12c3c;font-size:14px;margin:8px 0}
.send{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:52px;border:0;border-radius:12px;background:var(--aadml-primary,#2563eb);color:#fff;font:inherit;font-weight:600;cursor:pointer}
.send:disabled{opacity:.55;cursor:default}
.ended,.sent{display:flex;gap:12px;align-items:flex-start;padding:14px;border-radius:12px}
.ended{background:#fff5f6;color:#a12c3c}
.sent{background:#ecfdf3;color:#05603a}
.ended p,.sent p{margin:4px 0 0}
</style>
