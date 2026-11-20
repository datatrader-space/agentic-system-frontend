<template>
  <!-- A value's keyframes (contract section 4): previous, add or remove at the playhead, next; and the easing of the
       keyframe at the playhead, including a custom curve (not on phones, plan section 6). Every action is a button
       or a typed value, so nothing needs a drag. -->
  <span class="kf" role="group" :aria-label="`Keyframes of ${label}`">
    <button v-if="keys.length" type="button" :disabled="prevT == null" :aria-label="`Previous keyframe of ${label}`" :title="`Previous keyframe of ${label}`" data-test="kf-prev" @click="$emit('seek', prevT)">
      <ChevronLeft :size="14" aria-hidden="true" />
    </button>
    <button type="button" class="kf-diamond" :class="{ 'is-on': !!at, 'is-animated': keys.length && !at }" :disabled="tRel == null"
            :aria-pressed="at ? 'true' : 'false'" :aria-label="at ? `Remove the keyframe of ${label} at the playhead` : `Add a keyframe of ${label} at the playhead`"
            :title="tRel == null ? 'Move the playhead inside this clip to set a keyframe' : (at ? `Remove the keyframe of ${label}` : `Add a keyframe of ${label}`)" data-test="kf-toggle" @click="$emit('toggle')">
      <Diamond :size="14" :stroke-width="1.8" aria-hidden="true" />
    </button>
    <button v-if="keys.length" type="button" :disabled="nextT == null" :aria-label="`Next keyframe of ${label}`" :title="`Next keyframe of ${label}`" data-test="kf-next" @click="$emit('seek', nextT)">
      <ChevronRight :size="14" aria-hidden="true" />
    </button>
  </span>
  <label v-if="at && keys.length > 1" class="kf-ease">Easing
    <select class="st-input" :value="at.ease || 'linear'" data-test="kf-ease" @change="ease($event.target.value)">
      <option v-for="e in easings" :key="e.id" :value="e.id" :disabled="compact && e.id === 'bezier'">{{ e.label }}</option>
    </select>
  </label>
  <div v-if="at && at.ease === 'bezier' && !compact" class="kf-bez" role="group" :aria-label="`Custom curve of the keyframe of ${label}`">
    <label v-for="(name, n) in BEZ_NAMES" :key="name" class="st-field"><span class="st-sr">{{ name }}</span>
      <input class="pn-num" type="number" :min="n % 2 ? -1 : 0" :max="n % 2 ? 2 : 1" step="0.01" :value="(at.bez || DEFAULT_BEZ)[n]" :aria-label="name" @change="bez(n, $event.target.value)" />
    </label>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { ChevronLeft, ChevronRight, Diamond } from 'lucide-vue-next'

// `easings`: the registry's [{id, label}] (contract section 4).
const props = defineProps({ keys: { type: Array, default: () => [] }, tRel: { type: Number, default: null }, label: { type: String, required: true },
  easings: { type: Array, required: true }, compact: Boolean })
const emit = defineEmits(['toggle', 'seek', 'ease'])
const BEZ_NAMES = ['First handle across', 'First handle up', 'Second handle across', 'Second handle up']
const DEFAULT_BEZ = [0.25, 0.1, 0.25, 1]
const at = computed(() => props.tRel == null ? null : props.keys.find(k => k.t_ms === props.tRel) || null)
const ref0 = computed(() => props.tRel ?? -1)
const prevT = computed(() => { const k = [...props.keys].reverse().find(x => x.t_ms < ref0.value); return k ? k.t_ms : null })
const nextT = computed(() => { const k = props.keys.find(x => x.t_ms > ref0.value); return k ? k.t_ms : null })
function ease(e) { emit('ease', { ease: e, bez: e === 'bezier' ? (at.value.bez || DEFAULT_BEZ) : undefined }) }
function bez(n, raw) {
  const v = Number(raw)
  if (!Number.isFinite(v)) return
  const next = [...(at.value.bez || DEFAULT_BEZ)]
  next[n] = n % 2 ? Math.min(Math.max(v, -1), 2) : Math.min(Math.max(v, 0), 1)
  emit('ease', { ease: 'bezier', bez: next })
}
</script>
