<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" @click.self="close">
    <div class="w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]" role="dialog"
         aria-modal="true" aria-labelledby="secure-entry-title">
      <div class="flex items-start justify-between gap-3 px-5 pt-5">
        <div class="flex items-start gap-3 min-w-0">
          <span class="w-9 h-9 shrink-0 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <svg class="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="10" rx="2"/><path stroke-linecap="round" d="M8 11V7a4 4 0 118 0v4"/></svg>
          </span>
          <div class="min-w-0">
            <h3 id="secure-entry-title" class="text-[15px] font-bold text-ink leading-snug">
              {{ request ? request.title : 'Secure entry' }}
            </h3>
            <p v-if="request && request.status === 'pending'" class="text-[12px] text-ink-faint mt-0.5">
              {{ request.requested_by ? `Requested by ${request.requested_by}` : 'Requested by an agent' }} · {{ timeLeft }}
            </p>
          </div>
        </div>
        <button @click="close" class="text-slate-400 hover:text-slate-600 text-2xl leading-none" aria-label="Close">&times;</button>
      </div>

      <div class="px-5 py-4 overflow-y-auto">
        <p v-if="loading" class="py-6 text-center text-[13px] text-ink-faint">Loading…</p>

        <div v-else-if="loadError" class="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] text-red-700">
          {{ loadError }}
        </div>

        <template v-else-if="request && request.status === 'pending'">
          <div class="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3.5 py-2.5 text-[12px] text-emerald-800 leading-snug">
            What you type here goes straight to AADML and is stored encrypted. The agent that asked for it
            never sees it — it is only told whether you saved it.
          </div>

          <form class="mt-4 space-y-3" autocomplete="off" @submit.prevent="submit">
            <div v-for="f in request.fields" :key="f.name">
              <label :for="`se-${f.name}`" class="block text-[12px] font-semibold text-ink mb-1">
                {{ f.label }}<span v-if="f.required" class="text-red-500"> *</span>
              </label>
              <div class="relative">
                <textarea
                  v-if="f.multiline"
                  :id="`se-${f.name}`"
                  v-model="values[f.name]"
                  :placeholder="f.placeholder || ''"
                  rows="5"
                  spellcheck="false"
                  autocapitalize="off"
                  autocomplete="off"
                  :class="['w-full px-3 py-2 text-[12px] font-mono text-ink bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300', f.secret && !revealed[f.name] ? 'se-masked' : '']"
                ></textarea>
                <input
                  v-else
                  :id="`se-${f.name}`"
                  v-model="values[f.name]"
                  :type="f.secret && !revealed[f.name] ? 'password' : 'text'"
                  :placeholder="f.placeholder || ''"
                  spellcheck="false"
                  autocapitalize="off"
                  :autocomplete="f.secret ? 'new-password' : 'off'"
                  class="w-full px-3 py-2.5 pr-10 text-[13px] text-ink bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300"
                />
                <button
                  v-if="f.secret"
                  type="button"
                  class="absolute right-2 top-2 p-1 text-slate-400 hover:text-slate-600"
                  :aria-label="revealed[f.name] ? 'Hide value' : 'Show value'"
                  @click="revealed[f.name] = !revealed[f.name]"
                >
                  <svg v-if="revealed[f.name]" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
              </div>
            </div>

            <p v-if="submitError" class="text-[12px] text-red-600">{{ submitError }}</p>

            <div class="pt-1 flex items-center justify-between gap-2">
              <button type="button" @click="decline" :disabled="busy"
                      class="px-3 py-2 rounded-lg text-[13px] font-semibold text-ink-soft hover:bg-slate-100 disabled:opacity-50">
                Decline
              </button>
              <button type="submit" :disabled="busy || !canSubmit"
                      class="px-3.5 py-2 rounded-lg text-[13px] font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50">
                {{ busy ? 'Saving…' : 'Save securely' }}
              </button>
            </div>
          </form>
        </template>

        <div v-else-if="request" class="py-2 text-[13px] text-ink leading-relaxed">
          <p v-if="request.status === 'fulfilled'">
            Saved. You can go back to your agent — it will see that <strong>{{ request.subject }}</strong> is set up,
            but not what you entered.
          </p>
          <p v-else-if="request.status === 'declined'">You declined this request. Nothing was saved.</p>
          <p v-else-if="request.status === 'expired'">
            This link has expired and nothing was saved. Ask your agent for a new one.
          </p>
        </div>
      </div>

      <div v-if="!loading && !(request && request.status === 'pending')" class="px-5 pb-5 flex justify-end">
        <button @click="close" class="px-3.5 py-2 rounded-lg text-[13px] font-semibold text-ink-soft bg-slate-100 hover:bg-slate-200">
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
// Secure entry: an agent asked for a secret (an API key, a password, an OAuth client secret). The person
// types it here and it posts straight to AADML — the agent never receives it, only the request's status.
// Values live in this component's memory only until they are submitted or the modal closes.
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import api from '../../services/api'
import { notify } from '@/composables/useNotify'

