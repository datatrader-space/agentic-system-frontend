<template>
  <div class="flex flex-col rounded-2xl border border-[#E5E7EB] bg-white p-[18px] shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-base font-semibold text-[#0F172A]">Publish Controls</h2>
      <StatusBadge :status="badgeStatus" />
    </div>

    <dl class="mb-4 space-y-2 text-[13px]">
      <div class="flex items-center justify-between">
        <dt class="text-[#64748B]">Status</dt>
        <dd class="font-semibold capitalize text-[#0F172A]">{{ publish.status || 'draft' }}</dd>
      </div>
      <div class="flex items-center justify-between">
        <dt class="text-[#64748B]">Published</dt>
        <dd class="font-medium text-[#0F172A]">{{ publish.published_at ? ago(publish.published_at) : '—' }}</dd>
      </div>
      <div class="flex items-center justify-between">
        <dt class="text-[#64748B]">Unpublished changes</dt>
        <dd class="font-semibold" :class="publish.has_unpublished_changes ? 'text-amber-600' : 'text-emerald-600'">
          {{ publish.has_unpublished_changes ? 'Yes' : 'No' }}
        </dd>
      </div>
    </dl>

    <div class="mt-auto flex flex-wrap gap-2">
      <button
        v-if="publish.status !== 'published'"
        :disabled="busy"
        class="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50"
        @click="$emit('publish')"
      >
        <Rocket :size="15" :stroke-width="2.2" /> Publish
      </button>
      <button
        v-else
        :disabled="busy"
        class="inline-flex items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#0F172A] hover:bg-slate-50 disabled:opacity-50"
        @click="$emit('unpublish')"
      >
        <PauseCircle :size="15" :stroke-width="2.2" /> Unpublish
      </button>

      <button
        v-if="publish.status !== 'published' && publish.published_at"
        :disabled="busy"
        class="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50"
        @click="$emit('publish')"
      >
        <Rocket :size="15" :stroke-width="2.2" /> Republish
      </button>

      <button
        :disabled="busy || !publish.published_at"
        class="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-[13px] font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
        :title="publish.published_at ? 'Restore the last published snapshot' : 'No published snapshot to roll back to'"
        @click="$emit('rollback')"
      >
        <RotateCcw :size="15" :stroke-width="2.2" /> Rollback
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Rocket, PauseCircle, RotateCcw } from 'lucide-vue-next'
import StatusBadge from '../dashboard/StatusBadge.vue'
import { ago } from '../dashboard/time'

const props = defineProps({
  publish: { type: Object, default: () => ({}) },
  busy: { type: Boolean, default: false },
})
defineEmits(['publish', 'unpublish', 'rollback'])

const badgeStatus = computed(() => (props.publish.status === 'published' ? 'online' : 'offline'))
</script>
