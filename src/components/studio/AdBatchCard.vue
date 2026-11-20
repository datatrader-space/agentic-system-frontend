<template>
  <section class="creative-card adb" :aria-labelledby="headingId" data-test="ad-batch">
    <div class="adb-head">
      <h2 :id="headingId">{{ batch.title }}</h2>
      <p class="adb-total" data-test="ad-batch-price">{{ totalWords }}</p>
    </div>
    <ul class="adb-items">
      <li v-for="item in batch.items" :key="item.item" class="adb-item">
        <div class="adb-item-head"><strong>{{ item.name }}</strong><span class="st-muted">{{ itemPrice(item) }}</span></div>
        <p v-if="item.concept" class="adb-copy"><span>Headline: {{ item.concept.headline }}</span><span>Post text: {{ item.concept.primary_text }}</span></p>
        <ol class="adb-steps">
          <li v-for="s in [...shared, ...item.steps]" :key="`${s.kind}-${s.item}`" :class="`is-${stepState(s)}`">
            <span>{{ STEP_NAMES[s.kind] }}</span><span class="st-muted">{{ stepWords(s) }}</span>
          </li>
        </ol>
        <a v-if="item.result" class="adb-result" :href="item.result.url" target="_blank" rel="noopener">
          <img v-if="item.result.media_type === 'image'" :src="item.result.thumbnail_url || item.result.url" :alt="`Result: ${item.name}`" />
          <span>{{ item.result.media_type === 'video' ? 'Open the ad with this variant' : 'Open the finished ad image' }}</span>
        </a>
      </li>
    </ul>
    <p v-if="notStarted.length" class="st-muted" role="status" data-test="ad-batch-left">{{ notStarted.map(x => x.message).join(' ') }}</p>
    <button v-if="batch.waiting_job_ids?.length" type="button" class="st-button primary" :disabled="busy" data-test="ad-batch-start" @click="emit('start', batch)">Generate all ({{ batch.waiting_job_ids.length }})</button>
    <p v-if="batch.waiting_job_ids?.length" class="st-muted">Generate all is your go-ahead for each waiting estimate above. You can also decide each one on its own card in Results.</p>
  </section>
</template>
<script setup>
import { computed, useId } from 'vue'
import { priceAmount } from '../../utils/studioPrice'
// One ad batch (static image ads or the Ad Multiplier): each concept or variant with its steps, its price (the sum of
// its quoted steps) and its result. Paid steps wait for the person; free steps follow by themselves.
const props = defineProps({ batch: { type: Object, required: true }, busy: Boolean, notStarted: { type: Array, default: () => [] } })
const emit = defineEmits(['start'])
const headingId = `adb-${useId()}`
const STEP_NAMES = { cut: 'Cut the section', render: 'Make it', compose: 'Place the words and logo', splice: 'Splice it into the ad' }
const STATE_WORDS = { awaiting_authorization: 'Waiting for your Generate', queued: 'Queued', submitting: 'Sending', running: 'Being made', ingesting: 'Saving', ready: 'Ready', failed: 'Failed', cancelled: 'Declined' }
const shared = computed(() => props.batch.shared_steps || [])
const stepState = s => s.error ? 'failed' : s.job?.state || 'pending'
const stepWords = s => s.error ? s.error.message : s.job?.error?.message || STATE_WORDS[s.job?.state] || s.job?.phase || ''
const money = (est, most) => priceAmount({ status: Number(most) > Number(est) ? 'estimated' : 'exact', estimate: est, most })
const itemPrice = item => Number(item.max_usd) ? money(item.estimate_usd, item.max_usd) : 'No paid step yet'
const totalWords = computed(() => Number(props.batch.max_usd) ? `Batch: ${money(props.batch.estimate_usd, props.batch.max_usd)}` : 'Prices appear as each paid step is quoted')
</script>
<style scoped>
.adb-head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:6px 12px}.adb-head h2{font-size:15px}
.adb-total{font-size:14px;font-weight:600;color:var(--vm-ink)}
.adb-items,.adb-steps{display:grid;gap:10px;margin:0;padding:0;list-style:none}
.adb-item{display:grid;gap:8px;padding-top:10px;border-top:1px solid var(--vm-line)}
.adb-item-head{display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 10px;font-size:13px}
.adb-copy{display:grid;gap:2px;font-size:12px;color:var(--vm-ink-soft)}
.adb-steps{gap:4px}.adb-steps li{display:flex;flex-wrap:wrap;justify-content:space-between;gap:2px 10px;padding-left:10px;border-left:2px solid var(--vm-line);font-size:12px}
.adb-steps li.is-ready{border-left-color:var(--vm-violet)}.adb-steps li.is-awaiting_authorization{border-left-color:var(--vm-violet);background:var(--vm-violet-soft)}
.adb-steps li.is-failed{border-left-color:var(--vm-ink)}
.adb-result{display:grid;gap:6px;color:var(--vm-ink);font-size:13px}.adb-result img{max-height:200px;object-fit:contain;border-radius:6px;border:1px solid var(--vm-line)}
</style>
