<template>
  <details class="scn" data-test="studio-consents" @toggle="onToggle">
    <!-- The person's likeness consents still in force (ADM-1170: they could be recorded but never revoked from a
         screen). Revoking stops the file being used to show or voice that person; it can be recorded again later. -->
    <summary>Consents for faces and voices<span v-if="loaded" class="scn-count">{{ rows.length }}</span></summary>
    <p class="scn-lead">Each file below may be used to show or voice the person named. Revoke one to stop that.</p>
    <p v-if="loading" class="scn-note" role="status">Loading your consents…</p>
    <p v-else-if="error" class="scn-note" role="alert">{{ error }} <button type="button" class="scn-btn" @click="load">Try again</button></p>
    <p v-else-if="loaded && !rows.length" class="scn-note">No consents in force.</p>
    <ul v-if="rows.length" class="scn-list">
      <li v-for="row in rows" :key="row.attachment_id" class="scn-row" :data-test="`consent-${row.attachment_id}`">
        <span class="scn-what"><strong>{{ row.subject_name }}</strong><small>{{ row.file_name || 'A file' }} · {{ row.basis === 'self' ? 'It is them' : 'Written permission' }} · {{ day(row.agreed_at) }}</small></span>
        <template v-if="confirming === row.attachment_id">
          <button type="button" class="scn-btn danger" data-test="consent-revoke-confirm" :disabled="busy" @click="revoke(row)">Revoke</button>
          <button type="button" class="scn-btn" :disabled="busy" @click="confirming = ''">Keep</button>
        </template>
        <button v-else type="button" class="scn-btn" data-test="consent-revoke" :aria-label="`Revoke consent for ${row.subject_name}`" @click="confirming = row.attachment_id">Revoke</button>
      </li>
    </ul>
  </details>
</template>

<script setup>
import { ref } from 'vue'
import api from '../../services/api'

const rows = ref([]), loading = ref(false), loaded = ref(false), error = ref(''), confirming = ref(''), busy = ref(false)
const day = iso => { try { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso)) } catch { return '' } }
async function load() {
  loading.value = true; error.value = ''
  try { rows.value = (await api.listLikenessConsents()).data?.consents || []; loaded.value = true }
  catch { error.value = 'Your consents could not be loaded.' }
  finally { loading.value = false }
}
// Read when opened, not on every visit to the Library.
function onToggle(event) { if (event.target.open && !loaded.value && !loading.value) load() }
async function revoke(row) {
  busy.value = true; error.value = ''
  try {
    await api.revokeLikenessConsent(row.attachment_id)
    rows.value = rows.value.filter(r => r.attachment_id !== row.attachment_id); confirming.value = ''
  } catch { error.value = 'That consent could not be revoked. Try again.' }
  finally { busy.value = false }
}
defineExpose({ load })
</script>

<style scoped>
.scn { flex: none; border: 1px solid var(--vm-line); border-radius: 11px; background: var(--vm-surface); color: var(--vm-ink); }
.scn summary { display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 0 16px; font-size: 13px; font-weight: 600; cursor: pointer; }
.scn summary:focus-visible { outline: 2px solid var(--vs-accent-ink); outline-offset: -2px; }
.scn-count { padding: 1px 7px; border-radius: 10px; background: var(--vm-surface-2); color: var(--vm-ink-soft); font-size: 11px; }
.scn-lead, .scn-note { margin: 0; padding: 0 16px 12px; font-size: 12.5px; line-height: 1.6; color: var(--vm-ink-soft); }
.scn-list { display: grid; gap: 0; margin: 0; padding: 0 0 8px; list-style: none; }
.scn-row { display: flex; align-items: center; gap: 8px; min-height: 52px; padding: 6px 16px; border-top: 1px solid var(--vm-line-2); }
.scn-what { display: grid; flex: 1; gap: 2px; min-width: 0; font-size: 13px; }
.scn-what small { overflow: hidden; color: var(--vm-ink-soft); font-size: 11.5px; text-overflow: ellipsis; white-space: nowrap; }
.scn-btn { flex: none; min-height: 44px; padding: 0 14px; border: 1px solid var(--vm-line); border-radius: 7px; background: transparent; color: inherit; font: inherit; font-size: 12.5px; cursor: pointer; }
.scn-btn.danger { border-color: var(--vs-bad-ink); color: var(--vs-bad-ink); }
.scn-btn:disabled { opacity: .55; cursor: not-allowed; }
.scn-btn:focus-visible { outline: 2px solid var(--vs-accent-ink); outline-offset: 2px; }
</style>
