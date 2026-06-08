// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { mount } from '@vue/test-utils'
import AgentRulesEditor from './AgentRulesEditor.vue'
import { cleanRules, rulesValid, MAX_RULE_LEN } from './agentRules'

const builderSrc = readFileSync('src/components/AgentBuilder.vue', 'utf-8')

describe('AgentRulesEditor (P15–P20)', () => {
  // P15 / P16 — present on the agent create AND edit page. Both use the single AgentBuilder
  // component, so wiring it into AgentBuilder = present on both surfaces.
  it('P15/P16: AgentRulesEditor is wired into AgentBuilder (create + edit use the same component)', () => {
    expect(builderSrc).toContain("import AgentRulesEditor from './agent/AgentRulesEditor.vue'")
    expect(builderSrc).toContain('<AgentRulesEditor')
    expect(builderSrc).toContain('v-model="internalAgent.agent_rules"')
  })

  // P17 — add appends a row; remove deletes the correct row.
  it('P17: add rule appends a row', async () => {
    const wrapper = mount(AgentRulesEditor, { props: { modelValue: [] } })
    await wrapper.find('.add').trigger('click')
    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    expect(emitted[emitted.length - 1][0]).toEqual([''])
    // reflect the v-model back and confirm a row rendered
    await wrapper.setProps({ modelValue: [''] })
    expect(wrapper.findAll('.rule-row')).toHaveLength(1)
  })

  it('P17: remove deletes the correct row', async () => {
    const wrapper = mount(AgentRulesEditor, { props: { modelValue: ['a', 'b', 'c'] } })
    expect(wrapper.findAll('.rule-row')).toHaveLength(3)
    await wrapper.findAll('.remove')[1].trigger('click')  // remove "b"
    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted[emitted.length - 1][0]).toEqual(['a', 'c'])
  })

  // P18 — empty / whitespace-only rules are dropped on save (the cleaning the submit handler runs).
  it('P18: empty / whitespace-only rules are dropped by cleanRules', () => {
    expect(cleanRules(['keep', '   ', '', '\t\n', '  also keep  '])).toEqual(['keep', 'also keep'])
  })

  // P19 — rules round-trip: valid rules are preserved by cleaning (save), and rendered on load (edit).
  it('P19: valid rules round-trip (cleaned unchanged + rendered from modelValue)', () => {
    const rules = ['Always cite sources', 'Never use profanity']
    expect(cleanRules(rules)).toEqual(rules)
    const wrapper = mount(AgentRulesEditor, { props: { modelValue: rules } })
    const inputs = wrapper.findAll('.rule-input')
    expect(inputs).toHaveLength(2)
    expect(inputs[0].element.value).toBe('Always cite sources')
    expect(inputs[1].element.value).toBe('Never use profanity')
  })

  // P20 — an over-length rule (>200 chars) shows an inline error and is blocked (invalid).
  it('P20: over-length rule shows an inline error and is invalid (blocks save)', () => {
    const longRule = 'x'.repeat(MAX_RULE_LEN + 1)
    const wrapper = mount(AgentRulesEditor, { props: { modelValue: [longRule] } })
    expect(wrapper.find('.error').exists()).toBe(true)
    expect(wrapper.find('.rule-input').classes()).toContain('invalid')
    expect(rulesValid([longRule])).toBe(false)
    expect(rulesValid(['within limit'])).toBe(true)
  })
})
