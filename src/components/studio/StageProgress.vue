<template>
  <ol v-if="stages.length" class="stage-list" :aria-label="label" aria-live="polite" data-test="stage-progress">
    <li v-for="s in stages" :key="s.stage" :class="['stage', `is-${s.state}`]" :data-stage="s.stage">
      <span class="stage-mark" aria-hidden="true">
        <svg v-if="s.state === 'done'" viewBox="0 0 16 16"><path d="m3.5 8.5 3 3 6-7" /></svg>
        <svg v-else-if="s.state === 'failed'" viewBox="0 0 16 16"><path d="m4.5 4.5 7 7M11.5 4.5l-7 7" /></svg>
        <svg v-else-if="s.state === 'waiting'" viewBox="0 0 16 16"><path d="M8 4.5V8l2.5 1.5" /><circle cx="8" cy="8" r="5.5" /></svg>
        <svg v-else-if="s.state === 'skipped'" viewBox="0 0 16 16"><path d="M4 8h8" /></svg>
        <span v-else class="stage-spin" />
      </span>
      <span class="stage-text"><strong>{{ name(s.stage) }}</strong><span class="st-sr"> {{ stateWords[s.state] || s.state }}</span><span v-if="s.detail" class="stage-detail">{{ s.detail }}</span></span>
    </li>
  </ol>
</template>
<script setup>
// The stages of a website read (Ads Studio: a brand or a product), shown as each one starts and ends. The server pushes
// them as `video_stage` frames; the page's answer carries the same list, so the steps show even without the socket.
defineProps({ stages: { type: Array, default: () => [] }, label: { type: String, default: 'Progress' } })
const NAMES = { fetch: 'Opening the page', read: 'Reading what the page states', model: 'Reading its text with a model', images: 'Keeping its images as your files', summary: 'Writing the tagline, voice and audience', done: 'Draft ready' }
const name = stage => NAMES[stage] || String(stage || '').replace(/[_-]+/g, ' ')
const stateWords = { running: 'in progress', done: 'done', failed: 'failed', waiting: 'waiting for you', skipped: 'skipped' }
</script>
<style scoped>
.stage-list{display:grid;gap:8px;margin:0;padding:0;list-style:none}
.stage{display:flex;align-items:flex-start;gap:10px;font-size:13px;color:var(--vm-ink-soft);line-height:1.45}
.stage.is-running,.stage.is-waiting{color:var(--vm-ink)}
.stage-mark{display:grid;place-items:center;flex:none;width:20px;height:20px;border:1px solid var(--vm-line);border-radius:50%;background:var(--vm-surface)}
.stage-mark svg{width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.stage.is-done .stage-mark{border-color:var(--vm-violet);color:var(--vm-violet)}
.stage.is-failed .stage-mark{border-color:var(--vm-ink);color:var(--vm-ink)}
.stage.is-waiting .stage-mark{border-color:var(--vm-violet);background:var(--vm-violet-soft);color:var(--vm-violet)}
.stage-spin{width:10px;height:10px;border:2px solid var(--vm-line);border-top-color:var(--vm-violet);border-radius:50%;animation:stage-turn .9s linear infinite}
.stage-text{display:grid;gap:2px;min-width:0;overflow-wrap:anywhere}.stage-text strong{font-weight:500}
.stage-detail{font-size:12px;color:var(--vm-ink-soft)}
@keyframes stage-turn{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.stage-spin{animation:none;border-top-color:var(--vm-line)}}
</style>
