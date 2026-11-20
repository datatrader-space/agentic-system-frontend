<template>
  <!-- A share link (ADM-1248): the server checks the link (revoked, expired, for this workspace only) and records who
       opened it; then the project opens. Editors go to the project's workspace, everyone else to its review. -->
  <section class="vss" aria-labelledby="vss-title" data-test="video-studio-share">
    <div class="vss-card">
      <h1 id="vss-title">{{ heading }}</h1>
      <p v-if="state === 'loading'" role="status">Checking the link…</p>
      <template v-else-if="state === 'error'">
        <p role="alert" data-test="vss-error">{{ message }}</p>
        <div class="vss-actions">
          <router-link :to="{ name: 'video-studio-projects' }" class="vss-btn primary">Go to your projects</router-link>
          <button v-if="retryable" type="button" class="vss-btn" @click="redeem">Try again</button>
        </div>
      </template>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { errorCode, errorText, sharing } from '../services/studioSharing'

const props = defineProps({ token: { type: String, required: true } })
const router = useRouter()
const state = ref('loading'), message = ref(''), code = ref('')
const MESSAGES = {
  link_revoked: 'This link was revoked by the project’s owner or a manager. Ask them for a new one.',
  link_expired: 'This link has expired. Ask the person who shared it for a new one.',
  link_not_for_you: 'This link works only for people in the project’s workspace. Ask to be added to the workspace, or for a link that anyone signed in can use.',
  not_found: 'This link does not exist. Check that it was copied in full.',
}
const heading = computed(() => (state.value === 'error' ? 'This link cannot be opened' : 'Opening a shared project'))
const retryable = computed(() => !MESSAGES[code.value])
async function redeem() {
  state.value = 'loading'
  try {
    const { data } = await sharing.redeem(props.token)
    const editing = ['editor', 'manager', 'owner'].includes(data.role)
    await router.replace(editing
      ? { name: 'video-studio-dashboard', query: { project: data.project_id } }
      : { name: 'video-studio-project-room', params: { projectId: data.project_id, tab: 'review' } })
  } catch (e) {
    code.value = errorCode(e)
    message.value = MESSAGES[code.value] || errorText(e, 'The link could not be checked. Please try again.')
    state.value = 'error'
  }
}
onMounted(redeem)
</script>

<style scoped>
.vss{display:grid;place-items:center;min-height:100%;padding:32px 16px;box-sizing:border-box;color:var(--vm-ink)}
.vss-card{display:grid;gap:14px;width:min(480px,100%);padding:28px;border:1px solid var(--vm-line);border-radius:12px;background:var(--vm-surface)}
.vss h1{margin:0;font-size:22px;font-weight:550;letter-spacing:-.02em}.vss p{margin:0;font-size:14px;line-height:1.7;color:var(--vm-ink-soft)}
.vss-actions{display:flex;flex-wrap:wrap;gap:8px}
.vss-btn{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border:1px solid var(--vm-line);border-radius:6px;background:transparent;color:var(--vm-ink);font:inherit;font-size:13px;font-weight:500;text-decoration:none;cursor:pointer}
.vss-btn.primary{background:var(--vm-violet-d);border-color:transparent;color:#fff}.vss-btn:hover{background:var(--vm-surface-2)}.vss-btn.primary:hover{background:var(--vm-violet)}
</style>
