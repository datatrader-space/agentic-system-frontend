<script setup>
// What an open photo model found on one photo (Try on My models), drawn on it. The answer is the model's own pipeline
// output (backend platform_servers.pipeline; ml/hf_serve): segmentation masks (base64 PNG, at the size the photo was
// sent) are coloured over the photo, detection boxes drawn with their labels, and classifications listed. Anything
// else is shown as JSON only. The answer is untrusted: only these fields are read, and a mask is drawn only from a PNG.
import { computed, onBeforeUnmount, ref, watch } from 'vue';

const props = defineProps({ answer: Object, photoUrl: String });
const COLOURS = ['#2563eb', '#f59e0b', '#12b76a', '#c11574', '#7c3aed', '#0e9384', '#b54708', '#363f72'];
const MAX_ITEMS = 50;

const items = computed(() => (Array.isArray(props.answer?.output) ? props.answer.output.slice(0, MAX_ITEMS) : [])
  .filter(item => item && typeof item === 'object'));
const sent = computed(() => {
  const image = props.answer?.image || {};
  return { width: Number(image.sent_width || image.width) || 1, height: Number(image.sent_height || image.height) || 1 };
});
const kind = computed(() => {
  if (!items.value.length) return 'other';
  if (items.value.some(item => typeof item.mask === 'string')) return 'masks';
  if (items.value.some(item => item.box && typeof item.box === 'object')) return 'boxes';
  if (items.value.every(item => typeof item.label === 'string')) return 'labels';
  return 'other';
});
const labelOf = item => (typeof item.label === 'string' && item.label ? item.label : 'Unnamed');
const scoreOf = item => (typeof item.score === 'number' && Number.isFinite(item.score) ? `${Math.round(item.score * 100)}%` : '—');
const boxes = computed(() => items.value.map((item, i) => {
  const b = item.box || {};
  const [x1, y1, x2, y2] = ['xmin', 'ymin', 'xmax', 'ymax'].map(k => Number(b[k]));
  return [x1, y1, x2, y2].every(Number.isFinite) && x2 > x1 && y2 > y1
    ? { x: x1, y: y1, w: x2 - x1, h: y2 - y1, colour: COLOURS[i % COLOURS.length], label: labelOf(item), score: scoreOf(item) } : null;
}).filter(Boolean));
const font = computed(() => Math.max(sent.value.width, sent.value.height) / 40);

// Each mask (white where the class is) becomes a transparent layer in its colour, drawn on a canvas of the sent size.
const layers = ref([]);
let made = 0;
function hexToRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function colourMask(source, colour) {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const [r, g, b] = hexToRgb(colour);
      for (let i = 0; i < pixels.data.length; i += 4) {
        const on = pixels.data[i] > 127;
        pixels.data[i] = r; pixels.data[i + 1] = g; pixels.data[i + 2] = b; pixels.data[i + 3] = on ? 115 : 0;
      }
      context.putImageData(pixels, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => resolve('');
    image.src = source;
  });
}
watch(() => [props.answer, kind.value], async () => {
  const run = ++made;
  layers.value = [];
  if (kind.value !== 'masks') return;
  const drawn = await Promise.all(items.value.map((item, i) => {
    const colour = COLOURS[i % COLOURS.length];
    const png = typeof item.mask === 'string' && /^[A-Za-z0-9+/=]+$/.test(item.mask) ? `data:image/png;base64,${item.mask}` : '';
    return (png ? colourMask(png, colour) : Promise.resolve('')).then(url => ({ url, colour, label: labelOf(item), score: scoreOf(item) }));
  }));
  if (run === made) layers.value = drawn;
}, { immediate: true });
onBeforeUnmount(() => { made += 1; });
const legend = computed(() => (kind.value === 'masks' ? layers.value : kind.value === 'boxes' ? boxes.value : []));
</script>

<template>
  <div v-if="answer" class="pipeline-result">
    <div v-if="kind==='masks'||kind==='boxes'" class="stage">
      <img :src="photoUrl" alt="The photo you chose, with what the model found drawn on it">
      <template v-if="kind==='masks'"><img v-for="(layer, i) in layers.filter(l => l.url)" :key="i" :src="layer.url" alt="" aria-hidden="true" class="mask-layer"></template>
      <svg v-else :viewBox="`0 0 ${sent.width} ${sent.height}`" preserveAspectRatio="none" aria-hidden="true">
        <g v-for="(b, i) in boxes" :key="i">
          <rect :x="b.x" :y="b.y" :width="b.w" :height="b.h" fill="none" :stroke="b.colour" stroke-width="3" vector-effect="non-scaling-stroke"/>
          <text :x="b.x + 4" :y="b.y + font" :font-size="font" fill="#fff" stroke="#162139" stroke-width="3" paint-order="stroke" vector-effect="non-scaling-stroke">{{ b.label }} · {{ b.score }}</text>
        </g>
      </svg>
    </div>
    <div v-if="kind!=='other'" class="table-wrap">
      <table><thead><tr><th>Found</th><th>Confidence</th></tr></thead>
        <tbody>
          <tr v-for="(row, i) in (kind==='labels' ? items.map(item => ({ label: labelOf(item), score: scoreOf(item) })) : legend)" :key="i">
            <td><span v-if="row.colour" class="swatch" :style="{background: row.colour}"></span>{{ row.label }}</td><td>{{ row.score }}</td>
          </tr>
        </tbody></table>
    </div>
    <p v-if="kind==='other'" class="test-meta">This model's answer is shown as it came.</p>
    <p v-if="answer.charged" class="test-meta">Charged {{ answer.charged }}.</p>
    <details class="json" :open="kind==='other'"><summary>Its answer (JSON)</summary><pre>{{ JSON.stringify(answer.output, null, 2) }}</pre></details>
  </div>
</template>

<style scoped>
.pipeline-result{display:grid;gap:14px;margin-top:16px}
.stage{position:relative;line-height:0;border-radius:8px;overflow:hidden;background:#f6f7f9}
.stage img{width:100%;height:auto;display:block}
.stage .mask-layer{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.stage svg{position:absolute;inset:0;width:100%;height:100%}
.test-meta{font-size:12px!important;color:#6d7c92!important;margin:0!important}
.swatch{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:8px;vertical-align:middle}
.json summary{cursor:pointer;font-size:12px;color:var(--aadml-primary)}
.json pre{max-height:320px;overflow:auto;background:#f8f9fb;border-radius:7px;padding:12px}
</style>
