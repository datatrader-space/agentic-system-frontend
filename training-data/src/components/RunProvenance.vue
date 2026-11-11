<script setup>
// "What this run used" and the Cost line of a run's or an evaluation's view (ADM-1210 §3.9), vision and language
// model alike. The rows come from api/provenance.js: an empty value is left out, a sha is shown by its first 12
// characters with the full value in its title and a Copy button. The block starts closed.
import { computed, onUnmounted, ref } from 'vue';
import { Check, Copy } from 'lucide-vue-next';
import { usedGroups, configPart, costText, shortSha } from '../api/provenance.js';

const props = defineProps({
  used: { type: Object, default: null },
  cost: { type: Object, default: null },
  what: { type: String, default: 'run' },           // 'run' or 'evaluation'
});

const groups = computed(() => usedGroups(props.used, props.what));
const config = computed(() => configPart(props.used));
const costLine = computed(() => costText(props.cost, props.used?.own_machines));
const title = computed(() => (props.what === 'run' ? 'What this run used' : 'What this evaluation used'));
const uid = `used-${Math.random().toString(36).slice(2, 9)}`;

// The copy says what it did beside the button, for a moment (and to a screen reader).
const copied = ref(''); const said = ref(''); let timer = null;
async function copy(value, label) {
  clearTimeout(timer);
  try { await navigator.clipboard.writeText(value); copied.value = value; said.value = `${label} copied.`; }
  catch { copied.value = ''; said.value = `${label} could not be copied.`; }
  timer = setTimeout(() => { copied.value = ''; said.value = ''; }, 2000);
}
onUnmounted(() => clearTimeout(timer));
</script>

<template>
  <div v-if="cost || groups.length || config" class="provenance">
    <p v-if="costLine" class="provenance-cost"><strong>Cost</strong><span>{{ costLine }}</span></p>
    <details v-if="groups.length || config" class="provenance-used">
      <summary>{{ title }}</summary>
      <p class="sr-only" role="status" aria-live="polite">{{ said }}</p>
      <div class="provenance-groups">
        <section v-for="g in groups" :key="g.key" class="provenance-group" :aria-labelledby="`${uid}-${g.key}`">
          <h4 :id="`${uid}-${g.key}`">{{ g.title }}</h4>
          <dl>
            <template v-for="r in g.rows" :key="r.label">
              <dt>{{ r.label }}</dt>
              <dd>
                <span v-if="r.text" class="provenance-text">{{ r.text }}</span>
                <span v-if="r.sha" class="provenance-sha">
                  <code :title="r.sha" translate="no">{{ shortSha(r.sha) }}</code>
                  <button type="button" class="icon-button provenance-copy" :aria-label="`Copy the full ${r.label.toLowerCase()} value`" @click="copy(r.sha, r.label)">
                    <Check v-if="copied === r.sha" :size="14" aria-hidden="true"/><Copy v-else :size="14" aria-hidden="true"/>
                  </button>
                </span>
              </dd>
            </template>
          </dl>
        </section>
        <section v-if="config" class="provenance-group provenance-config" :aria-labelledby="`${uid}-config`">
          <h4 :id="`${uid}-config`">Configuration</h4>
          <dl>
            <template v-if="config.name"><dt>Name</dt><dd>{{ config.name }}</dd></template>
            <template v-if="config.source"><dt>Values</dt><dd>{{ config.source }}</dd></template>
            <template v-if="config.seed"><dt>Seed</dt><dd>{{ config.seed }}</dd></template>
            <template v-if="config.sha"><dt>Configuration sha</dt><dd><span class="provenance-sha">
              <code :title="config.sha" translate="no">{{ shortSha(config.sha) }}</code>
              <button type="button" class="icon-button provenance-copy" aria-label="Copy the full configuration sha value" @click="copy(config.sha, 'Configuration sha')">
                <Check v-if="copied === config.sha" :size="14" aria-hidden="true"/><Copy v-else :size="14" aria-hidden="true"/>
              </button></span></dd></template>
          </dl>
          <details v-if="config.text" class="provenance-values">
            <summary>Show the configuration</summary>
            <pre class="code-block provenance-code" tabindex="0" :aria-label="`The configuration ${config.source.toLowerCase()}`" translate="no">{{ config.text }}</pre>
          </details>
        </section>
      </div>
    </details>
  </div>
</template>

<style scoped>
.provenance{display:grid;gap:10px;margin:14px 0}
.provenance-cost{display:flex;flex-wrap:wrap;gap:4px 12px;margin:0;font-size:13px;line-height:1.6;color:#24344c!important}
.provenance-cost strong{color:#162139;font-weight:600;min-width:48px}
.provenance-used{border:1px solid #e3e8ef;border-radius:10px;background:#fff}
.provenance-used>summary{display:flex;align-items:center;gap:8px;min-height:44px;padding:10px 16px;cursor:pointer;font-size:13px;font-weight:600;color:#162139;border-radius:10px;list-style:none}
.provenance-used>summary::-webkit-details-marker{display:none}
.provenance-used>summary::before{content:'';width:7px;height:7px;border-right:2px solid #5f6d82;border-bottom:2px solid #5f6d82;transform:rotate(-45deg);transition:transform .15s ease;flex:none}
.provenance-used[open]>summary::before{transform:rotate(45deg)}
.provenance-used>summary:hover{background:var(--aadml-tint)}
.provenance-used summary:focus-visible,.provenance-copy:focus-visible,.provenance-code:focus-visible{outline:2px solid var(--aadml-focus);outline-offset:2px}
.provenance-groups{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:18px 28px;padding:6px 16px 16px;border-top:1px solid #edf0f5}
.provenance-group{min-width:0}
.provenance-group h4{margin:12px 0 8px;font-size:12px;font-weight:600;color:#24344c}
.provenance-group dl{display:grid;grid-template-columns:minmax(110px,max-content) minmax(0,1fr);gap:6px 16px;margin:0;font-size:12px}
.provenance-group dt{color:#5f6d82}
.provenance-group dd{margin:0;color:#162139;min-width:0;overflow-wrap:anywhere;display:flex;flex-wrap:wrap;align-items:center;gap:2px 8px}
.provenance-sha{display:inline-flex;align-items:center;gap:2px}
.provenance-sha code{font-size:11.5px;color:#24344c;background:#f3f5f9;border-radius:4px;padding:1px 5px}
.provenance-copy{margin-left:0;min-width:32px;min-height:32px;color:#5f6d82}
.provenance-config{grid-column:1/-1}
.provenance-values{margin-top:10px}
.provenance-values>summary{display:inline-flex;align-items:center;min-height:36px;cursor:pointer;font-size:12px;font-weight:550;color:var(--aadml-primary)}
.provenance-values>summary:focus-visible{outline:2px solid var(--aadml-focus);outline-offset:2px;border-radius:4px}
.provenance-code{min-height:0;max-height:320px;overflow:auto;margin:6px 0 0;padding:14px 16px;font-size:11px;white-space:pre-wrap;overflow-wrap:anywhere}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media(max-width:550px){
  .provenance-groups{padding:4px 12px 14px}
  .provenance-group dl{grid-template-columns:1fr;gap:0}
  .provenance-group dd{margin-bottom:8px}
}
@media(pointer:coarse){.provenance-copy,.provenance-values>summary{min-width:44px;min-height:44px}}
@media(prefers-reduced-motion:reduce){.provenance-used>summary::before{transition:none}}
</style>
