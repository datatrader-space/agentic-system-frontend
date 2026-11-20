<template>
  <!-- The timeline (VIDEO_CLIP_EDITOR_PLAN.md 5 and 7, VIDEO_EDITOR_PRO_PLAN.md 3.A and P14): a tools bar, a ruler with
       markers that seeks on a tap, a playhead slider, and one row per track with its controls. Each track is one tab
       stop; the arrow keys move between its items. A clip's two trim handles are sliders, so every drag also has a
       keyboard way. With the editor passed in (`editor`), the timeline edits through it and its shortcuts work while
       the timeline has focus; without it, it only reports what was done (the first editor's events). -->
  <div ref="root" class="ct" :class="[`ct-tool-${tool}`, { 'ct-has-bar': !!ed }]" :style="{ '--ct-zoom': zoomV }" @keydown="rootKey">
    <div v-if="ed" ref="bar" class="ct-bar" role="toolbar" aria-label="Timeline tools" @keydown="barKey" @focusin="barFocus">
      <div class="ct-group" role="group" aria-label="Tool">
        <button v-for="t in TOOLS" :key="t.id" type="button" class="ct-tb ct-tip" :class="{ 'ct-phone-hide': t.id === 'slip' || t.id === 'slide' }"
                :aria-pressed="tool === t.id ? 'true' : 'false'" :aria-label="t.label" :aria-keyshortcuts="t.key" :data-tip="`${t.label} (${t.key})`" :data-test="`ct-tool-${t.id}`" @click="ed.setTool(t.id)">
          <component :is="TOOL_ICONS[t.id]" v-bind="IC" />
        </button>
        <span v-if="tool === 'trim'" class="ct-seg" role="group" aria-label="Trim edits">
          <button type="button" class="ct-tb ct-text ct-tip" data-tip="Ripple: what follows moves" :aria-pressed="ed.trimMode.value === 'ripple' ? 'true' : 'false'" @click="ed.setTrimMode('ripple')">Ripple</button>
          <button type="button" class="ct-tb ct-text ct-tip" data-tip="Roll: the edit point between two clips moves" :aria-pressed="ed.trimMode.value === 'roll' ? 'true' : 'false'" @click="ed.setTrimMode('roll')">Roll</button>
        </span>
      </div>
      <span class="ct-sep" aria-hidden="true" />
      <div class="ct-group" role="group" aria-label="Edit">
        <button type="button" class="ct-tb ct-tip" aria-label="Split at the playhead" aria-keyshortcuts="Control+B" data-tip="Split at the playhead (Ctrl+B)" data-test="ct-split" @click="ed.splitAtPlayhead()">
          <Scissors v-bind="IC" />
        </button>
        <button type="button" class="ct-tb ct-tip" aria-label="Add a marker" aria-keyshortcuts="M" data-tip="Add a marker at the playhead (M)" data-test="ct-add-marker" @click="ed.addMarker()">
          <Flag v-bind="IC" />
        </button>
        <button v-if="anyLinked" type="button" class="ct-tb ct-tip" aria-label="Detach from the main track" data-tip="Detach from the main track" data-test="ct-detach" @click="ed.detach()">
          <Unlink v-bind="IC" />
        </button>
        <button v-else type="button" class="ct-tb ct-tip" :disabled="!canConnect" aria-label="Connect to the main track" data-tip="Connect to the main track" data-test="ct-connect" @click="ed.connect()">
          <Link v-bind="IC" />
        </button>
        <button type="button" class="ct-tb ct-tip" :disabled="!canSplitAudio" aria-label="Split the sound from the video" data-tip="Split the sound from the video" data-test="ct-split-audio" @click="ed.splitAudio()">
          <AudioLines v-bind="IC" />
        </button>
        <button v-if="selectedCompound" type="button" class="ct-tb ct-tip ct-phone-hide" aria-label="Open the compound clip" aria-keyshortcuts="Enter" data-tip="Open the compound clip (Enter)" data-test="ct-open-compound" @click="openCompound(selectedCompound.id)">
          <SquareArrowOutUpRight v-bind="IC" />
        </button>
        <button v-if="selectedCompound" type="button" class="ct-tb ct-tip ct-phone-hide" aria-label="Break apart" aria-keyshortcuts="Control+Shift+G" data-tip="Break apart (Ctrl+Shift+G)" data-test="ct-flatten" @click="ed.flattenCompound(selectedCompound.id)">
          <Ungroup v-bind="IC" />
        </button>
        <button v-else type="button" class="ct-tb ct-tip ct-phone-hide" :disabled="!timedSel.length" aria-label="Nest into a compound clip" aria-keyshortcuts="Control+G" data-tip="Nest into a compound clip (Ctrl+G)" data-test="ct-compound" @click="ed.makeCompound()">
          <Layers v-bind="IC" />
        </button>
        <button type="button" class="ct-tb ct-tip" :disabled="!ed.clipboard.value || !timedSel.length" aria-label="Paste attributes" aria-keyshortcuts="Control+Shift+V" data-tip="Paste attributes (Ctrl+Shift+V)" data-test="ct-paste-attributes" @click="openPaste($event)">
          <ClipboardPaste v-bind="IC" />
        </button>
      </div>
      <span class="ct-sep" aria-hidden="true" />
      <div class="ct-group" role="group" aria-label="Playback and snapping">
        <button type="button" class="ct-tb ct-tip" :disabled="!timedSel.length" aria-label="Play the selection" aria-keyshortcuts="/" data-tip="Play the selection (/)" data-test="ct-play-selection" @click="ed.playSelection()">
          <SquarePlay v-bind="IC" />
        </button>
        <button type="button" class="ct-tb ct-tip" :aria-pressed="ed.magnet.value ? 'true' : 'false'" aria-label="Magnet" data-tip="Magnet: the main track closes up" data-test="ct-magnet" @click="ed.setMagnet(!ed.magnet.value)">
          <Magnet v-bind="IC" />
        </button>
        <button type="button" class="ct-tb ct-tip" :aria-pressed="snapOn ? 'true' : 'false'" aria-label="Snap to edges and markers" aria-keyshortcuts="N" data-tip="Snap to edges and markers (N)" data-test="ct-snap" @click="ed.snapping.value = !ed.snapping.value">
          <Crosshair v-bind="IC" />
        </button>
      </div>
    </div>

    <nav v-if="ed && ed.scope.value.length" class="ct-crumbs" aria-label="Compound clips">
      <button type="button" class="ct-tb ct-tip" aria-label="Back" aria-keyshortcuts="Escape" data-tip="Back (Escape)" data-test="ct-crumb-back" @click="ed.closeCompound()">
        <ArrowLeft v-bind="IC" />
      </button>
      <button type="button" class="ct-crumb" @click="closeAll">Main timeline</button>
      <template v-for="(cid, n) in ed.scope.value" :key="cid">
        <span aria-hidden="true">/</span>
        <button v-if="n < ed.scope.value.length - 1" type="button" class="ct-crumb" @click="closeTo(n)">{{ compoundTitle(cid) }}</button>
        <span v-else class="ct-crumb now" aria-current="location">{{ compoundTitle(cid) }}</span>
      </template>
    </nav>

    <section v-if="panelOpen" ref="panelEl" class="ct-panel" role="dialog" aria-modal="false" :aria-labelledby="`${uidBase}-panel`" @keydown="panelKey">
      <template v-if="panel?.kind === 'marker' && panelMarker">
        <h3 :id="`${uidBase}-panel`" class="ct-ptitle">Marker at {{ tc(panelMarker.at_ms) }}</h3>
        <label class="ct-pfield">Name<input class="ct-pinput" maxlength="80" :value="panelMarker.name" data-test="ct-marker-name" @change="ed.setMarker(panelMarker.id, { name: $event.target.value }, 'Marker renamed')" /></label>
        <fieldset class="ct-swatches"><legend>Colour</legend>
          <label v-for="c in tl.MARKER_COLORS" :key="c" class="ct-swatch" :style="{ '--mk': c }">
            <input type="radio" :name="`${uidBase}-mk`" :value="c" :checked="panelMarker.color === c" @change="ed.setMarker(panelMarker.id, { color: c }, 'Marker colour changed')" />
            <span class="st-sr">{{ COLOR_NAMES[c] }}</span>
          </label>
        </fieldset>
        <label class="ct-pcheck"><input type="checkbox" :checked="panelMarker.chapter" data-test="ct-marker-chapter" @change="ed.setMarker(panelMarker.id, { chapter: $event.target.checked }, $event.target.checked ? 'Marker is a chapter' : 'Marker is not a chapter')" /> Chapter (listed in the YouTube chapters)</label>
        <div class="ct-pactions">
          <button type="button" class="ct-tb ct-tip" aria-label="Move to the playhead" data-tip="Move to the playhead" data-test="ct-marker-here" @click="ed.setMarker(panelMarker.id, { at_ms: playheadV }, `Marker moved to ${tc(playheadV)}`)"><LocateFixed v-bind="IC" /></button>
          <button type="button" class="ct-tb ct-tip danger" aria-label="Delete marker" aria-keyshortcuts="Delete" data-tip="Delete marker (Delete)" data-test="ct-marker-delete" @click="removeMarker(panelMarker.id)"><Trash2 v-bind="IC" /></button>
          <button type="button" class="ct-tb ct-tip primary" aria-label="Done" aria-keyshortcuts="Escape" data-tip="Done (Escape)" data-test="ct-panel-done" @click="closePanel"><Check v-bind="IC" /></button>
        </div>
      </template>
      <template v-else-if="panel?.kind === 'track' && panelTrack">
        <h3 :id="`${uidBase}-panel`" class="ct-ptitle">{{ trackName(panelTrack) }}</h3>
        <label class="ct-pfield">Name<input class="ct-pinput" maxlength="40" :value="panelTrack.name || ''" :placeholder="trackName({ ...panelTrack, name: '' })" data-test="ct-track-rename" @change="ed.setTrackFlags(panelTrack.id, { name: $event.target.value })" /></label>
        <label class="ct-pfield">Height
          <input type="range" class="ct-prange" :min="tl.LIMITS.trackHeight[0]" :max="tl.LIMITS.trackHeight[1]" step="4" :value="rowHeight(panelTrack)" :aria-valuetext="`${rowHeight(panelTrack)} pixels`"
                 @change="ed.setTrackFlags(panelTrack.id, { height: Number($event.target.value) })" />
        </label>
        <label v-if="panelTrack.kind === 'audio'" class="ct-pfield">Role
          <select class="ct-pinput" :value="tl.trackRole(panelTrack)" @change="ed.setTrackFlags(panelTrack.id, { role: $event.target.value })">
            <option v-for="r in tl.ROLES" :key="r" :value="r">{{ ROLE_NAMES[r] }}</option>
          </select>
        </label>
        <div class="ct-pchecks">
          <label class="ct-pcheck"><input type="checkbox" :checked="tl.flag(panelTrack, 'lock')" @change="setFlag(panelTrack, 'lock', $event.target.checked)" /> Locked</label>
          <label v-if="panelTrack.kind !== 'text'" class="ct-pcheck"><input type="checkbox" :checked="tl.flag(panelTrack, 'mute')" @change="setFlag(panelTrack, 'mute', $event.target.checked)" /> Muted</label>
          <label class="ct-pcheck"><input type="checkbox" :checked="tl.flag(panelTrack, 'hide')" @change="setFlag(panelTrack, 'hide', $event.target.checked)" /> Hidden</label>
          <label v-if="panelTrack.kind !== 'text'" class="ct-pcheck"><input type="checkbox" :checked="tl.flag(panelTrack, 'solo')" @change="setFlag(panelTrack, 'solo', $event.target.checked)" /> Solo</label>
        </div>
        <div class="ct-pactions">
          <button v-if="panelTrack.kind === 'video' && !tl.isMain(panelTrack) && !ed.scopeId.value" type="button" class="ct-pbtn" @click="ed.setTrackFlags(panelTrack.id, { main: true })">Make this the main track</button>
          <button type="button" class="ct-tb ct-tip primary" aria-label="Done" aria-keyshortcuts="Escape" data-tip="Done (Escape)" data-test="ct-panel-done" @click="closePanel"><Check v-bind="IC" /></button>
        </div>
      </template>
      <template v-else-if="pasteOpen">
        <h3 :id="`${uidBase}-panel`" class="ct-ptitle">Paste attributes onto {{ timedSel.length }} item{{ timedSel.length === 1 ? '' : 's' }}</h3>
        <p v-if="!ed.attributeChoices.value.length" class="ct-pnote">The copied item has no attributes that can be pasted.</p>
        <fieldset v-else class="ct-pchecks"><legend class="st-sr">Attributes</legend>
          <label v-for="c in ed.attributeChoices.value" :key="c.id" class="ct-pcheck"><input v-model="pasteWhich" type="checkbox" :value="c.id" /> {{ c.label }}</label>
        </fieldset>
        <div class="ct-pactions">
          <button type="button" class="ct-tb ct-tip" aria-label="Cancel" aria-keyshortcuts="Escape" data-tip="Cancel (Escape)" data-test="ct-panel-cancel" @click="closePanel"><X v-bind="IC" /></button>
          <button type="button" class="ct-pbtn primary" :disabled="!pasteWhich.length" data-test="ct-paste-go" @click="doPaste">Paste</button>
        </div>
      </template>
    </section>

    <div ref="scroller" class="ct-scroll" @scroll="scrollLeft = $event.target.scrollLeft">
      <div ref="body" class="ct-body" :style="{ width: `${widthPx + HEAD}px` }">
        <div class="ct-ruler" :style="{ marginLeft: `${HEAD}px`, width: `${widthPx}px` }" @pointerdown="rulerSeek">
          <span v-for="tick in ticks" :key="tick" class="ct-tick" :style="{ left: `${px(tick)}px` }">{{ label(tick) }}</span>
          <button v-for="m in markers" :key="m.id" type="button" class="ct-marker" :class="{ chapter: m.chapter, on: panel?.id === m.id }" :style="{ left: `${px(m.at_ms)}px`, '--mk': m.color }"
                  :tabindex="markerStop(m) ? 0 : -1" :aria-label="markerLabel(m)" :data-marker="m.id" :disabled="!ed"
                  @pointerdown.stop="markerDown($event, m)" @click="openMarker(m, $event)" @keydown="markerKey($event, m)" @focus="focusedMarker = m.id">
            <svg viewBox="0 0 12 16" aria-hidden="true"><path v-if="m.chapter" d="M1 1h10l-3 4 3 4H1z" /><path v-else d="M1 1h10v8L6 13 1 9z" /></svg>
          </button>
        </div>
        <div class="ct-playhead" :style="{ left: `${HEAD + px(playheadV)}px` }" aria-hidden="true" />
        <svg v-if="links.length" class="ct-links" :width="widthPx + HEAD" :height="bodyHeight" aria-hidden="true">
          <g v-for="l in links" :key="l.id"><line :x1="l.x" :x2="l.x" :y1="l.y1" :y2="l.y2" /><circle :cx="l.x" :cy="l.y1" r="2.5" /></g>
        </svg>
        <div v-for="track in tracks" :key="track.id" class="ct-row" :data-track="track.id"
             :class="[`ct-${track.kind}`, { 'ct-off': tl.flag(track, 'hide') || tl.flag(track, 'mute'), 'ct-main': tl.isMain(track), 'ct-locked': tl.flag(track, 'lock'), 'ct-solo': tl.flag(track, 'solo') }]"
             :style="track.height ? { height: `${track.height}px`, minHeight: `${track.height}px` } : null">
          <div class="ct-head">
            <span class="ct-name" :title="trackName(track)" data-test="ct-track-name">{{ trackName(track) }}</span>
            <span v-if="tl.isMain(track)" class="ct-badge" title="The main track: with the magnet on, its clips close up">Main</span>
            <span v-if="track.kind === 'audio' && ed" class="ct-role">{{ ROLE_NAMES[tl.trackRole(track)] }}</span>
            <div class="ct-flags">
              <button v-if="ed" type="button" class="ct-icon ct-inline ct-tip ct-tip-right" :aria-pressed="tl.flag(track, 'lock') ? 'true' : 'false'" :aria-label="`${tl.flag(track, 'lock') ? 'Unlock' : 'Lock'} ${trackName(track)}`" :data-tip="tl.flag(track, 'lock') ? 'Unlock' : 'Lock'" @click="setFlag(track, 'lock', !tl.flag(track, 'lock'))">
                <component :is="tl.flag(track, 'lock') ? Lock : LockOpen" v-bind="IC_S" />
              </button>
              <button v-if="track.kind !== 'text'" type="button" class="ct-icon ct-inline ct-tip ct-tip-right" :aria-pressed="tl.flag(track, 'mute') ? 'true' : 'false'" :aria-label="`${tl.flag(track, 'mute') ? 'Unmute' : 'Mute'} ${trackName(track)}`" :data-tip="tl.flag(track, 'mute') ? 'Unmute' : 'Mute'" @click="setFlag(track, 'mute', !tl.flag(track, 'mute'))">
                <component :is="tl.flag(track, 'mute') ? VolumeX : Volume2" v-bind="IC_S" />
              </button>
              <button type="button" class="ct-icon ct-inline ct-tip ct-tip-right" :aria-pressed="tl.flag(track, 'hide') ? 'true' : 'false'" :aria-label="`${tl.flag(track, 'hide') ? 'Show' : 'Hide'} ${trackName(track)}`" :data-tip="tl.flag(track, 'hide') ? 'Show' : 'Hide'" @click="setFlag(track, 'hide', !tl.flag(track, 'hide'))">
                <component :is="tl.flag(track, 'hide') ? EyeOff : Eye" v-bind="IC_S" />
              </button>
              <button v-if="ed && track.kind !== 'text'" type="button" class="ct-icon ct-inline ct-tip ct-tip-right" :aria-pressed="tl.flag(track, 'solo') ? 'true' : 'false'" :aria-label="`${tl.flag(track, 'solo') ? 'Stop soloing' : 'Solo'} ${trackName(track)}`" :data-tip="tl.flag(track, 'solo') ? 'Stop soloing' : 'Solo'" @click="setFlag(track, 'solo', !tl.flag(track, 'solo'))">
                <Headphones v-bind="IC_S" />
              </button>
              <button v-if="ed" type="button" class="ct-icon ct-tip ct-tip-right" :aria-expanded="panel?.kind === 'track' && panel.id === track.id ? 'true' : 'false'" :aria-label="`Settings for ${trackName(track)}`" data-tip="Track settings" :data-test="`ct-track-settings-${track.id}`" @click="openTrack(track, $event)">
                <Settings2 v-bind="IC_S" />
              </button>
            </div>
          </div>
          <div class="ct-lane" role="listbox" :aria-label="trackName(track)" aria-multiselectable="true" :style="{ width: `${widthPx}px` }"
               :class="{ 'ct-drop': dropOn === track.id }"
               @pointerdown.self="laneDown($event, track)" @dragover="binOver($event, track)" @dragleave="binLeave($event, track)" @drop="binDrop($event, track)">
            <div v-for="item in timed(track)" :key="item.id" class="ct-item" role="option" :data-id="item.id"
                 :aria-selected="sel.includes(item.id) ? 'true' : 'false'" :aria-label="itemLabel(track, item)"
                 :tabindex="rovingStop(track, item) ? 0 : -1" :class="{ on: sel.includes(item.id), [`ct-${item.type}`]: true, compound: !!item.compound, linked: !!item.anchor }"
                 :style="itemStyle(track, item)"
                 @pointerdown="startDrag($event, track, item)" @dblclick="item.compound && openCompound(item.id)" @keydown="itemKey($event, track, item)" @focus="focused[track.id] = item.id">
              <span class="ct-strip" v-if="stripStyle(item)" :style="stripStyle(item)" aria-hidden="true" />
              <svg v-if="peaks(item)" class="ct-wave" :viewBox="`0 0 ${peaks(item).length} 100`" preserveAspectRatio="none" aria-hidden="true"><path :d="wavePath(peaks(item))" /></svg>
              <span v-if="item.anchor" class="ct-pin" aria-hidden="true" />
              <span class="ct-title"><Layers v-if="item.compound" class="ct-cicon" :size="12" :stroke-width="2" aria-hidden="true" />{{ itemTitle(item) }}</span>
              <span v-for="t in keyTimes(item)" :key="t" class="ct-key" :style="{ left: `${px(t)}px` }" aria-hidden="true" />
              <span class="ct-handle start" :class="{ limit: atLimit(item, 'start') }" role="slider" :tabindex="sel.includes(item.id) ? 0 : -1" :aria-label="`Start of ${itemTitle(item)}`" :aria-valuenow="item.start_ms"
                    :aria-valuetext="handleText(item, 'start')" aria-valuemin="0" :aria-valuemax="total" @pointerdown.stop="startTrim($event, item, 'start')" @keydown.stop="trimKey($event, item, 'start')" />
              <span class="ct-handle end" :class="{ limit: atLimit(item, 'end') }" role="slider" :tabindex="sel.includes(item.id) ? 0 : -1" :aria-label="`End of ${itemTitle(item)}`" :aria-valuenow="end(item)"
                    :aria-valuetext="handleText(item, 'end')" aria-valuemin="0" :aria-valuemax="total" @pointerdown.stop="startTrim($event, item, 'end')" @keydown.stop="trimKey($event, item, 'end')" />
            </div>
            <span v-for="tr in transitions(track)" :key="tr.id" class="ct-transition" :class="{ on: sel.includes(tr.id) }" :style="transitionStyle(track, tr)">
              <button type="button" :aria-label="`${tr.kind.replace(/_/g, ' ')} transition, ${tr.ms} ms`" @click="selectItem(tr.id)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5l8 7-8 7M12 5l8 7-8 7" /></svg></button>
            </span>
          </div>
        </div>
        <div v-if="marquee" class="ct-marquee" :style="marqueeStyle" aria-hidden="true" />
      </div>
    </div>
    <div class="ct-seek">
      <label class="st-sr" :for="sliderId">Playhead</label>
      <input :id="sliderId" class="ct-slider" type="range" min="0" :max="Math.max(total, 1)" :step="frame" :value="playheadV"
             role="slider" :aria-valuetext="tc(playheadV)" @input="seekTo(Number($event.target.value))" @keydown="playheadKey" />
    </div>
  </div>
</template>
<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, onUpdated, reactive, ref, useId, watch } from 'vue'
import * as tl from './timelineModel'
import { TOOLS } from './useClipEditor'
import { DRAG_TYPE } from './panels/panelModel'
import { ArrowLeft, ArrowLeftRight, AudioLines, Brackets, Check, ClipboardPaste, Crosshair, Eye, EyeOff, Flag, GalleryHorizontal, Headphones, Layers, Link,
  LocateFixed, Lock, LockOpen, Magnet, MousePointer2, Scissors, Settings2, Slice, SquareArrowOutUpRight, SquarePlay, Trash2, Ungroup, Unlink,
  Volume2, VolumeX, X } from 'lucide-vue-next'