const props = defineProps({
  requestId: { type: String, required: true },
})
const emit = defineEmits(['close', 'done'])

const loading = ref(true)
const loadError = ref('')
const request = ref(null)
const values = reactive({})
const revealed = reactive({})
const busy = ref(false)
const submitError = ref('')
const now = ref(Date.now())
let ticker = null

const canSubmit = computed(() => {
  const fields = request.value?.fields || []
  const required = fields.filter((f) => f.required)
  if (required.length) return required.every((f) => String(values[f.name] || '').trim())
  return fields.some((f) => String(values[f.name] || '').trim())
})

const timeLeft = computed(() => {
  const expires = Date.parse(request.value?.expires_at || '')
  if (!expires) return ''
  const minutes = Math.ceil((expires - now.value) / 60000)
  if (minutes <= 0) return 'expired'
  return minutes === 1 ? 'expires in 1 minute' : `expires in ${minutes} minutes`
})

function clearValues() {
  for (const key of Object.keys(values)) values[key] = ''
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const { data } = await api.getSecureEntry(props.requestId)
    request.value = data
    for (const f of data.fields || []) values[f.name] = ''
  } catch (e) {
    loadError.value = e?.response?.data?.error || 'This link could not be opened.'
  } finally {
    loading.value = false
  }
}

async function submit() {
  if (!canSubmit.value || busy.value) return
  busy.value = true
  submitError.value = ''
  const payload = {}
  for (const f of request.value.fields) {
    const v = String(values[f.name] || '')
    if (v.trim()) payload[f.name] = v
  }
  try {
    const { data } = await api.submitSecureEntry(props.requestId, payload)
    request.value = data
    clearValues()
    notify.success(`${data.subject} saved securely`)
    emit('done', data)
  } catch (e) {
    submitError.value = e?.response?.data?.error || 'Could not save. Nothing was stored — try again.'
    if (e?.response?.status === 409 || e?.response?.status === 404) {
      clearValues()
      await load()
    }
  } finally {
    busy.value = false
  }
}

async function decline() {
  busy.value = true
  try {
    const { data } = await api.declineSecureEntry(props.requestId)
    request.value = data
    clearValues()
  } catch (e) {
    submitError.value = e?.response?.data?.error || 'Could not decline this request.'
  } finally {
    busy.value = false
  }
}

function close() {
  clearValues()
  emit('close')
}

onMounted(() => {
  load()
  ticker = setInterval(() => { now.value = Date.now() }, 15000)
})
onUnmounted(() => {
  clearInterval(ticker)
  clearValues()
})
</script>

<style scoped>
/* A multi-line secret (a PEM key, a service-account JSON) is masked the way a password field is. */
.se-masked {
  -webkit-text-security: disc;
}
</style>
