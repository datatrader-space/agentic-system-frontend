<template>
  <!-- One project, worked on together (ADM-1248): its review (comments and approvals), its shared canvas and, for its
       managers, who spent what on it. Every action is checked again by the server. -->
  <section class="vpr" aria-labelledby="vpr-title" data-test="project-room">
    <header class="vpr-head">
      <router-link :to="{ name: 'video-studio-projects' }" class="vpr-back">Projects</router-link>
      <div class="vpr-title-row">
        <h1 id="vpr-title">{{ project ? project.title || 'Untitled video' : 'Project' }}</h1>
        <span v-if="project" class="vpr-role" data-test="room-role">{{ project.my_role === 'owner' ? 'Your project' : `${project.owner?.name ? project.owner.name + '’s project, ' : ''}you are ${roleWord}` }}</span>
      </div>
      <div v-if="project" class="vpr-actions">
        <label v-if="can.review" class="vpr-status"><span>Review status</span>
          <select :value="project.review_status || 'none'" :disabled="statusBusy" data-test="room-review-status" @change="setStatus($event.target.value)">
            <option v-for="(label, k) in REVIEW_LABELS" :key="k" :value="k">{{ label }}</option></select></label>
        <span v-else-if="project.review_status && project.review_status !== 'none'" class="vpr-badge" :class="project.review_status">{{ REVIEW_LABELS[project.review_status] }}</span>
        <button type="button" class="vpr-btn" data-test="room-share" @click="shareOpen = true">{{ can.manage ? 'Share' : 'Who has access' }}</button>
        <router-link v-if="can.edit" :to="{ name: 'video-studio-dashboard', query: { project: project.project_id } }" class="vpr-btn primary">Open in the Studio</router-link>
      </div>
      <p v-if="statusError" class="vpr-bad" role="alert">{{ statusError }}</p>
    </header>

    <p v-if="loading" class="vpr-note" role="status">Opening the project…</p>
    <div v-else-if="error" class="vpr-note" role="alert"><p class="vpr-bad">{{ error }}</p><router-link :to="{ name: 'video-studio-projects' }" class="vpr-btn">Back to projects</router-link></div>
    <template v-else-if="project">
      <nav class="vpr-tabs" aria-label="Project views">
        <router-link v-for="t in tabs" :key="t.value" :to="{ name: 'video-studio-project-room', params: { projectId, tab: t.value } }" class="vpr-tab" :class="{ on: current === t.value }" :aria-current="current === t.value ? 'page' : undefined" :data-test="`room-tab-${t.value}`">{{ t.label }}</router-link>
      </nav>
      <ProjectReviewPanel v-if="current === 'review'" :project-id="projectId" :abilities="can" :targets="targets" :initial-target="initialTarget" />
      <ProjectCanvas v-else-if="current === 'canvas'" :project-id="projectId" :can-edit="!!can.edit" :scenes="sceneList" />
      <section v-else-if="current === 'usage'" class="vpr-usage" aria-label="Spend on this project">
        <p v-if="usageError" class="vpr-bad" role="alert">{{ usageError }}</p>
        <p v-else-if="!usage" class="vpr-note" role="status">Loading spend…</p>
        <template v-else>
          <p class="vpr-note">Each person pays for what they make on this project from their own balance.</p>
          <table class="vpr-table"><caption class="vpr-sr">Spend on this project by person</caption>
            <thead><tr><th scope="col">Person</th><th scope="col">Renders</th><th scope="col">Spent</th></tr></thead>
            <tbody><tr v-for="m in usage.members" :key="m.user.id"><th scope="row">{{ m.user.name }}</th><td>{{ m.jobs }}</td><td>{{ money(m.spent_usd) }}</td></tr>
              <tr v-if="!usage.members.length"><td colspan="3">Nothing was spent on this project yet.</td></tr></tbody>
            <tfoot><tr><th scope="row">Total</th><td></td><td>{{ money(usage.total_usd) }}</td></tr></tfoot>
          </table>
        </template>
      </section>
    </template>
    <ProjectShareDialog :open="shareOpen" :project-id="projectId" :title="project ? project.title : ''" @close="shareOpen = false" @changed="load" />
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../services/api'
import ProjectReviewPanel from '../components/studio/ProjectReviewPanel.vue'
import ProjectShareDialog from '../components/studio/ProjectShareDialog.vue'
import { lazyComponent } from '../utils/lazyComponent'
import { REVIEW_LABELS, ROLE_LABELS, errorText, money, sharing } from '../services/studioSharing'
// Yjs loads only with the canvas.
const ProjectCanvas = lazyComponent(() => import('../components/studio/ProjectCanvas.vue'))

const props = defineProps({ projectId: { type: String, required: true }, tab: { type: String, default: '' } })
const route = useRoute()
const project = ref(null), loading = ref(true), error = ref(''), shareOpen = ref(false)
const versions = ref([]), usage = ref(null), usageError = ref(''), statusBusy = ref(false), statusError = ref('')
const can = computed(() => project.value?.abilities || {})
const roleWord = computed(() => String(ROLE_LABELS[project.value?.my_role] || 'viewer').toLowerCase())
const tabs = computed(() => [{ value: 'review', label: 'Review' }, { value: 'canvas', label: 'Canvas' }, ...(can.value.usage ? [{ value: 'usage', label: 'Spend' }] : [])])
const current = computed(() => (tabs.value.some(t => t.value === props.tab) ? props.tab : 'review'))
const sceneList = computed(() => (project.value?.scenes || []).map((s, i) => ({ scene_id: s.scene_id || s.id, title: s.title || `Scene ${i + 1}` })))
const targets = computed(() => [
  ...sceneList.value.map((s, i) => ({ type: 'scene', id: String(s.scene_id), label: `Scene ${i + 1}: ${s.title}` })),
  ...versions.value.map(v => ({ type: 'version', id: String(v.attachment_id), label: `Version ${v.version || 1}${v.title ? `: ${v.title}` : ''}` })),
])
// ?target=version:<attachment id> (or scene:<id>) opens the review on that version or scene.
const initialTarget = computed(() => {
  const [type, id] = String(route?.query?.target || '').split(':')
  return ['scene', 'version'].includes(type) && id ? { type, id } : null
})

