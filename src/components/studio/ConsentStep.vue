<template>
  <section class="cst" role="group" :aria-labelledby="headingId" data-test="consent-step">
    <h2 :id="headingId">Confirm consent first</h2>
    <p class="st-muted">{{ request.message }}</p>
    <ul class="cst-files"><li v-for="file in request.files" :key="file.attachment_id">{{ file.name }}</li></ul>
    <blockquote class="cst-statement">{{ statement }}</blockquote>
    <label class="st-field">Name of the person shown or heard<input v-model="subjectName" class="st-input" maxlength="200" autocomplete="off" data-test="consent-name" /></label>
    <fieldset class="cst-basis"><legend>Who is it?</legend>
      <label><input v-model="basis" type="radio" value="self" name="consent-basis" data-test="consent-self" /> It is me</label>
      <label><input v-model="basis" type="radio" value="permission" name="consent-basis" data-test="consent-permission" /> Someone who gave me written permission</label>
    </fieldset>
    <label class="cst-agree"><input v-model="agreed" type="checkbox" data-test="consent-agree" /> I agree to the statement above</label>
    <p v-if="failure" class="st-error" role="alert">{{ failure }}</p>
    <div class="cst-actions"><button type="button" class="st-button" :disabled="saving" data-test="consent-cancel" @click="emit('cancel')">Cancel</button><button type="button" class="st-button primary" :disabled="saving || !subjectName.trim() || !basis || !agreed" data-test="consent-confirm" @click="confirm">{{ saving ? 'Saving…' : 'Confirm and continue' }}</button></div>
  </section>
</template>
<script setup>
import { computed, ref, useId } from 'vue'
import api from '../../services/api'
// Shown when the backend refuses a likeness job (a real face or voice) without consent. Nothing is pre-filled or
// pre-ticked; the statement is the backend's own, so the recorded version is the one the person read.
const props = defineProps({ request: { type: Object, required: true } })
const emit = defineEmits(['agreed','cancel'])
const headingId = `consent-${useId()}`, subjectName = ref(''), basis = ref(''), agreed = ref(false), saving = ref(false), failure = ref('')
const statement = computed(() => props.request.files.find(file => file.statement)?.statement || '')
async function confirm() {
  saving.value = true; failure.value = ''
  try {
    for (const file of props.request.files) await api.recordLikenessConsent({ attachment_id: file.attachment_id, subject_name: subjectName.value.trim(), basis: basis.value })
    emit('agreed')
  } catch (e) { failure.value = e.response?.data?.error?.message || 'Could not record the consent. Try again.' }
  finally { saving.value = false }
}
</script>
<style scoped>
.cst{display:grid;gap:12px;padding:14px;border:1px solid var(--vs-warn-line);border-radius:8px;background:var(--vm-surface-2)}.cst h2{font-size:14px}.cst p{font-size:13px;line-height:1.55}.cst-files{margin:0;padding-left:18px;font-size:13px;overflow-wrap:anywhere}.cst-statement{margin:0;padding:10px 12px;border-left:2px solid var(--vs-accent-ink);background:var(--vm-surface);font-size:13px;line-height:1.6;color:var(--vm-ink)}.cst-basis{display:grid;gap:8px;margin:0;padding:0;border:0;font-size:13px}.cst-basis legend{margin-bottom:6px;color:var(--vm-ink-soft)}.cst-basis label,.cst-agree{display:flex;align-items:flex-start;gap:8px;min-height:32px;font-size:13px;line-height:1.5;cursor:pointer}.cst input[type=radio],.cst input[type=checkbox]{width:18px;height:18px;margin-top:1px;flex-shrink:0}.cst-actions{display:flex;flex-wrap:wrap;gap:8px}.cst-actions .primary{flex:1}@media(max-width:767px){.cst-basis label,.cst-agree{min-height:44px}}
</style>
