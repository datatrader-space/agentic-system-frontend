<template>
  <!-- AADML "Mission Orbit" logo mark (theme-matched: ink + blue orbit + red node).
       Standalone SVG copies live at public/aadml-mark.svg (icon) and
       public/aadml-logo.svg (horizontal wordmark). -->
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 92 92"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="AADML"
    class="aadml-mark"
  >
    <circle cx="46" cy="46" r="36" stroke="#10231C" stroke-width="3" />
    <path d="M26 66 L43.5 28 C45.1 24.4 48.9 24.4 50.5 28 L68 66" stroke="#10231C" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M36 53 C42.5 48.3 51.5 48.3 58 53" stroke="#10231C" stroke-width="5" stroke-linecap="round" />
    <path d="M16.5 47 C16.5 25.5 31.5 12 52 10.5" stroke="#2457E6" stroke-width="3.2" stroke-linecap="round" />
    <path d="M76 31 C81 41.5 80.5 52.5 75 63" stroke="#D8DDD5" stroke-width="2.2" stroke-linecap="round" />
    <circle cx="56" cy="10.5" r="5.1" fill="#2457E6" />
    <circle cx="76.4" cy="47" r="3.6" fill="#C35B42" />
    <circle cx="45.8" cy="46" r="4.4" fill="white" stroke="#10231C" stroke-width="2.4" />
  </svg>
</template>

<script setup>
defineProps({
  size: { type: [Number, String], default: 34 },
})
</script>

<style scoped>
.aadml-mark {
  display: block;
  flex: 0 0 auto;
}
</style>
