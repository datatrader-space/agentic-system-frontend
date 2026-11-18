<template>
  <!-- An Element the agent saved as a draft, approved by the person in the chat (backend ADS_CHAT_FLOW_PLAN.md): its
       files, the rights statement and, for a real person, their consent, as on the Elements page. The answer goes back
       over the person's own chat socket; the server approves it with exactly these fields. -->
  <div class="eac" data-test="element-approval">
    <div class="eac-head">
      <ul v-if="card.files?.length" class="eac-files" aria-label="Its files">
        <li v-for="file in card.files" :key="file.attachment_id">
          <img v-if="file.thumbnail_url" :src="file.thumbnail_url" :alt="file.title || card.name" loading="lazy" />
          <span v-else class="eac-file-kind">{{ file.media_type }}</span>
        </li>
      </ul>
      <div class="eac-name">
        <strong>{{ card.name }}</strong>
        <span class="eac-kind">{{ kindLabel }}<template v-if="card.token"> {{ card.token }}</template></span>
      </div>
    </div>
    <p v-if="card.error" class="eac-error" role="alert" data-test="element-approval-error">{{ card.error }}</p>
    <ElementRightsFields v-model="rights" :kind="card.kind" :name="card.name" :has-sample="!!card.likeness?.required" :schema="schema" />
    <p v-if="!ready" class="eac-needs" role="status" data-test="element-approval-needs">{{ needs }}</p>
    <div class="eac-actions">
      <button type="button" class="eac-btn eac-btn--approve" :disabled="!ready || disabled" data-test="element-approve" @click="approve">Approve {{ card.name }}</button>
      <button type="button" class="eac-btn" :disabled="disabled" data-test="element-decline" @click="emit('decline')">Not now</button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import ElementRightsFields from './ElementRightsFields.vue'
import { KINDS, RIGHTS_KINDS, emptyRights, rightsComplete, rightsPayload } from './elementKinds'

const props = defineProps({ card: { type: Object, required: true }, disabled: { type: Boolean, default: false } })
const emit = defineEmits(['approve', 'decline'])
const rights = ref(emptyRights())
watch(() => props.card?.element_id, () => { rights.value = emptyRights() })

const kindLabel = computed(() => KINDS.find(k => k.value === props.card.kind)?.label || props.card.kind)
// The card carries the statements the server versions and records; the rights fields read them from `schema`.
const schema = computed(() => ({ statements: { rights: props.card.rights, likeness: props.card.likeness } }))
const hasSample = computed(() => !!props.card.likeness?.required)
const ready = computed(() => rightsComplete(props.card.kind, rights.value, { hasSample: hasSample.value }))
const needs = computed(() => (RIGHTS_KINDS.includes(props.card.kind) && !(rights.value.basis && rights.value.rightsConfirmed))
  ? 'Choose the basis of your rights and confirm the statement to approve it.'
  : 'Name the person shown or heard, choose the basis and confirm the statement to approve it.')

function approve() {
  if (!ready.value || props.disabled) return
  emit('approve', { approved: true, ...rightsPayload(props.card.kind, rights.value, { hasSample: hasSample.value }) })
}
</script>

<style scoped>
.eac { display: grid; gap: 12px; }
.eac-head { display: flex; align-items: center; gap: 12px; min-width: 0; }
.eac-files { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
.eac-files li { width: 48px; height: 48px; border-radius: 8px; overflow: hidden; border: 1px solid var(--vm-line, #e5e7eb);
  background: var(--vm-surface-2, var(--vm-surface, #f8fafc)); display: grid; place-items: center; }
.eac-files img { width: 100%; height: 100%; object-fit: cover; display: block; }
.eac-file-kind { font-size: 11px; color: var(--vm-ink-soft, #475569); }
.eac-name { display: grid; gap: 2px; min-width: 0; }
.eac-name strong { font-size: 14px; color: var(--vm-ink, #0f172a); overflow-wrap: anywhere; }
.eac-kind { font-size: 12.5px; color: var(--vm-ink-soft, #475569); overflow-wrap: anywhere; }
.eac-error { margin: 0; padding: 8px 10px; border-radius: 6px; font-size: 13px; line-height: 1.5;
  color: var(--vm-red-ink, #b91c1c); background: var(--vm-red-soft, rgba(185, 28, 28, 0.08)); }
.eac-needs { margin: 0; font-size: 12.5px; color: var(--vm-ink-soft, #475569); }
.eac-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.eac-btn { min-height: 40px; padding: 8px 14px; border-radius: 8px; border: 1px solid var(--vm-line, #e5e7eb);
  background: var(--vm-surface, #fff); color: var(--vm-ink, #0f172a); font: inherit; font-size: 13.5px; font-weight: 500;
  cursor: pointer; transition: background-color 150ms ease, border-color 150ms ease; max-width: 100%; overflow-wrap: anywhere; }
.eac-btn:hover:not(:disabled) { border-color: var(--vm-ink-faint); }
.eac-btn--approve { background: var(--vm-primary); border-color: var(--vm-primary); color: #fff; }  /* the card's own Approve */
.eac-btn--approve:hover:not(:disabled) { background: var(--vm-primary-d); }
.eac-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.eac-btn:focus-visible { outline: 2px solid var(--vm-focus, var(--vm-violet, #4f46e5)); outline-offset: 2px; }
@media (pointer: coarse) { .eac-btn { min-height: 44px; } }
@media (prefers-reduced-motion: reduce) { .eac-btn { transition: none; } }
</style>
