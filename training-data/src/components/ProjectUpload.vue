<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import { Upload, FileImage, FolderOpen, Plus, X, Check, ArrowRight, Smartphone, CloudUpload, Code, Search, FileArchive } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import UiDialog from './UiDialog.vue';
import { uploadPhotos, listLabellers, assignUpload, importClasses, importLabelled, inParts, folderOf } from '../api/training.js';
import { phoneLinksApi, extractPhotos, qrOf, FRAME_EVERY } from '../api/phone.js';
const props = defineProps({ project: Object });
const emit = defineEmits(['continue', 'navigate']);
const batch = ref('Interior photos — new batch'); const tag = ref(''); const tags = ref([]); const instant = ref(false);
const files = ref([]); const drag = ref(false); const errors = ref([]); const detail = ref(null); const help = ref('');
const input = ref(null); const folder = ref(null); const origin = ref('customer'); const consent = ref(''); const grouping = ref('auto'); const groupName = ref('');
const provider=ref('ZIP with annotations');const sourceError=ref('');
let serial = 0;
// Every file chosen is uploaded. Nothing is labelled before it is: labelled photos come in through Bulk upload.
const real = files;
function addTag() { const value = tag.value.trim(); if (value && !tags.value.includes(value)) tags.value.push(value.slice(0,40)); tag.value = ''; }
function selectFiles(list) {
  errors.value = [];
  for (const file of Array.from(list || [])) {
    const zip = /\.zip$/i.test(file.name);
    if (!zip && !['image/jpeg','image/png','image/webp'].includes(file.type)) { errors.value.push(`${file.name}: choose a JPEG, PNG, WebP image or ZIP archive.`); continue; }
    if (!zip && file.size > 15 * 1024 * 1024) { errors.value.push(`${file.name}: exceeds the 15 MiB image limit.`); continue; }
    if (!zip && real.value.filter(f => !f.zip).length >= 100) { errors.value.push('A batch can contain up to 100 images. Put more in a .zip file.'); break; }
    files.value.push({id:++serial,name:file.name,size:file.size,url:zip?'':URL.createObjectURL(file),path:file.webkitRelativePath,zip,file});
  }
  if (input.value) input.value.value = ''; if (folder.value) folder.value.value = '';
}
function remove(file) { if(file.url) URL.revokeObjectURL(file.url); files.value = files.value.filter(f => f.id !== file.id); }
function drop(event) { drag.value = false; selectFiles(event.dataTransfer.files); }

// "Create batch instantly": who labels the new assignment. Only a person who may make assignments can choose.
const labellers = ref(null); const labeller = ref(''); const labellersError = ref('');
watch(instant, async on => {
  if (!on || labellers.value || !props.project) return;
  try { labellers.value = (await listLabellers(props.project.ref)).labellers; labeller.value = labellers.value[0]?.id ?? ''; }
  catch (error) { labellersError.value = error.message; instant.value = false; }
});

