<template><ComingSoon v-if="feature" :feature="feature" :key="feature.id" /></template>
<script setup>
import { computed } from 'vue'
import { getStudioFeature } from '../services/studioFeatures'
import ComingSoon from '../components/studio/ComingSoon.vue'
const props = defineProps({ featureId: { type: String, required: true } })
const feature = computed(() => getStudioFeature(props.featureId))
</script>
