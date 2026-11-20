<template>
  <!-- The Colour tab (plan C14-C17): adjust, curves, HSL for six colours and a look (LUT) with its intensity, each an
       effect from the registry (contract section 3), added by the first change; and "Copy grade" to other clips.
       Phones keep Adjust only (plan section 6). -->
  <div class="pn" data-test="panel-colour">
    <fieldset v-if="adjust" class="pn-group"><legend>Adjust</legend>
      <ParamRow v-for="(spec, key) in specs('adjust')" :key="key" :doc="adjust.doc" :item="adjust.item" :path="`fx.${adjust.fx.id}.${key}`" :spec="spec"
                :t-rel="tRel" :compact="compact" @ops="wrap(adjust, $event)" @seek="$emit('seek', $event)" />
    </fieldset>

    <template v-if="!compact">
      <fieldset v-if="curves" class="pn-group"><legend>Curves</legend>
        <CurvesEditor :value="curves.fx.params" @change="(v, label) => send(curves, br.setEffectOps(curves.doc, item.id, curves.fx.id, { params: v }), label)" />
      </fieldset>

      <fieldset v-if="hsl" class="pn-group"><legend>HSL</legend>
        <div class="pn-seg" role="group" aria-label="Colour range">
          <button v-for="g in hslGroups" :key="g.id" type="button" :aria-pressed="hslColour === g.id ? 'true' : 'false'" :data-test="`hsl-${g.id}`" @click="hslColour = g.id">
            <span class="cp-swatch" :style="{ background: SWATCH[g.id] }" aria-hidden="true" />{{ g.label }}
          </button>
        </div>
        <ParamRow v-for="(spec, key) in hslParams" :key="key" :doc="hsl.doc" :item="hsl.item" :path="`fx.${hsl.fx.id}.${hslColour}.${key}`" :spec="spec"
                  :t-rel="tRel" :compact="compact" @ops="wrap(hsl, $event)" @seek="$emit('seek', $event)" />
      </fieldset>

      <fieldset class="pn-group"><legend>Look (LUT)</legend>
        <label v-if="looks.length || mine.length" class="st-field">Look
          <select class="st-input" :value="lutMedia" data-test="lut-look" @change="setLook($event.target.value)">
            <option value="">None</option>
            <optgroup v-if="looks.length" label="Platform looks"><option v-for="l in looks" :key="l.id" :value="l.id">{{ l.label }}</option></optgroup>
            <optgroup v-if="mine.length" label="Your look files"><option v-for="l in mine" :key="l.id" :value="l.id">{{ l.label }}</option></optgroup>
          </select>
        </label>
        <div class="pn-icons">
          <IconButton :icon="Upload" :label="uploading ? 'Uploading the look file' : 'Upload a .cube look file'" :disabled="uploading" data-test="lut-upload" @click="fileEl.click()" />
          <IconButton v-if="lutFx" :icon="Trash2" label="Remove the look" data-test="lut-remove" @click="send(null, br.removeEffectOps(doc, item.id, lutFx.id), 'Look removed')" />
          <span v-if="uploading" class="pn-note" role="status">Uploading…</span>
        </div>
        <input ref="fileEl" class="st-sr" type="file" accept=".cube" aria-label="Upload a .cube look file" @change="upload($event.target.files[0]); $event.target.value = ''" />
        <p v-if="lutFx && lutMedia" class="pn-note">Using {{ lookName }}.</p>
        <ParamRow v-if="lutFx" :doc="doc" :item="item" :path="`fx.${lutFx.id}.intensity`" :spec="specs('lut').intensity" :scale="100" unit="%"
                  :t-rel="tRel" :compact="compact" @ops="$emit('ops', $event)" @seek="$emit('seek', $event)" />
        <p v-if="lutError" class="pn-error" role="alert">{{ lutError }}</p>
      </fieldset>

      <fieldset class="pn-group" data-test="copy-grade"><legend>Copy colour and effects</legend>
        <p v-if="!others.length" class="pn-note">There are no other video clips to copy this clip's colour and effects to.</p>
        <template v-else>
          <label v-for="o in others" :key="o.id" class="pn-check"><input v-model="targets" type="checkbox" :value="o.id" /> {{ o.name }}</label>
          <div class="pn-icons"><IconButton :icon="Copy" :label="`Copy this clip's colour and effects to ${targets.length || 'the chosen'} clip${targets.length === 1 ? '' : 's'}`" :disabled="!targets.length || !hasGrade" data-test="grade-paste" @click="paste" /></div>
          <p v-if="!hasGrade" class="pn-note">This clip has no colour settings yet.</p>
          <p v-else class="pn-note">Each chosen clip gets this clip's whole list of colour settings and effects, with their keyframes, in place of its own.</p>
        </template>
      </fieldset>
      <div v-if="hasGrade" class="pn-icons"><IconButton :icon="RotateCcw" label="Reset all colour" data-test="colour-reset" @click="resetAll" /></div>
    </template>
  </div>
</template>
<script setup>
import { Copy, RotateCcw, Trash2, Upload } from 'lucide-vue-next'
import IconButton from './IconButton.vue'
import { computed, ref } from 'vue'
import * as tl from '../timelineModel'
import * as br from './bridge'
import ParamRow from './ParamRow.vue'
import CurvesEditor from './CurvesEditor.vue'
import { COLOUR_KINDS, withEffect } from './panelModel'
import { uploadFile, uploadStatus } from '../resumableUpload'