// The upload: in parts of 20 files, one upload batch over all of them; then the assignment when asked for.
const busy = ref(false); const progress = ref(''); const outcome = ref(null);
async function save() {
  errors.value = [];
  if (!batch.value.trim()) errors.value.push('Enter a batch name.');
  if (!real.value.length) errors.value.push('Select an image or a ZIP file before continuing.');
  // Customer photos carry the consent given in the app; only development images say where their permission comes from.
  if (origin.value === 'development' && !consent.value.trim()) errors.value.push('Describe where permission to use these images comes from.');
  // Only "all one home" needs a name: automatic groups by folder (else each photo alone), "each its own" by file.
  if (grouping.value === 'one' && !groupName.value.trim()) errors.value.push('Enter a home/group name to keep related images together.');
  if (instant.value && !labeller.value) errors.value.push('Choose who labels the new batch.');
  if (errors.value.length || busy.value) return;
  busy.value = true; outcome.value = null;
  const results = []; const counts = {added:0, already:0, stored:0, rejected:0, skipped:0}; const sides = {train:0, val:0, test:0, unassigned:0};
  let uploadBatch = null; let sent = 0; const total = real.value.length;
  try {
    for (const part of inParts(real.value, 20)) {
      progress.value = `Uploading ${sent} of ${total}`;
      const form = new FormData();
      part.forEach((f, index) => { form.append('photos', f.file, f.name); if (grouping.value === 'auto' && folderOf(f.path)) form.append(`group_${index}`, folderOf(f.path)); });
      form.append('origin', origin.value); form.append('consent_source', consent.value.trim());
      form.append('grouping', grouping.value); form.append('group', groupName.value.trim());
      if (uploadBatch) form.append('upload_batch', uploadBatch.id); else { form.append('batch_name', batch.value.trim()); form.append('tags', JSON.stringify(tags.value)); }
      const body = await uploadPhotos(props.project.ref, form);
      uploadBatch = body.upload_batch; results.push(...body.results);
      Object.keys(counts).forEach(k => { counts[k] += body.counts[k] || 0; }); Object.keys(sides).forEach(k => { sides[k] += body.sides[k] || 0; });
      sent += part.length;
    }
    progress.value = `Uploaded ${total} of ${total}`;
    let assignment = null, assignmentError = '';
    if (instant.value && counts.added + counts.already) {
      try { assignment = await assignUpload(props.project.ref, uploadBatch.id, labeller.value); } catch (error) { assignmentError = error.message; }
    }
    outcome.value = { results, counts, sides, batch: uploadBatch, assignment, assignmentError,
                      problems: results.filter(r => ['rejected','stored','skipped'].includes(r.state)) };
    files.value.forEach(f => { if (f.url) URL.revokeObjectURL(f.url); }); files.value = [];
  } catch (error) {
    errors.value = [`${error.message}${sent ? ` ${sent} of ${total} files were uploaded before this.` : ''}`];
  } finally { busy.value = false; }
}
function finish() { emit('continue', outcome.value); }
// The defaults in words, shown on the closed "More options".
const provenanceNow = computed(() => [origin.value === 'customer' ? 'Customer photos' : 'Development / test images',
  { auto: 'homes by folder', one: 'all one home', file: 'each photo its own home' }[grouping.value]].join(' · '));

// Bulk upload: "ZIP with annotations" imports photos that are already labelled (a COCO .zip), with the source and
// grouping chosen on this screen. The other formats have no backend yet.
const importFile = ref(null); const importInput = ref(null); const importInfo = ref(null); const importBusy = ref(false);
const importMap = ref({ wall: '', window: '', door: '' }); const importSource = ref('ground_truth_team'); const importApprove = ref(true);
const importOutcome = ref(null);
async function chooseImport(list) {
  const file = list?.[0]; if (importInput.value) importInput.value.value = '';
  sourceError.value = ''; importInfo.value = null; importOutcome.value = null; importFile.value = file || null;
  if (!file) return;
  importBusy.value = true;
  try {
    const form = new FormData(); form.append('archive', file, file.name);
    importInfo.value = await importClasses(props.project.ref, form);
    const names = importInfo.value.classes.map(c => c.name);
    importMap.value = { wall: names.find(n => /wall/i.test(n)) || '', window: names.find(n => /window/i.test(n)) || '', door: names.find(n => /door/i.test(n)) || '' };
    importSource.value = importInfo.value.sources[0]?.value || '';
  } catch (error) { sourceError.value = error.message; importFile.value = null; }
  finally { importBusy.value = false; }
}
async function runImport() {
  if (!importFile.value || importBusy.value) return;
  if (!consent.value.trim() && origin.value === 'development') { sourceError.value = 'Describe the permission source on the Upload screen first.'; return; }
  importBusy.value = true; sourceError.value = '';
  try {
    const form = new FormData();
    form.append('archive', importFile.value, importFile.value.name); form.append('origin', origin.value); form.append('consent_source', consent.value.trim());
    form.append('grouping', grouping.value); form.append('group', groupName.value.trim()); form.append('source', importSource.value);
    form.append('class_wall', importMap.value.wall); form.append('class_window', importMap.value.window); form.append('class_door', importMap.value.door);
    if (importApprove.value && importInfo.value?.can_approve) form.append('approve', 'true');
    importOutcome.value = await importLabelled(props.project.ref, form);
  } catch (error) { sourceError.value = error.message; }
  finally { importBusy.value = false; }
}
function closeHelp() { help.value=''; sourceError.value=''; importInfo.value=null; importFile.value=null; importOutcome.value=null; mediaFile.value=null; mediaOutcome.value=null; }

