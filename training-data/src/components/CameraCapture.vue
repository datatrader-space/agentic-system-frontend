<script setup>
import { nextTick, onUnmounted, ref, watch } from 'vue';
import UiDialog from './UiDialog.vue';
import UiButton from './UiButton.vue';
const props = defineProps({ open: Boolean });
const emit = defineEmits(['close', 'capture']);
const video = ref(null); const error = ref(''); const ready = ref(false); const capturing = ref(false); let stream; let generation = 0;
function stop() { generation++; stream?.getTracks().forEach(track => track.stop()); stream = null; ready.value = false; capturing.value = false; }
function close() { stop(); emit('close'); }
watch(() => props.open, async open => {
  stop(); error.value = '';
  if (!open) return;
  const current = generation;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera capture needs a supported browser on HTTPS. You can still select a photo from your device.');
    const acquired = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    if (current !== generation || !props.open) { acquired.getTracks().forEach(track => track.stop()); return; }
    stream = acquired;
    await nextTick();
    if (current !== generation || !video.value) return;
    video.value.srcObject = stream; await video.value.play();
    if (current === generation && props.open) ready.value = true;
  } catch (exception) { if (current !== generation) return; stop(); error.value = exception.name === 'NotAllowedError' ? 'Camera permission was not granted. You can select a photo instead.' : exception.message; }
});
async function capture() {
  if (!ready.value || capturing.value || !video.value?.videoWidth || !video.value?.videoHeight) return;
  const current = generation; capturing.value = true;
  const canvas = document.createElement('canvas');
  canvas.width = video.value.videoWidth; canvas.height = video.value.videoHeight;
  const context = canvas.getContext('2d');
  if (!context) { capturing.value = false; error.value = 'The photo could not be captured in this browser.'; return; }
  context.drawImage(video.value, 0, 0);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .95));
  if (current !== generation || !props.open) return;
  capturing.value = false;
  if (!blob) { error.value = 'The photo could not be captured. Try again.'; return; }
  emit('capture', new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' }));
  stop(); emit('close');
}
onUnmounted(stop);
</script>

<template>
  <UiDialog :open="open" title="Use camera" @close="close">
    <div class="camera-capture"><p v-if="error" role="alert">{{ error }}</p><video ref="video" muted playsinline aria-label="Camera preview"/><p>The photo joins your upload queue. It is sent when you save the batch.</p><div class="dialog-actions"><UiButton @click="close">Cancel</UiButton><UiButton variant="primary" :disabled="!ready || capturing" @click="capture">Capture photo</UiButton></div></div>
  </UiDialog>
</template>

<style scoped>
.camera-capture{padding-top:16px}.camera-capture video{display:block;width:100%;max-height:400px;background:#111;border-radius:8px}.camera-capture p{font-size:13px;margin:12px 0}
</style>
