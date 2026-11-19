<script setup>
// Accepting the Terms and the Privacy Policy before a person first connects a camera or starts a stream (backend
// streaming_terms.py; the owner, 2026-11-19). The server refuses those with 428 terms_required until this is accepted,
// so this window is how a person gets past it, never a way around it. Both documents open in a new tab.
import { ref, watch } from 'vue';
import { ExternalLink, ShieldCheck } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiDialog from './UiDialog.vue';
import { termsApi } from '../api/streaming.js';

const props = defineProps({ open: Boolean, terms: { type: Object, default: null } });
const emit = defineEmits(['close', 'accepted']);
const agree = ref(false); const busy = ref(false); const error = ref('');
watch(() => props.open, open => { if (open) { agree.value = false; error.value = ''; } });

async function accept() {
  if (!agree.value || busy.value) return;
  busy.value = true; error.value = '';
  try {
    const answer = await termsApi.accept(props.terms?.version || '');
    emit('accepted', answer?.terms || { ...props.terms, accepted: true });
  } catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}
</script>

<template>
  <UiDialog :open="open" title="Before you connect cameras" @close="emit('close')">
    <div class="st-terms">
      <p class="st-terms-lead"><ShieldCheck :size="18" aria-hidden="true"/> Cloud Streaming films people. Read how it may be used, then accept to go on. You are asked once.</p>
      <ul v-if="terms && terms.summary && terms.summary.length" class="st-terms-points">
        <li v-for="(point, i) in terms.summary" :key="i">{{ point }}</li>
      </ul>
      <p class="st-terms-links">
        <a :href="(terms && terms.terms_url) || '/terms'" target="_blank" rel="noopener">Terms of Service, section 6 <ExternalLink :size="13" aria-hidden="true"/></a>
        <a :href="(terms && terms.privacy_url) || '/privacy'" target="_blank" rel="noopener">Privacy Policy <ExternalLink :size="13" aria-hidden="true"/></a>
      </p>
      <label class="st-terms-agree">
        <input v-model="agree" type="checkbox" aria-describedby="st-terms-error">
        <span>I have read and accept the Terms of Service (section 6, Cameras, video and recordings) and the Privacy Policy, and I will use Cloud Streaming only as they allow.</span>
      </label>
      <p v-if="error" id="st-terms-error" class="field-error" role="alert">{{ error }}</p>
      <div class="dialog-actions">
        <UiButton @click="emit('close')">Cancel</UiButton>
        <UiButton variant="primary" :disabled="!agree || busy" @click="accept">{{ busy ? 'Saving…' : 'Accept and continue' }}</UiButton>
      </div>
    </div>
  </UiDialog>
</template>

<style scoped>
.st-terms{display:flex;flex-direction:column;gap:12px;max-width:560px}
.st-terms-lead{display:flex;gap:8px;align-items:flex-start;margin:0;color:#24324a;font-size:14px}
.st-terms-lead svg{flex-shrink:0;margin-top:2px;color:var(--aadml-primary,#2563eb)}
.st-terms-points{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px;color:#33415a;font-size:14px;line-height:1.5}
.st-terms-links{display:flex;flex-wrap:wrap;gap:16px;margin:0;font-size:14px}
.st-terms-links a{display:inline-flex;align-items:center;gap:4px;color:var(--aadml-primary,#2563eb);text-decoration:underline}
.st-terms-agree{display:flex;gap:10px;align-items:flex-start;padding:12px;border:1px solid #d4d9e3;border-radius:10px;background:#f8fafc;font-size:14px;line-height:1.5;color:#162139;cursor:pointer}
.st-terms-agree input{margin-top:3px;width:18px;height:18px;flex-shrink:0}
</style>
