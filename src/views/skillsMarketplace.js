// Pure helpers for the Skills marketplace view (Phase 9.6) — extracted from SkillsPage.vue so the
// category derivation and search filtering are unit-testable without mounting the SFC. Presentation
// logic ONLY: trust/visibility/script rules stay backend-enforced, these just organize what the
// list endpoint already returned.

/** Category of a skill for the marketplace chip. The SERVER's stored `category` is authoritative
 * (one derivation, backend-side — services/skill_search.derive_category); the frontmatter/tag walk
 * below is only the fallback for rows saved before the field existed. */
export function skillCategory(skill) {
  const served = typeof skill?.category === 'string' ? skill.category.trim() : ''
  if (served) return served.toLowerCase()
  const fm = (skill && typeof skill.frontmatter === 'object' && skill.frontmatter) || {}
  const cat = typeof fm.category === 'string' ? fm.category.trim() : ''
  if (cat) return cat.toLowerCase()
  const tags = Array.isArray(fm.tags) ? fm.tags : []
  const first = typeof tags[0] === 'string' ? tags[0].trim() : ''
  return (first || 'general').toLowerCase()
}

/** True when the skill matches a free-text query against name, description, tags and its derived
 * category (case-insensitive). An empty/blank query matches everything. */
export function matchesQuery(skill, query) {
  const needle = String(query || '').trim().toLowerCase()
  if (!needle) return true
  const fm = (skill && typeof skill.frontmatter === 'object' && skill.frontmatter) || {}
  const tags = (Array.isArray(fm.tags) ? fm.tags : []).filter((t) => typeof t === 'string')
  return [skill?.name || '', skill?.description || '', ...tags, skillCategory(skill)]
    .join(' ').toLowerCase().includes(needle)
}

/** Skills matching both the search query and (when non-empty) the selected category. */
export function filterSkills(skills, query, category = '') {
  const rows = Array.isArray(skills) ? skills : []
  return rows.filter((s) => matchesQuery(s, query) && (!category || skillCategory(s) === category))
}

/** Sorted unique categories across a set of skills — feeds the filter-chip row. */
export function categoriesOf(skills) {
  const seen = new Set()
  for (const s of (Array.isArray(skills) ? skills : [])) seen.add(skillCategory(s))
  return [...seen].sort()
}
