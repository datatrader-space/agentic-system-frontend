<!--
  TokenUsage — a subtle per-response token counter (like Claude/the OpenAI console).
  Reads the normalised usage emitted on `assistant_message_complete`
  ({ prompt_tokens, completion_tokens, total_tokens }). Renders nothing if absent.
  Shared by the Emulator and the new chat.
-->
<template>
  <div v-if="display" class="flex items-center gap-1.5 text-[11px] text-gray-400 mt-1.5 select-none">
    <svg class="w-3 h-3 opacity-70" viewBox="0 0 20 20" fill="currentColor"><path d="M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Zm3 2.5h8M6 10h8M6 12.5h5" stroke="currentColor" stroke-width="1" fill="none"/></svg>
    <span :title="`Total tokens for this request + response`">{{ display.total }} tokens</span>
    <template v-if="display.inOut">
      <span class="text-gray-300">·</span>
      <span title="Prompt (input) tokens">↑ {{ display.prompt }}</span>
      <span title="Completion (output) tokens">↓ {{ display.completion }}</span>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ usage: { type: Object, default: null } })

const fmt = (n) => (n == null ? null : Number(n).toLocaleString())

const display = computed(() => {
  const u = props.usage
  if (!u) return null
  const total = u.total_tokens != null
    ? u.total_tokens
    : ((u.prompt_tokens || 0) + (u.completion_tokens || 0)) || null
  if (!total) return null
  const inOut = u.prompt_tokens != null && u.completion_tokens != null
  return { total: fmt(total), prompt: fmt(u.prompt_tokens), completion: fmt(u.completion_tokens), inOut }
})
</script>