const props = defineProps({
  doc: { type: Object, default: null }, selection: { type: Array, default: () => [] }, playhead: { type: Number, default: 0 },
  zoom: { type: Number, default: 60 }, snapping: { type: Boolean, default: true }, media: { type: Object, default: () => ({}) },
  names: { type: Object, default: () => ({}) },
  // The editor from useClipEditor(). With it the timeline edits directly (tools, shortcuts, markers, track controls,
  // compounds); without it, it emits the first editor's events.
  editor: { type: Object, default: null },
})
const emit = defineEmits(['select', 'seek', 'move', 'trim', 'track', 'key'])
// The track header's width, the same at every screen size (the ruler and the playhead are placed after it): a name on
// its own line above four controls and the settings button, each 24 px.
const HEAD = 144
// Icons (lucide). Every icon-only button has an aria-label and a tooltip (`data-tip`) with its name and shortcut,
// shown on hover and on keyboard focus.
const TOOL_ICONS = { select: MousePointer2, blade: Slice, trim: Brackets, slip: ArrowLeftRight, slide: GalleryHorizontal }
const IC = { size: 16, 'stroke-width': 1.8, 'aria-hidden': 'true' }
const IC_S = { size: 15, 'stroke-width': 1.8, 'aria-hidden': 'true' }
const COLOR_NAMES = { '#F2B341': 'Amber', '#E5484D': 'Red', '#46A758': 'Green', '#3E9BFF': 'Blue', '#A06BFF': 'Violet', '#E8E8E8': 'White' }
const ROLE_NAMES = { dialogue: 'Dialogue', music: 'Music', effects: 'Effects' }
const uidBase = `ct-${useId()}`
const root = ref(null), bar = ref(null), scroller = ref(null), body = ref(null), panelEl = ref(null)
const scrollLeft = ref(0), sliderId = `${uidBase}-seek`
const focused = reactive({})

