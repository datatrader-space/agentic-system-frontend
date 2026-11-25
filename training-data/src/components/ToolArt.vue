<script setup>
// The small picture of a tool at work, for its hover card (ToolHoverCard.vue). Our own drawing: a plain room with an
// armchair and a plant, and what the tool does to it. Inline SVG, no image files; a short movement where it helps,
// none when the person asks for reduced motion.
defineProps({ id: { type: String, required: true } });
const chair = 'M150 58 q0-14 14-14 h28 q14 0 14 14 v10 q8 0 8 9 v19 h-8 v6 h-6 v-6 h-38 v6 h-6 v-6 h-8 v-19 q0-9 8-9 z';
const chairPoints = '142,67 150,52 164,44 192,44 206,52 214,67 214,96 142,96';
</script>

<template>
  <svg class="tool-art" viewBox="0 0 240 120" role="img" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient :id="`wall-${id}`" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef3fa"/><stop offset="1" stop-color="#dfe7f2"/></linearGradient>
    </defs>
    <g :class="['art-scene', { 'art-pan': id==='pan', 'art-turn': id==='rotate' }]">
      <rect x="0" y="0" width="240" height="120" :fill="`url(#wall-${id})`"/>
      <rect x="0" y="96" width="240" height="24" fill="#cfd8e4"/>
      <rect x="22" y="16" width="56" height="44" rx="3" fill="#f8fbff" stroke="#c3cfdf" stroke-width="2"/>
      <line x1="50" y1="16" x2="50" y2="60" stroke="#c3cfdf" stroke-width="2"/>
      <path d="M98 96 l4-22 h20 l4 22 z" fill="#b9a48c"/>
      <path d="M112 74 q-14-10-10-26 q8 6 10 20 q2-18 12-24 q2 16-10 30" fill="#6f9f7f"/>
      <path :d="chair" fill="#8aa0bf"/>
    </g>

    <g v-if="id==='pan'" class="art-overlay">
      <circle cx="120" cy="60" r="17" fill="#fff" opacity=".92"/>
      <path d="M120 49 v22 M109 60 h22 M120 49 l-4 4 M120 49 l4 4 M120 71 l-4-4 M120 71 l4-4 M109 60 l4-4 M109 60 l4 4 M131 60 l-4-4 M131 60 l-4 4" stroke="#2563eb" stroke-width="2" fill="none" stroke-linecap="round"/>
    </g>
    <g v-else-if="id==='select'" class="art-overlay">
      <polygon :points="chairPoints" fill="#2563eb" fill-opacity=".16" stroke="#2563eb" stroke-width="2"/>
      <circle v-for="(p,i) in chairPoints.split(' ')" :key="i" :cx="p.split(',')[0]" :cy="p.split(',')[1]" r="3" fill="#fff" stroke="#0f172a" stroke-width="1.2"/>
      <path class="art-move" d="M206 52 l0 14 l4-4 l4 7 l3-1.5 l-4-7 l6 0 z" fill="#0f172a" stroke="#fff" stroke-width="1"/>
    </g>
    <g v-else-if="id==='box'" class="art-overlay">
      <rect class="art-draw" x="138" y="40" width="80" height="60" fill="#2563eb" fill-opacity=".1" stroke="#2563eb" stroke-width="2" stroke-dasharray="6 4"/>
      <circle cx="138" cy="40" r="3.5" fill="#dc2626" stroke="#fff"/>
      <path d="M218 100 l0 12 l3-3 l3 6 l2.6-1.3 l-3-6 l5 0 z" fill="#0f172a" stroke="#fff" stroke-width="1"/>
    </g>
    <g v-else-if="id==='polygon'" class="art-overlay">
      <polyline class="art-draw" points="142,96 142,67 150,52 164,44 192,44 206,52 214,67" fill="none" stroke="#2563eb" stroke-width="2"/>
      <line x1="214" y1="67" x2="214" y2="96" stroke="#2563eb" stroke-width="2" stroke-dasharray="5 4"/>
      <circle cx="142" cy="96" r="4" fill="#dc2626" stroke="#fff"/>
      <circle v-for="(p,i) in ['142,67','150,52','164,44','192,44','206,52','214,67']" :key="i" :cx="p.split(',')[0]" :cy="p.split(',')[1]" r="2.8" fill="#fff" stroke="#0f172a" stroke-width="1.2"/>
    </g>
    <g v-else-if="id==='split'" class="art-overlay">
      <polygon points="142,67 150,52 164,44 178,44 178,96 142,96" fill="#2563eb" fill-opacity=".22" stroke="#2563eb" stroke-width="2"/>
      <polygon points="178,44 192,44 206,52 214,67 214,96 178,96" fill="#0ea5e9" fill-opacity=".22" stroke="#0ea5e9" stroke-width="2"/>
      <line class="art-draw" x1="178" y1="30" x2="178" y2="110" stroke="#dc2626" stroke-width="2.5" stroke-dasharray="7 4" stroke-linecap="round"/>
    </g>
    <g v-else-if="id==='brush'" class="art-overlay">
      <path class="art-draw" d="M150 60 q20-12 50-4 M148 74 q30-8 62 0 M148 88 q32-6 62 0" stroke="#2563eb" stroke-opacity=".55" stroke-width="13" fill="none" stroke-linecap="round"/>
      <circle cx="210" cy="88" r="8" fill="none" stroke="#0f172a" stroke-width="1.5"/>
    </g>
    <g v-else-if="id==='rotate'" class="art-overlay">
      <path d="M96 30 a34 34 0 1 1 -10 26" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round"/>
      <path d="M84 48 l2 10 l9-5" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <g v-else-if="id==='smart'" class="art-overlay">
      <path :d="chair" fill="#2563eb" fill-opacity=".5"/>
      <circle cx="178" cy="70" r="5" fill="#2563eb" stroke="#fff" stroke-width="1.5"/><path d="M175.5 70 h5 M178 67.5 v5" stroke="#fff" stroke-width="1.4"/>
      <circle cx="230" cy="40" r="5" fill="#ef4444" stroke="#fff" stroke-width="1.5"/><path d="M227.5 40 h5" stroke="#fff" stroke-width="1.4"/>
    </g>
    <g v-else-if="id==='assist'" class="art-overlay">
      <rect x="140" y="40" width="78" height="62" fill="none" stroke="#2563eb" stroke-width="2" stroke-dasharray="6 4"/>
      <rect x="96" y="44" width="34" height="54" fill="none" stroke="#14b8a6" stroke-width="2" stroke-dasharray="6 4"/>
      <path class="art-spark" d="M120 14 l3 8 l8 3 l-8 3 l-3 8 l-3-8 l-8-3 l8-3 z" fill="#2563eb"/>
    </g>
    <g v-else-if="id==='outline'" class="art-overlay">
      <rect x="136" y="38" width="84" height="66" fill="none" stroke="#64748b" stroke-width="1.5" stroke-dasharray="5 4"/>
      <polygon class="art-draw" :points="chairPoints" fill="#2563eb" fill-opacity=".18" stroke="#2563eb" stroke-width="2"/>
    </g>
    <g v-else-if="id==='find'" class="art-overlay">
      <rect x="8" y="8" width="84" height="22" rx="11" fill="#fff" stroke="#2563eb" stroke-width="1.5"/>
      <text x="20" y="23" font-size="11" font-family="inherit" fill="#1e3a8a">armchair</text>
      <path class="art-spark" d="M80 13 l2 5 l5 2 l-5 2 l-2 5 l-2-5 l-5-2 l5-2 z" fill="#2563eb"/>
      <path :d="chair" fill="#2563eb" fill-opacity=".45" stroke="#2563eb" stroke-width="1.5"/>
    </g>
    <g v-else-if="id==='refine'" class="art-overlay">
      <polygon points="138,70 152,46 200,40 218,64 212,100 146,100" fill="none" stroke="#64748b" stroke-width="1.5" stroke-dasharray="5 4"/>
      <polygon class="art-draw" :points="chairPoints" fill="#2563eb" fill-opacity=".16" stroke="#2563eb" stroke-width="2"/>
      <path class="art-spark" d="M226 18 l2.5 6 l6 2.5 l-6 2.5 l-2.5 6 l-2.5-6 l-6-2.5 l6-2.5 z" fill="#2563eb"/>
    </g>
    <g v-else-if="id==='comments'" class="art-overlay">
      <polygon :points="chairPoints" fill="#2563eb" fill-opacity=".14" stroke="#2563eb" stroke-width="2"/>
      <path d="M150 12 h70 q6 0 6 6 v16 q0 6-6 6 h-50 l-10 8 v-8 h-10 q-6 0-6-6 v-16 q0-6 6-6 z" fill="#fff" stroke="#c3cfdf"/>
      <path d="M156 22 h52 M156 30 h34" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round"/>
    </g>
    <g v-else-if="id==='undo'||id==='redo'" class="art-overlay">
      <polygon :points="chairPoints" fill="#2563eb" fill-opacity=".14" stroke="#2563eb" stroke-width="2" :class="id==='undo'?'art-fade':'art-appear'"/>
      <g :transform="id==='redo'?'translate(240 0) scale(-1 1)':''">
        <path d="M44 74 q30-30 62-6" fill="none" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/>
        <path d="M44 62 v12 h12" fill="none" stroke="#0f172a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
    </g>
    <g v-else-if="id==='empty'" class="art-overlay">
      <circle cx="120" cy="60" r="20" fill="#fff" opacity=".92"/>
      <circle cx="120" cy="60" r="13" fill="none" stroke="#0f172a" stroke-width="2.5"/><line x1="111" y1="69" x2="129" y2="51" stroke="#0f172a" stroke-width="2.5"/>
    </g>
    <g v-else-if="id==='labels'" class="art-overlay">
      <polygon :points="chairPoints" fill="#2563eb" fill-opacity=".16" stroke="#2563eb" stroke-width="2" class="art-blink"/>
      <path d="M96 60 q24-22 48 0 q-24 22-48 0 z" fill="#fff" stroke="#0f172a" stroke-width="2"/><circle cx="120" cy="60" r="6" fill="#0f172a"/>
    </g>
  </svg>
