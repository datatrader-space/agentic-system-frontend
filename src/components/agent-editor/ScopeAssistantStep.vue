<template>
  <!-- Staff-only step: grounding policy + convert to a system built-in + assign as the AI Assistant.
       Only rendered for is_staff users (AgentEditor gates it). Backend re-checks staff on every field. -->
  <div class="mx-auto w-full max-w-[900px] px-6 pb-8 font-[Inter,system-ui,sans-serif]">
    <div class="mb-4">
      <h2 class="text-[20px] font-bold tracking-tight text-[#0F172A]">Scope &amp; Assistant</h2>
      <p class="mt-0.5 text-[13.5px] text-[#64748B]">Staff-only controls: how strictly the agent must ground its answers, whether it becomes a system built-in, and whether it powers the product AI Assistant widget.</p>
    </div>

    <div v-if="!agent.id" class="rounded-xl border border-dashed border-[#E5E7EB] bg-[#FBFCFF] p-6 text-center text-[13px] text-[#64748B]">
      Save the agent first (give it a name and continue) — then you can set its scope.
    </div>

    <template v-else>
      <!-- Grounding policy -->
      <section class="mb-4 rounded-xl border border-[#E5E7EB] bg-white p-4">
        <h3 class="text-base font-semibold text-[#0F172A]">Answer grounding</h3>
        <p class="mb-3 text-[13px] text-[#64748B]">Controls the answer verifier's strictness.</p>
        <label v-for="o in POLICIES" :key="o.value" class="mb-2 flex cursor-pointer items-start gap-3 rounded-xl border p-3"
               :class="agent.answer_policy === o.value || (!agent.answer_policy && o.value === 'open') ? 'border-[#2563EB] bg-[#F5F8FF]' : 'border-[#E5E7EB]'">
          <input type="radio" class="mt-1" :value="o.value" v-model="agent.answer_policy" />
          <span><span class="block text-[13.5px] font-semibold text-[#0F172A]">{{ o.label }}</span>
            <span class="block text-[12px] text-[#667085]">{{ o.desc }}</span></span>
        </label>
      </section>

      <!-- Scope -->
      <section class="mb-4 rounded-xl border border-[#E5E7EB] bg-white p-4">
        <h3 class="text-base font-semibold text-[#0F172A]">Scope</h3>
        <p class="mb-3 text-[13px] text-[#64748B]">Who this agent belongs to. Anything other than <strong>Personal</strong> makes it a system-owned built-in (run-only, never shown in users' agent lists).</p>
        <label v-for="o in SCOPES" :key="o.value" class="mb-2 flex cursor-pointer items-start gap-3 rounded-xl border p-3"
               :class="scope === o.value ? 'border-[#2563EB] bg-[#F5F8FF]' : 'border-[#E5E7EB]'">
          <input type="radio" class="mt-1" :value="o.value" v-model="scope" />
          <span><span class="block text-[13.5px] font-semibold text-[#0F172A]">{{ o.label }}</span>
            <span class="block text-[12px] text-[#667085]">{{ o.desc }}</span></span>
        </label>

        <!-- Built-in details (shown for any non-Personal scope) -->
        <div v-if="scope !== 'personal'" class="mt-3 space-y-3 border-t border-[#F2F4F7] pt-4">
          <div class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
            Converting is one-way from here: the agent moves to the <strong>admin Built-in Agents</strong> console and leaves your normal agent list. Manage it there afterwards.
          </div>
          <label class="block">
            <span class="mb-1 block text-[12.5px] font-semibold text-[#334155]">Key <em class="text-red-500">*</em></span>
            <input v-model="form.builtin_key" placeholder="my-assistant" class="field"
                   @input="form.builtin_key = (form.builtin_key||'').toLowerCase()" />
            <span class="mt-1 block text-[11px] text-[#98A2B3]">Lowercase, hyphenated, unique (e.g. "help-assistant").</span>
          </label>
          <label class="flex items-center gap-2">
            <input type="checkbox" v-model="form.builtin_enabled" /> <span class="text-[13px] text-[#334155]">Enabled (exposed within its scope; needs instructions)</span>
          </label>
        </div>
      </section>

      <!-- AI Assistant slot -->
      <section class="mb-4 rounded-xl border border-[#E5E7EB] bg-white p-4">
        <h3 class="text-base font-semibold text-[#0F172A]">AI Assistant</h3>
        <p class="mb-3 text-[13px] text-[#64748B]">
          <span v-if="agent.is_assistant" class="font-semibold text-[#7C3AED]">This agent currently powers the AI Assistant widget.</span>
          <span v-else>Assign this agent to the product-wide AI Assistant widget.</span>
        </p>
        <label class="flex items-center gap-2" :class="{ 'opacity-50': !(isBuiltinScope && form.builtin_enabled) }">
          <input type="checkbox" v-model="form.set_as_assistant" :disabled="!(isBuiltinScope && form.builtin_enabled)" />
          <span class="text-[13px] text-[#334155]">Set as the AI Assistant</span>
        </label>
        <p v-if="!(isBuiltinScope && form.builtin_enabled)" class="mt-1 text-[11px] text-[#98A2B3]">Only an enabled system built-in can be the assistant — pick a non-Personal scope and enable it above first.</p>
      </section>

      <div class="flex items-center justify-end gap-3">
        <button class="btn-outline" @click="saveAnswerPolicy" :disabled="busy">Save grounding only</button>
        <button class="btn-primary" @click="apply" :disabled="busy || (isBuiltinScope && !form.builtin_key)">
          {{ busy ? 'Applying…' : (isBuiltinScope ? 'Convert & apply' : 'Apply') }}
        </button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { reactive, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import api from '../../services/api'
import { notify } from '@/composables/useNotify'

const props = defineProps({ agent: { type: Object, required: true } })
const router = useRouter()
const busy = ref(false)

const POLICIES = [
  { value: 'open', label: 'Open (default)', desc: 'Normal agent — answers freely, no grounding constraint.' },
  { value: 'kb_grounded_hybrid', label: 'Hybrid grounded', desc: 'General chat is fine, but product/platform/account claims must be cited or hedged — never fabricated.' },
  { value: 'grounded_kb_only', label: 'KB-only (strict)', desc: 'Refuses anything not supported by an attached knowledge source.' },
]

const SCOPES = [
  { value: 'personal', label: 'Personal', desc: 'A normal agent you own (default). Not a built-in.' },
  { value: 'admin', label: 'Admin only', desc: 'System built-in visible to admins only.' },
  { value: 'user', label: 'All users', desc: 'System built-in exposed to every signed-in user (run-only).' },
  { value: 'system', label: 'System-internal', desc: 'System built-in, never shown in any UI (e.g. the AI Assistant widget).' },
]

// Scope radio: 'personal' = normal agent; anything else = a system built-in with that visibility.
const scope = ref(props.agent.is_builtin_agent ? (props.agent.builtin_visibility || 'admin') : 'personal')

// Scope/assistant are an explicit action (not auto-saved) — converting is deliberate. answer_policy
// binds directly to the agent so the top-bar Save persists it too.
const form = reactive({
  builtin_key: props.agent.builtin_key || '',
  builtin_enabled: props.agent.builtin_enabled ?? true,
  set_as_assistant: false,
})
const isBuiltinScope = computed(() => scope.value !== 'personal')

async function saveAnswerPolicy() {
  busy.value = true
  try {
    await api.patch(`/agents/${props.agent.id}/`, { answer_policy: props.agent.answer_policy || 'open' })
    notify.success('Grounding policy saved')
  } catch (e) { notify.error(e?.response?.data?.detail || 'Could not save') }
  busy.value = false
}

async function apply() {
  busy.value = true
  const payload = { answer_policy: props.agent.answer_policy || 'open' }
  if (isBuiltinScope.value) {
    Object.assign(payload, {
      make_builtin: true,
      builtin_key: form.builtin_key,
      builtin_visibility: scope.value,   // 'admin' | 'user' | 'system'
      builtin_enabled: form.builtin_enabled,
      set_as_assistant: form.set_as_assistant,
    })
  }
  try {
    await api.patch(`/agents/${props.agent.id}/`, payload)
    if (isBuiltinScope.value) {
      notify.success('Converted to a system built-in — opening the admin console')
      router.push({ name: 'admin-builtin-agents' })
    } else {
      notify.success('Applied')
    }
  } catch (e) {
    const d = e?.response?.data
    notify.error(d?.builtin_key?.[0] || d?.tools?.[0] || d?.builtin_enabled?.[0] || d?.set_as_assistant?.[0] || d?.detail || 'Could not apply')
  }
  busy.value = false
}
</script>

<style scoped>
.field { width: 100%; border: 1px solid #D0D5DD; border-radius: 9px; padding: 9px 11px; font-size: 13px; color: #0F172A; background: #fff; outline: none; }
.field:focus { border-color: #2563EB; box-shadow: 0 0 0 3px #EAF0FF; }
.btn-primary { display: inline-flex; align-items: center; gap: 7px; border: 0; border-radius: 10px; background: #2563EB; padding: 9px 16px; font-size: 13px; font-weight: 700; color: #fff; cursor: pointer; }
.btn-primary:disabled { opacity: .5; cursor: not-allowed; }
.btn-outline { border: 1px solid #E5E7EB; border-radius: 10px; background: #fff; padding: 9px 14px; font-size: 13px; font-weight: 600; color: #344054; cursor: pointer; }
.btn-outline:disabled { opacity: .5; }
</style>