// What a phone link and a video or PDF are taken in with: this screen's own fields, checked as Save checks them.
function sourceFields() {
  if (!batch.value.trim()) return 'Enter a batch name on the Upload screen first.';
  if (origin.value === 'development' && !consent.value.trim()) return 'Describe the permission source on the Upload screen first.';
  if (grouping.value === 'one' && !groupName.value.trim()) return 'Enter a home/group name on the Upload screen first.';
  return '';
}
const phoneGrouping = () => (grouping.value === 'one' ? 'one' : 'file');      // a phone sends loose photos

// Upload from your phone: a link for an hour, shown once as a QR code (phone_links.py). The links that still work
// are listed and can be stopped.
const phone = ref({ links: [], made: null, busy: false });
const phoneQr = computed(() => qrOf(phone.value.made?.url));
// While the phone panel is open, its links are read again every 5 s: a phone sends without this page knowing, and the
// count of photos it sent stayed at 0 until the page was opened again (found 2026-10-21).
let phoneTimer = null;
async function loadPhoneLinks() {
  clearTimeout(phoneTimer);
  try { phone.value.links = (await phoneLinksApi.list(props.project.ref)).links; } catch (e) { sourceError.value = e.message; }
  if (help.value === 'Upload from your phone' && phone.value.links.some(link => link.works)) phoneTimer = setTimeout(loadPhoneLinks, 5000);
}
async function makePhoneLink() {
  const missing = sourceFields(); if (missing) { sourceError.value = missing; return; }
  phone.value.busy = true; sourceError.value = '';
  try {
    phone.value.made = await phoneLinksApi.make(props.project.ref, { origin: origin.value, consent_source: consent.value.trim(), grouping: phoneGrouping(), group: groupName.value.trim(), batch_name: batch.value.trim() });
    await loadPhoneLinks();
  } catch (e) { sourceError.value = e.message; } finally { phone.value.busy = false; }
}
async function stopPhoneLink(link) {
  phone.value.busy = true;
  try { await phoneLinksApi.stop(props.project.ref, link.id); if (phone.value.made?.link.id === link.id) phone.value.made = null; await loadPhoneLinks(); }
  catch (e) { sourceError.value = e.message; } finally { phone.value.busy = false; }
}
const copiedLink = ref(false);
async function copyPhoneLink() { try { await navigator.clipboard.writeText(phone.value.made.url); copiedLink.value = true; setTimeout(() => { copiedLink.value = false; }, 2500); } catch { sourceError.value = 'Copy the link from the box above.'; } }
const clock = iso => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
watch(help, now => { if (now === 'Upload from your phone' && props.project?.ref) { phone.value.made = null; loadPhoneLinks(); } });