const props = defineProps({ doc: { type: Object, required: true }, item: { type: Object, required: true }, track: { type: Object, default: null }, projectId: { type: String, default: '' },
  tRel: { type: Number, default: null }, media: { type: Object, default: () => ({}) }, names: { type: Object, default: () => ({}) }, compact: Boolean })
const emit = defineEmits(['ops', 'seek'])
const SWATCH = { red: '#E5484D', yellow: '#F2C94C', green: '#46A758', cyan: '#3DD6D0', blue: '#3B82F6', magenta: '#D24ED6' }
const reg = br.registry()
const specs = kind => reg.effects[kind].params
const adjust = computed(() => withEffect(props.doc, props.item, 'adjust'))
const curves = computed(() => withEffect(props.doc, props.item, 'curves'))
const hsl = computed(() => withEffect(props.doc, props.item, 'hsl'))
// HSL's params are one group a colour (the registry's `group` specs: params.<colour>.{h, s, l}, animated as
// fx.<effect id>.<colour>.<h|s|l>).
// In the colour wheel's order (a registry read from a file may have its keys sorted).
const HUES = Object.keys(SWATCH)
const hslGroups = computed(() => Object.entries(specs('hsl')).filter(([, g]) => g.type === 'group').map(([id, g]) => ({ id, label: g.label || id }))
  .sort((a, b) => (HUES.indexOf(a.id) + 1 || 99) - (HUES.indexOf(b.id) + 1 || 99)))
const hslColour = ref('red')
const hslParams = computed(() => specs('hsl')[hslColour.value]?.params || {})
const lutFx = computed(() => (props.item.effects || []).find(e => e.kind === 'lut') || null)
const lutMedia = computed(() => lutFx.value?.params?.media || '')
// The platform's looks (the registry's `lut_looks`: [{id, label}]).
const looks = computed(() => reg.lut_looks || [])
// The person's own .cube files in this project (the editor media view says media_type 'lut'; never a clip).
const mine = computed(() => Object.entries(props.media).filter(([, m]) => m?.media_type === 'lut' && m.state === 'ready').map(([id, m]) => ({ id, label: m.name || 'Look file' })))
const lookName = computed(() => [...looks.value, ...mine.value].find(l => l.id === lutMedia.value)?.label || 'your look file')
const hasGrade = computed(() => (props.item.effects || []).some(e => COLOUR_KINDS.includes(e.kind)))
const others = computed(() => props.doc.tracks.filter(t => t.kind === 'video').flatMap(t => t.items).filter(i => i.type === 'clip' && i.id !== props.item.id)
  .map(i => ({ id: i.id, name: `${props.names[i.media] || 'Clip'} at ${tl.timecode(i.start_ms, props.doc.rate)}` })))
const targets = ref([])
const fileEl = ref(null), uploading = ref(false), lutError = ref('')

function send(view, ops, label) { if (ops.length) emit('ops', { ops: [...(view?.pre || []), ...ops], label }) }
function wrap(view, e) { send(view, e.ops, e.label) }
function setLook(id) {
  if (!id) { if (lutFx.value) send(null, br.removeEffectOps(props.doc, props.item.id, lutFx.value.id), 'Look removed'); return }
  if (lutFx.value) send(null, br.setEffectOps(props.doc, props.item.id, lutFx.value.id, { params: { media: id } }), 'Look changed')
  else send(null, br.addEffectOps(props.doc, props.item.id, 'lut', { params: { media: id }, registry: reg }), 'Look added')
}
// A .cube file is uploaded like any file (resumable), checked by the server, then used as this clip's look.
async function upload(file) {
  if (!file) return
  lutError.value = ''
  if (!/\.cube$/i.test(file.name)) { lutError.value = 'Choose a .cube look file.'; return }
  if (reg.limits.lut_bytes && file.size > reg.limits.lut_bytes) { lutError.value = `A look file can be at most ${Math.round(reg.limits.lut_bytes / 1048576)} MB.`; return }
  uploading.value = true
  try {
    const id = await uploadFile(file, { projectId: props.projectId })
    for (let i = 0; i < 200; i++) {
      const s = await uploadStatus(id)
      if (s.state === 'ready') { setLook(s.attachment_id); return }
      if (['failed', 'expired', 'cancelled'].includes(s.state)) { lutError.value = s.error || 'The look file could not be used.'; return }
      await new Promise(r => setTimeout(r, 1500))
    }
    lutError.value = 'The look file is taking too long to check. Try again.'
  } catch (e) {
    lutError.value = e?.response?.status === 413 ? `A look file can be at most ${Math.round((reg.limits.lut_bytes || 0) / 1048576)} MB.`
      : (e?.response?.data?.error?.message || 'The look file could not be uploaded.')
  }
  finally { uploading.value = false }
}
function paste() {
  // Paste attributes' "Colour and effects" group (timelineModel ATTRIBUTE_GROUPS.effects).
  const ops = br.pasteAttributesOps(props.doc, props.item.id, targets.value, ['effects'])
  if (ops.length) emit('ops', { ops, label: `Colour and effects copied to ${targets.value.length} clip${targets.value.length === 1 ? '' : 's'}` })
  targets.value = []
}
function resetAll() {
  let cur = props.doc
  const ops = []
  for (const e of (props.item.effects || []).filter(x => COLOUR_KINDS.includes(x.kind))) { const o = br.removeEffectOps(cur, props.item.id, e.id); ops.push(...o); cur = tl.applyOps(cur, o).doc }
  if (ops.length) emit('ops', { ops, label: 'Colour reset' })
}
</script>
<style scoped>
.cp-swatch{display:inline-block;width:10px;height:10px;margin-right:6px;border-radius:50%;vertical-align:-1px}
</style>
