<script setup>
// The Brush / Eraser cursor (ADM-1344): a circle the size of the brush, drawn INSIDE the editor's SVG overlay
// (viewBox 600 x 300, preserveAspectRatio none), so it follows zoom and pan with the shapes. It is an ellipse in stage
// units and a circle on the screen. 1.5 px white over a navy halo, so it shows on light and dark photos; the eraser's
// circle is dashed, so the mode is not told by colour alone. It never takes a pointer event.
//
// Props: point ([x, y] in stage units, or null to hide it), size (brush diameter in photo pixels), photoWidth,
// photoHeight, erasing (boolean). No events.
import { computed } from 'vue';
import { cursorEllipse } from '../useBrush.js';

const props = defineProps({
  point: { type: Array, default: null },
  size: { type: Number, required: true },
  photoWidth: { type: Number, required: true },
  photoHeight: { type: Number, required: true },
  erasing: { type: Boolean, default: false },
});
const circle = computed(() => {
  if (!props.point || !props.photoWidth || !props.photoHeight) return null;
  return cursorEllipse([props.point[0] * props.photoWidth / 600, props.point[1] * props.photoHeight / 300], props.size, props.photoWidth, props.photoHeight);
});
</script>

<template>
  <g v-if="circle" :class="['brush-cursor', { erasing }]" pointer-events="none" aria-hidden="true">
    <ellipse class="brush-cursor-halo" :cx="circle.cx" :cy="circle.cy" :rx="circle.rx" :ry="circle.ry"/>
    <ellipse class="brush-cursor-line" :cx="circle.cx" :cy="circle.cy" :rx="circle.rx" :ry="circle.ry"/>
  </g>
</template>

<style scoped>
.brush-cursor ellipse{fill:none;vector-effect:non-scaling-stroke}
.brush-cursor-halo{stroke:rgba(15,23,42,.7);stroke-width:3.5px}
.brush-cursor-line{stroke:#fff;stroke-width:1.5px}
.brush-cursor.erasing .brush-cursor-line{stroke-dasharray:4 3}
.brush-cursor.erasing .brush-cursor-halo{stroke-dasharray:4 3}
</style>
