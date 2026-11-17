// What an Element can be, and the rights bases a person states (backend services/elements.py, ELEMENTS_V2_PLAN.md).
export const KINDS = [
  { value: 'character', label: 'Character' }, { value: 'product', label: 'Product' },
  { value: 'location', label: 'Location' }, { value: 'style', label: 'Style' },
  { value: 'brand', label: 'Brand' }, { value: 'voice', label: 'Voice' },
]
// Kinds whose rights the person confirms before approving (the IP check).
export const RIGHTS_KINDS = ['brand', 'product', 'character']
export const BASIS_LABELS = {
  created: 'I created it', owned: 'I own it', licensed: 'I hold a licence or written permission',
  public_domain: 'it is in the public domain',
}
export const VIEW_LABELS = { front: 'Front', three_quarter: 'Three-quarter', side: 'Side', back: 'Back', close_up: 'Close-up', full_body: 'Full body', detail: 'Detail' }
export const propertyLabel = key => key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')

// What the server takes from the rights fields ({ rights, likeness }), and whether they are complete
// (ElementRightsFields.vue holds the values: basis, rightsConfirmed, realPerson, subject, consentBasis, consentConfirmed).
export function rightsPayload(kind, v, { hasSample = false, hadLikeness = false } = {}) {
  const out = {}
  if (RIGHTS_KINDS.includes(kind)) out.rights = { basis: v.basis, confirmed: true }
  const real = hasSample || (kind === 'character' && v.realPerson)
  if (real) out.likeness = { real_person: true, subject_name: (v.subject || '').trim(), basis: v.consentBasis, confirmed: true }
  else if (kind === 'character' && hadLikeness) out.likeness = { real_person: false }
  return out
}
export function rightsComplete(kind, v, { hasSample = false } = {}) {
  const real = hasSample || (kind === 'character' && v.realPerson)
  return (!RIGHTS_KINDS.includes(kind) || (!!v.basis && !!v.rightsConfirmed))
    && (!real || (!!(v.subject || '').trim() && !!v.consentBasis && !!v.consentConfirmed))
}
export const emptyRights = () => ({ basis: '', rightsConfirmed: false, realPerson: false, subject: '', consentBasis: '', consentConfirmed: false })
