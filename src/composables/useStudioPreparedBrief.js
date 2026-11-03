import { inject, ref, watch } from 'vue'
import { composePreset } from '../services/studioPresets'
// Only explicit preset selection updates this source. It edits a visible form field; never submits,
// chooses a model, fills consent, or creates trusted backend preset context.
export function useStudioPreparedBrief(target, variableLabel = null) {
  const look = inject('studioPreparedLook', ref(null))
  watch(look, value => { if (!value) return; const variable = value.variables?.find(field => field.label.toLowerCase() === variableLabel?.toLowerCase()); if (variableLabel && !variable) return; const text = variable ? variable.default : composePreset(value); if (text) target.value = text }, { immediate:true })
  return look
}
