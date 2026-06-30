<template>
  <div class="flex items-center gap-9 border-b border-[#DDE6F2]">
    <button
      v-for="t in tabs"
      :key="t.key"
      class="relative inline-flex h-11 items-center gap-1.5 px-0 text-[14px] font-bold transition-colors"
      :class="modelValue === t.key
        ? 'text-[#2563EB]'
        : 'text-[#52627A] hover:text-[#0F172A]'"
      @click="$emit('update:modelValue', t.key)"
    >
      {{ t.label }}
      <span
        v-if="modelValue === t.key"
        class="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-[#2563EB]"
      />
      <span
        v-if="t.count != null"
        class="sr-only"
      >{{ t.count }}</span>
    </button>
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: String, default: 'all' },
  tabs: { type: Array, required: true },   // [{ key, label, count }]
})
defineEmits(['update:modelValue'])
</script>
