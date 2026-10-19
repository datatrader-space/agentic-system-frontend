<script setup>
defineProps({ variant: { type: String, default: 'secondary' }, type: { type: String, default: 'button' } });
</script>
<template><button :type="type" :class="['button', `button--${variant}`]"><slot /></button></template>