// Video frames and PDF pages (media_import.py): the photos join this upload's batch name.
const mediaInput = ref(null); const mediaFile = ref(null); const mediaBusy = ref(false); const mediaOutcome = ref(null); const every = ref(5);
function chooseMedia(list) { mediaFile.value = list?.[0] || null; mediaOutcome.value = null; sourceError.value = ''; if (mediaInput.value) mediaInput.value.value = ''; }
async function runMedia() {
  const missing = sourceFields(); if (missing) { sourceError.value = missing; return; }
  if (!mediaFile.value || mediaBusy.value) return;
  mediaBusy.value = true; sourceError.value = '';
  try {
    const form = new FormData();
    form.append('file', mediaFile.value, mediaFile.value.name); form.append('kind', provider.value === 'Video frames' ? 'video' : 'pdf'); form.append('every', String(every.value));
    form.append('origin', origin.value); form.append('consent_source', consent.value.trim()); form.append('grouping', phoneGrouping());
    form.append('group', groupName.value.trim()); form.append('batch_name', batch.value.trim()); form.append('tags', JSON.stringify(tags.value));
    mediaOutcome.value = await extractPhotos(props.project.ref, form);
  } catch (e) { sourceError.value = e.message; } finally { mediaBusy.value = false; }
}
onUnmounted(() => { clearTimeout(phoneTimer); files.value.forEach(f => { if(f.url) URL.revokeObjectURL(f.url); }); });
</script>
<template>

  <div class="upload-layout"><section>
    <div class="upload-fields"><label class="field-label">Batch name<input v-model="batch" class="text-input" maxlength="100" placeholder="Name this upload batch"></label><div><label class="field-label" for="upload-tags">Tags</label><form class="tag-input" @submit.prevent="addTag"><input id="upload-tags" v-model="tag" placeholder="Search or add tags for images…" maxlength="40"><button class="icon-button" aria-label="Add tag"><Plus :size="17" /></button></form><div class="tag-chips"><button v-for="item in tags" :key="item" @click="tags = tags.filter(t => t !== item)" :aria-label="`Remove tag ${item}`">{{ item }}<X :size="12" /></button></div></div></div>
    <label class="upload-checkbox"><input v-model="instant" type="checkbox"> Create batch instantly <span>(give these photos to a labeller now)</span></label><label v-if="instant && labellers" class="field-label upload-labeller">Who labels<select v-model="labeller" class="text-input"><option v-for="p in labellers" :key="p.id" :value="p.id">{{ p.name }}{{ p.you ? ' (you)' : '' }} · {{ p.role_label }}</option></select></label><div v-if="labellersError" class="upload-errors" role="alert">{{ labellersError }}</div>
    <div v-if="errors.length" class="upload-errors" role="alert"><strong>Check this batch</strong><ul><li v-for="error in errors" :key="error">{{ error }}</li></ul></div>
    <section v-if="outcome" class="upload-provenance upload-result" role="status"><h2><Check :size="17" /> {{ outcome.batch?.name }} is uploaded</h2>
      <p>{{ outcome.counts.added }} added · {{ outcome.counts.already }} already in the project · {{ outcome.counts.stored }} kept as a record only · {{ outcome.counts.rejected }} rejected{{ outcome.counts.skipped ? ` · ${outcome.counts.skipped} skipped` : '' }}</p>
      <p v-if="outcome.counts.added">Where the added photos went: {{ outcome.sides.train }} training · {{ outcome.sides.val }} validation · {{ outcome.sides.test }} test · {{ outcome.sides.unassigned }} unassigned (no home/group)</p>
      <p v-if="outcome.assignment">Batch {{ outcome.assignment.assignment }} was given to {{ outcome.assignment.labeller }}: {{ outcome.assignment.photos }} photos.</p>
      <p v-if="outcome.assignmentError" class="upload-errors">The batch was not given to a labeller: {{ outcome.assignmentError }}</p>
      <ul v-if="outcome.problems.length" class="upload-problems"><li v-for="r in outcome.problems" :key="r.name"><strong>{{ r.name }}</strong> — {{ r.state === 'stored' ? 'kept as a record only' : r.state }}: {{ r.detail }}</li></ul>
      <div class="upload-actions"><UiButton variant="primary" @click="finish">Continue to Annotate <ArrowRight :size="16" /></UiButton><UiButton @click="outcome = null">Upload more</UiButton></div>
    </section>
    <div :class="['drop-area', {dragging:drag, populated:files.length}]" @dragover.prevent="drag = true" @dragleave.prevent="drag = false" @drop.prevent="drop">
      <input ref="input" type="file" multiple accept="image/jpeg,image/png,image/webp,.zip,application/zip" hidden @change="selectFiles($event.target.files)"><input ref="folder" type="file" multiple webkitdirectory hidden @change="selectFiles($event.target.files)">
      <template v-if="!files.length"><span class="upload-large-icon"><Upload :size="34" /></span><h2>Drag and drop images or a ZIP file to get started</h2><p>Bring your project’s images together in one batch.</p><div class="upload-actions"><UiButton @click="input.click()"><FileImage :size="16" /> Select files</UiButton><UiButton @click="folder.click()"><FolderOpen :size="16" /> Select folder</UiButton></div><div class="format-box"><FileImage :size="19" /><div><strong>JPEG · PNG · WebP</strong><p>Up to 15 MiB per image · 100 images per batch</p></div></div></template>
      <template v-else><div class="upload-queue-header"><div><h2>Drag and drop more images or ZIP files</h2><p>{{ real.length }} selected</p></div><div class="upload-actions"><UiButton @click="input.click()">Select files</UiButton><UiButton @click="folder.click()">Select folder</UiButton></div></div><div class="upload-image-grid"><article v-for="file in files" :key="file.id"><button class="image-open" @click="detail = file" :aria-label="`Preview ${file.name}`"><span v-if="file.zip" class="zip-tile"><FileArchive :size="34" /></span><img v-else :src="file.url" :alt="file.name"><span><Search :size="16" /></span></button><div class="upload-file-name"><span :title="file.name">{{ file.name }}</span><button class="icon-button" :aria-label="`Remove ${file.name}`" @click="remove(file)"><X :size="14" /></button></div><small>{{ file.zip ? `ZIP · ${(file.size/1048576).toFixed(1)} MB` : `${(file.size/1024).toFixed(0)} KiB` }}</small></article></div></template>
    </div>
    <details class="upload-provenance"><summary><span class="provenance-title">More options</span><span class="provenance-now">{{ provenanceNow }}</span></summary><p>Change these only when the defaults are wrong for this upload.</p><div class="upload-fields"><label class="field-label">Image source<select v-model="origin" class="text-input"><option value="customer">Customer photos (consent given in the app)</option><option value="development">Development / test images</option></select></label><label v-if="origin==='development'" class="field-label">Permission source<input v-model="consent" class="text-input" maxlength="200" placeholder="e.g. Synthetic test images, or our own photos"></label><label class="field-label">Homes<select v-model="grouping" class="text-input"><option value="auto">Automatic: each folder is one home, a loose photo its own</option><option value="one">All these photos are one home</option><option value="file">Each photo is a different home</option></select></label><label v-if="grouping==='one'" class="field-label">Home name<input v-model="groupName" class="text-input" maxlength="100" placeholder="e.g. Demo home 01"></label></div><p class="group-note">Photos of one home always land on the same side (training, validation or test), so a model is never tested on a room it trained on.</p></details>
    <div class="upload-bottom"><span role="status">{{ busy ? progress : `${real.length} files · ${tags.length} tags` }}</span><UiButton variant="primary" :disabled="busy" @click="save">{{ busy ? 'Uploading…' : 'Save and Continue' }} <ArrowRight :size="16" /></UiButton></div>
  </section><aside class="upload-help"><h3>Need data to get started?</h3><article v-for="item in [{title:'Bulk upload images',icon:Code,text:'A whole folder of photos, or photos that are already labelled in a ZIP file.',action:'View bulk upload'}, {title:'Upload from your phone',icon:Smartphone,text:'A link a phone opens to send photos straight into this project.',action:'Make a phone link'}, {title:'Connect cloud storage',icon:CloudUpload,text:'Import images from your preferred storage provider.',action:'Read more',soon:true}, {title:'Discover more images',icon:Search,text:'Explore public datasets to broaden yours.',action:'Read more',soon:true}]" :key="item.title"><span class="help-icon"><component :is="item.icon" :size="21" /></span><h3>{{ item.title }}</h3><p>{{ item.text }}</p><UiBadge v-if="item.soon">Coming soon</UiBadge><UiButton @click="help = item.title; if (!item.soon) provider = 'ZIP with annotations'">{{ item.action }}<ArrowRight :size="14" /></UiButton></article></aside></div>
  <UiDialog :open="!!detail" title="Image preview" @close="detail = null"><template v-if="detail"><div class="preview-image"><FileArchive v-if="detail.zip" :size="60" /><img v-else :src="detail.url" :alt="detail.name"></div><h3>{{ detail.name }}</h3><p class="dialog-description">{{ detail.zip ? 'ZIP file · its photos are taken in when you save' : 'Selected · not uploaded yet' }}</p><UiButton @click="detail = null">Back to batch</UiButton></template></UiDialog>
  <UiDialog :open="!!help" :title="help" @close="closeHelp">