</template>

<style scoped>
.tool-art { display: block; width: 100%; height: auto; border-radius: 8px; background: #eef3fa; }
.art-pan { animation: art-pan 2.4s ease-in-out infinite; }
.art-turn { transform-origin: 120px 60px; animation: art-turn 2.8s ease-in-out infinite; }
.art-draw { stroke-dasharray: 260; animation: art-draw 2.2s ease-out infinite; }
rect.art-draw { stroke-dasharray: 6 4; animation: none; }
.art-move { animation: art-move 2s ease-in-out infinite; }
.art-spark { transform-box: fill-box; transform-origin: center; animation: art-spark 1.8s ease-in-out infinite; }
.art-fade { animation: art-fade 2.4s ease-in-out infinite; }
.art-appear { animation: art-fade 2.4s ease-in-out infinite reverse; }
.art-blink { animation: art-fade 2.4s steps(2, jump-none) infinite; }
@keyframes art-pan { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(-10px); } }
@keyframes art-turn { 0%, 30% { transform: rotate(0); } 60%, 100% { transform: rotate(90deg) scale(.5); } }
@keyframes art-draw { from { stroke-dashoffset: 260; } 70%, to { stroke-dashoffset: 0; } }
@keyframes art-move { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(6px, 4px); } }
@keyframes art-spark { 0%, 100% { transform: scale(.8); opacity: .7; } 50% { transform: scale(1.1); opacity: 1; } }
@keyframes art-fade { 0%, 20% { opacity: 1; } 60%, 100% { opacity: .15; } }
@media (prefers-reduced-motion: reduce) {
  .art-pan, .art-turn, .art-draw, .art-move, .art-spark, .art-fade, .art-appear, .art-blink { animation: none; }
}
</style>
