<template>
  <section v-if="feature.layout === 'workspace'" class="st-workspace cs-workspace">
    <header class="cs-workspace-head"><h1>{{ feature.label }}</h1><p class="st-muted">{{ feature.purpose }}</p></header>
    <div class="cs-workspace-body"><StudioModeSwitch /><StudioFirstVisit :hidden="hintHidden" :planned-phase="feature.phase" @dismiss="dismissHint" /><div class="cs-message"><span class="st-pill">Coming soon</span><h2>Arrives with Phase {{ feature.phase }}</h2><p>Takes {{ feature.inputs.join(', ').toLowerCase() }}. Makes {{ feature.output.toLowerCase() }}.</p><RouterLink class="st-button" :to="feature.liveAlternative">Open a working tool</RouterLink></div>
      <fieldset class="cs-workspace-composer" disabled><legend>Planned workflow</legend><div v-if="!isAgent" class="cs-modes"><button type="button" class="st-button" disabled>Write it for me</button><button type="button" class="st-button" disabled>Suggest settings</button></div><div class="cs-modes"><span v-for="mode in feature.modes" :key="mode" class="st-pill">{{ mode }}</span></div><label v-for="input in feature.inputs" :key="input" class="st-field">{{ input }}<input class="st-input" :placeholder="input" disabled /></label><label class="st-field">Creative direction<textarea class="st-input" rows="3" placeholder="Describe the project you want to make" disabled /></label><QuoteBar :summary="feature.output" :shuffle="false" :disabled-reason="`Available with Phase ${feature.phase}`" /></fieldset>
      <h2>Workflow preview</h2><p class="st-muted">Plan the work, review each step and keep the results together.</p><PresetGallery :presets="previews" disabled />
    </div>
  </section>
  <StudioPage v-else :title="feature.label" :purpose="feature.purpose" :active-tab="activeTab" @update:active-tab="activeTab = $event">
    <template #form><StudioModeSwitch /><StudioFirstVisit :hidden="hintHidden" :planned-phase="feature.phase" @dismiss="dismissHint" /><div class="cs-message"><span class="st-pill">Coming soon</span><h2>Arrives with Phase {{ feature.phase }}</h2><p>{{ feature.purpose }}</p><p class="st-muted">Takes {{ feature.inputs.join(', ').toLowerCase() || 'your creative brief' }}. Makes {{ feature.output.toLowerCase() }}.</p><RouterLink class="st-button" :to="feature.liveAlternative">Open a working tool</RouterLink></div>
      <p v-if="isAgent" class="st-muted cs-agent-note">The {{ feature.label }} agent and composer will be available with Phase {{ feature.phase }}.</p><fieldset disabled class="cs-form" aria-label="Planned controls"><legend>Planned workflow</legend><div v-if="!isAgent" class="cs-modes"><button type="button" class="st-button" disabled>Write it for me</button><button type="button" class="st-button" disabled>Suggest settings</button></div><div v-if="feature.modes.length" class="cs-modes"><span v-for="mode in feature.modes" :key="mode" class="st-pill">{{ mode }}</span></div><label v-for="input in feature.inputs" :key="input" class="st-field"><span>{{ input }}</span><input class="st-input" :placeholder="input" disabled /></label><label class="st-field"><span>Creative direction</span><textarea class="st-input" rows="3" placeholder="Describe the result you want" disabled /></label></fieldset>
    </template>
    <template #presets><div class="cs-gallery"><h2>A preview of the workflow</h2><p class="st-muted">These layout illustrations show the planned controls, not available results.</p><PresetGallery :presets="previews" disabled /></div></template>
    <template #results><div class="st-empty"><strong>No runs are available on this page yet.</strong>Use the working alternative while this feature is being built.</div></template>
    <template #quote><QuoteBar :summary="feature.output" :shuffle="false" :disabled-reason="`Available with Phase ${feature.phase}`" /></template>
  </StudioPage>
</template>
<script setup>
import { computed, defineAsyncComponent, ref } from 'vue'
import { RouterLink } from 'vue-router'
import StudioPage from './StudioPage.vue'
import StudioModeSwitch from './StudioModeSwitch.vue'
import StudioFirstVisit from './StudioFirstVisit.vue'
import { useStudioExperience } from '../../composables/useStudioExperience'
const PresetGallery = defineAsyncComponent(() => import('./PresetGallery.vue'))
import QuoteBar from './QuoteBar.vue'
const props = defineProps({ feature: { type: Object, required: true } })
const { isAgent, hintHidden, dismissHint } = useStudioExperience(props.feature.id)
const activeTab = ref('presets')
const previews = computed(() => props.feature.plannedCards.map((card,index) => ({ id: String(index), category: 'Preview', ...card })))
</script>
<style scoped>
.cs-message{display:grid;gap:14px}.cs-message h2{font-size:17px}.cs-message p{font-size:13px;line-height:1.6}.cs-message .st-button{justify-self:start}.cs-form{display:grid;gap:16px;padding:18px 0 0;margin:0;border:0;border-top:1px solid var(--vm-line)}.cs-form legend{font-size:12px;color:var(--vm-ink-soft);padding:0 6px 0 0}.cs-modes{display:flex;flex-wrap:wrap;gap:6px}.cs-form input,.cs-form textarea{color:var(--vm-ink-soft);cursor:not-allowed}.cs-gallery{display:grid;gap:12px}.cs-gallery>p{font-size:13px;margin-bottom:8px}
.cs-workspace{min-height:100%;background:var(--vm-bg)}.cs-workspace-head{display:grid;gap:8px;min-height:76px;padding:18px 24px 18px calc(24px + var(--vs-bar-inset,0px));border-bottom:1px solid var(--vm-line-2)}.cs-workspace-head p{font-size:13px}.cs-workspace-body{display:grid;gap:20px;max-width:1100px;margin:auto;padding:32px 24px 48px}.cs-workspace-composer{display:grid;gap:16px;margin:0;padding:24px;border:1px solid var(--vm-line);border-radius:8px;background:var(--vm-surface)}.cs-workspace-composer legend{color:var(--vm-ink-soft);font-size:13px}.cs-workspace-composer :deep(.qb){padding:0}
@media(max-width:767px){.cs-message p,.cs-workspace-body>p{font-size:16px}.cs-workspace-body{padding:24px 16px}.cs-workspace-composer{padding:16px}.cs-workspace-head{padding-inline:calc(16px + var(--vs-bar-inset,0px)) 16px}}
</style>
