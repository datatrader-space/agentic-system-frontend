<!--
  "Trust this server's certificate" (ADM-1374). Shown to a connection's owner when Test connection failed because AADML
  does not trust the certificate the server presents (self-signed, a company CA, or one that changed since it was
  trusted). It shows who the certificate is for and from, and the SHA-256 fingerprint to compare with the one the
  database's administrator or provider gives. Trusting asks once more, then the server's certificate is read again
  and pinned only if it still has this fingerprint; the connection then trusts only it.
-->
<template>
  <div class="dco" role="region" :aria-label="`The certificate of ${name}`">
    <p class="dco-title">
      <Icon icon="lucide:shield-alert" aria-hidden="true" />
      <span><strong>AADML does not trust this server's certificate.</strong> {{ certificate.why }}</span>
    </p>
    <p v-if="certificate.changed_from" class="dco-changed">
      You trusted <code translate="no">{{ certificate.changed_from }}</code>. If the server's certificate was renewed on purpose, check the new one and trust it.
    </p>

    <dl class="dco-rows">
      <template v-for="row in serverRows" :key="row.label">
        <dt>{{ row.label }}</dt><dd>{{ row.value }}</dd>
      </template>
    </dl>

    <template v-if="certificate.pinnable">
      <p class="dco-label">
        {{ ownCertificate ? 'SHA-256 fingerprint of the server\'s certificate' : `SHA-256 fingerprint of the authority the server sends (${certificate.pin?.issued_to || 'its root'})` }}
      </p>
      <div class="dco-fp-row">
        <code class="dco-fp" translate="no">{{ certificate.fingerprint }}</code>
        <button type="button" class="tp-btn tp-btn--icon" :aria-label="copied ? 'Copied' : 'Copy the fingerprint'" :title="copied ? 'Copied' : 'Copy'" @click="copy">
          <Icon :icon="copied ? 'lucide:check' : 'lucide:copy'" aria-hidden="true" />
        </button>
      </div>
      <p class="dco-note">{{ certificate.scope }}</p>
      <p class="dco-note">
        Trust it only if this fingerprint matches the one your database's administrator or provider gives you. On the server:
        <code translate="no">openssl x509 -noout -fingerprint -sha256 -in {{ ownCertificate ? 'server-cert.pem' : 'ca.pem' }}</code>
      </p>
      <div class="dco-actions">
        <button type="button" class="tp-btn tp-btn--primary" :disabled="busy" @click="trust">
          <Icon :icon="busy ? 'lucide:loader-circle' : 'lucide:shield-check'" :class="{ spin: busy }" aria-hidden="true" />{{ busy ? 'Checking the server…' : 'Trust this certificate' }}
        </button>
        <button type="button" class="tp-btn" :disabled="busy" @click="emit('dismiss')">Not now</button>
      </div>
    </template>
    <p v-else class="dco-note dco-reason"><Icon icon="lucide:info" aria-hidden="true" /><span>{{ certificate.reason }}</span></p>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import api from '@/services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import { certificateRows, connectionErrorText, pinsServerCertificate } from './databaseConnectionForm'

const props = defineProps({
  connectionId: { type: [String, Number], required: true },
  name: { type: String, default: 'this connection' },
  // The failed test's `certificate` ({ chain, why, pinnable, reason, fingerprint, pin, scope, changed_from }).
  certificate: { type: Object, required: true },
})
// trusted(connection): the pin is saved (the connection's projection); changed(certificate): the server now shows
// another certificate, here it is; dismiss: "Not now".
const emit = defineEmits(['trusted', 'changed', 'dismiss'])

const busy = ref(false)
const copied = ref(false)
const ownCertificate = computed(() => pinsServerCertificate(props.certificate))
const serverRows = computed(() => certificateRows(props.certificate?.chain?.[0]))

async function copy() {
  try {
    await navigator.clipboard.writeText(props.certificate.fingerprint)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    notify.error('The fingerprint could not be copied: select it and copy it.')
  }
}

async function trust() {
  const ok = await confirm({
    title: 'Trust this certificate?',
    message: `SHA-256 fingerprint:\n${props.certificate.fingerprint}\n\n${props.certificate.scope}\n\nAADML reads the server's certificate again and trusts it only if it still has this fingerprint.`,
    confirmText: 'Trust certificate',
  })
  if (!ok) return
  busy.value = true
  try {
    const { data } = await api.trustDatabaseCertificate(props.connectionId, props.certificate.fingerprint)
    notify.success(`${props.name}: the server's certificate is trusted`)
    emit('trusted', data?.connection)
  } catch (e) {
    const body = e?.response?.data
    if (e?.response?.status === 409 && body?.certificate) emit('changed', body.certificate)
    notify.error(connectionErrorText(e, 'The certificate was not trusted'))
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.dco { display: grid; gap: 8px; padding: 12px; border: 1px solid var(--vm-amber-soft); border-radius: 10px; background: var(--vm-surface-soft); font-size: 12px; line-height: 1.5; color: var(--vm-ink-soft); min-width: 0; }
.dco :deep(svg) { width: 14px; height: 14px; flex-shrink: 0; }
.dco-title { display: flex; gap: 8px; align-items: flex-start; margin: 0; padding: 8px 10px; border-radius: 6px; background: var(--vm-amber-soft); color: var(--vm-amber-ink); }
.dco-title :deep(svg) { margin-top: 2px; }
.dco-changed { margin: 0; overflow-wrap: anywhere; }
.dco-rows { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 2px 12px; margin: 0; }
.dco-rows dt { color: var(--vm-ink-faint); }
.dco-rows dd { margin: 0; color: var(--vm-ink); overflow-wrap: anywhere; }
.dco-label { margin: 4px 0 0; font-weight: 600; color: var(--vm-ink); }
.dco-fp-row { display: flex; gap: 6px; align-items: center; min-width: 0; }
.dco-fp { flex: 1 1 auto; min-width: 0; padding: 6px 8px; border: 1px solid var(--vm-line); border-radius: 6px; background: var(--vm-surface); font: 12px/1.5 var(--vm-font-mono, ui-monospace, monospace); color: var(--vm-ink); overflow-wrap: anywhere; user-select: all; }
.dco-note { margin: 0; overflow-wrap: anywhere; }
.dco-note code, .dco-changed code { padding: 1px 4px; border-radius: 4px; background: var(--vm-surface); font: 11px var(--vm-font-mono, ui-monospace, monospace); color: var(--vm-ink); }
.dco-reason { display: flex; gap: 8px; align-items: flex-start; }
.dco-reason :deep(svg) { margin-top: 2px; }
.dco-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.spin { animation: dco-spin 1s linear infinite; }
@keyframes dco-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
</style>
