<!--
  TokenUsage — the per-response token line (like Claude/the OpenAI console). Reads the normalised
  usage emitted on `assistant_message_complete`
  ({ prompt_tokens, completion_tokens, total_tokens, cached_tokens, cost_usd }) and renders, k-formatted:
    ▦ 4.2k tokens · ↑3.2k ↓1.0k · 1.1k cached · $0.012
  Cached + cost only appear when the provider reported them. Renders nothing without usage.
  Shared by the Emulator and the new chat.
-->
<template>
  <div v-if="display" class="flex items-center gap-1.5 text-[11px] text-gray-400 mt-1.5 select-none tabular-nums"
       :title="hoverTitle">
    <svg class="w-3 h-3 opacity-70" viewBox="0 0 20 20" fill="currentColor"><path d="M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Zm3 2.5h8M6 10h8M6 12.5h5" stroke="currentColor" stroke-width="1" fill="none"/></svg>
    <span>{{ display.total }} tokens</span>
    <template v-if="display.inOut">
      <span class="text-gray-300">·</span>
      <span title="Prompt (input) tokens">↑ {{ display.prompt }}</span>
      <span title="Completion (output) tokens">↓ {{ display.completion }}</span>
    </template>
    <template v-if="display.cached">
      <span class="text-gray-300">·</span>
      <span title="Cached prompt tokens (prompt-cache read)">{{ display.cached }} cached</span>
    </template>
    <template v-if="display.cost">
      <span class="text-gray-300">·</span>
      <span title="Estimated cost for this request + response">{{ display.cost }}</span>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { fmtTokens, fmtCost, normalizeUsage } from '../../composables/tokens'

const props = defineProps({ usage: { type: Object, default: null } })

const display = computed(() => {
  const u = normalizeUsage(props.usage)
  if (!u) return null
  return {
    total: fmtTokens(u.total),
    prompt: fmtTokens(u.prompt),
    completion: fmtTokens(u.completion),
    inOut: u.prompt != null && u.completion != null,
    cached: u.cached ? fmtTokens(u.cached) : '',
    cost: fmtCost(u.cost),
  }
})

// Exact (un-rounded) numbers on hover, like the mockup tooltip.
const hoverTitle = computed(() => {
  const u = normalizeUsage(props.usage)
  if (!u) return ''
  const parts = []
  if (u.prompt != null) parts.push(`${u.prompt.toLocaleString()} prompt`)
  if (u.completion != null) parts.push(`${u.completion.toLocaleString()} completion`)
  let s = parts.join(' + ')
  if (u.cached) s += ` · ${u.cached.toLocaleString()} cached`
  if (u.cost != null) s += ` · ${fmtCost(u.cost)}`
  return s
})
</script>
