<template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="paths[name] || studioIcons[name] || studioIcons.effects" /></svg></template>
<script setup>
import { studioIcons } from '../../services/studioFeatures'
defineProps({ name: String })
const paths = {
  layers:'m12 3 10 6-10 6L2 9l10-6M2 13l10 6 10-6M2 17l10 6 10-6',
  grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  clock:'M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8',
  library:'M4 4v16M9 4v16M14 4v16M18 4l3 16',
  canvas:'M4 3h6v6H4zM14 15h6v6h-6zM7 9v9h7',
  down:'m8 10 4 4 4-4',search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  info:'M12 11v6M12 7h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
}
</script>
