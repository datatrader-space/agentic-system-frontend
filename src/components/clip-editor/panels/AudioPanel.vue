<template>
  <!-- The Audio tab (plan G29-G30, contract section 1): volume in dB and pan with keyframes, a three-band EQ (low shelf
       100 Hz, peak 1 kHz, high shelf 8 kHz), noise reduction, voice enhance, the sound's role, fades and lowering
       under speech. The loudness target is set for the whole video in Export. -->
  <div class="pn" data-test="panel-audio">
    <label v-if="onVideoTrack" class="pn-check"><input type="checkbox" :checked="!!item.muted" data-test="mute" @change="set({ muted: $event.target.checked || undefined }, $event.target.checked ? 'Clip muted' : 'Clip unmuted')" /> Mute this clip's own sound</label>
    <fieldset class="pn-group"><legend>Level</legend>
      <ParamRow :doc="doc" :item="item" path="volume_db" :spec="VOLUME" unit="dB" :t-rel="tRel" :compact="compact" @ops="$emit('ops', $event)" @seek="$emit('seek', $event)" />
      <ParamRow :doc="doc" :item="item" path="pan" :spec="PAN" :scale="100" unit="left to right" :t-rel="tRel" :compact="compact" @ops="$emit('ops', $event)" @seek="$emit('seek', $event)" />
      <p class="pn-note">Pan: −100 is fully left, 100 fully right.</p>
    </fieldset>
    <fieldset class="pn-group"><legend>Equaliser</legend>
      <ParamRow v-for="b in EQ" :key="b.path" :doc="doc" :item="item" :path="b.path" :spec="b.spec" unit="dB" @ops="$emit('ops', $event)" />
      <div v-if="item.eq" class="pn-icons"><IconButton :icon="RotateCcw" label="Reset the equaliser" data-test="eq-reset" @click="set({ eq: undefined }, 'Equaliser reset')" /></div>
    </fieldset>
    <fieldset class="pn-group"><legend>Clean up</legend>
      <ParamRow :doc="doc" :item="item" path="denoise" :spec="DENOISE" :scale="100" unit="%" @ops="$emit('ops', $event)" />
      <label class="pn-check"><input type="checkbox" :checked="!!item.voice_enhance" data-test="voice-enhance" @change="set({ voice_enhance: $event.target.checked || undefined }, $event.target.checked ? 'Voice enhanced' : 'Voice enhance off')" /> Enhance the voice</label>
    </fieldset>
    <label class="st-field">Role
      <select class="st-input" :value="item.role || defaultRole" data-test="role" @change="set({ role: $event.target.value === defaultRole ? undefined : $event.target.value }, 'Role changed')">
        <option v-for="r in br.ids(reg.roles)" :key="r" :value="r">{{ ROLE[r] || br.labelOf(reg.roles, r) }}{{ r === defaultRole ? ' (usual here)' : '' }}</option>
      </select>
    </label>
    <p class="pn-note">Roles decide what is lowered under speech, and an export can write each role as its own file (stems).</p>
    <fieldset class="pn-group"><legend>Fades</legend>
      <div class="pn-pair">
        <label class="st-field">Fade in (s)<input class="st-input" type="number" inputmode="decimal" min="0" max="60" step="0.1" :value="(item.fade_in_ms || 0) / 1000" data-test="fade-in" @change="fade('fade_in_ms', $event.target.value)" /></label>
        <label class="st-field">Fade out (s)<input class="st-input" type="number" inputmode="decimal" min="0" max="60" step="0.1" :value="(item.fade_out_ms || 0) / 1000" @change="fade('fade_out_ms', $event.target.value)" /></label>
      </div>
      <label v-if="!onVideoTrack" class="pn-check"><input type="checkbox" :checked="!!item.duck" data-test="duck" @change="set({ duck: $event.target.checked || undefined }, 'Lowering under speech changed')" /> Lower under speech</label>
    </fieldset>
    <p v-if="error" class="pn-error" role="alert">{{ error }}</p>
    <p class="pn-note">Loudness for the whole video (for example −14 LUFS for streaming) is set in Export.</p>
  </div>
</template>
<script setup>
import { RotateCcw } from 'lucide-vue-next'
import IconButton from './IconButton.vue'
import { computed, ref } from 'vue'
import * as tl from '../timelineModel'
import * as br from './bridge'
import ParamRow from './ParamRow.vue'

const props = defineProps({ doc: { type: Object, required: true }, item: { type: Object, required: true }, track: { type: Object, default: null },
  tRel: { type: Number, default: null }, compact: Boolean })
const emit = defineEmits(['ops', 'seek'])
const reg = br.registry(), L = br.editorLimits(reg)
const VOLUME = { min: L.volume_db[0], max: L.volume_db[1], default: 0, step: 0.5, label: 'Volume', animatable: true }
const PAN = { min: L.pan[0], max: L.pan[1], default: 0, step: 0.01, label: 'Pan', animatable: true }
const DENOISE = { min: 0, max: 1, default: 0, step: 0.01, label: 'Noise reduction', animatable: false }
const band = label => ({ min: L.eq_db[0], max: L.eq_db[1], default: 0, step: 0.5, label, animatable: false })
const EQ = [{ path: 'eq.low_db', spec: band('Low') }, { path: 'eq.mid_db', spec: band('Middle') }, { path: 'eq.high_db', spec: band('High') }]
const ROLE = { dialogue: 'Speech', music: 'Music', effects: 'Sound effects' }
const error = ref('')
const onVideoTrack = computed(() => props.track?.kind === 'video')
// Contract section 1: the sound of a video-track clip is dialogue; an audio-track clip takes its track's role.
const defaultRole = computed(() => onVideoTrack.value ? 'dialogue' : (props.track?.role || 'music'))
function set(changes, label) { error.value = ''; const ops = tl.setOps(props.doc, props.item.id, changes); if (ops.length) emit('ops', { ops, label }) }
function fade(key, raw) {
  const ms = Math.round(Number(raw) * 1000)
  if (!Number.isFinite(ms) || ms < 0 || ms > tl.clipLength(props.item, props.doc.rate)) { error.value = 'A fade lasts from 0 seconds to the length of the clip.'; return }
  set({ [key]: ms || undefined }, 'Fade changed')
}
</script>
