<script setup>
// The page a phone opens from a phone upload link (a QR code on the Upload page): it sends photos into one project,
// for an hour, without signing in. The link's secret is the only authority it has, it may only upload, and the
// server checks it on every call (phone_links.py). The secret leaves the address at once and stays in this tab only.
import { computed, onMounted, ref } from 'vue';
import { Camera, Images, Upload, Check, CircleAlert } from 'lucide-vue-next';
import { phoneApi, inBatches } from '../api/phone.js';

const props = defineProps({ secret: { type: String, required: true } });
const info = ref(null); const error = ref(''); const files = ref([]); const busy = ref(false);
const sent = ref(0); const done = ref(null); const left = ref(0);
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

onMounted(async () => {
  try { info.value = await phoneApi.info(props.secret); left.value = info.value.photos_left; }
  catch (e) { error.value = e.message; }
});
const until = computed(() => (info.value ? new Date(info.value.expires_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : ''));
function add(event) {
  error.value = ''; done.value = null;
  for (const file of Array.from(event.target.files || [])) {
    if (!TYPES.includes(file.type)) { error.value = `${file.name}: send a JPEG, PNG or WebP photo.`; continue; }
    if (file.size > 15 * 1024 * 1024) { error.value = `${file.name} is larger than 15 MB.`; continue; }
    if (files.value.length >= left.value) { error.value = `This link takes ${left.value} more photos.`; break; }
    files.value.push({ file, url: URL.createObjectURL(file), key: `${file.name}-${file.size}-${files.value.length}` });
  }
  event.target.value = '';
}
function remove(item) { URL.revokeObjectURL(item.url); files.value = files.value.filter(f => f !== item); }
async function send() {
  if (busy.value || !files.value.length) return;
  busy.value = true; error.value = ''; sent.value = 0;
  const totals = { added: 0, already: 0, stored: 0, rejected: 0, skipped: 0 }; const problems = [];
  try {
    for (const part of inBatches(files.value.map(f => f.file))) {
      const body = await phoneApi.send(props.secret, part);
      Object.keys(totals).forEach(k => { totals[k] += body.counts[k] || 0; });
      problems.push(...body.results.filter(r => ['rejected', 'stored', 'skipped'].includes(r.state)));
      sent.value += part.length; left.value = body.photos_left;
    }
    files.value.forEach(f => URL.revokeObjectURL(f.url)); files.value = [];
    done.value = { totals, problems };
  } catch (e) { error.value = `${e.message}${sent.value ? ` ${sent.value} photos were sent before this.` : ''}`; }
  finally { busy.value = false; }
}
</script>

<template>
  <main class="phone">
    <header><span class="mark"><Upload :size="18"/></span><div><small>AADML Training Data</small><h1>{{ info ? `Send photos to ${info.project}` : 'Send photos' }}</h1></div></header>
    <p v-if="!info && !error" class="quiet">Opening the link…</p>
    <section v-if="error && !info" class="ended" role="alert"><CircleAlert :size="22"/><p>{{ error }}</p></section>
    <template v-if="info">
      <p class="quiet">This link works until {{ until }} and takes {{ left }} more photo{{ left===1?'':'s' }}. They go into the project as {{ info.origin === 'customer' ? 'customer photos' : 'development images' }}{{ info.grouping === 'one' ? ', all of one home' : ', each its own home' }}.</p>
      <div class="pickers">
        <label class="pick primary"><Camera :size="22"/><span>Take a photo</span><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" :disabled="busy||!left" @change="add"></label>
        <label class="pick"><Images :size="22"/><span>Choose photos</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple :disabled="busy||!left" @change="add"></label>
      </div>
      <p v-if="error" class="problem" role="alert">{{ error }}</p>
      <ul v-if="files.length" class="chosen" aria-label="Photos to send">
        <li v-for="item in files" :key="item.key"><img :src="item.url" :alt="item.file.name"><button type="button" :aria-label="`Remove ${item.file.name}`" :disabled="busy" @click="remove(item)">×</button></li>
      </ul>
      <button v-if="files.length" class="send" type="button" :disabled="busy" @click="send">{{ busy ? `Sending… ${sent} of ${files.length}` : `Send ${files.length} photo${files.length===1?'':'s'}` }}</button>
      <section v-if="done" class="sent" role="status"><Check :size="20"/><div><strong>{{ done.totals.added }} added{{ done.totals.already ? `, ${done.totals.already} already in the project` : '' }}.</strong>
        <p v-if="done.totals.stored">{{ done.totals.stored }} kept as a record only: the project's data-use answers do not allow training.</p>
        <p v-for="p in done.problems.filter(x => x.state==='rejected')" :key="p.name">{{ p.name }}: {{ p.detail }}</p>
        <p>You can send more while the link works.</p></div></section>
    </template>
  </main>
</template>

<style scoped>
.phone{max-width:520px;margin:0 auto;padding:24px 16px 48px;font:15px/1.55 Inter,system-ui,sans-serif;color:#162139;background:#fff;min-height:100vh}
header{display:flex;gap:12px;align-items:center;margin-bottom:14px}
.mark{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:var(--aadml-primary,#2563eb);color:#fff;flex-shrink:0}
header small{display:block;font-size:12px;color:#4c5d74}
h1{font-size:21px;margin:2px 0 0;letter-spacing:-.3px}
.quiet{color:#4c5d74;font-size:14px;margin:8px 0 18px}
.pickers{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.pick{position:relative;display:flex;flex-direction:column;align-items:center;gap:8px;padding:20px 10px;border:1px solid #d4d9e3;border-radius:12px;font-weight:600;color:#24324a;background:#f8fafc;cursor:pointer;min-height:96px;justify-content:center}
.pick.primary{background:var(--aadml-primary,#2563eb);border-color:var(--aadml-primary,#2563eb);color:#fff}
.pick input{position:absolute;inset:0;opacity:0;cursor:pointer}
.pick:focus-within{outline:3px solid var(--aadml-outline,#93c5fd);outline-offset:2px}
.chosen{list-style:none;padding:0;margin:18px 0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.chosen li{position:relative;aspect-ratio:1;border-radius:8px;overflow:hidden;background:#eef1f5}
.chosen img{width:100%;height:100%;object-fit:cover;display:block}
.chosen button{position:absolute;top:4px;right:4px;width:32px;height:32px;border-radius:50%;border:0;background:#0f172acc;color:#fff;font-size:18px;line-height:1;cursor:pointer}
.send{width:100%;min-height:52px;border:0;border-radius:12px;background:#12805c;color:#fff;font:600 16px/1 Inter,system-ui,sans-serif;cursor:pointer}
.send:disabled{opacity:.7;cursor:progress}
.sent,.ended{display:flex;gap:10px;align-items:flex-start;margin-top:18px;padding:14px;border-radius:10px;background:#ecf7f1;color:#1f5f43}
.ended{background:#fff4f2;color:#9a2a1b}
.sent p,.ended p{margin:4px 0 0;font-size:14px;color:inherit}
.problem{color:#b42318;font-size:14px;margin:12px 0}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