async function load() {
  error.value = ''
  try {
    project.value = (await api.get(`/video/projects/${encodeURIComponent(props.projectId)}/`)).data
    try { versions.value = (await api.get(`/video/projects/${encodeURIComponent(props.projectId)}/versions/`, { params: { page_size: 200 } })).data?.versions || [] } catch { versions.value = [] }
  } catch (e) {
    project.value = null
    error.value = e?.response?.status === 404 ? 'This project does not exist, or you do not have access to it.' : errorText(e, 'The project could not be opened.')
  } finally { loading.value = false }
}
async function loadUsage() {
  usage.value = null; usageError.value = ''
  try { usage.value = (await sharing.usage(props.projectId)).data } catch (e) { usageError.value = errorText(e, 'Spend could not be loaded.') }
}
async function setStatus(status) {
  statusBusy.value = true; statusError.value = ''
  try { const { data } = await sharing.review(props.projectId, status); project.value = { ...project.value, review_status: data.review_status } }
  catch (e) { statusError.value = errorText(e, 'The review status could not be changed.') } finally { statusBusy.value = false }
}
watch(() => props.projectId, () => { loading.value = true; load() }, { immediate: true })
watch(current, t => { if (t === 'usage') loadUsage() }, { immediate: true })
</script>

<style scoped>
.vpr{display:grid;gap:18px;align-content:start;min-height:100%;padding:24px 32px 32px;box-sizing:border-box;color:var(--vm-ink)}
.vpr-head{display:grid;gap:10px}
.vpr-back{justify-self:start;display:inline-flex;align-items:center;min-height:32px;color:var(--vm-link);font-size:12.5px;text-decoration:none}.vpr-back::before{content:'‹';margin-right:6px;font-size:16px}
.vpr-title-row{display:flex;flex-wrap:wrap;align-items:baseline;gap:12px}
.vpr h1{margin:0;font-size:26px;font-weight:550;letter-spacing:-.03em;overflow-wrap:anywhere}
.vpr-role{font-size:12.5px;color:var(--vm-ink-soft)}
.vpr-actions{display:flex;flex-wrap:wrap;align-items:flex-end;gap:8px}
.vpr-status{display:grid;gap:5px;font-size:11.5px;color:var(--vm-ink-soft)}
.vpr-status select{min-height:40px;padding:0 10px;border:1px solid var(--vm-line);border-radius:6px;background:var(--vm-surface);color:var(--vm-ink);font:inherit;font-size:13px}
.vpr-badge{align-self:center;font-size:12px;padding:3px 10px;border-radius:999px;color:var(--vs-accent-ink);background:var(--vm-primary-soft)}.vpr-badge.approved{color:var(--vs-ok-ink);background:var(--vs-ok-bg)}.vpr-badge.changes_requested{color:var(--vs-warn-ink);background:var(--vs-warn-bg)}
.vpr-btn{display:inline-flex;align-items:center;min-height:40px;padding:0 14px;border:1px solid var(--vm-line);border-radius:6px;background:transparent;color:var(--vm-ink);font:inherit;font-size:13px;font-weight:500;text-decoration:none;cursor:pointer}
.vpr-btn:hover{background:var(--vm-surface-2)}.vpr-btn.primary{background:var(--vm-violet-d);border-color:transparent;color:#fff}.vpr-btn.primary:hover{background:var(--vm-violet)}
.vpr-tabs{display:flex;gap:4px;border-bottom:1px solid var(--vm-line-2)}
.vpr-tab{display:inline-flex;align-items:center;min-height:44px;padding:0 14px;border-bottom:2px solid transparent;color:var(--vm-ink-soft);font-size:13px;font-weight:500;text-decoration:none}.vpr-tab:hover{color:var(--vm-ink)}.vpr-tab.on{color:var(--vm-ink);border-bottom-color:var(--vm-violet)}
.vpr-note{margin:0;font-size:13px;color:var(--vm-ink-soft)}.vpr-bad{margin:0;font-size:13px;color:var(--vs-bad-ink)}
.vpr-usage{display:grid;gap:12px;max-width:640px}
.vpr-table{width:100%;border-collapse:collapse;font-size:13px}.vpr-table th,.vpr-table td{padding:10px 8px;border-bottom:1px solid var(--vm-line-2);text-align:left}.vpr-table td:nth-child(n+2),.vpr-table thead th:nth-child(n+2){text-align:right;font-variant-numeric:tabular-nums}.vpr-table thead th{font-size:11.5px;font-weight:500;color:var(--vm-ink-soft)}.vpr-table tbody th{font-weight:500}.vpr-table tfoot th,.vpr-table tfoot td{font-weight:600;border-bottom:0}
.vpr-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.vpr :focus-visible{outline:2px solid var(--vs-accent-ink,var(--vm-link));outline-offset:2px}
@media(max-width:1023px){.vpr{padding-left:calc(16px + var(--vs-bar-inset, 0px))}}
@media(max-width:640px){.vpr{padding:16px}.vpr h1{font-size:22px}.vpr-btn,.vpr-status select{min-height:44px}.vpr-status select{font-size:16px}.vpr-tab{flex:1;justify-content:center}}
</style>
