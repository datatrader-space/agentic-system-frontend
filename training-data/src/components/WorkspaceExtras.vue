<script setup>
import {ref,computed} from 'vue';
import UiButton from './UiButton.vue';import UiBadge from './UiBadge.vue';import UiDialog from './UiDialog.vue';import RoomArt from './RoomArt.vue';import {getPreview} from '../previewState.js';
// The Asset Library and Universe pages: still the local preview (Universe needs dataset licences: Phase 3 of
// agentic-docs/TRAINING_DATA_NEW_UI_PLAN.md). Agent, Workflows and Vision events are pages of their own.
const props=defineProps({page:String});const emit=defineEmits(['navigate','create']);const state=getPreview();const query=ref('');const modal=ref('');const draft=ref('');const selected=ref(null);const message=ref('');
const assets=computed(()=>state.images.filter(i=>i.name.toLowerCase().includes(query.value.toLowerCase())));
</script>
<template><div class="studio"><div class="studio-preview"><UiBadge tone="purple">Coming soon</UiBadge><span>Local preview. No messages, integrations or jobs are sent.</span></div><div v-if="message" class="notice" role="status">{{message}}</div>
<template v-if="page==='assets'"><div class="studio-actions"><input v-model="query" class="text-input" placeholder="Search assets" aria-label="Search assets"><UiButton @click="emit('navigate','upload')">Add assets</UiButton></div><div class="media-grid"><button v-for="a in assets" :key="a.id" class="media-card" @click="selected=a;modal='Asset details'"><RoomArt v-if="a.sample" :variant="a.variant"/><img v-else :src="a.url" :alt="a.name"><strong>{{a.name}}</strong><UiBadge>{{a.state}}</UiBadge></button></div><div v-if="!assets.length" class="empty-state"><h2>No matching assets</h2><UiButton @click="query=''">Clear search</UiButton></div></template>
<template v-else><h2>Discover sample datasets</h2><p>Search this local illustrative catalog. No external collection is accessed.</p><input v-model="query" class="text-input" aria-label="Search collections" placeholder="Search collections"><div class="choice-grid"><article v-for="name in ['Indoor rooms','Bottle detection'].filter(n=>n.toLowerCase().includes(query.toLowerCase()))" :key="name" class="panel"><RoomArt/><h3>{{name}}</h3><UiBadge>Synthetic preview</UiBadge><p>Explore the import flow with sample data.</p><UiButton @click="draft=name;modal='Import collection'">View collection</UiButton></article></div></template>
<UiDialog :open="!!modal" :title="modal" @close="modal=''">
<template v-if="modal==='Asset details'"><RoomArt v-if="selected.sample"/><img v-else :src="selected.url" :alt="selected.name" style="max-width:100%"><h3>{{selected.name}}</h3><p>{{selected.state}} / {{selected.tags.join(', ')}}</p><UiButton @click="modal='';emit('navigate','dataset')">Open dataset</UiButton></template>
<template v-else><h3>{{draft}}</h3><p>Coming soon. The next step uses synthetic images in the upload preview.</p><UiButton @click="modal='';emit('navigate','upload')">Continue to upload preview</UiButton></template>
</UiDialog></div></template>
<style scoped>.choice-grid .panel>svg{width:100%;max-height:180px}.dialog svg{max-width:100%}</style>
