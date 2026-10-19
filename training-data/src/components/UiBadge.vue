<script setup>defineProps({ tone: { type: String, default: 'neutral' } });</script>
<template><span :class="['badge', `badge--${tone}`]"><slot /></span></template>
