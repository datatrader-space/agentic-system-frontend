// Marketplace pure-function tests (9.6): category derivation + search/category filtering, exactly as
// SkillsPage.vue consumes them via ./skillsMarketplace.js — no component mount needed.
import { describe, it, expect } from 'vitest'
import { skillCategory, matchesQuery, filterSkills, categoriesOf } from './skillsMarketplace'

const seoGuide = { name: 'SEO Guide', description: 'Rank pages higher',
                   frontmatter: { category: 'Marketing', tags: ['growth'] } }
const outreach = { name: 'Cold Outreach', description: 'Email sequences that convert',
                   frontmatter: { tags: ['Sales', 'email'] } }
const deployer = { name: 'Deploy Playbook', description: 'Ship to production safely', frontmatter: {} }
const bareSkill = { name: 'Bare', description: '' }   // no frontmatter at all
const ALL = [seoGuide, outreach, deployer, bareSkill]

describe('skillCategory', () => {
  it('prefers frontmatter.category over tags', () => {
    expect(skillCategory(seoGuide)).toBe('marketing')
  })
  it('falls back to the first tag when category is absent', () => {
    expect(skillCategory(outreach)).toBe('sales')
  })
  it("defaults to 'general' with empty frontmatter, missing frontmatter, or junk shapes", () => {
    expect(skillCategory(deployer)).toBe('general')
    expect(skillCategory(bareSkill)).toBe('general')
    expect(skillCategory({ frontmatter: { category: '   ', tags: [42, null] } })).toBe('general')
    expect(skillCategory({ frontmatter: 'not-an-object' })).toBe('general')
    expect(skillCategory(null)).toBe('general')
  })
  it('normalizes case and whitespace so equal categories collapse to one chip', () => {
    expect(skillCategory({ frontmatter: { category: '  MarKeting ' } })).toBe('marketing')
  })
})

describe('matchesQuery', () => {
  it('matches name, description, tags and derived category case-insensitively', () => {
    expect(matchesQuery(seoGuide, 'seo')).toBe(true)          // name
    expect(matchesQuery(outreach, 'CONVERT')).toBe(true)      // description
    expect(matchesQuery(outreach, 'email')).toBe(true)        // tag
    expect(matchesQuery(deployer, 'general')).toBe(true)      // derived category
    expect(matchesQuery(seoGuide, 'kubernetes')).toBe(false)
  })
  it('blank / null queries match everything', () => {
    expect(matchesQuery(bareSkill, '')).toBe(true)
    expect(matchesQuery(bareSkill, '   ')).toBe(true)
    expect(matchesQuery(bareSkill, null)).toBe(true)
  })
})

describe('filterSkills', () => {
  it('filters by search query across the set', () => {
    expect(filterSkills(ALL, 'ship')).toEqual([deployer])
  })
  it('filters by category, and composes category with search', () => {
    expect(filterSkills(ALL, '', 'sales')).toEqual([outreach])
    expect(filterSkills(ALL, 'email', 'sales')).toEqual([outreach])
    expect(filterSkills(ALL, 'seo', 'sales')).toEqual([])     // query and category must BOTH hold
  })
  it('empty query + empty category returns the whole set; junk input returns []', () => {
    expect(filterSkills(ALL, '', '')).toEqual(ALL)
    expect(filterSkills(undefined, 'x')).toEqual([])
  })
})

describe('categoriesOf', () => {
  it('returns sorted unique lowercase categories including the general fallback', () => {
    expect(categoriesOf(ALL)).toEqual(['general', 'marketing', 'sales'])
  })
  it('handles empty and junk input', () => {
    expect(categoriesOf([])).toEqual([])
    expect(categoriesOf(null)).toEqual([])
  })
})