// ── what is shown: the editor's (when given) or the props ─────────────────────────────────────────────────────────
const ed = props.editor
const D = computed(() => (ed ? ed.view.value : props.doc))
const tracks = computed(() => D.value?.tracks || [])
const sel = computed(() => (ed ? ed.selection.value : props.selection))
const playheadV = computed(() => (ed ? ed.playhead.value : props.playhead))
const zoomV = computed(() => (ed ? ed.zoom.value : props.zoom))
const snapOn = computed(() => (ed ? ed.snapping.value : props.snapping))
const mediaMap = computed(() => (ed ? ed.media : props.media))
const tool = computed(() => (ed ? ed.tool.value : 'select'))
const rate = computed(() => D.value?.rate || 30)
const frame = computed(() => tl.frameMs(rate.value))
const total = computed(() => tl.totalMs(D.value))
const markers = computed(() => (ed ? (ed.doc.value?.markers || []) : (props.doc?.markers || [])))
const durations = computed(() => Object.fromEntries(Object.entries(mediaMap.value || {}).filter(([, m]) => m?.duration_ms != null).map(([id, m]) => [id, m.duration_ms])))
// A little room after the end, so a clip can be dragged past it.
const widthPx = computed(() => Math.max(px(total.value + 10000), 600))
const px = ms => (ms / 1000) * zoomV.value
const msAt = x => (x / zoomV.value) * 1000
const tc = ms => tl.timecode(ms, rate.value)
const end = item => tl.itemEnd(item, rate.value)
const timed = track => tl.ordered(track)
const transitions = track => track.items.filter(i => i.type === 'transition')
const ticks = computed(() => {
  const step = zoomV.value >= 120 ? 1000 : zoomV.value >= 40 ? 2000 : zoomV.value >= 15 ? 5000 : 15000
  const out = []
  for (let t = 0; t <= total.value + 10000; t += step) out.push(t)
  return out
})
const label = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`
const trackName = track => tl.trackName(D.value, track)
const compoundTitle = cid => tl.compoundName(ed.doc.value, cid)
function itemTitle(item) {
  if (item.type === 'text') return item.text
  if (item.compound) return tl.compoundName(D.value, item.compound)
  return props.names[item.media] || mediaMap.value?.[item.media]?.name || 'Clip'
}
function itemLabel(track, item) {
  const extra = []
  if (item.compound) extra.push('compound clip, Enter opens it')
  if (item.anchor) { const p = tl.find(D.value, item.anchor.clip)?.item; extra.push(`connected to ${p ? itemTitle(p) : 'the main track'}`) }
  const keys = tl.keyframeTimes(item).length
  if (keys) extra.push(`${keys} keyframe${keys === 1 ? '' : 's'}`)
  if (tl.flag(track, 'lock')) extra.push('locked')
  return `${itemTitle(item)}, ${tc(item.start_ms)} to ${tc(end(item))}${extra.map(x => `, ${x}`).join('')}${sel.value.includes(item.id) ? ', selected' : ''}`
}
function itemStyle(track, item) { return { left: `${px(item.start_ms)}px`, width: `${Math.max(px(end(item) - item.start_ms), 6)}px` } }
function transitionStyle(track, tr) {
  const b = track.items.find(i => i.id === tr.between[1])
  return b ? { left: `${px(b.start_ms)}px`, width: `${Math.max(px(tr.ms), 18)}px` } : { display: 'none' }
}
const keyTimes = item => tl.keyframeTimes(item)
// The red edit point: an edge at the end of its file (or the edge the last trim ran out at).
function atLimit(item, edge) {
  if (item.type !== 'clip' || item.hold_ms != null) return false
  if (ed?.edgeLimit.value?.id === item.id && ed.edgeLimit.value.edge === edge) return true
  return sel.value.includes(item.id) && tl.atMediaEnd(D.value, item.id, edge, { durations: durations.value })
}
const handleText = (item, edge) => `${tc(edge === 'start' ? item.start_ms : end(item))}${atLimit(item, edge) ? ', the end of the file' : ''}`
// The frame strip: each tile is one second of the source, shown from the clip's in point at the timeline's zoom.
function stripStyle(item) {
  const m = mediaMap.value?.[item.media]
  const s = m?.strip
  if (!s || item.hold_ms != null || !s.urls?.length) return null
  const tileW = s.tile_width, tileH = s.tile_height, per = s.cols * s.rows
  const sec = Math.floor((item.source_in_ms || 0) / 1000), sheet = Math.min(Math.floor(sec / per), s.urls.length - 1), idx = sec % per
  return { backgroundImage: `url(${s.urls[sheet]})`, backgroundPosition: `-${(idx % s.cols) * tileW}px -${Math.floor(idx / s.cols) * tileH}px`,
    backgroundSize: `${s.cols * tileW}px ${s.rows * tileH}px` }
}
const peakCache = reactive({})
function peaks(item) {
  const m = mediaMap.value?.[item.media]
  if (!m?.peaks_url || item.type === 'text') return null
  if (!(m.peaks_url in peakCache)) {
    peakCache[m.peaks_url] = null
    fetch(m.peaks_url, { credentials: 'include' }).then(r => r.ok ? r.json() : null).then(d => { peakCache[m.peaks_url] = d }).catch(() => {})
  }
  const d = peakCache[m.peaks_url]
  if (!d?.peaks?.length) return null
  const per = d.per_second, a = Math.floor((item.source_in_ms || 0) / 1000 * per)
  const b = item.hold_ms != null ? a : Math.ceil((item.source_out_ms || 0) / 1000 * per)
  const slice = d.peaks.slice(a, b)
  // At most one point a pixel: a long sound draws its loudest point in each pixel.
  const width = Math.max(1, Math.round(px(end(item) - item.start_ms)))
  if (slice.length <= width) return slice
  const step = slice.length / width
  return Array.from({ length: width }, (_, i) => Math.max(...slice.slice(Math.floor(i * step), Math.floor((i + 1) * step)) || [0]))
}
function wavePath(list) { return list.map((v, i) => `M${i} ${50 - v * 50 / 255}V${50 + v * 50 / 255}`).join('') }
const rowHeight = track => track.height || ({ video: 52, text: 40, audio: 40 })[track.kind]

// ── what the toolbar offers for the selection ─────────────────────────────────────────────────────────────────────
const timedSel = computed(() => sel.value.map(id => D.value && tl.find(D.value, id)).filter(r => r && tl.isTimed(r.item)))
const anyLinked = computed(() => timedSel.value.some(r => r.item.anchor))
const canConnect = computed(() => timedSel.value.some(r => !tl.isMain(r.track)) && !!D.value?.tracks.some(tl.isMain))
const canSplitAudio = computed(() => { const r = timedSel.value[0]; return !!r && r.track.kind === 'video' && r.item.type === 'clip' && r.item.hold_ms == null && !r.item.compound && !r.item.muted })
const selectedCompound = computed(() => timedSel.value.find(r => r.item.compound)?.item || null)

// ── doing: through the editor, or as the first editor's events ────────────────────────────────────────────────────
function selectItem(id, add = false) { if (ed) ed.select(id, { add }); else emit('select', { id, add }) }
function seekTo(ms) { if (ed) ed.seek(ms); else emit('seek', ms) }
function moveTo(payload) {
  if (!ed) { emit('move', payload); return }
  if (ed.moveItem(payload)) requestAnimationFrame(() => focusItem(payload.id))
}
function trimTo(payload) { if (ed) ed.trimItem(payload); else emit('trim', payload) }
function setFlag(track, name, value) { if (ed) ed.setTrackFlags(track.id, { [name]: value }); else emit('track', { id: track.id, changes: { [name]: value } }) }
function openCompound(id) { if (ed?.openCompound(id)) nextTick(() => scroller.value?.querySelector('.ct-item')?.focus()) }
function closeAll() { while (ed.scope.value.length) ed.closeCompound() }
function closeTo(n) { while (ed.scope.value.length > n + 1) ed.closeCompound() }

// ── panels: a marker, a track's settings, paste attributes ───────────────────────────────────────────────────────
const panel = ref(null)               // { kind: 'marker' | 'track', id }
let opener = null
const pasteOpen = computed(() => !!ed?.pasteAttributesOpen.value)
const panelOpen = computed(() => !!ed && (!!panel.value || pasteOpen.value))
const panelMarker = computed(() => (panel.value?.kind === 'marker' ? markers.value.find(m => m.id === panel.value.id) : null))
const panelTrack = computed(() => (panel.value?.kind === 'track' ? tracks.value.find(t => t.id === panel.value.id) : null))
const pasteWhich = ref([])
function showPanel(next, e) {
  opener = e?.currentTarget || document.activeElement
  panel.value = next
  nextTick(() => panelEl.value?.querySelector('input,select,button')?.focus())
}
function closePanel() {
  panel.value = null
  if (ed) ed.pasteAttributesOpen.value = false
  const back = opener
  opener = null
  nextTick(() => (back?.isConnected ? back : root.value?.querySelector('.ct-slider'))?.focus())
}
function openMarker(m, e) { if (ed) showPanel({ kind: 'marker', id: m.id }, e) }
function openTrack(track, e) { if (panel.value?.kind === 'track' && panel.value.id === track.id) closePanel(); else showPanel({ kind: 'track', id: track.id }, e) }
function openPaste(e) { opener = e?.currentTarget || null; ed.openPasteAttributes() }
// Opened from the button or from Ctrl+Shift+V: every attribute that applies is ticked, and focus moves into the panel.
if (ed) watch(() => ed.pasteAttributesOpen.value, open => {
  if (!open) return
  panel.value = null
  opener = opener || document.activeElement
  pasteWhich.value = ed.attributeChoices.value.map(c => c.id)
  nextTick(() => panelEl.value?.querySelector('input,button')?.focus())
})
function doPaste() { const which = [...pasteWhich.value]; closePanel(); ed.pasteAttributes(which) }
function removeMarker(id) { closePanel(); ed.removeMarker(id) }
function panelKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePanel() }
  else e.stopPropagation()                // typing in the panel never triggers a timeline shortcut
}

// ── keyboard (WCAG 2.1.1): one tab stop per track, arrows move between its items ─────────────────────────────────
function rovingStop(track, item) {
  const list = timed(track)
  const cur = focused[track.id] && list.some(i => i.id === focused[track.id]) ? focused[track.id] : list.find(i => sel.value.includes(i.id))?.id || list[0]?.id
  return cur === item.id
}
function focusItem(id) { scroller.value?.querySelector(`[data-id="${id}"]`)?.focus() }
function itemKey(e, track, item) {
  const list = timed(track), n = list.findIndex(i => i.id === item.id)
  if (e.key === 'ArrowRight' && !e.altKey && !e.ctrlKey && !e.metaKey && list[n + 1]) { e.preventDefault(); focusItem(list[n + 1].id) }
  else if (e.key === 'ArrowLeft' && !e.altKey && !e.ctrlKey && !e.metaKey && list[n - 1]) { e.preventDefault(); focusItem(list[n - 1].id) }
  else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !e.altKey) {
    e.preventDefault()
    const rows = tracks.value, ti = rows.indexOf(track), next = rows[ti + (e.key === 'ArrowDown' ? 1 : -1)]
    const target = next && timed(next)[0]
    if (target) focusItem(target.id)
  } else if (e.key === 'Enter' && ed && item.compound && !e.shiftKey) { e.preventDefault(); openCompound(item.id) }
  else if (e.key === 'Enter' && ed && tool.value === 'blade') { e.preventDefault(); ed.select(item.id); ed.splitAtPlayhead() }
  else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectItem(item.id, e.shiftKey || e.ctrlKey || e.metaKey) }
  else if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    // Alt+arrow moves the item a frame (Shift: a second): moving without dragging (WCAG 2.5.7). With the Slip or Slide
    // tool it slips or slides instead.
    e.preventDefault()
    const step = e.shiftKey ? 1000 : frame.value, by = e.key === 'ArrowLeft' ? -step : step
    if (ed) { if (ed.nudge(item.id, by)) requestAnimationFrame(() => focusItem(item.id)) } else emit('move', { id: item.id, start: tl.toFrame(item.start_ms + by, rate.value) })
  } else if (!ed) emit('key', e)
}
// A trim handle as a slider: arrows a frame, Page Up/Down a second, Home/End the far ends.
function trimKey(e, item, edge) {
  const cur = edge === 'start' ? item.start_ms : end(item)
  const steps = { ArrowLeft: -frame.value, ArrowDown: -frame.value, ArrowRight: frame.value, ArrowUp: frame.value, PageDown: -1000, PageUp: 1000 }
  let at = null
  if (e.key in steps) at = cur + steps[e.key]
  else if (e.key === 'Home') at = edge === 'start' ? 0 : item.start_ms
  else if (e.key === 'End') at = edge === 'start' ? end(item) : total.value + 60000
  if (at == null) return
  e.preventDefault()
  trimTo({ id: item.id, edge, at: tl.toFrame(at, rate.value) })
}
function playheadKey(e) {
  const steps = { ArrowLeft: -frame.value, ArrowDown: -frame.value, ArrowRight: frame.value, ArrowUp: frame.value, PageDown: -1000, PageUp: 1000 }
  if (e.key in steps) { e.preventDefault(); seekTo(tl.toFrame(playheadV.value + steps[e.key], rate.value)) }
  else if (e.key === 'Home') { e.preventDefault(); seekTo(0) }
  else if (e.key === 'End') { e.preventDefault(); seekTo(total.value) }
}
// The timeline's shortcuts (P14): only while it has focus, so the editor's other panels keep their keys.
function rootKey(e) { if (ed && ed.handleKey(e)) e.stopPropagation() }
// The tools bar is one tab stop; the arrows move along it (WAI-ARIA toolbar).
function barButtons() { return [...(bar.value?.querySelectorAll('button:not(:disabled)') || [])] }
let barCurrent = null
function barFocus(e) { if (e.target.tagName !== 'BUTTON') return; barCurrent = e.target.title; for (const b of barButtons()) b.tabIndex = b === e.target ? 0 : -1 }
function barKey(e) {
  const list = barButtons(), n = list.indexOf(e.target)
  if (n < 0) return
  const to = { ArrowRight: n + 1, ArrowLeft: n - 1, Home: 0, End: list.length - 1 }[e.key]
  if (to == null) return
  e.preventDefault(); e.stopPropagation()
  list[(to + list.length) % list.length].focus()
}
function rovingBar() {
  const list = barButtons()
  const cur = Math.max(0, list.findIndex(b => b.title === barCurrent))
  list.forEach((b, i) => { b.tabIndex = i === cur ? 0 : -1 })
}
// Markers: one tab stop in the ruler; arrows move between markers, Alt+arrows move one a frame (Shift a second),
// Enter edits it, Delete removes it.
const focusedMarker = ref(null)
function markerStop(m) { const cur = markers.value.some(x => x.id === focusedMarker.value) ? focusedMarker.value : markers.value[0]?.id; return cur === m.id }
const markerLabel = m => `${m.chapter ? 'Chapter' : 'Marker'} ${m.name ? `${m.name}, ` : ''}at ${tc(m.at_ms)}`
function focusMarker(id) { nextTick(() => body.value?.querySelector(`[data-marker="${id}"]`)?.focus()) }
function markerKey(e, m) {
  if (!ed) return
  const list = markers.value, n = list.findIndex(x => x.id === m.id)
  if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && e.altKey) {
    e.preventDefault(); e.stopPropagation()
    const step = e.shiftKey ? 1000 : frame.value
    ed.setMarker(m.id, { at_ms: m.at_ms + (e.key === 'ArrowLeft' ? -step : step) }, 'Marker moved')
    focusMarker(m.id)
  } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault(); e.stopPropagation()
    const next = list[n + (e.key === 'ArrowRight' ? 1 : -1)]
    if (next) { focusedMarker.value = next.id; focusMarker(next.id); ed.seek(next.at_ms) }
  } else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); ed.removeMarker(m.id) }
}
let markerDragging = null
function markerDown(e, m) {
  if (!ed || e.button !== 0) return
  markerDragging = { id: m.id, x0: e.clientX, at0: m.at_ms, moved: false }
  const el = e.currentTarget
  el.setPointerCapture?.(e.pointerId)
  const move = ev => {
    if (!markerDragging) return
    if (Math.abs(ev.clientX - markerDragging.x0) > 4) markerDragging.moved = true
    if (markerDragging.moved) el.style.transform = `translateX(calc(-50% + ${ev.clientX - markerDragging.x0}px))`
  }
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', ev => {
    el.removeEventListener('pointermove', move)
    el.style.transform = ''
    const d = markerDragging
    markerDragging = null
    if (d?.moved) { ed.setMarker(d.id, { at_ms: snapped(d.at0 + msAt(ev.clientX - d.x0), []) }, 'Marker moved'); ev.preventDefault() }
  }, { once: true })
}

// ── pointer: tap to seek, drag to move, drag a handle to trim; the tools; marquee; snapping ─────────────────────
// A drop from the bin (ClipMediaBin puts JSON {kind, id} under DRAG_TYPE): the editor places it at the drop time on
// this track, or on the clip under the pointer (effects, transitions). Every drop also has a button in the bin.
const dropOn = ref('')
const fromBin = e => !!ed && [...(e.dataTransfer?.types || [])].includes(DRAG_TYPE)
function binOver(e, track) { if (!fromBin(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; dropOn.value = track.id }
function binLeave(e, track) { if (dropOn.value === track.id && !e.currentTarget.contains(e.relatedTarget)) dropOn.value = '' }
function binDrop(e, track) {
  dropOn.value = ''
  if (!fromBin(e)) return
  e.preventDefault()
  let payload = null
  try { payload = JSON.parse(e.dataTransfer.getData(DRAG_TYPE)) } catch { return }
  const itemId = e.target?.closest?.('.ct-item')?.dataset.id || null
  ed.dropFromBin(payload, { trackId: track.id, at: tl.toFrame(msAt(laneX(e)), rate.value), itemId })
}
function laneX(e) {
  const lane = e.currentTarget.closest('.ct-row')?.querySelector('.ct-lane') || e.currentTarget
  return e.clientX - lane.getBoundingClientRect().left
}
function rulerSeek(e) { seekTo(tl.toFrame(msAt(e.clientX - e.currentTarget.getBoundingClientRect().left), rate.value)) }
function laneTap(e) { selectItem(null); seekTo(tl.toFrame(msAt(laneX(e)), rate.value)) }
function snapped(ms, exclude) {
  const at = tl.toFrame(ms, rate.value)
  if (!snapOn.value) return at
  return tl.snapToPoints(at, tl.snapPoints(D.value, { playhead: playheadV.value, exclude }), msAt(8))
}
function trackUnder(e, kind) {
  const row = document.elementsFromPoint?.(e.clientX, e.clientY)?.find(el => el.classList?.contains('ct-row'))
  if (!row) return null
  const track = tracks.value.find(t => t.id === row.dataset.track)
  return track && track.kind === kind ? track.id : null
}
let drag = null
function startDrag(e, track, item) {
  if (e.button !== 0) return
  const add = e.shiftKey || e.ctrlKey || e.metaKey
  if (ed && tool.value === 'blade') {
    // The Blade cuts where it is clicked.
    const lane = e.currentTarget.closest('.ct-lane')
    const at = snapped(msAt(e.clientX - lane.getBoundingClientRect().left), [item.id])
    ed.splitAt(item.id, at)
    return
  }
  selectItem(item.id, add)
  drag = { id: item.id, kind: track.kind, from: track.id, x0: e.clientX, start0: item.start_ms, len: end(item) - item.start_ms, moved: false, mode: ed && (tool.value === 'slip' || tool.value === 'slide') ? tool.value : 'move' }
  e.currentTarget.setPointerCapture?.(e.pointerId)
  e.currentTarget.addEventListener('pointermove', onDrag)
  e.currentTarget.addEventListener('pointerup', endDrag, { once: true })
}
function onDrag(e) {
  if (!drag) return
  const dx = e.clientX - drag.x0
  if (!drag.moved && Math.abs(dx) < 4) return
  drag.moved = true
  if (drag.mode === 'slip') { drag.delta = tl.toFrame(Math.abs(msAt(dx)), rate.value) * Math.sign(dx); return }
  let start = drag.start0 + msAt(dx)
  // Snap whichever edge lands nearer a snap point.
  const a = snapped(start, [drag.id]), b = snapped(start + drag.len, [drag.id]) - drag.len
  start = Math.abs(a - start) <= Math.abs(b - start) ? a : b
  e.currentTarget.style.transform = `translateX(${px(Math.max(0, start)) - px(drag.start0)}px)`
  drag.start = Math.max(0, start)
}
function endDrag(e) {
  e.currentTarget.removeEventListener('pointermove', onDrag)
  e.currentTarget.style.transform = ''
  const d = drag
  drag = null
  if (!d?.moved) return
  if (d.mode === 'slip') { if (d.delta) ed.slip(d.id, -d.delta); return }        // the picture follows the pointer
  if (d.mode === 'slide') { ed.slide(d.id, (d.start ?? d.start0) - d.start0); return }
  const to = trackUnder(e, d.kind)
  moveTo({ id: d.id, start: d.start ?? d.start0, track: to && to !== d.from ? to : null })
}
let trim = null
function startTrim(e, item, edge) {
  if (e.button !== 0) return
  selectItem(item.id)
  trim = { id: item.id, edge, x0: e.clientX, at0: edge === 'start' ? item.start_ms : end(item) }
  const el = e.currentTarget
  el.setPointerCapture?.(e.pointerId)
  const move = ev => { if (trim) trim.at = snapped(trim.at0 + msAt(ev.clientX - trim.x0), [item.id]) }
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', () => {
    el.removeEventListener('pointermove', move)
    if (trim?.at != null && trim.at !== trim.at0) trimTo({ id: trim.id, edge: trim.edge, at: trim.at })
    trim = null
  }, { once: true })
}
// Marquee (the Select tool, from an empty part of a lane): the items the box touches are selected; Shift adds.
const marquee = ref(null)
const marqueeStyle = computed(() => {
  const m = marquee.value
  if (!m) return null
  return { left: `${Math.min(m.x0, m.x1)}px`, top: `${Math.min(m.y0, m.y1)}px`, width: `${Math.abs(m.x1 - m.x0)}px`, height: `${Math.abs(m.y1 - m.y0)}px` }
})
function laneDown(e) {
  if (e.button !== 0) return
  if (!ed || tool.value !== 'select') { laneTap(e); return }
  const box = body.value.getBoundingClientRect()
  const pos = ev => ({ x: ev.clientX - box.left, y: ev.clientY - box.top })
  const p = pos(e), lane = e.currentTarget
  let m = { x0: p.x, y0: p.y, x1: p.x, y1: p.y, moved: false, add: e.shiftKey }
  lane.setPointerCapture?.(e.pointerId)
  const move = ev => {
    const q = pos(ev)
    m = { ...m, x1: q.x, y1: q.y, moved: m.moved || Math.hypot(q.x - m.x0, q.y - m.y0) > 4 }
    if (m.moved) marquee.value = m
  }
  lane.addEventListener('pointermove', move)
  lane.addEventListener('pointerup', () => {
    lane.removeEventListener('pointermove', move)
    marquee.value = null
    if (!m.moved) { laneTap(e); return }
    const top = Math.min(m.y0, m.y1), bottom = Math.max(m.y0, m.y1)
    const rows = [...body.value.querySelectorAll('.ct-row')]
    const trackIds = rows.filter(r => r.offsetTop < bottom && r.offsetTop + r.offsetHeight > top).map(r => r.dataset.track)
    ed.selectRange({ trackIds, from: msAt(Math.min(m.x0, m.x1) - HEAD), to: msAt(Math.max(m.x0, m.x1) - HEAD) }, { add: m.add })
  }, { once: true })
}

// ── connected-clip links, drawn from the parent's row to the child's at the child's start ───────────────────────────
const rowBox = ref({})
const bodyHeight = ref(0)
function measure() {
  if (!body.value) return
  const next = {}
  for (const r of body.value.querySelectorAll('.ct-row')) next[r.dataset.track] = { top: r.offsetTop, bottom: r.offsetTop + r.offsetHeight }
  if (JSON.stringify(next) !== JSON.stringify(rowBox.value)) rowBox.value = next
  if (body.value.offsetHeight !== bodyHeight.value) bodyHeight.value = body.value.offsetHeight
}
const links = computed(() => {
  const main = tracks.value.find(tl.isMain), out = []
  if (!main) return out
  const mb = rowBox.value[main.id]
  for (const t of tracks.value) {
    if (t === main) continue
    const cb = rowBox.value[t.id]
    for (const i of t.items) {
      if (!i.anchor || !tl.isTimed(i) || !mb || !cb) continue
      const x = HEAD + px(i.start_ms) + 1
      const above = cb.top < mb.top
      out.push({ id: i.id, x, y1: above ? mb.top + 4 : mb.bottom - 4, y2: above ? cb.bottom - 5 : cb.top + 5 })
    }
  }
  return out
})
onMounted(() => { measure(); rovingBar(); window.addEventListener('resize', measure) })
onUpdated(() => { measure(); rovingBar() })
onBeforeUnmount(() => window.removeEventListener('resize', measure))
defineExpose({ focusItem })
</script>
<style scoped>
.ct{display:grid;gap:6px;min-width:0}
/* Tools bar: quiet chrome; the pressed tool carries the accent. */
.ct-bar{display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px;padding:4px;border:1px solid var(--vm-line-2);border-radius:8px;background:var(--vm-surface)}
.ct-group{display:flex;flex-wrap:wrap;align-items:center;gap:2px}
.ct-seg{display:inline-flex;margin-left:4px;padding:2px;border-radius:6px;background:var(--vm-bg)}
.ct-sep{width:1px;height:20px;background:var(--vm-line)}
.ct-tb{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:28px;min-width:28px;padding:0;border:1px solid transparent;border-radius:6px;background:none;color:var(--vm-ink-soft);font-size:12px;line-height:1;cursor:pointer;transition:background-color .15s,color .15s,border-color .15s}
.ct-tb:hover:not(:disabled){background:var(--vm-surface-2);color:var(--vm-ink)}
.ct-tb[aria-pressed="true"]{border-color:var(--vs-accent-ink);color:var(--vs-accent-ink);background:var(--vm-bg)}
.ct-tb:disabled{opacity:.42;cursor:default}
.ct-tb.ct-text{padding:3px 8px}
.ct-tb.danger{color:var(--vs-bad-ink)}.ct-tb.primary{border-color:var(--vm-primary);background:var(--vm-primary-soft);color:var(--vm-ink)}
/* Tooltips: the button's name and shortcut, on hover (a pointer that can hover) and on keyboard focus. */
.ct-tip{position:relative}
.ct-tip[data-tip]:focus-visible::after{content:attr(data-tip)}
@media (hover:hover){.ct-tip[data-tip]:hover::after{content:attr(data-tip)}}
.ct-tip[data-tip]::after{position:absolute;left:50%;top:calc(100% + 6px);transform:translateX(-50%);z-index:20;padding:4px 7px;border-radius:5px;background:var(--vm-ink);color:var(--vm-bg);font-size:11px;font-weight:500;line-height:1.3;white-space:nowrap;pointer-events:none;box-shadow:var(--vm-shadow-s)}
.ct-tip-right[data-tip]::after{left:calc(100% + 6px);top:50%;transform:translateY(-50%)}
.ct-tb:focus-visible,.ct-icon:focus-visible,.ct-crumb:focus-visible,.ct-pbtn:focus-visible,.ct-marker:focus-visible{outline:2px solid var(--vs-accent-ink);outline-offset:1px}
.ct-tb svg{width:16px;height:16px;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.ct-crumbs{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:4px 8px;border:1px solid var(--vs-accent-ink);border-radius:8px;font-size:12px;color:var(--vm-ink-faint)}
.ct-crumb{min-height:24px;padding:2px 6px;border:0;border-radius:4px;background:none;color:var(--vm-ink-soft);font-size:12px;cursor:pointer}
.ct-crumb:hover{background:var(--vm-surface-2)}.ct-crumb.now{color:var(--vs-accent-ink);font-weight:600;cursor:default}
/* Panels open in place above the tracks (no floating layer to lose focus in). */
.ct-panel{display:grid;gap:10px;padding:12px;border:1px solid var(--vm-line);border-radius:8px;background:var(--vm-surface);color:var(--vm-ink);max-width:520px}
.ct-ptitle{margin:0;font-size:13px;font-weight:600}
.ct-pfield{display:grid;gap:4px;font-size:12px;color:var(--vm-ink-soft)}
.ct-pinput{min-height:32px;padding:4px 8px;border:1px solid var(--vm-line);border-radius:6px;background:var(--vm-bg);color:var(--vm-ink);font-size:13px}
.ct-prange{width:100%;min-height:24px;accent-color:var(--vm-primary)}
.ct-pchecks{display:flex;flex-wrap:wrap;gap:6px 14px;margin:0;padding:0;border:0}
.ct-pcheck{display:inline-flex;align-items:center;gap:6px;min-height:24px;font-size:12px;color:var(--vm-ink-soft)}
.ct-pnote{margin:0;font-size:12px;color:var(--vm-ink-faint)}
.ct-swatches{display:flex;gap:6px;margin:0;padding:0;border:0}.ct-swatches legend{font-size:12px;color:var(--vm-ink-soft);margin-bottom:4px}
.ct-swatch{position:relative;display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:var(--mk);cursor:pointer;box-shadow:inset 0 0 0 1px rgba(0,0,0,.35)}
.ct-swatch input{position:absolute;inset:0;margin:0;opacity:0;cursor:pointer}
.ct-swatch:has(input:checked){box-shadow:0 0 0 2px var(--vm-surface),0 0 0 4px var(--mk)}
.ct-swatch:has(input:focus-visible){outline:2px solid var(--vs-accent-ink);outline-offset:4px}
.ct-pactions{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end}
.ct-pbtn{min-height:32px;padding:4px 12px;border:1px solid var(--vm-line);border-radius:6px;background:var(--vm-surface-2);color:var(--vm-ink);font-size:12px;cursor:pointer}
.ct-pbtn.primary{border-color:var(--vm-primary);background:var(--vm-primary-soft)}.ct-pbtn.danger{color:var(--vs-bad-ink)}
.ct-pbtn:disabled{opacity:.45;cursor:default}

.ct-scroll{position:relative;overflow-x:auto;overflow-y:auto;max-height:360px;border:1px solid var(--vm-line);border-radius:8px;background:var(--vm-bg);overscroll-behavior-x:contain}
.ct-body{position:relative;padding-bottom:6px}
.ct-ruler{position:relative;height:28px;border-bottom:1px solid var(--vm-line-2);cursor:pointer}
.ct-tick{position:absolute;top:4px;font-size:10px;color:var(--vm-ink-faint);transform:translateX(2px);padding-left:3px;border-left:1px solid var(--vm-line)}
/* Markers: the one bit of colour in the ruler, a pennant in the person's own colour (a chapter is notched). */
.ct-marker{position:absolute;top:2px;z-index:4;display:grid;place-items:start center;width:24px;height:24px;padding:2px 0 0;border:0;background:none;transform:translateX(-50%);cursor:grab;touch-action:none}
.ct-marker svg{width:11px;height:15px;fill:var(--mk);stroke:rgba(0,0,0,.45);stroke-width:.8}
.ct-marker::after{content:"";position:absolute;left:50%;top:17px;width:1px;height:9px;background:var(--mk);opacity:.8}
.ct-marker.on svg{stroke:var(--vm-ink);stroke-width:1.4}
.ct-marker:disabled{cursor:default}
.ct-playhead{position:absolute;top:0;bottom:0;width:2px;background:var(--vs-accent-ink);z-index:3;pointer-events:none}
.ct-links{position:absolute;top:0;left:0;z-index:2;pointer-events:none;overflow:visible}
.ct-links line{stroke:var(--vm-ink-soft);stroke-width:1;stroke-dasharray:2 2}.ct-links circle{fill:var(--vm-ink-soft)}
.ct-row{display:flex;min-height:52px;border-bottom:1px solid var(--vm-line-2)}
.ct-row.ct-text,.ct-row.ct-audio{min-height:40px}
.ct-head{position:sticky;left:0;z-index:5;display:flex;flex-wrap:wrap;align-content:center;align-items:center;gap:0 4px;box-sizing:border-box;width:144px;flex:none;padding:3px 4px 3px 8px;background:var(--vm-surface);border-right:1px solid var(--vm-line-2)}
.ct-main .ct-head{box-shadow:inset 3px 0 0 var(--vs-accent-ink)}
/* The name on its own line, whole (two lines at most for a long name of the person's own; the full name is its title). */
.ct-name{flex:1 0 100%;min-width:0;font-size:11px;line-height:1.3;color:var(--vm-ink-soft);overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ct-badge,.ct-role{font-size:10px;line-height:1;padding:2px 5px;border-radius:4px;color:var(--vs-accent-ink);border:1px solid currentColor}
.ct-role{color:var(--vm-ink-faint)}
.ct-flags{display:flex;flex-wrap:wrap;gap:0 1px;flex:1 0 100%}
.ct-icon{display:grid;place-items:center;width:24px;height:24px;padding:0;border:0;border-radius:4px;background:none;color:var(--vm-ink-faint);cursor:pointer}
.ct-icon[aria-pressed="true"]{color:var(--vs-warn-ink)}.ct-icon:hover{background:var(--vm-surface-2)}
.ct-icon[aria-expanded="true"]{color:var(--vs-accent-ink)}
.ct-icon svg,.ct-transition svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.ct-lane{position:relative;flex:none;cursor:crosshair}
.ct-lane.ct-drop{box-shadow:inset 0 0 0 2px var(--vm-primary);background:var(--vm-primary-soft)}
.ct-off .ct-lane{opacity:.45}
.ct-locked .ct-lane{background:repeating-linear-gradient(135deg,transparent 0 6px,rgba(255,255,255,.03) 6px 12px)}
.ct-item{position:absolute;top:5px;bottom:5px;display:flex;align-items:flex-end;overflow:hidden;border:1px solid #5f819d;border-radius:5px;background:#2e4c65;color:var(--vm-ink);cursor:grab;touch-action:none;user-select:none}
.ct-text .ct-item{background:#4a3f6b;border-color:#7d70a8}
.ct-audio .ct-item{background:#2c4d43;border-color:#5a9483}
.ct-item.compound{background:#3b3f4f;border-color:#8c93ad;box-shadow:inset 0 3px 0 rgba(255,255,255,.12),inset 0 -3px 0 rgba(0,0,0,.2)}
.ct-item.on{border-color:var(--vs-accent-ink);box-shadow:inset 0 0 0 1px var(--vs-accent-ink)}
.ct-item:focus-visible{outline:2px solid var(--vs-accent-ink);outline-offset:1px}
.ct-locked .ct-item{cursor:not-allowed}
.ct-tool-blade .ct-item{cursor:text}.ct-tool-slip .ct-item,.ct-tool-slide .ct-item{cursor:ew-resize}
.ct-strip{position:absolute;inset:0;background-repeat:repeat-x;opacity:.7}
.ct-wave{position:absolute;inset:4px 0;width:100%;height:calc(100% - 8px)}.ct-wave path{stroke:#9fe3cc;stroke-width:1;vector-effect:non-scaling-stroke}
.ct-title{position:relative;z-index:1;display:inline-flex;align-items:center;gap:4px;max-width:100%;padding:2px 10px;font-size:11px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:linear-gradient(transparent,rgba(0,0,0,.55))}
.ct-cicon{width:12px;height:12px;flex:none;fill:none;stroke:currentColor;stroke-width:2}
.ct-pin{position:absolute;left:0;top:0;z-index:2;width:6px;height:6px;border-radius:0 0 6px 0;background:var(--vm-ink-soft)}
/* Keyframe diamonds along the bottom edge, at their time in the clip. */
.ct-key{position:absolute;bottom:3px;z-index:2;width:7px;height:7px;margin-left:-3.5px;background:var(--vm-amber-ink, #f2b341);transform:rotate(45deg);box-shadow:0 0 0 1px rgba(0,0,0,.55);pointer-events:none}
.ct-handle{position:absolute;top:0;bottom:0;z-index:3;width:8px;cursor:ew-resize;background:rgba(255,255,255,.08)}
.ct-handle.start{left:0}.ct-handle.end{right:0}.ct-item.on .ct-handle{background:var(--vs-accent-ink)}
/* The red edit point: the clip's file ends at this edge. */
.ct-item .ct-handle.limit,.ct-item.on .ct-handle.limit{background:var(--vs-bad-ink, #e5484d)}
.ct-handle:focus-visible{outline:2px solid #fff}
.ct-transition{position:absolute;top:50%;z-index:2;display:flex;justify-content:center;transform:translateY(-50%);pointer-events:none}
.ct-transition button{pointer-events:auto;display:grid;place-items:center;width:24px;height:24px;padding:0;border:1px solid var(--vm-line);border-radius:5px;background:var(--vm-surface);color:var(--vm-ink);cursor:pointer}
.ct-transition.on button{border-color:var(--vs-accent-ink);color:var(--vs-accent-ink)}
.ct-marquee{position:absolute;z-index:6;border:1px solid var(--vs-accent-ink);background:color-mix(in srgb,var(--vs-accent-ink) 14%,transparent);pointer-events:none}
.ct-seek{padding:0 2px}.ct-slider{width:100%;accent-color:var(--vm-primary);min-height:24px}
/* Narrower than a desktop: icons only; the label stays the button's name for a screen reader. */
@media (max-width:767px){
  .ct-scroll{max-height:240px}
  .ct-head{padding-left:6px}
  /* On a phone the track's controls are in its settings, one 44 px button. */
  .ct-icon{width:44px;height:44px}.ct-has-bar .ct-inline{display:none}
  .ct-row{min-height:56px}.ct-row.ct-text,.ct-row.ct-audio{min-height:52px}
  .ct-handle{width:14px}
  .ct-transition button{width:44px;height:44px}
  .ct-marker{width:44px;height:28px}
  .ct-tb{min-height:44px;min-width:44px}
  .ct-crumb,.ct-pbtn,.ct-pinput{min-height:44px}.ct-pcheck{min-height:44px}
  .ct-swatch{width:44px;height:44px}
  .ct-phone-hide{display:none}
  .ct-slider{min-height:44px}
}
@media (prefers-reduced-motion:reduce){.ct-scroll{scroll-behavior:auto}.ct-tb{transition:none}}
</style>
