<template>
  <!-- The person's approval (never an agent's): a rights basis for a brand, product or character (the IP check), and
       a real person's consent when the Element shows or voices one. -->
  <form class="ea" :aria-label="`Approve ${element.name}`" data-test="el-approve-form" @submit.prevent="approve">
    <ElementRightsFields v-model="fields" :kind="element.kind" :name="element.name" :has-sample="hasSample" :schema="schema" />
    <p v-if="!needsRights && !realPerson" class="ea-note">A {{ element.kind }} needs no rights statement. Approving lets it be used in videos, batches and agent runs.</p>
    <p v-if="error" class="ea-error" role="alert">{{ error.message }}</p>
    <div class="ea-actions">
      <button type="submit" class="ea-btn primary" :disabled="!ready || busy" data-test="ea-submit">{{ busy ? 'Approving…' : 'Approve' }}</button>
      <button type="button" class="ea-btn" @click="emit('cancel')">Cancel</button>
    </div>
  </form>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useVideoStore } from '../../stores/useVideoStore'
import ElementRightsFields from './ElementRightsFields.vue'
import { RIGHTS_KINDS, rightsComplete, rightsPayload } from './elementKinds'

const props = defineProps({ element: { type: Object, required: true }, schema: { type: Object, default: null } })
const emit = defineEmits(['done', 'cancel'])
const video = useVideoStore()
const current = props.element.rights || null
const fields = ref({ basis: current?.basis || '', rightsConfirmed: false, realPerson: !!current?.likeness,
                     subject: current?.subject_name || '', consentBasis: current?.consent_basis || '', consentConfirmed: false })
const busy = ref(false), error = ref(null)
const needsRights = computed(() => RIGHTS_KINDS.includes(props.element.kind))
const hasSample = computed(() => props.element.kind === 'voice' && (props.element.files || []).some(f => f.media_type === 'audio'))
const realPerson = computed(() => hasSample.value || (props.element.kind === 'character' && fields.value.realPerson))
const ready = computed(() => rightsComplete(props.element.kind, fields.value, { hasSample: hasSample.value }))
async function approve() {
  busy.value = true; error.value = null
  const body = rightsPayload(props.element.kind, fields.value, { hasSample: hasSample.value, hadLikeness: !!current?.likeness })
  const { row, error: refused } = await video.approveIngredient(props.element.ingredient_id, body)
  busy.value = false
  if (row) emit('done', row)
  else error.value = refused
}
</script>

<style scoped>
.ea { display: grid; gap: 10px; padding: 12px; border: 1px solid var(--vm-line, #e5e7eb); border-radius: 8px; background: var(--vm-surface-2, #f8fafc); }
.ea-note { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--vm-ink-soft, #64748b); }
.ea-error { margin: 0; font-size: 13px; color: var(--vs-bad-ink, #b91c1c); }
.ea-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.ea-btn { min-height: 36px; padding: 0 12px; border: 1px solid var(--vm-line, #e5e7eb); border-radius: 6px; background: transparent; color: var(--vm-ink, #0f172a);
  font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; }
.ea-btn.primary { background: var(--vm-violet-d, #4f46e5); color: #fff; border-color: transparent; font-weight: 600; }
.ea-btn:disabled { opacity: .45; cursor: not-allowed; }
.ea :focus-visible { outline: 2px solid var(--vm-violet, #4f46e5); outline-offset: 2px; }
@media (pointer: coarse) { .ea-btn { min-height: 44px; } }
</style>