<div class="upload-help-dialog"><UiBadge v-if="['Connect cloud storage','Discover more images'].includes(help)" tone="purple">Coming soon</UiBadge>
<template v-if="help==='Connect cloud storage'"><p>Importing photos straight from Amazon S3, Google Cloud Storage or Azure Blob Storage is not available yet: it needs your storage credentials kept for you. For now, download the photos and upload them here, or let your own system send them with a key from the Connect app page.</p></template>
<template v-else-if="help==='Upload from your phone'"><p>Scan the code with a phone: it opens a page that sends photos straight into this project, without signing in, for one hour. The photos go in as you: with this screen's image source and homes, in the batch “{{ batch }}”.</p>
<div v-if="phone.made" class="phone-made"><svg v-if="phoneQr" class="phone-qr" :viewBox="`0 0 ${phoneQr.size} ${phoneQr.size}`" shape-rendering="crispEdges" role="img" aria-label="QR code of the phone link"><rect :width="phoneQr.size" :height="phoneQr.size" fill="#ffffff"/><path :d="phoneQr.path" fill="#0f172a"/></svg>
<div><p>Works until {{ clock(phone.made.link.expires_at) }}, for up to {{ phone.made.link.max_photos }} photos. Anyone with this link can send photos into the project until then: share it only with the phone.</p><input class="text-input" :value="phone.made.url" readonly aria-label="Phone link"><UiButton @click="copyPhoneLink">{{ copiedLink ? 'Copied' : 'Copy link' }}</UiButton></div></div>
<UiButton v-else variant="primary" :disabled="phone.busy" @click="makePhoneLink"><Smartphone :size="16" /> {{ phone.busy ? 'Making the link…' : 'Make a phone link' }}</UiButton>
<template v-if="phone.links.length"><h4 class="phone-links-title">Links that still work</h4><ul class="phone-links"><li v-for="link in phone.links" :key="link.id"><span>{{ link.by }}, until {{ clock(link.expires_at) }}: {{ link.photos_sent }} photo{{ link.photos_sent===1?'':'s' }} sent</span><UiButton :disabled="phone.busy" @click="stopPhoneLink(link)">Stop</UiButton></li></ul></template></template>
<template v-else-if="help==='Discover more images'"><p>Adding photos from public datasets is not available yet: each dataset's licence must be checked before its photos can train a model.</p></template>
<template v-else><label class="field-label">Import format<select v-model="provider" class="text-input"><option>ZIP with annotations</option><option>Image folder</option><option>Video frames</option><option>PDF pages</option></select></label>
<template v-if="provider==='ZIP with annotations'"><p>Photos that are already labelled, with their COCO annotation file (as Roboflow, CVAT or Label Studio export it). The image source and homes of the Upload screen are used (More options).</p>
<input ref="importInput" type="file" accept=".zip,application/zip" hidden @change="chooseImport($event.target.files)"><UiButton :disabled="importBusy" @click="importInput.click()"><FileArchive :size="16" /> {{ importFile ? importFile.name : 'Choose a .zip file' }}</UiButton>
<template v-if="importInfo && !importOutcome"><p>{{ importInfo.photos }} photos · {{ importInfo.files.length }} annotation file{{ importInfo.files.length === 1 ? '' : 's' }}. Say which class of the file is each kind:</p>
<label v-for="kind in ['wall','window','door']" :key="kind" class="field-label">{{ kind === 'wall' ? 'Wall (required)' : kind === 'window' ? 'Window' : 'Door' }}<select v-model="importMap[kind]" class="text-input"><option value="">{{ kind === 'wall' ? 'Choose a class' : 'None' }}</option><option v-for="c in importInfo.classes" :key="c.name" :value="c.name">{{ c.name }} ({{ c.shapes }})</option></select></label>
<label class="field-label">Who made the labels<select v-model="importSource" class="text-input"><option v-for="s in importInfo.sources" :key="s.value" :value="s.value">{{ s.label }}</option></select></label>
<label v-if="importInfo.can_approve" class="upload-checkbox"><input v-model="importApprove" type="checkbox"> Approve every label the checks find nothing in</label>
<UiButton variant="primary" :disabled="importBusy || !importMap.wall" @click="runImport">{{ importBusy ? 'Importing…' : 'Import labelled photos' }}</UiButton></template>
<template v-if="importOutcome"><p role="status"><Check :size="14" /> {{ importOutcome.summary.photos }} photos added, {{ importOutcome.summary.already }} already there, {{ importOutcome.summary.rejected }} not taken in. Labels: {{ importOutcome.summary.made.approved }} approved, {{ importOutcome.summary.made.to_approve }} to approve, {{ importOutcome.summary.made.to_fix }} to fix.</p><p v-if="importOutcome.summary.left_out">{{ importOutcome.summary.left_out }} shapes of {{ importOutcome.summary.left_out_classes.join(', ') }} were left out: no kind was chosen for them.</p></template></template>
<template v-else-if="provider==='Image folder'"><p>Every JPEG, PNG and WebP photo in a folder and its subfolders joins this batch; anything else is left out. The photos of each subfolder are kept together as one home by themselves (More options › Homes).</p><UiButton variant="primary" @click="closeHelp(); folder.click()"><FolderOpen :size="16" /> Choose a folder</UiButton></template>
<template v-else><p>{{ provider === 'Video frames' ? 'A photo every few seconds of a video: MP4, MOV, WebM or MKV, up to 95 MB, at most 100 photos.' : 'The photo on each page of a PDF, up to 95 MB and 200 pages; a page without a photo gives none.' }} They join the batch “{{ batch }}” with this screen's image source and homes. The {{ provider === 'Video frames' ? 'video' : 'PDF' }} itself is not kept.</p>
<label v-if="provider==='Video frames'" class="field-label">Take a photo every<select v-model.number="every" class="text-input"><option v-for="n in FRAME_EVERY" :key="n" :value="n">{{ n }} second{{ n===1?'':'s' }}</option></select></label>
<input ref="mediaInput" type="file" :accept="provider==='Video frames' ? 'video/mp4,video/quicktime,video/webm,video/x-matroska' : 'application/pdf,.pdf'" hidden @change="chooseMedia($event.target.files)">
<div class="media-actions"><UiButton :disabled="mediaBusy" @click="mediaInput.click()"><FileArchive :size="16" /> {{ mediaFile ? mediaFile.name : provider==='Video frames' ? 'Choose a video' : 'Choose a PDF' }}</UiButton><UiButton variant="primary" :disabled="!mediaFile||mediaBusy" @click="runMedia">{{ mediaBusy ? 'Taking the photos…' : 'Take the photos' }}</UiButton></div>
<p v-if="mediaOutcome" role="status"><Check :size="14" /> {{ mediaOutcome.taken }} photo{{ mediaOutcome.taken===1?'':'s' }} taken: {{ mediaOutcome.counts.added }} added, {{ mediaOutcome.counts.already }} already in the project{{ mediaOutcome.counts.stored ? `, ${mediaOutcome.counts.stored} kept as a record only` : '' }}{{ mediaOutcome.counts.rejected ? `, ${mediaOutcome.counts.rejected} rejected` : '' }}{{ mediaOutcome.pages_without_photo ? `; ${mediaOutcome.pages_without_photo} page${mediaOutcome.pages_without_photo===1?'':'s'} without a photo` : '' }}.</p></template>
<p>Sending from your own system through the API? <UiButton @click="closeHelp(); emit('navigate', 'connect')">Open Connect app <ArrowRight :size="14" /></UiButton></p></template><p v-if="sourceError" role="alert">{{sourceError}}</p><div class="dialog-actions"><UiButton @click="closeHelp">Back to upload</UiButton></div></div></UiDialog>
</template>
<style scoped>
.upload-preview-note{display:flex;align-items:center;gap:12px;margin-bottom:26px;font-size:11px;color:#8a7c98}.upload-layout{display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:30px}.upload-fields{display:grid;grid-template-columns:1fr 1fr;gap:20px}.field-label{margin-top:0;font-weight:500}.field-label .text-input{margin-top:9px}.tag-input{display:flex;border:1px solid #d9dce5;border-radius:7px;background:white;overflow:hidden}.tag-input input{width:100%;min-width:0;padding:12px;border:0;font-size:12px}.tag-input .icon-button{margin:4px}.tag-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.tag-chips button{display:flex;align-items:center;gap:8px;padding:4px 8px;background:var(--aadml-soft);color:var(--aadml-primary);border:1px solid var(--aadml-outline);border-radius:6px;font-size:10px}.upload-checkbox{display:flex;align-items:center;gap:8px;margin:22px 0;font-size:12px}.upload-checkbox span{color:#9992a5;font-size:10px}.upload-checkbox input{accent-color:var(--accent)}.drop-area{border:1px dashed var(--aadml-outline);background:#fafbfc;border-radius:8px;min-height:410px;display:flex;align-items:center;justify-content:center;flex-direction:column;padding:35px;gap:16px}.drop-area.dragging{background:var(--aadml-soft);border-color:var(--accent)}.drop-area h2{font-size:18px}.drop-area>p{font-size:12px}.upload-large-icon{background:var(--aadml-soft);border-radius:50%;width:70px;height:70px;display:grid;place-items:center;color:#8a8798;margin-bottom:5px}.upload-actions{display:flex;gap:8px;flex-wrap:wrap}.format-box{display:flex;gap:12px;padding:16px 24px;border:1px solid var(--aadml-outline);border-radius:8px;background:white;color:#777185;margin-top:14px;font-size:11px}.format-box p{font-size:10px;margin-top:5px}.upload-help>h3{font-size:14px;margin-bottom:16px}.upload-help article{border:1px solid #dedee7;border-radius:8px;background:white;padding:18px;margin-bottom:16px}.help-icon{width:37px;height:37px;display:grid;place-items:center;background:#f3f3f7;border-radius:8px;color:var(--aadml-primary);margin-bottom:16px}.upload-help article h3{font-size:14px}.upload-help article p{font-size:12px;margin:10px 0 14px}.upload-help article .badge{font-size:9px}.upload-help article .button{width:100%;margin-top:14px;font-size:11px}.upload-provenance{margin-top:24px;border:1px solid var(--aadml-soft);background:white;border-radius:8px;padding:16px 24px}.upload-provenance summary{display:flex;align-items:center;gap:12px;flex-wrap:wrap;cursor:pointer;min-height:32px}.provenance-title{font-size:14px;font-weight:600;color:#24324a}.provenance-now{font-size:12px;color:#5f6d82}.upload-provenance[open] summary{margin-bottom:6px}.upload-provenance>p{font-size:12px;margin:9px 0 20px}.upload-provenance .group-note{font-size:11px;margin:20px 0 0;color:var(--aadml-primary)}.upload-bottom{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-top:22px}.upload-bottom>span{font-size:11px;color:#8b8596}.populated{padding:0;display:block;min-height:300px}.upload-queue-header{padding:20px;border-bottom:1px solid var(--aadml-soft);display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap}.upload-queue-header h2{font-size:15px}.upload-queue-header p{font-size:11px;margin-top:8px}.upload-image-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:20px;padding:24px}.upload-image-grid article{min-width:0}.image-open{border:1px solid var(--aadml-outline);border-radius:7px;padding:0;width:100%;height:120px;overflow:hidden;position:relative;background:var(--aadml-soft)}.image-open img,.image-open svg{width:100%;height:100%;object-fit:cover}.image-open>span{position:absolute;top:6px;right:6px;background:white;color:var(--accent);border-radius:50%;width:26px;height:26px;padding:5px}.upload-file-name{display:flex;gap:5px;align-items:center;font-size:10px}.upload-file-name>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}.upload-image-grid small{font-size:9px;color:#9990a4}.upload-errors{border:1px solid #efc9cf;background:#fff3f5;color:#a43c50;padding:15px;border-radius:7px;font-size:12px;margin-bottom:18px}.upload-errors ul{padding-left:20px;line-height:1.8;margin-bottom:0}.preview-image{margin:20px 0}.preview-image img,.preview-image svg{width:100%;max-height:330px;object-fit:contain}.upload-help-dialog{padding-top:20px}.upload-help-dialog p{font-size:12px;margin:15px 0}.dialog h3{overflow-wrap:anywhere}.zip-tile{display:grid;place-items:center;height:100%;color:var(--aadml-primary)}.upload-result{margin:0 0 22px}.upload-result h2{display:flex;align-items:center;gap:8px}.upload-result p{font-size:12px;margin:10px 0}.upload-problems{font-size:12px;line-height:1.7;padding-left:20px;max-height:220px;overflow:auto}.upload-labeller{display:block;margin:0 0 18px;max-width:420px}
@media(max-width:1100px){.upload-layout{grid-template-columns:1fr}.upload-help{display:grid;grid-template-columns:1fr 1fr;gap:16px}.upload-help>h3{grid-column:1/-1;margin:0}.upload-help article{margin:0}}@media(max-width:600px){.upload-fields,.upload-help{grid-template-columns:1fr}.upload-preview-note{align-items:flex-start;flex-direction:column}.drop-area{padding:24px 15px;text-align:center}.upload-provenance{padding:18px}.upload-bottom{gap:10px}}
.phone-made{display:grid;grid-template-columns:184px minmax(0,1fr);gap:16px;align-items:start;margin:12px 0}.phone-qr{width:184px;height:184px;border:1px solid #e2e8f0;border-radius:9px}.phone-made p{font-size:12px;margin:0 0 10px}.phone-made .text-input{font-size:11px;margin-bottom:8px}.phone-links-title{font-size:13px;margin:18px 0 6px}.phone-links{list-style:none;padding:0;margin:0}.phone-links li{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #eef0f4;font-size:12px}.media-actions{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0}@media(max-width:520px){.phone-made{grid-template-columns:1fr}}
</style>
