<template>
  <!-- Renders sanitized markdown. Never pass untrusted HTML here directly —
       renderMarkdown() sanitizes with DOMPurify before it reaches v-html. -->
  <div class="markdown-body md-content" v-html="html"></div>
</template>

<script setup>
import { computed } from 'vue'
import { renderMarkdown } from '../../utils/markdown'
import '../../styles/markdown.css'

const props = defineProps({
  content: { type: String, default: '' },
})

const html = computed(() => renderMarkdown(props.content))
</script>
