<!--
  What runs this workflow now, before it is published (ADM-1351 phase 4; VISION_WORKFLOWS_PLAN.md 4.6). The builder's
  Publish asks the server first (composables/useWorkflowPublish.js); this dialog opens only when the person has to
  decide:

    * the server asks (`confirm`: a live stream uses the workflow): its message, what uses the workflow grouped by kind
      (name, version, state; "N more you cannot see" for what the server only counted) and its notes, with
      "Publish anyway" and Cancel;
    * the check failed: what went wrong, with Try again and Cancel. Nothing is published without the check.

    <WfPublishDialog :flow="publishFlow" />
-->
<template>
  <AppDialog :open="flow.state.open" :title="title" :description="description" size="md" @update:open="onOpen">
    <div class="wfb-root wfb-layer wfb-impact">
      <p v-if="phase === 'checking'" class="wfb-impact__status" role="status">
        <Icon icon="lucide:loader-circle" class="wf-spin" aria-hidden="true" />Checking what uses this workflow…
      </p>
      <template v-else-if="phase === 'error'">
        <p class="wfb-validate__error" role="alert">
          <Icon icon="lucide:circle-alert" aria-hidden="true" /><span>{{ flow.state.error }}</span>
        </p>
        <p class="wfb-field__help">Nothing was published. Publishing waits until the check works, so you see what uses this workflow first.</p>
      </template>
      <template v-else-if="impact">
        <section v-for="g in groups" :key="g.kind" class="wfb-impact__group" :aria-labelledby="`wfb-impact-${g.kind}`">
          <h3 :id="`wfb-impact-${g.kind}`" class="wfb-impact__h">
            <Icon :icon="g.icon" aria-hidden="true" /><span>{{ g.title }}</span><span class="wfb-impact__count">{{ g.count }}</span>
          </h3>
          <ul class="wfb-impact__list">
            <li v-for="item in g.items" :key="`${g.kind}-${item.id}`" class="wfb-impact__item">
              <span class="wfb-impact__name">{{ item.name || 'Unnamed' }}</span>
              <span v-if="item.version != null" class="wfb-impact__meta" :title="versionTitle(g.kind, item.version)"><span class="wf-sr">, </span>v{{ item.version }}</span>
              <span v-if="item.state" class="wfb-impact__meta"><span class="wf-sr">, </span>{{ impactStateLabel(item.state) }}</span>
            </li>
            <li v-if="g.hidden" class="wfb-impact__item is-hidden">
              <Icon icon="lucide:eye-off" aria-hidden="true" /><span>{{ hiddenLine(g.hidden) }}</span>
            </li>
          </ul>
        </section>
        <ul v-if="notes.length" class="wfb-impact__notes" aria-label="Notes">
          <li v-for="(n, i) in notes" :key="i"><Icon icon="lucide:info" aria-hidden="true" /><span>{{ n }}</span></li>
        </ul>
      </template>
    </div>
    <template #footer>
      <button type="button" class="wfb-btn" :disabled="phase === 'publishing'" @click="flow.cancel()">Cancel</button>
      <button v-if="phase === 'error' || phase === 'checking'" type="button" class="wfb-btn is-primary" :disabled="phase === 'checking'" @click="flow.retry()">
        {{ phase === 'checking' ? 'Checking…' : 'Try again' }}
      </button>
      <button v-else type="button" class="wfb-btn is-primary" :disabled="phase === 'publishing'" @click="flow.confirmPublish()">
        {{ phase === 'publishing' ? 'Publishing…' : 'Publish anyway' }}
      </button>
    </template>
  </AppDialog>
</template>

<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import AppDialog from '@/components/common/AppDialog.vue'
import { hiddenLine, impactGroups, impactStateLabel } from './wfPublishImpact'

const props = defineProps({
  // useWorkflowPublish(): { state: { open, phase, impact, error }, retry, confirmPublish, cancel }
  flow: { type: Object, required: true },
})

const phase = computed(() => props.flow.state.phase)
const impact = computed(() => props.flow.state.impact)
const groups = computed(() => impactGroups(impact.value))
const notes = computed(() => (Array.isArray(impact.value?.notes) ? impact.value.notes.filter(Boolean) : []))
const title = computed(() => (phase.value === 'error' || phase.value === 'checking' ? 'Publish: check what uses this workflow' : 'Publish this workflow?'))
const description = computed(() => (phase.value === 'error' || phase.value === 'checking' ? '' : impact.value?.message || ''))

// A stream or batch keeps the version it started with; a parent workflow runs this one from its published version.
function versionTitle(kind, version) {
  if (kind === 'stream') return `Started with version ${version}; it keeps it until it is restarted.`
  if (kind === 'batch') return `Started with version ${version}; it keeps it until it ends.`
  return `Version ${version}`
}

function onOpen(open) { if (!open) props.flow.cancel() }
</script>
